/* ============================================================================
 * ui_transport.js — Дека А: playTrack, play/pause, след./пред., кнопка в строке
 *
 * Склейка:  /bundle_2_player.js, модуль 5 из 18. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   playTrack, handleTrackPlayBtn, playNextTrack, playPreviousTrack, togglePlayV75_2, setupSeekZone, isDeckAActuallyPlayingV232, togglePlay, nextTrack
 * Откуда:   ui_v71.js (коммит 9ae6639), строки 104…37848 (23 фрагментов, вперемешку с другими темами). Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */


;(function hookPlayStatsV71() {
    const origPlay = window.playTrack;
    if (typeof origPlay === 'function' && !window._playStatHookedV71) {
        window._playStatHookedV71 = true;
        window.playTrack = function(filename, listContext) {
            window.ensurePlaylistStateV71();
            if (filename) {
                const st = window.appConfig.trackPlayStatsV71[filename] || { count: 0, last: 0 };
                st.count = (st.count || 0) + 1;
                st.last = Date.now();
                window.appConfig.trackPlayStatsV71[filename] = st;
                localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
            }
            return origPlay.apply(this, arguments);
        };
    }
})();

window.handleTrackPlayBtn = function(filename, listContext, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const player = document.getElementById('audioPlayer');
    if (window.currentPlayingTrack === filename && player && player.src) {
        window.togglePlay();
    } else {
        window.lockCurrentViewAsPlayingQueueV73_1(filename);
        window.playTrack(filename, 'queue');
    }
};

// Защищаем очередь внутри playTrack, чтобы старый код из ui_playback.js не сбрасывал её на session_tracks
;(function protectQueueInPlayTrackV73_1() {
    const origPlayTrack = window.playTrack;
    window.playTrack = async function(filename, listContext) {
        if (listContext !== 'queue' && (!window.playingQueueListV73 || !window.playingQueueListV73.includes(filename))) {
            window.lockCurrentViewAsPlayingQueueV73_1(filename);
        }
        const savedQueue = (window.playingQueueListV73 && window.playingQueueListV73.length > 0)
            ? [...window.playingQueueListV73]
            : null;

        const res = await origPlayTrack.call(this, filename, 'queue');

        if (savedQueue) {
            window.playingQueueListV73 = savedQueue;
            window.currentTrackList = savedQueue;
        }
        return res;
    };
})();

window.playNextTrack = function() {
    const queue = window.getEffectivePlaybackQueueV73_1();
    if (!queue || queue.length === 0) return;

    if (!window.currentPlayingTrack) {
        window.playTrack(queue[0], 'queue');
        return;
    }

    let idx = queue.indexOf(window.currentPlayingTrack);
    let nextIdx = (idx !== -1) ? ((idx + 1) % queue.length) : 0;
    window.playTrack(queue[nextIdx], 'queue');
};

window.playPreviousTrack = function() {
    const queue = window.getEffectivePlaybackQueueV73_1();
    if (!queue || queue.length === 0) return;

    if (!window.currentPlayingTrack) {
        window.playTrack(queue[0], 'queue');
        return;
    }

    let idx = queue.indexOf(window.currentPlayingTrack);
    let prevIdx = (idx !== -1) ? ((idx - 1 + queue.length) % queue.length) : 0;
    window.playTrack(queue[prevIdx], 'queue');
};
window._pendingSeekTargetV75 = null;


// === V75.2 INDESTRUCTIBLE CAPTURE-PHASE PLAY/PAUSE & LONG-PRESS LOCATOR ===

window.togglePlayV75_2 = function() {
    const player = document.getElementById('audioPlayer');
    if (!player) return;

    if (!player.src && !window.currentPlayingTrack) {
        const firstTrack = window.topTrack || (window.currentTrackList && window.currentTrackList[0]);
        if (firstTrack && typeof window.playTrack === 'function') {
            window.playTrack(firstTrack, 'main');
        }
        return;
    }

    if (typeof window.initAudioBoost === 'function') window.initAudioBoost();
    if (window.audioCtx && window.audioCtx.state === 'suspended') {
        try { window.audioCtx.resume(); } catch (e) {}
    }

    const isPlayingNow = (!player.paused) || Boolean(window.isStudioPlaying && window.studioSourceNode);
    const btn = document.getElementById('playPauseBtn');

    if (isPlayingNow) {
        window._userPausedV75_2 = true;
        if (window.studioSourceNode) {
            window.studioSourceNode.onended = null;
            try { window.studioSourceNode.stop(); } catch (e) {}
            try { window.studioSourceNode.disconnect(); } catch (e) {}
            window.studioSourceNode = null;
        }
        window.isStudioPlaying = false;
        if (window._studioClockV74_1) {
            window._studioClockV74_1.active = false;
        }
        try { player.pause(); } catch (e) {}

        if (btn) {
            btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        }
        if (typeof window.updateTrackListPlayIcons === 'function') {
            window.updateTrackListPlayIcons();
        }
    } else {
        window._userPausedV75_2 = false;
        if (btn) {
            btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
        }
        const resumeStudio = () => {
            if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            }
            if (typeof window.updateTrackListPlayIcons === 'function') {
                window.updateTrackListPlayIcons();
            }
        };
        const p = player.play();
        if (p && typeof p.then === 'function') {
            p.then(resumeStudio).catch(resumeStudio);
        } else {
            resumeStudio();
        }
    }
};

window.togglePlay = window.togglePlayV75_2;
window.togglePlayPause = window.togglePlayV75_2;

;(function installPlayPauseDocumentCaptureV75_2() {
    if (window._ppDocCaptureInstalledV75_2) return;
    window._ppDocCaptureInstalledV75_2 = true;

    const getPlayPauseBtn = (target) => {
        if (!target || !target.closest) return null;
        return target.closest('#playPauseBtn');
    };

    // [V356] Перехватываем touchstart/touchend/click СТРОГО только когда e.target находится внутри #playPauseBtn,
    // чтобы изолировать старый 500мс таймер из ui_controls.js и НИКОГДА не оставлять залипший флаг touchActive,
    // который раньше срабатывал при следующем касании перемотки, эквалайзера или настроек DSP!
    document.addEventListener('touchstart', (e) => {
        const btn = getPlayPauseBtn(e.target);
        if (!btn) return;
        e.stopImmediatePropagation();
    }, { capture: true, passive: true });

    document.addEventListener('touchend', (e) => {
        const btn = getPlayPauseBtn(e.target);
        if (!btn) return;
        e.stopImmediatePropagation();
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
    }, { capture: true, passive: false });

    document.addEventListener('click', (e) => {
        const btn = getPlayPauseBtn(e.target);
        if (!btn) return;
        e.stopImmediatePropagation();
        e.stopPropagation();
        e.preventDefault();
        if (Date.now() < (window._suppressPlayPauseUntilV235 || 0)) return;
        if (performance.now() - (window._lastTogglePlayWallTsV232 || 0) > 320) {
            window.togglePlayV75_2(e);
        }
    }, { capture: true, passive: false });
})();


/* [split] блок 146: кусок исходного IIFE (ui_v71.js, строки 3742–3851) → ui_transport.js */
;(function installDnaDirectEngineHookV83() {
    const origPlayTrack = window.playTrack;
    if (typeof origPlayTrack === 'function' && !window._dnaPlayTrackWrappedV83) {
        window._dnaPlayTrackWrappedV83 = true;
        window.playTrack = async function(filename, context) {
            if (window.dnaDirect1xActiveV76 && filename !== window.currentPlayingTrack) {
                window.resetDnaModeOnTrackChangeV83();
            }
            const player = document.getElementById('audioPlayer');
            if (player) {
                player.loop = false;
                try { player.playbackRate = 1.0; } catch (e) {}
            }
            return await origPlayTrack.apply(this, arguments);
        };
    }
})();

const _origHandleTrackPlayV130 = window.handleTrackPlayBtn;
window.handleTrackPlayBtn = function(filename, listContext, ev) {
if (window.isVideoFileNameV130(filename)) {
if (ev && ev.stopPropagation) ev.stopPropagation();
window.openJennyVideoPlayerV130('/api/media/' + encodeURIComponent(filename), filename, {});
return;
}
return _origHandleTrackPlayV130.apply(this, arguments);
};

// Запуск видео из вкладки «🎬 Видео» (поддерживает и локальные файлы из JennyVideo, и прямые потоки из торрента!)
window.handleTrackPlayBtn = function(filename, listContext, ev) {
if (window.isVideoFileNameV130(filename)) {
if (ev && ev.stopPropagation) ev.stopPropagation();
const meta = (window._dedicatedVideoMetaMapV137 && window._dedicatedVideoMetaMapV137[filename])
|| window.collectClientTorrentVideosV137().find(x => x.name === filename)
|| {};
const url = meta.stream_url || ('/api/media/' + encodeURIComponent(filename));
window.openJennyVideoPlayerV130(url, filename, {
torHash: meta.tor_hash || '',
torFileIdx: meta.tor_file_idx !== undefined ? Number(meta.tor_file_idx) : -1
});
return;
}
return _origHandleTrackPlayV130.apply(this, arguments);
};

/* [split] V211: кусок исходного IIFE (ui_v71.js, строки 16526–17925) → ui_transport.js */
;(function() {
    if (window._jennyV211Installed__transport) return;
    window._jennyV211Installed__transport = true;
    window._jennyV211Installed = true;

    // 5. РАЗДЕЛЕНИЕ СОБЫТИЙ ЗАПУСКА АУДИО (ДЕКА А) И ВИДЕО (ДЕКА Б) БЕЗ ВЗАИМНОЙ БЛОКИРОВКИ
    var _origPlayTrackV211 = window.playTrack;
    if (typeof _origPlayTrackV211 === 'function') {
        window.playTrack = async function(filename, context) {
            window._jennyDualDeckV211.deckA = true;
            window.saveDualDeckStateV211();
            window.syncDualDeckVisibilityAndAudioV211();
            window.renderDeckSwitchBannersV131();
            return _origPlayTrackV211.apply(this, arguments);
        };
    }
})();

