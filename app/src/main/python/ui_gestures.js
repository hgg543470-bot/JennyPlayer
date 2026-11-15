/* ============================================================================
 * ui_gestures.js — Жесты: зажатие 180 мс, монитор касаний
 *
 * Склейка:  /bundle_2_player.js, модуль 3 из 18. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   killAllHoldTimersV74_5, canTriggerLongPressNowV74_5, installCleanStageTouchV133, isAnySettingsInputFocusedV218, ensureSeamlessFrameHoldCanvasV220
 * Откуда:   ui_v71.js (коммит 9ae6639), строки 2979–3026, 3114–3237, 10532–10619, 22596–22607, 25328–25340, 35229–35229. Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */



// === V74.5 UNIFIED STATIC GESTURE ENGINE (NO BLIND TOUCHMOVE & STRICT ZERO-SCROLL HOLD) ===

window._gestureStateV74_5 = {
    touching: false,
    wasBrakingScroll: false,
    everScrolled: false,
    maxDistPx: 0,
    startX: 0,
    startY: 0,
    startWinScrollY: 0,
    startListScrollTop: 0,
    startPlStripScrollLeft: 0,
    startSubStripScrollLeft: 0,
    lastAnyScrollTs: 0,
    blockClickUntilTs: 0
};

window.killAllHoldTimersV74_5 = function() {
    if (window.longPressTimer) {
        clearTimeout(window.longPressTimer);
        window.longPressTimer = null;
    }
    if (window._stripHoldTimerV74_5) {
        clearTimeout(window._stripHoldTimerV74_5);
        window._stripHoldTimerV74_5 = null;
    }
};

// Проверка: разрешено ли прямо сейчас открыть окно по зажатию (Инспектор или Модалку ленты)
window.canTriggerLongPressNowV74_5 = function() {
    const g = window._gestureStateV74_5;
    if (!g || !g.touching) return false;
    if (g.wasBrakingScroll || g.everScrolled) return false;
    if (g.maxDistPx > 4.0) return false;

    const uList = document.getElementById('unifiedList');
    const plStrip = document.getElementById('jennyPlaylistScrollStripV71');
    const subStrip = document.getElementById('jennySubFilterBarActiveV73');

    const dyWin = Math.abs((window.scrollY || 0) - g.startWinScrollY);
    const dyList = uList ? Math.abs(uList.scrollTop - g.startListScrollTop) : 0;
    const dxPl = plStrip ? Math.abs(plStrip.scrollLeft - g.startPlStripScrollLeft) : 0;
    const dxSub = subStrip ? Math.abs(subStrip.scrollLeft - g.startSubStripScrollLeft) : 0;

    if (dyWin >= 1 || dyList >= 1 || dxPl >= 1 || dxSub >= 1) {
        g.everScrolled = true;
        return false;
    }
    return true;
};

