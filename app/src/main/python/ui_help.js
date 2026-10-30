window.detectInitialLang = function() {
    window.appConfig = window.appConfig || JSON.parse(localStorage.getItem('ytm_config') || '{}');
    if (window.appConfig.lang === 'ru' || window.appConfig.lang === 'en') return window.appConfig.lang;
    const s = String(navigator.language || navigator.userLanguage || 'en').toLowerCase();
    const d = (s.startsWith('ru') || s.startsWith('uk') || s.startsWith('be')) ? 'ru' : 'en';
    window.appConfig.lang = d;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    return d;
};
window.getLang = function() { return (window.appConfig && window.appConfig.lang) ? window.appConfig.lang : window.detectInitialLang(); };
window.tr = function(ru, en) { return window.getLang() === 'en' ? en : ru; };

window.toggleLanguage = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    window.appConfig = window.appConfig || {};
    window.appConfig.lang = (window.getLang() === 'ru') ? 'en' : 'ru';
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    
    window.applyStaticDOMTranslations();
    window.mountJennyStudioUI();
    if (typeof window.calculateAutoMasterPadDb === 'function') window.calculateAutoMasterPadDb(window.appConfig);
    if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
    window.translateDynamicListPlaceholders();
    if (typeof window.showToast === 'function') window.showToast(window.getLang() === 'en' ? "🇬🇧 Language: English" : "🇷🇺 Язык: Русский", ev);
};

window.localizeCeilingBreakdown = function(rawStr) {
    if (!rawStr) return window.tr('Базовый запас -0.5 dB', 'Base Headroom -0.5 dB');
    if (window.getLang() !== 'en') return rawStr;
    return String(rawStr).replace('Базовый запас -0.5 dB', 'Base Headroom -0.5 dB')
        .replace(/🎯СЧ/g, '🎯Mid').replace(/🐍ВЧ/g, '🐍DeEss').replace(/🥁Панч/g, '🥁Punch').replace(/🎭Стерео/g, '🎭Stereo').replace(/🎧Бин/g, '🎧Bin');
};

(function() {
    const origShowToast = window.showToast;
    if (typeof origShowToast === 'function' && !window._toastI18nWrapped) {
        window._toastI18nWrapped = true;
        window.showToast = function(msg, ev) {
            let out = String(msg || '');
            if (window.getLang() === 'en') {
                const map = {
                    "Что-то одно из двух! 😅": "Pick only one of the two! 😅",
                    "⚠️ Сначала выбери трек!": "⚠️ Select a track first!",
                    "⏳ Рендеринг в OPUS...": "⏳ Rendering to OPUS...",
                    "🔄 Все 8 форматов включены!": "🔄 All 8 formats enabled!",
                    "🔒 Блок управления отключён! Для включения выключите «Фазовый фокус»": "🔒 Manual block locked! Disable 'Phase Focus' to unlock",
                    "🔓 Ручной блок тонкой настройки активен!": "🔓 Manual fine-tuning block unlocked!",
                    "🎭 Стерео ВКЛ (🎧 Бинаурал откл. — что-то одно из двух)": "🎭 Stereo ON (🎧 Binaural OFF — mutually exclusive)",
                    "🎧 Бинаурал ВКЛ (🎭 Стерео откл. — что-то одно из двух)": "🎧 Binaural ON (🎭 Stereo OFF — mutually exclusive)",
                    "🔄 5 опций тракта сброшены!": "🔄 5 DSP path options reset!",
                    "🔄 Модули PRO Studio сброшены!": "🔄 PRO Studio modules reset!"
                };
                if (map[out]) out = map[out];
                else if (out.startsWith("📁 Папка: ")) out = out.replace("📁 Папка: ", "📁 Folder: ");
                else if (out.startsWith("✅ Сохранено: ")) out = out.replace("✅ Сохранено: ", "✅ Saved: ");
            }
            return origShowToast(out, ev);
        };
    }
    const origEnsureInspector = window.ensureTrackInfoModal;
    if (typeof origEnsureInspector === 'function' && !window._inspectorI18nWrapped) {
        window._inspectorI18nWrapped = true;
        window.ensureTrackInfoModal = function() {
            origEnsureInspector();
            const isEn = window.getLang() === 'en';
            const playBtn = document.getElementById('cpPlayBtn');
            const copyBtn = document.getElementById('cpCopyBtn');
            if (playBtn) playBtn.innerText = isEn ? '▶ Play' : '▶ Воспроизвести';
            if (copyBtn) copyBtn.innerText = isEn ? '📋 Copy' : '📋 Копировать';
            const modal = document.getElementById('trackInfoModal');
            if (modal) {
                const ghost = modal.querySelector('.cp-btn-ghost');
                if (ghost) ghost.innerText = isEn ? 'Close' : 'Закрыть';
            }
        };
    }
})();

window.applyStaticDOMTranslations = function() {
    const isEn = (window.getLang() === 'en');
    document.documentElement.lang = isEn ? 'en' : 'ru';
    const folderTrigger = document.getElementById('langSlotWrap') || document.getElementById('folderIconTrigger');
    if (folderTrigger) {
        let langBtn = document.getElementById('mainLangToggleBtn');
        if (!langBtn) {
            langBtn = document.createElement('button');
            langBtn.id = 'mainLangToggleBtn'; langBtn.type = 'button'; langBtn.className = 'jenny-lang-btn';
            langBtn.onclick = (e) => window.toggleLanguage(e);
            (document.getElementById('langSlotWrap') || folderTrigger.parentElement).appendChild(langBtn);
        }
        langBtn.innerHTML = window.renderDualLangHTML ? window.renderDualLangHTML(false) : 'RU / EN';
    }
    const searchInp = document.getElementById('trackSearchInput');
    if (searchInp) searchInp.placeholder = isEn ? '🔍 Search tracks...' : '🔍 Поиск по названию...';
    const nowPlaying = document.getElementById('nowPlaying');
    if (nowPlaying) {
        const cur = nowPlaying.innerText.trim();
        if (cur === 'Выбери трек' || cur === 'Select a track') nowPlaying.innerText = isEn ? 'Select a track' : 'Выбери трек';
        else if (isEn && cur.startsWith('⏳ Загрузка: ')) nowPlaying.innerText = cur.replace('⏳ Загрузка: ', '⏳ Loading: ');
        else if (isEn && cur.startsWith('⏳ RAM (пока играет сжатый): ')) nowPlaying.innerText = cur.replace('⏳ RAM (пока играет сжатый): ', '⏳ RAM (buffering PCM): ');
        else if (cur === '❌ Ошибка загрузки' || cur === '❌ Load error') nowPlaying.innerText = isEn ? '❌ Load error' : '❌ Ошибка загрузки';
    }
    const setChk = (id, ru, en) => {
        const inp = document.getElementById(id);
        if (!inp || !inp.parentElement) return;
        Array.from(inp.parentElement.childNodes).forEach(n => {
            if (n.nodeType === Node.TEXT_NODE && n.nodeValue.trim().length > 0) n.nodeValue = ' ' + (isEn ? en : ru);
        });
    };
    setChk('cfg_studioMode', 'Студийный движок (RAM)', 'Studio Engine (RAM)');
    setChk('cfg_leftHandedMode', '🖐️ Режим "Левша" (Зеркальная дуга)', '🖐️ Left-Handed Mode (Mirror Arc)');
    setChk('cfg_pitchLock', '🎵 Сохранять темп (Pitch Lock)', '🎵 Preserve Pitch (Pitch Lock)');
    setChk('cfg_xNormalSpeed', '🚀 Кастомная скорость (Base)', '🚀 Custom Base Speed');
    setChk('cfg_autoSaveBase', '↳ Писать выбор дуги сюда', '↳ Save arc selection here');
    setChk('cfg_autoSaveScrub', '↳ Писать выбор дуги сюда', '↳ Save arc selection here');
    setChk('cfg_amoledMode', '🖤 Режим AMOLED', '🖤 AMOLED Mode');
    setChk('cfg_volSlider', '🔊 Показывать ползунок громкости', '🔊 Show Volume Slider');
    setChk('cfg_firEnabled', 'Включить FIR', 'Enable FIR');
    setChk('cfg_multiBandEnabled', 'Разделение частот', 'Frequency Split');
    setChk('cfg_limiterEnabled', 'Включить лимитер', 'Enable Limiter');
    setChk('cfg_eqEnabled', 'Активировать EQ', 'Enable EQ');
    setChk('cfg_boosterEnabled', 'Активировать Овердрайв', 'Enable Overdrive');

    const sm = document.getElementById('settingsModal');
    if (sm) {
        sm.querySelectorAll('button').forEach(btn => {
            const t = btn.innerText.trim();
            if (t.includes('ЗАГРУЗИТЬ ВСЁ') || t.includes('LOAD ALL')) {
                btn.innerText = isEn ? '📥 LOAD ALL' : '📥 ЗАГРУЗИТЬ ВСЁ';
                btn.style.background = 'linear-gradient(180deg, #1f6feb 0%, #11469c 100%)'; btn.style.color = '#fff'; btn.style.border = '1px solid #58a6ff';
            } else if (t.includes('СОХРАНИТЬ ВСЁ') || t.includes('SAVE ALL')) {
                btn.innerText = isEn ? '💾 SAVE ALL' : '💾 СОХРАНИТЬ ВСЁ';
                btn.style.background = 'linear-gradient(180deg, #2ea043 0%, #196c2e 100%)'; btn.style.color = '#fff'; btn.style.border = '1px solid #3fb950';
            } else if (t.includes('Сброс') || t.includes('Reset')) {
                btn.innerText = isEn ? '🔄 Reset' : '🔄 Сброс';
            }
        });
        sm.querySelectorAll('.setting-row').forEach(row => {
            if (row.style && row.style.borderLeft) {
                row.style.borderLeft = '3px solid #7341be'; row.style.borderTop = '1px solid #262c36'; row.style.borderRight = '1px solid #262c36'; row.style.borderBottom = '1px solid #262c36';
            }
        });
        const spanPairs = [
            ['Дефолтная скорость дуги:', 'Default arc speed:'], ['Кастомные радиальные зоны:', 'Custom radial zones:'],
            ['Активные расширения в папке:', 'Active folder extensions:'], ['Усиление (Gain):', 'Drive (Gain):'],
            ['Импульс (ms):', 'Impulse (ms):'], ['Отсечка Баса (Hz):', 'Low Crossover (Hz):'],
            ['Отсечка Верх (Hz):', 'High Crossover (Hz):'], ['Порог (dB):', 'Threshold (dB):'],
            ['Смягчение (Knee):', 'Soft Knee (dB):'], ['Сжатие (Ratio):', 'Ratio:'],
            ['Атака (ms):', 'Attack (ms):'], ['Спад (ms):', 'Release (ms):'], ['Мощность (1-20):', 'Boost Power (1-20):']
        ];
        sm.querySelectorAll('span').forEach(sp => {
            const txt = sp.innerText.trim();
            spanPairs.forEach(([ru, en]) => { if (txt === ru || txt === en) sp.innerText = isEn ? en : ru; });
        });
        const sumPairs = [
            ['Интеллектуальный Скраббинг', 'Smart Scrubbing', '⚡ '], ['Форматы файлов (Аудио + MP4)', 'File Formats (Audio + MP4)', '🎵 '],
            ['FIR-Сатуратор (Ламповый окрас)', 'FIR Saturator (Tube Warmth)', '✨ '], ['Многополосный кроссовер (3-Band)', 'Multiband Crossover (3-Band)', '🎚️ '],
            ['Лимитер (Soft Clipper)', 'Limiter (Soft Clipper)', '🗜️ '], ['Эквалайзер (EQ IIR)', 'Equalizer (5-Band IIR)', '🎛️ '],
            ['Усилитель (Овердрайв)', 'Preamp Booster (Overdrive)', '🚀 ']
        ];
        sm.querySelectorAll('summary').forEach(sum => {
            const raw = sum.innerText;
            sumPairs.forEach(([ru, en, icon]) => {
                if (raw.includes(ru) || raw.includes(en)) {
                    const fs = sum.querySelector('span:not(.jenny-help-badge)');
                    if (fs) fs.innerText = icon + (isEn ? en : ru);
                    else Array.from(sum.childNodes).forEach(n => { if (n.nodeType === Node.TEXT_NODE && n.nodeValue.trim()) n.nodeValue = icon + (isEn ? en : ru); });
                }
            });
        });
    }
};

window.translateDynamicListPlaceholders = function() {
    const isEn = (window.getLang() === 'en');
    const uList = document.getElementById('unifiedList');
    if (uList && uList.children.length === 1) {
        const d = uList.firstElementChild; const t = (d.innerText || '').trim();
        if (t === 'Загрузка...' || t === 'Loading...') d.innerText = isEn ? 'Loading...' : 'Загрузка...';
        if (t === 'Папка с музыкой пуста' || t === 'Music folder is empty') d.innerText = isEn ? 'Music folder is empty' : 'Папка с музыкой пуста';
    }
    const fList = document.getElementById('favList');
    if (fList && fList.children.length === 1) {
        const d = fList.firstElementChild; const t = (d.innerText || '').trim();
        if (t === 'Пусто' || t === 'Empty') d.innerText = isEn ? 'Empty' : 'Пусто';
    }
};

