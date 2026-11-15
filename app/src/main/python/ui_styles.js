/* ============================================================================
 * ui_styles.js — CSS-вставки всех патчей (порядок как в исходнике)
 * Вынесено из ui_v71.js без изменения кода (см. REFACTOR_PLAN.md). Порядок блоков — исходный.
 * ============================================================================ */


// === 📝🌐 JENNY V144: FULL UNTRUNCATED MULTI-LINE TITLES ACROSS ALL STUDIOS ===
;(function() {
const styleId = 'jennyFullNamesEverywhereV144';
if (!document.getElementById(styleId)) {
    const st = document.createElement('style');
    st.id = styleId;
    st.textContent = `
        /* Полные многострочные названия в Торрент-студии, Центре закачек P2P, SoundCloud, Game OST, Архивах, Радио и Видеоплеере */
        #jennyTorrentModalV91 div,
        #jennyTorInspectorModalV128 div,
        #jennySoundCloudModalV93 div,
        #jennyKhinsiderModalV88 div,
        #jennyFlacRadioModalV91 div,
        .jenny-univ-mini-player-v98 .ump-title,
        #khMiniTitleV90,
        #v130VideoTitle,
        #v130VideoSubTelemetry {
            white-space: normal !important;
            text-overflow: clip !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
        }
        /* Стабильная высота статусной строки в Торрент-студии, чтобы список не прыгал при появлении 2-й строки */
        #torStatusLineV96 {
            min-height: 30px !important;
            display: flex !important;
            align-items: center !important;
            line-height: 1.28 !important;
        }
    `;
    document.head.appendChild(st);
}
})();

/* [split] V145: кусок исходного IIFE (ui_v71.js, строки 11870–12008) → ui_styles.js */
;(function() {
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    const styleId = 'jennyV145LayoutFixes';
if (!document.getElementById(styleId)) {
    const st = document.createElement('style');
    st.id = styleId;
    st.textContent = `
        #jennyTorrentModalV91 button,
        #jennyTorInspectorModalV128 button,
        #jennySoundCloudModalV93 button,
        #jennyKhinsiderModalV88 button,
        #jennyFlacRadioModalV91 button {
            overflow-wrap: normal !important;
            word-break: normal !important;
            white-space: nowrap !important;
        }
        /* В мини-плеере переносим название трека на отдельную полную строку сверху, а кнопки — справа снизу */
        .jenny-univ-mini-player-v98 > div:first-child {
            flex-wrap: wrap !important;
            row-gap: 4px !important;
        }
        .jenny-univ-mini-player-v98 .ump-title {
            flex: 1 1 100% !important;
            width: 100% !important;
            max-width: 100% !important;
            white-space: normal !important;
            overflow-wrap: break-word !important;
            word-break: break-word !important;
            line-height: 1.3 !important;
            margin-bottom: 2px !important;
        }
    `;
    document.head.appendChild(st);
}
})();

/* [split] V147: кусок исходного IIFE (ui_v71.js, строки 12011–12234) → ui_styles.js */
;(function() {
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    const styleId = 'jennyV147VideoHeaderFix';
if (!document.getElementById(styleId)) {
    const st = document.createElement('style');
    st.id = styleId;
    st.textContent = `
        #v132BtnDesktop,
        #v146BtnOverlayPerm {
            display: none !important;
        }
        #v130TopDragBar {
            flex-wrap: wrap !important;
            align-items: flex-start !important;
            row-gap: 6px !important;
        }
        #v130TopDragBar > div:first-child {
            flex: 1 1 100% !important;
            width: 100% !important;
            min-width: 100% !important;
        }
        #v130TopDragBar > div:last-child {
            flex: 1 1 100% !important;
            width: 100% !important;
            justify-content: flex-end !important;
            flex-wrap: wrap !important;
        }
        #v130VideoTitle {
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            line-height: 1.3 !important;
            font-size: 13px !important;
        }
    `;
    document.head.appendChild(st);
}
})();

/* [split] V150: кусок исходного IIFE (ui_v71.js, строки 12237–12748) → ui_styles.js */
;(function() {
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    const pipStyleId = 'jennyV150PipAndVideoFixes';
if (!document.getElementById(pipStyleId)) {
    const st = document.createElement('style');
    st.id = pipStyleId;
    st.textContent = `
        #jennyVideoStudioRootV130 .v130-hud-bar,
        #jennyVideoStudioRootV130 #v130TopDragBar {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
        }
        #jennyVideoStudioRootV130 #v130SeekSlider {
            min-width: 0 !important;
            flex: 1 1 auto !important;
        }
        #jennyVideoStudioRootV130.mode-pip-v130 #v130TopDragBar {
            padding: 6px 8px !important;
            row-gap: 4px !important;
        }
        #jennyVideoStudioRootV130.mode-pip-v130 #v130VideoTitle {
            font-size: 11.5px !important;
            line-height: 1.22 !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 1 !important;
            -webkit-box-orient: vertical !important;
            overflow: hidden !important;
        }
        #jennyVideoStudioRootV130.mode-pip-v130 .v130-hud-bar:last-child {
            padding: 6px 8px !important;
        }
        #jennyVideoStudioRootV130.mode-pip-v130 #v130CurTime,
        #jennyVideoStudioRootV130.mode-pip-v130 #v130DurTime {
            min-width: 28px !important;
            font-size: 10px !important;
        }
        #jennyVideoStudioRootV130.mode-pip-v130 .v130-btn {
            padding: 3px 6px !important;
            font-size: 10px !important;
        }
    `;
    document.head.appendChild(st);
}
})();
/* ================= END JENNY V210 ================= */


/* ================= JENNY V211: ВЗАИМОДОПОЛНЯЕМЫЕ ДЕКИ А+Б, ДВЕ НЕЗАВИСИМЫЕ ШКАЛЫ ПРОГРЕССА И 4 БУФЕРА ЗВУКА В RAM ================= */
/* [split] V211: кусок исходного IIFE (ui_v71.js, строки 16526–17925) → ui_styles.js */
;(function() {
    if (window._jennyV211Installed__styles) return;
    window._jennyV211Installed__styles = true;
    window._jennyV211Installed = true;

    // 1. СТИЛЬ КНОПОК ДЕК В НАСТРОЙКАХ (ПОД УПРАВЛЯЮЩИЕ КНОПКИ ПЛЕЕРА) И АДАПТИВНАЯ ВЫСОТА ДОКА ДЛЯ 2 ШКАЛ
    function injectV211Styles() {
        if (document.getElementById('jennyV211Style')) return;
        var st = document.createElement('style');
        st.id = 'jennyV211Style';
        st.textContent = `
            .sticky-bottom {
                height: auto !important;
                min-height: 156px !important;
                transition: height 0.18s ease !important;
            }
            body.dual-progress-bars-v211 .middle-list-container,
            body.dual-progress-bars-v211 .modal-overlay {
                bottom: 210px !important;
            }
            .jenny-deck-ctrl-btn-v211 {
                flex: 1;
                min-height: 42px;
                padding: 7px 12px !important;
                border-radius: 50px !important;
                background: linear-gradient(145deg, #160d2e, #090514) !important;
                color: var(--transport-accent, #a371f7) !important;
                border: 1.5px solid var(--border-uniform, rgba(115, 65, 190, 0.48)) !important;
                box-shadow: 0px 4px 0px #000000, inset 0px 2px 2px rgba(163, 113, 247, 0.22), 0px 6px 12px rgba(0,0,0,0.85) !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 6px !important;
                font-size: 11.5px !important;
                font-weight: 900 !important;
                cursor: pointer;
                transition: all 0.12s ease-in-out !important;
                user-select: none;
            }
            .jenny-deck-ctrl-btn-v211:active {
                transform: translateY(2px) scale(0.98) !important;
            }
            .jenny-deck-ctrl-btn-v211.deck-on-v211 {
                background: linear-gradient(145deg, #211246, #0d0720) !important;
                color: #ffffff !important;
                border-color: #a371f7 !important;
                box-shadow: 0px 3px 0px #000000, inset 0px 2px 4px rgba(163, 113, 247, 0.42), 0px 0px 14px rgba(163, 113, 247, 0.45) !important;
            }
            .jenny-deck-ctrl-btn-v211.deck-on-v211.deck-focused-v211 {
                border-color: var(--accent-cyan, #58a6ff) !important;
                box-shadow: 0px 3px 0px #000000, inset 0px 2px 4px rgba(88, 166, 255, 0.35), 0px 0px 16px rgba(88, 166, 255, 0.55) !important;
            }
            .jenny-deck-ctrl-btn-v211.deck-off-v211 {
                opacity: 0.62;
                color: #8b949e !important;
                border-color: rgba(115, 65, 190, 0.25) !important;
            }
            .jenny-deck-pill-badge-v211 {
                font-size: 9.5px;
                padding: 2px 6px;
                border-radius: 20px;
                font-family: monospace;
                font-weight: 900;
                background: rgba(0, 0, 0, 0.55);
                border: 1px solid rgba(255, 255, 255, 0.15);
            }
            .jenny-deck-ctrl-btn-v211.deck-on-v211 .jenny-deck-pill-badge-v211 {
                color: #00ff9d;
                border-color: #00ff9d;
                background: rgba(0, 255, 157, 0.14);
            }
        `;
        document.head.appendChild(st);
    }
    injectV211Styles();
})();
/* ================= END JENNY V212 ================= */




