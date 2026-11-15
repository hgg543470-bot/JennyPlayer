/* ============================================================================
 * ui_settings.js — Настройки: слоты форматов, потоки, EQ/громкость, язык, стартовый гид, toggleModal
 *
 * Склейка:  /bundle_2_player.js, модуль 2 из 18. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   syncHeaderHeightWithModalsV71, toggleModal, openInlineAddFormatBoxV138, prompt, onReturnedFromPermissionScreenV146, isAudioTrackAllowedByFormatSlotsV150, isTrackAllowedByFormatSlots, syncFormatSlotsUI, saveFormatSlotsToConfig, resetFormatSlots … (всего функций: 42)
 * Откуда:   ui_v71.js (коммит 9ae6639), строки 1066…33918 (26 фрагментов, вперемешку с другими темами). Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */


// Прячем ленту плейлистов и поджимаем высоту шапки до 102px, когда открыто любое модальное окно (⚙️, 🄠, 📊, 🎨)
window.syncHeaderHeightWithModalsV71 = function() {
    const sm = document.getElementById('settingsModal');
    const em = document.getElementById('eqModal');
    const sp = document.getElementById('specModal');
    const tm = document.getElementById('themeModal');
    const fm = document.getElementById('favModal');
    const isOpen = (sm && sm.classList.contains('open')) ||
                   (em && em.classList.contains('open')) ||
                   (sp && sp.classList.contains('open')) ||
                   (tm && tm.classList.contains('open')) ||
                   (fm && fm.classList.contains('open'));

    const plWrap = document.getElementById('jennyPlaylistBarWrapV71');
    const stickyTop = document.querySelector('.sticky-top');
    if (plWrap) {
        plWrap.style.setProperty('display', isOpen ? 'none' : 'flex', 'important');
    }
    if (stickyTop) {
        stickyTop.style.setProperty('height', isOpen ? '102px' : '140px', 'important');
    }
    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.style.setProperty('top', isOpen ? '102px' : '140px', 'important');
    });
};

;(function attachHeaderModalSyncV71() {
    const obs = new MutationObserver(() => window.syncHeaderHeightWithModalsV71());
    ['settingsModal', 'eqModal', 'favModal', 'specModal', 'themeModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) obs.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
    });
    const origToggle = window.toggleModal;
    if (typeof origToggle === 'function' && !window._toggleModalHeaderHookV71) {
        window._toggleModalHeaderHookV71 = true;
        window.toggleModal = function(id) {
            const r = origToggle.apply(this, arguments);
            window.syncHeaderHeightWithModalsV71();
            setTimeout(window.syncHeaderHeightWithModalsV71, 30);
            return r;
        };
    }
    window.syncHeaderHeightWithModalsV71();
})();

window.syncHeaderHeightWithModalsV71 = function() {
    const isOpen = ['settingsModal', 'eqModal', 'specModal', 'themeModal', 'favModal'].some(id => {
        const el = document.getElementById(id);
        return el && el.classList.contains('open');
    });
    const plWrap = document.getElementById('jennyPlaylistBarWrapV71');
    const subWrap = window.ensureSubStripPinnedInHeaderV74_7();
    const stickyTop = document.querySelector('.sticky-top');
    const midList = document.querySelector('.middle-list-container');
    const hasSub = Boolean(subWrap && subWrap.innerHTML && subWrap.innerHTML.trim().length > 0);

    if (plWrap) plWrap.style.setProperty('display', isOpen ? 'none' : 'flex', 'important');
    if (subWrap) subWrap.style.setProperty('display', (!isOpen && hasSub) ? 'block' : 'none', 'important');

    const targetH = isOpen ? '104px' : (hasSub ? '184px' : '142px');
    if (stickyTop) stickyTop.style.setProperty('height', targetH, 'important');
    if (midList) midList.style.setProperty('top', targetH, 'important');
    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.style.setProperty('top', isOpen ? '104px' : targetH, 'important');
    });
};

// Перехватываем клик по кнопке «+ Формат» и вместо неработающего в Android WebView window.prompt() рисуем встроенное поле ввода!
window.openInlineAddFormatBoxV138 = function(btnEl, origFn) {
let box = document.getElementById('jennyInlineAddFormatBoxV138');
if (box) {
box.remove();
return;
}
box = document.createElement('div');
box.id = 'jennyInlineAddFormatBoxV138';
box.style.cssText = 'display:flex;align-items:center;gap:6px;margin:8px 0;padding:8px;background:#090d14;border:1.5px solid #3fb950;border-radius:10px;';
box.innerHTML = `
<input type="text" id="jennyNewExtInputV138" placeholder=".mkv, .avi, .flv..." style="flex:1;background:#161b22;border:1px solid #30363d;color:#fff;padding:6px 10px;border-radius:7px;font-size:12px;outline:none;">
<button type="button" id="jennyConfirmExtBtnV138" style="padding:6px 12px;border-radius:7px;background:#238636;border:1px solid #3fb950;color:#fff;font-size:11.5px;font-weight:bold;">✅ ОК</button>
<button type="button" onclick="this.parentElement.remove()" style="padding:6px 9px;border-radius:7px;background:#21262d;border:1px solid #30363d;color:#8b949e;font-size:11.5px;">✖</button>
`;
const container = (btnEl && btnEl.closest('div')?.parentElement) || document.getElementById('settingsModal');
if (btnEl && btnEl.parentElement && btnEl.parentElement.parentElement) {
btnEl.parentElement.parentElement.insertBefore(box, btnEl.parentElement.nextSibling);
} else if (container) {
container.appendChild(box);
}
const inp = document.getElementById('jennyNewExtInputV138');
const okBtn = document.getElementById('jennyConfirmExtBtnV138');
if (inp) setTimeout(() => inp.focus(), 50);

const submitExt = () => {
let val = (inp ? inp.value : '').trim().toLowerCase();
if (!val) return;
if (!val.startsWith('.')) val = '.' + val;
window._customPromptReturnV138 = val;
if (typeof origFn === 'function') {
try { origFn(val); } catch (e) {}
}
window.ensureAllVideoFormatsInConfigV138();
if (typeof window.saveConfig === 'function') { try { window.saveConfig(); } catch (e) {} }
box.remove();
if (typeof window.showToast === 'function') window.showToast('✅ Формат добавлен: ' + val);
if (typeof window.syncDiscoveredVideosIntoPlaylistV134 === 'function') window.syncDiscoveredVideosIntoPlaylistV134(true);
};
if (okBtn) okBtn.onclick = submitExt;
if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitExt(); });
};

// Перехватываем window.prompt во всем приложении, чтобы любая кнопка с prompt() открывала рабочее окно ввода
window.prompt = function(msg, defVal) {
if (window._customPromptReturnV138) {
const v = window._customPromptReturnV138;
window._customPromptReturnV138 = null;
return v;
}
const activeBtn = document.activeElement;
const callerFn = arguments.callee && arguments.callee.caller;
window.openInlineAddFormatBoxV138(activeBtn, callerFn);
return null;
};

// === 📌🛡️ JENNY V147: AUTO OVERLAY ON HOME, REMOVE DESKTOP BUTTON & FIX VERTICAL VIDEO TITLE ===
/* [split] V147: кусок исходного IIFE (ui_v71.js, строки 12011–12234) → ui_settings.js */
;(function() {
// 1. Стили верхней шапки видеоплеера: полное удаление кнопки "На раб. стол" и запрет сплющивания названия в столбик по 1 букве!
const styleId = 'jennyV147VideoHeaderFix';

// 5. Плавный возврат из экрана разрешений без чёрного экрана
window.onReturnedFromPermissionScreenV146 = function(granted) {
    window.removeDesktopOverlayButtonsFromHudV147();
    const st = window._vidStateV130 || {};
    const vid = document.getElementById('jennyVideoElV130');

    if (st.active && vid) {
        const targetSec = (st._permSavedTimeV146 !== undefined && st._permSavedTimeV146 > 0)
            ? st._permSavedTimeV146
            : ((vid.currentTime || 0) + (st.remuxBaseOffset || 0));
        const shouldPlay = (st._permWasPlayingV146 !== undefined) ? st._permWasPlayingV146 : Boolean(window._vidPlayIntentV132);

        vid.style.transform = 'translateZ(0.01px)';
        requestAnimationFrame(() => { vid.style.transform = ''; });

        if (vid.readyState < 2 || vid.videoWidth === 0 || vid.error) {
            if (st.usingRemux) {
                st.remuxBaseOffset = targetSec;
                const tcFlag = /\.avi$/i.test(st.currentTitle) ? '1' : '0';
                vid.src = `/api/video/live_remux?src=${encodeURIComponent(st.currentUrl)}&start=${targetSec.toFixed(1)}&transcode=${tcFlag}&t=${Date.now()}`;
            } else {
                const curSrc = vid.getAttribute('src') || st.currentUrl;
                vid.src = curSrc;
                vid.addEventListener('loadedmetadata', () => {
                    try { vid.currentTime = targetSec; } catch (e) {}
                }, { once: true });
            }
        }

        if (shouldPlay) {
            window._vidPlayIntentV132 = true;
            vid.play().catch(() => {});
            if (typeof window.syncVideoRamEngineV131 === 'function') {
                window.syncVideoRamEngineV131(false);
            }
        }
    }
};
})();

/* [split] V150: кусок исходного IIFE (ui_v71.js, строки 12237–12748) → ui_settings.js */
;(function() {

// 2. Два независимых набора форматов: для Деки А (Аудио) и для Деки Б (Видео)
window.DEFAULT_AUDIO_FORMAT_SLOTS_V150 = [
    { en: true, ext: '.mp3' },
    { en: true, ext: '.opus' },
    { en: true, ext: '.m4a' },
    { en: true, ext: '.flac' },
    { en: true, ext: '.wav' },
    { en: true, ext: '.ogg' },
    { en: true, ext: '.aac' },
    { en: true, ext: '.xflac' }
];

window.DEFAULT_VIDEO_FORMAT_SLOTS_V150 = [
    { en: true, ext: '.mp4' },
    { en: true, ext: '.mkv' },
    { en: true, ext: '.avi' },
    { en: true, ext: '.webm' },
    { en: true, ext: '.mov' },
    { en: true, ext: '.m4v' },
    { en: true, ext: '.3gp' },
    { en: true, ext: '.flv' }
];

window.KNOWN_VIDEO_EXT_SET_V150 = new Set(['.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v', '.3gp', '.flv', '.wmv', '.ts', '.mpeg', '.mpg']);

window.isAudioTrackAllowedByFormatSlotsV150 = function(filename) {
    if (!filename) return true;
    const { audioSlots } = window.ensureDualDeckFormatSlotsV150();
    const activeExts = audioSlots
        .filter(s => s && s.en && String(s.ext || '').trim())
        .map(s => '.' + String(s.ext).trim().toLowerCase().replace(/^\.+/, ''));
    if (activeExts.length === 0) return false;
    const lower = String(filename).toLowerCase().trim();
    return activeExts.some(ext => lower.endsWith(ext));
};

// Переопределяем глобальный фильтр форматов: видео проверяется по слотам Деки Б, аудио — по слотам Деки А!
window.isTrackAllowedByFormatSlots = function(filename) {
    if (!filename) return true;
    if (window.isVideoFileNameV130(filename)) {
        return window.isVideoTrackAllowedByFormatSlotsV150(filename);
    }
    return window.isAudioTrackAllowedByFormatSlotsV150(filename);
};

// 3. Отрисовка блока «Форматы файлов» в Настройках отдельно для Деки А (Аудио) и Деки Б (Видео)
window.syncFormatSlotsUI = function() {
    const { audioSlots, videoSlots } = window.ensureDualDeckFormatSlotsV150();
    const isVideoDeck = (window._activeUiDeckV131 === 'video');
    const activeList = isVideoDeck ? videoSlots : audioSlots;
    const isEn = (typeof window.getLang === 'function' && window.getLang() === 'en');

    const sec = document.getElementById('customFormatsSection');
    if (sec) {
        sec.style.borderLeftColor = isVideoDeck ? '#ff7b72' : '#58a6ff';
        const sum = sec.querySelector('summary');
        if (sum) {
            const titleTxt = isVideoDeck
                ? (isEn ? '🎬 Video File Formats (Deck B)' : '🎬 Форматы видеофайлов (Дека Б)')
                : (isEn ? '🎵 Audio File Formats (Deck A)' : '🎵 Форматы аудиофайлов (Дека А)');
            const firstSpan = sum.querySelector('span:not(.jenny-help-badge)');
            if (firstSpan) firstSpan.innerText = titleTxt;
            else sum.innerHTML = `<span>${titleTxt}</span>`;
        }
    }

    const grid = document.getElementById('formatSlotsGrid');
    if (!grid) return;

    const accentColor = isVideoDeck ? '#ff7b72' : '#58a6ff';
    grid.innerHTML = activeList.map((s, idx) => {
        const i = idx + 1;
        let extVal = String(s.ext || '').trim().toLowerCase();
        if (extVal && !extVal.startsWith('.')) extVal = '.' + extVal;
        const specialClr = (extVal === '.xflac') ? '#3fb950' : accentColor;
        return `<div style="display:flex; align-items:center; justify-content:space-between; background:#0d1117; padding:4px 8px; border-radius:4px; border:1px solid ${s.en ? '#30363d' : '#1c2128'};">
            <input type="checkbox" id="cfg_fmt_${i}_en" ${s.en ? 'checked' : ''} onchange="window.saveFormatSlotsToConfig(true)">
            <input type="text" id="cfg_fmt_${i}_val" value="${extVal}" oninput="window.saveFormatSlotsToConfig(false)" onchange="window.saveFormatSlotsToConfig(true)" style="width:65px; font-size:12px; font-weight:bold; padding:2px; text-align:center; background:transparent; color:${specialClr}; opacity:${s.en ? '1' : '0.4'}; border:none; outline:none; font-family:monospace;">
        </div>`;
    }).join('');
};

window.saveFormatSlotsToConfig = async function(triggerReload) {
    const { audioSlots, videoSlots } = window.ensureDualDeckFormatSlotsV150();
    const isVideoDeck = (window._activeUiDeckV131 === 'video');
    const targetList = isVideoDeck ? videoSlots : audioSlots;
    const newSlots = [];

    for (let i = 1; i <= targetList.length; i++) {
        const chk = document.getElementById(`cfg_fmt_${i}_en`);
        const inp = document.getElementById(`cfg_fmt_${i}_val`);
        let raw = inp ? inp.value.trim().toLowerCase() : (targetList[i - 1]?.ext || '');
        if (raw && !raw.startsWith('.')) raw = '.' + raw;
        if (!raw) continue;
        const isEn = chk ? Boolean(chk.checked) : true;
        if (inp) inp.style.opacity = isEn ? '1' : '0.4';
        newSlots.push({ en: isEn, ext: raw });
    }

    const cfg = window._musicConfigRefV131 || window.appConfig || {};
    if (isVideoDeck) {
        cfg.formatSlotsVideoV150 = newSlots;
        window.KNOWN_VIDEO_EXT_SET_V150 = new Set([...window.KNOWN_VIDEO_EXT_SET_V150, ...newSlots.map(s => s.ext)]);
    } else {
        cfg.formatSlotsAudioV150 = newSlots;
    }
    cfg.formatSlots = [...(cfg.formatSlotsAudioV150 || []), ...(cfg.formatSlotsVideoV150 || [])];

    if (window.appConfig) {
        window.appConfig.formatSlotsAudioV150 = cfg.formatSlotsAudioV150;
        window.appConfig.formatSlotsVideoV150 = cfg.formatSlotsVideoV150;
        window.appConfig.formatSlots = cfg.formatSlots;
    }
    localStorage.setItem('ytm_config', JSON.stringify(cfg));

    try {
        await fetch('/api/config/save_single', {
            method: 'POST',
            body: JSON.stringify({ category: 'main', key: 'formatSlots', value: cfg.formatSlots })
        });
    } catch (e) {}

    window.renderPlaylistStripChipsV71();
    window.renderActivePlaylistTracksV71(false);

    if (triggerReload) {
        await window.smartRefreshCurrentPlaylistV150(null, true);
    }
};

window.resetFormatSlots = async function(ev) {
    const isVideoDeck = (window._activeUiDeckV131 === 'video');
    const cfg = window._musicConfigRefV131 || window.appConfig || {};
    if (isVideoDeck) {
        cfg.formatSlotsVideoV150 = JSON.parse(JSON.stringify(window.DEFAULT_VIDEO_FORMAT_SLOTS_V150));
    } else {
        cfg.formatSlotsAudioV150 = JSON.parse(JSON.stringify(window.DEFAULT_AUDIO_FORMAT_SLOTS_V150));
    }
    window.syncFormatSlotsUI();
    await window.saveFormatSlotsToConfig(true);
    try { navigator.vibrate(35); } catch (e) {}
    if (typeof window.showToast === 'function') {
        window.showToast(isVideoDeck ? '🔄 Форматы видео (Дека Б) сброшены!' : '🔄 Форматы аудио (Дека А) сброшены!', ev);
    }
};

window.addNewFormatSlotV85 = function(ev) {
    const btn = ev && ev.currentTarget ? ev.currentTarget : document.querySelector('#customFormatsSection button');
    let box = document.getElementById('jennyInlineAddFormatBoxV138');
    if (box) { box.remove(); return; }

    const isVideoDeck = (window._activeUiDeckV131 === 'video');
    box = document.createElement('div');
    box.id = 'jennyInlineAddFormatBoxV138';
    box.style.cssText = 'display:flex;align-items:center;gap:6px;margin:8px 0;padding:8px;background:#090d14;border:1.5px solid #3fb950;border-radius:10px;';
    box.innerHTML = `
        <input type="text" id="jennyNewExtInputV138" placeholder="${isVideoDeck ? '.mkv, .avi, .ts...' : '.wv, .ape, .alac...'}" style="flex:1;background:#161b22;border:1px solid #30363d;color:#fff;padding:6px 10px;border-radius:7px;font-size:12px;outline:none;text-align:left !important;">
        <button type="button" id="jennyConfirmExtBtnV138" style="padding:6px 12px;border-radius:7px;background:#238636;border:1px solid #3fb950;color:#fff;font-size:11.5px;font-weight:bold;">✅ ОК</button>
        <button type="button" onclick="this.parentElement.remove()" style="padding:6px 9px;border-radius:7px;background:#21262d;border:1px solid #30363d;color:#8b949e;font-size:11.5px;">✖</button>
    `;
    const grid = document.getElementById('formatSlotsGrid');
    if (grid && grid.parentElement) {
        grid.parentElement.insertBefore(box, grid);
    }
    const inp = document.getElementById('jennyNewExtInputV138');
    const okBtn = document.getElementById('jennyConfirmExtBtnV138');
    if (inp) setTimeout(() => inp.focus(), 40);

    const submit = async () => {
        let val = (inp ? inp.value : '').trim().toLowerCase();
        if (!val) return;
        if (!val.startsWith('.')) val = '.' + val;
        const { audioSlots, videoSlots } = window.ensureDualDeckFormatSlotsV150();
        const targetList = isVideoDeck ? videoSlots : audioSlots;
        const ex = targetList.find(s => String(s.ext || '').toLowerCase() === val);
        if (ex) ex.en = true;
        else targetList.push({ en: true, ext: val });
        if (isVideoDeck) window.KNOWN_VIDEO_EXT_SET_V150.add(val);
        box.remove();
        window.syncFormatSlotsUI();
        await window.saveFormatSlotsToConfig(true);
        if (typeof window.showToast === 'function') {
            window.showToast(`✅ Добавлен формат ${val} в ${isVideoDeck ? 'Деку Б (Видео)' : 'Деку А (Аудио)'}`);
        }
    };
    if (okBtn) okBtn.onclick = submit;
    if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
};
})();



