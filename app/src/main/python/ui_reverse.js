/* ============================================================================
 * ui_reverse.js — Реверс и RAM-движок аудио: горизонт, передачи, часы WebAudio, DNA, скраб, дуга скорости
 *
 * Склейка:  /bundle_2_player.js, модуль 6 из 18. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   engageDirectRamPitchShiftV70, extractWindowBufferV71, engageInstantHorizonJbufLockV71, syncMasterPlaybackEngineV59, ensureStudioBufferLoadedV61, engageHorizonRamEngineV71_5, toggleReverseMode, setExactPlaybackPositionV75, getTruePlaybackTimeV74_2, seekAudio … (всего функций: 33)
 * Откуда:   ui_v71.js (коммит 9ae6639), строки 733…38811 (32 фрагментов, вперемешку с другими темами). Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */



// === V71.2 SINGLE AUDIO GUARD & MULTI-FOLDER PERSISTENCE ===
window._activeBufferSourcesV71 = new Set();

;(function installSingleAudioSourceGuardV71() {
    const patchCtx = () => {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC || AC.prototype._jennyGuardedV71) return;
        AC.prototype._jennyGuardedV71 = true;
        const origCreate = AC.prototype.createBufferSource;
        AC.prototype.createBufferSource = function() {
            const ctxRef = this;
            const node = origCreate.apply(this, arguments);
            const origStart = node.start;
            const origStop = node.stop;
            node.stop = function() {
                node._isStoppedV265 = true;
                if (window.videoDeckV131 && ctxRef === window.videoDeckV131.ctx) {
                    if (window.videoDeckV131.activeSources) window.videoDeckV131.activeSources.delete(node);
                    if (window.videoDeckV131.studioSourceNode === node) {
                        window.videoDeckV131.studioSourceNode = null;
                        window.videoDeckV131.isStudioPlaying = false;
                    }
                } else {
                    if (window._activeBufferSourcesV71) window._activeBufferSourcesV71.delete(node);
                    if (window.studioSourceNode === node) {
                        window.studioSourceNode = null;
                        window.isStudioPlaying = false;
                    }
                }
                return origStop.apply(this, arguments);
            };
            node.start = function() {
                node._isStoppedV265 = false;
                if (window.videoDeckV131 && ctxRef === window.videoDeckV131.ctx) {
                    window.videoDeckV131.activeSources.forEach(oldNode => {
                        if (oldNode !== node) { oldNode.onended = null; try { oldNode.stop(); } catch (e) {} try { oldNode.disconnect(); } catch (e) {} }
                    });
                    window.videoDeckV131.activeSources.clear();
                    window.videoDeckV131.activeSources.add(node);
                    if (window.videoDeckV131.htmlGain && window.videoDeckV131.htmlGain.gain) window.videoDeckV131.htmlGain.gain.value = 0.0;
                    return origStart.apply(this, arguments);
                }
                window._activeBufferSourcesV71.forEach(oldNode => {
                    if (oldNode !== node) {
                        oldNode.onended = null;
                        try { oldNode.stop(); } catch (e) {}
                        try { oldNode.disconnect(); } catch (e) {}
                    }
                });
                window._activeBufferSourcesV71.clear();
                window._activeBufferSourcesV71.add(node);
                if (window.htmlGain && window.htmlGain.gain) {
                    window.htmlGain.gain.value = 0.0;
                }
                if (window.audioCtx && window.inputMixer && window.inputMixer.gain && !window._userPausedV75_2) {
                    try {
                        const nowM = window.audioCtx.currentTime;
                        window.inputMixer.gain.cancelScheduledValues(nowM);
                        window.inputMixer.gain.setValueAtTime(1.0, nowM);
                        window.inputMixer.gain.value = 1.0;
                    } catch (e) {}
                }
                return origStart.apply(this, arguments);
            };
            return node;
        };
    };
    patchCtx();
    setTimeout(patchCtx, 100);
})();

// Переопределяем engageDirectRamPitchShiftV70 для идеально чистой работы 2-й передачи и Винила
window.engageDirectRamPitchShiftV70 = function(gearKey, targetSpd) {
    const player = document.getElementById('audioPlayer');
    if (!player || !window.audioCtx) return false;

    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    const hasRev67 = Boolean(
        window.reconstructedMasterBufferV67 &&
        window.currentTrackRevMapV67 &&
        window.currentTrackRevNameV67 === window.currentPlayingTrack
    );

    let rawBuf = hasRev67
        ? (isRev ? (window.reconstructedReversedBufferV67 || window.reconstructedMasterBufferV67) : window.reconstructedMasterBufferV67)
        : (isRev ? (window.reversedStudioBuffer || window.studioBuffer) : window.studioBuffer);

    if (!rawBuf) {
        window._activeBufferSourcesV71.forEach(n => {
            n.onended = null;
            try { n.stop(); } catch (e) {}
            try { n.disconnect(); } catch (e) {}
        });
        window._activeBufferSourcesV71.clear();
        window.studioSourceNode = null;
        window.isStudioPlaying = false;
        if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
        player.preservesPitch = false;
        player.mozPreservesPitch = false;
        player.webkitPreservesPitch = false;
        if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
            try { player.playbackRate = targetSpd; } catch (e) {}
        }
        return false;
    }

    if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
    player.preservesPitch = false;
    if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
        try { player.playbackRate = targetSpd; } catch (e) {}
    }

    const isVinyl = (gearKey === 'vinyl-shift');
    const effSpd = hasRev67
        ? Math.max(0.1, Math.min(100.0, (parseFloat(window.currentTrackRevMapV67.spd) || 1.0) * targetSpd))
        : targetSpd;

    if (!player.paused) {
        const needNewNode = !window.studioSourceNode ||
                            !window.isStudioPlaying ||
                            window.studioSourceNode.buffer !== rawBuf ||
                            Boolean(window.studioSourceNode._isHoseSpliced);
        if (needNewNode) {
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null;
                try { window.studioSourceNode.stop(); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
            }
            window.studioSourceNode = window.audioCtx.createBufferSource();
            window.studioSourceNode._isHoseSpliced = false;
            window.studioSourceNode.buffer = rawBuf;
            window.studioSourceNode.playbackRate.value = effSpd;
            window.studioSourceNode.connect(window.inputMixer);

            let offset = player.currentTime || 0;
            if (!isFinite(offset) || offset < 0) offset = 0;
            if (offset >= rawBuf.duration) offset = Math.max(0, rawBuf.duration - 0.05);

            window.studioSourceNode.start(0, offset);
            window.isStudioPlaying = true;
        } else if (window.studioSourceNode && window.studioSourceNode.playbackRate) {
            const now = window.audioCtx.currentTime;
            if (isVinyl) {
                window.studioSourceNode.playbackRate.setTargetAtTime(effSpd, now, 0.085);
            } else {
                window.studioSourceNode.playbackRate.setValueAtTime(effSpd, now);
            }
        }
    } else {
        window._activeBufferSourcesV71.forEach(n => {
            n.onended = null;
            try { n.stop(); } catch (e) {}
            try { n.disconnect(); } catch (e) {}
        });
        window._activeBufferSourcesV71.clear();
        window.studioSourceNode = null;
        window.isStudioPlaying = false;
    }

    const badge = document.getElementById('hoseLiveTelemetryV44');
    if (badge) {
        badge.style.color = isVinyl ? '#d2a8ff' : '#3fb950';
        badge.innerText = isVinyl
            ? `💿 ВИНИЛ [RAM Platter]: x${effSpd.toFixed(2)} (Инерция 85мс)`
            : `⚡ J Buf RAM [PITCH SHIFT]: x${effSpd.toFixed(2)} (Прямой 32-bit буфер)`;
    }
    return true;
};


// === V71.4 INSTANT HORIZON SPLICER FOR LONG TRACKS (5ms ZERO-LAG JBUF) & MODAL HEADER CLEANUP ===

window._horizonSliceTimerV71 = null;

// Вырезает окно [startSec .. startSec + winSec] из гигантского буфера в маленький AudioBuffer (при необходимости разворачивая для реверса)
window.extractWindowBufferV71 = function(srcBuf, startSec, winSec, isRev) {
    if (!srcBuf || !window.audioCtx) return null;
    const player = document.getElementById('audioPlayer');
    const sr = srcBuf.sampleRate;
    const numCh = srcBuf.numberOfChannels;
    const totalLen = srcBuf.length;
    const dur = srcBuf.duration;

    if (!isRev) {
        let cleanStart = Math.max(0, Math.min(dur - 0.05, startSec));
        let startFrame = Math.min(totalLen - 256, Math.max(0, Math.floor(cleanStart * sr)));
        let frameCount = Math.max(256, Math.min(Math.floor(winSec * sr), totalLen - startFrame));
        let subBuf = window.audioCtx.createBuffer(numCh, frameCount, sr);
        for (let c = 0; c < numCh; c++) {
            subBuf.getChannelData(c).set(srcBuf.getChannelData(c).subarray(startFrame, startFrame + frameCount));
        }
        return subBuf;
    } else {
        // При реверсе player.currentTime = dur - realForwardSec, поэтому позиция в прямом буфере = dur - startSec
        const refDur = (player && isFinite(player.duration) && player.duration > 0) ? player.duration : dur;
        let forwardPosSec = Math.max(0.15, Math.min(dur, refDur - startSec));
        let revEndFrame = Math.min(totalLen, Math.max(256, Math.floor(forwardPosSec * sr)));
        let frameCount = Math.max(256, Math.min(Math.floor(winSec * sr), revEndFrame));
        let subBuf = window.audioCtx.createBuffer(numCh, frameCount, sr);
        for (let c = 0; c < numCh; c++) {
            const inp = srcBuf.getChannelData(c);
            const out = subBuf.getChannelData(c);
            for (let i = 0; i < frameCount; i++) {
                out[i] = inp[revEndFrame - 1 - i];
            }
        }
        return subBuf;
    }
};

// Мгновенный запуск 1-й передачи (J Buf 90° Pitch Lock) с горизонтом 45 сек для треков > 10 минут
window.engageInstantHorizonJbufLockV71 = function(isDraggingArc) {
    const player = document.getElementById('audioPlayer');
    const badge = document.getElementById('hoseLiveTelemetryV44');
    if (!player || !window.studioBuffer || !window.audioCtx) return false;

    // Если трек короткий (< 600 сек = 10 минут), используем обычный полный буфер
    if (window.studioBuffer.duration <= 600) {
        return false;
    }

    if (isDraggingArc) {
        if (window._hoseArcDebounceTimerV47) clearTimeout(window._hoseArcDebounceTimerV47);
        window._hoseArcDebounceTimerV47 = setTimeout(() => {
            window.syncMasterPlaybackEngineV59(false);
        }, 55);
        return true;
    }

    if (window._horizonSliceTimerV71) {
        clearTimeout(window._horizonSliceTimerV71);
        window._horizonSliceTimerV71 = null;
    }

    const targetSpd = (typeof window.getActiveTargetSpeedV59 === 'function')
        ? window.getActiveTargetSpeedV59()
        : (player.playbackRate || 1.0);
    const tensionPct = (window.appConfig && window.appConfig.hoseTensionPct !== undefined)
        ? window.appConfig.hoseTensionPct
        : 100;
    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

    const curSec = (typeof window.getTruePlaybackTimeV74_2 === 'function') ? window.getTruePlaybackTimeV74_2() : (player.currentTime || 0);
    const WIN_SEC = Math.max(45.0, Math.min(360.0, targetSpd * 3.5)); // Нарезаем 45 секунд вперёд — занимает всего ~5 мс!
    const rawWindowBuf = window.extractWindowBufferV71(window.studioBuffer, curSec, WIN_SEC, isRev);
    if (!rawWindowBuf) return false;

    const t0 = performance.now();
    const splicedWindowBuf = window.buildElasticHoseBufferV46(rawWindowBuf, targetSpd, tensionPct);
    const buildMs = Math.round(performance.now() - t0);

    if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
    player.preservesPitch = false;
    if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
        try { player.playbackRate = targetSpd; } catch (e) {}
    }

    if (!player.paused) {
        if (window.studioSourceNode) {
            window.studioSourceNode.onended = null;
            try { window.studioSourceNode.stop(); } catch (e) {}
            try { window.studioSourceNode.disconnect(); } catch (e) {}
        }
        window.studioSourceNode = window.audioCtx.createBufferSource();
        window.studioSourceNode._isHoseSpliced = true;
        window.studioSourceNode._isHorizonWindowV71 = true;
        window.studioSourceNode.buffer = splicedWindowBuf;
        window.studioSourceNode.playbackRate.value = 1.0;
        window.studioSourceNode.connect(window.inputMixer);
        window.studioSourceNode.start(0, 0);
        window.isStudioPlaying = true;

        // Планируем бесшовную подкачку следующего 45-секундного окна за 1.2 сек до конца текущего
        const realPlayDurationMs = Math.max(500, (splicedWindowBuf.duration - 1.2) * 1000);
        window._horizonSliceTimerV71 = setTimeout(() => {
            const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
            if (!player.paused && gKey === 'jbuf-lock' && window.studioBuffer && window.studioBuffer.duration > 600) {
                window.engageInstantHorizonJbufLockV71(false);
            }
        }, realPlayDurationMs);
    }

    if (badge) {
        const c = window._hoseSplicerCacheV46 || {};
        badge.style.color = '#3fb950';
        badge.innerText = `⚡ J Buf 90° [HORIZON 45s]: x${targetSpd.toFixed(2)} | Δy=${((c.avgSeamErrMv || 0) * 100).toFixed(1)}% (${buildMs}мс)`;
    }
    return true;
};

// Перехватываем syncMasterPlaybackEngineV59, чтобы на длинных треках (>10 мин) 1-я передача включалась за 5 мс через Horizon Splicer!
;(function wrapMasterSyncForHorizonV71() {
    const prevSync = window.syncMasterPlaybackEngineV59;
    window.syncMasterPlaybackEngineV59 = function(isDraggingArc) {
        if (window._horizonSliceTimerV71) {
            clearTimeout(window._horizonSliceTimerV71);
            window._horizonSliceTimerV71 = null;
        }
        const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
        if (gKey === 'jbuf-lock' && window.studioBuffer && window.studioBuffer.duration > 600) {
            if (window.engageInstantHorizonJbufLockV71(isDraggingArc)) {
                return;
            }
        }
        return prevSync.apply(this, arguments);
    };
})();

// Также ускоряем 2-ю передачу (J Buf Pitch Shift) и Заднюю R (Винил) на длинных треках при реверсе
const _origEngageShiftV71 = window.engageDirectRamPitchShiftV70;
window.engageDirectRamPitchShiftV70 = function(gearKey, targetSpd) {
    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    if (isRev && window.studioBuffer && window.studioBuffer.duration > 900 && !window.reversedStudioBuffer) {
        const player = document.getElementById('audioPlayer');
        if (player && window.audioCtx) {
            const curSec = (typeof window.getTruePlaybackTimeV74_2 === 'function') ? window.getTruePlaybackTimeV74_2() : (player.currentTime || 0);
            const winBuf = window.extractWindowBufferV71(window.studioBuffer, curSec, 60.0, true);
            if (winBuf) {
                if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
                player.preservesPitch = false;
                if (window.studioSourceNode) {
                    window.studioSourceNode.onended = null;
                    try { window.studioSourceNode.stop(); } catch (e) {}
                    try { window.studioSourceNode.disconnect(); } catch (e) {}
                }
                window.studioSourceNode = window.audioCtx.createBufferSource();
                window.studioSourceNode._isHoseSpliced = false;
                window.studioSourceNode.buffer = winBuf;
                window.studioSourceNode.playbackRate.value = targetSpd;
                window.studioSourceNode.connect(window.inputMixer);
                if (!player.paused) {
                    window.studioSourceNode.start(0, 0);
                    window.isStudioPlaying = true;
                }
                return true;
            }
        }
    }
    return _origEngageShiftV71.apply(this, arguments);
};


