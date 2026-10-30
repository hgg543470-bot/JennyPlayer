// =========================================================================
// ⚙️ UI_CONFIG.JS (МОДАЛКИ И СОСТОЯНИЯ ИНТЕРФЕЙСА)
// =========================================================================

window.saveZonesToConfig = function() {
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
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.updateSettings === 'function') window.updateSettings();
};

window.checkZones = function(idx) {
    let activeCount = 0;
    for(let i=1; i<=6; i++) {
        let el = document.getElementById('cfg_z' + i + '_en');
        if(el && el.checked) activeCount++;
    }
    if(activeCount === 0) {
        let target = document.getElementById('cfg_z' + idx + '_en');
        if(target) target.checked = true;
    }
    window.saveZonesToConfig();
};

window.resetScrubZones = function() {
    let defs = [1.1, 1, 1.05, 0.95, 1.5, 0.9];
    for(let i=1; i<=6; i++) {
        let enEl = document.getElementById('cfg_z' + i + '_en');
        let valEl = document.getElementById('cfg_z' + i + '_val');
        if (enEl) enEl.checked = true;
        if (valEl) valEl.value = defs[i-1];
    }
    window.saveZonesToConfig();
    try { navigator.vibrate(30); } catch(err){}
};

window.toggleModal = function(id) { 
    const modals = ['settingsModal', 'favModal', 'eqModal'];
    const target = document.getElementById(id);
    const btnTarget = document.getElementById('btn-' + id);
    let wasOpen = target.classList.contains('open');
    
    modals.forEach(m => {
        let el = document.getElementById(m);
        let btn = document.getElementById('btn-' + m);
        if(el) el.classList.remove('open');
        if(btn) btn.style.color = '#58a6ff'; 
    });
    
    if (!wasOpen) {
        target.classList.add('open');
        if(btnTarget) btnTarget.style.color = '#fff'; 
    }
};

window.toggleShowAll = function() {
    window.isShowingAllTracks = !window.isShowingAllTracks;
    const btn = document.getElementById('showAllBtnToggle');
    if (window.isShowingAllTracks) btn.classList.add('toggled-on');
    else btn.classList.remove('toggled-on');
    if(typeof window.fetchData === 'function') window.fetchData();
};

window.filterTracks = function(query) {
    let lowerQuery = String(query || '').toLowerCase().trim();
    document.querySelectorAll('#unifiedList .track-row-capsule').forEach(el => {
        let trackName = (el.getAttribute('data-track') || el.innerText || '').toLowerCase();
        let allowed = window.isTrackAllowedByFormatSlots
            ? window.isTrackAllowedByFormatSlots(trackName)
            : true;
        let show = (!lowerQuery || trackName.includes(lowerQuery)) && allowed;
        if (el.parentElement && el.parentElement.id !== 'unifiedList') {
            el.parentElement.style.display = show ? 'block' : 'none';
        } else {
            el.style.display = show ? '' : 'none';
        }
    });
};

window.toggleVolUI = function() {
    let wrapper = document.getElementById('volUIWrapper');
    if (wrapper) {
        let isEnabled = window.appConfig.volSlider !== false; 
        wrapper.style.display = isEnabled ? 'flex' : 'none';
    }
};

window.showToast = function(msg, event) {
    document.querySelectorAll('.custom-toast').forEach(t => t.remove());
    let toast = document.createElement('div');
    toast.innerText = String(msg || '');
    toast.className = 'custom-toast';
    let vh = window.innerHeight || document.documentElement.clientHeight || 640;
    let clickY = (event && event.target && typeof event.target.getBoundingClientRect === 'function')
        ? event.target.getBoundingClientRect().top : (vh * 0.45);
    toast.style.top = Math.max(18, Math.min(vh - 110, clickY - 95)) + 'px';
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 280);
    }, 3200);
};

window.toggleAutoSave = function(source, event) {
    let elBase = document.getElementById('cfg_autoSaveBase');
    let elScrub = document.getElementById('cfg_autoSaveScrub');
    let showWarning = false;
    
    if (source === 'base' && elBase && elBase.checked && elScrub && elScrub.checked) {
        elScrub.checked = false;
        showWarning = true;
    } else if (source === 'scrub' && elScrub && elScrub.checked && elBase && elBase.checked) {
        elBase.checked = false;
        showWarning = true;
    }
    
    if (showWarning) {
        window.showToast("Что-то одно из двух! 😅", event);
        try { navigator.vibrate(40); } catch(err){} // Легкий виброотклик для солидности
    }

    if (window.updateSettings) window.updateSettings();
};
