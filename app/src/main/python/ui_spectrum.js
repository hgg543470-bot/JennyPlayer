/* ============================================================================
 * ui_spectrum.js — Анализатор спектра и осциллограф (V62)
 *
 * Склейка:  /bundle_1_studio.js, модуль 10 из 12. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   ensureSpectrumAnalysersV62, ensureSpectrumModalDOMV62, toggleSpecSourceModeV62, resetSpecPeaksV62, toggleSpecFreezeV62, startSpectrumLoopV62, toggleModal, openSpectrumModalV62
 * Откуда:   ui_help.js (коммит 9ae6639), строки 4202–4532. Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */



// 📊 ПАТЧ V62 (ЭТАП 3): ОКНО АНАЛИЗАТОРА СПЕКТРА (FFT) + ОСЦИЛЛОГРАФА И ЛАБОРАТОРИИ ШВОВ

window._jennySpecStateV62 = {
    analyserPost: null,
    analyserPre: null,
    sourceMode: 'post', // 'post' (после всех DSP) или 'pre' (чистый вход inputMixer)
    frozen: false,
    peakHold: new Float32Array(64),
    peakDecay: 0.45,
    rafId: null
};

window.ensureSpectrumAnalysersV62 = function() {
    if (!window.audioCtx) return null;
    const st = window._jennySpecStateV62;
    try {
        if (!st.analyserPost || st.analyserPost.context !== window.audioCtx) {
            st.analyserPost = window.audioCtx.createAnalyser();
            st.analyserPost.fftSize = 2048;
            st.analyserPost.smoothingTimeConstant = 0.78;
            st.analyserPost.minDecibels = -90;
            st.analyserPost.maxDecibels = -6;
            if (window.masterAntiClickGain) {
                window.masterAntiClickGain.connect(st.analyserPost);
            }
        }
        if (!st.analyserPre || st.analyserPre.context !== window.audioCtx) {
            st.analyserPre = window.audioCtx.createAnalyser();
            st.analyserPre.fftSize = 2048;
            st.analyserPre.smoothingTimeConstant = 0.78;
            st.analyserPre.minDecibels = -90;
            st.analyserPre.maxDecibels = -6;
            if (window.preAmpNode) {
                window.preAmpNode.connect(st.analyserPre);
            }
        }
    } catch (e) {}
    return st.sourceMode === 'pre' ? st.analyserPre : st.analyserPost;
};

// Переподключаем pre-анализатор при перестройке графа DSP
;(function() {
    const origBuildCore = window._buildAudioGraphCore;
    if (typeof origBuildCore === 'function' && !window._specGraphHookedV62) {
        window._specGraphHookedV62 = true;
        window._buildAudioGraphCore = function() {
            const r = origBuildCore.apply(this, arguments);
            try {
                const st = window._jennySpecStateV62;
                if (st.analyserPre && window.preAmpNode) window.preAmpNode.connect(st.analyserPre);
                if (st.analyserPost && window.masterAntiClickGain) window.masterAntiClickGain.connect(st.analyserPost);
            } catch (e) {}
            return r;
        };
    }
})();

