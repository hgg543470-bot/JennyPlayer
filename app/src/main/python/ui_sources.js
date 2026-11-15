/* ============================================================================
 * ui_sources.js — Источники: меню, OST/архив, радио, SoundCloud, YouTube, мини-плееры, рубильник
 * Вынесено из ui_v71.js без изменения кода (см. REFACTOR_PLAN.md). Порядок блоков — исходный.
 * ============================================================================ */



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

;(function bindMainVolumeAndPlayToOstV90() {
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

var updateKhHeaderBtnBadgeV89 = window.updateKhHeaderBtnBadgeV89 = window.updateKhHeaderBtnBadgeV89 || function(){};

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
                    <span id="khMiniTitleV90" style="font-weight:bold;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.32;max-width:75%;">🎧 Предпрослушка</span>
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

var runKhSearchV88 = window.runKhSearchV88 = window.runKhSearchV88 || function(){};

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
                <div style="color:#e6edf3;font-size:12px;font-weight:bold;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.32;">${t.index}. ${t.title}</div>
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

/* [CLEANED: updateKhHeaderBtnBadgeV89] */

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
                <div style="color:#e6edf3;font-size:12px;font-weight:bold;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.32;display:flex;align-items:center;gap:6px;">${badgeSvg}<span>${s.title}</span></div>
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

var runScDedicatedSearchV93 = window.runScDedicatedSearchV93 = window.runScDedicatedSearchV93 || function(){};

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

;(function hookDropdownKillSwitchV94() {
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

var downloadScTrackV96 = window.downloadScTrackV96 = window.downloadScTrackV96 || function(){};

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
                <div style="color:#e6edf3;font-size:12px;font-weight:bold;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.32;">${t.index}. ${t.title}</div>
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
                <span class="ump-title" style="font-size:11px;color:#3fb950;font-weight:bold;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.32;flex:1;">🎧 Предпрослушка</span>
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

// Перехватываем bindAudioToAllMiniPlayersV98 и previewTorrentFileStreamV97 для запоминания торрента играющего трека
const _origBindMiniV106 = window.bindAudioToAllMiniPlayersV98;
window.bindAudioToAllMiniPlayersV98 = function(aud, titleText) {
    _origBindMiniV106.call(this, aud, titleText);
    window.syncMiniPlayerTorrentBtnVisibilityV108();
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

/* [split] V143: кусок исходного IIFE (ui_v71.js, строки 11521–11833) → ui_sources.js */
;(function() {

// Перехватываем stopAllExternalStreamsV97 (нажатие ✖ в мини-плеере или стоп потока)
const _origStopStreamsV143 = window.stopAllExternalStreamsV97;
window.stopAllExternalStreamsV97 = function() {
    if (typeof _origStopStreamsV143 === 'function') _origStopStreamsV143.apply(this, arguments);
    if (window._activeStreamSessionV143) {
        window.cleanupActiveTorrentStreamV143('stop');
    }
};
})();

/* [split] V216: кусок исходного IIFE (ui_v71.js, строки 19638–21240) → ui_sources.js */
;(function() {
    if (window._jennyV216Installed__sources) return;
    window._jennyV216Installed__sources = true;
    window._jennyV216Installed = true;

    // -------------------------------------------------------------------------
    // 3. ПЕРЕНОС КНОПКИ ПАПКИ (📁) И ТОРРЕНТА (🧲) В ВЕРХНЮЮ ШАПКУ (#topHeaderCapsule)
    // -------------------------------------------------------------------------
    window.renderHeaderSourcesHubV91 = function() {
        var oldBtn = document.getElementById('btnKhinsiderOstV88');
        var settingsBtn = document.getElementById('btn-settingsModal');
        var parent = (settingsBtn && settingsBtn.parentElement) || (oldBtn && oldBtn.parentElement);
        if (!parent) return;
        parent.style.gap = '4px';

        // Уменьшаем ширину логотипа чуть-чуть, чтобы все кнопки в шапке свободно помещались
        var logoSvg = document.querySelector('#jennyLogoWrap svg');
        if (logoSvg) {
            logoSvg.setAttribute('width', '98');
            logoSvg.setAttribute('height', '28');
        }

        // 1) Переносим кнопку выбора папок 📁 (#folderIconTrigger) в шапку первой слева
        var folderBtn = document.getElementById('folderIconTrigger');
        if (!folderBtn) {
            folderBtn = document.createElement('button');
            folderBtn.type = 'button';
            folderBtn.id = 'folderIconTrigger';
            folderBtn.className = 'jenny-icon-pill';
            folderBtn.title = 'Менеджер папок';
            folderBtn.onclick = function(ev) { if (window.openFolderManagerModalV62) window.openFolderManagerModalV62(ev); };
            folderBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#58a6ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
        }
        folderBtn.style.cssText = 'width:30px;height:30px;padding:0;border-radius:8px;border-color:rgba(88,166,255,0.55);color:#58a6ff;';
        if (folderBtn.parentElement !== parent || parent.firstElementChild !== folderBtn) {
            parent.insertBefore(folderBtn, parent.firstElementChild);
        }

        // 2) Закрепляем кнопку Торрента 🧲 (#btnHeaderTorrentFixedV216) сразу справа от кнопки Папки 📁
        var torBtn = document.getElementById('btnHeaderTorrentFixedV216');
        if (!torBtn) {
            torBtn = document.createElement('button');
            torBtn.type = 'button';
            torBtn.id = 'btnHeaderTorrentFixedV216';
            torBtn.className = 'jenny-icon-pill';
            torBtn.title = 'Торрент-Студия (P2P / Magnet)';
            torBtn.onclick = function(ev) { if (window.triggerSourceActionV91) window.triggerSourceActionV91('torrent', ev); };
        }
        var torSvg = (window.JENNY_NEON_SVGS_V92 && window.JENNY_NEON_SVGS_V92.torrent)
            || '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#d2a8ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 12 0V3"/><line x1="4" y1="3" x2="8" y2="3"/><line x1="16" y1="3" x2="20" y2="3"/></svg>';
        torBtn.innerHTML = torSvg;
        torBtn.style.cssText = 'width:30px;height:30px;padding:0;border-radius:8px;border-color:rgba(210,168,255,0.55);';
        if (torBtn.parentElement !== parent || folderBtn.nextElementSibling !== torBtn) {
            folderBtn.insertAdjacentElement('afterend', torBtn);
        }

        // 3) Остальные закреплённые источники (без дублирования torrent) + кнопка меню источников ⊞
        var hub = document.getElementById('jennySourcesHubBarV91');
        if (!hub) {
            hub = document.createElement('div');
            hub.id = 'jennySourcesHubBarV91';
            hub.style.cssText = 'display:flex;align-items:center;gap:4px;';
            if (oldBtn && oldBtn.parentElement === parent) oldBtn.replaceWith(hub);
            else parent.insertBefore(hub, settingsBtn);
        } else if (hub.parentElement !== parent) {
            parent.insertBefore(hub, settingsBtn);
        }

        var pinned = (window.getPinnedSourcesV91 ? window.getPinnedSourcesV91() : []).filter(function(id) { return id !== 'torrent'; });
        var btnsHtml = pinned.slice(0, 2).map(function(id) {
            var s = (window.SOURCES_CATALOG_V91 || []).find(function(x) { return x.id === id; });
            if (!s) return '';
            var btnIdAttr = (id === 'ost') ? 'id="btnKhinsiderOstV88"' : 'id="btnPinnedSrc_' + id + '_V91"';
            return '<button type="button" ' + btnIdAttr + ' class="jenny-icon-pill" onclick="window.triggerSourceActionV91(\'' + s.id + '\', event)" title="' + s.title + '" style="width:30px;height:30px;padding:0;border-radius:8px;">' + s.svg + '</button>';
        }).join('');

        var hubSvg = (window.JENNY_NEON_SVGS_V92 && window.JENNY_NEON_SVGS_V92.hub) || '⊞';
        hub.innerHTML = btnsHtml + '<button type="button" id="btnSourcesHubDropV91" class="jenny-icon-pill" onclick="window.toggleSourcesDropdownMenuV91(event)" title="Все источники" style="width:30px;height:30px;padding:0;border-radius:8px;">' + hubSvg + '</button>';
    };
})();

/* [split] V218: кусок исходного IIFE (ui_v71.js, строки 22588–24059) → ui_sources.js */
;(function() {
    if (window._jennyV218Installed__sources) return;
    window._jennyV218Installed__sources = true;
    window._jennyV218Installed = true;

    window.getPinnedSourcesV91 = function() {
        window.appConfig = window.appConfig || {};
        if (!Array.isArray(window.appConfig.pinnedSourcesV91)) {
            window.appConfig.pinnedSourcesV91 = ['torrent', 'ost', 'radio', 'soundcloud'];
        }
        if (!localStorage.getItem('jenny_pinned_v218_migrated')) {
            localStorage.setItem('jenny_pinned_v218_migrated', '1');
            if (window.appConfig.pinnedSourcesV91.indexOf('torrent') === -1) {
                window.appConfig.pinnedSourcesV91.unshift('torrent');
            }
            try { localStorage.setItem('ytm_config', JSON.stringify(window.appConfig)); } catch (e) {}
        }
        return window.appConfig.pinnedSourcesV91.slice(0, 5);
    };

    window.togglePinSourceV91 = function(srcId, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var pinned = window.getPinnedSourcesV91().slice();
        var idx = pinned.indexOf(srcId);
        if (idx !== -1) {
            pinned.splice(idx, 1);
        } else {
            pinned.push(srcId);
        }
        window.appConfig.pinnedSourcesV91 = pinned;
        try { localStorage.setItem('ytm_config', JSON.stringify(window.appConfig)); } catch (e) {}
        window.renderHeaderSourcesHubV91();
        if (typeof window.renderSourcesSettingsSectionV91 === 'function') window.renderSourcesSettingsSectionV91();
        window.syncPersistentUserDataV218(false);
    };

    window.toggleSourcesDropdownMenuV91 = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var menu = document.getElementById('jennySourcesDropMenuV91');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'jennySourcesDropMenuV91';
            menu.style.cssText = 'position:fixed;top:54px;right:12px;width:310px;background:#090d14;border:1.5px solid #58a6ff;border-radius:12px;padding:8px;z-index:2147483645;box-shadow:0 12px 32px rgba(0,0,0,0.95);display:none;flex-direction:column;gap:6px;';
            document.body.appendChild(menu);
            document.addEventListener('click', function(e) {
                if (menu.style.display !== 'none' && !menu.contains(e.target) && !e.target.closest('#btnSourcesHubDropV91')) {
                    menu.style.display = 'none';
                }
            });
        }
        if (menu.style.display === 'flex') {
            menu.style.display = 'none';
            return;
        }
        window.renderSourcesDropdownMenuContentV218(menu);
        menu.style.display = 'flex';
    };

    window.renderSourcesDropdownMenuContentV218 = function(menu) {
        if (!menu) menu = document.getElementById('jennySourcesDropMenuV91');
        if (!menu) return;
        var pinned = window.getPinnedSourcesV91();
        var catalog = window.SOURCES_CATALOG_V91 || [];
        menu.innerHTML =
            '<div style="font-size:10.5px;color:#8b949e;padding:2px 4px;display:flex;justify-content:space-between;">' +
                '<span>ВЫБЕРИ ИСТОЧНИК:</span><span>В шапке (' + pinned.length + '/' + catalog.length + ')</span>' +
            '</div>' +
            catalog.map(function(s) {
                var isPin = pinned.indexOf(s.id) !== -1;
                return '<div style="display:flex;align-items:center;gap:8px;background:#0f141d;border:1px solid ' + (isPin ? '#3fb950' : '#262c36') + ';border-radius:9px;padding:7px 9px;">' +
                    '<div onclick="window.triggerSourceActionV91(\'' + s.id + '\', event)" style="display:flex;align-items:center;gap:8px;flex:1;color:#e6edf3;font-size:12px;font-weight:bold;cursor:pointer;">' +
                        '<span style="display:inline-flex;width:20px;justify-content:center;">' + s.svg + '</span>' +
                        '<span>' + s.title + '</span>' +
                    '</div>' +
                    '<button type="button" onclick="window.togglePinSourceV91(\'' + s.id + '\', event);window.renderSourcesDropdownMenuContentV218();" style="padding:3px 8px;font-size:10.5px;font-weight:bold;border-radius:6px;background:' + (isPin ? 'rgba(63,185,80,0.22)' : '#161b22') + ';border:1px solid ' + (isPin ? '#3fb950' : '#30363d') + ';color:' + (isPin ? '#3fb950' : '#8b949e') + ';cursor:pointer;">' +
                        (isPin ? 'ВКЛ' : '+') +
                    '</button>' +
                '</div>';
            }).join('');
    };

    window.renderHeaderSourcesHubV91 = function() {
        window.upgradeLogoSvgWithV11UnderPlayerV218();
        var oldBtn = document.getElementById('btnKhinsiderOstV88');
        var settingsBtn = document.getElementById('btn-settingsModal');
        var parent = (settingsBtn && settingsBtn.parentElement) || (oldBtn && oldBtn.parentElement);
        if (!parent) return;
        parent.style.gap = '3px';

        // Удаляем старую жестко прибитую кнопку #btnHeaderTorrentFixedV216, чтобы Торрент управлялся переключателем [ВКЛ] из меню ⊞!
        var oldFixedTor = document.getElementById('btnHeaderTorrentFixedV216');
        if (oldFixedTor) oldFixedTor.remove();

        // 1) Кнопка выбора папок 📁 (#folderIconTrigger) всегда первая слева
        var folderBtn = document.getElementById('folderIconTrigger');
        if (!folderBtn) {
            folderBtn = document.createElement('button');
            folderBtn.type = 'button';
            folderBtn.id = 'folderIconTrigger';
            folderBtn.className = 'jenny-icon-pill';
            folderBtn.title = 'Менеджер папок';
            folderBtn.onclick = function(ev) { if (window.openFolderManagerModalV62) window.openFolderManagerModalV62(ev); };
            folderBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#58a6ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
        }
        folderBtn.style.cssText = 'width:28px !important;height:28px !important;padding:0 !important;border-radius:8px !important;border-color:rgba(88,166,255,0.55);color:#58a6ff;';
        if (folderBtn.parentElement !== parent || parent.firstElementChild !== folderBtn) {
            parent.insertBefore(folderBtn, parent.firstElementChild);
        }

        // 2) Все закреплённые источники (до 5 шт., включая Торрент и Lossless Архивы!) + кнопка ⊞
        var hub = document.getElementById('jennySourcesHubBarV91');
        if (!hub) {
            hub = document.createElement('div');
            hub.id = 'jennySourcesHubBarV91';
            hub.style.cssText = 'display:flex;align-items:center;gap:3px;';
            if (oldBtn && oldBtn.parentElement === parent) oldBtn.replaceWith(hub);
            else parent.insertBefore(hub, settingsBtn);
        } else if (hub.parentElement !== parent) {
            parent.insertBefore(hub, settingsBtn);
        }

        var pinned = window.getPinnedSourcesV91();
        var btnsHtml = pinned.map(function(id) {
            var s = (window.SOURCES_CATALOG_V91 || []).find(function(x) { return x.id === id; });
            if (!s) return '';
            var btnIdAttr = (id === 'ost') ? 'id="btnKhinsiderOstV88"' : 'id="btnPinnedSrc_' + id + '_V91"';
            return '<button type="button" ' + btnIdAttr + ' class="jenny-icon-pill" onclick="window.triggerSourceActionV91(\'' + s.id + '\', event)" title="' + s.title + '" style="width:28px !important;height:28px !important;padding:0 !important;border-radius:8px !important;">' + s.svg + '</button>';
        }).join('');

        var hubSvg = (window.JENNY_NEON_SVGS_V92 && window.JENNY_NEON_SVGS_V92.hub) || '⊞';
        hub.innerHTML = btnsHtml + '<button type="button" id="btnSourcesHubDropV91" class="jenny-icon-pill" onclick="window.toggleSourcesDropdownMenuV91(event)" title="Все источники" style="width:28px !important;height:28px !important;padding:0 !important;border-radius:8px !important;">' + hubSvg + '</button>';
        if (settingsBtn) {
            settingsBtn.style.cssText = 'width:28px !important;height:28px !important;padding:0 !important;border-radius:8px !important;';
        }
    };

    window.renderSourcesSettingsSectionV91 = function() {
        var box = document.getElementById('jennySourcesSettingsBoxV91');
        if (!box) return;
        var pinned = window.getPinnedSourcesV91();
        var catalog = window.SOURCES_CATALOG_V91 || [];
        box.innerHTML =
            '<summary style="cursor:pointer;font-weight:bold;color:#58a6ff;">🌐 Значки источников в шапке (до 5 шт.)</summary>' +
            '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">' +
                catalog.map(function(s) {
                    var chk = pinned.indexOf(s.id) !== -1 ? 'checked' : '';
                    return '<label style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:#0d1117;border:1px solid #21262d;border-radius:8px;cursor:pointer;">' +
                        '<span style="display:flex;align-items:center;gap:8px;font-size:12px;color:#e6edf3;">' + s.svg + '<span>' + s.title + '</span></span>' +
                        '<input type="checkbox" ' + chk + ' onchange="window.togglePinSourceV91(\'' + s.id + '\', event)" style="width:16px;height:16px;accent-color:#3fb950;">' +
                    '</label>';
                }).join('') +
            '</div>';
    };
})();

/* [split] V224: кусок исходного IIFE (ui_v71.js, строки 26380–26627) → ui_sources.js */
;(function() {
    if (window._jennyV224Installed__sources) return;
    window._jennyV224Installed__sources = true;
    window._jennyV224Installed = true;

    // Делаем renderHeaderSourcesHubV91 строго идемпотентным:
    // перестраиваем DOM шапки ТОЛЬКО тогда, когда реально изменился список закреплённых кнопок или при первом старте!
    window.renderHeaderSourcesHubV91 = function(forceRebuild) {
        if (typeof window.upgradeLogoSvgWithV11UnderPlayerV218 === 'function') {
            window.upgradeLogoSvgWithV11UnderPlayerV218();
        }
        var oldBtn = document.getElementById('btnKhinsiderOstV88');
        var settingsBtn = document.getElementById('btn-settingsModal');
        var parent = (settingsBtn && settingsBtn.parentElement) || (oldBtn && oldBtn.parentElement);
        if (!parent) return;

        var oldFixedTor = document.getElementById('btnHeaderTorrentFixedV216');
        if (oldFixedTor) oldFixedTor.remove();

        var pinned = window.getPinnedSourcesV91 ? window.getPinnedSourcesV91() : [];
        var sig = pinned.join(',');
        var folderBtn = document.getElementById('folderIconTrigger');
        var hub = document.getElementById('jennySourcesHubBarV91');
        var dropBtn = document.getElementById('btnSourcesHubDropV91');

        if (!forceRebuild &&
            folderBtn && folderBtn.parentElement === parent && parent.firstElementChild === folderBtn &&
            hub && hub.parentElement === parent && dropBtn &&
            hub._v224PinnedSig === sig) {
            return;
        }

        parent.style.gap = '3px';

        if (!folderBtn) {
            folderBtn = document.createElement('button');
            folderBtn.type = 'button';
            folderBtn.id = 'folderIconTrigger';
            folderBtn.className = 'jenny-icon-pill';
            folderBtn.title = 'Менеджер папок';
            folderBtn.onclick = function(ev) { if (window.openFolderManagerModalV62) window.openFolderManagerModalV62(ev); };
            folderBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#58a6ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
        }
        folderBtn.style.cssText = 'width:28px !important;height:28px !important;padding:0 !important;border-radius:8px !important;border-color:rgba(88,166,255,0.55);color:#58a6ff;';
        if (folderBtn.parentElement !== parent || parent.firstElementChild !== folderBtn) {
            parent.insertBefore(folderBtn, parent.firstElementChild);
        }

        if (!hub) {
            hub = document.createElement('div');
            hub.id = 'jennySourcesHubBarV91';
            hub.style.cssText = 'display:inline-flex;align-items:center;gap:3px;';
            if (oldBtn && oldBtn.parentElement === parent) oldBtn.replaceWith(hub);
            else parent.insertBefore(hub, settingsBtn);
        } else if (hub.parentElement !== parent) {
            parent.insertBefore(hub, settingsBtn);
        }

        var btnsHtml = pinned.map(function(id) {
            var s = (window.SOURCES_CATALOG_V91 || []).find(function(x) { return x.id === id; });
            if (!s) return '';
            var btnIdAttr = (id === 'ost') ? 'id="btnKhinsiderOstV88"' : 'id="btnPinnedSrc_' + id + '_V91"';
            return '<button type="button" ' + btnIdAttr + ' class="jenny-icon-pill" onclick="window.triggerSourceActionV91(\'' + s.id + '\', event)" title="' + s.title + '" style="width:28px !important;height:28px !important;padding:0 !important;border-radius:8px !important;">' + s.svg + '</button>';
        }).join('');

        var hubSvg = (window.JENNY_NEON_SVGS_V92 && window.JENNY_NEON_SVGS_V92.hub) || '⊞';
        hub.innerHTML = btnsHtml + '<button type="button" id="btnSourcesHubDropV91" class="jenny-icon-pill" onclick="window.toggleSourcesDropdownMenuV91(event)" title="Все источники" style="width:28px !important;height:28px !important;padding:0 !important;border-radius:8px !important;">' + hubSvg + '</button>';
        hub._v224PinnedSig = sig;

        if (settingsBtn) {
            settingsBtn.style.cssText = 'width:28px !important;height:28px !important;padding:0 !important;border-radius:8px !important;';
        }

        // Восстанавливаем активные мини-бейджи поверх кнопок без изменения их ширины
        var badges = window._sourceBadgesV99 || {};
        Object.keys(badges).forEach(function(k) {
            if (badges[k]) window.applyHeaderIconBadgeV99(k, badges[k]);
        });
    };

    // Переопределяем togglePinSourceV91, чтобы при ручном переключении [ВКЛ] в меню ⊞ шапка обновлялась с forceRebuild = true
    var _origTogglePinSourceV224 = window.togglePinSourceV91;
    window.togglePinSourceV91 = function(srcId, ev) {
        var r = (typeof _origTogglePinSourceV224 === 'function')
            ? _origTogglePinSourceV224.apply(this, arguments)
            : undefined;
        window.renderHeaderSourcesHubV91(true);
        return r;
    };

    // Переопределяем applyHeaderIconBadgeV99:
    // НИКОГДА не меняем width/padding кнопки в шапке (никаких width:auto или width:32px!),
    // чтобы соседние кнопки в #topHeaderCapsule не прыгали ни на 1 пиксель!
    window._sourceBadgesV99 = window._sourceBadgesV99 || { ost: '', archive: '', radio: '', soundcloud: '', torrent: '' };
    window.applyHeaderIconBadgeV99 = function(srcId, badgeText) {
        var cleanText = String(badgeText || '').trim();
        window._sourceBadgesV99[srcId] = cleanText;
        var btnId = (srcId === 'ost') ? 'btnKhinsiderOstV88' : ('btnPinnedSrc_' + srcId + '_V91');
        var btn = document.getElementById(btnId);
        if (!btn) return;
        if (btn._v224LastBadgeText === cleanText) return;
        btn._v224LastBadgeText = cleanText;

        var badgeEl = btn.querySelector('.jenny-hdr-corner-badge-v224');
        if (!cleanText) {
            if (badgeEl) badgeEl.remove();
            return;
        }
        if (!badgeEl) {
            badgeEl = document.createElement('span');
            badgeEl.className = 'jenny-hdr-corner-badge-v224';
            btn.appendChild(badgeEl);
        }
        badgeEl.textContent = cleanText;
    };
})();
/* ================= END JENNY_V229_POLISH_PATCH ================= */

/* ================= JENNY_V230_YOUTUBE_STUDIO_AND_SO_CORE_PATCH (#328 / V233): YOUTUBE IN SOURCES MENU, CUSTOM EXPANDABLE HTML DROPDOWNS (NO BROKEN WEBVIEW <SELECT>), YT-DLP + MIRROR POOL + .SO QUALITY ENGINE (71575, 71577, 71581, 71582, 71594, 71597) ================= */
/* [split] V230: кусок исходного IIFE (ui_v71.js, строки 28399–29051) → ui_sources.js */
;(function() {
    if (window._jennyV230Installed__sources) return;
    window._jennyV230Installed__sources = true;
    window._jennyV230Installed = true;

    window.JENNY_NEON_SVGS_V92 = window.JENNY_NEON_SVGS_V92 || {};
    window.JENNY_NEON_SVGS_V92.youtube =
        '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#ff5555" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 5px rgba(255,85,85,0.68));">' +
            '<rect x="2" y="4.5" width="20" height="15" rx="4.2"/>' +
            '<polygon points="10 9 15.5 12 10 15" fill="#ff5555" stroke="none"/>' +
        '</svg>';

    window.SOURCES_CATALOG_V91 = window.SOURCES_CATALOG_V91 || [];
    if (!window.SOURCES_CATALOG_V91.some(function(s) { return s.id === 'youtube'; })) {
        window.SOURCES_CATALOG_V91.push({
            id: 'youtube',
            svg: window.JENNY_NEON_SVGS_V92.youtube,
            title: 'YouTube Студия (Поток / Скачка)'
        });
    }

    var _origGetPinnedV230 = window.getPinnedSourcesV91;
    window.getPinnedSourcesV91 = function() {
        window.appConfig = window.appConfig || {};
        if (!Array.isArray(window.appConfig.pinnedSourcesV91)) {
            window.appConfig.pinnedSourcesV91 = ['torrent', 'ost', 'radio', 'soundcloud', 'youtube'];
        }
        if (!localStorage.getItem('jenny_pinned_v230_yt_migrated')) {
            localStorage.setItem('jenny_pinned_v230_yt_migrated', '1');
            if (window.appConfig.pinnedSourcesV91.indexOf('youtube') === -1) {
                window.appConfig.pinnedSourcesV91.push('youtube');
            }
            try { localStorage.setItem('ytm_config', JSON.stringify(window.appConfig)); } catch (e) {}
        }
        return window.appConfig.pinnedSourcesV91.slice(0, 6);
    };

    var _origTriggerSourceV230 = window.triggerSourceActionV91;
    window.triggerSourceActionV91 = function(srcId, ev) {
        if (srcId === 'youtube') {
            if (ev && ev.stopPropagation) ev.stopPropagation();
            var menu = document.getElementById('jennySourcesDropMenuV91');
            if (menu) menu.style.display = 'none';
            window.openYoutubeStudioModalV230(ev);
            return;
        }
        if (typeof _origTriggerSourceV230 === 'function') {
            return _origTriggerSourceV230.apply(this, arguments);
        }
    };

    window.YT_QUALITY_OPTIONS_V230 = [
        { h: 144,  label: '144p (Эконом)' },
        { h: 240,  label: '240p (Низкое)' },
        { h: 360,  label: '360p (Стандарт)' },
        { h: 480,  label: '480p (DVD / SD)' },
        { h: 720,  label: '720p (HD)' },
        { h: 1080, label: '1080p (Full HD)' },
        { h: 1440, label: '1440p (2K QHD)' },
        { h: 2160, label: '2160p (4K UHD)' }
    ];

    window.YT_NET_MODES_V233 = [
        { id: 'auto',   label: '📡 Авто (Wi-Fi / Моб.)' },
        { id: 'wifi',   label: '📶 Только Wi-Fi профиль' },
        { id: 'mobile', label: '📱 Только Мобильная сеть' }
    ];

    window.getYtQualityLabelByHV233 = function(h) {
        var num = Number(h) || 1080;
        var found = window.YT_QUALITY_OPTIONS_V230.find(function(o) { return Number(o.h) === num; });
        return found ? found.label : (num + 'p');
    };

    window.loadYtStudioStateV230 = function() {
        var saved = {};
        try {
            saved = JSON.parse(localStorage.getItem('jenny_yt_studio_cfg_v230') || '{}') || {};
        } catch (e) {}
        return {
            active_core: saved.active_core || 'yt_v1_so',
            cores: [
                { id: 'yt_v1_so',     title: '⚡ YT Core v1.0-so (yt-dlp + .so • Android VR)' },
                { id: 'yt_v2_ios',    title: '🔥 YT Core v1.1-so (yt-dlp + .so • iOS High-Bitrate)' },
                { id: 'yt_v3_tv',     title: '📺 YT Core v1.2-so (yt-dlp + .so • SmartTV / Embed)' },
                { id: 'yt_v4_mirror', title: '🌐 YT Core v1.3-api (Piped / Invidious Live Mirror Pool)' }
            ],
            policy: {
                use_max_ceiling: saved.use_max_ceiling !== undefined ? Boolean(saved.use_max_ceiling) : true,
                max_ceiling_h: Number(saved.max_ceiling_h) || 1080,
                use_wifi_quality: saved.use_wifi_quality !== undefined ? Boolean(saved.use_wifi_quality) : false,
                wifi_target_h: Number(saved.wifi_target_h) || 1080,
                use_mobile_quality: saved.use_mobile_quality !== undefined ? Boolean(saved.use_mobile_quality) : false,
                mobile_target_h: Number(saved.mobile_target_h) || 480,
                net_mode: saved.net_mode || 'auto'
            },
            qualityPanelOpen: saved.qualityPanelOpen !== undefined ? Boolean(saved.qualityPanelOpen) : true,
            openDropdownId: null, // 'core', 'max', 'wifi', 'mob', 'net'
            effective_limit_h: 1080,
            detected_net: 'wifi',
            results: [],
            resolvedMap: {}
        };
    };

    window._ytStudioStateV230 = window.loadYtStudioStateV230();

    window.detectClientNetworkTypeV230 = function() {
        var st = window._ytStudioStateV230;
        if (st && st.policy && st.policy.net_mode && st.policy.net_mode !== 'auto') {
            return st.policy.net_mode;
        }
        try {
            var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (conn && conn.type) {
                if (conn.type === 'cellular' || conn.type === 'wimax') return 'mobile';
                if (conn.type === 'wifi' || conn.type === 'ethernet') return 'wifi';
            }
        } catch (e) {}
        return 'auto';
    };

    window.computeLocalEffectiveLimitV230 = function() {
        var p = window._ytStudioStateV230.policy;
        var net = window.detectClientNetworkTypeV230();
        var isMob = (net === 'mobile' || (net === 'auto' && window._ytStudioStateV230.detected_net === 'mobile'));
        var limit = Number(p.max_ceiling_h) || 1080;

        if (!isMob && p.use_wifi_quality) {
            limit = Number(p.wifi_target_h) || limit;
            if (p.use_max_ceiling && Number(p.max_ceiling_h) > 0 && limit > Number(p.max_ceiling_h)) {
                limit = Number(p.max_ceiling_h);
            }
            return limit;
        }
        if (isMob && p.use_mobile_quality) {
            limit = Number(p.mobile_target_h) || 480;
            if (p.use_max_ceiling && Number(p.max_ceiling_h) > 0 && limit > Number(p.max_ceiling_h)) {
                limit = Number(p.max_ceiling_h);
            }
            return limit;
        }
        return limit;
    };

    window.saveAndSyncYtPolicyV230 = async function() {
        var st = window._ytStudioStateV230;
        var p = st.policy;
        try {
            localStorage.setItem('jenny_yt_studio_cfg_v230', JSON.stringify({
                active_core: st.active_core,
                use_max_ceiling: p.use_max_ceiling,
                max_ceiling_h: p.max_ceiling_h,
                use_wifi_quality: p.use_wifi_quality,
                wifi_target_h: p.wifi_target_h,
                use_mobile_quality: p.use_mobile_quality,
                mobile_target_h: p.mobile_target_h,
                net_mode: p.net_mode,
                qualityPanelOpen: st.qualityPanelOpen
            }));
        } catch (e) {}

        st.effective_limit_h = window.computeLocalEffectiveLimitV230();
        window.updateYtPolicySummaryBadgeV230();

        try {
            var res = await fetch('/api/youtube/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    active_core: st.active_core,
                    policy: st.policy,
                    client_net: window.detectClientNetworkTypeV230()
                })
            });
            if (res.ok) {
                var d = await res.json();
                if (d.effective_limit_h) st.effective_limit_h = d.effective_limit_h;
                if (d.detected_net) st.detected_net = d.detected_net;
                window.updateYtPolicySummaryBadgeV230();
            }
        } catch (e) {}
    };

    window.fetchYtCoresStatusV230 = async function() {
        try {
            var res = await fetch('/api/youtube/cores');
            if (!res.ok) return;
            var d = await res.json();
            var st = window._ytStudioStateV230;
            if (Array.isArray(d.cores) && d.cores.length > 0) {
                st.cores = d.cores;
            }
            if (d.detected_net) st.detected_net = d.detected_net;
            window.renderYtCoreAndQualityPanelV230();
            await window.saveAndSyncYtPolicyV230();
        } catch (e) {}
    };

    window.updateYtPolicySummaryBadgeV230 = function() {
        var st = window._ytStudioStateV230;
        var p = st.policy;
        var eff = window.computeLocalEffectiveLimitV230();
        var badge = document.getElementById('ytActiveLimitBadgeV230');
        if (badge) {
            var parts = [];
            if (p.use_max_ceiling) parts.push('Макс ≤ ' + p.max_ceiling_h + 'p');
            if (p.use_wifi_quality) parts.push('Wi-Fi: ' + p.wifi_target_h + 'p');
            if (p.use_mobile_quality) parts.push('Моб: ' + p.mobile_target_h + 'p');
            if (parts.length === 0) parts.push('Авто ≤ ' + eff + 'p');
            badge.innerText = '🎯 Лимит: ≤ ' + eff + 'p (' + parts.join(' • ') + ')';
        }
    };

    window.onYtPolicyChangeV230 = function() {
        var st = window._ytStudioStateV230;
        var p = st.policy;

        var chkMax = document.getElementById('ytChkMaxCeilingV230');
        var chkWifi = document.getElementById('ytChkWifiQualityV230');
        var chkMob = document.getElementById('ytChkMobileQualityV230');

        if (chkMax) p.use_max_ceiling = Boolean(chkMax.checked);
        if (chkWifi) p.use_wifi_quality = Boolean(chkWifi.checked);
        if (chkMob) p.use_mobile_quality = Boolean(chkMob.checked);

        window.saveAndSyncYtPolicyV230();
    };

    window.toggleYtQualitySubmenuV230 = function() {
        var st = window._ytStudioStateV230;
        st.qualityPanelOpen = !st.qualityPanelOpen;
        if (!st.qualityPanelOpen) st.openDropdownId = null;
        window.renderYtCoreAndQualityPanelV230();
        window.saveAndSyncYtPolicyV230();
    };

    // КАСТОМНЫЕ РАСКРЫВАЮЩИЕСЯ СПИСКИ ВНУТРИ МОДАЛКИ (100% РАБОТАЮТ В ANDROID WEBVIEW БЕЗ НАТИВНОГО <SELECT>!)
    window.toggleYtCustomDropdownV233 = function(dropId, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._ytStudioStateV230;
        st.openDropdownId = (st.openDropdownId === dropId) ? null : dropId;
        window.renderYtCoreAndQualityPanelV230();
    };

    window.selectYtCoreOptionV233 = function(coreId, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._ytStudioStateV230;
        st.active_core = coreId;
        st.openDropdownId = null;
        window.renderYtCoreAndQualityPanelV230();
        window.saveAndSyncYtPolicyV230();
        if (typeof window.showToast === 'function') {
            var cObj = (st.cores || []).find(function(x) { return x.id === coreId; });
            window.showToast('🧠 Выбрано ядро: ' + (cObj ? cObj.title : coreId));
        }
    };

    window.selectYtQualityOptionV233 = function(ruleKey, heightVal, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._ytStudioStateV230;
        var p = st.policy;
        var h = parseInt(heightVal, 10) || 1080;

        if (ruleKey === 'max') {
            p.max_ceiling_h = h;
            p.use_max_ceiling = true;
        } else if (ruleKey === 'wifi') {
            p.wifi_target_h = h;
            p.use_wifi_quality = true;
        } else if (ruleKey === 'mob') {
            p.mobile_target_h = h;
            p.use_mobile_quality = true;
        }

        st.openDropdownId = null;
        window.renderYtCoreAndQualityPanelV230();
        window.saveAndSyncYtPolicyV230();
    };

    window.selectYtNetModeOptionV233 = function(netMode, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._ytStudioStateV230;
        st.policy.net_mode = netMode || 'auto';
        st.openDropdownId = null;
        window.renderYtCoreAndQualityPanelV230();
        window.saveAndSyncYtPolicyV230();
    };

    window.buildCustomQualityGridHtmlV233 = function(ruleKey, currentH, accentColor) {
        return '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:5px;padding:6px;background:#05080d;border:1px solid ' + accentColor + ';border-radius:8px;margin-top:4px;">' +
            window.YT_QUALITY_OPTIONS_V230.map(function(opt) {
                var isAct = (Number(opt.h) === Number(currentH));
                return '<button type="button" onclick="window.selectYtQualityOptionV233(\'' + ruleKey + '\', ' + opt.h + ', event)" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;font-size:11px;font-weight:' + (isAct ? '900' : '600') + ';border-radius:6px;background:' + (isAct ? 'rgba(63,185,80,0.22)' : '#0d131d') + ';color:' + (isAct ? '#3fb950' : '#e6edf3') + ';border:1px solid ' + (isAct ? '#3fb950' : '#262c36') + ';text-align:left;cursor:pointer;">' +
                    '<span>' + opt.label + '</span>' +
                    '<span>' + (isAct ? '✅' : '') + '</span>' +
                '</button>';
            }).join('') +
        '</div>';
    };

    window.renderYtCoreAndQualityPanelV230 = function() {
        var wrap = document.getElementById('ytCoreAndQualityWrapV230');
        if (!wrap) return;
        var st = window._ytStudioStateV230;
        var p = st.policy;
        var eff = window.computeLocalEffectiveLimitV230();
        var openId = st.openDropdownId;

        var activeCoreObj = (st.cores || []).find(function(c) { return c.id === st.active_core; }) || (st.cores && st.cores[0]) || { id: 'yt_v1_so', title: '⚡ YT Core v1.0-so' };
        var shortCoreTitle = String(activeCoreObj.title || '').replace(/\s*\(.*?\)\s*/g, '') || activeCoreObj.title;

        var coreMenuHtml = (openId === 'core')
            ? '<div style="display:flex;flex-direction:column;gap:5px;padding:7px;background:#05080d;border:1px solid #58a6ff;border-radius:8px;margin-top:2px;">' +
                (st.cores || []).map(function(c) {
                    var isAct = (c.id === st.active_core);
                    return '<button type="button" onclick="window.selectYtCoreOptionV233(\'' + c.id + '\', event)" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;font-size:11px;font-weight:' + (isAct ? '900' : '600') + ';border-radius:7px;background:' + (isAct ? 'rgba(88,166,255,0.22)' : '#0d131d') + ';color:' + (isAct ? '#58a6ff' : '#e6edf3') + ';border:1px solid ' + (isAct ? '#58a6ff' : '#262c36') + ';text-align:left;cursor:pointer;">' +
                        '<span style="flex:1;min-width:0;overflow-wrap:anywhere;">' + c.title + '</span>' +
                        '<span>' + (isAct ? '✅' : '') + '</span>' +
                    '</button>';
                }).join('') +
              '</div>'
            : '';

        var netLabel = (p.net_mode === 'wifi')
            ? '📶 Wi-Fi'
            : ((p.net_mode === 'mobile') ? '📱 Мобильная' : ('📡 Авто (' + (st.detected_net === 'mobile' ? 'Моб.' : 'Wi-Fi') + ')'));

        var netMenuHtml = (openId === 'net')
            ? '<div style="display:flex;flex-direction:column;gap:4px;padding:6px;background:#05080d;border:1px solid #58a6ff;border-radius:8px;margin-top:4px;">' +
                window.YT_NET_MODES_V233.map(function(nm) {
                    var isAct = (nm.id === p.net_mode);
                    return '<button type="button" onclick="window.selectYtNetModeOptionV233(\'' + nm.id + '\', event)" style="display:flex;align-items:center;justify-content:space-between;padding:6px 9px;font-size:11px;font-weight:' + (isAct ? '900' : '600') + ';border-radius:6px;background:' + (isAct ? 'rgba(88,166,255,0.2)' : '#0d131d') + ';color:' + (isAct ? '#58a6ff' : '#e6edf3') + ';border:1px solid ' + (isAct ? '#58a6ff' : '#262c36') + ';cursor:pointer;">' +
                        '<span>' + nm.label + '</span>' +
                        '<span>' + (isAct ? '✅' : '') + '</span>' +
                    '</button>';
                }).join('') +
              '</div>'
            : '';

        wrap.innerHTML =
            // Строка выбора .so ядра под строкой поиска (кастомный раскрывающийся список!)
            '<div style="display:flex;flex-direction:column;gap:4px;">' +
                '<div style="display:flex;align-items:center;gap:6px;background:#0d131d;border:1px solid #30363d;border-radius:8px;padding:6px 8px;">' +
                    '<span style="font-size:11px;color:#ff7b72;font-weight:bold;white-space:nowrap;">🧠 Ядро YT:</span>' +
                    '<button type="button" onclick="window.toggleYtCustomDropdownV233(\'core\', event)" style="flex:1;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 8px;font-size:11px;font-weight:bold;background:#06080b;color:#58a6ff;border:1px solid #58a6ff;border-radius:6px;cursor:pointer;text-align:left;">' +
                        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + shortCoreTitle + '</span>' +
                        '<span style="flex-shrink:0;">' + (openId === 'core' ? '▴' : '▾') + '</span>' +
                    '</button>' +
                    '<button type="button" onclick="window.toggleYtQualitySubmenuV230()" style="padding:5px 8px;font-size:10.5px;font-weight:bold;border-radius:6px;background:rgba(88,166,255,0.16);border:1px solid #58a6ff;color:#58a6ff;white-space:nowrap;cursor:pointer;">' +
                        '🎛️ Качество ' + (st.qualityPanelOpen ? '▴' : '▾') +
                    '</button>' +
                '</div>' +
                coreMenuHtml +
            '</div>' +

            // Подменю с 3 галочками и кастомными раскрывающимися списками разрешений (144p .. 4K)
            '<div id="ytQualitySubmenuBoxV230" style="display:' + (st.qualityPanelOpen ? 'flex' : 'none') + ';flex-direction:column;gap:6px;background:#0b1018;border:1px solid #262c36;border-radius:9px;padding:8px 10px;">' +
                // Пункт 1: Максимальное, но не более [1080p ▾]
                '<div style="display:flex;flex-direction:column;gap:3px;">' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
                        '<label style="display:flex;align-items:center;gap:7px;color:#e6edf3;font-size:11.5px;font-weight:bold;cursor:pointer;flex:1;min-width:160px;">' +
                            '<input type="checkbox" id="ytChkMaxCeilingV230" ' + (p.use_max_ceiling ? 'checked' : '') + ' onchange="window.onYtPolicyChangeV230()" style="width:16px;height:16px;accent-color:#3fb950;">' +
                            '<span>1. Максимальное, но не более:</span>' +
                        '</label>' +
                        '<button type="button" onclick="window.toggleYtCustomDropdownV233(\'max\', event)" style="display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:136px;padding:5px 9px;font-size:11.5px;font-weight:bold;background:#06080b;color:#3fb950;border:1.5px solid #3fb950;border-radius:6px;cursor:pointer;">' +
                            '<span>' + window.getYtQualityLabelByHV233(p.max_ceiling_h) + '</span>' +
                            '<span>' + (openId === 'max' ? '▴' : '▾') + '</span>' +
                        '</button>' +
                    '</div>' +
                    (openId === 'max' ? window.buildCustomQualityGridHtmlV233('max', p.max_ceiling_h, '#3fb950') : '') +
                    '<div style="font-size:10px;color:#8b949e;line-height:1.3;padding-left:22px;">' +
                        'Если у видео макс. по факту 480p — скачает 480p; если 240p — 240p; если выше порога — ограничит выбранным (144p..4K).' +
                    '</div>' +
                '</div>' +

                // Пункт 2: Конкретное качество для Wi-Fi [1080p ▾]
                '<div style="display:flex;flex-direction:column;gap:3px;padding-top:4px;border-top:1px dashed #21262d;">' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
                        '<label style="display:flex;align-items:center;gap:7px;color:#e6edf3;font-size:11.5px;font-weight:bold;cursor:pointer;flex:1;min-width:160px;">' +
                            '<input type="checkbox" id="ytChkWifiQualityV230" ' + (p.use_wifi_quality ? 'checked' : '') + ' onchange="window.onYtPolicyChangeV230()" style="width:16px;height:16px;accent-color:#58a6ff;">' +
                            '<span>2. Качество для Wi-Fi:</span>' +
                        '</label>' +
                        '<button type="button" onclick="window.toggleYtCustomDropdownV233(\'wifi\', event)" style="display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:136px;padding:5px 9px;font-size:11.5px;font-weight:bold;background:#06080b;color:#58a6ff;border:1.5px solid #58a6ff;border-radius:6px;cursor:pointer;">' +
                            '<span>' + window.getYtQualityLabelByHV233(p.wifi_target_h) + '</span>' +
                            '<span>' + (openId === 'wifi' ? '▴' : '▾') + '</span>' +
                        '</button>' +
                    '</div>' +
                    (openId === 'wifi' ? window.buildCustomQualityGridHtmlV233('wifi', p.wifi_target_h, '#58a6ff') : '') +
                '</div>' +

                // Пункт 3: Конкретное качество для мобильного интернета [480p ▾]
                '<div style="display:flex;flex-direction:column;gap:3px;padding-top:4px;border-top:1px dashed #21262d;">' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
                        '<label style="display:flex;align-items:center;gap:7px;color:#e6edf3;font-size:11.5px;font-weight:bold;cursor:pointer;flex:1;min-width:160px;">' +
                            '<input type="checkbox" id="ytChkMobileQualityV230" ' + (p.use_mobile_quality ? 'checked' : '') + ' onchange="window.onYtPolicyChangeV230()" style="width:16px;height:16px;accent-color:#e3b341;">' +
                            '<span>3. Качество для Мобильной сети:</span>' +
                        '</label>' +
                        '<button type="button" onclick="window.toggleYtCustomDropdownV233(\'mob\', event)" style="display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:136px;padding:5px 9px;font-size:11.5px;font-weight:bold;background:#06080b;color:#e3b341;border:1.5px solid #e3b341;border-radius:6px;cursor:pointer;">' +
                            '<span>' + window.getYtQualityLabelByHV233(p.mobile_target_h) + '</span>' +
                            '<span>' + (openId === 'mob' ? '▴' : '▾') + '</span>' +
                        '</button>' +
                    '</div>' +
                    (openId === 'mob' ? window.buildCustomQualityGridHtmlV233('mob', p.mobile_target_h, '#e3b341') : '') +
                '</div>' +

                // Статус-строка активного правила и режима сети
                '<div style="display:flex;flex-direction:column;gap:3px;padding-top:5px;border-top:1px solid #21262d;">' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">' +
                        '<span id="ytActiveLimitBadgeV230" style="font-size:10.5px;color:#3fb950;font-weight:bold;">🎯 Лимит: ≤ ' + eff + 'p</span>' +
                        '<div style="display:flex;align-items:center;gap:4px;">' +
                            '<span style="font-size:10px;color:#8b949e;">Сеть:</span>' +
                            '<button type="button" onclick="window.toggleYtCustomDropdownV233(\'net\', event)" style="display:flex;align-items:center;gap:5px;padding:3px 7px;font-size:10.5px;font-weight:bold;background:#06080b;color:#c9d1d9;border:1px solid #30363d;border-radius:5px;cursor:pointer;">' +
                                '<span>' + netLabel + '</span>' +
                                '<span>' + (openId === 'net' ? '▴' : '▾') + '</span>' +
                            '</button>' +
                        '</div>' +
                    '</div>' +
                    netMenuHtml +
                '</div>' +
            '</div>';

        window.updateYtPolicySummaryBadgeV230();
    };

    window.openYoutubeStudioModalV230 = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var ex = document.getElementById('jennyYoutubeModalV230');
        if (ex) {
            var isHid = (ex.style.display === 'none' || getComputedStyle(ex).display === 'none');
            if (isHid && typeof window.closeAllV71Modals === 'function') window.closeAllV71Modals();
            ex.style.setProperty('display', isHid ? 'flex' : 'none', 'important');
            if (isHid) {
                window.renderYtCoreAndQualityPanelV230();
                window.fetchYtCoresStatusV230();
            }
            return;
        }
        if (typeof window.closeAllV71Modals === 'function') window.closeAllV71Modals();

        var m = document.createElement('div');
        m.id = 'jennyYoutubeModalV230';
        m.className = 'jenny-modal-backdrop-v71';
        m.onclick = function(e) { if (e.target === m) m.style.setProperty('display', 'none', 'important'); };
        m.innerHTML =
            '<div class="jenny-modal-card-v71" onclick="event.stopPropagation()" style="max-width:460px;max-height:88vh;display:flex;flex-direction:column;">' +
                '<div class="jenny-modal-hdr-v71" style="background:linear-gradient(90deg,rgba(255,85,85,0.24),rgba(115,65,190,0.24));">' +
                    '<span style="color:#ff7b72;font-weight:900;font-size:13px;display:flex;align-items:center;gap:6px;">' +
                        window.JENNY_NEON_SVGS_V92.youtube +
                        '<span>YOUTUBE СТУДИЯ (.SO ЯДРО)</span>' +
                    '</span>' +
                    '<button type="button" onclick="document.getElementById(\'jennyYoutubeModalV230\').style.setProperty(\'display\',\'none\',\'important\')" style="padding:4px 10px;font-size:11px;border-radius:7px;background:rgba(88,166,255,0.18);border:1px solid #58a6ff;color:#58a6ff;font-weight:bold;">➖ В фон</button>' +
                '</div>' +
                '<div style="padding:9px 12px;background:#090d14;border-bottom:1px solid #21262d;display:flex;flex-direction:column;gap:7px;max-height:52vh;overflow-y:auto;">' +
                    '<div style="display:flex;gap:6px;">' +
                        '<input type="text" id="ytSearchInpV230" value="" placeholder="Поиск на YouTube или вставь ссылку https://youtu.be/..." onkeydown="if(event.key===\'Enter\') window.runYoutubeSearchV230()" style="flex:1;padding:7px 10px;font-size:12px;background:#06080b !important;color:#e6edf3 !important;border:1px solid #30363d !important;border-radius:8px;text-align:left !important;">' +
                        '<button type="button" onclick="window.runYoutubeSearchV230()" style="padding:7px 12px;background:#da3633;color:#fff;border:none;border-radius:8px;font-weight:bold;white-space:nowrap;">🔍 Найти</button>' +
                    '</div>' +
                    '<div id="ytCoreAndQualityWrapV230" style="display:flex;flex-direction:column;gap:6px;"></div>' +
                '</div>' +
                '<div id="ytBodyListV230" style="flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px;min-height:180px;">' +
                    '<div style="color:#8b949e;text-align:center;padding:28px 10px;font-size:12px;line-height:1.45;">' +
                        '▶️ Введи запрос или вставь ссылку на YouTube-видео.<br>' +
                        'Выбери правила качества (например, <b>Макс. но не более 1080p</b>) — и ядро автоматически вытащит прямую ссылку и нужное разрешение!' +
                    '</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(m);
        window.renderYtCoreAndQualityPanelV230();
        window.fetchYtCoresStatusV230();
    };

    window.runYoutubeSearchV230 = async function() {
        var inp = document.getElementById('ytSearchInpV230');
        var body = document.getElementById('ytBodyListV230');
        if (!inp || !body) return;
        var q = inp.value.trim();
        if (!q) return;

        window._ytStudioStateV230.openDropdownId = null;
        window.renderYtCoreAndQualityPanelV230();

        body.innerHTML = '<div style="color:#ff7b72;text-align:center;padding:30px 10px;font-weight:bold;">⏳ Поиск «' + q.replace(/</g, '&lt;') + '» через YouTube-ядро...</div>';
        try {
            var res = await fetch('/api/youtube/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: q })
            });
            var d = await res.json();
            if (!res.ok || d.status !== 'ok') {
                throw new Error(d.error || 'Ошибка поиска YouTube');
            }
            var list = d.results || [];
            window._ytStudioStateV230.results = list;
            if (!list.length) {
                body.innerHTML = '<div style="color:#8b949e;text-align:center;padding:25px;">Ничего не найдено. Попробуй другой запрос или вставь прямую ссылку.</div>';
                return;
            }
            window.renderYoutubeResultsListV230();
            if (d.is_direct_link && list.length === 1) {
                window.resolveYoutubeVideoLinkV230(list[0].video_id, 0);
            }
        } catch (e) {
            body.innerHTML = '<div style="color:#ff7b72;text-align:center;padding:22px;">❌ ' + (e.message || e) + '</div>';
        }
    };

    window.renderYoutubeResultsListV230 = function() {
        var body = document.getElementById('ytBodyListV230');
        if (!body) return;
        var list = window._ytStudioStateV230.results || [];
        body.innerHTML = list.map(function(item, idx) {
            var safeTitle = String(item.title || '').replace(/</g, '&lt;');
            var safeChan = String(item.channel || '').replace(/</g, '&lt;');
            var vid = item.video_id;
            return '<div id="ytCardV230_' + idx + '" style="display:flex;flex-direction:column;gap:6px;padding:8px 10px;background:#0d1117;border:1px solid #262c36;border-radius:10px;">' +
                '<div style="display:flex;gap:9px;align-items:center;">' +
                    '<img src="' + (item.thumbnail || '') + '" style="width:76px;height:44px;object-fit:cover;border-radius:6px;background:#161b22;flex-shrink:0;" onerror="this.style.display=\'none\'">' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="color:#e6edf3;font-size:11.5px;font-weight:bold;line-height:1.3;overflow-wrap:anywhere;">' + safeTitle + '</div>' +
                        '<div style="color:#8b949e;font-size:10px;margin-top:2px;">👤 ' + safeChan + ' • ⏱ ' + (item.duration || '') + (item.views ? ' • ' + item.views : '') + '</div>' +
                    '</div>' +
                '</div>' +
                '<div style="display:flex;gap:6px;align-items:center;">' +
                    '<button type="button" onclick="window.resolveYoutubeVideoLinkV230(\'' + vid + '\', ' + idx + ')" style="flex:1;padding:5px 8px;font-size:11px;font-weight:bold;background:rgba(88,166,255,0.16);color:#58a6ff;border:1px solid #58a6ff;border-radius:7px;">🔗 Вытащить ссылку</button>' +
                    '<button type="button" onclick="window.playYoutubeVideoInDeckBV230(\'' + vid + '\', ' + idx + ')" style="padding:5px 10px;font-size:11px;font-weight:bold;background:rgba(63,185,80,0.18);color:#3fb950;border:1px solid #3fb950;border-radius:7px;">▶ В плеер</button>' +
                    '<button type="button" id="ytDlBtnV230_' + idx + '" onclick="window.downloadYoutubeVideoV230(\'' + vid + '\', ' + idx + ')" style="padding:5px 10px;font-size:11px;font-weight:bold;background:rgba(218,54,51,0.18);color:#ff7b72;border:1px solid #ff7b72;border-radius:7px;">⬇️ Скачать</button>' +
                '</div>' +
                '<div id="ytResolvedBoxV230_' + idx + '" style="display:none;flex-direction:column;gap:5px;padding:7px 8px;background:#070a0f;border:1px solid #30363d;border-radius:7px;font-size:10.5px;"></div>' +
            '</div>';
        }).join('');
    };

    window.copyYtResolvedUrlV230 = async function(videoId) {
        var d = window._ytStudioStateV230.resolvedMap[videoId];
        if (!d || !d.direct_url) return;
        try {
            if (typeof window.copyTextToClipboard === 'function') {
                await window.copyTextToClipboard(d.direct_url);
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(d.direct_url);
            }
            if (typeof window.showToast === 'function') {
                window.showToast('📋 Ссылка (' + d.selected_label + ') скопирована в буфер обмена!');
            }
        } catch (e) {}
    };

    setTimeout(function() {
        if (typeof window.renderHeaderSourcesHubV91 === 'function') {
            window.renderHeaderSourcesHubV91();
        }
        if (typeof window.renderSourcesSettingsSectionV91 === 'function') {
            window.renderSourcesSettingsSectionV91();
        }
    }, 180);
})();