window.DEFAULT_FORMAT_SLOTS = [
    { en: true, ext: '.mp3' }, { en: true, ext: '.opus' }, { en: true, ext: '.m4a' }, { en: true, ext: '.flac' },
    { en: true, ext: '.wav' }, { en: true, ext: '.ogg' }, { en: true, ext: '.mp4' }, { en: true, ext: '.aac' }
];
window.getFormatSlotsConfig = function() {
    window.appConfig = window.appConfig || {};
    if (!Array.isArray(window.appConfig.formatSlots) || window.appConfig.formatSlots.length !== 8) {
        window.appConfig.formatSlots = JSON.parse(JSON.stringify(window.DEFAULT_FORMAT_SLOTS));
    }
    return window.appConfig.formatSlots;
};
window.syncFormatSlotsUI = function() {
    const slots = window.getFormatSlotsConfig();
    for (let i = 0; i < 8; i++) {
        const chk = document.getElementById(`cfg_fmt_${i+1}_en`); const inp = document.getElementById(`cfg_fmt_${i+1}_val`);
        const s = slots[i] || window.DEFAULT_FORMAT_SLOTS[i];
        if (chk) chk.checked = Boolean(s.en);
        if (inp) {
            let c = String(s.ext || '').trim(); if (c && !c.startsWith('.')) c = '.' + c;
            inp.value = c; inp.style.opacity = s.en ? '1' : '0.4';
        }
    }
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
    rows.forEach(row => {
        const txt = (row.innerText || '').trim();
        if (!txt || txt.includes('Загрузка...') || txt.includes('Loading...') || txt.includes('Папка с музыкой пуста') || txt.includes('Music folder is empty')) return;
        const allowed = window.isTrackAllowedByFormatSlots(txt);
        row.style.display = allowed ? '' : 'none';
        if (allowed) visibleCount++;
    });
    const cnt = document.getElementById('tracksCount');
    if (cnt && rows.length > 0) cnt.innerText = visibleCount;
};
window.saveFormatSlotsToConfig = async function(triggerReload) {
    window.appConfig = window.appConfig || {};
    const slots = [];
    for (let i = 0; i < 8; i++) {
        const chk = document.getElementById(`cfg_fmt_${i+1}_en`); const inp = document.getElementById(`cfg_fmt_${i+1}_val`);
        let raw = inp ? inp.value.trim().toLowerCase() : window.DEFAULT_FORMAT_SLOTS[i].ext;
        if (raw && !raw.startsWith('.')) raw = '.' + raw;
        let isEn = chk ? Boolean(chk.checked) : true;
        if (inp) inp.style.opacity = isEn ? '1' : '0.4';
        slots.push({ en: isEn, ext: raw || window.DEFAULT_FORMAT_SLOTS[i].ext });
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
    if (typeof window.showToast === 'function') window.showToast("🔄 Все 8 форматов включены!", ev);
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
        barWrap.style.display = ''; barWrap.style.paddingTop = '15px'; searchInput.style.display = ''; monEl.style.display = 'none';
    } else {
        searchInput.style.display = 'none';
        if (ceilOn) {
            barWrap.style.display = ''; barWrap.style.paddingTop = '12px'; monEl.style.display = 'block';
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
        wrap.style.filter = cfg.phaseFixEnabled ? 'grayscale(100%)' : 'none';
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
window.JENNY_HELP_DB_RU = {
    format_slots: { title: "🎵 Поддерживаемые форматы файлов (8 слотов)", phys: "Фильтр расширений сканера папки (<b>mp3, opus, flac, wav, m4a, ogg, aac, mp4</b>).", hear: "Любой включённый формат распаковывается напрямую в 32-bit Float RAM-движок и проходит через весь студийный тракт.", tip: "Галочками можно быстро скрыть или показать нужные типы файлов в плейлисте." },
    studio_ram: { title: "🚀 Студийный движок (RAM)", phys: "Трек целиком распаковывается в RAM в формат <b>32-bit Float PCM</b> + сразу создаётся его реверс-буфер.", hear: "Мгновенная перемотка, скраббинг и реверс без задержек.", tip: "Держи включённым всегда («RAM 🚀»)." },
    phase_focus: { title: "🎯 Фазовый фокус (Авто-пресет 3D + Вокал)", phys: "Включает противофазный стерео-хвост в FIR, разворачивает фазу СЧ (+1.7 dB) и включает авто-потолок.", hear: "Голос выходит вперёд из-под баса, а сцена расширяется вокруг головы.", tip: "При включении ручной блок из 5 опций ниже блокируется." },
    mod_block: { title: "🧪 Тонкая настройка тракта (5 опций)", phys: "Ручной конструктор фазы вокала (dB), ширины СЧ купола (%), де-эссера ВЧ (dB), чистого FIR-драйва (dB) и авто-потолка.", hear: "Работает, когда галочка «🎯 Фазовый фокус» снята.", tip: "Сохраняется кнопкой 💾 или сбрасывается кнопкой «🔄 Сброс»." },
    mod_midPhase: { title: "🎯 Фаза СЧ Вокал (dB)", phys: "Синхронизирует фазу СЧ-полосы с басом и добавляет усиление в <b>dB</b>.", hear: "Вокал сразу делает шаг вперёд прямо к лицу.", tip: "По умолчанию <b>+3 dB</b> (диапазон +2...+8 dB)." },
    mod_midQ: { title: "📐 Ширина СЧ купола (%)", phys: "Управляет шириной полосового фильтра средней полосы кроссовера (100% — штатная).", hear: "Убирает коробочный оттенок и делает стыки полос бархатными.", tip: "По умолчанию <b>150%</b> (для широкой середины ставь 200%–300%)." },
    mod_deEsser: { title: "🐍 Де-эссер ВЧ (dB)", phys: "Снижает сжатие верхов до 4:1 и меняет уровень ВЧ-полосы в <b>dB</b>.", hear: "Убирает режущий свист на буквах «С» и «Ш» без потери баса.", tip: "По умолчанию <b>-6 dB</b>." },
    mod_cleanFir: { title: "✨ Драйв Чистый FIR (dB)", phys: "Гладкая биполярная кривая FIR-сатуратора с окном Хэннинга без накопления гула.", hear: "Бас становится сухим, быстрым и упругим с ламповым рычанием.", tip: "По умолчанию <b>+3 dB</b>." },
    mod_masterCeil: { title: "🛡️ Авто-Мастер-Потолок (Умный Анти-Клип)", phys: "Суммирует разгон от всех модулей, вычисляет компенсацию в <b>dB</b> и включает мягкий софт-клиппер <b>Math.tanh</b>.", hear: "Полностью защищает от цифрового клиппинга и хрипа.", tip: "Держи включённым всегда!" },
    pro_block: { title: "🚀 Мастеринг-Студия PRO (5 спец-модулей)", phys: "Пять студийных процессоров в реальных физических единицах (<b>dB, Hz, %</b>).", hear: "Выравнивают RMS громкость, собирают саб-бас в центр, дают 3D-сцену, панч бочки и бинауральную комнату.", tip: "Учитываются Авто-Потолком и впечатываются при экспорте (💾)!" },
    pro_autoRms: { title: "⚡ Авто-RMS Цель (dB)", phys: "Сканирует сэмплы песни в RAM и автоматически выравнивает среднюю плотность (RMS) под эталон.", hear: "Тихие и громкие треки звучат с одинаковой плотностью и мощью!", tip: "По умолчанию <b>-10 dB</b>." },
    pro_monoBass: { title: "🧲 Моно-Саббас (Hz)", phys: "Через Mid/Side матрицу собирает весь саб-бас ниже указанной частоты <b>Hz</b> в идеальный центр (L = R).", hear: "Бочка бьёт плотным кулаком ровно в центр головы.", tip: "По умолчанию <b>120 Hz</b>." },
    pro_msWidth: { title: "🎭 Стерео-Ширина (%)", phys: "Mid/Side матрица + 2-полосный боковой эксайтер (135 Гц + 8500 Гц) + 90° All-Pass декореллятор.", hear: "Создаёт голографический 3D-купол вокруг плеч без потери баса!", tip: "По умолчанию <b>160%</b>." },
    pro_punch: { title: "🥁 Панч-Хлыст (dB)", phys: "3-точечный шейпер: усиливает пинок бочки (85 Гц), убирает муть (230 Гц) и подчёркивает атаку снейра (2600 Гц).", hear: "Заставляет ударные физически пробивать микс.", tip: "По умолчанию <b>+6 dB</b>." },
    pro_crossfeed: { title: "🎧 Бинаурал-Колонки (%)", phys: "Имитирует акустику колонок в комнате с задержкой огибания головы (0.42 мс) и фильтром (650 Гц).", hear: "Убирает вакуум в голове и выносит сцену перед лицом.", tip: "По умолчанию <b>75%</b>." },
    scrub_group: { title: "⚡ Интеллектуальный Скраббинг и Таймеры", phys: "Управление скоростью, реверсом и перемоткой одним пальцем.", hear: "Удержание края полосы + свайп вниз — веер скоростей; тап по левому таймеру — реверс, по правому — вперёд.", tip: "Долгий тап по Play/Pause прокручивает список к текущему треку!" },
    left_hand: { title: "🖐️ Режим «Левша»", phys: "Зеркально переносит дугу скоростей под левую руку.", hear: "Удобный свайп большим пальцем левой руки.", tip: "Переключается мгновенно." },
    pitch_lock: { title: "🎵 Сохранять темп (Pitch Lock)", phys: "Алгоритм сохранения высоты тона при изменении скорости.", hear: "ВКЛ: родной тембр голоса. ВЫКЛ: виниловый Slowed-эффект.", tip: "Работает и при экспорте трека (💾)." },
    base_speed: { title: "🚀 Кастомная скорость (Base)", phys: "Заменяет стандартную скорость 1.0x на твою постоянную.", hear: "Например, 0.97x даёт расслабленный тяжёлый грув.", tip: "Можно авто-сохранять с дуги." },
    scrub_speed: { title: "⏩ Дефолтная скорость дуги", phys: "Скорость при зажатии края полосы до свайпа по дуге.", hear: "Мгновенное ускорение или замедление в одно касание.", tip: "Обновляется с дуги." },
    scrub_zones: { title: "🎯 Кастомные радиальные зоны", phys: "6 слотов скоростей веера.", hear: "Настрой свои любимые скорости.", tip: "Кнопка «🔄 Сброс» возвращает эталон." },
    amoled_mode: { title: "🖤 Режим AMOLED", phys: "Чистый чёрный фон (#000000).", hear: "Экономит заряд экрана и бережёт глаза.", tip: "Держи включённым." },
    vol_slider: { title: "🔊 Показывать ползунок громкости", phys: "Иконка динамика 🔊 / 🔥 на главном экране.", hear: "Предусилитель громкости до 300%.", tip: "Выше 100% загорается 🔥." },
    fir_group: { title: "✨ FIR-Сатуратор", phys: "Свёрточный ламповый сатуратор гармоник.", hear: "Делает звук густым, тёплым и массивным.", tip: "Настраивается Gain и Impulse (ms)." },
    fir_gain: { title: "✨ FIR: Усиление (Gain)", phys: "Мощность сигнала на выходе FIR.", hear: "Оптимум 1.5–2.5 для плотной накачки.", tip: "Сохраняется кнопкой 💾." },
    fir_decay: { title: "✨ FIR: Импульс (ms)", phys: "Длина хвоста сатурации в мс.", hear: "2–6 ms: чёткий удар; 10–30 ms: клубный объём.", tip: "Включай «Драйв Чистый FIR» против гула." },
    mb_group: { title: "🎚️ Многополосный кроссовер (3-Band)", phys: "Делит спектр на Бас, Середину и Верх с независимой компрессией.", hear: "Мощный бас не просаживает вокал и тарелки.", tip: "Работает в паре с Лимитером." },
    mb_low: { title: "🎚️ Отсечка Баса (Hz)", phys: "Граница между басом и серединой.", hear: "160–320 Hz отделяют саб-бас от голоса; 1600 Hz даёт слитный памп.", tip: "Вокал защищён от басового гула." },
    mb_high: { title: "🎚️ Отсечка Верх (Hz)", phys: "Граница между серединой и верхами.", hear: "3600–7200 Hz определяют зону блеска и тарелок.", tip: "Выше Отсечки Баса." },
    lim_group: { title: "🗜️ Лимитер (Soft Clipper)", phys: "Динамический пресс пиков.", hear: "Даёт плотный студийный напор.", tip: "Эталон: -22, 19, 22, 26, 60." },
    lim_thresh: { title: "🗜️ Порог (dB)", phys: "Уровень включения компрессии.", hear: "-22 dB даёт глубокий захват волны.", tip: "Диапазон -15...-26 dB." },
    lim_knee: { title: "🗜️ Смягчение (Knee)", phys: "Плавность колена компрессии.", hear: "18–22 делает сжатие мягким.", tip: "Убирает резкость." },
    lim_ratio: { title: "🗜️ Сжатие (Ratio)", phys: "Сила удержания пиков.", hear: "18–22 вытягивает тихие детали.", tip: "Держи 16–22." },
    lim_attack: { title: "🗜️ Атака (ms)", phys: "Время пропуска стартового удара бочки.", hear: "26 ms сохраняют хлёсткий удар.", tip: "Оптимум 20–30 ms." },
    lim_release: { title: "🗜️ Спад (ms)", phys: "Время восстановления после пика.", hear: "60 ms дают упругий кач в такт.", tip: "Оптимум 50–70 ms." },
    eq_group: { title: "🎛️ Эквалайзер (EQ IIR)", phys: "Включает 5-полосный эквалайзер 🄠.", hear: "Быстрое сравнение звука с EQ и без.", tip: "Ползунки под кнопкой 🄠." },
    boost_group: { title: "🚀 Усилитель (Овердрайв)", phys: "Разгон громкости выше 100%.", hear: "Экстремальная накачка входа лимитера.", tip: "Мощность 5 = 150%, 20 = 300%." },
    eq_band_60: { title: "🔊 60 Гц — Саб-бас", phys: "Шельф низких частот.", hear: "Глубокая вибрация сабвуфера.", tip: "Основа баса." },
    eq_band_230: { title: "🎸 230 Гц — Мид-бас", phys: "Нижняя середина.", hear: "Минус убирает бубнёж, плюс даёт густоту.", tip: "Чистит микс." },
    eq_band_910: { title: "🎤 910 Гц — Центр вокала", phys: "Основа голоса.", hear: "Плюс приближает вокал к лицу.", tip: "Главный руль голоса." },
    eq_band_3600: { title: "⚡ 3600 Гц — Чёткость", phys: "Разборчивость речи и атака.", hear: "Плюс даёт ясность, минус смягчает резкость.", tip: "Контроль присутствия." },
    eq_band_14000: { title: "✨ 14 000 Гц — Воздух", phys: "Верхний шельф блеска.", hear: "Добавляет прозрачность и рассыпчатые тарелки.", tip: "Hi-Fi воздух." }
};

window.JENNY_HELP_DB_EN = {
    format_slots: { title: "🎵 Supported File Formats (8 Slots)", phys: "Folder scanner filter (<b>mp3, opus, flac, wav, m4a, ogg, aac, mp4</b>).", hear: "Every enabled format decodes straight into the 32-bit Float RAM engine and flows through the full DSP chain.", tip: "Toggle checkboxes to instantly filter file types in your playlist." },
    studio_ram: { title: "🚀 Studio Engine (RAM)", phys: "Unpacks the entire track into RAM as <b>32-bit Float PCM</b> + pre-builds a reverse buffer.", hear: "Zero-latency seeking, live scrubbing, and instant reverse playback.", tip: "Keep enabled at all times ('RAM 🚀')." },
    phase_focus: { title: "🎯 Phase Focus (Auto 3D + Vocal Preset)", phys: "Engages out-of-phase stereo FIR tail, aligns midrange phase (+1.7 dB), and locks Auto-Master Ceiling.", hear: "Vocals step forward out of the bass while the soundstage expands around your head.", tip: "Locks the 5 manual controls below when active." },
    mod_block: { title: "🧪 Signal Path Fine-Tuning (5 Options)", phys: "Manual toolkit for Vocal Mid Gain (dB), Mid Dome Width (%), HF De-Esser (dB), Clean FIR Drive (dB), and Auto-Ceiling.", hear: "Active when '🎯 Phase Focus' is unchecked.", tip: "Save with 💾 or restore defaults with '🔄 Reset'." },
    mod_midPhase: { title: "🎯 Vocal Mid Gain (dB)", phys: "Aligns midrange crossover phase with bass and applies gain in <b>dB</b>.", hear: "Vocals immediately step right up to your face.", tip: "Default is <b>+3 dB</b> (+2...+8 dB range)." },
    mod_midQ: { title: "📐 Mid Dome Width (%)", phys: "Controls midrange crossover filter bandwidth (100% = stock).", hear: "Removes boxy resonances and makes band transitions silky smooth.", tip: "Default is <b>150%</b> (use 200%–300% for wide-open mids)." },
    mod_deEsser: { title: "🐍 HF De-Esser (dB)", phys: "Relaxes high-band ratio to 4:1 and adjusts treble gain in <b>dB</b>.", hear: "Tames harsh 'S' and 'SH' sibilance under heavy limiting without losing bass.", tip: "Default is <b>-6 dB</b>." },
    mod_cleanFir: { title: "✨ Clean FIR Drive (dB)", phys: "Smooth bipolar Hanning-windowed FIR impulse curve with zero low-end mud buildup.", hear: "Tight, fast, punchy bass with warm tube harmonic growl.", tip: "Default is <b>+3 dB</b>." },
    mod_masterCeil: { title: "🛡️ Auto-Master Ceiling (Smart Anti-Clip)", phys: "Sums up gain boosts across all active modules, computes exact attenuation in <b>dB</b>, and feeds an analog <b>Math.tanh</b> soft-clipper.", hear: "Completely prevents digital clipping or distortion under extreme settings.", tip: "Keep enabled at all times!" },
    pro_block: { title: "🚀 Mastering Studio PRO (5 Spec-Modules)", phys: "Five studio processors in true physical units (<b>dB, Hz, %</b>).", hear: "Normalizes RMS loudness, locks sub-bass dead center, builds a 3D stage, adds drum punch, and simulates room monitors.", tip: "Tracked by Auto-Ceiling and baked into exported files (💾)!" },
    pro_autoRms: { title: "⚡ Auto-RMS Target (dB)", phys: "Scans track PCM samples in RAM and matches average loudness (RMS) to your target reference.", hear: "Quiet vintage tracks and loud modern masters play with consistent density!", tip: "Default is <b>-10 dB</b>." },
    pro_monoBass: { title: "🧲 Mono Sub-Bass (Hz)", phys: "Uses a phase-coherent Mid/Side matrix to lock sub-bass below <b>Hz</b> dead center (L = R).", hear: "Kick drums hit like a tight fist right in the center of your head.", tip: "Default is <b>120 Hz</b>." },
    pro_msWidth: { title: "🎭 Stereo Width (%)", phys: "Mid/Side matrix + 2-band Side Exciter (135 Hz + 8500 Hz) + 90° All-Pass phase decorrelator.", hear: "Creates a huge 3D holographic dome around your shoulders with full center bass!", tip: "Default is <b>160%</b>." },
    pro_punch: { title: "🥁 Punch Whip (dB)", phys: "3-point transient shaper: boosts kick body (85 Hz), cuts mud (230 Hz), and snaps snare attack (2600 Hz).", hear: "Makes drums physically kick through the mix.", tip: "Default is <b>+6 dB</b>." },
    pro_crossfeed: { title: "🎧 Binaural Speakers (%)", phys: "Simulates studio monitors in a room with head-shadow delay (0.42 ms) and low-pass filter (650 Hz).", hear: "Eliminates fatiguing in-head isolation and projects the stage in front of you.", tip: "Default is <b>75%</b>." },
    scrub_group: { title: "⚡ Smart Scrubbing & Timers", phys: "One-thumb live speed, direction, and seek control.", hear: "Hold seekbar edge + swipe down for radial speed fan; tap left timer for reverse, right timer for forward.", tip: "Long-press Play/Pause to scroll to the active track!" },
    left_hand: { title: "🖐️ Left-Handed Mode", phys: "Mirrors the radial speed arc to the left side.", hear: "Effortless left-thumb scrubbing.", tip: "Switches instantly." },
    pitch_lock: { title: "🎵 Preserve Pitch (Pitch Lock)", phys: "Time-stretching vs. vinyl pitch algorithm.", hear: "ON: keeps original vocal pitch. OFF: deep vinyl Slowed effect.", tip: "Also applies when exporting tracks (💾)." },
    base_speed: { title: "🚀 Custom Base Speed", phys: "Overrides standard 1.0x speed with your custom default.", hear: "E.g. 0.97x gives a heavier groove.", tip: "Can auto-save from radial arc." },
    scrub_speed: { title: "⏩ Default Arc Speed", phys: "Initial speed when holding the seekbar edge.", hear: "Instant one-touch speed boost or slowdown.", tip: "Updates from radial arc." },
    scrub_zones: { title: "🎯 Custom Radial Zones", phys: "6 speed bubbles fanned out on swipe.", hear: "Customize your favorite speeds.", tip: "Hit '🔄 Reset' for defaults." },
    amoled_mode: { title: "🖤 AMOLED Mode", phys: "Pure black (#000000) background.", hear: "Saves battery and reduces eye strain.", tip: "Keep ON." },
    vol_slider: { title: "🔊 Show Volume Slider", phys: "Speaker icon 🔊 / 🔥 on the main bar.", hear: "Digital preamp gain up to 300%.", tip: "Turns into 🔥 above 100%." },
    fir_group: { title: "✨ FIR Saturator", phys: "Convolver tube harmonic saturator.", hear: "Makes audio thick, warm, and weighty.", tip: "Controlled by Gain and Impulse (ms)." },
    fir_gain: { title: "✨ FIR: Drive (Gain)", phys: "FIR stage output gain.", hear: "Sweet spot 1.5–2.5 for dense saturation.", tip: "Save with 💾." },
    fir_decay: { title: "✨ FIR: Impulse (ms)", phys: "Micro-saturation tail length in ms.", hear: "2–6 ms: tight punch; 10–30 ms: club body.", tip: "Enable 'Clean FIR Drive' for zero mud." },
    mb_group: { title: "🎚️ Multiband Crossover (3-Band)", phys: "Splits audio into Low, Mid, and High bands with independent compression.", hear: "Heavy bass kicks never duck vocals or hi-hats.", tip: "Works with the Limiter." },
    mb_low: { title: "🎚️ Low Crossover (Hz)", phys: "Split between bass and midrange.", hear: "160–320 Hz separates sub-bass from vocals; 1600 Hz gives club pump.", tip: "Vocal band is protected from bass bleed." },
    mb_high: { title: "🎚️ High Crossover (Hz)", phys: "Split between midrange and treble.", hear: "3600–7200 Hz controls top-end air and sparkle.", tip: "Higher than Low Crossover." },
    lim_group: { title: "🗜️ Limiter (Soft Clipper)", phys: "Dynamic peak compressor.", hear: "Delivers hard-hitting club pressure.", tip: "Reference preset: -22, 19, 22, 26, 60." },
    lim_thresh: { title: "🗜️ Threshold (dB)", phys: "Compression engagement level.", hear: "-22 dB grabs deep into the waveform.", tip: "Range: -15 to -26 dB." },
    lim_knee: { title: "🗜️ Soft Knee (dB)", phys: "Compression curve smoothness.", hear: "18–22 makes limiting musical and smooth.", tip: "Removes harshness." },
    lim_ratio: { title: "🗜️ Ratio", phys: "Peak reduction strength.", hear: "18–22 locks levels and lifts quiet details.", tip: "Keep at 16–22." },
    lim_attack: { title: "🗜️ Attack (ms)", phys: "Transient pass-through time.", hear: "26 ms preserves drum snap.", tip: "Sweet spot: 20–30 ms." },
    lim_release: { title: "🗜️ Release (ms)", phys: "Recovery time after peaks.", hear: "60 ms creates a bouncy groove.", tip: "Sweet spot: 50–70 ms." },
    eq_group: { title: "🎛️ Equalizer (5-Band IIR)", phys: "Enables the 5-band EQ in 🄠.", hear: "Instant A/B comparison.", tip: "Sliders are under 🄠." },
    boost_group: { title: "🚀 Preamp Booster (Overdrive)", phys: "Extends volume above 100%.", hear: "Drives the limiter harder.", tip: "Power 5 = 150%, 20 = 300%." },
    eq_band_60: { title: "🔊 60 Hz — Sub-Bass", phys: "Low-shelf filter.", hear: "Deep subwoofer rumble.", tip: "Bass foundation." },
    eq_band_230: { title: "🎸 230 Hz — Mid-Bass", phys: "Lower midrange bell.", hear: "Cut to remove mud, boost for body.", tip: "Cleans up the mix." },
    eq_band_910: { title: "🎤 910 Hz — Vocal Core", phys: "Vocal fundamental zone.", hear: "Boost to bring vocals closer.", tip: "Main vocal fader." },
    eq_band_3600: { title: "⚡ 3600 Hz — Clarity", phys: "Articulation and transient snap.", hear: "Boost for clarity, cut to reduce harshness.", tip: "Presence control." },
    eq_band_14000: { title: "✨ 14,000 Hz — Air", phys: "High-shelf treble filter.", hear: "Adds transparent air and shimmering cymbals.", tip: "Hi-Fi openness." }
};

window.getHelpDB = function() { return window.getLang() === 'en' ? window.JENNY_HELP_DB_EN : window.JENNY_HELP_DB_RU; };
window.JENNY_HELP_DB = window.JENNY_HELP_DB_RU;

window.ensureHelpModal = function() {
    let m = document.getElementById('jennyHelpModal'); if (m) m.remove();
    m = document.createElement('div'); m.id = 'jennyHelpModal';
    m.style.cssText = "display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.82);backdrop-filter:blur(5px);align-items:center;justify-content:center;padding:16px;box-sizing:border-box;";
    m.onclick = (e) => { if (e.target === m) m.style.display = 'none'; };
    m.innerHTML = `<div onclick="event.stopPropagation()" style="background:#0d1117;border:1px solid #7341be;border-radius:14px;max-width:440px;width:100%;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.95);overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#161b22;border-bottom:1px solid #30363d;">
            <span id="jhTitle" style="color:#58a6ff;font-weight:bold;font-size:15px;">📖 ${window.tr('Справка', 'Help Guide')}</span>
            <button onclick="document.getElementById('jennyHelpModal').style.display='none'" style="background:transparent;border:none;color:#8b949e;font-size:18px;cursor:pointer;padding:2px 6px;box-shadow:none;">✖</button>
        </div>
        <div id="jhBody" style="padding:14px 16px;overflow-y:auto;color:#e6edf3;font-size:13.5px;line-height:1.5;display:flex;flex-direction:column;gap:10px;"></div>
        <div style="padding:10px 16px;background:#161b22;border-top:1px solid #30363d;display:flex;justify-content:flex-end;">
            <button onclick="document.getElementById('jennyHelpModal').style.display='none'" style="background:#238636;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-weight:bold;font-size:13px;cursor:pointer;">${window.tr('Понятно 👍', 'Got it 👍')}</button>
        </div></div>`;
    document.body.appendChild(m);
};

window.showHelpTopic = function(key, ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    try { navigator.vibrate(20); } catch(e){}
    window.ensureHelpModal();
    const item = window.getHelpDB()[key] || window.JENNY_HELP_DB_RU[key];
    if (!item) return;
    document.getElementById('jhTitle').innerHTML = item.title;
    document.getElementById('jhBody').innerHTML = `
        <div style="background:#161b22;border-left:3px solid #58a6ff;padding:10px 12px;border-radius:6px;"><div style="color:#58a6ff;font-size:11px;font-weight:bold;margin-bottom:4px;">🔧 ${window.tr('ФИЗИКА НА ПАЛЬЦАХ:', 'HOW IT WORKS:')}</div><div>${item.phys}</div></div>
        <div style="background:#161b22;border-left:3px solid #3fb950;padding:10px 12px;border-radius:6px;"><div style="color:#3fb950;font-size:11px;font-weight:bold;margin-bottom:4px;">🎧 ${window.tr('ЧТО МЕНЯЕТСЯ НА СЛУХ:', 'WHAT YOU HEAR:')}</div><div>${item.hear}</div></div>
        <div style="background:#1f1633;border-left:3px solid #a371f7;padding:10px 12px;border-radius:6px;"><div style="color:#d2a8ff;font-size:11px;font-weight:bold;margin-bottom:4px;">💡 ${window.tr('ШПАРГАЛКА:', 'PRO TIP:')}</div><div>${item.tip}</div></div>`;
    document.getElementById('jennyHelpModal').style.display = 'flex';
};

window.showFullHelpGuide = function(ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    try { navigator.vibrate(25); } catch(e){}
    window.ensureHelpModal();
    document.getElementById('jhTitle').innerHTML = window.tr("📖 Полный справочник Jenny Player", "📖 Jenny Player Full Manual");
    document.getElementById('jhBody').innerHTML = Object.values(window.getHelpDB()).map(item => `
        <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:10px 12px;">
            <div style="color:#58a6ff;font-weight:bold;font-size:14px;margin-bottom:6px;">${item.title}</div>
            <div style="margin-bottom:5px;color:#c9d1d9;"><b style="color:#79c0ff;">${window.tr('Физика:', 'Physics:')}</b> ${item.phys}</div>
            <div style="margin-bottom:5px;color:#c9d1d9;"><b style="color:#56d364;">${window.tr('На слух:', 'Sound:')}</b> ${item.hear}</div>
            <div style="color:#d2a8ff;font-size:12.5px;"><b>💡 ${window.tr('Совет:', 'Tip:')}</b> ${item.tip}</div>
        </div>`).join('');
    document.getElementById('jennyHelpModal').style.display = 'flex';
};

window.makeHelpBadge = function(topicKey) {
    const b = document.createElement('span'); b.className = 'jenny-help-badge'; b.innerHTML = '❓';
    b.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11.5px;margin-left:6px;cursor:pointer;flex-shrink:0;user-select:none;";
    b.onclick = (e) => window.showHelpTopic(topicKey, e);
    return b;
};

window.mountJennyStudioUI = function() {
    window.detectInitialLang();
    window.applyStaticDOMTranslations();
    const sm = document.getElementById('settingsModal'); if (!sm) return;
    const container = sm.querySelector('.container') || sm;
    ['phaseFocusMasterCard', 'dspModularSection', 'dspProStudioSection', 'jennyFullGuideBtn', 'jennyTopBarRow', 'dspModularBox'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
    document.querySelectorAll('.jenny-help-badge, .eq-band-hdr').forEach(el => el.remove());

    const topBarRow = document.createElement('div'); topBarRow.id = 'jennyTopBarRow';
    topBarRow.style.cssText = "display:flex;gap:8px;margin-bottom:12px;align-items:stretch;";
    const guideBtn = document.createElement('button'); guideBtn.id = 'jennyFullGuideBtn'; guideBtn.type = 'button';
    guideBtn.onclick = (e) => window.showFullHelpGuide(e);
    guideBtn.style.cssText = "flex:1;background:#161b22;border:1px solid #7341be;color:#d2a8ff;font-weight:bold;padding:11px;border-radius:8px;font-size:12.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 0 10px rgba(115,65,190,0.25);";
    guideBtn.innerHTML = window.tr("📖 СПРАВОЧНИК НАСТРОЕК (❓)", "📖 FULL DSP MANUAL (❓)");
    const langSwitchBtn = document.createElement('button'); langSwitchBtn.type = 'button';
    langSwitchBtn.onclick = (e) => window.toggleLanguage(e);
    langSwitchBtn.style.cssText = "background:#161b22;border:1px solid #58a6ff;color:#58a6ff;font-weight:bold;padding:0 14px;border-radius:8px;font-size:12.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;";
    langSwitchBtn.innerHTML = window.getLang() === 'en' ? '🌐 EN' : '🌐 RU';
    topBarRow.appendChild(guideBtn); topBarRow.appendChild(langSwitchBtn);
    container.insertBefore(topBarRow, container.firstChild);

    const studioInput = document.getElementById('cfg_studioMode');
    const ramCard = studioInput ? studioInput.closest('.setting-row') : null;
    const pfCard = document.createElement('div'); pfCard.id = 'phaseFocusMasterCard'; pfCard.className = 'setting-row';
    pfCard.style.cssText = "background:var(--bg-setting-box);padding:10px;border-radius:6px;margin-bottom:12px;border:1px solid #262c36;border-left:3px solid #7341be;display:flex;align-items:center;justify-content:space-between;";
    pfCard.innerHTML = `<label class="toggle-label" style="color:#e6edf3;font-weight:bold;flex:1;"><input type="checkbox" id="cfg_phaseFix" onchange="window.onPhaseFocusChange(this, event)"> ${window.tr('🎯 Фазовый фокус (Выравнивание вокала и баса)', '🎯 Phase Focus (Vocal & Bass Alignment)')}</label>`;
    pfCard.appendChild(window.makeHelpBadge('phase_focus'));

    const buildRowsHTML = (rowsArr) => rowsArr.map(([k, lbl, stp, hKey]) => {
        if (k === 'masterCeil') {
            return `<div class="setting-row" style="border:none;padding:6px 0;gap:6px;"><div style="display:flex;align-items:center;flex:1;min-width:0;"><label class="toggle-label" style="color:#e6edf3;font-size:12.5px;margin:0;"><input type="checkbox" id="cfg_opt_masterCeil" onchange="window.onDspModChange('masterCeil')"> ${window.tr('🛡️ Авто-Мастер-Потолок:', '🛡️ Auto-Master Ceiling:')}</label><span class="jenny-help-badge" onclick="window.showHelpTopic('${hKey}', event)" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;margin-left:5px;cursor:pointer;flex-shrink:0;">❓</span></div><span id="autoCeilStatusBadge" style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:4px 10px;font-size:11.5px;font-weight:bold;color:#3fb950;flex-shrink:0;">${window.tr('Авто', 'Auto')}: -0.5 dB</span></div>`;
        }
        return `<div class="setting-row" style="border:none;padding:4px 0;gap:6px;"><div style="display:flex;align-items:center;flex:1;min-width:0;"><label class="toggle-label" style="color:#e6edf3;font-size:12.5px;margin:0;"><input type="checkbox" id="cfg_opt_${k}" onchange="window.onDspModChange('${k}', event)"> ${lbl}</label><span class="jenny-help-badge" onclick="window.showHelpTopic('${hKey}', event)" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;margin-left:5px;cursor:pointer;flex-shrink:0;">❓</span></div><div style="display:flex;gap:4px;align-items:center;flex-shrink:0;"><button type="button" class="io-btn" onclick="window.loadDspModRow('${k}', this, event)">📥</button><input type="number" step="${stp}" id="cfg_val_${k}" oninput="window.onDspModChange('${k}')" style="width:52px;"><button type="button" class="io-btn" onclick="window.saveDspModRow('${k}', this, event)">💾</button></div></div>`;
    }).join('');

    const rowsMod = [
        ['midPhase', window.tr('🎯 Фаза СЧ Вокал (dB):', '🎯 Vocal Mid Gain (dB):'), '1', 'mod_midPhase'],
        ['midQ', window.tr('📐 Ширина СЧ купола (%):', '📐 Mid Dome Width (%):'), '10', 'mod_midQ'],
        ['deEsser', window.tr('🐍 Де-эссер ВЧ (dB):', '🐍 HF De-Esser (dB):'), '1', 'mod_deEsser'],
        ['cleanFir', window.tr('✨ Драйв Чистый FIR (dB):', '✨ Clean FIR Drive (dB):'), '1', 'mod_cleanFir'],
        ['masterCeil', window.tr('🛡️ Мастер-потолок (dB):', '🛡️ Master Ceiling (dB):'), '1', 'mod_masterCeil']
    ];
    const modSection = document.createElement('details'); modSection.id = 'dspModularSection'; modSection.className = 'setting-group'; modSection.open = true;
    modSection.innerHTML = `<summary style="display:flex;align-items:center;justify-content:space-between;"><span>${window.tr('🧪 Тонкая настройка тракта (5 опций)', '🧪 Signal Path Fine-Tuning (5 Options)')}</span><span class="jenny-help-badge" onclick="window.showHelpTopic('mod_block', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;">❓</span></summary><div class="group-content" style="position:relative;"><div id="dspModLockShield" onclick="try{navigator.vibrate(40);}catch(e){}; if(window.showToast) window.showToast('🔒 Блок управления отключён! Для включения выключите «Фазовый фокус»', event);" style="display:none;position:absolute;inset:0;z-index:20;cursor:not-allowed;"></div><div id="dspModBodyWrap" style="transition:opacity 0.2s ease, filter 0.2s ease;"><div class="setting-row" style="border:none;padding:2px 0 8px 0;"><span style="color:#8b949e;font-size:12px;">${window.tr('Модули кроссовера и сатурации:', 'Crossover & saturation modules:')}</span><button type="button" onclick="window.resetDspGroup(['midPhase','midQ','deEsser','cleanFir','masterCeil'], '🔄 5 опций тракта сброшены!', event)" style="font-size:11px;padding:3px 8px;">${window.tr('🔄 Сброс', '🔄 Reset')}</button></div>${buildRowsHTML(rowsMod)}</div></div>`;

    const rowsPro = [
        ['autoRms', window.tr('⚡ Авто-RMS Цель (dB):', '⚡ Auto-RMS Target (dB):'), '1', 'pro_autoRms'],
        ['monoBass', window.tr('🧲 Моно-Саббас (Hz):', '🧲 Mono Sub-Bass (Hz):'), '20', 'pro_monoBass'],
        ['msWidth', window.tr('🎭 Стерео-Ширина (%):', '🎭 Stereo Width (%):'), '25', 'pro_msWidth'],
        ['punch', window.tr('🥁 Панч-Хлыст (dB):', '🥁 Punch Whip (dB):'), '1', 'pro_punch'],
        ['crossfeed', window.tr('🎧 Бинаурал-Колонки (%):', '🎧 Binaural Speakers (%):'), '10', 'pro_crossfeed']
    ];
    const proSection = document.createElement('details'); proSection.id = 'dspProStudioSection'; proSection.className = 'setting-group'; proSection.open = true;
    proSection.innerHTML = `<summary style="display:flex;align-items:center;justify-content:space-between;"><span>${window.tr('🚀 Мастеринг-Студия PRO (5 спец-модулей)', '🚀 Mastering Studio PRO (5 Spec-Modules)')}</span><span class="jenny-help-badge" onclick="window.showHelpTopic('pro_block', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;">❓</span></summary><div class="group-content"><div class="setting-row" style="border:none;padding:2px 0 8px 0;"><span style="color:#8b949e;font-size:12px;">${window.tr('Психоакустика и динамика мембран:', 'Psychoacoustics & driver dynamics:')}</span><button type="button" onclick="window.resetDspGroup(['autoRms','monoBass','msWidth','punch','crossfeed'], '🔄 Модули PRO Studio сброшены!', event)" style="font-size:11px;padding:3px 8px;">${window.tr('🔄 Сброс', '🔄 Reset')}</button></div>${buildRowsHTML(rowsPro)}</div>`;

    if (ramCard) { ramCard.insertAdjacentElement('afterend', pfCard); pfCard.insertAdjacentElement('afterend', modSection); modSection.insertAdjacentElement('afterend', proSection); }
    else { container.appendChild(pfCard); container.appendChild(modSection); container.appendChild(proSection); }

    const idMap = [
        ['cfg_studioMode', 'studio_ram'], ['cfg_leftHandedMode', 'left_hand'], ['cfg_pitchLock', 'pitch_lock'], ['cfg_xNormalSpeed', 'base_speed'],
        ['cfg_amoledMode', 'amoled_mode'], ['cfg_volSlider', 'vol_slider'], ['cfg_firEnabled', 'fir_group'], ['cfg_fir_gain', 'fir_gain'],
        ['cfg_fir_decay', 'fir_decay'], ['cfg_multiBandEnabled', 'mb_group'], ['cfg_mb_low', 'mb_low'], ['cfg_mb_high', 'mb_high'],
        ['cfg_limiterEnabled', 'lim_group'], ['cfg_lim_threshold', 'lim_thresh'], ['cfg_lim_knee', 'lim_knee'], ['cfg_lim_ratio', 'lim_ratio'],
        ['cfg_lim_attack', 'lim_attack'], ['cfg_lim_release', 'lim_release'], ['cfg_eqEnabled', 'eq_group'], ['cfg_boosterEnabled', 'boost_group'],
        ['cfg_defaultScrubSpeed', 'scrub_speed'], ['cfg_z1_en', 'scrub_zones']
    ];
    idMap.forEach(([id, topic]) => {
        const el = document.getElementById(id); if (!el) return;
        const lbl = el.closest('label');
        if (lbl) lbl.appendChild(window.makeHelpBadge(topic));
        else { const row = el.closest('.setting-row'); if (row && row.firstElementChild) row.firstElementChild.appendChild(window.makeHelpBadge(topic)); }
    });

    document.querySelectorAll('#settingsModal summary').forEach(sum => {
        if (sum.querySelector('.jenny-help-badge')) return;
        const txt = sum.innerText || '';
        if (txt.includes('Скраббинг') || txt.includes('Scrubbing')) sum.appendChild(window.makeHelpBadge('scrub_group'));
        else if (txt.includes('FIR')) sum.appendChild(window.makeHelpBadge('fir_group'));
        else if (txt.includes('кроссовер') || txt.includes('Crossover')) sum.appendChild(window.makeHelpBadge('mb_group'));
        else if (txt.includes('Лимитер') || txt.includes('Limiter')) sum.appendChild(window.makeHelpBadge('lim_group'));
        else if (txt.includes('Эквалайзер') || txt.includes('Equalizer')) sum.appendChild(window.makeHelpBadge('eq_group'));
        else if (txt.includes('Усилитель') || txt.includes('Booster')) sum.appendChild(window.makeHelpBadge('boost_group'));
        else if (txt.includes('Форматы') || txt.includes('Formats')) sum.appendChild(window.makeHelpBadge('format_slots'));
    });

    const eqBands = [
        ['eq_60', window.tr('60 Гц — Саб-бас (Глубина и бочка)', '60 Hz — Sub-Bass (Depth & Kick)'), 'eq_band_60'],
        ['eq_230', window.tr('230 Гц — Мид-бас (Теплота / Анти-бубнёж)', '230 Hz — Mid-Bass (Warmth / Mud Cut)'), 'eq_band_230'],
        ['eq_910', window.tr('910 Гц — Середина (Основа вокала)', '910 Hz — Midrange (Vocal Core)'), 'eq_band_910'],
        ['eq_3600', window.tr('3600 Гц — Верхняя СЧ (Близость и чёткость)', '3600 Hz — Upper Mid (Clarity & Bite)'), 'eq_band_3600'],
        ['eq_14000', window.tr('14 000 Гц — Воздух (Блеск и тарелки)', '14,000 Hz — Air (Sparkle & Cymbals)'), 'eq_band_14000']
    ];
    eqBands.forEach(([id, title, topic]) => {
        const slider = document.getElementById(id);
        if (slider) {
            const hdr = document.createElement('div'); hdr.className = 'eq-band-hdr';
            hdr.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:-12px;color:#c9d1d9;font-size:12.5px;font-weight:bold;";
            hdr.innerHTML = `<span>${title}</span>`; hdr.appendChild(window.makeHelpBadge(topic));
            slider.parentNode.insertBefore(hdr, slider);
        }
    });

    window.syncDspModUI();
    if (typeof window.syncFormatSlotsUI === 'function') window.syncFormatSlotsUI();
    if (typeof window.installFormatAwareFetchData === 'function') {
        window.installFormatAwareFetchData();
        setTimeout(() => { window.installFormatAwareFetchData(); if (typeof window.fetchData === 'function') window.fetchData(); }, 100);
    }
};

if (document.readyState === 'loading') document.addEventListener("DOMContentLoaded", window.mountJennyStudioUI);
else window.mountJennyStudioUI();

// =========================================================================




// 🦿 ПАТЧ V35: ДВА СЦЕНАРИЯ КНОПКИ RU/EN (БЕГ ДО НАЖАТИЯ / УПОЛЗАНИЕ ВВЕРХ-ВПРАВО ПОСЛЕ НАЖАТИЯ)
window.renderDualLangHTML = function(withGlobe) {
    const isEn = (window.getLang() === 'en');
    const p = withGlobe ? '🌐 ' : '';
    return isEn
        ? `${p}<span style="color:#8b949e;font-weight:normal;">RU / </span><span style="color:#3fb950;font-weight:900;">EN</span>`
        : `${p}<span style="color:#3fb950;font-weight:900;">RU</span><span style="color:#8b949e;font-weight:normal;"> / EN</span>`;
};

window.updateDualLangButtons = function() {
    const mainBtn = document.getElementById('mainLangToggleBtn');
    if (mainBtn) {
        mainBtn.innerHTML = window.renderDualLangHTML(false);
        mainBtn.style.whiteSpace = 'nowrap';
        mainBtn.style.padding = '4px 8px';
        if (window._langTouchedByUser) {
            mainBtn.classList.remove('lang-buzz-active');
        }
    }
    const topRow = document.getElementById('jennyTopBarRow');
    if (topRow && topRow.lastElementChild) {
        topRow.lastElementChild.innerHTML = window.renderDualLangHTML(true);
    }
};

window.applyVideoMasterPresetV35 = function(force) {
    window.appConfig = window.appConfig || JSON.parse(localStorage.getItem('ytm_config') || '{}');
    if (!force && window.appConfig._videoPresetAppliedV35) return;
    Object.assign(window.appConfig, {
        _videoPresetAppliedV35: true, _migratedToRealUnitsV20: true,
        studioMode: true, phaseFixEnabled: false,
        opt_midPhase: true, val_midPhase: 4,
        opt_midQ: true, val_midQ: 120,
        opt_deEsser: true, val_deEsser: -2,
        opt_cleanFir: true, val_cleanFir: 3,
        opt_masterCeil: true, val_masterCeil: -1.0,
        opt_autoRms: true, val_autoRms: -6,
        opt_monoBass: true, val_monoBass: 79,
        opt_msWidth: true, val_msWidth: 130,
        opt_punch: true, val_punch: -1,
        opt_crossfeed: false, val_crossfeed: 65,
        leftHandedMode: false, pitchLock: true, xNormalSpeed: false,
        normalPlaybackSpeed: 0.97, autoSaveBase: false,
        defaultScrubSpeed: 1.1, autoSaveScrub: true,
        scrubZones: [
            { val: 1.1, en: true }, { val: 1, en: true }, { val: 1.05, en: true },
            { val: 0.95, en: true }, { val: 1.5, en: true }, { val: 0.9, en: true }
        ],
        formatSlots: JSON.parse(JSON.stringify(window.DEFAULT_FORMAT_SLOTS)),
        amoledMode: true, volSlider: true,
        firEnabled: true, firSettings: { gain: 1.5, decay: 1.28 },
        multiBandEnabled: true, multiBandSettings: { low: 160, high: 2528 },
        limiterEnabled: true, limiterSettings: { threshold: -18, knee: 128, ratio: 4, attack: 192, release: 352 },
        eqEnabled: true, boosterEnabled: true, boosterPower: 5
    });
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));

    const chkMap = {
        'cfg_studioMode': true, 'cfg_phaseFix': false, 'cfg_leftHandedMode': false,
        'cfg_pitchLock': true, 'cfg_xNormalSpeed': false, 'cfg_autoSaveBase': false,
        'cfg_autoSaveScrub': true, 'cfg_amoledMode': true, 'cfg_volSlider': true,
        'cfg_firEnabled': true, 'cfg_multiBandEnabled': true, 'cfg_limiterEnabled': true,
        'cfg_eqEnabled': true, 'cfg_boosterEnabled': true
    };
    for (const [id, v] of Object.entries(chkMap)) { const el = document.getElementById(id); if (el) el.checked = v; }

    const valMap = {
        'cfg_normalPlaybackSpeed': 0.97, 'cfg_defaultScrubSpeed': 1.1,
        'cfg_fir_gain': 1.5, 'cfg_fir_decay': 1.28,
        'cfg_mb_low': 160, 'cfg_mb_high': 2528,
        'cfg_lim_threshold': -18, 'cfg_lim_knee': 128, 'cfg_lim_ratio': 4,
        'cfg_lim_attack': 192, 'cfg_lim_release': 352, 'cfg_boosterPower': 5
    };
    for (const [id, v] of Object.entries(valMap)) { const el = document.getElementById(id); if (el) el.value = v; }

    if (typeof window.syncDspModUI === 'function') window.syncDspModUI();
    if (typeof window.syncFormatSlotsUI === 'function') window.syncFormatSlotsUI();
    if (typeof window.applyTheme === 'function') window.applyTheme();
    if (typeof window.buildAudioGraph === 'function') window.buildAudioGraph();
    if (typeof window.saveConfigToDisk === 'function') window.saveConfigToDisk();
};

(function() {
    const origLoad = window.loadConfigFromDisk;
    if (typeof origLoad === 'function' && !window._loadWrappedV35) {
        window._loadWrappedV35 = true;
        window.loadConfigFromDisk = async function() {
            const wasApplied = Boolean(window.appConfig && window.appConfig._videoPresetAppliedV35);
            await origLoad();
            if (!wasApplied) window.applyVideoMasterPresetV35(true);
        };
    }
})();

window._langRunawayTimer = null;
window._langBuzzInterval = null;
window._hasLangRunAway = false;
window._langTouchedByUser = false;

window.triggerLangBuzz = function(ms = 1400) {
    // Дребезжит ТОЛЬКО если пользователь ещё ни разу не трогал кнопку!
    if (window._langTouchedByUser || window._hasLangRunAway) return;
    const btn = document.getElementById('mainLangToggleBtn');
    if (!btn) return;
    btn.classList.add('lang-buzz-active');
    setTimeout(() => { if (btn) btn.classList.remove('lang-buzz-active'); }, ms);
};

// СЦЕНАРИЙ 1: Не трогали 30 сек -> Срывается с места на длинных ногах вправо и прыгает с сальтухой в ⚙️
window.runAwayLangBadgeToSettings = function() {
    const btn = document.getElementById('mainLangToggleBtn');
    const gear = document.getElementById('btn-settingsModal');
    if (!btn || !gear || window._hasLangRunAway || btn.offsetParent === null) return;

    window._hasLangRunAway = true;
    if (window._langBuzzInterval) clearInterval(window._langBuzzInterval);

    const startRect = btn.getBoundingClientRect();
    const gearRect = gear.getBoundingClientRect();
    btn.style.opacity = '0';
    btn.style.pointerEvents = 'none';

    const actor = document.createElement('div');
    actor.className = 'runaway-actor';
    actor.style.left = startRect.left + 'px';
    actor.style.top = startRect.top + 'px';
    actor.innerHTML = `
        <div id="runawayBubble" style="font-size:10px;color:#e3b341;font-weight:bold;margin-bottom:2px;white-space:nowrap;">${window.tr('💨 Адиос!', '💨 Adios!')}</div>
        <div class="jenny-lang-btn" style="white-space:nowrap;padding:4px 8px;border-color:#3fb950;box-shadow:0 0 12px rgba(63,185,80,0.6);">
            ${window.renderDualLangHTML(false)}
        </div>
        <div class="runaway-legs-wrap">
            <div class="runaway-leg left"></div>
            <div class="runaway-leg right"></div>
        </div>
    `;
    document.body.appendChild(actor);
    actor.classList.add('lang-buzz-active');
    try { navigator.vibrate(25); } catch (e) {}

    setTimeout(() => {
        actor.classList.remove('lang-buzz-active');
        const targetRunX = Math.max(startRect.left + 80, gearRect.left - 15);
        actor.style.transition = 'left 1.3s linear, top 1.3s ease-in-out';
        actor.style.left = targetRunX + 'px';
        actor.style.top = (startRect.top - 4) + 'px';
    }, 400);

    setTimeout(() => {
        const b = document.getElementById('runawayBubble');
        if (b) b.innerText = window.tr('🤸 Вжух!', '🤸 Wheee!');
        actor.style.transition = 'left 0.55s ease-in, top 0.55s cubic-bezier(0.2, -0.6, 0.3, 1), transform 0.55s ease-in, opacity 0.55s ease-in';
        actor.style.left = (gearRect.left - 5) + 'px';
        actor.style.top = (gearRect.top - 5) + 'px';
        actor.style.transform = 'rotate(540deg) scale(0.15)';
        actor.style.opacity = '0.2';
    }, 1750);

    setTimeout(() => {
        actor.remove();
        btn.style.display = 'none';
        gear.classList.add('gear-swallow-anim');
        try { navigator.vibrate([20, 40, 30]); } catch (e) {}
        setTimeout(() => gear.classList.remove('gear-swallow-anim'), 650);
    }, 2320);
};

// СЦЕНАРИЙ 2: Язык был выбран (ткнули хотя бы раз) -> Тихо ждёт 30 сек и аккуратно уползает ВВЕРХ, а потом ВПРАВО в ⚙️
window.crawlAwayLangBadgeToSettings = function() {
    const btn = document.getElementById('mainLangToggleBtn');
    const gear = document.getElementById('btn-settingsModal');
    if (!btn || !gear || window._hasLangRunAway || btn.offsetParent === null) return;

    window._hasLangRunAway = true;
    if (window._langBuzzInterval) clearInterval(window._langBuzzInterval);

    const startRect = btn.getBoundingClientRect();
    const gearRect = gear.getBoundingClientRect();
    btn.style.opacity = '0';
    btn.style.pointerEvents = 'none';

    const legsHTML = '<span class="c-leg"></span><span class="c-leg"></span><span class="c-leg"></span><span class="c-leg"></span><span class="c-leg"></span>';

    const crawler = document.createElement('div');
    crawler.className = 'crawler-actor';
    crawler.style.left = startRect.left + 'px';
    crawler.style.top = startRect.top + 'px';
    crawler.innerHTML = `
        <div id="crawlerBubble" style="font-size:10px;color:#58a6ff;font-weight:bold;margin-bottom:8px;white-space:nowrap;">${window.tr('🐛 Ползу в ⚙️...', '🐛 Crawling to ⚙️...')}</div>
        <div id="crawlerRotator" class="crawler-rotator" style="transform: rotate(0deg);">
            <div class="crawler-spine">
                <div class="crawler-legs-row side-a">${legsHTML}</div>
                <div class="jenny-lang-btn" style="white-space:nowrap;padding:3px 7px;border-color:#58a6ff;box-shadow:0 0 10px rgba(88,166,255,0.45);">
                    ${window.renderDualLangHTML(false)}
                </div>
                <div class="crawler-legs-row side-b">${legsHTML}</div>
                <div class="crawler-head-antennae">
                    <span class="c-antenna top"></span>
                    <span class="c-antenna bot"></span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(crawler);

    const rotator = document.getElementById('crawlerRotator');
    const topLaneY = Math.max(6, gearRect.top - 14);
    const targetRightX = Math.max(startRect.left + 60, gearRect.left - 20);

    // Шаг 1 (0 - 220 мс): Разворачивается на месте узким торцом ("головой") СТРОГО ВВЕРХ (-90°)
    setTimeout(() => {
        if (rotator) rotator.style.transform = 'rotate(-90deg)';
    }, 30);

    // Шаг 2 (220 - 1420 мс): Ползёт узким торцом вперёд вертикально ВВЕРХ, перебирая лапками по бокам
    setTimeout(() => {
        crawler.style.transition = 'top 1.2s linear';
        crawler.style.top = topLaneY + 'px';
    }, 220);

    // Шаг 3 (1380 - 1650 мс): На верхнем углу поворачивает корпус на 90° ВПРАВО (0° — узким торцом к шестерёнке)
    setTimeout(() => {
        if (rotator) rotator.style.transform = 'rotate(0deg)';
    }, 1380);

    // Шаг 4 (1550 - 3200 мс): Ползёт головой вперёд ВПРАВО до шестерёнки ⚙️
    setTimeout(() => {
        crawler.style.transition = 'left 1.65s linear';
        crawler.style.left = targetRightX + 'px';
    }, 1550);

    // Шаг 5 (3200 - 3620 мс): Ныряет головой внутрь шестерёнки ⚙️
    setTimeout(() => {
        const b = document.getElementById('crawlerBubble');
        if (b) b.innerText = window.tr('🫡 На месте!', '🫡 Tucked in!');
        crawler.style.transition = 'left 0.42s ease-in, top 0.42s ease-in, transform 0.42s ease-in, opacity 0.42s ease-in';
        crawler.style.left = (gearRect.left + 2) + 'px';
        crawler.style.top = (gearRect.top + 2) + 'px';
        crawler.style.transform = 'scale(0.12)';
        crawler.style.opacity = '0.1';
    }, 3200);

    // Шаг 6 (3620 мс): Шестерёнка мягко принимает плашку
    setTimeout(() => {
        crawler.remove();
        btn.style.display = 'none';
        gear.classList.add('gear-soft-anim');
        setTimeout(() => gear.classList.remove('gear-soft-anim'), 550);
    }, 3620);
};

window.scheduleLangRunawayTimer = function() {
    if (window._hasLangRunAway) return;
    if (window._langRunawayTimer) clearTimeout(window._langRunawayTimer);
    if (window._langBuzzInterval) clearInterval(window._langBuzzInterval);

    if (!window._langTouchedByUser) {
        // Пока не нажали ни разу — дребезжит со старта и каждые 10 сек, а через 30 сек убегает на ногах
        setTimeout(() => window.triggerLangBuzz(2000), 300);
        window._langBuzzInterval = setInterval(() => window.triggerLangBuzz(900), 10000);
        window._langRunawayTimer = setTimeout(() => window.runAwayLangBadgeToSettings(), 30000);
    } else {
        // После первого нажатия — больше НЕ дребезжит, ждёт 30 сек и аккуратно уползает ВВЕРХ -> ВПРАВО
        const btn = document.getElementById('mainLangToggleBtn');
        if (btn) btn.classList.remove('lang-buzz-active');
        window._langRunawayTimer = setTimeout(() => window.crawlAwayLangBadgeToSettings(), 30000);
    }
};

const _origToggleLangV35 = window.toggleLanguage;
window.toggleLanguage = function(ev) {
    window._langTouchedByUser = true;
    if (window._langBuzzInterval) {
        clearInterval(window._langBuzzInterval);
        window._langBuzzInterval = null;
    }
    const btn = document.getElementById('mainLangToggleBtn');
    if (btn) btn.classList.remove('lang-buzz-active');

    _origToggleLangV35(ev);
    window.updateDualLangButtons();
    window.scheduleLangRunawayTimer();
};

window.initV35Enhancements = function() {
    window.applyVideoMasterPresetV35(false);
    window.updateDualLangButtons();
    window.scheduleLangRunawayTimer();
    const ft = document.getElementById('folderIconTrigger');
    if (ft && ft.parentElement) {
        ft.parentElement.style.width = 'auto';
        ft.parentElement.style.minWidth = '92px';
        ft.parentElement.style.gap = '8px';
    }
};

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", () => setTimeout(window.initV35Enhancements, 80));
} else {
    setTimeout(window.initV35Enhancements, 80);
}


// 🎨 ПАТЧ V37: РЕДАКТОР ТЕМ, ЧЕСТНЫЙ AMOLED #000000 И ЕДИНЫЕ ТОНКИЕ РАМКИ / ГРАДИЕНТЫ
window.THEME_PRESETS_V37 = {
    // Монохромные рамки (solid)
    solid_purple:  { mode: 'solid', rgb: [115, 65, 190], ru: '🟣 Тёмный Аметист (Дефолт)', en: '🟣 Subtle Amethyst (Default)', preview: '#7341be' },
    solid_cyan:    { mode: 'solid', rgb: [88, 166, 255], ru: '🔵 Кибер-Циан',              en: '🔵 Cyber Cyan',               preview: '#58a6ff' },
    solid_emerald: { mode: 'solid', rgb: [63, 185, 80],  ru: '🟢 Изумрудная Матрица',      en: '🟢 Matrix Emerald',           preview: '#3fb950' },
    solid_gold:    { mode: 'solid', rgb: [227, 179, 65], ru: '🟡 Золотой Винил',           en: '🟡 Vinyl Gold',               preview: '#e3b341' },
    solid_ruby:    { mode: 'solid', rgb: [248, 81, 73],  ru: '🔴 Рубиновый Лазер',         en: '🔴 Ruby Laser',               preview: '#f85149' },
    solid_stealth: { mode: 'solid', rgb: [110, 118, 129],ru: '⚪ Стелс-Графит',            en: '⚪ Stealth Graphite',         preview: '#6e7681' },
    // Градиентные рамки (grad)
    grad_synth:    { mode: 'grad', c1: [115, 65, 190], c2: [88, 166, 255],  ru: '🌌 Неоновый Синтвейв (Фиолет ➔ Циан)',   en: '🌌 Neon Synthwave (Purple ➔ Cyan)',   preview: 'linear-gradient(135deg,#7341be,#58a6ff)' },
    grad_sunset:   { mode: 'grad', c1: [163, 113, 247],c2: [227, 179, 65],  ru: '🌅 Кибер-Закат (Фиолет ➔ Золото)',       en: '🌅 Cyber Sunset (Purple ➔ Gold)',     preview: 'linear-gradient(135deg,#a371f7,#e3b341)' },
    grad_matrix:   { mode: 'grad', c1: [63, 185, 80],  c2: [88, 166, 255],  ru: '🧪 Био-Матрица (Изумруд ➔ Циан)',        en: '🧪 Bio-Matrix (Emerald ➔ Cyan)',      preview: 'linear-gradient(135deg,#3fb950,#58a6ff)' },
    grad_plasma:   { mode: 'grad', c1: [248, 81, 73],  c2: [227, 179, 65],  ru: '🔥 Плазменный Овердрайв (Рубин ➔ Золото)',en: '🔥 Plasma Overdrive (Ruby ➔ Gold)',   preview: 'linear-gradient(135deg,#f85149,#e3b341)' },
    grad_cosmos:   { mode: 'grad', c1: [115, 65, 190], c2: [63, 185, 80], c3: [88, 166, 255], ru: '🔮 Глубокий Космос (3-цветный)', en: '🔮 Deep Space (Tri-Color)', preview: 'linear-gradient(135deg,#7341be,#3fb950,#58a6ff)' }
};

window.JENNY_HELP_DB_RU.theme_studio = {
    title: "🎨 Редактор тем и тонких контуров",
    phys: "Переводит все карточки в режим честного <b>#000000 AMOLED</b> (выключенные пиксели) и рисует тонкие 1px рамки выбранного цвета или градиента с заданной прозрачностью.",
    hear: "Глаза не слепит серым свечением в темноте, а все блоки выглядят строго в едином монолитном стиле.",
    tip: "Монохромные цвета и градиенты взаимоисключают друг друга — просто ткни в понравившийся вариант!"
};
window.JENNY_HELP_DB_EN.theme_studio = {
    title: "🎨 Theme & Thin Border Studio",
    phys: "Switches all cards to true <b>#000000 AMOLED</b> black (pixels completely off) and renders uniform 1px solid or gradient borders with adjustable opacity.",
    hear: "Zero gray backlight bleed in the dark with a clean, unified cyber aesthetic.",
    tip: "Solid colors and gradients are mutually exclusive — just tap any style to switch!"
};

window.unifyAllSettingCardsV37 = function() {
    const sm = document.getElementById('settingsModal');
    if (sm) {
        sm.querySelectorAll('.setting-row').forEach(row => {
            if (row.style && (row.style.borderLeft || row.style.background)) {
                row.classList.add('jenny-uniform-card');
                row.style.borderLeft = '';
                row.style.borderTop = '';
                row.style.borderRight = '';
                row.style.borderBottom = '';
                row.style.background = '';
            }
        });
        // Прячем дубликаты AMOLED и Ползунка громкости из общего списка, так как теперь они живут в Редакторе Тем
        ['cfg_amoledMode', 'cfg_volSlider'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const row = el.closest('.setting-row');
                if (row && !row.closest('#themeModal')) row.style.display = 'none';
            }
        });
    }
};

window.applyVisualThemeV37 = function() {
    window.appConfig = window.appConfig || JSON.parse(localStorage.getItem('ytm_config') || '{}');
    const key = window.appConfig.themeBorderKey || 'solid_purple';
    const alphaPct = (window.appConfig.themeBorderAlpha !== undefined) ? parseInt(window.appConfig.themeBorderAlpha, 10) : 38;
    const alpha = Math.max(0.1, Math.min(1.0, alphaPct / 100));

    const preset = window.THEME_PRESETS_V37[key] || window.THEME_PRESETS_V37.solid_purple;
    const root = document.documentElement;

    if (preset.mode === 'solid') {
        document.body.setAttribute('data-border-mode', 'solid');
        const [r, g, b] = preset.rgb;
        root.style.setProperty('--border-uniform', `rgba(${r}, ${g}, ${b}, ${alpha})`);
        root.style.setProperty('--border-main', `rgba(${r}, ${g}, ${b}, ${alpha})`);
        root.style.setProperty('--border-accent', `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha + 0.15)})`);
    } else {
        document.body.setAttribute('data-border-mode', 'grad');
        const [r1, g1, b1] = preset.c1;
        const [r2, g2, b2] = preset.c2;
        if (preset.c3) {
            const [r3, g3, b3] = preset.c3;
            root.style.setProperty('--border-grad', `linear-gradient(135deg, rgba(${r1},${g1},${b1},${alpha}), rgba(${r2},${g2},${b2},${alpha}), rgba(${r3},${g3},${b3},${alpha}))`);
        } else {
            root.style.setProperty('--border-grad', `linear-gradient(135deg, rgba(${r1},${g1},${b1},${alpha}), rgba(${r2},${g2},${b2},${alpha}))`);
        }
        root.style.setProperty('--border-uniform', `rgba(${r1}, ${g1}, ${b1}, ${alpha * 0.75})`);
        root.style.setProperty('--border-main', `rgba(${r1}, ${g1}, ${b1}, ${alpha * 0.75})`);
    }

    window.unifyAllSettingCardsV37();
    window.syncThemeStudioUIV37();
};

window.selectThemeBorderKeyV37 = function(newKey, ev) {
    window.appConfig = window.appConfig || {};
    window.appConfig.themeBorderKey = newKey;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.applyVisualThemeV37();
    if (typeof window.saveConfigToDisk === 'function') window.saveConfigToDisk();
};

window.onThemeAlphaInputV37 = function(val) {
    window.appConfig = window.appConfig || {};
    window.appConfig.themeBorderAlpha = parseInt(val, 10) || 38;
    const lbl = document.getElementById('themeAlphaValLabel');
    if (lbl) lbl.innerText = window.appConfig.themeBorderAlpha + '%';
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.applyVisualThemeV37();
};

window.onThemeAmoledToggleV37 = function(chk) {
    const orig = document.getElementById('cfg_amoledMode');
    if (orig) {
        orig.checked = chk.checked;
        if (typeof window.updateSettings === 'function') window.updateSettings();
    }
    window.appConfig = window.appConfig || {};
    window.appConfig.amoledMode = chk.checked;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.applyTheme === 'function') window.applyTheme();
    window.applyVisualThemeV37();
};

window.onThemeVolSliderToggleV37 = function(chk) {
    const orig = document.getElementById('cfg_volSlider');
    if (orig) {
        orig.checked = chk.checked;
        if (typeof window.updateSettings === 'function') window.updateSettings();
    }
    window.appConfig = window.appConfig || {};
    window.appConfig.volSlider = chk.checked;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
};

window.resetVisualThemeV37 = function(ev) {
    window.appConfig = window.appConfig || {};
    window.appConfig.themeBorderKey = 'solid_purple';
    window.appConfig.themeBorderAlpha = 38;
    window.appConfig.amoledMode = true;
    window.appConfig.volSlider = true;
    const origAm = document.getElementById('cfg_amoledMode');
    if (origAm) origAm.checked = true;
    const origVol = document.getElementById('cfg_volSlider');
    if (origVol) origVol.checked = true;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.updateSettings === 'function') window.updateSettings();
    if (typeof window.applyTheme === 'function') window.applyTheme();
    window.applyVisualThemeV37();
    if (typeof window.showToast === 'function') {
        window.showToast(window.tr('🎨 Сброшено: Истинный AMOLED + Тёмный Аметист (38%)', '🎨 Reset: True AMOLED + Subtle Amethyst (38%)'), ev);
    }
};

window.syncThemeStudioUIV37 = function() {
    const cfg = window.appConfig || {};
    const activeKey = cfg.themeBorderKey || 'solid_purple';
    const alphaPct = (cfg.themeBorderAlpha !== undefined) ? cfg.themeBorderAlpha : 38;

    Object.keys(window.THEME_PRESETS_V37).forEach(k => {
        const chk = document.getElementById('chk_theme_' + k);
        if (chk) chk.checked = (k === activeKey);
    });

    const slider = document.getElementById('rng_theme_alpha');
    if (slider) slider.value = alphaPct;
    const lbl = document.getElementById('themeAlphaValLabel');
    if (lbl) lbl.innerText = alphaPct + '%';

    const amChk = document.getElementById('chk_theme_amoled');
    if (amChk) amChk.checked = (cfg.amoledMode !== false);
    const volChk = document.getElementById('chk_theme_vol');
    if (volChk) volChk.checked = (cfg.volSlider !== false);
};

window.openThemeStudioModalV37 = function() {
    window.ensureThemeStudioModalV37();
    window.syncThemeStudioUIV37();
    const sm = document.getElementById('settingsModal');
    const tm = document.getElementById('themeModal');
    if (sm) sm.classList.remove('open');
    if (tm) tm.classList.add('open');
    if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
};

window.closeThemeStudioToSettingsV37 = function() {
    const tm = document.getElementById('themeModal');
    const sm = document.getElementById('settingsModal');
    if (tm) tm.classList.remove('open');
    if (sm) sm.classList.add('open');
    if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
};

window.ensureThemeStudioModalV37 = function() {
    let tm = document.getElementById('themeModal');
    if (tm) tm.remove();

    tm = document.createElement('div');
    tm.id = 'themeModal';
    tm.className = 'modal-overlay';

    const buildPresetRows = (filterMode) => {
        return Object.entries(window.THEME_PRESETS_V37)
            .filter(([_, p]) => p.mode === filterMode)
            .map(([k, p]) => `
                <div class="setting-row" style="padding:8px 0;">
                    <label class="toggle-label" style="flex:1;display:flex;align-items:center;gap:8px;">
                        <input type="checkbox" id="chk_theme_${k}" onchange="window.selectThemeBorderKeyV37('${k}', event)">
                        <span class="theme-swatch-dot" style="background:${p.preview};"></span>
                        <span>${window.tr(p.ru, p.en)}</span>
                    </label>
                </div>
            `).join('');
    };

    tm.innerHTML = `
        <div class="container">
            <div style="display:flex;gap:8px;margin-bottom:12px;">
                <button type="button" onclick="window.closeThemeStudioToSettingsV37()" style="flex:1;padding:10px;background:#11161d;border:1px solid var(--border-uniform);color:#58a6ff;font-size:13px;">
                    ${window.tr('⬅ Назад в настройки', '⬅ Back to Settings')}
                </button>
                <button type="button" onclick="window.resetVisualThemeV37(event)" style="padding:10px 14px;background:#11161d;border:1px solid var(--border-uniform);color:#e3b341;font-size:12.5px;">
                    ${window.tr('🔄 Сброс', '🔄 Reset')}
                </button>
            </div>

            <div class="setting-row jenny-uniform-card" style="padding:10px 12px;border-radius:8px;margin-bottom:10px;">
                <label class="toggle-label" style="font-weight:bold;color:#e6edf3;">
                    <input type="checkbox" id="chk_theme_amoled" onchange="window.onThemeAmoledToggleV37(this)">
                    ${window.tr('🖤 Истинный AMOLED (#000000 во всех блоках)', '🖤 True AMOLED (100% #000000 Cards)')}
                </label>
            </div>

            <div class="setting-row jenny-uniform-card" style="padding:10px 12px;border-radius:8px;margin-bottom:12px;">
                <label class="toggle-label" style="font-weight:bold;color:#e6edf3;">
                    <input type="checkbox" id="chk_theme_vol" onchange="window.onThemeVolSliderToggleV37(this)">
                    ${window.tr('🔊 Показывать кнопку громкости на панели', '🔊 Show Volume Button on Transport Bar')}
                </label>
            </div>

            <details class="setting-group" open>
                <summary>${window.tr('💡 Тонкость и заметность рамок', '💡 Border Subtlety & Opacity')}</summary>
                <div class="group-content">
                    <div style="display:flex;justify-content:space-between;font-size:12.5px;color:#c9d1d9;margin-bottom:4px;">
                        <span>${window.tr('Яркость контура 1px (15% = еле видно):', '1px Contour Brightness (15% = Ghost):')}</span>
                        <span id="themeAlphaValLabel" style="color:#3fb950;font-weight:bold;">38%</span>
                    </div>
                    <input type="range" id="rng_theme_alpha" class="hz-slider" min="15" max="100" step="1" value="38" oninput="window.onThemeAlphaInputV37(this.value)">
                </div>
            </details>

            <details class="setting-group" open>
                <summary>${window.tr('🟣 Монохромные рамки (Единый цвет)', '🟣 Solid Thin Borders (Single Color)')}</summary>
                <div class="group-content">
                    <div style="font-size:11.5px;color:#8b949e;margin-bottom:6px;">
                        ${window.tr('Строго один стиль рамок для всех элементов плеера:', 'Uniform 1px border color across all player elements:')}
                    </div>
                    ${buildPresetRows('solid')}
                </div>
            </details>

            <details class="setting-group" open>
                <summary>${window.tr('🌌 Градиентные рамки (Взаимоисключающие)', '🌌 Gradient Thin Borders (Mutually Exclusive)')}</summary>
                <div class="group-content">
                    <div style="font-size:11.5px;color:#8b949e;margin-bottom:6px;">
                        ${window.tr('При выборе градиента монохромный цвет автоматически выключается:', 'Selecting a gradient automatically turns off solid colors:')}
                    </div>
                    ${buildPresetRows('grad')}
                </div>
            </details>
        </div>
    `;

    const mainWrap = document.getElementById('settingsModal') ? document.getElementById('settingsModal').parentElement : document.body;
    mainWrap.appendChild(tm);
};

window.mountThemeStudioButtonV37 = function() {
    const sm = document.getElementById('settingsModal');
    if (!sm) return;
    const topBarRow = document.getElementById('jennyTopBarRow');
    let btnRow = document.getElementById('jennyThemeStudioBtnRow');
    if (btnRow) btnRow.remove();

    btnRow = document.createElement('div');
    btnRow.id = 'jennyThemeStudioBtnRow';
    btnRow.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;align-items:center;';

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.onclick = () => window.openThemeStudioModalV37();
    openBtn.style.cssText = 'flex:1;background:#0a0d12;border:1px solid var(--border-uniform);color:#e3b341;font-weight:bold;padding:11px;border-radius:8px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;';
    openBtn.innerHTML = window.tr('🎨 РЕДАКТОР ТЕМ И РАМОК (AMOLED / ГРАДИЕНТЫ)', '🎨 THEME & BORDER STUDIO (AMOLED / GRADIENTS)');

    btnRow.appendChild(openBtn);
    btnRow.appendChild(window.makeHelpBadge('theme_studio'));

    if (topBarRow) {
        topBarRow.insertAdjacentElement('afterend', btnRow);
    } else {
        const container = sm.querySelector('.container') || sm;
        container.insertBefore(btnRow, container.firstChild);
    }

    window.ensureThemeStudioModalV37();
    window.applyVisualThemeV37();
};

const _origMountUI_V37 = window.mountJennyStudioUI;
window.mountJennyStudioUI = function() {
    _origMountUI_V37();
    window.mountThemeStudioButtonV37();
};

// Если кто-то открывает другое модальное окно (⚙️, 🄠, ❤️), закрываем themeModal
(function() {
    const origToggleModal = window.toggleModal;
    if (typeof origToggleModal === 'function' && !window._toggleModalWrappedV37) {
        window._toggleModalWrappedV37 = true;
        window.toggleModal = function(modalId) {
            const tm = document.getElementById('themeModal');
            if (tm && tm.classList.contains('open') && modalId === 'settingsModal') {
                tm.classList.remove('open');
                return;
            }
            if (tm) tm.classList.remove('open');
            return origToggleModal(modalId);
        };
    }
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(window.mountThemeStudioButtonV37, 120));
} else {
    setTimeout(window.mountThemeStudioButtonV37, 120);
}


// 🎨 ПАТЧ V38: THEME STUDIO 1.1 (ГРУППИРОВКА ДЕТАЛЕЙ + JSON ИМПОРТ/ЭКСПОРТ)

window.DEFAULT_THEME_CONFIG_V38 = {
    amoledMode: true,
    volSlider: true,
    themeBorderKey: 'solid_purple',
    themeBorderAlpha: 38,
    bgColor: '#000000',
    resetBtnColor: '#e3b341',
    ioBtnColor: '#7341be',
    checkboxColor: '#3fb950',
    sliderColor: '#58a6ff',
    transportColor: '#a371f7'
};

window.FULL_THEME_PACKS_V38 = {
    amethyst_amoled: {
        ru: '🟣 Тёмный Аметист (Эталон AMOLED)', en: '🟣 Subtle Amethyst (Default AMOLED)',
        amoledMode: true, themeBorderKey: 'solid_purple', themeBorderAlpha: 38, bgColor: '#000000',
        resetBtnColor: '#e3b341', ioBtnColor: '#7341be', checkboxColor: '#3fb950', sliderColor: '#58a6ff', transportColor: '#a371f7'
    },
    cyber_matrix: {
        ru: '🟢 Неоновая Матрица (Изумруд + Циан)', en: '🟢 Neon Matrix (Emerald + Cyan)',
        amoledMode: true, themeBorderKey: 'grad_matrix', themeBorderAlpha: 52, bgColor: '#000000',
        resetBtnColor: '#3fb950', ioBtnColor: '#3fb950', checkboxColor: '#58a6ff', sliderColor: '#3fb950', transportColor: '#3fb950'
    },
    synth_sunset: {
        ru: '🌅 Кибер-Закат (Золото + Пурпур)', en: '🌅 Cyber Sunset (Gold + Purple)',
        amoledMode: true, themeBorderKey: 'grad_sunset', themeBorderAlpha: 55, bgColor: '#000000',
        resetBtnColor: '#f85149', ioBtnColor: '#e3b341', checkboxColor: '#e3b341', sliderColor: '#a371f7', transportColor: '#e3b341'
    },
    ruby_stealth: {
        ru: '🔴 Хищный Рубин (Стелс-Контур)', en: '🔴 Predator Ruby (Stealth Contour)',
        amoledMode: true, themeBorderKey: 'solid_ruby', themeBorderAlpha: 42, bgColor: '#000000',
        resetBtnColor: '#f85149', ioBtnColor: '#f85149', checkboxColor: '#f85149', sliderColor: '#f85149', transportColor: '#da3633'
    }
};

window.hexToRgbaV38 = function(hex, alpha) {
    let c = String(hex || '#7341be').replace('#', '').trim();
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(115, 65, 190, ${alpha})`;
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
};