/* [split] V212: кусок исходного IIFE (ui_v71.js, строки 17929–18897) → ui_transport.js */
;(function() {
    if (window._jennyV212Installed__transport) return;
    window._jennyV212Installed__transport = true;
    window._jennyV212Installed = true;
    window._v130UserDraggingSeekV212 = false;
})();

/* [split] V216: кусок исходного IIFE (ui_v71.js, строки 19638–21240) → ui_transport.js */
;(function() {
    if (window._jennyV216Installed__transport) return;
    window._jennyV216Installed__transport = true;
    window._jennyV216Installed = true;

    window.playTrack = async function(filename, listContext) {
        if (!filename) return;
        listContext = listContext || 'main';

        // Если это видеофайл — открываем его в видеоплеере Деки Б!
        if (window.isVideoFileNameV130 && window.isVideoFileNameV130(filename)) {
            window.openJennyVideoPlayerV130('/api/media/' + encodeURIComponent(filename), filename, {});
            return;
        }

        // Отменяем все незавершённые фоновые загрузки предыдущего трека, чтобы пул HTTP-соединений был 100% свободен!
        var mySeq = ++window._audioTrackLoadSeqV216;
        window.abortPendingAudioRamLoadsV216();

        window._jennyDualDeckV211 = window._jennyDualDeckV211 || { deckA: true, deckB: false, uiFocus: 'music' };
        window._jennyDualDeckV211.deckA = true;
        if (typeof window.saveDualDeckStateV211 === 'function') window.saveDualDeckStateV211();
        if (typeof window.syncDualDeckVisibilityAndAudioV211 === 'function') window.syncDualDeckVisibilityAndAudioV211();
        if (typeof window.renderDeckSwitchBannersV131 === 'function') window.renderDeckSwitchBannersV131();

        if (typeof window.ensurePlaylistStateV71 === 'function') window.ensurePlaylistStateV71();
        if (window.appConfig && window.appConfig.trackPlayStatsV71) {
            var stStat = window.appConfig.trackPlayStatsV71[filename] || { count: 0, last: 0 };
            stStat.count = (stStat.count || 0) + 1;
            stStat.last = Date.now();
            window.appConfig.trackPlayStatsV71[filename] = stStat;
            try { localStorage.setItem('ytm_config', JSON.stringify(window.appConfig)); } catch (e) {}
        }

        if (window.dnaDirect1xActiveV76 && filename !== window.currentPlayingTrack && typeof window.resetDnaModeOnTrackChangeV83 === 'function') {
            window.resetDnaModeOnTrackChangeV83();
        }

        if (listContext !== 'queue' && (!window.playingQueueListV73 || !window.playingQueueListV73.includes(filename))) {
            if (typeof window.lockCurrentViewAsPlayingQueueV73_1 === 'function') {
                window.lockCurrentViewAsPlayingQueueV73_1(filename);
            }
        }
        var savedQueue = (window.playingQueueListV73 && window.playingQueueListV73.length > 0)
            ? window.playingQueueListV73.slice()
            : null;

        window.studioBuffer = null;
        window.reversedStudioBuffer = null;
        window.reconstructedMasterBufferV67 = null;
        window.reconstructedReversedBufferV67 = null;
        window.currentTrackRevMapV67 = null;

        if (typeof window.initAudioBoost === 'function') window.initAudioBoost();
        if (window.audioCtx && window.audioCtx.state === 'suspended') {
            try { window.audioCtx.resume(); } catch (e) {}
        }
        if (typeof window.applyEQSettings === 'function') window.applyEQSettings();
        if (typeof window.changeVolume === 'function') window.changeVolume();

        var targetSpeed = typeof window.getTargetPlaybackSpeed === 'function' ? window.getTargetPlaybackSpeed() : 1.0;
        var keepLocked = Boolean((window.scrubState && window.scrubState.locked) || (window.persistedPlaybackSpeed && window.persistedPlaybackSpeed !== 1.0));
        var activeSide = (window.scrubState && window.scrubState.side) || window.persistedPlaybackSide || 'right';

        window.currentPlayingTrack = filename;
        window.currentListContext = listContext;
        if (savedQueue) {
            window.playingQueueListV73 = savedQueue;
            window.currentTrackList = savedQueue;
        }
        if (typeof window.updateTrackListPlayIcons === 'function') window.updateTrackListPlayIcons();

        var player = document.getElementById('audioPlayer');
        var titleEl = document.getElementById('nowPlaying');

        if (window.studioSourceNode) {
            window.studioSourceNode.onended = null;
            try { window.studioSourceNode.stop(); } catch (e) {}
            try { window.studioSourceNode.disconnect(); } catch (e) {}
            window.studioSourceNode = null;
        }
        window.isStudioPlaying = false;
        window.studioBuffer = null;
        window.reversedStudioBuffer = null;
        window.reconstructedMasterBufferV67 = null;
        window.reconstructedReversedBufferV67 = null;
        window.currentTrackRevMapV67 = null;
        window._userPausedV75_2 = false;

        if (keepLocked && window.scrubState) {
            window.scrubState.locked = true;
            window.scrubState.active = false;
            window.scrubState.speed = targetSpeed;
            window.scrubState.side = activeSide;
            window.scrubState.isPhysicallyReversed = (activeSide === 'left');
            var lockEl = document.getElementById('speedLockIndicator');
            if (lockEl) {
                lockEl.style.display = 'block';
                lockEl.innerText = '🔒 ' + (activeSide === 'left' ? '⏪' : '⏩') + ' x' + targetSpeed;
            }
        } else if (window.scrubState && window.scrubState.active) {
            if (typeof window.stopScrub === 'function') window.stopScrub(false);
        }

        var isRevMode = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
        if (typeof window.updateProgressUI === 'function') window.updateProgressUI(0, 0, isRevMode);
        if (typeof window.updateCenterCurrentTime === 'function') window.updateCenterCurrentTime(0, 0, isRevMode);

        // Проверяем быстрый RAM-кэш последних треков
        window._ramTrackHistoryV71 = window._ramTrackHistoryV71 || [];
        var cachedEntry = window._ramTrackHistoryV71.find(function(x) { return x.name === filename && x.buf; });

        var mediaUrl = (cachedEntry && cachedEntry.blobUrl) ? cachedEntry.blobUrl : ('/api/media/' + encodeURIComponent(filename));

        // КРИТИЧЕСКИЙ МОМЕНТ V216: СРАЗУ запускаем сжатый/потоковый звук через <audio> в 1-ю миллисекунду (без ожидания fetch/blob!)
        // и СРАЗУ выводим в шкалу прогресса "⏳ RAM (пока играет сжатый...): "!
        if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
        if (player) {
            player.loop = false;
            player.src = mediaUrl;
            player.currentTime = 0;
            try { player.playbackRate = Math.max(0.1, Math.min(16.0, targetSpeed)); } catch (e) {}
            player.preservesPitch = true;
            player.play().catch(function(){});
        }

        var startPlayWallMs = performance.now();
        var useStudioRam = Boolean(!window.appConfig || window.appConfig.studioMode !== false);
        if (titleEl) {
            titleEl.innerText = (useStudioRam ? '⏳ RAM (пока играет сжатый...): ' : '🎵 ') + filename;
        }
        if (typeof window.updateTrackListPlayIcons === 'function') window.updateTrackListPlayIcons();

        if (!useStudioRam) return;

        // Фоновая распаковка в RAM с поддержкой отмены при переключении трека
        var abortCtrl = new AbortController();
        window._audioRamAbortCtrlV216 = abortCtrl;

        try {
            var decodedBuffer = null;
            if (cachedEntry && cachedEntry.buf) {
                decodedBuffer = cachedEntry.buf;
            } else {
                var metaCheck = { duration: 0, size: 0 };
                try {
                    var mr = await fetch('/api/pcm_meta_v71/' + encodeURIComponent(filename), { signal: abortCtrl.signal });
                    if (mr.ok) metaCheck = await mr.json();
                } catch (e) {
                    if (abortCtrl.signal.aborted || mySeq !== window._audioTrackLoadSeqV216) return;
                }
                if (mySeq !== window._audioTrackLoadSeqV216 || window.currentPlayingTrack !== filename) return;

                if (!metaCheck.size || metaCheck.size <= 95 * 1024 * 1024) {
                    try {
                        var response = await fetch('/api/media/' + encodeURIComponent(filename), { signal: abortCtrl.signal });
                        if (response.ok) {
                            var arrayBuffer = await response.arrayBuffer();
                            if (mySeq !== window._audioTrackLoadSeqV216 || window.currentPlayingTrack !== filename) return;
                            decodedBuffer = await window.audioCtx.decodeAudioData(arrayBuffer);
                            if (decodedBuffer) {
                                window._ramTrackHistoryV71 = window._ramTrackHistoryV71.filter(function(x) { return x.name !== filename; }).slice(0, 1);
                                window._ramTrackHistoryV71.unshift({ name: filename, buf: decodedBuffer, blobUrl: null });
                            }
                        }
                    } catch (decErr) {
                        if (abortCtrl.signal.aborted || mySeq !== window._audioTrackLoadSeqV216) return;
                        decodedBuffer = await window.decodeHugeTrackToRamV71(filename, titleEl, player, metaCheck);
                    }
                } else {
                    decodedBuffer = await window.decodeHugeTrackToRamV71(filename, titleEl, player, metaCheck);
                    if (decodedBuffer && mySeq === window._audioTrackLoadSeqV216) {
                        window._ramTrackHistoryV71 = window._ramTrackHistoryV71.filter(function(x) { return x.name !== filename; }).slice(0, 1);
                        window._ramTrackHistoryV71.unshift({ name: filename, buf: decodedBuffer, blobUrl: null });
                    }
                }
            }

            if (mySeq !== window._audioTrackLoadSeqV216 || window.currentPlayingTrack !== filename) return;

            if (!decodedBuffer) {
                if (titleEl) titleEl.innerText = '🎵 ' + filename;
                return;
            }

            // Даём сжатому потоку ("⏳ RAM (пока играет сжатый...)") спокойно отыграть ~1.8 секунды,
            // чтобы пользователь видел индикацию внутри шкалы прогресса и старт шёл без микро-щелчка на первой секунде!
            var elapsedMs = performance.now() - startPlayWallMs;
            if (elapsedMs < 1800 && !isRevMode) {
                await new Promise(function(r) { setTimeout(r, 1800 - elapsedMs); });
            }
            if (mySeq !== window._audioTrackLoadSeqV216 || window.currentPlayingTrack !== filename) return;

            window.studioBuffer = decodedBuffer;
            if (window.appConfig && window.appConfig.opt_autoRms && typeof window.computeBufferAutoGain === 'function') {
                window.computeBufferAutoGain(decodedBuffer, window.appConfig.val_autoRms);
            }
            if (typeof window.buildAudioGraph === 'function') {
                window.buildAudioGraph(true);
            }
            if (typeof window.loadTrackReversibleDataV67 === 'function') {
                window.loadTrackReversibleDataV67(filename, decodedBuffer);
            }

            var isHugeTrack = (decodedBuffer.duration > 900);
            if (!isHugeTrack && !window.reversedStudioBuffer && typeof window.cloneAndReverseBuffer === 'function') {
                window.reversedStudioBuffer = await window.cloneAndReverseBuffer(decodedBuffer);
            }
            if (mySeq !== window._audioTrackLoadSeqV216 || window.currentPlayingTrack !== filename) return;

            if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            }
            if (titleEl) {
                var hasRev = Boolean(window.reversedStudioBuffer);
                titleEl.innerText = 'RAM 🚀: ' + filename;
            }
            if (typeof window.updateTrackListPlayIcons === 'function') window.updateTrackListPlayIcons();
        } catch (err) {
            if (mySeq === window._audioTrackLoadSeqV216 && window.currentPlayingTrack === filename && titleEl) {
                if (player && !player.paused) titleEl.innerText = '🎵 ' + filename;
                else titleEl.innerText = '❌ Ошибка загрузки: ' + filename;
            }
        }
    };
})();

