/* ============================================================================
 * ui_shade.js — Шторка: уведомление Android, MediaSession, фоновый режим
 *
 * Склейка:  /bundle_2_player.js, модуль 13 из 18. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   syncPermanentForegroundNotificationV212, checkBackgroundUnrestrictedStatusV212, requestBackgroundUnrestrictedV212, onBatteryOptUpdatedV212, updateBgShieldButtonsUIV212, onAndroidNotifLockChangedV237, toggleAndroidNotifLockFromUIV237, explicitMediaSessionPauseV240, explicitMediaSessionPlayV240, syncAndroidSafeInsetsV243
 * Откуда:   ui_v71.js (коммит 9ae6639), строки 17934…35451 (9 фрагментов, вперемешку с другими темами). Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */


/* [split] V212: кусок исходного IIFE (ui_v71.js, строки 17929–18897) → ui_shade.js */
;(function() {
    if (window._jennyV212Installed__shade) return;
    window._jennyV212Installed__shade = true;
    window._jennyV212Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    function bindUnifiedVideoPlayerSeekSliderV212() {
        var seek = document.getElementById('v130SeekSlider');
        var vid = document.getElementById('jennyVideoElV130');
        if (!seek || !vid) return;
        seek.max = '1000';
        seek.min = '0';
        if (seek._v212UnifiedBound) return;
        seek._v212UnifiedBound = true;

        var computeRatioFromEvent = function(e) {
            var clientX = undefined;
            if (e && e.touches && e.touches.length > 0) clientX = e.touches[0].clientX;
            else if (e && e.changedTouches && e.changedTouches.length > 0) clientX = e.changedTouches[0].clientX;
            else if (e && typeof e.clientX === 'number') clientX = e.clientX;

            var rect = seek.getBoundingClientRect();
            if (typeof clientX === 'number' && rect.width > 12) {
                return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            }
            var maxVal = parseFloat(seek.max) || 1000.0;
            return Math.max(0, Math.min(1, (parseFloat(seek.value) || 0) / maxVal));
        };

        var applyFromEvent = function(e, isCommit) {
            if (e) {
                if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                if (e.stopPropagation) e.stopPropagation();
            }
            var dur = window.getEffectiveVideoDurationV167(vid);
            if (!isFinite(dur) || dur <= 0) return;
            var ratio = computeRatioFromEvent(e);
            seek.max = '1000';
            seek.value = String(Math.round(ratio * 1000));
            var targetSec = ratio * dur;
            window.seekDeckBAndPlayerSyncedV212(targetSec, !isCommit);
            if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
            if (typeof window.wakeVideoHudControlsV209 === 'function') window.wakeVideoHudControlsV209();
        };

        seek.addEventListener('touchstart', function(e) {
            window._v130UserDraggingSeekV212 = true;
            applyFromEvent(e, false);
        }, { capture: true, passive: true });

        seek.addEventListener('touchmove', function(e) {
            window._v130UserDraggingSeekV212 = true;
            applyFromEvent(e, false);
        }, { capture: true, passive: true });

        var onTouchFinish = function(e) {
            if (!window._v130UserDraggingSeekV212) return;
            applyFromEvent(e, true);
            window._v130LastDragCommitTsV212 = performance.now();
            window._v130UserDraggingSeekV212 = false;
        };

        seek.addEventListener('touchend', onTouchFinish, { capture: true, passive: true });
        seek.addEventListener('touchcancel', onTouchFinish, { capture: true, passive: true });

        seek.addEventListener('mousedown', function(e) {
            window._v130UserDraggingSeekV212 = true;
            applyFromEvent(e, false);
        }, { capture: true });

        seek.addEventListener('mousemove', function(e) {
            if (!window._v130UserDraggingSeekV212) return;
            applyFromEvent(e, false);
        }, { capture: true });

        seek.addEventListener('mouseup', function(e) {
            if (!window._v130UserDraggingSeekV212) return;
            applyFromEvent(e, true);
            window._v130LastDragCommitTsV212 = performance.now();
            window._v130UserDraggingSeekV212 = false;
        }, { capture: true });

        seek.addEventListener('input', function(e) {
            if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
            if (e && e.stopPropagation) e.stopPropagation();
            window._v130UserDraggingSeekV212 = true;
            var dur = window.getEffectiveVideoDurationV167(vid);
            if (isFinite(dur) && dur > 0) {
                seek.max = '1000';
                var ratio = Math.max(0, Math.min(1, (parseFloat(seek.value) || 0) / 1000.0));
                window.seekDeckBAndPlayerSyncedV212(ratio * dur, true);
            }
        }, { capture: true });

        seek.addEventListener('change', function(e) {
            if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
            if (e && e.stopPropagation) e.stopPropagation();
            var dur = window.getEffectiveVideoDurationV167(vid);
            if (isFinite(dur) && dur > 0) {
                seek.max = '1000';
                var ratio = Math.max(0, Math.min(1, (parseFloat(seek.value) || 0) / 1000.0));
                window.seekDeckBAndPlayerSyncedV212(ratio * dur, false);
            }
            window._v130LastDragCommitTsV212 = performance.now();
            window._v130UserDraggingSeekV212 = false;
        }, { capture: true });

        seek.addEventListener('click', function(e) {
            applyFromEvent(e, true);
            window._v130LastDragCommitTsV212 = performance.now();
            window._v130UserDraggingSeekV212 = false;
        }, { capture: true });
    }
    function bindLocalVideoNoBufferGuardV212() {
        var v = document.getElementById('jennyVideoElV130');
        if (!v || v._v212NoBufferHooked) return;
        v._v212NoBufferHooked = true;

        v.addEventListener('waiting', function() {
            var st = window._vidStateV130;
            if (st && (st.isReadyLocalV212 || !st.torHash)) {
                window._vidIsBufferingV132 = false;
                if (typeof window.syncVideoPlayBtnIconV132 === 'function') {
                    window.syncVideoPlayBtnIconV132();
                }
            } else {
                // Если поток реально ждёт подкачки видеокадров — тормозим RAM-звук, чтобы звук не шёл без видео!
                window.syncVideoRamEngineV211(false);
            }
        }, true);

        var onFramesReady = function() {
            window._vidIsBufferingV132 = false;
            if (typeof window.syncVideoPlayBtnIconV132 === 'function') {
                window.syncVideoPlayBtnIconV132();
            }
            window.syncVideoRamEngineV211(false);
        };

        v.addEventListener('canplay', onFramesReady);
        v.addEventListener('playing', onFramesReady);
        v.addEventListener('loadeddata', onFramesReady);
        v.addEventListener('pause', function() {
            if (window._vidStateV130 && !window._vidStateV130._internalRevPause) {
                window.syncVideoRamEngineV211(false);
            }
        });
    }
    window._bgUnrestrictedGrantedV212 = true;

    // 7. ПОСТОЯННАЯ ПЛАШКА УВЕДОМЛЕНИЯ (FOREGROUND SERVICE 24/7) + ЗАЩИТА ОТ ЗАСЫПАНИЯ ANDROID
    window.syncPermanentForegroundNotificationV212 = function(force) {
        if (!window.AndroidBridge) return;
        var now = Date.now();
        if (!force && now - (window._lastPermNotifSyncTsV212 || 0) < 1200) return;
        window._lastPermNotifSyncTsV212 = now;

        var player = document.getElementById('audioPlayer');
        var vid = document.getElementById('jennyVideoElV130');
        var stVid = window._vidStateV130;

        var audioActive = Boolean(player && window.currentPlayingTrack && !player.paused);
        var videoActive = Boolean(vid && stVid && stVid.active && !vid.paused);

        var torSnap = window._torLiveDaemonSnapV128 || [];
        var activeTorCnt = 0, sumKbps = 0, sumDoneB = 0, sumLenB = 0;
        torSnap.forEach(function(t) {
            var files = t.files || [];
            if (files.some(function(f) { return !f.done; }) && !t.paused) {
                activeTorCnt++;
                sumKbps += (t.speed_kbps || 0);
                files.forEach(function(f) {
                    sumLenB += (f.length || 0);
                    sumDoneB += (f.completed || 0);
                });
            }
        });
        var torPct = sumLenB > 0 ? Math.min(99, Math.floor((sumDoneB * 100) / sumLenB)) : 0;

        var titleParts = [];
        if (audioActive && window.currentPlayingTrack) {
            var cleanA = String(window.currentPlayingTrack).replace(/\.(opus|m4a|mp3|wav|flac|ogg|xflac)$/i, '');
            titleParts.push('🎵 ' + cleanA);
        }
        if (stVid && stVid.active && stVid.currentTitle) {
            var cleanB = String(stVid.currentTitle).replace(/\.(mp4|mkv|webm|avi|mov)$/i, '');
            titleParts.push('🎬 ' + cleanB);
        }
        if (titleParts.length === 0) {
            if (activeTorCnt > 0) {
                titleParts.push('🧲 Закачка P2P (' + activeTorCnt + ' разд. • ' + torPct + '%)');
            } else if (window.currentPlayingTrack) {
                var pausedA = String(window.currentPlayingTrack).replace(/\.(opus|m4a|mp3|wav|flac|ogg|xflac)$/i, '');
                titleParts.push('⏸ ' + pausedA);
            } else {
                titleParts.push('🛡️ Jenny Player • Студия 24/7');
            }
        }
        var finalTitle = titleParts.join(' │ ');

        var subParts = [];
        if (activeTorCnt > 0) {
            subParts.push('⚡ P2P: ' + sumKbps + ' КБ/с (' + torPct + '%)');
        }
        if (audioActive && videoActive) {
            subParts.push('🎛️ Дека А + Дека Б (4 RAM буфера)');
        } else if (videoActive) {
            subParts.push('🎬 Дека Б: x' + ((window.videoDeckV131 && window.videoDeckV131.speed) || 1.0));
        } else if (audioActive) {
            subParts.push('🎵 Дека А: x' + (player.playbackRate || 1.0));
        } else {
            subParts.push('🛡️ Фоновый сервис активен (Защита от сна ВКЛ)');
        }
        var finalSub = subParts.join(' • ');

        var posSec = 0, durSec = 0, spd = 1.0;
        if (audioActive && player) {
            durSec = (isFinite(player.duration) && player.duration > 0) ? player.duration : (window.studioBuffer ? window.studioBuffer.duration : 0);
            posSec = isFinite(player.currentTime) ? player.currentTime : 0;
            spd = player.playbackRate || 1.0;
        } else if (videoActive && vid) {
            durSec = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(vid) : (vid.duration || 0);
            posSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
            spd = (window.videoDeckV131 && window.videoDeckV131.speed) || vid.playbackRate || 1.0;
        }

        var keepAlivePlaying = true;

        try {
            if (typeof window.AndroidBridge.updateMediaStateFull === 'function') {
                window.AndroidBridge.updateMediaStateFull(finalTitle, finalSub, keepAlivePlaying, posSec, durSec, spd);
            } else if (typeof window.AndroidBridge.updateMediaState === 'function') {
                window.AndroidBridge.updateMediaState(finalTitle + ' || ' + finalSub, keepAlivePlaying, posSec, durSec, spd);
            }
        } catch (e) {}
    };

    window.syncAndroidNotification = window.syncPermanentForegroundNotificationV212;

    // 8. Проверка и запрос разрешения «Работать в фоне без ограничений» (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
    window.checkBackgroundUnrestrictedStatusV212 = async function() {
        try {
            if (window.AndroidBridge && typeof window.AndroidBridge.isIgnoringBatteryOptimizations === 'function') {
                window._bgUnrestrictedGrantedV212 = Boolean(window.AndroidBridge.isIgnoringBatteryOptimizations());
            } else {
                var r = await fetch('/api/android/bg_status');
                if (r.ok) {
                    var d = await r.json();
                    window._bgUnrestrictedGrantedV212 = Boolean(d.ignoring_battery_optimizations);
                }
            }
        } catch (e) {}
        window.updateBgShieldButtonsUIV212();
        return window._bgUnrestrictedGrantedV212;
    };

    window.requestBackgroundUnrestrictedV212 = async function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        window.syncPermanentForegroundNotificationV212(true);
        try {
            if (window.AndroidBridge && typeof window.AndroidBridge.requestIgnoreBatteryOptimizations === 'function') {
                window.AndroidBridge.requestIgnoreBatteryOptimizations();
            } else {
                await fetch('/api/android/request_bg_unrestricted', { method: 'POST' });
            }
            if (typeof window.showToast === 'function') {
                window.showToast('🛡️ Выбери «Нет ограничений» / «Разрешить» для работы торрента и звука в фоне 24/7!');
            }
        } catch (e) {}
        setTimeout(window.checkBackgroundUnrestrictedStatusV212, 1500);
        setTimeout(window.checkBackgroundUnrestrictedStatusV212, 4000);
    };

    window.onBatteryOptUpdatedV212 = function(granted) {
        window._bgUnrestrictedGrantedV212 = Boolean(granted);
        window.updateBgShieldButtonsUIV212();
        if (granted && typeof window.showToast === 'function') {
            window.showToast('✅ Фоновый режим 24/7 без ограничений батареи активирован!');
        }
    };

    window.updateBgShieldButtonsUIV212 = function() {
        var ok = Boolean(window._bgUnrestrictedGrantedV212);
        var btnTor = document.getElementById('btnTorBgShieldV212');
        if (btnTor) {
            btnTor.style.borderColor = ok ? '#3fb950' : '#e3b341';
            btnTor.style.color = ok ? '#3fb950' : '#e3b341';
            btnTor.style.background = ok ? 'rgba(63,185,80,0.16)' : 'rgba(227,179,65,0.18)';
            btnTor.innerText = ok ? '🛡️ Фон 24/7' : '⚠️ Разрешить фон';
        }
        var btnSet = document.getElementById('btnSettingsBgShieldV212');
        if (btnSet) {
            btnSet.className = 'jenny-deck-pill-v211 ' + (ok ? 'active-a' : '');
            btnSet.innerHTML = ok
                ? '<span>🛡️</span><span>Фон 24/7 + Уведомление: АКТИВНЫ</span><span class="deck-dot"></span>'
                : '<span>⚠️</span><span>Разрешить работу в фоне без ограничений (Анти-сон)</span>';
        }
    };

    function mountBgShieldButtonsV212() {
        // V214: Кнопка '🛡️ Фон 24/7' перенесена в Шаг 2 стартового гида (Onboarding V165),
        // чтобы не загромождать шапку Торрент-студии и окно Настроек.
        var b1 = document.getElementById('btnTorBgShieldV212');
        if (b1) b1.remove();
        var b2 = document.getElementById('btnSettingsBgShieldV212');
        if (b2 && b2.parentElement) b2.parentElement.remove();
    }

    setInterval(function() {
        bindLocalVideoNoBufferGuardV212();
        bindUnifiedVideoPlayerSeekSliderV212();
        mountBgShieldButtonsV212();
        window.syncPermanentForegroundNotificationV212(false);
    }, 1500);

    setTimeout(function() {
        bindLocalVideoNoBufferGuardV212();
        bindUnifiedVideoPlayerSeekSliderV212();
        mountBgShieldButtonsV212();
        window.syncPermanentForegroundNotificationV212(true);
        window.checkBackgroundUnrestrictedStatusV212();
    }, 500);
})();

