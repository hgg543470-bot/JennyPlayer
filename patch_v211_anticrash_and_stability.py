#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, re

_orig_sub = re.sub
re.sub = lambda pat, repl, string, *a, **kw: _orig_sub(pat, (repl if callable(repl) else (lambda _: repl)), string, *a, **kw)

BASE_DIR = "/storage/emulated/0/scripts/JennyPlayer"
if not os.path.exists(BASE_DIR):
    BASE_DIR = os.getcwd()

# ==============================================================================
# 1. СЕРВЕР (player.py): ЧИСТКА ПРОЦЕССОВ FFMPEG БЕЗ ЗОМБИ И УТЕЧЕК ДЕСКРИПТОРОВ
# ==============================================================================
CLEAN_STREAM_FUNC = r"""@get('/api/video/full_stream_v210')
def api_video_full_stream_v210():
    raw_src = (request.query.get('src') or request.query.get('path') or '').strip()
    start_sec = 0.0
    try:
        start_sec = max(0.0, float(request.query.get('start') or 0.0))
    except Exception:
        start_sec = 0.0

    real_path = _resolve_video_src_input_v131(raw_src) if ("_resolve_video_src_input_v131" in globals() and raw_src) else raw_src
    if not real_path or not os.path.isfile(real_path):
        response.status = 404
        return "File not found"

    ext = os.path.splitext(real_path)[1].lower()
    if ext in ('.mp4', '.webm', '.m4v', '.mov') and start_sec <= 0.1:
        folder, fname = os.path.split(real_path)
        return static_file(fname, root=folder)

    # Убиваем предыдущий активный поток этого видео, чтобы не плодить процессы в RAM
    prev_proc = globals().get('_ACTIVE_FULL_STREAM_PROC_V211')
    if prev_proc is not None:
        try:
            prev_proc.kill()
            prev_proc.wait(timeout=0.3)
        except Exception:
            pass

    ff_bin = find_ffmpeg_binary()
    response.content_type = 'video/mp4'
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Accept-Ranges'] = 'none'

    vcodec_arg = ['-c:v', 'copy']
    if ext == '.avi':
        vcodec_arg = ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', '-threads', '2']

    cmd = [ff_bin, '-hide_banner', '-loglevel', 'error']
    if start_sec > 0.1:
        cmd += ['-ss', f"{start_sec:.2f}"]
    cmd += [
        '-i', real_path,
        *vcodec_arg,
        '-c:a', 'aac', '-b:a', '160k', '-ac', '2',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof+faststart',
        '-f', 'mp4', 'pipe:1'
    ]

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=262144)
    globals()['_ACTIVE_FULL_STREAM_PROC_V211'] = proc
    try:
        while True:
            chunk = proc.stdout.read(131072)
            if not chunk:
                break
            yield chunk
    except Exception:
        pass
    finally:
        try:
            if proc.stdout:
                proc.stdout.close()
        except Exception:
            pass
        try:
            proc.kill()
            proc.wait(timeout=0.5)
        except Exception:
            pass"""

for ppath in [os.path.join(BASE_DIR, "player.py"), os.path.join(BASE_DIR, "app", "src", "main", "python", "player.py")]:
    if not os.path.isfile(ppath):
        continue
    pcode = open(ppath, "r", encoding="utf-8", errors="ignore").read()
    pcode = re.sub(
        r"@get\('/api/video/full_stream_v210'\)\s*def api_video_full_stream_v210\(\):.*?(?=\n@\w+|\Z)",
        CLEAN_STREAM_FUNC + "\n",
        pcode,
        count=1,
        flags=re.DOTALL
    )
    open(ppath, "w", encoding="utf-8").write(pcode)
    print(f"[1/3] Устранена утечка процессов FFmpeg в: {ppath}")

# ==============================================================================
# 2. ЗАЩИТА WEBVIEW ОТ ВЫЛЕТА РЕНДЕРА В MAINACTIVITY.JAVA (onRenderProcessGone)
# ==============================================================================
main_java = os.path.join(BASE_DIR, "app", "src", "main", "java", "com", "jenny", "player", "MainActivity.java")
if os.path.isfile(main_java):
    jcode = open(main_java, "r", encoding="utf-8", errors="ignore").read()
    if "onRenderProcessGone" not in jcode:
        RENDER_GUARD_JAVA = """
            @Override
            public boolean onRenderProcessGone(android.webkit.WebView view, android.webkit.RenderProcessGoneDetail detail) {
                try {
                    if (view != null) {
                        view.reload();
                    }
                } catch (Throwable ignored) {}
                return true; // Предотвращает жесткий вылет приложения при сбое GPU/WebView процесса
            }
"""
        jcode = jcode.replace(
            "webView.setWebViewClient(new WebViewClient() {",
            "webView.setWebViewClient(new WebViewClient() {" + RENDER_GUARD_JAVA,
            1
        )
        open(main_java, "w", encoding="utf-8").write(jcode)
        print("[2/3] В MainActivity.java добавлен перехватчик onRenderProcessGone (защита от вылета WebView)")
    else:
        print("[2/3] MainActivity.java уже защищён onRenderProcessGone")

