// =========================================================================
// 🔄 UI_SCRUB_ENGINE.JS (ЛОГИКА ИЗМЕНЕНИЯ СКОРОСТИ И РЕВЕРСА)
// =========================================================================

window.startScrub = function(side, speed) {
    const player = document.getElementById('audioPlayer');
    if (!player) return; 
    
    let wasAlreadyReversed = window.scrubState.isPhysicallyReversed;
    
    window.scrubState.active = true;
    window.scrubState.side = side;
    window.scrubState.speed = speed;

    let lockEl = document.getElementById('speedLockIndicator');
    if (lockEl) {
        lockEl.style.display = 'block';
        lockEl.innerText = `${window.scrubState.locked ? '🔒' : '🔄'} ${side === 'left' ? '⏪' : '⏩'} x${speed}`;
    }

    let pitchLockCheckbox = document.getElementById('cfg_pitchLock');
    let isPitchLocked = pitchLockCheckbox ? pitchLockCheckbox.checked : false;

    if (side === 'right') {
        if (wasAlreadyReversed && window.studioSourceNode) {
             window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){} window.studioSourceNode.disconnect();
        }
        
        window.scrubState.isPhysicallyReversed = false;
        player.playbackRate = speed;
        player.preservesPitch = isPitchLocked;

        if (window.appConfig.studioMode && window.studioBuffer) {
            if (isPitchLocked) {
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
                 player.currentTime = startPos; 
                 window.studioSourceNode.start(0, startPos);
                 window.isStudioPlaying = true;
            }
        }
        if (player.paused) player.play().catch(e=>{});
    }
};


window.stopScrub = function() {
    const player = document.getElementById('audioPlayer');
    if (!window.scrubState.active && !window.scrubState.locked) return;
    
    window.scrubState.active = false;
    window.scrubState.locked = false;
    window.scrubState.side = null;

    let lockEl = document.getElementById('speedLockIndicator');
    if (lockEl) lockEl.style.display = 'none';

    let pitchLockCheckbox = document.getElementById('cfg_pitchLock');
    let isPitchLocked = pitchLockCheckbox ? pitchLockCheckbox.checked : false;

    if (player) {
        let baseSpd = typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0; 

        if (window.scrubState.isPhysicallyReversed) {
            player.currentTime = player.duration - player.currentTime; 
            window.scrubState.isPhysicallyReversed = false;
        }
        
        player.playbackRate = baseSpd;
        player.preservesPitch = isPitchLocked;
        
        if (window.studioSourceNode) {
            try { window.studioSourceNode.stop(); } catch(e){}
            window.studioSourceNode.disconnect();
        }

        if (window.appConfig.studioMode && window.studioBuffer) {
            if (window.htmlGain) window.htmlGain.gain.value = 0;
            window.studioSourceNode = window.audioCtx.createBufferSource();
            window.studioSourceNode.buffer = window.isReversed ? window.reversedStudioBuffer : window.studioBuffer; 
            window.studioSourceNode.playbackRate.value = baseSpd; 
            window.studioSourceNode.connect(window.inputMixer);
            window.studioSourceNode.start(0, player.currentTime);
            window.isStudioPlaying = true;
        } else {
             if (window.htmlGain) window.htmlGain.gain.value = 1;
        }
        if (player.paused) player.play().catch(e=>{});
    }
};