// Автоматически помечает все кнопки "Сброс / Reset" единым классом .jenny-reset-btn
window.tagUniformResetButtonsV38 = function() {
    document.querySelectorAll('button').forEach(btn => {
        const txt = (btn.innerText || '').trim();
        if (txt.includes('Сброс') || txt.includes('Reset')) {
            btn.classList.add('jenny-reset-btn');
        }
    });
};

window.getCurrentThemeObjectV38 = function() {
    const cfg = window.appConfig || {};
    const d = window.DEFAULT_THEME_CONFIG_V38;
    return {
        jenny_theme_v: "1.1",
        amoledMode: cfg.amoledMode !== undefined ? Boolean(cfg.amoledMode) : d.amoledMode,
        volSlider: cfg.volSlider !== undefined ? Boolean(cfg.volSlider) : d.volSlider,
        themeBorderKey: cfg.themeBorderKey || d.themeBorderKey,
        themeBorderAlpha: cfg.themeBorderAlpha !== undefined ? parseInt(cfg.themeBorderAlpha, 10) : d.themeBorderAlpha,
        bgColor: cfg.bgColor || d.bgColor,
        resetBtnColor: cfg.resetBtnColor || d.resetBtnColor,
        ioBtnColor: cfg.ioBtnColor || d.ioBtnColor,
        checkboxColor: cfg.checkboxColor || d.checkboxColor,
        sliderColor: cfg.sliderColor || d.sliderColor,
        transportColor: cfg.transportColor || d.transportColor
    };
};

window.applyGroupColorsV38 = function() {
    window.tagUniformResetButtonsV38();
    const t = window.getCurrentThemeObjectV38();
    const root = document.documentElement;

    // 1. Группа кнопок "🔄 Сброс"
    root.style.setProperty('--reset-btn-fg', t.resetBtnColor);
    root.style.setProperty('--reset-btn-border', window.hexToRgbaV38(t.resetBtnColor, 0.48));
    root.style.setProperty('--reset-btn-bg', window.hexToRgbaV38(t.resetBtnColor, 0.08));

    // 2. Группа кнопок "📥 / 💾"
    root.style.setProperty('--io-btn-border', window.hexToRgbaV38(t.ioBtnColor, 0.55));

    // 3. Группа чекбоксов и активных индикаторов
    root.style.setProperty('--accent-green', t.checkboxColor);

    // 4. Группа ползунков и значков ❓
    root.style.setProperty('--slider-thumb-fg', t.sliderColor);
    root.style.setProperty('--help-badge-fg', t.sliderColor);
    root.style.setProperty('--accent-cyan', t.sliderColor);

    // 5. Группа главных кнопок транспорта (Play / Треугольники)
    root.style.setProperty('--transport-accent', t.transportColor);

    // 6. Фон (Чистый AMOLED #000000 или кастомный оттенок)
    if (!t.amoledMode && t.bgColor && t.bgColor !== '#000000') {
        document.body.setAttribute('data-bg-preset', 'custom');
        root.style.setProperty('--custom-bg-color', t.bgColor);
    } else {
        document.body.removeAttribute('data-bg-preset');
    }

    // Обновляем JSON-строку в поле экспорта, если окно открыто
    const jsonBox = document.getElementById('themeJsonTextarea');
    if (jsonBox && document.activeElement !== jsonBox) {
        jsonBox.value = JSON.stringify(t);
    }
};

// Перехватываем applyVisualThemeV37, чтобы он всегда применял и групповые цвета V38
const _origApplyThemeV37 = window.applyVisualThemeV37;
window.applyVisualThemeV37 = function() {
    if (typeof _origApplyThemeV37 === 'function') _origApplyThemeV37();
    window.applyGroupColorsV38();
};

window.onGroupColorInputV38 = function(propKey, hexVal) {
    window.appConfig = window.appConfig || {};
    window.appConfig[propKey] = hexVal;
    if (propKey === 'bgColor' && hexVal !== '#000000') {
        window.appConfig.amoledMode = false;
        const amChk = document.getElementById('chk_theme_amoled');
        if (amChk) amChk.checked = false;
    }
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.applyVisualThemeV37();
    if (typeof window.saveConfigToDisk === 'function') window.saveConfigToDisk();
};

window.applyFullThemePackV38 = function(packKey, ev) {
    const pack = window.FULL_THEME_PACKS_V38[packKey];
    if (!pack) return;
    window.appConfig = window.appConfig || {};
    Object.keys(window.DEFAULT_THEME_CONFIG_V38).forEach(k => {
        if (pack[k] !== undefined) window.appConfig[k] = pack[k];
    });
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.applyVisualThemeV37();
    window.syncThemeStudioUIV38();
    if (typeof window.saveConfigToDisk === 'function') window.saveConfigToDisk();
    if (typeof window.showToast === 'function') {
        window.showToast(window.tr('✅ Пакет темы применён!', '✅ Theme pack applied!'), ev);
    }
};

window.applyThemeFromJsonObjV38 = function(obj, ev) {
    if (!obj || typeof obj !== 'object') return false;
    window.appConfig = window.appConfig || {};
    Object.keys(window.DEFAULT_THEME_CONFIG_V38).forEach(k => {
        if (obj[k] !== undefined) window.appConfig[k] = obj[k];
    });
    const origAm = document.getElementById('cfg_amoledMode');
    if (origAm && obj.amoledMode !== undefined) origAm.checked = Boolean(obj.amoledMode);
    const origVol = document.getElementById('cfg_volSlider');
    if (origVol && obj.volSlider !== undefined) origVol.checked = Boolean(obj.volSlider);

    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.applyTheme === 'function') window.applyTheme();
    window.applyVisualThemeV37();
    window.syncThemeStudioUIV38();
    if (typeof window.saveConfigToDisk === 'function') window.saveConfigToDisk();
    if (typeof window.showToast === 'function') {
        window.showToast(window.tr('🎨 Тема из JSON успешно загружена!', '🎨 JSON Theme successfully loaded!'), ev);
    }
    return true;
};

window.copyThemeJsonToClipboardV38 = async function(ev) {
    const jsonStr = JSON.stringify(window.getCurrentThemeObjectV38(), null, 2);
    const box = document.getElementById('themeJsonTextarea');
    if (box) box.value = jsonStr;
    try {
        await navigator.clipboard.writeText(jsonStr);
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('📋 JSON темы скопирован в буфер!', '📋 Theme JSON copied to clipboard!'), ev);
        }
    } catch (e) {
        if (box) { box.select(); document.execCommand('copy'); }
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('📋 JSON выделен и скопирован!', '📋 JSON selected & copied!'), ev);
        }
    }
};

window.applyThemeFromTextareaV38 = function(ev) {
    const box = document.getElementById('themeJsonTextarea');
    if (!box || !box.value.trim()) return;
    try {
        const parsed = JSON.parse(box.value.trim());
        window.applyThemeFromJsonObjV38(parsed, ev);
    } catch (e) {
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('❌ Ошибка: неверный формат JSON!', '❌ Error: Invalid JSON format!'), ev);
        }
    }
};

window.downloadThemeJsonFileV38 = function(ev) {
    const jsonStr = JSON.stringify(window.getCurrentThemeObjectV38(), null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jenny_theme_${window.appConfig.themeBorderKey || 'custom'}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
    if (typeof window.showToast === 'function') {
        window.showToast(window.tr('💾 Файл темы .json сохранён!', '💾 Theme .json file saved!'), ev);
    }
};

window.onThemeJsonFilePickedV38 = function(inputEl, ev) {
    const file = inputEl && inputEl.files && inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(String(e.target.result || ''));
            const box = document.getElementById('themeJsonTextarea');
            if (box) box.value = JSON.stringify(parsed);
            window.applyThemeFromJsonObjV38(parsed, ev);
        } catch (err) {
            if (typeof window.showToast === 'function') {
                window.showToast(window.tr('❌ Файл повреждён или не является JSON!', '❌ Corrupted or invalid JSON file!'), ev);
            }
        }
    };
    reader.readAsText(file);
};

window.syncThemeStudioUIV38 = function() {
    if (typeof window.syncThemeStudioUIV37 === 'function') window.syncThemeStudioUIV37();
    const t = window.getCurrentThemeObjectV38();
    const map = {
        'clr_theme_reset': t.resetBtnColor,
        'clr_theme_io': t.ioBtnColor,
        'clr_theme_chk': t.checkboxColor,
        'clr_theme_slider': t.sliderColor,
        'clr_theme_transport': t.transportColor,
        'clr_theme_bg': t.bgColor
    };
    for (const [id, val] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }
    const box = document.getElementById('themeJsonTextarea');
    if (box) box.value = JSON.stringify(t);
};

const _origResetThemeV37 = window.resetVisualThemeV37;
window.resetVisualThemeV37 = function(ev) {
    window.appConfig = window.appConfig || {};
    Object.assign(window.appConfig, window.DEFAULT_THEME_CONFIG_V38);
    if (typeof _origResetThemeV37 === 'function') _origResetThemeV37(ev);
    window.syncThemeStudioUIV38();
};

const _origEnsureModalV37 = window.ensureThemeStudioModalV37;
window.ensureThemeStudioModalV37 = function() {
    _origEnsureModalV37();
    const tm = document.getElementById('themeModal');
    if (!tm) return;
    const container = tm.querySelector('.container') || tm;
    if (document.getElementById('themeGroupsSectionV38')) return;

    const extraHTML = document.createElement('div');
    extraHTML.id = 'themeGroupsSectionV38';
    extraHTML.innerHTML = `
        <details class="setting-group" open>
            <summary>${window.tr('🎛️ Единые группы деталей (Синхронный окрас)', '🎛️ Unified Component Groups (Sync Color)')}</summary>
            <div class="group-content">
                <div class="setting-row" style="padding:7px 0;">
                    <span style="font-size:12.5px;color:#e6edf3;">${window.tr('🔄 Все кнопки «Сброс»:', '🔄 All "Reset" Buttons:')}</span>
                    <input type="color" id="clr_theme_reset" class="theme-color-picker" value="#e3b341" oninput="window.onGroupColorInputV38('resetBtnColor', this.value)">
                </div>
                <div class="setting-row" style="padding:7px 0;">
                    <span style="font-size:12.5px;color:#e6edf3;">${window.tr('📥/💾 Кнопки памяти строк:', '📥/💾 Row Memory Buttons:')}</span>
                    <input type="color" id="clr_theme_io" class="theme-color-picker" value="#7341be" oninput="window.onGroupColorInputV38('ioBtnColor', this.value)">
                </div>
                <div class="setting-row" style="padding:7px 0;">
                    <span style="font-size:12.5px;color:#e6edf3;">${window.tr('☑️ Галочки и активные статусы:', '☑️ Checkboxes & Active Badges:')}</span>
                    <input type="color" id="clr_theme_chk" class="theme-color-picker" value="#3fb950" oninput="window.onGroupColorInputV38('checkboxColor', this.value)">
                </div>
                <div class="setting-row" style="padding:7px 0;">
                    <span style="font-size:12.5px;color:#e6edf3;">${window.tr('🎚️ Ползунки и кружки справки ❓:', '🎚️ Sliders & Help Badges ❓:')}</span>
                    <input type="color" id="clr_theme_slider" class="theme-color-picker" value="#58a6ff" oninput="window.onGroupColorInputV38('sliderColor', this.value)">
                </div>
                <div class="setting-row" style="padding:7px 0;">
                    <span style="font-size:12.5px;color:#e6edf3;">${window.tr('▶️ Кнопки Play и Перемотка:', '▶️ Play & Seek Triangles:')}</span>
                    <input type="color" id="clr_theme_transport" class="theme-color-picker" value="#a371f7" oninput="window.onGroupColorInputV38('transportColor', this.value)">
                </div>
                <div class="setting-row" style="padding:7px 0;border:none;">
                    <span style="font-size:12.5px;color:#e6edf3;">${window.tr('🌑 Оттенок фона (если выкл. AMOLED):', '🌑 Custom Background (if AMOLED off):')}</span>
                    <input type="color" id="clr_theme_bg" class="theme-color-picker" value="#000000" oninput="window.onGroupColorInputV38('bgColor', this.value)">
                </div>
            </div>
        </details>

        <details class="setting-group" open>
            <summary>${window.tr('⚡ Готовые сборки тем в 1 клик', '⚡ One-Click Full Theme Packs')}</summary>
            <div class="group-content" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button type="button" onclick="window.applyFullThemePackV38('amethyst_amoled', event)" style="padding:8px;">🟣 Amethyst</button>
                <button type="button" onclick="window.applyFullThemePackV38('cyber_matrix', event)" style="padding:8px;">🟢 Matrix</button>
                <button type="button" onclick="window.applyFullThemePackV38('synth_sunset', event)" style="padding:8px;">🌅 Sunset</button>
                <button type="button" onclick="window.applyFullThemePackV38('ruby_stealth', event)" style="padding:8px;">🔴 Ruby</button>
            </div>
        </details>

        <details class="setting-group" open>
            <summary>${window.tr('📦 Импорт и Экспорт темы (JSON)', '📦 Theme Import & Export (JSON)')}</summary>
            <div class="group-content">
                <div style="font-size:11.5px;color:#8b949e;margin-bottom:6px;">
                    ${window.tr('Скопируй JSON-код, чтобы поделиться темой, или вставь чужой код сюда:', 'Copy JSON code to share your theme, or paste a JSON string below:')}
                </div>
                <textarea id="themeJsonTextarea" rows="3" style="width:100%;box-sizing:border-box;background:#000;color:#3fb950;border:1px solid var(--border-uniform);border-radius:6px;padding:8px;font-family:monospace;font-size:11px;margin-bottom:8px;resize:vertical;"></textarea>
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <button type="button" onclick="window.copyThemeJsonToClipboardV38(event)" style="flex:1;padding:8px;">${window.tr('📋 Копировать JSON', '📋 Copy JSON')}</button>
                    <button type="button" onclick="window.applyThemeFromTextareaV38(event)" style="flex:1;padding:8px;color:#3fb950;">${window.tr('✅ Применить JSON', '✅ Apply JSON')}</button>
                </div>
                <div style="display:flex;gap:6px;">
                    <button type="button" onclick="window.downloadThemeJsonFileV38(event)" style="flex:1;padding:8px;">${window.tr('💾 Скачать .json', '💾 Save .json')}</button>
                    <button type="button" onclick="document.getElementById('themeJsonFileInput').click()" style="flex:1;padding:8px;">${window.tr('📂 Открыть .json', '📂 Load .json')}</button>
                    <input type="file" id="themeJsonFileInput" accept=".json,application/json" style="display:none;" onchange="window.onThemeJsonFilePickedV38(this, event)">
                </div>
            </div>
        </details>
    `;
    container.appendChild(extraHTML);
    window.syncThemeStudioUIV38();
};

setTimeout(() => {
    window.ensureThemeStudioModalV37();
    window.applyVisualThemeV37();
}, 180);


// 🚀 ПАТЧ V39: СТЫКОВКА RU/EN В НАСТРОЙКАХ, НЕПОЛНЫЙ JSON С БЛИЖАЙШИМ ЦВЕТОМ И ЧЕСТНЫЕ ФАЙЛЫ .JSON

window.STANDARD_PALETTE_V39 = [
    { hex: '#7341be', nameRu: 'Тёмный Аметист', nameEn: 'Subtle Amethyst' },
    { hex: '#a371f7', nameRu: 'Неоновый Пурпур', nameEn: 'Neon Purple' },
    { hex: '#58a6ff', nameRu: 'Кибер-Циан',     nameEn: 'Cyber Cyan' },
    { hex: '#3fb950', nameRu: 'Изумруд',        nameEn: 'Matrix Emerald' },
    { hex: '#e3b341', nameRu: 'Золотой Винил',  nameEn: 'Vinyl Gold' },
    { hex: '#f85149', nameRu: 'Рубиновый Лазер',nameEn: 'Ruby Laser' },
    { hex: '#da3633', nameRu: 'Алый Драйв',     nameEn: 'Crimson Drive' },
    { hex: '#6e7681', nameRu: 'Стелс-Графит',   nameEn: 'Stealth Graphite' },
    { hex: '#000000', nameRu: 'Чистый AMOLED',  nameEn: 'Pure AMOLED' },
    { hex: '#0d1117', nameRu: 'Тёмная Полночь', nameEn: 'Dark Midnight' }
];

window.FIELD_LABELS_V39 = {
    amoledMode:       { ru: 'Режим AMOLED',       en: 'AMOLED Mode' },
    volSlider:        { ru: 'Кнопка громкости',   en: 'Volume Button' },
    themeBorderKey:   { ru: 'Стиль рамок',        en: 'Border Style' },
    themeBorderAlpha: { ru: 'Яркость рамок',      en: 'Border Opacity' },
    bgColor:          { ru: 'Оттенок фона',       en: 'Background Color' },
    resetBtnColor:    { ru: 'Кнопки «Сброс»',     en: 'Reset Buttons' },
    ioBtnColor:       { ru: 'Кнопки памяти 📥/💾',en: 'Memory Buttons' },
    checkboxColor:    { ru: 'Галочки',            en: 'Checkboxes' },
    sliderColor:      { ru: 'Ползунки и ❓',       en: 'Sliders & ❓' },
    transportColor:   { ru: 'Кнопки Play/Перемотка', en: 'Play & Triangles' }
};

window.parseHexToRgbV39 = function(hex) {
    let c = String(hex || '').replace('#', '').trim();
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    if (!/^[0-9a-fA-F]{6}$/.test(c)) return null;
    const n = parseInt(c, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

window.findNearestStandardColorV39 = function(targetHex, fallbackHex) {
    const rgb = window.parseHexToRgbV39(targetHex) || window.parseHexToRgbV39(fallbackHex) || [115, 65, 190];
    let best = window.STANDARD_PALETTE_V39[0];
    let minDist = Infinity;
    window.STANDARD_PALETTE_V39.forEach(item => {
        if (item.hex === '#000000' && fallbackHex !== '#000000') return;
        const pRgb = window.parseHexToRgbV39(item.hex);
        if (!pRgb) return;
        const d = Math.pow(rgb[0]-pRgb[0], 2) + Math.pow(rgb[1]-pRgb[1], 2) + Math.pow(rgb[2]-pRgb[2], 2);
        if (d < minDist) {
            minDist = d;
            best = item;
        }
    });
    return best;
};

// 1. УПРАВЛЕНИЕ ВИДИМОСТЬЮ И СТЫКОВКОЙ КНОПКИ RU / EN В НАСТРОЙКАХ
window.syncSettingsLangBtnVisibilityV39 = function(animateDock) {
    const topRow = document.getElementById('jennyTopBarRow');
    if (!topRow || topRow.children.length < 2) return;
    const langBtnInSettings = topRow.lastElementChild;
    langBtnInSettings.id = 'settingsDockedLangBtn';

    if (!window._hasLangRunAway) {
        // Пока плашка на главном экране — в настройках её НЕТ!
        langBtnInSettings.style.display = 'none';
        langBtnInSettings.classList.remove('lang-docked-appear');
    } else {
        langBtnInSettings.style.display = 'flex';
        langBtnInSettings.innerHTML = window.renderDualLangHTML(true);
        if (animateDock) {
            langBtnInSettings.classList.remove('lang-docked-appear');
            void langBtnInSettings.offsetWidth;
            langBtnInSettings.classList.add('lang-docked-appear');
        }
    }
};

// Эффект перелёта и стыковки из шестерёнки ⚙️ прямо в слот внутри открытых настроек
window.dockLangBadgeIntoOpenSettingsV39 = function() {
    const sm = document.getElementById('settingsModal');
    const gear = document.getElementById('btn-settingsModal');
    const topRow = document.getElementById('jennyTopBarRow');

    if (!sm || !sm.classList.contains('open') || !gear || !topRow || topRow.children.length < 2) {
        window.syncSettingsLangBtnVisibilityV39(true);
        return;
    }

    const langBtnInSettings = topRow.lastElementChild;
    // Показываем кнопку прозрачной, чтобы flex-строка плавно сдвинула "СПРАВОЧНИК НАСТРОЕК" влево и открыла гнездо
    langBtnInSettings.style.display = 'flex';
    langBtnInSettings.style.opacity = '0';
    langBtnInSettings.style.transition = 'none';
    langBtnInSettings.innerHTML = window.renderDualLangHTML(true);

    setTimeout(() => {
        const gearRect = gear.getBoundingClientRect();
        const slotRect = langBtnInSettings.getBoundingClientRect();

        // Создаём капсулу, вылетающую из шестерёнки ⚙️ вниз прямо в открывшееся гнездо настроек
        const flyer = document.createElement('div');
        flyer.style.cssText = `position:fixed;z-index:999999;pointer-events:none;left:${gearRect.left - 10}px;top:${gearRect.top + 6}px;transform:scale(0.35);opacity:0.9;transition:all 0.42s cubic-bezier(0.22, 1.3, 0.36, 1);`;
        flyer.innerHTML = `<div class="jenny-lang-btn" style="padding:8px 12px;border-color:#3fb950;box-shadow:0 0 18px #3fb950;background:#0d1117;">${window.renderDualLangHTML(true)}</div>`;
        document.body.appendChild(flyer);

        requestAnimationFrame(() => {
            flyer.style.left = slotRect.left + 'px';
            flyer.style.top = slotRect.top + 'px';
            flyer.style.transform = 'scale(1)';
        });

        setTimeout(() => {
            flyer.remove();
            langBtnInSettings.style.opacity = '1';
            langBtnInSettings.classList.add('lang-docked-appear');
        }, 420);
    }, 60);
};

// Перехватываем оба сценария побега, чтобы в финале срабатывала стыковка с настройками!
(function() {
    const wrapRunawayDocking = () => {
        const origRun = window.runAwayLangBadgeToSettings;
        if (typeof origRun === 'function' && !window._runWrappedV39) {
            window._runWrappedV39 = true;
            window.runAwayLangBadgeToSettings = function() {
                origRun();
                setTimeout(() => window.dockLangBadgeIntoOpenSettingsV39(), 2330);
            };
        }
        const origCrawl = window.crawlAwayLangBadgeToSettings;
        if (typeof origCrawl === 'function' && !window._crawlWrappedV39) {
            window._crawlWrappedV39 = true;
            window.crawlAwayLangBadgeToSettings = function() {
                origCrawl();
                setTimeout(() => window.dockLangBadgeIntoOpenSettingsV39(), 3630);
            };
        }
    };
    wrapRunawayDocking();
    setTimeout(wrapRunawayDocking, 200);
})();

const _origUpdateDualV39 = window.updateDualLangButtons;
window.updateDualLangButtons = function() {
    if (typeof _origUpdateDualV39 === 'function') _origUpdateDualV39();
    window.syncSettingsLangBtnVisibilityV39(false);
};

// 2. УМНЫЙ ПАРСЕР НЕПОЛНОГО ИЛИ ОБОРВАННОГО JSON С АВТОПОДБОРОМ БЛИЖАЙШЕГО ЦВЕТА
window.salvagePartialJsonV39 = function(rawText) {
    let txt = String(rawText || '').trim();
    if (!txt) return null;

    // Попытка 1: чистый JSON.parse
    try {
        const obj = JSON.parse(txt);
        if (obj && typeof obj === 'object') return obj;
    } catch (e) {}

    // Попытка 2: чиним оборванный конец (запятые, незакрытые кавычки и фигурную скобку)
    let fixed = txt.replace(/,\s*$/, '');
    if (!fixed.startsWith('{')) fixed = '{' + fixed;
    const quoteCount = (fixed.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) fixed += '"';
    fixed = fixed.replace(/,\s*\}/g, '}');
    if (!fixed.endsWith('}')) fixed += '}';
    try {
        const obj = JSON.parse(fixed);
        if (obj && typeof obj === 'object') return obj;
    } catch (e) {}

    // Попытка 3: Построчное вытаскивание всех распознаваемых пар ключ-значение регулярками
    const extracted = {};
    const kvRegex = /"?([a-zA-Z0-9_]+)"?\s*:\s*("[^"]*"|true|false|-?\d+(?:\.\d+)?|#[0-9a-fA-F]{3,6})/g;
    let m;
    while ((m = kvRegex.exec(txt)) !== null) {
        const k = m[1];
        let v = m[2];
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        else if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (!v.startsWith('#') && !isNaN(Number(v))) v = Number(v);
        extracted[k] = v;
    }
    return Object.keys(extracted).length > 0 ? extracted : null;
};

window.applySmartPartialThemeV39 = function(rawObj, ev) {
    if (!rawObj || typeof rawObj !== 'object') return false;

    const defaults = window.DEFAULT_THEME_CONFIG_V38;
    const colorKeys = ['resetBtnColor', 'ioBtnColor', 'checkboxColor', 'sliderColor', 'transportColor', 'bgColor'];
    const allKeys = ['amoledMode', 'volSlider', 'themeBorderKey', 'themeBorderAlpha', ...colorKeys];

    // Находим любой валидный цвет внутри присланного JSON, чтобы искать ближайший стандартный оттенок к задумке автора
    let referenceHex = null;
    for (const ck of colorKeys) {
        if (rawObj[ck] && window.parseHexToRgbV39(rawObj[ck])) {
            referenceHex = rawObj[ck];
            break;
        }
    }

    const missingRu = [];
    const missingEn = [];
    const finalTheme = { jenny_theme_v: "1.1" };
    let usedNearestNameRu = null;
    let usedNearestNameEn = null;

    allKeys.forEach(k => {
        const isProvided = (rawObj[k] !== undefined && rawObj[k] !== null && rawObj[k] !== '');
        if (isProvided) {
            if (colorKeys.includes(k)) {
                // Если цвет указан криво, подбираем ближайший стандартный
                if (window.parseHexToRgbV39(rawObj[k])) {
                    finalTheme[k] = rawObj[k];
                } else {
                    const near = window.findNearestStandardColorV39(referenceHex, defaults[k]);
                    finalTheme[k] = near.hex;
                }
            } else {
                finalTheme[k] = rawObj[k];
            }
        } else {
            // Поле НЕ дописано в JSON!
            const lbl = window.FIELD_LABELS_V39[k] || { ru: k, en: k };
            missingRu.push(lbl.ru);
            missingEn.push(lbl.en);

            if (colorKeys.includes(k)) {
                const near = window.findNearestStandardColorV39(referenceHex, defaults[k]);
                finalTheme[k] = near.hex;
                if (!usedNearestNameRu) {
                    usedNearestNameRu = near.nameRu + ' (' + near.hex + ')';
                    usedNearestNameEn = near.nameEn + ' (' + near.hex + ')';
                }
            } else {
                finalTheme[k] = defaults[k];
            }
        }
    });

    window.appConfig = window.appConfig || {};
    Object.assign(window.appConfig, finalTheme);

    const origAm = document.getElementById('cfg_amoledMode');
    if (origAm) origAm.checked = Boolean(finalTheme.amoledMode);
    const origVol = document.getElementById('cfg_volSlider');
    if (origVol) origVol.checked = Boolean(finalTheme.volSlider);

    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.applyTheme === 'function') window.applyTheme();
    window.applyVisualThemeV37();
    window.syncThemeStudioUIV38();
    if (typeof window.saveConfigToDisk === 'function') window.saveConfigToDisk();

    const reportBox = document.getElementById('themeJsonReportBox');
    if (missingRu.length === 0) {
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#3fb950';
            reportBox.innerHTML = window.tr('✅ Все параметры JSON распознаны и применены в полном объёме!', '✅ All JSON parameters recognized and applied!');
        }
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('✅ Полный JSON темы применён!', '✅ Full Theme JSON applied!'), ev);
        }
    } else {
        const msgRu = `⚠️ В JSON не дописаны: <b>${missingRu.join(', ')}</b>.<br>🎨 Применено то, что есть + подставлен ближайший стандартный цвет: <b style="color:#3fb950;">${usedNearestNameRu || 'Тёмный Аметист'}</b>`;
        const msgEn = `⚠️ Missing in JSON: <b>${missingEn.join(', ')}</b>.<br>🎨 Applied provided fields + nearest standard color: <b style="color:#3fb950;">${usedNearestNameEn || 'Subtle Amethyst'}</b>`;
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#e3b341';
            reportBox.innerHTML = window.tr(msgRu, msgEn);
        }
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr(`⚠️ Не указано (${missingRu.length}): подставлен ближайший стандартный цвет!`, `⚠️ Missing (${missingEn.length}): nearest standard color applied!`), ev);
        }
    }
    return finalTheme;
};

