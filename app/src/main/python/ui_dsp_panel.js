/* ============================================================================
 * ui_dsp_panel.js — Панель модулей DSP в настройках: галочки, сохранение и сброс строк, верхняя строка поиска/монитора
 *
 * Склейка:  /bundle_1_studio.js, модуль 3 из 12. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   updateTopSearchOrMonitorBar, ensureParentDspBlocks, syncDspModUI, attachModalObs, onPhaseFocusChange, onDspModChange, saveDspModRow, loadDspModRow, resetDspGroup
 * Откуда:   ui_help.js (коммит 9ae6639), строки 324–477. Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */


window._dspInputDebounce = null;
window.ALL_MOD_KEYS = ['midPhase', 'midQ', 'deEsser', 'cleanFir', 'masterCeil', 'autoRms', 'monoBass', 'msWidth', 'punch', 'crossfeed'];

window.updateTopSearchOrMonitorBar = function() {
    const searchInput = document.getElementById('trackSearchInput');
    if (!searchInput || !searchInput.parentElement) return;
    const barWrap = searchInput.parentElement;
    const sm = document.getElementById('settingsModal'); const em = document.getElementById('eqModal');
    const isModalOpen = (sm && sm.classList.contains('open')) || (em && em.classList.contains('open'));
    const cfg = window.appConfig || {};
    const ceilOn = Boolean(cfg.opt_masterCeil || cfg.phaseFixEnabled);
    const totalTxt = (typeof window.lastComputedCeilingDb !== 'undefined') ? window.lastComputedCeilingDb : -0.5;
    const detailsTxt = window.localizeCeilingBreakdown(window.lastCeilingBreakdown);
    const badge = document.getElementById('autoCeilStatusBadge');
    if (badge) {
        badge.innerText = cfg.opt_masterCeil ? `${window.tr('Авто', 'Auto')}: ${totalTxt} dB` : window.tr('ВЫКЛ', 'OFF');
        badge.style.color = cfg.opt_masterCeil ? '#3fb950' : '#8b949e';
    }
    let monEl = document.getElementById('topAutoCeilMonitor');
    if (!monEl) {
        monEl = document.createElement('div'); monEl.id = 'topAutoCeilMonitor';
        monEl.style.cssText = 'display:none;width:100%;box-sizing:border-box;background:#0d1117;border:1px solid #2ea043;border-radius:8px;padding:8px 11px;font-size:12px;color:#e6edf3;white-space:nowrap;overflow-x:auto;font-family:monospace;box-shadow:0 0 8px rgba(46,160,67,0.25);';
        barWrap.appendChild(monEl);
    }
    if (!isModalOpen) {
        barWrap.style.display = ''; barWrap.style.paddingTop = '2px'; searchInput.style.display = ''; monEl.style.display = 'none';
    } else {
        searchInput.style.display = 'none';
        if (ceilOn) {
            barWrap.style.display = ''; barWrap.style.paddingTop = '2px'; monEl.style.display = 'block';
            monEl.innerHTML = `<span style="color:#3fb950;font-weight:bold;">🛡️ ${window.tr('Авто-Потолок', 'Auto-Ceiling')}: ${totalTxt} dB</span> <span style="color:#8b949e;">│</span> <span style="color:#58a6ff;">${detailsTxt}</span>`;
        } else { monEl.style.display = 'none'; barWrap.style.display = 'none'; }
    }
};

window.ensureParentDspBlocks = function(modKey) {
    window.appConfig = window.appConfig || {};
    let changed = false;
    if ((modKey === 'cleanFir' || modKey === 'phaseFix') && !window.appConfig.firEnabled) {
        window.appConfig.firEnabled = true; const el = document.getElementById('cfg_firEnabled'); if (el) el.checked = true; changed = true;
    }
    if (['midPhase', 'midQ', 'deEsser', 'phaseFix'].includes(modKey)) {
        if (!window.appConfig.limiterEnabled) { window.appConfig.limiterEnabled = true; const el = document.getElementById('cfg_limiterEnabled'); if (el) el.checked = true; changed = true; }
        if (!window.appConfig.multiBandEnabled) { window.appConfig.multiBandEnabled = true; const el = document.getElementById('cfg_multiBandEnabled'); if (el) el.checked = true; changed = true; }
    }
    if (changed) localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
};

window.syncDspModUI = function() {
    window.appConfig = window.appConfig || {};
    const cfg = window.appConfig;
    if (!cfg._migratedToRealUnitsV20) {
        cfg._migratedToRealUnitsV20 = true;
        Object.keys(window.DSP_MOD_DEFAULTS).forEach(k => { if (cfg[k] === undefined) cfg[k] = window.DSP_MOD_DEFAULTS[k]; });
        if (cfg.val_deEsser === -60) cfg.val_deEsser = -6.0;
        if (cfg.val_midQ < 25) cfg.val_midQ = 150;
        cfg.opt_masterCeil = true;
        if (cfg.opt_msWidth && cfg.opt_crossfeed) cfg.opt_crossfeed = false;
        localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    }
    const pfEl = document.getElementById('cfg_phaseFix');
    if (pfEl) pfEl.checked = Boolean(cfg.phaseFixEnabled);
    window.ALL_MOD_KEYS.forEach(k => {
        const chk = document.getElementById('cfg_opt_' + k); const inp = document.getElementById('cfg_val_' + k);
        if (chk) chk.checked = Boolean(cfg['opt_' + k]);
        if (inp) { let v = cfg['val_' + k]; inp.value = (v !== undefined && v !== null && v !== '') ? v : window.DSP_MOD_DEFAULTS['val_' + k]; }
    });
    const wrap = document.getElementById('dspModBodyWrap'); const shield = document.getElementById('dspModLockShield');
    if (wrap && shield) {
        wrap.style.opacity = cfg.phaseFixEnabled ? '0.32' : '1';
        wrap.style.filter = 'none';
        shield.style.display = cfg.phaseFixEnabled ? 'block' : 'none';
    }
    if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
};

