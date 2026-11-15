// =========================================================================
// 🎨 UI_RENDER.JS (ГЕНЕРАЦИЯ И ОБНОВЛЕНИЕ HTML СПИСКОВ)
// =========================================================================

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
