window.persistedPlaybackSpeed = null;
window.persistedPlaybackSide = 'right';

window.startScrub = function(side, speed) {
    const player = document.getElementById('audioPlayer');
    if (!player) return;

    let wasAlreadyReversed = window.scrubState.isPhysicallyReversed;

    window.scrubState.active = true;
    window.scrubState.side = side;
    window.scrubState.speed = speed;

    window.persistedPlaybackSpeed = speed;
    window.persistedPlaybackSide = side;

    let lockEl = document.getElementById('speedLockIndicator');
    if (lockEl) {
        lockEl.style.display = 'block';
        lockEl.innerText = `${window.scrubState.locked ? '🔒' : '🔄'} ${side === 'left' ? '⏪' : '⏩'} x${speed}`;
    }

    let pitchLockCheckbox = document.getElementById('cfg_pitchLock');
    let isPitchLocked = pitchLockCheckbox ? pitchLockCheckbox.checked : (window.appConfig && window.appConfig.pitchLock);

    if (side === 'right') {
        if (wasAlreadyReversed && window.studioSourceNode) {
             window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){} window.studioSourceNode.disconnect();
        }

        window.scrubState.isPhysicallyReversed = false;
        player.playbackRate = speed;
        player.preservesPitch = isPitchLocked;

        if (window.appConfig.studioMode && window.studioBuffer) {
            if (isPitchLocked && speed !== 1.0) {
                if (window.htmlGain) window.htmlGain.gain.value = 1;
                window.isStudioPlaying = false;
                if (window.studioSourceNode) { window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){} window.studioSourceNode.disconnect(); }
            } else {
                if (window.htmlGain) window.htmlGain.gain.value = 0;

                if (!wasAlreadyReversed && window.isStudioPlaying && window.studioSourceNode) {
                     window.studioSourceNode.playbackRate.value = speed;
                } else {
                     if (window.studioSourceNode) { window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){} window.studioSourceNode.disconnect(); }
                     window.studioSourceNode = window.audioCtx.createBufferSource();
                     window.studioSourceNode.buffer = window.studioBuffer;
                     window.studioSourceNode.playbackRate.value = speed;
                     window.studioSourceNode.connect(window.inputMixer);
                     window.studioSourceNode.start(0, player.currentTime);
                     window.isStudioPlaying = true;
                }
            }
        } else {
            if (window.htmlGain) window.htmlGain.gain.value = 1;
        }

        if (player.paused) player.play().catch(e=>{});

    } else {
        if (!wasAlreadyReversed && window.studioSourceNode) {
             window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){} window.studioSourceNode.disconnect();
        }

        window.scrubState.isPhysicallyReversed = true;
        player.playbackRate = speed;

        if (window.appConfig.studioMode && window.reversedStudioBuffer) {
            if (window.htmlGain) window.htmlGain.gain.value = 0;

            if (wasAlreadyReversed && window.isStudioPlaying && window.studioSourceNode) {
                 window.studioSourceNode.playbackRate.value = speed;
            } else {
                 if (window.studioSourceNode) { window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){} window.studioSourceNode.disconnect(); }
                 window.studioSourceNode = window.audioCtx.createBufferSource();
                 window.studioSourceNode.buffer = window.reversedStudioBuffer;
                 window.studioSourceNode.playbackRate.value = speed;
                 window.studioSourceNode.connect(window.inputMixer);

                 let startPos = player.duration - player.currentTime;
                 if (!isFinite(startPos) || startPos < 0) startPos = 0;
                 player.currentTime = startPos;
                 window.studioSourceNode.start(0, startPos);
                 window.isStudioPlaying = true;
            }
        }
        if (player.paused) player.play().catch(e=>{});
    }
};

window.stopScrub = function(keepLockedSpeed = false) {
    const player = document.getElementById('audioPlayer');
    if (!window.scrubState.active && !window.scrubState.locked) return;

    if (!keepLockedSpeed) {
        window.scrubState.active = false;
        window.scrubState.locked = false;
        window.scrubState.side = null;
        window.persistedPlaybackSpeed = null;
        window.persistedPlaybackSide = 'right';

        let lockEl = document.getElementById('speedLockIndicator');
        if (lockEl) lockEl.style.display = 'none';
    } else {
        window.scrubState.active = false;
    }

    let pitchLockCheckbox = document.getElementById('cfg_pitchLock');
    let isPitchLocked = pitchLockCheckbox ? pitchLockCheckbox.checked : (window.appConfig && window.appConfig.pitchLock);

    if (player) {
        let baseSpd = (keepLockedSpeed && window.persistedPlaybackSpeed)
            ? window.persistedPlaybackSpeed
            : (typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0);

        if (window.scrubState.isPhysicallyReversed && !keepLockedSpeed) {
            if (isFinite(player.duration)) {
                player.currentTime = Math.max(0, player.duration - player.currentTime);
            }
            window.scrubState.isPhysicallyReversed = false;
        }

        player.playbackRate = baseSpd;
        player.preservesPitch = isPitchLocked;

        if (window.studioSourceNode) {
            try { window.studioSourceNode.stop(); } catch(e){}
            window.studioSourceNode.disconnect();
        }

        if (window.appConfig.studioMode && window.studioBuffer) {
            let isRev = window.isReversed || window.scrubState.isPhysicallyReversed;
            if (isPitchLocked && baseSpd !== 1.0 && !isRev) {
                if (window.htmlGain) window.htmlGain.gain.value = 1;
                window.isStudioPlaying = false;
            } else {
                if (window.htmlGain) window.htmlGain.gain.value = 0;
                window.studioSourceNode = window.audioCtx.createBufferSource();
                window.studioSourceNode.buffer = isRev ? window.reversedStudioBuffer : window.studioBuffer;
                window.studioSourceNode.playbackRate.value = baseSpd;
                window.studioSourceNode.connect(window.inputMixer);
                window.studioSourceNode.start(0, player.currentTime);
                window.isStudioPlaying = true;
            }
        } else {
             if (window.htmlGain) window.htmlGain.gain.value = 1;
        }
        if (player.paused) player.play().catch(e=>{});
    }
};
