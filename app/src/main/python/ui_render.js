window.expandedTracks = window.expandedTracks || new Set();

const PLAY_SVG_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_SVG_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

window.handleTrackPlayBtn = function(filename, listContext, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const player = document.getElementById('audioPlayer');
    if (window.currentPlayingTrack === filename && player && player.src) {
        window.togglePlay();
    } else {
        window.playTrack(filename, listContext);
    }
};

window.updateTrackListPlayIcons = function() {
    const player = document.getElementById('audioPlayer');
    const isPlayingNow = Boolean(player && !player.paused && window.currentPlayingTrack);

    document.querySelectorAll('.track-row-capsule').forEach(row => {
        const trackName = row.getAttribute('data-track');
        const btn = row.querySelector('.track-row-play-btn');
        const isCurrent = (trackName === window.currentPlayingTrack);

        if (isCurrent) {
            row.style.border = "1px solid #7341be";
            row.style.boxShadow = "0 0 10px rgba(115, 65, 190, 0.4)";
        } else {
            row.style.border = "1px solid #30363d";
            row.style.boxShadow = "none";
        }

        if (btn) {
            btn.innerHTML = (isCurrent && isPlayingNow) ? PAUSE_SVG_ICON : PLAY_SVG_ICON;
        }
    });
};

window.toggleExpandTrackTitle = function(filename) {
    if (window.expandedTracks.has(filename)) {
        window.expandedTracks.delete(filename);
    } else {
        window.expandedTracks.add(filename);
    }

    document.querySelectorAll('.track-row-capsule').forEach(row => {
        if (row.getAttribute('data-track') === filename) {
            const textEl = row.querySelector('.track-title-text');
            const isExp = window.expandedTracks.has(filename);
            if (isExp) {
                row.classList.add('expanded-capsule');
                if (textEl) textEl.classList.add('expanded-title-text');
            } else {
                row.classList.remove('expanded-capsule');
                if (textEl) textEl.classList.remove('expanded-title-text');
            }
        }
    });
};

window.TitleTouchState = { timer: null, firedLong: false, moved: false, startX: 0, startY: 0 };

window.onTitleTouchStart = function(ev, filename) {
    const t = ev.touches ? ev.touches[0] : ev;
    window.TitleTouchState.firedLong = false;
    window.TitleTouchState.moved = false;
    window.TitleTouchState.startX = t.clientX;
    window.TitleTouchState.startY = t.clientY;
    clearTimeout(window.TitleTouchState.timer);

    window.TitleTouchState.timer = setTimeout(() => {
        if (!window.TitleTouchState.moved) {
            window.TitleTouchState.firedLong = true;
            try { navigator.vibrate(45); } catch (e) {}
            window.openTrackInfoModal(filename);
        }
    }, 180);
};

window.onTitleTouchMove = function(ev) {
    if (!window.TitleTouchState.timer) return;
    const t = ev.touches ? ev.touches[0] : ev;
    if (Math.abs(t.clientX - window.TitleTouchState.startX) > 10 || Math.abs(t.clientY - window.TitleTouchState.startY) > 10) {
        window.TitleTouchState.moved = true;
        clearTimeout(window.TitleTouchState.timer);
    }
};

window.onTitleTouchEnd = function(ev, filename) {
    clearTimeout(window.TitleTouchState.timer);
    if (!window.TitleTouchState.moved && !window.TitleTouchState.firedLong) {
        if (ev && ev.cancelable) ev.preventDefault();
        window.toggleExpandTrackTitle(filename);
    }
};