/* [split] V219: кусок исходного IIFE (ui_v71.js, строки 24063–25074) → ui_transport.js */
;(function() {
    if (window._jennyV219Installed__transport) return;
    window._jennyV219Installed__transport = true;
    window._jennyV219Installed = true;

    // Дополнительно следим, чтобы при постановке видео на паузу холст #jv166InterpCanvas мгновенно скрывался и не перекрывал кадр чёрным цветом
    document.addEventListener('pause', function(e) {
        if (e && e.target && e.target.id === 'jennyVideoElV130') {
            var glC = document.getElementById('jv166InterpCanvas');
            if (glC) glC.style.setProperty('display', 'none', 'important');
        }
    }, true);
})();

/* [split] V227: кусок исходного IIFE (ui_v71.js, строки 26642–27952) → ui_transport.js */
;(function() {
    if (window._jennyV227Installed__transport) return;
    window._jennyV227Installed__transport = true;
    window._jennyV227Installed = true;

    window.setupSeekZone = function() {
        var origZone = document.getElementById('seekZone');
        var arcContainer = document.getElementById('speedArcContainer');
        var overlay = document.getElementById('scrubOverlay');
        if (!origZone || !arcContainer || !overlay || origZone._v228Bound) return;

        var zone = origZone.cloneNode(true);
        zone._v228Bound = true;
        origZone.replaceWith(zone);

        var debugCanvas = document.getElementById('debugZoneCanvas');
        if (!debugCanvas) {
            debugCanvas = document.createElement('canvas');
            debugCanvas.id = 'debugZoneCanvas';
            debugCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;width:100%;height:100%;z-index:5998;';
            overlay.appendChild(debugCanvas);
        }

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
        var activeTouchA = false;

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

        function handleTapSeek(x) {
            if (x === undefined || isNaN(x)) return;
            var rect = zone.getBoundingClientRect();
            var perc = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
            var player = document.getElementById('audioPlayer');
            if (player && isFinite(player.duration) && player.duration > 0) {
                var isVisualReverse = window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed);
                if (isVisualReverse) perc = 1.0 - perc;
                player.currentTime = perc * player.duration;
                if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                    window.syncMasterPlaybackEngineV59(false);
                }
            }
        }

        function angleDiffSigned(a, b) {
            return ((a - b) % 360 + 540) % 360 - 180;
        }

        function drawDebugWheel(anchorX, anchorY, angles) {
            debugCanvas.width = window.innerWidth;
            debugCanvas.height = window.innerHeight;
            var ctx = debugCanvas.getContext('2d');
            if (!ctx) return;
            ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);

            var coreGrad = ctx.createRadialGradient(anchorX, anchorY, 2, anchorX, anchorY, 24);
            coreGrad.addColorStop(0, 'rgba(227, 179, 65, 0.95)');
            coreGrad.addColorStop(0.5, 'rgba(163, 113, 247, 0.45)');
            coreGrad.addColorStop(1, 'rgba(115, 65, 190, 0)');
            ctx.beginPath();
            ctx.arc(anchorX, anchorY, 24, 0, 2 * Math.PI);
            ctx.fillStyle = coreGrad;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(anchorX, anchorY, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#e3b341';
            ctx.fill();

            var radius = Math.max(window.innerWidth, window.innerHeight) * 0.95;
            ctx.lineWidth = 1.6;
            ctx.setLineDash([7, 8]);

            for (var i = 0; i < angles.length - 1; i++) {
                var delta = angleDiffSigned(angles[i + 1], angles[i]);
                var midAngle = angles[i] + delta / 2;
                var rad = midAngle * Math.PI / 180;

                var endX = anchorX + radius * Math.cos(rad);
                var endY = anchorY + radius * Math.sin(rad);

                var lineGrad = ctx.createLinearGradient(anchorX, anchorY, endX, endY);
                lineGrad.addColorStop(0, 'rgba(227, 179, 65, 0.65)');
                lineGrad.addColorStop(0.55, 'rgba(163, 113, 247, 0.35)');
                lineGrad.addColorStop(1, 'rgba(88, 166, 255, 0.0)');

                ctx.strokeStyle = lineGrad;
                ctx.beginPath();
                ctx.moveTo(anchorX, anchorY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }

        function generateArc() {
            arcContainer.innerHTML = '';
            arcItems = [];
            circleAngles = [];

            var activeZones = window.getEnabledAudioSpeedZonesV228();
            var isLeftHanded = Boolean(window.appConfig && window.appConfig.leftHandedMode);
            var W = window.innerWidth;
            var H = window.innerHeight;

            // Лучи аудиодеки выходят строго из центра СВОЕЙ фиолетовой кнопки эквалайзера (#btn-eqModal)!
            var eqBtnA = document.getElementById('btn-eqModal');
            if (eqBtnA) {
                var eqRectA = eqBtnA.getBoundingClientRect();
                currentAnchor.x = eqRectA.left + eqRectA.width / 2;
                currentAnchor.y = eqRectA.top + eqRectA.height / 2;
            } else {
                currentAnchor.y = H - 35;
                currentAnchor.x = isLeftHanded ? 31 : (W - 31);
            }

            // Строгая круговая дуга постоянного радиуса R с центром прямо в currentAnchor (#btn-eqModal),
            // как на видео (0% спирали «улиткой», 100% одинаковое расстояние от кнопки эквалайзера до каждого кружка!),
            // а угол endDeg = -168° держит нижний кружок (x0.9) высоко над нижней панелью и строго левее x1.5 без загиба вправо!
            var curveOriginY = currentAnchor.y;
            var startDeg = -104;
            var endDeg   = -168;
            var R        = Math.min(W * 0.74, H * 0.34);
            var rTop     = R;
            var rMid     = R;
            var rBot     = R;

            function sampleCurvePoint(u) {
                var deg = startDeg + u * (endDeg - startDeg);
                var rad = deg * Math.PI / 180;
                var r = (1 - u) * (1 - u) * rTop + 2 * (1 - u) * u * rMid + u * u * rBot;
                var dxRH = r * Math.cos(rad);
                var dy = r * Math.sin(rad);
                var x = currentAnchor.x + (isLeftHanded ? -dxRH : dxRH);
                var y = curveOriginY + dy;
                return {
                    x: Math.max(30, Math.min(W - 30, x)),
                    y: Math.max(140, Math.min(H - 48, y))
                };
            }

            var STEPS = 240;
            var samples = [];
            var totalLen = 0;
            for (var k = 0; k <= STEPS; k++) {
                var pt = sampleCurvePoint(k / STEPS);
                if (k > 0) {
                    totalLen += Math.hypot(pt.x - samples[k - 1].x, pt.y - samples[k - 1].y);
                }
                samples.push({ x: pt.x, y: pt.y, s: totalLen });
            }

            var count = activeZones.length;
            var positions = [];
            for (var i = 0; i < count; i++) {
                var targetS = count === 1 ? (totalLen * 0.5) : (totalLen * (i / (count - 1)));
                var best = samples[0];
                for (var m = 0; m < samples.length; m++) {
                    if (samples[m].s >= targetS) {
                        best = samples[m];
                        break;
                    }
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

                // Угол каждого сектора считаем напрямую от центра СВОЕЙ кнопки эквалайзера Деки А (#btn-eqModal) к центру кружка!
                var angle = Math.atan2(positions[index].y - currentAnchor.y, positions[index].x - currentAnchor.x) * 180 / Math.PI;
                circleAngles.push(angle);

                arcContainer.appendChild(el);
                arcItems.push(el);
            });

            if ( overlay.parentNode !== document.body || overlay.nextSibling !== arcContainer || arcContainer.nextSibling !== null ) {
                try {
                    document.body.appendChild(overlay);
                    document.body.appendChild(arcContainer);
                } catch (e) {}
            }
            overlay.style.setProperty('z-index', '2147483646', 'important');
            arcContainer.style.setProperty('z-index', '2147483647', 'important');
            arcContainer.style.display = 'block';
            setTimeout(function() { arcContainer.style.opacity = '1'; }, 10);

            drawDebugWheel(currentAnchor.x, currentAnchor.y, circleAngles);
        }

        zone.addEventListener('touchstart', function(e) {
            activeTouchA = true;
            var startX = getX(e);
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

                    if (window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed)) {
                        if (typeof window.toggleReverseMode === 'function') window.toggleReverseMode(false);
                    } else if (window.scrubState.active || window.scrubState.locked) {
                        if (typeof window.stopScrub === 'function') window.stopScrub(false);
                    }
                    var baseSpd = typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0;
                    var player = document.getElementById('audioPlayer');
                    if (player) player.playbackRate = baseSpd;
                    if (typeof window.syncMasterPlaybackEngineV59 === 'function') window.syncMasterPlaybackEngineV59(false);

                    var lockEl = document.getElementById('speedLockIndicator');
                    if (lockEl) {
                        lockEl.style.display = 'block';
                        lockEl.innerText = '✅ Норм: x' + baseSpd;
                        setTimeout(function() {
                            if (!window.scrubState.active && !window.scrubState.locked) {
                                lockEl.style.display = 'none';
                            }
                        }, 1000);
                    }
                }, 160);
            } else {
                pressTimer = setTimeout(function() {
                    pressTimer = null;
                    isScrubbing = true;

                    if (window.scrubState.locked) {
                        window.scrubState.locked = false;
                        try { navigator.vibrate(50); } catch (err) {}
                    } else {
                        try { navigator.vibrate(30); } catch (err) {}
                    }

                    var defSpeed = parseFloat(window.appConfig.defaultScrubSpeed) || 2.0;
                    if (typeof window.startScrub === 'function') window.startScrub(scrubSide, defSpeed);
                }, 250);
            }
        }, { passive: true });

        function handleTouchMove(e) {
            if (!activeTouchA) return;
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
                    if (window.scrubState.locked) window.scrubState.locked = false;
                }

                if (!isPullingDown) {
                    isPullingDown = true;
                    overlay.style.display = 'block';
                    generateArc();
                    var defSpeed = parseFloat(window.appConfig.defaultScrubSpeed) || 2.0;
                    if (typeof window.startScrub === 'function') window.startScrub(scrubSide, defSpeed);
                }

                var dx = curX - currentAnchor.x;
                var dy = curY - currentAnchor.y;
                var fingerAngle = Math.atan2(dy, dx) * 180 / Math.PI;

                var minDiff = Infinity;
                var idx = 0;

                circleAngles.forEach(function(ang, i) {
                    var diff = Math.abs(angleDiffSigned(fingerAngle, ang));
                    if (diff < minDiff) {
                        minDiff = diff;
                        idx = i;
                    }
                });

                if (arcItems[idx] && !arcItems[idx].classList.contains('active')) {
                    arcItems.forEach(function(el) { el.classList.remove('active'); });
                    arcItems[idx].classList.add('active');
                    currentTempSpeed = parseFloat(arcItems[idx].dataset.val);
                    if (typeof window.startScrub === 'function') window.startScrub(scrubSide, currentTempSpeed);
                    try { navigator.vibrate(15); } catch (err) {}
                }
            }
        }

        function handleTouchEnd(e) {
            if (!activeTouchA) return;
            activeTouchA = false;
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
                if (isSeekingAllowed) handleTapSeek(getX(e));
            } else if (isScrubbing) {
                arcContainer.style.opacity = '0';
                setTimeout(function() { arcContainer.style.display = 'none'; }, 150);

                if (isPullingDown) {
                    window.scrubState.locked = true;
                    if (typeof window.startScrub === 'function') window.startScrub(scrubSide, currentTempSpeed);

                    var needsSave = false;
                    if (window.appConfig.autoSaveScrub) {
                        window.appConfig.defaultScrubSpeed = currentTempSpeed;
                        var inputEl = document.getElementById('cfg_defaultScrubSpeed');
                        if (inputEl) inputEl.value = currentTempSpeed;
                        needsSave = true;
                    }
                    if (window.appConfig.autoSaveBase) {
                        window.appConfig.normalPlaybackSpeed = currentTempSpeed;
                        var inputEl2 = document.getElementById('cfg_normalPlaybackSpeed');
                        if (inputEl2) inputEl2.value = currentTempSpeed;
                        needsSave = true;

                        var baseCheck = document.getElementById('cfg_xNormalSpeed');
                        if (baseCheck && !baseCheck.checked) {
                            baseCheck.checked = true;
                            window.appConfig.xNormalSpeed = true;
                        }
                    }
                    if (needsSave) {
                        localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
                    }
                } else {
                    if (!window.scrubState.locked) {
                        if (typeof window.stopScrub === 'function') window.stopScrub();
                    }
                }
            }

            overlay.style.display = 'none';
            isPullingDown = false;
            isScrubbing = false;
            scrubSide = null;

            var ctx = debugCanvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
        }

        function handleTouchCancel() {
            if (!activeTouchA) return;
            activeTouchA = false;
            if (pressTimer) clearTimeout(pressTimer);
            arcContainer.style.display = 'none';
            overlay.style.display = 'none';
            if (!window.scrubState.locked) {
                if (typeof window.stopScrub === 'function') window.stopScrub();
            }
            isPullingDown = false;
            isScrubbing = false;

            var ctx = debugCanvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
        }

        zone.addEventListener('touchmove', handleTouchMove, { passive: true });
        zone.addEventListener('touchend', handleTouchEnd);
        zone.addEventListener('touchcancel', handleTouchCancel);

        if (!overlay._v228OverlayBound) {
            overlay._v228OverlayBound = true;
            overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
            overlay.addEventListener('touchend', handleTouchEnd);
            overlay.addEventListener('touchcancel', handleTouchCancel);
        }
    };
})();

