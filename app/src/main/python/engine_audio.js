// =========================================================================
// 🎵 ENGINE_AUDIO.JS (ЗВУКОВОЙ ГРАФ, 5 МОДУЛЕЙ ТРАКТА И ФАЗОВЫЙ ФОКУС)
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

window.studioBuffer = null;
window.studioSourceNode = null;
window.isStudioPlaying = false;

window.appConfig = JSON.parse(localStorage.getItem('ytm_config')) || {};

window.DSP_MOD_DEFAULTS = {
    opt_midPhase: false, val_midPhase: 1.15,
    opt_midQ: false,     val_midQ: 0.65,
    opt_deEsser: false,  val_deEsser: 0.66,
    opt_cleanFir: false, val_cleanFir: 0.03,
    opt_masterCeil: false, val_masterCeil: -1.0
};

window.createFIRImpulse = function(context, decayMs) {
    let sampleRate = context.sampleRate;
    let length = Math.floor(sampleRate * (decayMs / 1000));
    if (length === 0) length = 1;
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

        window.firNode = window.audioCtx.createConvolver();
        window.firNode.normalize = false; 
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
    
    try { window.inputMixer.disconnect(); } catch(e){}
    try { window.preAmpNode.disconnect(); } catch(e){}
    try { window.preFirPad.disconnect(); window.firNode.disconnect(); window.firGainNode.disconnect(); } catch(e){}
    try { window.gainNode.disconnect(); } catch(e){}
    try { window.compressorNode.disconnect(); } catch(e){}
    try { window.splitLow.disconnect(); window.splitMid.disconnect(); window.splitHigh.disconnect(); } catch(e){}
    try { window.compLow.disconnect(); window.compMid.disconnect(); window.compHigh.disconnect(); } catch(e){}
    try { window.midPhaseNode.disconnect(); window.deEssGain.disconnect(); window.masterSafeComp.disconnect(); } catch(e){}
    Object.values(window.eqNodes).forEach(node => { try { node.disconnect(); } catch(e){} });

    const cfg = window.appConfig || {};
    let currentNode = window.inputMixer;
    currentNode.connect(window.preAmpNode);
    currentNode = window.preAmpNode;

    if (cfg.firEnabled && cfg.firSettings) {
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