# ==============================================================================
# 3. ОПТИМИЗАЦИЯ UI_V71.JS: УБИРАЕМ 120Hz СПАМ В DOM И ТРОТТЛИМ ПЕРЕМОТКУ (SEEK)
# ==============================================================================
for upath in [os.path.join(BASE_DIR, "ui_v71.js"), os.path.join(BASE_DIR, "app", "src", "main", "python", "ui_v71.js")]:
    if not os.path.isfile(upath):
        continue
    ucode = open(upath, "r", encoding="utf-8", errors="ignore").read()

    # А. Защита WebGL texImage2D: не вызываем загрузку текстуры, пока у видео нет готовых размеров кадра
    ucode = ucode.replace(
        "if (!ensureLucasKanadeWebGL(vid)) return;",
        "if (!vid || vid.readyState < 2 || !vid.videoWidth || !vid.videoHeight) return;\n        if (!ensureLucasKanadeWebGL(vid)) return;"
    )

    # Б. В enforceHudVisibilityStateV210: меняем DOM ТОЛЬКО когда флаг скрытия или режим PiP реально изменился (а не 120 раз в секунду!)
    old_enforce = """    function enforceHudVisibilityStateV210(shouldHide, isPip) {
        var ov = document.getElementById('jennyVideoOverlayV130');
        if (!ov) return;
        hudCurrentlyHiddenV210 = Boolean(shouldHide);"""

    new_enforce = """    var lastAppliedHideV211 = null;
    var lastAppliedPipV211 = null;
    function enforceHudVisibilityStateV210(shouldHide, isPip, forceApply) {
        var ov = document.getElementById('jennyVideoOverlayV130');
        if (!ov) return;
        shouldHide = Boolean(shouldHide);
        isPip = Boolean(isPip);
        var st = window._vidStateV130;
        if (st) {
            if (st.hudTimer) { clearTimeout(st.hudTimer); st.hudTimer = null; }
            if (st.miniHudTimer) { clearTimeout(st.miniHudTimer); st.miniHudTimer = null; }
            st.hudVisible = !shouldHide;
        }
        // Не трогаем DOM 120 раз в секунду, если состояние видимости не менялось!
        if (!forceApply && shouldHide === lastAppliedHideV211 && isPip === lastAppliedPipV211) {
            return;
        }
        lastAppliedHideV211 = shouldHide;
        lastAppliedPipV211 = isPip;
        hudCurrentlyHiddenV210 = shouldHide;"""

    ucode = ucode.replace(old_enforce, new_enforce)
    ucode = ucode.replace(
        "enforceHudVisibilityStateV210(false, isPip);",
        "enforceHudVisibilityStateV210(false, isPip, true);",
        1 # в wakeVideoHudControlsV209
    )

    # В. Троттлинг перемотки seekDeckBVideoToSecV210 (не чаще 1 раза в 180 мс при ведении пальцем по полосе прогресса)
    old_seek = """    window.seekDeckBVideoToSecV210 = function(targetSec) {
        var vEl = document.getElementById('jennyVideoElV130');
        if (!vEl) return;"""

    new_seek = """    var lastSeekCallTsV211 = 0;
    var pendingSeekTimerV211 = null;
    window.seekDeckBVideoToSecV210 = function(targetSec, immediate) {
        var now = performance.now();
        if (!immediate && (now - lastSeekCallTsV211) < 180) {
            if (pendingSeekTimerV211) clearTimeout(pendingSeekTimerV211);
            pendingSeekTimerV211 = setTimeout(function() {
                window.seekDeckBVideoToSecV210(targetSec, true);
            }, 180);
            return;
        }
        lastSeekCallTsV211 = now;
        var vEl = document.getElementById('jennyVideoElV130');
        if (!vEl) return;"""

    ucode = ucode.replace(old_seek, new_seek)

    # Г. В loopFence() вызываем тяжелую синхронизацию DOM (syncDeckBWithVideoLifecycleV210 + виджеты) раз в 15 тиков (~8 раз в сек вместо 120 раз в сек!)
    old_loop_calls = """        var vEl = document.getElementById('jennyVideoElV130') || document.querySelector('video');
        if (vEl && vEl.parentElement) {
            var stage = vEl.parentElement;
            upgradeSplitLineV176();
            ensureLogDotsWidget(stage);
            ensureTunerSlidersWidget(stage);
            ensureSplitAnd120Pills(stage);

            if (fl.logDots && window._jv166Metrics && window._jv166Metrics.mode === 'off' && !vEl.paused) {
                recordComparativeTickV210(null, true);
            }
        }

        syncDeckBWithVideoLifecycleV210();
        checkAutoHideTickV210();"""

    new_loop_calls = """        window._fenceSlowTickV211 = ((window._fenceSlowTickV211 || 0) + 1) % 15;
        var vEl = document.getElementById('jennyVideoElV130');
        if (vEl && fl.logDots && window._jv166Metrics && window._jv166Metrics.mode === 'off' && !vEl.paused) {
            recordComparativeTickV210(null, true);
        }
        // Проверку DOM-таблеток, Деки Б и таймера скрытия делаем 8 раз в секунду вместо 120 раз в секунду!
        if (window._fenceSlowTickV211 === 0) {
            if (vEl && vEl.parentElement) {
                var stage = vEl.parentElement;
                upgradeSplitLineV176();
                ensureLogDotsWidget(stage);
                ensureTunerSlidersWidget(stage);
                ensureSplitAnd120Pills(stage);
            }
            syncDeckBWithVideoLifecycleV210();
            checkAutoHideTickV210();
        }"""

    ucode = ucode.replace(old_loop_calls, new_loop_calls)

    open(upath, "w", encoding="utf-8").write(ucode)
    print(f"[3/3] Снята 120Hz нагрузка с DOM и добавлен троттлинг перемотки в: {upath}")

print("\n✅ Патч стабильности V211 применён! Отправляй папку на сборку.")