// === V71.5 PERFECT GEARBOX & HORIZON ENGINE (1st, 2nd, R, N & REVERSE ON 1-3H TRACKS) ===

// Отключаем старый дублирующий загрузчик V61, чтобы он не качал 200 МБ во второй поток
window.ensureStudioBufferLoadedV61 = function() {};

// Единый менеджер оконного горизонта (45 сек) и для 1-й передачи (J Buf 90°), и для 2-й (J Buf Pitch Shift), и для Задней R (Винил)
window.engageHorizonRamEngineV71_5 = function(gearKey, isDraggingArc) {
    const player = document.getElementById('audioPlayer');
    const badge = document.getElementById('hoseLiveTelemetryV44');
    if (!player || !window.audioCtx) return false;

    const targetSpd = (typeof window.getActiveTargetSpeedV59 === 'function')
        ? window.getActiveTargetSpeedV59()
        : (player.playbackRate || 1.0);
    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

    // Если буфер ещё совсем не создан (первые 0.3 сек старта), честно выставляем параметры на HTML5 плеере:
    if (!window.studioBuffer) {
        if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
        const wantPitchLock = (gearKey === 'jbuf-lock' || gearKey === 'web-lock' || gearKey === 'neutral');
        player.preservesPitch = wantPitchLock;
        player.mozPreservesPitch = wantPitchLock;
        player.webkitPreservesPitch = wantPitchLock;
        const spd = (gearKey === 'neutral') ? 1.0 : targetSpd;
        if (Math.abs(player.playbackRate - spd) > 0.003) {
            try { player.playbackRate = spd; } catch (e) {}
        }
        return true;
    }

    // Для коротких треков (<= 600 сек) используем это окно только если включён Реверс без reversedStudioBuffer
    if (window.studioBuffer.duration <= 600 && !(isRev && !window.reversedStudioBuffer)) {
        return false;
    }

    if (isDraggingArc) {
        if (window._hoseArcDebounceTimerV47) clearTimeout(window._hoseArcDebounceTimerV47);
        window._hoseArcDebounceTimerV47 = setTimeout(() => {
            window.syncMasterPlaybackEngineV59(false);
        }, 50);
        return true;
    }

    if (window._horizonSliceTimerV71) {
        clearTimeout(window._horizonSliceTimerV71);
        window._horizonSliceTimerV71 = null;
    }

    const curSec = (typeof window.getTruePlaybackTimeV74_2 === 'function') ? window.getTruePlaybackTimeV74_2() : (player.currentTime || 0);
    const WIN_SEC = Math.max(45.0, Math.min(360.0, targetSpd * 3.5));
    const rawWindowBuf = window.extractWindowBufferV71(window.studioBuffer, curSec, WIN_SEC, isRev);
    if (!rawWindowBuf) return false;

    if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
    player.preservesPitch = false;
    if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
        try { player.playbackRate = targetSpd; } catch (e) {}
    }

    let playBuf = rawWindowBuf;
    let nodeRate = 1.0;
    let buildMs = 0;

    if (gearKey === 'jbuf-lock') {
        const tensionPct = (window.appConfig && window.appConfig.hoseTensionPct !== undefined)
            ? window.appConfig.hoseTensionPct
            : 100;
        const t0 = performance.now();
        playBuf = window.buildElasticHoseBufferV46(rawWindowBuf, targetSpd, tensionPct);
        buildMs = Math.round(performance.now() - t0);
        nodeRate = 1.0;
    } else {
        // 2-я передача (J Buf RAM [PITCH SHIFT]) или Задняя R (ВИНИЛ [PITCH SHIFT])
        playBuf = rawWindowBuf;
        nodeRate = targetSpd;
    }

    if (!player.paused) {
        if (window.studioSourceNode) {
            window.studioSourceNode.onended = null;
            try { window.studioSourceNode.stop(); } catch (e) {}
            try { window.studioSourceNode.disconnect(); } catch (e) {}
        }
        window.studioSourceNode = window.audioCtx.createBufferSource();
        window.studioSourceNode._isHoseSpliced = (gearKey === 'jbuf-lock');
        window.studioSourceNode._isHorizonWindowV71 = true;
        window.studioSourceNode.buffer = playBuf;
        window.studioSourceNode.playbackRate.value = nodeRate;
        window.studioSourceNode.connect(window.inputMixer);
        window.studioSourceNode.start(0, 0);
        window.isStudioPlaying = true;

        const realDurSec = (gearKey === 'jbuf-lock') ? playBuf.duration : (playBuf.duration / Math.max(0.25, nodeRate));
        const nextWaitMs = Math.max(500, (realDurSec - 1.2) * 1000);
        window._horizonSliceTimerV71 = setTimeout(() => {
            const activeG = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
            if (!player.paused && (activeG === 'jbuf-lock' || activeG === 'jbuf-shift' || activeG === 'vinyl-shift')) {
                window.engageHorizonRamEngineV71_5(activeG, false);
            }
        }, nextWaitMs);
    }

    if (badge) {
        if (gearKey === 'jbuf-lock') {
            const c = window._hoseSplicerCacheV46 || {};
            badge.style.color = '#3fb950';
            badge.innerText = `⚡ J Buf 90° [RAM]: x${targetSpd.toFixed(2)}${isRev ? ' ⏪' : ''} | Δy=${((c.avgSeamErrMv || 0) * 100).toFixed(1)}% (${buildMs}мс)`;
        } else if (gearKey === 'vinyl-shift') {
            badge.style.color = '#d2a8ff';
            badge.innerText = `💿 ВИНИЛ [RAM]: x${targetSpd.toFixed(2)}${isRev ? ' ⏪' : ''}`;
        } else {
            badge.style.color = '#3fb950';
            badge.innerText = `⚡ J Buf RAM [PITCH SHIFT]: x${targetSpd.toFixed(2)}${isRev ? ' ⏪' : ''}`;
        }
    }
    return true;
};

// Единый диспетчер синхронизации всех 5 передач и Нейтрали N
;(function installMasterGearboxDispatcherV71_5() {
    const baseSync = window.syncMasterPlaybackEngineV59;
    window.syncMasterPlaybackEngineV59 = function(isDraggingArc) {
        if (window._horizonSliceTimerV71) {
            clearTimeout(window._horizonSliceTimerV71);
            window._horizonSliceTimerV71 = null;
        }
        const player = document.getElementById('audioPlayer');
        const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';

        // 1. НЕЙТРАЛЬ (N): Всегда мгновенно сбрасывает скорость в 1.00x и сохраняет натуральный тон (даже при реверсе!)
        if ((gKey === 'neutral' || gKey === 'n') && player) {
            const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
            if (!isRev || !window.studioBuffer) {
                if (window.studioSourceNode) {
                    try { window.studioSourceNode.onended = null; } catch (e) {}
                    try { window.studioSourceNode.stop(0); } catch (e) {}
                    try { window.studioSourceNode.disconnect(); } catch (e) {}
                }
                window._activeBufferSourcesV71.forEach(n => {
                    n.onended = null;
                    try { n.stop(0); } catch (e) {}
                    try { n.disconnect(); } catch (e) {}
                });
                window._activeBufferSourcesV71.clear();
                window.studioSourceNode = null;
                window.isStudioPlaying = false;
                if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
                player.preservesPitch = true;
                player.mozPreservesPitch = true;
                player.webkitPreservesPitch = true;
                if (Math.abs(player.playbackRate - 1.0) > 0.002) {
                    try { player.playbackRate = 1.0; } catch (e) {}
                }
            } else {
                // Если в Нейтрали включён Реверс — крутим RAM-окно со скоростью 1.0x
                window.engageHorizonRamEngineV71_5('jbuf-lock', false);
            }
            const badge = document.getElementById('hoseLiveTelemetryV44');
            if (badge) {
                badge.style.color = '#e3b341';
                badge.innerText = '⚙️ НЕЙТРАЛЬ [N]: x1.00 (Холостой ход)';
            }
            return;
        }

        // 2. 1-я (J Buf 90°), 2-я (J Buf Pitch Shift) и Задняя R (Винил) на длинных треках (>10 мин) или пока грузится RAM
        if (gKey === 'jbuf-lock' || gKey === 'jbuf-shift' || gKey === 'vinyl-shift') {
            if (!window.studioBuffer || window.studioBuffer.duration > 600) {
                if (window.engageHorizonRamEngineV71_5(gKey, isDraggingArc)) {
                    return;
                }
            }
        }

        return baseSync.apply(this, arguments);
    };
})();


// === V72 TORRENT PIECE MAP DISPATCHER (INSTANT SEEK PRIORITY & ZERO SILENCE) ===

;(function hookSeekAndReverseForTorrentMapV72() {
    const player = document.getElementById('audioPlayer');
    if (player && !player._torrentSeekHookV72) {
        player._torrentSeekHookV72 = true;
        player.addEventListener('seeking', () => {
            if (typeof window.prioritizeRamPieceAtCursorV72 === 'function') {
                window.prioritizeRamPieceAtCursorV72();
            }
        });
    }
    const origRev = window.toggleReverseMode;
    if (typeof origRev === 'function' && !window._revHookV72) {
        window._revHookV72 = true;
        window.toggleReverseMode = function(targetReversed) {
            if (typeof window.prioritizeRamPieceAtCursorV72 === 'function') {
                window.prioritizeRamPieceAtCursorV72();
            }
            return origRev.apply(this, arguments);
        };
    }
})();

// Обновляем engageHorizonRamEngineV71_5 с проверкой торрент-карты кусков:
// если кусок в точке клика уже в RAM (pieceMap == 2) — сразу играем из RAM (25-сек окно),
// если кусок прямо сейчас подкачивается (150 мс) — пингуем торрент-загрузчик и не глушим звук пустыми нулями!
window.engageHorizonRamEngineV71_5 = function(gearKey, isDraggingArc) {
    const player = document.getElementById('audioPlayer');
    const badge = document.getElementById('hoseLiveTelemetryV44');
    if (!player || !window.audioCtx) return false;

    const targetSpd = (typeof window.getActiveTargetSpeedV59 === 'function')
        ? window.getActiveTargetSpeedV59()
        : (player.playbackRate || 1.0);
    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    const curSec = (typeof window.getTruePlaybackTimeV74_2 === 'function') ? window.getTruePlaybackTimeV74_2() : (player.currentTime || 0);
    const refDur = (player && isFinite(player.duration) && player.duration > 0)
        ? player.duration
        : (window.studioBuffer ? window.studioBuffer.duration : 0);

    const readyNow = window.studioBuffer && window.isRamRangeReadyV72
        ? window.isRamRangeReadyV72(window.studioBuffer, curSec, 6.0, isRev, refDur)
        : Boolean(window.studioBuffer);

    if (!window.studioBuffer || !readyNow) {
        // Кусок в точке клика ещё подлетает из FFmpeg (~150 мс): даём приоритет этой точке!
        if (typeof window.prioritizeRamPieceAtCursorV72 === 'function') {
            window.prioritizeRamPieceAtCursorV72();
        }
        window._activeBufferSourcesV71.forEach(n => {
            n.onended = null;
            try { n.stop(); } catch (e) {}
            try { n.disconnect(); } catch (e) {}
        });
        window._activeBufferSourcesV71.clear();
        window.studioSourceNode = null;
        window.isStudioPlaying = false;

        if (!isRev) {
            if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
            const wantPitchLock = (gearKey === 'jbuf-lock' || gearKey === 'web-lock' || gearKey === 'neutral');
            player.preservesPitch = wantPitchLock;
            player.mozPreservesPitch = wantPitchLock;
            player.webkitPreservesPitch = wantPitchLock;
            const spd = (gearKey === 'neutral') ? 1.0 : targetSpd;
            if (Math.abs(player.playbackRate - spd) > 0.003) {
                try { player.playbackRate = spd; } catch (e) {}
            }
        } else {
            if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
        }
        if (badge) {
            badge.style.color = '#e3b341';
            badge.innerText = `⚡ Подгрузка куска RAM в точке клика...`;
        }
        return true;
    }

    if (window.studioBuffer.duration <= 600 && !(isRev && !window.reversedStudioBuffer)) {
        return false;
    }

    if (isDraggingArc) {
        if (window._hoseArcDebounceTimerV47) clearTimeout(window._hoseArcDebounceTimerV47);
        window._hoseArcDebounceTimerV47 = setTimeout(() => {
            window.syncMasterPlaybackEngineV59(false);
        }, 50);
        return true;
    }

    if (window._horizonSliceTimerV71) {
        clearTimeout(window._horizonSliceTimerV71);
        window._horizonSliceTimerV71 = null;
    }

    // Берём компактное 24-секундное окно из готовых кусков торрент-карты
    const WIN_SEC = Math.max(24.0, Math.min(360.0, targetSpd * 3.5));
    const rawWindowBuf = window.extractWindowBufferV71(window.studioBuffer, curSec, WIN_SEC, isRev);
    if (!rawWindowBuf) return false;

    if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
    player.preservesPitch = false;
    if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
        try { player.playbackRate = targetSpd; } catch (e) {}
    }

    let playBuf = rawWindowBuf;
    let nodeRate = 1.0;
    let buildMs = 0;

    if (gearKey === 'jbuf-lock') {
        const tensionPct = (window.appConfig && window.appConfig.hoseTensionPct !== undefined)
            ? window.appConfig.hoseTensionPct
            : 100;
        const t0 = performance.now();
        playBuf = window.buildElasticHoseBufferV46(rawWindowBuf, targetSpd, tensionPct);
        buildMs = Math.round(performance.now() - t0);
        nodeRate = 1.0;
    } else {
        playBuf = rawWindowBuf;
        nodeRate = targetSpd;
    }

    const shouldPlayHorizon = !window._userPausedV75_2 && Boolean(window.isStudioPlaying || window._resumingFromUserPlayV232 || !player.paused);
    if (shouldPlayHorizon) {
        if (window.studioSourceNode) {
            window.studioSourceNode.onended = null;
            try { window.studioSourceNode.stop(); } catch (e) {}
            try { window.studioSourceNode.disconnect(); } catch (e) {}
        }
        window.studioSourceNode = window.audioCtx.createBufferSource();
        window.studioSourceNode._isHoseSpliced = (gearKey === 'jbuf-lock');
        window.studioSourceNode._isHorizonWindowV71 = true;
        window.studioSourceNode.buffer = playBuf;
        window.studioSourceNode.playbackRate.value = nodeRate;
        window.studioSourceNode.connect(window.inputMixer);
        window.studioSourceNode.start(0, 0);
        window.isStudioPlaying = true;
        window._studioClockV74_1 = {
            active: true,
            startCtxTime: window.audioCtx.currentTime,
            startTrackSec: Math.max(0, curSec),
            lastKnownSec: Math.max(0, curSec),
            trackName: window.currentPlayingTrack || '',
            speed: targetSpd
        };

        const realDurSec = (gearKey === 'jbuf-lock') ? playBuf.duration : (playBuf.duration / Math.max(0.25, nodeRate));
        const nextWaitMs = Math.max(400, (realDurSec - 1.0) * 1000);
        window._horizonSliceTimerV71 = setTimeout(() => {
            const activeG = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
            if (!window._userPausedV75_2 && (activeG === 'jbuf-lock' || activeG === 'jbuf-shift' || activeG === 'vinyl-shift')) {
                window.engageHorizonRamEngineV71_5(activeG, false);
            }
        }, nextWaitMs);
    }

    if (badge) {
        const loadedCnt = window.studioBuffer._loadedCountV72 || 0;
        const totalCnt = window.studioBuffer._pieceMapV72 ? window.studioBuffer._pieceMapV72.length : 1;
        const mapStr = window.studioBuffer._pieceMapV72 ? ` [${loadedCnt}/${totalCnt}]` : '';
        if (gearKey === 'jbuf-lock') {
            const c = window._hoseSplicerCacheV46 || {};
            badge.style.color = '#3fb950';
            badge.innerText = `⚡ J Buf 90°${mapStr}: x${targetSpd.toFixed(2)}${isRev ? ' ⏪' : ''} (${buildMs}мс)`;
        } else if (gearKey === 'vinyl-shift') {
            badge.style.color = '#d2a8ff';
            badge.innerText = `💿 ВИНИЛ${mapStr}: x${targetSpd.toFixed(2)}${isRev ? ' ⏪' : ''}`;
        } else {
            badge.style.color = '#3fb950';
            badge.innerText = `⚡ J Buf SHIFT${mapStr}: x${targetSpd.toFixed(2)}${isRev ? ' ⏪' : ''}`;
        }
    }
    return true;
};