/* [split] V216: кусок исходного IIFE (ui_v71.js, строки 19638–21240) → ui_shade.js */
;(function() {
    if (window._jennyV216Installed__shade) return;
    window._jennyV216Installed__shade = true;
    window._jennyV216Installed = true;

    // -------------------------------------------------------------------------
    // 12. ОСВОБОЖДЕНИЕ АУДИОФОКУСА ANDROID ПРИ ПАУЗЕ (ЧТОБЫ YOUTUBE НЕ БЛОКИРОВАЛСЯ!)
    //     (71419.mp4, 00:34-02:05)
    // -------------------------------------------------------------------------
    var _origSyncPermNotifV216 = window.syncPermanentForegroundNotificationV212;
    window.syncPermanentForegroundNotificationV212 = function(force) {
        if (!window.AndroidBridge) return;
        var now = Date.now();
        if (!force && now - (window._lastPermNotifSyncTsV212 || 0) < 1500) return;

        var player = document.getElementById('audioPlayer');
        var vid = document.getElementById('jennyVideoElV130');
        var stVid = window._vidStateV130;

        var audioActive = Boolean(player && window.currentPlayingTrack && !player.paused);
        var videoActive = Boolean(vid && stVid && stVid.active && !vid.paused);
        var isActuallyPlaying = Boolean(audioActive || videoActive);

        // Если ни музыка, ни видео сейчас не играют, и прошлой синхронизацией мы уже перевели уведомление в режим паузы —
        // НЕ спамим Android MediaSession каждые 1.5 сек, чтобы не отбирать звук у YouTube и не дёргать ползунок 00:00 <-> 00:01!
        if (!isActuallyPlaying && window._lastNotifPlayingStateV216 === false && !force) {
            var torSnapCheck = window._torLiveDaemonSnapV128 || [];
            var hasActiveTor = torSnapCheck.some(function(t) {
                return !t.paused && (t.files || []).some(function(f) { return !f.done; });
            });
            if (!hasActiveTor) return;
        }
        window._lastNotifPlayingStateV216 = isActuallyPlaying;
        window._lastPermNotifSyncTsV212 = now;

        var torSnap = window._torLiveDaemonSnapV128 || [];
        var activeTorCnt = 0, sumKbps = 0, sumDoneB = 0, sumLenB = 0;
        torSnap.forEach(function(t) {
            var files = t.files || [];
            if (files.some(function(f) { return !f.done; }) && !t.paused) {
                activeTorCnt++;
                sumKbps += (t.speed_kbps || 0);
                files.forEach(function(f) {
                    sumLenB += (f.length || 0);
                    sumDoneB += (f.completed || 0);
                });
            }
        });
        var torPct = sumLenB > 0 ? Math.min(99, Math.floor((sumDoneB * 100) / sumLenB)) : 0;

        var titleParts = [];
        if (audioActive && window.currentPlayingTrack) {
            var cleanA = String(window.currentPlayingTrack).replace(/\.(opus|m4a|mp3|wav|flac|ogg|xflac)$/i, '');
            titleParts.push('🎵 ' + cleanA);
        }
        if (stVid && stVid.active && stVid.currentTitle) {
            var cleanB = String(stVid.currentTitle).replace(/\.(mp4|mkv|webm|avi|mov)$/i, '');
            titleParts.push('🎬 ' + cleanB);
        }
        if (titleParts.length === 0) {
            if (activeTorCnt > 0) {
                titleParts.push('🧲 Закачка P2P (' + activeTorCnt + ' разд. • ' + torPct + '%)');
            } else if (window.currentPlayingTrack) {
                var pausedA = String(window.currentPlayingTrack).replace(/\.(opus|m4a|mp3|wav|flac|ogg|xflac)$/i, '');
                titleParts.push('⏸ ' + pausedA);
            } else {
                titleParts.push('🛡️ Jenny Player • Студия 24/7');
            }
        }
        var finalTitle = titleParts.join(' │ ');

        var subParts = [];
        if (activeTorCnt > 0) {
            subParts.push('⚡ P2P: ' + sumKbps + ' КБ/с (' + torPct + '%)');
        }
        if (audioActive && videoActive) {
            subParts.push('🎛️ Дека А + Дека Б');
        } else if (videoActive) {
            subParts.push('🎬 Дека Б: x' + ((window.videoDeckV131 && window.videoDeckV131.speed) || 1.0));
        } else if (audioActive) {
            subParts.push('🎵 Дека А: x' + (player.playbackRate || 1.0));
        } else {
            subParts.push('🛡️ Фоновый сервис (Пауза)');
        }
        var finalSub = subParts.join(' • ');

        var posSec = 0, durSec = 0, spd = 1.0;
        if (audioActive && player) {
            durSec = (isFinite(player.duration) && player.duration > 0) ? player.duration : (window.studioBuffer ? window.studioBuffer.duration : 0);
            posSec = isFinite(player.currentTime) ? player.currentTime : 0;
            spd = player.playbackRate || 1.0;
        } else if (videoActive && vid) {
            durSec = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(vid) : (vid.duration || 0);
            posSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
            spd = (window.videoDeckV131 && window.videoDeckV131.speed) || vid.playbackRate || 1.0;
        }

        try {
            if (typeof window.AndroidBridge.updateMediaStateFull === 'function') {
                window.AndroidBridge.updateMediaStateFull(finalTitle, finalSub, isActuallyPlaying, posSec, durSec, spd);
            } else if (typeof window.AndroidBridge.updateMediaState === 'function') {
                window.AndroidBridge.updateMediaState(finalTitle + ' || ' + finalSub, isActuallyPlaying, posSec, durSec, spd);
            }
        } catch (e) {}
    };
    window.syncAndroidNotification = window.syncPermanentForegroundNotificationV212;
})();

