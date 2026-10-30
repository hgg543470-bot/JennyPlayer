window.decodeHugeTrackToRamV71 = async function(filename, titleEl, player) {
    let dur = (player && isFinite(player.duration) && player.duration > 0) ? player.duration : 0;
    let sr = 44100;
    if (!dur) {
        const mr = await fetch('/api/pcm_meta_v71/' + encodeURIComponent(filename));
        const md = await mr.json();
        dur = parseFloat(md.duration) || 0;
        sr = parseInt(md.sr, 10) || 44100;
    }
    if (dur <= 0) return null;

    // Если трек > 90 минут, используем 44100 Гц стерео (3.8 ГБ на 3.3 часа), чтобы уложиться в 32-битный индекс TypedArray
    if (dur * sr > 520000000) {
        sr = 32000;
    }
    const totalFrames = Math.floor(dur * sr);
    const audioBuf = window.audioCtx.createBuffer(2, totalFrames, sr);
    const chL = audioBuf.getChannelData(0);
    const chR = audioBuf.getChannelData(1);

    const chunkSec = 900; // По 15 минут за 1 блок
    let writtenFrames = 0;

    for (let st = 0; st < dur; st += chunkSec) {
        if (window.currentPlayingTrack !== filename) return null;
        const pct = Math.min(99, Math.round((st / dur) * 100));
        if (titleEl) titleEl.innerText = `⏳ RAM 16GB [${pct}%]: ` + filename;

        const url = `/api/pcm_chunk_v71/${encodeURIComponent(filename)}?start=${st}&dur=${chunkSec}&sr=${sr}`;
        const res = await fetch(url);
        if (!res.ok) break;
        const ab = await res.arrayBuffer();
        const floats = new Float32Array(ab);
        const framesInChunk = Math.floor(floats.length / 2);
        const maxCopy = Math.min(framesInChunk, totalFrames - writtenFrames);

        for (let i = 0; i < maxCopy; i++) {
            chL[writtenFrames + i] = floats[i * 2];
            chR[writtenFrames + i] = floats[i * 2 + 1];
        }
        writtenFrames += maxCopy;
        await new Promise(r => setTimeout(r, 15));
    }
    return audioBuf;
};


window.smoothStudioFadeIn = function() {
    if (window.audioCtx && window.inputMixer) {
        let now = window.audioCtx.currentTime;
        window.inputMixer.gain.cancelScheduledValues(now);
        window.inputMixer.gain.setValueAtTime(0.0001, now);
        window.inputMixer.gain.linearRampToValueAtTime(1.0, now + 0.014);
    }
};

window.formatTimeMMSS = function(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    let totalSec = Math.floor(sec);
    let m = Math.floor(totalSec / 60);
    let s = totalSec % 60;
    return m + ":" + (s < 10 ? "0" + s : s);
};

window.updateCenterCurrentTime = function(curSec, durSec, isVisualReverse) {
    const centerTimeEl = document.getElementById('durationTime');
    if (!centerTimeEl) return;
    if (!isFinite(durSec) || durSec <= 0) {
        centerTimeEl.innerText = "0:00";
        return;
    }
    let realElapsed = isVisualReverse ? Math.max(0, durSec - curSec) : Math.max(0, curSec);
    centerTimeEl.innerText = window.formatTimeMMSS(realElapsed);
    centerTimeEl.style.color = "#c9d1d9";
};

window.getTargetPlaybackSpeed = function() {
    const player = document.getElementById('audioPlayer');
    if (window.scrubState && (window.scrubState.locked || window.scrubState.active) && window.scrubState.speed) {
        return parseFloat(window.scrubState.speed) || 1.0;
    }
    if (window.persistedPlaybackSpeed && window.persistedPlaybackSpeed !== 10.0) {
        return parseFloat(window.persistedPlaybackSpeed) || 1.0;
    }
    if (player && player.playbackRate && player.playbackRate !== 1.0 && player.playbackRate !== 10.0) {
        return player.playbackRate;
    }
    return typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0;
};

window.playNextTrack = function() {
    if (!window.currentTrackList || window.currentTrackList.length === 0) return;
    if (!window.currentPlayingTrack) return;

    let currentIndex = window.currentTrackList.indexOf(window.currentPlayingTrack);
    if (currentIndex !== -1 && currentIndex + 1 < window.currentTrackList.length) {
        let nextTrack = window.currentTrackList[currentIndex + 1];
        let ctx = (window.currentTrackList === window.favorites) ? 'fav' : 'main';
        window.playTrack(nextTrack, ctx);
    }
};

