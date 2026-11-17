/* ============================================================================
 * ui_torrent.js — Торрент-студия: поиск, magnet/.torrent, очередь, трекеры, карта кусков, P2P
 *
 * Склейка:  /bundle_2_player.js, модуль 8 из 18. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   openTorrentHubPreviewModalV91, runTorrentActionV96, openMagnetInGoEngineV96, renderTorrentFilesListV96, startSelectedTorrentDownloadV96, backToTorrentSearchListV97, previewTorrentFileStreamV97, downloadSingleTorrentTrackV98, showMainPageEncodingBannerV98, toggleTorrentFilterPillV99 … (всего функций: 83)
 * Откуда:   ui_v71.js (коммит 9ae6639), строки 4745…38058 (39 фрагментов, вперемешку с другими темами). Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */


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

// === 🧲 JENNY V96: FULL P2P TORRENT STUDIO UI (SEARCH + MAGNET + ENDGAME + AUTO XFLAC) ===
window._torStateV96 = {
    onlyFlac: true, formatMode: 'xflac_psycho', currentHash: '', currentName: '',
    files: [], selectedFiles: new Set(), pollTimer: null, importedSet: new Set()
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
            <div id="torStatusLineV96" style="font-size:11px;color:#d2a8ff;font-weight:bold;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.32;height:16px;line-height:16px;">⚡ Введи название альбома/игры или вставь Magnet-ссылку</div>
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
                <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${Number(r.size_mb || 0).toFixed(1)} MB • <span style="color:#3fb950;font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
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
        const audioExts = ['.flac', '.wav', '.mp3', '.ogg', '.aac', '.m4a', '.opus', '.alac', '.ape', '.wv', '.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.3gp'];
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
                <div style="color:#e6edf3;font-size:11.5px;font-weight:bold;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.32;">${f.path}</div>
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
                    <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${Number(r.size_mb || 0).toFixed(1)} MB • <span style="color:#3fb950;font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
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
                <div style="color:#e6edf3;font-size:11.5px;font-weight:bold;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.32;">${f.path}</div>
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
                <div style="color:#e6edf3;font-size:11.5px;font-weight:bold;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.32;">${f.path}</div>
                <div id="torFileProgV96_${f.index}" style="color:#8b949e;font-size:10px;margin-top:2px;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.32;height:14px;line-height:14px;">💾 ${mb} MB • ▶ Поток / ⬇️ Скачать</div>
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
        b.innerHTML = `<span style="white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.32;margin-right:8px;">${msgText}</span><span style="color:#3fb950;font-size:10.5px;flex-shrink:0;">Общий: ${p}%</span>`;
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

var renderTorrentFilterBarV99 = window.renderTorrentFilterBarV99 = window.renderTorrentFilterBarV99 || function(){};

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
                <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${Number(r.size_mb || 0).toFixed(1)} MB • <span style="color:${r.seeders > 0 ? '#3fb950' : '#ff7b72'};font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
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

/* [CLEANED: renderTorrentFilterBarV99] */

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
                <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${Number(r.size_mb || 0).toFixed(1)} MB • <span style="color:${r.seeders > 0 ? '#3fb950' : '#ff7b72'};font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
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

var runTorrentDownloadQueueV102 = window.runTorrentDownloadQueueV102 = window.runTorrentDownloadQueueV102 || function(){};

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
        const audioExts = ['.flac', '.wav', '.mp3', '.ogg', '.aac', '.m4a', '.opus', '.alac', '.ape', '.wv', '.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.3gp'];
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
                <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${Number(r.size_mb || 0).toFixed(1)} MB • <span style="color:${r.seeders >= 2 ? '#3fb950' : (r.seeders > 0 ? '#e3b341' : '#ff7b72')};font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
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
    m.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:rgba(4,6,10,0.86);z-index:2147483200;display:flex;align-items:center;justify-content:center;box-sizing:border-box;';
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
    const audioExts = ['.flac', '.wav', '.mp3', '.ogg', '.aac', '.m4a', '.opus', '.alac', '.ape', '.wv', '.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.3gp'];
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
                        <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${Number(r.size_mb || 0).toFixed(1)} MB • <span style="color:${r.seeders >= 2 ? '#3fb950' : (r.seeders > 0 ? '#e3b341' : '#ff7b72')};font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
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

var triggerPickTorrentFileV113 = window.triggerPickTorrentFileV113 = window.triggerPickTorrentFileV113 || function(){};

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
                    <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${Number(r.size_mb || 0).toFixed(1)} MB • <span style="color:${r.seeders >= 2 ? '#3fb950' : (r.seeders > 0 ? '#e3b341' : '#ff7b72')};font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
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
                <div style="font-size:10px;color:#8b949e;margin-top:3px;">💾 ${Number(r.size_mb || 0).toFixed(1)} MB • <span style="color:${r.seeders >= 2 ? '#3fb950' : (r.seeders > 0 ? '#e3b341' : '#ff7b72')};font-weight:bold;">▲ Сидов: ${r.seeders}</span> • ▼ Пиров: ${r.peers}</div>
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

// === 🧩 JENNY V128: HEADER HUB MENU ===
window._torHubTabV128 = 'torrents';
window._torHubSelectedHashV128 = '';
window._torHubSelectedPieceV128 = -1;
window._torLiveDaemonSnapV128 = [];
window._torStreamBufferingUrlV129 = '';

window.mountTorrentHeaderHubMenuV128 = function() {
const m = document.getElementById('jennyTorrentModalV91');
if (!m) return;
const hdr = m.querySelector('.jenny-modal-hdr-v71');
if (!hdr || document.getElementById('btnTorHeaderHubMenuV128')) return;
hdr.style.gap = '6px';
hdr.innerHTML = `<div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
<span style="color:#d2a8ff;font-weight:900;font-size:12.5px;display:inline-flex;align-items:center;gap:5px;flex-shrink:0;">${window.JENNY_NEON_SVGS_V92.torrent}<span>ТОРРЕНТ</span></span>
<button type="button" id="btnTorHeaderHubMenuV128" onclick="window.toggleTorrentInspectorHubV128(event)" style="flex:1;min-width:0;padding:4px 8px;font-size:10.5px;border-radius:8px;background:linear-gradient(90deg,rgba(137,87,229,0.28),rgba(31,111,235,0.28));border:1px solid #d2a8ff;color:#e6edf3;font-weight:900;display:inline-flex;align-items:center;justify-content:center;gap:5px;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.32;">
<span>📊</span><span id="lblTorHeaderHubMenuV128">Раздачи • Треки • Части</span></button></div>
<button type="button" onclick="document.getElementById('jennyTorrentModalV91').style.setProperty('display','none','important')" style="padding:4px 9px;font-size:11px;border-radius:7px;background:rgba(88,166,255,0.18);border:1px solid #58a6ff;color:#58a6ff;font-weight:bold;flex-shrink:0;">➖ В фон</button>`;
};

const _origOpenTorV128 = window.openTorrentHubPreviewModalV91;
window.openTorrentHubPreviewModalV91 = function(ev) {
_origOpenTorV128.apply(this, arguments);
window.mountTorrentHeaderHubMenuV128();
};

// Умный запуск потока ▶ из торрента: ставит трек первым в конвейер, не сбивается от перерисовки окна и сам дожидается прилета 1-го куска!
window.previewTorrentFileStreamV97 = async function(fileIdx, btnEl, ev) {
if (ev && ev.stopPropagation) ev.stopPropagation();
const ts = window._torStateV96;
const hash = ts ? ts.currentHash : '';
if (!hash) return;
const streamUrl = `/api/torrent/stream/${hash}/${fileIdx}`;
const curAud = window._khStateV88 ? window._khStateV88.previewAudio : null;

// Если этот трек уже играет — ставим на паузу/останавливаем
if (curAud && curAud._pagePath === streamUrl && !curAud.paused) {
window._torStreamBufferingUrlV129 = '';
window.stopAllExternalStreamsV97();
if (document.getElementById('jennyTorInspectorModalV128')) window.renderTorrentInspectorHubV128();
return;
}
// Если он уже в процессе буферизации первого куска — не обрываем его!
if (window._torStreamBufferingUrlV129 === streamUrl) {
if (typeof window.showToast === 'function') window.showToast('⚡ Загружаем стартовый кусок трека от пиров...');
return;
}

window.stopAllExternalStreamsV97();
window.pauseMainPlayerForOstV90();
window._torStreamBufferingUrlV129 = streamUrl;
const myReqId = ++window._previewReqIdV97;
if (btnEl) btnEl.innerText = '⏳';

const job = window._torMapV112 && window._torMapV112[hash];
const fObj = ((job && job.files) || (ts && ts.files) || []).find(x => Number(x.index) === Number(fileIdx));
const titleStr = fObj ? String(fObj.path || '').split('/').pop() : `Track #${fileIdx}`;

if (job) {
window._umpPlayingTorrentCtxV108 = { hash: hash, fileIdx: Number(fileIdx) };
}

// Сразу даем команду демону поставить этот файл #1 в конвейере
fetch('/api/torrent/control', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ hash: hash, action: 'boost_file', file_index: Number(fileIdx) })
}).catch(() => {});

for (let attempt = 1; attempt <= 6; attempt++) {
if (myReqId !== window._previewReqIdV97) return;
const aud = new Audio(streamUrl + `?t=${Date.now()}`);
aud._pagePath = streamUrl;
aud.volume = window.getKhPreviewVolumeV90();
window._khStateV88.previewAudio = aud;
window.bindAudioToAllMiniPlayersV98(aud, titleStr);
if (typeof window.syncMiniPlayerTorrentBtnVisibilityV108 === 'function') {
window.syncMiniPlayerTorrentBtnVisibilityV108();
}
aud.onended = () => {
window._torStreamBufferingUrlV129 = '';
if (btnEl) btnEl.innerText = '▶';
if (document.getElementById('jennyTorInspectorModalV128')) window.renderTorrentInspectorHubV128();
};
try {
await aud.play();
if (myReqId !== window._previewReqIdV97) { aud.pause(); return; }
window._torStreamBufferingUrlV129 = '';
if (btnEl) btnEl.innerText = '⏹';
if (document.getElementById('jennyTorInspectorModalV128')) window.renderTorrentInspectorHubV128();
return;
} catch (e) {
if (myReqId !== window._previewReqIdV97) return;
if (attempt === 1 && typeof window.showToast === 'function') {
window.showToast(`⚡ Подкачка начала «${titleStr}» (автостарт)...`);
}
await new Promise(r => setTimeout(r, 1500));
}
}
window._torStreamBufferingUrlV129 = '';
if (btnEl) btnEl.innerText = '▶';
if (typeof window.showToast === 'function') {
window.showToast('⚠️ Пир пока не отдал первый кусок этого трека');
}
};

window.toggleTorrentInspectorHubV128 = function(ev, forceTab, forceHash) {
if (ev && ev.stopPropagation) ev.stopPropagation();
window.mountTorrentHeaderHubMenuV128();
if (forceTab) window._torHubTabV128 = forceTab;
if (forceHash) window._torHubSelectedHashV128 = forceHash;
let pop = document.getElementById('jennyTorInspectorModalV128');
if (pop && !forceTab && !forceHash) { pop.remove(); return; }
if (!pop) {
pop = document.createElement('div');
pop.id = 'jennyTorInspectorModalV128';
pop.className = 'jenny-modal-backdrop-v71';
pop.style.zIndex = '2147483200';
pop.onclick = (e) => { if (e.target === pop) pop.remove(); };
// Создаем каркас модалки ОДИН РАЗ, чтобы скролл никогда не сбрасывался при ежесекундном обновлении!
pop.innerHTML = `<div class="jenny-modal-card-v71" onclick="event.stopPropagation()" style="max-width:460px;max-height:86vh;display:flex;flex-direction:column;border:1.5px solid #d2a8ff;">
<div class="jenny-modal-hdr-v71" style="background:linear-gradient(90deg,rgba(210,168,255,0.25),rgba(31,111,235,0.25));">
<span style="color:#d2a8ff;font-weight:900;font-size:12.5px;">📊 ЦЕНТР ЗАКАЧЕК P2P</span>
<div style="display:flex;align-items:center;gap:6px;">
<button type="button" onclick="window.nukeAllTorrentsV142()" style="padding:3px 8px;font-size:10px;border-radius:6px;background:rgba(248,81,73,0.18);border:1px solid #ff7b72;color:#ff7b72;font-weight:bold;">🧹 Сброс всех + файлы</button>
<button type="button" onclick="document.getElementById('jennyTorInspectorModalV128').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button>
</div></div>
<div id="torHubTabsHeaderV128" style="padding:8px 10px;background:#090d14;border-bottom:1px solid #21262d;display:flex;gap:6px;"></div>
<div id="torHubScrollBodyV128" style="flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px;min-height:240px;"></div>
</div>`;
document.body.appendChild(pop);
}
window.renderTorrentInspectorHubV128();
window.refreshTorrentDaemonSnapV128();
};

window.switchTorHubTabV128 = function(tabName, hashStr) {
window._torHubTabV128 = tabName;
if (hashStr) window._torHubSelectedHashV128 = hashStr;
window._torHubSelectedPieceV128 = -1;
const sb = document.getElementById('torHubScrollBodyV128');
if (sb) sb.scrollTop = 0;
window.renderTorrentInspectorHubV128();
};

