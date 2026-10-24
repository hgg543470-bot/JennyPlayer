// =========================================================================
// 🎵 ENGINE_AUDIO.JS (АВТО-МАСТЕР-ПОТОЛОК + SOFT-CLIP WAVE-SHAPER + 3D STUDIO)
// =========================================================================

window.audioCtx = null;
window.inputMixer = null; 
window.htmlGain = null; 
window.preAmpNode = null; 
window.gainNode = null; 
window.compressorNode = null;
window.eqNodes = {};

window.firNode = null;
window.firGainNode = null;
window.preFirPad = null; 

window.splitLow = null; window.splitMid = null; window.splitHigh = null;
window.compLow = null; window.compMid = null; window.compHigh = null;
window.midPhaseNode = null;
window.deEssGain = null;
window.masterSafeComp = null;

window.activeDynamicNodes = [];

window.studioBuffer = null;
window.studioSourceNode = null;
window.isStudioPlaying = false;
window.lastComputedCeilingDb = 0.0;

window.appConfig = JSON.parse(localStorage.getItem('ytm_config')) || {};

window.DSP_MOD_DEFAULTS = {
    opt_midPhase: false,   val_midPhase: 3.0,     // +3 dB (выдвижение СЧ вокала)
    opt_midQ: false,       val_midQ: 150,         // 150% (ширина купола СЧ)
    opt_deEsser: false,    val_deEsser: -6.0,     // -6 dB (де-эссер ВЧ)
    opt_cleanFir: false,   val_cleanFir: 3.0,     // +3 dB (драйв чистого FIR без гула)
    opt_masterCeil: true,  val_masterCeil: -1.0,  // Автоматический расчёт!
    opt_autoRms: false,    val_autoRms: -10.0,    // -10 dB (целевая плотность RMS)
    opt_monoBass: false,   val_monoBass: 120,     // 120 Hz (моно-саббас)
    opt_msWidth: false,    val_msWidth: 150,      // 150% (3D стерео-панорама без потери центра)
    opt_punch: false,      val_punch: 6.0,        // +6 dB (упругий панч бочки и снейра)
    opt_crossfeed: false,  val_crossfeed: 75      // 75% (бинауральные колонки)
};

window.dbToLinear = function(db) {
    let val = parseFloat(db);
    if (isNaN(val)) return 1.0;
    return Math.pow(10, Math.max(-80, Math.min(40, val)) / 20);
};

window.trackNode = function(node, bucket) {
    if (bucket && node) bucket.push(node);
    return node;
};

window.cleanupDynamicNodes = function() {
    if (!window.activeDynamicNodes) return;
    while (window.activeDynamicNodes.length > 0) {
        let n = window.activeDynamicNodes.pop();
        try { n.disconnect(); } catch (e) {}
    }
};

// Мягкий ламповый анти-клиппер (Tanh Soft Clipper) — на 100% защищает от цифрового пердежа и отключения звука ЦАПом!
window.createSoftClipWaveShaper = function(ctx, bucket) {
    let shaper = window.trackNode(ctx.createWaveShaper(), bucket);
    let samples = 8192;
    let curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
        let x = (i * 2) / samples - 1;
        // Мягкое аналоговое насыщение гиперболическим тангенсом с потолком 0.96 (-0.3 dBFS)
        curve[i] = Math.tanh(x * 1.35) * 0.96;
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    return shaper;
};

