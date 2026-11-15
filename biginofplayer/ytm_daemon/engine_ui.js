// =========================================================================
// 🖥️ ENGINE_UI.JS (ГЛАВНЫЙ ЦИКЛ, ОТРИСОВКА СПИСКОВ И ПЛЕЕР)
// =========================================================================

window.currentPlayingTrack = null;
window.currentTrackList = [];
window.currentListContext = 'main'; 
window.lastData = null; 
window.isShowingAllTracks = false;

window.isReversed = false; 
window.scrubState = { active: false, locked: false, side: null, speed: 1.0, isPhysicallyReversed: false };

(function () {
    let script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/eruda";
    document.body.appendChild(script);
    script.onload = function () {
        eruda.init();
        console.log("🔥 Eruda Console Injected! Готов к тестам.");
    }
})();

document.addEventListener("DOMContentLoaded", () => {
    const bools = {
        'cfg_studioMode': 'studioMode', 'cfg_amoledMode': 'amoledMode',
        'cfg_firEnabled': 'firEnabled', 'cfg_multiBandEnabled': 'multiBandEnabled',
        'cfg_limiterEnabled': 'limiterEnabled', 'cfg_eqEnabled': 'eqEnabled',
        'cfg_boosterEnabled': 'boosterEnabled',
        'cfg_autoSaveScrub': 'autoSaveScrub',
        'cfg_leftHandedMode': 'leftHandedMode'
    };
    for (let [id, key] of Object.entries(bools)) {
        let el = document.getElementById(id);
        if (el && window.appConfig[key] !== undefined) el.checked = window.appConfig[key];
    }
    
    if (document.getElementById('cfg_logMode')) document.getElementById('cfg_logMode').value = window.appConfig.logMode;
    if (document.getElementById('cfg_boosterPower')) document.getElementById('cfg_boosterPower').value = window.appConfig.boosterPower;
    if (document.getElementById('cfg_defaultScrubSpeed')) document.getElementById('cfg_defaultScrubSpeed').value = window.appConfig.defaultScrubSpeed || 2.0;
    
    // 🚀 ИНИЦИАЛИЗАЦИЯ КАСТОМНЫХ ЗОН
    let defZones = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
    if (!window.appConfig.scrubZones || window.appConfig.scrubZones.length !== 6) {
        window.appConfig.scrubZones = defZones.map(v => ({val: v, en: true}));
    }
    for(let i=0; i<6; i++) {
        let z = window.appConfig.scrubZones[i];
        let enEl = document.getElementById('cfg_z' + (i+1) + '_en');
        let valEl = document.getElementById('cfg_z' + (i+1) + '_val');
        if (enEl) enEl.checked = z.en;
        if (valEl) valEl.value = z.val;
    }

    let timerEl = document.getElementById('timerInput');
    if (timerEl && window.appConfig.daemonTimer !== undefined) {
        timerEl.value = window.appConfig.daemonTimer;
        fetch(`/api/timer/${window.appConfig.daemonTimer}`, {method: 'POST'}).catch(()=>{});
    }
    
    if (window.appConfig.firSettings) {
        if(document.getElementById('cfg_fir_gain')) document.getElementById('cfg_fir_gain').value = window.appConfig.firSettings.gain;
        if(document.getElementById('cfg_fir_decay')) document.getElementById('cfg_fir_decay').value = window.appConfig.firSettings.decay;
    }
    if (window.appConfig.multiBandSettings) {
        if(document.getElementById('cfg_mb_low')) document.getElementById('cfg_mb_low').value = window.appConfig.multiBandSettings.low;
        if(document.getElementById('cfg_mb_high')) document.getElementById('cfg_mb_high').value = window.appConfig.multiBandSettings.high;
    }
    if (window.appConfig.limiterSettings) {
        if(document.getElementById('cfg_lim_threshold')) document.getElementById('cfg_lim_threshold').value = window.appConfig.limiterSettings.threshold;
        if(document.getElementById('cfg_lim_knee')) document.getElementById('cfg_lim_knee').value = window.appConfig.limiterSettings.knee;
        if(document.getElementById('cfg_lim_ratio')) document.getElementById('cfg_lim_ratio').value = window.appConfig.limiterSettings.ratio;
        if(document.getElementById('cfg_lim_attack')) document.getElementById('cfg_lim_attack').value = window.appConfig.limiterSettings.attack;
        if(document.getElementById('cfg_lim_release')) document.getElementById('cfg_lim_release').value = window.appConfig.limiterSettings.release;
    }
    
    if(typeof window.setupFolderLongPress === 'function') window.setupFolderLongPress(); 
    if(typeof window.applyVolumeSettings === 'function') window.applyVolumeSettings();
    if(typeof window.applyEQSettings === 'function') window.applyEQSettings();
    
    window.setupSeekZone();
    window.setupTimeBlockControls(); 
});

// 🚀 ФУНКЦИИ УПРАВЛЕНИЯ ЗОНАМИ СКРАББИНГА
window.saveZonesToConfig = function() {
    if (!window.appConfig.scrubZones) window.appConfig.scrubZones = [];
    for(let i=1; i<=6; i++) {
        let enEl = document.getElementById('cfg_z' + i + '_en');
        let valEl = document.getElementById('cfg_z' + i + '_val');
        if (enEl && valEl) {
            window.appConfig.scrubZones[i-1] = {
                en: enEl.checked,
                val: parseFloat(valEl.value) || 1.0
            };
        }
    }
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.updateSettings === 'function') window.updateSettings();
};

window.checkZones = function(idx) {
    let activeCount = 0;
    for(let i=1; i<=6; i++) {
        let el = document.getElementById('cfg_z' + i + '_en');
        if(el && el.checked) activeCount++;
    }
    if(activeCount === 0) {
        alert("Эй! Ну оставь хоть одну зону активной! 😅");
        let target = document.getElementById('cfg_z' + idx + '_en');
        if(target) target.checked = true;
    }
    window.saveZonesToConfig();
};