window.controlTorrentJobV128 = async function(hash, action, idxVal) {
try {
const bodyObj = { hash: hash, action: action };
if (action === 'boost_piece') bodyObj.piece_index = Number(idxVal || 0);
else bodyObj.file_index = Number(idxVal || 0);
const ctrlRes = await fetch('/api/torrent/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj) }).then(r => r.json()).catch(() => ({}));
if (action === 'drop') {
if (window._torMapV112) delete window._torMapV112[hash];
if (window._torSnapshotsByHashV108) delete window._torSnapshotsByHashV108[hash];
window._torLiveDaemonSnapV128 = (window._torLiveDaemonSnapV128 || []).filter(t => t.hash !== hash);
if (typeof window.showToast === 'function') window.showToast('🗑️ Раздача и файлы удалены с диска (' + (ctrlRes.freed_mb || 0) + ' МБ освобождено)');
if (typeof window.syncDiscoveredVideosIntoPlaylistV134 === 'function') window.syncDiscoveredVideosIntoPlaylistV134(true);
}
const job = window._torMapV112 && window._torMapV112[hash];
if (job) {
if (action === 'drop') delete window._torMapV112[hash];
else if (action === 'pause') job.paused = true;
else if (action === 'resume' || action === 'boost_file' || action === 'boost_piece') {
job.paused = false; job.dlActive = true;
if (action === 'boost_file' && idxVal !== undefined) {
job.selectedFiles.add(Number(idxVal)); job.targetSet.add(Number(idxVal));
if (typeof window.showToast === 'function') window.showToast('⚡ Трек поставлен первым в очередь!');
} else if (action === 'boost_piece') {
if (typeof window.showToast === 'function') window.showToast(`⚡ Часть #${idxVal} поставлена на закачку!`);
}
window.ensureMultiTorrentWorkerV112();
}
}
await window.refreshTorrentDaemonSnapV128();
} catch (e) {}
};

window.jumpToTorrentFilesFromHubV128 = function(hash) {
document.getElementById('jennyTorInspectorModalV128')?.remove();
const job = window._torMapV112 && window._torMapV112[hash];
if (job) window.mountTorrentJobToScreenV112(job);
};

window.selectPieceOnMapV128 = function(hash, pieceIdx) {
window._torHubSelectedHashV128 = hash;
window._torHubSelectedPieceV128 = Number(pieceIdx);
window.renderTorrentInspectorHubV128();
};

window.renderTorrentInspectorHubV128 = function() {
const pop = document.getElementById('jennyTorInspectorModalV128');
const tabsHdr = document.getElementById('torHubTabsHeaderV128');
const scrollBody = document.getElementById('torHubScrollBodyV128');
if (!pop || !tabsHdr || !scrollBody) return;

// Сохраняем текущую прокрутку основного списка и матрицы частей!
const prevMainScroll = scrollBody.scrollTop;
const oldGrid = document.getElementById('torHubPiecesGridBoxV129');
const prevGridScroll = oldGrid ? oldGrid.scrollTop : 0;

const torList = window._torLiveDaemonSnapV128 || [];
const mapJobs = Object.values(window._torMapV112 || {});
window._torStableOrderV142 = window._torStableOrderV142 || {};
window._torStableSeqV142 = window._torStableSeqV142 || 1;
const allHashes = Array.from(new Set([...torList.map(t => t.hash), ...mapJobs.map(j => j.hash)])).filter(Boolean);
allHashes.forEach(h => { if (!window._torStableOrderV142[h]) window._torStableOrderV142[h] = window._torStableSeqV142++; });
allHashes.sort((a, b) => (window._torStableOrderV142[a] || 0) - (window._torStableOrderV142[b] || 0));
if (!window._torHubSelectedHashV128 || !allHashes.includes(window._torHubSelectedHashV128)) {
window._torHubSelectedHashV128 = window._torStateV96.currentHash || allHashes[0] || '';
}
const activeTab = window._torHubTabV128 || 'torrents';
let totalQueuedTracks = 0;
torList.forEach(t => { totalQueuedTracks += (t.files || []).length; });
const tabStyle = (id) => `flex:1;padding:7px 6px;font-size:11px;font-weight:900;border-radius:8px;border:1px solid ${activeTab === id ? '#d2a8ff' : '#30363d'};background:${activeTab === id ? 'rgba(210,168,255,0.22)' : '#11161f'};color:${activeTab === id ? '#fff' : '#8b949e'};`;

tabsHdr.innerHTML = `
<button type="button" onclick="window.switchTorHubTabV128('torrents')" style="${tabStyle('torrents')}">📦 Раздачи (${allHashes.length})</button>
<button type="button" onclick="window.switchTorHubTabV128('tracks')" style="${tabStyle('tracks')}">🎵 Треки (${totalQueuedTracks})</button>
<button type="button" onclick="window.switchTorHubTabV128('pieces')" style="${tabStyle('pieces')}">🧩 Карта частей</button>`;

let bodyHtml = '';
const curAud = window._khStateV88 ? window._khStateV88.previewAudio : null;
const curPlayingPath = (curAud && !curAud.paused) ? String(curAud._pagePath || '') : '';

if (activeTab === 'torrents') {
if (!allHashes.length) {
bodyHtml = `<div style="padding:30px 12px;text-align:center;color:#8b949e;font-size:12px;">Нет активных раздач. Открой любую раздачу из поиска или через <b>📂 .torrent</b>.</div>`;
} else {
bodyHtml = allHashes.map(h => {
const dTor = torList.find(x => x.hash === h) || {};
const job = (window._torMapV112 && window._torMapV112[h]) || {};
const name = dTor.name || job.name || h;
const files = dTor.files || [];
const sumLen = files.reduce((a, f) => a + (f.length || 0), 0);
const sumDone = files.reduce((a, f) => a + (f.completed || 0), 0);
const pct = sumLen > 0 ? ((sumDone * 100) / sumLen).toFixed(sumDone > 0 && (sumDone * 100 / sumLen) < 1 ? 1 : 0) : (job.netPct || 0);
const doneMb = (sumDone / (1024 * 1024)).toFixed(1);
const totMb = (sumLen / (1024 * 1024)).toFixed(1);
const spd = dTor.speed_kbps || job.speedKbps || 0;
const seeds = dTor.seeders !== undefined ? dTor.seeders : (job.seeders || 0);
const peers = dTor.peers !== undefined ? dTor.peers : (job.peers || 0);
const totPeers = dTor.total_peers || job.totalPeers || 0;
const isPaused = Boolean(dTor.paused);
const readyCnt = job.readyCnt || files.filter(f => f.done).length;
const targetCnt = files.length || (job.targetSet ? job.targetSet.size : 0);
const pComp = dTor.pieces_complete || 0;
const pTot = dTor.num_pieces || 0;
return `<div style="background:#0d1117;border:1px solid ${isPaused ? '#e3b341' : (spd > 0 ? '#3fb950' : '#30363d')};border-radius:10px;padding:9px 10px;display:flex;flex-direction:column;gap:6px;">
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
<div style="color:#e6edf3;font-size:12px;font-weight:900;word-break:break-word;flex:1;">💿 ${name}</div>
<span style="font-size:10px;padding:2px 6px;border-radius:6px;font-weight:bold;background:${isPaused ? 'rgba(227,179,65,0.2)' : 'rgba(63,185,80,0.2)'};color:${isPaused ? '#e3b341' : '#3fb950'};flex-shrink:0;">${isPaused ? '⏸ Пауза' : (spd > 0 ? '⚡ ' + spd + ' КБ/с' : '🧲 Активен')}</span></div>
<div style="width:100%;height:6px;background:#161b22;border-radius:4px;overflow:hidden;border:1px solid #21262d;"><div style="width:${Math.min(100, parseFloat(pct) || 0)}%;height:100%;background:linear-gradient(90deg,#8957e5,#3fb950);"></div></div>
<div style="font-size:10.5px;color:#8b949e;display:flex;justify-content:space-between;"><span>📥 ${doneMb}/${totMb} МБ (${pct}%)</span><span>▲ Сидов: <b style="color:#3fb950;">${seeds}</b> • ▼ Пиров: <b>${peers}${totPeers > peers ? '/' + totPeers : ''}</b></span></div>
<div style="font-size:10.5px;color:#79c0ff;display:flex;justify-content:space-between;"><span>🎵 В плеере: <b>${readyCnt}/${targetCnt}</b></span>${pTot > 0 ? `<span>🧩 Частей: <b>${pComp}/${pTot}</b></span>` : ''}</div>
<div style="display:flex;gap:5px;margin-top:2px;">
<button type="button" onclick="window.jumpToTorrentFilesFromHubV128('${h}')" style="flex:1;padding:5px;font-size:10.5px;background:#161b22;color:#58a6ff;border:1px solid #30363d;border-radius:7px;font-weight:bold;">📂 Файлы</button>
<button type="button" onclick="window.switchTorHubTabV128('tracks','${h}')" style="flex:1;padding:5px;font-size:10.5px;background:#161b22;color:#3fb950;border:1px solid #30363d;border-radius:7px;font-weight:bold;">🎵 Треки</button>
<button type="button" onclick="window.switchTorHubTabV128('pieces','${h}')" style="flex:1;padding:5px;font-size:10.5px;background:rgba(210,168,255,0.16);color:#d2a8ff;border:1px solid #d2a8ff;border-radius:7px;font-weight:bold;">🧩 Части</button>
<button type="button" onclick="window.controlTorrentJobV128('${h}','${isPaused ? 'resume' : 'pause'}')" style="padding:5px 8px;font-size:10.5px;background:#161b22;color:#e3b341;border:1px solid #30363d;border-radius:7px;font-weight:bold;">${isPaused ? '▶' : '⏸'}</button>
<button type="button" onclick="window.controlTorrentJobV128('${h}','drop')" style="padding:5px 8px;font-size:10.5px;background:rgba(248,81,73,0.16);color:#ff7b72;border:1px solid rgba(248,81,73,0.5);border-radius:7px;font-weight:bold;">🗑️</button>
</div></div>`;
}).join('');
}
} else if (activeTab === 'tracks') {
const allActiveFiles = [];
torList.forEach(t => {
const job = (window._torMapV112 && window._torMapV112[t.hash]) || {};
(t.files || []).forEach(f => {
const stMap = (job.fileStatusMap && job.fileStatusMap[f.index]) || {};
allActiveFiles.push({
hash: t.hash, index: f.index, title: String(f.path || '').split('/').pop() || f.path,
length: f.length || 0, completed: f.completed || 0, percent: f.percent || 0,
done: Boolean(f.done), isLead: Boolean(f.is_lead), xflacFile: stMap.xflac_file || '',
begPiece: f.begin_piece || 0, endPiece: f.end_piece || 0
});
});
});
// Стабильная сортировка по индексу трека (чтобы список не прыгал под пальцем при смене процентов!)
allActiveFiles.sort((a, b) => (a.hash !== b.hash) ? a.hash.localeCompare(b.hash) : (a.index - b.index));
if (!allActiveFiles.length) {
bodyHtml = `<div style="padding:30px 12px;text-align:center;color:#8b949e;font-size:12px;">Нет выбранных треков в закачке. Нажми <b>⬇️</b> напротив любого трека в раздаче!</div>`;
} else {
const shown = allActiveFiles.slice(0, 120);
bodyHtml = shown.map(item => {
const doneMb = (item.completed / (1024 * 1024)).toFixed(1);
const totMb = (item.length / (1024 * 1024)).toFixed(1);
const pRange = item.endPiece > item.begPiece ? `🧩 #${item.begPiece}..#${item.endPiece - 1}` : `🧩 #${item.begPiece}`;
const sUrl = `/api/torrent/stream/${item.hash}/${item.index}`;
const playIcon = (window._torStreamBufferingUrlV129 === sUrl) ? '⏳' : (curPlayingPath === sUrl ? '⏹' : '▶');
const stB = item.done ? `<span style="color:#3fb950;font-weight:bold;">✅ Готов (${totMb} МБ)</span>` : (item.isLead ? `<span style="color:#d2a8ff;font-weight:900;">🔥 КАЧАЕТСЯ: ${doneMb}/${totMb} МБ (${item.percent}%)</span>` : `<span>⏳ ${doneMb}/${totMb} МБ (${item.percent}%)</span>`);
const cmpMap = window._p2pCompareStateV163 || {};
const cmpKeyOrig = `${item.hash}_${item.index}_orig`;
const cmpKeyWav = `${item.hash}_${item.index}_wav`;
const stOrig = cmpMap[cmpKeyOrig] || '';
const stWav = cmpMap[cmpKeyWav] || '';
const safeTitleJs = String(item.title || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const cmpRowHtml = item.done ? `<div style="width:100%;display:flex;gap:6px;margin-top:6px;padding-top:5px;border-top:1px dashed rgba(63,185,80,0.32);">
<button type="button" onpointerdown="event.stopPropagation();window._torHubHoldRenderUntilV163=Date.now()+1800;" onclick="event.stopPropagation();window.addP2pCompareFileToPlayerV162('${safeTitleJs}','orig',this,'${item.hash}',${item.index})" style="flex:1;padding:5px 6px;font-size:10.5px;font-weight:bold;border-radius:6px;border:1px solid ${stOrig === 'done' ? '#3fb950' : '#a371f7'};background:${stOrig === 'done' ? 'rgba(63,185,80,0.22)' : 'rgba(163,113,247,0.18)'};color:${stOrig === 'done' ? '#3fb950' : '#d2a8ff'};cursor:pointer;touch-action:manipulation;">${stOrig === 'busy' ? '⏳ Добавляю...' : (stOrig === 'done' ? '✅ Ориг в плеере' : '📥 Добавить ориг')}</button>
<button type="button" onpointerdown="event.stopPropagation();window._torHubHoldRenderUntilV163=Date.now()+1800;" onclick="event.stopPropagation();window.addP2pCompareFileToPlayerV162('${safeTitleJs}','wav',this,'${item.hash}',${item.index})" style="flex:1;padding:5px 6px;font-size:10.5px;font-weight:bold;border-radius:6px;border:1px solid ${stWav === 'done' ? '#3fb950' : '#e3b341'};background:${stWav === 'done' ? 'rgba(63,185,80,0.22)' : 'rgba(227,179,65,0.18)'};color:${stWav === 'done' ? '#3fb950' : '#f2cc60'};cursor:pointer;touch-action:manipulation;">${stWav === 'busy' ? '⏳ Конвертация...' : (stWav === 'done' ? '✅ WAV в плеере' : '💿 Добавить WAV')}</button>
</div>` : '';
return `<div style="padding:7px 9px;border-radius:8px;border:1px solid ${item.isLead ? '#d2a8ff' : (item.done ? 'rgba(63,185,80,0.5)' : '#21262d')};background:linear-gradient(90deg, ${item.done ? 'rgba(63,185,80,0.22)' : 'rgba(137,87,229,0.28)'} ${item.percent}%, #0b0f16 ${item.percent}%);display:flex;flex-wrap:wrap;align-items:center;gap:6px;">
<div style="flex:1;min-width:0;"><div style="color:#e6edf3;font-size:11.5px;font-weight:bold;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.32;">${item.title}</div>
<div style="font-size:10px;color:#8b949e;margin-top:2px;display:flex;gap:6px;">${stB}<span style="color:#58a6ff;cursor:pointer;" onclick="window.switchTorHubTabV128('pieces','${item.hash}');window.selectPieceOnMapV128('${item.hash}',${item.begPiece});">${pRange}</span></div></div>
${!item.done ? `<button type="button" onclick="window.controlTorrentJobV128('${item.hash}','boost_file',${item.index})" style="padding:4px 7px;font-size:10px;background:rgba(210,168,255,0.2);color:#d2a8ff;border:1px solid #d2a8ff;border-radius:6px;font-weight:bold;">⚡ Первым</button>` : ''}
<button type="button" onclick="window._torStateV96.currentHash='${item.hash}';window.previewTorrentFileStreamV97(${item.index},this,event)" style="padding:4px 8px;font-size:10.5px;background:#161b22;color:#58a6ff;border:1px solid #30363d;border-radius:6px;">${playIcon}</button>${cmpRowHtml}</div>`;
}).join('');
}
} else if (activeTab === 'pieces') {
const dTor = torList.find(x => x.hash === window._torHubSelectedHashV128) || torList[0];
if (!dTor || !dTor.pieces_map) {
bodyHtml = `<div style="padding:30px 12px;text-align:center;color:#8b949e;font-size:12px;">Карта частей появится сразу после открытия раздачи.</div>`;
} else {
const pMap = String(dTor.pieces_map || '');
const nPieces = pMap.length;
const pLenMb = ((dTor.piece_length || 0) / (1024 * 1024)).toFixed(2);
let cntDone = 0, cntPartial = 0, cntHigh = 0, cntQueue = 0;
for (let i = 0; i < nPieces; i++) {
const c = pMap[i];
if (c === '4') cntDone++; else if (c === '3') cntPartial++; else if (c === '2') cntHigh++; else if (c === '1') cntQueue++;
}
const selP = window._torHubSelectedPieceV128;
let pieceDetailHtml = `<div style="font-size:10.5px;color:#8b949e;padding:6px 8px;background:#0d1117;border:1px solid #262c36;border-radius:8px;">👆 Нажми на любую ячейку части ниже, чтобы увидеть какие файлы лежат внутри неё.</div>`;
if (selP >= 0 && selP < nPieces) {
const stCode = pMap[selP];
const stLabel = stCode === '4' ? '🟩 Скачана (SHA-1 OK)' : (stCode === '3' ? '🟦 Качается сейчас' : (stCode === '2' ? '🟪 Приоритет конвейера' : (stCode === '1' ? '🟨 В очереди' : '⬛ Пропущена (не-аудио файл)')));
const allKnownFiles = dTor.all_files || dTor.files || [];
const matchingFiles = allKnownFiles.filter(f => f.begin_piece !== undefined && selP >= f.begin_piece && selP < f.end_piece);
const filesNames = matchingFiles.length
? matchingFiles.map(f => `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:3px;"><span style="color:${f.selected ? '#e6edf3' : '#8b949e'};font-size:11px;">${f.selected ? '🎵' : '📄'} ${String(f.path || '').split('/').pop()}</span><button type="button" onclick="window.controlTorrentJobV128('${dTor.hash}','boost_file',${f.index})" style="padding:2px 6px;font-size:9.5px;background:rgba(63,185,80,0.2);color:#3fb950;border:1px solid #3fb950;border-radius:5px;font-weight:bold;">⚡ Качать файл</button></div>`).join('')
: `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px;"><span style="color:#8b949e;font-size:10.5px;">Служебный блок раздачи</span><button type="button" onclick="window.controlTorrentJobV128('${dTor.hash}','boost_piece',${selP})" style="padding:2px 6px;font-size:9.5px;background:rgba(88,166,255,0.2);color:#58a6ff;border:1px solid #58a6ff;border-radius:5px;font-weight:bold;">⚡ Докачать часть #${selP}</button></div>`;
pieceDetailHtml = `<div style="padding:8px 10px;background:#0d131f;border:1px solid #58a6ff;border-radius:8px;"><div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:11.5px;font-weight:900;color:#79c0ff;">🧩 Часть #${selP} из ${nPieces} (${pLenMb} МБ) — ${stLabel}</span>${stCode !== '4' ? `<button type="button" onclick="window.controlTorrentJobV128('${dTor.hash}','boost_piece',${selP})" style="padding:2px 6px;font-size:9.5px;background:rgba(210,168,255,0.2);color:#d2a8ff;border:1px solid #d2a8ff;border-radius:5px;font-weight:bold;">⚡ Часть</button>` : ''}</div>${filesNames}</div>`;
}
const cells = [];
for (let i = 0; i < nPieces; i++) {
const c = pMap[i];
const bg = c === '4' ? '#2ea043' : (c === '3' ? '#39c5cf' : (c === '2' ? '#a371f7' : (c === '1' ? '#d29922' : '#161b22')));
cells.push(`<div onclick="window.selectPieceOnMapV128('${dTor.hash}',${i})" style="width:13px;height:13px;background:${bg};border:${i === selP ? '2px solid #fff' : '1px solid #090d14'};border-radius:2px;cursor:pointer;box-sizing:border-box;"></div>`);
}
bodyHtml = `<div style="font-size:12px;font-weight:900;color:#58a6ff;">💿 ${dTor.name}</div>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;font-size:10.5px;background:#0d1117;padding:7px 9px;border-radius:8px;border:1px solid #262c36;">
<div>🧩 Всего: <b>${nPieces} × ${pLenMb} МБ</b></div><div style="color:#3fb950;">🟩 Готово: <b>${cntDone}</b></div>
<div style="color:#39c5cf;">🟦 Качается: <b>${cntPartial}</b></div><div style="color:#a371f7;">🟪 Приоритет: <b>${cntHigh}</b></div>
<div style="color:#d29922;">🟨 Очередь: <b>${cntQueue}</b></div><div style="color:#8b949e;">⬛ Не-аудио: <b>${nPieces - cntDone - cntPartial - cntHigh - cntQueue}</b></div></div>
${pieceDetailHtml}
<div id="torHubPiecesGridBoxV129" style="max-height:250px;overflow-y:auto;padding:8px;background:#05070a;border:1px solid #30363d;border-radius:9px;display:flex;flex-wrap:wrap;gap:2px;">${cells.join('')}</div>`;
}
}

if (window._torHubHoldRenderUntilV163 && Date.now() < window._torHubHoldRenderUntilV163) { return; }
scrollBody.innerHTML = bodyHtml;
if (prevMainScroll > 0) scrollBody.scrollTop = prevMainScroll;
const newGrid = document.getElementById('torHubPiecesGridBoxV129');
if (newGrid && prevGridScroll > 0) newGrid.scrollTop = prevGridScroll;
};

window.refreshTorrentDaemonSnapV128 = async function() {
try {
window.mountTorrentHeaderHubMenuV128();
const d = await fetch('/api/torrent/status').then(r => r.json());
const list = (d && d.torrents) || [];
window._torLiveDaemonSnapV128 = list;
let activeCnt = 0, sumKbps = 0, sumReady = 0, sumTotal = 0;
list.forEach(t => {
const files = t.files || [];
if (files.some(f => !f.done) && !t.paused) activeCnt++;
sumKbps += (t.speed_kbps || 0);
sumReady += files.filter(f => f.done).length;
sumTotal += files.length;
const job = window._torMapV112 && window._torMapV112[t.hash];
if (job) {
job.speedKbps = t.speed_kbps || 0; job.totalPeers = t.total_peers || 0; job.paused = Boolean(t.paused);
if (files.length && job.files) {
files.forEach(df => {
const jf = job.files.find(x => Number(x.index) === Number(df.index));
if (jf) { jf.begin_piece = df.begin_piece; jf.end_piece = df.end_piece; }
});
}
}
});
const lbl = document.getElementById('lblTorHeaderHubMenuV128');
if (lbl) {
if (activeCnt > 0) lbl.innerText = `Активно: ${activeCnt} (${sumReady}/${sumTotal})${sumKbps > 0 ? ' • ⚡' + sumKbps + 'КБ/с' : ''} • Части`;
else if (list.length > 0) lbl.innerText = `Раздач: ${list.length} (${sumReady}/${sumTotal}) • Части`;
else lbl.innerText = `Раздачи • Треки • Части`;
}
if (document.getElementById('jennyTorInspectorModalV128')) window.renderTorrentInspectorHubV128();
} catch (e) {}
};

window._onTorWorkerAutoPush = function() {
    if (typeof window.refreshTorrentDaemonSnapV128 === 'function') {
        window.refreshTorrentDaemonSnapV128(true);
    }
};
setTimeout(window.mountTorrentHeaderHubMenuV128, 300);
if (window.TORRENT_FORMAT_TAGS_V101 && !window.TORRENT_FORMAT_TAGS_V101.some(t => t.id === 'video')) {
window.TORRENT_FORMAT_TAGS_V101.push(
{ id: 'video', label: '🎬 ВИДЕО', color: '#ff7b72' },
{ id: '1080p', label: '📽️ 1080p', color: '#ffa657' },
{ id: '2160p', label: '🔥 4K', color: '#f0883e' }
);
}

window.openTorHubFromVideoV130 = function(ev) {
if (window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
const st = window._vidStateV130; if (!st.torHash) return;
if (!st.pipMode) window.toggleVideoPipModeV130();
if (typeof window.toggleTorrentInspectorHubV128 === 'function') window.toggleTorrentInspectorHubV128(ev, 'pieces', st.torHash);
};

const _origPreviewTorV129 = window.previewTorrentFileStreamV97;
window.previewTorrentFileStreamV97 = async function(fileIdx, btnEl, ev) {
const ts = window._torStateV96, hash = ts ? ts.currentHash : '', job = (hash && window._torMapV112) ? window._torMapV112[hash] : null;
const fObj = ((job && job.files) || (ts && ts.files) || []).find(x => Number(x.index) === Number(fileIdx));
const pathStr = fObj ? String(fObj.path || '') : '';
if (hash && window.isVideoFileNameV130(pathStr)) {
if (ev && ev.stopPropagation) ev.stopPropagation();
window.openJennyVideoPlayerV130(`/api/torrent/stream/${hash}/${fileIdx}`, pathStr.split('/').pop() || pathStr, { torHash: hash, torFileIdx: Number(fileIdx) });
return;
}
return await _origPreviewTorV129.apply(this, arguments);
};

// Также собираем видео из живого снимка торрент-демона на клиенте, чтобы они были видны мгновенно!
window.collectClientTorrentVideosV137 = function() {
const map = Object.assign({}, window._dedicatedVideoMetaMapV137);
const snap = window._torLiveDaemonSnapV128 || [];
snap.forEach(tor => {
const h = tor.hash || '';
(tor.files || []).forEach(f => {
const p = String(f.path || f.name || '');
if (window.isVideoFileNameV130 && window.isVideoFileNameV130(p)) {
const bn = p.split('/').pop() || p;
if (!map[bn]) {
map[bn] = {
name: bn,
size_mb: Math.round((f.size || 0) / (1024 * 1024)),
percent: f.percent || 0,
tor_hash: h,
tor_file_idx: Number(f.index),
stream_url: `/api/torrent/stream/${h}/${f.index}`
};
}
}
});
});
return Object.values(map);
};

// === 🧠⚡ JENNY V139: HOT-SWAP SEARCH CORE SWITCHER UI & v3.6-ir CONFIG/LOG VIEWER ===
window._omniCoreStateV139 = {
active_core: localStorage.getItem('ytm_omni_active_core_v139') || 'v36ir',
cores: [
{ id: 'v36ir', title: '⚡ v3.6-ir Live Wave', port: 18999 },
{ id: 'classic', title: '🏛️ Classic Core', port: 18998 }
],
config: {
disable_logs: false,
enable_simple_log: true,
enable_trace_log: false,
enable_soundcloud: true,
enable_seeker_p2p: true
},
panelOpen: false
};

window.syncOmniCoreBackendV139 = async function(targetCoreId, triggerReSearch) {
try {
if (targetCoreId) {
window._omniCoreStateV139.active_core = targetCoreId;
localStorage.setItem('ytm_omni_active_core_v139', targetCoreId);
}
const res = await fetch('/api/omni/switch_core', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
core_id: window._omniCoreStateV139.active_core,
config: window._omniCoreStateV139.config
})
});
if (res.ok) {
const d = await res.json();
if (d.active_core) window._omniCoreStateV139.active_core = d.active_core;
window._omniCoreStateV139.alive = Boolean(d.alive);
window._omniCoreStateV139.port = d.port || 0;
window._omniCoreStateV139.version = d.version || '';
window._omniCoreStateV139.so_name = d.so_name || '';
}
const listRes = await fetch('/api/omni/cores');
if (listRes.ok) {
const ld = await listRes.json();
if (Array.isArray(ld.cores) && ld.cores.length) window._omniCoreStateV139.cores = ld.cores;
if (ld.active_core) window._omniCoreStateV139.active_core = ld.active_core;
window._omniCoreStateV139.alive = Boolean(ld.alive);
window._omniCoreStateV139.port = ld.port || 0;
window._omniCoreStateV139.version = ld.version || '';
window._omniCoreStateV139.so_name = ld.so_name || '';
if (ld.config) Object.assign(window._omniCoreStateV139.config, ld.config);
}
window.renderOmniCoreSwitcherBarV139();
if (triggerReSearch) {
const qInp = document.getElementById('torSearchInputV82') || document.querySelector('#torModal input[type="text"]');
if (qInp && qInp.value.trim().length > 0 && typeof window.runTorrentSearchV82 === 'function') {
window.runTorrentSearchV82();
}
}
} catch (e) {}
};

window.toggleOmniCoreFlagV139 = function(flagKey) {
const cfg = window._omniCoreStateV139.config;
cfg[flagKey] = !cfg[flagKey];
window.syncOmniCoreBackendV139(null, false);
};

window.openOmniLiveLogModalV139 = async function(logType) {
try {
const res = await fetch('/api/omni/logs_tail?type=' + encodeURIComponent(logType || 'simple'));
const data = await res.json();
let box = document.getElementById('jennyOmniLogViewerV139');
if (!box) {
box = document.createElement('div');
box.id = 'jennyOmniLogViewerV139';
box.style.cssText = 'position:fixed;inset:12px;z-index:2147483200;background:#090d14;border:1.5px solid #58a6ff;border-radius:14px;display:flex;flex-direction:column;padding:12px;box-shadow:0 0 35px rgba(0,0,0,0.95);';
document.body.appendChild(box);
}
box.innerHTML = `
<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:8px;border-bottom:1px solid #30363d;">
<b style="color:#58a6ff;font-size:12.5px;">📄 Лог ядра: ${logType === 'trace' ? 'omni_full_trace.log' : 'omni_simple.log'}</b>
<div style="display:flex;gap:6px;">
<button type="button" onclick="window.openOmniLiveLogModalV139('${logType}')" style="padding:4px 9px;border-radius:7px;background:#161b22;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;font-weight:bold;">🔄 Обновить</button>
<button type="button" onclick="document.getElementById('jennyOmniLogViewerV139').remove()" style="padding:4px 9px;border-radius:7px;background:#21262d;border:1px solid #f85149;color:#f85149;font-size:11px;font-weight:bold;">✖ Закрыть</button>
</div>
</div>
<pre style="flex:1;overflow:auto;margin:8px 0 0 0;padding:8px;background:#05070b;border:1px solid #21262d;border-radius:8px;color:#e6edf3;font-size:10.5px;line-height:1.38;white-space:pre-wrap;word-break:break-word;">${(data.text || '').replace(/</g, '&lt;')}</pre>
`;
} catch (e) {}
};