// ============================================================================
// 🧭 JENNY V165: 4-СТРАНИЧНЫЙ СТАРТОВЫЙ ГИД (ONBOARDING) + УПРАВЛЕНИЕ ПРАВАМИ И СПРАВКОЙ
// ============================================================================
/* [split] V165: кусок исходного IIFE (ui_v71.js, строки 12835–13214) → ui_settings.js */
;(function initJennyOnboardingV165() {
    window._onbStateV165 = {
        page: 0,
        storageOk: false,
        notifOk: false,
        overlayOk: false
    };

    window.checkPermStatusV165 = function() {
        const br = window.AndroidBridge;
        if (br) {
            try {
                window._onbStateV165.storageOk = (typeof br.hasStoragePermission === "function") ? Boolean(br.hasStoragePermission()) : true;
            } catch (e) {}
            try {
                window._onbStateV165.notifOk = (typeof br.hasNotificationPermission === "function") ? Boolean(br.hasNotificationPermission()) : true;
            } catch (e) {}
            try {
                window._onbStateV165.overlayOk = (typeof br.canDrawOverlays === "function") ? Boolean(br.canDrawOverlays()) : true;
            } catch (e) {}
        }
        return window._onbStateV165;
    };

    window.syncOnboardingPermsV165 = function() {
        window.checkPermStatusV165();
        const modal = document.getElementById("jennyOnboardingModalV165");
        if (modal && modal.style.display !== "none") {
            window.renderOnboardingPageV165(window._onbStateV165.page);
        }
    };

    window.onOnboardingPermUpdatedV165 = function(which, granted) {
        if (which === "storage") window._onbStateV165.storageOk = Boolean(granted);
        if (which === "notif") window._onbStateV165.notifOk = Boolean(granted);
        if (which === "overlay") window._onbStateV165.overlayOk = Boolean(granted);
        window.syncOnboardingPermsV165();
        if (granted && typeof window.showToast === "function") {
            const labels = {
                storage: "✅ Доступ к медиафайлам выдан!",
                notif: "✅ Пульт в шторке и фоновый режим активны!",
                overlay: "✅ Режим «Поверх других окон» активирован!"
            };
            window.showToast(labels[which] || "✅ Разрешение получено!");
        }
    };

    window.triggerOnboardingPermActionV165 = function(which) {
        try { navigator.vibrate(25); } catch (e) {}
        const br = window.AndroidBridge;
        if (!br) {
            if (typeof window.showToast === "function") {
                window.showToast("ℹ️ В браузерном режиме системные права Android не требуются");
            }
            window.onOnboardingPermUpdatedV165(which, true);
            return;
        }
        if (which === "storage" && typeof br.requestStoragePermission === "function") {
            br.requestStoragePermission();
        } else if (which === "notif" && typeof br.requestNotificationPermission === "function") {
            br.requestNotificationPermission();
        } else if (which === "overlay" && typeof br.requestOverlayPermission === "function") {
            br.requestOverlayPermission();
        }
    };

    window.onToggleOnboardingHideHelpV165 = function(chk, ev) {
        try { navigator.vibrate(20); } catch (e) {}
        const hide = Boolean(chk && chk.checked);
        window.appConfig = window.appConfig || {};
        window.appConfig.hideHelpBadges = hide;
        localStorage.setItem("ytm_config", JSON.stringify(window.appConfig));
        const cfgChk = document.getElementById("cfg_hideHelpV62");
        if (cfgChk) cfgChk.checked = hide;
        if (typeof window.onToggleHideHelpBadgesV62 === "function") {
            window.onToggleHideHelpBadgesV62({ checked: hide }, ev);
        } else if (typeof window.syncGuideButtonPositionV165 === "function") {
            window.syncGuideButtonPositionV165();
        }
        const statusHint = document.getElementById("onbHideHelpStatusHintV165");
        if (statusHint) {
            statusHint.innerHTML = hide
                ? "🙈 Активно: все значки <b>❓</b> скрыты, а единственная кнопка полного справочника перенесена в <b>самый конец настроек</b>."
                : "📖 Не активно: значки подсказок <b>❓</b> включены, а кнопка полного справочника стоит <b>в самом начале настроек</b>.";
            statusHint.style.color = hide ? "#e3b341" : "#3fb950";
        }
    };

    window.finishOnboardingV165 = function() {
        try { navigator.vibrate(35); } catch (e) {}
        localStorage.setItem("jenny_onboarding_done_v165", "1");
        if (typeof window.syncGuideButtonPositionV165 === "function") {
            window.syncGuideButtonPositionV165();
        }
        const modal = document.getElementById("jennyOnboardingModalV165");
        if (modal) {
            modal.style.opacity = "0";
            setTimeout(() => { modal.style.display = "none"; }, 180);
        }
        if (typeof window.fetchData === "function") {
            window.fetchData();
        }
        if (typeof window.syncDiscoveredVideosIntoPlaylistV134 === "function") {
            window.syncDiscoveredVideosIntoPlaylistV134(true);
        }
    };

    window.ensureOnboardingModalV165 = function() {
        let m = document.getElementById("jennyOnboardingModalV165");
        if (m) return m;

        m = document.createElement("div");
        m.id = "jennyOnboardingModalV165";
        m.style.cssText = [
            "display:none",
            "position:fixed",
            "inset:0",
            "z-index:1000040",
            "background:radial-gradient(circle at 50% 0%, #131c2e 0%, #070a10 70%)",
            "color:#e6edf3",
            "flex-direction:column",
            "justify-content:space-between",
            "padding:14px",
            "box-sizing:border-box",
            "overflow:hidden",
            "transition:opacity 0.18s ease"
        ].join(";");

        m.innerHTML = `
            <div style="max-width:500px;width:100%;margin:0 auto;display:flex;flex-direction:column;height:100%;gap:10px;">
                <!-- Шапка в стиле главного окна -->
                <div style="background:#11161f;border:1px solid #30363d;border-radius:14px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 6px 20px rgba(0,0,0,0.65);flex-shrink:0;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#7341be,#1f6feb);border:1px solid #58a6ff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(88,166,255,0.35);">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>
                        </div>
                        <div>
                            <div style="font-family:monospace;font-weight:900;font-size:14px;letter-spacing:1.5px;background:linear-gradient(90deg,#3fb950,#58a6ff,#d2a8ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">JENNY PLAYER STUDIO</div>
                            <div id="onbStepSubtitleV165" style="font-size:11px;color:#8b949e;">Человеческая настройка перед стартом</div>
                        </div>
                    </div>
                    <div id="onbStepPillsV165" style="display:flex;gap:5px;align-items:center;"></div>
                </div>

                <!-- Контент текущей страницы -->
                <div id="onbPageBodyV165" style="flex:1;background:#0d1117;border:1px solid #30363d;border-radius:14px;padding:14px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;box-shadow:inset 0 0 24px rgba(0,0,0,0.6);"></div>

                <!-- Нижняя панель навигации Назад / Далее / Начать -->
                <div id="onbFooterBarV165" style="background:#11161f;border:1px solid #30363d;border-radius:14px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0;box-shadow:0 -4px 18px rgba(0,0,0,0.6);"></div>
            </div>
        `;
        document.body.appendChild(m);
        return m;
    };

    window.renderOnboardingPageV165 = function(pageIdx) {
        const p = Math.max(0, Math.min(3, Number(pageIdx) || 0));
        window._onbStateV165.page = p;
        window.checkPermStatusV165();
        const st = window._onbStateV165;

        const pillsEl = document.getElementById("onbStepPillsV165");
        const subEl = document.getElementById("onbStepSubtitleV165");
        const bodyEl = document.getElementById("onbPageBodyV165");
        const footEl = document.getElementById("onbFooterBarV165");
        if (!bodyEl || !footEl) return;

        const stepColors = ["#58a6ff", "#3fb950", "#d2a8ff", "#e3b341"];
        if (pillsEl) {
            pillsEl.innerHTML = [0, 1, 2, 3].map(i => {
                const active = (i === p);
                const c = stepColors[i];
                return `<button type="button" onclick="window.renderOnboardingPageV165(${i})" style="width:${active ? '28px' : '22px'};height:22px;border-radius:11px;border:1px solid ${active ? c : '#30363d'};background:${active ? c : '#161b22'};color:${active ? '#05070a' : '#8b949e'};font-size:11px;font-weight:900;padding:0;cursor:pointer;transition:all 0.15s ease;">${i + 1}</button>`;
            }).join("");
        }

        const subtitles = [
            "Шаг 1 из 4 • Доступ к медиафайлам",
            "Шаг 2 из 4 • Фоновый звук и пульт в шторке",
            "Шаг 3 из 4 • Видео поверх других окон",
            "Шаг 4 из 4 • Главные фишки, жесты и справка"
        ];
        if (subEl) subEl.textContent = subtitles[p];

        if (p === 0) {
            const ok = st.storageOk;
            bodyEl.innerHTML = `
                <div style="background:linear-gradient(135deg,rgba(88,166,255,0.14),rgba(31,111,235,0.04));border:1px solid rgba(88,166,255,0.45);border-radius:12px;padding:14px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
                        <span style="font-size:16px;font-weight:900;color:#58a6ff;">📁 1. Доступ к твоим файлам</span>
                        <span style="font-size:11.5px;font-weight:800;padding:4px 10px;border-radius:20px;border:1px solid ${ok ? '#3fb950' : '#e3b341'};background:${ok ? 'rgba(63,185,80,0.16)' : 'rgba(227,179,65,0.14)'};color:${ok ? '#3fb950' : '#e3b341'};">
                            ${ok ? '✅ Уже выдано' : '⏳ Нужен 1 клик'}
                        </span>
                    </div>
                    <div style="font-size:13px;line-height:1.5;color:#c9d1d9;">
                        Давай сразу по-человечески: <b>JennyPlayer</b> — это локальная аудио/видео студия без облаков, рекламы и слежки. Мы не собираем аналитику и не лезем в твои личные переписки или фотки.
                    </div>
                </div>

                <div style="background:#161b22;border:1px solid #30363d;border-left:3px solid #58a6ff;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:12.8px;line-height:1.45;color:#e6edf3;">
                    <div style="font-weight:800;color:#79c0ff;font-size:13px;">Зачем плееру это разрешение на самом деле:</div>
                    <div>🎵 <b>Прямое чтение в 32-bit Float RAM:</b> чтобы мгновенно читать твои треки и клипы (<b>MP3, FLAC, WAV, OPUS, M4A, MP4, MKV, .xFLAC</b>) из папок телефона без урезания качества.</div>
                    <div>🧲 <b>Сохранение закачек и экспорта:</b> чтобы складывать скачанные через встроенный P2P-торрент, SoundCloud и OST треки, а также твои рендеры с впечённым мастерингом (кнопка 💾) прямо в папку <code>/Music</code> или <code>/Download</code>.</div>
                    <div>⚡ <b>Авто-возврат:</b> нажми кнопку ниже, включи тумблер — и окно настроек <b>само закроется</b>, вернув тебя прямо сюда!</div>
                </div>

                <div style="margin-top:auto;padding-top:6px;">
                    <button type="button" onclick="window.triggerOnboardingPermActionV165('storage')" style="width:100%;padding:13px 16px;border-radius:11px;border:1px solid ${ok ? '#3fb950' : '#58a6ff'};background:${ok ? 'rgba(63,185,80,0.18)' : 'linear-gradient(135deg,#1f6feb,#1158c7)'};color:${ok ? '#3fb950' : '#ffffff'};font-size:14px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 16px rgba(31,111,235,0.35);">
                        ${ok ? '✅ Доступ к файлам активен (проверить ещё раз)' : '🔓 Открыть и включить доступ к файлам'}
                    </button>
                </div>
            `;
        } else if (p === 1) {
            const ok = st.notifOk;
            bodyEl.innerHTML = `
                <div style="background:linear-gradient(135deg,rgba(63,185,80,0.14),rgba(35,134,54,0.04));border:1px solid rgba(63,185,80,0.45);border-radius:12px;padding:14px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
                        <span style="font-size:16px;font-weight:900;color:#3fb950;">🔔 2. Уведомления (Без спама!)</span>
                        <span style="font-size:11.5px;font-weight:800;padding:4px 10px;border-radius:20px;border:1px solid ${ok ? '#3fb950' : '#e3b341'};background:${ok ? 'rgba(63,185,80,0.16)' : 'rgba(227,179,65,0.14)'};color:${ok ? '#3fb950' : '#e3b341'};">
                            ${ok ? '✅ Уже выдано' : '⏳ Нужен 1 клик'}
                        </span>
                    </div>
                    <div style="font-size:13px;line-height:1.5;color:#c9d1d9;">
                        Сразу успокоим: в <b>JennyPlayer</b> физически нет пуш-рассылок, новостей или дурацких напоминаний. Мы никогда не потревожим тебя звуком уведомления.
                    </div>
                </div>

                <div style="background:#161b22;border:1px solid #30363d;border-left:3px solid #3fb950;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:12.8px;line-height:1.45;color:#e6edf3;">
                    <div style="font-weight:800;color:#56d364;font-size:13px;">Зачем тогда Android просит это разрешение:</div>
                    <div>🎛️ <b>Медиа-пульт на заблокированном экране:</b> в современных Android карточка плеера в шторке (с кнопками <b>⏮ ⏯ ⏭</b>, перемоткой и обложкой) технически считается «уведомлением».</div>
                    <div>🛡️ <b>Защита от убийства звука в фоне:</b> пока висит мини-пульт в шторке, система знает, что ты слушаешь музыку или качаешь торрент, и не вырубает 32-bit DSP-движок, когда ты гасишь экран и кладёшь телефон в карман.</div>
                    <div>🎧 <b>Кнопки наушников и автомагнитолы:</b> привязка системной сессии к гарнитуре работает именно через этот сервис.</div>
                </div>

                <div style="margin-top:auto;padding-top:6px;">
                    <button type="button" onclick="window.triggerOnboardingPermActionV165('notif')" style="width:100%;padding:13px 16px;border-radius:11px;border:1px solid #3fb950;background:${ok ? 'rgba(63,185,80,0.18)' : 'linear-gradient(135deg,#238636,#2ea043)'};color:${ok ? '#3fb950' : '#ffffff'};font-size:14px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 16px rgba(46,160,67,0.35);">
                        ${ok ? '✅ Фоновый пульт и уведомления активны' : '🔔 Разрешить медиа-пульт и работу в фоне'}
                    </button>
                </div>
            `;
        } else if (p === 2) {
            const ok = st.overlayOk;
            bodyEl.innerHTML = `
                <div style="background:linear-gradient(135deg,rgba(210,168,255,0.15),rgba(115,65,190,0.05));border:1px solid rgba(163,113,247,0.5);border-radius:12px;padding:14px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
                        <span style="font-size:16px;font-weight:900;color:#d2a8ff;">🪟 3. Поверх других приложений</span>
                        <span style="font-size:11.5px;font-weight:800;padding:4px 10px;border-radius:20px;border:1px solid ${ok ? '#3fb950' : '#e3b341'};background:${ok ? 'rgba(63,185,80,0.16)' : 'rgba(227,179,65,0.14)'};color:${ok ? '#3fb950' : '#e3b341'};">
                            ${ok ? '✅ Уже выдано' : '⏳ Нужен 1 клик'}
                        </span>
                    </div>
                    <div style="font-size:13px;line-height:1.5;color:#c9d1d9;">
                        Фирменная гордость <b>JennyPlayer</b> — плавающее видео-окно (Дека Б), которое продолжает играть со всем студийным звуком, когда ты сворачиваешь плеер и сидишь в мессенджере или браузере.
                    </div>
                </div>

                <div style="background:#161b22;border:1px solid #30363d;border-left:3px solid #a371f7;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:12.8px;line-height:1.45;color:#e6edf3;">
                    <div style="font-weight:800;color:#d2a8ff;font-size:13px;">Как это работает без лишней головной боли:</div>
                    <div>🤏 <b>Свободный зум и таскание:</b> в плавающем режиме окно двигается одним пальцем, а двумя пальцами (щипком) плавно меняет размер от крошечной марки до огромного экрана!</div>
                    <div>🎯 <b>Прямой вход мимо списка из 200 приложений:</b> мы сделали прямой вызов скрытого системного окна — кнопка ниже откроет <b>сразу персональный тумблер JennyPlayer</b>.</div>
                    <div>⚡ <b>Включил — и сразу дома:</b> как только переведёшь ползунок вправо, радар сам закроет системные настройки и мгновенно вернёт тебя обратно на эту страницу!</div>
                </div>

                <div style="margin-top:auto;padding-top:6px;">
                    <button type="button" onclick="window.triggerOnboardingPermActionV165('overlay')" style="width:100%;padding:13px 16px;border-radius:11px;border:1px solid ${ok ? '#3fb950' : '#a371f7'};background:${ok ? 'rgba(63,185,80,0.18)' : 'linear-gradient(135deg,#7341be,#8957e5)'};color:${ok ? '#3fb950' : '#ffffff'};font-size:14px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 16px rgba(137,87,229,0.4);">
                        ${ok ? '✅ Плавающее окно поверх приложений активно' : '🪟 Открыть одиночный тумблер «Поверх окон»'}
                    </button>
                </div>
            `;
        } else {
            const hideHelp = Boolean(window.appConfig && window.appConfig.hideHelpBadges);
            bodyEl.innerHTML = `
                <div style="background:linear-gradient(135deg,rgba(227,179,65,0.15),rgba(88,166,255,0.08));border:1px solid rgba(227,179,65,0.5);border-radius:12px;padding:11px 13px;">
                    <div style="font-size:15px;font-weight:900;color:#e3b341;margin-bottom:4px;">🎛️ 4. Карта главного окна: тапы, свайпы и зажатия</div>
                    <div style="font-size:12px;color:#c9d1d9;line-height:1.4;">Все секретные зоны главного экрана, чтобы управлять скоростью, реверсом и звуком в одно касание:</div>
                </div>

                <!-- Интерактивная схема зон главного окна -->
                <div style="display:flex;flex-direction:column;gap:8px;font-size:12px;line-height:1.4;">
                    <div style="background:#161b22;border:1px solid #30363d;border-left:3px solid #3fb950;border-radius:9px;padding:9px 11px;">
                        <div style="color:#3fb950;font-weight:900;margin-bottom:3px;">🟢 ВЕРХНЯЯ ПАНЕЛЬ И ЛЕНТЫ ПЛЕЙЛИСТОВ</div>
                        <div>• <b>🎮 OST / 📻 Радио / ☁️ SoundCloud / 🧲 P2P Торрент:</b> поиск и прямой стрим в 32-bit тракт без ожидания полной загрузки.</div>
                        <div>• <b>📊 Центр закачек:</b> контроль P2P-раздач + кнопки <b>«📥 Добавить ориг»</b> и <b>«💿 Добавить WAV»</b> для мгновенного сравнения в плеере.</div>
                        <div>• <b>Зажатие ленты вкладок (180 мс):</b> зажми любую вкладку (<i>Все, Избранное, Артисты, Альбомы</i>) — откроется полное окно со списком и сортировкой!</div>
                    </div>

                    <div style="background:#161b22;border:1px solid #30363d;border-left:3px solid #58a6ff;border-radius:9px;padding:9px 11px;">
                        <div style="color:#58a6ff;font-weight:900;margin-bottom:3px;">🔵 КАРТОЧКА ТРЕКА И ДВЕ ДЕКИ (АУДИО / ВИДЕО)</div>
                        <div>• <b>Кнопка [ℹ️] на треке:</b> открывает <i>Core Media Inspector</i> — честный FFT-срез частоты (кГц), битрейт, пики dB и кодек.</div>
                        <div>• <b>Кнопка [💾] на треке:</b> офлайн-рендер трека со всеми твоими настройками баса, скорости или упаковка в психоакустический <b>.xFLAC</b>.</div>
                    </div>

                    <div style="background:#161b22;border:1px solid #30363d;border-left:3px solid #e3b341;border-radius:9px;padding:9px 11px;">
                        <div style="color:#e3b341;font-weight:900;margin-bottom:3px;">🟡 ПЕРЕМОТКА, ДУГА СКОРОСТЕЙ, РЕВЕРС И ЗАЖАТИЯ</div>
                        <div>• <b>Зажатие края полосы перемотки + свайп вниз:</b> выбрасывает <b>радиальную дугу скоростей (Touch Arc)</b> для плавного разгона или замедления одним большим пальцем!</div>
                        <div>• <b>Тап по левому / правому таймеру времени (0:00 / 3:45):</b> левый таймер мгновенно разворачивает трек задом наперёд (<b>Реверс ⏪ REV</b>), правый — возвращает вперёд (<b>⏩ FWD</b>) без пауз!</div>
                        <div>• <b>Долгое зажатие кнопки Play/Pause [⏯]:</b> авто-прыжок списка прямо к играющему сейчас треку.</div>
                        <div>• <b>Кнопки над пультом:</b> <b>📊 Спектр</b> (живой FFT + осциллограф), <b>🄠 Эквалайзер</b> (5 полос), <b>🔊/🔥 Громкость</b> (преамп до 300%).</div>
                    </div>
                </div>

                <!-- Блок детальной справки с буквальной формулировкой по просьбе Дмитрия -->
                <div style="background:linear-gradient(135deg,#1a132b,#121722);border:1px solid #7341be;border-radius:10px;padding:11px 12px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:12.5px;color:#e6edf3;line-height:1.45;">
                        💡 Хочешь залезть под капот каждого фильтра, лимитера, кроссовера и фазового фокуса? Открой нашу <b>детальную справку, где каждая хуйня расписана и разжевана</b> простым языком:
                    </div>
                    <button type="button" onclick="if(window.showFullHelpGuide) window.showFullHelpGuide(event)" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid #a371f7;background:#1f1633;color:#d2a8ff;font-weight:900;font-size:12.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 0 12px rgba(163,113,247,0.28);">
                        📖 Прочесть детальную справку (где каждая хуйня расписана и разжевана)
                    </button>
                </div>

                <!-- Синхронизированная галочка скрытия всех справочных материалов -->
                <div style="background:#161b22;border:1px solid #30363d;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;">
                    <label style="display:flex;align-items:center;gap:9px;font-size:13px;font-weight:800;color:#e6edf3;cursor:pointer;user-select:none;">
                        <input type="checkbox" id="onb_hideHelpChkV165" ${hideHelp ? 'checked' : ''} onchange="window.onToggleOnboardingHideHelpV165(this, event)" style="width:18px;height:18px;accent-color:#7341be;cursor:pointer;flex-shrink:0;">
                        <span>🙈 Скрыть все справочные материалы</span>
                    </label>
                    <div id="onbHideHelpStatusHintV165" style="font-size:11.5px;line-height:1.35;color:${hideHelp ? '#e3b341' : '#3fb950'};padding-left:27px;">
                        ${hideHelp
                            ? '🙈 Активно: все значки <b>❓</b> скрыты, а единственная кнопка полного справочника перенесена в <b>самый конец настроек</b>.'
                            : '📖 Не активно: значки подсказок <b>❓</b> включены, а кнопка полного справочника стоит <b>в самом начале настроек</b>.'}
                    </div>
                </div>
            `;
        }

        // Рендерим кнопки Назад / Далее / Начать
        if (p < 3) {
            footEl.innerHTML = `
                <button type="button" onclick="window.renderOnboardingPageV165(${p - 1})" ${p === 0 ? 'disabled' : ''} style="flex:1;padding:11px 14px;border-radius:10px;border:1px solid #30363d;background:#161b22;color:${p === 0 ? '#484f58' : '#c9d1d9'};font-size:13px;font-weight:800;cursor:${p === 0 ? 'default' : 'pointer'};opacity:${p === 0 ? '0.5' : '1'};">
                    ⬅ Назад
                </button>
                <div style="font-size:11.5px;font-weight:800;color:#8b949e;padding:0 6px;">${p + 1} / 4</div>
                <button type="button" onclick="window.renderOnboardingPageV165(${p + 1})" style="flex:1.3;padding:11px 14px;border-radius:10px;border:1px solid #58a6ff;background:linear-gradient(135deg,#1f6feb,#388bfd);color:#ffffff;font-size:13.5px;font-weight:900;cursor:pointer;box-shadow:0 3px 12px rgba(56,139,253,0.35);">
                    Далее ➔
                </button>
            `;
        } else {
            footEl.innerHTML = `
                <button type="button" onclick="window.renderOnboardingPageV165(2)" style="flex:1;padding:11px 14px;border-radius:10px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;font-size:13px;font-weight:800;cursor:pointer;">
                    ⬅ Назад
                </button>
                <button type="button" onclick="window.finishOnboardingV165()" style="flex:1.8;padding:12px 16px;border-radius:10px;border:1px solid #3fb950;background:linear-gradient(135deg,#238636,#2ea043);color:#ffffff;font-size:14.5px;font-weight:900;cursor:pointer;box-shadow:0 4px 16px rgba(46,160,67,0.45);letter-spacing:0.4px;">
                    🚀 Начать
                </button>
            `;
        }
    };

    window.openOnboardingGuideV165 = function(startPage, ev) {
        if (ev) { ev.stopPropagation(); ev.preventDefault(); }
        const m = window.ensureOnboardingModalV165();
        m.style.display = "flex";
        m.style.opacity = "1";
        window.renderOnboardingPageV165(startPage || 0);
    };

    // Также синхронизируем позицию кнопки справочника при каждом открытии модального окна настроек
    const origToggleModalV165 = window.toggleModal;
    if (typeof origToggleModalV165 === "function" && !window._toggleModalOnbHookV165) {
        window._toggleModalOnbHookV165 = true;
        window.toggleModal = function(id) {
            const res = origToggleModalV165.apply(this, arguments);
            if (id === "settingsModal" && typeof window.syncGuideButtonPositionV165 === "function") {
                setTimeout(() => window.syncGuideButtonPositionV165(), 30);
            }
            return res;
        };
    }

    // Автозапуск стартового гида при первом входе (или если ещё не нажимали «Начать»)
    setTimeout(() => {
        if (typeof window.syncGuideButtonPositionV165 === "function") {
            window.syncGuideButtonPositionV165();
        }
        const done = localStorage.getItem("jenny_onboarding_done_v165") === "1";
        if (!done) {
            window.openOnboardingGuideV165(0);
        }
    }, 450);
})();

