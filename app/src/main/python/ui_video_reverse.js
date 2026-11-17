/* ============================================================================
 * ui_video_reverse.js — Реверс видео: очередь сегментов в RAM, реверс Деки Б
 *
 * Склейка:  /bundle_2_player.js, модуль 10 из 18. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   updateVideoRevBtnUIV131, toggleVideoReverseV131, toggleReverseModeDeckB, startImmediateVideoReverseEngineV217, cleanupRevBlobQueueV223, pumpReverseRamBlobQueueV223, bindRevPauseGuardV224
 * Откуда:   ui_v71.js (коммит 9ae6639), строки 9688…37146 (14 фрагментов, вперемешку с другими темами). Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */


window.updateVideoRevBtnUIV131 = function() {
const btn = document.getElementById('v131BtnVideoRev');
const isRev = Boolean(window.videoDeckV131.isReversed);
if (btn) {
btn.style.borderColor = isRev ? '#e3b341' : 'rgba(255,255,255,0.25)';
btn.style.color = isRev ? '#e3b341' : '#e6edf3';
btn.style.background = isRev ? 'rgba(227,179,65,0.25)' : 'rgba(13,17,23,0.85)';
}
};

window.toggleVideoReverseV131 = function(ev) {
if (window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
const vd = window.videoDeckV131;
if (!vd.studioBuffer) { window.showVideoFeedbackV130('⏳ RAM-буфер видео ещё подгружается...'); return; }
vd.isReversed = !vd.isReversed;
window.updateVideoRevBtnUIV131();
const vid = document.getElementById('jennyVideoElV130');
if (!vd.isReversed && vid && !window._vidStateV130.userPaused) vid.play().catch(() => {});
window.syncVideoRamEngineV131(false);
window.showVideoFeedbackV130(vd.isReversed ? '⏪ РЕВЕРС ВИДЕО + RAM ВКЛ' : '⏩ Прямое воспроизведение');
window.wakeVideoHudV130(false);
};

/* [split] V211: кусок исходного IIFE (ui_v71.js, строки 16526–17925) → ui_video_reverse.js */
;(function() {
    if (window._jennyV211Installed__video_reverse) return;
    window._jennyV211Installed__video_reverse = true;
    window._jennyV211Installed = true;
    window.isReversedDeckB = false;

    // Реверс строго для Деки Б (Видео) — никак не затрагивает Деку А (Музыку)
    window.toggleReverseModeDeckB = function(targetReversed) {
        var vid = document.getElementById('jennyVideoElV130');
        var vd = window.videoDeckV131;
        var st = window._vidStateV130;
        if (!vid || !vd || !st || !st.active) return;

        var wasReversedNow = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
        var dur = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(vid) : (vid.duration || 0);
        var cur = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);

        if (!targetReversed) {
            window.isReversedDeckB = false;
            vd.isReversed = false;
            window.scrubStateDeckB.active = false;
            window.scrubStateDeckB.locked = false;
            window.scrubStateDeckB.side = null;
            window.scrubStateDeckB.isPhysicallyReversed = false;
            window.persistedPlaybackSpeedDeckB = null;
            window.persistedPlaybackSideDeckB = 'right';

            var lockEl = document.getElementById('speedLockIndicatorDeckB');
            if (lockEl) lockEl.style.display = 'none';

            var baseSpd = window.getBaseSpeedDeckB();
            window._jennyVideoSpeedV170 = baseSpd;
            vd.speed = baseSpd;
            if (!st.userPaused && vid.paused) {
                st._internalRevPause = false;
                vid.play().catch(function(){});
            }
            if (typeof window.updateVideoRevBtnUIV131 === 'function') window.updateVideoRevBtnUIV131();
            window.syncVideoRamEngineV211(false);
            window.updateProgressUIDeckB(cur, dur, false);
            return;
        }

        if (!vd.studioBuffer && !vd.reversedStudioBuffer) {
            if (typeof window.showToast === 'function') window.showToast('⏳ RAM-буферы видео (FWD+REV) ещё подгружаются...');
            return;
        }

        window.scrubStateDeckB.active = false;
        window.scrubStateDeckB.locked = false;
        window.scrubStateDeckB.side = null;
        window.scrubStateDeckB.isPhysicallyReversed = false;
        window.persistedPlaybackSpeedDeckB = null;
        window.persistedPlaybackSideDeckB = 'right';

        var lockEl2 = document.getElementById('speedLockIndicatorDeckB');
        if (lockEl2) lockEl2.style.display = 'none';

        window.isReversedDeckB = true;
        vd.isReversed = true;
        var baseSpd2 = window.getBaseSpeedDeckB();
        window._jennyVideoSpeedV170 = baseSpd2;
        vd.speed = baseSpd2;
        if (typeof window.updateVideoRevBtnUIV131 === 'function') window.updateVideoRevBtnUIV131();
        window.syncVideoRamEngineV211(false);
        window.updateProgressUIDeckB(cur, dur, true);
    };
})();