/* [split] V232: кусок исходного IIFE (ui_v71.js, строки 29055–29548) → ui_sources.js */
;(function() {
    if (window._jennyV232Installed__sources) return;
    window._jennyV232Installed__sources = true;
    window._jennyV232Installed = true;

    // -------------------------------------------------------------------------
    // 5. 100% АВТО-ОСТАНОВКА ДЕКИ А ПРИ ЗАПУСКЕ РАДИО ИЛИ ЛЮБОГО ВНЕШНИХ СЕРВИСОВ (OST / SOUNDCLOUD / ТОРРЕНТ / АРХИВЫ)
    //    Переопределяем pauseMainPlayerForOstV90 на безусловный жёсткий стоп (без toggle!)
    //    и перехватываем HTMLMediaElement.prototype.play для любого внешнего <audio> (new Audio(...))!
    // -------------------------------------------------------------------------
    window.pauseMainPlayerForOstV90 = function() {
        window.forceStopPauseDeckAAudioV232(false);
    };
})();

/* [split] V236: кусок исходного IIFE (ui_v71.js, строки 30671–31598) → ui_sources.js */
;(function() {
    if (window._jennyV236Installed__sources) return;
    window._jennyV236Installed__sources = true;
    window._jennyV236Installed = true;

    // =========================================================================
    // 3. SCREEN 2 FIX (72008.jpg): INDESTRUCTIBLE SAVING OF PINNED SOURCES ([+] / [ВКЛ])
    //    AND ZERO BACKGROUND RE-RENDERS OF HEADER & DROPDOWN UNTIL USER CLICKS [+] / [ВКЛ]
    // =========================================================================
    var PIN_STORAGE_KEY_V236 = 'jenny_pinned_sources_locked_v236';

    window.readLockedPinnedSourcesV236 = function() {
        if (Array.isArray(window._lockedPinnedSourcesV236)) {
            return window._lockedPinnedSourcesV236.slice(0, 6);
        }
        var raw = null;
        try { raw = localStorage.getItem(PIN_STORAGE_KEY_V236); } catch (e) {}
        if (raw) {
            try {
                var parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    window._lockedPinnedSourcesV236 = parsed.slice(0, 6);
                    return window._lockedPinnedSourcesV236.slice();
                }
            } catch (e) {}
        }
        window.appConfig = window.appConfig || {};
        var initial = Array.isArray(window.appConfig.pinnedSourcesV91)
            ? window.appConfig.pinnedSourcesV91.slice(0, 6)
            : ['torrent', 'ost', 'radio', 'soundcloud', 'youtube'];
        window._lockedPinnedSourcesV236 = initial.slice();
        try { localStorage.setItem(PIN_STORAGE_KEY_V236, JSON.stringify(window._lockedPinnedSourcesV236)); } catch (e) {}
        return window._lockedPinnedSourcesV236.slice();
    };

    window.writeLockedPinnedSourcesV236 = function(arr) {
        var clean = Array.isArray(arr) ? arr.slice(0, 6) : [];
        window._lockedPinnedSourcesV236 = clean.slice();
        window.appConfig = window.appConfig || {};
        window.appConfig.pinnedSourcesV91 = clean.slice();
        try { localStorage.setItem(PIN_STORAGE_KEY_V236, JSON.stringify(clean)); } catch (e) {}
        try { localStorage.setItem('ytm_config', JSON.stringify(window.appConfig)); } catch (e) {}
        try {
            if (typeof window.syncPersistentUserDataV218 === 'function') {
                window.syncPersistentUserDataV218(true);
            }
        } catch (e) {}
        try {
            fetch('/api/config/save_all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(window.appConfig)
            }).catch(function() {});
        } catch (e) {}
    };

    // Always return the locked pinned sources and keep window.appConfig.pinnedSourcesV91 in sync
    window.getPinnedSourcesV91 = function() {
        var pinned = window.readLockedPinnedSourcesV236();
        window.appConfig = window.appConfig || {};
        window.appConfig.pinnedSourcesV91 = pinned.slice();
        return pinned;
    };

    // Freeze renderHeaderSourcesHubV91 & renderSourcesDropdownMenuContentV218 after initial mount:
    // ONLY rebuild when window._userPinClickActiveV236 === true (i.e. when the user clicks [+] or [ВКЛ])!
    var _origRenderHeaderSourcesV236 = window.renderHeaderSourcesHubV91;
    window._headerSourcesBuiltOnceV236 = false;
    window._userPinClickActiveV236 = false;

    window.renderHeaderSourcesHubV91 = function() {
        var hub = document.getElementById('jennySourcesHubBarV91');
        var dropBtn = document.getElementById('btnSourcesHubDropV91');
        if (window._headerSourcesBuiltOnceV236 && hub && dropBtn && !window._userPinClickActiveV236) {
            return;
        }
        if (typeof _origRenderHeaderSourcesV236 === 'function') {
            _origRenderHeaderSourcesV236.call(this, true);
            if (document.getElementById('jennySourcesHubBarV91')) {
                window._headerSourcesBuiltOnceV236 = true;
            }
        }
    };

    window.buildSourcesDropdownDOMOnceV236 = function(menu) {
        if (!menu) menu = document.getElementById('jennySourcesDropMenuV91');
        if (!menu) return;
        var pinned = window.getPinnedSourcesV91();
        var catalog = window.SOURCES_CATALOG_V91 || [];

        menu.innerHTML =
            '<div style="font-size:10.5px;color:#8b949e;padding:2px 4px;display:flex;justify-content:space-between;">' +
                '<span>ВЫБЕРИ ИСТОЧНИК:</span>' +
                '<span id="jennySourcesHdrCntV236">В шапке (' + pinned.length + '/' + catalog.length + ')</span>' +
            '</div>' +
            catalog.map(function(s) {
                var isPin = pinned.indexOf(s.id) !== -1;
                return '<div id="jennySrcDropRowV236_' + s.id + '" style="display:flex;align-items:center;gap:8px;background:#0f141d;border:1px solid ' + (isPin ? '#3fb950' : '#262c36') + ';border-radius:9px;padding:7px 9px;">' +
                    '<div onclick="window.triggerSourceActionV91(\'' + s.id + '\', event)" style="display:flex;align-items:center;gap:8px;flex:1;color:#e6edf3;font-size:12px;font-weight:bold;cursor:pointer;">' +
                        '<span style="display:inline-flex;width:20px;justify-content:center;">' + s.svg + '</span>' +
                        '<span>' + s.title + '</span>' +
                    '</div>' +
                    '<button type="button" id="jennySrcPinBtnV236_' + s.id + '" onclick="window.togglePinSourceV91(\'' + s.id + '\', event)" style="padding:4px 9px;font-size:10.5px;font-weight:bold;border-radius:6px;background:' + (isPin ? 'rgba(63,185,80,0.22)' : '#161b22') + ';border:1px solid ' + (isPin ? '#3fb950' : '#30363d') + ';color:' + (isPin ? '#3fb950' : '#8b949e') + ';cursor:pointer;min-width:38px;text-align:center;">' +
                        (isPin ? 'ВКЛ' : '+') +
                    '</button>' +
                '</div>';
            }).join('');
        menu._builtOnceV236 = true;
    };

    window.syncSourcesDropdownPinStatesInPlaceV236 = function() {
        var menu = document.getElementById('jennySourcesDropMenuV91');
        if (!menu || !menu._builtOnceV236) return;
        var pinned = window.getPinnedSourcesV91();
        var catalog = window.SOURCES_CATALOG_V91 || [];
        var cntEl = document.getElementById('jennySourcesHdrCntV236');
        if (cntEl) cntEl.innerText = 'В шапке (' + pinned.length + '/' + catalog.length + ')';

        catalog.forEach(function(s) {
            var isPin = pinned.indexOf(s.id) !== -1;
            var row = document.getElementById('jennySrcDropRowV236_' + s.id);
            var btn = document.getElementById('jennySrcPinBtnV236_' + s.id);
            if (row) {
                row.style.borderColor = isPin ? '#3fb950' : '#262c36';
            }
            if (btn) {
                btn.innerText = isPin ? 'ВКЛ' : '+';
                btn.style.background = isPin ? 'rgba(63,185,80,0.22)' : '#161b22';
                btn.style.borderColor = isPin ? '#3fb950' : '#30363d';
                btn.style.color = isPin ? '#3fb950' : '#8b949e';
            }
        });
    };

    window.renderSourcesDropdownMenuContentV218 = function(menu) {
        if (!menu) menu = document.getElementById('jennySourcesDropMenuV91');
        if (!menu) return;
        if (!menu._builtOnceV236 || menu.children.length === 0) {
            window.buildSourcesDropdownDOMOnceV236(menu);
            return;
        }
        if (window._userPinClickActiveV236) {
            window.syncSourcesDropdownPinStatesInPlaceV236();
        }
    };

    window.toggleSourcesDropdownMenuV91 = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var menu = document.getElementById('jennySourcesDropMenuV91');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'jennySourcesDropMenuV91';
            menu.style.cssText = 'position:fixed;top:54px;right:12px;width:310px;background:#090d14;border:1.5px solid #58a6ff;border-radius:12px;padding:8px;z-index:2147483645;box-shadow:0 12px 32px rgba(0,0,0,0.95);display:none;flex-direction:column;gap:6px;';
            document.body.appendChild(menu);
            document.addEventListener('click', function(e) {
                if (menu.style.display !== 'none' && !menu.contains(e.target) && (!e.target.closest || !e.target.closest('#btnSourcesHubDropV91'))) {
                    menu.style.display = 'none';
                }
            });
        }
        if (menu.style.display === 'flex') {
            menu.style.display = 'none';
            return;
        }
        if (!menu._builtOnceV236 || menu.children.length === 0) {
            window.buildSourcesDropdownDOMOnceV236(menu);
        }
        menu.style.display = 'flex';
    };

    // Explicit click handler for [+] / [ВКЛ]: the ONLY place allowed to update header icons & dropdown list after startup!
    window.togglePinSourceV91 = function(srcId, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (ev && ev.preventDefault) ev.preventDefault();

        var pinned = window.getPinnedSourcesV91().slice();
        var idx = pinned.indexOf(srcId);
        if (idx !== -1) {
            pinned.splice(idx, 1);
        } else {
            pinned.push(srcId);
        }

        window.writeLockedPinnedSourcesV236(pinned);

        window._userPinClickActiveV236 = true;
        try {
            window.syncSourcesDropdownPinStatesInPlaceV236();
            window.renderHeaderSourcesHubV91(true);
            if (typeof window.renderSourcesSettingsSectionV91 === 'function') {
                window.renderSourcesSettingsSectionV91();
            }
        } finally {
            window._userPinClickActiveV236 = false;
        }
    };

    // Initial boot sync for V236
    var initV236 = function() {
        window.readLockedPinnedSourcesV236();
        window._userPinClickActiveV236 = true;
        try {
            window.renderHeaderSourcesHubV91(true);
        } finally {
            window._userPinClickActiveV236 = false;
        }
        window.syncGuideButtonPositionV165();
    };
})();

