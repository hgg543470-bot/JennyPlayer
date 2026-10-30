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
    const sr = srcBuf.sampleRate;
    const numCh = srcBuf.numberOfChannels;
    const totalLen = srcBuf.length;
    const dur = srcBuf.duration;

    let cleanStart = Math.max(0, Math.min(dur - 0.05, startSec));
    let actualWinSec = Math.min(winSec, Math.max(0.1, dur - cleanStart));
    let frameCount = Math.max(256, Math.floor(actualWinSec * sr));

    let subBuf = window.audioCtx.createBuffer(numCh, frameCount, sr);
    if (!isRev) {
        let startFrame = Math.min(totalLen - frameCount, Math.max(0, Math.floor(cleanStart * sr)));
        for (let c = 0; c < numCh; c++) {
            const inp = srcBuf.getChannelData(c);
            const out = subBuf.getChannelData(c);
            out.set(inp.subarray(startFrame, startFrame + frameCount));
        }
    } else {
        // Для реверса на длинном треке читаем с конца назад без клонирования всех 3 ГБ!
        let revEndFrame = Math.min(totalLen, Math.max(frameCount, Math.floor((dur - cleanStart) * sr)));
        for (let c = 0; c < numCh; c++) {
            const inp = srcBuf.getChannelData(c);
            const out = subBuf.getChannelData(c);
            for (let i = 0; i < frameCount; i++) {
                out[i] = inp[revEndFrame - 1 - i];
            }
        }
    }
    return subBuf;
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