/* [split] V229: кусок исходного IIFE (ui_v71.js, строки 27956–28395) → ui_transport.js */
;(function() {
    if (window._jennyV229Installed__transport) return;
    window._jennyV229Installed__transport = true;
    window._jennyV229Installed = true;

    var _origHandleTrackPlayV229 = window.handleTrackPlayBtn;
    if (typeof _origHandleTrackPlayV229 === 'function' && !_origHandleTrackPlayV229._v229Wrapped) {
        window.handleTrackPlayBtn = function(filename, listContext, ev) {
            if (window.isVideoFileNameV130 && window.isVideoFileNameV130(filename)) {
                window.captureActiveVideoQueueFromUIContextV229(filename, listContext);
            }
            return _origHandleTrackPlayV229.apply(this, arguments);
        };
        window.handleTrackPlayBtn._v229Wrapped = true;
    }

    var _origPlayTrackV229 = window.playTrack;
    if (typeof _origPlayTrackV229 === 'function' && !_origPlayTrackV229._v229Wrapped) {
        window.playTrack = function(filename, listContext) {
            if (window.isVideoFileNameV130 && window.isVideoFileNameV130(filename)) {
                window.captureActiveVideoQueueFromUIContextV229(filename, listContext);
            }
            return _origPlayTrackV229.apply(this, arguments);
        };
        window.playTrack._v229Wrapped = true;
    }
})();
/* ================= END JENNY_V230_YOUTUBE_STUDIO_AND_SO_CORE_PATCH ================= */