window.renderOmniCoreSwitcherBarV139 = function() {
const st = window._omniCoreStateV139;
if (!st) return;
const cfg = st.config || {};

const buildBarInner = () => {
const chipsHtml = (st.cores || []).map(c => {
const isAct = (c.id === st.active_core);
return `<button type="button" onclick="window.syncOmniCoreBackendV139('${c.id}', true)" style="padding:4px 9px;border-radius:8px;font-size:11px;font-weight:800;border:1.5px solid ${isAct ? '#3fb950' : '#30363d'};background:${isAct ? 'rgba(63,185,80,0.18)' : '#161b22'};color:${isAct ? '#3fb950' : '#8b949e'};">${c.title}</button>`;
}).join('');

const cfgPanelHtml = st.panelOpen ? `
<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding-top:6px;border-top:1px dashed #21262d;">
<button type="button" onclick="window.toggleOmniCoreFlagV139('enable_soundcloud')" style="padding:3px 7px;border-radius:7px;font-size:10.5px;border:1px solid ${cfg.enable_soundcloud ? '#ff7b72' : '#30363d'};background:#0d1117;color:${cfg.enable_soundcloud ? '#ff7b72' : '#8b949e'};">☁️ SC 10 слотов: ${cfg.enable_soundcloud ? 'ВКЛ' : 'ВЫКЛ'}</button>
<button type="button" onclick="window.toggleOmniCoreFlagV139('enable_seeker_p2p')" style="padding:3px 7px;border-radius:7px;font-size:10.5px;border:1px solid ${cfg.enable_seeker_p2p ? '#58a6ff' : '#30363d'};background:#0d1117;color:${cfg.enable_seeker_p2p ? '#58a6ff' : '#8b949e'};">🐦 Seeker P2P: ${cfg.enable_seeker_p2p ? 'ВКЛ' : 'ВЫКЛ'}</button>
<button type="button" onclick="window.toggleOmniCoreFlagV139('enable_simple_log')" style="padding:3px 7px;border-radius:7px;font-size:10.5px;border:1px solid ${cfg.enable_simple_log ? '#d2a8ff' : '#30363d'};background:#0d1117;color:${cfg.enable_simple_log ? '#d2a8ff' : '#8b949e'};">📝 Simple Log: ${cfg.enable_simple_log ? 'ВКЛ' : 'ВЫКЛ'}</button>
<button type="button" onclick="window.toggleOmniCoreFlagV139('enable_trace_log')" style="padding:3px 7px;border-radius:7px;font-size:10.5px;border:1px solid ${cfg.enable_trace_log ? '#e3b341' : '#30363d'};background:#0d1117;color:${cfg.enable_trace_log ? '#e3b341' : '#8b949e'};">🔬 Trace Log: ${cfg.enable_trace_log ? 'ВКЛ' : 'ВЫКЛ'}</button>
<button type="button" onclick="window.toggleOmniCoreFlagV139('disable_logs')" style="padding:3px 7px;border-radius:7px;font-size:10.5px;border:1px solid ${cfg.disable_logs ? '#f85149' : '#30363d'};background:#0d1117;color:${cfg.disable_logs ? '#f85149' : '#8b949e'};">🚫 No-Logs: ${cfg.disable_logs ? 'ВКЛ' : 'ВЫКЛ'}</button>
<button type="button" onclick="window.openOmniLiveLogModalV139('simple')" style="padding:3px 8px;border-radius:7px;font-size:10.5px;border:1px solid #58a6ff;background:#161b22;color:#58a6ff;font-weight:bold;">👁️ Simple</button>
<button type="button" onclick="window.openOmniLiveLogModalV139('trace')" style="padding:3px 8px;border-radius:7px;font-size:10.5px;border:1px solid #e3b341;background:#161b22;color:#e3b341;font-weight:bold;">🔬 Trace</button>
</div>` : '';

return `
<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
<span style="font-size:11px;color:#8b949e;font-weight:bold;">🧠 Ядро P2P:</span>
${chipsHtml}
</div>
<button type="button" onclick="window._omniCoreStateV139.panelOpen=!window._omniCoreStateV139.panelOpen;window.renderOmniCoreSwitcherBarV139();" style="padding:4px 8px;border-radius:8px;font-size:10.5px;border:1px solid ${st.alive ? '#58a6ff' : '#f85149'};background:#161b22;color:${st.alive ? '#58a6ff' : '#f85149'};font-weight:bold;">⚙️ ${(st.cores.find(x=>x.id===st.active_core)||{}).title || st.active_core} [${st.alive ? '🟢' : '🔴'} :${st.port || '?'}${st.version ? ' v'+st.version : ''}] ${st.panelOpen ? '▴' : '▾'}</button>
</div>
${cfgPanelHtml}`;
};

const candidates = [
document.getElementById('torSearchInputV82'),
document.getElementById('torrentSearchInput'),
document.getElementById('torQueryInput'),
...Array.from(document.querySelectorAll('input[type="text"], input[type="search"]')).filter(el => {
const ph = (el.placeholder || '').toLowerCase();
const id = (el.id || '').toLowerCase();
return id.includes('tor') || id.includes('omni') || ph.includes('торрент') || ph.includes('rutor') || ph.includes('magnet') || ph.includes('раздач');
})
].filter(Boolean);

if (candidates.length > 0) {
const qInp = candidates[0];
const hostRow = qInp.parentElement;
const modalContainer = hostRow ? hostRow.parentElement : null;
if (modalContainer) {
let bar = document.getElementById('jennyOmniCoreSwitcherBarV139');
if (!bar) {
bar = document.createElement('div');
bar.id = 'jennyOmniCoreSwitcherBarV139';
bar.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin:6px 0 8px 0;padding:7px 9px;background:linear-gradient(135deg,#0b1019,#111824);border:1px solid #30363d;border-radius:11px;';
modalContainer.insertBefore(bar, hostRow);
}
bar.innerHTML = buildBarInner();
}
}

const settingsModal = document.getElementById('settingsModal');
if (settingsModal) {
let sBar = document.getElementById('jennyOmniCoreSettingsBoxV139');
if (!sBar) {
sBar = document.createElement('div');
sBar.id = 'jennyOmniCoreSettingsBoxV139';
sBar.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin:10px 0;padding:9px 11px;background:linear-gradient(135deg,#0b1019,#111824);border:1.5px solid #58a6ff;border-radius:12px;';
const firstChild = settingsModal.querySelector('div') || settingsModal;
firstChild.insertBefore(sBar, firstChild.firstChild);
}
sBar.innerHTML = buildBarInner();
}
};

setTimeout(() => window.syncOmniCoreBackendV139(null, false), 600);
setInterval(() => {
if (!document.getElementById('jennyOmniCoreSwitcherBarV139') || !document.getElementById('jennyOmniCoreSettingsBoxV139')) {
window.renderOmniCoreSwitcherBarV139();
}
}, 1500);

window.nukeAllTorrentsV142 = async function() {
    try {
        const res = await fetch('/api/torrent/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'drop_all' })
        }).then(r => r.json());
        window._torMapV112 = {};
        window._torSnapshotsByHashV108 = {};
        window._torLiveDaemonSnapV128 = [];
        if (window._torStateV96) {
            window._torStateV96.currentHash = '';
            window._torStateV96.dlActive = false;
        }
        window.renderTorrentInspectorHubV128();
        if (typeof window.showToast === 'function') {
            window.showToast('🧹 Все раздачи и кэш удалены с диска (' + (res.freed_mb || 0) + ' МБ освобождено)');
        }
        if (typeof window.syncDiscoveredVideosIntoPlaylistV134 === 'function') {
            window.syncDiscoveredVideosIntoPlaylistV134(true);
        }
    } catch (e) {}
};

// === 🎯🛑 JENNY V143: STREAM AUTO-CLEANUP, EXPLICIT DOWNLOADS & UI RESET ON DELETE ===
/* [split] V143: кусок исходного IIFE (ui_v71.js, строки 11521–11833) → ui_torrent.js */
;(function() {
// 1. Очищает экран открытой раздачи в Торрент-студии (сбрасывает старые проценты 82% и кнопку "Загрузка сети" после удаления/остановки)
window.resetOpenTorrentScreenUI_V143 = function(targetHash) {
    const ts = window._torStateV96 || {};
    if (targetHash && ts.currentHash && ts.currentHash.toLowerCase() !== targetHash.toLowerCase()) return;

    ts.dlActive = false;
    ts.dlOverallPct = 0;
    ts.activeDlSet = new Set();

    const h = ts.currentHash;
    if (h && window._torMapV112 && window._torMapV112[h]) {
        const job = window._torMapV112[h];
        job.dlActive = false;
        job.completedAll = false;
        job.netPct = 0;
        job.readyCnt = 0;
        job.targetSet = new Set();
        job.explicitDlSet = new Set();
        job.fileStatusMap = {};
    }

    const totWrap = document.getElementById('torTotalProgWrapV97');
    const totFill = document.getElementById('torTotalProgFillV97');
    if (totWrap) totWrap.style.display = 'none';
    if (totFill) totFill.style.width = '0%';

    const encWrap = document.getElementById('torXflacProgWrapV99');
    if (encWrap) encWrap.style.display = 'none';

    (ts.files || []).forEach(f => {
        const fIdx = Number(f.index);
        const rowEl = document.getElementById('torFileRowV96_' + fIdx);
        const pEl = document.getElementById('torFileProgV96_' + fIdx);
        const dlBtn = document.getElementById('torDlSingleBtnV98_' + fIdx);
        const mb = ((f.length || 0) / (1024 * 1024)).toFixed(1);
        if (rowEl) {
            rowEl.style.background = '#0b0f16';
            rowEl.style.borderColor = '#21262d';
        }
        if (pEl) {
            pEl.innerText = `💾 ${mb} MB • ▶ Поток / ⬇️ Скачать`;
        }
        if (dlBtn) {
            dlBtn.innerText = '⬇️';
            dlBtn.style.color = '#3fb950';
        }
    });

    const btn = document.getElementById('btnTorStartDlV97');
    if (btn) {
        btn.disabled = false;
        btn.style.background = 'linear-gradient(135deg, #8957e5, #238636)';
        const hasLossless = window.torrentHasLosslessFilesV106 ? window.torrentHasLosslessFilesV106(ts.files || []) : false;
        btn.innerText = hasLossless ? '⬇️ Качать выбранные (➔ xFLAC)' : '⬇️ Качать выбранные в плеер';
    }
    const stEl = document.getElementById('torStatusLineV96');
    if (stEl) {
        stEl.innerText = `💿 ${ts.currentName || 'Раздача'} (треков: ${(ts.files || []).length}) • Остановлена / Очищена`;
    }
};

// 2. Автоматическая остановка потока и удаление временного кэша, если трек только прослушивался через ▶ (не качался через ⬇️)
window._activeStreamSessionV143 = null; // { hash, fileIdx }

window.cleanupActiveTorrentStreamV143 = async function(reason) {
    const sess = window._activeStreamSessionV143;
    if (!sess || !sess.hash) return;
    window._activeStreamSessionV143 = null;

    const h = sess.hash;
    const fIdx = sess.fileIdx;
    const job = window._torMapV112 && window._torMapV112[h];
    const isExplicit = Boolean(job && job.explicitDlSet && job.explicitDlSet.has(Number(fIdx)));

    if (!isExplicit) {
        try {
            const res = await fetch('/api/torrent/stream_stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hash: h, file_index: fIdx })
            }).then(r => r.json());
            if (res && res.dropped_torrent) {
                window.resetOpenTorrentScreenUI_V143(h);
                if (res.cleaned_mb > 0 && typeof window.showToast === 'function' && reason === 'manual') {
                    window.showToast(`🛑 Поток остановлен, временный кэш удалён (${res.cleaned_mb} МБ)`);
                }
            } else if (job && job.fileStatusMap) {
                delete job.fileStatusMap[Number(fIdx)];
                if (job.targetSet) job.targetSet.delete(Number(fIdx));
            }
            if (typeof window.refreshTorrentDaemonSnapV128 === 'function') {
                window.refreshTorrentDaemonSnapV128();
            }
        } catch (e) {}
    }
};

// Перехватываем запуск потока ▶ (previewTorrentFileStreamV97):
// перед стартом нового потока чистим предыдущий временный поток и запоминаем новый
const _origPreviewStreamV143 = window.previewTorrentFileStreamV97;
window.previewTorrentFileStreamV97 = async function(fileIdx, btnEl, ev) {
    const ts = window._torStateV96 || {};
    const h = ts.currentHash || '';
    if (window._activeStreamSessionV143 && (window._activeStreamSessionV143.hash !== h || window._activeStreamSessionV143.fileIdx !== Number(fileIdx))) {
        await window.cleanupActiveTorrentStreamV143('switch');
    }
    if (h) {
        window._activeStreamSessionV143 = { hash: h, fileIdx: Number(fileIdx) };
    }
    return await _origPreviewStreamV143.apply(this, arguments);
};

// 3. Индивидуальная кнопка ⬇️ качает СТРОГО нажатый трек (снимая дефолтное выделение со всех 43 треков, даже если уже шел поток ▶!)
window.downloadSingleTorrentTrackV98 = async function(fileIdx, btnEl, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const h = window._torStateV96 && window._torStateV96.currentHash;
    const job = h ? window._torMapV112[h] : null;
    if (!job) return;
    const cleanIdx = Number(fileIdx);
    if (!job.validIdxSet.has(cleanIdx)) return;

    job.explicitDlSet = job.explicitDlSet || new Set();
    // Если это первое явное нажатие ⬇️ в этой раздаче — сбрасываем дефолтные 43 галочки, чтобы качался ТОЛЬКО выбранный трек!
    if (job.explicitDlSet.size === 0) {
        job.selectedFiles.clear();
        job.targetSet.clear();
        document.querySelectorAll('#torBodyListV96 input[type="checkbox"]').forEach(c => { c.checked = false; });
    }

    job.explicitDlSet.add(cleanIdx);
    job.selectedFiles.add(cleanIdx);
    job.targetSet.add(cleanIdx);
    job.dlActive = true;
    job.completedAll = false;

    const chk = document.querySelector(`#torFileRowV96_${cleanIdx} input[type="checkbox"]`);
    if (chk) chk.checked = true;
    if (typeof window.updateTorrentSelectAllBtnUIV117 === 'function') window.updateTorrentSelectAllBtnUIV117();
    if (btnEl) { btnEl.innerText = '⏳'; btnEl.style.color = '#3fb950'; }

    // Если этот трек уже успел докачаться во время потокового прослушивания ▶ — сразу импортируем его в плеер!
    const fSt = job.fileStatusMap && job.fileStatusMap[cleanIdx];
    const fMeta = (job.files || []).find(x => Number(x.index) === cleanIdx);
    if (fSt && fSt.done && !fSt.xflac_file) {
        window.enqueueTorrentTrackImportV112(job, { index: cleanIdx, full_path: fSt.full_path || (fMeta && fMeta.full_path) || '' }, job.name);
    }

    await fetch('/api/torrent/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: job.hash, files: Array.from(job.explicitDlSet), explicit: true })
    }).catch(() => {});
    window.ensureMultiTorrentWorkerV112();
};

// 4. Нижняя кнопка «⬇️ Качать выбранные» помечает все отмеченные галочками треки как явные закачки (explicitDlSet)
window.startSelectedTorrentDownloadV96 = async function(explicitFiles) {
    const h = window._torStateV96 && window._torStateV96.currentHash;
    const job = h ? window._torMapV112[h] : null;
    if (!job) return;
    job.explicitDlSet = job.explicitDlSet || new Set();

    const sel = Array.isArray(explicitFiles) && explicitFiles.length > 0
        ? explicitFiles.map(Number)
        : Array.from(job.selectedFiles || []).map(Number);
    const validSel = sel.filter(x => job.validIdxSet.has(x));
    if (!validSel.length) {
        if (typeof window.showToast === 'function') window.showToast('⚠️ Отметь галочкой хотя бы один трек');
        return;
    }

    validSel.forEach(idx => {
        job.explicitDlSet.add(idx);
        job.targetSet.add(idx);
    });
    job.dlActive = true;
    job.completedAll = false;

    await fetch('/api/torrent/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: job.hash, files: Array.from(job.explicitDlSet), explicit: true })
    }).catch(() => {});
    window.paintOpenedTorrentJobProgressV112(job, null);
    window.ensureMultiTorrentWorkerV112();
};

// 5. Запрещаем авто-импорт в медиатеку тех треков, которые были запущены только через ▶ (без нажатия ⬇️)!
const _origEnqueueImportV143 = window.enqueueTorrentTrackImportV112;
window.enqueueTorrentTrackImportV112 = function(job, fObj, torName) {
    const fIdx = Number(fObj && fObj.index);
    const isExplicit = Boolean((fObj && fObj.explicit_dl) || (job && job.explicitDlSet && job.explicitDlSet.has(fIdx)));
    if (!isExplicit) {
        // Трек только играл в потоке ▶ — не засоряем им медиатеку плеера!
        return;
    }
    return _origEnqueueImportV143.apply(this, arguments);
};

// 6. Кнопки «⏹ Стоп» и «🗑️ Удалить» для текущей открытой раздачи + сброс экрана при удалении из Центра закачек
window.stopCurrentOpenTorrentV143 = async function() {
    const h = window._torStateV96 && window._torStateV96.currentHash;
    if (!h) return;
    window.stopAllExternalStreamsV97();
    const res = await fetch('/api/torrent/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: h, action: 'stop_or_pause' })
    }).then(r => r.json()).catch(() => ({}));

    if (res.mode === 'stream_cleaned') {
        window.resetOpenTorrentScreenUI_V143(h);
        if (typeof window.showToast === 'function') {
            window.showToast(`🛑 Поток остановлен, временные данные удалены (${res.freed_mb || 0} МБ)`);
        }
    } else {
        const job = window._torMapV112 && window._torMapV112[h];
        if (job) { job.paused = true; job.dlActive = false; }
        const btn = document.getElementById('btnTorStartDlV97');
        if (btn) {
            btn.disabled = false;
            btn.innerText = '▶️ Продолжить закачку выбранных';
        }
        if (typeof window.showToast === 'function') {
            window.showToast('⏸ Закачка поставлена на паузу (кэш сохранён для докачки)');
        }
    }
    if (typeof window.refreshTorrentDaemonSnapV128 === 'function') window.refreshTorrentDaemonSnapV128();
};

window.deleteCurrentOpenTorrentV143 = async function() {
    const h = window._torStateV96 && window._torStateV96.currentHash;
    if (!h) return;
    window.stopAllExternalStreamsV97();
    await window.controlTorrentJobV128(h, 'drop');
    window.resetOpenTorrentScreenUI_V143(h);
};

// При любом вызове controlTorrentJobV128(hash, 'drop') или nukeAllTorrentsV142 сбрасываем экран Торрент-студии!
const _origCtrlJobV143 = window.controlTorrentJobV128;
window.controlTorrentJobV128 = async function(hash, action, idxVal) {
    if (action === 'drop') {
        window.stopAllExternalStreamsV97();
    }
    const r = await _origCtrlJobV143.apply(this, arguments);
    if (action === 'drop') {
        window.resetOpenTorrentScreenUI_V143(hash);
    }
    return r;
};

const _origNukeAllV143 = window.nukeAllTorrentsV142;
window.nukeAllTorrentsV142 = async function() {
    window.stopAllExternalStreamsV97();
    const r = await _origNukeAllV143.apply(this, arguments);
    window.resetOpenTorrentScreenUI_V143('');
    return r;
};

// Добавляем кнопки «⏹ Стоп» и «🗑️» прямо в футер открытой раздачи (#torFooterBarV96)
const _origRenderFilesV143 = window.renderTorrentFilesListV96;
window.renderTorrentFilesListV96 = function() {
    _origRenderFilesV143.apply(this, arguments);
    const ftr = document.getElementById('torFooterBarV96');
    if (ftr && !document.getElementById('btnTorStopStreamOrDlV143')) {
        const btnRow = ftr.lastElementChild;
        if (btnRow) {
            const stopBtn = document.createElement('button');
            stopBtn.type = 'button';
            stopBtn.id = 'btnTorStopStreamOrDlV143';
            stopBtn.title = 'Остановить (удалит кэш если был только поток ▶, или поставит на паузу если качалось ⬇️)';
            stopBtn.onclick = () => window.stopCurrentOpenTorrentV143();
            stopBtn.style.cssText = 'padding:8px 9px;background:#161b22;color:#e3b341;border:1px solid #e3b341;border-radius:8px;font-weight:bold;font-size:11px;flex-shrink:0;';
            stopBtn.innerText = '⏹ Стоп';

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.id = 'btnTorDeleteFullV143';
            delBtn.title = 'Остановить и полностью удалить все файлы этой раздачи с диска';
            delBtn.onclick = () => window.deleteCurrentOpenTorrentV143();
            delBtn.style.cssText = 'padding:8px 9px;background:rgba(248,81,73,0.16);color:#ff7b72;border:1px solid #f85149;border-radius:8px;font-weight:bold;font-size:11px;flex-shrink:0;';
            delBtn.innerText = '🗑️';

            btnRow.appendChild(stopBtn);
            btnRow.appendChild(delBtn);
        }
    }
};
})();