/* [split] V215: кусок исходного IIFE (ui_v71.js, строки 18904–19635) → ui_settings.js */
;(function() {
    if (window._jennyV215Installed__settings) return;
    window._jennyV215Installed__settings = true;
    window._jennyV215Installed = true;

    window.promptAddFormatSlotV215 = function(whichDeck, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var isVid = (whichDeck === 'video');
        var boxId = 'jennyInlineAddFormatBox_' + whichDeck;
        var exBox = document.getElementById(boxId);
        if (exBox) { exBox.remove(); return; }

        var gridEl = document.getElementById(isVid ? 'formatSlotsGridVideoV215' : 'formatSlotsGrid');
        if (!gridEl || !gridEl.parentElement) return;

        var box = document.createElement('div');
        box.id = boxId;
        box.style.cssText = 'display:flex;align-items:center;gap:6px;margin:8px 0;padding:8px;background:#090d14;border:1.5px solid #3fb950;border-radius:10px;';
        box.innerHTML =
            '<input type="text" id="' + boxId + '_inp" placeholder="' + (isVid ? '.mkv, .avi, .ts...' : '.wv, .ape, .alac...') + '" style="flex:1;background:#161b22;border:1px solid #30363d;color:#fff;padding:6px 10px;border-radius:7px;font-size:12px;outline:none;text-align:left !important;">' +
            '<button type="button" id="' + boxId + '_ok" style="padding:6px 12px;border-radius:7px;background:#238636;border:1px solid #3fb950;color:#fff;font-size:11.5px;font-weight:bold;">✅ ОК</button>' +
            '<button type="button" onclick="this.parentElement.remove()" style="padding:6px 9px;border-radius:7px;background:#21262d;border:1px solid #30363d;color:#8b949e;font-size:11.5px;">✖</button>';
        gridEl.parentElement.insertBefore(box, gridEl);

        var inp = document.getElementById(boxId + '_inp');
        var okBtn = document.getElementById(boxId + '_ok');
        if (inp) setTimeout(function() { inp.focus(); }, 40);

        var submit = async function() {
            var val = (inp ? inp.value : '').trim().toLowerCase();
            if (!val) return;
            if (!val.startsWith('.')) val = '.' + val;
            var slotsObj = window.ensureDualDeckFormatSlotsV150();
            var targetList = isVid ? slotsObj.videoSlots : slotsObj.audioSlots;
            var found = targetList.find(function(s) { return String(s.ext || '').toLowerCase() === val; });
            if (found) found.en = true;
            else targetList.push({ en: true, ext: val });
            if (isVid && window.KNOWN_VIDEO_EXT_SET_V150) window.KNOWN_VIDEO_EXT_SET_V150.add(val);
            box.remove();
            window.syncFormatSlotsUI();
            await window.saveDualDeckFormatSlotsV215(whichDeck, true);
            if (typeof window.showToast === 'function') {
                window.showToast('✅ Добавлен формат ' + val + ' в ' + (isVid ? 'Деку Б (Видео)' : 'Деку А (Аудио)'));
            }
        };
        if (okBtn) okBtn.onclick = submit;
        if (inp) inp.onkeydown = function(e) { if (e.key === 'Enter') submit(); };
    };

    window.syncFormatSlotsUI = function() {
        var slotsObj = window.ensureDualDeckFormatSlotsV150();
        var audioSlots = slotsObj.audioSlots || [];
        var videoSlots = slotsObj.videoSlots || [];
        var d = window._jennyDualDeckV211 || { deckA: true, deckB: false, uiFocus: 'music' };

        var showAudio = true;
        var showVideo = true;

        var secAud = document.getElementById('customFormatsSection');
        if (!secAud) return;

        // 1. Рендерим блок Деки А (Аудио)
        secAud.style.display = showAudio ? 'block' : 'none';
        secAud.style.borderLeftColor = '#58a6ff';
        var sumAud = secAud.querySelector('summary');
        if (sumAud) {
            var spAud = sumAud.querySelector('span:not(.jenny-help-badge)');
            if (spAud) spAud.innerText = '🎵 Форматы аудиофайлов (Дека А)';
        }
        var addBtnAud = secAud.querySelector('button[onclick*="addNewFormatSlot"]');
        if (addBtnAud) addBtnAud.setAttribute('onclick', "window.promptAddFormatSlotV215('audio', event)");
        var rstBtnAud = secAud.querySelector('button[onclick*="resetFormatSlots"]');
        if (rstBtnAud) rstBtnAud.setAttribute('onclick', "window.resetDeckFormatSlotsV215('audio', event)");

        var gridAud = document.getElementById('formatSlotsGrid');
        if (gridAud) {
            gridAud.innerHTML = audioSlots.map(function(s, idx) {
                var i = idx + 1;
                var extVal = String(s.ext || '').trim().toLowerCase();
                if (extVal && !extVal.startsWith('.')) extVal = '.' + extVal;
                var clr = (extVal === '.xflac') ? '#3fb950' : '#58a6ff';
                return '<div style="display:flex;align-items:center;justify-content:space-between;background:#0d1117;padding:4px 8px;border-radius:4px;border:1px solid ' + (s.en ? '#30363d' : '#1c2128') + ';">' +
                    '<input type="checkbox" id="cfg_fmt_aud_' + i + '_en" ' + (s.en ? 'checked' : '') + ' onchange="window.saveDualDeckFormatSlotsV215(\'audio\', true)">' +
                    '<input type="text" id="cfg_fmt_aud_' + i + '_val" value="' + extVal + '" oninput="window.saveDualDeckFormatSlotsV215(\'audio\', false)" onchange="window.saveDualDeckFormatSlotsV215(\'audio\', true)" style="width:65px;font-size:12px;font-weight:bold;padding:2px;text-align:center;background:transparent;color:' + clr + ';opacity:' + (s.en ? '1' : '0.4') + ';border:none;outline:none;font-family:monospace;">' +
                '</div>';
            }).join('');
        }

        // 2. Создаём/обновляем отдельный блок Деки Б (Видео) прямо под блоком Деки А,
        //    чтобы при включённой Деке Б (или обеих деках сразу!) форматы видео ВСЕГДА были на виду!
        var secVid = document.getElementById('customVideoFormatsSectionV215');
        if (!secVid) {
            secVid = document.createElement('details');
            secVid.id = 'customVideoFormatsSectionV215';
            secVid.open = true;
            secVid.style.cssText = secAud.style.cssText;
            secVid.className = secAud.className;
            secVid.style.borderLeft = '3px solid #ff7b72';
            secVid.innerHTML =
                '<summary style="cursor:pointer;font-weight:bold;color:#ff7b72;display:flex;align-items:center;justify-content:space-between;padding:4px 0;">' +
                    '<span>🎬 Форматы видеофайлов (Дека Б)</span>' +
                '</summary>' +
                '<div style="margin-top:8px;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:6px;">' +
                        '<span style="font-size:11px;color:#8b949e;">Активные расширения видео в папке:</span>' +
                        '<div style="display:flex;gap:6px;">' +
                            '<button type="button" onclick="window.promptAddFormatSlotV215(\'video\', event)" style="padding:4px 8px;font-size:11px;background:rgba(46,160,67,0.2);color:#3fb950;border:1px solid #3fb950;border-radius:6px;font-weight:bold;">➕ Формат</button>' +
                            '<button type="button" onclick="window.resetDeckFormatSlotsV215(\'video\', event)" style="padding:4px 8px;font-size:11px;background:#21262d;color:#e3b341;border:1px solid #30363d;border-radius:6px;">🔄 Сброс</button>' +
                        '</div>' +
                    '</div>' +
                    '<div id="formatSlotsGridVideoV215" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;"></div>' +
                '</div>';
            secAud.insertAdjacentElement('afterend', secVid);
        }

        secVid.style.display = showVideo ? 'block' : 'none';
        var gridVid = document.getElementById('formatSlotsGridVideoV215');
        if (gridVid) {
            gridVid.innerHTML = videoSlots.map(function(s, idx) {
                var i = idx + 1;
                var extVal = String(s.ext || '').trim().toLowerCase();
                if (extVal && !extVal.startsWith('.')) extVal = '.' + extVal;
                return '<div style="display:flex;align-items:center;justify-content:space-between;background:#0d1117;padding:4px 8px;border-radius:4px;border:1px solid ' + (s.en ? '#30363d' : '#1c2128') + ';">' +
                    '<input type="checkbox" id="cfg_fmt_vid_' + i + '_en" ' + (s.en ? 'checked' : '') + ' onchange="window.saveDualDeckFormatSlotsV215(\'video\', true)">' +
                    '<input type="text" id="cfg_fmt_vid_' + i + '_val" value="' + extVal + '" oninput="window.saveDualDeckFormatSlotsV215(\'video\', false)" onchange="window.saveDualDeckFormatSlotsV215(\'video\', true)" style="width:65px;font-size:12px;font-weight:bold;padding:2px;text-align:center;background:transparent;color:#ff7b72;opacity:' + (s.en ? '1' : '0.4') + ';border:none;outline:none;font-family:monospace;">' +
                '</div>';
            }).join('');
        }
    };

    var origRenderOnbV165 = window.renderOnboardingPageV165;
    if (typeof origRenderOnbV165 === 'function' && !origRenderOnbV165._v215Wrapped) {
        window.renderOnboardingPageV165 = function(pageIdx) {
            var res = origRenderOnbV165.apply(this, arguments);
            var p = Math.max(0, Math.min(3, Number(pageIdx) || 0));
            if (p === 1) {
                var bodyEl = document.getElementById('onbPageBodyV165');
                if (bodyEl && !document.getElementById('onbBgUnrestrictedBtnV214')) {
                    var okBg = Boolean(window._bgUnrestrictedGrantedV212);
                    var wrap = document.createElement('div');
                    wrap.style.cssText = 'padding-top:4px;';
                    wrap.innerHTML =
                        '<button type="button" id="onbBgUnrestrictedBtnV214" onclick="window.requestBackgroundUnrestrictedV212(event)" style="width:100%;padding:12px 14px;border-radius:11px;border:1px solid ' + (okBg ? '#3fb950' : '#58a6ff') + ';background:' + (okBg ? 'rgba(63,185,80,0.16)' : 'rgba(88,166,255,0.16)') + ';color:' + (okBg ? '#3fb950' : '#58a6ff') + ';font-size:13px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">' +
                            (okBg ? '🛡️ Фон 24/7 без ограничений батареи: АКТИВЕН' : '🛡️ Разрешить работу в фоне 24/7 (Без сна батареи)') +
                        '</button>';
                    bodyEl.appendChild(wrap);
                }
            }
            return res;
        };
        window.renderOnboardingPageV165._v215Wrapped = true;
    }
})();

