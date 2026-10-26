// =========================================================================
// 🎛️ ENGINE_HEADS.JS (ТЕМЫ, ГРОМКОСТЬ, ЭКВАЛАЙЗЕР И СИНХРОНИЗАЦИЯ С ПИТОНОМ)
// =========================================================================

window.appConfig = JSON.parse(localStorage.getItem('ytm_config')) || {};

if (!window.appConfig._defaultsV2) {
    window.appConfig = {
        ...window.appConfig,
        _defaultsV2: true,
        studioMode: true,
        amoledMode: true,
        volSlider: true,
        leftHandedMode: false,
        pitchLock: true,
        xNormalSpeed: false,
        normalPlaybackSpeed: 0.97,
        autoSaveBase: false,
        defaultScrubSpeed: 1.1,
        autoSaveScrub: true,
        scrubZones: [
            { val: 1.1, en: true },
            { val: 1, en: true },
            { val: 1.05, en: true },
            { val: 0.95, en: true },
            { val: 1.5, en: true },
            { val: 0.9, en: true }
        ],
        firEnabled: true,
        firSettings: { gain: 1.5, decay: 1.28 },
        multiBandEnabled: true,
        multiBandSettings: { low: 160, high: 2528 },
        limiterEnabled: true,
        limiterSettings: { threshold: -18, knee: 128, ratio: 4, attack: 192, release: 352 },
        eqEnabled: true,
        boosterEnabled: true,
        boosterPower: 5
    };
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
}

if (window.appConfig.defaultVolume === undefined) window.appConfig.defaultVolume = "10";
if (window.appConfig.boosterEnabled === undefined) window.appConfig.boosterEnabled = true;
if (window.appConfig.boosterPower === undefined) window.appConfig.boosterPower = 5;
if (window.appConfig.studioMode === undefined) window.appConfig.studioMode = true;
if (window.appConfig.eqEnabled === undefined) window.appConfig.eqEnabled = true;
if (window.appConfig.amoledMode === undefined) window.appConfig.amoledMode = true;
if (window.appConfig.volSlider === undefined) window.appConfig.volSlider = true;

if (window.appConfig.pitchLock === undefined) window.appConfig.pitchLock = true;
if (window.appConfig.xNormalSpeed === undefined) window.appConfig.xNormalSpeed = false;
if (window.appConfig.normalPlaybackSpeed === undefined) window.appConfig.normalPlaybackSpeed = 0.97;
if (window.appConfig.autoSaveBase === undefined) window.appConfig.autoSaveBase = false;
if (window.appConfig.autoSaveScrub === undefined) window.appConfig.autoSaveScrub = true;
if (window.appConfig.leftHandedMode === undefined) window.appConfig.leftHandedMode = false;
if (window.appConfig.defaultScrubSpeed === undefined) window.appConfig.defaultScrubSpeed = 1.1;

if (window.appConfig.eq === undefined) window.appConfig.eq = { b60: 0, b230: 0, b910: 0, b3600: 0, b14000: 0 };
if (window.appConfig.firEnabled === undefined) window.appConfig.firEnabled = false;
if (window.appConfig.multiBandEnabled === undefined) window.appConfig.multiBandEnabled = false;
if (window.appConfig.limiterEnabled === undefined) window.appConfig.limiterEnabled = false;

if (window.appConfig.firSettings === undefined) window.appConfig.firSettings = { gain: 2, decay: 4 };
if (window.appConfig.multiBandSettings === undefined) window.appConfig.multiBandSettings = { low: 1600, high: 7200 };
if (window.appConfig.limiterSettings === undefined) window.appConfig.limiterSettings = { threshold: -22, knee: 19, ratio: 22, attack: 26, release: 60 };

window.applyTheme = function() {
    if (window.appConfig.amoledMode) {
        document.body.setAttribute('data-theme', 'amoled');
    } else {
        document.body.removeAttribute('data-theme');
    }
};
window.applyTheme();

window.applyLeftHandedMode = function() {
    if (window.appConfig.leftHandedMode) {
        document.body.setAttribute('data-lefthanded', 'true');
    } else {
        document.body.removeAttribute('data-lefthanded');
    }
};
window.applyLeftHandedMode();

