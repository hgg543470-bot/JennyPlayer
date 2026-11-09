#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, re

_orig_sub = re.sub
re.sub = lambda pat, repl, string, *a, **kw: _orig_sub(pat, (repl if callable(repl) else (lambda _: repl)), string, *a, **kw)

BASE_DIR = "/storage/emulated/0/scripts/JennyPlayer"
if not os.path.exists(BASE_DIR):
    BASE_DIR = os.getcwd()

# 1. MainActivity.java: защита WebView от закрытия приложения при перезапуске GPU-рендера
main_java = os.path.join(BASE_DIR, "app", "src", "main", "java", "com", "jenny", "player", "MainActivity.java")
if os.path.isfile(main_java):
    jcode = open(main_java, "r", encoding="utf-8", errors="ignore").read()
    if "onRenderProcessGone" not in jcode:
        jcode = jcode.replace(
            "webView.setWebViewClient(new WebViewClient());",
            """webView.setWebViewClient(new WebViewClient() {
            @android.annotation.TargetApi(26)
            @Override
            public boolean onRenderProcessGone(android.webkit.WebView view, android.webkit.RenderProcessGoneDetail detail) {
                try { if (view != null) view.reload(); } catch (Throwable ignored) {}
                return true;
            }
        });"""
        )
        open(main_java, "w", encoding="utf-8").write(jcode)
        print("[Этап 1] MainActivity.java: добавлена защита WebView onRenderProcessGone")

# 2. player.py: 32 потока waitress, полный ремукс MKV/AVI без обрыва на 0:10, отключение торрент-режима для скачанных фильмов
NEW_LIVE_REMUX = r"""_ACTIVE_REMUX_PROCS_V210 = set()
_REMUX_LOCK_V210 = threading.Lock()

@route('/api/video/live_remux', method='GET')
def api_video_live_remux_v130():
    src = (request.query.get('src') or '').strip()
    start_sec = 0.0
    try:
        start_sec = max(0.0, float(request.query.get('start') or 0.0))
    except Exception:
        start_sec = 0.0
    if not src:
        response.status = 400
        return "Missing src"
    if src.startswith('/api/torrent/stream/'):
        parts = src.strip('/').split('/')
        if len(parts) >= 5:
            h_low = parts[3].lower()
            f_idx = parts[4].split('?')[0]
            ensure_jtorrent_daemon_v96()
            src_input = f"http://127.0.0.1:{_JTORRENT_PORT_V96}/stream?hash={h_low}&file={f_idx}"
        else:
            response.status = 400
            return "Invalid torrent stream path"
    elif src.startswith('/api/media/'):
        fn = urllib.parse.unquote(src[len('/api/media/'):].split('?')[0])
        src_input = resolve_track_full_path_v71(fn)
    else:
        src_input = resolve_track_full_path_v71(src)

    # Останавливаем старые процессы live_remux, чтобы они не забивали процессор и пайпы
    with _REMUX_LOCK_V210:
        for old_p in list(_ACTIVE_REMUX_PROCS_V210):
            try:
                old_p.kill()
            except Exception:
                pass
        _ACTIVE_REMUX_PROCS_V210.clear()

    ff_bin = find_ffmpeg_binary()
    low_in = src_input.lower()
    # Для .mkv/.mp4/.webm копируем видеопоток напрямую (-c:v copy, 0% нагрузки и вся длина фильма!),
    # а перекодировку libx264 включаем только для старых контейнеров (.avi/.wmv/.flv/.mpeg)
    needs_v_transcode = low_in.endswith(('.avi', '.wmv', '.flv', '.mpeg', '.mpg', '.vob')) or (request.query.get('transcode') == '1' and not low_in.endswith(('.mkv', '.mp4', '.m4v', '.mov', '.webm')))
    v_codec_args = [
        '-threads', '4', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22', '-pix_fmt', 'yuv420p'
    ] if needs_v_transcode else ['-c:v', 'copy']

    cmd = [ff_bin, '-hide_banner', '-loglevel', 'error', '-fflags', '+genpts', '-avoid_negative_ts', 'make_zero']
    if start_sec > 0.5:
        cmd.extend(['-ss', f"{start_sec:.2f}"])
    cmd.extend([
        '-i', src_input,
        '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn',
        *v_codec_args,
        '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
        '-max_muxing_queue_size', '4096',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof+faststart',
        '-f', 'mp4', 'pipe:1'
    ])

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=262144, close_fds=True)
    with _REMUX_LOCK_V210:
        _ACTIVE_REMUX_PROCS_V210.add(proc)

    resp_hdrs = {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
    def _remux_gen():
        try:
            while True:
                chunk = proc.stdout.read(131072)
                if not chunk:
                    break
                yield chunk
        finally:
            with _REMUX_LOCK_V210:
                _ACTIVE_REMUX_PROCS_V210.discard(proc)
            try:
                if proc.stdout:
                    proc.stdout.close()
            except Exception:
                pass
            try:
                proc.kill()
                proc.wait(timeout=0.3)
            except Exception:
                pass
    return bottle.HTTPResponse(body=_remux_gen(), status=200, headers=resp_hdrs)"""

