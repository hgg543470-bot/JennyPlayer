// =========================================================================
// 🎵 ENGINE_AUDIO.JS (РЕАЛЬНЫЕ ЕДИНИЦЫ dB / % / Hz БЕЗ ЛИМИТОВ ДЛЯ ТЕСТА)
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
window.currentTrackAutoGain = 1.0;

window.appConfig = JSON.parse(localStorage.getItem('ytm_config')) || {};

// Все дефолты теперь в реальных физических величинах: dB, %, Hz
window.DSP_MOD_DEFAULTS = {
    opt_midPhase: false,   val_midPhase: 3.0,     // +3 dB (усиление СЧ в режиме инверсии фазы)
    opt_midQ: false,       val_midQ: 150,         // 150% (ширина купола СЧ в процентах)
    opt_deEsser: false,    val_deEsser: -6.0,     // -6 dB (подавление/усиление ВЧ сибилянтов в dB)
    opt_cleanFir: false,   val_cleanFir: 0.0,     // 0 dB (драйв чистого биполярного FIR в dB)
    opt_masterCeil: false, val_masterCeil: -1.0,  // -1 dB (порог мастер-потолка в dB)
    opt_autoRms: false,    val_autoRms: -8.0,     // -8 dB (целевая громкость RMS в dB)
    opt_monoBass: false,   val_monoBass: 120,     // 120 Hz (частота моно-баса в Гц)
    opt_msWidth: false,    val_msWidth: 150,      // 150% (0% = Моно, 100% = Штатно, 300%+ = Чистый 3D Side)
    opt_punch: false,      val_punch: 6.0,        // +6 dB (усиление панча бочки и атаки в dB ПОСЛЕ лимитера)
    opt_crossfeed: false,  val_crossfeed: 60      // 60% (сила бинаурального смешивания колонок в %)
};

window.dbToLinear = function(db) {
    let val = parseFloat(db);
    if (isNaN(val)) return 1.0;
    return Math.pow(10, val / 20);
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
    let tDb = isNaN(parseFloat(targetDb)) ? -8.0 : parseFloat(targetDb);
    // БЕЗ ОГРАНИЧЕНИЙ: сколько dB разницы попросил — столько честно и выдаём!
    let diffDb = tDb - currentDb;
    return Math.pow(10, diffDb / 20);
};

window.createFIRImpulse = function(context, decayMs) {
    let sampleRate = context.sampleRate;
    let length = Math.max(2, Math.floor(sampleRate * ((parseFloat(decayMs) || 4) / 1000)));
    let impulse = context.createBuffer(2, length, sampleRate);
    const cfg = window.appConfig || {};

    // Авто-компенсация длины импульса, чтобы при 2 мс и при 200 мс громкость хвоста была одинаково отчётливой!
    let lengthNorm = Math.sqrt(192 / Math.max(16, length));
    let cleanDriveDb = parseFloat(cfg.val_cleanFir);
    if (isNaN(cleanDriveDb)) cleanDriveDb = 0.0;
    let cleanLinear = Math.pow(10, cleanDriveDb / 20);

    for (let channel = 0; channel < 2; channel++) {
        let data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            if (i === 0) {
                data[i] = 1.0;
            } else if (cfg.phaseFixEnabled) {
                data[i] = Math.exp(-i / (length / 2.5)) * 0.06 * lengthNorm * Math.cos(i * 0.65) * (channel === 0 ? 1 : -1);
            } else if (cfg.opt_cleanFir) {
                // Ярко выраженный биполярный ламповый резонанс без глухого постоянного смещения (DC)
                let env = Math.exp(-i / (length / 3.5));
                data[i] = env * 0.12 * lengthNorm * cleanLinear * Math.sin(i * 0.22);
            } else {
                data[i] = Math.exp(-i / (length / 3)) * 0.05;
            }
        }
    }
    return impulse;
};