window.resetScrubZones = function() {
    let defs = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
    for(let i=1; i<=6; i++) {
        let enEl = document.getElementById('cfg_z' + i + '_en');
        let valEl = document.getElementById('cfg_z' + i + '_val');
        if (enEl) enEl.checked = true;
        if (valEl) valEl.value = defs[i-1];
    }
    window.saveZonesToConfig();
    try { navigator.vibrate(30); } catch(err){}
};

window.toggleModal = function(id) { 
    const modals = ['settingsModal', 'favModal', 'eqModal'];
    const target = document.getElementById(id);
    const btnTarget = document.getElementById('btn-' + id);
    let wasOpen = target.classList.contains('open');
    
    modals.forEach(m => {
        let el = document.getElementById(m);
        let btn = document.getElementById('btn-' + m);
        if(el) el.classList.remove('open');
        if(btn) btn.style.color = '#58a6ff'; 
    });
    
    if (!wasOpen) {
        target.classList.add('open');
        if(btnTarget) btnTarget.style.color = '#fff'; 
    }
};

window.forceAction = async function(action, id) { await fetch(`/api/force/${action}/${id}`, {method: 'POST'}); window.fetchData(); };

window.toggleShowAll = function() {
    window.isShowingAllTracks = !window.isShowingAllTracks;
    const btn = document.getElementById('showAllBtnToggle');
    if (window.isShowingAllTracks) btn.classList.add('toggled-on');
    else btn.classList.remove('toggled-on');
    window.fetchData();
};

window.openDropdowns = new Set();
window.toggleExo = function(safeId) {
    const el = document.getElementById('exo-' + safeId);
    if(el) { 
        if (window.openDropdowns.has(safeId)) { window.openDropdowns.delete(safeId); el.style.display = 'none'; } 
        else { window.openDropdowns.add(safeId); el.style.display = 'block'; } 
    }
};

let currentLogsCache = ''; 
let currentListCache = ''; 