/* [split] V237: кусок исходного IIFE (ui_v71.js, строки 31602–32550) → ui_sources.js */
;(function() {
    if (window._jennyV237Installed__sources) return;
    window._jennyV237Installed__sources = true;
    window._jennyV237Installed = true;

    // -------------------------------------------------------------------------
    // 2. RESTORE MASTER KILL SWITCH (#btnKillAllSourcesV94) AT BOTTOM OF #jennySourcesDropMenuV91 (72444.jpg)
    // -------------------------------------------------------------------------
    window.computeSourcesActiveStatusLabelV237 = function() {
        var activeDomCnt = [
            'jennyKhinsiderModalV88',
            'jennyFlacRadioModalV91',
            'jennySoundCloudModalV93',
            'jennyTorrentModalV91',
            'jennyTorInspectorModalV128',
            'jennyYoutubeModalV230'
        ].filter(function(id) { return Boolean(document.getElementById(id)); }).length;

        var anyTorDl = Object.values(window._torMapV112 || {}).some(function(j) { return Boolean(j && j.dlActive); });
        var isPlayingStream = Boolean(
            anyTorDl ||
            (window._khStateV88 && window._khStateV88.previewAudio && !window._khStateV88.previewAudio.paused) ||
            (window._radioStateV91 && window._radioStateV91.audio && !window._radioStateV91.audio.paused) ||
            (window._khStateV88 && window._khStateV88.isDownloading) ||
            (window._radioStateV91 && window._radioStateV91.isRecording)
        );

        return (activeDomCnt > 0 || isPlayingStream)
            ? ('В фоне: ' + activeDomCnt + (isPlayingStream ? ' • 🔊 АКТИВЕН' : ''))
            : 'Всё чисто';
    };

    window.updateKillAllSourcesButtonStatusV237 = function() {
        var lbl = document.getElementById('lblKillAllSourcesStatusV94');
        if (lbl) {
            lbl.textContent = window.computeSourcesActiveStatusLabelV237();
        }
    };

    window.killAllSourceModulesV94 = async function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();

        if (typeof window.stopKhPreviewV88 === 'function') { try { window.stopKhPreviewV88(); } catch (e) {} }
        if (typeof window.stopFlacRadioStreamV91 === 'function') { try { window.stopFlacRadioStreamV91(); } catch (e) {} }
        if (typeof window.stopKhProgressPollV89 === 'function') { try { window.stopKhProgressPollV89(); } catch (e) {} }
        if (typeof window.stopAllExternalStreamsV97 === 'function') { try { window.stopAllExternalStreamsV97(); } catch (e) {} }

        if (window._khStateV88) {
            window._khStateV88.abortDownload = true;
            window._khStateV88.isDownloading = false;
        }
        if (window._radioStateV91) {
            if (window._radioStateV91.recTimer) clearInterval(window._radioStateV91.recTimer);
            window._radioStateV91.isRecording = false;
            window._radioStateV91.currentStation = null;
        }
        if (window._torGlobalTimerV112) {
            clearInterval(window._torGlobalTimerV112);
            window._torGlobalTimerV112 = null;
        }
        Object.values(window._torMapV112 || {}).forEach(function(j) {
            if (j) j.dlActive = false;
        });
        if (window._torStateV96) {
            window._torStateV96.dlActive = false;
            window._torStateV96.dlOverallPct = 0;
        }
        ['ost', 'archive', 'radio', 'soundcloud', 'torrent', 'youtube'].forEach(function(k) {
            if (typeof window.applyHeaderIconBadgeV99 === 'function') {
                window.applyHeaderIconBadgeV99(k, '');
            }
        });

        [
            'jennyKhinsiderModalV88',
            'jennyFlacRadioModalV91',
            'jennySoundCloudModalV93',
            'jennyTorrentModalV91',
            'jennyTorInspectorModalV128',
            'jennyYoutubeModalV230'
        ].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });

        var menu = document.getElementById('jennySourcesDropMenuV91');
        if (menu) menu.style.display = 'none';

        window.updateKillAllSourcesButtonStatusV237();
        if (window.AndroidBridge && typeof window.AndroidBridge.updateDataSyncState === 'function') {
            try { window.AndroidBridge.updateDataSyncState(false, '', '', -1); } catch (e) {}
        }

        try { await fetch('/api/sources/kill_all', { method: 'POST' }); } catch (e) {}

        if (typeof window.showToast === 'function') {
            window.showToast('🔌 Все внешние модули и фоновые потоки выгружены');
        }
    };

    var _origBuildDropDOMOnceV236 = window.buildSourcesDropdownDOMOnceV236;
    window.buildSourcesDropdownDOMOnceV236 = function(menu) {
        if (!menu) menu = document.getElementById('jennySourcesDropMenuV91');
        if (!menu) return;
        if (typeof _origBuildDropDOMOnceV236 === 'function') {
            _origBuildDropDOMOnceV236(menu);
        }
        if (!document.getElementById('btnKillAllSourcesV94')) {
            var killBtn = document.createElement('button');
            killBtn.type = 'button';
            killBtn.id = 'btnKillAllSourcesV94';
            killBtn.onclick = function(e) { window.killAllSourceModulesV94(e); };
            killBtn.style.cssText = 'margin-top:4px;width:100%;padding:8px 10px;border-radius:8px;background:linear-gradient(90deg,rgba(218,54,51,0.25),rgba(115,65,190,0.2));border:1px solid #ff7b72;color:#ff7b72;font-size:11.5px;font-weight:900;display:flex;justify-content:space-between;align-items:center;cursor:pointer;box-sizing:border-box;';
            killBtn.innerHTML = '<span>🔌 ВЫРУБИТЬ ВСЕ МОДУЛИ</span><span id="lblKillAllSourcesStatusV94" style="font-size:10px;color:#e6edf3;background:rgba(0,0,0,0.45);padding:2px 6px;border-radius:5px;">' + window.computeSourcesActiveStatusLabelV237() + '</span>';
            menu.appendChild(killBtn);
        }

        // Also add quick toggle for locking the Android background notification right inside the hub menu!
        if (!document.getElementById('btnLockBgNotifV237')) {
            var isLocked = localStorage.getItem('jenny_notif_locked_v237') !== '0';
            var lockBtn = document.createElement('button');
            lockBtn.type = 'button';
            lockBtn.id = 'btnLockBgNotifV237';
            lockBtn.onclick = function(e) {
                if (e && e.stopPropagation) e.stopPropagation();
                window.toggleAndroidNotifLockFromUIV237(e);
            };
            lockBtn.style.cssText = 'width:100%;padding:6px 10px;border-radius:8px;background:#0d1117;border:1px solid ' + (isLocked ? '#3fb950' : '#30363d') + ';color:' + (isLocked ? '#3fb950' : '#8b949e') + ';font-size:10.5px;font-weight:800;display:flex;justify-content:space-between;align-items:center;cursor:pointer;box-sizing:border-box;';
            lockBtn.innerHTML = '<span>🛡️ Уведомление DataSync (Защита от закрытия)</span><span id="lblLockBgNotifStateV237">' + (isLocked ? '🔒 ЗАКРЕПЛЕНО' : '🔓 СВОБОДНО') + '</span>';
            menu.appendChild(lockBtn);
        }
    };

    var _origToggleDropMenuV236 = window.toggleSourcesDropdownMenuV91;
    window.toggleSourcesDropdownMenuV91 = function(ev) {
        var r = (typeof _origToggleDropMenuV236 === 'function')
            ? _origToggleDropMenuV236.apply(this, arguments)
            : undefined;
        var menu = document.getElementById('jennySourcesDropMenuV91');
        if (menu && menu.style.display === 'flex') {
            if (!document.getElementById('btnKillAllSourcesV94')) {
                window.buildSourcesDropdownDOMOnceV236(menu);
            } else {
                window.updateKillAllSourcesButtonStatusV237();
            }
        }
        return r;
    };
})();

