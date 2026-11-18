/* ============================================================================
 * ui_island_overlay.js — Мост управления между полноразмерной верхней плашкой
 *                        (IslandOverlayController.java) и движками Jenny Player (V247)
 *
 * Отвечает за:
 * 1. Бесшовное переключение и перехват управления между Музыкой (Дека А/Б), Радио (playFlacRadioStationV91),
 *    SoundCloud (previewScTrackV96) и YouTube.
 * 2. Прямой экспорт текущего локального трека в .xFLAC со всеми активными DSP-эффектами (executeTrackExportV69)
 *    по нажатию левой кнопки Экспорта на фиолетовой плашке.
 * 3. Рабочие кнопки Предыдущий (playPreviousTrack) и Следующий (playNextTrack) и перемотку -10с / +10с.
 * 4. Исправление автоперехода на следующий трек в конце песни (без бесконечного отскока на несколько секунд назад)
 *    и корректную остановку в конце очереди («Конец очереди»).
 * 5. Отображение обратного хода полосы прогресса на плашке, когда в плеере включён Реверс (isReversed).
 * 6. Пункт «🏝️ Настройка плашки» в настройках плеера с ползунком прозрачности фона (0–100%).
 * ============================================================================ */

;(function() {
    if (window._jennyV245IslandOverlayInstalled) return;
    window._jennyV245IslandOverlayInstalled = true;

    window._islandActiveModeV245 = 'music'; // 'music' | 'radio' | 'soundcloud' | 'youtube'
    window._islandExplicitModeTsV245 = 0;
    window._lastRadioStationIdxV245 = 0;
    window._lastScTrackIdxV245 = 0;
    window._islandExportStatusV247 = '';
    window._endOfQueueReachedV247 = false;
    window._lastLocalDeckATrackV262 = '';
    window._isYoutubeDeckBActiveV262 = false;

    function isYtTaggedNameV262(str) {
        if (!str) return false;
        var s = String(str).trim();
        if (/\.(xflac|flac)$/i.test(s)) return false;
        return (
            s.indexOf('[YT') === 0 ||
            s.indexOf('[YT Поток]') !== -1 ||
            s.indexOf('yt_stream_') === 0 ||
            s.indexOf('yt_deckb_') !== -1 ||
            s.indexOf('yt_aud_') !== -1 ||
            s.indexOf('/api/youtube/') !== -1
        );
    }
    window.isYtTaggedNameV262 = isYtTaggedNameV262;

    // Убираем все ведущие жёлтые эмодзи из названий треков для чистого стиля плашки
    function stripLeadingEmojisV247(str) {
        if (!str) return '';
        return String(str)
            .replace(/^[\s🎵🎶🎬📻🎧☁️▶️⏸⏹⏪⏩🛡️🧲📥🔴📡🌐🎛️]+/gu, '')
            .trim();
    }

    function resolveCurrentScTitleV245() {
        var aud = window._khStateV88 && window._khStateV88.previewAudio;
        if (aud && aud._pagePath && Array.isArray(window._scDedicatedTracksV96)) {
            var found = window._scDedicatedTracksV96.find(function(x) { return x.page_path === aud._pagePath; });
            if (found && found.title) {
                window._lastExternalTitleV243 = found.title;
                return stripLeadingEmojisV247(found.title);
            }
        }
        var ump = document.querySelector('#jennySoundCloudModalV93 .jenny-univ-mini-player-v98 .ump-title');
        if (ump && ump.textContent) {
            var clean = stripLeadingEmojisV247(ump.textContent);
            if (clean && clean !== 'Предпрослушка') {
                window._lastExternalTitleV243 = clean;
                return clean;
            }
        }
        return stripLeadingEmojisV247(window._lastExternalTitleV243 || 'SoundCloud');
    }

    // -------------------------------------------------------------------------
    // 1. ИСПРАВЛЕНИЕ ЧАСОВ WEBAUDIO И АВТОПЕРЕХОДА В КОНЦЕ ПЕСНИ (БЕЗ ЗАЦИКЛИВАНИЯ КОНЦА)
    // -------------------------------------------------------------------------
    function installAutoAdvanceAndReverseSyncV247() {
        // Гарантируем, что ссылки V243 на следующий/предыдущий трек указывают на реальные функции плеера
        if (typeof window.playNextTrack === 'function') {
            window._origNextTrackV243 = window.playNextTrack;
            window.nextTrack = window.playNextTrack;
        }
        if (typeof window.playPreviousTrack === 'function') {
            window._origPrevTrackV243 = window.playPreviousTrack;
            window.prevTrack = window.playPreviousTrack;
        }

        // Чиним getTruePlaybackTimeV74_2: даже если studioSourceNode только что завершился,
        // считаем позицию по часам WebAudio (_studioClockV74_1), а не откатываемся к отставшему player.currentTime!
        if (typeof window.getTruePlaybackTimeV74_2 === 'function' && !window.getTruePlaybackTimeV74_2._v247Fixed) {
            window.getTruePlaybackTimeV74_2 = function() {
                var player = document.getElementById('audioPlayer');
                if (window._pendingSeekTargetV75 && (performance.now() - window._pendingSeekTargetV75.ts < 320)) {
                    return window._pendingSeekTargetV75.sec;
                }
                var pTime = (player && isFinite(player.currentTime)) ? player.currentTime : 0;
                if (!window.studioBuffer) {
                    return pTime;
                }
                var clk = window._studioClockV74_1;
                var maxDur = (window.studioBuffer && window.studioBuffer.duration > 0)
                    ? window.studioBuffer.duration
                    : ((player && isFinite(player.duration) && player.duration > 0) ? player.duration : 999999);

                if (clk && clk.active && window.audioCtx && !window._userPausedV75_2 && clk.trackName === (window.currentPlayingTrack || '')) {
                    var spd = clk.speed || ((typeof window.getActiveTargetSpeedV59 === 'function') ? window.getActiveTargetSpeedV59() : 1.0);
                    var elapsedCtx = Math.max(0, window.audioCtx.currentTime - clk.startCtxTime);
                    var est = clk.startTrackSec + elapsedCtx * spd;
                    var clampedEst = Math.max(0, Math.min(maxDur, est));
                    clk.lastKnownSec = clampedEst;
                    if (window.isStudioPlaying && maxDur > 2.0 && maxDur < 900000 && est >= maxDur - 0.12) {
                        var stillLoading = Boolean(window.studioBuffer && window.studioBuffer._pieceMapV72 && !window.studioBuffer._allPiecesLoadedV72);
                        if (!stillLoading && typeof window.handleAutoTrackEndedV247 === 'function') {
                            setTimeout(function() { window.handleAutoTrackEndedV247(); }, 0);
                        }
                    }
                    if (window.isStudioPlaying || !player || player.paused || pTime < 0.08 || Math.abs(pTime - clampedEst) > 0.45) {
                        return clampedEst;
                    }
                }

                if (clk && typeof clk.lastKnownSec === 'number' && isFinite(clk.lastKnownSec) && clk.trackName === (window.currentPlayingTrack || '')) {
                    if (!player || player.paused || pTime < 0.08 || clk.lastKnownSec > pTime + 0.45) {
                        return Math.max(0, Math.min(maxDur, clk.lastKnownSec));
                    }
                }
                return pTime;
            };
            window.getTruePlaybackTimeV74_2._v247Fixed = true;
        }

        // Обработчик естественного окончания трека: включает следующий по очереди,
        // а если это конец очереди — аккуратно ставит на паузу и сбрасывает шкалу!
        window.handleAutoTrackEndedV247 = function() {
            var nowAdv = performance.now();
            if (nowAdv - (window._lastAutoAdvanceWallV360 || 0) < 1200) return;
            window._lastAutoAdvanceWallV360 = nowAdv;

            // Если в настройках плеера включён повтор одного трека
            if (window.appConfig && window.appConfig.loopTrack && window.currentPlayingTrack && typeof window.playTrack === 'function') {
                window._endOfQueueReachedV247 = false;
                window.playTrack(window.currentPlayingTrack, 'queue');
                return;
            }

            var queue = (typeof window.getEffectivePlaybackQueueV73_1 === 'function')
                ? window.getEffectivePlaybackQueueV73_1()
                : (window.currentTrackList || window.allTracks || []);

            if (!Array.isArray(queue) || queue.length === 0 || !window.currentPlayingTrack) {
                return;
            }

            var isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
            var idx = queue.indexOf(window.currentPlayingTrack);
            var nextIdx = isRev ? (idx - 1) : (idx + 1);

            if (idx !== -1 && nextIdx >= 0 && nextIdx < queue.length) {
                window._endOfQueueReachedV247 = false;
                window.playTrack(queue[nextIdx], 'queue');
            } else {
                // Дошли до конца очереди: ставим на стоп/паузу, сбрасываем шкалу в 0:00
                window._endOfQueueReachedV247 = true;
                if (typeof window.forceStopPauseDeckAAudioV232 === 'function') {
                    window.forceStopPauseDeckAAudioV232(true);
                }
                var player = document.getElementById('audioPlayer');
                if (player) {
                    try { player.pause(); player.currentTime = 0; } catch (e) {}
                }
                var dur = (window.studioBuffer && window.studioBuffer.duration) || (player && player.duration) || 0;
                if (typeof window.updateProgressUI === 'function') {
                    window.updateProgressUI(0, dur, false);
                }
                var np = document.getElementById('nowPlaying');
                if (np) np.innerText = 'Конец очереди';
                setTimeout(function() {
                    window.syncPermanentForegroundNotificationV212(true);
                }, 60);
            }
        };

        // Привязываем чистый onended к активному узлу studioSourceNode, чтобы он НИКОГДА не отскакивал назад в конце трека
        if (typeof window.syncMasterPlaybackEngineV59 === 'function' && !window.syncMasterPlaybackEngineV59._v247EndFixed) {
            var origSyncV247 = window.syncMasterPlaybackEngineV59;
            var wrappedSyncV247 = function() {
                var r = origSyncV247.apply(this, arguments);
                var node = window.studioSourceNode;
                if (node && !node._v247CleanOnEnded) {
                    node._v247CleanOnEnded = true;
                    var boundTrack = window.currentPlayingTrack || '';
                    node.onended = function() {
                        if (window.studioSourceNode !== node) return;

                        // Вычисляем реальное время по часам WebAudio ДО сброса флагов!
                        var dur = (window.studioBuffer && window.studioBuffer.duration) || 0;
                        var clk = window._studioClockV74_1;
                        var trueSec = dur;
                        if (clk && clk.active && window.audioCtx) {
                            var spd = clk.speed || 1.0;
                            trueSec = clk.startTrackSec + Math.max(0, window.audioCtx.currentTime - clk.startCtxTime) * spd;
                        }

                        window.studioSourceNode = null;
                        if (window._activeBufferSourcesV71 && typeof window._activeBufferSourcesV71.delete === 'function') {
                            window._activeBufferSourcesV71.delete(node);
                        }
                        window.isStudioPlaying = false;
                        if (clk) clk.active = false;

                        if (window._userPausedV75_2 || window.currentPlayingTrack !== boundTrack) {
                            if (typeof window.updateTrackListPlayIcons === 'function') window.updateTrackListPlayIcons();
                            return;
                        }

                        // Перезапускаем буфер ТОЛЬКО если трек ещё докачивается по кускам и реально не дошёл до конца
                        var stillLoadingPieces = Boolean(window.studioBuffer && window.studioBuffer._pieceMapV72 && !window.studioBuffer._allPiecesLoadedV72);
                        if (stillLoadingPieces && dur > 2.0 && trueSec < dur - 1.5) {
                            if (clk) {
                                clk.lastKnownSec = trueSec;
                                clk.startTrackSec = trueSec;
                            }
                            if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                                window.syncMasterPlaybackEngineV59(false);
                            }
                            return;
                        }

                        // Трек полностью доиграл до конца -> переходим к следующему (или стоп в конце очереди)
                        window.handleAutoTrackEndedV247();
                    };
                }
                return r;
            };
            wrappedSyncV247._v247EndFixed = true;
            wrappedSyncV247._v370Wrapped = true;
            window.syncMasterPlaybackEngineV59 = wrappedSyncV247;
            window.applyElasticHoseBufferLiveV46 = wrappedSyncV247;
        }

        // Также перехватываем классическое событие ended на <audio id="audioPlayer">
        var playerEl = document.getElementById('audioPlayer');
        if (playerEl && !playerEl._v247EndedHooked) {
            playerEl._v247EndedHooked = true;
            playerEl.addEventListener('ended', function(ev) {
                if (window.isStudioPlaying && window.studioSourceNode) return;
                if (ev && typeof ev.stopImmediatePropagation === 'function') {
                    ev.stopImmediatePropagation();
                }
                window.handleAutoTrackEndedV247();
            }, true);
        }
    }

    // -------------------------------------------------------------------------
    // 2. РАДИО И SOUNDCLOUD ПОМОЩНИКИ
    // -------------------------------------------------------------------------
    function pauseExternalPreviewOnlyV247() {
        var khAud = window._khStateV88 && window._khStateV88.previewAudio;
        if (khAud && !khAud.paused) {
            if (typeof window.toggleKhMiniPlayPauseV90 === 'function') {
                window.toggleKhMiniPlayPauseV90();
            } else {
                try { khAud.pause(); } catch (e) {}
            }
        }
    }

    function startOrResumeOriginalRadioV245() {
        var rst = window._radioStateV91;
        var radAud = (rst && rst.audio) || window._lastRadioAudioElV243;
        if (radAud && !radAud.paused && !radAud.ended && radAud.currentSrc) {
            return;
        }
        if (radAud && radAud.paused && (radAud.src || window._lastRadioSrcUrlV243)) {
            if (typeof window.pauseMainPlayerForOstV90 === 'function') window.pauseMainPlayerForOstV90();
            pauseExternalPreviewOnlyV247();
            var liveRadAud = (rst && rst.audio) || radAud;
            if (liveRadAud) {
                if (!liveRadAud.src && window._lastRadioSrcUrlV243) {
                    liveRadAud.src = window._lastRadioSrcUrlV243;
                }
                var playPromise = liveRadAud.play();
                if (playPromise && typeof playPromise.then === 'function') {
                    playPromise.then(function() {
                        if (typeof window.renderRadioFiltersAndStationsV92 === 'function') {
                            window.renderRadioFiltersAndStationsV92();
                        }
                        window.syncPermanentForegroundNotificationV212(true);
                    }).catch(function() {
                        triggerStationByIndexV245(findCurrentRadioIndexV245());
                    });
                }
                return;
            }
        }
        var targetIdx = findCurrentRadioIndexV245();
        triggerStationByIndexV245(targetIdx);
    }

    function findCurrentRadioIndexV245() {
        var rst = window._radioStateV91;
        if (rst && Array.isArray(rst.stations) && rst.stations.length > 0) {
            if (rst.currentStation) {
                var idx = rst.stations.findIndex(function(s) {
                    return s && (s === rst.currentStation || s.url === rst.currentStation.url);
                });
                if (idx >= 0) {
                    window._lastRadioStationIdxV245 = idx;
                    return idx;
                }
            }
            if (window._lastRadioStationIdxV245 >= 0 && window._lastRadioStationIdxV245 < rst.stations.length) {
                return window._lastRadioStationIdxV245;
            }
        }
        return 0;
    }

    // [FIX-ISLAND-RADIO-V249] Определяем качество активной радиостанции (LOSSLESS или LOSSY) как внутри радио в плеере
    function resolveCurrentRadioQualityV249() {
        var rst = window._radioStateV91;
        var st = rst && rst.currentStation;
        if (!st && rst && Array.isArray(rst.stations) && rst.stations.length > 0) {
            var idx = findCurrentRadioIndexV245();
            st = rst.stations[idx] || rst.stations[0];
        }
        if (st && st.lossless === false) {
            return 'LOSSY';
        }
        return 'LOSSLESS';
    }

    function triggerStationByIndexV245(idx) {
        var attempt = 0;
        var tryPlay = function() {
            var rst = window._radioStateV91;
            if (rst && Array.isArray(rst.stations) && rst.stations.length > 0 && typeof window.playFlacRadioStationV91 === 'function') {
                var len = rst.stations.length;
                var validIdx = ((idx % len) + len) % len;
                window._lastRadioStationIdxV245 = validIdx;
                var btnEl = document.querySelector('#jennyFlacRadioModalV91 .rad-play-btn-v91[onclick*="(' + validIdx + ',"]');
                window.playFlacRadioStationV91(validIdx, btnEl);
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 150);
                return;
            }
            attempt++;
            if (attempt === 1 && typeof window.openFlacRadioModalV91 === 'function') {
                window.openFlacRadioModalV91();
                var rm = document.getElementById('jennyFlacRadioModalV91');
                if (rm) rm.style.setProperty('display', 'none', 'important');
            }
            if (attempt < 15) {
                setTimeout(tryPlay, 180);
            }
        };
        tryPlay();
    }

    function startOrResumeOriginalSoundCloudV245() {
        var aud = window._khStateV88 && window._khStateV88.previewAudio;
        if (aud && !aud.paused && !aud.ended && aud.currentSrc) {
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
                    window._lastExternalTitleV243 = trk.title || 'SoundCloud';
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

    function installBiDirectionalSourceHooksV245() {
        installAutoAdvanceAndReverseSyncV247();

        if (typeof window.playFlacRadioStationV91 === 'function' && !window.playFlacRadioStationV91._v245Hooked) {
            var origPlayRadio = window.playFlacRadioStationV91;
            window.playFlacRadioStationV91 = function(idx, btnEl) {
                window._islandPauseOptimisticUntilV263 = 0;
                window._islandActiveModeV245 = 'radio';
                window._lastActiveMediaSourceV243 = 'radio';
                window._islandExplicitModeTsV245 = Date.now();
                if (typeof window.pauseOtherIslandModesV263 === 'function') {
                    try { window.pauseOtherIslandModesV263('radio'); } catch (e) {}
                }
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
                window._islandPauseOptimisticUntilV263 = 0;
                window._islandActiveModeV245 = 'soundcloud';
                window._lastActiveMediaSourceV243 = 'external';
                window._islandExplicitModeTsV245 = Date.now();
                if (typeof window.pauseOtherIslandModesV263 === 'function') {
                    try { window.pauseOtherIslandModesV263('soundcloud'); } catch (e) {}
                }
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
            window.playTrack = function(fnArg, ctxArg) {
                window._islandPauseOptimisticUntilV263 = 0;
                window._endOfQueueReachedV247 = false;
                var isYtCall = Boolean(ctxArg === 'youtube' || isYtTaggedNameV262(fnArg));
                window._isYoutubeDeckAActiveV253 = isYtCall;
                if (!isYtCall && fnArg && !(window.isVideoFileNameV130 && window.isVideoFileNameV130(fnArg))) {
                    window._lastLocalDeckATrackV262 = fnArg;
                }
                window._islandActiveModeV245 = isYtCall ? 'youtube' : 'music';
                window._lastActiveMediaSourceV243 = isYtCall ? 'youtube' : 'deckA';
                window._islandExplicitModeTsV245 = Date.now();
                if (typeof window.pauseOtherIslandModesV263 === 'function') {
                    try { window.pauseOtherIslandModesV263(isYtCall ? 'youtube' : 'music', 'deckA'); } catch (e) {}
                }
                var res = origPlayTrack.apply(this, arguments);
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
                return res;
            };
            window.playTrack._v245Hooked = true;
        }

        if (typeof window.openJennyVideoPlayerV130 === 'function' && !window.openJennyVideoPlayerV130._v262IslandHooked) {
            var origOpenVidIsland = window.openJennyVideoPlayerV130;
            window.openJennyVideoPlayerV130 = function(streamUrl, titleStr, opts) {
                window._islandPauseOptimisticUntilV263 = 0;
                var isYtVid = Boolean((opts && opts.isYoutube) || isYtTaggedNameV262(titleStr) || isYtTaggedNameV262(streamUrl));
                window._isYoutubeDeckBActiveV262 = isYtVid;
                window._islandActiveModeV245 = isYtVid ? 'youtube' : 'music';
                window._lastActiveMediaSourceV243 = isYtVid ? 'youtube' : 'deckB';
                window._islandExplicitModeTsV245 = Date.now();
                if (typeof window.pauseOtherIslandModesV263 === 'function') {
                    try { window.pauseOtherIslandModesV263(isYtVid ? 'youtube' : 'music', 'deckB'); } catch (e) {}
                }
                var r = origOpenVidIsland.apply(this, arguments);
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
                return r;
            };
            window.openJennyVideoPlayerV130._v262IslandHooked = true;
        }
        if (typeof window.closeVideoPlayerV130 === 'function' && !window.closeVideoPlayerV130._v262IslandHooked) {
            var origCloseVidIsland = window.closeVideoPlayerV130;
            window.closeVideoPlayerV130 = function() {
                window._isYoutubeDeckBActiveV262 = false;
                window._lastExplicitVideoUserPauseTsV369 = performance.now();
                var r = origCloseVidIsland.apply(this, arguments);
                var vd = window.videoDeckV131;
                if (vd) {
                    vd.studioBuffer = null;
                    vd.reversedStudioBuffer = null;
                    if (vd.hoseCache) {
                        vd.hoseCache.srcBuffer = null;
                        vd.hoseCache.splicedBuffer = null;
                    }
                }
                var vidEl = document.getElementById('jennyVideoElV130');
                if (vidEl) {
                    try { vidEl.pause(); vidEl.removeAttribute('src'); vidEl.load(); } catch (e) {}
                }
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 80);
                return r;
            };
            window.closeVideoPlayerV130._v262IslandHooked = true;
        }

        // [FIX-ISLAND-RADIO-V249] Синхронизация состояния кнопки REC при старте/остановке записи радио
        if (typeof window.toggleRadioRecordToXflacV91 === 'function' && !window.toggleRadioRecordToXflacV91._v249Hooked) {
            var origToggleRec = window.toggleRadioRecordToXflacV91;
            window.toggleRadioRecordToXflacV91 = async function() {
                var wasRec = Boolean(window._radioStateV91 && window._radioStateV91.isRecording);
                window._radioRecOptimisticV249 = !wasRec;
                window.syncPermanentForegroundNotificationV212(true);
                try {
                    var r = await origToggleRec.apply(this, arguments);
                    return r;
                } finally {
                    window._radioRecOptimisticV249 = null;
                    setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 60);
                }
            };
            window.toggleRadioRecordToXflacV91._v249Hooked = true;
        }
        if (typeof window.finalizeActiveRadioRecordingV240 === 'function' && !window.finalizeActiveRadioRecordingV240._v249Hooked) {
            var origFinRec = window.finalizeActiveRadioRecordingV240;
            window.finalizeActiveRadioRecordingV240 = async function() {
                window._radioRecOptimisticV249 = false;
                window.syncPermanentForegroundNotificationV212(true);
                try {
                    var r = await origFinRec.apply(this, arguments);
                    return r;
                } finally {
                    window._radioRecOptimisticV249 = null;
                    setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 60);
                }
            };
            window.finalizeActiveRadioRecordingV240._v249Hooked = true;
        }
    }

    // -------------------------------------------------------------------------
    // 3. НАСТРОЙКА ПРОЗРАЧНОСТИ ФОНА ПЛАШКИ (0–100%), ПРЕВЬЮ ТРЕКА И СТИЛЬНОГО ФМ КАРТИНОК
    // -------------------------------------------------------------------------
    function getSavedIslandTransparencyPctV247() {
        try {
            if (window.appConfig && window.appConfig.islandBgTransparencyPct !== undefined) {
                var v = parseInt(window.appConfig.islandBgTransparencyPct, 10);
                if (!isNaN(v)) return Math.max(0, Math.min(100, v));
            }
            var raw = localStorage.getItem('jenny_island_bg_trans_v247');
            if (raw !== null) {
                var v2 = parseInt(raw, 10);
                if (!isNaN(v2)) return Math.max(0, Math.min(100, v2));
            }
        } catch (e) {}
        return 22; // Лёгкая полупрозрачность по умолчанию
    }

    function getIslandShowTrackArtV250() {
        try {
            if (window.appConfig && typeof window.appConfig.islandShowTrackArtV250 === 'boolean') {
                return window.appConfig.islandShowTrackArtV250;
            }
            var raw = localStorage.getItem('jenny_island_show_track_art_v250');
            if (raw !== null) return raw === '1' || raw === 'true';
        } catch (e) {}
        return true; // Включено по умолчанию
    }

    function getIslandUseCustomArtV250() {
        try {
            if (window.appConfig && typeof window.appConfig.islandUseCustomArtV250 === 'boolean') {
                return window.appConfig.islandUseCustomArtV250;
            }
            var raw = localStorage.getItem('jenny_island_use_custom_art_v250');
            if (raw !== null) return raw === '1' || raw === 'true';
        } catch (e) {}
        return false;
    }

    function getIslandCustomArtPathV250() {
        try {
            if (window.appConfig && typeof window.appConfig.islandCustomArtPathV250 === 'string' && window.appConfig.islandCustomArtPathV250) {
                return window.appConfig.islandCustomArtPathV250;
            }
            var raw = localStorage.getItem('jenny_island_custom_art_path_v250');
            if (raw) return raw;
        } catch (e) {}
        return '';
    }

    // [V263] Настройка «Играть только что-то одно» (по умолчанию ВКЛЮЧЕНА = true):
    // при запуске любого режима из островка (например, YouTube) автоматически ставит на паузу любой другой режим.
    window.getIslandSingleSourceModeV263 = function() {
        try {
            if (window.appConfig && typeof window.appConfig.islandSingleSourceModeV263 === 'boolean') {
                return window.appConfig.islandSingleSourceModeV263;
            }
            var raw = localStorage.getItem('jenny_island_single_source_v263');
            if (raw !== null) return raw === '1' || raw === 'true';
        } catch (e) {}
        return true; // Включено по умолчанию
    };

    window.pauseDeckAAudioDirectV263 = function() {
        window._userPausedV75_2 = true;
        if (typeof window.forceStopPauseDeckAAudioV232 === 'function') {
            try { window.forceStopPauseDeckAAudioV232(false); } catch (e) {}
        } else {
            var p = document.getElementById('audioPlayer');
            if (p && !p.paused) {
                try { p.pause(); } catch (e) {}
            }
            if (typeof window.stopStudioSourceNode === 'function') {
                try { window.stopStudioSourceNode(); } catch (e) {}
            }
        }
    };

    window.pauseDeckBVideoDirectV263 = function() {
        var st = window._vidStateV130;
        var vid = document.getElementById('jennyVideoElV130');
        var vd = window.videoDeckV131 || {};
        window._lastExplicitVideoUserPauseTsV369 = performance.now();
        if (!st || !st.active) {
            if (vid && !vid.paused) {
                try { vid.pause(); } catch (e) {}
            }
            return;
        }
        var isRevB = Boolean(vd.isReversed || window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
        var isPlayingB = (!st.userPaused && (window._vidPlayIntentV132 || (vid && !vid.paused && !vid.ended))) || isRevB;
        if (isPlayingB && typeof window.toggleVideoPlayPauseV130 === 'function') {
            try { window.toggleVideoPlayPauseV130(); } catch (e) {}
        }
        st.userPaused = true;
        window._vidPlayIntentV132 = false;
        if (vid && !vid.paused) {
            try { vid.pause(); } catch (e) {}
        }
        if (typeof window.stopDeckBRamSourceNodeV372 === 'function' && window.videoDeckV131) {
            try { window.stopDeckBRamSourceNodeV372(window.videoDeckV131); } catch (e) {}
        }
    };

    window.pauseOtherIslandModesV263 = function(keepMode, keepDeck) {
        var m = String(keepMode || window._islandActiveModeV245 || 'music').toLowerCase();
        var singleOnly = window.getIslandSingleSourceModeV263();
        var snap = window.getActiveSourcesSnapshotV243 ? window.getActiveSourcesSnapshotV243() : {};
        var isYtDeckA = Boolean(
            (window._isYoutubeDeckAActiveV253 || isYtTaggedNameV262(window.currentPlayingTrack)) &&
            !/\.(xflac|flac)$/i.test(String(window.currentPlayingTrack || ''))
        );
        var isYtDeckB = Boolean(
            window._isYoutubeDeckBActiveV262 ||
            (snap.stVid && snap.stVid.active && (isYtTaggedNameV262(snap.stVid.currentTitle) || isYtTaggedNameV262(snap.stVid.currentUrl)))
        );
        var isYtExt = Boolean(snap.extAud && (snap.extAud._ytVideoIdV252 || snap.extAud._previewOwnerModalV241 === 'jennyYoutubeStudioModalV230' || String(snap.extAud._pagePath || '').indexOf('yt:') === 0));

        // 1) Всегда останавливаем Радио и SoundCloud при запуске другого режима
        if (m !== 'radio') {
            if (snap.radioPlaying && typeof window.stopFlacRadioStreamV91 === 'function') {
                try { window.stopFlacRadioStreamV91(); } catch (e) {}
            } else if (snap.radAud && !snap.radAud.paused) {
                try { snap.radAud.pause(); } catch (e) {}
            }
        }
        if (m !== 'soundcloud') {
            if (snap.extAud && !snap.extAud.paused && (!isYtExt || m !== 'youtube')) {
                try { snap.extAud.pause(); } catch (e) {}
            }
        }

        // 2) Внутри одного режима (например, YouTube Аудио vs YouTube Видео) не допускаем двойного звука
        if (m === 'youtube') {
            if (keepDeck === 'deckA' && isYtDeckB) {
                window.pauseDeckBVideoDirectV263();
            } else if (keepDeck === 'deckB' && isYtDeckA) {
                window._isYoutubeDeckAActiveV253 = false;
                window.pauseDeckAAudioDirectV263();
            }
        } else if (m === 'music') {
            if (isYtDeckA && snap.deckAPlaying) {
                window._isYoutubeDeckAActiveV253 = false;
                window.pauseDeckAAudioDirectV263();
            }
        }

        // 3) Если включена настройка «Играть только что-то одно» (по умолчанию ВКЛ):
        //    ставим на паузу ВСЕ остальные режимы островка!
        if (!singleOnly) return;

        if (m === 'youtube') {
            if (keepDeck === 'deckA') {
                window.pauseDeckBVideoDirectV263();
            } else if (keepDeck === 'deckB') {
                window.pauseDeckAAudioDirectV263();
            } else {
                if (!isYtDeckA && snap.deckAPlaying) window.pauseDeckAAudioDirectV263();
                if (!isYtDeckB && snap.deckBPlaying) window.pauseDeckBVideoDirectV263();
            }
        } else if (m === 'music') {
            if (isYtDeckB) {
                window.pauseDeckBVideoDirectV263();
            }
            if (keepDeck === 'deckA' && snap.deckBPlaying) {
                window.pauseDeckBVideoDirectV263();
            } else if (keepDeck === 'deckB' && snap.deckAPlaying) {
                window.pauseDeckAAudioDirectV263();
            }
        } else if (m === 'radio' || m === 'soundcloud') {
            if (snap.deckAPlaying) window.pauseDeckAAudioDirectV263();
            if (snap.deckBPlaying) window.pauseDeckBVideoDirectV263();
        }
    };

    window.onIslandSingleSourceModeChangedV263 = function() {
        var chk = document.getElementById('chkIslandSingleSourceV263');
        var enabled = chk ? Boolean(chk.checked) : true;
        window.appConfig = window.appConfig || {};
        window.appConfig.islandSingleSourceModeV263 = enabled;
        try {
            localStorage.setItem('jenny_island_single_source_v263', enabled ? '1' : '0');
            localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
        } catch (e) {}
        if (enabled) {
            window.pauseOtherIslandModesV263(window._islandActiveModeV245 || 'music');
        }
        window.syncPermanentForegroundNotificationV212(true);
    };

    function resolveCurrentScTrackObjV250() {
        var list = window._scDedicatedTracksV96 || [];
        if (!Array.isArray(list) || list.length === 0) return null;
        var aud = window._khStateV88 && window._khStateV88.previewAudio;
        if (aud && aud._pagePath) {
            var byPage = list.find(function(x) { return x.page_path === aud._pagePath; });
            if (byPage) return byPage;
        }
        if (window._lastScTrackIdxV245) {
            var byIdx = list.find(function(x) { return Number(x.index) === Number(window._lastScTrackIdxV245); });
            if (byIdx) return byIdx;
        }
        return list[0] || null;
    }

    function resolveIslandBgImageSpecV250(activeMode) {
        var useCustom = getIslandUseCustomArtV250();
        var customPath = getIslandCustomArtPathV250();
        if (useCustom && customPath) {
            return customPath;
        }
        if (!getIslandShowTrackArtV250()) {
            return '';
        }
        var m = String(activeMode || window._islandActiveModeV245 || 'music').toLowerCase();
        if (m === 'soundcloud') {
            var scTrk = resolveCurrentScTrackObjV250();
            var aud = window._khStateV88 && window._khStateV88.previewAudio;
            var artUrl = (scTrk && scTrk.artwork_url) || (aud && aud._scArtworkUrlV250) || '';
            var pagePath = (scTrk && scTrk.page_path) || (aud && aud._pagePath) || '';
            if (artUrl || pagePath) {
                return 'http://127.0.0.1:8080/api/island/sc_artwork?url=' + encodeURIComponent(artUrl) + '&page_path=' + encodeURIComponent(pagePath);
            }
            return '';
        }
        if (m === 'youtube') {
            var audYt = window._khStateV88 && window._khStateV88.previewAudio;
            var vidYt = (audYt && audYt._ytVideoIdV252) || window._lastYtVideoIdV252 || '';
            if (vidYt) {
                return 'http://127.0.0.1:8080/api/island/yt_artwork?v=' + encodeURIComponent(vidYt);
            }
            return '';
        }
        if (m === 'music') {
            var curRaw = window.currentPlayingTrack || '';
            var isCurYt = Boolean((window._isYoutubeDeckAActiveV253 || isYtTaggedNameV262(curRaw)) && !/\.(xflac|flac)$/i.test(curRaw));
            var trkName = (!isCurYt && curRaw)
                ? curRaw
                : (window._lastLocalDeckATrackV262 || ((Array.isArray(window.allTracks) && window.allTracks.length > 0) ? window.allTracks[0] : ''));
            if (trkName) {
                return 'http://127.0.0.1:8080/api/island/track_cover?track=' + encodeURIComponent(trkName);
            }
            return '';
        }
        return '';
    }

    window.syncIslandBgImageV250 = function(force) {
        if (!window.AndroidBridge || typeof window.AndroidBridge.setIslandBgImage !== 'function') return;
        var spec = resolveIslandBgImageSpecV250(window._islandActiveModeV245 || 'music');
        if (!force && spec === window._lastSentIslandBgSpecV250) return;
        window._lastSentIslandBgSpecV250 = spec;
        try {
            window.AndroidBridge.setIslandBgImage(spec);
        } catch (e) {}
    };

    window.onIslandArtSettingChangedV250 = function() {
        var chkTrack = document.getElementById('chkIslandShowTrackArtV250');
        var chkCustom = document.getElementById('chkIslandUseCustomArtV250');
        var showTrack = chkTrack ? Boolean(chkTrack.checked) : getIslandShowTrackArtV250();
        var useCustom = chkCustom ? Boolean(chkCustom.checked) : getIslandUseCustomArtV250();
        var customPath = getIslandCustomArtPathV250();

        window.appConfig = window.appConfig || {};
        window.appConfig.islandShowTrackArtV250 = showTrack;
        window.appConfig.islandUseCustomArtV250 = useCustom;
        window.appConfig.islandCustomArtPathV250 = customPath;
        try {
            localStorage.setItem('jenny_island_show_track_art_v250', showTrack ? '1' : '0');
            localStorage.setItem('jenny_island_use_custom_art_v250', useCustom ? '1' : '0');
            if (customPath) localStorage.setItem('jenny_island_custom_art_path_v250', customPath);
            localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
        } catch (e) {}

        var pathLbl = document.getElementById('lblIslandCustomArtPathV250');
        if (pathLbl) {
            pathLbl.textContent = customPath ? customPath : 'Картинка ещё не выбрана';
            pathLbl.style.color = customPath ? '#79c0ff' : '#8b949e';
        }
        window.syncIslandBgImageV250(true);
    };

    window.selectIslandCustomImageFileV250 = function(fullPath) {
        if (!fullPath) return;
        window.appConfig = window.appConfig || {};
        window.appConfig.islandCustomArtPathV250 = fullPath;
        window.appConfig.islandUseCustomArtV250 = true;
        try {
            localStorage.setItem('jenny_island_custom_art_path_v250', fullPath);
            localStorage.setItem('jenny_island_use_custom_art_v250', '1');
            localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
        } catch (e) {}

        var chkCustom = document.getElementById('chkIslandUseCustomArtV250');
        if (chkCustom) chkCustom.checked = true;
        var pathLbl = document.getElementById('lblIslandCustomArtPathV250');
        if (pathLbl) {
            pathLbl.textContent = fullPath;
            pathLbl.style.color = '#79c0ff';
        }
        var modal = document.getElementById('jennyIslandImagePickerModalV250');
        if (modal) modal.style.display = 'none';
        window.syncIslandBgImageV250(true);
        if (typeof window.showToast === 'function') {
            window.showToast('🖼️ Фоновая картинка плашки установлена!');
        }
    };

    window.loadIslandImageBrowserDirV250 = async function(targetPath) {
        var listEl = document.getElementById('islandImgPickerListV250');
        var curPathEl = document.getElementById('islandImgPickerCurPathV250');
        if (!listEl) return;
        listEl.innerHTML = '<div style="color:#a371f7;text-align:center;padding:28px 10px;font-size:12px;">⏳ Сканирование папки...</div>';
        try {
            var res = await window.fetch('/api/island/browse_images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: targetPath || '/storage/emulated/0' })
            });
            var data = await res.json();
            if (!res.ok || !data || data.status !== 'ok') {
                throw new Error((data && data.error) || 'Не удалось открыть папку');
            }
            window._islandImgBrowserCurDirV250 = data.current || '/storage/emulated/0';
            window._islandImgBrowserParentDirV250 = data.parent || '';
            if (curPathEl) curPathEl.textContent = window._islandImgBrowserCurDirV250;

            var html = '';
            if (data.parent) {
                var safePar = String(data.parent).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                html +=
                    '<div onclick="window.loadIslandImageBrowserDirV250(\'' + safePar + '\')" ' +
                        'style="display:flex;align-items:center;justify-content:space-between;padding:9px 11px;background:#111722;border:1px solid #30363d;border-radius:9px;cursor:pointer;">' +
                        '<span style="color:#d2a8ff;font-weight:bold;font-size:12px;">⬆️ .. (На уровень выше)</span>' +
                        '<span style="color:#8b949e;font-size:10.5px;">Назад</span>' +
                    '</div>';
            }

            var dirs = data.dirs || [];
            var images = data.images || [];
            dirs.forEach(function(d) {
                var safeP = String(d.path || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                var safeN = String(d.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                html +=
                    '<div onclick="window.loadIslandImageBrowserDirV250(\'' + safeP + '\')" ' +
                        'style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 11px;background:#0d121b;border:1px solid #262c36;border-radius:9px;cursor:pointer;">' +
                        '<div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">' +
                            '<span style="font-size:15px;flex-shrink:0;">📁</span>' +
                            '<span style="color:#e6edf3;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeN + '</span>' +
                        '</div>' +
                        '<span style="color:#58a6ff;font-size:10.5px;font-weight:bold;flex-shrink:0;">Открыть ➔</span>' +
                    '</div>';
            });

            images.forEach(function(img) {
                var safeP = String(img.path || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                var safeN = String(img.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                var thumbUrl = '/api/island/custom_image?path=' + encodeURIComponent(img.path || '');
                var sizeKb = Math.max(1, Math.round((Number(img.size || 0)) / 1024));
                var sizeTxt = sizeKb >= 1024 ? ((sizeKb / 1024).toFixed(1) + ' МБ') : (sizeKb + ' КБ');
                html +=
                    '<div onclick="window.selectIslandCustomImageFileV250(\'' + safeP + '\')" ' +
                        'style="display:flex;align-items:center;justify-content:space-between;gap:9px;padding:7px 10px;background:rgba(163,113,247,0.08);border:1px solid rgba(163,113,247,0.38);border-radius:9px;cursor:pointer;">' +
                        '<div style="display:flex;align-items:center;gap:9px;min-width:0;flex:1;">' +
                            '<img src="' + thumbUrl + '" loading="lazy" style="width:40px;height:40px;object-fit:cover;border-radius:7px;border:1px solid #a371f7;flex-shrink:0;background:#080b10;">' +
                            '<div style="min-width:0;flex:1;">' +
                                '<div style="color:#f0f6fc;font-size:11.8px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeN + '</div>' +
                                '<div style="color:#8b949e;font-size:10px;">Картинка • ' + sizeTxt + '</div>' +
                            '</div>' +
                        '</div>' +
                        '<button type="button" style="padding:5px 10px;border-radius:7px;background:linear-gradient(135deg,#6e38c5,#a371f7);border:1px solid #d2a8ff;color:#fff;font-size:10.5px;font-weight:bold;flex-shrink:0;">✓ Выбрать</button>' +
                    '</div>';
            });

            if (!dirs.length && !images.length) {
                html += '<div style="color:#8b949e;text-align:center;padding:24px 10px;font-size:11.5px;">В этой папке нет подпапок или картинок (.jpg, .png, .webp)</div>';
            }
            listEl.innerHTML = html;
        } catch (e) {
            listEl.innerHTML = '<div style="color:#ff7b72;text-align:center;padding:20px 10px;font-size:11.5px;">❌ ' + (e.message || e) + '</div>';
        }
    };

    window.openIslandImageBrowserModalV250 = function(startDir) {
        var modal = document.getElementById('jennyIslandImagePickerModalV250');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'jennyIslandImagePickerModalV250';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(3,5,9,0.88);backdrop-filter:blur(8px);z-index:2147483200;display:flex;align-items:center;justify-content:center;padding:12px;';
            modal.innerHTML =
                '<div style="width:100%;max-width:460px;max-height:86vh;background:#090d14;border:1.5px solid #a371f7;border-radius:14px;box-shadow:0 0 28px rgba(163,113,247,0.35);display:flex;flex-direction:column;overflow:hidden;">' +
                    '<div style="padding:11px 13px;background:linear-gradient(90deg,rgba(163,113,247,0.22),rgba(88,166,255,0.16));border-bottom:1px solid #262c36;display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
                        '<span style="color:#d2a8ff;font-weight:900;font-size:12.5px;letter-spacing:0.3px;">🖼️ ВЫБОР КАРТИНКИ ДЛЯ ОСТРОВКА</span>' +
                        '<button type="button" onclick="document.getElementById(\'jennyIslandImagePickerModalV250\').style.display=\'none\'" style="padding:4px 9px;border-radius:7px;background:rgba(248,81,73,0.18);border:1px solid #f85149;color:#ff7b72;font-size:11px;font-weight:bold;">✖ Закрыть</button>' +
                    '</div>' +
                    '<div style="padding:8px 11px;background:#06090f;border-bottom:1px solid #1c222d;display:flex;flex-direction:column;gap:6px;">' +
                        '<div style="display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;">' +
                            '<button type="button" onclick="window.loadIslandImageBrowserDirV250(\'/storage/emulated/0\')" style="padding:4px 8px;border-radius:7px;background:#121824;border:1px solid #30363d;color:#79c0ff;font-size:10.5px;font-weight:bold;white-space:nowrap;">📱 Память</button>' +
                            '<button type="button" onclick="window.loadIslandImageBrowserDirV250(\'/storage/emulated/0/Pictures\')" style="padding:4px 8px;border-radius:7px;background:#121824;border:1px solid #30363d;color:#d2a8ff;font-size:10.5px;font-weight:bold;white-space:nowrap;">🖼️ Pictures</button>' +
                            '<button type="button" onclick="window.loadIslandImageBrowserDirV250(\'/storage/emulated/0/DCIM\')" style="padding:4px 8px;border-radius:7px;background:#121824;border:1px solid #30363d;color:#ff8c42;font-size:10.5px;font-weight:bold;white-space:nowrap;">📸 DCIM</button>' +
                            '<button type="button" onclick="window.loadIslandImageBrowserDirV250(\'/storage/emulated/0/Download\')" style="padding:4px 8px;border-radius:7px;background:#121824;border:1px solid #30363d;color:#3fb950;font-size:10.5px;font-weight:bold;white-space:nowrap;">📥 Download</button>' +
                        '</div>' +
                        '<div id="islandImgPickerCurPathV250" style="color:#8b949e;font-family:monospace;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">/storage/emulated/0</div>' +
                    '</div>' +
                    '<div id="islandImgPickerListV250" style="padding:10px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;flex:1;"></div>' +
                '</div>';
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
        var initial = startDir;
        if (!initial) {
            var saved = getIslandCustomArtPathV250();
            if (saved && saved.lastIndexOf('/') > 0) {
                initial = saved.substring(0, saved.lastIndexOf('/'));
            } else {
                initial = window._islandImgBrowserCurDirV250 || '/storage/emulated/0';
            }
        }
        window.loadIslandImageBrowserDirV250(initial);
    };

    window.onIslandBgTransparencyChangedV247 = function(val) {
        var clean = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
        window.appConfig = window.appConfig || {};
        window.appConfig.islandBgTransparencyPct = clean;
        try {
            localStorage.setItem('jenny_island_bg_trans_v247', String(clean));
            localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
        } catch (e) {}
        var lbl = document.getElementById('lblIslandTransValV247');
        if (lbl) lbl.textContent = clean + '%';
        if (window.AndroidBridge && typeof window.AndroidBridge.setIslandBgTransparency === 'function') {
            try {
                window.AndroidBridge.setIslandBgTransparency(clean);
            } catch (e) {}
        }
    };

    function ensureIslandSettingsBlockV247() {
        var settingsModal = document.getElementById('settingsModal');
        if (!settingsModal) return;
        var container = settingsModal.querySelector('.container') || settingsModal;
        if (!container || document.getElementById('jennyIslandSettingsBoxV247')) return;

        var curVal = getSavedIslandTransparencyPctV247();
        var showTrackArt = getIslandShowTrackArtV250();
        var useCustomArt = getIslandUseCustomArtV250();
        var customArtPath = getIslandCustomArtPathV250();
        var singleSourceOn = window.getIslandSingleSourceModeV263();
        var safePathTxt = customArtPath ? customArtPath.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Картинка ещё не выбрана';

        var box = document.createElement('div');
        box.id = 'jennyIslandSettingsBoxV247';
        box.className = 'setting-row';
        box.style.cssText = 'border:none;background:var(--bg-setting-box, #101520);padding:12px;border-radius:10px;margin-bottom:14px;border-left:3px solid #a371f7;display:flex;flex-direction:column;gap:8px;';
        box.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                '<span style="color:#e6edf3;font-weight:bold;font-size:13px;">Настройка плашки (Прозрачность заливки)</span>' +
                '<span id="lblIslandTransValV247" style="color:#d2a8ff;font-family:monospace;font-weight:bold;font-size:12.5px;">' + curVal + '%</span>' +
            '</div>' +
            '<input type="range" id="rngIslandTransV247" min="0" max="100" step="1" value="' + curVal + '" ' +
                'oninput="window.onIslandBgTransparencyChangedV247(this.value)" ' +
                'onchange="window.onIslandBgTransparencyChangedV247(this.value)" ' +
                'style="width:100%;accent-color:#a371f7;height:6px;cursor:pointer;">' +
            '<div style="display:flex;justify-content:space-between;font-size:10.5px;color:#8b949e;">' +
                '<span>0 — Непрозрачная заливка (фон скрыт)</span>' +
                '<span>100 — Прозрачная заливка (фон чёткий)</span>' +
            '</div>' +
            '<div style="margin-top:4px;padding-top:8px;border-top:1px solid rgba(163,113,247,0.22);display:flex;flex-direction:column;gap:7px;">' +
                '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:#e6edf3;font-size:12px;font-weight:600;">' +
                    '<input type="checkbox" id="chkIslandSingleSourceV263" ' + (singleSourceOn ? 'checked ' : '') +
                        'onchange="window.onIslandSingleSourceModeChangedV263()" style="width:16px;height:16px;accent-color:#3fb950;">' +
                    '<span>🎯 Играть что-то одно (авто-пауза других режимов островка)</span>' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:#e6edf3;font-size:12px;font-weight:600;">' +
                    '<input type="checkbox" id="chkIslandShowTrackArtV250" ' + (showTrackArt ? 'checked ' : '') +
                        'onchange="window.onIslandArtSettingChangedV250()" style="width:16px;height:16px;accent-color:#a371f7;">' +
                    '<span>Отображать превью трека</span>' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:#e6edf3;font-size:12px;font-weight:600;">' +
                    '<input type="checkbox" id="chkIslandUseCustomArtV250" ' + (useCustomArt ? 'checked ' : '') +
                        'onchange="window.onIslandArtSettingChangedV250()" style="width:16px;height:16px;accent-color:#ff8c42;">' +
                    '<span>Заменить на своё изображение (тест для всех режимов)</span>' +
                '</label>' +
                '<div style="display:flex;align-items:center;gap:7px;background:#090d14;border:1px solid #262c36;border-radius:8px;padding:6px 8px;">' +
                    '<div id="lblIslandCustomArtPathV250" onclick="window.openIslandImageBrowserModalV250()" ' +
                        'style="flex:1;min-width:0;font-family:monospace;font-size:10.5px;color:' + (customArtPath ? '#79c0ff' : '#8b949e') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;">' +
                        safePathTxt +
                    '</div>' +
                    '<button type="button" onclick="window.openIslandImageBrowserModalV250()" ' +
                        'style="padding:5px 9px;border-radius:7px;background:rgba(163,113,247,0.2);border:1px solid #a371f7;color:#d2a8ff;font-size:11px;font-weight:bold;flex-shrink:0;">' +
                        '🖼️ Выбрать картинку' +
                    '</button>' +
                '</div>' +
            '</div>';

        var firstRow = container.querySelector('.setting-row');
        if (firstRow && firstRow.parentNode === container) {
            container.insertBefore(box, firstRow);
        } else {
            container.appendChild(box);
        }
    }

    installBiDirectionalSourceHooksV245();
    setTimeout(function() {
        installBiDirectionalSourceHooksV245();
        ensureIslandSettingsBlockV247();
        window.onIslandBgTransparencyChangedV247(getSavedIslandTransparencyPctV247());
        window.syncIslandBgImageV250(true);
    }, 350);

    // -------------------------------------------------------------------------
    // 4. СИНХРОНИЗАЦИЯ СОСТОЯНИЯ ПЛЕЕРА С НАТИВНОЙ ПЛАШКОЙ (БЕЗ ЖЁЛТЫХ ЭМОДЗИ)
    // -------------------------------------------------------------------------
    window.syncPermanentForegroundNotificationV212 = window.syncAndroidNotification = function(force) {
        if (!window.AndroidBridge) return;
        installBiDirectionalSourceHooksV245();
        ensureIslandSettingsBlockV247();

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

        var isYtDeckA = Boolean(
            (window._isYoutubeDeckAActiveV253 || isYtTaggedNameV262(window.currentPlayingTrack)) &&
            !/\.(xflac|flac)$/i.test(String(window.currentPlayingTrack || ''))
        );
        if (!isYtDeckA && window.currentPlayingTrack && !(window.isVideoFileNameV130 && window.isVideoFileNameV130(window.currentPlayingTrack))) {
            window._lastLocalDeckATrackV262 = window.currentPlayingTrack;
        }
        var isYtDeckB = Boolean(
            window._isYoutubeDeckBActiveV262 ||
            (snap.stVid && snap.stVid.active && (isYtTaggedNameV262(snap.stVid.currentTitle) || isYtTaggedNameV262(snap.stVid.currentUrl)))
        );
        var isYtExt = Boolean(snap.extAud && (snap.extAud._ytVideoIdV252 || snap.extAud._previewOwnerModalV241 === 'jennyYoutubeStudioModalV230' || String(snap.extAud._pagePath || '').indexOf('yt:') === 0));

        var localDeckAPlaying = Boolean(snap.deckAPlaying && !isYtDeckA);
        var localDeckBPlaying = Boolean(snap.deckBPlaying && !isYtDeckB);
        var localPlayingAny = Boolean(localDeckAPlaying || localDeckBPlaying);
        var ytPlayingAny = Boolean((snap.extPlaying && isYtExt) || (snap.deckAPlaying && isYtDeckA) || (snap.deckBPlaying && isYtDeckB));

        var activeMode = window._islandActiveModeV245 || 'music';
        var recentExplicitSwitch = (now - (window._islandExplicitModeTsV245 || 0) < 2500);
        if (!recentExplicitSwitch) {
            if (snap.radioPlaying) {
                activeMode = 'radio';
                window._islandActiveModeV245 = 'radio';
                window._lastActiveMediaSourceV243 = 'radio';
            } else if (ytPlayingAny && localPlayingAny) {
                // Одновременно играют YouTube (например, видео в Деке Б) и локальный трек (в Деке А) — оставляем выбранную вкладку островка!
                if (activeMode !== 'youtube' && activeMode !== 'music') {
                    activeMode = 'youtube';
                    window._islandActiveModeV245 = 'youtube';
                }
            } else if (ytPlayingAny) {
                activeMode = 'youtube';
                window._islandActiveModeV245 = 'youtube';
                window._lastActiveMediaSourceV243 = 'youtube';
            } else if (snap.extPlaying) {
                activeMode = 'soundcloud';
                window._islandActiveModeV245 = 'soundcloud';
                window._lastActiveMediaSourceV243 = 'external';
            } else if (localPlayingAny) {
                activeMode = 'music';
                window._islandActiveModeV245 = 'music';
                window._lastActiveMediaSourceV243 = localDeckAPlaying ? 'deckA' : 'deckB';
            }
        }

        // Состояние кнопки Play/Pause на островке строго соответствует выбранной вкладке островка!
        if (window._islandPauseOptimisticUntilV263 && now < window._islandPauseOptimisticUntilV263) {
            isActuallyPlaying = false;
        } else if (activeMode === 'youtube') {
            isActuallyPlaying = ytPlayingAny;
        } else if (activeMode === 'music') {
            isActuallyPlaying = localPlayingAny;
        } else if (activeMode === 'radio') {
            isActuallyPlaying = Boolean(snap.radioPlaying);
        } else if (activeMode === 'soundcloud') {
            isActuallyPlaying = Boolean(snap.extPlaying && !isYtExt);
        }

        var titleParts = [];
        var subParts = [];
        if (window._islandExportStatusV247) {
            subParts.push(window._islandExportStatusV247);
        } else if (activeTorCnt > 0) {
            subParts.push('P2P: ' + sumKbps + ' КБ/с (' + torPct + '%)');
        }

        var posSec = 0, durSec = 0, spd = 1.0;
        var isRevA = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

        if (activeMode === 'radio' && snap.radioPlaying) {
            var rName = stripLeadingEmojisV247(window.resolveCurrentRadioTitleV243());
            titleParts.push(rName);
            subParts.push((window._radioStateV91 && window._radioStateV91.isRecording) ? 'Запись эфира • Прямой поток' : 'Прямой радиоэфир');
        } else if (activeMode === 'youtube' && ytPlayingAny) {
            if (snap.deckAPlaying && isYtDeckA) {
                var ytMetaA = window._lastYtTrackMetaV252 || {};
                var cleanYtA = stripLeadingEmojisV247(ytMetaA.title || String(window.currentPlayingTrack || '').replace(/^\[YT[^\]]*\]\s*/, '').replace(/\s*\[[A-Za-z0-9_-]{11}\](\.[a-z0-9]+)?$/i, ''));
                titleParts.push(cleanYtA || 'YouTube');
                if (!window._islandExportStatusV247) {
                    subParts.push(stripLeadingEmojisV247(ytMetaA.channel ? ('YouTube • ' + ytMetaA.channel) : 'YouTube • Аудио (Дека А)'));
                }
                durSec = (window.studioBuffer && window.studioBuffer.duration > 0)
                    ? window.studioBuffer.duration
                    : ((snap.player && isFinite(snap.player.duration) && snap.player.duration > 0 && snap.player.duration < 864000)
                        ? snap.player.duration
                        : Number(window._ytKnownDeckADurationV253 || ytMetaA.duration || 0));
                var rawPosYtA = (typeof window.getTruePlaybackTimeV74_2 === 'function' && window.studioBuffer)
                    ? window.getTruePlaybackTimeV74_2()
                    : ((snap.player && isFinite(snap.player.currentTime)) ? snap.player.currentTime : 0);
                var rawSpdYtA = (typeof window.getActiveTargetSpeedV59 === 'function')
                    ? window.getActiveTargetSpeedV59()
                    : ((snap.player && snap.player.playbackRate) || 1.0);
                posSec = (isRevA && durSec > 0) ? Math.max(0, durSec - rawPosYtA) : rawPosYtA;
                spd = isRevA ? -Math.abs(rawSpdYtA) : Math.abs(rawSpdYtA);
            } else if (snap.deckBPlaying && isYtDeckB && snap.stVid) {
                var cleanYtB = stripLeadingEmojisV247(String(snap.stVid.currentTitle || 'YouTube Видео').replace(/^\[YT[^\]]*\]\s*/, '').replace(/\.(mp4|mkv|webm|avi|mov)$/i, ''));
                titleParts.push(cleanYtB || 'YouTube Видео');
                if (!window._islandExportStatusV247) {
                    subParts.push('YouTube • Видео (Дека Б)');
                }
                if (snap.vid) {
                    var isRevYtB = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
                    durSec = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(snap.vid) : (snap.vid.duration || Number(window._ytDeckBKnownDurationSecV253 || 0));
                    posSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(snap.vid) : (snap.vid.currentTime || 0);
                    var rawSpdYtB = (window.videoDeckV131 && window.videoDeckV131.speed) || snap.vid.playbackRate || 1.0;
                    spd = isRevYtB ? -Math.abs(rawSpdYtB) : Math.abs(rawSpdYtB);
                }
            } else if (snap.extPlaying && isYtExt) {
                var ytTitle = stripLeadingEmojisV247(snap.extAud._ytTitleV252 || window._lastExternalTitleV243 || 'YouTube');
                var ytChan = stripLeadingEmojisV247(snap.extAud._ytChannelV252 || 'YouTube Music');
                titleParts.push(ytTitle);
                if (!window._islandExportStatusV247) subParts.push(ytChan);
                durSec = (typeof window.getEffectiveYtTotalDurSecV252 === 'function')
                    ? window.getEffectiveYtTotalDurSecV252(snap.extAud)
                    : (isFinite(snap.extAud.duration) ? snap.extAud.duration : 0);
                posSec = (typeof window.getEffectiveYtCurrentSecV252 === 'function')
                    ? window.getEffectiveYtCurrentSecV252(snap.extAud)
                    : (isFinite(snap.extAud.currentTime) ? snap.extAud.currentTime : 0);
            }
        } else if (activeMode === 'soundcloud' && snap.extPlaying && !isYtExt) {
            titleParts.push(resolveCurrentScTitleV245());
            if (!window._islandExportStatusV247) subParts.push('SoundCloud');
            durSec = (typeof window.getEffectiveScTotalDurSecV250 === 'function')
                ? window.getEffectiveScTotalDurSecV250(snap.extAud)
                : (isFinite(snap.extAud.duration) ? snap.extAud.duration : 0);
            posSec = (typeof window.getEffectiveScCurrentTimeSecV250 === 'function')
                ? window.getEffectiveScCurrentTimeSecV250(snap.extAud)
                : (isFinite(snap.extAud.currentTime) ? snap.extAud.currentTime : 0);
        } else if (activeMode === 'music' && localPlayingAny) {
            // Фиолетовая вкладка («music») показывает ТОЛЬКО локальные файлы (без дублирования [YT] / [YT Поток])!
            if (localDeckAPlaying && window.currentPlayingTrack) {
                var cleanA = stripLeadingEmojisV247(String(window.currentPlayingTrack).replace(/\.(opus|m4a|mp3|wav|flac|ogg|xflac)$/i, ''));
                titleParts.push(cleanA);
                durSec = (window.studioBuffer && window.studioBuffer.duration > 0)
                    ? window.studioBuffer.duration
                    : ((snap.player && isFinite(snap.player.duration) && snap.player.duration > 0) ? snap.player.duration : 0);
                var rawPosA = (typeof window.getTruePlaybackTimeV74_2 === 'function')
                    ? window.getTruePlaybackTimeV74_2()
                    : ((snap.player && isFinite(snap.player.currentTime)) ? snap.player.currentTime : 0);
                var rawSpdA = (typeof window.getActiveTargetSpeedV59 === 'function')
                    ? window.getActiveTargetSpeedV59()
                    : ((snap.player && snap.player.playbackRate) || 1.0);
                posSec = (isRevA && durSec > 0) ? Math.max(0, durSec - rawPosA) : rawPosA;
                spd = isRevA ? -Math.abs(rawSpdA) : Math.abs(rawSpdA);
            }
            if (localDeckBPlaying && snap.stVid.currentTitle) {
                var cleanB = stripLeadingEmojisV247(String(snap.stVid.currentTitle).replace(/\.(mp4|mkv|webm|avi|mov)$/i, ''));
                titleParts.push(cleanB);
                if (!localDeckAPlaying && snap.vid) {
                    var isRevB = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
                    durSec = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(snap.vid) : (snap.vid.duration || 0);
                    var rawPosB = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(snap.vid) : (snap.vid.currentTime || 0);
                    var rawSpdB = (window.videoDeckV131 && window.videoDeckV131.speed) || snap.vid.playbackRate || 1.0;
                    posSec = rawPosB;
                    spd = isRevB ? -Math.abs(rawSpdB) : Math.abs(rawSpdB);
                }
            }
            if (!window._islandExportStatusV247) {
                if (localDeckAPlaying && localDeckBPlaying) subParts.push('Дека А + Дека Б');
                else if (localDeckBPlaying) subParts.push('Дека Б • x' + Math.abs(spd));
                else if (localDeckAPlaying) subParts.push((isRevA ? 'Реверс • x' : 'Дека А • x') + Math.abs(spd));
            }
        }

        if (!isActuallyPlaying) {
            if (activeMode === 'youtube') {
                var pausedYtMeta = window._lastYtTrackMetaV252 || ((window._ytStudioStateV252 && Array.isArray(window._ytStudioStateV252.results) && window._ytStudioStateV252.results.length > 0) ? window._ytStudioStateV252.results[0] : null);
                if (isYtDeckB && snap.stVid && snap.stVid.active && snap.stVid.currentTitle) {
                    var pausedYtVidTitle = stripLeadingEmojisV247(String(snap.stVid.currentTitle).replace(/^\[YT[^\]]*\]\s*/, '').replace(/\.(mp4|mkv|webm|avi|mov)$/i, ''));
                    titleParts = [pausedYtVidTitle || 'YouTube Видео'];
                    if (!window._islandExportStatusV247) subParts = ['YouTube Видео на паузе • Дека Б'];
                    if (snap.vid) {
                        durSec = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(snap.vid) : (snap.vid.duration || Number(window._ytDeckBKnownDurationSecV253 || 0));
                        posSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(snap.vid) : (snap.vid.currentTime || 0);
                    }
                } else {
                    var pausedYtTitle = stripLeadingEmojisV247((snap.extAud && snap.extAud._ytTitleV252) || (pausedYtMeta && pausedYtMeta.title) || (isYtDeckA ? String(window.currentPlayingTrack || '').replace(/^\[YT[^\]]*\]\s*/, '').replace(/\s*\[[A-Za-z0-9_-]{11}\](\.[a-z0-9]+)?$/i, '') : '') || 'YouTube Studio & Music');
                    titleParts = [pausedYtTitle];
                    if (!window._islandExportStatusV247) {
                        subParts = [pausedYtMeta ? ('YouTube на паузе • ' + (pausedYtMeta.channel || 'YouTube')) : 'Выберите трек или клип в YouTube Studio'];
                    }
                    if (isYtDeckA) {
                        durSec = (window.studioBuffer && window.studioBuffer.duration > 0)
                            ? window.studioBuffer.duration
                            : ((snap.player && isFinite(snap.player.duration) && snap.player.duration > 0 && snap.player.duration < 864000)
                                ? snap.player.duration
                                : Number(window._ytKnownDeckADurationV253 || (pausedYtMeta && pausedYtMeta.duration) || 0));
                        posSec = (typeof window.getTruePlaybackTimeV74_2 === 'function' && window.studioBuffer)
                            ? window.getTruePlaybackTimeV74_2()
                            : ((snap.player && isFinite(snap.player.currentTime)) ? snap.player.currentTime : 0);
                    } else if (snap.extAud && isYtExt) {
                        durSec = (typeof window.getEffectiveYtTotalDurSecV252 === 'function') ? window.getEffectiveYtTotalDurSecV252(snap.extAud) : 0;
                        posSec = (typeof window.getEffectiveYtCurrentSecV252 === 'function') ? window.getEffectiveYtCurrentSecV252(snap.extAud) : 0;
                    } else if (pausedYtMeta && Number(pausedYtMeta.duration) > 0) {
                        durSec = Number(pausedYtMeta.duration);
                    }
                }
            } else if (activeMode === 'radio') {
                titleParts.push(stripLeadingEmojisV247(window.resolveCurrentRadioTitleV243()));
                if (!window._islandExportStatusV247) subParts.push('Радиоэфир на паузе');
            } else if (activeMode === 'soundcloud') {
                titleParts.push(resolveCurrentScTitleV245());
                if (!window._islandExportStatusV247) subParts.push('SoundCloud на паузе');
                if (snap.extAud) {
                    durSec = (typeof window.getEffectiveScTotalDurSecV250 === 'function')
                        ? window.getEffectiveScTotalDurSecV250(snap.extAud)
                        : (isFinite(snap.extAud.duration) ? snap.extAud.duration : 0);
                    posSec = (typeof window.getEffectiveScCurrentTimeSecV250 === 'function')
                        ? window.getEffectiveScCurrentTimeSecV250(snap.extAud)
                        : (isFinite(snap.extAud.currentTime) ? snap.extAud.currentTime : 0);
                } else {
                    var pausedScTrk = resolveCurrentScTrackObjV250();
                    if (pausedScTrk && typeof window.parseScDurationSecV250 === 'function') {
                        durSec = window.parseScDurationSecV250(pausedScTrk);
                    }
                }
            } else if (window._lastActiveMediaSourceV243 === 'deckB' && snap.stVid && snap.stVid.active && snap.stVid.currentTitle && !isYtDeckB) {
                titleParts.push(stripLeadingEmojisV247(String(snap.stVid.currentTitle).replace(/\.(mp4|mkv|webm|avi|mov)$/i, '')));
                if (!window._islandExportStatusV247) subParts.push('Видео на паузе');
                if (snap.vid) {
                    durSec = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(snap.vid) : (snap.vid.duration || 0);
                    posSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(snap.vid) : (snap.vid.currentTime || 0);
                }
            } else if (!isYtDeckA && window.currentPlayingTrack) {
                var cleanPausedA = stripLeadingEmojisV247(String(window.currentPlayingTrack).replace(/\.(opus|m4a|mp3|wav|flac|ogg|xflac)$/i, ''));
                titleParts.push(cleanPausedA);
                durSec = (window.studioBuffer && window.studioBuffer.duration > 0)
                    ? window.studioBuffer.duration
                    : ((snap.player && isFinite(snap.player.duration) && snap.player.duration > 0) ? snap.player.duration : 0);
                if (window._endOfQueueReachedV247) {
                    if (!window._islandExportStatusV247) subParts.push('Конец очереди');
                    posSec = 0;
                } else {
                    if (!window._islandExportStatusV247) subParts.push(isRevA ? 'Реверс • На паузе' : 'На паузе');
                    var pausedRawPos = (typeof window.getTruePlaybackTimeV74_2 === 'function')
                        ? window.getTruePlaybackTimeV74_2()
                        : ((snap.player && isFinite(snap.player.currentTime)) ? snap.player.currentTime : 0);
                    posSec = (isRevA && durSec > 0) ? Math.max(0, durSec - pausedRawPos) : pausedRawPos;
                }
            } else if (window._lastLocalDeckATrackV262 || (Array.isArray(window.allTracks) && window.allTracks.length > 0)) {
                var fallbackLocalTrk = window._lastLocalDeckATrackV262 || window.allTracks[0];
                var cleanFallbackA = stripLeadingEmojisV247(String(fallbackLocalTrk).replace(/\.(opus|m4a|mp3|wav|flac|ogg|xflac)$/i, ''));
                titleParts.push(cleanFallbackA);
                var fbMeta = (window.lastData && window.lastData.track_meta && window.lastData.track_meta[fallbackLocalTrk]) || {};
                durSec = Number(fbMeta.dur || 0);
                posSec = 0;
                if (!window._islandExportStatusV247) subParts.push('Локальный плеер • На паузе');
            } else if (activeTorCnt > 0) {
                titleParts.push('Закачка P2P (' + activeTorCnt + ' разд. • ' + torPct + '%)');
                if (!window._islandExportStatusV247) subParts.push('Фоновая загрузка активна');
            } else {
                titleParts.push('Jenny Player');
                if (!window._islandExportStatusV247) subParts.push('Готов к воспроизведению');
            }
        }

        var isFav = Boolean(window.currentPlayingTrack && Array.isArray(window.favorites) && window.favorites.indexOf(window.currentPlayingTrack) !== -1);
        var isRadioRec = (typeof window._radioRecOptimisticV249 === 'boolean')
            ? window._radioRecOptimisticV249
            : Boolean(window._radioStateV91 && window._radioStateV91.isRecording);
        var radioQuality = resolveCurrentRadioQualityV249();
        var extraRaw = (activeMode === 'radio')
            ? (radioQuality + (isRadioRec ? '|REC' : ''))
            : String(window.currentPlayingTrack || '');

        var finalTitle = titleParts.join(' │ ');
        var finalSub = subParts.join(' • ');
        var curSig = finalTitle + '|' + finalSub + '|' + (isActuallyPlaying ? '1' : '0') + '|' + (isFav ? 'F1' : 'F0') + '|' + activeMode + '|' + (isRevA ? 'R1' : 'R0') + '|' + extraRaw;

        window.syncIslandBgImageV250(Boolean(force));

        if (!force && curSig === window._lastNotifSigV243 && (!isActuallyPlaying || (now - (window._lastPermNotifSyncTsV212 || 0) < 900))) {
            return;
        }
        window._lastNotifSigV243 = curSig;
        window._lastPermNotifSyncTsV212 = now;

        try {
            if (typeof window.AndroidBridge.updateIslandExtraState === 'function') {
                window.AndroidBridge.updateIslandExtraState(isFav, activeMode, extraRaw);
            }
            if (typeof window.AndroidBridge.updateMediaStateFull === 'function') {
                window.AndroidBridge.updateMediaStateFull(finalTitle, finalSub, isActuallyPlaying, posSec, durSec, spd);
            } else if (typeof window.AndroidBridge.updateMediaState === 'function') {
                window.AndroidBridge.updateMediaState(finalTitle + ' || ' + finalSub, isActuallyPlaying, posSec, durSec, spd);
            }
        } catch (e) {}
    };

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

    // -------------------------------------------------------------------------
    // 5. ОБРАБОТЧИК КОМАНД ИЗ ISLANDOVERLAYCONTROLLER.JAVA
    // -------------------------------------------------------------------------
    window.handleIslandCommandV245 = async function(cmd, arg) {
        var c = String(cmd || '').toLowerCase();
        var a = String(arg || '');
        var snap = window.getActiveSourcesSnapshotV243 ? window.getActiveSourcesSnapshotV243() : {};
        var curMode = window._islandActiveModeV245 || 'music';

        // [FIX-ISLAND-RADIO-V249] Запись радиоэфира по нажатию кнопки REC на синей плашке
        if (c === 'radio_rec') {
            if (typeof window.toggleRadioRecordToXflacV91 === 'function') {
                await window.toggleRadioRecordToXflacV91();
            }
            window.syncPermanentForegroundNotificationV212(true);
            return;
        }

        // [FIX-YOUTUBE-COMPLETE-V252] Скачивание текущего трека YouTube в .xFLAC по нажатию кнопки Скачать на красной плашке
        if (c === 'yt_download') {
            if (curMode !== 'youtube') return;
            var ytIdx = (typeof window._lastYtTrackIdxV252 === 'number' && window._lastYtTrackIdxV252 >= 0) ? window._lastYtTrackIdxV252 : 0;
            window._islandExportStatusV247 = 'Сохранение в .xFLAC...';
            window.syncPermanentForegroundNotificationV212(true);
            try {
                if (typeof window.saveYtItemAsXflacV252 === 'function') {
                    await window.saveYtItemAsXflacV252(ytIdx, null);
                    window._islandExportStatusV247 = 'Сохранено в плеер!';
                }
            } catch (e) {
                window._islandExportStatusV247 = 'Ошибка сохранения';
            }
            window.syncPermanentForegroundNotificationV212(true);
            setTimeout(function() {
                window._islandExportStatusV247 = '';
                window.syncPermanentForegroundNotificationV212(true);
            }, 2800);
            return;
        }

        // [FIX-ISLAND-SC-V250] Скачивание текущего трека SoundCloud в плеер по нажатию кнопки Скачать на оранжевой плашке
        if (c === 'sc_download') {
            if (curMode !== 'soundcloud') return;
            var scTrk = resolveCurrentScTrackObjV250();
            if (!scTrk) {
                if (typeof window.showToast === 'function') window.showToast('Сначала запусти трек SoundCloud');
                return;
            }
            var bodyEl = document.getElementById('scDedicatedBodyV93');
            var btnEl = bodyEl ? bodyEl.querySelector('button[onclick*="downloadScTrackV96(' + scTrk.index + ',"]') : null;
            window._islandExportStatusV247 = 'Скачивание в плеер...';
            window.syncPermanentForegroundNotificationV212(true);
            try {
                if (typeof window.downloadScTrackV96 === 'function') {
                    await window.downloadScTrackV96(scTrk.index, btnEl);
                    window._islandExportStatusV247 = 'Скачано в плеер!';
                }
            } catch (e) {
                window._islandExportStatusV247 = 'Ошибка скачивания';
            }
            window.syncPermanentForegroundNotificationV212(true);
            setTimeout(function() {
                window._islandExportStatusV247 = '';
                window.syncPermanentForegroundNotificationV212(true);
            }, 2800);
            return;
        }

        // Прямой экспорт локального трека со всеми активными эффектами в .xFLAC (с распаковкой в WAV -> запеканием DSP -> упаковкой в .xFLAC)
        if (c === 'export_xflac' || c === 'share' || c === 'export') {
            if (curMode !== 'music') return;
            if (!window.currentPlayingTrack && Array.isArray(window.allTracks) && window.allTracks.length > 0) {
                window.currentPlayingTrack = window.allTracks[0];
            }
            if (!window.currentPlayingTrack) {
                if (typeof window.showToast === 'function') window.showToast('Сначала выбери локальный трек');
                return;
            }
            window.appConfig = window.appConfig || {};
            var curBr = String(window.appConfig.pocketBitrateV77 || '').toLowerCase();
            if (curBr.indexOf('xflac') !== 0) {
                window.appConfig.pocketBitrateV77 = 'xflac_ultra';
            }
            window._islandExportStatusV247 = 'Экспорт в .xFLAC...';
            window.syncPermanentForegroundNotificationV212(true);
            try {
                if (typeof window.executeTrackExportV69 === 'function') {
                    await window.executeTrackExportV69();
                    window._islandExportStatusV247 = 'Сохранено в .xFLAC!';
                }
            } catch (e) {
                window._islandExportStatusV247 = 'Ошибка экспорта';
            }
            window.syncPermanentForegroundNotificationV212(true);
            setTimeout(function() {
                window._islandExportStatusV247 = '';
                window.syncPermanentForegroundNotificationV212(true);
            }, 2800);
            return;
        }

        // Избранное (работает только для локальных аудиофайлов в режиме Музыки)
        if (c === 'fav') {
            if (curMode !== 'music') return;
            var trk = window.currentPlayingTrack;
            if (!trk && Array.isArray(window.allTracks) && window.allTracks.length > 0) {
                trk = window.allTracks[0];
                window.currentPlayingTrack = trk;
            }
            if (trk && typeof window.toggleFav === 'function') {
                window.toggleFav(trk);
            }
            window.syncPermanentForegroundNotificationV212(true);
            return;
        }

        var isYtDeckACmd = Boolean(
            (window._isYoutubeDeckAActiveV253 || isYtTaggedNameV262(window.currentPlayingTrack)) &&
            !/\.(xflac|flac)$/i.test(String(window.currentPlayingTrack || ''))
        );
        var isYtDeckBCmd = Boolean(
            window._isYoutubeDeckBActiveV262 ||
            (snap.stVid && snap.stVid.active && (isYtTaggedNameV262(snap.stVid.currentTitle) || isYtTaggedNameV262(snap.stVid.currentUrl)))
        );

        // Перемотка ползунком (с учётом обратного воспроизведения isReversed и потоков YouTube / SoundCloud!)
        if (c === 'seek') {
            var targetSec = Math.max(0, parseFloat(a) || 0);
            window._islandExplicitModeTsV245 = Date.now();
            if (curMode === 'youtube') {
                window._islandActiveModeV245 = 'youtube';
                window._lastActiveMediaSourceV243 = 'youtube';
                if (isYtDeckBCmd && (!isYtDeckACmd || (snap.deckBPlaying && !snap.deckAPlaying))) {
                    if (typeof window.seekDeckBAndPlayerSyncedV212 === 'function') {
                        window.seekDeckBAndPlayerSyncedV212(targetSec, false, true);
                    } else if (snap.vid) {
                        try { snap.vid.currentTime = targetSec; } catch (e) {}
                    }
                } else if (typeof window.seekYoutubeStreamToSecV252 === 'function') {
                    window.seekYoutubeStreamToSecV252(snap.extAud, targetSec);
                } else if (snap.player) {
                    try { snap.player.currentTime = targetSec; } catch (e) {}
                }
            } else if ((curMode === 'soundcloud' || snap.extPlaying) && snap.extAud) {
                if (typeof window.seekSoundCloudStreamToSecV250 === 'function') {
                    window.seekSoundCloudStreamToSecV250(snap.extAud, targetSec);
                } else if (isFinite(snap.extAud.duration) && snap.extAud.duration > 0 && typeof window.seekKhMiniPlayerV90 === 'function') {
                    var val1000 = Math.round((targetSec / snap.extAud.duration) * 1000);
                    window.seekKhMiniPlayerV90(val1000);
                } else {
                    try { snap.extAud.currentTime = targetSec; } catch (e) {}
                }
            } else if (snap.deckBPlaying && ! isYtDeckBCmd && (!snap.deckAPlaying || isYtDeckACmd) && snap.vid) {
                if (typeof window.seekDeckBAndPlayerSyncedV212 === 'function') {
                    window.seekDeckBAndPlayerSyncedV212(targetSec, false, true);
                } else {
                    try { snap.vid.currentTime = targetSec; } catch (e) {}
                }
            } else if (!isYtDeckACmd) {
                var isRevSeek = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
                var effDur = (window.studioBuffer && window.studioBuffer.duration > 0)
                    ? window.studioBuffer.duration
                    : ((snap.player && isFinite(snap.player.duration) && snap.player.duration > 0) ? snap.player.duration : 0);
                var engineSec = (isRevSeek && effDur > 0) ? Math.max(0, effDur - targetSec) : targetSec;
                window._endOfQueueReachedV247 = false;
                if (typeof window.seekDeckAToExactSecondV371 === 'function') {
                    window.seekDeckAToExactSecondV371(engineSec);
                } else if (typeof window.seekFromNotification === 'function') {
                    window.seekFromNotification(engineSec);
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
                window.pauseOtherIslandModesV263('music');
                window._lastActiveMediaSourceV243 = (snap.deckBPlaying && !isYtDeckBCmd) ? 'deckB' : 'deckA';
            } else if (mode === 'radio') {
                window.pauseOtherIslandModesV263('radio');
                window._lastActiveMediaSourceV243 = 'radio';
                startOrResumeOriginalRadioV245();
            } else if (mode === 'soundcloud') {
                window.pauseOtherIslandModesV263('soundcloud');
                window._lastActiveMediaSourceV243 = 'external';
                startOrResumeOriginalSoundCloudV245();
            } else if (mode === 'youtube') {
                window.pauseOtherIslandModesV263('youtube');
                window._lastActiveMediaSourceV243 = 'youtube';
            }
            setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
            return;
        }

        if (curMode === 'youtube') {
            window._islandActiveModeV245 = 'youtube';
            window._islandExplicitModeTsV245 = Date.now();
            window._lastActiveMediaSourceV243 = 'youtube';
            var ytList = (window._ytStudioStateV252 && window._ytStudioStateV252.results) || [];
            var curYtIdx = (typeof window._lastYtTrackIdxV252 === 'number' && window._lastYtTrackIdxV252 >= 0) ? window._lastYtTrackIdxV252 : 0;
            var ytPlayingNow = Boolean((snap.extPlaying && ! (window._islandPauseOptimisticUntilV263 && Date.now() < window._islandPauseOptimisticUntilV263)) || (snap.deckAPlaying && isYtDeckACmd) || (snap.deckBPlaying && isYtDeckBCmd));
            var ytStMode = (window._ytStudioStateV252 && window._ytStudioStateV252.mode) || 'music';
            if (c === 'next' || c === 'prev') {
                window._islandPauseOptimisticUntilV263 = 0;
                if (ytList.length > 0) {
                    var nextYtIdx = (curYtIdx + (c === 'next' ? 1 : -1) + ytList.length) % ytList.length;
                    if ((isYtDeckBCmd && !isYtDeckACmd) || (ytStMode === 'video' && !isYtDeckACmd)) {
                        if (typeof window.openYtItemInDeckBV252 === 'function') {
                            window.openYtItemInDeckBV252(nextYtIdx, null);
                        }
                    } else if (typeof window.playYtStudioItemByIndexV252 === 'function') {
                        window.playYtStudioItemByIndexV252(nextYtIdx, null);
                    }
                }
                return;
            }
            if (c === 'pause' || (c === 'toggle' && ytPlayingNow)) {
                window._islandPauseOptimisticUntilV263 = Date.now() + 650;
                if (isYtDeckACmd) {
                    window.pauseDeckAAudioDirectV263();
                }
                if (isYtDeckBCmd) {
                    window.pauseDeckBVideoDirectV263();
                }
                if (snap.extAud && !snap.extAud.paused) {
                    try { snap.extAud.pause(); } catch (e) {}
                }
                window.syncPermanentForegroundNotificationV212(true);
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 120);
                return;
            }
            if (c === 'play' || (c === 'toggle' && !ytPlayingNow)) {
                window._islandPauseOptimisticUntilV263 = 0;
                if (isYtDeckBCmd && snap.stVid && snap.stVid.active && (!isYtDeckACmd || window._lastActiveMediaSourceV243 === 'deckB')) {
                    window.pauseOtherIslandModesV263('youtube', 'deckB');
                    if (typeof window.toggleVideoPlayPauseV130 === 'function') {
                        window.toggleVideoPlayPauseV130();
                    }
                } else if (isYtDeckACmd && window.currentPlayingTrack) {
                    window.pauseOtherIslandModesV263('youtube', 'deckA');
                    window._userPausedV75_2 = false;
                    if (snap.player && snap.player.paused) {
                        snap.player.play().catch(function() {});
                    }
                    if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                        window.syncMasterPlaybackEngineV59(false);
                    }
                } else if (snap.extAud && snap.extAud._ytVideoIdV252) {
                    window.pauseOtherIslandModesV263('youtube');
                    snap.extAud.play().catch(function() {});
                } else if (ytList.length > 0) {
                    if (ytStMode === 'video' && typeof window.openYtItemInDeckBV252 === 'function') {
                        window.openYtItemInDeckBV252(curYtIdx, null);
                    } else if (typeof window.playYtStudioItemByIndexV252 === 'function') {
                        window.playYtStudioItemByIndexV252(curYtIdx, null);
                    }
                } else if (typeof window.openYoutubeStudioModalV230 === 'function') {
                    window.openYoutubeStudioModalV230('music');
                }
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 120);
                return;
            }
            window.syncPermanentForegroundNotificationV212(true);
            return;
        }

        if (curMode === 'radio') {
            window._lastActiveMediaSourceV243 = 'radio';
            if (c === 'next' || c === 'prev') {
                window._islandPauseOptimisticUntilV263 = 0;
                var curIdx = findCurrentRadioIndexV245();
                var step = (c === 'next') ? 1 : -1;
                triggerStationByIndexV245(curIdx + step);
                return;
            }
            if (c === 'pause' || (c === 'toggle' && snap.radioPlaying)) {
                window._islandPauseOptimisticUntilV263 = Date.now() + 650;
                if (snap.radAud) {
                    try { snap.radAud.pause(); } catch (e) {}
                }
                document.querySelectorAll('.rad-play-btn-v91').forEach(function(b) { b.innerText = '▶'; });
                window.syncPermanentForegroundNotificationV212(true);
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
                return;
            }
            if (c === 'play' || (c === 'toggle' && !snap.radioPlaying)) {
                window._islandPauseOptimisticUntilV263 = 0;
                window.pauseOtherIslandModesV263('radio');
                startOrResumeOriginalRadioV245();
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 120);
                return;
            }
        }

        if (curMode === 'soundcloud') {
            window._lastActiveMediaSourceV243 = 'external';
            if (c === 'next' || c === 'prev') {
                window._islandPauseOptimisticUntilV263 = 0;
                triggerSoundCloudByOffsetV245(c === 'next' ? 1 : -1);
                return;
            }
            if (c === 'pause' || (c === 'toggle' && snap.extPlaying)) {
                window._islandPauseOptimisticUntilV263 = Date.now() + 650;
                if (typeof window.toggleKhMiniPlayPauseV90 === 'function' && snap.extAud && !snap.extAud.paused) {
                    window.toggleKhMiniPlayPauseV90();
                } else if (snap.extAud) {
                    try { snap.extAud.pause(); } catch (e) {}
                }
                window.syncPermanentForegroundNotificationV212(true);
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
                return;
            }
            if (c === 'play' || (c === 'toggle' && !snap.extPlaying)) {
                window._islandPauseOptimisticUntilV263 = 0;
                window.pauseOtherIslandModesV263('soundcloud');
                startOrResumeOriginalSoundCloudV245();
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 120);
                return;
            }
        }

        // Режим локальных аудио/видеофайлов (Музыка: Дека А / Дека Б) — игнорируем [YT] треки, чтобы не дублировать!
        window._endOfQueueReachedV247 = false;
        var localBPlayingCmd = Boolean(snap.deckBPlaying && !isYtDeckBCmd);
        var localAPlayingCmd = Boolean(snap.deckAPlaying && !isYtDeckACmd);
        var localAnyPlayingCmd = Boolean(localAPlayingCmd || localBPlayingCmd);
        window._lastActiveMediaSourceV243 = (localBPlayingCmd && !localAPlayingCmd) ? 'deckB' : 'deckA';

        if (c === 'next') {
            window._islandPauseOptimisticUntilV263 = 0;
            if (localBPlayingCmd && !localAPlayingCmd && typeof window.playAdjacentVideoDeckBV216 === 'function') {
                window.playAdjacentVideoDeckBV216(1);
            } else if (isYtDeckACmd) {
                var nextLocal = window._lastLocalDeckATrackV262 || ((Array.isArray(window.allTracks) && window.allTracks.length > 0) ? window.allTracks[0] : '');
                if (nextLocal && typeof window.playTrack === 'function') window.playTrack(nextLocal);
            } else if (typeof window.playNextTrack === 'function') {
                window.playNextTrack();
            }
            setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
            return;
        }

        if (c === 'prev') {
            window._islandPauseOptimisticUntilV263 = 0;
            if (localBPlayingCmd && !localAPlayingCmd && typeof window.playAdjacentVideoDeckBV216 === 'function') {
                window.playAdjacentVideoDeckBV216(-1);
            } else if (isYtDeckACmd) {
                var prevLocal = window._lastLocalDeckATrackV262 || ((Array.isArray(window.allTracks) && window.allTracks.length > 0) ? window.allTracks[0] : '');
                if (prevLocal && typeof window.playTrack === 'function') window.playTrack(prevLocal);
            } else if (typeof window.playPreviousTrack === 'function') {
                window.playPreviousTrack();
            }
            setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
            return;
        }

        if (c === 'pause' || (c === 'toggle' && localAnyPlayingCmd)) {
            window._islandPauseOptimisticUntilV263 = Date.now() + 650;
            if (localAPlayingCmd) {
                window.pauseDeckAAudioDirectV263();
            }
            if (localBPlayingCmd) {
                window.pauseDeckBVideoDirectV263();
            }
            window.syncPermanentForegroundNotificationV212(true);
            setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 120);
            return;
        }

        if (c === 'play' || (c === 'toggle' && !localAnyPlayingCmd)) {
            window._islandPauseOptimisticUntilV263 = 0;
            var hasPausedLocalVideoB = Boolean(snap.stVid && snap.stVid.active && !isYtDeckBCmd);
            if (hasPausedLocalVideoB && (window._lastActiveMediaSourceV243 === 'deckB' || isYtDeckACmd || !window.currentPlayingTrack)) {
                window.pauseOtherIslandModesV263('music', 'deckB');
                if (typeof window.toggleVideoPlayPauseV130 === 'function') {
                    window.toggleVideoPlayPauseV130();
                }
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 120);
                return;
            }
            if (isYtDeckACmd || !window.currentPlayingTrack) {
                var targetLocalTrk = window._lastLocalDeckATrackV262 || ((Array.isArray(window.allTracks) && window.allTracks.length > 0) ? window.allTracks[0] : '');
                if (targetLocalTrk && typeof window.playTrack === 'function') {
                    window.playTrack(targetLocalTrk);
                    setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 120);
                    return;
                }
            }
            window.pauseOtherIslandModesV263('music', 'deckA');
            window._userPausedV75_2 = false;
            if (snap.player && snap.player.paused) {
                snap.player.play().catch(function() {});
            }
            if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            }
            setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 120);
            return;
        }

        if (typeof window.togglePlay === 'function') {
            window.togglePlay();
        } else if (typeof window.handleNativeMediaControlV243 === 'function') {
            window.handleNativeMediaControlV243(c);
        }
        setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
    };

    setInterval(function() {
        window.syncPermanentForegroundNotificationV212(false);
    }, 650);

    setTimeout(function() {
        window.syncPermanentForegroundNotificationV212(true);
    }, 200);
})();