// Интеллектуальный расчёт компенсации Мастер-Потолка по ВСЕМ включённым эффектам сразу!
window.calculateAutoMasterPadDb = function(cfg) {
    let hotDb = 0.0;

    if (cfg.firEnabled && cfg.firSettings) {
        let fg = parseFloat(cfg.firSettings.gain) || 2.0;
        if (fg > 1.0) hotDb += 20 * Math.log10(fg) * 0.45;
        if (cfg.opt_cleanFir) {
            let cfDb = parseFloat(cfg.val_cleanFir) || 0;
            if (cfDb > 0) hotDb += cfDb * 0.4;
        }
    }
    if (cfg.opt_midPhase) {
        let mpDb = parseFloat(cfg.val_midPhase) || 0;
        if (mpDb > 0) hotDb += mpDb * 0.45;
    }
    if (cfg.opt_deEsser) {
        let deDb = parseFloat(cfg.val_deEsser) || 0;
        if (deDb > 0) hotDb += deDb * 0.35;
    }
    if (cfg.opt_punch) {
        let pDb = parseFloat(cfg.val_punch) || 0;
        if (pDb > 0) hotDb += pDb * 0.68;
    }
    if (cfg.opt_msWidth) {
        let wPct = parseFloat(cfg.val_msWidth);
        if (isNaN(wPct)) wPct = 150;
        if (wPct > 100) {
            hotDb += Math.min(18, 20 * Math.log10(1 + (wPct - 100) / 150) * 0.65);
        }
    }
    if (cfg.opt_crossfeed) {
        let cPct = parseFloat(cfg.val_crossfeed) || 0;
        if (cPct > 80) hotDb += Math.min(6, (cPct - 80) * 0.03);
    }
    if (cfg.opt_autoRms) {
        let tRms = parseFloat(cfg.val_autoRms);
        if (isNaN(tRms)) tRms = -10;
        if (tRms > -12) hotDb += (tRms + 12) * 0.75;
    }

    let padDb = -Math.max(0.5, hotDb);
    window.lastComputedCeilingDb = Math.round(padDb * 10) / 10;
    const badge = document.getElementById('autoCeilStatusBadge');
    if (badge) {
        badge.innerText = cfg.opt_masterCeil
            ? `Авто: ${window.lastComputedCeilingDb} dB`
            : `ВЫКЛ (Риск клипа!)`;
        badge.style.color = cfg.opt_masterCeil ? '#3fb950' : '#f85149';
    }
    return padDb;
};

window.computeBufferAutoGain = function(audioBuffer, targetDb) {
    if (!audioBuffer) return 1.0;
    let ch0 = audioBuffer.getChannelData(0);
    let ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : ch0;
    let len = ch0.length;
    let step = Math.max(1, Math.floor(len / 60000));
    let sumSq = 0;
    let count = 0;
    for (let i = 0; i < len; i += step) {
        let s = 0.5 * (ch0[i] + ch1[i]);
        sumSq += s * s;
        count++;
    }
    let rms = Math.sqrt(sumSq / Math.max(1, count));
    if (rms < 0.0001) return 1.0;
    let currentDb = 20 * Math.log10(rms);
    let tDb = isNaN(parseFloat(targetDb)) ? -10.0 : parseFloat(targetDb);
    let diffDb = Math.max(-30, Math.min(24, tDb - currentDb));
    return Math.pow(10, diffDb / 20);
};

window.createFIRImpulse = function(context, decayMs) {
    let sampleRate = context.sampleRate;
    let length = Math.max(2, Math.floor(sampleRate * ((parseFloat(decayMs) || 4) / 1000)));
    let impulse = context.createBuffer(2, length, sampleRate);
    const cfg = window.appConfig || {};

    let lengthNorm = Math.sqrt(192 / Math.max(16, length));
    let cleanDriveDb = parseFloat(cfg.val_cleanFir);
    if (isNaN(cleanDriveDb)) cleanDriveDb = 3.0;
    let cleanLinear = window.dbToLinear(cleanDriveDb);

    for (let channel = 0; channel < 2; channel++) {
        let data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            if (i === 0) {
                data[i] = 1.0;
            } else if (cfg.phaseFixEnabled) {
                data[i] = Math.exp(-i / (length / 2.5)) * 0.055 * lengthNorm * Math.cos(i * 0.65) * (channel === 0 ? 1 : -1);
            } else if (cfg.opt_cleanFir) {
                // Гладкая апериодическая биполярная кривая (БЕЗ металлического звона синуса на одной ноте!)
                let a = Math.exp(-i / (length / 6.0));
                let b = Math.exp(-i / (length / 2.1));
                data[i] = (a - 0.46 * b) * 0.08 * lengthNorm * cleanLinear;
            } else {
                data[i] = Math.exp(-i / (length / 3)) * 0.05 * lengthNorm;
            }
        }
    }
    return impulse;
};

