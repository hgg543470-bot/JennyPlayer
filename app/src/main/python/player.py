import threading
import ctypes
import lzma
import hashlib
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




def _jenny_crypt_stream_v78(data: bytes, password: str = "") -> bytes:
    key_seed = ("JENNY_V78_SECRET::" + (password or "").strip()).encode("utf-8")
    key = hashlib.pbkdf2_hmac("sha512", key_seed, b"JENNYV67_SALT_2026", 10000, dklen=64)
    out = bytearray(len(data))
    blocks = (len(data) + 63) // 64
    stream = bytearray()
    for blk in range(blocks):
        stream.extend(hashlib.sha512(key + struct.pack("<I", blk)).digest())
    for i in range(len(data)):
        out[i] = data[i] ^ stream[i]
    return bytes(out)


JENNY_REV_MAGIC = b'JREV'
JENNY_REV_FOOTER_FMT = '<4sIII8s'
JENNY_REV_FOOTER_SIZE = 24

_XFLAC_LIB_V84 = None

def _get_xflac_lib_v84():
    global _XFLAC_LIB_V84
    if _XFLAC_LIB_V84 is not None:
        return _XFLAC_LIB_V84

    ff_bin = os.environ.get("FFMPEG_BINARY", "")
    ff_dir = os.path.dirname(ff_bin) if ff_bin else ""
    native_dir = os.environ.get("JENNY_NATIVE_DIR", "") or ff_dir
    files_dir = os.environ.get("JENNY_FILES_DIR", "")
    path_dirs = [p.strip() for p in os.environ.get("PATH", "").split(":") if p.strip()]

    candidates = []
    if os.environ.get("XFLAC_LIB_PATH"):
        candidates.append(os.environ["XFLAC_LIB_PATH"])
    if native_dir:
        candidates.append(os.path.join(native_dir, "libxflac.so"))
    for pd in path_dirs:
        candidates.append(os.path.join(pd, "libxflac.so"))
    candidates.extend([
        "libxflac.so",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "jniLibs", "arm64-v8a", "libxflac.so"),
        "/storage/emulated/0/scripts/JennyPlayer/app/src/main/jniLibs/arm64-v8a/libxflac.so",
        "/data/data/com.termux/files/home/JennyPlayer/app/src/main/jniLibs/arm64-v8a/libxflac.so"
    ])

    seen_cands = set()
    for path in candidates:
        if not path or path in seen_cands:
            continue
        seen_cands.add(path)
        try:
            load_target = path
            # Если .so лежит на /storage/emulated/0 (где Android ставит noexec), копируем во внутренний каталог приложения
            if path.startswith("/storage/") and os.path.isfile(path):
                exec_dir = files_dir or (path_dirs[1] if len(path_dirs) > 1 else os.path.dirname(os.path.abspath(__file__)))
                if exec_dir and os.path.isdir(exec_dir):
                    cached_so = os.path.join(exec_dir, "libxflac_exec.so")
                    try:
                        shutil.copy2(path, cached_so)
                        os.chmod(cached_so, 0o755)
                        load_target = cached_so
                    except Exception:
                        pass
            lib = ctypes.CDLL(load_target)
            lib.xflac_encode_wav_mem.argtypes = [
                ctypes.c_char_p, ctypes.c_size_t,
                ctypes.POINTER(ctypes.POINTER(ctypes.c_uint8)), ctypes.POINTER(ctypes.c_size_t),
                ctypes.c_int, ctypes.c_void_p
            ]
            lib.xflac_encode_wav_mem.restype = ctypes.c_int
            lib.xflac_decode_wav_mem.argtypes = [
                ctypes.c_char_p, ctypes.c_size_t,
                ctypes.POINTER(ctypes.POINTER(ctypes.c_uint8)), ctypes.POINTER(ctypes.c_size_t)
            ]
            lib.xflac_decode_wav_mem.restype = ctypes.c_int
            lib.xflac_free.argtypes = [ctypes.c_void_p]
            lib.xflac_free.restype = None
            _XFLAC_LIB_V84 = lib
            break
        except Exception:
            continue
    return _XFLAC_LIB_V84


def _strip_jrev_trailer_from_bytes_v88(xfc_bytes: bytes) -> bytes:
    if len(xfc_bytes) > JENNY_REV_FOOTER_SIZE + 25:
        try:
            footer = xfc_bytes[-JENNY_REV_FOOTER_SIZE:]
            head_magic, ver, m_len, p_len, tail_magic = struct.unpack(JENNY_REV_FOOTER_FMT, footer)
            if head_magic == b'JREV' and tail_magic == b'JENNYV67':
                cut_pos = len(xfc_bytes) - JENNY_REV_FOOTER_SIZE - int(m_len) - int(p_len)
                if cut_pos > 25:
                    return xfc_bytes[:cut_pos]
        except Exception:
            pass
    rev_off = xfc_bytes.rfind(b'JREV')
    if rev_off > 0 and len(xfc_bytes) - rev_off >= JENNY_REV_FOOTER_SIZE and len(xfc_bytes) - rev_off <= 64:
        try:
            head_magic, ver, m_len, p_len, tail_magic = struct.unpack(
                JENNY_REV_FOOTER_FMT, xfc_bytes[rev_off:rev_off + JENNY_REV_FOOTER_SIZE]
            )
            if head_magic == b'JREV' and tail_magic == b'JENNYV67':
                cut_pos = rev_off - int(m_len) - int(p_len)
                if cut_pos > 25:
                    return xfc_bytes[:cut_pos]
        except Exception:
            pass
    return xfc_bytes


def _encode_wav_to_xflac_bytes_v85(wav_bytes: bytes, mode: int) -> bytes:
    lib = _get_xflac_lib_v84()
    if not lib:
        raise RuntimeError("libxflac.so не загружена (проверьте сборку NDK arm64-v8a)")
    out_ptr = ctypes.POINTER(ctypes.c_uint8)()
    out_sz = ctypes.c_size_t(0)
    rc = lib.xflac_encode_wav_mem(wav_bytes, len(wav_bytes), ctypes.byref(out_ptr), ctypes.byref(out_sz), int(mode), None)
    if rc != 0 or not out_ptr or out_sz.value < 25:
        raise RuntimeError(f"xflac encode error {rc}")
    try:
        raw_xfc = ctypes.string_at(out_ptr, out_sz.value)
    finally:
        lib.xflac_free(ctypes.cast(out_ptr, ctypes.c_void_p))
    flags, nf, rm_sz, cm_sz, rl_sz, rr_sz = struct.unpack("<BIIIII", raw_xfc[4:25])
    raw_meta = raw_xfc[25:25 + rm_sz]
    rem_tail = raw_xfc[25 + cm_sz:]
    comp_meta = lzma.compress(raw_meta, format=lzma.FORMAT_XZ, preset=6)
    return b"XFC3" + struct.pack("<BIIIII", flags | 2, nf, rm_sz, len(comp_meta), rl_sz, rr_sz) + comp_meta + rem_tail


def _decode_xflac_bytes_to_wav_v85(xfc_bytes: bytes) -> bytes:
    lib = _get_xflac_lib_v84()
    if not lib:
        raise RuntimeError("libxflac.so не загружена (проверьте сборку NDK arm64-v8a)")
    xfc_bytes = _strip_jrev_trailer_from_bytes_v88(xfc_bytes)
    if len(xfc_bytes) < 25 or xfc_bytes[:4] != b"XFC3":
        raise RuntimeError("Файл не является корректным контейнером XFC3 (.xflac)")
    flags, nf, rm_sz, cm_sz, rl_sz, rr_sz = struct.unpack("<BIIIII", xfc_bytes[4:25])
    if flags & 2:
        comp_meta = xfc_bytes[25:25 + cm_sz]
        rem_tail = xfc_bytes[25 + cm_sz:25 + cm_sz + rl_sz + rr_sz]
        raw_meta = lzma.decompress(comp_meta)
        xfc_bytes = b"XFC3" + struct.pack("<BIIIII", flags & ~2, nf, len(raw_meta), len(raw_meta), rl_sz, rr_sz) + raw_meta + rem_tail
    out_ptr = ctypes.POINTER(ctypes.c_uint8)()
    out_sz = ctypes.c_size_t(0)
    rc = lib.xflac_decode_wav_mem(xfc_bytes, len(xfc_bytes), ctypes.byref(out_ptr), ctypes.byref(out_sz))
    if rc != 0 or not out_ptr or out_sz.value == 0:
        raise RuntimeError(f"xflac decode error {rc}")
    try:
        return ctypes.string_at(out_ptr, out_sz.value)
    finally:
        lib.xflac_free(ctypes.cast(out_ptr, ctypes.c_void_p))


_XFLAC_CACHE_LOCK_V87 = threading.Lock()

def _get_xflac_fast_header_info_v87(full_p: str):
    try:
        with open(full_p, 'rb') as f:
            hdr = f.read(25)
            if len(hdr) >= 25 and hdr[:4] == b'XFC3':
                flags, nf, rm_sz, cm_sz, rl_sz, rr_sz = struct.unpack('<BIIIII', hdr[4:25])
                sr = 44100
                try:
                    comp_chunk = f.read(min(int(cm_sz), 16384))
                    if flags & 2:
                        decomp = lzma.LZMADecompressor()
                        raw_hdr = decomp.decompress(comp_chunk, max_length=64)
                    else:
                        raw_hdr = comp_chunk[:64]
                    if len(raw_hdr) >= 44 and raw_hdr[16:20] == b'RIFF':
                        cand_sr = struct.unpack('<I', raw_hdr[40:44])[0]
                        if 8000 <= cand_sr <= 192000:
                            sr = int(cand_sr)
                except Exception:
                    pass
                ch = 1 if (flags & 4) else 2
                wav_sz = int(nf) * ch * 2 + 44
                dur_s = float(nf) / float(sr) if sr > 0 else 0.0
                return dur_s, wav_sz
    except Exception:
        pass
    return 0.0, 0


def _ensure_xflac_wav_cache_v87(full_xf: str) -> str:
    cache_dir = os.path.dirname(full_xf)
    cache_path = os.path.join(cache_dir, "temp_final_xflac_stream_cache.wav")
    meta_tag_path = os.path.join(cache_dir, "temp_final_xflac_stream_cache.tag")
    st = os.stat(full_xf)
    cur_sig = f"{full_xf}|{st.st_size}|{int(st.st_mtime)}"
    with _XFLAC_CACHE_LOCK_V87:
        if os.path.isfile(cache_path) and os.path.isfile(meta_tag_path) and os.path.getsize(cache_path) > 44:
            try:
                with open(meta_tag_path, 'r', encoding='utf-8') as tf:
                    if tf.read().strip() == cur_sig:
                        return cache_path
            except Exception:
                pass
        with open(full_xf, 'rb') as f_in:
            raw_data = f_in.read()
        wav_bytes = _decode_xflac_bytes_to_wav_v85(raw_data)
        with open(cache_path, 'wb') as f_out:
            f_out.write(wav_bytes)
        with open(meta_tag_path, 'w', encoding='utf-8') as tf:
            tf.write(cur_sig)
        return cache_path