/* ================= JENNY_V216_UNIFIED_PATCH (#310): DUAL 9-BUTTON SINGLE-ROW DECK BARS, HEADER FOLDER+TORRENT, FAV AUDIO/VIDEO SUBLIST, THREAD POOL & 20s HOLD SETTINGS, INSTANT COMPRESSED START, AUTO MKV AAC & SLIDING BUFFER ================= */
/* [split] V216: кусок исходного IIFE (ui_v71.js, строки 19638–21240) → ui_settings.js */
;(function() {
    if (window._jennyV216Installed__settings) return;
    window._jennyV216Installed__settings = true;
    window._jennyV216Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    function bindCleanSingleCommitVideoSliderV216() {
        var origSeek = document.getElementById('v130SeekSlider');
        var vid = document.getElementById('jennyVideoElV130');
        if (!origSeek || !vid || origSeek._v216CleanBound) return;

        var seek = origSeek.cloneNode(true);
        seek._v216CleanBound = true;
        seek._v167Bound = true;
        seek._v212UnifiedBound = true;
        seek.max = '1000';
        seek.min = '0';
        origSeek.replaceWith(seek);

        var lastDragSec = 0;

        var ratioFromEv = function(e) {
            var cx = undefined;
            if (e && e.touches && e.touches.length > 0) cx = e.touches[0].clientX;
            else if (e && e.changedTouches && e.changedTouches.length > 0) cx = e.changedTouches[0].clientX;
            else if (e && typeof e.clientX === 'number' && e.clientX > 0) cx = e.clientX;
            var rect = seek.getBoundingClientRect();
            if (typeof cx === 'number' && rect.width > 12) {
                return Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
            }
            return Math.max(0, Math.min(1, (parseFloat(seek.value) || 0) / 1000.0));
        };

        var onMovePreview = function(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            window._v130UserDraggingSeekV212 = true;
            var dur = window.getEffectiveVideoDurationV167(vid);
            if (!isFinite(dur) || dur <= 0) return;
            var r = ratioFromEv(e);
            seek.value = String(Math.round(r * 1000));
            lastDragSec = r * dur;
            window.seekDeckBAndPlayerSyncedV212(lastDragSec, true);
            if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
        };

        var onCommit = function(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            if (!window._v130UserDraggingSeekV212 && e && e.type !== 'click') return;
            var dur = window.getEffectiveVideoDurationV167(vid);
            if (isFinite(dur) && dur > 0) {
                var r = ratioFromEv(e);
                seek.value = String(Math.round(r * 1000));
                lastDragSec = r * dur;
                window.seekDeckBAndPlayerSyncedV212(lastDragSec, false);
            }
            window._v130LastDragCommitTsV212 = performance.now();
            window._v130UserDraggingSeekV212 = false;
            if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
        };

        seek.addEventListener('touchstart', onMovePreview, { passive: true });
        seek.addEventListener('touchmove', onMovePreview, { passive: true });
        seek.addEventListener('touchend', onCommit, { passive: true });
        seek.addEventListener('touchcancel', onCommit, { passive: true });
        seek.addEventListener('mousedown', onMovePreview);
        seek.addEventListener('mousemove', function(e) { if (window._v130UserDraggingSeekV212) onMovePreview(e); });
        seek.addEventListener('mouseup', onCommit);
        seek.addEventListener('input', onMovePreview);
        seek.addEventListener('change', onCommit);
    }

    // -------------------------------------------------------------------------
    // 0. КОНФИГУРАЦИЯ ПОТОКОВ И ЗАДЕРЖКИ УДЕРЖАНИЯ (ПО УМОЛЧАНИЮ 20 СЕК)
    // -------------------------------------------------------------------------
    window.DEFAULT_THREAD_CONFIG_V216 = {
        audioRamWorkers: 2,
        videoFfmpegThreads: 3,
        torrentPrebufferPieces: 8,
        serverPoolThreads: 64,
        streamHoldDelaySec: 20
    };

    window.loadThreadConfigV216 = function() {
        var cfg = Object.assign({}, window.DEFAULT_THREAD_CONFIG_V216);
        try {
            var raw = localStorage.getItem('jenny_threads_v216');
            if (raw) {
                var parsed = JSON.parse(raw);
                Object.keys(cfg).forEach(function(k) {
                    if (parsed && parsed[k] !== undefined) {
                        var n = parseInt(parsed[k], 10);
                        if (!isNaN(n)) cfg[k] = n;
                    }
                });
            }
        } catch (e) {}
        window._jennyThreadConfigV216 = cfg;
        return cfg;
    };
    window.loadThreadConfigV216();

    window.saveThreadConfigV216 = async function(showMsg, ev) {
        var cfg = window._jennyThreadConfigV216 || window.loadThreadConfigV216();
        var mapIds = [
            ['audioRamWorkers', 'cfg_thr_audioRamWorkers_v216', 1, 8],
            ['videoFfmpegThreads', 'cfg_thr_videoFfmpegThreads_v216', 1, 8],
            ['torrentPrebufferPieces', 'cfg_thr_torrentPrebufferPieces_v216', 2, 32],
            ['serverPoolThreads', 'cfg_thr_serverPoolThreads_v216', 16, 128],
            ['streamHoldDelaySec', 'cfg_thr_streamHoldDelaySec_v216', 0, 180]
        ];
        mapIds.forEach(function(item) {
            var k = item[0], id = item[1], mn = item[2], mx = item[3];
            var el = document.getElementById(id);
            if (el) {
                var v = parseInt(el.value, 10);
                if (!isNaN(v)) cfg[k] = Math.max(mn, Math.min(mx, v));
                el.value = String(cfg[k]);
            }
        });
        try {
            localStorage.setItem('jenny_threads_v216', JSON.stringify(cfg));
        } catch (e) {}
        try {
            await fetch('/api/threads/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cfg)
            });
        } catch (e) {}
        if (showMsg && typeof window.showToast === 'function') {
            window.showToast('⚡ Настройки потоков и удержания (' + cfg.streamHoldDelaySec + ' сек) сохранены!', ev);
        }
    };

    window.resetThreadConfigV216 = async function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        window._jennyThreadConfigV216 = Object.assign({}, window.DEFAULT_THREAD_CONFIG_V216);
        try {
            localStorage.setItem('jenny_threads_v216', JSON.stringify(window._jennyThreadConfigV216));
        } catch (e) {}
        window.renderThreadsSettingsBoxV216();
        await window.saveThreadConfigV216(false, ev);
        if (typeof window.showToast === 'function') {
            window.showToast('🔄 Потоки и удержание (20 сек) сброшены по умолчанию!', ev);
        }
    };

    // Синхронизируем конфиг потоков с сервером при старте
    setTimeout(function() { window.saveThreadConfigV216(false); }, 600);

    // -------------------------------------------------------------------------
    // 1. СПРАВКА (❓) ДЛЯ БЛОКА ПОТОКОВ В ОБЩЕМ СПРАВОЧНИКЕ (getHelpDB)
    // -------------------------------------------------------------------------
    var _origGetHelpDBV216 = window.getHelpDB;
    if (typeof _origGetHelpDBV216 === 'function' && !_origGetHelpDBV216._v216Wrapped) {
        window.getHelpDB = function() {
            var db = _origGetHelpDBV216.apply(this, arguments) || {};
            var isEn = (typeof window.getLang === 'function' && window.getLang() === 'en');
            db['threads_group_v216'] = {
                title: isEn ? '⚡ Thread Pool & Stream Hold (CPU / Net)' : '⚡ Распределение потоков и приоритетов (CPU / Сеть)',
                phys: isEn
                    ? 'Splits CPU cores and local HTTP channels between Deck A audio decoding, Deck B live video remuxing, P2P torrent piece pre-fetching, and background modules.'
                    : 'Разделяет ядра процессора и локальные сетевые каналы между аудио-движком Деки А, потоковым видео-ремуксом Деки Б, предзагрузкой кусков торрента и фоновыми модулями.',
                hear: isEn
                    ? 'Prevents connection starvation when switching songs or seeking video, and keeps active streams warm during track/episode switches.'
                    : 'Исключает зависания при переключении треков и перемотке видео, а при смене файла переиспользует горячий поток без обрыва.',
                tip: isEn
                    ? 'Default values (2 / 3 / 8 pieces / 64 / 20s hold) are balanced for 8-core Android processors.'
                    : 'Значения по умолчанию (2 / 3 / 8 кусков / 64 / удержание 20 сек) оптимально сбалансированы для 8-ядерных процессоров Android.'
            };
            db['thr_audio_v216'] = {
                title: isEn ? '🎵 Stream 1 — Deck A Audio RAM Decoder' : '🎵 Поток 1 — Аудио Дека А (RAM / WAV декодер)',
                phys: isEn
                    ? 'Number of parallel background workers unpacking lossless audio into 32-bit float RAM while the fast compressed stream is playing.'
                    : 'Число параллельных фоновых потоков, которые распаковывают песню в несжатый 32-bit WAV в ОЗУ, пока первые 2–3 секунды играет быстрый сжатый поток.',
                hear: isEn
                    ? 'Track starts playing instantly (<0.3s) with "⏳ RAM (buffering PCM)...", then seamlessly switches to RAM.'
                    : 'Песня начинает играть мгновенно (за 0.2 сек) с надписью «⏳ RAM (пока играет сжатый...)», а затем бесшовно переходит на RAM.',
                tip: isEn ? 'Recommended: 2 workers.' : 'Рекомендуется: 2 потока (не забивает канал браузера и быстро собирает RAM).'
            };
            db['thr_video_v216'] = {
                title: isEn ? '🎬 Stream 2 — Deck B Video & Audio Remux (FFmpeg)' : '🎬 Поток 2 — Видео Дека Б (FFmpeg Ремукс и звук)',
                phys: isEn
                    ? 'Number of CPU threads allocated to real-time MKV/AVI stream remuxing and AC3/EAC3 -> AAC audio decoding.'
                    : 'Количество потоков процессора, выделенных под живую потоковую сборку видео (.mkv / .avi) и декодирование звуковых дорожек (AC3/EAC3 ➔ AAC).',
                hear: isEn
                    ? 'Sound in .mkv plays immediately from 0:00 without pressing MKV button, and seeking is crisp.'
                    : 'Звук в .mkv включается автоматически с первой секунды, а видео и перемотка идут плавно без перегрева.',
                tip: isEn ? 'Recommended: 3–4 threads.' : 'Рекомендуется: 3–4 потока.'
            };
            db['thr_torrent_v216'] = {
                title: isEn ? '🧲 Stream 3 — P2P Pre-Buffer Lookahead (Pieces)' : '🧲 Поток 3 — Торрент P2P и буфер предзагрузки (куски)',
                phys: isEn
                    ? 'How many sequential pieces ahead of the current playback cursor are boosted in LIFO order so the current piece is always #1.'
                    : 'Сколько кусков вперёд от текущей секунды видео принудительно запрашиваются у пиров с наивысшим приоритетом (в скользящем окне по ходу просмотра).',
                hear: isEn
                    ? 'Eliminates periodic pauses every 10–15 seconds while watching a torrent stream.'
                    : 'Убирает замирания и догрузку каждые 10–15 секунд при просмотре сериала/фильма напрямую из торрента.',
                tip: isEn ? 'Recommended: 8–12 pieces (~16–36 MB ahead).' : 'Рекомендуется: 8–12 кусков (запас ~16–36 МБ вперёд по потоку).'
            };
            db['thr_server_v216'] = {
                title: isEn ? '🌐 Stream 4 — Server Pool & Background Modules' : '🌐 Поток 4 — Пул сервера и фоновые модули',
                phys: isEn
                    ? 'Total HTTP worker threads in local Waitress server handling torrent search, Radio, SoundCloud, Game OST, and media streaming.'
                    : 'Общее число серверных потоков локального движка для одновременной работы поиска торрентов, Радио, SoundCloud, Game OST и обеих дек.',
                hear: isEn
                    ? 'Torrent search and background downloads never block music or video playback.'
                    : 'Поиск раздач и фоновая закачка никогда не тормозят переключение песен и видео.',
                tip: isEn ? 'Recommended: 64 threads.' : 'Рекомендуется: 64 потока.'
            };
            db['thr_hold_v216'] = {
                title: isEn ? '⏱️ Stream Hold Delay After Switch / Close (sec)' : '⏱️ Удержание потока при переключении / закрытии (сек)',
                phys: isEn
                    ? 'When switching tracks/videos, the active stream is reused immediately. When closed with ❌, it stays warm for N seconds before releasing resources to background downloads.'
                    : 'Если ты просто переключил трек или серию, поток продолжает работать на новый файл без переподключения. А если закрыл видео крестиком ❌ — ждёт указанные секунды (по умолчанию 20 сек) и затем освобождает все ресурсы под обычную скачку.',
                hear: isEn
                    ? 'Instant switching between episodes/songs without re-initializing the pipeline, and automatic cleanup 20s after closing.'
                    : 'Переключение между сериями и треками происходит мгновенно на прогретом потоке, а через 20 сек после закрытия ❌ весь канал отдаётся закачкам.',
                tip: isEn ? 'Default: 20 seconds (0 = release immediately).' : 'По умолчанию: 20 секунд (можно поставить от 0 до 180 сек).'
            };
            return db;
        };
        window.getHelpDB._v216Wrapped = true;
    }

    window.renderThreadsSettingsBoxV216 = function() {
        var sm = document.getElementById('settingsModal');
        if (!sm) return;
        var container = sm.querySelector('.container') || sm;
        var cfg = window._jennyThreadConfigV216 || window.loadThreadConfigV216();

        var box = document.getElementById('jennyThreadsSettingsBoxV216');
        if (!box) {
            box = document.createElement('details');
            box.id = 'jennyThreadsSettingsBoxV216';
            box.className = 'setting-group';
            // Свёрнут по умолчанию, как просил Дмитрий!
            box.open = false;
            box.style.borderLeft = '3px solid #39c5cf';

            var refEl = document.getElementById('customVideoFormatsSectionV215') || document.getElementById('customFormatsSection');
            if (refEl && refEl.parentElement === container) {
                refEl.insertAdjacentElement('afterend', box);
            } else {
                container.appendChild(box);
            }
        }

        var mkRow = function(label, key, minV, maxV, stepV, unitStr, helpKey, colorHex) {
            var val = cfg[key] !== undefined ? cfg[key] : window.DEFAULT_THREAD_CONFIG_V216[key];
            return '<div class="setting-row" style="border:none;padding:6px 0;display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
                '<div style="display:flex;align-items:center;flex:1;min-width:0;">' +
                    '<span style="color:' + (colorHex || '#e6edf3') + ';font-size:12.5px;font-weight:bold;line-height:1.3;">' + label + '</span>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">' +
                    '<input type="number" id="cfg_thr_' + key + '_v216" min="' + minV + '" max="' + maxV + '" step="' + stepV + '" value="' + val + '" ' +
                        'onchange="window.saveThreadConfigV216(true, event)" ' +
                        'style="width:54px;padding:4px 6px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#39c5cf;font-weight:bold;font-size:12.5px;text-align:center !important;">' +
                    '<span style="color:#8b949e;font-size:11px;min-width:24px;">' + unitStr + '</span>' +
                    '<span class="jenny-help-badge" onclick="if(window.showHelpTopic) window.showHelpTopic(\'' + helpKey + '\', event)" ' +
                        'style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;flex-shrink:0;">❓</span>' +
                '</div>' +
            '</div>';
        };

        box.innerHTML =
            '<summary style="cursor:pointer;font-weight:bold;color:#39c5cf;display:flex;align-items:center;justify-content:space-between;padding:4px 0;">' +
                '<span>⚡ Распределение потоков и приоритетов (CPU / Сеть)</span>' +
                '<span class="jenny-help-badge" onclick="if(window.showHelpTopic) window.showHelpTopic(\'threads_group_v216\', event)" ' +
                    'style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;flex-shrink:0;">❓</span>' +
            '</summary>' +
            '<div class="group-content" style="margin-top:8px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                    '<span style="font-size:11px;color:#8b949e;">Ручная настройка потоков и удержания резерва:</span>' +
                    '<button type="button" onclick="window.resetThreadConfigV216(event)" style="padding:3px 8px;font-size:11px;background:#21262d;color:#e3b341;border:1px solid #30363d;border-radius:6px;">🔄 Сброс</button>' +
                '</div>' +
                mkRow('Поток 1 — Аудио Дека А (RAM / WAV):', 'audioRamWorkers', 1, 8, 1, 'пот.', 'thr_audio_v216', '#58a6ff') +
                mkRow('Поток 2 — Видео Дека Б (FFmpeg Ремукс):', 'videoFfmpegThreads', 1, 8, 1, 'пот.', 'thr_video_v216', '#ff7b72') +
                mkRow('Поток 3 — Торрент P2P (буфер вперёд):', 'torrentPrebufferPieces', 2, 32, 1, 'куск.', 'thr_torrent_v216', '#3fb950') +
                mkRow('Поток 4 — Фоновые модули и сервер:', 'serverPoolThreads', 16, 128, 8, 'пот.', 'thr_server_v216', '#d2a8ff') +
                '<div style="border-top:1px solid #21262d;margin:6px 0;"></div>' +
                mkRow('⏱️ Задержка удержания при закрытии ❌:', 'streamHoldDelaySec', 0, 180, 5, 'сек', 'thr_hold_v216', '#e3b341') +
                '<div style="margin-top:6px;padding:7px 9px;background:#090d14;border:1px solid #21262d;border-radius:8px;font-size:11px;color:#8b949e;line-height:1.4;">' +
                    '💡 При обычном переключении трека/видео поток мгновенно переходит на следующий файл без разрыва. При закрытии крестиком <b>❌</b> поток ждёт <b>' + cfg.streamHoldDelaySec + ' сек</b> и затем освобождается под закачку.' +
                '</div>' +
            '</div>';
    };

    // -------------------------------------------------------------------------
    // 10. ОГРАНИЧЕНИЕ ФОНОВЫХ ВОРКЕРОВ РАСПАКОВКИ ВИДЕО В RAM (ПО НАСТРОЙКЕ ПОТОКА 1)
    //     И ИСКЛЮЧЕНИЕ ЗАБИВАНИЯ HTTP-ПУЛА НА .MKV / .AVI
    // -------------------------------------------------------------------------
    // В #359 фоновая сборка Буфера #3 (Видео Вперёд) и Буфера #4 (Видео Назад) в RAM работает всегда
    // через изолированный порт :8082 и семафор (2 потока FFmpeg), пока с 0 мс играет сжатый поток!

    // -------------------------------------------------------------------------
    // 11. ФИКС КНОПКИ "✅ ОК" В "+ ФОРМАТ" (СРАБАТЫВАЕТ С ПЕРВОГО КАСАНИЯ ПРИ ОТКРЫТОЙ КЛАВИАТУРЕ!)
    //     (71418.mp4, 01:56-02:09)
    // -------------------------------------------------------------------------
    window.promptAddFormatSlotV215 = function(whichDeck, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var isVid = (whichDeck === 'video');
        var boxId = 'jennyInlineAddFormatBox_' + whichDeck;
        var exBox = document.getElementById(boxId);
        if (exBox) { exBox.remove(); return; }

        var gridEl = document.getElementById(isVid ? 'formatSlotsGridVideoV215' : 'formatSlotsGrid');
        if (!gridEl || !gridEl.parentElement) return;

        var box = document.createElement('div');
        box.id = boxId;
        box.style.cssText = 'display:flex;align-items:center;gap:6px;margin:8px 0;padding:8px;background:#090d14;border:1.5px solid #3fb950;border-radius:10px;';
        box.innerHTML =
            '<input type="text" id="' + boxId + '_inp" placeholder="' + (isVid ? '.mkv, .avi, .ts...' : '.wv, .ape, .alac...') + '" style="flex:1;background:#161b22;border:1px solid #30363d;color:#fff;padding:6px 10px;border-radius:7px;font-size:12px;outline:none;text-align:left !important;">' +
            '<button type="button" id="' + boxId + '_ok" style="padding:6px 12px;border-radius:7px;background:#238636;border:1px solid #3fb950;color:#fff;font-size:11.5px;font-weight:bold;cursor:pointer;">✅ ОК</button>' +
            '<button type="button" id="' + boxId + '_cancel" style="padding:6px 9px;border-radius:7px;background:#21262d;border:1px solid #30363d;color:#8b949e;font-size:11.5px;cursor:pointer;">✖</button>';
        gridEl.parentElement.insertBefore(box, gridEl);

        var inp = document.getElementById(boxId + '_inp');
        var okBtn = document.getElementById(boxId + '_ok');
        var cancelBtn = document.getElementById(boxId + '_cancel');
        if (inp) setTimeout(function() { inp.focus(); }, 40);

        var submitted = false;
        var submit = async function(e) {
            if (e) {
                if (e.preventDefault) e.preventDefault();
                if (e.stopPropagation) e.stopPropagation();
            }
            if (submitted) return;
            var val = (inp ? inp.value : '').trim().toLowerCase();
            if (!val) return;
            submitted = true;
            if (!val.startsWith('.')) val = '.' + val;

            var cfg = window._musicConfigRefV131 || window.appConfig || {};
            var slotsObj = window.ensureDualDeckFormatSlotsV150();
            var targetList = isVid ? slotsObj.videoSlots : slotsObj.audioSlots;
            var found = targetList.find(function(s) { return String(s.ext || '').toLowerCase() === val; });
            if (found) found.en = true;
            else targetList.push({ en: true, ext: val });

            if (isVid) {
                cfg.formatSlotsVideoV150 = targetList;
                if (window.KNOWN_VIDEO_EXT_SET_V150) window.KNOWN_VIDEO_EXT_SET_V150.add(val);
            } else {
                cfg.formatSlotsAudioV150 = targetList;
            }
            cfg.formatSlots = [].concat(cfg.formatSlotsAudioV150 || [], cfg.formatSlotsVideoV150 || []);
            if (window.appConfig) {
                window.appConfig.formatSlotsAudioV150 = cfg.formatSlotsAudioV150;
                window.appConfig.formatSlotsVideoV150 = cfg.formatSlotsVideoV150;
                window.appConfig.formatSlots = cfg.formatSlots;
            }
            try { localStorage.setItem('ytm_config', JSON.stringify(cfg)); } catch (err) {}

            box.remove();
            window.syncFormatSlotsUI();
            await window.saveDualDeckFormatSlotsV215(whichDeck, true);
            if (typeof window.showToast === 'function') {
                window.showToast('✅ Добавлен формат ' + val + ' в ' + (isVid ? 'Деку Б (Видео)' : 'Деку А (Аудио)'));
            }
        };

        if (okBtn) {
            // Привязываем touchstart/mousedown, чтобы при открытой клавиатуре Android кнопка срабатывала мгновенно до смещения экрана!
            okBtn.addEventListener('touchstart', submit, { passive: false });
            okBtn.addEventListener('mousedown', submit);
            okBtn.onclick = submit;
        }
        if (cancelBtn) {
            var closeBox = function(e) {
                if (e && e.preventDefault) e.preventDefault();
                if (e && e.stopPropagation) e.stopPropagation();
                box.remove();
            };
            cancelBtn.addEventListener('touchstart', closeBox, { passive: false });
            cancelBtn.onclick = closeBox;
        }
        if (inp) {
            inp.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') submit(e);
            });
        }
    };

    // -------------------------------------------------------------------------
    // 13. ИНИЦИАЛИЗАЦИЯ И ПОДДЕРЖАНИЕ UI V216
    // -------------------------------------------------------------------------
    var _origMountStudioV216 = window.mountJennyStudioUI;
    if (typeof _origMountStudioV216 === 'function' && !_origMountStudioV216._v216Wrapped) {
        window.mountJennyStudioUI = function() {
            var r = _origMountStudioV216.apply(this, arguments);
            window.renderThreadsSettingsBoxV216();
            window.ensureDual9ButtonBarsDOMV216();
            return r;
        };
        window.mountJennyStudioUI._v216Wrapped = true;
    }

    setInterval(function() {
        window.ensureDual9ButtonBarsDOMV216();
        window.renderThreadsSettingsBoxV216();
        bindCleanSingleCommitVideoSliderV216();
    }, 600);

    setTimeout(function() {
        window.ensureDual9ButtonBarsDOMV216();
        window.renderThreadsSettingsBoxV216();
        bindCleanSingleCommitVideoSliderV216();
    }, 250);
})();