// === 🛠️🎯 JENNY V145: FIX STREAM SELF-KILL, FOOTER 2-ROW LAYOUT, MINI-PLAYER TITLE & PIP BOUNDS ===
/* [split] V145: кусок исходного IIFE (ui_v71.js, строки 11870–12008) → ui_torrent.js */
;(function() {
// 1. CSS: Запрещаем посимвольный перенос внутри кнопок (чтобы "Качать выбранные" не плющило в столбик "Ка-ча")
// и делаем название трека в мини-плеере на всю ширину верхней строкой!
const styleId = 'jennyV145LayoutFixes';

// 2. Убираем самосброс потока при вызове previewTorrentFileStreamV97:
// Пока идет запуск или авто-повтор (attempt 1..6) потока ▶, stopAllExternalStreamsV97 НЕ должна убивать раздачу в демоне!
window._startingTorStreamLockV145 = false;

const _prevCleanupStreamV143 = window.cleanupActiveTorrentStreamV143;
window.cleanupActiveTorrentStreamV143 = async function(reason) {
    if (window._startingTorStreamLockV145 && reason === 'stop') {
        return;
    }
    return await _prevCleanupStreamV143.apply(this, arguments);
};

// Переопределяем previewTorrentFileStreamV97 с защитой _startingTorStreamLockV145 и передачей magnet для реанимации после 🗑️
const _basePreviewStreamV129 = window._origPreviewStreamV143 || window.previewTorrentFileStreamV97;
window.previewTorrentFileStreamV97 = async function(fileIdx, btnEl, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const ts = window._torStateV96 || {};
    const h = ts.currentHash || '';
    const prevSess = window._activeStreamSessionV143;

    // Если раньше играл поток из ДРУГОЙ раздачи — чистим старую раздачу, но если та же самая раздача — НЕ трогаем демон!
    if (prevSess && prevSess.hash && prevSess.hash !== h) {
        await window.cleanupActiveTorrentStreamV143('switch_torrent');
    }

    window._startingTorStreamLockV145 = true;
    window._activeStreamSessionV143 = h ? { hash: h, fileIdx: Number(fileIdx) } : null;
    try {
        return await _basePreviewStreamV129.apply(this, arguments);
    } finally {
        setTimeout(() => { window._startingTorStreamLockV145 = false; }, 400);
    }
};

// 3. При нажатии ⬇️ (одиночной или нижней кнопки) передаем также сохраненный magnet раздачи,
// чтобы даже после нажатия 🗑️ раздача мгновенно оживала в демоне без ошибки 0/0!
const _prevSingleDlV143 = window.downloadSingleTorrentTrackV98;
window.downloadSingleTorrentTrackV98 = async function(fileIdx, btnEl, ev) {
    const h = window._torStateV96 && window._torStateV96.currentHash;
    const job = h && window._torMapV112 ? window._torMapV112[h] : null;
    if (job && job.magnet) {
        fetch('/api/torrent/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hash: job.hash, magnet: job.magnet, files: [Number(fileIdx)], explicit: true })
        }).catch(() => {});
    }
    return await _prevSingleDlV143.apply(this, arguments);
};

// 4. Аккуратная 2-рядная нижняя панель #torFooterBarV96 в Торрент-студии (ни одна кнопка не плющится!)
const _prevRenderTorFilesV143 = window.renderTorrentFilesListV96;
window.renderTorrentFilesListV96 = function() {
    _prevRenderTorFilesV143.apply(this, arguments);
    const ftr = document.getElementById('torFooterBarV96');
    if (!ftr) return;

    const hasLossless = window.torrentHasLosslessFilesV106 ? window.torrentHasLosslessFilesV106() : false;
    const selSet = window.getActiveTorrentSelectSetV117 ? window.getActiveTorrentSelectSetV117() : new Set();
    const hasSel = selSet.size > 0;

    ftr.style.cssText = 'display:flex;flex-direction:column;padding:8px 12px;border-top:1px solid #21262d;background:#090c10;gap:6px;';
    ftr.innerHTML = `
        <div id="torXflacProgWrapV99" style="display:none;flex-direction:column;gap:2px;width:100%;">
            <div id="torXflacProgLabelV99" style="font-size:10px;color:#3fb950;font-weight:bold;">🧬 Пережатие в xFLAC: 0%</div>
            <div style="width:100%;height:7px;background:#161b22;border-radius:6px;overflow:hidden;border:1px solid #3fb950;">
                <div id="torXflacProgFillV99" style="width:0%;height:100%;background:linear-gradient(90deg,#3fb950,#58a6ff);transition:width 0.2s ease;"></div>
            </div>
        </div>
        <div id="torTotalProgWrapV97" style="display:none;width:100%;height:8px;background:#161b22;border-radius:6px;overflow:hidden;border:1px solid #30363d;">
            <div id="torTotalProgFillV97" style="width:0%;height:100%;background:linear-gradient(90deg,#8957e5,#3fb950);transition:width 0.3s ease;"></div>
        </div>
        <div style="display:flex;gap:6px;width:100%;align-items:center;">
            <button type="button" onclick="window.backToTorrentSearchListV97()" style="flex:1;padding:7px 8px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;border-radius:8px;font-weight:bold;font-size:11px;">⬅ Раздачи</button>
            <button type="button" id="btnTorToggleAllV117" onclick="window.toggleSelectAllTorrentFilesV117(event)" style="flex:1;padding:7px 8px;background:${hasSel ? '#161b22' : 'rgba(63,185,80,0.16)'};color:${hasSel ? '#8b949e' : '#3fb950'};border:1px solid ${hasSel ? '#30363d' : '#3fb950'};border-radius:8px;font-weight:bold;font-size:11px;">${hasSel ? '☐ Снять все' : '☑️ Выбрать все'}</button>
            <button type="button" id="btnTorStopStreamOrDlV143" onclick="window.stopCurrentOpenTorrentV143()" style="padding:7px 10px;background:#161b22;color:#e3b341;border:1px solid #e3b341;border-radius:8px;font-weight:bold;font-size:11px;">⏹ Стоп</button>
            <button type="button" id="btnTorDeleteFullV143" onclick="window.deleteCurrentOpenTorrentV143()" style="padding:7px 10px;background:rgba(248,81,73,0.16);color:#ff7b72;border:1px solid #f85149;border-radius:8px;font-weight:bold;font-size:11px;">🗑️</button>
        </div>
        <button type="button" id="btnTorStartDlV97" onclick="window.startSelectedTorrentDownloadV96()" style="width:100%;padding:9px 12px;background:linear-gradient(135deg,#8957e5,#238636);color:#fff;border:none;border-radius:8px;font-weight:bold;font-size:12px;">
            ${hasLossless ? '⬇️ Качать выбранные (➔ xFLAC)' : '⬇️ Качать выбранные в плеер (Прямой формат)'}
        </button>
    `;
};
})();

window._p2pCompareStateV163 = window._p2pCompareStateV163 || {};

window.addP2pCompareFileToPlayerV162 = async function(trackName, mode, btnEl, torHash, torIdx) {
    if (!trackName) return;
    window._torHubHoldRenderUntilV163 = Date.now() + 2500;
    const stateKey = (torHash !== undefined && torIdx !== undefined) ? `${torHash}_${torIdx}_${mode}` : `${trackName}_${mode}`;
    if (window._p2pCompareStateV163[stateKey] === 'busy') return;
    window._p2pCompareStateV163[stateKey] = 'busy';

    const origLabel = btnEl ? btnEl.innerHTML : '';
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = (mode === 'wav') ? '⏳ Конвертация...' : '⏳ Добавляю...';
        btnEl.style.opacity = '0.75';
    }
    try {
        const res = await fetch('/api/p2p/add_compare_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: trackName,
                mode: mode,
                hash: torHash || (window._torStateV96 && window._torStateV96.currentHash) || '',
                index: (torIdx !== undefined) ? torIdx : -1
            })
        });
        const data = await res.json();
        window._torHubHoldRenderUntilV163 = 0;
        if (data && data.status === 'ok') {
            window._p2pCompareStateV163[stateKey] = 'done';
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = (mode === 'orig') ? '✅ Ориг в плеере' : '✅ WAV в плеере';
                btnEl.style.borderColor = '#3fb950';
                btnEl.style.background = 'rgba(63,185,80,0.22)';
                btnEl.style.color = '#3fb950';
                btnEl.style.opacity = '1';
            }
            if (typeof window.showToast === 'function') {
                window.showToast('✅ Добавлен в плеер: ' + data.added_file + (data.size_mb ? ' (' + data.size_mb + ' МБ)' : ''));
            }
            if (typeof window.fetchData === 'function') {
                await window.fetchData();
            }
            if (typeof window.renderPlaylistStripChipsV71 === 'function') {
                window.renderPlaylistStripChipsV71();
            }
            if (typeof window.renderActivePlaylistTracksV71 === 'function') {
                window.renderActivePlaylistTracksV71(false);
            }
        } else {
            delete window._p2pCompareStateV163[stateKey];
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = origLabel || ((mode === 'orig') ? '📥 Добавить ориг' : '💿 Добавить WAV');
                btnEl.style.opacity = '1';
            }
            const errMsg = (data && data.error) || 'Не удалось добавить файл';
            if (typeof window.showToast === 'function') {
                window.showToast('❌ ' + errMsg);
            } else {
                alert('Ошибка: ' + errMsg);
            }
        }
    } catch (e) {
        window._torHubHoldRenderUntilV163 = 0;
        delete window._p2pCompareStateV163[stateKey];
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = origLabel || ((mode === 'orig') ? '📥 Добавить ориг' : '💿 Добавить WAV');
            btnEl.style.opacity = '1';
        }
        if (typeof window.showToast === 'function') {
            window.showToast('❌ Ошибка сети: ' + e);
        } else {
            alert('Ошибка сети: ' + e);
        }
    }
};
/* ================= END JENNY V211 ================= */

/* ================= JENNY V212 (#301): INSTANT TORRENT STREAM, UNIFIED VIDEO PLAYER SEEKBAR SYNCED WITH DECK B, NO AUDIO-ON-BUFFERING & 24/7 FOREGROUND SERVICE ================= */
/* [split] V212: кусок исходного IIFE (ui_v71.js, строки 17929–18897) → ui_torrent.js */
;(function() {
    if (window._jennyV212Installed__torrent) return;
    window._jennyV212Installed__torrent = true;
    window._jennyV212Installed = true;

    window._torMaxProgressMapV212 = window._torMaxProgressMapV212 || {};

    // 6. Фикс отката прогресса без залипания "P2P:50%" после остановки/сброса (V214)
    window.clearTorMonotonicCacheV214 = function(hash) {
        if (!window._torMaxProgressMapV212) return;
        if (!hash) {
            window._torMaxProgressMapV212 = {};
            return;
        }
        var prefix = String(hash).toLowerCase() + '_';
        Object.keys(window._torMaxProgressMapV212).forEach(function(k) {
            if (k.indexOf(prefix) === 0) delete window._torMaxProgressMapV212[k];
        });
    };

    window.clampTorrentFileMonotonicV212 = function(hash, fObj) {
        if (!fObj) return fObj;
        var h = String(hash || '').toLowerCase();
        var idx = Number(fObj.index || 0);
        var key = h + '_' + idx;
        var rawComp = Number(fObj.completed || 0);
        var len = Number(fObj.length || fObj.size || 0);
        var rawDone = Boolean(fObj.done || fObj.xflac_file || (len > 0 && rawComp >= len));

        // Если торрент остановлен/сброшен и на диске 0 байт — не рисуем фантомные 50%!
        if (rawComp <= 0 && !rawDone) {
            delete window._torMaxProgressMapV212[key];
            fObj.completed = 0;
            fObj.percent = 0;
            fObj.done = false;
            return fObj;
        }

        var prev = window._torMaxProgressMapV212[key] || { completed: 0, percent: 0, done: false, xflac_file: '' };
        var comp = Math.max(prev.completed, rawComp);
        var isDone = Boolean(prev.done || rawDone || (len > 0 && comp >= len));
        if (isDone && len > 0) comp = len;

        var pct = isDone ? 100 : (len > 0 ? Math.min(99, Math.floor((comp * 100) / len)) : 0);
        if (!isDone && pct < prev.percent) pct = Math.min(99, prev.percent);

        var fnName = String(fObj.path || fObj.full_path || '').split('/').pop();
        var isDirectMedia = /\.(mp4|mkv|webm|avi|mov|m4v|3gp|mp3|m4a|ogg|opus|aac)$/i.test(fnName);
        var readyFile = fObj.xflac_file || prev.xflac_file || (isDone && isDirectMedia ? fnName : '');

        var updated = {
            completed: comp,
            percent: pct,
            done: isDone,
            xflac_file: readyFile
        };
        window._torMaxProgressMapV212[key] = updated;

        fObj.completed = comp;
        fObj.percent = pct;
        fObj.done = isDone;
        if (readyFile) fObj.xflac_file = readyFile;
        return fObj;
    };

    var _origRefreshSnapV128 = window.refreshTorrentDaemonSnapV128;
    window.refreshTorrentDaemonSnapV128 = async function(fromWorkerPush) {
        try {
            window.mountTorrentHeaderHubMenuV128();
            var d = null;
            if (fromWorkerPush && window._latestTorWorkerSnap && window._latestTorWorkerSnap.statusObj) {
                d = window._latestTorWorkerSnap.statusObj;
            } else if (typeof window.requestTorrentWorkerSnapshot === 'function') {
                d = await window.requestTorrentWorkerSnapshot(350);
            }
            if (!d) {
                d = await fetch('/api/torrent/status').then(function(r) { return r.json(); });
            }
            var list = (d && d.torrents) || [];
            list.forEach(function(t) {
                var h = String(t.hash || '').toLowerCase();
                var job = window._torMapV112 && window._torMapV112[h];
                var sumLen = 0, sumDone = 0, readyCnt = 0, allDone = true;

                (t.files || []).forEach(function(f) {
                    window.clampTorrentFileMonotonicV212(h, f);
                    var fIdx = Number(f.index);
                    if (job && job.validIdxSet && job.validIdxSet.has(fIdx)) {
                        var prevSt = (job.fileStatusMap && job.fileStatusMap[fIdx]) || {};
                        var readyFile = f.xflac_file || prevSt.xflac_file || '';
                        job.fileStatusMap[fIdx] = {
                            completed: f.completed || 0,
                            length: f.length || 0,
                            percent: f.percent || 0,
                            done: Boolean(f.done),
                            full_path: f.full_path || '',
                            xflac_file: readyFile
                        };
                        if (job.targetSet && job.targetSet.has(fIdx)) {
                            sumLen += (f.length || 0);
                            sumDone += (f.completed || 0);
                            if (!f.done) allDone = false;
                            if (readyFile) readyCnt++;
                            else if (f.done) {
                                window.enqueueTorrentTrackImportV112(job, f, t.name);
                            }
                        }
                    }
                });

                if (job) {
                    job.seeders = t.seeders || 0;
                    job.peers = t.peers || 0;
                    job.speedKbps = t.speed_kbps || 0;
                    job.totalPeers = t.total_peers || 0;
                    job.paused = Boolean(t.paused);
                    job.readyCnt = readyCnt;
                    if (job.targetSet && job.targetSet.size > 0) {
                        var rawPct = sumLen > 0 ? Math.floor((sumDone * 100) / sumLen) : 0;
                        job.netPct = allDone ? 100 : Math.min(99, Math.max(job.netPct || 0, rawPct));
                        if (readyCnt >= job.targetSet.size) {
                            job.dlActive = false;
                            job.completedAll = true;
                            job.netPct = 100;
                        }
                    }
                }
            });

            window._torLiveDaemonSnapV128 = list;
            window._lastTorStatusFetchTsV212 = Date.now();

            var activeCnt = 0, sumKbps = 0, sumReady = 0, sumTotal = 0;
            list.forEach(function(t) {
                var files = t.files || [];
                if (files.some(function(f) { return !f.done; }) && !t.paused) activeCnt++;
                sumKbps += (t.speed_kbps || 0);
                sumReady += files.filter(function(f) { return f.done; }).length;
                sumTotal += files.length;
            });

            var lbl = document.getElementById('lblTorHeaderHubMenuV128');
            if (lbl) {
                if (activeCnt > 0) lbl.innerText = 'Активно: ' + activeCnt + ' (' + sumReady + '/' + sumTotal + ')' + (sumKbps > 0 ? ' • ⚡' + sumKbps + 'КБ/с' : '') + ' • Части';
                else if (list.length > 0) lbl.innerText = 'Раздач: ' + list.length + ' (' + sumReady + '/' + sumTotal + ') • Части';
                else lbl.innerText = 'Раздачи • Треки • Части';
            }

            var curH = window._torStateV96 && window._torStateV96.currentHash;
            if (curH && window._torMapV112 && window._torMapV112[curH] && window._torScreenModeV112 === 'files') {
                window.paintOpenedTorrentJobProgressV112(window._torMapV112[curH], window._lastTorEncBadgeV212 || null);
            }
            if (document.getElementById('jennyTorInspectorModalV128')) {
                window.renderTorrentInspectorHubV128();
            }
        } catch (e) {}
    };

    window.ensureMultiTorrentWorkerV112 = function() {
        if (window._torGlobalTimerV112) return;
        if (typeof window.setTorrentWorkerFastMode === 'function') window.setTorrentWorkerFastMode(true);
        window._torGlobalTimerV112 = setInterval(async function() {
            var allJobs = Object.values(window._torMapV112 || {});
            var activeJobs = allJobs.filter(function(j) { return j.dlActive; });
            if (activeJobs.length === 0 && !window._torImportWorkerBusyV112 && (!window._torImportQueueV112 || window._torImportQueueV112.length === 0)) {
                clearInterval(window._torGlobalTimerV112);
                window._torGlobalTimerV112 = null;
                if (window._torStateV96) window._torStateV96.dlActive = false;
                if (typeof window.setTorrentWorkerFastMode === 'function') window.setTorrentWorkerFastMode(false);
                return;
            }
            if (Date.now() - (window._lastTorStatusFetchTsV212 || 0) > 850) {
                await window.refreshTorrentDaemonSnapV128();
            }
        }, 1031);
    };

    window.downloadSingleTorrentTrackV98 = async function(fileIdx, btnEl, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var h = window._torStateV96 && window._torStateV96.currentHash;
        var job = h && window._torMapV112 ? window._torMapV112[h] : null;
        if (!job) return;
        var cleanIdx = Number(fileIdx);
        if (!job.validIdxSet.has(cleanIdx)) return;

        job.explicitDlSet = job.explicitDlSet || new Set();
        if (job.explicitDlSet.size === 0) {
            job.selectedFiles.clear();
            job.targetSet.clear();
            document.querySelectorAll('#torBodyListV96 input[type="checkbox"]').forEach(function(c) { c.checked = false; });
        }

        job.explicitDlSet.add(cleanIdx);
        job.selectedFiles.add(cleanIdx);
        job.targetSet.add(cleanIdx);
        job.dlActive = true;
        job.completedAll = false;

        var chk = document.querySelector('#torFileRowV96_' + cleanIdx + ' input[type="checkbox"]');
        if (chk) chk.checked = true;
        if (typeof window.updateTorrentSelectAllBtnUIV117 === 'function') window.updateTorrentSelectAllBtnUIV117();
        if (btnEl) { btnEl.innerText = '⏳'; btnEl.style.color = '#3fb950'; }

        var fSt = job.fileStatusMap && job.fileStatusMap[cleanIdx];
        var fMeta = (job.files || []).find(function(x) { return Number(x.index) === cleanIdx; });
        if (fSt && fSt.done && !fSt.xflac_file) {
            window.enqueueTorrentTrackImportV112(job, { index: cleanIdx, full_path: fSt.full_path || (fMeta && fMeta.full_path) || '' }, job.name);
        }

        await fetch('/api/torrent/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hash: job.hash,
                magnet: job.magnet || '',
                files: Array.from(job.explicitDlSet),
                explicit: true
            })
        }).catch(function() {});
        window.ensureMultiTorrentWorkerV112();
    };
})();

