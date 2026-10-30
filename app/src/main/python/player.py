import re
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





# === JENNY V71 BACKEND START ===
ACTIVE_MUSIC_DIRS = [DEFAULT_MUSIC_DIR]
SAVED_MUSIC_DIRS = ["/storage/emulated/0/Music", "/storage/emulated/0/Music/mp3_test", "/storage/emulated/0/Download"]
TRACK_META_CACHE_V71 = {}

def norm_dir_v71(p):
    if not p: return "/storage/emulated/0/Music"
    p = str(p).strip()
    if not p.startswith('/'): p = os.path.join('/storage/emulated/0', p)
    return os.path.normpath(p)

def load_multi_dirs_v71():
    global MUSIC_DIR, ACTIVE_MUSIC_DIRS, SAVED_MUSIC_DIRS
    if os.path.exists(PRESET_FILE):
        try:
            with open(PRESET_FILE, 'r', encoding='utf-8') as f: data = json.load(f)
            saved, active, c_dir = data.get("savedFolders"), data.get("activeFolders"), data.get("customMusicDir")
            if isinstance(saved, list) and saved:
                SAVED_MUSIC_DIRS = []
                for d in saved:
                    nd = norm_dir_v71(d)
                    if nd not in SAVED_MUSIC_DIRS: SAVED_MUSIC_DIRS.append(nd)
            if isinstance(active, list) and active:
                ACTIVE_MUSIC_DIRS = []
                for d in active:
                    nd = norm_dir_v71(d)
                    if os.path.isdir(nd) and nd not in ACTIVE_MUSIC_DIRS:
                        ACTIVE_MUSIC_DIRS.append(nd)
                        if nd not in SAVED_MUSIC_DIRS: SAVED_MUSIC_DIRS.append(nd)
            elif c_dir and os.path.isdir(norm_dir_v71(c_dir)):
                nd = norm_dir_v71(c_dir)
                ACTIVE_MUSIC_DIRS = [nd]
                if nd not in SAVED_MUSIC_DIRS: SAVED_MUSIC_DIRS.insert(0, nd)
        except Exception: pass
    if not ACTIVE_MUSIC_DIRS: ACTIVE_MUSIC_DIRS = [norm_dir_v71(DEFAULT_MUSIC_DIR)]
    MUSIC_DIR = ACTIVE_MUSIC_DIRS[0]

def save_multi_dirs_v71():
    data = {}
    if os.path.exists(PRESET_FILE):
        try:
            with open(PRESET_FILE, 'r', encoding='utf-8') as f: data = json.load(f)
        except Exception: data = {}
    data["savedFolders"] = SAVED_MUSIC_DIRS
    data["activeFolders"] = ACTIVE_MUSIC_DIRS
    data["customMusicDir"] = ACTIVE_MUSIC_DIRS[0] if ACTIVE_MUSIC_DIRS else MUSIC_DIR
    os.makedirs(os.path.dirname(PRESET_FILE), exist_ok=True)
    with open(PRESET_FILE, 'w', encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, indent=4)

def resolve_track_full_path_v71(filename):
    if not filename: return os.path.join(MUSIC_DIR, "")
    load_multi_dirs_v71()
    for d in ACTIVE_MUSIC_DIRS + SAVED_MUSIC_DIRS:
        cand = os.path.join(d, filename)
        if os.path.isfile(cand): return cand
    return os.path.join(MUSIC_DIR, filename)