// === V74.1 PLAY/PAUSE LONG-PRESS LOCATOR & WEBAUDIO CLOCK SYNC ===

// [V355] Старый зелёный прыжок по списку locateCurrentPlayingTrackV74_1 удалён по месту;
// намеренное удержание Play/Pause обрабатывается только чистым фиолетовым локатором V235.

// 2. Перехватчики Play/Pause, кликов по таймлайну и точного разворота Реверса (V75)
window._studioClockV74_1 = {
    active: false,
    startCtxTime: 0,
    startTrackSec: 0
};

// Запоминаем точную целевую секунду при перемотке или развороте Реверса,
// чтобы даже если <audio> ещё ищет фрейм, RAM-буфер сразу стартовал с правильной секунды!
window.setExactPlaybackPositionV75 = function(targetSec) {
    const player = document.getElementById('audioPlayer');
    const cleanSec = Math.max(0, parseFloat(targetSec) || 0);
    window._pendingSeekTargetV75 = { sec: cleanSec, ts: performance.now() };
    if (window._studioClockV74_1) {
        window._studioClockV74_1.startTrackSec = cleanSec;
        window._studioClockV74_1.startCtxTime = window.audioCtx ? window.audioCtx.currentTime : 0;
    }
    if (player) {
        try { player.currentTime = cleanSec; } catch (e) {}
    }
};

window.getTruePlaybackTimeV74_2 = function() {
    const player = document.getElementById('audioPlayer');
    if (window._pendingSeekTargetV75 && (performance.now() - window._pendingSeekTargetV75.ts < 300)) {
        return window._pendingSeekTargetV75.sec;
    }
    const pTime = (player && isFinite(player.currentTime)) ? player.currentTime : 0;
    const clk = window._studioClockV74_1;
    if (window.isStudioPlaying && window.studioSourceNode && clk && clk.active && window.audioCtx && !window._userPausedV75_2) {
        const spd = clk.speed || ((typeof window.getActiveTargetSpeedV59 === 'function') ? window.getActiveTargetSpeedV59() : 1.0);
        const est = clk.startTrackSec + Math.max(0, window.audioCtx.currentTime - clk.startCtxTime) * spd;
        const maxDur = (window.studioBuffer && window.studioBuffer.duration)
            ? window.studioBuffer.duration
            : ((player && isFinite(player.duration) && player.duration > 0) ? player.duration : 999999);
        const clampedEst = Math.max(0, Math.min(maxDur - 0.02, est));
        if (!player || player.paused || pTime < 0.08 || Math.abs(pTime - clampedEst) > 0.45) {
            return clampedEst;
        }
    }
    return pTime;
};

// Перехватчик toggleReverseMode: гарантирует зеркальный разворот времени (dur - cur) ровно 1 раз!
;(function installExactReverseFlipInterceptorV75() {
    const baseToggleRev = window.toggleReverseMode;
    if (false && typeof baseToggleRev === 'function' && !window._exactRevHookV75) {
        window._exactRevHookV75 = true;
        window.toggleReverseMode = function(targetReversed) {
            const player = document.getElementById('audioPlayer');
            const oldRev = Boolean(window.isReversed);
            const newRev = (targetReversed !== undefined) ? Boolean(targetReversed) : !oldRev;
            if (newRev === oldRev) return;

            const dur = (window.studioBuffer && window.studioBuffer.duration)
                ? window.studioBuffer.duration
                : ((player && isFinite(player.duration) && player.duration > 0) ? player.duration : 0);
            const curBefore = window.getTruePlaybackTimeV74_2();
            const flippedSec = (dur > 0) ? Math.max(0, Math.min(dur - 0.02, dur - curBefore)) : curBefore;

            // Фиксируем зеркальную точку (например, 3:00 - 1:00 = 2:00 для реверс-буфера, что соответствует 1:00 песни)
            window.setExactPlaybackPositionV75(flippedSec);

            const res = baseToggleRev.apply(this, arguments);

            // Повторно закрепляем flippedSec, если внутри старого обработчика currentTime не успел сдвинуться
            window.setExactPlaybackPositionV75(flippedSec);
            if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            }
            if (player && dur > 0 && typeof window.updateProgressUI === 'function') {
                window.updateProgressUI(flippedSec, dur, newRev);
            }
            return res;
        };
    }

    // Перехватчик клика по таймлайну (seekAudio)
    const baseSeekAudio = window.seekAudio;
    if (typeof baseSeekAudio === 'function' && !window._exactSeekHookV75) {
        window._exactSeekHookV75 = true;
        window.seekAudio = function(event) {
            const res = baseSeekAudio.apply(this, arguments);
            const player = document.getElementById('audioPlayer');
            if (player && isFinite(player.currentTime)) {
                window.setExactPlaybackPositionV75(player.currentTime);
                if (!player.paused && typeof window.syncMasterPlaybackEngineV59 === 'function') {
                    window.syncMasterPlaybackEngineV59(false);
                }
            }
            return res;
        };
    }
})();

// Перехватчик 2-й передачи (J Buf Shift) и Задней R (Винил)
window.engageDirectRamPitchShiftV70 = function(gearKey, targetSpd) {
    const player = document.getElementById('audioPlayer');
    if (!player || !window.audioCtx) return false;

    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    if (isRev && window.studioBuffer && window.studioBuffer.duration > 900 && !window.reversedStudioBuffer) {
        return window.engageHorizonRamEngineV71_5(gearKey, false);
    }

    const hasRev67 = Boolean(
        window.reconstructedMasterBufferV67 &&
        window.currentTrackRevMapV67 &&
        window.currentTrackRevNameV67 === window.currentPlayingTrack
    );

    let rawBuf = hasRev67
        ? (isRev ? (window.reconstructedReversedBufferV67 || window.reconstructedMasterBufferV67) : window.reconstructedMasterBufferV67)
        : (isRev ? (window.reversedStudioBuffer || window.studioBuffer) : window.studioBuffer);

    const isActivelyPlaying = (!player.paused) || Boolean(window.isStudioPlaying);

    if (!rawBuf) {
        if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
        player.preservesPitch = false;
        player.mozPreservesPitch = false;
        player.webkitPreservesPitch = false;
        if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
            try { player.playbackRate = targetSpd; } catch (e) {}
        }
        return false;
    }

    const trueSec = window.getTruePlaybackTimeV74_2();
    if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
    player.preservesPitch = false;
    if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
        try { player.playbackRate = targetSpd; } catch (e) {}
    }

    const isVinyl = (gearKey === 'vinyl-shift');
    const effSpd = hasRev67
        ? Math.max(0.1, Math.min(100.0, (parseFloat(window.currentTrackRevMapV67.spd) || 1.0) * targetSpd))
        : targetSpd;

    if (isActivelyPlaying) {
        if (player.paused) {
            player.play().catch(() => {});
        }
        const seekRecent = window._pendingSeekTargetV75 && (performance.now() - window._pendingSeekTargetV75.ts < 350);
        const needNewNode = seekRecent ||
                            !window.studioSourceNode ||
                            !window.isStudioPlaying ||
                            window.studioSourceNode.buffer !== rawBuf ||
                            Boolean(window.studioSourceNode._isHoseSpliced);
        if (needNewNode) {
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null;
                try { window.studioSourceNode.stop(); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
            }
            window.studioSourceNode = window.audioCtx.createBufferSource();
            window.studioSourceNode._isHoseSpliced = false;
            window.studioSourceNode.buffer = rawBuf;
            window.studioSourceNode.playbackRate.value = effSpd;
            window.studioSourceNode.connect(window.inputMixer);

            let offset = trueSec;
            if (!isFinite(offset) || offset < 0) offset = 0;
            if (offset >= rawBuf.duration) offset = Math.max(0, rawBuf.duration - 0.05);

            window.studioSourceNode.start(0, offset);
            window.isStudioPlaying = true;
            window._studioClockV74_1 = {
                active: true,
                startCtxTime: window.audioCtx.currentTime,
                startTrackSec: Math.max(0, offset),
                lastKnownSec: Math.max(0, offset),
                trackName: window.currentPlayingTrack || '',
                speed: effSpd
            };
        } else if (window.studioSourceNode && window.studioSourceNode.playbackRate) {
            const now = window.audioCtx.currentTime;
            if (isVinyl) {
                window.studioSourceNode.playbackRate.setTargetAtTime(effSpd, now, 0.085);
            } else {
                window.studioSourceNode.playbackRate.setValueAtTime(effSpd, now);
            }
            window._studioClockV74_1 = {
                active: true,
                startCtxTime: now,
                startTrackSec: Math.max(0, trueSec),
                lastKnownSec: Math.max(0, trueSec),
                trackName: window.currentPlayingTrack || '',
                speed: effSpd
            };
        }
    }

    const badge = document.getElementById('hoseLiveTelemetryV44');
    if (badge) {
        badge.style.color = isVinyl ? '#d2a8ff' : '#3fb950';
        badge.innerText = isVinyl
            ? `💿 ВИНИЛ [RAM Platter]: x${effSpd.toFixed(2)} (Инерция 85мс)`
            : `⚡ J Buf RAM [PITCH SHIFT]: x${effSpd.toFixed(2)} (Прямой 32-bit буфер)`;
    }
    return true;
};


// === JENNY V76.2 DIRECT ANALOG DNA 1.0X MODE (V83 INDEPENDENT CLOCK) ===
window.dnaDirect1xActiveV76 = false;
window.dnaCleanGainNodeV76 = null;
window._dnaPlayStartCtxTimeV82 = 0;
window._dnaPlayStartOrigSecV82 = 0;
window._dnaClockTimerV83 = null;
window._dnaBoundTrackV83 = null;

window.ensureDnaCleanGainV76 = function() {
    if (!window.audioCtx) return null;
    if (!window.dnaCleanGainNodeV76 || window.dnaCleanGainNodeV76.context !== window.audioCtx) {
        window.dnaCleanGainNodeV76 = window.audioCtx.createGain();
        window.dnaCleanGainNodeV76.connect(window.masterAntiClickGain || window.audioCtx.destination);
    }
    const volBar = document.getElementById('volumeBar');
    const volVal = volBar ? (parseInt(volBar.value, 10) || 10) : 10;
    window.dnaCleanGainNodeV76.gain.value = (volVal / 10.0) * 0.85;
    return window.dnaCleanGainNodeV76;
};

window.stopDnaClockTimerV83 = function() {
    if (window._dnaClockTimerV83) {
        clearInterval(window._dnaClockTimerV83);
        window._dnaClockTimerV83 = null;
    }
};

window.resetDnaModeOnTrackChangeV83 = function() {
    window.stopDnaClockTimerV83();
    window.dnaDirect1xActiveV76 = false;
    window._dnaPlayStartCtxTimeV82 = 0;
    window._dnaPlayStartOrigSecV82 = 0;
    const player = document.getElementById('audioPlayer');
    if (player) {
        player.loop = false;
        try { player.playbackRate = 1.0; } catch (e) {}
    }
    const lockEl = document.getElementById('speedLockIndicator');
    if (lockEl && lockEl.innerText && lockEl.innerText.indexOf('ДНК') !== -1) {
        lockEl.style.display = 'none';
        lockEl.style.color = '#e3b341';
    }
    if (typeof window.updateDna1xButtonUIV76 === 'function') window.updateDna1xButtonUIV76();
};

window.getExactDnaOrigSecV82 = function() {
    const cleanBuf = window.reconstructedMasterBufferV67;
    if (!cleanBuf || !window.audioCtx) return 0;
    const player = document.getElementById('audioPlayer');
    if (window.dnaDirect1xActiveV76) {
        if (player && !player.paused && window._dnaPlayStartCtxTimeV82 > 0) {
            const elapsed = Math.max(0, window.audioCtx.currentTime - window._dnaPlayStartCtxTimeV82);
            return Math.min(cleanBuf.duration, window._dnaPlayStartOrigSecV82 + elapsed);
        }
        return Math.min(cleanBuf.duration, window._dnaPlayStartOrigSecV82 || 0);
    }
    const expBuf = window.studioBuffer || cleanBuf;
    const expDur = (player && isFinite(player.duration) && player.duration > 0) ? player.duration : expBuf.duration;
    const cur = player ? (player.currentTime || 0) : 0;
    return expDur > 0 ? Math.min(cleanBuf.duration - 0.01, (cur / expDur) * cleanBuf.duration) : 0;
};

window.startDnaClockTimerV83 = function() {
    window.stopDnaClockTimerV83();
    window._dnaClockTimerV83 = setInterval(() => {
        if (!window.dnaDirect1xActiveV76 || !window.reconstructedMasterBufferV67) {
            window.stopDnaClockTimerV83();
            return;
        }
        if (window._dnaBoundTrackV83 && window.currentPlayingTrack !== window._dnaBoundTrackV83) {
            window.resetDnaModeOnTrackChangeV83();
            return;
        }
        const player = document.getElementById('audioPlayer');
        const cleanBuf = window.reconstructedMasterBufferV67;
        if (!player || player.paused) return;

        // Удерживаем беззвучный <audio> в начале файла со скоростью 1.0, чтобы он никогда не завершался раньше cleanBuf
        if (player.playbackRate !== 1.0) {
            try { player.playbackRate = 1.0; } catch (e) {}
        }
        // V85: держим беззвучный <audio> на паузе или в loop без ручного currentTime, чтобы не триггерить seeked!

        const curOrig = window.getExactDnaOrigSecV82();
        if (curOrig >= cleanBuf.duration - 0.05) {
            window.resetDnaModeOnTrackChangeV83();
            if (typeof window.playNextTrack === 'function') window.playNextTrack();
            return;
        }
        const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
        if (typeof window.updateProgressUI === 'function') window.updateProgressUI(curOrig, cleanBuf.duration, isRev);
        if (typeof window.updateCenterCurrentTime === 'function') window.updateCenterCurrentTime(curOrig, cleanBuf.duration, isRev);
    }, 50);
};

window.updateDna1xButtonUIV76 = function() {
    const qGroup = document.getElementById('quickModalsGroup');
    if (!qGroup) return;
    let btn = document.getElementById('btnDnaDirect1xV76');
    const hasRev = Boolean(
        window.reconstructedMasterBufferV67 &&
        window.currentTrackRevMapV67 &&
        window.currentTrackRevNameV67 === window.currentPlayingTrack
    );
    if (!hasRev) {
        if (btn) btn.style.display = 'none';
        return;
    }
    if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btnDnaDirect1xV76';
        btn.className = 'jenny-icon-pill';
        btn.style.cssText = 'width:auto;padding:0 10px;border-radius:18px;font-size:11px;font-weight:900;gap:4px;';
        btn.onclick = (e) => window.toggleDnaDirect1xModeV76(e);
        qGroup.insertBefore(btn, qGroup.firstChild);
    }
    btn.style.display = 'inline-flex';
    const expSpd = parseFloat(window.currentTrackRevMapV67.spd) || 1.0;
    if (window.dnaDirect1xActiveV76) {
        btn.innerHTML = '🧬 ОРИГ 1.0x: ВКЛ';
        btn.style.borderColor = '#3fb950';
        btn.style.color = '#3fb950';
        btn.style.boxShadow = '0 0 12px rgba(63,185,80,0.45)';
    } else {
        btn.innerHTML = `🧬 Вкл 1.0x (из x${expSpd.toFixed(2)})`;
        btn.style.borderColor = '#58a6ff';
        btn.style.color = '#58a6ff';
        btn.style.boxShadow = '';
    }
};