window.playPreviousTrack = function() {
    if (!window.currentTrackList || window.currentTrackList.length === 0) return;
    if (!window.currentPlayingTrack) return;

    let currentIndex = window.currentTrackList.indexOf(window.currentPlayingTrack);
    if (currentIndex > 0) {
        let prevTrack = window.currentTrackList[currentIndex - 1];
        let ctx = (window.currentTrackList === window.favorites) ? 'fav' : 'main';
        window.playTrack(prevTrack, ctx);
    }
};

window.cloneAndReverseBuffer = async function(originalBuffer) {
    if (!originalBuffer) return null;
    let newBuffer = window.audioCtx.createBuffer(
        originalBuffer.numberOfChannels,
        originalBuffer.length,
        originalBuffer.sampleRate
    );
    for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
        let oldData = originalBuffer.getChannelData(channel);
        let newData = newBuffer.getChannelData(channel);
        for (let i = 0; i < originalBuffer.length; i++) {
            newData[i] = oldData[originalBuffer.length - 1 - i];
        }
    }
    return newBuffer;
};

window.playTrack = async function(filename, listContext = 'main') {
    if(typeof window.initAudioBoost === 'function') window.initAudioBoost();
    if(typeof window.applyEQSettings === 'function') window.applyEQSettings();
    if(typeof window.changeVolume === 'function') window.changeVolume();

    let targetSpeed = window.getTargetPlaybackSpeed();
    let keepLocked = Boolean((window.scrubState && window.scrubState.locked) || (window.persistedPlaybackSpeed && window.persistedPlaybackSpeed !== 1.0));
    let activeSide = (window.scrubState && window.scrubState.side) || window.persistedPlaybackSide || 'right';

    window.currentPlayingTrack = filename;
    window.currentListContext = listContext;
    if(typeof window.updateTrackListPlayIcons === 'function') window.updateTrackListPlayIcons();

    if (listContext === 'fav') {
        window.currentTrackList = window.favorites;
    } else if (listContext === 'main' && window.lastData) {
        window.currentTrackList = window.isShowingAllTracks ? (window.lastData.all_tracks || []) : (window.lastData.session_tracks || []);
    }

    const player = document.getElementById('audioPlayer');
    const titleEl = document.getElementById('nowPlaying');

    if(player) { player.pause(); if (player.src && player.src.startsWith('blob:')) URL.revokeObjectURL(player.src); }
    if (window.studioSourceNode) { window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){} }
    window.isStudioPlaying = false;
    window.studioBuffer = null;
    window.reversedStudioBuffer = null;
    window.reconstructedMasterBufferV67 = null;
    window.reconstructedReversedBufferV67 = null;
    window.currentTrackRevMapV67 = null;

    if (keepLocked) {
        window.scrubState.locked = true;
        window.scrubState.active = false;
        window.scrubState.speed = targetSpeed;
        window.scrubState.side = activeSide;
        window.scrubState.isPhysicallyReversed = (activeSide === 'left');
        let lockEl = document.getElementById('speedLockIndicator');
        if (lockEl) {
            lockEl.style.display = 'block';
            lockEl.innerText = `🔒 ${activeSide === 'left' ? '⏪' : '⏩'} x${targetSpeed}`;
        }
    } else if (window.scrubState && window.scrubState.active) {
        if(typeof window.stopScrub === 'function') window.stopScrub(false);
    }

    let isRevMode = window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed);
    if(typeof window.updateProgressUI === 'function') window.updateProgressUI(0, 100, isRevMode);
    window.updateCenterCurrentTime(0, 0, isRevMode);

    if ('mediaSession' in navigator) {
        let cleanFileName = filename.replace(/\.(opus|m4a|mp3)$/i, '');
        navigator.mediaSession.metadata = new MediaMetadata({ title: cleanFileName, artist: "🔥 HACKED BY JENNY 🔥" });

        navigator.mediaSession.setActionHandler('play', () => window.togglePlay());
        navigator.mediaSession.setActionHandler('pause', () => window.togglePlay());
        navigator.mediaSession.setActionHandler('previoustrack', () => window.playPreviousTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => window.playNextTrack());
    }

    try {
        if(titleEl) titleEl.innerText = "⏳ Загрузка: " + filename;

        const response = await fetch('/api/media/' + encodeURIComponent(filename));
        const blob = await response.blob();
        window._lastTrackBlob = blob;
        window._lastTrackBlobName = filename;

        let pitchLockCheckbox = document.getElementById('cfg_pitchLock');
        let isPitchLocked = pitchLockCheckbox ? pitchLockCheckbox.checked : (window.appConfig.pitchLock === true);

        if (window.htmlGain) {
            if (window.appConfig.studioMode && isRevMode) {
                window.htmlGain.gain.value = 0;
            } else {
                window.htmlGain.gain.value = 1;
            }
        }

        if (player) {
            player.src = URL.createObjectURL(blob);
            player.playbackRate = targetSpeed;
            player.preservesPitch = isPitchLocked;

            if (!isRevMode || !window.appConfig.studioMode) {
                 player.play().catch(e => {});
            }
        }

        if (window.appConfig.studioMode) {
            if(titleEl) titleEl.innerText = "⏳ RAM (пока играет сжатый): " + filename;
        } else {
            if(titleEl) titleEl.innerText = filename;
        }

        // Всегда декодируем PCM-буфер в фоне: это даёт живой осциллограф в любом режиме и 0 мс ожидание при включении RAM/Шланга!
        let decodedBuffer = null;
        try {
            let arrayBuffer = await blob.arrayBuffer();
            decodedBuffer = await window.audioCtx.decodeAudioData(arrayBuffer);
        } catch (decErr) {
            try {
                decodedBuffer = await window.decodeHugeTrackToRamV71(filename, titleEl, player);
            } catch (hugeErr) {
                decodedBuffer = null;
            }
        }
        if (!decodedBuffer) {
            if (window.currentPlayingTrack === filename) {
                if (window.htmlGain) window.htmlGain.gain.value = 1.0;
                if (player && player.paused) player.play().catch(e => {});
                if (titleEl) titleEl.innerText = filename;
                if (typeof window.updateTrackListPlayIcons === 'function') window.updateTrackListPlayIcons();
            }
            return;
        }

        if (window.currentPlayingTrack === filename) {
            window.studioBuffer = decodedBuffer;
            if (typeof window.loadTrackReversibleDataV67 === 'function') {
                window.loadTrackReversibleDataV67(filename, decodedBuffer);
            }
            if (window.appConfig && window.appConfig.opt_autoRms && window.preAmpNode && typeof window.computeBufferAutoGain === 'function') {
                window.preAmpNode.gain.value = 0.6 * window.computeBufferAutoGain(decodedBuffer, window.appConfig.val_autoRms);
            }
            let nowRev = window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed);
            let isHugeTrack = (decodedBuffer.duration > 900);
            if (nowRev && !isHugeTrack) {
                window.reversedStudioBuffer = await window.cloneAndReverseBuffer(decodedBuffer);
            } else if (!isHugeTrack) {
                setTimeout(async () => {
                    if (window.currentPlayingTrack === filename && !window.reversedStudioBuffer) {
                        window.reversedStudioBuffer = await window.cloneAndReverseBuffer(decodedBuffer);
                    }
                }, 50);
            }

            if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            }
            if (titleEl) {
                titleEl.innerText = (window.appConfig && window.appConfig.studioMode ? "RAM 🚀: " : "") + filename;
            }
        }
        if (typeof window.updateTrackListPlayIcons === 'function') window.updateTrackListPlayIcons();
    } catch(error) {
        if(window.currentPlayingTrack === filename && titleEl) titleEl.innerText = "❌ Ошибка загрузки";
    }
};

