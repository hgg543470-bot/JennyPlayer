/* ============================================================================
 * ui_lang.js — Язык: определение языка, tr(), перевод статичных надписей
 *
 * Склейка:  /bundle_1_studio.js, модуль 1 из 12. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   detectInitialLang, getLang, tr, toggleLanguage, localizeCeilingBreakdown, showToast, ensureTrackInfoModal, applyStaticDOMTranslations, translateDynamicListPlaceholders
 * Откуда:   ui_help.js (коммит 9ae6639), строки 1–187. Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */
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

;(function() {
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