window.startDnaBufferNodeFromSecV82 = function(origSec) {
    const player = document.getElementById('audioPlayer');
    const cleanBuf = (window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed))
        ? (window.reconstructedReversedBufferV67 || window.reconstructedMasterBufferV67)
        : window.reconstructedMasterBufferV67;
    if (!player || !window.audioCtx || !cleanBuf) return;

    if (typeof window.disengageHorizonRamEngineV71_5 === 'function') {
        window.disengageHorizonRamEngineV71_5();
    }
    if (window.studioSourceNode) {
        window.studioSourceNode.onended = null;
        try { window.studioSourceNode.stop(); } catch (e) {}
        try { window.studioSourceNode.disconnect(); } catch (e) {}
        window.studioSourceNode = null;
    }
    if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;

    const safeOrigSec = Math.max(0, Math.min(cleanBuf.duration - 0.02, origSec));
    window._dnaPlayStartOrigSecV82 = safeOrigSec;
    window._dnaPlayStartCtxTimeV82 = window.audioCtx.currentTime;
    window._dnaBoundTrackV83 = window.currentPlayingTrack;

    player.loop = true;
    try { player.playbackRate = 1.0; } catch (e) {}

    if (!player.paused) {
        const outGain = window.ensureDnaCleanGainV76() || window.inputMixer;
        window.studioSourceNode = window.audioCtx.createBufferSource();
        window.studioSourceNode._isHoseSpliced = true;
        window.studioSourceNode._isDna1xNodeV82 = true;
        window.studioSourceNode.buffer = cleanBuf;
        window.studioSourceNode.playbackRate.value = 1.0;
        window.studioSourceNode.connect(outGain);
        window.studioSourceNode.start(0, safeOrigSec);
        window.isStudioPlaying = true;
        window.startDnaClockTimerV83();
    }
};

window.toggleDnaDirect1xModeV76 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const hasRev = Boolean(
        window.reconstructedMasterBufferV67 &&
        window.currentTrackRevMapV67 &&
        window.currentTrackRevNameV67 === window.currentPlayingTrack
    );
    if (!hasRev) {
        if (typeof window.showToast === 'function') window.showToast('⚠️ В этом треке нет капсулы JENNYV67!', ev);
        return;
    }
    const player = document.getElementById('audioPlayer');
    const cleanBuf = window.reconstructedMasterBufferV67;
    const expBuf = window.studioBuffer || cleanBuf;
    const expDur = (player && isFinite(player.duration) && player.duration > 0) ? player.duration : expBuf.duration;
    const lenRatio = (expDur > 0 && cleanBuf.duration > 0) ? (expDur / cleanBuf.duration) : 1.0;

    if (!window.dnaDirect1xActiveV76) {
        const curFileSec = player ? (player.currentTime || 0) : 0;
        const targetOrigSec = (expDur > 2.5 && lenRatio > 0) ? (curFileSec / lenRatio) : 0;

        window.dnaDirect1xActiveV76 = true;
        if (window.scrubState) {
            window.scrubState.active = false;
            window.scrubState.locked = false;
            window.scrubState.speed = 1.0;
        }
        window.persistedPlaybackSpeed = null;
        window.startDnaBufferNodeFromSecV82(targetOrigSec);

        const lockEl = document.getElementById('speedLockIndicator');
        if (lockEl) {
            lockEl.style.display = 'block';
            lockEl.style.color = '#3fb950';
            lockEl.innerText = '🧬 ДНК 1.00x (Чистый оригинал)';
        }
    } else {
        const exactOrigSec = window.getExactDnaOrigSecV82();
        const exactFileSec = Math.max(0, Math.min(expDur - 0.02, exactOrigSec * lenRatio));

        window.resetDnaModeOnTrackChangeV83();
        if (window.studioSourceNode) {
            window.studioSourceNode.onended = null;
            try { window.studioSourceNode.stop(); } catch (e) {}
            try { window.studioSourceNode.disconnect(); } catch (e) {}
            window.studioSourceNode = null;
        }
        if (player) {
            try { player.currentTime = exactFileSec; } catch (e) {}
        }
        if (typeof window.setExactPlaybackPositionV75 === 'function') {
            window.setExactPlaybackPositionV75(exactFileSec);
        }
        if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
            window.syncMasterPlaybackEngineV59(false);
        }
    }
    window.updateDna1xButtonUIV76();
};

/* [split] блок 146: кусок исходного IIFE (ui_v71.js, строки 3742–3851) → ui_reverse.js */
;(function installDnaDirectEngineHookV83() {

    const prevSync = window.syncMasterPlaybackEngineV59;
    window.syncMasterPlaybackEngineV59 = function(isDraggingArc) {
        window.updateDna1xButtonUIV76();
        if (window.dnaDirect1xActiveV76 && window._dnaBoundTrackV83 && window.currentPlayingTrack !== window._dnaBoundTrackV83) {
            window.resetDnaModeOnTrackChangeV83();
        }
        const hasRev = Boolean(
            window.reconstructedMasterBufferV67 &&
            window.currentTrackRevMapV67 &&
            window.currentTrackRevNameV67 === window.currentPlayingTrack
        );
        const userArcSpd = (window.scrubState && (window.scrubState.active || window.scrubState.locked))
            ? parseFloat(window.scrubState.speed || 1.0)
            : 1.0;
        if (window.dnaDirect1xActiveV76 && (isDraggingArc || Math.abs(userArcSpd - 1.0) > 0.01)) {
            window.resetDnaModeOnTrackChangeV83();
        }
        if (hasRev && window.dnaDirect1xActiveV76) {
            const player = document.getElementById('audioPlayer');
            if (!player || !window.audioCtx) return;
            if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
            player.loop = true;
            try { player.playbackRate = 1.0; } catch (e) {}

            if (player.paused) {
                window._dnaPlayStartOrigSecV82 = window.getExactDnaOrigSecV82();
                window._dnaPlayStartCtxTimeV82 = 0;
                if (window.studioSourceNode) {
                    window.studioSourceNode.onended = null;
                    try { window.studioSourceNode.stop(); } catch (e) {}
                    try { window.studioSourceNode.disconnect(); } catch (e) {}
                    window.studioSourceNode = null;
                }
                window.isStudioPlaying = false;
            } else if (!window.studioSourceNode || !window.studioSourceNode._isDna1xNodeV82 || !window.isStudioPlaying) {
                window.startDnaBufferNodeFromSecV82(window._dnaPlayStartOrigSecV82 || 0);
            }
            return;
        }
        return prevSync.apply(this, arguments);
    };

    // Экранируем события seeking/seeked/ended от 1.58-секундного <audio>, чтобы он не перезапускал 🧬 ДНК 1.0x на "На... На..."
    const shieldPlayerEventsV85 = () => {
        const p = document.getElementById('audioPlayer');
        if (!p || p._dnaShieldV85) return;
        p._dnaShieldV85 = true;
        ['seeking', 'seeked', 'ended'].forEach(evType => {
            p.addEventListener(evType, (e) => {
                if (window.dnaDirect1xActiveV76 && window.reconstructedMasterBufferV67) {
                    e.stopImmediatePropagation();
                }
            }, true);
        });
    };
    shieldPlayerEventsV85();
    setTimeout(shieldPlayerEventsV85, 500);

    // Перемотка ползунком seekBar вручную в режиме ДНК 1.0x
    setTimeout(() => {
        const sb = document.getElementById('seekBar');
        if (sb && !window._dnaSeekBarHookedV83) {
            window._dnaSeekBarHookedV83 = true;
            sb.addEventListener('input', () => {
                if (window.dnaDirect1xActiveV76 && window.reconstructedMasterBufferV67) {
                    const maxVal = parseFloat(sb.max) || 1000;
                    const ratio = Math.max(0, Math.min(0.999, (parseFloat(sb.value) || 0) / maxVal));
                    window.startDnaBufferNodeFromSecV82(ratio * window.reconstructedMasterBufferV67.duration);
                }
            });
        }
    }, 600);

    const origCenterTime = window.updateCenterCurrentTime;
    if (typeof origCenterTime === 'function') {
        window.updateCenterCurrentTime = function(cur, dur, isRev) {
            if (window.dnaDirect1xActiveV76 && window.reconstructedMasterBufferV67) {
                return origCenterTime(window.getExactDnaOrigSecV82(), window.reconstructedMasterBufferV67.duration, isRev);
            }
            return origCenterTime(cur, dur, isRev);
        };
    }

    const origUpdateProg = window.updateProgressUI;
    if (typeof origUpdateProg === 'function') {
        window.updateProgressUI = function(cur, dur, isRev) {
            if (window.dnaDirect1xActiveV76 && window.reconstructedMasterBufferV67) {
                return origUpdateProg(window.getExactDnaOrigSecV82(), window.reconstructedMasterBufferV67.duration, isRev);
            }
            return origUpdateProg(cur, dur, isRev);
        };
    }
})();

/* [split] V170: кусок исходного IIFE (ui_v71.js, строки 14832–15119) → ui_reverse.js */
;(function() {
    if (window._jennyV170Installed__reverse) return;
    window._jennyV170Installed__reverse = true;
    window._jennyV170Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    function getVideoElV170() {
        return document.getElementById('jennyVideoElV130') || document.querySelector('video');
    }
    function isVideoDeckActiveV170() {
        var vEl = getVideoElV170();
        if (window._activeUiDeckV131 === 'video') return true;
        if (vEl && !vEl.paused && vEl.readyState >= 2 && vEl.offsetParent !== null) return true;
        return false;
    }

    // 3. Перехват радиальной дуги скорости («штуки внизу») для управления Декой Б (Видео)
    var origStartScrub = window.startScrub;
    window.startScrub = function(side, speed) {
        if (false && isVideoDeckActiveV170()) {
            window.setVideoDeckSpeedV170(speed, false);
            return;
        }
        if (typeof origStartScrub === 'function') {
            return origStartScrub.apply(this, arguments);
        }
    };

    var origStopScrub = window.stopScrub;
    window.stopScrub = function() {
        if (false && isVideoDeckActiveV170()) {
            // При отпускании дуги оставляем выбранную скорость для видеодеки
            var vEl = getVideoElV170();
            if (vEl) {
                try { vEl.playbackRate = window._jennyVideoSpeedV170; } catch (e) {}
            }
            return;
        }
        if (typeof origStopScrub === 'function') {
            return origStopScrub.apply(this, arguments);
        }
    };
})();

/* [split] V211: кусок исходного IIFE (ui_v71.js, строки 16526–17925) → ui_reverse.js */
;(function() {
    if (window._jennyV211Installed__reverse) return;
    window._jennyV211Installed__reverse = true;
    window._jennyV211Installed = true;

    // Также гарантируем, что для длинных аудио-треков на Деке А строится Буфер #2 (window.reversedStudioBuffer)
    var _origDecodeHugeAudioV71 = window.decodeHugeTrackToRamV71;
    if (typeof _origDecodeHugeAudioV71 === 'function') {
        window.decodeHugeTrackToRamV71 = async function(filename, titleEl, player, preMeta) {
            const buf = await _origDecodeHugeAudioV71.apply(this, arguments);
            if (buf && window.currentPlayingTrack === filename && !window.reversedStudioBuffer) {
                try {
                    if (typeof window.reverseAudioBufferInDeckAWorker === 'function') {
                        window.reversedStudioBuffer = await window.reverseAudioBufferInDeckAWorker(buf, window.audioCtx);
                    }
                    if (!window.reversedStudioBuffer && typeof window.cloneAndReverseBuffer === 'function') {
                        window.reversedStudioBuffer = await window.cloneAndReverseBuffer(buf);
                    }
                } catch (e) {}
            }
            return buf;
        };
    }
})();

/* [split] V216: кусок исходного IIFE (ui_v71.js, строки 19638–21240) → ui_reverse.js */
;(function() {
    if (window._jennyV216Installed__reverse) return;
    window._jennyV216Installed__reverse = true;
    window._jennyV216Installed = true;

    // -------------------------------------------------------------------------
    // 6. МГНОВЕННЫЙ СТАРТ СЖАТОГО ПОТОКА ("⏳ RAM (пока играет сжатый...)") ЗА 0.2 СЕК
    //    И ЗАЩИТА ОТ ЗАВИСАНИЯ НА "05. Beautiful World_compare.wav" (71420, 71418, 71419)
    // -------------------------------------------------------------------------
    window._audioTrackLoadSeqV216 = 0;
    window._audioRamAbortCtrlV216 = null;

    window.abortPendingAudioRamLoadsV216 = function() {
        if (window._audioRamAbortCtrlV216) {
            try { window._audioRamAbortCtrlV216.abort(); } catch (e) {}
            window._audioRamAbortCtrlV216 = null;
        }
        if (window._pieceAbortCtrlV72) {
            try { window._pieceAbortCtrlV72.abort(); } catch (e) {}
            window._pieceAbortCtrlV72 = null;
        }
    };
})();

/* [split] V217: кусок исходного IIFE (ui_v71.js, строки 21243–22584) → ui_reverse.js */
;(function() {
    if (window._jennyV217Installed__reverse) return;
    window._jennyV217Installed__reverse = true;
    window._jennyV217Installed = true;

    // Поддержка радиальной дуги при удержании и потягивании на кнопках скорости внутри самого видеоплеера!
    window.bindInPlayerSpeedArcDragV217 = function(btnEl, sideStr) {
        if (!btnEl || btnEl._v217ArcBound) return;
        btnEl._v217ArcBound = true;

        var holdT = null;
        var arcActive = false;
        var arcWrap = null;
        var arcItems = [];
        var pickedSpd = null;

        var cleanupArc = function() {
            if (holdT) { clearTimeout(holdT); holdT = null; }
            if (arcWrap) { arcWrap.remove(); arcWrap = null; }
            arcItems = [];
        };

        btnEl.addEventListener('touchstart', function(e) {
            if (!e.touches || !e.touches[0]) return;
            cleanupArc();
            arcActive = false;
            pickedSpd = null;
            var t0 = e.touches[0];
            var anchorX = t0.clientX;
            var anchorY = t0.clientY;

            holdT = setTimeout(function() {
                arcActive = true;
                try { navigator.vibrate(25); } catch (err) {}
                var zones = window.getCustomVideoSpeedZonesV217();
                var root = document.getElementById('jennyVideoStudioRootV130') || document.body;
                arcWrap = document.createElement('div');
                arcWrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';

                var count = zones.length;
                var radius = 112;
                // Для кнопки назад (слева) раскрываем дугу вправо-вверх, для кнопки вперёд (справа) — влево-вверх (с обратной стороны!)
                var startDeg = (sideStr === 'left') ? -15 : -165;
                var endDeg   = (sideStr === 'left') ? -135 : -45;

                zones.forEach(function(zVal, i) {
                    var u = count === 1 ? 0.5 : (i / (count - 1));
                    var deg = startDeg + u * (endDeg - startDeg);
                    var rad = deg * Math.PI / 180;
                    var cx = Math.max(28, Math.min(window.innerWidth - 28, anchorX + radius * Math.cos(rad)));
                    var cy = Math.max(36, Math.min(window.innerHeight - 50, anchorY + radius * Math.sin(rad)));

                    var b = document.createElement('div');
                    b.className = 'arc-item';
                    b.dataset.val = String(zVal);
                    b.dataset.cx = String(cx);
                    b.dataset.cy = String(cy);
                    b.innerText = 'x' + zVal;
                    b.style.cssText = 'position:fixed;left:' + (cx - 23) + 'px;top:' + (cy - 23) + 'px;width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(11,24,54,0.95);border:2px solid #3b82f6;color:#93c5fd;font-size:12px;font-weight:900;box-shadow:0 0 14px rgba(59,130,246,0.55);transition:transform 0.1s ease;';
                    arcWrap.appendChild(b);
                    arcItems.push(b);
                });
                root.appendChild(arcWrap);
            }, 260);
        }, { passive: true });

        btnEl.addEventListener('touchmove', function(e) {
            if (!arcActive || !e.touches || !e.touches[0]) return;
            e.stopPropagation();
            var tx = e.touches[0].clientX;
            var ty = e.touches[0].clientY;
            var bestEl = null;
            var bestDist = Infinity;
            arcItems.forEach(function(item) {
                var dx = tx - parseFloat(item.dataset.cx);
                var dy = ty - parseFloat(item.dataset.cy);
                var d = Math.hypot(dx, dy);
                if (d < bestDist) {
                    bestDist = d;
                    bestEl = item;
                }
            });
            if (bestEl && bestDist < 75) {
                arcItems.forEach(function(el) {
                    var act = (el === bestEl);
                    el.style.transform = act ? 'scale(1.22)' : 'scale(1.0)';
                    el.style.background = act ? '#2563eb' : 'rgba(11,24,54,0.95)';
                    el.style.color = act ? '#ffffff' : '#93c5fd';
                });
                var newSpd = parseFloat(bestEl.dataset.val);
                if (newSpd !== pickedSpd) {
                    pickedSpd = newSpd;
                    try { navigator.vibrate(12); } catch (err) {}
                    if (window.scrubStateDeckB) {
                        window.scrubStateDeckB.locked = true;
                        window.scrubStateDeckB.side = sideStr;
                        window.scrubStateDeckB.speed = pickedSpd;
                        window.scrubStateDeckB.isPhysicallyReversed = (sideStr === 'left');
                    }
                    window.persistedPlaybackSpeedDeckB = pickedSpd;
                    window.persistedPlaybackSideDeckB = sideStr;
                    if (sideStr === 'left') {
                        window._lastRevVideoSpeedV217 = pickedSpd;
                        window.startImmediateVideoReverseEngineV217(pickedSpd);
                    } else {
                        window._lastFwdVideoSpeedV217 = pickedSpd;
                        window.restoreNormalVideoPlaybackV217(null, pickedSpd);
                        window.setVideoDeckSpeedV170(pickedSpd, false);
                    }
                    if (typeof window.syncDeckBSpeedLockIndicatorV227 === 'function') {
                        window.syncDeckBSpeedLockIndicatorV227();
                    }
                    window.syncVideoPlayerButtonsUIV217();
                }
            }
        }, { passive: true });

        var finishArc = function(e) {
            if (arcActive) {
                if (e && e.stopPropagation) e.stopPropagation();
                if (e && e.preventDefault) e.preventDefault();
                cleanupArc();
                arcActive = false;
                return;
            }
            cleanupArc();
        };
        btnEl.addEventListener('touchend', finishArc);
        btnEl.addEventListener('touchcancel', finishArc);
    };
})();

