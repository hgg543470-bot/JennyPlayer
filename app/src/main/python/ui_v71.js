// =========================================================================
// 🚀 UI_V71.JS: ПЛЕЙЛИСТЫ, ГЛАЗ 👁️, СОРТИРОВКА ⇅, МУЛЬТИ-ПАПКИ И СЛОТЫ 1-3
// =========================================================================

window.PLAYLIST_BUILTIN_TABS_V71 = [
    { id: 'all',     icon: '🎵', ru: 'Все',         en: 'All' },
    { id: 'fav',     icon: '❤️', ru: 'Избранное',   en: 'Favorites' },
    { id: 'artists', icon: '🎤', ru: 'По артистам', en: 'Artists' },
    { id: 'albums',  icon: '💿', ru: 'По альбомам', en: 'Albums' }
];

window.SORT_METHODS_V71 = [
    { id: 'mtime',    defDir: 'desc', ru: '🕒 По времени (Новые / Старые)',          en: '🕒 By Time (Newest / Oldest)' },
    { id: 'name',     defDir: 'asc',  ru: '🔤 По алфавиту (А ➔ Я / Я ➔ А)',          en: '🔤 Alphabetical (A ➔ Z / Z ➔ A)' },
    { id: 'duration', defDir: 'asc',  ru: '⏱️ По длительности (Короткие / Длинные)', en: '⏱️ By Duration (Short / Long)' },
    { id: 'size',     defDir: 'desc', ru: '📦 По размеру файла (Тяжёлые / Лёгкие)',  en: '📦 By File Size (Heavy / Light)' },
    { id: 'plays',    defDir: 'desc', ru: '🔥 По популярности (Часто включаемые)',   en: '🔥 By Popularity (Most Played)' },
    { id: 'custom',   defDir: 'asc',  ru: '📌 Свой порядок (По порядку добавления)', en: '📌 Custom Order (As Added)' }
];

window.ensurePlaylistStateV71 = function() {
    window.appConfig = window.appConfig || JSON.parse(localStorage.getItem('ytm_config') || '{}');
    if (!Array.isArray(window.appConfig.customPlaylistsV71)) window.appConfig.customPlaylistsV71 = [];
    if (!window.appConfig.visiblePlaylistTabsV71) {
        window.appConfig.visiblePlaylistTabsV71 = { all: true, fav: true, artists: true, albums: true };
    }
    if (!window.appConfig.playlistSortMapV71) {
        window.appConfig.playlistSortMapV71 = {
            all: { mode: 'mtime', dir: 'desc' },
            fav: { mode: 'custom', dir: 'asc' },
            artists: { mode: 'name', dir: 'asc' },
            albums: { mode: 'name', dir: 'asc' }
        };
    }
    if (!window.appConfig.trackPlayStatsV71) window.appConfig.trackPlayStatsV71 = {};
    if (!window.activePlaylistTabV71) {
        window.activePlaylistTabV71 = window.appConfig.lastActivePlaylistTabV71 || 'all';
    }
};
window.ensurePlaylistStateV71();

window.savePlaylistStateQuietlyV71 = function() {
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.saveThemeOnlyQuietlyV40 === 'function') window.saveThemeOnlyQuietlyV40();
};

window.closeAllV71Modals = function() {
    [
        'jennyPlEyeModalV71', 'jennyPlSortModalV71', 'jennyCreatePlModalV71',
        'jennyImpFolderModalV71', 'jennyFolderManagerModal',
        'jennyTrackToPlModalV71', 'jennyMetaEditorModalV71'
    ].forEach(id => document.getElementById(id)?.remove());
};

// Клиентский + серверный разбор Артиста и Альбома
window.getTrackMetaV71 = function(filename) {
    const srv = (window.lastData && window.lastData.track_meta && window.lastData.track_meta[filename]) || {};
    let stem = String(filename || '').replace(/\.[^/.]+$/, '');
    stem = stem.replace(/(?:_x\d+(?:[.,]\d+)?(?:_[a-z0-9]+)*|_(?:slow|fast)(?:_[a-z0-9]+)*|_(?:jbuf90|jbuf_shift|jbuf|web_lock|web_shift|webapi|vinyl|neutral|pitchlock)|_rev(?:ersed)?)+$/ig, '');

    let artist = srv.artist || '';
    let album = srv.album || '';
    if (!artist || artist === 'Unknown Artist' || artist === 'Разные артисты') {
        const parts = stem.split(/\s+[-–—]\s+/);
        if (parts.length >= 2 && parts[0].trim()) {
            artist = parts[0].trim();
            if (parts.length >= 3 && parts[1].trim()) album = parts[1].trim();
        } else {
            artist = 'Разные артисты';
        }
    }
    if (!album || album === 'Music') {
        album = (artist && artist !== 'Разные артисты') ? (artist + ' — Сборник') : 'Основная папка';
    }
    return { artist, album, mtime: srv.mtime || 0, size: srv.size || 0, dur: srv.dur || 0 };
};

(function hookPlayStatsV71() {
    const origPlay = window.playTrack;
    if (typeof origPlay === 'function' && !window._playStatHookedV71) {
        window._playStatHookedV71 = true;
        window.playTrack = function(filename, listContext) {
            window.ensurePlaylistStateV71();
            if (filename) {
                const st = window.appConfig.trackPlayStatsV71[filename] || { count: 0, last: 0 };
                st.count = (st.count || 0) + 1;
                st.last = Date.now();
                window.appConfig.trackPlayStatsV71[filename] = st;
                localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
            }
            return origPlay.apply(this, arguments);
        };
    }
})();

window.mountPlaylistStripDOMV71 = function() {
    const searchInp = document.getElementById('trackSearchInput');
    if (!searchInp || !searchInp.parentElement) return;
    let wrap = document.getElementById('jennyPlaylistBarWrapV71');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'jennyPlaylistBarWrapV71';
        wrap.className = 'jenny-pl-bar-wrap-v71';
        wrap.innerHTML = [
            '<div id="jennyPlaylistScrollStripV71" class="jenny-pl-scroll-strip-v71"></div>',
            '<button type="button" id="btnPlEyeV71" class="jenny-pl-tool-btn-v71" onclick="window.openPlaylistVisibilityModalV71(event)">👁️</button>',
            '<button type="button" id="btnPlSortV71" class="jenny-pl-tool-btn-v71" onclick="window.openPlaylistSortModalV71(event)">⇅</button>'
        ].join('');
        searchInp.parentElement.insertAdjacentElement('afterend', wrap);
    }

    // Контейнер подленты (Артисты / Альбомы / Управление кастомным списком) строго НАД #unifiedList
    const uList = document.getElementById('unifiedList');
    if (uList && uList.parentElement && !document.getElementById('jennySubFilterWrapV71')) {
        const subWrap = document.createElement('div');
        subWrap.id = 'jennySubFilterWrapV71';
        uList.parentElement.insertBefore(subWrap, uList);
    }
    window.renderPlaylistStripChipsV71();
};

window.getAllPlaylistTabsV71 = function() {
    window.ensurePlaylistStateV71();
    const tabs = window.PLAYLIST_BUILTIN_TABS_V71.map(t => ({
        id: t.id, icon: t.icon, name: window.tr(t.ru, t.en), isBuiltin: true
    }));
    (window.appConfig.customPlaylistsV71 || []).forEach(pl => {
        tabs.push({ id: pl.id, icon: '🎶', name: pl.name, isBuiltin: false, plObj: pl });
    });
    return tabs;
};

window.getTrackCountForTabV71 = function(tabId) {
    const data = window.lastData || {};
    const allTracks = (data.all_tracks || []).filter(fn =>
        window.isTrackAllowedByFormatSlots ? window.isTrackAllowedByFormatSlots(fn) : true
    );
    if (tabId === 'all') return allTracks.length;
    if (tabId === 'fav') return (window.favorites || []).length;
    if (tabId === 'artists') {
        const s = new Set();
        allTracks.forEach(fn => s.add(window.getTrackMetaV71(fn).artist));
        return s.size;
    }
    if (tabId === 'albums') {
        const s = new Set();
        allTracks.forEach(fn => s.add(window.getTrackMetaV71(fn).album));
        return s.size;
    }
    const c = (window.appConfig.customPlaylistsV71 || []).find(p => p.id === tabId);
    return c && Array.isArray(c.tracks) ? c.tracks.length : 0;
};

window.renderPlaylistStripChipsV71 = function() {
    const strip = document.getElementById('jennyPlaylistScrollStripV71');
    if (!strip) return;
    window.ensurePlaylistStateV71();
    const visMap = window.appConfig.visiblePlaylistTabsV71 || {};
    const allTabs = window.getAllPlaylistTabsV71();
    let visTabs = allTabs.filter(t => visMap[t.id] !== false);
    if (!visTabs.length) {
        visMap.all = true;
        visTabs = allTabs.filter(t => t.id === 'all');
    }
    if (!visTabs.some(t => t.id === window.activePlaylistTabV71)) {
        window.activePlaylistTabV71 = visTabs[0].id;
    }

    let html = visTabs.map(t => {
        const isAct = (t.id === window.activePlaylistTabV71);
        const cnt = window.getTrackCountForTabV71(t.id);
        const cls = 'jenny-pl-chip-v71' + (isAct ? ' active-pl-chip' : '');
        return `<div class="${cls}" onclick="window.selectPlaylistTabV71('${t.id}', event)"><span>${t.icon}</span><span>${t.name}</span><span class="jenny-pl-chip-count-v71">${cnt}</span></div>`;
    }).join('');

    html += `<div class="jenny-pl-chip-v71" onclick="window.openCreatePlaylistModalV71(null, event)" style="border-style:dashed;color:#3fb950;"><span>➕</span><span>${window.tr('Плейлист', 'Playlist')}</span></div>`;
    strip.innerHTML = html;

    const sortBtn = document.getElementById('btnPlSortV71');
    const smap = window.appConfig.playlistSortMapV71 || {};
    const sc = smap[window.activePlaylistTabV71] || { mode: 'mtime', dir: 'desc' };
    if (sortBtn) sortBtn.textContent = sc.dir === 'asc' ? '⇅▲' : '⇅▼';
};

window.selectPlaylistTabV71 = function(tabId, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    window.ensurePlaylistStateV71();
    window.activePlaylistTabV71 = tabId;
    window.appConfig.lastActivePlaylistTabV71 = tabId;
    ['settingsModal', 'favModal', 'eqModal', 'specModal', 'themeModal'].forEach(m => {
        document.getElementById(m)?.classList.remove('open');
    });
    if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
    window.savePlaylistStateQuietlyV71();
    window.renderPlaylistStripChipsV71();
    window.renderActivePlaylistTracksV71();
};

window.sortTrackArrayForTabV71 = function(tracksArr, tabId) {
    window.ensurePlaylistStateV71();
    const isCustomTab = (tabId === 'fav' || String(tabId).startsWith('pl_'));
    const defM = isCustomTab ? 'custom' : 'mtime';
    const smap = window.appConfig.playlistSortMapV71 || {};
    const sc = smap[tabId] || { mode: defM, dir: defM === 'custom' ? 'asc' : 'desc' };
    const mode = sc.mode || defM;
    const mul = sc.dir === 'asc' ? 1 : -1;
    const stats = window.appConfig.trackPlayStatsV71 || {};
    const arr = [...tracksArr];
    if (mode === 'custom') return sc.dir === 'desc' ? arr.reverse() : arr;

    arr.sort((a, b) => {
        const ma = window.getTrackMetaV71(a);
        const mb = window.getTrackMetaV71(b);
        if (mode === 'name') return String(a).toLowerCase().localeCompare(String(b).toLowerCase()) * mul;
        if (mode === 'mtime') return ((ma.mtime || 0) - (mb.mtime || 0)) * mul;
        if (mode === 'duration') return ((ma.dur || 0) - (mb.dur || 0)) * mul;
        if (mode === 'size') return ((ma.size || 0) - (mb.size || 0)) * mul;
        if (mode === 'plays') return (((stats[a] && stats[a].count) || 0) - ((stats[b] && stats[b].count) || 0)) * mul;
        return 0;
    });
    return arr;
};

window.renderActivePlaylistTracksV71 = function() {
    const unifiedBox = document.getElementById('unifiedList');
    if (!unifiedBox || !window.lastData) return;
    window.mountPlaylistStripDOMV71();
    const subWrap = document.getElementById('jennySubFilterWrapV71');

    const tabId = window.activePlaylistTabV71 || 'all';
    const allTracks = (window.lastData.all_tracks || []).filter(fn =>
        window.isTrackAllowedByFormatSlots ? window.isTrackAllowedByFormatSlots(fn) : true
    );
    let subHtml = '';
    let baseList = [];

    if (tabId === 'all') {
        baseList = allTracks;
    } else if (tabId === 'fav') {
        baseList = window.favorites || [];
    } else if (tabId === 'artists' || tabId === 'albums') {
        const key = tabId === 'artists' ? 'artist' : 'album';
        const icon = tabId === 'artists' ? '🎤' : '💿';
        const groups = {};
        allTracks.forEach(fn => {
            const g = window.getTrackMetaV71(fn)[key];
            if (!groups[g]) groups[g] = [];
            groups[g].push(fn);
        });
        const names = Object.keys(groups).sort((a, b) => a.localeCompare(b));
        const prop = tabId === 'artists' ? 'selectedArtistV71' : 'selectedAlbumV71';
        if (!window[prop] || !groups[window[prop]]) window[prop] = names[0] || '';
        const chips = names.map(n => {
            const isSel = (n === window[prop]);
            const safeN = n.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const cls = 'jenny-pl-chip-v71' + (isSel ? ' active-pl-chip' : '');
            return `<div class="${cls}" onclick="window.${prop}='${safeN}';window.renderActivePlaylistTracksV71();">${icon}${n} <span class="jenny-pl-chip-count-v71">${groups[n].length}</span></div>`;
        }).join('');
        subHtml = `<div class="jenny-subfilter-bar-v71">${chips}</div>`;
        baseList = groups[window[prop]] || [];
    } else {
        const pl = (window.appConfig.customPlaylistsV71 || []).find(p => p.id === tabId);
        if (pl) {
            baseList = Array.isArray(pl.tracks) ? pl.tracks : [];
            subHtml = `<div class="jenny-subfilter-bar-v71" style="justify-content:space-between;"><span style="font-size:11.5px;color:#79c0ff;font-weight:bold;">🎶 ${pl.name} (${baseList.length})</span><div style="display:flex;gap:6px;"><button type="button" onclick="window.openImportFolderToPlaylistModalV71('${pl.id}')" style="padding:3px 8px;font-size:10.5px;color:#3fb950;">📁 +Папка</button><button type="button" onclick="window.deleteCustomPlaylistV71('${pl.id}')" style="padding:3px 8px;font-size:10.5px;color:#ff7b72;">🗑️ Удалить</button></div></div>`;
        }
    }

    if (subWrap) subWrap.innerHTML = subHtml;

    const sorted = window.sortTrackArrayForTabV71(baseList, tabId);
    window.currentTrackList = sorted;
    window.topTrack = sorted[0] || null;
    const cntEl = document.getElementById('tracksCount');
    if (cntEl) cntEl.innerText = sorted.length;

    let html = '';
    if (!sorted.length) {
        html = `<div style="padding:20px;color:#8b949e;text-align:center;">${window.tr('Список пуст', 'Playlist is empty')}</div>`;
    } else {
        sorted.forEach(fn => {
            const isFav = (window.favorites || []).includes(fn);
            html += buildTrackRowHTML(fn, 'main', isFav ? '❤️' : '🤍');
        });
    }
    unifiedBox.innerHTML = html;

    const sInp = document.getElementById('trackSearchInput');
    if (sInp && sInp.value.trim() && typeof window.filterTracks === 'function') {
        window.filterTracks(sInp.value);
    }
    if (window.expandedTracks && window.expandedTracks.size > 0) {
        document.querySelectorAll('.track-row-capsule.expanded-capsule').forEach(r => {
            const fn = r.getAttribute('data-track');
            if (fn) window.syncRowActionButtons(r, fn, true);
        });
    }
};

(function hookFetchAndModalsV71() {
    const origFetch = window.fetchData;
    if (typeof origFetch === 'function' && !window._fetchWrappedV71) {
        window._fetchWrappedV71 = true;
        window.fetchData = async function() {
            await origFetch.apply(this, arguments);
            window.mountPlaylistStripDOMV71();
            window.renderPlaylistStripChipsV71();
            window.renderActivePlaylistTracksV71();
        };
    }
    const origTopBar = window.updateTopSearchOrMonitorBar;
    if (typeof origTopBar === 'function' && !window._topBarWrappedV71) {
        window._topBarWrappedV71 = true;
        window.updateTopSearchOrMonitorBar = function() {
            origTopBar.apply(this, arguments);
            const sm = document.getElementById('settingsModal');
            const em = document.getElementById('eqModal');
            const sp = document.getElementById('specModal');
            const tm = document.getElementById('themeModal');
            const isOpen = (sm && sm.classList.contains('open')) ||
                           (em && em.classList.contains('open')) ||
                           (sp && sp.classList.contains('open')) ||
                           (tm && tm.classList.contains('open'));
            const plWrap = document.getElementById('jennyPlaylistBarWrapV71');
            if (plWrap) plWrap.style.display = isOpen ? 'none' : 'flex';
        };
    }
})();

window.openPlaylistVisibilityModalV71 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    window.closeAllV71Modals();
    const vis = window.appConfig.visiblePlaylistTabsV71;
    const allTabs = window.getAllPlaylistTabsV71();
    const m = document.createElement('div');
    m.id = 'jennyPlEyeModalV71';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    const rows = allTabs.map(t => {
        const chk = vis[t.id] !== false ? 'checked' : '';
        const cnt = window.getTrackCountForTabV71(t.id);
        return `<label style="display:flex;align-items:center;justify-content:space-between;background:#0d1117;border:1px solid #262c36;border-radius:9px;padding:9px 12px;cursor:pointer;"><div style="display:flex;align-items:center;gap:8px;"><input type="checkbox" ${chk} onchange="window.appConfig.visiblePlaylistTabsV71['${t.id}']=this.checked;window.savePlaylistStateQuietlyV71();window.renderPlaylistStripChipsV71();window.renderActivePlaylistTracksV71();"><span>${t.icon} ${t.name}</span></div><span style="font-size:11px;color:#79c0ff;">${cnt}</span></label>`;
    }).join('');

    m.innerHTML = `<div class="jenny-modal-card-v71" onclick="event.stopPropagation()"><div class="jenny-modal-hdr-v71"><span style="color:#58a6ff;font-weight:bold;">👁️ ${window.tr('Отображаемые плейлисты', 'Visible Playlists')}</span><button type="button" onclick="document.getElementById('jennyPlEyeModalV71').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button></div><div class="jenny-modal-body-v71">${rows}</div></div>`;
    document.body.appendChild(m);
};

window.openPlaylistSortModalV71 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    window.closeAllV71Modals();
    const tabId = window.activePlaylistTabV71 || 'all';
    const smap = window.appConfig.playlistSortMapV71 || {};
    const cur = smap[tabId] || { mode: 'mtime', dir: 'desc' };
    const m = document.createElement('div');
    m.id = 'jennyPlSortModalV71';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    const rows = window.SORT_METHODS_V71.map(sm => {
        const isSel = (cur.mode === sm.id);
        const brd = isSel ? '#58a6ff' : '#262c36';
        const clr = isSel ? '#58a6ff' : '#e6edf3';
        const arrow = isSel ? (cur.dir === 'asc' ? '▲' : '▼') : '';
        return `<div onclick="window.applySortForCurrentTabV71('${sm.id}')" style="display:flex;justify-content:space-between;align-items:center;background:#0d1117;border:1px solid ${brd};border-radius:9px;padding:10px 12px;cursor:pointer;"><span style="color:${clr};font-weight:bold;">${window.tr(sm.ru, sm.en)}</span><span style="color:#3fb950;font-size:11.5px;">${arrow}</span></div>`;
    }).join('');

    m.innerHTML = `<div class="jenny-modal-card-v71" onclick="event.stopPropagation()"><div class="jenny-modal-hdr-v71"><span style="color:#58a6ff;font-weight:bold;">⇅ ${window.tr('Сортировка текущего списка', 'Sort Current Playlist')}</span><button type="button" onclick="document.getElementById('jennyPlSortModalV71').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button></div><div class="jenny-modal-body-v71">${rows}</div></div>`;
    document.body.appendChild(m);
};

