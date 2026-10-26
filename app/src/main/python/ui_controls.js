// =========================================================================
// 🕹️ UI_CONTROLS.JS (БОКОВЫЕ ТАЙМЕРЫ, ПРОГРЕСС И ПАРАНОИДАЛЬНЫЕ КНОПКИ)
// =========================================================================

window.toggleReverseMode = function(targetReversed) {
    if (!window.appConfig.studioMode || !window.studioBuffer) return;
    const player = document.getElementById('audioPlayer');
    const wasReversedNow = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

    // Если нажали правый таймер (targetReversed = false), всегда сбрасываем любой скраб и реверс в нормальный режим вперёд!
    if (!targetReversed) {
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
        const lockEl = document.getElementById('speedLockIndicator');
        if (lockEl) lockEl.style.display = 'none';

        if (wasReversedNow && player && isFinite(player.duration)) {
            player.currentTime = Math.max(0, Math.min(player.duration, player.duration - player.currentTime));
        }
        const baseSpd = typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0;
        if (player) player.playbackRate = baseSpd;
        if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
            window.syncMasterPlaybackEngineV59(false);
        }
        if (player && isFinite(player.duration) && typeof window.updateProgressUI === 'function') {
            window.updateProgressUI(player.currentTime, player.duration, false);
        }
        return;
    }

    // Если нажали левый таймер (targetReversed = true)
    if (!window.reversedStudioBuffer) return;
    if (wasReversedNow && !(window.scrubState && (window.scrubState.active || window.scrubState.locked))) return;

    if (window.scrubState && (window.scrubState.active || window.scrubState.locked)) {
        window.scrubState.active = false;
        window.scrubState.locked = false;
        window.scrubState.side = null;
        window.scrubState.isPhysicallyReversed = false;
        window.persistedPlaybackSpeed = null;
        window.persistedPlaybackSide = 'right';
        const lockEl = document.getElementById('speedLockIndicator');
        if (lockEl) lockEl.style.display = 'none';
    }

    window.isReversed = true;
    if (!wasReversedNow && player && isFinite(player.duration)) {
        player.currentTime = Math.max(0, Math.min(player.duration, player.duration - player.currentTime));
    }
    const baseSpd = typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0;
    if (player) player.playbackRate = baseSpd;

    if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
        window.syncMasterPlaybackEngineV59(false);
    }
    if (player && isFinite(player.duration) && typeof window.updateProgressUI === 'function') {
        window.updateProgressUI(player.currentTime, player.duration, true);
    }
};

window.setupTimeBlockControls = function() {
    const leftBlock = document.getElementById('leftTimeBlock');
    const rightBlock = document.getElementById('rightTimeBlock');
    const player = document.getElementById('audioPlayer');
    if (!leftBlock || !rightBlock) return;

    let pressTimer = null;
    let isLongPress = false;
    let jumpInterval = null;
    let wasPlayingBeforeJump = false;

    const startSilent10xSeek = (dirSign) => {
        if (!player) return;
        wasPlayingBeforeJump = !player.paused;
        player.pause();
        if (jumpInterval) clearInterval(jumpInterval);
        jumpInterval = setInterval(() => {
            if (!isFinite(player.duration) || player.duration <= 0) return;
            const isVisualReverse = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
            // dirSign = -1 (влево к началу песни), +1 (вправо к концу песни)
            const bufferStep = isVisualReverse ? (-dirSign * 1.0) : (dirSign * 1.0);
            player.currentTime = Math.max(0, Math.min(player.duration - 0.05, player.currentTime + bufferStep));
            if (typeof window.updateProgressUI === 'function') {
                window.updateProgressUI(player.currentTime, player.duration, isVisualReverse);
            }
        }, 100);
    };

    const stopSilent10xSeek = () => {
        if (jumpInterval) {
            clearInterval(jumpInterval);
            jumpInterval = null;
        }
        if (player && wasPlayingBeforeJump) {
            player.play().then(() => {
                if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                    window.syncMasterPlaybackEngineV59(false);
                }
            }).catch(() => {});
        } else if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
            window.syncMasterPlaybackEngineV59(false);
        }
    };

    leftBlock.addEventListener('touchstart', (e) => {
        isLongPress = false;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
            isLongPress = true;
            try { navigator.vibrate(30); } catch(e){}
            startSilent10xSeek(-1);
        }, 160);
    }, {passive: true});

    leftBlock.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
        if (isLongPress) {
            stopSilent10xSeek();
        } else {
            window.toggleReverseMode(true);
        }
    });

    leftBlock.addEventListener('touchcancel', () => {
        clearTimeout(pressTimer);
        if (isLongPress) stopSilent10xSeek();
    });

    rightBlock.addEventListener('touchstart', (e) => {
        isLongPress = false;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
            isLongPress = true;
            try { navigator.vibrate(30); } catch(e){}
            startSilent10xSeek(+1);
        }, 160);
    }, {passive: true});

    rightBlock.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
        if (isLongPress) {
            stopSilent10xSeek();
        } else {
            window.toggleReverseMode(false);
        }
    });

    rightBlock.addEventListener('touchcancel', () => {
        clearTimeout(pressTimer);
        if (isLongPress) stopSilent10xSeek();
    });
};