/* [split] V221: кусок исходного IIFE (ui_v71.js, строки 25084–26033) → ui_reverse.js */
;(function() {
    if (window._jennyV221Installed__reverse) return;
    window._jennyV221Installed__reverse = true;
    window._jennyV221Installed = true;

    // -------------------------------------------------------------------------
    // 6. ДВУХЭТАПНЫЙ АППАРАТНЫЙ РЕВЕРС (3.8 СЕК МИКРО-КУСОК + ФОНОВАЯ ПРЕДЗАГРУЗКА ТЕКУЩЕЙ ДОРОЖКИ)
    //    И МГНОВЕННОЕ ПЕРЕКЛЮЧЕНИЕ АУДИОДОРОЖЕК (ДОР. #1 / #2) В РЕВЕРСЕ БЕЗ ЧЁРНОГО ЭКРАНА (71533.mp4)
    // -------------------------------------------------------------------------
    window.triggerReverseTrackBackgroundPrecacheV220 = function(fromPosSec, audioIdx, noAudFlag) {
        var st = window._vidStateV130 || {};
        if (!st.active) return;
        var rawBaseUrl = st.rawTorStreamUrlV214 || st.currentUrl || '';
        if (!rawBaseUrl || fromPosSec <= 0.4) return;

        var win1 = Math.min(10.0, Math.max(2.0, fromPosSec));
        fetch('/api/video/reverse_precache?src=' + encodeURIComponent(rawBaseUrl) +
            '&pos=' + fromPosSec.toFixed(2) +
            '&win=' + win1.toFixed(2) +
            '&aidx=' + audioIdx +
            '&no_audio=' + noAudFlag +
            '&t=' + Date.now()).catch(function(){});

        var nextPos2 = fromPosSec - win1;
        if (nextPos2 > 1.0) {
            var mySession = st._revTrackSessionIdV220;
            setTimeout(function() {
                var vdNow = window.videoDeckV131 || {};
                if (!st.active || !vdNow.isReversed || st._revTrackSessionIdV220 !== mySession) return;
                var win2 = Math.min(12.0, Math.max(2.0, nextPos2));
                fetch('/api/video/reverse_precache?src=' + encodeURIComponent(rawBaseUrl) +
                    '&pos=' + nextPos2.toFixed(2) +
                    '&win=' + win2.toFixed(2) +
                    '&aidx=' + audioIdx +
                    '&no_audio=' + noAudFlag +
                    '&t=' + Date.now()).catch(function(){});
            }, 1400);
        }
    };

    window.stopHardwareReverseTimerV220 = function() {
        var st = window._vidStateV130 || {};
        var vd = window.videoDeckV131 || {};
        if (st._hwRevTimerV220) {
            clearInterval(st._hwRevTimerV220);
            st._hwRevTimerV220 = null;
        }
        if (vd.revFrameTimer) {
            clearInterval(vd.revFrameTimer);
            vd.revFrameTimer = null;
        }
    };
})();

/* [split] V223: кусок исходного IIFE (ui_v71.js, строки 26037–26373) → ui_reverse.js */
;(function() {
    if (window._jennyV223Installed__reverse) return;
    window._jennyV223Installed__reverse = true;
    window._jennyV223Installed = true;

    // Вычисляет оптимальную длину куска реверса с учётом текущей скорости (1x, 1.5x, 2x, 4x и т.д.):
    // Чем выше скорость реверса, тем пропорционально длиннее создаётся буфер в RAM!
    window.computeAdaptiveReverseWindowSecV223 = function(stepIndex, spd) {
        var effSpd = Math.max(1.0, Math.min(8.0, Number(spd) || 1.0));
        if (stepIndex === 0) {
            // Стартовый кусок: ~6 сек реального времени игры (чтобы за это время первый большой кусок гарантированно собрался в RAM)
            return Number(Math.min(28.0, Math.max(6.0, 5.8 * effSpd)).toFixed(1));
        }
        if (stepIndex === 1) {
            // 1-й предзагруженный кусок в RAM: ~16 сек реального времени игры (при 1.5x = 24 сек, при 2x = 32 сек, при 4x = 55 сек)
            return Number(Math.min(55.0, Math.max(18.0, 16.0 * effSpd)).toFixed(1));
        }
        // 2-й, 3-й и последующие куски в RAM-очереди: ~24 сек реального времени игры (до 65 сек на один кусок!)
        return Number(Math.min(65.0, Math.max(24.0, 22.0 * effSpd)).toFixed(1));
    };
})();

/* [split] V227: кусок исходного IIFE (ui_v71.js, строки 26642–27952) → ui_reverse.js */
;(function() {
    if (window._jennyV227Installed__reverse) return;
    window._jennyV227Installed__reverse = true;
    window._jennyV227Installed = true;

    // 10. Обновляем радиальную дугу Фиолетовой Деки А (window.setupSeekZone):
    //     - Лучи и неоновое ядро выходят строго из СВОЕЙ фиолетовой кнопки эквалайзера Деки А (#btn-eqModal)!
    //     - А сама дуга из 6 кружков приподнята вверх на уровень синей деки (curveOriginY = Math.min(eqB.y, H - 142))
    //       с плавным углом endDeg = -192° (без зажима о низ экрана), чтобы нижний кружок (x0.9) никогда не загибался вправо!
    window.getEnabledAudioSpeedZonesV228 = function() {
        var cfgA = window._musicConfigRefV131 || window.appConfig || {};
        if (Array.isArray(cfgA.scrubZones) && cfgA.scrubZones.length > 0) {
            var list = [];
            cfgA.scrubZones.forEach(function(z) {
                if (z && z.en !== false && z.val) {
                    var v = parseFloat(z.val);
                    if (isFinite(v) && v > 0) list.push(v);
                }
            });
            if (list.length > 0) return list;
        }
        var domList = [];
        for (var i = 1; i <= 6; i++) {
            var en = document.getElementById('cfg_z' + i + '_en');
            var val = document.getElementById('cfg_z' + i + '_val');
            if (en && en.checked && val) {
                domList.push(parseFloat(val.value) || 1.0);
            }
        }
        return domList.length > 0 ? domList : [1.1, 1.0, 1.05, 0.95, 1.5, 0.9];
    };
})();

/* [split] V229: кусок исходного IIFE (ui_v71.js, строки 27956–28395) → ui_reverse.js */
;(function() {
    if (window._jennyV229Installed__reverse) return;
    window._jennyV229Installed__reverse = true;
    window._jennyV229Installed = true;

    window.startScrub = function(side, speed) {
        var player = document.getElementById('audioPlayer');
        if (!player) return;

        var wasPaused = window.isAudioDeckAPausedByUserV229();
        var wasReversedNow = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
        var wantReverseNow = (side === 'left');
        var cleanSpd = Math.max(0.1, Math.min(16.0, parseFloat(speed) || 1.0));

        window.scrubState.active = true;
        window.scrubState.side = side;
        window.scrubState.speed = cleanSpd;
        window.scrubState.isPhysicallyReversed = wantReverseNow;
        if (!wantReverseNow) {
            window.isReversed = false;
        }

        window.persistedPlaybackSpeed = cleanSpd;
        window.persistedPlaybackSide = side;

        var lockEl = document.getElementById('speedLockIndicator');
        if (lockEl) {
            lockEl.style.display = 'block';
            lockEl.innerText = (window.scrubState.locked ? '🔒' : '🔄') + ' ' + (wantReverseNow ? '⏪' : '⏩') + ' x' + cleanSpd;
        }

        if (wasReversedNow !== wantReverseNow && isFinite(player.duration) && player.duration > 0) {
            var flippedPos = player.duration - player.currentTime;
            if (!isFinite(flippedPos) || flippedPos < 0) flippedPos = 0;
            var clampedFlip = Math.min(player.duration, flippedPos);
            if (typeof window.setExactPlaybackPositionV75 === 'function') {
                window.setExactPlaybackPositionV75(clampedFlip);
            } else {
                player.currentTime = clampedFlip;
            }
        }

        var pitchLockCheckbox = document.getElementById('cfg_pitchLock');
        var isPitchLocked = pitchLockCheckbox ? pitchLockCheckbox.checked : (window.appConfig && window.appConfig.pitchLock);

        try { player.playbackRate = cleanSpd; } catch (e) {}
        player.preservesPitch = Boolean(isPitchLocked && !wantReverseNow && !(window.appConfig && window.appConfig.elasticHoseMode));

        if (wasPaused) {
            // Оставляем Деку А строго на паузе — только обновляем индикатор и шкалу!
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null;
                try { window.studioSourceNode.stop(); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
                window.studioSourceNode = null;
            }
            window.isStudioPlaying = false;
            try { if (!player.paused) player.pause(); } catch (e) {}
            if (isFinite(player.duration) && player.duration > 0 && typeof window.updateProgressUI === 'function') {
                window.updateProgressUI(player.currentTime, player.duration, wantReverseNow);
            }
            return;
        }

        if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
            window.syncMasterPlaybackEngineV59(true);
        }
        if (player.paused) {
            player.play().catch(function(){});
        }
    };

    window.stopScrub = function(keepLockedSpeed) {
        if (keepLockedSpeed === undefined) keepLockedSpeed = false;
        var player = document.getElementById('audioPlayer');
        if (!window.scrubState.active && !window.scrubState.locked && !window.isReversed) return;

        var wasPaused = window.isAudioDeckAPausedByUserV229();
        var wasReversedNow = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

        if (!keepLockedSpeed) {
            window.scrubState.active = false;
            window.scrubState.locked = false;
            window.scrubState.side = null;
            window.scrubState.speed = typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0;
            window.scrubState.isPhysicallyReversed = false;
            window.persistedPlaybackSpeed = null;
            window.persistedPlaybackSide = 'right';

            var lockEl = document.getElementById('speedLockIndicator');
            if (lockEl) lockEl.style.display = 'none';
        } else {
            window.scrubState.active = false;
        }

        var nowReversed = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

        if (player) {
            var baseSpd = (keepLockedSpeed && window.persistedPlaybackSpeed)
                ? window.persistedPlaybackSpeed
                : (typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0);

            if (wasReversedNow !== nowReversed && isFinite(player.duration) && player.duration > 0) {
                var flipped = Math.max(0, Math.min(player.duration, player.duration - player.currentTime));
                if (typeof window.setExactPlaybackPositionV75 === 'function') {
                    window.setExactPlaybackPositionV75(flipped);
                } else {
                    player.currentTime = flipped;
                }
            }

            var pitchLockCheckbox = document.getElementById('cfg_pitchLock');
            var isPitchLocked = pitchLockCheckbox ? pitchLockCheckbox.checked : (window.appConfig && window.appConfig.pitchLock);

            try { player.playbackRate = baseSpd; } catch (e) {}
            player.preservesPitch = Boolean(isPitchLocked && !nowReversed && !(window.appConfig && window.appConfig.elasticHoseMode));

            if (wasPaused) {
                if (window.studioSourceNode) {
                    window.studioSourceNode.onended = null;
                    try { window.studioSourceNode.stop(); } catch (e) {}
                    try { window.studioSourceNode.disconnect(); } catch (e) {}
                    window.studioSourceNode = null;
                }
                window.isStudioPlaying = false;
                try { if (!player.paused) player.pause(); } catch (e) {}
                if (isFinite(player.duration) && player.duration > 0 && typeof window.updateProgressUI === 'function') {
                    window.updateProgressUI(player.currentTime, player.duration, nowReversed);
                }
                return;
            }

            if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            }
            if (player.paused) {
                player.play().catch(function(){});
            }
        }
    };
})();

