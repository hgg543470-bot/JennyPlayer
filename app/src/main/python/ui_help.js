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
    const folderTrigger = document.getElementById('folderIconTrigger');
    if (folderTrigger && folderTrigger.parentElement) {
        let langBtn = document.getElementById('mainLangToggleBtn');
        if (!langBtn) {
            langBtn = document.createElement('button');
            langBtn.id = 'mainLangToggleBtn'; langBtn.type = 'button'; langBtn.className = 'jenny-lang-btn';
            langBtn.onclick = (e) => window.toggleLanguage(e);
            folderTrigger.parentElement.appendChild(langBtn);
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










// 🐍 ПАТЧ V48: ЧИСТЫЙ 90° РЕЗАК БЕЗ ХРИПА (ЗАХВАТ ВЫСОТЫ И УГЛА СКЛОНА + C2 СКРУГЛЕНИЕ КОНЦОВ)

window._hoseSplicerCacheV46 = {
    srcBuffer: null,
    speed: 1.0,
    tension: 1.0,
    splicedBuffer: null,
    lastBuildMs: 0,
    avgSeamErrMv: 0
};

// Стерео-синхронный 90° сплайсер V48:
// 1) Никакой пилы 250 Гц на басу (ищет точку на соседней дуге с той же высотой y и тем же углом наклона 90°).
// 2) Ползунок "Стягивание (%)" больше НЕ разрывает шов на 25% и НЕ перелетает на 200% — шов всегда 100% заподлицо!
// 3) На высоких амплитудах упруго прижимает высоту петли (громкость), а на пологих участках двигает время.
window.buildElasticHoseBufferV46 = function(srcBuffer, speed, tensionPct) {
    if (!srcBuffer || !window.audioCtx) return srcBuffer;
    const spd = Math.max(0.25, Math.min(3.0, parseFloat(speed) || 1.0));
    const tension = Math.max(0.2, Math.min(2.0, (parseFloat(tensionPct) || 100) / 100));

    if (Math.abs(spd - 1.0) < 0.002) {
        window._hoseSplicerCacheV46.lastBuildMs = 0;
        window._hoseSplicerCacheV46.avgSeamErrMv = 0;
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

    // Шаг между швами 12 мс (576 сэмплов при 48 кГц), зона гладкого скругления торцов 64 сэмпла (~1.3 мс)
    const stepOut = Math.max(256, Math.round(0.012 * sr));
    const searchRad = Math.max(128, Math.round(0.0075 * sr));
    const filletLen = Math.max(32, Math.round(0.0013 * sr));

    // Предварительно считаем гладкую C2-кривую скругления (Cosine-Hermite), чтобы 0% щелчков и 0% хрипа
    const blendCurve = new Float32Array(filletLen);
    const tangDecay = new Float32Array(filletLen);
    for (let i = 0; i < filletLen; i++) {
        const t = i / filletLen;
        // C2-гладкий переход от 0 к 1 с нулевым изломом на обоих концах
        const b = 0.5 * (1.0 - Math.cos(Math.PI * t));
        blendCurve[i] = b;
        const r = 1.0 - b;
        tangDecay[i] = r * r;
    }

    const in0 = chIn[0];
    const in1 = numCh > 1 ? chIn[1] : in0;

    // Копируем стартовый кусок 1:1
    const initCopy = Math.min(stepOut, outLen, inLen);
    for (let c = 0; c < numCh; c++) {
        const inp = chIn[c];
        const out = chOut[c];
        for (let i = 0; i < initCopy; i++) {
            out[i] = inp[i];
        }
    }

    let outPos = initCopy;
    let inCursor = initCopy;
    let seamCount = 0;
    let totalSeamDiff = 0;

    // Коэффициент вертикального стягивания высоких петель (по закону Упругого Шланга)
    const isFast = spd > 1.0;
    const speedDelta = Math.abs(spd - 1.0);
    const vertFactor = Math.min(0.32, speedDelta * tension * 0.38);

    while (outPos + stepOut + filletLen < outLen) {
        const p1 = Math.round(inCursor);
        const idealP2 = Math.round(outPos * spd);

        if (p1 < 4 || p1 + stepOut + filletLen >= inLen) break;
        if (idealP2 < 4 || idealP2 + stepOut + filletLen >= inLen) break;

        // Параметры волны в точке первого 90° разреза p1 (высота + наклон узкий + наклон широкий басовый)
        const y1L = in0[p1], y1R = in1[p1];
        const s1L = y1L - in0[p1 - 1], s1R = y1R - in1[p1 - 1];
        const w1L = in0[p1 + 3] - in0[p1 - 3], w1R = in1[p1 + 3] - in1[p1 - 3];

        const minP2 = Math.max(4, idealP2 - searchRad);
        const maxP2 = Math.min(inLen - stepOut - filletLen - 4, idealP2 + searchRad);

        let bestP2 = idealP2;
        let bestCost = 1e9;

        // Ищем точку второго 90° разреза p2, где волна лежит на ТОЙ ЖЕ высоте и идёт под ТЕМ ЖЕ углом склона!
        for (let cand = minP2; cand <= maxP2; cand += 3) {
            const y2L = in0[cand], y2R = in1[cand];
            const s2L = y2L - in0[cand - 1], s2R = y2R - in1[cand - 1];
            const w2L = in0[cand + 3] - in0[cand - 3], w2R = in1[cand + 3] - in1[cand - 3];

            // Запрещаем стыковать восходящий склон с нисходящим (знаки наклона должны совпадать!)
            const dirPen = ((s1L * s2L < 0) || (w1L * w2L < 0) || (s1R * s2R < 0)) ? 1.8 : 0.0;

            const heightDiff = Math.abs(y2L - y1L) + Math.abs(y2R - y1R);
            const slopeDiff = (Math.abs(s2L - s1L) + Math.abs(s2R - s1R)) * 3.5 +
                              (Math.abs(w2L - w1L) + Math.abs(w2R - w1R)) * 1.8;

            // При высоком натяжении шланга (tension) сильнее штрафуем разрезы на высоких громких пиках (режем в низинах!)
            const ampLevel = Math.abs(y2L) + Math.abs(y2R);
            const peakAvoidPen = ampLevel * tension * 0.22;

            const cost = heightDiff * 2.4 + slopeDiff + dirPen + peakAvoidPen;
            if (cost < bestCost) {
                bestCost = cost;
                bestP2 = cand;
            }
        }

        // Уточняющий поиск с шагом 1 сэмпл вокруг лучшей точки (для 100% попадания в фазу и высоту)
        const fineStart = Math.max(minP2, bestP2 - 2);
        const fineEnd = Math.min(maxP2, bestP2 + 2);
        for (let cand = fineStart; cand <= fineEnd; cand++) {
            const y2L = in0[cand], y2R = in1[cand];
            const s2L = y2L - in0[cand - 1], s2R = y2R - in1[cand - 1];
            const heightDiff = Math.abs(y2L - y1L) + Math.abs(y2R - y1R);
            const slopeDiff = (Math.abs(s2L - s1L) + Math.abs(s2R - s1R)) * 3.5;
            const cost = heightDiff * 2.4 + slopeDiff;
            if (cost < bestCost) {
                bestCost = cost;
                bestP2 = cand;
            }
        }

        totalSeamDiff += Math.abs(in0[bestP2] - y1L);
        seamCount++;

        // Стягиваем концы заподлицо и скругляем фаску на 64 сэмплах без единого скачка
        for (let c = 0; c < numCh; c++) {
            const inp = chIn[c];
            const out = chOut[c];

            const yL = inp[p1 - 1];
            const sL = inp[p1] - yL;
            const yR = inp[bestP2];
            // Точная остаточная разница высоты на шве (всегда сводится в 0.0 на точке стыка!)
            const dy = yR - (yL + sL);

            for (let i = 0; i < stepOut; i++) {
                let v = inp[bestP2 + i];

                if (i < filletLen) {
                    const b = blendCurve[i];
                    const contVal = inp[p1 + i];
                    // Плавно переводим касательную старой дуги в новую и гасим микро-ступеньку dy вдоль склона
                    const pulledNew = v - dy * tangDecay[i];
                    v = contVal * (1.0 - b) + pulledNew * b;
                }

                // Вертикальная работа Упругого Шланга: высокие петли чуть сжимаются по громкости при ускорении
                const av = Math.abs(v);
                if (av > 0.35) {
                    if (isFast) {
                        v *= (1.0 - vertFactor * (av - 0.35));
                    } else {
                        v *= (1.0 + vertFactor * 0.75 * (av - 0.35));
                    }
                    if (Math.abs(v) > 0.96) v = Math.tanh(v);
                }

                out[outPos + i] = v;
            }
        }

        outPos += stepOut;
        inCursor = bestP2 + stepOut;
    }

    // Дописываем хвост трека
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
    return outBuffer;
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
        badge.innerText = `🐍 90° C2: Δy=${(c.avgSeamErrMv * 100).toFixed(1)}% | x${targetSpd.toFixed(2)} (${c.lastBuildMs}мс)`;
    }
};

window.installHosePlayerHooksV46 = function() {
    const player = document.getElementById('audioPlayer');
    if (!player || player._hoseHookedV48) return;
    player._hoseHookedV48 = true;

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
            window.showToast(window.tr('🐍 90° Резак V48 ВКЛ: захват высоты и угла без хрипа!', '🐍 90° Splicer V48 ON: zero-rasp slope & height lock!'), ev);
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
                🐍 ${window.tr('Упругий Шланг 90° (Без хрипа C2)', 'Elastic Hose 90° (Zero-Rasp C2)')}
            </label>
            <span id="hoseLiveTelemetryV44" style="font-size:11px;font-family:monospace;color:#58a6ff;background:#0d1117;padding:3px 7px;border-radius:6px;border:1px solid #262c36;">
                ${isEn ? '🐍 90° C2 Активен' : window.tr('Выкл', 'OFF')}
            </span>
        </div>
        <div class="setting-row" style="padding:4px 0;border:none;">
            <span style="font-size:12px;color:#8b949e;">🧲 ${window.tr('Упругость петель (Амплитуда ↔ Время %):', 'Loop Elasticity (Amp ↔ Time %):')}</span>
            <div class="val-group">
                <span class="val-badge" id="val_hoseTensionV44">${tens}</span>
            </div>
        </div>
        <input type="range" id="rng_hoseTensionV44" class="hz-slider" min="20" max="200" step="5" value="${tens}" oninput="window.onHoseTensionInputV44(this.value)">
        <div style="font-size:11px;color:#8b949e;margin-top:4px;line-height:1.35;">
            ${window.tr(
                'Находит на соседней дуге точку с той же высотой и углом 90°, стягивает концы заподлицо и скругляет фаску C2 без 250Гц хрипа.',
                'Finds matching height & 90° slope on adjacent wave arc, pulls ends 100% flush, and applies C2 fillet with zero 250Hz rasp.'
            )}
        </div>
    `;
    pitchRow.insertAdjacentElement('afterend', box);
    window.installHosePlayerHooksV46();
};

setTimeout(() => {
    window.injectElasticHoseControlsV44();
    window.installHosePlayerHooksV46();
    if (typeof window.tagUniformResetButtonsV38 === 'function') window.tagUniformResetButtonsV38();
}, 350);