if (!window._modalClassObserverInit) {
    window._modalClassObserverInit = true;
    const attachModalObs = () => {
        const obs = new MutationObserver(() => { if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar(); });
        ['settingsModal', 'eqModal', 'favModal'].forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el, { attributes: true, attributeFilter: ['class', 'style'] }); });
        if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachModalObs); else attachModalObs();
}

window.onPhaseFocusChange = function(el, ev) {
    window.appConfig = window.appConfig || {};
    window.appConfig.phaseFixEnabled = Boolean(el.checked);
    if (el.checked) window.ensureParentDspBlocks('phaseFix', ev);
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.syncDspModUI();
    if (typeof window.buildAudioGraph === 'function') { clearTimeout(window._dspInputDebounce); window._dspInputDebounce = setTimeout(() => window.buildAudioGraph(), 90); }
    try { navigator.vibrate(40); } catch(e){}
    if (typeof window.showToast === 'function') window.showToast(el.checked ? "🔒 Блок управления отключён! Для включения выключите «Фазовый фокус»" : "🔓 Ручной блок тонкой настройки активен!", ev);
};

window.onDspModChange = function(key, ev) {
    window.appConfig = window.appConfig || {};
    const chk = document.getElementById('cfg_opt_' + key); const inp = document.getElementById('cfg_val_' + key);
    if (chk && chk.checked && (key === 'msWidth' || key === 'crossfeed')) {
        const otherKey = (key === 'msWidth') ? 'crossfeed' : 'msWidth';
        const otherChk = document.getElementById('cfg_opt_' + otherKey);
        if ((otherChk && otherChk.checked) || window.appConfig['opt_' + otherKey]) {
            if (otherChk) otherChk.checked = false; window.appConfig['opt_' + otherKey] = false;
            try { navigator.vibrate(35); } catch(e){}
            if (typeof window.showToast === 'function') window.showToast(key === 'msWidth' ? "🎭 Стерео ВКЛ (🎧 Бинаурал откл. — что-то одно из двух)" : "🎧 Бинаурал ВКЛ (🎭 Стерео откл. — что-то одно из двух)", ev);
        }
    }
    if (chk) { window.appConfig['opt_' + key] = Boolean(chk.checked); if (chk.checked) window.ensureParentDspBlocks(key); }
    if (inp) { let p = parseFloat(String(inp.value).replace(',', '.')); if (!isNaN(p)) window.appConfig['val_' + key] = p; }
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
    if (typeof window.buildAudioGraph === 'function') { clearTimeout(window._dspInputDebounce); window._dspInputDebounce = setTimeout(() => window.buildAudioGraph(), 90); }
};

window.saveDspModRow = async function(key, btnEl) {
    window.onDspModChange(key);
    try {
        await fetch('/api/config/save_single', { method: 'POST', body: JSON.stringify({category: 'main', key: 'val_' + key, value: window.appConfig['val_' + key]}) });
        await fetch('/api/config/save_single', { method: 'POST', body: JSON.stringify({category: 'main', key: 'opt_' + key, value: Boolean(window.appConfig['opt_' + key])}) });
        if (btnEl) { let old = btnEl.innerHTML; btnEl.innerHTML = '✅'; setTimeout(() => btnEl.innerHTML = old, 1000); }
    } catch (e) {}
    try { navigator.vibrate(30); } catch(e){}
};

window.loadDspModRow = async function(key, btnEl) {
    try {
        const res = await fetch('/api/config'); const data = await res.json();
        window.appConfig['opt_' + key] = (data['opt_' + key] !== undefined) ? Boolean(data['opt_' + key]) : window.DSP_MOD_DEFAULTS['opt_' + key];
        window.appConfig['val_' + key] = (data['val_' + key] !== undefined) ? parseFloat(data['val_' + key]) : window.DSP_MOD_DEFAULTS['val_' + key];
        localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
        window.syncDspModUI();
        if (typeof window.buildAudioGraph === 'function') { clearTimeout(window._dspInputDebounce); window._dspInputDebounce = setTimeout(() => window.buildAudioGraph(), 90); }
        if (btnEl) { let old = btnEl.innerHTML; btnEl.innerHTML = '✅'; setTimeout(() => btnEl.innerHTML = old, 1000); }
    } catch (e) {}
    try { navigator.vibrate(30); } catch(e){}
};

window.resetDspGroup = function(keysList, msg, ev) {
    window.appConfig = window.appConfig || {};
    keysList.forEach(k => {
        window.appConfig['opt_' + k] = window.DSP_MOD_DEFAULTS['opt_' + k];
        window.appConfig['val_' + k] = window.DSP_MOD_DEFAULTS['val_' + k];
        const chk = document.getElementById('cfg_opt_' + k); const inp = document.getElementById('cfg_val_' + k);
        if (chk) chk.checked = Boolean(window.DSP_MOD_DEFAULTS['opt_' + k]);
        if (inp) inp.value = window.DSP_MOD_DEFAULTS['val_' + k];
    });
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
    if (typeof window.buildAudioGraph === 'function') { clearTimeout(window._dspInputDebounce); window._dspInputDebounce = setTimeout(() => window.buildAudioGraph(), 90); }
    try { navigator.vibrate(35); } catch(e){}
    if (typeof window.showToast === 'function') window.showToast(msg, ev);
};
