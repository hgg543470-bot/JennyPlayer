/* ============================================================================
 * ui_shade_v243.js — Шторка, поздняя часть (V243–V244): итоговое уведомление, отметка касаний, безопасные отступы
 *
 * Склейка:  /bundle_2_player.js, модуль 17 из 18. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   syncAndroidNotification, syncAndroidSafeInsetsV243
 * Откуда:   ui_v71.js (коммит 9ae6639), строки 35452–35454, 35756–35848, 35930–35954. Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
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
            titleParts.push('🎧 ' + (window._lastExternalTitleV243 || 'SoundCloud / Поток'));
            subParts.push('☁️ Потоковое прослушивание');
            durSec = isFinite(snap.extAud.duration) ? snap.extAud.duration : 0;
            posSec = isFinite(snap.extAud.currentTime) ? snap.extAud.currentTime : 0;
        } else {
            if (snap.deckAPlaying && window.currentPlayingTrack) {
                var cleanA = String(window.currentPlayingTrack).replace(/\.(opus|m4a|mp3|wav|flac|ogg|xflac)$/i, '');
                titleParts.push('🎵 ' + cleanA);
                durSec = (snap.player && isFinite(snap.player.duration) && snap.player.duration > 0) ? snap.player.duration : (window.studioBuffer ? window.studioBuffer.duration : 0);
                posSec = (typeof window.getTruePlaybackTimeV74_2 === 'function')
                    ? window.getTruePlaybackTimeV74_2()
                    : ((snap.player && isFinite(snap.player.currentTime)) ? snap.player.currentTime : 0);
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

        // Если выбран режим-заглушка YouTube
        if (window._islandActiveModeV245 === 'youtube' && (now - (window._islandExplicitModeTsV245 || 0) < 600000) && !isActuallyPlaying) {
            titleParts = ['▶️ YouTube Studio • Модуль в разработке'];
            subParts = ['🚧 Скоро: потоковое аудио и видео YouTube без ограничений'];
        } else if (!isActuallyPlaying) {
            var lastSrc = window._lastActiveMediaSourceV243 || 'deckA';
            if ((lastSrc === 'radio' || window._islandActiveModeV245 === 'radio') && (window._lastRadioTitleV243 || (window._radioStateV91 && window._radioStateV91.currentStation))) {
                titleParts.push('⏸ 📻 ' + window.resolveCurrentRadioTitleV243());
                subParts.push('📻 Радиоэфир на паузе');
            } else if (window._islandActiveModeV245 === 'soundcloud' && (now - (window._islandExplicitModeTsV245 || 0) < 600000)) {
                titleParts.push('☁️ ' + (window._lastExternalTitleV243 || 'SoundCloud Studio'));
                subParts.push('☁️ Готов к потоковому воспроизведению');
                if (snap.extAud) {
                    durSec = isFinite(snap.extAud.duration) ? snap.extAud.duration : 0;
                    posSec = isFinite(snap.extAud.currentTime) ? snap.extAud.currentTime : 0;
                }
            } else if (lastSrc === 'deckB' && snap.stVid && snap.stVid.active && snap.stVid.currentTitle) {
                titleParts.push('⏸ 🎬 ' + String(snap.stVid.currentTitle).replace(/\.(mp4|mkv|webm|avi|mov)$/i, ''));
                subParts.push('🎬 Видео на паузе');
                if (snap.vid) {
                    durSec = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(snap.vid) : (snap.vid.duration || 0);
                    posSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(snap.vid) : (snap.vid.currentTime || 0);
                }
            } else if (activeTorCnt > 0) {
                titleParts.push('🧲 Закачка P2P (' + activeTorCnt + ' разд. • ' + torPct + '%)');
                subParts.push('📥 Фоновая загрузка активна');
            } else if (window.currentPlayingTrack) {
                titleParts.push('⏸ ' + String(window.currentPlayingTrack).replace(/\.(opus|m4a|mp3|wav|flac|ogg|xflac)$/i, ''));
                subParts.push('🎵 На паузе');
                durSec = (snap.player && isFinite(snap.player.duration) && snap.player.duration > 0) ? snap.player.duration : (window.studioBuffer ? window.studioBuffer.duration : 0);
                posSec = (typeof window.getTruePlaybackTimeV74_2 === 'function')
                    ? window.getTruePlaybackTimeV74_2()
                    : ((snap.player && isFinite(snap.player.currentTime)) ? snap.player.currentTime : 0);
            } else {
                titleParts.push('🛡️ Jenny Player');
                subParts.push('Готов к воспроизведению');
            }
        }

        // Определяем активный модуль для плашки Dynamic Island
        var activeMode = window._islandActiveModeV245 || 'music';
        if (snap.radioPlaying) {
            activeMode = 'radio';
            window._islandActiveModeV245 = 'radio';
        } else if (snap.extPlaying) {
            activeMode = 'soundcloud';
            window._islandActiveModeV245 = 'soundcloud';
        } else if (snap.deckAPlaying || snap.deckBPlaying) {
            if (activeMode !== 'youtube' || (now - (window._islandExplicitModeTsV245 || 0) > 3000)) {
                activeMode = 'music';
                window._islandActiveModeV245 = 'music';
            }
        }

        var isFav = Boolean(window.currentPlayingTrack && Array.isArray(window.favorites) && window.favorites.indexOf(window.currentPlayingTrack) !== -1);

        var finalTitle = titleParts.join(' │ ');
        var finalSub = subParts.join(' • ');
        var curSig = finalTitle + '|' + finalSub + '|' + (isActuallyPlaying ? '1' : '0') + '|' + (isFav ? 'F1' : 'F0') + '|' + activeMode;

        if (!force && curSig === window._lastNotifSigV243 && (!isActuallyPlaying || (now - (window._lastPermNotifSyncTsV212 || 0) < 900))) {
            return;
        }
        window._lastNotifSigV243 = curSig;
        window._lastPermNotifSyncTsV212 = now;

        try {
            if (typeof window.AndroidBridge.updateIslandExtraState === 'function') {
                window.AndroidBridge.updateIslandExtraState(isFav, activeMode, String(window.currentPlayingTrack || ''));
            }
            if (typeof window.AndroidBridge.updateMediaStateFull === 'function') {
                window.AndroidBridge.updateMediaStateFull(finalTitle, finalSub, isActuallyPlaying, posSec, durSec, spd);
            } else if (typeof window.AndroidBridge.updateMediaState === 'function') {
                window.AndroidBridge.updateMediaState(finalTitle + ' || ' + finalSub, isActuallyPlaying, posSec, durSec, spd);
            }
        } catch (e) {}
    };

    // Обработчик команд из кастомного оверлея Dynamic Island (V245)
    window.handleIslandCommandV245 = function(cmd, arg) {
        var c = String(cmd || '').toLowerCase();
        var a = String(arg || '');
        var snap = window.getActiveSourcesSnapshotV243 ? window.getActiveSourcesSnapshotV243() : {};

        if (c === 'fav') {
            var trk = window.currentPlayingTrack;
            if (!trk && Array.isArray(window.allTracks) && window.allTracks.length > 0) {
                trk = window.allTracks[0];
                window.currentPlayingTrack = trk;
            }
            if (trk && typeof window.toggleFav === 'function') {
                window.toggleFav(trk);
                var nowFav = Array.isArray(window.favorites) && window.favorites.indexOf(trk) !== -1;
                if (typeof window.showToast === 'function') {
                    window.showToast(nowFav ? '❤️ Трек добавлен в Избранное' : '🤍 Удалено из Избранного');
                }
            } else if (typeof window.showToast === 'function') {
                window.showToast('🎵 Сначала выберите музыкальный трек');
            }
            window.syncPermanentForegroundNotificationV212(true);
            return;
        }

        if (c === 'seek') {
            var targetSec = Math.max(0, parseFloat(a) || 0);
            if (snap.extPlaying && snap.extAud) {
                try { snap.extAud.currentTime = targetSec; } catch (e) {}
            } else if (snap.deckBPlaying && !snap.deckAPlaying && snap.vid) {
                if (typeof window.seekDeckBAndPlayerSyncedV212 === 'function') {
                    window.seekDeckBAndPlayerSyncedV212(targetSec);
                } else {
                    try { snap.vid.currentTime = targetSec; } catch (e) {}
                }
            } else {
                if (typeof window.seekDeckAToExactSecondV371 === 'function') {
                    window.seekDeckAToExactSecondV371(targetSec);
                } else if (typeof window.seekFromNotification === 'function') {
                    window.seekFromNotification(targetSec);
                }
            }
            window.syncPermanentForegroundNotificationV212(true);
            return;
        }

        if (c === 'mode') {
            var mode = a.toLowerCase();
            window._islandActiveModeV245 = mode;
            window._islandExplicitModeTsV245 = Date.now();

            var closeModals = function(exceptId) {
                ['flacRadioModalV91', 'soundcloudModalV92', 'youtubeStudioModalV230'].forEach(function(id) {
                    if (id !== exceptId) {
                        var m = document.getElementById(id);
                        if (m) m.style.display = 'none';
                    }
                });
            };

            if (mode === 'music') {
                closeModals('');
                if (snap.radioPlaying && snap.radAud) {
                    try { snap.radAud.pause(); } catch (e) {}
                }
                if (snap.extPlaying && snap.extAud) {
                    try { snap.extAud.pause(); } catch (e) {}
                }
                window._lastActiveMediaSourceV243 = 'deckA';
                if (!window.currentPlayingTrack && Array.isArray(window.allTracks) && window.allTracks.length > 0) {
                    if (typeof window.playTrack === 'function') {
                        window.playTrack(window.allTracks[0]);
                    }
                } else if (!snap.deckAPlaying && window.currentPlayingTrack && typeof window.togglePlay === 'function') {
                    window.togglePlay();
                }
                if (typeof window.showToast === 'function') window.showToast('🎵 Режим: Студийная Музыка');
            } else if (mode === 'radio') {
                closeModals('flacRadioModalV91');
                if (snap.deckAPlaying && typeof window.togglePlay === 'function') {
                    window.togglePlay();
                }
                if (snap.extPlaying && snap.extAud) {
                    try { snap.extAud.pause(); } catch (e) {}
                }
                window._lastActiveMediaSourceV243 = 'radio';
                if (typeof window.openFlacRadioModalV91 === 'function') {
                    window.openFlacRadioModalV91();
                }
                var rst = window._radioStateV91;
                if (rst) {
                    if (rst.currentStation && rst.audioEl && rst.audioEl.paused) {
                        rst.audioEl.play().catch(function() {});
                    } else if (!rst.currentStation) {
                        var startFirstRadio = function() {
                            if (rst.stations && rst.stations.length > 0 && typeof window.playFlacRadioStationV91 === 'function') {
                                window.playFlacRadioStationV91(rst.stations[0]);
                            }
                        };
                        if (rst.stations && rst.stations.length > 0) {
                            startFirstRadio();
                        } else if (typeof window.loadFlacRadioStationsV91 === 'function') {
                            window.loadFlacRadioStationsV91();
                            setTimeout(startFirstRadio, 600);
                        }
                    }
                }
                if (typeof window.showToast === 'function') window.showToast('📻 Режим: FLAC / FM Радио');
            } else if (mode === 'soundcloud') {
                closeModals('soundcloudModalV92');
                if (snap.deckAPlaying && typeof window.togglePlay === 'function') {
                    window.togglePlay();
                }
                if (snap.radioPlaying && snap.radAud) {
                    try { snap.radAud.pause(); } catch (e) {}
                }
                window._lastActiveMediaSourceV243 = 'ext';
                if (typeof window.openSoundCloudModalV92 === 'function') {
                    window.openSoundCloudModalV92();
                }
                if (typeof window.showToast === 'function') window.showToast('☁️ Режим: SoundCloud Studio');
            } else if (mode === 'youtube') {
                closeModals('youtubeStudioModalV230');
                if (snap.deckAPlaying && typeof window.togglePlay === 'function') {
                    window.togglePlay();
                }
                if (snap.radioPlaying && snap.radAud) {
                    try { snap.radAud.pause(); } catch (e) {}
                }
                if (snap.extPlaying && snap.extAud) {
                    try { snap.extAud.pause(); } catch (e) {}
                }
                if (typeof window.openYoutubeStudioModalV230 === 'function') {
                    window.openYoutubeStudioModalV230();
                }
                if (typeof window.showToast === 'function') {
                    window.showToast('▶️ YouTube модуль в разработке (заглушка)');
                }
            }
            setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 80);
            return;
        }

        // Команды транспорта: prev / next / toggle / play / pause
        if (window._islandActiveModeV245 === 'youtube' && !snap.anyPlaying) {
            if (typeof window.showToast === 'function') {
                window.showToast('▶️ YouTube модуль в разработке (заглушка)');
            }
            window.syncPermanentForegroundNotificationV212(true);
            return;
        }

        if (window._islandActiveModeV245 === 'radio' && !snap.deckAPlaying) {
            window._lastActiveMediaSourceV243 = 'radio';
            var rst2 = window._radioStateV91;
            if ((c === 'toggle' || c === 'play') && rst2 && !rst2.currentStation && rst2.stations && rst2.stations.length > 0 && typeof window.playFlacRadioStationV91 === 'function') {
                window.playFlacRadioStationV91(rst2.stations[0]);
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 120);
                return;
            }
        }

        if ((c === 'toggle' || c === 'play') && !snap.anyPlaying && (!window.currentPlayingTrack) && Array.isArray(window.allTracks) && window.allTracks.length > 0 && window._islandActiveModeV245 !== 'radio') {
            if (typeof window.playTrack === 'function') {
                window.playTrack(window.allTracks[0]);
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 120);
                return;
            }
        }

        if (typeof window.handleNativeMediaControlV243 === 'function') {
            window.handleNativeMediaControlV243(c);
        }
        setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
    };

    setInterval(function() {
        window.syncAndroidSafeInsetsV243();
        window.ensureSearchRowStretchV243();
        window.ensureVideoPrevNextZonesV243();
        window.fixRadioModalHeaderLayoutV243();
        window.syncPermanentForegroundNotificationV212(false);
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