/* [split] V237: кусок исходного IIFE (ui_v71.js, строки 31602–32550) → ui_shade.js */
;(function() {
    if (window._jennyV237Installed__shade) return;
    window._jennyV237Installed__shade = true;
    window._jennyV237Installed = true;

    window.onAndroidNotifLockChangedV237 = function(locked) {
        try { localStorage.setItem('jenny_notif_locked_v237', locked ? '1' : '0'); } catch (e) {}
        var btn = document.getElementById('btnLockBgNotifV237');
        var lbl = document.getElementById('lblLockBgNotifStateV237');
        if (btn) {
            btn.style.borderColor = locked ? '#3fb950' : '#30363d';
            btn.style.color = locked ? '#3fb950' : '#8b949e';
        }
        if (lbl) {
            lbl.textContent = locked ? '🔒 ЗАКРЕПЛЕНО' : '🔓 СВОБОДНО';
        }
    };

    window.toggleAndroidNotifLockFromUIV237 = function(ev) {
        var cur = localStorage.getItem('jenny_notif_locked_v237') !== '0';
        var next = !cur;
        window.onAndroidNotifLockChangedV237(next);
        if (window.AndroidBridge && typeof window.AndroidBridge.setNotificationLockState === 'function') {
            try { window.AndroidBridge.setNotificationLockState(next); } catch (e) {}
        }
        if (typeof window.showToast === 'function') {
            window.showToast(next ? '🔒 Уведомление заблокировано от смахивания (DataSync 24/7)' : '🔓 Блокировка уведомления снята', ev);
        }
    };

    // -------------------------------------------------------------------------
    // 5. FOREGROUND SERVICE DATASYNC NOTIFICATION SYNC (KEEP ALIVE WHEN DOWNLOADING WITHOUT PLAYBACK)
    // -------------------------------------------------------------------------
    var _origSyncPermNotifV237 = window.syncPermanentForegroundNotificationV212;
    window.syncPermanentForegroundNotificationV212 = function(force) {
        if (typeof _origSyncPermNotifV237 === 'function') {
            try { _origSyncPermNotifV237.apply(this, arguments); } catch (e) {}
        }
        if (!window.AndroidBridge || typeof window.AndroidBridge.updateDataSyncState !== 'function') return;

        var activeJobs = Object.values(window._torMapV112 || {}).filter(function(j) { return Boolean(j && j.dlActive); });
        var te = window._lastTorEncBadgeV212 || {};
        var khBusy = Boolean(window._khStateV88 && window._khStateV88.isDownloading);
        var radRec = Boolean(window._radioStateV91 && window._radioStateV91.isRecording);
        var isDlActive = Boolean(activeJobs.length > 0 || (te && te.active) || khBusy || radRec);

        var dlTitle = '🧲 Jenny DataSync • Закачка в фоне';
        var dlStatus = 'Фоновый сервис активен';
        var dlPct = -1;

        if (activeJobs.length > 0) {
            var j0 = activeJobs[0];
            var totT = Math.max(1, (j0.targetSet && j0.targetSet.size) || (j0.files && j0.files.length) || 1);
            var rdy = j0.readyCnt || 0;
            dlPct = Math.max(0, Math.min(100, Number(j0.netPct || 0)));
            dlTitle = (te && te.active)
                ? ('🧬 Пережатие xFLAC [' + rdy + '/' + totT + '] • ' + (te.track_pct || 0) + '%')
                : ('🧲 P2P Загрузка: ' + dlPct + '% (в плеере: ' + rdy + '/' + totT + ')');
            var spd = j0.speedKbps > 0 ? ('⚡ ' + j0.speedKbps + ' КБ/с • ') : '';
            dlStatus = spd + 'Сидов: ' + (j0.seeders || 0) + ' • Пиров: ' + (j0.peers || 0) + (activeJobs.length > 1 ? (' • Раздач: ' + activeJobs.length) : '');
        } else if (te && te.active) {
            dlPct = Math.max(0, Math.min(100, Number(te.track_pct || 0)));
            dlTitle = '🧬 Пережатие в .xFLAC: ' + dlPct + '%';
            dlStatus = te.current_track || 'Упаковка Lossless в .xFLAC...';
        } else if (khBusy) {
            dlTitle = '🎮 Загрузка треков OST / Архива...';
            dlStatus = 'Фоновая закачка в медиатеку';
        } else if (radRec) {
            dlTitle = '📻 Запись радиоэфира...';
            dlStatus = 'Фоновая запись потока';
        }

        var sig = [isDlActive, dlTitle, dlStatus, dlPct].join('|');
        if (!force && window._lastDataSyncNotifSigV237 === sig) return;
        window._lastDataSyncNotifSigV237 = sig;

        try {
            window.AndroidBridge.updateDataSyncState(isDlActive, dlTitle, dlStatus, dlPct);
        } catch (e) {}
    };

    setInterval(function() {
        window.syncPermanentForegroundNotificationV212(false);
    }, 1500);
})();
/* ================= END JENNY_V239_HOTFIX_PLAYBACK_TORPREVIEW_AND_ROW_HEIGHT ================= */