document.addEventListener("DOMContentLoaded", () => {
    window.applyLeftHandedMode();
});

window.saveConfigToDisk = async function() {
    if(typeof window.updateSettings === 'function') window.updateSettings(); 
    try {
        await fetch('/api/config/save_all', { method: 'POST', body: JSON.stringify(window.appConfig) });
    } catch (e) { }
};

window.loadConfigFromDisk = async function() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if(Object.keys(data).length === 0) return;
        
        window.appConfig = { ...window.appConfig, ...data };
        localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
        
        const bools = {
            'cfg_studioMode': 'studioMode', 'cfg_amoledMode': 'amoledMode',
            'cfg_firEnabled': 'firEnabled', 'cfg_multiBandEnabled': 'multiBandEnabled',
            'cfg_limiterEnabled': 'limiterEnabled', 'cfg_eqEnabled': 'eqEnabled',
            'cfg_boosterEnabled': 'boosterEnabled',
            'cfg_autoSaveScrub': 'autoSaveScrub',
            'cfg_autoSaveBase': 'autoSaveBase',
            'cfg_leftHandedMode': 'leftHandedMode',
            'cfg_volSlider': 'volSlider',
            'cfg_pitchLock': 'pitchLock',
            'cfg_xNormalSpeed': 'xNormalSpeed'
        };
        for (let [id, key] of Object.entries(bools)) {
            let el = document.getElementById(id);
            if (el && window.appConfig[key] !== undefined) el.checked = window.appConfig[key];
        }
        
        if (document.getElementById('cfg_boosterPower')) document.getElementById('cfg_boosterPower').value = window.appConfig.boosterPower;
        if (document.getElementById('cfg_defaultScrubSpeed')) document.getElementById('cfg_defaultScrubSpeed').value = window.appConfig.defaultScrubSpeed;
        if (document.getElementById('cfg_normalPlaybackSpeed')) document.getElementById('cfg_normalPlaybackSpeed').value = window.appConfig.normalPlaybackSpeed || 0.97;

        if (window.appConfig.scrubZones && window.appConfig.scrubZones.length === 6) {
            for(let i=0; i<6; i++) {
                let z = window.appConfig.scrubZones[i];
                let enEl = document.getElementById('cfg_z' + (i+1) + '_en');
                let valEl = document.getElementById('cfg_z' + (i+1) + '_val');
                if (enEl) enEl.checked = z.en;
                if (valEl) valEl.value = z.val;
            }
        }

        if (window.appConfig.firSettings) {
            if(document.getElementById('cfg_fir_gain')) document.getElementById('cfg_fir_gain').value = window.appConfig.firSettings.gain;
            if(document.getElementById('cfg_fir_decay')) document.getElementById('cfg_fir_decay').value = window.appConfig.firSettings.decay;
        }
        if (window.appConfig.multiBandSettings) {
            if(document.getElementById('cfg_mb_low')) document.getElementById('cfg_mb_low').value = window.appConfig.multiBandSettings.low;
            if(document.getElementById('cfg_mb_high')) document.getElementById('cfg_mb_high').value = window.appConfig.multiBandSettings.high;
        }
        if (window.appConfig.limiterSettings) {
            if(document.getElementById('cfg_lim_threshold')) document.getElementById('cfg_lim_threshold').value = window.appConfig.limiterSettings.threshold;
            if(document.getElementById('cfg_lim_knee')) document.getElementById('cfg_lim_knee').value = window.appConfig.limiterSettings.knee;
            if(document.getElementById('cfg_lim_ratio')) document.getElementById('cfg_lim_ratio').value = window.appConfig.limiterSettings.ratio;
            if(document.getElementById('cfg_lim_attack')) document.getElementById('cfg_lim_attack').value = window.appConfig.limiterSettings.attack;
            if(document.getElementById('cfg_lim_release')) document.getElementById('cfg_lim_release').value = window.appConfig.limiterSettings.release;
        }
        
        if (document.getElementById('cfg_volSlider')) {
            document.getElementById('cfg_volSlider').checked = (window.appConfig.volSlider !== false);
        }

        window.applyTheme();
        window.applyEQSettings();
        window.applyVolumeSettings();
        if(typeof window.buildAudioGraph === 'function') window.buildAudioGraph();
        if(typeof window.toggleVolUI === 'function') window.toggleVolUI();
        if(typeof window.syncDspModUI === 'function') window.syncDspModUI();
        
    } catch(e) {}
};

