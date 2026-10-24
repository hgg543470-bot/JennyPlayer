// =========================================================================
// 🎵 ENGINE_AUDIO.JS (СТУДИЙНЫЙ ГРАФ БЕЗ УТЕЧЕК УЗЛОВ И СБОЕВ НА ЛЕТУ)
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

// Реестр всех динамических узлов для 100% зачистки при переключении на лету
window.activeDynamicNodes = [];

window.studioBuffer = null;
window.studioSourceNode = null;
window.isStudioPlaying = false;
window.currentTrackAutoGain = 1.0;

window.appConfig = JSON.parse(localStorage.getItem('ytm_config')) || {};

window.DSP_MOD_DEFAULTS = {
    opt_midPhase: false,   val_midPhase: 1.15,
    opt_midQ: false,       val_midQ: 0.65,
    opt_deEsser: false,    val_deEsser: 0.66,
    opt_cleanFir: false,   val_cleanFir: 0.03,
    opt_masterCeil: false, val_masterCeil: -1.0,
    opt_autoRms: false,    val_autoRms: -11.0,
    opt_monoBass: false,   val_monoBass: 120,
    opt_msWidth: false,    val_msWidth: 1.35,
    opt_punch: false,      val_punch: 4.5,
    opt_crossfeed: false,  val_crossfeed: 0.28
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
    if (rms < 0.0005) return 1.0;
    let currentDb = 20 * Math.log10(rms);
    let tDb = isNaN(parseFloat(targetDb)) ? -11.0 : parseFloat(targetDb);
    let diffDb = Math.max(-12.0, Math.min(12.0, tDb - currentDb));
    return Math.pow(10, diffDb / 20);
};

window.createFIRImpulse = function(context, decayMs) {
    let sampleRate = context.sampleRate;
    let length = Math.max(1, Math.floor(sampleRate * ((decayMs || 2) / 1000)));
    let impulse = context.createBuffer(2, length, sampleRate);
    const cfg = window.appConfig || {};
    let firAmp = parseFloat(cfg.val_cleanFir);
    if (isNaN(firAmp)) firAmp = 0.03;

    for (let channel = 0; channel < 2; channel++) {
        let data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            if (i === 0) {
                data[i] = 1.0;
            } else if (cfg.phaseFixEnabled) {
                data[i] = Math.exp(-i / (length / 2.5)) * 0.035 * Math.cos(i * 0.65) * (channel === 0 ? 1 : -1);
            } else if (cfg.opt_cleanFir) {
                data[i] = (Math.exp(-i / (length / 6)) - 0.45 * Math.exp(-i / (length / 2.2))) * firAmp;
            } else {
                data[i] = Math.exp(-i / (length / 3)) * 0.05;
            }
        }
    }
    return impulse;
};