/* [split] V240: кусок исходного IIFE (ui_v71.js, строки 32979–33429) → ui_sources.js */
;(function() {
    if (window._jennyV240Installed__sources) return;
    window._jennyV240Installed__sources = true;
    window._jennyV240Installed = true;

    // -------------------------------------------------------------------------
    // 2. RADIO RECORDING: EXACT MM:SS TIMER + AUTO-SAVE WHEN RADIO STREAM IS STOPPED
    // -------------------------------------------------------------------------
    window.fmtRadioRecDurationV240 = function(sec) {
        var s = Math.max(0, Math.floor(Number(sec) || 0));
        var m = Math.floor(s / 60);
        var r = s % 60;
        return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
    };

    window._finalizingRadioRecLockV240 = false;
    window.finalizeActiveRadioRecordingV240 = async function(reasonMsg) {
        if (!window._radioStateV91 || !window._radioStateV91.isRecording || window._finalizingRadioRecLockV240) return;
        window._finalizingRadioRecLockV240 = true;
        var st = window._radioStateV91.currentStation || (window._radioStateV91.stations && window._radioStateV91.stations[0]);
        var btn = document.getElementById('btnRadioRecV91');
        var statusEl = document.getElementById('radNowPlayingTitleV91');
        clearInterval(window._radioStateV91.recTimer);
        window._radioStateV91.recTimer = null;
        window._radioStateV91.isRecording = false;
        if (btn) {
            btn.innerText = '⏳ Сохраняем запись...';
            btn.style.background = '#7341be';
        }
        try {
            var r = await (await window.fetch('/api/radio/record_stop', { method: 'POST' })).json();
            if (btn) {
                btn.innerText = (st && !st.lossless) ? '⏺ Сохранить прямой эфир в .MP3 (без пережатия)' : '⏺ Записать эфир в .xFLAC (Lossless)';
                btn.style.background = '#238636';
            }
            if (r && r.status === 'ok') {
                var durLabel = r.duration_sec ? (' • ' + window.fmtRadioRecDurationV240(r.duration_sec)) : '';
                if (statusEl) statusEl.innerText = '✅ Сохранено: ' + r.filename + ' (' + r.size_mb + ' MB' + durLabel + ')';
                if (typeof window.refreshJennyHubSummaryV242 === 'function') window.refreshJennyHubSummaryV242();
                if (typeof window.scheduleCoalescedFetchDataV237 === 'function') window.scheduleCoalescedFetchDataV237(200);
                else if (typeof window.fetchData === 'function') window.fetchData();
                if (typeof window.showToast === 'function') {
                    window.showToast('✅ ' + (reasonMsg ? (reasonMsg + ': ') : 'Записано: ') + r.filename + ' (' + r.size_mb + ' MB' + durLabel + ')');
                }
            } else {
                var errTxt = (r && r.error) || 'Ошибка записи';
                if (statusEl) statusEl.innerText = '❌ ' + errTxt;
                if (typeof window.showToast === 'function') window.showToast('❌ ' + errTxt);
            }
        } catch (e) {
            if (btn) {
                btn.innerText = '⏺ Записать эфир в .xFLAC (Lossless)';
                btn.style.background = '#238636';
            }
        } finally {
            window._finalizingRadioRecLockV240 = false;
        }
    };

    window.stopFlacRadioStreamV91 = function() {
        var wasPlaying = Boolean(window._radioStateV91 && window._radioStateV91.audio && !window._radioStateV91.audio.paused);
        if (window._radioStateV91 && window._radioStateV91.audio) {
            try {
                window._radioStateV91.audio.pause();
                window._radioStateV91.audio.src = '';
            } catch (e) {}
            window._radioStateV91.audio = null;
        }
        document.querySelectorAll('.rad-play-btn-v91').forEach(function(b) { b.innerText = '▶'; });
        if (wasPlaying && window._radioStateV91 && window._radioStateV91.isRecording) {
            window.finalizeActiveRadioRecordingV240('Эфир остановлен, запись сохранена');
        }
    };

    window.toggleRadioRecordToXflacV91 = async function() {
        var st = window._radioStateV91 && (window._radioStateV91.currentStation || (window._radioStateV91.stations && window._radioStateV91.stations[0]));
        var btn = document.getElementById('btnRadioRecV91');
        var statusEl = document.getElementById('radNowPlayingTitleV91');
        if (!window._radioStateV91.isRecording) {
            if (!st) {
                st = { id: 'rp_main', title: 'Radio Paradise — Main Mix', genre: 'Rock', codec: 'FLAC 1411k', lossless: true, url: 'http://stream.radioparadise.com/flacm' };
                window._radioStateV91.currentStation = st;
            }
            if (btn) {
                btn.innerText = '⏳ Подключение к записи эфира...';
                btn.style.background = '#9e6a03';
            }
            try {
                var r = await (await window.fetch('/api/radio/record_start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: st.url,
                        title: st.title,
                        lossless: Boolean(st.lossless),
                        format_mode: window._radioStateV91.formatMode
                    })
                })).json();
                if (r && r.status === 'ok') {
                    window._radioStateV91.isRecording = true;
                    window._radioStateV91._recStartGraceUntilTsV376 = Date.now() + 2500;
                    var targetFmt = st.lossless ? 'xFLAC' : 'прямой MP3';
                    if (btn) {
                        btn.innerText = '⏹ Стоп (' + targetFmt + ' • 00:00 • 0 МБ)';
                        btn.style.background = '#da3633';
                    }
                    clearInterval(window._radioStateV91.recTimer);
                    window._radioStateV91.recTimer = setInterval(async function() {
                        try {
                            var stData = await (await window.fetch('/api/radio/record_status')).json();
                            var curBtn = document.getElementById('btnRadioRecV91');
                            if (stData && stData.active) {
                                if (curBtn) {
                                    curBtn.innerText = '⏹ Стоп (' + targetFmt + ' • ' + window.fmtRadioRecDurationV240(stData.sec) + ' • ' + stData.wav_mb + ' МБ)';
                                    curBtn.style.background = '#da3633';
                                }
                            } else if (window._radioStateV91.isRecording && Date.now() >= (window._radioStateV91._recStartGraceUntilTsV376 || 0)) {
                                window.finalizeActiveRadioRecordingV240('Поток завершён, запись сохранена');
                            }
                        } catch (e) {}
                    }, 600);
                } else {
                    var errMsg = (r && r.error) || 'Не удалось запустить запись';
                    if (btn) {
                        btn.innerText = st.lossless ? '⏺ Записать эфир в .xFLAC (Lossless)' : '⏺ Сохранить прямой эфир в .MP3 (без пережатия)';
                        btn.style.background = '#238636';
                    }
                    if (statusEl) statusEl.innerText = '❌ ' + errMsg;
                    if (typeof window.showToast === 'function') window.showToast('❌ ' + errMsg);
                }
            } catch (eStart) {
                if (btn) {
                    btn.innerText = st.lossless ? '⏺ Записать эфир в .xFLAC (Lossless)' : '⏺ Сохранить прямой эфир в .MP3 (без пережатия)';
                    btn.style.background = '#238636';
                }
                if (statusEl) statusEl.innerText = '❌ Ошибка соединения с сервером записи';
            }
        } else {
            await window.finalizeActiveRadioRecordingV240('');
        }
    };

    // -------------------------------------------------------------------------
    // 3. GAME OST STUDIO — LIVE CLICKABLE "CURRENTLY DOWNLOADING ALBUM" JUMP BANNER
    // -------------------------------------------------------------------------
    window.jumpToDownloadingKhAlbumV240 = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var kh = window._khStateV88;
        if (!kh || !kh.downloadingAlbumData) return;
        kh.currentAlbum = kh.downloadingAlbumData;
        if (typeof window.renderKhAlbumTracksV88 === 'function') {
            window.renderKhAlbumTracksV88(kh.downloadingAlbumData);
        }
        window.refreshKhActiveDownloadBannerV240();
    };

    window.refreshKhActiveDownloadBannerV240 = function() {
        var modal = document.getElementById('jennyKhinsiderModalV88');
        if (!modal) return;
        var kh = window._khStateV88 || {};
        var bar = document.getElementById('khActiveDlJumpBarV240');
        if (!bar) {
            var bodyEl = document.getElementById('khBodyContentV88');
            if (!bodyEl || !bodyEl.parentElement) return;
            bar = document.createElement('div');
            bar.id = 'khActiveDlJumpBarV240';
            bar.onclick = window.jumpToDownloadingKhAlbumV240;
            bar.style.cssText = 'display:none;margin:6px 12px 0 12px;padding:8px 10px;border-radius:9px;background:linear-gradient(90deg,rgba(31,111,235,0.22),rgba(63,185,80,0.22));border:1px solid #3fb950;cursor:pointer;align-items:center;justify-content:space-between;gap:8px;box-shadow:0 2px 10px rgba(0,0,0,0.35);';
            bodyEl.parentElement.insertBefore(bar, bodyEl);
        }

        if (!kh.isDownloading || !kh.downloadingAlbumData) {
            bar.style.display = 'none';
            return;
        }

        var viewingSameAlbum = Boolean(
            kh.currentAlbum && kh.downloadingAlbumData &&
            kh.currentAlbum.album_title === kh.downloadingAlbumData.album_title
        );
        var progStr = (kh.dlQueueIdxV240 && kh.dlQueueTotalV240)
            ? ('[' + kh.dlQueueIdxV240 + '/' + kh.dlQueueTotalV240 + (kh.dlLastPctV240 ? (' • ' + kh.dlLastPctV240 + '%') : '') + ']')
            : '⏳';
        var albName = kh.downloadingAlbumData.album_title || 'Альбом OST';

        bar.style.display = 'flex';
        bar.innerHTML =
            '<div style="min-width:0;flex:1;">' +
                '<div style="color:#3fb950;font-size:11px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📥 Качается: ' + albName + '</div>' +
                '<div style="color:#79c0ff;font-size:10px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + progStr + (kh.dlCurrentTrackTitleV240 ? (' • ' + kh.dlCurrentTrackTitleV240) : '') + '</div>' +
            '</div>' +
            '<span style="flex-shrink:0;padding:4px 8px;border-radius:6px;background:' + (viewingSameAlbum ? 'rgba(63,185,80,0.22)' : '#238636') + ';color:#fff;font-size:10.5px;font-weight:bold;border:1px solid #3fb950;">' +
                (viewingSameAlbum ? 'На экране ✓' : 'Перейти ➔') +
            '</span>';
    };

    window.downloadSelectedKhTracksV88 = async function() {
        var kh = window._khStateV88;
        var alb = kh.currentAlbum || kh.downloadingAlbumData;
        if (!alb || !alb.tracks) return;
        if (kh.isDownloading) {
            kh.abortDownload = true;
            return;
        }
        var selList = alb.tracks.filter(function(t) { return kh.selectedTracks.has(t.index); });
        if (!selList.length) {
            if (typeof window.showToast === 'function') window.showToast('⚠️ Все выбранные треки уже скачаны!');
            return;
        }
        kh.isDownloading = true;
        kh.abortDownload = false;
        kh.downloadingAlbumData = alb;
        kh.dlQueueTotalV240 = selList.length;
        kh.dlQueueIdxV240 = 1;
        kh.dlLastPctV240 = 0;

        var btn = document.getElementById('btnKhDownloadSelV88');
        var stEl = document.getElementById('khDownloadStatusV88');
        if (btn) btn.innerText = '⏹ Остановить очередь';
        window.refreshKhActiveDownloadBannerV240();

        var doneCnt = 0;
        for (var i = 0; i < selList.length; i++) {
            if (kh.abortDownload) break;
            var t = selList[i];
            kh.dlQueueIdxV240 = i + 1;
            kh.dlCurrentTrackTitleV240 = t.title || ('Track #' + t.index);
            window.refreshKhActiveDownloadBannerV240();
            window.startKhProgressPollV89('[' + (i + 1) + '/' + selList.length + ']');
            try {
                var res = await window.fetch('/api/khinsider/download_track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        page_path: t.page_path,
                        album_title: alb.album_title,
                        track_title: t.title,
                        track_num: t.index,
                        format_mode: kh.formatMode
                    })
                });
                var data = await res.json();
                if (res.ok && data && data.status === 'ok') {
                    doneCnt++;
                    window.markKhTrackAsDownloadedUIV89(t, data);
                    if (typeof window.scheduleCoalescedFetchDataV237 === 'function') window.scheduleCoalescedFetchDataV237(350);
                    else if (typeof window.fetchData === 'function') window.fetchData();
                }
            } catch (e) {}
        }
        window.stopKhProgressPollV89();
        kh.isDownloading = false;
        kh.downloadingAlbumData = null;
        kh.dlCurrentTrackTitleV240 = '';
        window.refreshKhActiveDownloadBannerV240();
        if (stEl) stEl.innerText = '✅ Готово! Загружено: ' + doneCnt + ' из ' + selList.length + '.';
        window.updateKhDownloadBtnLabelV88();
        if (typeof window.showToast === 'function') window.showToast('🎉 Загружено в плеер: ' + doneCnt + ' треков!');
    };

    setInterval(function() {
        if (window._khStateV88 && window._khStateV88.isDownloading) {
            var fill = document.getElementById('khProgressBarFillV89');
            if (fill && fill.style && fill.style.width) {
                window._khStateV88.dlLastPctV240 = parseInt(fill.style.width, 10) || 0;
            }
            window.refreshKhActiveDownloadBannerV240();
        }
    }, 900);
})();
/* ================= END JENNY_V240_ISOLATION_RADIO_OST_AND_SMART_VIDEO_PATCH ================= */