window.updateProgressUI = function(currentTime, duration, isReverseVisual) {
    let pFill = document.getElementById('progressFill');
    let cTime = document.getElementById('currentTime');
    let rTime = document.getElementById('remainingTime');
    
    if (pFill && isFinite(duration) && duration > 0) {
        let perc = (currentTime / duration) * 100;
        if (isReverseVisual) {
            pFill.style.left = 'auto';
            pFill.style.right = '0';
        } else {
            pFill.style.right = 'auto';
            pFill.style.left = '0';
        }
        pFill.style.width = perc + '%';
    }
    
    if (isFinite(duration)) {
        if (isReverseVisual) {
            if (cTime) cTime.innerText = '-' + window.formatTime(duration - currentTime);
            if (rTime) rTime.innerText = window.formatTime(currentTime);
        } else {
            if (cTime) cTime.innerText = window.formatTime(currentTime);
            if (rTime) rTime.innerText = '-' + window.formatTime(duration - currentTime);
        }
    }
};

window.formatTime = function(seconds) { 
    let min = Math.floor(seconds / 60); 
    let sec = Math.floor(seconds % 60); 
    return min + ':' + (sec < 10 ? '0' + sec : sec); 
};

document.addEventListener("DOMContentLoaded", () => {
    const ppBtn = document.getElementById('playPauseBtn');
    
    if (ppBtn) {
        ppBtn.removeAttribute('onclick'); 
        let ppTimer = null;
        let ppFired = false;
        
        ppBtn.addEventListener('touchstart', (e) => {
            ppFired = false;
            ppTimer = setTimeout(() => {
                ppFired = true;
                try { navigator.vibrate(50); } catch(err){}
                
                ['settingsModal', 'favModal', 'eqModal'].forEach(m => {
                    let el = document.getElementById(m);
                    if (el) el.classList.remove('open');
                    let btn = document.getElementById('btn-' + m);
                    if (btn) btn.style.color = '#58a6ff';
                });
                
                if (!window.currentPlayingTrack) return;
                
                let isFav = (window.currentListContext === 'fav');
                if (isFav) {
                    document.getElementById('favModal').classList.add('open');
                    let b = document.getElementById('btn-favModal');
                    if (b) b.style.color = '#fff';
                }
                
                let safeId = encodeURIComponent(window.currentPlayingTrack).replace(/[^a-zA-Z0-9]/g, '');
                let targetId = isFav ? `track-fav-${safeId}` : `track-main-${safeId}`;
                
                setTimeout(() => {
                    let el = document.getElementById(targetId);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.style.transition = 'transform 0.3s';
                        el.style.transform = 'scale(1.03)';
                        setTimeout(() => el.style.transform = 'scale(1)', 300);
                    }
                }, 100);
            }, 500); 
        }, {passive: true});
        
        ppBtn.addEventListener('touchmove', () => clearTimeout(ppTimer), {passive: true});
        
        ppBtn.addEventListener('touchend', (e) => {
            clearTimeout(ppTimer);
            if (!ppFired) {
                if (typeof window.togglePlay === 'function') window.togglePlay();
            }
            if (e.cancelable) e.preventDefault(); 
        }, {passive: false});
    }
});