window.saveSingle = async function(cat, key, elId) {
    let el = document.getElementById(elId);
    if(!el) return;
    let val = parseFloat(el.value);
    if (isNaN(val)) return;
    try {
        await fetch('/api/config/save_single', { method: 'POST', body: JSON.stringify({category: cat, key: key, value: val}) });
        let btn = el.nextElementSibling;
        let old = btn.innerHTML; btn.innerHTML = '✅'; setTimeout(() => btn.innerHTML = old, 1000);
    } catch (e) {}
};

window.loadSingle = async function(cat, key, elId) {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        let valueToLoad = undefined;
        if (cat === 'main' && data[key] !== undefined) valueToLoad = data[key];
        else if (data[cat] && data[cat][key] !== undefined) valueToLoad = data[cat][key];

        if (valueToLoad !== undefined) {
            let el = document.getElementById(elId);
            el.value = valueToLoad;
            if(typeof window.updateSettings === 'function') window.updateSettings();
            let btn = el.previousElementSibling;
            let old = btn.innerHTML; btn.innerHTML = '✅'; setTimeout(() => btn.innerHTML = old, 1000);
        }
    } catch (e) {}
};

window.resetFIR = function() { document.getElementById('cfg_fir_gain').value = 1.5; document.getElementById('cfg_fir_decay').value = 1.28; if(typeof window.updateSettings === 'function') window.updateSettings(); };
window.resetMultiBand = function() { document.getElementById('cfg_mb_low').value = 160; document.getElementById('cfg_mb_high').value = 2528; if(typeof window.updateSettings === 'function') window.updateSettings(); };
window.resetLimiter = function() { document.getElementById('cfg_lim_threshold').value = -18; document.getElementById('cfg_lim_knee').value = 128; document.getElementById('cfg_lim_ratio').value = 4; document.getElementById('cfg_lim_attack').value = 192; document.getElementById('cfg_lim_release').value = 352; if(typeof window.updateSettings === 'function') window.updateSettings(); };

window.toggleVolumePopup = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const pop = document.getElementById('volumePopup');
    if (pop) pop.classList.toggle('open');
};

(function() {
    function closeVolIfOutside(e) {
        const pop = document.getElementById('volumePopup');
        const trigger = document.getElementById('volIconTrigger');
        if (pop && pop.classList.contains('open')) {
            if (!pop.contains(e.target) && (!trigger || !trigger.contains(e.target))) {
                pop.classList.remove('open');
            }
        }
    }
    document.addEventListener('touchstart', closeVolIfOutside, { passive: true });
    document.addEventListener('mousedown', closeVolIfOutside);
})();

window.changeVolume = function() {
    if(typeof window.initAudioBoost === 'function') window.initAudioBoost();
    const volBar = document.getElementById('volumeBar');
    const volIconTxt = document.getElementById('volIconText');
    const volTrigger = document.getElementById('volIconTrigger');
    let val = parseInt(volBar.value, 10);
    
    if(window.gainNode) window.gainNode.gain.value = val / 10;
    const pct = Math.round((val / 10) * 100);
    
    if (val > 10) { 
        volIconTxt.innerHTML = '🔥 ' + pct + '%'; volIconTxt.style.color = '#da3633'; 
        volTrigger.style.borderColor = '#da3633'; volTrigger.style.color = '#da3633';
    } else { 
        volIconTxt.innerHTML = pct + '%'; volIconTxt.style.color = '#8b949e'; 
        volTrigger.style.borderColor = ''; volTrigger.style.color = '';
    }
    
    window.appConfig.defaultVolume = val;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
};