def quick_parse_artist_album_v71(filename, full_p):
    st_mtime, st_size = 0, 0
    try:
        st = os.stat(full_p)
        st_mtime, st_size = st.st_mtime, st.st_size
    except Exception: pass
    cached = TRACK_META_CACHE_V71.get(full_p)
    if cached and cached.get("mtime") == round(st_mtime, 2) and cached.get("size") == st_size:
        return cached
    stem = os.path.splitext(filename)[0]
    clean_stem = re.sub(r'(?:_x\d+(?:[.,]\d+)?(?:_[a-z0-9]+)*|_(?:slow|fast)(?:_[a-z0-9]+)*|_(?:jbuf90|jbuf_shift|jbuf|web_lock|web_shift|webapi|vinyl|neutral|pitchlock)|_rev(?:ersed)?)+$', '', stem, flags=re.I)
    artist = "Разные артисты"
    album = os.path.basename(os.path.dirname(full_p)) or "Music"
    parts = re.split(r'\s+[-–—]\s+', clean_stem)
    if len(parts) >= 2 and parts[0].strip():
        artist = parts[0].strip()
        if len(parts) >= 3 and parts[1].strip():
            album = parts[1].strip()
    ext = os.path.splitext(filename)[1].lower()
    kbps = 128.0 if ext in ('.opus', '.ogg', '.m4a', '.aac') else (320.0 if ext == '.mp3' else 900.0)
    meta = {"mtime": round(st_mtime, 2), "size": st_size, "dur": round(max(1.0, (st_size * 8.0) / (kbps * 1000.0)), 1), "artist": artist, "album": album}
    TRACK_META_CACHE_V71[full_p] = meta
    return meta

@route('/api/folders_v71', method=['GET', 'POST'])
def api_folders_v71():
    global MUSIC_DIR, ACTIVE_MUSIC_DIRS, SAVED_MUSIC_DIRS
    load_multi_dirs_v71()
    if request.method == 'POST':
        try:
            req = json.loads(request.body.read().decode('utf-8'))
            act, target = req.get('action', ''), norm_dir_v71(req.get('path', ''))
            if act in ('toggle', 'add') and not os.path.isdir(target):
                response.status = 404
                return {"status": "error", "error": f"Папка не найдена: {target}"}
            if act == 'toggle':
                if target not in SAVED_MUSIC_DIRS: SAVED_MUSIC_DIRS.append(target)
                if target in ACTIVE_MUSIC_DIRS:
                    if len(ACTIVE_MUSIC_DIRS) > 1: ACTIVE_MUSIC_DIRS.remove(target)
                else: ACTIVE_MUSIC_DIRS.append(target)
            elif act == 'add':
                if target not in SAVED_MUSIC_DIRS: SAVED_MUSIC_DIRS.insert(0, target)
                if target not in ACTIVE_MUSIC_DIRS: ACTIVE_MUSIC_DIRS.append(target)
            elif act == 'remove':
                if target in SAVED_MUSIC_DIRS and len(SAVED_MUSIC_DIRS) > 1: SAVED_MUSIC_DIRS.remove(target)
                if target in ACTIVE_MUSIC_DIRS and len(ACTIVE_MUSIC_DIRS) > 1: ACTIVE_MUSIC_DIRS.remove(target)
                if not ACTIVE_MUSIC_DIRS and SAVED_MUSIC_DIRS: ACTIVE_MUSIC_DIRS = [SAVED_MUSIC_DIRS[0]]
            MUSIC_DIR = ACTIVE_MUSIC_DIRS[0]
            save_multi_dirs_v71()
        except Exception as e:
            response.status = 500
            return {"status": "error", "error": str(e)}
    exts = get_allowed_extensions()
    f_tracks = {}
    for d in SAVED_MUSIC_DIRS:
        f_tracks[d] = [fn for fn in (os.listdir(d) if os.path.isdir(d) else []) if fn.lower().endswith(exts) and not fn.startswith(('temp_stretcher_', 'temp_final_')) and os.path.isfile(os.path.join(d, fn))]
    response.content_type = 'application/json'
    return json.dumps({"status": "ok", "saved_folders": SAVED_MUSIC_DIRS, "active_folders": ACTIVE_MUSIC_DIRS, "current_folder": MUSIC_DIR, "folder_tracks": f_tracks})

@post('/api/delete_track_v71')
def delete_track_v71():
    try:
        req = json.loads(request.body.read().decode('utf-8'))
        fn = req.get('filename', '').strip()
        fp = resolve_track_full_path_v71(fn)
        if not fn or not os.path.isfile(fp):
            response.status = 404
            return {"status": "error", "error": "Файл не найден"}
        os.remove(fp)
        TRACK_META_CACHE_V71.pop(fp, None)
        return {"status": "ok", "deleted": fn}
    except Exception as e:
        response.status = 500
        return {"status": "error", "error": str(e)}

