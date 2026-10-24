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


window.DSP_MOD_DEFAULTS = {
    opt_midPhase: false, val_midPhase: 1.15,
    opt_midQ: false,     val_midQ: 0.65,
    opt_deEsser: false,  val_deEsser: 0.66,
    opt_cleanFir: false, val_cleanFir: 0.03,
    opt_masterCeil: false, val_masterCeil: -1.0
};

window.syncDspModUI = function() {
    const cfg = window.appConfig || {};
    const pfEl = document.getElementById('cfg_phaseFix');
    if (pfEl) pfEl.checked = Boolean(cfg.phaseFixEnabled);

    ['midPhase', 'midQ', 'deEsser', 'cleanFir', 'masterCeil'].forEach(k => {
        const chk = document.getElementById('cfg_opt_' + k);
        const inp = document.getElementById('cfg_val_' + k);
        if (chk) chk.checked = Boolean(cfg['opt_' + k]);
        if (inp) {
            let v = cfg['val_' + k];
            inp.value = (v !== undefined && v !== null && v !== '') ? v : window.DSP_MOD_DEFAULTS['val_' + k];
        }
    });

    const wrap = document.getElementById('dspModBodyWrap');
    const shield = document.getElementById('dspModLockShield');
    if (wrap && shield) {
        if (cfg.phaseFixEnabled) {
            wrap.style.opacity = '0.32';
            wrap.style.filter = 'grayscale(100%)';
            shield.style.display = 'block';
        } else {
            wrap.style.opacity = '1';
            wrap.style.filter = 'none';
            shield.style.display = 'none';
        }
    }
};

window.onPhaseFocusChange = function(el, ev) {
    window.appConfig = window.appConfig || {};
    window.appConfig.phaseFixEnabled = Boolean(el.checked);
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.syncDspModUI();
    if (typeof window.buildAudioGraph === 'function') window.buildAudioGraph();
    try { navigator.vibrate(40); } catch(e){}
    if (el.checked && typeof window.showToast === 'function') {
        window.showToast("🔒 Блок управления отключён! Для ручной настройки выключите «Фазовый фокус»", ev);
    } else if (!el.checked && typeof window.showToast === 'function') {
        window.showToast("🔓 Ручной блок тонкой настройки активен!", ev);
    }
};

window.onDspModChange = function(key) {
    window.appConfig = window.appConfig || {};
    const chk = document.getElementById('cfg_opt_' + key);
    const inp = document.getElementById('cfg_val_' + key);
    if (chk) window.appConfig['opt_' + key] = Boolean(chk.checked);
    if (inp) {
        let parsed = parseFloat(String(inp.value).replace(',', '.'));
        if (!isNaN(parsed)) window.appConfig['val_' + key] = parsed;
    }
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.buildAudioGraph === 'function') window.buildAudioGraph();
};

window.saveDspModRow = function(key, ev) {
    window.onDspModChange(key);
    let saved = JSON.parse(localStorage.getItem('ytm_dsp_mod_saved') || '{}');
    saved['opt_' + key] = window.appConfig['opt_' + key];
    saved['val_' + key] = window.appConfig['val_' + key];
    localStorage.setItem('ytm_dsp_mod_saved', JSON.stringify(saved));
    try { navigator.vibrate(30); } catch(e){}
    if (typeof window.showToast === 'function') window.showToast("💾 Настройка сохранена!", ev);
};

window.loadDspModRow = function(key, ev) {
    let saved = JSON.parse(localStorage.getItem('ytm_dsp_mod_saved') || '{}');
    window.appConfig = window.appConfig || {};
    window.appConfig['opt_' + key] = (saved['opt_' + key] !== undefined) ? saved['opt_' + key] : window.DSP_MOD_DEFAULTS['opt_' + key];
    window.appConfig['val_' + key] = (saved['val_' + key] !== undefined) ? saved['val_' + key] : window.DSP_MOD_DEFAULTS['val_' + key];
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.syncDspModUI();
    if (typeof window.buildAudioGraph === 'function') window.buildAudioGraph();
    try { navigator.vibrate(30); } catch(e){}
    if (typeof window.showToast === 'function') window.showToast("📥 Загружено из памяти!", ev);
};

window.resetDspModAll = function(ev) {
    window.appConfig = window.appConfig || {};
    Object.keys(window.DSP_MOD_DEFAULTS).forEach(k => {
        window.appConfig[k] = window.DSP_MOD_DEFAULTS[k];
    });
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.syncDspModUI();
    if (typeof window.buildAudioGraph === 'function') window.buildAudioGraph();
    try { navigator.vibrate(35); } catch(e){}
    if (typeof window.showToast === 'function') window.showToast("🔄 Тонкие настройки сброшены!", ev);
};