// Стадия 1 (ДО лимитера): Авто-RMS (выравнивает вход в лимитер!) + Моно-Саббас
window.insertProStudioPreChain = function(ctx, inputNode, cfg, bucket, sourceBuf) {
    let cur = inputNode;
    const reg = (n) => window.trackNode(n, bucket);
    const monoGain = (val) => {
        let g = reg(ctx.createGain());
        g.channelCount = 1;
        g.channelCountMode = 'explicit';
        g.gain.value = val;
        return g;
    };

    // 1. ⚡ Авто-RMS: работает ДО лимитера (чтобы тихие треки плотно накачивались лимитером) + даёт 40% поправки на выход
    if (cfg.opt_autoRms) {
        let buf = sourceBuf || window.studioBuffer;
        let fullGain = buf ? window.computeBufferAutoGain(buf, cfg.val_autoRms) : window.dbToLinear((parseFloat(cfg.val_autoRms) || -10) + 10);
        let preGain = reg(ctx.createGain());
        preGain.gain.value = Math.pow(fullGain, 0.65);
        cur.connect(preGain);
        cur = preGain;
    }

    // 2. 🧲 Моно-Саббас (сводящийся в моно ниже N Hz без потери громкости!)
    if (cfg.opt_monoBass) {
        let monoHz = parseFloat(cfg.val_monoBass);
        if (isNaN(monoHz)) monoHz = 120;
        monoHz = Math.max(20, Math.min(20000, monoHz));

        let sp = reg(ctx.createChannelSplitter(2));
        let mg = reg(ctx.createChannelMerger(2));

        let midL = monoGain(0.5);
        let midR = monoGain(0.5);
        let sideL = monoGain(0.5);
        let sideR = monoGain(-0.5);

        let sideHp = reg(ctx.createBiquadFilter());
        sideHp.channelCount = 1; sideHp.channelCountMode = 'explicit';
        sideHp.type = 'highpass'; sideHp.frequency.value = monoHz; sideHp.Q.value = 0.707;

        let sideInv = monoGain(-1.0);

        cur.connect(sp);
        sp.connect(midL, 0); sp.connect(midR, 1);
        sp.connect(sideL, 0); sp.connect(sideR, 1);
        sideL.connect(sideHp); sideR.connect(sideHp);
        sideHp.connect(sideInv);

        midL.connect(mg, 0, 0); midR.connect(mg, 0, 0); sideHp.connect(mg, 0, 0);
        midL.connect(mg, 0, 1); midR.connect(mg, 0, 1); sideInv.connect(mg, 0, 1);

        let out = reg(ctx.createGain());
        mg.connect(out);
        cur = out;
    }

    return cur;
};