/* ================= JENNY_V232_AUDIO_STOP_AND_RADIO_EXCLUSIVE_PATCH (#327): UNSTOPPABLE AUDIO TRACK FIX, HARD STOP/PAUSE ON DECK A & TRACK ROWS, FOLDER CHANGE & 1-TRACK END STOP, RADIO/OST/SC/TORRENT EXCLUSIVE AUDIO LOCK (71585.mp4) ================= */
/* [split] V232: кусок исходного IIFE (ui_v71.js, строки 29055–29548) → ui_transport.js */
;(function() {
    if (window._jennyV232Installed__transport) return;
    window._jennyV232Installed__transport = true;
    window._jennyV232Installed = true;

    var PLAY_ICON_SVG_V232 = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    var PAUSE_ICON_SVG_V232 = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    var ROW_PLAY_SVG_V232 = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    var ROW_PAUSE_SVG_V232 = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

    // -------------------------------------------------------------------------
    // 1. ЖЁСТКИЙ БЛОКИРАТОР И МГНОВЕННЫЙ ОСТАНОВ ЗВУКА ДЕКИ А (window.forceStopPauseDeckAAudioV232)
    //    Гарантирует 100% прекращение любого звука Деки А:
    //    - Отменяет фоновую докачку/распаковку в RAM и 1.8-секундный таймер playTrack
    //    - Останавливает и отключает window.studioSourceNode и ВСЕ узлы в window._activeBufferSourcesV71
    //    - Очищает таймеры нарезки окон (_horizonSliceTimerV71 и _hoseArcDebounceTimerV47)
    //    - Ставит на паузу <audio id="audioPlayer"> и принудительно глушит inputMixer.gain = 0
    //    - При fullUnload = true полностью выгружает трек из Деки А (например, при отключении папки)
    // -------------------------------------------------------------------------
    window.isDeckAActuallyPlayingV232 = function() {
        var player = document.getElementById('audioPlayer');
        var htmlPlaying = Boolean(player && !player.paused && !player.ended && player.src);
        var ramPlaying = Boolean(
            window.isStudioPlaying ||
            window.studioSourceNode ||
            (window._activeBufferSourcesV71 && window._activeBufferSourcesV71.size > 0)
        );
        return Boolean((htmlPlaying || ramPlaying) && !window._userPausedV75_2);
    };

    // -------------------------------------------------------------------------
    // 3. НАДЁЖНЫЙ ПЕРЕКЛЮЧАТЕЛЬ PLAY / PAUSE ДЕКИ А (window.togglePlayV75_2)
    //    И ЗАЩИТА ОТ ДВОЙНОГО СРАБАТЫВАНИЯ ИЛИ ПОТЕРИ КЛИКА НА #playPauseBtn И В СПИСКЕ ТРЕКОВ
    // -------------------------------------------------------------------------
    window._lastTogglePlayWallTsV232 = 0;

    window.togglePlayV75_2 = function(ev) {
        var isSyntheticClickAfterPointer = Boolean(
            ev && ev.type === 'click' &&
            (performance.now() - (window._lastPointerUpPlayPauseTsV256 || 0) < 480)
        );
        if (isSyntheticClickAfterPointer) {
            return;
        }
        var nowMs = performance.now();
        if (nowMs - (window._lastTogglePlayWallTsV232 || 0) < 75) {
            return;
        }
        window._lastTogglePlayWallTsV232 = nowMs;

        var player = document.getElementById('audioPlayer');
        if (!player) return;

        if (!player.src && !window.currentPlayingTrack) {
            var firstTrack = window.topTrack || (window.currentTrackList && window.currentTrackList[0]);
            if (firstTrack && typeof window.playTrack === 'function') {
                window.playTrack(firstTrack, 'main');
            }
            return;
        }

        var isPlayingNow = window.isDeckAActuallyPlayingV232();

        if (isPlayingNow) {
            // СТОП / ПАУЗА: гарантированно глушим и HTML5 <audio>, и все RAM-буферы, сохраняя текущую секунду и декодированный буфер!
            window.forceStopPauseDeckAAudioV232(false);
            return;
        }

        // ЗАПУСК / ПРОДОЛЖЕНИЕ ВОСПРОИЗВЕДЕНИЯ:
        // Сначала гасим радио и внешние предпрослушки, чтобы они не играли одновременно с Декой А
        if (typeof window.stopAllExternalStreamsV97 === 'function') {
            try { window.stopAllExternalStreamsV97(); } catch (e) {}
        }

        var savedResumeSec = (typeof window.getTruePlaybackTimeV74_2 === 'function')
            ? window.getTruePlaybackTimeV74_2()
            : ((player && isFinite(player.currentTime)) ? player.currentTime : 0);

        window._userPausedV75_2 = false;
        window._resumingFromUserPlayV232 = true;
        window._loadingStudioBufV61 = false;

        // Восстанавливаем буфер из кэша истории, если он был сброшен при прерывании начальной загрузки
        if (!window.studioBuffer && window.currentPlayingTrack) {
            if (Array.isArray(window._ramTrackHistoryV71)) {
                var cachedRam = window._ramTrackHistoryV71.find(function(x) { return x && x.name === window.currentPlayingTrack && x.buf; });
                if (cachedRam && cachedRam.buf) {
                    window.studioBuffer = cachedRam.buf;
                }
            }
            if (!window.studioBuffer && window._hugeRamCacheV71 && window._hugeRamCacheV71.name === window.currentPlayingTrack && window._hugeRamCacheV71.buf) {
                window.studioBuffer = window._hugeRamCacheV71.buf;
            }
        }

        if (typeof window.initAudioBoost === 'function') window.initAudioBoost();
        if (window.audioCtx && window.audioCtx.state === 'suspended') {
            try { window.audioCtx.resume(); } catch (e) {}
        }
        if (window.audioCtx && window.inputMixer && window.inputMixer.gain) {
            try {
                var now = window.audioCtx.currentTime;
                window.inputMixer.gain.cancelScheduledValues(now);
                window.inputMixer.gain.setValueAtTime(1.0, now);
                window.inputMixer.gain.value = 1.0;
            } catch (e) {}
        }

        // Если трек был выгружен из player.src (или это .xflac, который был остановлен до окончания первичной загрузки), перезапускаем через playTrack
        if ((!player.src || (!window.studioBuffer && /\.xflac$/i.test(window.currentPlayingTrack || ''))) && window.currentPlayingTrack && typeof window.playTrack === 'function') {
            window._resumingFromUserPlayV232 = false;
            window.playTrack(window.currentPlayingTrack, window.currentListContext || 'main');
            return;
        }

        // Если RAM-буфер ещё не готов, обязательно открываем htmlGain, чтобы HTML5 <audio> заиграл мгновенно без тишины
        if (!window.studioBuffer && window.htmlGain && window.htmlGain.gain) {
            window.htmlGain.gain.value = 1.0;
        }

        if (savedResumeSec > 0.05 && player) {
            window._internalSeekSyncGuardV370 = true;
            try {
                if (Math.abs((player.currentTime || 0) - savedResumeSec) > 0.2) {
                    player.currentTime = savedResumeSec;
                }
            } catch (e) {}
            setTimeout(function() { window._internalSeekSyncGuardV370 = false; }, 60);
        }

        var activeSpd = (typeof window.getActiveTargetSpeedV59 === 'function') ? window.getActiveTargetSpeedV59() : 1.0;
        window._studioClockV74_1 = {
            active: true,
            startCtxTime: window.audioCtx ? window.audioCtx.currentTime : 0,
            startTrackSec: Math.max(0, savedResumeSec),
            lastKnownSec: Math.max(0, savedResumeSec),
            trackName: window.currentPlayingTrack || '',
            speed: activeSpd
        };

        var btn = document.getElementById('playPauseBtn');
        if (btn) {
            btn.innerHTML = PAUSE_ICON_SVG_V232;
        }

        var finishResume = function() {
            window._resumingFromUserPlayV232 = false;
            if (window._userPausedV75_2) return;
            if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            }
            if (!window.studioBuffer && window.currentPlayingTrack && typeof window.ensureStudioBufferLoadedV61 === 'function') {
                window.ensureStudioBufferLoadedV61();
            }
            if (typeof window.updateTrackListPlayIcons === 'function') {
                window.updateTrackListPlayIcons();
            }
        };

        // Если в RAM уже лежит готовый буфер, запускаем WebAudio мгновенно (0 мс), не дожидаясь промиса player.play()!
        if (window.studioBuffer && typeof window.syncMasterPlaybackEngineV59 === 'function') {
            window.syncMasterPlaybackEngineV59(false);
        }

        try {
            var p = player.play();
            if (p && typeof p.then === 'function') {
                p.then(finishResume).catch(finishResume);
            } else {
                finishResume();
            }
        } catch (e) {
            finishResume();
        }
    };

    window.togglePlay = window.togglePlayV75_2;
    window.togglePlayPause = window.togglePlayV75_2;

    // Исправляем handleTrackPlayBtn: клик по кнопке паузы/воспроизведения активного аудиотрека ВСЕГДА ставит его на паузу!
    window.handleTrackPlayBtn = function(filename, listContext, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (!filename) return;

        if (window.isVideoFileNameV130 && window.isVideoFileNameV130(filename)) {
            if (typeof window.captureActiveVideoQueueFromUIContextV229 === 'function') {
                window.captureActiveVideoQueueFromUIContextV229(filename, listContext);
            }
            var meta = (window._dedicatedVideoMetaMapV137 && window._dedicatedVideoMetaMapV137[filename])
                || (window.collectClientTorrentVideosV137 ? window.collectClientTorrentVideosV137().find(function(x) { return x.name === filename; }) : null)
                || {};
            var url = meta.stream_url || ('/api/media/' + encodeURIComponent(filename));
            window.openJennyVideoPlayerV130(url, filename, {
                torHash: meta.tor_hash || '',
                torFileIdx: meta.tor_file_idx !== undefined ? Number(meta.tor_file_idx) : -1
            });
            return;
        }

        // Если нажали на уже выбранный/играющий аудиотрек — переключаем Play/Pause (не перезапуская трек с нуля!)
        if (window.currentPlayingTrack && (window.currentPlayingTrack === filename || String(window.currentPlayingTrack).trim() === String(filename).trim())) {
            window.togglePlayV75_2(ev);
            return;
        }

        if (typeof window.lockCurrentViewAsPlayingQueueV73_1 === 'function') {
            window.lockCurrentViewAsPlayingQueueV73_1(filename);
        }
        window.playTrack(filename, listContext || 'queue');
    };

    // [V356] Точный обработчик тапа по #playPauseBtn: срабатывает ТОЛЬКО если нажатие началось и закончилось на самой кнопке #playPauseBtn!
    ;(function bindCleanPlayPauseTapV356() {
        var ppDownActive = false;
        var ppDownX = 0;
        var ppDownY = 0;

        document.addEventListener('pointerdown', function(e) {
            var byTarget = Boolean(e && e.target && e.target.closest && e.target.closest('#playPauseBtn'));
            if (!byTarget) {
                ppDownActive = false;
                return;
            }
            ppDownActive = true;
            ppDownX = Number(e.clientX || 0);
            ppDownY = Number(e.clientY || 0);
        }, true);

        document.addEventListener('pointercancel', function() {
            ppDownActive = false;
        }, true);

        document.addEventListener('pointerup', function(e) {
            if (!ppDownActive) return;
            ppDownActive = false;
            if (Date.now() < (window._suppressPlayPauseUntilV235 || 0)) return;
            var btn = document.getElementById('playPauseBtn');
            if (!btn) return;
            var dx = Math.abs(Number(e.clientX || 0) - ppDownX);
            var dy = Math.abs(Number(e.clientY || 0) - ppDownY);
            if (dx > 24 || dy > 24) return;
            var byTarget = Boolean(e.target && e.target.closest && e.target.closest('#playPauseBtn'));
            var rect = btn.getBoundingClientRect();
            var inside = (rect.width > 0 && e.clientX >= rect.left - 4 && e.clientX <= rect.right + 4 && e.clientY >= rect.top - 4 && e.clientY <= rect.bottom + 4);
            if (byTarget || inside) {
                window._lastPointerUpPlayPauseTsV256 = performance.now();
                window.togglePlayV75_2(e);
            }
        }, true);
    })();

    // Также защищаем playTrack: перед запуском убеждаемся, что внешние потоки остановлены и inputMixer открыт,
    // а после 1.8с ожидания проверяем, не нажал ли пользователь паузу за это время!
    var _basePlayTrackV232 = window.playTrack;
    window.playTrack = async function(filename, listContext) {
        if (!filename) return;
        if (!(window.isVideoFileNameV130 && window.isVideoFileNameV130(filename))) {
            if (typeof window.stopAllExternalStreamsV97 === 'function') {
                try { window.stopAllExternalStreamsV97(); } catch (e) {}
            }
            window._userPausedV75_2 = false;
            window._resumingFromUserPlayV232 = true;
            if (window.audioCtx && window.inputMixer && window.inputMixer.gain) {
                try {
                    var now = window.audioCtx.currentTime;
                    window.inputMixer.gain.cancelScheduledValues(now);
                    window.inputMixer.gain.setValueAtTime(1.0, now);
                    window.inputMixer.gain.value = 1.0;
                } catch (e) {}
            }
        }
        try {
            return await _basePlayTrackV232.apply(this, arguments);
        } finally {
            window._resumingFromUserPlayV232 = false;
            if (window._userPausedV75_2) {
                window.forceStopPauseDeckAAudioV232(false);
            }
        }
    };
})();

