/* ============================================================================
 * ui_video_decks.js — Видео, поздняя часть (V211+): Дека Б, две деки, панели кнопок
 *
 * Склейка:  /bundle_2_player.js, модуль 15 из 18. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   openJennyVideoPlayerV130, closeVideoPlayerV130, isDeckBVideoControlActiveV210, getEffectiveVideoDurationV167, resolveReadyLocalVideoInfoV212, syncInternalVideoSliderUIV212, updateProgressUIDeckB, seekDeckBAndPlayerSyncedV212, seekVideoToExactSecondV167, seekDeckBVideoToSecV210 … (всего функций: 116)
 * Откуда:   ui_v71.js (коммит 9ae6639), строки 17809…39277 (65 фрагментов, вперемешку с другими темами). Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */


/* [split] V211: кусок исходного IIFE (ui_v71.js, строки 16526–17925) → ui_video_decks.js */
;(function() {
    if (window._jennyV211Installed__video_decks) return;
    window._jennyV211Installed__video_decks = true;
    window._jennyV211Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    function ensureDualProgressBarsDOMV211() {
        var rowA = document.getElementById('deckAProgressRow');
        if (!rowA) {
            var leftA = document.getElementById('leftTimeBlock');
            if (leftA && leftA.parentElement) {
                rowA = leftA.parentElement;
                rowA.id = 'deckAProgressRow';
            }
        }
        if (!rowA) return false;

        var rowB = document.getElementById('deckBProgressRow');
        if (!rowB) {
            rowB = document.createElement('div');
            rowB.id = 'deckBProgressRow';
            rowB.style.cssText = 'display:none;gap:4px;height:48px;margin-bottom:6px;width:100%;';
            rowB.innerHTML =
                '<div id="leftTimeBlockDeckB" style="width:15%;min-width:54px;background:#000;border:1px solid var(--border-uniform);border-radius:50px 6px 6px 50px;display:flex;justify-content:center;align-items:center;cursor:pointer;touch-action:none;">' +
                    '<span id="currentTimeDeckB" class="time-display" style="color:#58a6ff;font-size:12.5px;">0:00</span>' +
                '</div>' +
                '<div id="seekZoneDeckB" style="flex-grow:1;background:#000;border:1px solid var(--border-uniform);border-radius:6px;display:flex;flex-direction:column;justify-content:center;position:relative;overflow:hidden;cursor:pointer;touch-action:none;">' +
                    '<div id="progressFillDeckB" style="position:absolute;left:0;top:0;height:100%;width:0%;background:rgba(115,65,190,0.45);pointer-events:none;transition:width 0.1s linear;"></div>' +
                    '<div style="position:relative;z-index:2;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 12px;">' +
                        '<span id="durationTimeDeckB" class="time-display" style="color:#8b949e;margin-bottom:1px;">0:00</span>' +
                        '<div class="track-title" id="nowPlayingDeckB" style="font-weight:normal;color:#e6edf3;width:100%;font-size:12.5px;">🎬 Дека Б: Выбери видео</div>' +
                        '<div id="speedLockIndicatorDeckB" style="display:none;color:#e3b341;font-size:10.5px;font-weight:bold;margin-top:1px;">🔒 ⏩ x2.0</div>' +
                    '</div>' +
                '</div>' +
                '<div id="rightTimeBlockDeckB" style="width:15%;min-width:54px;background:#000;border:1px solid var(--border-uniform);border-radius:6px 50px 50px 6px;display:flex;justify-content:center;align-items:center;cursor:pointer;touch-action:none;">' +
                    '<span id="remainingTimeDeckB" class="time-display" style="color:#e3b341;font-size:12.5px;">-0:00</span>' +
                '</div>';
            rowA.parentElement.insertBefore(rowB, rowA);
        }
        return true;
    }

    var _origOpenVidV211 = window.openJennyVideoPlayerV130;
    if (typeof _origOpenVidV211 === 'function') {
        window.openJennyVideoPlayerV130 = function(streamUrl, titleStr, opts) {
            window._jennyDualDeckV211.deckB = true;
            window._dualDeckModeV131 = true;
            if (window.videoDeckV131) window.videoDeckV131.dualMode = true;
            window.saveDualDeckStateV211();
            window.syncDualDeckVisibilityAndAudioV211();
            window.renderDeckSwitchBannersV131();
            var r = _origOpenVidV211.apply(this, arguments);
            // Запускаем построение 2 буферов звука видео (Вперёд + Назад) в RAM
            var effUrl = (window._vidStateV130 && window._vidStateV130.currentUrl) || streamUrl;
            window.decodeVideoToRamV131(effUrl, titleStr);
            return r;
        };
    }

    var _origCloseVidV211 = window.closeVideoPlayerV130;
    if (typeof _origCloseVidV211 === 'function') {
        window.closeVideoPlayerV130 = function(ev) {
            var r = _origCloseVidV211.apply(this, arguments);
            window._jennyDualDeckV211.deckB = false;
            window.saveDualDeckStateV211();
            window.syncDualDeckVisibilityAndAudioV211();
            window.renderDeckSwitchBannersV131();
            return r;
        };
    }

    // Отключаем перехват нижней шкалы Деки А со стороны старых V170/V210:
    // Нижняя шкала (#deckAProgressRow) ВСЕГДА показывает только Музыку (Дека А),
    // а Верхняя шкала (#deckBProgressRow) ВСЕГДА показывает только Видео (Дека Б)!
    window.isDeckBVideoControlActiveV210 = function() {
        return false; // запрещаем V210 перехватывать кнопки и прогресс-бар Деки А
    };

    // РАЗНЕСЁННЫЕ ПО ФАЗЕ И ИЗОЛИРОВАННЫЕ ТАЙМЕРЫ ДЕКИ А (83 мс) И ДЕКИ Б (97 мс, сдвиг +41 мс)
    // 1) Контур Аудиодеки А — никогда не вызывает функции Деки Б и защищён собственным автоматом runIsolatedDeckA
    window._deckAIsolatedTimer = setInterval(function() {
        var tickA = function() {
            if (!document.getElementById('deckAProgressRow')) {
                ensureDualProgressBarsDOMV211();
                window.syncDualDeckVisibilityAndAudioV211();
            }
            var aEl = document.getElementById('audioPlayer');
            if (!aEl || !window.currentPlayingTrack) return;
            var npA = document.getElementById('nowPlaying');
            var hasFwdA = Boolean(window.studioBuffer);
            var hasRevA = Boolean(window.reversedStudioBuffer);
            var prefixA = (window.appConfig && window.appConfig.studioMode)
                ? 'RAM 🚀: '
                : '🎵 ';
            var wantTitleA = prefixA + window.currentPlayingTrack;
            if (npA && npA.innerText !== wantTitleA && npA.innerText.indexOf('⏳') === -1) {
                npA.innerText = wantTitleA;
            }
            var pFillA = document.getElementById('progressFill');
            if (pFillA && pFillA.style.transform && pFillA.style.transform !== 'none') {
                pFillA.style.transform = 'none';
            }
            var effDurA = (window.studioBuffer && window.studioBuffer.duration > 0)
                ? window.studioBuffer.duration
                : ((isFinite(aEl.duration) && aEl.duration > 0) ? aEl.duration : 0);
            if (effDurA > 0 && typeof window.updateProgressUI === 'function') {
                var isRevA = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
                var curTimeA = (typeof window.getTruePlaybackTimeV74_2 === 'function')
                    ? window.getTruePlaybackTimeV74_2()
                    : (aEl.currentTime || 0);
                window.updateProgressUI(curTimeA, effDurA, isRevA);
                if (typeof window.updateCenterCurrentTime === 'function') {
                    window.updateCenterCurrentTime(curTimeA, effDurA, isRevA);
                }
                if (window.isStudioPlaying && !window._userPausedV75_2 && effDurA > 2.0 && curTimeA >= effDurA - 0.08 && aEl.paused) {
                    var nowAdv = performance.now();
                    if (nowAdv - (window._lastAutoAdvanceWallV360 || 0) > 1500) {
                        window._lastAutoAdvanceWallV360 = nowAdv;
                        if (typeof window.playNextTrack === 'function') window.playNextTrack();
                    }
                }
            }
        };
        if (window.runIsolatedDeckA) window.runIsolatedDeckA(tickA);
        else tickA();
    }, 83);

    // 2) Контур Видеодеки Б — стартует со сдвигом фазы +41 мс, шаг 97 мс (некратный 83 мс), спит при закрытом видео
    setTimeout(function() {
        window._deckBIsolatedTimer = setInterval(function() {
            var tickB = function() {
                if (!document.getElementById('deckBProgressRow')) {
                    ensureDualProgressBarsDOMV211();
                    window.setupTimeBlockControlsDeckB();
                    window.setupSeekZoneDeckB();
                    window.syncDualDeckVisibilityAndAudioV211();
                }
                var stVid = window._vidStateV130;
                if (!stVid || !stVid.active) return;
                var vEl = document.getElementById('jennyVideoElV130');
                if (!vEl) return;
                var curV = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vEl) : (vEl.currentTime || 0);
                var durV = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(vEl) : (vEl.duration || 0);
                var isRevV = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
                window.updateProgressUIDeckB(curV, durV, isRevV);
            };
            if (window.runIsolatedDeckB) window.runIsolatedDeckB(tickB);
            else tickB();
        }, 97);
    }, 41);

    setTimeout(function() {
        ensureDualProgressBarsDOMV211();
        window.setupTimeBlockControlsDeckB();
        window.setupSeekZoneDeckB();
        window.syncDualDeckVisibilityAndAudioV211();
        window.renderDeckSwitchBannersV131();
    }, 200);
})();

/* [split] V212: кусок исходного IIFE (ui_v71.js, строки 17929–18897) → ui_video_decks.js */
;(function() {
    if (window._jennyV212Installed__video_decks) return;
    window._jennyV212Installed__video_decks = true;
    window._jennyV212Installed = true;
    window._v130LastDragCommitTsV212 = 0;

    // 1. Точная длительность видео для всех шкал (включая #v130DurTime внутри видеоплеера!),
    //    чтобы никогда не показывалось фальшивое 0:10!
    window.getEffectiveVideoDurationV167 = function(vid) {
        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        var probeDur = (window._vcoreLastProbeV166 && window._vcoreLastProbeV166.duration_sec) || window._jennyFullMovieDurationSecV210 || 0;
        if (st.trueDuration && st.trueDuration > 12.5) return st.trueDuration;
        if (vd.studioBuffer && vd.studioBuffer._trueDurationV72 > 12.5) return vd.studioBuffer._trueDurationV72;
        if (probeDur > 12.5) return probeDur;
        if (vid && isFinite(vid.duration) && vid.duration > 12.5) {
            return vid.duration + (st.remuxBaseOffset || 0);
        }
        if (st.trueDuration && st.trueDuration > 0) return st.trueDuration;
        if (probeDur > 0) return probeDur;
        if (vid && isFinite(vid.duration) && vid.duration > 0) {
            return vid.duration + (st.remuxBaseOffset || 0);
        }
        return 0;
    };
    window.getEffectiveVideoDurationV210 = window.getEffectiveVideoDurationV167;

    // 2. Проверка: является ли видеофайл уже полностью скачанным (готовым) локальным файлом?
    window.resolveReadyLocalVideoInfoV212 = function(streamUrl, titleStr, opts) {
        opts = opts || {};
        var urlStr = String(streamUrl || '').trim();
        var hash = String(opts.torHash || '').toLowerCase();
        var fIdx = (opts.torFileIdx !== undefined && opts.torFileIdx !== null) ? Number(opts.torFileIdx) : -1;

        if ((!hash || fIdx < 0) && urlStr.indexOf('/api/torrent/stream/') === 0) {
            var parts = urlStr.split('?')[0].replace(/^\/+/, '').split('/');
            if (parts.length >= 5) {
                hash = parts[3].toLowerCase();
                fIdx = Number(parts[4]);
            }
        }

        var fileName = String(titleStr || '').split('/').pop().split('?')[0].trim();
        if (!fileName && urlStr.indexOf('/api/media/') === 0) {
            try { fileName = decodeURIComponent(urlStr.slice('/api/media/'.length).split('?')[0]); } catch (e) {}
        }

        if (hash && fIdx >= 0) {
            var dTor = (window._torLiveDaemonSnapV128 || []).find(function(t) { return String(t.hash || '').toLowerCase() === hash; });
            var dFile = dTor && (dTor.files || []).find(function(f) { return Number(f.index) === fIdx; });
            var job = window._torMapV112 && window._torMapV112[hash];
            var jSt = job && job.fileStatusMap && job.fileStatusMap[fIdx];
            var maxKey = hash + '_' + fIdx;
            var maxRec = window._torMaxProgressMapV212[maxKey];

            var readyName = (jSt && jSt.xflac_file) || (dFile && dFile.xflac_file) || (maxRec && maxRec.xflac_file) || '';
            var isDone = Boolean(
                readyName ||
                (dFile && (dFile.done || Number(dFile.percent) >= 100 || (dFile.length > 0 && dFile.completed >= dFile.length))) ||
                (jSt && (jSt.done || Number(jSt.percent) >= 100 || (jSt.length > 0 && jSt.completed >= jSt.length))) ||
                (maxRec && maxRec.done)
            );
            if (!fileName && dFile && dFile.path) {
                fileName = String(dFile.path).split('/').pop();
            }
            if (isDone && (readyName || fileName)) {
                var finalFn = readyName || fileName;
                return {
                    isReadyLocal: true,
                    url: '/api/media/' + encodeURIComponent(finalFn),
                    fileName: finalFn
                };
            }
        }

        if (fileName && window._dedicatedVideoMetaMapV137 && window._dedicatedVideoMetaMapV137[fileName]) {
            var meta = window._dedicatedVideoMetaMapV137[fileName];
            if (meta.is_ready_local || meta.in_video_dir || Number(meta.percent) >= 100 || !meta.tor_hash) {
                return {
                    isReadyLocal: true,
                    url: '/api/media/' + encodeURIComponent(fileName),
                    fileName: fileName
                };
            }
        }

        if (urlStr.indexOf('/api/media/') === 0) {
            return {
                isReadyLocal: true,
                url: urlStr,
                fileName: fileName
            };
        }

        return {
            isReadyLocal: false,
            url: urlStr,
            fileName: fileName
        };
    };

    // 3. ЕДИНАЯ СИНХРОННАЯ ПЕРЕМОТКА ВНУТРИ ВИДЕОПЛЕЕРА (#v130SeekSlider) И НА ШКАЛЕ ДЕКИ Б (#deckBProgressRow)
    //    Исправляет баг с масштабом max=durT против 1000 (из-за которого прыгало на 31:39 / 23:04 и 8:30)
    //    и мгновенно перематывает при касании/ведении пальцем синхронно с Декой Б!
    window.syncInternalVideoSliderUIV212 = function(curSec, durSec) {
        if (window._v130UserDraggingSeekV212) return;
        if (performance.now() - (window._v130LastDragCommitTsV212 || 0) < 280) return;

        var seek = document.getElementById('v130SeekSlider');
        var cEl = document.getElementById('v130CurTime');
        var dEl = document.getElementById('v130DurTime');
        var fmt = window.formatVideoTimeV210 || window.fmtKhSecV90 || function(s) {
            s = Math.max(0, Math.floor(s || 0));
            var m = Math.floor(s / 60), sc = s % 60;
            return m + ':' + (sc < 10 ? '0' + sc : sc);
        };

        if (cEl && isFinite(curSec)) cEl.innerText = fmt(curSec);
        if (dEl) dEl.innerText = (isFinite(durSec) && durSec > 0) ? fmt(durSec) : 'Поток';
        if (seek) {
            if (seek.max !== '1000') seek.max = '1000';
            if (seek.min !== '0') seek.min = '0';
            if (isFinite(durSec) && durSec > 0 && isFinite(curSec)) {
                seek.value = String(Math.max(0, Math.min(1000, Math.round((curSec / durSec) * 1000))));
            }
        }
    };

    // Оборачиваем updateProgressUIDeckB, чтобы ползунок внутри видеоплеера и верхняя шкала Деки Б были 100% синхронны
    var _origUpdateProgressUIDeckBV211 = window.updateProgressUIDeckB;
    if (typeof _origUpdateProgressUIDeckBV211 === 'function') {
        window.updateProgressUIDeckB = function(currentTime, duration, isReverseVisual) {
            _origUpdateProgressUIDeckBV211.call(this, currentTime, duration, isReverseVisual);
            window.syncInternalVideoSliderUIV212(currentTime, duration);
        };
    }

    window.seekDeckBAndPlayerSyncedV212 = function(targetSec, isLiveDrag) {
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        if (!vid || !st || !st.active) return;

        var dur = window.getEffectiveVideoDurationV167(vid);
        var cleanSec = (isFinite(dur) && dur > 0)
            ? Math.max(0, Math.min(Math.max(0, dur - 0.35), targetSec))
            : Math.max(0, targetSec);

        st._pendingSeekSecV167 = cleanSec;
        st._pendingSeekTsV167 = performance.now();

        var fmt = window.formatVideoTimeV210 || window.fmtKhSecV90 || function(s) {
            s = Math.max(0, Math.floor(s || 0));
            var m = Math.floor(s / 60), sc = s % 60;
            return m + ':' + (sc < 10 ? '0' + sc : sc);
        };

        var cEl = document.getElementById('v130CurTime');
        var dEl = document.getElementById('v130DurTime');
        var seek = document.getElementById('v130SeekSlider');
        if (cEl) cEl.innerText = fmt(cleanSec);
        if (dEl && dur > 0) dEl.innerText = fmt(dur);
        if (seek && dur > 0) {
            seek.max = '1000';
            seek.value = String(Math.max(0, Math.min(1000, Math.round((cleanSec / dur) * 1000))));
        }

        var isRev = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed) || (vd && vd.isReversed));
        if (typeof _origUpdateProgressUIDeckBV211 === 'function') {
            _origUpdateProgressUIDeckBV211(cleanSec, dur, isRev);
        }

        var now = performance.now();
        if (isLiveDrag) {
            if (now - (window._v130LastLiveVideoSeekTsV212 || 0) < 85) return;
            window._v130LastLiveVideoSeekTsV212 = now;
        }

        var isAviFile = /\.avi(\?|$)/i.test(String(st.currentTitle || '') + ' ' + String(st.currentUrl || ''));
        var isMkvOrAviTor = Boolean(st.torHash && !st.isReadyLocalV212 && /\.(mkv|avi|webm|ts|m2ts|wmv|flv)(\?|$)/i.test(String(st.currentTitle || '') + ' ' + String(st.currentUrl || '')));
        var needsRemuxSeek = Boolean(st.usingRemux || isAviFile || isMkvOrAviTor);

        if (isLiveDrag) {
            // Пока палец ведёт ползунок: на ремуксе/AVI/торренте обновляем только позицию и цифры, не сбрасывая поток!
            if (needsRemuxSeek) {
                st.remuxBaseOffset = cleanSec;
            } else {
                try { vid.currentTime = cleanSec; } catch (e) {}
            }
            return;
        }

        if (st.torHash && dur > 0) {
            var seekRatio = Math.max(0, Math.min(0.995, cleanSec / dur));
            fetch('/api/torrent/seek_boost', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hash: st.torHash, file_index: Number(st.torFileIdx || 0), ratio: seekRatio })
            }).catch(function(){});
        }

        if (needsRemuxSeek) {
            st.usingRemux = true;
            st.remuxBaseOffset = cleanSec;
            window._vidPlayIntentV132 = true;
            window._vidIsBufferingV132 = true;
            if (typeof window.syncVideoPlayBtnIconV132 === 'function') window.syncVideoPlayBtnIconV132();
            var tcFlag = isAviFile ? '1' : '0';
            var rawBaseUrl = st.rawTorStreamUrlV214 || st.currentUrl;
            vid.src = '/api/video/live_remux?src=' + encodeURIComponent(rawBaseUrl) + '&start=' + cleanSec.toFixed(2) + '&dur=' + (dur || 0).toFixed(2) + '&transcode=' + tcFlag + '&t=' + Date.now();
            if (!st.userPaused) vid.play().catch(function(){});
        } else {
            st.remuxBaseOffset = 0;
            try { vid.currentTime = cleanSec; } catch (e) {}
            if (!st.userPaused && (vid.paused || vid.ended) && !isRev) {
                vid.play().catch(function(){});
            }
        }

        if (!isLiveDrag) {
            window.syncVideoRamEngineV211(false);
            if (typeof window.saveCurrentVideoProgressV135 === 'function') {
                window.saveCurrentVideoProgressV135();
            }
        }
    };

    // Перенаправляем seekVideoToExactSecondV167 и seekDeckBVideoToSecV210 на единую синхронную функцию
    window.seekVideoToExactSecondV167 = function(targetSec) {
        window.seekDeckBAndPlayerSyncedV212(targetSec, false);
    };
    window.seekDeckBVideoToSecV210 = function(targetSec) {
        window.seekDeckBAndPlayerSyncedV212(targetSec, false);
    };

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

    // 4. ФИКС «ИГРАЕТ ТОЛЬКО ЗВУК, А ВИДЕО ВИСИТ НА ⏳» И РАЗГРУЗКА ТОРРЕНТ-ПОТОКА:
    //    - Для недокачанных торрент-потоков НЕ запускаем 6 параллельных FFmpeg-воркеров decodeVideoToRamV131,
    //      чтобы не отбирать поток у <video> (видео играет свой родной звук через тракт Деки Б мгновенно!).
    //    - Для готовых локальных видео запускаем распаковку в RAM в 2 аккуратных потока только после старта картинки!
    //    - В syncVideoRamEngineV211 НИКОГДА не включаем vd.sourceNode, пока <video> стоит на буферизации (⏳) или паузе!
    var _origDecodeVideoToRamV211 = window.decodeVideoToRamV131;
    window.decodeVideoToRamV131 = async function(streamUrl, titleStr) {
        var st = window._vidStateV130 || {};
        var urlStr = String(streamUrl || st.currentUrl || '');
        if ((st.torHash && !st.isReadyLocalV212) || urlStr.indexOf('/api/torrent/stream/') === 0) {
            var check = window.resolveReadyLocalVideoInfoV212(urlStr, titleStr || st.currentTitle, {
                torHash: st.torHash,
                torFileIdx: st.torFileIdx
            });
            if (!check.isReadyLocal) {
                // Для активного P2P-потока оставляем родной звук <video> и 100% канала отдаём видеокадрам!
                return null;
            }
            streamUrl = check.url;
        }
        var vid = document.getElementById('jennyVideoElV130');
        if (vid && vid.readyState < 3) {
            await new Promise(function(resolve) {
                var done = false;
                var finish = function() {
                    if (done) return;
                    done = true;
                    vid.removeEventListener('playing', finish);
                    vid.removeEventListener('canplay', finish);
                    resolve();
                };
                vid.addEventListener('playing', finish, { once: true });
                vid.addEventListener('canplay', finish, { once: true });
                setTimeout(finish, 2500);
            });
        }
        if (typeof _origDecodeVideoToRamV211 === 'function') {
            return await _origDecodeVideoToRamV211.call(this, streamUrl, titleStr);
        }
        return null;
    };

    var _baseSyncVideoRamEngineV211 = window.syncVideoRamEngineV211;
    window.syncVideoRamEngineV211 = window.syncVideoRamEngineV131 = function(isDragging) {
        var vd = window.videoDeckV131, st = window._vidStateV130, vid = document.getElementById('jennyVideoElV130');
        if (!vid || !vd || !vd.ctx || !st || !st.active) return;

        var isRev = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed) || vd.isReversed);
        var isVidActuallyPlayingFrames = Boolean(!vid.paused && !vid.ended && vid.readyState >= 2 && !window._vidIsBufferingV132);

        // Если видео сейчас буферизуется (⏳) или стоит на паузе (и не в реверсе) —
        // немедленно глушим RAM-источник, чтобы звук НИКОГДА не шёл отдельно от застывшей картинки!
        if (!isRev && !isVidActuallyPlayingFrames) {
            if (vd.horizonTimer) { clearTimeout(vd.horizonTimer); vd.horizonTimer = null; }
            if (vd.revFrameTimer) { clearInterval(vd.revFrameTimer); vd.revFrameTimer = null; }
            if (vd.sourceNode) {
                vd.sourceNode.onended = null;
                try { vd.sourceNode.stop(); } catch (e) {}
                try { vd.sourceNode.disconnect(); } catch (e) {}
                vd.sourceNode = null;
            }
            vd.isStudioPlaying = false;
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = st.dspBypass ? 0.0 : 1.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = st.dspBypass ? 1.0 : 0.0;
            return;
        }

        if (typeof _baseSyncVideoRamEngineV211 === 'function') {
            return _baseSyncVideoRamEngineV211.call(this, isDragging);
        }
    };

    // Запрещаем ложное переключение .mkv/.mp4 на транскодер AVI (libx264) при прерывании play()
    window.switchVideoToFfmpegRemuxV130 = function(ev, forceTranscodeVideo) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._vidStateV130;
        var vid = document.getElementById('jennyVideoElV130');
        if (!vid || !st || !st.currentUrl) return;

        // Если это автоматический вызов (ev === null) на .mkv/.mp4, проверяем: есть ли реальная ошибка декодера
        var isAvi = /\.avi$/i.test(st.currentTitle || '');
        if (!ev && !isAvi) {
            if (!vid.error) return;
        }

        var curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
        st.usingRemux = true;
        st.remuxBaseOffset = curSec;
        window._vidPlayIntentV132 = true;
        window._vidIsBufferingV132 = true;
        if (typeof window.syncVideoPlayBtnIconV132 === 'function') window.syncVideoPlayBtnIconV132();

        var tcFlag = isAvi ? '1' : '0';
        vid.src = '/api/video/live_remux?src=' + encodeURIComponent(st.currentUrl) + '&start=' + curSec.toFixed(1) + '&transcode=' + tcFlag + '&t=' + Date.now();
        vid.play().catch(function(){});
        if (typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130(tcFlag === '1' ? '🛠️ Потоковый декодер FFmpeg (AVI ➔ MP4)' : '🛠️ Потоковый ремукс FFmpeg (MKV ➔ MP4)');
        }
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    // 5. Перехватываем openJennyVideoPlayerV130:
    //    - Для готовых (100% скачанных) видео ОТКЛЮЧАЕМ буферизацию торрента, убираем torHash и запускаем напрямую!
    //    - Для недокачанных торрент-потоков убираем прыжок resumeSec в нескачанную середину файла (всегда стартуем с 0:00)!
    var _origOpenVidV212 = window.openJennyVideoPlayerV130;
    if (typeof _origOpenVidV212 === 'function') {
        window.openJennyVideoPlayerV130 = function(streamUrl, titleStr, opts) {
            opts = Object.assign({}, opts || {});
            window._v130UserDraggingSeekV212 = false;
            var rawInputUrl = String(streamUrl || '');
            var check = window.resolveReadyLocalVideoInfoV212(streamUrl, titleStr, opts);
            if (check.isReadyLocal) {
                streamUrl = check.url;
                opts.torHash = '';
                opts.torFileIdx = -1;
            } else {
                try {
                    var rMap = window.loadVideoResumeMapV135 ? window.loadVideoResumeMapV135() : {};
                    var rKey = window.getVideoResumeKeyV135 ? window.getVideoResumeKeyV135(titleStr, streamUrl) : '';
                    if (rKey && rMap[rKey]) {
                        delete rMap[rKey];
                        localStorage.setItem('ytm_video_resume_map_v135', JSON.stringify(rMap));
                    }
                } catch (e) {}
            }

            // V215: Сбрасываем старую длительность (21:22) и позицию (4:14 / 6:32) от прошлого видео ПЕРЕД открытием нового!
            if (window._vidStateV130) {
                window._vidStateV130.trueDuration = 0;
                window._vidStateV130.knownDurationSec = 0;
                window._vidStateV130.remuxBaseOffset = 0;
                window._vidStateV130._pendingSeekSecV167 = undefined;
                window._vidStateV130.rawTorStreamUrlV214 = rawInputUrl;
            }
            window._jennyFullMovieDurationSecV210 = 0;
            if (window._vcoreLastProbeV166) window._vcoreLastProbeV166.duration_sec = 0;

            var cElInit = document.getElementById('v130CurTime');
            var dElInit = document.getElementById('v130DurTime');
            var sElInit = document.getElementById('v130SeekSlider');
            if (cElInit) cElInit.innerText = '0:00';
            if (dElInit) dElInit.innerText = 'Поток';
            if (sElInit) sElInit.value = '0';

            var r = _origOpenVidV212.call(this, streamUrl, titleStr, opts);
            var st = window._vidStateV130;
            var vid = document.getElementById('jennyVideoElV130');

            if (check.isReadyLocal) {
                if (st) {
                    st.torHash = '';
                    st.torFileIdx = -1;
                    st.currentUrl = check.url;
                    st.rawTorStreamUrlV214 = check.url;
                    st.isReadyLocalV212 = true;
                    st.isTorrentStream = false;
                }
                window._vidIsBufferingV132 = false;
                if (typeof window.syncVideoPlayBtnIconV132 === 'function') {
                    window.syncVideoPlayBtnIconV132();
                }
                var subEl = document.getElementById('v130VideoSubTelemetry');
                if (subEl) subEl.innerText = '';
                var btnHub = document.getElementById('v130BtnTorHub');
                var btnSave = document.getElementById('v130BtnSaveVideo');
                if (btnHub) btnHub.style.display = 'none';
                if (btnSave) btnSave.style.display = 'none';
                if (typeof window.probeTorrentVideoDurationV214 === 'function') {
                    setTimeout(function() { window.probeTorrentVideoDurationV214(check.url); }, 150);
                }
            } else {
                if (st) {
                    st.isReadyLocalV212 = false;
                    st.isTorrentStream = Boolean(st.torHash);
                    st.rawTorStreamUrlV214 = rawInputUrl;
                    st.remuxBaseOffset = 0;
                    st._pendingSeekSecV167 = undefined;
                    if (typeof window.probeTorrentVideoDurationV214 === 'function') {
                        setTimeout(function() { window.probeTorrentVideoDurationV214(rawInputUrl); }, 800);
                        setTimeout(function() { window.probeTorrentVideoDurationV214(rawInputUrl); }, 2200);
                        setTimeout(function() { window.probeTorrentVideoDurationV214(rawInputUrl); }, 4800);
                    }
                }
                if (vid) {
                    vid._pendingResumeSecV135 = 0;
                }
            }

            bindUnifiedVideoPlayerSeekSliderV212();
            bindLocalVideoNoBufferGuardV212();
            return r;
        };
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
    setTimeout(function() {
        bindLocalVideoNoBufferGuardV212();
        bindUnifiedVideoPlayerSeekSliderV212();
    }, 300);
})();

/* [split] V215: кусок исходного IIFE (ui_v71.js, строки 18904–19635) → ui_video_decks.js */
;(function() {
    if (window._jennyV215Installed__video_decks) return;
    window._jennyV215Installed__video_decks = true;
    window._jennyV215Installed = true;

    // -------------------------------------------------------------------------
    // 2. УБИРАЕМ НАДПИСЬ "📁 ОТКРЫТИЕ ВИДЕОФАЙЛА..." / "🧲 БУФЕРИЗАЦИЯ..." КАК ТОЛЬКО КАДР ГОТОВ
    // -------------------------------------------------------------------------
    function hookClearVideoSubTelemetryV215() {
        var vid = document.getElementById('jennyVideoElV130');
        if (!vid || vid._v215SubClearHooked) return;
        vid._v215SubClearHooked = true;
        var clearOpeningText = function() {
            var subEl = document.getElementById('v130VideoSubTelemetry');
            if (!subEl) return;
            var txt = subEl.innerText || '';
            if (txt.indexOf('Открытие видеофайла') !== -1 || txt.indexOf('Буферизация видеопотока') !== -1 || txt.indexOf('Локальный файл готов') !== -1) {
                subEl.innerText = '';
            }
        };
        vid.addEventListener('loadeddata', clearOpeningText);
        vid.addEventListener('canplay', clearOpeningText);
        vid.addEventListener('playing', clearOpeningText);
    }
    setInterval(function() {
        hookClearVideoSubTelemetryV215();
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        var subEl = document.getElementById('v130VideoSubTelemetry');
        if (vid && st && st.active && subEl && vid.readyState >= 2 && !window._vidIsBufferingV132) {
            var txt = subEl.innerText || '';
            if (txt.indexOf('Открытие видеофайла') !== -1 || txt.indexOf('Буферизация видеопотока') !== -1 || txt.indexOf('Локальный файл готов') !== -1) {
                subEl.innerText = '';
            }
        }
    }, 300);

    // -------------------------------------------------------------------------
    // 3. УБИРАЕМ 5-СЕКУНДНОЕ ПРОПАДАНИЕ ЗВУКА НА ВИДЕО (Video #4, 03:52-04:13)
    //    И РАЗГРУЖАЕМ CPU ДЛЯ ПЛАВНОГО ВОСПРОИЗВЕДЕНИЯ И ПЕРЕМОТКИ .AVI (Video #1, 01:08-01:35)
    // -------------------------------------------------------------------------
    // При обычном воспроизведении вперёд (1.0x без реверса) <video> уже подключён через vd.htmlGain -> vd.inputMixer
    // ко всему DSP-тракту Деки Б (эквалайзер, кроссовер, мастеринг, FIR) со 100% синхронизацией губ и без пауз!
    // Переключать звук на RAM-буфер (vd.sourceNode) нужно ТОЛЬКО при включённом реверсе (⏪ REV) или скраббинге!
    window.syncVideoRamEngineV211 = window.syncVideoRamEngineV131 = function(isDragging) {
        var vd = window.videoDeckV131, st = window._vidStateV130, vid = document.getElementById('jennyVideoElV130');
        if (!vid || !vd || !vd.ctx || !st || !st.active) return;

        if (vd.horizonTimer) { clearTimeout(vd.horizonTimer); vd.horizonTimer = null; }
        if (vd.revFrameTimer) { clearInterval(vd.revFrameTimer); vd.revFrameTimer = null; }

        var gKey = (vd.config && vd.config.gearKeyV66) || 'jbuf-lock';
        var isRev = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed) || vd.isReversed);
        vd.isReversed = isRev;
        var targetSpd = Math.max(0.1, Math.min(16.0, window.getTargetPlaybackSpeedDeckB ? window.getTargetPlaybackSpeedDeckB() : (vd.speed || 1.0)));
        vd.speed = targetSpd;

        var curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
        var pSec = (vd.studioBuffer && vd.studioBuffer._pieceSecV72) || 45;
        var curP = (vd.studioBuffer && vd.studioBuffer._pieceMapV72 && vd.studioBuffer._pieceMapV72.length > 0)
            ? Math.max(0, Math.min(vd.studioBuffer._pieceMapV72.length - 1, Math.floor((isRev ? Math.max(0, curSec - 1.0) : curSec) / pSec)))
            : -1;
        var isPieceReady = Boolean(vd.studioBuffer && vd.studioBuffer._pieceMapV72 && curP >= 0 && vd.studioBuffer._pieceMapV72[curP] === 2);

        // При обычном проигрывании вперёд (!isRev) всегда используем прямой поток <video> через DSP Деки Б:
        // это гарантирует мгновенный звук без 5-секундной немой паузы и идеальный липсинк!
        var useRamEngine = isRev && isPieceReady;

        if (!useRamEngine) {
            if (vd.sourceNode) {
                vd.sourceNode.onended = null;
                try { vd.sourceNode.stop(); } catch (e) {}
                try { vd.sourceNode.disconnect(); } catch (e) {}
                vd.sourceNode = null;
            }
            vd.isStudioPlaying = false;
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = st.dspBypass ? 0.0 : 1.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = st.dspBypass ? 1.0 : 0.0;
            var lockPitch = (gKey !== 'web-shift' && gKey !== 'jbuf-shift' && gKey !== 'vinyl-shift');
            vid.preservesPitch = lockPitch; vid.mozPreservesPitch = lockPitch; vid.webkitPreservesPitch = lockPitch;
            if (!isRev && Math.abs(vid.playbackRate - targetSpd) > 0.005) {
                try { vid.playbackRate = targetSpd; } catch (e) {}
            }
            return;
        }

        // Режим РЕВЕРСА (⏪ REV): играем из обратного RAM-буфера Деки Б!
        if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = 0.0;
        if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = 0.0;

        var WIN_SEC = Math.max(18.0, Math.min(60.0, targetSpd * 18.0));
        var rawWinBuf = window.extractVideoWindowBufferV131 ? window.extractVideoWindowBufferV131(vd.studioBuffer, curSec, WIN_SEC, true) : null;
        if (!rawWinBuf) return;

        var playBuf = rawWinBuf, nodeRate = targetSpd;
        if (vd.sourceNode) {
            vd.sourceNode.onended = null;
            try { vd.sourceNode.stop(); } catch (e) {}
            try { vd.sourceNode.disconnect(); } catch (e) {}
            vd.sourceNode = null;
        }

        if (!st.userPaused) {
            vd.sourceNode = vd.ctx.createBufferSource();
            vd.sourceNode.buffer = playBuf;
            vd.sourceNode.playbackRate.value = nodeRate;
            vd.sourceNode.connect(st.dspBypass ? vd.directBypassGain : vd.inputMixer);
            if (st.dspBypass && vd.directBypassGain) vd.directBypassGain.gain.value = 1.0;
            vd.sourceNode.start(0, 0);
            vd.isStudioPlaying = true;

            var startRevMediaSec = curSec;
            var startRevWallMs = performance.now();
            vd.revFrameTimer = setInterval(function() {
                if (!st.active || st.userPaused || !vd.isReversed) {
                    clearInterval(vd.revFrameTimer);
                    vd.revFrameTimer = null;
                    return;
                }
                var elapsed = ((performance.now() - startRevWallMs) / 1000.0) * targetSpd;
                var nextSec = Math.max(0, startRevMediaSec - elapsed);
                if (!st.usingRemux) {
                    try { vid.currentTime = nextSec; } catch (e) {}
                }
                var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (vid.duration || 0);
                if (typeof window.updateProgressUIDeckB === 'function' && dur > 0) {
                    window.updateProgressUIDeckB(nextSec, dur, true);
                }
                if (nextSec <= 0.05) {
                    clearInterval(vd.revFrameTimer);
                    vd.revFrameTimer = null;
                }
            }, 90);
        }
    };

    // Для .avi файлов (которые транскодируются на лету через libx264) не запускаем фоновые FFmpeg-воркеры RAM,
    // чтобы 100% процессора отдавалось плавному декодированию видео без замирания кадра!
    var _origDecodeVidRamV215 = window.decodeVideoToRamV131;
    window.decodeVideoToRamV131 = async function(streamUrl, titleStr) {
        var st = window._vidStateV130 || {};
        var tStr = String(titleStr || st.currentTitle || streamUrl || '');
        if (/\.avi(\?|$)/i.test(tStr) || (st.torHash && !st.isReadyLocalV212)) {
            return null;
        }
        if (typeof _origDecodeVidRamV215 === 'function') {
            return await _origDecodeVidRamV215.call(this, streamUrl, titleStr);
        }
        return null;
    };

    // -------------------------------------------------------------------------
    // 4. БЛОК ФОРМАТОВ ФАЙЛОВ В НАСТРОЙКАХ: ПОКАЗЫВАТЬ И ДЕКУ А (АУДИО), И ДЕКУ Б (ВИДЕО)!
    //    (Video #1, 02:18-03:15)
    // -------------------------------------------------------------------------
    window.saveDualDeckFormatSlotsV215 = async function(whichDeck, triggerReload) {
        var slotsObj = window.ensureDualDeckFormatSlotsV150();
        var isVid = (whichDeck === 'video');
        var targetList = isVid ? slotsObj.videoSlots : slotsObj.audioSlots;
        var prefix = isVid ? 'cfg_fmt_vid_' : 'cfg_fmt_aud_';
        var newSlots = [];

        for (var i = 1; i <= targetList.length; i++) {
            var chk = document.getElementById(prefix + i + '_en');
            var inp = document.getElementById(prefix + i + '_val');
            var raw = inp ? inp.value.trim().toLowerCase() : (targetList[i - 1] ? targetList[i - 1].ext : '');
            if (raw && !raw.startsWith('.')) raw = '.' + raw;
            if (!raw) continue;
            var isEn = chk ? Boolean(chk.checked) : true;
            if (inp) inp.style.opacity = isEn ? '1' : '0.4';
            newSlots.push({ en: isEn, ext: raw });
        }

        var cfg = window._musicConfigRefV131 || window.appConfig || {};
        if (isVid) {
            cfg.formatSlotsVideoV150 = newSlots;
            window.KNOWN_VIDEO_EXT_SET_V150 = new Set([].concat(Array.from(window.KNOWN_VIDEO_EXT_SET_V150 || []), newSlots.map(function(s) { return s.ext; })));
        } else {
            cfg.formatSlotsAudioV150 = newSlots;
        }
        cfg.formatSlots = [].concat(cfg.formatSlotsAudioV150 || [], cfg.formatSlotsVideoV150 || []);

        if (window.appConfig) {
            window.appConfig.formatSlotsAudioV150 = cfg.formatSlotsAudioV150;
            window.appConfig.formatSlotsVideoV150 = cfg.formatSlotsVideoV150;
            window.appConfig.formatSlots = cfg.formatSlots;
        }
        try { localStorage.setItem('ytm_config', JSON.stringify(cfg)); } catch (e) {}

        try {
            await fetch('/api/config/save_single', {
                method: 'POST',
                body: JSON.stringify({ category: 'main', key: 'formatSlots', value: cfg.formatSlots })
            });
        } catch (e) {}

        if (typeof window.renderPlaylistStripChipsV71 === 'function') window.renderPlaylistStripChipsV71();
        if (typeof window.renderActivePlaylistTracksV71 === 'function') window.renderActivePlaylistTracksV71(false);
        if (triggerReload && typeof window.smartRefreshCurrentPlaylistV150 === 'function') {
            await window.smartRefreshCurrentPlaylistV150(null, true);
        }
    };

    window.resetDeckFormatSlotsV215 = async function(whichDeck, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var isVid = (whichDeck === 'video');
        var cfg = window._musicConfigRefV131 || window.appConfig || {};
        if (isVid) {
            cfg.formatSlotsVideoV150 = JSON.parse(JSON.stringify(window.DEFAULT_VIDEO_FORMAT_SLOTS_V150));
        } else {
            cfg.formatSlotsAudioV150 = JSON.parse(JSON.stringify(window.DEFAULT_AUDIO_FORMAT_SLOTS_V150));
        }
        window.syncFormatSlotsUI();
        await window.saveDualDeckFormatSlotsV215(whichDeck, true);
        if (typeof window.showToast === 'function') {
            window.showToast(isVid ? '🔄 Форматы видео (Дека Б) сброшены!' : '🔄 Форматы аудио (Дека А) сброшены!', ev);
        }
    };

    // Вызываем syncFormatSlotsUI при каждом переключении кнопок Дека А / Дека Б!
    var _origRenderDeckBannersV215 = window.renderDeckSwitchBannersV131;
    if (typeof _origRenderDeckBannersV215 === 'function' && !_origRenderDeckBannersV215._v215Wrapped) {
        window.renderDeckSwitchBannersV131 = function() {
            var r = _origRenderDeckBannersV215.apply(this, arguments);
            if (typeof window.syncFormatSlotsUI === 'function') window.syncFormatSlotsUI();
            return r;
        };
        window.renderDeckSwitchBannersV131._v215Wrapped = true;
    }
})();

/* [split] V216: кусок исходного IIFE (ui_v71.js, строки 19638–21240) → ui_video_decks.js */
;(function() {
    if (window._jennyV216Installed__video_decks) return;
    window._jennyV216Installed__video_decks = true;
    window._jennyV216Installed = true;

    // -------------------------------------------------------------------------
    // 4. СОЗДАНИЕ И СИНХРОНИЗАЦИЯ ДВУХ 9-КНОПОЧНЫХ ПАНЕЛЕЙ (ПОД ДЕКОЙ Б И ПОД ДЕКОЙ А)
    // -------------------------------------------------------------------------
    window._deckBVolumePercentV216 = parseInt(localStorage.getItem('jenny_deckb_vol_pct_v216') || '100', 10);
    if (isNaN(window._deckBVolumePercentV216)) window._deckBVolumePercentV216 = 100;

    window.applyDeckBVolumeV216 = function(pctVal) {
        var pct = Math.max(0, Math.min(150, Math.round(Number(pctVal))));
        window._deckBVolumePercentV216 = pct;
        try { localStorage.setItem('jenny_deckb_vol_pct_v216', String(pct)); } catch (e) {}

        var lbl = document.getElementById('volIconTextDeckBV216');
        if (lbl) {
            lbl.innerText = (pct > 100 ? '🔥' : '') + pct + '%';
            lbl.style.color = pct > 100 ? '#ff7b72' : '#58a6ff';
        }
        var bar = document.getElementById('volumeBarDeckBV216');
        if (bar && Number(bar.value) !== Math.round(pct / 10)) {
            bar.value = String(Math.round(pct / 10));
        }

        var gainVal = pct / 100.0;
        var vid = document.getElementById('jennyVideoElV130');
        var vd = window.videoDeckV131;
        if (vid) {
            try { vid.volume = Math.max(0, Math.min(1.0, gainVal)); } catch (e) {}
        }
        if (vd && vd.masterGain && vd.masterGain.gain) {
            vd.masterGain.gain.value = gainVal;
        } else if (vd && vd.htmlGain && vd.htmlGain.gain && !(window._vidStateV130 && window._vidStateV130.dspBypass)) {
            vd.htmlGain.gain.value = gainVal;
        }
    };

    window.toggleVolumePopupDeckBV216 = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var pop = document.getElementById('volumePopupDeckBV216');
        if (!pop) return;
        var isOpen = pop.classList.contains('show');
        var popA = document.getElementById('volumePopup');
        if (popA) popA.classList.remove('show');
        if (isOpen) pop.classList.remove('show');
        else pop.classList.add('show');
    };

    window.playAdjacentVideoDeckBV216 = function(dirStep, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var items = window.getFilteredVideoItemsV150 ? window.getFilteredVideoItemsV150() : [];
        if (!items || items.length === 0) {
            if (typeof window.showToast === 'function') window.showToast('🎬 В списке видео пока нет файлов', ev);
            return;
        }
        var st = window._vidStateV130 || {};
        var curTitle = String(st.currentTitle || '').trim();
        var idx = items.findIndex(function(x) { return x.name === curTitle; });
        var nextIdx = idx !== -1 ? ((idx + dirStep + items.length) % items.length) : 0;
        var target = items[nextIdx];
        if (!target) return;
        var wasPip = Boolean(st.pipMode || !st.active);
        var url = target.stream_url || ('/api/media/' + encodeURIComponent(target.name));
        window.openJennyVideoPlayerV130(url, target.name, {
            torHash: target.tor_hash || '',
            torFileIdx: target.tor_file_idx !== undefined ? Number(target.tor_file_idx) : -1,
            startInPipV135: wasPip
        });
    };

    window.togglePlayDeckBV216 = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._vidStateV130 || {};
        var vid = document.getElementById('jennyVideoElV130');
        if (!st.active || !vid || !st.currentUrl) {
            window.playAdjacentVideoDeckBV216(0, ev);
            return;
        }
        if (typeof window.toggleVideoPlayPauseV130 === 'function') {
            window.toggleVideoPlayPauseV130(ev);
        } else {
            if (vid.paused) vid.play().catch(function(){});
            else vid.pause();
        }
        window.syncDeckBPlayBtnIconV216();
    };

    window.syncDeckBPlayBtnIconV216 = function() {
        var btnB = document.getElementById('playPauseBtnDeckBV216');
        if (!btnB) return;
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130 || {};
        var playing = Boolean(st.active && vid && !vid.paused && !vid.ended);
        btnB.innerHTML = playing
            ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
            : '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    };

    window.exportOrSaveDeckBV216 = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._vidStateV130 || {};
        if (st.active && st.torHash && st.torFileIdx >= 0 && !st.isReadyLocalV212) {
            if (typeof window.saveCurrentVideoToLibraryV130 === 'function') {
                window.saveCurrentVideoToLibraryV130(ev);
                return;
            }
        }
        if (st.active && st.currentTitle && typeof window.exportCurrentTrack === 'function') {
            var prevTrack = window.currentPlayingTrack;
            window.currentPlayingTrack = st.currentTitle;
            try {
                window.exportCurrentTrack();
            } finally {
                if (prevTrack) window.currentPlayingTrack = prevTrack;
            }
            return;
        }
        if (typeof window.showToast === 'function') {
            window.showToast('🎬 Сначала запусти видео в Деке Б для экспорта!', ev);
        }
    };

    window.openSpectrumForDeckV216 = function(whichDeck, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var isVid = (whichDeck === 'video');
        window._activeUiDeckV131 = isVid ? 'video' : 'music';
        if (window._jennyDualDeckV211) window._jennyDualDeckV211.uiFocus = isVid ? 'video' : 'music';
        if (typeof window.renderDeckSwitchBannersV131 === 'function') window.renderDeckSwitchBannersV131();
        if (typeof window.openSpectrumModalV62 === 'function') window.openSpectrumModalV62();
    };

    window.openEqForDeckV216 = function(whichDeck, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var isVid = (whichDeck === 'video');
        window._activeUiDeckV131 = isVid ? 'video' : 'music';
        if (window._jennyDualDeckV211) window._jennyDualDeckV211.uiFocus = isVid ? 'video' : 'music';
        if (typeof window.switchActiveUiDeckV131 === 'function') {
            try { window.switchActiveUiDeckV131(isVid ? 'video' : 'music'); } catch (e) {}
        }
        if (typeof window.toggleModal === 'function') window.toggleModal('eqModal');
    };

    window.openFavForDeckV216 = function(whichDeck, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var isVid = (whichDeck === 'video');
        window._favSubTabV216 = isVid ? 'video' : 'audio';
        // Если нажали сердечко на Деке Б и сейчас играет видео — переключаем/открываем вкладку Избранное на фильтре Видео
        window.activePlaylistTabV71 = 'fav';
        if (typeof window.renderPlaylistStripChipsV71 === 'function') window.renderPlaylistStripChipsV71();
        if (typeof window.renderActivePlaylistTracksV71 === 'function') window.renderActivePlaylistTracksV71(false);
        if (typeof window.showToast === 'function') {
            window.showToast(isVid ? '❤️ Открыто Избранное: 🎬 Видео' : '❤️ Открыто Избранное: 🎵 Аудио', ev);
        }
    };

    window.refreshDeckListV216 = async function(whichDeck, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var isVid = (whichDeck === 'video');
        if (isVid) {
            var cntB = document.getElementById('tracksCountDeckBV216');
            if (cntB) cntB.innerText = '⏳';
            window.activePlaylistTabV71 = 'videos';
            if (typeof window.syncDiscoveredVideosIntoPlaylistV134 === 'function') {
                await window.syncDiscoveredVideosIntoPlaylistV134(true);
            }
            if (typeof window.renderPlaylistStripChipsV71 === 'function') window.renderPlaylistStripChipsV71();
            if (typeof window.renderActivePlaylistTracksV71 === 'function') window.renderActivePlaylistTracksV71(false);
            var vItems = window.getFilteredVideoItemsV150 ? window.getFilteredVideoItemsV150() : [];
            if (cntB) cntB.innerText = String(vItems.length);
            if (typeof window.showToast === 'function') {
                window.showToast('🔄 Видео Деки Б обновлены: ' + vItems.length + ' шт.', ev);
            }
        } else {
            if (window.activePlaylistTabV71 === 'videos') window.activePlaylistTabV71 = 'all';
            if (typeof window.smartRefreshCurrentPlaylistV150 === 'function') {
                await window.smartRefreshCurrentPlaylistV150(ev, false);
            } else if (typeof window.fetchData === 'function') {
                await window.fetchData();
            }
            window.syncDualDeckCountersV216();
        }
    };

    window.syncDualDeckCountersV216 = function() {
        var data = window.lastData || {};
        var allAud = (data.all_tracks || []).filter(function(fn) {
            return !(window.isVideoFileNameV130 && window.isVideoFileNameV130(fn)) &&
                   (window.isAudioTrackAllowedByFormatSlotsV150 ? window.isAudioTrackAllowedByFormatSlotsV150(fn) : true);
        });
        var cntA = document.getElementById('tracksCount');
        if (cntA && cntA.innerText !== '⏳') {
            cntA.innerText = String(allAud.length);
        }
        var vItems = window.getFilteredVideoItemsV150 ? window.getFilteredVideoItemsV150() : [];
        var cntB = document.getElementById('tracksCountDeckBV216');
        if (cntB && cntB.innerText !== '⏳') {
            cntB.innerText = String(vItems.length);
        }
    };

    window.ensureDual9ButtonBarsDOMV216 = function() {
        window.renderHeaderSourcesHubV91();

        var rowBProg = document.getElementById('deckBProgressRow');
        var rowAProg = document.getElementById('deckAProgressRow');
        var mainBar = document.getElementById('mainTransportBar');
        if (!rowAProg || !mainBar) return;

        // 1) Перестраиваем нижний ряд Деки А (#mainTransportBar) в единую компактную строку из 9 кнопок:
        //    [🔊] [📤] [⏮] [⏯] [⏭] [🔄 94] [📊] [🤍] [🎚️]
        if (!mainBar._v216Built) {
            mainBar._v216Built = true;
            mainBar.className = 'jenny-deck-ctrl-row-v216';

            var volWrap = document.getElementById('volUIWrapper');
            var volBtn = document.getElementById('volIconTrigger');
            var expBtn = document.getElementById('btnExport');
            var prevBtn = document.getElementById('btnPrev');
            var playBtn = document.getElementById('playPauseBtn');
            var nextBtn = document.getElementById('btnNext');
            var specBtn = document.getElementById('btn-specModal');
            var favBtn = document.getElementById('btn-favModal');
            var eqBtn = document.getElementById('btn-eqModal');
            var cntSpan = document.getElementById('tracksCount');
            var refBtn = cntSpan ? cntSpan.closest('button') : null;

            if (expBtn) {
                expBtn.innerHTML = window.EXPORT_OUT_SVG_V216;
                expBtn.title = 'Экспорт трека (Дека А)';
            }
            if (refBtn) {
                refBtn.onclick = function(ev) { window.refreshDeckListV216('audio', ev); };
                refBtn.title = 'Обновить аудио Деки А';
            }
            if (specBtn) {
                specBtn.onclick = function(ev) { window.openSpectrumForDeckV216('audio', ev); };
            }
            if (favBtn) {
                favBtn.onclick = function(ev) { window.openFavForDeckV216('audio', ev); };
            }
            if (eqBtn) {
                eqBtn.onclick = function(ev) { window.openEqForDeckV216('audio', ev); };
            }

            [volBtn, expBtn, prevBtn, playBtn, nextBtn, refBtn, specBtn, favBtn, eqBtn].forEach(function(b) {
                if (!b) return;
                b.className = 'jenny-sq-btn-v216' + (b === playBtn ? ' play-accent-v216' : '');
                b.style.cssText = '';
                var svg = b.querySelector('svg');
                if (svg) {
                    svg.setAttribute('width', b === playBtn ? '18' : '15');
                    svg.setAttribute('height', b === playBtn ? '18' : '15');
                }
            });

            if (volWrap) {
                volWrap.style.cssText = 'position:relative;display:flex;flex:1 1 0;min-width:0;height:34px;';
                if (volBtn) volBtn.style.cssText = 'width:100% !important;height:34px !important;';
            }

            // Очищаем #mainTransportBar и выстраиваем все 9 элементов напрямую в одну флекс-строку
            mainBar.innerHTML = '';
            [volWrap, expBtn, prevBtn, playBtn, nextBtn, refBtn, specBtn, favBtn, eqBtn].forEach(function(el) {
                if (el) mainBar.appendChild(el);
            });
        }

        // 2) Создаём точно такую же компактную строку из 9 кнопок для Деки Б (#deckBControlsRowV216) прямо ПОД #deckBProgressRow
        var ctrlB = document.getElementById('deckBControlsRowV216');
        if (!ctrlB && rowBProg) {
            ctrlB = document.createElement('div');
            ctrlB.id = 'deckBControlsRowV216';
            ctrlB.className = 'jenny-deck-ctrl-row-v216';
            ctrlB.style.display = 'none';
            ctrlB.innerHTML =
                '<div id="volUIWrapperDeckBV216" style="position:relative;display:flex;flex:1 1 0;min-width:0;height:34px;">' +
                    '<button type="button" id="volIconTriggerDeckBV216" class="jenny-sq-btn-v216 deckb-accent-v216" style="width:100% !important;height:34px !important;" onclick="window.toggleVolumePopupDeckBV216(event)" title="Громкость видео (Дека Б)">' +
                        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>' +
                    '</button>' +
                    '<div id="volumePopupDeckBV216" class="vol-popup">' +
                        '<span id="volIconTextDeckBV216" style="color:#58a6ff;font-size:10px;font-weight:bold;">100%</span>' +
                        '<input type="range" id="volumeBarDeckBV216" class="vt-slider" min="0" max="15" step="1" value="10" oninput="window.applyDeckBVolumeV216(this.value * 10)">' +
                    '</div>' +
                '</div>' +
                '<button type="button" id="btnExportDeckBV216" class="jenny-sq-btn-v216 deckb-accent-v216" onclick="window.exportOrSaveDeckBV216(event)" title="Экспорт / Сохранение видео (Дека Б)">' +
                    window.EXPORT_OUT_SVG_V216 +
                '</button>' +
                '<button type="button" id="btnPrevDeckBV216" class="jenny-sq-btn-v216 deckb-accent-v216" onclick="window.playAdjacentVideoDeckBV216(-1, event)" title="Предыдущее видео">' +
                    '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>' +
                '</button>' +
                '<button type="button" id="playPauseBtnDeckBV216" class="jenny-sq-btn-v216 deckb-play-v216" onclick="window.togglePlayDeckBV216(event)" title="Плей / Пауза видео (Дека Б)">' +
                    '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
                '</button>' +
                '<button type="button" id="btnNextDeckBV216" class="jenny-sq-btn-v216 deckb-accent-v216" onclick="window.playAdjacentVideoDeckBV216(1, event)" title="Следующее видео">' +
                    '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>' +
                '</button>' +
                '<button type="button" id="btnRefreshDeckBV216" class="jenny-sq-btn-v216 deckb-accent-v216" onclick="window.refreshDeckListV216(\'video\', event)" title="Обновить список видео (Дека Б)">' +
                    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' +
                    '<span id="tracksCountDeckBV216" style="color:#58a6ff;font-weight:bold;font-size:10.5px;">0</span>' +
                '</button>' +
                '<button type="button" id="btnSpecDeckBV216" class="jenny-sq-btn-v216 deckb-accent-v216" onclick="window.openSpectrumForDeckV216(\'video\', event)" title="Анализатор спектра (Дека Б)">' +
                    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="4" y1="20" x2="4" y2="14"/><line x1="9" y1="20" x2="9" y2="8"/><line x1="14" y1="20" x2="14" y2="4"/><line x1="19" y1="20" x2="19" y2="11"/></svg>' +
                '</button>' +
                '<button type="button" id="btnFavDeckBV216" class="jenny-sq-btn-v216 deckb-accent-v216" onclick="window.openFavForDeckV216(\'video\', event)" title="Избранное видео (Дека Б)">' +
                    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
                '</button>' +
                '<button type="button" id="btnEqDeckBV216" class="jenny-sq-btn-v216 deckb-accent-v216" onclick="window.openEqForDeckV216(\'video\', event)" title="Эквалайзер и DSP (Дека Б)">' +
                    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>' +
                '</button>';
            rowBProg.insertAdjacentElement('afterend', ctrlB);
            window.applyDeckBVolumeV216(window._deckBVolumePercentV216);
        }

        // Закрытие всплывашки громкости Деки Б при клике снаружи
        if (!window._volDeckBOutsideClickHookedV216) {
            window._volDeckBOutsideClickHookedV216 = true;
            document.addEventListener('click', function(e) {
                var popB = document.getElementById('volumePopupDeckBV216');
                var wrapB = document.getElementById('volUIWrapperDeckBV216');
                if (popB && popB.classList.contains('show') && wrapB && !wrapB.contains(e.target)) {
                    popB.classList.remove('show');
                }
            });
        }

        // Синхронизируем видимость рядов кнопок с видимостью Деки А и Деки Б
        var dState = window._jennyDualDeckV211 || { deckA: true, deckB: false };
        var showA = Boolean(dState.deckA);
        var showB = Boolean(dState.deckB);
        if (ctrlB) ctrlB.style.setProperty('display', showB ? 'flex' : 'none', 'important');
        if (mainBar) mainBar.style.setProperty('display', showA ? 'flex' : 'none', 'important');

        window.syncDeckBPlayBtnIconV216();
        window.syncDualDeckCountersV216();
    };

    var _origSyncDualVisV216 = window.syncDualDeckVisibilityAndAudioV211;
    if (typeof _origSyncDualVisV216 === 'function' && !_origSyncDualVisV216._v216Wrapped) {
        window.syncDualDeckVisibilityAndAudioV211 = function() {
            var r = _origSyncDualVisV216.apply(this, arguments);
            window.ensureDual9ButtonBarsDOMV216();
            return r;
        };
        window.syncDualDeckVisibilityAndAudioV211._v216Wrapped = true;
    }

    // -------------------------------------------------------------------------
    // 7. АВТОМАТИЧЕСКОЕ ВКЛЮЧЕНИЕ ЗВУКОВОЙ ДОРОЖКИ В .MKV СО СТАРТА (БЕЗ НАЖАТИЯ 🛠️ MKV),
    //    ПЕРЕКЛЮЧЕНИЕ АУДИОДОРОЖЕК КНОПКОЙ 🛠️ MKV, ФИКСАЦИЯ ПОЛНОЙ ДЛИТЕЛЬНОСТИ И ТОЧНАЯ ПЕРЕМОТКА
    // -------------------------------------------------------------------------
    window.getEffectiveVideoDurationV167 = window.getEffectiveVideoDurationV210 = function(vid) {
        if (!vid) vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        var probeDur = (window._vcoreLastProbeV166 && window._vcoreLastProbeV166.duration_sec) || window._jennyFullMovieDurationSecV210 || 0;

        // Если нативное видео (до включения live_remux) уже сообщило реальную длительность серии (>35 сек) — запоминаем её в st.trueDuration!
        if (vid && !st.usingRemux && isFinite(vid.duration) && vid.duration > 35) {
            st.trueDuration = Math.max(st.trueDuration || 0, vid.duration);
        }

        if (st.trueDuration && st.trueDuration > 12.5) return st.trueDuration;
        if (st.knownDurationSec && st.knownDurationSec > 12.5) return st.knownDurationSec;
        if (vd.studioBuffer && vd.studioBuffer._trueDurationV72 > 12.5) return vd.studioBuffer._trueDurationV72;
        if (probeDur > 12.5) return probeDur;

        // ВНИМАНИЕ V216: если включён потоковый ремукс (st.usingRemux), vid.duration равен только длине подгруженного куска (0:03 -> 0:06 -> 0:22).
        // Никогда не возвращаем растущий кусок vid.duration как общую длительность фильма!
        if (!st.usingRemux && vid && isFinite(vid.duration) && vid.duration > 0) {
            return vid.duration;
        }
        return st.trueDuration || st.knownDurationSec || probeDur || 0;
    };

    window.getEffectiveVideoCurrentTimeV167 = window.getEffectiveVideoCurrentTimeV210 = function(vid) {
        if (!vid) vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130 || {};
        if (st._pendingSeekSecV167 !== undefined) {
            var dt = performance.now() - (st._pendingSeekTsV167 || 0);
            if (dt < 2600 || window._vidIsBufferingV132 || !vid || vid.readyState < 2) {
                return st._pendingSeekSecV167;
            }
            st._pendingSeekSecV167 = undefined;
        }
        var rawCur = (vid && isFinite(vid.currentTime)) ? vid.currentTime : 0;
        return rawCur + (st.remuxBaseOffset || 0);
    };

    // Кнопка 🛠️ MKV теперь:
    // - автоматически активна со старта для всех .mkv и .avi (поэтому звук есть сразу с 0:00!),
    // - а при ручном нажатии переключает аудиодорожки (Дорожка #1 -> Дорожка #2 -> Дорожка #1, например RUS / ENG)!
    window.switchVideoToFfmpegRemuxV130 = function(ev, forceTranscodeVideo) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._vidStateV130;
        var vid = document.getElementById('jennyVideoElV130');
        if (!vid || !st || !st.currentUrl) return;

        // Сохраняем полную длительность, если она уже была известна до переключения на ремукс
        if (isFinite(vid.duration) && vid.duration > 35 && !st.usingRemux) {
            st.trueDuration = Math.max(st.trueDuration || 0, vid.duration);
        }

        var curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
        if (ev) {
            // Ручное нажатие кнопки 🛠️ MKV: если ремукс уже шёл, переключаем следующую звуковую дорожку (0 -> 1 -> 2 -> 0)
            if (st.usingRemux) {
                st.audioTrackIdxV216 = ((st.audioTrackIdxV216 || 0) + 1) % 3;
            } else {
                st.audioTrackIdxV216 = 0;
            }
        } else {
            st.audioTrackIdxV216 = st.audioTrackIdxV216 || 0;
        }

        st.usingRemux = true;
        st.remuxBaseOffset = curSec;
        st._pendingSeekSecV167 = curSec;
        st._pendingSeekTsV167 = performance.now();
        window._vidPlayIntentV132 = true;
        window._vidIsBufferingV132 = true;
        if (typeof window.syncVideoPlayBtnIconV132 === 'function') window.syncVideoPlayBtnIconV132();

        var isAvi = Boolean(forceTranscodeVideo || /\.avi(\?|$)/i.test(String(st.currentTitle || '') + ' ' + String(st.currentUrl || '')));
        var tcFlag = isAvi ? '1' : '0';
        var aIdx = st.audioTrackIdxV216 || 0;
        var rawBaseUrl = st.rawTorStreamUrlV214 || st.currentUrl;
        var dur = window.getEffectiveVideoDurationV167(vid);

        var btnRemux = document.getElementById('v130BtnRemux');
        if (btnRemux) {
            btnRemux.innerText = '🔊 Дорожка #' + (aIdx + 1);
            btnRemux.style.borderColor = '#3fb950';
            btnRemux.style.color = '#3fb950';
        }

        vid.src = '/api/video/live_remux?src=' + encodeURIComponent(rawBaseUrl) +
            '&start=' + curSec.toFixed(2) +
            '&dur=' + (dur || 0).toFixed(2) +
            '&aidx=' + aIdx +
            '&transcode=' + tcFlag +
            '&t=' + Date.now();
        vid.play().catch(function(){});

        if (typeof window.showVideoFeedbackV130 === 'function') {
            if (ev) {
                window.showVideoFeedbackV130('🔊 Аудиодорожка #' + (aIdx + 1) + ' (FFmpeg AAC)');
            } else if (isAvi) {
                window.showVideoFeedbackV130('🛠️ Потоковый декодер FFmpeg (AVI ➔ MP4)');
            }
        }
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    // Чистая синхронная перемотка без изменения remuxBaseOffset во время ведения пальцем (isLiveDrag)
    window.seekDeckBAndPlayerSyncedV212 = function(targetSec, isLiveDrag) {
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        if (!vid || !st || !st.active) return;

        var dur = window.getEffectiveVideoDurationV167(vid);
        var cleanSec = (isFinite(dur) && dur > 0)
            ? Math.max(0, Math.min(Math.max(0, dur - 0.35), targetSec))
            : Math.max(0, targetSec);

        st._pendingSeekSecV167 = cleanSec;
        st._pendingSeekTsV167 = performance.now();

        var fmt = window.formatVideoTimeV210 || window.fmtKhSecV90 || function(s) {
            s = Math.max(0, Math.floor(s || 0));
            var m = Math.floor(s / 60), sc = s % 60;
            return m + ':' + (sc < 10 ? '0' + sc : sc);
        };

        var cEl = document.getElementById('v130CurTime');
        var dEl = document.getElementById('v130DurTime');
        var seek = document.getElementById('v130SeekSlider');
        if (cEl) cEl.innerText = fmt(cleanSec);
        if (dEl) dEl.innerText = dur > 0 ? fmt(dur) : 'Поток';
        if (seek && dur > 0) {
            seek.max = '1000';
            seek.value = String(Math.max(0, Math.min(1000, Math.round((cleanSec / dur) * 1000))));
        }

        var isRev = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed) || (vd && vd.isReversed));
        if (typeof window.updateProgressUIDeckB === 'function') {
            window.updateProgressUIDeckB(cleanSec, dur, isRev);
        }

        // Пока палец ведёт ползунок (isLiveDrag === true) — обновляем ТОЛЬКО визуальные цифры и шкалу,
        // НЕ трогая st.remuxBaseOffset и НЕ перезапуская FFmpeg посреди движения пальца!
        if (isLiveDrag) {
            return;
        }

        var isAviFile = /\.avi(\?|$)/i.test(String(st.currentTitle || '') + ' ' + String(st.currentUrl || ''));
        var isMkvOrRemuxType = /\.(mkv|avi|ts|m2ts|wmv|flv)(\?|$)/i.test(String(st.currentTitle || '') + ' ' + String(st.currentUrl || ''));
        var needsRemuxSeek = Boolean(st.usingRemux || isAviFile || isMkvOrRemuxType || (st.torHash && !st.isReadyLocalV212));

        if (st.torHash && dur > 0) {
            var seekRatio = Math.max(0, Math.min(0.995, cleanSec / dur));
            fetch('/api/torrent/seek_boost', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hash: st.torHash, file_index: Number(st.torFileIdx || 0), ratio: seekRatio })
            }).catch(function(){});
        }

        if (needsRemuxSeek) {
            st.usingRemux = true;
            st.remuxBaseOffset = cleanSec;
            window._vidPlayIntentV132 = true;
            window._vidIsBufferingV132 = true;
            if (typeof window.syncVideoPlayBtnIconV132 === 'function') window.syncVideoPlayBtnIconV132();
            var tcFlag = isAviFile ? '1' : '0';
            var aIdx = st.audioTrackIdxV216 || 0;
            var rawBaseUrl = st.rawTorStreamUrlV214 || st.currentUrl;
            vid.src = '/api/video/live_remux?src=' + encodeURIComponent(rawBaseUrl) +
                '&start=' + cleanSec.toFixed(2) +
                '&dur=' + (dur || 0).toFixed(2) +
                '&aidx=' + aIdx +
                '&transcode=' + tcFlag +
                '&t=' + Date.now();
            if (!st.userPaused) vid.play().catch(function(){});
        } else {
            st.remuxBaseOffset = 0;
            try { vid.currentTime = cleanSec; } catch (e) {}
            if (!st.userPaused && (vid.paused || vid.ended) && !isRev) {
                vid.play().catch(function(){});
            }
        }

        window.syncVideoRamEngineV211(false);
        if (typeof window.saveCurrentVideoProgressV135 === 'function') {
            window.saveCurrentVideoProgressV135();
        }
    };

    window.seekVideoToExactSecondV167 = function(targetSec) {
        window.seekDeckBAndPlayerSyncedV212(targetSec, false);
    };
    window.seekDeckBVideoToSecV210 = function(targetSec) {
        window.seekDeckBAndPlayerSyncedV212(targetSec, false);
    };

    // Очищаем ползунок #v130SeekSlider от дублирующих старых слушателей (V130/V167/V212) через клонирование узла
    function bindCleanSingleCommitVideoSliderV216() {
        var origSeek = document.getElementById('v130SeekSlider');
        var vid = document.getElementById('jennyVideoElV130');
        if (!origSeek || !vid || origSeek._v216CleanBound) return;

        var seek = origSeek.cloneNode(true);
        seek._v216CleanBound = true;
        seek._v167Bound = true;
        seek._v212UnifiedBound = true;
        seek.max = '1000';
        seek.min = '0';
        origSeek.replaceWith(seek);

        var lastDragSec = 0;

        var ratioFromEv = function(e) {
            var cx = undefined;
            if (e && e.touches && e.touches.length > 0) cx = e.touches[0].clientX;
            else if (e && e.changedTouches && e.changedTouches.length > 0) cx = e.changedTouches[0].clientX;
            else if (e && typeof e.clientX === 'number' && e.clientX > 0) cx = e.clientX;
            var rect = seek.getBoundingClientRect();
            if (typeof cx === 'number' && rect.width > 12) {
                return Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
            }
            return Math.max(0, Math.min(1, (parseFloat(seek.value) || 0) / 1000.0));
        };

        var onMovePreview = function(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            window._v130UserDraggingSeekV212 = true;
            var dur = window.getEffectiveVideoDurationV167(vid);
            if (!isFinite(dur) || dur <= 0) return;
            var r = ratioFromEv(e);
            seek.value = String(Math.round(r * 1000));
            lastDragSec = r * dur;
            window.seekDeckBAndPlayerSyncedV212(lastDragSec, true);
            if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
        };

        var onCommit = function(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            if (!window._v130UserDraggingSeekV212 && e && e.type !== 'click') return;
            var dur = window.getEffectiveVideoDurationV167(vid);
            if (isFinite(dur) && dur > 0) {
                var r = ratioFromEv(e);
                seek.value = String(Math.round(r * 1000));
                lastDragSec = r * dur;
                window.seekDeckBAndPlayerSyncedV212(lastDragSec, false);
            }
            window._v130LastDragCommitTsV212 = performance.now();
            window._v130UserDraggingSeekV212 = false;
            if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
        };

        seek.addEventListener('touchstart', onMovePreview, { passive: true });
        seek.addEventListener('touchmove', onMovePreview, { passive: true });
        seek.addEventListener('touchend', onCommit, { passive: true });
        seek.addEventListener('touchcancel', onCommit, { passive: true });
        seek.addEventListener('mousedown', onMovePreview);
        seek.addEventListener('mousemove', function(e) { if (window._v130UserDraggingSeekV212) onMovePreview(e); });
        seek.addEventListener('mouseup', onCommit);
        seek.addEventListener('input', onMovePreview);
        seek.addEventListener('change', onCommit);
    }

    // -------------------------------------------------------------------------
    // 8. ОТКРЫТИЕ ВИДЕО (АВТО-РЕМУКС ДЛЯ ВСЕХ .MKV / .AVI СО СТАРТА + ПРОБИНГ ДЛИТЕЛЬНОСТИ)
    //    И ЗАКРЫТИЕ ВИДЕО С 20-СЕКУНДНЫМ УДЕРЖАНИЕМ ПОТОКА (71420, 71418, 71419, 71421)
    // -------------------------------------------------------------------------
    window._vidHoldReleaseTimerV216 = null;

    var _prevOpenVidV216 = window.openJennyVideoPlayerV130;
    if (typeof _prevOpenVidV216 === 'function' && !_prevOpenVidV216._v216Wrapped) {
        window.openJennyVideoPlayerV130 = function(streamUrl, titleStr, opts) {
            // Отменяем таймер освобождения потока, если пользователь переключил на новое видео в пределах 20 сек!
            if (window._vidHoldReleaseTimerV216) {
                clearTimeout(window._vidHoldReleaseTimerV216);
                window._vidHoldReleaseTimerV216 = null;
            }
            if (window.videoDeckV131 && window.videoDeckV131.pieceAbortCtrl) {
                try { window.videoDeckV131.pieceAbortCtrl.abort(); } catch (e) {}
            }

            var r = _prevOpenVidV216.apply(this, arguments);

            var st = window._vidStateV130 || {};
            var vid = document.getElementById('jennyVideoElV130');
            st.audioTrackIdxV216 = 0;

            // Обновляем кнопку #v130BtnTorHub: вместо карты квадратиков "🧩 Части" пишем "📂 Файлы",
            // чтобы по клику открывался список файлов текущей раздачи (где видно "📡 Поток активен")!
            var btnHub = document.getElementById('v130BtnTorHub');
            if (btnHub) {
                btnHub.innerText = '📂 Файлы';
            }
            var btnRemux = document.getElementById('v130BtnRemux');
            if (btnRemux) {
                btnRemux.innerText = '🔊 Дорожка #1';
            }

            // Для ЛЮБОГО .mkv, .avi, .ts, .m2ts, .wmv, .flv (как локального, так и торрент-потока!)
            // автоматически включаем потоковый ремукс аудио в AAC со старта, чтобы звук шёл сразу с 0:00!
            var checkStr = String(st.currentTitle || titleStr || '') + ' ' + String(st.currentUrl || streamUrl || '');
            if (/\.(mkv|avi|ts|m2ts|wmv|flv)(\?|$)/i.test(checkStr) && !st.usingRemux) {
                if (vid && vid._pendingResumeSecV135 && isFinite(vid._pendingResumeSecV135) && vid._pendingResumeSecV135 > 0.5) {
                    st.remuxBaseOffset = Number(vid._pendingResumeSecV135);
                    st._pendingSeekSecV167 = Number(vid._pendingResumeSecV135);
                    st._pendingSeekTsV167 = performance.now();
                    vid._pendingResumeSecV135 = 0;
                }
                window.switchVideoToFfmpegRemuxV130(null, /\.avi(\?|$)/i.test(checkStr));
            }

            // Запрашиваем точную длительность видео (1 мс бинарный парсер AVI/MKV + ffprobe)
            var probeUrl = st.rawTorStreamUrlV214 || st.currentUrl || streamUrl;
            if (probeUrl && typeof window.probeTorrentVideoDurationV214 === 'function') {
                setTimeout(function() { window.probeTorrentVideoDurationV214(probeUrl); }, 80);
                setTimeout(function() { window.probeTorrentVideoDurationV214(probeUrl); }, 900);
                setTimeout(function() { window.probeTorrentVideoDurationV214(probeUrl); }, 2600);
            }

            bindCleanSingleCommitVideoSliderV216();
            window.ensureDual9ButtonBarsDOMV216();
            window.applyDeckBVolumeV216(window._deckBVolumePercentV216);
            return r;
        };
        window.openJennyVideoPlayerV130._v216Wrapped = true;
    }
})();

/* ================= JENNY_V217_UNIFIED_PATCH (#311): VIDEO SETTINGS & OPTIONAL FIT/ROTATE CONTROLS, CUSTOM RADIAL SPEED & REVERSE BUTTONS + NORM BASE SPEED, В+А / В / А STREAM MODES WITH AUDIO-ONLY MINI PILL, UNIFIED VECTOR SVG VIDEO HUD & BLUE/PURPLE DECK SEPARATION ================= */
/* [split] V217: кусок исходного IIFE (ui_v71.js, строки 21243–22584) → ui_video_decks.js */
;(function() {
    if (window._jennyV217Installed__video_decks) return;
    window._jennyV217Installed__video_decks = true;
    window._jennyV217Installed = true;

    // -------------------------------------------------------------------------
    // 1. ВЕКТОРНЫЕ SVG-ИКОНКИ В ЕДИНОМ СТИЛЕ ДЛЯ ВИДЕОПЛЕЕРА И ПАНЕЛЕЙ
    // -------------------------------------------------------------------------
    window.VID_SVGS_V217 = {
        va: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="13" height="12" rx="2"/><polygon points="15 8 20 5 20 15 15 12"/><path d="M6 20h12"/></svg>',
        vOnly: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="14" rx="2"/><polygon points="16 10 22 6 22 18 16 14"/></svg>',
        aOnly: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
        pult: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
        files: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
        fullOn: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
        fullOff: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>',
        pip: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><rect x="12" y="10" width="8" height="6" rx="1" fill="currentColor" fill-opacity="0.25"/></svg>',
        close: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
        lockClosed: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
        lockOpen: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
        rot90: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>',
        fit: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="7 10 7 8 9 8"/><polyline points="17 14 17 16 15 16"/></svg>',
        rev: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>',
        norm: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
        fwd: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',
        dsp: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
        track: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
        seekBack10: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
        seekFwd10: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
        playBig: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
        pauseBig: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
        waitBig: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>'
    };

    // -------------------------------------------------------------------------
    // 2. РАЗДЕЛЕНИЕ ЦВЕТОВ ДЕКИ Б (НАСЫЩЕННЫЙ СИНИЙ) И ДЕКИ А (100% ФИОЛЕТОВЫЙ)
    //    И ЕДИНЫЙ СТИЛЬ КНОПОК ВНУТРИ ВИДЕОПЛЕЕРА (#jennyVideoStudioRootV130)
    // -------------------------------------------------------------------------
    // Цветовые схемы и геометрия Деки А и Деки Б физически разведены по deck_a_isolated.css и deck_b_isolated.css

    // -------------------------------------------------------------------------
    // 3. НАСТРОЙКИ ВИДЕО ("🎬 Настройки видео"): ОПЦИОНАЛЬНЫЕ КНОПКИ 90° И МАСШТАБА
    // -------------------------------------------------------------------------
    var savedVidUiCfg = {};
    try { savedVidUiCfg = JSON.parse(localStorage.getItem('jenny_video_ui_cfg_v217') || '{}') || {}; } catch (e) {}

    window._jennyVideoUiCfgV217 = {
        showRotateBtn: savedVidUiCfg.showRotateBtn !== undefined ? Boolean(savedVidUiCfg.showRotateBtn) : true,
        showFitBtn:    savedVidUiCfg.showFitBtn !== undefined ? Boolean(savedVidUiCfg.showFitBtn) : true,
        fitContain:    savedVidUiCfg.fitContain !== undefined ? Boolean(savedVidUiCfg.fitContain) : true,
        fitCover:      savedVidUiCfg.fitCover !== undefined ? Boolean(savedVidUiCfg.fitCover) : true,
        fitFill:       savedVidUiCfg.fitFill !== undefined ? Boolean(savedVidUiCfg.fitFill) : true
    };

    window.saveVideoUiCfgV217 = function() {
        try { localStorage.setItem('jenny_video_ui_cfg_v217', JSON.stringify(window._jennyVideoUiCfgV217)); } catch (e) {}
    };

    window.getEnabledVideoFitModesV217 = function() {
        var c = window._jennyVideoUiCfgV217 || {};
        var list = [];
        if (c.fitContain) list.push('contain');
        if (c.fitCover)   list.push('cover');
        if (c.fitFill)    list.push('fill');
        if (list.length === 0) list.push('contain');
        return list;
    };

    window.syncExactRot90DimensionsV217 = function() {
        var stage = document.getElementById('jennyVideoStageV130');
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130 || {};
        if (!stage) return;
        if (st.rotated90 && !st.pipMode) {
            var w = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0, 320);
            var h = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0, 480);
            stage.style.setProperty('width', h + 'px', 'important');
            stage.style.setProperty('height', w + 'px', 'important');
        } else {
            stage.style.removeProperty('width');
            stage.style.removeProperty('height');
        }
        if (vid) {
            var enabledFits = window.getEnabledVideoFitModesV217();
            if (enabledFits.indexOf(st.fitMode) === -1) {
                st.fitMode = enabledFits[0];
            }
            vid.style.setProperty('object-fit', st.fitMode || 'contain', 'important');
            var glC = document.getElementById('jv166InterpCanvas');
            if (glC) glC.style.setProperty('object-fit', st.fitMode || 'contain', 'important');
        }
    };
    window.addEventListener('resize', window.syncExactRot90DimensionsV217);

    window.toggleVideoUiOptionV217 = function(key, checked) {
        var c = window._jennyVideoUiCfgV217;
        c[key] = Boolean(checked);
        // Гарантируем, что хотя бы один режим масштаба остаётся включённым
        if (!c.fitContain && !c.fitCover && !c.fitFill) {
            c.fitContain = true;
            var chkContain = document.getElementById('chkVidUiV217_fitContain');
            if (chkContain) chkContain.checked = true;
        }
        window.saveVideoUiCfgV217();
        window.syncVideoPlayerButtonsUIV217();
        window.syncExactRot90DimensionsV217();
    };

    // -------------------------------------------------------------------------
    // 4. КАСТОМНЫЕ РАДИАЛЬНЫЕ СКОРОСТИ (ВПЕРЁД / НАЗАД БЕЗ "REV") И БАЗОВАЯ СКОРОСТЬ "НОРМ."
    // -------------------------------------------------------------------------
    window.getCustomVideoSpeedZonesV217 = function() {
        var list = [];
        for (var i = 1; i <= 6; i++) {
            var en = document.getElementById('cfg_z' + i + '_en');
            var val = document.getElementById('cfg_z' + i + '_val');
            if (en && val) {
                if (en.checked) {
                    var num = parseFloat(String(val.value).replace(',', '.'));
                    if (isFinite(num) && num > 0.05 && num <= 16.0) {
                        list.push(Math.round(num * 100) / 100);
                    }
                }
            }
        }
        if (list.length === 0) {
            var cfg = (window.videoDeckV131 && window.videoDeckV131.config) || window.appConfig || {};
            if (Array.isArray(cfg.scrubZones) && cfg.scrubZones.length > 0) {
                cfg.scrubZones.forEach(function(z) {
                    if (z && z.en !== false && isFinite(parseFloat(z.val))) {
                        list.push(Math.round(parseFloat(z.val) * 100) / 100);
                    }
                });
            }
        }
        if (list.length === 0) {
            list = [1.1, 1.05, 1.5, 1.0, 0.95, 0.9];
        }
        return list;
    };

    window.getBaseSpeedDeckB = function() {
        var chkDom = document.getElementById('cfg_xNormalSpeed');
        var inpDom = document.getElementById('cfg_normalPlaybackSpeed');
        var vd = window.videoDeckV131;
        var vdCfg = (vd && vd.config) || window.appConfig || {};

        // Если в DOM открыты настройки Деки Б или чекбокс отмечен — берём точное значение из поля "🚀 Кастомная скорость (Base)"
        var isCustomOn = chkDom ? Boolean(chkDom.checked) : Boolean(vdCfg.xNormalSpeed);
        if (isCustomOn) {
            var rawVal = inpDom ? parseFloat(String(inpDom.value).replace(',', '.')) : parseFloat(vdCfg.normalPlaybackSpeed);
            if (!isFinite(rawVal) || rawVal <= 0.05) rawVal = parseFloat(vdCfg.normalPlaybackSpeed) || 1.0;
            return Math.max(0.1, Math.min(8.0, Math.round(rawVal * 100) / 100));
        }
        return 1.0;
    };

    window._lastFwdVideoSpeedV217 = 1.0;

    window.restoreNormalVideoPlaybackV217 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();

        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        if (!vid || !st || !vd) return;

        var wasRev = Boolean(vd.isReversed || window.isReversedDeckB);
        var curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);

        window.isReversedDeckB = false;
        vd.isReversed = false;
        if (vd.revFrameTimer) {
            clearInterval(vd.revFrameTimer);
            vd.revFrameTimer = null;
        }
        if (vd.sourceNode) {
            vd.sourceNode.onended = null;
            try { vd.sourceNode.stop(); } catch (e) {}
            try { vd.sourceNode.disconnect(); } catch (e) {}
            vd.sourceNode = null;
        }
        vd.isStudioPlaying = false;

        if (window.scrubStateDeckB) {
            window.scrubStateDeckB.active = false;
            window.scrubStateDeckB.locked = false;
            window.scrubStateDeckB.side = null;
            window.scrubStateDeckB.isPhysicallyReversed = false;
        }
        window.persistedPlaybackSpeedDeckB = null;
        window.persistedPlaybackSideDeckB = 'right';
        var lockEl = document.getElementById('speedLockIndicatorDeckB');
        if (lockEl) lockEl.style.display = 'none';

        var baseSpd = window.getBaseSpeedDeckB();
        window._jennyVideoSpeedV170 = baseSpd;
        window._lastFwdVideoSpeedV217 = baseSpd;
        vd.speed = baseSpd;

        try {
            vid.preservesPitch = true;
            vid.webkitPreservesPitch = true;
            vid.defaultPlaybackRate = baseSpd;
            vid.playbackRate = baseSpd;
        } catch (e) {}

        if (wasRev && st.usingRemux) {
            window.seekDeckBAndPlayerSyncedV212(curSec, false);
        } else if (!st.userPaused && vid.paused) {
            st._internalRevPause = false;
            vid.play().catch(function(){});
        }

        window.syncVideoRamEngineV211(false);
        window.syncVideoPlayerButtonsUIV217();
        if (ev && typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130('▶ Нормальное воспроизведение: ' + baseSpd + 'x');
        }
        if (ev && typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    // Переключение скорости ВПЕРЁД по 6 кастомным радиальным зонам из Настроек
    window.cycleVideoSpeedV130 = window.cycleVideoSpeedV131 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();

        var vd = window.videoDeckV131 || {};
        var zones = window.getCustomVideoSpeedZonesV217();
        var wasRev = Boolean(vd.isReversed || window.isReversedDeckB);

        var nextSpd = zones[0] || 1.0;
        if (wasRev) {
            // Если были в реверсе — возвращаемся в режим вперёд на последнюю выбранную скорость вперёд
            window.restoreNormalVideoPlaybackV217();
            nextSpd = window._lastFwdVideoSpeedV217 || zones[0] || window.getBaseSpeedDeckB();
        } else {
            var cur = window._jennyVideoSpeedV170 || vd.speed || window.getBaseSpeedDeckB();
            var idx = -1;
            for (var i = 0; i < zones.length; i++) {
                if (Math.abs(zones[i] - cur) < 0.008) { idx = i; break; }
            }
            nextSpd = zones[(idx + 1) % zones.length];
        }

        window._lastFwdVideoSpeedV217 = nextSpd;
        window.setVideoDeckSpeedV170(nextSpd, false);
        if (window.scrubStateDeckB) {
            window.scrubStateDeckB.locked = true;
            window.scrubStateDeckB.side = 'right';
            window.scrubStateDeckB.speed = nextSpd;
            window.scrubStateDeckB.isPhysicallyReversed = false;
        }
        window.persistedPlaybackSpeedDeckB = nextSpd;
        window.persistedPlaybackSideDeckB = 'right';

        window.syncVideoPlayerButtonsUIV217();
        if (typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130('⏩ Скорость вперёд: ' + nextSpd + 'x');
        }
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    window.startScrubDeckB = function(side, speed) {
        var vid = document.getElementById('jennyVideoElV130');
        var vd = window.videoDeckV131;
        var st = window._vidStateV130;
        if (!vid || !vd || !st || !st.active) return;

        var wantReverseNow = (side === 'left');
        var cleanSpd = Math.max(0.1, Math.min(8.0, Number(speed) || 1.0));
        window.scrubStateDeckB.active = true;
        window.scrubStateDeckB.side = side;
        window.scrubStateDeckB.speed = cleanSpd;
        window.scrubStateDeckB.isPhysicallyReversed = wantReverseNow;
        window.persistedPlaybackSpeedDeckB = cleanSpd;
        window.persistedPlaybackSideDeckB = side;

        var lockEl = document.getElementById('speedLockIndicatorDeckB');
        if (lockEl) {
            lockEl.style.display = 'block';
            lockEl.innerText = (window.scrubStateDeckB.locked ? '🔒' : '🔄') + ' ' + (wantReverseNow ? '⏪' : '⏩') + ' x' + cleanSpd;
        }

        if (wantReverseNow) {
            window.startImmediateVideoReverseEngineV217(cleanSpd);
        } else {
            if (vd.revFrameTimer) {
                clearInterval(vd.revFrameTimer);
                vd.revFrameTimer = null;
            }
            window.isReversedDeckB = false;
            vd.isReversed = false;
            window._lastFwdVideoSpeedV217 = cleanSpd;
            window._jennyVideoSpeedV170 = cleanSpd;
            vd.speed = cleanSpd;
            try {
                vid.defaultPlaybackRate = cleanSpd;
                vid.playbackRate = cleanSpd;
            } catch (e) {}
            if (!st.userPaused && vid.paused) {
                st._internalRevPause = false;
                vid.play().catch(function(){});
            }
            window.syncVideoRamEngineV211(true);
            window.syncVideoPlayerButtonsUIV217();
        }
    };

    // -------------------------------------------------------------------------
    // 5. РЕЖИМ ПОТОКОВ ТЕКУЩЕГО ВИДЕОФАЙЛА: "В+А" -> "В" (ТОЛЬКО ВИДЕО) -> "А" (ТОЛЬКО АУДИО + МИНИ-ПЛАШКА)
    // -------------------------------------------------------------------------
    window.ensureVideoAudioOnlyBadgeDOMV217 = function() {
        var badge = document.getElementById('jennyVideoAudioOnlyBadgeV217');
        if (badge) return badge;
        badge = document.createElement('div');
        badge.id = 'jennyVideoAudioOnlyBadgeV217';
        badge.style.cssText = 'display:none;align-items:center;justify-content:space-between;gap:8px;margin:4px 10px 4px 10px;padding:6px 10px;border-radius:10px;background:linear-gradient(135deg,rgba(11,24,54,0.96),rgba(23,37,84,0.92));border:1.5px solid #3b82f6;box-shadow:0 4px 14px rgba(37,99,235,0.35);color:#eff6ff;font-size:11.5px;font-weight:800;z-index:9999;';
        badge.innerHTML =
            '<div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;cursor:pointer;" onclick="window.restoreVideoFromAudioOnlyV217(event)">' +
                '<span style="color:#60a5fa;display:inline-flex;">' + window.VID_SVGS_V217.aOnly + '</span>' +
                '<span id="jennyVideoAudioOnlyTitleV217" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#dbeafe;">Аудио из видео</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">' +
                '<button type="button" onclick="window.restoreVideoFromAudioOnlyV217(event)" style="padding:4px 8px;border-radius:7px;background:rgba(37,99,235,0.45);border:1px solid #60a5fa;color:#fff;font-size:10.5px;font-weight:900;display:inline-flex;align-items:center;gap:4px;cursor:pointer;">' +
                    window.VID_SVGS_V217.va + '<span>В+А</span>' +
                '</button>' +
                '<button type="button" onclick="window.closeVideoPlayerV130(event)" style="width:24px;height:24px;padding:0;border-radius:6px;background:rgba(185,28,28,0.85);border:1px solid #f87171;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;">' +
                    window.VID_SVGS_V217.close +
                '</button>' +
            '</div>';

        var topHdr = document.getElementById('topHeaderCapsule');
        if (topHdr && topHdr.parentElement) {
            topHdr.insertAdjacentElement('afterend', badge);
        } else {
            document.body.insertBefore(badge, document.body.firstChild);
        }
        return badge;
    };

    window.applyCurrentVideoStreamModeV217 = function(modeStr, showMsg) {
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        var vid = document.getElementById('jennyVideoElV130');
        var root = document.getElementById('jennyVideoStudioRootV130');
        if (!st || !vd || !vid) return;

        st.videoStreamModeV217 = modeStr || 'va';
        var curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
        var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (vid.duration || 0);
        var rawBaseUrl = st.rawTorStreamUrlV214 || st.currentUrl || '';
        var isAvi = /\.avi(\?|$)/i.test(String(st.currentTitle || '') + ' ' + String(rawBaseUrl || ''));
        var tcFlag = isAvi ? '1' : '0';
        var aIdx = st.audioTrackIdxV216 || 0;

        var badge = window.ensureVideoAudioOnlyBadgeDOMV217();

        if (st.videoStreamModeV217 === 'v_only') {
            // РЕЖИМ "В" (ТОЛЬКО ВИДЕО): Полностью выгружаем аудио-буфер этого видео из памяти и запускаем поток без аудио (-an)!
            if (vd.pieceAbortCtrl) { try { vd.pieceAbortCtrl.abort(); } catch (e) {} vd.pieceAbortCtrl = null; }
            if (vd.sourceNode) {
                vd.sourceNode.onended = null;
                try { vd.sourceNode.stop(); } catch (e) {}
                try { vd.sourceNode.disconnect(); } catch (e) {}
                vd.sourceNode = null;
            }
            vd.studioBuffer = null;
            vd.reversedStudioBuffer = null;
            vd.isStudioPlaying = false;
            vid.muted = true;
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = 0.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = 0.0;

            if (badge) badge.style.display = 'none';
            if (root && st.active) root.style.display = 'flex';

            if (rawBaseUrl) {
                st.usingRemux = true;
                st.remuxBaseOffset = curSec;
                st._pendingSeekSecV167 = curSec;
                st._pendingSeekTsV167 = performance.now();
                vid.src = '/api/video/live_remux?src=' + encodeURIComponent(rawBaseUrl) +
                    '&start=' + curSec.toFixed(2) +
                    '&dur=' + (dur || 0).toFixed(2) +
                    '&no_audio=1&transcode=' + tcFlag + '&t=' + Date.now();
                if (!st.userPaused) vid.play().catch(function(){});
            }
            if (showMsg && typeof window.showVideoFeedbackV130 === 'function') {
                window.showVideoFeedbackV130('🎬 Режим «В»: Только видео (аудио-буфер выгружен)');
            }
        } else if (st.videoStreamModeV217 === 'a_only') {
            // РЕЖИМ "А" (ТОЛЬКО АУДИО): Закрываем и выгружаем видеодекодер (-vn), сворачиваем окно в компактную плашку у поиска!
            vid.muted = false;
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = st.dspBypass ? 0.0 : 1.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = st.dspBypass ? 1.0 : 0.0;

            if (rawBaseUrl) {
                st.usingRemux = true;
                st.remuxBaseOffset = curSec;
                st._pendingSeekSecV167 = curSec;
                st._pendingSeekTsV167 = performance.now();
                vid.src = '/api/video/live_remux?src=' + encodeURIComponent(rawBaseUrl) +
                    '&start=' + curSec.toFixed(2) +
                    '&dur=' + (dur || 0).toFixed(2) +
                    '&aidx=' + aIdx +
                    '&audio_only=1&t=' + Date.now();
                if (!st.userPaused) vid.play().catch(function(){});
            }

            // Прячем видео-окно и освобождаем полноэкранный блок
            if (root) root.style.display = 'none';
            if (window.AndroidBridge && typeof window.AndroidBridge.setVideoFullscreenLock === 'function') {
                try { window.AndroidBridge.setVideoFullscreenLock(false, false); } catch (e) {}
            }

            if (badge) {
                var tSpan = document.getElementById('jennyVideoAudioOnlyTitleV217');
                if (tSpan) tSpan.innerText = 'А: ' + (st.currentTitle || 'Видео');
                badge.style.display = 'flex';
            }
            if (showMsg && typeof window.showToast === 'function') {
                window.showToast('🎵 Режим «А»: Играет только звук из видео (видеодекодер выгружен)');
            }
        } else {
            // РЕЖИМ "В+А" (ВИДЕО + АУДИО ВМЕСТЕ)
            st.videoStreamModeV217 = 'va';
            vid.muted = false;
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = st.dspBypass ? 0.0 : 1.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = st.dspBypass ? 1.0 : 0.0;

            if (badge) badge.style.display = 'none';
            if (root && st.active) root.style.display = 'flex';
            if (typeof window.syncNativeFullscreenLockV132 === 'function') window.syncNativeFullscreenLockV132();

            if (rawBaseUrl) {
                var checkStr = String(st.currentTitle || '') + ' ' + String(rawBaseUrl || '');
                if (/\.(mkv|avi|ts|m2ts|wmv|flv)(\?|$)/i.test(checkStr) || st.usingRemux) {
                    st.usingRemux = true;
                    st.remuxBaseOffset = curSec;
                    st._pendingSeekSecV167 = curSec;
                    st._pendingSeekTsV167 = performance.now();
                    vid.src = '/api/video/live_remux?src=' + encodeURIComponent(rawBaseUrl) +
                        '&start=' + curSec.toFixed(2) +
                        '&dur=' + (dur || 0).toFixed(2) +
                        '&aidx=' + aIdx +
                        '&transcode=' + tcFlag + '&t=' + Date.now();
                } else {
                    st.usingRemux = false;
                    st.remuxBaseOffset = 0;
                    vid.src = rawBaseUrl;
                    try { vid.currentTime = curSec; } catch (e) {}
                }
                if (!st.userPaused) vid.play().catch(function(){});
            }
            if (showMsg && typeof window.showVideoFeedbackV130 === 'function') {
                window.showVideoFeedbackV130('🎬+🎵 Режим «В+А»: Видео + Аудио вместе');
            }
        }

        window.syncVideoPlayerButtonsUIV217();
    };

    window.restoreVideoFromAudioOnlyV217 = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        window.applyCurrentVideoStreamModeV217('va', true);
    };

    window.cycleDualDeckMixModeV131 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._vidStateV130 || {};
        var order = ['va', 'v_only', 'a_only'];
        var cur = st.videoStreamModeV217 || 'va';
        var next = order[(order.indexOf(cur) + 1) % order.length];
        window.applyCurrentVideoStreamModeV217(next, true);
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    // -------------------------------------------------------------------------
    // 6. ПЕРЕКЛЮЧЕНИЕ МАСШТАБА, ПОВОРОТА 90°, ПОЛНОГО ЭКРАНА, DSP, ПУЛЬТА И ФАЙЛОВ
    // -------------------------------------------------------------------------
    window.cycleVideoFitModeV130 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._vidStateV130 || {};
        var modes = window.getEnabledVideoFitModesV217();
        var curIdx = modes.indexOf(st.fitMode || 'contain');
        st.fitMode = modes[(curIdx + 1) % modes.length];
        window.syncExactRot90DimensionsV217();
        window.syncVideoPlayerButtonsUIV217();
        var labels = { contain: 'Вписать', cover: 'Заполнить', fill: 'Растянуть' };
        if (typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130('📐 Масштаб: ' + (labels[st.fitMode] || 'Вписать'));
        }
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    window.toggleVideoRotate90V130 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._vidStateV130;
        if (!st) return;
        if (st.pipMode && typeof window.toggleVideoPipModeV130 === 'function') {
            window.toggleVideoPipModeV130();
        }
        st.rotated90 = !st.rotated90;
        var stage = document.getElementById('jennyVideoStageV130');
        if (stage) stage.classList.toggle('rot90-v130', Boolean(st.rotated90));
        window.syncExactRot90DimensionsV217();
        window.syncVideoPlayerButtonsUIV217();
        if (typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130(st.rotated90 ? 'Горизонтальный разворот 90°' : 'Портретный режим');
        }
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    // Если галочка "Показывать кнопку поворота (90°)" снята в Настройках видео —
    // нажатие кнопки "Полный" автоматически разворачивает видео на 90°!
    window.toggleVideoNativeFullscreenV132 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._vidStateV130;
        if (!st) return;
        if (st.desktopOverlay && typeof window.exitDesktopOverlayModeV132 === 'function') {
            window.exitDesktopOverlayModeV132(true);
        }
        if (st.pipMode && typeof window.toggleVideoPipModeV130 === 'function') {
            window.toggleVideoPipModeV130();
        }
        st.nativeFullscreen = !st.nativeFullscreen;

        var vc = window._jennyVideoUiCfgV217 || {};
        if (!vc.showRotateBtn) {
            st.rotated90 = Boolean(st.nativeFullscreen);
            var stage = document.getElementById('jennyVideoStageV130');
            if (stage) stage.classList.toggle('rot90-v130', Boolean(st.rotated90));
        }

        if (typeof window.syncNativeFullscreenLockV132 === 'function') window.syncNativeFullscreenLockV132();
        window.syncExactRot90DimensionsV217();
        window.syncVideoPlayerButtonsUIV217();
        if (typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130(
                st.nativeFullscreen
                    ? (vc.showRotateBtn ? 'Полный экран ВКЛ' : 'Полный экран 90° ВКЛ')
                    : 'Обычный экран'
            );
        }
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    // Кнопка "🎧 DSP": когда включён — яркая синяя рамка и подсветка; когда выключен — серый; при повторном включении снова выделяется!
    window.toggleVideoDspModeV130 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._vidStateV130;
        if (!st) return;
        st.dspBypass = !st.dspBypass;
        window.syncVideoRamEngineV211(false);
        window.syncVideoPlayerButtonsUIV217();
        if (typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130(st.dspBypass ? 'Прямой звук (DSP ВЫКЛ)' : 'Тракт Деки Б (Jenny DSP ВКЛ)');
        }
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    // Кнопка "Пульт" (в верхней шапке видеоплеера): сворачивает видео в Мини и открывает "🎬 Настройки видео" + DSP Деки Б
    window.openVideoDeckDspStudioV131 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._vidStateV130;
        if (st && !st.pipMode && typeof window.toggleVideoPipModeV130 === 'function') {
            window.toggleVideoPipModeV130();
        }
        if (typeof window.switchActiveUiDeckV131 === 'function') {
            window.switchActiveUiDeckV131('video');
        }
        var sm = document.getElementById('settingsModal');
        if (sm && !sm.classList.contains('open') && typeof window.toggleModal === 'function') {
            window.toggleModal('settingsModal');
        }
        if (typeof window.renderDeckSwitchBannersV131 === 'function') {
            window.renderDeckSwitchBannersV131();
        }
        var vidSettingsBox = document.getElementById('jennyModularLabBoxV208');
        if (vidSettingsBox) {
            vidSettingsBox.open = true;
            setTimeout(function() {
                if (vidSettingsBox.scrollIntoView) vidSettingsBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 120);
        }
    };

    // Исправление сворачивания в "Мини" (PiP) на паузе — чтобы видеокадр никогда не становился пустым чёрным квадратом
    var _origTogglePipV217 = window.toggleVideoPipModeV130;
    window.toggleVideoPipModeV130 = function(ev) {
        var r = _origTogglePipV217 ? _origTogglePipV217.apply(this, arguments) : undefined;
        var vid = document.getElementById('jennyVideoElV130');
        var glC = document.getElementById('jv166InterpCanvas');
        if (vid) {
            vid.style.setProperty('visibility', 'visible', 'important');
            vid.style.setProperty('opacity', '1', 'important');
            vid.style.setProperty('display', 'block', 'important');
        }
        if (glC && (!window._jennyExp120HzEnabledV205 || !vid || vid.paused)) {
            glC.style.setProperty('display', 'none', 'important');
        }
        window.syncExactRot90DimensionsV217();
        window.syncVideoPlayerButtonsUIV217();
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
        return r;
    };

    // -------------------------------------------------------------------------
    // 7. СИНХРОНИЗАЦИЯ ВСЕХ КНОПОК И ВЕКТОРНЫХ ИКОНОК ВНУТРИ ВИДЕОПЛЕЕРА (#jennyVideoStudioRootV130)
    // -------------------------------------------------------------------------
    window.syncVideoPlayerButtonsUIV217 = function() {
        var root = document.getElementById('jennyVideoStudioRootV130');
        if (!root) return;

        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        var vc = window._jennyVideoUiCfgV217 || {};
        var svgs = window.VID_SVGS_V217;

        // Убираем старую кнопку "▾ Скрыть" справа от ползунка, чтобы не дублировать автоскрытие
        var oldHideBtn = document.getElementById('v135BtnToggleBottomBar');
        if (oldHideBtn) oldHideBtn.style.setProperty('display', 'none', 'important');
        var btmRow = document.getElementById('v135BottomToolsRow');
        if (btmRow) {
            btmRow.setAttribute('data-collapsed-v135', '0');
            if (!st.pipMode) btmRow.style.setProperty('display', 'flex', 'important');
        }

        // Переносим кнопку "Пульт" (#v131BtnOpenVideoDsp) в верхний ряд (перед кнопкой Файлы/Полный)
        var btnPult = document.getElementById('v131BtnOpenVideoDsp');
        var btnMix  = document.getElementById('v131BtnMixMode');
        if (btnPult && btnMix && btnMix.parentElement && btnPult.parentElement !== btnMix.parentElement) {
            btnMix.insertAdjacentElement('afterend', btnPult);
            btnPult.classList.add('v130-hide-in-pip');
        }
        if (btnPult) {
            btnPult.innerHTML = svgs.pult + '<span>Пульт</span>';
            btnPult.style.cssText = '';
        }

        // Кнопка "В+А" / "В" / "А" (#v131BtnMixMode)
        if (btnMix) {
            var sMode = st.videoStreamModeV217 || 'va';
            btnMix.style.cssText = '';
            btnMix.classList.toggle('v130-btn-active-v217', sMode !== 'va');
            if (sMode === 'v_only') {
                btnMix.innerHTML = svgs.vOnly + '<span>В</span>';
            } else if (sMode === 'a_only') {
                btnMix.innerHTML = svgs.aOnly + '<span>А</span>';
            } else {
                btnMix.innerHTML = svgs.va + '<span>В+А</span>';
            }
        }

        // Кнопка "Файлы" (#v130BtnTorHub)
        var btnHub = document.getElementById('v130BtnTorHub');
        if (btnHub) {
            btnHub.style.cssText = '';
            btnHub.style.display = st.pipMode ? 'none' : 'inline-flex';
            btnHub.innerHTML = svgs.files + '<span>Файлы</span>';
        }

        // Кнопка "Полный" / "Обычн." (#v132BtnFullscreen)
        var btnFs = document.getElementById('v132BtnFullscreen');
        if (btnFs) {
            btnFs.style.cssText = '';
            btnFs.classList.toggle('v130-btn-active-v217', Boolean(st.nativeFullscreen));
            btnFs.innerHTML = (st.nativeFullscreen ? svgs.fullOff : svgs.fullOn) + '<span>' + (st.nativeFullscreen ? 'Обычн.' : 'Полный') + '</span>';
        }

        // Кнопка "Мини" / "Развернуть" (#v130BtnPipToggle)
        var btnPip = document.getElementById('v130BtnPipToggle');
        if (btnPip) {
            btnPip.style.cssText = '';
            btnPip.innerHTML = (st.pipMode ? svgs.fullOn : svgs.pip) + '<span>' + (st.pipMode ? 'Развернуть' : 'Мини') + '</span>';
        }

        // Кнопка закрытия "✕"
        var closeBtns = root.querySelectorAll('button[onclick*="closeVideoPlayerV130"]');
        closeBtns.forEach(function(cb) {
            cb.style.cssText = '';
            cb.className = 'v130-btn v130-btn-close-v217';
            cb.innerHTML = svgs.close;
        });

        // Центральные круглые кнопки: [-10] [▶/⏸] [+10]
        var seekBackBtn = root.querySelector('button[onclick*="seekVideoRelativeV130(-10"]');
        var seekFwdBtn  = root.querySelector('button[onclick*="seekVideoRelativeV130(10"]');
        var centerPlay  = document.getElementById('v130CenterPlayBtn');
        if (seekBackBtn && !seekBackBtn._v217Styled) {
            seekBackBtn._v217Styled = true;
            seekBackBtn.style.cssText = 'width:46px !important;height:46px !important;border-radius:50% !important;padding:0 !important;background:rgba(11,24,54,0.88) !important;border:1.5px solid rgba(59,130,246,0.72) !important;color:#60a5fa !important;';
            seekBackBtn.innerHTML = svgs.seekBack10 + '<span style="font-size:10.5px;font-weight:900;margin-left:1px;">10</span>';
        }
        if (seekFwdBtn && !seekFwdBtn._v217Styled) {
            seekFwdBtn._v217Styled = true;
            seekFwdBtn.style.cssText = 'width:46px !important;height:46px !important;border-radius:50% !important;padding:0 !important;background:rgba(11,24,54,0.88) !important;border:1.5px solid rgba(59,130,246,0.72) !important;color:#60a5fa !important;';
            seekFwdBtn.innerHTML = '<span style="font-size:10.5px;font-weight:900;margin-right:1px;">10</span>' + svgs.seekFwd10;
        }
        if (centerPlay) {
            centerPlay.style.cssText = 'width:56px !important;height:56px !important;border-radius:50% !important;padding:0 !important;background:rgba(37,99,235,0.88) !important;border:2px solid #93c5fd !important;color:#ffffff !important;box-shadow:0 0 18px rgba(59,130,246,0.65) !important;';
        }

        // Нижний ряд кнопок: Замок, 90°, Масштаб, [⏪ Скорость назад], [▶ Норм.], [⏩ Скорость вперёд], DSP, Дорожка
        var btnLock = document.getElementById('v132BtnLock');
        if (btnLock) {
            btnLock.style.cssText = '';
            btnLock.classList.toggle('v130-btn-active-v217', Boolean(st.isLocked));
            btnLock.innerHTML = (st.isLocked ? svgs.lockClosed : svgs.lockOpen) + '<span>Замок</span>';
        }

        var btnRot = document.getElementById('v130BtnRotate');
        if (btnRot) {
            btnRot.style.cssText = '';
            if (!vc.showRotateBtn) {
                btnRot.style.setProperty('display', 'none', 'important');
            } else {
                btnRot.style.removeProperty('display');
                btnRot.classList.toggle('v130-btn-active-v217', Boolean(st.rotated90));
                btnRot.innerHTML = svgs.rot90 + '<span>90°</span>';
            }
        }

        var btnFit = document.getElementById('v130BtnFit');
        if (btnFit) {
            btnFit.style.cssText = '';
            var enabledFits = window.getEnabledVideoFitModesV217();
            if (enabledFits.indexOf(st.fitMode) === -1) {
                st.fitMode = enabledFits[0];
                window.syncExactRot90DimensionsV217();
            }
            if (!vc.showFitBtn) {
                btnFit.style.setProperty('display', 'none', 'important');
            } else {
                btnFit.style.removeProperty('display');
                var fitLabels = { contain: 'Вписать', cover: 'Заполнить', fill: 'Растянуть' };
                btnFit.classList.toggle('v130-btn-active-v217', st.fitMode && st.fitMode !== 'contain');
                btnFit.innerHTML = svgs.fit + '<span>' + (fitLabels[st.fitMode] || 'Вписать') + '</span>';
            }
        }

        var zones = window.getCustomVideoSpeedZonesV217();
        var baseSpd = window.getBaseSpeedDeckB();
        var isRev = Boolean(vd.isReversed || window.isReversedDeckB);
        var curSpd = Number(vd.speed || window._jennyVideoSpeedV170 || baseSpd);

        // Кнопка скорости НАЗАД (#v131BtnVideoRev) — БЕЗ надписи "REV", только векторная стрелка назад и число!
        var btnRev = document.getElementById('v131BtnVideoRev');
        if (btnRev) {
            btnRev.style.cssText = '';
            var dispRevSpd = isRev ? curSpd : (window._lastRevVideoSpeedV217 || zones[0] || baseSpd);
            btnRev.classList.toggle('v130-btn-active-v217', isRev);
            btnRev.innerHTML = svgs.rev + '<span>' + dispRevSpd + 'x</span>';
            window.bindInPlayerSpeedArcDragV217(btnRev, 'left');
        }

        // Кнопка восстановления обычной (базовой) скорости (#v130BtnNormSpeed) между ⏪ и ⏩
        var btnSpd = document.getElementById('v130BtnSpeed');
        var btnNorm = document.getElementById('v130BtnNormSpeed');
        if (!btnNorm && btnRev && btnRev.parentElement) {
            btnNorm = document.createElement('button');
            btnNorm.type = 'button';
            btnNorm.id = 'v130BtnNormSpeed';
            btnNorm.className = 'v130-btn';
            btnNorm.title = 'Вернуть обычное воспроизведение (Базовая скорость)';
            btnNorm.onclick = function(ev) { window.restoreNormalVideoPlaybackV217(ev); };
            btnRev.insertAdjacentElement('afterend', btnNorm);
        }
        if (btnNorm) {
            btnNorm.style.cssText = '';
            var isAtNormalFwd = (!isRev && Math.abs(curSpd - baseSpd) < 0.008);
            btnNorm.classList.toggle('v130-btn-active-v217', isAtNormalFwd);
            btnNorm.innerHTML = svgs.norm + '<span>' + baseSpd + 'x</span>';
        }

        // Кнопка скорости ВПЕРЁД (#v130BtnSpeed)
        if (btnSpd) {
            btnSpd.style.cssText = '';
            var dispFwdSpd = (!isRev) ? curSpd : (window._lastFwdVideoSpeedV217 || zones[0] || baseSpd);
            var isCustomFwdActive = (!isRev && Math.abs(curSpd - baseSpd) >= 0.008);
            btnSpd.classList.toggle('v130-btn-active-v217', isCustomFwdActive);
            btnSpd.innerHTML = svgs.fwd + '<span>' + dispFwdSpd + 'x</span>';
            window.bindInPlayerSpeedArcDragV217(btnSpd, 'right');
        }

        // Кнопка "DSP" (#v130BtnDsp): чёткое выделение рамкой и цветом, когда включён, и серый, когда выключен!
        var btnDsp = document.getElementById('v130BtnDsp');
        if (btnDsp) {
            btnDsp.style.cssText = '';
            var dspOn = !st.dspBypass;
            btnDsp.classList.toggle('v130-btn-active-v217', dspOn);
            btnDsp.classList.toggle('v130-btn-off-v217', !dspOn);
            btnDsp.innerHTML = svgs.dsp + '<span>' + (dspOn ? 'DSP' : 'Выкл') + '</span>';
        }

        // Кнопка "Дорожка #1" (#v130BtnRemux)
        var btnRemux = document.getElementById('v130BtnRemux');
        if (btnRemux) {
            btnRemux.style.cssText = '';
            var aIdx = (st.audioTrackIdxV216 || 0) + 1;
            btnRemux.classList.toggle('v130-btn-active-v217', Boolean(st.usingRemux));
            btnRemux.innerHTML = svgs.track + '<span>Дор. #' + aIdx + '</span>';
        }
    };

    // Обновляем центральную кнопку Play/Pause на чистые векторные SVG-иконки
    window.syncVideoPlayBtnIconV132 = function() {
        var vid = document.getElementById('jennyVideoElV130');
        var playBtn = document.getElementById('v130CenterPlayBtn');
        if (!playBtn || !vid) return;
        var vd = window.videoDeckV131 || {};
        var svgs = window.VID_SVGS_V217;
        if (window._vidIsBufferingV132 && window._vidPlayIntentV132 && !vd.isReversed) {
            playBtn.innerHTML = svgs.waitBig;
            return;
        }
        var isActuallyPlaying = (!vid.paused && !vid.ended && vid.readyState >= 2) || Boolean(vd.isReversed);
        playBtn.innerHTML = (window._vidPlayIntentV132 && isActuallyPlaying) ? svgs.pauseBig : svgs.playBig;
        if (typeof window.syncDeckBPlayBtnIconV216 === 'function') {
            window.syncDeckBPlayBtnIconV216();
        }
    };

    // Перехватываем setVideoDeckSpeedV170, чтобы он не затирал векторную SVG-иконку внутри #v130BtnSpeed
    var _origSetVidSpeedV170 = window.setVideoDeckSpeedV170;
    window.setVideoDeckSpeedV170 = function(rawSpeed, showNotification) {
        var res = _origSetVidSpeedV170 ? _origSetVidSpeedV170.call(this, rawSpeed, showNotification) : rawSpeed;
        window.syncVideoPlayerButtonsUIV217();
        return res;
    };

    // При открытии нового видео сбрасываем режим В+А в 'va' и синхронизируем кнопки и масштаб
    var _origOpenVidV217 = window.openJennyVideoPlayerV130;
    if (typeof _origOpenVidV217 === 'function' && !_origOpenVidV217._v217Wrapped) {
        window.openJennyVideoPlayerV130 = function(streamUrl, titleStr, opts) {
            if (window._vidStateV130) {
                window._vidStateV130.videoStreamModeV217 = 'va';
            }
            var badge = document.getElementById('jennyVideoAudioOnlyBadgeV217');
            if (badge) badge.style.display = 'none';

            var baseSpd = window.getBaseSpeedDeckB();
            window._jennyVideoSpeedV170 = baseSpd;
            window._lastFwdVideoSpeedV217 = baseSpd;
            if (window.videoDeckV131) {
                window.videoDeckV131.speed = baseSpd;
                window.videoDeckV131.isReversed = false;
            }
            window.isReversedDeckB = false;

            var r = _origOpenVidV217.apply(this, arguments);
            var vid = document.getElementById('jennyVideoElV130');
            if (vid) {
                vid.muted = false;
                try {
                    vid.defaultPlaybackRate = baseSpd;
                    vid.playbackRate = baseSpd;
                } catch (e) {}
            }
            window.syncExactRot90DimensionsV217();
            window.syncVideoPlayerButtonsUIV217();
            return r;
        };
        window.openJennyVideoPlayerV130._v217Wrapped = true;
    }

    var _origCloseVidV217 = window.closeVideoPlayerV130;
    if (typeof _origCloseVidV217 === 'function' && !_origCloseVidV217._v217Wrapped) {
        window.closeVideoPlayerV130 = function(ev) {
            var badge = document.getElementById('jennyVideoAudioOnlyBadgeV217');
            if (badge) badge.style.display = 'none';
            if (window.videoDeckV131 && window.videoDeckV131.revFrameTimer) {
                clearInterval(window.videoDeckV131.revFrameTimer);
                window.videoDeckV131.revFrameTimer = null;
            }
            window.isReversedDeckB = false;
            return _origCloseVidV217.apply(this, arguments);
        };
        window.closeVideoPlayerV130._v217Wrapped = true;
    }

    setTimeout(function() {
        window.mountModularLabSettingsV208();
        window.syncVideoPlayerButtonsUIV217();
        window.syncExactRot90DimensionsV217();
    }, 200);
})();

/* [split] V218: кусок исходного IIFE (ui_v71.js, строки 22588–24059) → ui_video_decks.js */
;(function() {
    if (window._jennyV218Installed__video_decks) return;
    window._jennyV218Installed__video_decks = true;
    window._jennyV218Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    var HEART_OUTLINE_SVG_V218 = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    var HEART_FILLED_SVG_V218  = '<svg viewBox="0 0 24 24" width="15" height="15" fill="#f43f5e" stroke="#f43f5e" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

    // При открытой клавиатуре на Android ресайз окна не должен сбрасывать фокус с поля ввода
    var _origSyncRot90V217 = window.syncExactRot90DimensionsV217;
    window.syncExactRot90DimensionsV217 = function() {
        if (window.isAnySettingsInputFocusedV218()) return;
        var stage = document.getElementById('jennyVideoStageV130');
        var vid = document.getElementById('jennyVideoElV130');
        var glC = document.getElementById('jv166InterpCanvas');
        var st = window._vidStateV130 || {};
        if (!stage) return;

        var isCompact = window.isVideoCompactPipOrMiniV218 ? window.isVideoCompactPipOrMiniV218() : Boolean(st.pipMode);
        if (st.rotated90 && !isCompact) {
            var w = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0, 320);
            var h = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0, 480);
            stage.style.setProperty('width', h + 'px', 'important');
            stage.style.setProperty('height', w + 'px', 'important');
        } else {
            stage.style.removeProperty('width');
            stage.style.removeProperty('height');
        }

        if (vid) {
            var enabledFits = window.getEnabledVideoFitModesV217 ? window.getEnabledVideoFitModesV217() : ['contain', 'cover', 'fill'];
            if (enabledFits.indexOf(st.fitMode) === -1) {
                st.fitMode = enabledFits[0];
            }
            var fitVal = st.fitMode || 'contain';
            vid.style.setProperty('object-fit', fitVal, 'important');
            vid.style.setProperty('width', '100%', 'important');
            vid.style.setProperty('height', '100%', 'important');
            vid.style.setProperty('max-width', 'none', 'important');
            vid.style.setProperty('max-height', 'none', 'important');
            if (glC) {
                glC.style.setProperty('object-fit', fitVal, 'important');
                glC.style.setProperty('width', '100%', 'important');
                glC.style.setProperty('height', '100%', 'important');
                glC.style.setProperty('max-width', 'none', 'important');
                glC.style.setProperty('max-height', 'none', 'important');
            }
        }
    };

    window.getCurrentDeckTargetFilenameV218 = function(whichDeck) {
        var isVid = (whichDeck === 'video');
        if (isVid) {
            var st = window._vidStateV130 || {};
            if (st.currentTitle && st.currentTitle !== '🎬 Дека Б: Выбери видео') {
                return String(st.currentTitle).trim();
            }
            var npB = document.getElementById('nowPlayingDeckB');
            if (npB) {
                var txtB = String(npB.innerText || '').replace(/^🎬\s*/, '').trim();
                if (txtB && txtB.indexOf('Выбери видео') === -1) return txtB;
            }
            return '';
        } else {
            if (window.currentPlayingTrack) return String(window.currentPlayingTrack).trim();
            return '';
        }
    };

    window.syncDeckFavButtonsUIV218 = function() {
        var favs = Array.isArray(window.favorites) ? window.favorites : [];
        var curA = window.getCurrentDeckTargetFilenameV218('audio');
        var curB = window.getCurrentDeckTargetFilenameV218('video');

        var btnA = document.getElementById('btn-favModal');
        if (btnA) {
            var isFavA = Boolean(curA && favs.indexOf(curA) !== -1);
            if (btnA._lastFavStateV218 !== isFavA) {
                btnA._lastFavStateV218 = isFavA;
                btnA.innerHTML = isFavA ? HEART_FILLED_SVG_V218 : HEART_OUTLINE_SVG_V218;
            }
        }

        var btnB = document.getElementById('btnFavDeckBV216');
        if (btnB) {
            var isFavB = Boolean(curB && favs.indexOf(curB) !== -1);
            if (btnB._lastFavStateV218 !== isFavB) {
                btnB._lastFavStateV218 = isFavB;
                btnB.innerHTML = isFavB ? HEART_FILLED_SVG_V218 : HEART_OUTLINE_SVG_V218;
            }
        }
    };

    window.openFavForDeckV216 = function(whichDeck, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (ev && ev.preventDefault) ev.preventDefault();

        var isVid = (whichDeck === 'video');
        var targetFn = window.getCurrentDeckTargetFilenameV218(isVid ? 'video' : 'audio');
        if (!targetFn) {
            if (typeof window.showToast === 'function') {
                window.showToast(isVid ? '🎬 Сначала выбери или запусти видео в Деке Б' : '🎵 Сначала выбери или запусти трек в Деке А', ev);
            }
            return;
        }

        window.favorites = Array.isArray(window.favorites) ? window.favorites : [];
        var existingIdx = window.favorites.indexOf(targetFn);
        var added = false;
        if (existingIdx !== -1) {
            window.favorites.splice(existingIdx, 1);
            added = false;
        } else {
            window.favorites.unshift(targetFn);
            added = true;
        }
        try { localStorage.setItem('ytm_favs', JSON.stringify(window.favorites)); } catch (e) {}

        window.syncDeckFavButtonsUIV218();
        window.syncPersistentUserDataV218(true);

        // Обновляем счётчики чипов и сердечки в видимом списке треков, НЕ переключая вкладку и НЕ закрывая открытый эквалайзер!
        if (typeof window.renderPlaylistStripChipsV71 === 'function') window.renderPlaylistStripChipsV71();
        if (window.activePlaylistTabV71 === 'fav' && typeof window.renderActivePlaylistTracksV71 === 'function') {
            window.renderActivePlaylistTracksV71(true);
        } else {
            document.querySelectorAll('#unifiedList .track-row-capsule').forEach(function(row) {
                if (row.getAttribute('data-track') === targetFn) {
                    var heartSpan = row.querySelector('span[onclick*="toggleFav"]');
                    if (heartSpan) heartSpan.innerText = added ? '❤️' : '🤍';
                }
            });
        }

        var shortName = targetFn.length > 28 ? (targetFn.slice(0, 26) + '…') : targetFn;
        if (typeof window.showToast === 'function') {
            window.showToast(
                added
                    ? ('❤️ В избранном: ' + shortName)
                    : ('🤍 Убрано из избранного: ' + shortName),
                ev
            );
        }
    };

    // -------------------------------------------------------------------------
    // 5. РАЗДЕЛЬНЫЙ 5-ПОЛОСНЫЙ ЭКВАЛАЙЗЕР И РАДИАЛЬНЫЕ ЗОНЫ ДЛЯ ДЕКИ А И ДЕКИ Б,
    //    ЧИСТЫЙ СЕЛЕКТОР ДЕКИ В ЭКВАЛАЙЗЕРЕ И РУЧНОЕ/АВТО УПРАВЛЕНИЕ ДЕКОЙ Б
    // -------------------------------------------------------------------------
    var savedEqA = null, savedEqB = null;
    try { savedEqA = JSON.parse(localStorage.getItem('jenny_eq_deckA_v218') || 'null'); } catch (e) {}
    try { savedEqB = JSON.parse(localStorage.getItem('jenny_eq_deckB_v218') || 'null'); } catch (e) {}

    window._musicConfigRefV131 = window._musicConfigRefV131 || window.appConfig || {};
    window._deckAEqV218 = savedEqA || Object.assign({ b60: 0, b230: 0, b910: 0, b3600: 0, b14000: 0 }, (window._musicConfigRefV131.eq || {}));
    window._deckBEqV218 = savedEqB || Object.assign({ b60: 0, b230: 0, b910: 0, b3600: 0, b14000: 0 }, (window.videoDeckV131 && window.videoDeckV131.config && window.videoDeckV131.config.eq) || {});

    window._musicConfigRefV131.eq = Object.assign({}, window._deckAEqV218);
    if (window.videoDeckV131 && window.videoDeckV131.config) {
        window.videoDeckV131.config.eq = Object.assign({}, window._deckBEqV218);
        if (!Array.isArray(window.videoDeckV131.config.scrubZones) || window.videoDeckV131.config.scrubZones.length !== 6) {
            window.videoDeckV131.config.scrubZones = [
                { val: 1.1, en: true }, { val: 1.0, en: true },
                { val: 1.05, en: true }, { val: 0.95, en: true },
                { val: 1.5, en: true }, { val: 0.9, en: true }
            ];
        } else {
            // Клонируем массив зон, чтобы Дека А и Дека Б никогда не ссылались на один и тот же массив в памяти!
            window.videoDeckV131.config.scrubZones = JSON.parse(JSON.stringify(window.videoDeckV131.config.scrubZones));
        }
    }

    window.applyBothDecksEQNodesV218 = function() {
        var bands = [60, 230, 910, 3600, 14000];
        bands.forEach(function(freq) {
            var valA = parseFloat(window._deckAEqV218['b' + freq]) || 0;
            if (window.eqNodes && window.eqNodes['band' + freq]) {
                window.eqNodes['band' + freq].gain.value = valA;
            }
            var valB = parseFloat(window._deckBEqV218['b' + freq]) || 0;
            if (window.videoDeckV131 && window.videoDeckV131.eqNodes && window.videoDeckV131.eqNodes['band' + freq]) {
                window.videoDeckV131.eqNodes['band' + freq].gain.value = valB;
            }
        });
    };

    // БУНКЕР ДЕКИ А (#354): #eqModal, #specModal и #settingsModal привязаны на 100% ТОЛЬКО к Аудиодеке А!
    // У Деки Б (Видео) — свои собственные синие окна #eqModalDeckB и #specModalDeckB (jenny_deck_b_modals.js).
    window._activeUiDeckV131 = 'music';
    window._musicConfigRefV131 = window.appConfig;

    window.syncEqSlidersToActiveDeckV218 = function() {
        var eqObj = window._deckAEqV218;
        [60, 230, 910, 3600, 14000].forEach(function(freq) {
            var v = parseFloat(eqObj['b' + freq]) || 0;
            var el = document.getElementById('eq_' + freq);
            if (el) {
                el.value = String(v);
                el.style.accentColor = '#a855f7';
            }
            var lbl = document.getElementById('eq_val_lbl_' + freq);
            if (lbl) lbl.innerText = (v > 0 ? '+' : '') + v + ' dB';
        });
        window.applyBothDecksEQNodesV218();
    };

    window.changeEQ = function() {
        if (!window.audioCtx && typeof window.initAudioBoost === 'function') window.initAudioBoost();
        var targetEq = window._deckAEqV218;
        [60, 230, 910, 3600, 14000].forEach(function(freq) {
            var el = document.getElementById('eq_' + freq);
            var val = el ? (parseInt(el.value, 10) || 0) : 0;
            targetEq['b' + freq] = val;
            var lbl = document.getElementById('eq_val_lbl_' + freq);
            if (lbl) lbl.innerText = (val > 0 ? '+' : '') + val + ' dB';
        });
        if (window.appConfig) {
            window.appConfig.eq = Object.assign({}, window._deckAEqV218);
            try { localStorage.setItem('ytm_config', JSON.stringify(window.appConfig)); } catch (e) {}
        }
        try { localStorage.setItem('jenny_eq_deckA_v218', JSON.stringify(window._deckAEqV218)); } catch (e) {}
        window.applyBothDecksEQNodesV218();
        window.syncPersistentUserDataV218(false);
    };

    window.applyEQSettings = function() {
        window.syncEqSlidersToActiveDeckV218();
    };

    var _origSaveZonesV218 = window.saveZonesToConfig;
    window.saveZonesToConfig = function() {
        var cfg = window.appConfig;
        if (!cfg.scrubZones) cfg.scrubZones = [];
        for (var i = 1; i <= 6; i++) {
            var enEl = document.getElementById('cfg_z' + i + '_en');
            var valEl = document.getElementById('cfg_z' + i + '_val');
            if (enEl && valEl) {
                cfg.scrubZones[i - 1] = {
                    en: Boolean(enEl.checked),
                    val: parseFloat(String(valEl.value).replace(',', '.')) || 1.0
                };
            }
        }
        try { localStorage.setItem('ytm_config', JSON.stringify(cfg)); } catch (e) {}
        window.syncPersistentUserDataV218(false);
    };

    var _origSyncControlsToDeckV131 = window.syncAllControlsToActiveDeckV131;
    window.syncAllControlsToActiveDeckV131 = function() {
        if (window.isAnySettingsInputFocusedV218()) return;
        window._activeUiDeckV131 = 'music';
        window._musicConfigRefV131 = window.appConfig;
        if (typeof _origSyncControlsToDeckV131 === 'function') {
            _origSyncControlsToDeckV131.apply(this, arguments);
        }
        var cfg = window.appConfig || {};
        var defZones = [1.1, 1.0, 1.05, 0.95, 1.5, 0.9];
        if (!Array.isArray(cfg.scrubZones) || cfg.scrubZones.length !== 6) {
            cfg.scrubZones = defZones.map(function(v) { return { val: v, en: true }; });
        }
        for (var i = 0; i < 6; i++) {
            var z = cfg.scrubZones[i] || { val: defZones[i], en: true };
            var enEl = document.getElementById('cfg_z' + (i + 1) + '_en');
            var valEl = document.getElementById('cfg_z' + (i + 1) + '_val');
            if (enEl) enEl.checked = (z.en !== false);
            if (valEl && document.activeElement !== valEl) valEl.value = z.val;
        }
        window.syncEqSlidersToActiveDeckV218();
    };

    window.selectUiDeckFocusOnlyV218 = function(whichDeck, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        window._activeUiDeckV131 = 'music';
        window._musicConfigRefV131 = window.appConfig;
        if (whichDeck === 'video' || whichDeck === 'B') {
            if (typeof window.openDeckBIsolatedEqModal === 'function') {
                window.openDeckBIsolatedEqModal(ev);
            }
            return;
        }
        window.syncAllControlsToActiveDeckV131();
        window.renderDeckSwitchBannersV131();
    };

    window.toggleComplementDeckV211 = function(whichDeck, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var d = window._jennyDualDeckV211 || { deckA: true, deckB: false, uiFocus: 'music', manualDeckB: false };
        var isVideoBtn = (whichDeck === 'video' || whichDeck === 'B');

        if (isVideoBtn) {
            d.deckB = !d.deckB;
            d.manualDeckB = Boolean(d.deckB);
            if (!d.deckB) {
                if (window._vidStateV130 && window._vidStateV130.active && typeof window.closeVideoPlayerV130 === 'function') {
                    window._closingFromManualDeckBOffV218 = true;
                    try { window.closeVideoPlayerV130(); } finally { window._closingFromManualDeckBOffV218 = false; }
                } else {
                    var vEl = document.getElementById('jennyVideoElV130');
                    if (vEl && !vEl.paused) { try { vEl.pause(); } catch (e) {} }
                    if (window.videoDeckV131 && window.videoDeckV131.sourceNode) {
                        try { window.videoDeckV131.sourceNode.stop(); } catch (e) {}
                    }
                }
            } else if (typeof window.initVideoDeckAudioV131 === 'function') {
                window.initVideoDeckAudioV131();
            }
        } else {
            d.deckA = !d.deckA;
            if (!d.deckA) {
                var aEl = document.getElementById('audioPlayer');
                if (aEl && !aEl.paused) { try { aEl.pause(); } catch (e) {} }
                if (window.studioSourceNode) {
                    try { window.studioSourceNode.stop(); } catch (e) {}
                }
            }
        }

        d.uiFocus = 'music';
        window._activeUiDeckV131 = 'music';
        window._musicConfigRefV131 = window.appConfig;
        window.saveDualDeckStateV211();
        window.syncDualDeckVisibilityAndAudioV211();
        window.renderDeckSwitchBannersV131();

        if (typeof window.showToast === 'function' && ev) {
            var modeStr = (d.deckA && d.deckB)
                ? '🔥 Дека А (Музыка) + Дека Б (Видео) работают ВМЕСТЕ!'
                : (d.deckB ? '🎬 Активна Дека Б: Видео' : (d.deckA ? '🎵 Активна Дека А: Музыка' : '⏸ Обе деки выключены'));
            window.showToast(modeStr);
        }
    };

    window.renderDeckSwitchBannersV131 = function() {
        if (typeof window.decorateDeckAModalsWithABSwitchersV359 === 'function') {
            window.decorateDeckAModalsWithABSwitchersV359();
            if (typeof window.syncDeckBBannersOnlyV360 === 'function') {
                window.syncDeckBBannersOnlyV360();
            }
            if (typeof window.renderVCoreDeckPanelV166 === 'function') window.renderVCoreDeckPanelV166();
            return;
        }
        var d = window._jennyDualDeckV211 || { deckA: true, deckB: false, uiFocus: 'music' };
        var sm = document.getElementById('settingsModal');
        if (sm) {
            var contS = sm.querySelector('.container') || sm;
            var exS = document.getElementById('deckSwitchBarSettingsV131');
            if (!exS) {
                exS = document.createElement('div');
                exS.id = 'deckSwitchBarSettingsV131';
                contS.insertBefore(exS, contS.firstChild);
            }
            var statusA = d.deckA ? 'ВКЛ' : 'ВЫКЛ';
            var statusB = d.deckB ? 'ВКЛ' : 'ВЫКЛ';
            exS.innerHTML =
                '<div style="display:flex;flex-direction:column;gap:6px;padding:8px;background:#05070b;border:1.5px solid #a855f7;border-radius:14px;margin-bottom:10px;">' +
                    '<div style="display:flex;align-items:center;gap:8px;width:100%;">' +
                        '<button type="button" onclick="if(window.switchModalCopyABV359) window.switchModalCopyABV359(\'music\', \'settings\', event)" style="flex:1;padding:8px;border-radius:10px;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:space-between;border:1.5px solid #c084fc;background:rgba(126,34,206,0.38);color:#f3e8ff;cursor:pointer;">' +
                            '<span>🎵 Дека А: Музыка</span>' +
                            '<span onclick="event.stopPropagation();window.toggleComplementDeckV211(\'music\', event);" style="padding:2px 6px;border-radius:6px;font-size:10px;background:rgba(63,185,80,0.22);color:#3fb950;border:1px solid #3fb950;">' + statusA + '</span>' +
                        '</button>' +
                        '<button type="button" onclick="if(window.switchModalCopyABV359) window.switchModalCopyABV359(\'video\', \'settings\', event)" style="flex:1;padding:8px;border-radius:10px;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:space-between;border:1.5px solid #30363d;background:#0d1117;color:#8b949e;cursor:pointer;">' +
                            '<span>🎬 Дека Б: Видео</span>' +
                            '<span onclick="event.stopPropagation();window.toggleComplementDeckV211(\'video\', event);" style="padding:2px 6px;border-radius:6px;font-size:10px;background:#161b22;color:#8b949e;border:1px solid #30363d;">' + statusB + '</span>' +
                        '</button>' +
                    '</div>' +
                '</div>';
        }
        if (typeof window.renderVCoreDeckPanelV166 === 'function') window.renderVCoreDeckPanelV166();
    };

    window.openEqForDeckV216 = function(whichDeck, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (whichDeck === 'video') {
            if (typeof window.openDeckBIsolatedEqModal === 'function') {
                window.openDeckBIsolatedEqModal(ev);
            }
            return;
        }
        window._activeUiDeckV131 = 'music';
        window.syncEqSlidersToActiveDeckV218();
        if (typeof window.toggleModal === 'function') window.toggleModal('eqModal');
    };

    window.openSpectrumForDeckV216 = function(whichDeck, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (whichDeck === 'video') {
            if (typeof window.openDeckBIsolatedSpecModal === 'function') {
                window.openDeckBIsolatedSpecModal(ev);
            }
            return;
        }
        window._activeUiDeckV131 = 'music';
        if (typeof window.openSpectrumModalV62 === 'function') window.openSpectrumModalV62();
    };

    window.copyMusicDspToVideoV131 = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var mCfg = window.appConfig || {};
        var dspKeys = [
            'studioMode', 'phaseFixEnabled', 'gearKeyV66', 'engineModeV62', 'elasticHoseMode', 'hoseTensionPct',
            'opt_midPhase', 'val_midPhase', 'opt_midQ', 'val_midQ', 'opt_deEsser', 'val_deEsser',
            'opt_cleanFir', 'val_cleanFir', 'opt_masterCeil', 'val_masterCeil',
            'opt_autoRms', 'val_autoRms', 'opt_monoBass', 'val_monoBass',
            'opt_msWidth', 'val_msWidth', 'opt_punch', 'val_punch', 'opt_crossfeed', 'val_crossfeed',
            'firEnabled', 'firSettings', 'multiBandEnabled', 'multiBandSettings',
            'limiterEnabled', 'limiterSettings', 'boosterEnabled', 'boosterPower'
        ];
        if (window.videoDeckV131 && window.videoDeckV131.config) {
            dspKeys.forEach(function(k) {
                if (mCfg[k] !== undefined) {
                    window.videoDeckV131.config[k] = JSON.parse(JSON.stringify(mCfg[k]));
                }
            });
            window.saveVideoConfigV131();
            if (typeof window.buildVideoAudioGraphV131 === 'function') window.buildVideoAudioGraphV131();
            if (typeof window.syncVideoRamEngineV211 === 'function') window.syncVideoRamEngineV211(false);
            if (typeof window.syncDeckBIsolatedEqModalUI === 'function') window.syncDeckBIsolatedEqModalUI();
        }
        if (typeof window.showToast === 'function') {
            window.showToast('✅ Звуковые модули DSP скопированы из Музыки в Видео (Аудиодека не затронута)!');
        }
    };

    // Закрытие видеоплеера (❌): оставляет панель Деки Б включённой ТОЛЬКО если пользователь сам включил её в настройках (manualDeckB)!
    var _prevCloseVidV218 = window.closeVideoPlayerV130;
    window.closeVideoPlayerV130 = function(ev) {
        var d = window._jennyDualDeckV211 || {};
        var keepDeckB = Boolean(d.manualDeckB) && !window._closingFromManualDeckBOffV218;
        var r = _prevCloseVidV218 ? _prevCloseVidV218.apply(this, arguments) : undefined;
        if (window._jennyDualDeckV211) {
            window._jennyDualDeckV211.deckB = keepDeckB;
            window.saveDualDeckStateV211();
            window.syncDualDeckVisibilityAndAudioV211();
            window.renderDeckSwitchBannersV131();
        }
        return r;
    };

    // -------------------------------------------------------------------------
    // 6. МИНИ-ПЛЕЕР ("МИНИ") И СИСТЕМНЫЙ PIP НА РАБОЧЕМ СТОЛЕ ANDROID:
    //    - Полное скрытие плашек ⚡ 120Hz, 🎛️ Крутилки, 🌓 Сплит, 📊 Лог в мини-плеере и PiP
    //    - В центре вместо [-10] [+10] ставим [⏮ Предыдущее видео] и [⏭ Следующее видео]
    //    - Внизу оставляем только шкалу перемотки, компактный Замок (🔒) и Дорожку (🔊 Дор.)
    //    - Чёткая синхронизация кнопок "Полный" / "Обычн." и "Мини" / "Развернуть" при любых переходах!
    // -------------------------------------------------------------------------
    window.isSystemPipWindowV218 = function() {
        var st = window._vidStateV130 || {};
        if (!st.active) return false;
        if (st.desktopOverlay) return true;
        var w = window.innerWidth || document.documentElement.clientWidth || 999;
        var h = window.innerHeight || document.documentElement.clientHeight || 999;
        return (w <= 460 && h <= 340);
    };

    window.isVideoCompactPipOrMiniV218 = function() {
        var st = window._vidStateV130 || {};
        if (st.pipMode || st.desktopOverlay) return true;
        return window.isSystemPipWindowV218();
    };

    var PREV_VID_SVG_V218 = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>';
    var NEXT_VID_SVG_V218 = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>';

    var _origSyncVidBtnsV217 = window.syncVideoPlayerButtonsUIV217;
    window.syncVideoPlayerButtonsUIV217 = function() {
        var root = document.getElementById('jennyVideoStudioRootV130');
        var st = window._vidStateV130 || {};
        if (!root) return;

        var sysPip = window.isSystemPipWindowV218();
        // Если вышли из системного PiP или 90° обратно в обычный портретный экран приложения —
        // сбрасываем залипший флаг nativeFullscreen / rotated90, чтобы кнопка всегда писала "Полный", а не "Обычн."!
        if (window._wasInSystemPipV218 && !sysPip) {
            window._wasInSystemPipV218 = false;
            if (!st.pipMode) {
                st.nativeFullscreen = false;
                st.rotated90 = false;
                var stg = document.getElementById('jennyVideoStageV130');
                if (stg) stg.classList.remove('rot90-v130');
                if (window.AndroidBridge && typeof window.AndroidBridge.setVideoFullscreenLock === 'function') {
                    try { window.AndroidBridge.setVideoFullscreenLock(false, Boolean(st.isLocked)); } catch (e) {}
                }
            }
        }
        if (sysPip) {
            window._wasInSystemPipV218 = true;
        }

        if (typeof _origSyncVidBtnsV217 === 'function') {
            _origSyncVidBtnsV217.apply(this, arguments);
        }

        var isCompact = window.isVideoCompactPipOrMiniV218();
        root.classList.toggle('compact-pip-v218', isCompact);

        var svgs = window.VID_SVGS_V217 || {};

        // 1) Кнопка "Мини" / "Развернуть" (#v130BtnPipToggle):
        //    И в мини-плеере, и на рабочем столе (System PiP) ВСЕГДА пишет "Развернуть"!
        var btnPip = document.getElementById('v130BtnPipToggle');
        if (btnPip) {
            var showExpand = Boolean(st.pipMode || st.desktopOverlay || sysPip);
            btnPip.innerHTML = (showExpand ? (svgs.fullOn || '') : (svgs.pip || '')) + '<span>' + (showExpand ? 'Развернуть' : 'Мини') + '</span>';
            btnPip.onclick = function(ev) {
                if (ev && ev.stopPropagation) ev.stopPropagation();
                if (st.desktopOverlay && typeof window.exitDesktopOverlayModeV132 === 'function') {
                    window.exitDesktopOverlayModeV132(true, ev);
                    st.pipMode = false;
                    st.nativeFullscreen = false;
                    st.rotated90 = false;
                    root.classList.remove('mode-pip-v130');
                    root.classList.add('mode-full-v130');
                } else if (sysPip) {
                    st.pipMode = false;
                    st.nativeFullscreen = false;
                    st.rotated90 = false;
                    root.classList.remove('mode-pip-v130');
                    root.classList.add('mode-full-v130');
                    if (window.AndroidBridge && typeof window.AndroidBridge.exitDesktopOverlay === 'function') {
                        try { window.AndroidBridge.exitDesktopOverlay(true); } catch (e) {}
                    }
                } else if (typeof window.toggleVideoPipModeV130 === 'function') {
                    window.toggleVideoPipModeV130(ev);
                }
                window.syncExactRot90DimensionsV217();
                window.syncVideoPlayerButtonsUIV217();
            };
        }

        // 2) Кнопка "Полный" / "Обычн." (#v132BtnFullscreen):
        var btnFs = document.getElementById('v132BtnFullscreen');
        if (btnFs) {
            var isActuallyFull = Boolean((st.nativeFullscreen || st.rotated90) && !isCompact);
            btnFs.classList.toggle('v130-btn-active-v217', isActuallyFull);
            btnFs.innerHTML = (isActuallyFull ? (svgs.fullOff || '') : (svgs.fullOn || '')) + '<span>' + (isActuallyFull ? 'Обычн.' : 'Полный') + '</span>';
        }

        // 3) Центральные кнопки в мини-плеере и на рабочем столе (PiP):
        //    В режиме Мини / PiP боковые кнопки вокруг Play/Pause переключают Предыдущее (⏮) / Следующее (⏭) видео,
        //    а сам центральный блок чуть приподнимается, чтобы снизу аккуратно стояли шкала, Замок и Дор.!
        var centerPlay = document.getElementById('v130CenterPlayBtn');
        var centerRow = centerPlay ? centerPlay.parentElement : null;
        if (centerRow) {
            centerRow.style.transform = isCompact ? 'translateY(-10px)' : 'none';
            centerRow.style.gap = isCompact ? '12px' : '22px';
            var btns = centerRow.querySelectorAll('button');
            var leftBtn = btns.length >= 3 ? btns[0] : null;
            var rightBtn = btns.length >= 3 ? btns[2] : null;

            if (leftBtn && rightBtn) {
                if (isCompact) {
                    leftBtn.style.cssText = 'width:36px !important;height:36px !important;border-radius:50% !important;padding:0 !important;background:rgba(11,24,54,0.88) !important;border:1.5px solid rgba(59,130,246,0.75) !important;color:#60a5fa !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;';
                    leftBtn.innerHTML = PREV_VID_SVG_V218;
                    leftBtn.title = 'Предыдущее видео';
                    leftBtn.onclick = function(ev) { window.playAdjacentVideoDeckBV216(-1, ev); };

                    rightBtn.style.cssText = 'width:36px !important;height:36px !important;border-radius:50% !important;padding:0 !important;background:rgba(11,24,54,0.88) !important;border:1.5px solid rgba(59,130,246,0.75) !important;color:#60a5fa !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;';
                    rightBtn.innerHTML = NEXT_VID_SVG_V218;
                    rightBtn.title = 'Следующее видео';
                    rightBtn.onclick = function(ev) { window.playAdjacentVideoDeckBV216(1, ev); };

                    if (centerPlay) {
                        centerPlay.style.cssText = 'width:44px !important;height:44px !important;border-radius:50% !important;padding:0 !important;background:rgba(37,99,235,0.88) !important;border:2px solid #93c5fd !important;color:#ffffff !important;box-shadow:0 0 14px rgba(59,130,246,0.65) !important;';
                    }
                } else {
                    leftBtn.style.cssText = 'width:46px !important;height:46px !important;border-radius:50% !important;padding:0 !important;background:rgba(11,24,54,0.88) !important;border:1.5px solid rgba(59,130,246,0.72) !important;color:#60a5fa !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;';
                    leftBtn.innerHTML = (svgs.seekBack10 || '') + '<span style="font-size:10.5px;font-weight:900;margin-left:1px;">10</span>';
                    leftBtn.title = '-10 сек';
                    leftBtn.onclick = function(ev) { if (window.seekVideoRelativeV130) window.seekVideoRelativeV130(-10, ev); };

                    rightBtn.style.cssText = 'width:46px !important;height:46px !important;border-radius:50% !important;padding:0 !important;background:rgba(11,24,54,0.88) !important;border:1.5px solid rgba(59,130,246,0.72) !important;color:#60a5fa !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;';
                    rightBtn.innerHTML = '<span style="font-size:10.5px;font-weight:900;margin-right:1px;">10</span>' + (svgs.seekFwd10 || '');
                    rightBtn.title = '+10 сек';
                    rightBtn.onclick = function(ev) { if (window.seekVideoRelativeV130) window.seekVideoRelativeV130(10, ev); };

                    if (centerPlay) {
                        centerPlay.style.cssText = 'width:56px !important;height:56px !important;border-radius:50% !important;padding:0 !important;background:rgba(37,99,235,0.88) !important;border:2px solid #93c5fd !important;color:#ffffff !important;box-shadow:0 0 18px rgba(59,130,246,0.65) !important;';
                    }
                }
            }
        }
    };

    window.addEventListener('resize', function() {
        window.syncVideoPlayerButtonsUIV217();
    });
    document.addEventListener('visibilitychange', function() {
        setTimeout(window.syncVideoPlayerButtonsUIV217, 120);
    });

    // -------------------------------------------------------------------------
    // 7. ИСПРАВЛЕНИЕ ПЕРЕМОТКИ ТОРРЕНТ-ПОТОКА (БЕЗ СБРОСА ⏳ -> ▶ ДО ЗАГРУЗКИ КУСКА)
    //    И РЕАЛЬНОЕ ПЕРЕКЛЮЧЕНИЕ АУДИОДОРОЖЕК (Дорожка #1 / #2 / #3)
    // -------------------------------------------------------------------------
    window.switchVideoToFfmpegRemuxV130 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        if (!vid || !st) return;

        var totalTracks = Math.max(2, Number(st.audioStreamsCountV218) || 3);
        if (!st.usingRemux && (st.audioTrackIdxV216 === undefined || st.audioTrackIdxV216 === 0)) {
            st.audioTrackIdxV216 = 1 % totalTracks;
        } else {
            st.audioTrackIdxV216 = ((st.audioTrackIdxV216 || 0) + 1) % totalTracks;
        }

        var curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
        window.seekDeckBAndPlayerSyncedV212(curSec, false);
        window.syncVideoPlayerButtonsUIV217();

        if (typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130('🔊 Переключена аудиодорожка #' + (st.audioTrackIdxV216 + 1));
        }
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    // Переопределяем seekDeckBAndPlayerSyncedV212: всегда передаём выбранную аудиодорожку &aidx= и удерживаем ⏳ при докачке куска торрента!
    window.seekDeckBAndPlayerSyncedV212 = function(targetSec, showToastMsg) {
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        if (!vid || !st || !st.active) return;

        var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : 0;
        var clamped = dur > 0 ? Math.max(0, Math.min(dur - 0.2, Number(targetSec) || 0)) : Math.max(0, Number(targetSec) || 0);

        st._pendingSeekSecV167 = clamped;
        st._pendingSeekTsV167 = performance.now();

        if (typeof window.updateProgressUIDeckB === 'function') {
            window.updateProgressUIDeckB(clamped, dur, false);
        }
        if (typeof window.syncInternalVideoSliderUIV212 === 'function') {
            window.syncInternalVideoSliderUIV212(clamped, dur);
        }

        var rawBaseUrl = st.rawTorStreamUrlV214 || st.currentUrl || '';
        var checkStr = String(st.currentTitle || '') + ' ' + String(rawBaseUrl);
        var isRemuxFmt = /\.(mkv|avi|ts|m2ts|wmv|flv|mpg|mpeg|vob)(\?|$)/i.test(checkStr);
        var aIdx = st.audioTrackIdxV216 || 0;
        var sMode = st.videoStreamModeV217 || 'va';

        if (!st.userPaused) {
            window._vidPlayIntentV132 = true;
            window._vidIsBufferingV132 = true;
            st._seekingTorrentWaitUntilV218 = performance.now() + 18000;
            if (typeof window.syncVideoPlayBtnIconV132 === 'function') window.syncVideoPlayBtnIconV132();
        }

        if ((st.usingRemux || isRemuxFmt || aIdx > 0 || sMode !== 'va') && rawBaseUrl) {
            st.usingRemux = true;
            st.remuxBaseOffset = clamped;
            var isAvi = /\.(avi|wmv|flv|mpg|mpeg|vob)(\?|$)/i.test(checkStr);
            var tcFlag = isAvi ? '1' : '0';
            var modeParam = (sMode === 'v_only') ? '&no_audio=1' : ((sMode === 'a_only') ? '&audio_only=1' : '');
            vid.src = '/api/video/live_remux?src=' + encodeURIComponent(rawBaseUrl) +
                '&start=' + clamped.toFixed(2) +
                '&dur=' + (dur || 0).toFixed(2) +
                '&aidx=' + aIdx +
                modeParam +
                '&transcode=' + tcFlag +
                '&t=' + Date.now();
            var spd = window._jennyVideoSpeedV170 || (window.videoDeckV131 && window.videoDeckV131.speed) || 1.0;
            try {
                vid.defaultPlaybackRate = spd;
                vid.playbackRate = spd;
            } catch (e) {}
            if (!st.userPaused) {
                vid.play().catch(function(){});
            } else {
                try { vid.load(); } catch (e) {}
            }
        } else {
            try { vid.currentTime = clamped; } catch (e) {}
            if (!st.userPaused && vid.paused) {
                vid.play().catch(function(){});
            }
        }
    };

    // Кнопка Play/Pause (#v130CenterPlayBtn & #playPauseBtnDeckBV216): корректно возобновляет и прямой ход, и реверс с точки паузы/перемотки!
    window.toggleVideoPlayPauseV130 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        var vd = window.videoDeckV131 || {};
        if (!vid || !st) return;

        var isRevMode = Boolean(vd.isReversed || window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
        var isActuallyPlaying = (!vid.paused && !vid.ended && vid.readyState >= 2) || isRevMode;
        if (st.userPaused || !isActuallyPlaying) {
            var resumeSec = (st._pausedSeekSecV355 !== undefined && isFinite(st._pausedSeekSecV355))
                ? Number(st._pausedSeekSecV355)
                : (window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (st.remuxBaseOffset || 0));
            var didSeekPaused = Boolean(st._didSeekWhilePausedV355);

            st.userPaused = false;
            st._pausedSeekSecV355 = undefined;
            st._didSeekWhilePausedV355 = false;
            window._vidPlayIntentV132 = true;
            if (typeof window.initVideoDeckAudioV131 === 'function') window.initVideoDeckAudioV131();

            if (isRevMode && typeof window.startImmediateVideoReverseEngineV217 === 'function') {
                var revSpd = Number(vd.speed || window._jennyVideoSpeedV170 || window._lastRevVideoSpeedV217 || 1.0);
                window.startImmediateVideoReverseEngineV217(revSpd, true, resumeSec);
            } else if (vid.error || vid.ended || (st.usingRemux && vid.readyState === 0)) {
                window.seekDeckBAndPlayerSyncedV212(resumeSec, false, true);
            } else {
                if (didSeekPaused) {
                    st._pendingSeekSecV167 = resumeSec;
                    st._pendingSeekTsV167 = performance.now();
                }
                var activeFwdSpd = Number(vd.speed || window._jennyVideoSpeedV170 || 1.0);
                if (activeFwdSpd > 0) {
                    try {
                        vid.defaultPlaybackRate = activeFwdSpd;
                        vid.playbackRate = activeFwdSpd;
                    } catch (e) {}
                }
                window._vidIsBufferingV132 = (vid.readyState < 2);
                vid.play().catch(function(){});
            }
            if (typeof window.syncVideoRamEngineV211 === 'function') window.syncVideoRamEngineV211(false);
        } else {
            var freezeSec = window.getEffectiveVideoCurrentTimeV167
                ? window.getEffectiveVideoCurrentTimeV167(vid)
                : (vid.currentTime || 0);
            st.userPaused = true;
            st._pausedSeekSecV355 = isFinite(freezeSec) ? freezeSec : 0;
            st._didSeekWhilePausedV355 = false;
            window._vidPlayIntentV132 = false;
            window._vidIsBufferingV132 = false;
            st._seekingTorrentWaitUntilV218 = 0;
            if (typeof window.stopHardwareReverseTimerV220 === 'function') window.stopHardwareReverseTimerV220();
            if (vd.revFrameTimer) { clearInterval(vd.revFrameTimer); vd.revFrameTimer = null; }
            if (vd.sourceNode) { try { vd.sourceNode.stop(); } catch (e) {} vd.sourceNode = null; }
            vd.isStudioPlaying = false;
            try { vid.pause(); } catch (e) {}
        }
        window.syncVideoPlayBtnIconV132();
        if (typeof window.syncDeckBPlayBtnIconV216 === 'function') window.syncDeckBPlayBtnIconV216();
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    // Авто-повтор и удержание иконки ⏳ во время докачки куска торрента при перемотке
    setInterval(function() {
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        if (!vid || !st || !st.active) return;

        // Если мыまだ не знаем длительность (или 0:00 — Поток), опрашиваем /api/video/pcm_meta
        var curDur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : 0;
        var rawUrl = st.rawTorStreamUrlV214 || st.currentUrl || '';
        var now = performance.now();

        if (rawUrl && (curDur <= 12.5 || !st.audioStreamsProbedV218) && (!st._lastMetaPollTsV218 || now - st._lastMetaPollTsV218 > 1800)) {
            st._lastMetaPollTsV218 = now;
            fetch('/api/video/pcm_meta?src=' + encodeURIComponent(rawUrl))
                .then(function(r) { return r.ok ? r.json() : null; })
                .then(function(md) {
                    if (!md || !st.active) return;
                    if (md.audio_streams && md.audio_streams >= 1) {
                        st.audioStreamsCountV218 = Number(md.audio_streams);
                        st.audioStreamsProbedV218 = true;
                    }
                    var d = parseFloat(md.duration) || 0;
                    if (d > 12.5) {
                        st.trueDuration = d;
                        st.knownDurationSec = d;
                        window._jennyFullMovieDurationSecV210 = d;
                        var curT = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : 0;
                        if (typeof window.syncInternalVideoSliderUIV212 === 'function') window.syncInternalVideoSliderUIV212(curT, d);
                        if (typeof window.updateProgressUIDeckB === 'function') window.updateProgressUIDeckB(curT, d, false);
                    }
                })
                .catch(function(){});
        }

        // Если пользователь НЕ ставил на паузу, но при перемотке торрента поток ждёт кусок — держим ⏳ и перезапускаем поток каждые 2.4 сек!
        if (!st.userPaused && window._vidPlayIntentV132 && st.torHash && (vid.paused || vid.ended || vid.readyState < 2)) {
            window._vidIsBufferingV132 = true;
            window.syncVideoPlayBtnIconV132();
            if (!st._lastTorSeekRetryTsV218 || now - st._lastTorSeekRetryTsV218 > 2400) {
                st._lastTorSeekRetryTsV218 = now;
                var targetS = st._pendingSeekSecV167 !== undefined ? st._pendingSeekSecV167 : (st.remuxBaseOffset || 0);
                window.seekDeckBAndPlayerSyncedV212(targetS, false);
            }
        }
    }, 800);

    // Ограждаем потоковое торрент-видео от фонового запуска 3-поточного decodeVideoToRamV131,
    // чтобы он не забивал 6 HTTP-сокетов WebView при нескачанном торренте!
    var _origDecodeVidRamV131 = window.decodeVideoToRamV131;
    window.decodeVideoToRamV131 = async function(streamUrl, titleStr) {
        var st = window._vidStateV130 || {};
        if (st.torHash && !st.isReadyLocalV212 && String(streamUrl || '').indexOf('/api/torrent/stream/') !== -1) {
            return null;
        }
        if (typeof _origDecodeVidRamV131 === 'function') {
            return _origDecodeVidRamV131.apply(this, arguments);
        }
        return null;
    };

    setTimeout(function() {
        window.upgradeLogoSvgWithV11UnderPlayerV218();
        window.renderHeaderSourcesHubV91();
        window.renderSourcesSettingsSectionV91();
        window.guardAllSettingsInputsFocusV218();
        window.syncDeckFavButtonsUIV218();
        window.syncEqSlidersToActiveDeckV218();
        window.renderDeckSwitchBannersV131();
        window.loadPersistentUserDataV218();
    }, 250);
})();

/* [split] V219: кусок исходного IIFE (ui_v71.js, строки 24063–25074) → ui_video_decks.js */
;(function() {
    if (window._jennyV219Installed__video_decks) return;
    window._jennyV219Installed__video_decks = true;
    window._jennyV219Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    var VOL_SPEAKER_ON_SVG_V219  = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    var VOL_SPEAKER_MUTE_SVG_V219 = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#f87171" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';

    // -------------------------------------------------------------------------
    // 2. ИСПРАВЛЕНИЕ РЕЖИМА "А" (ТОЛЬКО АУДИО ИЗ ВИДЕО) + ОТОБРАЖЕНИЕ ТЕКУЩЕГО РЕЖИМА НА ВЕРХНЕЙ ПЛАШКЕ
    // -------------------------------------------------------------------------
    window.applyCurrentVideoStreamModeV217 = function(modeStr, showMsg) {
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        var vid = document.getElementById('jennyVideoElV130');
        var root = document.getElementById('jennyVideoStudioRootV130');
        if (!st || !vd || !vid) return;

        st.videoStreamModeV217 = modeStr || 'va';
        var curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
        var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (vid.duration || 0);
        var rawBaseUrl = st.rawTorStreamUrlV214 || st.currentUrl || '';
        var checkStr = String(st.currentTitle || '') + ' ' + String(rawBaseUrl || '');
        var isAvi = /\.(avi|wmv|flv|mpg|mpeg|vob)(\?|$)/i.test(checkStr);
        var tcFlag = isAvi ? '1' : '0';
        var aIdx = st.audioTrackIdxV216 || 0;
        var spd = window._jennyVideoSpeedV170 || vd.speed || window.getBaseSpeedDeckB() || 1.0;

        var badge = window.ensureVideoAudioOnlyBadgeDOMV217();

        if (st.videoStreamModeV217 === 'v_only') {
            if (root) {
                root.classList.remove('audio-only-hidden-v219');
                if (st.active) root.style.display = 'flex';
            }
            if (badge) badge.style.display = 'none';

            if (vd.pieceAbortCtrl) { try { vd.pieceAbortCtrl.abort(); } catch (e) {} vd.pieceAbortCtrl = null; }
            if (vd.sourceNode) {
                vd.sourceNode.onended = null;
                try { vd.sourceNode.stop(); } catch (e) {}
                try { vd.sourceNode.disconnect(); } catch (e) {}
                vd.sourceNode = null;
            }
            vd.studioBuffer = null;
            vd.reversedStudioBuffer = null;
            vd.isStudioPlaying = false;
            vid.muted = true;
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = 0.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = 0.0;

            if (rawBaseUrl) {
                st.usingRemux = true;
                st.remuxBaseOffset = curSec;
                st._pendingSeekSecV167 = curSec;
                st._pendingSeekTsV167 = performance.now();
                vid.src = '/api/video/live_remux?src=' + encodeURIComponent(rawBaseUrl) +
                    '&start=' + curSec.toFixed(2) +
                    '&dur=' + (dur || 0).toFixed(2) +
                    '&no_audio=1&transcode=' + tcFlag + '&t=' + Date.now();
                try { vid.defaultPlaybackRate = spd; vid.playbackRate = spd; } catch (e) {}
                if (!st.userPaused) vid.play().catch(function(){});
            }
            if (showMsg && typeof window.showVideoFeedbackV130 === 'function') {
                window.showVideoFeedbackV130('🎬 Режим «В»: Только видео (аудио выгружено)');
            }
        } else if (st.videoStreamModeV217 === 'a_only') {
            // РЕЖИМ "А" (ТОЛЬКО АУДИО): НЕ ставим display:none на root, а уводим его за экран через класс audio-only-hidden-v219,
            // чтобы Android WebView продолжал непрерывно воспроизводить аудиодорожку через <video> + Jenny DSP!
            if (typeof window.initVideoDeckAudioV131 === 'function') window.initVideoDeckAudioV131();
            if (vd.ctx && vd.ctx.state === 'suspended') {
                try { vd.ctx.resume(); } catch (e) {}
            }
            vid.muted = false;
            st.userPaused = false;
            window._vidPlayIntentV132 = true;
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = st.dspBypass ? 0.0 : 1.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = st.dspBypass ? 1.0 : 0.0;
            if (typeof window.applyVolumeSettingsDeckBV219 === 'function') window.applyVolumeSettingsDeckBV219();

            if (root) {
                root.style.display = 'flex';
                root.classList.add('audio-only-hidden-v219');
            }
            if (window.AndroidBridge && typeof window.AndroidBridge.setVideoFullscreenLock === 'function') {
                try { window.AndroidBridge.setVideoFullscreenLock(false, false); } catch (e) {}
            }

            var isContainerNeedingRemux = /\.(mkv|avi|ts|m2ts|wmv|flv|mpg|mpeg|vob)(\?|$)/i.test(checkStr);
            if (rawBaseUrl && isContainerNeedingRemux) {
                st.usingRemux = true;
                st.remuxBaseOffset = curSec;
                st._pendingSeekSecV167 = curSec;
                st._pendingSeekTsV167 = performance.now();
                vid.src = '/api/video/live_remux?src=' + encodeURIComponent(rawBaseUrl) +
                    '&start=' + curSec.toFixed(2) +
                    '&dur=' + (dur || 0).toFixed(2) +
                    '&aidx=' + aIdx +
                    '&audio_only=1&t=' + Date.now();
                try { vid.defaultPlaybackRate = spd; vid.playbackRate = spd; } catch (e) {}
                var playAudioOnly = function() {
                    if (st.active && st.videoStreamModeV217 === 'a_only' && !st.userPaused) {
                        vid.play().catch(function(){});
                    }
                };
                vid.addEventListener('loadedmetadata', playAudioOnly, { once: true });
                vid.addEventListener('canplay', playAudioOnly, { once: true });
                playAudioOnly();
            } else {
                // Нативный MP4/WebM уже играет напрямую — не перезапускаем FFmpeg live_remux и не сбиваем позицию 52:27!
                try { vid.defaultPlaybackRate = spd; vid.playbackRate = spd; } catch (e) {}
                if (!st.userPaused && vid.paused) {
                    vid.play().catch(function(){});
                }
            }

            if (badge) {
                var tSpan = document.getElementById('jennyVideoAudioOnlyTitleV217');
                if (tSpan) tSpan.innerText = 'А: ' + (st.currentTitle || 'Видео');
                badge.style.display = 'flex';
            }
            if (showMsg && typeof window.showToast === 'function') {
                window.showToast('🎵 Режим «А»: Играет только звук из видео (видеодекодер выгружен)');
            }
        } else {
            // РЕЖИМ "В+А" (ВИДЕО + АУДИО ВМЕСТЕ)
            st.videoStreamModeV217 = 'va';
            if (typeof window.initVideoDeckAudioV131 === 'function') window.initVideoDeckAudioV131();
            vid.muted = false;
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = st.dspBypass ? 0.0 : 1.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = st.dspBypass ? 1.0 : 0.0;
            if (typeof window.applyVolumeSettingsDeckBV219 === 'function') window.applyVolumeSettingsDeckBV219();

            if (badge) badge.style.display = 'none';
            if (root && st.active) {
                root.classList.remove('audio-only-hidden-v219');
                root.style.display = 'flex';
            }
            if (typeof window.syncNativeFullscreenLockV132 === 'function') window.syncNativeFullscreenLockV132();

            if (rawBaseUrl) {
                if (/\.(mkv|avi|ts|m2ts|wmv|flv|mpg|mpeg|vob)(\?|$)/i.test(checkStr) || st.usingRemux) {
                    st.usingRemux = true;
                    st.remuxBaseOffset = curSec;
                    st._pendingSeekSecV167 = curSec;
                    st._pendingSeekTsV167 = performance.now();
                    vid.src = '/api/video/live_remux?src=' + encodeURIComponent(rawBaseUrl) +
                        '&start=' + curSec.toFixed(2) +
                        '&dur=' + (dur || 0).toFixed(2) +
                        '&aidx=' + aIdx +
                        '&transcode=' + tcFlag + '&t=' + Date.now();
                } else {
                    st.usingRemux = false;
                    st.remuxBaseOffset = 0;
                    vid.src = rawBaseUrl;
                    try { vid.currentTime = curSec; } catch (e) {}
                }
                try { vid.defaultPlaybackRate = spd; vid.playbackRate = spd; } catch (e) {}
                if (!st.userPaused) vid.play().catch(function(){});
            }
            if (showMsg && typeof window.showVideoFeedbackV130 === 'function') {
                window.showVideoFeedbackV130('🎬+🎵 Режим «В+А»: Видео + Аудио вместе');
            }
        }
        window.syncVideoPlayerButtonsUIV217();
    };

    // -------------------------------------------------------------------------
    // 3. ГЛАДКИЙ АППАРАТНЫЙ РЕВЕРС ВИДЕО + АУДИО (30/60 FPS БЕЗ СЛАЙД-ШОУ)
    //    И ПРЯМОЕ ПЕРЕКЛЮЧЕНИЕ МЕЖДУ [⏪] И [⏩] В ОДНО КАСАНИЕ БЕЗ СБРОСА НА 1X!
    // -------------------------------------------------------------------------
    window.getNonBaseCustomVideoSpeedZonesV219 = function() {
        var rawZones = window.getCustomVideoSpeedZonesV217 ? window.getCustomVideoSpeedZonesV217() : [1.1, 1.05, 1.5, 0.95, 0.9];
        var baseSpd = window.getBaseSpeedDeckB ? window.getBaseSpeedDeckB() : 1.0;
        var filtered = rawZones.filter(function(z) {
            return Math.abs(Number(z) - baseSpd) >= 0.008;
        });
        return filtered.length > 0 ? filtered : rawZones;
    };

    // Инициализируем дефолтные значения на кнопках [⏪] и [⏩] не равными 1x (например 0.95x и 1.05x из кастомных зон)
    setTimeout(function() {
        var nz = window.getNonBaseCustomVideoSpeedZonesV219();
        if (Math.abs((window._lastFwdVideoSpeedV217 || 1.0) - 1.0) < 0.008) {
            window._lastFwdVideoSpeedV217 = nz[0] || 1.05;
        }
        if (Math.abs((window._lastRevVideoSpeedV217 || 1.0) - 1.0) < 0.008) {
            window._lastRevVideoSpeedV217 = nz[nz.length - 1] || 0.95;
        }
    }, 100);

    // Переопределяем getEffectiveVideoCurrentTimeV167 для точного отсчёта времени назад при аппаратном реверсе
    var _origGetEffVidCurTimeV218 = window.getEffectiveVideoCurrentTimeV167;
    window.getEffectiveVideoCurrentTimeV167 = window.getEffectiveVideoCurrentTimeV210 = function(vid) {
        if (!vid) vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        if (st.active && (vd.isReversed || window.isReversedDeckB) && st._playingHardwareRevStreamV219 && st._revAnchorSecV219 !== undefined) {
            return Math.max(0, Number(st._revAnchorSecV219) - Number(vid ? (vid.currentTime || 0) : 0));
        }
        return _origGetEffVidCurTimeV218 ? _origGetEffVidCurTimeV218.apply(this, arguments) : (vid ? (vid.currentTime || 0) : 0);
    };

    // Кнопка [▶ 1x] (Нормальное воспроизведение — ТОЛЬКО она возвращает скорость на 1x / Base!)
    window.restoreNormalVideoPlaybackV217 = function(ev, customTargetFwdSpeed) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();

        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        if (!vid || !st || !vd) return;

        var wasRev = Boolean(vd.isReversed || window.isReversedDeckB || st._playingHardwareRevStreamV219);
        var curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);

        window.isReversedDeckB = false;
        vd.isReversed = false;
        st._playingHardwareRevStreamV219 = false;
        if (vd.revFrameTimer) {
            clearInterval(vd.revFrameTimer);
            vd.revFrameTimer = null;
        }
        if (vd.sourceNode) {
            vd.sourceNode.onended = null;
            try { vd.sourceNode.stop(); } catch (e) {}
            try { vd.sourceNode.disconnect(); } catch (e) {}
            vd.sourceNode = null;
        }
        vd.isStudioPlaying = false;

        var targetSpd = (customTargetFwdSpeed !== undefined && isFinite(customTargetFwdSpeed))
            ? Number(customTargetFwdSpeed)
            : (window.getBaseSpeedDeckB ? window.getBaseSpeedDeckB() : 1.0);

        window._jennyVideoSpeedV170 = targetSpd;
        vd.speed = targetSpd;

        if (customTargetFwdSpeed === undefined) {
            if (window.scrubStateDeckB) {
                window.scrubStateDeckB.active = false;
                window.scrubStateDeckB.locked = false;
                window.scrubStateDeckB.side = null;
                window.scrubStateDeckB.isPhysicallyReversed = false;
            }
            window.persistedPlaybackSpeedDeckB = null;
            window.persistedPlaybackSideDeckB = 'right';
            var lockEl = document.getElementById('speedLockIndicatorDeckB');
            if (lockEl) lockEl.style.display = 'none';
        }

        try {
            vid.preservesPitch = true;
            vid.webkitPreservesPitch = true;
            vid.defaultPlaybackRate = targetSpd;
            vid.playbackRate = targetSpd;
        } catch (e) {}

        // Перезапускаем прямой поток с текущей секунды ТОЛЬКО если реально выходили из аппаратного реверс-потока и видео НЕ на паузе!
        if (wasRev && !st.userPaused) {
            window.seekDeckBAndPlayerSyncedV212(curSec, false);
        } else if (!st.userPaused && vid.paused) {
            st._internalRevPause = false;
            vid.play().catch(function(){});
        }

        if (typeof window.syncVideoRamEngineV211 === 'function') window.syncVideoRamEngineV211(false);
        window.syncVideoPlayerButtonsUIV217();
        if (ev && customTargetFwdSpeed === undefined && typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130('▶ Нормальное воспроизведение: ' + targetSpd + 'x');
        }
        if (ev && typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    // Правая кнопка скорости ВПЕРЁД (#v130BtnSpeed):
    // Если сейчас были в Реверсе (⏪) или на обычной 1x (▶) — ПЕРВОЕ нажатие сразу включает скорость, написанную на кнопке ⏩ (без захода на 1x)!
    // Если уже играли на ⏩ — переключает на следующую кастомную зону (пропуская 1x)!
    window.cycleVideoSpeedV130 = window.cycleVideoSpeedV131 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();

        var vd = window.videoDeckV131 || {};
        var zones = window.getNonBaseCustomVideoSpeedZonesV219();
        var baseSpd = window.getBaseSpeedDeckB ? window.getBaseSpeedDeckB() : 1.0;
        var wasRev = Boolean(vd.isReversed || window.isReversedDeckB);
        var cur = Number(window._jennyVideoSpeedV170 || vd.speed || baseSpd);
        var isCurrentlyAtBase = (!wasRev && Math.abs(cur - baseSpd) < 0.008);

        var nextSpd = window._lastFwdVideoSpeedV217 || zones[0] || 1.05;
        if (Math.abs(nextSpd - baseSpd) < 0.008) nextSpd = zones[0] || 1.05;

        if (wasRev) {
            // Переход с [⏪] на [⏩]: сразу включаем отображаемую на [⏩] скорость вперёд БЕЗ сброса на 1x!
            window.restoreNormalVideoPlaybackV217(null, nextSpd);
        } else if (isCurrentlyAtBase) {
            // Переход с [▶ 1x] на [⏩]: сразу включаем отображаемую на [⏩] кастомную скорость!
            window.setVideoDeckSpeedV170(nextSpd, false);
        } else {
            // Уже находимся на [⏩]: циклически переключаем по кастомным зонам (кроме 1x)
            var idx = -1;
            for (var i = 0; i < zones.length; i++) {
                if (Math.abs(zones[i] - cur) < 0.008) { idx = i; break; }
            }
            nextSpd = zones[(idx + 1) % zones.length];
            window._lastFwdVideoSpeedV217 = nextSpd;
            window.setVideoDeckSpeedV170(nextSpd, false);
        }

        window._lastFwdVideoSpeedV217 = nextSpd;
        if (window.scrubStateDeckB) {
            window.scrubStateDeckB.locked = true;
            window.scrubStateDeckB.side = 'right';
            window.scrubStateDeckB.speed = nextSpd;
            window.scrubStateDeckB.isPhysicallyReversed = false;
        }
        window.persistedPlaybackSpeedDeckB = nextSpd;
        window.persistedPlaybackSideDeckB = 'right';

        window.syncVideoPlayerButtonsUIV217();
        if (typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130('⏩ Скорость вперёд: ' + nextSpd + 'x');
        }
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    window._savedPreMuteVolStepDeckAV219 = parseFloat(localStorage.getItem('jenny_premute_a_v219') || '10') || 10;
    window._savedPreMuteVolStepDeckBV219 = parseFloat(localStorage.getItem('jenny_premute_b_v219') || '10') || 10;

    // Гарантируем, что внутри #volumePopup (Дека А) и #volumePopupDeckBV216 (Дека Б) снизу есть кнопка заглушения (Mute 0%)
    window.ensureMuteButtonsInVolumePopupsV219 = function() {
        var popA = document.getElementById('volumePopup');
        if (popA && !document.getElementById('btnMutePopupDeckAV219')) {
            var mBtnA = document.createElement('button');
            mBtnA.type = 'button';
            mBtnA.id = 'btnMutePopupDeckAV219';
            mBtnA.className = 'jenny-vol-mute-btn-v219';
            mBtnA.title = 'Заглушить в 0% / Вернуть громкость (Дека А)';
            mBtnA.onclick = function(ev) { window.toggleMuteDeckAV219(ev); };
            popA.appendChild(mBtnA);
        }

        var popB = document.getElementById('volumePopupDeckBV216');
        if (popB && !document.getElementById('btnMutePopupDeckBV219')) {
            var mBtnB = document.createElement('button');
            mBtnB.type = 'button';
            mBtnB.id = 'btnMutePopupDeckBV219';
            mBtnB.className = 'jenny-vol-mute-btn-v219';
            mBtnB.title = 'Заглушить в 0% / Вернуть громкость (Дека Б)';
            mBtnB.onclick = function(ev) { window.toggleMuteDeckBV219(ev); };
            popB.appendChild(mBtnB);
        }
    };

    window.toggleMuteDeckAV219 = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var volBar = document.getElementById('volumeBar');
        if (!volBar) return;
        var cur = parseFloat(volBar.value) || 0;
        if (cur > 0) {
            window._savedPreMuteVolStepDeckAV219 = cur;
            try { localStorage.setItem('jenny_premute_a_v219', String(cur)); } catch (e) {}
            volBar.value = '0';
        } else {
            var restore = window._savedPreMuteVolStepDeckAV219 > 0 ? window._savedPreMuteVolStepDeckAV219 : 10;
            volBar.value = String(restore);
        }
        window.changeVolume();
    };

    // Громкость Деки Б (Видео) по полной аналогии с Декой А — с учётом Овердрайва Деки Б (boosterEnabled + boosterPower)!
    window.applyVolumeSettingsDeckBV219 = function() {
        window.ensureMuteButtonsInVolumePopupsV219();
        var vd = window.videoDeckV131;
        var cfgB = (vd && vd.config) || {};
        if (cfgB.boosterEnabled === undefined) cfgB.boosterEnabled = true;
        if (cfgB.boosterPower === undefined) cfgB.boosterPower = 5;

        var maxScaleB = cfgB.boosterEnabled ? (10 + (parseInt(cfgB.boosterPower, 10) || 5)) : 10;
        var barB = document.getElementById('volumeBarDeckBV216');
        var savedStepB = (cfgB.defaultVolume !== undefined)
            ? parseFloat(cfgB.defaultVolume)
            : (Math.round((window._deckBVolumePercentV216 || 100) / 10));
        if (isNaN(savedStepB)) savedStepB = 10;
        if (savedStepB > maxScaleB) savedStepB = maxScaleB;

        if (barB) {
            barB.max = String(maxScaleB);
            barB.value = String(savedStepB);
        }
        window.applyDeckBVolumeV216(savedStepB * 10);
    };

    window.applyDeckBVolumeV216 = function(pctVal) {
        window.ensureMuteButtonsInVolumePopupsV219();
        var vd = window.videoDeckV131;
        var cfgB = (vd && vd.config) || {};
        if (cfgB.boosterEnabled === undefined) cfgB.boosterEnabled = true;
        if (cfgB.boosterPower === undefined) cfgB.boosterPower = 5;

        var maxScaleB = cfgB.boosterEnabled ? (10 + (parseInt(cfgB.boosterPower, 10) || 5)) : 10;
        var maxPctB = maxScaleB * 10;

        var pct = Math.max(0, Math.min(maxPctB, Math.round(Number(pctVal) || 0)));
        var stepVal = pct / 10.0;
        window._deckBVolumePercentV216 = pct;
        cfgB.defaultVolume = stepVal;
        try { localStorage.setItem('jenny_deckb_vol_pct_v216', String(pct)); } catch (e) {}
        if (typeof window.saveVideoConfigV131 === 'function') window.saveVideoConfigV131();

        if (stepVal > 0) {
            window._savedPreMuteVolStepDeckBV219 = stepVal;
            try { localStorage.setItem('jenny_premute_b_v219', String(stepVal)); } catch (e) {}
        }

        var barB = document.getElementById('volumeBarDeckBV216');
        if (barB) {
            barB.max = String(maxScaleB);
            if (Math.abs(parseFloat(barB.value) - stepVal) > 0.05) {
                barB.value = String(stepVal);
            }
        }

        var lblB = document.getElementById('volIconTextDeckBV216');
        if (lblB) {
            if (pct === 0) {
                lblB.innerHTML = '🔇 0%';
                lblB.style.color = '#f87171';
            } else if (pct > 100) {
                lblB.innerHTML = '🔥 ' + pct + '%';
                lblB.style.color = '#ff7b72';
            } else {
                lblB.innerHTML = pct + '%';
                lblB.style.color = '#60a5fa';
            }
        }

        var trigB = document.getElementById('volIconTriggerDeckBV216');
        if (trigB) {
            trigB.innerHTML = (pct === 0) ? VOL_SPEAKER_MUTE_SVG_V219 : VOL_SPEAKER_ON_SVG_V219;
        }
        var muteBtnB = document.getElementById('btnMutePopupDeckBV219');
        if (muteBtnB) {
            muteBtnB.innerHTML = (pct === 0) ? VOL_SPEAKER_MUTE_SVG_V219 : VOL_SPEAKER_ON_SVG_V219;
            muteBtnB.style.background = (pct === 0) ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.18)';
            muteBtnB.style.border = '1px solid ' + ((pct === 0) ? '#f87171' : 'rgba(59,130,246,0.55)');
            muteBtnB.style.color = (pct === 0) ? '#f87171' : '#60a5fa';
        }

        var gainVal = pct / 100.0;
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130 || {};
        if (vid) {
            try { vid.volume = (pct === 0) ? 0.0 : Math.max(0.0, Math.min(1.0, gainVal)); } catch (e) {}
        }
        if (vd) {
            if (vd.gainNode && vd.gainNode.gain) {
                vd.gainNode.gain.value = gainVal;
            }
            if (vd.directBypassGain && vd.directBypassGain.gain) {
                vd.directBypassGain.gain.value = st.dspBypass ? gainVal : 0.0;
            }
            if (vd.htmlGain && vd.htmlGain.gain && st.videoStreamModeV217 !== 'v_only') {
                vd.htmlGain.gain.value = st.dspBypass ? 0.0 : (pct === 0 ? 0.0 : 1.0);
            }
        }
    };

    window.toggleMuteDeckBV219 = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var curPct = window._deckBVolumePercentV216 || 0;
        if (curPct > 0) {
            window._savedPreMuteVolStepDeckBV219 = curPct / 10.0;
            try { localStorage.setItem('jenny_premute_b_v219', String(window._savedPreMuteVolStepDeckBV219)); } catch (e) {}
            window.applyDeckBVolumeV216(0);
        } else {
            var restoreStep = window._savedPreMuteVolStepDeckBV219 > 0 ? window._savedPreMuteVolStepDeckBV219 : 10;
            window.applyDeckBVolumeV216(restoreStep * 10);
        }
    };

    var _origBuildVideoAudioGraphV131 = window.buildVideoAudioGraphV131;
    if (typeof _origBuildVideoAudioGraphV131 === 'function') {
        window.buildVideoAudioGraphV131 = function() {
            var r = _origBuildVideoAudioGraphV131.apply(this, arguments);
            window.applyVolumeSettingsDeckBV219();
            return r;
        };
    }

    // -------------------------------------------------------------------------
    // 5. КАПСУЛА НАЗВАНИЯ В МИНИ-ПЛЕЕРЕ (РАЗВЕРНУТЬ НА ВСЁ НАЗВАНИЕ В 2 СТРОКИ + КРЕСТИК В УГЛУ)
    //    И ПОРЯДОК КНОПОК В 2 РЯДА В ОСНОВНОМ ПЛЕЕРЕ
    // -------------------------------------------------------------------------
    var _origSyncVidBtnsV218 = window.syncVideoPlayerButtonsUIV217;
    window.syncVideoPlayerButtonsUIV217 = function() {
        if (typeof _origSyncVidBtnsV218 === 'function') {
            _origSyncVidBtnsV218.apply(this, arguments);
        }
        var root = document.getElementById('jennyVideoStudioRootV130');
        if (!root) return;

        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        var vid = document.getElementById('jennyVideoElV130');
        var glC = document.getElementById('jv166InterpCanvas');
        var svgs = window.VID_SVGS_V217 || {};
        var isCompact = window.isVideoCompactPipOrMiniV218 ? window.isVideoCompactPipOrMiniV218() : Boolean(st.pipMode);

        // Запрещаем чёрный квадрат #jv166InterpCanvas поверх видео на паузе или в мини-плеере!
        if (glC && (isCompact || !vid || vid.paused || !window._jennyExp120HzEnabledV205)) {
            glC.style.setProperty('display', 'none', 'important');
        }
        if (vid && st.videoStreamModeV217 !== 'a_only') {
            vid.style.setProperty('display', 'block', 'important');
            vid.style.setProperty('visibility', 'visible', 'important');
            vid.style.setProperty('opacity', '1', 'important');
        }

        // Полностью прячем кнопку скачивания ⬇️ (#v130BtnSaveVideo)
        var saveBtn = document.getElementById('v130BtnSaveVideo');
        if (saveBtn) saveBtn.style.setProperty('display', 'none', 'important');

        // В мини-плеере и на рабочем столе (isCompact):
        // Оборачиваем ВСЁ название видео внутрь капсулы #v130BtnPipToggle ("Развернуть"), чтобы тап по названию разворачивал плеер!
        var btnPip = document.getElementById('v130BtnPipToggle');
        if (btnPip) {
            if (isCompact) {
                var titleText = String(st.currentTitle || 'Развернуть видео').trim();
                btnPip.innerHTML = (svgs.fullOn || '') + '<span>' + titleText + '</span>';
                btnPip.title = 'Нажми на название, чтобы развернуть плеер';
            } else {
                btnPip.innerHTML = (svgs.pip || '') + '<span>Мини</span>';
                btnPip.title = 'Свернуть в мини-плеер';
            }
        }

        // Обновляем отображение скоростей на кнопках [⏪], [▶ 1x], [⏩] (чтобы на [⏪] и [⏩] всегда были актуальные не-1x скорости из зон)
        var zones = window.getNonBaseCustomVideoSpeedZonesV219();
        var baseSpd = window.getBaseSpeedDeckB ? window.getBaseSpeedDeckB() : 1.0;
        var isRev = Boolean(vd.isReversed || window.isReversedDeckB);
        var curSpd = Number(vd.speed || window._jennyVideoSpeedV170 || baseSpd);

        var btnRev = document.getElementById('v131BtnVideoRev');
        if (btnRev) {
            var dispRev = isRev ? curSpd : (window._lastRevVideoSpeedV217 || zones[zones.length - 1] || 0.95);
            btnRev.classList.toggle('v130-btn-active-v217', isRev);
            btnRev.innerHTML = (svgs.rev || '') + '<span>' + dispRev + 'x</span>';
        }

        var btnNorm = document.getElementById('v130BtnNormSpeed');
        if (btnNorm) {
            var isAtNormalFwd = (!isRev && Math.abs(curSpd - baseSpd) < 0.008);
            btnNorm.classList.toggle('v130-btn-active-v217', isAtNormalFwd);
            btnNorm.innerHTML = (svgs.norm || '') + '<span>' + baseSpd + 'x</span>';
        }

        var btnSpd = document.getElementById('v130BtnSpeed');
        if (btnSpd) {
            var isCustomFwdActive = (!isRev && Math.abs(curSpd - baseSpd) >= 0.008);
            var dispFwd = isCustomFwdActive ? curSpd : (window._lastFwdVideoSpeedV217 || zones[0] || 1.05);
            btnSpd.classList.toggle('v130-btn-active-v217', isCustomFwdActive);
            btnSpd.innerHTML = (svgs.fwd || '') + '<span>' + dispFwd + 'x</span>';
        }

        // Выстраиваем аккуратный порядок кнопок в 2 ряда в #v135BottomToolsRow (для основного плеера):
        // Ряд 1: [⏪ 0.95x] [▶ 1x] [⏩ 1.05x] [🎧 DSP]
        // Ряд 2: [🔒 Замок] [🔄 90°] [📐 Вписать] [🔊 Дор. #1]
        var btmRow = document.getElementById('v135BottomToolsRow');
        if (btmRow && !btmRow._v219Ordered) {
            btmRow._v219Ordered = true;
            var orderedIds = [
                'v131BtnVideoRev', 'v130BtnNormSpeed', 'v130BtnSpeed', 'v130BtnDsp',
                'v132BtnLock', 'v130BtnRotate', 'v130BtnFit', 'v130BtnRemux'
            ];
            orderedIds.forEach(function(id) {
                var el = document.getElementById(id);
                if (el && el.parentElement === btmRow) {
                    btmRow.appendChild(el);
                }
            });
        }
    };

    setInterval(function() {
        window.ensureMuteButtonsInVolumePopupsV219();
        var vid = document.getElementById('jennyVideoElV130');
        var glC = document.getElementById('jv166InterpCanvas');
        var isCompact = window.isVideoCompactPipOrMiniV218 ? window.isVideoCompactPipOrMiniV218() : false;
        if (glC && (isCompact || !vid || vid.paused || !window._jennyExp120HzEnabledV205)) {
            glC.style.setProperty('display', 'none', 'important');
        }
    }, 450);

    setTimeout(function() {
        window.ensureMuteButtonsInVolumePopupsV219();
        window.applyVolumeSettings();
        window.applyVolumeSettingsDeckBV219();
        window.syncVideoPlayerButtonsUIV217();
    }, 300);
})();

/* [split] V221: кусок исходного IIFE (ui_v71.js, строки 25084–26033) → ui_video_decks.js */
;(function() {
    if (window._jennyV221Installed__video_decks) return;
    window._jennyV221Installed__video_decks = true;
    window._jennyV221Installed = true;

    // -------------------------------------------------------------------------
    // 2. СБРОС ИНЛАЙНОВЫХ РАЗМЕРОВ МИНИ-ПЛЕЕРА ПРИ ПЕРЕХОДЕ В ПОЛНЫЙ ЭКРАН ИЛИ НА РАБОЧИЙ СТОЛ (71535.mp4)
    // -------------------------------------------------------------------------
    window.clearRootInlinePipGeometryV221 = function() {
        var root = document.getElementById('jennyVideoStudioRootV130');
        if (!root) return;
        root.style.removeProperty('width');
        root.style.removeProperty('height');
        root.style.removeProperty('min-width');
        root.style.removeProperty('min-height');
        root.style.removeProperty('max-width');
        root.style.removeProperty('max-height');
        root.style.left = '0';
        root.style.top = '0';
        root.style.right = '0';
        root.style.bottom = '0';
    };

    window.applyInAppPipGeometryV221 = function() {
        var root = document.getElementById('jennyVideoStudioRootV130');
        var st = window._vidStateV130 || {};
        if (!root || !st.pipMode || st.desktopOverlay) return;
        var ratio = window.getVideoAspectRatioV220();
        var w = st._savedPipWidthV221 || 280;
        var h = Math.max(105, Math.round(w / ratio));
        root.style.setProperty('width', w + 'px', 'important');
        root.style.setProperty('height', h + 'px', 'important');
        root.style.right = 'auto';
        root.style.bottom = 'auto';
        if (!root._hasCustomPipPosV130) {
            root.style.left = Math.max(8, (window.innerWidth || 360) - w - 10) + 'px';
            root.style.top = '74px';
        }
    };

    // Исправляем syncExactRot90DimensionsV217:
    // В режиме компактного окна (Мини или Рабочий стол) принудительно ставим object-fit: cover,
    // чтобы видео заполняло 100% плавающего окна без чёрных полей!
    var _origSyncRot90V218 = window.syncExactRot90DimensionsV217;
    window.syncExactRot90DimensionsV217 = function() {
        if (window.isAnySettingsInputFocusedV218 && window.isAnySettingsInputFocusedV218()) return;
        var root = document.getElementById('jennyVideoStudioRootV130');
        var stage = document.getElementById('jennyVideoStageV130');
        var vid = document.getElementById('jennyVideoElV130');
        var glC = document.getElementById('jv166InterpCanvas');
        var st = window._vidStateV130 || {};
        if (!stage) return;

        var isCompact = Boolean(st.pipMode || st.desktopOverlay);
        if (!st.pipMode || st.desktopOverlay) {
            window.clearRootInlinePipGeometryV221();
        }
        document.body.classList.toggle('jenny-desktop-overlay-active-v221', Boolean(st.active && st.desktopOverlay));

        if (st.rotated90 && !isCompact) {
            stage.classList.add('rot90-v130');
            var w = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0, 320);
            var h = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0, 480);
            stage.style.setProperty('width', h + 'px', 'important');
            stage.style.setProperty('height', w + 'px', 'important');
        } else {
            stage.classList.remove('rot90-v130');
            stage.style.removeProperty('width');
            stage.style.removeProperty('height');
        }

        if (vid) {
            var enabledFits = window.getEnabledVideoFitModesV217 ? window.getEnabledVideoFitModesV217() : ['contain', 'cover', 'fill'];
            if (enabledFits.indexOf(st.fitMode) === -1) {
                st.fitMode = enabledFits[0];
            }
            var fitVal = isCompact ? 'cover' : (st.fitMode || 'contain');
            vid.style.setProperty('object-fit', fitVal, 'important');
            vid.style.setProperty('width', '100%', 'important');
            vid.style.setProperty('height', '100%', 'important');
            vid.style.setProperty('max-width', 'none', 'important');
            vid.style.setProperty('max-height', 'none', 'important');
            if (glC) {
                glC.style.setProperty('object-fit', fitVal, 'important');
                glC.style.setProperty('width', '100%', 'important');
                glC.style.setProperty('height', '100%', 'important');
                glC.style.setProperty('max-width', 'none', 'important');
                glC.style.setProperty('max-height', 'none', 'important');
            }
        }
    };

    // Кнопка "⛶ Полный" (#v132BtnFullscreen) в основном плеере:
    // Включает системный полноэкранный режим И автоматически разворачивает горизонтальное видео на 90° во весь экран!
    window.toggleVideoNativeFullscreenV132 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._vidStateV130;
        if (!st) return;
        if (st.desktopOverlay && typeof window.exitDesktopOverlayModeV132 === 'function') {
            window.exitDesktopOverlayModeV132(true);
        }
        if (st.pipMode && typeof window.toggleVideoPipModeV130 === 'function') {
            window.toggleVideoPipModeV130();
        }
        st.nativeFullscreen = !st.nativeFullscreen;

        var aspect = window.getVideoAspectRatioV220 ? window.getVideoAspectRatioV220() : (16.0 / 9.0);
        if (aspect >= 1.05) {
            st.rotated90 = Boolean(st.nativeFullscreen);
        }

        if (typeof window.syncNativeFullscreenLockV132 === 'function') window.syncNativeFullscreenLockV132();
        window.syncExactRot90DimensionsV217();
        window.syncVideoPlayerButtonsUIV217();
        if (typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130(st.nativeFullscreen ? '⛶ Полный экран ВКЛ' : '🗗 Обычный экран');
        }
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    // Перехватываем toggleVideoPipModeV130, чтобы при выходе из Мини в Полный плеер сбрасывались инлайновые width/height!
    var _origToggleVideoPipModeV221 = window.toggleVideoPipModeV130;
    window.toggleVideoPipModeV130 = function(ev) {
        var r = (typeof _origToggleVideoPipModeV221 === 'function')
            ? _origToggleVideoPipModeV221.apply(this, arguments)
            : undefined;
        var st = window._vidStateV130 || {};
        if (st.pipMode && !st.desktopOverlay) {
            window.applyInAppPipGeometryV221();
        } else {
            window.clearRootInlinePipGeometryV221();
        }
        window.syncExactRot90DimensionsV217();
        window.syncVideoPlayerButtonsUIV217();
        return r;
    };

    window.captureAndHoldVideoFrameV220 = function(maxHoldMs) {
        try {
            var vid = document.getElementById('jennyVideoElV130');
            var st = window._vidStateV130 || {};
            if (!vid || !st.active || st.videoStreamModeV217 === 'a_only') return;
            if (vid.readyState < 2 || !vid.videoWidth || !vid.videoHeight) return;

            var c = window.ensureSeamlessFrameHoldCanvasV220();
            if (!c) return;
            var w = Math.min(960, vid.videoWidth);
            var h = Math.max(1, Math.round(w * (vid.videoHeight / vid.videoWidth)));
            if (c.width !== w) c.width = w;
            if (c.height !== h) c.height = h;

            var ctx = c.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(vid, 0, 0, w, h);

            var isCompact = Boolean(st.pipMode || st.desktopOverlay);
            c.style.objectFit = isCompact ? 'cover' : (st.fitMode || 'contain');
            c.style.display = 'block';

            if (c._hideTimerV220) clearTimeout(c._hideTimerV220);
            c._hideTimerV220 = setTimeout(function() {
                c.style.display = 'none';
            }, maxHoldMs || 2800);
        } catch (e) {}
    };

    window.releaseHeldVideoFrameV220 = function() {
        var c = document.getElementById('jennySeamlessFrameHoldCanvasV220');
        if (c) {
            if (c._hideTimerV220) {
                clearTimeout(c._hideTimerV220);
                c._hideTimerV220 = null;
            }
            c.style.display = 'none';
        }
    };

    // -------------------------------------------------------------------------
    // 4. СИНХРОНИЗАЦИЯ ПРОПОРЦИЙ ВИДЕО С ANDROID WINDOWMANAGER И МИНИ-ПЛЕЕРОМ (71530.mp4 & 71535.mp4)
    // -------------------------------------------------------------------------
    window.getVideoAspectRatioV220 = function() {
        var vid = document.getElementById('jennyVideoElV130');
        if (vid && vid.videoWidth > 0 && vid.videoHeight > 0) {
            var r = vid.videoWidth / vid.videoHeight;
            if (r > 0.35 && r < 3.6) return r;
        }
        var st = window._vidStateV130 || {};
        if (st._lastKnownAspectV220 && st._lastKnownAspectV220 > 0.35 && st._lastKnownAspectV220 < 3.6) {
            return st._lastKnownAspectV220;
        }
        return 16.0 / 9.0;
    };

    window.syncNativeVideoAspectRatioV220 = function() {
        var st = window._vidStateV130 || {};
        var ratio = window.getVideoAspectRatioV220();
        st._lastKnownAspectV220 = ratio;
        if (window.AndroidBridge && typeof window.AndroidBridge.setVideoAspectRatio === 'function') {
            try { window.AndroidBridge.setVideoAspectRatio(ratio); } catch (e) {}
        }
        var root = document.getElementById('jennyVideoStudioRootV130');
        if (!root) return;
        if (st.desktopOverlay || !st.pipMode) {
            // В режиме рабочего стола или полного плеера НИКОГДА не ставим пиксельные width/height на root!
            window.clearRootInlinePipGeometryV221();
        } else if (st.active && st.pipMode && !st.desktopOverlay) {
            var curW = parseFloat(root.style.width) || st._savedPipWidthV221 || 280;
            var targetH = Math.max(105, Math.round(curW / ratio));
            root.style.setProperty('width', curW + 'px', 'important');
            root.style.setProperty('height', targetH + 'px', 'important');
        }
    };

    window.clampPipVideoInsideScreenV145 = function() {
        var root = document.getElementById('jennyVideoStudioRootV130');
        var st = window._vidStateV130;
        if (!root || !st || !st.active) return;
        if (st.desktopOverlay || !st.pipMode) {
            window.clearRootInlinePipGeometryV221();
            return;
        }
        var r = root.getBoundingClientRect();
        var W = window.innerWidth || 360;
        var H = window.innerHeight || 740;
        var minVis = 80;
        var minL = (r.width > W - 8) ? (minVis - r.width) : 4;
        var maxL = (r.width > W - 8) ? (W - minVis) : Math.max(4, W - r.width - 4);
        var minT = 4;
        var maxT = Math.max(4, H - Math.min(r.height, 140) - 4);

        var curL = r.left;
        var curT = r.top;
        if (curL < minL || curL > maxL) {
            root.style.left = Math.max(minL, Math.min(maxL, curL)) + 'px';
        }
        if (curT < minT || curT > maxT) {
            root.style.top = Math.max(minT, Math.min(maxT, curT)) + 'px';
        }
    };

    window.bindAspectLockedPipPinchV220 = function() {
        var root = document.getElementById('jennyVideoStudioRootV130');
        var stage = document.getElementById('jennyVideoStageV130');
        if (!root || !stage || stage._v221AspectPinchBound) return;
        stage._v221AspectPinchBound = true;

        stage.addEventListener('touchmove', function(e) {
            var st = window._vidStateV130 || {};
            if (!st.active || !st.pipMode || st.desktopOverlay || st.isLocked) return;
            if (e.touches && e.touches.length >= 2) {
                var ratio = window.getVideoAspectRatioV220();
                var curW = Math.max(160, parseFloat(root.style.width) || root.getBoundingClientRect().width || 280);
                var lockedH = Math.max(96, Math.round(curW / ratio));
                st._savedPipWidthV221 = curW;
                root.style.setProperty('width', curW + 'px', 'important');
                root.style.setProperty('height', lockedH + 'px', 'important');
            }
        }, { passive: true, capture: false });
    };

    // -------------------------------------------------------------------------
    // 5. РЕЖИМ «А» (ТОЛЬКО АУДИО ИЗ ВИДЕО) И ПЕРЕХОДЫ НА РАБОЧИЙ СТОЛ / ОБРАТНО В ПРИЛОЖЕНИЕ (71531.mp4 & 71535.mp4)
    // -------------------------------------------------------------------------
    var _origEnterDesktopOverlayV220 = window.enterDesktopOverlayModeV132;
    window.enterDesktopOverlayModeV132 = function(ev) {
        var st = window._vidStateV130 || {};
        if (st.videoStreamModeV217 === 'a_only') {
            return;
        }
        window.clearRootInlinePipGeometryV221();
        document.body.classList.add('jenny-desktop-overlay-active-v221');
        window.syncNativeVideoAspectRatioV220();
        if (typeof _origEnterDesktopOverlayV220 === 'function') {
            return _origEnterDesktopOverlayV220.apply(this, arguments);
        }
    };

    var _origExitDesktopOverlayV220 = window.exitDesktopOverlayModeV132;
    window.exitDesktopOverlayModeV132 = function(bringToFront, ev) {
        document.body.classList.remove('jenny-desktop-overlay-active-v221');
        window.clearRootInlinePipGeometryV221();
        if (typeof _origExitDesktopOverlayV220 === 'function') {
            return _origExitDesktopOverlayV220.apply(this, arguments);
        }
    };

    var _origOnDesktopOverlayStateChangedV220 = window.onDesktopOverlayStateChangedV133;
    window.onDesktopOverlayStateChangedV133 = function(isOverlay) {
        var st = window._vidStateV130 || {};
        var root = document.getElementById('jennyVideoStudioRootV130');
        if (isOverlay && st.videoStreamModeV217 === 'a_only') {
            document.body.classList.remove('jenny-desktop-overlay-active-v221');
            if (typeof window.exitDesktopOverlayModeV132 === 'function') {
                window.exitDesktopOverlayModeV132(false);
            }
            return;
        }
        document.body.classList.toggle('jenny-desktop-overlay-active-v221', Boolean(isOverlay && st.active));

        if (isOverlay) {
            // На рабочем столе root должен покрывать 100% окна оверлея без инлайновых 280x158px от мини-плеера!
            st.desktopOverlay = true;
            st.pipMode = false;
            st.rotated90 = false;
            window.clearRootInlinePipGeometryV221();
            if (root) {
                root.classList.remove('mode-pip-v130');
                root.classList.add('mode-full-v130', 'mode-desktop-v132');
            }
        } else {
            st.desktopOverlay = false;
            if (root) root.classList.remove('mode-desktop-v132');
        }

        var r = (typeof _origOnDesktopOverlayStateChangedV220 === 'function')
            ? _origOnDesktopOverlayStateChangedV220.apply(this, arguments)
            : undefined;

        if (isOverlay) {
            window.clearRootInlinePipGeometryV221();
        } else if (st.pipMode) {
            window.applyInAppPipGeometryV221();
        } else {
            window.clearRootInlinePipGeometryV221();
        }

        window.syncExactRot90DimensionsV217();
        if (typeof window.syncVideoPlayerButtonsUIV217 === 'function') {
            window.syncVideoPlayerButtonsUIV217();
        }
        return r;
    };

    var _origApplyStreamModeV219 = window.applyCurrentVideoStreamModeV217;
    window.applyCurrentVideoStreamModeV217 = function(modeStr, showMsg) {
        var isAudioOnly = (modeStr === 'a_only');
        if (window.AndroidBridge) {
            try {
                if (typeof window.AndroidBridge.setVideoAudioOnlyMode === 'function') {
                    window.AndroidBridge.setVideoAudioOnlyMode(isAudioOnly);
                }
                if (typeof window.AndroidBridge.setVideoActiveState === 'function') {
                    var stNow = window._vidStateV130 || {};
                    window.AndroidBridge.setVideoActiveState(Boolean(stNow.active && !isAudioOnly));
                }
            } catch (e) {}
        }
        if (isAudioOnly && window._vidStateV130 && window._vidStateV130.desktopOverlay) {
            if (typeof window.exitDesktopOverlayModeV132 === 'function') {
                window.exitDesktopOverlayModeV132(false);
            }
        }
        if (typeof _origApplyStreamModeV219 === 'function') {
            return _origApplyStreamModeV219.apply(this, arguments);
        }
    };

    var _origSyncVideoRamEngineV219 = window.syncVideoRamEngineV211;
    window.syncVideoRamEngineV211 = window.syncVideoRamEngineV131 = function(isDragging) {
        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        // Если включён режим "Только Видео (-an)", глушим звук
        if (st.active && st.videoStreamModeV217 === 'v_only') {
            if (vd.sourceNode) {
                vd.sourceNode.onended = null;
                try { vd.sourceNode.stop(); } catch (e) {}
                try { vd.sourceNode.disconnect(); } catch (e) {}
                vd.sourceNode = null;
            }
            vd.isStudioPlaying = false;
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = 0.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = 0.0;
            return;
        }
        // Если в реверсе Буфер #4 (vd.reversedStudioBuffer) ещё не готов в RAM, временно пропускаем звук из аппаратного реверс-потока
        var isRevNow = Boolean(vd.isReversed || window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
        if (st.active && isRevNow && !vd.reversedStudioBuffer && !vd.studioBuffer) {
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = st.dspBypass ? 0.0 : 1.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = st.dspBypass ? 1.0 : 0.0;
            return;
        }
        if (typeof _origSyncVideoRamEngineV219 === 'function') {
            return _origSyncVideoRamEngineV219.apply(this, arguments);
        }
    };

    var _origRestoreNormalV219 = window.restoreNormalVideoPlaybackV217;
    window.restoreNormalVideoPlaybackV217 = function(ev, customTargetFwdSpeed) {
        window.stopHardwareReverseTimerV220();
        var st = window._vidStateV130 || {};
        st._revTrackSessionIdV220 = (st._revTrackSessionIdV220 || 0) + 1;
        window.captureAndHoldVideoFrameV220(2200);
        if (typeof _origRestoreNormalV219 === 'function') {
            return _origRestoreNormalV219.apply(this, arguments);
        }
    };

    window.switchVideoToFfmpegRemuxV130 = function(ev, forceTranscodeVideo) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        var vd = window.videoDeckV131 || {};
        if (!vid || !st) return;

        var curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
        var totalTracks = Math.max(2, Number(st.audioStreamsCountV218) || 2);

        if (ev) {
            st.audioTrackIdxV216 = ((st.audioTrackIdxV216 || 0) + 1) % totalTracks;
        } else {
            st.audioTrackIdxV216 = st.audioTrackIdxV216 || 0;
        }

        window.captureAndHoldVideoFrameV220(2500);

        var isRev = Boolean(vd.isReversed || window.isReversedDeckB);
        if (isRev) {
            window.startImmediateVideoReverseEngineV217(vd.speed || window._lastRevVideoSpeedV217 || 0.95, true, curSec);
            window.syncVideoPlayerButtonsUIV217();
            if (typeof window.showVideoFeedbackV130 === 'function') {
                window.showVideoFeedbackV130('⏪🔊 Реверс: Дорожка #' + (st.audioTrackIdxV216 + 1));
            }
            if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
            return;
        }

        window.seekDeckBAndPlayerSyncedV212(curSec, false, true);
        window.syncVideoPlayerButtonsUIV217();

        if (typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130('🔊 Переключена аудиодорожка #' + (st.audioTrackIdxV216 + 1));
        }
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    var _origSeekDeckBV218 = window.seekDeckBAndPlayerSyncedV212;
    window.seekDeckBAndPlayerSyncedV212 = function(targetSec, showToastMsg, fromExplicitUser) {
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        var isRev = Boolean(vd.isReversed || window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));

        var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (vid ? (vid.duration || 0) : 0);
        var rawTargetSec = Number(targetSec) || 0;
        var clamped = (isFinite(dur) && dur > 0)
            ? Math.max(0.0, Math.min(Math.max(0.0, dur - 0.2), rawTargetSec))
            : Math.max(0.0, rawTargetSec);

        // [V355] Если видео стоит на паузе — мгновенно двигаем синюю шкалу и кадр превью БЕЗ автозапуска!
        if (st.userPaused) {
            st._pausedSeekSecV355 = clamped;
            st._didSeekWhilePausedV355 = true;
            st._lastTrueMediaSecV227 = clamped;
            st._pendingSeekSecV167 = clamped;
            st._pendingSeekTsV167 = performance.now();
            window.releaseHeldVideoFrameV220();

            if (isRev) {
                if (typeof window.stopHardwareReverseTimerV220 === 'function') window.stopHardwareReverseTimerV220();
                if (typeof window.cleanupRevBlobQueueV223 === 'function') window.cleanupRevBlobQueueV223();
                st._revTrackSessionIdV220 = (st._revTrackSessionIdV220 || 0) + 1;
                st._playingHardwareRevStreamV219 = false;
                st._revStreamStartedPlayingV220 = false;
                st._revAnchorSecV219 = clamped;
            }

            if (typeof window.updateProgressUIDeckB === 'function') {
                window.updateProgressUIDeckB(clamped, dur, isRev);
            }
            if (typeof window.syncInternalVideoSliderUIV212 === 'function') {
                window.syncInternalVideoSliderUIV212(clamped, dur);
            }
            if (showToastMsg === true && !fromExplicitUser && window._v130UserDraggingSeekV212) {
                return;
            }

            if (typeof _origSeekDeckBV218 === 'function') {
                var rawBaseUrl = st.rawTorStreamUrlV214 || st.currentUrl || '';
                var checkStr = String(st.currentTitle || '') + ' ' + String(rawBaseUrl);
                var isRemuxFmt = /\.(mkv|avi|ts|m2ts|wmv|flv|mpg|mpeg|vob)(\?|$)/i.test(checkStr);
                var aIdx = st.audioTrackIdxV216 || 0;
                var sMode = st.videoStreamModeV217 || 'va';
                if (!isRemuxFmt && aIdx === 0 && sMode === 'va' && !st.torHash && rawBaseUrl) {
                    st.usingRemux = false;
                    var curVidSrc = String((vid && vid.src) || '');
                    if (vid && (curVidSrc.indexOf('reverse_remux') !== -1 || curVidSrc.indexOf('live_remux') !== -1 || curVidSrc.indexOf('blob:') === 0)) {
                        vid.src = rawBaseUrl;
                    }
                }
                _origSeekDeckBV218.call(this, clamped, false);
                if (typeof window.updateProgressUIDeckB === 'function') {
                    window.updateProgressUIDeckB(clamped, dur, isRev);
                }
            }
            return;
        }

        if (isRev) {
            // Игнорируем ТОЛЬКО фоновый 800мс таймер докачки торрента (_lastTorSeekRetryTsV218),
            // а любые тапы по полосе Деки Б (#seekZoneDeckB) и ползунку (#v130SeekSlider) выполняем мгновенно!
            if (!fromExplicitUser && Math.abs(performance.now() - (st._lastTorSeekRetryTsV218 || -1e9)) < 40) {
                return;
            }
            st._lastTrueMediaSecV227 = clamped;
            st._pendingSeekSecV167 = clamped;
            st._pendingSeekTsV167 = performance.now();
            if (typeof window.updateProgressUIDeckB === 'function') {
                window.updateProgressUIDeckB(clamped, dur, true);
            }
            if (typeof window.syncInternalVideoSliderUIV212 === 'function') {
                window.syncInternalVideoSliderUIV212(clamped, dur);
            }
            if (showToastMsg === true && !fromExplicitUser && window._v130UserDraggingSeekV212) {
                return;
            }
            // Если точка clamped попадает внутрь ТЕКУЩЕГО уже загруженного в RAM реверс-сегмента —
            // прыгаем внутри него за 0.5 мс без перезапуска FFmpeg!
            if (st._playingHardwareRevStreamV219 && st._revStreamStartedPlayingV220 && vid && !vid.paused && isFinite(vid.duration) && vid.duration > 1.0) {
                var curAnchor = Number(st._revAnchorSecV219 || 0);
                var curWin = Math.min(Number(st._revWinLenV219 || 0), vid.duration);
                var offsetInChunk = curAnchor - clamped;
                if (offsetInChunk >= 0.05 && offsetInChunk <= curWin - 0.25) {
                    try {
                        vid.currentTime = offsetInChunk;
                        return;
                    } catch (e) {}
                }
            }
            var curRevSpd = Number(vd.speed || window._jennyVideoSpeedV170 || window._lastRevVideoSpeedV217 || 1.0);
            window.startImmediateVideoReverseEngineV217(curRevSpd, true, clamped);
            return;
        }

        st._lastTrueMediaSecV227 = clamped;
        window.captureAndHoldVideoFrameV220(1800);
        if (typeof _origSeekDeckBV218 === 'function') {
            var res = _origSeekDeckBV218.call(this, clamped, showToastMsg);
            // Гарантируем сохранение текущей выбранной скорости вперёд (например x1.25 или x1.5) после прыжка по полосе!
            var activeFwdSpd = Number(vd.speed || window._jennyVideoSpeedV170 || 1.0);
            if (vid && activeFwdSpd > 0) {
                try {
                    vid.defaultPlaybackRate = activeFwdSpd;
                    vid.playbackRate = activeFwdSpd;
                } catch (e) {}
            }
            return res;
        }
    };

    document.addEventListener('playing', function(e) {
        if (e && e.target && e.target.id === 'jennyVideoElV130') {
            window.releaseHeldVideoFrameV220();
            window.syncNativeVideoAspectRatioV220();
        }
    }, true);
    document.addEventListener('loadeddata', function(e) {
        if (e && e.target && e.target.id === 'jennyVideoElV130') {
            window.releaseHeldVideoFrameV220();
            window.syncNativeVideoAspectRatioV220();
        }
    }, true);
    document.addEventListener('loadedmetadata', function(e) {
        if (e && e.target && e.target.id === 'jennyVideoElV130') {
            window.syncNativeVideoAspectRatioV220();
        }
    }, true);

    // -------------------------------------------------------------------------
    // 7. ГАРАНТИРОВАННЫЕ 2 РЯДА КНОПОК В ОСНОВНОМ ВИДЕОПЛЕЕРЕ И АККУРАТНЫЕ ПОДПИСИ (71532.mp4)
    // -------------------------------------------------------------------------
    var _origSyncVidBtnsV219 = window.syncVideoPlayerButtonsUIV217;
    window.syncVideoPlayerButtonsUIV217 = function() {
        if (typeof _origSyncVidBtnsV219 === 'function') {
            _origSyncVidBtnsV219.apply(this, arguments);
        }
        var root = document.getElementById('jennyVideoStudioRootV130');
        if (!root) return;

        var st = window._vidStateV130 || {};
        var vc = window._jennyVideoUiCfgV217 || {};
        var svgs = window.VID_SVGS_V217 || {};
        var isCompact = Boolean(st.pipMode || st.desktopOverlay);

        root.classList.toggle('compact-pip-v218', isCompact);
        document.body.classList.toggle('jenny-desktop-overlay-active-v221', Boolean(st.active && st.desktopOverlay));

        window.bindAspectLockedPipPinchV220();
        window.syncNativeVideoAspectRatioV220();
        window.syncExactRot90DimensionsV217();

        var btmRow = document.getElementById('v135BottomToolsRow');
        if (btmRow) {
            var orderedIds = [
                'v131BtnVideoRev', 'v130BtnNormSpeed', 'v130BtnSpeed', 'v130BtnDsp',
                'v132BtnLock', 'v130BtnRotate', 'v130BtnFit', 'v130BtnRemux'
            ];
            orderedIds.forEach(function(id) {
                var el = document.getElementById(id);
                if (el && el.parentElement === btmRow) {
                    btmRow.appendChild(el);
                }
            });

            if (isCompact) {
                btmRow.style.setProperty('display', 'flex', 'important');
                btmRow.style.setProperty('justify-content', 'space-between', 'important');
                btmRow.style.removeProperty('grid-template-columns');
            } else {
                var visCount = 6 + (vc.showRotateBtn !== false ? 1 : 0) + (vc.showFitBtn !== false ? 1 : 0);
                var cols = (visCount <= 6) ? 3 : 4;
                btmRow.style.setProperty('display', 'grid', 'important');
                btmRow.style.setProperty('grid-template-columns', 'repeat(' + cols + ', minmax(0, 1fr))', 'important');
                btmRow.style.setProperty('gap', '6px', 'important');
                btmRow.style.setProperty('width', '100%', 'important');
                btmRow.style.setProperty('overflow', 'visible', 'important');
            }
        }

        var btnRemux = document.getElementById('v130BtnRemux');
        if (btnRemux) {
            var aIdx = (st.audioTrackIdxV216 || 0) + 1;
            btnRemux.classList.toggle('v130-btn-active-v217', Boolean(st.usingRemux));
            btnRemux.innerHTML = (svgs.track || '') + '<span>Дор. #' + aIdx + '</span>';
        }
    };

    setTimeout(function() {
        window.syncVideoPlayerButtonsUIV217();
    }, 350);
})();

/* [split] V223: кусок исходного IIFE (ui_v71.js, строки 26037–26373) → ui_video_decks.js */
;(function() {
    if (window._jennyV223Installed__video_decks) return;
    window._jennyV223Installed__video_decks = true;
    window._jennyV223Installed = true;

    var _prevRestoreNormalV222 = window.restoreNormalVideoPlaybackV217;
    window.restoreNormalVideoPlaybackV217 = function(ev, customTargetFwdSpeed) {
        window.cleanupRevBlobQueueV223();
        if (typeof _prevRestoreNormalV222 === 'function') {
            return _prevRestoreNormalV222.apply(this, arguments);
        }
    };
})();

/* [split] V224: кусок исходного IIFE (ui_v71.js, строки 26380–26627) → ui_video_decks.js */
;(function() {
    if (window._jennyV224Installed__video_decks) return;
    window._jennyV224Installed__video_decks = true;
    window._jennyV224Installed = true;

    // -------------------------------------------------------------------------
    // 2. ЗАПРЕТ САМОПРОИЗВОЛЬНОГО ПОЯВЛЕНИЯ HUD ВИДЕОПЛЕЕРА (#v130HudOverlay)
    //    ПРИ ПОДГРУЗКЕ КУСКОВ РЕВЕРСА И ФОНОВЫХ СОБЫТИЯХ <video> (71547.mp4 00:03-00:27)
    // -------------------------------------------------------------------------
    window._lastTrustedVideoUserInputTsV224 = performance.now();
    window._lastVideoOpenTsV224 = performance.now();

    // Фиксируем только реальные физические касания/клики пользователя внутри #jennyVideoStudioRootV130
    ;['touchstart', 'touchmove', 'touchend', 'mousedown', 'pointerdown', 'input'].forEach(function(evName) {
        window.addEventListener(evName, function(e) {
            if (!e || e.isTrusted === false) return;
            var root = document.getElementById('jennyVideoStudioRootV130');
            if (!root || !root.classList.contains('active')) return;
            if (e.target && root.contains(e.target)) {
                window._lastTrustedVideoUserInputTsV224 = performance.now();
            }
        }, { capture: true, passive: true });
    });

    // Разрешаем показ HUD при первичном открытии видеоплеера или переключении режимов окна пользователем
    ;['openJennyVideoPlayerV130', 'toggleVideoLockModeV132', 'toggleVideoPipModeV130', 'exitDesktopOverlayModeV132'].forEach(function(fnName) {
        var origFn = window[fnName];
        if (typeof origFn === 'function' && !origFn._v224HudWrapped) {
            window[fnName] = function() {
                window._lastVideoOpenTsV224 = performance.now();
                window._lastTrustedVideoUserInputTsV224 = performance.now();
                return origFn.apply(this, arguments);
            };
            window[fnName]._v224HudWrapped = true;
        }
    });

    var _origSetVideoHudHiddenUnifiedV214 = window.setVideoHudHiddenUnifiedV214;
    window.setVideoHudHiddenUnifiedV214 = function(shouldHide, fromTapWake) {
        if (!shouldHide) {
            var now = performance.now();
            var trustedTouchAge = now - (window._lastTrustedVideoUserInputTsV224 || -1e9);
            var videoOpenAge = now - (window._lastVideoOpenTsV224 || -1e9);
            var isTrustedUserWake = Boolean(fromTapWake) || (trustedTouchAge < 480) || (videoOpenAge < 900);
            if (!isTrustedUserWake) {
                // Игнорируем фоновые вызовы wakeVideoHudV130(false) от событий <video> (play, playing, pause)
                // при смене чанков реверса в RAM или фоновом ремуксе!
                return;
            }
        }
        if (typeof _origSetVideoHudHiddenUnifiedV214 === 'function') {
            return _origSetVideoHudHiddenUnifiedV214.call(this, shouldHide, fromTapWake);
        }
    };

    window.wakeVideoHudV130 = function(fromTapWake) {
        if (typeof window.setVideoHudHiddenUnifiedV214 === 'function') {
            window.setVideoHudHiddenUnifiedV214(false, Boolean(fromTapWake));
        }
    };
})();
/* ================= END JENNY_V224_HUD_AND_HEADER_STABILITY_PATCH ================= */

/* ================= JENNY_V227_DECK_B_PARITY_AND_RAM_REVERSE_PATCH (#323 / V228):
   1) BASELINE #318 (V224) PURE IN-RAM BLOB QUEUE REVERSE ENGINE (ZERO SSD/FLASH WRITES, ZERO MSE STALLS)
   2) FIX TIME JUMP (-0:00 -> -0:42 -> -0:29) WHEN STARTING REVERSE OR DRAGGING RADIAL SPEED ARC (71562.mp4 00:08-00:11)
   3) FIX FORWARD/REVERSE STREAM RESTORE SO EXITING REVERSE NEVER KEEPS PLAYING BACKWARDS AUDIO (71562.mp4 00:28-00:58 & 71561.mp4 01:15-02:05)
   4) 1:1 FRONTEND PARITY OF BLUE DECK B PROGRESS BAR & SIDE TIMERS WITH PURPLE DECK A (71561.mp4 00:00-00:44 & 02:23-03:06):
      - Short tap Left Time Block (#leftTimeBlockDeckB) = Reverse at 1.0x (base speed)
      - Short tap Right Time Block (#rightTimeBlockDeckB) = Forward at 1.0x (base speed)
      - Long press Left / Right Time Block = 10x fast seek backwards / forwards
      - Tap anywhere on #seekZoneDeckB = instant seek in ALL modes (1x fwd, x1.5 fwd, 1x rev, x1.5 rev) preserving current direction & speed
      - Hold Center of #seekZoneDeckB = reset to normal forward 1.0x ("✅ Норм: x1")
      - Hold/Pull down Left or Right third of #seekZoneDeckB = radial speed arc for Reverse (⏪) or Forward (⏩) with lock indicator 🔒
================= */
/* [split] V227: кусок исходного IIFE (ui_v71.js, строки 26642–27952) → ui_video_decks.js */
;(function() {
    if (window._jennyV227Installed__video_decks) return;
    window._jennyV227Installed__video_decks = true;
    window._jennyV227Installed = true;

    // 1. Точное вычисление текущего времени видео БЕЗ ложного вычитания старого vid.currentTime
    //    в момент, когда новый реверс-поток ещё открывается (!st._revStreamStartedPlayingV220)!
    //    Это полностью устраняет скачки таймера вида 0:42 -> -0:00 -> -0:42 -> -0:29!
    window.getEffectiveVideoCurrentTimeV167 = window.getEffectiveVideoCurrentTimeV210 = function(vid) {
        if (!vid) vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        var isRev = Boolean(vd.isReversed || window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));

        if (!st.userPaused && st._pausedSeekSecV355 !== undefined) {
            st._pausedSeekSecV355 = undefined;
            st._didSeekWhilePausedV355 = false;
        }
        if (st.active && st.userPaused && st._pausedSeekSecV355 !== undefined && isFinite(st._pausedSeekSecV355)) {
            st._lastTrueMediaSecV227 = Number(st._pausedSeekSecV355);
            return Number(st._pausedSeekSecV355);
        }

        if (st.active && isRev && st._playingHardwareRevStreamV219 && st._revAnchorSecV219 !== undefined) {
            if (!st._revStreamStartedPlayingV220) {
                return Math.max(0, Number(st._revAnchorSecV219));
            }
            var progressed = (vid && isFinite(vid.currentTime)) ? Math.max(0, vid.currentTime) : 0;
            var eff = Math.max(0, Number(st._revAnchorSecV219) - progressed);
            st._lastTrueMediaSecV227 = eff;
            return eff;
        }

        if (st._pendingSeekSecV167 !== undefined) {
            var dt = performance.now() - (st._pendingSeekTsV167 || 0);
            if (dt < 2400 || window._vidIsBufferingV132 || !vid || vid.readyState < 2) {
                return st._pendingSeekSecV167;
            }
            st._pendingSeekSecV167 = undefined;
        }

        var rawCur = (vid && isFinite(vid.currentTime)) ? vid.currentTime : 0;
        var totalCur = rawCur + (st.remuxBaseOffset || 0);
        if (st.active && isFinite(totalCur) && totalCur >= 0) {
            st._lastTrueMediaSecV227 = totalCur;
        }
        return totalCur;
    };

    // 3. Железобетонный выход из Реверса обратно в Прямой ход (restoreNormalVideoPlaybackV217):
    //    ВСЕГДА переключает vid.src с обратного потока обратно на прямой поток с текущей секунды curSec!
    window.restoreNormalVideoPlaybackV217 = function(ev, customTargetFwdSpeed) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();

        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        if (!vid || !st || !vd) return;

        var wasRev = Boolean(vd.isReversed || window.isReversedDeckB || st._playingHardwareRevStreamV219 || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
        var curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (st._lastTrueMediaSecV227 || 0);
        if (!isFinite(curSec) || curSec < 0) curSec = 0;

        window.stopHardwareReverseTimerV220();
        window.cleanupRevBlobQueueV223();
        st._revTrackSessionIdV220 = (st._revTrackSessionIdV220 || 0) + 1;

        window.isReversedDeckB = false;
        vd.isReversed = false;
        st._playingHardwareRevStreamV219 = false;
        st._revStreamStartedPlayingV220 = false;

        if (vd.sourceNode) {
            vd.sourceNode.onended = null;
            try { vd.sourceNode.stop(); } catch (e) {}
            try { vd.sourceNode.disconnect(); } catch (e) {}
            vd.sourceNode = null;
        }
        vd.isStudioPlaying = false;

        var baseSpd = window.getBaseSpeedDeckB ? window.getBaseSpeedDeckB() : 1.0;
        var targetSpd = (customTargetFwdSpeed !== undefined && isFinite(customTargetFwdSpeed))
            ? Number(customTargetFwdSpeed)
            : baseSpd;

        window._jennyVideoSpeedV170 = targetSpd;
        vd.speed = targetSpd;

        if (customTargetFwdSpeed === undefined || Math.abs(targetSpd - baseSpd) < 0.008) {
            if (window.scrubStateDeckB) {
                window.scrubStateDeckB.active = false;
                window.scrubStateDeckB.locked = false;
                window.scrubStateDeckB.side = null;
                window.scrubStateDeckB.speed = baseSpd;
                window.scrubStateDeckB.isPhysicallyReversed = false;
            }
            window.persistedPlaybackSpeedDeckB = null;
            window.persistedPlaybackSideDeckB = 'right';
        } else {
            if (window.scrubStateDeckB) {
                window.scrubStateDeckB.side = 'right';
                window.scrubStateDeckB.speed = targetSpd;
                window.scrubStateDeckB.isPhysicallyReversed = false;
            }
            window.persistedPlaybackSpeedDeckB = targetSpd;
            window.persistedPlaybackSideDeckB = 'right';
        }

        // Если выходили из реверса — ОБЯЗАТЕЛЬНО возвращаем vid.src на прямой поток с точки curSec,
        // чтобы в <video> никогда не оставался застрявший 6-секундный реверс-клип!
        if (wasRev) {
            if (!st.userPaused) window.captureAndHoldVideoFrameV220(1800);
            window.seekDeckBAndPlayerSyncedV212(curSec, false, true);
        } else {
            try {
                vid.preservesPitch = true;
                vid.webkitPreservesPitch = true;
                vid.defaultPlaybackRate = targetSpd;
                vid.playbackRate = targetSpd;
            } catch (e) {}
            if (!st.userPaused && vid.paused) {
                st._internalRevPause = false;
                vid.play().catch(function(){});
            }
        }

        try {
            vid.preservesPitch = true;
            vid.webkitPreservesPitch = true;
            vid.defaultPlaybackRate = targetSpd;
            vid.playbackRate = targetSpd;
        } catch (e) {}

        var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : 0;
        window.syncDeckBSpeedLockIndicatorV227();
        window.updateProgressUIDeckB(curSec, dur, false);
        window.syncVideoPlayerButtonsUIV217();

        if (ev && customTargetFwdSpeed === undefined && typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130('▶ Нормальное воспроизведение: ' + targetSpd + 'x');
        }
        if (ev && typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    // 4. Индикатор скорости и направления (#speedLockIndicatorDeckB) — 1:1 как в фиолетовой Деке А (71561.mp4):
    //    - Показывается ТОЛЬКО когда скорость выбрана/зафиксирована через дугу (scrubStateDeckB.active / locked)
    //      или отличается от базовой 1.0x!
    //    - При простом тапе по левому/правому таймеру (обычный реверс 1.0x или прямой ход 1.0x) скрыт, как в Деке А!
    window.syncDeckBSpeedLockIndicatorV227 = function() {
        var lockEl = document.getElementById('speedLockIndicatorDeckB');
        if (!lockEl) return;
        if (lockEl._normToastUntilV227 && performance.now() < lockEl._normToastUntilV227) {
            return;
        }
        var vd = window.videoDeckV131 || {};
        var sc = window.scrubStateDeckB || {};
        var st = window._vidStateV130 || {};
        var isRev = Boolean(window.isReversedDeckB || vd.isReversed || sc.isPhysicallyReversed || st._playingHardwareRevStreamV219);
        var curSpd = Number(vd.speed || window._jennyVideoSpeedV170 || 1.0);
        var baseSpd = typeof window.getBaseSpeedDeckB === 'function' ? window.getBaseSpeedDeckB() : 1.0;

        if (sc.active || sc.locked || Math.abs(curSpd - baseSpd) > 0.008) {
            var icon = (sc.active && !sc.locked) ? '🔄' : '🔒';
            var dirIcon = isRev ? '⏪' : '⏩';
            lockEl.style.display = 'block';
            lockEl.innerText = icon + ' ' + dirIcon + ' x' + curSpd;
        } else {
            lockEl.style.display = 'none';
        }
    };

    // 5. Обновление синей полосы прогресса и трёх таймеров Деки Б (#deckBProgressRow) — 1:1 как в фиолетовой Деке А:
    window.updateProgressUIDeckB = function(currentTime, duration, isReverseVisual) {
        var pFill = document.getElementById('progressFillDeckB');
        var cTime = document.getElementById('currentTimeDeckB');
        var rTime = document.getElementById('remainingTimeDeckB');
        var dTime = document.getElementById('durationTimeDeckB');
        var npEl  = document.getElementById('nowPlayingDeckB');

        var fmt = window.formatVideoTimeV210 || window.formatTime || function(s) {
            s = Math.max(0, Math.floor(s || 0));
            var m = Math.floor(s / 60), sc = s % 60;
            return m + ':' + (sc < 10 ? '0' + sc : sc);
        };

        var cur = Math.max(0, Number(currentTime) || 0);
        var dur = Math.max(0, Number(duration) || 0);

        if (pFill && isFinite(dur) && dur > 0) {
            var perc = Math.max(0, Math.min(100, (cur / dur) * 100));
            pFill.style.transform = 'none';
            pFill.style.background = 'rgba(31, 111, 235, 0.45)';
            if (isReverseVisual) {
                pFill.style.left = 'auto';
                pFill.style.right = '0';
                pFill.style.width = (100 - perc) + '%';
            } else {
                pFill.style.right = 'auto';
                pFill.style.left = '0';
                pFill.style.width = perc + '%';
            }
        }

        if (isFinite(dur) && dur > 0) {
            var remToEnd = Math.max(0, dur - cur);
            if (isReverseVisual) {
                if (cTime) cTime.innerText = '-' + fmt(cur);
                if (rTime) rTime.innerText = fmt(remToEnd);
                if (dTime) dTime.innerText = fmt(cur) + ' / ' + fmt(dur);
            } else {
                if (cTime) cTime.innerText = fmt(cur);
                if (rTime) rTime.innerText = '-' + fmt(remToEnd);
                if (dTime) dTime.innerText = fmt(cur) + ' / ' + fmt(dur);
            }
        }

        if (npEl) {
            var st = window._vidStateV130 || {};
            var vd = window.videoDeckV131 || {};
            var vEl = document.getElementById('jennyVideoElV130');
            var rawTitle = st.currentTitle || vd.title || (vEl && vEl.getAttribute('data-title')) ||
                           (vEl && vEl.src ? decodeURIComponent(vEl.src.split('/').pop().split('?')[0]) : '');
            if (rawTitle && rawTitle.indexOf('live_remux') === -1 && rawTitle.indexOf('reverse_remux') === -1) {
                var studioOn = Boolean(!vd.config || vd.config.studioMode !== false);
                var hasFwd = Boolean(vd.studioBuffer);
                var hasRev = Boolean(vd.reversedStudioBuffer);
                var ramTag = '🎬 ';
                if (studioOn) {
                    if (hasFwd && hasRev) {
                        if (vd._isLoadingRamV359 && !vd.studioBuffer._allPiecesLoadedV72 && (vd._ramPiecesTotalV359 || 1) > 1) {
                            ramTag = 'RAM 🚀 (' + (vd.studioBuffer._loadedCountV72 || 1) + '/' + vd._ramPiecesTotalV359 + '): ';
                        } else {
                            ramTag = 'RAM 🚀: ';
                        }
                    } else if (hasFwd) {
                        ramTag = 'RAM 🚀: ';
                    } else if (vd._isLoadingRamV359) {
                        ramTag = '⏳ RAM (' + (vd._ramPiecesLoadedV359 || 0) + '/' + (vd._ramPiecesTotalV359 || 1) + '): ';
                    }
                }
                var wantTextB = ramTag + rawTitle;
                if (npEl.innerText !== wantTextB) {
                    npEl.innerText = wantTextB;
                }
            }
        }

        window.syncDeckBSpeedLockIndicatorV227();

        if (typeof window.syncInternalVideoSliderUIV212 === 'function') {
            window.syncInternalVideoSliderUIV212(cur, dur);
        }
    };

    window.seekVideoToExactSecondV167 = function(targetSec) {
        window.seekDeckBAndPlayerSyncedV212(targetSec, false, true);
    };
    window.seekDeckBVideoToSecV210 = function(targetSec) {
        window.seekDeckBAndPlayerSyncedV212(targetSec, false, true);
    };

    // 7. Скраббинг по радиальной дуге скоростей (слева = Реверс ⏪, справа = Вперёд ⏩) — 1:1 как в Деке А:
    window.startScrubDeckB = function(side, speed) {
        var vid = document.getElementById('jennyVideoElV130');
        var vd = window.videoDeckV131;
        var st = window._vidStateV130;
        if (!vid || !vd || !st || !st.active) return;

        var wantReverseNow = (side === 'left');
        var cleanSpd = Math.max(0.1, Math.min(8.0, parseFloat(speed) || 1.0));

        window.scrubStateDeckB.active = true;
        window.scrubStateDeckB.side = side;
        window.scrubStateDeckB.speed = cleanSpd;
        window.scrubStateDeckB.isPhysicallyReversed = wantReverseNow;
        window.persistedPlaybackSpeedDeckB = cleanSpd;
        window.persistedPlaybackSideDeckB = side;

        if (wantReverseNow) {
            window._lastRevVideoSpeedV217 = cleanSpd;
            window.startImmediateVideoReverseEngineV217(cleanSpd, false);
        } else {
            window._lastFwdVideoSpeedV217 = cleanSpd;
            window.restoreNormalVideoPlaybackV217(null, cleanSpd);
        }
        window.syncDeckBSpeedLockIndicatorV227();
        window.syncVideoPlayerButtonsUIV217();
    };

    window.stopScrubDeckB = function(keepLockedSpeed) {
        var vd = window.videoDeckV131;
        var st = window._vidStateV130;
        if (!vd || !st || !st.active) return;

        if (!keepLockedSpeed) {
            var baseSpd = typeof window.getBaseSpeedDeckB === 'function' ? window.getBaseSpeedDeckB() : 1.0;
            window.scrubStateDeckB.active = false;
            window.scrubStateDeckB.locked = false;
            window.scrubStateDeckB.side = null;
            window.scrubStateDeckB.speed = baseSpd;
            window.scrubStateDeckB.isPhysicallyReversed = false;
            window.persistedPlaybackSpeedDeckB = null;
            window.persistedPlaybackSideDeckB = 'right';
            window.restoreNormalVideoPlaybackV217(null, baseSpd);
        } else {
            window.scrubStateDeckB.active = false;
        }
        window.syncDeckBSpeedLockIndicatorV227();
        window.syncVideoPlayerButtonsUIV217();
    };

    // 8. Боковые таймеры Деки Б (#leftTimeBlockDeckB и #rightTimeBlockDeckB) — 1:1 как в Деке А (ui_controls.js):
    window.setupTimeBlockControlsDeckB = function() {
        var origLeft = document.getElementById('leftTimeBlockDeckB');
        var origRight = document.getElementById('rightTimeBlockDeckB');
        if (!origLeft || !origRight || origLeft._v227Bound) return;

        var leftBlock = origLeft.cloneNode(true);
        var rightBlock = origRight.cloneNode(true);
        leftBlock._v211Bound = true;
        leftBlock._v227Bound = true;
        rightBlock._v211Bound = true;
        rightBlock._v227Bound = true;
        origLeft.replaceWith(leftBlock);
        origRight.replaceWith(rightBlock);

        var pressTimer = null;
        var isLongPress = false;
        var jumpInterval = null;
        var holdTargetSec = null;

        var startSilent10xSeekDeckB = function(dirSign) {
            var vid = document.getElementById('jennyVideoElV130');
            var st = window._vidStateV130;
            if (!vid || !st || !st.active) return;

            var cur = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
            holdTargetSec = cur;

            if (jumpInterval) clearInterval(jumpInterval);
            jumpInterval = setInterval(function() {
                var dNow = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (vid.duration || 0);
                if (!isFinite(dNow) || dNow <= 0) return;
                var isRev = Boolean(window.isReversedDeckB || (window.videoDeckV131 && window.videoDeckV131.isReversed));
                holdTargetSec = Math.max(0.1, Math.min(dNow - 0.2, (holdTargetSec !== null ? holdTargetSec : cur) + (dirSign * 1.0)));
                st._lastTrueMediaSecV227 = holdTargetSec;
                st._pendingSeekSecV167 = holdTargetSec;
                st._pendingSeekTsV167 = performance.now();
                window.updateProgressUIDeckB(holdTargetSec, dNow, isRev);
            }, 100);
        };

        var stopSilent10xSeekDeckB = function() {
            if (jumpInterval) {
                clearInterval(jumpInterval);
                jumpInterval = null;
            }
            if (holdTargetSec !== null) {
                var target = holdTargetSec;
                holdTargetSec = null;
                window.seekDeckBAndPlayerSyncedV212(target, false, true);
            }
        };

        leftBlock.addEventListener('touchstart', function(e) {
            e.stopPropagation();
            isLongPress = false;
            clearTimeout(pressTimer);
            pressTimer = setTimeout(function() {
                isLongPress = true;
                try { navigator.vibrate(30); } catch (err) {}
                startSilent10xSeekDeckB(-1);
            }, 420);
        }, { passive: true });

        leftBlock.addEventListener('touchend', function(e) {
            e.stopPropagation();
            clearTimeout(pressTimer);
            if (isLongPress) {
                stopSilent10xSeekDeckB();
            } else {
                window.toggleReverseModeDeckB(true);
            }
        });

        leftBlock.addEventListener('touchcancel', function() {
            clearTimeout(pressTimer);
            if (isLongPress) stopSilent10xSeekDeckB();
        });

        rightBlock.addEventListener('touchstart', function(e) {
            e.stopPropagation();
            isLongPress = false;
            clearTimeout(pressTimer);
            pressTimer = setTimeout(function() {
                isLongPress = true;
                try { navigator.vibrate(30); } catch (err) {}
                startSilent10xSeekDeckB(+1);
            }, 420);
        }, { passive: true });

        rightBlock.addEventListener('touchend', function(e) {
            e.stopPropagation();
            clearTimeout(pressTimer);
            if (isLongPress) {
                stopSilent10xSeekDeckB();
            } else {
                window.toggleReverseModeDeckB(false);
            }
        });

        rightBlock.addEventListener('touchcancel', function() {
            clearTimeout(pressTimer);
            if (isLongPress) stopSilent10xSeekDeckB();
        });
    };

    // 9. Центральная полоса прогресса Деки Б (#seekZoneDeckB) — 1:1 как в Деке А (ui_touch_arc.js):
    window.setupSeekZoneDeckB = function() {
        var origZone = document.getElementById('seekZoneDeckB');
        if (!origZone || origZone._v227Bound) return;

        var zone = origZone.cloneNode(true);
        zone._v211Bound = true;
        zone._v227Bound = true;
        origZone.replaceWith(zone);

        var overlay = document.getElementById('scrubOverlayDeckB');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'scrubOverlayDeckB';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483646 !important;display:none;touch-action:none;';
            document.body.appendChild(overlay);
        }
        var arcContainer = document.getElementById('speedArcContainerDeckB');
        if (!arcContainer) {
            arcContainer = document.createElement('div');
            arcContainer.id = 'speedArcContainerDeckB';
            arcContainer.style.cssText = 'position:fixed;inset:0;z-index:2147483647 !important;pointer-events:none;transition:opacity 0.1s ease-out;opacity:0;display:none;';
            document.body.appendChild(arcContainer);
        }
        var debugCanvas = document.getElementById('debugZoneCanvasDeckB');
        if (!debugCanvas) {
            debugCanvas = document.createElement('canvas');
            debugCanvas.id = 'debugZoneCanvasDeckB';
            debugCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;width:100%;height:100%;z-index:5998;';
            overlay.appendChild(debugCanvas);
        }

        var startX = 0;
        var startY = 0;
        var isPullingDown = false;
        var isScrubbing = false;
        var isSeekingAllowed = true;
        var scrubSide = null;
        var currentTempSpeed = null;
        var arcItems = [];
        var circleAngles = [];
        var currentAnchor = { x: 0, y: 0 };
        var pressTimer = null;
        var activeTouchDeckB = false;

        function getX(e) {
            if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
            if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
            return e.clientX;
        }
        function getY(e) {
            if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientY;
            if (e.touches && e.touches.length > 0) return e.touches[0].clientY;
            return e.clientY;
        }
        function angleDiffSigned(a, b) {
            return ((a - b) % 360 + 540) % 360 - 180;
        }

        function handleTapSeekDeckB(x) {
            if (x === undefined || isNaN(x)) return;
            var rect = zone.getBoundingClientRect();
            if (rect.width <= 10) return;
            var perc = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
            var vid = document.getElementById('jennyVideoElV130');
            if (!vid) return;
            var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (vid.duration || 0);
            if (isFinite(dur) && dur > 0) {
                var targetSec = perc * dur;
                window.seekDeckBAndPlayerSyncedV212(targetSec, false, true);
            }
        }

        function generateArcDeckB() {
            arcContainer.innerHTML = '';
            arcItems = [];
            circleAngles = [];

            var activeZones = window.getCustomVideoSpeedZonesV217
                ? window.getCustomVideoSpeedZonesV217()
                : [1.1, 1.0, 1.05, 0.95, 1.5, 0.9];
            if (!activeZones || activeZones.length === 0) activeZones = [1.1, 1.0, 1.05, 0.95, 1.5, 0.9];

            var isLeftHanded = Boolean(window.appConfig && window.appConfig.leftHandedMode);
            var W = window.innerWidth;
            var H = window.innerHeight;

            // Лучи видеодеки выходят строго из центра синей кнопки эквалайзера Деки Б (#btnEqDeckBV216)
            var eqBtn = document.getElementById('btnEqDeckBV216') || document.getElementById('btn-eqModal');
            if (eqBtn) {
                var eqRect = eqBtn.getBoundingClientRect();
                currentAnchor.x = eqRect.left + eqRect.width / 2;
                currentAnchor.y = eqRect.top + eqRect.height / 2;
            } else {
                currentAnchor.y = H - 135;
                currentAnchor.x = isLeftHanded ? 31 : (W - 31);
            }

            // Строгая круговая дуга постоянного радиуса R с центром прямо в currentAnchor (0% спирали, равное расстояние до всех 6 кружков!)
            var curveOriginY = currentAnchor.y;
            var startDeg = -104, endDeg = -174;
            var R = Math.min(W * 0.74, H * 0.34);
            var rTop = R, rMid = R, rBot = R;

            function sampleCurvePoint(u) {
                var deg = startDeg + u * (endDeg - startDeg);
                var rad = deg * Math.PI / 180;
                var r = (1 - u) * (1 - u) * rTop + 2 * (1 - u) * u * rMid + u * u * rBot;
                var dxRH = r * Math.cos(rad);
                var dy = r * Math.sin(rad);
                var x = currentAnchor.x + (isLeftHanded ? -dxRH : dxRH);
                var y = curveOriginY + dy;
                return { x: Math.max(30, Math.min(W - 30, x)), y: Math.max(140, Math.min(H - 48, y)) };
            }

            var STEPS = 240, samples = [], totalLen = 0;
            for (var k = 0; k <= STEPS; k++) {
                var pt = sampleCurvePoint(k / STEPS);
                if (k > 0) totalLen += Math.hypot(pt.x - samples[k - 1].x, pt.y - samples[k - 1].y);
                samples.push({ x: pt.x, y: pt.y, s: totalLen });
            }

            var count = activeZones.length, positions = [];
            for (var j = 0; j < count; j++) {
                var targetS = count === 1 ? (totalLen * 0.5) : (totalLen * (j / (count - 1)));
                var best = samples[0];
                for (var m = 0; m < samples.length; m++) {
                    if (samples[m].s >= targetS) { best = samples[m]; break; }
                }
                positions.push(best);
            }

            activeZones.forEach(function(val, index) {
                if (index >= positions.length) return;
                var el = document.createElement('div');
                el.className = 'arc-item';
                el.innerText = 'x' + (val % 1 === 0 ? val.toFixed(1) : val.toString());
                el.dataset.val = val;
                el.style.left = (positions[index].x - 24) + 'px';
                el.style.top = (positions[index].y - 24) + 'px';
                var angle = Math.atan2(positions[index].y - currentAnchor.y, positions[index].x - currentAnchor.x) * 180 / Math.PI;
                circleAngles.push(angle);
                arcContainer.appendChild(el);
                arcItems.push(el);
            });

            if (overlay.parentNode !== document.body || overlay.nextSibling !== arcContainer || arcContainer.nextSibling !== null) {
                try {
                    document.body.appendChild(overlay);
                    document.body.appendChild(arcContainer);
                } catch (e) {}
            }
            overlay.style.setProperty('z-index', '2147483646', 'important');
            arcContainer.style.setProperty('z-index', '2147483647', 'important');
            arcContainer.style.display = 'block';
            setTimeout(function() { arcContainer.style.opacity = '1'; }, 10);

            debugCanvas.width = window.innerWidth;
            debugCanvas.height = window.innerHeight;
            var ctx = debugCanvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
                var coreGrad = ctx.createRadialGradient(currentAnchor.x, currentAnchor.y, 2, currentAnchor.x, currentAnchor.y, 24);
                coreGrad.addColorStop(0, 'rgba(88, 166, 255, 0.95)');
                coreGrad.addColorStop(0.5, 'rgba(163, 113, 247, 0.45)');
                coreGrad.addColorStop(1, 'rgba(115, 65, 190, 0)');
                ctx.beginPath();
                ctx.arc(currentAnchor.x, currentAnchor.y, 24, 0, 2 * Math.PI);
                ctx.fillStyle = coreGrad;
                ctx.fill();
                var radius = Math.max(window.innerWidth, window.innerHeight) * 0.95;
                ctx.lineWidth = 1.6;
                ctx.setLineDash([7, 8]);
                for (var li = 0; li < circleAngles.length - 1; li++) {
                    var delta = angleDiffSigned(circleAngles[li + 1], circleAngles[li]);
                    var midAngle = circleAngles[li] + delta / 2;
                    var rad = midAngle * Math.PI / 180;
                    var endX = currentAnchor.x + radius * Math.cos(rad);
                    var endY = currentAnchor.y + radius * Math.sin(rad);
                    var lineGrad = ctx.createLinearGradient(currentAnchor.x, currentAnchor.y, endX, endY);
                    lineGrad.addColorStop(0, 'rgba(88, 166, 255, 0.65)');
                    lineGrad.addColorStop(0.55, 'rgba(163, 113, 247, 0.35)');
                    lineGrad.addColorStop(1, 'rgba(88, 166, 255, 0.0)');
                    ctx.strokeStyle = lineGrad;
                    ctx.beginPath();
                    ctx.moveTo(currentAnchor.x, currentAnchor.y);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                }
                ctx.setLineDash([]);
            }
        }

        zone.addEventListener('touchstart', function(e) {
            e.stopPropagation();
            activeTouchDeckB = true;
            startX = getX(e);
            startY = getY(e);
            var rect = zone.getBoundingClientRect();
            var perc = (startX - rect.left) / Math.max(1, rect.width);

            if (perc < 0.33) scrubSide = 'left';
            else if (perc > 0.66) scrubSide = 'right';
            else scrubSide = 'center';

            isPullingDown = false;
            currentTempSpeed = null;
            isScrubbing = false;
            isSeekingAllowed = true;

            if (scrubSide === 'center') {
                pressTimer = setTimeout(function() {
                    pressTimer = null;
                    isSeekingAllowed = false;
                    try { navigator.vibrate(50); } catch (err) {}

                    window.toggleReverseModeDeckB(false);
                    var baseSpd = typeof window.getBaseSpeedDeckB === 'function' ? window.getBaseSpeedDeckB() : 1.0;

                    var lockEl = document.getElementById('speedLockIndicatorDeckB');
                    if (lockEl) {
                        lockEl._normToastUntilV227 = performance.now() + 1000;
                        lockEl.style.display = 'block';
                        lockEl.innerText = '✅ Норм: x' + baseSpd;
                        setTimeout(function() {
                            window.syncDeckBSpeedLockIndicatorV227();
                        }, 1020);
                    }
                }, 220);
            } else {
                pressTimer = setTimeout(function() {
                    pressTimer = null;
                    isScrubbing = true;
                    if (window.scrubStateDeckB.locked) {
                        window.scrubStateDeckB.locked = false;
                        try { navigator.vibrate(50); } catch (err) {}
                    } else {
                        try { navigator.vibrate(30); } catch (err) {}
                    }
                    var vdCfg = (window.videoDeckV131 && window.videoDeckV131.config) || window.appConfig || {};
                    var defSpeed = parseFloat(vdCfg.defaultScrubSpeed) || 2.0;
                    currentTempSpeed = defSpeed;
                    window.startScrubDeckB(scrubSide, defSpeed);
                }, 250);
            }
        }, { passive: true });

        function handleTouchMoveDeckB(e) {
            if (!activeTouchDeckB) return;
            var curX = getX(e);
            var curY = getY(e);
            var deltaY = curY - startY;

            if (scrubSide === 'center') {
                if (Math.abs(deltaY) > 15 && pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
                return;
            }

            var threshold = window.innerHeight * 0.05;
            if (Math.abs(deltaY) > threshold || isScrubbing) {
                isSeekingAllowed = false;
                if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }

                if (!isScrubbing) {
                    isScrubbing = true;
                    if (window.scrubStateDeckB.locked) window.scrubStateDeckB.locked = false;
                }

                if (!isPullingDown) {
                    isPullingDown = true;
                    overlay.style.display = 'block';
                    generateArcDeckB();
                    var vdCfg = (window.videoDeckV131 && window.videoDeckV131.config) || window.appConfig || {};
                    var defSpeed = parseFloat(vdCfg.defaultScrubSpeed) || 2.0;
                    currentTempSpeed = defSpeed;
                    window.startScrubDeckB(scrubSide, defSpeed);
                }

                var dx = curX - currentAnchor.x;
                var dy = curY - currentAnchor.y;
                var fingerAngle = Math.atan2(dy, dx) * 180 / Math.PI;

                var minDiff = Infinity, idx = 0;
                circleAngles.forEach(function(ang, i) {
                    var diff = Math.abs(angleDiffSigned(fingerAngle, ang));
                    if (diff < minDiff) { minDiff = diff; idx = i; }
                });

                if (arcItems[idx] && !arcItems[idx].classList.contains('active')) {
                    arcItems.forEach(function(el) { el.classList.remove('active'); });
                    arcItems[idx].classList.add('active');
                    currentTempSpeed = parseFloat(arcItems[idx].dataset.val);
                    window.startScrubDeckB(scrubSide, currentTempSpeed);
                    try { navigator.vibrate(15); } catch (err) {}
                }
            }
        }

        function handleTouchEndDeckB(e) {
            if (!activeTouchDeckB) return;
            activeTouchDeckB = false;

            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
                if (isSeekingAllowed) handleTapSeekDeckB(getX(e));
            } else if (isScrubbing) {
                arcContainer.style.opacity = '0';
                setTimeout(function() { arcContainer.style.display = 'none'; }, 150);

                if (isPullingDown && currentTempSpeed) {
                    window.scrubStateDeckB.locked = true;
                    window.startScrubDeckB(scrubSide, currentTempSpeed);
                } else if (!window.scrubStateDeckB.locked) {
                    window.stopScrubDeckB(false);
                }
            }

            overlay.style.display = 'none';
            isPullingDown = false;
            isScrubbing = false;
            scrubSide = null;

            var dbg = document.getElementById('debugZoneCanvasDeckB');
            if (dbg) {
                var ctx = dbg.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, dbg.width, dbg.height);
            }
        }

        function handleTouchCancelDeckB() {
            if (!activeTouchDeckB) return;
            activeTouchDeckB = false;
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
            arcContainer.style.display = 'none';
            overlay.style.display = 'none';
            if (!window.scrubStateDeckB.locked) {
                window.stopScrubDeckB(false);
            }
            isPullingDown = false;
            isScrubbing = false;
            scrubSide = null;
            var dbg = document.getElementById('debugZoneCanvasDeckB');
            if (dbg) {
                var ctx = dbg.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, dbg.width, dbg.height);
            }
        }

        zone.addEventListener('touchmove', handleTouchMoveDeckB, { passive: true });
        zone.addEventListener('touchend', handleTouchEndDeckB);
        zone.addEventListener('touchcancel', handleTouchCancelDeckB);
        zone.addEventListener('click', function(e) {
            if (!isScrubbing && !isPullingDown && e.clientX) {
                handleTapSeekDeckB(e.clientX);
            }
        });

        if (!overlay._v227OverlayBound) {
            overlay._v227OverlayBound = true;
            overlay.addEventListener('touchmove', handleTouchMoveDeckB, { passive: false });
            overlay.addEventListener('touchend', handleTouchEndDeckB);
            overlay.addEventListener('touchcancel', handleTouchCancelDeckB);
        }
    };

    setTimeout(function() {
        window.setupSeekZone();
        window.setupTimeBlockControlsDeckB();
        window.setupSeekZoneDeckB();
        window.syncDeckBSpeedLockIndicatorV227();
    }, 100);
})();
/* ================= END JENNY_V227_DECK_B_PARITY_AND_RAM_REVERSE_PATCH ================= */

/* ================= JENNY_V229_POLISH_PATCH (#324): NO BLINKING 94 COUNTER, PAUSE-SAFE AUDIO SPEED/RESET, PURE CIRCULAR ARC ON AUDIO & VIDEO, AUTO-NEXT VIDEO IN ACTIVE LIST (71568.mp4) ================= */
/* [split] V229: кусок исходного IIFE (ui_v71.js, строки 27956–28395) → ui_video_decks.js */
;(function() {
    if (window._jennyV229Installed__video_decks) return;
    window._jennyV229Installed__video_decks = true;
    window._jennyV229Installed = true;

    // -------------------------------------------------------------------------
    // 1. УСТРАНЕНИЕ МОРГАНИЯ СЧЁТЧИКА АУДИО "94" (#tracksCount) НА ДЕКЕ А (71568.mp4 00:11-00:30, 01:10-01:27)
    //    Фиолетовый счётчик #tracksCount принадлежит ТОЛЬКО Аудио Деке А (94),
    //    а синий счётчик #tracksCountDeckBV216 принадлежит ТОЛЬКО Видео Деке Б (19).
    //    Защищаем #tracksCount от перезаписи числом видео (19) из фоновых таймеров syncDiscoveredVideosIntoPlaylistV134!
    // -------------------------------------------------------------------------
    window.computeAudioAndVideoCountsV229 = function() {
        var data = window.lastData || {};
        var allAud = (data.all_tracks || []).filter(function(fn) {
            return !(window.isVideoFileNameV130 && window.isVideoFileNameV130(fn)) &&
                   (window.isAudioTrackAllowedByFormatSlotsV150 ? window.isAudioTrackAllowedByFormatSlotsV150(fn) : true);
        });
        var vItems = window.getFilteredVideoItemsV150 ? window.getFilteredVideoItemsV150() : [];
        return {
            audioCount: allAud.length,
            videoCount: vItems.length
        };
    };

    window.syncDualDeckCountersV216 = function() {
        window.installTracksCountAntiBlinkLockV229();
        var counts = window.computeAudioAndVideoCountsV229();
        var cntA = document.getElementById('tracksCount');
        if (cntA && cntA.textContent !== '⏳') {
            var aStr = String(counts.audioCount);
            if (cntA.textContent !== aStr) cntA.textContent = aStr;
        }
        var cntB = document.getElementById('tracksCountDeckBV216');
        if (cntB && cntB.textContent !== '⏳') {
            var vStr = String(counts.videoCount);
            if (cntB.textContent !== vStr) cntB.textContent = vStr;
        }
    };

    var _origRefreshDeckListV216 = window.refreshDeckListV216;
    if (typeof _origRefreshDeckListV216 === 'function' && !_origRefreshDeckListV216._v229Wrapped) {
        window.refreshDeckListV216 = async function(whichDeck, ev) {
            if (whichDeck === 'audio') window._manualAudioRefreshActiveV229 = true;
            try {
                return await _origRefreshDeckListV216.apply(this, arguments);
            } finally {
                window._manualAudioRefreshActiveV229 = false;
                window.syncDualDeckCountersV216();
            }
        };
        window.refreshDeckListV216._v229Wrapped = true;
    }

    // -------------------------------------------------------------------------
    // 2. СОХРАНЕНИЕ ПАУЗЫ НА ФИОЛЕТОВОЙ ДЕКЕ А ПРИ ВЫБОРЕ СКОРОСТИ И СБРОСЕ "НОРМ: x1" (71568.mp4 01:36-02:25)
    //    Если трек в Деке А поставлен на паузу, выбор скорости на дуге (x1.5 и др.),
    //    переключение реверса или удержание центра ("✅ Норм: x1") меняют скорость/направление,
    //    но НЕ запускают воспроизведение самопроизвольно, пока пользователь сам не нажмёт Play ▶!
    // -------------------------------------------------------------------------
    window.isAudioDeckAPausedByUserV229 = function() {
        var player = document.getElementById('audioPlayer');
        if (!player) return true;
        if (window._userPausedV75_2) return true;
        return Boolean(player.paused && !window.isStudioPlaying);
    };

    // -------------------------------------------------------------------------
    // 3. АВТОПЕРЕКЛЮЧЕНИЕ НА СЛЕДУЮЩЕЕ ВИДЕО В ТЕКУЩЕМ СПИСКЕ (ИЗБРАННОЕ / ВИДЕО / ПЛЕЙЛИСТ)
    //    ПО ОКОНЧАНИИ ВОСПРОИЗВЕДЕНИЯ ВИДЕО (71568.mp4 03:35-04:22)
    // -------------------------------------------------------------------------
    window._activeVideoQueueContextV229 = 'videos';
    window._activeVideoQueueNamesV229 = [];

    window.captureActiveVideoQueueFromUIContextV229 = function(clickedFilename, explicitContext) {
        var tabId = window.activePlaylistTabV71 || 'all';
        var allVideoItems = window.getFilteredVideoItemsV150 ? window.getFilteredVideoItemsV150() : [];
        var allVideoNames = allVideoItems.map(function(x) { return x.name; });

        // Если видео запущено из вкладки «❤️ Избранное» (или её подвкладки «🎬 Видео»)
        if (explicitContext === 'fav' || tabId === 'fav') {
            var favAll = Array.isArray(window.favorites) ? window.favorites : [];
            var favVid = favAll.filter(function(fn) { return window.isVideoFileNameV130 && window.isVideoFileNameV130(fn); });
            var sortedFav = window.sortTrackArrayForTabV71 ? window.sortTrackArrayForTabV71(favVid, 'fav') : favVid;
            if (sortedFav.length > 0 && (!clickedFilename || sortedFav.indexOf(clickedFilename) !== -1)) {
                window._activeVideoQueueContextV229 = 'fav';
                window._activeVideoQueueNamesV229 = sortedFav.slice();
                return;
            }
        }

        // Если открыт кастомный плейлист или список на экране содержит видеофайлы
        if (Array.isArray(window.viewedFullTabListV73) && window.viewedFullTabListV73.length > 0) {
            var viewVids = window.viewedFullTabListV73.filter(function(fn) {
                return window.isVideoFileNameV130 && window.isVideoFileNameV130(fn);
            });
            if (viewVids.length > 0 && (!clickedFilename || viewVids.indexOf(clickedFilename) !== -1)) {
                window._activeVideoQueueContextV229 = tabId;
                window._activeVideoQueueNamesV229 = viewVids.slice();
                return;
            }
        }

        window._activeVideoQueueContextV229 = 'videos';
        window._activeVideoQueueNamesV229 = allVideoNames;
    };

    window.resolveActiveVideoQueueItemsV229 = function() {
        var allItems = window.getFilteredVideoItemsV150 ? window.getFilteredVideoItemsV150() : [];
        var itemMap = {};
        allItems.forEach(function(it) {
            if (it && it.name) itemMap[it.name] = it;
        });

        var st = window._vidStateV130 || {};
        var curTitle = String(st.currentTitle || '').trim();
        var tabId = window.activePlaylistTabV71 || 'all';

        // Если сейчас открыта вкладка Избранное -> Видео и текущее видео входит в избранное, используем список Избранного
        if (tabId === 'fav' || window._activeVideoQueueContextV229 === 'fav') {
            var favAll = Array.isArray(window.favorites) ? window.favorites : [];
            var favVid = favAll.filter(function(fn) { return window.isVideoFileNameV130 && window.isVideoFileNameV130(fn); });
            var sortedFav = window.sortTrackArrayForTabV71 ? window.sortTrackArrayForTabV71(favVid, 'fav') : favVid;
            if (sortedFav.length > 0 && (!curTitle || sortedFav.indexOf(curTitle) !== -1)) {
                return sortedFav.map(function(name) {
                    return itemMap[name] || { name: name, stream_url: '/api/media/' + encodeURIComponent(name) };
                });
            }
        }

        if (Array.isArray(window._activeVideoQueueNamesV229) && window._activeVideoQueueNamesV229.length > 0) {
            if (!curTitle || window._activeVideoQueueNamesV229.indexOf(curTitle) !== -1) {
                return window._activeVideoQueueNamesV229.map(function(name) {
                    return itemMap[name] || { name: name, stream_url: '/api/media/' + encodeURIComponent(name) };
                });
            }
        }

        return allItems;
    };

    window.clearVideoSavedResumePositionV229 = function(titleStr, streamUrl) {
        try {
            if (typeof window.loadVideoResumeMapV135 === 'function' && typeof window.getVideoResumeKeyV135 === 'function') {
                var map = window.loadVideoResumeMapV135();
                var key = window.getVideoResumeKeyV135(titleStr, streamUrl);
                if (key && map && map[key]) {
                    delete map[key];
                    localStorage.setItem('jenny_video_resume_v135', JSON.stringify(map));
                }
            }
        } catch (e) {}
    };

    window.playAdjacentVideoDeckBV216 = function(dirStep, ev, isAutoAdvance) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var items = window.resolveActiveVideoQueueItemsV229();
        if (!items || items.length === 0) {
            if (typeof window.showToast === 'function' && !isAutoAdvance) {
                window.showToast('🎬 В списке видео пока нет файлов', ev);
            }
            return;
        }
        var st = window._vidStateV130 || {};
        var curTitle = String(st.currentTitle || '').trim();
        var idx = items.findIndex(function(x) { return x.name === curTitle; });
        var nextIdx = idx !== -1 ? ((idx + dirStep + items.length) % items.length) : 0;
        var target = items[nextIdx];
        if (!target) return;

        var wasPip = Boolean(st.pipMode || !st.active);
        var url = target.stream_url || ('/api/media/' + encodeURIComponent(target.name));

        // При автопереходе на следующую серию (или если сохранённая позиция следующей серии была у самого конца)
        // сбрасываем её сохранённую позицию в 0:00, чтобы следующая серия всегда начиналась с начала!
        if (isAutoAdvance) {
            window.clearVideoSavedResumePositionV229(target.name, url);
        }

        window.openJennyVideoPlayerV130(url, target.name, {
            torHash: target.tor_hash || '',
            torFileIdx: target.tor_file_idx !== undefined ? Number(target.tor_file_idx) : -1,
            startInPipV135: wasPip,
            autoNextV229: Boolean(isAutoAdvance)
        });
    };

    // Отслеживаем достижение конца видео в прямом ходе (и для обычного MP4, и для потокового ремукса MKV/AVI)
    window._lastVideoAutoAdvanceWallTsV229 = 0;

    window.triggerVideoAutoNextOnEndedV229 = function() {
        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        var vid = document.getElementById('jennyVideoElV130');
        if (!st.active || !vid || st.userPaused) return;

        var isRev = Boolean(window.isReversedDeckB || vd.isReversed || st._inRevLoopV220 || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
        if (isRev) return;

        var now = performance.now();
        if (now - (window._lastVideoAutoAdvanceWallTsV229 || 0) < 2500) return;
        if (now - (window._lastVideoOpenTsV224 || 0) < 2000) return;

        var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (vid.duration || 0);
        var cur = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);

        // Защита от ложного срабатывания в середине серии при переключении дорожек или перемотке
        if (isFinite(dur) && dur > 15 && cur < dur - 3.5) return;

        window._lastVideoAutoAdvanceWallTsV229 = now;
        window.clearVideoSavedResumePositionV229(st.currentTitle, st.currentUrl);
        window.playAdjacentVideoDeckBV216(1, null, true);
    };

    document.addEventListener('ended', function(e) {
        if (e && e.target && e.target.id === 'jennyVideoElV130') {
            window.triggerVideoAutoNextOnEndedV229();
        }
    }, true);

    setInterval(function() {
        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        var vid = document.getElementById('jennyVideoElV130');
        if (!st.active || !vid || st.userPaused) return;
        var isRev = Boolean(window.isReversedDeckB || vd.isReversed || st._inRevLoopV220 || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
        if (isRev) return;

        var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (vid.duration || 0);
        var cur = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
        if (isFinite(dur) && dur > 15 && cur >= dur - 0.45 && (vid.ended || vid.paused || cur >= dur - 0.15)) {
            window.triggerVideoAutoNextOnEndedV229();
        }
    }, 350);
})();

/* [split] V230: кусок исходного IIFE (ui_v71.js, строки 28399–29051) → ui_video_decks.js */
;(function() {
    if (window._jennyV230Installed__video_decks) return;
    window._jennyV230Installed__video_decks = true;
    window._jennyV230Installed = true;

    window.resolveYoutubeVideoLinkV230 = async function(videoId, idx) {
        var box = document.getElementById('ytResolvedBoxV230_' + idx);
        if (box) {
            box.style.display = 'flex';
            box.innerHTML = '<span style="color:#58a6ff;">⏳ Ядро ' + window._ytStudioStateV230.active_core + ' (yt-dlp + зеркала) подбирает поток...</span>';
        }
        try {
            var st = window._ytStudioStateV230;
            var res = await fetch('/api/youtube/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    video_id: videoId,
                    active_core: st.active_core,
                    policy: st.policy,
                    client_net: window.detectClientNetworkTypeV230()
                })
            });
            var d = await res.json();
            if (!res.ok || d.status !== 'ok') {
                throw new Error(d.error || 'Не удалось извлечь ссылку');
            }
            st.resolvedMap[videoId] = d;
            if (box) {
                var availStr = Array.isArray(d.available_heights) && d.available_heights.length
                    ? d.available_heights.map(function(h) { return h + 'p'; }).join(', ')
                    : d.selected_label;
                box.innerHTML =
                    '<div style="color:#3fb950;font-weight:bold;">' +
                        '✅ Выбрано: <b>' + d.selected_label + '</b> ' +
                        '<span style="color:#8b949e;font-weight:normal;">(лимит ≤ ' + d.effective_limit_h + 'p • макс. у видео: ' + d.video_max_height + 'p • ' + d.core_profile + ')</span>' +
                    '</div>' +
                    '<div style="color:#8b949e;font-size:10px;">Доступные разрешения у ролика: <b style="color:#c9d1d9;">' + availStr + '</b></div>' +
                    '<div style="display:flex;gap:5px;align-items:center;">' +
                        '<input type="text" readonly value="' + String(d.direct_url || '').replace(/"/g, '&quot;') + '" style="flex:1;padding:4px 6px;font-size:10px;background:#0d1117;color:#58a6ff;border:1px solid #21262d;border-radius:5px;">' +
                        '<button type="button" onclick="window.copyYtResolvedUrlV230(\'' + videoId + '\')" style="padding:4px 8px;font-size:10px;font-weight:bold;background:#1f6feb;color:#fff;border:none;border-radius:5px;white-space:nowrap;">📋 Копировать</button>' +
                    '</div>';
            }
            return d;
        } catch (e) {
            if (box) {
                box.innerHTML = '<span style="color:#ff7b72;">❌ ' + (e.message || e) + '</span>';
            }
            return null;
        }
    };

    window.playYoutubeVideoInDeckBV230 = async function(videoId, idx) {
        var d = await window.resolveYoutubeVideoLinkV230(videoId, idx);
        if (!d || !d.play_url) return;
        var m = document.getElementById('jennyYoutubeModalV230');
        if (m) m.style.setProperty('display', 'none', 'important');
        var title = (d.title || videoId) + ' [' + d.selected_label + ']';
        if (typeof window.openJennyVideoPlayerV130 === 'function') {
            window.openJennyVideoPlayerV130(d.play_url, title, {});
        }
    };

    window.downloadYoutubeVideoV230 = async function(videoId, idx) {
        var btn = document.getElementById('ytDlBtnV230_' + idx);
        if (btn) btn.innerText = '⏳ Качаю...';
        try {
            var st = window._ytStudioStateV230;
            var res = await fetch('/api/youtube/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    video_id: videoId,
                    active_core: st.active_core,
                    policy: st.policy,
                    client_net: window.detectClientNetworkTypeV230()
                })
            });
            var d = await res.json();
            if (!res.ok || d.status !== 'ok') {
                throw new Error(d.error || 'Ошибка скачивания');
            }
            if (btn) btn.innerText = '✅ ' + d.selected_height + 'p';
            if (typeof window.syncDiscoveredVideosIntoPlaylistV134 === 'function') {
                await window.syncDiscoveredVideosIntoPlaylistV134(true);
            }
            if (typeof window.syncDualDeckCountersV216 === 'function') {
                window.syncDualDeckCountersV216();
            }
            if (typeof window.showToast === 'function') {
                window.showToast('📹 Скачано в Видео (' + d.selected_height + 'p): ' + d.filename + ' (' + d.size_mb + ' МБ)');
            }
        } catch (e) {
            if (btn) btn.innerText = '⬇️ Скачать';
            if (typeof window.showToast === 'function') {
                window.showToast('❌ ' + (e.message || e));
            }
        }
    };
})();

/* [split] V232: кусок исходного IIFE (ui_v71.js, строки 29055–29548) → ui_video_decks.js */
;(function() {
    if (window._jennyV232Installed__video_decks) return;
    window._jennyV232Installed__video_decks = true;
    window._jennyV232Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    var PLAY_ICON_SVG_V232 = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

    window.forceStopPauseDeckAAudioV232 = function(fullUnload) {
        window._userPausedV75_2 = true;
        window._resumingFromUserPlayV232 = false;

        // 1) Отменяем любые незавершённые промисы playTrack (чтобы через 1.8 сек RAM-движок не включил звук обратно!)
        window._audioTrackLoadSeqV216 = (window._audioTrackLoadSeqV216 || 0) + 1;
        if (typeof window.abortPendingAudioRamLoadsV216 === 'function') {
            try { window.abortPendingAudioRamLoadsV216(); } catch (e) {}
        }
        if (window._audioRamAbortCtrlV216) {
            try { window._audioRamAbortCtrlV216.abort(); } catch (e) {}
            window._audioRamAbortCtrlV216 = null;
        }

        // 2) Очищаем все таймеры подкачки окон RAM и скраббинга
        if (window._horizonSliceTimerV71) {
            clearTimeout(window._horizonSliceTimerV71);
            window._horizonSliceTimerV71 = null;
        }
        if (window._hoseArcDebounceTimerV47) {
            clearTimeout(window._hoseArcDebounceTimerV47);
            window._hoseArcDebounceTimerV47 = null;
        }

        // 3) Останавливаем и отсоединяем активный studioSourceNode
        if (window.studioSourceNode) {
            try { window.studioSourceNode.onended = null; } catch (e) {}
            try { window.studioSourceNode.stop(0); } catch (e) {}
            try { window.studioSourceNode.disconnect(); } catch (e) {}
            window.studioSourceNode = null;
        }

        // 4) Останавливаем и отсоединяем АБСОЛЮТНО ВСЕ буферные источники в _activeBufferSourcesV71
        if (window._activeBufferSourcesV71 && typeof window._activeBufferSourcesV71.forEach === 'function') {
            window._activeBufferSourcesV71.forEach(function(node) {
                if (!node) return;
                try { node.onended = null; } catch (e) {}
                try { node.stop(0); } catch (e) {}
                try { node.disconnect(); } catch (e) {}
            });
            window._activeBufferSourcesV71.clear();
        }

        window.isStudioPlaying = false;
        if (window._studioClockV74_1) {
            window._studioClockV74_1.active = false;
        }

        // 5) Останавливаем HTML5 <audio id="audioPlayer">
        var player = document.getElementById('audioPlayer');
        if (player) {
            player.loop = false;
            try { player.pause(); } catch (e) {}
            if (fullUnload) {
                try {
                    player.removeAttribute('src');
                    player.load();
                } catch (e) {}
            }
        }

        // 6) Мгновенно закрываем входной микшер WebAudio Деки А, чтобы ни один хвост буфера не звучал
        if (window.audioCtx && window.inputMixer && window.inputMixer.gain) {
            try {
                var now = window.audioCtx.currentTime;
                window.inputMixer.gain.cancelScheduledValues(now);
                window.inputMixer.gain.setValueAtTime(0.0, now);
                window.inputMixer.gain.value = 0.0;
            } catch (e) {}
        }

        if (fullUnload) {
            window.currentPlayingTrack = '';
            window.studioBuffer = null;
            window.reversedStudioBuffer = null;
            window.reconstructedMasterBufferV67 = null;
            window.reconstructedReversedBufferV67 = null;
            var np = document.getElementById('nowPlaying');
            if (np) np.innerText = '🎵 Выбери трек';
            if (typeof window.updateProgressUI === 'function') window.updateProgressUI(0, 0, false);
            if (typeof window.updateCenterCurrentTime === 'function') window.updateCenterCurrentTime(0, 0, false);
        }

        // 7) Синхронизируем иконки кнопки #playPauseBtn и всех карточек треков в списке
        var btn = document.getElementById('playPauseBtn');
        if (btn) {
            btn.innerHTML = PLAY_ICON_SVG_V232;
        }
        if (typeof window.updateTrackListPlayIcons === 'function') {
            window.updateTrackListPlayIcons();
        }
        if (typeof window.syncPermanentForegroundNotificationV212 === 'function') {
            try { window.syncPermanentForegroundNotificationV212(true); } catch (e) {}
        }
    };

    // При выключении тумблера «🎵 Дека А: Музыка [ВЫКЛ]» также гарантированно гасим все RAM-буферы через forceStopPauseDeckAAudioV232
    var _origToggleCompDeckV232 = window.toggleComplementDeckV211;
    if (typeof _origToggleCompDeckV232 === 'function') {
        window.toggleComplementDeckV211 = function(whichDeck, ev) {
            var res = _origToggleCompDeckV232.apply(this, arguments);
            if (window._jennyDualDeckV211 && !window._jennyDualDeckV211.deckA) {
                window.forceStopPauseDeckAAudioV232(false);
            }
            return res;
        };
    }
})();

/* [split] V235: кусок исходного IIFE (ui_v71.js, строки 29842–30652) → ui_video_decks.js */
;(function() {
    if (window._jennyV235Installed__video_decks) return;
    window._jennyV235Installed__video_decks = true;
    window._jennyV235Installed = true;

    // -------------------------------------------------------------------------
    // 3. ANIMATED RELOCATION OF REFRESH BUTTONS (🔄 30 & 🔄 887) FROM UNDER DECKS
    //    TO #searchRightSlotV235 + 60% VACATED SPACE EXPANSION FOR PREV / PLAY / NEXT
    // -------------------------------------------------------------------------
    window.syncTopDockedRefreshVisibilityV235 = function() {
        if (!window._refreshButtonsRelocatedToSearchV235) return;
        var dState = window._jennyDualDeckV211 || { deckA: true, deckB: false };
        var cntSpanA = document.getElementById('tracksCount');
        var refBtnA = document.getElementById('btnRefreshDeckAV235') || (cntSpanA ? cntSpanA.closest('button') : null);
        var refBtnB = document.getElementById('btnRefreshDeckBV216');

        if (refBtnA) {
            refBtnA.style.setProperty('display', dState.deckA ? 'inline-flex' : 'none', 'important');
        }
        if (refBtnB) {
            refBtnB.style.setProperty('display', dState.deckB ? 'inline-flex' : 'none', 'important');
        }
    };

    // Hook ensureDual9ButtonBarsDOMV216 so toggling decks preserves top-docked refresh buttons
    var _origEnsureDual9BarsV235 = window.ensureDual9ButtonBarsDOMV216;
    if (typeof _origEnsureDual9BarsV235 === 'function') {
        window.ensureDual9ButtonBarsDOMV216 = function() {
            var r = _origEnsureDual9BarsV235.apply(this, arguments);
            if (window._refreshButtonsRelocatedToSearchV235) {
                var mainBar = document.getElementById('mainTransportBar');
                var ctrlB = document.getElementById('deckBControlsRowV216');
                if (mainBar) mainBar.classList.add('jenny-deck-row-expanded-v235');
                if (ctrlB) ctrlB.classList.add('jenny-deck-row-expanded-v235');
                window.syncTopDockedRefreshVisibilityV235();
            }
            return r;
        };
    }

    var _origTogglePlayDeckBV216_V235 = window.togglePlayDeckBV216;
    if (typeof _origTogglePlayDeckBV216_V235 === 'function') {
        window.togglePlayDeckBV216 = function(ev) {
            if (Date.now() < (window._suppressPlayPauseUntilV235 || 0)) {
                if (ev && ev.stopPropagation) ev.stopPropagation();
                if (ev && ev.preventDefault) ev.preventDefault();
                return;
            }
            return _origTogglePlayDeckBV216_V235.apply(this, arguments);
        };
    }
})();

/* [split] V239: кусок исходного IIFE (ui_v71.js, строки 32914–32975) → ui_video_decks.js */
;(function() {

    // 4. External audio interruption sync for Deck B <video> as well (only when genuinely playing >0.4s and paused externally by OS)
    var bindVideoExtPauseV239 = function() {
        var vid = document.getElementById('jennyVideoElV130');
        if (vid && !vid._v239ExtPauseBound) {
            vid._v239ExtPauseBound = true;
            vid.addEventListener('pause', function() {
                var st = window._vidStateV130;
                if (!st || !st.active || st.userPaused || st._internalRevPause || st._playingHardwareRevStreamV219) return;
                if (vid.ended || vid.seeking || vid.readyState < 2 || vid.currentTime < 0.4) return;
                var sinceSwitch = performance.now() - (window._lastInternalMediaSrcSwitchTsV239 || 0);
                if (sinceSwitch < 700) return;
                st.userPaused = true;
                window._vidPlayIntentV132 = false;
                if (typeof window.syncVideoPlayBtnIconV132 === 'function') window.syncVideoPlayBtnIconV132();
                if (typeof window.syncVideoPlayerButtonsUIV217 === 'function') window.syncVideoPlayerButtonsUIV217();
            });
        }
    };
    setInterval(bindVideoExtPauseV239, 1500);
})();

/* [split] V240: кусок исходного IIFE (ui_v71.js, строки 32979–33429) → ui_video_decks.js */
;(function() {
    if (window._jennyV240Installed__video_decks) return;
    window._jennyV240Installed__video_decks = true;
    window._jennyV240Installed = true;

    // -------------------------------------------------------------------------
    // 4. AUTOMATIC VIDEO REMUX FOR .3GP / .MOV / EXOTIC & SPOOFED .MP4 WITHOUT CLICKING "🔊 Дор."
    // -------------------------------------------------------------------------
    var _activateSeamlessLiveRemuxV240 = function(rawBaseUrl, forceTranscode, audioTracksCount) {
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        var vid = document.getElementById('jennyVideoElV130');
        if (!st || !vid || !st.active || !rawBaseUrl) return;

        if (audioTracksCount && audioTracksCount > 0) {
            st.audioStreamsCountV218 = audioTracksCount;
        }
        var pendingRes = (vid._pendingResumeSecV135 && isFinite(vid._pendingResumeSecV135) && vid._pendingResumeSecV135 > 0.5)
            ? Number(vid._pendingResumeSecV135)
            : 0;
        if (pendingRes > 0) {
            vid._pendingResumeSecV135 = 0;
        }
        // Если live_remux уже был запущен в этом открытии (_prevOpenVidV216) и нет отложенного resumeSec — не перезапускаем второй раз!
        if (st.usingRemux && String(vid.src || '').indexOf('/api/video/live_remux') !== -1 && pendingRes <= 0) {
            return;
        }
        var curSec = pendingRes > 0
            ? pendingRes
            : ((vid.currentTime && isFinite(vid.currentTime) && vid.currentTime > 0.5) ? vid.currentTime : (st.remuxBaseOffset || 0));
        var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (vid.duration || 0);
        var aIdx = st.audioTrackIdxV216 || 0;
        var tcFlag = forceTranscode ? '1' : '0';
        var spd = window._jennyVideoSpeedV170 || (vd && vd.speed) || (window.getBaseSpeedDeckB ? window.getBaseSpeedDeckB() : 1.0);

        st.usingRemux = true;
        st.remuxBaseOffset = curSec;
        st._pendingSeekSecV167 = curSec;
        st._pendingSeekTsV167 = performance.now();

        vid.src = '/api/video/live_remux?src=' + encodeURIComponent(rawBaseUrl) +
            '&start=' + curSec.toFixed(2) +
            '&dur=' + (dur || 0).toFixed(2) +
            '&aidx=' + aIdx +
            '&transcode=' + tcFlag +
            '&t=' + Date.now();
        try {
            vid.defaultPlaybackRate = spd;
            vid.playbackRate = spd;
        } catch (e) {}
        if (!st.userPaused) {
            vid.play().catch(function() {});
        }
        if (typeof window.syncVideoPlayerButtonsUIV217 === 'function') {
            window.syncVideoPlayerButtonsUIV217();
        }
    };

    var _prevOpenVidV240 = window.openJennyVideoPlayerV130;
    if (typeof _prevOpenVidV240 === 'function' && !_prevOpenVidV240._v240Wrapped) {
        window.openJennyVideoPlayerV130 = function(streamUrl, titleStr, opts) {
            var res = _prevOpenVidV240.apply(this, arguments);
            var st = window._vidStateV130;
            var vid = document.getElementById('jennyVideoElV130');
            if (!st || !vid) return res;

            var rawBaseUrl = st.rawTorStreamUrlV214 || st.currentUrl || streamUrl || '';
            var checkStr = String(st.currentTitle || titleStr || '') + ' ' + String(rawBaseUrl || '');
            var openSessionTs = Date.now();
            st._v240OpenSessionTs = openSessionTs;

            // 1) Immediate remux for .mov, .3gp, .3g2, .ogv (in addition to .mkv, .avi, .ts, .wmv, .flv)
            var isImmediateTranscodeExt = /\.(avi|3gp|3g2|wmv|flv|mpg|mpeg|vob|ogv)(\?|$)/i.test(checkStr);
            var isImmediateRemuxExt = isImmediateTranscodeExt || /\.(mkv|mov|ts|m2ts|mts)(\?|$)/i.test(checkStr);
            if (isImmediateRemuxExt) {
                _activateSeamlessLiveRemuxV240(rawBaseUrl, isImmediateTranscodeExt, 0);
                return res;
            }

            // 2) For .mp4 / .m4v / .webm: run 15ms server smart_check_v240 + <video> error fallback
            //    so spoofed WebM-in-MP4 (09), FLAC-in-MP4 (11), Opus/VP9/AV1-in-MP4 (08, 12) switch to live_remux automatically!
            var onDirectMediaError = function() {
                if (!st.active || st._v240OpenSessionTs !== openSessionTs || st.usingRemux) return;
                _activateSeamlessLiveRemuxV240(rawBaseUrl, false, 0);
            };
            vid.addEventListener('error', onDirectMediaError, { once: true });

            window.fetch('/api/video/smart_check_v240?src=' + encodeURIComponent(rawBaseUrl))
                .then(function(r) { return r.json(); })
                .then(function(info) {
                    if (!info || info.status !== 'ok') return;
                    if (!st.active || st._v240OpenSessionTs !== openSessionTs) return;
                    if (info.audio_tracks) {
                        st.audioStreamsCountV218 = info.audio_tracks;
                    }
                    if (info.needs_remux && !st.usingRemux) {
                        _activateSeamlessLiveRemuxV240(rawBaseUrl, Boolean(info.needs_transcode), info.audio_tracks || 0);
                    }
                })
                .catch(function() {});

            return res;
        };
        window.openJennyVideoPlayerV130._v240Wrapped = true;
    }

    // Also include .3gp/.3g2/.mov in applyCurrentVideoStreamModeV217 when user toggles В+А / В / А modes!
    var _origApplyModeV217 = window.applyCurrentVideoStreamModeV217;
    if (typeof _origApplyModeV217 === 'function' && !_origApplyModeV217._v240Wrapped) {
        window.applyCurrentVideoStreamModeV217 = function(modeStr, showMsg) {
            var st = window._vidStateV130;
            if (st) {
                var chk = String(st.currentTitle || '') + ' ' + String(st.rawTorStreamUrlV214 || st.currentUrl || '');
                if (/\.(mov|3gp|3g2|mts|ogv)(\?|$)/i.test(chk)) {
                    st.usingRemux = true;
                }
            }
            return _origApplyModeV217.apply(this, arguments);
        };
        window.applyCurrentVideoStreamModeV217._v240Wrapped = true;
    }
})();

/* [split] V242: кусок исходного IIFE (ui_v71.js, строки 33743–34878) → ui_video_decks.js */
;(function() {
    if (window._jennyV242Installed__video_decks) return;
    window._jennyV242Installed__video_decks = true;
    window._jennyV242Installed = true;

    window.isCurrentViewVideoContextV242 = function() {
        var tabId = window.activePlaylistTabV71 || 'all';
        if (tabId === 'videos') return true;
        if (tabId === 'fav' && window._favSubTabV216 === 'video') return true;
        return false;
    };

    window.syncContextRefreshCounterV242 = function() {
        var cnt = window.computeActiveViewCountV242();
        var isVidCtx = window.isCurrentViewVideoContextV242();

        var cntSpanA = document.getElementById('tracksCount');
        var refBtnA = document.getElementById('btnRefreshDeckAV235') || (cntSpanA ? cntSpanA.closest('button') : null);
        var refBtnB = document.getElementById('btnRefreshDeckBV216');
        var cntSpanB = document.getElementById('tracksCountDeckBV216');

        if (cntSpanA && cntSpanA.innerText !== '⏳') {
            cntSpanA.innerText = String(cnt);
        }
        if (cntSpanB && cntSpanB.innerText !== '⏳') {
            var vItems = window.getFilteredVideoItemsV150 ? window.getFilteredVideoItemsV150() : [];
            cntSpanB.innerText = String(isVidCtx ? cnt : vItems.length);
        }

        // Once Refresh has moved up next to Search (#searchRightSlotV235), show ONE clean context-bound 🔄 N pill!
        if (window._refreshButtonsRelocatedToSearchV235) {
            if (refBtnB && refBtnB.parentElement && refBtnB.parentElement.id === 'searchRightSlotV235') {
                refBtnB.style.setProperty('display', 'none', 'important');
            }
            if (refBtnA) {
                refBtnA.style.setProperty('display', 'inline-flex', 'important');
                if (isVidCtx) {
                    refBtnA.classList.remove('ref-audio-v235');
                    refBtnA.classList.add('ref-video-v235');
                    if (cntSpanA) cntSpanA.style.color = '#60a5fa';
                } else {
                    refBtnA.classList.remove('ref-video-v235');
                    refBtnA.classList.add('ref-audio-v235');
                    if (cntSpanA) cntSpanA.style.color = '#c084fc';
                }
            }
        }
    };

    // Override refreshDeckListV216('audio') when clicked from top slot so it refreshes active context cleanly
    var _origRefreshDeckListV242 = window.refreshDeckListV216;
    window.refreshDeckListV216 = async function(whichDeck, ev) {
        if (window._refreshButtonsRelocatedToSearchV235 || whichDeck === 'audio') {
            return window.refreshActiveContextListV242(ev);
        }
        return _origRefreshDeckListV242 ? _origRefreshDeckListV242.apply(this, arguments) : undefined;
    };

    window.syncTopDockedRefreshVisibilityV235 = function() {
        window.syncContextRefreshCounterV242();
    };

    var _origSyncDualCountersV242 = window.syncDualDeckCountersV216;
    window.syncDualDeckCountersV216 = function() {
        if (typeof _origSyncDualCountersV242 === 'function') {
            _origSyncDualCountersV242.apply(this, arguments);
        }
        window.syncContextRefreshCounterV242();
    };
    var _origDlYtV242 = window.downloadYoutubeVideoV230;
    if (typeof _origDlYtV242 === 'function') {
        window.downloadYoutubeVideoV230 = async function() {
            var r = await _origDlYtV242.apply(this, arguments);
            window.refreshJennyHubSummaryV242();
            return r;
        };
    }
})();

/* [split] V243: кусок исходного IIFE (ui_v71.js, строки 35225–35944) → ui_video_decks.js */
;(function() {
    if (window._jennyV243Installed__video_decks) return;
    window._jennyV243Installed__video_decks = true;
    window._jennyV243Installed = true;

    // -------------------------------------------------------------------------
    // 3. ПОЛУПРОЗРАЧНЫЕ ЗОНЫ ПРЕД./СЛЕД. ПОД КНОПКАМИ -10 И +10 В ВИДЕОПЛЕЕРЕ
    // -------------------------------------------------------------------------
    window.ensureVideoPrevNextZonesV243 = function() {
        var centerPlay = document.getElementById('v130CenterPlayBtn');
        if (!centerPlay || !centerPlay.parentElement) return;
        var centerRow = centerPlay.parentElement;
        if (document.getElementById('v243VideoPrevNextRow')) return;

        var prevSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>';
        var nextSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>';

        var navRow = document.createElement('div');
        navRow.id = 'v243VideoPrevNextRow';
        navRow.innerHTML =
            '<button type="button" class="v243-vid-adj-zone" onclick="event.stopPropagation();window.playAdjacentVideoDeckBV216(-1, event)" title="Предыдущее видео">' +
                prevSvg + '<span>Пред.</span>' +
            '</button>' +
            '<div style="width:42px;flex-shrink:0;pointer-events:none;"></div>' +
            '<button type="button" class="v243-vid-adj-zone" onclick="event.stopPropagation();window.playAdjacentVideoDeckBV216(1, event)" title="Следующее видео">' +
                '<span>След.</span>' + nextSvg +
            '</button>';
        centerRow.insertAdjacentElement('afterend', navRow);
    };

    // -------------------------------------------------------------------------
    // 4. ЧИСТОЕ ПЕРЕКЛЮЧЕНИЕ РАДИО БЕЗ УТЕЧКИ СОКЕТОВ + ЕДИНАЯ ШТОРКА ANDROID
    // -------------------------------------------------------------------------
    window.releaseDetachedAudioSocketV243 = function(audEl) {
        if (!audEl || audEl.id === 'audioPlayer' || audEl.id === 'jennyVideoElV130') return;
        try {
            audEl.onended = null;
            audEl.onerror = null;
            audEl.onstalled = null;
            audEl.onwaiting = null;
            audEl.ontimeupdate = null;
            audEl.pause();
            audEl.removeAttribute('src');
            audEl.src = '';
            audEl.load();
        } catch (e) {}
    };
})();

/* [split] V360: кусок исходного IIFE (ui_v71.js, строки 35973–36584) → ui_video_decks.js */
;(function() {
    if (window._jennyV360ClockAndModalPatchInstalled__video_decks) return;
    window._jennyV360ClockAndModalPatchInstalled__video_decks = true;
    window._jennyV360ClockAndModalPatchInstalled = true;

    // 2. ПОЛНОЕ РАЗДЕЛЕНИЕ ПОИСКА АУДИО (ДЕКА А) И ПОИСКА ВИДЕО (ДЕКА Б) (#365):
    //    - window.fetchData() (/api/data) ищет ТОЛЬКО аудиофайлы для Деки А и не трогает видео.
    //    - window.syncDiscoveredVideosIntoPlaylistV134() (:8082/api/video/discovered_list) ищет ТОЛЬКО видеофайлы
    //      для Деки Б и не трогает window.lastData.all_tracks!
    //    - Запускается сразу после старта плеера И при переключении на вкладку «🎬 Видео».
    window.isVideoTrackAllowedByFormatSlotsV150 = function(filename) {
        if (!filename) return true;
        var lower = String(filename).toLowerCase().trim();
        try {
            var slotsObj = window.ensureDualDeckFormatSlotsV150 ? window.ensureDualDeckFormatSlotsV150() : null;
            var videoSlots = (slotsObj && Array.isArray(slotsObj.videoSlots)) ? slotsObj.videoSlots : [];
            var activeExts = videoSlots
                .filter(function(s) { return s && s.en && String(s.ext || '').trim(); })
                .map(function(s) { return '.' + String(s.ext).trim().toLowerCase().replace(/^\.+/, ''); });
            if (activeExts.length > 0) {
                return activeExts.some(function(ext) { return lower.endsWith(ext); });
            }
        } catch (e) {}
        return Boolean(window.isVideoFileNameV130 && window.isVideoFileNameV130(filename));
    };

    window.syncDiscoveredVideosIntoPlaylistV134 = async function(forceScan) {
        try {
            var res = await fetch('/api/video/discovered_list' + (forceScan ? '?force=1' : ''));
            if (res.ok) {
                var data = await res.json();
                if (data.video_dir) window._dedicatedVideoDirPathV137 = data.video_dir;
                var items = data.items || [];
                var nextMap = {};
                items.forEach(function(it) {
                    if (it && it.name) nextMap[it.name] = it;
                });
                window._dedicatedVideoMetaMapV137 = nextMap;
            }
        } catch (e) {}

        var mergedItems = window.collectClientTorrentVideosV137
            ? window.collectClientTorrentVideosV137()
            : Object.values(window._dedicatedVideoMetaMapV137 || {});
        window._dedicatedVideoListV137 = mergedItems.map(function(x) { return x.name; }).sort();

        if (typeof window.mountPlaylistStripDOMV71 === 'function') window.mountPlaylistStripDOMV71();
        if (typeof window.renderPlaylistStripChipsV71 === 'function') window.renderPlaylistStripChipsV71();
        if (window.activePlaylistTabV71 === 'videos' && typeof window.renderActivePlaylistTracksV71 === 'function') {
            window.renderActivePlaylistTracksV71(false);
        }
        if (typeof window.syncDualDeckCountersV216 === 'function') {
            window.syncDualDeckCountersV216();
        }
        if (typeof window.syncContextRefreshCounterV242 === 'function') {
            window.syncContextRefreshCounterV242();
        }
    };

    // Сразу после загрузки плеера параллельно и независимо запускаем поиск видео для Деки Б!
    setTimeout(function() {
        window.syncDiscoveredVideosIntoPlaylistV134(true);
    }, 120);

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

    window._inLayoutSyncGuardV363 = false;
})();

/* [split] V369: кусок исходного IIFE (ui_v71.js, строки 36607–37839) → ui_video_decks.js */
;(function() {
    if (window._jennyV369Installed__video_decks) return;
    window._jennyV369Installed__video_decks = true;
    window._jennyV369Installed = true;

    window.openVideoDeckDspStudioV131 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._vidStateV130;
        if (st && !st.pipMode && typeof window.toggleVideoPipModeV130 === 'function') {
            window.toggleVideoPipModeV130();
        }
        if (typeof window.openDeckBIsolatedSettingsModal === 'function') {
            window.openDeckBIsolatedSettingsModal(ev, 'sec_top', true);
        }
        window.mountModularLabSettingsV208();
        var vidSettingsBox = document.getElementById('jennyModularLabBoxV208');
        if (vidSettingsBox) {
            vidSettingsBox.open = true;
            setTimeout(function() {
                if (vidSettingsBox.scrollIntoView) vidSettingsBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 120);
        }
    };

    // 4. TURBO 4-WORKER BATCHED RAM UNPACKER FOR DECK B (`decodeVideoToRamV131`)
    //    - Deduplicates repeated calls for the same (url, audioTrackIdx) so video open never aborts Piece 0!
    //    - Immediately decodes the urgent 45s piece around current playback time `curSec` (~150ms) and publishes
    //      `vd.studioBuffer` (#3 Forward) and `vd.reversedStudioBuffer` (#4 Reverse) with ZERO artificial sleep!
    //    - Then uses 4 parallel workers fetching 180s (4-piece) batches in single FFmpeg passes so a 21-min MKV
    //      unpacks 100% into RAM in ~1.5–2.5 seconds!
    window.normalizeVideoRamKeyV369 = function(rawUrl) {
        var u = String(rawUrl || '').trim();
        if (window.stripJennyLocalOriginV238) u = window.stripJennyLocalOriginV238(u);
        return u.split('?')[0];
    };

    window.decodeVideoToRamV131 = async function(streamUrl, titleStr, forceRestart) {
        var st = window._vidStateV130 || {};
        if (st.torHash && !st.isReadyLocalV212 && String(streamUrl || '').indexOf('/api/torrent/stream/') !== -1) {
            return null;
        }
        if (typeof window.initVideoDeckAudioV131 === 'function') window.initVideoDeckAudioV131();
        var vd = window.videoDeckV131;
        if (!vd || !vd.ctx) return null;

        var rawBaseUrl = st.rawTorStreamUrlV214 || st.currentUrl || streamUrl || '';
        var normKey = window.normalizeVideoRamKeyV369(rawBaseUrl);
        var curAidx = Number(st.audioTrackIdxV216 || 0);
        if (!normKey) return null;

        // Deduplicate: if we are ALREADY decoding or have decoded this exact video & audio track, do NOT abort and restart!
        if (
            !forceRestart &&
            vd._lastDecodedNormKeyV369 === normKey &&
            vd._lastDecodedAidxV369 === curAidx &&
            (vd._isLoadingRamV359 || (vd.studioBuffer && vd.studioBuffer._allPiecesLoadedV72))
        ) {
            if (vd._activeDecodePromiseV369) return vd._activeDecodePromiseV369;
            if (vd.studioBuffer) return vd.studioBuffer;
        }

        vd._lastDecodedNormKeyV369 = normKey;
        vd._lastDecodedAidxV369 = curAidx;

        var mySess = ++vd.ramDecodeSession;
        if (vd.pieceAbortCtrl) { try { vd.pieceAbortCtrl.abort(); } catch (e) {} }
        if (Array.isArray(vd._batchAbortCtrlsV369)) {
            vd._batchAbortCtrlsV369.forEach(function(c) { try { c.abort(); } catch (e) {} });
        }
        vd._batchAbortCtrlsV369 = [];
        vd.studioBuffer = null;
        vd.reversedStudioBuffer = null;

        var runPromise = (async function() {
            var vid = document.getElementById('jennyVideoElV130');
            var dur = 0;
            try {
                var mr = await (window.fetchDeckBPcmWithPort8082
                    ? window.fetchDeckBPcmWithPort8082('/api/video/pcm_meta?src=' + encodeURIComponent(rawBaseUrl))
                    : fetch('/api/video/pcm_meta?src=' + encodeURIComponent(rawBaseUrl)));
                if (mr.ok) {
                    var md = await mr.json();
                    dur = parseFloat(md.duration) || 0;
                }
            } catch (e) {}

            if (!dur && vid) {
                for (var w = 0; w < 25; w++) {
                    if (mySess !== vd.ramDecodeSession) return null;
                    var dCand = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(vid) : vid.duration;
                    if (isFinite(dCand) && dCand > 0) { dur = dCand; break; }
                    await new Promise(function(r) { setTimeout(r, 100); });
                }
            }
            if (dur <= 0 || mySess !== vd.ramDecodeSession) return null;
            if (window._vidStateV130) window._vidStateV130.trueDuration = dur;

            var srCandidates = (dur > 5400) ? [24000, 16000] : ((dur > 2400) ? [32000, 24000] : [44100, 32000]);
            var sr = srCandidates[0], totalFrames = 0, audioBuf = null, revAudioBuf = null;
            for (var sIdx = 0; sIdx < srCandidates.length; sIdx++) {
                try {
                    sr = srCandidates[sIdx];
                    totalFrames = Math.floor(dur * sr);
                    audioBuf = vd.ctx.createBuffer(2, totalFrames, sr);
                    revAudioBuf = vd.ctx.createBuffer(2, totalFrames, sr);
                    if (audioBuf && revAudioBuf) break;
                } catch (e) {
                    audioBuf = null;
                    revAudioBuf = null;
                }
            }
            if (!audioBuf) {
                var fallbackSrs = [24000, 16000, 12000];
                for (var fIdx = 0; fIdx < fallbackSrs.length; fIdx++) {
                    try {
                        sr = fallbackSrs[fIdx];
                        totalFrames = Math.floor(dur * sr);
                        audioBuf = vd.ctx.createBuffer(2, totalFrames, sr);
                        revAudioBuf = vd.ctx.createBuffer(2, totalFrames, sr);
                        if (audioBuf && revAudioBuf) break;
                    } catch (e) {}
                }
            }
            if (!audioBuf || mySess !== vd.ramDecodeSession) return null;

            var chL = audioBuf.getChannelData(0), chR = audioBuf.getChannelData(1);
            var revL = revAudioBuf ? revAudioBuf.getChannelData(0) : null;
            var revR = revAudioBuf ? revAudioBuf.getChannelData(1) : null;

            var PIECE_SEC = 45;
            var numPieces = Math.max(1, Math.ceil(dur / PIECE_SEC));
            var pieceMap = new Uint8Array(numPieces);
            var revPieceMap = new Uint8Array(numPieces);
            var failCounts = new Uint8Array(numPieces);

            audioBuf._pieceSecV72 = PIECE_SEC;
            audioBuf._pieceMapV72 = pieceMap;
            audioBuf._loadedCountV72 = 0;
            audioBuf._allPiecesLoadedV72 = false;
            audioBuf._trueDurationV72 = dur;
            audioBuf._ramTotalMbV134 = Math.round((totalFrames * 8 * (revAudioBuf ? 2 : 1)) / (1024 * 1024));

            if (revAudioBuf) {
                revAudioBuf._pieceSecV72 = PIECE_SEC;
                revAudioBuf._pieceMapV72 = revPieceMap;
                revAudioBuf._loadedCountV72 = 0;
                revAudioBuf._allPiecesLoadedV72 = false;
                revAudioBuf._trueDurationV72 = dur;
            }

            var cleanTitleB = titleStr || (window._vidStateV130 && window._vidStateV130.currentTitle) || '';
            vd.title = cleanTitleB;
            vd._isLoadingRamV359 = true;
            vd._ramPiecesLoadedV359 = 0;
            vd._ramPiecesTotalV359 = numPieces;
            vd._ramDecodeStartWallMsV359 = performance.now();

            // Publish buffers immediately so urgent pieces can be used the instant they land!
            vd.studioBuffer = audioBuf;
            vd.reversedStudioBuffer = revAudioBuf;

            if (typeof window.refreshFourBuffersHudV359 === 'function') window.refreshFourBuffersHudV359();
            if (typeof window.updateVideoAvSyncRadarUIV367 === 'function') window.updateVideoAvSyncRadarUIV367();

            var fetchPieceBatch = async function(startPIdx, countPieces, isUrgent) {
                if (mySess !== vd.ramDecodeSession) return false;
                var actualIndices = [];
                for (var k = 0; k < countPieces; k++) {
                    var p = startPIdx + k;
                    if (p >= 0 && p < numPieces && pieceMap[p] === 0) {
                        pieceMap[p] = 1;
                        actualIndices.push(p);
                    } else {
                        break;
                    }
                }
                if (actualIndices.length === 0) return true;

                var firstP = actualIndices[0];
                var lastP = actualIndices[actualIndices.length - 1];
                var stSec = firstP * PIECE_SEC;
                var endSec = Math.min(dur, (lastP + 1) * PIECE_SEC);
                var dSec = Math.max(0.5, endSec - stSec);

                var ctrl = new AbortController();
                vd._batchAbortCtrlsV369.push(ctrl);

                try {
                    var u = '/api/video/pcm_chunk?src=' + encodeURIComponent(rawBaseUrl) +
                        '&start=' + stSec.toFixed(3) +
                        '&dur=' + dSec.toFixed(3) +
                        '&sr=' + sr +
                        '&aidx=' + curAidx;
                    var res = await (window.fetchDeckBPcmWithPort8082
                        ? window.fetchDeckBPcmWithPort8082(u, ctrl.signal)
                        : fetch(u, { signal: ctrl.signal }));
                    if (!res.ok || mySess !== vd.ramDecodeSession) {
                        actualIndices.forEach(function(p) { if (pieceMap[p] === 1) pieceMap[p] = 0; });
                        return false;
                    }
                    var ab = await res.arrayBuffer();
                    if (mySess !== vd.ramDecodeSession) return false;
                    var frames = Math.floor(ab.byteLength / 8);
                    if (frames <= 0) {
                        actualIndices.forEach(function(p) { if (pieceMap[p] === 1) pieceMap[p] = 0; });
                        return false;
                    }
                    var startFrame = Math.min(totalFrames, Math.floor(stSec * sr));
                    var maxCopy = Math.min(frames, totalFrames - startFrame);
                    if (maxCopy > 0) {
                        var leftArr = new Float32Array(ab, 0, frames);
                        var rightArr = new Float32Array(ab, frames * 4, frames);
                        // Fill Buffer #3 (Video Forward)
                        chL.set(leftArr.subarray(0, maxCopy), startFrame);
                        chR.set(rightArr.subarray(0, maxCopy), startFrame);
                        // Fill Buffer #4 (Video Reverse)
                        if (revL && revR) {
                            var dstIdx = totalFrames - 1 - startFrame;
                            for (var i = 0; i < maxCopy; i++, dstIdx--) {
                                revL[dstIdx] = leftArr[i];
                                revR[dstIdx] = rightArr[i];
                            }
                        }
                    }

                    var newlyCompleted = 0;
                    actualIndices.forEach(function(p) {
                        if (pieceMap[p] !== 2) {
                            pieceMap[p] = 2;
                            revPieceMap[numPieces - 1 - p] = 2;
                            newlyCompleted++;
                        }
                    });
                    audioBuf._loadedCountV72 += newlyCompleted;
                    if (revAudioBuf) revAudioBuf._loadedCountV72 = audioBuf._loadedCountV72;
                    vd._ramPiecesLoadedV359 = audioBuf._loadedCountV72;
                    vd._ramPiecesTotalV359 = numPieces;

                    if (audioBuf._loadedCountV72 >= numPieces) {
                        audioBuf._allPiecesLoadedV72 = true;
                        if (revAudioBuf) revAudioBuf._allPiecesLoadedV72 = true;
                        vd._isLoadingRamV359 = false;
                    }

                    if (newlyCompleted > 0 && audioBuf._loadedCountV72 === newlyCompleted && vd.config && vd.config.opt_autoRms) {
                        try { window.computeBufferAutoGainDeckB(audioBuf, vd.config.val_autoRms); } catch (e) {}
                    }

                    if (typeof window.refreshFourBuffersHudV359 === 'function') window.refreshFourBuffersHudV359();
                    if (typeof window.syncVideoRamEngineV211 === 'function') window.syncVideoRamEngineV211(false, Boolean(isUrgent && !vd.isStudioPlaying));
                    if (typeof window.updateVideoAvSyncRadarUIV367 === 'function') window.updateVideoAvSyncRadarUIV367();
                    return true;
                } catch (e) {
                    actualIndices.forEach(function(p) { if (pieceMap[p] === 1) pieceMap[p] = 0; });
                    return false;
                }
            };

            // Expose on-demand urgent piece loader so seeking or pressing Reverse at 12:44 prioritizes that piece in ~150ms!
            vd._ensureUrgentPieceAtSecV369 = function(targetSec) {
                if (mySess !== vd.ramDecodeSession || !window._vidStateV130 || !window._vidStateV130.active) return;
                var pIdx = Math.max(0, Math.min(numPieces - 1, Math.floor(Math.max(0, Number(targetSec) || 0) / PIECE_SEC)));
                if (pieceMap[pIdx] === 0) {
                    fetchPieceBatch(pIdx, 1, true);
                }
                var isRevNow = Boolean(window.isReversedDeckB || vd.isReversed);
                var adjP = isRevNow ? (pIdx - 1) : (pIdx + 1);
                if (adjP >= 0 && adjP < numPieces && pieceMap[adjP] === 0) {
                    fetchPieceBatch(adjP, 1, true);
                }
            };

            var pickNextTask = function() {
                var curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid ? vid.currentTime : 0);
                var curPiece = Math.max(0, Math.min(numPieces - 1, Math.floor(Math.max(0, curSec) / PIECE_SEC)));
                var isRev = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed) || vd.isReversed);
                var stepDir = isRev ? -1 : 1;

                // 1) Urgent: current piece and immediate next piece in playback direction (single 45s piece for ~150ms response!)
                for (var look = 0; look < 2; look++) {
                    var cand = curPiece + look * stepDir;
                    if (cand >= 0 && cand < numPieces && pieceMap[cand] === 0 && failCounts[cand] < 4) {
                        return { idx: cand, count: 1, urgent: true };
                    }
                }
                // 2) Background batch: grab up to 4 contiguous unloaded pieces (180s) at once!
                for (var offset = 0; offset < numPieces; offset++) {
                    var candBg = (curPiece + offset) % numPieces;
                    if (pieceMap[candBg] === 0 && failCounts[candBg] < 4) {
                        var batchLen = 1;
                        while (batchLen < 4 && (candBg + batchLen) < numPieces && pieceMap[candBg + batchLen] === 0 && failCounts[candBg + batchLen] < 4) {
                            batchLen++;
                        }
                        return { idx: candBg, count: batchLen, urgent: false };
                    }
                }
                return null;
            };

            // Step A: Immediately decode the urgent starter piece around current time before launching bulk workers
            var firstTask = pickNextTask();
            if (firstTask) {
                await fetchPieceBatch(firstTask.idx, 1, true);
            }

            // Step B: Launch 4 parallel workers to unpack the remaining pieces in 180s batches!
            var workerLoop = async function() {
                while (mySess === vd.ramDecodeSession && window._vidStateV130 && window._vidStateV130.active) {
                    var task = pickNextTask();
                    if (!task) break;
                    var ok = await fetchPieceBatch(task.idx, task.count, task.urgent);
                    if (mySess !== vd.ramDecodeSession) return;
                    if (!ok) {
                        failCounts[task.idx]++;
                        await new Promise(function(r) { setTimeout(r, 100); });
                    }
                }
            };

            await Promise.all([workerLoop(), workerLoop(), workerLoop(), workerLoop()]);

            if (mySess === vd.ramDecodeSession) {
                vd._isLoadingRamV359 = false;
                if (audioBuf._loadedCountV72 >= numPieces) {
                    audioBuf._allPiecesLoadedV72 = true;
                    if (revAudioBuf) revAudioBuf._allPiecesLoadedV72 = true;
                }
                if (typeof window.refreshFourBuffersHudV359 === 'function') window.refreshFourBuffersHudV359();
                if (typeof window.syncVideoRamEngineV211 === 'function') window.syncVideoRamEngineV211(false, false);
                if (typeof window.updateVideoAvSyncRadarUIV367 === 'function') window.updateVideoAvSyncRadarUIV367();
            }
            return audioBuf;
        })();

        vd._activeDecodePromiseV369 = runPromise;
        return runPromise;
    };

    // When switching audio track via "🔊 Дор.", reload RAM Buffers #3 & #4 for the newly selected audio track!
    var _origSwitchRemuxV369 = window.switchVideoToFfmpegRemuxV130;
    window.switchVideoToFfmpegRemuxV130 = function(ev, forceTranscodeVideo) {
        var r = _origSwitchRemuxV369 ? _origSwitchRemuxV369.apply(this, arguments) : undefined;
        var st = window._vidStateV130 || {};
        if (ev && st.active && st.currentUrl) {
            window.decodeVideoToRamV131(st.rawTorStreamUrlV214 || st.currentUrl, st.currentTitle, true);
        }
        return r;
    };

    // Improve getEffectiveVideoCurrentTimeV167 during reverse startup:
    // While `reverse_remux` is rendering the first video clip (`!st._revStreamStartedPlayingV220`),
    // if RAM Buffer #4 is already playing reversed audio (`vd.isStudioPlaying && vd._ramAnchorRevV367`),
    // advance the reverse timeline smoothly from the WebAudio clock so the timer and audio move backwards immediately!
    var _origGetEffTimeV369 = window.getEffectiveVideoCurrentTimeV167;
    window.getEffectiveVideoCurrentTimeV167 = window.getEffectiveVideoCurrentTimeV210 = function(vid) {
        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        var isRev = Boolean(vd.isReversed || window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
        if (st.active && !st.userPaused && isRev && st._playingHardwareRevStreamV219 && !st._revStreamStartedPlayingV220) {
            if (vd.isStudioPlaying && vd.ctx && vd._ramAnchorCtxTimeV367 !== undefined && vd._ramAnchorMediaSecV367 !== undefined) {
                var el = Math.max(0, vd.ctx.currentTime - vd._ramAnchorCtxTimeV367);
                var spd = Number(vd.speed || window._jennyVideoSpeedV170 || 1.0);
                var effRamRev = Math.max(0, vd._ramAnchorMediaSecV367 - el * spd);
                st._lastTrueMediaSecV227 = effRamRev;
                return effRamRev;
            }
            if (st._revWallClockStartTsV369 && st._revWallClockAnchorSecV369 !== undefined) {
                var wallEl = Math.max(0, (performance.now() - st._revWallClockStartTsV369) / 1000.0);
                var spdW = Number(vd.speed || window._jennyVideoSpeedV170 || 1.0);
                var effWallRev = Math.max(0, st._revWallClockAnchorSecV369 - wallEl * spdW);
                return effWallRev;
            }
        }
        return _origGetEffTimeV369 ? _origGetEffTimeV369.apply(this, arguments) : 0;
    };

    // Prioritize urgent RAM piece on any forward/reverse seek as well!
    var _origSeekSyncedV369 = window.seekDeckBAndPlayerSyncedV212;
    if (typeof _origSeekSyncedV369 === 'function') {
        window.seekDeckBAndPlayerSyncedV212 = function(targetSec, showToastMsg, fromExplicitUser) {
            var vd = window.videoDeckV131;
            var st = window._vidStateV130 || {};
            st._lastSeekWallTsV372 = performance.now();
            st._vidAdvancingAfterSeekV372 = false;
            st._lastRawVidTimeForAdvanceV372 = -1;
            if (vd) {
                if (vd.horizonTimer) { clearTimeout(vd.horizonTimer); vd.horizonTimer = null; }
                if (vd.sourceNode) {
                    vd.sourceNode.onended = null;
                    try { vd.sourceNode.stop(); } catch (e) {}
                    try { vd.sourceNode.disconnect(); } catch (e) {}
                    vd.sourceNode = null;
                }
                vd.isStudioPlaying = false;
                if (typeof vd._ensureUrgentPieceAtSecV369 === 'function') {
                    vd._ensureUrgentPieceAtSecV369(targetSec);
                }
            }
            var r = _origSeekSyncedV369.apply(this, arguments);
            return r;
        };
    }

    // 6. FIX FALSE VIDEO PAUSE & ADD UNIVERSAL VIDEO STALL / OVERLAY-RETURN AUTO-HEAL WATCHDOG (Fix 4)
    //    Neutralize V239's false `pause` listener that set `st.userPaused = true` when WebView paused <video> on buffer/overlay transition!
    window._lastExplicitVideoUserPauseTsV369 = 0;
    var _origToggleVidPlayPauseV369 = window.toggleVideoPlayPauseV130;
    window.toggleVideoPlayPauseV130 = function(ev) {
        window._lastExplicitVideoUserPauseTsV369 = performance.now();
        return _origToggleVidPlayPauseV369 ? _origToggleVidPlayPauseV369.apply(this, arguments) : undefined;
    };

    var bindVideoAutoResumeAndStallHealV369 = function() {
        var vid = document.getElementById('jennyVideoElV130');
        if (vid && !vid._v369HealBound) {
            vid._v369HealBound = true;
            // Capture-phase listener runs BEFORE V239's bubble listener and prevents false userPaused flips!
            vid.addEventListener('pause', function() {
                var st = window._vidStateV130;
                var vd = window.videoDeckV131 || {};
                if (!st || !st.active) return;
                var sinceUserClick = performance.now() - (window._lastExplicitVideoUserPauseTsV369 || 0);
                if (sinceUserClick > 450 && !st.userPaused && window._vidPlayIntentV132 && !vd.isReversed && !st._internalRevPause) {
                    // Stamp _lastInternalMediaSrcSwitchTsV239 so V239's listener ignores this OS/buffer pause!
                    window._lastInternalMediaSrcSwitchTsV239 = performance.now();
                }
            }, true);
        }
    };

    // When entering or returning from Android Desktop Overlay, ensure <video> continues smoothly without stalling!
    var _origOnDesktopOverlayV369 = window.onDesktopOverlayStateChangedV133;
    window.onDesktopOverlayStateChangedV133 = function(isOverlay) {
        window._lastInternalMediaSrcSwitchTsV239 = performance.now();
        var r = _origOnDesktopOverlayV369 ? _origOnDesktopOverlayV369.apply(this, arguments) : undefined;
        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        var vid = document.getElementById('jennyVideoElV130');
        if (st.active && !st.userPaused && window._vidPlayIntentV132 && vid && !vd.isReversed) {
            if (vid.paused) {
                vid.play().catch(function() {});
            }
            st._overlayTransitionCheckTsV369 = performance.now();
        }
        return r;
    };

    // Universal Video Stall Watchdog (works for BOTH local .mkv/.mp4/.avi files AND torrents!)
    window._lastWatchdogVidTimeV369 = -1;

    setInterval(function() {
        bindVideoAutoResumeAndStallHealV369();
        var st = window._vidStateV130;
        var vd = window.videoDeckV131 || {};
        var vid = document.getElementById('jennyVideoElV130');
        if (!st || !st.active || !vid || st.userPaused || !window._vidPlayIntentV132) {
            window._lastWatchdogVidTimeV369 = -1;
            window._lastWatchdogProgressTsV369 = performance.now();
            return;
        }

        var isRev = Boolean(vd.isReversed || window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
        if (isRev) {
            window._lastWatchdogVidTimeV369 = vid.currentTime || 0;
            window._lastWatchdogProgressTsV369 = performance.now();
            return;
        }

        var now = performance.now();
        var rawT = Number(vid.currentTime || 0);
        if (Math.abs(rawT - window._lastWatchdogVidTimeV369) > 0.015) {
            window._lastWatchdogVidTimeV369 = rawT;
            window._lastWatchdogProgressTsV369 = now;
            if (st._autoHealingRemuxV369 && vid.readyState >= 2 && !vid.paused) {
                st._autoHealingRemuxV369 = false;
                window._vidIsBufferingV132 = false;
                if (typeof window.releaseHeldVideoFrameV220 === 'function') window.releaseHeldVideoFrameV220();
                if (typeof window.syncVideoPlayBtnIconV132 === 'function') window.syncVideoPlayBtnIconV132();
            }
            return;
        }

        var stalledMs = now - (window._lastWatchdogProgressTsV369 || now);
        var sinceLastHeal = now - (window._lastWatchdogHealTsV369 || 0);
        var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (vid.duration || 0);
        var curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (rawT + (st.remuxBaseOffset || 0));
        var isNearEnd = (dur > 5 && curSec >= dur - 1.8);

        if (isNearEnd) return;

        // First try gentle play() if WebView paused the element with buffered frames available
        if (vid.paused && !vid.ended && vid.readyState >= 2 && stalledMs > 350 && stalledMs < 1300) {
            window._lastInternalMediaSrcSwitchTsV239 = now;
            vid.play().catch(function() {});
            return;
        }

        // If frames have stopped advancing for > 1.35s (or stream prematurely ended/stalled), seamlessly reconnect live_remux at curSec!
        if (!window._vidIsBufferingV132 && !vid.seeking && (now - (st._lastSeekWallTsV372 || st._pendingSeekTsV167 || 0) > 6500) && stalledMs > 4500 && sinceLastHeal > 8000) {
            window._lastWatchdogHealTsV369 = now;
            window._lastWatchdogProgressTsV369 = now;
            st._autoHealingRemuxV369 = true;
            if (typeof window.captureAndHoldVideoFrameV220 === 'function') {
                window.captureAndHoldVideoFrameV220(1600);
            }
            window.seekDeckBAndPlayerSyncedV212(curSec, false, true);
            // Keep RAM Buffer #3 playing smoothly during the 150ms video reconnect!
            if (typeof window.syncVideoRamEngineV211 === 'function') {
                window.syncVideoRamEngineV211(false, false);
            }
        }
    }, 400);

    // 8. Real-time, honest calculation of Android DAC output + active Deck B DSP modules latency
    window.getDeckBHardwareAndDspLatencySecV367 = function() {
        var vd = window.videoDeckV131 || {};
        var st = window._vidStateV130 || {};
        var cfg = vd.config || {};
        var ctx = vd.ctx;

        var sr = (ctx && ctx.sampleRate) ? ctx.sampleRate : 48000;
        var baseLat = (ctx && typeof ctx.baseLatency === 'number' && isFinite(ctx.baseLatency) && ctx.baseLatency > 0)
            ? ctx.baseLatency
            : (256 / sr);
        var outLat = (ctx && typeof ctx.outputLatency === 'number' && isFinite(ctx.outputLatency) && ctx.outputLatency > 0)
            ? ctx.outputLatency
            : 0.040;
        var ctxSec = baseLat + outLat;

        var dspMs = 0.0;
        var activeDspTags = [];
        if (!st.dspBypass) {
            if (cfg.firEnabled && cfg.firSettings) {
                var decayMs = parseFloat(cfg.firSettings.decay);
                if (!isFinite(decayMs) || decayMs <= 0) decayMs = 1.28;
                var firDelayMs = 2.67 + Math.min(25.0, decayMs * 0.42);
                dspMs += firDelayMs;
                activeDspTags.push('FIR ' + firDelayMs.toFixed(1) + 'мс');
            }
            if (cfg.eqEnabled) {
                var eqCfg = cfg.eq || {};
                var anyNonZero = [60, 230, 910, 3600, 14000].some(function(f) {
                    return Math.abs(parseFloat(eqCfg['b' + f]) || 0) > 0.1;
                });
                var eqDelayMs = anyNonZero ? 1.85 : 0.65;
                dspMs += eqDelayMs;
                activeDspTags.push('EQ ' + eqDelayMs.toFixed(1) + 'мс');
            }
            if (cfg.limiterEnabled) {
                if (cfg.multiBandEnabled) {
                    var mbDelayMs = 6.0 + 1.9;
                    dspMs += mbDelayMs;
                    activeDspTags.push('3-Band+Лим ' + mbDelayMs.toFixed(1) + 'мс');
                } else {
                    dspMs += 6.0;
                    activeDspTags.push('Лимитер 6.0мс');
                }
                if (cfg.opt_deEsser) {
                    dspMs += 0.8;
                }
            }
            if (cfg.opt_monoBass) {
                dspMs += 1.1;
                activeDspTags.push('МоноБас 1.1мс');
            }
            if (cfg.opt_punch) {
                dspMs += 1.4;
                activeDspTags.push('Панч 1.4мс');
            }
            if (cfg.opt_msWidth) {
                var wPct = parseFloat(cfg.val_msWidth);
                var msDelay = (!isNaN(wPct) && wPct > 100) ? 1.8 : 0.7;
                dspMs += msDelay;
                activeDspTags.push('Стерео ' + msDelay.toFixed(1) + 'мс');
            }
            if (cfg.opt_crossfeed) {
                var cfPct = parseFloat(cfg.val_crossfeed) || 65;
                var cfDelay = 0.42 + (cfPct / 100.0) * 0.45;
                dspMs += cfDelay;
                activeDspTags.push('Бинаурал ' + cfDelay.toFixed(1) + 'мс');
            }
            if (cfg.opt_masterCeil || cfg.phaseFixEnabled) {
                dspMs += 0.5;
            }
        }

        var dspSec = dspMs / 1000.0;
        var totalRamPipelineSec = Math.max(0.04, Math.min(0.80, ctxSec + dspSec + 0.085));

        return {
            ctxMs: Math.round(ctxSec * 1000),
            dspMs: Math.round(dspMs * 10) / 10,
            dspBreakdown: activeDspTags.length > 0 ? activeDspTags.join(' + ') : (st.dspBypass ? 'DSP Выкл (0мс)' : 'Базовый тракт (0.5мс)'),
            totalRamPipelineSec: totalRamPipelineSec
        };
    };

    window.toggleAvSyncEdgeDrawerV368 = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        window._jennyAvSyncEdgeExpandedV368 = !window._jennyAvSyncEdgeExpandedV368;
        window.updateVideoAvSyncRadarUIV367();
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    window.adjustVideoAvSyncTrimV367 = function(deltaSec, resetToAuto, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (resetToAuto) {
            window._jennyVideoUserAvTrimSecV367 = 0.0;
        } else {
            var next = Number(window._jennyVideoUserAvTrimSecV367 || 0) + Number(deltaSec || 0);
            window._jennyVideoUserAvTrimSecV367 = Math.max(-2.5, Math.min(2.5, Math.round(next * 100) / 100));
        }
        try {
            localStorage.setItem('jenny_video_av_trim_sec_v367', String(window._jennyVideoUserAvTrimSecV367));
        } catch (e) {}

        var st = window._vidStateV130 || {};
        if (typeof window.syncVideoRamEngineV211 === 'function') {
            window.syncVideoRamEngineV211(false, true);
        }
        window.updateVideoAvSyncRadarUIV367();

        var trimVal = window._jennyVideoUserAvTrimSecV367;
        var signStr = trimVal >= 0 ? ('+' + trimVal.toFixed(2)) : trimVal.toFixed(2);
        var msg = resetToAuto
            ? '🎯 Синхро А/В: Авто-компенсация тракта ВКЛ'
            : ('⏱️ Сдвиг звука Видео: ' + signStr + ' сек ' + (trimVal >= 0 ? '(Звук раньше)' : '(Звук позже)'));
        if (typeof window.showVideoFeedbackV130 === 'function' && st.active) {
            window.showVideoFeedbackV130(msg);
        } else if (typeof window.showToast === 'function') {
            window.showToast(msg, ev);
        }
        if (typeof window.wakeVideoHudV130 === 'function' && st.active) {
            window.wakeVideoHudV130(false);
        }
    };

    // 9. Seamless RAM Buffer #3 (Forward) & Buffer #4 (Reverse) Playback Engine
    window.syncVideoRamEngineV211 = window.syncVideoRamEngineV131 = function(isDragging, forceResyncNow) {
        var vd = window.videoDeckV131, st = window._vidStateV130, vid = document.getElementById('jennyVideoElV130');
        if (!vid || !vd || !vd.ctx || !st || !st.active) return;

        if (st.videoStreamModeV217 === 'v_only') {
            if (vd.horizonTimer) { clearTimeout(vd.horizonTimer); vd.horizonTimer = null; }
            if (vd.revFrameTimer) { clearInterval(vd.revFrameTimer); vd.revFrameTimer = null; }
            if (vd.sourceNode) {
                vd.sourceNode.onended = null;
                try { vd.sourceNode.stop(); } catch (e) {}
                try { vd.sourceNode.disconnect(); } catch (e) {}
                vd.sourceNode = null;
            }
            vd.isStudioPlaying = false;
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = 0.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = 0.0;
            return;
        }

        var gKey = (vd.config && vd.config.gearKeyV66) || 'jbuf-lock';
        var isRev = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed) || vd.isReversed);
        vd.isReversed = isRev;
        var targetSpd = Math.max(0.1, Math.min(16.0, Number(window._jennyVideoSpeedV170 || vd.speed || (window.getTargetPlaybackSpeedDeckB ? window.getTargetPlaybackSpeedDeckB() : 1.0)) || 1.0));
        vd.speed = targetSpd;

        var isVidActuallyPlayingFrames = Boolean((!vid.paused && !vid.ended && vid.readyState >= 2 && !window._vidIsBufferingV132) || st._autoHealingRemuxV369);

        if (st.userPaused || (!isRev && !isVidActuallyPlayingFrames)) {
            if (vd.horizonTimer) { clearTimeout(vd.horizonTimer); vd.horizonTimer = null; }
            if (vd.revFrameTimer) { clearInterval(vd.revFrameTimer); vd.revFrameTimer = null; }
            if (vd.sourceNode) {
                vd.sourceNode.onended = null;
                try { vd.sourceNode.stop(); } catch (e) {}
                try { vd.sourceNode.disconnect(); } catch (e) {}
                vd.sourceNode = null;
            }
            vd.isStudioPlaying = false;
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = st.dspBypass ? 0.0 : 1.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = st.dspBypass ? 1.0 : 0.0;
            return;
        }

        var curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
        var effLeadSec = window.getEffectiveRamAudioLeadSecV367();
        var audioTargetSec = isRev
            ? Math.max(0, curSec - effLeadSec * targetSpd)
            : Math.max(0, curSec + effLeadSec * targetSpd);

        var pSec = (vd.studioBuffer && vd.studioBuffer._pieceSecV72) || 45;
        var curP = (vd.studioBuffer && vd.studioBuffer._pieceMapV72 && vd.studioBuffer._pieceMapV72.length > 0)
            ? Math.max(0, Math.min(vd.studioBuffer._pieceMapV72.length - 1, Math.floor((isRev ? Math.max(0, audioTargetSec - 0.3) : audioTargetSec) / pSec)))
            : -1;
        var isPieceReady = Boolean(
            vd.studioBuffer &&
            (!vd.studioBuffer._pieceMapV72 || vd.studioBuffer._pieceMapV72.length === 0 || (curP >= 0 && vd.studioBuffer._pieceMapV72[curP] === 2))
        );
        if (!isPieceReady && typeof vd._ensureUrgentPieceAtSecV369 === 'function') {
            vd._ensureUrgentPieceAtSecV369(audioTargetSec);
        }

        var studioOn = Boolean(!vd.config || vd.config.studioMode !== false);
        var useRamEngine = studioOn && isPieceReady && (isRev || gKey !== 'neutral');

        if (!useRamEngine) {
            if (vd.horizonTimer) { clearTimeout(vd.horizonTimer); vd.horizonTimer = null; }
            if (vd.revFrameTimer) { clearInterval(vd.revFrameTimer); vd.revFrameTimer = null; }
            if (vd.sourceNode) {
                vd.sourceNode.onended = null;
                try { vd.sourceNode.stop(); } catch (e) {}
                try { vd.sourceNode.disconnect(); } catch (e) {}
                vd.sourceNode = null;
            }
            vd.isStudioPlaying = false;
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = st.dspBypass ? 0.0 : 1.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = st.dspBypass ? 1.0 : 0.0;
            var lockPitch = (gKey !== 'web-shift' && gKey !== 'jbuf-shift' && gKey !== 'vinyl-shift');
            vid.preservesPitch = lockPitch; vid.mozPreservesPitch = lockPitch; vid.webkitPreservesPitch = lockPitch;
            if (!isRev && Math.abs(vid.playbackRate - targetSpd) > 0.005) {
                try { vid.playbackRate = targetSpd; } catch (e) {}
            }
            return;
        }

        if (
            !forceResyncNow &&
            !isDragging &&
            vd.isStudioPlaying &&
            vd.sourceNode &&
            vd._ramAnchorCtxTimeV367 !== undefined &&
            vd._ramAnchorMediaSecV367 !== undefined &&
            vd._ramAnchorSpeedV367 === targetSpd &&
            vd._ramAnchorGearV367 === gKey &&
            vd._ramAnchorRevV367 === isRev
        ) {
            var elapsedCtx = vd.ctx.currentTime - vd._ramAnchorCtxTimeV367;
            var expectedAudioSec = isRev
                ? (vd._ramAnchorMediaSecV367 - elapsedCtx * targetSpd)
                : (vd._ramAnchorMediaSecV367 + elapsedCtx * targetSpd);
            var driftSec = Math.abs(expectedAudioSec - audioTargetSec);
            var maxAllowedDrift = (isRev && !st._revStreamStartedPlayingV220) ? 1.5 : 0.085;
            if (driftSec < maxAllowedDrift && elapsedCtx < (vd._ramWinRealDurSecV367 || 12.0) - 1.2) {
                if (!isRev && Math.abs(vid.playbackRate - targetSpd) > 0.005) {
                    try { vid.playbackRate = targetSpd; } catch (e) {}
                }
                return;
            }
        }

        if (vd.horizonTimer) { clearTimeout(vd.horizonTimer); vd.horizonTimer = null; }
        if (vd.revFrameTimer) { clearInterval(vd.revFrameTimer); vd.revFrameTimer = null; }

        var WIN_SEC = Math.max(16.0, Math.min(48.0, targetSpd * 16.0));
        var rawWinBuf = null;
        if (isRev && vd.reversedStudioBuffer) {
            var durRev = vd.reversedStudioBuffer.duration;
            var revStartSec = Math.max(0, Math.min(durRev - 0.05, durRev - audioTargetSec));
            rawWinBuf = window.extractVideoWindowBufferV131(vd.reversedStudioBuffer, revStartSec, WIN_SEC, false);
        } else if (vd.studioBuffer) {
            rawWinBuf = window.extractVideoWindowBufferV131(vd.studioBuffer, audioTargetSec, WIN_SEC, isRev);
        }
        if (!rawWinBuf) return;

        var playBuf = rawWinBuf, nodeRate = 1.0;
        if (gKey === 'jbuf-lock' || gKey === 'web-lock') {
            var tensionPct = (vd.config && vd.config.hoseTensionPct !== undefined) ? vd.config.hoseTensionPct : 100;
            playBuf = window.buildElasticHoseBufferDeckB ? window.buildElasticHoseBufferDeckB(rawWinBuf, targetSpd, tensionPct) : rawWinBuf;
            nodeRate = (playBuf === rawWinBuf) ? targetSpd : 1.0;
        } else {
            playBuf = rawWinBuf;
            nodeRate = targetSpd;
        }

        if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = 0.0;
        if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = 0.0;

        if (vd.sourceNode) {
            vd.sourceNode.onended = null;
            try { vd.sourceNode.stop(); } catch (e) {}
            try { vd.sourceNode.disconnect(); } catch (e) {}
            vd.sourceNode = null;
        }

        if (!st.userPaused && (!window._jennyDualDeckV211 || window._jennyDualDeckV211.deckB !== false)) {
            if (vd.ctx.state === 'suspended') {
                try { vd.ctx.resume(); } catch (e) {}
            }
            vd.sourceNode = vd.ctx.createBufferSource();
            vd.sourceNode.buffer = playBuf;
            vd.sourceNode.playbackRate.value = nodeRate;
            vd.sourceNode.connect(st.dspBypass ? vd.directBypassGain : vd.inputMixer);
            if (st.dspBypass && vd.directBypassGain) vd.directBypassGain.gain.value = 1.0;
            vd.sourceNode.start(0, 0);
            vd.isStudioPlaying = true;

            var realDurSec = (nodeRate === 1.0) ? playBuf.duration : (playBuf.duration / Math.max(0.25, nodeRate));
            vd._ramAnchorCtxTimeV367 = vd.ctx.currentTime;
            vd._ramAnchorMediaSecV367 = audioTargetSec;
            vd._ramAnchorSpeedV367 = targetSpd;
            vd._ramAnchorGearV367 = gKey;
            vd._ramAnchorRevV367 = isRev;
            vd._ramWinRealDurSecV367 = realDurSec;

            if (!isRev && Math.abs(vid.playbackRate - targetSpd) > 0.005) {
                try { vid.playbackRate = targetSpd; } catch (e) {}
            }

            vd.horizonTimer = setTimeout(function() {
                if (st.active && !st.userPaused) {
                    window.syncVideoRamEngineV211(false, true);
                }
            }, Math.max(400, (realDurSec - 0.85) * 1000));
        }
    };

    var _prevSetSpeedV368 = window.setVideoDeckSpeedV170;
    window.setVideoDeckSpeedV170 = function(rawSpeed, showNotification) {
        var r = _prevSetSpeedV368 ? _prevSetSpeedV368.apply(this, arguments) : rawSpeed;
        if (typeof window.syncDeckBSpeedLockIndicatorV227 === 'function') {
            window.syncDeckBSpeedLockIndicatorV227();
        }
        if (typeof window.syncVideoRamEngineV211 === 'function') {
            window.syncVideoRamEngineV211(false, true);
        }
        window.updateVideoAvSyncRadarUIV367();
        return r;
    };

    // 10. UNIFIED TELEMETRY ACROSS #v130VideoSubTelemetry, #nowPlayingDeckB, AND THE ⏱️ А/В DRAWER (Fix 6)
    window.ensureVideoAvSyncRadarDOMV367 = function() {
        var oldBottomRadar = document.getElementById('jennyVideoAvSyncRadarBarV367');
        if (oldBottomRadar) oldBottomRadar.remove();

        var hudOverlay = document.getElementById('v130HudOverlay');
        if (hudOverlay && !document.getElementById('jennyAvSyncEdgePillV368')) {
            var wrap = document.createElement('div');
            wrap.id = 'jennyAvSyncEdgePillV368';
            wrap.className = 'v130-hide-in-pip';
            wrap.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: true });
            wrap.addEventListener('touchend', function(e) { e.stopPropagation(); }, { passive: true });
            wrap.addEventListener('click', function(e) { e.stopPropagation(); });

            wrap.innerHTML =
                '<button type="button" id="jennyAvSyncEdgePillBtnV368" onclick="window.toggleAvSyncEdgeDrawerV368(event)">' +
                    '<span id="v368EdgeTabLabel">⏱️ А/В: ОЗУ #3 🚀 ▾</span>' +
                '</button>' +
                '<div id="jennyAvSyncEdgeDrawerV368">' +
                    '<div id="jennyVideoAvSyncRadarTextV367" style="line-height:1.42;"></div>' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;gap:5px;margin-top:2px;">' +
                        '<button type="button" onclick="window.adjustVideoAvSyncTrimV367(-0.10, false, event)" style="flex:1;padding:4px 7px;border-radius:6px;background:#161b22;border:1px solid #30363d;color:#79c0ff;font-size:10.5px;font-weight:bold;cursor:pointer;">⏪ -0.1с</button>' +
                        '<button type="button" id="v367BtnAvReset" onclick="window.adjustVideoAvSyncTrimV367(0, true, event)" style="flex:1;padding:4px 7px;border-radius:6px;background:#1f2937;border:1px solid #3fb950;color:#3fb950;font-size:10.5px;font-weight:bold;cursor:pointer;">🎯 Авто</button>' +
                        '<button type="button" onclick="window.adjustVideoAvSyncTrimV367(0.10, false, event)" style="flex:1;padding:4px 7px;border-radius:6px;background:#161b22;border:1px solid #30363d;color:#79c0ff;font-size:10.5px;font-weight:bold;cursor:pointer;">⏩ +0.1с</button>' +
                    '</div>' +
                '</div>';
            hudOverlay.appendChild(wrap);
        }

        var smB = document.getElementById('settingsModalDeckBContainer');
        if (smB && !document.getElementById('jennyDeckBSettingsAvRadarCardV367')) {
            var anchor = document.getElementById('jennyFourBuffersHudBarB');
            var card = document.createElement('div');
            card.id = 'jennyDeckBSettingsAvRadarCardV367';
            card.style.cssText = 'background:#0d1117;border:1px solid #3b82f6;border-radius:10px;padding:9px 10px;margin-bottom:10px;font-size:11.5px;color:#e6edf3;';
            card.innerHTML =
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
                    '<span style="color:#60a5fa;font-weight:900;font-size:12px;">⏱️ Диагностика и Калибровка Синхрона Видео/Звука (Дека Б)</span>' +
                    '<span id="v367ModalAvPathBadge" style="color:#3fb950;font-family:monospace;font-size:11px;font-weight:bold;">ОЗУ #3 🚀</span>' +
                '</div>' +
                '<div id="v367ModalAvDiagLines" style="font-family:monospace;font-size:11px;color:#93c5fd;line-height:1.45;margin-bottom:8px;">' +
                    'Загрузка телеметрии тракта Деки Б...' +
                '</div>' +
                '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">' +
                    '<button type="button" onclick="window.adjustVideoAvSyncTrimV367(-0.10, false, event)" style="flex:1;padding:7px 8px;border-radius:7px;background:#161b22;border:1px solid #3b82f6;color:#93c5fd;font-weight:bold;font-size:11.5px;cursor:pointer;">⏪ Звук позже (-0.1с)</button>' +
                    '<button type="button" id="v367ModalBtnAvReset" onclick="window.adjustVideoAvSyncTrimV367(0, true, event)" style="flex:1;padding:7px 8px;border-radius:7px;background:#122d1f;border:1px solid #3fb950;color:#3fb950;font-weight:bold;font-size:11.5px;cursor:pointer;">🎯 Авто (0.00с)</button>' +
                    '<button type="button" onclick="window.adjustVideoAvSyncTrimV367(0.10, false, event)" style="flex:1;padding:7px 8px;border-radius:7px;background:#161b22;border:1px solid #3b82f6;color:#93c5fd;font-weight:bold;font-size:11.5px;cursor:pointer;">⏩ Звук раньше (+0.1с)</button>' +
                '</div>';
            if (anchor && anchor.nextSibling) {
                smB.insertBefore(card, anchor.nextSibling);
            } else {
                smB.insertBefore(card, smB.firstChild);
            }
        }
        window.mountModularLabSettingsV208();
    };

    window.updateVideoAvSyncRadarUIV367 = function() {
        window.ensureVideoAvSyncRadarDOMV367();
        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        var vid = document.getElementById('jennyVideoElV130');
        var hw = window.getDeckBHardwareAndDspLatencySecV367();
        var trimSec = Number(window._jennyVideoUserAvTrimSecV367 || 0);
        var trimStr = (trimSec >= 0 ? '+' : '') + trimSec.toFixed(2) + 'с';

        var spd = Number(window._jennyVideoSpeedV170 || vd.speed || 1.0);
        var isRev = Boolean(vd.isReversed || window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
        var vSec = (vid && st.active) ? (window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0)) : 0;

        var usingRam = Boolean(st.active && vd.isStudioPlaying && vd.sourceNode);
        var aCursorSec = vSec;
        if (usingRam && vd._ramAnchorCtxTimeV367 !== undefined && vd._ramAnchorMediaSecV367 !== undefined && vd.ctx) {
            var el = vd.ctx.currentTime - vd._ramAnchorCtxTimeV367;
            aCursorSec = isRev
                ? Math.max(0, vd._ramAnchorMediaSecV367 - el * spd)
                : Math.max(0, vd._ramAnchorMediaSecV367 + el * spd);
        }

        var loadedCnt = (vd.studioBuffer && vd.studioBuffer._loadedCountV72) || vd._ramPiecesLoadedV359 || 0;
        var totalCnt = (vd.studioBuffer && vd.studioBuffer._pieceMapV72 && vd.studioBuffer._pieceMapV72.length) || vd._ramPiecesTotalV359 || 1;
        var ramPct = Math.min(100, Math.round((loadedCnt / Math.max(1, totalCnt)) * 100));
        var allLoaded = Boolean((vd.studioBuffer && vd.studioBuffer._allPiecesLoadedV72) || (loadedCnt >= totalCnt && totalCnt > 0 && !vd._isLoadingRamV359 && vd.studioBuffer));

        var activeBufName = usingRam
            ? (isRev ? 'ОЗУ Буфер #4 (Реверс, 32-bit PCM)' : 'ОЗУ Буфер #3 (Вперёд, 32-bit PCM)')
            : (st.usingRemux ? 'Сжатый поток видео (FFmpeg AAC)' : 'Сжатый поток <video>');

        var ramProgressBadge = allLoaded
            ? ('100% в ОЗУ (' + totalCnt + '/' + totalCnt + ' кусков)')
            : (vd._isLoadingRamV359 ? ('докачка ' + loadedCnt + '/' + totalCnt + ' (' + ramPct + '%)') : 'выкл');

        // Keep #v130VideoSubTelemetry 100% synchronized with the real playback source!
        var subTel = document.getElementById('v130VideoSubTelemetry');
        if (subTel && st.active) {
            var wantSubText = '';
            if (usingRam) {
                var shortBuf = isRev ? 'ОЗУ Буфер #4 (Реверс)' : 'ОЗУ Буфер #3 (Вперёд)';
                wantSubText = allLoaded
                    ? ('🟢 Звук играет из: ' + shortBuf + ' • Память RAM: 100%')
                    : ('🟢 Звук играет из: ' + shortBuf + ' • Докачка RAM: ' + loadedCnt + '/' + totalCnt + ' (' + ramPct + '%)');
            } else if (vd._isLoadingRamV359) {
                wantSubText = '🟡 Звук играет из: Сжатый поток • Распаковка в ОЗУ: ' + loadedCnt + '/' + totalCnt + ' (' + ramPct + '%)';
            } else {
                wantSubText = '🟡 Звук играет из: Сжатый поток видео';
            }
            if (subTel.innerText !== wantSubText) {
                subTel.innerText = wantSubText;
            }
        }

        // Respect checkbox 'avSyncRadar' in «🎬 Настройки видео»
        var fl = window._jennyLabFlagsV208 || {};
        var showAvPill = (fl.avSyncRadar !== false);
        var avPill = document.getElementById('jennyAvSyncEdgePillV368');
        if (avPill) {
            if (showAvPill) {
                avPill.style.removeProperty('display');
            } else {
                avPill.style.setProperty('display', 'none', 'important');
            }
        }

        var totalCompMs = usingRam
            ? Math.round(window.getEffectiveRamAudioLeadSecV367() * 1000)
            : Math.round(trimSec * 1000);

        var expanded = Boolean(window._jennyAvSyncEdgeExpandedV368);
        var drawer = document.getElementById('jennyAvSyncEdgeDrawerV368');
        if (drawer) {
            drawer.style.display = expanded ? 'flex' : 'none';
        }
        var tabLbl = document.getElementById('v368EdgeTabLabel');
        if (tabLbl) {
            var shortMode = usingRam ? (isRev ? 'ОЗУ #4 ⏪' : 'ОЗУ #3 🚀') : ('Поток ' + (vd._isLoadingRamV359 ? (loadedCnt + '/' + totalCnt) : ''));
            tabLbl.innerHTML = '⏱️ А/В: <b style="color:' + (usingRam ? '#3fb950' : '#e3b341') + ';">' + shortMode + '</b> (' + (totalCompMs >= 0 ? '+' : '') + totalCompMs + 'мс) ' + (expanded ? '▴' : '▾');
        }

        var txtEl = document.getElementById('jennyVideoAvSyncRadarTextV367');
        if (txtEl) {
            txtEl.innerHTML =
                '<div>🔊 Сейчас играет: <b style="color:' + (usingRam ? '#3fb950' : '#e3b341') + ';">' + activeBufName + '</b></div>' +
                '<div>📦 Буферы ОЗУ (#3 и #4): <b style="color:' + (allLoaded ? '#3fb950' : '#79c0ff') + ';">' + ramProgressBadge + '</b></div>' +
                '<div>🎞️ Кадр видео: <b style="color:#fff;">' + vSec.toFixed(2) + 'с</b> │ 🎵 Курсор звука: <b style="color:#79c0ff;">' + aCursorSec.toFixed(2) + 'с</b> (x' + spd.toFixed(2) + ')</div>' +
                '<div>🔌 Выход Android (ЦАП): <b style="color:#d2a8ff;">' + hw.ctxMs + ' мс</b> │ 🎛️ Фильтры DSP: <b style="color:#d2a8ff;">' + hw.dspMs.toFixed(1) + ' мс</b></div>' +
                '<div style="color:#8b949e;font-size:9.5px;">↳ Цепочка DSP: ' + hw.dspBreakdown + '</div>' +
                '<div>⚡ Опережение для синхрона: <b style="color:#3fb950;">' + (totalCompMs >= 0 ? '+' : '') + totalCompMs + ' мс</b> (ручн: ' + trimStr + ')</div>';
        }

        var btnReset = document.getElementById('v367BtnAvReset');
        if (btnReset) {
            btnReset.innerText = '🎯 ' + (Math.abs(trimSec) < 0.005 ? 'Авто' : trimStr);
            btnReset.style.borderColor = Math.abs(trimSec) < 0.005 ? '#3fb950' : '#e3b341';
            btnReset.style.color = Math.abs(trimSec) < 0.005 ? '#3fb950' : '#e3b341';
        }

        var mBadge = document.getElementById('v367ModalAvPathBadge');
        if (mBadge) {
            mBadge.innerText = activeBufName + ' • ' + ramProgressBadge;
            mBadge.style.color = usingRam ? '#3fb950' : '#e3b341';
        }
        var mDiag = document.getElementById('v367ModalAvDiagLines');
        if (mDiag) {
            mDiag.innerHTML =
                '• <b>Источник звука сейчас:</b> <b style="color:' + (usingRam ? '#3fb950' : '#e3b341') + ';">' + activeBufName + '</b> • Память ОЗУ (#3 Вперёд + #4 Реверс): <b>' + ramProgressBadge + '</b>.<br>' +
                '• <b>Задержка тракта в реальном времени:</b> Выход Android (ЦАП) = <b>' + hw.ctxMs + ' мс</b>, Активные блоки DSP Деки Б = <b>' + hw.dspMs.toFixed(1) + ' мс</b> (' + hw.dspBreakdown + ').<br>' +
                '• <b>Компенсация синхрона:</b> Скорость = <b>x' + spd.toFixed(2) + '</b> • Опережение звука = <b style="color:#3fb950;">' + (totalCompMs >= 0 ? '+' : '') + totalCompMs + ' мс</b> (ручная поправка: <b>' + trimStr + '</b>).';
        }
        var mBtnReset = document.getElementById('v367ModalBtnAvReset');
        if (mBtnReset) {
            mBtnReset.innerText = '🎯 Авто (' + trimStr + ')';
        }
    };

    setInterval(function() {
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        var vid = document.getElementById('jennyVideoElV130');
        if (st && st.active && vid && !st.userPaused) {
            var isRev = Boolean(vd && (vd.isReversed || window.isReversedDeckB));
            if (isRev || (!vid.paused && !window._vidIsBufferingV132) || st._autoHealingRemuxV369) {
                if (typeof window.syncVideoRamEngineV211 === 'function') {
                    window.syncVideoRamEngineV211(false, false);
                }
            }
        }
        if ((st && st.active) || document.getElementById('settingsModalDeckB')) {
            window.updateVideoAvSyncRadarUIV367();
        }
    }, 220);

    setTimeout(function() {
        window.ensureVideoAvSyncRadarDOMV367();
    }, 450);
})();

/* [split] V370: кусок исходного IIFE (ui_v71.js, строки 37843–38397) → ui_video_decks.js */
;(function() {
    if (window._jennyV370DeckAFullTrackPatchInstalled__video_decks) return;
    window._jennyV370DeckAFullTrackPatchInstalled__video_decks = true;
    window._jennyV370DeckAFullTrackPatchInstalled = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    function invalidateDeckAHoseCacheV370() {
        if (window._hoseSplicerCacheV46) {
            window._hoseSplicerCacheV46.srcBuffer = null;
            window._hoseSplicerCacheV46.splicedBuffer = null;
        }
    }
    window.invalidateDeckAHoseCacheV370 = invalidateDeckAHoseCacheV370;

    // -------------------------------------------------------------------------
    // 4. БЕСШОВНЫЙ ПЕРЕЗАПУСК И ОКОНЧАНИЕ ТРЕКА В WEBAUDIO RAM-ДВИЖКЕ ДЕКИ А (#370)
    //    - Не пересоздаёт и не прерывает уже играющий window.studioSourceNode на ~28 сек,
    //      когда фоновая сборка reversedStudioBuffer завершается в playTrack!
    //    - Привязывает точный обработчик onended к window.studioSourceNode, чтобы:
    //      а) Если узел когда-либо остановился раньше конца песни (curSec < dur - 0.5) без паузы,
    //         он мгновенно продолжал играть с этой же миллисекунды!
    //      б) По достижении конца песни автоматически включал следующий трек (playNextTrack).
    // -------------------------------------------------------------------------
    var _origForceStopV370 = window.forceStopPauseDeckAAudioV232;
    window.forceStopPauseDeckAAudioV232 = function(fullUnload) {
        if (!fullUnload && window._studioClockV74_1 && window.audioCtx) {
            var clk = window._studioClockV74_1;
            if (clk.active) {
                var spd = clk.speed || 1.0;
                var curEst = clk.startTrackSec + Math.max(0, window.audioCtx.currentTime - clk.startCtxTime) * spd;
                clk.lastKnownSec = Math.max(0, curEst);
                clk.startTrackSec = clk.lastKnownSec;
            }
            clk.active = false;
        } else if (fullUnload && window._studioClockV74_1) {
            window._studioClockV74_1.active = false;
            window._studioClockV74_1.lastKnownSec = 0;
            window._studioClockV74_1.startTrackSec = 0;
        }
        return typeof _origForceStopV370 === 'function' ? _origForceStopV370.apply(this, arguments) : undefined;
    };
})();

/* [split] V371: кусок исходного IIFE (ui_v71.js, строки 38401–38673) → ui_video_decks.js */
;(function() {
    if (window._jennyV371PatchInstalled__video_decks) return;
    window._jennyV371PatchInstalled__video_decks = true;
    window._jennyV371PatchInstalled = true;

    // -------------------------------------------------------------------------
    // 2. МГНОВЕННАЯ ПЕРЕМОТКА (SEEK) НА ИГРАЮЩЕЙ И СТОЯЩЕЙ НА ПАУЗЕ ДЕКЕ А
    //    (75172.mp4 01:13–01:28)
    //    - Исправляет ошибку, при которой во время игры WebAudio RAM-буфера
    //      тап по #seekZone менял только player.currentTime, а getTruePlaybackTimeV74_2()
    //      считал это расхождением (> 0.45 сек) и возвращал старое время _studioClockV74_1,
    //      перезаписывая player.currentTime обратно и не пересоздавая studioSourceNode!
    // -------------------------------------------------------------------------
    window.seekDeckAToExactSecondV371 = function(targetSec) {
        var player = document.getElementById('audioPlayer');
        var effDur = (window.studioBuffer && window.studioBuffer.duration > 0)
            ? window.studioBuffer.duration
            : ((player && isFinite(player.duration) && player.duration > 0) ? player.duration : 0);

        var cleanSec = Math.max(0, parseFloat(targetSec) || 0);
        if (effDur > 0.05) {
            cleanSec = Math.max(0, Math.min(effDur - 0.02, cleanSec));
        }

        var activeSpd = (typeof window.getActiveTargetSpeedV59 === 'function')
            ? window.getActiveTargetSpeedV59()
            : ((player && player.playbackRate) || 1.0);

        window._pendingSeekTargetV75 = { sec: cleanSec, ts: performance.now() };
        window._studioClockV74_1 = {
            active: Boolean(!window._userPausedV75_2 && (window.isStudioPlaying || (player && !player.paused))),
            startCtxTime: window.audioCtx ? window.audioCtx.currentTime : 0,
            startTrackSec: cleanSec,
            lastKnownSec: cleanSec,
            trackName: window.currentPlayingTrack || '',
            speed: activeSpd
        };

        if (player) {
            window._internalSeekSyncGuardV370 = true;
            try {
                player.currentTime = cleanSec;
            } catch (e) {}
            setTimeout(function() { window._internalSeekSyncGuardV370 = false; }, 60);
        }

        // Если трек ещё докачивается по кускам, даём приоритет куску под новой точкой перемотки!
        if (window.studioBuffer && window.studioBuffer._pieceMapV72 && !window.studioBuffer._allPiecesLoadedV72) {
            if (typeof _origPrioritizePieceV370 === 'function') {
                try { _origPrioritizePieceV370(); } catch (e) {}
            }
        }

        var isVisualReverse = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
        if (effDur > 0 && typeof window.updateProgressUI === 'function') {
            window.updateProgressUI(cleanSec, effDur, isVisualReverse);
        }

        var isPlayingNow = !window._userPausedV75_2 && Boolean(
            window.isStudioPlaying ||
            window.studioSourceNode ||
            (player && !player.paused)
        );

        if (isPlayingNow) {
            // Останавливаем старый studioSourceNode ПЕРЕД вызовом syncMasterPlaybackEngineV59,
            // чтобы движок гарантированно запустил новый узел ровно с новой секунды cleanSec!
            if (window.studioSourceNode) {
                try { window.studioSourceNode.onended = null; } catch (e) {}
                try { window.studioSourceNode.stop(0); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
                window.studioSourceNode = null;
            }
            if (window._activeBufferSourcesV71 && typeof window._activeBufferSourcesV71.forEach === 'function') {
                window._activeBufferSourcesV71.forEach(function(n) {
                    if (!n) return;
                    try { n.onended = null; n.stop(0); n.disconnect(); } catch (e) {}
                });
                window._activeBufferSourcesV71.clear();
            }
            window.isStudioPlaying = false;
            window._resumingFromUserPlayV232 = true;
            try {
                if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                    window.syncMasterPlaybackEngineV59(false);
                }
            } finally {
                window._resumingFromUserPlayV232 = false;
            }
        }
    };

    // Также страхуем клик/тап по #seekZone на случай, если player.duration == NaN/0 (когда длительность известна только из window.studioBuffer.duration)!
    function installSeekZoneFallbackTapV371() {
        var zone = document.getElementById('seekZone');
        if (!zone || zone._v371FallbackBound) return;
        zone._v371FallbackBound = true;

        var downX = 0, downY = 0, downTs = 0;
        zone.addEventListener('touchstart', function(e) {
            if (e.touches && e.touches.length > 0) {
                downX = e.touches[0].clientX;
                downY = e.touches[0].clientY;
                downTs = performance.now();
            }
        }, { passive: true });

        zone.addEventListener('touchend', function(e) {
            var upX = (e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0].clientX : downX;
            var upY = (e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0].clientY : downY;
            var dt = performance.now() - downTs;
            if (dt < 240 && Math.abs(upX - downX) < 18 && Math.abs(upY - downY) < 18) {
                var rect = zone.getBoundingClientRect();
                if (rect.width > 10) {
                    var perc = Math.max(0, Math.min(1, (upX - rect.left) / rect.width));
                    var player = document.getElementById('audioPlayer');
                    var effDur = (window.studioBuffer && window.studioBuffer.duration > 0)
                        ? window.studioBuffer.duration
                        : ((player && isFinite(player.duration) && player.duration > 0) ? player.duration : 0);
                    if (effDur > 0) {
                        var isVisualReverse = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
                        if (isVisualReverse) perc = 1.0 - perc;
                        window.seekDeckAToExactSecondV371(perc * effDur);
                    }
                }
            }
        }, { passive: true });
    }
    installSeekZoneFallbackTapV371();
    setTimeout(installSeekZoneFallbackTapV371, 250);
    setTimeout(installSeekZoneFallbackTapV371, 800);
})();

/* [split] V372: кусок исходного IIFE (ui_v71.js, строки 38677–39278) → ui_video_decks.js */
;(function() {
    if (window._jennyV372CleanArchInstalled__video_decks) return;
    window._jennyV372CleanArchInstalled__video_decks = true;
    window._jennyV372CleanArchInstalled = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    function getEffectiveDeckADurationV372() {
        var player = document.getElementById('audioPlayer');
        if (window.studioBuffer && window.studioBuffer.duration > 0) {
            return window.studioBuffer.duration;
        }
        if (window.reversedStudioBuffer && window.reversedStudioBuffer.duration > 0) {
            return window.reversedStudioBuffer.duration;
        }
        if (player && isFinite(player.duration) && player.duration > 0) {
            return player.duration;
        }
        var fn = window.currentPlayingTrack || '';
        var meta = (window.lastData && window.lastData.track_meta && window.lastData.track_meta[fn]) || {};
        return Number(meta.dur || 0);
    }
    window.getEffectiveDeckADurationV372 = getEffectiveDeckADurationV372;

    // -------------------------------------------------------------------------
    // 2. ELIMINATE THE 2.4-SECOND TIMER FREEZE (`dt < 2400`) IN
    //    `getEffectiveVideoCurrentTimeV167` / `getEffectiveVideoCurrentTimeV210`
    //    AND PREVENT MULTIPLE LIVE_REMUX REQUESTS ON `#v130SeekSlider` DRAG/TAP
    // -------------------------------------------------------------------------
    window.getEffectiveVideoCurrentTimeV167 = window.getEffectiveVideoCurrentTimeV210 = function(vid) {
        if (!vid) vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        var isRev = Boolean(vd.isReversed || window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));

        if (!st.userPaused && st._pausedSeekSecV355 !== undefined) {
            st._pausedSeekSecV355 = undefined;
            st._didSeekWhilePausedV355 = false;
        }
        if (st.active && st.userPaused && st._pausedSeekSecV355 !== undefined && isFinite(st._pausedSeekSecV355)) {
            st._lastTrueMediaSecV227 = Number(st._pausedSeekSecV355);
            return Number(st._pausedSeekSecV355);
        }

        // Reverse mode time tracking
        if (st.active && isRev && st._playingHardwareRevStreamV219 && st._revAnchorSecV219 !== undefined) {
            if (!st._revStreamStartedPlayingV220) {
                if (!st.userPaused && vd.isStudioPlaying && vd.ctx && vd._ramAnchorCtxTimeV367 !== undefined && vd._ramAnchorMediaSecV367 !== undefined) {
                    var el = Math.max(0, vd.ctx.currentTime - vd._ramAnchorCtxTimeV367);
                    var spd = Number(vd.speed || window._jennyVideoSpeedV170 || 1.0);
                    var effRamRev = Math.max(0, vd._ramAnchorMediaSecV367 - el * spd);
                    st._lastTrueMediaSecV227 = effRamRev;
                    return effRamRev;
                }
                if (!st.userPaused && st._revWallClockStartTsV369 && st._revWallClockAnchorSecV369 !== undefined) {
                    var wallEl = Math.max(0, (performance.now() - st._revWallClockStartTsV369) / 1000.0);
                    var spdW = Number(vd.speed || window._jennyVideoSpeedV170 || 1.0);
                    return Math.max(0, st._revWallClockAnchorSecV369 - wallEl * spdW);
                }
                return Math.max(0, Number(st._revAnchorSecV219));
            }
            var progressed = (vid && isFinite(vid.currentTime)) ? Math.max(0, vid.currentTime) : 0;
            var eff = Math.max(0, Number(st._revAnchorSecV219) - progressed);
            st._lastTrueMediaSecV227 = eff;
            return eff;
        }

        // Forward mode: ONLY hold `st._pendingSeekSecV167` while the user is actively dragging the slider
        // OR while `<video>` is genuinely still buffering/seeking (`_vidIsBufferingV132`, `vid.seeking`, `vid.readyState < 2`).
        // The instant `<video>` has decoded frames at the new seek target, clear `_pendingSeekSecV167` (0ms freeze instead of 2400ms)!
        if (st._pendingSeekSecV167 !== undefined) {
            var dt = performance.now() - (st._pendingSeekTsV167 || 0);
            var stillSeekingOrDragging = Boolean(
                window._v130UserDraggingSeekV212 ||
                window._vidIsBufferingV132 ||
                !vid ||
                vid.readyState < 2 ||
                vid.seeking
            );
            if (stillSeekingOrDragging && dt < 3500) {
                return st._pendingSeekSecV167;
            }
            st._pendingSeekSecV167 = undefined;
        }

        var rawCur = (vid && isFinite(vid.currentTime)) ? vid.currentTime : 0;
        var totalCur = rawCur + (st.remuxBaseOffset || 0);
        if (st.active && isFinite(totalCur) && totalCur >= 0) {
            st._lastTrueMediaSecV227 = totalCur;
        }
        return totalCur;
    };

    // Helper to stop Deck B RAM sourceNode cleanly
    window.stopDeckBRamSourceNodeV372 = function(vd) {
        vd = vd || window.videoDeckV131;
        if (!vd) return;
        if (vd.horizonTimer) { clearTimeout(vd.horizonTimer); vd.horizonTimer = null; }
        if (vd.revFrameTimer) { clearInterval(vd.revFrameTimer); vd.revFrameTimer = null; }
        if (vd.sourceNode) {
            vd.sourceNode.onended = null;
            try { vd.sourceNode.stop(); } catch (e) {}
            try { vd.sourceNode.disconnect(); } catch (e) {}
            vd.sourceNode = null;
        }
        vd.isStudioPlaying = false;
    };

    // Fast requestAnimationFrame detector that starts `syncVideoRamEngineV211` the exact frame `<video>` begins moving after a seek/start
    window.armDeckBVideoFrameAdvanceV372 = function() {
        var vid = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        var vd = window.videoDeckV131;
        if (!vid || !st || !vd) return;
        if (vd._frameAdvanceRafV372) {
            cancelAnimationFrame(vd._frameAdvanceRafV372);
            vd._frameAdvanceRafV372 = null;
        }
        var initialRawT = Number(vid.currentTime || 0);
        var startPollWall = performance.now();

        var checkFrame = function() {
            vd._frameAdvanceRafV372 = null;
            if (!st.active || st.userPaused) return;
            var isRev = Boolean(vd.isReversed || window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
            if (isRev) return;

            if (window._v130UserDraggingSeekV212 || window._vidIsBufferingV132 || vid.seeking || vid.readyState < 2 || vid.paused) {
                initialRawT = Number(vid.currentTime || 0);
                startPollWall = performance.now();
                vd._frameAdvanceRafV372 = requestAnimationFrame(checkFrame);
                return;
            }
            var curRawT = Number(vid.currentTime || 0);
            var readyWaitMs = performance.now() - startPollWall;
            // As soon as `vid.currentTime` ticks forward by >= 10ms (or readyState >= 3 for > 80ms):
            if (Math.abs(curRawT - initialRawT) >= 0.010 || (vid.readyState >= 3 && readyWaitMs >= 80)) {
                st._vidAdvancingAfterSeekV372 = true;
                st._pendingSeekSecV167 = undefined;
                window.syncVideoRamEngineV211(false, true);
                if (typeof window.updateVideoAvSyncRadarUIV367 === 'function') {
                    window.updateVideoAvSyncRadarUIV367();
                }
                return;
            }
            vd._frameAdvanceRafV372 = requestAnimationFrame(checkFrame);
        };
        vd._frameAdvanceRafV372 = requestAnimationFrame(checkFrame);
    };

    // Fix `seekDeckBAndPlayerSyncedV212`:
    // 1) When `showToastMsg === true && !fromExplicitUser && window._v130UserDraggingSeekV212` (live finger drag on `#v130SeekSlider`),
    //    update ONLY the visual slider & time labels — NEVER reload `vid.src = '/api/video/live_remux'` on `touchstart`/`touchmove`/`input`!
    // 2) Deduplicate identical seek commits within 180ms so `touchend` + `mouseup` + `change` on `#v130SeekSlider` only trigger ONE seek!
    // 3) Reset the Stall Watchdog timer (`window._lastWatchdogProgressTsV369`) so it never aborts a seek 1.35s later!
    var _origSeekDeckBV369 = window.seekDeckBAndPlayerSyncedV212;
    if (typeof _origSeekDeckBV369 === 'function') {
        window.seekDeckBAndPlayerSyncedV212 = function(targetSec, showToastMsg, fromExplicitUser) {
            var vid = document.getElementById('jennyVideoElV130');
            var st = window._vidStateV130 || {};
            var vd = window.videoDeckV131 || {};
            if (!vid || !st || !st.active) return;

            var dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (vid.duration || 0);
            var rawTargetSec = Number(targetSec) || 0;
            var clamped = (isFinite(dur) && dur > 0)
                ? Math.max(0.0, Math.min(Math.max(0.0, dur - 0.2), rawTargetSec))
                : Math.max(0.0, rawTargetSec);

            var isRev = Boolean(vd.isReversed || window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));

            // If this is a live drag preview on `#v130SeekSlider` (`showToastMsg === true && !fromExplicitUser && window._v130UserDraggingSeekV212`),
            // update ONLY the UI numbers and slider in ALL modes (including normal forward playback!) without reloading FFmpeg!
            if (showToastMsg === true && !fromExplicitUser && window._v130UserDraggingSeekV212) {
                st._pendingSeekSecV167 = clamped;
                st._pendingSeekTsV167 = performance.now();
                var fmt = window.formatVideoTimeV210 || window.fmtKhSecV90 || function(s) {
                    s = Math.max(0, Math.floor(s || 0));
                    var m = Math.floor(s / 60), sc = s % 60;
                    return m + ':' + (sc < 10 ? '0' + sc : sc);
                };
                var cEl = document.getElementById('v130CurTime');
                var seek = document.getElementById('v130SeekSlider');
                if (cEl) cEl.innerText = fmt(clamped);
                if (seek && dur > 0) {
                    seek.max = '1000';
                    seek.value = String(Math.max(0, Math.min(1000, Math.round((clamped / dur) * 1000))));
                }
                if (typeof window.updateProgressUIDeckB === 'function') {
                    window.updateProgressUIDeckB(clamped, dur, isRev);
                }
                return;
            }

            // Deduplicate double commit events (`touchend` + `mouseup` + `change`) firing within 220ms for the same target second
            var now = performance.now();
            if (
                st._lastCommittedSeekTsV372 &&
                (now - st._lastCommittedSeekTsV372 < 220) &&
                Math.abs((st._lastCommittedSeekSecV372 || 0) - clamped) < 0.5
            ) {
                return;
            }
            st._lastCommittedSeekTsV372 = now;
            st._lastCommittedSeekSecV372 = clamped;
            st._lastSeekWallTsV372 = now;
            st._vidAdvancingAfterSeekV372 = false;
            window._lastWatchdogProgressTsV369 = now;
            window._lastWatchdogHealTsV369 = now;

            // Stop old RAM audio node immediately and keep native `<video>` audio muted if RAM studio buffer is active
            window.stopDeckBRamSourceNodeV372(vd);
            if (vd.studioBuffer && (!vd.config || vd.config.studioMode !== false)) {
                if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = 0.0;
                if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = 0.0;
            }

            if (typeof vd._ensureUrgentPieceAtSecV369 === 'function') {
                vd._ensureUrgentPieceAtSecV369(clamped);
            }

            var res = _origSeekDeckBV369.call(this, clamped, showToastMsg, fromExplicitUser);

            if (!st.userPaused && !isRev) {
                window.armDeckBVideoFrameAdvanceV372();
            }
            return res;
        };
    }

    // -------------------------------------------------------------------------
    // 3. CLEAN, ZERO-STUTTER `syncVideoRamEngineV211` / `syncVideoRamEngineV131`:
    //    - Never unmutes native `<video>` (`vd.htmlGain`) during a seek when RAM Buffer #3 is active!
    //    - Plays directly from `vd.studioBuffer` at 1.0x Forward (0ms WSOLA overhead, no 16s window cuts)!
    //    - Never kills `vd.sourceNode` during normal playback!
    // -------------------------------------------------------------------------
    window.syncVideoRamEngineV211 = window.syncVideoRamEngineV131 = function(isDragging, forceResyncNow) {
        var vd = window.videoDeckV131, st = window._vidStateV130, vid = document.getElementById('jennyVideoElV130');
        if (!vid || !vd || !vd.ctx || !st || !st.active) return;

        if (st.videoStreamModeV217 === 'v_only') {
            window.stopDeckBRamSourceNodeV372(vd);
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = 0.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = 0.0;
            return;
        }

        var gKey = (vd.config && vd.config.gearKeyV66) || 'jbuf-lock';
        var isRev = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed) || vd.isReversed);
        vd.isReversed = isRev;
        var targetSpd = Math.max(0.1, Math.min(16.0, Number(window._jennyVideoSpeedV170 || vd.speed || (window.getTargetPlaybackSpeedDeckB ? window.getTargetPlaybackSpeedDeckB() : 1.0)) || 1.0));
        vd.speed = targetSpd;

        var curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
        var effLeadSec = window.getEffectiveRamAudioLeadSecV367 ? window.getEffectiveRamAudioLeadSecV367() : 0.14;
        var audioTargetSec = isRev
            ? Math.max(0, curSec - effLeadSec * targetSpd)
            : Math.max(0, curSec + effLeadSec * targetSpd);

        var pSec = (vd.studioBuffer && vd.studioBuffer._pieceSecV72) || 45;
        var curP = (vd.studioBuffer && vd.studioBuffer._pieceMapV72 && vd.studioBuffer._pieceMapV72.length > 0)
            ? Math.max(0, Math.min(vd.studioBuffer._pieceMapV72.length - 1, Math.floor((isRev ? Math.max(0, audioTargetSec - 0.3) : audioTargetSec) / pSec)))
            : -1;
        var isPieceReady = Boolean(
            vd.studioBuffer &&
            (!vd.studioBuffer._pieceMapV72 || vd.studioBuffer._pieceMapV72.length === 0 || (curP >= 0 && vd.studioBuffer._pieceMapV72[curP] === 2))
        );
        if (!isPieceReady && typeof vd._ensureUrgentPieceAtSecV369 === 'function') {
            vd._ensureUrgentPieceAtSecV369(audioTargetSec);
        }

        var studioOn = Boolean(!vd.config || vd.config.studioMode !== false);
        var useRamEngine = studioOn && isPieceReady && (isRev || gKey !== 'neutral');

        // Check if `<video>` is currently paused or buffering a seek
        var isVidReadyAndPlaying = Boolean(!vid.paused && !vid.ended && vid.readyState >= 2 && !vid.seeking && !window._vidIsBufferingV132);
        var isWaitingForSeekFrame = Boolean(!isRev && (!isVidReadyAndPlaying || st._vidAdvancingAfterSeekV372 === false));

        if (st.userPaused || isWaitingForSeekFrame) {
            window.stopDeckBRamSourceNodeV372(vd);
            if (!st.userPaused && isWaitingForSeekFrame) {
                // Keep native `<video>` audio muted while buffering a seek so it never double-plays before RAM Buffer #3 starts!
                if (studioOn && (vd.studioBuffer || vd._isLoadingRamV359)) {
                    if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = 0.0;
                    if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = 0.0;
                }
                if (!vd._frameAdvanceRafV372) {
                    window.armDeckBVideoFrameAdvanceV372();
                }
            }
            return;
        }

        if (!useRamEngine) {
            window.stopDeckBRamSourceNodeV372(vd);
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = st.dspBypass ? 0.0 : 1.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = st.dspBypass ? 1.0 : 0.0;
            var lockPitch = (gKey !== 'web-shift' && gKey !== 'jbuf-shift' && gKey !== 'vinyl-shift');
            vid.preservesPitch = lockPitch; vid.mozPreservesPitch = lockPitch; vid.webkitPreservesPitch = lockPitch;
            if (!isRev && Math.abs(vid.playbackRate - targetSpd) > 0.005) {
                try { vid.playbackRate = targetSpd; } catch (e) {}
            }
            return;
        }

        // Mute native `<video>` audio path completely while RAM Buffer #3 / #4 is active
        if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = 0.0;
        if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = 0.0;

        // If `vd.sourceNode` is ALREADY playing with the same speed, gear, and direction:
        if (
            !forceResyncNow &&
            !isDragging &&
            vd.isStudioPlaying &&
            vd.sourceNode &&
            vd._ramAnchorCtxTimeV367 !== undefined &&
            vd._ramAnchorMediaSecV367 !== undefined &&
            vd._ramAnchorSpeedV367 === targetSpd &&
            vd._ramAnchorGearV367 === gKey &&
            vd._ramAnchorRevV367 === isRev
        ) {
            var elapsedCtx = vd.ctx.currentTime - vd._ramAnchorCtxTimeV367;
            var expectedAudioSec = isRev
                ? (vd._ramAnchorMediaSecV367 - elapsedCtx * targetSpd)
                : (vd._ramAnchorMediaSecV367 + elapsedCtx * targetSpd);
            var signedErrSec = isRev
                ? (expectedAudioSec - audioTargetSec)
                : (audioTargetSec - expectedAudioSec);
            var absDriftSec = Math.abs(signedErrSec);

            var remWindowSec = (vd._ramWinRealDurSecV367 || 1800.0) - elapsedCtx;
            if (remWindowSec > 1.0) {
                // Do not touch playback during the first 1.5s after starting `vd.sourceNode`
                if (elapsedCtx < 1.5 || absDriftSec < 0.45) {
                    var baseNodeRate = vd._ramBaseNodeRateV372 || ((gKey === 'jbuf-lock' || gKey === 'web-lock') ? 1.0 : targetSpd);
                    var pllFactor = 1.0;
                    if (elapsedCtx >= 0.8 && absDriftSec > 0.035 && (!isRev || st._revStreamStartedPlayingV220)) {
                        pllFactor = Math.max(0.97, Math.min(1.03, 1.0 + signedErrSec * 0.12));
                    }
                    try {
                        vd.sourceNode.playbackRate.value = baseNodeRate * pllFactor;
                    } catch (e) {}
                    if (pllFactor !== 1.0) {
                        var dtPull = (pllFactor - 1.0) * 0.22 * targetSpd;
                        vd._ramAnchorMediaSecV367 += isRev ? (-dtPull) : dtPull;
                    }
                    vd._driftHitsV372 = 0;
                    if (!isRev && Math.abs(vid.playbackRate - targetSpd) > 0.005) {
                        try { vid.playbackRate = targetSpd; } catch (e) {}
                    }
                    return;
                }
                // Even if drift >= 0.45s, require 3 consecutive checks (~660ms) so a single WebView currentTime hiccup never cuts audio
                vd._driftHitsV372 = (vd._driftHitsV372 || 0) + 1;
                if (vd._driftHitsV372 < 3) {
                    return;
                }
            }
        }

        window.stopDeckBRamSourceNodeV372(vd);
        vd._driftHitsV372 = 0;

        if (st.userPaused || (window._jennyDualDeckV211 && window._jennyDualDeckV211.deckB === false)) {
            return;
        }
        if (vd.ctx.state === 'suspended') {
            try { vd.ctx.resume(); } catch (e) {}
        }

        // FAST PATH: At 1.0x Forward (or any speed in shift gears), play directly from `vd.studioBuffer` (or `vd.reversedStudioBuffer` at 1.0x Reverse)
        // with ZERO window slicing and ZERO WSOLA rebuilds!
        var canPlayFullBufferDirectly = Boolean(
            Math.abs(targetSpd - 1.0) < 0.005 ||
            (gKey !== 'jbuf-lock' && gKey !== 'web-lock')
        );

        if (canPlayFullBufferDirectly) {
            var directBuf = isRev ? vd.reversedStudioBuffer : vd.studioBuffer;
            if (directBuf && directBuf.duration > 0.1) {
                var liveCur = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
                var liveTargetSec = isRev
                    ? Math.max(0, liveCur - effLeadSec * targetSpd)
                    : Math.max(0, liveCur + effLeadSec * targetSpd);
                var bufStartOffset = isRev
                    ? Math.max(0, Math.min(directBuf.duration - 0.02, directBuf.duration - liveTargetSec))
                    : Math.max(0, Math.min(directBuf.duration - 0.02, liveTargetSec));

                vd.sourceNode = vd.ctx.createBufferSource();
                vd.sourceNode.buffer = directBuf;
                vd.sourceNode.playbackRate.value = targetSpd;
                vd.sourceNode.connect(st.dspBypass ? vd.directBypassGain : vd.inputMixer);
                if (st.dspBypass && vd.directBypassGain) vd.directBypassGain.gain.value = 1.0;
                vd.sourceNode.start(0, bufStartOffset);
                vd.isStudioPlaying = true;

                var fullRemDur = (directBuf.duration - bufStartOffset) / Math.max(0.25, targetSpd);
                vd._ramAnchorCtxTimeV367 = vd.ctx.currentTime;
                vd._ramAnchorMediaSecV367 = liveTargetSec;
                vd._ramAnchorSpeedV367 = targetSpd;
                vd._ramAnchorGearV367 = gKey;
                vd._ramAnchorRevV367 = isRev;
                vd._ramBaseNodeRateV372 = targetSpd;
                vd._ramWinRealDurSecV367 = fullRemDur;

                if (!isRev && Math.abs(vid.playbackRate - targetSpd) > 0.005) {
                    try { vid.playbackRate = targetSpd; } catch (e) {}
                }
                return;
            }
        }

        // WSOLA WINDOW PATH (only when `targetSpd !== 1.0` in pitch-locked `jbuf-lock` / `web-lock` mode):
        var buildStartWallMs = performance.now();
        var WIN_SEC = Math.max(28.0, Math.min(60.0, targetSpd * 28.0));
        var rawWinBuf = null;
        if (isRev && vd.reversedStudioBuffer) {
            var durRev = vd.reversedStudioBuffer.duration;
            var revStartSec = Math.max(0, Math.min(durRev - 0.05, durRev - audioTargetSec));
            rawWinBuf = window.extractVideoWindowBufferV131(vd.reversedStudioBuffer, revStartSec, WIN_SEC, false);
        } else if (vd.studioBuffer) {
            rawWinBuf = window.extractVideoWindowBufferV131(vd.studioBuffer, audioTargetSec, WIN_SEC, isRev);
        }
        if (!rawWinBuf) return;

        var tensionPct = (vd.config && vd.config.hoseTensionPct !== undefined) ? vd.config.hoseTensionPct : 100;
        var playBuf = window.buildElasticHoseBufferDeckB ? window.buildElasticHoseBufferDeckB(rawWinBuf, targetSpd, tensionPct) : rawWinBuf;
        var nodeRate = (playBuf === rawWinBuf) ? targetSpd : 1.0;

        var buildElapsedSec = Math.max(0, (performance.now() - buildStartWallMs) / 1000.0);
        var startOffsetInPlayBuf = (nodeRate === 1.0) ? buildElapsedSec : (buildElapsedSec * targetSpd);
        if (startOffsetInPlayBuf >= playBuf.duration - 0.1) {
            startOffsetInPlayBuf = 0;
        }
        var compensatedMediaAnchorSec = isRev
            ? Math.max(0, audioTargetSec - buildElapsedSec * targetSpd)
            : (audioTargetSec + buildElapsedSec * targetSpd);

        vd.sourceNode = vd.ctx.createBufferSource();
        vd.sourceNode.buffer = playBuf;
        vd.sourceNode.playbackRate.value = nodeRate;
        vd.sourceNode.connect(st.dspBypass ? vd.directBypassGain : vd.inputMixer);
        if (st.dspBypass && vd.directBypassGain) vd.directBypassGain.gain.value = 1.0;
        vd.sourceNode.start(0, startOffsetInPlayBuf);
        vd.isStudioPlaying = true;

        var remBufDur = Math.max(0.5, playBuf.duration - startOffsetInPlayBuf);
        var realDurSec = (nodeRate === 1.0) ? remBufDur : (remBufDur / Math.max(0.25, nodeRate));
        vd._ramAnchorCtxTimeV367 = vd.ctx.currentTime;
        vd._ramAnchorMediaSecV367 = compensatedMediaAnchorSec;
        vd._ramAnchorSpeedV367 = targetSpd;
        vd._ramAnchorGearV367 = gKey;
        vd._ramAnchorRevV367 = isRev;
        vd._ramBaseNodeRateV372 = nodeRate;
        vd._ramWinRealDurSecV367 = realDurSec;

        if (!isRev && Math.abs(vid.playbackRate - targetSpd) > 0.005) {
            try { vid.playbackRate = targetSpd; } catch (e) {}
        }

        vd.horizonTimer = setTimeout(function() {
            if (st.active && !st.userPaused) {
                window.syncVideoRamEngineV211(false, true);
            }
        }, Math.max(500, (realDurSec - 0.85) * 1000));
    };

    // Keep telemetry badge showing "🟢 ОЗУ Буфер #3" even during the brief 200ms seek transition when RAM buffer is already loaded
    var _origUpdateRadarV367 = window.updateVideoAvSyncRadarUIV367;
    if (typeof _origUpdateRadarV367 === 'function') {
        window.updateVideoAvSyncRadarUIV367 = function() {
            var vd = window.videoDeckV131;
            var st = window._vidStateV130;
            var savedPlaying = vd ? vd.isStudioPlaying : false;
            var savedNode = vd ? vd.sourceNode : null;
            if (vd && st && st.active && vd.studioBuffer && !vd.isStudioPlaying && (window._vidIsBufferingV132 || st._vidAdvancingAfterSeekV372 === false)) {
                vd.isStudioPlaying = true;
                vd.sourceNode = vd.sourceNode || {};
            }
            try {
                return _origUpdateRadarV367.apply(this, arguments);
            } finally {
                if (vd) {
                    vd.isStudioPlaying = savedPlaying;
                    vd.sourceNode = savedNode;
                }
            }
        };
    }
})();

/* ================= [FIX-YOUTUBE-COMPLETE-V252] YOUTUBE VIDEO DECK B & MP4 DOWNLOAD ================= */
(function() {
    var _origGetEffVidDurV253 = window.getEffectiveVideoDurationV210;
    if (typeof _origGetEffVidDurV253 === 'function') {
        window.getEffectiveVideoDurationV210 = function(vidEl) {
            var d = _origGetEffVidDurV253.apply(this, arguments);
            if (d && isFinite(d) && d > 1) return d;
            if (Number(window._ytDeckBKnownDurationSecV253 || 0) > 0) {
                return Number(window._ytDeckBKnownDurationSecV253);
            }
            return d;
        };
    }

    window.playYoutubeVideoInDeckBV230 = async function(videoId, title, preferredHeight, btnEl) {
        var vid = String(videoId || '').trim();
        if (!vid) return;
        var prefH = parseInt(preferredHeight, 10) || (window._ytStudioStateV252 && window._ytStudioStateV252.selectedHeight) || 720;
        var limitMb = (typeof window.getYtPreloadLimitMbV253 === 'function') ? window.getYtPreloadLimitMbV253() : 300;

        if (typeof window.stopAllExternalPreviewsAndMainDecksV241 === 'function') {
            window.stopAllExternalPreviewsAndMainDecksV241();
        }
        var oldTxt = btnEl ? btnEl.innerText : '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerText = '⏳ Подготовка Деки Б...';
        }
        if (typeof window.showToast === 'function') {
            window.showToast('⏳ Подготовка видео (' + prefH + 'p) для Деки Б...');
        }

        try {
            var r = await fetch('/api/youtube/resolve_deck_b', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: vid, height: prefH, limit_mb: limitMb })
            });
            var rawTxt = await r.text();
            var j = null;
            try {
                j = JSON.parse(rawTxt);
            } catch (pe) {
                throw new Error('Некорректный ответ сервера: ' + rawTxt.slice(0, 80));
            }
            if (!j || j.status !== 'ok' || !j.stream_url) {
                throw new Error((j && j.error) ? j.error : 'Не удалось подготовить видео для Деки Б');
            }

            window._ytDeckBKnownDurationSecV253 = Number(j.duration || 0);

            var ytModal = document.getElementById('jennyYoutubeStudioModalV230');
            if (ytModal) ytModal.style.setProperty('display', 'none', 'important');

            var modeTag = (j.mode === 'chunked_stream') ? ' [Поток 1.5МБ • ' : ' [';
            var dispName = (j.title || title || ('YouTube_' + vid)) + modeTag + (j.height || prefH) + 'p].mp4';
            if (typeof window.openJennyVideoPlayerV130 === 'function') {
                await window.openJennyVideoPlayerV130(j.stream_url, dispName, {});
            }
        } catch (e) {
            if (typeof window.showToast === 'function') {
                window.showToast('❌ Ошибка Деки Б: ' + (e.message || e));
            }
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerText = oldTxt || '🎬 В Деку Б';
            }
        }
    };

    window.downloadYoutubeVideoV230 = async function(videoId, title, preferredHeight, btnEl) {
        var vid = String(videoId || '').trim();
        if (!vid) return;
        var prefH = parseInt(preferredHeight, 10) || (window._ytStudioStateV252 && window._ytStudioStateV252.selectedHeight) || 720;

        var oldTxt = btnEl ? btnEl.innerText : '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerText = '⏳ Скачивание MP4...';
        }
        if (typeof window.showToast === 'function') {
            window.showToast('⏳ Скачивание видео MP4 (' + prefH + 'p): ' + (title || vid));
        }

        try {
            var r = await fetch('/api/youtube/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: vid, height: prefH })
            });
            var rawTxt = await r.text();
            var j = null;
            try {
                j = JSON.parse(rawTxt);
            } catch (pe) {
                throw new Error('Ошибка ответа сервера: ' + rawTxt.slice(0, 80));
            }
            if (!j || j.status !== 'ok') {
                throw new Error((j && j.error) ? j.error : 'Ошибка сохранения MP4');
            }
            if (typeof window.showToast === 'function') {
                window.showToast('✅ Видео сохранено (' + (j.size_mb || '?') + ' МБ): ' + (j.filename || j.path));
            }
        } catch (e) {
            if (typeof window.showToast === 'function') {
                window.showToast('❌ Ошибка скачивания MP4: ' + (e.message || e));
            }
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerText = oldTxt || '📹 MP4';
            }
        }
    };
})();
/* ================= END [FIX-YOUTUBE-COMPLETE-V252] ================= */