window.fetchData = async function() {
    try {
        const res = await fetch('/api/data');
        const data = await res.json();
        window.lastData = data; 
        const logBoxEl = document.getElementById('logBox');

        let displayLogs = data.logs || [];
        if (window.appConfig.logMode === "session") {
            const lastSessionIndex = displayLogs.findLastIndex(line => line.includes('НОВАЯ СЕССИЯ'));
            if (lastSessionIndex !== -1) displayLogs = displayLogs.slice(lastSessionIndex); else displayLogs = displayLogs.slice(-64);
        } else if (window.appConfig.logMode === "lines64") { displayLogs = displayLogs.slice(-64); }

        const newLogsStr = displayLogs.join('\n');
        if (logBoxEl && currentLogsCache !== newLogsStr) { 
            if (!window.isUserTouching) {
                currentLogsCache = newLogsStr;
                logBoxEl.innerHTML = displayLogs.map(line => {
                    let isSel = window.selectedLogs && window.selectedLogs.has(line) ? 'selected' : '';
                    return `<div class="log-row ${isSel}" data-raw="${encodeURIComponent(line)}">${line}</div>`;
                }).join('');
                logBoxEl.scrollTop = logBoxEl.scrollHeight; 
            }
        }

        let favHtml = '';
        if (window.favorites.length === 0) { favHtml = '<div style="padding:20px; color:#8b949e; text-align:center;">Пусто</div>'; } 
        else {
            window.favorites.forEach(file => {
                let safeId = encodeURIComponent(file).replace(/[^a-zA-Z0-9]/g, ''); 
                let safeFileJS = file.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                let isPlaying = (file === window.currentPlayingTrack);
                let activeStyle = isPlaying ? "border: 1px solid #7341be; box-shadow: 0 0 10px rgba(115, 65, 190, 0.4);" : "border: 1px solid #30363d;";
                
                favHtml += `
                    <div class="capsule" id="track-fav-${safeId}" style="${activeStyle}">
                        <div onclick="window.playTrack('${safeFileJS}', 'fav')" style="width: 15%; height: 100%; display: flex; justify-content: flex-start; align-items: center; padding-left: 6px; cursor: pointer;">
                            <div onclick="event.stopPropagation(); window.toggleFav('${safeFileJS}')" style="width: 36px; height: 36px; display: flex; justify-content: center; align-items: center; font-size: 18px;">❤️</div>
                        </div>
                        <div style="width: 70%; height: 100%; display: flex; align-items: center; overflow: hidden; cursor: pointer;" onclick="window.playTrack('${safeFileJS}', 'fav')">
                            <span style="color:#58a6ff; font-weight:bold; margin-right:8px;">♪</span>
                            <span style="color:#c9d1d9; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${file}</span>
                        </div>
                        <div onclick="window.playTrack('${safeFileJS}', 'fav')" style="width: 15%; height: 100%; display: flex; justify-content: flex-end; align-items: center; padding-right: 6px; cursor: pointer;">
                            <button class="play-pause-btn" style="width: 36px; height: 36px; pointer-events: none;">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                            </button>
                        </div>
                    </div>`;
            });
        }
        let favListEl = document.getElementById('favList');
        if (favListEl) favListEl.innerHTML = favHtml;

        const fetchedList = (window.isShowingAllTracks ? data.all_tracks : data.session_tracks) || [];
        if (window.currentListContext !== 'fav') {
            window.currentTrackList = fetchedList;
        }
        window.topTrack = fetchedList.length > 0 ? fetchedList[0] : null; 
        
        const unifiedBox = document.getElementById('unifiedList');
        if (!unifiedBox) return;

        let tHtml = ''; let pendingCount = 0;
        let streams = data.streams || {};
        
        for (const [s_id, info] of Object.entries(streams)) {
            if (info.saved || info.ignored) continue;
            pendingCount++; let sizeMB = (info.total_size / (1024*1024)).toFixed(2);
            tHtml += `
                <div style="border-bottom: 1px dashed #30363d; padding: 10px; background: transparent;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:#e3b341; font-size:13px; font-weight:bold;">В обработке (${sizeMB} MB)</span>
                        <div>
                            <button onclick="window.forceAction('process', '${s_id}')">Собрать</button>
                            <button class="danger" onclick="window.forceAction('ignore', '${s_id}')">Мусор</button>
                        </div>
                    </div>
                </div>`;
        }

        if (fetchedList.length === 0 && pendingCount === 0) {
            tHtml = `<div style="padding:10px; color:#8b949e; text-align:center;">Папка пуста</div>`;
        } else {
            fetchedList.forEach(file => {
                let isFav = window.favorites.includes(file); let heartIcon = isFav ? '❤️' : '🤍';
                let mapping = data.track_mapping || {};
                let chunks = mapping[file] || ['Неизвестный источник']; 
                if (!Array.isArray(chunks)) chunks = [chunks];
                
                let safeId = encodeURIComponent(file).replace(/[^a-zA-Z0-9]/g, ''); 
                let displayStyle = window.openDropdowns.has(safeId) ? 'block' : 'none'; 
                let safeFileJS = file.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                let exoList = chunks.join('<br>↳ ');
                let isPlaying = (file === window.currentPlayingTrack);
                let activeStyle = isPlaying ? "border: 1px solid #7341be; box-shadow: 0 0 10px rgba(115, 65, 190, 0.4);" : "border: 1px solid #30363d;";
                
                tHtml += `
                    <div style="position: relative;">
                        <div class="capsule" id="track-main-${safeId}" style="position: relative; z-index: 2; ${activeStyle}">
                            <div onclick="window.playTrack('${safeFileJS}', 'main')" style="width: 15%; height: 100%; display: flex; justify-content: flex-start; align-items: center; padding-left: 6px; cursor: pointer;">
                                <div onclick="event.stopPropagation(); window.toggleFav('${safeFileJS}')" style="width: 36px; height: 36px; display: flex; justify-content: center; align-items: center; font-size: 18px;">${heartIcon}</div>
                            </div>
                            <div style="width: 70%; height: 100%; display: flex; align-items: center; overflow: hidden; cursor: pointer;" onclick="window.toggleExo('${safeId}')">
                                <span style="color:#58a6ff; font-weight:bold; margin-right:8px;">♪</span>
                                <span style="color:#c9d1d9; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${file}</span>
                            </div>
                            <div onclick="window.playTrack('${safeFileJS}', 'main')" style="width: 15%; height: 100%; display: flex; justify-content: flex-end; align-items: center; padding-right: 6px; cursor: pointer;">
                                <button class="play-pause-btn" style="width: 36px; height: 36px; pointer-events: none;">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                </button>
                            </div>
                        </div>
                        <div id="exo-${safeId}" style="display:${displayStyle}; padding: 25px 15px 15px 15px; color:#8b949e; font-size:12px; background:transparent; border-radius: 0 0 20px 20px; margin-top: -30px; margin-bottom: 12px; border: 1px solid #30363d; position: relative; z-index: 1;">
                            ↳ ${exoList}
                        </div>
                    </div>`;
            });
        }
        if (currentListCache !== tHtml) { if (!window.isUserTouching) { currentListCache = tHtml; unifiedBox.innerHTML = tHtml; } }
        
    } catch(e) { }
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

async function cloneAndReverseBuffer(originalBuffer) {
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
}



window.playTrack = async function(filename, listContext = 'main') {
    if(typeof window.initAudioBoost === 'function') window.initAudioBoost(); 
    if(typeof window.applyEQSettings === 'function') window.applyEQSettings(); 
    if(typeof window.changeVolume === 'function') window.changeVolume();   
    
    window.currentPlayingTrack = filename; 
    window.currentListContext = listContext; 
    window.fetchData(); 
    
    if (listContext === 'fav') {
        window.currentTrackList = window.favorites;
    } else if (listContext === 'main' && window.lastData) {
        window.currentTrackList = window.isShowingAllTracks ? (window.lastData.all_tracks || []) : (window.lastData.session_tracks || []);
    }

    const player = document.getElementById('audioPlayer');
    const titleEl = document.getElementById('nowPlaying');
    
    if(player) { player.pause(); if (player.src && player.src.startsWith('blob:')) URL.revokeObjectURL(player.src); }
    if (window.studioSourceNode) { try { window.studioSourceNode.stop(); } catch(e){} }
    window.isStudioPlaying = false;
    window.studioBuffer = null; 
    window.reversedStudioBuffer = null; 
    
    if (window.scrubState.active || window.scrubState.locked) stopScrub();
    updateProgressUI(0, 100, window.isReversed); 

    if ('mediaSession' in navigator) {
        let cleanFileName = filename.replace(/\.(opus|m4a|mp3)$/i, ''); 
        navigator.mediaSession.metadata = new MediaMetadata({ title: cleanFileName, artist: "🔥 HACKED BY JENNY 🔥" });
        
        // 🎧 Железобетонная привязка кнопок для шторки Android
        navigator.mediaSession.setActionHandler('play', () => window.togglePlay());
        navigator.mediaSession.setActionHandler('pause', () => window.togglePlay());
        navigator.mediaSession.setActionHandler('previoustrack', () => window.playPreviousTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => window.playNextTrack());
        
        // Хак: Android часто требует наличия перемотки, чтобы отрисовать полные кнопки
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
            player.playbackRate = 1.0; 
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
                    window.reversedStudioBuffer = await cloneAndReverseBuffer(decodedBuffer);
                    window.remoteLog("🔄 Теневой реверс-буфер готов.");
                    if (player && player.paused) {
                         player.play().catch(e => {});
                    }
                    if (window.htmlGain) window.htmlGain.gain.value = 0;
                    
                     if (player && !player.paused) {
                        if (window.studioSourceNode) { try { window.studioSourceNode.stop(); } catch(e){} window.studioSourceNode.disconnect(); }
                        window.studioSourceNode = window.audioCtx.createBufferSource();
                        window.studioSourceNode.buffer = window.reversedStudioBuffer;
                        window.studioSourceNode.playbackRate.value = player.playbackRate;
                        window.studioSourceNode.connect(window.inputMixer);
                        let startPos = player.duration - player.currentTime;
                        if (!isFinite(startPos) || startPos < 0) startPos = 0;
                        window.studioSourceNode.start(0, startPos);
                        window.isStudioPlaying = true;
                    }
                    
                } else {
                    setTimeout(async () => {
                        window.reversedStudioBuffer = await cloneAndReverseBuffer(decodedBuffer);
                        window.remoteLog("🔄 Теневой реверс-буфер готов.");
                    }, 50);
                    
                    if (window.htmlGain) window.htmlGain.gain.value = 0; 
                
                    if (player && !player.paused) {
                        if (window.studioSourceNode) { try { window.studioSourceNode.stop(); } catch(e){} window.studioSourceNode.disconnect(); }
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

// ==========================================
// 🚀 ЛОГИКА ЦЕНТРАЛЬНОГО СКРАББИНГА
// ==========================================
function startScrub(side, speed) {
    const player = document.getElementById('audioPlayer');
    if (!player) return; // Убрали жесткую проверку RAM!
    
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
        window.scrubState.isPhysicallyReversed = false;
        player.playbackRate = speed;
        player.preservesPitch = isPitchLocked;
        
        if (window.studioSourceNode) {
            try { window.studioSourceNode.stop(); } catch(e){}
            window.studioSourceNode.disconnect();
        }

        if (window.appConfig.studioMode && window.studioBuffer) {
            if (isPitchLocked) {
                if (window.htmlGain) window.htmlGain.gain.value = 1;
                window.isStudioPlaying = false;
            } else {
                if (window.htmlGain) window.htmlGain.gain.value = 0;
                window.studioSourceNode = window.audioCtx.createBufferSource();
                window.studioSourceNode.buffer = window.studioBuffer;
                window.studioSourceNode.playbackRate.value = speed;
                window.studioSourceNode.connect(window.inputMixer);
                window.studioSourceNode.start(0, player.currentTime);
                window.isStudioPlaying = true;
            }
        } else {
            // Если RAM выключен, просто слушаем стандартный HTML-плеер
            if (window.htmlGain) window.htmlGain.gain.value = 1; 
        }
        
        if (player.paused) player.play().catch(e=>{});
        
    } else {
        window.scrubState.isPhysicallyReversed = true;
        player.playbackRate = speed; 
        
        if (window.appConfig.studioMode && window.reversedStudioBuffer) {
            if (window.studioSourceNode) {
                try { window.studioSourceNode.stop(); } catch(e){}
                window.studioSourceNode.disconnect();
            }
            if (window.htmlGain) window.htmlGain.gain.value = 0;
            window.studioSourceNode = window.audioCtx.createBufferSource();
            window.studioSourceNode.buffer = window.reversedStudioBuffer; 
            window.studioSourceNode.playbackRate.value = speed;
            window.studioSourceNode.connect(window.inputMixer);
            
            let startPos = player.duration - player.currentTime; 
            player.currentTime = startPos; 
            window.studioSourceNode.start(0, startPos);
            window.isStudioPlaying = true;
        } else {
            window.remoteLog("⚠️ Вы включили реверс без RAM. Визуально скорость изменена, но звук не пойдет назад.");
        }
        if (player.paused) player.play().catch(e=>{});
    }
}

function stopScrub() {
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
        if (window.scrubState.isPhysicallyReversed) {
            player.currentTime = player.duration - player.currentTime; 
            window.scrubState.isPhysicallyReversed = false;
        }
        
        player.playbackRate = 1.0;
        player.preservesPitch = isPitchLocked;
        
        if (window.studioSourceNode) {
            try { window.studioSourceNode.stop(); } catch(e){}
            window.studioSourceNode.disconnect();
        }

        if (window.appConfig.studioMode && window.studioBuffer) {
            if (window.htmlGain) window.htmlGain.gain.value = 0;
            window.studioSourceNode = window.audioCtx.createBufferSource();
            window.studioSourceNode.buffer = window.isReversed ? window.reversedStudioBuffer : window.studioBuffer; 
            window.studioSourceNode.playbackRate.value = 1.0;
            window.studioSourceNode.connect(window.inputMixer);
            window.studioSourceNode.start(0, player.currentTime);
            window.isStudioPlaying = true;
        } else {
             if (window.htmlGain) window.htmlGain.gain.value = 1;
        }
        if (player.paused) player.play().catch(e=>{});
    }
}


window.setupSeekZone = function() {
    const zone = document.getElementById('seekZone');
    const arcContainer = document.getElementById('speedArcContainer');
    const overlay = document.getElementById('scrubOverlay');
    if (!zone || !arcContainer || !overlay) return;

    let debugCanvas = document.getElementById('debugZoneCanvas');
    if (!debugCanvas) {
        debugCanvas = document.createElement('canvas');
        debugCanvas.id = 'debugZoneCanvas';
        debugCanvas.style.position = 'absolute';
        debugCanvas.style.top = '0';
        debugCanvas.style.left = '0';
        debugCanvas.style.pointerEvents = 'none'; 
        debugCanvas.style.width = '100%';
        debugCanvas.style.height = '100%';
        debugCanvas.style.zIndex = '5998'; 
        overlay.appendChild(debugCanvas);
    }

    let startY = 0;
    let isPullingDown = false;
    let isScrubbing = false;
    let isSeekingAllowed = true; 
    let scrubSide = null;
    let currentTempSpeed = null;
    let arcItems = [];
    let circleAngles = []; 
    let currentAnchor = {x: 0, y: 0};
    let pressTimer = null;

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
        const rect = zone.getBoundingClientRect();
        let perc = (x - rect.left) / rect.width;
        perc = Math.max(0, Math.min(1, perc));
        const player = document.getElementById('audioPlayer');
        if (player && isFinite(player.duration) && player.duration > 0) {
            let isVisualReverse = window.isReversed || window.scrubState.isPhysicallyReversed;
            if (isVisualReverse) perc = 1.0 - perc; 
            
            player.currentTime = perc * player.duration;
            
            if (window.scrubState.active || window.scrubState.locked || window.isReversed) {
                if (window.studioSourceNode && window.studioBuffer) {
                    try { window.studioSourceNode.stop(); } catch(e){}
                    window.studioSourceNode.disconnect();
                    window.studioSourceNode = window.audioCtx.createBufferSource();
                    window.studioSourceNode.buffer = isVisualReverse ? window.reversedStudioBuffer : window.studioBuffer;
                    window.studioSourceNode.playbackRate.value = window.scrubState.speed || 1.0;
                    window.studioSourceNode.connect(window.inputMixer);
                    window.studioSourceNode.start(0, player.currentTime);
                }
            }
        }
    }

    function drawDebugWheel(anchorX, anchorY, angles) {
        debugCanvas.width = window.innerWidth;
        debugCanvas.height = window.innerHeight;
        let ctx = debugCanvas.getContext('2d');
        ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
        
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, 20, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(227, 179, 65, 0.7)';
        ctx.fill();

        let radius = Math.max(window.innerWidth, window.innerHeight);
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = 'rgba(227, 179, 65, 0.5)'; 

        for (let i = 0; i < angles.length - 1; i++) {
            let midAngle = (angles[i] + angles[i+1]) / 2;
            let rad = midAngle * Math.PI / 180;
            
            let endX = anchorX + radius * Math.cos(rad);
            let endY = anchorY + radius * Math.sin(rad);
            
            ctx.beginPath();
            ctx.moveTo(anchorX, anchorY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }

    function generateArc() {
        arcContainer.innerHTML = '';
        arcItems = [];
        circleAngles = [];
        
        let activeZones = [];
        for(let i=1; i<=6; i++) {
            let en = document.getElementById('cfg_z' + i + '_en');
            let val = document.getElementById('cfg_z' + i + '_val');
            if (en && en.checked && val) {
                activeZones.push(parseFloat(val.value) || 1.0);
            }
        }
        if(activeZones.length === 0) activeZones = [1.0]; 

        let isLeftHanded = window.appConfig.leftHandedMode || false;
        
        currentAnchor.y = window.innerHeight * 0.40; 
        currentAnchor.x = isLeftHanded ? 0 : window.innerWidth;

        let positionsRH = [
            { x: window.innerWidth * 0.75, y: 35 },  
            { x: window.innerWidth * 0.50, y: 35 },  
            { x: window.innerWidth * 0.25, y: 35 },  
            { x: window.innerWidth * 0.08, y: 90 },  
            { x: window.innerWidth * 0.08, y: 150 }, 
            { x: window.innerWidth * 0.08, y: 220 }  
        ];

        let positionsLH = [
            { x: window.innerWidth * 0.25, y: 35 },
            { x: window.innerWidth * 0.50, y: 35 },
            { x: window.innerWidth * 0.75, y: 35 },
            { x: window.innerWidth * 0.92, y: 90 },
            { x: window.innerWidth * 0.92, y: 150 },
            { x: window.innerWidth * 0.92, y: 220 }
        ];

        let positions = isLeftHanded ? positionsLH : positionsRH;
        
        activeZones.forEach((val, index) => {
            if (index >= positions.length) return; 

            let el = document.createElement('div');
            el.className = 'arc-item';
            el.innerText = 'x' + (val % 1 === 0 ? val.toFixed(1) : val.toString());
            el.dataset.val = val;
            
            el.style.left = `${positions[index].x - 22}px`;
            el.style.top = `${positions[index].y - 22}px`;
            
            let angle = Math.atan2(positions[index].y - currentAnchor.y, positions[index].x - currentAnchor.x) * 180 / Math.PI;
            circleAngles.push(angle);
            
            arcContainer.appendChild(el);
            arcItems.push(el);
        });

        arcContainer.style.display = 'block';
        setTimeout(() => { arcContainer.style.opacity = '1'; }, 10);
        
        drawDebugWheel(currentAnchor.x, currentAnchor.y, circleAngles);
    }

    zone.addEventListener('touchstart', (e) => {
        let startX = getX(e);
        startY = getY(e);
        let rect = zone.getBoundingClientRect();
        let perc = (startX - rect.left) / rect.width;

        if (perc < 0.33) scrubSide = 'left';
        else if (perc > 0.66) scrubSide = 'right';
        else scrubSide = 'center';

        isPullingDown = false;
        currentTempSpeed = null;
        isScrubbing = false;
        isSeekingAllowed = true; 

        if (scrubSide === 'center') {
            pressTimer = setTimeout(() => {
                pressTimer = null;
                try { navigator.vibrate(50); } catch(err){}
                if (window.scrubState.active || window.scrubState.locked) stopScrub();
                window.remoteLog("🔄 Скорость восстановлена на x1.0");
            }, 400); 
            return;
        }

        pressTimer = setTimeout(() => {
            pressTimer = null;
            isScrubbing = true;

            if (window.scrubState.locked) {
                window.scrubState.locked = false;
                try { navigator.vibrate(50); } catch(err){}
            } else {
                try { navigator.vibrate(30); } catch(err){}
            }
            
            let defSpeed = parseFloat(window.appConfig.defaultScrubSpeed) || 2.0;
            startScrub(scrubSide, defSpeed);

        }, 250); 

    }, {passive: true});

    function handleTouchMove(e) {
        let curX = getX(e);
        let curY = getY(e);
        let deltaY = curY - startY;

        if (scrubSide === 'center') {
            if (Math.abs(deltaY) > 15 && pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
            return;
        }

        let threshold = window.innerHeight * 0.05; 

        if (deltaY > threshold || isScrubbing) {
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
                let defSpeed = parseFloat(window.appConfig.defaultScrubSpeed) || 2.0;
                startScrub(scrubSide, defSpeed);
            }
            
            let dx = curX - currentAnchor.x;
            let dy = curY - currentAnchor.y;
            let fingerAngle = Math.atan2(dy, dx) * 180 / Math.PI;

            let minDiff = Infinity;
            let idx = 0;
            
            circleAngles.forEach((ang, i) => {
                let diff = Math.abs(fingerAngle - ang);
                if (diff < minDiff) {
                    minDiff = diff;
                    idx = i;
                }
            });

            if (!arcItems[idx].classList.contains('active')) {
                arcItems.forEach(el => el.classList.remove('active'));
                arcItems[idx].classList.add('active');
                currentTempSpeed = parseFloat(arcItems[idx].dataset.val);
                startScrub(scrubSide, currentTempSpeed);
                try { navigator.vibrate(15); } catch(err){}
            }
        }
    }

    zone.addEventListener('touchmove', handleTouchMove, {passive: true});
    overlay.addEventListener('touchmove', handleTouchMove, {passive: false}); 

    function handleTouchEnd(e) {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
            
            if (isSeekingAllowed) handleTapSeek(getX(e));
            
        } else if (isScrubbing) {
            arcContainer.style.opacity = '0';
            setTimeout(() => { arcContainer.style.display = 'none'; }, 150);

            if (isPullingDown) {
                window.scrubState.locked = true;
                startScrub(scrubSide, currentTempSpeed); 
                
                if (window.appConfig.autoSaveScrub) {
                    window.appConfig.defaultScrubSpeed = currentTempSpeed;
                    let inputEl = document.getElementById('cfg_defaultScrubSpeed');
                    if (inputEl) inputEl.value = currentTempSpeed;
                    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
                }
            } else {
                if (!window.scrubState.locked) stopScrub();
            }
        }
        
        overlay.style.display = 'none'; 
        isPullingDown = false;
        isScrubbing = false;
        scrubSide = null;
        
        let ctx = debugCanvas.getContext('2d');
        ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    }

    zone.addEventListener('touchend', handleTouchEnd);
    overlay.addEventListener('touchend', handleTouchEnd);

    function handleTouchCancel() {
        if (pressTimer) clearTimeout(pressTimer);
        arcContainer.style.display = 'none';
        overlay.style.display = 'none';
        if (!window.scrubState.locked) stopScrub();
        isPullingDown = false;
        isScrubbing = false;
        
        let ctx = debugCanvas.getContext('2d');
        ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    }

    zone.addEventListener('touchcancel', handleTouchCancel);
    overlay.addEventListener('touchcancel', handleTouchCancel);
};

// ==========================================
// 🚀 ЛОГИКА БОКОВЫХ ТАЙМЕРОВ (КЛАССИКА: РЕВЕРС И ПРЫЖКИ Х10)
// ==========================================
function toggleReverseMode(targetReversed) {
    if (!window.appConfig.studioMode || !window.studioBuffer) {
        window.remoteLog("⚠️ Реверс работает только в Студийном режиме (RAM)!");
        return;
    }
    if (window.isReversed === targetReversed) return;
    
    if (window.scrubState.active || window.scrubState.locked) stopScrub();
    if (!window.reversedStudioBuffer) return window.remoteLog("⚠ Реверс-буфер еще не готов!");
    
    window.remoteLog(targetReversed ? "🔄 РЕВЕРС включен! (Трек играет назад)" : "▶️ Нормальное воспроизведение возвращено.");
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
}

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
            window.remoteLog("⏪ Перемотка x10 назад...");
            if (player) {
                player.pause();
                jumpInterval = setInterval(() => {
                    player.currentTime = Math.max(0, player.currentTime - 1.0);
                    let isVisualReverse = window.isReversed || window.scrubState.isPhysicallyReversed;
                    updateProgressUI(player.currentTime, player.duration, isVisualReverse);
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
            toggleReverseMode(true);
        }
    });

    leftBlock.addEventListener('touchcancel', () => { clearTimeout(pressTimer); clearInterval(jumpInterval); });

    rightBlock.addEventListener('touchstart', (e) => {
        isLongPress = false;
        pressTimer = setTimeout(() => {
            isLongPress = true;
            try { navigator.vibrate(30); } catch(e){}
            window.remoteLog("⏩ Перемотка x10 вперед...");
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
                player.playbackRate = 1.0;
                if (window.studioSourceNode) window.studioSourceNode.playbackRate.value = 1.0;
            }
        } else {
            toggleReverseMode(false);
        }
    });

    rightBlock.addEventListener('touchcancel', () => { 
        clearTimeout(pressTimer); 
        if (player) {
            player.playbackRate = 1.0;
            if (window.studioSourceNode) window.studioSourceNode.playbackRate.value = 1.0;
        } 
    });
};

// ==========================================
// 🚀 ФИЗИЧЕСКИЙ РЕВЕРС ИНТЕРФЕЙСА 
// ==========================================
function updateProgressUI(currentTime, duration, isReverseVisual) {
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
}

// ==========================================
// 🚀 ПАРАНОИДАЛЬНАЯ СИНХРОНИЗАЦИЯ И СКРОЛЛ
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const player = document.getElementById('audioPlayer');
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
                window.togglePlay();
            }
            if (e.cancelable) e.preventDefault(); 
        }, {passive: false});
    }

    if(player) {
        player.onplay = () => { 
            let btn = document.getElementById('playPauseBtn');
            if(btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'; 
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
            
            if (window.studioSourceNode) { try { window.studioSourceNode.stop(); } catch(e){} window.studioSourceNode.disconnect(); }
            
            if (window.appConfig.studioMode && window.studioBuffer && window.htmlGain && window.htmlGain.gain.value === 0) {
                let isVisualReverse = window.isReversed || window.scrubState.isPhysicallyReversed;
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
                try { window.studioSourceNode.stop(); } catch(e){}
                window.isStudioPlaying = false;
            }
        };
        
        player.onseeking = () => {
            if (window.studioSourceNode) {
                try { window.studioSourceNode.stop(); } catch(e){}
                window.isStudioPlaying = false;
            }
        };
        
        player.onseeked = () => {
            if (window.appConfig.studioMode && window.studioBuffer && window.htmlGain && window.htmlGain.gain.value === 0) {
                if (!player.paused) {
                    if (window.studioSourceNode) { try { window.studioSourceNode.stop(); } catch(e){} }
                    let isVisualReverse = window.isReversed || window.scrubState.isPhysicallyReversed;
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
            if (window.scrubState.active || window.scrubState.locked) stopScrub();
            if (window.isReversed) {
                window.playPreviousTrack();
            } else {
                window.playNextTrack(); 
            }
        };
        
        player.ontimeupdate = () => { 
            if (isFinite(player.duration)) { 
                let isVisualReverse = window.isReversed || window.scrubState.isPhysicallyReversed;
                updateProgressUI(player.currentTime, player.duration, isVisualReverse);
            } 
        };
    }
});
        
window.formatTime = function(seconds) { let min = Math.floor(seconds / 60); let sec = Math.floor(seconds % 60); return min + ':' + (sec < 10 ? '0' + sec : sec); };

function scheduleFetch() {
    window.fetchData().finally(() => {
        const player = document.getElementById('audioPlayer');
        const isPlaying = (player && !player.paused && player.currentTime > 0);
        setTimeout(scheduleFetch, isPlaying ? 6000 : 2000);
    });
}
scheduleFetch();

// ==========================================
// 🚀 ЭКСПОРТ ТРЕКА (ДВУХХОДОВОЧКА С ПИТОНОМ + ИДЕАЛЬНОЕ ЗАПЕКАНИЕ)
// ==========================================
window.exportCurrentTrack = async function() {
    if (!window.currentPlayingTrack) return;

    const btn = document.getElementById('btnExport');
    if (btn) btn.innerText = "⏳";

    try {
        const player = document.getElementById('audioPlayer');
        let speed = window.scrubState.active ? window.scrubState.speed : (player.playbackRate || 1.0);
        let isRev = window.isReversed || window.scrubState.isPhysicallyReversed;
        
        let pitchLockCheckbox = document.getElementById('cfg_pitchLock');
        let pitchLock = pitchLockCheckbox ? pitchLockCheckbox.checked : false;

        let sourceBuffer = window.studioBuffer;
        
        if (!sourceBuffer) {
            window.remoteLog("⏳ RAM выключен. Подгружаем исходник в фоне для экспорта...");
            let res = await fetch('/api/media/' + encodeURIComponent(window.currentPlayingTrack));
            let arrayBuffer = await res.arrayBuffer();
            sourceBuffer = await window.audioCtx.decodeAudioData(arrayBuffer);
        }
        
        if (isRev && !window.reversedStudioBuffer) {
            window.remoteLog("⏳ Генерируем реверс-буфер на лету...");
            sourceBuffer = await cloneAndReverseBuffer(sourceBuffer);
        } else if (isRev) {
            sourceBuffer = window.reversedStudioBuffer;
        }

        if (pitchLock && speed !== 1.0 && !isRev) {
            window.remoteLog(`⏳ [Шаг 1] Запрашиваем растянутый сэмпл у Питона (x${speed})...`);
            
            let stretchFormData = new FormData();
            stretchFormData.append('filename', window.currentPlayingTrack);
            stretchFormData.append('speed', speed);
            
            let stretchRes = await fetch('/api/stretch', { method: 'POST', body: stretchFormData });
            if (!stretchRes.ok) throw new Error("Питон не смог растянуть трек");
            
            let stretchedArrayBuffer = await stretchRes.arrayBuffer();
            sourceBuffer = await window.audioCtx.decodeAudioData(stretchedArrayBuffer);
        }

        window.remoteLog(`⏳ [Шаг 2] Рендеринг в памяти (Идеальная копия из ядра)...`);

        let renderSpeed = (pitchLock && !isRev) ? 1.0 : speed;
        let duration = sourceBuffer.duration / renderSpeed;
        
        let offlineCtx = new OfflineAudioContext(sourceBuffer.numberOfChannels, duration * sourceBuffer.sampleRate, sourceBuffer.sampleRate);
        let sourceNode = offlineCtx.createBufferSource();
        sourceNode.buffer = sourceBuffer;
        sourceNode.playbackRate.value = renderSpeed;
        
        // 🎛 ВОССОЗДАЕМ ЦЕПЬ ИДЕАЛЬНО (ПО ДАННЫМ ИЗ АУДИО-ДВИЖКА) 🎛️
        let currentNode = sourceNode;
        let cfg = window.appConfig || {};

        // 0. PreAmp (как в движке)
        let preAmp = offlineCtx.createGain();
        preAmp.gain.value = 0.6;
        currentNode.connect(preAmp);
        currentNode = preAmp;

        // 1. Эквалайзер (Читаем прямо из ЖИВЫХ нод, ставим ДО сатуратора!)
        if (cfg.eqEnabled && window.eqNodes) {
            let freqs = [60, 230, 910, 3600, 14000];
            let types = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
            let bandKeys = ['band60', 'band230', 'band910', 'band3600', 'band14000'];
            
            bandKeys.forEach((key, index) => {
                let liveNode = window.eqNodes[key];
                if (liveNode) {
                    let filter = offlineCtx.createBiquadFilter();
                    filter.type = types[index];
                    filter.frequency.value = freqs[index];
                    filter.gain.value = liveNode.gain.value; // Математически точное значение
                    currentNode.connect(filter);
                    currentNode = filter;
                }
            });
        }

        // 2. FIR-Сатуратор (Берем из cfg + защита от перегруза)
        if (cfg.firEnabled && cfg.firSettings) {
            // 🛡️ Гаситель перед FIR, чтобы оффлайн-рендерер не захлебывался
            let preFirPad = offlineCtx.createGain();
            preFirPad.gain.value = 0.8;
            currentNode.connect(preFirPad);
            currentNode = preFirPad;

            let firNode = offlineCtx.createConvolver();
            firNode.normalize = false;
            
            let decay = cfg.firSettings.decay;
            let length = Math.floor(offlineCtx.sampleRate * (decay / 1000));
            if(length === 0) length = 1;
            let impulse = offlineCtx.createBuffer(2, length, offlineCtx.sampleRate);
            for (let c = 0; c < 2; c++) {
                let data = impulse.getChannelData(c);
                for (let i = 0; i < length; i++) {
                    data[i] = (i === 0) ? 1.0 : Math.exp(-i / (length/3)) * 0.05; 
                }
            }
            firNode.buffer = impulse;
            
            let firGain = offlineCtx.createGain();
            firGain.gain.value = cfg.firSettings.gain;

            currentNode.connect(firNode);
            firNode.connect(firGain);
            currentNode = firGain;
        }

        // 3. Базовый Gain Node перед лимитером (как в движке)
        let gainNode = offlineCtx.createGain();
        gainNode.gain.value = 1.0;
        currentNode.connect(gainNode);
        currentNode = gainNode;

        // 4. Лимитер и Кроссовер (Берем из cfg)
        if (cfg.limiterEnabled && cfg.limiterSettings) {
            let thresh = cfg.limiterSettings.threshold;
            let knee = cfg.limiterSettings.knee;
            let ratio = cfg.limiterSettings.ratio;
            let atk = cfg.limiterSettings.attack / 1000;
            let rel = cfg.limiterSettings.release / 1000;

            if (cfg.multiBandEnabled && cfg.multiBandSettings) {
                let lowFreq = cfg.multiBandSettings.low;
                let highFreq = cfg.multiBandSettings.high;

                let splitLow = offlineCtx.createBiquadFilter(); splitLow.type = 'lowpass'; splitLow.frequency.value = lowFreq;
                let splitMid = offlineCtx.createBiquadFilter(); splitMid.type = 'bandpass'; splitMid.frequency.value = (lowFreq + highFreq) / 2;
                let splitHigh = offlineCtx.createBiquadFilter(); splitHigh.type = 'highpass'; splitHigh.frequency.value = highFreq;

                let compLow = offlineCtx.createDynamicsCompressor();
                compLow.threshold.value = thresh; compLow.knee.value = knee; compLow.ratio.value = ratio;
                compLow.attack.value = atk; compLow.release.value = rel;

                let compMid = offlineCtx.createDynamicsCompressor();
                compMid.threshold.value = thresh + 2; compMid.knee.value = knee; compMid.ratio.value = ratio;
                compMid.attack.value = 0.002; compMid.release.value = 0.1;

                let compHigh = offlineCtx.createDynamicsCompressor();
                compHigh.threshold.value = thresh + 4; compHigh.knee.value = knee; compHigh.ratio.value = ratio;
                compHigh.attack.value = 0.001; compHigh.release.value = 0.05;

                currentNode.connect(splitLow); currentNode.connect(splitMid); currentNode.connect(splitHigh);
                splitLow.connect(compLow); splitMid.connect(compMid); splitHigh.connect(compHigh);

                compLow.connect(offlineCtx.destination);
                compMid.connect(offlineCtx.destination);
                compHigh.connect(offlineCtx.destination);
            } else {
                let comp = offlineCtx.createDynamicsCompressor();
                comp.threshold.value = thresh; comp.knee.value = knee; comp.ratio.value = ratio;
                comp.attack.value = atk; comp.release.value = rel;
                currentNode.connect(comp);
                comp.connect(offlineCtx.destination);
            }
        } else {
            currentNode.connect(offlineCtx.destination);
        }

        sourceNode.start(0);

        let renderedBuffer = await offlineCtx.startRendering();
        let wavBlob = bufferToWav(renderedBuffer, renderedBuffer.length);

        let formData = new FormData();
        formData.append('audio_data', wavBlob, 'export.wav');
        formData.append('filename', window.currentPlayingTrack);
        formData.append('speed', speed);
        formData.append('is_reversed', isRev ? 'true' : 'false');
        formData.append('pitch_lock', pitchLock ? 'true' : 'false');

        window.remoteLog("🚀 [Шаг 3] Отправка на финальную сборку (Opus)...");
        let res = await fetch('/api/export', { method: 'POST', body: formData });
        let json = await res.json();

        if (json.status === 'ok') {
            window.remoteLog("✅ Экспорт успешен: " + json.new_file);
            window.fetchData(); 
        } else {
            window.remoteLog("❌ Ошибка сервера: " + json.error);
        }

    } catch (e) {
        window.remoteLog("❌ Ошибка экспорта: " + e.message);
    }

    if (btn) btn.innerText = "💾";
};

// 🛠️ Функция ручной сборки WAV файла из PCM-массива
function bufferToWav(abuffer, len) {
    let numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
    setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(abuffer.sampleRate); setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2); setUint16(16);
    setUint32(0x61746164); setUint32(length - pos - 4);

    for(i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));

    while(pos < length) {
        for(i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
            view.setInt16(pos, sample, true); pos += 2;
        }
        offset++
    }
    return new Blob([buffer], {type: "audio/wav"});
}

// 🔍 ЖИВОЙ ПОИСК ПО СПИСКАМ
window.filterTracks = function(query) {
    let lowerQuery = query.toLowerCase();
    
    document.querySelectorAll('.capsule').forEach(el => {
        // 🛡️ ЗАЩИТА: Если у капсулы нет ID или он не начинается с "track-", пропускаем её!
        // Это спасет наш верхний пульт от исчезновения.
        if (!el.id || !el.id.startsWith('track-')) return; 
        
        let trackName = el.innerText.toLowerCase();
        
        if (trackName.includes(lowerQuery)) {
            el.parentElement.style.display = 'block';
        } else {
            el.parentElement.style.display = 'none';
        }
    });
};