// Студийная цепочка PRO Studio (фазокогерентная, с регистрацией всех узлов для чистого disconnect)
window.insertProStudioChain = function(ctx, inputNode, cfg, bucket) {
    let cur = inputNode;
    const reg = (n) => window.trackNode(n, bucket);

    // 1. 🥁 Панч-Хлыст Атаки (Удар бочки 95 Гц + Щелчок атаки 3100 Гц)
    if (cfg.opt_punch) {
        let punchDb = parseFloat(cfg.val_punch);
        if (isNaN(punchDb)) punchDb = 4.5;
        punchDb = Math.max(0, Math.min(15, punchDb));

        let kickSnap = reg(ctx.createBiquadFilter());
        kickSnap.type = 'peaking';
        kickSnap.frequency.value = 95;
        kickSnap.Q.value = 1.8;
        kickSnap.gain.value = punchDb * 0.9;

        let transientSnap = reg(ctx.createBiquadFilter());
        transientSnap.type = 'peaking';
        transientSnap.frequency.value = 3100;
        transientSnap.Q.value = 1.4;
        transientSnap.gain.value = punchDb * 0.85;

        let punchComp = reg(ctx.createDynamicsCompressor());
        punchComp.threshold.value = -20;
        punchComp.knee.value = 6;
        punchComp.ratio.value = 4.0;
        punchComp.attack.value = 0.035;
        punchComp.release.value = 0.060;

        cur.connect(kickSnap);
        kickSnap.connect(transientSnap);
        transientSnap.connect(punchComp);
        cur = punchComp;
    }

    // 2. 🧲 Моно-Саббас + 3. 🎭 Стерео-Ширина Side (Единая фазокогерентная Mid/Side матрица без фазовых ям!)
    if (cfg.opt_monoBass || cfg.opt_msWidth) {
        let width = cfg.opt_msWidth ? parseFloat(cfg.val_msWidth) : 1.0;
        if (isNaN(width)) width = 1.35;
        width = Math.max(0.0, Math.min(3.0, width));

        let sp = reg(ctx.createChannelSplitter(2));
        let mg = reg(ctx.createChannelMerger(2));

        // Mid = 0.5 * (L + R) — проходит с идеальной фазой 0°!
        let midSum = reg(ctx.createGain()); midSum.gain.value = 0.5;

        // Side = 0.5 * (L - R) * width
        let sideL = reg(ctx.createGain()); sideL.gain.value = 0.5 * width;
        let sideR = reg(ctx.createGain()); sideR.gain.value = -0.5 * width;
        let sideBus = reg(ctx.createGain());

        cur.connect(sp);
        sp.connect(midSum, 0);
        sp.connect(midSum, 1);

        sp.connect(sideL, 0); sideL.connect(sideBus);
        sp.connect(sideR, 1); sideR.connect(sideBus);

        let sideProcessed = sideBus;
        if (cfg.opt_monoBass) {
            let monoHz = parseFloat(cfg.val_monoBass);
            if (isNaN(monoHz)) monoHz = 120;
            monoHz = Math.max(30, Math.min(400, monoHz));
            // Срезаем саб-бас ТОЛЬКО из боковой разницы Side, оставляя центральный бас нетронутым!
            let sideHp = reg(ctx.createBiquadFilter());
            sideHp.type = 'highpass';
            sideHp.frequency.value = monoHz;
            sideHp.Q.value = 0.707;
            sideBus.connect(sideHp);
            sideProcessed = sideHp;
        }

        // Сборка обратно: L_out = Mid + Side, R_out = Mid - Side
        let sideInv = reg(ctx.createGain()); sideInv.gain.value = -1.0;
        sideProcessed.connect(sideInv);

        midSum.connect(mg, 0, 0);
        sideProcessed.connect(mg, 0, 0);

        midSum.connect(mg, 0, 1);
        sideInv.connect(mg, 0, 1);

        let msOut = reg(ctx.createGain());
        mg.connect(msOut);
        cur = msOut;
    }

    // 4. 🎧 Бинауральный кроссфид «Колонки в комнате»
    if (cfg.opt_crossfeed) {
        let delayMs = parseFloat(cfg.val_crossfeed);
        if (isNaN(delayMs)) delayMs = 0.28;
        delayMs = Math.max(0.05, Math.min(2.0, delayMs));

        let sp = reg(ctx.createChannelSplitter(2));
        let mg = reg(ctx.createChannelMerger(2));

        let dL = reg(ctx.createDelay(0.02)); dL.delayTime.value = delayMs / 1000;
        let dR = reg(ctx.createDelay(0.02)); dR.delayTime.value = delayMs / 1000;

        let lpL = reg(ctx.createBiquadFilter()); lpL.type = 'lowpass'; lpL.frequency.value = 750;
        let lpR = reg(ctx.createBiquadFilter()); lpR.type = 'lowpass'; lpR.frequency.value = 750;

        let xL = reg(ctx.createGain()); xL.gain.value = 0.26;
        let xR = reg(ctx.createGain()); xR.gain.value = 0.26;
        let dirL = reg(ctx.createGain()); dirL.gain.value = 0.86;
        let dirR = reg(ctx.createGain()); dirR.gain.value = 0.86;

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

    // 1. Полная зачистка всех динамических узлов с прошлого цикла
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

    // Авто-RMS выравнивание входа по RAM-буферу (работает на лету при смене цифры!)
    if (cfg.opt_autoRms && window.studioBuffer) {
        window.currentTrackAutoGain = window.computeBufferAutoGain(window.studioBuffer, cfg.val_autoRms);
        window.preAmpNode.gain.value = 0.6 * window.currentTrackAutoGain;
    } else {
        window.preAmpNode.gain.value = 0.6;
    }

    let currentNode = window.inputMixer;
    currentNode.connect(window.preAmpNode);
    currentNode = window.preAmpNode;

    // Создаём свежий ConvolverNode при каждом изменении FIR, чтобы не залипал старый FFT-буфер
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

    // Вставляем цепочку PRO Studio с регистрацией всех узлов в window.activeDynamicNodes
    currentNode = window.insertProStudioChain(window.audioCtx, currentNode, cfg, window.activeDynamicNodes);

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
                window.splitMid.Q.value = Math.max(0.35, midQ * 0.65);
                window.midPhaseNode.gain.value = -1.22;
                window.masterSafeComp.threshold.value = -1.0;
                window.masterSafeComp.knee.value = 4.0;
                window.masterSafeComp.ratio.value = 18.0;
                window.masterSafeComp.attack.value = 0.001;
                window.masterSafeComp.release.value = 0.04;
                window.compLow.connect(window.masterSafeComp);
                window.compMid.connect(window.midPhaseNode);
                window.midPhaseNode.connect(window.masterSafeComp);
                window.compHigh.connect(window.masterSafeComp);
                window.masterSafeComp.connect(window.audioCtx.destination);
            } else {
                let qMult = parseFloat(cfg.val_midQ); if (isNaN(qMult)) qMult = 0.65;
                let phGain = parseFloat(cfg.val_midPhase); if (isNaN(phGain)) phGain = 1.15;
                let deEssVal = parseFloat(cfg.val_deEsser); if (isNaN(deEssVal)) deEssVal = 0.66;
                let ceilDb = parseFloat(cfg.val_masterCeil); if (isNaN(ceilDb)) ceilDb = -1.0;

                if (cfg.opt_midQ) window.splitMid.Q.value = Math.max(0.2, midQ * qMult);
                window.midPhaseNode.gain.value = cfg.opt_midPhase ? -Math.abs(phGain) : 1.0;

                if (cfg.opt_deEsser) {
                    window.compHigh.threshold.value = Math.min(-6, thresh + 10);
                    window.compHigh.ratio.value = Math.min(4.0, ratio);
                    window.compHigh.attack.value = 0.0005;
                    window.compHigh.release.value = 0.09;
                    window.deEssGain.gain.value = Math.max(0.1, Math.min(1.5, deEssVal));
                } else {
                    window.deEssGain.gain.value = 1.0;
                }

                let outTarget = window.audioCtx.destination;
                if (cfg.opt_masterCeil) {
                    window.masterSafeComp.threshold.value = Math.max(-24.0, Math.min(0.0, ceilDb));
                    window.masterSafeComp.knee.value = 4.0;
                    window.masterSafeComp.ratio.value = 18.0;
                    window.masterSafeComp.attack.value = 0.001;
                    window.masterSafeComp.release.value = 0.04;
                    window.masterSafeComp.connect(window.audioCtx.destination);
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
            window.compressorNode.connect(window.audioCtx.destination);
        }
    } else {
        currentNode.connect(window.audioCtx.destination);
    }
};
