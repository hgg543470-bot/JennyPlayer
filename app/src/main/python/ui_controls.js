// =========================================================================
// 🕹️ UI_CONTROLS.JS (БОКОВЫЕ ТАЙМЕРЫ, ПРОГРЕСС И ПАРАНОИДАЛЬНЫЕ КНОПКИ)
// =========================================================================

window.toggleReverseMode = function(targetReversed) {
    if (!window.appConfig.studioMode || !window.studioBuffer) return;
    if (window.isReversed === targetReversed) return;
    
    if (window.scrubState && (window.scrubState.active || window.scrubState.locked)) {
        if(typeof window.stopScrub === 'function') window.stopScrub();
    }
    if (!window.reversedStudioBuffer) return;
    
    window.isReversed = targetReversed;
    
    const player = document.getElementById('audioPlayer');
    if (window.studioSourceNode) {
        try { window.studioSourceNode.stop(); } catch(e){}
        window.studioSourceNode.disconnect();
    }
    window.studioSourceNode = window.audioCtx.createBufferSource();
    window.studioSourceNode.buffer = targetReversed ? window.reversedStudioBuffer : window.studioBuffer;
    window.studioSourceNode.playbackRate.value = player ? player.playbackRate : 1.0;
    window.studioSourceNode.connect(window.inputMixer);
    
    if (player && isFinite(player.duration)) player.currentTime = player.duration - player.currentTime; 
    
    let startPos = player ? player.currentTime : 0; 
    window.studioSourceNode.start(0, startPos);
};

window.setupTimeBlockControls = function() {
    const leftBlock = document.getElementById('leftTimeBlock');
    const rightBlock = document.getElementById('rightTimeBlock');
    const player = document.getElementById('audioPlayer');
    if (!leftBlock || !rightBlock) return;

    let pressTimer = null;
    let isLongPress = false;
    let jumpInterval = null;

    leftBlock.addEventListener('touchstart', (e) => {
        isLongPress = false;
        pressTimer = setTimeout(() => {
            isLongPress = true;
            try { navigator.vibrate(30); } catch(e){}
            if (player) {
                player.pause();
                jumpInterval = setInterval(() => {
                    player.currentTime = Math.max(0, player.currentTime - 1.0);
                    let isVisualReverse = window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed);
                    window.updateProgressUI(player.currentTime, player.duration, isVisualReverse);
                }, 100);
            }
        }, 160);
    }, {passive: true});

    leftBlock.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
        if (isLongPress) {
            clearInterval(jumpInterval);
            if (player) player.play();
        } else {
            window.toggleReverseMode(true);
        }
    });

    leftBlock.addEventListener('touchcancel', () => { clearTimeout(pressTimer); clearInterval(jumpInterval); });

    rightBlock.addEventListener('touchstart', (e) => {
        isLongPress = false;
        pressTimer = setTimeout(() => {
            isLongPress = true;
            try { navigator.vibrate(30); } catch(e){}
            if (player) {
                player.playbackRate = 10.0;
                if (window.studioSourceNode) window.studioSourceNode.playbackRate.value = 10.0;
            }
        }, 160);
    }, {passive: true});

    rightBlock.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
        if (isLongPress) {
            if (player) {
                let baseSpd = typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0;
                player.playbackRate = baseSpd;
                if (window.studioSourceNode) window.studioSourceNode.playbackRate.value = baseSpd;
            }
        } else {
            window.toggleReverseMode(false);
        }
    });

    rightBlock.addEventListener('touchcancel', () => { 
        clearTimeout(pressTimer); 
        if (player) {
            let baseSpd = typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0;
            player.playbackRate = baseSpd;
            if (window.studioSourceNode) window.studioSourceNode.playbackRate.value = baseSpd;
        } 
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
