import os
import json
import zlib
import struct
import shutil
import subprocess
import traceback
import bottle
from bottle import hook, route, run, post, response, static_file, request

bottle.BaseRequest.MEMFILE_MAX = 150 * 1024 * 1024

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

DEFAULT_MUSIC_DIR = "/storage/emulated/0/Music/"
MUSIC_DIR = DEFAULT_MUSIC_DIR
PRESET_FILE = os.path.join(DEFAULT_MUSIC_DIR, "jenny_dsp_preset.json")


def find_ffmpeg_binary():
    """Находит нативный бинарник libffmpeg.so в папке библиотек APK."""
    env_ff = os.environ.get("FFMPEG_BINARY")
    if env_ff and os.path.isfile(env_ff):
        return env_ff

    path_env = os.environ.get("PATH", "")
    for d in path_env.split(":"):
        if not d:
            continue
        for name in ("libffmpeg.so", "ffmpeg"):
            candidate = os.path.join(d, name)
            if os.path.isfile(candidate):
                return candidate

    return shutil.which("libffmpeg.so") or shutil.which("ffmpeg") or "libffmpeg.so"


def cleanup_stale_temps(directory):
    if not os.path.exists(directory):
        return
    try:
        for f in os.listdir(directory):
            if (f.startswith("temp_stretcher_") or f.startswith("temp_final_")) and f.endswith(".wav"):
                try:
                    os.remove(os.path.join(directory, f))
                except Exception:
                    pass
    except Exception:
        pass


