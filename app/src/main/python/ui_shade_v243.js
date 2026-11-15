/* ============================================================================
 * ui_shade_v243.js — Шторка, поздняя часть (V243–V244): итоговое уведомление, отметка касаний, безопасные отступы
 * Вынесено из ui_v71.js без изменения кода (см. REFACTOR_PLAN.md). Порядок блоков — исходный.
 * ============================================================================ */


/* [split] V243: кусок исходного IIFE (ui_v71.js, строки 35225–35944) → ui_shade_v243.js */
;(function() {
    if (window._jennyV243Installed__shade_v243) return;
    window._jennyV243Installed__shade_v243 = true;
    window._jennyV243Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    var onGlobalPointerCaptureV243 = function(e) {
        window._lastPhysicalTouchInAppTsV243 = performance.now();
        var t = e && e.target;
        if (!t) return;

        var srcMenu = document.getElementById('jennySourcesDropMenuV91');
        if (srcMenu && srcMenu.style.display !== 'none' && getComputedStyle(srcMenu).display !== 'none') {
            if (!srcMenu.contains(t) && !(t.closest && t.closest('#btnSourcesHubDropV91'))) {
                srcMenu.style.display = 'none';
            }
        }

        var popB = document.getElementById('volumePopupDeckBV216');
        if (popB && (popB.classList.contains('show') || popB.classList.contains('open'))) {
            if (!popB.contains(t) && !(t.closest && t.closest('#volUIWrapperDeckBV216'))) {
                popB.classList.remove('show', 'open');
            }
        }

        var popA = document.getElementById('volumePopup');
        if (popA && (popA.classList.contains('show') || popA.classList.contains('open'))) {
            if (!popA.contains(t) && !(t.closest && t.closest('#volUIWrapper'))) {
                popA.classList.remove('show', 'open');
            }
        }
    };
    window.addEventListener('pointerdown', onGlobalPointerCaptureV243, { capture: true, passive: true });
    window.addEventListener('touchstart', onGlobalPointerCaptureV243, { capture: true, passive: true });
    window.addEventListener('mousedown', onGlobalPointerCaptureV243, { capture: true, passive: true });

    window.syncPermanentForegroundNotificationV212 = window.syncAndroidNotification = function(force) {
        if (!window.AndroidBridge) return;
        var now = Date.now();
        var snap = window.getActiveSourcesSnapshotV243();
        var isActuallyPlaying = snap.anyPlaying;

        var torSnap = window._torLiveDaemonSnapV128 || [];
        var activeTorCnt = 0, sumKbps = 0, sumDoneB = 0, sumLenB = 0;
        torSnap.forEach(function(t) {
            var files = t.files || [];
            if (files.some(function(f) { return !f.done; }) && !t.paused) {
                activeTorCnt++;
                sumKbps += (t.speed_kbps || 0);
                files.forEach(function(f) { sumLenB += (f.length || 0); sumDoneB += (f.completed || 0); });
            }
        });
        var torPct = sumLenB > 0 ? Math.min(99, Math.floor((sumDoneB * 100) / sumLenB)) : 0;

        var titleParts = [];
        var subParts = [];
        if (activeTorCnt > 0) subParts.push('⚡ P2P: ' + sumKbps + ' КБ/с (' + torPct + '%)');

        var posSec = 0, durSec = 0, spd = 1.0;

        if (snap.radioPlaying) {
            var rName = window.resolveCurrentRadioTitleV243();
            titleParts.push('📻 ' + rName);
            subParts.push((window._radioStateV91 && window._radioStateV91.isRecording) ? '🔴 Запись эфира • Прямой поток' : '📡 Прямой радиоэфир');
        } else if (snap.extPlaying) {
            titleParts.push('🎧 ' + (window._lastExternalTitleV243 || 'Внешний поток'));
            subParts.push('🌐 Потоковое прослушивание');
            durSec = isFinite(snap.extAud.duration) ? snap.extAud.duration : 0;
            posSec = isFinite(snap.extAud.currentTime) ? snap.extAud.currentTime : 0;
        } else {
            if (snap.deckAPlaying && window.currentPlayingTrack) {
                var cleanA = String(window.currentPlayingTrack).replace(/\.(opus|m4a|mp3|wav|flac|ogg|xflac)$/i, '');
                titleParts.push('🎵 ' + cleanA);
                durSec = (snap.player && isFinite(snap.player.duration) && snap.player.duration > 0) ? snap.player.duration : (window.studioBuffer ? window.studioBuffer.duration : 0);
                posSec = (snap.player && isFinite(snap.player.currentTime)) ? snap.player.currentTime : 0;
                spd = (snap.player && snap.player.playbackRate) || 1.0;
            }
            if (snap.deckBPlaying && snap.stVid.currentTitle) {
                var cleanB = String(snap.stVid.currentTitle).replace(/\.(mp4|mkv|webm|avi|mov)$/i, '');
                titleParts.push('🎬 ' + cleanB);
                if (!snap.deckAPlaying && snap.vid) {
                    durSec = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(snap.vid) : (snap.vid.duration || 0);
                    posSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(snap.vid) : (snap.vid.currentTime || 0);
                    spd = (window.videoDeckV131 && window.videoDeckV131.speed) || snap.vid.playbackRate || 1.0;
                }
            }
            if (snap.deckAPlaying && snap.deckBPlaying) subParts.push('🎛️ Дека А + Дека Б');
            else if (snap.deckBPlaying) subParts.push('🎬 Дека Б: x' + spd);
            else if (snap.deckAPlaying) subParts.push('🎵 Дека А: x' + spd);
        }

        if (!isActuallyPlaying) {
            var lastSrc = window._lastActiveMediaSourceV243 || 'deckA';
            if (lastSrc === 'radio' && (window._lastRadioTitleV243 || (window._radioStateV91 && window._radioStateV91.currentStation))) {
                titleParts.push('⏸ 📻 ' + window.resolveCurrentRadioTitleV243());
                subParts.push('📻 Радиоэфир на паузе');
            } else if (lastSrc === 'deckB' && snap.stVid && snap.stVid.active && snap.stVid.currentTitle) {
                titleParts.push('⏸ 🎬 ' + String(snap.stVid.currentTitle).replace(/\.(mp4|mkv|webm|avi|mov)$/i, ''));
                subParts.push('🎬 Видео на паузе');
            } else if (activeTorCnt > 0) {
                titleParts.push('🧲 Закачка P2P (' + activeTorCnt + ' разд. • ' + torPct + '%)');
                subParts.push('📥 Фоновая загрузка активна');
            } else if (window.currentPlayingTrack) {
                titleParts.push('⏸ ' + String(window.currentPlayingTrack).replace(/\.(opus|m4a|mp3|wav|flac|ogg|xflac)$/i, ''));
                subParts.push('🎵 На паузе');
            } else {
                titleParts.push('🛡️ Jenny Player');
                subParts.push('Готов к воспроизведению');
            }
        }

        var finalTitle = titleParts.join(' │ ');
        var finalSub = subParts.join(' • ');
        var curSig = finalTitle + '|' + finalSub + '|' + (isActuallyPlaying ? '1' : '0');

        if (!force && curSig === window._lastNotifSigV243 && (!isActuallyPlaying || (now - (window._lastPermNotifSyncTsV212 || 0) < 1200))) {
            return;
        }
        window._lastNotifSigV243 = curSig;
        window._lastPermNotifSyncTsV212 = now;

        try {
            if (typeof window.AndroidBridge.updateMediaStateFull === 'function') {
                window.AndroidBridge.updateMediaStateFull(finalTitle, finalSub, isActuallyPlaying, posSec, durSec, spd);
            } else if (typeof window.AndroidBridge.updateMediaState === 'function') {
                window.AndroidBridge.updateMediaState(finalTitle + ' || ' + finalSub, isActuallyPlaying, posSec, durSec, spd);
            }
        } catch (e) {}
    };

    setInterval(function() {
        window.syncAndroidSafeInsetsV243();
        window.ensureSearchRowStretchV243();
        window.ensureVideoPrevNextZonesV243();
        window.fixRadioModalHeaderLayoutV243();
    }, 700);

    setTimeout(function() {
        window.syncAndroidSafeInsetsV243();
        window.ensureSearchRowStretchV243();
        window.ensureVideoPrevNextZonesV243();
        window.fixRadioModalHeaderLayoutV243();
        window.syncPermanentForegroundNotificationV212(true);
    }, 150);
})();
/* ================= END JENNY_V243_UNIFIED_FIXES ================= */

/* === BEGIN JENNY_V244_VIEWPORT_CLEAN === */
/* [split] V244: кусок исходного IIFE (ui_v71.js, строки 35948–35969) → ui_shade_v243.js */
;(function() {
    window.syncAndroidSafeInsetsV243 = function() {
        var r = document.documentElement;
        r.style.setProperty('--jenny-safe-top', '0px');
        r.style.setProperty('--jenny-safe-bottom', '0px');
    };
    window.syncAndroidSafeInsetsV243();
})();