def _pack_xflac_pocket_v84(wav_bytes: bytes, mode: int, password: str = "") -> bytes:
    lib = _get_xflac_lib_v84()
    if not lib:
        raise RuntimeError("libxflac.so not available")
    out_ptr = ctypes.POINTER(ctypes.c_uint8)()
    out_sz = ctypes.c_size_t(0)
    rc = lib.xflac_encode_wav_mem(wav_bytes, len(wav_bytes), ctypes.byref(out_ptr), ctypes.byref(out_sz), int(mode), None)
    if rc != 0 or not out_ptr or out_sz.value == 0:
        raise RuntimeError(f"xflac_encode_wav_mem failed: {rc}")
    try:
        xfc_raw = ctypes.string_at(out_ptr, out_sz.value)
    finally:
        lib.xflac_free(ctypes.cast(out_ptr, ctypes.c_void_p))
    comp = lzma.compress(xfc_raw, format=lzma.FORMAT_XZ, preset=9 | lzma.PRESET_EXTREME)
    enc = _jenny_crypt_stream_v78(comp, password)
    return b"JXF8" + enc

def _unpack_xflac_pocket_v84(masked_body: bytes, password: str = "") -> bytes:
    lib = _get_xflac_lib_v84()
    if not lib:
        raise RuntimeError("libxflac.so not available")
    try:
        dec = _jenny_crypt_stream_v78(masked_body, password)
        xfc_raw = lzma.decompress(dec)
    except Exception:
        dec256 = _jenny_crypt_stream_sha256_compat(masked_body, password)
        xfc_raw = lzma.decompress(dec256)
    out_ptr = ctypes.POINTER(ctypes.c_uint8)()
    out_sz = ctypes.c_size_t(0)
    rc = lib.xflac_decode_wav_mem(xfc_raw, len(xfc_raw), ctypes.byref(out_ptr), ctypes.byref(out_sz))
    if rc != 0 or not out_ptr or out_sz.value == 0:
        raise RuntimeError(f"xflac_decode_wav_mem failed: {rc}")
    try:
        return ctypes.string_at(out_ptr, out_sz.value)
    finally:
        lib.xflac_free(ctypes.cast(out_ptr, ctypes.c_void_p))

def _pack_heavy_pocket_v78(raw_opus: bytes, password: str = "") -> bytes:
    comp = lzma.compress(raw_opus, format=lzma.FORMAT_XZ, preset=9 | lzma.PRESET_EXTREME)
    enc = _jenny_crypt_stream_v78(comp, password)
    return b"JLZ8" + enc

def _jenny_crypt_stream_sha256_compat(data: bytes, password: str = "") -> bytes:
    key_seed = ("JENNY_V78_SECRET::" + (password or "").strip()).encode("utf-8")
    key = hashlib.pbkdf2_hmac("sha256", key_seed, b"JENNYV67_SALT_2026", 10000, dklen=32)
    out = bytearray(len(data))
    blocks = (len(data) + 31) // 32
    stream = bytearray()
    for blk in range(blocks):
        stream.extend(hashlib.sha256(key + struct.pack("<I", blk)).digest())
    for i in range(len(data)):
        out[i] = data[i] ^ stream[i]
    return bytes(out)

def _unpack_heavy_pocket_v78(masked: bytes, password: str = "") -> bytes:
    if masked.startswith(b"JXF8"):
        return _unpack_xflac_pocket_v84(masked[4:], password)
    if masked.startswith(b"JLZ8"):
        try:
            dec = _jenny_crypt_stream_v78(masked[4:], password)
            return lzma.decompress(dec)
        except Exception:
            dec256 = _jenny_crypt_stream_sha256_compat(masked[4:], password)
            return lzma.decompress(dec256)
    try:
        return zlib.decompress(bytes(b ^ 0xA5 for b in masked))
    except Exception:
        return bytes(b ^ 0xA5 for b in masked)

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





# === JENNY V74 CUSTOM TAGS ENGINE START ===
CUSTOM_TAGS_FILE = os.path.join(DEFAULT_MUSIC_DIR, "jenny_custom_tags.json")
STANDARD_TAG_KEYS_V74 = {'TITLE', 'ARTIST', 'ALBUM', 'GENRE', 'DATE', 'COMMENT', 'ENCODER'}

def load_custom_tags_db_v74():
    if os.path.exists(CUSTOM_TAGS_FILE):
        try:
            with open(CUSTOM_TAGS_FILE, 'r', encoding='utf-8') as f:
                d = json.load(f)
                if isinstance(d, dict):
                    return d
        except Exception:
            pass
    return {}