// Стадия 2 (ПОСЛЕ полосовых компрессоров + ЗАЩИЩЁННАЯ ФИНАЛЬНЫМ АВТО-ПОТОЛКОМ!):
window.insertProStudioPostChain = function(ctx, inputNode, cfg, bucket, sourceBuf) {
    let cur = inputNode;
    const reg = (n) => window.trackNode(n, bucket);
    const monoGain = (val) => {
        let g = reg(ctx.createGain());
        g.channelCount = 1;
        g.channelCountMode = 'explicit';
        g.gain.value = val;
        return g;
    };

    // Остаток Авто-RMS (35%) для точной калибровки выходной громкости
    if (cfg.opt_autoRms) {
        let buf = sourceBuf || window.studioBuffer;
        let fullGain = buf ? window.computeBufferAutoGain(buf, cfg.val_autoRms) : window.dbToLinear((parseFloat(cfg.val_autoRms) || -10) + 10);
        let postRms = reg(ctx.createGain());
        postRms.gain.value = Math.pow(fullGain, 0.35);
        cur.connect(postRms);
        cur = postRms;
    }

    // 🥁 Панч-Хлыст Атаки (Музыкальный динамический удар бочки 75 Гц + презенс снейра 2200 Гц без телефонного визга!)
    if (cfg.opt_punch) {
        let punchDb = parseFloat(cfg.val_punch);
        if (isNaN(punchDb)) punchDb = 6.0;
        let clampedPunch = Math.max(-24, Math.min(24, punchDb));

        let kickBody = reg(ctx.createBiquadFilter());
        kickBody.type = 'peaking';
        kickBody.frequency.value = 72;
        kickBody.Q.value = 1.35;
        kickBody.gain.value = clampedPunch;

        let snareSnap = reg(ctx.createBiquadFilter());
        snareSnap.type = 'peaking';
        snareSnap.frequency.value = 2100;
        snareSnap.Q.value = 0.9;
        snareSnap.gain.value = clampedPunch * 0.45;

        cur.connect(kickBody);
        kickBody.connect(snareSnap);
        cur = snareSnap;
    }

    // 🎭 Стерео-Ширина (%) — Музыкальный 3D-Даблер + Mid/Side (НИКОГДА не убивает центральный бас и вокал!)
    if (cfg.opt_msWidth) {
        let pct = parseFloat(cfg.val_msWidth);
        if (isNaN(pct)) pct = 150;
        let w = Math.max(0, Math.min(500, pct)) / 100.0;

        let sp = reg(ctx.createChannelSplitter(2));
        let mg = reg(ctx.createChannelMerger(2));

        // Центр (Mid) ВСЕГДА остаётся полновесным (1.0), чтобы бочка и вокал никогда не пропадали!
        let mL = monoGain(0.5);
        let mR = monoGain(0.5);

        // Боковая составляющая (Side) масштабируется плавно и музыкально
        let sideScale = (w <= 1.0) ? w : (1.0 + (w - 1.0) * 0.65);
        let sL = monoGain(0.5 * sideScale);
        let sR = monoGain(-0.5 * sideScale);
        let sBus = monoGain(1.0);
        let sInv = monoGain(-1.0);

        cur.connect(sp);
        sp.connect(mL, 0); sp.connect(mR, 1);
        sp.connect(sL, 0); sp.connect(sR, 1);
        sL.connect(sBus); sR.connect(sBus);
        sBus.connect(sInv);

        mL.connect(mg, 0, 0); mR.connect(mg, 0, 0); sBus.connect(mg, 0, 0);
        mL.connect(mg, 0, 1); mR.connect(mg, 0, 1); sInv.connect(mg, 0, 1);

        // При >100% включается студийный 3D-Даблер (левое ухо 5.5 мс, правое 8.5 мс выше 220 Гц) — даёт широченный купол!
        if (w > 1.0) {
            let doublerGain = Math.min(0.55, (w - 1.0) * 0.22);
            let hpD = reg(ctx.createBiquadFilter());
            hpD.type = 'highpass'; hpD.frequency.value = 220;

            let lpD = reg(ctx.createBiquadFilter());
            lpD.type = 'lowpass'; lpD.frequency.value = 9500;

            let dLeft = reg(ctx.createDelay(0.05)); dLeft.channelCount = 1; dLeft.channelCountMode = 'explicit'; dLeft.delayTime.value = 0.0058;
            let dRight = reg(ctx.createDelay(0.05)); dRight.channelCount = 1; dRight.channelCountMode = 'explicit'; dRight.delayTime.value = 0.0089;

            let gDL = monoGain(doublerGain);
            let gDR = monoGain(-doublerGain);

            cur.connect(hpD); hpD.connect(lpD);
            lpD.connect(dLeft); dLeft.connect(gDL); gDL.connect(mg, 0, 0);
            lpD.connect(dRight); dRight.connect(gDR); gDR.connect(mg, 0, 1);
        }

        let out = reg(ctx.createGain());
        // Авто-нормализация громкости матрицы, чтобы при 300-500% не взрывался уровень
        out.gain.value = 1.0 / (1.0 + Math.max(0, w - 1.0) * 0.28);
        mg.connect(out);
        cur = out;
    }

    // 🎧 Бинаурал «Колонки в комнате» (%)
    if (cfg.opt_crossfeed) {
        let mixPct = parseFloat(cfg.val_crossfeed);
        if (isNaN(mixPct)) mixPct = 75;
        let mix = Math.max(0, Math.min(250, mixPct)) / 100.0;

        let sp = reg(ctx.createChannelSplitter(2));
        let mg = reg(ctx.createChannelMerger(2));

        let dL = reg(ctx.createDelay(0.05)); dL.channelCount = 1; dL.channelCountMode = 'explicit'; dL.delayTime.value = 0.00042;
        let dR = reg(ctx.createDelay(0.05)); dR.channelCount = 1; dR.channelCountMode = 'explicit'; dR.delayTime.value = 0.00042;

        let lpL = reg(ctx.createBiquadFilter()); lpL.channelCount = 1; lpL.channelCountMode = 'explicit'; lpL.type = 'lowpass'; lpL.frequency.value = 650;
        let lpR = reg(ctx.createBiquadFilter()); lpR.channelCount = 1; lpR.channelCountMode = 'explicit'; lpR.type = 'lowpass'; lpR.frequency.value = 650;

        let crossGain = 0.42 * mix;
        let directGain = Math.max(0.35, 1.0 - 0.25 * mix);

        let xL = monoGain(crossGain);
        let xR = monoGain(crossGain);
        let dirL = monoGain(directGain);
        let dirR = monoGain(directGain);

        cur.connect(sp);
        sp.connect(dirL, 0); dirL.connect(mg, 0, 0);
        sp.connect(dirR, 1); dirR.connect(mg, 0, 1);

        sp.connect(dL, 0); dL.connect(lpL); lpL.connect(xL); xL.connect(mg, 0, 1);
        sp.connect(dR, 1); dR.connect(lpR); lpR.connect(xR); xR.connect(mg, 0, 0);

        let cfOut = reg(ctx.createGain());
        cfOut.gain.value = 1.0 / (directGain + crossGain * 0.65);
        mg.connect(cfOut);
        cur = cfOut;
    }

    // 🛡️ ФИНАЛЬНЫЙ АВТОМАТИЧЕСКИЙ МАСТЕР-ПОТОЛОК (рассчитывается индивидуально под текущую комбинацию всех включённых эффектов!)
    let padDb = window.calculateAutoMasterPadDb(cfg);
    if (cfg.opt_masterCeil || cfg.phaseFixEnabled) {
        let autoPad = reg(ctx.createGain());
        autoPad.gain.value = window.dbToLinear(padDb);

        window.masterSafeComp.threshold.value = -1.5;
        window.masterSafeComp.knee.value = 6.0;
        window.masterSafeComp.ratio.value = 20.0;
        window.masterSafeComp.attack.value = 0.001;
        window.masterSafeComp.release.value = 0.05;

        let softClipper = window.createSoftClipWaveShaper(ctx, bucket);

        cur.connect(autoPad);
        autoPad.connect(window.masterSafeComp);
        window.masterSafeComp.connect(softClipper);
        cur = softClipper;
    }

    return cur;
};

