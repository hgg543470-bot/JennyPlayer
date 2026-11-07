#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, re

_orig_sub = re.sub
re.sub = lambda pat, repl, string, *a, **kw: _orig_sub(pat, (repl if callable(repl) else (lambda _: repl)), string, *a, **kw)

BASE_DIR = "/storage/emulated/0/scripts/JennyPlayer"
if not os.path.exists(BASE_DIR):
    BASE_DIR = os.getcwd()

V209_MODULAR_UI_AND_AUTOHIDE = r"""/* ================= JENNY V209: COLLAPSED PLAYER PILLS, ZERO-TRACE OFF, & 0.1s AUTO-HIDE (MAIN + PIP) ================= */
(function() {
    if (window._jennyV209Installed) return;
    window._jennyV209Installed = true;

    var savedFlags = {};
    try { savedFlags = JSON.parse(localStorage.getItem('jenny_lab_flags_v208') || '{}') || {}; } catch (e) {}

    window._jennyLabFlagsV208 = {
        core120:      Boolean(savedFlags.core120),      // Генератор кадров 120Hz & Матрица .SO
        splitTest:    Boolean(savedFlags.splitTest),    // Кнопка режима сравнения (Сплит)
        logDots:      Boolean(savedFlags.logDots),      // Кнопка лога с точками
        tunerSliders: Boolean(savedFlags.tunerSliders), // Кнопка крутилок декодера
        stub1:        savedFlags.stub1 !== undefined ? Boolean(savedFlags.stub1) : true, // Автоскрытие управления (Плеер)
        stub2:        savedFlags.stub2 !== undefined ? Boolean(savedFlags.stub2) : true, // Автоскрытие управления (PiP)
        stub3:        Boolean(savedFlags.stub3),
        stub4:        Boolean(savedFlags.stub4),
        stub5:        Boolean(savedFlags.stub5)
    };

    var rawMainSec = parseFloat(localStorage.getItem('jenny_autohide_main_sec_v209') || '3.0');
    var rawPipSec  = parseFloat(localStorage.getItem('jenny_autohide_pip_sec_v209')  || '2.0');
    window._jennyAutoHideSecV209 = {
        main: Number.isFinite(rawMainSec) ? Math.max(0.5, Math.min(60.0, Math.round(rawMainSec * 10) / 10)) : 3.0,
        pip:  Number.isFinite(rawPipSec)  ? Math.max(0.5, Math.min(60.0, Math.round(rawPipSec  * 10) / 10)) : 2.0
    };

    // По умолчанию играет чистый дефолт ('off'), а сплит и 120Hz включаются свернутыми кнопками в плеере
    window._jennySplitExpandedV209 = false;
    window._jenny120ExpandedV209   = false;
    var isLogCollapsed   = true;
    var isTunerCollapsed = true;

    if (window._jv166Metrics) {
        window._jv166Metrics.mode = 'off';
    }
    window._jennyExp120HzEnabledV205 = false;

    window.saveJennyLabFlagsV208 = function() {
        try { localStorage.setItem('jenny_lab_flags_v208', JSON.stringify(window._jennyLabFlagsV208)); } catch (e) {}
    };

    window.updateActiveEngineModeV209 = function() {
        var fl = window._jennyLabFlagsV208 || {};
        if (!fl.splitTest) window._jennySplitExpandedV209 = false;
        if (!fl.core120)   window._jenny120ExpandedV209   = false;

        var newMode = 'off';
        if (fl.splitTest && window._jennySplitExpandedV209) {
            newMode = 'split';
        } else if (fl.core120 && window._jenny120ExpandedV209) {
            newMode = '120';
        }

        if (window._jv166Metrics) {
            window._jv166Metrics.mode = newMode;
        }
        window._jennyExp120HzEnabledV205 = (newMode !== 'off');

        var glCv = document.getElementById('jv166InterpCanvas');
        if (glCv && newMode === 'off') {
            glCv.style.setProperty('display', 'none', 'important');
        }
        var spLine = document.getElementById('jv168SplitLine');
        if (spLine) {
            if (newMode === 'split') {
                spLine.style.setProperty('display', 'block', 'important');
                if (typeof window.updateSplitLineUI === 'function') window.updateSplitLineUI(spLine);
            } else {
                spLine.style.setProperty('display', 'none', 'important');
            }
        }
        if (typeof window.updateVideoHeaderTelemetryV166 === 'function') {
            window.updateVideoHeaderTelemetryV166();
        }
    };

    window._jennySplitRatioV176 = parseFloat(localStorage.getItem('jenny_split_ratio') || '0.5') || 0.5;
    window._jennySplitSwappedV176 = (localStorage.getItem('jenny_split_swap') === '1');

    var TUNER_SPECS = [
        { key: 'dupThresh',    label: 'Дубль ±Y (0=Выкл)',    min: 0.0, max: 255.0, def: 0.0,   fmt: 0, color: '#ff9100' },
        { key: 'targetFps',    label: 'Целевой FPS (0=Авто)', min: 0.0, max: 180.0, def: 120.0, fmt: 0, color: '#ffea00' },
        { key: 'flowScale',    label: 'Сдвиг (Scale)',        min: 0.0, max: 2.50,  def: 0.85,  fmt: 2, color: '#00ff9d' },
        { key: 'ghostGate',    label: 'Шлейф (Gate)',         min: 0.02, max: 0.45, def: 0.12,  fmt: 2, color: '#ff5252' },
        { key: 'detailGuard',  label: 'Детали (Guard)',       min: 0.0, max: 1.00,  def: 0.45,  fmt: 2, color: '#00e5ff' },
        { key: 'bridgeSpread', label: 'Мост (Bridge)',        min: 0.0, max: 1.00,  def: 0.35,  fmt: 2, color: '#e040fb' },
        { key: 'searchRadius', label: 'Радар (Rad px)',       min: 4.0, max: 48.0,  def: 15.0,  fmt: 1, color: '#ffd740' },
        { key: 'inkGuard',     label: 'Контур (Ink)',         min: 0.0, max: 1.00,  def: 0.50,  fmt: 2, color: '#69f0ae' },
        { key: 'pllSmooth',    label: 'Ритм (PLL)',           min: 0.10, max: 0.95, def: 0.85,  fmt: 2, color: '#40c4ff' }
    ];

    window.updateSplitLineUI = function(lineEl) {
        if (!lineEl) lineEl = document.getElementById('jv168SplitLine');
        if (!lineEl) return;
        var ratio = Math.max(0.05, Math.min(0.95, window._jennySplitRatioV176 || 0.5));
        var sw = !!window._jennySplitSwappedV176;
        lineEl.style.left = (ratio * 100).toFixed(2) + '%';

        var origFps = window.getRealOrigFpsV208 ? window.getRealOrigFpsV208() : 30;
        var m = window._jv166Metrics || {};
        var genFps = m.outputFps || m.screenHz || 120;
        var origTxt = 'ОРИГ ' + origFps + ' FPS';
        var genTxt  = genFps + 'Hz MV';

        var lt = lineEl.querySelector('#jv176LeftTag');
        var rt = lineEl.querySelector('#jv176RightTag');
        if (lt && rt) {
            lt.textContent = sw ? genTxt : origTxt;
            lt.style.color = sw ? '#00ff9d' : '#ffcc00';
            lt.style.borderColor = lt.style.color;
            rt.textContent = sw ? origTxt : genTxt;
            rt.style.color = sw ? '#ffcc00' : '#00ff9d';
            rt.style.borderColor = rt.style.color;
        }
    };

    window.toggleSplitSwapV176 = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        window._jennySplitSwappedV176 = !window._jennySplitSwappedV176;
        try { localStorage.setItem('jenny_split_swap', window._jennySplitSwappedV176 ? '1' : '0'); } catch (e) {}
        window.updateSplitLineUI();
        var origFps = window.getRealOrigFpsV208 ? window.getRealOrigFpsV208() : 30;
        if (typeof window.showToast === 'function') {
            window.showToast(window._jennySplitSwappedV176
                ? ('⇄ Сплит: Слева 120Hz MV │ Справа ОРИГ ' + origFps + ' FPS')
                : ('⇄ Сплит: Слева ОРИГ ' + origFps + ' FPS │ Справа 120Hz MV'));
        }
    };

    function upgradeSplitLineV176() {
        var lineEl = document.getElementById('jv168SplitLine');
        if (!lineEl) return;
        var fl = window._jennyLabFlagsV208 || {};
        var isSplit = Boolean(fl.splitTest && window._jennySplitExpandedV209 && window._jv166Metrics && window._jv166Metrics.mode === 'split');
        lineEl.style.setProperty('display', isSplit ? 'block' : 'none', 'important');
        if (lineEl._v209Upgraded) {
            if (isSplit) window.updateSplitLineUI(lineEl);
            return;
        }
        lineEl._v209Upgraded = true;
        lineEl.style.zIndex = '99990';
        lineEl.innerHTML =
            '<div id="jv176SplitHeader" style="position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:4px;background:rgba(0,0,0,0.88);padding:4px 8px;border-radius:6px;border:1px solid #00e5ff;white-space:nowrap;pointer-events:auto;">' +
                '<span id="jv176LeftTag" style="color:#ffcc00;font-family:monospace;font-weight:900;font-size:10px;padding:1px 5px;border-radius:3px;border:1px solid #ffcc00;">ОРИГ 30 FPS</span>' +
                '<span style="color:#00e5ff;font-weight:900;font-size:13px;padding:0 3px;">⇄</span>' +
                '<span id="jv176RightTag" style="color:#00ff9d;font-family:monospace;font-weight:900;font-size:10px;padding:1px 5px;border-radius:3px;border:1px solid #00ff9d;">120Hz MV</span>' +
            '</div>' +
            '<div id="jv176SplitGrip" style="position:absolute;top:64%;left:50%;transform:translate(-50%,-50%);background:rgba(0,18,28,0.92);color:#00e5ff;border:1.5px solid #00e5ff;border-radius:14px;padding:5px 8px;font-size:11px;font-weight:bold;pointer-events:auto;box-shadow:0 0 10px rgba(0,229,255,0.6);">◀┃▶</div>';
        if (isSplit) window.updateSplitLineUI(lineEl);
    }

    var TOTAL_LOG_FRAMES = 360;
    var historyDt = new Float32Array(120);
    var historyAlpha = new Float32Array(120);
    var historyNewFrame = new Uint8Array(120);
    var histIdx = 0;

    var lastTickTime = performance.now();
    var lastCapturedAlpha = 0;
    var uploadedSinceLastDraw = 0;
    var glRendererInfo = "";

    var isLogging = false;
    var logEntries = [];

    var prevTrackDec = -1;
    var prevTrackVTime = -1;
    var lastOrigChangeTs = performance.now();
    var origHoldTicks = 0;
    var lastGeneratorStallTicks = 0;

    function getMediaPassport(vEl, glCtx) {
        if (!vEl) return "Видеоэлемент не найден\n";
        var rawSrc = vEl.currentSrc || vEl.src || "";
        var decPath = rawSrc;
        try { decPath = decodeURIComponent(rawSrc); } catch (e) {}
        var fName = decPath ? decPath.split('/').pop().split('?')[0] : "unknown";
        var totalDec = -1, droppedDec = -1;
        if (typeof vEl.getVideoPlaybackQuality === 'function') {
            var q = vEl.getVideoPlaybackQuality();
            if (q) { totalDec = q.totalVideoFrames; droppedDec = q.droppedVideoFrames; }
        }
        if (!glRendererInfo && glCtx) {
            try {
                var dbg = glCtx.getExtension('WEBGL_debug_renderer_info');
                glRendererInfo = dbg
                    ? (glCtx.getParameter(dbg.UNMASKED_VENDOR_WEBGL) + " / " + glCtx.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
                    : glCtx.getParameter(glCtx.RENDERER);
            } catch (e) {}
        }
        var modeStr = (window._jv166Metrics && window._jv166Metrics.mode) || "off";
        var origFps = window.getRealOrigFpsV208 ? window.getRealOrigFpsV208() : 30;
        var spInfo = (modeStr === 'split')
            ? (" (поз=" + Math.round((window._jennySplitRatioV176 || 0.5) * 100) + "%, " +
               (window._jennySplitSwappedV176 ? ("Слева 120Hz/Справа ОРИГ " + origFps + " FPS") : ("Слева ОРИГ " + origFps + " FPS/Справа 120Hz")) + ")")
            : "";
        var tun = window._jennyTunerV190 || {};
        return [
            "================ ПАСПОРТ МЕДИАФАЙЛА И ДВИЖКА V209 ================",
            "Файл (Имя)      : " + fName,
            "Путь / URI      : " + decPath,
            "Разрешение видео: " + (vEl.videoWidth || 0) + "x" + (vEl.videoHeight || 0) +
                " | Родной FPS: " + origFps + " к/с | Буфер WebGL: " + (glCtx ? glCtx.drawingBufferWidth + "x" + glCtx.drawingBufferHeight : "N/A"),
            "Длительность    : " + (isFinite(vEl.duration) ? vEl.duration.toFixed(2) + " сек" : "N/A") +
                " | Позиция старта лога: " + (vEl.currentTime || 0).toFixed(3) + " сек",
            "Скорость (Rate) : " + (vEl.playbackRate || 1) + "x | Режим: " + modeStr + spInfo,
            "Крутилки V209   : Dup±Y=" + Number(tun.dupThresh || 0).toFixed(0) +
                " | TargetFPS=" + Number(tun.targetFps || 120).toFixed(0) +
                " | Scale=" + Number(tun.flowScale || 0).toFixed(2) +
                " | Gate=" + Number(tun.ghostGate || 0).toFixed(2) +
                " | Guard=" + Number(tun.detailGuard || 0).toFixed(2) +
                " | Bridge=" + Number(tun.bridgeSpread || 0).toFixed(2) +
                " | Rad=" + Number(tun.searchRadius || 0).toFixed(1) +
                " | Ink=" + Number(tun.inkGuard || 0).toFixed(2) +
                " | PLL=" + Number(tun.pllSmooth || 0).toFixed(2),
            "Декодер (кадры) : всего=" + totalDec + ", пропущено(drop)=" + droppedDec + ", отсечено дублей (B==A)=" + (window._jennySkippedDupsTotal || 0),
            "GPU / Рендерер  : " + (glRendererInfo || "N/A"),
            "=================================================================="
        ].join("\n") + "\n";
    }

    function recordComparativeTickV209(glCtx, fromOffMode) {
        var now = performance.now();
        var dt = now - lastTickTime;
        lastTickTime = now;

        var up = fromOffMode ? 0 : uploadedSinceLastDraw;
        if (!fromOffMode) uploadedSinceLastDraw = 0;

        var vEl = document.getElementById('jennyVideoElV130') || document.querySelector('video');
        var dec = (window._jv207Diag && window._jv207Diag.engineDecCount > 0 && !fromOffMode)
            ? window._jv207Diag.engineDecCount
            : -1;
        if (dec < 0 && vEl && typeof vEl.getVideoPlaybackQuality === 'function') {
            var q = vEl.getVideoPlaybackQuality();
            if (q) dec = q.totalVideoFrames;
        }
        var vTime = vEl ? (vEl.currentTime || 0) : 0;
        var spd = (vEl && vEl.playbackRate > 0.01) ? vEl.playbackRate : 1.0;

        var origChanged = false;
        if (dec >= 0 && prevTrackDec >= 0) {
            if (dec < prevTrackDec || (dec - prevTrackDec) > 300) {
                prevTrackDec = dec;
                prevTrackVTime = vTime;
                lastOrigChangeTs = now;
                origHoldTicks = 1;
            } else if (dec > prevTrackDec) {
                origChanged = true;
            }
        } else if (Math.abs(vTime - prevTrackVTime) > 0.002) {
            origChanged = true;
        }
        if (prevTrackDec < 0 && dec >= 0) {
            prevTrackDec = dec;
            prevTrackVTime = vTime;
            lastOrigChangeTs = now;
        }

        var origSpanMs = now - lastOrigChangeTs;
        if (origChanged) {
            prevTrackDec = dec;
            prevTrackVTime = vTime;
            lastOrigChangeTs = now;
            origHoldTicks = 1;
        } else {
            origHoldTicks++;
        }

        var diag = window._jv207Diag || { step: 1, totalSteps: 4, alpha: lastCapturedAlpha, expectedSpanMs: 33.33 };
        var curAlpha = fromOffMode ? 0.0 : lastCapturedAlpha;

        historyDt[histIdx] = dt;
        historyAlpha[histIdx] = curAlpha;
        historyNewFrame[histIdx] = origChanged ? 1 : up;
        histIdx = (histIdx + 1) % 120;

        if (!isLogging) return;

        var totSteps = diag.totalSteps || 4;
        var stepNum = diag.step || Math.max(1, Math.round(curAlpha * totSteps));
        var expMs = diag.expectedSpanMs || (33.33 / spd);

        if (up) {
            lastGeneratorStallTicks = 0;
        } else if (curAlpha >= 0.995) {
            lastGeneratorStallTicks++;
        } else {
            lastGeneratorStallTicks = 0;
        }

        var modeNow = (window._jv166Metrics && window._jv166Metrics.mode) || 'off';
        var origCol = origChanged
            ? ("dec:" + String(dec).padEnd(6, ' ') + " НОВЫЙ(" + origSpanMs.toFixed(1).padStart(5, ' ') + "ms)")
            : ("dec:" + String(dec).padEnd(6, ' ') + " ждёт " + origSpanMs.toFixed(1).padStart(5, ' ') + "ms #" + String(origHoldTicks).padEnd(2, ' '));
        var genCol = "";
        var verdict = "";

        if (modeNow === 'off' || fromOffMode) {
            genCol = "OFF (дефолтный плеер)";
            verdict = origChanged
                ? ((origSpanMs > expMs * 1.65) ? ("⚠️ РЫВОК В САМОМ ВИДЕО (пауза " + origSpanMs.toFixed(0) + "ms)") : "📸 Кадр оригинала")
                : ((origSpanMs > expMs * 1.65) ? ("⚠️ ЗАТУП ИСХОДНИКА (нет кадра " + origSpanMs.toFixed(0) + "ms)") : "⏳ Показ оригинала");
        } else {
            var texTag = up ? "tex:1" : (origChanged ? "tex:DUP" : "tex:0");
            var stepTag = String(stepNum).padStart(2, '0') + "/" + String(totSteps).padStart(2, '0');
            genCol = texTag.padEnd(7, ' ') + " | " + stepTag + " | a:" + curAlpha.toFixed(3);

            if (origChanged && up) {
                verdict = (origSpanMs > expMs * 1.65)
                    ? ("⚠️ ОРИГ опоздал (" + origSpanMs.toFixed(0) + "ms) -> 📸 ГЕН принял")
                    : "📸 НОВЫЙ КАДР (ОРИГ -> ГЕН синхронно)";
            } else if (origChanged && !up) {
                verdict = "⏭️ ГЕН ВЫКИНУЛ КАДР (дубль B==A)";
            } else if (curAlpha >= 0.995 && lastGeneratorStallTicks >= 2) {
                verdict = (origSpanMs > expMs * 1.45)
                    ? ("⚠️ ЗАТУП ВИДЕО (" + origSpanMs.toFixed(0) + "ms) -> ГЕН ждёт на a=1.0")
                    : ("🛑 СТОПОР ГЕНЕРАТОРА (рано дошёл до a=1.0, стоит #" + lastGeneratorStallTicks + "т)");
            } else {
                verdict = "🟢 ГЕН плавно двигает (шаг " + stepTag + ")";
            }
        }

        logEntries.push({
            idx: logEntries.length + 1,
            dt: dt,
            vTime: vTime,
            dec: dec,
            origChanged: origChanged,
            origSpanMs: origSpanMs,
            texUp: up,
            stalled: (lastGeneratorStallTicks >= 2) ? 1 : 0,
            dupDropped: (origChanged && !up && modeNow !== 'off') ? 1 : 0,
            origCol: origCol,
            genCol: genCol,
            verdict: verdict
        });

        var btn = document.getElementById('jennyLog120Btn');
        if (btn && (logEntries.length % 120 === 1)) {
            btn.textContent = '⏳ ' + (Math.floor(logEntries.length / 120) + 1) + '/3...';
        }

        if (logEntries.length >= TOTAL_LOG_FRAMES) {
            isLogging = false;
            var blocks = [];
            for (var r = 0; r < 3; r++) {
                var sl = logEntries.slice(r * 120, (r + 1) * 120);
                var sum = 0, tUps = 0, oNews = 0, oSpans = [], stallCnt = 0, dupDropCnt = 0, lines = [];
                for (var k = 0; k < sl.length; k++) {
                    var e = sl[k];
                    sum += e.dt;
                    if (e.texUp) tUps++;
                    if (e.origChanged) {
                        oNews++;
                        if (e.origSpanMs > 5 && e.origSpanMs < 2000) oSpans.push(e.origSpanMs);
                    }
                    if (e.stalled) stallCnt++;
                    if (e.dupDropped) dupDropCnt++;
                    lines.push(
                        String(e.idx).padStart(3, ' ') + " | " +
                        e.dt.toFixed(2).padStart(6, ' ') + "ms | " +
                        e.vTime.toFixed(4) + "s | " +
                        e.origCol + " | " +
                        e.genCol + " | " +
                        e.verdict
                    );
                }
                var avgD = sum / Math.max(1, sl.length);
                var avgOrigSpan = oSpans.length ? (oSpans.reduce(function(a,b){return a+b;}, 0) / oSpans.length) : 0;
                var maxOrigSpan = oSpans.length ? Math.max.apply(null, oSpans) : 0;
                var minOrigSpan = oSpans.length ? Math.min.apply(null, oSpans) : 0;

                blocks.push(
                    "\n--- КРУГ " + (r + 1) + "/3 | Экран: " + (1000 / Math.max(0.1, avgD)).toFixed(1) + " FPS (avg " + avgD.toFixed(2) + "ms) ---\n" +
                    "📊 ОРИГИНАЛ (Декодер): отдал " + oNews + " кадр. | шаг исходника: avg " + avgOrigSpan.toFixed(1) + "ms (min " + minOrigSpan.toFixed(1) + "ms, max пауза " + maxOrigSpan.toFixed(1) + "ms)\n" +
                    "⚡ ГЕНЕРАТОР (120Hz) : принял texUp=" + tUps + " | выкинул дублей=" + dupDropCnt + " | тиков простоя на a=1.0: " + stallCnt + " из 120\n" +
                    "Idx | VSync_dt |   vTime  | ОРИГИНАЛ (Декодер видео)  | ГЕНЕРАТОР (WebGL 120Hz) | Кто виноват / Статус тика\n" +
                    lines.join("\n")
                );
            }
            var out = "=== JENNY V209 СРАВНИТЕЛЬНЫЙ ЛОГ: ОРИГИНАЛ vs ГЕНЕРАТОР (3x120 = 360 ТИКОВ) ===\n" +
                      getMediaPassport(vEl, glCtx) + blocks.join("\n");
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(out).catch(function(){});
            }
            window._lastJenny120Log = out;
            if (typeof window.showToast === 'function') {
                window.showToast('✅ Сравнительный лог V209 (ОРИГ vs ГЕН) скопирован!');
            }
            if (btn) btn.textContent = '📋 360 ОК';
        }
    }

    function attachProbe(Proto) {
        if (!Proto || Proto._v209Probe) return;
        Proto._v209Probe = true;
        var origLoc = Proto.getUniformLocation;
        Proto.getUniformLocation = function(p, n) {
            var l = origLoc.call(this, p, n);
            if (l) l._uName = n;
            return l;
        };
        var origU1f = Proto.uniform1f;
        Proto.uniform1f = function(l, v) {
            if (l && l._uName === 'u_alpha') lastCapturedAlpha = v;
            return origU1f.call(this, l, v);
        };
        var origTex = Proto.texImage2D;
        Proto.texImage2D = function() {
            var a = arguments[arguments.length - 1];
            if (a && a.tagName === 'VIDEO') uploadedSinceLastDraw = 1;
            return origTex.apply(this, arguments);
        };
        var origDraw = Proto.drawArrays;
        Proto.drawArrays = function(m, f, c) {
            if (window._jennyExp120HzEnabledV205 || (window._jennyLabFlagsV208 && window._jennyLabFlagsV208.logDots)) {
                recordComparativeTickV209(this, false);
            }
            return origDraw.call(this, m, f, c);
        };
    }
    if (typeof WebGL2RenderingContext !== 'undefined') attachProbe(WebGL2RenderingContext.prototype);
    if (typeof WebGLRenderingContext !== 'undefined') attachProbe(WebGLRenderingContext.prototype);

    function syncTunerSlidersDOM() {
        var tun = window._jennyTunerV190;
        if (!tun) return;
        for (var i = 0; i < TUNER_SPECS.length; i++) {
            var sp = TUNER_SPECS[i];
            var val = Number(tun[sp.key]);
            if (isNaN(val)) val = sp.def;
            var pct = Math.max(0, Math.min(100, ((val - sp.min) / (sp.max - sp.min)) * 100));
            var fillEl = document.getElementById('jt190Fill_' + sp.key);
            var valEl = document.getElementById('jt190Val_' + sp.key);
            if (fillEl) fillEl.style.width = pct.toFixed(1) + '%';
            if (valEl) valEl.textContent = val.toFixed(sp.fmt);
        }
    }

    // 1. СВЕРНУТАЯ КНОПКА ЛОГА С ТОЧКАМИ (#jennyFenceWrapV173) — ПРИ СНЯТИИ ГАЛОЧКИ УДАЛЯЕТСЯ БЕЗ СЛЕДА
    function ensureLogDotsWidget(stage) {
        var fl = window._jennyLabFlagsV208 || {};
        var oldW = document.getElementById('jennyFenceWrapV173');
        if (!fl.logDots || (stage.clientWidth > 0 && stage.clientWidth < 210)) {
            if (oldW) oldW.remove();
            return;
        }
        if (oldW && oldW._isV209LogPill) {
            return;
        }
        if (oldW) oldW.remove();

        var sx = parseFloat(localStorage.getItem('jenny_diag_x') || '10');
        var sy = parseFloat(localStorage.getItem('jenny_diag_y') || '52');

        var wrap = document.createElement('div');
        wrap.id = 'jennyFenceWrapV173';
        wrap._isV209LogPill = true;
        wrap.className = 'jv209-collapsible-tool';
        wrap.style.cssText = 'position:absolute;top:' + sy + 'px;left:' + sx + 'px;z-index:99998;display:flex;flex-direction:column;align-items:stretch;gap:3px;background:rgba(4,10,16,0.92);border:1px solid #00e5ff;border-radius:14px;padding:3px 7px;pointer-events:auto;touch-action:none;user-select:none;box-shadow:0 4px 12px rgba(0,0,0,0.75);box-sizing:border-box;width:' + (isLogCollapsed ? 'auto' : '214px') + ';';

        var cv = document.createElement('canvas');
        cv.id = 'jennyFenceCanvasV173';
        cv.width = 200;
        cv.height = 28;
        cv.style.cssText = 'width:200px;height:28px;display:' + (isLogCollapsed ? 'none' : 'block') + ';border-bottom:1px solid rgba(0,229,255,0.25);padding-bottom:1px;';

        var row2 = document.createElement('div');
        row2.id = 'jennyFenceRow2V177';
        row2.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:5px;';

        var tBtn = document.createElement('button');
        tBtn.id = 'jennyFenceToggleBtn';
        tBtn.textContent = isLogCollapsed ? '📊 Лог' : '➖';
        tBtn.style.cssText = 'background:#11222b;color:#00e5ff;font-size:10px;font-weight:900;border:1px solid rgba(0,229,255,0.45);border-radius:10px;padding:2px 8px;white-space:nowrap;';

        var lBtn = document.createElement('button');
        lBtn.id = 'jennyLog120Btn';
        lBtn.textContent = '📋 ЛОГ 360';
        lBtn.style.cssText = 'display:' + (isLogCollapsed ? 'none' : 'inline-block') + ';background:#00e5ff;color:#000;font-weight:900;font-size:9.5px;border:none;border-radius:6px;padding:3px 6px;white-space:nowrap;flex:1;';

        var dragHint = document.createElement('span');
        dragHint.textContent = '✥';
        dragHint.style.cssText = 'color:rgba(0,229,255,0.75);font-size:12px;padding:0 2px;';

        row2.appendChild(tBtn);
        row2.appendChild(lBtn);
        row2.appendChild(dragHint);
        wrap.appendChild(cv);
        wrap.appendChild(row2);
        stage.appendChild(wrap);
    }

    // 2. СВЕРНУТАЯ КНОПКА КРУТИЛОК ДЕКОДЕРА (#jennyTunerFloatWrapV208) — ПРИ СНЯТИИ ГАЛОЧКИ УДАЛЯЕТСЯ БЕЗ СЛЕДА
    function ensureTunerSlidersWidget(stage) {
        var fl = window._jennyLabFlagsV208 || {};
        var oldT = document.getElementById('jennyTunerFloatWrapV208');
        if (!fl.tunerSliders || (stage.clientWidth > 0 && stage.clientWidth < 210)) {
            if (oldT) oldT.remove();
            return;
        }
        if (oldT && oldT._isV209TunerPill) {
            syncTunerSlidersDOM();
            return;
        }
        if (oldT) oldT.remove();

        var tx = parseFloat(localStorage.getItem('jenny_tuner_x') || '102');
        var ty = parseFloat(localStorage.getItem('jenny_tuner_y') || '52');

        var wrap = document.createElement('div');
        wrap.id = 'jennyTunerFloatWrapV208';
        wrap._isV209TunerPill = true;
        wrap.className = 'jv209-collapsible-tool';
        wrap.style.cssText = 'position:absolute;top:' + ty + 'px;left:' + tx + 'px;z-index:99999;display:flex;flex-direction:column;align-items:stretch;gap:2px;background:rgba(6,12,20,0.92);border:1px solid #d2a8ff;border-radius:14px;padding:3px 7px;pointer-events:auto;touch-action:none;user-select:none;box-shadow:0 4px 12px rgba(0,0,0,0.8);box-sizing:border-box;width:' + (isTunerCollapsed ? 'auto' : '222px') + ';';

        var hdr = document.createElement('div');
        hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:5px;';
        hdr.innerHTML =
            '<button id="jennyTunerCollapseBtnV208" style="background:#1c162b;color:#d2a8ff;font-size:10px;font-weight:900;border:1px solid rgba(210,168,255,0.45);border-radius:10px;padding:2px 8px;white-space:nowrap;">' + (isTunerCollapsed ? '🎛️ Крутилки' : '➖ Скрыть') + '</button>' +
            '<button id="jt190ResetBtn" style="display:' + (isTunerCollapsed ? 'none' : 'inline-block') + ';background:#21262d;color:#ff7b72;border:1px solid #ff7b72;border-radius:5px;font-size:8.5px;font-weight:bold;padding:2px 6px;">🔄 Сброс</button>' +
            '<span style="color:rgba(210,168,255,0.8);font-size:12px;padding:0 2px;">✥</span>';

        var tBox = document.createElement('div');
        tBox.id = 'jennyTunerBoxV190';
        tBox.style.cssText = 'display:' + (isTunerCollapsed ? 'none' : 'flex') + ';flex-direction:column;gap:1px;padding-top:3px;border-top:1px solid rgba(210,168,255,0.25);margin-top:2px;';

        var slidersHtml = '';
        for (var i = 0; i < TUNER_SPECS.length; i++) {
            var sp = TUNER_SPECS[i];
            slidersHtml +=
                '<div class="jt190-slider-row" data-jtkey="' + sp.key + '" style="display:flex;flex-direction:column;gap:1px;padding:1px 0;cursor:pointer;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;font-family:monospace;font-size:9px;line-height:1.0;">' +
                        '<span style="color:#e6edf3;font-weight:bold;">' + sp.label + ' <span style="color:#6e7681;font-size:8px;">[' + sp.min + '..' + sp.max + ']</span></span>' +
                        '<span id="jt190Val_' + sp.key + '" style="color:' + sp.color + ';font-weight:900;font-size:9.5px;">' + sp.def.toFixed(sp.fmt) + '</span>' +
                    '</div>' +
                    '<div id="jt190Track_' + sp.key + '" style="width:100%;height:5px;background:#111922;border:1px solid rgba(255,255,255,0.18);border-radius:3px;overflow:hidden;position:relative;">' +
                        '<div id="jt190Fill_' + sp.key + '" style="width:50%;height:100%;background:' + sp.color + ';border-radius:3px;pointer-events:none;"></div>' +
                    '</div>' +
                '</div>';
        }
        tBox.innerHTML = slidersHtml;

        wrap.appendChild(hdr);
        wrap.appendChild(tBox);
        stage.appendChild(wrap);
        syncTunerSlidersDOM();
    }

    // 3. СВЕРНУТАЯ КНОПКА РЕЖИМА СРАВНЕНИЯ / СПЛИТА (#jennySplitPillWrapV209) И 120Hz (#jenny120PillWrapV209)
    function ensureSplitAnd120Pills(stage) {
        var fl = window._jennyLabFlagsV208 || {};

        // Кнопка Сплита
        var oldSp = document.getElementById('jennySplitPillWrapV209');
        if (!fl.splitTest || (stage.clientWidth > 0 && stage.clientWidth < 210)) {
            if (oldSp) oldSp.remove();
        } else {
            if (!oldSp) {
                var spx = parseFloat(localStorage.getItem('jenny_split_pill_x') || '10');
                var spy = parseFloat(localStorage.getItem('jenny_split_pill_y') || '86');
                oldSp = document.createElement('div');
                oldSp.id = 'jennySplitPillWrapV209';
                oldSp.className = 'jv209-collapsible-tool';
                oldSp.style.cssText = 'position:absolute;top:' + spy + 'px;left:' + spx + 'px;z-index:99997;display:flex;align-items:center;gap:4px;background:rgba(4,12,20,0.92);border:1px solid #00e5ff;border-radius:14px;padding:3px 7px;pointer-events:auto;touch-action:none;user-select:none;box-shadow:0 4px 12px rgba(0,0,0,0.75);';
                oldSp.innerHTML =
                    '<button id="jennySplitPillBtnV209" style="background:#0d212c;color:#00e5ff;font-size:10px;font-weight:900;border:1px solid rgba(0,229,255,0.45);border-radius:10px;padding:2px 8px;white-space:nowrap;">🌓 Сплит</button>' +
                    '<span style="color:rgba(0,229,255,0.75);font-size:12px;padding:0 2px;">✥</span>';
                stage.appendChild(oldSp);
            }
            var spBtn = document.getElementById('jennySplitPillBtnV209');
            if (spBtn) {
                var on = Boolean(window._jennySplitExpandedV209);
                spBtn.textContent = on ? '🌓 Сплит: ВКЛ ➖' : '🌓 Сплит';
                spBtn.style.background = on ? '#00e5ff' : '#0d212c';
                spBtn.style.color = on ? '#000' : '#00e5ff';
            }
        }

        // Кнопка 120Hz (если включена галочка Генератора 120Hz)
        var old120 = document.getElementById('jenny120PillWrapV209');
        if (!fl.core120 || (stage.clientWidth > 0 && stage.clientWidth < 210)) {
            if (old120) old120.remove();
        } else {
            if (!old120) {
                var c120x = parseFloat(localStorage.getItem('jenny_120_pill_x') || '106');
                var c120y = parseFloat(localStorage.getItem('jenny_120_pill_y') || '86');
                old120 = document.createElement('div');
                old120.id = 'jenny120PillWrapV209';
                old120.className = 'jv209-collapsible-tool';
                old120.style.cssText = 'position:absolute;top:' + c120y + 'px;left:' + c120x + 'px;z-index:99997;display:flex;align-items:center;gap:4px;background:rgba(4,16,12,0.92);border:1px solid #00ff9d;border-radius:14px;padding:3px 7px;pointer-events:auto;touch-action:none;user-select:none;box-shadow:0 4px 12px rgba(0,0,0,0.75);';
                old120.innerHTML =
                    '<button id="jenny120PillBtnV209" style="background:#0d281d;color:#00ff9d;font-size:10px;font-weight:900;border:1px solid rgba(0,255,157,0.45);border-radius:10px;padding:2px 8px;white-space:nowrap;">⚡ 120Hz</button>' +
                    '<span style="color:rgba(0,255,157,0.75);font-size:12px;padding:0 2px;">✥</span>';
                stage.appendChild(old120);
            }
            var b120 = document.getElementById('jenny120PillBtnV209');
            if (b120) {
                var on120 = Boolean(window._jenny120ExpandedV209);
                b120.textContent = on120 ? '⚡ 120Hz: ВКЛ ➖' : '⚡ 120Hz';
                b120.style.background = on120 ? '#00ff9d' : '#0d281d';
                b120.style.color = on120 ? '#000' : '#00ff9d';
            }
        }
    }

    var activeDragMode = null;
    var activeSliderKey = null;
    var startTouchX = 0, startTouchY = 0;
    var startWidgetLeft = 0, startWidgetTop = 0;
    var maxTouchDelta = 0;
    var touchedElement = null;

    function isStageRot90(stageEl) {
        if (stageEl && stageEl.classList && stageEl.classList.contains('rot90-v130')) return true;
        return Boolean(window._vidStateV130 && window._vidStateV130.rotated90);
    }

    function updateSliderFromTouch(key, tx, ty) {
        var sp = null;
        for (var i = 0; i < TUNER_SPECS.length; i++) {
            if (TUNER_SPECS[i].key === key) { sp = TUNER_SPECS[i]; break; }
        }
        if (!sp) return;
        var trackEl = document.getElementById('jt190Track_' + key);
        if (!trackEl) return;
        var r = trackEl.getBoundingClientRect();
        var wrap = document.getElementById('jennyTunerFloatWrapV208');
        var rot90 = isStageRot90(wrap ? wrap.parentElement : null);

        var ratio = 0.5;
        if (!rot90 && r.width > 10) {
            ratio = (tx - r.left) / r.width;
        } else if (rot90 && r.height > 10) {
            ratio = (ty - r.top) / r.height;
        }
        ratio = Math.max(0.0, Math.min(1.0, ratio));
        var newVal = sp.min + ratio * (sp.max - sp.min);
        var factor = Math.pow(10, sp.fmt);
        newVal = Math.round(newVal * factor) / factor;

        if (!window._jennyTunerV190) window._jennyTunerV190 = {};
        window._jennyTunerV190[key] = newVal;
        try { localStorage.setItem('jt190_' + key, String(newVal)); } catch (e) {}
        syncTunerSlidersDOM();
    }

    window.addEventListener('touchstart', function(e) {
        if (!e.touches || !e.touches.length) return;
        var tx = e.touches[0].clientX;
        var ty = e.touches[0].clientY;

        var pillTargets = [
            { id: 'jennyTunerFloatWrapV208', mode: 'tuner_widget' },
            { id: 'jennyFenceWrapV173',      mode: 'log_widget' },
            { id: 'jennySplitPillWrapV209',  mode: 'split_pill' },
            { id: 'jenny120PillWrapV209',    mode: 'c120_pill' }
        ];

        for (var p = 0; p < pillTargets.length; p++) {
            var pt = pillTargets[p];
            var wEl = document.getElementById(pt.id);
            if (wEl && wEl.style.display !== 'none' && wEl.offsetParent !== null && !wEl.classList.contains('jv209-hud-hidden-item')) {
                var rect = wEl.getBoundingClientRect();
                if (tx >= rect.left - 4 && tx <= rect.right + 4 && ty >= rect.top - 4 && ty <= rect.bottom + 4) {
                    var el = document.elementFromPoint(tx, ty) || e.target;
                    touchedElement = el;
                    startTouchX = tx;
                    startTouchY = ty;
                    maxTouchDelta = 0;

                    if (pt.mode === 'tuner_widget') {
                        var sRow = el && el.closest ? el.closest('.jt190-slider-row') : null;
                        if (sRow) {
                            activeDragMode = 'slider';
                            activeSliderKey = sRow.getAttribute('data-jtkey');
                            updateSliderFromTouch(activeSliderKey, tx, ty);
                            e.stopImmediatePropagation();
                            if (e.cancelable) e.preventDefault();
                            return;
                        }
                    }

                    activeDragMode = pt.mode;
                    startWidgetLeft = parseFloat(wEl.style.left) || 10;
                    startWidgetTop = parseFloat(wEl.style.top) || 52;
                    e.stopImmediatePropagation();
                    return;
                }
            }
        }

        var lineEl = document.getElementById('jv168SplitLine');
        if (lineEl && lineEl.style.display !== 'none' && lineEl.offsetParent !== null) {
            var hdr = document.getElementById('jv176SplitHeader');
            var grip = document.getElementById('jv176SplitGrip');
            var sRect = lineEl.getBoundingClientRect();
            var stageEl = lineEl.parentElement;
            var stageRect = stageEl ? stageEl.getBoundingClientRect() : sRect;
            var rot90 = isStageRot90(stageEl);

            var onHdr = false, onGrip = false;
            if (hdr) {
                var hr = hdr.getBoundingClientRect();
                onHdr = (tx >= hr.left - 8 && tx <= hr.right + 8 && ty >= hr.top - 8 && ty <= hr.bottom + 8);
            }
            if (grip) {
                var gr = grip.getBoundingClientRect();
                onGrip = (tx >= gr.left - 16 && tx <= gr.right + 16 && ty >= gr.top - 16 && ty <= gr.bottom + 16);
            }

            var nearLine = false;
            if (!rot90) {
                var lineX = sRect.left + sRect.width * 0.5;
                nearLine = (Math.abs(tx - lineX) <= 26 && ty >= stageRect.top && ty <= (stageRect.bottom - 95));
            } else {
                var lineY = sRect.top + sRect.height * 0.5;
                nearLine = (Math.abs(ty - lineY) <= 26 && tx >= (stageRect.left + 95) && tx <= stageRect.right);
            }

            if (onHdr || onGrip || nearLine) {
                activeDragMode = 'split';
                startTouchX = tx;
                startTouchY = ty;
                maxTouchDelta = 0;
                touchedElement = onHdr ? hdr : (onGrip ? grip : lineEl);
                e.stopImmediatePropagation();
                if (e.cancelable) e.preventDefault();
                return;
            }
        }
        activeDragMode = null;
    }, { capture: true, passive: false });

    window.addEventListener('touchmove', function(e) {
        if (!activeDragMode || !e.touches || !e.touches.length) return;
        var tx = e.touches[0].clientX;
        var ty = e.touches[0].clientY;
        var dx = tx - startTouchX;
        var dy = ty - startTouchY;
        maxTouchDelta = Math.max(maxTouchDelta, Math.hypot(dx, dy));

        e.stopImmediatePropagation();
        if (e.cancelable) e.preventDefault();

        if (activeDragMode === 'slider' && activeSliderKey) {
            updateSliderFromTouch(activeSliderKey, tx, ty);
            return;
        }

        var mapId = {
            log_widget:   'jennyFenceWrapV173',
            tuner_widget: 'jennyTunerFloatWrapV208',
            split_pill:   'jennySplitPillWrapV209',
            c120_pill:    'jenny120PillWrapV209'
        };
        if (mapId[activeDragMode] && maxTouchDelta > 5) {
            var wrap = document.getElementById(mapId[activeDragMode]);
            if (wrap && wrap.parentElement) {
                var stageEl = wrap.parentElement;
                var rot90 = isStageRot90(stageEl);
                var localDx = rot90 ? dy : dx;
                var localDy = rot90 ? (-dx) : dy;

                var pw = stageEl.clientWidth;
                var ph = stageEl.clientHeight;
                var maxL = Math.max(4, pw - wrap.offsetWidth - 4);
                var maxT = Math.max(4, ph - wrap.offsetHeight - 4);
                var newL = Math.max(4, Math.min(maxL, startWidgetLeft + localDx));
                var newT = Math.max(4, Math.min(maxT, startWidgetTop + localDy));
                wrap.style.left = Math.round(newL) + 'px';
                wrap.style.top = Math.round(newT) + 'px';
                wrap.style.bottom = 'auto';
            }
        } else if (activeDragMode === 'split' && maxTouchDelta > 4) {
            var lineEl = document.getElementById('jv168SplitLine');
            if (lineEl && lineEl.parentElement) {
                var stageEl = lineEl.parentElement;
                var sr = stageEl.getBoundingClientRect();
                var rot90 = isStageRot90(stageEl);
                if (!rot90 && sr.width > 20) {
                    window._jennySplitRatioV176 = Math.max(0.05, Math.min(0.95, (tx - sr.left) / sr.width));
                    window.updateSplitLineUI(lineEl);
                } else if (rot90 && sr.height > 20) {
                    window._jennySplitRatioV176 = Math.max(0.05, Math.min(0.95, (ty - sr.top) / sr.height));
                    window.updateSplitLineUI(lineEl);
                }
            }
        }
    }, { capture: true, passive: false });

    window.addEventListener('touchend', function(e) {
        if (!activeDragMode) return;
        var mode = activeDragMode;
        activeDragMode = null;
        activeSliderKey = null;
        e.stopImmediatePropagation();

        if (mode === 'slider') return;

        if (mode === 'log_widget') {
            var lWrap = document.getElementById('jennyFenceWrapV173');
            if (maxTouchDelta > 6) {
                if (lWrap) {
                    try {
                        localStorage.setItem('jenny_diag_x', String(parseFloat(lWrap.style.left) || 10));
                        localStorage.setItem('jenny_diag_y', String(parseFloat(lWrap.style.top) || 52));
                    } catch (err) {}
                }
                return;
            }
            var lBtn = document.getElementById('jennyLog120Btn');
            var tBtn = document.getElementById('jennyFenceToggleBtn');
            var cv = document.getElementById('jennyFenceCanvasV173');
            var tg = touchedElement;
            if (lBtn && !isLogCollapsed && (tg === lBtn || lBtn.contains(tg))) {
                logEntries = [];
                prevTrackDec = -1;
                lastOrigChangeTs = performance.now();
                origHoldTicks = 0;
                isLogging = true;
                lBtn.textContent = '⏳ 1/3...';
            } else if (tBtn && (tg === tBtn || tBtn.contains(tg) || isLogCollapsed)) {
                isLogCollapsed = !isLogCollapsed;
                if (cv) cv.style.display = isLogCollapsed ? 'none' : 'block';
                if (lBtn) lBtn.style.display = isLogCollapsed ? 'none' : 'inline-block';
                if (lWrap) lWrap.style.width = isLogCollapsed ? 'auto' : '214px';
                tBtn.textContent = isLogCollapsed ? '📊 Лог' : '➖';
            }
        } else if (mode === 'tuner_widget') {
            var tWrap = document.getElementById('jennyTunerFloatWrapV208');
            if (maxTouchDelta > 6) {
                if (tWrap) {
                    try {
                        localStorage.setItem('jenny_tuner_x', String(parseFloat(tWrap.style.left) || 102));
                        localStorage.setItem('jenny_tuner_y', String(parseFloat(tWrap.style.top) || 52));
                    } catch (err) {}
                }
                return;
            }
            var rBtn = document.getElementById('jt190ResetBtn');
            var cBtn = document.getElementById('jennyTunerCollapseBtnV208');
            var tBox = document.getElementById('jennyTunerBoxV190');
            var tg = touchedElement;
            if (rBtn && !isTunerCollapsed && (tg === rBtn || rBtn.contains(tg))) {
                if (!window._jennyTunerV190) window._jennyTunerV190 = {};
                for (var i = 0; i < TUNER_SPECS.length; i++) {
                    var sp = TUNER_SPECS[i];
                    window._jennyTunerV190[sp.key] = sp.def;
                    try { localStorage.setItem('jt190_' + sp.key, String(sp.def)); } catch (err) {}
                }
                syncTunerSlidersDOM();
                if (typeof window.showToast === 'function') {
                    window.showToast('🔄 Крутилки декодера сброшены!');
                }
            } else if (cBtn && (tg === cBtn || cBtn.contains(tg) || isTunerCollapsed)) {
                isTunerCollapsed = !isTunerCollapsed;
                if (tBox) tBox.style.display = isTunerCollapsed ? 'none' : 'flex';
                if (rBtn) rBtn.style.display = isTunerCollapsed ? 'none' : 'inline-block';
                if (tWrap) tWrap.style.width = isTunerCollapsed ? 'auto' : '222px';
                cBtn.textContent = isTunerCollapsed ? '🎛️ Крутилки' : '➖ Скрыть';
            }
        } else if (mode === 'split_pill') {
            var spWrap = document.getElementById('jennySplitPillWrapV209');
            if (maxTouchDelta > 6) {
                if (spWrap) {
                    try {
                        localStorage.setItem('jenny_split_pill_x', String(parseFloat(spWrap.style.left) || 10));
                        localStorage.setItem('jenny_split_pill_y', String(parseFloat(spWrap.style.top) || 86));
                    } catch (err) {}
                }
                return;
            }
            window._jennySplitExpandedV209 = !window._jennySplitExpandedV209;
            window.updateActiveEngineModeV209();
        } else if (mode === 'c120_pill') {
            var cWrap = document.getElementById('jenny120PillWrapV209');
            if (maxTouchDelta > 6) {
                if (cWrap) {
                    try {
                        localStorage.setItem('jenny_120_pill_x', String(parseFloat(cWrap.style.left) || 106));
                        localStorage.setItem('jenny_120_pill_y', String(parseFloat(cWrap.style.top) || 86));
                    } catch (err) {}
                }
                return;
            }
            window._jenny120ExpandedV209 = !window._jenny120ExpandedV209;
            window.updateActiveEngineModeV209();
        } else if (mode === 'split') {
            try { localStorage.setItem('jenny_split_ratio', String(window._jennySplitRatioV176)); } catch (err) {}
            var hdr = document.getElementById('jv176SplitHeader');
            if (maxTouchDelta < 8 && hdr && (touchedElement === hdr || hdr.contains(touchedElement))) {
                window.toggleSplitSwapV176(e);
            }
        }
    }, { capture: true, passive: false });

    // ==============================================================================
    // 4. ТАЙМЕР АВТОСКРЫТИЯ УПРАВЛЕНИЯ С ТОЧНОСТЬЮ 0.1 СЕК (ОСНОВНОЙ ПЛЕЕР + РЕЖИМ PiP)
    // ==============================================================================
    var lastVideoInteractionTsV209 = performance.now();
    var hudCurrentlyHiddenV209 = false;

    function isVideoInPipOrMiniModeV209(ov) {
        var st = window._vidStateV130;
        if (st && (st.mini || st.isMini || st.pip || st.isPip || st.mode === 'mini')) return true;
        if (!ov) return false;
        var cls = (ov.className || '').toLowerCase();
        if (cls.indexOf('mini') !== -1 || cls.indexOf('pip') !== -1) return true;
        if (ov.clientWidth > 40 && ov.clientWidth < window.innerWidth * 0.82) return true;
        return false;
    }

    function applyHudControlsVisibilityV209(hide) {
        var ov = document.getElementById('jennyVideoOverlayV130');
        if (!ov) return;
        hudCurrentlyHiddenV209 = Boolean(hide);

        var stage = document.getElementById('jennyVideoStageV130');
        var keepIds = {
            'jennyVideoStageV130': true,
            'jennyVideoElV130': true,
            'jv166InterpCanvas': true,
            'jv168SplitLine': true
        };

        // Все элементы управления внутри оверлея плеера
        var children = Array.from(ov.children);
        if (stage) {
            children = children.concat(Array.from(stage.children));
        }

        for (var i = 0; i < children.length; i++) {
            var el = children[i];
            if (!el || !el.id && el.tagName === 'VIDEO') continue;
            if (el.id && keepIds[el.id]) continue;
            if (el.tagName === 'VIDEO' || el.tagName === 'STYLE') continue;

            // В свернутом виде прячем и таблетки модулей вместе с управлением плеера; если окно лога/крутилок развернуто — оставляем видимым
            if (el.id === 'jennyFenceWrapV173' && !isLogCollapsed) continue;
            if (el.id === 'jennyTunerFloatWrapV208' && !isTunerCollapsed) continue;

            if (hide) {
                el.style.transition = 'opacity 0.2s ease';
                el.style.opacity = '0';
                el.style.pointerEvents = 'none';
                el.classList.add('jv209-hud-hidden-item');
            } else {
                if (el.classList.contains('jv209-hud-hidden-item')) {
                    el.style.opacity = '';
                    el.style.pointerEvents = '';
                    el.classList.remove('jv209-hud-hidden-item');
                }
            }
        }
    }

    window.wakeVideoHudControlsV209 = function() {
        lastVideoInteractionTsV209 = performance.now();
        if (hudCurrentlyHiddenV209) {
            applyHudControlsVisibilityV209(false);
        }
    };

    ['touchstart', 'touchmove', 'mousedown', 'click'].forEach(function(evName) {
        window.addEventListener(evName, function(e) {
            var ov = document.getElementById('jennyVideoOverlayV130');
            if (ov && ov.style.display !== 'none' && ov.contains(e.target)) {
                window.wakeVideoHudControlsV209();
            }
        }, { capture: true, passive: true });
    });

    function checkAutoHideTickV209() {
        var ov = document.getElementById('jennyVideoOverlayV130');
        var vEl = document.getElementById('jennyVideoElV130');
        if (!ov || ov.style.display === 'none' || !vEl) {
            hudCurrentlyHiddenV209 = false;
            return;
        }
        var fl = window._jennyLabFlagsV208 || {};
        var isPip = isVideoInPipOrMiniModeV209(ov);
        var enabled = isPip ? Boolean(fl.stub2) : Boolean(fl.stub1);

        if (!enabled || activeDragMode) {
            if (hudCurrentlyHiddenV209) applyHudControlsVisibilityV209(false);
            return;
        }

        var delaySec = isPip ? (window._jennyAutoHideSecV209.pip || 2.0) : (window._jennyAutoHideSecV209.main || 3.0);
        var elapsedSec = (performance.now() - lastVideoInteractionTsV209) / 1000.0;
        if (elapsedSec >= delaySec) {
            if (!hudCurrentlyHiddenV209) applyHudControlsVisibilityV209(true);
        }
    }

    function loopFence() {
        var fl = window._jennyLabFlagsV208 || {};
        var vEl = document.getElementById('jennyVideoElV130') || document.querySelector('video');
        if (vEl && vEl.parentElement) {
            var stage = vEl.parentElement;
            upgradeSplitLineV176();
            ensureLogDotsWidget(stage);
            ensureTunerSlidersWidget(stage);
            ensureSplitAnd120Pills(stage);

            if (fl.logDots && window._jv166Metrics && window._jv166Metrics.mode === 'off' && !vEl.paused) {
                recordComparativeTickV209(null, true);
            }
        }

        checkAutoHideTickV209();

        if (fl.logDots && !isLogCollapsed) {
            var cv = document.getElementById('jennyFenceCanvasV173');
            if (cv && cv.offsetParent !== null) {
                var ctx = cv.getContext('2d');
                ctx.clearRect(0, 0, cv.width, cv.height);
                var y8 = cv.height - Math.round(8.33 * 1.1);
                ctx.fillStyle = 'rgba(255,255,255,0.25)';
                ctx.fillRect(0, y8, cv.width, 1);
                for (var i = 0; i < 120; i++) {
                    var idx = (histIdx + i) % 120;
                    var dt = historyDt[idx], al = historyAlpha[idx], up = historyNewFrame[idx];
                    var h = Math.min(cv.height - 2, Math.max(2, Math.round(dt * 1.1)));
                    ctx.fillStyle = (dt > 20) ? '#ff1744' : (dt > 13 ? '#ffea00' : '#00e676');
                    ctx.fillRect(Math.round(i * 1.65), cv.height - h, 1, h);
                    ctx.fillStyle = up ? '#ffffff' : '#00e5ff';
                    var yA = Math.round((1 - Math.max(0, Math.min(1, al))) * (cv.height - 5)) + 2;
                    ctx.fillRect(Math.round(i * 1.65), yA, 2, 2);
                }
            }
        }
        requestAnimationFrame(loopFence);
    }
    requestAnimationFrame(loopFence);

    window.updateAutoHideSecV209 = function(which, rawVal) {
        var num = parseFloat(String(rawVal).replace(',', '.'));
        if (!Number.isFinite(num)) return;
        num = Math.max(0.5, Math.min(60.0, Math.round(num * 10) / 10));
        if (which === 'pip') {
            window._jennyAutoHideSecV209.pip = num;
            try { localStorage.setItem('jenny_autohide_pip_sec_v209', num.toFixed(1)); } catch (e) {}
        } else {
            window._jennyAutoHideSecV209.main = num;
            try { localStorage.setItem('jenny_autohide_main_sec_v209', num.toFixed(1)); } catch (e) {}
        }
        window.wakeVideoHudControlsV209();
    };

    window.toggleLabModuleFlagV208 = function(flagKey, checked, showMsg) {
        var fl = window._jennyLabFlagsV208;
        fl[flagKey] = Boolean(checked);

        // При включении галочки в настройках инструмент появляется в плеере СВЕРНУТЫМ (по умолчанию играет дефолт!)
        if (flagKey === 'splitTest') {
            window._jennySplitExpandedV209 = false;
        }
        if (flagKey === 'core120') {
            window._jenny120ExpandedV209 = false;
        }
        if (flagKey === 'logDots') {
            isLogCollapsed = true;
            var lw = document.getElementById('jennyFenceWrapV173');
            if (lw) lw.remove();
        }
        if (flagKey === 'tunerSliders') {
            isTunerCollapsed = true;
            var tw = document.getElementById('jennyTunerFloatWrapV208');
            if (tw) tw.remove();
        }

        window.saveJennyLabFlagsV208();
        window.updateActiveEngineModeV209();
        window.syncModularLabDOMV208();
        window.wakeVideoHudControlsV209();

        if (showMsg && typeof window.showToast === 'function') {
            var names = {
                core120:      '⚡ Кнопка 120Hz & Матрица .SO',
                splitTest:    '🌓 Кнопка режима сравнения (Сплит)',
                logDots:      '📊 Кнопка лога с точками',
                tunerSliders: '🎛️ Кнопка крутилок декодера',
                stub1:        '⏱️ Автоскрытие управления (Плеер)',
                stub2:        '❐ Автоскрытие управления (PiP)',
                stub3:        '🧩 Заглушка 3',
                stub4:        '🧩 Заглушка 4',
                stub5:        '🧩 Заглушка 5'
            };
            window.showToast((names[flagKey] || flagKey) + ': ' + (fl[flagKey] ? 'ВКЛ' : 'ВЫКЛ'));
        }
    };

    window.syncModularLabDOMV208 = function() {
        var fl = window._jennyLabFlagsV208 || {};
        window.updateActiveEngineModeV209();

        var btn120 = document.getElementById('v166Btn120Mode');
        if (btn120) btn120.remove();

        var vcorePanel = document.getElementById('jv166VCoreDeckPanel');
        if (vcorePanel) {
            var showPanel = Boolean(fl.core120 && window._activeUiDeckV131 === 'video');
            vcorePanel.style.setProperty('display', showPanel ? 'block' : 'none', 'important');
        }

        if (!fl.logDots) {
            var logW = document.getElementById('jennyFenceWrapV173');
            if (logW) logW.remove();
        }
        if (!fl.tunerSliders) {
            var tunW = document.getElementById('jennyTunerFloatWrapV208');
            if (tunW) tunW.remove();
        }
        if (!fl.splitTest) {
            var spW = document.getElementById('jennySplitPillWrapV209');
            if (spW) spW.remove();
        }
        if (!fl.core120) {
            var c120W = document.getElementById('jenny120PillWrapV209');
            if (c120W) c120W.remove();
        }

        Object.keys(fl).forEach(function(k) {
            var chk = document.getElementById('chkLabV208_' + k);
            if (chk) chk.checked = Boolean(fl[k]);
        });
    };

    window.mountModularLabSettingsV208 = function() {
        var sm = document.getElementById('settingsModal');
        if (!sm) return;
        var oldBox205 = document.getElementById('jennyExp120HzMasterBoxV205');
        if (oldBox205) oldBox205.remove();

        var deckBar = document.getElementById('deckSwitchBarSettingsV131');
        var container = sm.querySelector('.container') || sm;
        var box = document.getElementById('jennyModularLabBoxV208');
        if (!box) {
            box = document.createElement('details');
            box.id = 'jennyModularLabBoxV208';
            box.className = 'setting-group';
            box.style.cssText = 'margin-bottom:10px;border:1.5px solid #30363d;border-radius:10px;background:#090d14;padding:6px 10px;';
            if (deckBar && deckBar.parentNode) {
                deckBar.insertAdjacentElement('afterend', box);
            } else {
                container.insertBefore(box, container.firstChild);
            }
        }

        if (box._v209Rendered) {
            window.syncModularLabDOMV208();
            return;
        }
        box._v209Rendered = true;

        var items = [
            { key: 'core120',      icon: '⚡', title: 'Генератор кадров 120Hz & Матрица .SO ядер', desc: 'Добавляет свёрнутую кнопку ⚡ 120Hz в плеер и матрицу .SO в Деке Б', color: '#00ff9d' },
            { key: 'splitTest',    icon: '🌓', title: 'Режим сравнения (Кнопка Сплит в плеере)', desc: 'Добавляет свёрнутую кнопку 🌓 Сплит (по умолчанию играет дефолт)', color: '#00e5ff' },
            { key: 'logDots',      icon: '📊', title: 'Лог с точками (Свёрнутая кнопка 📊 Лог)', desc: 'Добавляет свёрнутую кнопку осциллографа VSync и Лога 360', color: '#58a6ff' },
            { key: 'tunerSliders', icon: '🎛️', title: 'Настройки декодера (Свёрнутая кнопка 🎛️ Крутилки)', desc: 'Добавляет свёрнутую кнопку 9 ползунков шейдера в плеер', color: '#d2a8ff' },
            { key: 'stub1',        icon: '⏱️', title: 'Скрывать управление (Основной плеер)', desc: 'Через сколько секунд без касания прятать кнопки плеера', color: '#ffea00', secKey: 'main' },
            { key: 'stub2',        icon: '❐',  title: 'Скрывать управление (Режим PiP / Мини)', desc: 'Через сколько секунд без касания прятать кнопки в PiP', color: '#ff9100', secKey: 'pip' },
            { key: 'stub3',        icon: '🧩', title: 'Заглушка 3 (Свободный слот модуля)', desc: 'Резервный слот под будущую функцию #3', color: '#8b949e' },
            { key: 'stub4',        icon: '🧩', title: 'Заглушка 4 (Свободный слот модуля)', desc: 'Резервный слот под будущую функцию #4', color: '#8b949e' },
            { key: 'stub5',        icon: '🧩', title: 'Заглушка 5 (Свободный слот модуля)', desc: 'Резервный слот под будущую функцию #5', color: '#8b949e' }
        ];

        var fl = window._jennyLabFlagsV208 || {};
        var rowsHtml = items.map(function(it) {
            var isChk = fl[it.key] ? 'checked' : '';
            var secInputHtml = '';
            if (it.secKey) {
                var secVal = (it.secKey === 'pip') ? window._jennyAutoHideSecV209.pip : window._jennyAutoHideSecV209.main;
                secInputHtml =
                    '<div style="display:flex;align-items:center;gap:4px;margin-right:4px;" onclick="event.stopPropagation();">' +
                        '<input type="number" step="0.1" min="0.5" max="60.0" id="inpAutoHideSecV209_' + it.secKey + '" value="' + Number(secVal).toFixed(1) + '" ' +
                        'onchange="window.updateAutoHideSecV209(\'' + it.secKey + '\', this.value); this.value = Number(window._jennyAutoHideSecV209[\'' + it.secKey + '\']).toFixed(1);" ' +
                        'oninput="window.updateAutoHideSecV209(\'' + it.secKey + '\', this.value);" ' +
                        'style="width:52px;padding:3px 5px;background:#161b22;color:' + it.color + ';border:1px solid ' + it.color + ';border-radius:6px;font-family:monospace;font-size:11px;font-weight:900;text-align:center;">' +
                        '<span style="font-size:10px;color:#8b949e;font-family:monospace;">с</span>' +
                    '</div>';
            }
            return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 4px;border-bottom:1px solid #161b22;user-select:none;">' +
                '<label style="display:flex;flex-direction:column;gap:1px;flex:1;cursor:pointer;">' +
                    '<span style="font-size:11.5px;font-weight:800;color:' + it.color + ';">' + it.icon + ' ' + it.title + '</span>' +
                    '<span style="font-size:9.5px;color:#8b949e;">' + it.desc + '</span>' +
                '</label>' +
                secInputHtml +
                '<input type="checkbox" id="chkLabV208_' + it.key + '" ' + isChk + ' onchange="window.toggleLabModuleFlagV208(\'' + it.key + '\', this.checked, true)" style="width:17px;height:17px;accent-color:' + it.color + ';cursor:pointer;flex-shrink:0;">' +
            '</div>';
        }).join('');

        box.innerHTML =
            '<summary style="font-size:12px;font-weight:900;color:#00e5ff;cursor:pointer;padding:4px 2px;outline:none;">🧪 Модули плеера: 120Hz, Сплит, Лог и Автоскрытие UI</summary>' +
            '<div style="display:flex;flex-direction:column;gap:2px;margin-top:6px;">' + rowsHtml + '</div>';

        window.syncModularLabDOMV208();
    };

    setInterval(function() {
        window.mountModularLabSettingsV208();
        window.syncModularLabDOMV208();
    }, 600);

    setTimeout(function() {
        window.mountModularLabSettingsV208();
        window.syncModularLabDOMV208();
    }, 150);
})();
/* ================= END JENNY V209 ================= */"""

ui_targets = [
    os.path.join(BASE_DIR, "ui_v71.js"),
    os.path.join(BASE_DIR, "app", "src", "main", "python", "ui_v71.js")
]

patched = 0
for path in ui_targets:
    if not os.path.isfile(path):
        continue
    code = open(path, "r", encoding="utf-8", errors="ignore").read()

    # По умолчанию стартовый режим _jv166Metrics.mode = 'off' (дефолтный плеер)
    code = code.replace("mode: '120',", "mode: 'off',")

    # Заменяем блок V208 на новый V209
    code = re.sub(
        r"/\*\s*=================\s*JENNY V208:.*$",
        V209_MODULAR_UI_AND_AUTOHIDE + "\n",
        code,
        count=1,
        flags=re.DOTALL
    )

    open(path, "w", encoding="utf-8").write(code)
    patched += 1
    print(f"[V209] Свёрнутые кнопки модулей + автоскрытие UI (Плеер и PiP с шагом 0.1с) установлены в: {path}")

print(f"\n✅ Готово! Обновлено файлов: {patched}. Отправляй папку на сборку.")
