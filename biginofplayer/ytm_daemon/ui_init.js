// =========================================================================
// 🖥️ UI_INIT.JS (ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И ИНИЦИАЛИЗАЦИЯ)
// =========================================================================

window.currentPlayingTrack = null;
window.currentTrackList = [];
window.currentListContext = 'main'; 
window.lastData = null; 
window.isShowingAllTracks = false;

window.isReversed = false; 
window.scrubState = { active: false, locked: false, side: null, speed: 1.0, isPhysicallyReversed: false };
window.openDropdowns = new Set(); 

(function () {
    let script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/eruda";
    document.body.appendChild(script);
    script.onload = function () {
        eruda.init();
        console.log("🔥 Eruda Console Injected! Готов к тестам.");
    }
})();

document.addEventListener("DOMContentLoaded", () => {
    const bools = {
        'cfg_studioMode': 'studioMode', 'cfg_amoledMode': 'amoledMode',
        'cfg_firEnabled': 'firEnabled', 'cfg_multiBandEnabled': 'multiBandEnabled',
        'cfg_limiterEnabled': 'limiterEnabled', 'cfg_eqEnabled': 'eqEnabled',
        'cfg_boosterEnabled': 'boosterEnabled',
        'cfg_autoSaveScrub': 'autoSaveScrub',
        'cfg_leftHandedMode': 'leftHandedMode',
        'cfg_pitchLock': 'pitchLock',
        'cfg_volSlider': 'volSlider',         
        'cfg_xNormalSpeed': 'xNormalSpeed'    
    };
    for (let [id, key] of Object.entries(bools)) {
        let el = document.getElementById(id);
        if (el && window.appConfig[key] !== undefined) el.checked = window.appConfig[key];
    }
    
    if (document.getElementById('cfg_logMode')) document.getElementById('cfg_logMode').value = window.appConfig.logMode;
    if (document.getElementById('cfg_boosterPower')) document.getElementById('cfg_boosterPower').value = window.appConfig.boosterPower;
    if (document.getElementById('cfg_defaultScrubSpeed')) document.getElementById('cfg_defaultScrubSpeed').value = window.appConfig.defaultScrubSpeed || 2.0;
    
    // Подтягиваем значение кастомной скорости
    if (document.getElementById('cfg_normalPlaybackSpeed')) {
        document.getElementById('cfg_normalPlaybackSpeed').value = window.appConfig.normalPlaybackSpeed || 0.97;
    }
    
    let defZones = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
    if (!window.appConfig.scrubZones || window.appConfig.scrubZones.length !== 6) {
        window.appConfig.scrubZones = defZones.map(v => ({val: v, en: true}));
    }
    for(let i=0; i<6; i++) {
        let z = window.appConfig.scrubZones[i];
        let enEl = document.getElementById('cfg_z' + (i+1) + '_en');
        let valEl = document.getElementById('cfg_z' + (i+1) + '_val');
        if (enEl) enEl.checked = z.en;
        if (valEl) valEl.value = z.val;
    }

    let timerEl = document.getElementById('timerInput');
    if (timerEl && window.appConfig.daemonTimer !== undefined) {
        timerEl.value = window.appConfig.daemonTimer;
        fetch(`/api/timer/${window.appConfig.daemonTimer}`, {method: 'POST'}).catch(()=>{});
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
    
    if(typeof window.setupFolderLongPress === 'function') window.setupFolderLongPress(); 
    if(typeof window.applyVolumeSettings === 'function') window.applyVolumeSettings();
    if(typeof window.applyEQSettings === 'function') window.applyEQSettings();
    
    if(typeof window.setupSeekZone === 'function') window.setupSeekZone();
    if(typeof window.setupTimeBlockControls === 'function') window.setupTimeBlockControls(); 
    
    if(typeof window.toggleVolUI === 'function') window.toggleVolUI();
});

// 🚀 МЕТОД РАСЧЕТА БАЗОВОЙ СКОРОСТИ (ИЗОЛИРОВАННЫЙ ОТ ДУГИ)
window.getBaseSpeed = function() {
    if (window.appConfig && window.appConfig.xNormalSpeed) {
        return parseFloat(window.appConfig.normalPlaybackSpeed) || 1.0;
    }
    return 1.0; 
};

function scheduleFetch() {
    if (typeof window.fetchData === 'function') {
        window.fetchData().finally(() => {
            const player = document.getElementById('audioPlayer');
            const isPlaying = (player && !player.paused && player.currentTime > 0);
            setTimeout(scheduleFetch, isPlaying ? 6000 : 2000);
        });
    } else {
        setTimeout(scheduleFetch, 2000); 
    }
}
scheduleFetch();
