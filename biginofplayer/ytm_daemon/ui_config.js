// =========================================================================
// ⚙️ UI_CONFIG.JS (НАСТРОЙКИ, МОДАЛКИ И СОСТОЯНИЯ ИНТЕРФЕЙСА)
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
        alert("Эй! Ну оставь хоть одну зону активной! 😅");
        let target = document.getElementById('cfg_z' + idx + '_en');
        if(target) target.checked = true;
    }
    window.saveZonesToConfig();
};

window.resetScrubZones = function() {
    let defs = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
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

window.forceAction = async function(action, id) { 
    await fetch(`/api/force/${action}/${id}`, {method: 'POST'}); 
    if(typeof window.fetchData === 'function') window.fetchData(); 
};

window.toggleShowAll = function() {
    window.isShowingAllTracks = !window.isShowingAllTracks;
    const btn = document.getElementById('showAllBtnToggle');
    if (window.isShowingAllTracks) btn.classList.add('toggled-on');
    else btn.classList.remove('toggled-on');
    if(typeof window.fetchData === 'function') window.fetchData();
};

window.toggleExo = function(safeId) {
    const el = document.getElementById('exo-' + safeId);
    if(el) { 
        if (window.openDropdowns.has(safeId)) { window.openDropdowns.delete(safeId); el.style.display = 'none'; } 
        else { window.openDropdowns.add(safeId); el.style.display = 'block'; } 
    }
};

window.filterTracks = function(query) {
    let lowerQuery = query.toLowerCase();
    
    document.querySelectorAll('.capsule').forEach(el => {
        if (!el.id || !el.id.startsWith('track-')) return; 
        
        let trackName = el.innerText.toLowerCase();
        
        if (trackName.includes(lowerQuery)) {
            el.parentElement.style.display = 'block';
        } else {
            el.parentElement.style.display = 'none';
        }
    });
};

// 🚀 ФУНКЦИЯ СКРЫТИЯ/ОТОБРАЖЕНИЯ ПОЛЗУНКА ГРОМКОСТИ
window.toggleVolUI = function() {
    let wrapper = document.getElementById('volUIWrapper');
    if (wrapper) {
        let isEnabled = window.appConfig.volSlider !== false; 
        wrapper.style.display = isEnabled ? 'flex' : 'none';
    }
};