window.applySortForCurrentTabV71 = function(modeId) {
    const tabId = window.activePlaylistTabV71 || 'all';
    const prev = window.appConfig.playlistSortMapV71[tabId] || { mode: 'mtime', dir: 'desc' };
    const spec = window.SORT_METHODS_V71.find(x => x.id === modeId) || { defDir: 'desc' };
    const nextDir = prev.mode === modeId ? (prev.dir === 'asc' ? 'desc' : 'asc') : spec.defDir;
    window.appConfig.playlistSortMapV71[tabId] = { mode: modeId, dir: nextDir };
    window.savePlaylistStateQuietlyV71();
    window.closeAllV71Modals();
    window.renderPlaylistStripChipsV71();
    window.renderActivePlaylistTracksV71();
};

window.openCreatePlaylistModalV71 = async function(initialTrack, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    window.closeAllV71Modals();
    let folders = [];
    try {
        const d = await (await fetch('/api/folders_v71')).json();
        folders = d.saved_folders || [];
    } catch (e) {}

    const m = document.createElement('div');
    m.id = 'jennyCreatePlModalV71';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    const opts = folders.map(f => `<option value="${f}">${f}</option>`).join('');
    m.innerHTML = `<div class="jenny-modal-card-v71" onclick="event.stopPropagation()"><div class="jenny-modal-hdr-v71"><span style="color:#3fb950;font-weight:bold;">➕ ${window.tr('Новый плейлист', 'New Playlist')}</span><button type="button" onclick="document.getElementById('jennyCreatePlModalV71').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button></div><div class="jenny-modal-body-v71"><input type="text" id="inpNewPlNameV71" placeholder="${window.tr('Название плейлиста...', 'Playlist name...')}" style="width:100%;padding:9px;text-align:left !important;box-sizing:border-box;"><select id="selNewPlFolderV71" style="width:100%;padding:8px;background:#0d1117;color:#58a6ff;border:1px solid #30363d;border-radius:7px;"><option value="">${window.tr('— Без импорта папки —', '— No folder —')}</option>${opts}</select></div><div class="jenny-modal-ftr-v71"><button type="button" onclick="document.getElementById('jennyCreatePlModalV71').remove()" style="flex:1;padding:9px;">Отмена</button><button type="button" id="btnConfirmCreatePlV71" style="flex:1.4;padding:9px;background:#238636;color:#fff;border:none;">✅ Создать</button></div></div>`;
    document.body.appendChild(m);

    document.getElementById('btnConfirmCreatePlV71').onclick = async () => {
        const inp = document.getElementById('inpNewPlNameV71');
        const defIdx = window.appConfig.customPlaylistsV71.length + 1;
        const name = (inp?.value || '').trim() || ('Плейлист ' + defIdx);
        const fp = document.getElementById('selNewPlFolderV71')?.value || '';
        const trks = initialTrack ? [initialTrack] : [];
        if (fp) {
            try {
                const d = await (await fetch('/api/folders_v71')).json();
                const list = (d.folder_tracks && d.folder_tracks[fp]) || [];
                list.forEach(t => { if (!trks.includes(t)) trks.push(t); });
            } catch (e) {}
        }
        const npl = { id: 'pl_' + Date.now(), name, tracks: trks };
        window.appConfig.customPlaylistsV71.push(npl);
        window.appConfig.visiblePlaylistTabsV71[npl.id] = true;
        window.activePlaylistTabV71 = npl.id;
        window.savePlaylistStateQuietlyV71();
        m.remove();
        window.renderPlaylistStripChipsV71();
        window.renderActivePlaylistTracksV71();
    };
};

window.openImportFolderToPlaylistModalV71 = async function(plId) {
    window.closeAllV71Modals();
    const pl = (window.appConfig.customPlaylistsV71 || []).find(p => p.id === plId);
    if (!pl) return;
    const d = await (await fetch('/api/folders_v71')).json();
    const folders = d.saved_folders || [];
    const ft = d.folder_tracks || {};
    const m = document.createElement('div');
    m.id = 'jennyImpFolderModalV71';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    const rows = folders.map(f => {
        const sf = f.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const cnt = (ft[f] || []).length;
        return `<div onclick="window.importFolderTracksIntoPlaylistV71('${plId}','${sf}')" style="display:flex;justify-content:space-between;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:10px;cursor:pointer;"><span style="font-size:12px;word-break:break-all;">📁 ${f}</span><span style="color:#3fb950;font-weight:bold;">+${cnt}</span></div>`;
    }).join('');

    m.innerHTML = `<div class="jenny-modal-card-v71" onclick="event.stopPropagation()"><div class="jenny-modal-hdr-v71"><span style="color:#3fb950;font-weight:bold;">📁 В «${pl.name}»</span><button type="button" onclick="document.getElementById('jennyImpFolderModalV71').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button></div><div class="jenny-modal-body-v71">${rows}</div></div>`;
    document.body.appendChild(m);
};

window.importFolderTracksIntoPlaylistV71 = async function(plId, fp) {
    const pl = (window.appConfig.customPlaylistsV71 || []).find(p => p.id === plId);
    if (!pl) return;
    const d = await (await fetch('/api/folders_v71')).json();
    const list = (d.folder_tracks && d.folder_tracks[fp]) || [];
    list.forEach(fn => { if (!pl.tracks.includes(fn)) pl.tracks.push(fn); });
    window.savePlaylistStateQuietlyV71();
    window.closeAllV71Modals();
    window.renderPlaylistStripChipsV71();
    window.renderActivePlaylistTracksV71();
};

window.deleteCustomPlaylistV71 = function(plId) {
    window.appConfig.customPlaylistsV71 = (window.appConfig.customPlaylistsV71 || []).filter(p => p.id !== plId);
    window.activePlaylistTabV71 = 'all';
    window.savePlaylistStateQuietlyV71();
    window.renderPlaylistStripChipsV71();
    window.renderActivePlaylistTracksV71();
};

// Мульти-папки с галочками (дополнение вместо исключения)
window.openFolderManagerModalV62 = async function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    window.closeAllV71Modals();
    let saved = window.getSavedFoldersListV62 ? window.getSavedFoldersListV62() : ['/storage/emulated/0/Music'];
    let active = [saved[0]];
    let ft = {};
    try {
        const d = await (await fetch('/api/folders_v71')).json();
        saved = d.saved_folders || saved;
        active = d.active_folders || active;
        ft = d.folder_tracks || {};
    } catch (e) {}

    const m = document.createElement('div');
    m.id = 'jennyFolderManagerModal';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    const rows = saved.map(p => {
        const isSel = active.includes(p);
        const sp = p.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const shortN = p.split('/').filter(Boolean).pop() || p;
        const cnt = (ft[p] || []).length;
        const delBtn = saved.length > 1
            ? `<button type="button" onclick="event.stopPropagation();window.removeFolderFromPoolV71('${sp}')" style="padding:5px 8px;color:#f85149;">🗑️</button>`
            : '';
        return `<div onclick="window.toggleFolderActivePoolV71('${sp}',event)" style="display:flex;align-items:center;background:#0d1117;border:1px solid ${isSel ? '#3fb950' : '#262c36'};border-radius:8px;padding:9px 10px;gap:8px;cursor:pointer;"><input type="checkbox" ${isSel ? 'checked' : ''} style="pointer-events:none;"><div style="flex:1;min-width:0;"><div style="color:${isSel ? '#3fb950' : '#e6edf3'};font-weight:bold;">📁 ${shortN} (${cnt})</div><div style="color:#8b949e;font-size:10.5px;word-break:break-all;">${p}</div></div>${delBtn}</div>`;
    }).join('');

    m.innerHTML = `<div class="jenny-modal-card-v71" onclick="event.stopPropagation()"><div class="jenny-modal-hdr-v71"><span style="color:#58a6ff;font-weight:bold;">📁 ${window.tr('Музыкальные папки (Слияние)', 'Music Folders (Multi-Pool)')}</span><button type="button" onclick="document.getElementById('jennyFolderManagerModal').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button></div><div class="jenny-modal-body-v71">${rows}<div style="display:flex;gap:6px;margin-top:6px;"><input type="text" id="newFolderInputV62" placeholder="/storage/emulated/0/..." style="flex:1;padding:7px;text-align:left !important;"><button type="button" onclick="window.addFolderToPoolV71()" style="padding:7px 12px;color:#3fb950;">➕</button><button type="button" onclick="window.triggerSystemFolderPickerV62()" style="padding:7px 10px;color:#58a6ff;">📂</button></div></div></div>`;
    document.body.appendChild(m);
};

window.toggleFolderActivePoolV71 = async function(fp, ev) {
    const d = await (await fetch('/api/folders_v71', { method: 'POST', body: JSON.stringify({ action: 'toggle', path: fp }) })).json();
    if (d.status === 'ok') { await window.fetchData(); window.openFolderManagerModalV62(); }
    else if (typeof window.showToast === 'function') window.showToast('❌ ' + (d.error || 'Ошибка'), ev);
};
window.addFolderToPoolV71 = async function() {
    const val = (document.getElementById('newFolderInputV62')?.value || '').trim();
    if (!val) return;
    const d = await (await fetch('/api/folders_v71', { method: 'POST', body: JSON.stringify({ action: 'add', path: val }) })).json();
    if (d.status === 'ok') { await window.fetchData(); window.openFolderManagerModalV62(); }
    else if (typeof window.showToast === 'function') window.showToast('❌ ' + (d.error || 'Ошибка'));
};
window.removeFolderFromPoolV71 = async function(fp) {
    const d = await (await fetch('/api/folders_v71', { method: 'POST', body: JSON.stringify({ action: 'remove', path: fp }) })).json();
    if (d.status === 'ok') { await window.fetchData(); window.openFolderManagerModalV62(); }
};

// СЛОТЫ 1-3 В РАСКРЫТОЙ КАРТОЧКЕ ТРЕКА (+ СПИСОК, УДАЛ., МЕТА)
window.syncRowActionButtons = function(row, filename, isExp) {
    if (!row) return;
    let bar = row.querySelector('.track-expand-actions-v68');
    let sub = row.querySelector('.track-expand-subline-v68');
    if (!isExp) { bar?.remove(); sub?.remove(); return; }
    const isEn = window.isTrackUiEnglish && window.isTrackUiEnglish();
    if (!bar) {
        bar = document.createElement('div');
        bar.className = 'track-expand-actions-v68';
        bar.onclick = (e) => e.stopPropagation();
        const info = window.parseDerivedTrackInfo ? window.parseDerivedTrackInfo(filename) : { isDerived: false };
        if (info.isDerived) {
            const bOrig = document.createElement('button');
            bOrig.type = 'button';
            bOrig.className = 'track-act-btn-v68 btn-orig-v68';
            bOrig.innerText = isEn ? 'ORIG' : 'ОРИГ';
            bOrig.onclick = (e) => window.scrollToOriginalTrack(filename, bOrig, e);
            bar.appendChild(bOrig);
        }
        const bPath = document.createElement('button');
        bPath.type = 'button';
        bPath.className = 'track-act-btn-v68 btn-path-v68';
        bPath.innerText = isEn ? 'PATH' : 'ПУТЬ';
        bPath.onclick = (e) => window.copyTrackFullPath(filename, e);
        bar.appendChild(bPath);

        const bList = document.createElement('button');
        bList.type = 'button';
        bList.className = 'track-act-btn-v68 btn-slot-list-v71';
        bList.innerText = isEn ? '+ LIST' : '+ СПИСОК';
        bList.onclick = (e) => window.openTrackAddToPlaylistModalV71(filename, e);
        bar.appendChild(bList);

        const bDel = document.createElement('button');
        bDel.type = 'button';
        bDel.className = 'track-act-btn-v68 btn-slot-del-v71';
        bDel.innerText = isEn ? 'DEL' : 'УДАЛ.';
        bDel.onclick = (e) => window.handleTrackDeleteSlotV71(filename, bDel, e);
        bar.appendChild(bDel);

        const bMeta = document.createElement('button');
        bMeta.type = 'button';
        bMeta.className = 'track-act-btn-v68 btn-slot-meta-v71';
        bMeta.innerText = isEn ? 'META' : 'МЕТА';
        bMeta.onclick = (e) => window.openTrackMetadataEditorV71(filename, e);
        bar.appendChild(bMeta);
        row.appendChild(bar);
    }
    const savedSub = window.expandedTrackSublines && window.expandedTrackSublines.get(filename);
    if (savedSub && savedSub.text) {
        if (!sub) {
            sub = document.createElement('div');
            sub.className = 'track-expand-subline-v68';
            sub.onclick = (e) => e.stopPropagation();
            row.appendChild(sub);
        }
        sub.textContent = savedSub.text;
        sub.classList.add('visible-subline-v68');
        sub.classList.toggle('deleted-subline-v68', Boolean(savedSub.isDeleted));
    }
};

window.openTrackAddToPlaylistModalV71 = function(filename, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    window.closeAllV71Modals();
    const isFav = (window.favorites || []).includes(filename);
    const pls = window.appConfig.customPlaylistsV71 || [];
    const safeFn = filename.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const m = document.createElement('div');
    m.id = 'jennyTrackToPlModalV71';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    const plRows = pls.map(pl => {
        const has = (pl.tracks || []).includes(filename) ? 'checked' : '';
        return `<label style="display:flex;align-items:center;gap:8px;background:#0d1117;border:1px solid #262c36;border-radius:8px;padding:9px 12px;cursor:pointer;"><input type="checkbox" ${has} onchange="window.toggleTrackInCustomPlaylistV71('${pl.id}','${safeFn}',this.checked)"><span>🎶 ${pl.name}</span></label>`;
    }).join('');

    m.innerHTML = `<div class="jenny-modal-card-v71" onclick="event.stopPropagation()"><div class="jenny-modal-hdr-v71"><span style="color:#d2a8ff;font-weight:bold;">➕ ${window.tr('Добавить в список', 'Add to Playlist')}</span><button type="button" onclick="document.getElementById('jennyTrackToPlModalV71').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button></div><div class="jenny-modal-body-v71"><div style="font-size:11.5px;color:#79c0ff;word-break:break-all;">♪ ${filename}</div><label style="display:flex;align-items:center;gap:8px;background:#0d1117;border:1px solid #262c36;border-radius:8px;padding:9px 12px;cursor:pointer;"><input type="checkbox" ${isFav ? 'checked' : ''} onchange="window.toggleFav('${safeFn}');window.renderPlaylistStripChipsV71();window.renderActivePlaylistTracksV71();"><span>❤️ ${window.tr('Избранное', 'Favorites')}</span></label>${plRows}<button type="button" onclick="document.getElementById('jennyTrackToPlModalV71').remove();window.openCreatePlaylistModalV71('${safeFn}',event);" style="padding:9px;border-style:dashed;color:#3fb950;">➕ ${window.tr('Новый плейлист с этим треком', 'New playlist with track')}</button></div></div>`;
    document.body.appendChild(m);
};

window.toggleTrackInCustomPlaylistV71 = function(plId, fn, add) {
    const pl = (window.appConfig.customPlaylistsV71 || []).find(p => p.id === plId);
    if (!pl) return;
    pl.tracks = pl.tracks || [];
    if (add && !pl.tracks.includes(fn)) pl.tracks.push(fn);
    else if (!add) pl.tracks = pl.tracks.filter(x => x !== fn);
    window.savePlaylistStateQuietlyV71();
    window.renderPlaylistStripChipsV71();
    window.renderActivePlaylistTracksV71();
};

window.handleTrackDeleteSlotV71 = async function(filename, btnEl, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const isEn = window.isTrackUiEnglish && window.isTrackUiEnglish();
    if (!btnEl.classList.contains('confirm-armed-v71')) {
        btnEl.classList.add('confirm-armed-v71');
        btnEl.innerText = isEn ? 'SURE?' : 'ТОЧНО?';
        if (btnEl._t) clearTimeout(btnEl._t);
        btnEl._t = setTimeout(() => {
            btnEl.classList.remove('confirm-armed-v71');
            btnEl.innerText = isEn ? 'DEL' : 'УДАЛ.';
        }, 3500);
        return;
    }
    const d = await (await fetch('/api/delete_track_v71', { method: 'POST', body: JSON.stringify({ filename }) })).json();
    if (d.status === 'ok') {
        window.expandedTracks.delete(filename);
        await window.fetchData();
        if (typeof window.showToast === 'function') window.showToast(`🗑️ Удалено: ${filename}`, ev);
    }
};

