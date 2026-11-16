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
        return stripLeadingEmojisV247(window._lastExternalTitleV243 || 'SoundCloud Поток');
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
    function startOrResumeOriginalRadioV245() {
        var rst = window._radioStateV91;
        var radAud = (rst && rst.audio) || window._lastRadioAudioElV243;
        if (radAud && !radAud.paused && !radAud.ended && radAud.currentSrc) {
            return;
        }
        if (radAud && radAud.paused && (radAud.src || window._lastRadioSrcUrlV243)) {
            if (typeof window.pauseMainPlayerForOstV90 === 'function') window.pauseMainPlayerForOstV90();
            if (typeof window.stopKhPreviewV88 === 'function') window.stopKhPreviewV88();
            if (!radAud.src && window._lastRadioSrcUrlV243) {
                radAud.src = window._lastRadioSrcUrlV243;
            }
            radAud.play().catch(function() {
                triggerStationByIndexV245(window._lastRadioStationIdxV245 || 0);
            });
            return;
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

    function installBiDirectionalSourceHooksV245() {
        installAutoAdvanceAndReverseSyncV247();

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
                window._endOfQueueReachedV247 = false;
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

    // -------------------------------------------------------------------------
    // 3. НАСТРОЙКА ПРОЗРАЧНОСТИ ФОНА ПЛАШКИ (0–100%) В ОКНЕ НАСТРОЕК ПЛЕЕРА
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
        var box = document.createElement('div');
        box.id = 'jennyIslandSettingsBoxV247';
        box.className = 'setting-row';
        box.style.cssText = 'border:none;background:var(--bg-setting-box, #101520);padding:12px;border-radius:10px;margin-bottom:14px;border-left:3px solid #a371f7;display:flex;flex-direction:column;gap:8px;';
        box.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                '<span style="color:#e6edf3;font-weight:bold;font-size:13px;">Настройка плашки (Прозрачность фона)</span>' +
                '<span id="lblIslandTransValV247" style="color:#d2a8ff;font-family:monospace;font-weight:bold;font-size:12.5px;">' + curVal + '%</span>' +
            '</div>' +
            '<input type="range" id="rngIslandTransV247" min="0" max="100" step="1" value="' + curVal + '" ' +
                'oninput="window.onIslandBgTransparencyChangedV247(this.value)" ' +
                'onchange="window.onIslandBgTransparencyChangedV247(this.value)" ' +
                'style="width:100%;accent-color:#a371f7;height:6px;cursor:pointer;">' +
            '<div style="display:flex;justify-content:space-between;font-size:10.5px;color:#8b949e;">' +
                '<span>0 — Непрозрачная</span>' +
                '<span>100 — Полностью прозрачная</span>' +
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
        if (window._islandExportStatusV247) {
            subParts.push(window._islandExportStatusV247);
        } else if (activeTorCnt > 0) {
            subParts.push('P2P: ' + sumKbps + ' КБ/с (' + torPct + '%)');
        }

        var posSec = 0, durSec = 0, spd = 1.0;
        var isRevA = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

        if (snap.radioPlaying) {
            var rName = stripLeadingEmojisV247(window.resolveCurrentRadioTitleV243());
            titleParts.push(rName);
            subParts.push((window._radioStateV91 && window._radioStateV91.isRecording) ? 'Запись эфира • Прямой поток' : 'Прямой радиоэфир');
        } else if (snap.extPlaying) {
            titleParts.push(resolveCurrentScTitleV245());
            subParts.push('SoundCloud • Поток');
            durSec = isFinite(snap.extAud.duration) ? snap.extAud.duration : 0;
            posSec = isFinite(snap.extAud.currentTime) ? snap.extAud.currentTime : 0;
        } else if (snap.deckAPlaying || snap.deckBPlaying) {
            if (snap.deckAPlaying && window.currentPlayingTrack) {
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
                // Если в плеере включено обратное воспроизведение (Реверс) — полоса прогресса идёт назад!
                posSec = (isRevA && durSec > 0) ? Math.max(0, durSec - rawPosA) : rawPosA;
                spd = isRevA ? -Math.abs(rawSpdA) : Math.abs(rawSpdA);
            }
            if (snap.deckBPlaying && snap.stVid.currentTitle) {
                var cleanB = stripLeadingEmojisV247(String(snap.stVid.currentTitle).replace(/\.(mp4|mkv|webm|avi|mov)$/i, ''));
                titleParts.push(cleanB);
                if (!snap.deckAPlaying && snap.vid) {
                    var isRevB = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
                    durSec = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(snap.vid) : (snap.vid.duration || 0);
                    var rawPosB = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(snap.vid) : (snap.vid.currentTime || 0);
                    var rawSpdB = (window.videoDeckV131 && window.videoDeckV131.speed) || snap.vid.playbackRate || 1.0;
                    posSec = rawPosB;
                    spd = isRevB ? -Math.abs(rawSpdB) : Math.abs(rawSpdB);
                }
            }
            if (!window._islandExportStatusV247) {
                if (snap.deckAPlaying && snap.deckBPlaying) subParts.push('Дека А + Дека Б');
                else if (snap.deckBPlaying) subParts.push('Дека Б • x' + Math.abs(spd));
                else if (snap.deckAPlaying) subParts.push((isRevA ? 'Реверс • x' : 'Дека А • x') + Math.abs(spd));
            }
        }

        if (!isActuallyPlaying) {
            if (activeMode === 'youtube') {
                titleParts = ['YouTube Studio • Модуль в разработке'];
                if (!window._islandExportStatusV247) subParts = ['Заглушка: скоро прямое воспроизведение YouTube'];
            } else if (activeMode === 'radio') {
                titleParts.push(stripLeadingEmojisV247(window.resolveCurrentRadioTitleV243()));
                if (!window._islandExportStatusV247) subParts.push('Радиоэфир на паузе');
            } else if (activeMode === 'soundcloud') {
                titleParts.push(resolveCurrentScTitleV245());
                if (!window._islandExportStatusV247) subParts.push('SoundCloud на паузе');
                if (snap.extAud) {
                    durSec = isFinite(snap.extAud.duration) ? snap.extAud.duration : 0;
                    posSec = isFinite(snap.extAud.currentTime) ? snap.extAud.currentTime : 0;
                }
            } else if (window._lastActiveMediaSourceV243 === 'deckB' && snap.stVid && snap.stVid.active && snap.stVid.currentTitle) {
                titleParts.push(stripLeadingEmojisV247(String(snap.stVid.currentTitle).replace(/\.(mp4|mkv|webm|avi|mov)$/i, '')));
                if (!window._islandExportStatusV247) subParts.push('Видео на паузе');
                if (snap.vid) {
                    durSec = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(snap.vid) : (snap.vid.duration || 0);
                    posSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(snap.vid) : (snap.vid.currentTime || 0);
                }
            } else if (window.currentPlayingTrack) {
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
            } else if (activeTorCnt > 0) {
                titleParts.push('Закачка P2P (' + activeTorCnt + ' разд. • ' + torPct + '%)');
                if (!window._islandExportStatusV247) subParts.push('Фоновая загрузка активна');
            } else {
                titleParts.push('Jenny Player');
                if (!window._islandExportStatusV247) subParts.push('Готов к воспроизведению');
            }
        }

        var isFav = Boolean(window.currentPlayingTrack && Array.isArray(window.favorites) && window.favorites.indexOf(window.currentPlayingTrack) !== -1);

        var finalTitle = titleParts.join(' │ ');
        var finalSub = subParts.join(' • ');
        var curSig = finalTitle + '|' + finalSub + '|' + (isActuallyPlaying ? '1' : '0') + '|' + (isFav ? 'F1' : 'F0') + '|' + activeMode + '|' + (isRevA ? 'R1' : 'R0');

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

        // Перемотка ползунком (с учётом обратного воспроизведения isReversed!)
        if (c === 'seek') {
            var targetSec = Math.max(0, parseFloat(a) || 0);
            if ((curMode === 'soundcloud' || snap.extPlaying) && snap.extAud && isFinite(snap.extAud.duration) && snap.extAud.duration > 0) {
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
            }
            setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
            return;
        }

        if (curMode === 'youtube') {
            window.syncPermanentForegroundNotificationV212(true);
            return;
        }

        if (curMode === 'radio') {
            window._lastActiveMediaSourceV243 = 'radio';
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

        // Режим локальных аудиофайлов (Музыка: Дека А / Дека Б)
        window._endOfQueueReachedV247 = false;
        window._lastActiveMediaSourceV243 = (snap.deckBPlaying && !snap.deckAPlaying) ? 'deckB' : 'deckA';

        if (c === 'next') {
            if (snap.deckBPlaying && !snap.deckAPlaying && typeof window.playAdjacentVideoDeckBV216 === 'function') {
                window.playAdjacentVideoDeckBV216(1);
            } else if (typeof window.playNextTrack === 'function') {
                window.playNextTrack();
            }
            setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
            return;
        }

        if (c === 'prev') {
            if (snap.deckBPlaying && !snap.deckAPlaying && typeof window.playAdjacentVideoDeckBV216 === 'function') {
                window.playAdjacentVideoDeckBV216(-1);
            } else if (typeof window.playPreviousTrack === 'function') {
                window.playPreviousTrack();
            }
            setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 100);
            return;
        }

        if ((c === 'toggle' || c === 'play') && !snap.anyPlaying && (!window.currentPlayingTrack) && Array.isArray(window.allTracks) && window.allTracks.length > 0) {
            if (typeof window.playTrack === 'function') {
                window.playTrack(window.allTracks[0]);
                setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 120);
                return;
            }
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