/* ================= BEGIN JENNY_V240_ISOLATION_RADIO_OST_AND_SMART_VIDEO_PATCH ================= */
/* [split] V240: кусок исходного IIFE (ui_v71.js, строки 32979–33429) → ui_shade.js */
;(function() {
    if (window._jennyV240Installed__shade) return;
    window._jennyV240Installed__shade = true;
    window._jennyV240Installed = true;

    // -------------------------------------------------------------------------
    // 1. STRICT MEDIASESSION PLAY vs PAUSE SEPARATION (NEVER HIJACK TOTAL COMMANDER / EXTERNAL PLAYERS!)
    // -------------------------------------------------------------------------
    window.explicitMediaSessionPauseV240 = function() {
        // Pause Deck A (both HTML5 <audio> and WebAudio 32-bit Studio RAM!) WITHOUT ever toggling Play!
        if (typeof window.onExternalAudioInterruptV237 === 'function') {
            window.onExternalAudioInterruptV237();
        } else if (typeof window.forceStopPauseDeckAAudioV232 === 'function') {
            window.forceStopPauseDeckAAudioV232(false);
        }
        // Also pause any active Radio / OST / SoundCloud preview stream
        if (window._radioStateV91 && window._radioStateV91.audio && !window._radioStateV91.audio.paused) {
            if (typeof window.stopFlacRadioStreamV91 === 'function') window.stopFlacRadioStreamV91();
        }
        if (window._khStateV88 && window._khStateV88.previewAudio && !window._khStateV88.previewAudio.paused) {
            if (typeof window.stopKhPreviewV88 === 'function') window.stopKhPreviewV88();
        }
        // Also pause Deck B <video> if active and playing
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        if (vid && st && st.active && !vid.paused) {
            st.userPaused = true;
            window._vidPlayIntentV132 = false;
            try { vid.pause(); } catch (e) {}
            if (typeof window.syncVideoPlayBtnIconV132 === 'function') window.syncVideoPlayBtnIconV132();
            if (typeof window.syncVideoPlayerButtonsUIV217 === 'function') window.syncVideoPlayerButtonsUIV217();
        }
        if ('mediaSession' in navigator) {
            try { navigator.mediaSession.playbackState = 'paused'; } catch (e) {}
        }
        if (typeof window.syncAndroidNotification === 'function') {
            window.syncAndroidNotification(true);
        }
    };

    window.explicitMediaSessionPlayV240 = function() {
        var isPlayingA = (typeof window.isDeckAActuallyPlayingV232 === 'function')
            ? window.isDeckAActuallyPlayingV232()
            : false;
        if (!isPlayingA && window.currentPlayingTrack && typeof window.togglePlay === 'function') {
            window.togglePlay();
        }
    };

    var enforceSafeNavigatorMediaSessionV240 = function() {
        if ('mediaSession' in navigator) {
            try {
                navigator.mediaSession.setActionHandler('play', function() {
                    window.explicitMediaSessionPlayV240();
                });
                navigator.mediaSession.setActionHandler('pause', function() {
                    window.explicitMediaSessionPauseV240();
                });
                navigator.mediaSession.setActionHandler('stop', function() {
                    window.explicitMediaSessionPauseV240();
                });
                var playingNow = (typeof window.isDeckAActuallyPlayingV232 === 'function' && window.isDeckAActuallyPlayingV232())
                    || Boolean(window._vidStateV130 && window._vidStateV130.active && !window._vidStateV130.userPaused);
                navigator.mediaSession.playbackState = playingNow ? 'playing' : 'paused';
            } catch (e) {}
        }
    };
    enforceSafeNavigatorMediaSessionV240();
    setInterval(enforceSafeNavigatorMediaSessionV240, 1500);
})();