// Глобальный монитор касаний и скролла (Capture Phase) — БЕЗ блокировки touchmove!
;(function installGlobalGestureMonitorV74_5() {
    if (window._globalGestureMonitorV74_5) return;
    window._globalGestureMonitorV74_5 = true;

    const SCROLL_COOLDOWN_MS = 200; // Остановка летящего скролла (мс)
    const TAP_JITTER_PX = 10;       // Допуск микро-сдвига пальца для короткого тапа (px)
    const HOLD_JITTER_PX = 4;       // Допуск для зажатия (стоит как вкопанный)

    const isGuardedZone = (el) => {
        if (!el || !el.closest) return false;
        return Boolean(
            el.closest('#unifiedList') ||
            el.closest('#jennyPlaylistScrollStripV71') ||
            el.closest('#jennySubFilterWrapV71')
        );
    };

    window.addEventListener('scroll', () => {
        const g = window._gestureStateV74_5;
        g.lastAnyScrollTs = performance.now();
        if (g.touching) {
            g.everScrolled = true;
            window.killAllHoldTimersV74_5();
        }
    }, { capture: true, passive: true });

    document.addEventListener('touchstart', (e) => {
        const g = window._gestureStateV74_5;
        if (!e.touches || e.touches.length !== 1) {
            g.touching = false;
            window.killAllHoldTimersV74_5();
            return;
        }

        const now = performance.now();
        const sinceScroll = now - g.lastAnyScrollTs;
        const uList = document.getElementById('unifiedList');
        const plStrip = document.getElementById('jennyPlaylistScrollStripV71');
        const subStrip = document.getElementById('jennySubFilterBarActiveV73');

        g.touching = true;
        g.startX = e.touches[0].clientX;
        g.startY = e.touches[0].clientY;
        g.maxDistPx = 0;
        g.everScrolled = false;
        g.startWinScrollY = window.scrollY || 0;
        g.startListScrollTop = uList ? uList.scrollTop : 0;
        g.startPlStripScrollLeft = plStrip ? plStrip.scrollLeft : 0;
        g.startSubStripScrollLeft = subStrip ? subStrip.scrollLeft : 0;

        if (sinceScroll < SCROLL_COOLDOWN_MS && isGuardedZone(e.target)) {
            g.wasBrakingScroll = true;
            window.killAllHoldTimersV74_5();
            e.stopImmediatePropagation();
            return;
        }
        g.wasBrakingScroll = false;
    }, { capture: true, passive: true });

    document.addEventListener('touchmove', (e) => {
        const g = window._gestureStateV74_5;
        if (!g.touching || !e.touches || e.touches.length === 0) return;

        const dx = e.touches[0].clientX - g.startX;
        const dy = e.touches[0].clientY - g.startY;
        const dist = Math.hypot(dx, dy);
        if (dist > g.maxDistPx) g.maxDistPx = dist;

        // Как только палец сдвинулся больше чем на 4px — навсегда отменяем зажатие для текущего касания!
        if (g.maxDistPx > HOLD_JITTER_PX || !window.canTriggerLongPressNowV74_5()) {
            window.killAllHoldTimersV74_5();
        }
    }, { capture: true, passive: true });

    document.addEventListener('touchend', (e) => {
        const g = window._gestureStateV74_5;
        window.killAllHoldTimersV74_5();

        if (!isGuardedZone(e.target)) {
            g.touching = false;
            return;
        }

        const shouldBlockTap = (
            g.wasBrakingScroll ||
            g.everScrolled ||
            g.maxDistPx > TAP_JITTER_PX ||
            (performance.now() - g.lastAnyScrollTs < 90)
        );

        g.touching = false;

        if (shouldBlockTap) {
            g.blockClickUntilTs = performance.now() + 380;
            e.stopImmediatePropagation();
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
        }
    }, { capture: true, passive: false });

    document.addEventListener('touchcancel', () => {
        const g = window._gestureStateV74_5;
        g.touching = false;
        window.killAllHoldTimersV74_5();
    }, { capture: true, passive: true });

    document.addEventListener('click', (e) => {
        if (!isGuardedZone(e.target)) return;
        const g = window._gestureStateV74_5;
        const now = performance.now();
        if (
            g.wasBrakingScroll ||
            g.everScrolled ||
            g.maxDistPx > TAP_JITTER_PX ||
            now < g.blockClickUntilTs ||
            (now - g.lastAnyScrollTs < SCROLL_COOLDOWN_MS)
        ) {
            e.stopImmediatePropagation();
            e.stopPropagation();
            e.preventDefault();
            return false;
        }
    }, { capture: true, passive: false });
})();

// Полностью переписываем обработчик касаний сцены БЕЗ жестов яркости/громкости и со свободным щипком в режиме Мини!
window.installCleanStageTouchV133 = function() {
const root = document.getElementById('jennyVideoStudioRootV130');
const stage = document.getElementById('jennyVideoStageV130');
if (!root || !stage || stage._v133TouchInstalled) return;
stage._v133TouchInstalled = true;

let startX = 0, startY = 0, initLeft = 0, initTop = 0;
let isPipDrag = false, isPipPinch = false;
let initSpan = 1, initFocusX = 0, initFocusY = 0, pinchW = 280, pinchH = 168, pinchL = 0, pinchT = 0;
let lastTapTs = 0;

stage.addEventListener('touchstart', (e) => {
const st = window._vidStateV130;
if (st.desktopOverlay || st.isLocked) return;
const onInteractive = Boolean(e.target.closest('button') || e.target.closest('input'));

if (st.pipMode && e.touches.length >= 2) {
isPipPinch = true;
isPipDrag = false;
const t0 = e.touches[0], t1 = e.touches[1];
initSpan = Math.max(8, Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY));
initFocusX = (t0.clientX + t1.clientX) * 0.5;
initFocusY = (t0.clientY + t1.clientY) * 0.5;
const r = root.getBoundingClientRect();
pinchW = r.width; pinchH = r.height; pinchL = r.left; pinchT = r.top;
return;
}

if (e.touches.length === 1 && !onInteractive) {
startX = e.touches[0].clientX;
startY = e.touches[0].clientY;
isPipDrag = false;
if (st.pipMode) {
const r = root.getBoundingClientRect();
initLeft = r.left;
initTop = r.top;
}
}
}, { passive: true, capture: true });