/* [split] V217: кусок исходного IIFE (ui_v71.js, строки 21243–22584) → ui_settings.js */
;(function() {
    if (window._jennyV217Installed__settings) return;
    window._jennyV217Installed__settings = true;
    window._jennyV217Installed = true;

    setInterval(function() {
        window.mountModularLabSettingsV208();
        window.syncVideoPlayerButtonsUIV217();
    }, 650);
})();

/* [split] V218: кусок исходного IIFE (ui_v71.js, строки 22588–24059) → ui_settings.js */
;(function() {
    if (window._jennyV218Installed__settings) return;
    window._jennyV218Installed__settings = true;
    window._jennyV218Installed = true;

    var _origRenderThreadsBoxV216 = window.renderThreadsSettingsBoxV216;
    window.renderThreadsSettingsBoxV216 = function(forceRebuild) {
        var box = document.getElementById('jennyThreadsSettingsBoxV216');
        // Если блок уже отрисован и не запрошен принудительный сброс — НЕ перезаписываем innerHTML в таймере!
        if (box && box._v218Rendered && !forceRebuild) {
            return;
        }
        if (window.isAnySettingsInputFocusedV218() && !forceRebuild) {
            return;
        }
        if (typeof _origRenderThreadsBoxV216 === 'function') {
            _origRenderThreadsBoxV216.apply(this, arguments);
        }
        box = document.getElementById('jennyThreadsSettingsBoxV216');
        if (box) {
            box._v218Rendered = true;
            box.querySelectorAll('input[type="number"], input[type="text"]').forEach(function(inp) {
                if (inp._v218FocusGuarded) return;
                inp._v218FocusGuarded = true;
                inp.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: true });
                inp.addEventListener('mousedown', function(e) { e.stopPropagation(); });
                inp.addEventListener('click', function(e) { e.stopPropagation(); });
            });
        }
    };

    var _origResetThreadCfgV216 = window.resetThreadConfigV216;
    if (typeof _origResetThreadCfgV216 === 'function') {
        window.resetThreadConfigV216 = async function(ev) {
            var box = document.getElementById('jennyThreadsSettingsBoxV216');
            if (box) box._v218Rendered = false;
            return _origResetThreadCfgV216.apply(this, arguments);
        };
    }

    // Защищаем все числовые и текстовые поля в #settingsModal от перехвата тача и потери фокуса
    window.guardAllSettingsInputsFocusV218 = function() {
        var sm = document.getElementById('settingsModal');
        if (!sm) return;
        sm.querySelectorAll('input[type="number"], input[type="text"]').forEach(function(inp) {
            if (inp._v218FocusGuarded) return;
            inp._v218FocusGuarded = true;
            inp.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: true });
            inp.addEventListener('mousedown', function(e) { e.stopPropagation(); });
            inp.addEventListener('click', function(e) { e.stopPropagation(); });
        });
    };

    // -------------------------------------------------------------------------
    // 9. МЕНЮ ИСТОЧНИКОВ (⊞): ЗАКРЕПЛЕНИЕ [ВКЛ] ДЛЯ ВСЕХ 5 ИСТОЧНИКОВ + "v1.1" ПОД "PLAYER" В ЛОГОТИПЕ
    // -------------------------------------------------------------------------
    window.upgradeLogoSvgWithV11UnderPlayerV218 = function() {
        var logoWrap = document.getElementById('jennyLogoWrap');
        if (!logoWrap || logoWrap._v218Upgraded) return;
        logoWrap._v218Upgraded = true;
        logoWrap.innerHTML =
            '<svg viewBox="0 0 88 38" width="84" height="34" style="overflow:visible;filter:drop-shadow(0 0 6px rgba(88,166,255,0.35));">' +
                '<defs>' +
                    '<linearGradient id="jpGradTop" x1="0%" y1="0%" x2="100%" y2="0%">' +
                        '<stop offset="0%" stop-color="#3fb950"/>' +
                        '<stop offset="100%" stop-color="#58a6ff"/>' +
                    '</linearGradient>' +
                    '<linearGradient id="jpGradBox" x1="0%" y1="0%" x2="100%" y2="100%">' +
                        '<stop offset="0%" stop-color="#7341be"/>' +
                        '<stop offset="100%" stop-color="#1f6feb"/>' +
                    '</linearGradient>' +
                '</defs>' +
                '<rect x="1" y="4" width="27" height="27" rx="7" fill="url(#jpGradBox)" stroke="#58a6ff" stroke-width="1"/>' +
                '<path d="M5.5 17.5h3l2.5-7 4 14 3.5-10 2 3h3" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
                '<text x="33" y="13" fill="url(#jpGradTop)" font-family="monospace" font-weight="900" font-size="13" letter-spacing="1.8">JENNY</text>' +
                '<line x1="33" y1="16" x2="85" y2="16" stroke="rgba(163,113,247,0.45)" stroke-width="1"/>' +
                '<text x="33" y="25.5" fill="#d2a8ff" font-family="monospace" font-weight="900" font-size="9.8" letter-spacing="2.5">PLAYER</text>' +
                '<rect x="33" y="28" width="24" height="8.5" rx="2.5" fill="#0d1117" stroke="#30363d" stroke-width="0.9"/>' +
                '<text x="45" y="34.3" fill="#8b949e" font-family="monospace" font-weight="bold" font-size="6.8" text-anchor="middle">v1.1</text>' +
            '</svg>';
    };
})();