/* [split] V235: кусок исходного IIFE (ui_v71.js, строки 29842–30652) → ui_transport.js */
;(function() {
    if (window._jennyV235Installed__transport) return;
    window._jennyV235Installed__transport = true;
    window._jennyV235Installed = true;

    // -------------------------------------------------------------------------
    // 5. LONG-PRESS (HOLD) ON MAIN PLAY/PAUSE BUTTONS (#playPauseBtn & #playPauseBtnDeckBV216):
    //    OPENS THE PLAYING AUDIO/VIDEO PLAYLIST AND HIGHLIGHTS THE PLAYING TRACK/VIDEO WITHOUT PAUSING IT!
    // -------------------------------------------------------------------------
    window._suppressPlayPauseUntilV235 = 0;

    // Guard both Audio Play/Pause and Video Play/Pause against firing when hold-to-locate just triggered
    var _origTogglePlayV75_2_V235 = window.togglePlayV75_2;
    if (typeof _origTogglePlayV75_2_V235 === 'function') {
        window.togglePlayV75_2 = function(ev) {
            if (Date.now() < (window._suppressPlayPauseUntilV235 || 0)) {
                if (ev && ev.stopPropagation) ev.stopPropagation();
                if (ev && ev.preventDefault) ev.preventDefault();
                return;
            }
            return _origTogglePlayV75_2_V235.apply(this, arguments);
        };
        window.togglePlay = window.togglePlayV75_2;
        window.togglePlayPause = window.togglePlayV75_2;
    }

    // Global capture hold detector for #playPauseBtn (Deck A) and #playPauseBtnDeckBV216 (Deck B)
    ;(function installPlayPauseHoldDetectorV235() {
        var holdTimer = null;
        var holdDeck = null;
        var startX = 0;
        var startY = 0;
        var holdTriggered = false;

        var clearHold = function() {
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
        };

        document.addEventListener('pointerdown', function(e) {
            if (!e || !e.target || !e.target.closest) return;
            var btnA = e.target.closest('#playPauseBtn');
            var btnB = e.target.closest('#playPauseBtnDeckBV216');
            if (!btnA && !btnB) return;

            clearHold();
            holdDeck = btnB ? 'video' : 'audio';
            startX = Number(e.clientX || 0);
            startY = Number(e.clientY || 0);
            holdTriggered = false;

            holdTimer = setTimeout(function() {
                holdTimer = null;
                holdTriggered = true;
                window._suppressPlayPauseUntilV235 = Date.now() + 1400;
                try { navigator.vibrate(35); } catch (err) {}
                window.openAndHighlightPlayingPlaylistV235(holdDeck, e);
            }, 480);
        }, true);

        document.addEventListener('pointermove', function(e) {
            if (!holdTimer) return;
            var dx = Math.abs(Number(e.clientX || 0) - startX);
            var dy = Math.abs(Number(e.clientY || 0) - startY);
            if (dx > 18 || dy > 18) {
                clearHold();
            }
        }, true);

        var onEndOrCancel = function(e) {
            clearHold();
            if (holdTriggered) {
                holdTriggered = false;
                window._suppressPlayPauseUntilV235 = Date.now() + 900;
                if (e && e.stopPropagation) e.stopPropagation();
                if (e && e.preventDefault) e.preventDefault();
            }
        };

        document.addEventListener('pointerup', onEndOrCancel, true);
        document.addEventListener('pointercancel', onEndOrCancel, true);
        document.addEventListener('touchend', onEndOrCancel, true);
        document.addEventListener('touchcancel', onEndOrCancel, true);
        document.addEventListener('contextmenu', function(e) {
            if (e && e.target && e.target.closest && (e.target.closest('#playPauseBtn') || e.target.closest('#playPauseBtnDeckBV216'))) {
                e.preventDefault();
            }
        }, true);
    })();
})();