window.ensureSpectrumModalDOMV62 = function() {
    let sm = document.getElementById('specModal');
    if (!sm) {
        sm = document.createElement('div');
        sm.id = 'specModal';
        sm.className = 'modal-overlay';
        sm.innerHTML = `
            <div class="container" id="specModalContainerV62">
                <div class="jenny-uniform-card" style="background:var(--bg-setting-box);border:1px solid var(--border-uniform);border-radius:10px;padding:10px;margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">
                        <span style="font-size:12.5px;font-weight:bold;color:#58a6ff;">📊 ${window.tr('FFT Анализатор Спектра (20 Гц – 20 кГц)', 'FFT Spectrum Analyzer (20 Hz – 20 kHz)')}</span>
                        <div style="display:flex;gap:4px;align-items:center;">
                            <button type="button" id="btnSpecSourceV62" onclick="window.toggleSpecSourceModeV62()" style="font-size:10px;padding:3px 7px;border-radius:5px;border:1px solid #3fb950;background:#161b22;color:#3fb950;">Пост-DSP (Мастер)</button>
                            <button type="button" onclick="window.resetSpecPeaksV62()" style="font-size:10px;padding:3px 7px;border-radius:5px;border:1px solid #30363d;background:#161b22;color:#e3b341;">Сброс пиков</button>
                            <button type="button" id="btnSpecFreezeV62" onclick="window.toggleSpecFreezeV62(this)" style="font-size:10px;padding:3px 7px;border-radius:5px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;">❄️ Стоп</button>
                        </div>
                    </div>
                    <canvas id="jennyFftCanvasV62" width="360" height="145" style="width:100%;height:145px;display:block;background:#05070a;border:1px solid #21262d;border-radius:6px;"></canvas>
                    <div id="jennyFftBandsTelemetryV62" style="display:flex;justify-content:space-between;font-size:10.5px;font-family:monospace;color:#8b949e;margin-top:6px;padding:0 2px;">
                        <span id="fftSubTextV62" style="color:#a371f7;">🔊 Бас (20-200Гц): -∞ dB</span>
                        <span id="fftMidTextV62" style="color:#3fb950;">🎤 СЧ (200-4кГц): -∞ dB</span>
                        <span id="fftHighTextV62" style="color:#58a6ff;">✨ ВЧ (4-20кГц): -∞ dB</span>
                    </div>
                </div>
                <div id="specWaveLabSlotV62"></div>
            </div>
        `;
        const refModal = document.getElementById('eqModal') || document.getElementById('settingsModal');
        if (refModal && refModal.parentNode) {
            refModal.parentNode.insertBefore(sm, refModal.nextSibling);
        } else {
            document.body.appendChild(sm);
        }
    }

    // Переносим блок осциллографа и лаборатории швов внутрь окна Анализатора спектра
    const waveCanvas = document.getElementById('hoseWaveScopeCanvasV49');
    const slot = document.getElementById('specWaveLabSlotV62');
    if (waveCanvas && slot && !slot.contains(waveCanvas)) {
        const waveCard = waveCanvas.parentElement;
        if (waveCard) {
            waveCard.style.marginTop = '0';
            waveCard.style.padding = '10px';
            slot.appendChild(waveCard);

            // Упаковываем отладчик швов и сэмпл-резак в аккуратный спойлер внутри этого же окна
            const ta = document.getElementById('hoseDebugTextAreaV52');
            const sliceBox = document.getElementById('hoseSliceBoxV59') || document.getElementById('hoseSliceBoxV58');
            if (ta && !document.getElementById('seamLabCollapsibleV62')) {
                const dbgBlock = ta.parentElement;
                const det = document.createElement('details');
                det.id = 'seamLabCollapsibleV62';
                det.open = true;
                det.style.cssText = 'margin-top:8px;border-top:1px solid #21262d;padding-top:6px;';
                det.innerHTML = `<summary style="font-size:11px;color:#f0883e;font-weight:bold;cursor:pointer;outline:none;">🔬 Инженерная лаборатория 90° швов и Сэмпл-Резак</summary><div id="seamLabInnerV62" style="margin-top:6px;"></div>`;
                waveCard.appendChild(det);
                const inner = det.querySelector('#seamLabInnerV62');
                if (dbgBlock && dbgBlock !== waveCard) inner.appendChild(dbgBlock);
                if (sliceBox) inner.appendChild(sliceBox);
            }
        }

        // В настройках под ползунком упругости ставим кнопку быстрого открытия Анализатора и Осциллографа
        const hoseBox = document.getElementById('hoseControlBoxV44');
        if (hoseBox && !document.getElementById('openSpecShortcutBtnV62')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = 'openSpecShortcutBtnV62';
            btn.onclick = () => window.openSpectrumModalV62();
            btn.style.cssText = 'width:100%;margin-top:8px;padding:8px;background:#0d1117;border:1px solid var(--border-uniform);color:#58a6ff;border-radius:7px;font-size:11.5px;';
            btn.innerHTML = '📊 ' + window.tr('Открыть Анализатор спектра и Осциллограф волны', 'Open Spectrum Analyzer & Wave Scope');
            hoseBox.appendChild(btn);
        }
    }
};