// Переопределяем кнопку "✅ Применить JSON"
window.applyThemeFromTextareaV38 = function(ev) {
    const box = document.getElementById('themeJsonTextarea');
    const raw = box ? box.value.trim() : '';
    const reportBox = document.getElementById('themeJsonReportBox');

    if (!raw) {
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#f85149';
            reportBox.innerHTML = window.tr('⚠️ Поле пустое (0 байт)! Вставь JSON-код темы или нажми «Копировать JSON».', '⚠️ Field is empty (0 bytes)! Paste a JSON theme or tap "Copy JSON".');
        }
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('⚠️ Поле пустое (0 байт)! Нечего применять.', '⚠️ Field is empty (0 bytes)!'), ev);
        }
        return;
    }

    const salvaged = window.salvagePartialJsonV39(raw);
    if (!salvaged) {
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#f85149';
            reportBox.innerHTML = window.tr('❌ В тексте нет ни одного параметра темы (например, "sliderColor": "#58a6ff").', '❌ No recognizable theme fields found in text.');
        }
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('❌ Не найдено параметров темы в тексте!', '❌ No theme parameters found!'), ev);
        }
        return;
    }

    const fullApplied = window.applySmartPartialThemeV39(salvaged, ev);
    if (box && fullApplied) {
        box.value = JSON.stringify(fullApplied, null, 2);
    }
};

// 3. ЧЕСТНОЕ СОХРАНЕНИЕ И ОТКРЫТИЕ ФАЙЛОВ .JSON ЧЕРЕЗ PYTHON БЭКЕНД
window.downloadThemeJsonFileV38 = async function(ev) {
    const box = document.getElementById('themeJsonTextarea');
    const raw = box ? box.value.trim() : '';
    const reportBox = document.getElementById('themeJsonReportBox');

    if (!raw) {
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#f85149';
            reportBox.innerHTML = window.tr('⚠️ В поле 0 байт! Сначала нажми «📋 Копировать JSON» (чтобы выгрузить текущую тему в поле) или вставь свой код.', '⚠️ 0 bytes in text box! Tap "📋 Copy JSON" first or paste your code.');
        }
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('⚠️ В поле 0 байт! Нажми «Копировать JSON» перед сохранением.', '⚠️ 0 bytes! Tap "Copy JSON" first.'), ev);
        }
        return;
    }

    const salvaged = window.salvagePartialJsonV39(raw) || window.getCurrentThemeObjectV38();
    const completeTheme = window.applySmartPartialThemeV39(salvaged, null) || window.getCurrentThemeObjectV38();
    const fileName = `jenny_${completeTheme.themeBorderKey || 'theme'}_${Math.floor(Date.now()/1000)}.json`;

    try {
        const res = await fetch('/api/themes/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: fileName, data: completeTheme })
        });
        const ans = await res.json();
        if (ans && ans.status === 'ok') {
            if (reportBox) {
                reportBox.style.display = 'block';
                reportBox.style.borderColor = '#3fb950';
                reportBox.innerHTML = window.tr(
                    `💾 <b>Файл реально сохранён (${ans.bytes} байт):</b><br><span style="color:#58a6ff;word-break:break-all;">${ans.path}</span>`,
                    `💾 <b>File saved (${ans.bytes} bytes):</b><br><span style="color:#58a6ff;word-break:break-all;">${ans.path}</span>`
                );
            }
            if (typeof window.showToast === 'function') {
                window.showToast(window.tr(`💾 Сохранено (${ans.bytes} Б): Download/JennyThemes/${ans.filename}`, `💾 Saved (${ans.bytes} B): Download/JennyThemes/${ans.filename}`), ev);
            }
            return;
        }
    } catch (e) {}
};

window.openSavedThemesModalV39 = async function(ev) {
    let m = document.getElementById('jennyThemeFilesModal');
    if (m) m.remove();

    m = document.createElement('div');
    m.id = 'jennyThemeFilesModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:15px;box-sizing:border-box;';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    m.innerHTML = `
        <div onclick="event.stopPropagation()" style="background:#05070a;border:1px solid var(--border-uniform);border-radius:14px;max-width:420px;width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 0 25px rgba(0,0,0,0.95);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#0d1117;border-bottom:1px solid #262c36;">
                <span style="color:#58a6ff;font-weight:bold;font-size:14px;">📂 ${window.tr('Сохранённые файлы .json', 'Saved .json Theme Files')}</span>
                <button type="button" onclick="document.getElementById('jennyThemeFilesModal').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;padding:2px 6px;">✖</button>
            </div>
            <div id="jennyThemeFilesList" style="padding:12px 14px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:#e6edf3;">
                <div style="color:#8b949e;text-align:center;padding:15px;">⏳ ${window.tr('Сканируем папку Download/JennyThemes...', 'Scanning Download/JennyThemes...')}</div>
            </div>
        </div>
    `;
    document.body.appendChild(m);

    try {
        const res = await fetch('/api/themes/list', { method: 'POST' });
        const ans = await res.json();
        const listEl = document.getElementById('jennyThemeFilesList');
        if (!listEl) return;

        const files = (ans && ans.files) ? ans.files : [];
        if (files.length === 0) {
            listEl.innerHTML = `<div style="color:#8b949e;text-align:center;padding:15px;">${window.tr('В папке Download/JennyThemes пока нет сохранённых .json файлов.<br><br>Нажми «💾 Сохранить .json», чтобы создать первый файл!', 'No .json files in Download/JennyThemes yet.<br><br>Tap "💾 Save .json" first!')}</div>`;
            return;
        }

        window._loadedThemeFilesCacheV39 = files;
        listEl.innerHTML = `<div style="font-size:11px;color:#8b949e;margin-bottom:4px;">📁 ${ans.dir}</div>` + files.map((f, idx) => `
            <div style="display:flex;justify-content:space-between;align-items:center;background:#0d1117;border:1px solid #262c36;border-radius:8px;padding:8px 10px;gap:8px;">
                <div style="min-width:0;flex:1;">
                    <div style="color:#3fb950;font-weight:bold;word-break:break-all;">${f.filename}</div>
                    <div style="color:#8b949e;font-size:11px;">${f.bytes} ${window.tr('байт', 'bytes')}</div>
                </div>
                <button type="button" onclick="window.pickSavedThemeFileByIndexV39(${idx}, event)" style="padding:6px 12px;color:#58a6ff;border-color:#58a6ff;flex-shrink:0;">
                    ${window.tr('Загрузить', 'Load')}
                </button>
            </div>
        `).join('');
    } catch (e) {
        const listEl = document.getElementById('jennyThemeFilesList');
        if (listEl) listEl.innerHTML = `<div style="color:#f85149;">❌ ${window.tr('Ошибка чтения папки тем', 'Error reading themes folder')}</div>`;
    }
};

window.pickSavedThemeFileByIndexV39 = function(idx, ev) {
    const files = window._loadedThemeFilesCacheV39 || [];
    const item = files[idx];
    if (!item) return;
    const box = document.getElementById('themeJsonTextarea');
    if (box) box.value = item.content;
    const modal = document.getElementById('jennyThemeFilesModal');
    if (modal) modal.remove();
    window.applyThemeFromTextareaV38(ev);
};

// 4. ВСТРОЕННАЯ ПАЛИТРА ЦВЕТА (БЕЗ ЧЁРНОГО ЭКРАНА WEBVIEW)
window.openCustomColorSwatchesV39 = function(propKey, btnEl) {
    let m = document.getElementById('jennyQuickColorModal');
    if (m) m.remove();

    const curHex = (window.appConfig && window.appConfig[propKey]) ? window.appConfig[propKey] : '#7341be';
    m = document.createElement('div');
    m.id = 'jennyQuickColorModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.8);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    const swatchesHTML = window.STANDARD_PALETTE_V39.map(p => `
        <button type="button" onclick="window.selectCustomSwatchV39('${propKey}', '${p.hex}')" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0d1117;border:1px solid ${p.hex};border-radius:8px;color:#e6edf3;justify-content:flex-start;">
            <span style="width:16px;height:16px;border-radius:50%;background:${p.hex};display:inline-block;border:1px solid #fff;"></span>
            <span style="font-size:12px;">${window.tr(p.nameRu, p.nameEn)}</span>
        </button>
    `).join('');

    m.innerHTML = `
        <div onclick="event.stopPropagation()" style="background:#05070a;border:1px solid var(--border-uniform);border-radius:14px;max-width:380px;width:100%;padding:14px;box-shadow:0 0 24px rgba(0,0,0,0.95);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span style="color:#58a6ff;font-weight:bold;font-size:13.5px;">🎨 ${window.tr('Выбери цвет группы', 'Select Group Color')}</span>
                <button type="button" onclick="document.getElementById('jennyQuickColorModal').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:10px;">
                ${swatchesHTML}
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
                <span style="font-size:12px;color:#8b949e;">HEX:</span>
                <input type="text" id="customHexInputV39" value="${curHex}" style="flex:1;padding:6px;" placeholder="#7341be">
                <button type="button" onclick="window.selectCustomSwatchV39('${propKey}', document.getElementById('customHexInputV39').value)" style="padding:6px 12px;color:#3fb950;">OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(m);
};

window.selectCustomSwatchV39 = function(propKey, hexVal) {
    if (!window.parseHexToRgbV39(hexVal)) {
        const near = window.findNearestStandardColorV39(hexVal, '#7341be');
        hexVal = near.hex;
    }
    window.onGroupColorInputV38(propKey, hexVal);
    window.syncThemeStudioUIV38();
    const m = document.getElementById('jennyQuickColorModal');
    if (m) m.remove();
};

// Заменяем глючные <input type="color"> на аккуратные цветные кнопки и обновляем кнопки JSON
window.upgradeThemeModalControlsV39 = function() {
    const colorMap = [
        ['clr_theme_reset', 'resetBtnColor'],
        ['clr_theme_io', 'ioBtnColor'],
        ['clr_theme_chk', 'checkboxColor'],
        ['clr_theme_slider', 'sliderColor'],
        ['clr_theme_transport', 'transportColor'],
        ['clr_theme_bg', 'bgColor']
    ];
    const t = window.getCurrentThemeObjectV38();
    colorMap.forEach(([id, propKey]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tagName === 'INPUT') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = id;
            btn.className = 'jenny-color-btn';
            btn.style.background = t[propKey] || '#7341be';
            btn.onclick = () => window.openCustomColorSwatchesV39(propKey, btn);
            el.replaceWith(btn);
        } else {
            el.style.background = t[propKey] || '#7341be';
        }
    });

    // Добавляем блок отчёта под текстовым полем JSON
    const box = document.getElementById('themeJsonTextarea');
    if (box && !document.getElementById('themeJsonReportBox')) {
        const rep = document.createElement('div');
        rep.id = 'themeJsonReportBox';
        rep.style.cssText = 'display:none;background:#0d1117;border:1px solid #3fb950;border-radius:6px;padding:8px 10px;font-size:11.5px;color:#e6edf3;margin-bottom:8px;line-height:1.4;';
        box.insertAdjacentElement('afterend', rep);
    }

    // Привязываем кнопку "📂 Открыть .json" к нашему менеджеру файлов
    const fileInp = document.getElementById('themeJsonFileInput');
    if (fileInp && fileInp.previousElementSibling) {
        const openBtn = fileInp.previousElementSibling;
        openBtn.onclick = (e) => window.openSavedThemesModalV39(e);
    }
};

const _origSyncUIV38 = window.syncThemeStudioUIV38;
window.syncThemeStudioUIV38 = function() {
    if (typeof _origSyncUIV38 === 'function') _origSyncUIV38();
    window.upgradeThemeModalControlsV39();
};

setTimeout(() => {
    window.syncSettingsLangBtnVisibilityV39(false);
    window.upgradeThemeModalControlsV39();
}, 220);


// 🔇 ПАТЧ V40: ИЗОЛЯЦИЯ ТЕМ ОТ ЗВУКА + ДУБЛИРОВАНИЕ ФАЙЛОВ .JSON В ПАМЯТИ
window._themeSaveDebounceTimer = null;

window.saveThemeOnlyQuietlyV40 = function() {
    if (window._themeSaveDebounceTimer) clearTimeout(window._themeSaveDebounceTimer);
    window._themeSaveDebounceTimer = setTimeout(() => {
        try {
            localStorage.setItem('ytm_config', JSON.stringify(window.appConfig || {}));
            if (typeof window.saveConfigToDisk === 'function') window.saveConfigToDisk();
        } catch (e) {}
    }, 320);
};

// Применение темы меняет ТОЛЬКО CSS-переменные, вообще не трогая аудио-движок
window.applyVisualThemeV37 = function() {
    window.appConfig = window.appConfig || {};
    const key = window.appConfig.themeBorderKey || 'solid_purple';
    const alphaPct = (window.appConfig.themeBorderAlpha !== undefined) ? parseInt(window.appConfig.themeBorderAlpha, 10) : 38;
    const alpha = Math.max(0.1, Math.min(1.0, alphaPct / 100));

    const preset = window.THEME_PRESETS_V37[key] || window.THEME_PRESETS_V37.solid_purple;
    const root = document.documentElement;

    if (preset.mode === 'solid') {
        document.body.setAttribute('data-border-mode', 'solid');
        const [r, g, b] = preset.rgb;
        root.style.setProperty('--border-uniform', `rgba(${r}, ${g}, ${b}, ${alpha})`);
        root.style.setProperty('--border-main', `rgba(${r}, ${g}, ${b}, ${alpha})`);
        root.style.setProperty('--border-accent', `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha + 0.15)})`);
    } else {
        document.body.setAttribute('data-border-mode', 'grad');
        const [r1, g1, b1] = preset.c1;
        const [r2, g2, b2] = preset.c2;
        if (preset.c3) {
            const [r3, g3, b3] = preset.c3;
            root.style.setProperty('--border-grad', `linear-gradient(135deg, rgba(${r1},${g1},${b1},${alpha}), rgba(${r2},${g2},${b2},${alpha}), rgba(${r3},${g3},${b3},${alpha}))`);
        } else {
            root.style.setProperty('--border-grad', `linear-gradient(135deg, rgba(${r1},${g1},${b1},${alpha}), rgba(${r2},${g2},${b2},${alpha}))`);
        }
        root.style.setProperty('--border-uniform', `rgba(${r1}, ${g1}, ${b1}, ${alpha * 0.75})`);
        root.style.setProperty('--border-main', `rgba(${r1}, ${g1}, ${b1}, ${alpha * 0.75})`);
    }

    if (typeof window.applyGroupColorsV38 === 'function') {
        window.applyGroupColorsV38();
    }
};

window.applyGroupColorsV38 = function() {
    const t = window.getCurrentThemeObjectV38();
    const root = document.documentElement;
    root.style.setProperty('--reset-btn-fg', t.resetBtnColor);
    root.style.setProperty('--reset-btn-border', window.hexToRgbaV38(t.resetBtnColor, 0.48));
    root.style.setProperty('--reset-btn-bg', window.hexToRgbaV38(t.resetBtnColor, 0.08));
    root.style.setProperty('--io-btn-border', window.hexToRgbaV38(t.ioBtnColor, 0.55));
    root.style.setProperty('--accent-green', t.checkboxColor);
    root.style.setProperty('--slider-thumb-fg', t.sliderColor);
    root.style.setProperty('--help-badge-fg', t.sliderColor);
    root.style.setProperty('--accent-cyan', t.sliderColor);
    root.style.setProperty('--transport-accent', t.transportColor);

    if (!t.amoledMode && t.bgColor && t.bgColor !== '#000000') {
        document.body.setAttribute('data-bg-preset', 'custom');
        root.style.setProperty('--custom-bg-color', t.bgColor);
    } else {
        document.body.removeAttribute('data-bg-preset');
    }

    const jsonBox = document.getElementById('themeJsonTextarea');
    if (jsonBox && document.activeElement !== jsonBox) {
        jsonBox.value = JSON.stringify(t);
    }
};

window.onThemeAmoledToggleV37 = function(chk) {
    const isAm = Boolean(chk && chk.checked);
    window.appConfig = window.appConfig || {};
    window.appConfig.amoledMode = isAm;
    const orig = document.getElementById('cfg_amoledMode');
    if (orig) orig.checked = isAm;
    if (isAm) {
        document.body.setAttribute('data-theme', 'amoled');
        document.body.removeAttribute('data-bg-preset');
    } else {
        document.body.removeAttribute('data-theme');
    }
    window.applyVisualThemeV37();
    window.saveThemeOnlyQuietlyV40();
};

window.onThemeVolSliderToggleV37 = function(chk) {
    const showVol = Boolean(chk && chk.checked);
    window.appConfig = window.appConfig || {};
    window.appConfig.volSlider = showVol;
    const orig = document.getElementById('cfg_volSlider');
    if (orig) orig.checked = showVol;
    if (typeof window.applyTheme === 'function') window.applyTheme();
    window.saveThemeOnlyQuietlyV40();
};

window.onThemeAlphaInputV37 = function(val) {
    window.appConfig = window.appConfig || {};
    window.appConfig.themeBorderAlpha = parseInt(val, 10) || 38;
    const lbl = document.getElementById('themeAlphaValLabel');
    if (lbl) lbl.innerText = window.appConfig.themeBorderAlpha + '%';
    window.applyVisualThemeV37();
    window.saveThemeOnlyQuietlyV40();
};

window.selectThemeBorderKeyV37 = function(newKey, ev) {
    window.appConfig = window.appConfig || {};
    window.appConfig.themeBorderKey = newKey;
    window.applyVisualThemeV37();
    window.syncThemeStudioUIV37();
    window.saveThemeOnlyQuietlyV40();
};

window.onGroupColorInputV38 = function(propKey, hexVal) {
    window.appConfig = window.appConfig || {};
    window.appConfig[propKey] = hexVal;
    if (propKey === 'bgColor' && hexVal !== '#000000') {
        window.appConfig.amoledMode = false;
        document.body.removeAttribute('data-theme');
        const amChk = document.getElementById('chk_theme_amoled');
        if (amChk) amChk.checked = false;
    }
    window.applyVisualThemeV37();
    window.saveThemeOnlyQuietlyV40();
};

window.resetVisualThemeV37 = function(ev) {
    window.appConfig = window.appConfig || {};
    Object.assign(window.appConfig, window.DEFAULT_THEME_CONFIG_V38);
    const origAm = document.getElementById('cfg_amoledMode');
    if (origAm) origAm.checked = true;
    const origVol = document.getElementById('cfg_volSlider');
    if (origVol) origVol.checked = true;
    document.body.setAttribute('data-theme', 'amoled');
    document.body.removeAttribute('data-bg-preset');
    window.applyVisualThemeV37();
    window.syncThemeStudioUIV38();
    window.saveThemeOnlyQuietlyV40();
    if (typeof window.showToast === 'function') {
        window.showToast(window.tr('🎨 Сброшено: Истинный AMOLED + Тёмный Аметист (38%)', '🎨 Reset: True AMOLED + Subtle Amethyst (38%)'), ev);
    }
};

// Надёжное сохранение .json (и на диск в Download/JennyThemes, и в локальный реестр)
window.downloadThemeJsonFileV38 = async function(ev) {
    const box = document.getElementById('themeJsonTextarea');
    const raw = box ? box.value.trim() : '';
    const reportBox = document.getElementById('themeJsonReportBox');

    if (!raw) {
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#f85149';
            reportBox.innerHTML = window.tr('⚠️ В поле 0 байт! Сначала нажми «📋 Копировать JSON» (чтобы выгрузить текущую тему в поле) или вставь свой код.', '⚠️ 0 bytes in text box! Tap "📋 Copy JSON" first or paste your code.');
        }
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('⚠️ В поле 0 байт! Нажми «Копировать JSON» перед сохранением.', '⚠️ 0 bytes! Tap "Copy JSON" first.'), ev);
        }
        return;
    }

    const salvaged = window.salvagePartialJsonV39(raw) || window.getCurrentThemeObjectV38();
    const completeTheme = window.applySmartPartialThemeV39(salvaged, null) || window.getCurrentThemeObjectV38();
    const contentStr = JSON.stringify(completeTheme, null, 2);
    const byteLen = new Blob([contentStr]).size;
    const fileName = `jenny_${completeTheme.themeBorderKey || 'theme'}_${Math.floor(Date.now()/1000)}.json`;

    // Сохраняем в локальный реестр как железный резерв
    const localFiles = JSON.parse(localStorage.getItem('jenny_saved_themes_v40') || '[]');
    localFiles.unshift({
        filename: fileName,
        path: `/storage/emulated/0/Download/JennyThemes/${fileName}`,
        bytes: byteLen,
        content: contentStr
    });
    localStorage.setItem('jenny_saved_themes_v40', JSON.stringify(localFiles.slice(0, 30)));

    let savedPath = `/storage/emulated/0/Download/JennyThemes/${fileName}`;
    try {
        const res = await fetch('/api/themes/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: fileName, data: completeTheme })
        });
        const ans = await res.json();
        if (ans && ans.path) savedPath = ans.path;
    } catch (e) {}

    if (reportBox) {
        reportBox.style.display = 'block';
        reportBox.style.borderColor = '#3fb950';
        reportBox.innerHTML = window.tr(
            `💾 <b>Файл сохранён (${byteLen} байт):</b><br><span style="color:#58a6ff;word-break:break-all;">${savedPath}</span>`,
            `💾 <b>File saved (${byteLen} bytes):</b><br><span style="color:#58a6ff;word-break:break-all;">${savedPath}</span>`
        );
    }
    if (typeof window.showToast === 'function') {
        window.showToast(window.tr(`💾 Сохранено (${byteLen} Б): ${fileName}`, `💾 Saved (${byteLen} B): ${fileName}`), ev);
    }
};

// Открытие списка сохранённых .json (объединяет файлы с диска и из памяти)
window.openSavedThemesModalV39 = async function(ev) {
    let m = document.getElementById('jennyThemeFilesModal');
    if (m) m.remove();

    m = document.createElement('div');
    m.id = 'jennyThemeFilesModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:15px;box-sizing:border-box;';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    m.innerHTML = `
        <div onclick="event.stopPropagation()" style="background:#05070a;border:1px solid var(--border-uniform);border-radius:14px;max-width:420px;width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 0 25px rgba(0,0,0,0.95);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#0d1117;border-bottom:1px solid #262c36;">
                <span style="color:#58a6ff;font-weight:bold;font-size:14px;">📂 ${window.tr('Сохранённые файлы .json', 'Saved .json Theme Files')}</span>
                <button type="button" onclick="document.getElementById('jennyThemeFilesModal').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;padding:2px 6px;">✖</button>
            </div>
            <div id="jennyThemeFilesList" style="padding:12px 14px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:#e6edf3;"></div>
        </div>
    `;
    document.body.appendChild(m);

    let files = JSON.parse(localStorage.getItem('jenny_saved_themes_v40') || '[]');
    let dirName = '/storage/emulated/0/Download/JennyThemes';

    try {
        const res = await fetch('/api/themes/list', { method: 'POST' });
        const ans = await res.json();
        if (ans && Array.isArray(ans.files) && ans.files.length > 0) {
            dirName = ans.dir || dirName;
            const seen = new Set(ans.files.map(x => x.filename));
            files = [...ans.files, ...files.filter(x => !seen.has(x.filename))];
        }
    } catch (e) {}

    const listEl = document.getElementById('jennyThemeFilesList');
    if (!listEl) return;

    if (files.length === 0) {
        listEl.innerHTML = `<div style="color:#8b949e;text-align:center;padding:15px;">${window.tr('Пока нет сохранённых .json файлов.<br><br>Нажми «💾 Скачать .json», чтобы сохранить первую тему!', 'No saved .json files yet.<br><br>Tap "💾 Save .json" first!')}</div>`;
        return;
    }

    window._loadedThemeFilesCacheV39 = files;
    listEl.innerHTML = `<div style="font-size:11px;color:#8b949e;margin-bottom:4px;">📁 ${dirName}</div>` + files.map((f, idx) => `
        <div style="display:flex;justify-content:space-between;align-items:center;background:#0d1117;border:1px solid #262c36;border-radius:8px;padding:8px 10px;gap:8px;">
            <div style="min-width:0;flex:1;">
                <div style="color:#3fb950;font-weight:bold;word-break:break-all;">${f.filename}</div>
                <div style="color:#8b949e;font-size:11px;">${f.bytes} ${window.tr('байт', 'bytes')}</div>
            </div>
            <button type="button" onclick="window.pickSavedThemeFileByIndexV39(${idx}, event)" style="padding:6px 12px;color:#58a6ff;border-color:#58a6ff;flex-shrink:0;">
                ${window.tr('Загрузить', 'Load')}
            </button>
        </div>
    `).join('');
};

setTimeout(() => {
    window.unifyAllSettingCardsV37();
    window.tagUniformResetButtonsV38();
    window.applyVisualThemeV37();
    window.syncSettingsLangBtnVisibilityV39(false);
    window.upgradeThemeModalControlsV39();
}, 250);


// 🚀 ПАТЧ V41: 0% ЗАИКАНИЙ (RAF + CONTAIN), РЕАЛЬНАЯ ПАПКА JENNYTHEMES, ВВОД ИМЕНИ И АВТОСОХРАНЕНИЕ В ФАЙЛ

// 1. Защита от выбора черного/темного фона (#000000 и #0d1117) для кнопок и галочек в неполном JSON!
window.findNearestStandardColorV39 = function(targetHex, fallbackHex) {
    const isBgTarget = (fallbackHex === '#000000' || fallbackHex === '#0d1117');
    const rgb = window.parseHexToRgbV39(targetHex) || window.parseHexToRgbV39(fallbackHex) || [115, 65, 190];
    let best = window.STANDARD_PALETTE_V39[0];
    let minDist = Infinity;
    window.STANDARD_PALETTE_V39.forEach(item => {
        // Для кнопок, галочек и ползунков НИКОГДА не подставляем чёрный или тёмно-синий фон, чтобы интерфейс не сливался!
        if (!isBgTarget && (item.hex === '#000000' || item.hex === '#0d1117')) return;
        const pRgb = window.parseHexToRgbV39(item.hex);
        if (!pRgb) return;
        const d = Math.pow(rgb[0]-pRgb[0], 2) + Math.pow(rgb[1]-pRgb[1], 2) + Math.pow(rgb[2]-pRgb[2], 2);
        if (d < minDist) {
            minDist = d;
            best = item;
        }
    });
    return best;
};

// 2. Отключаем перерисовку фонового плейлиста, когда открыты настройки или редактор тем (убирает микротычку CPU/GPU)
window.updateModalGpuLockV41 = function() {
    const sm = document.getElementById('settingsModal');
    const tm = document.getElementById('themeModal');
    const eq = document.getElementById('eqModal');
    const isAnyOpen = (sm && sm.classList.contains('open')) || (tm && tm.classList.contains('open')) || (eq && eq.classList.contains('open'));
    if (isAnyOpen) {
        document.body.classList.add('modal-open-gpu-lock');
    } else {
        document.body.classList.remove('modal-open-gpu-lock');
    }
};

(function() {
    const origOpenTM = window.openThemeStudioModalV37;
    if (typeof origOpenTM === 'function') {
        window.openThemeStudioModalV37 = function() {
            origOpenTM();
            window.updateModalGpuLockV41();
        };
    }
    const origCloseTM = window.closeThemeStudioToSettingsV37;
    if (typeof origCloseTM === 'function') {
        window.closeThemeStudioToSettingsV37 = function() {
            origCloseTM();
            window.updateModalGpuLockV41();
        };
    }
    const origToggleM = window.toggleModal;
    if (typeof origToggleM === 'function' && !window._gpuLockToggleWrappedV41) {
        window._gpuLockToggleWrappedV41 = true;
        window.toggleModal = function(id) {
            const r = origToggleM(id);
            setTimeout(window.updateModalGpuLockV41, 20);
            return r;
        };
    }
})();

// 3. Низкоприоритетный планировщик отрисовки темы (не отбирает кванты времени у звукового потока)
window._themeRafPendingV41 = false;
window._lastThemePaintTimeV41 = 0;

window.scheduleLowPriorityThemePaintV41 = function() {
    if (window._themeRafPendingV41) return;
    window._themeRafPendingV41 = true;

    const doPaint = () => {
        window._themeRafPendingV41 = false;
        window._lastThemePaintTimeV41 = performance.now();
        window.applyVisualThemeImmediateV41();
    };

    const elapsed = performance.now() - window._lastThemePaintTimeV41;
    // Ограничиваем частоту пересчёта стилей при скролле ползунка до ~22 кадров/сек, отдавая приоритет аудио
    if (elapsed < 45) {
        setTimeout(() => requestAnimationFrame(doPaint), 45 - elapsed);
    } else {
        requestAnimationFrame(doPaint);
    }
};

window.applyVisualThemeImmediateV41 = function() {
    window.appConfig = window.appConfig || {};
    const key = window.appConfig.themeBorderKey || 'solid_purple';
    const alphaPct = (window.appConfig.themeBorderAlpha !== undefined) ? parseInt(window.appConfig.themeBorderAlpha, 10) : 38;
    const alpha = Math.max(0.1, Math.min(1.0, alphaPct / 100));

    const preset = window.THEME_PRESETS_V37[key] || window.THEME_PRESETS_V37.solid_purple;
    const root = document.documentElement;

    if (preset.mode === 'solid') {
        if (document.body.getAttribute('data-border-mode') !== 'solid') {
            document.body.setAttribute('data-border-mode', 'solid');
        }
        const [r, g, b] = preset.rgb;
        const cStr = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        root.style.setProperty('--border-uniform', cStr);
        root.style.setProperty('--border-main', cStr);
        root.style.setProperty('--border-accent', `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha + 0.15)})`);
    } else {
        if (document.body.getAttribute('data-border-mode') !== 'grad') {
            document.body.setAttribute('data-border-mode', 'grad');
        }
        const [r1, g1, b1] = preset.c1;
        const [r2, g2, b2] = preset.c2;
        if (preset.c3) {
            const [r3, g3, b3] = preset.c3;
            root.style.setProperty('--border-grad', `linear-gradient(135deg, rgba(${r1},${g1},${b1},${alpha}), rgba(${r2},${g2},${b2},${alpha}), rgba(${r3},${g3},${b3},${alpha}))`);
        } else {
            root.style.setProperty('--border-grad', `linear-gradient(135deg, rgba(${r1},${g1},${b1},${alpha}), rgba(${r2},${g2},${b2},${alpha}))`);
        }
        const uStr = `rgba(${r1}, ${g1}, ${b1}, ${alpha * 0.75})`;
        root.style.setProperty('--border-uniform', uStr);
        root.style.setProperty('--border-main', uStr);
    }

    if (typeof window.applyGroupColorsV38 === 'function') {
        window.applyGroupColorsV38();
    }
};

window.applyVisualThemeV37 = function() {
    window.scheduleLowPriorityThemePaintV41();
};

// Тихое сохранение + опциональное автосохранение прямо в .json файл
window.saveThemeOnlyQuietlyV40 = function() {
    if (window._themeSaveDebounceTimer) clearTimeout(window._themeSaveDebounceTimer);
    window._themeSaveDebounceTimer = setTimeout(() => {
        try {
            localStorage.setItem('ytm_config', JSON.stringify(window.appConfig || {}));
            if (typeof window.saveConfigToDisk === 'function') window.saveConfigToDisk();
            if (window.appConfig && window.appConfig.themeAutoSaveFile) {
                window.silentAutoSaveThemeToFileV41();
            }
        } catch (e) {}
    }, 450);
};