/* [split] V217: кусок исходного IIFE (ui_v71.js, строки 21243–22584) → ui_video_reverse.js */
;(function() {
    if (window._jennyV217Installed__video_reverse) return;
    window._jennyV217Installed__video_reverse = true;
    window._jennyV217Installed = true;
    window._lastRevVideoSpeedV217 = 1.0;

    // Плавный реверс видео на ЛЮБОМ файле (включая .mkv и live_remux) без блокировки "⏳ RAM-буфер видео ещё подгружается..."!
    window.startImmediateVideoReverseEngineV217 = function(revSpd) {
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        if (!vid || !st || !st.active || !vd) return;

        var spd = Math.max(0.1, Math.min(8.0, Number(revSpd) || window.getBaseSpeedDeckB() || 1.0));
        window._lastRevVideoSpeedV217 = spd;
        window.isReversedDeckB = true;
        vd.isReversed = true;
        vd.speed = spd;
        window._jennyVideoSpeedV170 = spd;

        if (vd.revFrameTimer) {
            clearInterval(vd.revFrameTimer);
            vd.revFrameTimer = null;
        }
        if (vd.horizonTimer) {
            clearTimeout(vd.horizonTimer);
            vd.horizonTimer = null;
        }

        // Ставим нативный <video> на внутреннюю паузу, чтобы плавно шагать назад по времени
        if (!vid.paused) {
            st._internalRevPause = true;
            try { vid.pause(); } catch (e) {}
        }

        var startAnchorSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
        var startWallMs = performance.now();
        var lastRemuxStepTs = 0;

        // Фоновая подкачка 30-секундного аудио-окна для обратного звука (если еще не загружено)
        if (!vd.studioBuffer && !vd._fetchingRevChunkV217) {
            vd._fetchingRevChunkV217 = true;
            var rawUrl = st.rawTorStreamUrlV214 || st.currentUrl || '';
            var chunkStart = Math.max(0, startAnchorSec - 28);
            var chunkDur = Math.max(6, Math.min(30, startAnchorSec - chunkStart + 2));
            var revSr = (vd.ctx && vd.ctx.sampleRate >= 44100) ? vd.ctx.sampleRate : 48000;
            fetch('/api/video/pcm_chunk?src=' + encodeURIComponent(rawUrl) + '&start=' + chunkStart.toFixed(1) + '&dur=' + chunkDur.toFixed(1) + '&sr=' + revSr)
                .then(function(r) { return r.ok ? r.arrayBuffer() : null; })
                .then(function(ab) {
                    vd._fetchingRevChunkV217 = false;
                    if (!ab || !vd.ctx || !vd.isReversed) return;
                    var frames = Math.floor(ab.byteLength / 8);
                    if (frames <= 200) return;
                    var aBuf = vd.ctx.createBuffer(2, frames, revSr);
                    var chL = aBuf.getChannelData(0), chR = aBuf.getChannelData(1);
                    var leftIn = new Float32Array(ab, 0, frames);
                    var rightIn = new Float32Array(ab, frames * 4, frames);
                    // Записываем сэмплы сразу в обратном порядке!
                    for (var i = 0; i < frames; i++) {
                        chL[i] = leftIn[frames - 1 - i];
                        chR[i] = rightIn[frames - 1 - i];
                    }
                    if (vd.sourceNode) {
                        try { vd.sourceNode.stop(); } catch (e) {}
                        try { vd.sourceNode.disconnect(); } catch (e) {}
                    }
                    if (vd.isReversed && !st.userPaused) {
                        if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = 0.0;
                        vd.sourceNode = vd.ctx.createBufferSource();
                        vd.sourceNode.buffer = aBuf;
                        vd.sourceNode.playbackRate.value = vd.speed || 1.0;
                        vd.sourceNode.connect(st.dspBypass ? vd.directBypassGain : vd.inputMixer);
                        if (st.dspBypass && vd.directBypassGain) vd.directBypassGain.gain.value = 1.0;
                        vd.sourceNode.start(0, 0);
                        vd.isStudioPlaying = true;
                    }
                })
                .catch(function() { vd._fetchingRevChunkV217 = false; });
        }

        vd.revFrameTimer = setInterval(function() {
            if (!st.active || st.userPaused || !vd.isReversed) {
                clearInterval(vd.revFrameTimer);
                vd.revFrameTimer = null;
                return;
            }
            var curSpd = vd.speed || 1.0;
            var elapsedSec = ((performance.now() - startWallMs) / 1000.0) * curSpd;
            var nextSec = Math.max(0, startAnchorSec - elapsedSec);
            var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (vid.duration || 0);

            st._pendingSeekSecV167 = nextSec;
            st._pendingSeekTsV167 = performance.now();

            if (!st.usingRemux) {
                try { vid.currentTime = nextSec; } catch (e) {}
            } else {
                var relSec = nextSec - (st.remuxBaseOffset || 0);
                if (relSec >= 0) {
                    try { vid.currentTime = relSec; } catch (e) {}
                } else if (performance.now() - lastRemuxStepTs > 1400) {
                    lastRemuxStepTs = performance.now();
                    var newBase = Math.max(0, nextSec - 12);
                    st.remuxBaseOffset = newBase;
                    var rawBaseUrl = st.rawTorStreamUrlV214 || st.currentUrl;
                    var isAvi = /\.avi(\?|$)/i.test(String(st.currentTitle || '') + ' ' + String(rawBaseUrl || ''));
                    vid.src = '/api/video/live_remux?src=' + encodeURIComponent(rawBaseUrl) +
                        '&start=' + newBase.toFixed(2) +
                        '&dur=' + (dur || 0).toFixed(2) +
                        '&aidx=' + (st.audioTrackIdxV216 || 0) +
                        '&transcode=' + (isAvi ? '1' : '0') +
                        '&t=' + Date.now();
                }
            }

            if (typeof window.updateProgressUIDeckB === 'function') {
                window.updateProgressUIDeckB(nextSec, dur, true);
            }
            if (typeof window.syncInternalVideoSliderUIV212 === 'function') {
                window.syncInternalVideoSliderUIV212(nextSec, dur);
            }

            if (nextSec <= 0.05) {
                window.restoreNormalVideoPlaybackV217();
            }
        }, 75);

        window.syncVideoPlayerButtonsUIV217();
    };

    // Переключение скорости НАЗАД (Реверс без слова "REV") по тем же 6 кастомным радиальным зонам из Настроек
    window.toggleVideoReverseV131 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();

        var vd = window.videoDeckV131 || {};
        var zones = window.getCustomVideoSpeedZonesV217();
        var isRevNow = Boolean(vd.isReversed || window.isReversedDeckB);

        var nextRevSpd = window._lastRevVideoSpeedV217 || zones[0] || window.getBaseSpeedDeckB();
        if (!isRevNow) {
            if (zones.indexOf(nextRevSpd) === -1) nextRevSpd = zones[0] || 1.0;
        } else {
            var cur = vd.speed || nextRevSpd;
            var idx = -1;
            for (var i = 0; i < zones.length; i++) {
                if (Math.abs(zones[i] - cur) < 0.008) { idx = i; break; }
            }
            nextRevSpd = zones[(idx + 1) % zones.length];
        }

        window._lastRevVideoSpeedV217 = nextRevSpd;
        if (window.scrubStateDeckB) {
            window.scrubStateDeckB.locked = true;
            window.scrubStateDeckB.side = 'left';
            window.scrubStateDeckB.speed = nextRevSpd;
            window.scrubStateDeckB.isPhysicallyReversed = true;
        }
        window.persistedPlaybackSpeedDeckB = nextRevSpd;
        window.persistedPlaybackSideDeckB = 'left';

        window.startImmediateVideoReverseEngineV217(nextRevSpd);
        if (typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130('⏪ Скорость назад: ' + nextRevSpd + 'x');
        }
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    // Переопределяем toggleReverseModeDeckB и startScrubDeckB (для верхней шкалы Деки Б),
    // чтобы дуга скорости влево (⏪) сразу включала реальный реверс без ожидания RAM-буфера!
    window.toggleReverseModeDeckB = function(targetReversed) {
        if (!targetReversed) {
            window.restoreNormalVideoPlaybackV217();
        } else {
            var revSpd = window._lastRevVideoSpeedV217 || window.getBaseSpeedDeckB() || 1.0;
            window.startImmediateVideoReverseEngineV217(revSpd);
        }
    };
})();