/* [split] V215: кусок исходного IIFE (ui_v71.js, строки 18904–19635) → ui_torrent.js */
;(function() {
    if (window._jennyV215Installed__torrent) return;
    window._jennyV215Installed__torrent = true;
    window._jennyV215Installed = true;

    // -------------------------------------------------------------------------
    // 5. КАРТОЧКИ ФАЙЛОВ В ТОРРЕНТ-РАЗДАЧЕ БЕЗ КРИВОГО ПЕРЕНОСА "• ▶ Поток / ⬇️ Скачать"
    //    И С ЯРКОЙ ПОДСВЕТКОЙ АКТИВНОГО ПОТОКА (📡 В потоке) И ЗАКАЧКИ (⬇️ Качается)
    //    (Video #3, 01:38 и Video #4, 00:10-01:30, 03:00-03:11)
    // -------------------------------------------------------------------------
    function cleanAndHighlightTorrentFileRowsV215() {
        var curH = window._torStateV96 && window._torStateV96.currentHash;
        if (!curH || window._torScreenModeV112 !== 'files') return;
        var job = window._torMapV112 && window._torMapV112[curH];
        var vidSt = window._vidStateV130 || {};
        var activeStreamHash = (vidSt.active && vidSt.torHash) ? String(vidSt.torHash).toLowerCase() : (window._activeStreamSessionV143 ? String(window._activeStreamSessionV143.hash || '').toLowerCase() : '');
        var activeStreamIdx = (vidSt.active && vidSt.torHash) ? Number(vidSt.torFileIdx) : (window._activeStreamSessionV143 ? Number(window._activeStreamSessionV143.fileIdx) : -1);

        var rows = document.querySelectorAll('#torBodyListV96 [id^="torFileRowV96_"]');
        rows.forEach(function(rowEl) {
            var fIdx = Number(String(rowEl.id).replace('torFileRowV96_', ''));
            var pEl = document.getElementById('torFileProgV96_' + fIdx);
            var dlBtn = document.getElementById('torDlSingleBtnV98_' + fIdx);
            var playBtn = rowEl.querySelector('.tor-prev-btn-v97');

            var fMeta = (job && job.files || []).find(function(x) { return Number(x.index) === fIdx; });
            var st = (job && job.fileStatusMap && job.fileStatusMap[fIdx]) || {};
            var totMb = (((st.length || (fMeta && fMeta.length) || 0)) / (1024 * 1024)).toFixed(1);
            var doneMb = (((st.completed || 0)) / (1024 * 1024)).toFixed(1);
            var pct = Math.max(0, Math.min(100, Number(st.percent || 0)));
            var readyFile = st.xflac_file || (fMeta && fMeta.xflac_file) || '';

            var isStreamingNow = (activeStreamHash === String(curH).toLowerCase() && activeStreamIdx === fIdx);
            var isExplicitDl = Boolean(job && job.explicitDlSet && job.explicitDlSet.has(fIdx));
            var isActivelyDownloading = Boolean(job && job.dlActive && (isExplicitDl || (job.targetSet && job.targetSet.has(fIdx) && Number(st.completed || 0) > 0)));

            if (pEl) {
                pEl.style.height = 'auto';
                pEl.style.lineHeight = '1.35';
                pEl.style.whiteSpace = 'nowrap';
                pEl.style.overflow = 'hidden';
                pEl.style.textOverflow = 'ellipsis';

                if (readyFile) {
                    pEl.innerHTML = '<span style="color:#3fb950;font-weight:800;">✅ В плеере: ' + readyFile + '</span>';
                } else if (isStreamingNow && isActivelyDownloading) {
                    pEl.innerHTML = '💾 ' + totMb + ' МБ • <span style="color:#00e5ff;font-weight:900;">📡 В потоке</span> • <span style="color:#3fb950;font-weight:900;">⬇️ ' + doneMb + ' МБ (' + pct + '%)</span>';
                } else if (isStreamingNow) {
                    pEl.innerHTML = '💾 ' + totMb + ' МБ • <span style="color:#00e5ff;font-weight:900;background:rgba(0,229,255,0.14);padding:1px 6px;border-radius:5px;border:1px solid rgba(0,229,255,0.4);">📡 Поток активен (' + pct + '%)</span>';
                } else if (isActivelyDownloading) {
                    pEl.innerHTML = '💾 ' + totMb + ' МБ • <span style="color:#3fb950;font-weight:900;background:rgba(63,185,80,0.15);padding:1px 6px;border-radius:5px;border:1px solid rgba(63,185,80,0.4);">⬇️ Качается: ' + doneMb + ' МБ (' + pct + '%)</span>';
                } else if (pct > 0 && Number(st.completed || 0) > 0) {
                    pEl.innerHTML = '💾 ' + totMb + ' МБ • <span style="color:#d2a8ff;font-weight:bold;">На диске: ' + doneMb + ' МБ (' + pct + '%)</span>';
                } else {
                    pEl.innerHTML = '💾 ' + totMb + ' МБ';
                }
            }

            if (playBtn) {
                playBtn.style.background = isStreamingNow ? 'rgba(0,229,255,0.22)' : '#161b22';
                playBtn.style.borderColor = isStreamingNow ? '#00e5ff' : '#30363d';
                playBtn.style.color = isStreamingNow ? '#00e5ff' : '#58a6ff';
                playBtn.style.boxShadow = isStreamingNow ? '0 0 8px rgba(0,229,255,0.4)' : 'none';
            }

            if (dlBtn && !readyFile) {
                dlBtn.style.background = isActivelyDownloading ? 'rgba(63,185,80,0.32)' : 'rgba(63,185,80,0.16)';
                dlBtn.style.borderColor = isActivelyDownloading ? '#00e676' : 'rgba(63,185,80,0.6)';
                dlBtn.style.boxShadow = isActivelyDownloading ? '0 0 8px rgba(0,230,118,0.4)' : 'none';
                dlBtn.innerText = isActivelyDownloading ? '⏳' : '⬇️';
            }
        });
    }

    var _origPaintJobV215 = window.paintOpenedTorrentJobProgressV112;
    if (typeof _origPaintJobV215 === 'function' && !_origPaintJobV215._v215Wrapped) {
        window.paintOpenedTorrentJobProgressV112 = function(job, te) {
            var r = _origPaintJobV215.apply(this, arguments);
            cleanAndHighlightTorrentFileRowsV215();
            return r;
        };
        window.paintOpenedTorrentJobProgressV112._v215Wrapped = true;
    }
    setInterval(function() {
        var tm = document.getElementById('jennyTorrentModalV91');
        if (!tm || tm.style.display === 'none') return;
        if (window.runIsolatedTorrents) window.runIsolatedTorrents(cleanAndHighlightTorrentFileRowsV215);
        else cleanAndHighlightTorrentFileRowsV215();
    }, 613);

    // -------------------------------------------------------------------------
    // 6. ОЧИСТКА КЭША ПРОГРЕССА ПРИ СТОПЕ / УДАЛЕНИИ + ОНБОРДИНГ 24/7 + ФИЛЬТРЫ ТОРРЕНТА
    // -------------------------------------------------------------------------
    ;['stopCurrentOpenTorrentV143', 'deleteCurrentOpenTorrentV143', 'nukeAllTorrentsV142', 'cleanupActiveTorrentStreamV143', 'resetOpenTorrentScreenUI_V143'].forEach(function(fnName) {
        var origFn = window[fnName];
        if (typeof origFn === 'function' && !origFn._v215Wrapped) {
            var wrapped = async function() {
                var curHash = (window._torStateV96 && window._torStateV96.currentHash) || '';
                if (typeof window.clearTorMonotonicCacheV214 === 'function') {
                    window.clearTorMonotonicCacheV214(fnName === 'nukeAllTorrentsV142' ? '' : curHash);
                }
                var res = await origFn.apply(this, arguments);
                cleanAndHighlightTorrentFileRowsV215();
                return res;
            };
            wrapped._v215Wrapped = true;
            window[fnName] = wrapped;
        }
    });

    var FULL_TORRENT_FORMAT_TAGS_V215 = [
        { id: 'all',   label: '🌐 ВСЕ',   color: '#58a6ff' },
        { id: 'flac',  label: '💎 FLAC',  color: '#3fb950' },
        { id: 'wav',   label: '🌊 WAV',   color: '#39c5cf' },
        { id: 'mp3',   label: '🎵 MP3',   color: '#d2a8ff' },
        { id: 'm4a',   label: '🍏 M4A',   color: '#a371f7' },
        { id: 'video', label: '🎬 ВИДЕО', color: '#ff7b72' },
        { id: 'mkv',   label: '📽️ MKV',   color: '#ffa657' },
        { id: 'mp4',   label: '🎞️ MP4',   color: '#e3b341' },
        { id: 'avi',   label: '📼 AVI',   color: '#f0883e' },
        { id: '1080p', label: '📽️ 1080p', color: '#79c0ff' },
        { id: '4k',    label: '🔥 4K',    color: '#ff7b72' }
    ];

    window.TORRENT_FORMAT_TAGS_V101 = FULL_TORRENT_FORMAT_TAGS_V215.slice();

    window.fixTorrentSearchInputAutofillV214 = function() {
        var inp = document.getElementById('torMagnetInpV91');
        if (!inp || inp._v215AutofillFixed) return;
        inp._v215AutofillFixed = true;
        inp.setAttribute('type', 'search');
        inp.setAttribute('name', 'jenny_tor_q_' + Math.floor(Math.random() * 100000));
        inp.setAttribute('autocomplete', 'off');
        inp.setAttribute('autocorrect', 'off');
        inp.setAttribute('autocapitalize', 'none');
        inp.setAttribute('spellcheck', 'false');
        inp.setAttribute('inputmode', 'search');
        inp.setAttribute('data-lpignore', 'true');
        inp.setAttribute('data-form-type', 'other');

        inp.readOnly = true;
        var unlock = function() {
            if (inp.readOnly) inp.readOnly = false;
        };
        inp.addEventListener('touchstart', unlock, { passive: true });
        inp.addEventListener('mousedown', unlock, { passive: true });
        inp.addEventListener('focus', unlock, { passive: true });
    };

    window.ensureTorrentYearInputV125 = function() {
        window.fixTorrentSearchInputAutofillV214();
        var topRow = document.getElementById('torTopFilterRowV214');
        var yInp = document.getElementById('torYearInpV125');
        if (!yInp) {
            yInp = document.createElement('input');
            yInp.type = 'search';
            yInp.id = 'torYearInpV125';
            yInp.setAttribute('name', 'jenny_tor_yr_v215');
            yInp.setAttribute('autocomplete', 'off');
            yInp.setAttribute('inputmode', 'numeric');
            yInp.setAttribute('maxlength', '4');
            yInp.placeholder = '📅 Год';
            yInp.value = (window._torStateV96 && window._torStateV96.yearFilter) ? window._torStateV96.yearFilter : '';
            yInp.oninput = function() {
                this.value = this.value.replace(/[^0-9]/g, '').slice(0, 4);
                if (window._torStateV96) window._torStateV96.yearFilter = this.value;
                this.style.borderColor = this.value.length === 4 ? '#58a6ff' : '#30363d';
            };
            yInp.onkeydown = function(ev) {
                if (ev.key === 'Enter' && typeof window.runTorrentActionV96 === 'function') {
                    window.runTorrentActionV96(true);
                }
            };
        }
        yInp.style.cssText = 'width:62px;flex-shrink:0;padding:4px 5px;font-size:10.5px;background:#06080b !important;color:#58a6ff !important;border:1px solid #30363d !important;border-radius:8px;text-align:center !important;font-weight:bold;';
        if (topRow && yInp.parentNode !== topRow) {
            topRow.appendChild(yInp);
        }
    };

    window.renderTorrentFilterBarV99 = function() {
        window.fixTorrentSearchInputAutofillV214();
        var m = document.getElementById('jennyTorrentModalV91');
        if (!m) return;
        var bar = document.getElementById('torFilterPillsBarV99');
        if (!bar) {
            var stLine = document.getElementById('torStatusLineV96');
            if (!stLine || !stLine.parentNode) return;
            bar = document.createElement('div');
            bar.id = 'torFilterPillsBarV99';
            bar.style.cssText = 'display:flex;flex-direction:column;gap:5px;margin:2px 0;';
            stLine.parentNode.insertBefore(bar, stLine);
        }
        var ts = window._torStateV96 || {};
        window.TORRENT_FORMAT_TAGS_V101 = FULL_TORRENT_FORMAT_TAGS_V215.slice();

        var mkCheck = function(k, icon, label, activeColor) {
            var on = Boolean(ts[k]);
            return '<button type="button" onclick="window.toggleTorrentFilterPillV99(\'' + k + '\')" style="flex:1;min-width:0;padding:4px 4px;font-size:10px;border-radius:8px;font-weight:bold;white-space:nowrap;background:' + (on ? 'rgba(63,185,80,0.18)' : '#11161f') + ';border:1px solid ' + (on ? activeColor : '#30363d') + ';color:' + (on ? activeColor : '#8b949e') + ';display:inline-flex;align-items:center;justify-content:center;gap:3px;"><span>' + (on ? '☑️' : '⬜') + '</span><span>' + icon + ' ' + label + '</span></button>';
        };

        var curTag = ts.formatTag || 'all';
        var tagsHtml = FULL_TORRENT_FORMAT_TAGS_V215.map(function(t) {
            var act = (curTag === t.id);
            return '<button type="button" onclick="window.selectTorrentFormatTagV101(\'' + t.id + '\')" style="padding:4px 8px;font-size:10.5px;border-radius:9px;font-weight:900;flex:0 0 auto;background:' + (act ? 'rgba(88,166,255,0.22)' : '#0d1117') + ';border:1.5px solid ' + (act ? t.color : '#262c36') + ';color:' + (act ? t.color : '#8b949e') + ';box-shadow:' + (act ? '0 0 8px rgba(88,166,255,0.25)' : 'none') + ';">' + t.label + '</button>';
        }).join('');

        bar.innerHTML =
            '<div id="torTopFilterRowV214" style="display:flex;gap:4px;width:100%;align-items:center;">' +
                mkCheck('exactSearch', '🎯', 'Точно', '#58a6ff') +
                mkCheck('minTwoSeeds', '👥', '>=2 сид', '#e3b341') +
                mkCheck('hideZeroSeeds', '🚫', 'Без 0', '#3fb950') +
            '</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:4px;padding-bottom:2px;">' +
                tagsHtml +
            '</div>';

        window.ensureTorrentYearInputV125();
    };

    window.matchesFileOrResultFormatTagV214 = function(textStr, tagId) {
        var t = String(textStr || '').toLowerCase();
        var tag = String(tagId || 'all').toLowerCase().trim();
        if (!tag || tag === 'all') return true;
        if (tag === 'flac') return /\b(flac|alac|ape|wv|lossless)\b/i.test(t) || /\.flac\b/i.test(t);
        if (tag === 'wav')  return /\b(wav|pcm|dsd|dsf|dff)\b/i.test(t) || /\.wav\b/i.test(t);
        if (tag === 'mp3')  return /\b(mp3|320\s*kbps)\b/i.test(t) || /\.mp3\b/i.test(t);
        if (tag === 'm4a')  return /\b(m4a|aac|ogg|opus)\b/i.test(t) || /\.(m4a|aac|ogg|opus)\b/i.test(t);
        if (tag === 'mkv')  return /\b(mkv|matroska|bdremux|remux)\b/i.test(t) || /\.mkv\b/i.test(t);
        if (tag === 'mp4')  return /\b(mp4|m4v|h264|x264|avc)\b/i.test(t) || /\.(mp4|m4v)\b/i.test(t);
        if (tag === 'avi')  return /\b(avi|xvid|divx|dvdrip|hdrip)\b/i.test(t) || /\.avi\b/i.test(t);
        if (tag === '1080p') return /\b(1080p|1080i|fhd|fullhd)\b/i.test(t);
        if (tag === '4k')   return /\b(2160p|4k|uhd)\b/i.test(t);
        if (tag === 'video') return /\b(mkv|mp4|avi|mov|wmv|ts|m2ts|webm|bdrip|web-dl|webrip|hdrip|dvdrip|1080p|2160p|720p|4k|сезон|серии|серия)\b/i.test(t);
        return t.indexOf(tag) !== -1;
    };

    window.selectTorrentFormatTagV101 = function(tagId) {
        if (!window._torStateV96) window._torStateV96 = {};
        window._torStateV96.formatTag = tagId || 'all';
        window.renderTorrentFilterBarV99();

        if (window._torScreenModeV112 === 'files') {
            var rows = document.querySelectorAll('#torBodyListV96 [id^="torFileRowV96_"]');
            rows.forEach(function(r) {
                var ok = window.matchesFileOrResultFormatTagV214(r.textContent || '', tagId);
                r.style.display = ok ? '' : 'none';
            });
            return;
        }

        var inp = document.getElementById('torMagnetInpV91');
        if (inp && inp.value.trim() && !inp.value.trim().toLowerCase().startsWith('magnet:?')) {
            if (typeof window.runTorrentActionV96 === 'function') {
                window.runTorrentActionV96(true);
            }
        }
    };

    // -------------------------------------------------------------------------
    // 7. ПРОБИНГ РЕАЛЬНОЙ ДЛИТЕЛЬНОСТИ ОТКРЫТОГО ВИДЕО (С ЗАЩИТОЙ ОТ ЧУЖОГО ОТВЕТА)
    // -------------------------------------------------------------------------
    window.probeTorrentVideoDurationV214 = function(streamUrl) {
        var st = window._vidStateV130;
        if (!st || !st.active || !streamUrl) return;
        var expectedUrl = st.rawTorStreamUrlV214 || st.currentUrl;
        fetch('/api/video/pcm_meta?src=' + encodeURIComponent(streamUrl))
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (!window._vidStateV130 || !window._vidStateV130.active) return;
                if ((window._vidStateV130.rawTorStreamUrlV214 || window._vidStateV130.currentUrl) !== expectedUrl) return;
                var dur = Number(d && (d.duration || d.duration_sec)) || 0;
                if (dur > 1) {
                    st.trueDuration = dur;
                    st.knownDurationSec = dur;
                    window._jennyFullMovieDurationSecV210 = dur;
                    if (!window._vcoreLastProbeV166) window._vcoreLastProbeV166 = {};
                    window._vcoreLastProbeV166.duration_sec = dur;
                    var vid = document.getElementById('jennyVideoElV130');
                    var cur = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : 0;
                    if (typeof window.syncInternalVideoSliderUIV212 === 'function') {
                        window.syncInternalVideoSliderUIV212(cur, dur);
                    }
                    if (typeof window.updateProgressUIDeckB === 'function') {
                        window.updateProgressUIDeckB(cur, dur, Boolean(window.isReversedDeckB));
                    }
                }
            })
            .catch(function(){});
    };
    setTimeout(function() {
        window.fixTorrentSearchInputAutofillV214();
        window.renderTorrentFilterBarV99();
        window.syncFormatSlotsUI();
    }, 600);
})();

/* [split] V216: кусок исходного IIFE (ui_v71.js, строки 19638–21240) → ui_torrent.js */
;(function() {
    if (window._jennyV216Installed__torrent) return;
    window._jennyV216Installed__torrent = true;
    window._jennyV216Installed = true;

    // При закрытии видео крестиком ❌:
    // - сразу останавливаем кадр и глушим звук в плеере,
    // - но серверный поток/приоритет освобождаем с настраиваемой задержкой удержания (по умолчанию 20 сек)!
    window.cleanupActiveTorrentStreamV143 = async function(reason) {
        var sess = window._activeStreamSessionV143;
        if (!sess || !sess.hash) return;
        window._activeStreamSessionV143 = null;

        var cfg = window._jennyThreadConfigV216 || window.loadThreadConfigV216();
        var holdSec = (reason === 'switch') ? 0 : Number(cfg.streamHoldDelaySec !== undefined ? cfg.streamHoldDelaySec : 20);

        var doRelease = async function() {
            var job = window._torMapV112 && window._torMapV112[sess.hash];
            var isExplicitlyDownloading = Boolean(job && job.explicitDlSet && job.explicitDlSet.has(Number(sess.fileIdx)));
            if (isExplicitlyDownloading) return;
            try {
                await fetch('/api/video/release_stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hash: sess.hash, immediate: true })
                });
                await fetch('/api/torrent/cleanup_stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hash: sess.hash, file_index: sess.fileIdx, reason: reason || 'close' })
                });
            } catch (e) {}
        };

        if (window._vidHoldReleaseTimerV216) {
            clearTimeout(window._vidHoldReleaseTimerV216);
            window._vidHoldReleaseTimerV216 = null;
        }
        if (holdSec <= 0) {
            await doRelease();
        } else {
            fetch('/api/video/release_stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hash: sess.hash, immediate: false })
            }).catch(function(){});
            window._vidHoldReleaseTimerV216 = setTimeout(doRelease, holdSec * 1000);
        }
    };

    // -------------------------------------------------------------------------
    // 9. КНОПКА "📂 ФАЙЛЫ" (#v130BtnTorHub) В ВИДЕОПЛЕЕРЕ ОТКРЫВАЕТ СРАЗУ СПИСОК ФАЙЛОВ РАЗДАЧИ (71421.mp4, 01:44-02:10)
    // -------------------------------------------------------------------------
    window.openTorHubFromVideoV130 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._vidStateV130 || {};
        if (!st.torHash) return;
        if (!st.pipMode && typeof window.toggleVideoPipModeV130 === 'function') {
            window.toggleVideoPipModeV130();
        }
        if (typeof window.jumpToTorrentFilesFromHubV128 === 'function') {
            window.jumpToTorrentFilesFromHubV128(st.torHash);
            setTimeout(function() {
                var rowEl = document.getElementById('torFileRowV96_' + st.torFileIdx);
                if (rowEl && rowEl.scrollIntoView) {
                    rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 220);
        } else if (typeof window.toggleTorrentInspectorHubV128 === 'function') {
            window.toggleTorrentInspectorHubV128(ev, 'jobs', st.torHash);
        }
    };
})();