/* ================= JENNY_V215_UNIFIED_PATCH: INSTANT TORRENT START/SEEK, AVI FIX, DUAL FORMAT SLOTS, NO AUDIO MUTE GAP & CLEAN TORRENT ROWS ================= */
/* [split] V215: кусок исходного IIFE (ui_v71.js, строки 18904–19635) → ui_styles.js */
;(function() {
    if (window._jennyV215Installed__styles) return;
    window._jennyV215Installed__styles = true;
    window._jennyV215Installed = true;

    // -------------------------------------------------------------------------
    // 1. СТИЛИ V215: ШАПКА ТОРРЕНТ-СТУДИИ БЕЗ ВЫЛЕЗАНИЯ ТЕКСТА + ЧИПЫ ФОРМАТОВ
    // -------------------------------------------------------------------------
    var styleV215 = document.createElement('style');
    styleV215.id = 'jennyStyleV215';
    styleV215.textContent = [
        '#btnTorHeaderHubMenuV128 {',
        '  overflow: hidden !important;',
        '  text-overflow: ellipsis !important;',
        '  white-space: nowrap !important;',
        '  max-width: 100% !important;',
        '  min-width: 0 !important;',
        '  padding: 4px 8px !important;',
        '  font-size: 10.5px !important;',
        '  box-sizing: border-box !important;',
        '  justify-content: center !important;',
        '}',
        '#lblTorHeaderHubMenuV128 {',
        '  overflow: hidden !important;',
        '  text-overflow: ellipsis !important;',
        '  white-space: nowrap !important;',
        '  display: inline-block !important;',
        '  max-width: 100% !important;',
        '  min-width: 0 !important;',
        '}',
        '#btnTorBgShieldV212, #btnSettingsBgShieldV212 { display: none !important; }',
        '.jv210-hidden-node {',
        '  opacity: 0 !important;',
        '  visibility: hidden !important;',
        '  pointer-events: none !important;',
        '}'
    ].join('\n');
    document.head.appendChild(styleV215);
})();

/* [split] V216: кусок исходного IIFE (ui_v71.js, строки 19638–21240) → ui_styles.js */
;(function() {
    if (window._jennyV216Installed__styles) return;
    window._jennyV216Installed__styles = true;
    window._jennyV216Installed = true;

    // -------------------------------------------------------------------------
    // 2. СТИЛИ V216: КОМПАКТНЫЕ 9-КНОПОЧНЫЕ СТРОКИ УПРАВЛЕНИЯ ПОД ДЕКОЙ Б И ДЕКОЙ А
    //    (СЛЕГКА СКВАДРАЧЕННЫЕ С КРУГЛЫМИ УГЛАМИ, ВСЕ 9 КНОПОК В ОДНУ СТРОКУ!)
    // -------------------------------------------------------------------------
    // Стили кнопок и шкал Деки А и Деки Б разнесены в независимые файлы deck_a_isolated.css и deck_b_isolated.css
    var styleV216 = document.createElement('style');
    styleV216.id = 'jennyStyleV216HeaderOnly';
    styleV216.textContent = [
        '#subDockBar { display: none !important; }',
        '#topHeaderCapsule .jenny-icon-pill {',
        '  width: 30px !important;',
        '  height: 30px !important;',
        '  padding: 0 !important;',
        '  border-radius: 8px !important;',
        '  flex-shrink: 0 !important;',
        '}'
    ].join('\n');
    document.head.appendChild(styleV216);
})();