// Стадия 1 (ДО лимитера): Моно-Саббас (с крутым срезом 4-го порядка, чтобы было слышно сразу)
window.insertProStudioPreChain = function(ctx, inputNode, cfg, bucket) {
    let cur = inputNode;
    const reg = (n) => window.trackNode(n, bucket);
    const monoGain = (val) => {
        let g = reg(ctx.createGain());
        g.channelCount = 1;
        g.channelCountMode = 'explicit';
        g.gain.value = val;
        return g;
    };

    if (cfg.opt_monoBass) {
        let monoHz = parseFloat(cfg.val_monoBass);
        if (isNaN(monoHz)) monoHz = 120;
        monoHz = Math.max(10, Math.min(22000, monoHz));

        let sp = reg(ctx.createChannelSplitter(2));
        let mg = reg(ctx.createChannelMerger(2));

        let midL = monoGain(0.5);
        let midR = monoGain(0.5);
        let sideL = monoGain(0.5);
        let sideR = monoGain(-0.5);

        // Двойной каскад Highpass (24 dB/oct), чтобы ниже monoHz боковой сигнал вырезался намертво!
        let sideHp1 = reg(ctx.createBiquadFilter());
        sideHp1.channelCount = 1; sideHp1.channelCountMode = 'explicit';
        sideHp1.type = 'highpass'; sideHp1.frequency.value = monoHz; sideHp1.Q.value = 0.707;

        let sideHp2 = reg(ctx.createBiquadFilter());
        sideHp2.channelCount = 1; sideHp2.channelCountMode = 'explicit';
        sideHp2.type = 'highpass'; sideHp2.frequency.value = monoHz; sideHp2.Q.value = 0.707;

        let sideInv = monoGain(-1.0);

        cur.connect(sp);
        sp.connect(midL, 0); sp.connect(midR, 1);
        sp.connect(sideL, 0); sp.connect(sideR, 1);
        sideL.connect(sideHp1); sideR.connect(sideHp1);
        sideHp1.connect(sideHp2);
        sideHp2.connect(sideInv);

        midL.connect(mg, 0, 0); midR.connect(mg, 0, 0); sideHp2.connect(mg, 0, 0);
        midL.connect(mg, 0, 1); midR.connect(mg, 0, 1); sideInv.connect(mg, 0, 1);

        let out = reg(ctx.createGain());
        mg.connect(out);
        cur = out;
    }

    return cur;
};