window.openTrackMetadataEditorV71 = async function(filename, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    window.closeAllV71Modals();
    const m = document.createElement('div');
    m.id = 'jennyMetaEditorModalV71';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    m.innerHTML = `<div class="jenny-modal-card-v71" onclick="event.stopPropagation()"><div class="jenny-modal-hdr-v71"><span style="color:#e3b341;font-weight:bold;">🏷️ ${window.tr('Редактор метаданных и капсулы', 'Metadata & Capsule Editor')}</span><button type="button" onclick="document.getElementById('jennyMetaEditorModalV71').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button></div><div class="jenny-modal-body-v71" id="jennyMetaBodyV71">⏳...</div><div class="jenny-modal-ftr-v71"><button type="button" onclick="document.getElementById('jennyMetaEditorModalV71').remove()" style="flex:1;padding:9px;">Отмена</button><button type="button" id="btnSaveMetaV71" style="flex:1.5;padding:9px;background:#238636;color:#fff;border:none;">💾 Сохранить</button></div></div>`;
    document.body.appendChild(m);

    const info = await (await fetch('/api/track_meta_v71', { method: 'POST', body: JSON.stringify({ filename }) })).json();
    const body = document.getElementById('jennyMetaBodyV71');
    if (!body || info.status !== 'ok') return;

    const tags = info.tags || {};
    const keys = ['TITLE', 'ARTIST', 'ALBUM', 'GENRE', 'DATE', 'COMMENT'];
    Object.keys(tags).forEach(k => { if (!keys.includes(k)) keys.push(k); });
    const rev = info.rev || { has_rev: false };
    const pckKb = ((rev.pocket_bytes || 0) / 1024).toFixed(1);

    const tagInputs = keys.map(k => {
        const val = (tags[k] || '').replace(/"/g, '&quot;');
        return `<div class="meta-tag-row-v71" style="display:flex;gap:6px;"><input type="text" class="meta-tag-key-v71" value="${k}" style="width:34%;padding:6px;font-size:11px;text-align:left !important;"><input type="text" class="meta-tag-val-v71" value="${val}" style="flex:1;padding:6px;font-size:12px;text-align:left !important;"></div>`;
    }).join('');

    const revHtml = rev.has_rev ? [
        '<div style="border-top:1px solid #30363d;padding-top:10px;margin-top:6px;">',
        '<label style="display:flex;align-items:center;gap:8px;background:#0d1117;border:1px solid #f85149;border-radius:8px;padding:8px 10px;cursor:pointer;">',
        '<input type="checkbox" id="chkUnlockRevEditV71" onchange="document.getElementById(\'revWarnV71\').style.display=this.checked?\'block\':\'none\';document.getElementById(\'revFieldsV71\').style.display=this.checked?\'flex\':\'none\';">',
        '<span style="font-size:11.5px;color:#ff7b72;font-weight:bold;">🔓 Изменить поля восстановления / бэкапа сэмплов (JENNYV67)</span></label>',
        '<div id="revWarnV71" class="jenny-warn-box-v71" style="display:none;margin-top:8px;">',
        '⚠️ <b>ВНИМАНИЕ: ПОТЕРЯ ВОЗМОЖНОСТИ ВОССТАНОВЛЕНИЯ!</b><br>',
        `В этих полях хранятся точные координаты склеек волны и резервный бэкап вырезанных сэмплов (${pckKb} KB). Если вы измените эти значения или удалите бэкап сэмплов, сам аудиофайл продолжит нормально проигрываться, но вы <b>больше не сможете</b> математически точно восстановить из него исходный оригинал 1.0x без швов и потери качества при смене скорости!`,
        '</div>',
        '<div id="revFieldsV71" style="display:none;flex-direction:column;gap:6px;margin-top:8px;background:#0d1117;padding:9px;border-radius:8px;border:1px solid #30363d;">',
        `<div style="display:flex;justify-content:space-between;"><span>Исходная скорость (spd):</span><input type="number" step="0.01" id="inpRevSpdV71" value="${rev.spd || 1.0}" style="width:75px;"></div>`,
        `<div style="display:flex;justify-content:space-between;"><span>Упругость (%):</span><input type="number" step="5" id="inpRevTensionV71" value="${rev.tension || 100}" style="width:75px;"></div>`,
        `<div style="display:flex;justify-content:space-between;"><span>Длина оригинала (сэмплов):</span><input type="number" id="inpRevOrigLenV71" value="${rev.origLen || 0}" style="width:110px;"></div>`,
        '<select id="selRevActionV71" style="padding:6px;background:#05070a;color:#ff7b72;border:1px solid #f85149;border-radius:6px;">',
        '<option value="modify">Сохранить изменённые поля</option>',
        `<option value="strip_pocket">Удалить бэкап сэмплов (${pckKb} KB)</option>`,
        '<option value="strip_all">Полностью стереть капсулу возврата</option>',
        '</select></div></div>'
    ].join('') : '';

    body.innerHTML = `<div style="font-size:11.5px;color:#8b949e;">📝 Имя файла:</div><input type="text" id="inpMetaFilenameV71" value="${info.filename.replace(/"/g, '&quot;')}" style="width:100%;padding:8px;color:#3fb950 !important;text-align:left !important;box-sizing:border-box;"><div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;"><span style="font-size:11.5px;color:#8b949e;">🏷️ Теги:</span><button type="button" onclick="window.addCustomMetaTagRowV71()" style="padding:3px 8px;font-size:11px;">➕ Поле</button></div><div id="metaTagsListV71" style="display:flex;flex-direction:column;gap:6px;">${tagInputs}</div>${revHtml}`;

    document.getElementById('btnSaveMetaV71').onclick = async () => {
        const new_filename = (document.getElementById('inpMetaFilenameV71')?.value || filename).trim();
        const tOut = {};
        document.querySelectorAll('.meta-tag-row-v71').forEach(row => {
            const k = (row.querySelector('.meta-tag-key-v71')?.value || '').trim();
            const v = (row.querySelector('.meta-tag-val-v71')?.value || '').trim();
            if (k && v) tOut[k] = v;
        });
        const unlocked = Boolean(document.getElementById('chkUnlockRevEditV71')?.checked);
        const rev_action = unlocked ? (document.getElementById('selRevActionV71')?.value || 'modify') : 'keep';
        const rev_updates = unlocked ? {
            spd: parseFloat(document.getElementById('inpRevSpdV71')?.value || '1.0'),
            tension: parseFloat(document.getElementById('inpRevTensionV71')?.value || '100'),
            origLen: parseInt(document.getElementById('inpRevOrigLenV71')?.value || '0', 10)
        } : {};

        const res = await (await fetch('/api/save_meta_v71', {
            method: 'POST',
            body: JSON.stringify({ filename, new_filename, tags: tOut, rev_action, rev_updates })
        })).json();
        if (res.status === 'ok') {
            window.closeAllV71Modals();
            await window.fetchData();
            if (typeof window.showToast === 'function') window.showToast(`✅ Сохранено: ${res.new_filename}`);
        }
    };
};

window.addCustomMetaTagRowV71 = function() {
    const l = document.getElementById('metaTagsListV71');
    if (!l) return;
    const d = document.createElement('div');
    d.className = 'meta-tag-row-v71';
    d.style.cssText = 'display:flex;gap:6px;';
    d.innerHTML = `<input type="text" class="meta-tag-key-v71" placeholder="TAG" style="width:34%;padding:6px;font-size:11px;text-align:left !important;"><input type="text" class="meta-tag-val-v71" placeholder="Значение" style="flex:1;padding:6px;font-size:12px;text-align:left !important;">`;
    l.appendChild(d);
};

setTimeout(() => {
    window.mountPlaylistStripDOMV71();
    if (typeof window.fetchData === 'function') window.fetchData();
}, 200);


// === V71.2 SINGLE AUDIO GUARD & MULTI-FOLDER PERSISTENCE ===
window._activeBufferSourcesV71 = new Set();

(function installSingleAudioSourceGuardV71() {
    const patchCtx = () => {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC || AC.prototype._jennyGuardedV71) return;
        AC.prototype._jennyGuardedV71 = true;
        const origCreate = AC.prototype.createBufferSource;
        AC.prototype.createBufferSource = function() {
            const node = origCreate.apply(this, arguments);
            const origStart = node.start;
            node.start = function() {
                // Перед запуском любого нового RAM-буфера глушим все предыдущие запущенные буферы!
                window._activeBufferSourcesV71.forEach(oldNode => {
                    if (oldNode !== node) {
                        oldNode.onended = null;
                        try { oldNode.stop(); } catch (e) {}
                        try { oldNode.disconnect(); } catch (e) {}
                    }
                });
                window._activeBufferSourcesV71.clear();
                window._activeBufferSourcesV71.add(node);
                if (window.htmlGain && window.htmlGain.gain) {
                    window.htmlGain.gain.value = 0.0;
                }
                return origStart.apply(this, arguments);
            };
            return node;
        };
    };
    patchCtx();
    setTimeout(patchCtx, 100);
})();

// Переопределяем engageDirectRamPitchShiftV70 для идеально чистой работы 2-й передачи и Винила
window.engageDirectRamPitchShiftV70 = function(gearKey, targetSpd) {
    const player = document.getElementById('audioPlayer');
    if (!player || !window.audioCtx) return false;

    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    const hasRev67 = Boolean(
        window.reconstructedMasterBufferV67 &&
        window.currentTrackRevMapV67 &&
        window.currentTrackRevNameV67 === window.currentPlayingTrack
    );

    let rawBuf = hasRev67
        ? (isRev ? (window.reconstructedReversedBufferV67 || window.reconstructedMasterBufferV67) : window.reconstructedMasterBufferV67)
        : (isRev ? (window.reversedStudioBuffer || window.studioBuffer) : window.studioBuffer);

    if (!rawBuf) {
        window._activeBufferSourcesV71.forEach(n => {
            n.onended = null;
            try { n.stop(); } catch (e) {}
            try { n.disconnect(); } catch (e) {}
        });
        window._activeBufferSourcesV71.clear();
        window.studioSourceNode = null;
        window.isStudioPlaying = false;
        if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
        player.preservesPitch = false;
        player.mozPreservesPitch = false;
        player.webkitPreservesPitch = false;
        if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
            try { player.playbackRate = targetSpd; } catch (e) {}
        }
        return false;
    }

    if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
    player.preservesPitch = false;
    if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
        try { player.playbackRate = targetSpd; } catch (e) {}
    }

    const isVinyl = (gearKey === 'vinyl-shift');
    const effSpd = hasRev67
        ? Math.max(0.25, Math.min(3.0, (parseFloat(window.currentTrackRevMapV67.spd) || 1.0) * targetSpd))
        : targetSpd;

    if (!player.paused) {
        const needNewNode = !window.studioSourceNode ||
                            !window.isStudioPlaying ||
                            window.studioSourceNode.buffer !== rawBuf ||
                            Boolean(window.studioSourceNode._isHoseSpliced);
        if (needNewNode) {
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null;
                try { window.studioSourceNode.stop(); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
            }
            window.studioSourceNode = window.audioCtx.createBufferSource();
            window.studioSourceNode._isHoseSpliced = false;
            window.studioSourceNode.buffer = rawBuf;
            window.studioSourceNode.playbackRate.value = effSpd;
            window.studioSourceNode.connect(window.inputMixer);

            let offset = player.currentTime || 0;
            if (!isFinite(offset) || offset < 0) offset = 0;
            if (offset >= rawBuf.duration) offset = Math.max(0, rawBuf.duration - 0.05);

            window.studioSourceNode.start(0, offset);
            window.isStudioPlaying = true;
        } else if (window.studioSourceNode && window.studioSourceNode.playbackRate) {
            const now = window.audioCtx.currentTime;
            if (isVinyl) {
                window.studioSourceNode.playbackRate.setTargetAtTime(effSpd, now, 0.085);
            } else {
                window.studioSourceNode.playbackRate.setValueAtTime(effSpd, now);
            }
        }
    } else {
        window._activeBufferSourcesV71.forEach(n => {
            n.onended = null;
            try { n.stop(); } catch (e) {}
            try { n.disconnect(); } catch (e) {}
        });
        window._activeBufferSourcesV71.clear();
        window.studioSourceNode = null;
        window.isStudioPlaying = false;
    }

    const badge = document.getElementById('hoseLiveTelemetryV44');
    if (badge) {
        badge.style.color = isVinyl ? '#d2a8ff' : '#3fb950';
        badge.innerText = isVinyl
            ? `💿 ВИНИЛ [RAM Platter]: x${effSpd.toFixed(2)} (Инерция 85мс)`
            : `⚡ J Buf RAM [PITCH SHIFT]: x${effSpd.toFixed(2)} (Прямой 32-bit буфер)`;
    }
    return true;
};

// Синхронизируем activeFolders в window.appConfig при каждом fetchData, чтобы 246 треков никогда не сбрасывались
const _prevFetchV71 = window.fetchData;
window.fetchData = async function() {
    await _prevFetchV71.apply(this, arguments);
    if (window.lastData) {
        window.appConfig = window.appConfig || {};
        if (Array.isArray(window.lastData.active_folders)) {
            window.appConfig.activeFolders = window.lastData.active_folders;
        }
        if (Array.isArray(window.lastData.saved_folders)) {
            window.appConfig.savedFolders = window.lastData.saved_folders;
        }
        localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    }
    if (typeof window.updateTrackListPlayIcons === 'function') {
        window.updateTrackListPlayIcons();
    }
};


// === V71.4 INSTANT HORIZON SPLICER FOR LONG TRACKS (5ms ZERO-LAG JBUF) & MODAL HEADER CLEANUP ===

window._horizonSliceTimerV71 = null;

// Вырезает окно [startSec .. startSec + winSec] из гигантского буфера в маленький AudioBuffer (при необходимости разворачивая для реверса)
window.extractWindowBufferV71 = function(srcBuf, startSec, winSec, isRev) {
    if (!srcBuf || !window.audioCtx) return null;
    const player = document.getElementById('audioPlayer');
    const sr = srcBuf.sampleRate;
    const numCh = srcBuf.numberOfChannels;
    const totalLen = srcBuf.length;
    const dur = srcBuf.duration;

    if (!isRev) {
        let cleanStart = Math.max(0, Math.min(dur - 0.05, startSec));
        let startFrame = Math.min(totalLen - 256, Math.max(0, Math.floor(cleanStart * sr)));
        let frameCount = Math.max(256, Math.min(Math.floor(winSec * sr), totalLen - startFrame));
        let subBuf = window.audioCtx.createBuffer(numCh, frameCount, sr);
        for (let c = 0; c < numCh; c++) {
            subBuf.getChannelData(c).set(srcBuf.getChannelData(c).subarray(startFrame, startFrame + frameCount));
        }
        return subBuf;
    } else {
        // При реверсе player.currentTime = dur - realForwardSec, поэтому позиция в прямом буфере = dur - startSec
        const refDur = (player && isFinite(player.duration) && player.duration > 0) ? player.duration : dur;
        let forwardPosSec = Math.max(0.15, Math.min(dur, refDur - startSec));
        let revEndFrame = Math.min(totalLen, Math.max(256, Math.floor(forwardPosSec * sr)));
        let frameCount = Math.max(256, Math.min(Math.floor(winSec * sr), revEndFrame));
        let subBuf = window.audioCtx.createBuffer(numCh, frameCount, sr);
        for (let c = 0; c < numCh; c++) {
            const inp = srcBuf.getChannelData(c);
            const out = subBuf.getChannelData(c);
            for (let i = 0; i < frameCount; i++) {
                out[i] = inp[revEndFrame - 1 - i];
            }
        }
        return subBuf;
    }
};

// Мгновенный запуск 1-й передачи (J Buf 90° Pitch Lock) с горизонтом 45 сек для треков > 10 минут
window.engageInstantHorizonJbufLockV71 = function(isDraggingArc) {
    const player = document.getElementById('audioPlayer');
    const badge = document.getElementById('hoseLiveTelemetryV44');
    if (!player || !window.studioBuffer || !window.audioCtx) return false;

    // Если трек короткий (< 600 сек = 10 минут), используем обычный полный буфер
    if (window.studioBuffer.duration <= 600) {
        return false;
    }

    if (isDraggingArc) {
        if (window._hoseArcDebounceTimerV47) clearTimeout(window._hoseArcDebounceTimerV47);
        window._hoseArcDebounceTimerV47 = setTimeout(() => {
            window.syncMasterPlaybackEngineV59(false);
        }, 55);
        return true;
    }

    if (window._horizonSliceTimerV71) {
        clearTimeout(window._horizonSliceTimerV71);
        window._horizonSliceTimerV71 = null;
    }

    const targetSpd = (typeof window.getActiveTargetSpeedV59 === 'function')
        ? window.getActiveTargetSpeedV59()
        : (player.playbackRate || 1.0);
    const tensionPct = (window.appConfig && window.appConfig.hoseTensionPct !== undefined)
        ? window.appConfig.hoseTensionPct
        : 100;
    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

    const curSec = player.currentTime || 0;
    const WIN_SEC = 45.0; // Нарезаем 45 секунд вперёд — занимает всего ~5 мс!
    const rawWindowBuf = window.extractWindowBufferV71(window.studioBuffer, curSec, WIN_SEC, isRev);
    if (!rawWindowBuf) return false;

    const t0 = performance.now();
    const splicedWindowBuf = window.buildElasticHoseBufferV46(rawWindowBuf, targetSpd, tensionPct);
    const buildMs = Math.round(performance.now() - t0);

    if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
    player.preservesPitch = false;
    if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
        try { player.playbackRate = targetSpd; } catch (e) {}
    }

    if (!player.paused) {
        if (window.studioSourceNode) {
            window.studioSourceNode.onended = null;
            try { window.studioSourceNode.stop(); } catch (e) {}
            try { window.studioSourceNode.disconnect(); } catch (e) {}
        }
        window.studioSourceNode = window.audioCtx.createBufferSource();
        window.studioSourceNode._isHoseSpliced = true;
        window.studioSourceNode._isHorizonWindowV71 = true;
        window.studioSourceNode.buffer = splicedWindowBuf;
        window.studioSourceNode.playbackRate.value = 1.0;
        window.studioSourceNode.connect(window.inputMixer);
        window.studioSourceNode.start(0, 0);
        window.isStudioPlaying = true;

        // Планируем бесшовную подкачку следующего 45-секундного окна за 1.2 сек до конца текущего
        const realPlayDurationMs = Math.max(500, (splicedWindowBuf.duration - 1.2) * 1000);
        window._horizonSliceTimerV71 = setTimeout(() => {
            const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
            if (!player.paused && gKey === 'jbuf-lock' && window.studioBuffer && window.studioBuffer.duration > 600) {
                window.engageInstantHorizonJbufLockV71(false);
            }
        }, realPlayDurationMs);
    }

    if (badge) {
        const c = window._hoseSplicerCacheV46 || {};
        badge.style.color = '#3fb950';
        badge.innerText = `⚡ J Buf 90° [HORIZON 45s]: x${targetSpd.toFixed(2)} | Δy=${((c.avgSeamErrMv || 0) * 100).toFixed(1)}% (${buildMs}мс)`;
    }
    return true;
};

// Перехватываем syncMasterPlaybackEngineV59, чтобы на длинных треках (>10 мин) 1-я передача включалась за 5 мс через Horizon Splicer!
(function wrapMasterSyncForHorizonV71() {
    const prevSync = window.syncMasterPlaybackEngineV59;
    window.syncMasterPlaybackEngineV59 = function(isDraggingArc) {
        if (window._horizonSliceTimerV71) {
            clearTimeout(window._horizonSliceTimerV71);
            window._horizonSliceTimerV71 = null;
        }
        const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
        if (gKey === 'jbuf-lock' && window.studioBuffer && window.studioBuffer.duration > 600) {
            if (window.engageInstantHorizonJbufLockV71(isDraggingArc)) {
                return;
            }
        }
        return prevSync.apply(this, arguments);
    };
})();

// Также ускоряем 2-ю передачу (J Buf Pitch Shift) и Заднюю R (Винил) на длинных треках при реверсе
const _origEngageShiftV71 = window.engageDirectRamPitchShiftV70;
window.engageDirectRamPitchShiftV70 = function(gearKey, targetSpd) {
    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    if (isRev && window.studioBuffer && window.studioBuffer.duration > 900 && !window.reversedStudioBuffer) {
        const player = document.getElementById('audioPlayer');
        if (player && window.audioCtx) {
            const curSec = player.currentTime || 0;
            const winBuf = window.extractWindowBufferV71(window.studioBuffer, curSec, 60.0, true);
            if (winBuf) {
                if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
                player.preservesPitch = false;
                if (window.studioSourceNode) {
                    window.studioSourceNode.onended = null;
                    try { window.studioSourceNode.stop(); } catch (e) {}
                    try { window.studioSourceNode.disconnect(); } catch (e) {}
                }
                window.studioSourceNode = window.audioCtx.createBufferSource();
                window.studioSourceNode._isHoseSpliced = false;
                window.studioSourceNode.buffer = winBuf;
                window.studioSourceNode.playbackRate.value = targetSpd;
                window.studioSourceNode.connect(window.inputMixer);
                if (!player.paused) {
                    window.studioSourceNode.start(0, 0);
                    window.isStudioPlaying = true;
                }
                return true;
            }
        }
    }
    return _origEngageShiftV71.apply(this, arguments);
};

// Прячем ленту плейлистов и поджимаем высоту шапки до 102px, когда открыто любое модальное окно (⚙️, 🄠, 📊, 🎨)
window.syncHeaderHeightWithModalsV71 = function() {
    const sm = document.getElementById('settingsModal');
    const em = document.getElementById('eqModal');
    const sp = document.getElementById('specModal');
    const tm = document.getElementById('themeModal');
    const fm = document.getElementById('favModal');
    const isOpen = (sm && sm.classList.contains('open')) ||
                   (em && em.classList.contains('open')) ||
                   (sp && sp.classList.contains('open')) ||
                   (tm && tm.classList.contains('open')) ||
                   (fm && fm.classList.contains('open'));

    const plWrap = document.getElementById('jennyPlaylistBarWrapV71');
    const stickyTop = document.querySelector('.sticky-top');
    if (plWrap) {
        plWrap.style.setProperty('display', isOpen ? 'none' : 'flex', 'important');
    }
    if (stickyTop) {
        stickyTop.style.setProperty('height', isOpen ? '102px' : '140px', 'important');
    }
    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.style.setProperty('top', isOpen ? '102px' : '140px', 'important');
    });
};

