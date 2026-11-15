/* ============================================================================
 * ui_formats.js — Слоты форматов файлов (V85) и фильтр списка по формату
 * Вынесено из ui_help.js без изменения кода (см. REFACTOR_PLAN.md). Порядок блоков — исходный.
 * ============================================================================ */


window.DEFAULT_FORMAT_SLOTS = [
    { en: true, ext: '.mp3' }, { en: true, ext: '.opus' }, { en: true, ext: '.m4a' }, { en: true, ext: '.flac' },
    { en: true, ext: '.wav' }, { en: true, ext: '.ogg' }, { en: true, ext: '.mp4' }, { en: true, ext: '.aac' },
    { en: true, ext: '.xflac' }
];
window.ensureFormatSlotDOMV85 = function(idx1Based) {
    let chk = document.getElementById(`cfg_fmt_${idx1Based}_en`);
    let inp = document.getElementById(`cfg_fmt_${idx1Based}_val`);
    if (chk && inp) return { chk, inp };
    const grid = document.getElementById('formatSlotsGrid');
    if (!grid) return { chk: null, inp: null };
    const cell = document.createElement('div');
    cell.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:#0d1117; padding:4px 8px; border-radius:4px; border:1px solid #30363d;';
    cell.innerHTML = `<input type="checkbox" id="cfg_fmt_${idx1Based}_en" checked onchange="if(window.saveFormatSlotsToConfig) window.saveFormatSlotsToConfig(true)"><input type="text" id="cfg_fmt_${idx1Based}_val" value="" oninput="if(window.saveFormatSlotsToConfig) window.saveFormatSlotsToConfig(true)" style="width:60px; font-size:12px; font-weight:bold; padding:2px; text-align:center; background:transparent; color:#58a6ff; border:none; outline:none; font-family:monospace;">`;
    grid.appendChild(cell);
    return {
        chk: document.getElementById(`cfg_fmt_${idx1Based}_en`),
        inp: document.getElementById(`cfg_fmt_${idx1Based}_val`)
    };
};
window.getFormatSlotsConfig = function() {
    window.appConfig = window.appConfig || {};
    if (!Array.isArray(window.appConfig.formatSlots) || window.appConfig.formatSlots.length < 8) {
        window.appConfig.formatSlots = JSON.parse(JSON.stringify(window.DEFAULT_FORMAT_SLOTS));
    }
    if (!window.appConfig.formatSlots.some(s => s && String(s.ext || '').toLowerCase() === '.xflac')) {
        window.appConfig.formatSlots.push({ en: true, ext: '.xflac' });
    }
    return window.appConfig.formatSlots;
};
window.syncFormatSlotsUI = function() {
    const slots = window.getFormatSlotsConfig();
    for (let i = 0; i < slots.length; i++) {
        const { chk, inp } = window.ensureFormatSlotDOMV85(i + 1);
        const s = slots[i] || { en: true, ext: '' };
        if (chk) chk.checked = Boolean(s.en);
        if (inp) {
            let c = String(s.ext || '').trim(); if (c && !c.startsWith('.')) c = '.' + c;
            inp.value = c; inp.style.opacity = s.en ? '1' : '0.4';
        }
    }
};
window.addNewFormatSlotV85 = async function(ev) {
    const slots = window.getFormatSlotsConfig();
    const raw = prompt('➕ Введи новое расширение файла (например: .wv, .ape, .alac, .dsf):', '.wv');
    if (!raw) return;
    let clean = String(raw).trim().toLowerCase();
    if (!clean) return;
    if (!clean.startsWith('.')) clean = '.' + clean;
    const ex = slots.find(s => s && String(s.ext || '').toLowerCase() === clean);
    if (ex) {
        ex.en = true;
    } else {
        slots.push({ en: true, ext: clean });
    }
    window.syncFormatSlotsUI();
    await window.saveFormatSlotsToConfig(true);
    if (typeof window.showToast === 'function') window.showToast(`✅ Добавлен формат ${clean} (всего: ${slots.length})`, ev);
};
window.isTrackAllowedByFormatSlots = function(filename) {
    if (!filename) return true;
    const activeExts = window.getFormatSlotsConfig().filter(s => s && s.en && String(s.ext || '').trim()).map(s => '.' + String(s.ext).trim().toLowerCase().replace(/^\.+/, ''));
    if (activeExts.length === 0) return false;
    const lower = String(filename).toLowerCase().trim();
    return activeExts.some(ext => lower.endsWith(ext));
};
window.applyFormatFilterToDOM = function() {
    window.translateDynamicListPlaceholders();
    const uList = document.getElementById('unifiedList');
    if (!uList) return;
    const rows = Array.from(uList.children);
    let visibleCount = 0;
    let hasTrackRows = false;
    rows.forEach(row => {
        const cap = row.classList && row.classList.contains('track-row-capsule')
            ? row : (row.querySelector ? row.querySelector('.track-row-capsule') : null);
        const trackName = cap ? (cap.getAttribute('data-track') || '') : '';
        if (!trackName) return;
        hasTrackRows = true;
        const allowed = window.isTrackAllowedByFormatSlots(trackName);
        row.style.display = allowed ? '' : 'none';
        if (allowed) visibleCount++;
    });
    const cnt = document.getElementById('tracksCount');
    if (cnt && hasTrackRows) cnt.innerText = visibleCount;
};
window.saveFormatSlotsToConfig = async function(triggerReload) {
    window.appConfig = window.appConfig || {};
    const curLen = Math.max(window.DEFAULT_FORMAT_SLOTS.length, (window.appConfig.formatSlots || []).length);
    const slots = [];
    for (let i = 0; i < curLen; i++) {
        const chk = document.getElementById(`cfg_fmt_${i+1}_en`); const inp = document.getElementById(`cfg_fmt_${i+1}_val`);
        const defExt = (window.DEFAULT_FORMAT_SLOTS[i] && window.DEFAULT_FORMAT_SLOTS[i].ext) || '';
        let raw = inp ? inp.value.trim().toLowerCase() : defExt;
        if (raw && !raw.startsWith('.')) raw = '.' + raw;
        if (!raw) continue;
        let isEn = chk ? Boolean(chk.checked) : true;
        if (inp) inp.style.opacity = isEn ? '1' : '0.4';
        slots.push({ en: isEn, ext: raw });
    }
    window.appConfig.formatSlots = slots;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.applyFormatFilterToDOM();
    try { await fetch('/api/config/save_single', { method: 'POST', body: JSON.stringify({ category: 'main', key: 'formatSlots', value: slots }) }); } catch (e) {}
    if (triggerReload && typeof window.fetchData === 'function') { await window.fetchData(); window.applyFormatFilterToDOM(); }
};
window.resetFormatSlots = async function(ev) {
    window.appConfig = window.appConfig || {};
    window.appConfig.formatSlots = JSON.parse(JSON.stringify(window.DEFAULT_FORMAT_SLOTS));
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.syncFormatSlotsUI();
    await window.saveFormatSlotsToConfig(true);
    try { navigator.vibrate(35); } catch(e){}
    if (typeof window.showToast === 'function') window.showToast(`🔄 Все базовые форматы (${window.DEFAULT_FORMAT_SLOTS.length}) включены!`, ev);
};
window.installFormatAwareFetchData = function() {
    if (window._fmtListObserverInit) return;
    window._fmtListObserverInit = true;
    const uList = document.getElementById('unifiedList');
    if (uList) { const obs = new MutationObserver(() => window.applyFormatFilterToDOM()); obs.observe(uList, { childList: true }); }
    const np = document.getElementById('nowPlaying');
    if (np) {
        const npObs = new MutationObserver(() => {
            if (window.getLang() === 'en') {
                const c = np.innerText;
                if (c.startsWith('⏳ Загрузка: ')) np.innerText = c.replace('⏳ Загрузка: ', '⏳ Loading: ');
                else if (c.startsWith('⏳ RAM (пока играет сжатый): ')) np.innerText = c.replace('⏳ RAM (пока играет сжатый): ', '⏳ RAM (buffering PCM): ');
                else if (c === '❌ Ошибка загрузки') np.innerText = '❌ Load error';
            }
        });
        npObs.observe(np, { childList: true, characterData: true, subtree: true });
    }
    window.applyFormatFilterToDOM();
};
