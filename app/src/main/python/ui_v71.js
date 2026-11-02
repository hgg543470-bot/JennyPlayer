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
    stem = stem.replace(/(?:_x\d+(?:[.,]\d+)?(?:_[a-z0-9]+)*|_(?:slow|fast)(?:_[a-z0-9]+)*|_(?:jbuf90|jbuf_shift|jbuf|web_lock|web_shift|webapi|vinyl|neutral|pitchlock|bitperfect|psycho|ultra|hifi|restored)|_rev(?:ersed)?)+$/ig, '');

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
        ? Math.max(0.1, Math.min(100.0, (parseFloat(window.currentTrackRevMapV67.spd) || 1.0) * targetSpd))
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

    const curSec = (typeof window.getTruePlaybackTimeV74_2 === 'function') ? window.getTruePlaybackTimeV74_2() : (player.currentTime || 0);
    const WIN_SEC = Math.max(45.0, Math.min(360.0, targetSpd * 3.5)); // Нарезаем 45 секунд вперёд — занимает всего ~5 мс!
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
            const curSec = (typeof window.getTruePlaybackTimeV74_2 === 'function') ? window.getTruePlaybackTimeV74_2() : (player.currentTime || 0);
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

    const curSec = (typeof window.getTruePlaybackTimeV74_2 === 'function') ? window.getTruePlaybackTimeV74_2() : (player.currentTime || 0);
    const WIN_SEC = Math.max(45.0, Math.min(360.0, targetSpd * 3.5));
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
    const curSec = (typeof window.getTruePlaybackTimeV74_2 === 'function') ? window.getTruePlaybackTimeV74_2() : (player.currentTime || 0);
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
    const WIN_SEC = Math.max(24.0, Math.min(360.0, targetSpd * 3.5));
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

// 2. Перехватчики Play/Pause, кликов по таймлайну и точного разворота Реверса (V75)
window._studioClockV74_1 = {
    active: false,
    startCtxTime: 0,
    startTrackSec: 0
};
window._pendingSeekTargetV75 = null;

// Запоминаем точную целевую секунду при перемотке или развороте Реверса,
// чтобы даже если <audio> ещё ищет фрейм, RAM-буфер сразу стартовал с правильной секунды!
window.setExactPlaybackPositionV75 = function(targetSec) {
    const player = document.getElementById('audioPlayer');
    const cleanSec = Math.max(0, parseFloat(targetSec) || 0);
    window._pendingSeekTargetV75 = { sec: cleanSec, ts: performance.now() };
    if (window._studioClockV74_1) {
        window._studioClockV74_1.startTrackSec = cleanSec;
        window._studioClockV74_1.startCtxTime = window.audioCtx ? window.audioCtx.currentTime : 0;
    }
    if (player) {
        try { player.currentTime = cleanSec; } catch (e) {}
    }
};

window.getTruePlaybackTimeV74_2 = function() {
    const player = document.getElementById('audioPlayer');
    if (window._pendingSeekTargetV75 && (performance.now() - window._pendingSeekTargetV75.ts < 300)) {
        return window._pendingSeekTargetV75.sec;
    }
    const pTime = (player && isFinite(player.currentTime)) ? player.currentTime : 0;
    const clk = window._studioClockV74_1;
    if (player && player.paused && pTime < 0.05 && window.isStudioPlaying && clk && clk.active && window.audioCtx) {
        const spd = (typeof window.getActiveTargetSpeedV59 === 'function') ? window.getActiveTargetSpeedV59() : 1.0;
        const est = clk.startTrackSec + Math.max(0, window.audioCtx.currentTime - clk.startCtxTime) * spd;
        const maxDur = (window.studioBuffer && window.studioBuffer.duration)
            ? window.studioBuffer.duration
            : (isFinite(player.duration) ? player.duration : 999999);
        return Math.max(0, Math.min(maxDur - 0.05, est));
    }
    return pTime;
};

// Перехватчик toggleReverseMode: гарантирует зеркальный разворот времени (dur - cur) ровно 1 раз!
(function installExactReverseFlipInterceptorV75() {
    const baseToggleRev = window.toggleReverseMode;
    if (false && typeof baseToggleRev === 'function' && !window._exactRevHookV75) {
        window._exactRevHookV75 = true;
        window.toggleReverseMode = function(targetReversed) {
            const player = document.getElementById('audioPlayer');
            const oldRev = Boolean(window.isReversed);
            const newRev = (targetReversed !== undefined) ? Boolean(targetReversed) : !oldRev;
            if (newRev === oldRev) return;

            const dur = (window.studioBuffer && window.studioBuffer.duration)
                ? window.studioBuffer.duration
                : ((player && isFinite(player.duration) && player.duration > 0) ? player.duration : 0);
            const curBefore = window.getTruePlaybackTimeV74_2();
            const flippedSec = (dur > 0) ? Math.max(0, Math.min(dur - 0.02, dur - curBefore)) : curBefore;

            // Фиксируем зеркальную точку (например, 3:00 - 1:00 = 2:00 для реверс-буфера, что соответствует 1:00 песни)
            window.setExactPlaybackPositionV75(flippedSec);

            const res = baseToggleRev.apply(this, arguments);

            // Повторно закрепляем flippedSec, если внутри старого обработчика currentTime не успел сдвинуться
            window.setExactPlaybackPositionV75(flippedSec);
            if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            }
            if (player && dur > 0 && typeof window.updateProgressUI === 'function') {
                window.updateProgressUI(flippedSec, dur, newRev);
            }
            return res;
        };
    }

    // Перехватчик клика по таймлайну (seekAudio)
    const baseSeekAudio = window.seekAudio;
    if (typeof baseSeekAudio === 'function' && !window._exactSeekHookV75) {
        window._exactSeekHookV75 = true;
        window.seekAudio = function(event) {
            const res = baseSeekAudio.apply(this, arguments);
            const player = document.getElementById('audioPlayer');
            if (player && isFinite(player.currentTime)) {
                window.setExactPlaybackPositionV75(player.currentTime);
                if (!player.paused && typeof window.syncMasterPlaybackEngineV59 === 'function') {
                    window.syncMasterPlaybackEngineV59(false);
                }
            }
            return res;
        };
    }
})();

// Перехватчик 2-й передачи (J Buf Shift) и Задней R (Винил)
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
        ? Math.max(0.1, Math.min(100.0, (parseFloat(window.currentTrackRevMapV67.spd) || 1.0) * targetSpd))
        : targetSpd;

    if (isActivelyPlaying) {
        if (player.paused) {
            player.play().catch(() => {});
        }
        const seekRecent = window._pendingSeekTargetV75 && (performance.now() - window._pendingSeekTargetV75.ts < 350);
        const needNewNode = seekRecent ||
                            !window.studioSourceNode ||
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
            window._studioClockV74_1.active = true;
            window._studioClockV74_1.startCtxTime = window.audioCtx.currentTime;
            window._studioClockV74_1.startTrackSec = offset;
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


// === V74.5 UNIFIED STATIC GESTURE ENGINE (NO BLIND TOUCHMOVE & STRICT ZERO-SCROLL HOLD) ===

window._gestureStateV74_5 = {
    touching: false,
    wasBrakingScroll: false,
    everScrolled: false,
    maxDistPx: 0,
    startX: 0,
    startY: 0,
    startWinScrollY: 0,
    startListScrollTop: 0,
    startPlStripScrollLeft: 0,
    startSubStripScrollLeft: 0,
    lastAnyScrollTs: 0,
    blockClickUntilTs: 0
};

window.killAllHoldTimersV74_5 = function() {
    if (window.longPressTimer) {
        clearTimeout(window.longPressTimer);
        window.longPressTimer = null;
    }
    if (window._stripHoldTimerV74_5) {
        clearTimeout(window._stripHoldTimerV74_5);
        window._stripHoldTimerV74_5 = null;
    }
};

// Проверка: разрешено ли прямо сейчас открыть окно по зажатию (Инспектор или Модалку ленты)
window.canTriggerLongPressNowV74_5 = function() {
    const g = window._gestureStateV74_5;
    if (!g || !g.touching) return false;
    if (g.wasBrakingScroll || g.everScrolled) return false;
    if (g.maxDistPx > 4.0) return false;

    const uList = document.getElementById('unifiedList');
    const plStrip = document.getElementById('jennyPlaylistScrollStripV71');
    const subStrip = document.getElementById('jennySubFilterBarActiveV73');

    const dyWin = Math.abs((window.scrollY || 0) - g.startWinScrollY);
    const dyList = uList ? Math.abs(uList.scrollTop - g.startListScrollTop) : 0;
    const dxPl = plStrip ? Math.abs(plStrip.scrollLeft - g.startPlStripScrollLeft) : 0;
    const dxSub = subStrip ? Math.abs(subStrip.scrollLeft - g.startSubStripScrollLeft) : 0;

    if (dyWin >= 1 || dyList >= 1 || dxPl >= 1 || dxSub >= 1) {
        g.everScrolled = true;
        return false;
    }
    return true;
};

// Переопределяем attachStripLongPressV73: единый таймер _stripHoldTimerV74_5 + жёсткая проверка 0px скролла ленты
window.attachStripLongPressV73 = function(stripEl, onLongPress) {
    if (!stripEl) return;
    stripEl._onLongPressFnV74_5 = onLongPress;
    if (stripEl._longPressBoundV74_5) return;
    stripEl._longPressBoundV74_5 = true;

    stripEl.addEventListener('touchstart', (e) => {
        if (!e.touches || e.touches.length !== 1) return;
        const g = window._gestureStateV74_5;
        if (g.wasBrakingScroll) return;

        const startSL = stripEl.scrollLeft;
        window.killAllHoldTimersV74_5();

        window._stripHoldTimerV74_5 = setTimeout(() => {
            window._stripHoldTimerV74_5 = null;
            if (!window.canTriggerLongPressNowV74_5()) return;
            if (Math.abs(stripEl.scrollLeft - startSL) >= 1) return;

            g.blockClickUntilTs = performance.now() + 450;
            try { navigator.vibrate(35); } catch (err) {}
            if (typeof stripEl._onLongPressFnV74_5 === 'function') {
                stripEl._onLongPressFnV74_5(e);
            }
        }, 210);
    }, { passive: true });

    stripEl.addEventListener('touchmove', () => {
        if (!window.canTriggerLongPressNowV74_5()) {
            window.killAllHoldTimersV74_5();
        }
    }, { passive: true });

    stripEl.addEventListener('touchend', window.killAllHoldTimersV74_5, { passive: true });
    stripEl.addEventListener('touchcancel', window.killAllHoldTimersV74_5, { passive: true });
};

// Перепривязываем уже созданные ленты к новой проверке
(function upgradeExistingStripsV74_5() {
    const plStrip = document.getElementById('jennyPlaylistScrollStripV71');
    if (plStrip) {
        window.attachStripLongPressV73(plStrip, () => window.openAllPlaylistsLongPressModalV73());
    }
    const subStrip = document.getElementById('jennySubFilterBarActiveV73');
    if (subStrip) {
        window.attachStripLongPressV73(subStrip, () => window.openSubStripLongPressModalV73());
    }
})();

// Ставим жёсткий замок на вход в CORE MEDIA INSPECTOR и в модалки лент:
// если палец сдвинулся > 4px или список прокрутился хотя бы на 1px — окно по зажатию НЕ открывается!
(function guardLongPressModalsEntryV74_5() {
    const origInspector = window.openTrackInspector;
    if (typeof origInspector === 'function' && !window._inspectorGuardedV74_5) {
        window._inspectorGuardedV74_5 = true;
        window.openTrackInspector = function(filename, forceFromBtn) {
            if (!forceFromBtn && !window.canTriggerLongPressNowV74_5()) {
                window.killAllHoldTimersV74_5();
                return;
            }
            window._gestureStateV74_5.blockClickUntilTs = performance.now() + 450;
            return origInspector.apply(this, arguments);
        };
    }

    const origAllPl = window.openAllPlaylistsLongPressModalV73;
    if (typeof origAllPl === 'function' && !window._allPlGuardedV74_5) {
        window._allPlGuardedV74_5 = true;
        window.openAllPlaylistsLongPressModalV73 = function() {
            if (!window.canTriggerLongPressNowV74_5()) return;
            return origAllPl.apply(this, arguments);
        };
    }

    const origSubPl = window.openSubStripLongPressModalV73;
    if (typeof origSubPl === 'function' && !window._subPlGuardedV74_5) {
        window._subPlGuardedV74_5 = true;
        window.openSubStripLongPressModalV73 = function() {
            if (!window.canTriggerLongPressNowV74_5()) return;
            return origSubPl.apply(this, arguments);
        };
    }
})();

// Глобальный монитор касаний и скролла (Capture Phase) — БЕЗ блокировки touchmove!
(function installGlobalGestureMonitorV74_5() {
    if (window._globalGestureMonitorV74_5) return;
    window._globalGestureMonitorV74_5 = true;

    const SCROLL_COOLDOWN_MS = 200; // Остановка летящего скролла (мс)
    const TAP_JITTER_PX = 10;       // Допуск микро-сдвига пальца для короткого тапа (px)
    const HOLD_JITTER_PX = 4;       // Допуск для зажатия (стоит как вкопанный)

    const isGuardedZone = (el) => {
        if (!el || !el.closest) return false;
        return Boolean(
            el.closest('#unifiedList') ||
            el.closest('#jennyPlaylistScrollStripV71') ||
            el.closest('#jennySubFilterWrapV71')
        );
    };

    window.addEventListener('scroll', () => {
        const g = window._gestureStateV74_5;
        g.lastAnyScrollTs = performance.now();
        if (g.touching) {
            g.everScrolled = true;
            window.killAllHoldTimersV74_5();
        }
    }, { capture: true, passive: true });

    document.addEventListener('touchstart', (e) => {
        const g = window._gestureStateV74_5;
        if (!e.touches || e.touches.length !== 1) {
            g.touching = false;
            window.killAllHoldTimersV74_5();
            return;
        }

        const now = performance.now();
        const sinceScroll = now - g.lastAnyScrollTs;
        const uList = document.getElementById('unifiedList');
        const plStrip = document.getElementById('jennyPlaylistScrollStripV71');
        const subStrip = document.getElementById('jennySubFilterBarActiveV73');

        g.touching = true;
        g.startX = e.touches[0].clientX;
        g.startY = e.touches[0].clientY;
        g.maxDistPx = 0;
        g.everScrolled = false;
        g.startWinScrollY = window.scrollY || 0;
        g.startListScrollTop = uList ? uList.scrollTop : 0;
        g.startPlStripScrollLeft = plStrip ? plStrip.scrollLeft : 0;
        g.startSubStripScrollLeft = subStrip ? subStrip.scrollLeft : 0;

        if (sinceScroll < SCROLL_COOLDOWN_MS && isGuardedZone(e.target)) {
            g.wasBrakingScroll = true;
            window.killAllHoldTimersV74_5();
            e.stopImmediatePropagation();
            return;
        }
        g.wasBrakingScroll = false;
    }, { capture: true, passive: true });

    document.addEventListener('touchmove', (e) => {
        const g = window._gestureStateV74_5;
        if (!g.touching || !e.touches || e.touches.length === 0) return;

        const dx = e.touches[0].clientX - g.startX;
        const dy = e.touches[0].clientY - g.startY;
        const dist = Math.hypot(dx, dy);
        if (dist > g.maxDistPx) g.maxDistPx = dist;

        // Как только палец сдвинулся больше чем на 4px — навсегда отменяем зажатие для текущего касания!
        if (g.maxDistPx > HOLD_JITTER_PX || !window.canTriggerLongPressNowV74_5()) {
            window.killAllHoldTimersV74_5();
        }
    }, { capture: true, passive: true });

    document.addEventListener('touchend', (e) => {
        const g = window._gestureStateV74_5;
        window.killAllHoldTimersV74_5();

        if (!isGuardedZone(e.target)) {
            g.touching = false;
            return;
        }

        const shouldBlockTap = (
            g.wasBrakingScroll ||
            g.everScrolled ||
            g.maxDistPx > TAP_JITTER_PX ||
            (performance.now() - g.lastAnyScrollTs < 90)
        );

        g.touching = false;

        if (shouldBlockTap) {
            g.blockClickUntilTs = performance.now() + 380;
            e.stopImmediatePropagation();
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
        }
    }, { capture: true, passive: false });

    document.addEventListener('touchcancel', () => {
        const g = window._gestureStateV74_5;
        g.touching = false;
        window.killAllHoldTimersV74_5();
    }, { capture: true, passive: true });

    document.addEventListener('click', (e) => {
        if (!isGuardedZone(e.target)) return;
        const g = window._gestureStateV74_5;
        const now = performance.now();
        if (
            g.wasBrakingScroll ||
            g.everScrolled ||
            g.maxDistPx > TAP_JITTER_PX ||
            now < g.blockClickUntilTs ||
            (now - g.lastAnyScrollTs < SCROLL_COOLDOWN_MS)
        ) {
            e.stopImmediatePropagation();
            e.stopPropagation();
            e.preventDefault();
            return false;
        }
    }, { capture: true, passive: false });
})();


// === V74.6 STRICT TAG CHIP FILTERING (!IMPORTANT OVERRIDE & TAG-ONLY MATCH IN TAGS TAB) ===

window.filterTracks = function(query) {
    const sInp = document.getElementById('trackSearchInput');
    const rawQ = (query !== undefined && query !== null) ? String(query) : (sInp ? sInp.value : '');
    const lowerQuery = rawQ.trim().toLowerCase();
    const normQuery = window.normSearchV74 ? window.normSearchV74(rawQ) : lowerQuery;

    const clrBtn = document.getElementById('btnClearTrackSearchV73');
    if (clrBtn) clrBtn.style.display = rawQ.length > 0 ? 'inline-flex' : 'none';

    const tabId = window.activePlaylistTabV71 || 'all';
    const prop = tabId === 'artists' ? 'selectedArtistV71' : (tabId === 'albums' ? 'selectedAlbumV71' : (tabId === 'tags' ? 'selectedTagV74' : null));
    const hasFocusedSubChip = Boolean(prop && window[prop]);

    // 1. Фильтруем горизонтальную ленту капсул (По тегам / По артистам / По альбомам) через !important
    const subBar = document.getElementById('jennySubFilterBarActiveV73');
    if (subBar && (tabId === 'tags' || tabId === 'artists' || tabId === 'albums')) {
        subBar.querySelectorAll('.jenny-pl-chip-v71').forEach(chip => {
            if (hasFocusedSubChip || !lowerQuery) {
                chip.style.setProperty('display', 'inline-flex', 'important');
                return;
            }
            const subName = (chip.getAttribute('data-subname') || chip.textContent || '').toLowerCase();
            const matchChip = subName.includes(lowerQuery) || (normQuery && window.normSearchV74(subName).includes(normQuery));
            chip.style.setProperty('display', matchChip ? 'inline-flex' : 'none', 'important');
        });
    }

    // 2. Фильтруем список треков внизу
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

        const ctags = window.getTrackCustomTagsV74 ? window.getTrackCustomTagsV74(trackName) : {};
        const ctagsPairs = Object.entries(ctags).map(([k, v]) => `${k}: ${v} ${k} ${v}`).join(' ').toLowerCase();

        let isMatch = false;
        if (tabId === 'tags' && !hasFocusedSubChip) {
            // Во вкладке «По тегам» (без зажатой капсулы) ищем строго по имени или значению кастомного тега!
            isMatch = ctagsPairs.includes(lowerQuery) || (normQuery && window.normSearchV74(ctagsPairs).includes(normQuery));
        } else {
            const meta = window.getTrackMetaV71 ? window.getTrackMetaV71(trackName) : { artist: '', album: '' };
            const haystack = (trackName + ' ' + (meta.artist || '') + ' ' + (meta.album || '') + ' ' + ctagsPairs).toLowerCase();
            isMatch = haystack.includes(lowerQuery) || (normQuery && window.normSearchV74(haystack).includes(normQuery));
        }

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
        emptySearchMsg.innerText = (tabId === 'tags' && !hasFocusedSubChip)
            ? `Тег или значение «${rawQ.trim()}» не найдены`
            : `По запросу «${rawQ.trim()}» в текущем разделе ничего не найдено`;
        emptySearchMsg.style.display = 'block';
    } else if (emptySearchMsg) {
        emptySearchMsg.style.display = 'none';
    }
};


// === V74.7 PIN SUB-FILTER STRIP IN STICKY HEADER (NEVER SCROLLS AWAY) ===
window.ensureSubStripPinnedInHeaderV74_7 = function() {
    const stickyTop = document.querySelector('.sticky-top');
    if (!stickyTop) return null;
    const hdrContainer = stickyTop.querySelector('.container') || stickyTop;
    const plWrap = document.getElementById('jennyPlaylistBarWrapV71');
    let subWrap = document.getElementById('jennySubFilterWrapV71');
    if (!subWrap) {
        subWrap = document.createElement('div');
        subWrap.id = 'jennySubFilterWrapV71';
    }
    if (plWrap && plWrap.parentElement) {
        if (subWrap.previousElementSibling !== plWrap) {
            plWrap.insertAdjacentElement('afterend', subWrap);
        }
    } else if (subWrap.parentElement !== hdrContainer) {
        hdrContainer.appendChild(subWrap);
    }
    subWrap.style.cssText = 'width:100%;box-sizing:border-box;margin:4px 0 0 0;padding:0;z-index:30;flex-shrink:0;';
    return subWrap;
};

window.syncHeaderHeightWithModalsV71 = function() {
    const isOpen = ['settingsModal', 'eqModal', 'specModal', 'themeModal', 'favModal'].some(id => {
        const el = document.getElementById(id);
        return el && el.classList.contains('open');
    });
    const plWrap = document.getElementById('jennyPlaylistBarWrapV71');
    const subWrap = window.ensureSubStripPinnedInHeaderV74_7();
    const stickyTop = document.querySelector('.sticky-top');
    const midList = document.querySelector('.middle-list-container');
    const hasSub = Boolean(subWrap && subWrap.innerHTML && subWrap.innerHTML.trim().length > 0);

    if (plWrap) plWrap.style.setProperty('display', isOpen ? 'none' : 'flex', 'important');
    if (subWrap) subWrap.style.setProperty('display', (!isOpen && hasSub) ? 'block' : 'none', 'important');

    const targetH = isOpen ? '104px' : (hasSub ? '184px' : '142px');
    if (stickyTop) stickyTop.style.setProperty('height', targetH, 'important');
    if (midList) midList.style.setProperty('top', targetH, 'important');
    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.style.setProperty('top', isOpen ? '104px' : targetH, 'important');
    });
};

// Оборачиваем mountPlaylistStripDOMV71 и renderActivePlaylistTracksV71, чтобы 2-я строка всегда оставалась прикреплённой в .sticky-top
(function hookSubStripPinningV74_7() {
    const origMount = window.mountPlaylistStripDOMV71;
    if (typeof origMount === 'function') {
        window.mountPlaylistStripDOMV71 = function() {
            const res = origMount.apply(this, arguments);
            window.ensureSubStripPinnedInHeaderV74_7();
            return res;
        };
    }

    const origRender = window.renderActivePlaylistTracksV71;
    if (typeof origRender === 'function') {
        window.renderActivePlaylistTracksV71 = function() {
            window.ensureSubStripPinnedInHeaderV74_7();
            const res = origRender.apply(this, arguments);
            window.syncHeaderHeightWithModalsV71();
            return res;
        };
    }

    window.ensureSubStripPinnedInHeaderV74_7();
    window.syncHeaderHeightWithModalsV71();
})();


// === V75.2 INDESTRUCTIBLE CAPTURE-PHASE PLAY/PAUSE & LONG-PRESS LOCATOR ===

window.togglePlayV75_2 = function() {
    const player = document.getElementById('audioPlayer');
    if (!player) return;

    if (!player.src && !window.currentPlayingTrack) {
        const firstTrack = window.topTrack || (window.currentTrackList && window.currentTrackList[0]);
        if (firstTrack && typeof window.playTrack === 'function') {
            window.playTrack(firstTrack, 'main');
        }
        return;
    }

    if (typeof window.initAudioBoost === 'function') window.initAudioBoost();
    if (window.audioCtx && window.audioCtx.state === 'suspended') {
        try { window.audioCtx.resume(); } catch (e) {}
    }

    const isPlayingNow = (!player.paused) || Boolean(window.isStudioPlaying && window.studioSourceNode);
    const btn = document.getElementById('playPauseBtn');

    if (isPlayingNow) {
        window._userPausedV75_2 = true;
        if (window.studioSourceNode) {
            window.studioSourceNode.onended = null;
            try { window.studioSourceNode.stop(); } catch (e) {}
            try { window.studioSourceNode.disconnect(); } catch (e) {}
            window.studioSourceNode = null;
        }
        window.isStudioPlaying = false;
        if (window._studioClockV74_1) {
            window._studioClockV74_1.active = false;
        }
        try { player.pause(); } catch (e) {}

        if (btn) {
            btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        }
        if (typeof window.updateTrackListPlayIcons === 'function') {
            window.updateTrackListPlayIcons();
        }
    } else {
        window._userPausedV75_2 = false;
        if (btn) {
            btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
        }
        const resumeStudio = () => {
            if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            }
            if (typeof window.updateTrackListPlayIcons === 'function') {
                window.updateTrackListPlayIcons();
            }
        };
        const p = player.play();
        if (p && typeof p.then === 'function') {
            p.then(resumeStudio).catch(resumeStudio);
        } else {
            resumeStudio();
        }
    }
};

window.togglePlay = window.togglePlayV75_2;
window.togglePlayPause = window.togglePlayV75_2;

(function installPlayPauseDocumentCaptureV75_2() {
    if (window._ppDocCaptureInstalledV75_2) return;
    window._ppDocCaptureInstalledV75_2 = true;

    let holdTimer = null;
    let holdTriggered = false;
    let touchActive = false;
    let startX = 0;
    let startY = 0;
    let movedTooMuch = false;
    let lastTouchActionTs = 0;

    const getPlayPauseBtn = (target) => {
        if (!target || !target.closest) return null;
        return target.closest('#playPauseBtn');
    };

    document.addEventListener('touchstart', (e) => {
        const btn = getPlayPauseBtn(e.target);
        if (!btn) return;

        e.stopImmediatePropagation();
        touchActive = true;
        holdTriggered = false;
        movedTooMuch = false;

        if (e.touches && e.touches[0]) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }

        clearTimeout(holdTimer);
        holdTimer = setTimeout(() => {
            holdTimer = null;
            if (touchActive && !movedTooMuch) {
                holdTriggered = true;
                lastTouchActionTs = performance.now();
                if (typeof window.locateCurrentPlayingTrackV74_1 === 'function') {
                    window.locateCurrentPlayingTrackV74_1();
                }
            }
        }, 360);
    }, { capture: true, passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!touchActive) return;
        if (e.touches && e.touches[0]) {
            const dist = Math.hypot(e.touches[0].clientX - startX, e.touches[0].clientY - startY);
            if (dist > 12) {
                movedTooMuch = true;
                clearTimeout(holdTimer);
                holdTimer = null;
            }
        }
    }, { capture: true, passive: true });

    document.addEventListener('touchend', (e) => {
        const btn = getPlayPauseBtn(e.target);
        if (!btn && !touchActive) return;

        clearTimeout(holdTimer);
        holdTimer = null;

        if (btn) {
            e.stopImmediatePropagation();
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
        }

        const shouldToggle = touchActive && !holdTriggered && !movedTooMuch;
        touchActive = false;
        holdTriggered = false;

        if (shouldToggle) {
            lastTouchActionTs = performance.now();
            window.togglePlayV75_2();
        }
    }, { capture: true, passive: false });

    document.addEventListener('touchcancel', () => {
        clearTimeout(holdTimer);
        holdTimer = null;
        touchActive = false;
        holdTriggered = false;
    }, { capture: true, passive: true });

    document.addEventListener('click', (e) => {
        const btn = getPlayPauseBtn(e.target);
        if (!btn) return;

        e.stopImmediatePropagation();
        e.stopPropagation();
        e.preventDefault();

        if (performance.now() - lastTouchActionTs > 400) {
            window.togglePlayV75_2();
        }
    }, { capture: true, passive: false });
})();


// === JENNY V76.2 DIRECT ANALOG DNA 1.0X MODE (V83 INDEPENDENT CLOCK) ===
window.dnaDirect1xActiveV76 = false;
window.dnaCleanGainNodeV76 = null;
window._dnaPlayStartCtxTimeV82 = 0;
window._dnaPlayStartOrigSecV82 = 0;
window._dnaClockTimerV83 = null;
window._dnaBoundTrackV83 = null;

window.ensureDnaCleanGainV76 = function() {
    if (!window.audioCtx) return null;
    if (!window.dnaCleanGainNodeV76 || window.dnaCleanGainNodeV76.context !== window.audioCtx) {
        window.dnaCleanGainNodeV76 = window.audioCtx.createGain();
        window.dnaCleanGainNodeV76.connect(window.masterAntiClickGain || window.audioCtx.destination);
    }
    const volBar = document.getElementById('volumeBar');
    const volVal = volBar ? (parseInt(volBar.value, 10) || 10) : 10;
    window.dnaCleanGainNodeV76.gain.value = (volVal / 10.0) * 0.85;
    return window.dnaCleanGainNodeV76;
};

window.stopDnaClockTimerV83 = function() {
    if (window._dnaClockTimerV83) {
        clearInterval(window._dnaClockTimerV83);
        window._dnaClockTimerV83 = null;
    }
};

window.resetDnaModeOnTrackChangeV83 = function() {
    window.stopDnaClockTimerV83();
    window.dnaDirect1xActiveV76 = false;
    window._dnaPlayStartCtxTimeV82 = 0;
    window._dnaPlayStartOrigSecV82 = 0;
    const player = document.getElementById('audioPlayer');
    if (player) {
        player.loop = false;
        try { player.playbackRate = 1.0; } catch (e) {}
    }
    const lockEl = document.getElementById('speedLockIndicator');
    if (lockEl && lockEl.innerText && lockEl.innerText.indexOf('ДНК') !== -1) {
        lockEl.style.display = 'none';
        lockEl.style.color = '#e3b341';
    }
    if (typeof window.updateDna1xButtonUIV76 === 'function') window.updateDna1xButtonUIV76();
};

window.getExactDnaOrigSecV82 = function() {
    const cleanBuf = window.reconstructedMasterBufferV67;
    if (!cleanBuf || !window.audioCtx) return 0;
    const player = document.getElementById('audioPlayer');
    if (window.dnaDirect1xActiveV76) {
        if (player && !player.paused && window._dnaPlayStartCtxTimeV82 > 0) {
            const elapsed = Math.max(0, window.audioCtx.currentTime - window._dnaPlayStartCtxTimeV82);
            return Math.min(cleanBuf.duration, window._dnaPlayStartOrigSecV82 + elapsed);
        }
        return Math.min(cleanBuf.duration, window._dnaPlayStartOrigSecV82 || 0);
    }
    const expBuf = window.studioBuffer || cleanBuf;
    const expDur = (player && isFinite(player.duration) && player.duration > 0) ? player.duration : expBuf.duration;
    const cur = player ? (player.currentTime || 0) : 0;
    return expDur > 0 ? Math.min(cleanBuf.duration - 0.01, (cur / expDur) * cleanBuf.duration) : 0;
};

window.startDnaClockTimerV83 = function() {
    window.stopDnaClockTimerV83();
    window._dnaClockTimerV83 = setInterval(() => {
        if (!window.dnaDirect1xActiveV76 || !window.reconstructedMasterBufferV67) {
            window.stopDnaClockTimerV83();
            return;
        }
        if (window._dnaBoundTrackV83 && window.currentPlayingTrack !== window._dnaBoundTrackV83) {
            window.resetDnaModeOnTrackChangeV83();
            return;
        }
        const player = document.getElementById('audioPlayer');
        const cleanBuf = window.reconstructedMasterBufferV67;
        if (!player || player.paused) return;

        // Удерживаем беззвучный <audio> в начале файла со скоростью 1.0, чтобы он никогда не завершался раньше cleanBuf
        if (player.playbackRate !== 1.0) {
            try { player.playbackRate = 1.0; } catch (e) {}
        }
        // V85: держим беззвучный <audio> на паузе или в loop без ручного currentTime, чтобы не триггерить seeked!

        const curOrig = window.getExactDnaOrigSecV82();
        if (curOrig >= cleanBuf.duration - 0.05) {
            window.resetDnaModeOnTrackChangeV83();
            if (typeof window.playNextTrack === 'function') window.playNextTrack();
            return;
        }
        const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
        if (typeof window.updateProgressUI === 'function') window.updateProgressUI(curOrig, cleanBuf.duration, isRev);
        if (typeof window.updateCenterCurrentTime === 'function') window.updateCenterCurrentTime(curOrig, cleanBuf.duration, isRev);
    }, 50);
};

window.updateDna1xButtonUIV76 = function() {
    const qGroup = document.getElementById('quickModalsGroup');
    if (!qGroup) return;
    let btn = document.getElementById('btnDnaDirect1xV76');
    const hasRev = Boolean(
        window.reconstructedMasterBufferV67 &&
        window.currentTrackRevMapV67 &&
        window.currentTrackRevNameV67 === window.currentPlayingTrack
    );
    if (!hasRev) {
        if (btn) btn.style.display = 'none';
        return;
    }
    if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btnDnaDirect1xV76';
        btn.className = 'jenny-icon-pill';
        btn.style.cssText = 'width:auto;padding:0 10px;border-radius:18px;font-size:11px;font-weight:900;gap:4px;';
        btn.onclick = (e) => window.toggleDnaDirect1xModeV76(e);
        qGroup.insertBefore(btn, qGroup.firstChild);
    }
    btn.style.display = 'inline-flex';
    const expSpd = parseFloat(window.currentTrackRevMapV67.spd) || 1.0;
    if (window.dnaDirect1xActiveV76) {
        btn.innerHTML = '🧬 ОРИГ 1.0x: ВКЛ';
        btn.style.borderColor = '#3fb950';
        btn.style.color = '#3fb950';
        btn.style.boxShadow = '0 0 12px rgba(63,185,80,0.45)';
    } else {
        btn.innerHTML = `🧬 Вкл 1.0x (из x${expSpd.toFixed(2)})`;
        btn.style.borderColor = '#58a6ff';
        btn.style.color = '#58a6ff';
        btn.style.boxShadow = '';
    }
};

window.startDnaBufferNodeFromSecV82 = function(origSec) {
    const player = document.getElementById('audioPlayer');
    const cleanBuf = (window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed))
        ? (window.reconstructedReversedBufferV67 || window.reconstructedMasterBufferV67)
        : window.reconstructedMasterBufferV67;
    if (!player || !window.audioCtx || !cleanBuf) return;

    if (typeof window.disengageHorizonRamEngineV71_5 === 'function') {
        window.disengageHorizonRamEngineV71_5();
    }
    if (window.studioSourceNode) {
        window.studioSourceNode.onended = null;
        try { window.studioSourceNode.stop(); } catch (e) {}
        try { window.studioSourceNode.disconnect(); } catch (e) {}
        window.studioSourceNode = null;
    }
    if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;

    const safeOrigSec = Math.max(0, Math.min(cleanBuf.duration - 0.02, origSec));
    window._dnaPlayStartOrigSecV82 = safeOrigSec;
    window._dnaPlayStartCtxTimeV82 = window.audioCtx.currentTime;
    window._dnaBoundTrackV83 = window.currentPlayingTrack;

    player.loop = true;
    try { player.playbackRate = 1.0; } catch (e) {}

    if (!player.paused) {
        const outGain = window.ensureDnaCleanGainV76() || window.inputMixer;
        window.studioSourceNode = window.audioCtx.createBufferSource();
        window.studioSourceNode._isHoseSpliced = true;
        window.studioSourceNode._isDna1xNodeV82 = true;
        window.studioSourceNode.buffer = cleanBuf;
        window.studioSourceNode.playbackRate.value = 1.0;
        window.studioSourceNode.connect(outGain);
        window.studioSourceNode.start(0, safeOrigSec);
        window.isStudioPlaying = true;
        window.startDnaClockTimerV83();
    }
};

window.toggleDnaDirect1xModeV76 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const hasRev = Boolean(
        window.reconstructedMasterBufferV67 &&
        window.currentTrackRevMapV67 &&
        window.currentTrackRevNameV67 === window.currentPlayingTrack
    );
    if (!hasRev) {
        if (typeof window.showToast === 'function') window.showToast('⚠️ В этом треке нет капсулы JENNYV67!', ev);
        return;
    }
    const player = document.getElementById('audioPlayer');
    const cleanBuf = window.reconstructedMasterBufferV67;
    const expBuf = window.studioBuffer || cleanBuf;
    const expDur = (player && isFinite(player.duration) && player.duration > 0) ? player.duration : expBuf.duration;
    const lenRatio = (expDur > 0 && cleanBuf.duration > 0) ? (expDur / cleanBuf.duration) : 1.0;

    if (!window.dnaDirect1xActiveV76) {
        const curFileSec = player ? (player.currentTime || 0) : 0;
        const targetOrigSec = (expDur > 2.5 && lenRatio > 0) ? (curFileSec / lenRatio) : 0;

        window.dnaDirect1xActiveV76 = true;
        if (window.scrubState) {
            window.scrubState.active = false;
            window.scrubState.locked = false;
            window.scrubState.speed = 1.0;
        }
        window.persistedPlaybackSpeed = null;
        window.startDnaBufferNodeFromSecV82(targetOrigSec);

        const lockEl = document.getElementById('speedLockIndicator');
        if (lockEl) {
            lockEl.style.display = 'block';
            lockEl.style.color = '#3fb950';
            lockEl.innerText = '🧬 ДНК 1.00x (Чистый оригинал)';
        }
    } else {
        const exactOrigSec = window.getExactDnaOrigSecV82();
        const exactFileSec = Math.max(0, Math.min(expDur - 0.02, exactOrigSec * lenRatio));

        window.resetDnaModeOnTrackChangeV83();
        if (window.studioSourceNode) {
            window.studioSourceNode.onended = null;
            try { window.studioSourceNode.stop(); } catch (e) {}
            try { window.studioSourceNode.disconnect(); } catch (e) {}
            window.studioSourceNode = null;
        }
        if (player) {
            try { player.currentTime = exactFileSec; } catch (e) {}
        }
        if (typeof window.setExactPlaybackPositionV75 === 'function') {
            window.setExactPlaybackPositionV75(exactFileSec);
        }
        if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
            window.syncMasterPlaybackEngineV59(false);
        }
    }
    window.updateDna1xButtonUIV76();
};


(function installDnaDirectEngineHookV83() {
    const origPlayTrack = window.playTrack;
    if (typeof origPlayTrack === 'function' && !window._dnaPlayTrackWrappedV83) {
        window._dnaPlayTrackWrappedV83 = true;
        window.playTrack = async function(filename, context) {
            if (window.dnaDirect1xActiveV76 && filename !== window.currentPlayingTrack) {
                window.resetDnaModeOnTrackChangeV83();
            }
            const player = document.getElementById('audioPlayer');
            if (player) {
                player.loop = false;
                try { player.playbackRate = 1.0; } catch (e) {}
            }
            return await origPlayTrack.apply(this, arguments);
        };
    }

    const prevSync = window.syncMasterPlaybackEngineV59;
    window.syncMasterPlaybackEngineV59 = function(isDraggingArc) {
        window.updateDna1xButtonUIV76();
        if (window.dnaDirect1xActiveV76 && window._dnaBoundTrackV83 && window.currentPlayingTrack !== window._dnaBoundTrackV83) {
            window.resetDnaModeOnTrackChangeV83();
        }
        const hasRev = Boolean(
            window.reconstructedMasterBufferV67 &&
            window.currentTrackRevMapV67 &&
            window.currentTrackRevNameV67 === window.currentPlayingTrack
        );
        const userArcSpd = (window.scrubState && (window.scrubState.active || window.scrubState.locked))
            ? parseFloat(window.scrubState.speed || 1.0)
            : 1.0;
        if (window.dnaDirect1xActiveV76 && (isDraggingArc || Math.abs(userArcSpd - 1.0) > 0.01)) {
            window.resetDnaModeOnTrackChangeV83();
        }
        if (hasRev && window.dnaDirect1xActiveV76) {
            const player = document.getElementById('audioPlayer');
            if (!player || !window.audioCtx) return;
            if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
            player.loop = true;
            try { player.playbackRate = 1.0; } catch (e) {}

            if (player.paused) {
                window._dnaPlayStartOrigSecV82 = window.getExactDnaOrigSecV82();
                window._dnaPlayStartCtxTimeV82 = 0;
                if (window.studioSourceNode) {
                    window.studioSourceNode.onended = null;
                    try { window.studioSourceNode.stop(); } catch (e) {}
                    try { window.studioSourceNode.disconnect(); } catch (e) {}
                    window.studioSourceNode = null;
                }
                window.isStudioPlaying = false;
            } else if (!window.studioSourceNode || !window.studioSourceNode._isDna1xNodeV82 || !window.isStudioPlaying) {
                window.startDnaBufferNodeFromSecV82(window._dnaPlayStartOrigSecV82 || 0);
            }
            return;
        }
        return prevSync.apply(this, arguments);
    };

    // Экранируем события seeking/seeked/ended от 1.58-секундного <audio>, чтобы он не перезапускал 🧬 ДНК 1.0x на "На... На..."
    const shieldPlayerEventsV85 = () => {
        const p = document.getElementById('audioPlayer');
        if (!p || p._dnaShieldV85) return;
        p._dnaShieldV85 = true;
        ['seeking', 'seeked', 'ended'].forEach(evType => {
            p.addEventListener(evType, (e) => {
                if (window.dnaDirect1xActiveV76 && window.reconstructedMasterBufferV67) {
                    e.stopImmediatePropagation();
                }
            }, true);
        });
    };
    shieldPlayerEventsV85();
    setTimeout(shieldPlayerEventsV85, 500);

    // Перемотка ползунком seekBar вручную в режиме ДНК 1.0x
    setTimeout(() => {
        const sb = document.getElementById('seekBar');
        if (sb && !window._dnaSeekBarHookedV83) {
            window._dnaSeekBarHookedV83 = true;
            sb.addEventListener('input', () => {
                if (window.dnaDirect1xActiveV76 && window.reconstructedMasterBufferV67) {
                    const maxVal = parseFloat(sb.max) || 1000;
                    const ratio = Math.max(0, Math.min(0.999, (parseFloat(sb.value) || 0) / maxVal));
                    window.startDnaBufferNodeFromSecV82(ratio * window.reconstructedMasterBufferV67.duration);
                }
            });
        }
    }, 600);

    const origCenterTime = window.updateCenterCurrentTime;
    if (typeof origCenterTime === 'function') {
        window.updateCenterCurrentTime = function(cur, dur, isRev) {
            if (window.dnaDirect1xActiveV76 && window.reconstructedMasterBufferV67) {
                return origCenterTime(window.getExactDnaOrigSecV82(), window.reconstructedMasterBufferV67.duration, isRev);
            }
            return origCenterTime(cur, dur, isRev);
        };
    }

    const origUpdateProg = window.updateProgressUI;
    if (typeof origUpdateProg === 'function') {
        window.updateProgressUI = function(cur, dur, isRev) {
            if (window.dnaDirect1xActiveV76 && window.reconstructedMasterBufferV67) {
                return origUpdateProg(window.getExactDnaOrigSecV82(), window.reconstructedMasterBufferV67.duration, isRev);
            }
            return origUpdateProg(cur, dur, isRev);
        };
    }
})();


// =========================================================================
// 🎮 JENNY V90: GAME OST (ФОН !IMPORTANT, АВТО-ПАУЗА, SEEK-ПОЛОСКА, -30% VOL)
// =========================================================================
window._khStateV88 = window._khStateV88 || {
    formatMode: (window.appConfig && window.appConfig.khFormatModeV88) || 'xflac_psycho',
    lastQuery: 'Doom', lastAlbums: [], currentAlbum: null,
    selectedTracks: new Set(), isDownloading: false, abortDownload: false,
    previewAudio: null, previewBtn: null, pollTimer: null
};

window.getKhPreviewVolumeV90 = function() {
    const vb = document.getElementById('volumeBar');
    const raw = vb ? parseFloat(vb.value) : ((window.appConfig && window.appConfig.defaultVolume) || 10);
    const mainVol = Math.max(0, Math.min(1, (isNaN(raw) ? 10 : raw) / 10.0));
    return Math.max(0.02, Math.min(1.0, mainVol * 0.70));
};

window.pauseMainPlayerForOstV90 = function() {
    const p = document.getElementById('audioPlayer');
    const isPlaying = (p && !p.paused) || Boolean(window.isStudioPlaying && window.studioSourceNode);
    if (isPlaying) {
        if (typeof window.togglePlayV75_2 === 'function') {
            window.togglePlayV75_2();
        } else if (p) {
            try { p.pause(); } catch (e) {}
        }
    }
};

window.stopKhPreviewV88 = function() {
    if (window._khStateV88.previewAudio) {
        try {
            window._khStateV88.previewAudio.pause();
            window._khStateV88.previewAudio.src = '';
        } catch (e) {}
        window._khStateV88.previewAudio = null;
    }
    document.querySelectorAll('.kh-prev-btn-v88').forEach(b => { b.innerText = '▶'; });
    const mpBtn = document.getElementById('khMiniPlayBtnV90');
    if (mpBtn) mpBtn.innerText = '▶';
};

(function bindMainVolumeAndPlayToOstV90() {
    const vb = document.getElementById('volumeBar');
    if (vb && !vb._khVolBoundV90) {
        vb._khVolBoundV90 = true;
        vb.addEventListener('input', () => {
            if (window._khStateV88.previewAudio) {
                window._khStateV88.previewAudio.volume = window.getKhPreviewVolumeV90();
            }
        });
    }
    const p = document.getElementById('audioPlayer');
    if (p && !p._khMainPlayHookV90) {
        p._khMainPlayHookV90 = true;
        p.addEventListener('play', () => {
            if (window._khStateV88.previewAudio && !window._khStateV88.previewAudio.paused) {
                window.stopKhPreviewV88();
            }
        });
    }
})();

window.updateKhHeaderBtnBadgeV89 = function(text, isBusy) {
    const hdrBtn = document.getElementById('btnKhinsiderOstV88');
    if (!hdrBtn) return;
    hdrBtn.innerHTML = isBusy
        ? `<span>⏳</span><span style="color:#58a6ff;">${text}</span>`
        : `<span>🎮</span><span>OST</span>`;
};

window.minimizeKhinsiderModalV88 = function() {
    const m = document.getElementById('jennyKhinsiderModalV88');
    if (m) m.style.setProperty('display', 'none', 'important');
};

window.stopKhProgressPollV89 = function() {
    if (window._khStateV88.pollTimer) {
        clearInterval(window._khStateV88.pollTimer);
        window._khStateV88.pollTimer = null;
    }
    window.updateKhHeaderBtnBadgeV89('OST', false);
};

window.startKhProgressPollV89 = function(prefixLabel) {
    window.stopKhProgressPollV89();
    const stEl = document.getElementById('khDownloadStatusV88');
    const barWrap = document.getElementById('khProgressBarWrapV89');
    const barFill = document.getElementById('khProgressBarFillV89');
    if (stEl) stEl.style.display = 'block';
    if (barWrap) barWrap.style.display = 'block';

    window._khStateV88.pollTimer = setInterval(async () => {
        try {
            const r = await fetch('/api/khinsider/progress');
            if (!r.ok) return;
            const p = await r.json();
            if (!p) return;
            const pct = Math.max(2, Math.min(100, parseInt(p.percent || 0, 10)));
            if (p.active) {
                window.updateKhHeaderBtnBadgeV89(p.stage === 'converting' ? 'xFLAC' : (pct + '%'), true);
            }
            if (barFill) {
                barFill.style.width = pct + '%';
                barFill.style.background = (p.stage === 'converting')
                    ? 'linear-gradient(90deg, #a371f7, #3fb950)'
                    : 'linear-gradient(90deg, #1f6feb, #3fb950)';
            }
            if (stEl && p.message) {
                stEl.innerText = (prefixLabel ? prefixLabel + ' ' : '') + p.message;
            }
            if (p.track_num && p.active) {
                const b = document.getElementById('khTrackBadgeV89_' + p.track_num);
                if (b) {
                    b.style.display = 'inline-block';
                    b.style.color = '#58a6ff';
                    b.style.borderColor = '#58a6ff';
                    b.innerText = (p.stage === 'converting')
                        ? '🧬 Сжатие xFLAC...'
                        : `⬇️ ${p.downloaded_mb || 0}/${p.total_mb || '?'} MB (${pct}%)`;
                }
            }
        } catch (e) {}
    }, 300);
};

window.selectKhFormatV88 = function(fmt) {
    window._khStateV88.formatMode = fmt;
    window.appConfig = window.appConfig || {};
    window.appConfig.khFormatModeV88 = fmt;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    document.querySelectorAll('#khFmtGroupV88 button').forEach(b => {
        const act = (b.getAttribute('data-khfmt') === fmt);
        b.style.borderColor = act ? '#3fb950' : '#30363d';
        b.style.background = act ? 'rgba(63,185,80,0.24)' : '#161b22';
        b.style.color = act ? '#ffffff' : '#8b949e';
    });
};

window.fmtKhSecV90 = function(s) {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' + sec : sec);
};

window.toggleKhMiniPlayPauseV90 = function() {
    const aud = window._khStateV88.previewAudio;
    const mpBtn = document.getElementById('khMiniPlayBtnV90');
    if (!aud || !aud.src) return;
    if (aud.paused) {
        window.pauseMainPlayerForOstV90();
        aud.volume = window.getKhPreviewVolumeV90();
        aud.play().catch(() => {});
        if (mpBtn) mpBtn.innerText = '⏸';
        if (window._khStateV88.previewBtn) window._khStateV88.previewBtn.innerText = '⏹';
    } else {
        aud.pause();
        if (mpBtn) mpBtn.innerText = '▶';
        if (window._khStateV88.previewBtn) window._khStateV88.previewBtn.innerText = '▶';
    }
};

window.seekKhPreviewV90 = function(val) {
    const aud = window._khStateV88.previewAudio;
    if (!aud || !isFinite(aud.duration) || aud.duration <= 0) return;
    aud.currentTime = (parseFloat(val) / 1000.0) * aud.duration;
};

window.openKhinsiderModalV88 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const existing = document.getElementById('jennyKhinsiderModalV88');
    if (existing) {
        const isHidden = (existing.style.display === 'none' || getComputedStyle(existing).display === 'none');
        if (isHidden) {
            window.closeAllV71Modals();
            existing.style.setProperty('display', 'flex', 'important');
        } else {
            window.minimizeKhinsiderModalV88();
        }
        return;
    }
    window.closeAllV71Modals();
    const m = document.createElement('div');
    m.id = 'jennyKhinsiderModalV88';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) window.minimizeKhinsiderModalV88(); };

    const quickGames = ['Gothic', 'Fallout', 'Silent Hill', 'Doom', 'Need for Speed', 'Witcher', 'Heroes III', 'GTA'];
    const chips = quickGames.map(g => `<button type="button" onclick="document.getElementById('khSearchInpV88').value='${g}';window.runKhSearchV88();" style="padding:3px 8px;font-size:10.5px;border-radius:12px;background:#11161d;border:1px solid #30363d;color:#79c0ff;white-space:nowrap;">🎮 ${g}</button>`).join('');

    m.innerHTML = `<div class="jenny-modal-card-v71" onclick="event.stopPropagation()" style="max-width:460px;max-height:88vh;display:flex;flex-direction:column;">
        <div class="jenny-modal-hdr-v71" style="background:linear-gradient(90deg,rgba(63,185,80,0.22),rgba(115,65,190,0.25));">
            <span style="color:#3fb950;font-weight:900;font-size:13px;">🎮 GAME OST ➔ XFLAC</span>
            <button type="button" onclick="window.minimizeKhinsiderModalV88()" style="padding:4px 10px;font-size:11px;border-radius:7px;background:rgba(88,166,255,0.18);border:1px solid #58a6ff;color:#58a6ff;font-weight:bold;">➖ В фон</button>
        </div>
        <div style="padding:9px 12px;border-bottom:1px solid #21262d;background:#090d14;display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;gap:6px;">
                <input type="text" id="khSearchInpV88" value="${window._khStateV88.lastQuery || ''}" placeholder="Игра (Gothic, Fallout, Silent Hill...)" onkeydown="if(event.key==='Enter') window.runKhSearchV88()" style="flex:1;padding:7px 10px;font-size:12.5px;background:#06080b !important;color:#e6edf3 !important;border:1px solid #30363d !important;border-radius:8px;text-align:left !important;">
                <button type="button" onclick="window.runKhSearchV88()" style="padding:7px 14px;background:#238636;color:#fff;border:none;border-radius:8px;font-weight:bold;">🔍 Найти</button>
            </div>
            <div style="display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;">${chips}</div>
            <div id="khFmtGroupV88" style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;">
                <button type="button" data-khfmt="xflac_ultra" onclick="window.selectKhFormatV88('xflac_ultra')" style="padding:5px 2px;font-size:9.5px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;font-weight:bold;">🔥 XF 15 (~9%)</button>
                <button type="button" data-khfmt="xflac_psycho" onclick="window.selectKhFormatV88('xflac_psycho')" style="padding:5px 2px;font-size:9.5px;border-radius:6px;border:1px solid #3fb950;background:rgba(63,185,80,0.24);color:#fff;font-weight:bold;">🧬 XF 25 (~12%)</button>
                <button type="button" data-khfmt="xflac_lossless" onclick="window.selectKhFormatV88('xflac_lossless')" style="padding:5px 2px;font-size:9.5px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;font-weight:bold;">💎 XF 1:1</button>
                <button type="button" data-khfmt="flac" onclick="window.selectKhFormatV88('flac')" style="padding:5px 2px;font-size:9.5px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;font-weight:bold;">💿 FLAC</button>
                <button type="button" data-khfmt="mp3" onclick="window.selectKhFormatV88('mp3')" style="padding:5px 2px;font-size:9.5px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;font-weight:bold;">🎵 MP3</button>
            </div>
            <div id="khMiniPlayerBarV90" style="display:none;flex-direction:column;gap:3px;padding:6px 8px;background:#0d1117;border:1px solid rgba(88,166,255,0.4);border-radius:8px;margin-top:2px;">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#79c0ff;">
                    <span id="khMiniTitleV90" style="font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:75%;">🎧 Предпрослушка</span>
                    <span style="color:#8b949e;">🔉 -30% от осн.</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <button type="button" id="khMiniPlayBtnV90" onclick="window.toggleKhMiniPlayPauseV90()" style="padding:2px 7px;font-size:10px;background:#161b22;color:#3fb950;border:1px solid #3fb950;border-radius:5px;">⏸</button>
                    <span id="khMiniCurV90" style="font-size:10px;color:#58a6ff;min-width:28px;">0:00</span>
                    <input type="range" id="khMiniSeekV90" min="0" max="1000" value="0" oninput="window.seekKhPreviewV90(this.value)" style="flex:1;height:4px;accent-color:#3fb950;cursor:pointer;">
                    <span id="khMiniDurV90" style="font-size:10px;color:#e3b341;min-width:28px;text-align:right;">0:00</span>
                </div>
            </div>
        </div>
        <div id="khBodyContentV88" style="flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px;min-height:240px;"></div>
        <div id="khFooterBarV88" style="display:none;padding:10px 12px;border-top:1px solid #21262d;background:#090c10;flex-direction:column;gap:6px;">
            <div id="khDownloadStatusV88" style="font-size:11px;color:#58a6ff;font-weight:bold;display:none;"></div>
            <div id="khProgressBarWrapV89" style="display:none;width:100%;height:7px;background:#161b22;border-radius:6px;overflow:hidden;border:1px solid #30363d;">
                <div id="khProgressBarFillV89" style="width:0%;height:100%;background:linear-gradient(90deg,#1f6feb,#3fb950);transition:width 0.25s ease;"></div>
            </div>
            <div style="display:flex;gap:8px;">
                <button type="button" onclick="window.renderKhAlbumsListV88()" style="padding:8px 12px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;border-radius:8px;">⬅ Альбомы</button>
                <button type="button" id="btnKhDownloadSelV88" onclick="window.downloadSelectedKhTracksV88()" style="flex:1;padding:8px 12px;background:linear-gradient(135deg,#238636,#1f6feb);color:#fff;border:none;border-radius:8px;font-weight:bold;">⬇️ Скачать выбранные в плеер</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(m);
    window.selectKhFormatV88(window._khStateV88.formatMode);
    if (window._khStateV88.currentAlbum) window.renderKhAlbumTracksV88(window._khStateV88.currentAlbum);
    else if (window._khStateV88.lastAlbums && window._khStateV88.lastAlbums.length) window.renderKhAlbumsListV88();
};

window.previewKhTrackV88 = async function(trackIdx, btnEl, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const alb = window._khStateV88.currentAlbum;
    const t = alb && alb.tracks ? alb.tracks.find(x => x.index === trackIdx) : null;
    if (!t) return;
    if (window._khStateV88.previewAudio && window._khStateV88.previewAudio._pagePath === t.page_path) {
        window.toggleKhMiniPlayPauseV90();
        return;
    }
    window.stopKhPreviewV88();
    window.pauseMainPlayerForOstV90();
    if (btnEl) btnEl.innerText = '⏳';
    window._khStateV88.previewBtn = btnEl;
    try {
        const res = await fetch('/api/khinsider/resolve_stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_path: t.page_path }) });
        const data = await res.json();
        if (!res.ok || !data.stream_url) throw new Error(data.error || 'Нет потока');
        const aud = new Audio(data.stream_url);
        aud._pagePath = t.page_path;
        aud.volume = window.getKhPreviewVolumeV90();
        window._khStateV88.previewAudio = aud;

        const bar = document.getElementById('khMiniPlayerBarV90');
        const tEl = document.getElementById('khMiniTitleV90');
        const curEl = document.getElementById('khMiniCurV90');
        const durEl = document.getElementById('khMiniDurV90');
        const seekEl = document.getElementById('khMiniSeekV90');
        const mpBtn = document.getElementById('khMiniPlayBtnV90');
        if (bar) bar.style.display = 'flex';
        if (tEl) tEl.innerText = `🎧 ${t.index}. ${t.title}`;
        if (mpBtn) mpBtn.innerText = '⏸';

        aud.ontimeupdate = () => {
            if (curEl) curEl.innerText = window.fmtKhSecV90(aud.currentTime);
            if (durEl && isFinite(aud.duration)) durEl.innerText = window.fmtKhSecV90(aud.duration);
            if (seekEl && isFinite(aud.duration) && aud.duration > 0) {
                seekEl.value = Math.round((aud.currentTime / aud.duration) * 1000);
            }
        };
        aud.onended = () => {
            if (btnEl) btnEl.innerText = '▶';
            if (mpBtn) mpBtn.innerText = '▶';
        };
        await aud.play();
        if (btnEl) btnEl.innerText = '⏹';
    } catch (e) {
        if (btnEl) btnEl.innerText = '▶';
        if (typeof window.showToast === 'function') window.showToast('❌ ' + (e.message || e));
    }
};

window.runKhSearchV88 = async function() {
    const inp = document.getElementById('khSearchInpV88');
    const body = document.getElementById('khBodyContentV88');
    const ftr = document.getElementById('khFooterBarV88');
    if (!inp || !body) return;
    const q = inp.value.trim();
    if (!q) return;
    window._khStateV88.lastQuery = q;
    if (ftr) ftr.style.display = 'none';
    body.innerHTML = `<div style="color:#58a6ff;text-align:center;padding:35px 10px;">⏳ Поиск «${q}»...</div>`;
    try {
        const res = await fetch('/api/khinsider/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
        const data = await res.json();
        if (!res.ok || data.status !== 'ok') throw new Error(data.error || 'Ошибка поиска');
        window._khStateV88.lastAlbums = data.albums || [];
        window._khStateV88.currentAlbum = null;
        window.renderKhAlbumsListV88();
    } catch (e) {
        body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:25px 10px;">❌ ${e.message || e}</div>`;
    }
};

window.renderKhAlbumsListV88 = function() {
    const body = document.getElementById('khBodyContentV88');
    const ftr = document.getElementById('khFooterBarV88');
    if (!body) return;
    window._khStateV88.currentAlbum = null;
    if (ftr) ftr.style.display = 'none';
    const albums = window._khStateV88.lastAlbums || [];
    if (!albums.length) {
        body.innerHTML = `<div style="color:#8b949e;text-align:center;padding:30px 10px;">Ничего не найдено.</div>`;
        return;
    }
    body.innerHTML = albums.map(a => {
        const safeSlug = String(a.slug || '').replace(/'/g, "\'");
        const meta = [a.platforms, a.type, a.year].filter(Boolean).join(' • ');
        return `<div onclick="window.openKhAlbumSlugV88('${safeSlug}')" style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:#0d1117;border:1px solid #262c36;border-radius:10px;cursor:pointer;">
            <img src="${a.thumb}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;border:1px solid #30363d;">
            <div style="flex:1;min-width:0;"><div style="color:#e6edf3;font-weight:bold;font-size:12px;">${a.title}</div><div style="color:#8b949e;font-size:10px;">${meta}</div></div>
            <span style="color:#3fb950;font-size:11px;font-weight:bold;">Открыть ➔</span>
        </div>`;
    }).join('');
};

window.openKhAlbumSlugV88 = async function(slug) {
    const body = document.getElementById('khBodyContentV88');
    if (!body) return;
    body.innerHTML = `<div style="color:#58a6ff;text-align:center;padding:35px 10px;">⏳ Загрузка треклиста...</div>`;
    try {
        const res = await fetch('/api/khinsider/album', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) });
        const data = await res.json();
        if (!res.ok || data.status !== 'ok') throw new Error(data.error || 'Ошибка альбома');
        window._khStateV88.currentAlbum = data;
        window._khStateV88.selectedTracks = new Set((data.tracks || []).filter(t => !t.downloaded).map(t => t.index));
        window.renderKhAlbumTracksV88(data);
    } catch (e) {
        body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:25px 10px;">❌ ${e.message || e}</div>`;
    }
};

window.toggleKhTrackCheckV88 = function(idx, checked) {
    if (checked) window._khStateV88.selectedTracks.add(idx);
    else window._khStateV88.selectedTracks.delete(idx);
    window.updateKhDownloadBtnLabelV88();
};

window.toggleAllKhTracksV88 = function(selectAll) {
    const alb = window._khStateV88.currentAlbum;
    if (!alb || !alb.tracks) return;
    window._khStateV88.selectedTracks = selectAll ? new Set(alb.tracks.map(t => t.index)) : new Set();
    document.querySelectorAll('.kh-trk-chk-v88').forEach(c => { c.checked = selectAll; });
    window.updateKhDownloadBtnLabelV88();
};

window.updateKhDownloadBtnLabelV88 = function() {
    const btn = document.getElementById('btnKhDownloadSelV88');
    if (!btn || window._khStateV88.isDownloading) return;
    btn.innerText = `⬇️ Скачать выбранные (${window._khStateV88.selectedTracks.size}) в плеер`;
};

window.renderKhAlbumTracksV88 = function(alb) {
    const body = document.getElementById('khBodyContentV88');
    const ftr = document.getElementById('khFooterBarV88');
    if (!body || !alb) return;
    if (ftr) ftr.style.display = 'flex';
    const tracks = alb.tracks || [];
    const dlCnt = tracks.filter(t => t.downloaded).length;
    const flacB = alb.has_flac
        ? `<span style="background:rgba(63,185,80,0.2);color:#3fb950;border:1px solid #3fb950;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:bold;">💎 FLAC ДОСТУПЕН</span>`
        : `<span style="background:rgba(227,179,65,0.18);color:#e3b341;border:1px solid #e3b341;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:bold;">🎵 MP3</span>`;
    const dlB = dlCnt > 0 ? `<span style="background:rgba(88,166,255,0.18);color:#58a6ff;border:1px solid #58a6ff;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:bold;">✅ В плеере: ${dlCnt}/${tracks.length}</span>` : '';

    const hdr = `<div style="display:flex;flex-direction:column;gap:6px;padding:8px 10px;background:#0d1117;border:1px solid #30363d;border-radius:10px;">
        <div style="color:#58a6ff;font-weight:900;font-size:13px;">💿 ${alb.album_title}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
            <div style="display:flex;gap:5px;">${flacB}${dlB}</div>
            <div style="display:flex;gap:6px;">
                <button type="button" onclick="window.toggleAllKhTracksV88(true)" style="padding:3px 8px;font-size:10px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;">☑ Все (${tracks.length})</button>
                <button type="button" onclick="window.toggleAllKhTracksV88(false)" style="padding:3px 8px;font-size:10px;background:#161b22;color:#8b949e;border:1px solid #30363d;">☐ Снять</button>
            </div>
        </div>
    </div>`;

    const rows = tracks.map(t => {
        const isChk = window._khStateV88.selectedTracks.has(t.index);
        const isMp3Mode = (window._khStateV88 && window._khStateV88.formatMode === 'mp3'); const sz = isMp3Mode ? (t.mp3_size ? `🎵 MP3: ${t.mp3_size}` : '') : (t.flac_size ? `💎 FLAC: ${t.flac_size}` : (t.mp3_size ? `🎵 MP3: ${t.mp3_size}` : ''));
        const isDl = Boolean(t.downloaded);
        const bHtml = isDl
            ? `<span id="khTrackBadgeV89_${t.index}" style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:5px;font-size:9.5px;font-weight:bold;background:rgba(63,185,80,0.18);color:#3fb950;border:1px solid #3fb950;">✅ СКАЧАН (${t.local_ext || 'OK'} • ${t.local_size_mb || ''} MB)</span>`
            : `<span id="khTrackBadgeV89_${t.index}" style="display:none;margin-left:6px;padding:1px 6px;border-radius:5px;font-size:9.5px;font-weight:bold;background:rgba(88,166,255,0.16);color:#58a6ff;border:1px solid #58a6ff;"></span>`;
        return `<div id="khTrackRowV89_${t.index}" style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:#0b0f16;border:1px solid ${isDl ? 'rgba(63,185,80,0.55)' : '#21262d'};border-radius:8px;">
            <input type="checkbox" class="kh-trk-chk-v88" ${isChk ? 'checked' : ''} onchange="window.toggleKhTrackCheckV88(${t.index}, this.checked)">
            <div style="flex:1;min-width:0;" onclick="this.previousElementSibling.click()">
                <div style="color:#e6edf3;font-size:12px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.index}. ${t.title}</div>
                <div style="color:#8b949e;font-size:10px;margin-top:2px;display:flex;align-items:center;flex-wrap:wrap;"><span>⏱ ${t.duration || '—'} ${sz ? ' • ' + sz : ''}</span>${bHtml}</div>
            </div>
            <button type="button" class="kh-prev-btn-v88" onclick="window.previewKhTrackV88(${t.index}, this, event)" style="padding:4px 8px;font-size:11px;background:#161b22;color:#58a6ff;border:1px solid #30363d;">▶</button>
            <button type="button" id="khTrackDlBtnV89_${t.index}" onclick="window.downloadSingleKhTrackV88(${t.index}, this, event)" style="padding:4px 8px;font-size:11px;background:rgba(63,185,80,0.18);color:#3fb950;border:1px solid #3fb950;">${isDl ? '🔄' : '⬇️'}</button>
        </div>`;
    }).join('');

    body.innerHTML = hdr + rows;
    window.updateKhDownloadBtnLabelV88();
};

window.markKhTrackAsDownloadedUIV89 = function(t, data) {
    t.downloaded = true; t.local_file = data.filename || ''; t.local_size_mb = data.size_mb || 0; t.local_ext = data.ext || 'XFLAC';
    window._khStateV88.selectedTracks.delete(t.index);
    const row = document.getElementById('khTrackRowV89_' + t.index);
    if (row) { row.style.borderColor = 'rgba(63,185,80,0.65)'; const c = row.querySelector('.kh-trk-chk-v88'); if (c) c.checked = false; }
    const b = document.getElementById('khTrackBadgeV89_' + t.index);
    if (b) { b.style.display = 'inline-block'; b.style.color = '#3fb950'; b.style.borderColor = '#3fb950'; b.innerText = `✅ СКАЧАН (${t.local_ext} • ${t.local_size_mb} MB)`; }
    const btn = document.getElementById('khTrackDlBtnV89_' + t.index);
    if (btn) btn.innerText = '✅';
    window.updateKhDownloadBtnLabelV88();
};

window.downloadSingleKhTrackV88 = async function(trackIdx, btnEl, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const alb = window._khStateV88.currentAlbum;
    const t = alb && alb.tracks ? alb.tracks.find(x => x.index === trackIdx) : null;
    if (!t) return;
    if (t.downloaded && !confirm(`Трек «${t.title}» уже скачан (${t.local_file}). Перекачать заново?`)) return;
    const oldTxt = btnEl ? btnEl.innerText : '⬇️';
    if (btnEl) btnEl.innerText = '⏳';
    window.startKhProgressPollV89(`[${t.index}. ${t.title}]`);
    try {
        const res = await fetch('/api/khinsider/download_track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_path: t.page_path, album_title: alb.album_title, track_title: t.title, track_num: t.index, format_mode: window._khStateV88.formatMode }) });
        const data = await res.json();
        window.stopKhProgressPollV89();
        if (!res.ok || data.status !== 'ok') throw new Error(data.error || 'Ошибка скачивания');
        window.markKhTrackAsDownloadedUIV89(t, data);
        const stEl = document.getElementById('khDownloadStatusV88');
        const barFill = document.getElementById('khProgressBarFillV89');
        if (barFill) barFill.style.width = '100%';
        if (stEl) stEl.innerText = `✅ Сохранено: ${data.filename} (${data.size_mb} MB)`;
        if (typeof window.fetchData === 'function') window.fetchData();
        if (typeof window.showToast === 'function') window.showToast(`✅ Скачано: ${data.filename} (${data.size_mb} MB)`);
    } catch (e) {
        window.stopKhProgressPollV89();
        if (btnEl) btnEl.innerText = oldTxt;
        if (typeof window.showToast === 'function') window.showToast('❌ ' + (e.message || e));
    }
};

window.downloadSelectedKhTracksV88 = async function() {
    const alb = window._khStateV88.currentAlbum;
    if (!alb || !alb.tracks) return;
    if (window._khStateV88.isDownloading) { window._khStateV88.abortDownload = true; return; }
    const selList = alb.tracks.filter(t => window._khStateV88.selectedTracks.has(t.index));
    if (!selList.length) { if (typeof window.showToast === 'function') window.showToast('⚠️ Все выбранные треки уже скачаны!'); return; }
    window._khStateV88.isDownloading = true; window._khStateV88.abortDownload = false;
    const btn = document.getElementById('btnKhDownloadSelV88');
    const stEl = document.getElementById('khDownloadStatusV88');
    if (btn) btn.innerText = '⏹ Остановить очередь';
    let doneCnt = 0;
    for (let i = 0; i < selList.length; i++) {
        if (window._khStateV88.abortDownload) break;
        const t = selList[i];
        window.startKhProgressPollV89(`[${i + 1}/${selList.length}]`);
        try {
            const res = await fetch('/api/khinsider/download_track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_path: t.page_path, album_title: alb.album_title, track_title: t.title, track_num: t.index, format_mode: window._khStateV88.formatMode }) });
            const data = await res.json();
            if (res.ok && data.status === 'ok') {
                doneCnt++;
                window.markKhTrackAsDownloadedUIV89(t, data);
                if (typeof window.fetchData === 'function') window.fetchData();
            }
        } catch (e) {}
    }
    window.stopKhProgressPollV89();
    window._khStateV88.isDownloading = false;
    if (stEl) stEl.innerText = `✅ Готово! Загружено: ${doneCnt} из ${selList.length}.`;
    window.updateKhDownloadBtnLabelV88();
    if (typeof window.showToast === 'function') window.showToast(`🎉 Загружено в плеер: ${doneCnt} треков!`);
};

// === JENNY V91: SOURCES DROPDOWN HUB (CUSTOM NEON SVG ICONS + HIGH/LOW SVG + SOUNDCLOUD) ===
window.JENNY_NEON_SVGS_V92 = {
    hub: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#58a6ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px rgba(88,166,255,0.65));"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 16l3.5 4 3.5-4"/></svg>',
    ost: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#3fb950" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 5px rgba(63,185,80,0.65));"><path d="M6 11h4M8 9v4"/><circle cx="15.5" cy="10" r="1" fill="#3fb950"/><circle cx="17.5" cy="12" r="1" fill="#3fb950"/><path d="M17.3 5H6.7a4 4 0 0 0-3.9 3.1l-1.2 6A3.5 3.5 0 0 0 5 18.3c1.2 0 2.3-.6 3-1.6l1.1-1.7h5.8l1.1 1.7c.7 1 1.8 1.6 3 1.6a3.5 3.5 0 0 0 3.4-4.2l-1.2-6A4 4 0 0 0 17.3 5z"/></svg>',
    radio: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#58a6ff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 5px rgba(88,166,255,0.65));"><path d="M4 10a7.5 7.5 0 0 0 10.6 10.6L4 10z"/><path d="M9.3 15.3l4.2-4.2"/><circle cx="14.5" cy="10.1" r="1.2" fill="#58a6ff"/><path d="M16 4c2.2.6 3.4 1.8 4 4"/><path d="M13.5 6.5c1.2.4 1.8 1 2.2 2.2"/><path d="M5 21l3-4 3 4H5z"/></svg>',
    torrent: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#d2a8ff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 5px rgba(210,168,255,0.65));"><polygon points="12 2 19 5 22 12 19 19 12 22 5 19 2 12 5 5"/><polygon points="12 6.5 16 8.2 17.5 12 16 15.8 12 17.5 8 15.8 6.5 12 8 8.2"/><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>',
    archive: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#79c0ff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 5px rgba(121,192,255,0.65));"><polygon points="12 2 2 7 22 7"/><line x1="6" y1="7" x2="6" y2="17"/><line x1="10" y1="7" x2="10" y2="17"/><line x1="14" y1="7" x2="14" y2="17"/><line x1="18" y1="7" x2="18" y2="17"/><rect x="3" y="17" width="18" height="4" rx="1"/></svg>',
    soundcloud: '<svg viewBox="0 0 24 24" width="18" height="17" fill="none" stroke="#ff8c42" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 5px rgba(255,140,66,0.65));"><line x1="2" y1="13" x2="2" y2="17"/><line x1="5" y1="10" x2="5" y2="18"/><line x1="8" y1="11" x2="8" y2="18"/><path d="M11 18h7.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6-1.5A3.5 3.5 0 0 0 11 18z"/></svg>',
    badgeHigh: '<svg viewBox="0 0 36 16" width="34" height="15" style="vertical-align:middle;filter:drop-shadow(0 0 4px rgba(63,185,80,0.45));"><rect x="1" y="1" width="34" height="14" rx="4" fill="rgba(63,185,80,0.14)" stroke="#3fb950" stroke-width="1.3"/><text x="18" y="11" fill="#3fb950" font-size="9.5" font-weight="900" font-family="monospace" text-anchor="middle">HIGH</text></svg>',
    badgeLow: '<svg viewBox="0 0 32 16" width="30" height="15" style="vertical-align:middle;filter:drop-shadow(0 0 4px rgba(227,179,65,0.4));"><rect x="1" y="1" width="30" height="14" rx="4" fill="rgba(227,179,65,0.14)" stroke="#e3b341" stroke-width="1.3"/><text x="16" y="11" fill="#e3b341" font-size="9.5" font-weight="900" font-family="monospace" text-anchor="middle">LOW</text></svg>'
};

window.SOURCES_CATALOG_V91 = [
    { id: 'ost',        svg: window.JENNY_NEON_SVGS_V92.ost,        title: 'Game OST Студия (Lossless ➔ xFLAC)' },
    { id: 'radio',      svg: window.JENNY_NEON_SVGS_V92.radio,      title: 'Радиоэфир (HIGH / LOW ➔ xFLAC)' },
    { id: 'soundcloud', svg: window.JENNY_NEON_SVGS_V92.soundcloud, title: 'SoundCloud Студия (Поток ➔ xFLAC)' },
    { id: 'torrent',    svg: window.JENNY_NEON_SVGS_V92.torrent,    title: 'Торрент-Студия (P2P / Magnet)' },
    { id: 'archive',    svg: window.JENNY_NEON_SVGS_V92.archive,    title: 'Lossless Архивы и Концерты' }
];

window.getPinnedSourcesV91 = function() {
    window.appConfig = window.appConfig || {};
    if (!Array.isArray(window.appConfig.pinnedSourcesV91)) {
        window.appConfig.pinnedSourcesV91 = ['ost', 'radio', 'soundcloud'];
    }
    return window.appConfig.pinnedSourcesV91.slice(0, 3);
};

window.togglePinSourceV91 = function(srcId, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    let pinned = [...window.getPinnedSourcesV91()];
    if (pinned.includes(srcId)) pinned = pinned.filter(x => x !== srcId);
    else {
        if (pinned.length >= 3) {
            if (typeof window.showToast === 'function') window.showToast('⚠️ Максимум 3 значка в шапке');
            return;
        }
        pinned.push(srcId);
    }
    window.appConfig.pinnedSourcesV91 = pinned;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.renderHeaderSourcesHubV91();
    window.renderSourcesSettingsSectionV91();
};

window.triggerSourceActionV91 = function(srcId, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const menu = document.getElementById('jennySourcesDropMenuV91');
    if (menu) menu.style.display = 'none';
    if (srcId === 'ost') {
        window._scModeActiveV92 = false;
        window.openKhinsiderModalV88(ev, 'ost');
    } else if (srcId === 'archive') {
        window._scModeActiveV92 = false;
        window.openKhinsiderModalV88(ev, 'archive');
    } else if (srcId === 'soundcloud') {
        window.openSoundCloudModalV92(ev);
    } else if (srcId === 'radio') {
        window.openFlacRadioModalV91(ev);
    } else if (srcId === 'torrent') {
        window.openTorrentHubPreviewModalV91(ev);
    }
};

window.toggleSourcesDropdownMenuV91 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    let menu = document.getElementById('jennySourcesDropMenuV91');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'jennySourcesDropMenuV91';
        menu.style.cssText = 'position:fixed;top:54px;right:12px;width:305px;background:#090d14;border:1.5px solid #58a6ff;border-radius:12px;padding:8px;z-index:2147483645;box-shadow:0 12px 32px rgba(0,0,0,0.95);display:none;flex-direction:column;gap:6px;';
        document.body.appendChild(menu);
        document.addEventListener('click', (e) => {
            if (menu.style.display !== 'none' && !menu.contains(e.target) && !e.target.closest('#btnSourcesHubDropV91')) {
                menu.style.display = 'none';
            }
        });
    }
    if (menu.style.display === 'flex') { menu.style.display = 'none'; return; }
    const pinned = window.getPinnedSourcesV91();
    menu.innerHTML = `<div style="font-size:10.5px;color:#8b949e;padding:2px 4px;display:flex;justify-content:space-between;">
        <span>ВЫБЕРИ ИСТОЧНИК:</span><span>В шапке (${pinned.length}/3)</span>
    </div>` + window.SOURCES_CATALOG_V91.map(s => {
        const isPin = pinned.includes(s.id);
        return `<div style="display:flex;align-items:center;gap:8px;background:#0f141d;border:1px solid ${isPin ? '#3fb950' : '#262c36'};border-radius:9px;padding:7px 9px;">
            <div onclick="window.triggerSourceActionV91('${s.id}', event)" style="display:flex;align-items:center;gap:8px;flex:1;color:#e6edf3;font-size:12px;font-weight:bold;cursor:pointer;">
                <span style="display:inline-flex;width:20px;justify-content:center;">${s.svg}</span>
                <span>${s.title}</span>
            </div>
            <button type="button" onclick="window.togglePinSourceV91('${s.id}', event);window.toggleSourcesDropdownMenuV91();window.toggleSourcesDropdownMenuV91();" style="padding:3px 7px;font-size:10.5px;border-radius:6px;background:${isPin ? 'rgba(63,185,80,0.22)' : '#161b22'};border:1px solid ${isPin ? '#3fb950' : '#30363d'};color:${isPin ? '#3fb950' : '#8b949e'};">${isPin ? 'ВКЛ' : '+'}</button>
        </div>`;
    }).join('');
    menu.style.display = 'flex';
};

window.renderHeaderSourcesHubV91 = function() {
    const oldBtn = document.getElementById('btnKhinsiderOstV88');
    const settingsBtn = document.getElementById('btn-settingsModal');
    const parent = (settingsBtn && settingsBtn.parentElement) || (oldBtn && oldBtn.parentElement);
    if (!parent) return;
    parent.style.gap = '4px';

    let hub = document.getElementById('jennySourcesHubBarV91');
    if (!hub) {
        hub = document.createElement('div');
        hub.id = 'jennySourcesHubBarV91';
        hub.style.cssText = 'display:flex;align-items:center;gap:4px;';
        if (oldBtn) oldBtn.replaceWith(hub);
        else parent.insertBefore(hub, settingsBtn);
    }

    const pinned = window.getPinnedSourcesV91();
    const btnsHtml = pinned.map(id => {
        const s = window.SOURCES_CATALOG_V91.find(x => x.id === id);
        if (!s) return '';
        const btnIdAttr = (id === 'ost') ? 'id="btnKhinsiderOstV88"' : `id="btnPinnedSrc_${id}_V91"`;
        return `<button type="button" ${btnIdAttr} class="jenny-icon-pill" onclick="window.triggerSourceActionV91('${s.id}', event)" title="${s.title}" style="width:32px;height:30px;padding:0;border-radius:9px;">${s.svg}</button>`;
    }).join('');

    hub.innerHTML = btnsHtml + `<button type="button" id="btnSourcesHubDropV91" class="jenny-icon-pill" onclick="window.toggleSourcesDropdownMenuV91(event)" title="Все источники" style="width:32px;height:30px;padding:0;border-radius:9px;">${window.JENNY_NEON_SVGS_V92.hub}</button>`;
};

window.updateKhHeaderBtnBadgeV89 = function(text, isBusy) {
    const hdrBtn = document.getElementById('btnKhinsiderOstV88');
    if (!hdrBtn) return;
    if (isBusy) {
        hdrBtn.style.width = 'auto';
        hdrBtn.style.padding = '0 6px';
        hdrBtn.innerHTML = `<span style="font-size:10px;color:#3fb950;font-weight:900;">${text}</span>`;
    } else {
        hdrBtn.style.width = '32px';
        hdrBtn.style.padding = '0';
        hdrBtn.innerHTML = window.JENNY_NEON_SVGS_V92.ost;
    }
};

window.renderSourcesSettingsSectionV91 = function() {
    const sm = document.getElementById('settingsModal');
    if (!sm) return;
    const container = sm.querySelector('.container') || sm;
    let box = document.getElementById('jennySourcesSettingsBoxV91');
    if (!box) {
        box = document.createElement('details');
        box.id = 'jennySourcesSettingsBoxV91';
        box.className = 'setting-group';
        box.open = true;
        container.appendChild(box);
    }
    const pinned = window.getPinnedSourcesV91();
    box.innerHTML = `<summary>Значки источников в шапке (до 3 шт.)</summary><div class="group-content">` +
        window.SOURCES_CATALOG_V91.map(s => `<label style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;color:#e6edf3;font-size:12.5px;cursor:pointer;"><span style="display:flex;align-items:center;gap:8px;">${s.svg}<span>${s.title}</span></span><input type="checkbox" ${pinned.includes(s.id) ? 'checked' : ''} onchange="window.togglePinSourceV91('${s.id}', event)"></label>`).join('') +
        `</div>`;
};

window._radioStateV91 = {
    stations: [], currentStation: null, audio: null,
    isRecording: false, recTimer: null, formatMode: 'xflac_psycho',
    qualityFilter: 'all', selectedGenre: null
};

window.minimizeFlacRadioModalV91 = function() {
    const m = document.getElementById('jennyFlacRadioModalV91');
    if (m) m.style.setProperty('display', 'none', 'important');
};

window.stopFlacRadioStreamV91 = function() {
    if (window._radioStateV91.audio) {
        try { window._radioStateV91.audio.pause(); window._radioStateV91.audio.src = ''; } catch (e) {}
        window._radioStateV91.audio = null;
    }
    document.querySelectorAll('.rad-play-btn-v91').forEach(b => { b.innerText = '▶'; });
};

window.setRadioQualityFilterV92 = function(qMode) {
    window._radioStateV91.qualityFilter = qMode;
    window.renderRadioFiltersAndStationsV92();
};

window.toggleRadioGenreFilterV92 = function(gName) {
    window._radioStateV91.selectedGenre = (window._radioStateV91.selectedGenre === gName) ? null : gName;
    window.renderRadioFiltersAndStationsV92();
};

window.renderRadioFiltersAndStationsV92 = function() {
    const st = window._radioStateV91;
    const all = st.stations || [];
    const qInp = document.getElementById('radSearchInpV91');
    const txtQ = (qInp ? qInp.value.trim().toLowerCase() : '');

    // 1-й ГЛАВНЫЙ ФИЛЬТР (Верхняя строка): «ВСЕ (N)» первой кнопкой + все жанры во всех форматах
    const genreCounts = {};
    all.forEach(s => {
        const g = s.genre || 'Pop / Misc';
        genreCounts[g] = (genreCounts[g] || 0) + 1;
    });
    const genres = Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a]);
    if (st.selectedGenre && !genreCounts[st.selectedGenre]) st.selectedGenre = null;

    const gBar = document.getElementById('radGenreStripV92');
    if (gBar) {
        const allChip = `<div class="jenny-pl-chip-v71 ${!st.selectedGenre ? 'active-pl-chip' : ''}" onclick="window._radioStateV91.selectedGenre=null;window.renderRadioFiltersAndStationsV92();"><span>ВСЕ</span><span class="jenny-pl-chip-count-v71">${all.length}</span></div>`;
        const gChips = genres.map(g => {
            const isSel = (st.selectedGenre === g);
            return `<div class="jenny-pl-chip-v71 ${isSel ? 'active-pl-chip' : ''}" onclick="window.toggleRadioGenreFilterV92('${g}')"><span>${g}</span><span class="jenny-pl-chip-count-v71">${genreCounts[g]}</span></div>`;
        }).join('');
        gBar.innerHTML = allChip + gChips;
    }

    // Фильтруем по выбранной категории 1-й строки
    const byCategory = st.selectedGenre
        ? all.filter(s => (s.genre || 'Pop / Misc') === st.selectedGenre)
        : all;

    // 2-й ФИЛЬТР (Нижняя подстрока): только качество HIGH (Lossless) и LOW (Обычное) внутри выбранной категории!
    const qBar = document.getElementById('radQualitySubStripV92');
    if (qBar) {
        const llCnt = byCategory.filter(x => x.lossless).length;
        const lsCnt = byCategory.filter(x => !x.lossless).length;
        const svgs = window.JENNY_NEON_SVGS_V92;
        const qItems = [
            { id: 'lossless', html: `${svgs.badgeHigh} <span style="color:#3fb950;">Lossless (${llCnt})</span>` },
            { id: 'lossy',    html: `${svgs.badgeLow} <span style="color:#e3b341;">Обычное (${lsCnt})</span>` }
        ];
        qBar.innerHTML = qItems.map(qi => {
            const act = (st.qualityFilter === qi.id);
            return `<div class="jenny-pl-chip-v71 ${act ? 'active-pl-chip' : ''}" onclick="window.setRadioQualityFilterV92(window._radioStateV91.qualityFilter==='${qi.id}'?'all':'${qi.id}')" style="padding:3px 10px;font-size:11px;display:inline-flex;align-items:center;gap:5px;">${qi.html}</div>`;
        }).join('');
    }

    const filtered = byCategory.filter(s => {
        if (st.qualityFilter === 'lossless' && !s.lossless) return false;
        if (st.qualityFilter === 'lossy' && s.lossless) return false;
        if (txtQ && !(s.title.toLowerCase().includes(txtQ) || (s.genre || '').toLowerCase().includes(txtQ))) return false;
        return true;
    });

    const body = document.getElementById('radStationsListV91');
    if (!body) return;
    if (!filtered.length) {
        body.innerHTML = '<div style="color:#8b949e;text-align:center;padding:25px;">В выбранном фильтре станций нет</div>';
        return;
    }

    const svgs = window.JENNY_NEON_SVGS_V92;
    body.innerHTML = filtered.map(s => {
        const origIdx = all.indexOf(s);
        const isPlayingThis = Boolean(st.audio && st.currentStation && st.currentStation.url === s.url && !st.audio.paused);
        const badgeSvg = s.lossless ? svgs.badgeHigh : svgs.badgeLow;
        const clr = s.lossless ? '#3fb950' : '#e3b341';
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0d1117;border:1px solid ${isPlayingThis ? '#3fb950' : '#262c36'};border-radius:9px;">
            <div style="flex:1;min-width:0;" onclick="window.playFlacRadioStationV91(${origIdx}, this.nextElementSibling)">
                <div style="color:#e6edf3;font-size:12px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px;">${badgeSvg}<span>${s.title}</span></div>
                <div style="font-size:10px;margin-top:3px;color:#8b949e;"><span style="color:${clr};font-weight:bold;">${s.codec}</span> • ${s.genre}</div>
            </div>
            <button type="button" class="rad-play-btn-v91" onclick="window.playFlacRadioStationV91(${origIdx}, this)" style="padding:5px 10px;font-size:11px;background:#161b22;color:#58a6ff;border:1px solid #30363d;">${isPlayingThis ? '⏹' : '▶'}</button>
        </div>`;
    }).join('');
};

window.playFlacRadioStationV91 = async function(idx, btnEl) {
    const st = window._radioStateV91.stations[idx];
    if (!st) return;
    if (window._radioStateV91.audio && window._radioStateV91.currentStation && window._radioStateV91.currentStation.url === st.url && !window._radioStateV91.audio.paused) {
        window.stopFlacRadioStreamV91();
        window.renderRadioFiltersAndStationsV92();
        return;
    }
    window.stopFlacRadioStreamV91();
    if (typeof window.stopKhPreviewV88 === 'function') window.stopKhPreviewV88();
    if (typeof window.pauseMainPlayerForOstV90 === 'function') window.pauseMainPlayerForOstV90();

    window._radioStateV91.currentStation = st;
    if (btnEl) btnEl.innerText = '⏳';
    const aud = new Audio(st.url);
    aud.volume = (typeof window.getKhPreviewVolumeV90 === 'function') ? window.getKhPreviewVolumeV90() : 0.7;
    window._radioStateV91.audio = aud;
    const infoEl = document.getElementById('radNowPlayingTitleV91');
    const recBtn = document.getElementById('btnRadioRecV91');
    if (recBtn && !window._radioStateV91.isRecording) {
        recBtn.innerText = st.lossless ? '⏺ Записать эфир в .xFLAC (Lossless)' : '⏺ Сохранить прямой эфир в .MP3 (без пережатия)';
    }
    try {
        await aud.play();
        if (infoEl) infoEl.innerHTML = `${st.lossless ? window.JENNY_NEON_SVGS_V92.badgeHigh : window.JENNY_NEON_SVGS_V92.badgeLow} В эфире: ${st.title}`;
        window.renderRadioFiltersAndStationsV92();
    } catch (e) {
        if (btnEl) btnEl.innerText = '▶';
        if (infoEl) infoEl.innerText = `❌ Поток недоступен: ${st.title}`;
    }
};

window.toggleRadioRecordToXflacV91 = async function() {
    const st = window._radioStateV91.currentStation || window._radioStateV91.stations[0];
    const btn = document.getElementById('btnRadioRecV91');
    const statusEl = document.getElementById('radNowPlayingTitleV91');
    if (!window._radioStateV91.isRecording) {
        if (!st) return;
        const r = await (await fetch('/api/radio/record_start', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: st.url, title: st.title, lossless: Boolean(st.lossless), format_mode: window._radioStateV91.formatMode })
        })).json();
        if (r.status === 'ok') {
            window._radioStateV91.isRecording = true;
            const targetFmt = st.lossless ? 'xFLAC' : 'прямой MP3';
            if (btn) { btn.innerText = `⏹ Стоп (${targetFmt} • 0с • 0 МБ)`; btn.style.background = '#da3633'; }
            window._radioStateV91.recTimer = setInterval(async () => {
                try {
                    const stData = await (await fetch('/api/radio/record_status')).json();
                    if (stData.active && btn) btn.innerText = `⏹ Стоп (${targetFmt} • ${stData.sec}с • ${stData.wav_mb} МБ)`;
                } catch (e) {}
            }, 600);
        }
    } else {
        clearInterval(window._radioStateV91.recTimer);
        window._radioStateV91.isRecording = false;
        if (btn) { btn.innerText = '⏳ Сохраняем запись...'; btn.style.background = '#7341be'; }
        const r = await (await fetch('/api/radio/record_stop', { method: 'POST' })).json();
        if (btn) {
            btn.innerText = (st && !st.lossless) ? '⏺ Сохранить прямой эфир в .MP3 (без пережатия)' : '⏺ Записать эфир в .xFLAC (Lossless)';
            btn.style.background = '#238636';
        }
        if (r.status === 'ok') {
            if (statusEl) statusEl.innerText = `✅ Сохранено: ${r.filename} (${r.size_mb} MB)`;
            if (typeof window.fetchData === 'function') window.fetchData();
            if (typeof window.showToast === 'function') window.showToast(`✅ Записано: ${r.filename} (${r.size_mb} MB)`);
        } else if (statusEl) statusEl.innerText = `❌ ${r.error || 'Ошибка записи'}`;
    }
};

window.loadFlacRadioStationsV91 = async function() {
    const inp = document.getElementById('radSearchInpV91');
    const body = document.getElementById('radStationsListV91');
    if (!body) return;
    body.innerHTML = '<div style="color:#58a6ff;text-align:center;padding:25px;">⏳ Загрузка радиостанций...</div>';
    try {
        const d = await (await fetch('/api/radio/stations', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: inp ? inp.value.trim() : '' })
        })).json();
        window._radioStateV91.stations = d.stations || [];
        if (!window._radioStateV91.currentStation && window._radioStateV91.stations.length) {
            window._radioStateV91.currentStation = window._radioStateV91.stations[0];
        }
        window.renderRadioFiltersAndStationsV92();
    } catch (e) {
        body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:20px;">❌ ${e.message || e}</div>`;
    }
};

window.openFlacRadioModalV91 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const ex = document.getElementById('jennyFlacRadioModalV91');
    if (ex) {
        const isHid = (ex.style.display === 'none' || getComputedStyle(ex).display === 'none');
        ex.style.setProperty('display', isHid ? 'flex' : 'none', 'important');
        return;
    }
    const m = document.createElement('div');
    m.id = 'jennyFlacRadioModalV91';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) window.minimizeFlacRadioModalV91(); };
    m.innerHTML = `<div class="jenny-modal-card-v71" onclick="event.stopPropagation()" style="max-width:450px;max-height:88vh;display:flex;flex-direction:column;">
        <div class="jenny-modal-hdr-v71" style="background:linear-gradient(90deg,rgba(88,166,255,0.22),rgba(63,185,80,0.22));">
            <span style="color:#58a6ff;font-weight:900;font-size:13px;display:flex;align-items:center;gap:6px;">${window.JENNY_NEON_SVGS_V92.radio}<span>РАДИОЭФИР (HIGH ➔ XFLAC / LOW ➔ MP3)</span></span>
            <button type="button" onclick="window.minimizeFlacRadioModalV91()" style="padding:4px 10px;font-size:11px;border-radius:7px;background:rgba(88,166,255,0.18);border:1px solid #58a6ff;color:#58a6ff;font-weight:bold;">➖ В фон</button>
        </div>
        <div style="padding:9px 12px;background:#090d14;border-bottom:1px solid #21262d;display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;gap:6px;">
                <input type="text" id="radSearchInpV91" placeholder="Поиск станции или жанра..." oninput="window.renderRadioFiltersAndStationsV92()" onkeydown="if(event.key==='Enter') window.loadFlacRadioStationsV91()" style="flex:1;padding:7px 10px;font-size:12px;background:#06080b !important;color:#e6edf3 !important;border:1px solid #30363d !important;border-radius:8px;text-align:left !important;">
                <button type="button" onclick="window.loadFlacRadioStationsV91()" style="padding:7px 12px;background:#1f6feb;color:#fff;border:none;border-radius:8px;font-weight:bold;">🔍</button>
            </div>
            <div id="radGenreStripV92" class="jenny-pl-scroll-strip-v71" style="padding-bottom:2px;"></div>
            <div id="radQualitySubStripV92" class="jenny-subfilter-bar-v71" style="margin-bottom:0;padding-bottom:4px;"></div>
            <div id="radNowPlayingTitleV91" style="font-size:11px;color:#3fb950;font-weight:bold;padding:1px 0;display:flex;align-items:center;gap:6px;">Выбери станцию (${window.JENNY_NEON_SVGS_V92.badgeHigh} / ${window.JENNY_NEON_SVGS_V92.badgeLow})</div>
            <button type="button" id="btnRadioRecV91" onclick="window.toggleRadioRecordToXflacV91()" style="width:100%;padding:8px;background:#238636;color:#fff;border:none;border-radius:8px;font-weight:bold;font-size:12px;">⏺ Записать эфир станции</button>
        </div>
        <div id="radStationsListV91" style="flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:7px;min-height:220px;"></div>
    </div>`;
    document.body.appendChild(m);
    window.loadFlacRadioStationsV91();
};

// === ☁️ ИЗОЛИРОВАННОЕ ОКНО SOUNDCLOUD + АВТОРИЗАЦИЯ КУКИ / ВХОД ===
window.openScAuthBoxV93 = function() {
    const box = document.getElementById('scAuthDropBoxV93');
    if (box) box.style.display = (box.style.display === 'none') ? 'flex' : 'none';
};

window.saveScAuthCookieV93 = async function() {
    const cInp = document.getElementById('scCookieInpV93');
    const idInp = document.getElementById('scClientIdInpV93');
    await fetch('/api/soundcloud/save_auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: cInp ? cInp.value : '', client_id: idInp ? idInp.value : '' })
    });
    if (typeof window.showToast === 'function') window.showToast('✅ Данные SoundCloud сохранены');
    window.openScAuthBoxV93();
    window.runScDedicatedSearchV93();
};

window.openSoundCloudModalV92 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const ex = document.getElementById('jennySoundCloudModalV93');
    if (ex) {
        const isHid = (ex.style.display === 'none' || getComputedStyle(ex).display === 'none');
        ex.style.setProperty('display', isHid ? 'flex' : 'none', 'important');
        return;
    }
    const m = document.createElement('div');
    m.id = 'jennySoundCloudModalV93';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) m.style.setProperty('display', 'none', 'important'); };
    m.innerHTML = `<div class="jenny-modal-card-v71" onclick="event.stopPropagation()" style="max-width:450px;max-height:88vh;display:flex;flex-direction:column;">
        <div class="jenny-modal-hdr-v71" style="background:linear-gradient(90deg,rgba(255,140,66,0.22),rgba(115,65,190,0.22));">
            <span style="color:#ff8c42;font-weight:900;font-size:13px;display:flex;align-items:center;gap:6px;">${window.JENNY_NEON_SVGS_V92.soundcloud}<span>SOUNDCLOUD СТУДИЯ</span></span>
            <div style="display:flex;gap:5px;">
                <button type="button" onclick="window.openScAuthBoxV93()" style="padding:4px 8px;font-size:10.5px;border-radius:7px;background:rgba(255,140,66,0.18);border:1px solid #ff8c42;color:#ff8c42;font-weight:bold;">🔑 Куки / Вход</button>
                <button type="button" onclick="document.getElementById('jennySoundCloudModalV93').style.setProperty('display','none','important')" style="padding:4px 10px;font-size:11px;border-radius:7px;background:rgba(88,166,255,0.18);border:1px solid #58a6ff;color:#58a6ff;font-weight:bold;">➖ В фон</button>
            </div>
        </div>
        <div id="scAuthDropBoxV93" style="display:none;flex-direction:column;gap:6px;padding:10px 12px;background:#11161f;border-bottom:1px solid #ff8c42;">
            <div style="font-size:11px;color:#e6edf3;line-height:1.35;">1. Нажми <b>«🌐 Открыть SoundCloud»</b>, прими куки или войди в аккаунт.<br>2. Если регион блокирует API, вставь <code style="color:#ff8c42;">oauth_token</code> или Cookie ниже:</div>
            <div style="display:flex;gap:6px;">
                <button type="button" onclick="window.open('https://soundcloud.com/signin','_blank')" style="flex:1;padding:6px;background:#ff8c42;color:#000;border:none;border-radius:6px;font-weight:bold;font-size:11px;">🌐 Открыть SoundCloud (ОК / Вход)</button>
            </div>
            <input type="text" id="scCookieInpV93" placeholder="Cookie / oauth_token (необязательно)..." style="padding:6px 8px;font-size:11px;background:#06080b !important;color:#e6edf3 !important;border:1px solid #30363d !important;border-radius:6px;text-align:left !important;">
            <input type="text" id="scClientIdInpV93" placeholder="Свой client_id (необязательно)..." style="padding:6px 8px;font-size:11px;background:#06080b !important;color:#e6edf3 !important;border:1px solid #30363d !important;border-radius:6px;text-align:left !important;">
            <button type="button" onclick="window.saveScAuthCookieV93()" style="padding:6px;background:#238636;color:#fff;border:none;border-radius:6px;font-weight:bold;font-size:11px;">💾 Сохранить и переподключить</button>
        </div>
        <div style="padding:9px 12px;background:#090d14;border-bottom:1px solid #21262d;display:flex;gap:6px;">
            <input type="text" id="scDedicatedInpV93" value="Synthwave" placeholder="Трек или артист в SoundCloud..." onkeydown="if(event.key==='Enter') window.runScDedicatedSearchV93()" style="flex:1;padding:7px 10px;font-size:12px;background:#06080b !important;color:#e6edf3 !important;border:1px solid #30363d !important;border-radius:8px;text-align:left !important;">
            <button type="button" onclick="window.runScDedicatedSearchV93()" style="padding:7px 12px;background:#ff8c42;color:#000;border:none;border-radius:8px;font-weight:bold;">🔍 Найти</button>
        </div>
        <div id="scDedicatedBodyV93" style="flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:7px;min-height:220px;"></div>
    </div>`;
    document.body.appendChild(m);
    window.runScDedicatedSearchV93();
};

window.runScDedicatedSearchV93 = async function() {
    const inp = document.getElementById('scDedicatedInpV93');
    const body = document.getElementById('scDedicatedBodyV93');
    if (!inp || !body) return;
    const q = inp.value.trim() || 'Synthwave';
    body.innerHTML = `<div style="color:#ff8c42;text-align:center;padding:30px 10px;">⏳ Поиск «${q}» в SoundCloud...</div>`;
    try {
        const res = await fetch('/api/soundcloud/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
        const d = await res.json();
        const tracks = d.tracks || [];
        if (!tracks.length) {
            body.innerHTML = `<div style="color:#e3b341;text-align:center;padding:20px 10px;font-size:12px;">⚠️ SoundCloud запросил подтверждение куки.<br><br><button type="button" onclick="window.openScAuthBoxV93()" style="padding:7px 12px;background:#ff8c42;color:#000;border:none;border-radius:7px;font-weight:bold;">🔑 Открыть окно Куки / Входа</button></div>`;
            return;
        }
        window._khStateV88.currentAlbum = { slug: 'sc_search', album_title: 'SoundCloud', has_flac: false, tracks };
        body.innerHTML = tracks.map(t => `<div style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:#0b0f16;border:1px solid #21262d;border-radius:8px;">
            <div style="flex:1;min-width:0;">
                <div style="color:#e6edf3;font-size:12px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.index}. ${t.title}</div>
                <div style="color:#8b949e;font-size:10px;margin-top:2px;">⏱ ${t.duration} • SoundCloud Stream</div>
            </div>
            <button type="button" class="kh-prev-btn-v88" onclick="window.previewKhTrackV88(${t.index}, this, event)" style="padding:4px 8px;font-size:11px;background:#161b22;color:#58a6ff;border:1px solid #30363d;">▶</button>
            <button type="button" onclick="window._khStateV88.formatMode='mp3';window.downloadSingleKhTrackV88(${t.index}, this, event)" style="padding:4px 8px;font-size:11px;background:rgba(255,140,66,0.18);color:#ff8c42;border:1px solid #ff8c42;">⬇️</button>
        </div>`).join('');
    } catch (e) {
        body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:25px 10px;">❌ ${e.message || e}</div>`;
    }
};

window.openTorrentHubPreviewModalV91 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const ex = document.getElementById('jennyTorrentModalV91');
    if (ex) {
        const isHid = (ex.style.display === 'none' || getComputedStyle(ex).display === 'none');
        ex.style.setProperty('display', isHid ? 'flex' : 'none', 'important');
        return;
    }
    const m = document.createElement('div');
    m.id = 'jennyTorrentModalV91';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) m.style.setProperty('display', 'none', 'important'); };
    m.innerHTML = `<div class="jenny-modal-card-v71" onclick="event.stopPropagation()" style="max-width:450px;">
        <div class="jenny-modal-hdr-v71">
            <span style="color:#d2a8ff;font-weight:900;font-size:13px;display:flex;align-items:center;gap:6px;">${window.JENNY_NEON_SVGS_V92.torrent}<span>ТОРРЕНТ-СТУДИЯ (GO ENGINE)</span></span>
            <button type="button" onclick="document.getElementById('jennyTorrentModalV91').style.setProperty('display','none','important')" style="padding:4px 10px;font-size:11px;border-radius:7px;background:rgba(88,166,255,0.18);border:1px solid #58a6ff;color:#58a6ff;font-weight:bold;">➖ В фон</button>
        </div>
        <div class="jenny-modal-body-v71">
            <input type="text" id="torMagnetInpV91" placeholder="Вставь Magnet-ссылку или поисковый запрос FLAC..." style="width:100%;padding:8px 10px;text-align:left !important;box-sizing:border-box;">
            <div style="font-size:11.5px;color:#8b949e;line-height:1.4;">Слот готов. Следующим шагом подключим сюда Go-демон <b>libjtorrent.so</b>.</div>
        </div>
    </div>`;
    document.body.appendChild(m);
};

setTimeout(() => {
    window.renderHeaderSourcesHubV91();
    window.renderSourcesSettingsSectionV91();
}, 250);

// === 🔌 JENNY V94: MASTER KILL SWITCH ДЛЯ ВСЕХ ИСТОЧНИКОВ И ФОНОВЫХ ПОТОКОВ ===
window.killAllSourceModulesV94 = async function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();

    // 1. Останавливаем все звуки и таймеры на клиенте
    if (typeof window.stopKhPreviewV88 === 'function') window.stopKhPreviewV88();
    if (typeof window.stopFlacRadioStreamV91 === 'function') window.stopFlacRadioStreamV91();
    if (typeof window.stopKhProgressPollV89 === 'function') window.stopKhProgressPollV89();

    if (window._khStateV88) {
        window._khStateV88.abortDownload = true;
        window._khStateV88.isDownloading = false;
    }
    if (window._radioStateV91) {
        if (window._radioStateV91.recTimer) clearInterval(window._radioStateV91.recTimer);
        window._radioStateV91.isRecording = false;
        window._radioStateV91.currentStation = null;
    }

    // 2. Жёстко сносим все окна модулей из DOM (не скрываем, а полностью выгружаем)
    [
        'jennyKhinsiderModalV88',
        'jennyFlacRadioModalV91',
        'jennySoundCloudModalV93',
        'jennyTorrentModalV91'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    const menu = document.getElementById('jennySourcesDropMenuV91');
    if (menu) menu.style.display = 'none';

    // 3. Гасим серверные потоки записи/закачки
    try { await fetch('/api/sources/kill_all', { method: 'POST' }); } catch (e) {}

    if (typeof window.showToast === 'function') {
        window.showToast('🔌 Все внешние модули и потоки жёстко выгружены');
    }
};

(function hookDropdownKillSwitchV94() {
    const origToggle = window.toggleSourcesDropdownMenuV91;
    if (typeof origToggle !== 'function' || window._killSwitchHookedV94) return;
    window._killSwitchHookedV94 = true;

    window.toggleSourcesDropdownMenuV91 = function(ev) {
        const res = origToggle.apply(this, arguments);
        const menu = document.getElementById('jennySourcesDropMenuV91');
        if (menu && menu.style.display === 'flex' && !document.getElementById('btnKillAllSourcesV94')) {
            const activeDomCnt = [
                'jennyKhinsiderModalV88',
                'jennyFlacRadioModalV91',
                'jennySoundCloudModalV93',
                'jennyTorrentModalV91'
            ].filter(id => Boolean(document.getElementById(id))).length;

            const isPlayingStream = Boolean(
                (window._khStateV88 && window._khStateV88.previewAudio && !window._khStateV88.previewAudio.paused) ||
                (window._radioStateV91 && window._radioStateV91.audio && !window._radioStateV91.audio.paused) ||
                (window._khStateV88 && window._khStateV88.isDownloading) ||
                (window._radioStateV91 && window._radioStateV91.isRecording)
            );

            const statusLabel = (activeDomCnt > 0 || isPlayingStream)
                ? `В фоне: ${activeDomCnt}${isPlayingStream ? ' • 🔊 АКТИВЕН' : ''}`
                : 'Всё чисто';

            const killBtn = document.createElement('button');
            killBtn.type = 'button';
            killBtn.id = 'btnKillAllSourcesV94';
            killBtn.onclick = (e) => window.killAllSourceModulesV94(e);
            killBtn.style.cssText = 'margin-top:4px;width:100%;padding:8px 10px;border-radius:8px;background:linear-gradient(90deg,rgba(218,54,51,0.25),rgba(115,65,190,0.2));border:1px solid #ff7b72;color:#ff7b72;font-size:11.5px;font-weight:900;display:flex;justify-content:space-between;align-items:center;cursor:pointer;';
            killBtn.innerHTML = `<span>🔌 ВЫРУБИТЬ ВСЕ МОДУЛИ</span><span style="font-size:10px;color:#e6edf3;background:rgba(0,0,0,0.45);padding:2px 6px;border-radius:5px;">${statusLabel}</span>`;
            menu.appendChild(killBtn);
        }
        return res;
    };
})();

// === 🎮🏛️ JENNY V95: SEPARATE OST & ARCHIVE MODES + CUSTOM '+' CHIPS + CHROME COOKIE GRABBER ===
window._khStateV88 = window._khStateV88 || {};
window._khStateV88.currentSourceMode = 'ost'; // 'ost' | 'archive'

window.DEFAULT_OST_CHIPS_V95 = ['Gothic', 'Fallout', 'Silent Hill', 'Doom', 'Need for Speed', 'Witcher', 'Heroes III', 'GTA'];
window.DEFAULT_ARCHIVE_CHIPS_V95 = ['Pink Floyd', 'Linkin Park', 'Eminem', 'The Prodigy', 'Metallica', 'Depeche Mode', 'Synthwave FLAC', 'Live Concert'];

window.getCustomSourceChipsV95 = function(mode) {
    window.appConfig = window.appConfig || {};
    const key = (mode === 'archive') ? 'customArchiveChipsV95' : 'customOstChipsV95';
    const def = (mode === 'archive') ? window.DEFAULT_ARCHIVE_CHIPS_V95 : window.DEFAULT_OST_CHIPS_V95;
    if (!Array.isArray(window.appConfig[key]) || window.appConfig[key].length === 0) {
        window.appConfig[key] = [...def];
    }
    return window.appConfig[key];
};

window.addCustomSourceChipV95 = function() {
    const mode = window._khStateV88.currentSourceMode || 'ost';
    const key = (mode === 'archive') ? 'customArchiveChipsV95' : 'customOstChipsV95';
    const inp = document.getElementById('khSearchInpV88');
    let val = prompt(
        mode === 'archive' ? 'Добавить исполнителя / тег в быстрый список:' : 'Добавить свою игру в быстрый список:',
        (inp && inp.value.trim()) ? inp.value.trim() : ''
    );
    if (!val || !val.trim()) return;
    val = val.trim();
    const list = window.getCustomSourceChipsV95(mode);
    if (!list.includes(val)) {
        list.unshift(val);
        window.appConfig[key] = list;
        localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    }
    window.renderKhQuickChipsStripV95();
    if (inp) {
        inp.value = val;
        window.runKhSearchV88();
    }
};

window.removeCustomSourceChipV95 = function(name, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const mode = window._khStateV88.currentSourceMode || 'ost';
    const key = (mode === 'archive') ? 'customArchiveChipsV95' : 'customOstChipsV95';
    if (!confirm(`Удалить кнопку «${name}» из быстрого списка?`)) return;
    window.appConfig[key] = window.getCustomSourceChipsV95(mode).filter(x => x !== name);
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.renderKhQuickChipsStripV95();
};

window.renderKhQuickChipsStripV95 = function() {
    const strip = document.getElementById('khQuickChipsBarV95');
    if (!strip) return;
    const mode = window._khStateV88.currentSourceMode || 'ost';
    const icon = (mode === 'archive') ? '🏛️' : '🎮';
    const accent = (mode === 'archive') ? '#79c0ff' : '#3fb950';
    const list = window.getCustomSourceChipsV95(mode);

    const addBtn = `<button type="button" onclick="window.addCustomSourceChipV95()" title="Добавить свою кнопку в список" style="padding:3px 9px;font-size:11.5px;border-radius:12px;background:rgba(63,185,80,0.2);border:1px solid ${accent};color:${accent};font-weight:900;flex-shrink:0;">➕</button>`;
    const chipsHtml = list.map(g => {
        const safeG = String(g).replace(/'/g, "\'");
        return `<div style="display:inline-flex;align-items:center;background:#11161d;border:1px solid #30363d;border-radius:12px;flex-shrink:0;overflow:hidden;">
            <button type="button" onclick="document.getElementById('khSearchInpV88').value='${safeG}';window.runKhSearchV88();" style="padding:3px 7px;font-size:10.5px;background:transparent;border:none;color:#79c0ff;white-space:nowrap;box-shadow:none;">${icon} ${g}</button>
            <button type="button" onclick="window.removeCustomSourceChipV95('${safeG}', event)" title="Удалить" style="padding:3px 5px;font-size:9px;background:transparent;border:none;color:#8b949e;box-shadow:none;">✖</button>
        </div>`;
    }).join('');
    strip.innerHTML = addBtn + chipsHtml;
};

// Переключаем стиль, заголовок, быстрые кнопки и режим поиска между «🎮 GAME OST» и «🏛️ LOSSLESS АРХИВЫ»
window.applyKhModalModeThemeV95 = function(mode) {
    window._khStateV88.currentSourceMode = mode || 'ost';
    const m = document.getElementById('jennyKhinsiderModalV88');
    if (!m) return;
    const hdr = m.querySelector('.jenny-modal-hdr-v71');
    const titleSpan = hdr ? hdr.querySelector('span') : null;
    const inp = document.getElementById('khSearchInpV88');

    const firstRowWithChips = m.querySelector('div[style*="overflow-x:auto"]');
    if (firstRowWithChips && !firstRowWithChips.id) {
        firstRowWithChips.id = 'khQuickChipsBarV95';
    }

    if (mode === 'archive') {
        if (hdr) hdr.style.background = 'linear-gradient(90deg, rgba(121,192,255,0.24), rgba(163,113,247,0.24))';
        if (titleSpan) {
            titleSpan.style.color = '#79c0ff';
            titleSpan.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;">${window.JENNY_NEON_SVGS_V92.archive}<span>LOSSLESS АРХИВЫ И КОНЦЕРТЫ</span></span>`;
        }
        if (inp) inp.placeholder = 'Артист, альбом, концерт или винил-рип (Pink Floyd, Eminem...)';
    } else {
        if (hdr) hdr.style.background = 'linear-gradient(90deg, rgba(63,185,80,0.22), rgba(115,65,190,0.25))';
        if (titleSpan) {
            titleSpan.style.color = '#3fb950';
            titleSpan.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;">${window.JENNY_NEON_SVGS_V92.ost}<span>GAME OST ➔ XFLAC СТУДИЯ</span></span>`;
        }
        if (inp) inp.placeholder = 'Игра (Gothic, Fallout, Silent Hill, Witcher...)';
    }
    window.renderKhQuickChipsStripV95();
};

const _origOpenKhV88 = window.openKhinsiderModalV88;
window.openKhinsiderModalV88 = function(ev, modeOverride) {
    const targetMode = modeOverride || window._khStateV88.currentSourceMode || 'ost';
    const existing = document.getElementById('jennyKhinsiderModalV88');
    const prevMode = window._khStateV88.currentSourceMode;
    if (existing) {
        const isHidden = (existing.style.display === 'none' || getComputedStyle(existing).display === 'none');
        if (isHidden) {
            window.closeAllV71Modals();
            existing.style.setProperty('display', 'flex', 'important');
            window.applyKhModalModeThemeV95(targetMode);
        } else if (prevMode !== targetMode) {
            window.applyKhModalModeThemeV95(targetMode);
        } else {
            window.minimizeKhinsiderModalV88();
        }
        return;
    }
    _origOpenKhV88.call(this, ev);
    window.applyKhModalModeThemeV95(targetMode);
};

window.runKhSearchV88 = async function() {
    const inp = document.getElementById('khSearchInpV88');
    const body = document.getElementById('khBodyContentV88');
    const ftr = document.getElementById('khFooterBarV88');
    if (!inp || !body) return;
    const q = inp.value.trim();
    if (!q) return;
    const mode = window._khStateV88.currentSourceMode || 'ost';
    window._khStateV88.lastQuery = q;
    if (ftr) ftr.style.display = 'none';
    body.innerHTML = `<div style="color:#58a6ff;text-align:center;padding:35px 10px;">⏳ Поиск «${q}» (${mode === 'archive' ? 'Lossless Архивы' : 'Game OST'})...</div>`;
    try {
        const res = await fetch('/api/khinsider/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q, mode: mode, format_mode: window._khStateV88.formatMode || 'xflac_psycho' })
        });
        const data = await res.json();
        if (!res.ok || data.status !== 'ok') throw new Error(data.error || 'Ошибка поиска');
        window._khStateV88.lastAlbums = data.albums || [];
        window._khStateV88.currentAlbum = null;
        window.renderKhAlbumsListV88();
    } catch (e) {
        body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:25px 10px;">❌ ${e.message || e}</div>`;
    }
};

// Авто-экстрактор куки SoundCloud для Android Chrome без консоли разработчика
window.copyScChromeBookmarkletV95 = async function() {
    const code = "javascript:navigator.clipboard.writeText(document.cookie).then(()=>alert('Куки SoundCloud скопированы! Вернись в JennyPlayer'));";
    if (typeof window.copyTextToClipboard === 'function') await window.copyTextToClipboard(code);
    if (typeof window.showToast === 'function') window.showToast('📋 Код скопирован! Вставь его в адресную строку Chrome на вкладке SoundCloud');
};

window.pasteScCookieFromClipboardV95 = async function() {
    try {
        const txt = await navigator.clipboard.readText();
        const inp = document.getElementById('scCookieInpV93');
        if (inp && txt) {
            inp.value = txt.trim();
            await window.saveScAuthCookieV93();
        }
    } catch (e) {
        if (typeof window.showToast === 'function') window.showToast('Вставь скопированные куки в текстовое поле вручную');
    }
};

const _origOpenScV92 = window.openSoundCloudModalV92;
window.openSoundCloudModalV92 = function(ev) {
    _origOpenScV92.call(this, ev);
    const authBox = document.getElementById('scAuthDropBoxV93');
    if (authBox && !authBox.getAttribute('data-v95')) {
        authBox.setAttribute('data-v95', '1');
        authBox.innerHTML = `
            <div style="font-size:11px;color:#e6edf3;line-height:1.35;">
                <b>Как вытащить куки из Chrome на Android без консоли:</b><br>
                1. Нажми <b>«📋 Код-экстрактор»</b>.<br>
                2. Открой <code style="color:#ff8c42;">soundcloud.com</code> в обычном Chrome, вставь код в адресную строку (убедись, что в начале написано <code style="color:#3fb950;">javascript:</code>) и нажми Перейти.<br>
                3. Вернись сюда и нажми <b>«📥 Вставить куки и подключить»</b>:
            </div>
            <div style="display:flex;gap:6px;">
                <button type="button" onclick="window.copyScChromeBookmarkletV95()" style="flex:1;padding:6px;background:#ff8c42;color:#000;border:none;border-radius:6px;font-weight:bold;font-size:11px;">📋 1. Код-экстрактор</button>
                <button type="button" onclick="window.pasteScCookieFromClipboardV95()" style="flex:1;padding:6px;background:#238636;color:#fff;border:none;border-radius:6px;font-weight:bold;font-size:11px;">📥 2. Вставить из буфера</button>
            </div>
            <input type="text" id="scCookieInpV93" placeholder="Или вставь Cookie / oauth_token сюда..." style="padding:6px 8px;font-size:11px;background:#06080b !important;color:#e6edf3 !important;border:1px solid #30363d !important;border-radius:6px;text-align:left !important;">
            <button type="button" onclick="window.saveScAuthCookieV93()" style="padding:6px;background:#1f6feb;color:#fff;border:none;border-radius:6px;font-weight:bold;font-size:11px;">💾 Сохранить и обновить поиск</button>
        `;
    }
};

// === 🧲 JENNY V96: FULL P2P TORRENT STUDIO UI (SEARCH + MAGNET + ENDGAME + AUTO XFLAC) ===
window._torStateV96 = {
    onlyFlac: true, formatMode: 'xflac_psycho', currentHash: '', currentName: '',
    files: [], selectedFiles: new Set(), pollTimer: null, importedSet: new Set()
};

// При смене формата между MP3 и FLAC/xFLAC сразу обновляем выдачу альбомов
const _origSelectKhFmtV88 = window.selectKhFormatV88;
window.selectKhFormatV88 = function(fmt) {
    const prev = window._khStateV88 ? window._khStateV88.formatMode : '';
    _origSelectKhFmtV88.call(this, fmt);
    if ((prev === 'mp3') !== (fmt === 'mp3') && !window._khStateV88.currentAlbum) {
        window.runKhSearchV88();
    }
};

window.previewScTrackV96 = async function(idx, btnEl, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const t = (window._scDedicatedTracksV96 || []).find(x => x.index === idx);
    if (!t) return;
    const savedAlb = window._khStateV88.currentAlbum;
    window._khStateV88.currentAlbum = { slug: 'sc_isolated', album_title: 'SoundCloud', tracks: window._scDedicatedTracksV96 };
    await window.previewKhTrackV88(idx, btnEl, ev);
    window._khStateV88.currentAlbum = savedAlb;
};

window.downloadScTrackV96 = async function(idx, btnEl, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const t = (window._scDedicatedTracksV96 || []).find(x => x.index === idx);
    if (!t) return;
    if (btnEl) btnEl.innerText = '⏳';
    try {
        const res = await fetch('/api/soundcloud/download_track', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page_path: t.page_path, track_title: t.title, track_num: t.index })
        });
        const d = await res.json();
        if (!res.ok || d.status !== 'ok') throw new Error(d.error || 'Ошибка скачивания');
        if (btnEl) btnEl.innerText = '✅';
        if (typeof window.fetchData === 'function') window.fetchData();
        if (typeof window.showToast === 'function') window.showToast(`✅ Скачано: ${d.filename} (${d.size_mb} MB)`);
    } catch (e) {
        if (btnEl) btnEl.innerText = '⬇️';
        if (typeof window.showToast === 'function') window.showToast('❌ ' + (e.message || e));
    }
};

window.runScDedicatedSearchV93 = async function() {
    const inp = document.getElementById('scDedicatedInpV93');
    const body = document.getElementById('scDedicatedBodyV93');
    if (!inp || !body) return;
    const q = inp.value.trim() || 'Synthwave';
    body.innerHTML = `<div style="color:#ff8c42;text-align:center;padding:30px 10px;">⏳ Поиск «${q}» в SoundCloud...</div>`;
    try {
        const res = await fetch('/api/soundcloud/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
        const d = await res.json();
        const tracks = d.tracks || [];
        window._scDedicatedTracksV96 = tracks;
        if (!tracks.length) {
            body.innerHTML = `<div style="color:#e3b341;text-align:center;padding:20px 10px;font-size:12px;">Ничего не найдено.<br><br><button type="button" onclick="window.openScAuthBoxV93()" style="padding:7px 12px;background:#ff8c42;color:#000;border:none;border-radius:7px;font-weight:bold;">🔑 Куки / Вход</button></div>`;
            return;
        }
        body.innerHTML = tracks.map(t => `<div style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:#0b0f16;border:1px solid ${t.downloaded ? 'rgba(63,185,80,0.6)' : '#21262d'};border-radius:8px;">
            <div style="flex:1;min-width:0;">
                <div style="color:#e6edf3;font-size:12px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.index}. ${t.title}</div>
                <div style="color:#8b949e;font-size:10px;margin-top:2px;">⏱ ${t.duration} • Полный MP3 поток ${t.downloaded ? '• ✅ В плеере' : ''}</div>
            </div>
            <button type="button" class="kh-prev-btn-v88" onclick="window.previewScTrackV96(${t.index}, this, event)" style="padding:4px 8px;font-size:11px;background:#161b22;color:#58a6ff;border:1px solid #30363d;">▶</button>
            <button type="button" onclick="window.downloadScTrackV96(${t.index}, this, event)" style="padding:4px 8px;font-size:11px;background:rgba(255,140,66,0.18);color:#ff8c42;border:1px solid #ff8c42;">${t.downloaded ? '✅' : '⬇️'}</button>
        </div>`).join('');
    } catch (e) {
        body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:25px 10px;">❌ ${e.message || e}</div>`;
    }
};

const _origApplyThemeV95 = window.applyKhModalModeThemeV95;
window.applyKhModalModeThemeV95 = function(mode) {
    const prev = window._khStateV88.currentSourceMode;
    _origApplyThemeV95.call(this, mode);
    if (prev !== mode) {
        window._khStateV88.currentAlbum = null;
        window._khStateV88.lastAlbums = [];
        const ftr = document.getElementById('khFooterBarV88');
        if (ftr) ftr.style.display = 'none';
        const inp = document.getElementById('khSearchInpV88');
        if (inp) inp.value = (mode === 'archive') ? 'Pink Floyd' : 'Doom';
        window.runKhSearchV88();
    }
};

window.openTorrentHubPreviewModalV91 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const ex = document.getElementById('jennyTorrentModalV91');
    if (ex) {
        const isHid = (ex.style.display === 'none' || getComputedStyle(ex).display === 'none');
        ex.style.setProperty('display', isHid ? 'flex' : 'none', 'important');
        return;
    }
    const m = document.createElement('div');
    m.id = 'jennyTorrentModalV91';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) m.style.setProperty('display', 'none', 'important'); };
    m.innerHTML = `<div class="jenny-modal-card-v71" onclick="event.stopPropagation()" style="max-width:460px;max-height:88vh;display:flex;flex-direction:column;">
        <div class="jenny-modal-hdr-v71" style="background:linear-gradient(90deg,rgba(210,168,255,0.22),rgba(31,111,235,0.22));">
            <span style="color:#d2a8ff;font-weight:900;font-size:13px;display:flex;align-items:center;gap:6px;">${window.JENNY_NEON_SVGS_V92.torrent}<span>ТОРРЕНТ-СТУДИЯ (GO ENGINE)</span></span>
            <button type="button" onclick="document.getElementById('jennyTorrentModalV91').style.setProperty('display','none','important')" style="padding:4px 10px;font-size:11px;border-radius:7px;background:rgba(88,166,255,0.18);border:1px solid #58a6ff;color:#58a6ff;font-weight:bold;">➖ В фон</button>
        </div>
        <div style="padding:9px 12px;background:#090d14;border-bottom:1px solid #21262d;display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;gap:6px;">
                <input type="text" id="torMagnetInpV91" value="" placeholder="Поиск FLAC-раздачи или вставь magnet:?xt=..." onkeydown="if(event.key==='Enter') window.runTorrentActionV96()" style="flex:1;padding:7px 10px;font-size:12px;background:#06080b !important;color:#e6edf3 !important;border:1px solid #30363d !important;border-radius:8px;text-align:left !important;">
                <button type="button" onclick="window.runTorrentActionV96()" style="padding:7px 12px;background:#8957e5;color:#fff;border:none;border-radius:8px;font-weight:bold;">🔍 / 🧲</button>
            </div>
            <div id="torStatusLineV96" style="font-size:11px;color:#d2a8ff;font-weight:bold;">⚡ Введи название альбома/игры или вставь Magnet-ссылку</div>
        </div>
        <div id="torBodyListV96" style="flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:7px;min-height:230px;"></div>
        <div id="torFooterBarV96" style="display:none;padding:10px 12px;border-top:1px solid #21262d;background:#090c10;gap:8px;">
            <button type="button" onclick="window.startSelectedTorrentDownloadV96()" style="flex:1;padding:8px 12px;background:linear-gradient(135deg,#8957e5,#238636);color:#fff;border:none;border-radius:8px;font-weight:bold;">⬇️ Качать выбранные файлы (Endgame ➔ xFLAC)</button>
        </div>
    </div>`;
    document.body.appendChild(m);
    window.runTorrentActionV96();
};

window.runTorrentActionV96 = async function() {
    const inp = document.getElementById('torMagnetInpV91');
    const body = document.getElementById('torBodyListV96');
    const ftr = document.getElementById('torFooterBarV96');
    if (!inp || !body) return;
    const val = inp.value.trim();
    if (!val) return;
    if (val.toLowerCase().startsWith('magnet:?')) {
        await window.openMagnetInGoEngineV96(val);
        return;
    }
    if (ftr) ftr.style.display = 'none';
    body.innerHTML = `<div style="color:#d2a8ff;text-align:center;padding:30px 10px;">⏳ Поиск раздач «${val}»...</div>`;
    try {
        const res = await fetch('/api/torrent/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: val, only_flac: true }) });
        const d = await res.json();
        const list = d.results || [];
        if (!list.length) {
            body.innerHTML = `<div style="color:#8b949e;text-align:center;padding:25px;">Раздачи не найдены. Можно вставить прямую magnet:? ссылку.</div>`;
            return;
        }
        window._torSearchResultsV96 = list;
        body.innerHTML = list.map((r, i) => `<div onclick="window.openMagnetInGoEngineV96(window._torSearchResultsV96[${i}].magnet)" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0d1117;border:1px solid #262c36;border-radius:9px;cursor:pointer;">
            <div style="flex:1;min-width:0;">
                <div style="color:#e6edf3;font-size:12px;font-weight:bold;">${r.title}</div>
                <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${r.size_mb} MB • <span style="color:#3fb950;font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
            </div>
            <span style="color:#d2a8ff;font-size:11px;font-weight:bold;">Открыть ➔</span>
        </div>`).join('');
    } catch (e) {
        body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:20px;">❌ ${e.message || e}</div>`;
    }
};

window.openMagnetInGoEngineV96 = async function(magnetUrl) {
    const body = document.getElementById('torBodyListV96');
    const stEl = document.getElementById('torStatusLineV96');
    const ftr = document.getElementById('torFooterBarV96');
    if (body) body.innerHTML = `<div style="color:#d2a8ff;text-align:center;padding:35px 10px;">🧲 Подключение к DHT и получение списка файлов от пиров (до 25с)...</div>`;
    try {
        const res = await fetch('/api/torrent/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ magnet: magnetUrl }) });
        const d = await res.json();
        if (d.status !== 'ok') throw new Error(d.error || 'Ошибка чтения Magnet');
        window._torStateV96.currentHash = d.hash;
        window._torStateV96.currentName = d.name;
        const audioExts = ['.flac', '.wav', '.mp3', '.ogg', '.aac', '.m4a', '.opus', '.alac', '.ape', '.wv', '.mp4', '.mkv'];
        window._torStateV96.files = (d.files || []).filter(f => audioExts.some(ext => f.path.toLowerCase().endsWith(ext)));
        if (!window._torStateV96.files.length) window._torStateV96.files = d.files || [];
        window._torStateV96.selectedFiles = new Set(window._torStateV96.files.map(f => f.index));
        if (stEl) stEl.innerText = `💿 ${d.name} (файлов: ${window._torStateV96.files.length})`;
        if (ftr) ftr.style.display = 'flex';
        window.renderTorrentFilesListV96();
    } catch (e) {
        if (body) body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:25px;">❌ ${e.message || e}</div>`;
    }
};

window.renderTorrentFilesListV96 = function() {
    const body = document.getElementById('torBodyListV96');
    if (!body) return;
    body.innerHTML = window._torStateV96.files.map(f => {
        const chk = window._torStateV96.selectedFiles.has(f.index) ? 'checked' : '';
        const mb = (f.length / (1024 * 1024)).toFixed(1);
        return `<div id="torFileRowV96_${f.index}" style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:#0b0f16;border:1px solid #21262d;border-radius:8px;">
            <input type="checkbox" ${chk} onchange="if(this.checked) window._torStateV96.selectedFiles.add(${f.index}); else window._torStateV96.selectedFiles.delete(${f.index});">
            <div style="flex:1;min-width:0;">
                <div style="color:#e6edf3;font-size:11.5px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.path}</div>
                <div id="torFileProgV96_${f.index}" style="color:#8b949e;font-size:10px;margin-top:2px;">💾 ${mb} MB • Ожидание</div>
            </div>
        </div>`;
    }).join('');
};

window.startSelectedTorrentDownloadV96 = async function() {
    const hash = window._torStateV96.currentHash;
    const files = Array.from(window._torStateV96.selectedFiles);
    if (!hash || !files.length) return;
    await fetch('/api/torrent/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash, files }) });
    if (window._torStateV96.pollTimer) clearInterval(window._torStateV96.pollTimer);
    window._torStateV96.pollTimer = setInterval(async () => {
        try {
            const d = await (await fetch('/api/torrent/status')).json();
            const tor = (d.torrents || []).find(x => x.hash === hash);
            if (!tor) return;
            const stEl = document.getElementById('torStatusLineV96');
            if (stEl) stEl.innerText = `🧲 Сидов: ${tor.seeders} • Пиров: ${tor.peers} • Качаем выбранные...`;
            for (const f of (tor.files || [])) {
                const pEl = document.getElementById('torFileProgV96_' + f.index);
                const doneMb = (f.completed / (1024 * 1024)).toFixed(1);
                const totMb = (f.length / (1024 * 1024)).toFixed(1);
                if (pEl) {
                    pEl.innerText = f.xflac_file
                        ? `✅ В плеере: ${f.xflac_file}`
                        : `⬇️ ${doneMb} / ${totMb} MB (${f.percent}%)`;
                }
                const impKey = `${hash}_${f.index}`;
                if (f.done && !f.xflac_file && !window._torStateV96.importedSet.has(impKey)) {
                    window._torStateV96.importedSet.add(impKey);
                    if (pEl) pEl.innerText = `🧬 Сжатие в .xFLAC...`;
                    fetch('/api/torrent/import_track', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ hash, index: f.index, full_path: f.full_path, torrent_name: tor.name, format_mode: 'xflac_psycho' })
                    }).then(r => r.json()).then(res => {
                        if (res.status === 'ok') {
                            if (pEl) pEl.innerText = `✅ В плеере: ${res.filename} (${res.size_mb} MB)`;
                            if (typeof window.fetchData === 'function') window.fetchData();
                        }
                    });
                }
            }
        } catch (e) {}
    }, 1000);
};

// === 🛡️ JENNY V97: SINGLE-STREAM LOCK + TORRENT LIVE STREAM & FILL BAR + BACK BUTTONS ===
window._previewReqIdV97 = 0;
window._scDownloadingLockV97 = false;

window.stopAllExternalStreamsV97 = function() {
    window._previewReqIdV97++;
    if (window._khStateV88 && window._khStateV88.previewAudio) {
        try {
            window._khStateV88.previewAudio.onended = null;
            window._khStateV88.previewAudio.ontimeupdate = null;
            window._khStateV88.previewAudio.pause();
            window._khStateV88.previewAudio.src = '';
        } catch (e) {}
        window._khStateV88.previewAudio = null;
    }
    if (typeof window.stopFlacRadioStreamV91 === 'function') window.stopFlacRadioStreamV91();
    document.querySelectorAll('.kh-prev-btn-v88, .tor-prev-btn-v97').forEach(b => { b.innerText = '▶'; });
    const mpBtn = document.getElementById('khMiniPlayBtnV90');
    if (mpBtn) mpBtn.innerText = '▶';
};

window.stopKhPreviewV88 = window.stopAllExternalStreamsV97;

// Надёжная предпрослушка без гонки промисов и без ошибки "interrupted by a call to pause()"
window.previewKhTrackV88 = async function(trackIdx, btnEl, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const alb = window._khStateV88.currentAlbum;
    const t = alb && alb.tracks ? alb.tracks.find(x => x.index === trackIdx) : null;
    if (!t) return;

    const curAud = window._khStateV88.previewAudio;
    if (curAud && curAud._pagePath === t.page_path) {
        if (!curAud.paused) {
            window.stopAllExternalStreamsV97();
        } else {
            window.pauseMainPlayerForOstV90();
            curAud.volume = window.getKhPreviewVolumeV90();
            try { await curAud.play(); if (btnEl) btnEl.innerText = '⏹'; } catch (e) {}
        }
        return;
    }

    window.stopAllExternalStreamsV97();
    window.pauseMainPlayerForOstV90();
    const myReqId = ++window._previewReqIdV97;
    if (btnEl) btnEl.innerText = '⏳';
    window._khStateV88.previewBtn = btnEl;

    try {
        const res = await fetch('/api/khinsider/resolve_stream', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page_path: t.page_path })
        });
        const data = await res.json();
        if (myReqId !== window._previewReqIdV97) return;
        if (!res.ok || !data.stream_url) throw new Error(data.error || 'Нет потока');

        const aud = new Audio(data.stream_url);
        aud._pagePath = t.page_path;
        aud.volume = window.getKhPreviewVolumeV90();
        window._khStateV88.previewAudio = aud;

        const bar = document.getElementById('khMiniPlayerBarV90');
        const tEl = document.getElementById('khMiniTitleV90');
        const curEl = document.getElementById('khMiniCurV90');
        const durEl = document.getElementById('khMiniDurV90');
        const seekEl = document.getElementById('khMiniSeekV90');
        const mpBtn = document.getElementById('khMiniPlayBtnV90');
        if (bar) bar.style.display = 'flex';
        if (tEl) tEl.innerText = `🎧 ${t.index}. ${t.title}`;
        if (mpBtn) mpBtn.innerText = '⏸';

        aud.ontimeupdate = () => {
            if (curEl) curEl.innerText = window.fmtKhSecV90(aud.currentTime);
            if (durEl && isFinite(aud.duration)) durEl.innerText = window.fmtKhSecV90(aud.duration);
            if (seekEl && isFinite(aud.duration) && aud.duration > 0) {
                seekEl.value = Math.round((aud.currentTime / aud.duration) * 1000);
            }
        };
        aud.onended = () => {
            if (btnEl) btnEl.innerText = '▶';
            if (mpBtn) mpBtn.innerText = '▶';
        };
        await aud.play();
        if (myReqId !== window._previewReqIdV97) {
            aud.pause();
            return;
        }
        if (btnEl) btnEl.innerText = '⏹';
    } catch (e) {
        if (myReqId === window._previewReqIdV97) {
            if (btnEl) btnEl.innerText = '▶';
            if (typeof window.showToast === 'function') window.showToast('❌ ' + (e.message || e));
        }
    }
};

// Защита от дурака при скачивании с SoundCloud: ждём полной сборки MP3 и показываем статус
window.downloadScTrackV96 = async function(idx, btnEl, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    if (window._scDownloadingLockV97) {
        if (typeof window.showToast === 'function') window.showToast('⏳ Подожди завершения текущей загрузки SoundCloud...');
        return;
    }
    const t = (window._scDedicatedTracksV96 || []).find(x => x.index === idx);
    if (!t) return;
    window._scDownloadingLockV97 = true;
    if (btnEl) { btnEl.innerText = '⏳ Сборка...'; btnEl.disabled = true; }
    try {
        const res = await fetch('/api/soundcloud/download_track', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page_path: t.page_path, track_title: t.title, track_num: t.index })
        });
        const d = await res.json();
        if (!res.ok || d.status !== 'ok') throw new Error(d.error || 'Ошибка скачивания');
        t.downloaded = true;
        if (btnEl) { btnEl.innerText = `✅ ${d.size_mb}M`; btnEl.disabled = false; }
        if (typeof window.fetchData === 'function') window.fetchData();
        if (typeof window.showToast === 'function') window.showToast(`✅ Готов полный трек: ${d.filename} (${d.size_mb} MB)`);
    } catch (e) {
        if (btnEl) { btnEl.innerText = '⬇️'; btnEl.disabled = false; }
        if (typeof window.showToast === 'function') window.showToast('❌ ' + (e.message || e));
    } finally {
        window._scDownloadingLockV97 = false;
    }
};

// 🧲 ОБНОВЛЁННАЯ ТОРРЕНТ-СТУДИЯ: Кнопка ⬅ Назад к раздачам, Потоковый ▶ на лету, Общий прогресс-бар и Заливка фона названия трека
window.backToTorrentSearchListV97 = function() {
    if (window._torStateV96 && window._torStateV96.pollTimer) {
        clearInterval(window._torStateV96.pollTimer);
        window._torStateV96.pollTimer = null;
    }
    const ftr = document.getElementById('torFooterBarV96');
    if (ftr) ftr.style.display = 'none';
    const list = window._torSearchResultsV96 || [];
    if (list.length) {
        const body = document.getElementById('torBodyListV96');
        const stEl = document.getElementById('torStatusLineV96');
        if (stEl) stEl.innerText = `📋 Найдено раздач: ${list.length}`;
        if (body) {
            body.innerHTML = list.map((r, i) => `<div onclick="window.openMagnetInGoEngineV96(window._torSearchResultsV96[${i}].magnet)" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0d1117;border:1px solid #262c36;border-radius:9px;cursor:pointer;">
                <div style="flex:1;min-width:0;">
                    <div style="color:#e6edf3;font-size:12px;font-weight:bold;">${r.title}</div>
                    <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${r.size_mb} MB • <span style="color:#3fb950;font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
                </div>
                <span style="color:#d2a8ff;font-size:11px;font-weight:bold;">Открыть ➔</span>
            </div>`).join('');
        }
    } else {
        window.runTorrentActionV96();
    }
};

window.previewTorrentFileStreamV97 = async function(fileIdx, btnEl, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const hash = window._torStateV96.currentHash;
    if (!hash) return;
    const streamUrl = `/api/torrent/stream/${hash}/${fileIdx}`;
    const curAud = window._khStateV88.previewAudio;
    if (curAud && curAud._pagePath === streamUrl) {
        window.stopAllExternalStreamsV97();
        return;
    }
    window.stopAllExternalStreamsV97();
    window.pauseMainPlayerForOstV90();
    const myReqId = ++window._previewReqIdV97;
    if (btnEl) btnEl.innerText = '⏳';

    const aud = new Audio(streamUrl);
    aud._pagePath = streamUrl;
    aud.volume = window.getKhPreviewVolumeV90();
    window._khStateV88.previewAudio = aud;
    const stEl = document.getElementById('torStatusLineV96');
    const fObj = (window._torStateV96.files || []).find(x => x.index === fileIdx);
    if (stEl && fObj) stEl.innerText = `🎧 Поток из торрента: ${fObj.path}`;
    aud.onended = () => { if (btnEl) btnEl.innerText = '▶'; };
    try {
        await aud.play();
        if (myReqId !== window._previewReqIdV97) { aud.pause(); return; }
        if (btnEl) btnEl.innerText = '⏹';
    } catch (e) {
        if (btnEl) btnEl.innerText = '▶';
        if (typeof window.showToast === 'function') window.showToast('⏳ Подожди пару секунд, пиры подгружают начало трека...');
    }
};

window.renderTorrentFilesListV96 = function() {
    const body = document.getElementById('torBodyListV96');
    const ftr = document.getElementById('torFooterBarV96');
    if (!body) return;
    if (ftr) {
        ftr.style.flexDirection = 'column';
        ftr.innerHTML = `
            <div id="torTotalProgWrapV97" style="display:none;width:100%;height:8px;background:#161b22;border-radius:6px;overflow:hidden;border:1px solid #30363d;">
                <div id="torTotalProgFillV97" style="width:0%;height:100%;background:linear-gradient(90deg,#8957e5,#3fb950);transition:width 0.3s ease;"></div>
            </div>
            <div style="display:flex;gap:8px;width:100%;">
                <button type="button" onclick="window.backToTorrentSearchListV97()" style="padding:8px 12px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;border-radius:8px;font-weight:bold;">⬅ Раздачи</button>
                <button type="button" id="btnTorStartDlV97" onclick="window.startSelectedTorrentDownloadV96()" style="flex:1;padding:8px 12px;background:linear-gradient(135deg,#8957e5,#238636);color:#fff;border:none;border-radius:8px;font-weight:bold;">⬇️ Качать выбранные (➔ xFLAC)</button>
            </div>
        `;
    }
    body.innerHTML = window._torStateV96.files.map(f => {
        const chk = window._torStateV96.selectedFiles.has(f.index) ? 'checked' : '';
        const mb = (f.length / (1024 * 1024)).toFixed(1);
        return `<div id="torFileRowV96_${f.index}" style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:#0b0f16;border:1px solid #21262d;border-radius:8px;transition:background 0.25s ease;">
            <input type="checkbox" ${chk} onchange="if(this.checked) window._torStateV96.selectedFiles.add(${f.index}); else window._torStateV96.selectedFiles.delete(${f.index});">
            <div style="flex:1;min-width:0;">
                <div style="color:#e6edf3;font-size:11.5px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.path}</div>
                <div id="torFileProgV96_${f.index}" style="color:#8b949e;font-size:10px;margin-top:2px;">💾 ${mb} MB • Нажми ▶ для потока или ⬇️ для закачки</div>
            </div>
            <button type="button" class="tor-prev-btn-v97" onclick="window.previewTorrentFileStreamV97(${f.index}, this, event)" title="Слушать в потоке прямо сейчас" style="padding:4px 8px;font-size:11px;background:#161b22;color:#58a6ff;border:1px solid #30363d;">▶</button>
        </div>`;
    }).join('');
};

window.startSelectedTorrentDownloadV96 = async function() {
    const hash = window._torStateV96.currentHash;
    const files = Array.from(window._torStateV96.selectedFiles);
    if (!hash || !files.length) return;
    const totWrap = document.getElementById('torTotalProgWrapV97');
    const totFill = document.getElementById('torTotalProgFillV97');
    if (totWrap) totWrap.style.display = 'block';

    await fetch('/api/torrent/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash, files }) });
    if (window._torStateV96.pollTimer) clearInterval(window._torStateV96.pollTimer);
    window._torStateV96.pollTimer = setInterval(async () => {
        try {
            const d = await (await fetch('/api/torrent/status')).json();
            const tor = (d.torrents || []).find(x => x.hash === hash);
            if (!tor) return;
            let sumLen = 0, sumDone = 0;
            for (const f of (tor.files || [])) {
                sumLen += (f.length || 0);
                sumDone += (f.completed || 0);
                const rowEl = document.getElementById('torFileRowV96_' + f.index);
                const pEl = document.getElementById('torFileProgV96_' + f.index);
                const pct = Math.max(0, Math.min(100, f.percent || 0));
                const doneMb = (f.completed / (1024 * 1024)).toFixed(1);
                const totMb = (f.length / (1024 * 1024)).toFixed(1);

                // Визуальная заливка карточки трека по мере прогресса!
                if (rowEl) {
                    const clr = f.xflac_file ? 'rgba(63,185,80,0.28)' : 'rgba(137,87,229,0.32)';
                    rowEl.style.background = `linear-gradient(90deg, ${clr} ${pct}%, #0b0f16 ${pct}%)`;
                    if (f.done) rowEl.style.borderColor = 'rgba(63,185,80,0.65)';
                }
                if (pEl) {
                    pEl.innerText = f.xflac_file
                        ? `✅ В плеере: ${f.xflac_file}`
                        : `⬇️ ${doneMb} / ${totMb} MB (${pct}%)`;
                }
                const impKey = `${hash}_${f.index}`;
                if (f.done && !f.xflac_file && !window._torStateV96.importedSet.has(impKey)) {
                    window._torStateV96.importedSet.add(impKey);
                    if (pEl) pEl.innerText = `🧬 Сжатие в .xFLAC...`;
                    fetch('/api/torrent/import_track', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ hash, index: f.index, full_path: f.full_path, torrent_name: tor.name, format_mode: 'xflac_psycho' })
                    }).then(r => r.json()).then(res => {
                        if (res.status === 'ok') {
                            if (pEl) pEl.innerText = `✅ В плеере: ${res.filename} (${res.size_mb} MB)`;
                            if (typeof window.fetchData === 'function') window.fetchData();
                        }
                    });
                }
            }
            const totalPct = sumLen > 0 ? Math.round((sumDone * 100) / sumLen) : 0;
            const sumDoneMb = (sumDone / (1024 * 1024)).toFixed(1);
            const sumTotMb = (sumLen / (1024 * 1024)).toFixed(1);
            if (totFill) totFill.style.width = totalPct + '%';
            const stEl = document.getElementById('torStatusLineV96');
            if (stEl) stEl.innerText = `🧲 Сидов: ${tor.seeders} • Пиров: ${tor.peers} • Общий прогресс: ${sumDoneMb}/${sumTotMb} MB (${totalPct}%)`;
        } catch (e) {}
    }, 900);
};

// === 🚀 JENNY V98: SINGLE-TRACK TORRENT DL BUTTON + UNIVERSAL MINI-PLAYER + MAIN PAGE XFLAC BANNER ===

// 1. Универсальный мини-плеер с перемоткой для всех модальных студий (SoundCloud, Торрент, OST/Архивы)
window.ensureModalMiniPlayerV98 = function(modalId, insertAfterEl) {
    const m = document.getElementById(modalId);
    if (!m) return null;
    let bar = m.querySelector('.jenny-univ-mini-player-v98');
    if (!bar) {
        bar = document.createElement('div');
        bar.className = 'jenny-univ-mini-player-v98';
        bar.style.cssText = 'display:none;flex-direction:column;gap:4px;padding:7px 12px;background:#0b111b;border-bottom:1px solid #3fb950;';
        bar.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <span class="ump-title" style="font-size:11px;color:#3fb950;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">🎧 Предпрослушка</span>
                <span style="font-size:10px;color:#8b949e;">🔉 -30% от осн.</span>
                <button type="button" class="ump-play-btn" onclick="window.toggleKhMiniPlayPauseV90()" style="padding:2px 8px;font-size:11px;background:#161b22;border:1px solid #30363d;color:#fff;border-radius:6px;">⏸</button>
                <button type="button" onclick="window.stopAllExternalStreamsV97()" style="padding:2px 7px;font-size:10px;background:rgba(248,81,73,0.18);border:1px solid #f85149;color:#ff7b72;border-radius:6px;">✖</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <span class="ump-cur" style="font-size:10px;color:#8b949e;min-width:28px;">0:00</span>
                <input type="range" class="ump-seek" min="0" max="1000" value="0" oninput="window.seekKhMiniPlayerV90(this.value)" style="flex:1;height:4px;accent-color:#3fb950;">
                <span class="ump-dur" style="font-size:10px;color:#8b949e;min-width:28px;text-align:right;">0:00</span>
            </div>
        `;
        if (insertAfterEl && insertAfterEl.parentNode) {
            insertAfterEl.parentNode.insertBefore(bar, insertAfterEl.nextSibling);
        }
    }
    return bar;
};

window.bindAudioToAllMiniPlayersV98 = function(aud, titleText) {
    // Вставляем мини-плеер в SoundCloud и Торрент, если его там ещё нет
    const scBody = document.getElementById('scDedicatedBodyV93');
    if (scBody && scBody.previousElementSibling) window.ensureModalMiniPlayerV98('jennySoundCloudModalV93', scBody.previousElementSibling);
    const torBody = document.getElementById('torBodyListV96');
    if (torBody && torBody.previousElementSibling) window.ensureModalMiniPlayerV98('jennyTorrentModalV91', torBody.previousElementSibling);

    document.querySelectorAll('.jenny-univ-mini-player-v98').forEach(b => {
        b.style.display = 'flex';
        const t = b.querySelector('.ump-title');
        if (t) t.innerText = `🎧 ${titleText}`;
        const pBtn = b.querySelector('.ump-play-btn');
        if (pBtn) pBtn.innerText = '⏸';
    });

    const origTimeUpdate = aud.ontimeupdate;
    aud.ontimeupdate = () => {
        if (typeof origTimeUpdate === 'function') origTimeUpdate();
        const curStr = window.fmtKhSecV90(aud.currentTime);
        const durStr = isFinite(aud.duration) ? window.fmtKhSecV90(aud.duration) : 'Поток';
        const pct = (isFinite(aud.duration) && aud.duration > 0) ? Math.round((aud.currentTime / aud.duration) * 1000) : 0;
        document.querySelectorAll('.jenny-univ-mini-player-v98').forEach(b => {
            const cEl = b.querySelector('.ump-cur');
            const dEl = b.querySelector('.ump-dur');
            const sEl = b.querySelector('.ump-seek');
            if (cEl) cEl.innerText = curStr;
            if (dEl) dEl.innerText = durStr;
            if (sEl && pct > 0) sEl.value = pct;
        });
    };
};

const _origStopAllV97 = window.stopAllExternalStreamsV97;
window.stopAllExternalStreamsV97 = function() {
    _origStopAllV97.apply(this, arguments);
    document.querySelectorAll('.jenny-univ-mini-player-v98').forEach(b => { b.style.display = 'none'; });
};

const _origPreviewKhV88 = window.previewKhTrackV88;
window.previewKhTrackV88 = async function(trackIdx, btnEl, ev) {
    await _origPreviewKhV88.apply(this, arguments);
    const aud = window._khStateV88 ? window._khStateV88.previewAudio : null;
    const alb = window._khStateV88 ? window._khStateV88.currentAlbum : null;
    const t = alb && alb.tracks ? alb.tracks.find(x => x.index === trackIdx) : null;
    if (aud && t) window.bindAudioToAllMiniPlayersV98(aud, `${t.index}. ${t.title}`);
};

window.previewTorrentFileStreamV97 = async function(fileIdx, btnEl, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const hash = window._torStateV96.currentHash;
    if (!hash) return;
    const streamUrl = `/api/torrent/stream/${hash}/${fileIdx}`;
    const curAud = window._khStateV88.previewAudio;
    if (curAud && curAud._pagePath === streamUrl) {
        window.stopAllExternalStreamsV97();
        return;
    }
    window.stopAllExternalStreamsV97();
    window.pauseMainPlayerForOstV90();
    const myReqId = ++window._previewReqIdV97;
    if (btnEl) btnEl.innerText = '⏳';

    const fObj = (window._torStateV96.files || []).find(x => x.index === fileIdx);
    const titleStr = fObj ? fObj.path : `Track #${fileIdx}`;
    const aud = new Audio(streamUrl);
    aud._pagePath = streamUrl;
    aud.volume = window.getKhPreviewVolumeV90();
    window._khStateV88.previewAudio = aud;
    window.bindAudioToAllMiniPlayersV98(aud, titleStr);

    aud.onended = () => { if (btnEl) btnEl.innerText = '▶'; };
    try {
        await aud.play();
        if (myReqId !== window._previewReqIdV97) { aud.pause(); return; }
        if (btnEl) btnEl.innerText = '⏹';
    } catch (e) {
        if (btnEl) btnEl.innerText = '▶';
        if (typeof window.showToast === 'function') window.showToast('⏳ Пиры подключаются к началу трека, нажми ▶ ещё раз через 2 сек');
    }
};

// 2. Индивидуальная кнопка ⬇️ напротив каждого трека в Торрент-студии (качает по 1 треку в одно касание!)
window.downloadSingleTorrentTrackV98 = async function(fileIdx, btnEl, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const hash = window._torStateV96.currentHash;
    if (!hash) return;
    window._torStateV96.selectedFiles.add(fileIdx);
    const chk = document.querySelector(`#torFileRowV96_${fileIdx} input[type="checkbox"]`);
    if (chk) chk.checked = true;
    if (btnEl) { btnEl.innerText = '⏳'; btnEl.style.color = '#3fb950'; }
    await window.startSelectedTorrentDownloadV96([fileIdx]);
};

window.renderTorrentFilesListV96 = function() {
    const body = document.getElementById('torBodyListV96');
    const ftr = document.getElementById('torFooterBarV96');
    if (!body) return;
    if (ftr) {
        ftr.style.flexDirection = 'column';
        ftr.innerHTML = `
            <div id="torTotalProgWrapV97" style="display:none;width:100%;height:8px;background:#161b22;border-radius:6px;overflow:hidden;border:1px solid #30363d;">
                <div id="torTotalProgFillV97" style="width:0%;height:100%;background:linear-gradient(90deg,#8957e5,#3fb950);transition:width 0.3s ease;"></div>
            </div>
            <div style="display:flex;gap:6px;width:100%;">
                <button type="button" onclick="window.backToTorrentSearchListV97()" style="padding:8px 10px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;border-radius:8px;font-weight:bold;font-size:11.5px;">⬅ Раздачи</button>
                <button type="button" onclick="window._torStateV96.selectedFiles=new Set();window.renderTorrentFilesListV96();" style="padding:8px 8px;background:#161b22;color:#8b949e;border:1px solid #30363d;border-radius:8px;font-size:11px;">Снять все</button>
                <button type="button" id="btnTorStartDlV97" onclick="window.startSelectedTorrentDownloadV96()" style="flex:1;padding:8px 10px;background:linear-gradient(135deg,#8957e5,#238636);color:#fff;border:none;border-radius:8px;font-weight:bold;font-size:11.5px;">⬇️ Качать выбранные (➔ xFLAC)</button>
            </div>
        `;
    }
    body.innerHTML = window._torStateV96.files.map(f => {
        const chk = window._torStateV96.selectedFiles.has(f.index) ? 'checked' : '';
        const mb = (f.length / (1024 * 1024)).toFixed(1);
        return `<div id="torFileRowV96_${f.index}" style="display:flex;align-items:center;gap:6px;padding:7px 9px;background:#0b0f16;border:1px solid #21262d;border-radius:8px;transition:background 0.25s ease;">
            <input type="checkbox" ${chk} onchange="if(this.checked) window._torStateV96.selectedFiles.add(${f.index}); else window._torStateV96.selectedFiles.delete(${f.index});">
            <div style="flex:1;min-width:0;">
                <div style="color:#e6edf3;font-size:11.5px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.path}</div>
                <div id="torFileProgV96_${f.index}" style="color:#8b949e;font-size:10px;margin-top:2px;">💾 ${mb} MB • ▶ Поток или ⬇️ Скачать</div>
            </div>
            <button type="button" class="tor-prev-btn-v97" onclick="window.previewTorrentFileStreamV97(${f.index}, this, event)" title="Слушать в потоке" style="padding:4px 8px;font-size:11px;background:#161b22;color:#58a6ff;border:1px solid #30363d;">▶</button>
            <button type="button" id="torDlSingleBtnV98_${f.index}" onclick="window.downloadSingleTorrentTrackV98(${f.index}, this, event)" title="Скачать этот трек в xFLAC" style="padding:4px 8px;font-size:11px;background:rgba(63,185,80,0.16);color:#3fb950;border:1px solid rgba(63,185,80,0.6);">⬇️</button>
        </div>`;
    }).join('');
};

// Поочерёдный импорт докачанных файлов торрента (без 21 параллельного вызова!)
window._torImportBusyV98 = false;
window.startSelectedTorrentDownloadV96 = async function(explicitFiles) {
    const hash = window._torStateV96.currentHash;
    const files = explicitFiles || Array.from(window._torStateV96.selectedFiles);
    if (!hash || !files.length) return;
    const totWrap = document.getElementById('torTotalProgWrapV97');
    const totFill = document.getElementById('torTotalProgFillV97');
    if (totWrap) totWrap.style.display = 'block';

    await fetch('/api/torrent/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash, files: Array.from(window._torStateV96.selectedFiles) }) });
    if (window._torStateV96.pollTimer) clearInterval(window._torStateV96.pollTimer);
    window._torStateV96.pollTimer = setInterval(async () => {
        try {
            const d = await (await fetch('/api/torrent/status')).json();
            const tor = (d.torrents || []).find(x => x.hash === hash);
            if (!tor) return;
            let sumLen = 0, sumDone = 0;
            for (const f of (tor.files || [])) {
                sumLen += (f.length || 0);
                sumDone += (f.completed || 0);
                const rowEl = document.getElementById('torFileRowV96_' + f.index);
                const pEl = document.getElementById('torFileProgV96_' + f.index);
                const dlBtn = document.getElementById('torDlSingleBtnV98_' + f.index);
                const pct = Math.max(0, Math.min(100, f.percent || 0));
                const doneMb = (f.completed / (1024 * 1024)).toFixed(1);
                const totMb = (f.length / (1024 * 1024)).toFixed(1);

                if (rowEl) {
                    const clr = f.xflac_file ? 'rgba(63,185,80,0.28)' : 'rgba(137,87,229,0.32)';
                    rowEl.style.background = `linear-gradient(90deg, ${clr} ${pct}%, #0b0f16 ${pct}%)`;
                }
                if (f.xflac_file) {
                    if (pEl) pEl.innerText = `✅ В плеере: ${f.xflac_file}`;
                    if (dlBtn) dlBtn.innerText = '✅';
                } else if (pEl) {
                    pEl.innerText = f.done ? `⏳ В очереди сжатия xFLAC...` : `⬇️ ${doneMb} / ${totMb} MB (${pct}%)`;
                }

                const impKey = `${hash}_${f.index}`;
                if (f.done && !f.xflac_file && !window._torStateV96.importedSet.has(impKey) && !window._torImportBusyV98) {
                    window._torStateV96.importedSet.add(impKey);
                    window._torImportBusyV98 = true;
                    if (pEl) pEl.innerText = `🧬 Сжимаем в .xFLAC...`;
                    window.showMainPageEncodingBannerV98(`🧬 Сжатие в xFLAC: ${f.path}...`);
                    fetch('/api/torrent/import_track', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ hash, index: f.index, full_path: f.full_path, torrent_name: tor.name, format_mode: 'xflac_psycho' })
                    }).then(r => r.json()).then(res => {
                        if (res.status === 'ok') {
                            if (pEl) pEl.innerText = `✅ В плеере: ${res.filename} (${res.size_mb} MB)`;
                            if (dlBtn) dlBtn.innerText = '✅';
                            if (typeof window.fetchData === 'function') window.fetchData();
                        }
                    }).finally(() => {
                        window._torImportBusyV98 = false;
                        window.showMainPageEncodingBannerV98('');
                    });
                }
            }
            const totalPct = sumLen > 0 ? Math.round((sumDone * 100) / sumLen) : 0;
            if (totFill) totFill.style.width = totalPct + '%';
            const stEl = document.getElementById('torStatusLineV96');
            if (stEl) stEl.innerText = `🧲 Сидов: ${tor.seeders} • Пиров: ${tor.peers} • Загрузка: ${totalPct}%`;
        } catch (e) {}
    }, 900);
};

// 3. Наглядная плашка на ГЛАВНОЙ СТРАНИЦЕ плеера, когда в фоне идёт кодирование в xFLAC
window.showMainPageEncodingBannerV98 = function(msgText) {
    let b = document.getElementById('jennyMainXflacBannerV98');
    if (!b) {
        const searchRow = document.getElementById('searchInput');
        const parent = searchRow ? searchRow.parentElement : null;
        if (!parent || !parent.parentElement) return;
        b = document.createElement('div');
        b.id = 'jennyMainXflacBannerV98';
        b.style.cssText = 'display:none;margin:4px 0 6px 0;padding:6px 12px;border-radius:10px;background:linear-gradient(90deg,rgba(137,87,229,0.28),rgba(63,185,80,0.25));border:1px solid #a371f7;color:#e6edf3;font-size:11.5px;font-weight:bold;align-items:center;justify-content:space-between;';
        parent.parentElement.insertBefore(b, parent.nextSibling);
    }
    if (!msgText) {
        b.style.display = 'none';
    } else {
        b.style.display = 'flex';
        b.innerHTML = `<span>${msgText}</span><span style="color:#3fb950;font-size:10px;">C++ libxflac</span>`;
    }
};

// === 📊 JENNY V99: ICON PERCENT BADGES + XFLAC TRANSCODE PROGRESS + EXACT/ZERO-SEED TORRENT FILTERS ===
window._torStateV96 = Object.assign(window._torStateV96 || {}, {
    onlyFlac: true, exactSearch: false, hideZeroSeeds: true,
    dlOverallPct: 0, dlActive: false
});

window._sourceBadgesV99 = { ost: '', archive: '', radio: '', soundcloud: '', torrent: '' };

// Обновляет бейдж с процентом прямо на иконке каждого источника в шапке плеера и в выпадающем меню!
window.applyHeaderIconBadgeV99 = function(srcId, badgeText) {
    window._sourceBadgesV99[srcId] = badgeText || '';
    const btnId = (srcId === 'ost') ? 'btnKhinsiderOstV88' : `btnPinnedSrc_${srcId}_V91`;
    const btn = document.getElementById(btnId);
    const catItem = (window.SOURCES_CATALOG_V91 || []).find(x => x.id === srcId);
    if (!btn || !catItem) return;
    if (badgeText) {
        btn.style.width = 'auto';
        btn.style.padding = '0 6px';
        btn.style.gap = '3px';
        btn.innerHTML = `${catItem.svg}<span style="font-size:10px;font-weight:900;color:#3fb950;font-family:monospace;">${badgeText}</span>`;
    } else {
        btn.style.width = '32px';
        btn.style.padding = '0';
        btn.innerHTML = catItem.svg;
    }
};

// Перехватываем старый бейдж OST, чтобы он шёл в нужную кнопку (🎮 OST или 🏛️ Архивы)
window.updateKhHeaderBtnBadgeV89 = function(text, isBusy) {
    const mode = (window._khStateV88 && window._khStateV88.currentSourceMode) || 'ost';
    if (mode === 'archive') {
        window.applyHeaderIconBadgeV99('archive', isBusy ? text : '');
        window.applyHeaderIconBadgeV99('ost', '');
    } else {
        window.applyHeaderIconBadgeV99('ost', isBusy ? text : '');
        window.applyHeaderIconBadgeV99('archive', '');
    }
};

// Фоновый пуллер бейджей для всех 5 источников и плашки пережатия xFLAC
setInterval(async () => {
    try {
        const res = await fetch('/api/sources/live_badges');
        if (!res.ok) return;
        const b = await res.json();

        // 1. Радиоэфир
        if (b.radio && b.radio.active) {
            window.applyHeaderIconBadgeV99('radio', `${b.radio.sec}с`);
        } else {
            window.applyHeaderIconBadgeV99('radio', '');
        }

        // 2. SoundCloud
        if (b.soundcloud && b.soundcloud.active) {
            window.applyHeaderIconBadgeV99('soundcloud', `${b.soundcloud.pct}%`);
            const scBtn = document.querySelector('#jennySoundCloudModalV93 button[disabled]');
            if (scBtn) scBtn.innerText = `⏳ ${b.soundcloud.pct}%`;
        } else {
            window.applyHeaderIconBadgeV99('soundcloud', '');
        }

        // 3. Торрент (Загрузка + Пережатие в xFLAC)
        const te = b.torrent_enc || {};
        const ts = window._torStateV96 || {};
        if (te.active) {
            window.applyHeaderIconBadgeV99('torrent', `🧬${te.overall_pct}%`);
            window.showMainPageEncodingBannerV98(
                `🧬 Пережатие в xFLAC [${te.done_count + 1}/${Math.max(1, te.total_count)}]: ${te.current_track} (${te.track_pct}%)`,
                te.overall_pct
            );
        } else if (ts.dlActive && ts.dlOverallPct < 100) {
            window.applyHeaderIconBadgeV99('torrent', `${ts.dlOverallPct}%`);
            window.showMainPageEncodingBannerV98('', 0);
        } else {
            window.applyHeaderIconBadgeV99('torrent', '');
            window.showMainPageEncodingBannerV98('', 0);
        }
    } catch (e) {}
}, 750);

// Улучшенная плашка пережатия xFLAC на главной странице с полосой заполнения
window.showMainPageEncodingBannerV98 = function(msgText, pctVal) {
    let b = document.getElementById('jennyMainXflacBannerV98');
    if (!b) {
        const searchRow = document.getElementById('searchInput');
        const parent = searchRow ? searchRow.parentElement : null;
        if (!parent || !parent.parentElement) return;
        b = document.createElement('div');
        b.id = 'jennyMainXflacBannerV98';
        b.style.cssText = 'display:none;margin:4px 0 6px 0;padding:6px 12px;border-radius:10px;border:1px solid #a371f7;color:#e6edf3;font-size:11.5px;font-weight:bold;align-items:center;justify-content:space-between;transition:background 0.25s ease;';
        parent.parentElement.insertBefore(b, parent.nextSibling);
    }
    if (!msgText) {
        b.style.display = 'none';
    } else {
        const p = Math.max(0, Math.min(100, pctVal || 0));
        b.style.display = 'flex';
        b.style.background = `linear-gradient(90deg, rgba(63,185,80,0.35) ${p}%, rgba(137,87,229,0.22) ${p}%)`;
        b.innerHTML = `<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:8px;">${msgText}</span><span style="color:#3fb950;font-size:10.5px;flex-shrink:0;">Общий: ${p}%</span>`;
    }
};

// Переключатели «🎯 Точный поиск», «🚫 Без 0 сидов» и «💎 Только FLAC» в Торрент-студии
window.toggleTorrentFilterPillV99 = function(key) {
    window._torStateV96[key] = !window._torStateV96[key];
    window.renderTorrentFilterBarV99();
    if (!document.getElementById('torFooterBarV96') || document.getElementById('torFooterBarV96').style.display === 'none') {
        window.runTorrentActionV96();
    }
};

window.renderTorrentFilterBarV99 = function() {
    const m = document.getElementById('jennyTorrentModalV91');
    if (!m) return;
    let bar = document.getElementById('torFilterPillsBarV99');
    if (!bar) {
        const stLine = document.getElementById('torStatusLineV96');
        if (!stLine || !stLine.parentNode) return;
        bar = document.createElement('div');
        bar.id = 'torFilterPillsBarV99';
        bar.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;margin:2px 0;';
        stLine.parentNode.insertBefore(bar, stLine);
    }
    const ts = window._torStateV96;
    const mkPill = (k, icon, label, activeColor) => {
        const on = Boolean(ts[k]);
        return `<button type="button" onclick="window.toggleTorrentFilterPillV99('${k}')" style="padding:4px 8px;font-size:10.5px;border-radius:8px;font-weight:bold;background:${on ? 'rgba(63,185,80,0.2)' : '#11161f'};border:1px solid ${on ? activeColor : '#30363d'};color:${on ? activeColor : '#8b949e'};display:inline-flex;align-items:center;gap:4px;"><span>${on ? '☑️' : '⬜'}</span><span>${icon} ${label}</span></button>`;
    };
    bar.innerHTML =
        mkPill('exactSearch', '🎯', 'Точный поиск', '#58a6ff') +
        mkPill('hideZeroSeeds', '🚫', 'Скрыть 0 сидов', '#3fb950') +
        mkPill('onlyFlac', '💎', 'Только FLAC', '#d2a8ff');
};

const _origOpenTorV91 = window.openTorrentHubPreviewModalV91;
window.openTorrentHubPreviewModalV91 = function(ev) {
    _origOpenTorV91.call(this, ev);
    window.renderTorrentFilterBarV99();
};

window.runTorrentActionV96 = async function() {
    window.renderTorrentFilterBarV99();
    const inp = document.getElementById('torMagnetInpV91');
    const body = document.getElementById('torBodyListV96');
    const ftr = document.getElementById('torFooterBarV96');
    const stEl = document.getElementById('torStatusLineV96');
    if (!inp || !body) return;
    const val = inp.value.trim();
    if (!val) return;
    if (val.toLowerCase().startsWith('magnet:?')) {
        await window.openMagnetInGoEngineV96(val);
        return;
    }
    if (ftr) ftr.style.display = 'none';
    body.innerHTML = `<div style="color:#d2a8ff;text-align:center;padding:30px 10px;">⏳ Поиск раздач «${val}»...</div>`;
    try {
        const ts = window._torStateV96;
        const res = await fetch('/api/torrent/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: val, only_flac: ts.onlyFlac, exact: ts.exactSearch, hide_zero: ts.hideZeroSeeds })
        });
        const d = await res.json();
        const list = d.results || [];
        const hidZero = d.hidden_zero || 0;
        if (stEl) {
            stEl.innerText = `📋 Найдено живых раздач: ${list.length}` + (hidZero > 0 ? ` (скрыто с 0 сидов: ${hidZero})` : '');
        }
        if (!list.length) {
            body.innerHTML = `<div style="color:#8b949e;text-align:center;padding:25px;">По выбранным фильтрам раздач нет${hidZero > 0 ? ` (скрыто ${hidZero} раздач с 0 сидов)` : ''}. Попробуй отключить «🎯 Точный поиск» или «💎 Только FLAC».</div>`;
            return;
        }
        window._torSearchResultsV96 = list;
        body.innerHTML = list.map((r, i) => `<div onclick="window.openMagnetInGoEngineV96(window._torSearchResultsV96[${i}].magnet)" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0d1117;border:1px solid #262c36;border-radius:9px;cursor:pointer;">
            <div style="flex:1;min-width:0;">
                <div style="color:#e6edf3;font-size:12px;font-weight:bold;">${r.title}</div>
                <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${r.size_mb} MB • <span style="color:${r.seeders > 0 ? '#3fb950' : '#ff7b72'};font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
            </div>
            <span style="color:#d2a8ff;font-size:11px;font-weight:bold;">Открыть ➔</span>
        </div>`).join('');
    } catch (e) {
        body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:20px;">❌ ${e.message || e}</div>`;
    }
};

// В футере Торрент-студии добавляем вторую полосу прогресса специально для пережатия в xFLAC!
const _origRenderTorFilesV96 = window.renderTorrentFilesListV96;
window.renderTorrentFilesListV96 = function() {
    _origRenderTorFilesV96.apply(this, arguments);
    const ftr = document.getElementById('torFooterBarV96');
    if (ftr && !document.getElementById('torXflacProgWrapV99')) {
        const encBar = document.createElement('div');
        encBar.id = 'torXflacProgWrapV99';
        encBar.style.cssText = 'display:none;flex-direction:column;gap:2px;width:100%;';
        encBar.innerHTML = `
            <div id="torXflacProgLabelV99" style="font-size:10px;color:#3fb950;font-weight:bold;">🧬 Пережатие в xFLAC: 0%</div>
            <div style="width:100%;height:7px;background:#161b22;border-radius:6px;overflow:hidden;border:1px solid #3fb950;">
                <div id="torXflacProgFillV99" style="width:0%;height:100%;background:linear-gradient(90deg,#3fb950,#58a6ff);transition:width 0.2s ease;"></div>
            </div>
        `;
        ftr.insertBefore(encBar, ftr.firstChild);
    }
};

// Обновлённый цикл опроса Торрента: отображает и прогресс скачивания, и живой процент пережатия каждого трека в xFLAC
window.startSelectedTorrentDownloadV96 = async function(explicitFiles) {
    const hash = window._torStateV96.currentHash;
    const files = explicitFiles || Array.from(window._torStateV96.selectedFiles);
    if (!hash || !files.length) return;
    const totWrap = document.getElementById('torTotalProgWrapV97');
    const totFill = document.getElementById('torTotalProgFillV97');
    if (totWrap) totWrap.style.display = 'block';
    window._torStateV96.dlActive = true;

    const allSel = Array.from(window._torStateV96.selectedFiles);
    await fetch('/api/torrent/queue_plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total: allSel.length, done: 0 })
    });
    await fetch('/api/torrent/download', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, files: allSel })
    });

    if (window._torStateV96.pollTimer) clearInterval(window._torStateV96.pollTimer);
    window._torStateV96.pollTimer = setInterval(async () => {
        try {
            const [d, badges] = await Promise.all([
                fetch('/api/torrent/status').then(r => r.json()),
                fetch('/api/sources/live_badges').then(r => r.json())
            ]);
            const tor = (d.torrents || []).find(x => x.hash === hash);
            if (!tor) return;
            const te = (badges && badges.torrent_enc) || {};

            const encWrap = document.getElementById('torXflacProgWrapV99');
            const encLbl = document.getElementById('torXflacProgLabelV99');
            const encFill = document.getElementById('torXflacProgFillV99');
            if (encWrap) {
                if (te.active || (te.done_count > 0 && te.done_count < te.total_count)) {
                    encWrap.style.display = 'flex';
                    if (encLbl) encLbl.innerText = `🧬 Пережатие в xFLAC [${te.done_count}/${te.total_count}]: ${te.current_track || '...'} (${te.track_pct || 0}% • Общий: ${te.overall_pct || 0}%)`;
                    if (encFill) encFill.style.width = (te.overall_pct || 0) + '%';
                } else if (te.total_count > 0 && te.done_count >= te.total_count) {
                    encWrap.style.display = 'flex';
                    if (encLbl) encLbl.innerText = `✅ Все выбранные треки (${te.done_count}/${te.total_count}) сжаты в .xFLAC!`;
                    if (encFill) encFill.style.width = '100%';
                }
            }

            let sumLen = 0, sumDone = 0;
            for (const f of (tor.files || [])) {
                sumLen += (f.length || 0);
                sumDone += (f.completed || 0);
                const impKey = `${hash}_${f.index}`;
                const rowEl = document.getElementById('torFileRowV96_' + f.index);
                const pEl = document.getElementById('torFileProgV96_' + f.index);
                const dlBtn = document.getElementById('torDlSingleBtnV98_' + f.index);
                const pct = Math.max(0, Math.min(100, f.percent || 0));
                const doneMb = (f.completed / (1024 * 1024)).toFixed(1);
                const totMb = (f.length / (1024 * 1024)).toFixed(1);

                const isCurrentlyEncoding = (te.active && te.current_key === impKey);

                if (rowEl) {
                    if (f.xflac_file) {
                        rowEl.style.background = 'linear-gradient(90deg, rgba(63,185,80,0.28) 100%, #0b0f16 100%)';
                        rowEl.style.borderColor = 'rgba(63,185,80,0.65)';
                    } else if (isCurrentlyEncoding) {
                        const ep = te.track_pct || 10;
                        rowEl.style.background = `linear-gradient(90deg, rgba(63,185,80,0.38) ${ep}%, rgba(137,87,229,0.25) ${ep}%)`;
                        rowEl.style.borderColor = '#3fb950';
                    } else {
                        rowEl.style.background = `linear-gradient(90deg, rgba(137,87,229,0.32) ${pct}%, #0b0f16 ${pct}%)`;
                    }
                }

                if (f.xflac_file) {
                    if (pEl) pEl.innerText = `✅ В плеере: ${f.xflac_file}`;
                    if (dlBtn) dlBtn.innerText = '✅';
                } else if (isCurrentlyEncoding) {
                    if (pEl) pEl.innerText = `🧬 Сжатие в .xFLAC: ${te.track_pct || 0}% (трек ${te.done_count + 1} из ${te.total_count})`;
                } else if (pEl) {
                    pEl.innerText = f.done
                        ? `⏳ Очередь сжатия xFLAC (готово ${te.done_count}/${te.total_count})...`
                        : `⬇️ Скачивание: ${doneMb} / ${totMb} MB (${pct}%)`;
                }

                if (f.done && !f.xflac_file && !window._torStateV96.importedSet.has(impKey) && !window._torImportBusyV98) {
                    window._torStateV96.importedSet.add(impKey);
                    window._torImportBusyV98 = true;
                    fetch('/api/torrent/import_track', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ hash, index: f.index, full_path: f.full_path, torrent_name: tor.name, format_mode: 'xflac_psycho' })
                    }).then(r => r.json()).then(res => {
                        if (res.status === 'ok') {
                            if (pEl) pEl.innerText = `✅ В плеере: ${res.filename} (${res.size_mb} MB)`;
                            if (dlBtn) dlBtn.innerText = '✅';
                            if (typeof window.fetchData === 'function') window.fetchData();
                        }
                    }).finally(() => {
                        window._torImportBusyV98 = false;
                    });
                }
            }
            const totalPct = sumLen > 0 ? Math.round((sumDone * 100) / sumLen) : 0;
            window._torStateV96.dlOverallPct = totalPct;
            if (totFill) totFill.style.width = totalPct + '%';
            const stEl = document.getElementById('torStatusLineV96');
            if (stEl) {
                stEl.innerText = `🧲 Сидов: ${tor.seeders} • Пиров: ${tor.peers} • Сеть: ${totalPct}%` +
                    (te.total_count > 0 ? ` • xFLAC: ${te.done_count}/${te.total_count} (${te.overall_pct || 0}%)` : '');
            }
        } catch (e) {}
    }, 750);
};

// === 🏷️ JENNY V101: TORRENT AUDIO FORMAT TAGS STRIP (ALL, FLAC, WAV, MP3, M4A, AAC, OGG) ===
window._torStateV96 = Object.assign(window._torStateV96 || {}, {
    formatTag: 'all', // 'all' | 'flac' | 'wav' | 'mp3' | 'm4a' | 'aac' | 'ogg'
    exactSearch: false,
    hideZeroSeeds: true
});

window.TORRENT_FORMAT_TAGS_V101 = [
    { id: 'all',  label: '🌐 ВСЕ',  color: '#58a6ff' },
    { id: 'flac', label: '💎 FLAC', color: '#3fb950' },
    { id: 'wav',  label: '💿 WAV',  color: '#3fb950' },
    { id: 'mp3',  label: '🎵 MP3',  color: '#e3b341' },
    { id: 'm4a',  label: '🍏 M4A',  color: '#79c0ff' },
    { id: 'aac',  label: '⚡ AAC',  color: '#ff8c42' },
    { id: 'ogg',  label: '🌀 OGG',  color: '#d2a8ff' }
];

window.selectTorrentFormatTagV101 = function(tagId) {
    if (window._torStateV96.formatTag === tagId && tagId !== 'all') {
        window._torStateV96.formatTag = 'all';
    } else {
        window._torStateV96.formatTag = tagId;
    }
    window.renderTorrentFilterBarV99();
    if (!document.getElementById('torFooterBarV96') || document.getElementById('torFooterBarV96').style.display === 'none') {
        window.runTorrentActionV96();
    }
};

window.renderTorrentFilterBarV99 = function() {
    const m = document.getElementById('jennyTorrentModalV91');
    if (!m) return;
    let bar = document.getElementById('torFilterPillsBarV99');
    if (!bar) {
        const stLine = document.getElementById('torStatusLineV96');
        if (!stLine || !stLine.parentNode) return;
        bar = document.createElement('div');
        bar.id = 'torFilterPillsBarV99';
        bar.style.cssText = 'display:flex;flex-direction:column;gap:5px;margin:2px 0;';
        stLine.parentNode.insertBefore(bar, stLine);
    }
    const ts = window._torStateV96;
    const mkCheck = (k, icon, label, activeColor) => {
        const on = Boolean(ts[k]);
        return `<button type="button" onclick="window.toggleTorrentFilterPillV99('${k}')" style="flex:1;padding:4px 8px;font-size:10.5px;border-radius:8px;font-weight:bold;background:${on ? 'rgba(63,185,80,0.18)' : '#11161f'};border:1px solid ${on ? activeColor : '#30363d'};color:${on ? activeColor : '#8b949e'};display:inline-flex;align-items:center;justify-content:center;gap:4px;"><span>${on ? '☑️' : '⬜'}</span><span>${icon} ${label}</span></button>`;
    };

    const curTag = ts.formatTag || 'all';
    const tagsHtml = window.TORRENT_FORMAT_TAGS_V101.map(t => {
        const act = (curTag === t.id);
        return `<button type="button" onclick="window.selectTorrentFormatTagV101('${t.id}')" style="padding:4px 9px;font-size:10.5px;border-radius:10px;font-weight:900;flex-shrink:0;background:${act ? 'rgba(88,166,255,0.22)' : '#0d1117'};border:1.5px solid ${act ? t.color : '#262c36'};color:${act ? t.color : '#8b949e'};box-shadow:${act ? '0 0 8px rgba(88,166,255,0.25)' : 'none'};">${t.label}</button>`;
    }).join('');

    bar.innerHTML = `
        <div style="display:flex;gap:6px;width:100%;">
            ${mkCheck('exactSearch', '🎯', 'Точный поиск', '#58a6ff')}
            ${mkCheck('hideZeroSeeds', '🚫', 'Скрыть 0 сидов', '#3fb950')}
        </div>
        <div style="display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;">
            ${tagsHtml}
        </div>
    `;
};

window.runTorrentActionV96 = async function() {
    window.renderTorrentFilterBarV99();
    const inp = document.getElementById('torMagnetInpV91');
    const body = document.getElementById('torBodyListV96');
    const ftr = document.getElementById('torFooterBarV96');
    const stEl = document.getElementById('torStatusLineV96');
    if (!inp || !body) return;
    const val = inp.value.trim();
    if (!val) return;
    if (val.toLowerCase().startsWith('magnet:?')) {
        await window.openMagnetInGoEngineV96(val);
        return;
    }
    if (ftr) ftr.style.display = 'none';
    const ts = window._torStateV96;
    window.ensureTorrentYearInputV125();
    window.syncOmniTorrentConfigV125();
    const yVal = (document.getElementById('torYearInpV125') ? document.getElementById('torYearInpV125').value.trim() : (ts.yearFilter || ''));
    const fmtLabel = (ts.formatTag || 'all').toUpperCase() + (yVal ? ' • ' + yVal : '');
    body.innerHTML = `<div style="color:#d2a8ff;text-align:center;padding:30px 10px;">⏳ Поиск раздач «${val}» [${fmtLabel}]...</div>`;
    try {
        const res = await fetch('/api/torrent/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: val, format_tag: ts.formatTag || 'all', exact: ts.exactSearch, hide_zero: ts.hideZeroSeeds })
        });
        const d = await res.json();
        const list = d.results || [];
        const hidZero = d.hidden_zero || 0;
        if (stEl) {
            stEl.innerText = `📋 [${fmtLabel}] Живых раздач: ${list.length}` + (hidZero > 0 ? ` (скрыто с 0 сидов: ${hidZero})` : '');
        }
        if (!list.length) {
            body.innerHTML = `<div style="color:#8b949e;text-align:center;padding:25px;">В формате <b>${fmtLabel}</b> раздач не найдено${hidZero > 0 ? ` (скрыто ${hidZero} раздач с 0 сидов)` : ''}. Выбери тег <b>🌐 ВСЕ</b> или другой формат выше.</div>`;
            return;
        }
        window._torSearchResultsV96 = list;
        body.innerHTML = list.map((r, i) => `<div onclick="window.openMagnetInGoEngineV96(window._torSearchResultsV96[${i}].magnet)" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0d1117;border:1px solid #262c36;border-radius:9px;cursor:pointer;">
            <div style="flex:1;min-width:0;">
                <div style="color:#e6edf3;font-size:12px;font-weight:bold;">${r.title}</div>
                <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${r.size_mb} MB • <span style="color:${r.seeders > 0 ? '#3fb950' : '#ff7b72'};font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
            </div>
            <span style="color:#d2a8ff;font-size:11px;font-weight:bold;">Открыть ➔</span>
        </div>`).join('');
    } catch (e) {
        body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:20px;">❌ ${e.message || e}</div>`;
    }
};

// === 🎯 JENNY V102: STRICT SINGLE-TRACK TORRENT DOWNLOAD VS BATCH ===
const _origOpenMagnetV96 = window.openMagnetInGoEngineV96;
window.openMagnetInGoEngineV96 = async function(magnetUrl) {
    if (window._torStateV96) {
        window._torStateV96.activeDlSet = new Set();
        window._torStateV96.dlActive = false;
    }
    return await _origOpenMagnetV96.call(this, magnetUrl);
};

// Одиночная кнопка ⬇️ качает ТОЛЬКО нажатый трек (плюс те одиночные треки, которые уже были запущены кнопкой ⬇️)
window.downloadSingleTorrentTrackV98 = async function(fileIdx, btnEl, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const ts = window._torStateV96;
    if (!ts || !ts.currentHash) return;
    ts.activeDlSet = ts.activeDlSet || new Set();
    ts.activeDlSet.add(fileIdx);
    const chk = document.querySelector(`#torFileRowV96_${fileIdx} input[type="checkbox"]`);
    if (chk) chk.checked = true;
    if (btnEl) { btnEl.innerText = '⏳'; btnEl.style.color = '#3fb950'; }
    await window.runTorrentDownloadQueueV102(Array.from(ts.activeDlSet));
};

// Нижняя кнопка «⬇️ Качать выбранные» запускает все отмеченные галочками файлы
window.startSelectedTorrentDownloadV96 = async function(explicitFiles) {
    const ts = window._torStateV96;
    if (!ts || !ts.currentHash) return;
    if (Array.isArray(explicitFiles) && explicitFiles.length > 0) {
        ts.activeDlSet = ts.activeDlSet || new Set();
        explicitFiles.forEach(idx => ts.activeDlSet.add(idx));
        await window.runTorrentDownloadQueueV102(Array.from(ts.activeDlSet));
    } else {
        ts.activeDlSet = new Set(ts.selectedFiles);
        await window.runTorrentDownloadQueueV102(Array.from(ts.activeDlSet));
    }
};

window.runTorrentDownloadQueueV102 = async function(targetFilesArray) {
    const ts = window._torStateV96;
    const hash = ts.currentHash;
    if (!hash || !targetFilesArray || !targetFilesArray.length) return;
    const totWrap = document.getElementById('torTotalProgWrapV97');
    const totFill = document.getElementById('torTotalProgFillV97');
    if (totWrap) totWrap.style.display = 'block';
    ts.dlActive = true;

    const alreadyDoneCnt = targetFilesArray.filter(idx => ts.importedSet.has(`${hash}_${idx}`)).length;
    await fetch('/api/torrent/queue_plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total: targetFilesArray.length, done: alreadyDoneCnt })
    });
    await fetch('/api/torrent/download', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, files: targetFilesArray })
    });

    if (ts.pollTimer) clearInterval(ts.pollTimer);
    ts.pollTimer = setInterval(async () => {
        try {
            const [d, badges] = await Promise.all([
                fetch('/api/torrent/status').then(r => r.json()),
                fetch('/api/sources/live_badges').then(r => r.json())
            ]);
            const tor = (d.torrents || []).find(x => x.hash === hash);
            if (!tor) return;
            const te = (badges && badges.torrent_enc) || {};

            const encWrap = document.getElementById('torXflacProgWrapV99');
            const encLbl = document.getElementById('torXflacProgLabelV99');
            const encFill = document.getElementById('torXflacProgFillV99');
            if (encWrap) {
                if (te.active || (te.done_count > 0 && te.done_count < te.total_count)) {
                    encWrap.style.display = 'flex';
                    if (encLbl) encLbl.innerText = `🧬 Пережатие в xFLAC [${te.done_count}/${te.total_count}]: ${te.current_track || '...'} (${te.track_pct || 0}% • Общий: ${te.overall_pct || 0}%)`;
                    if (encFill) encFill.style.width = (te.overall_pct || 0) + '%';
                } else if (te.total_count > 0 && te.done_count >= te.total_count) {
                    encWrap.style.display = 'flex';
                    if (encLbl) encLbl.innerText = `✅ Сжато в .xFLAC: ${te.done_count} из ${te.total_count}`;
                    if (encFill) encFill.style.width = '100%';
                }
            }

            let sumLen = 0, sumDone = 0;
            for (const f of (tor.files || [])) {
                sumLen += (f.length || 0);
                sumDone += (f.completed || 0);
                const impKey = `${hash}_${f.index}`;
                const rowEl = document.getElementById('torFileRowV96_' + f.index);
                const pEl = document.getElementById('torFileProgV96_' + f.index);
                const dlBtn = document.getElementById('torDlSingleBtnV98_' + f.index);
                const pct = Math.max(0, Math.min(100, f.percent || 0));
                const doneMb = (f.completed / (1024 * 1024)).toFixed(1);
                const totMb = (f.length / (1024 * 1024)).toFixed(1);
                const isCurrentlyEncoding = (te.active && te.current_key === impKey);

                if (rowEl) {
                    if (f.xflac_file) {
                        rowEl.style.background = 'linear-gradient(90deg, rgba(63,185,80,0.28) 100%, #0b0f16 100%)';
                        rowEl.style.borderColor = 'rgba(63,185,80,0.65)';
                    } else if (isCurrentlyEncoding) {
                        const ep = te.track_pct || 10;
                        rowEl.style.background = `linear-gradient(90deg, rgba(63,185,80,0.38) ${ep}%, rgba(137,87,229,0.25) ${ep}%)`;
                        rowEl.style.borderColor = '#3fb950';
                    } else {
                        rowEl.style.background = `linear-gradient(90deg, rgba(137,87,229,0.32) ${pct}%, #0b0f16 ${pct}%)`;
                    }
                }

                if (f.xflac_file) {
                    if (pEl) pEl.innerText = `✅ В плеере: ${f.xflac_file}`;
                    if (dlBtn) dlBtn.innerText = '✅';
                } else if (isCurrentlyEncoding) {
                    if (pEl) pEl.innerText = `🧬 Сжатие в .xFLAC: ${te.track_pct || 0}% (трек ${te.done_count + 1} из ${te.total_count})`;
                } else if (pEl) {
                    pEl.innerText = f.done
                        ? `⏳ Очередь сжатия xFLAC (готово ${te.done_count}/${te.total_count})...`
                        : `⬇️ Скачивание: ${doneMb} / ${totMb} MB (${pct}%)`;
                }

                if (f.done && !f.xflac_file && !ts.importedSet.has(impKey) && !window._torImportBusyV98) {
                    ts.importedSet.add(impKey);
                    window._torImportBusyV98 = true;
                    fetch('/api/torrent/import_track', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ hash, index: f.index, full_path: f.full_path, torrent_name: tor.name, format_mode: 'xflac_psycho' })
                    }).then(r => r.json()).then(res => {
                        if (res.status === 'ok') {
                            if (pEl) pEl.innerText = `✅ В плеере: ${res.filename} (${res.size_mb} MB)`;
                            if (dlBtn) dlBtn.innerText = '✅';
                            if (typeof window.fetchData === 'function') window.fetchData();
                        }
                    }).finally(() => {
                        window._torImportBusyV98 = false;
                    });
                }
            }
            const totalPct = sumLen > 0 ? Math.round((sumDone * 100) / sumLen) : 0;
            ts.dlOverallPct = totalPct;
            if (totFill) totFill.style.width = totalPct + '%';
            const stEl = document.getElementById('torStatusLineV96');
            if (stEl) {
                stEl.innerText = `🧲 Сидов: ${tor.seeders} • Пиров: ${tor.peers} • Сеть: ${totalPct}% (выбрано: ${targetFilesArray.length})` +
                    (te.total_count > 0 ? ` • xFLAC: ${te.done_count}/${te.total_count} (${te.overall_pct || 0}%)` : '');
            }
        } catch (e) {}
    }, 750);
};

// === 🚀 JENNY V105: CLEAN SOUNDCLOUD UI (NO MANUAL COOKIES) + TORRENT PATH & BUTTON LOCK ===
window.openSoundCloudModalV92 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const ex = document.getElementById('jennySoundCloudModalV93');
    if (ex) {
        const isHid = (ex.style.display === 'none' || getComputedStyle(ex).display === 'none');
        ex.style.setProperty('display', isHid ? 'flex' : 'none', 'important');
        return;
    }
    const m = document.createElement('div');
    m.id = 'jennySoundCloudModalV93';
    m.className = 'jenny-modal-backdrop-v71';
    m.onclick = (e) => { if (e.target === m) m.style.setProperty('display', 'none', 'important'); };
    m.innerHTML = `<div class="jenny-modal-card-v71" onclick="event.stopPropagation()" style="max-width:450px;max-height:88vh;display:flex;flex-direction:column;">
        <div class="jenny-modal-hdr-v71" style="background:linear-gradient(90deg,rgba(255,140,66,0.22),rgba(115,65,190,0.22));">
            <span style="color:#ff8c42;font-weight:900;font-size:13px;display:flex;align-items:center;gap:6px;">${window.JENNY_NEON_SVGS_V92.soundcloud}<span>SOUNDCLOUD СТУДИЯ</span></span>
            <button type="button" onclick="document.getElementById('jennySoundCloudModalV93').style.setProperty('display','none','important')" style="padding:4px 10px;font-size:11px;border-radius:7px;background:rgba(88,166,255,0.18);border:1px solid #58a6ff;color:#58a6ff;font-weight:bold;">➖ В фон</button>
        </div>
        <div style="padding:9px 12px;background:#090d14;border-bottom:1px solid #21262d;display:flex;gap:6px;">
            <input type="text" id="scDedicatedInpV93" value="Synthwave" placeholder="Трек или артист в SoundCloud..." onkeydown="if(event.key==='Enter') window.runScDedicatedSearchV93()" style="flex:1;padding:7px 10px;font-size:12px;background:#06080b !important;color:#e6edf3 !important;border:1px solid #30363d !important;border-radius:8px;text-align:left !important;">
            <button type="button" onclick="window.runScDedicatedSearchV93()" style="padding:7px 12px;background:#ff8c42;color:#000;border:none;border-radius:8px;font-weight:bold;">🔍 Найти</button>
        </div>
        <div id="scDedicatedBodyV93" style="flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:7px;min-height:220px;"></div>
    </div>`;
    document.body.appendChild(m);
    window.runScDedicatedSearchV93();
};

// Очищаем длинное имя папки из имён файлов в Торренте и сбрасываем старый поллер при открытии новой раздачи
window.openMagnetInGoEngineV96 = async function(magnetUrl) {
    const ts = window._torStateV96;
    if (ts) {
        if (ts.pollTimer) { clearInterval(ts.pollTimer); ts.pollTimer = null; }
        ts.activeDlSet = new Set();
        ts.dlActive = false;
        ts.dlOverallPct = 0;
    }
    const body = document.getElementById('torBodyListV96');
    const stEl = document.getElementById('torStatusLineV96');
    const ftr = document.getElementById('torFooterBarV96');
    if (ftr) ftr.style.display = 'none';
    if (stEl) stEl.innerText = '🧲 Опрос DHT и 14 трекеров...';
    if (body) body.innerHTML = `<div style="color:#d2a8ff;text-align:center;padding:35px 10px;">🧲 Получение списка файлов от пиров (до 25с)...<br><span style="font-size:10.5px;color:#8b949e;">(Если у раздачи 1 сид за закрытым роутером, выбери раздачу, где больше сидов)</span></div>`;
    try {
        const res = await fetch('/api/torrent/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ magnet: magnetUrl }) });
        const d = await res.json();
        if (d.status !== 'ok') throw new Error(d.error || 'Пиры не отдали оглавление');
        ts.currentHash = d.hash;
        ts.currentName = d.name;
        const audioExts = ['.flac', '.wav', '.mp3', '.ogg', '.aac', '.m4a', '.opus', '.alac', '.ape', '.wv', '.mp4', '.mkv'];
        const rawFiles = (d.files || []).filter(f => audioExts.some(ext => f.path.toLowerCase().endsWith(ext)));
        const finalFiles = rawFiles.length ? rawFiles : (d.files || []);
        ts.files = finalFiles.map(f => {
            const parts = String(f.path || '').split('/');
            return Object.assign({}, f, { path: parts[parts.length - 1] || f.path });
        });
        ts.selectedFiles = new Set(ts.files.map(f => f.index));
        if (stEl) stEl.innerText = `💿 ${d.name} (треков: ${ts.files.length})`;
        if (ftr) ftr.style.display = 'flex';
        window.renderTorrentFilesListV96();
    } catch (e) {
        if (stEl) stEl.innerText = '⚠️ Раздача не ответила';
        if (body) body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:25px 12px;font-size:12px;">❌ ${e.message || e}<br><br><button type="button" onclick="window.backToTorrentSearchListV97()" style="padding:7px 14px;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:8px;font-weight:bold;">⬅ Вернуться к списку раздач</button></div>`;
    }
};

// Блокировка нижней кнопки в Торрент-студии на время скачивания и пережатия в xFLAC
setInterval(() => {
    const btn = document.getElementById('btnTorStartDlV97');
    const ts = window._torStateV96;
    if (true || !btn || !ts || !ts.dlActive) return;
    const encLbl = document.getElementById('torXflacProgLabelV99');
    const encTxt = encLbl ? encLbl.innerText : '';
    const netPct = ts.dlOverallPct || 0;
    if (encTxt.startsWith('✅')) {
        btn.disabled = true;
        btn.style.opacity = '0.85';
        btn.style.background = 'linear-gradient(135deg, #238636, #1f6feb)';
        btn.innerText = '✅ Все выбранные треки в плеере';
        ts.dlActive = false;
        if (ts.pollTimer) { clearInterval(ts.pollTimer); ts.pollTimer = null; }
    } else if (netPct < 100) {
        btn.disabled = true;
        btn.style.opacity = '0.75';
        btn.style.background = 'linear-gradient(135deg, #30363d, #1f6feb)';
        btn.innerText = `⏳ Загрузка: ${netPct}% (Подождите...)`;
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.75';
        btn.style.background = 'linear-gradient(135deg, #30363d, #7341be)';
        const m = encTxt.match(/\[(\d+\/\d+)\].*Общий:\s*(\d+%)/);
        btn.innerText = m ? `🧬 Пережатие xFLAC (${m[1]} • ${m[2]})...` : '🧬 Пережатие в xFLAC (Подождите...)';
    }
}, 600);

// === 🛠️ JENNY V106: FIX MINI-PLAYER SEEK + MP3 DIRECT TORRENT MODE + STREAM QUEUE MERGE ===

// 1. Чиним перемотку в универсальном мини-плеере (связываем seekKhMiniPlayerV90 и блокируем отскок ползунка во время перетаскивания пальцем)
window._umpUserDraggingSeekV106 = false;

window.seekKhMiniPlayerV90 = function(val) {
    const aud = window._khStateV88 ? window._khStateV88.previewAudio : null;
    if (!aud || !isFinite(aud.duration) || aud.duration <= 0) return;
    const targetSec = (parseFloat(val) / 1000.0) * aud.duration;
    try { aud.currentTime = targetSec; } catch (e) {}
    const curStr = window.fmtKhSecV90(targetSec);
    document.querySelectorAll('.jenny-univ-mini-player-v98 .ump-cur, #khMiniCurV90').forEach(el => {
        el.innerText = curStr;
    });
};

window.seekKhPreviewV90 = window.seekKhMiniPlayerV90;

const _origBindMiniV98 = window.bindAudioToAllMiniPlayersV98;
window.bindAudioToAllMiniPlayersV98 = function(aud, titleText) {
    _origBindMiniV98.call(this, aud, titleText);
    document.querySelectorAll('.jenny-univ-mini-player-v98 .ump-seek, #khMiniSeekV90').forEach(sEl => {
        if (!sEl._dragHookedV106) {
            sEl._dragHookedV106 = true;
            sEl.addEventListener('touchstart', () => { window._umpUserDraggingSeekV106 = true; }, { passive: true });
            sEl.addEventListener('mousedown', () => { window._umpUserDraggingSeekV106 = true; });
            const endDrag = (e) => {
                if (window._umpUserDraggingSeekV106) {
                    window._umpUserDraggingSeekV106 = false;
                    window.seekKhMiniPlayerV90(sEl.value);
                }
            };
            sEl.addEventListener('touchend', endDrag, { passive: true });
            sEl.addEventListener('mouseup', endDrag);
            sEl.addEventListener('change', endDrag);
        }
    });
    aud.ontimeupdate = () => {
        if (window._umpUserDraggingSeekV106) return;
        const curStr = window.fmtKhSecV90(aud.currentTime);
        const durStr = (isFinite(aud.duration) && aud.duration > 0) ? window.fmtKhSecV90(aud.duration) : 'Поток';
        const pct = (isFinite(aud.duration) && aud.duration > 0) ? Math.round((aud.currentTime / aud.duration) * 1000) : 0;
        document.querySelectorAll('.jenny-univ-mini-player-v98').forEach(b => {
            const cEl = b.querySelector('.ump-cur');
            const dEl = b.querySelector('.ump-dur');
            const sEl = b.querySelector('.ump-seek');
            if (cEl) cEl.innerText = curStr;
            if (dEl) dEl.innerText = durStr;
            if (sEl && pct > 0) sEl.value = pct;
        });
        const curEl90 = document.getElementById('khMiniCurV90');
        const durEl90 = document.getElementById('khMiniDurV90');
        const seekEl90 = document.getElementById('khMiniSeekV90');
        if (curEl90) curEl90.innerText = curStr;
        if (durEl90) durEl90.innerText = durStr;
        if (seekEl90 && pct > 0) seekEl90.value = pct;
    };
};

// 2. Определяем, есть ли в раздаче FLAC/WAV (нужно ли вообще показывать слово xFLAC)
window.torrentHasLosslessFilesV106 = function(filesArr) {
    const list = filesArr || (window._torStateV96 && window._torStateV96.files) || [];
    return list.some(f => {
        const p = String(f.path || f.full_path || '').toLowerCase();
        return p.endsWith('.flac') || p.endsWith('.wav');
    });
};

const _origRenderTorFilesV105 = window.renderTorrentFilesListV96;
window.renderTorrentFilesListV96 = function() {
    _origRenderTorFilesV105.apply(this, arguments);
    const hasLossless = window.torrentHasLosslessFilesV106();
    const btn = document.getElementById('btnTorStartDlV97');
    if (btn) {
        btn.innerText = hasLossless
            ? '⬇️ Качать выбранные (➔ xFLAC)'
            : '⬇️ Качать выбранные в плеер (Прямой формат)';
    }
    const encWrap = document.getElementById('torXflacProgWrapV99');
    if (encWrap && !hasLossless) {
        encWrap.style.display = 'none';
    }
};

// 3. Обновляем цикл опроса Торрент-студии: считает прогресс строго по выбранным файлам и не жмёт MP3 в xFLAC
window.runTorrentDownloadQueueV102 = async function(targetFilesArray) {
    const ts = window._torStateV96;
    const hash = ts.currentHash;
    if (!hash || !targetFilesArray || !targetFilesArray.length) return;
    const totWrap = document.getElementById('torTotalProgWrapV97');
    const totFill = document.getElementById('torTotalProgFillV97');
    if (totWrap) totWrap.style.display = 'block';
    ts.dlActive = true;

    const targetSet = new Set(targetFilesArray.map(x => Number(x)));
    const hasLossless = window.torrentHasLosslessFilesV106(
        (ts.files || []).filter(f => targetSet.has(Number(f.index)))
    );

    const alreadyDoneCnt = targetFilesArray.filter(idx => ts.importedSet.has(`${hash}_${idx}`)).length;
    await fetch('/api/torrent/queue_plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total: targetFilesArray.length, done: alreadyDoneCnt })
    });
    await fetch('/api/torrent/download', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, files: targetFilesArray })
    });

    if (ts.pollTimer) clearInterval(ts.pollTimer);
    ts.pollTimer = setInterval(async () => {
        try {
            const [d, badges] = await Promise.all([
                fetch('/api/torrent/status').then(r => r.json()),
                fetch('/api/sources/live_badges').then(r => r.json())
            ]);
            const tor = (d.torrents || []).find(x => x.hash === hash);
            if (!tor) return;
            const te = (badges && badges.torrent_enc) || {};

            const activeTargetSet = (ts.activeDlSet && ts.activeDlSet.size > 0) ? ts.activeDlSet : targetSet;
            let sumLen = 0, sumDone = 0, importedReadyCnt = 0;

            for (const f of (tor.files || [])) {
                const isSelectedTarget = activeTargetSet.has(Number(f.index));
                if (isSelectedTarget) {
                    sumLen += (f.length || 0);
                    sumDone += (f.completed || 0);
                    if (f.xflac_file) importedReadyCnt++;
                }

                const impKey = `${hash}_${f.index}`;
                const rowEl = document.getElementById('torFileRowV96_' + f.index);
                const pEl = document.getElementById('torFileProgV96_' + f.index);
                const dlBtn = document.getElementById('torDlSingleBtnV98_' + f.index);
                const pct = Math.max(0, Math.min(100, f.percent || 0));
                const doneMb = (f.completed / (1024 * 1024)).toFixed(1);
                const totMb = (f.length / (1024 * 1024)).toFixed(1);
                const isCurrentlyEncoding = (hasLossless && te.active && te.current_key === impKey);

                if (rowEl) {
                    if (f.xflac_file) {
                        rowEl.style.background = 'linear-gradient(90deg, rgba(63,185,80,0.28) 100%, #0b0f16 100%)';
                        rowEl.style.borderColor = 'rgba(63,185,80,0.65)';
                    } else if (isCurrentlyEncoding) {
                        const ep = te.track_pct || 10;
                        rowEl.style.background = `linear-gradient(90deg, rgba(63,185,80,0.38) ${ep}%, rgba(137,87,229,0.25) ${ep}%)`;
                        rowEl.style.borderColor = '#3fb950';
                    } else if (pct > 0) {
                        rowEl.style.background = `linear-gradient(90deg, rgba(137,87,229,0.32) ${pct}%, #0b0f16 ${pct}%)`;
                    }
                }

                if (f.xflac_file) {
                    if (pEl) pEl.innerText = `✅ В плеере: ${f.xflac_file}`;
                    if (dlBtn) dlBtn.innerText = '✅';
                } else if (isCurrentlyEncoding) {
                    if (pEl) pEl.innerText = `🧬 Сжатие в .xFLAC: ${te.track_pct || 0}%`;
                } else if (pEl && (isSelectedTarget || pct > 0)) {
                    pEl.innerText = f.done
                        ? (hasLossless ? `⏳ Очередь сжатия xFLAC...` : `⏳ Перенос в плеер...`)
                        : `⬇️ Скачивание: ${doneMb} / ${totMb} MB (${pct}%)`;
                }

                if (f.done && !f.xflac_file && !ts.importedSet.has(impKey) && !window._torImportBusyV98) {
                    ts.importedSet.add(impKey);
                    window._torImportBusyV98 = true;
                    fetch('/api/torrent/import_track', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ hash, index: f.index, full_path: f.full_path, torrent_name: tor.name, format_mode: 'xflac_psycho' })
                    }).then(r => r.json()).then(res => {
                        if (res.status === 'ok') {
                            if (pEl) pEl.innerText = `✅ В плеере: ${res.filename} (${res.size_mb} MB)`;
                            if (dlBtn) dlBtn.innerText = '✅';
                            if (typeof window.fetchData === 'function') window.fetchData();
                        } else {
                            ts.importedSet.delete(impKey);
                        }
                    }).catch(() => {
                        ts.importedSet.delete(impKey);
                    }).finally(() => {
                        window._torImportBusyV98 = false;
                    });
                }
            }

            const totalTargets = Math.max(1, activeTargetSet.size);
            const totalPct = sumLen > 0 ? Math.round((sumDone * 100) / sumLen) : 0;
            ts.dlOverallPct = totalPct;
            if (totFill) totFill.style.width = totalPct + '%';

            const encWrap = document.getElementById('torXflacProgWrapV99');
            const encLbl = document.getElementById('torXflacProgLabelV99');
            const encFill = document.getElementById('torXflacProgFillV99');
            if (encWrap) {
                if (!hasLossless) {
                    encWrap.style.display = 'none';
                } else if (te.active || (importedReadyCnt > 0 && importedReadyCnt < totalTargets)) {
                    encWrap.style.display = 'flex';
                    const ovPct = Math.min(100, Math.round(((importedReadyCnt * 100) + (te.active ? (te.track_pct || 0) : 0)) / totalTargets));
                    if (encLbl) encLbl.innerText = `🧬 Пережатие в xFLAC [${importedReadyCnt}/${totalTargets}]: ${te.current_track || 'Ожидание докачки...'} (${ovPct}%)`;
                    if (encFill) encFill.style.width = ovPct + '%';
                } else if (importedReadyCnt >= totalTargets) {
                    encWrap.style.display = 'flex';
                    if (encLbl) encLbl.innerText = `✅ Все выбранные треки (${importedReadyCnt}/${totalTargets}) сжаты в .xFLAC!`;
                    if (encFill) encFill.style.width = '100%';
                }
            }

            const btn = document.getElementById('btnTorStartDlV97');
            if (btn) {
                if (importedReadyCnt >= totalTargets) {
                    btn.disabled = true;
                    btn.style.background = 'linear-gradient(135deg, #238636, #1f6feb)';
                    btn.innerText = `✅ Готово (${importedReadyCnt}/${totalTargets} в плеере)`;
                    ts.dlActive = false;
                } else if (totalPct < 100) {
                    btn.disabled = true;
                    btn.style.background = 'linear-gradient(135deg, #30363d, #1f6feb)';
                    btn.innerText = `⏳ Загрузка сети: ${totalPct}% (в плеере: ${importedReadyCnt}/${totalTargets})`;
                } else {
                    btn.disabled = true;
                    btn.style.background = 'linear-gradient(135deg, #30363d, #7341be)';
                    btn.innerText = hasLossless
                        ? `🧬 Пережатие xFLAC (${importedReadyCnt}/${totalTargets})...`
                        : `⏳ Перенос в плеер (${importedReadyCnt}/${totalTargets})...`;
                }
            }

            const stEl = document.getElementById('torStatusLineV96');
            if (stEl) {
                stEl.innerText = `🧲 Сидов: ${tor.seeders} • Пиров: ${tor.peers} • Сеть: ${totalPct}% • В плеере: ${importedReadyCnt}/${totalTargets}`;
            }
        } catch (e) {}
    }, 750);
};

// === 🧲 JENNY V108: >= 2 SEEDS FILTER + OPEN PLAYING TORRENT FROM MINI-PLAYER ===
window._torStateV96 = Object.assign(window._torStateV96 || {}, {
    minTwoSeeds: false
});
window._torSnapshotsByHashV108 = window._torSnapshotsByHashV108 || {};
window._umpPlayingTorrentCtxV108 = null;

// 1. Отрисовываем 3 кнопки в верхнем ряду: [Точный поиск] [>= 2 сидов] [Скрыть 0 сидов]
window.renderTorrentFilterBarV99 = function() {
    const m = document.getElementById('jennyTorrentModalV91');
    if (!m) return;
    let bar = document.getElementById('torFilterPillsBarV99');
    if (!bar) {
        const stLine = document.getElementById('torStatusLineV96');
        if (!stLine || !stLine.parentNode) return;
        bar = document.createElement('div');
        bar.id = 'torFilterPillsBarV99';
        bar.style.cssText = 'display:flex;flex-direction:column;gap:5px;margin:2px 0;';
        stLine.parentNode.insertBefore(bar, stLine);
    }
    const ts = window._torStateV96;
    const mkCheck = (k, icon, label, activeColor) => {
        const on = Boolean(ts[k]);
        return `<button type="button" onclick="window.toggleTorrentFilterPillV99('${k}')" style="flex:1;padding:4px 4px;font-size:10px;border-radius:8px;font-weight:bold;white-space:nowrap;background:${on ? 'rgba(63,185,80,0.18)' : '#11161f'};border:1px solid ${on ? activeColor : '#30363d'};color:${on ? activeColor : '#8b949e'};display:inline-flex;align-items:center;justify-content:center;gap:3px;"><span>${on ? '☑️' : '⬜'}</span><span>${icon} ${label}</span></button>`;
    };

    const curTag = ts.formatTag || 'all';
    const tagsHtml = (window.TORRENT_FORMAT_TAGS_V101 || []).map(t => {
        const act = (curTag === t.id);
        return `<button type="button" onclick="window.selectTorrentFormatTagV101('${t.id}')" style="padding:4px 9px;font-size:10.5px;border-radius:10px;font-weight:900;flex-shrink:0;background:${act ? 'rgba(88,166,255,0.22)' : '#0d1117'};border:1.5px solid ${act ? t.color : '#262c36'};color:${act ? t.color : '#8b949e'};box-shadow:${act ? '0 0 8px rgba(88,166,255,0.25)' : 'none'};">${t.label}</button>`;
    }).join('');

    bar.innerHTML = `
        <div style="display:flex;gap:5px;width:100%;">
            ${mkCheck('exactSearch', '🎯', 'Точный поиск', '#58a6ff')}
            ${mkCheck('minTwoSeeds', '👥', '>= 2 сидов', '#e3b341')}
            ${mkCheck('hideZeroSeeds', '🚫', 'Скрыть 0 сидов', '#3fb950')}
        </div>
        <div style="display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;">
            ${tagsHtml}
        </div>
    `;
};

// Обновляем поиск торрентов с передачей min_two_seeds
window.runTorrentActionV96 = async function() {
    window.renderTorrentFilterBarV99();
    const inp = document.getElementById('torMagnetInpV91');
    const body = document.getElementById('torBodyListV96');
    const ftr = document.getElementById('torFooterBarV96');
    const stEl = document.getElementById('torStatusLineV96');
    if (!inp || !body) return;
    const val = inp.value.trim();
    if (!val) return;
    if (val.toLowerCase().startsWith('magnet:?')) {
        await window.openMagnetInGoEngineV96(val);
        return;
    }
    if (ftr) ftr.style.display = 'none';
    const ts = window._torStateV96;
    window.ensureTorrentYearInputV125();
    window.syncOmniTorrentConfigV125();
    const yVal = (document.getElementById('torYearInpV125') ? document.getElementById('torYearInpV125').value.trim() : (ts.yearFilter || ''));
    const fmtLabel = (ts.formatTag || 'all').toUpperCase() + (yVal ? ' • ' + yVal : '');
    body.innerHTML = `<div style="color:#d2a8ff;text-align:center;padding:30px 10px;">⏳ Поиск раздач «${val}» [${fmtLabel}]...</div>`;
    try {
        const res = await fetch('/api/torrent/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: val,
                format_tag: ts.formatTag || 'all',
                year: (document.getElementById('torYearInpV125') ? document.getElementById('torYearInpV125').value.trim() : (ts.yearFilter || '')),
                exact: Boolean(ts.exactSearch),
                hide_zero: Boolean(ts.hideZeroSeeds),
                min_two_seeds: Boolean(ts.minTwoSeeds)
            })
        });
        const d = await res.json();
        const list = d.results || [];
        const hidCnt = d.hidden_zero || 0;
        const seedFilterLbl = ts.minTwoSeeds ? '<2 сидов' : '0 сидов';
        if (stEl) {
            const corrBadge = d.corrected_query ? `✨ Исправлено: «${d.corrected_query}» • ` : '';
            stEl.innerText = `${corrBadge}📋 [${fmtLabel}] Живых раздач: ${list.length}` + (hidCnt > 0 ? ` (скрыто с ${seedFilterLbl}: ${hidCnt})` : '');
        }
        if (!list.length) {
            body.innerHTML = `<div style="color:#8b949e;text-align:center;padding:25px;">В формате <b>${fmtLabel}</b> раздач не найдено${hidCnt > 0 ? ` (скрыто ${hidCnt} раздач с ${seedFilterLbl})` : ''}. Попробуй снять галочку <b>👥 >= 2 сидов</b> или выбрать <b>🌐 ВСЕ</b>.</div>`;
            return;
        }
        window._torSearchResultsV96 = list;
        body.innerHTML = list.map((r, i) => `<div onclick="window.openMagnetInGoEngineV96(window._torSearchResultsV96[${i}].magnet)" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0d1117;border:1px solid #262c36;border-radius:9px;cursor:pointer;">
            <div style="flex:1;min-width:0;">
                <div style="color:#e6edf3;font-size:12px;font-weight:bold;">${r.title}</div>
                <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${r.size_mb} MB • <span style="color:${r.seeders >= 2 ? '#3fb950' : (r.seeders > 0 ? '#e3b341' : '#ff7b72')};font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
            </div>
            <span style="color:#d2a8ff;font-size:11px;font-weight:bold;">Открыть ➔</span>
        </div>`).join('');
    } catch (e) {
        body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:20px;">❌ ${e.message || e}</div>`;
    }
};

// 2. Сохраняем слепок каждого открытого торрента по его хэшу, чтобы мгновенно возвращаться к нему из мини-плеера
const _origOpenMagV105 = window.openMagnetInGoEngineV96;
window.openMagnetInGoEngineV96 = async function(magnetUrl) {
    await _origOpenMagV105.call(this, magnetUrl);
    const ts = window._torStateV96;
    if (ts && ts.currentHash && ts.files && ts.files.length) {
        window._torSnapshotsByHashV108[ts.currentHash] = {
            hash: ts.currentHash,
            name: ts.currentName,
            files: ts.files.map(f => Object.assign({}, f)),
            selectedFiles: new Set(ts.selectedFiles)
        };
    }
};

// Встраиваем кнопку «🧲 Торрент» в шапку всех мини-плееров
window.ensureMiniPlayerTorrentJumpBtnV108 = function() {
    document.querySelectorAll('.jenny-univ-mini-player-v98').forEach(bar => {
        const topRow = bar.firstElementChild;
        if (topRow && !topRow.querySelector('.ump-open-tor-btn-v108')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ump-open-tor-btn-v108';
            btn.title = 'Открыть торрент-раздачу этого трека';
            btn.style.cssText = 'display:none;padding:2px 7px;font-size:10px;background:rgba(210,168,255,0.2);border:1px solid #d2a8ff;color:#d2a8ff;border-radius:6px;font-weight:900;align-items:center;gap:3px;flex-shrink:0;';
            btn.innerHTML = '🧲 Раздача';
            btn.onclick = (e) => window.openPlayingTorrentFromMiniPlayerV108(e);
            const playBtn = topRow.querySelector('.ump-play-btn');
            if (playBtn) topRow.insertBefore(btn, playBtn);
            else topRow.appendChild(btn);
        }
    });
    const khBar = document.getElementById('khMiniPlayerBarV90');
    if (khBar && khBar.firstElementChild && !khBar.querySelector('.ump-open-tor-btn-v108')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ump-open-tor-btn-v108';
        btn.style.cssText = 'display:none;padding:2px 7px;font-size:10px;background:rgba(210,168,255,0.2);border:1px solid #d2a8ff;color:#d2a8ff;border-radius:6px;font-weight:900;align-items:center;gap:3px;';
        btn.innerHTML = '🧲 Раздача';
        btn.onclick = (e) => window.openPlayingTorrentFromMiniPlayerV108(e);
        khBar.firstElementChild.appendChild(btn);
    }
};

window.syncMiniPlayerTorrentBtnVisibilityV108 = function() {
    window.ensureMiniPlayerTorrentJumpBtnV108();
    const aud = window._khStateV88 ? window._khStateV88.previewAudio : null;
    const isTorStream = Boolean(aud && String(aud._pagePath || '').startsWith('/api/torrent/stream/'));
    document.querySelectorAll('.ump-open-tor-btn-v108').forEach(b => {
        b.style.display = isTorStream ? 'inline-flex' : 'none';
    });
};

// Перехватываем bindAudioToAllMiniPlayersV98 и previewTorrentFileStreamV97 для запоминания торрента играющего трека
const _origBindMiniV106 = window.bindAudioToAllMiniPlayersV98;
window.bindAudioToAllMiniPlayersV98 = function(aud, titleText) {
    _origBindMiniV106.call(this, aud, titleText);
    window.syncMiniPlayerTorrentBtnVisibilityV108();
};

const _origPreviewTorV98 = window.previewTorrentFileStreamV97;
window.previewTorrentFileStreamV97 = async function(fileIdx, btnEl, ev) {
    const ts = window._torStateV96;
    if (ts && ts.currentHash) {
        window._torSnapshotsByHashV108[ts.currentHash] = {
            hash: ts.currentHash,
            name: ts.currentName,
            files: (ts.files || []).map(f => Object.assign({}, f)),
            selectedFiles: new Set(ts.selectedFiles || []),
            activeDlSet: new Set(ts.activeDlSet || []),
            dlActive: Boolean(ts.dlActive)
        };
        window._umpPlayingTorrentCtxV108 = {
            hash: ts.currentHash,
            fileIdx: Number(fileIdx)
        };
    }
    await _origPreviewTorV98.call(this, fileIdx, btnEl, ev);
    window.syncMiniPlayerTorrentBtnVisibilityV108();
};

// Функция перехода к раздаче и дорожке при нажатии на кнопку «🧲 Раздача» в мини-плеере
window.openPlayingTorrentFromMiniPlayerV108 = async function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const aud = window._khStateV88 ? window._khStateV88.previewAudio : null;
    let hash = window._umpPlayingTorrentCtxV108 ? window._umpPlayingTorrentCtxV108.hash : '';
    let fileIdx = window._umpPlayingTorrentCtxV108 ? window._umpPlayingTorrentCtxV108.fileIdx : -1;

    if (aud && String(aud._pagePath || '').startsWith('/api/torrent/stream/')) {
        const parts = String(aud._pagePath).split('/');
        if (parts.length >= 6) {
            hash = parts[4];
            fileIdx = Number(parts[5]);
        }
    }
    if (!hash) return;

    // Скрываем другие открытые модальные студии и поднимаем окно Торрент-студии
    ['jennyKhinsiderModalV88', 'jennyFlacRadioModalV91', 'jennySoundCloudModalV93'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'none', 'important');
    });
    const torModal = document.getElementById('jennyTorrentModalV91');
    if (!torModal) {
        window.openTorrentHubPreviewModalV91();
    } else {
        torModal.style.setProperty('display', 'flex', 'important');
    }

    const ts = window._torStateV96;
    const snap = window._torSnapshotsByHashV108[hash];

    // Если сейчас открыт список раздач или другой торрент — восстанавливаем нужную раздачу из памяти или демона
    const ftr = document.getElementById('torFooterBarV96');
    const isShowingOther = (ts.currentHash !== hash) || !ftr || ftr.style.display === 'none' || !document.getElementById('torFileRowV96_' + fileIdx);

    if (isShowingOther) {
        if (snap && snap.files && snap.files.length) {
            ts.currentHash = snap.hash;
            ts.currentName = snap.name;
            ts.files = snap.files.map(f => Object.assign({}, f));
            ts.selectedFiles = new Set(snap.selectedFiles || ts.files.map(f => f.index));
            if (snap.activeDlSet && snap.activeDlSet.size > 0) ts.activeDlSet = new Set(snap.activeDlSet);
        } else {
            // Подтягиваем из живого Go-демона /api/torrent/status
            try {
                const stData = await fetch('/api/torrent/status').then(r => r.json());
                const found = (stData.torrents || []).find(x => x.hash === hash);
                if (found) {
                    ts.currentHash = found.hash;
                    ts.currentName = found.name;
                    ts.files = (found.files || []).map(f => {
                        const p = String(f.path || '').split('/');
                        return Object.assign({}, f, { path: p[p.length - 1] || f.path });
                    });
                    ts.selectedFiles = new Set(ts.files.map(f => f.index));
                }
            } catch (e) {}
        }

        const stEl = document.getElementById('torStatusLineV96');
        if (stEl) stEl.innerText = `💿 ${ts.currentName || 'Торрент'} (треков: ${(ts.files || []).length})`;
        if (ftr) ftr.style.display = 'flex';
        window.renderTorrentFilesListV96();

        // Если по этому торренту идёт активная закачка — перезапускаем визуальный поллер
        if (ts.activeDlSet && ts.activeDlSet.size > 0) {
            window.runTorrentDownloadQueueV102(Array.from(ts.activeDlSet));
        }
    }

    // Подсвечиваем и прокручиваем прямо к играющему файлу
    setTimeout(() => {
        const row = document.getElementById('torFileRowV96_' + fileIdx);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const prevBorder = row.style.borderColor;
            row.style.borderColor = '#d2a8ff';
            row.style.boxShadow = '0 0 12px rgba(210, 168, 255, 0.65)';
            const playBtn = row.querySelector('.tor-prev-btn-v97');
            if (playBtn && aud && !aud.paused) playBtn.innerText = '⏹';
            setTimeout(() => {
                row.style.boxShadow = 'none';
                if (prevBorder) row.style.borderColor = prevBorder;
            }, 2200);
        }
    }, 60);
};


// === 🔑🕸️ JENNY V110: SERVICE AUTH ACCORDION + 70%x70% TRACKERS WINDOW WITH DIFF REPORT ===
window._trackersStateV110 = {
    trackers: [],
    autoUpdate: true,
    lastSync: 0,
    lastAdded: [],
    lastOutdated: []
};

// 1. Автообновление при клике на паутину (срабатывает не чаще 1 раза в сутки и только если включена галочка autoUpdate)
window.triggerDailyTrackerSyncOnSpiderwebV109 = function() {
    fetch('/api/torrent/sync_trackers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false })
    })
    .then(r => r.json())
    .then(d => {
        if (d && d.status === 'ok') {
            window._trackersStateV110.trackers = d.trackers || [];
            window._trackersStateV110.autoUpdate = Boolean(d.auto_update);
            window.updateTrackersCountLabelsV110();
            if (d.updated && typeof window.showToast === 'function') {
                const addCnt = (d.added || []).length;
                const outCnt = (d.outdated || []).length;
                window.showToast(`🕸️ Трекеры обновлены (${d.count} шт. | +${addCnt} новых, -${outCnt} устар.)`);
            }
        }
    })
    .catch(() => {});
};

const _origOpenTorModalV110 = window.openTorrentHubPreviewModalV91;
window.openTorrentHubPreviewModalV91 = function(ev) {
    const ex = document.getElementById('jennyTorrentModalV91');
    const willOpen = !ex || ex.style.display === 'none' || getComputedStyle(ex).display === 'none';
    _origOpenTorModalV110.apply(this, arguments);
    if (willOpen) {
        window.triggerDailyTrackerSyncOnSpiderwebV109();
    }
};

// 2. Функции сохранения и загрузки полей авторизации сервисов
window.loadServiceAuthFromDiskV110 = async function(singleKey, btnEl) {
    try {
        const res = await fetch('/api/sources/auth');
        const d = await res.json();
        if (d.status !== 'ok' || !d.auth) return;
        const keys = singleKey ? [singleKey] : ['sc_oauth_token', 'sc_client_id', 'ia_s3_keys', 'ia_cookie', 'tor_passkey'];
        keys.forEach(k => {
            const inp = document.getElementById('inp_auth_' + k + '_v110');
            if (inp && d.auth[k] !== undefined) inp.value = d.auth[k];
        });
        if (btnEl) {
            const old = btnEl.innerHTML;
            btnEl.innerHTML = '✅';
            setTimeout(() => { btnEl.innerHTML = old; }, 900);
        } else if (typeof window.showToast === 'function') {
            window.showToast('📥 Поля авторизации сервисов загружены с диска');
        }
    } catch (e) {}
};

window.saveServiceAuthToDiskV110 = async function(singleKey, btnEl) {
    try {
        let payload = {};
        if (singleKey) {
            const inp = document.getElementById('inp_auth_' + singleKey + '_v110');
            payload = { key: singleKey, value: inp ? inp.value.trim() : '' };
        } else {
            const authObj = {};
            ['sc_oauth_token', 'sc_client_id', 'ia_s3_keys', 'ia_cookie', 'tor_passkey'].forEach(k => {
                const inp = document.getElementById('inp_auth_' + k + '_v110');
                if (inp) authObj[k] = inp.value.trim();
            });
            payload = { auth: authObj };
        }
        const res = await fetch('/api/sources/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await res.json();
        if (d.status === 'ok') {
            if (btnEl) {
                const old = btnEl.innerHTML;
                btnEl.innerHTML = '✅';
                setTimeout(() => { btnEl.innerHTML = old; }, 900);
            } else if (typeof window.showToast === 'function') {
                window.showToast('💾 Авторизация сервисов сохранена на диск');
            }
        }
    } catch (e) {}
};

// 3. Функции управления списком трекеров (Загрузка, Сохранение своего списка, Ручное обновление с диффом)
window.updateTrackersCountLabelsV110 = function() {
    const cnt = (window._trackersStateV110.trackers || []).length;
    const autoOn = Boolean(window._trackersStateV110.autoUpdate);
    const badge = document.getElementById('lblTrackersCntSettingsV110');
    if (badge) badge.innerText = `${cnt} шт.`;
    const winTitle = document.getElementById('lblTrackersModalTitleV110');
    if (winTitle) winTitle.innerText = `🕸️ СПИСОК ТРЕКЕРОВ (${cnt} шт.)`;
    ['chkAutoSyncTrackersSettingsV110', 'chkAutoSyncTrackersModalV110'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = autoOn;
    });
};

window.loadTrackersFromDiskV110 = async function(showNotification) {
    try {
        const res = await fetch('/api/torrent/trackers');
        const d = await res.json();
        if (d.status === 'ok') {
            window._trackersStateV110.trackers = d.trackers || [];
            window._trackersStateV110.autoUpdate = Boolean(d.auto_update);
            window._trackersStateV110.lastSync = d.last_sync || 0;
            const ta = document.getElementById('torTrackersTextareaV110');
            if (ta) ta.value = (d.trackers || []).join('\n');
            window.updateTrackersCountLabelsV110();
            if (showNotification && typeof window.showToast === 'function') {
                window.showToast(`📥 Загружен список трекеров (${d.count} шт.)`);
            }
        }
    } catch (e) {}
};

window.toggleAutoSyncTrackersV110 = async function(isChecked) {
    window._trackersStateV110.autoUpdate = Boolean(isChecked);
    window.updateTrackersCountLabelsV110();
    try {
        await fetch('/api/torrent/trackers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'toggle_auto', auto_update: Boolean(isChecked) })
        });
        if (typeof window.showToast === 'function') {
            window.showToast(isChecked
                ? '🔄 Автообновление трекеров из сети ВКЛЮЧЕНО'
                : '🔒 Автообновление ВЫКЛ (используется только ваш список)');
        }
    } catch (e) {}
};

window.saveCustomTrackersListV110 = async function() {
    const ta = document.getElementById('torTrackersTextareaV110');
    const rawText = ta ? ta.value : (window._trackersStateV110.trackers || []).join('\n');
    try {
        const res = await fetch('/api/torrent/trackers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save',
                trackers: rawText,
                auto_update: window._trackersStateV110.autoUpdate
            })
        });
        const d = await res.json();
        if (d.status === 'ok') {
            window._trackersStateV110.trackers = d.trackers || [];
            if (ta) ta.value = (d.trackers || []).join('\n');
            window.updateTrackersCountLabelsV110();
            window.renderTrackersDiffReportV110(null, null, `✅ Текущий список заменён и сохранён (${d.count} трекеров).`);
            if (typeof window.showToast === 'function') {
                window.showToast(`💾 Сохранено трекеров: ${d.count} шт.`);
            }
        }
    } catch (e) {}
};

window.resetTrackersToFludBaseV110 = async function() {
    try {
        const res = await fetch('/api/torrent/trackers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset_flud' })
        });
        const d = await res.json();
        if (d.status === 'ok') {
            window._trackersStateV110.trackers = d.trackers || [];
            const ta = document.getElementById('torTrackersTextareaV110');
            if (ta) ta.value = (d.trackers || []).join('\n');
            window.updateTrackersCountLabelsV110();
            window.renderTrackersDiffReportV110(null, null, `🔄 Восстановлен базовый список Flud (${d.count} шт.).`);
        }
    } catch (e) {}
};

window.renderTrackersDiffReportV110 = function(addedArr, outdatedArr, customBannerText) {
    const htmlBuild = () => {
        if (customBannerText) {
            return `<div style="color:#3fb950;font-weight:bold;">${customBannerText}</div>`;
        }
        const add = addedArr || [];
        const out = outdatedArr || [];
        const addListHtml = add.length
            ? `<div style="max-height:75px;overflow-y:auto;background:#05070a;padding:4px 6px;border-radius:5px;border:1px solid rgba(63,185,80,0.35);font-family:monospace;font-size:10px;color:#3fb950;margin-top:3px;">${add.map(x => '➕ ' + x).join('<br>')}</div>`
            : `<div style="font-size:10.5px;color:#8b949e;">Новых трекеров сверх текущего списка не обнаружено.</div>`;
        const outListHtml = out.length
            ? `<div style="max-height:75px;overflow-y:auto;background:#05070a;padding:4px 6px;border-radius:5px;border:1px solid rgba(248,81,73,0.35);font-family:monospace;font-size:10px;color:#ff7b72;margin-top:3px;">${out.map(x => '🗑️ ' + x).join('<br>')}</div>`
            : `<div style="font-size:10.5px;color:#8b949e;">Устаревших / недоступных трекеров нет (все живы).</div>`;
        return `
            <div style="display:flex;flex-direction:column;gap:6px;">
                <div>
                    <div style="font-size:11px;font-weight:bold;color:#3fb950;">✅ Добавлены новые (${add.length} шт.):</div>
                    ${addListHtml}
                </div>
                <div>
                    <div style="font-size:11px;font-weight:bold;color:#ff7b72;">❌ Устарели и удалены (${out.length} шт.):</div>
                    ${outListHtml}
                </div>
            </div>
        `;
    };

    ['torTrackersDiffReportModalV110', 'torTrackersDiffReportSettingsV110'].forEach(id => {
        const box = document.getElementById(id);
        if (box) {
            box.style.display = 'block';
            box.innerHTML = htmlBuild();
        }
    });
};

window.manualUpdateTrackersNowV110 = async function(btnEl) {
    const oldTxt = btnEl ? btnEl.innerHTML : '🔄 Обновить';
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = '⏳ Проверка живых и устаревших...';
    }
    try {
        const res = await fetch('/api/torrent/sync_trackers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: true })
        });
        const d = await res.json();
        if (d.status !== 'ok') throw new Error(d.error || 'Ошибка обновления');
        window._trackersStateV110.trackers = d.trackers || [];
        window._trackersStateV110.lastAdded = d.added || [];
        window._trackersStateV110.lastOutdated = d.outdated || [];
        const ta = document.getElementById('torTrackersTextareaV110');
        if (ta) ta.value = (d.trackers || []).join('\n');
        window.updateTrackersCountLabelsV110();
        window.renderTrackersDiffReportV110(d.added || [], d.outdated || [], null);
        if (typeof window.showToast === 'function') {
            window.showToast(`✅ Добавлено: ${(d.added || []).length} | Устарело: ${(d.outdated || []).length} | Всего: ${d.count}`);
        }
    } catch (e) {
        if (typeof window.showToast === 'function') window.showToast('❌ ' + (e.message || e));
    } finally {
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = oldTxt;
        }
    }
};

// 4. Центрированное окно списка трекеров строго 70% ширины и 70% высоты экрана (70vw x 70vh)
window.openTrackersManagerWindowV110 = async function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    let m = document.getElementById('jennyTrackersModalV110');
    if (m) m.remove();

    m = document.createElement('div');
    m.id = 'jennyTrackersModalV110';
    m.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:rgba(4,6,10,0.86);z-index:2147483646;display:flex;align-items:center;justify-content:center;box-sizing:border-box;';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    m.innerHTML = `
        <div onclick="event.stopPropagation()" style="width:70vw !important;height:70vh !important;min-width:290px;background:#080b10;border:1.5px solid #58a6ff;border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,0.96);display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:linear-gradient(90deg,rgba(88,166,255,0.22),rgba(115,65,190,0.22));border-bottom:1px solid #262c36;flex-shrink:0;">
                <span id="lblTrackersModalTitleV110" style="color:#58a6ff;font-weight:900;font-size:12.5px;">🕸️ СПИСОК ТРЕКЕРОВ</span>
                <button type="button" onclick="document.getElementById('jennyTrackersModalV110').remove()" style="background:transparent;border:1px solid #30363d;color:#8b949e;width:26px;height:26px;border-radius:50%;font-size:12px;">✖</button>
            </div>

            <div style="padding:8px 10px;background:#0d1117;border-bottom:1px solid #21262d;display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
                <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#e6edf3;font-weight:bold;cursor:pointer;">
                    <input type="checkbox" id="chkAutoSyncTrackersModalV110" onchange="window.toggleAutoSyncTrackersV110(this.checked)">
                    <span>🔄 Автообновлять через интернет-ресурсы (раз в 24ч по клику на 🕸️)</span>
                </label>
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                    <button type="button" onclick="window.manualUpdateTrackersNowV110(this)" style="flex:1.2;padding:6px 8px;font-size:11px;background:linear-gradient(135deg,#1f6feb,#238636);color:#fff;border:none;border-radius:7px;font-weight:bold;">🔄 Обновить из сети</button>
                    <button type="button" onclick="window.loadTrackersFromDiskV110(true)" style="padding:6px 8px;font-size:11px;background:#161b22;color:#58a6ff;border:1px solid #30363d;border-radius:7px;">📥 Загрузить</button>
                    <button type="button" onclick="window.saveCustomTrackersListV110()" style="padding:6px 8px;font-size:11px;background:rgba(63,185,80,0.2);color:#3fb950;border:1px solid #3fb950;border-radius:7px;font-weight:bold;">💾 Заменить своим</button>
                </div>
                <div id="torTrackersDiffReportModalV110" style="display:none;background:#090d14;border:1px solid #30363d;border-radius:8px;padding:7px 8px;"></div>
            </div>

            <div style="flex:1;padding:8px 10px;display:flex;flex-direction:column;min-height:0;background:#05070a;">
                <div style="font-size:10px;color:#8b949e;margin-bottom:4px;">По одному адресу (udp://, http://, https://) на строку. Впиши свой список и нажми «💾 Заменить своим»:</div>
                <textarea id="torTrackersTextareaV110" spellcheck="false" placeholder="udp://tracker.opentrackr.org:1337/announce..." style="flex:1;width:100%;min-height:0;box-sizing:border-box;background:#000000;color:#58a6ff;border:1px solid #30363d;border-radius:8px;padding:8px;font-family:monospace;font-size:11px;line-height:1.35;resize:none;white-space:pre;overflow:auto;"></textarea>
            </div>

            <div style="padding:8px 10px;background:#0d1117;border-top:1px solid #21262d;display:flex;gap:6px;flex-shrink:0;">
                <button type="button" onclick="document.getElementById('torTrackersTextareaV110').value=''" style="padding:6px 8px;font-size:10.5px;background:#161b22;color:#ff7b72;border:1px solid rgba(248,81,73,0.4);border-radius:7px;">🧹 Очистить</button>
                <button type="button" onclick="window.resetTrackersToFludBaseV110()" style="padding:6px 8px;font-size:10.5px;background:#161b22;color:#e3b341;border:1px solid rgba(227,179,65,0.4);border-radius:7px;">🔄 База Flud</button>
                <button type="button" onclick="window.saveCustomTrackersListV110()" style="flex:1;padding:6px 10px;font-size:11px;background:#238636;color:#fff;border:none;border-radius:7px;font-weight:bold;">💾 Сохранить список</button>
            </div>
        </div>
    `;
    document.body.appendChild(m);
    await window.loadTrackersFromDiskV110(false);
};

// 5. Расширяем renderSourcesSettingsSectionV91: монтируем под галочками источников 2 раскрывающихся меню
const _origRenderSourcesSettingsV91 = window.renderSourcesSettingsSectionV91;
window.renderSourcesSettingsSectionV91 = function() {
    _origRenderSourcesSettingsV91.apply(this, arguments);
    const sm = document.getElementById('settingsModal');
    const srcBox = document.getElementById('jennySourcesSettingsBoxV91');
    if (!sm || !srcBox) return;

    // Меню 1: Поля авторизации для сервисов с кнопками 📥 и 💾
    let authBox = document.getElementById('jennyServiceAuthSettingsBoxV110');
    if (!authBox) {
        authBox = document.createElement('details');
        authBox.id = 'jennyServiceAuthSettingsBoxV110';
        authBox.className = 'setting-group';
        srcBox.insertAdjacentElement('afterend', authBox);
    }

    const authFields = [
        { key: 'sc_oauth_token', label: '☁️ SoundCloud (OAuth / Cookie):', ph: 'oauth_token=... или 2-12345...' },
        { key: 'sc_client_id',   label: '☁️ SoundCloud (client_id):',      ph: '32 символа (необязательно)' },
        { key: 'ia_s3_keys',     label: '🏛️ Archive.org (S3 access:secret):', ph: 'access_key:secret_key' },
        { key: 'ia_cookie',      label: '🏛️ Archive.org (Cookie):',        ph: 'logged-in-user=...; logged-in-sig=...' },
        { key: 'tor_passkey',    label: '🧲 P2P Торрент (Passkey / Ключ):', ph: 'passkey для приватных трекеров' }
    ];

    authBox.innerHTML = `
        <summary>🔑 Авторизация сервисов (SoundCloud / Archive / P2P)</summary>
        <div class="group-content">
            <div style="display:flex;gap:8px;margin-bottom:8px;">
                <button type="button" onclick="window.loadServiceAuthFromDiskV110(null, this)" style="flex:1;padding:7px;font-size:11.5px;background:#1f6feb;color:#fff;border:none;border-radius:6px;font-weight:bold;">📥 ЗАГРУЗИТЬ КЛЮЧИ</button>
                <button type="button" onclick="window.saveServiceAuthToDiskV110(null, this)" style="flex:1;padding:7px;font-size:11.5px;background:#238636;color:#fff;border:none;border-radius:6px;font-weight:bold;">💾 СОХРАНИТЬ КЛЮЧИ</button>
            </div>
            ${authFields.map(f => `
                <div class="setting-row" style="border:none;padding:5px 0;gap:6px;flex-wrap:wrap;">
                    <span style="color:#c9d1d9;font-size:12px;min-width:140px;flex:1;">${f.label}</span>
                    <div style="display:flex;gap:4px;align-items:center;flex:1.4;min-width:170px;">
                        <button type="button" class="io-btn" onclick="window.loadServiceAuthFromDiskV110('${f.key}', this)" title="Загрузить поле">📥</button>
                        <input type="text" id="inp_auth_${f.key}_v110" placeholder="${f.ph}" style="flex:1;min-width:0;padding:5px 7px;font-size:11.5px;text-align:left !important;">
                        <button type="button" class="io-btn" onclick="window.saveServiceAuthToDiskV110('${f.key}', this)" title="Сохранить поле">💾</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // Меню 2: Управление списком трекеров и автообновлением
    let trkBox = document.getElementById('jennyTrackersSettingsBoxV110');
    if (!trkBox) {
        trkBox = document.createElement('details');
        trkBox.id = 'jennyTrackersSettingsBoxV110';
        trkBox.className = 'setting-group';
        authBox.insertAdjacentElement('afterend', trkBox);
    }

    trkBox.innerHTML = `
        <summary>🕸️ Трекеры P2P (Список 70% и Автообновление)</summary>
        <div class="group-content">
            <div class="setting-row" style="border:none;padding:4px 0 8px 0;">
                <label class="toggle-label" style="color:#e6edf3;font-size:12.5px;font-weight:bold;">
                    <input type="checkbox" id="chkAutoSyncTrackersSettingsV110" checked onchange="window.toggleAutoSyncTrackersV110(this.checked)">
                    🔄 Автообновлять трекеры из сети (раз в 24ч по клику на 🕸️)
                </label>
            </div>
            <div class="setting-row" style="border:none;padding:4px 0 8px 0;">
                <span style="color:#8b949e;font-size:12px;">Активных трекеров в базе:</span>
                <div style="display:flex;gap:6px;align-items:center;">
                    <button type="button" class="io-btn" onclick="window.loadTrackersFromDiskV110(true)" title="Загрузить список с диска">📥</button>
                    <span id="lblTrackersCntSettingsV110" style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:bold;color:#3fb950;">75 шт.</span>
                    <button type="button" class="io-btn" onclick="window.saveCustomTrackersListV110()" title="Сохранить список на диск">💾</button>
                </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:4px;">
                <button type="button" onclick="window.openTrackersManagerWindowV110(event)" style="flex:1.2;padding:9px;font-size:12px;background:#161b22;border:1px solid #58a6ff;color:#58a6ff;border-radius:8px;font-weight:bold;">📋 Список трекеров (Окно 70%)</button>
                <button type="button" onclick="window.manualUpdateTrackersNowV110(this)" style="flex:1;padding:9px;font-size:12px;background:linear-gradient(135deg,#1f6feb,#238636);color:#fff;border:none;border-radius:8px;font-weight:bold;">🔄 Обновить сейчас</button>
            </div>
            <div id="torTrackersDiffReportSettingsV110" style="display:none;margin-top:8px;background:#090d14;border:1px solid #30363d;border-radius:8px;padding:8px;"></div>
        </div>
    `;

    window.loadServiceAuthFromDiskV110(null, null);
    window.loadTrackersFromDiskV110(false);
};

setTimeout(() => {
    if (typeof window.renderSourcesSettingsSectionV91 === 'function') {
        window.renderSourcesSettingsSectionV91();
    }
}, 350);

// === 🚀 JENNY V112: MULTI-TORRENT ISOLATED MAPS & MACHINE-GUN DOWNLOAD ENGINE ===
window._torMapV112 = window._torMapV112 || {};
window._torImportQueueV112 = window._torImportQueueV112 || [];
window._torImportWorkerBusyV112 = false;
window._torGlobalTimerV112 = null;
window._torViewSessionV112 = 0;
window._torScreenModeV112 = 'search'; // 'search' | 'files'

window.extractBtihFromMagnetV112 = function(mag) {
    const m = String(mag || '').match(/xt=urn:btih:([a-fA-F0-9]{40})/i);
    return m ? m[1].toLowerCase() : '';
};

// Создаёт или обновляет изолированную карту конкретной раздачи
window.ensureTorrentJobMapV112 = function(hash, name, rawFiles, magnetUrl) {
    const h = String(hash || '').toLowerCase();
    if (!h) return null;
    const audioExts = ['.flac', '.wav', '.mp3', '.ogg', '.aac', '.m4a', '.opus', '.alac', '.ape', '.wv', '.mp4', '.mkv'];
    let ex = window._torMapV112[h];

    if (!ex) {
        const filtered = (rawFiles || []).filter(f => audioExts.some(ext => String(f.path || '').toLowerCase().endsWith(ext)));
        const baseFiles = (filtered.length ? filtered : (rawFiles || [])).map(f => {
            const parts = String(f.path || '').split('/');
            return Object.assign({}, f, { index: Number(f.index), path: parts[parts.length - 1] || f.path });
        });
        const validSet = new Set(baseFiles.map(f => Number(f.index)));
        ex = {
            hash: h,
            name: name || 'Torrent',
            magnet: magnetUrl || '',
            files: baseFiles,
            validIdxSet: validSet,
            selectedFiles: new Set(validSet),
            targetSet: new Set(),
            importedSet: new Set(),
            fileStatusMap: {},
            dlActive: false,
            completedAll: false,
            netPct: 0,
            readyCnt: 0,
            seeders: 0,
            peers: 0,
            hasLossless: window.torrentHasLosslessFilesV106 ? window.torrentHasLosslessFilesV106(baseFiles) : false
        };
        window._torMapV112[h] = ex;
    } else if (rawFiles && rawFiles.length && (!ex.files || !ex.files.length)) {
        const filtered = rawFiles.filter(f => audioExts.some(ext => String(f.path || '').toLowerCase().endsWith(ext)));
        ex.files = (filtered.length ? filtered : rawFiles).map(f => {
            const parts = String(f.path || '').split('/');
            return Object.assign({}, f, { index: Number(f.index), path: parts[parts.length - 1] || f.path });
        });
        ex.validIdxSet = new Set(ex.files.map(f => Number(f.index)));
        if (!ex.selectedFiles || ex.selectedFiles.size === 0) {
            ex.selectedFiles = new Set(ex.validIdxSet);
        }
        ex.hasLossless = window.torrentHasLosslessFilesV106 ? window.torrentHasLosslessFilesV106(ex.files) : false;
    }

    if (window._torSnapshotsByHashV108) {
        window._torSnapshotsByHashV108[h] = ex;
    }
    return ex;
};

// Переключает экран Торрент-студии на карту конкретной раздачи
window.mountTorrentJobToScreenV112 = function(job) {
    if (!job) return;
    window._torScreenModeV112 = 'files';
    const ts = window._torStateV96;
    ts.currentHash = job.hash;
    ts.currentName = job.name;
    ts.files = job.files;
    ts.selectedFiles = job.selectedFiles;
    ts.activeDlSet = job.targetSet;
    ts.dlActive = job.dlActive;
    ts.dlOverallPct = job.netPct;

    const stEl = document.getElementById('torStatusLineV96');
    const ftr = document.getElementById('torFooterBarV96');
    if (stEl) stEl.innerText = `💿 ${job.name} (треков: ${job.files.length})`;
    if (ftr) ftr.style.display = 'flex';
    window.renderTorrentFilesListV96();
    window.paintOpenedTorrentJobProgressV112(job, null);
};

// Открытие раздачи: ничего не отменяет! Если карта уже есть — открывает за 0 мс, если нет — ждёт в фоне и сохраняет в _torMapV112
window.openMagnetInGoEngineV96 = async function(magnetUrl) {
    window._torScreenModeV112 = 'files';
    const mySession = ++window._torViewSessionV112;
    const preHash = window.extractBtihFromMagnetV112(magnetUrl);

    // Если эта раздача уже открывалась раніше — мгновенно достаём её карту без ожидания!
    if (preHash && window._torMapV112[preHash] && window._torMapV112[preHash].files.length > 0) {
        window.mountTorrentJobToScreenV112(window._torMapV112[preHash]);
        return;
    }

    const body = document.getElementById('torBodyListV96');
    const stEl = document.getElementById('torStatusLineV96');
    const ftr = document.getElementById('torFooterBarV96');
    if (ftr) ftr.style.display = 'none';
    if (stEl) stEl.innerText = '🧲 Опрос DHT и трекеров...';
    if (body) body.innerHTML = `<div style="color:#d2a8ff;text-align:center;padding:35px 10px;">🧲 Получение списка файлов от пиров (до 25с)...<br><span style="font-size:10.5px;color:#8b949e;">(Запрос идёт в фоне — даже если выйти к списку раздач, карта сохранится автоматически)</span></div>`;

    try {
        const res = await fetch('/api/torrent/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ magnet: magnetUrl })
        });
        const d = await res.json();
        if (d.status !== 'ok') throw new Error(d.error || 'Пиры не отдали оглавление');

        // 1. Всегда сначала сохраняем карту раздачи в память (даже если пользователь уже ушёл на другой экран!)
        const job = window.ensureTorrentJobMapV112(d.hash, d.name, d.files || [], magnetUrl);

        // 2. Если пользователь всё ещё ждёт именно эту раздачу на экране — показываем её
        if (mySession === window._torViewSessionV112 && window._torScreenModeV112 === 'files') {
            window.mountTorrentJobToScreenV112(job);
        } else if (window._torScreenModeV112 === 'search') {
            window.updateSearchCardsWithLiveMapBadgesV112();
        }
    } catch (e) {
        if (mySession === window._torViewSessionV112 && window._torScreenModeV112 === 'files') {
            if (stEl) stEl.innerText = '⚠️ Раздача не ответила';
            if (body) body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:25px 12px;font-size:12px;">❌ ${e.message || e}<br><br><button type="button" onclick="window.backToTorrentSearchListV97()" style="padding:7px 14px;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:8px;font-weight:bold;">⬅ Вернуться к списку раздач</button></div>`;
        }
    }
};

// Возврат к списку раздач: НЕ останавливает никакие загрузки и показывает живой статус каждой раздачи прямо на карточках поиска
window.backToTorrentSearchListV97 = function() {
    window._torScreenModeV112 = 'search';
    window._torViewSessionV112++;
    const ftr = document.getElementById('torFooterBarV96');
    if (ftr) ftr.style.display = 'none';
    const list = window._torSearchResultsV96 || [];
    if (list.length) {
        const body = document.getElementById('torBodyListV96');
        const stEl = document.getElementById('torStatusLineV96');
        const activeJobsCnt = Object.values(window._torMapV112).filter(j => j.dlActive).length;
        if (stEl) {
            stEl.innerText = `📋 Найдено раздач: ${list.length}` + (activeJobsCnt > 0 ? ` • 🔥 Качается в фоне: ${activeJobsCnt}` : '');
        }
        if (body) {
            body.innerHTML = list.map((r, i) => {
                const bh = window.extractBtihFromMagnetV112(r.magnet);
                return `<div id="torSearchCardV112_${bh}" onclick="window.openMagnetInGoEngineV96(window._torSearchResultsV96[${i}].magnet)" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0d1117;border:1px solid #262c36;border-radius:9px;cursor:pointer;">
                    <div style="flex:1;min-width:0;">
                        <div style="color:#e6edf3;font-size:12px;font-weight:bold;">${r.title}</div>
                        <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${r.size_mb} MB • <span style="color:${r.seeders >= 2 ? '#3fb950' : (r.seeders > 0 ? '#e3b341' : '#ff7b72')};font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
                        <div class="tor-search-live-badge-v112" style="display:none;font-size:10px;font-weight:bold;margin-top:3px;"></div>
                    </div>
                    <span style="color:#d2a8ff;font-size:11px;font-weight:bold;">Открыть ➔</span>
                </div>`;
            }).join('');
            window.updateSearchCardsWithLiveMapBadgesV112();
        }
    } else {
        window.runTorrentActionV96();
    }
};

window.updateSearchCardsWithLiveMapBadgesV112 = function() {
    Object.values(window._torMapV112).forEach(job => {
        const card = document.getElementById('torSearchCardV112_' + job.hash);
        if (!card) return;
        const b = card.querySelector('.tor-search-live-badge-v112');
        if (!b) return;
        const tot = job.targetSet ? job.targetSet.size : 0;
        if (job.completedAll && tot > 0) {
            card.style.borderColor = '#3fb950';
            b.style.display = 'block';
            b.style.color = '#3fb950';
            b.innerText = `✅ В плеере: ${job.readyCnt}/${tot} (100%)`;
        } else if (job.dlActive && tot > 0) {
            card.style.borderColor = '#8957e5';
            b.style.display = 'block';
            b.style.color = '#58a6ff';
            b.innerText = `⏳ Качается в фоне: ${job.netPct}% (в плеере: ${job.readyCnt}/${tot})`;
        } else if (job.files && job.files.length > 0) {
            b.style.display = 'block';
            b.style.color = '#d2a8ff';
            b.innerText = `⚡ Карта загружена (${job.files.length} треков)`;
        }
    });
};

// Привязка чекбоксов строго к карте открытого торрента
const _origRenderTorFilesV106 = window.renderTorrentFilesListV96;
window.renderTorrentFilesListV96 = function() {
    const h = window._torStateV96 && window._torStateV96.currentHash;
    const job = h ? window._torMapV112[h] : null;
    if (job) {
        window._torStateV96.files = job.files;
        window._torStateV96.selectedFiles = job.selectedFiles;
    }
    _origRenderTorFilesV106.apply(this, arguments);
    if (job) {
        window.paintOpenedTorrentJobProgressV112(job, null);
    }
};

// Одиночная кнопка ⬇️: сначала сохраняет индекс в карту этой раздачи, затем ставит в фоновую загрузку
window.downloadSingleTorrentTrackV98 = async function(fileIdx, btnEl, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const h = window._torStateV96 && window._torStateV96.currentHash;
    const job = h ? window._torMapV112[h] : null;
    if (!job) return;

    const cleanIdx = Number(fileIdx);
    if (!job.validIdxSet.has(cleanIdx)) return;

    job.selectedFiles.add(cleanIdx);
    job.targetSet.add(cleanIdx);
    job.dlActive = true;
    job.completedAll = false;

    const chk = document.querySelector(`#torFileRowV96_${cleanIdx} input[type="checkbox"]`);
    if (chk) chk.checked = true;
    if (btnEl) { btnEl.innerText = '⏳'; btnEl.style.color = '#3fb950'; }

    await window.launchJobDownloadInDaemonV112(job);
};

// Кнопка «⬇️ Качать выбранные»: сначала сохраняет все выбранные галочки в карту раздачи, затем качает в фоне
window.startSelectedTorrentDownloadV96 = async function(explicitFiles) {
    const h = window._torStateV96 && window._torStateV96.currentHash;
    const job = h ? window._torMapV112[h] : null;
    if (!job) return;

    if (Array.isArray(explicitFiles) && explicitFiles.length > 0) {
        explicitFiles.map(Number).filter(x => job.validIdxSet.has(x)).forEach(x => job.targetSet.add(x));
    } else {
        const sel = Array.from(job.selectedFiles || []).map(Number).filter(x => job.validIdxSet.has(x));
        const finalTargets = sel.length > 0 ? sel : Array.from(job.validIdxSet);
        finalTargets.forEach(x => job.targetSet.add(x));
    }
    if (job.targetSet.size === 0) return;

    job.dlActive = true;
    job.completedAll = false;
    await window.launchJobDownloadInDaemonV112(job);
};

window.launchJobDownloadInDaemonV112 = async function(job) {
    const targetArr = Array.from(job.targetSet);
    job.hasLossless = window.torrentHasLosslessFilesV106(
        job.files.filter(f => job.targetSet.has(Number(f.index)))
    );

    const totWrap = document.getElementById('torTotalProgWrapV97');
    if (totWrap && window._torStateV96.currentHash === job.hash) {
        totWrap.style.display = 'block';
    }
    window.paintOpenedTorrentJobProgressV112(job, null);
    window.ensureMultiTorrentWorkerV112();

    // Отправляем команду демону без блокировки интерфейса
    fetch('/api/torrent/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: job.hash, files: targetArr })
    }).catch(() => {});
};

// Последовательная очередь импорта треков из ВСЕХ параллельно качающихся раздач
window.enqueueTorrentTrackImportV112 = function(job, fObj, torName) {
    const impKey = `${job.hash}_${fObj.index}`;
    if (job.importedSet.has(impKey)) return;
    job.importedSet.add(impKey);
    window._torImportQueueV112.push({
        job: job,
        hash: job.hash,
        index: Number(fObj.index),
        full_path: fObj.full_path,
        torrent_name: torName || job.name,
        impKey: impKey
    });
    window.processNextTorrentImportV112();
};

window.processNextTorrentImportV112 = async function() {
    if (window._torImportWorkerBusyV112 || window._torImportQueueV112.length === 0) return;
    window._torImportWorkerBusyV112 = true;
    const item = window._torImportQueueV112.shift();
    try {
        const res = await fetch('/api/torrent/import_track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hash: item.hash,
                index: item.index,
                full_path: item.full_path,
                torrent_name: item.torrent_name,
                format_mode: 'xflac_psycho'
            })
        }).then(r => r.json());

        if (res && res.status === 'ok') {
            item.job.fileStatusMap[item.index] = Object.assign(item.job.fileStatusMap[item.index] || {}, {
                xflac_file: res.filename,
                size_mb: res.size_mb
            });
            if (typeof window.fetchData === 'function') window.fetchData();
        } else {
            item.job.importedSet.delete(item.impKey);
        }
    } catch (e) {
        item.job.importedSet.delete(item.impKey);
    } finally {
        window._torImportWorkerBusyV112 = false;
        if (window._torImportQueueV112.length > 0) {
            setTimeout(window.processNextTorrentImportV112, 50);
        }
    }
};

// Отрисовка прогресса для той раздачи, которая сейчас открыта на экране
window.paintOpenedTorrentJobProgressV112 = function(job, te) {
    if (!job || window._torStateV96.currentHash !== job.hash || window._torScreenModeV112 !== 'files') return;
    te = te || {};

    const totWrap = document.getElementById('torTotalProgWrapV97');
    const totFill = document.getElementById('torTotalProgFillV97');
    if (totWrap && (job.dlActive || job.completedAll || job.netPct > 0)) {
        totWrap.style.display = 'block';
    }
    if (totFill) totFill.style.width = (job.netPct || 0) + '%';

    for (const f of (job.files || [])) {
        const fIdx = Number(f.index);
        const st = job.fileStatusMap[fIdx] || {};
        const isSelectedTarget = job.targetSet.has(fIdx);
        const impKey = `${job.hash}_${fIdx}`;
        const rowEl = document.getElementById('torFileRowV96_' + fIdx);
        const pEl = document.getElementById('torFileProgV96_' + fIdx);
        const dlBtn = document.getElementById('torDlSingleBtnV98_' + fIdx);

        const pct = Math.max(0, Math.min(100, st.percent || 0));
        const doneMb = ((st.completed || 0) / (1024 * 1024)).toFixed(1);
        const totMb = ((st.length || f.length || 0) / (1024 * 1024)).toFixed(1);
        const isCurrentlyEncoding = (job.hasLossless && te.active && te.current_key === impKey);
        const readyFile = st.xflac_file || f.xflac_file || '';

        if (rowEl) {
            if (readyFile) {
                rowEl.style.background = 'linear-gradient(90deg, rgba(63,185,80,0.28) 100%, #0b0f16 100%)';
                rowEl.style.borderColor = 'rgba(63,185,80,0.65)';
            } else if (isCurrentlyEncoding) {
                const ep = te.track_pct || 10;
                rowEl.style.background = `linear-gradient(90deg, rgba(63,185,80,0.38) ${ep}%, rgba(137,87,229,0.25) ${ep}%)`;
                rowEl.style.borderColor = '#3fb950';
            } else if (pct > 0 && isSelectedTarget) {
                rowEl.style.background = `linear-gradient(90deg, rgba(137,87,229,0.32) ${pct}%, #0b0f16 ${pct}%)`;
            }
        }

        if (readyFile) {
            if (pEl) pEl.innerText = `✅ В плеере: ${readyFile}`;
            if (dlBtn) dlBtn.innerText = '✅';
        } else if (isCurrentlyEncoding) {
            if (pEl) pEl.innerText = `🧬 Сжатие в .xFLAC: ${te.track_pct || 0}%`;
        } else if (pEl && (isSelectedTarget || pct > 0)) {
            pEl.innerText = st.done
                ? (job.hasLossless ? `⏳ Очередь сжатия xFLAC...` : `⏳ Перенос в плеер...`)
                : `⬇️ Скачивание: ${doneMb} / ${totMb} MB (${pct}%)`;
        }
    }

    const totalTargets = Math.max(1, job.targetSet.size || job.files.length);
    const readyCnt = job.readyCnt || 0;
    const totalPct = job.netPct || 0;

    const encWrap = document.getElementById('torXflacProgWrapV99');
    const encLbl = document.getElementById('torXflacProgLabelV99');
    const encFill = document.getElementById('torXflacProgFillV99');
    if (encWrap) {
        if (!job.hasLossless || (!job.dlActive && !job.completedAll)) {
            encWrap.style.display = 'none';
        } else if (readyCnt >= totalTargets && job.targetSet.size > 0) {
            encWrap.style.display = 'flex';
            if (encLbl) encLbl.innerText = `✅ Все выбранные треки (${readyCnt}/${totalTargets}) сжаты в .xFLAC!`;
            if (encFill) encFill.style.width = '100%';
        } else if (te.active || readyCnt > 0) {
            encWrap.style.display = 'flex';
            const ovPct = Math.min(100, Math.round(((readyCnt * 100) + (te.active ? (te.track_pct || 0) : 0)) / totalTargets));
            if (encLbl) encLbl.innerText = `🧬 Пережатие в xFLAC [${readyCnt}/${totalTargets}]: ${te.current_track || 'Ожидание докачки...'} (${ovPct}%)`;
            if (encFill) encFill.style.width = ovPct + '%';
        }
    }

    const btn = document.getElementById('btnTorStartDlV97');
    if (btn) {
        if (job.completedAll && job.targetSet.size > 0) {
            btn.disabled = false;
            btn.style.background = 'linear-gradient(135deg, #238636, #1f6feb)';
            btn.innerText = `✅ Готово (${readyCnt}/${totalTargets} в плеере)`;
        } else if (job.dlActive) {
            btn.disabled = true;
            if (totalPct < 100) {
                btn.style.background = 'linear-gradient(135deg, #30363d, #1f6feb)';
                btn.innerText = `⏳ Загрузка сети: ${totalPct}% (в плеере: ${readyCnt}/${totalTargets})`;
            } else {
                btn.style.background = 'linear-gradient(135deg, #30363d, #7341be)';
                btn.innerText = job.hasLossless
                    ? `🧬 Пережатие xFLAC (${readyCnt}/${totalTargets})...`
                    : `⏳ Перенос в плеер (${readyCnt}/${totalTargets})...`;
            }
        } else {
            btn.disabled = false;
            btn.style.background = 'linear-gradient(135deg, #8957e5, #238636)';
            btn.innerText = job.hasLossless
                ? '⬇️ Качать выбранные (➔ xFLAC)'
                : '⬇️ Качать выбранные в плеер (Прямой формат)';
        }
    }

    const stEl = document.getElementById('torStatusLineV96');
    if (stEl && (job.dlActive || job.completedAll)) {
        const otherActive = Object.values(window._torMapV112).filter(j => j.dlActive && j.hash !== job.hash).length;
        const bgTag = otherActive > 0 ? ` • В фоне ещё: ${otherActive}` : '';
        stEl.innerText = `🧲 Сидов: ${job.seeders} • Пиров: ${job.peers} • Сеть: ${totalPct}% • В плеере: ${readyCnt}/${totalTargets}${bgTag}`;
    }
};

// Единый фоновый диспетчер всех активных раздач
window.ensureMultiTorrentWorkerV112 = function() {
    if (window._torGlobalTimerV112) return;
    window._torGlobalTimerV112 = setInterval(async () => {
        const allJobs = Object.values(window._torMapV112);
        const activeJobs = allJobs.filter(j => j.dlActive);
        if (activeJobs.length === 0 && !window._torImportWorkerBusyV112 && window._torImportQueueV112.length === 0) {
            clearInterval(window._torGlobalTimerV112);
            window._torGlobalTimerV112 = null;
            window._torStateV96.dlActive = false;
            return;
        }

        try {
            const [d, badges] = await Promise.all([
                fetch('/api/torrent/status').then(r => r.json()),
                fetch('/api/sources/live_badges').then(r => r.json())
            ]);
            const torList = d.torrents || [];
            const te = (badges && badges.torrent_enc) || {};

            let globalSumLen = 0, globalSumDone = 0;

            for (const job of allJobs) {
                const tor = torList.find(x => String(x.hash || '').toLowerCase() === job.hash);
                if (!tor) continue;

                job.seeders = tor.seeders || 0;
                job.peers = tor.peers || 0;

                let sumLen = 0, sumDone = 0, readyCnt = 0;

                for (const f of (tor.files || [])) {
                    const fIdx = Number(f.index);
                    if (!job.validIdxSet.has(fIdx)) continue;

                    const prevSt = job.fileStatusMap[fIdx] || {};
                    const readyFile = f.xflac_file || prevSt.xflac_file || '';
                    job.fileStatusMap[fIdx] = {
                        completed: f.completed || 0,
                        length: f.length || 0,
                        percent: f.percent || 0,
                        done: Boolean(f.done),
                        full_path: f.full_path || '',
                        xflac_file: readyFile
                    };

                    if (job.targetSet.has(fIdx)) {
                        sumLen += (f.length || 0);
                        sumDone += (f.completed || 0);
                        if (readyFile) readyCnt++;
                        else if (f.done) {
                            window.enqueueTorrentTrackImportV112(job, f, tor.name);
                        }
                    }
                }

                job.readyCnt = readyCnt;
                if (job.targetSet.size > 0) {
                    job.netPct = sumLen > 0 ? Math.min(100, Math.round((sumDone * 100) / sumLen)) : 0;
                    if (readyCnt >= job.targetSet.size) {
                        job.dlActive = false;
                        job.completedAll = true;
                        job.netPct = 100;
                    }
                }

                if (job.dlActive) {
                    globalSumLen += sumLen;
                    globalSumDone += sumDone;
                }
            }

            // Обновляем общий процент для бейджа на иконке паутины в шапке
            const anyStillActive = Object.values(window._torMapV112).some(j => j.dlActive);
            window._torStateV96.dlActive = anyStillActive;
            window._torStateV96.dlOverallPct = globalSumLen > 0 ? Math.min(100, Math.round((globalSumDone * 100) / globalSumLen)) : 0;

            const curH = window._torStateV96.currentHash;
            if (curH && window._torMapV112[curH] && window._torScreenModeV112 === 'files') {
                window.paintOpenedTorrentJobProgressV112(window._torMapV112[curH], te);
            } else if (window._torScreenModeV112 === 'search') {
                window.updateSearchCardsWithLiveMapBadgesV112();
            }
        } catch (e) {}
    }, 750);
};

// === 📂⬅️ JENNY V113: INSTANT BACK ON LOADING + .TORRENT FILE OPENER ===
window.ensureTorrentFileInputV113 = function() {
    let inp = document.getElementById('jennyTorrentFileInputV113');
    if (!inp) {
        inp = document.createElement('input');
        inp.type = 'file';
        inp.id = 'jennyTorrentFileInputV113';
        inp.accept = '.torrent,application/x-bittorrent';
        inp.style.display = 'none';
        inp.onchange = (e) => window.handleTorrentFilePickedV113(e);
        document.body.appendChild(inp);
    }
    return inp;
};

window.triggerPickTorrentFileV113 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const inp = window.ensureTorrentFileInputV113();
    inp.value = '';
    inp.click();
};

window.handleTorrentFilePickedV113 = async function(ev) {
    const file = ev && ev.target && ev.target.files ? ev.target.files[0] : null;
    if (!file) return;

    window._torScreenModeV112 = 'files';
    window._torViewSessionV112++;
    const stEl = document.getElementById('torStatusLineV96');
    const body = document.getElementById('torBodyListV96');
    if (stEl) stEl.innerText = `📂 Чтение файла ${file.name}...`;
    if (body) body.innerHTML = `<div style="color:#3fb950;text-align:center;padding:25px 10px;">⚡ Мгновенная распаковка .torrent оглавления...</div>`;

    try {
        const fd = new FormData();
        fd.append('torrent_file', file, file.name);
        const res = await fetch('/api/torrent/add_file', { method: 'POST', body: fd });
        const d = await res.json();
        if (d.status !== 'ok') throw new Error(d.error || 'Не удалось прочитать .torrent');

        const job = window.ensureTorrentJobMapV112(d.hash, d.name, d.files || [], '');
        window.mountTorrentJobToScreenV112(job);
        if (typeof window.showToast === 'function') {
            window.showToast(`⚡ Список открыт из .torrent (${job.files.length} треков)`);
        }
    } catch (e) {
        if (body) body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:25px 12px;font-size:12px;">❌ ${e.message || e}<br><br><button type="button" onclick="window.backToTorrentSearchListV97()" style="padding:7px 14px;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:8px;font-weight:bold;">⬅ Вернуться к списку раздач</button></div>`;
    }
};

// Добавляем кнопку 📂 рядом с кнопкой поиска в шапке Торрент-студии
window.injectTorrentFileBtnInHeaderV113 = function() {
    const inp = document.getElementById('torMagnetInpV91');
    if (!inp || !inp.parentElement) return;
    const row = inp.parentElement;
    if (row.querySelector('.btn-pick-tor-file-v113')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-pick-tor-file-v113';
    btn.title = 'Открыть готовый .torrent файл без ожидания пиров';
    btn.onclick = (e) => window.triggerPickTorrentFileV113(e);
    btn.style.cssText = 'padding:7px 10px;background:#161b22;color:#3fb950;border:1px solid #3fb950;border-radius:8px;font-weight:bold;font-size:12px;flex-shrink:0;';
    btn.innerHTML = '📂';
    row.appendChild(btn);
};

const _origOpenTorModalV113 = window.openTorrentHubPreviewModalV91;
window.openTorrentHubPreviewModalV91 = function(ev) {
    _origOpenTorModalV113.apply(this, arguments);
    window.injectTorrentFileBtnInHeaderV113();
};

// Обновляем экран ожидания списка файлов: дружелюбная подсказка + кнопки "⬅ Назад к раздачам" и "📂 Открыть .torrent" СРАЗУ без ожидания таймаута!
window.openMagnetInGoEngineV96 = async function(magnetUrl) {
    window.injectTorrentFileBtnInHeaderV113();
    window._torScreenModeV112 = 'files';
    const mySession = ++window._torViewSessionV112;
    const preHash = window.extractBtihFromMagnetV112(magnetUrl);

    if (preHash && window._torMapV112[preHash] && window._torMapV112[preHash].files.length > 0) {
        window.mountTorrentJobToScreenV112(window._torMapV112[preHash]);
        return;
    }

    const body = document.getElementById('torBodyListV96');
    const stEl = document.getElementById('torStatusLineV96');
    const ftr = document.getElementById('torFooterBarV96');
    if (ftr) ftr.style.display = 'none';
    if (stEl) stEl.innerText = '🧲 Опрос DHT и трекеров...';
    if (body) {
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px 12px;gap:12px;background:#0b0f17;border:1px dashed #30363d;border-radius:12px;margin-top:6px;">
                <div style="color:#d2a8ff;font-size:13px;font-weight:900;">
                    🧲 Не уходи, я загружаю список файлов от пиров (до 25с)...
                </div>
                <div style="color:#8b949e;font-size:11.5px;line-height:1.45;max-width:360px;">
                    Если не хочешь ждать отклика пиров — открой готовый <b style="color:#3fb950;">.torrent</b> файл (список откроется мгновенно), или вернись назад, если ткнул не туда.
                </div>
                <div style="display:flex;gap:8px;width:100%;max-width:360px;margin-top:4px;">
                    <button type="button" onclick="window.backToTorrentSearchListV97()" style="flex:1;padding:9px 10px;background:#161b22;color:#e6edf3;border:1px solid #58a6ff;border-radius:8px;font-weight:bold;font-size:11.5px;">
                        ⬅ Назад к раздачам
                    </button>
                    <button type="button" onclick="window.triggerPickTorrentFileV113(event)" style="flex:1;padding:9px 10px;background:rgba(63,185,80,0.18);color:#3fb950;border:1px solid #3fb950;border-radius:8px;font-weight:bold;font-size:11.5px;">
                        📂 Открыть .torrent
                    </button>
                </div>
            </div>
        `;
    }

    try {
        const res = await fetch('/api/torrent/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ magnet: magnetUrl })
        });
        const d = await res.json();
        if (d.status !== 'ok') throw new Error(d.error || 'Пиры не отдали оглавление');

        const job = window.ensureTorrentJobMapV112(d.hash, d.name, d.files || [], magnetUrl);

        if (mySession === window._torViewSessionV112 && window._torScreenModeV112 === 'files') {
            window.mountTorrentJobToScreenV112(job);
        } else if (window._torScreenModeV112 === 'search') {
            window.updateSearchCardsWithLiveMapBadgesV112();
        }
    } catch (e) {
        if (mySession === window._torViewSessionV112 && window._torScreenModeV112 === 'files') {
            if (stEl) stEl.innerText = '⚠️ Раздача не ответила';
            if (body) {
                body.innerHTML = `
                    <div style="color:#ff7b72;text-align:center;padding:22px 12px;font-size:12px;display:flex;flex-direction:column;gap:10px;align-items:center;">
                        <div>❌ ${e.message || e}</div>
                        <div style="display:flex;gap:8px;width:100%;max-width:340px;">
                            <button type="button" onclick="window.backToTorrentSearchListV97()" style="flex:1;padding:8px 12px;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:8px;font-weight:bold;">⬅ К раздачам</button>
                            <button type="button" onclick="window.triggerPickTorrentFileV113(event)" style="flex:1;padding:8px 12px;background:rgba(63,185,80,0.18);color:#3fb950;border:1px solid #3fb950;border-radius:8px;font-weight:bold;">📂 Открыть .torrent</button>
                        </div>
                    </div>
                `;
            }
        }
    }
};

// Защита в backToTorrentSearchListV97: если в строке поиска стояла прямая magnet:? ссылка и списка поиска ещё не было, не открываем магнит повторно
const _origBackV112 = window.backToTorrentSearchListV97;
window.backToTorrentSearchListV97 = function() {
    const inp = document.getElementById('torMagnetInpV91');
    const list = window._torSearchResultsV96 || [];
    if (!list.length && inp && inp.value.trim().toLowerCase().startsWith('magnet:?')) {
        inp.value = '';
        window._torScreenModeV112 = 'search';
        window._torViewSessionV112++;
        const ftr = document.getElementById('torFooterBarV96');
        if (ftr) ftr.style.display = 'none';
        const stEl = document.getElementById('torStatusLineV96');
        if (stEl) stEl.innerText = '⚡ Введи название альбома, вставь Magnet или открой 📂 .torrent';
        const body = document.getElementById('torBodyListV96');
        if (body) {
            body.innerHTML = `<div style="color:#8b949e;text-align:center;padding:25px 12px;font-size:12px;">Введи поисковый запрос выше или нажми <b style="color:#3fb950;">📂</b> для открытия готового .torrent файла.</div>`;
        }
        return;
    }
    return _origBackV112.apply(this, arguments);
};

// === 📲 JENNY V114: ANDROID SYSTEM .TORRENT & MAGNET INTENT RECEIVER ===
window.checkAndroidPendingTorrentV114 = async function() {
    if (!window.AndroidBridge || typeof window.AndroidBridge.consumePendingTorrent !== 'function') return;
    let rawJson = '';
    try {
        rawJson = window.AndroidBridge.consumePendingTorrent();
    } catch (e) {
        return;
    }
    if (!rawJson) return;

    let data = null;
    try {
        data = JSON.parse(rawJson);
    } catch (e) {
        return;
    }
    if (!data || !data.payload) return;

    // Скрываем другие окна и поднимаем Торрент-студию
    ['jennyKhinsiderModalV88', 'jennyFlacRadioModalV91', 'jennySoundCloudModalV93'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'none', 'important');
    });
    const torModal = document.getElementById('jennyTorrentModalV91');
    if (!torModal) {
        window.openTorrentHubPreviewModalV91();
    } else {
        torModal.style.setProperty('display', 'flex', 'important');
    }

    const payload = String(data.payload);
    const fileName = String(data.name || 'external.torrent');

    // Сценарий 1: Пришла magnet:? ссылка (из браузера или через "Поделиться" из Flud)
    if (payload.toLowerCase().startsWith('magnet:?')) {
        const inp = document.getElementById('torMagnetInpV91');
        if (inp) inp.value = payload;
        if (typeof window.showToast === 'function') {
            window.showToast('🧲 Magnet-ссылка перехвачена из системы');
        }
        await window.openMagnetInGoEngineV96(payload);
        return;
    }

    // Сценарий 2: Пришёл .torrent файл из файлового менеджера / браузера / мессенджера
    if (payload.startsWith('B64TOR:')) {
        const b64 = payload.slice(7);
        window._torScreenModeV112 = 'files';
        window._torViewSessionV112++;
        const stEl = document.getElementById('torStatusLineV96');
        const body = document.getElementById('torBodyListV96');
        if (stEl) stEl.innerText = `📂 Открытие системного файла: ${fileName}...`;
        if (body) body.innerHTML = `<div style="color:#3fb950;text-align:center;padding:25px 10px;">⚡ Мгновенная распаковка ${fileName}...</div>`;

        try {
            const binStr = atob(b64);
            const bytes = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) {
                bytes[i] = binStr.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/x-bittorrent' });
            const fd = new FormData();
            fd.append('torrent_file', blob, fileName);

            const res = await fetch('/api/torrent/add_file', { method: 'POST', body: fd });
            const d = await res.json();
            if (d.status !== 'ok') throw new Error(d.error || 'Ошибка чтения .torrent');

            const job = window.ensureTorrentJobMapV112(d.hash, d.name, d.files || [], '');
            window.mountTorrentJobToScreenV112(job);
            if (typeof window.showToast === 'function') {
                window.showToast(`📂 Открыт торрент: ${d.name} (${job.files.length} треков)`);
            }
        } catch (e) {
            if (body) {
                body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:25px 12px;font-size:12px;">❌ ${e.message || e}<br><br><button type="button" onclick="window.backToTorrentSearchListV97()" style="padding:7px 14px;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:8px;font-weight:bold;">⬅ Вернуться к списку раздач</button></div>`;
            }
        }
    }
};

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        window.checkAndroidPendingTorrentV114();
    }
});
window.addEventListener('focus', () => {
    window.checkAndroidPendingTorrentV114();
});
setTimeout(() => window.checkAndroidPendingTorrentV114(), 700);
setTimeout(() => window.checkAndroidPendingTorrentV114(), 2000);

// === 📂☑️ JENNY V117: NATIVE TORRENT FILE PICKER + TOGGLE SELECT ALL / DESELECT ALL ===

// 1. Вызов нативного системного проводника Android при нажатии на значок папки 📂 или кнопку "📂 Открыть .torrent"
window.triggerPickTorrentFileV113 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    if (window.AndroidBridge && typeof window.AndroidBridge.pickTorrentFile === 'function') {
        window.AndroidBridge.pickTorrentFile();
        return;
    }
    const inp = window.ensureTorrentFileInputV113();
    inp.value = '';
    inp.click();
};

// 2. Синхронизация кнопки "Снять все" <-> "Выбрать все" с картой текущей раздачи
window.getActiveTorrentSelectSetV117 = function() {
    const ts = window._torStateV96 || {};
    const h = ts.currentHash;
    const job = (h && window._torMapV112) ? window._torMapV112[h] : null;
    if (job) {
        if (!job.selectedFiles) job.selectedFiles = new Set();
        ts.selectedFiles = job.selectedFiles;
        return job.selectedFiles;
    }
    if (!ts.selectedFiles) ts.selectedFiles = new Set();
    return ts.selectedFiles;
};

window.updateTorrentSelectAllBtnUIV117 = function() {
    const btn = document.getElementById('btnTorToggleAllV117');
    if (!btn) return;
    const selSet = window.getActiveTorrentSelectSetV117();
    const hasSelected = selSet.size > 0;
    if (hasSelected) {
        btn.innerText = '☐ Снять все';
        btn.style.color = '#8b949e';
        btn.style.borderColor = '#30363d';
        btn.style.background = '#161b22';
    } else {
        btn.innerText = '☑️ Выбрать все';
        btn.style.color = '#3fb950';
        btn.style.borderColor = '#3fb950';
        btn.style.background = 'rgba(63, 185, 80, 0.16)';
    }
};

window.onTorrentFileCheckboxChangeV117 = function(fileIdx, isChecked) {
    const selSet = window.getActiveTorrentSelectSetV117();
    const cleanIdx = Number(fileIdx);
    if (isChecked) selSet.add(cleanIdx);
    else selSet.delete(cleanIdx);
    window.updateTorrentSelectAllBtnUIV117();
};

window.toggleSelectAllTorrentFilesV117 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const ts = window._torStateV96 || {};
    const h = ts.currentHash;
    const job = (h && window._torMapV112) ? window._torMapV112[h] : null;
    const files = (job && job.files) ? job.files : (ts.files || []);
    const selSet = window.getActiveTorrentSelectSetV117();

    if (selSet.size > 0) {
        // Снимаем все галочки на месте (не затирая ссылку на Set в карте раздачи!)
        selSet.clear();
    } else {
        // Выбираем все файлы раздачи
        files.forEach(f => selSet.add(Number(f.index)));
    }

    document.querySelectorAll('#torBodyListV96 input[type="checkbox"]').forEach(chk => {
        chk.checked = (selSet.size > 0);
    });
    window.updateTorrentSelectAllBtnUIV117();
};

// Переопределяем отрисовку списка файлов раздачи с привязкой к новой кнопке "Снять все / Выбрать все"
const _origRenderTorFilesV112 = window.renderTorrentFilesListV96;
window.renderTorrentFilesListV96 = function() {
    _origRenderTorFilesV112.apply(this, arguments);
    const ftr = document.getElementById('torFooterBarV96');
    if (ftr) {
        const oldClearBtn = Array.from(ftr.querySelectorAll('button')).find(b =>
            b.innerText.includes('Снять все') || b.innerText.includes('Выбрать все')
        );
        if (oldClearBtn) {
            oldClearBtn.id = 'btnTorToggleAllV117';
            oldClearBtn.onclick = (e) => window.toggleSelectAllTorrentFilesV117(e);
        }
    }
    const ts = window._torStateV96 || {};
    const files = ts.files || [];
    const selSet = window.getActiveTorrentSelectSetV117();
    files.forEach(f => {
        const fIdx = Number(f.index);
        const chk = document.querySelector(`#torFileRowV96_${fIdx} input[type="checkbox"]`);
        if (chk) {
            chk.checked = selSet.has(fIdx);
            chk.onchange = function() {
                window.onTorrentFileCheckboxChangeV117(fIdx, this.checked);
            };
        }
    });
    window.updateTorrentSelectAllBtnUIV117();
};

// Защита при нажатии "Качать выбранные": если сняты все галочки, подсказываем выбрать трек
const _origStartSelDlV112 = window.startSelectedTorrentDownloadV96;
window.startSelectedTorrentDownloadV96 = async function(explicitFiles) {
    if (!Array.isArray(explicitFiles) || explicitFiles.length === 0) {
        const selSet = window.getActiveTorrentSelectSetV117();
        if (selSet.size === 0) {
            if (typeof window.showToast === 'function') {
                window.showToast('⚠️ Отметь галочкой хотя бы один трек или нажми «☑️ Выбрать все»');
            }
            return;
        }
    }
    return await _origStartSelDlV112.apply(this, arguments);
};

// === 💡 JENNY V118.1: DID-YOU-MEAN ALTERNATIVES BAR IN TORRENT STUDIO ===
window.applyTorrentAlternativeQueryV118 = function(altQuery, forceExact) {
    const inp = document.getElementById('torMagnetInpV91');
    if (!inp) return;
    inp.value = altQuery;
    if (forceExact !== undefined && window._torStateV96) {
        window._torStateV96.exactSearch = Boolean(forceExact);
        if (typeof window.renderTorrentFilterBarV99 === 'function') {
            window.renderTorrentFilterBarV99();
        }
    }
    window.runTorrentActionV96();
};

window.renderDidYouMeanBannerV118 = function(origQuery, correctedQuery, alternatives) {
    const stLine = document.getElementById('torStatusLineV96');
    if (!stLine || !stLine.parentNode) return;
    let box = document.getElementById('torDidYouMeanBoxV118');
    if (!box) {
        box = document.createElement('div');
        box.id = 'torDidYouMeanBoxV118';
        box.style.cssText = 'display:none;flex-direction:column;gap:4px;padding:6px 8px;margin-top:2px;background:#0d131f;border:1px solid rgba(88,166,255,0.4);border-radius:8px;font-size:11px;color:#e6edf3;';
        stLine.parentNode.insertBefore(box, stLine.nextSibling);
    }

    const activeSearch = correctedQuery || origQuery;
    const alts = Array.isArray(alternatives) ? alternatives.filter(a => a && a.toLowerCase() !== activeSearch.toLowerCase()) : [];
    const wasCorrected = Boolean(correctedQuery && correctedQuery.toLowerCase() !== origQuery.toLowerCase());

    if (!wasCorrected && alts.length === 0) {
        box.style.display = 'none';
        return;
    }

    const chips = [];
    alts.slice(0, 3).forEach(a => {
        const safeA = String(a).replace(/'/g, "\\'");
        chips.push(`<button type="button" onclick="window.applyTorrentAlternativeQueryV118('${safeA}', false)" style="padding:2px 7px;font-size:10.5px;border-radius:6px;background:rgba(88,166,255,0.18);border:1px solid #58a6ff;color:#79c0ff;font-weight:bold;">🎵 ${a}</button>`);
    });
    if (wasCorrected) {
        const safeOrig = String(origQuery).replace(/'/g, "\\'");
        chips.push(`<button type="button" onclick="window.applyTorrentAlternativeQueryV118('${safeOrig}', true)" style="padding:2px 7px;font-size:10.5px;border-radius:6px;background:#161b22;border:1px solid #30363d;color:#8b949e;">📝 «${origQuery}» (без испр.)</button>`);
    }

    box.style.display = 'flex';
    box.innerHTML = `
        <div style="color:#c9d1d9;">🔎 Поиск по: <b style="color:#3fb950;">«${activeSearch}»</b></div>
        ${chips.length > 0 ? `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;"><span style="color:#8b949e;">💡 Возможно, вы имели в виду:</span>${chips.join('<span style="color:#6e7681;font-size:10px;">или</span>')}</div>` : ''}
    `;
};

// Перехватываем runTorrentActionV96 для показа плашки "Поиск по ... Возможно, вы имели в виду ..."
const _origRunTorV118 = window.runTorrentActionV96;
window.runTorrentActionV96 = async function() {
    const box = document.getElementById('torDidYouMeanBoxV118');
    if (box) box.style.display = 'none';

    const inp = document.getElementById('torMagnetInpV91');
    const body = document.getElementById('torBodyListV96');
    const ftr = document.getElementById('torFooterBarV96');
    const stEl = document.getElementById('torStatusLineV96');
    if (!inp || !body) return;
    const val = inp.value.trim();
    if (!val || val.toLowerCase().startsWith('magnet:?')) {
        return _origRunTorV118.apply(this, arguments);
    }

    window.renderTorrentFilterBarV99();
    if (typeof window.injectTorrentFileBtnInHeaderV113 === 'function') {
        window.injectTorrentFileBtnInHeaderV113();
    }
    if (ftr) ftr.style.display = 'none';
    const ts = window._torStateV96;
    window.ensureTorrentYearInputV125();
    window.syncOmniTorrentConfigV125();
    const yVal = (document.getElementById('torYearInpV125') ? document.getElementById('torYearInpV125').value.trim() : (ts.yearFilter || ''));
    const fmtLabel = (ts.formatTag || 'all').toUpperCase() + (yVal ? ' • ' + yVal : '');
    body.innerHTML = `<div style="color:#d2a8ff;text-align:center;padding:30px 10px;">⏳ Поиск раздач «${val}» [${fmtLabel}]...</div>`;

    try {
        const res = await fetch('/api/torrent/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: val,
                format_tag: ts.formatTag || 'all',
                year: (document.getElementById('torYearInpV125') ? document.getElementById('torYearInpV125').value.trim() : (ts.yearFilter || '')),
                exact: Boolean(ts.exactSearch),
                hide_zero: Boolean(ts.hideZeroSeeds),
                min_two_seeds: Boolean(ts.minTwoSeeds)
            })
        });
        const d = await res.json();
        const list = d.results || [];
        const hidCnt = d.hidden_zero || 0;
        const seedFilterLbl = ts.minTwoSeeds ? '<2 сидов' : '0 сидов';

        window.renderDidYouMeanBannerV118(val, d.corrected_query || '', d.alternatives || []);

        if (stEl) {
            stEl.innerText = `📋 [${fmtLabel}] Живых раздач: ${list.length}` + (hidCnt > 0 ? ` (скрыто с ${seedFilterLbl}: ${hidCnt})` : '');
        }
        if (!list.length) {
            body.innerHTML = `<div style="color:#8b949e;text-align:center;padding:25px;">В формате <b>${fmtLabel}</b> раздач не найдено${hidCnt > 0 ? ` (скрыто ${hidZero} раздач с ${seedFilterLbl})` : ''}. Попробуй выбрать один из вариантов выше, снять галочку <b>👥 >= 2 сидов</b> или нажать <b>🌐 ВСЕ</b>.</div>`;
            return;
        }
        window._torSearchResultsV96 = list;
        body.innerHTML = list.map((r, i) => {
            const bh = window.extractBtihFromMagnetV112 ? window.extractBtihFromMagnetV112(r.magnet) : '';
            return `<div id="torSearchCardV112_${bh}" onclick="window.openMagnetInGoEngineV96(window._torSearchResultsV96[${i}].magnet)" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0d1117;border:1px solid #262c36;border-radius:9px;cursor:pointer;">
                <div style="flex:1;min-width:0;">
                    <div style="color:#e6edf3;font-size:12px;font-weight:bold;">${r.title}</div>
                    <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${r.size_mb} MB • <span style="color:${r.seeders >= 2 ? '#3fb950' : (r.seeders > 0 ? '#e3b341' : '#ff7b72')};font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
                    <div class="tor-search-live-badge-v112" style="display:none;font-size:10px;font-weight:bold;margin-top:3px;"></div>
                </div>
                <span style="color:#d2a8ff;font-size:11px;font-weight:bold;">Открыть ➔</span>
            </div>`;
        }).join('');
        if (typeof window.updateSearchCardsWithLiveMapBadgesV112 === 'function') {
            window.updateSearchCardsWithLiveMapBadgesV112();
        }
    } catch (e) {
        body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:20px;">❌ ${e.message || e}</div>`;
    }
};

// === 🧠 JENNY V119: MULTI-VARIANT COLLAPSIBLE TORRENT GROUPS RENDERER ===
window.renderTorrentMultiGroupsHTMLV119 = function(groups, flatResults) {
    window._torSearchResultsV96 = [];
    const registerItem = (r) => {
        const idx = window._torSearchResultsV96.length;
        window._torSearchResultsV96.push(r);
        const bh = window.extractBtihFromMagnetV112 ? window.extractBtihFromMagnetV112(r.magnet) : '';
        return `<div id="torSearchCardV112_${bh}" onclick="window.openMagnetInGoEngineV96(window._torSearchResultsV96[${idx}].magnet)" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0d1117;border:1px solid #262c36;border-radius:9px;cursor:pointer;margin-top:6px;">
            <div style="flex:1;min-width:0;">
                <div style="color:#e6edf3;font-size:12px;font-weight:bold;">${r.title}</div>
                <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${r.size_mb} MB • <span style="color:${r.seeders >= 2 ? '#3fb950' : (r.seeders > 0 ? '#e3b341' : '#ff7b72')};font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
                <div class="tor-search-live-badge-v112" style="display:none;font-size:10px;font-weight:bold;margin-top:3px;"></div>
            </div>
            <span style="color:#d2a8ff;font-size:11px;font-weight:bold;">Открыть ➔</span>
        </div>`;
    };

    if (!Array.isArray(groups) || groups.length === 0) {
        return (flatResults || []).map(r => registerItem(r)).join('');
    }

    // Если всего 1 вариант — выводим с шапкой "Поиск по: ..."
    let html = '';
    const primary = groups[0];
    const primaryCards = (primary.results || []).map(r => registerItem(r)).join('');

    html += `
        <details open style="background:#080c14;border:1px solid #3fb950;border-radius:10px;padding:7px 9px;">
            <summary style="cursor:pointer;color:#3fb950;font-weight:900;font-size:12px;display:flex;justify-content:space-between;align-items:center;outline:none;">
                <span>🔎 Поиск по: «${primary.query}»</span>
                <span style="font-size:10.5px;background:rgba(63,185,80,0.18);padding:2px 7px;border-radius:8px;color:#e6edf3;">раздач: ${primary.results.length}</span>
            </summary>
            <div style="margin-top:4px;">${primaryCards}</div>
        </details>
    `;

    if (groups.length > 1) {
        html += `<div style="font-size:11px;color:#58a6ff;font-weight:900;padding:4px 4px 0 4px;">💡 Возможно, вы имели в виду (готовые списки):</div>`;
        for (let i = 1; i < groups.length; i++) {
            const g = groups[i];
            const gCards = (g.results || []).map(r => registerItem(r)).join('');
            const prefixWord = (i > 1) ? '<span style="color:#8b949e;font-weight:normal;margin-right:4px;">или</span>' : '';
            html += `
                <details style="background:#080c14;border:1px solid #30363d;border-radius:10px;padding:7px 9px;">
                    <summary style="cursor:pointer;color:#d2a8ff;font-weight:900;font-size:12px;display:flex;justify-content:space-between;align-items:center;outline:none;">
                        <span>${prefixWord}✨ «${g.query}»</span>
                        <span style="font-size:10.5px;background:rgba(210,168,255,0.15);padding:2px 7px;border-radius:8px;color:#e6edf3;">раздач: ${g.results.length}</span>
                    </summary>
                    <div style="margin-top:4px;">${gCards}</div>
                </details>
            `;
        }
    }
    return html;
};

window.runTorrentActionV96 = async function() {
    window.renderTorrentFilterBarV99();
    if (typeof window.injectTorrentFileBtnInHeaderV113 === 'function') {
        window.injectTorrentFileBtnInHeaderV113();
    }
    const inp = document.getElementById('torMagnetInpV91');
    const body = document.getElementById('torBodyListV96');
    const ftr = document.getElementById('torFooterBarV96');
    const stEl = document.getElementById('torStatusLineV96');
    if (!inp || !body) return;
    const val = inp.value.trim();
    if (!val) return;
    if (val.toLowerCase().startsWith('magnet:?')) {
        await window.openMagnetInGoEngineV96(val);
        return;
    }

    window._torScreenModeV112 = 'search';
    const mySession = ++window._torViewSessionV112;
    if (ftr) ftr.style.display = 'none';
    const ts = window._torStateV96;
    window.ensureTorrentYearInputV125();
    window.syncOmniTorrentConfigV125();
    const yVal = (document.getElementById('torYearInpV125') ? document.getElementById('torYearInpV125').value.trim() : (ts.yearFilter || ''));
    const fmtLabel = (ts.formatTag || 'all').toUpperCase() + (yVal ? ' • ' + yVal : '');
    body.innerHTML = `<div style="color:#d2a8ff;text-align:center;padding:30px 10px;">⏳ Мульти-поиск вариантов «${val}» [${fmtLabel}]...</div>`;

    try {
        const res = await fetch('/api/torrent/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: val,
                format_tag: ts.formatTag || 'all',
                year: (document.getElementById('torYearInpV125') ? document.getElementById('torYearInpV125').value.trim() : (ts.yearFilter || '')),
                exact: Boolean(ts.exactSearch),
                hide_zero: Boolean(ts.hideZeroSeeds),
                min_two_seeds: Boolean(ts.minTwoSeeds)
            })
        });
        const d = await res.json();
        if (mySession !== window._torViewSessionV112 || window._torScreenModeV112 === 'files') return;

        const groups = d.groups || [];
        const flatList = d.results || [];
        const hidCnt = d.hidden_zero || 0;
        const seedFilterLbl = ts.minTwoSeeds ? '<2 сидов' : '0 сидов';

        if (!groups.length && !flatList.length) {
            if (stEl) stEl.innerText = `📋 Живых раздач: 0` + (hidCnt > 0 ? ` (скрыто с ${seedFilterLbl}: ${hidCnt})` : '');
            const tips = [];
            if (ts.exactSearch) tips.push('выключить <b>🎯 Точный поиск</b>');
            if (ts.minTwoSeeds) tips.push('снять галочку <b>👥 >= 2 сидов</b>');
            else if (ts.hideZeroSeeds && hidCnt > 0) tips.push('снять галочку <b>🚫 Скрыть 0 сидов</b>');
            if (ts.formatTag && ts.formatTag !== 'all') tips.push('выбрать фильтр <b>🌐 ВСЕ</b>');
            const tipStr = tips.length ? `Попробуй ${tips.join(' или ')}.` : 'Попробуй ввести имя исполнителя или открыть готовый <b>📂 .torrent</b> файл.';
            const fmtWhere = (ts.formatTag && ts.formatTag !== 'all') ? ` в формате <b>${fmtLabel}</b>` : '';
            body.innerHTML = `<div style="color:#8b949e;text-align:center;padding:25px;line-height:1.45;">По запросу «<b>${val}</b>»${fmtWhere} живых раздач не найдено${hidCnt > 0 ? ` (скрыто ${hidCnt} раздач с ${seedFilterLbl})` : ''}.<br><br>${tipStr}</div>`;
            return;
        }

        window._torSearchGroupsV119 = groups;
        if (stEl) {
            stEl.innerText = `📋 [${fmtLabel}] Вариантов: ${groups.length || 1} • Всего раздач: ${flatList.length}` + (hidCnt > 0 ? ` (скрыто: ${hidCnt})` : '');
        }
        body.innerHTML = window.renderTorrentMultiGroupsHTMLV119(groups, flatList);
        if (typeof window.updateSearchCardsWithLiveMapBadgesV112 === 'function') {
            window.updateSearchCardsWithLiveMapBadgesV112();
        }
    } catch (e) {
        body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:20px;">❌ ${e.message || e}</div>`;
    }
};

// При нажатии "⬅ Раздачи" возвращаем все 5 раскрывающихся списков с сохранением статуса закачек
const _origBackToTorListV113 = window.backToTorrentSearchListV97;
window.backToTorrentSearchListV97 = function() {
    if (window._torSearchGroupsV119 && window._torSearchGroupsV119.length > 0) {
        window._torScreenModeV112 = 'search';
        window._torViewSessionV112++;
        const ftr = document.getElementById('torFooterBarV96');
        if (ftr) ftr.style.display = 'none';
        const body = document.getElementById('torBodyListV96');
        const stEl = document.getElementById('torStatusLineV96');
        const activeJobsCnt = Object.values(window._torMapV112 || {}).filter(j => j.dlActive).length;
        if (stEl) {
            stEl.innerText = `📋 Вариантов поиска: ${window._torSearchGroupsV119.length}` + (activeJobsCnt > 0 ? ` • 🔥 Качается в фоне: ${activeJobsCnt}` : '');
        }
        if (body) {
            body.innerHTML = window.renderTorrentMultiGroupsHTMLV119(window._torSearchGroupsV119, []);
            if (typeof window.updateSearchCardsWithLiveMapBadgesV112 === 'function') {
                window.updateSearchCardsWithLiveMapBadgesV112();
            }
        }
        return;
    }
    return _origBackToTorListV113.apply(this, arguments);
};


// === 📅 JENNY V125: YEAR INPUT FIELD NEXT TO SEARCH + BACKEND CONFIG SYNC ===
window._torOmniConfigLoadedV125 = false;
window.syncOmniTorrentConfigV125 = async function() {
    if (window._torOmniConfigLoadedV125) return;
    try {
        const r = await fetch('/api/torrent/config');
        const d = await r.json();
        if (d && d.config) {
            window._torOmniServerCfgV125 = d.config;
            if (Array.isArray(d.config.format_tags) && d.config.format_tags.length) {
                window.TORRENT_FORMAT_TAGS_V101 = d.config.format_tags;
            }
            if (d.config.default_format_tag && (!window._torStateV96.formatTag || window._torStateV96.formatTag === 'all')) {
                window._torStateV96.formatTag = d.config.default_format_tag;
            }
            if (d.config.default_year && !window._torStateV96.yearFilter) {
                window._torStateV96.yearFilter = String(d.config.default_year);
            }
            window._torOmniConfigLoadedV125 = true;
            window.renderTorrentFilterBarV99();
            window.ensureTorrentYearInputV125();
        }
    } catch (e) {}
};

window.ensureTorrentYearInputV125 = function() {
    const inp = document.getElementById('torMagnetInpV91');
    if (!inp || !inp.parentNode) return;
    const cfg = window._torOmniServerCfgV125 || {};
    if (cfg.enable_year_filter === false) {
        const ex = document.getElementById('torYearInpV125');
        if (ex) ex.style.display = 'none';
        return;
    }
    let yInp = document.getElementById('torYearInpV125');
    if (!yInp) {
        yInp = document.createElement('input');
        yInp.type = 'text';
        yInp.id = 'torYearInpV125';
        yInp.setAttribute('inputmode', 'numeric');
        yInp.setAttribute('maxlength', '4');
        yInp.placeholder = '📅 Год';
        yInp.value = (window._torStateV96 && window._torStateV96.yearFilter) ? window._torStateV96.yearFilter : '';
        yInp.style.cssText = 'width:64px;flex-shrink:0;padding:7px 6px;font-size:12px;background:#06080b !important;color:#58a6ff !important;border:1px solid #30363d !important;border-radius:8px;text-align:center !important;font-weight:bold;';
        yInp.oninput = function() {
            this.value = this.value.replace(/[^0-9]/g, '').slice(0, 4);
            window._torStateV96.yearFilter = this.value;
            this.style.borderColor = this.value.length === 4 ? '#58a6ff' : '#30363d';
        };
        yInp.onkeydown = function(ev) {
            if (ev.key === 'Enter') {
                window.runTorrentActionV96();
            }
        };
        // Вставляем поле Года прямо справа от основного поля поиска (перед кнопкой 🔍 / 🧲)
        inp.parentNode.insertBefore(yInp, inp.nextSibling);
    } else {
        yInp.style.display = '';
    }
};

// === ⚡ JENNY V126: LIVE REACTIVE TORRENT STREAMING WAVES (ZERO-TIMER PROGRESSIVE UI) ===
window._torLivePollTimerV126 = null;

window.stopTorrentLiveWavePollV126 = function() {
    if (window._torLivePollTimerV126) {
        clearTimeout(window._torLivePollTimerV126);
        window._torLivePollTimerV126 = null;
    }
};

window.applyLiveTorrentWaveDOMV126 = function(body, groups, flatList, isFirstRender) {
    if (!body) return;
    const prevScrollTop = body.scrollTop;
    const openMap = {};
    body.querySelectorAll('details[data-grp-key]').forEach((det, idx) => {
        const k = det.getAttribute('data-grp-key') || String(idx);
        openMap[k] = det.open;
    });

    const rawHtml = window.renderTorrentMultiGroupsHTMLV119(groups, flatList);
    body.innerHTML = rawHtml;

    body.querySelectorAll('details').forEach((det, idx) => {
        const sumEl = det.querySelector('summary');
        const k = sumEl ? sumEl.innerText.split('раздач:')[0].trim() : ('grp_' + idx);
        det.setAttribute('data-grp-key', k);
        if (!isFirstRender && Object.prototype.hasOwnProperty.call(openMap, k)) {
            det.open = openMap[k];
        } else if (idx === 0) {
            det.open = true;
        }
    });

    if (!isFirstRender && prevScrollTop > 0) {
        body.scrollTop = prevScrollTop;
    }
    if (typeof window.updateSearchCardsWithLiveMapBadgesV112 === 'function') {
        window.updateSearchCardsWithLiveMapBadgesV112();
    }
};

window.runTorrentActionV96 = async function(isForceNewSearch) {
    window.stopTorrentLiveWavePollV126();
    window.renderTorrentFilterBarV99();
    if (typeof window.injectTorrentFileBtnInHeaderV113 === 'function') {
        window.injectTorrentFileBtnInHeaderV113();
    }
    const inp = document.getElementById('torMagnetInpV91');
    const body = document.getElementById('torBodyListV96');
    const ftr = document.getElementById('torFooterBarV96');
    const stEl = document.getElementById('torStatusLineV96');
    if (!inp || !body) return;
    const val = inp.value.trim();
    if (!val) return;
    if (val.toLowerCase().startsWith('magnet:?')) {
        await window.openMagnetInGoEngineV96(val);
        return;
    }

    window._torScreenModeV112 = 'search';
    const mySession = ++window._torViewSessionV112;
    if (ftr) ftr.style.display = 'none';
    const ts = window._torStateV96;
    window.ensureTorrentYearInputV125();
    window.syncOmniTorrentConfigV125();
    const yVal = (document.getElementById('torYearInpV125') ? document.getElementById('torYearInpV125').value.trim() : (ts.yearFilter || ''));
    const fmtLabel = (ts.formatTag || 'all').toUpperCase() + (yVal ? ' • ' + yVal : '');

    body.innerHTML = `<div style="color:#d2a8ff;text-align:center;padding:30px 10px;">⚡ Живой поиск «${val}» [${fmtLabel}] — выводим раздачи по мере отклика...</div>`;
    if (stEl) {
        stEl.innerText = `⚡ Запуск реактивного поиска «${val}»...`;
    }

    let lastRenderedVer = -1;
    let lastRenderedCount = -1;
    let hasRenderedAny = false;
    let firstCall = (isForceNewSearch !== false);

    const pollNextWave = async () => {
        if (mySession !== window._torViewSessionV112 || window._torScreenModeV112 === 'files') {
            return;
        }
        try {
            const res = await fetch('/api/torrent/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: val,
                    force_new: firstCall,
                    format_tag: ts.formatTag || 'all',
                    year: (document.getElementById('torYearInpV125') ? document.getElementById('torYearInpV125').value.trim() : (ts.yearFilter || '')),
                    exact: Boolean(ts.exactSearch),
                    hide_zero: Boolean(ts.hideZeroSeeds),
                    min_two_seeds: Boolean(ts.minTwoSeeds)
                })
            });
            firstCall = false;
            const d = await res.json();
            if (mySession !== window._torViewSessionV112 || window._torScreenModeV112 === 'files') {
                return;
            }

            const groups = d.groups || [];
            const flatList = d.results || [];
            const hidCnt = d.hidden_zero || 0;
            const inProg = Boolean(d.in_progress);
            const snapVer = d.snapshot_version || 0;
            const compJobs = d.completed_jobs || 0;
            const totJobs = d.total_jobs || 0;
            const seedFilterLbl = ts.minTwoSeeds ? '<2 сидов' : '0 сидов';

            if (flatList.length > 0 || groups.length > 0) {
                window._torSearchGroupsV119 = groups;
                if (!hasRenderedAny || flatList.length !== lastRenderedCount || (!inProg && snapVer !== lastRenderedVer)) {
                    window.applyLiveTorrentWaveDOMV126(body, groups, flatList, !hasRenderedAny);
                    hasRenderedAny = true;
                    lastRenderedCount = flatList.length;
                    lastRenderedVer = snapVer;
                }
                if (stEl) {
                    const progBadge = inProg
                        ? `⚡ Догрузка [${compJobs}/${totJobs}] • `
                        : `✅ Готово • `;
                    stEl.innerText = `${progBadge}[${fmtLabel}] Категорий: ${groups.length || 1} • Раздач: ${flatList.length}` + (hidCnt > 0 ? ` (скрыто: ${hidCnt})` : '');
                }
            } else if (!inProg) {
                if (stEl) stEl.innerText = `📋 Живых раздач: 0` + (hidCnt > 0 ? ` (скрыто с ${seedFilterLbl}: ${hidCnt})` : '');
                const tips = [];
                if (ts.exactSearch) tips.push('выключить <b>🎯 Точный поиск</b>');
                if (ts.minTwoSeeds) tips.push('снять галочку <b>👥 >= 2 сидов</b>');
                else if (ts.hideZeroSeeds && hidCnt > 0) tips.push('снять галочку <b>🚫 Скрыть 0 сидов</b>');
                if (ts.formatTag && ts.formatTag !== 'all') tips.push('выбрать фильтр <b>🌐 ВСЕ</b>');
                const tipStr = tips.length ? `Попробуй ${tips.join(' или ')}.` : 'Попробуй ввести имя исполнителя или открыть готовый <b>📂 .torrent</b> файл.';
                const fmtWhere = (ts.formatTag && ts.formatTag !== 'all') ? ` в формате <b>${fmtLabel}</b>` : '';
                body.innerHTML = `<div style="color:#8b949e;text-align:center;padding:25px;line-height:1.45;">По запросу «<b>${val}</b>»${fmtWhere} живых раздач не найдено${hidCnt > 0 ? ` (скрыто ${hidCnt} раздач с ${seedFilterLbl})` : ''}.<br><br>${tipStr}</div>`;
            } else {
                if (stEl) {
                    stEl.innerText = `⚡ Опрос индексаторов [${compJobs}/${totJobs}] — ждём первый отклик...`;
                }
            }

            if (inProg && mySession === window._torViewSessionV112 && window._torScreenModeV112 === 'search') {
                window._torLivePollTimerV126 = setTimeout(pollNextWave, 450);
            }
        } catch (e) {
            if (!hasRenderedAny) {
                body.innerHTML = `<div style="color:#ff7b72;text-align:center;padding:20px;">❌ ${e.message || e}</div>`;
            }
        }
    };

    pollNextWave();
};

// === 🚀 JENNY V127: DIRECT .TORRENT CONVEYOR UI, LIVE KB/S SPEED & KILL_ALL RESET ===
const _origKillAllV94 = window.killAllSourceModulesV94;
window.killAllSourceModulesV94 = async function(ev) {
if (window._torGlobalTimerV112) { clearInterval(window._torGlobalTimerV112); window._torGlobalTimerV112 = null; }
if (window.stopTorrentLiveWavePollV126) { window.stopTorrentLiveWavePollV126(); }
window._torMapV112 = {};
window._torSnapshotsByHashV108 = {};
window._torImportQueueV112 = [];
window._torImportWorkerBusyV112 = false;
if (window._torStateV96) {
window._torStateV96.currentHash = '';
window._torStateV96.dlActive = false;
window._torStateV96.dlOverallPct = 0;
window._torStateV96.activeDlSet = new Set();
}
return await _origKillAllV94.apply(this, arguments);
};

window.downloadSingleTorrentTrackV98 = async function(fileIdx, btnEl, ev) {
if (ev && ev.stopPropagation) ev.stopPropagation();
const h = window._torStateV96 && window._torStateV96.currentHash;
const job = h ? window._torMapV112[h] : null;
if (!job) return;
const cleanIdx = Number(fileIdx);
if (!job.validIdxSet.has(cleanIdx)) return;
if (!job.dlActive && job.selectedFiles.size === job.validIdxSet.size && job.validIdxSet.size > 1) {
job.selectedFiles.clear();
document.querySelectorAll('#torBodyListV96 input[type="checkbox"]').forEach(c => { c.checked = false; });
}
job.selectedFiles.add(cleanIdx);
job.targetSet.add(cleanIdx);
job.dlActive = true;
job.completedAll = false;
const chk = document.querySelector(`#torFileRowV96_${cleanIdx} input[type="checkbox"]`);
if (chk) chk.checked = true;
if (typeof window.updateTorrentSelectAllBtnUIV117 === 'function') window.updateTorrentSelectAllBtnUIV117();
if (btnEl) { btnEl.innerText = '⏳'; btnEl.style.color = '#3fb950'; }
await window.launchJobDownloadInDaemonV112(job);
};

const _origPaintJobV112 = window.paintOpenedTorrentJobProgressV112;
window.paintOpenedTorrentJobProgressV112 = function(job, te) {
_origPaintJobV112.apply(this, arguments);
if (!job || window._torStateV96.currentHash !== job.hash || window._torScreenModeV112 !== 'files') return;
const stEl = document.getElementById('torStatusLineV96');
if (stEl && (job.dlActive || job.completedAll)) {
const totalTargets = Math.max(1, job.targetSet.size || job.files.length);
const readyCnt = job.readyCnt || 0;
const totalPct = job.netPct || 0;
const spdStr = job.speedKbps > 0 ? ` • ⚡ ${job.speedKbps} КБ/с` : '';
const totPeersStr = job.totalPeers > job.peers ? `/${job.totalPeers}` : '';
stEl.innerText = `🧲 Сидов: ${job.seeders} • Пиров: ${job.peers}${totPeersStr}${spdStr} • Сеть: ${totalPct}% • В плеере: ${readyCnt}/${totalTargets}`;
}
};

setInterval(async () => {
const curH = window._torStateV96 && window._torStateV96.currentHash;
const job = curH && window._torMapV112 ? window._torMapV112[curH] : null;
if (!job || !job.dlActive) return;
try {
const d = await fetch('/api/torrent/status').then(r => r.json());
const tor = (d.torrents || []).find(x => String(x.hash || '').toLowerCase() === job.hash);
if (tor) {
job.speedKbps = tor.speed_kbps || 0;
job.totalPeers = tor.total_peers || 0;
}
} catch (e) {}
}, 1000);
