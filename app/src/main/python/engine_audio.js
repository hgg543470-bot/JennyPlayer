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
            else if (window.appConfig && window.appConfig.phaseFixEnabled) {
                data[i] = Math.exp(-i / (length / 2.5)) * 0.035 * Math.cos(i * 0.65) * (channel === 0 ? 1 : -1);
            } else data[i] = (window.appConfig && window.appConfig.opt_cleanFir) ? ((Math.exp(-i / (length / 6)) - 0.45 * Math.exp(-i / (length / 2.2))) * 0.03) : (Math.exp(-i / (length/3)) * 0.05); 
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
        window.midPhaseNode = window.audioCtx.createGain();
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
    try { window.compLow.disconnect(); window.compMid.disconnect(); window.compHigh.disconnect(); window.midPhaseNode.disconnect(); window.masterSafeComp.disconnect(); } catch(e){}
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
            
            if (window.appConfig.phaseFixEnabled) {
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
                window.compLow.connect(window.audioCtx.destination);
                window.compMid.connect(window.audioCtx.destination);
                window.compHigh.connect(window.audioCtx.destination);
            }
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


window.togglePhaseFix = function(el) {
    window.appConfig = window.appConfig || {};
    window.appConfig.phaseFixEnabled = Boolean(el.checked);
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.buildAudioGraph === 'function') window.buildAudioGraph();
};
document.addEventListener("DOMContentLoaded", () => {
    const eqM = document.getElementById('eqModal');
    if (eqM && !document.getElementById('cfg_phaseFix')) {
        const box = document.createElement('div');
        box.style.cssText = "background:#0d1117;border:1px solid #7341be;border-radius:10px;padding:10px 12px;margin:8px 0 12px 0;display:flex;align-items:center;justify-content:space-between;box-shadow:0 0 10px rgba(115,65,190,0.25);";
        const isOn = Boolean(window.appConfig && window.appConfig.phaseFixEnabled);
        box.innerHTML = `<label style="display:flex;align-items:center;gap:10px;color:#e6edf3;font-size:13px;font-weight:bold;cursor:pointer;width:100%;"><input type="checkbox" id="cfg_phaseFix" ${isOn ? 'checked' : ''} onchange="window.togglePhaseFix(this)" style="width:18px;height:18px;accent-color:#7341be;"><span>🎯 Фазовый фокус (Выравнивание вокала и баса)</span></label>`;
        eqM.insertBefore(box, eqM.firstChild);
    }
});


window.toggleDspOpt = function(key, el) {
    window.appConfig = window.appConfig || {};
    window.appConfig[key] = Boolean(el.checked);
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.buildAudioGraph === 'function') window.buildAudioGraph();
};
document.addEventListener("DOMContentLoaded", () => {
    const eqM = document.getElementById('eqModal');
    if (eqM && !document.getElementById('dspModularBox')) {
        const cfg = window.appConfig || {};
        const opts = [
            ['opt_midPhase', '🎯 Инверсия фазы СЧ (Вытащить вокал из баса)'],
            ['opt_midQ', '📐 Широкий купол СЧ (Мягкий стык частот)'],
            ['opt_deEsser', '🐍 Де-эссер ВЧ (Убрать свист шипящих С/Ш)'],
            ['opt_cleanFir', '✨ Чистый FIR-импульс (Убрать гул из хвоста)'],
            ['opt_masterCeil', '🛡️ Мастер-потолок -1 dB (Защита склейки 3 полос)']
        ];
        const box = document.createElement('div');
        box.id = 'dspModularBox';
        box.style.cssText = "background:#0d1117;border:1px solid #7341be;border-radius:10px;padding:10px 12px;margin:8px 0 12px 0;display:flex;flex-direction:column;gap:8px;box-shadow:0 0 10px rgba(115,65,190,0.22);";
        box.innerHTML = `<div style="color:#b392f0;font-size:11px;font-weight:bold;letter-spacing:0.8px;">🧪 ТОНКАЯ НАСТРОЙКА ТРАКТА (ОПЦИИ)</div>` +
            opts.map(([k, lbl]) => `<label style="display:flex;align-items:center;gap:10px;color:#e6edf3;font-size:12.5px;cursor:pointer;"><input type="checkbox" ${cfg[k] ? 'checked' : ''} onchange="window.toggleDspOpt('${k}', this)" style="width:17px;height:17px;accent-color:#7341be;flex-shrink:0;"><span>${lbl}</span></label>`).join('');
        eqM.insertBefore(box, eqM.firstChild);
    }
});