/* [split] V217: кусок исходного IIFE (ui_v71.js, строки 21243–22584) → ui_torrent.js */
;(function() {
    if (window._jennyV217Installed__torrent) return;
    window._jennyV217Installed__torrent = true;
    window._jennyV217Installed = true;

    // Кнопка "Файлы" (#v130BtnTorHub): работает и для торрент-раздач, и для локальных видеофайлов!
    window.openTorHubFromVideoV130 = function(ev) {
        if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var st = window._vidStateV130 || {};
        if (!st.pipMode && typeof window.toggleVideoPipModeV130 === 'function') {
            window.toggleVideoPipModeV130();
        }
        if (st.torHash) {
            if (typeof window.jumpToTorrentFilesFromHubV128 === 'function') {
                window.jumpToTorrentFilesFromHubV128(st.torHash);
                setTimeout(function() {
                    var rowEl = document.getElementById('torFileRowV96_' + st.torFileIdx);
                    if (rowEl && rowEl.scrollIntoView) rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 220);
            } else if (typeof window.toggleTorrentInspectorHubV128 === 'function') {
                window.toggleTorrentInspectorHubV128(ev, 'jobs', st.torHash);
            }
        } else {
            // Для локального видео открываем вкладку "🎬 Видео" в главном списке и прокручиваем к текущему файлу!
            document.querySelectorAll('.modal-overlay.open').forEach(function(m) { m.classList.remove('open'); });
            window.activePlaylistTabV71 = 'videos';
            if (typeof window.renderPlaylistStripChipsV71 === 'function') window.renderPlaylistStripChipsV71();
            if (typeof window.renderActivePlaylistTracksV71 === 'function') window.renderActivePlaylistTracksV71(false);
        }
    };
})();

/* [split] V218: кусок исходного IIFE (ui_v71.js, строки 22588–24059) → ui_torrent.js */
;(function() {
    if (window._jennyV218Installed__torrent) return;
    window._jennyV218Installed__torrent = true;
    window._jennyV218Installed = true;

    // -------------------------------------------------------------------------
    // 8. ПЕРЕНОС "⬇️ Качается: ... МБ (X%)" НА ВТОРУЮ СТРОКУ В ТОРРЕНТЕ (Scr_part2, 00:21-00:46)
    // -------------------------------------------------------------------------
    window.cleanAndHighlightTorrentFileRowsV218 = function() {
        var curH = window._torStateV96 && window._torStateV96.currentHash;
        if (!curH || window._torScreenModeV112 !== 'files') return;
        var job = window._torMapV112 && window._torMapV112[curH];
        var vidSt = window._vidStateV130 || {};
        var activeStreamHash = (vidSt.active && vidSt.torHash) ? String(vidSt.torHash).toLowerCase() : (window._activeStreamSessionV143 ? String(window._activeStreamSessionV143.hash || '').toLowerCase() : '');
        var activeStreamIdx = (vidSt.active && vidSt.torHash) ? Number(vidSt.torFileIdx) : (window._activeStreamSessionV143 ? Number(window._activeStreamSessionV143.fileIdx) : -1);

        var rows = document.querySelectorAll('#torBodyListV96 [id^="torFileRowV96_"]');
        rows.forEach(function(rowEl) {
            var fIdx = Number(String(rowEl.id).replace('torFileRowV96_', ''));
            var pEl = document.getElementById('torFileProgV96_' + fIdx);
            if (!pEl) return;

            var fMeta = (job && job.files || []).find(function(x) { return Number(x.index) === fIdx; });
            var st = (job && job.fileStatusMap && job.fileStatusMap[fIdx]) || {};
            var totMb = (((st.length || (fMeta && fMeta.length) || 0)) / (1024 * 1024)).toFixed(1);
            var doneMb = (((st.completed || 0)) / (1024 * 1024)).toFixed(1);
            var pct = Math.max(0, Math.min(100, Number(st.percent || 0)));
            var readyFile = st.xflac_file || (fMeta && fMeta.xflac_file) || '';

            var isStreamingNow = (activeStreamHash === String(curH).toLowerCase() && activeStreamIdx === fIdx);
            var isExplicitDl = Boolean(job && job.explicitDlSet && job.explicitDlSet.has(fIdx));
            var isActivelyDownloading = Boolean(job && job.dlActive && (isExplicitDl || (job.targetSet && job.targetSet.has(fIdx) && Number(st.completed || 0) > 0)));

            pEl.style.height = 'auto';
            pEl.style.lineHeight = '1.35';
            pEl.style.whiteSpace = 'normal';
            pEl.style.overflow = 'visible';

            if (readyFile) {
                pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ</div>' +
                    '<div style="margin-top:2px;color:#3fb950;font-weight:800;">✅ В плеере: ' + readyFile + '</div>';
            } else if (isStreamingNow && isActivelyDownloading) {
                pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ</div>' +
                    '<div style="margin-top:2px;"><span style="color:#00e5ff;font-weight:900;">📡 В потоке</span> • <span style="color:#3fb950;font-weight:900;">⬇️ Качается: ' + doneMb + ' МБ (' + pct + '%)</span></div>';
            } else if (isStreamingNow) {
                pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ</div>' +
                    '<div style="margin-top:2px;"><span style="color:#00e5ff;font-weight:900;background:rgba(0,229,255,0.14);padding:1px 6px;border-radius:5px;border:1px solid rgba(0,229,255,0.4);">📡 Поток активен (' + pct + '%)</span></div>';
            } else if (isActivelyDownloading) {
                pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ</div>' +
                    '<div style="margin-top:2px;"><span style="color:#3fb950;font-weight:900;background:rgba(63,185,80,0.15);padding:1px 6px;border-radius:5px;border:1px solid rgba(63,185,80,0.45);">⬇️ Качается: ' + doneMb + ' МБ (' + pct + '%)</span></div>';
            } else if (pct >= 100) {
                pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ</div>' +
                    '<div style="margin-top:2px;color:#3fb950;font-weight:800;">✅ Скачан (100%)</div>';
            } else if (pct > 0) {
                pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ</div>' +
                    '<div style="margin-top:2px;color:#8b949e;">Пауза: ' + doneMb + ' МБ (' + pct + '%)</div>';
            } else {
                pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ</div>';
            }
        });
    };

    // Запускаем периодическую синхронизацию новых функций V218
    setInterval(function() {
        window.guardAllSettingsInputsFocusV218();
        window.syncDeckFavButtonsUIV218();
        window.cleanAndHighlightTorrentFileRowsV218();
    }, 550);
})();

/* [split] V236: кусок исходного IIFE (ui_v71.js, строки 30671–31598) → ui_torrent.js */
;(function() {
    if (window._jennyV236Installed__torrent) return;
    window._jennyV236Installed__torrent = true;
    window._jennyV236Installed = true;

    // =========================================================================
    // 2. SCREEN 1 FIX (72006.jpg): RESTORE TORRENT STUDIO FOOTER (#torFooterBarV96)
    //    WITH DOWNLOAD BUTTON + LIVE DOWNLOAD & .xFLAC TRANSCODING PROGRESS
    // =========================================================================
    window.isLosslessAudioPathV236 = function(p) {
        return /\.(flac|wav|ape|wv|alac)$/i.test(String(p || '').trim());
    };

    window.computeJobHasLosslessV236 = function(job) {
        if (!job || !Array.isArray(job.files)) return false;
        var targets = (job.targetSet && job.targetSet.size > 0)
            ? job.files.filter(function(f) { return job.targetSet.has(Number(f.index)); })
            : ((job.selectedFiles && job.selectedFiles.size > 0)
                ? job.files.filter(function(f) { return job.selectedFiles.has(Number(f.index)); })
                : job.files);
        if (!targets.length) targets = job.files;
        return targets.some(function(f) {
            return window.isLosslessAudioPathV236(f.path || f.full_path || f.name || '');
        });
    };

    window.ensureTorrentFooterStructureV236 = function() {
        var modal = document.getElementById('jennyTorrentModalV91');
        if (!modal) return null;
        var card = modal.querySelector('.jenny-modal-card-v71');
        var body = document.getElementById('torBodyListV96');
        if (body && body.parentElement) {
            var topControls = body.previousElementSibling;
            if (topControls && topControls !== modal.querySelector('.jenny-modal-hdr-v71')) {
                topControls.style.flexShrink = '0';
                topControls.style.padding = '6px 10px';
                topControls.style.gap = '4px';
            }
        }
        var ftr = document.getElementById('torFooterBarV96');
        if (!ftr && card) {
            ftr = document.createElement('div');
            ftr.id = 'torFooterBarV96';
            card.appendChild(ftr);
        }
        if (!ftr) return null;

        var h = window._torStateV96 && window._torStateV96.currentHash;
        var job = (h && window._torMapV112) ? window._torMapV112[h] : null;
        var hasLossless = job
            ? window.computeJobHasLosslessV236(job)
            : (window.torrentHasLosslessFilesV106 ? window.torrentHasLosslessFilesV106() : false);
        if (job) job.hasLossless = hasLossless;

        var selSet = window.getActiveTorrentSelectSetV117 ? window.getActiveTorrentSelectSetV117() : (job && job.selectedFiles) || new Set();
        var hasSel = selSet.size > 0;

        ftr.style.cssText = 'display:' + (window._torScreenModeV112 === 'files' ? 'flex' : 'none') + ' !important;flex-direction:column !important;padding:8px 10px !important;border-top:1px solid #30363d !important;background:#090c10 !important;gap:6px !important;flex-shrink:0 !important;z-index:20 !important;';

        ftr.innerHTML =
            '<div id="torXflacProgWrapV99" style="display:none;flex-direction:column;gap:3px;width:100%;background:#0d131a;padding:5px 8px;border-radius:7px;border:1px solid rgba(63,185,80,0.45);box-sizing:border-box;">' +
                '<div id="torXflacProgLabelV99" style="font-size:10.5px;color:#3fb950;font-weight:800;white-space:normal;line-height:1.25;">🧬 Пережатие в xFLAC: 0%</div>' +
                '<div style="width:100%;height:7px;background:#161b22;border-radius:6px;overflow:hidden;border:1px solid #3fb950;">' +
                    '<div id="torXflacProgFillV99" style="width:0%;height:100%;background:linear-gradient(90deg,#3fb950,#58a6ff);transition:width 0.2s ease;"></div>' +
                '</div>' +
            '</div>' +
            '<div id="torTotalProgWrapV97" style="display:none;flex-direction:column;gap:3px;width:100%;background:#0d1117;padding:5px 8px;border-radius:7px;border:1px solid rgba(88,166,255,0.4);box-sizing:border-box;">' +
                '<div id="torTotalProgLabelV236" style="font-size:10.5px;color:#58a6ff;font-weight:800;display:flex;justify-content:space-between;align-items:center;gap:6px;">' +
                    '<span id="torTotalProgTextLeftV236">⬇️ Загрузка сети: 0%</span>' +
                    '<span id="torTotalProgTextRightV236" style="color:#3fb950;">В плеере: 0/0</span>' +
                '</div>' +
                '<div style="width:100%;height:7px;background:#161b22;border-radius:6px;overflow:hidden;border:1px solid #30363d;">' +
                    '<div id="torTotalProgFillV97" style="width:0%;height:100%;background:linear-gradient(90deg,#8957e5,#58a6ff,#3fb950);transition:width 0.25s ease;"></div>' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;gap:5px;width:100%;align-items:center;">' +
                '<button type="button" onclick="window.backToTorrentSearchListV97()" style="padding:6px 9px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;border-radius:7px;font-size:11px;font-weight:bold;flex-shrink:0;">⬅ Раздачи</button>' +
                '<button type="button" id="btnTorToggleAllV117" onclick="window.toggleSelectAllTorrentFilesV117(event)" style="flex:1;padding:6px 8px;background:#161b22;color:' + (hasSel ? '#8b949e' : '#58a6ff') + ';border:1px solid ' + (hasSel ? '#30363d' : '#58a6ff') + ';border-radius:7px;font-size:11px;font-weight:bold;text-align:center;">' + (hasSel ? '☐ Снять все' : '☑️ Выбрать все') + '</button>' +
                '<button type="button" id="btnTorStopStreamOrDlV143" onclick="window.stopCurrentOpenTorrentV143()" title="Остановить закачку / поток" style="padding:6px 9px;background:#161b22;color:#e3b341;border:1px solid #e3b341;border-radius:7px;font-size:11px;font-weight:bold;flex-shrink:0;">⏹ Стоп</button>' +
                '<button type="button" id="btnTorDeleteCurrentV143" onclick="window.deleteCurrentOpenTorrentV143()" title="Удалить раздачу и временный кэш" style="padding:6px 9px;background:rgba(248,81,73,0.15);color:#ff7b72;border:1px solid #ff7b72;border-radius:7px;font-size:11px;font-weight:bold;flex-shrink:0;">🗑️</button>' +
            '</div>' +
            '<button type="button" id="btnTorStartDlV97" onclick="window.startSelectedTorrentDownloadV96()" style="width:100%;padding:9px 12px;background:linear-gradient(135deg,#8957e5,#238636);color:#fff;border:none;border-radius:8px;font-weight:900;font-size:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);">' +
                (hasLossless ? '⬇️ Качать выбранные (➔ xFLAC)' : '⬇️ Качать выбранные в плеер (Прямой формат)') +
            '</button>';

        return ftr;
    };

    var _origRenderTorFilesV236 = window.renderTorrentFilesListV96;
    window.renderTorrentFilesListV96 = function() {
        window._torScreenModeV112 = 'files';
        var h = window._torStateV96 && window._torStateV96.currentHash;
        var job = (h && window._torMapV112) ? window._torMapV112[h] : null;
        if (job) {
            window._torStateV96.files = job.files;
            window._torStateV96.selectedFiles = job.selectedFiles;
            job.hasLossless = window.computeJobHasLosslessV236(job);
        }
        if (typeof _origRenderTorFilesV236 === 'function') {
            _origRenderTorFilesV236.apply(this, arguments);
        }
        window.ensureTorrentFooterStructureV236();
        if (job) {
            window.paintOpenedTorrentJobProgressV112(job, window._lastTorEncBadgeV212 || null);
        }
    };

    // Upgrade paintOpenedTorrentJobProgressV112 so both network download and xFLAC transcoding bars + buttons stay live
    window.paintOpenedTorrentJobProgressV112 = function(job, te) {
        if (!job || !window._torStateV96 || window._torStateV96.currentHash !== job.hash || window._torScreenModeV112 !== 'files') return;
        te = te || window._lastTorEncBadgeV212 || {};
        job.hasLossless = window.computeJobHasLosslessV236(job);

        var ftr = document.getElementById('torFooterBarV96');
        if (!ftr || !document.getElementById('btnTorStartDlV97') || !document.getElementById('torTotalProgLabelV236')) {
            ftr = window.ensureTorrentFooterStructureV236();
        }
        if (ftr) {
            ftr.style.setProperty('display', 'flex', 'important');
        }

        var totalTargets = Math.max(1, (job.targetSet && job.targetSet.size) || (job.selectedFiles && job.selectedFiles.size) || (job.files && job.files.length) || 1);
        var readyCnt = job.readyCnt || 0;
        var totalPct = Math.max(0, Math.min(100, job.netPct || 0));

        var sumDoneBytes = 0, sumTotBytes = 0;
        (job.files || []).forEach(function(f) {
            var fIdx = Number(f.index);
            var st = (job.fileStatusMap && job.fileStatusMap[fIdx]) || {};
            if (!job.targetSet || job.targetSet.size === 0 || job.targetSet.has(fIdx)) {
                sumDoneBytes += Number(st.completed || 0);
                sumTotBytes += Number(st.length || f.length || 0);
            }
        });
        var sumDoneMb = (sumDoneBytes / (1024 * 1024)).toFixed(1);
        var sumTotMb = (sumTotBytes / (1024 * 1024)).toFixed(1);

        var totWrap = document.getElementById('torTotalProgWrapV97');
        var totFill = document.getElementById('torTotalProgFillV97');
        var totLeft = document.getElementById('torTotalProgTextLeftV236');
        var totRight = document.getElementById('torTotalProgTextRightV236');

        if (totWrap) {
            if (job.dlActive || job.completedAll || totalPct > 0 || sumDoneBytes > 0) {
                totWrap.style.display = 'flex';
                if (totFill) totFill.style.width = totalPct + '%';
                if (totLeft) {
                    var spd = job.speedKbps > 0 ? (' • ⚡ ' + job.speedKbps + ' КБ/с') : '';
                    totLeft.innerText = (totalPct >= 100 ? '✅ Скачано: 100%' : ('⬇️ Загрузка: ' + totalPct + '%')) + ' (' + sumDoneMb + ' / ' + sumTotMb + ' МБ' + spd + ')';
                }
                if (totRight) {
                    totRight.innerText = 'В плеере: ' + readyCnt + '/' + totalTargets;
                }
            } else {
                totWrap.style.display = 'none';
            }
        }

        // Check if any lossless file in this job is downloaded and waiting/running xFLAC compression
        var hasLosslessWaitingOrEncoding = false;
        (job.files || []).forEach(function(f) {
            var fIdx = Number(f.index);
            var st = (job.fileStatusMap && job.fileStatusMap[fIdx]) || {};
            var isTarget = (job.targetSet && job.targetSet.has(fIdx)) || (job.explicitDlSet && job.explicitDlSet.has(fIdx));
            if (isTarget && window.isLosslessAudioPathV236(f.path || f.full_path || '') && !st.xflac_file && !f.xflac_file) {
                if (st.done || Number(st.percent || 0) >= 100 || (te && te.active)) {
                    hasLosslessWaitingOrEncoding = true;
                }
            }
        });

        var encWrap = document.getElementById('torXflacProgWrapV99');
        var encLbl = document.getElementById('torXflacProgLabelV99');
        var encFill = document.getElementById('torXflacProgFillV99');
        if (encWrap) {
            if (!job.hasLossless || (!job.dlActive && !job.completedAll && !te.active && !hasLosslessWaitingOrEncoding)) {
                encWrap.style.display = 'none';
            } else if (readyCnt >= totalTargets && job.targetSet && job.targetSet.size > 0) {
                encWrap.style.display = 'flex';
                if (encLbl) encLbl.innerText = '✅ Все выбранные треки (' + readyCnt + '/' + totalTargets + ') пережаты в .xFLAC!';
                if (encFill) encFill.style.width = '100%';
            } else if (te.active || hasLosslessWaitingOrEncoding || readyCnt > 0 || job.dlActive) {
                encWrap.style.display = 'flex';
                var trackPct = te.active ? Number(te.track_pct || 0) : (hasLosslessWaitingOrEncoding ? 15 : 0);
                var ovPct = Math.min(100, Math.round(((readyCnt * 100) + trackPct) / totalTargets));
                var curTrackName = te.current_track || (hasLosslessWaitingOrEncoding ? 'Упаковка WAV/FLAC ➔ .xFLAC...' : 'Ожидание докачки WAV/FLAC...');
                if (encLbl) {
                    encLbl.innerText = '🧬 Пережатие в xFLAC [' + readyCnt + '/' + totalTargets + ']: ' + curTrackName + ' (' + (te.active ? trackPct : ovPct) + '%)';
                }
                if (encFill) encFill.style.width = Math.max(4, (te.active ? trackPct : ovPct)) + '%';
            }
        }

        var btn = document.getElementById('btnTorStartDlV97');
        if (btn) {
            if (job.completedAll && job.targetSet && job.targetSet.size > 0) {
                btn.disabled = false;
                btn.style.background = 'linear-gradient(135deg, #238636, #1f6feb)';
                btn.innerText = '✅ Готово (' + readyCnt + '/' + totalTargets + ' в плеере)';
            } else if (job.dlActive || (te && te.active) || hasLosslessWaitingOrEncoding) {
                btn.disabled = false;
                if (job.hasLossless && (te.active || hasLosslessWaitingOrEncoding || totalPct >= 100)) {
                    var ep = te.active ? (te.track_pct || 0) : Math.min(99, Math.round((readyCnt * 100) / totalTargets));
                    btn.style.background = 'linear-gradient(135deg, #7341be, #238636)';
                    btn.innerText = '🧬 Пережатие в xFLAC: ' + ep + '% (готово ' + readyCnt + '/' + totalTargets + ')';
                } else {
                    btn.style.background = 'linear-gradient(135deg, #1f6feb, #238636)';
                    btn.innerText = '⏳ Загрузка: ' + totalPct + '% (в плеере: ' + readyCnt + '/' + totalTargets + ')';
                }
            } else {
                btn.disabled = false;
                btn.style.background = 'linear-gradient(135deg, #8957e5, #238636)';
                btn.innerText = job.hasLossless
                    ? '⬇️ Качать выбранные (➔ xFLAC)'
                    : '⬇️ Качать выбранные в плеер (Прямой формат)';
            }
        }

        var stEl = document.getElementById('torStatusLineV96');
        if (stEl && (job.dlActive || job.completedAll)) {
            var spdStr = job.speedKbps > 0 ? (' • ⚡ ' + job.speedKbps + ' КБ/с') : '';
            var totPeersStr = job.totalPeers > job.peers ? ('/' + job.totalPeers) : '';
            stEl.innerText = '🧲 Сидов: ' + (job.seeders || 0) + ' • Пиров: ' + (job.peers || 0) + totPeersStr + spdStr + ' • Сеть: ' + totalPct + '% • В плеере: ' + readyCnt + '/' + totalTargets;
        }

        window.cleanAndHighlightTorrentFileRowsV218();
    };

    // Upgrade cleanAndHighlightTorrentFileRowsV218 so it shows both download AND .xFLAC transcoding on each file row
    window.cleanAndHighlightTorrentFileRowsV218 = function() {
        var curH = window._torStateV96 && window._torStateV96.currentHash;
        if (!curH || window._torScreenModeV112 !== 'files') return;

        var ftr = document.getElementById('torFooterBarV96');
        if (ftr && (ftr.style.display === 'none' || getComputedStyle(ftr).display === 'none')) {
            ftr.style.setProperty('display', 'flex', 'important');
        }

        var job = window._torMapV112 && window._torMapV112[curH];
        var te = window._lastTorEncBadgeV212 || {};
        var vidSt = window._vidStateV130 || {};
        var activeStreamHash = (vidSt.active && vidSt.torHash) ? String(vidSt.torHash).toLowerCase() : (window._activeStreamSessionV143 ? String(window._activeStreamSessionV143.hash || '').toLowerCase() : '');
        var activeStreamIdx = (vidSt.active && vidSt.torHash) ? Number(vidSt.torFileIdx) : (window._activeStreamSessionV143 ? Number(window._activeStreamSessionV143.fileIdx) : -1);

        var rows = document.querySelectorAll('#torBodyListV96 [id^="torFileRowV96_"]');
        rows.forEach(function(rowEl) {
            var fIdx = Number(String(rowEl.id).replace('torFileRowV96_', ''));
            var pEl = document.getElementById('torFileProgV96_' + fIdx);
            var dlBtn = document.getElementById('torDlSingleBtnV98_' + fIdx);
            var playBtn = rowEl.querySelector('.tor-prev-btn-v97');

            var fMeta = (job && job.files || []).find(function(x) { return Number(x.index) === fIdx; });
            var st = (job && job.fileStatusMap && job.fileStatusMap[fIdx]) || {};
            var totMb = (((st.length || (fMeta && fMeta.length) || 0)) / (1024 * 1024)).toFixed(1);
            var doneMb = (((st.completed || 0)) / (1024 * 1024)).toFixed(1);
            var pct = Math.max(0, Math.min(100, Number(st.percent || 0)));
            var readyFile = st.xflac_file || (fMeta && fMeta.xflac_file) || '';
            var fPath = (fMeta && (fMeta.path || fMeta.full_path)) || st.full_path || '';
            var isLosslessFile = window.isLosslessAudioPathV236(fPath);
            var impKey = String(curH).toLowerCase() + '_' + fIdx;

            var isStreamingNow = (activeStreamHash === String(curH).toLowerCase() && activeStreamIdx === fIdx);
            var isExplicitDl = Boolean(job && job.explicitDlSet && job.explicitDlSet.has(fIdx));
            var isTarget = Boolean(isExplicitDl || (job && job.targetSet && job.targetSet.has(fIdx)));
            var isActivelyDownloading = Boolean(job && job.dlActive && (isExplicitDl || (isTarget && Number(st.completed || 0) > 0)));
            var isEncodingNow = Boolean(isLosslessFile && !readyFile && ((te.active && te.current_key === impKey) || (window._torImportWorkerBusyV112 && (st.done || pct >= 100) && isTarget)));
            var isQueuedForXflac = Boolean(isLosslessFile && !readyFile && (st.done || pct >= 100) && isTarget);

            if (rowEl) {
                if (readyFile) {
                    rowEl.style.background = 'linear-gradient(90deg, rgba(63,185,80,0.26) 100%, #0b0f16 100%)';
                    rowEl.style.borderColor = 'rgba(63,185,80,0.65)';
                } else if (isEncodingNow || isQueuedForXflac) {
                    var ep = (te.active && te.current_key === impKey) ? Number(te.track_pct || 25) : 35;
                    rowEl.style.background = 'linear-gradient(90deg, rgba(63,185,80,0.38) ' + ep + '%, rgba(137,87,229,0.25) ' + ep + '%)';
                    rowEl.style.borderColor = '#3fb950';
                } else if (pct > 0 && (isActivelyDownloading || isStreamingNow)) {
                    rowEl.style.background = 'linear-gradient(90deg, rgba(137,87,229,0.32) ' + pct + '%, #0b0f16 ' + pct + '%)';
                    rowEl.style.borderColor = '#8957e5';
                }
            }

            if (pEl) {
                pEl.style.height = 'auto';
                pEl.style.lineHeight = '1.35';
                pEl.style.whiteSpace = 'normal';
                pEl.style.overflow = 'visible';

                if (readyFile) {
                    pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ</div>' +
                        '<div style="margin-top:2px;color:#3fb950;font-weight:800;">✅ В плеере: ' + readyFile + '</div>';
                } else if (isEncodingNow) {
                    var encP = (te.active && te.current_key === impKey) ? Number(te.track_pct || 15) : 20;
                    pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ (WAV/FLAC скачан)</div>' +
                        '<div style="margin-top:2px;"><span style="color:#3fb950;font-weight:900;background:rgba(63,185,80,0.18);padding:1px 6px;border-radius:5px;border:1px solid #3fb950;">🧬 Пережатие в xFLAC: ' + encP + '%</span></div>';
                } else if (isQueuedForXflac) {
                    pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ (100%)</div>' +
                        '<div style="margin-top:2px;"><span style="color:#d2a8ff;font-weight:900;background:rgba(163,113,247,0.16);padding:1px 6px;border-radius:5px;border:1px solid #a371f7;">🧬 Очередь пережатия в xFLAC...</span></div>';
                } else if (isStreamingNow && isActivelyDownloading) {
                    pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ</div>' +
                        '<div style="margin-top:2px;"><span style="color:#00e5ff;font-weight:900;">📡 В потоке</span> • <span style="color:#3fb950;font-weight:900;">⬇️ Качается: ' + doneMb + ' МБ (' + pct + '%)</span></div>';
                } else if (isStreamingNow) {
                    pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ</div>' +
                        '<div style="margin-top:2px;"><span style="color:#00e5ff;font-weight:900;background:rgba(0,229,255,0.14);padding:1px 6px;border-radius:5px;border:1px solid rgba(0,229,255,0.4);">📡 Поток активен (' + pct + '%)</span></div>';
                } else if (isActivelyDownloading) {
                    var xflacHint = isLosslessFile ? ' ➔ xFLAC' : '';
                    pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ</div>' +
                        '<div style="margin-top:2px;"><span style="color:#3fb950;font-weight:900;background:rgba(63,185,80,0.15);padding:1px 6px;border-radius:5px;border:1px solid rgba(63,185,80,0.45);">⬇️ Качается: ' + doneMb + ' МБ (' + pct + '%)' + xflacHint + '</span></div>';
                } else if (pct >= 100) {
                    pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ</div>' +
                        '<div style="margin-top:2px;color:#3fb950;font-weight:800;">✅ Скачан (100%)</div>';
                } else if (pct > 0) {
                    pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ</div>' +
                        '<div style="margin-top:2px;color:#8b949e;">Пауза: ' + doneMb + ' МБ (' + pct + '%)</div>';
                } else {
                    pEl.innerHTML = '<div style="color:#8b949e;">💾 ' + totMb + ' МБ</div>';
                }
            }

            if (playBtn) {
                playBtn.style.background = isStreamingNow ? 'rgba(0,229,255,0.22)' : '#161b22';
                playBtn.style.borderColor = isStreamingNow ? '#00e5ff' : '#30363d';
                playBtn.style.color = isStreamingNow ? '#00e5ff' : '#58a6ff';
            }
            if (dlBtn) {
                if (readyFile) {
                    dlBtn.innerText = '✅';
                } else if (isEncodingNow || isQueuedForXflac) {
                    dlBtn.innerText = '🧬';
                } else {
                    dlBtn.innerText = isActivelyDownloading ? '⏳' : '⬇️';
                }
            }
        });
    };

    // Ensure refreshTorrentDaemonSnapV128 fetches BOTH /api/torrent/status AND /api/sources/live_badges so _lastTorEncBadgeV212 is always populated!
    var _origRefreshDaemonSnapV236 = window.refreshTorrentDaemonSnapV128;
    window.refreshTorrentDaemonSnapV128 = async function(fromWorkerPush) {
        if (!fromWorkerPush && (!window._latestTorWorkerSnap || (Date.now() - window._latestTorWorkerSnap.ts > 2500))) {
            try {
                fetch('/api/sources/live_badges')
                    .then(function(r) { return r.json(); })
                    .then(function(b) {
                        if (b && b.torrent_enc) {
                            window._lastTorEncBadgeV212 = b.torrent_enc;
                        }
                    })
                    .catch(function() {});
            } catch (e) {}
        }
        if (typeof _origRefreshDaemonSnapV236 === 'function') {
            return await _origRefreshDaemonSnapV236.apply(this, arguments);
        }
    };

    // Ensure downloadSingleTorrentTrackV98 & startSelectedTorrentDownloadV96 compute job.hasLossless and immediately show progress in #torFooterBarV96
    var _origDlSingleV236 = window.downloadSingleTorrentTrackV98;
    window.downloadSingleTorrentTrackV98 = async function(fileIdx, btnEl, ev) {
        var r = (typeof _origDlSingleV236 === 'function')
            ? await _origDlSingleV236.apply(this, arguments)
            : undefined;
        var h = window._torStateV96 && window._torStateV96.currentHash;
        var job = (h && window._torMapV112) ? window._torMapV112[h] : null;
        if (job) {
            job.hasLossless = window.computeJobHasLosslessV236(job);
            window.paintOpenedTorrentJobProgressV112(job, window._lastTorEncBadgeV212 || null);
        }
        return r;
    };

    var _origStartSelDlV236 = window.startSelectedTorrentDownloadV96;
    window.startSelectedTorrentDownloadV96 = async function(explicitFiles) {
        var r = (typeof _origStartSelDlV236 === 'function')
            ? await _origStartSelDlV236.apply(this, arguments)
            : undefined;
        var h = window._torStateV96 && window._torStateV96.currentHash;
        var job = (h && window._torMapV112) ? window._torMapV112[h] : null;
        if (job) {
            job.hasLossless = window.computeJobHasLosslessV236(job);
            window.paintOpenedTorrentJobProgressV112(job, window._lastTorEncBadgeV212 || null);
        }
        return r;
    };
})();

/* [split] V237: кусок исходного IIFE (ui_v71.js, строки 31602–32550) → ui_torrent.js */
;(function() {
    if (window._jennyV237Installed__torrent) return;
    window._jennyV237Installed__torrent = true;
    window._jennyV237Installed = true;

    // -------------------------------------------------------------------------
    // 3. ZERO-TWITCH TORRENT FILE CARDS (#torBodyListV96):
    //    Replace #torFileProgV96_* with fixed-height .tor-row-meta-line-v237 + .tor-row-fill-layer-v237
    //    so old 500ms V215 timer finds nothing and ONLY fill width & numbers update in-place!
    // -------------------------------------------------------------------------
    window.renderTorrentFilesListV96 = function() {
        window._torScreenModeV112 = 'files';
        var body = document.getElementById('torBodyListV96');
        if (!body) return;

        var h = window._torStateV96 && window._torStateV96.currentHash;
        var job = (h && window._torMapV112) ? window._torMapV112[h] : null;
        if (job) {
            window._torStateV96.files = job.files;
            window._torStateV96.selectedFiles = job.selectedFiles;
            job.hasLossless = window.computeJobHasLosslessV236 ? window.computeJobHasLosslessV236(job) : false;
        }

        var files = (window._torStateV96 && window._torStateV96.files) || [];
        var selSet = (window._torStateV96 && window._torStateV96.selectedFiles) || new Set();

        body.innerHTML = files.map(function(f) {
            var idx = Number(f.index);
            var chk = selSet.has(idx) ? 'checked' : '';
            var mb = ((f.length || 0) / (1024 * 1024)).toFixed(1);
            var cleanTitle = String(f.path || f.name || '').split('/').pop() || f.path || ('Track #' + idx);
            return '<div id="torFileRowV96_' + idx + '" class="tor-file-row-v237">' +
                '<div id="torRowFillV237_' + idx + '" class="tor-row-fill-layer-v237"></div>' +
                '<div class="tor-row-content-v237">' +
                    '<input type="checkbox" ' + chk + ' onchange="if(this.checked) window._torStateV96.selectedFiles.add(' + idx + '); else window._torStateV96.selectedFiles.delete(' + idx + '); if(window.updateTorrentSelectAllBtnUIV117) window.updateTorrentSelectAllBtnUIV117();" style="width:17px;height:17px;accent-color:#3fb950;flex-shrink:0;cursor:pointer;">' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="color:#e6edf3;font-size:11.5px;font-weight:bold;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.28;">' + cleanTitle + '</div>' +
                        '<div class="tor-row-meta-line-v237">' +
                            '<span id="torRowSizeV237_' + idx + '" style="color:#8b949e;flex-shrink:0;">💾 ' + mb + ' МБ</span>' +
                            '<span id="torRowStatV237_' + idx + '" style="font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>' +
                        '</div>' +
                    '</div>' +
                    '<button type="button" class="tor-prev-btn-v97" onclick="window.previewTorrentFileStreamV97(' + idx + ', this, event)" title="Слушать / смотреть поток сразу" style="padding:5px 9px;background:#161b22;color:#58a6ff;border:1px solid #30363d;border-radius:7px;font-size:11px;font-weight:bold;flex-shrink:0;">▶</button>' +
                    '<button type="button" id="torDlSingleBtnV98_' + idx + '" onclick="window.downloadSingleTorrentTrackV98(' + idx + ', this, event)" title="Скачать этот трек в плеер" style="padding:5px 9px;background:rgba(63,185,80,0.16);color:#3fb950;border:1px solid rgba(63,185,80,0.6);border-radius:7px;font-size:11px;font-weight:bold;flex-shrink:0;">⬇️</button>' +
                '</div>' +
            '</div>';
        }).join('');

        if (typeof window.ensureTorrentFooterStructureV236 === 'function') {
            window.ensureTorrentFooterStructureV236();
        }
        if (job) {
            window.paintOpenedTorrentJobProgressV112(job, window._lastTorEncBadgeV212 || null);
        }
    };

    // In-place update of ONLY the fill layer width and digit text on each torrent card (0 layout shift, 0 twitching!)
    window.cleanAndHighlightTorrentFileRowsV218 = function() {
        var curH = window._torStateV96 && window._torStateV96.currentHash;
        if (!curH || window._torScreenModeV112 !== 'files') return;

        var ftr = document.getElementById('torFooterBarV96');
        if (ftr && (ftr.style.display === 'none' || getComputedStyle(ftr).display === 'none')) {
            ftr.style.setProperty('display', 'flex', 'important');
        }

        var job = window._torMapV112 && window._torMapV112[curH];
        var te = window._lastTorEncBadgeV212 || {};
        var vidSt = window._vidStateV130 || {};
        var activeStreamHash = (vidSt.active && vidSt.torHash) ? String(vidSt.torHash).toLowerCase() : (window._activeStreamSessionV143 ? String(window._activeStreamSessionV143.hash || '').toLowerCase() : '');
        var activeStreamIdx = (vidSt.active && vidSt.torHash) ? Number(vidSt.torFileIdx) : (window._activeStreamSessionV143 ? Number(window._activeStreamSessionV143.fileIdx) : -1);

        var rows = document.querySelectorAll('#torBodyListV96 [id^="torFileRowV96_"]');
        rows.forEach(function(rowEl) {
            var fIdx = Number(String(rowEl.id).replace('torFileRowV96_', ''));
            var fillEl = document.getElementById('torRowFillV237_' + fIdx);
            var sizeEl = document.getElementById('torRowSizeV237_' + fIdx);
            var statEl = document.getElementById('torRowStatV237_' + fIdx);
            var dlBtn = document.getElementById('torDlSingleBtnV98_' + fIdx);
            var playBtn = rowEl.querySelector('.tor-prev-btn-v97');

            var fMeta = (job && job.files || []).find(function(x) { return Number(x.index) === fIdx; });
            var st = (job && job.fileStatusMap && job.fileStatusMap[fIdx]) || {};
            var totMb = (((st.length || (fMeta && fMeta.length) || 0)) / (1024 * 1024)).toFixed(1);
            var doneMb = (((st.completed || 0)) / (1024 * 1024)).toFixed(1);
            var pct = Math.max(0, Math.min(100, Number(st.percent || 0)));
            var readyFile = st.xflac_file || (fMeta && fMeta.xflac_file) || '';
            var fPath = (fMeta && (fMeta.path || fMeta.full_path)) || st.full_path || '';
            var isLosslessFile = window.isLosslessAudioPathV236 ? window.isLosslessAudioPathV236(fPath) : false;
            var impKey = String(curH).toLowerCase() + '_' + fIdx;

            var isStreamingNow = (activeStreamHash === String(curH).toLowerCase() && activeStreamIdx === fIdx);
            var isExplicitDl = Boolean(job && job.explicitDlSet && job.explicitDlSet.has(fIdx));
            var isTarget = Boolean(isExplicitDl || (job && job.targetSet && job.targetSet.has(fIdx)));
            var isActivelyDownloading = Boolean(job && job.dlActive && (isExplicitDl || (isTarget && Number(st.completed || 0) > 0)));
            var isEncodingNow = Boolean(isLosslessFile && !readyFile && ((te.active && te.current_key === impKey) || (window._torImportWorkerBusyV112 && (st.done || pct >= 100) && isTarget)));
            var isQueuedForXflac = Boolean(isLosslessFile && !readyFile && (st.done || pct >= 100) && isTarget);

            if (sizeEl) {
                var wantSize = '💾 ' + totMb + ' МБ';
                if (sizeEl._lastTxt !== wantSize) {
                    sizeEl._lastTxt = wantSize;
                    sizeEl.textContent = wantSize;
                }
            }

            var wantFillWidth = '0%';
            var wantFillBg = 'transparent';
            var wantBorder = '#21262d';
            var wantStatTxt = '';
            var wantStatColor = '#8b949e';

            if (readyFile) {
                wantFillWidth = '100%';
                wantFillBg = 'rgba(63,185,80,0.22)';
                wantBorder = 'rgba(63,185,80,0.65)';
                wantStatTxt = '• ✅ В плеере: ' + readyFile;
                wantStatColor = '#3fb950';
            } else if (isEncodingNow) {
                var ep = (te.active && te.current_key === impKey) ? Number(te.track_pct || 15) : 25;
                wantFillWidth = ep + '%';
                wantFillBg = 'rgba(63,185,80,0.34)';
                wantBorder = '#3fb950';
                wantStatTxt = '• 🧬 Сжатие xFLAC: ' + ep + '%';
                wantStatColor = '#3fb950';
            } else if (isQueuedForXflac) {
                wantFillWidth = '100%';
                wantFillBg = 'rgba(137,87,229,0.24)';
                wantBorder = '#a371f7';
                wantStatTxt = '• 🧬 Очередь xFLAC...';
                wantStatColor = '#d2a8ff';
            } else if (isStreamingNow && isActivelyDownloading) {
                wantFillWidth = pct + '%';
                wantFillBg = 'rgba(137,87,229,0.32)';
                wantBorder = '#00e5ff';
                wantStatTxt = '• 📡 Поток • ⬇️ ' + doneMb + ' МБ (' + pct + '%)';
                wantStatColor = '#00e5ff';
            } else if (isStreamingNow) {
                wantFillWidth = pct + '%';
                wantFillBg = 'rgba(0,229,255,0.20)';
                wantBorder = '#00e5ff';
                wantStatTxt = '• 📡 Поток (' + pct + '%)';
                wantStatColor = '#00e5ff';
            } else if (isActivelyDownloading) {
                wantFillWidth = pct + '%';
                wantFillBg = 'rgba(137,87,229,0.32)';
                wantBorder = '#8957e5';
                wantStatTxt = '• ⬇️ Качается: ' + doneMb + ' МБ (' + pct + '%)' + (isLosslessFile ? ' ➔ xFLAC' : '');
                wantStatColor = '#3fb950';
            } else if (pct >= 100) {
                wantFillWidth = '100%';
                wantFillBg = 'rgba(63,185,80,0.16)';
                wantBorder = 'rgba(63,185,80,0.45)';
                wantStatTxt = '• ✅ Скачан (100%)';
                wantStatColor = '#3fb950';
            } else if (pct > 0) {
                wantFillWidth = pct + '%';
                wantFillBg = 'rgba(137,87,229,0.16)';
                wantStatTxt = '• Пауза: ' + doneMb + ' МБ (' + pct + '%)';
                wantStatColor = '#8b949e';
            }

            if (fillEl) {
                if (fillEl._lastW !== wantFillWidth) {
                    fillEl._lastW = wantFillWidth;
                    fillEl.style.width = wantFillWidth;
                }
                if (fillEl._lastBg !== wantFillBg) {
                    fillEl._lastBg = wantFillBg;
                    fillEl.style.background = wantFillBg;
                }
            }
            if (rowEl && rowEl._lastBorder !== wantBorder) {
                rowEl._lastBorder = wantBorder;
                rowEl.style.borderColor = wantBorder;
            }
            if (statEl) {
                if (statEl._lastTxt !== wantStatTxt) {
                    statEl._lastTxt = wantStatTxt;
                    statEl.textContent = wantStatTxt;
                }
                if (statEl._lastClr !== wantStatColor) {
                    statEl._lastClr = wantStatColor;
                    statEl.style.color = wantStatColor;
                }
            }
            if (playBtn) {
                var wantPlayClr = isStreamingNow ? '#00e5ff' : '#58a6ff';
                if (playBtn._lastClr !== wantPlayClr) {
                    playBtn._lastClr = wantPlayClr;
                    playBtn.style.color = wantPlayClr;
                    playBtn.style.borderColor = isStreamingNow ? '#00e5ff' : '#30363d';
                }
            }
            if (dlBtn) {
                var wantDlTxt = readyFile ? '✅' : ((isEncodingNow || isQueuedForXflac) ? '🧬' : (isActivelyDownloading ? '⏳' : '⬇️'));
                if (dlBtn._lastTxt !== wantDlTxt) {
                    dlBtn._lastTxt = wantDlTxt;
                    dlBtn.textContent = wantDlTxt;
                }
            }
        });
    };

    // Override processNextTorrentImportV112 so 355-track torrents coalesce fetchData() instead of firing 355 back-to-back /api/data scans!
    window.processNextTorrentImportV112 = async function() {
        if (window._torImportWorkerBusyV112 || !window._torImportQueueV112 || window._torImportQueueV112.length === 0) return;
        window._torImportWorkerBusyV112 = true;
        var item = window._torImportQueueV112.shift();
        try {
            var res = await fetch('/api/torrent/import_track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hash: item.hash,
                    index: item.index,
                    full_path: item.full_path,
                    torrent_name: item.torrent_name,
                    format_mode: 'xflac_psycho'
                })
            }).then(function(r) { return r.json(); });

            if (res && res.status === 'ok') {
                item.job.fileStatusMap[item.index] = Object.assign(item.job.fileStatusMap[item.index] || {}, {
                    xflac_file: res.filename,
                    size_mb: res.size_mb
                });
                window.scheduleCoalescedFetchDataV237(2200);
            } else {
                item.job.importedSet.delete(item.impKey);
            }
        } catch (e) {
            item.job.importedSet.delete(item.impKey);
        } finally {
            window._torImportWorkerBusyV112 = false;
            if (window._torImportQueueV112 && window._torImportQueueV112.length > 0) {
                setTimeout(window.processNextTorrentImportV112, 80);
            } else {
                window.scheduleCoalescedFetchDataV237(400);
            }
        }
    };
})();
/* ================= END JENNY_V238_MULTI_PORT_SMART_ROUTER_AND_JNI_FOLDERS_PATCH ================= */