window.ensureTrackInfoModal = function() {
    if (document.getElementById('trackInfoModal')) return;
    const modal = document.createElement('div');
    modal.id = 'trackInfoModal';
    modal.className = 'coreplayer-modal-backdrop';
    modal.style.display = 'none';
    modal.onclick = function(e) {
        if (e.target === modal) window.closeTrackInfoModal();
    };
    modal.innerHTML = `
        <div class="coreplayer-modal-window" onclick="event.stopPropagation()">
            <div class="cp-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:16px;">🎛️</span>
                    <span class="cp-header-title">CORE MEDIA INSPECTOR</span>
                </div>
                <button class="cp-close-btn" onclick="window.closeTrackInfoModal()">✖</button>
            </div>
            <div id="cpModalBody" class="cp-body">
                <div style="text-align:center; padding:25px; color:#8b949e;">⏳ Чтение заголовков потока...</div>
            </div>
            <div class="cp-footer">
                <button id="cpPlayBtn" class="cp-action-btn cp-btn-primary">▶ Воспроизвести</button>
                <button id="cpCopyBtn" class="cp-action-btn cp-btn-secondary">📋 Копировать</button>
                <button class="cp-action-btn cp-btn-ghost" onclick="window.closeTrackInfoModal()">Закрыть</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.closeTrackInfoModal = function() {
    const m = document.getElementById('trackInfoModal');
    if (m) m.style.display = 'none';
};

window.openTrackInfoModal = async function(filename) {
    window.ensureTrackInfoModal();
    const modal = document.getElementById('trackInfoModal');
    const body = document.getElementById('cpModalBody');
    const playBtn = document.getElementById('cpPlayBtn');
    const copyBtn = document.getElementById('cpCopyBtn');

    modal.style.display = 'flex';
    body.innerHTML = `<div style="text-align:center; padding:25px; color:#58a6ff; font-family:monospace;">⏳ Сканирование FFmpeg-декодером...</div>`;

    playBtn.onclick = () => {
        window.closeTrackInfoModal();
        window.playTrack(filename, window.currentListContext || 'main');
    };

    try {
        const res = await fetch('/api/track_info', {
            method: 'POST',
            body: JSON.stringify({ filename: filename })
        });
        const info = await res.json();
        if (info.status !== 'ok') throw new Error(info.error || 'Ошибка чтения файла');

        const cfg = window.appConfig || {};
        const spd = window.getTargetPlaybackSpeed ? window.getTargetPlaybackSpeed() : 1.0;
        const isRev = window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed);
        const engineStr = cfg.studioMode ? 'RAM 32-bit Float Buffer 🚀' : 'HTML5 Direct Stream';
        const pitchStr = cfg.pitchLock ? 'ON (Time-Stretch)' : 'OFF (Vinyl Pitch)';

        let tagsHtml = '';
        if (info.tags && Object.keys(info.tags).length > 0) {
            for (const [k, v] of Object.entries(info.tags)) {
                tagsHtml += `<div class="cp-row"><span class="cp-key">TAG.${k}</span><span class="cp-val">${v}</span></div>`;
            }
        } else {
            tagsHtml = `<div class="cp-row"><span class="cp-key">METADATA</span><span class="cp-val" style="color:#8b949e;">Чистый поток (без тегов)</span></div>`;
        }

        body.innerHTML = `
            <div class="cp-filename-banner">${info.filename}</div>

            <div class="cp-section-title">🔊 AUDIO STREAM PIN (FFMPEG PROBE)</div>
            <div class="cp-grid">
                <div class="cp-row"><span class="cp-key">Container</span><span class="cp-val cp-accent-blue">${info.container}</span></div>
                <div class="cp-row"><span class="cp-key">Audio Codec</span><span class="cp-val cp-accent-green">${info.codec}</span></div>
                <div class="cp-row"><span class="cp-key">Sample Rate</span><span class="cp-val">${info.sample_rate}</span></div>
                <div class="cp-row"><span class="cp-key">Channels</span><span class="cp-val">${info.channels}</span></div>
                <div class="cp-row"><span class="cp-key">Bitrate</span><span class="cp-val cp-accent-gold">${info.bitrate}</span></div>
                <div class="cp-row"><span class="cp-key">Sample Format</span><span class="cp-val">${info.sample_fmt}</span></div>
                <div class="cp-row"><span class="cp-key">Duration</span><span class="cp-val">${info.duration}</span></div>
                <div class="cp-row"><span class="cp-key">Total Samples</span><span class="cp-val">${info.total_samples} PCM frames</span></div>
            </div>

            <div class="cp-section-title">⚡ JENNY DSP PIPELINE STATE</div>
            <div class="cp-grid">
                <div class="cp-row"><span class="cp-key">Audio Engine</span><span class="cp-val cp-accent-purple">${engineStr}</span></div>
                <div class="cp-row"><span class="cp-key">Speed / Vector</span><span class="cp-val cp-accent-gold">x${spd} (${isRev ? '⏪ REVERSE' : '⏩ FORWARD'})</span></div>
                <div class="cp-row"><span class="cp-key">Pitch Lock</span><span class="cp-val">${pitchStr}</span></div>
                <div class="cp-row"><span class="cp-key">FIR Saturator</span><span class="cp-val">${cfg.firEnabled ? `ON (Gain: ${cfg.firSettings?.gain}, Decay: ${cfg.firSettings?.decay}ms)` : 'BYPASS'}</span></div>
                <div class="cp-row"><span class="cp-key">3-Band X-Over</span><span class="cp-val">${cfg.multiBandEnabled ? `ON (${cfg.multiBandSettings?.low}Hz / ${cfg.multiBandSettings?.high}Hz)` : 'BYPASS'}</span></div>
                <div class="cp-row"><span class="cp-key">Soft Clipper</span><span class="cp-val">${cfg.limiterEnabled ? `ON (${cfg.limiterSettings?.threshold}dB, ${cfg.limiterSettings?.ratio}:1)` : 'BYPASS'}</span></div>
                <div class="cp-row"><span class="cp-key">Overdrive Amp</span><span class="cp-val">${cfg.boosterEnabled ? `ON (Power +${cfg.boosterPower})` : 'OFF'}</span></div>
            </div>

            <div class="cp-section-title">📂 FILE SYSTEM & TAGS</div>
            <div class="cp-grid">
                <div class="cp-row"><span class="cp-key">File Size</span><span class="cp-val">${info.size_str}</span></div>
                <div class="cp-row"><span class="cp-key">Modified</span><span class="cp-val">${info.mtime}</span></div>
                <div class="cp-row"><span class="cp-key">Full Path</span><span class="cp-val cp-path">${info.full_path}</span></div>
                ${tagsHtml}
            </div>
        `;

        copyBtn.onclick = () => {
            const plain = [
                `=== JENNY PLAYER / CORE MEDIA INSPECTOR ===`,
                `File: ${info.filename}`,
                `Container: ${info.container}`,
                `Codec: ${info.codec} | ${info.sample_rate} | ${info.channels} | ${info.bitrate}`,
                `Duration: ${info.duration} (${info.total_samples} samples)`,
                `Size: ${info.size_str}`,
                `Path: ${info.full_path}`
            ].join('\n');
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(plain).catch(()=>{});
            }
            copyBtn.innerText = "✅ Скопировано";
            setTimeout(() => { copyBtn.innerText = "📋 Копировать"; }, 1200);
        };
    } catch (e) {
        body.innerHTML = `<div style="padding:20px; color:#f85149; text-align:center;">❌ ${e.message || e}</div>`;
    }
};

function buildTrackRowHTML(file, listType, heartIcon) {
    const player = document.getElementById('audioPlayer');
    const isPlayingTrack = (file === window.currentPlayingTrack);
    const isActuallyPlaying = Boolean(isPlayingTrack && player && !player.paused);
    const isExpanded = window.expandedTracks.has(file);

    const safeId = encodeURIComponent(file).replace(/[^a-zA-Z0-9]/g, '');
    const safeFileJS = file.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safeAttr = file.replace(/"/g, '&quot;');

    const activeStyle = isPlayingTrack
        ? "border: 1px solid #7341be; box-shadow: 0 0 10px rgba(115, 65, 190, 0.4);"
        : "border: 1px solid #30363d;";

    const btnIcon = isActuallyPlaying ? PAUSE_SVG_ICON : PLAY_SVG_ICON;
    const expCapsuleClass = isExpanded ? "expanded-capsule" : "";
    const expTextClass = isExpanded ? "expanded-title-text" : "";

    return `
        <div style="position: relative;">
            <div class="capsule track-row-capsule ${expCapsuleClass}" id="track-${listType}-${safeId}" data-track="${safeAttr}" style="position: relative; z-index: 2; ${activeStyle}">
                <div onclick="event.stopPropagation(); window.toggleFav('${safeFileJS}'); window.fetchData();" style="width: 13%; min-height: 48px; display: flex; justify-content: flex-start; align-items: center; padding-left: 6px; cursor: pointer;">
                    <div style="width: 36px; height: 36px; display: flex; justify-content: center; align-items: center; font-size: 18px;">${heartIcon}</div>
                </div>
                <div class="track-title-zone"
                     ontouchstart="window.onTitleTouchStart(event, '${safeFileJS}')"
                     ontouchmove="window.onTitleTouchMove(event)"
                     ontouchend="window.onTitleTouchEnd(event, '${safeFileJS}')"
                     onclick="if(!('ontouchstart' in window)) window.toggleExpandTrackTitle('${safeFileJS}')"
                     style="width: 63%; min-height: 48px; display: flex; align-items: center; overflow: hidden; cursor: pointer; user-select: none; -webkit-user-select: none;">
                    <span style="color:#58a6ff; font-weight:bold; margin-right:8px; flex-shrink:0;">♪</span>
                    <span class="track-title-text ${expTextClass}">${file}</span>
                </div>
                <div class="track-play-hitbox" onclick="window.handleTrackPlayBtn('${safeFileJS}', '${listType}', event)"
                     style="width: 24%; min-height: 48px; align-self: stretch; display: flex; justify-content: flex-end; align-items: center; padding-right: 2px; cursor: pointer;">
                    <button class="play-pause-btn track-row-play-btn" style="width: 44px; height: 44px; flex-shrink: 0; pointer-events: none;">
                        ${btnIcon}
                    </button>
                </div>
            </div>
        </div>`;
}

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
                favHtml += buildTrackRowHTML(file, 'fav', '❤️');
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
                let isFav = window.favorites.includes(file);
                let heartIcon = isFav ? '❤️' : '🤍';
                tHtml += buildTrackRowHTML(file, 'main', heartIcon);
            });
        }
        unifiedBox.innerHTML = tHtml;
    } catch(e) { }
};