/* [split] V237: кусок исходного IIFE (ui_v71.js, строки 31602–32550) → ui_transport.js */
;(function() {
    if (window._jennyV237Installed__transport) return;
    window._jennyV237Installed__transport = true;
    window._jennyV237Installed = true;

    // Bind native <audio id="audioPlayer"> pause event so when Android pauses <audio> due to external audio,
    // Deck A immediately calls onExternalAudioInterruptV237() and switches the button from ⏸ to ▶!
    var bindExternalAudioPauseSyncV237 = function() {
        var player = document.getElementById('audioPlayer');
        if (player && !player._v237ExtPauseBound) {
            player._v237ExtPauseBound = true;
            player.addEventListener('pause', function() {
                if (player.ended || player.seeking || window._resumingFromUserPlayV232 || window._internalPauseGuardV239) return;
                var sinceSwitch = performance.now() - (window._lastInternalMediaSrcSwitchTsV239 || 0);
                if (sinceSwitch < 600) return;
                if (!window._userPausedV75_2 && !window.isStudioPlaying && player.currentTime > 0.15) {
                    window.onExternalAudioInterruptV237();
                } else {
                    if (typeof window.updateTrackListPlayIcons === 'function') {
                        window.updateTrackListPlayIcons();
                    }
                }
            });
        }
    };
    bindExternalAudioPauseSyncV237();
    setTimeout(bindExternalAudioPauseSyncV237, 400);

    // Upgrade playTrack so .xflac and standard tracks use a single non-blocking stream/decode pipeline
    // and never get stuck on "0:00 | ⏳ RAM (пока играет сжатый...)" even during 355-track torrent downloads!
    window.playTrack = async function(filename, listContext) {
        if (!filename) return;
        listContext = listContext || 'main';

        if (window.isVideoFileNameV130 && window.isVideoFileNameV130(filename)) {
            if (typeof window.captureActiveVideoQueueFromUIContextV229 === 'function') {
                window.captureActiveVideoQueueFromUIContextV229(filename, listContext);
            }
            window.openJennyVideoPlayerV130('/api/media/' + encodeURIComponent(filename), filename, {});
            return;
        }

        if (typeof window.stopAllExternalStreamsV97 === 'function') {
            try { window.stopAllExternalStreamsV97(); } catch (e) {}
        }

        var mySeq = ++window._audioTrackLoadSeqV216;
        window.abortPendingAudioRamLoadsV216();
        window._trackActivelyLoadingToRamV237 = true;

        window._jennyDualDeckV211 = window._jennyDualDeckV211 || { deckA: true, deckB: false, uiFocus: 'music' };
        window._jennyDualDeckV211.deckA = true;
        if (typeof window.saveDualDeckStateV211 === 'function') window.saveDualDeckStateV211();
        if (typeof window.syncDualDeckVisibilityAndAudioV211 === 'function') window.syncDualDeckVisibilityAndAudioV211();
        if (typeof window.renderDeckSwitchBannersV131 === 'function') window.renderDeckSwitchBannersV131();

        if (typeof window.ensurePlaylistStateV71 === 'function') window.ensurePlaylistStateV71();
        if (window.appConfig && window.appConfig.trackPlayStatsV71) {
            var stStat = window.appConfig.trackPlayStatsV71[filename] || { count: 0, last: 0 };
            stStat.count = (stStat.count || 0) + 1;
            stStat.last = Date.now();
            window.appConfig.trackPlayStatsV71[filename] = stStat;
            try { localStorage.setItem('ytm_config', JSON.stringify(window.appConfig)); } catch (e) {}
        }

        if (window.dnaDirect1xActiveV76 && filename !== window.currentPlayingTrack && typeof window.resetDnaModeOnTrackChangeV83 === 'function') {
            window.resetDnaModeOnTrackChangeV83();
        }

        if (listContext !== 'queue' && (!window.playingQueueListV73 || !window.playingQueueListV73.includes(filename))) {
            if (typeof window.lockCurrentViewAsPlayingQueueV73_1 === 'function') {
                window.lockCurrentViewAsPlayingQueueV73_1(filename);
            }
        }
        var savedQueue = (window.playingQueueListV73 && window.playingQueueListV73.length > 0)
            ? window.playingQueueListV73.slice()
            : null;

        window.studioBuffer = null;
        window.reversedStudioBuffer = null;
        window.reconstructedMasterBufferV67 = null;
        window.reconstructedReversedBufferV67 = null;
        window.currentTrackRevMapV67 = null;

        if (typeof window.initAudioBoost === 'function') window.initAudioBoost();
        if (window.audioCtx && window.audioCtx.state === 'suspended') {
            try { window.audioCtx.resume(); } catch (e) {}
        }
        if (window.audioCtx && window.inputMixer && window.inputMixer.gain) {
            try {
                var nowCtx = window.audioCtx.currentTime;
                window.inputMixer.gain.cancelScheduledValues(nowCtx);
                window.inputMixer.gain.setValueAtTime(1.0, nowCtx);
                window.inputMixer.gain.value = 1.0;
            } catch (e) {}
        }
        if (typeof window.applyEQSettings === 'function') window.applyEQSettings();
        if (typeof window.changeVolume === 'function') window.changeVolume();

        var targetSpeed = typeof window.getTargetPlaybackSpeed === 'function' ? window.getTargetPlaybackSpeed() : 1.0;
        var keepLocked = Boolean((window.scrubState && window.scrubState.locked) || (window.persistedPlaybackSpeed && window.persistedPlaybackSpeed !== 1.0));
        var activeSide = (window.scrubState && window.scrubState.side) || window.persistedPlaybackSide || 'right';

        window.currentPlayingTrack = filename;
        window.currentListContext = listContext;
        if (savedQueue) {
            window.playingQueueListV73 = savedQueue;
            window.currentTrackList = savedQueue;
        }

        var player = document.getElementById('audioPlayer');
        var titleEl = document.getElementById('nowPlaying');

        if (window.studioSourceNode) {
            window.studioSourceNode.onended = null;
            try { window.studioSourceNode.stop(0); } catch (e) {}
            try { window.studioSourceNode.disconnect(); } catch (e) {}
            window.studioSourceNode = null;
        }
        if (window._activeBufferSourcesV71 && typeof window._activeBufferSourcesV71.forEach === 'function') {
            window._activeBufferSourcesV71.forEach(function(n) {
                try { n.onended = null; n.stop(0); n.disconnect(); } catch (e) {}
            });
            window._activeBufferSourcesV71.clear();
        }
        window.isStudioPlaying = false;
        window.studioBuffer = null;
        window.reversedStudioBuffer = null;
        window.reconstructedMasterBufferV67 = null;
        window.reconstructedReversedBufferV67 = null;
        window.currentTrackRevMapV67 = null;
        window._userPausedV75_2 = false;
        window._resumingFromUserPlayV232 = true;

        if (keepLocked && window.scrubState) {
            window.scrubState.locked = true;
            window.scrubState.active = false;
            window.scrubState.speed = targetSpeed;
            window.scrubState.side = activeSide;
            window.scrubState.isPhysicallyReversed = (activeSide === 'left');
            var lockEl = document.getElementById('speedLockIndicator');
            if (lockEl) {
                lockEl.style.display = 'block';
                lockEl.innerText = '🔒 ' + (activeSide === 'left' ? '⏪' : '⏩') + ' x' + targetSpeed;
            }
        } else if (window.scrubState && window.scrubState.active) {
            if (typeof window.stopScrub === 'function') window.stopScrub(false);
        }

        var knownMeta = (window.lastData && window.lastData.track_meta && window.lastData.track_meta[filename]) || {};
        var initDur = Number(knownMeta.dur || 0);
        var isRevMode = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
        if (typeof window.updateProgressUI === 'function') window.updateProgressUI(0, initDur, isRevMode);
        if (typeof window.updateCenterCurrentTime === 'function') window.updateCenterCurrentTime(0, initDur, isRevMode);

        window._ramTrackHistoryV71 = window._ramTrackHistoryV71 || [];
        var cachedEntry = window._ramTrackHistoryV71.find(function(x) { return x.name === filename && x.buf; });
        var isXflac = /\.xflac$/i.test(filename);
        var mediaUrl = (cachedEntry && cachedEntry.blobUrl) ? cachedEntry.blobUrl : ('/api/media/' + encodeURIComponent(filename));

        if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;

        // Запускаем <audio> сразу в рамках пользовательского жеста (и для обычных файлов, и для .xflac —
        // на сервере работает пофайловый кэш _ensure_xflac_wav_cache_v87, поэтому второй запрос мгновенно берёт готовый WAV!)
        if (player) {
            player.loop = false;
            player.src = mediaUrl;
            player.currentTime = 0;
            try { player.playbackRate = Math.max(0.1, Math.min(16.0, targetSpeed)); } catch (e) {}
            player.preservesPitch = true;
            var playProm = player.play();
            if (playProm && typeof playProm.catch === 'function') {
                playProm.catch(function() {});
            }
        }

        var startPlayWallMs = performance.now();
        var useStudioRam = Boolean(!window.appConfig || window.appConfig.studioMode !== false);
        if (titleEl) {
            titleEl.innerText = (useStudioRam ? '⏳ RAM (пока играет сжатый...): ' : '🎵 ') + filename;
        }
        if (typeof window.updateTrackListPlayIcons === 'function') window.updateTrackListPlayIcons();

        if (!useStudioRam) {
            window._resumingFromUserPlayV232 = false;
            window._trackActivelyLoadingToRamV237 = false;
            return;
        }

        var abortCtrl = new AbortController();
        window._audioRamAbortCtrlV216 = abortCtrl;

        // Цельный потоковый декодер готового WAV из .xflac в единый AudioBuffer (0% кусков FFmpeg, без лимита decodeAudioData!)
        async function decodeWholeXflacWavResponseV262(resp, ctx) {
            if (resp.body && typeof resp.body.getReader === 'function') {
                var reader = resp.body.getReader();
                var headerBuf = new Uint8Array(0);
                while (headerBuf.length < 128) {
                    var step = await reader.read();
                    if (step.done) break;
                    if (step.value && step.value.length > 0) {
                        var merged = new Uint8Array(headerBuf.length + step.value.length);
                        merged.set(headerBuf, 0);
                        merged.set(step.value, headerBuf.length);
                        headerBuf = merged;
                    }
                }
                if (headerBuf.length >= 44 && headerBuf[0] === 0x52 && headerBuf[1] === 0x49 && headerBuf[2] === 0x46 && headerBuf[3] === 0x46) {
                    var dv = new DataView(headerBuf.buffer, headerBuf.byteOffset, headerBuf.byteLength);
                    var pos = 12, fmtTag = 1, numCh = 2, sRate = 44100, bits = 16, dataOff = 44, dataBytes = 0;
                    while (pos + 8 <= headerBuf.length) {
                        var id0 = headerBuf[pos], id1 = headerBuf[pos + 1], id2 = headerBuf[pos + 2], id3 = headerBuf[pos + 3];
                        var cSize = dv.getUint32(pos + 4, true);
                        if (id0 === 0x66 && id1 === 0x6d && id2 === 0x74 && id3 === 0x20 && pos + 24 <= headerBuf.length) {
                            fmtTag = dv.getUint16(pos + 8, true);
                            numCh = Math.max(1, Math.min(2, dv.getUint16(pos + 10, true)));
                            sRate = dv.getUint32(pos + 12, true) || 44100;
                            bits = dv.getUint16(pos + 22, true) || 16;
                        } else if (id0 === 0x64 && id1 === 0x61 && id2 === 0x74 && id3 === 0x61) {
                            dataOff = pos + 8;
                            dataBytes = cSize;
                            break;
                        }
                        pos += 8 + cSize + (cSize & 1);
                    }
                    if (bits === 16 && dataOff <= headerBuf.length) {
                        var clHdr = Number(resp.headers.get('Content-Length') || 0);
                        var totalPcmBytes = (clHdr > dataOff) ? (clHdr - dataOff) : dataBytes;
                        var bytesPerFrame = numCh * 2;
                        var totalFrames = Math.floor(totalPcmBytes / bytesPerFrame);
                        if (totalFrames > 0) {
                            var stride = 1;
                            var outFrames = totalFrames;
                            var outRate = sRate;
                            var audioBuf = null;
                            try {
                                audioBuf = ctx.createBuffer(numCh, outFrames, outRate);
                            } catch (eAlloc1) {
                                stride = 2;
                                outFrames = Math.floor(totalFrames / 2);
                                outRate = Math.max(8000, Math.floor(sRate / 2));
                                audioBuf = ctx.createBuffer(numCh, outFrames, outRate);
                            }
                            var chL = audioBuf.getChannelData(0);
                            var chR = numCh > 1 ? audioBuf.getChannelData(1) : chL;
                            var inv16 = 1.0 / 32768.0;
                            var frameIdx = 0;
                            var outIdx = 0;
                            var leftover = headerBuf.subarray(dataOff);

                            var processPcmChunk = function(chunkBytes) {
                                var usableLen = chunkBytes.length - (chunkBytes.length % bytesPerFrame);
                                if (usableLen <= 0) return chunkBytes;
                                var i16 = new Int16Array(chunkBytes.buffer, chunkBytes.byteOffset, usableLen >> 1);
                                var nSamples = i16.length;
                                if (numCh === 2) {
                                    for (var s = 0; s < nSamples; s += 2) {
                                        if (stride === 1 || (frameIdx & 1) === 0) {
                                            if (outIdx < outFrames) {
                                                chL[outIdx] = i16[s] * inv16;
                                                chR[outIdx] = i16[s + 1] * inv16;
                                                outIdx++;
                                            }
                                        }
                                        frameIdx++;
                                    }
                                } else {
                                    for (var s1 = 0; s1 < nSamples; s1++) {
                                        if (stride === 1 || (frameIdx & 1) === 0) {
                                            if (outIdx < outFrames) {
                                                chL[outIdx++] = i16[s1] * inv16;
                                            }
                                        }
                                        frameIdx++;
                                    }
                                }
                                return chunkBytes.subarray(usableLen);
                            };

                            leftover = processPcmChunk(leftover);
                            while (true) {
                                var rd = await reader.read();
                                if (rd.done) break;
                                if (rd.value && rd.value.length > 0) {
                                    if (leftover.length > 0) {
                                        var comb = new Uint8Array(leftover.length + rd.value.length);
                                        comb.set(leftover, 0);
                                        comb.set(rd.value, leftover.length);
                                        leftover = processPcmChunk(comb);
                                    } else {
                                        leftover = processPcmChunk(rd.value);
                                    }
                                }
                            }
                            return audioBuf;
                        }
                    }
                }
            }
            var ab = await resp.arrayBuffer();
            return await ctx.decodeAudioData(ab);
        }

        try {
            var decodedBuffer = null;
            if (cachedEntry && cachedEntry.buf) {
                decodedBuffer = cachedEntry.buf;
            } else {
                var metaCheck = { duration: initDur, size: Number(knownMeta.size || 0) };
                // Для обычных файлов без известного размера запрашиваем /api/pcm_meta_v71/;
                // для готовых локальных .xflac сразу грузим файл целиком без кусковой нарезки!
                if (!metaCheck.size && !isXflac) {
                    try {
                        var mr = await fetch('/api/pcm_meta_v71/' + encodeURIComponent(filename), { signal: abortCtrl.signal });
                        if (mr.ok) metaCheck = await mr.json();
                    } catch (e) {
                        if (abortCtrl.signal.aborted || mySeq !== window._audioTrackLoadSeqV216) return;
                    }
                }
                if (mySeq !== window._audioTrackLoadSeqV216 || window.currentPlayingTrack !== filename) return;

                if (isXflac) {
                    var xResp = await fetch('/api/media/' + encodeURIComponent(filename), { signal: abortCtrl.signal });
                    if (xResp.ok) {
                        decodedBuffer = await decodeWholeXflacWavResponseV262(xResp, window.audioCtx);
                        if (decodedBuffer && mySeq === window._audioTrackLoadSeqV216) {
                            window._ramTrackHistoryV71 = window._ramTrackHistoryV71.filter(function(x) { return x.name !== filename; }).slice(0, 1);
                            window._ramTrackHistoryV71.unshift({ name: filename, buf: decodedBuffer, blobUrl: null });
                        }
                    } else {
                        throw new Error('HTTP ' + xResp.status);
                    }
                } else if (!metaCheck.size || metaCheck.size <= 95 * 1024 * 1024) {
                    try {
                        var response = await fetch('/api/media/' + encodeURIComponent(filename), { signal: abortCtrl.signal });
                        if (response.ok) {
                            var arrayBuffer = await response.arrayBuffer();
                            if (mySeq !== window._audioTrackLoadSeqV216 || window.currentPlayingTrack !== filename) return;
                            var blobUrl = null;
                            try {
                                var mime = response.headers.get('Content-Type') || 'audio/mpeg';
                                blobUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: mime }));
                            } catch (e) {}

                            decodedBuffer = await window.audioCtx.decodeAudioData(arrayBuffer);
                            if (decodedBuffer) {
                                window._ramTrackHistoryV71 = window._ramTrackHistoryV71.filter(function(x) { return x.name !== filename; }).slice(0, 1);
                                window._ramTrackHistoryV71.unshift({ name: filename, buf: decodedBuffer, blobUrl: blobUrl });
                            }
                        } else {
                            throw new Error('HTTP ' + response.status);
                        }
                    } catch (decErr) {
                        if (abortCtrl.signal.aborted || mySeq !== window._audioTrackLoadSeqV216) return;
                        decodedBuffer = await window.decodeHugeTrackToRamV71(filename, titleEl, player, metaCheck);
                    }
                } else {
                    decodedBuffer = await window.decodeHugeTrackToRamV71(filename, titleEl, player, metaCheck);
                    if (decodedBuffer && mySeq === window._audioTrackLoadSeqV216) {
                        window._ramTrackHistoryV71 = window._ramTrackHistoryV71.filter(function(x) { return x.name !== filename; }).slice(0, 1);
                        window._ramTrackHistoryV71.unshift({ name: filename, buf: decodedBuffer, blobUrl: null });
                    }
                }
            }

            if (mySeq !== window._audioTrackLoadSeqV216 || window.currentPlayingTrack !== filename) return;

            if (!decodedBuffer) {
                if (titleEl) titleEl.innerText = '🎵 ' + filename;
                return;
            }

            var elapsedMs = performance.now() - startPlayWallMs;
            if (elapsedMs < 1100 && !isRevMode && !isXflac) {
                await new Promise(function(r) { setTimeout(r, 1100 - elapsedMs); });
            }
            if (mySeq !== window._audioTrackLoadSeqV216 || window.currentPlayingTrack !== filename) return;

            window.studioBuffer = decodedBuffer;
            if (window.appConfig && window.appConfig.opt_autoRms && typeof window.computeBufferAutoGain === 'function') {
                window.computeBufferAutoGain(decodedBuffer, window.appConfig.val_autoRms);
            }
            if (typeof window.buildAudioGraph === 'function') {
                window.buildAudioGraph(true);
            }
            if (typeof window.loadTrackReversibleDataV67 === 'function') {
                window.loadTrackReversibleDataV67(filename, decodedBuffer);
            }

            var isHugeTrack = (decodedBuffer.duration > 900);
            if (!isHugeTrack && !window.reversedStudioBuffer && typeof window.cloneAndReverseBuffer === 'function') {
                window.reversedStudioBuffer = await window.cloneAndReverseBuffer(decodedBuffer);
            }
            if (mySeq !== window._audioTrackLoadSeqV216 || window.currentPlayingTrack !== filename) return;

            if (!window._userPausedV75_2 && typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            }
            if (titleEl) {
                var hasRev = Boolean(window.reversedStudioBuffer);
                titleEl.innerText = 'RAM 🚀: ' + filename;
            }
            if (typeof window.updateTrackListPlayIcons === 'function') window.updateTrackListPlayIcons();
        } catch (err) {
            if (mySeq === window._audioTrackLoadSeqV216 && window.currentPlayingTrack === filename && titleEl) {
                if (player && !player.paused) titleEl.innerText = '🎵 ' + filename;
                else titleEl.innerText = '🎵 ⏸ ' + filename;
            }
        } finally {
            if (mySeq === window._audioTrackLoadSeqV216) {
                window._resumingFromUserPlayV232 = false;
                window._trackActivelyLoadingToRamV237 = false;
                if (window._userPausedV75_2) {
                    window.forceStopPauseDeckAAudioV232(false);
                }
            }
        }
    };
})();