/* [split] V218: кусок исходного IIFE (ui_v71.js, строки 22588–24059) → ui_styles.js */
;(function() {
    if (window._jennyV218Installed__styles) return;
    window._jennyV218Installed__styles = true;
    window._jennyV218Installed = true;

    var styleV218 = document.createElement('style');
    styleV218.id = 'jennyStyleV218';
    styleV218.textContent = [
        /* Полное скрытие больших плашек 120Hz / Крутилки / Сплит / Лог в мини-плеере и системном PiP */
        '#jennyVideoStudioRootV130.compact-pip-v218 #jenny120PillWrapV209,',
        '#jennyVideoStudioRootV130.compact-pip-v218 #jennyTunerFloatWrapV208,',
        '#jennyVideoStudioRootV130.compact-pip-v218 #jennySplitPillWrapV209,',
        '#jennyVideoStudioRootV130.compact-pip-v218 #jennyFenceWrapV173,',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v131BtnMixMode,',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v131BtnOpenVideoDsp,',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v130BtnTorHub,',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v132BtnFullscreen,',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v130BtnRotate,',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v130BtnFit,',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v131BtnVideoRev,',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v130BtnNormSpeed,',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v130BtnSpeed,',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v130BtnDsp {',
        '  display: none !important;',
        '  opacity: 0 !important;',
        '  pointer-events: none !important;',
        '}',
        /* В мини-плеере и на рабочем столе (PiP) всегда показываем компактную нижнюю панель (шкала + Замок + Дор.) */
        '#jennyVideoStudioRootV130.compact-pip-v218 #v130BottomBar {',
        '  display: flex !important;',
        '  padding: 2px 6px 4px 6px !important;',
        '  gap: 2px !important;',
        '  background: linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 75%, transparent 100%) !important;',
        '}',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v135BottomToolsRow {',
        '  display: flex !important;',
        '  justify-content: space-between !important;',
        '  gap: 6px !important;',
        '}',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v135BottomToolsRow .v130-btn {',
        '  height: 24px !important;',
        '  font-size: 9.5px !important;',
        '  padding: 0 6px !important;',
        '  flex: 0 1 auto !important;',
        '}',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v130TopDragBar {',
        '  padding: 4px 6px !important;',
        '}',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v130BtnPipToggle {',
        '  height: 26px !important;',
        '  font-size: 10px !important;',
        '  padding: 0 6px !important;',
        '}',
        '#jennyVideoStudioRootV130.compact-pip-v218 .v130-btn-close-v217 {',
        '  width: 26px !important;',
        '  height: 26px !important;',
        '}',
        /* Гарантируем 100% заполнение контейнера видеоэлементом для работы режима "Растянуть" (fill) без чёрных полос */
        '#jennyVideoStageV130 #jennyVideoElV130, #jennyVideoStageV130 #jv166InterpCanvas {',
        '  width: 100% !important;',
        '  height: 100% !important;',
        '  max-width: none !important;',
        '  max-height: none !important;',
        '}'
    ].join('\n');
    document.head.appendChild(styleV218);
})();
/* ================= END JENNY_V218_UNIFIED_PATCH ================= */

/* ================= JENNY_V219_UNIFIED_PATCH (#313): AUDIO-ONLY MODE PLAYBACK FIX, 2-ROW VIDEO BOTTOM BAR & REMOVE SAVE BTN, DIRECT 1-TAP REV/FWD SPEED SWITCH WITHOUT 1X RESET, MINI-PLAYER EXPANDABLE TITLE CAPSULE & PAUSE BLACK-SCREEN FIX, INDEPENDENT DECK A/B VOLUME + OVERDRIVE + MUTE 0% POPUP BUTTON, SMOOTH HARDWARE VIDEO REVERSE ================= */
/* [split] V219: кусок исходного IIFE (ui_v71.js, строки 24063–25074) → ui_styles.js */
;(function() {
    if (window._jennyV219Installed__styles) return;
    window._jennyV219Installed__styles = true;
    window._jennyV219Installed = true;

    // -------------------------------------------------------------------------
    // 1. СТИЛИ V219: 2 РЯДА КНОПОК В ВИДЕОПЛЕЕРЕ, КАПСУЛА НАЗВАНИЯ В МИНИ-ПЛЕЕРЕ,
    //    КНОПКА MUTE (0%) В ШКАЛЕ ГРОМКОСТИ И РЕЖИМ "А" БЕЗ DISPLAY:NONE
    // -------------------------------------------------------------------------
    var styleV219 = document.createElement('style');
    styleV219.id = 'jennyStyleV219';
    styleV219.textContent = [
        /* Полное удаление старой кнопки скачивания ⬇️ (#v130BtnSaveVideo) из видеоплеера и мини-плеера */
        '#v130BtnSaveVideo, button[onclick*="saveCurrentVideoToLibraryV130"] {',
        '  display: none !important;',
        '  width: 0 !important;',
        '  height: 0 !important;',
        '  opacity: 0 !important;',
        '  pointer-events: none !important;',
        '}',

        /* Режим "А" (только аудио из видео): прячем окно за экран БЕЗ display:none, чтобы WebView никогда не ставил звук на паузу! */
        '#jennyVideoStudioRootV130.audio-only-hidden-v219 {',
        '  display: flex !important;',
        '  width: 1px !important;',
        '  height: 1px !important;',
        '  left: -9999px !important;',
        '  top: -9999px !important;',
        '  opacity: 0 !important;',
        '  pointer-events: none !important;',
        '  overflow: hidden !important;',
        '}',

        /* В основном режиме видеоплеера делаем нижние кнопки в 2 свободных ряда и приподнимаем полосу перемотки */
        '#jennyVideoStudioRootV130:not(.compact-pip-v218) #v130BottomBar {',
        '  padding: 8px 10px 10px 10px !important;',
        '  gap: 8px !important;',
        '}',
        '#jennyVideoStudioRootV130:not(.compact-pip-v218) #v135BottomToolsRow {',
        '  display: grid !important;',
        '  grid-template-columns: repeat(4, 1fr) !important;',
        '  gap: 6px !important;',
        '  width: 100% !important;',
        '  overflow: visible !important;',
        '}',
        '#jennyVideoStudioRootV130:not(.compact-pip-v218) #v135BottomToolsRow .v130-btn {',
        '  width: 100% !important;',
        '  height: 34px !important;',
        '  padding: 0 6px !important;',
        '  font-size: 11.5px !important;',
        '}',

        /* В мини-плеере и на рабочем столе (compact-pip-v218):
           1) Никакого чёрного квадрата WebGL поверх видео на паузе!
           2) Верхняя шапка — в одну строку: слева/по центру капсула Развернуть с названием (до 2 строк), в самом правом верхнем углу крестик ✕! */
        '#jennyVideoStudioRootV130.compact-pip-v218 #jv166InterpCanvas {',
        '  display: none !important;',
        '}',
        '#jennyVideoStudioRootV130.compact-pip-v218 #jennyVideoElV130 {',
        '  display: block !important;',
        '  visibility: visible !important;',
        '  opacity: 1 !important;',
        '}',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v130TopDragBar {',
        '  display: flex !important;',
        '  flex-direction: row !important;',
        '  flex-wrap: nowrap !important;',
        '  align-items: flex-start !important;',
        '  justify-content: space-between !important;',
        '  padding: 4px 4px 2px 6px !important;',
        '  gap: 4px !important;',
        '}',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v130TopDragBar > div:first-child {',
        '  display: none !important;',
        '}',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v130TopDragBar > div:last-child {',
        '  flex: 1 1 100% !important;',
        '  width: 100% !important;',
        '  display: flex !important;',
        '  flex-direction: row !important;',
        '  flex-wrap: nowrap !important;',
        '  align-items: flex-start !important;',
        '  justify-content: space-between !important;',
        '  gap: 4px !important;',
        '}',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v130BtnPipToggle {',
        '  flex: 1 1 auto !important;',
        '  min-width: 0 !important;',
        '  height: auto !important;',
        '  min-height: 24px !important;',
        '  max-height: 36px !important;',
        '  padding: 3px 7px !important;',
        '  border-radius: 8px !important;',
        '  background: rgba(11, 24, 54, 0.90) !important;',
        '  border: 1.2px solid rgba(59, 130, 246, 0.72) !important;',
        '  color: #93c5fd !important;',
        '  display: inline-flex !important;',
        '  align-items: center !important;',
        '  justify-content: flex-start !important;',
        '  gap: 5px !important;',
        '  text-align: left !important;',
        '  white-space: normal !important;',
        '  overflow: hidden !important;',
        '}',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v130BtnPipToggle span {',
        '  font-size: 9.8px !important;',
        '  font-weight: 800 !important;',
        '  line-height: 1.18 !important;',
        '  color: #93c5fd !important;',
        '  display: -webkit-box !important;',
        '  -webkit-line-clamp: 2 !important;',
        '  -webkit-box-orient: vertical !important;',
        '  overflow: hidden !important;',
        '  text-overflow: ellipsis !important;',
        '  word-break: break-all !important;',
        '}',
        '#jennyVideoStudioRootV130.compact-pip-v218 .v130-btn-close-v217 {',
        '  width: 24px !important;',
        '  height: 24px !important;',
        '  min-width: 24px !important;',
        '  border-radius: 7px !important;',
        '  flex-shrink: 0 !important;',
        '  margin: 0 !important;',
        '}',

        /* Выпадающая шкала громкости (#volumePopup и #volumePopupDeckBV216) с кнопкой Mute 0% снизу */
        '#volumePopup, #volumePopupDeckBV216 {',
        '  bottom: 42px !important;',
        '  top: auto !important;',
        '  left: 0px !important;',
        '  right: auto !important;',
        '  padding: 12px 8px 10px 8px !important;',
        '  border-radius: 18px !important;',
        '  background: rgba(9, 13, 20, 0.97) !important;',
        '  gap: 10px !important;',
        '  z-index: 2147483640 !important;',
        '}',
        '#volumePopup {',
        '  border: 1.5px solid #a855f7 !important;',
        '  box-shadow: 0 10px 28px rgba(0,0,0,0.95), 0 0 14px rgba(168,85,247,0.35) !important;',
        '}',
        '#volumePopupDeckBV216 {',
        '  border: 1.5px solid #3b82f6 !important;',
        '  box-shadow: 0 10px 28px rgba(0,0,0,0.95), 0 0 14px rgba(59,130,246,0.35) !important;',
        '}',
        '#volumePopup.open, #volumePopup.show, #volumePopupDeckBV216.open, #volumePopupDeckBV216.show {',
        '  display: flex !important;',
        '}',
        '.jenny-vol-mute-btn-v219 {',
        '  width: 30px !important;',
        '  height: 28px !important;',
        '  padding: 0 !important;',
        '  border-radius: 9px !important;',
        '  display: inline-flex !important;',
        '  align-items: center !important;',
        '  justify-content: center !important;',
        '  cursor: pointer !important;',
        '  transition: all 0.12s ease !important;',
        '}'
    ].join('\n');
    document.head.appendChild(styleV219);
})();
/* ================= END JENNY_V219_UNIFIED_PATCH ================= */

/* ================= JENNY_V221_UNIFIED_PATCH (#315):
   1) FIX DESKTOP OVERLAY & IN-APP PLAYER LAYOUT (CLEAR INLINE PIP HEIGHT/WIDTH, ISOLATE OVERLAY DOM, RESTORE ROT90 FULLSCREEN - 71535.mp4)
   2) DESKTOP OVERLAY & MINI-PLAYER PINCH-ZOOM ASPECT RATIO LOCK + STRICT WINDOW-BOUND CONTROLS (71530.mp4)
   3) AUDIO-ONLY MODE "A" NO DESKTOP OVERLAY ON HOME SCREEN (71531.mp4)
   4) 2-ROW VIDEO PLAYER BOTTOM BAR & COMPACT 2-LINE LABELS (71532.mp4)
   5) 2-STAGE FAST-START + FULL-TRACK PRE-CACHED HARDWARE REVERSE FOR ALL AUDIO TRACKS WITHOUT BLACK SCREEN (71533.mp4)
================= */
/* [split] V221: кусок исходного IIFE (ui_v71.js, строки 25084–26033) → ui_styles.js */
;(function() {
    if (window._jennyV221Installed__styles) return;
    window._jennyV221Installed__styles = true;
    window._jennyV221Installed = true;

    // -------------------------------------------------------------------------
    // 1. СТИЛИ V221:
    //    - Жёсткая изоляция плавающего окна на рабочем столе (body.jenny-desktop-overlay-active-v221):
    //      прячем весь фон приложения (списки, деки, модалки), а #jennyVideoStudioRootV130 растягиваем строго на 100vw x 100vh!
    //    - Не ломаем .rot90-v130 в основном плеере (:not(.rot90-v130))!
    //    - Нижний ряд кнопок основного видеоплеера (#v135BottomToolsRow) строго в 2 просторных ряда!
    // -------------------------------------------------------------------------
    var styleV221 = document.createElement('style');
    styleV221.id = 'jennyStyleV221';
    styleV221.textContent = [
        /* Когда активен оверлей на рабочем столе — скрываем всё основное приложение под видеоплеером,
           чтобы при любом растягивании окна никогда не вылезали деки, списки или инспектор! */
        'body.jenny-desktop-overlay-active-v221 > *:not(#jennyVideoStudioRootV130) {',
        '  visibility: hidden !important;',
        '  pointer-events: none !important;',
        '}',
        'body.jenny-desktop-overlay-active-v221 {',
        '  background: #000000 !important;',
        '  overflow: hidden !important;',
        '}',

        /* В режиме оверлея на рабочем столе и в полном режиме #jennyVideoStudioRootV130 ВСЕГДА занимает 100% окна WebView */
        '#jennyVideoStudioRootV130.mode-desktop-v132,',
        '#jennyVideoStudioRootV130.mode-full-v130:not(.mode-pip-v130) {',
        '  position: fixed !important;',
        '  inset: 0 !important;',
        '  left: 0 !important;',
        '  top: 0 !important;',
        '  right: 0 !important;',
        '  bottom: 0 !important;',
        '  width: 100vw !important;',
        '  height: 100vh !important;',
        '  max-width: 100vw !important;',
        '  max-height: 100vh !important;',
        '  border-radius: 0 !important;',
        '  box-sizing: border-box !important;',
        '  overflow: hidden !important;',
        '}',

        /* Для не-повёрнутой на 90° сцены и HUD — строго 100% внутри корня плеера (а для .rot90-v130 оставляем его 100dvh x 100dvw!) */
        '#jennyVideoStudioRootV130 #jennyVideoStageV130:not(.rot90-v130),',
        '#jennyVideoStudioRootV130 #v130HudOverlay {',
        '  width: 100% !important;',
        '  height: 100% !important;',
        '  max-width: 100% !important;',
        '  max-height: 100% !important;',
        '  left: 0 !important;',
        '  top: 0 !important;',
        '  right: 0 !important;',
        '  bottom: 0 !important;',
        '  box-sizing: border-box !important;',
        '}',
        '#jennyVideoStudioRootV130 #v130TopDragBar,',
        '#jennyVideoStudioRootV130 #v130BottomBar {',
        '  width: 100% !important;',
        '  max-width: 100% !important;',
        '  box-sizing: border-box !important;',
        '}',

        /* В основном видеоплеере: нижние кнопки строго в 2 ряда (Grid), компактный шрифт и поддержка 2 строк текста внутри кнопки */
        '#jennyVideoStudioRootV130:not(.compact-pip-v218) #v135BottomToolsRow {',
        '  display: grid !important;',
        '  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;',
        '  gap: 6px !important;',
        '  width: 100% !important;',
        '  overflow: visible !important;',
        '  flex-wrap: wrap !important;',
        '}',
        '#jennyVideoStudioRootV130:not(.compact-pip-v218) #v135BottomToolsRow .v130-btn {',
        '  width: 100% !important;',
        '  min-width: 0 !important;',
        '  height: 36px !important;',
        '  padding: 2px 4px !important;',
        '  font-size: 10px !important;',
        '  line-height: 1.08 !important;',
        '  white-space: normal !important;',
        '  overflow: hidden !important;',
        '  display: inline-flex !important;',
        '  flex-direction: row !important;',
        '  align-items: center !important;',
        '  justify-content: center !important;',
        '  gap: 3px !important;',
        '  text-align: center !important;',
        '  box-sizing: border-box !important;',
        '}',
        '#jennyVideoStudioRootV130:not(.compact-pip-v218) #v135BottomToolsRow .v130-btn svg {',
        '  width: 13px !important;',
        '  height: 13px !important;',
        '  flex-shrink: 0 !important;',
        '}',
        '#jennyVideoStudioRootV130:not(.compact-pip-v218) #v135BottomToolsRow .v130-btn span {',
        '  font-size: 9.8px !important;',
        '  font-weight: 800 !important;',
        '  line-height: 1.06 !important;',
        '  white-space: normal !important;',
        '  word-break: keep-all !important;',
        '  overflow-wrap: anywhere !important;',
        '  text-align: center !important;',
        '}'
    ].join('\n');
    document.head.appendChild(styleV221);
})();
/* ================= END JENNY_V223_REVERSE_RAM_QUEUE_PATCH ================= */

/* ================= JENNY_V224_HUD_AND_HEADER_STABILITY_PATCH (#318):
   1) PREVENT VIDEO HUD OVERLAY (#v130HudOverlay) FROM AUTO-WAKING ON REVERSE CHUNK SWAPS OR BACKGROUND <video> EVENTS (71547.mp4 00:03-00:27)
   2) STOP TOP HEADER PINNED BUTTONS (#topHeaderCapsule / #jennySourcesHubBarV91) FROM SHAKING/JITTERING EVERY 750ms (71547.mp4 00:35-00:54)
================= */
/* [split] V224: кусок исходного IIFE (ui_v71.js, строки 26380–26627) → ui_styles.js */
;(function() {
    if (window._jennyV224Installed__styles) return;
    window._jennyV224Installed__styles = true;
    window._jennyV224Installed = true;

    // -------------------------------------------------------------------------
    // 1. ЖЁСТКАЯ ФИКСАЦИЯ ГЕОМЕТРИИ КНОПОК В ВЕРХНЕЙ ШАПКЕ (#topHeaderCapsule),
    //    ЧТОБЫ ОНИ НИКОГДА НЕ ДЁРГАЛИСЬ ОТ ПОЛЛЕРА БЕЙДЖЕЙ ИЛИ ТАЙМЕРОВ (71547.mp4 00:35-00:54)
    // -------------------------------------------------------------------------
    var styleV224 = document.createElement('style');
    styleV224.id = 'jennyStyleV224';
    styleV224.textContent = [
        '#topHeaderCapsule .jenny-icon-pill {',
        '  width: 28px !important;',
        '  min-width: 28px !important;',
        '  max-width: 28px !important;',
        '  height: 28px !important;',
        '  min-height: 28px !important;',
        '  max-height: 28px !important;',
        '  padding: 0 !important;',
        '  margin: 0 !important;',
        '  border-radius: 8px !important;',
        '  flex: 0 0 28px !important;',
        '  position: relative !important;',
        '  box-sizing: border-box !important;',
        '  transition: none !important;',
        '  transform: none !important;',
        '  overflow: visible !important;',
        '}',
        '#topHeaderCapsule #jennySourcesHubBarV91 {',
        '  display: inline-flex !important;',
        '  align-items: center !important;',
        '  gap: 3px !important;',
        '  flex-shrink: 0 !important;',
        '  transition: none !important;',
        '}',
        '.jenny-hdr-corner-badge-v224 {',
        '  position: absolute !important;',
        '  right: -3px !important;',
        '  bottom: -3px !important;',
        '  background: #090d14 !important;',
        '  border: 1px solid #3fb950 !important;',
        '  color: #3fb950 !important;',
        '  font-size: 8px !important;',
        '  font-weight: 900 !important;',
        '  font-family: monospace !important;',
        '  line-height: 1 !important;',
        '  padding: 1px 2.5px !important;',
        '  border-radius: 5px !important;',
        '  pointer-events: none !important;',
        '  z-index: 5 !important;',
        '  white-space: nowrap !important;',
        '}'
    ].join('\n');
    document.head.appendChild(styleV224);
})();

/* [split] V234: кусок исходного IIFE (ui_v71.js, строки 29556–29826) → ui_styles.js */
;(function() {
    if (window._jennyV234Installed__styles) return;
    window._jennyV234Installed__styles = true;
    window._jennyV234Installed = true;

    // 2. Inject CSS to stretch #exportModalV69 almost to top and bottom screen edges (96.5vh)
    var stV234 = document.createElement('style');
    stV234.id = 'jennyExportModalStyleV234';
    stV234.textContent = [
        '#exportModalV69.exp-modal-backdrop-v69 {',
        '  padding: 1.5vh 2vw !important;',
        '  align-items: center !important;',
        '  justify-content: center !important;',
        '}',
        '#exportModalV69 .exp-modal-window-v69 {',
        '  width: 96vw !important;',
        '  max-width: 480px !important;',
        '  height: 96.5vh !important;',
        '  max-height: 96.5vh !important;',
        '  margin: 0 auto !important;',
        '  display: flex !important;',
        '  flex-direction: column !important;',
        '  overflow: hidden !important;',
        '}',
        '#exportModalV69 .exp-modal-header-v69,',
        '#exportModalV69 .exp-modal-top-actions-v69,',
        '#exportModalV69 #expParamsPanelV234,',
        '#exportModalV69 .exp-modal-footer-v69 {',
        '  flex-shrink: 0 !important;',
        '}',
        '#exportModalV69 #expModalGridV69.exp-modal-grid-v69 {',
        '  flex: 1 1 auto !important;',
        '  min-height: 110px !important;',
        '  max-height: none !important;',
        '  overflow-y: auto !important;',
        '  align-content: start !important;',
        '  padding: 8px 10px !important;',
        '}',
        '.exp-sec-hdr-collapsible-v234 {',
        '  display: flex !important;',
        '  justify-content: space-between !important;',
        '  align-items: center !important;',
        '  padding: 5px 8px !important;',
        '  border-radius: 7px !important;',
        '  cursor: pointer !important;',
        '  user-select: none !important;',
        '  -webkit-user-select: none !important;',
        '  transition: background 0.15s ease !important;',
        '}',
        '.exp-sec-hdr-collapsible-v234:active {',
        '  transform: scale(0.99) !important;',
        '}'
    ].join('\n');
    document.head.appendChild(stV234);
})();
/* ================= END JENNY_V234_EXPORT_MODAL_FULLHEIGHT_COLLAPSIBLE_AND_XFLAC15_DEFAULT_PATCH ================= */

/* ================= JENNY_V235_LANG_SEARCH_SLOT_REFRESH_SWAP_AND_PLAY_HOLD_LOCATE_PATCH (#334 / V235):
   1) INITIAL PLACEMENT OF RU/EN (#mainLangToggleBtn) RIGHT NEXT TO SEARCH BAR (#trackSearchInput) (71999.jpg)
   2) REDESIGNED ESCAPE TRAJECTORY FROM SEARCH BAR SLOT UP INTO SETTINGS GEAR (⚙️) + DOCKING INTO #jennyTopBarRow NEXT TO GUIDE/MANUAL:
      - If never clicked (!window._langTouchedByUser): buzzes every 10s, then at 30s stands on legs (.runaway-actor), sprints along the search bar & flips into ⚙️
      - If clicked at least once (window._langTouchedByUser): stops buzzing, then at 30s turns into a caterpillar (.crawler-actor), turns head up (-90°), crawls up to header & into ⚙️
   3) ANIMATED SWAP OF REFRESH BUTTONS (🔄 30 & 🔄 887) WHEN RU/EN LEAVES + IMMEDIATE EXPANSION OF DECK TRANSPORT BUTTONS (71999.jpg & 72001.jpg):
      - Old refresh buttons in Deck B (#btnRefreshDeckBV216) and Deck A (#btnRefreshDeckAV235) smoothly shrink & vanish from under the decks
      - Transport buttons under both decks immediately expand to fill the vacated space:
        60% of freed space goes to transport buttons -> Prev (+30% width), Play/Pause (+15% width), Next (+30% width)
      - Refresh buttons pop with spring animation into the vacated slot right next to #trackSearchInput
   4) LONG-PRESS (HOLD) ON MAIN PLAY/PAUSE BUTTONS UNDER DECK A (#playPauseBtn) & DECK B (#playPauseBtnDeckBV216):
      - Opens the active playlist of the currently playing audio/video and highlights + scrolls to that track/video WITHOUT pausing it!
================= */
/* [split] V235: кусок исходного IIFE (ui_v71.js, строки 29842–30652) → ui_styles.js */
;(function() {
    if (window._jennyV235Installed__styles) return;
    window._jennyV235Installed__styles = true;
    window._jennyV235Installed = true;

    // -------------------------------------------------------------------------
    // 1. CSS FOR SEARCH BAR RIGHT SLOT, ANIMATED REFRESH SWAP, DECK BUTTON EXPANSION & PLAYLIST LOCATE PULSE
    // -------------------------------------------------------------------------
    var stV235 = document.createElement('style');
    stV235.id = 'jennyStyleV235';
    stV235.textContent = [
        /* Keep #trackSearchInput.parentElement as a single flex row so mountPlaylistStripDOMV71 inserts below it */
        '.jenny-search-wrap-v73.jenny-search-flex-row-v235 {',
        '  display: flex !important;',
        '  align-items: center !important;',
        '  gap: 6px !important;',
        '  width: 100% !important;',
        '  box-sizing: border-box !important;',
        '  position: relative !important;',
        '}',
        '.jenny-search-wrap-v73.jenny-search-flex-row-v235 #trackSearchInput {',
        '  flex: 1 1 auto !important;',
        '  min-width: 0 !important;',
        '  width: auto !important;',
        '  box-sizing: border-box !important;',
        '}',
        '.jenny-search-wrap-v73.jenny-search-flex-row-v235 #btnClearTrackSearchV73 {',
        '  position: relative !important;',
        '  right: auto !important;',
        '  top: auto !important;',
        '  transform: none !important;',
        '  margin-left: -32px !important;',
        '  margin-right: 2px !important;',
        '  z-index: 3 !important;',
        '  flex-shrink: 0 !important;',
        '}',
        '#searchRightSlotV235 {',
        '  display: inline-flex !important;',
        '  align-items: center !important;',
        '  justify-content: flex-end !important;',
        '  gap: 5px !important;',
        '  flex-shrink: 0 !important;',
        '  min-height: 34px !important;',
        '}',
        '#searchRightSlotV235 #mainLangToggleBtn {',
        '  height: 34px !important;',
        '  padding: 0 10px !important;',
        '  border-radius: 8px !important;',
        '  display: inline-flex !important;',
        '  align-items: center !important;',
        '  justify-content: center !important;',
        '  white-space: nowrap !important;',
        '  font-size: 11.5px !important;',
        '  box-sizing: border-box !important;',
        '}',

        /* Animation for old Refresh buttons vanishing from bottom deck rows (per-deck flex lives in deck_a_isolated.css & deck_b_isolated.css) */
        '.jenny-ref-btn-vacating-v235 {',
        '  flex: 0 0 0px !important;',
        '  max-width: 0px !important;',
        '  min-width: 0px !important;',
        '  width: 0px !important;',
        '  padding: 0 !important;',
        '  margin: 0 !important;',
        '  border-width: 0 !important;',
        '  opacity: 0 !important;',
        '  transform: scale(0.15) translateY(-18px) !important;',
        '  overflow: hidden !important;',
        '  pointer-events: none !important;',
        '}',

        /* Pop-in animation & styling for Refresh buttons when they appear next to Search bar */
        '@keyframes jennyRefPopInTopV235 {',
        '  0%   { transform: translateY(16px) scale(0.22); opacity: 0; filter: drop-shadow(0 0 14px #58a6ff); }',
        '  62%  { transform: translateY(-2px) scale(1.09); opacity: 1; }',
        '  84%  { transform: translateY(1px) scale(0.97); opacity: 1; }',
        '  100% { transform: translateY(0) scale(1); opacity: 1; }',
        '}',
        '#searchRightSlotV235 .jenny-top-ref-pill-v235 {',
        '  height: 34px !important;',
        '  padding: 0 9px !important;',
        '  border-radius: 8px !important;',
        '  display: inline-flex !important;',
        '  align-items: center !important;',
        '  justify-content: center !important;',
        '  gap: 4px !important;',
        '  font-size: 11px !important;',
        '  font-weight: 800 !important;',
        '  cursor: pointer !important;',
        '  user-select: none !important;',
        '  white-space: nowrap !important;',
        '  box-sizing: border-box !important;',
        '  flex: 0 0 auto !important;',
        '  width: auto !important;',
        '  min-width: 48px !important;',
        '  animation: jennyRefPopInTopV235 0.48s cubic-bezier(0.22, 1.35, 0.36, 1) forwards !important;',
        '}',
        '#searchRightSlotV235 .jenny-top-ref-pill-v235.ref-audio-v235 {',
        '  background: rgba(24, 12, 46, 0.94) !important;',
        '  border: 1.3px solid rgba(168, 85, 247, 0.75) !important;',
        '  color: #c084fc !important;',
        '  box-shadow: 0 2px 6px rgba(0,0,0,0.55), inset 0 1px 2px rgba(192,132,252,0.18) !important;',
        '}',
        '#searchRightSlotV235 .jenny-top-ref-pill-v235.ref-audio-v235 svg {',
        '  stroke: #c084fc !important;',
        '}',
        '#searchRightSlotV235 .jenny-top-ref-pill-v235.ref-audio-v235 #tracksCount {',
        '  color: #c084fc !important;',
        '  font-size: 11px !important;',
        '  font-weight: 800 !important;',
        '}',
        '#searchRightSlotV235 .jenny-top-ref-pill-v235.ref-video-v235 {',
        '  background: rgba(11, 24, 54, 0.94) !important;',
        '  border: 1.3px solid rgba(59, 130, 246, 0.78) !important;',
        '  color: #60a5fa !important;',
        '  box-shadow: 0 2px 6px rgba(0,0,0,0.55), inset 0 1px 2px rgba(96,165,250,0.18) !important;',
        '}',
        '#searchRightSlotV235 .jenny-top-ref-pill-v235.ref-video-v235 svg {',
        '  stroke: #60a5fa !important;',
        '}',
        '#searchRightSlotV235 .jenny-top-ref-pill-v235.ref-video-v235 #tracksCountDeckBV216 {',
        '  color: #60a5fa !important;',
        '  font-size: 11px !important;',
        '  font-weight: 800 !important;',
        '}',

        /* Vivid pulsing highlight when locating currently playing Audio or Video via Play/Pause Hold */
        '@keyframes jennyLocateAudioPulseV235 {',
        '  0%   { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.9), inset 0 0 18px rgba(63, 185, 80, 0.65); transform: scale(1.015); }',
        '  50%  { box-shadow: 0 0 22px 4px rgba(168, 85, 247, 0.85), inset 0 0 22px rgba(168, 85, 247, 0.55); transform: scale(1.02); }',
        '  100% { box-shadow: 0 0 12px rgba(115, 65, 190, 0.5); transform: scale(1); }',
        '}',
        '@keyframes jennyLocateVideoPulseV235 {',
        '  0%   { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.95), inset 0 0 18px rgba(88, 166, 255, 0.65); transform: scale(1.015); }',
        '  50%  { box-shadow: 0 0 22px 4px rgba(59, 130, 246, 0.88), inset 0 0 22px rgba(59, 130, 246, 0.55); transform: scale(1.02); }',
        '  100% { box-shadow: 0 0 12px rgba(59, 130, 246, 0.5); transform: scale(1); }',
        '}',
        '.track-row-capsule.jenny-hold-locate-audio-v235 {',
        '  border: 2px solid #c084fc !important;',
        '  background: linear-gradient(90deg, rgba(126, 34, 206, 0.34), rgba(63, 185, 80, 0.18)) !important;',
        '  animation: jennyLocateAudioPulseV235 0.85s ease-in-out 3 !important;',
        '}',
        '#playPauseBtn *, #playPauseBtnDeckBV216 * { pointer-events: none !important; }',
        '.track-row-capsule.jenny-hold-locate-video-v235 {',
        '  border: 2px solid #60a5fa !important;',
        '  background: linear-gradient(90deg, rgba(37, 99, 235, 0.36), rgba(56, 189, 248, 0.18)) !important;',
        '  animation: jennyLocateVideoPulseV235 0.85s ease-in-out 3 !important;',
        '}'
    ].join('\n');
    document.head.appendChild(stV235);
})();
/* ================= END JENNY_V235_LANG_SEARCH_SLOT_REFRESH_SWAP_AND_PLAY_HOLD_LOCATE_PATCH ================= */

/* ================= JENNY_V236_TORRENT_FOOTER_PIN_LOCK_AND_BOTTOM_HELP_ROW_PATCH (#335 / V236):
   1) SCREEN 1 (72006.jpg): RESTORE MISSING TORRENT STUDIO BOTTOM BLOCK (#torFooterBarV96) WITH DOWNLOAD BUTTON +
      LIVE NETWORK DOWNLOAD PROGRESS & LIVE .xFLAC TRANSCODING PROGRESS (WHEN DOWNLOADING WAV/FLAC):
      - Fix modal flex heights (#jennyTorrentModalV91 .jenny-modal-card-v71 & #torBodyListV96) so #torFooterBarV96 is NEVER clipped off the bottom
      - Always keep #torFooterBarV96 visible in 'files' mode with live download % bar (#torTotalProgWrapV97) and live xFLAC compression % bar (#torXflacProgWrapV99)
      - Fetch both /api/torrent/status and /api/sources/live_badges in refreshTorrentDaemonSnapV128 so _lastTorEncBadgeV212 (xFLAC encoding telemetry) is live
      - Preserve xFLAC compression status on individual file rows (#torFileProgV96_*) during 500ms row highlight updates
   2) SCREEN 2 (72008.jpg): INDESTRUCTIBLE SAVING OF [+] / [ВКЛ] PINNED SOURCES & FREEZE HEADER/LIST RE-RENDERS UNTIL USER CLICKS [+] / [ВКЛ]:
      - Dedicated localStorage lock 'jenny_pinned_sources_locked_v236' + immediate sync to ytm_config, /api/user_data/sync, and /api/config/save_all
      - Prevent loadConfigFromDisk / loadPersistentUserDataV218 / preset loaders from overwriting user's pinnedSourcesV91
      - Block all background/polling re-renders of #jennySourcesHubBarV91 and #jennySourcesDropMenuV91 after initial build; rebuild ONLY on explicit user click on [+] / [ВКЛ]
   3) SCREENS 3 & 4 (72010.jpg & 72012.jpg): MOVE [🧭 Гид] AND [🙈 Скрыть все справочные материалы] TO ONE SINGLE ROW WITH
      [📖 СПРАВОЧНИК НАСТРОЕК (❓)] AT THE VERY BOTTOM OF SETTINGS (#jennyBottomGuideSlotV165) WHEN HELP IS HIDDEN:
      - Triggered both from the introductory onboarding prompt (#onb_hideHelpChkV165) and from the Settings checkbox (#cfg_hideHelpV62)
      - Places [📖 Справочник (❓)], [🧭 Гид], and [☑ 🙈 Справки] on one single horizontal row at the end of Settings when hideHelpBadges is true, and restores them to the top when unchecked
================= */
/* [split] V236: кусок исходного IIFE (ui_v71.js, строки 30671–31598) → ui_styles.js */
;(function() {
    if (window._jennyV236Installed__styles) return;
    window._jennyV236Installed__styles = true;
    window._jennyV236Installed = true;

    // -------------------------------------------------------------------------
    // 1. CSS FOR TORRENT MODAL FOOTER VISIBILITY & COMPACT BOTTOM HELP ROW
    // -------------------------------------------------------------------------
    var stV236 = document.createElement('style');
    stV236.id = 'jennyStyleV236';
    stV236.textContent = [
        /* Force Torrent Studio modal card to use full 94vh flex column so #torFooterBarV96 never gets clipped off the bottom */
        '#jennyTorrentModalV91 .jenny-modal-card-v71 {',
        '  height: 94vh !important;',
        '  max-height: 94vh !important;',
        '  display: flex !important;',
        '  flex-direction: column !important;',
        '  overflow: hidden !important;',
        '  box-sizing: border-box !important;',
        '}',
        '#jennyTorrentModalV91 .jenny-modal-hdr-v71 {',
        '  flex-shrink: 0 !important;',
        '  padding: 7px 10px !important;',
        '}',
        '#jennyTorrentModalV91 #torP2pCoreSwitchBoxV139 {',
        '  padding: 5px 8px !important;',
        '  margin-bottom: 2px !important;',
        '  gap: 4px !important;',
        '}',
        '#jennyTorrentModalV91 #torFilterPillsBarV99 {',
        '  gap: 4px !important;',
        '  margin: 1px 0 !important;',
        '}',
        '#jennyTorrentModalV91 #torBodyListV96 {',
        '  flex: 1 1 0px !important;',
        '  min-height: 80px !important;',
        '  max-height: none !important;',
        '  overflow-y: auto !important;',
        '  padding: 7px 10px !important;',
        '}',
        '#jennyTorrentModalV91 #torFooterBarV96 {',
        '  flex-shrink: 0 !important;',
        '  z-index: 20 !important;',
        '  padding: 8px 10px !important;',
        '  border-top: 1px solid #30363d !important;',
        '  background: #090c10 !important;',
        '  gap: 6px !important;',
        '  box-sizing: border-box !important;',
        '}',
        /* Bottom single-row slot in Settings for [📖 Справочник (❓)] + [🧭 Гид] + [☑ 🙈 Справки] */
        '#jennyBottomGuideSlotV165.jenny-bottom-help-row-v236 {',
        '  display: flex !important;',
        '  flex-direction: row !important;',
        '  align-items: stretch !important;',
        '  justify-content: space-between !important;',
        '  gap: 6px !important;',
        '  width: 100% !important;',
        '  box-sizing: border-box !important;',
        '  margin-top: 14px !important;',
        '  margin-bottom: 18px !important;',
        '  padding-top: 10px !important;',
        '  border-top: 1px dashed #30363d !important;',
        '}',
        '#jennyBottomGuideSlotV165.jenny-bottom-help-row-v236 #jennyFullGuideBtn {',
        '  flex: 1 1 auto !important;',
        '  width: auto !important;',
        '  min-width: 0 !important;',
        '  padding: 8px 8px !important;',
        '  font-size: 11.5px !important;',
        '  white-space: nowrap !important;',
        '  overflow: hidden !important;',
        '  text-overflow: ellipsis !important;',
        '  margin: 0 !important;',
        '}',
        '#jennyBottomGuideSlotV165.jenny-bottom-help-row-v236 #jennyOpenOnboardingBtnV165 {',
        '  flex: 0 0 auto !important;',
        '  padding: 0 10px !important;',
        '  font-size: 11.5px !important;',
        '  white-space: nowrap !important;',
        '  margin: 0 !important;',
        '  display: inline-flex !important;',
        '  align-items: center !important;',
        '  justify-content: center !important;',
        '}',
        '#jennyBottomGuideSlotV165.jenny-bottom-help-row-v236 #hideHelpRowV62 {',
        '  flex: 0 0 auto !important;',
        '  width: auto !important;',
        '  margin: 0 !important;',
        '  padding: 0 9px !important;',
        '  border-radius: 8px !important;',
        '  background: #161b22 !important;',
        '  border: 1px solid #30363d !important;',
        '  display: inline-flex !important;',
        '  align-items: center !important;',
        '  justify-content: center !important;',
        '  box-sizing: border-box !important;',
        '}',
        '#jennyBottomGuideSlotV165.jenny-bottom-help-row-v236 #hideHelpRowV62 label {',
        '  display: inline-flex !important;',
        '  align-items: center !important;',
        '  gap: 5px !important;',
        '  width: auto !important;',
        '  margin: 0 !important;',
        '  font-size: 11.5px !important;',
        '  font-weight: 800 !important;',
        '  color: #e6edf3 !important;',
        '  white-space: nowrap !important;',
        '  cursor: pointer !important;',
        '}'
    ].join('\n');
    document.head.appendChild(stV236);
})();
/* ================= END JENNY_V236_TORRENT_FOOTER_PIN_LOCK_AND_BOTTOM_HELP_ROW_PATCH ================= */

/* ================= JENNY_V237_KILL_SWITCH_ZERO_TWITCH_INSTANT_FOLDERS_DATASYNC_AND_EXT_PAUSE_PATCH (#336 / V237) ================= */
/* [split] V237: кусок исходного IIFE (ui_v71.js, строки 31602–32550) → ui_styles.js */
;(function() {
    if (window._jennyV237Installed__styles) return;
    window._jennyV237Installed__styles = true;
    window._jennyV237Installed = true;

    // -------------------------------------------------------------------------
    // 1. CSS FOR ZERO-TWITCH TORRENT FILE CARDS (FIXED GEOMETRY + FILL LAYER)
    // -------------------------------------------------------------------------
    var stV237 = document.createElement('style');
    stV237.id = 'jennyStyleV237';
    stV237.textContent = [
        '.tor-file-row-v237 {',
        '  position: relative !important;',
        '  flex-shrink: 0 !important;',
        '  overflow: hidden !important;',
        '  display: flex !important;',
        '  align-items: center !important;',
        '  gap: 8px !important;',
        '  padding: 7px 9px !important;',
        '  background: #0b0f16 !important;',
        '  border: 1px solid #21262d;',
        '  border-radius: 8px !important;',
        '  box-sizing: border-box !important;',
        '  contain: layout style !important;',
        '}',
        '.tor-row-fill-layer-v237 {',
        '  position: absolute !important;',
        '  left: 0 !important;',
        '  top: 0 !important;',
        '  bottom: 0 !important;',
        '  width: 0%;',
        '  pointer-events: none !important;',
        '  z-index: 0 !important;',
        '  transition: width 0.25s linear !important;',
        '}',
        '.tor-row-content-v237 {',
        '  position: relative !important;',
        '  z-index: 1 !important;',
        '  display: flex !important;',
        '  align-items: center !important;',
        '  gap: 8px !important;',
        '  width: 100% !important;',
        '  min-width: 0 !important;',
        '}',
        '.tor-row-meta-line-v237 {',
        '  display: flex !important;',
        '  align-items: center !important;',
        '  gap: 6px !important;',
        '  height: 19px !important;',
        '  min-height: 19px !important;',
        '  max-height: 19px !important;',
        '  line-height: 19px !important;',
        '  margin-top: 2px !important;',
        '  white-space: nowrap !important;',
        '  overflow: hidden !important;',
        '  text-overflow: ellipsis !important;',
        '  font-size: 10.5px !important;',
        '}'
    ].join('\n');
    document.head.appendChild(stV237);
})();

/* [split] V239: кусок исходного IIFE (ui_v71.js, строки 32914–32975) → ui_styles.js */
;(function() {

    // 2. Ensure torrent file rows never shrink inside flex scroll container (#torBodyListV96)
    var stV239 = document.createElement('style');
    stV239.id = 'jennyStyleV239';
    stV239.textContent = [
        '.tor-file-row-v237 {',
        '  flex-shrink: 0 !important;',
        '  min-height: 50px !important;',
        '}'
    ].join('\n');
    document.head.appendChild(stV239);
})();
/* ================= END JENNY_V241_ISOLATED_STUDIO_MINI_PLAYERS_PATCH ================= */


/* ================= BEGIN JENNY_V242_HUB_PILLS_IMMERSIVE_DOCK_FLEX_SEARCH_AND_RADIO_BUF_PATCH ================= */
/* [split] V242: кусок исходного IIFE (ui_v71.js, строки 33743–34878) → ui_styles.js */
;(function() {
    if (window._jennyV242Installed__styles) return;
    window._jennyV242Installed__styles = true;
    window._jennyV242Installed = true;

    // -------------------------------------------------------------------------
    // 1. EDGE-TO-EDGE DOCK COMPACTION, FULL-WIDTH SETTINGS TELEMETRY,
    //    DYNAMIC FLEX SEARCH ROW & STRICT SETTINGS RU/EN HIDING (CSS + OBSERVER)
    // -------------------------------------------------------------------------
    var stV242 = document.createElement('style');
    stV242.id = 'jennyStyleV242';
    stV242.textContent = [
        /* Eliminate ~54px dead space at bottom of #bottomPlayerDock */
        '#bottomPlayerDock.sticky-bottom, .sticky-bottom {',
        '  height: auto !important;',
        '  min-height: 0 !important;',
        '  bottom: 0 !important;',
        '  padding: 6px 12px 6px 12px !important;',
        '}',
        '#bottomPlayerDock #subDockBar {',
        '  display: none !important;',
        '  height: 0 !important;',
        '  margin: 0 !important;',
        '  padding: 0 !important;',
        '}',
        '#bottomPlayerDock #deckAProgressRow {',
        '  margin-bottom: 5px !important;',
        '}',
        '#bottomPlayerDock #deckBProgressRow {',
        '  margin-bottom: 5px !important;',
        '}',
        '#bottomPlayerDock #deckBControlsRowV216 {',
        '  margin-bottom: 5px !important;',
        '}',

        /* True dynamic flex Search bar: fills 100% remaining width minus gap */
        '.jenny-search-wrap-v73.jenny-search-flex-row-v235 {',
        '  display: flex !important;',
        '  flex-direction: row !important;',
        '  align-items: center !important;',
        '  gap: 6px !important;',
        '  width: 100% !important;',
        '  box-sizing: border-box !important;',
        '}',
        '.jenny-search-wrap-v73.jenny-search-flex-row-v235 #trackSearchInput {',
        '  flex: 1 1 0% !important;',
        '  min-width: 0 !important;',
        '  width: auto !important;',
        '  max-width: 100% !important;',
        '}',
        '#searchRightSlotV235 {',
        '  flex: 0 0 auto !important;',
        '  display: inline-flex;',
        '  align-items: center !important;',
        '  justify-content: flex-end !important;',
        '  gap: 5px !important;',
        '}',
        '#searchRightSlotV235.jenny-slot-hidden-in-modal-v242 {',
        '  display: none !important;',
        '}',

        /* Stretch DSP telemetry monitor 100% across row when Settings / EQ / Spec modal is open */
        '#topAutoCeilMonitor {',
        '  flex: 1 1 100% !important;',
        '  width: 100% !important;',
        '  max-width: 100% !important;',
        '  min-width: 0 !important;',
        '  box-sizing: border-box !important;',
        '}',

        /* Strict hiding of docked RU/EN button inside Settings until it actually jumps into Settings! */
        'body:not(.jenny-lang-docked-ready-v242) #settingsDockedLangBtn {',
        '  display: none !important;',
        '}',

        /* Studio Header Download / Recording Pill styling (matching Torrent Studio P2P pill) */
        '.jenny-studio-dl-pill-v242 {',
        '  padding: 4px 8px !important;',
        '  font-size: 10.5px !important;',
        '  border-radius: 8px !important;',
        '  font-weight: 900 !important;',
        '  display: inline-flex !important;',
        '  align-items: center !important;',
        '  justify-content: center !important;',
        '  gap: 4px !important;',
        '  cursor: pointer !important;',
        '  line-height: 1.2 !important;',
        '  white-space: nowrap !important;',
        '  flex-shrink: 0 !important;',
        '}'
    ].join('\n');
    document.head.appendChild(stV242);
})();

/* [split] V243: кусок исходного IIFE (ui_v71.js, строки 35225–35944) → ui_styles.js */
;(function() {
    if (window._jennyV243Installed__styles) return;
    window._jennyV243Installed__styles = true;
    window._jennyV243Installed = true;

    // -------------------------------------------------------------------------
    // 1. БЕЗОПАСНЫЕ ОТСТУПЫ ПОД КАМЕРУ И НИЖНИЙ БАР ANDROID (ЧЁРНЫЙ ФОН #000000)
    //    + АВТОРАСТЯГИВАНИЕ СТРОКИ ПОИСКА + ШАПКА РАДИО БЕЗ НАЛОЖЕНИЯ КНОПОК
    // -------------------------------------------------------------------------
    var styleV243 = document.createElement('style');
    styleV243.id = 'jennyStyleV243';
    styleV243.textContent = [
        ':root {',
        '  --jenny-safe-top: 28px;',
        '  --jenny-safe-bottom: 22px;',
        '}',
        'html, body {',
        '  background-color: #000000 !important;',
        '}',
        'body:not(.jenny-desktop-overlay-active-v221) {',
        '  padding-top: var(--jenny-safe-top, 28px) !important;',
        '  padding-bottom: var(--jenny-safe-bottom, 22px) !important;',
        '  box-sizing: border-box !important;',
        '  max-height: 100dvh !important;',
        '}',
        '.modal-overlay, .jenny-modal-backdrop-v71 {',
        '  padding-top: calc(var(--jenny-safe-top, 28px) + 6px) !important;',
        '  padding-bottom: calc(var(--jenny-safe-bottom, 22px) + 6px) !important;',
        '  box-sizing: border-box !important;',
        '}',
        '#jennyOmniLogViewerV139 {',
        '  top: calc(var(--jenny-safe-top, 28px) + 8px) !important;',
        '  bottom: calc(var(--jenny-safe-bottom, 22px) + 8px) !important;',
        '}',
        '#jennySourcesDropMenuV91 {',
        '  top: calc(var(--jenny-safe-top, 28px) + 46px) !important;',
        '}',
        '#jennyVideoStudioRootV130:not(.compact-pip-v218):not(.audio-only-hidden-v219) #jennyVideoStageV130:not(.rot90-v130) #v130TopDragBar {',
        '  padding-top: calc(var(--jenny-safe-top, 0px) + 8px) !important;',
        '}',
        '#jennyVideoStudioRootV130:not(.compact-pip-v218):not(.audio-only-hidden-v219) #jennyVideoStageV130:not(.rot90-v130) #v130BottomBar {',
        '  padding-bottom: calc(var(--jenny-safe-bottom, 0px) + 10px) !important;',
        '}',

        /* Авторастягивание поля поиска на 100% свободной ширины до соседних кнопок */
        '#searchInput {',
        '  flex: 1 1 auto !important;',
        '  width: auto !important;',
        '  min-width: 0 !important;',
        '  max-width: none !important;',
        '  box-sizing: border-box !important;',
        '}',

        /* Исправление наложения кнопок в шапке окна РАДИОЭФИР */
        '#jennyFlacRadioModalV91 .jenny-modal-hdr-v71 {',
        '  display: flex !important;',
        '  flex-wrap: wrap !important;',
        '  align-items: center !important;',
        '  justify-content: space-between !important;',
        '  gap: 6px !important;',
        '  padding: 8px 10px !important;',
        '  height: auto !important;',
        '}',
        '#jennyFlacRadioModalV91 .jenny-modal-hdr-v71 button {',
        '  padding: 4px 8px !important;',
        '  font-size: 10.5px !important;',
        '  flex-shrink: 0 !important;',
        '  position: static !important;',
        '  margin: 0 !important;',
        '}',

        /* Полупрозрачные зоны Пред./След. под кнопками -10 и +10 в видеоплеере */
        '#v243VideoPrevNextRow {',
        '  display: flex;',
        '  align-items: center;',
        '  justify-content: center;',
        '  gap: 22px;',
        '  margin-top: 12px;',
        '  pointer-events: none;',
        '  z-index: 12;',
        '}',
        '#jennyVideoStudioRootV130.compact-pip-v218 #v243VideoPrevNextRow,',
        '#v130HudOverlay.hud-hidden-v130 #v243VideoPrevNextRow {',
        '  display: none !important;',
        '}',
        '.v243-vid-adj-zone {',
        '  pointer-events: auto !important;',
        '  min-width: 96px !important;',
        '  height: 40px !important;',
        '  padding: 0 12px !important;',
        '  border-radius: 13px !important;',
        '  background: rgba(11, 24, 54, 0.34) !important;',
        '  border: 1px solid rgba(96, 165, 250, 0.32) !important;',
        '  color: rgba(219, 234, 254, 0.84) !important;',
        '  backdrop-filter: blur(3px) !important;',
        '  -webkit-backdrop-filter: blur(3px) !important;',
        '  display: inline-flex !important;',
        '  align-items: center !important;',
        '  justify-content: center !important;',
        '  gap: 5px !important;',
        '  font-size: 11px !important;',
        '  font-weight: 800 !important;',
        '  cursor: pointer !important;',
        '  user-select: none !important;',
        '  transition: background 0.14s ease, transform 0.1s ease !important;',
        '}',
        '.v243-vid-adj-zone:active {',
        '  background: rgba(37, 99, 235, 0.58) !important;',
        '  transform: scale(0.94) !important;',
        '}'
    ].join('\n');
    document.head.appendChild(styleV243);
})();

/* [split] V244: кусок исходного IIFE (ui_v71.js, строки 35948–35969) → ui_styles.js */
;(function() {

    var st = document.getElementById('jennyStyleV244Clean');
    if (!st) {
        st = document.createElement('style');
        st.id = 'jennyStyleV244Clean';
        document.head.appendChild(st);
    }
    st.textContent = [
        ':root { --jenny-safe-top: 0px !important; --jenny-safe-bottom: 0px !important; }',
        'html, body { background-color: #000000 !important; padding-top: 0px !important; padding-bottom: 0px !important; }',
        '.modal-overlay { padding-top: 15px !important; padding-bottom: 15px !important; }',
        '.jenny-modal-backdrop-v71 { padding: 14px !important; }',
        '#jennySourcesDropMenuV91 { top: 48px !important; }'
    ].join('\n');
})();

/* [split] V360: кусок исходного IIFE (ui_v71.js, строки 35973–36584) → ui_styles.js */
;(function() {
    if (window._jennyV360ClockAndModalPatchInstalled__styles) return;
    window._jennyV360ClockAndModalPatchInstalled__styles = true;
    window._jennyV360ClockAndModalPatchInstalled = true;

    // 5. ИДЕМПОТЕНТНАЯ СИНХРОНИЗАЦИЯ ВЫСОТЫ ШАПКИ И МОДАЛОК ДЕКИ А + ДЕКИ Б БЕЗ MUTATIONOBSERVER PING-PONG LOOP (74920.mp4 01:55)!
    //    В ui_v71.js:1092 и ui_help.js:403 висят два MutationObserver с attributeFilter: ['class', 'style'] на settingsModal/eqModal.
    //    Если при открытии #settingsModalDeckB или #eqModalDeckB старый код ставил top: 142px, а новый — top: 104px,
    //    оба MutationObserver бесконечно перезапускали друг друга в очереди микрозадач (100% CPU freeze).
    //    Решение: единые идемпотентные функции, которые меняют style только при реальном изменении значения!
    var stModalZ = document.createElement('style');
    stModalZ.id = 'jennyModalZIndexFixV360';
    stModalZ.textContent = [
        '#settingsModal.open, #eqModal.open, #specModal.open, #favModal.open, #themeModal.open,',
        '#settingsModalDeckB.open, #eqModalDeckB.open, #specModalDeckB.open {',
        '  z-index: 2147483646 !important;',
        '  opacity: 1 !important;',
        '  pointer-events: auto !important;',
        '}',
        'body.jenny-any-modal-open-v360 #jennyVideoStudioRootV130.mode-pip-v130 {',
        '  z-index: 2400 !important;',
        '  opacity: 0.12 !important;',
        '  pointer-events: none !important;',
        '}'
    ].join('\n');
    document.head.appendChild(stModalZ);
})();

/* [split] V369: кусок исходного IIFE (ui_v71.js, строки 36607–37839) → ui_styles.js */
;(function() {
    if (window._jennyV369Installed__styles) return;
    window._jennyV369Installed__styles = true;
    window._jennyV369Installed = true;

    // 2. CSS: Guarantee 100% hiding of ALL HUD bars, #v135BottomToolsRow, and the A/V Sync edge tab when HUD is hidden!
    var stV369 = document.createElement('style');
    stV369.id = 'jennyStyleV369HudAndAvTab';
    stV369.textContent = [
        '#v130HudOverlay.hud-hidden-v130,',
        '#v130HudOverlay.hud-hidden-v130 #v130TopDragBar,',
        '#v130HudOverlay.hud-hidden-v130 #v130BottomBar,',
        '#v130HudOverlay.hud-hidden-v130 #v135BottomToolsRow,',
        '#v130HudOverlay.hud-hidden-v130 #jennyAvSyncEdgePillV368,',
        '#jennyVideoStudioRootV130.jv210-controls-hidden #jennyAvSyncEdgePillV368,',
        '#jennyVideoStudioRootV130.compact-pip-v218 #jennyAvSyncEdgePillV368 {',
        '  opacity: 0 !important;',
        '  visibility: hidden !important;',
        '  pointer-events: none !important;',
        '}',
        '#jennyAvSyncEdgePillV368 {',
        '  position: absolute;',
        '  right: 8px;',
        '  top: 54px;',
        '  z-index: 99996;',
        '  display: flex;',
        '  flex-direction: column;',
        '  align-items: flex-end;',
        '  gap: 4px;',
        '  pointer-events: auto;',
        '  user-select: none;',
        '  -webkit-user-select: none;',
        '  transition: opacity 0.18s ease;',
        '}',
        '#jennyAvSyncEdgePillBtnV368 {',
        '  display: inline-flex;',
        '  align-items: center;',
        '  gap: 5px;',
        '  padding: 4px 10px;',
        '  border-radius: 14px;',
        '  background: rgba(9, 15, 26, 0.90);',
        '  border: 1.5px solid #3b82f6;',
        '  color: #93c5fd;',
        '  font-family: monospace;',
        '  font-size: 10.5px;',
        '  font-weight: 900;',
        '  box-shadow: 0 4px 12px rgba(0,0,0,0.8);',
        '  cursor: pointer;',
        '}',
        '#jennyAvSyncEdgeDrawerV368 {',
        '  display: none;',
        '  flex-direction: column;',
        '  gap: 5px;',
        '  padding: 8px 10px;',
        '  border-radius: 12px;',
        '  background: rgba(9, 13, 22, 0.95);',
        '  border: 1.5px solid #3b82f6;',
        '  box-shadow: 0 8px 24px rgba(0,0,0,0.92);',
        '  font-family: monospace;',
        '  font-size: 10.5px;',
        '  color: #e6edf3;',
        '  max-width: min(335px, 90vw);',
        '}'
    ].join('\n');
    document.head.appendChild(stV369);
})();
