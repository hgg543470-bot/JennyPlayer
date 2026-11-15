/* ============================================================================
 * ui_playlist.js — Плейлист: вкладки, сортировка, теги, поиск, очередь, папки, строки треков, fetchData
 * Вынесено из ui_v71.js без изменения кода (см. REFACTOR_PLAN.md). Порядок блоков — исходный.
 * ============================================================================ */

/* ================= END JENNY V172 CLEAN FIX ================= */

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

;(function hookFetchAndModalsV71() {
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

var openPlaylistSortModalV71 = window.openPlaylistSortModalV71 = window.openPlaylistSortModalV71 || function(){};

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


// === V73 SCOPED SEARCH & 180MS LONG-PRESS MODALS (PLAYLISTS, ARTISTS, ALBUMS) ===

window._suppressNextStripClickV73 = false;
window._subModalSortModeV73 = 'alpha'; // 'alpha' | 'count'

// Перехватываем closeAllV71Modals, чтобы он закрывал и новые окна V73
;(function extendCloseModalsV73() {
    const origClose = window.closeAllV71Modals;
    window.closeAllV71Modals = function() {
        if (typeof origClose === 'function') origClose();
        ['jennyAllPlaylistsPopupV73', 'jennySubItemsPopupV73'].forEach(id => {
            document.getElementById(id)?.remove();
        });
    };
})();

// Универсальный детектор зажатия 180 мс для горизонтальных лент (не мешает свайпу прокрутки и коротким тапам)
var attachStripLongPressV73 = window.attachStripLongPressV73 = window.attachStripLongPressV73 || function(){};

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
var selectSubFilterItemV73 = window.selectSubFilterItemV73 = window.selectSubFilterItemV73 || function(){};

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
;(function wrapRenderForIndependentQueueV73_1() {
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
;(function upgradeExistingStripsV74_5() {
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
;(function guardLongPressModalsEntryV74_5() {
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

// Оборачиваем mountPlaylistStripDOMV71 и renderActivePlaylistTracksV71, чтобы 2-я строка всегда оставалась прикреплённой в .sticky-top
;(function hookSubStripPinningV74_7() {
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

if (window.PLAYLIST_BUILTIN_TABS_V71 && !window.PLAYLIST_BUILTIN_TABS_V71.some(t => t.id === 'videos')) {
window.PLAYLIST_BUILTIN_TABS_V71.splice(2, 0, { id: 'videos', icon: '🎬', ru: 'Видео', en: 'Videos' });
}

const _origGetCntV130 = window.getTrackCountForTabV71;
window.getTrackCountForTabV71 = function(tabId) {
if (tabId === 'videos') {
return ((window.lastData && window.lastData.all_tracks) || []).filter(fn => window.isVideoFileNameV130(fn)).length;
}
return _origGetCntV130.apply(this, arguments);
};

const _origRenderActivePlV130 = window.renderActivePlaylistTracksV71;
window.renderActivePlaylistTracksV71 = function(scrollSubChipToCenter) {
if (window.activePlaylistTabV71 === 'videos') {
const unifiedBox = document.getElementById('unifiedList');
if (!unifiedBox || !window.lastData) return;
window.mountPlaylistStripDOMV71();
const subWrap = document.getElementById('jennySubFilterWrapV71');
if (subWrap) subWrap.innerHTML = '';
const vids = (window.lastData.all_tracks || []).filter(fn => window.isVideoFileNameV130(fn));
const sorted = window.sortTrackArrayForTabV71(vids, 'videos');
window.viewedFullTabListV73 = [...sorted];
window.currentTrackList = sorted;
const cntEl = document.getElementById('tracksCount');
if (cntEl) cntEl.innerText = sorted.length;
unifiedBox.innerHTML = sorted.length
? sorted.map(fn => buildTrackRowHTML(fn, 'main', (window.favorites || []).includes(fn) ? '❤️' : '🤍')).join('')
: `<div style="padding:24px;color:#8b949e;text-align:center;">🎬 Видеофайлов в папке пока нет.<br><br>Скачай любое видео из <b>Торрент-студии</b> (тег <b>🎬 ВИДЕО</b>) или открой его прямо в потоке!</div>`;
window.decorateVideoIconsInListV130();
return;
}
const res = _origRenderActivePlV130.apply(this, arguments);
window.decorateVideoIconsInListV130();
return res;
};

// Точный счетчик на чипе «🎬 Видео» (только из папки JennyVideo и видео-торрентов)
window.getTrackCountForTabV71 = function(tabId) {
if (tabId === 'videos') {
return (window._dedicatedVideoListV137 || []).length;
}
const allTracks = ((window.lastData && window.lastData.all_tracks) || []).filter(fn => !window.isVideoFileNameV130(fn));
if (tabId === 'all') return allTracks.length;
if (tabId === 'fav') return (window.favorites || []).filter(fn => !window.isVideoFileNameV130(fn)).length;
return _origGetCntV130.apply(this, arguments);
};

// Отрисовка вкладки «🎬 Видео» из отдельной папки /storage/emulated/0/JennyVideo
window.renderActivePlaylistTracksV71 = function(scrollSubChipToCenter) {
if (window.activePlaylistTabV71 === 'videos') {
const unifiedBox = document.getElementById('unifiedList');
if (!unifiedBox) return;
window.mountPlaylistStripDOMV71();
const subWrap = document.getElementById('jennySubFilterWrapV71');
if (subWrap) {
subWrap.innerHTML = `
<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;margin-bottom:6px;background:#090d14;border:1px solid #30363d;border-radius:10px;font-size:11px;color:#8b949e;">
<span>📁 Папка: <b style="color:#58a6ff;">${window._dedicatedVideoDirPathV137}</b></span>
<button type="button" onclick="window.syncDiscoveredVideosIntoPlaylistV134(true)" style="padding:3px 8px;border-radius:7px;background:#161b22;border:1px solid #58a6ff;color:#58a6ff;font-size:10.5px;font-weight:bold;">🔄 Обновить</button>
</div>`;
}
const items = window.collectClientTorrentVideosV137();
const vids = items.map(x => x.name);
const sorted = window.sortTrackArrayForTabV71 ? window.sortTrackArrayForTabV71(vids, 'videos') : vids;
window.viewedFullTabListV73 = [...sorted];
const cntEl = document.getElementById('tracksCount');
if (cntEl) cntEl.innerText = sorted.length;

unifiedBox.innerHTML = sorted.length
? sorted.map(fn => buildTrackRowHTML(fn, 'main', (window.favorites || []).includes(fn) ? '❤️' : '🤍')).join('')
: `<div style="padding:22px;color:#8b949e;text-align:center;line-height:1.5;">🎬 В папке <b>${window._dedicatedVideoDirPathV137}</b> пока пусто.<br>Скачай фильм в <b>Торрент-студии</b> или закинь видео в эту папку!</div>`;
window.decorateVideoIconsInListV130();
return;
}

// Для всех музыкальных вкладок скрываем видеофайлы
if (window.lastData && Array.isArray(window.lastData.all_tracks)) {
window.lastData.all_tracks = window.lastData.all_tracks.filter(fn => !window.isVideoFileNameV130(fn));
}
return _origRenderActivePlV130.apply(this, arguments);
};

/* [split] V150: кусок исходного IIFE (ui_v71.js, строки 12237–12748) → ui_playlist.js */
;(function() {

window.getTrackCountForTabV71 = function(tabId) {
    if (tabId === 'videos') {
        return window.getFilteredVideoItemsV150().length;
    }
    const allAudio = ((window.lastData && window.lastData.all_tracks) || []).filter(fn =>
        !window.isVideoFileNameV130(fn) && window.isAudioTrackAllowedByFormatSlotsV150(fn)
    );
    if (tabId === 'all') return allAudio.length;
    if (tabId === 'fav') {
        return (window.favorites || []).filter(fn => window.isTrackAllowedByFormatSlots(fn)).length;
    }
    if (tabId === 'artists') {
        const s = new Set();
        allAudio.forEach(fn => s.add(window.getTrackMetaV71(fn).artist));
        return s.size;
    }
    if (tabId === 'albums') {
        const s = new Set();
        allAudio.forEach(fn => s.add(window.getTrackMetaV71(fn).album));
        return s.size;
    }
    if (tabId === 'tags') {
        const { groups } = window.collectAllCustomTagGroupsV74();
        return Object.keys(groups).length;
    }
    const c = (window.appConfig.customPlaylistsV71 || []).find(p => p.id === tabId);
    if (c && Array.isArray(c.tracks)) {
        return c.tracks.filter(fn => window.isTrackAllowedByFormatSlots(fn)).length;
    }
    return 0;
};

// Дополняем updateScopedSearchPlaceholderV73 правильной подписью для вкладки «🎬 Видео»
const _prevUpdatePlaceholderV74 = window.updateScopedSearchPlaceholderV73;
window.updateScopedSearchPlaceholderV73 = function(baseCount) {
    if (window.activePlaylistTabV71 === 'videos') {
        const sInp = document.getElementById('trackSearchInput');
        if (!sInp) return;
        const cnt = (typeof baseCount === 'number') ? baseCount : window.getFilteredVideoItemsV150().length;
        sInp.placeholder = window.tr(`🔍 Поиск в «Видео» (${cnt})...`, `🔍 Search in "Videos" (${cnt})...`);
        const clrBtn = document.getElementById('btnClearTrackSearchV73');
        if (clrBtn) clrBtn.style.display = (sInp.value && sInp.value.length > 0) ? 'inline-flex' : 'none';
        return;
    }
    return _prevUpdatePlaceholderV74.apply(this, arguments);
};

// Переопределяем renderActivePlaylistTracksV71 для вкладки «🎬 Видео» (БЕЗ лишней плашки папки сверху и с единым счётчиком!)
const _prevRenderActivePlV137 = window.renderActivePlaylistTracksV71;
window.renderActivePlaylistTracksV71 = function(scrollSubChipToCenter) {
    if (window.activePlaylistTabV71 === 'videos') {
        const unifiedBox = document.getElementById('unifiedList');
        if (!unifiedBox) return;
        window.mountPlaylistStripDOMV71();

        // Убираем ненужную плашку "📁 Папка: /storage/emulated/0/JennyVideo [🔄 Обновить]" над списком видео!
        const subWrap = document.getElementById('jennySubFilterWrapV71');
        if (subWrap) {
            subWrap.innerHTML = '';
        }
        if (typeof window.syncHeaderHeightWithModalsV71 === 'function') {
            window.syncHeaderHeightWithModalsV71();
        }

        const items = window.getFilteredVideoItemsV150();
        const vids = items.map(x => x.name);
        const sorted = window.sortTrackArrayForTabV71 ? window.sortTrackArrayForTabV71(vids, 'videos') : vids;
        window.viewedFullTabListV73 = [...sorted];

        window.updateScopedSearchPlaceholderV73(sorted.length);
        const cntEl = document.getElementById('tracksCount');
        if (cntEl) cntEl.innerText = sorted.length;

        unifiedBox.innerHTML = sorted.length
            ? sorted.map(fn => buildTrackRowHTML(fn, 'main', (window.favorites || []).includes(fn) ? '❤️' : '🤍')).join('')
            : `<div style="padding:22px;color:#8b949e;text-align:center;line-height:1.5;">🎬 Видеофайлов по выбранным форматам и папкам нет.<br>Добавь папку через <b>📁</b> внизу или проверь форматы в <b>Деке Б</b>!</div>`;

        window.decorateVideoIconsInListV130();
        const sInp = document.getElementById('trackSearchInput');
        if (sInp && sInp.value.trim() && typeof window.filterTracks === 'function') {
            window.filterTracks(sInp.value);
        }
        return;
    }
    return _prevRenderActivePlV137.apply(this, arguments);
};

// 5. Умная кнопка обновления 🔄 (#tracksCount) внизу над плеером:
// В «Видео» обновляет только видео, в аудио-вкладках — только аудио, в смешанных (Избранное / свои плейлисты) — и то и другое!
window.smartRefreshCurrentPlaylistV150 = async function(ev, silentToast) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const tabId = window.activePlaylistTabV71 || 'all';
    const cntEl = document.getElementById('tracksCount');
    if (cntEl) cntEl.innerText = '⏳';

    const isVideoTab = (tabId === 'videos');
    const isMixedTab = (tabId === 'fav' || String(tabId).startsWith('pl_'));

    try {
        if (isVideoTab) {
            await window.syncDiscoveredVideosIntoPlaylistV134(true);
            window.renderPlaylistStripChipsV71();
            window.renderActivePlaylistTracksV71(false);
            const vCnt = window.getFilteredVideoItemsV150().length;
            if (cntEl) cntEl.innerText = vCnt;
            if (!silentToast && typeof window.showToast === 'function') {
                window.showToast(`🔄 Видео обновлены: ${vCnt} шт. (по форматам Деки Б)`, ev);
            }
        } else if (isMixedTab) {
            await Promise.all([
                window.fetchData(),
                window.syncDiscoveredVideosIntoPlaylistV134(true)
            ]);
            window.renderPlaylistStripChipsV71();
            window.renderActivePlaylistTracksV71(false);
            const mCnt = window.getTrackCountForTabV71(tabId);
            if (cntEl) cntEl.innerText = mCnt;
            if (!silentToast && typeof window.showToast === 'function') {
                window.showToast(`🔄 Смешанный список обновлён (Аудио + Видео): ${mCnt} шт.`, ev);
            }
        } else {
            await window.fetchData();
            window.renderPlaylistStripChipsV71();
            window.renderActivePlaylistTracksV71(false);
            const aCnt = (window.viewedFullTabListV73 || []).length;
            if (cntEl) cntEl.innerText = aCnt;
            if (!silentToast && typeof window.showToast === 'function') {
                window.showToast(`🔄 Аудио обновлено: ${aCnt} шт. (по форматам Деки А)`, ev);
            }
        }
    } catch (e) {}
};

window.bindSmartRefreshBtnV150 = function() {
    const cntEl = document.getElementById('tracksCount');
    const btn = cntEl ? cntEl.closest('button') : null;
    if (btn && !btn._smartRefreshBoundV150) {
        btn._smartRefreshBoundV150 = true;
        btn.onclick = (e) => window.smartRefreshCurrentPlaylistV150(e, false);
    }
};

// 6. При выборе папки через системный проводник 📂 (onNativeFolderPicked) сразу обновляем и аудио, и видео,
// и вновь открываем окно менеджера папок 📁, чтобы пользователь сразу увидел добавленную папку в списке!
window._folderPickedFromManagerV150 = false;
const _origTriggerSysPickerV62 = window.triggerSystemFolderPickerV62;
window.triggerSystemFolderPickerV62 = function() {
    window._folderPickedFromManagerV150 = true;
    return _origTriggerSysPickerV62.apply(this, arguments);
};

window.onNativeFolderPicked = async function(folderPath) {
    if (!folderPath) return;
    try {
        const res = await fetch('/api/folders_v71', {
            method: 'POST',
            body: JSON.stringify({ action: 'add', path: folderPath })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            await Promise.all([
                window.fetchData(),
                window.syncDiscoveredVideosIntoPlaylistV134(true)
            ]);
            window.renderPlaylistStripChipsV71();
            window.renderActivePlaylistTracksV71(false);
            let shortName = folderPath.split('/').filter(Boolean).pop() || folderPath;
            if (typeof window.showToast === 'function') {
                window.showToast('📁 Добавлена и включена папка: ' + shortName);
            }
            if (window._folderPickedFromManagerV150) {
                window._folderPickedFromManagerV150 = false;
                window.openFolderManagerModalV62();
            }
        }
    } catch (e) {}
};

// Переопределяем toggleFolderActivePoolV71 и removeFolderFromPoolV71, чтобы переключение папок в 📁 сразу обновляло и видео тоже!
window.toggleFolderActivePoolV71 = async function(fp, ev) {
    const d = await (await fetch('/api/folders_v71', { method: 'POST', body: JSON.stringify({ action: 'toggle', path: fp }) })).json();
    if (d.status === 'ok') {
        await Promise.all([
            window.fetchData(),
            window.syncDiscoveredVideosIntoPlaylistV134(true)
        ]);
        window.renderPlaylistStripChipsV71();
        window.renderActivePlaylistTracksV71(false);
        window.openFolderManagerModalV62();
    } else if (typeof window.showToast === 'function') {
        window.showToast('❌ ' + (d.error || 'Ошибка'), ev);
    }
};

window.removeFolderFromPoolV71 = async function(fp) {
    const d = await (await fetch('/api/folders_v71', { method: 'POST', body: JSON.stringify({ action: 'remove', path: fp }) })).json();
    if (d.status === 'ok') {
        await Promise.all([
            window.fetchData(),
            window.syncDiscoveredVideosIntoPlaylistV134(true)
        ]);
        window.renderPlaylistStripChipsV71();
        window.renderActivePlaylistTracksV71(false);
        window.openFolderManagerModalV62();
    }
};
})();

/* [split] V215: кусок исходного IIFE (ui_v71.js, строки 18904–19635) → ui_playlist.js */
;(function() {
    if (window._jennyV215Installed__playlist) return;
    window._jennyV215Installed__playlist = true;
    window._jennyV215Installed = true;

    // -------------------------------------------------------------------------
    // 8. АВТОЗАГРУЗКА ВСЕХ 93 АУДИОТРЕКОВ ПРИ СТАРТЕ В ВКЛАДКУ "🎵 ВСЕ 93"
    // -------------------------------------------------------------------------
    async function autoRefreshAllAudioOnStartupV215() {
        try {
            if (typeof window.ensureDualDeckFormatSlotsV150 === 'function') {
                window.ensureDualDeckFormatSlotsV150();
            }
            if (typeof window.syncFormatSlotsUI === 'function') {
                window.syncFormatSlotsUI();
            }
            if (typeof window.fetchData === 'function') {
                await window.fetchData();
            }
            if (typeof window.renderPlaylistStripChipsV71 === 'function') {
                window.renderPlaylistStripChipsV71();
            }
            if (typeof window.renderActivePlaylistTracksV71 === 'function' && window.activePlaylistTabV71 !== 'videos') {
                window.renderActivePlaylistTracksV71(false);
            }
            var cntEl = document.getElementById('tracksCount');
            if (cntEl && window.activePlaylistTabV71 !== 'videos' && Array.isArray(window.viewedFullTabListV73)) {
                cntEl.innerText = window.viewedFullTabListV73.length;
            }
        } catch (e) {}
    }

    setTimeout(autoRefreshAllAudioOnStartupV215, 450);
    setTimeout(autoRefreshAllAudioOnStartupV215, 1600);
})();

/* [split] V216: кусок исходного IIFE (ui_v71.js, строки 19638–21240) → ui_playlist.js */
;(function() {
    if (window._jennyV216Installed__playlist) return;
    window._jennyV216Installed__playlist = true;
    window._jennyV216Installed = true;

    // -------------------------------------------------------------------------
    // 5. ПОДСПИСОК [🎵 АУДИО] / [🎬 ВИДЕО] ВНУТРИ ВКЛАДКИ "❤️ ИЗБРАННОЕ" (71417.mp4, 03:35-03:55)
    //    И СТАТУС "⏳ ЗАГРУЗКА МЕДИАТЕКИ..." ПРИ ХОЛОДНОМ СТАРТЕ (71419.mp4, 02:31-02:36)
    // -------------------------------------------------------------------------
    window._favSubTabV216 = window._favSubTabV216 || 'audio';
    window._initialLibraryLoadedV216 = false;

    var _origFetchDataV216 = window.fetchData;
    if (typeof _origFetchDataV216 === 'function' && !_origFetchDataV216._v216Wrapped) {
        window.fetchData = async function() {
            var r = await _origFetchDataV216.apply(this, arguments);
            window._initialLibraryLoadedV216 = true;
            window.syncDualDeckCountersV216();
            return r;
        };
        window.fetchData._v216Wrapped = true;
    }

    var _origRenderActivePlV216 = window.renderActivePlaylistTracksV71;
    if (typeof _origRenderActivePlV216 === 'function' && !_origRenderActivePlV216._v216Wrapped) {
        window.renderActivePlaylistTracksV71 = function(preserveScroll) {
            var tabId = window.activePlaylistTabV71 || 'all';
            var unifiedBox = document.getElementById('unifiedList');

            // 1) При холодном старте (пока первый запрос ещё идёт) во вкладке «Видео» пишем «⏳ Загрузка медиатеки...», а не «Видеофайлов нет»!
            if (tabId === 'videos' && !window._initialLibraryLoadedV216) {
                var vItemsInit = window.getFilteredVideoItemsV150 ? window.getFilteredVideoItemsV150() : [];
                if (vItemsInit.length === 0 && unifiedBox) {
                    unifiedBox.innerHTML = '<div style="padding:26px;color:#58a6ff;text-align:center;font-weight:bold;">⏳ Загрузка медиатеки...</div>';
                    return;
                }
            }

            // 2) Если открыта вкладка «❤️ Избранное» (tabId === 'fav') — выводим под ней 2 кнопки пополам: [🎵 Аудио] и [🎬 Видео]!
            if (tabId === 'fav' && unifiedBox) {
                window.mountPlaylistStripDOMV71();
                var subWrap = document.getElementById('jennySubFilterWrapV71');
                var favAll = Array.isArray(window.favorites) ? window.favorites : [];
                var favVid = favAll.filter(function(fn) { return window.isVideoFileNameV130 && window.isVideoFileNameV130(fn); });
                var favAud = favAll.filter(function(fn) { return !(window.isVideoFileNameV130 && window.isVideoFileNameV130(fn)); });

                var mode = window._favSubTabV216 || 'audio';
                if (mode === 'audio' && favAud.length === 0 && favVid.length > 0) mode = 'video';
                if (mode === 'video' && favVid.length === 0 && favAud.length > 0) mode = 'audio';
                window._favSubTabV216 = mode;

                if (subWrap) {
                    var isAud = (mode === 'audio');
                    subWrap.innerHTML =
                        '<div id="jennySubFilterBarActiveV73" class="jenny-subfilter-bar-v71" style="display:flex;width:100%;gap:6px;padding:2px 0;">' +
                            '<div class="jenny-pl-chip-v71' + (isAud ? ' active-pl-chip' : '') + '" onclick="window._favSubTabV216=\'audio\';window.renderActivePlaylistTracksV71(false);" style="flex:1;justify-content:center;text-align:center;">' +
                                '🎵 Аудио <span class="jenny-pl-chip-count-v71">' + favAud.length + '</span>' +
                            '</div>' +
                            '<div class="jenny-pl-chip-v71' + (!isAud ? ' active-pl-chip' : '') + '" onclick="window._favSubTabV216=\'video\';window.renderActivePlaylistTracksV71(false);" style="flex:1;justify-content:center;text-align:center;">' +
                                '🎬 Видео <span class="jenny-pl-chip-count-v71">' + favVid.length + '</span>' +
                            '</div>' +
                        '</div>';
                }
                if (typeof window.syncHeaderHeightWithModalsV71 === 'function') {
                    window.syncHeaderHeightWithModalsV71();
                }

                var targetList = (mode === 'video') ? favVid : favAud;
                var sorted = window.sortTrackArrayForTabV71 ? window.sortTrackArrayForTabV71(targetList, 'fav') : targetList;
                window.viewedFullTabListV73 = sorted.slice();
                window.currentTrackList = sorted;
                if (typeof window.updateScopedSearchPlaceholderV73 === 'function') {
                    window.updateScopedSearchPlaceholderV73(sorted.length);
                }

                if (sorted.length === 0) {
                    unifiedBox.innerHTML = '<div style="padding:22px;color:#8b949e;text-align:center;">' +
                        (mode === 'video' ? '🎬 В избранном пока нет видеофайлов' : '🎵 В избранном пока нет аудиотреков') +
                        '</div>';
                } else {
                    unifiedBox.innerHTML = sorted.map(function(fn) {
                        return window.buildTrackRowHTML(fn, 'fav', '❤️');
                    }).join('');
                }
                if (typeof window.decorateVideoIconsInListV130 === 'function') {
                    window.decorateVideoIconsInListV130();
                }
                return;
            }

            return _origRenderActivePlV216.apply(this, arguments);
        };
        window.renderActivePlaylistTracksV71._v216Wrapped = true;
    }
})();

/* [split] V218: кусок исходного IIFE (ui_v71.js, строки 22588–24059) → ui_playlist.js */
;(function() {
    if (window._jennyV218Installed__playlist) return;
    window._jennyV218Installed__playlist = true;
    window._jennyV218Installed = true;

    window.syncPersistentUserDataV218 = function(immediate) {
        var doSync = function() {
            try {
                var payload = {
                    favorites: Array.isArray(window.favorites) ? window.favorites : [],
                    customPlaylistsV71: (window.appConfig && window.appConfig.customPlaylistsV71) || [],
                    visiblePlaylistTabsV71: (window.appConfig && window.appConfig.visiblePlaylistTabsV71) || {},
                    playlistSortMapV71: (window.appConfig && window.appConfig.playlistSortMapV71) || {},
                    trackPlayStatsV71: (window.appConfig && window.appConfig.trackPlayStatsV71) || {},
                    pinnedSourcesV91: (window.appConfig && window.appConfig.pinnedSourcesV91) || ['ost', 'radio', 'soundcloud', 'torrent'],
                    deckAEq: window._deckAEqV218 || (window._musicConfigRefV131 && window._musicConfigRefV131.eq) || { b60: 0, b230: 0, b910: 0, b3600: 0, b14000: 0 },
                    deckBEq: window._deckBEqV218 || (window.videoDeckV131 && window.videoDeckV131.config && window.videoDeckV131.config.eq) || { b60: 0, b230: 0, b910: 0, b3600: 0, b14000: 0 },
                    deckAScrubZones: (window._musicConfigRefV131 && window._musicConfigRefV131.scrubZones) || null,
                    deckBScrubZones: (window.videoDeckV131 && window.videoDeckV131.config && window.videoDeckV131.config.scrubZones) || null
                };
                fetch('/api/user_data/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(function(){});
            } catch (e) {}
        };
        if (window._syncUserDataTimerV218) clearTimeout(window._syncUserDataTimerV218);
        if (immediate) doSync();
        else window._syncUserDataTimerV218 = setTimeout(doSync, 350);
    };

    window.loadPersistentUserDataV218 = async function() {
        try {
            var res = await fetch('/api/user_data/load');
            if (!res.ok) return;
            var j = await res.json();
            var d = (j && j.data) || {};
            var changed = false;

            if (Array.isArray(d.favorites) && d.favorites.length > 0) {
                var curFavs = Array.isArray(window.favorites) ? window.favorites : [];
                d.favorites.forEach(function(fn) {
                    if (fn && curFavs.indexOf(fn) === -1) {
                        curFavs.push(fn);
                        changed = true;
                    }
                });
                window.favorites = curFavs;
                try { localStorage.setItem('ytm_favs', JSON.stringify(window.favorites)); } catch (e) {}
            }

            if (window.appConfig) {
                if (Array.isArray(d.customPlaylistsV71) && d.customPlaylistsV71.length > 0) {
                    var existingIds = new Set((window.appConfig.customPlaylistsV71 || []).map(function(p) { return p.id; }));
                    d.customPlaylistsV71.forEach(function(pl) {
                        if (pl && pl.id && !existingIds.has(pl.id)) {
                            window.appConfig.customPlaylistsV71.push(pl);
                            changed = true;
                        }
                    });
                }
                if (d.visiblePlaylistTabsV71 && typeof d.visiblePlaylistTabsV71 === 'object') {
                    window.appConfig.visiblePlaylistTabsV71 = Object.assign({}, d.visiblePlaylistTabsV71, window.appConfig.visiblePlaylistTabsV71 || {});
                }
                if (d.playlistSortMapV71 && typeof d.playlistSortMapV71 === 'object') {
                    window.appConfig.playlistSortMapV71 = Object.assign({}, d.playlistSortMapV71, window.appConfig.playlistSortMapV71 || {});
                }
                if (changed) {
                    try { localStorage.setItem('ytm_config', JSON.stringify(window.appConfig)); } catch (e) {}
                }
            }

            if (d.deckAEq && !localStorage.getItem('jenny_eq_deckA_v218')) {
                window._deckAEqV218 = d.deckAEq;
                try { localStorage.setItem('jenny_eq_deckA_v218', JSON.stringify(d.deckAEq)); } catch (e) {}
            }
            if (d.deckBEq && !localStorage.getItem('jenny_eq_deckB_v218')) {
                window._deckBEqV218 = d.deckBEq;
                try { localStorage.setItem('jenny_eq_deckB_v218', JSON.stringify(d.deckBEq)); } catch (e) {}
            }

            if (changed) {
                if (typeof window.renderPlaylistStripChipsV71 === 'function') window.renderPlaylistStripChipsV71();
                if (typeof window.renderActivePlaylistTracksV71 === 'function') window.renderActivePlaylistTracksV71(true);
                window.syncDeckFavButtonsUIV218();
            }
        } catch (e) {}
    };

    // Оборачиваем toggleFav и savePlaylistStateQuietlyV71, чтобы любое изменение сразу сохранялось на внешний диск
    var _origToggleFavV218 = window.toggleFav;
    window.toggleFav = function(filename) {
        if (typeof _origToggleFavV218 === 'function') {
            _origToggleFavV218.apply(this, arguments);
        } else {
            window.favorites = Array.isArray(window.favorites) ? window.favorites : [];
            var idx = window.favorites.indexOf(filename);
            if (idx !== -1) window.favorites.splice(idx, 1);
            else window.favorites.unshift(filename);
            try { localStorage.setItem('ytm_favs', JSON.stringify(window.favorites)); } catch (e) {}
        }
        window.syncDeckFavButtonsUIV218();
        window.syncPersistentUserDataV218(true);
    };

    var _origSavePlQuietV218 = window.savePlaylistStateQuietlyV71;
    window.savePlaylistStateQuietlyV71 = function() {
        if (typeof _origSavePlQuietV218 === 'function') _origSavePlQuietV218.apply(this, arguments);
        window.syncPersistentUserDataV218(false);
    };

    // -------------------------------------------------------------------------
    // 4. КНОПКИ СЕРДЕЧКА (🤍 / ❤️) В ПАНЕЛЯХ ДЕКИ А (#btn-favModal) И ДЕКИ Б (#btnFavDeckBV216)
    //    Добавляют/удаляют текущий играющий трек или видео в Избранное с компактным уведомлением!
    //    (НЕ открывают список избранного и НЕ перекрывают открытый эквалайзер / настройки!)
    // -------------------------------------------------------------------------
    var HEART_OUTLINE_SVG_V218 = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    var HEART_FILLED_SVG_V218  = '<svg viewBox="0 0 24 24" width="15" height="15" fill="#f43f5e" stroke="#f43f5e" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

    // -------------------------------------------------------------------------
    // 10. СОРТИРОВКА "📂 ПО ТИПУ ФАЙЛОВ (А ➔ Я / Я ➔ А)" И КЛИКАБЕЛЬНОСТЬ ПУСТЫХ ВКЛАДОК В ИЗБРАННОМ
    // -------------------------------------------------------------------------
    if (Array.isArray(window.SORT_METHODS_V71) && !window.SORT_METHODS_V71.some(function(s) { return s.id === 'ext'; })) {
        window.SORT_METHODS_V71.splice(2, 0, {
            id: 'ext',
            defDir: 'asc',
            ru: '📂 По типу файлов (А ➔ Я / Я ➔ А)',
            en: '📂 By File Type (A ➔ Z / Z ➔ A)'
        });
    }

    var _prevSortTracksV218 = window.sortTrackArrayForTabV71;
    window.sortTrackArrayForTabV71 = function(tracksArr, tabId) {
        if (typeof window.ensurePlaylistStateV71 === 'function') window.ensurePlaylistStateV71();
        var smap = (window.appConfig && window.appConfig.playlistSortMapV71) || {};
        var sc = smap[tabId] || {};
        if (sc.mode === 'ext') {
            var mul = (sc.dir === 'desc') ? -1 : 1;
            var arr = (tracksArr || []).slice();
            arr.sort(function(a, b) {
                var sa = String(a || '').toLowerCase();
                var sb = String(b || '').toLowerCase();
                var dotA = sa.lastIndexOf('.');
                var dotB = sb.lastIndexOf('.');
                var extA = dotA !== -1 ? sa.slice(dotA + 1) : '';
                var extB = dotB !== -1 ? sb.slice(dotB + 1) : '';
                if (extA !== extB) {
                    return extA.localeCompare(extB) * mul;
                }
                return sa.localeCompare(sb) * mul;
            });
            return arr;
        }
        return _prevSortTracksV218 ? _prevSortTracksV218.apply(this, arguments) : tracksArr;
    };

    // Разрешаем кликать на пустую подвкладку "🎵 Аудио 0" или "🎬 Видео 0" внутри "❤️ Избранное" без авто-отскока!
    window.selectFavSubTabExplicitV218 = function(subMode) {
        window._favSubTabV216 = subMode;
        window._userExplicitFavSubTabV218 = true;
        if (typeof window.renderActivePlaylistTracksV71 === 'function') {
            window.renderActivePlaylistTracksV71(false);
        }
    };

    var _prevRenderPlV218 = window.renderActivePlaylistTracksV71;
    window.renderActivePlaylistTracksV71 = function(preserveScroll) {
        var tabId = window.activePlaylistTabV71 || 'all';
        if (tabId === 'fav') {
            var unifiedBox = document.getElementById('unifiedList');
            if (!unifiedBox) return;
            if (typeof window.mountPlaylistStripDOMV71 === 'function') window.mountPlaylistStripDOMV71();
            var subWrap = document.getElementById('jennySubFilterWrapV71');

            var favAll = (window.favorites || []).slice();
            var favVid = favAll.filter(function(fn) { return window.isVideoFileNameV130 && window.isVideoFileNameV130(fn); });
            var favAud = favAll.filter(function(fn) { return !(window.isVideoFileNameV130 && window.isVideoFileNameV130(fn)); });

            var mode = window._favSubTabV216 || 'audio';
            if (!window._userExplicitFavSubTabV218) {
                if (mode === 'audio' && favAud.length === 0 && favVid.length > 0) mode = 'video';
                if (mode === 'video' && favVid.length === 0 && favAud.length > 0) mode = 'audio';
                window._favSubTabV216 = mode;
            }

            if (subWrap) {
                var isAud = (mode === 'audio');
                subWrap.innerHTML =
                    '<div id="jennySubFilterBarActiveV73" class="jenny-subfilter-bar-v71" style="display:flex;width:100%;gap:6px;padding:2px 0;">' +
                        '<div class="jenny-pl-chip-v71' + (isAud ? ' active-pl-chip' : '') + '" onclick="window.selectFavSubTabExplicitV218(\'audio\')" style="flex:1;justify-content:center;text-align:center;cursor:pointer;">' +
                            '🎵 Аудио <span class="jenny-pl-chip-count-v71">' + favAud.length + '</span>' +
                        '</div>' +
                        '<div class="jenny-pl-chip-v71' + (!isAud ? ' active-pl-chip' : '') + '" onclick="window.selectFavSubTabExplicitV218(\'video\')" style="flex:1;justify-content:center;text-align:center;cursor:pointer;">' +
                            '🎬 Видео <span class="jenny-pl-chip-count-v71">' + favVid.length + '</span>' +
                        '</div>' +
                    '</div>';
            }
            if (typeof window.syncHeaderHeightWithModalsV71 === 'function') {
                window.syncHeaderHeightWithModalsV71();
            }

            var targetList = (mode === 'video') ? favVid : favAud;
            var sorted = window.sortTrackArrayForTabV71 ? window.sortTrackArrayForTabV71(targetList, 'fav') : targetList;
            window.viewedFullTabListV73 = sorted.slice();
            window.currentTrackList = sorted;
            if (typeof window.updateScopedSearchPlaceholderV73 === 'function') {
                window.updateScopedSearchPlaceholderV73(sorted.length);
            }

            if (sorted.length === 0) {
                unifiedBox.innerHTML = '<div style="padding:22px;color:#8b949e;text-align:center;">' +
                    (mode === 'video' ? '🎬 В избранном пока нет видеофайлов' : '🎵 В избранном пока нет аудиотреков') +
                    '</div>';
            } else {
                unifiedBox.innerHTML = sorted.map(function(fn) {
                    return window.buildTrackRowHTML(fn, 'fav', '❤️');
                }).join('');
            }
            if (typeof window.decorateVideoIconsInListV130 === 'function') {
                window.decorateVideoIconsInListV130();
            }
            return;
        }
        return _prevRenderPlV218 ? _prevRenderPlV218.apply(this, arguments) : undefined;
    };
})();

/* [split] V229: кусок исходного IIFE (ui_v71.js, строки 27956–28395) → ui_playlist.js */
;(function() {
    if (window._jennyV229Installed__playlist) return;
    window._jennyV229Installed__playlist = true;
    window._jennyV229Installed = true;

    window.installTracksCountAntiBlinkLockV229 = function() {
        var cntA = document.getElementById('tracksCount');
        if (cntA && !cntA._v229Locked) {
            cntA._v229Locked = true;
            var desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText') ||
                       Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
            if (desc && desc.set && desc.get) {
                Object.defineProperty(cntA, 'innerText', {
                    configurable: true,
                    get: function() { return desc.get.call(this); },
                    set: function(val) {
                        var s = String(val !== undefined && val !== null ? val : '');
                        if (s === '⏳') {
                            if (desc.get.call(this) !== '⏳') desc.set.call(this, '⏳');
                            return;
                        }
                        var targetStr = s;
                        if (typeof window.computeActiveViewCountV242 === 'function') {
                            targetStr = String(window.computeActiveViewCountV242());
                        } else {
                            var counts = window.computeAudioAndVideoCountsV229();
                            var isVid = (window.activePlaylistTabV71 === 'videos' || (window.activePlaylistTabV71 === 'fav' && window._favSubTabV216 === 'video'));
                            targetStr = String(isVid ? counts.videoCount : (counts.audioCount > 0 ? counts.audioCount : s));
                        }
                        if (desc.get.call(this) !== targetStr) {
                            desc.set.call(this, targetStr);
                        }
                    }
                });
            }
        }
    };

    var _origRenderActivePlV229 = window.renderActivePlaylistTracksV71;
    if (typeof _origRenderActivePlV229 === 'function' && !_origRenderActivePlV229._v229Wrapped) {
        window.renderActivePlaylistTracksV71 = function() {
            window.installTracksCountAntiBlinkLockV229();
            var res = _origRenderActivePlV229.apply(this, arguments);
            window.syncDualDeckCountersV216();
            return res;
        };
        window.renderActivePlaylistTracksV71._v229Wrapped = true;
    }

    setTimeout(function() {
        window.installTracksCountAntiBlinkLockV229();
        window.syncDualDeckCountersV216();
    }, 120);
})();

/* [split] V232: кусок исходного IIFE (ui_v71.js, строки 29055–29548) → ui_playlist.js */
;(function() {
    if (window._jennyV232Installed__playlist) return;
    window._jennyV232Installed__playlist = true;
    window._jennyV232Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    var PLAY_ICON_SVG_V232 = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    var PAUSE_ICON_SVG_V232 = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    var ROW_PLAY_SVG_V232 = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    var ROW_PAUSE_SVG_V232 = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

    // Обновляем иконки Play/Pause в списке треков без лишней перезаписи innerHTML (чтобы не срывать клик по кнопке!)
    window.updateTrackListPlayIcons = function() {
        var isPlayingNow = window.isDeckAActuallyPlayingV232();
        var btnMain = document.getElementById('playPauseBtn');
        if (btnMain) {
            var wantMainSvg = isPlayingNow ? PAUSE_ICON_SVG_V232 : PLAY_ICON_SVG_V232;
            var hasPausePath = btnMain.innerHTML.indexOf('M6 19h4V5H6v14') !== -1;
            if (isPlayingNow && !hasPausePath) btnMain.innerHTML = wantMainSvg;
            else if (!isPlayingNow && hasPausePath) btnMain.innerHTML = wantMainSvg;
        }

        document.querySelectorAll('.track-row-capsule').forEach(function(row) {
            var trackName = row.getAttribute('data-track');
            var btn = row.querySelector('.track-row-play-btn');
            var isCurrent = Boolean(window.currentPlayingTrack && trackName === window.currentPlayingTrack);

            if (isCurrent) {
                row.style.border = '1px solid #7341be';
                row.style.boxShadow = '0 0 10px rgba(115, 65, 190, 0.4)';
            } else {
                row.style.border = '1px solid #30363d';
                row.style.boxShadow = 'none';
            }

            if (btn && !(window.isVideoFileNameV130 && window.isVideoFileNameV130(trackName))) {
                var showPause = Boolean(isCurrent && isPlayingNow);
                var rowHasPause = btn.innerHTML.indexOf('M6 19h4V5H6v14') !== -1;
                if (showPause && !rowHasPause) {
                    btn.innerHTML = ROW_PAUSE_SVG_V232;
                } else if (!showPause && rowHasPause) {
                    btn.innerHTML = ROW_PLAY_SVG_V232;
                }
            }
        });
    };

    // -------------------------------------------------------------------------
    // 4. ОСТАНОВКА ТРЕКА ПРИ ОТКЛЮЧЕНИИ/СМЕНЕ ПАПКИ И ПО ОКОНЧАНИИ ЕДИНСТВЕННОЙ ПЕСНИ В СПИСКЕ (71585.mp4)
    //    - Если пользователь в «📁 Папки» снял галочку с папки (или сменил список), и текущего трека больше нет в списке —
    //      немедленно останавливаем и выгружаем старый трек!
    //    - Если в текущем списке/папке всего 1 песня, то по её окончании (onended) плеер ОСТАНАВЛИВАЕТСЯ, а не крутит её вечно по кругу!
    // -------------------------------------------------------------------------
    var _origFetchDataV232 = window.fetchData;
    if (typeof _origFetchDataV232 === 'function') {
        window.fetchData = async function() {
            var res = await _origFetchDataV232.apply(this, arguments);
            var allTracks = (window.lastData && Array.isArray(window.lastData.all_tracks)) ? window.lastData.all_tracks : [];
            var allSet = new Set(allTracks);

            // Очищаем очередь воспроизведения от треков из отключённых папок
            if (Array.isArray(window.playingQueueListV73)) {
                window.playingQueueListV73 = window.playingQueueListV73.filter(function(fn) { return allSet.has(fn); });
            }

            // Если текущий трек принадлежит папке, которую пользователь отключил (или список стал пуст) — сразу останавливаем его!
            if (window.currentPlayingTrack && !allSet.has(window.currentPlayingTrack)) {
                window.forceStopPauseDeckAAudioV232(true);
            }
            return res;
        };
    }
})();

/* [split] V235: кусок исходного IIFE (ui_v71.js, строки 29842–30652) → ui_playlist.js */
;(function() {
    if (window._jennyV235Installed__playlist) return;
    window._jennyV235Installed__playlist = true;
    window._jennyV235Installed = true;

    // -------------------------------------------------------------------------
    // 2. MOUNT #searchRightSlotV235 RIGHT NEXT TO #trackSearchInput AND PLACE #mainLangToggleBtn THERE
    // -------------------------------------------------------------------------
    window._refreshButtonsRelocatedToSearchV235 = false;

    window.ensureSearchRightSlotAndLangBtnV235 = function() {
        var sInp = document.getElementById('trackSearchInput');
        if (!sInp || !sInp.parentElement) return null;

        var outerWrap = sInp.parentElement;
        outerWrap.classList.add('jenny-search-wrap-v73', 'jenny-search-flex-row-v235');

        var rightSlot = document.getElementById('searchRightSlotV235');
        if (!rightSlot) {
            rightSlot = document.createElement('div');
            rightSlot.id = 'searchRightSlotV235';
            outerWrap.appendChild(rightSlot);
        }

        // Keep #btnClearTrackSearchV73 before #searchRightSlotV235 so it sits at the right edge of #trackSearchInput
        var clrBtn = document.getElementById('btnClearTrackSearchV73');
        if (clrBtn && clrBtn.parentElement === outerWrap && clrBtn.nextSibling !== rightSlot) {
            outerWrap.insertBefore(clrBtn, rightSlot);
        }

        // Keep #topAutoCeilMonitor if present
        var monEl = document.getElementById('topAutoCeilMonitor');
        if (monEl && monEl.parentElement === outerWrap && outerWrap.lastElementChild !== monEl) {
            outerWrap.appendChild(monEl);
        }

        // Ensure #mainLangToggleBtn exists and sits inside #searchRightSlotV235 until it runs/crawls away
        var langBtn = document.getElementById('mainLangToggleBtn');
        if (!langBtn) {
            langBtn = document.createElement('button');
            langBtn.id = 'mainLangToggleBtn';
            langBtn.type = 'button';
            langBtn.className = 'jenny-lang-btn';
            langBtn.onclick = function(e) {
                if (typeof window.toggleLanguage === 'function') window.toggleLanguage(e);
            };
        }
        if (!window._hasLangRunAway) {
            if (langBtn.parentElement !== rightSlot) {
                rightSlot.appendChild(langBtn);
            }
            langBtn.style.display = 'inline-flex';
            langBtn.style.opacity = '1';
            langBtn.style.pointerEvents = 'auto';
            langBtn.innerHTML = (typeof window.renderDualLangHTML === 'function')
                ? window.renderDualLangHTML(false)
                : 'RU / EN';
        } else {
            langBtn.style.display = 'none';
        }

        return rightSlot;
    };

    // Keep #searchRightSlotV235 visibility synced when modals open/close in updateTopSearchOrMonitorBar
    var _origUpdateTopBarV235 = window.updateTopSearchOrMonitorBar;
    if (typeof _origUpdateTopBarV235 === 'function') {
        window.updateTopSearchOrMonitorBar = function() {
            var res = _origUpdateTopBarV235.apply(this, arguments);
            var sInp = document.getElementById('trackSearchInput');
            var rightSlot = document.getElementById('searchRightSlotV235');
            var isInpHidden = Boolean(sInp && sInp.style.display === 'none');
            if (rightSlot) rightSlot.style.display = isInpHidden ? 'none' : 'inline-flex';
            return res;
        };
    }

    window.relocateRefreshButtonsToSearchSlotAnimatedV235 = function() {
        if (window._refreshButtonsRelocatedToSearchV235) {
            window.syncTopDockedRefreshVisibilityV235();
            return;
        }
        window._refreshButtonsRelocatedToSearchV235 = true;

        var rightSlot = window.ensureSearchRightSlotAndLangBtnV235();
        var mainBar = document.getElementById('mainTransportBar');
        var ctrlB = document.getElementById('deckBControlsRowV216');

        var cntSpanA = document.getElementById('tracksCount');
        var refBtnA = cntSpanA ? cntSpanA.closest('button') : null;
        if (refBtnA) refBtnA.id = 'btnRefreshDeckAV235';
        var refBtnB = document.getElementById('btnRefreshDeckBV216');

        // Phase 1 (0..380ms): Old refresh buttons under Deck B and Deck A shrink & fly up,
        // while Prev (+30%), Play/Pause (+15%), and Next (+30%) immediately expand to fill the freed space!
        if (refBtnA) refBtnA.classList.add('jenny-ref-btn-vacating-v235');
        if (refBtnB) refBtnB.classList.add('jenny-ref-btn-vacating-v235');
        if (mainBar) mainBar.classList.add('jenny-deck-row-expanded-v235');
        if (ctrlB) ctrlB.classList.add('jenny-deck-row-expanded-v235');

        // Phase 2 (after 380ms): Move both refresh buttons into #searchRightSlotV235 and play spring pop-in animation!
        setTimeout(function() {
            if (!rightSlot) rightSlot = window.ensureSearchRightSlotAndLangBtnV235();
            if (!rightSlot) return;

            var langBtn = document.getElementById('mainLangToggleBtn');
            if (langBtn) langBtn.style.display = 'none';

            // Place Video Refresh (🔄 30) and Audio Refresh (🔄 887) into #searchRightSlotV235
            if (refBtnB) {
                refBtnB.classList.remove('jenny-ref-btn-vacating-v235', 'jenny-sq-btn-v216', 'deckb-accent-v216');
                refBtnB.classList.add('jenny-top-ref-pill-v235', 'ref-video-v235');
                refBtnB.style.cssText = '';
                rightSlot.appendChild(refBtnB);
            }
            if (refBtnA) {
                refBtnA.classList.remove('jenny-ref-btn-vacating-v235', 'jenny-sq-btn-v216');
                refBtnA.classList.add('jenny-top-ref-pill-v235', 'ref-audio-v235');
                refBtnA.style.cssText = '';
                rightSlot.appendChild(refBtnA);
            }
            window.syncTopDockedRefreshVisibilityV235();
            if (typeof window.syncDualDeckCountersV216 === 'function') {
                window.syncDualDeckCountersV216();
            }
        }, 380);
    };

    window.findTrackRowElementInListV235 = function(targetFilename) {
        if (!targetFilename) return null;
        var cleanTarget = String(targetFilename).trim();
        var rows = document.querySelectorAll('#unifiedList .track-row-capsule');
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var dt = String(r.getAttribute('data-track') || '').trim();
            if (dt === cleanTarget) return r;
        }
        var lowerTarget = cleanTarget.toLowerCase();
        for (var j = 0; j < rows.length; j++) {
            var r2 = rows[j];
            var dt2 = String(r2.getAttribute('data-track') || '').trim().toLowerCase();
            if (dt2 === lowerTarget) return r2;
        }
        return null;
    };

    window.openAndHighlightPlayingPlaylistV235 = function(whichDeck, ev) {
        var isVid = (whichDeck === 'video');
        var targetFn = '';
        if (isVid) {
            var st = window._vidStateV130 || {};
            targetFn = (st.currentTitle && st.currentTitle !== '🎬 Дека Б: Выбери видео')
                ? String(st.currentTitle).trim()
                : (window.getCurrentDeckTargetFilenameV218 ? window.getCurrentDeckTargetFilenameV218('video') : '');
        } else {
            targetFn = window.currentPlayingTrack
                ? String(window.currentPlayingTrack).trim()
                : (window.getCurrentDeckTargetFilenameV218 ? window.getCurrentDeckTargetFilenameV218('audio') : '');
        }

        if (!targetFn) {
            if (typeof window.showToast === 'function') {
                window.showToast(isVid ? '🎬 В Деке Б сейчас не выбрано видео' : '🎵 В Деке А сейчас не выбран трек', ev);
            }
            return;
        }

        // 1. Close any open modals so the playlist is visible
        ['settingsModal', 'favModal', 'eqModal', 'specModal', 'themeModal'].forEach(function(id) {
            var m = document.getElementById(id);
            if (m) m.classList.remove('open');
        });
        if (typeof window.closeDeckBIsolatedModals === 'function') window.closeDeckBIsolatedModals();
        if (typeof window.closeAllV71Modals === 'function') {
            try { window.closeAllV71Modals(); } catch (e) {}
        }
        // If full-screen in-app video player is covering the screen, switch it to PiP mini-window so playlist is visible
        var vSt = window._vidStateV130 || {};
        if (vSt.active && !vSt.pipMode && !vSt.desktopOverlay && typeof window.toggleVideoPipModeV130 === 'function') {
            try { window.toggleVideoPipModeV130(); } catch (e) {}
        }

        // 2. Clear search filter if active so the target track/video isn't hidden
        var sInp = document.getElementById('trackSearchInput');
        if (sInp && sInp.value) {
            sInp.value = '';
            if (typeof window.filterTracks === 'function') window.filterTracks('');
        }

        // 3. Switch to the playlist tab where the playing audio or video belongs
        if (isVid) {
            var vidTab = window._activeVideoQueueContextV229 || 'videos';
            var favArr = Array.isArray(window.favorites) ? window.favorites : [];
            if (vidTab === 'fav' && favArr.indexOf(targetFn) !== -1) {
                window._favSubTabV216 = 'video';
                window._userExplicitFavSubTabV218 = true;
                if (typeof window.selectPlaylistTabV71 === 'function') window.selectPlaylistTabV71('fav');
            } else if (String(vidTab).indexOf('pl_') === 0) {
                if (typeof window.selectPlaylistTabV71 === 'function') window.selectPlaylistTabV71(vidTab);
            } else {
                if (typeof window.selectPlaylistTabV71 === 'function') window.selectPlaylistTabV71('videos');
            }

            if (!window.findTrackRowElementInListV235(targetFn)) {
                if (typeof window.selectPlaylistTabV71 === 'function') window.selectPlaylistTabV71('videos');
            }
        } else {
            var qCtx = window.playingQueueContextV73 || {};
            var audTab = qCtx.tabId || window.activePlaylistTabV71 || 'all';
            if (audTab === 'videos') audTab = 'all';

            if (audTab === 'fav') {
                var favAudArr = Array.isArray(window.favorites) ? window.favorites : [];
                if (favAudArr.indexOf(targetFn) !== -1) {
                    window._favSubTabV216 = 'audio';
                    window._userExplicitFavSubTabV218 = true;
                } else {
                    audTab = 'all';
                }
            } else if (audTab === 'artists' && qCtx.artist) {
                window.selectedArtistV71 = qCtx.artist;
            } else if (audTab === 'albums' && qCtx.album) {
                window.selectedAlbumV71 = qCtx.album;
            }

            if (typeof window.selectPlaylistTabV71 === 'function') {
                window.selectPlaylistTabV71(audTab);
            }
            if (!window.findTrackRowElementInListV235(targetFn) && audTab !== 'all') {
                if (typeof window.selectPlaylistTabV71 === 'function') {
                    window.selectPlaylistTabV71('all');
                }
            }
        }

        // 4. Scroll to & highlight the target row in #unifiedList
        setTimeout(function() {
            var row = window.findTrackRowElementInListV235(targetFn);
            if (!row) return;

            document.querySelectorAll('.jenny-hold-locate-audio-v235, .jenny-hold-locate-video-v235').forEach(function(el) {
                el.classList.remove('jenny-hold-locate-audio-v235', 'jenny-hold-locate-video-v235');
            });

            var cls = isVid ? 'jenny-hold-locate-video-v235' : 'jenny-hold-locate-audio-v235';
            row.classList.add(cls);
            try {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (e) {
                try { row.scrollIntoView(); } catch (e2) {}
            }

            if (typeof window.showToast === 'function') {
                window.showToast((isVid ? '🎬 Видео в плейлисте: ' : '🎵 Трек в плейлисте: ') + targetFn, ev);
            }

            setTimeout(function() {
                row.classList.remove(cls);
            }, 2800);
        }, 60);
    };

    // Initialize search bar right slot & start the 30-second RU/EN timer
    var initV235 = function() {
        window.ensureSearchRightSlotAndLangBtnV235();
        if (!window._hasLangRunAway && typeof window.scheduleLangRunawayTimer === 'function') {
            window.scheduleLangRunawayTimer();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(initV235, 120);
        });
    } else {
        setTimeout(initV235, 120);
    }
})();

/* [split] V236: кусок исходного IIFE (ui_v71.js, строки 30671–31598) → ui_playlist.js */
;(function() {
    if (window._jennyV236Installed__playlist) return;
    window._jennyV236Installed__playlist = true;
    window._jennyV236Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    var PIN_STORAGE_KEY_V236 = 'jenny_pinned_sources_locked_v236';

    var _origLoadPersistentV236 = window.loadPersistentUserDataV218;
    if (typeof _origLoadPersistentV236 === 'function') {
        window.loadPersistentUserDataV218 = async function() {
            var hadExplicitLock = false;
            try { hadExplicitLock = Boolean(localStorage.getItem(PIN_STORAGE_KEY_V236)); } catch (e) {}
            var lockedBefore = window.readLockedPinnedSourcesV236();
            var res = await _origLoadPersistentV236.apply(this, arguments);
            if (hadExplicitLock) {
                window.appConfig = window.appConfig || {};
                window.appConfig.pinnedSourcesV91 = lockedBefore.slice();
                try { localStorage.setItem('ytm_config', JSON.stringify(window.appConfig)); } catch (e) {}
            }
            return res;
        };
    }
})();

/* [split] V237: кусок исходного IIFE (ui_v71.js, строки 31602–32550) → ui_playlist.js */
;(function() {
    if (window._jennyV237Installed__playlist) return;
    window._jennyV237Installed__playlist = true;
    window._jennyV237Installed = true;

    // -------------------------------------------------------------------------
    // 4. INSTANT 0ms FOLDER MANAGER (#jennyFolderManagerModal) + COALESCED BACKGROUND fetchData
    //    SO THE 6-SOCKET HTTP POOL IS NEVER CLOGGED BY 355-TRACK TORRENT IMPORTS!
    // -------------------------------------------------------------------------
    window._cachedFoldersDataV237 = null;
    window._fetchDataInFlightPromiseV237 = null;
    window._coalescedFetchTimerV237 = null;

    var _rawFetchDataV237 = window.fetchData;
    window.fetchData = async function() {
        if (window._fetchDataInFlightPromiseV237) {
            return window._fetchDataInFlightPromiseV237;
        }
        window._fetchDataInFlightPromiseV237 = (async function() {
            try {
                if (typeof _rawFetchDataV237 === 'function') {
                    return await _rawFetchDataV237.apply(window, arguments);
                }
            } finally {
                window._fetchDataInFlightPromiseV237 = null;
            }
        })();
        return window._fetchDataInFlightPromiseV237;
    };

    window.renderFolderManagerRowsHTMLV237 = function(saved, active, ft) {
        return saved.map(function(p) {
            var isSel = active.indexOf(p) !== -1;
            var sp = String(p).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            var shortN = String(p).split('/').filter(Boolean).pop() || p;
            var hasCount = ft && Array.isArray(ft[p]);
            var cntStr = hasCount ? String(ft[p].length) : '…';
            var delBtn = saved.length > 1
                ? '<button type="button" onclick="event.stopPropagation();window.removeFolderFromPoolV71(\'' + sp + '\')" style="padding:5px 8px;color:#f85149;background:#161b22;border:1px solid rgba(248,81,73,0.4);border-radius:7px;">🗑️</button>'
                : '';
            return '<div onclick="window.toggleFolderActivePoolV71(\'' + sp + '\',event)" style="display:flex;align-items:center;background:#0d1117;border:1px solid ' + (isSel ? '#3fb950' : '#262c36') + ';border-radius:8px;padding:9px 10px;gap:8px;cursor:pointer;">' +
                '<input type="checkbox" ' + (isSel ? 'checked' : '') + ' style="pointer-events:none;width:16px;height:16px;accent-color:#3fb950;">' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="color:' + (isSel ? '#3fb950' : '#e6edf3') + ';font-weight:bold;">📁 ' + shortN + ' (' + cntStr + ')</div>' +
                    '<div style="color:#8b949e;font-size:10.5px;word-break:break-all;">' + p + '</div>' +
                '</div>' +
                delBtn +
            '</div>';
        }).join('');
    };

    // Opens Folder Manager modal IMMEDIATELY in 0ms using cached data, then updates track counts asynchronously!
    window.openFolderManagerModalV62 = async function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (typeof window.closeAllV71Modals === 'function') window.closeAllV71Modals();

        var cached = window._cachedFoldersDataV237 || {};
        var saved = cached.saved_folders
            || (window.lastData && window.lastData.saved_folders)
            || (window.getSavedFoldersListV62 ? window.getSavedFoldersListV62() : ['/storage/emulated/0/Music']);
        var active = cached.active_folders
            || (window.lastData && window.lastData.active_folders)
            || (window.appConfig && window.appConfig.activeFolders)
            || [saved[0]];
        var ft = cached.folder_tracks || {};

        var m = document.getElementById('jennyFolderManagerModal');
        if (m) m.remove();

        m = document.createElement('div');
        m.id = 'jennyFolderManagerModal';
        m.className = 'jenny-modal-backdrop-v71';
        m.onclick = function(e) { if (e.target === m) m.remove(); };

        m.innerHTML =
            '<div class="jenny-modal-card-v71" onclick="event.stopPropagation()">' +
                '<div class="jenny-modal-hdr-v71">' +
                    '<span style="color:#58a6ff;font-weight:bold;">📁 ' + window.tr('Музыкальные папки (Слияние)', 'Music Folders (Multi-Pool)') + '</span>' +
                    '<button type="button" onclick="document.getElementById(\'jennyFolderManagerModal\').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button>' +
                '</div>' +
                '<div class="jenny-modal-body-v71">' +
                    '<div id="jennyFolderRowsBoxV237" style="display:flex;flex-direction:column;gap:7px;">' +
                        window.renderFolderManagerRowsHTMLV237(saved, active, ft) +
                    '</div>' +
                    '<div style="display:flex;gap:6px;margin-top:6px;">' +
                        '<input type="text" id="newFolderInputV62" placeholder="/storage/emulated/0/..." style="flex:1;padding:7px;text-align:left !important;">' +
                        '<button type="button" onclick="window.addFolderToPoolV71()" style="padding:7px 12px;color:#3fb950;">➕</button>' +
                        '<button type="button" onclick="window.triggerSystemFolderPickerV62()" style="padding:7px 10px;color:#58a6ff;">📂</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(m);

        // Fetch fresh folder counts in the background and update #jennyFolderRowsBoxV237 in-place
        try {
            var d = await fetch('/api/folders_v71').then(function(r) { return r.json(); });
            if (d && d.status === 'ok') {
                window._cachedFoldersDataV237 = d;
                var box = document.getElementById('jennyFolderRowsBoxV237');
                if (box) {
                    box.innerHTML = window.renderFolderManagerRowsHTMLV237(
                        d.saved_folders || saved,
                        d.active_folders || active,
                        d.folder_tracks || {}
                    );
                }
            }
        } catch (e) {}
    };
})();

/* [split] V238: кусок исходного IIFE (ui_v71.js, строки 32554–32910) → ui_playlist.js */
;(function() {
    if (window._jennyV238MultiPortInstalled__playlist) return;
    window._jennyV238MultiPortInstalled__playlist = true;
    window._jennyV238MultiPortInstalled = true;

    // -------------------------------------------------------------------------
    // 3. 1ms NATIVE JNI FOLDER SCANNER (ZERO SOCKETS WHEN OPENING FOLDER PICKER!)
    // -------------------------------------------------------------------------
    window.renderFolderManagerRowsHTMLV237 = function(saved, active, ft, folderCounts) {
        return saved.map(function(p) {
            var isSel = active.indexOf(p) !== -1;
            var sp = String(p).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            var shortN = String(p).split('/').filter(Boolean).pop() || p;
            var cntStr = '…';
            if (folderCounts && typeof folderCounts[p] === 'number') {
                cntStr = String(folderCounts[p]);
            } else if (ft && Array.isArray(ft[p])) {
                cntStr = String(ft[p].length);
            }
            var delBtn = saved.length > 1
                ? '<button type="button" onclick="event.stopPropagation();window.removeFolderFromPoolV71(\'' + sp + '\')" style="padding:5px 8px;color:#f85149;background:#161b22;border:1px solid rgba(248,81,73,0.4);border-radius:7px;">🗑️</button>'
                : '';
            return '<div onclick="window.toggleFolderActivePoolV71(\'' + sp + '\',event)" style="display:flex;align-items:center;background:#0d1117;border:1px solid ' + (isSel ? '#3fb950' : '#262c36') + ';border-radius:8px;padding:9px 10px;gap:8px;cursor:pointer;">' +
                '<input type="checkbox" ' + (isSel ? 'checked' : '') + ' style="pointer-events:none;width:16px;height:16px;accent-color:#3fb950;">' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="color:' + (isSel ? '#3fb950' : '#e6edf3') + ';font-weight:bold;">📁 ' + shortN + ' (' + cntStr + ')</div>' +
                    '<div style="color:#8b949e;font-size:10.5px;word-break:break-all;">' + p + '</div>' +
                '</div>' +
                delBtn +
            '</div>';
        }).join('');
    };

    window.openFolderManagerModalV62 = async function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (typeof window.closeAllV71Modals === 'function') window.closeAllV71Modals();

        // Layer 3 Fast-Path: Read live folders & exact file counts directly from Java File.list() via JNI in ~1ms!
        var jniData = null;
        if (window.AndroidBridge && typeof window.AndroidBridge.getFoldersFastJson === 'function') {
            try {
                var rawJni = window.AndroidBridge.getFoldersFastJson();
                if (rawJni) {
                    var parsed = JSON.parse(rawJni);
                    if (parsed && parsed.status === 'ok') {
                        jniData = parsed;
                        window._jennyRouterTelemetryV238.jniFolders++;
                    }
                }
            } catch (e) {}
        }

        var cached = window._cachedFoldersDataV237 || {};
        var saved = (jniData && jniData.saved_folders)
            || cached.saved_folders
            || (window.lastData && window.lastData.saved_folders)
            || (window.getSavedFoldersListV62 ? window.getSavedFoldersListV62() : ['/storage/emulated/0/Music']);
        var active = (jniData && jniData.active_folders)
            || cached.active_folders
            || (window.lastData && window.lastData.active_folders)
            || (window.appConfig && window.appConfig.activeFolders)
            || [saved[0]];
        var ft = cached.folder_tracks || {};
        var fCounts = (jniData && jniData.folder_counts) || cached.folder_counts || null;

        var m = document.getElementById('jennyFolderManagerModal');
        if (m) m.remove();

        m = document.createElement('div');
        m.id = 'jennyFolderManagerModal';
        m.className = 'jenny-modal-backdrop-v71';
        m.onclick = function(e) { if (e.target === m) m.remove(); };

        m.innerHTML =
            '<div class="jenny-modal-card-v71" onclick="event.stopPropagation()">' +
                '<div class="jenny-modal-hdr-v71">' +
                    '<span style="color:#58a6ff;font-weight:bold;">📁 ' + window.tr('Музыкальные папки (Слияние)', 'Music Folders (Multi-Pool)') + '</span>' +
                    '<button type="button" onclick="document.getElementById(\'jennyFolderManagerModal\').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button>' +
                '</div>' +
                '<div class="jenny-modal-body-v71">' +
                    '<div id="jennyFolderRowsBoxV237" style="display:flex;flex-direction:column;gap:7px;">' +
                        window.renderFolderManagerRowsHTMLV237(saved, active, ft, fCounts) +
                    '</div>' +
                    '<div style="display:flex;gap:6px;margin-top:6px;">' +
                        '<input type="text" id="newFolderInputV62" placeholder="/storage/emulated/0/..." style="flex:1;padding:7px;text-align:left !important;">' +
                        '<button type="button" onclick="window.addFolderToPoolV71()" style="padding:7px 12px;color:#3fb950;">➕</button>' +
                        '<button type="button" onclick="window.triggerSystemFolderPickerV62()" style="padding:7px 10px;color:#58a6ff;">📂</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(m);

        // Background sync over VIP port :8080
        try {
            var d = await window.fetch('/api/folders_v71').then(function(r) { return r.json(); });
            if (d && d.status === 'ok') {
                window._cachedFoldersDataV237 = d;
                var box = document.getElementById('jennyFolderRowsBoxV237');
                if (box) {
                    box.innerHTML = window.renderFolderManagerRowsHTMLV237(
                        d.saved_folders || saved,
                        d.active_folders || active,
                        d.folder_tracks || {},
                        null
                    );
                }
            }
        } catch (e) {}
    };
})();

/* [split] V242: кусок исходного IIFE (ui_v71.js, строки 33743–34878) → ui_playlist.js */
;(function() {
    if (window._jennyV242Installed__playlist) return;
    window._jennyV242Installed__playlist = true;
    window._jennyV242Installed = true;

    // -------------------------------------------------------------------------
    // 2. HIDE 🔄 IN SETTINGS TOP BAR + STRETCH TELEMETRY 100% WIDTH
    // -------------------------------------------------------------------------
    var _prevUpdateTopBarV242 = window.updateTopSearchOrMonitorBar;
    window.updateTopSearchOrMonitorBar = function() {
        var r = (typeof _prevUpdateTopBarV242 === 'function') ? _prevUpdateTopBarV242.apply(this, arguments) : undefined;
        var sInp = document.getElementById('trackSearchInput');
        var rightSlot = document.getElementById('searchRightSlotV235');
        var clrBtn = document.getElementById('btnClearTrackSearchV73');
        var monEl = document.getElementById('topAutoCeilMonitor');
        var anyModalOpen = Boolean(
            document.querySelector('.modal-overlay.open') ||
            (sInp && sInp.style.display === 'none')
        );
        if (rightSlot) {
            if (anyModalOpen) {
                rightSlot.classList.add('jenny-slot-hidden-in-modal-v242');
                rightSlot.style.setProperty('display', 'none', 'important');
            } else {
                rightSlot.classList.remove('jenny-slot-hidden-in-modal-v242');
                rightSlot.style.setProperty('display', 'inline-flex', 'important');
            }
        }
        if (anyModalOpen && clrBtn) {
            clrBtn.style.setProperty('display', 'none', 'important');
        }
        if (anyModalOpen && monEl && monEl.style.display !== 'none') {
            monEl.style.setProperty('width', '100%', 'important');
            monEl.style.setProperty('flex', '1 1 100%', 'important');
        }
        window.syncLangDockedBodyClassV242();
        window.syncEdgeToEdgeLayoutBoundsV242();
        return r;
    };

    // -------------------------------------------------------------------------
    // 3. CLEAN SEARCH PLACEHOLDERS (NO CLIPPED COUNTS!) + CONTEXT-BOUND 🔄 N COUNTER
    // -------------------------------------------------------------------------
    window.computeActiveViewCountV242 = function() {
        var tabId = window.activePlaylistTabV71 || 'all';
        var sInp = document.getElementById('trackSearchInput');
        var hasQuery = Boolean(sInp && sInp.value && sInp.value.trim().length > 0);

        if (hasQuery) {
            var visibleRows = 0;
            var rows = document.querySelectorAll('#unifiedList .track-row-capsule');
            for (var i = 0; i < rows.length; i++) {
                var p = rows[i].parentElement || rows[i];
                if (p.style.display !== 'none' && rows[i].style.display !== 'none') visibleRows++;
            }
            if (visibleRows > 0 || rows.length > 0) return visibleRows;
        }

        if (tabId === 'videos') {
            var vItems = window.getFilteredVideoItemsV150 ? window.getFilteredVideoItemsV150() : [];
            return vItems.length;
        }
        if (tabId === 'fav') {
            var favAll = Array.isArray(window.favorites) ? window.favorites : [];
            var mode = window._favSubTabV216 || 'audio';
            if (mode === 'video') {
                return favAll.filter(function(fn) { return window.isVideoFileNameV130 && window.isVideoFileNameV130(fn); }).length;
            }
            return favAll.filter(function(fn) { return !(window.isVideoFileNameV130 && window.isVideoFileNameV130(fn)); }).length;
        }
        if (Array.isArray(window.viewedFullTabListV73)) {
            return window.viewedFullTabListV73.length;
        }
        if (Array.isArray(window.currentTrackList)) {
            return window.currentTrackList.length;
        }
        var allAud = ((window.lastData && window.lastData.all_tracks) || []).filter(function(fn) {
            return !(window.isVideoFileNameV130 && window.isVideoFileNameV130(fn));
        });
        return allAud.length;
    };

    // Context-preserving refresh action when tapping 🔄 N (never kicks user out of Videos or Artist filter!)
    window.refreshActiveContextListV242 = async function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var savedTab = window.activePlaylistTabV71 || 'all';
        var savedArtist = window.selectedArtistV71;
        var savedAlbum = window.selectedAlbumV71;
        var savedTag = window.selectedTagV74;
        var savedFavSub = window._favSubTabV216;
        var cntSpanA = document.getElementById('tracksCount');
        if (cntSpanA) cntSpanA.innerText = '⏳';

        try {
            if (savedTab === 'videos' || (savedTab === 'fav' && savedFavSub === 'video')) {
                if (typeof window.syncDiscoveredVideosIntoPlaylistV134 === 'function') {
                    await window.syncDiscoveredVideosIntoPlaylistV134(true);
                }
            } else {
                if (typeof window.smartRefreshCurrentPlaylistV150 === 'function') {
                    await window.smartRefreshCurrentPlaylistV150(ev, false);
                } else if (typeof window.fetchData === 'function') {
                    await window.fetchData();
                }
            }
        } catch (e) {}

        window.activePlaylistTabV71 = savedTab;
        window.selectedArtistV71 = savedArtist;
        window.selectedAlbumV71 = savedAlbum;
        window.selectedTagV74 = savedTag;
        window._favSubTabV216 = savedFavSub;

        if (typeof window.renderPlaylistStripChipsV71 === 'function') window.renderPlaylistStripChipsV71();
        if (typeof window.renderActivePlaylistTracksV71 === 'function') window.renderActivePlaylistTracksV71(false);
        window.syncContextRefreshCounterV242();
        if (typeof window.showToast === 'function') {
            window.showToast('🔄 Список обновлён (' + window.computeActiveViewCountV242() + ')', ev);
        }
    };

    // Clean Search Placeholders WITHOUT counts like (996) / (46) so text never clips!
    window.updateScopedSearchPlaceholderV73 = function(baseCount) {
        var sInp = document.getElementById('trackSearchInput');
        if (!sInp) return;

        if (sInp.parentElement && !sInp.parentElement.classList.contains('jenny-search-wrap-v73')) {
            var p = sInp.parentElement;
            p.classList.add('jenny-search-wrap-v73', 'jenny-search-flex-row-v235');
            var clrBtn0 = document.createElement('button');
            clrBtn0.type = 'button';
            clrBtn0.id = 'btnClearTrackSearchV73';
            clrBtn0.className = 'jenny-search-clear-btn-v73';
            clrBtn0.innerHTML = '✖';
            clrBtn0.onclick = function(e) {
                e.stopPropagation();
                sInp.value = '';
                if (typeof window.filterTracks === 'function') window.filterTracks('');
                sInp.blur();
            };
            p.appendChild(clrBtn0);
            sInp.oninput = function() {
                if (typeof window.filterTracks === 'function') window.filterTracks(this.value);
            };
        }
        if (typeof window.ensureSearchRightSlotAndLangBtnV235 === 'function') {
            window.ensureSearchRightSlotAndLangBtnV235();
        }

        var tabId = window.activePlaylistTabV71 || 'all';
        var scopeLabel = '';

        if (tabId === 'all') {
            scopeLabel = window.tr('🔍 Поиск во «Все»...', '🔍 Search in "All"...');
        } else if (tabId === 'videos') {
            scopeLabel = window.tr('🔍 Поиск в «Видео»...', '🔍 Search in "Videos"...');
        } else if (tabId === 'fav') {
            scopeLabel = window.tr('🔍 Поиск в «Избранное»...', '🔍 Search in "Favorites"...');
        } else if (tabId === 'artists') {
            if (window.selectedArtistV71) {
                scopeLabel = window.tr('🔍 Поиск у «' + window.selectedArtistV71 + '»...', '🔍 Search in "' + window.selectedArtistV71 + '"...');
            } else {
                scopeLabel = window.tr('🔍 Найти артиста или трек...', '🔍 Find artist or track...');
            }
        } else if (tabId === 'albums') {
            if (window.selectedAlbumV71) {
                scopeLabel = window.tr('🔍 Поиск в альбоме «' + window.selectedAlbumV71 + '»...', '🔍 Search in album "' + window.selectedAlbumV71 + '"...');
            } else {
                scopeLabel = window.tr('🔍 Найти альбом или трек...', '🔍 Find album or track...');
            }
        } else if (tabId === 'tags') {
            if (window.selectedTagV74) {
                scopeLabel = window.tr('🔍 Поиск в теге «' + window.selectedTagV74 + '»...', '🔍 Search in tag "' + window.selectedTagV74 + '"...');
            } else {
                scopeLabel = window.tr('🔍 Найти тег или трек...', '🔍 Find tag or track...');
            }
        } else {
            var pls = (window.appConfig && window.appConfig.customPlaylistsV71) || [];
            var pl = pls.find(function(x) { return x.id === tabId; });
            var plName = pl ? pl.name : window.tr('Плейлист', 'Playlist');
            scopeLabel = window.tr('🔍 Поиск в «' + plName + '»...', '🔍 Search in "' + plName + '"...');
        }

        sInp.placeholder = scopeLabel;
        var clrBtn = document.getElementById('btnClearTrackSearchV73');
        if (clrBtn) {
            clrBtn.style.display = (sInp.value && sInp.value.length > 0) ? 'inline-flex' : 'none';
        }
        window.syncContextRefreshCounterV242();
    };

    var _prevRenderActivePlV242 = window.renderActivePlaylistTracksV71;
    if (typeof _prevRenderActivePlV242 === 'function') {
        window.renderActivePlaylistTracksV71 = function() {
            var r = _prevRenderActivePlV242.apply(this, arguments);
            window.syncContextRefreshCounterV242();
            window.syncEdgeToEdgeLayoutBoundsV242();
            return r;
        };
    }

    var _prevFilterTracksV242 = window.filterTracks;
    if (typeof _prevFilterTracksV242 === 'function') {
        window.filterTracks = function() {
            var r = _prevFilterTracksV242.apply(this, arguments);
            var sInp = document.getElementById('trackSearchInput');
            var clrBtn = document.getElementById('btnClearTrackSearchV73');
            if (clrBtn && sInp) {
                clrBtn.style.display = (sInp.value && sInp.value.length > 0) ? 'inline-flex' : 'none';
            }
            window.syncContextRefreshCounterV242();
            return r;
        };
    }

    window.clearSavedModuleQueueV242 = async function(modKey, modalId, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        try {
            await window.fetch('/api/jenny_hub/queue/' + modKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clear: true })
            });
            await window.refreshJennyHubSummaryV242();
            window.openStudioHistoryDrawerV242(modKey, modalId, true);
        } catch (e) {}
    };
})();

/* [split] V243: кусок исходного IIFE (ui_v71.js, строки 35225–35944) → ui_playlist.js */
;(function() {
    if (window._jennyV243Installed__playlist) return;
    window._jennyV243Installed__playlist = true;
    window._jennyV243Installed = true;

    window.ensureSearchRowStretchV243 = function() {
        var sInp = document.getElementById('searchInput');
        if (!sInp || !sInp.parentElement) return;
        var p = sInp.parentElement;
        p.style.setProperty('display', 'flex', 'important');
        p.style.setProperty('align-items', 'center', 'important');
        p.style.setProperty('gap', '6px', 'important');
        p.style.setProperty('width', '100%', 'important');
        p.style.setProperty('box-sizing', 'border-box', 'important');
        Array.from(p.children).forEach(function(ch) {
            if (ch === sInp || ch.contains(sInp)) {
                ch.style.setProperty('flex', '1 1 auto', 'important');
                ch.style.setProperty('min-width', '0', 'important');
                ch.style.setProperty('width', 'auto', 'important');
                ch.style.setProperty('max-width', 'none', 'important');
            } else {
                ch.style.setProperty('flex', '0 0 auto', 'important');
            }
        });
        if (p.parentElement && p.children.length === 1 && p.parentElement.children.length > 1) {
            var gp = p.parentElement;
            var gpDisp = getComputedStyle(gp).display;
            if (gpDisp === 'flex' || gpDisp === 'inline-flex') {
                gp.style.setProperty('width', '100%', 'important');
                gp.style.setProperty('gap', '6px', 'important');
                p.style.setProperty('flex', '1 1 auto', 'important');
                p.style.setProperty('min-width', '0', 'important');
                p.style.setProperty('width', 'auto', 'important');
                p.style.setProperty('max-width', 'none', 'important');
            }
        }
    };
})();

/* [split] V360: кусок исходного IIFE (ui_v71.js, строки 35973–36584) → ui_playlist.js */
;(function() {
    if (window._jennyV360ClockAndModalPatchInstalled__playlist) return;
    window._jennyV360ClockAndModalPatchInstalled__playlist = true;
    window._jennyV360ClockAndModalPatchInstalled = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    function getOpenModalStateV363() {
        var deckAIds = ['settingsModal', 'eqModal', 'specModal', 'themeModal', 'favModal'];
        var deckBIds = ['settingsModalDeckB', 'eqModalDeckB', 'specModalDeckB'];
        var deckAOpen = deckAIds.some(function(id) {
            var el = document.getElementById(id);
            return Boolean(el && el.classList.contains('open'));
        });
        var deckBOpen = deckBIds.some(function(id) {
            var el = document.getElementById(id);
            return Boolean(el && el.classList.contains('open'));
        });
        return {
            deckAOpen: deckAOpen,
            deckBOpen: deckBOpen,
            anyOpen: Boolean(deckAOpen || deckBOpen)
        };
    }

    // 3. МГНОВЕННЫЙ ВИЗУАЛЬНЫЙ ОТКЛИК ГАЛОЧЕК В «📁 МУЗЫКАЛЬНЫЕ ПАПКИ» (0 мс ПРИ ТАПЕ!)
    window.renderFolderManagerRowsHTMLV237 = function(saved, active, ft, folderCounts) {
        return (saved || []).map(function(p) {
            var isSel = (active || []).indexOf(p) !== -1;
            var sp = String(p).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            var shortN = String(p).split('/').filter(Boolean).pop() || p;
            var cntStr = '…';
            if (folderCounts && typeof folderCounts[p] === 'number') {
                cntStr = String(folderCounts[p]);
            } else if (ft && Array.isArray(ft[p])) {
                cntStr = String(ft[p].length);
            }
            var delBtn = (saved && saved.length > 1)
                ? '<button type="button" onclick="event.stopPropagation();window.removeFolderFromPoolV71(\'' + sp + '\')" style="padding:5px 8px;color:#f85149;background:#161b22;border:1px solid rgba(248,81,73,0.4);border-radius:7px;">🗑️</button>'
                : '';
            return '<div data-folder-path="' + String(p).replace(/"/g, '&quot;') + '" onclick="window.toggleFolderActivePoolV71(\'' + sp + '\',event)" style="display:flex;align-items:center;background:#0d1117;border:1px solid ' + (isSel ? '#3fb950' : '#262c36') + ';border-radius:8px;padding:9px 10px;gap:8px;cursor:pointer;transition:border-color 0.12s ease;">' +
                '<input type="checkbox" ' + (isSel ? 'checked' : '') + ' style="pointer-events:none;width:16px;height:16px;accent-color:#3fb950;">' +
                '<div style="flex:1;min-width:0;">' +
                    '<div class="jenny-folder-row-title-v362" style="color:' + (isSel ? '#3fb950' : '#e6edf3') + ';font-weight:bold;">📁 ' + shortN + ' (' + cntStr + ')</div>' +
                    '<div style="color:#8b949e;font-size:10.5px;word-break:break-all;">' + p + '</div>' +
                '</div>' +
                delBtn +
            '</div>';
        }).join('');
    };

    window.toggleFolderActivePoolV71 = async function(fp, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();

        var box = document.getElementById('jennyFolderRowsBoxV237');
        if (box) {
            var rows = box.querySelectorAll('[data-folder-path]');
            var checkedCnt = 0;
            rows.forEach(function(r) {
                var c = r.querySelector('input[type="checkbox"]');
                if (c && c.checked) checkedCnt++;
            });
            rows.forEach(function(r) {
                if (r.getAttribute('data-folder-path') === fp) {
                    var chk = r.querySelector('input[type="checkbox"]');
                    var ttl = r.querySelector('.jenny-folder-row-title-v362');
                    if (chk) {
                        if (chk.checked && checkedCnt <= 1) return;
                        var nextSel = !chk.checked;
                        chk.checked = nextSel;
                        r.style.borderColor = nextSel ? '#3fb950' : '#262c36';
                        if (ttl) ttl.style.color = nextSel ? '#3fb950' : '#e6edf3';
                    }
                }
            });
        }

        try {
            var res = await fetch('/api/folders_v71', {
                method: 'POST',
                body: JSON.stringify({ action: 'toggle', path: fp })
            });
            var d = await res.json();
            if (d && d.status === 'ok') {
                window._cachedFoldersDataV237 = d;
                if (window.AndroidBridge && typeof window.AndroidBridge.invalidatePresetFolderCache === 'function') {
                    try { window.AndroidBridge.invalidatePresetFolderCache(); } catch (e) {}
                }
                var liveBox = document.getElementById('jennyFolderRowsBoxV237');
                if (liveBox) {
                    liveBox.innerHTML = window.renderFolderManagerRowsHTMLV237(
                        d.saved_folders || [],
                        d.active_folders || [],
                        d.folder_tracks || {},
                        null
                    );
                }
                window._fetchDataInFlightPromiseV237 = null;
                await Promise.all([
                    window.fetchData(),
                    window.syncDiscoveredVideosIntoPlaylistV134(true)
                ]);
                if (typeof window.renderPlaylistStripChipsV71 === 'function') window.renderPlaylistStripChipsV71();
                if (typeof window.renderActivePlaylistTracksV71 === 'function') window.renderActivePlaylistTracksV71(false);
                if (typeof window.syncContextRefreshCounterV242 === 'function') window.syncContextRefreshCounterV242();
            } else if (typeof window.showToast === 'function') {
                window.showToast('❌ ' + ((d && d.error) || 'Ошибка'), ev);
            }
        } catch (err) {
            if (typeof window.showToast === 'function') {
                window.showToast('❌ Ошибка связи с сервером папок', ev);
            }
        }
    };

    window.addFolderToPoolV71 = async function() {
        var inp = document.getElementById('newFolderInputV62');
        var fp = inp ? inp.value.trim() : '';
        if (!fp) return;
        try {
            var d = await (await fetch('/api/folders_v71', {
                method: 'POST',
                body: JSON.stringify({ action: 'add', path: fp })
            })).json();
            if (d && d.status === 'ok') {
                if (inp) inp.value = '';
                window._cachedFoldersDataV237 = d;
                if (window.AndroidBridge && typeof window.AndroidBridge.invalidatePresetFolderCache === 'function') {
                    try { window.AndroidBridge.invalidatePresetFolderCache(); } catch (e) {}
                }
                var liveBox = document.getElementById('jennyFolderRowsBoxV237');
                if (liveBox) {
                    liveBox.innerHTML = window.renderFolderManagerRowsHTMLV237(
                        d.saved_folders || [],
                        d.active_folders || [],
                        d.folder_tracks || {},
                        null
                    );
                }
                window._fetchDataInFlightPromiseV237 = null;
                await Promise.all([
                    window.fetchData(),
                    window.syncDiscoveredVideosIntoPlaylistV134(true)
                ]);
                if (typeof window.renderPlaylistStripChipsV71 === 'function') window.renderPlaylistStripChipsV71();
                if (typeof window.renderActivePlaylistTracksV71 === 'function') window.renderActivePlaylistTracksV71(false);
                if (typeof window.syncContextRefreshCounterV242 === 'function') window.syncContextRefreshCounterV242();
            } else if (typeof window.showToast === 'function') {
                window.showToast('❌ ' + ((d && d.error) || 'Папка не найдена'));
            }
        } catch (e) {}
    };

    window.removeFolderFromPoolV71 = async function(fp) {
        try {
            var d = await (await fetch('/api/folders_v71', {
                method: 'POST',
                body: JSON.stringify({ action: 'remove', path: fp })
            })).json();
            if (d && d.status === 'ok') {
                window._cachedFoldersDataV237 = d;
                if (window.AndroidBridge && typeof window.AndroidBridge.invalidatePresetFolderCache === 'function') {
                    try { window.AndroidBridge.invalidatePresetFolderCache(); } catch (e) {}
                }
                var liveBox = document.getElementById('jennyFolderRowsBoxV237');
                if (liveBox) {
                    liveBox.innerHTML = window.renderFolderManagerRowsHTMLV237(
                        d.saved_folders || [],
                        d.active_folders || [],
                        d.folder_tracks || {},
                        null
                    );
                }
                window._fetchDataInFlightPromiseV237 = null;
                await Promise.all([
                    window.fetchData(),
                    window.syncDiscoveredVideosIntoPlaylistV134(true)
                ]);
                if (typeof window.renderPlaylistStripChipsV71 === 'function') window.renderPlaylistStripChipsV71();
                if (typeof window.renderActivePlaylistTracksV71 === 'function') window.renderActivePlaylistTracksV71(false);
                if (typeof window.syncContextRefreshCounterV242 === 'function') window.syncContextRefreshCounterV242();
            }
        } catch (e) {}
    };

    // 4. КНОПКА ОБНОВЛЕНИЯ 🔄 N В ПОИСКЕ
    window.refreshActiveContextListV242 = async function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var savedTab = window.activePlaylistTabV71 || 'all';
        var savedArtist = window.selectedArtistV71;
        var savedAlbum = window.selectedAlbumV71;
        var savedTag = window.selectedTagV74;
        var savedFavSub = window._favSubTabV216;
        var cntSpanA = document.getElementById('tracksCount');
        if (cntSpanA) cntSpanA.innerText = '⏳';

        try {
            window._fetchDataInFlightPromiseV237 = null;
            await Promise.all([
                window.fetchData(),
                window.syncDiscoveredVideosIntoPlaylistV134(true)
            ]);
        } catch (e) {}

        window.activePlaylistTabV71 = savedTab;
        window.selectedArtistV71 = savedArtist;
        window.selectedAlbumV71 = savedAlbum;
        window.selectedTagV74 = savedTag;
        window._favSubTabV216 = savedFavSub;

        if (typeof window.renderPlaylistStripChipsV71 === 'function') window.renderPlaylistStripChipsV71();
        if (typeof window.renderActivePlaylistTracksV71 === 'function') window.renderActivePlaylistTracksV71(false);
        if (typeof window.syncContextRefreshCounterV242 === 'function') window.syncContextRefreshCounterV242();
        if (typeof window.showToast === 'function') {
            window.showToast('🔄 Список обновлён (' + window.computeActiveViewCountV242() + ')', ev);
        }
    };

    var _origSelectPlTabV362 = window.selectPlaylistTabV71;
    if (typeof _origSelectPlTabV362 === 'function' && !_origSelectPlTabV362._v362Wrapped) {
        window.selectPlaylistTabV71 = function(tabId, ev) {
            var r = _origSelectPlTabV362.apply(this, arguments);
            if (tabId === 'videos' && typeof window.syncDiscoveredVideosIntoPlaylistV134 === 'function') {
                window.syncDiscoveredVideosIntoPlaylistV134(false);
            }
            if (typeof window.syncContextRefreshCounterV242 === 'function') {
                window.syncContextRefreshCounterV242();
            }
            return r;
        };
        window.selectPlaylistTabV71._v362Wrapped = true;
    }

    function setStylePropIfChangedV363(el, prop, val, priority) {
        if (!el || !el.style) return;
        var wantVal = String(val);
        var wantPri = priority || '';
        if (el.style.getPropertyValue(prop) === wantVal && el.style.getPropertyPriority(prop) === wantPri) {
            return;
        }
        el.style.setProperty(prop, wantVal, wantPri);
    }

    window.updateTopSearchOrMonitorBar = function() {
        if (window._inUpdateTopBarGuardV363) return;
        window._inUpdateTopBarGuardV363 = true;
        try {
            var st = getOpenModalStateV363();
            var searchInput = document.getElementById('trackSearchInput');
            var rightSlot = document.getElementById('searchRightSlotV235');
            var clrBtn = document.getElementById('btnClearTrackSearchV73');
            var plWrap = document.getElementById('jennyPlaylistBarWrapV71');

            if (searchInput && searchInput.parentElement) {
                var barWrap = searchInput.parentElement;
                var monEl = document.getElementById('topAutoCeilMonitor');
                if (!monEl) {
                    monEl = document.createElement('div');
                    monEl.id = 'topAutoCeilMonitor';
                    monEl.style.cssText = 'display:none;width:100%;box-sizing:border-box;background:#0d1117;border:1px solid #2ea043;border-radius:8px;padding:8px 11px;font-size:12px;color:#e6edf3;white-space:nowrap;overflow-x:auto;font-family:monospace;box-shadow:0 0 8px rgba(46,160,67,0.25);';
                    barWrap.appendChild(monEl);
                }

                if (!st.anyOpen) {
                    barWrap.style.display = '';
                    barWrap.style.paddingTop = '2px';
                    searchInput.style.display = '';
                    monEl.style.display = 'none';
                } else if (st.deckBOpen) {
                    searchInput.style.display = 'none';
                    if (typeof window.updateDeckBAutoCeilMonitorUI === 'function') {
                        window.updateDeckBAutoCeilMonitorUI();
                    }
                    if (monEl.style.display !== 'none') {
                        setStylePropIfChangedV363(monEl, 'width', '100%', 'important');
                        setStylePropIfChangedV363(monEl, 'flex', '1 1 100%', 'important');
                    }
                } else {
                    // Deck A modal open (#settingsModal / #eqModal / #specModal / #themeModal / #favModal)
                    var cfg = window.appConfig || {};
                    var ceilOn = Boolean(cfg.opt_masterCeil || cfg.phaseFixEnabled);
                    var totalTxt = (typeof window.lastComputedCeilingDb !== 'undefined') ? window.lastComputedCeilingDb : -0.5;
                    var detailsTxt = (typeof window.localizeCeilingBreakdown === 'function')
                        ? window.localizeCeilingBreakdown(window.lastCeilingBreakdown)
                        : (window.lastCeilingBreakdown || '');
                    var badge = document.getElementById('autoCeilStatusBadge');
                    if (badge) {
                        var wantBadgeTxt = cfg.opt_masterCeil ? ((window.tr ? window.tr('Авто', 'Auto') : 'Авто') + ': ' + totalTxt + ' dB') : (window.tr ? window.tr('ВЫКЛ', 'OFF') : 'ВЫКЛ');
                        if (badge.innerText !== wantBadgeTxt) badge.innerText = wantBadgeTxt;
                        badge.style.color = cfg.opt_masterCeil ? '#3fb950' : '#8b949e';
                    }
                    searchInput.style.display = 'none';
                    if (ceilOn) {
                        barWrap.style.display = '';
                        barWrap.style.paddingTop = '2px';
                        monEl.style.display = 'block';
                        monEl.style.borderColor = '#2ea043';
                        var wantHtml = '<span style="color:#3fb950;font-weight:bold;">🛡️ ' + (window.tr ? window.tr('Авто-Потолок', 'Auto-Ceiling') : 'Авто-Потолок') + ': ' + totalTxt + ' dB</span> <span style="color:#8b949e;">│</span> <span style="color:#58a6ff;">' + detailsTxt + '</span>';
                        if (monEl.innerHTML !== wantHtml) monEl.innerHTML = wantHtml;
                        setStylePropIfChangedV363(monEl, 'width', '100%', 'important');
                        setStylePropIfChangedV363(monEl, 'flex', '1 1 100%', 'important');
                    } else {
                        monEl.style.display = 'none';
                        barWrap.style.display = 'none';
                    }
                }
            }

            if (plWrap) {
                setStylePropIfChangedV363(plWrap, 'display', st.anyOpen ? 'none' : 'flex', 'important');
            }
            if (rightSlot) {
                if (st.anyOpen) {
                    rightSlot.classList.add('jenny-slot-hidden-in-modal-v242');
                    setStylePropIfChangedV363(rightSlot, 'display', 'none', 'important');
                } else {
                    rightSlot.classList.remove('jenny-slot-hidden-in-modal-v242');
                    setStylePropIfChangedV363(rightSlot, 'display', 'inline-flex', 'important');
                }
            }
            if (st.anyOpen && clrBtn) {
                setStylePropIfChangedV363(clrBtn, 'display', 'none', 'important');
            }

            if (typeof window.syncLangDockedBodyClassV242 === 'function') {
                window.syncLangDockedBodyClassV242();
            }
            window.syncHeaderHeightWithModalsV71();
        } finally {
            window._inUpdateTopBarGuardV363 = false;
        }
    };

    var _origCloseAllV71 = window.closeAllV71Modals;
    window.closeAllV71Modals = function() {
        if (typeof window.closeDeckBIsolatedModals === 'function') {
            window.closeDeckBIsolatedModals();
        }
        return (typeof _origCloseAllV71 === 'function') ? _origCloseAllV71.apply(this, arguments) : undefined;
    };
})();
