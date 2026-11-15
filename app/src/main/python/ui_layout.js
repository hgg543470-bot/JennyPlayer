/* ============================================================================
 * ui_layout.js — Раскладка экрана: поздние правки шапки и модалок (V242, V360)
 * Вынесено из ui_v71.js без изменения кода (см. REFACTOR_PLAN.md). Порядок блоков — исходный.
 * ============================================================================ */


/* [split] V242: кусок исходного IIFE (ui_v71.js, строки 33743–34878) → ui_layout.js */
;(function() {
    if (window._jennyV242Installed__layout) return;
    window._jennyV242Installed__layout = true;
    window._jennyV242Installed = true;
    window.addEventListener('resize', window.syncEdgeToEdgeLayoutBoundsV242);

    var _prevToggleModalV242 = window.toggleModal;
    if (typeof _prevToggleModalV242 === 'function') {
        window.toggleModal = function() {
            var res = _prevToggleModalV242.apply(this, arguments);
            window.syncLangDockedBodyClassV242();
            if (typeof window.syncSettingsLangBtnVisibilityV39 === 'function') {
                window.syncSettingsLangBtnVisibilityV39(false);
            }
            window.updateTopSearchOrMonitorBar();
            return res;
        };
    }

    window.updateAllStudioHeaderPillsV242 = function() {
        var c = window._jennyHubCountsV242 || {};
        var q = window._jennyHubQueuesV242 || {};
        var scBtn = document.getElementById('btnScHubPillV242');
        if (scBtn) scBtn.innerText = '📥 Закачки (' + (c.soundcloud || 0) + ')';
        var radBtn = document.getElementById('btnRadioHubPillV242');
        if (radBtn) radBtn.innerText = '🎙️ Записанные эфиры (' + (c.radio || 0) + ')';
        var ytBtn = document.getElementById('btnYtHubPillV242');
        if (ytBtn) ytBtn.innerText = '📥 Закачки (' + (c.youtube || 0) + ')';
        var ostBtn = document.getElementById('btnKhOstHubPillV242');
        if (ostBtn) ostBtn.innerText = '📥 Закачки (' + (c.ost || 0) + ((q.ost || 0) > 0 ? (' • ⏳' + q.ost) : '') + ')';
        var archBtn = document.getElementById('btnKhArchiveHubPillV242');
        if (archBtn) archBtn.innerText = '📥 Скачанные (' + (c.archive || 0) + ((q.archive || 0) > 0 ? (' • ⏳' + q.archive) : '') + ')';
    };

    // Boot-time initialization
    setTimeout(function() {
        window.syncLangDockedBodyClassV242();
        if (typeof window.syncSettingsLangBtnVisibilityV39 === 'function') {
            window.syncSettingsLangBtnVisibilityV39(false);
        }
        if (typeof window.updateScopedSearchPlaceholderV73 === 'function') {
            window.updateScopedSearchPlaceholderV73();
        }
        window.syncContextRefreshCounterV242();
        window.syncEdgeToEdgeLayoutBoundsV242();
        window.refreshJennyHubSummaryV242();
    }, 180);
})();

/* [split] V360: кусок исходного IIFE (ui_v71.js, строки 35973–36584) → ui_layout.js */
;(function() {
    if (window._jennyV360ClockAndModalPatchInstalled__layout) return;
    window._jennyV360ClockAndModalPatchInstalled__layout = true;
    window._jennyV360ClockAndModalPatchInstalled = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    function setStylePropIfChangedV363(el, prop, val, priority) {
        if (!el || !el.style) return;
        var wantVal = String(val);
        var wantPri = priority || '';
        if (el.style.getPropertyValue(prop) === wantVal && el.style.getPropertyPriority(prop) === wantPri) {
            return;
        }
        el.style.setProperty(prop, wantVal, wantPri);
    }
    function getOpenModalStateV363() {
        var deckAIds = ['settingsModal', 'eqModal', 'specModal', 'themeModal', 'favModal'];
        var deckBIds = ['settingsModalDeckB', 'eqModalDeckB', 'specModalDeckB'];
        var deckAOpen = deckAIds.some(function(id) {
            var el = document.getElementById(id);
            return Boolean(el && el.classList.contains('open'));
        });
        var deckBOpen = deckBIds.some(function(id) {
            var el = document.getElementById(id);
            return Boolean(el && el.classList.contains('open'));
        });
        return {
            deckAOpen: deckAOpen,
            deckBOpen: deckBOpen,
            anyOpen: Boolean(deckAOpen || deckBOpen)
        };
    }

    window.syncHeaderHeightWithModalsV71 = function() {
        if (window._inLayoutSyncGuardV363) return;
        window._inLayoutSyncGuardV363 = true;
        try {
            var st = getOpenModalStateV363();
            var isOpen = st.anyOpen;
            if (document.body) {
                if (isOpen !== document.body.classList.contains('jenny-any-modal-open-v360')) {
                    document.body.classList.toggle('jenny-any-modal-open-v360', isOpen);
                }
            }

            var plWrap = document.getElementById('jennyPlaylistBarWrapV71');
            var subWrap = (typeof window.ensureSubStripPinnedInHeaderV74_7 === 'function')
                ? window.ensureSubStripPinnedInHeaderV74_7()
                : document.getElementById('jennySubCategoryStripV71');
            var stickyTop = document.querySelector('.sticky-top');
            var midList = document.querySelector('.middle-list-container');
            var botEl = document.getElementById('bottomPlayerDock') || document.querySelector('.sticky-bottom');
            var hasSub = Boolean(subWrap && subWrap.innerHTML && subWrap.innerHTML.trim().length > 0);

            if (plWrap) setStylePropIfChangedV363(plWrap, 'display', isOpen ? 'none' : 'flex', 'important');
            if (subWrap) setStylePropIfChangedV363(subWrap, 'display', (!isOpen && hasSub) ? 'block' : 'none', 'important');

            var targetTopPx = isOpen ? '104px' : (hasSub ? '184px' : '142px');
            var botH = 0;
            if (botEl && getComputedStyle(botEl).display !== 'none') {
                botH = botEl.offsetHeight || 96;
            }
            var targetBotPx = botH + 'px';

            if (stickyTop) setStylePropIfChangedV363(stickyTop, 'height', targetTopPx, 'important');
            if (midList) {
                setStylePropIfChangedV363(midList, 'top', targetTopPx, 'important');
                setStylePropIfChangedV363(midList, 'bottom', targetBotPx, 'important');
            }
            document.querySelectorAll('.modal-overlay').forEach(function(m) {
                setStylePropIfChangedV363(m, 'top', isOpen ? '104px' : targetTopPx, 'important');
                setStylePropIfChangedV363(m, 'bottom', targetBotPx, 'important');
            });
        } finally {
            window._inLayoutSyncGuardV363 = false;
        }
    };

    window.syncEdgeToEdgeLayoutBoundsV242 = function() {
        window.syncHeaderHeightWithModalsV71();
    };

    window._inUpdateTopBarGuardV363 = false;
})();