/* [split] V219: кусок исходного IIFE (ui_v71.js, строки 24063–25074) → ui_video_reverse.js */
;(function() {
    if (window._jennyV219Installed__video_reverse) return;
    window._jennyV219Installed__video_reverse = true;
    window._jennyV219Installed = true;

    // Гладкий реверс видео через потоковый сегментный реверс-ремукс (/api/video/reverse_remux) + синхронный таймлайн!
    window.startImmediateVideoReverseEngineV217 = function(revSpd) {
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        if (!vid || !st || !st.active || !vd) return;

        var spd = Math.max(0.1, Math.min(8.0, Number(revSpd) || window._lastRevVideoSpeedV217 || 0.95));
        window._lastRevVideoSpeedV217 = spd;

        var wasAlreadyRev = Boolean(vd.isReversed || window.isReversedDeckB);
        var curMediaSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);

        window.isReversedDeckB = true;
        vd.isReversed = true;
        vd.speed = spd;
        window._jennyVideoSpeedV170 = spd;

        if (vd.revFrameTimer) {
            clearInterval(vd.revFrameTimer);
            vd.revFrameTimer = null;
        }

        // Если видео стоит на паузе пользователя — просто запоминаем выбранную скорость реверса и НЕ сбрасываем кадр на экране!
        if (st.userPaused) {
            window.syncVideoPlayerButtonsUIV217();
            return;
        }

        // Если реверс-поток уже играет, просто плавно меняем ему аппаратную скорость playbackRate без перезагрузки потока!
        if (wasAlreadyRev && st._playingHardwareRevStreamV219 && !vid.paused && !vid.ended) {
            try {
                vid.defaultPlaybackRate = spd;
                vid.playbackRate = spd;
            } catch (e) {}
            window.syncVideoPlayerButtonsUIV217();
            return;
        }

        var launchReverseWindow = function(anchorPosSec) {
            if (!st.active || !vd.isReversed || st.userPaused) return;
            if (anchorPosSec <= 0.15) {
                window.restoreNormalVideoPlaybackV217();
                return;
            }
            var winLen = Math.min(14.0, Math.max(4.0, anchorPosSec));
            var rawBaseUrl = st.rawTorStreamUrlV214 || st.currentUrl || '';
            var aIdx = st.audioTrackIdxV216 || 0;
            var noAud = (st.videoStreamModeV217 === 'v_only') ? '1' : '0';

            st._playingHardwareRevStreamV219 = true;
            st._revAnchorSecV219 = anchorPosSec;
            st._revWinLenV219 = winLen;
            st.usingRemux = true;

            if (vd.sourceNode) {
                vd.sourceNode.onended = null;
                try { vd.sourceNode.stop(); } catch (e) {}
                try { vd.sourceNode.disconnect(); } catch (e) {}
                vd.sourceNode = null;
            }
            vd.isStudioPlaying = false;
            vid.muted = (noAud === '1');
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = (noAud === '1' || st.dspBypass) ? 0.0 : 1.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = (noAud === '1') ? 0.0 : (st.dspBypass ? 1.0 : 0.0);

            vid.src = '/api/video/reverse_remux?src=' + encodeURIComponent(rawBaseUrl) +
                '&pos=' + anchorPosSec.toFixed(2) +
                '&win=' + winLen.toFixed(2) +
                '&aidx=' + aIdx +
                '&no_audio=' + noAud +
                '&t=' + Date.now();

            var curSpdNow = vd.speed || spd;
            try {
                vid.preservesPitch = true;
                vid.webkitPreservesPitch = true;
                vid.defaultPlaybackRate = curSpdNow;
                vid.playbackRate = curSpdNow;
            } catch (e) {}
            vid.play().catch(function(){});
        };

        launchReverseWindow(curMediaSec);

        // Следим за обратным временем (anchor - vid.currentTime) и бесшовно подхватываем следующее окно реверса
        vd.revFrameTimer = setInterval(function() {
            if (!st.active || st.userPaused || !vd.isReversed) {
                clearInterval(vd.revFrameTimer);
                vd.revFrameTimer = null;
                return;
            }
            var anchor = Number(st._revAnchorSecV219 || curMediaSec);
            var progressed = Number(vid.currentTime || 0);
            var effTime = Math.max(0, anchor - progressed);
            var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : 0;

            st._pendingSeekSecV167 = effTime;
            st._pendingSeekTsV167 = performance.now();

            if (typeof window.updateProgressUIDeckB === 'function') {
                window.updateProgressUIDeckB(effTime, dur, true);
            }
            if (typeof window.syncInternalVideoSliderUIV212 === 'function') {
                window.syncInternalVideoSliderUIV212(effTime, dur);
            }

            if (effTime <= 0.1) {
                window.restoreNormalVideoPlaybackV217();
                return;
            }
            var winLen = Number(st._revWinLenV219 || 14.0);
            if ((vid.ended || progressed >= winLen - 0.18) && effTime > 0.2) {
                launchReverseWindow(effTime);
            }
        }, 70);

        window.syncVideoPlayerButtonsUIV217();
    };

    // Левая кнопка скорости НАЗАД (#v131BtnVideoRev):
    // Если были в режиме вперёд — ПЕРВОЕ нажатие сразу включает скорость, написанную на кнопке ⏪!
    // Если уже в реверсе — переключает на следующую кастомную зону (пропуская 1x)!
    window.toggleVideoReverseV131 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();

        var vd = window.videoDeckV131 || {};
        var zones = window.getNonBaseCustomVideoSpeedZonesV219();
        var baseSpd = window.getBaseSpeedDeckB ? window.getBaseSpeedDeckB() : 1.0;
        var isRevNow = Boolean(vd.isReversed || window.isReversedDeckB);

        var nextRevSpd = window._lastRevVideoSpeedV217 || zones[zones.length - 1] || 0.95;
        if (Math.abs(nextRevSpd - baseSpd) < 0.008) nextRevSpd = zones[zones.length - 1] || 0.95;

        if (isRevNow) {
            var cur = vd.speed || nextRevSpd;
            var idx = -1;
            for (var i = 0; i < zones.length; i++) {
                if (Math.abs(zones[i] - cur) < 0.008) { idx = i; break; }
            }
            nextRevSpd = zones[(idx + 1) % zones.length];
        }

        window._lastRevVideoSpeedV217 = nextRevSpd;
        if (window.scrubStateDeckB) {
            window.scrubStateDeckB.locked = true;
            window.scrubStateDeckB.side = 'left';
            window.scrubStateDeckB.speed = nextRevSpd;
            window.scrubStateDeckB.isPhysicallyReversed = true;
        }
        window.persistedPlaybackSpeedDeckB = nextRevSpd;
        window.persistedPlaybackSideDeckB = 'left';

        window.startImmediateVideoReverseEngineV217(nextRevSpd);
        if (typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130('⏪ Скорость назад: ' + nextRevSpd + 'x');
        }
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    // -------------------------------------------------------------------------
    // 4. НЕЗАВИСИМАЯ ГРОМКОСТЬ + ОВЕРДРАЙВ ДЛЯ ДЕКИ А И ДЕКИ Б И КНОПКА ЗАГЛУШЕНИЯ (MUTE 0%)
    //    ВНИЗУ ВЫПАДАЮЩЕЙ ШКАЛЫ ГРОМКОСТИ (по скриншотам 71506.jpg и 71510.jpg)
    // -------------------------------------------------------------------------
    var VOL_SPEAKER_ON_SVG_V219  = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    var VOL_SPEAKER_MUTE_SVG_V219 = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#f87171" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
})();