/* ================= BEGIN JENNY_V239_HOTFIX_PLAYBACK_TORPREVIEW_AND_ROW_HEIGHT ================= */
/* [split] V239: кусок исходного IIFE (ui_v71.js, строки 32914–32975) → ui_torrent.js */
;(function() {
    if (window._jennyV239HotfixInstalled) return;
    window._jennyV239HotfixInstalled = true;

    // 1. Permanent alias so both previewSingleTorrentTrackV97 and previewTorrentFileStreamV97 always work
    window.previewSingleTorrentTrackV97 = function(fileIdx, btnEl, ev) {
        if (typeof window.previewTorrentFileStreamV97 === 'function') {
            return window.previewTorrentFileStreamV97(fileIdx, btnEl, ev);
        }
    };
})();
/* ================= END JENNY_V242_HUB_PILLS_IMMERSIVE_DOCK_FLEX_SEARCH_AND_RADIO_BUF_PATCH ================= */

/* ================= BEGIN JENNY_V238_P2P_TURBO_DIAG ================= */
/* [split] V238: кусок исходного IIFE (ui_v71.js, строки 34882–35221) → ui_torrent.js */
;(function() {
    if (window._jennyV238P2pInstalled__torrent) return;
    window._jennyV238P2pInstalled__torrent = true;
    window._jennyV238P2pInstalled = true;

    window._torDaemonMetaV238 = {
        version: '',
        dht_nodes: 0,
        trackers_cached: 0,
        ts: 0
    };
    window._torEngineLogLinesV238 = [];
    window._torEngineLogBinV238 = '';
    window._torStatusInFlightV238 = null;
    window._torStatusCachedTextV238 = '';
    window._torStatusCacheTsV238 = 0;

    // 2. Живой радар DHT и воронки пиров прямо на экране ожидания магнита (openMagnetInGoEngineV96)
    var _origOpenMagnetV238 = window.openMagnetInGoEngineV96;
    if (typeof _origOpenMagnetV238 === 'function' && !_origOpenMagnetV238._v238Wrapped) {
        window.openMagnetInGoEngineV96 = async function(magnetUrl) {
            var preHash = window.extractBtihFromMagnetV112 ? window.extractBtihFromMagnetV112(magnetUrl) : '';
            var waitTimer = null;
            var startedTs = Date.now();

            if (preHash && !(window._torMapV112 && window._torMapV112[preHash] && window._torMapV112[preHash].files.length > 0)) {
                waitTimer = setInterval(async function() {
                    if (window._torScreenModeV112 !== 'files') return;
                    var body = document.getElementById('torBodyListV96');
                    if (!body || body.querySelector('[id^="torFileRowV96_"]')) return;
                    try {
                        var stData = await window.fetch('/api/torrent/status').then(function(r) { return r.json(); });
                        var dht = Number(stData.dht_nodes || 0);
                        var trCnt = Number(stData.trackers_cached || 0);
                        var tor = (stData.torrents || []).find(function(x) { return String(x.hash || '').toLowerCase() === preHash; });
                        var secElapsed = Math.min(25, Math.floor((Date.now() - startedTs) / 1000));

                        var radarBox = document.getElementById('torMagnetLiveRadarV238');
                        if (!radarBox) {
                            var card = body.firstElementChild;
                            if (card) {
                                radarBox = document.createElement('div');
                                radarBox.id = 'torMagnetLiveRadarV238';
                                radarBox.style.cssText = 'width:100%;max-width:360px;padding:8px 10px;background:#070b11;border:1px solid #30363d;border-radius:9px;font-size:11px;line-height:1.45;text-align:left;color:#c9d1d9;';
                                card.insertBefore(radarBox, card.lastElementChild);
                            }
                        }
                        var totP = tor ? (tor.total_peers || 0) : 0;
                        var halfP = tor ? (tor.half_open || 0) : 0;
                        var actP = tor ? (tor.peers || 0) : 0;
                        var diag = (tor && tor.diag_msg) ? tor.diag_msg : ('🌐 Узлов DHT: ' + dht + ' • Опрос ' + trCnt + ' трекеров + веб-кэшей iTorrents/BTCache...');
                        var dhtClr = dht > 15 ? '#3fb950' : (dht > 0 ? '#e3b341' : '#ff7b72');

                        if (radarBox) {
                            radarBox.innerHTML =
                                '<div style="display:flex;justify-content:space-between;gap:6px;font-weight:bold;margin-bottom:3px;">' +
                                    '<span style="color:' + dhtClr + ';">🌐 DHT: ' + dht + ' узл.</span>' +
                                    '<span style="color:#58a6ff;">🔎 Рой: ' + totP + ' ➔ ⏳' + halfP + ' ➔ 🟢' + actP + '</span>' +
                                    '<span style="color:#8b949e;">⏱ ' + secElapsed + '/25с</span>' +
                                '</div>' +
                                '<div style="color:#d2a8ff;font-size:10.5px;">' + diag + '</div>';
                        }
                        var stEl = document.getElementById('torStatusLineV96');
                        if (stEl) {
                            stEl.innerText = diag;
                        }
                    } catch (e) {}
                }, 750);
            }

            try {
                return await _origOpenMagnetV238.apply(this, arguments);
            } finally {
                if (waitTimer) clearInterval(waitTimer);
            }
        };
        window.openMagnetInGoEngineV96._v238Wrapped = true;
    }

    // 3. Живая строка статуса #torStatusLineV96 и при скачивании ⬇️, и при потоке ▶, и при простое 0 КБ/с
    var _origRefreshSnapV238 = window.refreshTorrentDaemonSnapV128;
    if (typeof _origRefreshSnapV238 === 'function' && !_origRefreshSnapV238._v238Wrapped) {
        window.refreshTorrentDaemonSnapV128 = async function() {
            var r = await _origRefreshSnapV238.apply(this, arguments);
            var list = window._torLiveDaemonSnapV128 || [];
            var dht = (window._torDaemonMetaV238 && window._torDaemonMetaV238.dht_nodes) || 0;

            list.forEach(function(t) {
                var h = String(t.hash || '').toLowerCase();
                var job = window._torMapV112 && window._torMapV112[h];
                if (job) {
                    job.halfOpen = t.half_open || 0;
                    job.piecesPartial = t.pieces_partial || 0;
                    job.dhtNodes = t.dht_nodes !== undefined ? t.dht_nodes : dht;
                    job.diagMsg = t.diag_msg || '';
                    job.diagStatus = t.diag_status || 'ok';
                    job.metaSource = t.meta_source || '';
                }
            });

            var curH = String((window._torStateV96 && window._torStateV96.currentHash) || '').toLowerCase();
            if (curH && window._torScreenModeV112 === 'files') {
                var dTor = list.find(function(x) { return String(x.hash || '').toLowerCase() === curH; });
                var stEl = document.getElementById('torStatusLineV96');
                if (dTor && stEl) {
                    var vidSt = window._vidStateV130 || {};
                    var isStreamingThis = Boolean(
                        (vidSt.active && String(vidSt.torHash || '').toLowerCase() === curH) ||
                        (window._activeStreamSessionV143 && String(window._activeStreamSessionV143.hash || '').toLowerCase() === curH)
                    );
                    var jobCur = window._torMapV112 && window._torMapV112[curH];
                    if ((jobCur && jobCur.dlActive) || isStreamingThis || (dTor.speed_kbps || 0) > 0) {
                        var spd = dTor.speed_kbps || 0;
                        var seeds = dTor.seeders || 0;
                        var peers = dTor.peers || 0;
                        var totP = dTor.total_peers || 0;
                        var halfP = dTor.half_open || 0;
                        if (spd === 0 && dTor.diag_msg) {
                            stEl.innerText = dTor.diag_msg;
                        } else {
                            stEl.innerText = '⚡ ' + spd + ' КБ/с • ▲Сид: ' + seeds + ' • ▼Пир: ' + peers + (totP > peers ? '/' + totP : '') +
                                (halfP > 0 ? ' (⏳' + halfP + ')' : '') + ' • 🌐DHT: ' + (dTor.dht_nodes !== undefined ? dTor.dht_nodes : dht);
                        }
                    }
                }
            }

            // Подсказка причины буферизации в видеоплеере Деки Б, если скорость P2P = 0 КБ/с
            var vSt = window._vidStateV130 || {};
            if (vSt.active && vSt.torHash && window._vidIsBufferingV132) {
                var vTor = list.find(function(x) { return String(x.hash || '').toLowerCase() === String(vSt.torHash).toLowerCase(); });
                var subEl = document.getElementById('v130VideoSubTelemetry');
                if (vTor && subEl && !(vTor.speed_kbps > 0) && vTor.diag_msg) {
                    subEl.innerText = vTor.diag_msg;
                }
            }
            return r;
        };
        window.refreshTorrentDaemonSnapV128._v238Wrapped = true;
    }

    // 4. Прокачка Центра закачек P2P: плашка здоровья DHT, воронка пиров и 4-я вкладка "📡 Радар / Лог"
    var _origSwitchHubTabV238 = window.switchTorHubTabV128;
    window.switchTorHubTabV128 = function(tabName, hashStr) {
        if (tabName === 'radar') {
            window.fetchTorrentEngineLogV238();
        }
        return _origSwitchHubTabV238.apply(this, arguments);
    };

    var _origRenderHubV238 = window.renderTorrentInspectorHubV128;
    window.renderTorrentInspectorHubV128 = function() {
        var pop = document.getElementById('jennyTorInspectorModalV128');
        var tabsHdr = document.getElementById('torHubTabsHeaderV128');
        var scrollBody = document.getElementById('torHubScrollBodyV128');
        if (!pop || !tabsHdr || !scrollBody) return;

        var activeTab = window._torHubTabV128 || 'torrents';
        var torList = window._torLiveDaemonSnapV128 || [];
        var meta = window._torDaemonMetaV238 || {};
        var dht = Number(meta.dht_nodes || 0);
        var trCnt = Number(meta.trackers_cached || (window._trackersStateV110 && (window._trackersStateV110.trackers || []).length) || 0);

        if (activeTab !== 'radar') {
            _origRenderHubV238.apply(this, arguments);
        }

        // Добавляем 4-ю кнопку вкладки "📡 Радар" в шапку табов
        if (!tabsHdr.querySelector('[data-tab-v238="radar"]')) {
            var mapJobs = Object.values(window._torMapV112 || {});
            var allHashesCnt = Array.from(new Set([].concat(torList.map(function(t) { return t.hash; }), mapJobs.map(function(j) { return j.hash; })))).filter(Boolean).length;
            var totalQueuedTracks = 0;
            torList.forEach(function(t) { totalQueuedTracks += (t.files || []).length; });
            var tabStyle = function(id) {
                var on = (activeTab === id);
                return 'flex:1;padding:6px 4px;font-size:10.5px;font-weight:900;border-radius:8px;border:1px solid ' +
                    (on ? '#d2a8ff' : '#30363d') + ';background:' + (on ? 'rgba(210,168,255,0.22)' : '#11161f') +
                    ';color:' + (on ? '#fff' : '#8b949e') + ';';
            };
            tabsHdr.innerHTML =
                '<button type="button" onclick="window.switchTorHubTabV128(\'torrents\')" style="' + tabStyle('torrents') + '">📦 Раздачи (' + allHashesCnt + ')</button>' +
                '<button type="button" onclick="window.switchTorHubTabV128(\'tracks\')" style="' + tabStyle('tracks') + '">🎵 Треки (' + totalQueuedTracks + ')</button>' +
                '<button type="button" onclick="window.switchTorHubTabV128(\'pieces\')" style="' + tabStyle('pieces') + '">🧩 Части</button>' +
                '<button type="button" data-tab-v238="radar" onclick="window.switchTorHubTabV128(\'radar\')" style="' + tabStyle('radar') + '">📡 Радар</button>';
        }

        var dhtClr = dht > 15 ? '#3fb950' : (dht > 0 ? '#e3b341' : '#ff7b72');

        if (activeTab === 'torrents') {
            var prevTop = scrollBody.scrollTop;
            var topSummaryHtml =
                '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 9px;background:#080c13;border:1px solid #262c36;border-radius:8px;font-size:10.5px;">' +
                    '<span style="color:' + dhtClr + ';font-weight:900;">🌐 Узлов DHT: ' + dht + '</span>' +
                    '<span style="color:#58a6ff;font-weight:bold;">🕸️ Трекеров: ' + trCnt + '</span>' +
                    '<span style="color:#d2a8ff;font-weight:bold;">🚀 ' + (meta.version || 'Go P2P') + '</span>' +
                '</div>';

            var diagCardsHtml = torList.filter(function(t) { return Boolean(t.diag_msg); }).map(function(t) {
                var bClr = t.diag_status === 'dead' ? '#f85149' : (t.diag_status === 'warn' ? '#e3b341' : '#3fb950');
                var srcTag = t.meta_source ? (' • 🏷️ ' + t.meta_source) : '';
                return '<div style="padding:6px 9px;background:#0a0f18;border-left:3px solid ' + bClr + ';border-top:1px solid #21262d;border-right:1px solid #21262d;border-bottom:1px solid #21262d;border-radius:7px;font-size:10px;line-height:1.38;">' +
                    '<div style="color:#e6edf3;font-weight:bold;">' + String(t.name || t.hash).slice(0, 58) + '</div>' +
                    '<div style="color:' + bClr + ';font-weight:800;margin-top:2px;">' + t.diag_msg + '</div>' +
                    '<div style="color:#8b949e;margin-top:2px;">Рой: <b>' + (t.total_peers || 0) + '</b> ➔ Полуоткр: <b>' + (t.half_open || 0) + '</b> ➔ На связи: <b>' + (t.peers || 0) + '</b> (сидов: <b>' + (t.seeders || 0) + '</b>) • В полёте кусков: <b>' + (t.pieces_partial || 0) + '</b>' + srcTag + '</div>' +
                '</div>';
            }).join('');

            scrollBody.insertAdjacentHTML('afterbegin', topSummaryHtml + diagCardsHtml);
            if (prevTop > 0) scrollBody.scrollTop = prevTop;
            return;
        }

        if (activeTab === 'radar') {
            var prevMainScroll = scrollBody.scrollTop;
            var oldPre = document.getElementById('torEngineLogPreV238');
            var prevLogScroll = oldPre ? oldPre.scrollTop : -1;

            var dhtVerdict = dht > 15
                ? '🟢 Сеть DHT полностью открыта (' + dht + ' узлов) — поиск пиров работает штатно.'
                : (dht > 0
                    ? '🟡 Сеть DHT набирает узлы (' + dht + ' шт.) — подожди 5–10 сек или обнови трекеры.'
                    : '🔴 0 узлов DHT — твой VPN или мобильный оператор режет входящий/исходящий UDP.');

            var funnelRows = torList.length
                ? torList.map(function(t) {
                    var bClr = t.diag_status === 'dead' ? '#ff7b72' : (t.diag_status === 'warn' ? '#e3b341' : '#3fb950');
                    return '<div style="padding:8px 9px;background:#0d1117;border:1px solid #262c36;border-radius:8px;display:flex;flex-direction:column;gap:4px;">' +
                        '<div style="font-size:11.5px;font-weight:900;color:#e6edf3;">💿 ' + (t.name || t.hash) + '</div>' +
                        '<div style="font-size:10.5px;font-weight:800;color:' + bClr + ';">' + (t.diag_msg || 'Активен') + '</div>' +
                        '<div style="font-size:10px;color:#8b949e;">Воронка: найдено <b>' + (t.total_peers || 0) + '</b> ➔ рукопожатие <b>' + (t.half_open || 0) + '</b> ➔ подключено <b>' + (t.peers || 0) + '</b> ➔ сидов <b>' + (t.seeders || 0) + '</b></div>' +
                        '<div style="font-size:10px;color:#79c0ff;">Кусков в полёте: <b>' + (t.pieces_partial || 0) + '</b> • Готово: <b>' + (t.pieces_complete || 0) + '/' + (t.num_pieces || 0) + '</b> • Источник: <b>' + (t.meta_source || 'dht') + '</b></div>' +
                    '</div>';
                }).join('')
                : '<div style="padding:12px;text-align:center;color:#8b949e;font-size:11px;background:#0d1117;border:1px solid #21262d;border-radius:8px;">Сейчас нет активных раздач в движке.</div>';

            var logLines = window._torEngineLogLinesV238 || [];
            var logText = logLines.length
                ? logLines.slice(-120).join('\n').replace(/</g, '&lt;')
                : 'Лог чист (ошибок сокетов и пайпов нет). Нажми «Обновить лог» для чтения буфера.';

            scrollBody.innerHTML =
                '<div style="padding:9px 10px;background:#0d1117;border:1px solid ' + dhtClr + ';border-radius:9px;display:flex;flex-direction:column;gap:6px;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                        '<span style="font-size:11.5px;font-weight:900;color:#d2a8ff;">🛰️ Диагностика P2P-узла (' + (meta.version || 'v2.0-diag') + ')</span>' +
                        '<span style="font-size:10.5px;color:#58a6ff;font-weight:bold;">🕸️ Трекеров: ' + trCnt + '</span>' +
                    '</div>' +
                    '<div style="font-size:11px;color:#e6edf3;line-height:1.4;">' + dhtVerdict + '</div>' +
                    '<div style="display:flex;gap:6px;margin-top:2px;">' +
                        '<button type="button" onclick="window.manualUpdateTrackersNowV110(this)" style="flex:1;padding:6px 8px;font-size:10.5px;font-weight:bold;border-radius:7px;background:rgba(35,134,54,0.22);border:1px solid #3fb950;color:#3fb950;">🔄 Пинг трекеров (BEP-15)</button>' +
                        '<button type="button" onclick="window.fetchTorrentEngineLogV238()" style="flex:1;padding:6px 8px;font-size:10.5px;font-weight:bold;border-radius:7px;background:#161b22;border:1px solid #58a6ff;color:#58a6ff;">📄 Обновить лог</button>' +
                    '</div>' +
                '</div>' +
                funnelRows +
                '<div style="font-size:10.5px;color:#8b949e;font-weight:bold;margin-top:2px;">📜 Живой кольцевой буфер libjtorrent.so:</div>' +
                '<pre id="torEngineLogPreV238" style="max-height:190px;overflow:auto;margin:0;padding:8px;background:#05070a;border:1px solid #21262d;border-radius:8px;color:#c9d1d9;font-size:10px;line-height:1.36;white-space:pre-wrap;word-break:break-word;">' + logText + '</pre>';

            if (prevMainScroll > 0) scrollBody.scrollTop = prevMainScroll;
            var newPre = document.getElementById('torEngineLogPreV238');
            if (newPre) {
                newPre.scrollTop = prevLogScroll >= 0 ? prevLogScroll : newPre.scrollHeight;
            }
        }
    };
})();