/* [split] V219: кусок исходного IIFE (ui_v71.js, строки 24063–25074) → ui_settings.js */
;(function() {
    if (window._jennyV219Installed__settings) return;
    window._jennyV219Installed__settings = true;
    window._jennyV219Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    var VOL_SPEAKER_ON_SVG_V219  = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    var VOL_SPEAKER_MUTE_SVG_V219 = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#f87171" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';

    // Громкость Деки А (Аудио) с учётом Овердрайва Деки А (boosterEnabled + boosterPower)
    window.changeVolume = function() {
        window.ensureMuteButtonsInVolumePopupsV219();
        if (typeof window.initAudioBoost === 'function') window.initAudioBoost();
        var cfgA = window._musicConfigRefV131 || window.appConfig || {};
        var volBar = document.getElementById('volumeBar');
        var volIconTxt = document.getElementById('volIconText');
        var volTrigger = document.getElementById('volIconTrigger');
        var muteBtnA = document.getElementById('btnMutePopupDeckAV219');
        if (!volBar) return;

        var maxScale = cfgA.boosterEnabled ? (10 + (parseInt(cfgA.boosterPower, 10) || 5)) : 10;
        volBar.max = String(maxScale);

        var val = parseFloat(volBar.value);
        if (isNaN(val)) val = 10;
        if (val > maxScale) { val = maxScale; volBar.value = String(val); }

        if (val > 0) {
            window._savedPreMuteVolStepDeckAV219 = val;
            try { localStorage.setItem('jenny_premute_a_v219', String(val)); } catch (e) {}
        }

        var gainLinear = val / 10.0;
        if (window.gainNode && window.gainNode.gain) {
            window.gainNode.gain.value = gainLinear;
        }
        var aEl = document.getElementById('audioPlayer');
        if (aEl) {
            try { aEl.volume = (val <= 0) ? 0.0 : 1.0; } catch (e) {}
        }

        var pct = Math.round(gainLinear * 100);
        if (volIconTxt) {
            if (pct === 0) {
                volIconTxt.innerHTML = '🔇 0%';
                volIconTxt.style.color = '#f87171';
            } else if (val > 10) {
                volIconTxt.innerHTML = '🔥 ' + pct + '%';
                volIconTxt.style.color = '#da3633';
            } else {
                volIconTxt.innerHTML = pct + '%';
                volIconTxt.style.color = '#c084fc';
            }
        }
        if (volTrigger) {
            volTrigger.innerHTML = (pct === 0) ? VOL_SPEAKER_MUTE_SVG_V219 : VOL_SPEAKER_ON_SVG_V219;
        }
        if (muteBtnA) {
            muteBtnA.innerHTML = (pct === 0) ? VOL_SPEAKER_MUTE_SVG_V219 : VOL_SPEAKER_ON_SVG_V219;
            muteBtnA.style.background = (pct === 0) ? 'rgba(239,68,68,0.25)' : 'rgba(168,85,247,0.18)';
            muteBtnA.style.border = '1px solid ' + ((pct === 0) ? '#f87171' : 'rgba(168,85,247,0.55)');
            muteBtnA.style.color = (pct === 0) ? '#f87171' : '#c084fc';
        }

        cfgA.defaultVolume = val;
        try { localStorage.setItem('ytm_config', JSON.stringify(cfgA)); } catch (e) {}
    };

    window.applyVolumeSettings = function() {
        window.ensureMuteButtonsInVolumePopupsV219();
        var cfgA = window._musicConfigRefV131 || window.appConfig || {};
        var maxScale = cfgA.boosterEnabled ? (10 + (parseInt(cfgA.boosterPower, 10) || 5)) : 10;
        var volBar = document.getElementById('volumeBar');
        if (volBar) {
            volBar.max = String(maxScale);
            var parsedVol = (cfgA.defaultVolume !== undefined) ? parseFloat(cfgA.defaultVolume) : 10;
            if (isNaN(parsedVol)) parsedVol = 10;
            volBar.value = String(parsedVol > maxScale ? maxScale : parsedVol);
            window.changeVolume();
        }
    };

    // Гарантируем, что изменение Овердрайва (boosterEnabled / boosterPower) в #settingsModal
    // меняет шкалу громкости ТОЛЬКО той деки, чей пульт сейчас выбран (Дека А или Дека Б), без пересечений!
    var _origUpdateSettingsV219 = window.updateSettings;
    window.updateSettings = function() {
        if (typeof _origUpdateSettingsV219 === 'function') {
            _origUpdateSettingsV219.apply(this, arguments);
        }
        window.applyVolumeSettings();
    };
})();

