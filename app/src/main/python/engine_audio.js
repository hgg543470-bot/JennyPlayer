// =========================================================================
// 🎵 ENGINE_AUDIO.JS (ANTI-WHINE NOISE GATE + BARRACUDA 3D ALL-PASS STEREO)
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
window.masterAntiClickGain = null;
window._graphRebuildTimer = null;

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
    opt_msWidth: false,    val_msWidth: 160,      // 160% (3D All-Pass панорама для закрытых наушников)
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

// Гибридный WaveShaper: Убивает писк дросселей в тишине (Ultra-Low Noise Gate) + Мягкий Tanh Soft-Clipper на пиках!
window.createSoftClipWaveShaper = function(ctx, bucket) {
    let shaper = window.trackNode(ctx.createWaveShaper(), bucket);
    let half = 32768;
    let samples = half * 2 + 1; // 65537 — строго НЕЧЁТНОЕ число с точным 0.0 в центре
    let curve = new Float32Array(samples);
    let k = 1.25;
    let norm = Math.tanh(k);
    for (let i = 0; i < samples; i++) {
        let x = (i - half) / half;
        // Идеально гладкая линейная зона в районе нуля без ступеньки gateThresh (0% искажений на тихой речи и шёпоте!)
        curve[i] = Math.tanh(x * k) / norm * 0.98;
    }
    curve[half] = 0.0;
    shaper.curve = curve;
    shaper.oversample = 'none';
    return shaper;
};