/* ================= BEGIN JENNY_V241_ISOLATED_STUDIO_MINI_PLAYERS_PATCH ================= */
/* [split] V241: кусок исходного IIFE (ui_v71.js, строки 33433–33738) → ui_sources.js */
;(function() {
    if (window._jennyV241MiniIsolationInstalled__sources) return;
    window._jennyV241MiniIsolationInstalled__sources = true;
    window._jennyV241MiniIsolationInstalled = true;

    // Helper: hide ALL studio preview mini-players cleanly (including #khMiniPlayerBarV90 so it never stays stuck as a zombie!)
    window.hideAllStudioMiniPlayersV241 = function() {
        var khBar = document.getElementById('khMiniPlayerBarV90');
        if (khBar) khBar.style.display = 'none';
        document.querySelectorAll('.jenny-univ-mini-player-v98').forEach(function(b) {
            b.style.display = 'none';
        });
    };

    // Ensure #khMiniPlayerBarV90 inside Game OST Studio also has its own ✖ close button!
    window.ensureKhMiniCloseBtnV241 = function() {
        var khBar = document.getElementById('khMiniPlayerBarV90');
        if (!khBar) return;
        var row2 = khBar.children && khBar.children[1];
        if (row2 && !khBar.querySelector('.kh-mini-close-v241')) {
            var closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'kh-mini-close-v241';
            closeBtn.title = 'Закрыть предпрослушку';
            closeBtn.onclick = function(e) {
                if (e && e.stopPropagation) e.stopPropagation();
                window.stopAllExternalStreamsV97();
            };
            closeBtn.style.cssText = 'padding:2px 7px;font-size:10px;background:rgba(248,81,73,0.18);border:1px solid #f85149;color:#ff7b72;border-radius:5px;flex-shrink:0;';
            closeBtn.innerText = '✖';
            row2.appendChild(closeBtn);
        }
    };

    // Wrap stopAllExternalStreamsV97 so closing ✖ in SoundCloud / Torrent / OST ALWAYS hides #khMiniPlayerBarV90 too
    var _prevStopAllStreamsV241 = window.stopAllExternalStreamsV97;
    window.stopAllExternalStreamsV97 = function() {
        if (typeof _prevStopAllStreamsV241 === 'function') {
            _prevStopAllStreamsV241.apply(this, arguments);
        }
        window.hideAllStudioMiniPlayersV241();
        document.querySelectorAll('.sc-prev-btn-v241').forEach(function(b) { b.innerText = '▶'; });
    };
    window.stopKhPreviewV88 = window.stopAllExternalStreamsV97;

    // Bind audio ONLY to the single target modal's mini-player (never broadcast SoundCloud into Game OST or Torrent!)
    window.bindAudioToSingleModalMiniPlayerV241 = function(aud, titleText, targetModalId) {
        window.hideAllStudioMiniPlayersV241();

        if (targetModalId === 'jennyKhinsiderModalV88') {
            window.ensureKhMiniCloseBtnV241();
            var khBar = document.getElementById('khMiniPlayerBarV90');
            var tEl = document.getElementById('khMiniTitleV90');
            var curEl = document.getElementById('khMiniCurV90');
            var durEl = document.getElementById('khMiniDurV90');
            var seekEl = document.getElementById('khMiniSeekV90');
            var mpBtn = document.getElementById('khMiniPlayBtnV90');
            if (khBar) khBar.style.display = 'flex';
            if (tEl) tEl.innerText = '🎧 ' + titleText;
            if (mpBtn) mpBtn.innerText = '⏸';

            if (seekEl && !seekEl._dragHookedV241) {
                seekEl._dragHookedV241 = true;
                seekEl.addEventListener('touchstart', function() { window._umpUserDraggingSeekV106 = true; }, { passive: true });
                seekEl.addEventListener('mousedown', function() { window._umpUserDraggingSeekV106 = true; });
                var endKhDrag = function() {
                    if (window._umpUserDraggingSeekV106) {
                        window._umpUserDraggingSeekV106 = false;
                        window.seekKhMiniPlayerV90(seekEl.value);
                    }
                };
                seekEl.addEventListener('touchend', endKhDrag, { passive: true });
                seekEl.addEventListener('mouseup', endKhDrag);
                seekEl.addEventListener('change', endKhDrag);
            }

            aud.ontimeupdate = function() {
                if (window._umpUserDraggingSeekV106) return;
                if (curEl) curEl.innerText = window.fmtKhSecV90(aud.currentTime);
                if (durEl) durEl.innerText = (isFinite(aud.duration) && aud.duration > 0) ? window.fmtKhSecV90(aud.duration) : 'Поток';
                if (seekEl && isFinite(aud.duration) && aud.duration > 0) {
                    seekEl.value = Math.round((aud.currentTime / aud.duration) * 1000);
                }
            };
            return;
        }

        // SoundCloud or Torrent Studio: ensure & show ONLY that specific modal's .jenny-univ-mini-player-v98!
        var anchorBodyId = (targetModalId === 'jennySoundCloudModalV93') ? 'scDedicatedBodyV93' : 'torBodyListV96';
        var bodyEl = document.getElementById(anchorBodyId);
        var bar = null;
        if (bodyEl && bodyEl.previousElementSibling && typeof window.ensureModalMiniPlayerV98 === 'function') {
            bar = window.ensureModalMiniPlayerV98(targetModalId, bodyEl.previousElementSibling);
        } else {
            var m = document.getElementById(targetModalId);
            if (m) bar = m.querySelector('.jenny-univ-mini-player-v98');
        }
        if (!bar) return;

        bar.style.display = 'flex';
        var ut = bar.querySelector('.ump-title');
        if (ut) ut.innerText = '🎧 ' + titleText;
        var pBtn = bar.querySelector('.ump-play-btn');
        if (pBtn) pBtn.innerText = '⏸';

        var sEl = bar.querySelector('.ump-seek');
        if (sEl && !sEl._dragHookedV241) {
            sEl._dragHookedV241 = true;
            sEl.addEventListener('touchstart', function() { window._umpUserDraggingSeekV106 = true; }, { passive: true });
            sEl.addEventListener('mousedown', function() { window._umpUserDraggingSeekV106 = true; });
            var endUmpDrag = function() {
                if (window._umpUserDraggingSeekV106) {
                    window._umpUserDraggingSeekV106 = false;
                    window.seekKhMiniPlayerV90(sEl.value);
                }
            };
            sEl.addEventListener('touchend', endUmpDrag, { passive: true });
            sEl.addEventListener('mouseup', endUmpDrag);
            sEl.addEventListener('change', endUmpDrag);
        }

        aud.ontimeupdate = function() {
            if (window._umpUserDraggingSeekV106) return;
            var curStr = window.fmtKhSecV90(aud.currentTime);
            var durStr = (isFinite(aud.duration) && aud.duration > 0) ? window.fmtKhSecV90(aud.duration) : 'Поток';
            var pct = (isFinite(aud.duration) && aud.duration > 0) ? Math.round((aud.currentTime / aud.duration) * 1000) : 0;
            var cEl = bar.querySelector('.ump-cur');
            var dEl = bar.querySelector('.ump-dur');
            if (cEl) cEl.innerText = curStr;
            if (dEl) dEl.innerText = durStr;
            if (sEl && pct > 0) sEl.value = pct;
        };

        if (typeof window.syncMiniPlayerTorrentBtnVisibilityV108 === 'function') {
            window.syncMiniPlayerTorrentBtnVisibilityV108();
        }
    };

    // Override bindAudioToAllMiniPlayersV98 so any legacy caller (e.g. Torrent preview) ONLY lights up its own modal!
    window.bindAudioToAllMiniPlayersV98 = function(aud, titleText) {
        var pPath = String((aud && aud._pagePath) || '');
        var targetModal = 'jennyKhinsiderModalV88';
        if (pPath.indexOf('/api/torrent/stream/') === 0) {
            targetModal = 'jennyTorrentModalV91';
        } else if (aud && aud._previewOwnerModalV241) {
            targetModal = aud._previewOwnerModalV241;
        }
        window.bindAudioToSingleModalMiniPlayerV241(aud, titleText, targetModal);
    };

    // Dedicated isolated preview for SoundCloud Studio (NEVER touches Game OST #khMiniPlayerBarV90 or _khStateV88.currentAlbum!)
    window.previewScTrackV96 = async function(idx, btnEl, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var t = (window._scDedicatedTracksV96 || []).find(function(x) { return Number(x.index) === Number(idx); });
        if (!t) return;

        var curAud = window._khStateV88 && window._khStateV88.previewAudio;
        if (curAud && curAud._pagePath === t.page_path) {
            if (!curAud.paused) {
                window.stopAllExternalStreamsV97();
            } else {
                if (typeof window.pauseMainPlayerForOstV90 === 'function') window.pauseMainPlayerForOstV90();
                curAud.volume = window.getKhPreviewVolumeV90();
                try {
                    await curAud.play();
                    if (btnEl) btnEl.innerText = '⏹';
                } catch (e) {}
            }
            return;
        }

        window.stopAllExternalStreamsV97();
        if (typeof window.pauseMainPlayerForOstV90 === 'function') window.pauseMainPlayerForOstV90();
        var myReqId = ++window._previewReqIdV97;
        if (btnEl) btnEl.innerText = '⏳';
        window._khStateV88.previewBtn = btnEl;

        try {
            var res = await window.fetch('/api/khinsider/resolve_stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page_path: t.page_path })
            });
            var data = await res.json();
            if (myReqId !== window._previewReqIdV97) return;
            if (!res.ok || !data || !data.stream_url) throw new Error((data && data.error) || 'Нет потока SoundCloud');

            var aud = new Audio(data.stream_url);
            aud._pagePath = t.page_path;
            aud._previewOwnerModalV241 = 'jennySoundCloudModalV93';
            aud.volume = window.getKhPreviewVolumeV90();
            window._khStateV88.previewAudio = aud;

            window.bindAudioToSingleModalMiniPlayerV241(aud, t.index + '. ' + t.title, 'jennySoundCloudModalV93');

            aud.onended = function() {
                if (btnEl) btnEl.innerText = '▶';
                var scModal = document.getElementById('jennySoundCloudModalV93');
                var pBtn = scModal ? scModal.querySelector('.jenny-univ-mini-player-v98 .ump-play-btn') : null;
                if (pBtn) pBtn.innerText = '▶';
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

    // Dedicated isolated preview for Game OST / Archive Studio (strictly inside #khMiniPlayerBarV90 only!)
    window.previewKhTrackV88 = async function(trackIdx, btnEl, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var alb = window._khStateV88 && window._khStateV88.currentAlbum;
        var t = (alb && alb.tracks) ? alb.tracks.find(function(x) { return Number(x.index) === Number(trackIdx); }) : null;
        if (!t) return;

        var curAud = window._khStateV88.previewAudio;
        if (curAud && curAud._pagePath === t.page_path) {
            if (!curAud.paused) {
                window.stopAllExternalStreamsV97();
            } else {
                if (typeof window.pauseMainPlayerForOstV90 === 'function') window.pauseMainPlayerForOstV90();
                curAud.volume = window.getKhPreviewVolumeV90();
                try {
                    await curAud.play();
                    if (btnEl) btnEl.innerText = '⏹';
                    var mpBtn = document.getElementById('khMiniPlayBtnV90');
                    if (mpBtn) mpBtn.innerText = '⏸';
                } catch (e) {}
            }
            return;
        }

        window.stopAllExternalStreamsV97();
        if (typeof window.pauseMainPlayerForOstV90 === 'function') window.pauseMainPlayerForOstV90();
        var myReqId = ++window._previewReqIdV97;
        if (btnEl) btnEl.innerText = '⏳';
        window._khStateV88.previewBtn = btnEl;

        try {
            var res = await window.fetch('/api/khinsider/resolve_stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page_path: t.page_path })
            });
            var data = await res.json();
            if (myReqId !== window._previewReqIdV97) return;
            if (!res.ok || !data || !data.stream_url) throw new Error((data && data.error) || 'Нет потока');

            var aud = new Audio(data.stream_url);
            aud._pagePath = t.page_path;
            aud._previewOwnerModalV241 = 'jennyKhinsiderModalV88';
            aud.volume = window.getKhPreviewVolumeV90();
            window._khStateV88.previewAudio = aud;

            window.bindAudioToSingleModalMiniPlayerV241(aud, t.index + '. ' + t.title, 'jennyKhinsiderModalV88');

            aud.onended = function() {
                if (btnEl) btnEl.innerText = '▶';
                var mpBtn = document.getElementById('khMiniPlayBtnV90');
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

    // Sync Play/Pause button across whichever single mini-player is active
    window.toggleKhMiniPlayPauseV90 = function() {
        var aud = window._khStateV88 && window._khStateV88.previewAudio;
        if (!aud) {
            window.hideAllStudioMiniPlayersV241();
            return;
        }
        if (aud.paused) {
            if (typeof window.pauseMainPlayerForOstV90 === 'function') window.pauseMainPlayerForOstV90();
            aud.play().catch(function() {});
            document.querySelectorAll('#khMiniPlayBtnV90, .jenny-univ-mini-player-v98 .ump-play-btn').forEach(function(b) {
                b.innerText = '⏸';
            });
            if (window._khStateV88.previewBtn) window._khStateV88.previewBtn.innerText = '⏹';
        } else {
            aud.pause();
            document.querySelectorAll('#khMiniPlayBtnV90, .jenny-univ-mini-player-v98 .ump-play-btn').forEach(function(b) {
                b.innerText = '▶';
            });
            if (window._khStateV88.previewBtn) window._khStateV88.previewBtn.innerText = '▶';
        }
    };
})();

/* [split] V242: кусок исходного IIFE (ui_v71.js, строки 33743–34878) → ui_sources.js */
;(function() {
    if (window._jennyV242Installed__sources) return;
    window._jennyV242Installed__sources = true;
    window._jennyV242Installed = true;

    // -------------------------------------------------------------------------
    // 4. 4 MB RAM PRE-BUFFERED LOSSLESS FLAC RADIO STREAMING
    // -------------------------------------------------------------------------
    window.stopFlacRadioStreamV91 = function() {
        var wasPlaying = Boolean(window._radioStateV91 && window._radioStateV91.audio && !window._radioStateV91.audio.paused);
        if (window._radioStateV91 && window._radioStateV91.audio) {
            try {
                window._radioStateV91.audio.pause();
                window._radioStateV91.audio.src = '';
            } catch (e) {}
            window._radioStateV91.audio = null;
        }
        window.fetch('/api/radio/stop_buffered_v242', { method: 'POST' }).catch(function() {});
        document.querySelectorAll('.rad-play-btn-v91').forEach(function(b) { b.innerText = '▶'; });
        if (wasPlaying && window._radioStateV91 && window._radioStateV91.isRecording && typeof window.finalizeActiveRadioRecordingV240 === 'function') {
            window.finalizeActiveRadioRecordingV240('Эфир остановлен, запись сохранена');
        }
    };

    window.playFlacRadioStationV91 = async function(idx, btnEl) {
        var st = window._radioStateV91 && window._radioStateV91.stations[idx];
        if (!st) return;
        if (
            window._radioStateV91.audio &&
            window._radioStateV91.currentStation &&
            window._radioStateV91.currentStation.url === st.url &&
            !window._radioStateV91.audio.paused
        ) {
            window.stopFlacRadioStreamV91();
            window.renderRadioFiltersAndStationsV92();
            return;
        }
        window.stopFlacRadioStreamV91();
        if (typeof window.stopKhPreviewV88 === 'function') window.stopKhPreviewV88();
        if (typeof window.pauseMainPlayerForOstV90 === 'function') window.pauseMainPlayerForOstV90();

        window._radioStateV91.currentStation = st;
        if (btnEl) btnEl.innerText = '⏳';
        var infoEl = document.getElementById('radNowPlayingTitleV91');
        if (infoEl) {
            infoEl.innerHTML = '⏳ ⚡ Подключение к радиоэфиру...: <b>' + st.title + '</b>...';
        }
        var recBtn = document.getElementById('btnRadioRecV91');
        if (recBtn && !window._radioStateV91.isRecording) {
            recBtn.innerText = st.lossless ? '⏺ Записать эфир в .xFLAC (Lossless)' : '⏺ Сохранить прямой эфир в .MP3 (без пережатия)';
        }

        // Route through 4 MB RAM anti-lag prebuffer engine on :8083!
        var bufStreamUrl = '/api/radio/buffered_stream_v242?url=' + encodeURIComponent(st.url) + '&lossless=' + (st.lossless ? '1' : '0') + '&_ts=' + Date.now();
        var aud = new Audio(bufStreamUrl);
        aud.preload = 'auto';
        aud.volume = (typeof window.getKhPreviewVolumeV90 === 'function') ? window.getKhPreviewVolumeV90() : 0.7;
        window._radioStateV91.audio = aud;

        try {
            await aud.play();
            if (infoEl) {
                var bSvg = st.lossless ? window.JENNY_NEON_SVGS_V92.badgeHigh : window.JENNY_NEON_SVGS_V92.badgeLow;
                infoEl.innerHTML = bSvg + ' В эфире: ' + st.title;
            }
            window.renderRadioFiltersAndStationsV92();
        } catch (errBuf) {
            // Seamless fallback to direct URL if upstream blocks FFmpeg User-Agent
            try {
                var audDirect = new Audio(st.url);
                audDirect.volume = aud.volume;
                window._radioStateV91.audio = audDirect;
                await audDirect.play();
                if (infoEl) {
                    var bSvg2 = st.lossless ? window.JENNY_NEON_SVGS_V92.badgeHigh : window.JENNY_NEON_SVGS_V92.badgeLow;
                    infoEl.innerHTML = bSvg2 + ' В эфире: ' + st.title;
                }
                window.renderRadioFiltersAndStationsV92();
            } catch (e2) {
                if (btnEl) btnEl.innerText = '▶';
                if (infoEl) infoEl.innerText = '❌ Поток недоступен: ' + st.title;
            }
        }
    };

    // -------------------------------------------------------------------------
    // 5. PERSISTENT /storage/emulated/0/JENNY STUDIO DOWNLOAD CENTERS & CLEAN HEADERS
    //    - SoundCloud:  ☁️ SOUNDCLOUD   + [📥 Закачки (N)]
    //    - Game OST:    🎮 GAME OST     + [📥 Закачки (N)]
    //    - Archive.org: 🏛️ ARCHIVE.ORG  + [📥 Скачанные (N)] (100% isolated from OST!)
    //    - Radio:       📻 РАДИОЭФИР    + [🎙️ Записанные эфиры (N)]
    //    - YouTube:     ▶️ YOUTUBE      + [📥 Закачки (N)]
    // -------------------------------------------------------------------------
    window._jennyHubCountsV242 = { soundcloud: 0, ost: 0, archive: 0, radio: 0, youtube: 0 };
    window._jennyHubQueuesV242 = { ost: 0, archive: 0 };

    // Clean source catalog names (Archive -> Archive.org, concise studio titles)
    if (Array.isArray(window.SOURCES_CATALOG_V91)) {
        window.SOURCES_CATALOG_V91.forEach(function(s) {
            if (s.id === 'ost') s.title = 'Game OST (Lossless ➔ xFLAC)';
            else if (s.id === 'archive') s.title = 'Archive.org (Lossless Архивы)';
            else if (s.id === 'radio') s.title = 'Радиоэфир (FLAC / MP3)';
            else if (s.id === 'soundcloud') s.title = 'SoundCloud';
            else if (s.id === 'youtube') s.title = 'YouTube';
            else if (s.id === 'torrent') s.title = 'Торрент (P2P / Magnet)';
        });
    }

    window.refreshJennyHubSummaryV242 = async function() {
        try {
            var res = await window.fetch('/api/jenny_hub/summary');
            if (!res.ok) return;
            var d = await res.json();
            if (d && d.status === 'ok') {
                window._jennyHubCountsV242 = Object.assign(window._jennyHubCountsV242, d.counts || {});
                window._jennyHubQueuesV242 = Object.assign(window._jennyHubQueuesV242, d.queues || {});
                window.updateAllStudioHeaderPillsV242();
            }
        } catch (e) {}
    };

    window.formatHubDateBucketV242 = function(tsSec) {
        if (!tsSec) return 'Ранее';
        var now = new Date();
        var startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
        if (tsSec >= startToday) return 'Сегодня';
        if (tsSec >= startToday - 86400) return 'Вчера';
        if (tsSec >= startToday - 7 * 86400) return 'На этой неделе';
        return 'Ранее';
    };

    window.playHubHistoryItemV242 = function(filename, isVideo, modalId) {
        if (!filename) return;
        var m = document.getElementById(modalId);
        if (m) m.style.setProperty('display', 'none', 'important');
        if (isVideo && typeof window.openJennyVideoPlayerV130 === 'function') {
            window.openJennyVideoPlayerV130('/api/media/' + encodeURIComponent(filename), filename, {});
        } else if (typeof window.playTrack === 'function') {
            window.playTrack(filename, 'main');
        }
    };

    window.removeHubHistoryItemV242 = async function(modKey, filename, modalId, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        try {
            await window.fetch('/api/jenny_hub/delete_item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ module: modKey, filename: filename, delete_file: false })
            });
            await window.refreshJennyHubSummaryV242();
            window.openStudioHistoryDrawerV242(modKey, modalId, true);
        } catch (e) {}
    };

    window.resumeSavedKhQueueV242 = async function(modKey) {
        try {
            var res = await window.fetch('/api/jenny_hub/history/' + modKey);
            var d = await res.json();
            var q = d && d.queue;
            if (!q || !Array.isArray(q.pending_tracks) || !q.pending_tracks.length) return;

            var drawer = document.getElementById('studioHistoryDrawer_jennyKhinsiderModalV88');
            if (drawer) drawer.style.display = 'none';

            var kh = window._khStateV88;
            kh.currentSourceMode = modKey;
            window.applyKhModalModeThemeV95(modKey);
            var fakeAlb = {
                album_title: q.album_title || (modKey === 'archive' ? 'Archive.org' : 'Game OST'),
                tracks: q.pending_tracks
            };
            kh.currentAlbum = fakeAlb;
            kh.selectedTracks = new Set(q.pending_tracks.map(function(t) { return t.index; }));
            if (q.format_mode) kh.formatMode = q.format_mode;
            if (typeof window.renderKhAlbumTracksV88 === 'function') {
                window.renderKhAlbumTracksV88();
            }
            window.downloadSelectedKhTracksV88();
        } catch (e) {}
    };

    window.openStudioHistoryDrawerV242 = async function(modKey, modalId, forceRefreshOnly) {
        var modal = document.getElementById(modalId);
        if (!modal) return;
        var card = modal.querySelector('.jenny-modal-card-v71') || modal.firstElementChild;
        if (!card) return;

        var drawerId = 'studioHistoryDrawer_' + modalId;
        var drawer = document.getElementById(drawerId);
        if (!drawer) {
            drawer = document.createElement('div');
            drawer.id = drawerId;
            drawer.style.cssText = 'display:none;flex-direction:column;flex:1;overflow-y:auto;padding:10px 12px;background:#070a10;border-top:1px solid #30363d;gap:8px;min-height:240px;';
            card.appendChild(drawer);
        }

        // Toggle visibility unless forceRefreshOnly
        var mainSections = Array.from(card.children).filter(function(el) {
            return el !== drawer && !el.classList.contains('jenny-modal-hdr-v71');
        });

        if (!forceRefreshOnly && drawer.style.display === 'flex' && drawer.getAttribute('data-mod') === modKey) {
            drawer.style.display = 'none';
            mainSections.forEach(function(el) {
                if (el._savedDispV242 !== undefined) {
                    el.style.display = el._savedDispV242;
                    delete el._savedDispV242;
                }
            });
            return;
        }

        if (drawer.style.display !== 'flex') {
            mainSections.forEach(function(el) {
                el._savedDispV242 = el.style.display;
                el.style.display = 'none';
            });
            drawer.style.display = 'flex';
        }
        drawer.setAttribute('data-mod', modKey);
        drawer.innerHTML = '<div style="color:#58a6ff;text-align:center;padding:24px;font-weight:bold;">⏳ Чтение истории из /JENNY/...</div>';

        try {
            var res = await window.fetch('/api/jenny_hub/history/' + modKey);
            var d = await res.json();
            var items = (d && d.items) || [];
            var q = (d && d.queue) || {};
            window._jennyHubCountsV242[modKey] = items.length;
            window._jennyHubQueuesV242[modKey] = Array.isArray(q.pending_tracks) ? q.pending_tracks.length : 0;
            window.updateAllStudioHeaderPillsV242();

            var hdrTitleMap = {
                soundcloud: '☁️ Закачки SoundCloud',
                ost: '🎮 Закачки Game OST',
                archive: '🏛️ Скачанные из Archive.org',
                radio: '🎙️ Записанные радиоэфиры',
                youtube: '▶️ Закачки YouTube'
            };

            var html = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:6px;border-bottom:1px solid #21262d;">' +
                '<div style="min-width:0;">' +
                    '<div style="color:#e6edf3;font-size:12.5px;font-weight:900;">' + (hdrTitleMap[modKey] || 'История') + ' (' + items.length + ')</div>' +
                    '<div style="color:#8b949e;font-size:9.5px;font-family:monospace;overflow-wrap:anywhere;">📁 ' + ((d && d.folder) || ('/storage/emulated/0/JENNY/' + modKey)) + '</div>' +
                '</div>' +
                '<button type="button" onclick="window.openStudioHistoryDrawerV242(\'' + modKey + '\', \'' + modalId + '\', false)" style="padding:5px 10px;font-size:11px;font-weight:bold;background:#161b22;color:#58a6ff;border:1px solid #30363d;border-radius:7px;flex-shrink:0;">⬅ К поиску</button>' +
            '</div>';

            if (Array.isArray(q.pending_tracks) && q.pending_tracks.length > 0 && (modKey === 'ost' || modKey === 'archive')) {
                var safeAlbQ = String(q.album_title || 'Альбом').replace(/</g, '&lt;');
                html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:rgba(63,185,80,0.14);border:1px solid #3fb950;border-radius:9px;">' +
                    '<div style="min-width:0;flex:1;">' +
                        '<div style="color:#3fb950;font-size:11px;font-weight:900;">⏸ Недокачанная очередь: ' + safeAlbQ + '</div>' +
                        '<div style="color:#c9d1d9;font-size:10px;">Осталось треков: <b>' + q.pending_tracks.length + '</b></div>' +
                    '</div>' +
                    '<button type="button" onclick="window.resumeSavedKhQueueV242(\'' + modKey + '\')" style="padding:5px 9px;font-size:10.5px;font-weight:bold;background:#238636;color:#fff;border:none;border-radius:6px;">▶ Докачать</button>' +
                    '<button type="button" onclick="window.clearSavedModuleQueueV242(\'' + modKey + '\', \'' + modalId + '\', event)" style="padding:5px 7px;font-size:10.5px;background:#21262d;color:#ff7b72;border:1px solid #30363d;border-radius:6px;">✕</button>' +
                '</div>';
            }

            if (!items.length) {
                html += '<div style="color:#8b949e;text-align:center;padding:28px 10px;font-size:12px;">Список пока пуст.<br><span style="font-size:10.5px;">Все скачанные файлы и записи сохраняются в память устройства (/JENNY/) и остаются даже после переустановки приложения.</span></div>';
            } else {
                var groupsOrder = ['Сегодня', 'Вчера', 'На этой неделе', 'Ранее'];
                var grouped = { 'Сегодня': [], 'Вчера': [], 'На этой неделе': [], 'Ранее': [] };
                items.forEach(function(it) {
                    grouped[window.formatHubDateBucketV242(it.ts)].push(it);
                });
                groupsOrder.forEach(function(gName) {
                    var arr = grouped[gName];
                    if (!arr || !arr.length) return;
                    html += '<div style="color:#58a6ff;font-size:10.5px;font-weight:900;margin-top:4px;letter-spacing:0.4px;">' + gName.toUpperCase() + ' (' + arr.length + ')</div>';
                    arr.forEach(function(it) {
                        var safeFnJs = String(it.filename || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                        var safeTitle = String(it.title || it.filename || '').replace(/</g, '&lt;');
                        var safeSub = String(it.subtitle || '').replace(/</g, '&lt;');
                        var szTxt = it.size_mb ? (it.size_mb + ' МБ') : '';
                        var stBadge = it.exists
                            ? '<span style="color:#3fb950;">✅ На диске</span>'
                            : '<span style="color:#e3b341;">⚠️ Удалён с диска</span>';
                        html += '<div style="display:flex;align-items:center;gap:7px;padding:7px 9px;background:#0d1117;border:1px solid #262c36;border-radius:8px;">' +
                            '<div style="flex:1;min-width:0;">' +
                                '<div style="color:#e6edf3;font-size:11.5px;font-weight:bold;line-height:1.3;overflow-wrap:anywhere;">' + safeTitle + '</div>' +
                                '<div style="color:#8b949e;font-size:10px;margin-top:2px;">' +
                                    (safeSub ? (safeSub + ' • ') : '') +
                                    (szTxt ? (szTxt + ' • ') : '') +
                                    stBadge +
                                '</div>' +
                            '</div>' +
                            (it.exists
                                ? '<button type="button" onclick="window.playHubHistoryItemV242(\'' + safeFnJs + '\', ' + Boolean(it.is_video) + ', \'' + modalId + '\')" style="padding:5px 9px;font-size:11px;font-weight:bold;background:rgba(63,185,80,0.18);color:#3fb950;border:1px solid #3fb950;border-radius:6px;flex-shrink:0;" title="Включить в плеере">▶</button>'
                                : '') +
                            '<button type="button" onclick="window.removeHubHistoryItemV242(\'' + modKey + '\', \'' + safeFnJs + '\', \'' + modalId + '\', event)" style="padding:5px 7px;font-size:10px;background:#161b22;color:#8b949e;border:1px solid #30363d;border-radius:6px;flex-shrink:0;" title="Убрать из списка">✕</button>' +
                        '</div>';
                    });
                });
            }
            drawer.innerHTML = html;
        } catch (e) {
            drawer.innerHTML = '<div style="color:#ff7b72;text-align:center;padding:20px;">❌ Ошибка чтения истории: ' + (e.message || e) + '</div>';
        }
    };

    // Mount / update concise titles & header pills across all 5 non-torrent studios!
    window.mountSoundCloudHeaderV242 = function() {
        var m = document.getElementById('jennySoundCloudModalV93');
        if (!m) return;
        var hdr = m.querySelector('.jenny-modal-hdr-v71');
        if (!hdr) return;
        var cnt = window._jennyHubCountsV242.soundcloud || 0;
        hdr.style.gap = '6px';
        hdr.innerHTML =
            '<div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">' +
                '<span style="color:#ff8c42;font-weight:900;font-size:12.5px;display:inline-flex;align-items:center;gap:5px;flex-shrink:0;">' +
                    window.JENNY_NEON_SVGS_V92.soundcloud + '<span>SOUNDCLOUD</span>' +
                '</span>' +
                '<button type="button" id="btnScHubPillV242" class="jenny-studio-dl-pill-v242" onclick="window.openStudioHistoryDrawerV242(\'soundcloud\', \'jennySoundCloudModalV93\', false)" style="background:rgba(255,140,66,0.18);border:1px solid #ff8c42;color:#ffb380;">' +
                    '📥 Закачки (' + cnt + ')' +
                '</button>' +
            '</div>' +
            '<div style="display:flex;gap:4px;flex-shrink:0;">' +
                '<button type="button" onclick="window.openScAuthBoxV93()" style="padding:4px 7px;font-size:10.5px;border-radius:7px;background:rgba(255,140,66,0.16);border:1px solid #ff8c42;color:#ff8c42;font-weight:bold;" title="Куки / Вход">🔑</button>' +
                '<button type="button" onclick="document.getElementById(\'jennySoundCloudModalV93\').style.setProperty(\'display\',\'none\',\'important\')" style="padding:4px 9px;font-size:11px;border-radius:7px;background:rgba(88,166,255,0.18);border:1px solid #58a6ff;color:#58a6ff;font-weight:bold;">➖ В фон</button>' +
            '</div>';
    };

    window.mountRadioHeaderV242 = function() {
        var m = document.getElementById('jennyFlacRadioModalV91');
        if (!m) return;
        var hdr = m.querySelector('.jenny-modal-hdr-v71');
        if (!hdr) return;
        var cnt = window._jennyHubCountsV242.radio || 0;
        hdr.style.gap = '6px';
        hdr.innerHTML =
            '<div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">' +
                '<span style="color:#58a6ff;font-weight:900;font-size:12.5px;display:inline-flex;align-items:center;gap:5px;flex-shrink:0;">' +
                    window.JENNY_NEON_SVGS_V92.radio + '<span>РАДИОЭФИР</span>' +
                '</span>' +
                '<button type="button" id="btnRadioHubPillV242" class="jenny-studio-dl-pill-v242" onclick="window.openStudioHistoryDrawerV242(\'radio\', \'jennyFlacRadioModalV91\', false)" style="background:rgba(63,185,80,0.18);border:1px solid #3fb950;color:#7ee787;">' +
                    '🎙️ Записанные эфиры (' + cnt + ')' +
                '</button>' +
            '</div>' +
            '<button type="button" onclick="window.minimizeFlacRadioModalV91()" style="padding:4px 9px;font-size:11px;border-radius:7px;background:rgba(88,166,255,0.18);border:1px solid #58a6ff;color:#58a6ff;font-weight:bold;flex-shrink:0;">➖ В фон</button>';
    };

    window.mountYoutubeHeaderV242 = function() {
        var m = document.getElementById('jennyYoutubeModalV230');
        if (!m) return;
        var hdr = m.querySelector('.jenny-modal-hdr-v71');
        if (!hdr) return;
        var cnt = window._jennyHubCountsV242.youtube || 0;
        hdr.style.gap = '6px';
        hdr.innerHTML =
            '<div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">' +
                '<span style="color:#ff7b72;font-weight:900;font-size:12.5px;display:inline-flex;align-items:center;gap:5px;flex-shrink:0;">' +
                    window.JENNY_NEON_SVGS_V92.youtube + '<span>YOUTUBE</span>' +
                '</span>' +
                '<button type="button" id="btnYtHubPillV242" class="jenny-studio-dl-pill-v242" onclick="window.openStudioHistoryDrawerV242(\'youtube\', \'jennyYoutubeModalV230\', false)" style="background:rgba(255,123,114,0.18);border:1px solid #ff7b72;color:#ffa198;">' +
                    '📥 Закачки (' + cnt + ')' +
                '</button>' +
            '</div>' +
            '<button type="button" onclick="document.getElementById(\'jennyYoutubeModalV230\').style.setProperty(\'display\',\'none\',\'important\')" style="padding:4px 9px;font-size:11px;border-radius:7px;background:rgba(88,166,255,0.18);border:1px solid #58a6ff;color:#58a6ff;font-weight:bold;flex-shrink:0;">➖ В фон</button>';
    };

    // Separate headers & separate pill counters for GAME OST vs ARCHIVE.ORG!
    window.applyKhModalModeThemeV95 = function(mode) {
        var cleanMode = (mode === 'archive') ? 'archive' : 'ost';
        window._khStateV88.currentSourceMode = cleanMode;
        var m = document.getElementById('jennyKhinsiderModalV88');
        if (!m) return;

        // Close history drawer if open for the other mode so OST & Archive NEVER mix visually!
        var dr = document.getElementById('studioHistoryDrawer_jennyKhinsiderModalV88');
        if (dr && dr.style.display === 'flex' && dr.getAttribute('data-mod') !== cleanMode) {
            window.openStudioHistoryDrawerV242(dr.getAttribute('data-mod'), 'jennyKhinsiderModalV88', false);
        }

        var hdr = m.querySelector('.jenny-modal-hdr-v71');
        var inp = document.getElementById('khSearchInpV88');
        var firstRowWithChips = m.querySelector('div[style*="overflow-x:auto"]');
        if (firstRowWithChips && !firstRowWithChips.id) {
            firstRowWithChips.id = 'khQuickChipsBarV95';
        }

        if (cleanMode === 'archive') {
            var cntArch = window._jennyHubCountsV242.archive || 0;
            var qArch = window._jennyHubQueuesV242.archive || 0;
            var pillArchTxt = '📥 Скачанные (' + cntArch + (qArch > 0 ? (' • ⏳' + qArch) : '') + ')';
            if (hdr) {
                hdr.style.gap = '6px';
                hdr.style.background = 'linear-gradient(90deg, rgba(121,192,255,0.24), rgba(163,113,247,0.24))';
                hdr.innerHTML =
                    '<div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">' +
                        '<span style="color:#79c0ff;font-weight:900;font-size:12.5px;display:inline-flex;align-items:center;gap:5px;flex-shrink:0;">' +
                            window.JENNY_NEON_SVGS_V92.archive + '<span>ARCHIVE.ORG</span>' +
                        '</span>' +
                        '<button type="button" id="btnKhArchiveHubPillV242" class="jenny-studio-dl-pill-v242" onclick="window.openStudioHistoryDrawerV242(\'archive\', \'jennyKhinsiderModalV88\', false)" style="background:rgba(121,192,255,0.18);border:1px solid #79c0ff;color:#a5d6ff;">' +
                            pillArchTxt +
                        '</button>' +
                    '</div>' +
                    '<button type="button" onclick="window.minimizeKhinsiderModalV88()" style="padding:4px 9px;font-size:11px;border-radius:7px;background:rgba(88,166,255,0.18);border:1px solid #58a6ff;color:#58a6ff;font-weight:bold;flex-shrink:0;">➖ В фон</button>';
            }
            if (inp) inp.placeholder = 'Archive.org: артист, альбом, концерт, винил-рип...';
        } else {
            var cntOst = window._jennyHubCountsV242.ost || 0;
            var qOst = window._jennyHubQueuesV242.ost || 0;
            var pillOstTxt = '📥 Закачки (' + cntOst + (qOst > 0 ? (' • ⏳' + qOst) : '') + ')';
            if (hdr) {
                hdr.style.gap = '6px';
                hdr.style.background = 'linear-gradient(90deg, rgba(63,185,80,0.22), rgba(115,65,190,0.25))';
                hdr.innerHTML =
                    '<div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">' +
                        '<span style="color:#3fb950;font-weight:900;font-size:12.5px;display:inline-flex;align-items:center;gap:5px;flex-shrink:0;">' +
                            window.JENNY_NEON_SVGS_V92.ost + '<span>GAME OST</span>' +
                        '</span>' +
                        '<button type="button" id="btnKhOstHubPillV242" class="jenny-studio-dl-pill-v242" onclick="window.openStudioHistoryDrawerV242(\'ost\', \'jennyKhinsiderModalV88\', false)" style="background:rgba(63,185,80,0.18);border:1px solid #3fb950;color:#7ee787;">' +
                            pillOstTxt +
                        '</button>' +
                    '</div>' +
                    '<button type="button" onclick="window.minimizeKhinsiderModalV88()" style="padding:4px 9px;font-size:11px;border-radius:7px;background:rgba(88,166,255,0.18);border:1px solid #58a6ff;color:#58a6ff;font-weight:bold;flex-shrink:0;">➖ В фон</button>';
            }
            if (inp) inp.placeholder = 'Игра (Gothic, Fallout, Silent Hill, Witcher...)';
        }
        if (typeof window.renderKhQuickChipsStripV95 === 'function') {
            window.renderKhQuickChipsStripV95();
        }
        if (typeof window.refreshKhActiveDownloadBannerV240 === 'function') {
            window.refreshKhActiveDownloadBannerV240();
        }
    };

    // Ensure active OST download banner ONLY shows in the matching mode ('ost' vs 'archive')!
    var _prevRefreshKhBannerV242 = window.refreshKhActiveDownloadBannerV240;
    window.refreshKhActiveDownloadBannerV240 = function() {
        var kh = window._khStateV88 || {};
        if (kh.isDownloading && kh.downloadingSourceModeV242 && kh.currentSourceMode !== kh.downloadingSourceModeV242) {
            var bar = document.getElementById('khActiveDlJumpBarV240');
            if (bar) bar.style.display = 'none';
            return;
        }
        if (typeof _prevRefreshKhBannerV242 === 'function') {
            return _prevRefreshKhBannerV242.apply(this, arguments);
        }
    };

    // Hook modal openers so headers + pills mount immediately and refresh counts
    var _origOpenScV242 = window.openSoundCloudModalV92;
    window.openSoundCloudModalV92 = function() {
        var r = _origOpenScV242 ? _origOpenScV242.apply(this, arguments) : undefined;
        window.mountSoundCloudHeaderV242();
        window.refreshJennyHubSummaryV242();
        return r;
    };

    var _origOpenRadioV242 = window.openFlacRadioModalV91;
    window.openFlacRadioModalV91 = function() {
        var r = _origOpenRadioV242 ? _origOpenRadioV242.apply(this, arguments) : undefined;
        window.mountRadioHeaderV242();
        window.refreshJennyHubSummaryV242();
        return r;
    };

    var _origOpenYtV242 = window.openYoutubeStudioModalV230;
    window.openYoutubeStudioModalV230 = function() {
        var r = _origOpenYtV242 ? _origOpenYtV242.apply(this, arguments) : undefined;
        window.mountYoutubeHeaderV242();
        window.refreshJennyHubSummaryV242();
        return r;
    };

    var _origOpenKhV242 = window.openKhinsiderModalV88;
    window.openKhinsiderModalV88 = function() {
        var r = _origOpenKhV242 ? _origOpenKhV242.apply(this, arguments) : undefined;
        window.refreshJennyHubSummaryV242();
        return r;
    };

    // Upgrade OST / Archive single & batch downloads to pass source_mode ('ost' vs 'archive')
    // and persist unfinished queues to /storage/emulated/0/JENNY/<OST|Archive>/queue.json!
    window.downloadSingleKhTrackV88 = async function(trackIdx, btnEl, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var kh = window._khStateV88;
        var alb = kh.currentAlbum;
        var t = (alb && alb.tracks) ? alb.tracks.find(function(x) { return x.index === trackIdx; }) : null;
        if (!t) return;
        var srcMode = (kh.currentSourceMode === 'archive') ? 'archive' : 'ost';
        if (t.downloaded && !confirm('Трек «' + t.title + '» уже скачан (' + t.local_file + '). Перекачать заново?')) return;
        var oldTxt = btnEl ? btnEl.innerText : '⬇️';
        if (btnEl) btnEl.innerText = '⏳';
        window.startKhProgressPollV89('[' + t.index + '. ' + t.title + ']');
        try {
            var res = await window.fetch('/api/khinsider/download_track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    page_path: t.page_path,
                    album_title: alb.album_title,
                    track_title: t.title,
                    track_num: t.index,
                    format_mode: kh.formatMode,
                    source_mode: srcMode
                })
            });
            var data = await res.json();
            window.stopKhProgressPollV89();
            if (!res.ok || data.status !== 'ok') throw new Error(data.error || 'Ошибка скачивания');
            window.markKhTrackAsDownloadedUIV89(t, data);
            var stEl = document.getElementById('khDownloadStatusV88');
            var barFill = document.getElementById('khProgressBarFillV89');
            if (barFill) barFill.style.width = '100%';
            if (stEl) stEl.innerText = '✅ Сохранено: ' + data.filename + ' (' + data.size_mb + ' MB)';
            if (typeof window.scheduleCoalescedFetchDataV237 === 'function') window.scheduleCoalescedFetchDataV237(350);
            window.refreshJennyHubSummaryV242();
            if (typeof window.showToast === 'function') window.showToast('✅ Скачано: ' + data.filename + ' (' + data.size_mb + ' MB)');
        } catch (e) {
            window.stopKhProgressPollV89();
            if (btnEl) btnEl.innerText = oldTxt;
            if (typeof window.showToast === 'function') window.showToast('❌ ' + (e.message || e));
        }
    };

    window.downloadSelectedKhTracksV88 = async function() {
        var kh = window._khStateV88;
        var alb = kh.currentAlbum || kh.downloadingAlbumData;
        if (!alb || !alb.tracks) return;
        if (kh.isDownloading) {
            kh.abortDownload = true;
            return;
        }
        var selList = alb.tracks.filter(function(t) { return kh.selectedTracks.has(t.index); });
        if (!selList.length) {
            if (typeof window.showToast === 'function') window.showToast('⚠️ Все выбранные треки уже скачаны!');
            return;
        }
        var srcMode = (kh.currentSourceMode === 'archive') ? 'archive' : 'ost';
        kh.isDownloading = true;
        kh.abortDownload = false;
        kh.downloadingSourceModeV242 = srcMode;
        kh.downloadingAlbumData = alb;
        kh.dlQueueTotalV240 = selList.length;
        kh.dlQueueIdxV240 = 0;

        var saveRemainingQueue = function(startIndex) {
            var rem = selList.slice(startIndex);
            window.fetch('/api/jenny_hub/queue/' + srcMode, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rem.length ? {
                    album_title: alb.album_title,
                    format_mode: kh.formatMode,
                    pending_tracks: rem
                } : { clear: true })
            }).catch(function() {});
        };
        saveRemainingQueue(0);

        var btn = document.getElementById('btnKhDownloadSelV88');
        var stEl = document.getElementById('khDownloadStatusV88');
        if (btn) btn.innerText = '⏹ Остановить очередь';
        window.refreshKhActiveDownloadBannerV240();

        var doneCnt = 0;
        for (var i = 0; i < selList.length; i++) {
            if (kh.abortDownload) {
                saveRemainingQueue(i);
                break;
            }
            var t = selList[i];
            kh.dlQueueIdxV240 = i + 1;
            kh.dlCurrentTrackTitleV240 = t.title || ('Track #' + t.index);
            window.refreshKhActiveDownloadBannerV240();
            window.startKhProgressPollV89('[' + (i + 1) + '/' + selList.length + ']');
            try {
                var res = await window.fetch('/api/khinsider/download_track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        page_path: t.page_path,
                        album_title: alb.album_title,
                        track_title: t.title,
                        track_num: t.index,
                        format_mode: kh.formatMode,
                        source_mode: srcMode
                    })
                });
                var data = await res.json();
                if (res.ok && data && data.status === 'ok') {
                    doneCnt++;
                    window.markKhTrackAsDownloadedUIV89(t, data);
                    saveRemainingQueue(i + 1);
                    window.refreshJennyHubSummaryV242();
                    if (typeof window.scheduleCoalescedFetchDataV237 === 'function') window.scheduleCoalescedFetchDataV237(350);
                }
            } catch (e) {}
        }

        window.stopKhProgressPollV89();
        kh.isDownloading = false;
        kh.downloadingAlbumData = null;
        kh.dlCurrentTrackTitleV240 = '';
        window.refreshKhActiveDownloadBannerV240();
        window.refreshJennyHubSummaryV242();
        if (stEl) stEl.innerText = '✅ Готово! Загружено: ' + doneCnt + ' из ' + selList.length + '.';
        window.updateKhDownloadBtnLabelV88();
        if (typeof window.showToast === 'function') window.showToast('🎉 Загружено в плеер: ' + doneCnt + ' треков!');
    };

    // Refresh hub pill counts automatically after SoundCloud, Radio, or YouTube completes
    var _origDlScV242 = window.downloadScTrackV96;
    if (typeof _origDlScV242 === 'function') {
        window.downloadScTrackV96 = async function() {
            var r = await _origDlScV242.apply(this, arguments);
            window.refreshJennyHubSummaryV242();
            return r;
        };
    }
    var _origRecRadV242 = window.toggleRadioRecordToXflacV91;
    if (typeof _origRecRadV242 === 'function') {
        window.toggleRadioRecordToXflacV91 = async function() {
            var r = await _origRecRadV242.apply(this, arguments);
            window.refreshJennyHubSummaryV242();
            return r;
        };
    }
})();