/* [split] V235: кусок исходного IIFE (ui_v71.js, строки 29842–30652) → ui_settings.js */
;(function() {
    if (window._jennyV235Installed__settings) return;
    window._jennyV235Installed__settings = true;
    window._jennyV235Installed = true;

    // Override applyStaticDOMTranslations so it always keeps #mainLangToggleBtn in #searchRightSlotV235
    var _origApplyStaticTransV235 = window.applyStaticDOMTranslations;
    if (typeof _origApplyStaticTransV235 === 'function') {
        window.applyStaticDOMTranslations = function() {
            var r = _origApplyStaticTransV235.apply(this, arguments);
            window.ensureSearchRightSlotAndLangBtnV235();
            return r;
        };
    }

    // -------------------------------------------------------------------------
    // 4. REDESIGNED RU / EN ESCAPE TRAJECTORIES FROM SEARCH BAR SLOT UP TO ⚙️ SETTINGS
    //    + DOCKING INTO #jennyTopBarRow NEXT TO GUIDE / MANUAL
    // -------------------------------------------------------------------------
    // SCENARIO 1: Never clicked for 30s -> Stands on legs (.runaway-actor), sprints along the search bar,
    //             then leaps with a 540° somersault up into ⚙️ (#btn-settingsModal), while Refresh buttons take its place!
    window.runAwayLangBadgeToSettings = function() {
        window.ensureSearchRightSlotAndLangBtnV235();
        var btn = document.getElementById('mainLangToggleBtn');
        var gear = document.getElementById('btn-settingsModal');
        if (!btn || !gear || window._hasLangRunAway) return;

        var startRect = btn.getBoundingClientRect();
        var gearRect = gear.getBoundingClientRect();
        if (startRect.width <= 0 && startRect.height <= 0) {
            var sInp = document.getElementById('trackSearchInput');
            var sRect = sInp ? sInp.getBoundingClientRect() : { right: (window.innerWidth || 360) - 16, top: 58, width: 64, height: 34 };
            startRect = { left: Math.max(16, sRect.right - 68), top: sRect.top, width: 64, height: 34 };
        }

        window._hasLangRunAway = true;
        if (window._langBuzzInterval) {
            clearInterval(window._langBuzzInterval);
            window._langBuzzInterval = null;
        }

        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none';

        var actor = document.createElement('div');
        actor.className = 'runaway-actor';
        actor.style.left = startRect.left + 'px';
        actor.style.top = startRect.top + 'px';
        actor.innerHTML =
            '<div id="runawayBubble" style="font-size:10px;color:#e3b341;font-weight:bold;margin-bottom:2px;white-space:nowrap;">' + window.tr('💨 Адиос!', '💨 Adios!') + '</div>' +
            '<div class="jenny-lang-btn" style="white-space:nowrap;padding:4px 8px;border-color:#3fb950;box-shadow:0 0 12px rgba(63,185,80,0.6);">' +
                (window.renderDualLangHTML ? window.renderDualLangHTML(false) : 'RU / EN') +
            '</div>' +
            '<div class="runaway-legs-wrap">' +
                '<div class="runaway-leg left"></div>' +
                '<div class="runaway-leg right"></div>' +
            '</div>';
        document.body.appendChild(actor);
        actor.classList.add('lang-buzz-active');
        try { navigator.vibrate(25); } catch (e) {}

        // Trigger the animated swap of Refresh buttons (🔄 30 & 🔄 887) into the vacated search slot + deck button expansion!
        setTimeout(function() {
            window.relocateRefreshButtonsToSearchSlotAnimatedV235();
        }, 280);

        // Step 1 (360ms): Sprint on legs along the search bar to take a running start
        setTimeout(function() {
            actor.classList.remove('lang-buzz-active');
            var runStartX = Math.max(24, startRect.left - 135);
            actor.style.transition = 'left 0.72s linear, top 0.72s ease-in-out';
            actor.style.left = runStartX + 'px';
            actor.style.top = (startRect.top - 3) + 'px';
        }, 360);

        // Step 2 (1100ms): Sprint back right toward the gear column
        setTimeout(function() {
            var preJumpX = Math.max(40, gearRect.left - 28);
            actor.style.transition = 'left 0.62s linear, top 0.62s ease-in-out';
            actor.style.left = preJumpX + 'px';
            actor.style.top = (startRect.top - 6) + 'px';
        }, 1100);

        // Step 3 (1740ms): Shout "🤸 Вжух!" and somersault up into the Settings gear ⚙️!
        setTimeout(function() {
            var b = document.getElementById('runawayBubble');
            if (b) b.innerText = window.tr('🤸 Вжух!', '🤸 Wheee!');
            actor.style.transition = 'left 0.55s ease-in, top 0.55s cubic-bezier(0.2, -0.6, 0.3, 1), transform 0.55s ease-in, opacity 0.55s ease-in';
            actor.style.left = (gearRect.left - 4) + 'px';
            actor.style.top = (gearRect.top - 4) + 'px';
            actor.style.transform = 'rotate(540deg) scale(0.15)';
            actor.style.opacity = '0.2';
        }, 1740);

        // Step 4 (2310ms): Gear swallows the badge & docks it into Settings next to Guide/Manual
        setTimeout(function() {
            actor.remove();
            btn.style.display = 'none';
            gear.classList.add('gear-swallow-anim');
            try { navigator.vibrate([20, 40, 30]); } catch (e) {}
            setTimeout(function() { gear.classList.remove('gear-swallow-anim'); }, 650);
            if (typeof window.dockLangBadgeIntoOpenSettingsV39 === 'function') {
                window.dockLangBadgeIntoOpenSettingsV39();
            }
        }, 2310);
    };

    // SCENARIO 2: Clicked at least once -> Turns into caterpillar (.crawler-actor), crawls from Search bar up into ⚙️ Settings,
    //             while Refresh buttons (🔄 30 & 🔄 887) animate into its place and Deck transport buttons expand!
    window.crawlAwayLangBadgeToSettings = function() {
        window.ensureSearchRightSlotAndLangBtnV235();
        var btn = document.getElementById('mainLangToggleBtn');
        var gear = document.getElementById('btn-settingsModal');
        if (!btn || !gear || window._hasLangRunAway) return;

        var startRect = btn.getBoundingClientRect();
        var gearRect = gear.getBoundingClientRect();
        if (startRect.width <= 0 && startRect.height <= 0) {
            var sInp = document.getElementById('trackSearchInput');
            var sRect = sInp ? sInp.getBoundingClientRect() : { right: (window.innerWidth || 360) - 16, top: 58, width: 64, height: 34 };
            startRect = { left: Math.max(16, sRect.right - 68), top: sRect.top, width: 64, height: 34 };
        }

        window._hasLangRunAway = true;
        if (window._langBuzzInterval) {
            clearInterval(window._langBuzzInterval);
            window._langBuzzInterval = null;
        }

        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none';

        var legsHTML = '<span class="c-leg"></span><span class="c-leg"></span><span class="c-leg"></span><span class="c-leg"></span><span class="c-leg"></span>';
        var crawler = document.createElement('div');
        crawler.className = 'crawler-actor';
        crawler.style.left = startRect.left + 'px';
        crawler.style.top = startRect.top + 'px';
        crawler.innerHTML =
            '<div id="crawlerBubble" style="font-size:10px;color:#58a6ff;font-weight:bold;margin-bottom:8px;white-space:nowrap;">' + window.tr('🐛 Ползу в ⚙️...', '🐛 Crawling to ⚙️...') + '</div>' +
            '<div id="crawlerRotator" class="crawler-rotator" style="transform: rotate(0deg);">' +
                '<div class="crawler-spine">' +
                    '<div class="crawler-legs-row side-a">' + legsHTML + '</div>' +
                    '<div class="jenny-lang-btn" style="white-space:nowrap;padding:3px 7px;border-color:#58a6ff;box-shadow:0 0 10px rgba(88,166,255,0.45);">' +
                        (window.renderDualLangHTML ? window.renderDualLangHTML(false) : 'RU / EN') +
                    '</div>' +
                    '<div class="crawler-legs-row side-b">' + legsHTML + '</div>' +
                    '<div class="crawler-head-antennae"><span class="c-antenna top"></span><span class="c-antenna bot"></span></div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(crawler);

        var rotator = document.getElementById('crawlerRotator');
        var topLaneY = Math.max(6, gearRect.top + 2);
        var crawlLeftLaneX = Math.max(28, startRect.left - 75);

        // Trigger the animated swap of Refresh buttons into the vacated search slot + deck button expansion!
        setTimeout(function() {
            window.relocateRefreshButtonsToSearchSlotAnimatedV235();
        }, 320);

        // Step 1 (30ms): Turn head with antennae left (180deg) and crawl slightly left along the search bar
        setTimeout(function() {
            if (rotator) rotator.style.transform = 'rotate(180deg)';
        }, 30);

        setTimeout(function() {
            crawler.style.transition = 'left 0.85s linear';
            crawler.style.left = crawlLeftLaneX + 'px';
        }, 200);

        // Step 2 (1080ms): Turn head straight UP (-90deg) and crawl up to the header row
        setTimeout(function() {
            if (rotator) rotator.style.transform = 'rotate(-90deg)';
        }, 1080);

        setTimeout(function() {
            crawler.style.transition = 'top 1.05s linear';
            crawler.style.top = topLaneY + 'px';
        }, 1240);

        // Step 3 (2320ms): Turn head right (0deg) toward the Settings gear ⚙️ and crawl into it
        setTimeout(function() {
            if (rotator) rotator.style.transform = 'rotate(0deg)';
        }, 2320);

        setTimeout(function() {
            crawler.style.transition = 'left 0.85s linear';
            crawler.style.left = (gearRect.left - 4) + 'px';
        }, 2480);

        // Step 4 (3350ms): Dive into Settings gear ⚙️
        setTimeout(function() {
            var b = document.getElementById('crawlerBubble');
            if (b) b.innerText = window.tr('🫡 На месте!', '🫡 Tucked in!');
            crawler.style.transition = 'left 0.38s ease-in, top 0.38s ease-in, transform 0.38s ease-in, opacity 0.38s ease-in';
            crawler.style.left = (gearRect.left + 2) + 'px';
            crawler.style.top = (gearRect.top + 2) + 'px';
            crawler.style.transform = 'scale(0.12)';
            crawler.style.opacity = '0.1';
        }, 3350);

        // Step 5 (3740ms): Gear accepts caterpillar & docks it into Settings next to Guide/Manual
        setTimeout(function() {
            crawler.remove();
            btn.style.display = 'none';
            gear.classList.add('gear-soft-anim');
            setTimeout(function() { gear.classList.remove('gear-soft-anim'); }, 550);
            if (typeof window.dockLangBadgeIntoOpenSettingsV39 === 'function') {
                window.dockLangBadgeIntoOpenSettingsV39();
            }
        }, 3740);
    };

    // Ensure dockLangBadgeIntoOpenSettingsV39 leaps in from the screen edge right next to Guide / Manual (#jennyTopBarRow)
    window.dockLangBadgeIntoOpenSettingsV39 = function() {
        var sm = document.getElementById('settingsModal');
        var gear = document.getElementById('btn-settingsModal');
        var topRow = document.getElementById('jennyTopBarRow');

        if (!sm || !sm.classList.contains('open') || !topRow || topRow.children.length < 2) {
            if (typeof window.syncSettingsLangBtnVisibilityV39 === 'function') {
                window.syncSettingsLangBtnVisibilityV39(true);
            }
            return;
        }

        var langBtnInSettings = document.getElementById('settingsDockedLangBtn') || topRow.lastElementChild;
        langBtnInSettings.id = 'settingsDockedLangBtn';
        langBtnInSettings.style.display = 'flex';
        langBtnInSettings.style.opacity = '0';
        langBtnInSettings.style.transition = 'none';
        langBtnInSettings.innerHTML = window.renderDualLangHTML ? window.renderDualLangHTML(true) : '🌐 RU / EN';

        setTimeout(function() {
            var slotRect = langBtnInSettings.getBoundingClientRect();
            var startX = (window.innerWidth || 360) + 12;
            var startY = Math.max(12, slotRect.top - 28);

            var flyer = document.createElement('div');
            flyer.style.cssText = 'position:fixed;z-index:999999;pointer-events:none;left:' + startX + 'px;top:' + startY + 'px;transform:scale(0.45) rotate(-18deg);opacity:0.95;transition:all 0.46s cubic-bezier(0.22, 1.35, 0.36, 1);';
            flyer.innerHTML = '<div class="jenny-lang-btn" style="padding:8px 12px;border-color:#3fb950;box-shadow:0 0 18px #3fb950;background:#0d1117;">' + (window.renderDualLangHTML ? window.renderDualLangHTML(true) : '🌐 RU / EN') + '</div>';
            document.body.appendChild(flyer);

            requestAnimationFrame(function() {
                flyer.style.left = slotRect.left + 'px';
                flyer.style.top = slotRect.top + 'px';
                flyer.style.transform = 'scale(1) rotate(0deg)';
            });

            setTimeout(function() {
                flyer.remove();
                langBtnInSettings.style.opacity = '1';
                langBtnInSettings.classList.remove('lang-docked-appear');
                void langBtnInSettings.offsetWidth;
                langBtnInSettings.classList.add('lang-docked-appear');
            }, 460);
        }, 50);
    };
})();

