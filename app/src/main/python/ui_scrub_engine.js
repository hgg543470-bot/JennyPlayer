window.persistedPlaybackSpeed = null;
window.persistedPlaybackSide = 'right';

window.startScrub = function(side, speed) {
    const player = document.getElementById('audioPlayer');
    if (!player) return;

    const wasReversedNow = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    const wantReverseNow = (side === 'left');

    window.scrubState.active = true;
    window.scrubState.side = side;
    window.scrubState.speed = speed;
    window.scrubState.isPhysicallyReversed = wantReverseNow;
    if (!wantReverseNow) {
        window.isReversed = false;
    }

    window.persistedPlaybackSpeed = speed;
    window.persistedPlaybackSide = side;

    let lockEl = document.getElementById('speedLockIndicator');
    if (lockEl) {
        lockEl.style.display = 'block';
        lockEl.innerText = `${window.scrubState.locked ? '🔒' : '🔄'} ${wantReverseNow ? '⏪' : '⏩'} x${speed}`;
    }

    if (wasReversedNow !== wantReverseNow && isFinite(player.duration) && player.duration > 0) {
        let flippedPos = player.duration - player.currentTime;
        if (!isFinite(flippedPos) || flippedPos < 0) flippedPos = 0;
        player.currentTime = Math.min(player.duration, flippedPos);
    }

    let pitchLockCheckbox = document.getElementById('cfg_pitchLock');
    let isPitchLocked = pitchLockCheckbox ? pitchLockCheckbox.checked : (window.appConfig && window.appConfig.pitchLock);

    try { player.playbackRate = Math.max(0.1, Math.min(16.0, speed)); } catch(e) {}
    player.preservesPitch = Boolean(isPitchLocked && !wantReverseNow && !(window.appConfig && window.appConfig.elasticHoseMode));

    if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
        window.syncMasterPlaybackEngineV59(true);
    }

    if (player.paused) player.play().catch(e => {});
};

window.stopScrub = function(keepLockedSpeed = false) {
    const player = document.getElementById('audioPlayer');
    if (!window.scrubState.active && !window.scrubState.locked && !window.isReversed) return;

    const wasReversedNow = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

    if (!keepLockedSpeed) {
        window.scrubState.active = false;
        window.scrubState.locked = false;
        window.scrubState.side = null;
        window.scrubState.speed = typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0;
        window.scrubState.isPhysicallyReversed = false;
        window.persistedPlaybackSpeed = null;
        window.persistedPlaybackSide = 'right';

        let lockEl = document.getElementById('speedLockIndicator');
        if (lockEl) lockEl.style.display = 'none';
    } else {
        window.scrubState.active = false;
    }

    const nowReversed = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

    if (player) {
        let baseSpd = (keepLockedSpeed && window.persistedPlaybackSpeed)
            ? window.persistedPlaybackSpeed
            : (typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0);

        if (wasReversedNow !== nowReversed && isFinite(player.duration) && player.duration > 0) {
            player.currentTime = Math.max(0, Math.min(player.duration, player.duration - player.currentTime));
        }

        let pitchLockCheckbox = document.getElementById('cfg_pitchLock');
        let isPitchLocked = pitchLockCheckbox ? pitchLockCheckbox.checked : (window.appConfig && window.appConfig.pitchLock);

        player.playbackRate = baseSpd;
        player.preservesPitch = Boolean(isPitchLocked && !nowReversed && !(window.appConfig && window.appConfig.elasticHoseMode));

        if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
            window.syncMasterPlaybackEngineV59(false);
        }
        if (player.paused) player.play().catch(e => {});
    }
};