window.applyVolumeSettings = function() {
    let maxScale = window.appConfig.boosterEnabled ? (10 + window.appConfig.boosterPower) : 10;
    const volBar = document.getElementById('volumeBar');
    if (volBar) {
        volBar.max = maxScale;
        let parsedVol = parseInt(window.appConfig.defaultVolume, 10) || 10;
        volBar.value = parsedVol > maxScale ? maxScale : parsedVol;
        window.changeVolume();
    }
};

window.updateSettings = function() {
    const elBoosterEn = document.getElementById('cfg_boosterEnabled'); if(elBoosterEn) window.appConfig.boosterEnabled = elBoosterEn.checked;
    const elBoosterPw = document.getElementById('cfg_boosterPower'); if(elBoosterPw) window.appConfig.boosterPower = parseInt(elBoosterPw.value, 10) || 5;
    const elStudio = document.getElementById('cfg_studioMode'); if(elStudio) window.appConfig.studioMode = elStudio.checked;
    const elEqEn = document.getElementById('cfg_eqEnabled'); if(elEqEn) window.appConfig.eqEnabled = elEqEn.checked;
    
    const elAmoled = document.getElementById('cfg_amoledMode'); if(elAmoled) window.appConfig.amoledMode = elAmoled.checked;
    window.applyTheme();

    const elVol = document.getElementById('cfg_volSlider'); if (elVol) window.appConfig.volSlider = elVol.checked;
    
    const elAutoScrub = document.getElementById('cfg_autoSaveScrub'); if (elAutoScrub) window.appConfig.autoSaveScrub = elAutoScrub.checked;
    const elAutoBase = document.getElementById('cfg_autoSaveBase'); if (elAutoBase) window.appConfig.autoSaveBase = elAutoBase.checked;
    const elLeftHand = document.getElementById('cfg_leftHandedMode'); if (elLeftHand) window.appConfig.leftHandedMode = elLeftHand.checked;
    
    const elPitchLock = document.getElementById('cfg_pitchLock'); if (elPitchLock) window.appConfig.pitchLock = elPitchLock.checked;
    const elXNormal = document.getElementById('cfg_xNormalSpeed'); if (elXNormal) window.appConfig.xNormalSpeed = elXNormal.checked;
    const elNormSpeed = document.getElementById('cfg_normalPlaybackSpeed'); if (elNormSpeed) window.appConfig.normalPlaybackSpeed = parseFloat(elNormSpeed.value) || 0.97;
    
    window.applyLeftHandedMode();
    
    const elDefScrub = document.getElementById('cfg_defaultScrubSpeed'); if(elDefScrub) window.appConfig.defaultScrubSpeed = parseFloat(elDefScrub.value) || 1.1;

    if (!window.appConfig.scrubZones) window.appConfig.scrubZones = [];
    for(let i=1; i<=6; i++) {
        let enEl = document.getElementById('cfg_z' + i + '_en');
        let valEl = document.getElementById('cfg_z' + i + '_val');
        if (enEl && valEl) {
            window.appConfig.scrubZones[i-1] = {
                en: enEl.checked,
                val: parseFloat(valEl.value) || 1.0
            };
        }
    }

    const elFirEn = document.getElementById('cfg_firEnabled'); if(elFirEn) window.appConfig.firEnabled = elFirEn.checked;
    const elMbEn = document.getElementById('cfg_multiBandEnabled'); if(elMbEn) window.appConfig.multiBandEnabled = elMbEn.checked;
    const elLimEn = document.getElementById('cfg_limiterEnabled'); if(elLimEn) window.appConfig.limiterEnabled = elLimEn.checked;
    
    if (!window.appConfig.firSettings) window.appConfig.firSettings = {};
    const elFirGain = document.getElementById('cfg_fir_gain'); if(elFirGain) window.appConfig.firSettings.gain = parseFloat(elFirGain.value) || 2;
    const elFirDecay = document.getElementById('cfg_fir_decay'); if(elFirDecay) window.appConfig.firSettings.decay = parseFloat(elFirDecay.value) || 4;

    if (!window.appConfig.multiBandSettings) window.appConfig.multiBandSettings = {};
    const elMbLow = document.getElementById('cfg_mb_low'); if(elMbLow) window.appConfig.multiBandSettings.low = parseFloat(elMbLow.value) || 1600;
    const elMbHigh = document.getElementById('cfg_mb_high'); if(elMbHigh) window.appConfig.multiBandSettings.high = parseFloat(elMbHigh.value) || 7200;

    if (!window.appConfig.limiterSettings) window.appConfig.limiterSettings = {};
    const elLimThr = document.getElementById('cfg_lim_threshold'); if(elLimThr) window.appConfig.limiterSettings.threshold = parseFloat(elLimThr.value) || -22;
    const elLimKnee = document.getElementById('cfg_lim_knee'); if(elLimKnee) window.appConfig.limiterSettings.knee = parseFloat(elLimKnee.value) || 19;
    const elLimRatio = document.getElementById('cfg_lim_ratio'); if(elLimRatio) window.appConfig.limiterSettings.ratio = parseFloat(elLimRatio.value) || 22;
    const elLimAttack = document.getElementById('cfg_lim_attack'); if(elLimAttack) window.appConfig.limiterSettings.attack = parseFloat(elLimAttack.value) || 26;
    const elLimRel = document.getElementById('cfg_lim_release'); if(elLimRel) window.appConfig.limiterSettings.release = parseFloat(elLimRel.value) || 60;

    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    
    if(typeof window.buildAudioGraph === 'function') window.buildAudioGraph(); 
    window.applyVolumeSettings(); 
    if(typeof window.toggleVolUI === 'function') window.toggleVolUI();
        if(typeof window.syncDspModUI === 'function') window.syncDspModUI(); 
};