window.calculateAutoMasterPadDb = function(cfg) {
    let hotDb = 0.0;
    let parts = [];

    if (cfg.firEnabled && cfg.firSettings) {
        let fg = parseFloat(cfg.firSettings.gain) || 2.0;
        let firHot = 0.0;
        if (fg > 1.0) firHot += 20 * Math.log10(fg) * 0.45;
        if (cfg.opt_cleanFir) {
            let cfDb = parseFloat(cfg.val_cleanFir) || 0;
            if (cfDb > 0) firHot += cfDb * 0.4;
        }
        if (firHot > 0.05) {
            hotDb += firHot;
            parts.push(`✨FIR -${firHot.toFixed(1)}`);
        }
    }
    if (cfg.opt_midPhase) {
        let mpDb = Math.min(15, parseFloat(cfg.val_midPhase) || 0);
        if (mpDb > 0) {
            let v = mpDb * 0.45;
            hotDb += v;
            parts.push(`🎯СЧ -${v.toFixed(1)}`);
        }
    }
    if (cfg.opt_deEsser) {
        let deDb = Math.min(12, parseFloat(cfg.val_deEsser) || 0);
        if (deDb > 0) {
            let v = deDb * 0.35;
            hotDb += v;
            parts.push(`🐍ВЧ -${v.toFixed(1)}`);
        }
    }
    if (cfg.opt_punch) {
        let pDb = Math.min(24, parseFloat(cfg.val_punch) || 0);
        if (pDb > 0) {
            let v = pDb * 0.18;
            hotDb += v;
            parts.push(`🥁Панч -${v.toFixed(1)}`);
        }
    }
    if (cfg.opt_msWidth) {
        let wPct = parseFloat(cfg.val_msWidth);
        if (isNaN(wPct)) wPct = 160;
        if (wPct > 100) {
            let v = Math.min(18, 20 * Math.log10(1 + (wPct - 100) / 140) * 0.68);
            if (v > 0.05) {
                hotDb += v;
                parts.push(`🎭Стерео -${v.toFixed(1)}`);
            }
        }
    }
    if (cfg.opt_crossfeed) {
        let cPct = parseFloat(cfg.val_crossfeed) || 0;
        if (cPct > 80) {
            let v = Math.min(6, (cPct - 80) * 0.03);
            if (v > 0.05) {
                hotDb += v;
                parts.push(`🎧Бин -${v.toFixed(1)}`);
            }
        }
    }
    if (cfg.opt_autoRms) {
        let tRms = parseFloat(cfg.val_autoRms);
        if (isNaN(tRms)) tRms = -10;
        if (tRms > -12) {
            let v = (tRms + 12) * 0.75;
            if (v > 0.05) {
                hotDb += v;
                parts.push(`⚡RMS -${v.toFixed(1)}`);
            }
        }
    }

    let padDb = -Math.max(0.5, hotDb);
    window.lastComputedCeilingDb = Math.round(padDb * 10) / 10;
    window.lastCeilingBreakdown = parts.length > 0 ? parts.join(' │ ') : 'Базовый запас -0.5 dB';

    const badge = document.getElementById('autoCeilStatusBadge');
    if (badge) {
        badge.innerText = cfg.opt_masterCeil
            ? `Авто: ${window.lastComputedCeilingDb} dB`
            : `ВЫКЛ`;
        badge.style.color = cfg.opt_masterCeil ? '#3fb950' : '#8b949e';
    }
    if (typeof window.updateTopSearchOrMonitorBar === 'function') {
        window.updateTopSearchOrMonitorBar();
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
            // Окно плавного затухания Хэннинга на конце хвоста, чтобы обрыв буфера никогда не гудел и не пищал!
            let tailWindow = 0.5 * (1 + Math.cos(Math.PI * i / length));
            if (i === 0) {
                data[i] = 1.0;
            } else if (cfg.phaseFixEnabled) {
                data[i] = Math.exp(-i / (length / 2.5)) * tailWindow * 0.055 * lengthNorm * Math.cos(i * 0.65) * (channel === 0 ? 1 : -1);
            } else if (cfg.opt_cleanFir) {
                let a = Math.exp(-i / (length / 6.0));
                let b = Math.exp(-i / (length / 2.1));
                data[i] = (a - 0.46 * b) * tailWindow * 0.08 * lengthNorm * cleanLinear;
            } else {
                data[i] = Math.exp(-i / (length / 3)) * tailWindow * 0.05 * lengthNorm;
            }
        }
    }
    return impulse;
};

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

    if (cfg.opt_autoRms) {
        let buf = sourceBuf || window.studioBuffer;
        let fullGain = buf ? window.computeBufferAutoGain(buf, cfg.val_autoRms) : window.dbToLinear((parseFloat(cfg.val_autoRms) || -10) + 10);
        let preGain = reg(ctx.createGain());
        preGain.gain.value = Math.pow(fullGain, 0.65);
        cur.connect(preGain);
        cur = preGain;
    }

    if (cfg.opt_monoBass) {
        let monoHz = parseFloat(cfg.val_monoBass);
        if (isNaN(monoHz)) monoHz = 120;
        // Если включена Стерео-Ширина > 120%, не даём Моно-Саббасу зажимать мид-бас выше 85 Гц, чтобы в Barracuda X раскрылся объём!
        if (cfg.opt_msWidth && (parseFloat(cfg.val_msWidth) || 150) > 120 && monoHz > 95 && monoHz <= 200) {
            monoHz = 80;
        }
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

// Стадия 2 (ПОСЛЕ компрессоров): All-Pass 3D Стерео для закрытых наушников + Anti-Whine Gate
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

    if (cfg.opt_autoRms) {
        let buf = sourceBuf || window.studioBuffer;
        let fullGain = buf ? window.computeBufferAutoGain(buf, cfg.val_autoRms) : window.dbToLinear((parseFloat(cfg.val_autoRms) || -10) + 10);
        let postRms = reg(ctx.createGain());
        postRms.gain.value = Math.pow(fullGain, 0.35);
        cur.connect(postRms);
        cur = postRms;
    }

    if (cfg.opt_punch) {
        let punchDb = parseFloat(cfg.val_punch);
        if (isNaN(punchDb)) punchDb = 6.0;
        let clampedPunch = Math.max(-24, Math.min(24, punchDb));

        // 1. Хлёсткий удар мид-баса (85 Гц)
        let kickBody = reg(ctx.createBiquadFilter());
        kickBody.type = 'peaking';
        kickBody.frequency.value = 85;
        kickBody.Q.value = 1.4;
        kickBody.gain.value = clampedPunch * 0.75;

        // 2. Анти-муть (230 Гц): при +Панче слегка расчищает коробочный гул, чтобы удар и середина стреляли чётко
        let mudCut = reg(ctx.createBiquadFilter());
        mudCut.type = 'peaking';
        mudCut.frequency.value = 230;
        mudCut.Q.value = 1.1;
        mudCut.gain.value = -clampedPunch * 0.35;

        // 3. Хлыст атаки и середины (2600 Гц — 100% отдача при + и уход в глубокий фон при -)
        let snareSnap = reg(ctx.createBiquadFilter());
        snareSnap.type = 'peaking';
        snareSnap.frequency.value = 2600;
        snareSnap.Q.value = 1.0;
        snareSnap.gain.value = clampedPunch * 0.95;

        cur.connect(kickBody);
        kickBody.connect(mudCut);
        mudCut.connect(snareSnap);
        cur = snareSnap;
    }

    // 🎭 Стерео-Ширина (%) — Специальная 3D All-Pass + Side-Exciter матрица под закрытые 50-мм чашки Razer Barracuda X!
    if (cfg.opt_msWidth) {
        let pct = parseFloat(cfg.val_msWidth);
        if (isNaN(pct)) pct = 160;
        let w = Math.max(0, Math.min(500, pct)) / 100.0;

        let sp = reg(ctx.createChannelSplitter(2));
        let mg = reg(ctx.createChannelMerger(2));

        // Центр (Mid) держит плотный удар бочки и вокала
        let midScale = (w <= 1.0) ? 1.0 : Math.max(0.72, 1.0 - (w - 1.0) * 0.12);
        let mL = monoGain(0.5 * midScale);
        let mR = monoGain(0.5 * midScale);

        // Боковой канал (Side = L - R) проходит через 2-полосный эксайтер (Объём 135 Гц + Бриллиантовый воздух 9500 Гц!)
        let sideScale = (w <= 1.0) ? w : (1.0 + (w - 1.0) * 0.85);
        let sL = monoGain(0.5 * sideScale);
        let sR = monoGain(-0.5 * sideScale);
        let sBus = monoGain(1.0);

        cur.connect(sp);
        sp.connect(mL, 0); sp.connect(mR, 1);
        sp.connect(sL, 0); sp.connect(sR, 1);
        sL.connect(sBus); sR.connect(sBus);

        let sideFinal = sBus;
        if (w > 1.0) {
            let boostDb = Math.min(10, (w - 1.0) * 4.5);
            // Накачиваем боковой объём мид-баса (135 Гц) и кристальный воздух (9000 Гц) по краям чашек наушников!
            let sideWarmth = reg(ctx.createBiquadFilter());
            sideWarmth.channelCount = 1; sideWarmth.channelCountMode = 'explicit';
            sideWarmth.type = 'peaking'; sideWarmth.frequency.value = 135; sideWarmth.Q.value = 0.9;
            sideWarmth.gain.value = boostDb * 0.8;

            let sideAir = reg(ctx.createBiquadFilter());
            sideAir.channelCount = 1; sideAir.channelCountMode = 'explicit';
            sideAir.type = 'highshelf'; sideAir.frequency.value = 8500;
            sideAir.gain.value = boostDb * 1.1;

            sBus.connect(sideWarmth);
            sideWarmth.connect(sideAir);
            sideFinal = sideAir;
        }

        let sInv = monoGain(-1.0);
        sideFinal.connect(sInv);

        mL.connect(mg, 0, 0); mR.connect(mg, 0, 0); sideFinal.connect(mg, 0, 0);
        mL.connect(mg, 0, 1); mR.connect(mg, 0, 1); sInv.connect(mg, 0, 1);

        // Фазовый 90° All-Pass декореллятор (создаёт широкую голографическую сцену БЕЗ эха даже на моно-дорожках!)
        if (w > 1.0) {
            let apGain = Math.min(0.48, (w - 1.0) * 0.24);
            let hpAp = reg(ctx.createBiquadFilter());
            hpAp.channelCount = 1; hpAp.channelCountMode = 'explicit';
            hpAp.type = 'highpass'; hpAp.frequency.value = 140;

            let ap1 = reg(ctx.createBiquadFilter());
            ap1.channelCount = 1; ap1.channelCountMode = 'explicit';
            ap1.type = 'allpass'; ap1.frequency.value = 380; ap1.Q.value = 0.7;

            let ap2 = reg(ctx.createBiquadFilter());
            ap2.channelCount = 1; ap2.channelCountMode = 'explicit';
            ap2.type = 'allpass'; ap2.frequency.value = 1950; ap2.Q.value = 0.7;

            let gApL = monoGain(apGain);
            let gApR = monoGain(-apGain);

            mL.connect(hpAp); mR.connect(hpAp);
            hpAp.connect(ap1); ap1.connect(ap2);
            ap2.connect(gApL); ap2.connect(gApR);
            gApL.connect(mg, 0, 0);
            gApR.connect(mg, 0, 1);
        }

        let out = reg(ctx.createGain());
        out.gain.value = 1.0 / (1.0 + Math.max(0, w - 1.0) * 0.25);
        mg.connect(out);
        cur = out;
    }

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

    let padDb = window.calculateAutoMasterPadDb(cfg);

    // Фильтр отсечки постоянного тока (DC Blocker 18 Гц), чтобы ни один узел никогда не смещал мембрану и не пищал!
    let dcBlocker = reg(ctx.createBiquadFilter());
    dcBlocker.type = 'highpass';
    dcBlocker.frequency.value = 18;
    dcBlocker.Q.value = 0.707;
    cur.connect(dcBlocker);
    cur = dcBlocker;

    if (cfg.opt_masterCeil || cfg.phaseFixEnabled) {
        let autoPad = reg(ctx.createGain());
        autoPad.gain.value = window.dbToLinear(padDb);
        let softClipper = window.createSoftClipWaveShaper(ctx, bucket);
        cur.connect(autoPad);
        autoPad.connect(softClipper);
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
        window.masterAntiClickGain = window.audioCtx.createGain();
        window.masterAntiClickGain.gain.value = 1.0;
        window.masterAntiClickGain.connect(window.audioCtx.destination);

        // Авто-блокировка писка дросселей, когда плеер стоит на паузе!
        if (player) {
            player.addEventListener('pause', () => {
                if (window.inputMixer && window.audioCtx) {
                    window.inputMixer.gain.setTargetAtTime(0.0, window.audioCtx.currentTime, 0.015);
                }
            });
            player.addEventListener('play', () => {
                if (window.inputMixer && window.audioCtx) {
                    window.inputMixer.gain.setTargetAtTime(1.0, window.audioCtx.currentTime, 0.015);
                }
            });
            player.addEventListener('ended', () => {
                if (window.inputMixer && window.audioCtx) {
                    window.inputMixer.gain.setTargetAtTime(0.0, window.audioCtx.currentTime, 0.015);
                }
            });
        }
    }
    if (window.audioCtx.state === 'suspended') { window.audioCtx.resume(); }
    window.buildAudioGraph(); 
};