/* [split] V232: кусок исходного IIFE (ui_v71.js, строки 29055–29548) → ui_reverse.js */
;(function() {
    if (window._jennyV232Installed__reverse) return;
    window._jennyV232Installed__reverse = true;
    window._jennyV232Installed = true;

    // -------------------------------------------------------------------------
    // 2. ЗАЩИТА syncMasterPlaybackEngineV59 И engageDirectRamPitchShiftV70 ОТ САМОПРОИЗВОЛЬНОГО СТАРТА НА ПАУЗЕ
    // -------------------------------------------------------------------------
    var _prevSyncMasterV232 = window.syncMasterPlaybackEngineV59;
    window.syncMasterPlaybackEngineV59 = function(isDraggingArc) {
        var player = document.getElementById('audioPlayer');
        // Если пользователь поставил Деку А на паузу — НИКОГДА не создаём новый AudioBufferSourceNode и не запускаем звук!
        if (window._userPausedV75_2 || (player && player.paused && !window.isStudioPlaying && !window._resumingFromUserPlayV232)) {
            if (window.studioSourceNode) {
                try { window.studioSourceNode.onended = null; } catch (e) {}
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
            return;
        }
        if (window.audioCtx && window.inputMixer && window.inputMixer.gain) {
            try {
                var now = window.audioCtx.currentTime;
                window.inputMixer.gain.cancelScheduledValues(now);
                window.inputMixer.gain.setValueAtTime(1.0, now);
                window.inputMixer.gain.value = 1.0;
            } catch (e) {}
        }
        return typeof _prevSyncMasterV232 === 'function' ? _prevSyncMasterV232.apply(this, arguments) : undefined;
    };

    var bindSingleTrackEndStopGuardV232 = function() {
        var player = document.getElementById('audioPlayer');
        if (!player) return;
        player._v232EndGuardBound = true;
        player.onended = function() {
            // Если пользователь уже поставил на паузу — ничего не переключаем
            if (window._userPausedV75_2) {
                window.forceStopPauseDeckAAudioV232(false);
                return;
            }
            var wasReversed = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
            if (window.scrubState && window.scrubState.active && !window.scrubState.locked) {
                if (typeof window.stopScrub === 'function') window.stopScrub(true);
            }

            var queue = (typeof window.getEffectivePlaybackQueueV73_1 === 'function')
                ? window.getEffectivePlaybackQueueV73_1()
                : (window.currentTrackList || []);
            var audioQueue = (queue || []).filter(function(fn) {
                return !(window.isVideoFileNameV130 && window.isVideoFileNameV130(fn));
            });

            // Если в списке всего 1 песня (или 0 песен) — по окончании песни ОСТАНАВЛИВАЕМ плеер, а не зацикливаем её бесконечно!
            if (audioQueue.length <= 1) {
                window.forceStopPauseDeckAAudioV232(false);
                try { player.currentTime = 0; } catch (e) {}
                if (typeof window.updateProgressUI === 'function') {
                    var dur = (isFinite(player.duration) && player.duration > 0) ? player.duration : (window.studioBuffer ? window.studioBuffer.duration : 0);
                    window.updateProgressUI(0, dur, false);
                }
                return;
            }

            if (wasReversed) {
                window.playPreviousTrack();
            } else {
                window.playNextTrack();
            }
        };
    };
    bindSingleTrackEndStopGuardV232();
    document.addEventListener('DOMContentLoaded', bindSingleTrackEndStopGuardV232);
    setTimeout(bindSingleTrackEndStopGuardV232, 300);
})();

/* [split] V237: кусок исходного IIFE (ui_v71.js, строки 31602–32550) → ui_reverse.js */
;(function() {
    if (window._jennyV237Installed__reverse) return;
    window._jennyV237Installed__reverse = true;
    window._jennyV237Installed = true;

    window.scheduleCoalescedFetchDataV237 = function(delayMs) {
        if (window._coalescedFetchTimerV237) return;
        window._coalescedFetchTimerV237 = setTimeout(function() {
            window._coalescedFetchTimerV237 = null;
            // Don't compete with an active track load into Deck A
            if (window._trackActivelyLoadingToRamV237) {
                window.scheduleCoalescedFetchDataV237(1500);
                return;
            }
            window.fetchData();
        }, delayMs || 2200);
    };

    // -------------------------------------------------------------------------
    // 6. EXTERNAL AUDIO FOCUS LOSS -> CLEAN PAUSE (ICON SWITCHES TO ▶ AT EXACT SECOND SO 1 CLICK ON ▶ RESUMES!)
    //    AND FAST SINGLE-CONNECTION AUDIO / .xFLAC START (NO STUCK "⏳ RAM (пока играет сжатый...)")
    // -------------------------------------------------------------------------
    window.onExternalAudioInterruptV237 = function() {
        var player = document.getElementById('audioPlayer');
        var curTrack = window.currentPlayingTrack || '';
        // Preserve current playback position and cleanly switch Deck A into Paused state (▶ icon!)
        window.forceStopPauseDeckAAudioV232(false);
        var titleEl = document.getElementById('nowPlaying');
        if (titleEl && curTrack) {
            var curTxt = String(titleEl.innerText || '');
            if (curTxt.indexOf('⏳ RAM') !== -1) {
                titleEl.innerText = (window.studioBuffer ? 'RAM ⏸: ' : '🎵 ⏸: ') + curTrack;
            }
        }
        if (player && isFinite(player.currentTime) && player.currentTime > 0) {
            var dur = (window.studioBuffer && window.studioBuffer.duration) || (isFinite(player.duration) ? player.duration : 0);
            var isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
            if (typeof window.updateProgressUI === 'function') window.updateProgressUI(player.currentTime, dur, isRev);
            if (typeof window.updateCenterCurrentTime === 'function') window.updateCenterCurrentTime(player.currentTime, dur, isRev);
        }
    };
})();

/* [split] V243: кусок исходного IIFE (ui_v71.js, строки 35225–35944) → ui_reverse.js */
;(function() {
    if (window._jennyV243Installed__reverse) return;
    window._jennyV243Installed__reverse = true;
    window._jennyV243Installed = true;
    if (typeof window.prevTrack === 'function' && !window.prevTrack._v243Wrapped) {
        window._origPrevTrackV243 = window.prevTrack;
        window.prevTrack = function() {
            var touchAge = performance.now() - (window._lastPhysicalTouchInAppTsV243 || 0);
            if (touchAge > 650 && window._lastActiveMediaSourceV243 !== 'deckA') {
                return window.handleNativeMediaControlV243('prev');
            }
            return window._origPrevTrackV243.apply(this, arguments);
        };
        window.prevTrack._v243Wrapped = true;
    }
})();
/* === END JENNY_V244_VIEWPORT_CLEAN === */

/* ================= BEGIN JENNY_V360_WEBAUDIO_CLOCK_AND_MODAL_SYNC ================= */
/* [split] V360: кусок исходного IIFE (ui_v71.js, строки 35973–36584) → ui_reverse.js */
;(function() {
    if (window._jennyV360ClockAndModalPatchInstalled__reverse) return;
    window._jennyV360ClockAndModalPatchInstalled__reverse = true;
    window._jennyV360ClockAndModalPatchInstalled = true;

    // 1. ЧИСТЫЕ ЧАСЫ WEBAUDIO ДЛЯ ДЕКИ А И ЗАЩИТА ОТ СИРОТСКИХ УЗЛОВ ПРИ ПЕРЕКЛЮЧЕНИИ РКПП (N <-> 1-я)
    function updateDeckAStudioClockFromNowV360(trackSecOverride) {
        var player = document.getElementById('audioPlayer');
        if (!window.audioCtx) return;
        var spd = (typeof window.getActiveTargetSpeedV59 === 'function')
            ? window.getActiveTargetSpeedV59()
            : ((player && player.playbackRate) || 1.0);
        var baseSec = (typeof trackSecOverride === 'number' && isFinite(trackSecOverride))
            ? trackSecOverride
            : ((typeof window.getTruePlaybackTimeV74_2 === 'function') ? window.getTruePlaybackTimeV74_2() : ((player && player.currentTime) || 0));
        var cleanBaseSec = Math.max(0, baseSec);
        window._studioClockV74_1 = {
            active: Boolean(window.isStudioPlaying && window.studioSourceNode),
            startCtxTime: window.audioCtx.currentTime,
            startTrackSec: cleanBaseSec,
            lastKnownSec: cleanBaseSec,
            trackName: window.currentPlayingTrack || '',
            speed: spd
        };
    }

    function stopAllDeckABufferNodesCleanlyV363() {
        if (window.studioSourceNode) {
            try { window.studioSourceNode.onended = null; } catch (e) {}
            try { window.studioSourceNode.stop(0); } catch (e) {}
            try { window.studioSourceNode.disconnect(); } catch (e) {}
            window.studioSourceNode = null;
        }
        if (window._activeBufferSourcesV71 && typeof window._activeBufferSourcesV71.forEach === 'function') {
            window._activeBufferSourcesV71.forEach(function(n) {
                if (!n) return;
                try { n.onended = null; } catch (e) {}
                try { n.stop(0); } catch (e) {}
                try { n.disconnect(); } catch (e) {}
            });
            window._activeBufferSourcesV71.clear();
        }
        window.isStudioPlaying = false;
    }

    function startHoseBufferDirectWebAudioV362(trueSec) {
        var player = document.getElementById('audioPlayer');
        if (!window.studioBuffer || !window.audioCtx || !player) return false;
        var targetSpd = (typeof window.getActiveTargetSpeedV59 === 'function')
            ? window.getActiveTargetSpeedV59()
            : ((player && player.playbackRate) || 1.0);
        var tensionPct = (window.appConfig && window.appConfig.hoseTensionPct !== undefined)
            ? window.appConfig.hoseTensionPct
            : 100;
        var isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
        var baseBuf = isRev ? (window.reversedStudioBuffer || window.studioBuffer) : window.studioBuffer;
        var activeBuf = (typeof window.buildElasticHoseBufferV46 === 'function')
            ? window.buildElasticHoseBufferV46(baseBuf, targetSpd, tensionPct)
            : baseBuf;
        if (!activeBuf) return false;

        if (window.audioCtx && window.inputMixer && window.inputMixer.gain && !window._userPausedV75_2) {
            try {
                var nowM = window.audioCtx.currentTime;
                window.inputMixer.gain.cancelScheduledValues(nowM);
                window.inputMixer.gain.setValueAtTime(1.0, nowM);
                window.inputMixer.gain.value = 1.0;
            } catch (e) {}
        }

        if (window.htmlGain && window.htmlGain.gain) {
            window.htmlGain.gain.value = 0;
        }
        player.preservesPitch = false;

        stopAllDeckABufferNodesCleanlyV363();

        window.studioSourceNode = window.audioCtx.createBufferSource();
        window.studioSourceNode._isHoseSpliced = true;
        window.studioSourceNode.buffer = activeBuf;
        window.studioSourceNode.playbackRate.value = 1.0;
        window.studioSourceNode.connect(window.inputMixer);
        if (window._activeBufferSourcesV71 && typeof window._activeBufferSourcesV71.add === 'function') {
            window._activeBufferSourcesV71.add(window.studioSourceNode);
        }

        var scaledOffset = Math.max(0, trueSec) / Math.max(0.05, targetSpd);
        if (!isFinite(scaledOffset) || scaledOffset < 0) scaledOffset = 0;
        if (scaledOffset >= activeBuf.duration) scaledOffset = Math.max(0, activeBuf.duration - 0.05);

        window.studioSourceNode.start(0, scaledOffset);
        window.isStudioPlaying = true;
        updateDeckAStudioClockFromNowV360(trueSec);

        var badge = document.getElementById('hoseLiveTelemetryV44');
        if (badge && window._hoseSplicerCacheV46) {
            var c = window._hoseSplicerCacheV46;
            badge.innerText = '🐍 V49: Δy=' + ((c.avgSeamErrMv || 0) * 100).toFixed(1) + '% | x' + targetSpd.toFixed(2) + ' (' + (c.lastBuildMs || 0) + 'мс)';
        }
        return true;
    }

    function wrapHoseAndSyncWithTrueClockV360() {
        var origSync = window.syncMasterPlaybackEngineV59;
        if (typeof origSync === 'function' && !origSync._v360ClockWrapped) {
            var wrappedSync = function(isDraggingArc) {
                var player = document.getElementById('audioPlayer');
                var shouldPlay = !window._userPausedV75_2 && Boolean(
                    window.isStudioPlaying ||
                    window._resumingFromUserPlayV232 ||
                    (player && !player.paused)
                );
                var trueSec = (typeof window.getTruePlaybackTimeV74_2 === 'function')
                    ? window.getTruePlaybackTimeV74_2()
                    : ((player && player.currentTime) || 0);

                if (player && shouldPlay && !isDraggingArc && !window.isStudioPlaying) {
                    window._internalSeekSyncGuardV370 = true;
                    try {
                        if (isFinite(trueSec) && trueSec >= 0 && Math.abs((player.currentTime || 0) - trueSec) > 0.35) {
                            player.currentTime = trueSec;
                        }
                    } catch (e) {}
                    setTimeout(function() { window._internalSeekSyncGuardV370 = false; }, 180);
                }

                // Перед перестроением графа/передачи всегда останавливаем прежний studioSourceNode,
                // чтобы при переходе 1-я -> Нейтраль (N) -> 1-я старый буфер НИКОГДА не оставался играть вторым голосом!
                var gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
                if (!isDraggingArc && (gKey === 'neutral' || gKey === 'n' || gKey === 'web-lock' || gKey === 'web-shift')) {
                    stopAllDeckABufferNodesCleanlyV363();
                }

                var res = origSync.apply(this, arguments);

                if (window.studioSourceNode && window._activeBufferSourcesV71 && typeof window._activeBufferSourcesV71.add === 'function') {
                    window._activeBufferSourcesV71.add(window.studioSourceNode);
                }

                if (!isDraggingArc && shouldPlay && window.studioBuffer && window.audioCtx && !window.isStudioPlaying) {
                    var hoseChk = document.getElementById('cfg_elasticHoseV44');
                    var isHose = Boolean(hoseChk ? hoseChk.checked : (window.appConfig && window.appConfig.elasticHoseMode));
                    if ((isHose || gKey === 'jbuf-lock') && gKey !== 'neutral' && gKey !== 'n' && gKey !== 'web-lock' && gKey !== 'web-shift') {
                        startHoseBufferDirectWebAudioV362(trueSec);
                    }
                } else if (!isDraggingArc && window.isStudioPlaying && window.studioSourceNode) {
                    updateDeckAStudioClockFromNowV360(trueSec);
                }
                return res;
            };
            wrappedSync._v360ClockWrapped = true;
            window.syncMasterPlaybackEngineV59 = wrappedSync;
            window.applyElasticHoseBufferLiveV46 = wrappedSync;
        }
    }
    wrapHoseAndSyncWithTrueClockV360();
    setTimeout(wrapHoseAndSyncWithTrueClockV360, 200);
    setTimeout(wrapHoseAndSyncWithTrueClockV360, 600);
})();

/* [split] V369: кусок исходного IIFE (ui_v71.js, строки 36607–37839) → ui_reverse.js */
;(function() {
    if (window._jennyV369Installed__reverse) return;
    window._jennyV369Installed__reverse = true;
    window._jennyV369Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
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
    bindVideoAutoResumeAndStallHealV369();
    window._lastWatchdogProgressTsV369 = 0;
    window._lastWatchdogHealTsV369 = 0;

    window.getEffectiveRamAudioLeadSecV367 = function() {
        var hw = window.getDeckBHardwareAndDspLatencySecV367();
        var userTrim = Number(window._jennyVideoUserAvTrimSecV367 || 0);
        return Math.max(-2.5, Math.min(2.5, hw.totalRamPipelineSec + userTrim));
    };
})();

/* [split] V370: кусок исходного IIFE (ui_v71.js, строки 37843–38397) → ui_reverse.js */
;(function() {
    if (window._jennyV370DeckAFullTrackPatchInstalled__reverse) return;
    window._jennyV370DeckAFullTrackPatchInstalled__reverse = true;
    window._jennyV370DeckAFullTrackPatchInstalled = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    function invalidateDeckAHoseCacheV370() {
        if (window._hoseSplicerCacheV46) {
            window._hoseSplicerCacheV46.srcBuffer = null;
            window._hoseSplicerCacheV46.splicedBuffer = null;
        }
    }

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

        if (window.isStudioPlaying && window.studioSourceNode && clk && clk.active && window.audioCtx && !window._userPausedV75_2) {
            var spd = clk.speed || ((typeof window.getActiveTargetSpeedV59 === 'function') ? window.getActiveTargetSpeedV59() : 1.0);
            var elapsedCtx = Math.max(0, window.audioCtx.currentTime - clk.startCtxTime);
            var est = clk.startTrackSec + elapsedCtx * spd;
            var clampedEst = Math.max(0, Math.min(maxDur - 0.02, est));
            clk.lastKnownSec = clampedEst;
            clk.trackName = window.currentPlayingTrack || '';
            if (!player || player.paused || pTime < 0.08 || Math.abs(pTime - clampedEst) > 0.45) {
                return clampedEst;
            }
        }

        if (clk && typeof clk.lastKnownSec === 'number' && isFinite(clk.lastKnownSec) && clk.trackName === (window.currentPlayingTrack || '')) {
            if (pTime < 0.08 && clk.lastKnownSec > 0.25) {
                return Math.max(0, Math.min(maxDur - 0.02, clk.lastKnownSec));
            }
        }
        return pTime;
    };

    var _origSetExactPosV370 = window.setExactPlaybackPositionV75;
    window.setExactPlaybackPositionV75 = function(targetSec) {
        var cleanSec = Math.max(0, parseFloat(targetSec) || 0);
        if (!window._studioClockV74_1) {
            window._studioClockV74_1 = { active: false, startCtxTime: 0, startTrackSec: 0, speed: 1.0 };
        }
        window._studioClockV74_1.startTrackSec = cleanSec;
        window._studioClockV74_1.lastKnownSec = cleanSec;
        window._studioClockV74_1.trackName = window.currentPlayingTrack || '';
        window._studioClockV74_1.startCtxTime = window.audioCtx ? window.audioCtx.currentTime : 0;
        window._internalSeekSyncGuardV370 = true;
        try {
            if (typeof _origSetExactPosV370 === 'function') {
                return _origSetExactPosV370.apply(this, arguments);
            }
        } finally {
            setTimeout(function() { window._internalSeekSyncGuardV370 = false; }, 60);
        }
    };

    // Усовершенствованный декодер треков через FFmpeg PCM (/api/pcm_chunk_v71/):
    // - Всегда узнаёт точную длительность трека через /api/pcm_meta_v71/ (не полагаясь на грубую оценку по размеру)
    // - Качает куски по 60 сек в 3 параллельных потока, сбрасывая кэш _hoseSplicerCacheV46 после каждого куска
    // - Автоматически подхватывает новые куски на лету без обрыва звука после первых 30 секунд!
    window.decodeHugeTrackToRamV71 = async function(filename, titleEl, player, preMeta) {
        if (window._hugeRamCacheV71 && window._hugeRamCacheV71.name === filename && window._hugeRamCacheV71.buf && window._hugeRamCacheV71.complete) {
            window.studioBuffer = window._hugeRamCacheV71.buf;
            return window.studioBuffer;
        }

        var dur = 0;
        try {
            var mr = await fetch('/api/pcm_meta_v71/' + encodeURIComponent(filename));
            if (mr.ok) {
                var md = await mr.json();
                dur = parseFloat(md.duration) || 0;
            }
        } catch (e) {}
        if (!dur && preMeta && preMeta.duration) {
            dur = parseFloat(preMeta.duration) || 0;
        }
        if (!dur && window.lastData && window.lastData.track_meta && window.lastData.track_meta[filename]) {
            dur = parseFloat(window.lastData.track_meta[filename].dur) || 0;
        }
        if (!dur && player && isFinite(player.duration) && player.duration > 0) {
            dur = player.duration;
        }
        if (dur <= 0) return null;

        var ctxSr = (window.audioCtx && window.audioCtx.sampleRate >= 44100) ? window.audioCtx.sampleRate : 48000;
        var srCandidates = [ctxSr, 48000, 44100];
        var sr = srCandidates[0];
        var totalFrames = Math.floor(dur * sr);
        var audioBuf = null;
        for (var sIdx = 0; sIdx < srCandidates.length; sIdx++) {
            var capList = [dur, 10800, 7200, 5400, 3600, 2400];
            for (var cIdx = 0; cIdx < capList.length; cIdx++) {
                var capDur = capList[cIdx];
                if (capDur > dur && cIdx > 0) continue;
                try {
                    sr = srCandidates[sIdx];
                    totalFrames = Math.floor(Math.min(dur, capDur) * sr);
                    audioBuf = window.audioCtx.createBuffer(2, totalFrames, sr);
                    if (audioBuf) break;
                } catch (allocErr) {}
            }
            if (audioBuf) break;
        }
        if (!audioBuf) return null;

        var chL = audioBuf.getChannelData(0);
        var chR = audioBuf.getChannelData(1);

        var PIECE_SEC = 30;
        var numPieces = Math.max(1, Math.ceil(dur / PIECE_SEC));
        var pieceMap = new Uint8Array(numPieces); // 0 = пусто, 1 = качается, 2 = готов в RAM

        audioBuf._pieceSecV72 = PIECE_SEC;
        audioBuf._pieceMapV72 = pieceMap;
        audioBuf._loadedCountV72 = 0;
        audioBuf._allPiecesLoadedV72 = false;
        audioBuf._trueDurationV72 = dur;

        window._hugeRamCacheV71 = { name: filename, buf: audioBuf, complete: false };
        var pieceFailCounts = new Uint8Array(numPieces);

        var fetchPiece = async function(pIdx) {
            if (pIdx < 0 || pIdx >= numPieces || pieceMap[pIdx] === 2) return true;
            pieceMap[pIdx] = 1;
            var stSec = pIdx * PIECE_SEC;
            var dSec = Math.min(PIECE_SEC, dur - stSec);
            try {
                var url = '/api/pcm_chunk_v71/' + encodeURIComponent(filename) + '?start=' + stSec + '&dur=' + dSec + '&sr=' + sr;
                var res = await fetch(url);
                if (!res.ok) { pieceMap[pIdx] = 0; return false; }
                var ab = await res.arrayBuffer();
                var totalFloats = Math.floor(ab.byteLength / 4);
                var frames = Math.floor(totalFloats / 2);
                if (frames > 0) {
                    var startFrame = Math.min(totalFrames, Math.floor(stSec * sr));
                    var maxCopy = Math.min(frames, totalFrames - startFrame);
                    if (maxCopy > 0) {
                        var leftArr = new Float32Array(ab, 0, frames);
                        var rightArr = new Float32Array(ab, frames * 4, frames);
                        chL.set(leftArr.subarray(0, maxCopy), startFrame);
                        chR.set(rightArr.subarray(0, maxCopy), startFrame);
                    }
                }
                pieceMap[pIdx] = 2;
                audioBuf._loadedCountV72++;
                invalidateDeckAHoseCacheV370();
                if (audioBuf._loadedCountV72 === 1 && window.appConfig && window.appConfig.opt_autoRms) {
                    window.computeBufferAutoGain(audioBuf, window.appConfig.val_autoRms);
                    if (typeof window.updateAutoRmsGainsSmoothV264 === 'function') {
                        window.updateAutoRmsGainsSmoothV264(audioBuf);
                    } else if (typeof window.buildAudioGraph === 'function') {
                        window.buildAudioGraph(false);
                    }
                }
                return true;
            } catch (err) {
                pieceMap[pIdx] = 0;
                return false;
            }
        };

        // 1) Сначала мгновенно загружаем стартовый кусок под курсором,
        //    чтобы музыка заиграла в первые же мгновения!
        var initCurSec = (typeof window.getTruePlaybackTimeV74_2 === 'function') ? window.getTruePlaybackTimeV74_2() : ((player && player.currentTime) || 0);
        var firstPiece = Math.max(0, Math.min(numPieces - 1, Math.floor(initCurSec / PIECE_SEC)));
        await fetchPiece(firstPiece);
        if (window.currentPlayingTrack !== filename) return null;

        if (pieceMap[firstPiece] === 2) {
            window.studioBuffer = audioBuf;
            if (titleEl && window.currentPlayingTrack === filename) {
                titleEl.innerText = 'RAM 🚀 (' + audioBuf._loadedCountV72 + '/' + numPieces + '): ' + filename;
            }
            if (!window._userPausedV75_2 && typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            }
        }

        // 2) V263: Скользящее окно подгрузки: берёт текущую позицию и сразу загружает 1 минуту вперёд (+60с) и 1 минуту назад (-60с)!
        var piecesPerMin = Math.max(2, Math.ceil(60.0 / PIECE_SEC));
        var workerLoop = async function() {
            while (audioBuf._loadedCountV72 < numPieces) {
                if (window.currentPlayingTrack !== filename) return;
                var curSecNow = (typeof window.getTruePlaybackTimeV74_2 === 'function') ? window.getTruePlaybackTimeV74_2() : ((player && player.currentTime) || 0);
                var curP = Math.max(0, Math.min(numPieces - 1, Math.floor(Math.max(0, curSecNow) / PIECE_SEC)));
                var isRevNow = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
                var stepDir = isRevNow ? -1 : 1;
                var pick = -1;

                // +1 минута вперёд по направлению воспроизведения
                for (var fwd = 0; fwd <= piecesPerMin; fwd++) {
                    var candFwd = curP + fwd * stepDir;
                    if (candFwd >= 0 && candFwd < numPieces && pieceMap[candFwd] === 0 && pieceFailCounts[candFwd] < 3) {
                        pick = candFwd;
                        break;
                    }
                }
                // -1 минута назад от текущей позиции
                if (pick === -1) {
                    for (var bwd = 1; bwd <= piecesPerMin; bwd++) {
                        var candBwd = curP - bwd * stepDir;
                        if (candBwd >= 0 && candBwd < numPieces && pieceMap[candBwd] === 0 && pieceFailCounts[candBwd] < 3) {
                            pick = candBwd;
                            break;
                        }
                    }
                }
                // Если окно ±1 минута вокруг курсора уже загружено, в фоне спокойно докачиваем остальные куски трека
                if (pick === -1) {
                    for (var ext = 0; ext < numPieces; ext++) {
                        var candExt = (curP + ext * stepDir + numPieces * 4) % numPieces;
                        if (pieceMap[candExt] === 0 && pieceFailCounts[candExt] < 3) {
                            pick = candExt;
                            break;
                        }
                    }
                }
                if (pick === -1) {
                    break;
                }
                var ok = await fetchPiece(pick);
                if (!ok) {
                    pieceFailCounts[pick] = (pieceFailCounts[pick] || 0) + 1;
                    await new Promise(function(r) { setTimeout(r, 200); });
                } else if (window.currentPlayingTrack === filename) {
                    window.studioBuffer = audioBuf;
                    if (titleEl) {
                        titleEl.innerText = (audioBuf._loadedCountV72 >= numPieces)
                            ? ('RAM 🚀: ' + filename)
                            : ('RAM 🚀 (' + audioBuf._loadedCountV72 + '/' + numPieces + '): ' + filename);
                    }
                    // Пересобираем буфер только если подгрузился кусок прямо под курсором и скорость != 1.0x
                    var spdNow = (typeof window.getActiveTargetSpeedV59 === 'function') ? window.getActiveTargetSpeedV59() : 1.0;
                    if (pick === curP && Math.abs(spdNow - 1.0) > 0.003 && !window._userPausedV75_2 && typeof window.syncMasterPlaybackEngineV59 === 'function') {
                        window.syncMasterPlaybackEngineV59(false);
                    }
                    await new Promise(function(r) { setTimeout(r, 25); });
                }
            }
        };

        await workerLoop();
        if (window.currentPlayingTrack !== filename) return null;

        audioBuf._allPiecesLoadedV72 = true;
        window._hugeRamCacheV71 = { name: filename, buf: audioBuf, complete: true };
        invalidateDeckAHoseCacheV370();

        if (!window.reversedStudioBuffer) {
            try {
                if (typeof window.reverseAudioBufferInDeckAWorker === 'function') {
                    window.reversedStudioBuffer = await window.reverseAudioBufferInDeckAWorker(audioBuf, window.audioCtx);
                }
                if (!window.reversedStudioBuffer && typeof window.cloneAndReverseBuffer === 'function') {
                    window.reversedStudioBuffer = await window.cloneAndReverseBuffer(audioBuf);
                }
            } catch (e) {}
        }
        return audioBuf;
    };

    function bindStudioNodeAutoHealAndEndV370(node, trackName) {
        if (!node || node._v370BoundOnEnded) return;
        node._v370BoundOnEnded = true;
        node.onended = function() {
            if (window.studioSourceNode !== node) return;
            window.studioSourceNode = null;
            if (window._activeBufferSourcesV71 && typeof window._activeBufferSourcesV71.delete === 'function') {
                window._activeBufferSourcesV71.delete(node);
            }
            window.isStudioPlaying = false;

            if (window._userPausedV75_2 || window.currentPlayingTrack !== trackName) {
                if (typeof window.updateTrackListPlayIcons === 'function') window.updateTrackListPlayIcons();
                return;
            }

            var dur = (window.studioBuffer && window.studioBuffer.duration) || 0;
            var curSec = (typeof window.getTruePlaybackTimeV74_2 === 'function') ? window.getTruePlaybackTimeV74_2() : 0;

            // Если буфер остановился раньше конца песни (например, закончился кусок до полной докачки),
            // немедленно перезапускаем воспроизведение с текущей секунды curSec!
            if (dur > 2.0 && curSec < dur - 0.35) {
                if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                    window.syncMasterPlaybackEngineV59(false);
                }
                return;
            }

            // Песня доиграла до конца -> переключаем на следующую!
            var nowAdv = performance.now();
            if (nowAdv - (window._lastAutoAdvanceWallV360 || 0) > 1200) {
                window._lastAutoAdvanceWallV360 = nowAdv;
                var wasRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
                if (wasRev && typeof window.playPreviousTrack === 'function') {
                    window.playPreviousTrack();
                } else if (typeof window.playNextTrack === 'function') {
                    window.playNextTrack();
                }
            }
        };
    }

    function installCleanSyncMasterV370() {
        var prevSync = window.syncMasterPlaybackEngineV59;
        if (typeof prevSync !== 'function' || prevSync._v370Wrapped) return;

        var wrappedV370 = function(isDraggingArc) {
            var player = document.getElementById('audioPlayer');
            var trueSec = (typeof window.getTruePlaybackTimeV74_2 === 'function')
                ? window.getTruePlaybackTimeV74_2()
                : ((player && player.currentTime) || 0);

            if (window.audioCtx && window.inputMixer && window.inputMixer.gain && !window._userPausedV75_2) {
                try {
                    var now = window.audioCtx.currentTime;
                    window.inputMixer.gain.cancelScheduledValues(now);
                    window.inputMixer.gain.setValueAtTime(1.0, now);
                    window.inputMixer.gain.value = 1.0;
                } catch (e) {}
            }

            window._internalSeekSyncGuardV370 = true;
            var res;
            try {
                res = prevSync.apply(this, arguments);
            } finally {
                setTimeout(function() { window._internalSeekSyncGuardV370 = false; }, 60);
            }

            // Если должен играть RAM-движок, а origSync остановил studioSourceNode (потому что <audio> стоит на паузе),
            // гарантированно запускаем/поддерживаем studioSourceNode с позиции trueSec!
            var gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
            var isRamGear = (gKey === 'jbuf-lock' || gKey === 'jbuf-shift' || gKey === 'vinyl-shift');
            var shouldPlay = !window._userPausedV75_2 && Boolean(
                window.isStudioPlaying ||
                window._resumingFromUserPlayV232 ||
                window._trackActivelyLoadingToRamV237 ||
                (player && !player.paused)
            );

            if (!isDraggingArc && shouldPlay && isRamGear && window.studioBuffer && window.audioCtx && (!window.isStudioPlaying || !window.studioSourceNode)) {
                var targetSpd = (typeof window.getActiveTargetSpeedV59 === 'function')
                    ? window.getActiveTargetSpeedV59()
                    : ((player && player.playbackRate) || 1.0);
                var tensionPct = (window.appConfig && window.appConfig.hoseTensionPct !== undefined)
                    ? window.appConfig.hoseTensionPct
                    : 100;
                var isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
                var baseBuf = isRev ? (window.reversedStudioBuffer || window.studioBuffer) : window.studioBuffer;
                if (baseBuf) {
                    var activeBuf = (gKey === 'jbuf-lock' && typeof window.buildElasticHoseBufferV46 === 'function')
                        ? window.buildElasticHoseBufferV46(baseBuf, targetSpd, tensionPct)
                        : baseBuf;
                    var nodeRate = (gKey === 'jbuf-lock') ? 1.0 : targetSpd;
                    if (activeBuf) {
                        if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
                        var node = window.audioCtx.createBufferSource();
                        node._isHoseSpliced = (gKey === 'jbuf-lock');
                        node.buffer = activeBuf;
                        node.playbackRate.value = nodeRate;
                        node.connect(window.inputMixer);
                        if (window._activeBufferSourcesV71 && typeof window._activeBufferSourcesV71.add === 'function') {
                            window._activeBufferSourcesV71.add(node);
                        }
                        var startOffset = (gKey === 'jbuf-lock')
                            ? (Math.max(0, trueSec) / Math.max(0.05, targetSpd))
                            : Math.max(0, trueSec);
                        if (!isFinite(startOffset) || startOffset < 0) startOffset = 0;
                        if (startOffset >= activeBuf.duration) startOffset = Math.max(0, activeBuf.duration - 0.05);
                        window.studioSourceNode = node;
                        window.isStudioPlaying = true;
                        node.start(0, startOffset);
                        window._studioClockV74_1 = {
                            active: true,
                            startCtxTime: window.audioCtx.currentTime,
                            startTrackSec: Math.max(0, trueSec),
                            lastKnownSec: Math.max(0, trueSec),
                            trackName: window.currentPlayingTrack || '',
                            speed: targetSpd
                        };
                    }
                }
            }

            if (window.studioSourceNode && window.isStudioPlaying) {
                bindStudioNodeAutoHealAndEndV370(window.studioSourceNode, window.currentPlayingTrack || '');
            }
            if (typeof window.updateTrackListPlayIcons === 'function') {
                window.updateTrackListPlayIcons();
            }
            return res;
        };

        wrappedV370._v370Wrapped = true;
        window.syncMasterPlaybackEngineV59 = wrappedV370;
        window.applyElasticHoseBufferLiveV46 = wrappedV370;
    }

    installCleanSyncMasterV370();
    setTimeout(installCleanSyncMasterV370, 250);
    setTimeout(installCleanSyncMasterV370, 750);
})();
/* ================= END JENNY_V370_DECK_A_FULL_TRACK_PLAYBACK_AND_PAUSE_IMMUNITY_PATCH ================= */