(function attachHeaderModalSyncV71() {
    const obs = new MutationObserver(() => window.syncHeaderHeightWithModalsV71());
    ['settingsModal', 'eqModal', 'favModal', 'specModal', 'themeModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) obs.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
    });
    const origToggle = window.toggleModal;
    if (typeof origToggle === 'function' && !window._toggleModalHeaderHookV71) {
        window._toggleModalHeaderHookV71 = true;
        window.toggleModal = function(id) {
            const r = origToggle.apply(this, arguments);
            window.syncHeaderHeightWithModalsV71();
            setTimeout(window.syncHeaderHeightWithModalsV71, 30);
            return r;
        };
    }
    window.syncHeaderHeightWithModalsV71();
})();


// === V71.5 PERFECT GEARBOX & HORIZON ENGINE (1st, 2nd, R, N & REVERSE ON 1-3H TRACKS) ===

// Отключаем старый дублирующий загрузчик V61, чтобы он не качал 200 МБ во второй поток
window.ensureStudioBufferLoadedV61 = function() {};

// Единый менеджер оконного горизонта (45 сек) и для 1-й передачи (J Buf 90°), и для 2-й (J Buf Pitch Shift), и для Задней R (Винил)
window.engageHorizonRamEngineV71_5 = function(gearKey, isDraggingArc) {
    const player = document.getElementById('audioPlayer');
    const badge = document.getElementById('hoseLiveTelemetryV44');
    if (!player || !window.audioCtx) return false;

    const targetSpd = (typeof window.getActiveTargetSpeedV59 === 'function')
        ? window.getActiveTargetSpeedV59()
        : (player.playbackRate || 1.0);
    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

    // Если буфер ещё совсем не создан (первые 0.3 сек старта), честно выставляем параметры на HTML5 плеере:
    if (!window.studioBuffer) {
        if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
        const wantPitchLock = (gearKey === 'jbuf-lock' || gearKey === 'web-lock' || gearKey === 'neutral');
        player.preservesPitch = wantPitchLock;
        player.mozPreservesPitch = wantPitchLock;
        player.webkitPreservesPitch = wantPitchLock;
        const spd = (gearKey === 'neutral') ? 1.0 : targetSpd;
        if (Math.abs(player.playbackRate - spd) > 0.003) {
            try { player.playbackRate = spd; } catch (e) {}
        }
        return true;
    }

    // Для коротких треков (<= 600 сек) используем это окно только если включён Реверс без reversedStudioBuffer
    if (window.studioBuffer.duration <= 600 && !(isRev && !window.reversedStudioBuffer)) {
        return false;
    }

    if (isDraggingArc) {
        if (window._hoseArcDebounceTimerV47) clearTimeout(window._hoseArcDebounceTimerV47);
        window._hoseArcDebounceTimerV47 = setTimeout(() => {
            window.syncMasterPlaybackEngineV59(false);
        }, 50);
        return true;
    }

    if (window._horizonSliceTimerV71) {
        clearTimeout(window._horizonSliceTimerV71);
        window._horizonSliceTimerV71 = null;
    }

    const curSec = player.currentTime || 0;
    const WIN_SEC = 45.0;
    const rawWindowBuf = window.extractWindowBufferV71(window.studioBuffer, curSec, WIN_SEC, isRev);
    if (!rawWindowBuf) return false;

    if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
    player.preservesPitch = false;
    if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
        try { player.playbackRate = targetSpd; } catch (e) {}
    }

    let playBuf = rawWindowBuf;
    let nodeRate = 1.0;
    let buildMs = 0;

    if (gearKey === 'jbuf-lock') {
        const tensionPct = (window.appConfig && window.appConfig.hoseTensionPct !== undefined)
            ? window.appConfig.hoseTensionPct
            : 100;
        const t0 = performance.now();
        playBuf = window.buildElasticHoseBufferV46(rawWindowBuf, targetSpd, tensionPct);
        buildMs = Math.round(performance.now() - t0);
        nodeRate = 1.0;
    } else {
        // 2-я передача (J Buf RAM [PITCH SHIFT]) или Задняя R (ВИНИЛ [PITCH SHIFT])
        playBuf = rawWindowBuf;
        nodeRate = targetSpd;
    }

    if (!player.paused) {
        if (window.studioSourceNode) {
            window.studioSourceNode.onended = null;
            try { window.studioSourceNode.stop(); } catch (e) {}
            try { window.studioSourceNode.disconnect(); } catch (e) {}
        }
        window.studioSourceNode = window.audioCtx.createBufferSource();
        window.studioSourceNode._isHoseSpliced = (gearKey === 'jbuf-lock');
        window.studioSourceNode._isHorizonWindowV71 = true;
        window.studioSourceNode.buffer = playBuf;
        window.studioSourceNode.playbackRate.value = nodeRate;
        window.studioSourceNode.connect(window.inputMixer);
        window.studioSourceNode.start(0, 0);
        window.isStudioPlaying = true;

        const realDurSec = (gearKey === 'jbuf-lock') ? playBuf.duration : (playBuf.duration / Math.max(0.25, nodeRate));
        const nextWaitMs = Math.max(500, (realDurSec - 1.2) * 1000);
        window._horizonSliceTimerV71 = setTimeout(() => {
            const activeG = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
            if (!player.paused && (activeG === 'jbuf-lock' || activeG === 'jbuf-shift' || activeG === 'vinyl-shift')) {
                window.engageHorizonRamEngineV71_5(activeG, false);
            }
        }, nextWaitMs);
    }

    if (badge) {
        if (gearKey === 'jbuf-lock') {
            const c = window._hoseSplicerCacheV46 || {};
            badge.style.color = '#3fb950';
            badge.innerText = `⚡ J Buf 90° [RAM]: x${targetSpd.toFixed(2)}${isRev ? ' ⏪' : ''} | Δy=${((c.avgSeamErrMv || 0) * 100).toFixed(1)}% (${buildMs}мс)`;
        } else if (gearKey === 'vinyl-shift') {
            badge.style.color = '#d2a8ff';
            badge.innerText = `💿 ВИНИЛ [RAM]: x${targetSpd.toFixed(2)}${isRev ? ' ⏪' : ''}`;
        } else {
            badge.style.color = '#3fb950';
            badge.innerText = `⚡ J Buf RAM [PITCH SHIFT]: x${targetSpd.toFixed(2)}${isRev ? ' ⏪' : ''}`;
        }
    }
    return true;
};

// Единый диспетчер синхронизации всех 5 передач и Нейтрали N
(function installMasterGearboxDispatcherV71_5() {
    const baseSync = window.syncMasterPlaybackEngineV59;
    window.syncMasterPlaybackEngineV59 = function(isDraggingArc) {
        if (window._horizonSliceTimerV71) {
            clearTimeout(window._horizonSliceTimerV71);
            window._horizonSliceTimerV71 = null;
        }
        const player = document.getElementById('audioPlayer');
        const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';

        // 1. НЕЙТРАЛЬ (N): Всегда мгновенно сбрасывает скорость в 1.00x и сохраняет натуральный тон (даже при реверсе!)
        if ((gKey === 'neutral' || gKey === 'n') && player) {
            const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
            if (!isRev || !window.studioBuffer) {
                window._activeBufferSourcesV71.forEach(n => {
                    n.onended = null;
                    try { n.stop(); } catch (e) {}
                    try { n.disconnect(); } catch (e) {}
                });
                window._activeBufferSourcesV71.clear();
                window.studioSourceNode = null;
                window.isStudioPlaying = false;
                if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
                player.preservesPitch = true;
                player.mozPreservesPitch = true;
                player.webkitPreservesPitch = true;
                if (Math.abs(player.playbackRate - 1.0) > 0.002) {
                    try { player.playbackRate = 1.0; } catch (e) {}
                }
            } else {
                // Если в Нейтрали включён Реверс — крутим RAM-окно со скоростью 1.0x
                window.engageHorizonRamEngineV71_5('jbuf-lock', false);
            }
            const badge = document.getElementById('hoseLiveTelemetryV44');
            if (badge) {
                badge.style.color = '#e3b341';
                badge.innerText = '⚙️ НЕЙТРАЛЬ [N]: x1.00 (Холостой ход)';
            }
            return;
        }

        // 2. 1-я (J Buf 90°), 2-я (J Buf Pitch Shift) и Задняя R (Винил) на длинных треках (>10 мин) или пока грузится RAM
        if (gKey === 'jbuf-lock' || gKey === 'jbuf-shift' || gKey === 'vinyl-shift') {
            if (!window.studioBuffer || window.studioBuffer.duration > 600) {
                if (window.engageHorizonRamEngineV71_5(gKey, isDraggingArc)) {
                    return;
                }
            }
        }

        return baseSync.apply(this, arguments);
    };
})();


// === V72 TORRENT PIECE MAP DISPATCHER (INSTANT SEEK PRIORITY & ZERO SILENCE) ===

(function hookSeekAndReverseForTorrentMapV72() {
    const player = document.getElementById('audioPlayer');
    if (player && !player._torrentSeekHookV72) {
        player._torrentSeekHookV72 = true;
        player.addEventListener('seeking', () => {
            if (typeof window.prioritizeRamPieceAtCursorV72 === 'function') {
                window.prioritizeRamPieceAtCursorV72();
            }
        });
    }
    const origRev = window.toggleReverseMode;
    if (typeof origRev === 'function' && !window._revHookV72) {
        window._revHookV72 = true;
        window.toggleReverseMode = function(targetReversed) {
            if (typeof window.prioritizeRamPieceAtCursorV72 === 'function') {
                window.prioritizeRamPieceAtCursorV72();
            }
            return origRev.apply(this, arguments);
        };
    }
})();

// Обновляем engageHorizonRamEngineV71_5 с проверкой торрент-карты кусков:
// если кусок в точке клика уже в RAM (pieceMap == 2) — сразу играем из RAM (25-сек окно),
// если кусок прямо сейчас подкачивается (150 мс) — пингуем торрент-загрузчик и не глушим звук пустыми нулями!
window.engageHorizonRamEngineV71_5 = function(gearKey, isDraggingArc) {
    const player = document.getElementById('audioPlayer');
    const badge = document.getElementById('hoseLiveTelemetryV44');
    if (!player || !window.audioCtx) return false;

    const targetSpd = (typeof window.getActiveTargetSpeedV59 === 'function')
        ? window.getActiveTargetSpeedV59()
        : (player.playbackRate || 1.0);
    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    const curSec = player.currentTime || 0;
    const refDur = (player && isFinite(player.duration) && player.duration > 0)
        ? player.duration
        : (window.studioBuffer ? window.studioBuffer.duration : 0);

    const readyNow = window.studioBuffer && window.isRamRangeReadyV72
        ? window.isRamRangeReadyV72(window.studioBuffer, curSec, 6.0, isRev, refDur)
        : Boolean(window.studioBuffer);

    if (!window.studioBuffer || !readyNow) {
        // Кусок в точке клика ещё подлетает из FFmpeg (~150 мс): даём приоритет этой точке!
        if (typeof window.prioritizeRamPieceAtCursorV72 === 'function') {
            window.prioritizeRamPieceAtCursorV72();
        }
        window._activeBufferSourcesV71.forEach(n => {
            n.onended = null;
            try { n.stop(); } catch (e) {}
            try { n.disconnect(); } catch (e) {}
        });
        window._activeBufferSourcesV71.clear();
        window.studioSourceNode = null;
        window.isStudioPlaying = false;

        if (!isRev) {
            if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
            const wantPitchLock = (gearKey === 'jbuf-lock' || gearKey === 'web-lock' || gearKey === 'neutral');
            player.preservesPitch = wantPitchLock;
            player.mozPreservesPitch = wantPitchLock;
            player.webkitPreservesPitch = wantPitchLock;
            const spd = (gearKey === 'neutral') ? 1.0 : targetSpd;
            if (Math.abs(player.playbackRate - spd) > 0.003) {
                try { player.playbackRate = spd; } catch (e) {}
            }
        } else {
            if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
        }
        if (badge) {
            badge.style.color = '#e3b341';
            badge.innerText = `⚡ Подгрузка куска RAM в точке клика...`;
        }
        return true;
    }

    if (window.studioBuffer.duration <= 600 && !(isRev && !window.reversedStudioBuffer)) {
        return false;
    }

    if (isDraggingArc) {
        if (window._hoseArcDebounceTimerV47) clearTimeout(window._hoseArcDebounceTimerV47);
        window._hoseArcDebounceTimerV47 = setTimeout(() => {
            window.syncMasterPlaybackEngineV59(false);
        }, 50);
        return true;
    }

    if (window._horizonSliceTimerV71) {
        clearTimeout(window._horizonSliceTimerV71);
        window._horizonSliceTimerV71 = null;
    }

    // Берём компактное 24-секундное окно из готовых кусков торрент-карты
    const WIN_SEC = 24.0;
    const rawWindowBuf = window.extractWindowBufferV71(window.studioBuffer, curSec, WIN_SEC, isRev);
    if (!rawWindowBuf) return false;

    if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
    player.preservesPitch = false;
    if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
        try { player.playbackRate = targetSpd; } catch (e) {}
    }

    let playBuf = rawWindowBuf;
    let nodeRate = 1.0;
    let buildMs = 0;

    if (gearKey === 'jbuf-lock') {
        const tensionPct = (window.appConfig && window.appConfig.hoseTensionPct !== undefined)
            ? window.appConfig.hoseTensionPct
            : 100;
        const t0 = performance.now();
        playBuf = window.buildElasticHoseBufferV46(rawWindowBuf, targetSpd, tensionPct);
        buildMs = Math.round(performance.now() - t0);
        nodeRate = 1.0;
    } else {
        playBuf = rawWindowBuf;
        nodeRate = targetSpd;
    }

    if (!player.paused) {
        if (window.studioSourceNode) {
            window.studioSourceNode.onended = null;
            try { window.studioSourceNode.stop(); } catch (e) {}
            try { window.studioSourceNode.disconnect(); } catch (e) {}
        }
        window.studioSourceNode = window.audioCtx.createBufferSource();
        window.studioSourceNode._isHoseSpliced = (gearKey === 'jbuf-lock');
        window.studioSourceNode._isHorizonWindowV71 = true;
        window.studioSourceNode.buffer = playBuf;
        window.studioSourceNode.playbackRate.value = nodeRate;
        window.studioSourceNode.connect(window.inputMixer);
        window.studioSourceNode.start(0, 0);
        window.isStudioPlaying = true;

        const realDurSec = (gearKey === 'jbuf-lock') ? playBuf.duration : (playBuf.duration / Math.max(0.25, nodeRate));
        const nextWaitMs = Math.max(400, (realDurSec - 1.0) * 1000);
        window._horizonSliceTimerV71 = setTimeout(() => {
            const activeG = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
            if (!player.paused && (activeG === 'jbuf-lock' || activeG === 'jbuf-shift' || activeG === 'vinyl-shift')) {
                window.engageHorizonRamEngineV71_5(activeG, false);
            }
        }, nextWaitMs);
    }

    if (badge) {
        const loadedCnt = window.studioBuffer._loadedCountV72 || 0;
        const totalCnt = window.studioBuffer._pieceMapV72 ? window.studioBuffer._pieceMapV72.length : 1;
        const mapStr = window.studioBuffer._pieceMapV72 ? ` [${loadedCnt}/${totalCnt}]` : '';
        if (gearKey === 'jbuf-lock') {
            const c = window._hoseSplicerCacheV46 || {};
            badge.style.color = '#3fb950';
            badge.innerText = `⚡ J Buf 90°${mapStr}: x${targetSpd.toFixed(2)}${isRev ? ' ⏪' : ''} (${buildMs}мс)`;
        } else if (gearKey === 'vinyl-shift') {
            badge.style.color = '#d2a8ff';
            badge.innerText = `💿 ВИНИЛ${mapStr}: x${targetSpd.toFixed(2)}${isRev ? ' ⏪' : ''}`;
        } else {
            badge.style.color = '#3fb950';
            badge.innerText = `⚡ J Buf SHIFT${mapStr}: x${targetSpd.toFixed(2)}${isRev ? ' ⏪' : ''}`;
        }
    }
    return true;
};


// === V73 SCOPED SEARCH & 180MS LONG-PRESS MODALS (PLAYLISTS, ARTISTS, ALBUMS) ===

window._suppressNextStripClickV73 = false;
window._subModalSortModeV73 = 'alpha'; // 'alpha' | 'count'

// Перехватываем closeAllV71Modals, чтобы он закрывал и новые окна V73
(function extendCloseModalsV73() {
    const origClose = window.closeAllV71Modals;
    window.closeAllV71Modals = function() {
        if (typeof origClose === 'function') origClose();
        ['jennyAllPlaylistsPopupV73', 'jennySubItemsPopupV73'].forEach(id => {
            document.getElementById(id)?.remove();
        });
    };
})();

// Универсальный детектор зажатия 180 мс для горизонтальных лент (не мешает свайпу прокрутки и коротким тапам)
window.attachStripLongPressV73 = function(stripEl, onLongPress) {
    if (!stripEl || stripEl._longPressBoundV73) return;
    stripEl._longPressBoundV73 = true;

    let timer = null;
    let startX = 0;
    let startY = 0;
    let moved = false;

    const clearTimer = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };

    // Блокируем случайный click по чипу после срабатывания 180 мс зажатия
    stripEl.addEventListener('click', (e) => {
        if (window._suppressNextStripClickV73) {
            e.stopPropagation();
            e.preventDefault();
            window._suppressNextStripClickV73 = false;
        }
    }, true);

    stripEl.addEventListener('touchstart', (e) => {
        if (!e.touches || e.touches.length !== 1) return;
        moved = false;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        clearTimer();
        timer = setTimeout(() => {
            timer = null;
            if (!moved) {
                window._suppressNextStripClickV73 = true;
                setTimeout(() => { window._suppressNextStripClickV73 = false; }, 450);
                try { navigator.vibrate(35); } catch (err) {}
                onLongPress(e);
            }
        }, 180);
    }, { passive: true });

    stripEl.addEventListener('touchmove', (e) => {
        if (!timer || !e.touches || e.touches.length === 0) return;
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        if (dx > 10 || dy > 10) {
            moved = true;
            clearTimer();
        }
    }, { passive: true });

    stripEl.addEventListener('touchend', clearTimer, { passive: true });
    stripEl.addEventListener('touchcancel', clearTimer, { passive: true });
};

// Вычисляет группы для текущей вкладки (По артистам / По альбомам)
window.collectActiveSubGroupsV73 = function(tabId) {
    const data = window.lastData || {};
    const allTracks = (data.all_tracks || []).filter(fn =>
        window.isTrackAllowedByFormatSlots ? window.isTrackAllowedByFormatSlots(fn) : true
    );
    const key = (tabId === 'albums') ? 'album' : 'artist';
    const groups = {};
    allTracks.forEach(fn => {
        const g = window.getTrackMetaV71(fn)[key];
        if (!groups[g]) groups[g] = [];
        groups[g].push(fn);
    });
    return groups;
};