window.togglePlay = function() {
    const player = document.getElementById('audioPlayer');
    if (!player || !player.src) { if (window.topTrack) window.playTrack(window.topTrack, 'main'); return; }
    if(typeof window.initAudioBoost === 'function') window.initAudioBoost();

    if (player.paused) player.play();
    else player.pause();
};

document.addEventListener("DOMContentLoaded", () => {
    const player = document.getElementById('audioPlayer');

    if (typeof window.updateProgressUI === 'function' && !window._progressUIWrapped) {
        const origUpdateProgress = window.updateProgressUI;
        window.updateProgressUI = function(cur, dur, isRev) {
            origUpdateProgress(cur, dur, isRev);
            window.updateCenterCurrentTime(cur, dur, isRev);
        };
        window._progressUIWrapped = true;
    }

    if(player) {
        player.onplay = () => {
            let btn = document.getElementById('playPauseBtn');
            if(btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";

            let targetSpd = window.getTargetPlaybackSpeed();
            if (Math.abs(player.playbackRate - targetSpd) > 0.001 && player.playbackRate !== 10.0) {
                player.playbackRate = targetSpd;
            }

            if (window.studioSourceNode) { window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){} window.studioSourceNode.disconnect(); }

            if (window.appConfig.studioMode && window.studioBuffer && window.htmlGain && window.htmlGain.gain.value === 0 && !(window.appConfig && window.appConfig.elasticHoseMode)) {
                let isVisualReverse = window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed);
                window.studioSourceNode = window.audioCtx.createBufferSource();
                window.studioSourceNode.buffer = isVisualReverse ? window.reversedStudioBuffer : window.studioBuffer;
                window.studioSourceNode.playbackRate.value = player.playbackRate;
                window.studioSourceNode.connect(window.inputMixer);
                window.studioSourceNode.start(0, player.currentTime);
                window.isStudioPlaying = true;
            }
            if (typeof window.updateTrackListPlayIcons === 'function') window.updateTrackListPlayIcons();
        };

        player.onpause = () => {
            let btn = document.getElementById('playPauseBtn');
            if(btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";

            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){}
                window.isStudioPlaying = false;
            }
            if (typeof window.updateTrackListPlayIcons === 'function') window.updateTrackListPlayIcons();
        };

        player.onseeking = () => {
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){}
                window.isStudioPlaying = false;
            }
        };

        player.onseeked = () => {
            if (window.appConfig.studioMode && window.studioBuffer && window.htmlGain && window.htmlGain.gain.value === 0 && !(window.appConfig && window.appConfig.elasticHoseMode)) {
                if (!player.paused) {
                    if (window.studioSourceNode) { window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){} }
                    let isVisualReverse = window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed);
                    window.studioSourceNode = window.audioCtx.createBufferSource();
                    window.studioSourceNode.buffer = isVisualReverse ? window.reversedStudioBuffer : window.studioBuffer;
                    window.studioSourceNode.playbackRate.value = player.playbackRate;
                    window.studioSourceNode.connect(window.inputMixer);
                    window.studioSourceNode.start(0, player.currentTime);
                    window.isStudioPlaying = true;
                }
            }
        };

        player.onratechange = () => {
            if (window.appConfig.studioMode && window.studioSourceNode) {
                if (window.appConfig.elasticHoseMode && window.studioSourceNode._isHoseSpliced && player.playbackRate !== 10.0) {
                    window.studioSourceNode.playbackRate.value = 1.0;
                } else {
                    window.studioSourceNode.playbackRate.value = player.playbackRate;
                }
            }
        };

        player.onended = () => {
            let wasReversed = window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed);

            if (window.scrubState && window.scrubState.active && !window.scrubState.locked) {
                if(typeof window.stopScrub === 'function') window.stopScrub(true);
            }

            if (wasReversed) {
                window.playPreviousTrack();
            } else {
                window.playNextTrack();
            }
        };

        player.ontimeupdate = () => {
            if (isFinite(player.duration)) {
                let isVisualReverse = window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed);
                if(typeof window.updateProgressUI === 'function') window.updateProgressUI(player.currentTime, player.duration, isVisualReverse);
                window.updateCenterCurrentTime(player.currentTime, player.duration, isVisualReverse);
            }
        };
    }
});