/* [split] V221: кусок исходного IIFE (ui_v71.js, строки 25084–26033) → ui_video_reverse.js */
;(function() {
    if (window._jennyV221Installed__video_reverse) return;
    window._jennyV221Installed__video_reverse = true;
    window._jennyV221Installed = true;

    window.startImmediateVideoReverseEngineV217 = function(revSpd, forceReloadTrackOrSeek, explicitStartSec) {
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        if (!vid || !st || !st.active || !vd) return;

        var spd = Math.max(0.1, Math.min(8.0, Number(revSpd) || window._lastRevVideoSpeedV217 || 0.95));
        window._lastRevVideoSpeedV217 = spd;

        var wasAlreadyRev = Boolean(vd.isReversed || window.isReversedDeckB);
        var curMediaSec = (explicitStartSec !== undefined && isFinite(explicitStartSec))
            ? Number(explicitStartSec)
            : (window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0));

        window.isReversedDeckB = true;
        vd.isReversed = true;
        vd.speed = spd;
        window._jennyVideoSpeedV170 = spd;

        if (st.userPaused) {
            window.syncVideoPlayerButtonsUIV217();
            return;
        }

        if (!forceReloadTrackOrSeek && wasAlreadyRev && st._playingHardwareRevStreamV219 && !vid.paused && !vid.ended && st._revActiveAudioIdxV220 === (st.audioTrackIdxV216 || 0)) {
            try {
                vid.defaultPlaybackRate = spd;
                vid.playbackRate = spd;
            } catch (e) {}
            window.syncVideoPlayerButtonsUIV217();
            return;
        }

        window.stopHardwareReverseTimerV220();
        st._revTrackSessionIdV220 = (st._revTrackSessionIdV220 || 0) + 1;
        var myRevSession = st._revTrackSessionIdV220;

        var launchReverseWindow = function(anchorPosSec, isInitialMicroChunk) {
            if (!st.active || !vd.isReversed || st.userPaused || st._revTrackSessionIdV220 !== myRevSession) return;
            if (anchorPosSec <= 0.2) {
                window.restoreNormalVideoPlaybackV217();
                return;
            }

            var desiredWin = isInitialMicroChunk ? 3.8 : 10.0;
            var winLen = Math.min(desiredWin, Math.max(1.2, anchorPosSec));
            var rawBaseUrl = st.rawTorStreamUrlV214 || st.currentUrl || '';
            var aIdx = st.audioTrackIdxV216 || 0;
            var noAud = (st.videoStreamModeV217 === 'v_only') ? '1' : '0';

            window.captureAndHoldVideoFrameV220(2600);

            st._playingHardwareRevStreamV219 = true;
            st._revAnchorSecV219 = anchorPosSec;
            st._revWinLenV219 = winLen;
            st._revActiveAudioIdxV220 = aIdx;
            st._revLaunchWallTsV220 = performance.now();
            st._revStreamStartedPlayingV220 = false;
            st.usingRemux = true;

            if (vd.sourceNode) {
                vd.sourceNode.onended = null;
                try { vd.sourceNode.stop(); } catch (e) {}
                try { vd.sourceNode.disconnect(); } catch (e) {}
                vd.sourceNode = null;
            }
            vd.isStudioPlaying = false;
            vid.muted = (noAud === '1');
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = (noAud === '1' || st.dspBypass) ? 0.0 : 1.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = (noAud === '1') ? 0.0 : (st.dspBypass ? 1.0 : 0.0);

            if (anchorPosSec - winLen > 0.4) {
                window.triggerReverseTrackBackgroundPrecacheV220(anchorPosSec - winLen, aIdx, noAud);
            }

            var onRevStreamReady = function() {
                if (st._revTrackSessionIdV220 !== myRevSession) return;
                st._revStreamStartedPlayingV220 = true;
                window._vidIsBufferingV132 = false;
                window.releaseHeldVideoFrameV220();
                var curSpdNow = vd.speed || spd;
                try {
                    vid.preservesPitch = true;
                    vid.webkitPreservesPitch = true;
                    vid.defaultPlaybackRate = curSpdNow;
                    vid.playbackRate = curSpdNow;
                } catch (e) {}
                if (!st.userPaused && vid.paused) {
                    vid.play().catch(function(){});
                }
                if (typeof window.syncVideoPlayBtnIconV132 === 'function') window.syncVideoPlayBtnIconV132();
            };

            vid.addEventListener('loadeddata', onRevStreamReady, { once: true });
            vid.addEventListener('playing', onRevStreamReady, { once: true });

            vid.src = '/api/video/reverse_remux?src=' + encodeURIComponent(rawBaseUrl) +
                '&pos=' + anchorPosSec.toFixed(2) +
                '&win=' + winLen.toFixed(2) +
                '&aidx=' + aIdx +
                '&no_audio=' + noAud +
                '&t=' + Date.now();

            var curSpdInit = vd.speed || spd;
            try {
                vid.preservesPitch = true;
                vid.webkitPreservesPitch = true;
                vid.defaultPlaybackRate = curSpdInit;
                vid.playbackRate = curSpdInit;
            } catch (e) {}
            vid.play().catch(function(){});
        };

        launchReverseWindow(curMediaSec, true);

        st._hwRevTimerV220 = setInterval(function() {
            if (!st.active || st.userPaused || !vd.isReversed || st._revTrackSessionIdV220 !== myRevSession) {
                window.stopHardwareReverseTimerV220();
                return;
            }
            var anchor = Number(st._revAnchorSecV219 || curMediaSec);
            var progressed = st._revStreamStartedPlayingV220 ? Number(vid.currentTime || 0) : 0;
            var effTime = Math.max(0, anchor - progressed);
            var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : 0;

            st._pendingSeekSecV167 = effTime;
            st._pendingSeekTsV167 = performance.now();

            if (typeof window.updateProgressUIDeckB === 'function') {
                window.updateProgressUIDeckB(effTime, dur, true);
            }
            if (typeof window.syncInternalVideoSliderUIV212 === 'function') {
                window.syncInternalVideoSliderUIV212(effTime, dur);
            }

            if (effTime <= 0.15) {
                window.restoreNormalVideoPlaybackV217();
                return;
            }

            var winLen = Number(st._revWinLenV219 || 3.8);
            var sinceLaunchMs = performance.now() - (st._revLaunchWallTsV220 || 0);
            if (st._revStreamStartedPlayingV220 && (vid.ended || progressed >= winLen - 0.14) && effTime > 0.25 && sinceLaunchMs > 400) {
                launchReverseWindow(effTime, false);
            }
        }, 60);

        window.syncVideoPlayerButtonsUIV217();
    };
})();
/* ================= END JENNY_V221_UNIFIED_PATCH ================= */