// Обновляет динамический placeholder строки поиска под текущий выделенный объект
window.updateScopedSearchPlaceholderV73 = function(baseCount) {
    const sInp = document.getElementById('trackSearchInput');
    if (!sInp) return;

    // Оборачиваем input в контейнер с кнопкой очистки ✖ (один раз)
    if (!sInp.parentElement.classList.contains('jenny-search-wrap-v73')) {
        const p = sInp.parentElement;
        p.classList.add('jenny-search-wrap-v73');
        const clrBtn = document.createElement('button');
        clrBtn.type = 'button';
        clrBtn.id = 'btnClearTrackSearchV73';
        clrBtn.className = 'jenny-search-clear-btn-v73';
        clrBtn.innerHTML = '✖';
        clrBtn.onclick = (e) => {
            e.stopPropagation();
            sInp.value = '';
            window.filterTracks('');
            sInp.blur();
        };
        p.appendChild(clrBtn);

        sInp.oninput = function() {
            window.filterTracks(this.value);
        };
    }

    const tabId = window.activePlaylistTabV71 || 'all';
    const cnt = (typeof baseCount === 'number') ? baseCount : (window.currentTrackList ? window.currentTrackList.length : 0);
    let scopeLabel = '';

    if (tabId === 'all') {
        scopeLabel = window.tr(`🔍 Поиск во «Все» (${cnt})...`, `🔍 Search in "All" (${cnt})...`);
    } else if (tabId === 'fav') {
        scopeLabel = window.tr(`🔍 Поиск в «Избранное» (${cnt})...`, `🔍 Search in "Favorites" (${cnt})...`);
    } else if (tabId === 'artists') {
        const art = window.selectedArtistV71 || '';
        scopeLabel = window.tr(`🔍 Поиск у «${art}» (${cnt})...`, `🔍 Search in "${art}" (${cnt})...`);
    } else if (tabId === 'albums') {
        const alb = window.selectedAlbumV71 || '';
        scopeLabel = window.tr(`🔍 Поиск в альбоме «${alb}» (${cnt})...`, `🔍 Search in album "${alb}" (${cnt})...`);
    } else {
        const pl = (window.appConfig.customPlaylistsV71 || []).find(p => p.id === tabId);
        const plName = pl ? pl.name : 'Плейлист';
        scopeLabel = window.tr(`🔍 Поиск в «${plName}» (${cnt})...`, `🔍 Search in "${plName}" (${cnt})...`);
    }

    sInp.placeholder = scopeLabel;
    const clrBtn = document.getElementById('btnClearTrackSearchV73');
    if (clrBtn) {
        clrBtn.style.display = (sInp.value && sInp.value.length > 0) ? 'inline-flex' : 'none';
    }
};

// Точная фильтрация треков внутри текущего выделенного объекта (по имени файла, артисту и альбому)
window.filterTracks = function(query) {
    const sInp = document.getElementById('trackSearchInput');
    const rawQ = (query !== undefined && query !== null) ? String(query) : (sInp ? sInp.value : '');
    const lowerQuery = rawQ.trim().toLowerCase();

    const clrBtn = document.getElementById('btnClearTrackSearchV73');
    if (clrBtn) {
        clrBtn.style.display = rawQ.length > 0 ? 'inline-flex' : 'none';
    }

    const uList = document.getElementById('unifiedList');
    if (!uList) return;

    let visibleCount = 0;
    let totalRows = 0;

    uList.querySelectorAll('.track-row-capsule').forEach(cap => {
        const wrapper = cap.parentElement;
        if (!wrapper) return;
        const trackName = cap.getAttribute('data-track') || '';
        if (!trackName) return;

        // Проверяем фильтр форматов (8 слотов)
        if (window.isTrackAllowedByFormatSlots && !window.isTrackAllowedByFormatSlots(trackName)) {
            wrapper.style.display = 'none';
            return;
        }

        totalRows++;
        if (!lowerQuery) {
            wrapper.style.display = 'block';
            visibleCount++;
            return;
        }

        const meta = window.getTrackMetaV71 ? window.getTrackMetaV71(trackName) : { artist: '', album: '' };
        const haystack = (trackName + ' ' + (meta.artist || '') + ' ' + (meta.album || '')).toLowerCase();
        const isMatch = haystack.includes(lowerQuery);
        wrapper.style.display = isMatch ? 'block' : 'none';
        if (isMatch) visibleCount++;
    });

    const cntEl = document.getElementById('tracksCount');
    if (cntEl) {
        cntEl.innerText = lowerQuery ? `${visibleCount}/${totalRows}` : `${totalRows}`;
    }

    let emptySearchMsg = document.getElementById('jennyEmptySearchMsgV73');
    if (lowerQuery && totalRows > 0 && visibleCount === 0) {
        if (!emptySearchMsg) {
            emptySearchMsg = document.createElement('div');
            emptySearchMsg.id = 'jennyEmptySearchMsgV73';
            emptySearchMsg.style.cssText = 'padding:18px 10px;color:#8b949e;text-align:center;font-size:12.5px;';
            uList.appendChild(emptySearchMsg);
        }
        emptySearchMsg.innerText = window.tr(
            `По запросу «${rawQ.trim()}» в текущем разделе ничего не найдено`,
            `No tracks matching "${rawQ.trim()}" in current view`
        );
        emptySearchMsg.style.display = 'block';
    } else if (emptySearchMsg) {
        emptySearchMsg.style.display = 'none';
    }
};

// Переопределяем отрисовку первой строки (Плейлисты): сохраняем scrollLeft + вешаем зажатие 180 мс
const _origRenderStripV71 = window.renderPlaylistStripChipsV71;
window.renderPlaylistStripChipsV71 = function() {
    const strip = document.getElementById('jennyPlaylistScrollStripV71');
    const prevScroll = strip ? strip.scrollLeft : 0;
    if (typeof _origRenderStripV71 === 'function') _origRenderStripV71();
    if (strip) {
        strip.scrollLeft = prevScroll;
        window.attachStripLongPressV73(strip, () => {
            window.openAllPlaylistsLongPressModalV73();
        });
    }
};

// Выбор конкретного артиста или альбома без сброса прокрутки второй строки!
window.selectSubFilterItemV73 = function(tabId, itemName, scrollChipIntoView) {
    if (tabId === 'artists') {
        window.selectedArtistV71 = itemName;
    } else if (tabId === 'albums') {
        window.selectedAlbumV71 = itemName;
    }
    window.renderActivePlaylistTracksV71(Boolean(scrollChipIntoView));
};