/* [split] V243: кусок исходного IIFE (ui_v71.js, строки 35225–35944) → ui_transport.js */
;(function() {
    if (window._jennyV243Installed__transport) return;
    window._jennyV243Installed__transport = true;
    window._jennyV243Installed = true;

    var _origPlayTrackV243 = window.playTrack;
    if (typeof _origPlayTrackV243 === 'function' && !_origPlayTrackV243._v243Wrapped) {
        window.playTrack = function(filename, ctxArg) {
            if (filename && !(window.isVideoFileNameV130 && window.isVideoFileNameV130(filename))) {
                var isYtTrk = Boolean(ctxArg === 'youtube' || (window.isYtTaggedNameV262 ? window.isYtTaggedNameV262(filename) : String(filename).indexOf('[YT') === 0));
                window._isYoutubeDeckAActiveV253 = isYtTrk;
                window._lastActiveMediaSourceV243 = isYtTrk ? 'youtube' : 'deckA';
                window._islandActiveModeV245 = isYtTrk ? 'youtube' : 'music';
                window._islandExplicitModeTsV245 = Date.now();
            }
            return _origPlayTrackV243.apply(this, arguments);
        };
        window.playTrack._v243Wrapped = true;
    }

    // Перехват внешних вызовов togglePlay / nextTrack / prevTrack из шторки или гарнитуры, когда активен другой источник
    if (typeof window.togglePlay === 'function' && !window.togglePlay._v243Wrapped) {
        window._origTogglePlayV243 = window.togglePlay;
        window.togglePlay = function() {
            var touchAge = performance.now() - (window._lastPhysicalTouchInAppTsV243 || 0);
            if (touchAge > 650 && window._lastActiveMediaSourceV243 !== 'deckA' && window._lastActiveMediaSourceV243 !== 'youtube') {
                return window.handleNativeMediaControlV243('toggle');
            }
            var isCurYt = Boolean(window._isYoutubeDeckAActiveV253 || (window.isYtTaggedNameV262 ? window.isYtTaggedNameV262(window.currentPlayingTrack) : String(window.currentPlayingTrack || '').indexOf('[YT') === 0));
            window._lastActiveMediaSourceV243 = isCurYt ? 'youtube' : 'deckA';
            if (isCurYt) {
                window._islandActiveModeV245 = 'youtube';
                window._islandExplicitModeTsV245 = Date.now();
            }
            var r = window._origTogglePlayV243.apply(this, arguments);
            setTimeout(function() { window.syncPermanentForegroundNotificationV212(true); }, 80);
            return r;
        };
        window.togglePlay._v243Wrapped = true;
    }
    if (typeof window.nextTrack === 'function' && !window.nextTrack._v243Wrapped) {
        window._origNextTrackV243 = window.nextTrack;
        window.nextTrack = function() {
            var touchAge = performance.now() - (window._lastPhysicalTouchInAppTsV243 || 0);
            if (touchAge > 650 && window._lastActiveMediaSourceV243 !== 'deckA') {
                return window.handleNativeMediaControlV243('next');
            }
            return window._origNextTrackV243.apply(this, arguments);
        };
        window.nextTrack._v243Wrapped = true;
    }
})();
/* ================= END JENNY_V369_SIX_FIXES_RAM_TURBO_REVERSE_STALL_HEAL_AND_UNIFIED_TELEMETRY ================= */

/* ================= BEGIN JENNY_V370_DECK_A_FULL_TRACK_PLAYBACK_AND_PAUSE_IMMUNITY_PATCH ================= */
/* [split] V370: кусок исходного IIFE (ui_v71.js, строки 37843–38397) → ui_transport.js */
;(function() {
    if (window._jennyV370DeckAFullTrackPatchInstalled__transport) return;
    window._jennyV370DeckAFullTrackPatchInstalled__transport = true;
    window._jennyV370DeckAFullTrackPatchInstalled = true;

    var PLAY_ICON_SVG_V370 = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    var PAUSE_ICON_SVG_V370 = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
})();