stage.addEventListener('touchmove', (e) => {
const st = window._vidStateV130;
// Блокируем старые обработчики яркости/громкости и JS-перетаскивания оверлея!
e.stopImmediatePropagation();
if (st.desktopOverlay || st.isLocked) return;

if (st.pipMode && isPipPinch && e.touches.length >= 2) {
const t0 = e.touches[0], t1 = e.touches[1];
const curSpan = Math.max(8, Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY));
const curFocusX = (t0.clientX + t1.clientX) * 0.5;
const curFocusY = (t0.clientY + t1.clientY) * 0.5;
const scale = curSpan / initSpan;
const nw = Math.max(48, Math.round(pinchW * scale));
const nh = Math.max(32, Math.round(pinchH * scale));
const sx = nw / Math.max(1, pinchW);
const sy = nh / Math.max(1, pinchH);
root._hasCustomPipPosV130 = true;
root.style.setProperty('width', nw + 'px', 'important');
root.style.setProperty('height', nh + 'px', 'important');
root.style.left = Math.round(curFocusX - (initFocusX - pinchL) * sx) + 'px';
root.style.top = Math.round(curFocusY - (initFocusY - pinchT) * sy) + 'px';
return;
}

if (st.pipMode && !isPipPinch && e.touches.length === 1 && !e.target.closest('button') && !e.target.closest('input')) {
const dx = e.touches[0].clientX - startX;
const dy = e.touches[0].clientY - startY;
if (isPipDrag || Math.hypot(dx, dy) > 6) {
isPipDrag = true;
root._hasCustomPipPosV130 = true;
root.style.left = Math.round(initLeft + dx) + 'px';
root.style.top = Math.round(initTop + dy) + 'px';
}
}
}, { passive: true, capture: true });

stage.addEventListener('touchend', (e) => {
const st = window._vidStateV130;
if (isPipDrag || isPipPinch) {
e.stopImmediatePropagation();
if (e.touches.length === 0) {
isPipDrag = false;
isPipPinch = false;
}
return;
}
}, { passive: true, capture: true });
};
/* ================= END JENNY_V217_UNIFIED_PATCH ================= */

/* ================= JENNY_V218_UNIFIED_PATCH (#312): INPUT FOCUS GUARD, DECK A/B HEART ADD-TO-FAV TOAST, PERSISTENT EXTERNAL STORAGE, MUTUALLY-EXCLUSIVE EQ SELECTOR & SEPARATE DECK EQ/ZONES, COMPACT MINI/PIP WITH PREV/NEXT & HIDDEN 120HZ/KNOBS, FULLSCREEN STRETCH & DUP=0, ALL-FORMAT TORRENT DURATION/SEEK & 5-SOURCE HEADER PIN ================= */
/* [split] V218: кусок исходного IIFE (ui_v71.js, строки 22588–24059) → ui_gestures.js */
;(function() {
    if (window._jennyV218Installed__gestures) return;
    window._jennyV218Installed__gestures = true;
    window._jennyV218Installed = true;

    // -------------------------------------------------------------------------
    // 1. ИСПРАВЛЕНИЕ ВВОДА ЦИФР С КЛАВИАТУРЫ В #settingsModal (00:00-00:25)
    //    Блокируем перерисовку innerHTML каждые 600 мс и защищаем активный <input> от сброса фокуса!
    // -------------------------------------------------------------------------
    window.isAnySettingsInputFocusedV218 = function() {
        var ae = document.activeElement;
        if (!ae) return false;
        var tag = (ae.tagName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            var type = (ae.getAttribute('type') || 'text').toLowerCase();
            if (type !== 'checkbox' && type !== 'range' && type !== 'button') {
                return true;
            }
        }
        return false;
    };
})();

/* [split] V221: кусок исходного IIFE (ui_v71.js, строки 25084–26033) → ui_gestures.js */
;(function() {
    if (window._jennyV221Installed__gestures) return;
    window._jennyV221Installed__gestures = true;
    window._jennyV221Installed = true;

    // -------------------------------------------------------------------------
    // 3. ХОЛСТ УДЕРЖАНИЯ КАДРА (#jennySeamlessFrameHoldCanvasV220):
    //    Предотвращает чёрный прямоугольник на экране при переключении аудиодорожек (Дор. #1 / #2)
    //    и при подгрузке сегментов реверса!
    // -------------------------------------------------------------------------
    window.ensureSeamlessFrameHoldCanvasV220 = function() {
        var stage = document.getElementById('jennyVideoStageV130');
        var vid = document.getElementById('jennyVideoElV130');
        if (!stage || !vid) return null;
        var c = document.getElementById('jennySeamlessFrameHoldCanvasV220');
        if (!c) {
            c = document.createElement('canvas');
            c.id = 'jennySeamlessFrameHoldCanvasV220';
            c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4;display:none;object-fit:contain;background:transparent;';
            stage.insertBefore(c, vid.nextSibling);
        }
        return c;
    };
})();
/* ================= END JENNY_V238_P2P_TURBO_DIAG ================= */

/* ================= BEGIN JENNY_V243_UNIFIED_FIXES ================= */
/* [split] V243: кусок исходного IIFE (ui_v71.js, строки 35225–35944) → ui_gestures.js */
;(function() {
    if (window._jennyV243Installed__gestures) return;
    window._jennyV243Installed__gestures = true;
    window._jennyV243Installed = true;

    window._lastPhysicalTouchInAppTsV243 = 0;
})();