window.toggleSpecSourceModeV62 = function() {
    const st = window._jennySpecStateV62;
    st.sourceMode = (st.sourceMode === 'post') ? 'pre' : 'post';
    const btn = document.getElementById('btnSpecSourceV62');
    if (btn) {
        if (st.sourceMode === 'post') {
            btn.innerText = window.tr('Пост-DSP (Мастер)', 'Post-DSP (Master)');
            btn.style.borderColor = '#3fb950';
            btn.style.color = '#3fb950';
        } else {
            btn.innerText = window.tr('До-DSP (Вход)', 'Pre-DSP (Raw In)');
            btn.style.borderColor = '#58a6ff';
            btn.style.color = '#58a6ff';
        }
    }
};

window.resetSpecPeaksV62 = function() {
    window._jennySpecStateV62.peakHold.fill(0);
};

window.toggleSpecFreezeV62 = function(btn) {
    const st = window._jennySpecStateV62;
    st.frozen = !st.frozen;
    if (btn) {
        btn.innerText = st.frozen ? '▶️ Пуск' : '❄️ Стоп';
        btn.style.borderColor = st.frozen ? '#f0883e' : '#30363d';
        btn.style.color = st.frozen ? '#f0883e' : '#c9d1d9';
    }
};

window.startSpectrumLoopV62 = function() {
    const st = window._jennySpecStateV62;
    if (st.rafId) cancelAnimationFrame(st.rafId);

    const freqData = new Uint8Array(1024);
    const numBars = 64;

    const draw = () => {
        const sm = document.getElementById('specModal');
        const cv = document.getElementById('jennyFftCanvasV62');
        if (sm && sm.classList.contains('open') && cv && !st.frozen) {
            const ctx = cv.getContext('2d');
            const W = cv.width;
            const H = cv.height;
            const plotH = H - 18;
            const plotX = 28;
            const plotW = W - plotX - 4;

            ctx.fillStyle = '#05070a';
            ctx.fillRect(0, 0, W, H);

            // Горизонтальная сетка децибел
            ctx.strokeStyle = 'rgba(139,148,158,0.14)';
            ctx.fillStyle = '#6e7681';
            ctx.font = '9px monospace';
            ctx.lineWidth = 1;
            [
                { db: ' 0dB', y: 8 },
                { db: '-20',  y: Math.round(plotH * 0.33) },
                { db: '-45',  y: Math.round(plotH * 0.66) },
                { db: '-80',  y: plotH }
            ].forEach(g => {
                ctx.beginPath();
                ctx.moveTo(plotX, g.y);
                ctx.lineTo(W - 2, g.y);
                ctx.stroke();
                ctx.fillText(g.db, 2, g.y + 3);
            });

            // Подписи частот снизу (60 Гц, 230 Гц, 910 Гц, 3.6 кГц, 14 кГц)
            const marks = [
                { lbl: '60',   f: 60 },
                { lbl: '230',  f: 230 },
                { lbl: '910',  f: 910 },
                { lbl: '3.6k', f: 3600 },
                { lbl: '14k',  f: 14000 }
            ];
            marks.forEach(m => {
                const normX = Math.log10(m.f / 20) / Math.log10(20000 / 20);
                const x = plotX + Math.round(normX * plotW);
                ctx.strokeStyle = 'rgba(88,166,255,0.12)';
                ctx.beginPath();
                ctx.moveTo(x, 4);
                ctx.lineTo(x, plotH);
                ctx.stroke();
                ctx.fillStyle = '#8b949e';
                ctx.fillText(m.lbl, x - 10, H - 4);
            });

            const an = window.ensureSpectrumAnalysersV62();
            if (an) {
                an.getByteFrequencyData(freqData);
                const sr = (window.audioCtx && window.audioCtx.sampleRate) ? window.audioCtx.sampleRate : 48000;
                const binCount = an.frequencyBinCount;

                let subSum = 0, subCnt = 0;
                let midSum = 0, midCnt = 0;
                let highSum = 0, highCnt = 0;

                const barW = Math.max(2, (plotW / numBars) - 1.2);

                for (let i = 0; i < numBars; i++) {
                    const fLow = 20 * Math.pow(1000, i / numBars);
                    const fHigh = 20 * Math.pow(1000, (i + 1) / numBars);
                    let b0 = Math.max(1, Math.floor((fLow * binCount * 2) / sr));
                    let b1 = Math.min(binCount - 1, Math.ceil((fHigh * binCount * 2) / sr));
                    if (b1 < b0) b1 = b0;

                    let maxVal = 0;
                    for (let b = b0; b <= b1; b++) {
                        if (freqData[b] > maxVal) maxVal = freqData[b];
                    }

                    const fCenter = 0.5 * (fLow + fHigh);
                    if (fCenter <= 200) { subSum += maxVal; subCnt++; }
                    else if (fCenter <= 4000) { midSum += maxVal; midCnt++; }
                    else { highSum += maxVal; highCnt++; }

                    if (maxVal >= st.peakHold[i]) {
                        st.peakHold[i] = maxVal;
                    } else {
                        st.peakHold[i] = Math.max(0, st.peakHold[i] - st.peakDecay);
                    }

                    const hBar = Math.round((maxVal / 255) * (plotH - 6));
                    const hPeak = Math.round((st.peakHold[i] / 255) * (plotH - 6));
                    const x = plotX + i * (plotW / numBars);

                    // Градиент столбика: фиолетовый бас -> изумрудная середина -> голубой воздух
                    if (fCenter <= 220) ctx.fillStyle = '#a371f7';
                    else if (fCenter <= 3800) ctx.fillStyle = '#3fb950';
                    else ctx.fillStyle = '#58a6ff';

                    if (hBar > 0) {
                        ctx.fillRect(x, plotH - hBar, barW, hBar);
                    }
                    if (hPeak > 1) {
                        ctx.fillStyle = '#e3b341';
                        ctx.fillRect(x, plotH - hPeak - 2, barW, 2);
                    }
                }

                const toDbStr = (avg) => avg < 1 ? '-∞ dB' : (-84 + (avg / 255) * 80).toFixed(1) + ' dB';
                const subEl = document.getElementById('fftSubTextV62');
                const midEl = document.getElementById('fftMidTextV62');
                const highEl = document.getElementById('fftHighTextV62');
                if (subEl) subEl.innerText = `🔊 Бас: ${toDbStr(subSum / Math.max(1, subCnt))}`;
                if (midEl) midEl.innerText = `🎤 СЧ: ${toDbStr(midSum / Math.max(1, midCnt))}`;
                if (highEl) highEl.innerText = `✨ ВЧ: ${toDbStr(highSum / Math.max(1, highCnt))}`;
            }
        }
        st.rafId = requestAnimationFrame(draw);
    };
    st.rafId = requestAnimationFrame(draw);
};