window.initAudioBoost = function() {
    if (!window.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        window.audioCtx = new AudioContext({ latencyHint: 'playback' }); 
        const player = document.getElementById('audioPlayer');
        
        window.inputMixer = window.audioCtx.createGain();
        window.htmlGain = window.audioCtx.createGain(); 
        
        let trackSource = window.audioCtx.createMediaElementSource(player);
        trackSource.connect(window.htmlGain);
        window.htmlGain.connect(window.inputMixer);
        
        window.preAmpNode = window.audioCtx.createGain();
        window.preAmpNode.gain.value = 0.6; 
        
        window.preFirPad = window.audioCtx.createGain();
        window.preFirPad.gain.value = 0.8;

        window.firGainNode = window.audioCtx.createGain();

        window.eqNodes.band60 = window.audioCtx.createBiquadFilter(); window.eqNodes.band60.type = 'lowshelf'; window.eqNodes.band60.frequency.value = 60;
        window.eqNodes.band230 = window.audioCtx.createBiquadFilter(); window.eqNodes.band230.type = 'peaking'; window.eqNodes.band230.frequency.value = 230;
        window.eqNodes.band910 = window.audioCtx.createBiquadFilter(); window.eqNodes.band910.type = 'peaking'; window.eqNodes.band910.frequency.value = 910;
        window.eqNodes.band3600 = window.audioCtx.createBiquadFilter(); window.eqNodes.band3600.type = 'peaking'; window.eqNodes.band3600.frequency.value = 3600;
        window.eqNodes.band14000 = window.audioCtx.createBiquadFilter(); window.eqNodes.band14000.type = 'highshelf'; window.eqNodes.band14000.frequency.value = 14000;

        window.splitLow = window.audioCtx.createBiquadFilter(); window.splitLow.type = 'lowpass'; 
        window.splitMid = window.audioCtx.createBiquadFilter(); window.splitMid.type = 'bandpass'; 
        window.splitHigh = window.audioCtx.createBiquadFilter(); window.splitHigh.type = 'highpass'; 

        window.compLow = window.audioCtx.createDynamicsCompressor();
        window.compMid = window.audioCtx.createDynamicsCompressor();
        window.compHigh = window.audioCtx.createDynamicsCompressor();
        window.compressorNode = window.audioCtx.createDynamicsCompressor(); 

        window.gainNode = window.audioCtx.createGain();
        window.midPhaseNode = window.audioCtx.createGain();
        window.deEssGain = window.audioCtx.createGain();
        window.masterSafeComp = window.audioCtx.createDynamicsCompressor();
    }
    if (window.audioCtx.state === 'suspended') { window.audioCtx.resume(); }
    window.buildAudioGraph(); 
};