window.lastNotifSync = 0;

window.syncAndroidNotification = function(force) {
    if (!window.AndroidBridge || typeof window.AndroidBridge.updateMediaState !== 'function') return;
    const now = Date.now();
    if (!force && now - window.lastNotifSync < 1000) return;
    window.lastNotifSync = now;

    const player = document.getElementById('audioPlayer');
    if (!player || !window.currentPlayingTrack) return;

    let cleanTitle = window.currentPlayingTrack.replace(/\.(opus|m4a|mp3|wav|flac|ogg)$/i, '');
    let dur = isFinite(player.duration) && player.duration > 0 ? player.duration : 0;
    let cur = isFinite(player.currentTime) ? player.currentTime : 0;
    let isRev = window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed);
    let displayPos = (isRev && dur > 0) ? Math.max(0, dur - cur) : cur;
    let spd = player.playbackRate || 1.0;

    try {
        window.AndroidBridge.updateMediaState(cleanTitle, !player.paused, displayPos, dur, spd);
    } catch (e) {}
};

window.seekFromNotification = function(targetSec) {
    const player = document.getElementById('audioPlayer');
    if (!player || !isFinite(player.duration) || player.duration <= 0) return;
    let isRev = window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed);
    let realTarget = isRev ? (player.duration - targetSec) : targetSec;
    player.currentTime = Math.max(0, Math.min(player.duration, realTarget));
    window.syncAndroidNotification(true);
};

document.addEventListener("DOMContentLoaded", () => {
    const player = document.getElementById('audioPlayer');
    if (player) {
        player.addEventListener('play', () => window.syncAndroidNotification(true));
        player.addEventListener('pause', () => window.syncAndroidNotification(true));
        player.addEventListener('seeked', () => window.syncAndroidNotification(true));
        player.addEventListener('loadedmetadata', () => window.syncAndroidNotification(true));
        player.addEventListener('timeupdate', () => window.syncAndroidNotification(false));
    }
});