// Интегрируем specModal в общий переключатель модальных окон toggleModal
;(function() {
    window.toggleModal = function(id) {
        window.ensureSpectrumModalDOMV62();
        const tm = document.getElementById('themeModal');
        if (tm && tm.classList.contains('open') && id === 'settingsModal') {
            tm.classList.remove('open');
            return;
        }
        if (tm) tm.classList.remove('open');

        const modals = ['settingsModal', 'favModal', 'eqModal', 'specModal'];
        const target = document.getElementById(id);
        const btnTarget = document.getElementById('btn-' + id);
        if (!target) return;
        const wasOpen = target.classList.contains('open');

        modals.forEach(m => {
            const el = document.getElementById(m);
            const btn = document.getElementById('btn-' + m);
            if (el) el.classList.remove('open');
            if (btn) btn.style.color = '';
        });

        if (!wasOpen) {
            target.classList.add('open');
            if (btnTarget) btnTarget.style.color = '#3fb950';
        }
        if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
        if (typeof window.updateModalGpuLockV41 === 'function') window.updateModalGpuLockV41();
    };
})();

window.openSpectrumModalV62 = function() {
    if (typeof window.initAudioBoost === 'function') window.initAudioBoost();
    window.ensureSpectrumModalDOMV62();
    window.ensureSpectrumAnalysersV62();
    window.toggleModal('specModal');
};

setTimeout(() => {
    window.ensureSpectrumModalDOMV62();
    window.startSpectrumLoopV62();
}, 680);