window.buildAudioGraph = function(immediate) {
    if (!window.audioCtx) return;
    if (!immediate && window.masterAntiClickGain) {
        if (window._graphRebuildTimer) clearTimeout(window._graphRebuildTimer);
        let now = window.audioCtx.currentTime;
        window.masterAntiClickGain.gain.cancelScheduledValues(now);
        window.masterAntiClickGain.gain.setValueAtTime(window.masterAntiClickGain.gain.value, now);
        window.masterAntiClickGain.gain.linearRampToValueAtTime(0.0001, now + 0.007);
        window._graphRebuildTimer = setTimeout(() => {
            window._buildAudioGraphCore();
            if (window.audioCtx && window.masterAntiClickGain) {
                let t2 = window.audioCtx.currentTime;
                window.masterAntiClickGain.gain.cancelScheduledValues(t2);
                window.masterAntiClickGain.gain.setValueAtTime(0.0001, t2);
                window.masterAntiClickGain.gain.linearRampToValueAtTime(1.0, t2 + 0.012);
            }
        }, 8);
        return;
    }
    window._buildAudioGraphCore();
};

window._buildAudioGraphCore = function() {
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
    const player = document.getElementById('audioPlayer');
    window.inputMixer.gain.value = 1.0;
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
            let highFreq = Math.max(lowFreq + 200, cfg.multiBandSettings.high || 3600);
            // Фокусируем центр СЧ-полосы строго в зоне живого голоса (не ниже 320 Гц по нижнему краю), чтобы басовый гул 50-150 Гц не лез в шёпот!
            let vocalLowAnchor = Math.max(lowFreq, 320);
            let midCenter = Math.sqrt(vocalLowAnchor * highFreq);
            let midQ = Math.max(0.85, midCenter / (highFreq - vocalLowAnchor));

            let now = window.audioCtx.currentTime;
            window.splitLow.frequency.setTargetAtTime(lowFreq, now, 0.012);
            window.splitMid.frequency.setTargetAtTime(midCenter, now, 0.012);
            window.splitHigh.frequency.setTargetAtTime(highFreq, now, 0.012);

            // Басовая полоса: мощный клубный кач по настройкам пользователя
            window.compLow.threshold.value = thresh; window.compLow.knee.value = knee; window.compLow.ratio.value = ratio;
            window.compLow.attack.value = Math.max(0.015, (cfg.limiterSettings.attack || 26) / 1000);
            window.compLow.release.value = Math.max(0.04, (cfg.limiterSettings.release || 60) / 1000);

            // Вокальная полоса (compMid): мягкая студийная динамика без 2-мс шинкования волны (убивает хрип на шёпоте поверх баса!)
            window.compMid.threshold.value = Math.min(-6, thresh + 7);
            window.compMid.knee.value = Math.max(12, knee);
            window.compMid.ratio.value = Math.min(3.5, Math.max(1.5, ratio * 0.25));
            window.compMid.attack.value = Math.max(0.025, (cfg.limiterSettings.attack || 26) / 1000);
            window.compMid.release.value = 0.16;

            window.compHigh.threshold.value = thresh + 4; window.compHigh.knee.value = knee; window.compHigh.ratio.value = Math.min(6.0, ratio);
            window.compHigh.attack.value = 0.008; window.compHigh.release.value = 0.08;

            currentNode.connect(window.splitLow); currentNode.connect(window.splitMid); currentNode.connect(window.splitHigh);
            window.splitLow.connect(window.compLow); window.splitMid.connect(window.compMid); window.splitHigh.connect(window.compHigh);

            let postBus = window.trackNode(window.audioCtx.createGain(), window.activeDynamicNodes);

            if (cfg.phaseFixEnabled) {
                window.splitMid.Q.setTargetAtTime(Math.max(0.25, midQ * 0.65), now, 0.012);
                window.midPhaseNode.gain.value = -1.22;
                window.compLow.connect(postBus);
                window.compMid.connect(window.midPhaseNode);
                window.midPhaseNode.connect(postBus);
                window.compHigh.connect(postBus);
            } else {
                let widthPct = parseFloat(cfg.val_midQ); if (isNaN(widthPct) || widthPct < 25) widthPct = 150;
                let targetQ = cfg.opt_midQ ? Math.max(0.65, Math.min(2.5, midQ / (widthPct / 100.0))) : midQ;
                window.splitMid.Q.setTargetAtTime(targetQ, now, 0.012);

                let midDb = parseFloat(cfg.val_midPhase); if (isNaN(midDb)) midDb = 1.5;
                window.midPhaseNode.gain.value = cfg.opt_midPhase ? window.dbToLinear(Math.max(-15, Math.min(15, midDb))) : 1.0;

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
            finalPost.connect(window.masterAntiClickGain || window.audioCtx.destination);
        } else {
            window.compressorNode.threshold.value = thresh;
            window.compressorNode.knee.value = knee;
            window.compressorNode.ratio.value = ratio;
            window.compressorNode.attack.value = cfg.limiterSettings.attack / 1000; 
            window.compressorNode.release.value = cfg.limiterSettings.release / 1000;
            
            currentNode.connect(window.compressorNode);
            let postOut = window.insertProStudioPostChain(window.audioCtx, window.compressorNode, cfg, window.activeDynamicNodes);
            postOut.connect(window.masterAntiClickGain || window.audioCtx.destination);
        }
    } else {
        let postOut = window.insertProStudioPostChain(window.audioCtx, currentNode, cfg, window.activeDynamicNodes);
        postOut.connect(window.masterAntiClickGain || window.audioCtx.destination);
    }
};