def save_custom_tags_db_v74(db):
    try:
        os.makedirs(os.path.dirname(CUSTOM_TAGS_FILE), exist_ok=True)
        with open(CUSTOM_TAGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(db, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def parse_all_ffmpeg_tags_v74(raw_info):
    tags = {}
    in_m = False
    for line in raw_info.splitlines():
        if re.match(r"^\s*Metadata:\s*$", line):
            in_m = True
            continue
        if in_m:
            if re.match(r"^\s*(Duration:|Stream #|Chapter #|Output #|Input #)", line):
                in_m = False
                continue
            m = re.match(r"^\s*([^:=\s][^:=]{0,48}?)\s*:\s*(.+)$", line)
            if m:
                k = m.group(1).strip().upper()
                v = m.group(2).strip()
                if k not in ('DURATION', 'BPS', 'NUMBER_OF_FRAMES', 'NUMBER_OF_BYTES') and not k.startswith('_STATISTICS'):
                    tags[k] = v
    return tags

def get_merged_track_tags_v74(filename, raw_info=None):
    tags = {}
    if raw_info:
        tags.update(parse_all_ffmpeg_tags_v74(raw_info))
    db = load_custom_tags_db_v74()
    if filename in db and isinstance(db[filename], dict):
        # Если пользователь сохранял свои теги для этого трека — они имеют высший приоритет
        saved_dict = db[filename]
        enc_backup = tags.get('ENCODER')
        tags = {str(k).strip().upper(): str(v).strip() for k, v in saved_dict.items() if str(k).strip() and str(v).strip()}
        if enc_backup and 'ENCODER' not in tags:
            tags['ENCODER'] = enc_backup
    return tags
# === JENNY V74 CUSTOM TAGS ENGINE END ===
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
    except Exception:
        pass
    db_tags = load_custom_tags_db_v74().get(filename, {})
    cached = TRACK_META_CACHE_V71.get(full_p)
    if cached and cached.get("mtime") == round(st_mtime, 2) and cached.get("size") == st_size and cached.get("user_tags") == db_tags:
        return cached
    stem = os.path.splitext(filename)[0]
    clean_stem = re.sub(r'(?:_x\d+(?:[.,]\d+)?(?:_[a-z0-9]+)*|_(?:slow|fast)(?:_[a-z0-9]+)*|_(?:jbuf90|jbuf_shift|jbuf|web_lock|web_shift|webapi|vinyl|neutral|pitchlock|bitperfect|psycho|ultra|hifi|restored)|_rev(?:ersed)?)+$', '', stem, flags=re.I)
    artist = "Разные артисты"
    album = os.path.basename(os.path.dirname(full_p)) or "Music"
    parts = re.split(r'\s+[-–—]\s+', clean_stem)
    if len(parts) >= 2 and parts[0].strip():
        artist = parts[0].strip()
        if len(parts) >= 3 and parts[1].strip():
            album = parts[1].strip()
    if isinstance(db_tags, dict):
        if db_tags.get("ARTIST"):
            artist = str(db_tags["ARTIST"]).strip()
        if db_tags.get("ALBUM"):
            album = str(db_tags["ALBUM"]).strip()
    custom_only = {}
    if isinstance(db_tags, dict):
        for tk, tv in db_tags.items():
            tku = str(tk).strip().upper()
            if tku not in STANDARD_TAG_KEYS_V74 and str(tv).strip():
                custom_only[str(tk).strip()] = str(tv).strip()
    ext = os.path.splitext(filename)[1].lower()
    kbps = 128.0 if ext in ('.opus', '.ogg', '.m4a', '.aac') else (320.0 if ext == '.mp3' else 900.0)
    est_dur = round(max(1.0, (st_size * 8.0) / (kbps * 1000.0)), 1)
    if ext == '.xflac':
        xf_dur, _ = _get_xflac_fast_header_info_v87(full_p)
        if xf_dur > 0:
            est_dur = round(xf_dur, 1)
    meta = {
        "mtime": round(st_mtime, 2),
        "size": st_size,
        "dur": est_dur,
        "artist": artist,
        "album": album,
        "user_tags": db_tags if isinstance(db_tags, dict) else {},
        "custom_tags": custom_only
    }
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
        tags = get_merged_track_tags_v74(fn, raw)
        tags.pop('ENCODER', None)
        tr = read_jenny_rev_trailer(fp)
        rev = {"has_rev": False}
        if tr:
            try:
                with open(fp, 'rb') as rf:
                    rf.seek(tr["map_offset"])
                    sm = json.loads(zlib.decompress(rf.read(tr["map_len"])).decode('utf-8'))
                rev = {"has_rev": True, "map_bytes": tr["map_len"], "pocket_bytes": tr["pocket_len"], "spd": sm.get("spd", 1.0), "tension": sm.get("tension", 100), "origLen": sm.get("origLen", 0)}
            except Exception:
                rev = {"has_rev": True}
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
        if not os.path.splitext(new_fn)[1]:
            new_fn += ext

        # 1. Сохраняем все теги (включая русские и кастомные, например "член: профсоюза") в базу jenny_custom_tags.json
        clean_tags = {}
        if isinstance(tags, dict):
            for k, v in tags.items():
                ks, vs = str(k).strip().upper(), str(v).strip()
                if ks and vs:
                    clean_tags[ks] = vs
        db = load_custom_tags_db_v74()
        if fn in db and fn != new_fn:
            db.pop(fn, None)
        db[new_fn] = clean_tags
        save_custom_tags_db_v74(db)

        # 2. Записываем метаданные и в сам аудиофайл (и в контейнер, и в аудиопоток -metadata:s:a:0)
        tr = read_jenny_rev_trailer(fp)
        m_zlib, p_mask, sm_obj = b"", b"", None
        if tr:
            with open(fp, 'rb') as rf:
                rf.seek(tr["map_offset"]); m_zlib = rf.read(tr["map_len"])
                if tr["pocket_len"] > 0:
                    rf.seek(tr["pocket_offset"]); p_mask = rf.read(tr["pocket_len"])
            try:
                sm_obj = json.loads(zlib.decompress(m_zlib).decode('utf-8'))
            except Exception:
                pass
        t_in = os.path.join(fdir, f"temp_meta_in_{os.getpid()}{ext}")
        t_out = os.path.join(fdir, f"temp_meta_out_{os.getpid()}{ext}")
        with open(fp, 'rb') as sf, open(t_in, 'wb') as df:
            if tr:
                df.write(sf.read(tr["audio_end"]))
            else:
                shutil.copyfileobj(sf, df)
        if ext.lower() == '.xflac':
            shutil.copyfile(t_in, t_out)
        else:
            cmd = [find_ffmpeg_binary(), '-y', '-i', t_in, '-c', 'copy', '-map_metadata', '-1', '-map_metadata:s:a', '-1']
            for k, v in clean_tags.items():
                if re.match(r'^[A-Za-z0-9_\-]+$', k):
                    cmd.extend(['-metadata', f"{k}={v}", '-metadata:s:a:0', f"{k}={v}"])
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
                if rev_act == 'strip_pocket':
                    p_mask = b""; sm_obj['pocketFrames'] = 0
                m_zlib = zlib.compress(json.dumps(sm_obj, ensure_ascii=False).encode('utf-8'), level=9)
            ftr = struct.pack(JENNY_REV_FOOTER_FMT, b'JREV', 67, len(m_zlib), len(p_mask), b'JENNYV67')
            with open(t_out, 'ab') as af:
                af.write(m_zlib)
                if p_mask:
                    af.write(p_mask)
                af.write(ftr)
        dst_fp = os.path.join(fdir, new_fn)
        shutil.move(t_out, dst_fp)
        if dst_fp != fp and os.path.exists(fp):
            try: os.remove(fp)
            except Exception: pass
        TRACK_META_CACHE_V71.pop(fp, None)
        TRACK_META_CACHE_V71.pop(dst_fp, None)
        return {"status": "ok", "old_filename": fn, "new_filename": new_fn, "tags": clean_tags}
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


def calc_jrev_audio_stats(full_path, trailer):
    try:
        audio_end = int(trailer["audio_end"])
        granule = 0
        if audio_end > 28:
            read_len = min(65536, audio_end)
            with open(full_path, "rb") as f:
                if f.read(4) == b"OggS":
                    f.seek(audio_end - read_len)
                    tail = f.read(read_len)
                    idx = tail.rfind(b"OggS\x00")
                    if idx >= 0 and idx + 14 <= len(tail):
                        granule = max(0, struct.unpack_from("<q", tail, idx + 6)[0])
        smap = {}
        try:
            with open(full_path, "rb") as rf:
                rf.seek(trailer["map_offset"])
                smap = json.loads(zlib.decompress(rf.read(trailer["map_len"])).decode("utf-8"))
        except Exception:
            pass
        sr = int(smap.get("sr") or 48000)
        samples = granule if granule > 0 else int(smap.get("outLen") or 0)
        if samples > 0 and sr > 0:
            dur_sec = samples / float(sr)
            hrs = int(dur_sec // 3600)
            mins = int((dur_sec % 3600) // 60)
            secs = dur_sec % 60
            dur_str = f"{hrs:02d}:{mins:02d}:{secs:05.2f}"
            br_str = f"{int(round((audio_end * 8.0) / (dur_sec * 1000.0)))} kb/s"
            smp_str = f"{samples:,}".replace(",", " ")
            return dur_sec, dur_str, br_str, smp_str
    except Exception:
        pass
    return 0.0, "—", "—", "—"


@route('/api/pcm_meta_v71/<filename:path>')
def get_pcm_meta_v71(filename):
    import re
    fp = resolve_track_full_path_v71(filename)
    response.content_type = 'application/json'
    if not fp or not os.path.isfile(fp):
        return json.dumps({"duration": 0, "size": 0})
    if filename.lower().endswith('.xflac'):
        xf_dur, xf_wav_sz = _get_xflac_fast_header_info_v87(fp)
        return json.dumps({"duration": xf_dur, "size": xf_wav_sz})
    tr = read_jenny_rev_trailer(fp)
    if tr:
        dur_sec, _, _, _ = calc_jrev_audio_stats(fp, tr)
        if dur_sec > 0:
            return json.dumps({"duration": dur_sec, "size": tr["audio_end"]})
    dur_sec = 0.0
    try:
        ff_bin = find_ffmpeg_binary()
        pr = subprocess.run([ff_bin, '-hide_banner', '-i', fp], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=6)
        raw = (pr.stderr or "") + (pr.stdout or "")
        m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", raw)
        if m:
            dur_sec = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    except Exception:
        pass
    return json.dumps({"duration": dur_sec, "size": os.path.getsize(fp)})


@route('/api/pcm_chunk_v71/<filename:path>')
def get_pcm_chunk_v71(filename):
    fp = resolve_track_full_path_v71(filename)
    if not fp or not os.path.isfile(fp):
        response.status = 404
        return "Not found"
    try:
        st_sec = max(0.0, float(request.query.get('start', 0.0)))
        dur_sec = max(0.1, min(120.0, float(request.query.get('dur', 30.0))))
        sr = int(request.query.get('sr', 44100))
        if sr < 8000 or sr > 96000:
            sr = 44100

        src_path = _ensure_xflac_wav_cache_v87(fp) if filename.lower().endswith('.xflac') else fp
        ffmpeg_bin = find_ffmpeg_binary()
        cmd = [
            ffmpeg_bin, '-v', 'error',
            '-ss', f"{st_sec:.3f}",
            '-t', f"{dur_sec:.3f}",
            '-i', src_path,
            '-vn', '-ac', '2', '-ar', str(sr),
            '-f', 'f32le', '-acodec', 'pcm_f32le', '-'
        ]
        pr = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=25)
        raw_interleaved = pr.stdout or b""
        n_floats = len(raw_interleaved) // 4
        frames = n_floats // 2
        if frames <= 0:
            response.content_type = 'application/octet-stream'
            return b""
        import array
        arr = array.array('f')
        arr.frombytes(raw_interleaved[:frames * 8])
        left = arr[0::2]
        right = arr[1::2]
        out_bytes = left.tobytes() + right.tobytes()
        response.content_type = 'application/octet-stream'
        response.set_header('Content-Length', str(len(out_bytes)))
        return out_bytes
    except Exception as e:
        response.status = 500
        return str(e)


@route('/api/media/<filename:path>', method=['GET', 'HEAD'])
def serve_media(filename):
    if filename.lower().endswith('.xflac'):
        full_xf = resolve_track_full_path_v71(filename)
        if not os.path.isfile(full_xf):
            response.status = 404
            return "File not found"
        try:
            cache_path = _ensure_xflac_wav_cache_v87(full_xf)
            return static_file(os.path.basename(cache_path), root=os.path.dirname(cache_path), mimetype='audio/wav')
        except Exception as e:
            response.status = 500
            return str(e)
    fp = resolve_track_full_path_v71(filename)
    if not fp or not os.path.isfile(fp):
        response.status = 404
        return "Not found"
    tr = read_jenny_rev_trailer(fp)
    if not tr or not tr.get("audio_end"):
        return static_file(os.path.basename(fp), root=os.path.dirname(fp))

    audio_end = int(tr["audio_end"])
    ext = os.path.splitext(fp)[1].lower()
    mime = "audio/ogg" if ext in (".opus", ".ogg") else "application/octet-stream"
    headers = {
        "Content-Type": mime,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
    range_hdr = request.headers.get("Range")
    if range_hdr and range_hdr.startswith("bytes="):
        try:
            r_part = range_hdr.split("=", 1)[1].split(",")[0].strip()
            s_str, e_str = r_part.split("-", 1)
            start_b = int(s_str) if s_str else 0
            end_b = int(e_str) if e_str else (audio_end - 1)
            if end_b >= audio_end:
                end_b = audio_end - 1
            if start_b < 0 or start_b >= audio_end or start_b > end_b:
                headers["Content-Range"] = f"bytes */{audio_end}"
                return bottle.HTTPResponse(status=416, headers=headers)
            chunk_len = end_b - start_b + 1
            headers["Content-Range"] = f"bytes {start_b}-{end_b}/{audio_end}"
            headers["Content-Length"] = str(chunk_len)
            if request.method == "HEAD":
                return bottle.HTTPResponse(status=206, headers=headers)
            with open(fp, "rb") as f:
                f.seek(start_b)
                data = f.read(chunk_len)
            return bottle.HTTPResponse(body=data, status=206, headers=headers)
        except Exception:
            pass

    headers["Content-Length"] = str(audio_end)
    if request.method == "HEAD":
        return bottle.HTTPResponse(status=200, headers=headers)
    with open(fp, "rb") as f:
        data = f.read(audio_end)
    return bottle.HTTPResponse(body=data, status=200, headers=headers)


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
    pwd = request.query.get('key', '').strip()
    try:
        unmasked = _unpack_heavy_pocket_v78(masked, pwd)
    except Exception:
        response.status = 403
        return " Неверный ключ расшифровки капсулы" 
    response.content_type = 'audio/wav' if unmasked[:4] == b'RIFF' else 'audio/ogg'
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
    {"en": True, "ext": "aac"},
    {"en": True, "ext": "xflac"}
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
    return ('.mp3', '.opus', '.m4a', '.flac', '.wav', '.xflac', '.ogg', '.mp4', '.aac', '.webm', '.3gp', '.mkv')


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
                for k in ("customMusicDir", "savedFolders", "activeFolders"):
                    if k in old_data and k not in data:
                        data[k] = old_data[k]
            except Exception:
                pass
        if ACTIVE_MUSIC_DIRS:
            data["activeFolders"] = ACTIVE_MUSIC_DIRS
            data["customMusicDir"] = ACTIVE_MUSIC_DIRS[0]
        if SAVED_MUSIC_DIRS:
            data["savedFolders"] = SAVED_MUSIC_DIRS
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
        if original_path.lower().endswith('.xflac'):
            original_path = _ensure_xflac_wav_cache_v87(original_path)
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

        raw_base_name, _ = os.path.splitext(original_name)
        base_name = re.sub(
            r'(?:_x\d+(?:[.,]\d+)?(?:_[a-z0-9]+)*|_(?:slow|fast)(?:_[a-z0-9]+)*|_(?:jbuf90|jbuf_shift|jbuf|web_lock|web_shift|webapi|vinyl|neutral|pitchlock|bitperfect|psycho|ultra|hifi|restored)|_rev(?:ersed)?)+$',
            '', raw_base_name, flags=re.I
        ) or raw_base_name
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

        raw_mode_br = request.forms.get('pocket_bitrate', 'orig').strip().lower()
        sr_mode = request.forms.get('sample_rate_mode', 'orig').strip().lower()
        direct_clean = (request.forms.get('direct_clean_source', 'false') == 'true')
        orig_path = resolve_track_full_path_v71(original_name)

        xflac_modes_map = {
            'xflac_lossless': (0, '_bitperfect.xflac'),
            'xflac_psycho':   (25, '_psycho.xflac'),
            'xflac_ultra':    (15, '_ultra.xflac'),
            'xflac_hifi':     (45, '_hifi.xflac')
        }
        use_xflac_mode = xflac_modes_map[raw_mode_br][0] if raw_mode_br in xflac_modes_map else -1
        is_wav_unpack = (raw_mode_br == 'wav_pcm')

        if use_xflac_mode >= 0:
            ext_tag = xflac_modes_map[raw_mode_br][1]
            new_filename = f"{base_name}{speed_suffix}{rev_suffix}{ext_tag}"
        elif is_wav_unpack:
            new_filename = f"{base_name}{speed_suffix}{rev_suffix}_restored.wav"
        else:
            new_filename = f"{base_name}{speed_suffix}{rev_suffix}{slow_fast}{pitch_suffix}.opus"

        temp_wav = os.path.join(MUSIC_DIR, f"temp_final_{os.getpid()}.wav")
        final_opus = os.path.join(MUSIC_DIR, new_filename)
        ffmpeg_bin = find_ffmpeg_binary()

        # Если 0 эффектов DSP, скорость 1.0x и без реверса — берем 100% чистый исходник прямо с диска (сохраняя родные 44100 Hz!)
        if direct_clean and os.path.isfile(orig_path):
            if orig_path.lower().endswith('.xflac'):
                with open(orig_path, 'rb') as xf:
                    dec_wav = _decode_xflac_bytes_to_wav_v85(xf.read())
                with open(temp_wav, 'wb') as wf:
                    wf.write(dec_wav)
                if sr_mode in ('44100', '48000'):
                    temp_sr_wav = temp_wav + ".sr.wav"
                    r_sr = subprocess.run([ffmpeg_bin, '-y', '-i', temp_wav, '-ar', sr_mode, '-ac', '2', '-c:a', 'pcm_s16le', temp_sr_wav], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    if r_sr.returncode == 0 and os.path.exists(temp_sr_wav):
                        os.replace(temp_sr_wav, temp_wav)
            else:
                ar_args = ['-ar', sr_mode] if sr_mode in ('44100', '48000') else []
                subprocess.run([ffmpeg_bin, '-y', '-i', orig_path] + ar_args + ['-ac', '2', '-c:a', 'pcm_s16le', temp_wav], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        else:
            with open(temp_wav, 'wb') as out_f:
                shutil.copyfileobj(upload.file, out_f)
            if sr_mode in ('44100', '48000'):
                temp_sr_wav = temp_wav + ".sr.wav"
                r_sr = subprocess.run([ffmpeg_bin, '-y', '-i', temp_wav, '-ar', sr_mode, '-ac', '2', '-c:a', 'pcm_s16le', temp_sr_wav], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                if r_sr.returncode == 0 and os.path.exists(temp_sr_wav):
                    os.replace(temp_sr_wav, temp_wav)

        target_br = 'orig' if (use_xflac_mode >= 0 or is_wav_unpack) else raw_mode_br
        orig_kbps_num = 160
        try:
            if os.path.exists(orig_path) and os.path.getsize(orig_path) > 1024:
                # Определяем точный битрейт исходного файла через ffprobe или размер/длительность
                ffprobe_bin = ffmpeg_bin.replace('ffmpeg', 'ffprobe')
                pr_b = subprocess.run([ffprobe_bin, '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'format=bit_rate,duration', '-of', 'default=noprint_wrappers=1', orig_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=4)
                br_val, dur_val = 0, 0.0
                for line in (pr_b.stdout or '').splitlines():
                    if line.startswith('bit_rate=') and line.split('=')[1].isdigit():
                        br_val = int(line.split('=')[1]) // 1000
                    elif line.startswith('duration='):
                        try: dur_val = float(line.split('=')[1])
                        except Exception: pass
                if br_val <= 0 and dur_val > 0.5:
                    br_val = int((os.path.getsize(orig_path) * 8) / (dur_val * 1000))
                if br_val > 0:
                    orig_kbps_num = max(32, min(510, br_val))
        except Exception:
            pass

        if target_br == 'orig':
            kbps_num = orig_kbps_num
        elif target_br.endswith('k') and target_br[:-1].isdigit():
            kbps_num = max(12, min(510, int(target_br[:-1])))
        else:
            kbps_num = 128

        target_br = f"{kbps_num}k"
        frame_dur = '60' if kbps_num <= 64 else '20'

        if is_wav_unpack:
            shutil.copyfile(temp_wav, final_opus)
            encoded_ok = (os.path.exists(final_opus) and os.path.getsize(final_opus) > 44)
        elif use_xflac_mode >= 0:
            with open(temp_wav, 'rb') as wf:
                wav_in_bytes = wf.read()
            xfc_out_bytes = _encode_wav_to_xflac_bytes_v85(wav_in_bytes, use_xflac_mode)
            with open(final_opus, 'wb') as xof:
                xof.write(xfc_out_bytes)
            encoded_ok = (os.path.exists(final_opus) and os.path.getsize(final_opus) > 25)
        else:
            cmd1 = [ffmpeg_bin, '-y', '-i', temp_wav, '-c:a', 'libopus', '-b:a', target_br, '-vbr', 'on', '-compression_level', '10', '-frame_duration', frame_dur, final_opus]
            r1 = subprocess.run(cmd1, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            encoded_ok = (r1.returncode == 0 and os.path.exists(final_opus) and os.path.getsize(final_opus) > 100)
        if not encoded_ok and use_xflac_mode < 0 and not is_wav_unpack:
            cmd2 = [ffmpeg_bin, '-y', '-i', temp_wav, '-c:a', 'opus', '-strict', '-2', '-b:a', target_br, final_opus]
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
                            pck_kbps = target_br
                            pck_pwd = request.forms.get('pocket_key', '').strip()
                            if use_xflac_mode >= 0:
                                try:
                                    with open(temp_pck_wav, 'rb') as wf:
                                        wav_raw = wf.read()
                                    pocket_masked = _pack_xflac_pocket_v84(wav_raw, use_xflac_mode, pck_pwd)
                                except Exception:
                                    pocket_masked = b''
                            if not pocket_masked:
                                pr = subprocess.run([ffmpeg_bin, '-y', '-i', temp_pck_wav, '-c:a', 'libopus', '-b:a', pck_kbps, '-vbr', 'on', '-compression_level', '10', '-frame_duration', frame_dur, '-application', 'audio', temp_pck_opus], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                                if pr.returncode != 0 or not os.path.exists(temp_pck_opus):
                                    subprocess.run([ffmpeg_bin, '-y', '-i', temp_pck_wav, '-c:a', 'opus', '-strict', '-2', '-b:a', pck_kbps, temp_pck_opus], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                                if os.path.exists(temp_pck_opus) and os.path.getsize(temp_pck_opus) > 32:
                                    with open(temp_pck_opus, 'rb') as pof:
                                        raw_pck = pof.read()
                                    pocket_masked = _pack_heavy_pocket_v78(raw_pck, pck_pwd)
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
        xflac_custom_meta = None
        if size_bytes > 25:
            try:
                with open(full_path, 'rb') as xff:
                    xhdr = xff.read(25)
                    if xhdr[:4] == b'XFC3':
                        x_flags, x_nf, x_rm_sz, x_cm_sz, x_rl_sz, x_rr_sz = struct.unpack('<BIIIII', xhdr[4:25])
                        x_sr = 44100
                        try:
                            comp_chunk = xff.read(min(x_cm_sz, 65536))
                            raw_hdr = lzma.decompress(comp_chunk) if (x_flags & 2) else comp_chunk
                            if len(raw_hdr) >= 44 and raw_hdr[16:20] == b'RIFF':
                                x_sr = struct.unpack('<I', raw_hdr[40:44])[0]
                        except Exception:
                            pass
                        if x_sr < 8000 or x_sr > 192000:
                            x_sr = 44100
                        tr_xf = read_jenny_rev_trailer(full_path)
                        xf_audio_bytes = int(tr_xf["audio_end"]) if (tr_xf and tr_xf.get("audio_end")) else size_bytes
                        wav_orig_bytes = int(x_nf) * 4 + 44
                        dur_s = float(x_nf) / float(x_sr) if x_sr > 0 else 0.0
                        ratio_pct = (xf_audio_bytes * 100.0) / max(1, wav_orig_bytes)
                        eff_kbps = int((xf_audio_bytes * 8) / max(0.1, dur_s * 1000))
                        mm, ss = int(dur_s // 60), dur_s % 60
                        hh, mm = int(mm // 60), int(mm % 60)
                        xflac_custom_meta = {
                            "container": f"XFLAC (XFC3 + LZMA2) [{ratio_pct:.1f}% от WAV {wav_orig_bytes/(1024*1024):.2f} MB]",
                            "codec": "libxflac C++17 (21-tap Pitch-OLS + Psycho-LSB)",
                            "sr": f"{x_sr} Hz",
                            "ch": "stereo (2 ch)",
                            "fmt": "s16p (Direct Time-Domain Wave)",
                            "dur_str": f"{hh:02d}:{mm:02d}:{ss:05.2f}",
                            "dur_s": dur_s,
                            "br": f"{eff_kbps} kb/s (WAV экв. {int(x_sr*32/1000)} kb/s)",
                            "samples": f"{x_nf:,} PCM frames".replace(",", " ")
                        }
            except Exception:
                pass

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

        tags = get_merged_track_tags_v74(filename, raw_info)

        sr_num = int(re.sub(r"\D", "", sr_str) or "48000")
        total_samples = f"{int(dur_seconds * sr_num):,}".replace(",", " ") if dur_seconds > 0 else "—"

        response.content_type = 'application/json'
        rev_capsule_str = "None (Standard stream)"
        trailer = read_jenny_rev_trailer(full_path)
        if trailer:
            if dur_seconds <= 0 or duration_str == "—":
                dur_seconds, duration_str, bitrate_str, total_samples = calc_jrev_audio_stats(full_path, trailer)
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

        if xflac_custom_meta:
            container_desc = xflac_custom_meta["container"]
            codec_str = xflac_custom_meta["codec"]
            sr_str = xflac_custom_meta["sr"]
            ch_str = xflac_custom_meta["ch"]
            fmt_str = xflac_custom_meta["fmt"]
            duration_str = xflac_custom_meta["dur_str"]
            bitrate_str = xflac_custom_meta["br"]
            total_samples = xflac_custom_meta["samples"]

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
        if req.get('restored_wav_b64'):
            rest_wav = os.path.join(out_dir, f"{prefix}_3_RESTORED_1X.wav")
            with open(rest_wav, 'wb') as f_r: f_r.write(base64.b64decode(req['restored_wav_b64']))
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




# ==============================================================================
# 🎮 JENNY V88.3: HYBRID GAME OST ENGINE (LIVE PROGRESS + ALREADY-DOWNLOADED CHECK)
# ==============================================================================
import urllib.request
import urllib.parse
import base64

OST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    "Accept": "application/json,text/html,application/xhtml+xml,*/*;q=0.8"
}

_OST_PROGRESS_V89 = {
    "active": False, "track_num": 0, "track_title": "",
    "stage": "idle", "downloaded_mb": 0.0, "total_mb": 0.0,
    "percent": 0, "message": ""
}

def _ost_fetch_json_v88(url: str, timeout: int = 18):
    req = urllib.request.Request(url, headers=OST_HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))

def _ost_make_stem_v89(album_title: str, track_num: int, track_title: str):
    safe_alb = re.sub(r'[\\/:*?"<>|]+', '_', (album_title or 'Game OST')).strip()[:42]
    safe_trk = re.sub(r'[\\/:*?"<>|]+', '_', (track_title or 'Track')).strip()[:68]
    return f"{safe_alb} - {int(track_num):02d}. {safe_trk}", safe_alb

def _ost_find_existing_track_v89(album_title: str, track_num: int, track_title: str):
    load_multi_dirs_v71()
    stem, _ = _ost_make_stem_v89(album_title, track_num, track_title)
    stem_low = stem.lower()
    dirs = list(ACTIVE_MUSIC_DIRS) if ACTIVE_MUSIC_DIRS else [MUSIC_DIR]
    if MUSIC_DIR not in dirs:
        dirs.insert(0, MUSIC_DIR)
    for d in dirs:
        if not os.path.isdir(d):
            continue
        try:
            for fn in os.listdir(d):
                fl = fn.lower()
                if fl.startswith(stem_low) and not fl.startswith("temp_final_"):
                    fp = os.path.join(d, fn)
                    if os.path.isfile(fp) and os.path.getsize(fp) > 1024:
                        sz_mb = round(os.path.getsize(fp) / (1024.0 * 1024.0), 2)
                        ext = os.path.splitext(fn)[1].upper().lstrip('.')
                        return {"exists": True, "filename": fn, "size_mb": sz_mb, "ext": ext}
        except Exception:
            pass
    return {"exists": False, "filename": "", "size_mb": 0.0, "ext": ""}

@route('/api/khinsider/progress', method='GET')
def api_khinsider_progress_v89():
    response.content_type = 'application/json'
    return json.dumps(_OST_PROGRESS_V89, ensure_ascii=False)

@post('/api/khinsider/search')
def api_khinsider_search_v88():
    response.content_type = 'application/json'
    try:
        req = json.loads(request.body.read().decode('utf-8'))
        query = (req.get('query') or '').strip()
        if not query:
            return json.dumps({"status": "error", "error": "Введите название игры"})
        mode = (req.get('mode') or 'ost').strip().lower()
        fmt_mode = (req.get('format_mode') or 'xflac_psycho').strip().lower()
        words = [w for w in re.split(r'\s+', query) if w and w.lower() not in ('flac', 'mp3', 'wav', 'ost')]
        strict_q = ' AND '.join(words) if words else query
        fmt_filter = 'AND format:("VBR MP3" OR MP3)' if fmt_mode == 'mp3' else 'AND format:(Flac OR "24bit Flac" OR Wave)'
        if mode == 'archive':
            q_expr = f'({strict_q}) AND mediatype:(audio) {fmt_filter} AND NOT collection:(podcasts)'
        else:
            q_expr = f'(title:({strict_q}) AND (soundtrack OR ost OR music OR score)) AND mediatype:(audio) {fmt_filter}'
        u1 = f"https://archive.org/advancedsearch.php?q={urllib.parse.quote_plus(q_expr)}&fl[]=identifier,title,year,downloads&sort[]=downloads+desc&rows=35&page=1&output=json"
        docs = _ost_fetch_json_v88(u1).get("response", {}).get("docs", [])
        if len(docs) < 3:
            q2 = f'({query} AND (ost OR soundtrack)) AND mediatype:(audio)'
            u2 = f"https://archive.org/advancedsearch.php?q={urllib.parse.quote_plus(q2)}&fl[]=identifier,title,year,downloads&sort[]=downloads+desc&rows=35&page=1&output=json"
            docs = _ost_fetch_json_v88(u2).get("response", {}).get("docs", [])
        albums = []
        for d in docs:
            ident = (d.get("identifier") or "").strip()
            if not ident:
                continue
            albums.append({
                "slug": f"ia:{ident}",
                "title": (d.get("title") or ident).strip(),
                "thumb": f"https://archive.org/services/img/{ident}",
                "platforms": "Archive.org Lossless/MP3",
                "type": f"⬇ {d.get('downloads') or 0}",
                "year": str(d.get("year") or "")
            })
        return json.dumps({"status": "ok", "albums": albums})
    except Exception as e:
        response.status = 500
        return json.dumps({"status": "error", "error": f"Ошибка поиска OST: {e}"})

@post('/api/khinsider/album')
def api_khinsider_album_v88():
    response.content_type = 'application/json'
    try:
        req = json.loads(request.body.read().decode('utf-8'))
        slug = (req.get('slug') or '').strip()
        ident = slug[3:] if slug.startswith("ia:") else slug
        meta = _ost_fetch_json_v88(f"https://archive.org/metadata/{urllib.parse.quote(ident)}")
        m_info = meta.get("metadata") or {}
        album_title = m_info.get("title") or ident
        if isinstance(album_title, list) and album_title:
            album_title = album_title[0]
        album_title = str(album_title)

        by_stem = {}
        has_flac, has_mp3 = False, False
        for fobj in (meta.get("files") or []):
            fn = fobj.get("name") or ""
            low = fn.lower()
            if not low.endswith((".flac", ".mp3", ".wav", ".ogg")):
                continue
            stem = re.sub(r"_vbr$", "", os.path.splitext(fn)[0], flags=re.I)
            rec = by_stem.setdefault(stem, {"title": fobj.get("title") or os.path.basename(stem), "duration": "", "flac_fn": "", "mp3_fn": "", "flac_size": "", "mp3_size": ""})
            length_raw = str(fobj.get("length") or "")
            if length_raw and not rec["duration"]:
                if ":" in length_raw:
                    rec["duration"] = length_raw.split(".")[0]
                else:
                    try:
                        s_i = int(float(length_raw))
                        rec["duration"] = f"{s_i // 60}:{s_i % 60:02d}"
                    except Exception:
                        pass
            sz_b = int(fobj.get("size") or 0)
            sz_s = f"{sz_b / (1024*1024):.1f} MB" if sz_b > 0 else ""
            if low.endswith((".flac", ".wav")):
                has_flac = True; rec["flac_fn"] = fn; rec["flac_size"] = sz_s
            else:
                has_mp3 = True
                if not rec["mp3_fn"]:
                    rec["mp3_fn"] = fn; rec["mp3_size"] = sz_s

        tracks = []
        for idx, (stem, rec) in enumerate(sorted(by_stem.items(), key=lambda x: x[0]), 1):
            t_title = str(rec["title"] or os.path.basename(stem)).strip()
            raw_j = json.dumps({"ident": ident, "flac": rec["flac_fn"], "mp3": rec["mp3_fn"]}, ensure_ascii=False)
            b64_p = "b64:" + base64.urlsafe_b64encode(raw_j.encode("utf-8")).decode("ascii")
            ex = _ost_find_existing_track_v89(album_title, idx, t_title)
            tracks.append({
                "index": idx, "title": t_title, "duration": rec["duration"] or "—",
                "mp3_size": rec["mp3_size"], "flac_size": rec["flac_size"], "page_path": b64_p,
                "downloaded": ex["exists"], "local_file": ex["filename"],
                "local_size_mb": ex["size_mb"], "local_ext": ex["ext"]
            })
        return json.dumps({"status": "ok", "slug": slug, "album_title": album_title, "cover_url": f"https://archive.org/services/img/{ident}", "has_flac": has_flac, "has_mp3": has_mp3, "tracks": tracks})
    except Exception as e:
        response.status = 500
        return json.dumps({"status": "error", "error": f"Ошибка альбома: {e}"})

def _ost_resolve_urls_from_pack_v88(page_path: str):
    if page_path.startswith("sc:"):
        u = _sc_resolve_direct_url_v92(page_path)
        return {"flac_url": "", "mp3_url": u}
    if page_path.startswith("b64:"):
        info = json.loads(base64.urlsafe_b64decode(page_path[4:].encode("ascii")).decode("utf-8"))
    else:
        info = json.loads(page_path)
    base_dl = f"https://archive.org/download/{urllib.parse.quote(info.get('ident') or '')}/"
    fl = info.get("flac") or ""
    mp = info.get("mp3") or ""
    return {"flac_url": (base_dl + urllib.parse.quote(fl)) if fl else "", "mp3_url": (base_dl + urllib.parse.quote(mp)) if mp else ""}

@post('/api/khinsider/resolve_stream')
def api_khinsider_resolve_stream_v88():
    response.content_type = 'application/json'
    try:
        req = json.loads(request.body.read().decode('utf-8'))
        urls = _ost_resolve_urls_from_pack_v88((req.get('page_path') or '').strip())
        su = urls["mp3_url"] or urls["flac_url"]
        return json.dumps({"status": "ok", "stream_url": su, "urls": urls}) if su else json.dumps({"status": "error", "error": "Нет потока"})
    except Exception as e:
        response.status = 500
        return json.dumps({"status": "error", "error": str(e)})

@post('/api/khinsider/download_track')
def api_khinsider_download_track_v88():
    response.content_type = 'application/json'
    tmp_dl, tmp_wav = None, None
    try:
        load_multi_dirs_v71()
        req = json.loads(request.body.read().decode('utf-8'))
        page_path = (req.get('page_path') or '').strip()
        album_title = (req.get('album_title') or 'Game OST').strip()
        track_title = (req.get('track_title') or 'Track').strip()
        track_num = int(req.get('track_num') or 1)
        fmt_mode = (req.get('format_mode') or 'xflac_psycho').strip().lower()

        urls = _ost_resolve_urls_from_pack_v88(page_path)
        dl_url = (urls["mp3_url"] or urls["flac_url"]) if fmt_mode == 'mp3' else (urls["flac_url"] or urls["mp3_url"])
        if not dl_url:
            response.status = 404
            return json.dumps({"status": "error", "error": "Ссылка не найдена"})

        src_ext = ".flac" if ".flac" in dl_url.lower() else ".mp3"
        stem_name, safe_alb = _ost_make_stem_v89(album_title, track_num, track_title)
        os.makedirs(MUSIC_DIR, exist_ok=True)
        tmp_dl = os.path.join(MUSIC_DIR, f"temp_final_khdl_{os.getpid()}{src_ext}")

        _OST_PROGRESS_V89.update({"active": True, "track_num": track_num, "track_title": track_title, "stage": "downloading", "downloaded_mb": 0.0, "total_mb": 0.0, "percent": 2, "message": f"⬇️ Соединение ({src_ext.upper()})..."})
        dl_req = urllib.request.Request(dl_url, headers=OST_HEADERS)
        with urllib.request.urlopen(dl_req, timeout=180) as r_in, open(tmp_dl, "wb") as f_out:
            tot_b = int(r_in.headers.get("Content-Length") or 0)
            tot_mb = round(tot_b / (1024.0 * 1024.0), 2) if tot_b > 0 else 0.0
            _OST_PROGRESS_V89["total_mb"] = tot_mb
            read_b = 0
            while True:
                chunk = r_in.read(65536)
                if not chunk:
                    break
                f_out.write(chunk)
                read_b += len(chunk)
                cur_mb = round(read_b / (1024.0 * 1024.0), 2)
                pct = min(90, int((read_b * 90) // tot_b)) if tot_b > 0 else 50
                _OST_PROGRESS_V89.update({"downloaded_mb": cur_mb, "percent": pct, "message": f"⬇️ Загрузка {src_ext.upper()}: {cur_mb:.1f} / {tot_mb:.1f} MB ({pct}%)" if tot_mb > 0 else f"⬇️ Загрузка: {cur_mb:.1f} MB..."})

        xflac_map = {'xflac_lossless': (0, '_bitperfect.xflac'), 'xflac_psycho': (25, '_psycho.xflac'), 'xflac_ultra': (15, '_ultra.xflac'), 'xflac_hifi': (45, '_hifi.xflac')}
        if fmt_mode in xflac_map and src_ext in ('.flac', '.wav'):
            xf_mode, xf_suf = xflac_map[fmt_mode]
            final_name = f"{stem_name}{xf_suf}"
            final_path = os.path.join(MUSIC_DIR, final_name)
            tmp_wav = os.path.join(MUSIC_DIR, f"temp_final_khwav_{os.getpid()}.wav")
            _OST_PROGRESS_V89.update({"stage": "converting", "percent": 94, "message": f"🧬 Сжатие в xFLAC (режим {xf_mode})..."})
            ff_bin = find_ffmpeg_binary()
            r_ff = subprocess.run([ff_bin, '-y', '-i', tmp_dl, '-vn', '-ac', '2', '-c:a', 'pcm_s16le', tmp_wav], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if r_ff.returncode != 0 or not os.path.isfile(tmp_wav) or os.path.getsize(tmp_wav) < 44:
                raise RuntimeError("Ошибка FFmpeg при декодировании в WAV")
            with open(tmp_wav, "rb") as wf:
                xfc_bytes = _encode_wav_to_xflac_bytes_v85(wf.read(), xf_mode)
            with open(final_path, "wb") as xf_out:
                xf_out.write(xfc_bytes)
        else:
            final_name = f"{stem_name}{src_ext}"
            final_path = os.path.join(MUSIC_DIR, final_name)
            shutil.move(tmp_dl, final_path)
            tmp_dl = None

        db = load_custom_tags_db_v74()
        db[final_name] = {"TITLE": track_title, "ARTIST": safe_alb, "ALBUM": album_title, "GENRE": "Game OST"}
        save_custom_tags_db_v74(db)
        TRACK_META_CACHE_V71.pop(final_path, None)
        sz_mb = round(os.path.getsize(final_path) / (1024.0 * 1024.0), 2)
        ext_lbl = os.path.splitext(final_name)[1].upper().lstrip('.')
        _OST_PROGRESS_V89.update({"active": False, "stage": "done", "percent": 100, "message": f"✅ Готово: {final_name} ({sz_mb} MB)"})
        return json.dumps({"status": "ok", "filename": final_name, "size_mb": sz_mb, "ext": ext_lbl, "folder": MUSIC_DIR})
    except Exception as e:
        _OST_PROGRESS_V89.update({"active": False, "stage": "error", "message": f"❌ {e}"})
        response.status = 500
        return json.dumps({"status": "error", "error": str(e)})
    finally:
        for p in (tmp_dl, tmp_wav):
            if p and os.path.exists(p):
                try: os.remove(p)
                except Exception: pass


# ==============================================================================
# 📻 JENNY V91: LOSSLESS FLAC RADIO STREAMER & LIVE RECORDER TO XFLAC
# ==============================================================================
import time

FLAC_RADIO_PRESETS_V91 = [
    {"id": "rp_main", "title": "Radio Paradise — Main Mix", "genre": "Rock", "codec": "FLAC 1411k", "lossless": True, "url": "http://stream.radioparadise.com/flacm"},
    {"id": "rp_mellow", "title": "Radio Paradise — Mellow Mix", "genre": "Chill", "codec": "FLAC 1411k", "lossless": True, "url": "http://stream.radioparadise.com/mellow-flacm"},
    {"id": "rp_rock", "title": "Radio Paradise — Rock Mix", "genre": "Rock", "codec": "FLAC 1411k", "lossless": True, "url": "http://stream.radioparadise.com/rock-flacm"},
    {"id": "rp_global", "title": "Radio Paradise — Global", "genre": "Electronic", "codec": "FLAC 1411k", "lossless": True, "url": "http://stream.radioparadise.com/global-flacm"},
    {"id": "sector_flac", "title": "SECTOR Radio — Space / Synth", "genre": "Electronic", "codec": "FLAC Lossless", "lossless": True, "url": "http://89.223.45.5:8000/next-flac"},
    {"id": "intense_flac", "title": "Intense Radio — Dance / Trance", "genre": "Electronic", "codec": "FLAC Lossless", "lossless": True, "url": "http://secure.live-streams.nl/flac.flac"},
    {"id": "jb_radio2", "title": "JB Radio-2 Audiophile", "genre": "Rock", "codec": "FLAC Hi-Res", "lossless": True, "url": "https://maggie.torontocast.com:8076/flac"},
    {"id": "motherearth", "title": "Mother Earth Classical", "genre": "Classical", "codec": "FLAC 96kHz", "lossless": True, "url": "https://motherearth.streamserver24.com/listen/motherearth/motherearth"},
    {"id": "soma_drone", "title": "SomaFM — Drone Zone", "genre": "Chill", "codec": "MP3 256k", "lossless": False, "url": "http://ice1.somafm.com/dronezone-256-mp3"},
    {"id": "soma_defcon", "title": "SomaFM — DEF CON Radio", "genre": "Electronic", "codec": "MP3 256k", "lossless": False, "url": "http://ice1.somafm.com/defcon-256-mp3"},
    {"id": "soma_metal", "title": "SomaFM — Metal Detector", "genre": "Rock", "codec": "MP3 128k", "lossless": False, "url": "http://ice1.somafm.com/metal-128-mp3"},
    {"id": "nightride", "title": "Nightride FM — Synthwave", "genre": "Retro", "codec": "MP3 320k", "lossless": False, "url": "https://stream.nightride.fm/nightride.mp3"},
    {"id": "swiss_jazz", "title": "Radio Swiss Jazz", "genre": "Jazz", "codec": "MP3 128k", "lossless": False, "url": "http://stream.srg-ssr.ch/m/rsj/mp3_128"}
]

_RADIO_REC_V91 = {"active": False, "stop_flag": False, "thread": None, "tmp_raw": "", "station": "", "start_ts": 0.0, "bytes": 0, "xf_mode": 25, "lossless": True, "err": ""}

def _map_radio_genre_v91(tags_str: str) -> str:
    t = (tags_str or "").lower()
    if any(k in t for k in ("rock", "metal", "indie", "punk", "alt")): return "Rock"
    if any(k in t for k in ("synth", "retrowave", "game", "80s", "chiptune")): return "Retro"
    if any(k in t for k in ("electro", "house", "trance", "techno", "dance", "drum")): return "Electronic"
    if any(k in t for k in ("chill", "ambient", "lounge", "downtempo", "nature")): return "Chill"
    if any(k in t for k in ("jazz", "blues", "soul", "funk")): return "Jazz"
    if any(k in t for k in ("classic", "orchestra", "piano", "opera")): return "Classical"
    return "Pop / Misc"

@post('/api/radio/stations')
def api_radio_stations_v91():
    response.content_type = 'application/json'
    try:
        req = json.loads(request.body.read().decode('utf-8') or "{}")
        q = (req.get('query') or '').strip().lower()
        stations = [s for s in FLAC_RADIO_PRESETS_V91 if not q or q in s["title"].lower() or q in s["genre"].lower()]
        api_u = (
            f"https://de1.api.radio-browser.info/json/stations/search?name={urllib.parse.quote(q)}&hidebroken=true&order=clickcount&reverse=true&limit=35"
            if q else "https://de1.api.radio-browser.info/json/stations/bycodec/FLAC?hidebroken=true&order=clickcount&reverse=true&limit=25"
        )
        try:
            rows = _ost_fetch_json_v88(api_u, timeout=7)
            seen = {s["url"] for s in stations}
            for r in (rows or []):
                u = (r.get("url_resolved") or r.get("url") or "").strip()
                nm = (r.get("name") or "").strip()
                if u and nm and u not in seen:
                    seen.add(u)
                    cdc = (r.get("codec") or "MP3").upper()
                    br = int(r.get("bitrate") or 0)
                    is_ll = ("FLAC" in cdc or "WAV" in cdc or "ALAC" in cdc or br >= 900)
                    stations.append({
                        "id": r.get("stationuuid") or nm,
                        "title": nm,
                        "genre": _map_radio_genre_v91(r.get("tags") or ""),
                        "codec": f"{cdc} {br}k" if br else cdc,
                        "lossless": is_ll,
                        "url": u
                    })
        except Exception:
            pass
        return json.dumps({"status": "ok", "stations": stations}, ensure_ascii=False)
    except Exception as e:
        response.status = 500
        return json.dumps({"status": "error", "error": str(e)})

def _radio_stream_worker_v91(url: str, dst_path: str):
    try:
        hdrs = dict(OST_HEADERS)
        hdrs["Icy-MetaData"] = "0"
        req = urllib.request.Request(url, headers=hdrs)
        with urllib.request.urlopen(req, timeout=15) as resp, open(dst_path, "wb") as out_f:
            while not _RADIO_REC_V91["stop_flag"]:
                chunk = resp.read(16384)
                if not chunk:
                    break
                out_f.write(chunk)
                out_f.flush()
                _RADIO_REC_V91["bytes"] += len(chunk)
    except Exception as e:
        _RADIO_REC_V91["err"] = str(e)
    finally:
        _RADIO_REC_V91["active"] = False

@post('/api/radio/record_start')
def api_radio_rec_start_v91():
    response.content_type = 'application/json'
    try:
        if _RADIO_REC_V91["active"]:
            return json.dumps({"status": "error", "error": "Запись уже идёт"})
        load_multi_dirs_v71()
        req = json.loads(request.body.read().decode('utf-8'))
        s_url = (req.get("url") or "").strip()
        s_title = (req.get("title") or "Radio").strip()
        is_ll = bool(req.get("lossless", True))
        fmt = (req.get("format_mode") or "xflac_psycho").strip().lower()
        xf_mode = {'xflac_lossless': 0, 'xflac_psycho': 25, 'xflac_ultra': 15, 'xflac_hifi': 45}.get(fmt, 25)
        os.makedirs(MUSIC_DIR, exist_ok=True)
        tmp_raw = os.path.join(MUSIC_DIR, f"temp_final_radraw_{os.getpid()}.stream")
        _RADIO_REC_V91.update({"active": True, "stop_flag": False, "tmp_raw": tmp_raw, "station": s_title, "start_ts": time.time(), "bytes": 0, "xf_mode": xf_mode, "lossless": is_ll, "err": ""})
        t = threading.Thread(target=_radio_stream_worker_v91, args=(s_url, tmp_raw), daemon=True)
        _RADIO_REC_V91["thread"] = t
        t.start()
        return json.dumps({"status": "ok"})
    except Exception as e:
        response.status = 500
        return json.dumps({"status": "error", "error": str(e)})

@route('/api/radio/record_status', method='GET')
def api_radio_rec_status_v91():
    response.content_type = 'application/json'
    act = bool(_RADIO_REC_V91.get("active"))
    sec = max(0, int(time.time() - (_RADIO_REC_V91.get("start_ts") or time.time()))) if act else 0
    mb = round((_RADIO_REC_V91.get("bytes") or 0) / (1024.0 * 1024.0), 2)
    return json.dumps({"active": act, "sec": sec, "wav_mb": mb, "station": _RADIO_REC_V91.get("station") or "", "err": _RADIO_REC_V91.get("err") or ""})

@post('/api/radio/record_stop')
def api_radio_rec_stop_v91():
    response.content_type = 'application/json'
    traw = _RADIO_REC_V91.get("tmp_raw") or ""
    twav = os.path.join(MUSIC_DIR, f"temp_final_radwav_{os.getpid()}.wav")
    try:
        _RADIO_REC_V91["stop_flag"] = True
        thr = _RADIO_REC_V91.get("thread")
        if thr and thr.is_alive():
            thr.join(timeout=2.5)
        _RADIO_REC_V91["active"] = False
        if not traw or not os.path.isfile(traw) or os.path.getsize(traw) < 16384:
            err_detail = _RADIO_REC_V91.get("err") or "Поток станции не отдал аудиоданных"
            return json.dumps({"status": "error", "error": f"Мало данных ({err_detail})"})

        safe_st = re.sub(r'[\\/:*?"<>|\[\]]+', '_', _RADIO_REC_V91.get("station") or "Radio").strip()[:34]
        stamp = time.strftime("%H%M%S")
        if not _RADIO_REC_V91.get("lossless", True):
            final_name = f"Radio - {safe_st}_{stamp}.mp3"
            final_path = os.path.join(MUSIC_DIR, final_name)
            shutil.move(traw, final_path)
            traw = ""
        else:
            ff_bin = find_ffmpeg_binary()
            subprocess.run([ff_bin, '-y', '-i', traw, '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', twav], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
            if not os.path.isfile(twav) or os.path.getsize(twav) < 4096:
                return json.dumps({"status": "error", "error": "FFmpeg не смог декодировать кусок эфира"})
            with open(twav, "rb") as f:
                wav_b = f.read()
            xf_mode = _RADIO_REC_V91.get("xf_mode", 25)
            suf = {0: "_bitperfect.xflac", 15: "_ultra.xflac", 25: "_psycho.xflac", 45: "_hifi.xflac"}.get(xf_mode, "_psycho.xflac")
            final_name = f"Radio - {safe_st}_{stamp}{suf}"
            final_path = os.path.join(MUSIC_DIR, final_name)
            xfc_bytes = _encode_wav_to_xflac_bytes_v85(wav_b, xf_mode)
            with open(final_path, "wb") as out_f:
                out_f.write(xfc_bytes)

        db = load_custom_tags_db_v74()
        db[final_name] = {"TITLE": f"{safe_st} ({stamp})", "ARTIST": "Radio Stream", "ALBUM": "Записи радиоэфира", "GENRE": "Radio"}
        save_custom_tags_db_v74(db)
        TRACK_META_CACHE_V71.pop(final_path, None)
        sz_mb = round(os.path.getsize(final_path) / (1024.0 * 1024.0), 2)
        return json.dumps({"status": "ok", "filename": final_name, "size_mb": sz_mb})
    except Exception as e:
        response.status = 500
        return json.dumps({"status": "error", "error": str(e)})
    finally:
        for fp in (traw, twav):
            if fp and os.path.exists(fp):
                try: os.remove(fp)
                except Exception: pass

# ☁️ JENNY V92: SOUNDCLOUD ENGINE (DESKTOP UA SCRAPER + COOKIE JAR + CHROME EXTRACTOR)
import http.cookiejar

SC_AUTH_FILE_V93 = os.path.join(DEFAULT_MUSIC_DIR, "jenny_sc_auth.json")
_SC_CLIENT_ID_V92 = None
_SC_COOKIE_JAR_V95 = http.cookiejar.CookieJar()
_SC_DESKTOP_UA_V95 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

def _sc_load_auth_v93():
    if os.path.isfile(SC_AUTH_FILE_V93):
        try:
            with open(SC_AUTH_FILE_V93, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"cookie": "", "client_id": ""}

@post('/api/soundcloud/save_auth')
def api_sc_save_auth_v93():
    global _SC_CLIENT_ID_V92
    response.content_type = 'application/json'
    try:
        req = json.loads(request.body.read().decode('utf-8') or "{}")
        cookie_str = (req.get("cookie") or "").strip()
        cid_str = (req.get("client_id") or "").strip()
        os.makedirs(DEFAULT_MUSIC_DIR, exist_ok=True)
        with open(SC_AUTH_FILE_V93, "w", encoding="utf-8") as f:
            json.dump({"cookie": cookie_str, "client_id": cid_str}, f, ensure_ascii=False)
        _SC_CLIENT_ID_V92 = cid_str if cid_str else None
        return json.dumps({"status": "ok"})
    except Exception as e:
        response.status = 500
        return json.dumps({"status": "error", "error": str(e)})

def _sc_headers_v93():
    h = {
        "User-Agent": _SC_DESKTOP_UA_V95,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
        "Referer": "https://soundcloud.com/",
        "Origin": "https://soundcloud.com"
    }
    auth = _sc_load_auth_v93()
    if auth.get("cookie"):
        h["Cookie"] = auth["cookie"]
        m_oauth = re.search(r'oauth_token=([^;\s]+)', auth["cookie"])
        if m_oauth:
            h["Authorization"] = f"OAuth {m_oauth.group(1)}"
    return h

def _sc_urlopen_v95(url: str, timeout: int = 10):
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_SC_COOKIE_JAR_V95))
    req = urllib.request.Request(url, headers=_sc_headers_v93())
    return opener.open(req, timeout=timeout)

def _sc_get_client_id_v92(force_refresh: bool = False):
    global _SC_CLIENT_ID_V92
    auth = _sc_load_auth_v93()
    if auth.get("client_id") and not force_refresh:
        return auth["client_id"]
    if _SC_CLIENT_ID_V92 and not force_refresh:
        return _SC_CLIENT_ID_V92
    for page_u in ("https://soundcloud.com/discover", "https://soundcloud.com"):
        try:
            with _sc_urlopen_v95(page_u, timeout=10) as r:
                html = r.read().decode("utf-8", errors="ignore")
            scripts = re.findall(r'src="(https://a-v2\.sndcdn\.com/assets/[^"]+\.js)"', html)
            for s_url in reversed(scripts[-8:]):
                try:
                    with _sc_urlopen_v95(s_url, timeout=8) as sr:
                        js_txt = sr.read().decode("utf-8", errors="ignore")
                    m = re.search(r'client_id\s*[:=]\s*"([a-zA-Z0-9]{32})"', js_txt)
                    if m:
                        _SC_CLIENT_ID_V92 = m.group(1)
                        return _SC_CLIENT_ID_V92
                except Exception:
                    pass
        except Exception:
            pass
    raise RuntimeError("SoundCloud не отдал client_id (проверь соединение или вставь куки)")

@post('/api/soundcloud/search')
def api_soundcloud_search_v92():
    response.content_type = 'application/json'
    try:
        req = json.loads(request.body.read().decode('utf-8') or "{}")
        q = (req.get("query") or "").strip()
        if not q:
            return json.dumps({"status": "error", "error": "Введите запрос"})
        cid = _sc_get_client_id_v92(False)
        u = f"https://api-v2.soundcloud.com/search/tracks?q={urllib.parse.quote(q)}&client_id={cid}&limit=30"
        try:
            with _sc_urlopen_v95(u, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
        except Exception:
            cid = _sc_get_client_id_v92(True)
            u2 = f"https://api-v2.soundcloud.com/search/tracks?q={urllib.parse.quote(q)}&client_id={cid}&limit=30"
            with _sc_urlopen_v95(u2, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))

        tracks = []
        for idx, item in enumerate(data.get("collection") or [], 1):
            trans = (item.get("media") or {}).get("transcodings") or []
            prog_u = next((tr.get("url") for tr in trans if (tr.get("format") or {}).get("protocol") == "progressive"), "")
            if not prog_u and trans:
                prog_u = trans[0].get("url") or ""
            if not prog_u:
                continue
            dur_s = int(item.get("duration") or 0) // 1000
            art = (item.get("user") or {}).get("username") or "SoundCloud"
            title = item.get("title") or f"Track {idx}"
            full_t = f"{art} — {title}" if art.lower() not in title.lower() else title
            b64_p = "sc:" + base64.urlsafe_b64encode(prog_u.encode("utf-8")).decode("ascii")
            ex = _ost_find_existing_track_v89("SoundCloud", idx, full_t)
            tracks.append({"index": idx, "title": full_t, "duration": f"{dur_s // 60}:{dur_s % 60:02d}", "mp3_size": "MP3 Stream", "page_path": b64_p, "downloaded": ex["exists"], "local_ext": ex["ext"], "local_size_mb": ex["size_mb"]})
        return json.dumps({"status": "ok", "tracks": tracks}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "ok", "tracks": [], "err": str(e)}, ensure_ascii=False)

def _sc_resolve_direct_url_v92(page_path: str) -> str:
    api_u = base64.urlsafe_b64decode(page_path[3:].encode("ascii")).decode("utf-8")
    cid = _sc_get_client_id_v92(False)
    sep = "&" if "?" in api_u else "?"
    with _sc_urlopen_v95(f"{api_u}{sep}client_id={cid}", timeout=10) as resp:
        j = json.loads(resp.read().decode("utf-8", errors="replace"))
    return j.get("url") or ""

@post('/api/sources/kill_all')
def api_sources_kill_all_v94():
    response.content_type = 'application/json'
    try:
        if "_RADIO_REC_V91" in globals():
            _RADIO_REC_V91["stop_flag"] = True
            _RADIO_REC_V91["active"] = False
            proc = _RADIO_REC_V91.get("proc")
            if proc and hasattr(proc, "poll") and proc.poll() is None:
                try: proc.kill()
                except Exception: pass
        if "_OST_PROGRESS_V89" in globals():
            _OST_PROGRESS_V89.update({"active": False, "stage": "idle", "percent": 0, "message": ""})
        cleanup_stale_temps(MUSIC_DIR)
        return json.dumps({"status": "ok"})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})


@post('/api/soundcloud/download_track')
def api_soundcloud_download_track_v96():
    response.content_type = 'application/json'
    tmp_raw = os.path.join(MUSIC_DIR, f"temp_final_sc_{os.getpid()}.stream")
    try:
        load_multi_dirs_v71()
        req = json.loads(request.body.read().decode('utf-8') or "{}")
        page_path = (req.get("page_path") or "").strip()
        track_title = (req.get("track_title") or "Track").strip()
        track_num = int(req.get("track_num") or 1)
        if not page_path.startswith("sc:"):
            return json.dumps({"status": "error", "error": "Неверный идентификатор трека SoundCloud"})

        stream_u = _sc_resolve_direct_url_v92(page_path)
        if not stream_u:
            return json.dumps({"status": "error", "error": "SoundCloud не отдал поток"})

        os.makedirs(MUSIC_DIR, exist_ok=True)
        with _sc_urlopen_v95(stream_u, timeout=20) as r:
            first_b = r.read(16384)
            if first_b.lstrip().startswith(b"#EXTM3U") or ".m3u8" in stream_u.lower():
                m3u8_txt = (first_b + r.read()).decode("utf-8", errors="ignore")
                seg_urls = [ln.strip() for ln in m3u8_txt.splitlines() if ln.strip().startswith("http")]
                if not seg_urls:
                    return json.dumps({"status": "error", "error": "Пустой HLS-плейлист SoundCloud"})
                with open(tmp_raw, "wb") as out_f:
                    for su in seg_urls:
                        with _sc_urlopen_v95(su, timeout=15) as sr:
                            out_f.write(sr.read())
            else:
                with open(tmp_raw, "wb") as out_f:
                    out_f.write(first_b)
                    while True:
                        chunk = r.read(65536)
                        if not chunk:
                            break
                        out_f.write(chunk)

        safe_t = re.sub(r'[\\/:*?"<>|\[\]]+', '_', track_title).strip()[:65]
        final_name = f"SoundCloud - {track_num:02d}. {safe_t}.mp3"
        final_path = os.path.join(MUSIC_DIR, final_name)

        ff_bin = find_ffmpeg_binary()
        tmp_mp3 = os.path.join(MUSIC_DIR, f"temp_final_sc_enc_{os.getpid()}.mp3")
        subprocess.run([ff_bin, '-y', '-i', tmp_raw, '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k', '-write_xing', '1', tmp_mp3], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90)
        if os.path.isfile(tmp_mp3) and os.path.getsize(tmp_mp3) >= 16384:
            shutil.move(tmp_mp3, final_path)
        if not os.path.isfile(final_path) or os.path.getsize(final_path) < 16384:
            shutil.move(tmp_raw, final_path)
            tmp_raw = ""

        db = load_custom_tags_db_v74()
        db[final_name] = {"TITLE": track_title, "ARTIST": "SoundCloud", "ALBUM": "SoundCloud Stream", "GENRE": "SoundCloud"}
        save_custom_tags_db_v74(db)
        TRACK_META_CACHE_V71.pop(final_path, None)
        sz_mb = round(os.path.getsize(final_path) / (1024.0 * 1024.0), 2)
        return json.dumps({"status": "ok", "filename": final_name, "size_mb": sz_mb, "ext": "MP3"})
    except Exception as e:
        response.status = 500
        return json.dumps({"status": "error", "error": str(e)})
    finally:
        if tmp_raw and os.path.exists(tmp_raw):
            try: os.remove(tmp_raw)
            except Exception: pass


# ==============================================================================
# 🧲 JENNY V96: GO TORRENT ENGINE BRIDGE (libjtorrent.so + SEARCH + AUTO XFLAC)
# ==============================================================================
_JTORRENT_PROC_V96 = None
_JTORRENT_PORT_V96 = "18081"
_JTORRENT_CONVERTED_V96 = {}

def find_jtorrent_binary_v96():
    ff_dir = os.path.dirname(find_ffmpeg_binary())
    if ff_dir:
        cand = os.path.join(ff_dir, "libjtorrent.so")
        if os.path.isfile(cand):
            return cand
    for env_k in ("PATH", "LD_LIBRARY_PATH"):
        for d in os.environ.get(env_k, "").split(":"):
            if d and os.path.isfile(os.path.join(d, "libjtorrent.so")):
                return os.path.join(d, "libjtorrent.so")
    local_so = os.path.join(BASE_DIR, "..", "jniLibs", "arm64-v8a", "libjtorrent.so")
    if os.path.isfile(local_so):
        return os.path.abspath(local_so)
    return "libjtorrent.so"

def ensure_jtorrent_daemon_v96():
    global _JTORRENT_PROC_V96
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.8) as r:
            if r.status == 200:
                return True
    except Exception:
        pass
    bin_p = find_jtorrent_binary_v96()
    tor_dir = os.path.join(MUSIC_DIR, "torrents_tmp")
    os.makedirs(tor_dir, exist_ok=True)
    _JTORRENT_PROC_V96 = subprocess.Popen([bin_p, "-port", _JTORRENT_PORT_V96, "-dir", tor_dir], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    for _ in range(25):
        time.sleep(0.15)
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.5) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass
    return False

@post('/api/torrent/search')
def api_torrent_search_v96():
    response.content_type = 'application/json'
    try:
        req = json.loads(request.body.read().decode('utf-8') or "{}")
        q = (req.get("query") or "").strip()
        only_flac = bool(req.get("only_flac", True))
        if not q:
            return json.dumps({"status": "error", "error": "Пустой запрос"})
        sq = f"{q} FLAC" if (only_flac and "flac" not in q.lower()) else q
        results = []
        try:
            u = f"https://apibay.org/q.php?q={urllib.parse.quote(sq)}&cat=100"
            rows = _ost_fetch_json_v88(u, timeout=8)
            for r in (rows or [])[:25]:
                ih = (r.get("info_hash") or "").strip()
                nm = (r.get("name") or "").strip()
                if not ih or ih == "0000000000000000000000000000000000000000" or nm == "No results returned":
                    continue
                sz_mb = round(int(r.get("size") or 0) / (1024 * 1024), 1)
                seeds = int(r.get("seeders") or 0)
                peers = int(r.get("leechers") or 0)
                tr_list = "&tr=udp://tracker.opentrackr.org:1337/announce&tr=udp://open.stealth.si:80/announce&tr=udp://exodus.desync.com:6969/announce"
                mag = f"magnet:?xt=urn:btih:{ih}&dn={urllib.parse.quote(nm)}{tr_list}"
                results.append({"title": nm, "size_mb": sz_mb, "seeders": seeds, "peers": peers, "magnet": mag})
        except Exception:
            pass
        return json.dumps({"status": "ok", "results": results}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

@post('/api/torrent/add')
def api_torrent_add_v96():
    response.content_type = 'application/json'
    try:
        if not ensure_jtorrent_daemon_v96():
            return json.dumps({"status": "error", "error": "Не удалось запустить демон libjtorrent.so"})
        body = request.body.read()
        req = urllib.request.Request(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/add", data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=32) as r:
            return r.read().decode("utf-8")
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

@post('/api/torrent/download')
def api_torrent_download_v96():
    response.content_type = 'application/json'
    try:
        ensure_jtorrent_daemon_v96()
        body = request.body.read()
        req = urllib.request.Request(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/download", data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.read().decode("utf-8")
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

@route('/api/torrent/status', method='GET')
def api_torrent_status_v96():
    response.content_type = 'application/json'
    try:
        if not ensure_jtorrent_daemon_v96():
            return json.dumps({"status": "ok", "torrents": []})
        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=3) as r:
            data = json.loads(r.read().decode("utf-8"))
        for t in (data.get("torrents") or []):
            for f in (t.get("files") or []):
                key = f"{t.get('hash')}_{f.get('index')}"
                f["xflac_file"] = _JTORRENT_CONVERTED_V96.get(key, "")
        return json.dumps(data, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

@post('/api/torrent/import_track')
def api_torrent_import_track_v96():
    response.content_type = 'application/json'
    try:
        load_multi_dirs_v71()
        req = json.loads(request.body.read().decode('utf-8') or "{}")
        full_p = (req.get("full_path") or "").strip()
        tor_name = (req.get("torrent_name") or "Torrent").strip()
        fmt = (req.get("format_mode") or "xflac_psycho").strip().lower()
        key = f"{req.get('hash')}_{req.get('index')}"
        if not full_p or not os.path.isfile(full_p):
            return json.dumps({"status": "error", "error": "Файл ещё не докачан"})
        base_nm = os.path.splitext(os.path.basename(full_p))[0]
        ext = os.path.splitext(full_p)[1].lower()
        xf_map = {'xflac_lossless': 0, 'xflac_psycho': 25, 'xflac_ultra': 15}
        if fmt in xf_map and ext in ('.flac', '.wav'):
            xf_mode = xf_map[fmt]
            suf = {0: "_bitperfect.xflac", 15: "_ultra.xflac", 25: "_psycho.xflac"}[xf_mode]
            final_name = f"{base_nm}{suf}"
            final_path = os.path.join(MUSIC_DIR, final_name)
            twav = os.path.join(MUSIC_DIR, f"temp_final_tor_{os.getpid()}.wav")
            try:
                subprocess.run([find_ffmpeg_binary(), '-y', '-i', full_p, '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', twav], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90)
                with open(twav, "rb") as wf:
                    xfc_b = _encode_wav_to_xflac_bytes_v85(wf.read(), xf_mode)
                with open(final_path, "wb") as of:
                    of.write(xfc_b)
            finally:
                if os.path.exists(twav):
                    try: os.remove(twav)
                    except Exception: pass
        else:
            final_name = os.path.basename(full_p)
            final_path = os.path.join(MUSIC_DIR, final_name)
            shutil.copy2(full_p, final_path)
        _JTORRENT_CONVERTED_V96[key] = final_name
        db = load_custom_tags_db_v74()
        db[final_name] = {"TITLE": base_nm, "ARTIST": tor_name[:40], "ALBUM": tor_name[:50], "GENRE": "Torrent P2P"}
        save_custom_tags_db_v74(db)
        TRACK_META_CACHE_V71.pop(final_path, None)
        sz_mb = round(os.path.getsize(final_path) / (1024 * 1024), 2)
        return json.dumps({"status": "ok", "filename": final_name, "size_mb": sz_mb})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})


@route('/api/torrent/stream/<hash_str>/<file_idx:int>', method='GET')
def api_torrent_stream_proxy_v97(hash_str, file_idx):
    ensure_jtorrent_daemon_v96()
    u = f"http://127.0.0.1:{_JTORRENT_PORT_V96}/stream?hash={hash_str}&file={file_idx}"
    hdrs = {}
    if request.headers.get("Range"):
        hdrs["Range"] = request.headers.get("Range")
    req = urllib.request.Request(u, headers=hdrs)
    r = urllib.request.urlopen(req, timeout=20)
    response.status = r.status
    for k in ("Content-Type", "Content-Length", "Accept-Ranges", "Content-Range"):
        if r.headers.get(k):
            response.set_header(k, r.headers.get(k))
    return r

def start_server():
    load_saved_music_dir()
    cleanup_stale_temps(DEFAULT_MUSIC_DIR)
    if MUSIC_DIR != DEFAULT_MUSIC_DIR:
        cleanup_stale_temps(MUSIC_DIR)
    print("🎧 АВТОНОМНЫЙ ПЛЕЕР ЗАПУЩЕН НА ПОРТУ 8080")
    run(host='127.0.0.1', port=8080, quiet=True, server='waitress')

if __name__ == "__main__":
    start_server()