window.buildAudioGraph = function() {
    if (!window.audioCtx) return;

    window.cleanupDynamicNodes();

    try { window.inputMixer.disconnect(); } catch(e){}
    try { window.preAmpNode.disconnect(); } catch(e){}
    try { if (window.firNode) window.firNode.disconnect(); } catch(e){}
    try { window.preFirPad.disconnect(); window.firGainNode.disconnect(); } catch(e){}
    try { window.gainNode.disconnect(); } catch(e){}
    try { window.compressorNode.disconnect(); } catch(e){}
    try { window.splitLow.disconnect(); window.splitMid.disconnect(); window.splitHigh.disconnect(); } catch(e){}
    try { window.compLow.disconnect(); window.compMid.disconnect(); window.compHigh.disconnect(); } catch(e){}
    try { window.midPhaseNode.disconnect(); window.deEssGain.disconnect(); window.masterSafeComp.disconnect(); } catch(e){}
    Object.values(window.eqNodes).forEach(node => { try { node.disconnect(); } catch(e){} });

    const cfg = window.appConfig || {};
    window.preAmpNode.gain.value = 0.6;

    let currentNode = window.inputMixer;
    currentNode.connect(window.preAmpNode);
    currentNode = window.preAmpNode;

    if (cfg.firEnabled && cfg.firSettings) {
        window.firNode = window.trackNode(window.audioCtx.createConvolver(), window.activeDynamicNodes);
        window.firNode.normalize = false;
        window.firNode.buffer = window.createFIRImpulse(window.audioCtx, cfg.firSettings.decay);
        window.firGainNode.gain.value = cfg.firSettings.gain;
        currentNode.connect(window.preFirPad);
        window.preFirPad.connect(window.firNode);
        window.firNode.connect(window.firGainNode);
        currentNode = window.firGainNode;
    }

    if (cfg.eqEnabled) {
        currentNode.connect(window.eqNodes.band60);
        window.eqNodes.band60.connect(window.eqNodes.band230);
        window.eqNodes.band230.connect(window.eqNodes.band910);
        window.eqNodes.band910.connect(window.eqNodes.band3600);
        window.eqNodes.band3600.connect(window.eqNodes.band14000);
        currentNode = window.eqNodes.band14000;
    }

    currentNode = window.insertProStudioPreChain(window.audioCtx, currentNode, cfg, window.activeDynamicNodes);

    currentNode.connect(window.gainNode);
    currentNode = window.gainNode;

    if (cfg.limiterEnabled && cfg.limiterSettings) {
        let thresh = cfg.limiterSettings.threshold;
        let knee = cfg.limiterSettings.knee;
        let ratio = cfg.limiterSettings.ratio;

        if (cfg.multiBandEnabled && cfg.multiBandSettings) {
            let lowFreq = Math.max(20, cfg.multiBandSettings.low || 200);
            let highFreq = Math.max(lowFreq + 100, cfg.multiBandSettings.high || 2500);
            let midCenter = Math.sqrt(lowFreq * highFreq);
            let midQ = midCenter / (highFreq - lowFreq);

            window.splitLow.frequency.value = lowFreq;
            window.splitMid.frequency.value = midCenter;
            window.splitMid.Q.value = midQ;
            window.splitHigh.frequency.value = highFreq;

            window.compLow.threshold.value = thresh; window.compLow.knee.value = knee; window.compLow.ratio.value = ratio;
            window.compLow.attack.value = cfg.limiterSettings.attack / 1000; 
            window.compLow.release.value = cfg.limiterSettings.release / 1000;

            window.compMid.threshold.value = thresh + 2; window.compMid.knee.value = knee; window.compMid.ratio.value = ratio;
            window.compMid.attack.value = 0.002; window.compMid.release.value = 0.1;

            window.compHigh.threshold.value = thresh + 4; window.compHigh.knee.value = knee; window.compHigh.ratio.value = ratio;
            window.compHigh.attack.value = 0.001; window.compHigh.release.value = 0.05;

            currentNode.connect(window.splitLow); currentNode.connect(window.splitMid); currentNode.connect(window.splitHigh);
            window.splitLow.connect(window.compLow); window.splitMid.connect(window.compMid); window.splitHigh.connect(window.compHigh);

            let postBus = window.trackNode(window.audioCtx.createGain(), window.activeDynamicNodes);

            if (cfg.phaseFixEnabled) {
                window.splitMid.Q.value = Math.max(0.25, midQ * 0.65);
                window.midPhaseNode.gain.value = -1.22;
                window.compLow.connect(postBus);
                window.compMid.connect(window.midPhaseNode);
                window.midPhaseNode.connect(postBus);
                window.compHigh.connect(postBus);
            } else {
                // Защита от "1%" телефонной щели: минимум 25% ширины купола, чтобы никогда не пропадал вокал!
                let widthPct = parseFloat(cfg.val_midQ); if (isNaN(widthPct) || widthPct < 25) widthPct = 150;
                if (cfg.opt_midQ) {
                    window.splitMid.Q.value = Math.max(0.15, Math.min(2.5, midQ / (widthPct / 100.0)));
                }

                let midDb = parseFloat(cfg.val_midPhase); if (isNaN(midDb)) midDb = 3.0;
                window.midPhaseNode.gain.value = cfg.opt_midPhase ? -window.dbToLinear(Math.min(15, midDb)) : 1.0;

                let deEssDb = parseFloat(cfg.val_deEsser); if (isNaN(deEssDb)) deEssDb = -6.0;
                if (cfg.opt_deEsser) {
                    window.compHigh.threshold.value = Math.min(-6, thresh + 10);
                    window.compHigh.ratio.value = Math.min(4.0, ratio);
                    window.compHigh.attack.value = 0.0005;
                    window.compHigh.release.value = 0.09;
                    window.deEssGain.gain.value = window.dbToLinear(Math.min(12, deEssDb));
                } else {
                    window.deEssGain.gain.value = 1.0;
                }

                window.compLow.connect(postBus);
                window.compMid.connect(window.midPhaseNode);
                window.midPhaseNode.connect(postBus);
                window.compHigh.connect(window.deEssGain);
                window.deEssGain.connect(postBus);
            }

            let finalPost = window.insertProStudioPostChain(window.audioCtx, postBus, cfg, window.activeDynamicNodes);
            finalPost.connect(window.audioCtx.destination);
        } else {
            window.compressorNode.threshold.value = thresh;
            window.compressorNode.knee.value = knee;
            window.compressorNode.ratio.value = ratio;
            window.compressorNode.attack.value = cfg.limiterSettings.attack / 1000; 
            window.compressorNode.release.value = cfg.limiterSettings.release / 1000;
            
            currentNode.connect(window.compressorNode);
            let postOut = window.insertProStudioPostChain(window.audioCtx, window.compressorNode, cfg, window.activeDynamicNodes);
            postOut.connect(window.audioCtx.destination);
        }
    } else {
        let postOut = window.insertProStudioPostChain(window.audioCtx, currentNode, cfg, window.activeDynamicNodes);
        postOut.connect(window.audioCtx.destination);
    }
};