/* [split] V243: кусок исходного IIFE (ui_v71.js, строки 35225–35944) → ui_sources.js */
;(function() {
    if (window._jennyV243Installed__sources) return;
    window._jennyV243Installed__sources = true;
    window._jennyV243Installed = true;
    window._lastActiveMediaSourceV243 = 'deckA'; // 'deckA' | 'deckB' | 'radio' | 'external'
    window._lastRadioAudioElV243 = null;
    window._lastExternalAudioElV243 = null;
    window._lastRadioTitleV243 = '';
    window._lastExternalTitleV243 = '';

    window.fixRadioModalHeaderLayoutV243 = function() {
        var rm = document.getElementById('jennyFlacRadioModalV91');
        if (!rm) return;
        var hdr = rm.querySelector('.jenny-modal-hdr-v71');
        if (!hdr) return;
        Array.from(hdr.children).forEach(function(ch) {
            if (ch.tagName !== 'BUTTON' && !ch.querySelector('button')) {
                ch.style.minWidth = '0';
                ch.style.flex = '1 1 auto';
            } else if (ch.querySelector && ch.querySelector('button')) {
                ch.style.display = 'flex';
                ch.style.alignItems = 'center';
                ch.style.gap = '6px';
                ch.style.flexWrap = 'nowrap';
                ch.style.marginLeft = 'auto';
            }
        });
    };

    window.resolveCurrentRadioTitleV243 = function() {
        var rs = window._radioStateV91 || {};
        if (rs.currentStation) {
            var nm = rs.currentStation.name || rs.currentStation.title || rs.currentStation.station || '';
            if (nm) {
                window._lastRadioTitleV243 = String(nm).trim();
                return window._lastRadioTitleV243;
            }
        }
        var rm = document.getElementById('jennyFlacRadioModalV91');
        if (rm) {
            var sub = rm.querySelector('[id*="Status"], [id*="Title"], [id*="Now"]');
            if (sub && sub.textContent && sub.textContent.trim().length > 2) {
                var clean = sub.textContent.replace(/Предбуферизация[^•\n]*/gi, '').trim();
                if (clean) window._lastRadioTitleV243 = clean.slice(0, 65);
            }
        }
        return window._lastRadioTitleV243 || 'Радиостанция';
    };

    var _origStopRadioV243 = window.stopFlacRadioStreamV91;
    if (typeof _origStopRadioV243 === 'function' && !_origStopRadioV243._v243Wrapped) {
        window.stopFlacRadioStreamV91 = function() {
            var oldAud = (window._radioStateV91 && window._radioStateV91.audio) || window._lastRadioAudioElV243;
            var r = _origStopRadioV243.apply(this, arguments);
            if (oldAud) window.releaseDetachedAudioSocketV243(oldAud);
            fetch('/api/radio/abort_stale_v243', { method: 'POST' }).catch(function(){});
            setTimeout(function() {
                if (window.syncPermanentForegroundNotificationV212) window.syncPermanentForegroundNotificationV212(true);
            }, 60);
            return r;
        };
        window.stopFlacRadioStreamV91._v243Wrapped = true;
    }

    window.getActiveSourcesSnapshotV243 = function() {
        var player = document.getElementById('audioPlayer');
        var vid = document.getElementById('jennyVideoElV130');
        var stVid = window._vidStateV130 || {};
        var radAud = (window._radioStateV91 && window._radioStateV91.audio) || window._lastRadioAudioElV243;
        var extAud = (window._khStateV88 && window._khStateV88.previewAudio) || window._lastExternalAudioElV243;
        if (extAud && extAud === radAud) extAud = null;

        var deckAPlaying = (typeof window.isDeckAActuallyPlayingV232 === 'function')
            ? window.isDeckAActuallyPlayingV232()
            : Boolean(player && window.currentPlayingTrack && !player.paused);
        var deckBPlaying = Boolean(
            stVid.active && !stVid.userPaused && vid &&
            ((!vid.paused && !vid.ended) || (window.videoDeckV131 && window.videoDeckV131.isReversed))
        );
        var radioPlaying = Boolean(radAud && !radAud.paused && !radAud.ended && radAud.currentSrc);
        var extPlaying = Boolean(extAud && !extAud.paused && !extAud.ended && extAud.currentSrc);

        return {
            player: player, vid: vid, stVid: stVid, radAud: radAud, extAud: extAud,
            deckAPlaying: deckAPlaying, deckBPlaying: deckBPlaying,
            radioPlaying: radioPlaying, extPlaying: extPlaying,
            anyPlaying: Boolean(deckAPlaying || deckBPlaying || radioPlaying || extPlaying)
        };
    };

    window.handleNativeMediaControlV243 = function(cmd) {
        var snap = window.getActiveSourcesSnapshotV243();
        var target = window._lastActiveMediaSourceV243 || 'deckA';
        if (snap.radioPlaying) target = 'radio';
        else if (snap.extPlaying) target = 'external';
        else if (snap.deckBPlaying && !snap.deckAPlaying) target = 'deckB';
        else if (snap.deckAPlaying && !snap.deckBPlaying) target = 'deckA';

        if (target === 'radio' && (snap.radAud || window._lastRadioSrcUrlV243)) {
            var rAud = snap.radAud;
            if (cmd === 'pause' || (cmd === 'toggle' && snap.radioPlaying)) {
                if (rAud) { try { rAud.pause(); } catch (e) {} }
            } else if (cmd === 'play' || (cmd === 'toggle' && !snap.radioPlaying)) {
                if (rAud) {
                    if (!rAud.src && window._lastRadioSrcUrlV243) rAud.src = window._lastRadioSrcUrlV243;
                    rAud.play().catch(function(){});
                }
            } else if (cmd === 'next' || cmd === 'prev') {
                var cards = Array.from(document.querySelectorAll('#jennyFlacRadioModalV91 [onclick*="playFlacRadio"], #jennyFlacRadioModalV91 [onclick*="RadioStation"]'));
                if (cards.length > 0) {
                    window._radIdxV243 = ((window._radIdxV243 || 0) + (cmd === 'next' ? 1 : cards.length - 1)) % cards.length;
                    try { cards[window._radIdxV243].click(); } catch (e) {}
                }
            }
        } else if (target === 'deckB' && snap.stVid && snap.stVid.active) {
            if (cmd === 'next') {
                if (window.playAdjacentVideoDeckBV216) window.playAdjacentVideoDeckBV216(1);
            } else if (cmd === 'prev') {
                if (window.playAdjacentVideoDeckBV216) window.playAdjacentVideoDeckBV216(-1);
            } else if (cmd === 'pause' && snap.deckBPlaying) {
                if (window.togglePlayDeckBV216) window.togglePlayDeckBV216();
            } else if (cmd === 'play' && !snap.deckBPlaying) {
                if (window.togglePlayDeckBV216) window.togglePlayDeckBV216();
            } else if (cmd === 'toggle') {
                if (window.togglePlayDeckBV216) window.togglePlayDeckBV216();
            }
        } else if (target === 'external' && snap.extAud) {
            if (cmd === 'pause' || (cmd === 'toggle' && snap.extPlaying)) {
                try { snap.extAud.pause(); } catch (e) {}
            } else if (cmd === 'play' || (cmd === 'toggle' && !snap.extPlaying)) {
                snap.extAud.play().catch(function(){});
            }
        } else {
            if (cmd === 'next') {
                if (window._origNextTrackV243) window._origNextTrackV243();
            } else if (cmd === 'prev') {
                if (window._origPrevTrackV243) window._origPrevTrackV243();
            } else if (cmd === 'pause') {
                if (snap.deckAPlaying && window.forceStopPauseDeckAAudioV232) window.forceStopPauseDeckAAudioV232(false);
                else if (snap.deckAPlaying && window._origTogglePlayV243) window._origTogglePlayV243();
            } else if (cmd === 'play') {
                if (!snap.deckAPlaying && window._origTogglePlayV243) window._origTogglePlayV243();
            } else {
                if (window._origTogglePlayV243) window._origTogglePlayV243();
            }
        }
        setTimeout(function() {
            if (window.syncPermanentForegroundNotificationV212) window.syncPermanentForegroundNotificationV212(true);
        }, 80);
    };

    if (navigator.mediaSession && typeof navigator.mediaSession.setActionHandler === 'function') {
        try {
            navigator.mediaSession.setActionHandler('play', function() { window.handleNativeMediaControlV243('play'); });
            navigator.mediaSession.setActionHandler('pause', function() { window.handleNativeMediaControlV243('pause'); });
            navigator.mediaSession.setActionHandler('previoustrack', function() { window.handleNativeMediaControlV243('prev'); });
            navigator.mediaSession.setActionHandler('nexttrack', function() { window.handleNativeMediaControlV243('next'); });
        } catch (e) {}
    }
})();