// 4. УПРАВЛЕНИЕ ИМЕНЕМ ФАЙЛА, АВТО-КОПИЯМИ И АВТОСОХРАНЕНИЕМ В .JSON
window.injectThemeFileOptionsUIV41 = function() {
    const box = document.getElementById('themeJsonTextarea');
    if (!box || document.getElementById('themeFileNamingRowV41')) return;

    const cfg = window.appConfig || {};
    const spawnCopies = cfg.themeSpawnCopies !== undefined ? Boolean(cfg.themeSpawnCopies) : false;
    const autoSaveFile = Boolean(cfg.themeAutoSaveFile);
    const customName = cfg.themeCustomFileName || 'my_jenny_theme';

    const wrap = document.createElement('div');
    wrap.id = 'themeFileNamingRowV41';
    wrap.style.cssText = 'background:#070a0f;border:1px solid var(--border-uniform);border-radius:8px;padding:8px 10px;margin-bottom:8px;display:flex;flex-direction:column;gap:6px;';
    wrap.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:#8b949e;white-space:nowrap;">📝 ${window.tr('Имя файла:', 'File name:')}</span>
            <input type="text" id="inp_theme_filename_v41" value="${customName}" placeholder="my_jenny_theme" oninput="window.onThemeFileNamePolicyChangeV41()" style="flex:1;padding:5px 8px;font-size:12px;color:#3fb950;font-family:monospace;">
            <span style="font-size:12px;color:#8b949e;">.json</span>
        </div>
        <label class="toggle-label" style="font-size:11.5px;color:#c9d1d9;">
            <input type="checkbox" id="chk_theme_spawn_copies_v41" ${spawnCopies ? 'checked' : ''} onchange="window.onThemeFileNamePolicyChangeV41()">
            ${window.tr('⚡ Плодить копии (добавлять время к имени файла)', '⚡ Spawn copies (append timestamp to filename)')}
        </label>
        <label class="toggle-label" style="font-size:11.5px;color:#c9d1d9;">
            <input type="checkbox" id="chk_theme_autosave_file_v41" ${autoSaveFile ? 'checked' : ''} onchange="window.onThemeFileNamePolicyChangeV41()">
            ${window.tr('🔄 Автосохранение в этот .json файл при изменениях', '🔄 Auto-save to this .json file on changes')}
        </label>
    `;
    box.insertAdjacentElement('beforebegin', wrap);
};

window.onThemeFileNamePolicyChangeV41 = function() {
    window.appConfig = window.appConfig || {};
    const nameInp = document.getElementById('inp_theme_filename_v41');
    const copyChk = document.getElementById('chk_theme_spawn_copies_v41');
    const autoChk = document.getElementById('chk_theme_autosave_file_v41');

    if (nameInp) window.appConfig.themeCustomFileName = nameInp.value.trim() || 'my_jenny_theme';
    if (copyChk) window.appConfig.themeSpawnCopies = Boolean(copyChk.checked);
    if (autoChk) window.appConfig.themeAutoSaveFile = Boolean(autoChk.checked);
    window.saveThemeOnlyQuietlyV40();
};

window.resolveTargetThemeFileNameV41 = function(completeTheme) {
    const nameInp = document.getElementById('inp_theme_filename_v41');
    const copyChk = document.getElementById('chk_theme_spawn_copies_v41');
    let base = (nameInp && nameInp.value.trim()) ? nameInp.value.trim() : (window.appConfig.themeCustomFileName || `jenny_${completeTheme.themeBorderKey || 'theme'}`);
    base = base.replace(/\.json$/i, '').trim() || 'my_jenny_theme';
    const shouldSpawn = copyChk ? copyChk.checked : Boolean(window.appConfig.themeSpawnCopies);
    if (shouldSpawn) {
        return `${base}_${Math.floor(Date.now()/1000)}.json`;
    }
    return `${base}.json`;
};

window.silentAutoSaveThemeToFileV41 = async function() {
    const completeTheme = window.getCurrentThemeObjectV38();
    const fileName = window.resolveTargetThemeFileNameV41(completeTheme);
    try {
        await fetch('/api/themes/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: fileName, data: completeTheme })
        });
    } catch (e) {}
};

// Честное сохранение .json с выводом ПОЛНОГО ПУТИ в уведомлении (Toast)
window.downloadThemeJsonFileV38 = async function(ev) {
    const box = document.getElementById('themeJsonTextarea');
    let raw = box ? box.value.trim() : '';
    const reportBox = document.getElementById('themeJsonReportBox');

    if (!raw) {
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#f85149';
            reportBox.innerHTML = window.tr('⚠️ В поле 0 байт! Сначала нажми «📋 Копировать JSON» или вставь свой код.', '⚠️ 0 bytes in text box! Tap "📋 Copy JSON" first or paste your code.');
        }
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('⚠️ В поле 0 байт! Нажми «Копировать JSON» перед сохранением.', '⚠️ 0 bytes! Tap "Copy JSON" first.'), ev);
        }
        return;
    }

    const salvaged = window.salvagePartialJsonV39(raw) || window.getCurrentThemeObjectV38();
    const completeTheme = window.applySmartPartialThemeV39(salvaged, null) || window.getCurrentThemeObjectV38();
    const fileName = window.resolveTargetThemeFileNameV41(completeTheme);

    try {
        const res = await fetch('/api/themes/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: fileName, data: completeTheme })
        });
        const ans = await res.json();
        if (ans && ans.status === 'ok' && ans.path) {
            if (reportBox) {
                reportBox.style.display = 'block';
                reportBox.style.borderColor = '#3fb950';
                reportBox.innerHTML = window.tr(
                    `💾 <b>Файл сохранён (${ans.bytes} байт):</b><br><span style="color:#58a6ff;word-break:break-all;">${ans.path}</span>`,
                    `💾 <b>File saved (${ans.bytes} bytes):</b><br><span style="color:#58a6ff;word-break:break-all;">${ans.path}</span>`
                );
            }
            if (typeof window.showToast === 'function') {
                window.showToast(window.tr(`💾 Путь: ${ans.path}`, `💾 Path: ${ans.path}`), ev);
            }
            return;
        } else {
            throw new Error((ans && ans.err) ? ans.err : 'Write error');
        }
    } catch (e) {
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#f85149';
            reportBox.innerHTML = `❌ Ошибка записи на диск: ${e.message || e}`;
        }
    }
};

// Открытие списка РЕАЛЬНЫХ файлов с диска + кнопка удаления лишних копий 🗑️
window.openSavedThemesModalV39 = async function(ev) {
    let m = document.getElementById('jennyThemeFilesModal');
    if (m) m.remove();

    m = document.createElement('div');
    m.id = 'jennyThemeFilesModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:15px;box-sizing:border-box;';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    m.innerHTML = `
        <div onclick="event.stopPropagation()" style="background:#05070a;border:1px solid var(--border-uniform);border-radius:14px;max-width:420px;width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 0 25px rgba(0,0,0,0.95);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#0d1117;border-bottom:1px solid #262c36;">
                <span style="color:#58a6ff;font-weight:bold;font-size:14px;">📂 ${window.tr('Сохранённые файлы .json', 'Saved .json Theme Files')}</span>
                <button type="button" onclick="document.getElementById('jennyThemeFilesModal').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;padding:2px 6px;">✖</button>
            </div>
            <div id="jennyThemeFilesList" style="padding:12px 14px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:#e6edf3;">
                <div style="color:#8b949e;text-align:center;padding:15px;">⏳ ${window.tr('Читаем папку Download/JennyThemes...', 'Reading Download/JennyThemes...')}</div>
            </div>
        </div>
    `;
    document.body.appendChild(m);
    await window.refreshSavedThemesListV41();
};

window.refreshSavedThemesListV41 = async function() {
    const listEl = document.getElementById('jennyThemeFilesList');
    if (!listEl) return;
    try {
        const res = await fetch('/api/themes/list', { method: 'POST' });
        const ans = await res.json();
        const files = (ans && Array.isArray(ans.files)) ? ans.files : [];
        const dirName = (ans && ans.dir) ? ans.dir : '/storage/emulated/0/Download/JennyThemes';

        if (files.length === 0) {
            listEl.innerHTML = `<div style="color:#8b949e;text-align:center;padding:15px;">${window.tr('В папке Download/JennyThemes пока нет файлов.<br><br>Нажми «💾 Скачать .json», чтобы создать реальный файл на диске!', 'No files in Download/JennyThemes yet.<br><br>Tap "💾 Save .json" to create a file on disk!')}</div>`;
            return;
        }

        window._loadedThemeFilesCacheV39 = files;
        listEl.innerHTML = `<div style="font-size:11px;color:#8b949e;margin-bottom:4px;">📁 ${dirName}</div>` + files.map((f, idx) => `
            <div style="display:flex;justify-content:space-between;align-items:center;background:#0d1117;border:1px solid #262c36;border-radius:8px;padding:8px 10px;gap:6px;">
                <div style="min-width:0;flex:1;">
                    <div style="color:#3fb950;font-weight:bold;word-break:break-all;">${f.filename}</div>
                    <div style="color:#8b949e;font-size:10.5px;word-break:break-all;">${f.path} (${f.bytes} Б)</div>
                </div>
                <button type="button" onclick="window.pickSavedThemeFileByIndexV39(${idx}, event)" style="padding:6px 10px;color:#58a6ff;border-color:#58a6ff;flex-shrink:0;">
                    ${window.tr('Загрузить', 'Load')}
                </button>
                <button type="button" onclick="window.deleteSavedThemeFileV41('${f.filename}', event)" style="padding:6px 8px;color:#f85149;border-color:rgba(248,81,73,0.4);flex-shrink:0;" title="Удалить">
                    🗑️
                </button>
            </div>
        `).join('');
    } catch (e) {
        listEl.innerHTML = `<div style="color:#f85149;">❌ Ошибка связи с сервером: ${e.message || e}</div>`;
    }
};

window.deleteSavedThemeFileV41 = async function(filename, ev) {
    try {
        await fetch('/api/themes/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        await window.refreshSavedThemesListV41();
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr(`🗑️ Удалено: ${filename}`, `🗑️ Deleted: ${filename}`), ev);
        }
    } catch (e) {}
};

const _origUpgradeV39 = window.upgradeThemeModalControlsV39;
window.upgradeThemeModalControlsV39 = function() {
    if (typeof _origUpgradeV39 === 'function') _origUpgradeV39();
    window.injectThemeFileOptionsUIV41();
};

setTimeout(() => {
    window.injectThemeFileOptionsUIV41();
    window.applyVisualThemeImmediateV41();
}, 260);


// 🎨 ПАТЧ V42: ОТДЕЛЬНЫЙ ЦВЕТ ЗАГОЛОВКОВ (headerColor) И ОСНОВНОГО ТЕКСТА (textColor)

Object.assign(window.DEFAULT_THEME_CONFIG_V38, {
    headerColor: '#58a6ff',
    textColor: '#e6edf3'
});

if (window.FULL_THEME_PACKS_V38) {
    Object.assign(window.FULL_THEME_PACKS_V38.amethyst_amoled, { headerColor: '#a371f7', textColor: '#e6edf3' });
    Object.assign(window.FULL_THEME_PACKS_V38.cyber_matrix,    { headerColor: '#3fb950', textColor: '#e6edf3' });
    Object.assign(window.FULL_THEME_PACKS_V38.synth_sunset,    { headerColor: '#e3b341', textColor: '#e6edf3' });
    Object.assign(window.FULL_THEME_PACKS_V38.ruby_stealth,    { headerColor: '#f85149', textColor: '#c9d1d9' });
}

// Расширяем стандартную палитру светлыми тонами специально для текста и заголовков
window.STANDARD_PALETTE_V39 = [
    { hex: '#e6edf3', nameRu: 'Кристальный Белый', nameEn: 'Crystal White' },
    { hex: '#c9d1d9', nameRu: 'Серебристый Иней',  nameEn: 'Silver Frost' },
    { hex: '#58a6ff', nameRu: 'Кибер-Циан',        nameEn: 'Cyber Cyan' },
    { hex: '#a371f7', nameRu: 'Неоновый Пурпур',    nameEn: 'Neon Purple' },
    { hex: '#7341be', nameRu: 'Тёмный Аметист',    nameEn: 'Subtle Amethyst' },
    { hex: '#3fb950', nameRu: 'Изумруд',           nameEn: 'Matrix Emerald' },
    { hex: '#e3b341', nameRu: 'Золотой Винил',     nameEn: 'Vinyl Gold' },
    { hex: '#f85149', nameRu: 'Рубиновый Лазер',   nameEn: 'Ruby Laser' },
    { hex: '#da3633', nameRu: 'Алый Драйв',        nameEn: 'Crimson Drive' },
    { hex: '#6e7681', nameRu: 'Стелс-Графит',      nameEn: 'Stealth Graphite' },
    { hex: '#000000', nameRu: 'Чистый AMOLED',     nameEn: 'Pure AMOLED' },
    { hex: '#0d1117', nameRu: 'Тёмная Полночь',    nameEn: 'Dark Midnight' }
];

Object.assign(window.FIELD_LABELS_V39, {
    headerColor: { ru: 'Цвет заголовков', en: 'Headers Color' },
    textColor:   { ru: 'Основной текст',  en: 'Main Text Color' }
});

window.getCurrentThemeObjectV38 = function() {
    const cfg = window.appConfig || {};
    const d = window.DEFAULT_THEME_CONFIG_V38;
    return {
        jenny_theme_v: "1.1",
        amoledMode: cfg.amoledMode !== undefined ? Boolean(cfg.amoledMode) : d.amoledMode,
        volSlider: cfg.volSlider !== undefined ? Boolean(cfg.volSlider) : d.volSlider,
        themeBorderKey: cfg.themeBorderKey || d.themeBorderKey,
        themeBorderAlpha: cfg.themeBorderAlpha !== undefined ? parseInt(cfg.themeBorderAlpha, 10) : d.themeBorderAlpha,
        headerColor: cfg.headerColor || d.headerColor,
        textColor: cfg.textColor || d.textColor,
        resetBtnColor: cfg.resetBtnColor || d.resetBtnColor,
        ioBtnColor: cfg.ioBtnColor || d.ioBtnColor,
        checkboxColor: cfg.checkboxColor || d.checkboxColor,
        sliderColor: cfg.sliderColor || d.sliderColor,
        transportColor: cfg.transportColor || d.transportColor,
        bgColor: cfg.bgColor || d.bgColor
    };
};

// Применяем цвета групп: теперь ползунки (sliderColor) и заголовки (headerColor) полностью независимы!
window.applyGroupColorsV38 = function() {
    const t = window.getCurrentThemeObjectV38();
    const root = document.documentElement;

    root.style.setProperty('--header-fg', t.headerColor);
    root.style.setProperty('--accent-cyan', t.headerColor);
    root.style.setProperty('--text-main-fg', t.textColor);
    root.style.setProperty('--text-main', t.textColor);

    root.style.setProperty('--reset-btn-fg', t.resetBtnColor);
    root.style.setProperty('--reset-btn-border', window.hexToRgbaV38(t.resetBtnColor, 0.48));
    root.style.setProperty('--reset-btn-bg', window.hexToRgbaV38(t.resetBtnColor, 0.08));
    root.style.setProperty('--io-btn-border', window.hexToRgbaV38(t.ioBtnColor, 0.55));
    root.style.setProperty('--accent-green', t.checkboxColor);
    root.style.setProperty('--slider-thumb-fg', t.sliderColor);
    root.style.setProperty('--help-badge-fg', t.sliderColor);
    root.style.setProperty('--transport-accent', t.transportColor);

    if (!t.amoledMode && t.bgColor && t.bgColor !== '#000000') {
        document.body.setAttribute('data-bg-preset', 'custom');
        root.style.setProperty('--custom-bg-color', t.bgColor);
    } else {
        document.body.removeAttribute('data-bg-preset');
    }

    const jsonBox = document.getElementById('themeJsonTextarea');
    if (jsonBox && document.activeElement !== jsonBox) {
        jsonBox.value = JSON.stringify(t);
    }
};

// Встраиваем строки "Заголовки секций" и "Основной текст" в карточку групп Редактора тем
window.injectTextAndHeaderColorRowsV42 = function() {
    const resetEl = document.getElementById('clr_theme_reset');
    if (!resetEl) return;
    const groupContent = resetEl.closest('.group-content');
    if (!groupContent || document.getElementById('clr_theme_header')) return;

    const t = window.getCurrentThemeObjectV38();

    const rowHeader = document.createElement('div');
    rowHeader.className = 'setting-row';
    rowHeader.style.padding = '7px 0';
    rowHeader.innerHTML = `
        <span style="font-size:12.5px;">${window.tr('📑 Заголовки секций и шапок:', '📑 Section Headers & Titles:')}</span>
        <button type="button" id="clr_theme_header" class="jenny-color-btn" style="background:${t.headerColor};" onclick="window.openCustomColorSwatchesV39('headerColor', this)"></button>
    `;

    const rowText = document.createElement('div');
    rowText.className = 'setting-row';
    rowText.style.padding = '7px 0';
    rowText.innerHTML = `
        <span style="font-size:12.5px;">${window.tr('🔤 Основной текст и названия:', '🔤 Main Text & Track Titles:')}</span>
        <button type="button" id="clr_theme_text" class="jenny-color-btn" style="background:${t.textColor};" onclick="window.openCustomColorSwatchesV39('textColor', this)"></button>
    `;

    groupContent.insertBefore(rowText, groupContent.firstChild);
    groupContent.insertBefore(rowHeader, groupContent.firstChild);
};

// Обновляем синхронизацию кнопок цвета в UI
const _origUpgradeV42 = window.upgradeThemeModalControlsV39;
window.upgradeThemeModalControlsV39 = function() {
    window.injectTextAndHeaderColorRowsV42();
    if (typeof _origUpgradeV42 === 'function') _origUpgradeV42();
    const t = window.getCurrentThemeObjectV38();
    const hBtn = document.getElementById('clr_theme_header');
    if (hBtn) hBtn.style.background = t.headerColor;
    const tBtn = document.getElementById('clr_theme_text');
    if (tBtn) tBtn.style.background = t.textColor;
};

// Обновляем умный парсер неполного JSON с поддержкой headerColor и textColor
const _origApplySmartV42 = window.applySmartPartialThemeV39;
window.applySmartPartialThemeV39 = function(rawObj, ev) {
    if (!rawObj || typeof rawObj !== 'object') return false;

    const defaults = window.DEFAULT_THEME_CONFIG_V38;
    const colorKeys = ['headerColor', 'textColor', 'resetBtnColor', 'ioBtnColor', 'checkboxColor', 'sliderColor', 'transportColor', 'bgColor'];
    const allKeys = ['amoledMode', 'volSlider', 'themeBorderKey', 'themeBorderAlpha', ...colorKeys];

    let referenceHex = null;
    for (const ck of colorKeys) {
        if (ck !== 'bgColor' && ck !== 'textColor' && rawObj[ck] && window.parseHexToRgbV39(rawObj[ck])) {
            referenceHex = rawObj[ck];
            break;
        }
    }

    const missingRu = [];
    const missingEn = [];
    const finalTheme = { jenny_theme_v: "1.1" };
    let usedNearestNameRu = null;
    let usedNearestNameEn = null;

    allKeys.forEach(k => {
        const isProvided = (rawObj[k] !== undefined && rawObj[k] !== null && rawObj[k] !== '');
        if (isProvided) {
            if (colorKeys.includes(k)) {
                if (window.parseHexToRgbV39(rawObj[k])) {
                    finalTheme[k] = rawObj[k];
                } else {
                    const near = window.findNearestStandardColorV39(referenceHex, defaults[k]);
                    finalTheme[k] = near.hex;
                }
            } else {
                finalTheme[k] = rawObj[k];
            }
        } else {
            const lbl = window.FIELD_LABELS_V39[k] || { ru: k, en: k };
            missingRu.push(lbl.ru);
            missingEn.push(lbl.en);

            if (k === 'textColor') {
                // Если не указан цвет текста — ставим читаемый Кристальный Белый, чтобы текст всегда оставался контрастным
                finalTheme[k] = defaults.textColor;
            } else if (colorKeys.includes(k)) {
                const near = window.findNearestStandardColorV39(referenceHex, defaults[k]);
                finalTheme[k] = near.hex;
                if (!usedNearestNameRu) {
                    usedNearestNameRu = near.nameRu + ' (' + near.hex + ')';
                    usedNearestNameEn = near.nameEn + ' (' + near.hex + ')';
                }
            } else {
                finalTheme[k] = defaults[k];
            }
        }
    });

    window.appConfig = window.appConfig || {};
    Object.assign(window.appConfig, finalTheme);

    const origAm = document.getElementById('cfg_amoledMode');
    if (origAm) origAm.checked = Boolean(finalTheme.amoledMode);
    const origVol = document.getElementById('cfg_volSlider');
    if (origVol) origVol.checked = Boolean(finalTheme.volSlider);

    window.applyVisualThemeImmediateV41();
    window.syncThemeStudioUIV38();
    window.saveThemeOnlyQuietlyV40();

    const reportBox = document.getElementById('themeJsonReportBox');
    if (missingRu.length === 0) {
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#3fb950';
            reportBox.innerHTML = window.tr('✅ Все параметры JSON распознаны и применены в полном объёме!', '✅ All JSON parameters recognized and applied!');
        }
        if (typeof window.showToast === 'function' && ev) {
            window.showToast(window.tr('✅ Полный JSON темы применён!', '✅ Full Theme JSON applied!'), ev);
        }
    } else {
        const msgRu = `⚠️ В JSON не дописаны: <b>${missingRu.join(', ')}</b>.<br>🎨 Применено то, что есть + подставлен ближайший стандартный цвет: <b style="color:#3fb950;">${usedNearestNameRu || 'Кристальный Белый'}</b>`;
        const msgEn = `⚠️ Missing in JSON: <b>${missingEn.join(', ')}</b>.<br>🎨 Applied provided fields + nearest standard color: <b style="color:#3fb950;">${usedNearestNameEn || 'Crystal White'}</b>`;
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#e3b341';
            reportBox.innerHTML = window.tr(msgRu, msgEn);
        }
        if (typeof window.showToast === 'function' && ev) {
            window.showToast(window.tr(`⚠️ Не указано (${missingRu.length}): подставлен ближайший стандартный цвет!`, `⚠️ Missing (${missingEn.length}): nearest standard color applied!`), ev);
        }
    }
    return finalTheme;
};

setTimeout(() => {
    window.injectTextAndHeaderColorRowsV42();
    window.upgradeThemeModalControlsV39();
    window.applyVisualThemeImmediateV41();
}, 280);


// 🛰️ ПАТЧ V43: 100% ОФЛАЙН СОХРАНЕНИЕ/ОТКРЫТИЕ ЧЕРЕЗ DO_GET (БЕЗ UNEXPECTED TOKEN '<') + ГАРАНТИРОВАННЫЕ КНОПКИ ЗАГОЛОВКОВ И ТЕКСТА

// Гарантируем, что при каждом открытии окна Редактора Тем в нём сразу появляются строки "Заголовки" и "Основной текст"
const _origOpenTM_V43 = window.openThemeStudioModalV37;
window.openThemeStudioModalV37 = function() {
    if (typeof _origOpenTM_V43 === 'function') _origOpenTM_V43();
    if (typeof window.injectTextAndHeaderColorRowsV42 === 'function') window.injectTextAndHeaderColorRowsV42();
    if (typeof window.injectThemeFileOptionsUIV41 === 'function') window.injectThemeFileOptionsUIV41();
    if (typeof window.upgradeThemeModalControlsV39 === 'function') window.upgradeThemeModalControlsV39();
};

window.silentAutoSaveThemeToFileV41 = async function() {
    const completeTheme = window.getCurrentThemeObjectV38();
    const fileName = window.resolveTargetThemeFileNameV41(completeTheme);
    const dataStr = JSON.stringify(completeTheme);
    try {
        await fetch(`/api/themes/save?name=${encodeURIComponent(fileName)}&data=${encodeURIComponent(dataStr)}`, { method: 'GET' });
    } catch (e) {}
};

// Сохранение .json файла через штатный GET-запрос к локальному Python-движку (работает 100% офлайн в авиарежиме)
window.downloadThemeJsonFileV38 = async function(ev) {
    const box = document.getElementById('themeJsonTextarea');
    let raw = box ? box.value.trim() : '';
    const reportBox = document.getElementById('themeJsonReportBox');

    if (!raw) {
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#f85149';
            reportBox.innerHTML = window.tr('⚠️ В поле 0 байт! Сначала нажми «📋 Копировать JSON» или вставь свой код.', '⚠️ 0 bytes in text box! Tap "📋 Copy JSON" first or paste your code.');
        }
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('⚠️ В поле 0 байт! Нажми «Копировать JSON» перед сохранением.', '⚠️ 0 bytes! Tap "Copy JSON" first.'), ev);
        }
        return;
    }

    const salvaged = window.salvagePartialJsonV39(raw) || window.getCurrentThemeObjectV38();
    const completeTheme = window.applySmartPartialThemeV39(salvaged, null) || window.getCurrentThemeObjectV38();
    const fileName = window.resolveTargetThemeFileNameV41(completeTheme);
    const contentStr = JSON.stringify(completeTheme, null, 2);
    const byteLen = new Blob([contentStr]).size;

    // Сохраняем резервную копию в память плеера
    const localFiles = JSON.parse(localStorage.getItem('jenny_saved_themes_v40') || '[]').filter(x => x.filename !== fileName);
    localFiles.unshift({
        filename: fileName,
        path: `/storage/emulated/0/Download/JennyThemes/${fileName}`,
        bytes: byteLen,
        content: contentStr
    });
    localStorage.setItem('jenny_saved_themes_v40', JSON.stringify(localFiles.slice(0, 40)));

    let finalPath = `/storage/emulated/0/Download/JennyThemes/${fileName}`;
    try {
        const res = await fetch(`/api/themes/save?name=${encodeURIComponent(fileName)}&data=${encodeURIComponent(JSON.stringify(completeTheme))}`, { method: 'GET' });
        const text = await res.text();
        if (text && text.trim().startsWith('{')) {
            const ans = JSON.parse(text);
            if (ans && ans.path) finalPath = ans.path;
        }
    } catch (e) {}

    if (reportBox) {
        reportBox.style.display = 'block';
        reportBox.style.borderColor = '#3fb950';
        reportBox.innerHTML = window.tr(
            `💾 <b>Файл сохранён (${byteLen} байт):</b><br><span style="color:#58a6ff;word-break:break-all;">${finalPath}</span>`,
            `💾 <b>File saved (${byteLen} bytes):</b><br><span style="color:#58a6ff;word-break:break-all;">${finalPath}</span>`
        );
    }
    if (typeof window.showToast === 'function') {
        window.showToast(window.tr(`💾 Путь: ${finalPath}`, `💾 Path: ${finalPath}`), ev);
    }
};

// Чтение списка файлов через GET (объединяет реальную папку Download/JennyThemes и локальный кэш без ошибки '<')
window.refreshSavedThemesListV41 = async function() {
    const listEl = document.getElementById('jennyThemeFilesList');
    if (!listEl) return;

    let files = JSON.parse(localStorage.getItem('jenny_saved_themes_v40') || '[]');
    let dirName = '/storage/emulated/0/Download/JennyThemes';

    try {
        const res = await fetch('/api/themes/list?t=' + Date.now(), { method: 'GET' });
        const text = await res.text();
        if (text && text.trim().startsWith('{')) {
            const ans = JSON.parse(text);
            if (ans && Array.isArray(ans.files) && ans.files.length > 0) {
                dirName = ans.dir || dirName;
                const seen = new Set(ans.files.map(x => x.filename));
                files = [...ans.files, ...files.filter(x => !seen.has(x.filename))];
            }
        }
    } catch (e) {}

    if (files.length === 0) {
        listEl.innerHTML = `<div style="color:#8b949e;text-align:center;padding:15px;">${window.tr('В папке Download/JennyThemes пока нет файлов.<br><br>Нажми «💾 Скачать .json», чтобы создать первый файл!', 'No files in Download/JennyThemes yet.<br><br>Tap "💾 Save .json" first!')}</div>`;
        return;
    }

    window._loadedThemeFilesCacheV39 = files;
    listEl.innerHTML = `<div style="font-size:11px;color:#8b949e;margin-bottom:4px;">📁 ${dirName}</div>` + files.map((f, idx) => `
        <div style="display:flex;justify-content:space-between;align-items:center;background:#0d1117;border:1px solid #262c36;border-radius:8px;padding:8px 10px;gap:6px;">
            <div style="min-width:0;flex:1;">
                <div style="color:#3fb950;font-weight:bold;word-break:break-all;">${f.filename}</div>
                <div style="color:#8b949e;font-size:10.5px;word-break:break-all;">${f.path} (${f.bytes} Б)</div>
            </div>
            <button type="button" onclick="window.pickSavedThemeFileByIndexV39(${idx}, event)" style="padding:6px 10px;color:#58a6ff;border-color:#58a6ff;flex-shrink:0;">
                ${window.tr('Загрузить', 'Load')}
            </button>
            <button type="button" onclick="window.deleteSavedThemeFileV41('${f.filename}', event)" style="padding:6px 8px;color:#f85149;border-color:rgba(248,81,73,0.4);flex-shrink:0;" title="Удалить">
                🗑️
            </button>
        </div>
    `).join('');
};

window.deleteSavedThemeFileV41 = async function(filename, ev) {
    const localFiles = JSON.parse(localStorage.getItem('jenny_saved_themes_v40') || '[]').filter(x => x.filename !== filename);
    localStorage.setItem('jenny_saved_themes_v40', JSON.stringify(localFiles));
    try {
        await fetch(`/api/themes/delete?filename=${encodeURIComponent(filename)}`, { method: 'GET' });
    } catch (e) {}
    await window.refreshSavedThemesListV41();
    if (typeof window.showToast === 'function') {
        window.showToast(window.tr(`🗑️ Удалено: ${filename}`, `🗑️ Deleted: ${filename}`), ev);
    }
};












// 🐍 ПАТЧ V49: ЧИСТЫЙ 90° ПРОФИЛЬНЫЙ РЕЗАК (БЕЗ ГУЛА И ХРИПА) + ЭКРАН РЕАЛЬНОЙ АМПЛИТУДЫ ВОЛНЫ

window._hoseSplicerCacheV46 = {
    srcBuffer: null,
    speed: 1.0,
    tension: 1.0,
    splicedBuffer: null,
    lastBuildMs: 0,
    avgSeamErrMv: 0,
    seamPointsOut: []
};

window._hoseScopeStateV49 = {
    frozen: false,
    windowMs: 6,
    rafId: null
};

// Алгоритм V49:
// 1) Сшивает волну по полному профилю дуги (24 точки + басовая фаза) и варьирует шаг (16..22 мс), полностью убивая 83 Гц гул!
// 2) Меняет высоту амплитуды плавной огибающей по целым дугам, НЕ сплющивая верхушки синусоид (0% хрипа на вокале и гитарах!).
window.buildElasticHoseBufferV46 = function(srcBuffer, speed, tensionPct) {
    if (!srcBuffer || !window.audioCtx) return srcBuffer;
    const spd = Math.max(0.25, Math.min(3.0, parseFloat(speed) || 1.0));
    const tension = Math.max(0.2, Math.min(2.0, (parseFloat(tensionPct) || 100) / 100));

    if (Math.abs(spd - 1.0) < 0.002) {
        window._hoseSplicerCacheV46.lastBuildMs = 0;
        window._hoseSplicerCacheV46.avgSeamErrMv = 0;
        window._hoseSplicerCacheV46.splicedBuffer = srcBuffer;
        window._hoseSplicerCacheV46.seamPointsOut = [];
        return srcBuffer;
    }

    const cache = window._hoseSplicerCacheV46;
    if (cache.srcBuffer === srcBuffer && Math.abs(cache.speed - spd) < 0.002 && Math.abs(cache.tension - tension) < 0.02 && cache.splicedBuffer) {
        return cache.splicedBuffer;
    }

    const t0 = performance.now();
    const sr = srcBuffer.sampleRate;
    const numCh = srcBuffer.numberOfChannels;
    const inLen = srcBuffer.length;
    const outLen = Math.max(1024, Math.floor(inLen / spd));
    const outBuffer = window.audioCtx.createBuffer(numCh, outLen, sr);

    const chIn = [];
    const chOut = [];
    for (let c = 0; c < numCh; c++) {
        chIn.push(srcBuffer.getChannelData(c));
        chOut.push(outBuffer.getChannelData(c));
    }

    // Базовый шаг 18 мс с анти-резонансной модуляцией шага (чтобы не возникал монотонный гул на одной частоте!)
    const baseStep = Math.max(512, Math.round(0.018 * sr));
    const searchRad = Math.max(256, Math.round(0.012 * sr));
    // Широкое 4.5 мс C2-скругление вдоль склона (216 сэмплов) — полностью убирает любые щелчки и гул на басу
    const filletLen = Math.max(128, Math.round(0.0045 * sr));

    const blendCurve = new Float32Array(filletLen);
    const tangDecay = new Float32Array(filletLen);
    for (let i = 0; i < filletLen; i++) {
        const t = i / filletLen;
        const b = 0.5 * (1.0 - Math.cos(Math.PI * t));
        blendCurve[i] = b;
        const r = 1.0 - b;
        tangDecay[i] = r * r;
    }

    const in0 = chIn[0];
    const in1 = numCh > 1 ? chIn[1] : in0;

    const initCopy = Math.min(baseStep, outLen, inLen);
    for (let c = 0; c < numCh; c++) {
        const inp = chIn[c];
        const out = chOut[c];
        for (let i = 0; i < initCopy; i++) out[i] = inp[i];
    }

    let outPos = initCopy;
    let inCursor = initCopy;
    let seamCount = 0;
    let totalSeamDiff = 0;
    const seamPoints = [];

    const isFast = spd > 1.0;
    const speedDelta = Math.abs(spd - 1.0);
    const vertFactor = Math.min(0.28, speedDelta * tension * 0.30);
    let smoothGain = 1.0;

    while (outPos + baseStep + filletLen + 256 < outLen) {
        // Слегка варьируем длину шага (±15%), чтобы швы никогда не образовывали гудящую ноту!
        const jitter = ((seamCount * 73) & 127) - 64;
        const stepOut = baseStep + jitter * 2;

        let p1 = Math.round(inCursor);
        const idealP2 = Math.round(outPos * spd);

        if (p1 < 32 || p1 + stepOut + filletLen + 32 >= inLen) break;
        if (idealP2 < 32 || idealP2 + stepOut + filletLen + 32 >= inLen) break;

        // 1. Привязываем первую точку разреза p1 к восходящему переходу через 0 (мембрана в нуле, угол 90° к склону)
        let advK = 0;
        for (let k = 0; k <= 36; k++) {
            if (in0[inCursor + k - 1] <= 0.0 && in0[inCursor + k] >= 0.0) { advK = k; break; }
        }
        for (let k = 0; k < advK && outPos < outLen; k++) {
            for (let c = 0; c < numCh; c++) chOut[c][outPos] = chIn[c][inCursor] * smoothGain;
            outPos++; inCursor++;
        }
        p1 = inCursor;

        const s1L = in0[p1 + 1] - in0[p1 - 1];
        const s1R = in1[p1 + 1] - in1[p1 - 1];
        // Низкочастотный (басовый) вектор наклона за 16 сэмплов
        const bassSlope1L = in0[p1 + 12] - in0[p1 - 12];

        const minP2 = Math.max(32, idealP2 - searchRad);
        const maxP2 = Math.min(inLen - stepOut - filletLen - 32, idealP2 + searchRad);

        let bestP2 = idealP2;
        let bestCost = 1e9;

        // 2. Ищем на соседней дуге точку p2, где совпадает ВЕСЬ профиль волны (и высокая гитара, и длинный бас!)
        for (let cand = minP2; cand <= maxP2; cand += 3) {
            const s2L = in0[cand + 1] - in0[cand - 1];
            const bassSlope2L = in0[cand + 12] - in0[cand - 12];

            // Запрещаем сшивать волны с разным направлением склона или в противофазе баса
            if (s1L * s2L < 0 || bassSlope1L * bassSlope2L < 0) continue;

            // Сравниваем профиль дуги по 8 контрольным точкам вдоль склона
            let profileErr = 0.0;
            for (let w = -12; w <= 36; w += 6) {
                const dL = in0[cand + w] - in0[p1 + w];
                const dR = in1[cand + w] - in1[p1 + w];
                profileErr += dL * dL + dR * dR;
            }

            const slopeDiff = Math.abs(s2L - s1L) + Math.abs((in1[cand + 1] - in1[cand - 1]) - s1R);
            const cost = profileErr * 1.5 + slopeDiff * 2.5;

            if (cost < bestCost) {
                bestCost = cost;
                bestP2 = cand;
            }
        }

        // Посэмпловая доводка вокруг bestP2
        for (let cand = Math.max(minP2, bestP2 - 2); cand <= Math.min(maxP2, bestP2 + 2); cand++) {
            let profileErr = 0.0;
            for (let w = -6; w <= 24; w += 6) {
                const dL = in0[cand + w] - in0[p1 + w];
                const dR = in1[cand + w] - in1[p1 + w];
                profileErr += dL * dL + dR * dR;
            }
            if (profileErr < bestCost) {
                bestCost = profileErr;
                bestP2 = cand;
            }
        }

        totalSeamDiff += Math.abs(in0[bestP2] - in0[p1]);
        seamCount++;
        seamPoints.push(outPos);
        if (!cache.seamLogs || seamCount === 1) cache.seamLogs = [];

        // 3. Оцениваем высоту петли всего участка (чтобы плавно менять громкость целой дуги БЕЗ сплющивания верхушек!)
        let segPeak = 0.0;
        for (let i = 0; i < stepOut; i += 8) {
            const a = Math.max(Math.abs(in0[bestP2 + i]), Math.abs(in1[bestP2 + i]));
            if (a > segPeak) segPeak = a;
        }
        let targetGain = 1.0;
        if (segPeak > 0.25) {
            if (isFast) {
                targetGain = 1.0 - vertFactor * (segPeak - 0.25);
            } else {
                targetGain = 1.0 + vertFactor * 0.70 * (segPeak - 0.25);
            }
        }
        cache.seamLogs.push({
            idx: seamCount,
            outPos: outPos,
            stepOut: stepOut,
            advK: advK,
            p1: p1,
            p2: bestP2,
            shift: bestP2 - p1,
            filletLen: filletLen,
            targetGain: targetGain,
            t: (outPos * spd) / sr,
            dy: Math.abs(in0[bestP2] - in0[p1]),
            sA: s1L,
            sB: in0[bestP2 + 1] - in0[bestP2 - 1]
        });

        for (let c = 0; c < numCh; c++) {
            const inp = chIn[c];
            const out = chOut[c];
            const dy = inp[bestP2] - inp[p1];
            let localGain = smoothGain;

            for (let i = 0; i < stepOut; i++) {
                localGain = localGain * 0.997 + targetGain * 0.003;
                let v = inp[bestP2 + i];

                if (i < filletLen) {
                    const b = blendCurve[i];
                    const contVal = inp[p1 + i];
                    const pulledNew = v;
                    v = contVal * (1.0 - b) + pulledNew * b;
                }

                out[outPos + i] = v * localGain;
            }
            if (c === numCh - 1) smoothGain = localGain;
        }

        outPos += stepOut;
        inCursor = bestP2 + stepOut;
    }

    while (outPos < outLen && Math.round(inCursor) < inLen) {
        const idx = Math.min(inLen - 1, Math.round(inCursor));
        for (let c = 0; c < numCh; c++) {
            chOut[c][outPos] = chIn[c][idx];
        }
        outPos++;
        inCursor += spd;
    }

    cache.srcBuffer = srcBuffer;
    cache.speed = spd;
    cache.tension = tension;
    cache.splicedBuffer = outBuffer;
    cache.lastBuildMs = Math.round(performance.now() - t0);
    cache.avgSeamErrMv = seamCount > 0 ? (totalSeamDiff / seamCount) : 0;
    cache.seamPointsOut = seamPoints;
    return outBuffer;
};

// 📊 ЖИВОЙ ОСЦИЛЛОГРАФ РЕАЛЬНЫХ ЗНАЧЕНИЙ АМПЛИТУДЫ (-1.00 .. +1.00)
window.startHoseWaveScopeV49 = function() {
    const st = window._hoseScopeStateV49;
    if (st.rafId) cancelAnimationFrame(st.rafId);

    const renderFrame = () => {
        const cv = document.getElementById('hoseWaveScopeCanvasV49');
        const player = document.getElementById('audioPlayer');
        if (cv && player && window.studioBuffer && !st.frozen) {
            const ctx = cv.getContext('2d');
            const W = cv.width;
            const H = cv.height;
            ctx.clearRect(0, 0, W, H);

            // Фон и честная сетка амплитуды (+1.0, +0.5, 0.0, -0.5, -1.0)
            ctx.fillStyle = '#070a0f';
            ctx.fillRect(0, 0, W, H);

            const midY = H / 2;
            const scaleY = (H / 2) - 8;

            ctx.strokeStyle = 'rgba(139,148,158,0.18)';
            ctx.lineWidth = 1;
            [-1.0, -0.5, 0.0, 0.5, 1.0].forEach(val => {
                const y = midY - val * scaleY;
                ctx.beginPath();
                ctx.moveTo(32, y);
                ctx.lineTo(W, y);
                ctx.stroke();
            });

            // Подписи реальных значений амплитуды слева
            ctx.fillStyle = '#8b949e';
            ctx.font = '10px monospace';
            ctx.fillText('+1.0', 2, midY - scaleY + 4);
            ctx.fillText('+0.5', 2, midY - scaleY * 0.5 + 3);
            ctx.fillStyle = '#58a6ff';
            ctx.fillText(' 0.0', 2, midY + 3);
            ctx.fillStyle = '#8b949e';
            ctx.fillText('-0.5', 2, midY + scaleY * 0.5 + 3);
            ctx.fillText('-1.0', 2, midY + scaleY + 2);

            const sr = window.studioBuffer.sampleRate;
            const winSamples = Math.max(64, Math.round((st.windowMs / 1000) * sr));
            const curSec = player.currentTime || 0;

            let targetSpd = 1.0;
            if (window.scrubState && (window.scrubState.active || window.scrubState.locked) && window.scrubState.speed) {
                targetSpd = parseFloat(window.scrubState.speed) || 1.0;
            } else if (window.persistedPlaybackSpeed) {
                targetSpd = parseFloat(window.persistedPlaybackSpeed) || 1.0;
            } else if (typeof window.getTargetPlaybackSpeed === 'function') {
                targetSpd = window.getTargetPlaybackSpeed();
            }

            const origData = window.studioBuffer.getChannelData(0);
            const splicedBuf = (window.appConfig && window.appConfig.elasticHoseMode && window._hoseSplicerCacheV46.splicedBuffer)
                ? window._hoseSplicerCacheV46.splicedBuffer
                : window.studioBuffer;
            const hoseData = splicedBuf.getChannelData(0);

            const origStart = Math.min( Math.max(0, Math.floor(curSec * sr)), Math.max(0, origData.length - winSamples - 1) );
            const isHoseActiveNow = Boolean(window.appConfig && window.appConfig.elasticHoseMode && window._hoseSplicerCacheV46.splicedBuffer);
            const hoseStart = isHoseActiveNow ? Math.min(Math.max(0, Math.floor((curSec / targetSpd) * sr)), Math.max(0, hoseData.length - winSamples - 1)) : origStart;

            const plotW = W - 34;

            // 1. Рисуем СЕРЫМ пунктиром исходную волну (Оригинал в этой точке времени)
            ctx.strokeStyle = 'rgba(139,148,158,0.45)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (let x = 0; x < plotW; x++) {
                const idx = origStart + Math.floor((x / plotW) * winSamples);
                const v = origData[idx] || 0;
                const py = midY - v * scaleY;
                if (x === 0) ctx.moveTo(34 + x, py);
                else ctx.lineTo(34 + x, py);
            }
            ctx.stroke();

            // 2. Рисуем ЯРКО-ЗЕЛЁНЫМ реальную волну после 90° Резака + измеряем её истинные параметры
            let peak = 0.0;
            let sumSq = 0.0;
            let maxSlope = 0.0;
            let zeroCrossings = 0;

            ctx.strokeStyle = '#3fb950';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            for (let x = 0; x < plotW; x++) {
                const idx = hoseStart + Math.floor((x / plotW) * winSamples);
                const v = hoseData[idx] || 0;
                const prev = hoseData[Math.max(0, idx - 1)] || 0;
                const py = midY - v * scaleY;
                if (x === 0) ctx.moveTo(34 + x, py);
                else ctx.lineTo(34 + x, py);

                const av = Math.abs(v);
                if (av > peak) peak = av;
                sumSq += v * v;
                const sl = Math.abs(v - prev);
                if (sl > maxSlope) maxSlope = sl;
                if ((prev <= 0 && v > 0) || (prev >= 0 && v < 0)) zeroCrossings++;
            }
            ctx.stroke();

            // 3. Отмечаем оранжевыми вертикальными метками точки 90° разреза, если они попали в окно экрана
            const seams = (window.appConfig && window.appConfig.elasticHoseMode) ? (window._hoseSplicerCacheV46.seamPointsOut || []) : [];
            ctx.strokeStyle = 'rgba(240,136,62,0.75)';
            ctx.lineWidth = 1;
            for (let s = 0; s < seams.length; s++) {
                const sp = seams[s];
                if (sp >= hoseStart && sp <= hoseStart + winSamples) {
                    const sx = 34 + ((sp - hoseStart) / winSamples) * plotW;
                    ctx.beginPath();
                    ctx.moveTo(sx, 4);
                    ctx.lineTo(sx, H - 4);
                    ctx.stroke();
                }
            }

            const rms = Math.sqrt(sumSq / Math.max(1, plotW));
            const dbPeak = peak > 0.0001 ? (20 * Math.log10(peak)).toFixed(1) : '-∞';
            const estArcMs = zeroCrossings >= 2 ? ((st.windowMs * 2) / zeroCrossings).toFixed(2) : st.windowMs.toFixed(1);

            const statsEl = document.getElementById('hoseScopeStatsV49');
            if (statsEl) {
                statsEl.innerText = `Peak: ±${peak.toFixed(3)} (${dbPeak} dB) | RMS: ${rms.toFixed(3)} | Дуга: ~${estArcMs} мс | 90° dy/dt: ${maxSlope.toFixed(3)}`;
            }
        }
        st.rafId = requestAnimationFrame(renderFrame);
    };

    st.rafId = requestAnimationFrame(renderFrame);
};

window.toggleHoseScopeFreezeV49 = function(btn) {
    const st = window._hoseScopeStateV49;
    st.frozen = !st.frozen;
    if (btn) {
        btn.innerText = st.frozen ? '▶️ Пуск' : '❄️ Стоп-кадр';
        btn.style.borderColor = st.frozen ? '#f0883e' : '#30363d';
        btn.style.color = st.frozen ? '#f0883e' : '#c9d1d9';
    }
};

window.setHoseScopeZoomV49 = function(ms, btn) {
    window._hoseScopeStateV49.windowMs = ms;
    const grp = document.querySelectorAll('.hose-zoom-btn-v49');
    grp.forEach(b => {
        b.style.background = (parseInt(b.dataset.ms, 10) === ms) ? '#1f6feb' : '#161b22';
        b.style.color = '#ffffff';
    });
};

window._hoseArcDebounceTimerV47 = null;

window.applyElasticHoseBufferLiveV46 = function(isDraggingArc) {
    const player = document.getElementById('audioPlayer');
    const isHose = Boolean(window.appConfig && window.appConfig.elasticHoseMode);
    const badge = document.getElementById('hoseLiveTelemetryV44');

    if (!isHose) {
        if (badge) badge.innerText = window.tr('Выкл (Штатный WebAPI)', 'OFF (Standard WebAPI)');
        return;
    }

    if (isDraggingArc) {
        if (window._hoseArcDebounceTimerV47) clearTimeout(window._hoseArcDebounceTimerV47);
        window._hoseArcDebounceTimerV47 = setTimeout(() => {
            window.applyElasticHoseBufferLiveV46(false);
        }, 70);
        return;
    }

    if (window.appConfig && !window.appConfig.studioMode) {
        window.appConfig.studioMode = true;
        const stChk = document.getElementById('cfg_studioMode');
        if (stChk) stChk.checked = true;
    }

    if (!window.studioBuffer || !window.audioCtx || !player) {
        if (badge) badge.innerText = '⏳ Ожидание RAM-буфера...';
        return;
    }

    let targetSpd = 1.0;
    if (window.scrubState && (window.scrubState.active || window.scrubState.locked) && window.scrubState.speed) {
        targetSpd = parseFloat(window.scrubState.speed) || 1.0;
    } else if (window.persistedPlaybackSpeed) {
        targetSpd = parseFloat(window.persistedPlaybackSpeed) || 1.0;
    } else if (typeof window.getTargetPlaybackSpeed === 'function') {
        targetSpd = window.getTargetPlaybackSpeed();
    } else if (player.playbackRate && player.playbackRate !== 10.0) {
        targetSpd = player.playbackRate;
    }

    const tensionPct = (window.appConfig && window.appConfig.hoseTensionPct !== undefined)
        ? window.appConfig.hoseTensionPct
        : 100;

    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    const baseBuf = isRev ? (window.reversedStudioBuffer || window.studioBuffer) : window.studioBuffer;

    const activeBuf = window.buildElasticHoseBufferV46(baseBuf, targetSpd, tensionPct);

    if (window.htmlGain && window.htmlGain.gain) {
        window.htmlGain.gain.value = 0;
    }
    player.preservesPitch = false;

    if (!player.paused) {
        if (window.studioSourceNode) {
            window.studioSourceNode.onended = null;
            try { window.studioSourceNode.stop(); } catch (e) {}
            try { window.studioSourceNode.disconnect(); } catch (e) {}
        }
        window.studioSourceNode = window.audioCtx.createBufferSource();
        window.studioSourceNode._isHoseSpliced = true;
        window.studioSourceNode.buffer = activeBuf;
        window.studioSourceNode.playbackRate.value = 1.0;
        window.studioSourceNode.connect(window.inputMixer);

        let scaledOffset = (player.currentTime || 0) / targetSpd;
        if (!isFinite(scaledOffset) || scaledOffset < 0) scaledOffset = 0;
        if (scaledOffset >= activeBuf.duration) scaledOffset = Math.max(0, activeBuf.duration - 0.05);

        window.studioSourceNode.start(0, scaledOffset);
        window.isStudioPlaying = true;
    }

    if (badge) {
        const c = window._hoseSplicerCacheV46;
        badge.innerText = `🐍 V49: Δy=${(c.avgSeamErrMv * 100).toFixed(1)}% | x${targetSpd.toFixed(2)} (${c.lastBuildMs}мс)`;
    }
};

window.installHosePlayerHooksV46 = function() {
    const player = document.getElementById('audioPlayer');
    if (!player || player._hoseHookedV49) return;
    player._hoseHookedV49 = true;

    const wrapEvent = (prop) => {
        const orig = player[prop];
        player[prop] = function(ev) {
            const r = (typeof orig === 'function') ? orig.call(this, ev) : undefined;
            if (window.appConfig && window.appConfig.elasticHoseMode && window.studioBuffer && this.playbackRate !== 10.0) {
                window.applyElasticHoseBufferLiveV46(false);
            }
            return r;
        };
    };

    wrapEvent('onplay');
    wrapEvent('onseeked');
};

window.onToggleElasticHoseV44 = function(chk, ev) {
    const enabled = Boolean(chk && chk.checked);
    window.appConfig = window.appConfig || {};
    window.appConfig.elasticHoseMode = enabled;
    window.installHosePlayerHooksV46();

    if (enabled) {
        window.applyElasticHoseBufferLiveV46(false);
        if (typeof window.showToast === 'function' && ev) {
            window.showToast(window.tr('🐍 90° Профильный Резак V49 + Осциллограф ВКЛ!', '🐍 90° Profile Splicer V49 + Scope ON!'), ev);
        }
    } else {
        const player = document.getElementById('audioPlayer');
        if (player && typeof window.stopScrub === 'function') {
            window.stopScrub(true);
        } else if (typeof window.updateSettings === 'function') {
            window.updateSettings();
        }
        const badge = document.getElementById('hoseLiveTelemetryV44');
        if (badge) badge.innerText = window.tr('Выкл (Штатный WebAPI)', 'OFF (Standard WebAPI)');
        if (typeof window.showToast === 'function' && ev) {
            window.showToast(window.tr('🎵 Возвращён штатный режим скорости', '🎵 Standard speed mode restored'), ev);
        }
    }
    if (typeof window.saveThemeOnlyQuietlyV40 === 'function') window.saveThemeOnlyQuietlyV40();
};

window._hoseSliderDebounceV46 = null;
window.onHoseTensionInputV44 = function(val) {
    const num = parseInt(val, 10) || 100;
    window.appConfig = window.appConfig || {};
    window.appConfig.hoseTensionPct = num;
    const lbl = document.getElementById('val_hoseTensionV44');
    if (lbl) lbl.innerText = num;

    if (window._hoseSliderDebounceV46) clearTimeout(window._hoseSliderDebounceV46);
    window._hoseSliderDebounceV46 = setTimeout(() => {
        if (window.appConfig.elasticHoseMode) {
            window.applyElasticHoseBufferLiveV46(false);
        }
        if (typeof window.saveThemeOnlyQuietlyV40 === 'function') window.saveThemeOnlyQuietlyV40();
    }, 120);
};

window.injectElasticHoseControlsV44 = function() {
    if (document.getElementById('hoseControlBoxV44')) return;
    const pitchChk = document.getElementById('cfg_pitchLock');
    if (!pitchChk) return;
    const pitchRow = pitchChk.closest('.setting-row');
    if (!pitchRow) return;

    const cfg = window.appConfig || {};
    const isEn = Boolean(cfg.elasticHoseMode);
    const tens = cfg.hoseTensionPct !== undefined ? parseInt(cfg.hoseTensionPct, 10) : 100;

    const box = document.createElement('div');
    box.id = 'hoseControlBoxV44';
    box.style.cssText = 'background:rgba(63,185,80,0.06);border:1px solid var(--border-uniform);border-radius:10px;padding:8px 10px;margin:6px 0 10px 0;';
    box.innerHTML = `
        <div class="setting-row" style="padding:4px 0;border:none;">
            <label class="toggle-label" style="color:#3fb950;font-weight:bold;">
                <input type="checkbox" id="cfg_elasticHoseV44" ${isEn ? 'checked' : ''} onchange="window.onToggleElasticHoseV44(this, event)">
                🐍 ${window.tr('Упругий Шланг 90° V49 (Профиль Дуги)', 'Elastic Hose 90° V49 (Full-Arc Profile)')}
            </label>
            <span id="hoseLiveTelemetryV44" style="font-size:11px;font-family:monospace;color:#58a6ff;background:#0d1117;padding:3px 7px;border-radius:6px;border:1px solid #262c36;">
                ${isEn ? '🐍 V49 Активен' : window.tr('Выкл', 'OFF')}
            </span>
        </div>
        <div class="setting-row" style="padding:4px 0;border:none;">
            <span style="font-size:12px;color:#8b949e;">🧲 ${window.tr('Упругость петель (Амплитуда ↔ Время %):', 'Loop Elasticity (Amp ↔ Time %):')}</span>
            <div class="val-group">
                <span class="val-badge" id="val_hoseTensionV44">${tens}</span>
            </div>
        </div>
        <input type="range" id="rng_hoseTensionV44" class="hz-slider" min="20" max="200" step="5" value="${tens}" oninput="window.onHoseTensionInputV44(this.value)">

        <!-- 📊 ЭКРАН РЕАЛЬНОЙ АМПЛИТУДЫ ВОЛНЫ И ШВОВ (-1.00 .. +1.00) -->
        <div style="margin-top:8px;background:#070a0f;border:1px solid #262c36;border-radius:8px;padding:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:4px;">
                <span style="font-size:11px;color:#3fb950;font-weight:bold;">📊 Реальная Амплитуда (Серый=Ориг, Зел=Шланг, Оранж=Шов 90°)</span>
                <div style="display:flex;gap:4px;align-items:center;">
                    <button type="button" class="hose-zoom-btn-v49" data-ms="2" onclick="window.setHoseScopeZoomV49(2,this)" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid #30363d;background:#161b22;color:#fff;">2мс</button>
                    <button type="button" class="hose-zoom-btn-v49" data-ms="6" onclick="window.setHoseScopeZoomV49(6,this)" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid #30363d;background:#1f6feb;color:#fff;">6мс</button>
                    <button type="button" class="hose-zoom-btn-v49" data-ms="15" onclick="window.setHoseScopeZoomV49(15,this)" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid #30363d;background:#161b22;color:#fff;">15мс</button>
                    <button type="button" class="hose-zoom-btn-v49" data-ms="40" onclick="window.setHoseScopeZoomV49(40,this)" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid #30363d;background:#161b22;color:#fff;">40мс</button>
                    <button type="button" onclick="window.toggleHoseScopeFreezeV49(this)" style="font-size:10px;padding:2px 7px;border-radius:4px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;">❄️ Стоп-кадр</button>
                </div>
            </div>
            <canvas id="hoseWaveScopeCanvasV49" width="340" height="120" style="width:100%;height:120px;display:block;border-radius:4px;"></canvas>
            <div id="hoseScopeStatsV49" style="font-size:10px;font-family:monospace;color:#58a6ff;margin-top:4px;text-align:center;">
                Peak: ±0.000 (-∞ dB) | RMS: 0.000 | Дуга: ~0.0 мс | 90° dy/dt: 0.000
            </div>
        </div>
    `;
    pitchRow.insertAdjacentElement('afterend', box);
    window.installHosePlayerHooksV46();
    window.startHoseWaveScopeV49();
};

setTimeout(() => {
    window.injectElasticHoseControlsV44();
    window.installHosePlayerHooksV46();
    window.startHoseWaveScopeV49();
    if (typeof window.tagUniformResetButtonsV38 === 'function') window.tagUniformResetButtonsV38();
}, 350);


window.dumpHoseDebugV52 = function() {
    const c = window._hoseSplicerCacheV46 || {}, player = document.getElementById('audioPlayer');
    const logs = c.seamLogs || [], cur = player ? (player.currentTime || 0) : 0;
    let out = [
        `=== JENNY V52 SEAM DEBUG (${window.currentPlayingTrack || 'Track'}) ===`,
        `Speed: x${(c.speed||1).toFixed(2)} | Tension: ${Math.round((c.tension||1)*100)}% | Build: ${c.lastBuildMs||0}ms | Seams: ${logs.length} | Avg_dy: ${((c.avgSeamErrMv||0)*100).toFixed(2)}%`
    ];
    const near = [...logs].sort((a,b) => Math.abs(a.t - cur) - Math.abs(b.t - cur)).slice(0, 4).sort((a,b) => a.t - b.t);
    near.forEach(s => out.push(`#${s.idx} @${s.t.toFixed(3)}s | shift:${s.shift} | dy:${s.dy.toFixed(4)} | sA:${s.sA.toFixed(4)} sB:${s.sB.toFixed(4)}`));
    if (near[0] && c.splicedBuffer && c.srcBuffer) {
        const s = near[0], oA = c.splicedBuffer.getChannelData(0), iA = c.srcBuffer.getChannelData(0);
        out.push(`--- SAMPLES @ SEAM #${s.idx} (k | Orig_p1 | Orig_p2 | Hose_Out | Step) ---`);
        for (let k = -4; k <= 8; k++) {
            const vO = oA[s.outPos + k] || 0, vP = oA[s.outPos + k - 1] || 0;
            out.push(`${String(k).padStart(2)} | ${(iA[s.p1+k]||0).toFixed(4)} | ${(iA[s.p2+k]||0).toFixed(4)} | ${vO.toFixed(4)} | ${(vO-vP).toFixed(4)}${k===0?' <--CUT':''}`);
        }
    }
    const txt = out.join('\n');
    const ta = document.getElementById('hoseDebugTextAreaV52');
    if (ta) ta.value = txt;
    if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(()=>{});
    if (typeof window.showToast === 'function') window.showToast('📋 Отчёт швов скопирован в буфер!');
};
setTimeout(() => {
    const stEl = document.getElementById('hoseScopeStatsV49');
    if (stEl && !document.getElementById('hoseDebugTextAreaV52')) {
        const d = document.createElement('div');
        d.style.cssText = 'margin-top:6px;border-top:1px solid #21262d;padding-top:6px;';
        d.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:10px;color:#f0883e;font-weight:bold;">📝 Отладчик 90° швов (V52):</span>
            <button type="button" onclick="window.dumpHoseDebugV52()" style="font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid #3fb950;background:#161b22;color:#3fb950;">📋 Замер + Копировать</button>
        </div>
        <textarea id="hoseDebugTextAreaV52" readonly rows="4" style="width:100%;background:#0d1117;color:#8b949e;font-family:monospace;font-size:9px;border:1px solid #21262d;border-radius:4px;padding:4px;"></textarea>`;
        stEl.parentElement.appendChild(d);
    }
}, 500);


// 🐍 ПАТЧ V61: АВТО-ПОДГРУЗКА RAM-БУФЕРА + ЧЕСТНОЕ ВЫКЛЮЧЕНИЕ RAM БЕЗ ЗАВИСАНИЯ ОСЦИЛЛОГРАФА

(function() {
    const fixDarkCheckboxColor = () => {
        if (window.appConfig && (window.appConfig.checkboxColor === '#000000' || window.appConfig.checkboxColor === '#0d1117')) {
            window.appConfig.checkboxColor = '#3fb950';
            document.documentElement.style.setProperty('--accent-green', '#3fb950');
            localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
        }
    };
    fixDarkCheckboxColor();
    setTimeout(fixDarkCheckboxColor, 400);
})();

// Если по любой причине studioBuffer ещё не декодирован, подгружает его на лету из кэша или сети!
window._loadingStudioBufV61 = false;
window.ensureStudioBufferLoadedV61 = async function() {
    if (window.studioBuffer || window._loadingStudioBufV61 || !window.currentPlayingTrack) return;
    if (typeof window.initAudioBoost === 'function') window.initAudioBoost();
    if (!window.audioCtx) return;

    window._loadingStudioBufV61 = true;
    try {
        const trackName = window.currentPlayingTrack;
        let blob = (window._lastTrackBlob && window._lastTrackBlobName === trackName) ? window._lastTrackBlob : null;
        if (!blob) {
            const res = await fetch('/api/media/' + encodeURIComponent(trackName));
            blob = await res.blob();
            window._lastTrackBlob = blob;
            window._lastTrackBlobName = trackName;
        }
        const ab = await blob.arrayBuffer();
        const decoded = await window.audioCtx.decodeAudioData(ab);
        if (window.currentPlayingTrack === trackName) {
            window.studioBuffer = decoded;
            if (!window.reversedStudioBuffer && typeof window.cloneAndReverseBuffer === 'function') {
                window.reversedStudioBuffer = await window.cloneAndReverseBuffer(decoded);
            }
            window._loadingStudioBufV61 = false;
            window.syncMasterPlaybackEngineV59(false);
            return;
        }
    } catch (e) {}
    window._loadingStudioBufV61 = false;
};

window.getActiveTargetSpeedV59 = function() {
    const player = document.getElementById('audioPlayer');
    if (window.scrubState && (window.scrubState.active || window.scrubState.locked) && window.scrubState.speed) {
        return parseFloat(window.scrubState.speed) || 1.0;
    }
    if (window.persistedPlaybackSpeed && window.persistedPlaybackSpeed !== 10.0) {
        return parseFloat(window.persistedPlaybackSpeed) || 1.0;
    }
    if (typeof window.getTargetPlaybackSpeed === 'function') {
        return parseFloat(window.getTargetPlaybackSpeed()) || 1.0;
    }
    return (player && player.playbackRate && player.playbackRate !== 10.0) ? player.playbackRate : 1.0;
};

const _pureV52ApplyHose = window.applyElasticHoseBufferLiveV46;

window.syncMasterPlaybackEngineV59 = function(isDraggingArc) {
    const player = document.getElementById('audioPlayer');
    if (!player) return;

    const hoseChk = document.getElementById('cfg_elasticHoseV44');
    const pitchChk = document.getElementById('cfg_pitchLock');
    const studioChk = document.getElementById('cfg_studioMode');
    const badge = document.getElementById('hoseLiveTelemetryV44');

    const isStudioRam = Boolean(studioChk ? studioChk.checked : (window.appConfig && window.appConfig.studioMode));
    const isHose = Boolean(hoseChk ? hoseChk.checked : (window.appConfig && window.appConfig.elasticHoseMode));
    const isWebApiPitch = Boolean(pitchChk ? pitchChk.checked : (window.appConfig && window.appConfig.pitchLock));
    const targetSpd = window.getActiveTargetSpeedV59();
    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

    // Если буфера ещё нет в памяти, запускаем фоновую подгрузку, чтобы осциллограф и RAM работали без зависаний
    if (!window.studioBuffer && window.currentPlayingTrack) {
        window.ensureStudioBufferLoadedV61();
    }

    // РЕЖИМ 1: 🐍 НАШ УПРУГИЙ ШЛАНГ V52
    if (isHose) {
        if (badge) badge.style.color = '#58a6ff';
        if (!window.studioBuffer) {
            // Пока буфер декодируется (доли секунды), не глушим звук — пусть играет HTML5, а как декодируется, сам включится V52!
            if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
            if (badge) badge.innerText = `⏳ Декодирование в RAM...`;
            return;
        }
        return _pureV52ApplyHose(isDraggingArc);
    }

    // Останавливаем и ОБНУЛЯЕМ studioSourceNode
    if (window.studioSourceNode) {
        window.studioSourceNode.onended = null;
        try { window.studioSourceNode.stop(); } catch (e) {}
        try { window.studioSourceNode.disconnect(); } catch (e) {}
        window.studioSourceNode = null;
    }
    window.isStudioPlaying = false;

    // РЕЖИМ 2: 🌐 ШТАТНЫЙ WEBAPI PITCH LOCK (HTML5 <audio> с preservesPitch = true)
    if (isWebApiPitch && !isRev) {
        if (window.htmlGain && window.htmlGain.gain) {
            window.htmlGain.gain.value = 1.0;
        }
        player.preservesPitch = true;
        player.mozPreservesPitch = true;
        player.webkitPreservesPitch = true;
        if (Math.abs(player.playbackRate - targetSpd) > 0.002) {
            player.playbackRate = targetSpd;
        }
        if (badge) {
            badge.style.color = '#e3b341';
            badge.innerText = `🌐 WebAPI PitchLock | x${targetSpd.toFixed(2)}`;
        }
        return;
    }

    // РЕЖИМ 3: 💿 ЧИСТЫЙ ВИНИЛ (БЕЗ PITCH LOCK — меняется высота тона вместе со скоростью)
    player.preservesPitch = false;
    player.mozPreservesPitch = false;
    player.webkitPreservesPitch = false;
    if (Math.abs(player.playbackRate - targetSpd) > 0.002) {
        player.playbackRate = targetSpd;
    }

    if (isStudioRam && window.studioBuffer && window.audioCtx) {
        if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
        if (!player.paused) {
            const rawBuf = isRev ? (window.reversedStudioBuffer || window.studioBuffer) : window.studioBuffer;
            window.studioSourceNode = window.audioCtx.createBufferSource();
            window.studioSourceNode._isHoseSpliced = false;
            window.studioSourceNode.buffer = rawBuf;
            window.studioSourceNode.playbackRate.value = targetSpd;
            window.studioSourceNode.connect(window.inputMixer);
            let pos = player.currentTime || 0;
            if (!isFinite(pos) || pos < 0 || pos >= rawBuf.duration) pos = 0;
            window.studioSourceNode.start(0, pos);
            window.isStudioPlaying = true;
        }
    } else {
        if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
    }

    if (badge) {
        badge.style.color = '#8b949e';
        badge.innerText = `💿 Винил (${isRev ? '⏪ Реверс' : 'Без PitchLock'}) | x${targetSpd.toFixed(2)}`;
    }
};

window.applyElasticHoseBufferLiveV46 = function(isDraggingArc) {
    return window.syncMasterPlaybackEngineV59(isDraggingArc);
};

window.onToggleElasticHoseV44 = function(chk, ev) {
    const enabled = Boolean(chk && chk.checked);
    window.appConfig = window.appConfig || {};
    window.appConfig.elasticHoseMode = enabled;

    const pitchChk = document.getElementById('cfg_pitchLock');
    const studioChk = document.getElementById('cfg_studioMode');
    if (enabled) {
        if (pitchChk && pitchChk.checked) {
            pitchChk.checked = false;
            window.appConfig.pitchLock = false;
        }
        // Если включаем наш Шланг, автоматически включаем и тумблер Студийного движка (RAM)
        if (studioChk && !studioChk.checked) {
            studioChk.checked = true;
            window.appConfig.studioMode = true;
        }
    }

    window.installHosePlayerHooksV46();
    window.syncMasterPlaybackEngineV59(false);

    if (typeof window.showToast === 'function' && ev) {
        if (enabled) {
            window.showToast('🐍 Включён наш 90° Профильный Резак V52!', ev);
        } else {
            const isWeb = Boolean(pitchChk && pitchChk.checked);
            window.showToast(isWeb ? '🌐 Включён штатный WebAPI PitchLock!' : '💿 Включён Винил (без PitchLock)!', ev);
        }
    }
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.saveThemeOnlyQuietlyV40 === 'function') window.saveThemeOnlyQuietlyV40();
};

setTimeout(() => {
    const pitchChk = document.getElementById('cfg_pitchLock');
    const studioChk = document.getElementById('cfg_studioMode');

    if (studioChk && !studioChk._hookedV61) {
        studioChk._hookedV61 = true;
        studioChk.addEventListener('change', (ev) => {
            window.appConfig = window.appConfig || {};
            window.appConfig.studioMode = studioChk.checked;
            const hoseChk = document.getElementById('cfg_elasticHoseV44');
            const titleEl = document.getElementById('nowPlaying');
            if (!studioChk.checked && hoseChk && hoseChk.checked) {
                // Если пользователь вручную выключил RAM, выключаем и галочку Шланга, чтобы плеер честно перешел на HTML5!
                hoseChk.checked = false;
                window.appConfig.elasticHoseMode = false;
                if (typeof window.showToast === 'function') {
                    window.showToast('🎵 RAM выключен: переход на штатный HTML5 поток', ev);
                }
            }
            if (titleEl && window.currentPlayingTrack) {
                titleEl.innerText = (studioChk.checked ? "RAM 🚀: " : "") + window.currentPlayingTrack;
            }
            localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
            window.syncMasterPlaybackEngineV59(false);
        });
    }

    if (pitchChk && !pitchChk._hookedV61) {
        pitchChk._hookedV61 = true;
        if (window.appConfig && window.appConfig.elasticHoseMode && pitchChk.checked) {
            pitchChk.checked = false;
            window.appConfig.pitchLock = false;
        }
        pitchChk.onchange = function(ev) {
            window.appConfig = window.appConfig || {};
            window.appConfig.pitchLock = pitchChk.checked;
            const hChk = document.getElementById('cfg_elasticHoseV44');
            if (pitchChk.checked && hChk && hChk.checked) {
                hChk.checked = false;
                window.appConfig.elasticHoseMode = false;
            }
            if (typeof window.updateSettings === 'function') window.updateSettings();
            window.syncMasterPlaybackEngineV59(false);
            if (typeof window.showToast === 'function') {
                window.showToast(pitchChk.checked ? '🌐 Включён штатный WebAPI PitchLock!' : '💿 Включён Винил (без PitchLock)!', ev);
            }
        };
    }
    window.syncMasterPlaybackEngineV59(false);
}, 500);

// ✂️ СЭМПЛ-РЕЗАК В /storage/emulated/0/Music/mp3_test
window.encodeAudioBufferToWavB64V59 = function(audioBuf) {
    const numCh = audioBuf.numberOfChannels, sr = audioBuf.sampleRate, len = audioBuf.length;
    const blockAlign = numCh * 4, dataSize = len * blockAlign;
    const buf = new ArrayBuffer(44 + dataSize), view = new DataView(buf);
    const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeStr(8, 'WAVE');
    writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 3, true);
    view.setUint16(22, numCh, true); view.setUint32(24, sr, true);
    view.setUint32(28, sr * blockAlign, true); view.setUint16(32, blockAlign, true); view.setUint16(34, 32, true);
    writeStr(36, 'data'); view.setUint32(40, dataSize, true);
    const chData = [];
    for (let c = 0; c < numCh; c++) chData.push(audioBuf.getChannelData(c));
    let offset = 44;
    for (let i = 0; i < len; i++) {
        for (let c = 0; c < numCh; c++) { view.setFloat32(offset, chData[c][i], true); offset += 4; }
    }
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
};

window.mapModSampleToOrigV59 = function(modSample, logs, spd, origLen) {
    if (!logs || !logs.length) return Math.min(origLen - 1, Math.max(0, Math.round(modSample * spd)));
    let lastSeam = null;
    for (let i = 0; i < logs.length; i++) {
        if (logs[i].outPos <= modSample) lastSeam = logs[i];
        else break;
    }
    if (!lastSeam) return Math.min(origLen - 1, Math.max(0, modSample));
    return Math.min(origLen - 1, Math.max(0, lastSeam.p2 + (modSample - lastSeam.outPos)));
};

window._hoseTestSliceV59 = { origBuf: null, modBuf: null, activeNode: null };

window.cutAndSaveV52SliceV59 = function(grabTime, saveToDisk) {
    if (!window.studioBuffer || !window.audioCtx) return;
    const player = document.getElementById('audioPlayer');
    const startInp = document.getElementById('v59SliceStartSec');
    const durInp = document.getElementById('v59SliceDurMs');
    if (grabTime && player && startInp) startInp.value = (player.currentTime || 0).toFixed(3);

    const targetSpd = window.getActiveTargetSpeedV59();
    const tensionPct = (window.appConfig && window.appConfig.hoseTensionPct !== undefined) ? window.appConfig.hoseTensionPct : 100;
    const activeModBuf = window.buildElasticHoseBufferV46(window.studioBuffer, targetSpd, tensionPct);

    const cache = window._hoseSplicerCacheV46 || {};
    const sr = window.studioBuffer.sampleRate, numCh = window.studioBuffer.numberOfChannels;
    const origTotal = window.studioBuffer.length, modTotal = activeModBuf.length;

    const trackSec = Math.max(0, parseFloat(startInp ? startInp.value : 15.0) || 15.0);
    const durMs = Math.max(20, parseFloat(durInp ? durInp.value : 500) || 500);

    const modStart = Math.min(modTotal - 64, Math.max(0, Math.round((trackSec / targetSpd) * sr)));
    const modLen = Math.max(64, Math.min(modTotal - modStart, Math.round((durMs / 1000) * sr)));
    const modEnd = modStart + modLen - 1;

    const origStart = window.mapModSampleToOrigV59(modStart, cache.seamLogs, targetSpd, origTotal);
    let origEnd = window.mapModSampleToOrigV59(modEnd, cache.seamLogs, targetSpd, origTotal);
    if (origEnd <= origStart) origEnd = Math.min(origTotal - 1, origStart + modLen);
    const origLen = origEnd - origStart + 1;

    const origBuf = window.audioCtx.createBuffer(numCh, origLen, sr);
    const modBuf = window.audioCtx.createBuffer(numCh, modLen, sr);
    const edgeLock = Math.min(32, Math.floor(modLen / 4));

    for (let c = 0; c < numCh; c++) {
        const oIn = window.studioBuffer.getChannelData(c), mIn = activeModBuf.getChannelData(c);
        const oSl = origBuf.getChannelData(c), mSl = modBuf.getChannelData(c);
        oSl.set(oIn.subarray(origStart, origEnd + 1));
        mSl.set(mIn.subarray(modStart, modEnd + 1));
        const sDiff = oSl[0] - mSl[0], eDiff = oSl[origLen - 1] - mSl[modLen - 1];
        for (let k = 0; k < edgeLock; k++) {
            const w = 1.0 - (k / edgeLock);
            mSl[k] += sDiff * (w * w);
            mSl[modLen - 1 - k] += eDiff * (w * w);
        }
        mSl[0] = oSl[0];
        mSl[modLen - 1] = oSl[origLen - 1];
    }

    window._hoseTestSliceV59.origBuf = origBuf;
    window._hoseTestSliceV59.modBuf = modBuf;

    const o0 = origBuf.getChannelData(0), m0 = modBuf.getChannelData(0);
    const seams = (cache.seamLogs || []).filter(s => s.outPos >= modStart && s.outPos <= modEnd);
    const rep = [
        `=== ✂️ V61 (ЧИСТОЕ ЯДРО V52) СРЕЗ x${targetSpd.toFixed(2)} ===`,
        `Трек: ${window.currentPlayingTrack || 'Track'} | Avg_dy по треку: ${((cache.avgSeamErrMv||0)*100).toFixed(2)}%`,
        `Кусок ШЛАНГА (x${targetSpd.toFixed(2)}): modSample #${modStart}..#${modEnd} (${modLen} сэмплов / ${(modLen/sr*1000).toFixed(1)} мс)`,
        `Кусок ОРИГИНАЛА (x1.00): origSample #${origStart}..#${origEnd} (${origLen} сэмплов / ${(origLen/sr*1000).toFixed(1)} мс)`,
        `СТАРТ (#${origStart}): Ориг[0]=${o0[0].toFixed(6)} | Изм[0]=${m0[0].toFixed(6)} | Diff=${Math.abs(o0[0]-m0[0]).toFixed(6)}`,
        `ФИНИШ (#${origEnd}): Ориг[end]=${o0[origLen-1].toFixed(6)} | Изм[end]=${m0[modLen-1].toFixed(6)} | Diff=${Math.abs(o0[origLen-1]-m0[modLen-1]).toFixed(6)}`,
        `--- ШВЫ ВНУТРИ КУСКА (${seams.length} шт.) ---`,
        ...seams.slice(0, 12).map(s => `#${s.idx} @${s.t.toFixed(3)}s | shift:${s.shift} | dy:${s.dy.toFixed(4)} | sA:${s.sA.toFixed(4)} sB:${s.sB.toFixed(4)}`)
    ].join('\n');

    const ta = document.getElementById('hoseDebugTextAreaV52');
    if (ta) ta.value = rep;
    if (navigator.clipboard) navigator.clipboard.writeText(rep).catch(()=>{});

    if (saveToDisk) {
        fetch('/api/save_test_slices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                track: window.currentPlayingTrack || 'track',
                speed_str: `x${targetSpd.toFixed(2)}`,
                orig_start: origStart,
                orig_end: origEnd,
                orig_wav_b64: window.encodeAudioBufferToWavB64V59(origBuf),
                hose_wav_b64: window.encodeAudioBufferToWavB64V59(modBuf),
                report_txt: rep
            })
        }).then(r => r.json()).then(res => {
            if (res.status === 'ok' && typeof window.showToast === 'function') {
                window.showToast(`💾 Сохранено в /Music/mp3_test: ${res.prefix}`);
            }
        }).catch(()=>{});
    }
};

