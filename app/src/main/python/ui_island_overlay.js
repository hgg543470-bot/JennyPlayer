/* ============================================================================
 * ui_island_overlay.js — Модуль полноразмерной верхней плашки Dynamic Island (V246)
 *
 * Склейка:  /bundle_2_player.js, модуль 19 из 19 (в конце списка JENNY_BUNDLE_PLAYER в player.py).
 * Внутри:   syncPermanentForegroundNotificationV212, handleIslandCommandV245,
 *           сквозная синхронизация активного источника (Музыка / Радио / SoundCloud / YouTube)
 *           между родным интерфейсом плеера и нативным IslandOverlayController.java без рывков звука.
 * Метка:    [FIX-ISLAND-OVERLAY]
 * ============================================================================ */

;(function() {
    if (window._jennyIslandOverlayV245Installed) return;
    window._jennyIslandOverlayV245Installed = true;

    window._islandActiveModeV245 = window._islandActiveModeV245 || 'music';
    window._lastRadioStationIdxV245 = 0;
    window._lastScTrackIdxV245 = 1;

    // Помощник: получить заголовок текущего трека SoundCloud
    function resolveCurrentScTitleV245() {
        var aud = window._khStateV88 && window._khStateV88.previewAudio;
        if (aud && aud._pagePath && Array.isArray(window._scDedicatedTracksV96)) {
            var found = window._scDedicatedTracksV96.find(function(x) { return x.page_path === aud._pagePath; });
            if (found && found.title) {
                window._lastExternalTitleV243 = found.title;
                return found.title;
            }
        }
        return window._lastExternalTitleV243 || 'SoundCloud Поток';
    }

    // Помощник: запуск или продолжение родного Радио через оригинальную playFlacRadioStationV91(idx, btnEl)
    function startOrResumeOriginalRadioV245() {
        var rst = window._radioStateV91;
        if (!rst) return;

        // Если радио уже играет — ничего не перезапускаем (без рывков звука!)
        if (rst.audio && !rst.audio.paused && !rst.audio.ended && rst.audio.currentSrc) {
            if (typeof window.renderRadioFiltersAndStationsV92 === 'function') {
                window.renderRadioFiltersAndStationsV92();
            }
            return;
        }

        // Если радио стояло на паузе и поток жив — плавно продолжаем
        if (rst.audio && rst.audio.src && rst.audio.paused && rst.currentStation) {
            if (typeof window.pauseMainPlayerForOstV90 === 'function') window.pauseMainPlayerForOstV90();
            if (typeof window.stopKhPreviewV88 === 'function') window.stopKhPreviewV88();
            rst.audio.play().then(function() {
                if (typeof window.renderRadioFiltersAndStationsV92 === 'function') {
                    window.renderRadioFiltersAndStationsV92();
                }
                window.syncPermanentForegroundNotificationV212(true);
            }).catch(function() {
                // Если буферный сокет закрылся во время долгой паузы — запускаем станцию через родную функцию
                triggerStationByIndexV245(findCurrentRadioIndexV245());
            });
            return;
        }

        triggerStationByIndexV245(findCurrentRadioIndexV245());
    }

    function findCurrentRadioIndexV245() {
        var rst = window._radioStateV91;
        if (!rst || !Array.isArray(rst.stations) || rst.stations.length === 0) {
            return window._lastRadioStationIdxV245 || 0;
        }
        if (rst.currentStation) {
            var idx = rst.stations.findIndex(function(s) { return s && s.url === rst.currentStation.url; });
            if (idx >= 0) {
                window._lastRadioStationIdxV245 = idx;
                return idx;
            }
        }
        var saved = window._lastRadioStationIdxV245 || 0;
        return (saved >= 0 && saved < rst.stations.length) ? saved : 0;
    }

    function triggerStationByIndexV245(targetIdx) {
        var attempt = 0;
        var tryPlay = function() {
            var rst = window._radioStateV91;
            if (rst && Array.isArray(rst.stations) && rst.stations.length > 0 && typeof window.playFlacRadioStationV91 === 'function') {
                var validIdx = ((targetIdx % rst.stations.length) + rst.stations.length) % rst.stations.length;
                window._lastRadioStationIdxV245 = validIdx;
                var modal = document.getElementById('jennyFlacRadioModalV91');
                var btnEl = modal ? modal.querySelector('button.rad-play-btn-v91[onclick*="(' + validIdx + ',"]') : null;
                window.playFlacRadioStationV91(validIdx, btnEl);
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 150);
                return;
            }
            attempt++;
            if (attempt === 1 && typeof window.loadFlacRadioStationsV91 === 'function') {
                window.loadFlacRadioStationsV91();
            }
            if (attempt < 15) {
                setTimeout(tryPlay, 180);
            }
        };
        tryPlay();
    }

    // Помощник: запуск или продолжение родного SoundCloud через оригинальную previewScTrackV96(idx, btnEl)
    function startOrResumeOriginalSoundCloudV245() {
        var aud = window._khStateV88 && window._khStateV88.previewAudio;
        if (aud && !aud.paused && !aud.ended && aud.currentSrc) {
            // Уже играет — не трогаем звук!
            return;
        }
        if (aud && aud.src && aud.paused && typeof window.toggleKhMiniPlayPauseV90 === 'function') {
            window.toggleKhMiniPlayPauseV90();
            setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
            return;
        }
        triggerSoundCloudByOffsetV245(0);
    }

    function triggerSoundCloudByOffsetV245(stepDelta) {
        var attempt = 0;
        var tryPlaySc = function() {
            var list = window._scDedicatedTracksV96;
            if (Array.isArray(list) && list.length > 0 && typeof window.previewScTrackV96 === 'function') {
                var curPos = 0;
                var aud = window._khStateV88 && window._khStateV88.previewAudio;
                if (aud && aud._pagePath) {
                    var foundPos = list.findIndex(function(x) { return x.page_path === aud._pagePath; });
                    if (foundPos >= 0) curPos = foundPos;
                } else if (window._lastScTrackIdxV245) {
                    var byIdx = list.findIndex(function(x) { return Number(x.index) === Number(window._lastScTrackIdxV245); });
                    if (byIdx >= 0) curPos = byIdx;
                }
                var nextPos = ((curPos + stepDelta) % list.length + list.length) % list.length;
                var trk = list[nextPos];
                if (trk) {
                    window._lastScTrackIdxV245 = trk.index;
                    window._lastExternalTitleV243 = trk.title || 'SoundCloud Поток';
                    var bodyEl = document.getElementById('scDedicatedBodyV93');
                    var btnEl = bodyEl ? bodyEl.querySelector('button[onclick*="previewScTrackV96(' + trk.index + ',"]') : null;
                    if (stepDelta === 0 && aud && aud._pagePath === trk.page_path) {
                        if (aud.paused && typeof window.toggleKhMiniPlayPauseV90 === 'function') {
                            window.toggleKhMiniPlayPauseV90();
                        }
                    } else {
                        window.previewScTrackV96(trk.index, btnEl);
                    }
                    setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 180);
                }
                return;
            }
            attempt++;
            if (attempt === 1 && !window._scSearchInFlightV246 && typeof window.runScDedicatedSearchV93 === 'function') {
                window._scSearchInFlightV246 = true;
                var scModal = document.getElementById('jennySoundCloudModalV93');
                var pSearch;
                if (!scModal && typeof window.openSoundCloudModalV92 === 'function') {
                    pSearch = window.openSoundCloudModalV92();
                    if (document.getElementById('jennySoundCloudModalV93')) {
                        document.getElementById('jennySoundCloudModalV93').style.setProperty('display', 'none', 'important');
                    }
                } else {
                    var bodyCheck = document.getElementById('scDedicatedBodyV93');
                    var alreadySearching = bodyCheck && bodyCheck.textContent && bodyCheck.textContent.indexOf('Поиск') !== -1;
                    if (!alreadySearching) {
                        pSearch = window.runScDedicatedSearchV93();
                    }
                }
                Promise.resolve(pSearch).finally(function() {
                    setTimeout(function() { window._scSearchInFlightV246 = false; }, 400);
                });
            }
            if (attempt < 55) {
                setTimeout(tryPlaySc, 240);
            }
        };
        tryPlaySc();
    }

    // Перехватываем родные действия внутри самого плеера, чтобы последнее нажатое пользователем
    // (Музыка, Радио, SoundCloud или YouTube) всегда становилось главным источником и в плашке!
    function installBiDirectionalSourceHooksV245() {
        if (typeof window.playFlacRadioStationV91 === 'function' && !window.playFlacRadioStationV91._v245Hooked) {
            var origPlayRadio = window.playFlacRadioStationV91;
            window.playFlacRadioStationV91 = function(idx, btnEl) {
                window._islandActiveModeV245 = 'radio';
                window._lastActiveMediaSourceV243 = 'radio';
                window._islandExplicitModeTsV245 = Date.now();
                if (typeof idx === 'number' && !isNaN(idx)) {
                    window._lastRadioStationIdxV245 = idx;
                }
                var res = origPlayRadio.apply(this, arguments);
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
                return res;
            };
            window.playFlacRadioStationV91._v245Hooked = true;
        }

        if (typeof window.previewScTrackV96 === 'function' && !window.previewScTrackV96._v245Hooked) {
            var origPreviewSc = window.previewScTrackV96;
            window.previewScTrackV96 = function(idx, btnEl, ev) {
                window._islandActiveModeV245 = 'soundcloud';
                window._lastActiveMediaSourceV243 = 'external';
                window._islandExplicitModeTsV245 = Date.now();
                if (idx !== undefined) window._lastScTrackIdxV245 = idx;
                var t = (window._scDedicatedTracksV96 || []).find(function(x) { return Number(x.index) === Number(idx); });
                if (t && t.title) window._lastExternalTitleV243 = t.title;
                var res = origPreviewSc.apply(this, arguments);
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 120);
                return res;
            };
            window.previewScTrackV96._v245Hooked = true;
        }

        if (typeof window.playTrack === 'function' && !window.playTrack._v245Hooked) {
            var origPlayTrack = window.playTrack;
            window.playTrack = function() {
                window._islandActiveModeV245 = 'music';
                window._lastActiveMediaSourceV243 = 'deckA';
                window._islandExplicitModeTsV245 = Date.now();
                var res = origPlayTrack.apply(this, arguments);
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
                return res;
            };
            window.playTrack._v245Hooked = true;
        }
    }
    installBiDirectionalSourceHooksV245();
    setTimeout(installBiDirectionalSourceHooksV245, 500);

    // [FIX-ISLAND-OVERLAY] Синхронизация состояния плеера, Избранного (❤️) и активного модуля с IslandOverlayController.java
    window.syncPermanentForegroundNotificationV212 = window.syncAndroidNotification = function(force) {
        if (!window.AndroidBridge) return;
        installBiDirectionalSourceHooksV245();
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

        // Определяем, какой источник сейчас главный (на что последнее нажали или что реально играет)
        var activeMode = window._islandActiveModeV245 || 'music';
        var recentExplicitSwitch = (now - (window._islandExplicitModeTsV245 || 0) < 2500);
        if (!recentExplicitSwitch) {
            if (snap.radioPlaying) {
                activeMode = 'radio';
                window._islandActiveModeV245 = 'radio';
                window._lastActiveMediaSourceV243 = 'radio';
            } else if (snap.extPlaying) {
                activeMode = 'soundcloud';
                window._islandActiveModeV245 = 'soundcloud';
                window._lastActiveMediaSourceV243 = 'external';
            } else if (snap.deckAPlaying || snap.deckBPlaying) {
                activeMode = 'music';
                window._islandActiveModeV245 = 'music';
                window._lastActiveMediaSourceV243 = snap.deckAPlaying ? 'deckA' : 'deckB';
            }
        }

        var titleParts = [];
        var subParts = [];
        if (activeTorCnt > 0) subParts.push('⚡ P2P: ' + sumKbps + ' КБ/с (' + torPct + '%)');

        var posSec = 0, durSec = 0, spd = 1.0;

        if (snap.radioPlaying) {
            var rName = window.resolveCurrentRadioTitleV243();
            titleParts.push('📻 ' + rName);
            subParts.push((window._radioStateV91 && window._radioStateV91.isRecording) ? '🔴 Запись эфира • Прямой поток' : '📡 Прямой радиоэфир');
        } else if (snap.extPlaying) {
            titleParts.push('☁️ ' + resolveCurrentScTitleV245());
            subParts.push('☁️ SoundCloud • Поток');
            durSec = isFinite(snap.extAud.duration) ? snap.extAud.duration : 0;
            posSec = isFinite(snap.extAud.currentTime) ? snap.extAud.currentTime : 0;
        } else if (snap.deckAPlaying || snap.deckBPlaying) {
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

        if (!isActuallyPlaying) {
            if (activeMode === 'youtube') {
                titleParts = ['▶️ YouTube Studio • Модуль в разработке'];
                subParts = ['🚧 Заглушка: скоро прямое воспроизведение YouTube'];
            } else if (activeMode === 'radio') {
                titleParts.push('⏸ 📻 ' + window.resolveCurrentRadioTitleV243());
                subParts.push('📻 Радиоэфир на паузе');
            } else if (activeMode === 'soundcloud') {
                titleParts.push('⏸ ☁️ ' + resolveCurrentScTitleV245());
                subParts.push('☁️ SoundCloud на паузе');
                if (snap.extAud) {
                    durSec = isFinite(snap.extAud.duration) ? snap.extAud.duration : 0;
                    posSec = isFinite(snap.extAud.currentTime) ? snap.extAud.currentTime : 0;
                }
            } else if (window._lastActiveMediaSourceV243 === 'deckB' && snap.stVid && snap.stVid.active && snap.stVid.currentTitle) {
                titleParts.push('⏸ 🎬 ' + String(snap.stVid.currentTitle).replace(/\.(mp4|mkv|webm|avi|mov)$/i, ''));
                subParts.push('🎬 Видео на паузе');
                if (snap.vid) {
                    durSec = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(snap.vid) : (snap.vid.duration || 0);
                    posSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(snap.vid) : (snap.vid.currentTime || 0);
                }
            } else if (window.currentPlayingTrack) {
                titleParts.push('⏸ ' + String(window.currentPlayingTrack).replace(/\.(opus|m4a|mp3|wav|flac|ogg|xflac)$/i, ''));
                subParts.push('🎵 На паузе');
                durSec = (snap.player && isFinite(snap.player.duration) && snap.player.duration > 0) ? snap.player.duration : (window.studioBuffer ? window.studioBuffer.duration : 0);
                posSec = (typeof window.getTruePlaybackTimeV74_2 === 'function')
                    ? window.getTruePlaybackTimeV74_2()
                    : ((snap.player && isFinite(snap.player.currentTime)) ? snap.player.currentTime : 0);
            } else if (activeTorCnt > 0) {
                titleParts.push('🧲 Закачка P2P (' + activeTorCnt + ' разд. • ' + torPct + '%)');
                subParts.push('📥 Фоновая загрузка активна');
            } else {
                titleParts.push('🛡️ Jenny Player');
                subParts.push('Готов к воспроизведению');
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

    // Вспомогательное переключение видимости модальных окон внутри плеера,
    // чтобы при открытии самого приложения на экране уже было открыто окно выбранного модуля
    function syncInAppModalsForModeV245(mode) {
        var radioM = document.getElementById('jennyFlacRadioModalV91');
        var scM = document.getElementById('jennySoundCloudModalV93');
        var ytM = document.getElementById('jennyYoutubeStudioModalV230');

        if (mode === 'music') {
            if (radioM) radioM.style.setProperty('display', 'none', 'important');
            if (scM) scM.style.setProperty('display', 'none', 'important');
            if (ytM) ytM.style.setProperty('display', 'none', 'important');
        } else if (mode === 'radio') {
            if (scM) scM.style.setProperty('display', 'none', 'important');
            if (ytM) ytM.style.setProperty('display', 'none', 'important');
            if (!radioM || radioM.style.display === 'none' || getComputedStyle(radioM).display === 'none') {
                if (typeof window.openFlacRadioModalV91 === 'function') {
                    window.openFlacRadioModalV91();
                }
            }
        } else if (mode === 'soundcloud') {
            if (radioM) radioM.style.setProperty('display', 'none', 'important');
            if (ytM) ytM.style.setProperty('display', 'none', 'important');
            if (!scM || scM.style.display === 'none' || getComputedStyle(scM).display === 'none') {
                if (typeof window.openSoundCloudModalV92 === 'function') {
                    window.openSoundCloudModalV92();
                }
            }
        } else if (mode === 'youtube') {
            if (radioM) radioM.style.setProperty('display', 'none', 'important');
            if (scM) scM.style.setProperty('display', 'none', 'important');
            if (!ytM || ytM.style.display === 'none' || getComputedStyle(ytM).display === 'none') {
                if (typeof window.openYoutubeStudioModalV230 === 'function') {
                    window.openYoutubeStudioModalV230();
                }
            }
        }
    }

    // [FIX-ISLAND-OVERLAY] Обработчик команд из нативного IslandOverlayController.java
    window.handleIslandCommandV245 = function(cmd, arg) {
        var c = String(cmd || '').toLowerCase();
        var a = String(arg || '');
        var snap = window.getActiveSourcesSnapshotV243 ? window.getActiveSourcesSnapshotV243() : {};

        if (c === 'share' || c === 'export') {
            if (!window.currentPlayingTrack && Array.isArray(window.allTracks) && window.allTracks.length > 0) {
                window.currentPlayingTrack = window.allTracks[0];
            }
            if (typeof window.exportCurrentTrack === 'function') {
                window.exportCurrentTrack();
            } else {
                var expBtn = document.getElementById('btnExport');
                if (expBtn && typeof expBtn.click === 'function') {
                    expBtn.click();
                }
            }
            return;
        }

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
            var activeModeSeek = window._islandActiveModeV245 || 'music';
            if ((activeModeSeek === 'soundcloud' || snap.extPlaying) && snap.extAud && isFinite(snap.extAud.duration) && snap.extAud.duration > 0) {
                var val1000 = Math.round((targetSec / snap.extAud.duration) * 1000);
                if (typeof window.seekKhMiniPlayerV90 === 'function') {
                    window.seekKhMiniPlayerV90(val1000);
                } else {
                    try { snap.extAud.currentTime = targetSec; } catch (e) {}
                }
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
            syncInAppModalsForModeV245(mode);

            if (mode === 'music') {
                if (snap.radioPlaying && typeof window.stopFlacRadioStreamV91 === 'function') {
                    window.stopFlacRadioStreamV91();
                }
                if (snap.extPlaying && typeof window.toggleKhMiniPlayPauseV90 === 'function') {
                    window.toggleKhMiniPlayPauseV90();
                }
                window._lastActiveMediaSourceV243 = 'deckA';
                if (!window.currentPlayingTrack && Array.isArray(window.allTracks) && window.allTracks.length > 0) {
                    if (typeof window.playTrack === 'function') {
                        window.playTrack(window.allTracks[0]);
                    }
                } else if (!snap.deckAPlaying && window.currentPlayingTrack && typeof window.togglePlay === 'function') {
                    window.togglePlay();
                }
            } else if (mode === 'radio') {
                if (snap.deckAPlaying && typeof window.pauseMainPlayerForOstV90 === 'function') {
                    window.pauseMainPlayerForOstV90();
                } else if (snap.deckAPlaying && typeof window.togglePlay === 'function') {
                    window.togglePlay();
                }
                if (snap.extPlaying && typeof window.toggleKhMiniPlayPauseV90 === 'function') {
                    window.toggleKhMiniPlayPauseV90();
                }
                window._lastActiveMediaSourceV243 = 'radio';
                startOrResumeOriginalRadioV245();
            } else if (mode === 'soundcloud') {
                if (snap.deckAPlaying && typeof window.pauseMainPlayerForOstV90 === 'function') {
                    window.pauseMainPlayerForOstV90();
                } else if (snap.deckAPlaying && typeof window.togglePlay === 'function') {
                    window.togglePlay();
                }
                if (snap.radioPlaying && typeof window.stopFlacRadioStreamV91 === 'function') {
                    window.stopFlacRadioStreamV91();
                }
                window._lastActiveMediaSourceV243 = 'external';
                startOrResumeOriginalSoundCloudV245();
            } else if (mode === 'youtube') {
                if (snap.deckAPlaying && typeof window.pauseMainPlayerForOstV90 === 'function') {
                    window.pauseMainPlayerForOstV90();
                } else if (snap.deckAPlaying && typeof window.togglePlay === 'function') {
                    window.togglePlay();
                }
                if (snap.radioPlaying && typeof window.stopFlacRadioStreamV91 === 'function') {
                    window.stopFlacRadioStreamV91();
                }
                if (snap.extPlaying && typeof window.toggleKhMiniPlayPauseV90 === 'function') {
                    window.toggleKhMiniPlayPauseV90();
                }
                if (typeof window.showToast === 'function') {
                    window.showToast('▶️ YouTube модуль в разработке (заглушка)');
                }
            }
            setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
            return;
        }

        // Команды транспорта: prev / next / toggle / play / pause — направляем строго в активный выбранный модуль!
        var curMode = window._islandActiveModeV245 || 'music';

        if (curMode === 'youtube') {
            if (typeof window.showToast === 'function') {
                window.showToast('▶️ YouTube модуль в разработке (заглушка)');
            }
            window.syncPermanentForegroundNotificationV212(true);
            return;
        }

        if (curMode === 'radio') {
            window._lastActiveMediaSourceV243 = 'radio';
            var rst = window._radioStateV91;
            if (c === 'next' || c === 'prev') {
                var curIdx = findCurrentRadioIndexV245();
                var step = (c === 'next') ? 1 : -1;
                triggerStationByIndexV245(curIdx + step);
                return;
            }
            if (c === 'pause' || (c === 'toggle' && snap.radioPlaying)) {
                if (snap.radAud) {
                    try { snap.radAud.pause(); } catch (e) {}
                }
                document.querySelectorAll('.rad-play-btn-v91').forEach(function(b) { b.innerText = '▶'; });
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 80);
                return;
            }
            if (c === 'play' || (c === 'toggle' && !snap.radioPlaying)) {
                startOrResumeOriginalRadioV245();
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 120);
                return;
            }
        }

        if (curMode === 'soundcloud') {
            window._lastActiveMediaSourceV243 = 'external';
            if (c === 'next' || c === 'prev') {
                triggerSoundCloudByOffsetV245(c === 'next' ? 1 : -1);
                return;
            }
            if (c === 'pause' || (c === 'toggle' && snap.extPlaying)) {
                if (typeof window.toggleKhMiniPlayPauseV90 === 'function' && snap.extAud && !snap.extAud.paused) {
                    window.toggleKhMiniPlayPauseV90();
                } else if (snap.extAud) {
                    try { snap.extAud.pause(); } catch (e) {}
                }
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 80);
                return;
            }
            if (c === 'play' || (c === 'toggle' && !snap.extPlaying)) {
                startOrResumeOriginalSoundCloudV245();
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 120);
                return;
            }
        }

        // Режим Музыки (Дека А / Дека Б)
        window._lastActiveMediaSourceV243 = snap.deckBPlaying && !snap.deckAPlaying ? 'deckB' : 'deckA';
        if ((c === 'toggle' || c === 'play') && !snap.anyPlaying && (!window.currentPlayingTrack) && Array.isArray(window.allTracks) && window.allTracks.length > 0) {
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
        window.syncPermanentForegroundNotificationV212(false);
    }, 700);

    setTimeout(function() {
        window.syncPermanentForegroundNotificationV212(true);
    }, 200);
})();