document.addEventListener("DOMContentLoaded", () => {
    const sm = document.getElementById('settingsModal');
    if (!sm || document.getElementById('phaseFocusMasterCard')) return;

    // Ищем плашку "Студийный движок (RAM)"
    let ramCard = null;
    sm.querySelectorAll('div, label').forEach(el => {
        if (!ramCard && el.innerText && el.innerText.trim() === 'Студийный движок (RAM)') {
            ramCard = el.closest('div') || el.parentElement;
        }
    });

    // 1. Создаём одиночную плашку "Фазовый фокус" прямо под Студийным движком (RAM)
    const pfCard = document.createElement('div');
    pfCard.id = 'phaseFocusMasterCard';
    pfCard.style.cssText = "background:#0b0e14;border:1px solid #21262d;border-left:3px solid #8957e5;border-radius:10px;padding:12px 14px;margin:8px 0 12px 0;display:flex;align-items:center;";
    pfCard.innerHTML = `<label style="display:flex;align-items:center;gap:10px;color:#e6edf3;font-size:14px;font-weight:bold;cursor:pointer;width:100%;margin:0;"><input type="checkbox" id="cfg_phaseFix" onchange="window.onPhaseFocusChange(this, event)" style="width:18px;height:18px;accent-color:#2f81f7;flex-shrink:0;"><span>🎯 Фазовый фокус (Выравнивание вокала и баса)</span></label>`;

    // 2. Создаём секцию из 5 модульных настроек с полями ввода и кнопками 📥 / 💾
    const rows = [
        ['midPhase',   '🎯 Инверсия фазы СЧ (Гейн):', '0.05'],
        ['midQ',       '📐 Широкий купол СЧ (Q):',    '0.05'],
        ['deEsser',    '🐍 Де-эссер ВЧ (Уровень):',   '0.05'],
        ['cleanFir',   '✨ Чистый FIR (Импульс):',    '0.005'],
        ['masterCeil', '🛡️ Мастер-потолок (dB):',     '0.1']
    ];

    const btnStyle = "background:#161b22;border:1px solid #30363d;border-radius:6px;padding:6px 8px;cursor:pointer;font-size:13px;color:#e6edf3;display:flex;align-items:center;justify-content:center;";
    const inpStyle = "width:64px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#e6edf3;text-align:center;font-size:14px;padding:5px 4px;";

    const modSection = document.createElement('details');
    modSection.id = 'dspModularSection';
    modSection.open = true;
    modSection.style.cssText = "background:#0b0e14;border:1px solid #21262d;border-radius:10px;padding:10px 12px;margin:10px 0;";
    modSection.innerHTML = `
        <summary style="color:#58a6ff;font-size:15px;font-weight:bold;cursor:pointer;padding-bottom:8px;border-bottom:1px solid #21262d;margin-bottom:10px;">🧪 Тонкая настройка тракта (5 опций)</summary>
        <div style="position:relative;">
            <div id="dspModLockShield" onclick="try{navigator.vibrate(40);}catch(e){}; if(window.showToast) window.showToast('🔒 Блок управления отключён! Для включения снимите галочку «Фазовый фокус» выше', event);" style="display:none;position:absolute;inset:0;z-index:20;cursor:not-allowed;"></div>
            <div id="dspModBodyWrap" style="transition:opacity 0.2s ease, filter 0.2s ease;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <span style="color:#8b949e;font-size:12px;">Отдельные модули и коэффициенты:</span>
                    <button type="button" onclick="window.resetDspModAll(event)" style="background:#1f1633;border:1px solid #6e40c9;color:#d2a8ff;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;">🔄 Сброс</button>
                </div>
                ${rows.map(([k, lbl, stp]) => `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin:8px 0;">
                    <label style="display:flex;align-items:center;gap:8px;color:#c9d1d9;font-size:13px;cursor:pointer;flex:1;margin:0;">
                        <input type="checkbox" id="cfg_opt_${k}" onchange="window.onDspModChange('${k}')" style="width:17px;height:17px;accent-color:#2f81f7;flex-shrink:0;">
                        <span>${lbl}</span>
                    </label>
                    <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                        <button type="button" style="${btnStyle}" onclick="window.loadDspModRow('${k}', event)">📥</button>
                        <input type="number" step="${stp}" id="cfg_val_${k}" onchange="window.onDspModChange('${k}')" style="${inpStyle}">
                        <button type="button" style="${btnStyle}" onclick="window.saveDspModRow('${k}', event)">💾</button>
                    </div>
                </div>`).join('')}
            </div>
        </div>
    `;

    if (ramCard && ramCard.parentNode) {
        ramCard.insertAdjacentElement('afterend', pfCard);
        pfCard.insertAdjacentElement('afterend', modSection);
    } else {
        sm.insertBefore(modSection, sm.firstChild);
        sm.insertBefore(pfCard, sm.firstChild);
    }

    window.syncDspModUI();
});