/* [split] V243: кусок исходного IIFE (ui_v71.js, строки 35225–35944) → ui_shade.js */
;(function() {
    if (window._jennyV243Installed__shade) return;
    window._jennyV243Installed__shade = true;
    window._jennyV243Installed = true;
    window._lastNotifSigV243 = '';

    window.syncAndroidSafeInsetsV243 = function() {
        var topDp = 28, botDp = 22, isOv = false, isFs = false;
        try {
            if (window.AndroidBridge && typeof window.AndroidBridge.getSafeAreaInsetsJson === 'function') {
                var parsed = JSON.parse(window.AndroidBridge.getSafeAreaInsetsJson() || '{}');
                if (parsed) {
                    isOv = Boolean(parsed.overlay);
                    isFs = Boolean(parsed.fullscreen);
                    if (typeof parsed.top === 'number') topDp = parsed.top;
                    if (typeof parsed.bottom === 'number') botDp = parsed.bottom;
                }
            }
        } catch (e) {}
        var stVid = window._vidStateV130 || {};
        if (isOv || stVid.desktopOverlay) {
            topDp = 0;
            botDp = 0;
        } else if (isFs || stVid.nativeFullscreen) {
            botDp = 0;
        }
        var rootEl = document.documentElement;
        rootEl.style.setProperty('--jenny-safe-top', topDp + 'px');
        rootEl.style.setProperty('--jenny-safe-bottom', botDp + 'px');
    };

    // -------------------------------------------------------------------------
    // 2. ЗАКРЫТИЕ «ВЫБЕРИ ИСТОЧНИК» И ГРОМКОСТИ ДЕКИ Б/А ПО ТАПУ МИМО (CAPTURE PHASE)
    // -------------------------------------------------------------------------
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
})();