// Стадия 2 (ПОСЛЕ всех лимитеров! Ничто не сплющивает эффект!): Авто-RMS, Панч-Хлыст, Стерео-Ширина %, Бинаурал %
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

    // 1. ⚡ Авто-RMS (вынесен ПОСЛЕ лимитера, чтобы изменение dB реально меняло итоговую громкость!)
    if (cfg.opt_autoRms) {
        let buf = sourceBuf || window.studioBuffer;
        let rmsGain = buf ? window.computeBufferAutoGain(buf, cfg.val_autoRms) : window.dbToLinear((parseFloat(cfg.val_autoRms) || -8) + 8);
        let gRms = reg(ctx.createGain());
        gRms.gain.value = rmsGain;
        cur.connect(gRms);
        cur = gRms;
    }

    // 2. 🥁 Панч-Хлыст Атаки (в dB без ограничений ПОСЛЕ лимитера!)
    if (cfg.opt_punch) {
        let punchDb = parseFloat(cfg.val_punch);
        if (isNaN(punchDb)) punchDb = 6.0;

        let kickSnap = reg(ctx.createBiquadFilter());
        kickSnap.type = 'peaking';
        kickSnap.frequency.value = 90;
        kickSnap.Q.value = 1.5;
        kickSnap.gain.value = punchDb;

        let snareSnap = reg(ctx.createBiquadFilter());
        snareSnap.type = 'peaking';
        snareSnap.frequency.value = 2800;
        snareSnap.Q.value = 1.2;
        snareSnap.gain.value = punchDb;

        cur.connect(kickSnap);
        kickSnap.connect(snareSnap);
        cur = snareSnap;
    }

    // 3. 🎭 Стерео-Ширина в ПРОЦЕНТАХ (0% = Моно, 100% = Оригинал, 200%+ = Вырез центра и чистое 3D окружение!)
    if (cfg.opt_msWidth) {
        let pct = parseFloat(cfg.val_msWidth);
        if (isNaN(pct)) pct = 150;
        let w = Math.max(0, pct) / 100.0;

        // При 0% -> Mid = 1, Side = 0 (100% Моно)
        // При 100% -> Mid = 1, Side = 1 (Оригинал)
        // При >100% -> Side растёт без ограничений, а Mid (центр) гасится вплоть до 0 (режим чистого Side/Караоке)
        let midLevel = (w <= 1.0) ? 1.0 : Math.max(0.0, 1.0 - (w - 1.0) * 0.45);
        let sideLevel = w;

        let sp = reg(ctx.createChannelSplitter(2));
        let mg = reg(ctx.createChannelMerger(2));

        let mL = monoGain(0.5 * midLevel);
        let mR = monoGain(0.5 * midLevel);

        let sL = monoGain(0.5 * sideLevel);
        let sR = monoGain(-0.5 * sideLevel);
        let sBus = monoGain(1.0);
        let sInv = monoGain(-1.0);

        cur.connect(sp);
        sp.connect(mL, 0); sp.connect(mR, 1);
        sp.connect(sL, 0); sp.connect(sR, 1);
        sL.connect(sBus); sR.connect(sBus);
        sBus.connect(sInv);

        mL.connect(mg, 0, 0); mR.connect(mg, 0, 0); sBus.connect(mg, 0, 0);
        mL.connect(mg, 0, 1); mR.connect(mg, 0, 1); sInv.connect(mg, 0, 1);

        // Активный Хаас-декореллятор (создаёт широкое стерео даже если трек записан в 100% моно!)
        if (w > 1.0) {
            let haasGain = (w - 1.0) * 0.45;
            let hpHaas = reg(ctx.createBiquadFilter());
            hpHaas.channelCount = 1; hpHaas.channelCountMode = 'explicit';
            hpHaas.type = 'highpass'; hpHaas.frequency.value = 220;

            let dHaas = reg(ctx.createDelay(0.05));
            dHaas.channelCount = 1; dHaas.channelCountMode = 'explicit';
            dHaas.delayTime.value = 0.00065; // 0.65 мс

            let gHL = monoGain(haasGain);
            let gHR = monoGain(-haasGain);

            sp.connect(hpHaas, 0);
            hpHaas.connect(dHaas);
            dHaas.connect(gHL);
            dHaas.connect(gHR);
            gHL.connect(mg, 0, 0);
            gHR.connect(mg, 0, 1);
        }

        let out = reg(ctx.createGain());
        mg.connect(out);
        cur = out;
    }

    // 4. 🎧 Бинаурал «Колонки в комнате» в ПРОЦЕНТАХ (0% = Выкл, 100% = Полный эффект колонок в комнате)
    if (cfg.opt_crossfeed) {
        let mixPct = parseFloat(cfg.val_crossfeed);
        if (isNaN(mixPct)) mixPct = 60;
        let mix = Math.max(0, mixPct) / 100.0;

        let sp = reg(ctx.createChannelSplitter(2));
        let mg = reg(ctx.createChannelMerger(2));

        let dL = reg(ctx.createDelay(0.05)); dL.channelCount = 1; dL.channelCountMode = 'explicit'; dL.delayTime.value = 0.00042;
        let dR = reg(ctx.createDelay(0.05)); dR.channelCount = 1; dR.channelCountMode = 'explicit'; dR.delayTime.value = 0.00042;

        let lpL = reg(ctx.createBiquadFilter()); lpL.channelCount = 1; lpL.channelCountMode = 'explicit'; lpL.type = 'lowpass'; lpL.frequency.value = 650;
        let lpR = reg(ctx.createBiquadFilter()); lpR.channelCount = 1; lpR.channelCountMode = 'explicit'; lpR.type = 'lowpass'; lpR.frequency.value = 650;

        let crossGain = 0.45 * mix;
        let directGain = Math.max(0.2, 1.0 - 0.35 * mix);

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
        mg.connect(cfOut);
        cur = cfOut;
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
            
            if (cfg.phaseFixEnabled) {
                window.splitMid.Q.value = Math.max(0.1, midQ * 0.65);
                window.midPhaseNode.gain.value = -1.22;
                window.masterSafeComp.threshold.value = -1.0;
                window.masterSafeComp.knee.value = 4.0;
                window.masterSafeComp.ratio.value = 18.0;
                window.masterSafeComp.attack.value = 0.001;
                window.masterSafeComp.release.value = 0.04;
                let postIn = window.trackNode(window.audioCtx.createGain(), window.activeDynamicNodes);
                window.compLow.connect(window.masterSafeComp);
                window.compMid.connect(window.midPhaseNode);
                window.midPhaseNode.connect(window.masterSafeComp);
                window.compHigh.connect(window.masterSafeComp);
                window.masterSafeComp.connect(postIn);
                let postOut = window.insertProStudioPostChain(window.audioCtx, postIn, cfg, window.activeDynamicNodes);
                postOut.connect(window.audioCtx.destination);
            } else {
                // 1. Ширина купола СЧ в % (100% = штатная, 200% = в 2 раза шире, 20% = узкий телефонный фильтр)
                let widthPct = parseFloat(cfg.val_midQ); if (isNaN(widthPct)) widthPct = 150;
                if (cfg.opt_midQ) {
                    window.splitMid.Q.value = Math.max(0.02, midQ / (Math.max(5, widthPct) / 100.0));
                }

                // 2. Инверсия фазы СЧ + Гейн в dB без ограничений!
                let midDb = parseFloat(cfg.val_midPhase); if (isNaN(midDb)) midDb = 3.0;
                window.midPhaseNode.gain.value = cfg.opt_midPhase ? -window.dbToLinear(midDb) : 1.0;

                // 3. Де-эссер ВЧ в dB без ограничений!
                let deEssDb = parseFloat(cfg.val_deEsser); if (isNaN(deEssDb)) deEssDb = -6.0;
                if (cfg.opt_deEsser) {
                    window.compHigh.threshold.value = Math.min(-6, thresh + 10);
                    window.compHigh.ratio.value = Math.min(4.0, ratio);
                    window.compHigh.attack.value = 0.0005;
                    window.compHigh.release.value = 0.09;
                    window.deEssGain.gain.value = window.dbToLinear(deEssDb);
                } else {
                    window.deEssGain.gain.value = 1.0;
                }

                let postBus = window.trackNode(window.audioCtx.createGain(), window.activeDynamicNodes);
                let finalPost = window.insertProStudioPostChain(window.audioCtx, postBus, cfg, window.activeDynamicNodes);
                finalPost.connect(window.audioCtx.destination);

                // 4. Мастер-потолок в dB (даже если поставить -30 dB, честно зажмёт и приглушит выход!)
                let ceilDb = parseFloat(cfg.val_masterCeil); if (isNaN(ceilDb)) ceilDb = -1.0;
                let outTarget = postBus;
                if (cfg.opt_masterCeil) {
                    window.masterSafeComp.threshold.value = Math.max(-60.0, Math.min(0.0, ceilDb));
                    window.masterSafeComp.knee.value = 2.0;
                    window.masterSafeComp.ratio.value = 20.0;
                    window.masterSafeComp.attack.value = 0.0005;
                    window.masterSafeComp.release.value = 0.04;
                    let ceilGain = window.trackNode(window.audioCtx.createGain(), window.activeDynamicNodes);
                    // Если задан низкий потолок (например -15 dB), реально опускаем выходной потолок!
                    ceilGain.gain.value = ceilDb < 0 ? window.dbToLinear(ceilDb * 0.6) : window.dbToLinear(ceilDb);
                    window.masterSafeComp.connect(ceilGain);
                    ceilGain.connect(postBus);
                    outTarget = window.masterSafeComp;
                }

                window.compLow.connect(outTarget);
                window.compMid.connect(window.midPhaseNode);
                window.midPhaseNode.connect(outTarget);
                window.compHigh.connect(window.deEssGain);
                window.deEssGain.connect(outTarget);
            }
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