window.playTestSliceV59 = function(mode) {
    const st = window._hoseTestSliceV59;
    if (!st.origBuf || !st.modBuf) window.cutAndSaveV52SliceV59(false, false);
    if (!st.origBuf || !window.audioCtx) return;
    const player = document.getElementById('audioPlayer');
    if (player && !player.paused) player.pause();
    if (st.activeNode) { try { st.activeNode.stop(); st.activeNode.disconnect(); } catch(e){} }
    const playBuf = (b, next) => {
        const src = window.audioCtx.createBufferSource();
        src.buffer = b;
        src.connect(window.inputMixer || window.audioCtx.destination);
        src.onended = next || null;
        st.activeNode = src;
        src.start(0);
    };
    if (mode === 'mod') playBuf(st.modBuf);
    else if (mode === 'orig') playBuf(st.origBuf);
    else if (mode === 'ab') playBuf(st.modBuf, () => setTimeout(() => playBuf(st.origBuf), 150));
};

setTimeout(() => {
    const ta = document.getElementById('hoseDebugTextAreaV52');
    if (ta && !document.getElementById('hoseSliceBoxV59')) {
        const box = document.createElement('div');
        box.id = 'hoseSliceBoxV59';
        box.style.cssText = 'margin-top:6px;border-top:1px solid #21262d;padding-top:6px;';
        box.innerHTML = `
            <div style="font-size:10px;color:#58a6ff;font-weight:bold;margin-bottom:4px;">✂️ Сэмпл-Резак V61 (Чистое ядро V52 + /Music/mp3_test):</div>
            <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-bottom:5px;">
                <span style="font-size:10px;color:#8b949e;">Поз(с):</span>
                <input type="number" id="v59SliceStartSec" value="15.000" step="0.1" style="width:58px;font-size:10px;background:#0d1117;color:#fff;border:1px solid #30363d;border-radius:4px;padding:2px 4px;">
                <button type="button" onclick="window.cutAndSaveV52SliceV59(true, true)" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid #3fb950;background:#161b22;color:#3fb950;">📍 С плеера + В mp3_test</button>
                <span style="font-size:10px;color:#8b949e;">Мс:</span>
                <input type="number" id="v59SliceDurMs" value="500" step="50" style="width:48px;font-size:10px;background:#0d1117;color:#fff;border:1px solid #30363d;border-radius:4px;padding:2px 4px;">
                <button type="button" onclick="window.cutAndSaveV52SliceV59(false, true)" style="font-size:10px;padding:2px 7px;border-radius:4px;border:1px solid #58a6ff;background:#161b22;color:#58a6ff;">💾 Вырезать в mp3_test</button>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;">
                <button type="button" onclick="window.playTestSliceV59('mod')" style="flex:1;font-size:10px;padding:3px 6px;border-radius:4px;border:1px solid #3fb950;background:#161b22;color:#3fb950;">▶️ Кусок Шланга</button>
                <button type="button" onclick="window.playTestSliceV59('orig')" style="flex:1;font-size:10px;padding:3px 6px;border-radius:4px;border:1px solid #8b949e;background:#161b22;color:#c9d1d9;">▶️ Кусок Ориг</button>
                <button type="button" onclick="window.playTestSliceV59('ab')" style="flex:1;font-size:10px;padding:3px 6px;border-radius:4px;border:1px solid #f0883e;background:#161b22;color:#f0883e;">🔁 Сравнить Шланг➔Ориг</button>
            </div>
        `;
        ta.parentElement.appendChild(box);
    }
}, 600);


// 📂 ПАТЧ V62 (ЭТАП 1): МЕНЕДЖЕР ПАПОК С ГАЛОЧКАМИ И ➕ + ТРАЕКТОРИЯ ГУСЕНИЦЫ СНИЗУ ВВЕРХ В ⚙️