// Переопределяем renderActivePlaylistTracksV71: сохраняем scrollLeft второй строки и вешаем 180 мс зажатие
window.renderActivePlaylistTracksV71 = function(scrollSubChipToCenter) {
    const unifiedBox = document.getElementById('unifiedList');
    if (!unifiedBox || !window.lastData) return;
    window.mountPlaylistStripDOMV71();
    const subWrap = document.getElementById('jennySubFilterWrapV71');
    const oldSubBar = subWrap ? subWrap.querySelector('.jenny-subfilter-bar-v71') : null;
    const prevSubScroll = oldSubBar ? oldSubBar.scrollLeft : 0;

    const tabId = window.activePlaylistTabV71 || 'all';
    const allTracks = (window.lastData.all_tracks || []).filter(fn =>
        window.isTrackAllowedByFormatSlots ? window.isTrackAllowedByFormatSlots(fn) : true
    );
    let subHtml = '';
    let baseList = [];

    if (tabId === 'all') {
        baseList = allTracks;
    } else if (tabId === 'fav') {
        baseList = window.favorites || [];
    } else if (tabId === 'artists' || tabId === 'albums') {
        const icon = tabId === 'artists' ? '🎤' : '💿';
        const groups = window.collectActiveSubGroupsV73(tabId);
        const names = Object.keys(groups).sort((a, b) => a.localeCompare(b));
        const prop = tabId === 'artists' ? 'selectedArtistV71' : 'selectedAlbumV71';
        if (!window[prop] || !groups[window[prop]]) window[prop] = names[0] || '';
        const chips = names.map(n => {
            const isSel = (n === window[prop]);
            const safeN = n.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const cls = 'jenny-pl-chip-v71' + (isSel ? ' active-pl-chip' : '');
            return `<div class="${cls}" data-subname="${n.replace(/"/g, '&quot;')}" onclick="window.selectSubFilterItemV73('${tabId}','${safeN}',false)">${icon} ${n} <span class="jenny-pl-chip-count-v71">${groups[n].length}</span></div>`;
        }).join('');
        subHtml = `<div id="jennySubFilterBarActiveV73" class="jenny-subfilter-bar-v71">${chips}</div>`;
        baseList = groups[window[prop]] || [];
    } else {
        const pl = (window.appConfig.customPlaylistsV71 || []).find(p => p.id === tabId);
        if (pl) {
            baseList = Array.isArray(pl.tracks) ? pl.tracks : [];
            subHtml = `<div id="jennySubFilterBarActiveV73" class="jenny-subfilter-bar-v71" style="justify-content:space-between;"><span style="font-size:11.5px;color:#79c0ff;font-weight:bold;">🎶 ${pl.name} (${baseList.length})</span><div style="display:flex;gap:6px;"><button type="button" onclick="window.openImportFolderToPlaylistModalV71('${pl.id}')" style="padding:3px 8px;font-size:10.5px;color:#3fb950;">📁 +Папка</button><button type="button" onclick="window.deleteCustomPlaylistV71('${pl.id}')" style="padding:3px 8px;font-size:10.5px;color:#ff7b72;">🗑️ Удалить</button></div></div>`;
        }
    }

    if (subWrap) {
        subWrap.innerHTML = subHtml;
        const newSubBar = document.getElementById('jennySubFilterBarActiveV73');
        if (newSubBar) {
            // Восстанавливаем позицию прокрутки ленты артистов/альбомов, чтобы она НЕ прыгала в начало!
            newSubBar.scrollLeft = prevSubScroll;
            if (scrollSubChipToCenter) {
                const actChip = newSubBar.querySelector('.active-pl-chip');
                if (actChip && typeof actChip.scrollIntoView === 'function') {
                    actChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
            }
            window.attachStripLongPressV73(newSubBar, () => {
                window.openSubStripLongPressModalV73();
            });
        }
    }

    const sorted = window.sortTrackArrayForTabV71(baseList, tabId);
    window.currentTrackList = sorted;
    window.topTrack = sorted[0] || null;

    window.updateScopedSearchPlaceholderV73(sorted.length);

    let html = '';
    if (!sorted.length) {
        html = `<div style="padding:20px;color:#8b949e;text-align:center;">${window.tr('Список пуст', 'Playlist is empty')}</div>`;
    } else {
        sorted.forEach(fn => {
            const isFav = (window.favorites || []).includes(fn);
            html += buildTrackRowHTML(fn, 'main', isFav ? '❤️' : '🤍');
        });
    }
    unifiedBox.innerHTML = html;

    // Сразу применяем текущий поисковый запрос к выбранному объекту
    const sInp = document.getElementById('trackSearchInput');
    window.filterTracks(sInp ? sInp.value : '');

    if (window.expandedTracks && window.expandedTracks.size > 0) {
        document.querySelectorAll('.track-row-capsule.expanded-capsule').forEach(r => {
            const fn = r.getAttribute('data-track');
            if (fn) window.syncRowActionButtons(r, fn, true);
        });
    }
};

// ОКНО 1 (по зажатию 180 мс на первой ленте): Полный список плейлистов и категорий
window.openAllPlaylistsLongPressModalV73 = function() {
    window.closeAllV71Modals();
    window.ensurePlaylistStateV71();
    const allTabs = window.getAllPlaylistTabsV71();
    const vis = window.appConfig.visiblePlaylistTabsV71 || {};

    const m = document.createElement('div');
    m.id = 'jennyAllPlaylistsPopupV73';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    m.innerHTML = `
        <div class="jenny-modal-card-v71" onclick="event.stopPropagation()">
            <div class="jenny-modal-hdr-v71">
                <span style="color:#58a6ff;font-weight:bold;">🎼 ${window.tr('Плейлисты и категории', 'Playlists & Categories')} (${allTabs.length})</span>
                <button type="button" onclick="document.getElementById('jennyAllPlaylistsPopupV73').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button>
            </div>
            <div style="padding:10px 14px 4px 14px;background:#080b10;">
                <input type="text" id="inpFilterPlaylistsModalV73" placeholder="${window.tr('🔍 Найти плейлист...', '🔍 Find playlist...')}" style="width:100%;padding:8px 10px;text-align:left !important;box-sizing:border-box;font-size:12.5px;">
            </div>
            <div class="jenny-modal-body-v71" id="bodyPlaylistsModalListV73"></div>
            <div class="jenny-modal-ftr-v71">
                <button type="button" onclick="document.getElementById('jennyAllPlaylistsPopupV73').remove();window.openCreatePlaylistModalV71(null, event);" style="flex:1;padding:9px;color:#3fb950;border-color:#3fb950;">➕ ${window.tr('Создать новый плейлист', 'Create New Playlist')}</button>
            </div>
        </div>
    `;
    document.body.appendChild(m);

    const listEl = document.getElementById('bodyPlaylistsModalListV73');
    const filterInp = document.getElementById('inpFilterPlaylistsModalV73');

    const renderRows = (q) => {
        const lq = String(q || '').trim().toLowerCase();
        const filtered = allTabs.filter(t => !lq || t.name.toLowerCase().includes(lq));
        listEl.innerHTML = filtered.map(t => {
            const isAct = (t.id === window.activePlaylistTabV71);
            const cnt = window.getTrackCountForTabV71(t.id);
            const isVis = (vis[t.id] !== false);
            return `
                <div class="jenny-popup-item-v73 ${isAct ? 'active-popup-item-v73' : ''}" onclick="window.pickPlaylistFromModalV73('${t.id}', event)">
                    <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
                        <input type="checkbox" ${isVis ? 'checked' : ''} onclick="event.stopPropagation();" onchange="window.appConfig.visiblePlaylistTabsV71['${t.id}']=this.checked;window.savePlaylistStateQuietlyV71();window.renderPlaylistStripChipsV71();" title="Показывать в ленте">
                        <span style="font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.icon} ${t.name}</span>
                    </div>
                    <span class="jenny-pl-chip-count-v71" style="font-size:11px;padding:2px 8px;">${cnt}</span>
                </div>
            `;
        }).join('');
    };

    filterInp.oninput = function() { renderRows(this.value); };
    renderRows('');
};

window.pickPlaylistFromModalV73 = function(tabId, ev) {
    window.ensurePlaylistStateV71();
    window.appConfig.visiblePlaylistTabsV71[tabId] = true;
    document.getElementById('jennyAllPlaylistsPopupV73')?.remove();
    window.selectPlaylistTabV71(tabId, ev);
    const strip = document.getElementById('jennyPlaylistScrollStripV71');
    const actChip = strip ? strip.querySelector('.active-pl-chip') : null;
    if (actChip && typeof actChip.scrollIntoView === 'function') {
        actChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
};

// ОКНО 2 (по зажатию 180 мс на второй ленте): Полный список Артистов (116) / Альбомов (121) с поиском и сортировкой
window.openSubStripLongPressModalV73 = function() {
    const tabId = window.activePlaylistTabV71 || 'all';
    if (tabId !== 'artists' && tabId !== 'albums') {
        if (String(tabId).startsWith('pl_')) {
            window.openImportFolderToPlaylistModalV71(tabId);
        } else {
            window.openAllPlaylistsLongPressModalV73();
        }
        return;
    }

    window.closeAllV71Modals();
    const isArt = (tabId === 'artists');
    const icon = isArt ? '🎤' : '💿';
    const currentSel = isArt ? (window.selectedArtistV71 || '') : (window.selectedAlbumV71 || '');
    const groups = window.collectActiveSubGroupsV73(tabId);
    const allNames = Object.keys(groups);

    const m = document.createElement('div');
    m.id = 'jennySubItemsPopupV73';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    const titleTxt = isArt
        ? window.tr(`🎤 Все артисты (${allNames.length})`, `🎤 All Artists (${allNames.length})`)
        : window.tr(`💿 Все альбомы (${allNames.length})`, `💿 All Albums (${allNames.length})`);
    const phTxt = isArt
        ? window.tr(`🔍 Быстрый поиск артиста из ${allNames.length}...`, `🔍 Search artist...`)
        : window.tr(`🔍 Быстрый поиск альбома из ${allNames.length}...`, `🔍 Search album...`);

    m.innerHTML = `
        <div class="jenny-modal-card-v71" onclick="event.stopPropagation()">
            <div class="jenny-modal-hdr-v71">
                <span style="color:#58a6ff;font-weight:bold;">${titleTxt}</span>
                <button type="button" onclick="document.getElementById('jennySubItemsPopupV73').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button>
            </div>
            <div style="padding:10px 14px 6px 14px;background:#080b10;display:flex;flex-direction:column;gap:6px;border-bottom:1px solid #21262d;">
                <input type="text" id="inpFilterSubItemsModalV73" placeholder="${phTxt}" style="width:100%;padding:8px 10px;text-align:left !important;box-sizing:border-box;font-size:12.5px;">
                <div style="display:flex;gap:6px;">
                    <button type="button" id="btnSubSortAlphaV73" style="flex:1;padding:5px;font-size:11px;">🔤 А ➔ Я</button>
                    <button type="button" id="btnSubSortCountV73" style="flex:1;padding:5px;font-size:11px;">🔢 По кол-ву треков</button>
                </div>
            </div>
            <div class="jenny-modal-body-v71" id="bodySubItemsModalListV73" style="max-height:60vh;"></div>
        </div>
    `;
    document.body.appendChild(m);

    const listEl = document.getElementById('bodySubItemsModalListV73');
    const filterInp = document.getElementById('inpFilterSubItemsModalV73');
    const btnAlpha = document.getElementById('btnSubSortAlphaV73');
    const btnCount = document.getElementById('btnSubSortCountV73');

    const renderSubList = () => {
        const lq = String(filterInp.value || '').trim().toLowerCase();
        let names = allNames.filter(n => !lq || n.toLowerCase().includes(lq));

        if (window._subModalSortModeV73 === 'count') {
            names.sort((a, b) => (groups[b].length - groups[a].length) || a.localeCompare(b));
            btnCount.style.borderColor = '#58a6ff';
            btnCount.style.color = '#58a6ff';
            btnAlpha.style.borderColor = '#30363d';
            btnAlpha.style.color = '#8b949e';
        } else {
            names.sort((a, b) => a.localeCompare(b));
            btnAlpha.style.borderColor = '#58a6ff';
            btnAlpha.style.color = '#58a6ff';
            btnCount.style.borderColor = '#30363d';
            btnCount.style.color = '#8b949e';
        }

        if (!names.length) {
            listEl.innerHTML = `<div style="padding:18px;color:#8b949e;text-align:center;">${window.tr('Ничего не найдено', 'Nothing found')}</div>`;
            return;
        }

        listEl.innerHTML = names.map(n => {
            const isSel = (n === currentSel);
            const cnt = groups[n].length;
            const safeN = n.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            return `
                <div class="jenny-popup-item-v73 ${isSel ? 'active-popup-item-v73' : ''}" onclick="document.getElementById('jennySubItemsPopupV73').remove();window.selectSubFilterItemV73('${tabId}','${safeN}',true);">
                    <span style="font-weight:bold;word-break:break-word;flex:1;">${icon} ${n}</span>
                    <span class="jenny-pl-chip-count-v71" style="font-size:11px;padding:2px 8px;flex-shrink:0;">${cnt}</span>
                </div>
            `;
        }).join('');
    };

    btnAlpha.onclick = () => { window._subModalSortModeV73 = 'alpha'; renderSubList(); };
    btnCount.onclick = () => { window._subModalSortModeV73 = 'count'; renderSubList(); };
    filterInp.oninput = renderSubList;

    renderSubList();
    setTimeout(() => {
        const actEl = listEl.querySelector('.active-popup-item-v73');
        if (actEl && typeof actEl.scrollIntoView === 'function') {
            actEl.scrollIntoView({ block: 'center' });
        }
    }, 30);
};

setTimeout(() => {
    window.renderPlaylistStripChipsV71();
    window.renderActivePlaylistTracksV71(false);
}, 120);


// === V73.1 INDEPENDENT PLAYBACK QUEUE (BROWSE ANY LIST WHILE LISTENING TO ANOTHER) ===

window.viewedFullTabListV73 = [];
window.playingQueueListV73 = [];
window.playingQueueContextV73 = { tabId: 'all', artist: '', album: '' };

// Обновляем renderActivePlaylistTracksV71: сохраняем просматриваемый список в viewedFullTabListV73,
// НЕ затирая активную очередь воспроизведения playingQueueListV73!
(function wrapRenderForIndependentQueueV73_1() {
    const prevRender = window.renderActivePlaylistTracksV71;
    window.renderActivePlaylistTracksV71 = function(scrollSubChipToCenter) {
        const prevQueue = (window.playingQueueListV73 && window.playingQueueListV73.length > 0)
            ? [...window.playingQueueListV73]
            : null;

        prevRender.apply(this, arguments);

        // window.currentTrackList после рендера содержит отсортированный список открытой вкладки
        window.viewedFullTabListV73 = Array.isArray(window.currentTrackList) ? [...window.currentTrackList] : [];

        const curTab = window.activePlaylistTabV71 || 'all';
        const qCtx = window.playingQueueContextV73 || {};
        const isSameContext = (
            qCtx.tabId === curTab &&
            (curTab !== 'artists' || qCtx.artist === (window.selectedArtistV71 || '')) &&
            (curTab !== 'albums' || qCtx.album === (window.selectedAlbumV71 || ''))
        );

        if (!prevQueue || prevQueue.length === 0) {
            window.playingQueueListV73 = [...window.viewedFullTabListV73];
            window.playingQueueContextV73 = {
                tabId: curTab,
                artist: window.selectedArtistV71 || '',
                album: window.selectedAlbumV71 || ''
            };
        } else if (isSameContext && window.viewedFullTabListV73.includes(window.currentPlayingTrack)) {
            // Если пользователь поменял сортировку внутри того же самого списка, который сейчас играет — обновляем очередь
            window.playingQueueListV73 = [...window.viewedFullTabListV73];
        } else {
            // Если пользователь просто листает другой список — возвращаем неприкосновенную очередь играющего списка!
            window.playingQueueListV73 = prevQueue;
        }

        window.currentTrackList = window.playingQueueListV73;
    };
})();

// Когда пользователь сам нажимает Play на карточке трека — фиксируем текущий открытый список как новую очередь воспроизведения!
window.lockCurrentViewAsPlayingQueueV73_1 = function(filename) {
    const curTab = window.activePlaylistTabV71 || 'all';
    let listToLock = (window.viewedFullTabListV73 && window.viewedFullTabListV73.length > 0)
        ? [...window.viewedFullTabListV73]
        : [];

    // Если в строке поиска введён фильтр и отфильтровано несколько песен, среди которых есть выбранная
    const sInp = document.getElementById('trackSearchInput');
    const q = sInp ? sInp.value.trim().toLowerCase() : '';
    if (q && listToLock.length > 0) {
        const visibleTracks = [];
        document.querySelectorAll('#unifiedList .track-row-capsule').forEach(cap => {
            if (cap.parentElement && cap.parentElement.style.display !== 'none') {
                const fn = cap.getAttribute('data-track');
                if (fn) visibleTracks.push(fn);
            }
        });
        if (visibleTracks.length > 1 && visibleTracks.includes(filename)) {
            listToLock = visibleTracks;
        }
    }

    if (listToLock.length === 0 && window.lastData && Array.isArray(window.lastData.all_tracks)) {
        listToLock = [...window.lastData.all_tracks];
    }

    window.playingQueueListV73 = listToLock;
    window.currentTrackList = listToLock;
    window.playingQueueContextV73 = {
        tabId: curTab,
        artist: window.selectedArtistV71 || '',
        album: window.selectedAlbumV71 || ''
    };
};

window.handleTrackPlayBtn = function(filename, listContext, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const player = document.getElementById('audioPlayer');
    if (window.currentPlayingTrack === filename && player && player.src) {
        window.togglePlay();
    } else {
        window.lockCurrentViewAsPlayingQueueV73_1(filename);
        window.playTrack(filename, 'queue');
    }
};

// Защищаем очередь внутри playTrack, чтобы старый код из ui_playback.js не сбрасывал её на session_tracks
(function protectQueueInPlayTrackV73_1() {
    const origPlayTrack = window.playTrack;
    window.playTrack = async function(filename, listContext) {
        if (listContext !== 'queue' && (!window.playingQueueListV73 || !window.playingQueueListV73.includes(filename))) {
            window.lockCurrentViewAsPlayingQueueV73_1(filename);
        }
        const savedQueue = (window.playingQueueListV73 && window.playingQueueListV73.length > 0)
            ? [...window.playingQueueListV73]
            : null;

        const res = await origPlayTrack.call(this, filename, 'queue');

        if (savedQueue) {
            window.playingQueueListV73 = savedQueue;
            window.currentTrackList = savedQueue;
        }
        return res;
    };
})();

// Надёжное получение текущей очереди для кнопок След. (►|) и Пред. (|◄)
window.getEffectivePlaybackQueueV73_1 = function() {
    if (window.playingQueueListV73 && window.playingQueueListV73.length > 0) {
        if (!window.currentPlayingTrack || window.playingQueueListV73.includes(window.currentPlayingTrack)) {
            return window.playingQueueListV73;
        }
    }
    if (window.viewedFullTabListV73 && window.viewedFullTabListV73.length > 0 && window.viewedFullTabListV73.includes(window.currentPlayingTrack)) {
        window.playingQueueListV73 = [...window.viewedFullTabListV73];
        return window.playingQueueListV73;
    }
    const all = (window.lastData && window.lastData.all_tracks) ? window.lastData.all_tracks : [];
    if (all.length > 0) {
        return all;
    }
    return window.viewedFullTabListV73 || [];
};

window.playNextTrack = function() {
    const queue = window.getEffectivePlaybackQueueV73_1();
    if (!queue || queue.length === 0) return;

    if (!window.currentPlayingTrack) {
        window.playTrack(queue[0], 'queue');
        return;
    }

    let idx = queue.indexOf(window.currentPlayingTrack);
    let nextIdx = (idx !== -1) ? ((idx + 1) % queue.length) : 0;
    window.playTrack(queue[nextIdx], 'queue');
};

window.playPreviousTrack = function() {
    const queue = window.getEffectivePlaybackQueueV73_1();
    if (!queue || queue.length === 0) return;

    if (!window.currentPlayingTrack) {
        window.playTrack(queue[0], 'queue');
        return;
    }

    let idx = queue.indexOf(window.currentPlayingTrack);
    let prevIdx = (idx !== -1) ? ((idx - 1 + queue.length) % queue.length) : 0;
    window.playTrack(queue[prevIdx], 'queue');
};


// === V74 CUSTOM TAGS SORTING, BADGES & SPACE-INSENSITIVE SEARCH ===

// Добавляем вкладку «🏷️ По тегам» в базовый список плейлистов, если её ещё нет
if (!window.PLAYLIST_BUILTIN_TABS_V71.some(t => t.id === 'tags')) {
    window.PLAYLIST_BUILTIN_TABS_V71.push({ id: 'tags', icon: '🏷️', ru: 'По тегам', en: 'By Tags' });
}

// Добавляем метод сортировки по своим тегам в окно ⇅
if (!window.SORT_METHODS_V71.some(s => s.id === 'custom_tag')) {
    window.SORT_METHODS_V71.push({
        id: 'custom_tag',
        defDir: 'asc',
        ru: '🏷️ По своим тегам (Сначала с тегами)',
        en: '🏷️ By Custom Tags (Tagged First)'
    });
}

// Нормализация строки для умного поиска (убирает пробелы, дефисы и регистр: "поаль" -> "поальбомам")
window.normSearchV74 = function(str) {
    return String(str || '').toLowerCase().replace(/[\s\-_.,:;'"«»()\[\]]+/g, '');
};

// Возвращает словарь всех кастомных тегов трека (например, { "ЧЛЕН": "профсоюза" })
window.getTrackCustomTagsV74 = function(filename) {
    const srv = (window.lastData && window.lastData.track_meta && window.lastData.track_meta[filename]) || {};
    return srv.custom_tags || {};
};

// Собирает все существующие в медиатеке кастомные теги и их значения
window.collectAllCustomTagGroupsV74 = function() {
    const data = window.lastData || {};
    const allTracks = (data.all_tracks || []).filter(fn =>
        window.isTrackAllowedByFormatSlots ? window.isTrackAllowedByFormatSlots(fn) : true
    );
    const groups = {}; // "КЛЮЧ: ЗНАЧЕНИЕ" -> [tracks]
    const keysOnly = {}; // "КЛЮЧ" -> [tracks]
    allTracks.forEach(fn => {
        const ctags = window.getTrackCustomTagsV74(fn);
        Object.entries(ctags).forEach(([k, v]) => {
            const pairLabel = `${k}: ${v}`;
            if (!groups[pairLabel]) groups[pairLabel] = [];
            groups[pairLabel].push(fn);
            if (!keysOnly[k]) keysOnly[k] = [];
            keysOnly[k].push(fn);
        });
    });
    return { groups, keysOnly };
};

// Обновляем подсчёт количества для вкладки 'tags'
const _origGetCntV71 = window.getTrackCountForTabV71;
window.getTrackCountForTabV71 = function(tabId) {
    if (tabId === 'tags') {
        const { groups } = window.collectAllCustomTagGroupsV74();
        return Object.keys(groups).length;
    }
    return _origGetCntV71.apply(this, arguments);
};

// Расширяем collectActiveSubGroupsV73 для поддержки вкладки 'tags'
const _origCollectSubV73 = window.collectActiveSubGroupsV73;
window.collectActiveSubGroupsV73 = function(tabId) {
    if (tabId === 'tags') {
        const { groups } = window.collectAllCustomTagGroupsV74();
        return groups;
    }
    return _origCollectSubV73.apply(this, arguments);
};

// Расширяем сортировку sortTrackArrayForTabV71 поддержкой 'custom_tag' и 'tag_KEY'
const _origSortTracksV71 = window.sortTrackArrayForTabV71;
window.sortTrackArrayForTabV71 = function(tracksArr, tabId) {
    window.ensurePlaylistStateV71();
    const smap = window.appConfig.playlistSortMapV71 || {};
    const sc = smap[tabId] || { mode: 'mtime', dir: 'desc' };
    const mode = sc.mode || 'mtime';

    if (mode === 'custom_tag' || mode.startsWith('tag:')) {
        const targetKey = mode.startsWith('tag:') ? mode.slice(4) : null;
        const mul = sc.dir === 'asc' ? 1 : -1;
        const arr = [...tracksArr];
        arr.sort((a, b) => {
            const ta = window.getTrackCustomTagsV74(a);
            const tb = window.getTrackCustomTagsV74(b);
            let va = '', vb = '';
            if (targetKey) {
                va = ta[targetKey] || '';
                vb = tb[targetKey] || '';
            } else {
                const ka = Object.keys(ta)[0];
                const kb = Object.keys(tb)[0];
                va = ka ? `${ka}:${ta[ka]}` : '';
                vb = kb ? `${kb}:${tb[kb]}` : '';
            }
            const hasA = va.length > 0 ? 1 : 0;
            const hasB = vb.length > 0 ? 1 : 0;
            // Треки с заполненным тегом ВСЕГДА идут первыми наверху списка!
            if (hasA !== hasB) return hasB - hasA;
            if (va !== vb) return va.localeCompare(vb) * mul;
            return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
        });
        return arr;
    }
    return _origSortTracksV71.apply(this, arguments);
};

// Обновляем окно сортировки ⇅ (openPlaylistSortModalV71): выводим также все найденные пользовательские ключи тегов (например, «🏷️ Тег: ЧЛЕН»)
window.openPlaylistSortModalV71 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    window.closeAllV71Modals();
    const tabId = window.activePlaylistTabV71 || 'all';
    const smap = window.appConfig.playlistSortMapV71 || {};
    const cur = smap[tabId] || { mode: 'mtime', dir: 'desc' };
    const { keysOnly } = window.collectAllCustomTagGroupsV74();
    const customKeys = Object.keys(keysOnly).sort((a, b) => a.localeCompare(b));

    const m = document.createElement('div');
    m.id = 'jennyPlSortModalV71';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    let rows = window.SORT_METHODS_V71.map(sm => {
        const isSel = (cur.mode === sm.id);
        const brd = isSel ? '#58a6ff' : '#262c36';
        const clr = isSel ? '#58a6ff' : '#e6edf3';
        const arrow = isSel ? (cur.dir === 'asc' ? '▲' : '▼') : '';
        return `<div onclick="window.applySortForCurrentTabV71('${sm.id}')" style="display:flex;justify-content:space-between;align-items:center;background:#0d1117;border:1px solid ${brd};border-radius:9px;padding:10px 12px;cursor:pointer;"><span style="color:${clr};font-weight:bold;">${window.tr(sm.ru, sm.en)}</span><span style="color:#3fb950;font-size:11.5px;">${arrow}</span></div>`;
    }).join('');

    if (customKeys.length > 0) {
        rows += `<div style="font-size:11px;color:#e3b341;font-weight:bold;margin-top:4px;padding-left:2px;">🏷️ ${window.tr('Сортировать по конкретному тегу:', 'Sort by specific custom tag:')}</div>`;
        rows += customKeys.map(k => {
            const modeId = 'tag:' + k;
            const isSel = (cur.mode === modeId);
            const brd = isSel ? '#e3b341' : '#262c36';
            const clr = isSel ? '#e3b341' : '#e6edf3';
            const arrow = isSel ? (cur.dir === 'asc' ? '▲' : '▼') : '';
            const safeK = modeId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            return `<div onclick="window.applySortForCurrentTabV71('${safeK}')" style="display:flex;justify-content:space-between;align-items:center;background:#0d1117;border:1px solid ${brd};border-radius:9px;padding:9px 12px;cursor:pointer;"><span style="color:${clr};font-weight:bold;">🏷️ Тег «${k}» (${keysOnly[k].length})</span><span style="color:#3fb950;font-size:11.5px;">${arrow}</span></div>`;
        }).join('');
    }

    m.innerHTML = `<div class="jenny-modal-card-v71" onclick="event.stopPropagation()"><div class="jenny-modal-hdr-v71"><span style="color:#58a6ff;font-weight:bold;">⇅ ${window.tr('Сортировка текущего списка', 'Sort Current Playlist')}</span><button type="button" onclick="document.getElementById('jennyPlSortModalV71').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button></div><div class="jenny-modal-body-v71">${rows}</div></div>`;
    document.body.appendChild(m);
};

// Отображаем бейджики кастомных тегов (например, [🏷️ ЧЛЕН: профсоюза]) прямо на карточках треков и добавляем поддержку вкладки 'tags'
window.decorateTrackRowsWithCustomTagsV74 = function() {
    document.querySelectorAll('#unifiedList .track-row-capsule').forEach(cap => {
        const fn = cap.getAttribute('data-track');
        if (!fn) return;
        const ctags = window.getTrackCustomTagsV74(fn);
        const entries = Object.entries(ctags);
        let badgeBox = cap.querySelector('.jenny-custom-tag-badges-v74');
        if (entries.length === 0) {
            if (badgeBox) badgeBox.remove();
            return;
        }
        const titleZone = cap.querySelector('.track-title-zone');
        if (!titleZone) return;
        titleZone.style.flexWrap = 'wrap';
        if (!badgeBox) {
            badgeBox = document.createElement('div');
            badgeBox.className = 'jenny-custom-tag-badges-v74';
            badgeBox.style.cssText = 'width:100%;display:flex;flex-wrap:wrap;gap:4px;margin-top:2px;padding-left:18px;';
            titleZone.appendChild(badgeBox);
        }
        badgeBox.innerHTML = entries.map(([k, v]) =>
            `<span style="font-size:10px;background:rgba(227,179,65,0.16);border:1px solid rgba(227,179,65,0.55);color:#f2cc60;padding:1px 6px;border-radius:6px;font-weight:bold;">🏷️ ${k}: ${v}</span>`
        ).join('');
    });
};

// Дополняем renderActivePlaylistTracksV71 поддержкой вкладки 'tags' и отрисовкой бейджей кастомных тегов
const _prevRenderV73_1 = window.renderActivePlaylistTracksV71;
window.renderActivePlaylistTracksV71 = function(scrollSubChipToCenter) {
    const tabId = window.activePlaylistTabV71 || 'all';
    if (tabId === 'tags') {
        const unifiedBox = document.getElementById('unifiedList');
        if (!unifiedBox || !window.lastData) return;
        window.mountPlaylistStripDOMV71();
        const subWrap = document.getElementById('jennySubFilterWrapV71');
        const oldSubBar = subWrap ? subWrap.querySelector('.jenny-subfilter-bar-v71') : null;
        const prevSubScroll = oldSubBar ? oldSubBar.scrollLeft : 0;

        const { groups } = window.collectAllCustomTagGroupsV74();
        const names = Object.keys(groups).sort((a, b) => a.localeCompare(b));
        if (!window.selectedTagV74 || !groups[window.selectedTagV74]) {
            window.selectedTagV74 = names[0] || '';
        }

        let subHtml = '';
        if (names.length > 0) {
            const chips = names.map(n => {
                const isSel = (n === window.selectedTagV74);
                const safeN = n.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                const cls = 'jenny-pl-chip-v71' + (isSel ? ' active-pl-chip' : '');
                return `<div class="${cls}" onclick="window.selectedTagV74='${safeN}';window.renderActivePlaylistTracksV71(false);">🏷️ ${n} <span class="jenny-pl-chip-count-v71">${groups[n].length}</span></div>`;
            }).join('');
            subHtml = `<div id="jennySubFilterBarActiveV73" class="jenny-subfilter-bar-v71">${chips}</div>`;
        } else {
            subHtml = `<div class="jenny-subfilter-bar-v71"><span style="font-size:11.5px;color:#8b949e;">🏷️ ${window.tr('Нет треков со своими тегами (добавь через кнопку МЕТА)', 'No tracks with custom tags yet (add via META)')}</span></div>`;
        }

        if (subWrap) {
            subWrap.innerHTML = subHtml;
            const newSubBar = document.getElementById('jennySubFilterBarActiveV73');
            if (newSubBar) {
                newSubBar.scrollLeft = prevSubScroll;
                window.attachStripLongPressV73(newSubBar, () => window.openSubStripLongPressModalV73());
            }
        }

        const baseList = groups[window.selectedTagV74] || [];
        const sorted = window.sortTrackArrayForTabV71(baseList, 'tags');
        window.viewedFullTabListV73 = [...sorted];
        if (!window.playingQueueListV73 || window.playingQueueListV73.length === 0) {
            window.playingQueueListV73 = [...sorted];
        }
        window.currentTrackList = window.playingQueueListV73;

        const sInp = document.getElementById('trackSearchInput');
        if (sInp) {
            sInp.placeholder = window.selectedTagV74
                ? `🔍 Поиск в теге «${window.selectedTagV74}» (${sorted.length})...`
                : `🔍 Поиск по тегам...`;
        }

        unifiedBox.innerHTML = sorted.length
            ? sorted.map(fn => buildTrackRowHTML(fn, 'main', (window.favorites || []).includes(fn) ? '❤️' : '🤍')).join('')
            : `<div style="padding:20px;color:#8b949e;text-align:center;">Добавь свой тег любому треку через кнопку «МЕТА» ➔ «➕ Поле»</div>`;

        window.decorateTrackRowsWithCustomTagsV74();
        window.filterTracks(sInp ? sInp.value : '');
        return;
    }

    _prevRenderV73_1.apply(this, arguments);
    window.decorateTrackRowsWithCustomTagsV74();
};

// Обновляем filterTracks и поиск в модальных окнах: ищем также по всем кастомным тегам и игнорируем пробелы ("поаль" находит "По альбомам")
window.filterTracks = function(query) {
    const sInp = document.getElementById('trackSearchInput');
    const rawQ = (query !== undefined && query !== null) ? String(query) : (sInp ? sInp.value : '');
    const lowerQuery = rawQ.trim().toLowerCase();
    const normQuery = window.normSearchV74(rawQ);

    const clrBtn = document.getElementById('btnClearTrackSearchV73');
    if (clrBtn) clrBtn.style.display = rawQ.length > 0 ? 'inline-flex' : 'none';

    const uList = document.getElementById('unifiedList');
    if (!uList) return;

    let visibleCount = 0;
    let totalRows = 0;

    uList.querySelectorAll('.track-row-capsule').forEach(cap => {
        const wrapper = cap.parentElement;
        if (!wrapper) return;
        const trackName = cap.getAttribute('data-track') || '';
        if (!trackName) return;

        if (window.isTrackAllowedByFormatSlots && !window.isTrackAllowedByFormatSlots(trackName)) {
            wrapper.style.display = 'none';
            return;
        }

        totalRows++;
        if (!lowerQuery) {
            wrapper.style.display = 'block';
            visibleCount++;
            return;
        }

        const meta = window.getTrackMetaV71 ? window.getTrackMetaV71(trackName) : { artist: '', album: '' };
        const ctags = window.getTrackCustomTagsV74(trackName);
        const ctagsStr = Object.entries(ctags).map(([k, v]) => `${k} ${v}`).join(' ');
        const srvTags = (window.lastData && window.lastData.track_meta && window.lastData.track_meta[trackName] && window.lastData.track_meta[trackName].user_tags) || {};
        const srvTagsStr = Object.entries(srvTags).map(([k, v]) => `${k} ${v}`).join(' ');

        const haystack = (trackName + ' ' + (meta.artist || '') + ' ' + (meta.album || '') + ' ' + ctagsStr + ' ' + srvTagsStr).toLowerCase();
        const isMatch = haystack.includes(lowerQuery) || (normQuery && window.normSearchV74(haystack).includes(normQuery));
        wrapper.style.display = isMatch ? 'block' : 'none';
        if (isMatch) visibleCount++;
    });

    const cntEl = document.getElementById('tracksCount');
    if (cntEl) cntEl.innerText = lowerQuery ? `${visibleCount}/${totalRows}` : `${totalRows}`;

    let emptySearchMsg = document.getElementById('jennyEmptySearchMsgV73');
    if (lowerQuery && totalRows > 0 && visibleCount === 0) {
        if (!emptySearchMsg) {
            emptySearchMsg = document.createElement('div');
            emptySearchMsg.id = 'jennyEmptySearchMsgV73';
            emptySearchMsg.style.cssText = 'padding:18px 10px;color:#8b949e;text-align:center;font-size:12.5px;';
            uList.appendChild(emptySearchMsg);
        }
        emptySearchMsg.innerText = window.tr(
            `По запросу «${rawQ.trim()}» в текущем разделе ничего не найдено`,
            `No tracks matching "${rawQ.trim()}" in current view`
        );
        emptySearchMsg.style.display = 'block';
    } else if (emptySearchMsg) {
        emptySearchMsg.style.display = 'none';
    }
};

// Делаем поиск в модалке плейлистов и подгрупп нечувствительным к пробелам ("поаль" -> "По альбомам") и поддерживающим вкладку 'tags'
const _origOpenAllPlModalV73 = window.openAllPlaylistsLongPressModalV73;
window.openAllPlaylistsLongPressModalV73 = function() {
    _origOpenAllPlModalV73.apply(this, arguments);
    const filterInp = document.getElementById('inpFilterPlaylistsModalV73');
    const listEl = document.getElementById('bodyPlaylistsModalListV73');
    if (!filterInp || !listEl) return;
    const allTabs = window.getAllPlaylistTabsV71();
    const vis = window.appConfig.visiblePlaylistTabsV71 || {};
    filterInp.oninput = function() {
        const nq = window.normSearchV74(this.value);
        const filtered = allTabs.filter(t => !nq || window.normSearchV74(t.name).includes(nq));
        listEl.innerHTML = filtered.map(t => {
            const isAct = (t.id === window.activePlaylistTabV71);
            const cnt = window.getTrackCountForTabV71(t.id);
            const isVis = (vis[t.id] !== false);
            return `<div class="jenny-popup-item-v73 ${isAct ? 'active-popup-item-v73' : ''}" onclick="window.pickPlaylistFromModalV73('${t.id}', event)"><div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;"><input type="checkbox" ${isVis ? 'checked' : ''} onclick="event.stopPropagation();" onchange="window.appConfig.visiblePlaylistTabsV71['${t.id}']=this.checked;window.savePlaylistStateQuietlyV71();window.renderPlaylistStripChipsV71();"><span style="font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.icon} ${t.name}</span></div><span class="jenny-pl-chip-count-v71" style="font-size:11px;padding:2px 8px;">${cnt}</span></div>`;
        }).join('');
    };
};

setTimeout(() => {
    window.renderPlaylistStripChipsV71();
    window.renderActivePlaylistTracksV71(false);
}, 150);


// === V74.1 PLAY/PAUSE LONG-PRESS LOCATOR & WEBAUDIO CLOCK SYNC ===

// 1. Функция умного перехода к текущему играющему треку из любой вкладки и любого окна
window.locateCurrentPlayingTrackV74_1 = function() {
    if (!window.currentPlayingTrack) {
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('⚠️ Сейчас ни один трек не выбран', '⚠️ No track is currently playing'));
        }
        return;
    }

    try { navigator.vibrate(50); } catch (e) {}

    // Закрываем все открытые модальные и всплывающие окна
    if (typeof window.closeAllV71Modals === 'function') window.closeAllV71Modals();
    ['settingsModal', 'favModal', 'eqModal', 'specModal', 'themeModal'].forEach(m => {
        const el = document.getElementById(m);
        if (el) el.classList.remove('open');
        const btn = document.getElementById('btn-' + m);
        if (btn) btn.style.color = '';
    });
    if (typeof window.syncHeaderHeightWithModalsV71 === 'function') {
        window.syncHeaderHeightWithModalsV71();
    }
    if (typeof window.updateTopSearchOrMonitorBar === 'function') {
        window.updateTopSearchOrMonitorBar();
    }

    const track = window.currentPlayingTrack;
    const sInp = document.getElementById('trackSearchInput');

    // Сбрасываем поисковый фильтр, если он скрывает песни
    if (sInp && sInp.value.trim() !== '') {
        sInp.value = '';
        if (typeof window.filterTracks === 'function') window.filterTracks('');
    }

    // Проверяем, есть ли карточка играющего трека в текущем открытом списке
    const findRowInDOM = () => {
        const rows = document.querySelectorAll('#unifiedList .track-row-capsule');
        for (const r of rows) {
            if (r.getAttribute('data-track') === track && r.parentElement && r.parentElement.style.display !== 'none') {
                return r;
            }
        }
        return null;
    };

    let targetRow = findRowInDOM();

    // Если трека нет в текущей открытой вкладке — переключаемся в ту вкладку, откуда играет очередь (или во «Все»)
    if (!targetRow) {
        const qCtx = window.playingQueueContextV73 || {};
        let targetTab = qCtx.tabId || 'all';

        window.ensurePlaylistStateV71();
        window.appConfig.visiblePlaylistTabsV71[targetTab] = true;
        window.activePlaylistTabV71 = targetTab;
        if (targetTab === 'artists' && qCtx.artist) window.selectedArtistV71 = qCtx.artist;
        if (targetTab === 'albums' && qCtx.album) window.selectedAlbumV71 = qCtx.album;

        window.renderPlaylistStripChipsV71();
        window.renderActivePlaylistTracksV71(true);
        targetRow = findRowInDOM();

        // Если и там не нашлось (например, песня была убрана из Избранного) — открываем вкладку «Все»
        if (!targetRow && targetTab !== 'all') {
            window.appConfig.visiblePlaylistTabsV71.all = true;
            window.activePlaylistTabV71 = 'all';
            window.renderPlaylistStripChipsV71();
            window.renderActivePlaylistTracksV71(true);
            targetRow = findRowInDOM();
        }

        // Прокручиваем верхнюю ленту плейлистов к активной вкладке
        const strip = document.getElementById('jennyPlaylistScrollStripV71');
        const actChip = strip ? strip.querySelector('.active-pl-chip') : null;
        if (actChip && typeof actChip.scrollIntoView === 'function') {
            actChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }

    if (targetRow) {
        setTimeout(() => {
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetRow.classList.remove('orig-highlight-pulse-v68');
            void targetRow.offsetWidth;
            targetRow.classList.add('orig-highlight-pulse-v68');
            setTimeout(() => targetRow.classList.remove('orig-highlight-pulse-v68'), 2200);
        }, 60);
    }
};

// Перепривязываем кнопку #playPauseBtn на клон без старого обработчика из ui_controls.js
(function rebindPlayPauseBtnV74_1() {
    const oldBtn = document.getElementById('playPauseBtn');
    if (!oldBtn || oldBtn._reboundV74_1) return;
    const newBtn = oldBtn.cloneNode(true);
    newBtn._reboundV74_1 = true;
    newBtn.removeAttribute('onclick');
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);

    let ppTimer = null;
    let ppFired = false;

    newBtn.addEventListener('touchstart', () => {
        ppFired = false;
        clearTimeout(ppTimer);
        ppTimer = setTimeout(() => {
            ppFired = true;
            window.locateCurrentPlayingTrackV74_1();
        }, 360);
    }, { passive: true });

    newBtn.addEventListener('touchmove', () => {
        clearTimeout(ppTimer);
    }, { passive: true });

    newBtn.addEventListener('touchend', (e) => {
        clearTimeout(ppTimer);
        if (!ppFired) {
            if (typeof window.togglePlay === 'function') window.togglePlay();
        }
        if (e && e.cancelable) e.preventDefault();
    }, { passive: false });

    newBtn.addEventListener('click', (e) => {
        if (!('ontouchstart' in window)) {
            if (typeof window.togglePlay === 'function') window.togglePlay();
        }
    });
})();

// 2. Синхронизация таймера и состояния Play/Pause при фоновом переключении трека (когда поёт studioSourceNode в WebAudio)
window._studioClockV74_1 = {
    active: false,
    startCtxTime: 0,
    startTrackSec: 0,
    lastAdvTime: 0
};

(function installWebAudioClockWatchdogV74_1() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !AC.prototype._clockHookedV74_1) {
        AC.prototype._clockHookedV74_1 = true;
        const prevStart = AC.prototype.createBufferSource;
        AC.prototype.createBufferSource = function() {
            const node = prevStart.apply(this, arguments);
            const origNodeStart = node.start;
            node.start = function(when, offset) {
                const player = document.getElementById('audioPlayer');
                window._studioClockV74_1.active = true;
                window._studioClockV74_1.startCtxTime = (window.audioCtx ? window.audioCtx.currentTime : 0);
                window._studioClockV74_1.startTrackSec = (player && isFinite(player.currentTime)) ? player.currentTime : (offset || 0);
                return origNodeStart.apply(this, arguments);
            };
            return node;
        };
    }

    // Надёжный togglePlay: если studioSourceNode играет, а <audio> заснул в фоне на паузе — ставим на паузу обоих!
    window.togglePlay = function() {
        const player = document.getElementById('audioPlayer');
        if (!player || !player.src) {
            if (window.topTrack) window.playTrack(window.topTrack, 'main');
            return;
        }
        if (typeof window.initAudioBoost === 'function') window.initAudioBoost();

        const isActuallyPlaying = (!player.paused) || Boolean(window.isStudioPlaying && window.studioSourceNode);
        if (isActuallyPlaying) {
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null;
                try { window.studioSourceNode.stop(); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
                window.studioSourceNode = null;
            }
            window.isStudioPlaying = false;
            window._studioClockV74_1.active = false;
            player.pause();
            const btn = document.getElementById('playPauseBtn');
            if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            if (typeof window.updateTrackListPlayIcons === 'function') window.updateTrackListPlayIcons();
        } else {
            player.play().then(() => {
                if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                    window.syncMasterPlaybackEngineV59(false);
                }
            }).catch(() => {
                if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                    window.syncMasterPlaybackEngineV59(false);
                }
            });
        }
    };

    // Фоновый сторож таймера: если studioSourceNode поёт, а <audio> в фоне застрял на 0:00 — двигаем время и UI!
    setInterval(() => {
        const player = document.getElementById('audioPlayer');
        if (!player || !window.isStudioPlaying || !window.studioSourceNode || !window.audioCtx) return;

        const dur = (isFinite(player.duration) && player.duration > 0)
            ? player.duration
            : (window.studioBuffer ? window.studioBuffer.duration : 0);
        if (dur <= 0) return;

        // Если <audio> случайно встал на паузу в фоне, пока играет studioSourceNode — будим его или ведём часы сами
        if (player.paused) {
            const spd = (typeof window.getActiveTargetSpeedV59 === 'function') ? window.getActiveTargetSpeedV59() : 1.0;
            const elapsedCtx = Math.max(0, window.audioCtx.currentTime - window._studioClockV74_1.startCtxTime);
            const estCur = Math.min(dur, window._studioClockV74_1.startTrackSec + elapsedCtx * spd);
            try { player.currentTime = estCur; } catch (e) {}
            player.play().catch(() => {});

            const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
            if (typeof window.updateProgressUI === 'function') {
                window.updateProgressUI(estCur, dur, isRev);
            }
            const btn = document.getElementById('playPauseBtn');
            if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
            if (estCur >= dur - 0.15) {
                window.isStudioPlaying = false;
                if (typeof window.playNextTrack === 'function') window.playNextTrack();
            }
        }
    }, 300);
})();


