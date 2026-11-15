// =========================================================================
// 🎛️ ENGINE_HEADS.JS (ВЕРХНЯЯ ПАНЕЛЬ, НАСТРОЙКИ, ТЕМЫ И БЭКАПЫ)
// =========================================================================

window.appConfig = JSON.parse(localStorage.getItem('ytm_config')) || {};

if (window.appConfig.logMode === undefined) window.appConfig.logMode = "session";
if (window.appConfig.defaultVolume === undefined) window.appConfig.defaultVolume = "10";
if (window.appConfig.boosterEnabled === undefined) window.appConfig.boosterEnabled = true;
if (window.appConfig.boosterPower === undefined) window.appConfig.boosterPower = 20;
if (window.appConfig.studioMode === undefined) window.appConfig.studioMode = false; 
if (window.appConfig.eqEnabled === undefined) window.appConfig.eqEnabled = true; 
if (window.appConfig.amoledMode === undefined) window.appConfig.amoledMode = false; 
if (window.appConfig.daemonTimer === undefined) window.appConfig.daemonTimer = 2;

if (window.appConfig.autoSaveScrub === undefined) window.appConfig.autoSaveScrub = false;
if (window.appConfig.leftHandedMode === undefined) window.appConfig.leftHandedMode = false;
if (window.appConfig.defaultScrubSpeed === undefined) window.appConfig.defaultScrubSpeed = 2.0;

if (window.appConfig.eq === undefined) window.appConfig.eq = { b60: 0, b230: 0, b910: 0, b3600: 0, b14000: 0 };
if (window.appConfig.firEnabled === undefined) window.appConfig.firEnabled = false; 
if (window.appConfig.multiBandEnabled === undefined) window.appConfig.multiBandEnabled = false; 
if (window.appConfig.limiterEnabled === undefined) window.appConfig.limiterEnabled = true; 

if (window.appConfig.firSettings === undefined) window.appConfig.firSettings = { gain: 2.5, decay: 15 };
if (window.appConfig.multiBandSettings === undefined) window.appConfig.multiBandSettings = { low: 200, high: 2500 };
if (window.appConfig.limiterSettings === undefined) window.appConfig.limiterSettings = { threshold: -18, knee: 15, ratio: 20, attack: 15, release: 80 };

window.applyTheme = function() {
    if (window.appConfig.amoledMode) {
        document.body.setAttribute('data-theme', 'amoled');
    } else {
        document.body.removeAttribute('data-theme');
    }
};
window.applyTheme();

window.changeTimer = async function() {
    let el = document.getElementById('timerInput');
    if(!el) return;
    let val = parseInt(el.value, 10);
    if(isNaN(val) || val < 1) val = 2; 
    el.value = val;
    window.appConfig.daemonTimer = val;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    try { await fetch(`/api/timer/${val}`, {method: 'POST'}); } catch(e) {}
};

window.saveConfigToDisk = async function() {
    window.updateSettings(); 
    try {
        await fetch('/api/config/save_all', { method: 'POST', body: JSON.stringify(window.appConfig) });
        window.remoteLog("💾 ПОЛНЫЙ бэкап всех настроек сохранен!");
    } catch (e) { window.remoteLog("❌ Ошибка сети при сохранении бэкапа"); }
};

window.loadConfigFromDisk = async function() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if(Object.keys(data).length === 0) return window.remoteLog("⚠️ Бэкап пуст или не существует.");
        
        window.appConfig = { ...window.appConfig, ...data };
        localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
        
        const bools = {
            'cfg_studioMode': 'studioMode', 'cfg_amoledMode': 'amoledMode',
            'cfg_firEnabled': 'firEnabled', 'cfg_multiBandEnabled': 'multiBandEnabled',
            'cfg_limiterEnabled': 'limiterEnabled', 'cfg_eqEnabled': 'eqEnabled',
            'cfg_boosterEnabled': 'boosterEnabled',
            'cfg_autoSaveScrub': 'autoSaveScrub',
            'cfg_leftHandedMode': 'leftHandedMode'
        };
        for (let [id, key] of Object.entries(bools)) {
            let el = document.getElementById(id);
            if (el && window.appConfig[key] !== undefined) el.checked = window.appConfig[key];
        }
        
        if (document.getElementById('cfg_logMode')) document.getElementById('cfg_logMode').value = window.appConfig.logMode;
        if (document.getElementById('cfg_boosterPower')) document.getElementById('cfg_boosterPower').value = window.appConfig.boosterPower;
        if (document.getElementById('cfg_defaultScrubSpeed')) document.getElementById('cfg_defaultScrubSpeed').value = window.appConfig.defaultScrubSpeed;
        
        if (document.getElementById('timerInput')) {
            document.getElementById('timerInput').value = window.appConfig.daemonTimer;
            window.changeTimer();
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
        
        window.applyTheme();
        window.applyEQSettings();
        window.applyVolumeSettings();
        if(typeof window.buildAudioGraph === 'function') window.buildAudioGraph();
        
        window.remoteLog("📥 АБСОЛЮТНО ВСЁ загружено!");
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
            window.updateSettings();
            let btn = el.previousElementSibling;
            let old = btn.innerHTML; btn.innerHTML = '✅'; setTimeout(() => btn.innerHTML = old, 1000);
        }
    } catch (e) {}
};

