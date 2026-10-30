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
                <div class="cp-row"><span class="cp-key">Reversible DNA</span><span class="cp-val cp-accent-green">${info.rev_capsule || "—"}</span></div>
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


// 🛠️ ПАТЧ V68: ПАНЕЛЬ БЫСТРЫХ КНОПОК ПРИ РАСКРЫТИИ ИМЕНИ ТРЕКА (ORIG / PATH / 3 СЛОТА)

window.parseDerivedTrackInfoV68 = function(filename) {
    if (!filename || typeof filename !== 'string') return { isDerived: false, baseStem: '', origStem: '' };
    const cleanName = filename.replace(/^[♪♫🎵🎶\s]+/, '').trim();
    const lastDot = cleanName.lastIndexOf('.');
    const origStem = lastDot > 0 ? cleanName.substring(0, lastDot) : cleanName;
    let stem = origStem;

    // Снимаем любые суффиксы экспортов (_x0.5_slow_jbuf90, _x1.07_fast_vinyl, _rev и т.д.)
    const suffixRe = /(?:_x\d+(?:[.,]\d+)?(?:_[a-z0-9]+)*|_(?:slow|fast)(?:_[a-z0-9]+)*|_(?:jbuf90|jbuf|vinyl|webapi)|_rev(?:ersed)?|_fx|_eq|_dsp|_master)+$/i;

    let prev = null;
    while (stem && stem !== prev) {
        prev = stem;
        stem = stem.replace(suffixRe, '');
    }

    const isDerived = (stem.length > 0 && stem !== origStem);
    return {
        isDerived: isDerived,
        baseStem: stem,
        origStem: origStem,
        cleanName: cleanName
    };
};

window.copyTextToClipboardV68 = async function(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {}
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
};

window.getTrackRowPartsV68 = function(rowEl) {
    if (!rowEl) return { titleEl: null, filename: '' };
    let titleEl = rowEl.querySelector('.track-title, .track-name, [class*="title"], [class*="name"]');
    if (!titleEl) {
        for (const ch of rowEl.children) {
            if (ch.classList && ch.classList.contains('track-expand-actions-v68')) continue;
            if (ch.tagName === 'DIV' || ch.tagName === 'SPAN') {
                const txt = (ch.textContent || '').trim();
                if (txt.length > 3) {
                    titleEl = ch;
                    break;
                }
            }
        }
    }
    let filename = (rowEl.dataset && rowEl.dataset.filename) ? rowEl.dataset.filename : '';
    if (!filename && titleEl) {
        filename = (titleEl.getAttribute('data-filename') || titleEl.getAttribute('title') || titleEl.textContent || '').trim();
    }
    filename = filename.replace(/^[♪♫🎵🎶\s]+/, '').trim();
    return { titleEl, filename };
};

window.isTrackRowExpandedV68 = function(rowEl, titleEl) {
    if (!rowEl || !titleEl) return false;
    if (titleEl.classList.contains('expanded') || rowEl.classList.contains('expanded')) return true;
    if (titleEl.style && (titleEl.style.whiteSpace === 'normal' || titleEl.style.whiteSpace === 'pre-wrap' || titleEl.style.whiteSpace === 'break-spaces')) return true;
    const cs = window.getComputedStyle(titleEl);
    if (cs && cs.whiteSpace && cs.whiteSpace !== 'nowrap') return true;
    if (titleEl.offsetHeight > 30) return true;
    return false;
};

window.getAllTrackRowsV68 = function() {
    const selectors = '#trackList .track-item, #playlist .track-item, .track-list .track-item, .track-item, .track-row';
    return Array.from(document.querySelectorAll(selectors));
};

