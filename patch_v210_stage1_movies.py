#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, re

_orig_sub = re.sub
re.sub = lambda pat, repl, string, *a, **kw: _orig_sub(pat, (repl if callable(repl) else (lambda _: repl)), string, *a, **kw)

BASE_DIR = "/storage/emulated/0/scripts/JennyPlayer"
if not os.path.exists(BASE_DIR):
    BASE_DIR = os.getcwd()

PLAYER_FULL_VIDEO_ROUTES = r"""
# === JENNY V210 STAGE 1: ПОЛНЫЙ ПОТОК ДЛЯ СКАЧАННЫХ ФИЛЬМОВ БЕЗ ОБРЕЗКИ 0:10 ===
@get('/api/video/full_stream_v210')
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

    ff_bin = find_ffmpeg_binary()
    response.content_type = 'video/mp4'
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Accept-Ranges'] = 'none'

    vcodec_arg = ['-c:v', 'copy']
    if ext == '.avi':
        vcodec_arg = ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p']

    cmd = [ff_bin, '-hide_banner', '-loglevel', 'error']
    if start_sec > 0.1:
        cmd += ['-ss', f"{start_sec:.2f}"]
    cmd += [
        '-i', real_path,
        *vcodec_arg,
        '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof+faststart',
        '-f', 'mp4', 'pipe:1'
    ]

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=262144)
    try:
        while True:
            chunk = proc.stdout.read(131072)
            if not chunk:
                break
            yield chunk
    finally:
        try:
            proc.kill()
        except Exception:
            pass
"""

for ppath in [os.path.join(BASE_DIR, "player.py"), os.path.join(BASE_DIR, "app", "src", "main", "python", "player.py")]:
    if not os.path.isfile(ppath):
        continue
    pcode = open(ppath, "r", encoding="utf-8", errors="ignore").read()

    # Убираем 10-секундные лимиты предпросмотра в FFmpeg
    pcode = re.sub(r"'-t',\s*'(?:10|12|15|20)',\s*", "", pcode)
    pcode = re.sub(r'"-t",\s*"(?:10|12|15|20)",\s*', "", pcode)

    if '"duration_sec":' not in pcode:
        pcode = pcode.replace(
            'cipher = "H264"\n    native_fps = 0.0',
            'cipher = "H264"\n    native_fps = 0.0\n    duration_sec = 0.0\n    is_complete_local = False'
        )
        pcode = pcode.replace(
            'info_txt = (pr.stderr or "") + (pr.stdout or "")',
            '''info_txt = (pr.stderr or "") + (pr.stdout or "")
            is_complete_local = os.path.isfile(real_path) and not real_path.endswith('.part')
            m_dur = re.search(r"Duration:\\s*(\\d+):(\\d+):(\\d+(?:\\.\\d+)?)", info_txt)
            if m_dur:
                duration_sec = round(int(m_dur.group(1)) * 3600 + int(m_dur.group(2)) * 60 + float(m_dur.group(3)), 2)'''
        )
        pcode = pcode.replace(
            '"native_fps": native_fps,',
            '"native_fps": native_fps,\n        "duration_sec": duration_sec,\n        "is_complete_local": is_complete_local,'
        )

    if "api_video_full_stream_v210" not in pcode:
        pcode = pcode.rstrip() + "\n\n" + PLAYER_FULL_VIDEO_ROUTES + "\n"

    open(ppath, "w", encoding="utf-8").write(pcode)
    print(f"[Этап 1] Обновлён player.py (полные фильмы без 0:10): {ppath}")

# Отключаем запуск торрент-буфера (RAM кусков) для полностью скачанных файлов в ui_v71.js
for upath in [os.path.join(BASE_DIR, "ui_v71.js"), os.path.join(BASE_DIR, "app", "src", "main", "python", "ui_v71.js")]:
    if not os.path.isfile(upath):
        continue
    ucode = open(upath, "r", encoding="utf-8", errors="ignore").read()

    # Сохраняем полную длительность из vcore_probe
    if "_jennyFullMovieDurationSecV210" not in ucode:
        ucode = ucode.replace(
            "window._jv166Metrics.fileNativeFps = d.native_fps;",
            "window._jv166Metrics.fileNativeFps = d.native_fps;\n                    if (d.duration_sec && d.duration_sec > 0) window._jennyFullMovieDurationSecV210 = d.duration_sec;"
        )

    # Блокируем старт нарезки кусков studioBuffer.startForVideo, если файл уже скачан локально (не .part)
    ucode = re.sub(
        r"(studioBuffer\.startForVideo\s*=\s*function\s*\(\s*src\s*\)\s*\{)",
        r"\1\n            if (src && String(src).toLowerCase().indexOf('.part') === -1 && String(src).toLowerCase().indexOf('torrent_stream') === -1) { this._pieceMapV72 = []; this._loadedCountV72 = 0; return; }",
        ucode
    )

    open(upath, "w", encoding="utf-8").write(ucode)
    print(f"[Этап 1] Отключён торрент-буфер на готовых фильмах в: {upath}")

print("✅ Этап 1 готов! Напиши 'давай 2', и я скину Этап 2 (Таймер UI + Дека Б).")