/* [split] V236: кусок исходного IIFE (ui_v71.js, строки 30671–31598) → ui_settings.js */
;(function() {
    if (window._jennyV236Installed__settings) return;
    window._jennyV236Installed__settings = true;
    window._jennyV236Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    var initV236 = function() {
        window.readLockedPinnedSourcesV236();
        window._userPinClickActiveV236 = true;
        try {
            window.renderHeaderSourcesHubV91(true);
        } finally {
            window._userPinClickActiveV236 = false;
        }
        window.syncGuideButtonPositionV165();
    };

    // Guard loadConfigFromDisk & loadPersistentUserDataV218 so server reloads never wipe pinnedSourcesV91
    var _origLoadConfigFromDiskV236 = window.loadConfigFromDisk;
    if (typeof _origLoadConfigFromDiskV236 === 'function') {
        window.loadConfigFromDisk = async function() {
            var lockedBefore = window.readLockedPinnedSourcesV236();
            var res = await _origLoadConfigFromDiskV236.apply(this, arguments);
            window.appConfig = window.appConfig || {};
            window.appConfig.pinnedSourcesV91 = lockedBefore.slice();
            try { localStorage.setItem('ytm_config', JSON.stringify(window.appConfig)); } catch (e) {}
            return res;
        };
    }

    // =========================================================================
    // 4. SCREENS 3 & 4 FIX (72010.jpg & 72012.jpg): MOVE [🧭 Гид] AND [🙈 Скрыть справки]
    //    TO ONE SINGLE ROW WITH [📖 СПРАВОЧНИК НАСТРОЕК (❓)] AT THE END OF SETTINGS
    // =========================================================================
    window.syncGuideButtonPositionV165 = function() {
        var hide = Boolean(window.appConfig && window.appConfig.hideHelpBadges);
        document.body.classList.toggle('hide-help-badges', hide);

        var cfgChk = document.getElementById('cfg_hideHelpV62');
        if (cfgChk && cfgChk.checked !== hide) cfgChk.checked = hide;

        var onbChk = document.getElementById('onb_hideHelpChkV165');
        if (onbChk && onbChk.checked !== hide) onbChk.checked = hide;

        var sm = document.getElementById('settingsModal');
        if (!sm) return;
        var container = sm.querySelector('.container') || sm;
        var guideBtn = document.getElementById('jennyFullGuideBtn');
        var onbBtn = document.getElementById('jennyOpenOnboardingBtnV165');
        var hideRow = document.getElementById('hideHelpRowV62');
        var topBarRow = document.getElementById('jennyTopBarRow');
        var themeRow = document.getElementById('jennyThemeStudioBtnRow');
        if (!guideBtn || !container) return;

        var bottomSlot = document.getElementById('jennyBottomGuideSlotV165');
        if (!bottomSlot) {
            bottomSlot = document.createElement('div');
            bottomSlot.id = 'jennyBottomGuideSlotV165';
            container.appendChild(bottomSlot);
        } else if (bottomSlot.parentElement === container && container.lastElementChild !== bottomSlot) {
            container.appendChild(bottomSlot);
        }

        var hideLblSpan = hideRow ? hideRow.querySelector('#hideHelpTextSpanV236') : null;
        if (hideRow && !hideLblSpan) {
            var lbl = hideRow.querySelector('label');
            var chk = document.getElementById('cfg_hideHelpV62');
            if (lbl && chk) {
                lbl.innerHTML = '';
                lbl.appendChild(chk);
                hideLblSpan = document.createElement('span');
                hideLblSpan.id = 'hideHelpTextSpanV236';
                lbl.appendChild(hideLblSpan);
            }
        }

        if (hide) {
            bottomSlot.className = 'jenny-bottom-help-row-v236';
            bottomSlot.style.display = 'flex';

            guideBtn.innerHTML = window.tr('📖 СПРАВОЧНИК (❓)', '📖 MANUAL (❓)');
            if (guideBtn.parentElement !== bottomSlot) {
                bottomSlot.appendChild(guideBtn);
            }
            if (onbBtn) {
                onbBtn.innerHTML = window.tr('🧭 Гид', '🧭 Guide');
                if (onbBtn.parentElement !== bottomSlot) {
                    bottomSlot.appendChild(onbBtn);
                }
            }
            if (hideRow) {
                if (hideLblSpan) {
                    hideLblSpan.textContent = ' 🙈 ' + window.tr('Справки', 'Help');
                }
                if (hideRow.parentElement !== bottomSlot) {
                    bottomSlot.appendChild(hideRow);
                }
            }

            // Hide #jennyTopBarRow at the top of Settings if the docked RU/EN button isn't visible inside it
            if (topBarRow) {
                var dockedLang = document.getElementById('settingsDockedLangBtn') || topBarRow.querySelector('button');
                var langVisible = Boolean(window._hasLangRunAway && dockedLang && dockedLang.style.display !== 'none');
                topBarRow.style.display = langVisible ? 'flex' : 'none';
            }
        } else {
            bottomSlot.className = '';
            bottomSlot.style.display = 'none';

            guideBtn.style.width = '';
            guideBtn.innerHTML = window.tr('📖 СПРАВОЧНИК НАСТРОЕК (❓)', '📖 FULL DSP MANUAL (❓)');

            if (topBarRow) {
                topBarRow.style.display = 'flex';
                if (guideBtn.parentElement !== topBarRow) {
                    topBarRow.insertBefore(guideBtn, topBarRow.firstChild);
                }
                if (onbBtn && onbBtn.parentElement !== topBarRow) {
                    if (guideBtn.nextSibling) {
                        topBarRow.insertBefore(onbBtn, guideBtn.nextSibling);
                    } else {
                        topBarRow.appendChild(onbBtn);
                    }
                }
            }

            if (hideRow) {
                hideRow.style.cssText = 'padding:9px 12px;border-radius:8px;margin-bottom:12px;';
                var lbl2 = hideRow.querySelector('label');
                if (lbl2) lbl2.style.cssText = 'font-weight:bold;color:#e6edf3;width:100%;display:flex;align-items:center;gap:8px;';
                if (hideLblSpan) {
                    hideLblSpan.textContent = ' 🙈 ' + window.tr('Скрыть все справочные материалы (оставить 1 справочник в конце)', 'Hide all help badges (move main manual to bottom)');
                }
                if (themeRow && hideRow.previousElementSibling !== themeRow) {
                    themeRow.insertAdjacentElement('afterend', hideRow);
                }
            }
        }
    };

    window.onToggleHideHelpBadgesV62 = function(chk, ev) {
        var hide = Boolean(chk && chk.checked);
        window.appConfig = window.appConfig || {};
        window.appConfig.hideHelpBadges = hide;
        try { localStorage.setItem('ytm_config', JSON.stringify(window.appConfig)); } catch (e) {}
        window.syncGuideButtonPositionV165();
        if (typeof window.saveThemeOnlyQuietlyV40 === 'function') window.saveThemeOnlyQuietlyV40();
        if (typeof window.showToast === 'function' && ev) {
            window.showToast(
                hide
                    ? window.tr('🙈 Справки скрыты: Справочник, Гид и галочка перенесены в одну строку в конец настроек', '🙈 Help hidden: Manual, Guide & toggle moved to one row at bottom of Settings')
                    : window.tr('📖 Все подсказки (❓) включены, кнопки возвращены в начало настроек', '📖 Help badges enabled, buttons returned to top of Settings'),
                ev
            );
        }
    };

    window.onToggleOnboardingHideHelpV165 = function(chk, ev) {
        try { navigator.vibrate(20); } catch (e) {}
        var hide = Boolean(chk && chk.checked);
        window.appConfig = window.appConfig || {};
        window.appConfig.hideHelpBadges = hide;
        try { localStorage.setItem('ytm_config', JSON.stringify(window.appConfig)); } catch (e) {}
        var cfgChk = document.getElementById('cfg_hideHelpV62');
        if (cfgChk) cfgChk.checked = hide;
        window.onToggleHideHelpBadgesV62({ checked: hide }, ev);

        var statusHint = document.getElementById('onbHideHelpStatusHintV165');
        if (statusHint) {
            statusHint.innerHTML = hide
                ? '🙈 Активно: все значки <b>❓</b> скрыты, а <b>📖 Справочник</b>, <b>🧭 Гид</b> и эта галочка перенесены <b>на одну строку в самый конец настроек</b>.'
                : '📖 Не активно: значки подсказок <b>❓</b> включены, а кнопки справочника и гида стоят <b>в самом начале настроек</b>.';
            statusHint.style.color = hide ? '#e3b341' : '#3fb950';
        }
    };

    // Ensure dockLangBadgeIntoOpenSettingsV39 works even when #jennyTopBarRow has only 1 child (#settingsDockedLangBtn) because Guide & Manual moved to bottom!
    var _origDockLangV236 = window.dockLangBadgeIntoOpenSettingsV39;
    window.dockLangBadgeIntoOpenSettingsV39 = function() {
        var topRow = document.getElementById('jennyTopBarRow');
        if (topRow) {
            topRow.style.display = 'flex';
        }
        var sm = document.getElementById('settingsModal');
        if (!sm || !sm.classList.contains('open') || !topRow) {
            if (typeof window.syncSettingsLangBtnVisibilityV39 === 'function') {
                window.syncSettingsLangBtnVisibilityV39(true);
            }
            return;
        }
        var langBtnInSettings = document.getElementById('settingsDockedLangBtn') || topRow.lastElementChild;
        if (!langBtnInSettings) return;
        langBtnInSettings.id = 'settingsDockedLangBtn';
        langBtnInSettings.style.display = 'flex';
        langBtnInSettings.style.opacity = '0';
        langBtnInSettings.style.transition = 'none';
        langBtnInSettings.innerHTML = window.renderDualLangHTML ? window.renderDualLangHTML(true) : '🌐 RU / EN';

        setTimeout(function() {
            var slotRect = langBtnInSettings.getBoundingClientRect();
            var startX = (window.innerWidth || 360) + 12;
            var startY = Math.max(12, slotRect.top - 28);

            var flyer = document.createElement('div');
            flyer.style.cssText = 'position:fixed;z-index:999999;pointer-events:none;left:' + startX + 'px;top:' + startY + 'px;transform:scale(0.45) rotate(-18deg);opacity:0.95;transition:all 0.46s cubic-bezier(0.22, 1.35, 0.36, 1);';
            flyer.innerHTML = '<div class="jenny-lang-btn" style="padding:8px 12px;border-color:#3fb950;box-shadow:0 0 18px #3fb950;background:#0d1117;">' + (window.renderDualLangHTML ? window.renderDualLangHTML(true) : '🌐 RU / EN') + '</div>';
            document.body.appendChild(flyer);

            requestAnimationFrame(function() {
                flyer.style.left = slotRect.left + 'px';
                flyer.style.top = slotRect.top + 'px';
                flyer.style.transform = 'scale(1) rotate(0deg)';
            });

            setTimeout(function() {
                flyer.remove();
                langBtnInSettings.style.opacity = '1';
                langBtnInSettings.classList.remove('lang-docked-appear');
                void langBtnInSettings.offsetWidth;
                langBtnInSettings.classList.add('lang-docked-appear');
            }, 460);
        }, 50);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(initV236, 280);
            setTimeout(function() { window.syncGuideButtonPositionV165(); }, 650);
        });
    } else {
        setTimeout(initV236, 280);
        setTimeout(function() { window.syncGuideButtonPositionV165(); }, 650);
    }
})();

/* [split] V238: кусок исходного IIFE (ui_v71.js, строки 32554–32910) → ui_settings.js */
;(function() {
    if (window._jennyV238MultiPortInstalled__settings) return;
    window._jennyV238MultiPortInstalled__settings = true;
    window._jennyV238MultiPortInstalled = true;

    var _origRenderThreadsSettingsBoxV216 = window.renderThreadsSettingsBoxV216;
    if (typeof _origRenderThreadsSettingsBoxV216 === 'function') {
        window.renderThreadsSettingsBoxV216 = function() {
            _origRenderThreadsSettingsBoxV216.apply(this, arguments);
            var box = document.getElementById('jennyThreadsSettingsBoxV216');
            if (!box) return;
            var gc = box.querySelector('.group-content');
            if (gc && !document.getElementById('jennyClusterStatusBadgeV238')) {
                var badge = document.createElement('div');
                badge.id = 'jennyClusterStatusBadgeV238';
                badge.style.cssText = 'margin-bottom:8px;padding:8px 9px;background:#090d14;border:1px solid rgba(63,185,80,0.45);border-radius:8px;line-height:1.35;';
                gc.insertBefore(badge, gc.firstChild);
            }
            window.refreshClusterTelemetryBadgeV238();
        };
        setTimeout(function() {
            if (document.getElementById('jennyThreadsSettingsBoxV216')) {
                window.renderThreadsSettingsBoxV216();
            }
        }, 400);
    }
})();

/* [split] V242: кусок исходного IIFE (ui_v71.js, строки 33743–34878) → ui_settings.js */
;(function() {
    if (window._jennyV242Installed__settings) return;
    window._jennyV242Installed__settings = true;
    window._jennyV242Installed = true;

    // Sync body class for docked RU/EN button strictly with window._hasLangRunAway
    window.syncLangDockedBodyClassV242 = function() {
        if (!document.body) return;
        if (window._hasLangRunAway) {
            document.body.classList.add('jenny-lang-docked-ready-v242');
        } else {
            document.body.classList.remove('jenny-lang-docked-ready-v242');
            var sBtn = document.getElementById('settingsDockedLangBtn');
            if (sBtn) sBtn.style.setProperty('display', 'none', 'important');
            var topRow = document.getElementById('jennyTopBarRow');
            var hideHelp = Boolean(window.appConfig && window.appConfig.hideHelpBadges);
            if (topRow && hideHelp) {
                topRow.style.setProperty('display', 'none', 'important');
            }
        }
    };

    // Wrap syncSettingsLangBtnVisibilityV39 & dockLangBadgeIntoOpenSettingsV39 so RU/EN ONLY shows in Settings AFTER jumping!
    var _prevSyncSettingsLangV242 = window.syncSettingsLangBtnVisibilityV39;
    window.syncSettingsLangBtnVisibilityV39 = function(animateDock) {
        window.syncLangDockedBodyClassV242();
        if (typeof _prevSyncSettingsLangV242 === 'function') {
            _prevSyncSettingsLangV242.apply(this, arguments);
        }
        var topRow = document.getElementById('jennyTopBarRow');
        var sBtn = document.getElementById('settingsDockedLangBtn') || (topRow ? topRow.lastElementChild : null);
        if (sBtn && sBtn.id !== 'jennyFullGuideBtn' && sBtn.id !== 'jennyOpenOnboardingBtnV165') {
            sBtn.id = 'settingsDockedLangBtn';
            if (!window._hasLangRunAway) {
                sBtn.style.setProperty('display', 'none', 'important');
            } else {
                sBtn.style.setProperty('display', 'flex', 'important');
            }
        }
        if (topRow) {
            var hideHelp = Boolean(window.appConfig && window.appConfig.hideHelpBadges);
            if (hideHelp && !window._hasLangRunAway) {
                topRow.style.setProperty('display', 'none', 'important');
            } else {
                topRow.style.setProperty('display', 'flex', 'important');
            }
        }
    };

    var _prevDockLangV242 = window.dockLangBadgeIntoOpenSettingsV39;
    window.dockLangBadgeIntoOpenSettingsV39 = function() {
        window._hasLangRunAway = true;
        window.syncLangDockedBodyClassV242();
        if (typeof _prevDockLangV242 === 'function') {
            return _prevDockLangV242.apply(this, arguments);
        }
    };

    // Dynamic exact top/bottom edge-to-edge layout measurement so zero pixels are wasted!
    window.syncEdgeToEdgeLayoutBoundsV242 = function() {
        var topEl = document.querySelector('.sticky-top');
        var botEl = document.getElementById('bottomPlayerDock') || document.querySelector('.sticky-bottom');
        var midEl = document.querySelector('.middle-list-container');
        var topH = (topEl && topEl.offsetHeight > 40) ? topEl.offsetHeight : 140;
        var botH = 0;
        if (botEl && getComputedStyle(botEl).display !== 'none') {
            botH = botEl.offsetHeight || 96;
        }
        if (midEl) {
            midEl.style.setProperty('top', topH + 'px', 'important');
            midEl.style.setProperty('bottom', botH + 'px', 'important');
        }
        document.querySelectorAll('.modal-overlay').forEach(function(mo) {
            mo.style.setProperty('top', topH + 'px', 'important');
            mo.style.setProperty('bottom', botH + 'px', 'important');
        });
    };

    if (typeof window.ResizeObserver === 'function') {
        try {
            var roV242 = new ResizeObserver(function() {
                window.syncEdgeToEdgeLayoutBoundsV242();
            });
            var tEl0 = document.querySelector('.sticky-top');
            var bEl0 = document.getElementById('bottomPlayerDock');
            if (tEl0) roV242.observe(tEl0);
            if (bEl0) roV242.observe(bEl0);
        } catch (e) {}
    }
})();

/* ============================================================================
 * [FIX-ONBOARDING-PIN] Стартовый гид: кнопки запроса разрешений закреплены.
 * Раньше кнопка разрешения была последним блоком прокручиваемой области
 * #onbPageBodyV165 и на маленьких экранах (низкий DPI) уезжала под прокрутку.
 * Теперь после отрисовки страницы блоки, состоящие из одной кнопки разрешения,
 * переносятся в неподвижную полосу над нижней панелью «Назад / Далее».
 * Сами кнопки и их обработчики не меняются.
 * ============================================================================ */
;(function() {
    var prevRenderOnb = window.renderOnboardingPageV165;
    if (typeof prevRenderOnb !== 'function' || prevRenderOnb._permPinnedFix) return;

    function getPinnedHolder() {
        var foot = document.getElementById('onbFooterBarV165');
        if (!foot || !foot.parentNode) return null;
        var holder = document.getElementById('onbPinnedPermsHolder');
        if (!holder) {
            holder = document.createElement('div');
            holder.id = 'onbPinnedPermsHolder';
            holder.style.cssText = 'flex-shrink:0;display:none;flex-direction:column;gap:6px;';
            foot.parentNode.insertBefore(holder, foot);
        }
        return holder;
    }

    function isPermissionOnlyBlock(el) {
        if (!el || !el.children || el.children.length !== 1) return false;
        var btn = el.children[0];
        if (!btn || btn.tagName !== 'BUTTON') return false;
        var oc = String((btn.getAttribute && btn.getAttribute('onclick')) || '');
        return oc.indexOf('triggerOnboardingPermActionV165') !== -1 || btn.id === 'onbBgUnrestrictedBtnV214';
    }

    window.renderOnboardingPageV165 = function(pageIdx) {
        var holder = getPinnedHolder();
        // Чистим полосу ДО отрисовки: старый код проверяет наличие кнопки по id и иначе не добавит её заново.
        if (holder) { holder.innerHTML = ''; holder.style.display = 'none'; }

        var res = prevRenderOnb.apply(this, arguments);

        try {
            var body = document.getElementById('onbPageBodyV165');
            holder = getPinnedHolder();
            if (body && holder) {
                var toPin = [];
                for (var i = 0; i < body.children.length; i++) {
                    if (isPermissionOnlyBlock(body.children[i])) toPin.push(body.children[i]);
                }
                toPin.forEach(function(block) {
                    block.style.marginTop = '0';
                    block.style.paddingTop = '0';
                    holder.appendChild(block);
                });
                holder.style.display = toPin.length ? 'flex' : 'none';
            }
        } catch (ePin) {}
        return res;
    };
    window.renderOnboardingPageV165._permPinnedFix = true;
})();