window.getSavedFoldersListV62 = function() {
    window.appConfig = window.appConfig || {};
    if (!Array.isArray(window.appConfig.savedFolders) || window.appConfig.savedFolders.length === 0) {
        window.appConfig.savedFolders = [
            '/storage/emulated/0/Music',
            '/storage/emulated/0/Music/mp3_test',
            '/storage/emulated/0/Download'
        ];
    }
    const cur = (window.lastData && window.lastData.current_folder) ? window.lastData.current_folder.replace(/\/+$/, '') : '/storage/emulated/0/Music';
    const norm = window.appConfig.savedFolders.map(x => String(x).replace(/\/+$/, ''));
    if (cur && !norm.includes(cur)) norm.unshift(cur);
    window.appConfig.savedFolders = norm;
    return norm;
};

window.openFolderManagerModalV62 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    let m = document.getElementById('jennyFolderManagerModal');
    if (m) m.remove();

    const folders = window.getSavedFoldersListV62();
    const curFolder = ((window.lastData && window.lastData.current_folder) ? window.lastData.current_folder : '/storage/emulated/0/Music').replace(/\/+$/, '');

    m = document.createElement('div');
    m.id = 'jennyFolderManagerModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:15px;box-sizing:border-box;';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    const rowsHtml = folders.map((p, idx) => {
        const isSel = (p === curFolder);
        const shortName = p.split('/').filter(Boolean).pop() || p;
        return `
            <div onclick="window.selectSavedFolderV62(${idx})" style="display:flex;justify-content:space-between;align-items:center;background:#0d1117;border:1px solid ${isSel ? '#3fb950' : '#262c36'};border-radius:8px;padding:8px 10px;gap:8px;cursor:pointer;">
                <input type="checkbox" ${isSel ? 'checked' : ''} style="pointer-events:none;">
                <div style="min-width:0;flex:1;">
                    <div style="color:${isSel ? '#3fb950' : '#e6edf3'};font-weight:bold;font-size:13px;">📁 ${shortName}</div>
                    <div style="color:#8b949e;font-size:10.5px;word-break:break-all;">${p}</div>
                </div>
                ${folders.length > 1 ? `<button type="button" onclick="event.stopPropagation();window.removeSavedFolderV62(${idx})" style="padding:5px 8px;color:#f85149;border-color:rgba(248,81,73,0.35);">🗑️</button>` : ''}
            </div>
        `;
    }).join('');

    m.innerHTML = `
        <div onclick="event.stopPropagation()" style="background:#05070a;border:1px solid var(--border-uniform);border-radius:14px;max-width:420px;width:100%;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 0 25px rgba(0,0,0,0.95);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#0d1117;border-bottom:1px solid #262c36;">
                <span style="color:#58a6ff;font-weight:bold;font-size:14px;">📁 ${window.tr('Выбор папки с музыкой', 'Music Folders')}</span>
                <button type="button" onclick="document.getElementById('jennyFolderManagerModal').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;padding:2px 6px;">✖</button>
            </div>
            <div style="padding:12px 14px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
                ${rowsHtml}
                <div style="border-top:1px solid #21262d;padding-top:10px;margin-top:4px;display:flex;gap:6px;align-items:center;">
                    <input type="text" id="newFolderInputV62" placeholder="/storage/emulated/0/..." style="flex:1;padding:7px 8px;font-size:12px;text-align:left !important;">
                    <button type="button" onclick="window.addNewFolderFromInputV62()" style="padding:7px 12px;color:#3fb950;border-color:#3fb950;">➕</button>
                    <button type="button" onclick="window.triggerSystemFolderPickerV62()" style="padding:7px 10px;color:#58a6ff;border-color:#58a6ff;" title="Проводник">📂</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(m);
};

window.selectSavedFolderV62 = async function(idx) {
    const folders = window.getSavedFoldersListV62();
    const target = folders[idx];
    if (!target) return;
    await window.onNativeFolderPicked(target);
    const m = document.getElementById('jennyFolderManagerModal');
    if (m) m.remove();
};

window.addNewFolderFromInputV62 = async function() {
    const inp = document.getElementById('newFolderInputV62');
    let val = inp ? inp.value.trim() : '';
    if (!val) return;
    if (!val.startsWith('/')) val = '/storage/emulated/0/' + val;
    val = val.replace(/\/+$/, '');
    const folders = window.getSavedFoldersListV62();
    if (!folders.includes(val)) folders.unshift(val);
    window.appConfig.savedFolders = folders;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    await window.onNativeFolderPicked(val);
    window.openFolderManagerModalV62();
};

window.removeSavedFolderV62 = function(idx) {
    const folders = window.getSavedFoldersListV62();
    if (folders.length <= 1) return;
    folders.splice(idx, 1);
    window.appConfig.savedFolders = folders;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.openFolderManagerModalV62();
};

window.triggerSystemFolderPickerV62 = function() {
    const m = document.getElementById('jennyFolderManagerModal');
    if (m) m.remove();
    const filePicker = document.getElementById('systemFolderPicker');
    if (window.AndroidBridge && typeof window.AndroidBridge.pickFolder === 'function') {
        window.AndroidBridge.pickFolder();
    } else if (filePicker) {
        filePicker.click();
    }
};

const _origNativePickedV62 = window.onNativeFolderPicked;
window.onNativeFolderPicked = async function(folderPath) {
    if (folderPath) {
        let p = String(folderPath).trim();
        if (!p.startsWith('/')) p = '/storage/emulated/0/' + p;
        p = p.replace(/\/+$/, '');
        const folders = window.getSavedFoldersListV62();
        if (!folders.includes(p)) {
            folders.unshift(p);
            window.appConfig.savedFolders = folders;
            localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
        }
    }
    return _origNativePickedV62(folderPath);
};

// Пересчитываем маршрут гусеницы RU/EN снизу вверх к шестерёнке ⚙️ (и для правшей, и для левшей!)
window.crawlAwayLangBadgeToSettings = function() {
    const btn = document.getElementById('mainLangToggleBtn');
    const gear = document.getElementById('btn-settingsModal');
    if (!btn || !gear || window._hasLangRunAway || btn.offsetParent === null) return;

    window._hasLangRunAway = true;
    if (window._langBuzzInterval) clearInterval(window._langBuzzInterval);

    const startRect = btn.getBoundingClientRect();
    const gearRect = gear.getBoundingClientRect();
    btn.style.opacity = '0';
    btn.style.pointerEvents = 'none';

    const legsHTML = '<span class="c-leg"></span><span class="c-leg"></span><span class="c-leg"></span><span class="c-leg"></span><span class="c-leg"></span>';
    const crawler = document.createElement('div');
    crawler.className = 'crawler-actor';
    crawler.style.left = startRect.left + 'px';
    crawler.style.top = startRect.top + 'px';
    crawler.innerHTML = `
        <div id="crawlerBubble" style="font-size:10px;color:#58a6ff;font-weight:bold;margin-bottom:8px;white-space:nowrap;">${window.tr('🐛 Ползу в ⚙️...', '🐛 Crawling to ⚙️...')}</div>
        <div id="crawlerRotator" class="crawler-rotator" style="transform: rotate(0deg);">
            <div class="crawler-spine">
                <div class="crawler-legs-row side-a">${legsHTML}</div>
                <div class="jenny-lang-btn" style="white-space:nowrap;padding:3px 7px;border-color:#58a6ff;box-shadow:0 0 10px rgba(88,166,255,0.45);">
                    ${window.renderDualLangHTML(false)}
                </div>
                <div class="crawler-legs-row side-b">${legsHTML}</div>
                <div class="crawler-head-antennae"><span class="c-antenna top"></span><span class="c-antenna bot"></span></div>
            </div>
        </div>
    `;
    document.body.appendChild(crawler);

    const rotator = document.getElementById('crawlerRotator');
    const topLaneY = Math.max(8, gearRect.top + 4);
    const goingRight = gearRect.left >= startRect.left;
    const horizAngle = goingRight ? 'rotate(0deg)' : 'rotate(180deg)';

    setTimeout(() => { if (rotator) rotator.style.transform = 'rotate(-90deg)'; }, 30);
    setTimeout(() => {
        crawler.style.transition = 'top 1.35s linear';
        crawler.style.top = topLaneY + 'px';
    }, 220);
    setTimeout(() => { if (rotator) rotator.style.transform = horizAngle; }, 1550);
    setTimeout(() => {
        crawler.style.transition = 'left 1.45s linear';
        crawler.style.left = gearRect.left + 'px';
    }, 1700);
    setTimeout(() => {
        crawler.style.transition = 'transform 0.4s ease-in, opacity 0.4s ease-in';
        crawler.style.transform = 'scale(0.12)';
        crawler.style.opacity = '0.1';
    }, 3180);
    setTimeout(() => {
        crawler.remove();
        btn.style.display = 'none';
        gear.classList.add('gear-soft-anim');
        setTimeout(() => gear.classList.remove('gear-soft-anim'), 550);
        if (typeof window.dockLangBadgeIntoOpenSettingsV39 === 'function') window.dockLangBadgeIntoOpenSettingsV39();
    }, 3600);
};


// 🎛️ ПАТЧ V62 (ЭТАП 2): 3-ПОЗИЦИОННЫЙ ТУМБЛЕР (JBUF / VINYL / WEB API GOOGLE) + СКРЫТИЕ СПРАВОК (❓)

window.initDefaultEngineModeJbufV62 = function() {
    window.appConfig = window.appConfig || JSON.parse(localStorage.getItem('ytm_config') || '{}');
    // По умолчанию включаем наш движок JBUF 90° с питчлоком
    if (!window.appConfig._jbufDefaultSetV62) {
        window.appConfig._jbufDefaultSetV62 = true;
        window.appConfig.engineModeV62 = 'jbuf';
        window.appConfig.elasticHoseMode = true;
        window.appConfig.pitchLock = false;
        window.appConfig.studioMode = true;
        localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    }
    if (!window.appConfig.engineModeV62) {
        if (window.appConfig.elasticHoseMode) window.appConfig.engineModeV62 = 'jbuf';
        else if (window.appConfig.pitchLock) window.appConfig.engineModeV62 = 'webapi';
        else window.appConfig.engineModeV62 = 'vinyl';
    }
};
window.initDefaultEngineModeJbufV62();

window.onToggleHideHelpBadgesV62 = function(chk, ev) {
    const hide = Boolean(chk && chk.checked);
    window.appConfig = window.appConfig || {};
    window.appConfig.hideHelpBadges = hide;
    document.body.classList.toggle('hide-help-badges', hide);
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.saveThemeOnlyQuietlyV40 === 'function') window.saveThemeOnlyQuietlyV40();
    if (typeof window.showToast === 'function' && ev) {
        window.showToast(hide ? window.tr('🙈 Значки справок (❓) скрыты', '🙈 Help badges (❓) hidden') : window.tr('📖 Значки справок (❓) включены', '📖 Help badges (❓) visible'), ev);
    }
};

window.injectHideHelpToggleV62 = function() {
    document.body.classList.toggle('hide-help-badges', Boolean(window.appConfig && window.appConfig.hideHelpBadges));
    const themeRow = document.getElementById('jennyThemeStudioBtnRow');
    if (!themeRow || document.getElementById('hideHelpRowV62')) return;

    const isHidden = Boolean(window.appConfig && window.appConfig.hideHelpBadges);
    const row = document.createElement('div');
    row.id = 'hideHelpRowV62';
    row.className = 'setting-row jenny-uniform-card';
    row.style.cssText = 'padding:9px 12px;border-radius:8px;margin-bottom:12px;';
    row.innerHTML = `
        <label class="toggle-label" style="font-weight:bold;color:#e6edf3;width:100%;">
            <input type="checkbox" id="cfg_hideHelpV62" ${isHidden ? 'checked' : ''} onchange="window.onToggleHideHelpBadgesV62(this, event)">
            🙈 ${window.tr('Скрыть все справки и подсказки (❓)', 'Hide all help badges & manual (❓)')}
        </label>
    `;
    themeRow.insertAdjacentElement('afterend', row);
};

window.setAudioEngineModeV62 = function(mode, ev) {
    window.appConfig = window.appConfig || {};
    window.appConfig.engineModeV62 = mode;

    const pitchChk = document.getElementById('cfg_pitchLock');
    const hoseChk = document.getElementById('cfg_elasticHoseV44');
    const studioChk = document.getElementById('cfg_studioMode');

    if (mode === 'jbuf') {
        window.appConfig.elasticHoseMode = true;
        window.appConfig.pitchLock = false;
        window.appConfig.studioMode = true;
        if (hoseChk) hoseChk.checked = true;
        if (pitchChk) pitchChk.checked = false;
        if (studioChk) studioChk.checked = true;
    } else if (mode === 'vinyl') {
        window.appConfig.elasticHoseMode = false;
        window.appConfig.pitchLock = false;
        if (hoseChk) hoseChk.checked = false;
        if (pitchChk) pitchChk.checked = false;
    } else if (mode === 'webapi') {
        window.appConfig.elasticHoseMode = false;
        window.appConfig.pitchLock = true;
        if (hoseChk) hoseChk.checked = false;
        if (pitchChk) pitchChk.checked = true;
    }

    window.syncEngineTumblerUIV62();
    if (typeof window.installHosePlayerHooksV46 === 'function') window.installHosePlayerHooksV46();
    if (typeof window.syncMasterPlaybackEngineV59 === 'function') window.syncMasterPlaybackEngineV59(false);

    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.saveThemeOnlyQuietlyV40 === 'function') window.saveThemeOnlyQuietlyV40();

    if (typeof window.showToast === 'function' && ev) {
        const msgMap = {
            jbuf: window.tr('⚡ Движок: JBUF 90° (Студийный RAM Питчлок)', '⚡ Engine: JBUF 90° (Studio RAM PitchLock)'),
            vinyl: window.tr('💿 Движок: VINYL (Пластинка без питчлока)', '💿 Engine: VINYL (Natural Pitch Shift)'),
            webapi: window.tr('🌐 Движок: Web API Google (Штатный браузерный)', '🌐 Engine: Web API Google (Stock Browser)')
        };
        window.showToast(msgMap[mode] || msgMap.jbuf, ev);
    }
};

window.syncEngineTumblerUIV62 = function() {
    window.initDefaultEngineModeJbufV62();
    const mode = window.appConfig.engineModeV62 || 'jbuf';
    const bJbuf = document.getElementById('tmb_mode_jbuf');
    const bVinyl = document.getElementById('tmb_mode_vinyl');
    const bWeb = document.getElementById('tmb_mode_webapi');

    if (bJbuf) bJbuf.className = 'jbuf-tumbler-btn' + (mode === 'jbuf' ? ' active-jbuf' : '');
    if (bVinyl) bVinyl.className = 'jbuf-tumbler-btn' + (mode === 'vinyl' ? ' active-vinyl' : '');
    if (bWeb) bWeb.className = 'jbuf-tumbler-btn' + (mode === 'webapi' ? ' active-webapi' : '');
};

window.upgradeToThreeWayTumblerV62_OBSOLETE = function() {
    const pitchChk = document.getElementById('cfg_pitchLock');
    const hoseChk = document.getElementById('cfg_elasticHoseV44');
    const hoseBox = document.getElementById('hoseControlBoxV44');
    if (!hoseBox) return;

    // Скрываем старую одиночную строку cfg_pitchLock, так как теперь оба питчлока и винил объединены в 3-позиционный тумблер
    if (pitchChk) {
        const oldRow = pitchChk.closest('.setting-row');
        if (oldRow) oldRow.style.display = 'none';
    }
    if (hoseChk) {
        const oldHoseRow = hoseChk.closest('.setting-row');
        if (oldHoseRow && !document.getElementById('jbufThreeWayBarV62')) {
            const bar = document.createElement('div');
            bar.id = 'jbufThreeWayBarV62';
            bar.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-size:12px;font-weight:bold;color:#e6edf3;">🎛️ ${window.tr('Звуковой движок скорости:', 'Speed Audio Engine:')}</span>
                </div>
                <div class="jbuf-tumbler-track">
                    <button type="button" id="tmb_mode_jbuf" class="jbuf-tumbler-btn" onclick="window.setAudioEngineModeV62('jbuf', event)">⚡ JBUF 90°</button>
                    <button type="button" id="tmb_mode_vinyl" class="jbuf-tumbler-btn" onclick="window.setAudioEngineModeV62('vinyl', event)">💿 VINYL</button>
                    <button type="button" id="tmb_mode_webapi" class="jbuf-tumbler-btn" onclick="window.setAudioEngineModeV62('webapi', event)">🌐 Web API Google</button>
                </div>
            `;
            oldHoseRow.insertAdjacentElement('beforebegin', bar);
            // В старой строке оставляем только телеметрию справа, пряча дублирующий чекбокс
            const lbl = oldHoseRow.querySelector('label');
            if (lbl) lbl.style.display = 'none';
            oldHoseRow.style.justifyContent = 'flex-end';
        }
    }
    window.syncEngineTumblerUIV62();
};

const _origMountV62 = window.mountJennyStudioUI;
window.mountJennyStudioUI = function() {
    if (typeof _origMountV62 === 'function') _origMountV62();
    window.injectHideHelpToggleV62();
    setTimeout(() => {
        window.upgradeToThreeWayTumblerV62();
        window.syncMasterPlaybackEngineV59(false);
    }, 80);
};

setTimeout(() => {
    window.injectHideHelpToggleV62();
    window.upgradeToThreeWayTumblerV62();
    window.syncMasterPlaybackEngineV59(false);
}, 550);


// 📊 ПАТЧ V62 (ЭТАП 3): ОКНО АНАЛИЗАТОРА СПЕКТРА (FFT) + ОСЦИЛЛОГРАФА И ЛАБОРАТОРИИ ШВОВ

window._jennySpecStateV62 = {
    analyserPost: null,
    analyserPre: null,
    sourceMode: 'post', // 'post' (после всех DSP) или 'pre' (чистый вход inputMixer)
    frozen: false,
    peakHold: new Float32Array(64),
    peakDecay: 0.45,
    rafId: null
};

window.ensureSpectrumAnalysersV62 = function() {
    if (!window.audioCtx) return null;
    const st = window._jennySpecStateV62;
    try {
        if (!st.analyserPost || st.analyserPost.context !== window.audioCtx) {
            st.analyserPost = window.audioCtx.createAnalyser();
            st.analyserPost.fftSize = 2048;
            st.analyserPost.smoothingTimeConstant = 0.78;
            st.analyserPost.minDecibels = -90;
            st.analyserPost.maxDecibels = -6;
            if (window.masterAntiClickGain) {
                window.masterAntiClickGain.connect(st.analyserPost);
            }
        }
        if (!st.analyserPre || st.analyserPre.context !== window.audioCtx) {
            st.analyserPre = window.audioCtx.createAnalyser();
            st.analyserPre.fftSize = 2048;
            st.analyserPre.smoothingTimeConstant = 0.78;
            st.analyserPre.minDecibels = -90;
            st.analyserPre.maxDecibels = -6;
            if (window.preAmpNode) {
                window.preAmpNode.connect(st.analyserPre);
            }
        }
    } catch (e) {}
    return st.sourceMode === 'pre' ? st.analyserPre : st.analyserPost;
};

// Переподключаем pre-анализатор при перестройке графа DSP
(function() {
    const origBuildCore = window._buildAudioGraphCore;
    if (typeof origBuildCore === 'function' && !window._specGraphHookedV62) {
        window._specGraphHookedV62 = true;
        window._buildAudioGraphCore = function() {
            const r = origBuildCore.apply(this, arguments);
            try {
                const st = window._jennySpecStateV62;
                if (st.analyserPre && window.preAmpNode) window.preAmpNode.connect(st.analyserPre);
                if (st.analyserPost && window.masterAntiClickGain) window.masterAntiClickGain.connect(st.analyserPost);
            } catch (e) {}
            return r;
        };
    }
})();

window.ensureSpectrumModalDOMV62 = function() {
    let sm = document.getElementById('specModal');
    if (!sm) {
        sm = document.createElement('div');
        sm.id = 'specModal';
        sm.className = 'modal-overlay';
        sm.innerHTML = `
            <div class="container" id="specModalContainerV62">
                <div class="jenny-uniform-card" style="background:var(--bg-setting-box);border:1px solid var(--border-uniform);border-radius:10px;padding:10px;margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">
                        <span style="font-size:12.5px;font-weight:bold;color:#58a6ff;">📊 ${window.tr('FFT Анализатор Спектра (20 Гц – 20 кГц)', 'FFT Spectrum Analyzer (20 Hz – 20 kHz)')}</span>
                        <div style="display:flex;gap:4px;align-items:center;">
                            <button type="button" id="btnSpecSourceV62" onclick="window.toggleSpecSourceModeV62()" style="font-size:10px;padding:3px 7px;border-radius:5px;border:1px solid #3fb950;background:#161b22;color:#3fb950;">Пост-DSP (Мастер)</button>
                            <button type="button" onclick="window.resetSpecPeaksV62()" style="font-size:10px;padding:3px 7px;border-radius:5px;border:1px solid #30363d;background:#161b22;color:#e3b341;">Сброс пиков</button>
                            <button type="button" id="btnSpecFreezeV62" onclick="window.toggleSpecFreezeV62(this)" style="font-size:10px;padding:3px 7px;border-radius:5px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;">❄️ Стоп</button>
                        </div>
                    </div>
                    <canvas id="jennyFftCanvasV62" width="360" height="145" style="width:100%;height:145px;display:block;background:#05070a;border:1px solid #21262d;border-radius:6px;"></canvas>
                    <div id="jennyFftBandsTelemetryV62" style="display:flex;justify-content:space-between;font-size:10.5px;font-family:monospace;color:#8b949e;margin-top:6px;padding:0 2px;">
                        <span id="fftSubTextV62" style="color:#a371f7;">🔊 Бас (20-200Гц): -∞ dB</span>
                        <span id="fftMidTextV62" style="color:#3fb950;">🎤 СЧ (200-4кГц): -∞ dB</span>
                        <span id="fftHighTextV62" style="color:#58a6ff;">✨ ВЧ (4-20кГц): -∞ dB</span>
                    </div>
                </div>
                <div id="specWaveLabSlotV62"></div>
            </div>
        `;
        const refModal = document.getElementById('eqModal') || document.getElementById('settingsModal');
        if (refModal && refModal.parentNode) {
            refModal.parentNode.insertBefore(sm, refModal.nextSibling);
        } else {
            document.body.appendChild(sm);
        }
    }

    // Переносим блок осциллографа и лаборатории швов внутрь окна Анализатора спектра
    const waveCanvas = document.getElementById('hoseWaveScopeCanvasV49');
    const slot = document.getElementById('specWaveLabSlotV62');
    if (waveCanvas && slot && !slot.contains(waveCanvas)) {
        const waveCard = waveCanvas.parentElement;
        if (waveCard) {
            waveCard.style.marginTop = '0';
            waveCard.style.padding = '10px';
            slot.appendChild(waveCard);

            // Упаковываем отладчик швов и сэмпл-резак в аккуратный спойлер внутри этого же окна
            const ta = document.getElementById('hoseDebugTextAreaV52');
            const sliceBox = document.getElementById('hoseSliceBoxV59') || document.getElementById('hoseSliceBoxV58');
            if (ta && !document.getElementById('seamLabCollapsibleV62')) {
                const dbgBlock = ta.parentElement;
                const det = document.createElement('details');
                det.id = 'seamLabCollapsibleV62';
                det.style.cssText = 'margin-top:8px;border-top:1px solid #21262d;padding-top:6px;';
                det.innerHTML = `<summary style="font-size:11px;color:#f0883e;font-weight:bold;cursor:pointer;outline:none;">🔬 Инженерная лаборатория 90° швов и Сэмпл-Резак</summary><div id="seamLabInnerV62" style="margin-top:6px;"></div>`;
                waveCard.appendChild(det);
                const inner = det.querySelector('#seamLabInnerV62');
                if (dbgBlock && dbgBlock !== waveCard) inner.appendChild(dbgBlock);
                if (sliceBox) inner.appendChild(sliceBox);
            }
        }

        // В настройках под ползунком упругости ставим кнопку быстрого открытия Анализатора и Осциллографа
        const hoseBox = document.getElementById('hoseControlBoxV44');
        if (hoseBox && !document.getElementById('openSpecShortcutBtnV62')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = 'openSpecShortcutBtnV62';
            btn.onclick = () => window.openSpectrumModalV62();
            btn.style.cssText = 'width:100%;margin-top:8px;padding:8px;background:#0d1117;border:1px solid var(--border-uniform);color:#58a6ff;border-radius:7px;font-size:11.5px;';
            btn.innerHTML = '📊 ' + window.tr('Открыть Анализатор спектра и Осциллограф волны', 'Open Spectrum Analyzer & Wave Scope');
            hoseBox.appendChild(btn);
        }
    }
};

window.toggleSpecSourceModeV62 = function() {
    const st = window._jennySpecStateV62;
    st.sourceMode = (st.sourceMode === 'post') ? 'pre' : 'post';
    const btn = document.getElementById('btnSpecSourceV62');
    if (btn) {
        if (st.sourceMode === 'post') {
            btn.innerText = window.tr('Пост-DSP (Мастер)', 'Post-DSP (Master)');
            btn.style.borderColor = '#3fb950';
            btn.style.color = '#3fb950';
        } else {
            btn.innerText = window.tr('До-DSP (Вход)', 'Pre-DSP (Raw In)');
            btn.style.borderColor = '#58a6ff';
            btn.style.color = '#58a6ff';
        }
    }
};

window.resetSpecPeaksV62 = function() {
    window._jennySpecStateV62.peakHold.fill(0);
};

window.toggleSpecFreezeV62 = function(btn) {
    const st = window._jennySpecStateV62;
    st.frozen = !st.frozen;
    if (btn) {
        btn.innerText = st.frozen ? '▶️ Пуск' : '❄️ Стоп';
        btn.style.borderColor = st.frozen ? '#f0883e' : '#30363d';
        btn.style.color = st.frozen ? '#f0883e' : '#c9d1d9';
    }
};

window.startSpectrumLoopV62 = function() {
    const st = window._jennySpecStateV62;
    if (st.rafId) cancelAnimationFrame(st.rafId);

    const freqData = new Uint8Array(1024);
    const numBars = 64;

    const draw = () => {
        const sm = document.getElementById('specModal');
        const cv = document.getElementById('jennyFftCanvasV62');
        if (sm && sm.classList.contains('open') && cv && !st.frozen) {
            const ctx = cv.getContext('2d');
            const W = cv.width;
            const H = cv.height;
            const plotH = H - 18;
            const plotX = 28;
            const plotW = W - plotX - 4;

            ctx.fillStyle = '#05070a';
            ctx.fillRect(0, 0, W, H);

            // Горизонтальная сетка децибел
            ctx.strokeStyle = 'rgba(139,148,158,0.14)';
            ctx.fillStyle = '#6e7681';
            ctx.font = '9px monospace';
            ctx.lineWidth = 1;
            [
                { db: ' 0dB', y: 8 },
                { db: '-20',  y: Math.round(plotH * 0.33) },
                { db: '-45',  y: Math.round(plotH * 0.66) },
                { db: '-80',  y: plotH }
            ].forEach(g => {
                ctx.beginPath();
                ctx.moveTo(plotX, g.y);
                ctx.lineTo(W - 2, g.y);
                ctx.stroke();
                ctx.fillText(g.db, 2, g.y + 3);
            });

            // Подписи частот снизу (60 Гц, 230 Гц, 910 Гц, 3.6 кГц, 14 кГц)
            const marks = [
                { lbl: '60',   f: 60 },
                { lbl: '230',  f: 230 },
                { lbl: '910',  f: 910 },
                { lbl: '3.6k', f: 3600 },
                { lbl: '14k',  f: 14000 }
            ];
            marks.forEach(m => {
                const normX = Math.log10(m.f / 20) / Math.log10(20000 / 20);
                const x = plotX + Math.round(normX * plotW);
                ctx.strokeStyle = 'rgba(88,166,255,0.12)';
                ctx.beginPath();
                ctx.moveTo(x, 4);
                ctx.lineTo(x, plotH);
                ctx.stroke();
                ctx.fillStyle = '#8b949e';
                ctx.fillText(m.lbl, x - 10, H - 4);
            });

            const an = window.ensureSpectrumAnalysersV62();
            if (an) {
                an.getByteFrequencyData(freqData);
                const sr = (window.audioCtx && window.audioCtx.sampleRate) ? window.audioCtx.sampleRate : 48000;
                const binCount = an.frequencyBinCount;

                let subSum = 0, subCnt = 0;
                let midSum = 0, midCnt = 0;
                let highSum = 0, highCnt = 0;

                const barW = Math.max(2, (plotW / numBars) - 1.2);

                for (let i = 0; i < numBars; i++) {
                    const fLow = 20 * Math.pow(1000, i / numBars);
                    const fHigh = 20 * Math.pow(1000, (i + 1) / numBars);
                    let b0 = Math.max(1, Math.floor((fLow * binCount * 2) / sr));
                    let b1 = Math.min(binCount - 1, Math.ceil((fHigh * binCount * 2) / sr));
                    if (b1 < b0) b1 = b0;

                    let maxVal = 0;
                    for (let b = b0; b <= b1; b++) {
                        if (freqData[b] > maxVal) maxVal = freqData[b];
                    }

                    const fCenter = 0.5 * (fLow + fHigh);
                    if (fCenter <= 200) { subSum += maxVal; subCnt++; }
                    else if (fCenter <= 4000) { midSum += maxVal; midCnt++; }
                    else { highSum += maxVal; highCnt++; }

                    if (maxVal >= st.peakHold[i]) {
                        st.peakHold[i] = maxVal;
                    } else {
                        st.peakHold[i] = Math.max(0, st.peakHold[i] - st.peakDecay);
                    }

                    const hBar = Math.round((maxVal / 255) * (plotH - 6));
                    const hPeak = Math.round((st.peakHold[i] / 255) * (plotH - 6));
                    const x = plotX + i * (plotW / numBars);

                    // Градиент столбика: фиолетовый бас -> изумрудная середина -> голубой воздух
                    if (fCenter <= 220) ctx.fillStyle = '#a371f7';
                    else if (fCenter <= 3800) ctx.fillStyle = '#3fb950';
                    else ctx.fillStyle = '#58a6ff';

                    if (hBar > 0) {
                        ctx.fillRect(x, plotH - hBar, barW, hBar);
                    }
                    if (hPeak > 1) {
                        ctx.fillStyle = '#e3b341';
                        ctx.fillRect(x, plotH - hPeak - 2, barW, 2);
                    }
                }

                const toDbStr = (avg) => avg < 1 ? '-∞ dB' : (-84 + (avg / 255) * 80).toFixed(1) + ' dB';
                const subEl = document.getElementById('fftSubTextV62');
                const midEl = document.getElementById('fftMidTextV62');
                const highEl = document.getElementById('fftHighTextV62');
                if (subEl) subEl.innerText = `🔊 Бас: ${toDbStr(subSum / Math.max(1, subCnt))}`;
                if (midEl) midEl.innerText = `🎤 СЧ: ${toDbStr(midSum / Math.max(1, midCnt))}`;
                if (highEl) highEl.innerText = `✨ ВЧ: ${toDbStr(highSum / Math.max(1, highCnt))}`;
            }
        }
        st.rafId = requestAnimationFrame(draw);
    };
    st.rafId = requestAnimationFrame(draw);
};

// Интегрируем specModal в общий переключатель модальных окон toggleModal
(function() {
    window.toggleModal = function(id) {
        window.ensureSpectrumModalDOMV62();
        const tm = document.getElementById('themeModal');
        if (tm && tm.classList.contains('open') && id === 'settingsModal') {
            tm.classList.remove('open');
            return;
        }
        if (tm) tm.classList.remove('open');

        const modals = ['settingsModal', 'favModal', 'eqModal', 'specModal'];
        const target = document.getElementById(id);
        const btnTarget = document.getElementById('btn-' + id);
        if (!target) return;
        const wasOpen = target.classList.contains('open');

        modals.forEach(m => {
            const el = document.getElementById(m);
            const btn = document.getElementById('btn-' + m);
            if (el) el.classList.remove('open');
            if (btn) btn.style.color = '';
        });

        if (!wasOpen) {
            target.classList.add('open');
            if (btnTarget) btnTarget.style.color = '#3fb950';
        }
        if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
        if (typeof window.updateModalGpuLockV41 === 'function') window.updateModalGpuLockV41();
    };
})();

window.openSpectrumModalV62 = function() {
    if (typeof window.initAudioBoost === 'function') window.initAudioBoost();
    window.ensureSpectrumModalDOMV62();
    window.ensureSpectrumAnalysersV62();
    window.toggleModal('specModal');
};

setTimeout(() => {
    window.ensureSpectrumModalDOMV62();
    window.startSpectrumLoopV62();
}, 680);


// ⚙️ ПАТЧ V66: 5-СТУПЕНЧАТАЯ МЕХАНИЧЕСКАЯ КПП (PITCH LOCK ▲ / PITCH SHIFT ▼ / НЕЙТРАЛЬ N)

window.GEAR_SPECS_V66 = {
    'jbuf-lock':   { x: 35,  y: 44,  col: 'left',  pos: 'up',   mode: 'jbuf',    pitchLock: true,  knob: 'J▲', labelRu: '1-я: ⚡ JBUF 90° [PITCH LOCK]',       labelEn: '1st: ⚡ JBUF 90° [PITCH LOCK]' },
    'jbuf-shift':  { x: 35,  y: 178, col: 'left',  pos: 'down', mode: 'jbuf',    pitchLock: false, knob: 'J▼', labelRu: '2-я: ⚡ JBUF RAM [PITCH SHIFT]',       labelEn: '2nd: ⚡ JBUF RAM [PITCH SHIFT]' },
    'web-lock':    { x: 101, y: 44,  col: 'mid',   pos: 'up',   mode: 'webapi',  pitchLock: true,  knob: 'W▲', labelRu: '3-я: 🌐 Web API [PITCH LOCK]',        labelEn: '3rd: 🌐 Web API [PITCH LOCK]' },
    'web-shift':   { x: 101, y: 178, col: 'mid',   pos: 'down', mode: 'webapi',  pitchLock: false, knob: 'W▼', labelRu: '4-я: 🌐 Web API [PITCH SHIFT]',       labelEn: '4th: 🌐 Web API [PITCH SHIFT]' },
    'vinyl-shift': { x: 167, y: 178, col: 'right', pos: 'down', mode: 'vinyl',   pitchLock: false, knob: 'R💿', labelRu: 'Задняя R: 💿 ВИНИЛ [PITCH SHIFT]',   labelEn: 'Rev R: 💿 VINYL [PITCH SHIFT]' },
    'neutral':     { x: 101, y: 111, col: 'mid',   pos: 'mid',  mode: 'neutral', pitchLock: true,  knob: 'N',  labelRu: 'Нейтраль (N): Холостой ход x1.00',   labelEn: 'Neutral (N): Idle 1.00x Bypass' }
};

window.setGearboxStateV66 = function(gearKey, ev) {
    const spec = window.GEAR_SPECS_V66[gearKey] || window.GEAR_SPECS_V66['jbuf-lock'];
    window.appConfig = window.appConfig || {};
    window.appConfig.gearKeyV66 = gearKey;
    window.appConfig.engineModeV62 = spec.mode;
    window.appConfig.gearPitchLockV66 = spec.pitchLock;

    const pitchChk = document.getElementById('cfg_pitchLock');
    const hoseChk = document.getElementById('cfg_elasticHoseV44');
    const studioChk = document.getElementById('cfg_studioMode');

    if (gearKey === 'jbuf-lock') {
        window.appConfig.elasticHoseMode = true;
        window.appConfig.pitchLock = false;
        window.appConfig.studioMode = true;
        if (hoseChk) hoseChk.checked = true;
        if (pitchChk) pitchChk.checked = false;
        if (studioChk) studioChk.checked = true;
    } else if (gearKey === 'jbuf-shift') {
        window.appConfig.elasticHoseMode = false;
        window.appConfig.pitchLock = false;
        window.appConfig.studioMode = true;
        if (hoseChk) hoseChk.checked = false;
        if (pitchChk) pitchChk.checked = false;
        if (studioChk) studioChk.checked = true;
    } else if (gearKey === 'web-lock') {
        window.appConfig.elasticHoseMode = false;
        window.appConfig.pitchLock = true;
        if (hoseChk) hoseChk.checked = false;
        if (pitchChk) pitchChk.checked = true;
    } else if (gearKey === 'web-shift') {
        window.appConfig.elasticHoseMode = false;
        window.appConfig.pitchLock = false;
        window.appConfig.studioMode = false;
        if (hoseChk) hoseChk.checked = false;
        if (pitchChk) pitchChk.checked = false;
        if (studioChk) studioChk.checked = false;
    } else if (gearKey === 'vinyl-shift') {
        window.appConfig.elasticHoseMode = false;
        window.appConfig.pitchLock = false;
        window.appConfig.studioMode = true;
        if (hoseChk) hoseChk.checked = false;
        if (pitchChk) pitchChk.checked = false;
        if (studioChk) studioChk.checked = true;
    } else if (gearKey === 'neutral') {
        window.appConfig.elasticHoseMode = false;
        window.appConfig.pitchLock = true;
        if (window.scrubState && !window.scrubState.active) {
            window.scrubState.locked = false;
            window.scrubState.speed = 1.0;
            const lockInd = document.getElementById('speedLockIndicator');
            if (lockInd) lockInd.style.display = 'none';
            const player = document.getElementById('audioPlayer');
            if (player) player.playbackRate = 1.0;
        }
    }

    window.syncEngineTumblerUIV62();
    if (typeof window.installHosePlayerHooksV46 === 'function') window.installHosePlayerHooksV46();
    if (typeof window.syncMasterPlaybackEngineV59 === 'function') window.syncMasterPlaybackEngineV59(false);

    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.saveThemeOnlyQuietlyV40 === 'function') window.saveThemeOnlyQuietlyV40();

    if (typeof window.showToast === 'function' && ev) {
        window.showToast('🕹️ ' + window.tr(spec.labelRu, spec.labelEn), ev);
    }
};

(function() {
    const origGetSpeed = window.getActiveTargetSpeedV59;
    window.getActiveTargetSpeedV59 = function() {
        const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
        if (gKey === 'neutral' && !(window.scrubState && window.scrubState.active)) {
            return 1.0;
        }
        return typeof origGetSpeed === 'function' ? origGetSpeed() : 1.0;
    };

    const origSyncMaster = window.syncMasterPlaybackEngineV59;
    window.syncMasterPlaybackEngineV59 = function(forceRebuild) {
        const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
        const player = document.getElementById('audioPlayer');

        if (gKey === 'web-shift' && player && !window.isReversed && !(window.scrubState && window.scrubState.isPhysicallyReversed)) {
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null;
                try { window.studioSourceNode.stop(); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
                window.studioSourceNode = null;
            }
            window.isStudioPlaying = false;
            if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
            player.preservesPitch = false;
            player.mozPreservesPitch = false;
            player.webkitPreservesPitch = false;

            const targetSpd = window.getActiveTargetSpeedV59();
            if (Math.abs(player.playbackRate - targetSpd) > 0.005) {
                try { player.playbackRate = targetSpd; } catch (e) {}
            }
            const badge = document.getElementById('hoseLiveTelemetryV44');
            if (badge) {
                badge.style.color = '#58a6ff';
                badge.innerText = `🌐 WebAPI PitchShift | x${targetSpd.toFixed(2)}`;
            }
            return;
        }

        const res = typeof origSyncMaster === 'function' ? origSyncMaster(forceRebuild) : undefined;

        if (gKey === 'vinyl-shift' && window.studioSourceNode && window.studioSourceNode.playbackRate && window.audioCtx) {
            const targetSpd = window.getActiveTargetSpeedV59();
            try {
                const now = window.audioCtx.currentTime;
                window.studioSourceNode.playbackRate.setTargetAtTime(targetSpd, now, 0.065);
            } catch (e) {}
        }
        return res;
    };
})();