// === V74.2 GEARBOX HARDWARE CLOCK LOCK (NO SILENCE ON 2ND/VINYL & NO 0:00 RESET) ===

// Возвращает точную секунду воспроизведения (даже если фоновый <audio> заснул на 0:00)
window.getTruePlaybackTimeV74_2 = function() {
    const player = document.getElementById('audioPlayer');
    const pTime = (player && isFinite(player.currentTime)) ? player.currentTime : 0;
    const clk = window._studioClockV74_1;
    if (window.isStudioPlaying && clk && clk.active && window.audioCtx) {
        const spd = (typeof window.getActiveTargetSpeedV59 === 'function') ? window.getActiveTargetSpeedV59() : 1.0;
        const est = clk.startTrackSec + Math.max(0, window.audioCtx.currentTime - clk.startCtxTime) * spd;
        const maxDur = (window.studioBuffer && window.studioBuffer.duration) ? window.studioBuffer.duration : (player && isFinite(player.duration) ? player.duration : 999999);
        const clampedEst = Math.max(0, Math.min(maxDur - 0.05, est));
        // Если <audio> застрял на 0:00, а WebAudio уже ушёл вперёд — возвращаем аппаратное время WebAudio и синхронизируем <audio>
        if (Math.abs(pTime - clampedEst) > 0.6) {
            if (player) {
                try { player.currentTime = clampedEst; } catch (e) {}
            }
            return clampedEst;
        }
    }
    return pTime;
};

// Переопределяем 2-ю передачу (J Buf Pitch Shift) и Заднюю R (Винил), чтобы они НИКОГДА не глушили звук, если <audio> был на паузе при играющем RAM!
window.engageDirectRamPitchShiftV70 = function(gearKey, targetSpd) {
    const player = document.getElementById('audioPlayer');
    if (!player || !window.audioCtx) return false;

    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    if (isRev && window.studioBuffer && window.studioBuffer.duration > 900 && !window.reversedStudioBuffer) {
        return window.engageHorizonRamEngineV71_5(gearKey, false);
    }

    const hasRev67 = Boolean(
        window.reconstructedMasterBufferV67 &&
        window.currentTrackRevMapV67 &&
        window.currentTrackRevNameV67 === window.currentPlayingTrack
    );

    let rawBuf = hasRev67
        ? (isRev ? (window.reconstructedReversedBufferV67 || window.reconstructedMasterBufferV67) : window.reconstructedMasterBufferV67)
        : (isRev ? (window.reversedStudioBuffer || window.studioBuffer) : window.studioBuffer);

    const isActivelyPlaying = (!player.paused) || Boolean(window.isStudioPlaying);

    if (!rawBuf) {
        if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
        player.preservesPitch = false;
        player.mozPreservesPitch = false;
        player.webkitPreservesPitch = false;
        if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
            try { player.playbackRate = targetSpd; } catch (e) {}
        }
        if (isActivelyPlaying && player.paused) {
            player.play().catch(() => {});
        }
        return false;
    }

    const trueSec = window.getTruePlaybackTimeV74_2();
    if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
    player.preservesPitch = false;
    if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
        try { player.playbackRate = targetSpd; } catch (e) {}
    }

    const isVinyl = (gearKey === 'vinyl-shift');
    const effSpd = hasRev67
        ? Math.max(0.25, Math.min(3.0, (parseFloat(window.currentTrackRevMapV67.spd) || 1.0) * targetSpd))
        : targetSpd;

    if (isActivelyPlaying) {
        if (player.paused) {
            try { player.currentTime = trueSec; } catch (e) {}
            player.play().catch(() => {});
        }
        const needNewNode = !window.studioSourceNode ||
                            !window.isStudioPlaying ||
                            window.studioSourceNode.buffer !== rawBuf ||
                            Boolean(window.studioSourceNode._isHoseSpliced);
        if (needNewNode) {
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null;
                try { window.studioSourceNode.stop(); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
            }
            window.studioSourceNode = window.audioCtx.createBufferSource();
            window.studioSourceNode._isHoseSpliced = false;
            window.studioSourceNode.buffer = rawBuf;
            window.studioSourceNode.playbackRate.value = effSpd;
            window.studioSourceNode.connect(window.inputMixer);

            let offset = trueSec;
            if (!isFinite(offset) || offset < 0) offset = 0;
            if (offset >= rawBuf.duration) offset = Math.max(0, rawBuf.duration - 0.05);

            window.studioSourceNode.start(0, offset);
            window.isStudioPlaying = true;
            if (window._studioClockV74_1) {
                window._studioClockV74_1.active = true;
                window._studioClockV74_1.startCtxTime = window.audioCtx.currentTime;
                window._studioClockV74_1.startTrackSec = offset;
            }
        } else if (window.studioSourceNode && window.studioSourceNode.playbackRate) {
            const now = window.audioCtx.currentTime;
            if (isVinyl) {
                window.studioSourceNode.playbackRate.setTargetAtTime(effSpd, now, 0.085);
            } else {
                window.studioSourceNode.playbackRate.setValueAtTime(effSpd, now);
            }
        }
    }

    const badge = document.getElementById('hoseLiveTelemetryV44');
    if (badge) {
        badge.style.color = isVinyl ? '#d2a8ff' : '#3fb950';
        badge.innerText = isVinyl
            ? `💿 ВИНИЛ [RAM Platter]: x${effSpd.toFixed(2)} (Инерция 85мс)`
            : `⚡ J Buf RAM [PITCH SHIFT]: x${effSpd.toFixed(2)} (Прямой 32-bit буфер)`;
    }
    return true;
};

// Перед вызовом любого переключения передач в syncMasterPlaybackEngineV59 синхронизируем player.currentTime с аппаратными часами WebAudio
(function syncPlayerBeforeGearShiftV74_2() {
    const prevMasterSync = window.syncMasterPlaybackEngineV59;
    window.syncMasterPlaybackEngineV59 = function(isDraggingArc) {
        const player = document.getElementById('audioPlayer');
        if (player && window.isStudioPlaying) {
            const trueSec = window.getTruePlaybackTimeV74_2();
            if (Math.abs((player.currentTime || 0) - trueSec) > 0.4) {
                try { player.currentTime = trueSec; } catch (e) {}
            }
            if (player.paused) {
                player.play().catch(() => {});
            }
        }
        return prevMasterSync.apply(this, arguments);
    };
})();


// === V74.3 UNFOCUSED SUB-STRIP MODE & LIVE CHIP SEARCH (TAGS, ARTISTS, ALBUMS) ===