window.resetFIR = function() { document.getElementById('cfg_fir_gain').value = 2.5; document.getElementById('cfg_fir_decay').value = 15; window.updateSettings(); };
window.resetMultiBand = function() { document.getElementById('cfg_mb_low').value = 200; document.getElementById('cfg_mb_high').value = 2500; window.updateSettings(); };
window.resetLimiter = function() {
    document.getElementById('cfg_lim_threshold').value = -18; document.getElementById('cfg_lim_knee').value = 15;
    document.getElementById('cfg_lim_ratio').value = 20; document.getElementById('cfg_lim_attack').value = 15;
    document.getElementById('cfg_lim_release').value = 80; window.updateSettings();
};

window.toggleVolumePopup = function() { document.getElementById('volumePopup').classList.toggle('open'); };

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
        volTrigger.innerHTML = '🔥';
    } else { 
        volIconTxt.innerHTML = pct + '%'; volIconTxt.style.color = '#8b949e'; 
        volTrigger.innerHTML = '🔊';
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
    window.appConfig.logMode = document.getElementById('cfg_logMode').value;
    window.appConfig.boosterEnabled = document.getElementById('cfg_boosterEnabled').checked;
    window.appConfig.boosterPower = parseInt(document.getElementById('cfg_boosterPower').value, 10) || 1;
    window.appConfig.studioMode = document.getElementById('cfg_studioMode').checked;
    window.appConfig.eqEnabled = document.getElementById('cfg_eqEnabled').checked;
    
    window.appConfig.amoledMode = document.getElementById('cfg_amoledMode').checked;
    window.applyTheme();
    
    window.appConfig.autoSaveScrub = document.getElementById('cfg_autoSaveScrub').checked;
    window.appConfig.leftHandedMode = document.getElementById('cfg_leftHandedMode').checked;
    window.appConfig.defaultScrubSpeed = parseFloat(document.getElementById('cfg_defaultScrubSpeed').value) || 2.0;

    window.appConfig.firEnabled = document.getElementById('cfg_firEnabled').checked;
    window.appConfig.multiBandEnabled = document.getElementById('cfg_multiBandEnabled').checked;
    window.appConfig.limiterEnabled = document.getElementById('cfg_limiterEnabled').checked;
    
    window.appConfig.firSettings.gain = parseFloat(document.getElementById('cfg_fir_gain').value) || 2.5;
    window.appConfig.firSettings.decay = parseFloat(document.getElementById('cfg_fir_decay').value) || 15;

    window.appConfig.multiBandSettings.low = parseFloat(document.getElementById('cfg_mb_low').value) || 200;
    window.appConfig.multiBandSettings.high = parseFloat(document.getElementById('cfg_mb_high').value) || 2500;

    window.appConfig.limiterSettings.threshold = parseFloat(document.getElementById('cfg_lim_threshold').value) || -18;
    window.appConfig.limiterSettings.knee = parseFloat(document.getElementById('cfg_lim_knee').value) || 15;
    window.appConfig.limiterSettings.ratio = parseFloat(document.getElementById('cfg_lim_ratio').value) || 20;
    window.appConfig.limiterSettings.attack = parseFloat(document.getElementById('cfg_lim_attack').value) || 15;
    window.appConfig.limiterSettings.release = parseFloat(document.getElementById('cfg_lim_release').value) || 80;

    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    
    if(typeof window.buildAudioGraph === 'function') window.buildAudioGraph(); 
    window.applyVolumeSettings(); 
    if(typeof window.fetchData === 'function') window.fetchData(); 
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

window.setupFolderLongPress = function() {
    const folderIcon = document.getElementById('folderIconTrigger');
    const filePicker = document.getElementById('systemFolderPicker');
    if (!folderIcon || !filePicker) return;

    let pressTimer;
    let isFired = false;

    folderIcon.addEventListener('touchstart', (e) => {
        isFired = false;
        pressTimer = setTimeout(() => {
            isFired = true;
            try { navigator.vibrate(50); } catch(err){}
            filePicker.click();
        }, 180);
    }, {passive: true});

    folderIcon.addEventListener('touchend', () => { if(!isFired) clearTimeout(pressTimer); });
    folderIcon.addEventListener('touchmove', () => { clearTimeout(pressTimer); });
};
