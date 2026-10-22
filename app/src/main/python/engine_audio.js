// =========================================================================
// 🎵 ENGINE_AUDIO.JS (ЗВУКОВОЙ ГРАФ, ЭФФЕКТЫ, ЛИМИТЕР И ФИКС ХРИПА)
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

window.studioBuffer = null;
window.studioSourceNode = null;
window.isStudioPlaying = false;

window.appConfig = JSON.parse(localStorage.getItem('ytm_config')) || {};

window.createFIRImpulse = function(context, decayMs) {
    let sampleRate = context.sampleRate;
    let length = Math.floor(sampleRate * (decayMs / 1000));
    if(length === 0) length = 1;
    let impulse = context.createBuffer(2, length, sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        let data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            if (i === 0) data[i] = 1.0; 
            else data[i] = Math.exp(-i / (length/3)) * 0.05; 
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
    Object.values(window.eqNodes).forEach(node => { try { node.disconnect(); } catch(e){} });

    let currentNode = window.inputMixer;
    currentNode.connect(window.preAmpNode);
    currentNode = window.preAmpNode;

    if (window.appConfig.firEnabled) {
        window.firNode.buffer = window.createFIRImpulse(window.audioCtx, window.appConfig.firSettings.decay);
        window.firGainNode.gain.value = window.appConfig.firSettings.gain;
        currentNode.connect(window.preFirPad);
        window.preFirPad.connect(window.firNode);
        window.firNode.connect(window.firGainNode);
        currentNode = window.firGainNode;
    }

    if (window.appConfig.eqEnabled) {
        currentNode.connect(window.eqNodes.band60);
        window.eqNodes.band60.connect(window.eqNodes.band230);
        window.eqNodes.band230.connect(window.eqNodes.band910);
        window.eqNodes.band910.connect(window.eqNodes.band3600);
        window.eqNodes.band3600.connect(window.eqNodes.band14000);
        currentNode = window.eqNodes.band14000;
    }

    currentNode.connect(window.gainNode);
    currentNode = window.gainNode;

    if (window.appConfig.limiterEnabled) {
        let thresh = window.appConfig.limiterSettings.threshold;
        let knee = window.appConfig.limiterSettings.knee;
        let ratio = window.appConfig.limiterSettings.ratio;

        if (window.appConfig.multiBandEnabled) {
            let lowFreq = Math.max(20, window.appConfig.multiBandSettings.low || 200);
            let highFreq = Math.max(lowFreq + 100, window.appConfig.multiBandSettings.high || 2500);
            let midCenter = Math.sqrt(lowFreq * highFreq);
            let midQ = midCenter / (highFreq - lowFreq);

            window.splitLow.frequency.value = lowFreq;
            window.splitMid.frequency.value = midCenter;
            window.splitMid.Q.value = midQ;
            window.splitHigh.frequency.value = highFreq;

            window.compLow.threshold.value = thresh; window.compLow.knee.value = knee; window.compLow.ratio.value = ratio;
            window.compLow.attack.value = window.appConfig.limiterSettings.attack / 1000; 
            window.compLow.release.value = window.appConfig.limiterSettings.release / 1000;

            window.compMid.threshold.value = thresh + 2; window.compMid.knee.value = knee; window.compMid.ratio.value = ratio;
            window.compMid.attack.value = 0.002; window.compMid.release.value = 0.1;

            window.compHigh.threshold.value = thresh + 4; window.compHigh.knee.value = knee; window.compHigh.ratio.value = ratio;
            window.compHigh.attack.value = 0.001; window.compHigh.release.value = 0.05;

            currentNode.connect(window.splitLow); currentNode.connect(window.splitMid); currentNode.connect(window.splitHigh);
            window.splitLow.connect(window.compLow); window.splitMid.connect(window.compMid); window.splitHigh.connect(window.compHigh);
            
            window.compLow.connect(window.audioCtx.destination);
            window.compMid.connect(window.audioCtx.destination);
            window.compHigh.connect(window.audioCtx.destination);
        } else {
            window.compressorNode.threshold.value = thresh;
            window.compressorNode.knee.value = knee;
            window.compressorNode.ratio.value = ratio;
            window.compressorNode.attack.value = window.appConfig.limiterSettings.attack / 1000; 
            window.compressorNode.release.value = window.appConfig.limiterSettings.release / 1000;
            
            currentNode.connect(window.compressorNode);
            window.compressorNode.connect(window.audioCtx.destination);
        }
    } else {
        currentNode.connect(window.audioCtx.destination);
    }
};