/* ================= BEGIN JENNY_V371_SEEK_LIVE_DECK_A_SVG_BUFFER_BADGES_AND_PAUSE_SAFE_REV_PATCH ================= */
/* [split] V371: кусок исходного IIFE (ui_v71.js, строки 38401–38673) → ui_reverse.js */
;(function() {
    if (window._jennyV371PatchInstalled__reverse) return;
    window._jennyV371PatchInstalled__reverse = true;
    window._jennyV371PatchInstalled = true;

    // -------------------------------------------------------------------------
    // 1. АККУРАТНЫЕ МИНИ-SVG ИНДИКАТОРЫ ДВУХ БУФЕРОВ ОЗУ НА ВЕРХНЕЙ СТРОЧКЕ
    //    НАД НАЗВАНИЕМ ТРЕКА (#durationTime) ВМЕСТО ДУБЛИРУЮЩЕГОСЯ ВРЕМЕНИ 2:12
    //    И ПОЛНОЕ УДАЛЕНИЕ ЖЁЛТЫХ ЗНАЧКОВ ⏩⏪ ИЗ ТЕКСТА #nowPlaying (75172.mp4 00:02–01:13)
    // -------------------------------------------------------------------------
    function buildDeckARamSvgHeaderHTMLV371(durSec, isRev, hasFwd, hasRev, isLoading) {
        var durStr = (typeof window.formatTimeMMSS === 'function')
            ? window.formatTimeMMSS(durSec)
            : '0:00';

        // Левый SVG-значок: Буфер #2 (Реверс ◀)
        var revColor = hasRev
            ? (isRev ? '#f0abfc' : '#a855f7')
            : (isLoading ? '#eab308' : '#484f58');
        var revBg = hasRev
            ? (isRev ? 'rgba(192,132,252,0.28)' : 'rgba(168,85,247,0.12)')
            : 'rgba(255,255,255,0.04)';
        var revBorder = hasRev
            ? (isRev ? '#e879f9' : 'rgba(168,85,247,0.45)')
            : 'rgba(139,148,158,0.22)';

        // Правый SVG-значок: Буфер #1 (Вперёд ▶)
        var fwdColor = hasFwd
            ? (!isRev ? '#4ade80' : '#a855f7')
            : (isLoading ? '#eab308' : '#484f58');
        var fwdBg = hasFwd
            ? (!isRev ? 'rgba(74,222,128,0.22)' : 'rgba(168,85,247,0.12)')
            : 'rgba(255,255,255,0.04)';
        var fwdBorder = hasFwd
            ? (!isRev ? '#4ade80' : 'rgba(168,85,247,0.45)')
            : 'rgba(139,148,158,0.22)';

        var svgRevChip =
            '<span style="display:inline-flex;align-items:center;gap:2px;padding:0px 4px;border-radius:4px;background:' + revBg + ';border:1px solid ' + revBorder + ';color:' + revColor + ';font-size:9px;font-weight:800;line-height:11px;">' +
                '<svg viewBox="0 0 16 12" width="10" height="8" fill="currentColor" style="display:block;">' +
                    '<path d="M7.5 2L2 6l5.5 4V2z"/>' +
                    '<rect x="9.5" y="2.5" width="1.6" height="7" rx="0.6"/>' +
                    '<rect x="12.5" y="1.5" width="1.6" height="9" rx="0.6"/>' +
                '</svg>' +
                '<span>R</span>' +
            '</span>';

        var svgFwdChip =
            '<span style="display:inline-flex;align-items:center;gap:2px;padding:0px 4px;border-radius:4px;background:' + fwdBg + ';border:1px solid ' + fwdBorder + ';color:' + fwdColor + ';font-size:9px;font-weight:800;line-height:11px;">' +
                '<span>F</span>' +
                '<svg viewBox="0 0 16 12" width="10" height="8" fill="currentColor" style="display:block;">' +
                    '<rect x="1.9" y="1.5" width="1.6" height="9" rx="0.6"/>' +
                    '<rect x="4.9" y="2.5" width="1.6" height="7" rx="0.6"/>' +
                    '<path d="M8.5 2v8L14 6 8.5 2z"/>' +
                '</svg>' +
            '</span>';

        return '<span style="display:inline-flex;align-items:center;gap:6px;vertical-align:middle;">' +
            svgRevChip +
            '<span style="color:#8b949e;font-size:11px;font-weight:700;letter-spacing:0.3px;">' + durStr + '</span>' +
            svgFwdChip +
        '</span>';
    }

    window.updateCenterCurrentTime = function(curSec, durSec, isVisualReverse) {
        var centerTimeEl = document.getElementById('durationTime');
        if (!centerTimeEl) return;
        var npEl = document.getElementById('nowPlaying');
        if (npEl && npEl.innerText && npEl.innerText.indexOf('⏩⏪') !== -1) {
            npEl.innerText = npEl.innerText.replace(/\s*⏩⏪\s*/g, ' ');
        }
        var effDur = (isFinite(durSec) && durSec > 0)
            ? durSec
            : ((window.studioBuffer && window.studioBuffer.duration > 0) ? window.studioBuffer.duration : 0);
        var hasFwd = Boolean(window.studioBuffer);
        var hasRev = Boolean(window.reversedStudioBuffer);
        var isRev = Boolean(isVisualReverse || window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
        var isLoading = Boolean(window._trackActivelyLoadingToRamV237);
        var durRounded = Math.floor(Math.max(0, effDur));
        var sig = [durRounded, isRev ? 1 : 0, hasFwd ? 1 : 0, hasRev ? 1 : 0, isLoading ? 1 : 0].join('|');
        if (centerTimeEl._v371BadgeSig !== sig) {
            centerTimeEl._v371BadgeSig = sig;
            centerTimeEl.innerHTML = buildDeckARamSvgHeaderHTMLV371(effDur, isRev, hasFwd, hasRev, isLoading);
        }
    };

    window.setExactPlaybackPositionV75 = function(targetSec) {
        window.seekDeckAToExactSecondV371(targetSec);
    };

    // Перехватываем прямое присваивание player.currentTime = ... (например, из setupSeekZone в ui_v71.js:27594
    // или из 10x перемотки удержанием боковых таймеров в ui_controls.js:87), чтобы любое внешнее изменение
    // currentTime мгновенно обновляло _studioClockV74_1 и перезапускало studioSourceNode с новой позиции!
    function installAudioPlayerCurrentTimeSeekHookV371() {
        var player = document.getElementById('audioPlayer');
        if (!player || player._v371CurrentTimeHooked) return;
        var proto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
        var desc = proto ? Object.getOwnPropertyDescriptor(proto, 'currentTime') : null;
        if (!desc || typeof desc.get !== 'function' || typeof desc.set !== 'function') return;

        player._v371CurrentTimeHooked = true;
        Object.defineProperty(player, 'currentTime', {
            configurable: true,
            enumerable: true,
            get: function() {
                return desc.get.call(this);
            },
            set: function(val) {
                var numVal = Math.max(0, parseFloat(val) || 0);
                try { desc.set.call(this, numVal); } catch (e) {}
                if (window._internalSeekSyncGuardV370) {
                    return;
                }
                // Внешняя перемотка (тап по #seekZone, 10x удержание таймера или разворот реверса)!
                var activeSpd = (typeof window.getActiveTargetSpeedV59 === 'function')
                    ? window.getActiveTargetSpeedV59()
                    : ((this && this.playbackRate) || 1.0);
                window._pendingSeekTargetV75 = { sec: numVal, ts: performance.now() };
                window._studioClockV74_1 = {
                    active: Boolean(!window._userPausedV75_2 && (window.isStudioPlaying || !this.paused)),
                    startCtxTime: window.audioCtx ? window.audioCtx.currentTime : 0,
                    startTrackSec: numVal,
                    lastKnownSec: numVal,
                    trackName: window.currentPlayingTrack || '',
                    speed: activeSpd
                };
                if (!window._userPausedV75_2 && window.isStudioPlaying && window.studioSourceNode) {
                    // Сбрасываем текущий узел, чтобы следующий же вызов syncMasterPlaybackEngineV59(false)
                    // (на следующей строке handleTapSeek) гарантированно запустил звук с новой точки numVal!
                    try { window.studioSourceNode.onended = null; } catch (e) {}
                    try { window.studioSourceNode.stop(0); } catch (e) {}
                    try { window.studioSourceNode.disconnect(); } catch (e) {}
                    window.studioSourceNode = null;
                    if (window._activeBufferSourcesV71 && typeof window._activeBufferSourcesV71.clear === 'function') {
                        window._activeBufferSourcesV71.clear();
                    }
                    window.isStudioPlaying = false;
                    window._resumingFromUserPlayV232 = true;
                    setTimeout(function() { window._resumingFromUserPlayV232 = false; }, 40);
                }
            }
        });
    }
    installAudioPlayerCurrentTimeSeekHookV371();
    setTimeout(installAudioPlayerCurrentTimeSeekHookV371, 150);
    setTimeout(installAudioPlayerCurrentTimeSeekHookV371, 500);
})();
/* ================= END JENNY_V371_SEEK_LIVE_DECK_A_SVG_BUFFER_BADGES_AND_PAUSE_SAFE_REV_PATCH ================= */

/* ================= BEGIN JENNY_V372_CLEAN_ARCHITECTURE_PATCH ================= */
/* [split] V372: кусок исходного IIFE (ui_v71.js, строки 38677–39278) → ui_reverse.js */
;(function() {
    if (window._jennyV372CleanArchInstalled__reverse) return;
    window._jennyV372CleanArchInstalled__reverse = true;
    window._jennyV372CleanArchInstalled = true;

    // -------------------------------------------------------------------------
    // 1. EXACT MIRROR INVERSION FOR AUDIO DECK A FORWARD (F ▶) <-> REVERSE (◀ R)
    //    (75208.mp4 00:07–00:39: 0:29 | -2:07 -> -0:29 | 2:07)
    // -------------------------------------------------------------------------
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

    window.toggleReverseMode = function(targetReversed) {
        if (!window.appConfig || !window.appConfig.studioMode || !window.studioBuffer) return;
        if (typeof window.prioritizeRamPieceAtCursorV72 === 'function') {
            window.prioritizeRamPieceAtCursorV72();
        }
        var player = document.getElementById('audioPlayer');
        var wasReversedNow = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
        var wantReversed = (targetReversed !== undefined) ? Boolean(targetReversed) : !wasReversedNow;
        var dur = getEffectiveDeckADurationV372();
        var curBefore = (typeof window.getTruePlaybackTimeV74_2 === 'function')
            ? window.getTruePlaybackTimeV74_2()
            : ((player && player.currentTime) || 0);

        if (!wantReversed) {
            if (!wasReversedNow && !(window.scrubState && (window.scrubState.active || window.scrubState.locked))) return;
            window.isReversed = false;
            if (window.scrubState) {
                window.scrubState.active = false;
                window.scrubState.locked = false;
                window.scrubState.side = null;
                window.scrubState.isPhysicallyReversed = false;
            }
            window.persistedPlaybackSpeed = null;
            window.persistedPlaybackSide = 'right';
            var lockEl = document.getElementById('speedLockIndicator');
            if (lockEl) lockEl.style.display = 'none';

            var newFwdSec = curBefore;
            if (wasReversedNow && dur > 0) {
                newFwdSec = Math.max(0, Math.min(dur - 0.02, dur - curBefore));
            }
            var baseSpd = typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0;
            if (player) {
                try { player.playbackRate = baseSpd; } catch (e) {}
            }
            if (typeof window.seekDeckAToExactSecondV371 === 'function') {
                window.seekDeckAToExactSecondV371(newFwdSec);
            }
            if (dur > 0 && typeof window.updateProgressUI === 'function') {
                window.updateProgressUI(newFwdSec, dur, false);
            }
            return;
        }

        if (!window.reversedStudioBuffer && !window.studioBuffer) return;
        if (wasReversedNow && !(window.scrubState && (window.scrubState.active || window.scrubState.locked))) return;

        if (window.scrubState && (window.scrubState.active || window.scrubState.locked)) {
            window.scrubState.active = false;
            window.scrubState.locked = false;
            window.scrubState.side = null;
            window.scrubState.isPhysicallyReversed = false;
            window.persistedPlaybackSpeed = null;
            window.persistedPlaybackSide = 'right';
            var lockEl2 = document.getElementById('speedLockIndicator');
            if (lockEl2) lockEl2.style.display = 'none';
        }

        window.isReversed = true;
        var newRevSec = curBefore;
        if (!wasReversedNow && dur > 0) {
            newRevSec = Math.max(0, Math.min(dur - 0.02, dur - curBefore));
        }
        var baseSpd2 = typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0;
        if (player) {
            try { player.playbackRate = baseSpd2; } catch (e) {}
        }
        if (typeof window.seekDeckAToExactSecondV371 === 'function') {
            window.seekDeckAToExactSecondV371(newRevSec);
        }
        if (dur > 0 && typeof window.updateProgressUI === 'function') {
            window.updateProgressUI(newRevSec, dur, true);
        }
    };

    var _origStartScrubV372 = window.startScrub;
    if (typeof _origStartScrubV372 === 'function') {
        window.startScrub = function(side, speed) {
            var wasRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
            var wantRev = (side === 'left');
            var dur = getEffectiveDeckADurationV372();
            var curBefore = (typeof window.getTruePlaybackTimeV74_2 === 'function') ? window.getTruePlaybackTimeV74_2() : 0;
            if (wasRev !== wantRev && dur > 0) {
                var flipped = Math.max(0, Math.min(dur - 0.02, dur - curBefore));
                window.isReversed = false;
                if (window.scrubState) window.scrubState.isPhysicallyReversed = wantRev;
                if (typeof window.seekDeckAToExactSecondV371 === 'function') {
                    window.seekDeckAToExactSecondV371(flipped);
                }
            }
            return _origStartScrubV372.apply(this, arguments);
        };
    }

    var _origStopScrubV372 = window.stopScrub;
    if (typeof _origStopScrubV372 === 'function') {
        window.stopScrub = function(keepLockedSpeed) {
            var wasRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
            var nowRev = Boolean(window.isReversed || (keepLockedSpeed && window.scrubState && window.scrubState.isPhysicallyReversed));
            var dur = getEffectiveDeckADurationV372();
            var curBefore = (typeof window.getTruePlaybackTimeV74_2 === 'function') ? window.getTruePlaybackTimeV74_2() : 0;
            if (wasRev !== nowRev && dur > 0) {
                var flipped = Math.max(0, Math.min(dur - 0.02, dur - curBefore));
                if (typeof window.seekDeckAToExactSecondV371 === 'function') {
                    window.seekDeckAToExactSecondV371(flipped);
                }
            }
            return _origStopScrubV372.apply(this, arguments);
        };
    }
})();