window.scrollToOriginalTrackV68 = function(derivedFilename, ev) {
    if (ev) ev.stopPropagation();
    const info = window.parseDerivedTrackInfoV68(derivedFilename);
    if (!info.baseStem) return;
    const targetLower = info.baseStem.toLowerCase();

    const findMatchingRow = () => {
        const rows = window.getAllTrackRowsV68();
        let exactOrigRow = null;
        let prefixOrigRow = null;
        let fallbackRow = null;

        for (const r of rows) {
            if (r.style.display === 'none') continue;
            const { filename: fname } = window.getTrackRowPartsV68(r);
            if (!fname || fname === info.cleanName) continue;
            const parsed = window.parseDerivedTrackInfoV68(fname);
            const stemLower = parsed.origStem.toLowerCase();

            if (stemLower === targetLower && !parsed.isDerived) {
                exactOrigRow = r;
                break;
            }
            if (!parsed.isDerived && (stemLower.startsWith(targetLower) || targetLower.startsWith(stemLower))) {
                if (!prefixOrigRow) prefixOrigRow = r;
            }
            if (parsed.baseStem.toLowerCase() === targetLower && !parsed.isDerived) {
                if (!fallbackRow) fallbackRow = r;
            }
        }
        return exactOrigRow || fallbackRow || prefixOrigRow;
    };

    let targetRow = findMatchingRow();

    if (!targetRow) {
        const searchInp = document.getElementById('searchInput') || document.querySelector('input[type="text"], input[type="search"]');
        if (searchInp && searchInp.value.trim() !== '') {
            searchInp.value = '';
            searchInp.dispatchEvent(new Event('input', { bubbles: true }));
            if (typeof window.renderTracks === 'function') window.renderTracks();
            if (typeof window.renderPlaylist === 'function') window.renderPlaylist();
            targetRow = findMatchingRow();
        }
    }

    if (targetRow) {
        const { filename: origName } = window.getTrackRowPartsV68(targetRow);
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetRow.classList.remove('orig-highlight-pulse-v68');
        void targetRow.offsetWidth;
        targetRow.classList.add('orig-highlight-pulse-v68');
        setTimeout(() => targetRow.classList.remove('orig-highlight-pulse-v68'), 2500);

        if (typeof window.showToast === 'function') {
            window.showToast('🎯 Оригинал: ' + origName, ev);
        }
    } else {
        if (typeof window.showToast === 'function') {
            window.showToast('⚠️ Оригинал «' + info.baseStem + '» не найден в списке', ev);
        }
    }
};

window.copyTrackFullPathV68 = async function(filename, ev) {
    if (ev) ev.stopPropagation();
    const cleanName = (filename || '').replace(/^[♪♫🎵🎶\s]+/, '').trim();
    if (!cleanName) return;
    let fullPath = cleanName;
    try {
        const res = await fetch('/api/full_path/' + encodeURIComponent(cleanName));
        if (res.ok) {
            const data = await res.json();
            if (data && data.full_path) fullPath = data.full_path;
        }
    } catch (e) {}

    await window.copyTextToClipboardV68(fullPath);
    if (typeof window.showToast === 'function') {
        window.showToast('📋 PATH: ' + fullPath, ev);
    }
};

window.ensureTrackExpandBarV68 = function(rowEl) {
    if (!rowEl) return;
    const { titleEl, filename } = window.getTrackRowPartsV68(rowEl);
    if (!titleEl || !filename) return;

    const expanded = window.isTrackRowExpandedV68(rowEl, titleEl);
    if (!expanded) {
        rowEl.classList.remove('expanded-row-v68');
        return;
    }

    const info = window.parseDerivedTrackInfoV68(filename);
    let bar = rowEl.querySelector('.track-expand-actions-v68');
    if (!bar) {
        bar = document.createElement('div');
        bar.className = 'track-expand-actions-v68';
        bar.addEventListener('click', (e) => e.stopPropagation());
        bar.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

        if (info.isDerived) {
            const btnOrig = document.createElement('button');
            btnOrig.type = 'button';
            btnOrig.className = 'track-act-btn-v68 btn-orig-v68';
            btnOrig.innerText = 'ORIG';
            btnOrig.addEventListener('click', (e) => window.scrollToOriginalTrackV68(info.cleanName, e));
            bar.appendChild(btnOrig);
        }

        const btnPath = document.createElement('button');
        btnPath.type = 'button';
        btnPath.className = 'track-act-btn-v68 btn-path-v68';
        btnPath.innerText = 'PATH';
        btnPath.addEventListener('click', (e) => window.copyTrackFullPathV68(info.cleanName, e));
        bar.appendChild(btnPath);

        for (let i = 1; i <= 3; i++) {
            const btnStub = document.createElement('button');
            btnStub.type = 'button';
            btnStub.className = 'track-act-btn-v68 btn-stub-v68';
            btnStub.innerText = 'СЛОТ ' + i;
            btnStub.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof window.showToast === 'function') {
                    window.showToast(`🔧 Заглушка #${i} (свободный слот)`, e);
                }
            });
            bar.appendChild(btnStub);
        }

        rowEl.appendChild(bar);
    }

    rowEl.classList.add('expanded-row-v68');
};

window.syncAllTrackExpandBarsV68 = function() {
    window.getAllTrackRowsV68().forEach(r => window.ensureTrackExpandBarV68(r));
};

(function initTrackExpandObserverV68() {
    const triggerSync = () => {
        setTimeout(window.syncAllTrackExpandBarsV68, 15);
        setTimeout(window.syncAllTrackExpandBarsV68, 80);
    };
    document.addEventListener('click', triggerSync, false);
    document.addEventListener('touchend', triggerSync, { passive: true });
})();
