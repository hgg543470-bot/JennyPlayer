// =========================================================================
// 🎨 UI_RENDER.JS (ЧИСТАЯ ОТРИСОВКА СПИСКОВ БЕЗ ЛОГОВ И ДЕМОНА)
// =========================================================================

let currentListCache = ''; 

window.fetchData = async function() {
    try {
        const res = await fetch('/api/data');
        const data = await res.json();
        window.lastData = data; 

        let favHtml = '';
        if (window.favorites.length === 0) { 
            favHtml = '<div style="padding:20px; color:#8b949e; text-align:center;">Пусто</div>'; 
        } else {
            window.favorites.forEach(file => {
                let safeId = encodeURIComponent(file).replace(/[^a-zA-Z0-9]/g, ''); 
                let safeFileJS = file.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                let isPlaying = (file === window.currentPlayingTrack);
                let activeStyle = isPlaying ? "border: 1px solid #7341be; box-shadow: 0 0 10px rgba(115, 65, 190, 0.4);" : "border: 1px solid #30363d;";
                
                favHtml += `
                    <div class="capsule" id="track-fav-${safeId}" style="${activeStyle}">
                        <div onclick="window.playTrack('${safeFileJS}', 'fav')" style="width: 15%; height: 100%; display: flex; justify-content: flex-start; align-items: center; padding-left: 6px; cursor: pointer;">
                            <div onclick="event.stopPropagation(); window.toggleFav('${safeFileJS}'); window.fetchData();" style="width: 36px; height: 36px; display: flex; justify-content: center; align-items: center; font-size: 18px;">❤️</div>
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
        
        const countEl = document.getElementById('tracksCount');
        if (countEl) countEl.innerText = fetchedList.length;

        const unifiedBox = document.getElementById('unifiedList');
        if (!unifiedBox) return;

        let tHtml = ''; 
        if (fetchedList.length === 0) {
            tHtml = `<div style="padding:10px; color:#8b949e; text-align:center;">Папка с музыкой пуста</div>`;
        } else {
            fetchedList.forEach(file => {
                let isFav = window.favorites.includes(file); let heartIcon = isFav ? '❤️' : '🤍';
                let safeId = encodeURIComponent(file).replace(/[^a-zA-Z0-9]/g, ''); 
                let safeFileJS = file.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                let isPlaying = (file === window.currentPlayingTrack);
                let activeStyle = isPlaying ? "border: 1px solid #7341be; box-shadow: 0 0 10px rgba(115, 65, 190, 0.4);" : "border: 1px solid #30363d;";
                
                tHtml += `
                    <div style="position: relative;">
                        <div class="capsule" id="track-main-${safeId}" style="position: relative; z-index: 2; ${activeStyle}">
                            <div onclick="window.playTrack('${safeFileJS}', 'main')" style="width: 15%; height: 100%; display: flex; justify-content: flex-start; align-items: center; padding-left: 6px; cursor: pointer;">
                                <div onclick="event.stopPropagation(); window.toggleFav('${safeFileJS}'); window.fetchData();" style="width: 36px; height: 36px; display: flex; justify-content: center; align-items: center; font-size: 18px;">${heartIcon}</div>
                            </div>
                            <div style="width: 70%; height: 100%; display: flex; align-items: center; overflow: hidden; cursor: pointer;" onclick="window.playTrack('${safeFileJS}', 'main')">
                                <span style="color:#58a6ff; font-weight:bold; margin-right:8px;">♪</span>
                                <span style="color:#c9d1d9; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${file}</span>
                            </div>
                            <div onclick="window.playTrack('${safeFileJS}', 'main')" style="width: 15%; height: 100%; display: flex; justify-content: flex-end; align-items: center; padding-right: 6px; cursor: pointer;">
                                <button class="play-pause-btn" style="width: 36px; height: 36px; pointer-events: none;">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>`;
            });
        }
        if (currentListCache !== tHtml) { currentListCache = tHtml; unifiedBox.innerHTML = tHtml; }
        
    } catch(e) { }
};