/* [split] V243: кусок исходного IIFE (ui_v71.js, строки 35225–35944) → ui_torrent.js */
;(function() {
    if (window._jennyV243Installed__torrent) return;
    window._jennyV243Installed__torrent = true;
    window._jennyV243Installed = true;
    window._torExpandedDiagHashesV243 = {};

    // -------------------------------------------------------------------------
    // 5. ЦЕНТР ЗАКАЧЕК P2P: СКРЫТИЕ ОРИГ/WAV НА MP3 + СВОРАЧИВАЕМАЯ КНОПКА 📡 ИНФО В КАРТОЧКЕ
    // -------------------------------------------------------------------------
    window.toggleTorCardDiagV243 = function(hash, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var h = String(hash || '').toLowerCase();
        window._torExpandedDiagHashesV243[h] = !window._torExpandedDiagHashesV243[h];
        window.renderTorrentInspectorHubV128();
    };

    var _prevRenderHubV243 = window.renderTorrentInspectorHubV128;
    if (typeof _prevRenderHubV243 === 'function' && !_prevRenderHubV243._v243Wrapped) {
        window.renderTorrentInspectorHubV128 = function() {
            var r = _prevRenderHubV243.apply(this, arguments);
            var scrollBody = document.getElementById('torHubScrollBodyV128');
            if (!scrollBody) return r;
            var activeTab = window._torHubTabV128 || 'torrents';

            if (activeTab === 'tracks') {
                // Оставляем кнопки «Добавить ориг» / «Добавить WAV» строго для Lossless (.flac / .ape / .wv / .alac)
                scrollBody.querySelectorAll('button[onclick*="addP2pCompareFileToPlayerV162"]').forEach(function(btn) {
                    var oc = String(btn.getAttribute('onclick') || '');
                    var isLossless = /\.(flac|ape|wv|alac)\s*'/i.test(oc);
                    if (!isLossless && btn.parentElement) {
                        btn.parentElement.remove();
                    }
                });
            } else if (activeTab === 'torrents') {
                // Убираем верхнюю стопку диагностических карточек и переносим их внутрь каждой карточки раздачи под кнопку [📡 Инфо]
                Array.from(scrollBody.children).forEach(function(ch) {
                    var st = String(ch.getAttribute('style') || '');
                    if (st.indexOf('border-left:3px solid') !== -1 || st.indexOf('border-left: 3px solid') !== -1) {
                        ch.remove();
                    }
                });

                var torList = window._torLiveDaemonSnapV128 || [];
                scrollBody.querySelectorAll('button[onclick*="jumpToTorrentFilesFromHubV128"]').forEach(function(fBtn) {
                    var m = String(fBtn.getAttribute('onclick') || '').match(/jumpToTorrentFilesFromHubV128\('([^']+)'\)/);
                    if (!m) return;
                    var h = String(m[1] || '').toLowerCase();
                    var btnRow = fBtn.parentElement;
                    var card = btnRow ? btnRow.parentElement : null;
                    if (!btnRow || !card || btnRow.querySelector('[data-diag-btn-v243]')) return;

                    var dTor = torList.find(function(x) { return String(x.hash || '').toLowerCase() === h; }) || {};
                    var isExp = Boolean(window._torExpandedDiagHashesV243[h]);

                    var infoBtn = document.createElement('button');
                    infoBtn.type = 'button';
                    infoBtn.setAttribute('data-diag-btn-v243', h);
                    infoBtn.onclick = function(ev) { window.toggleTorCardDiagV243(h, ev); };
                    infoBtn.style.cssText = 'padding:5px 7px;font-size:10.5px;border-radius:7px;font-weight:bold;background:' +
                        (isExp ? 'rgba(57,197,207,0.24)' : '#161b22') + ';color:' + (isExp ? '#39c5cf' : '#79c0ff') +
                        ';border:1px solid ' + (isExp ? '#39c5cf' : '#30363d') + ';';
                    infoBtn.innerText = '📡';
                    infoBtn.title = 'Диагностика роя и соединений';

                    var piecesBtn = btnRow.querySelector('button[onclick*="pieces"]');
                    if (piecesBtn && piecesBtn.nextSibling) btnRow.insertBefore(infoBtn, piecesBtn.nextSibling);
                    else btnRow.appendChild(infoBtn);

                    if (isExp) {
                        var bClr = dTor.diag_status === 'dead' ? '#f85149' : (dTor.diag_status === 'warn' ? '#e3b341' : '#3fb950');
                        var srcTag = dTor.meta_source ? (' • 🏷️ ' + dTor.meta_source) : '';
                        var box = document.createElement('div');
                        box.style.cssText = 'margin-top:4px;padding:6px 8px;background:#080c14;border-left:3px solid ' + bClr + ';border-radius:6px;font-size:10px;line-height:1.4;';
                        box.innerHTML =
                            '<div style="color:' + bClr + ';font-weight:800;">' + (dTor.diag_msg || 'Ожидание телеметрии демона...') + '</div>' +
                            '<div style="color:#8b949e;margin-top:2px;">Рой: <b>' + (dTor.total_peers || 0) + '</b> ➔ Полуоткр: <b>' + (dTor.half_open || 0) +
                            '</b> ➔ На связи: <b>' + (dTor.peers || 0) + '</b> (сидов: <b>' + (dTor.seeders || 0) + '</b>) • В полёте: <b>' + (dTor.pieces_partial || 0) + '</b>' + srcTag + '</div>';
                        card.appendChild(box);
                    }
                });
            }
            return r;
        };
        window.renderTorrentInspectorHubV128._v243Wrapped = true;
    }
})();

/* [split] V370: кусок исходного IIFE (ui_v71.js, строки 37843–38397) → ui_torrent.js */
;(function() {
    if (window._jennyV370DeckAFullTrackPatchInstalled__torrent) return;
    window._jennyV370DeckAFullTrackPatchInstalled__torrent = true;
    window._jennyV370DeckAFullTrackPatchInstalled = true;

    // -------------------------------------------------------------------------
    // 3. ЗАЩИТА prioritizeRamPieceAtCursorV72 ОТ ЛОЖНОГО СБРОСА ПРИ ВНУТРЕННЕЙ СИНХРОНИЗАЦИИ ЧАСОВ
    //    И БЫСТРАЯ ПАРАЛЛЕЛЬНАЯ РАСПАКОВКА decodeHugeTrackToRamV71 БЕЗ ОБРЫВА НА 30 СЕКУНДЕ!
    // -------------------------------------------------------------------------
    var _origPrioritizePieceV370 = window.prioritizeRamPieceAtCursorV72;
    window.prioritizeRamPieceAtCursorV72 = function() {
        if (window._internalSeekSyncGuardV370 || window._bgPieceFetchProtectedV370) {
            return;
        }
        if (typeof _origPrioritizePieceV370 === 'function') {
            return _origPrioritizePieceV370.apply(this, arguments);
        }
    };

    function invalidateDeckAHoseCacheV370() {
        if (window._hoseSplicerCacheV46) {
            window._hoseSplicerCacheV46.srcBuffer = null;
            window._hoseSplicerCacheV46.splicedBuffer = null;
        }
    }
})();