/* ================= JENNY_V223_REVERSE_RAM_QUEUE_PATCH (#317): PURE IN-RAM MULTI-SEGMENT QUEUE & SPEED-ADAPTIVE BUFFER SCALING (71545.mp4) ================= */
/* [split] V223: кусок исходного IIFE (ui_v71.js, строки 26037–26373) → ui_video_reverse.js */
;(function() {
    if (window._jennyV223Installed__video_reverse) return;
    window._jennyV223Installed__video_reverse = true;
    window._jennyV223Installed = true;

    window.cleanupRevBlobQueueV223 = function() {
        var st = window._vidStateV130 || {};
        if (st._revPreloadAbortCtrlV223) {
            try { st._revPreloadAbortCtrlV223.abort(); } catch (e) {}
            st._revPreloadAbortCtrlV223 = null;
        }
        st._revPreloadingBusyV223 = false;
        if (Array.isArray(st._revBlobQueueV223)) {
            st._revBlobQueueV223.forEach(function(item) {
                if (item && item.blobUrl) {
                    try { URL.revokeObjectURL(item.blobUrl); } catch (e) {}
                }
            });
        }
        st._revBlobQueueV223 = [];
        if (st._activeRevBlobUrlV223) {
            try { URL.revokeObjectURL(st._activeRevBlobUrlV223); } catch (e) {}
            st._activeRevBlobUrlV223 = null;
        }
    };

    // Конвейерная докачка до 3 больших кусков реверса вперёд в оперативную память смартфона (st._revBlobQueueV223)
    window.pumpReverseRamBlobQueueV223 = function(sessionId) {
        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        if (!st.active || !vd.isReversed || st.userPaused || st._revTrackSessionIdV220 !== sessionId) return;
        if (st._revPreloadingBusyV223) return;

        if (!Array.isArray(st._revBlobQueueV223)) st._revBlobQueueV223 = [];
        // Держим в оперативной памяти до 3 готовых больших сегментов вперёд (это 1.5–3 минуты непрерывного реверса в RAM!)
        if (st._revBlobQueueV223.length >= 3) return;

        var lastQueued = st._revBlobQueueV223.length > 0
            ? st._revBlobQueueV223[st._revBlobQueueV223.length - 1]
            : null;

        var nextPosSec = lastQueued
            ? Number(Math.max(0, lastQueued.anchorPos - lastQueued.winLen).toFixed(1))
            : Number((st._revNextBoundarySecV223 || 0).toFixed(1));

        var nextStepIdx = lastQueued
            ? (lastQueued.stepIdx + 1)
            : ((st._revCurrentStepIdxV223 || 0) + 1);

        if (nextPosSec <= 0.3) return;

        var rawBaseUrl = st.rawTorStreamUrlV214 || st.currentUrl || '';
        if (!rawBaseUrl) return;

        var curSpd = Number(vd.speed || window._lastRevVideoSpeedV217 || 1.0);
        var desiredWin = window.computeAdaptiveReverseWindowSecV223(nextStepIdx, curSpd);
        var winLen = Number(Math.min(desiredWin, Math.max(1.5, nextPosSec)).toFixed(1));
        var aIdx = st.audioTrackIdxV216 || 0;
        var noAud = (st.videoStreamModeV217 === 'v_only') ? '1' : '0';

        st._revPreloadingBusyV223 = true;
        var ctrl = new AbortController();
        st._revPreloadAbortCtrlV223 = ctrl;

        var url = '/api/video/reverse_precache_blob?src=' + encodeURIComponent(rawBaseUrl) +
            '&pos=' + nextPosSec.toFixed(1) +
            '&win=' + winLen.toFixed(1) +
            '&aidx=' + aIdx +
            '&spd=' + curSpd.toFixed(2) +
            '&no_audio=' + noAud +
            '&t=' + Date.now();

        (typeof window.fetchRevBlobInDeckBWorker === 'function'
            ? window.fetchRevBlobInDeckBWorker(url, ctrl.signal).catch(function(wErr) {
                if (ctrl.signal.aborted) throw wErr;
                return fetch(url, { signal: ctrl.signal }).then(function(res) {
                    if (!res.ok) throw new Error('Preload HTTP ' + res.status);
                    return res.blob();
                });
            })
            : fetch(url, { signal: ctrl.signal }).then(function(res) {
                if (!res.ok) throw new Error('Preload HTTP ' + res.status);
                return res.blob();
            })
        )
            .then(function(blob) {
                st._revPreloadingBusyV223 = false;
                if (!blob || blob.size < 1024) return;
                if (!st.active || !vd.isReversed || st._revTrackSessionIdV220 !== sessionId) return;

                var bUrl = URL.createObjectURL(blob);
                st._revBlobQueueV223.push({
                    blobUrl: bUrl,
                    anchorPos: nextPosSec,
                    winLen: winLen,
                    aIdx: aIdx,
                    stepIdx: nextStepIdx
                });

                // Сразу же запускаем предзагрузку СЛЕДУЮЩЕГО сегмента в очередь RAM!
                setTimeout(function() {
                    window.pumpReverseRamBlobQueueV223(sessionId);
                }, 60);
            })
            .catch(function() {
                st._revPreloadingBusyV223 = false;
            });
    };

    window.startImmediateVideoReverseEngineV217 = function(revSpd, forceReloadTrackOrSeek, explicitStartSec) {
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        if (!vid || !st || !st.active || !vd) return;

        var spd = Math.max(0.1, Math.min(8.0, Number(revSpd) || window._lastRevVideoSpeedV217 || 0.95));
        window._lastRevVideoSpeedV217 = spd;

        var wasAlreadyRev = Boolean(vd.isReversed || window.isReversedDeckB);
        var curMediaSec = (explicitStartSec !== undefined && isFinite(explicitStartSec))
            ? Number(explicitStartSec)
            : (window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0));

        window.isReversedDeckB = true;
        vd.isReversed = true;
        vd.speed = spd;
        window._jennyVideoSpeedV170 = spd;

        if (st.userPaused) {
            window.syncVideoPlayerButtonsUIV217();
            return;
        }

        window._vidPlayIntentV132 = true;
        window._vidIsBufferingV132 = false;

        // Если реверс уже активно играет эту же дорожку и пользователь просто поменял скорость (например скраббингом 1x -> 1.5x -> 2x) —
        // меняем playbackRate на лету БЕЗ сброса уже накопленной в RAM очереди сегментов!
        if (!forceReloadTrackOrSeek && wasAlreadyRev && st._playingHardwareRevStreamV219 && !vid.paused && !vid.ended && st._revActiveAudioIdxV220 === (st.audioTrackIdxV216 || 0)) {
            try {
                vid.defaultPlaybackRate = spd;
                vid.playbackRate = spd;
            } catch (e) {}
            window.syncVideoPlayerButtonsUIV217();
            return;
        }

        window.stopHardwareReverseTimerV220();
        window.cleanupRevBlobQueueV223();
        st._revTrackSessionIdV220 = (st._revTrackSessionIdV220 || 0) + 1;
        var myRevSession = st._revTrackSessionIdV220;

        var launchReverseWindow = function(anchorPosSec, isInitialStart) {
            if (!st.active || !vd.isReversed || st.userPaused || st._revTrackSessionIdV220 !== myRevSession) return;
            if (anchorPosSec <= 0.2) {
                window.restoreNormalVideoPlaybackV217();
                return;
            }

            window.captureAndHoldVideoFrameV220(2800);
            window._vidPlayIntentV132 = true;

            var aIdx = st.audioTrackIdxV216 || 0;
            var noAud = (st.videoStreamModeV217 === 'v_only') ? '1' : '0';
            var rawBaseUrl = st.rawTorStreamUrlV214 || st.currentUrl || '';
            var curSpdNow = Number(vd.speed || spd || 1.0);
            var cleanAnchor = Number(anchorPosSec.toFixed(1));

            // 1. Проверяем очередь готовых сегментов в оперативной памяти (st._revBlobQueueV223)
            var matchedBlobItem = null;
            if (!isInitialStart && Array.isArray(st._revBlobQueueV223) && st._revBlobQueueV223.length > 0) {
                while (st._revBlobQueueV223.length > 0) {
                    var candidate = st._revBlobQueueV223.shift();
                    if (candidate && candidate.blobUrl && candidate.aIdx === aIdx && Math.abs(candidate.anchorPos - cleanAnchor) <= 1.5) {
                        matchedBlobItem = candidate;
                        break;
                    } else if (candidate && candidate.blobUrl) {
                        try { URL.revokeObjectURL(candidate.blobUrl); } catch (e) {}
                    }
                }
            }

            var nextSrcUrl = '';
            var winLen = 6.0;
            var stepIdx = 0;

            if (matchedBlobItem) {
                nextSrcUrl = matchedBlobItem.blobUrl;
                cleanAnchor = matchedBlobItem.anchorPos;
                winLen = matchedBlobItem.winLen;
                stepIdx = matchedBlobItem.stepIdx;
                if (st._activeRevBlobUrlV223 && st._activeRevBlobUrlV223 !== nextSrcUrl) {
                    try { URL.revokeObjectURL(st._activeRevBlobUrlV223); } catch (e) {}
                }
                st._activeRevBlobUrlV223 = nextSrcUrl;
            } else {
                stepIdx = isInitialStart ? 0 : ((st._revCurrentStepIdxV223 || 0) + 1);
                var desiredWin = window.computeAdaptiveReverseWindowSecV223(stepIdx, curSpdNow);
                winLen = Number(Math.min(desiredWin, Math.max(1.2, cleanAnchor)).toFixed(1));
                nextSrcUrl = '/api/video/reverse_remux?src=' + encodeURIComponent(rawBaseUrl) +
                    '&pos=' + cleanAnchor.toFixed(1) +
                    '&win=' + winLen.toFixed(1) +
                    '&aidx=' + aIdx +
                    '&spd=' + curSpdNow.toFixed(2) +
                    '&no_audio=' + noAud +
                    '&t=' + Date.now();
            }

            var nextBoundarySec = Number(Math.max(0, cleanAnchor - winLen).toFixed(1));

            st._playingHardwareRevStreamV219 = true;
            st._revAnchorSecV219 = cleanAnchor;
            st._revWinLenV219 = winLen;
            st._revNextBoundarySecV223 = nextBoundarySec;
            st._revCurrentStepIdxV223 = stepIdx;
            st._revActiveAudioIdxV220 = aIdx;
            st._revLaunchWallTsV220 = performance.now();
            st._revStreamStartedPlayingV220 = false;
            st.usingRemux = true;

            if (vd.sourceNode) {
                vd.sourceNode.onended = null;
                try { vd.sourceNode.stop(); } catch (e) {}
                try { vd.sourceNode.disconnect(); } catch (e) {}
                vd.sourceNode = null;
            }
            vd.isStudioPlaying = false;
            vid.muted = (noAud === '1');
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = (noAud === '1' || st.dspBypass) ? 0.0 : 1.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = (noAud === '1') ? 0.0 : (st.dspBypass ? 1.0 : 0.0);

            var pumpTriggered = false;
            var onRevStreamReady = function() {
                if (st._revTrackSessionIdV220 !== myRevSession) return;
                st._revStreamStartedPlayingV220 = true;
                window._vidPlayIntentV132 = true;
                window._vidIsBufferingV132 = false;
                window.releaseHeldVideoFrameV220();

                var activeSpd = vd.speed || spd;
                try {
                    vid.preservesPitch = true;
                    vid.webkitPreservesPitch = true;
                    vid.defaultPlaybackRate = activeSpd;
                    vid.playbackRate = activeSpd;
                } catch (e) {}
                if (!st.userPaused && vid.paused) {
                    vid.play().catch(function(){});
                }
                if (typeof window.syncVideoPlayBtnIconV132 === 'function') window.syncVideoPlayBtnIconV132();

                // Как только текущий кусок пошёл играть — запускаем конвейер наполнения RAM-очереди (до 3 больших кусков вперёд!)
                if (!pumpTriggered && nextBoundarySec > 0.3) {
                    pumpTriggered = true;
                    window.pumpReverseRamBlobQueueV223(myRevSession);
                }
            };

            vid.addEventListener('loadeddata', onRevStreamReady, { once: true });
            vid.addEventListener('playing', onRevStreamReady, { once: true });

            vid.src = nextSrcUrl;
            try {
                vid.preservesPitch = true;
                vid.webkitPreservesPitch = true;
                vid.defaultPlaybackRate = curSpdNow;
                vid.playbackRate = curSpdNow;
            } catch (e) {}
            vid.play().catch(function() {
                window._vidPlayIntentV132 = !st.userPaused;
            });
        };

        launchReverseWindow(curMediaSec, true);

        st._hwRevTimerV220 = setInterval(function() {
            if (!st.active || st.userPaused || !vd.isReversed || st._revTrackSessionIdV220 !== myRevSession) {
                window.stopHardwareReverseTimerV220();
                return;
            }
            window._vidPlayIntentV132 = true;
            var anchor = Number(st._revAnchorSecV219 || curMediaSec);
            var progressed = st._revStreamStartedPlayingV220 ? Number(vid.currentTime || 0) : 0;
            var effTime = Math.max(0, anchor - progressed);
            var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : 0;

            st._pendingSeekSecV167 = effTime;
            st._pendingSeekTsV167 = performance.now();

            if (typeof window.updateProgressUIDeckB === 'function') {
                window.updateProgressUIDeckB(effTime, dur, true);
            }
            if (typeof window.syncInternalVideoSliderUIV212 === 'function') {
                window.syncInternalVideoSliderUIV212(effTime, dur);
            }

            if (effTime <= 0.15) {
                window.restoreNormalVideoPlaybackV217();
                return;
            }

            var winLen = Number(st._revWinLenV219 || 6.0);
            var actualDur = (isFinite(vid.duration) && vid.duration > 0.5) ? Math.min(winLen, vid.duration) : winLen;
            var sinceLaunchMs = performance.now() - (st._revLaunchWallTsV220 || 0);

            if (st._revStreamStartedPlayingV220 && (vid.ended || progressed >= actualDur - 0.10) && effTime > 0.25 && sinceLaunchMs > 300) {
                var nextAnchor = (st._revNextBoundarySecV223 !== undefined) ? st._revNextBoundarySecV223 : effTime;
                launchReverseWindow(nextAnchor, false);
            }
        }, 45);

        window.syncVideoPlayerButtonsUIV217();
    };
})();