// Сбрасываем принудительный автофокус при старте
window.selectedArtistV71 = null;
window.selectedAlbumV71 = null;
window.selectedTagV74 = null;

// При клике по вкладке в первой строке: если нажали на уже открытую вкладку (По тегам / По артистам / По альбомам) — снимаем фокус с подкатегории!
const _origSelectPlaylistTabV71 = window.selectPlaylistTabV71;
window.selectPlaylistTabV71 = function(tabId, ev) {
    if (window.activePlaylistTabV71 === tabId) {
        if (tabId === 'artists') window.selectedArtistV71 = null;
        if (tabId === 'albums') window.selectedAlbumV71 = null;
        if (tabId === 'tags') window.selectedTagV74 = null;
    }
    return _origSelectPlaylistTabV71.apply(this, arguments);
};

// Переключатель фокуса капсулы во второй строке (тап — сфокусировать, повторный тап — снять фокус!)
window.toggleSubFilterChipV74_3 = function(tabId, itemName, scrollChipIntoView) {
    const prop = (tabId === 'artists') ? 'selectedArtistV71' : ((tabId === 'albums') ? 'selectedAlbumV71' : 'selectedTagV74');
    if (window[prop] === itemName) {
        // Повторный тап по активному тегу/артисту/альбому снимает с него фокус
        window[prop] = null;
    } else {
        window[prop] = itemName;
        // Если пользователь искал сам тег/артиста через строку поиска и тапнул на найденную капсулу — очищаем фильтр, чтобы показать все треки внутри неё
        const sInp = document.getElementById('trackSearchInput');
        if (sInp && sInp.value.trim() !== '') {
            sInp.value = '';
        }
    }
    window.renderActivePlaylistTracksV71(Boolean(scrollChipIntoView));
};

window.selectSubFilterItemV73 = function(tabId, itemName, scrollChipIntoView) {
    window.toggleSubFilterChipV74_3(tabId, itemName, scrollChipIntoView);
};

// Обновляем placeholder строки поиска с учётом сфокусированного/несфокусированного состояния
window.updateScopedSearchPlaceholderV73 = function(baseCount) {
    const sInp = document.getElementById('trackSearchInput');
    if (!sInp) return;

    if (!sInp.parentElement.classList.contains('jenny-search-wrap-v73')) {
        const p = sInp.parentElement;
        p.classList.add('jenny-search-wrap-v73');
        const clrBtn = document.createElement('button');
        clrBtn.type = 'button';
        clrBtn.id = 'btnClearTrackSearchV73';
        clrBtn.className = 'jenny-search-clear-btn-v73';
        clrBtn.innerHTML = '✖';
        clrBtn.onclick = (e) => {
            e.stopPropagation();
            sInp.value = '';
            window.filterTracks('');
            sInp.blur();
        };
        p.appendChild(clrBtn);
        sInp.oninput = function() { window.filterTracks(this.value); };
    }

    const tabId = window.activePlaylistTabV71 || 'all';
    const cnt = (typeof baseCount === 'number') ? baseCount : (window.currentTrackList ? window.currentTrackList.length : 0);
    let scopeLabel = '';

    if (tabId === 'all') {
        scopeLabel = window.tr(`🔍 Поиск во «Все» (${cnt})...`, `🔍 Search in "All" (${cnt})...`);
    } else if (tabId === 'fav') {
        scopeLabel = window.tr(`🔍 Поиск в «Избранное» (${cnt})...`, `🔍 Search in "Favorites" (${cnt})...`);
    } else if (tabId === 'artists') {
        if (window.selectedArtistV71) {
            scopeLabel = window.tr(`🔍 Поиск у «${window.selectedArtistV71}» (${cnt})...`, `🔍 Search in "${window.selectedArtistV71}" (${cnt})...`);
        } else {
            const artCnt = Object.keys(window.collectActiveSubGroupsV73('artists')).length;
            scopeLabel = window.tr(`🔍 Найти артиста (${artCnt}) или трек (${cnt})...`, `🔍 Find artist (${artCnt}) or track (${cnt})...`);
        }
    } else if (tabId === 'albums') {
        if (window.selectedAlbumV71) {
            scopeLabel = window.tr(`🔍 Поиск в альбоме «${window.selectedAlbumV71}» (${cnt})...`, `🔍 Search in album "${window.selectedAlbumV71}" (${cnt})...`);
        } else {
            const albCnt = Object.keys(window.collectActiveSubGroupsV73('albums')).length;
            scopeLabel = window.tr(`🔍 Найти альбом (${albCnt}) или трек (${cnt})...`, `🔍 Find album (${albCnt}) or track (${cnt})...`);
        }
    } else if (tabId === 'tags') {
        if (window.selectedTagV74) {
            scopeLabel = window.tr(`🔍 Поиск в теге «${window.selectedTagV74}» (${cnt})...`, `🔍 Search in tag "${window.selectedTagV74}" (${cnt})...`);
        } else {
            const tagCnt = Object.keys(window.collectActiveSubGroupsV73('tags')).length;
            scopeLabel = window.tr(`🔍 Найти тег (${tagCnt}) или трек (${cnt})...`, `🔍 Find tag (${tagCnt}) or track (${cnt})...`);
        }
    } else {
        const pl = (window.appConfig.customPlaylistsV71 || []).find(p => p.id === tabId);
        const plName = pl ? pl.name : 'Плейлист';
        scopeLabel = window.tr(`🔍 Поиск в «${plName}» (${cnt})...`, `🔍 Search in "${plName}" (${cnt})...`);
    }

    sInp.placeholder = scopeLabel;
    const clrBtn = document.getElementById('btnClearTrackSearchV73');
    if (clrBtn) {
        clrBtn.style.display = (sInp.value && sInp.value.length > 0) ? 'inline-flex' : 'none';
    }
};

// Единый рендер для всех вкладок (Все, Избранное, По артистам, По альбомам, По тегам, Плейлисты) без принудительного фокуса первой капсулы!
window.renderActivePlaylistTracksV71 = function(scrollSubChipToCenter) {
    const unifiedBox = document.getElementById('unifiedList');
    if (!unifiedBox || !window.lastData) return;
    window.mountPlaylistStripDOMV71();

    const prevQueue = (window.playingQueueListV73 && window.playingQueueListV73.length > 0)
        ? [...window.playingQueueListV73]
        : null;

    const subWrap = document.getElementById('jennySubFilterWrapV71');
    const oldSubBar = subWrap ? subWrap.querySelector('.jenny-subfilter-bar-v71') : null;
    const prevSubScroll = oldSubBar ? oldSubBar.scrollLeft : 0;

    const tabId = window.activePlaylistTabV71 || 'all';
    const allTracks = (window.lastData.all_tracks || []).filter(fn =>
        window.isTrackAllowedByFormatSlots ? window.isTrackAllowedByFormatSlots(fn) : true
    );
    let subHtml = '';
    let baseList = [];

    if (tabId === 'all') {
        baseList = allTracks;
    } else if (tabId === 'fav') {
        baseList = window.favorites || [];
    } else if (tabId === 'artists' || tabId === 'albums' || tabId === 'tags') {
        const icon = tabId === 'artists' ? '🎤' : (tabId === 'albums' ? '💿' : '🏷️');
        const prop = tabId === 'artists' ? 'selectedArtistV71' : (tabId === 'albums' ? 'selectedAlbumV71' : 'selectedTagV74');
        const groups = window.collectActiveSubGroupsV73(tabId);
        const names = Object.keys(groups).sort((a, b) => a.localeCompare(b));

        // Если ранее выбранный элемент больше не существует — сбрасываем фокус в null (НЕ выбираем принудительно names[0]!)
        if (window[prop] && !groups[window[prop]]) {
            window[prop] = null;
        }

        if (names.length > 0) {
            const chips = names.map(n => {
                const isSel = (n === window[prop]);
                const safeN = n.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                const cls = 'jenny-pl-chip-v71' + (isSel ? ' active-pl-chip' : '');
                return `<div class="${cls}" data-subname="${n.replace(/"/g, '&quot;')}" onclick="window.toggleSubFilterChipV74_3('${tabId}','${safeN}',false)">${icon} ${n} <span class="jenny-pl-chip-count-v71">${groups[n].length}</span></div>`;
            }).join('');
            subHtml = `<div id="jennySubFilterBarActiveV73" class="jenny-subfilter-bar-v71">${chips}</div>`;
        } else if (tabId === 'tags') {
            subHtml = `<div class="jenny-subfilter-bar-v71"><span style="font-size:11.5px;color:#8b949e;">🏷️ ${window.tr('Нет треков со своими тегами (добавь через кнопку МЕТА)', 'No tracks with custom tags yet (add via META)')}</span></div>`;
        }

        if (window[prop] && groups[window[prop]]) {
            baseList = groups[window[prop]];
        } else if (tabId === 'tags') {
            // Когда ни один конкретный тег не сфокусирован — показываем все треки, у которых есть хотя бы один кастомный тег
            const seen = new Set();
            names.forEach(n => {
                (groups[n] || []).forEach(fn => {
                    if (!seen.has(fn)) {
                        seen.add(fn);
                        baseList.push(fn);
                    }
                });
            });
        } else {
            baseList = allTracks;
        }
    } else {
        const pl = (window.appConfig.customPlaylistsV71 || []).find(p => p.id === tabId);
        if (pl) {
            baseList = Array.isArray(pl.tracks) ? pl.tracks : [];
            subHtml = `<div id="jennySubFilterBarActiveV73" class="jenny-subfilter-bar-v71" style="justify-content:space-between;"><span style="font-size:11.5px;color:#79c0ff;font-weight:bold;">🎶 ${pl.name} (${baseList.length})</span><div style="display:flex;gap:6px;"><button type="button" onclick="window.openImportFolderToPlaylistModalV71('${pl.id}')" style="padding:3px 8px;font-size:10.5px;color:#3fb950;">📁 +Папка</button><button type="button" onclick="window.deleteCustomPlaylistV71('${pl.id}')" style="padding:3px 8px;font-size:10.5px;color:#ff7b72;">🗑️ Удалить</button></div></div>`;
        }
    }

    if (subWrap) {
        subWrap.innerHTML = subHtml;
        const newSubBar = document.getElementById('jennySubFilterBarActiveV73');
        if (newSubBar) {
            newSubBar.scrollLeft = prevSubScroll;
            if (scrollSubChipToCenter) {
                const actChip = newSubBar.querySelector('.active-pl-chip');
                if (actChip && typeof actChip.scrollIntoView === 'function') {
                    actChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
            }
            window.attachStripLongPressV73(newSubBar, () => {
                window.openSubStripLongPressModalV73();
            });
        }
    }

    const sorted = window.sortTrackArrayForTabV71(baseList, tabId);
    window.viewedFullTabListV73 = [...sorted];

    const qCtx = window.playingQueueContextV73 || {};
    const isSameContext = (
        qCtx.tabId === tabId &&
        (tabId !== 'artists' || qCtx.artist === (window.selectedArtistV71 || '')) &&
        (tabId !== 'albums' || qCtx.album === (window.selectedAlbumV71 || ''))
    );

    if (!prevQueue || prevQueue.length === 0) {
        window.playingQueueListV73 = [...sorted];
        window.playingQueueContextV73 = {
            tabId: tabId,
            artist: window.selectedArtistV71 || '',
            album: window.selectedAlbumV71 || ''
        };
    } else if (isSameContext && sorted.includes(window.currentPlayingTrack)) {
        window.playingQueueListV73 = [...sorted];
    } else {
        window.playingQueueListV73 = prevQueue;
    }

    window.currentTrackList = window.playingQueueListV73;
    window.topTrack = sorted[0] || null;

    window.updateScopedSearchPlaceholderV73(sorted.length);

    let html = '';
    if (!sorted.length) {
        html = `<div style="padding:20px;color:#8b949e;text-align:center;">${window.tr('Список пуст', 'Playlist is empty')}</div>`;
    } else {
        sorted.forEach(fn => {
            const isFav = (window.favorites || []).includes(fn);
            html += buildTrackRowHTML(fn, 'main', isFav ? '❤️' : '🤍');
        });
    }
    unifiedBox.innerHTML = html;

    if (typeof window.decorateTrackRowsWithCustomTagsV74 === 'function') {
        window.decorateTrackRowsWithCustomTagsV74();
    }

    const sInp = document.getElementById('trackSearchInput');
    window.filterTracks(sInp ? sInp.value : '');

    if (window.expandedTracks && window.expandedTracks.size > 0) {
        document.querySelectorAll('.track-row-capsule.expanded-capsule').forEach(r => {
            const fn = r.getAttribute('data-track');
            if (fn) window.syncRowActionButtons(r, fn, true);
        });
    }
};

// Обновляем filterTracks: если мы во вкладке По тегам / По артистам / По альбомам и ни одна капсула НЕ сфокусирована,
// ввод в строку поиска в реальном времени фильтрует и КАПСУЛЫ во второй строке, и треки внизу!
const _prevFilterTracksV74 = window.filterTracks;
window.filterTracks = function(query) {
    _prevFilterTracksV74.apply(this, arguments);

    const tabId = window.activePlaylistTabV71 || 'all';
    if (tabId !== 'artists' && tabId !== 'albums' && tabId !== 'tags') return;

    const prop = tabId === 'artists' ? 'selectedArtistV71' : (tabId === 'albums' ? 'selectedAlbumV71' : 'selectedTagV74');
    const subBar = document.getElementById('jennySubFilterBarActiveV73');
    if (!subBar) return;

    const sInp = document.getElementById('trackSearchInput');
    const rawQ = (query !== undefined && query !== null) ? String(query) : (sInp ? sInp.value : '');
    const lowerQ = rawQ.trim().toLowerCase();
    const normQ = window.normSearchV74 ? window.normSearchV74(rawQ) : lowerQ;

    // Если конкретная капсула НЕ сфокусирована — фильтруем сами капсулы второй строки по введённому запросу!
    if (!window[prop]) {
        subBar.querySelectorAll('.jenny-pl-chip-v71').forEach(chip => {
            const subName = (chip.getAttribute('data-subname') || chip.textContent || '').toLowerCase();
            if (!lowerQ) {
                chip.style.display = 'inline-flex';
                return;
            }
            const match = subName.includes(lowerQ) || (normQ && window.normSearchV74(subName).includes(normQ));
            chip.style.display = match ? 'inline-flex' : 'none';
        });
    } else {
        subBar.querySelectorAll('.jenny-pl-chip-v71').forEach(chip => {
            chip.style.display = 'inline-flex';
        });
    }
};

// Обновляем модальное окно по зажатию 180 мс на второй строке: поддержка 'tags' + снятие фокуса повторным тапом
window.openSubStripLongPressModalV73 = function() {
    const tabId = window.activePlaylistTabV71 || 'all';
    if (tabId !== 'artists' && tabId !== 'albums' && tabId !== 'tags') {
        if (String(tabId).startsWith('pl_')) {
            window.openImportFolderToPlaylistModalV71(tabId);
        } else {
            window.openAllPlaylistsLongPressModalV73();
        }
        return;
    }

    window.closeAllV71Modals();
    const icon = tabId === 'artists' ? '🎤' : (tabId === 'albums' ? '💿' : '🏷️');
    const prop = tabId === 'artists' ? 'selectedArtistV71' : (tabId === 'albums' ? 'selectedAlbumV71' : 'selectedTagV74');
    const currentSel = window[prop] || '';
    const groups = window.collectActiveSubGroupsV73(tabId);
    const allNames = Object.keys(groups);

    const m = document.createElement('div');
    m.id = 'jennySubItemsPopupV73';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    const titleTxt = tabId === 'artists'
        ? `🎤 Все артисты (${allNames.length})`
        : (tabId === 'albums' ? `💿 Все альбомы (${allNames.length})` : `🏷️ Все теги (${allNames.length})`);
    const phTxt = tabId === 'artists'
        ? `🔍 Быстрый поиск артиста из ${allNames.length}...`
        : (tabId === 'albums' ? `🔍 Быстрый поиск альбома из ${allNames.length}...` : `🔍 Быстрый поиск тега из ${allNames.length}...`);

    m.innerHTML = `
        <div class="jenny-modal-card-v71" onclick="event.stopPropagation()">
            <div class="jenny-modal-hdr-v71">
                <span style="color:#58a6ff;font-weight:bold;">${titleTxt}</span>
                <button type="button" onclick="document.getElementById('jennySubItemsPopupV73').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button>
            </div>
            <div style="padding:10px 14px 6px 14px;background:#080b10;display:flex;flex-direction:column;gap:6px;border-bottom:1px solid #21262d;">
                <input type="text" id="inpFilterSubItemsModalV73" placeholder="${phTxt}" style="width:100%;padding:8px 10px;text-align:left !important;box-sizing:border-box;font-size:12.5px;">
                <div style="display:flex;gap:6px;">
                    <button type="button" id="btnSubSortAlphaV73" style="flex:1;padding:5px;font-size:11px;">🔤 А ➔ Я</button>
                    <button type="button" id="btnSubSortCountV73" style="flex:1;padding:5px;font-size:11px;">🔢 По кол-ву треков</button>
                </div>
            </div>
            <div class="jenny-modal-body-v71" id="bodySubItemsModalListV73" style="max-height:60vh;"></div>
        </div>
    `;
    document.body.appendChild(m);

    const listEl = document.getElementById('bodySubItemsModalListV73');
    const filterInp = document.getElementById('inpFilterSubItemsModalV73');
    const btnAlpha = document.getElementById('btnSubSortAlphaV73');
    const btnCount = document.getElementById('btnSubSortCountV73');

    const renderSubList = () => {
        const rawQ = String(filterInp.value || '').trim().toLowerCase();
        const normQ = window.normSearchV74 ? window.normSearchV74(rawQ) : rawQ;
        let names = allNames.filter(n => !rawQ || n.toLowerCase().includes(rawQ) || (normQ && window.normSearchV74(n).includes(normQ)));

        if (window._subModalSortModeV73 === 'count') {
            names.sort((a, b) => (groups[b].length - groups[a].length) || a.localeCompare(b));
            btnCount.style.borderColor = '#58a6ff';
            btnCount.style.color = '#58a6ff';
            btnAlpha.style.borderColor = '#30363d';
            btnAlpha.style.color = '#8b949e';
        } else {
            names.sort((a, b) => a.localeCompare(b));
            btnAlpha.style.borderColor = '#58a6ff';
            btnAlpha.style.color = '#58a6ff';
            btnCount.style.borderColor = '#30363d';
            btnCount.style.color = '#8b949e';
        }

        if (!names.length) {
            listEl.innerHTML = `<div style="padding:18px;color:#8b949e;text-align:center;">Ничего не найдено</div>`;
            return;
        }

        listEl.innerHTML = names.map(n => {
            const isSel = (n === currentSel);
            const cnt = groups[n].length;
            const safeN = n.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            return `
                <div class="jenny-popup-item-v73 ${isSel ? 'active-popup-item-v73' : ''}" onclick="document.getElementById('jennySubItemsPopupV73').remove();window.toggleSubFilterChipV74_3('${tabId}','${safeN}',true);">
                    <span style="font-weight:bold;word-break:break-word;flex:1;">${icon} ${n}</span>
                    <span class="jenny-pl-chip-count-v71" style="font-size:11px;padding:2px 8px;flex-shrink:0;">${cnt}</span>
                </div>
            `;
        }).join('');
    };

    btnAlpha.onclick = () => { window._subModalSortModeV73 = 'alpha'; renderSubList(); };
    btnCount.onclick = () => { window._subModalSortModeV73 = 'count'; renderSubList(); };
    filterInp.oninput = renderSubList;

    renderSubList();
};

setTimeout(() => {
    window.renderPlaylistStripChipsV71();
    window.renderActivePlaylistTracksV71(false);
}, 100);