def load_saved_music_dir():
    global MUSIC_DIR
    if os.path.exists(PRESET_FILE):
        try:
            with open(PRESET_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            saved_dir = data.get("customMusicDir")
            if saved_dir and os.path.isdir(saved_dir):
                MUSIC_DIR = saved_dir
        except Exception:
            pass


def build_atempo_filter(speed):
    speed = max(0.05, min(float(speed), 100.0))
    filters = []
    while speed > 2.0:
        filters.append("atempo=2.0")
        speed /= 2.0
    while speed < 0.5:
        filters.append("atempo=0.5")
        speed /= 0.5
    filters.append(f"atempo={speed:.6f}")
    return ",".join(filters)



@route('/')
def index():
    try:
        response.set_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        with open(os.path.join(BASE_DIR, 'index.html'), 'r', encoding="utf-8") as f:
            return f.read()
    except Exception:
        return f"<pre>{traceback.format_exc()}</pre>"


@route('/<filename:re:.*\\.(js|css)>')
def serve_static(filename):
    res = static_file(filename, root=BASE_DIR)
    res.set_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    res.set_header('Pragma', 'no-cache')
    return res



JENNY_REV_FOOTER_FMT = '<4sIII8s'
JENNY_REV_FOOTER_SIZE = 24  # struct.calcsize('<4sIII8s')


def read_jenny_rev_trailer(file_path):
    """Проверяет наличие капсулы восстановления JENNYV67 в конце .opus файла."""
    try:
        if not os.path.isfile(file_path):
            return None
        fsize = os.path.getsize(file_path)
        if fsize <= JENNY_REV_FOOTER_SIZE + 64:
            return None
        with open(file_path, 'rb') as f:
            f.seek(fsize - JENNY_REV_FOOTER_SIZE)
            footer = f.read(JENNY_REV_FOOTER_SIZE)
            head_magic, ver, map_len, pocket_len, tail_magic = struct.unpack(JENNY_REV_FOOTER_FMT, footer)
            if head_magic != b'JREV' or tail_magic != b'JENNYV67':
                return None
            total_trailer = map_len + pocket_len + JENNY_REV_FOOTER_SIZE
            if total_trailer >= fsize:
                return None
            audio_end = fsize - total_trailer
            return {
                "version": ver,
                "file_size": fsize,
                "audio_end": audio_end,
                "map_offset": audio_end,
                "map_len": map_len,
                "pocket_offset": audio_end + map_len,
                "pocket_len": pocket_len
            }
    except Exception:
        return None



@route('/api/full_path/<filename:path>', method='GET')
def get_full_track_path(filename):
    response.content_type = 'application/json'
    full_p = os.path.abspath(os.path.join(MUSIC_DIR, filename))
    return json.dumps({
        "status": "ok",
        "filename": filename,
        "music_dir": os.path.abspath(MUSIC_DIR),
        "full_path": full_p
    })


@route('/api/media/<filename:path>')
def serve_media(filename):
    return static_file(filename, root=MUSIC_DIR)


@route('/api/rev_info/<filename:path>', method='GET')
def get_rev_info(filename):
    full_p = os.path.join(MUSIC_DIR, filename)
    trailer = read_jenny_rev_trailer(full_p)
    response.content_type = 'application/json'
    if not trailer:
        return json.dumps({"status": "ok", "has_rev": False})
    try:
        with open(full_p, 'rb') as f:
            f.seek(trailer["map_offset"])
            map_zlib = f.read(trailer["map_len"])
        map_json_str = zlib.decompress(map_zlib).decode('utf-8')
        return json.dumps({
            "status": "ok",
            "has_rev": True,
            "map_bytes": trailer["map_len"],
            "pocket_bytes": trailer["pocket_len"],
            "audio_bytes": trailer["audio_end"],
            "seam_map": json.loads(map_json_str)
        })
    except Exception as e:
        return json.dumps({"status": "error", "has_rev": False, "error": str(e)})


@route('/api/rev_pocket/<filename:path>', method='GET')
def get_rev_pocket(filename):
    full_p = os.path.join(MUSIC_DIR, filename)
    trailer = read_jenny_rev_trailer(full_p)
    if not trailer or trailer["pocket_len"] <= 0:
        response.status = 404
        return "No pocket stream"
    with open(full_p, 'rb') as f:
        f.seek(trailer["pocket_offset"])
        masked = f.read(trailer["pocket_len"])
    # Снимаем XOR-маску 0xA5, возвращая валидный .opus поток для decodeAudioData
    unmasked = bytes(b ^ 0xA5 for b in masked)
    response.content_type = 'audio/ogg'
    response.set_header('Content-Length', str(len(unmasked)))
    return unmasked


DEFAULT_FORMAT_SLOTS = [
    {"en": True, "ext": "mp3"},
    {"en": True, "ext": "opus"},
    {"en": True, "ext": "m4a"},
    {"en": True, "ext": "flac"},
    {"en": True, "ext": "wav"},
    {"en": True, "ext": "ogg"},
    {"en": True, "ext": "mp4"},
    {"en": True, "ext": "aac"}
]

def get_allowed_extensions():
    q_exts = request.query.get('exts', '').strip()
    if q_exts:
        exts = [ '.' + x.strip().lower().lstrip('.') for x in q_exts.split(',') if x.strip() ]
        if exts:
            return tuple(exts)
    if os.path.exists(PRESET_FILE):
        try:
            with open(PRESET_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            slots = data.get("formatSlots")
            if isinstance(slots, list) and len(slots) > 0:
                exts = [ '.' + str(s.get('ext', '')).strip().lower().lstrip('.') for s in slots if s.get('en') and str(s.get('ext', '')).strip() ]
                if exts:
                    return tuple(exts)
        except Exception:
            pass
    return ('.mp3', '.opus', '.m4a', '.flac', '.wav', '.ogg', '.mp4', '.aac', '.webm', '.3gp', '.mkv')


@route('/api/data')
def get_data():
    all_tracks = []
    allowed_exts = get_allowed_extensions()
    if os.path.exists(MUSIC_DIR):
        for f in os.listdir(MUSIC_DIR):
            if f.lower().endswith(allowed_exts) and not f.startswith(('temp_stretcher_', 'temp_final_')):
                full_p = os.path.join(MUSIC_DIR, f)
                if os.path.isfile(full_p):
                    all_tracks.append(f)
    all_tracks.sort(key=lambda x: os.path.getmtime(os.path.join(MUSIC_DIR, x)), reverse=True)

    response.content_type = 'application/json'
    return json.dumps({
        "all_tracks": all_tracks,
        "session_tracks": all_tracks,
        "current_folder": MUSIC_DIR
    })


@post('/api/folder')
def change_folder():
    global MUSIC_DIR
    try:
        req = json.loads(request.body.read().decode('utf-8'))
        new_path = req.get('path', '').strip()
        if not new_path:
            response.status = 400
            return {"status": "error", "error": "Пустой путь"}

        if not new_path.startswith('/'):
            new_path = os.path.join('/storage/emulated/0', new_path)

        if not os.path.isdir(new_path):
            response.status = 404
            return {"status": "error", "error": f"Папка не найдена: {new_path}"}

        MUSIC_DIR = new_path
        cleanup_stale_temps(MUSIC_DIR)

        data = {}
        if os.path.exists(PRESET_FILE):
            try:
                with open(PRESET_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception:
                data = {}
        data["customMusicDir"] = MUSIC_DIR
        os.makedirs(os.path.dirname(PRESET_FILE), exist_ok=True)
        with open(PRESET_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

        return {"status": "ok", "current_folder": MUSIC_DIR}
    except Exception as e:
        response.status = 500
        return {"status": "error", "error": str(e)}


@route('/api/config', method='GET')
def get_config():
    if os.path.exists(PRESET_FILE):
        with open(PRESET_FILE, 'r', encoding='utf-8') as f:
            return f.read()
    return "{}"


@route('/api/config/save_all', method='POST')
def save_config_all():
    try:
        data = json.loads(request.body.read().decode('utf-8'))
        if os.path.exists(PRESET_FILE):
            try:
                with open(PRESET_FILE, 'r', encoding='utf-8') as old_f:
                    old_data = json.load(old_f)
                if "customMusicDir" in old_data and "customMusicDir" not in data:
                    data["customMusicDir"] = old_data["customMusicDir"]
            except Exception:
                pass
        os.makedirs(os.path.dirname(PRESET_FILE), exist_ok=True)
        with open(PRESET_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        return {"status": "ok"}
    except Exception:
        return {"status": "error"}


@route('/api/config/save_single', method='POST')
def save_config_single():
    try:
        req = json.loads(request.body.read().decode('utf-8'))
        cat = req.get('category')
        key = req.get('key')
        val = req.get('value')

        data = {}
        if os.path.exists(PRESET_FILE):
            with open(PRESET_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)

        if cat == 'main':
            data[key] = val
        else:
            if cat not in data or not isinstance(data[cat], dict):
                data[cat] = {}
            data[cat][key] = val

        os.makedirs(os.path.dirname(PRESET_FILE), exist_ok=True)
        with open(PRESET_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        return {"status": "ok"}
    except Exception:
        return {"status": "error"}


@post('/api/stretch')
def stretch_track():
    temp_stretched = None
    try:
        filename = request.forms.get('filename')
        speed = float(request.forms.get('speed', 1.0))
        original_path = os.path.join(MUSIC_DIR, filename)
        temp_stretched = os.path.join(MUSIC_DIR, f"temp_stretcher_{os.getpid()}.wav")

        ffmpeg_bin = find_ffmpeg_binary()
        atempo_chain = build_atempo_filter(speed)
        cmd = [ffmpeg_bin, '-y', '-i', original_path, '-filter:a', atempo_chain, temp_stretched]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        if res.returncode != 0 or not os.path.exists(temp_stretched):
            err_tail = (res.stderr or "")[-200:]
            response.status = 500
            return {"error": f"Stretch error ({res.returncode}): {err_tail}"}

        with open(temp_stretched, 'rb') as f:
            wav_bytes = f.read()

        response.content_type = 'audio/wav'
        return wav_bytes
    except Exception as e:
        response.status = 500
        return {"error": str(e)}
    finally:
        if temp_stretched and os.path.exists(temp_stretched):
            try:
                os.remove(temp_stretched)
            except Exception:
                pass


@post('/api/export')
def export_track():
    temp_wav = None
    try:
        original_name = request.forms.get('filename')
        speed = request.forms.get('speed', '1.0')
        is_reversed = request.forms.get('is_reversed') == 'true'
        pitch_lock = request.forms.get('pitch_lock') == 'true'
        upload = request.files.get('audio_data')

        if not upload or not original_name:
            response.status = 400
            return {"status": "error", "error": "Нет файла или имени трека"}

        base_name, _ = os.path.splitext(original_name)
        speed_float = float(speed)
        speed_suffix = f"_x{speed}" if speed_float != 1.0 else ""
        rev_suffix = "_rev" if is_reversed else ""
        engine_mode = request.forms.get('engine_mode', '')
        if engine_mode == 'jbuf':
            pitch_suffix = "_jbuf90"
        elif engine_mode == 'webapi' or pitch_lock:
            pitch_suffix = "_pitchLock"
        else:
            pitch_suffix = "_vinyl" 
        slow_fast = "_slow" if speed_float < 1.0 else ("_fast" if speed_float > 1.0 else "")

        new_filename = f"{base_name}{speed_suffix}{rev_suffix}{slow_fast}{pitch_suffix}.opus"
        temp_wav = os.path.join(MUSIC_DIR, f"temp_final_{os.getpid()}.wav")
        final_opus = os.path.join(MUSIC_DIR, new_filename)

        with open(temp_wav, 'wb') as out_f:
            shutil.copyfileobj(upload.file, out_f)

        ffmpeg_bin = find_ffmpeg_binary()

        # 1. Пробуем кодировать через libopus
        cmd1 = [ffmpeg_bin, '-y', '-i', temp_wav, '-c:a', 'libopus', '-b:a', '128k', final_opus]
        r1 = subprocess.run(cmd1, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        encoded_ok = (r1.returncode == 0 and os.path.exists(final_opus) and os.path.getsize(final_opus) > 100)
        if not encoded_ok:
            cmd2 = [ffmpeg_bin, '-y', '-i', temp_wav, '-c:a', 'opus', '-strict', '-2', '-b:a', '128k', final_opus]
            r2 = subprocess.run(cmd2, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            encoded_ok = (r2.returncode == 0 and os.path.exists(final_opus) and os.path.getsize(final_opus) > 100)

        if encoded_ok:
            rev_badge = ""
            seam_map_str = request.forms.get('seam_map_json', '').strip()
            pocket_upload = request.files.get('pocket_audio')
            if seam_map_str:
                try:
                    map_zlib = zlib.compress(seam_map_str.encode('utf-8'), level=9)
                    pocket_masked = b""
                    if pocket_upload:
                        temp_pck_wav = os.path.join(MUSIC_DIR, f"temp_final_pck_{os.getpid()}.wav")
                        temp_pck_opus = os.path.join(MUSIC_DIR, f"temp_final_pck_{os.getpid()}.opus")
                        try:
                            with open(temp_pck_wav, 'wb') as pf:
                                shutil.copyfileobj(pocket_upload.file, pf)
                            pr = subprocess.run([ffmpeg_bin, '-y', '-i', temp_pck_wav, '-c:a', 'libopus', '-b:a', '128k', temp_pck_opus], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                            if pr.returncode != 0 or not os.path.exists(temp_pck_opus):
                                subprocess.run([ffmpeg_bin, '-y', '-i', temp_pck_wav, '-c:a', 'opus', '-strict', '-2', '-b:a', '128k', temp_pck_opus], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                            if os.path.exists(temp_pck_opus) and os.path.getsize(temp_pck_opus) > 32:
                                with open(temp_pck_opus, 'rb') as pof:
                                    raw_pck = pof.read()
                                pocket_masked = bytes(b ^ 0xA5 for b in raw_pck)
                        finally:
                            for tp in (temp_pck_wav, temp_pck_opus):
                                if os.path.exists(tp):
                                    try: os.remove(tp)
                                    except Exception: pass

                    footer = struct.pack(JENNY_REV_FOOTER_FMT, b'JREV', 67, len(map_zlib), len(pocket_masked), b'JENNYV67')
                    with open(final_opus, 'ab') as af:
                        af.write(map_zlib)
                        if pocket_masked:
                            af.write(pocket_masked)
                        af.write(footer)

                    total_kb = (len(map_zlib) + len(pocket_masked)) / 1024.0
                    rev_badge = f"[🧬 REV: {total_kb:.1f} KB]"
                except Exception:
                    pass
            return {"status": "ok", "new_file": new_filename, "rev_badge": rev_badge}

        err_msg = (r1.stderr or r2.stderr or f"Код возврата {r1.returncode}")[-200:]
        response.status = 500
        return {"status": "error", "error": f"FFmpeg ({ffmpeg_bin}): {err_msg}"}

    except Exception as e:
        response.status = 500
        return {"status": "error", "error": str(e)}
    finally:
        if temp_wav and os.path.exists(temp_wav):
            try:
                os.remove(temp_wav)
            except Exception:
                pass




@post('/api/track_info')
def get_track_info():
    import re
    import datetime
    try:
        req = json.loads(request.body.read().decode('utf-8'))
        filename = req.get('filename', '')
        full_path = os.path.join(MUSIC_DIR, filename)
        if not filename or not os.path.isfile(full_path):
            response.status = 404
            return {"status": "error", "error": "Файл не найден"}

        st = os.stat(full_path)
        size_bytes = st.st_size
        size_mb = f"{size_bytes / (1024 * 1024):.2f} MB ({size_bytes:,} B)".replace(",", " ")
        mtime_str = datetime.datetime.fromtimestamp(st.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
        ext = os.path.splitext(filename)[1].lower().lstrip('.') or 'raw'

        container_map = {
            'opus': 'OGG / Opus Audio Container',
            'm4a': 'MP4 / ISO Media (Apple Audio)',
            'mp4': 'MPEG-4 Part 14 (Video/Audio Container)',
            'mp3': 'MPEG-1/2 Audio Layer III',
            'wav': 'RIFF WAVE (Uncompressed PCM)',
            'flac': 'Free Lossless Audio Codec',
            'ogg': 'OGG Vorbis Audio Container',
            'aac': 'Advanced Audio Coding (ADTS)',
            'webm': 'WebM Media Audio/Video Container'
        }
        container_desc = container_map.get(ext, f"{ext.upper()} Audio Stream")

        ffmpeg_bin = find_ffmpeg_binary()
        probe = subprocess.run([ffmpeg_bin, '-hide_banner', '-i', full_path],
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        raw_info = (probe.stderr or "") + (probe.stdout or "")

        dur_match = re.search(r"Duration:\s*(\d+:\d+:\d+\.\d+)", raw_info)
        duration_str = dur_match.group(1) if dur_match else "—"
        dur_seconds = 0.0
        if dur_match:
            parts = duration_str.split(':')
            dur_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])

        br_match = re.search(r"bitrate:\s*(\d+\s*kb/s)", raw_info)
        bitrate_str = br_match.group(1) if br_match else (
            f"{int((size_bytes * 8) / dur_seconds / 1000)} kb/s (CBR/VBR calc)" if dur_seconds > 0 else "—"
        )

        codec_str, sr_str, ch_str, fmt_str = ext.upper(), "48000 Hz", "stereo (2 ch)", "fltp (32-bit float)"
        stream_match = re.search(r"Stream #\d+:\d+.*?: Audio:\s*([^\n]+)", raw_info)
        if stream_match:
            s_line = stream_match.group(1)
            s_parts = [p.strip() for p in s_line.split(',')]
            if len(s_parts) >= 1:
                codec_str = s_parts[0]
            for p in s_parts[1:]:
                if 'Hz' in p:
                    sr_str = p
                elif any(k in p for k in ('stereo', 'mono', '5.1', 'channels', 'ch')):
                    ch_str = p
                elif p in ('fltp', 's16', 's16p', 's32', 's32p', 'dblp'):
                    fmt_str = p

        tags = {}
        for tag_key in ('title', 'artist', 'album', 'encoder', 'date', 'genre'):
            m = re.search(rf"^\s*{tag_key}\s*:\s*(.+)$", raw_info, re.IGNORECASE | re.MULTILINE)
            if m:
                tags[tag_key.upper()] = m.group(1).strip()

        sr_num = int(re.sub(r"\D", "", sr_str) or "48000")
        total_samples = f"{int(dur_seconds * sr_num):,}".replace(",", " ") if dur_seconds > 0 else "—"

        response.content_type = 'application/json'
        rev_capsule_str = "None (Standard stream)"
        trailer = read_jenny_rev_trailer(full_path)
        if trailer:
            try:
                with open(full_path, 'rb') as rf:
                    rf.seek(trailer["map_offset"])
                    smap = json.loads(zlib.decompress(rf.read(trailer["map_len"])).decode('utf-8'))
                seams_cnt = len(smap.get("seams", []))
                spd_val = smap.get("spd", 1.0)
                kb_total = (trailer["map_len"] + trailer["pocket_len"]) / 1024.0
                pck_kb = trailer["pocket_len"] / 1024.0
                rev_capsule_str = f"🧬 JENNYV67 (x{spd_val} | {seams_cnt} швов | {kb_total:.1f} KB, карман {pck_kb:.1f} KB)"
            except Exception:
                rev_capsule_str = "🧬 JENNYV67 Capsule"

        return json.dumps({
            "status": "ok",
            "rev_capsule": rev_capsule_str,
            "filename": filename,
            "full_path": full_path,
            "folder": MUSIC_DIR,
            "container": container_desc,
            "size_str": size_mb,
            "mtime": mtime_str,
            "duration": duration_str,
            "bitrate": bitrate_str,
            "codec": codec_str,
            "sample_rate": sr_str,
            "channels": ch_str,
            "sample_fmt": fmt_str,
            "total_samples": total_samples,
            "tags": tags
        })
    except Exception as e:
        response.status = 500
        return {"status": "error", "error": str(e)}




@post('/api/save_test_slices')
def save_test_slices():
    import base64, datetime, re
    try:
        req = json.loads(request.body.read().decode('utf-8'))
        out_dir = '/storage/emulated/0/Music/mp3_test'
        os.makedirs(out_dir, exist_ok=True)
        track = re.sub(r'[^a-zA-Z0-9а-яА-Я_-]', '_', os.path.splitext(req.get('track', 'track'))[0])[:24]
        spd_str = req.get('speed_str', 'x1.00')
        s_start = req.get('orig_start', 0)
        s_end = req.get('orig_end', 0)
        stamp = datetime.datetime.now().strftime('%H%M%S')
        prefix = f"V61_{stamp}_{track}_s{s_start}_to_s{s_end}"

        orig_wav = os.path.join(out_dir, f"{prefix}_1_ORIG.wav")
        hose_wav = os.path.join(out_dir, f"{prefix}_2_HOSE_{spd_str}.wav")
        log_path = os.path.join(out_dir, f"{prefix}_3_DEBUG.txt")

        with open(orig_wav, 'wb') as f1: f1.write(base64.b64decode(req['orig_wav_b64']))
        with open(hose_wav, 'wb') as f2: f2.write(base64.b64decode(req['hose_wav_b64']))
        with open(log_path, 'w', encoding='utf-8') as f3: f3.write(req.get('report_txt', ''))

        try:
            ff = find_ffmpeg_binary()
            subprocess.run([ff, '-y', '-i', orig_wav, '-b:a', '320k', orig_wav.replace('.wav', '.mp3')], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            subprocess.run([ff, '-y', '-i', hose_wav, '-b:a', '320k', hose_wav.replace('.wav', '.mp3')], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except Exception:
            pass

        response.content_type = 'application/json'
        return json.dumps({"status": "ok", "prefix": prefix})
    except Exception as e:
        response.status = 500
        return {"status": "error", "error": str(e)}


def start_server():
    load_saved_music_dir()
    cleanup_stale_temps(DEFAULT_MUSIC_DIR)
    if MUSIC_DIR != DEFAULT_MUSIC_DIR:
        cleanup_stale_temps(MUSIC_DIR)
    print("🎧 АВТОНОМНЫЙ ПЛЕЕР ЗАПУЩЕН НА ПОРТУ 8080")
    run(host='127.0.0.1', port=8080, quiet=True, server='waitress')


if __name__ == "__main__":
    start_server()