/* [split] V224: кусок исходного IIFE (ui_v71.js, строки 26380–26627) → ui_video_reverse.js */
;(function() {
    if (window._jennyV224Installed__video_reverse) return;
    window._jennyV224Installed__video_reverse = true;
    window._jennyV224Installed = true;

    // Дополнительно ставим st._internalRevPause = true при технической паузе смены чанка в реверсе,
    // чтобы не мигала иконка ▶/⏸ и не вызывался wakeVideoHudV130(false)
    window.bindRevPauseGuardV224 = function() {
        var vidEl = document.getElementById('jennyVideoElV130');
        if (vidEl && !vidEl._v224RevPauseGuarded) {
            vidEl._v224RevPauseGuarded = true;
            vidEl.addEventListener('pause', function() {
                var st = window._vidStateV130 || {};
                var vd = window.videoDeckV131 || {};
                if (st.active && vd.isReversed && !st.userPaused) {
                    st._internalRevPause = true;
                }
            }, true);
        }
    };
    window.bindRevPauseGuardV224();

    setInterval(function() {
        window.bindRevPauseGuardV224();
    }, 1000);

    setTimeout(function() {
        window.renderHeaderSourcesHubV91(true);
        window.bindRevPauseGuardV224();
    }, 100);
})();

/* [split] V227: кусок исходного IIFE (ui_v71.js, строки 26642–27952) → ui_video_reverse.js */
;(function() {
    if (window._jennyV227Installed__video_reverse) return;
    window._jennyV227Installed__video_reverse = true;
    window._jennyV227Installed = true;

    // 2. Улучшенный запуск/переключение скорости реверса в RAM (на базе проверенного движка #318 / V223-V224):
    //    Если реверс уже запущен или находится в процессе открытия первого чанка, и пользователь ведёт пальцем
    //    по радиальной дуге скоростей (x2.0 -> x1.25 -> x1.5) — НЕ перезапускаем FFmpeg, а меняем только скорость!
    var _baseStartRevV223 = window.startImmediateVideoReverseEngineV217;
    window.startImmediateVideoReverseEngineV217 = function(revSpd, forceReloadTrackOrSeek, explicitStartSec) {
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        if (!vid || !st || !st.active || !vd) return;

        var spd = Math.max(0.1, Math.min(8.0, Number(revSpd) || window._lastRevVideoSpeedV217 || 1.0));
        window._lastRevVideoSpeedV217 = spd;

        // Если мы УЖЕ в режиме аппаратного реверса (даже если первый чанк ещё догружается и vid.paused временно true!)
        // и это просто смена скорости на дуге (forceReloadTrackOrSeek !== true) — меняем скорость на лету без сброса потока!
        if (!forceReloadTrackOrSeek && st._playingHardwareRevStreamV219 && st._revActiveAudioIdxV220 === (st.audioTrackIdxV216 || 0)) {
            window.isReversedDeckB = true;
            vd.isReversed = true;
            vd.speed = spd;
            window._jennyVideoSpeedV170 = spd;
            try {
                vid.defaultPlaybackRate = spd;
                vid.playbackRate = spd;
            } catch (e) {}
            window.syncDeckBSpeedLockIndicatorV227();
            window.syncVideoPlayerButtonsUIV217();
            return;
        }

        // Вычисляем точное стартовое время для реверса
        var startSec = (explicitStartSec !== undefined && isFinite(explicitStartSec))
            ? Number(explicitStartSec)
            : (st._lastTrueMediaSecV227 !== undefined ? Number(st._lastTrueMediaSecV227) : window.getEffectiveVideoCurrentTimeV167(vid));

        // Если видео стоит в самом начале (< 0.8 сек), а пользователь включает реверс —
        // в начале файла некуда идти назад, но если он прыгнет по полосе в середину — реверс сразу пойдёт оттуда!
        if (startSec <= 0.25) {
            window.isReversedDeckB = true;
            vd.isReversed = true;
            vd.speed = spd;
            window._jennyVideoSpeedV170 = spd;
            st._revAnchorSecV219 = startSec;
            st._revStreamStartedPlayingV220 = false;
            window.syncDeckBSpeedLockIndicatorV227();
            window.syncVideoPlayerButtonsUIV217();
            var dur0 = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : 0;
            window.updateProgressUIDeckB(startSec, dur0, true);
            return;
        }

        st._lastTrueMediaSecV227 = startSec;
        return _baseStartRevV223.call(this, spd, forceReloadTrackOrSeek, startSec);
    };

    // 6. Переключение направления по тапу на левый/правый боковой таймер — 1:1 как в Деке А (71561.mp4 02:45-02:55):
    //    - Тап по левому таймеру (#leftTimeBlockDeckB) -> включает Реверс на базовой скорости 1.0x (снимая замок дуги)
    //    - Тап по правому таймеру (#rightTimeBlockDeckB) -> включает Прямой ход на базовой скорости 1.0x (снимая замок дуги)
    window.toggleReverseModeDeckB = function(targetReversed) {
        var vid = document.getElementById('jennyVideoElV130');
        var vd = window.videoDeckV131;
        var st = window._vidStateV130;
        if (!vid || !vd || !st || !st.active) return;

        var wasReversedNow = Boolean(window.isReversedDeckB || vd.isReversed || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
        var wantRev = (targetReversed !== undefined) ? Boolean(targetReversed) : !wasReversedNow;
        var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (vid.duration || 0);
        var cur = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
        var baseSpd = typeof window.getBaseSpeedDeckB === 'function' ? window.getBaseSpeedDeckB() : 1.0;

        if (!wantRev) {
            window.scrubStateDeckB.active = false;
            window.scrubStateDeckB.locked = false;
            window.scrubStateDeckB.side = null;
            window.scrubStateDeckB.speed = baseSpd;
            window.scrubStateDeckB.isPhysicallyReversed = false;
            window.persistedPlaybackSpeedDeckB = null;
            window.persistedPlaybackSideDeckB = 'right';

            window.restoreNormalVideoPlaybackV217(null, baseSpd);
            window.syncDeckBSpeedLockIndicatorV227();
            window.updateProgressUIDeckB(cur, dur, false);
            return;
        }

        // Включаем реверс на базовой скорости 1.0x (точь-в-точь как в фиолетовой Деке А при тапе на левый таймер!)
        window.scrubStateDeckB.active = false;
        window.scrubStateDeckB.locked = false;
        window.scrubStateDeckB.side = null;
        window.scrubStateDeckB.speed = baseSpd;
        window.scrubStateDeckB.isPhysicallyReversed = false;
        window.persistedPlaybackSpeedDeckB = null;
        window.persistedPlaybackSideDeckB = 'right';

        window.startImmediateVideoReverseEngineV217(baseSpd, !wasReversedNow, cur);
        window.syncDeckBSpeedLockIndicatorV227();
        window.updateProgressUIDeckB(cur, dur, true);
    };
})();

/* [split] V369: кусок исходного IIFE (ui_v71.js, строки 36607–37839) → ui_video_reverse.js */
;(function() {
    if (window._jennyV369Installed__video_reverse) return;
    window._jennyV369Installed__video_reverse = true;
    window._jennyV369Installed = true;

    // 5. FIX REVERSE (`⏪`) SO IT RESPECTS PAUSE STATE (st.userPaused) LIKE AUDIO DECK A,
    //    PRIORITIZES THE CURRENT RAM PIECE, AND PLAYS BUFFER #4 WHEN NOT PAUSED!
    var _origStartRevV369 = window.startImmediateVideoReverseEngineV217;
    window.startImmediateVideoReverseEngineV217 = function(revSpd, forceReloadTrackOrSeek, explicitStartSec) {
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        if (!vid || !st || !st.active || !vd) return;

        var spd = Math.max(0.1, Math.min(8.0, Number(revSpd) || window._lastRevVideoSpeedV217 || 1.0));
        window._lastRevVideoSpeedV217 = spd;

        var startSec = (explicitStartSec !== undefined && isFinite(explicitStartSec))
            ? Number(explicitStartSec)
            : (window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (st._lastTrueMediaSecV227 || vid.currentTime || 0));

        // Immediately prioritize the RAM piece at `startSec` even while paused so Buffer #4 is ready!
        if (typeof vd._ensureUrgentPieceAtSecV369 === 'function') {
            vd._ensureUrgentPieceAtSecV369(startSec);
        }

        // [V371] Если Видеодека Б стоит на паузе (st.userPaused === true) — меняем направление на Реверс
        // и обновляем шкалу (-14:15 | 7:23), НО НЕ ВКЛЮЧАЕМ воспроизведение самопроизвольно (1:1 как в Деке А)!
        if (st.userPaused) {
            window.isReversedDeckB = true;
            vd.isReversed = true;
            vd.speed = spd;
            window._jennyVideoSpeedV170 = spd;
            st._pausedSeekSecV355 = startSec;
            st._revAnchorSecV219 = startSec;
            st._lastTrueMediaSecV227 = startSec;
            var durPaused = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (vid.duration || 0);
            if (typeof window.updateProgressUIDeckB === 'function') {
                window.updateProgressUIDeckB(startSec, durPaused, true);
            }
            if (typeof window.syncDeckBSpeedLockIndicatorV227 === 'function') {
                window.syncDeckBSpeedLockIndicatorV227();
            }
            if (typeof window.syncVideoPlayerButtonsUIV217 === 'function') {
                window.syncVideoPlayerButtonsUIV217();
            }
            if (typeof window.syncVideoPlayBtnIconV132 === 'function') {
                window.syncVideoPlayBtnIconV132();
            }
            if (typeof window.syncDeckBPlayBtnIconV216 === 'function') {
                window.syncDeckBPlayBtnIconV216();
            }
            return;
        }

        window._vidPlayIntentV132 = true;
        window._vidIsBufferingV132 = false;

        // Immediately prioritize the RAM piece at `startSec` if it isn't unpacked yet!
        if (typeof vd._ensureUrgentPieceAtSecV369 === 'function') {
            vd._ensureUrgentPieceAtSecV369(startSec);
        }

        st._revWallClockStartTsV369 = performance.now();
        st._revWallClockAnchorSecV369 = startSec;

        var res = _origStartRevV369 ? _origStartRevV369.call(this, revSpd, forceReloadTrackOrSeek, startSec) : undefined;

        // Immediately engage RAM Buffer #4 (`vd.reversedStudioBuffer`) in WebAudio so reversed sound starts in 0ms!
        if (typeof window.syncVideoRamEngineV211 === 'function') {
            window.syncVideoRamEngineV211(false, true);
        }
        if (typeof window.syncDeckBSpeedLockIndicatorV227 === 'function') {
            window.syncDeckBSpeedLockIndicatorV227();
        }
        if (typeof window.updateVideoAvSyncRadarUIV367 === 'function') {
            window.updateVideoAvSyncRadarUIV367();
        }
        return res;
    };
})();