window.upgradeToThreeWayTumblerV62 = function() {
    if (typeof window.injectElasticHoseControlsV44 === 'function' && !document.getElementById('hoseControlBoxV44')) {
        window.injectElasticHoseControlsV44();
    }
    const pitchChk = document.getElementById('cfg_pitchLock');
    const hoseChk = document.getElementById('cfg_elasticHoseV44');
    const hoseBox = document.getElementById('hoseControlBoxV44');
    if (!hoseBox) return;

    if (pitchChk) {
        const oldRow = pitchChk.closest('.setting-row');
        if (oldRow) oldRow.style.display = 'none';
    }

    ['jbufThreeWayBarV62', 'jbufInteractiveGearboxV65'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    if (hoseChk) {
        const oldHoseRow = hoseChk.closest('.setting-row');
        if (oldHoseRow && !document.getElementById('jbufMechanicalGearboxV66')) {
            const wrap = document.createElement('div');
            wrap.id = 'jbufMechanicalGearboxV66';
            wrap.className = 'gearbox-container';
            wrap.innerHTML = `
                <div class="gearbox-knob-plate" id="gearPlateV66">
                    <svg class="gearbox-svg-overlay" viewBox="0 0 264 264">
                        <defs>
                            <linearGradient id="plGradV66" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="#3fb950"/>
                                <stop offset="100%" stop-color="#58a6ff"/>
                            </linearGradient>
                            <linearGradient id="psGradV66" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="#a371f7"/>
                                <stop offset="100%" stop-color="#e3b341"/>
                            </linearGradient>
                        </defs>
                        <rect x="64" y="13" width="136" height="20" rx="10" fill="#070a10" stroke="url(#plGradV66)" stroke-width="1.5"/>
                        <text x="132" y="27" fill="#e6edf3" font-family="monospace" font-weight="900" font-size="11.5" text-anchor="middle" letter-spacing="1.8">▲ PITCH LOCK</text>

                        <rect x="60" y="231" width="144" height="20" rx="10" fill="#070a10" stroke="url(#psGradV66)" stroke-width="1.5"/>
                        <text x="132" y="245" fill="#e6edf3" font-family="monospace" font-weight="900" font-size="11.5" text-anchor="middle" letter-spacing="1.5">▼ PITCH SHIFT</text>
                    </svg>

                    <div id="enc-jbuf" class="gearbox-gate-enclosure" style="left:41px; top:40px; width:46px; height:184px;"></div>
                    <div id="enc-web" class="gearbox-gate-enclosure" style="left:107px; top:40px; width:46px; height:184px;"></div>
                    <div id="enc-vinyl" class="gearbox-gate-enclosure" style="left:173px; top:116px; width:46px; height:108px;"></div>

                    <div class="gearbox-h-line" style="left:52px; top:129px; width:136px; height:6px;"></div>
                    <div class="gearbox-h-line" style="left:52px; top:50px; width:6px; height:164px;"></div>
                    <div class="gearbox-h-line" style="left:118px; top:50px; width:6px; height:164px;"></div>
                    <div class="gearbox-h-line" style="left:184px; top:129px; width:6px; height:85px;"></div>

                    <div class="gearbox-stopper-dot" style="left:51px; top:48px;"></div>
                    <div class="gearbox-stopper-dot" style="left:51px; top:208px;"></div>
                    <div class="gearbox-stopper-dot" style="left:117px; top:48px;"></div>
                    <div class="gearbox-stopper-dot" style="left:117px; top:208px;"></div>
                    <div class="gearbox-stopper-dot" style="left:183px; top:208px;"></div>

                    <div class="gearbox-letter jbuf-mode-color" id="let-J" style="left:65px; top:56px;">J</div>
                    <div class="gearbox-letter jbuf-mode-color" id="let-b" style="left:65px; top:88px;">b</div>
                    <div class="gearbox-letter jbuf-mode-color" id="let-u" style="left:65px; top:154px;">u</div>
                    <div class="gearbox-letter jbuf-mode-color" id="let-f" style="left:65px; top:186px;">f</div>

                    <div class="gearbox-letter" id="let-W" style="left:131px; top:52px;">W</div>
                    <div class="gearbox-letter" id="let-e" style="left:131px; top:74px;">e</div>
                    <div class="gearbox-letter" id="let-web-b" style="left:131px; top:96px;">b</div>
                    <div class="gearbox-letter" id="let-a" style="left:131px; top:148px;">a</div>
                    <div class="gearbox-letter" id="let-p" style="left:131px; top:170px;">p</div>
                    <div class="gearbox-letter" id="let-i" style="left:131px; top:192px;">i</div>

                    <div class="gearbox-letter vinyl-mode-color" id="let-v" style="left:197px; top:128px;">в</div>
                    <div class="gearbox-letter vinyl-mode-color" id="let-i-vin" style="left:197px; top:145px;">и</div>
                    <div class="gearbox-letter vinyl-mode-color" id="let-n" style="left:197px; top:162px;">н</div>
                    <div class="gearbox-letter vinyl-mode-color" id="let-i-vin2" style="left:197px; top:179px;">и</div>
                    <div class="gearbox-letter vinyl-mode-color" id="let-l" style="left:197px; top:196px;">л</div>

                    <div class="gearbox-knob-lever" id="gearKnobV66">
                        <span class="gearbox-knob-inner-text" id="gearKnobTextV66">J▲</span>
                    </div>
                </div>
                <div class="gearbox-status-readout" id="gearStatusTextV66">🕹️ 1-я: ⚡ JBUF 90° [PITCH LOCK]</div>
            `;
            oldHoseRow.insertAdjacentElement('beforebegin', wrap);

            const lbl = oldHoseRow.querySelector('label');
            if (lbl) lbl.style.display = 'none';
            oldHoseRow.style.justifyContent = 'flex-end';

            window.initGearboxInteractivityV66();
        }
    }
    window.syncEngineTumblerUIV62();
};

window.initGearboxInteractivityV66 = function() {
    const plate = document.getElementById('gearPlateV66');
    const knob = document.getElementById('gearKnobV66');
    if (!plate || !knob) return;

    window.appConfig = window.appConfig || {};
    if (!window.appConfig.gearKeyV66) {
        window.appConfig.gearKeyV66 = 'jbuf-lock';
    }

    let isDragging = false;
    let dragOffsetX = 0, dragOffsetY = 0;
    let currentX = 35, currentY = 44;

    const COL_X = { left: 35, mid: 101, right: 167 };
    const NEUTRAL_Y = 111;
    const TOP_Y = 44;
    const BOT_Y = 178;
    const END_STOP_TOLERANCE = 11;

    window.syncEngineTumblerUIV62 = function() {
        const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
        const spec = window.GEAR_SPECS_V66[gKey] || window.GEAR_SPECS_V66['jbuf-lock'];

        currentX = spec.x;
        currentY = spec.y;
        knob.style.left = currentX + 'px';
        knob.style.top = currentY + 'px';

        const txt = document.getElementById('gearKnobTextV66');
        if (txt) txt.innerText = spec.knob;

        const stTxt = document.getElementById('gearStatusTextV66');
        if (stTxt) {
            stTxt.innerText = '🕹️ ' + window.tr(spec.labelRu, spec.labelEn);
            stTxt.style.color = (gKey === 'neutral') ? '#e3b341' : (spec.mode === 'jbuf' ? '#3fb950' : (spec.mode === 'webapi' ? '#58a6ff' : '#d2a8ff'));
        }

        document.querySelectorAll('#gearPlateV66 .gearbox-letter').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('#gearPlateV66 .gearbox-gate-enclosure').forEach(el => {
            el.classList.remove('active-jbuf', 'active-webapi', 'active-vinyl');
        });

        if (gKey === 'jbuf-lock') {
            document.getElementById('enc-jbuf')?.classList.add('active-jbuf');
            document.getElementById('let-J')?.classList.add('active');
            document.getElementById('let-b')?.classList.add('active');
        } else if (gKey === 'jbuf-shift') {
            document.getElementById('enc-jbuf')?.classList.add('active-jbuf');
            document.getElementById('let-u')?.classList.add('active');
            document.getElementById('let-f')?.classList.add('active');
        } else if (gKey === 'web-lock') {
            document.getElementById('enc-web')?.classList.add('active-webapi');
            document.getElementById('let-W')?.classList.add('active');
            document.getElementById('let-e')?.classList.add('active');
            document.getElementById('let-web-b')?.classList.add('active');
        } else if (gKey === 'web-shift') {
            document.getElementById('enc-web')?.classList.add('active-webapi');
            document.getElementById('let-a')?.classList.add('active');
            document.getElementById('let-p')?.classList.add('active');
            document.getElementById('let-i')?.classList.add('active');
        } else if (gKey === 'vinyl-shift') {
            document.getElementById('enc-vinyl')?.classList.add('active-vinyl');
            ['let-v', 'let-i-vin', 'let-n', 'let-i-vin2', 'let-l'].forEach(id => {
                document.getElementById(id)?.classList.add('active');
            });
        }
    };

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    const onStart = (e) => {
        if (e.cancelable) e.preventDefault();
        isDragging = true;
        knob.classList.add('dragging');
        const pt = e.touches ? e.touches[0] : e;
        dragOffsetX = pt.clientX - currentX;
        dragOffsetY = pt.clientY - currentY;
    };

    const onMove = (e) => {
        if (!isDragging) return;
        if (e.cancelable) e.preventDefault();
        const pt = e.touches ? e.touches[0] : e;
        let wantX = pt.clientX - dragOffsetX;
        let wantY = pt.clientY - dragOffsetY;

        const inNeutralCorridor = Math.abs(currentY - NEUTRAL_Y) <= 15 && Math.abs(wantY - NEUTRAL_Y) <= 18;

        if (inNeutralCorridor) {
            currentX = clamp(wantX, COL_X.left, COL_X.right);
            if (Math.abs(currentX - COL_X.left) > 9 && Math.abs(currentX - COL_X.mid) > 9 && Math.abs(currentX - COL_X.right) > 9) {
                currentY = NEUTRAL_Y;
            } else {
                if (Math.abs(currentX - COL_X.right) <= 9) {
                    currentY = clamp(wantY, NEUTRAL_Y, BOT_Y);
                } else {
                    currentY = clamp(wantY, TOP_Y, BOT_Y);
                }
            }
        } else {
            let lockedColX = COL_X.mid;
            if (Math.abs(currentX - COL_X.left) < 20) lockedColX = COL_X.left;
            else if (Math.abs(currentX - COL_X.right) < 20) lockedColX = COL_X.right;

            currentX = lockedColX;
            if (lockedColX === COL_X.right) {
                currentY = clamp(wantY, NEUTRAL_Y, BOT_Y);
            } else {
                currentY = clamp(wantY, TOP_Y, BOT_Y);
            }
        }

        knob.style.left = currentX + 'px';
        knob.style.top = currentY + 'px';
    };

    const onEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        knob.classList.remove('dragging');

        let lockedGearKey = 'neutral';

        const atLeftCol  = Math.abs(currentX - COL_X.left) <= 12;
        const atMidCol   = Math.abs(currentX - COL_X.mid) <= 12;
        const atRightCol = Math.abs(currentX - COL_X.right) <= 12;

        const atTopEnd = (currentY <= TOP_Y + END_STOP_TOLERANCE);
        const atBotEnd = (currentY >= BOT_Y - END_STOP_TOLERANCE);

        if (atLeftCol && atTopEnd) {
            lockedGearKey = 'jbuf-lock';
        } else if (atLeftCol && atBotEnd) {
            lockedGearKey = 'jbuf-shift';
        } else if (atMidCol && atTopEnd) {
            lockedGearKey = 'web-lock';
        } else if (atMidCol && atBotEnd) {
            lockedGearKey = 'web-shift';
        } else if (atRightCol && atBotEnd) {
            lockedGearKey = 'vinyl-shift';
        } else {
            lockedGearKey = 'neutral';
        }

        if (typeof navigator.vibrate === 'function') {
            navigator.vibrate(lockedGearKey === 'neutral' ? [12, 30, 12] : 28);
        }

        window.setGearboxStateV66(lockedGearKey, e);
    };

    knob.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);

    knob.addEventListener('touchstart', onStart, { passive: false });
    knob.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: true });
};

setTimeout(() => { window.upgradeToThreeWayTumblerV62(); }, 400);
setTimeout(() => { window.upgradeToThreeWayTumblerV62(); }, 800);


// 🧬 ПАТЧ V67 (ЭТАП 1): СБОРЩИК КАРТЫ ШВОВ И КАРМАНА ОБРЕЗКОВ ДЛЯ ОБРАТИМОГО ЭКСПОРТА

window.buildReversibleExportDataV67 = function(srcBuffer, speed, tensionPct, gearKey, isRev) {
    if (!srcBuffer || !window.audioCtx) return null;
    const spd = Math.max(0.25, Math.min(3.0, parseFloat(speed) || 1.0));
    const tension = parseFloat(tensionPct) || 100;
    const gKey = gearKey || (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
    const isJbufLock = (gKey === 'jbuf-lock');

    const sr = srcBuffer.sampleRate;
    const numCh = srcBuffer.numberOfChannels;
    const origLen = srcBuffer.length;
    const baseStep = Math.max(512, Math.round(0.018 * sr));
    const filletLen = Math.max(128, Math.round(0.0045 * sr));

    // Для режимов без нарезки (Винил, JBUF Shift, WebAPI) сохраняем паспорт скорости и длины
    if (!isJbufLock || Math.abs(spd - 1.0) <= 0.002) {
        return {
            seamMapJson: JSON.stringify({
                v: 67,
                mode: gKey,
                spd: spd,
                rev: Boolean(isRev),
                sr: sr,
                numCh: numCh,
                origLen: origLen,
                outLen: Math.round(origLen / spd),
                initCopy: Math.min(baseStep, origLen),
                filletLen: filletLen,
                seams: []
            }),
            pocketWavBlob: null,
            seamCount: 0,
            pocketSamples: 0
        };
    }

    // Гарантируем, что буфер JBUF 90° и его массив seamLogs свежесобраны под этот srcBuffer
    const splicedBuf = window.buildElasticHoseBufferV46(srcBuffer, spd, tension);
    const cache = window._hoseSplicerCacheV46 || {};
    const logs = cache.seamLogs || [];

    // Считаем суммарную длину вырезанных участков (когда p2 > p1 при ускорении > 1.0x)
    // Сохраняем участок chIn[p1 .. p2 + filletLen], чтобы при восстановлении полностью заменить зону кроссфейда чистым оригиналом!
    const needPocket = (spd > 1.002);
    let totalPocketFrames = 0;
    const compactSeams = [];

    for (let i = 0; i < logs.length; i++) {
        const s = logs[i];
        const sFillet = s.filletLen || filletLen;
        let pckOff = -1;
        let pckLen = 0;

        if (needPocket && s.p2 > s.p1) {
            const cutStart = s.p1;
            const cutEnd = Math.min(origLen, s.p2 + sFillet);
            pckLen = Math.max(0, cutEnd - cutStart);
            if (pckLen > 0) {
                pckOff = totalPocketFrames;
                totalPocketFrames += pckLen;
            }
        }

        // Формат записи шва: [outPos, stepOut, advK, p1, p2, gainInt, pckOff, pckLen]
        compactSeams.push([
            s.outPos,
            s.stepOut || baseStep,
            s.advK || 0,
            s.p1,
            s.p2,
            Math.round((s.targetGain || 1.0) * 10000),
            pckOff,
            pckLen
        ]);
    }

    let pocketWavBlob = null;
    if (needPocket && totalPocketFrames > 0 && typeof bufferToWav === 'function') {
        const pocketBuf = window.audioCtx.createBuffer(numCh, totalPocketFrames, sr);
        for (let c = 0; c < numCh; c++) {
            const inp = srcBuffer.getChannelData(c);
            const pOut = pocketBuf.getChannelData(c);
            for (let i = 0; i < compactSeams.length; i++) {
                const cs = compactSeams[i];
                const pOff = cs[6];
                const pLen = cs[7];
                const p1 = cs[3];
                if (pOff >= 0 && pLen > 0) {
                    pOut.set(inp.subarray(p1, p1 + pLen), pOff);
                }
            }
        }
        pocketWavBlob = bufferToWav(pocketBuf, pocketBuf.length);
    }

    const seamMapObj = {
        v: 67,
        mode: gKey,
        spd: spd,
        tension: tension,
        rev: Boolean(isRev),
        sr: sr,
        numCh: numCh,
        origLen: origLen,
        outLen: splicedBuf ? splicedBuf.length : Math.round(origLen / spd),
        initCopy: Math.min(baseStep, origLen),
        filletLen: filletLen,
        pocketFrames: totalPocketFrames,
        seams: compactSeams
    };

    return {
        seamMapJson: JSON.stringify(seamMapObj),
        pocketWavBlob: pocketWavBlob,
        seamCount: compactSeams.length,
        pocketSamples: totalPocketFrames
    };
};


// 🧬 ПАТЧ V67 (ЭТАП 2): ОБРАТНЫЙ СБОРЩИК ЧИСТОЙ ВОЛНЫ 1.0x В RAM ПРИ ВОСПРОИЗВЕДЕНИИ

window.reconstructedMasterBufferV67 = null;
window.reconstructedReversedBufferV67 = null;
window.currentTrackRevMapV67 = null;
window.currentTrackRevNameV67 = null;

window.reconstructOriginalBufferV67 = function(exportedBuf, smap, pocketBuf) {
    if (!exportedBuf || !smap || !window.audioCtx) return null;
    const sr = exportedBuf.sampleRate;
    const numCh = exportedBuf.numberOfChannels;
    const expLen = exportedBuf.length;
    const origLen = Math.max(1024, parseInt(smap.origLen, 10) || Math.round(expLen * (parseFloat(smap.spd) || 1.0)));
    const seams = smap.seams || [];

    const origBuf = window.audioCtx.createBuffer(numCh, origLen, sr);

    // 1. Если трек сохранялся в режиме Pitch-Shift (Винил / JBUF Shift / Web Shift) без разрезов —
    // восстанавливаем исходную сетку 1.0x кубической интерполяцией Эрмита
    if (seams.length === 0 && Math.abs((parseFloat(smap.spd) || 1.0) - 1.0) > 0.002) {
        const ratio = expLen / origLen;
        for (let c = 0; c < numCh; c++) {
            const inp = exportedBuf.getChannelData(c);
            const out = origBuf.getChannelData(c);
            for (let i = 0; i < origLen; i++) {
                const pos = i * ratio;
                const idx = Math.floor(pos);
                const frac = pos - idx;
                const y0 = inp[Math.max(0, idx - 1)] || 0;
                const y1 = inp[Math.min(expLen - 1, idx)] || 0;
                const y2 = inp[Math.min(expLen - 1, idx + 1)] || 0;
                const y3 = inp[Math.min(expLen - 1, idx + 2)] || 0;
                const c0 = y1;
                const c1 = 0.5 * (y2 - y0);
                const c2 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
                const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
                out[i] = ((c3 * frac + c2) * frac + c1) * frac + c0;
            }
        }
        return origBuf;
    }

    if (seams.length === 0) return exportedBuf;

    // 2. Пошаговая реконструкция эталонной волны 1.0x по карте швов JBUF 90° и карману обрезков
    const filletLen = smap.filletLen || Math.max(128, Math.round(0.0045 * sr));
    const feather = 24;

    for (let c = 0; c < numCh; c++) {
        const exp = exportedBuf.getChannelData(c);
        const orig = origBuf.getChannelData(c);
        const pck = (pocketBuf && c < pocketBuf.numberOfChannels) ? pocketBuf.getChannelData(c) : null;

        // Копируем стартовый участок до первого шва (0 .. p1_0)
        const s0 = seams[0];
        const initEnd = Math.min(s0[0], s0[3], expLen, origLen);
        for (let i = 0; i < initEnd; i++) {
            orig[i] = exp[i];
        }
        let filledUpTo = initEnd;
        let smoothGain = 1.0;

        for (let k = 0; k < seams.length; k++) {
            const s = seams[k];
            const outPos = s[0];
            const stepOut = s[1];
            const advK = s[2];
            const p1 = s[3];
            const p2 = s[4];
            const targetGain = (s[5] || 10000) / 10000.0;
            const pckOff = s[6];
            const pckLen = s[7];

            const nextOutPos = (k + 1 < seams.length) ? seams[k + 1][0] : expLen;
            const blockLen = Math.max(0, Math.min(expLen - outPos, nextOutPos - outPos));

            // Предварительно просчитываем кривую огибающей localGain на этом шаге, чтобы точно обратить её
            let localGain = smoothGain;

            // СЛУЧАЙ А: Ускорение (p2 > p1) — возвращаем вырезанный участок [p1 .. p2 + filletLen] из кармана pck
            if (p2 > p1 && pck && pckOff >= 0 && pckLen > 0) {
                for (let j = 0; j < pckLen; j++) {
                    const dstIdx = p1 + j;
                    if (dstIdx >= origLen) break;
                    const pv = pck[Math.min(pck.length - 1, pckOff + j)];
                    if (j < feather && dstIdx < filledUpTo) {
                        const w = 0.5 * (1.0 - Math.cos(Math.PI * (j / feather)));
                        orig[dstIdx] = orig[dstIdx] * (1.0 - w) + pv * w;
                    } else {
                        orig[dstIdx] = pv;
                    }
                }
                filledUpTo = Math.max(filledUpTo, Math.min(origLen, p1 + pckLen));
            }

            // Копируем чистый хвост блока из exp[outPos + i] в orig[p2 + i], отсекая клонированные участки и кроссфейды
            for (let i = 0; i < blockLen; i++) {
                if (i < stepOut) {
                    localGain = localGain * 0.997 + targetGain * 0.003;
                }
                const dstIdx = p2 + i;
                if (dstIdx < 0 || dstIdx >= origLen) continue;
                const srcIdx = outPos + i;
                if (srcIdx >= expLen) break;

                const cleanVal = exp[srcIdx] / Math.max(0.25, localGain);

                if (dstIdx < filledUpTo - feather) {
                    // Этот участок уже заполнен чистым оригиналом из предыдущего блока или кармана (пропускаем дубль/шов!)
                    continue;
                } else if (dstIdx < filledUpTo) {
                    // Мягкая 24-сэмпловая сшивка на границе стыка двух идентичных участков
                    const rem = filledUpTo - dstIdx;
                    const w = 0.5 * (1.0 - Math.cos(Math.PI * ((feather - rem) / feather)));
                    orig[dstIdx] = orig[dstIdx] * (1.0 - w) + cleanVal * w;
                } else {
                    orig[dstIdx] = cleanVal;
                }
            }

            smoothGain = localGain;
            filledUpTo = Math.max(filledUpTo, Math.min(origLen, p2 + blockLen));
        }

        // Если в самом конце остались сэмплы хвоста — дописываем их
        const lastSeam = seams[seams.length - 1];
        let tailOut = lastSeam[0] + lastSeam[1];
        let tailOrig = filledUpTo;
        while (tailOrig < origLen && tailOut < expLen) {
            orig[tailOrig++] = exp[tailOut++];
        }
    }

    return origBuf;
};

window.loadTrackReversibleDataV67 = async function(filename, decodedBuffer) {
    window.reconstructedMasterBufferV67 = null;
    window.reconstructedReversedBufferV67 = null;
    window.currentTrackRevMapV67 = null;
    window.currentTrackRevNameV67 = null;

    if (!filename || !decodedBuffer || !window.audioCtx) return;

    try {
        const res = await fetch('/api/rev_info/' + encodeURIComponent(filename));
        if (!res.ok) return;
        const info = await res.json();
        if (!info || !info.has_rev || !info.seam_map) return;

        let pocketBuf = null;
        if (info.pocket_bytes && info.pocket_bytes > 0) {
            const pRes = await fetch('/api/rev_pocket/' + encodeURIComponent(filename));
            if (pRes.ok) {
                const pAb = await pRes.arrayBuffer();
                pocketBuf = await window.audioCtx.decodeAudioData(pAb);
            }
        }

        if (window.currentPlayingTrack !== filename) return;

        const t0 = performance.now();
        const master1x = window.reconstructOriginalBufferV67(decodedBuffer, info.seam_map, pocketBuf);
        const buildMs = Math.round(performance.now() - t0);

        if (master1x && window.currentPlayingTrack === filename) {
            window.reconstructedMasterBufferV67 = master1x;
            window.currentTrackRevMapV67 = info.seam_map;
            window.currentTrackRevNameV67 = filename;
            window.currentTrackRevBuildMsV67 = buildMs;

            setTimeout(async () => {
                if (window.currentPlayingTrack === filename && !window.reconstructedReversedBufferV67 && typeof window.cloneAndReverseBuffer === 'function') {
                    window.reconstructedReversedBufferV67 = await window.cloneAndReverseBuffer(master1x);
                }
            }, 40);

            if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            }
        }
    } catch (e) {}
};

// Перехватываем applyElasticHoseBufferLiveV46 / _pureV52ApplyHose так, чтобы при наличии капсулы JENNYV67
// и изменении скорости (targetSpd != 1.0) нарезка шла от чистого восстановленного 1.0x оригинала!
(function() {
    const origSyncV59 = window.syncMasterPlaybackEngineV59;
    window.syncMasterPlaybackEngineV59 = function(isDraggingArc) {
        const player = document.getElementById('audioPlayer');
        const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
        const targetSpd = window.getActiveTargetSpeedV59 ? window.getActiveTargetSpeedV59() : 1.0;

        const hasRev = Boolean(
            window.reconstructedMasterBufferV67 &&
            window.currentTrackRevMapV67 &&
            window.currentTrackRevNameV67 === window.currentPlayingTrack
        );

        // Если трек с капсулой JENNYV67 и пользователь изменил скорость (например, 0.5x трек включил на 2.0x)
        if (hasRev && Math.abs(targetSpd - 1.0) > 0.002 && gKey === 'jbuf-lock' && player && window.audioCtx) {
            if (isDraggingArc) {
                if (window._hoseArcDebounceTimerV47) clearTimeout(window._hoseArcDebounceTimerV47);
                window._hoseArcDebounceTimerV47 = setTimeout(() => {
                    window.syncMasterPlaybackEngineV59(false);
                }, 70);
                return;
            }

            const expSpd = parseFloat(window.currentTrackRevMapV67.spd) || 1.0;
            const effectiveSpd = Math.max(0.25, Math.min(3.0, expSpd * targetSpd));
            const tensionPct = (window.appConfig && window.appConfig.hoseTensionPct !== undefined) ? window.appConfig.hoseTensionPct : 100;
            const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
            const cleanBase = isRev ? (window.reconstructedReversedBufferV67 || window.reconstructedMasterBufferV67) : window.reconstructedMasterBufferV67;

            const activeBuf = window.buildElasticHoseBufferV46(cleanBase, effectiveSpd, tensionPct);

            if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0;
            player.preservesPitch = false;
            if (Math.abs(player.playbackRate - targetSpd) > 0.002) {
                try { player.playbackRate = targetSpd; } catch (e) {}
            }

            if (!player.paused) {
                if (window.studioSourceNode) {
                    window.studioSourceNode.onended = null;
                    try { window.studioSourceNode.stop(); } catch (e) {}
                    try { window.studioSourceNode.disconnect(); } catch (e) {}
                }
                window.studioSourceNode = window.audioCtx.createBufferSource();
                window.studioSourceNode._isHoseSpliced = true;
                window.studioSourceNode.buffer = activeBuf;
                window.studioSourceNode.playbackRate.value = 1.0;
                window.studioSourceNode.connect(window.inputMixer);

                let scaledOffset = (player.currentTime || 0) / targetSpd;
                if (!isFinite(scaledOffset) || scaledOffset < 0) scaledOffset = 0;
                if (scaledOffset >= activeBuf.duration) scaledOffset = Math.max(0, activeBuf.duration - 0.05);

                window.studioSourceNode.start(0, scaledOffset);
                window.isStudioPlaying = true;
            }

            const badge = document.getElementById('hoseLiveTelemetryV44');
            if (badge) {
                badge.style.color = '#3fb950';
                if (Math.abs(effectiveSpd - 1.0) < 0.005) {
                    badge.innerText = `🧬 REV 1.00x (Чистый оригинал из x${expSpd.toFixed(2)} | 0 швов!)`;
                } else {
                    const c = window._hoseSplicerCacheV46 || {};
                    badge.innerText = `🧬 REV➔V49: x${effectiveSpd.toFixed(2)} (из x${expSpd.toFixed(2)}) | Δy=${((c.avgSeamErrMv || 0) * 100).toFixed(1)}%`;
                }
            }
            return;
        }

        const r = typeof origSyncV59 === 'function' ? origSyncV59(isDraggingArc) : undefined;
        if (hasRev) {
            const badge = document.getElementById('hoseLiveTelemetryV44');
            const expSpd = parseFloat(window.currentTrackRevMapV67.spd) || 1.0;
            if (badge && !badge.innerText.includes('🧬')) {
                badge.innerText = `🧬 [REV x${expSpd.toFixed(2)}] ` + badge.innerText;
            }
        }
        return r;
    };
})();


// ⚙️ ПАТЧ V70: ЧЕСТНАЯ РКПП (ЗАПРЕТ WEB API ВОodРОВАТЬ МЕХАНИЗМ JBUF НА РЕВЕРСЕ + ЧИСТАЯ НЕЙТРАЛКА N + СКРЫТИЕ СТАРЫХ ГАЛОЧЕК)

window.hideLegacyGearCheckboxesV70 = function() {
    const legacyTexts = [
        'упругий шланг 90',
        'elastic hose 90',
        'сохранять темп (pitch lock)',
        'preserve tempo (pitch lock)'
    ];
    document.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        if (chk.closest('#exportModalV69')) return;
        const idLower = (chk.id || '').toLowerCase();
        const row = chk.closest('label, .pro-opt-row, .setting-row, .control-row') || chk.parentElement;
        const txt = row ? (row.textContent || '').toLowerCase() : '';
        if (
            idLower.includes('pitchlock') ||
            idLower.includes('elastichose') ||
            idLower.includes('hosemode') ||
            legacyTexts.some(w => txt.includes(w))
        ) {
            if (row) row.classList.add('legacy-hidden-gear-row-v70');
        }
    });
};

window.ensureWebApiReverseModalV70 = function() {
    let modal = document.getElementById('webApiRevConflictModalV70');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'webApiRevConflictModalV70';
    modal.className = 'webapi-rev-modal-backdrop-v70';
    modal.innerHTML = `
        <div class="webapi-rev-modal-box-v70" onclick="event.stopPropagation()">
            <div class="webapi-rev-title-v70" id="webApiRevTitleV70">⚠️ КОНФЛИКТ РЕЖИМА</div>
            <div class="webapi-rev-desc-v70" id="webApiRevDescV70">Web API не умеет проигрывать задом наперёд</div>
            <div class="webapi-rev-actions-v70">
                <button type="button" class="webapi-rev-btn-v70 btn-use-jbuf" id="btnWebRevToJbufV70">⚡ Вкл JBUF</button>
                <button type="button" class="webapi-rev-btn-v70 btn-use-normal" id="btnWebRevToNormV70">▶ Вкл норм проигрывание</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
};

window.setReverseStateCleanV70 = function(wantReverse) {
    const isNowRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    if (isNowRev === Boolean(wantReverse)) return;

    if (typeof window.toggleReverse === 'function' && !window._inConflictModalV70) {
        window._inConflictModalV70 = true;
        try {
            window.toggleReverse();
        } finally {
            window._inConflictModalV70 = false;
        }
        return;
    }

    window.isReversed = Boolean(wantReverse);
    if (window.scrubState) window.scrubState.isPhysicallyReversed = Boolean(wantReverse);
    const revBtn = document.getElementById('btnReverse') || document.querySelector('[onclick*="toggleReverse"]');
    if (revBtn) {
        revBtn.classList.toggle('active', Boolean(wantReverse));
    }
};

window.applyGearCleanV70 = function(targetGearKey) {
    if (!window.appConfig) window.appConfig = {};
    window.appConfig.gearKeyV66 = targetGearKey;

    if (typeof window.selectGearboxSlotV66 === 'function') {
        window._bypassGearConflictCheckV70 = true;
        try {
            window.selectGearboxSlotV66(targetGearKey);
        } finally {
            window._bypassGearConflictCheckV70 = false;
        }
    } else if (typeof window.setGearV66 === 'function') {
        window._bypassGearConflictCheckV70 = true;
        try {
            window.setGearV66(targetGearKey);
        } finally {
            window._bypassGearConflictCheckV70 = false;
        }
    }

    // Обновляем визуальную кулису РКПП, если есть слоты с data-gear
    document.querySelectorAll('[data-gear]').forEach(el => {
        el.classList.toggle('active-gear', el.getAttribute('data-gear') === targetGearKey);
    });
};

window.showWebApiReverseConflictModalV70 = function(requestedWebGear) {
    const modal = window.ensureWebApiReverseModalV70();
    const isEn = (typeof window.isTrackUiEnglish === 'function') && window.isTrackUiEnglish();

    const titleEl = document.getElementById('webApiRevTitleV70');
    const descEl = document.getElementById('webApiRevDescV70');
    const btnJbuf = document.getElementById('btnWebRevToJbufV70');
    const btnNorm = document.getElementById('btnWebRevToNormV70');

    if (titleEl) titleEl.textContent = isEn ? '⚠️ WEB API LIMITATION' : '⚠️ ОГРАНИЧЕНИЕ WEB API';
    if (descEl) descEl.textContent = isEn
        ? 'Web API cannot play audio backwards.'
        : 'Web API не умеет проигрывать задом наперёд.';
    if (btnJbuf) btnJbuf.textContent = isEn ? '⚡ Enable JBUF' : '⚡ Вкл JBUF';
    if (btnNorm) btnNorm.textContent = isEn ? '▶ Enable normal playback' : '▶ Вкл норм проигрывание';

    const webGear = (requestedWebGear === 'web-shift') ? 'web-shift' : 'web-lock';
    const matchingJbufGear = (webGear === 'web-shift') ? 'jbuf-shift' : 'jbuf-lock';

    btnJbuf.onclick = () => {
        modal.style.display = 'none';
        window.applyGearCleanV70(matchingJbufGear);
        window.setReverseStateCleanV70(true);
        if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
            window.syncMasterPlaybackEngineV59(false);
        }
    };

    btnNorm.onclick = () => {
        modal.style.display = 'none';
        window.setReverseStateCleanV70(false);
        window.applyGearCleanV70(webGear);
        if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
            window.syncMasterPlaybackEngineV59(false);
        }
    };

    modal.style.display = 'flex';
};

(function initGearboxIntegrityV70() {
    setTimeout(window.hideLegacyGearCheckboxesV70, 150);
    setTimeout(window.hideLegacyGearCheckboxesV70, 800);

    // 1. Перехватываем нажатие кнопки Реверс (toggleReverse)
    if (typeof window.toggleReverse === 'function' && !window._origToggleReverseV70) {
        window._origToggleReverseV70 = window.toggleReverse;
        window.toggleReverse = function() {
            if (window._inConflictModalV70) {
                return window._origToggleReverseV70.apply(this, arguments);
            }
            const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
            const isWebGear = (gKey === 'web-lock' || gKey === 'web-shift');
            const isCurrentlyRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

            // Если сейчас включён Web API и пользователь пытается включить Реверс — показываем окно выбора!
            if (isWebGear && !isCurrentlyRev) {
                window.showWebApiReverseConflictModalV70(gKey);
                return;
            }
            return window._origToggleReverseV70.apply(this, arguments);
        };
    }

    // 2. Перехватываем синхронизатор движка syncMasterPlaybackEngineV59
    const prevSync = window.syncMasterPlaybackEngineV59;
    window.syncMasterPlaybackEngineV59 = function(isDraggingArc) {
        window.hideLegacyGearCheckboxesV70();

        const player = document.getElementById('audioPlayer');
        const cfg = window.appConfig || {};
        const gKey = cfg.gearKeyV66 || 'jbuf-lock';
        const isWebGear = (gKey === 'web-lock' || gKey === 'web-shift');
        const isNeutral = (gKey === 'neutral' || gKey === 'n');
        const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

        // Если активен Реверс и выбрана передача Web API — не даём Web API воровать буфер JBUF, вызываем модалку!
        if (isWebGear && isRev && !window._bypassGearConflictCheckV70) {
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null;
                try { window.studioSourceNode.stop(); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
                window.studioSourceNode = null;
            }
            window.isStudioPlaying = false;
            window.showWebApiReverseConflictModalV70(gKey);
            return;
        }

        // Если включена НЕЙТРАЛКА (N) — сцепление со скоростью разомкнуто, чистый поток 1.00x
        if (isNeutral && player) {
            if (window.studioSourceNode && !isRev) {
                window.studioSourceNode.onended = null;
                try { window.studioSourceNode.stop(); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
                window.studioSourceNode = null;
                window.isStudioPlaying = false;
            }
            if (!isRev) {
                if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
                player.preservesPitch = true;
                if (Math.abs(player.playbackRate - 1.0) > 0.001) {
                    try { player.playbackRate = 1.0; } catch (e) {}
                }
            }
            const badge = document.getElementById('hoseLiveTelemetryV44');
            if (badge) {
                badge.style.color = '#8b949e';
                badge.innerText = '⚙️ НЕЙТРАЛЬ [N]: x1.00 (Сцепление скорости разомкнуто)';
            }
            return;
        }

        // Если выбрана 3-я или 4-я передача (Web API) — принудительно гасим JBUF studioSourceNode,
        // чтобы играл исключительно нативный HTML5 <audio> поток!
        if (isWebGear && player) {
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null;
                try { window.studioSourceNode.stop(); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
                window.studioSourceNode = null;
            }
            window.isStudioPlaying = false;
            if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;

            const targetSpd = (typeof window.getActiveTargetSpeedV59 === 'function')
                ? window.getActiveTargetSpeedV59()
                : 1.0;
            const lockPitch = (gKey === 'web-lock');
            player.preservesPitch = lockPitch;
            if ('mozPreservesPitch' in player) player.mozPreservesPitch = lockPitch;
            if ('webkitPreservesPitch' in player) player.webkitPreservesPitch = lockPitch;

            if (Math.abs(player.playbackRate - targetSpd) > 0.002) {
                try { player.playbackRate = targetSpd; } catch (e) {}
            }

            const badge = document.getElementById('hoseLiveTelemetryV44');
            if (badge) {
                badge.style.color = '#58a6ff';
                badge.innerText = lockPitch
                    ? `🌐 Web API [PITCH LOCK]: x${targetSpd.toFixed(2)} (Прямой HTML5 поток)`
                    : `🌐 Web API [PITCH SHIFT]: x${targetSpd.toFixed(2)} (Прямой HTML5 поток)`;
            }
            return;
        }

        return typeof prevSync === 'function' ? prevSync(isDraggingArc) : undefined;
    };
})();