window.applyEQSettings = function() {
    const bands = [60, 230, 910, 3600, 14000];
    bands.forEach(freq => {
        const val = window.appConfig.eq['b' + freq] || 0;
        const el = document.getElementById('eq_' + freq);
        if (el) el.value = val;
        if (window.eqNodes && window.eqNodes['band' + freq]) window.eqNodes['band' + freq].gain.value = val;
    });
};

window.changeEQ = function() {
    if(typeof window.initAudioBoost === 'function') window.initAudioBoost();
    [60, 230, 910, 3600, 14000].forEach(freq => {
        const val = parseInt(document.getElementById('eq_' + freq).value, 10);
        window.appConfig.eq['b' + freq] = val;
        if (window.eqNodes && window.eqNodes['band' + freq]) window.eqNodes['band' + freq].gain.value = val;
    });
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
};

window.onNativeFolderPicked = async function(folderPath) {
    if (!folderPath) return;
    try {
        const res = await fetch('/api/folder', {
            method: 'POST',
            body: JSON.stringify({ path: folderPath })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            if (typeof window.fetchData === 'function') window.fetchData();
            let shortName = folderPath.split('/').filter(Boolean).pop() || folderPath;
            if (typeof window.showToast === 'function') {
                window.showToast("📁 Папка: " + shortName);
            }
        } else if (typeof window.showToast === 'function') {
            window.showToast("❌ " + (data.error || "Ошибка смены папки"));
        }
    } catch (e) {}
};

window.setupFolderLongPress = function() {
    const folderIcon = document.getElementById('folderIconTrigger');
    const filePicker = document.getElementById('systemFolderPicker');
    if (!folderIcon) return;

    let pressTimer;
    let isFired = false;

    const triggerPicker = () => {
        try { navigator.vibrate(50); } catch(err){}
        if (window.AndroidBridge && typeof window.AndroidBridge.pickFolder === 'function') {
            window.AndroidBridge.pickFolder();
        } else if (filePicker) {
            filePicker.click();
        }
    };

    folderIcon.addEventListener('touchstart', () => {
        isFired = false;
        pressTimer = setTimeout(() => {
            isFired = true;
            triggerPicker();
        }, 180);
    }, {passive: true});

    folderIcon.addEventListener('touchend', () => { if(!isFired) clearTimeout(pressTimer); });
    folderIcon.addEventListener('touchmove', () => { clearTimeout(pressTimer); });

    if (filePicker) {
        filePicker.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                let relPath = e.target.files[0].webkitRelativePath || '';
                let folderName = relPath.split('/')[0];
                if (folderName) {
                    window.onNativeFolderPicked(folderName);
                }
            }
        });
    }
};