@post('/api/track_meta_v71')
def get_track_meta_v71():
    try:
        req = json.loads(request.body.read().decode('utf-8'))
        fn = req.get('filename', '').strip()
        fp = resolve_track_full_path_v71(fn)
        if not fn or not os.path.isfile(fp):
            response.status = 404
            return {"status": "error", "error": "Файл не найден"}
        ff = find_ffmpeg_binary()
        pr = subprocess.run([ff, '-hide_banner', '-i', fp], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        raw = (pr.stderr or "") + (pr.stdout or "")
        tags, in_m = {}, False
        for line in raw.splitlines():
            if re.match(r"^\s*Metadata:\s*$", line): in_m = True; continue
            if in_m:
                if re.match(r"^\s*(Duration:|Stream #|Chapter #)", line): in_m = False; continue
                m = re.match(r"^\s*([A-Za-z0-9_\-\.]+)\s*:\s*(.+)$", line)
                if m and m.group(1).strip().upper() not in ('ENCODER', 'DURATION'):
                    tags[m.group(1).strip().upper()] = m.group(2).strip()
        tr = read_jenny_rev_trailer(fp)
        rev = {"has_rev": False}
        if tr:
            try:
                with open(fp, 'rb') as rf:
                    rf.seek(tr["map_offset"])
                    sm = json.loads(zlib.decompress(rf.read(tr["map_len"])).decode('utf-8'))
                rev = {"has_rev": True, "map_bytes": tr["map_len"], "pocket_bytes": tr["pocket_len"], "spd": sm.get("spd", 1.0), "tension": sm.get("tension", 100), "origLen": sm.get("origLen", 0)}
            except Exception: rev = {"has_rev": True}
        response.content_type = 'application/json'
        return json.dumps({"status": "ok", "filename": fn, "full_path": fp, "tags": tags, "rev": rev})
    except Exception as e:
        response.status = 500
        return {"status": "error", "error": str(e)}

@post('/api/save_meta_v71')
def save_track_meta_v71():
    t_in, t_out = None, None
    try:
        req = json.loads(request.body.read().decode('utf-8'))
        fn = req.get('filename', '').strip()
        new_fn = req.get('new_filename', fn).strip() or fn
        tags = req.get('tags', {})
        rev_act = req.get('rev_action', 'keep')
        rev_upd = req.get('rev_updates', {})
        fp = resolve_track_full_path_v71(fn)
        if not fn or not os.path.isfile(fp):
            response.status = 404
            return {"status": "error", "error": "Файл не найден"}
        fdir, ext = os.path.dirname(fp), os.path.splitext(fn)[1]
        if not os.path.splitext(new_fn)[1]: new_fn += ext
        tr = read_jenny_rev_trailer(fp)
        m_zlib, p_mask, sm_obj = b"", b"", None
        if tr:
            with open(fp, 'rb') as rf:
                rf.seek(tr["map_offset"]); m_zlib = rf.read(tr["map_len"])
                if tr["pocket_len"] > 0: rf.seek(tr["pocket_offset"]); p_mask = rf.read(tr["pocket_len"])
            try: sm_obj = json.loads(zlib.decompress(m_zlib).decode('utf-8'))
            except Exception: pass
        t_in = os.path.join(fdir, f"temp_meta_in_{os.getpid()}{ext}")
        t_out = os.path.join(fdir, f"temp_meta_out_{os.getpid()}{ext}")
        with open(fp, 'rb') as sf, open(t_in, 'wb') as df:
            if tr: df.write(sf.read(tr["audio_end"]))
            else: shutil.copyfileobj(sf, df)
        cmd = [find_ffmpeg_binary(), '-y', '-i', t_in, '-c', 'copy', '-map_metadata', '-1']
        for k, v in (tags.items() if isinstance(tags, dict) else []):
            if str(k).strip() and str(v).strip(): cmd.extend(['-metadata', f"{str(k).strip()}={str(v).strip()}"])
        cmd.append(t_out)
        r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if r.returncode != 0 or not os.path.exists(t_out) or os.path.getsize(t_out) < 64:
            shutil.copyfile(t_in, t_out)
        if tr and rev_act != 'strip_all':
            if rev_act in ('modify', 'strip_pocket') and sm_obj is not None:
                for k in ('spd', 'tension'):
                    if k in rev_upd:
                        try: sm_obj[k] = float(rev_upd[k])
                        except Exception: pass
                if 'origLen' in rev_upd:
                    try: sm_obj['origLen'] = int(rev_upd['origLen'])
                    except Exception: pass
                if rev_act == 'strip_pocket': p_mask = b""; sm_obj['pocketFrames'] = 0
                m_zlib = zlib.compress(json.dumps(sm_obj, ensure_ascii=False).encode('utf-8'), level=9)
            ftr = struct.pack(JENNY_REV_FOOTER_FMT, b'JREV', 67, len(m_zlib), len(p_mask), b'JENNYV67')
            with open(t_out, 'ab') as af:
                af.write(m_zlib)
                if p_mask: af.write(p_mask)
                af.write(ftr)
        dst_fp = os.path.join(fdir, new_fn)
        shutil.move(t_out, dst_fp)
        if dst_fp != fp and os.path.exists(fp):
            try: os.remove(fp)
            except Exception: pass
        return {"status": "ok", "old_filename": fn, "new_filename": new_fn}
    except Exception as e:
        response.status = 500
        return {"status": "error", "error": str(e)}
    finally:
        for p in (t_in, t_out):
            if p and os.path.exists(p):
                try: os.remove(p)
                except Exception: pass
# === JENNY V71 BACKEND END ===

@route('/api/full_path/<filename:path>', method='GET')
def get_full_track_path(filename):
    response.content_type = 'application/json'
    full_p = os.path.abspath(resolve_track_full_path_v71(filename))
    return json.dumps({
        "status": "ok",
        "filename": filename,
        "music_dir": os.path.abspath(MUSIC_DIR),
        "full_path": full_p
    })


@route('/api/media/<filename:path>')
def serve_media(filename):
    fp = resolve_track_full_path_v71(filename)
    return static_file(os.path.basename(fp), root=os.path.dirname(fp))


@route('/api/rev_info/<filename:path>', method='GET')
def get_rev_info(filename):
    full_p = resolve_track_full_path_v71(filename)
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
    full_p = resolve_track_full_path_v71(filename)
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
    load_multi_dirs_v71()
    all_tracks, seen, track_meta = [], set(), {}
    allowed_exts = get_allowed_extensions()
    for d in ACTIVE_MUSIC_DIRS:
        if os.path.exists(d):
            try:
                for f in os.listdir(d):
                    if f.lower().endswith(allowed_exts) and not f.startswith(('temp_stretcher_', 'temp_final_')):
                        fp = os.path.join(d, f)
                        if os.path.isfile(fp) and f not in seen:
                            seen.add(f); all_tracks.append(f)
                            track_meta[f] = quick_parse_artist_album_v71(f, fp)
            except Exception: pass
    all_tracks.sort(key=lambda x: track_meta.get(x, {}).get("mtime", 0), reverse=True)
    response.content_type = 'application/json'
    return json.dumps({"all_tracks": all_tracks, "session_tracks": all_tracks, "current_folder": MUSIC_DIR, "active_folders": ACTIVE_MUSIC_DIRS, "saved_folders": SAVED_MUSIC_DIRS, "track_meta": track_meta})


@post('/api/folder')
def change_folder():
    global MUSIC_DIR, ACTIVE_MUSIC_DIRS, SAVED_MUSIC_DIRS
    try:
        load_multi_dirs_v71()
        req = json.loads(request.body.read().decode('utf-8'))
        new_path = norm_dir_v71(req.get('path', ''))
        if not os.path.isdir(new_path):
            response.status = 404
            return {"status": "error", "error": f"Папка не найдена: {new_path}"}
        if new_path not in SAVED_MUSIC_DIRS:
            SAVED_MUSIC_DIRS.insert(0, new_path)
        if new_path not in ACTIVE_MUSIC_DIRS:
            ACTIVE_MUSIC_DIRS.append(new_path)
        MUSIC_DIR = ACTIVE_MUSIC_DIRS[0]
        cleanup_stale_temps(new_path)
        save_multi_dirs_v71()
        return {"status": "ok", "current_folder": new_path, "active_folders": ACTIVE_MUSIC_DIRS}
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
        original_path = resolve_track_full_path_v71(filename)
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
        full_path = resolve_track_full_path_v71(filename)
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
