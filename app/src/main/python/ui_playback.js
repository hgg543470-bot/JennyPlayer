// =========================================================================
// ▶️ UI_PLAYBACK.JS (ЛОГИКА ПЛЕЕРА И ВОСПРОИЗВЕДЕНИЯ)
// =========================================================================

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

// Функция attachRAMEnded вырезана, так как HTML5-плеер справляется сам как бесшумный секундомер

window.playTrack = async function(filename, listContext = 'main') {
    if(typeof window.initAudioBoost === 'function') window.initAudioBoost(); 
    if(typeof window.applyEQSettings === 'function') window.applyEQSettings(); 
    if(typeof window.changeVolume === 'function') window.changeVolume();   
    
    window.currentPlayingTrack = filename; 
    window.currentListContext = listContext; 
    if(typeof window.fetchData === 'function') window.fetchData(); 
    
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
    
    if (window.scrubState && (window.scrubState.active || window.scrubState.locked)) {
        if(typeof window.stopScrub === 'function') window.stopScrub();
    }
    
    if(typeof window.updateProgressUI === 'function') window.updateProgressUI(0, 100, window.isReversed); 

    if ('mediaSession' in navigator) {
        let cleanFileName = filename.replace(/\.(opus|m4a|mp3)$/i, ''); 
        navigator.mediaSession.metadata = new MediaMetadata({ title: cleanFileName, artist: "🔥 HACKED BY JENNY 🔥" });
        
        navigator.mediaSession.setActionHandler('play', () => window.togglePlay());
        navigator.mediaSession.setActionHandler('pause', () => window.togglePlay());
        navigator.mediaSession.setActionHandler('previoustrack', () => window.playPreviousTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => window.playNextTrack());
        
        navigator.mediaSession.setActionHandler('seekbackward', () => {
            let p = document.getElementById('audioPlayer');
            if(p) p.currentTime = Math.max(0, p.currentTime - 10);
        });
        navigator.mediaSession.setActionHandler('seekforward', () => {
            let p = document.getElementById('audioPlayer');
            if(p) p.currentTime = Math.min(p.duration, p.currentTime + 10);
        });
    }

    try {
        if(titleEl) titleEl.innerText = "⏳ Загрузка: " + filename;
        
        const response = await fetch('/api/media/' + encodeURIComponent(filename));
        const blob = await response.blob();
        
        if (window.htmlGain) {
            if (window.appConfig.studioMode && window.isReversed) {
                window.htmlGain.gain.value = 0; 
            } else {
                window.htmlGain.gain.value = 1; 
            }
        }
        
        if (player) {
            player.src = URL.createObjectURL(blob);
            player.playbackRate = typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0; 
            player.preservesPitch = window.appConfig.pitchLock === true; 
            
            if (!window.isReversed || !window.appConfig.studioMode) {
                 player.play().catch(e => {});
            }
        }
        
        if (window.appConfig.studioMode) {
            if(titleEl) titleEl.innerText = "⏳ RAM (пока играет сжатый): " + filename;
            
            let arrayBuffer = await blob.arrayBuffer();
            let decodedBuffer = await window.audioCtx.decodeAudioData(arrayBuffer);
            
            if (window.currentPlayingTrack === filename) {
                window.studioBuffer = decodedBuffer;
                
                if (window.isReversed) {
                    window.reversedStudioBuffer = await window.cloneAndReverseBuffer(decodedBuffer);
                    if (player && player.paused) {
                         player.play().catch(e => {});
                    }
                    if (window.htmlGain) window.htmlGain.gain.value = 0;
                    
                     if (player && !player.paused) {
                        if (window.studioSourceNode) { window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){} window.studioSourceNode.disconnect(); }
                        window.studioSourceNode = window.audioCtx.createBufferSource();
                        window.studioSourceNode.buffer = window.reversedStudioBuffer;
                        window.studioSourceNode.playbackRate.value = player.playbackRate;
                        window.studioSourceNode.connect(window.inputMixer);
                        
                        // 🚀 ИСПРАВЛЕН БАГ МАТЕМАТИКИ: В реверсе буфер сам по себе перевернут. 
                        // Начинаем просто с player.currentTime (которое равно 0 при загрузке трека).
                        let startPos = player.currentTime; 
                        if (!isFinite(startPos) || startPos < 0) startPos = 0;
                        window.studioSourceNode.start(0, startPos);
                        window.isStudioPlaying = true;
                    }
                    
                } else {
                    setTimeout(async () => {
                        window.reversedStudioBuffer = await window.cloneAndReverseBuffer(decodedBuffer);
                    }, 50);
                    
                    if (window.htmlGain) window.htmlGain.gain.value = 0; 
                
                    if (player && !player.paused) {
                        if (window.studioSourceNode) { window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){} window.studioSourceNode.disconnect(); }
                        window.studioSourceNode = window.audioCtx.createBufferSource();
                        
                        window.studioSourceNode.buffer = window.studioBuffer;
                        window.studioSourceNode.playbackRate.value = player.playbackRate;
                        window.studioSourceNode.connect(window.inputMixer);
                        
                        let startPos = player.currentTime;
                        if (!isFinite(startPos) || startPos < 0) startPos = 0;
                        window.studioSourceNode.start(0, startPos);
                        
                        window.isStudioPlaying = true;
                    }
                }
                
                if(titleEl) titleEl.innerText = "RAM 🚀: " + filename;
            }
        } else {
            if(titleEl) titleEl.innerText = filename;
        }
    } catch(error) {
        if(titleEl) titleEl.innerText = "❌ Ошибка загрузки";
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
    
    if(player) {
        player.onplay = () => { 
            let btn = document.getElementById('playPauseBtn');
            if(btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'; 
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
            
            if (window.studioSourceNode) { window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){} window.studioSourceNode.disconnect(); }
            
            if (window.appConfig.studioMode && window.studioBuffer && window.htmlGain && window.htmlGain.gain.value === 0) {
                let isVisualReverse = window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed);
                window.studioSourceNode = window.audioCtx.createBufferSource();
                window.studioSourceNode.buffer = isVisualReverse ? window.reversedStudioBuffer : window.studioBuffer;
                window.studioSourceNode.playbackRate.value = player.playbackRate;
                window.studioSourceNode.connect(window.inputMixer);
                window.studioSourceNode.start(0, player.currentTime);
                window.isStudioPlaying = true;
            }
        };
        
        player.onpause = () => { 
            let btn = document.getElementById('playPauseBtn');
            if(btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'; 
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
            
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){}
                window.isStudioPlaying = false;
            }
        };
        
        player.onseeking = () => {
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null; try { window.studioSourceNode.stop(); } catch(e){}
                window.isStudioPlaying = false;
            }
        };
        
        player.onseeked = () => {
            if (window.appConfig.studioMode && window.studioBuffer && window.htmlGain && window.htmlGain.gain.value === 0) {
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
                window.studioSourceNode.playbackRate.value = player.playbackRate;
            }
        };

        player.onended = () => { 
            // 🚀 ИСПРАВЛЕН БАГ ПОТЕРИ КОНТЕКСТА РЕВЕРСА:
            // Сначала запоминаем, играл ли трек задом наперед до того, как удалим все статусы скраббинга
            let wasReversed = window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed);
            
            if (window.scrubState && (window.scrubState.active || window.scrubState.locked)) {
                if(typeof window.stopScrub === 'function') window.stopScrub();
            }
            
            if (wasReversed) {
                // Если мы дошли до конца через дугу скраббинга, форсируем глобальный реверс для следующего трека
                if (!window.isReversed) window.isReversed = true; 
                window.playPreviousTrack();
            } else {
                window.playNextTrack(); 
            }
        };
        
        player.ontimeupdate = () => { 
            if (isFinite(player.duration)) { 
                let isVisualReverse = window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed);
                if(typeof window.updateProgressUI === 'function') window.updateProgressUI(player.currentTime, player.duration, isVisualReverse);
            } 
        };
    }
});

// =========================================================================
// 📱 НАТИВНАЯ ШТОРКА ANDROID 16 (БЕЗ ВМЕШАТЕЛЬСТВА В ЛОГИКУ ПЛЕЕРА)
// =========================================================================
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