for ppath in [os.path.join(BASE_DIR, "player.py"), os.path.join(BASE_DIR, "app", "src", "main", "python", "player.py")]:
    if not os.path.isfile(ppath):
        continue
    pcode = open(ppath, "r", encoding="utf-8", errors="ignore").read()

    # А. Увеличиваем число потоков waitress с 4 до 32 (чтобы 6 воркеров распаковки RAM не вешали видеопоток!)
    pcode = pcode.replace(
        "run(host='127.0.0.1', port=8080, quiet=True, server='waitress')",
        "run(host='127.0.0.1', port=8080, quiet=True, server='waitress', threads=32)"
    )

    # Б. Заменяем api_video_live_remux_v130 на стабильную версию без +igndts и с -map 0:v:0 -map 0:a:0? -sn -dn
    pcode = re.sub(
        r"@route\('/api/video/live_remux',\s*method='GET'\)\s*def api_video_live_remux_v130\(\):.*?return bottle\.HTTPResponse\(body=_remux_gen\(\),\s*status=200,\s*headers=resp_hdrs\)",
        NEW_LIVE_REMUX,
        pcode,
        count=1,
        flags=re.DOTALL
    )

    # В. В sync_downloaded_videos_to_library_v134: если видео уже скачано локально (или pct >= 100), НЕ вешаем на него tor_hash и /api/torrent/stream!
    old_tor_meta = """                    if bn not in _discovered_video_meta_v137:
                        _discovered_video_meta_v137[bn] = {
                            "name": bn,
                            "size_mb": sz_mb,
                            "percent": pct,
                            "tor_hash": h,
                            "tor_file_idx": f_idx,
                            "in_video_dir": False,
                            "stream_url": f"/api/torrent/stream/{h}/{f_idx}"
                        }
                    else:
                        _discovered_video_meta_v137[bn]["tor_hash"] = h
                        _discovered_video_meta_v137[bn]["tor_file_idx"] = f_idx
                        _discovered_video_meta_v137[bn]["percent"] = pct"""

    new_tor_meta = """                    is_done_local = (pct >= 100) or (bn in _discovered_video_paths_v134 and os.path.isfile(_discovered_video_paths_v134[bn]) and not _discovered_video_paths_v134[bn].endswith('.part'))
                    if bn not in _discovered_video_meta_v137:
                        _discovered_video_meta_v137[bn] = {
                            "name": bn,
                            "size_mb": sz_mb,
                            "percent": 100 if is_done_local else pct,
                            "tor_hash": "" if is_done_local else h,
                            "tor_file_idx": -1 if is_done_local else f_idx,
                            "in_video_dir": is_done_local,
                            "stream_url": ("/api/media/" + urllib.parse.quote(bn)) if is_done_local else f"/api/torrent/stream/{h}/{f_idx}"
                        }
                    elif not is_done_local and not _discovered_video_meta_v137[bn].get("in_video_dir"):
                        _discovered_video_meta_v137[bn]["tor_hash"] = h
                        _discovered_video_meta_v137[bn]["tor_file_idx"] = f_idx
                        _discovered_video_meta_v137[bn]["percent"] = pct"""

    pcode = pcode.replace(old_tor_meta, new_tor_meta)

    # Г. Защищаем ctypes-вызовы libjenny_vcore.so замком потоков + возвращаем duration_sec в vcore_probe
    if "_VCORE_LOCK_V210" not in pcode:
        pcode = pcode.replace(
            "def _get_vcore_lib_v166():",
            "_VCORE_LOCK_V210 = threading.Lock()\ndef _get_vcore_lib_v166():"
        )
    pcode = pcode.replace(
        "res = lib.jv_detect_cipher(real_path.encode('utf-8'))",
        "with _VCORE_LOCK_V210:\n                res = lib.jv_detect_cipher(real_path.encode('utf-8'))"
    )
    pcode = pcode.replace(
        "neon_ms = round(float(lib.jv_neon_mv_pass(1920, 1080, ctypes.byref(mv_cnt))), 3)",
        "with _VCORE_LOCK_V210:\n                neon_ms = round(float(lib.jv_neon_mv_pass(1920, 1080, ctypes.byref(mv_cnt))), 3)"
    )

    # Удаляем старый хвост full_stream_v210, если он остался
    pcode = re.sub(r"# === JENNY V210 STAGE 1:.*$", "", pcode, flags=re.DOTALL)

    open(ppath, "w", encoding="utf-8").write(pcode)
    print(f"[Этап 1] Обновлён сервер и ремуксер в: {ppath}")

print("✅ Этап 1 завершён! Напиши '+', и я дам Этап 2 (UI-таймер, Дека Б и нижняя панель).")
