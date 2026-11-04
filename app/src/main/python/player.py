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

# ==============================================================================
# ⚙️ КОНФИГУРАЦИЯ ПОИСКОВОГО ЯДРА OMNITORRENT (ТАЙМАУТЫ, ПРОФИЛИ, ФОРМАТЫ, ГОД)
# ==============================================================================
OMNI_TORRENT_CONFIG = {
    # --- 1. ТАЙМАУТЫ ПОИСКА ---
    "timeout_ms": 10000,         # Таймаут опроса торрент-индексаторов внутри Go-ядра (в мс: 5500 / 10000 / 15000)
    # "timeout_ms": 15000,       # Раскомментируй для медленного мобильного интернета или VPN
    "http_timeout_sec": 20.0,    # Общий таймаут ожидания HTTP-ответа в player.py от демона (в секундах)

    # --- 2. РЕЖИМ МЕДИА-ПРОФИЛЯ И ФОРМАТОВ ПОИСКА ---
    "profile": "audio",          # Активный профиль: "audio" (только музыка), "video" (фильмы/сериалы), "omni" (всё вместе)
    # "profile": "video",        # Раскомментируй для переключения в режим поиска видео/фильмов
    # "profile": "omni",         # Раскомментируй, чтобы искать одновременно музыку и фильмы без фильтрации

    "default_format_tag": "all", # Формат по умолчанию при открытии окна: "all", "flac", "wav", "mp3", "m4a"
    # "default_format_tag": "flac", # Раскомментируй, чтобы при запуске сразу стоял фильтр FLAC

    # Список кнопок форматов в панели Торрент-студии (можно закомментировать ненужные или раскомментировать видео-теги):
    "format_tags": [
        {"id": "all",  "label": "🌐 ВСЕ",  "color": "#58a6ff"},
        {"id": "flac", "label": "💎 FLAC", "color": "#d2a8ff"},
        {"id": "wav",  "label": "🌊 WAV",  "color": "#39c5cf"},
        {"id": "mp3",  "label": "🎵 MP3",  "color": "#3fb950"},
        {"id": "m4a",  "label": "🍏 M4A",  "color": "#e3b341"},
        # {"id": "ogg",   "label": "🔥 OGG/OPUS", "color": "#f0883e"},
        {"id": "video", "label": "🎬 ВИДЕО", "color": "#ff7b72"},
        {"id": "1080p", "label": "📽️ 1080p", "color": "#ffa657"},
        {"id": "2160p", "label": "🔥 4K",    "color": "#f0883e"},
    ],

    # --- 3. ПОЛЕ ФИЛЬТРАЦИИ ПО ГОДУ ВЫПУСКА ---
    "enable_year_filter": True,  # Показывать отдельное поле ввода «📅 Год» рядом со строкой поиска
    "default_year": "",          # Год по умолчанию (оставь "" пустым или укажи например "2025")

    # --- 4. ПОДКЛЮЧАЕМЫЕ НА ЛЕТУ МОДУЛИ ЯДРА ---
    "enable_phonetic": True,     # Модуль фонетики, авто-раскладки и слогового транслита (джэйзэт -> Jay-Z)
    "enable_catalog": True,      # Модуль каталогов iTunes/Deezer (Песня -> Артист + доп. списки feat./при уч./&)
    "enable_udp": True,          # Живой бинарный BEP-15 UDP-радар сидов по 4 трекерам
}



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
    files_dir = os.environ.get("JENNY_FILES_DIR", "") or "/data/user/0/com.jenny.player/files"
    path_dirs = [p.strip() for p in os.environ.get("PATH", "").split(":") if p.strip()]

    extra_dirs = []
    if "_get_native_lib_dirs_v140" in globals():
        try:
            extra_dirs = _get_native_lib_dirs_v140()
        except Exception:
            pass

    # Предзагружаем libc++_shared.so из папки нативных библиотек APK, если она есть
    for d in ([native_dir] + extra_dirs + path_dirs):
        if d:
            cpp_so = os.path.join(d, "libc++_shared.so")
            if os.path.isfile(cpp_so):
                try:
                    ctypes.CDLL(cpp_so, mode=ctypes.RTLD_GLOBAL)
                    break
                except Exception:
                    pass

    candidates = []
    if os.environ.get("XFLAC_LIB_PATH"):
        candidates.append(os.environ["XFLAC_LIB_PATH"])
    if native_dir:
        candidates.append(os.path.join(native_dir, "libxflac.so"))
    for ed in extra_dirs:
        candidates.append(os.path.join(ed, "libxflac.so"))
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

def _extract_wav_meta_from_raw_hdr_v157(raw_hdr: bytes, flags: int = 0):
    sr = 44100
    bits = 24 if (flags & 8) else (32 if (flags & 16) else 16)
    ch = 1 if (flags & 4) else 2
    if len(raw_hdr) >= 44 and raw_hdr[16:20] == b'RIFF':
        fmt_idx = raw_hdr.find(b'fmt ', 20, min(len(raw_hdr), 512))
        if fmt_idx != -1 and fmt_idx + 24 <= len(raw_hdr):
            cand_ch = struct.unpack('<H', raw_hdr[fmt_idx + 10:fmt_idx + 12])[0]
            cand_sr = struct.unpack('<I', raw_hdr[fmt_idx + 12:fmt_idx + 16])[0]
            cand_bits = struct.unpack('<H', raw_hdr[fmt_idx + 22:fmt_idx + 24])[0]
            if cand_ch in (1, 2):
                ch = int(cand_ch)
            if 8000 <= cand_sr <= 384000:
                sr = int(cand_sr)
            if cand_bits in (16, 24, 32):
                bits = int(cand_bits)
    return sr, bits, ch

def _extract_wav_sr_from_raw_meta_v156(raw_hdr: bytes) -> int:
    sr, _, _ = _extract_wav_meta_from_raw_hdr_v157(raw_hdr, 0)
    return sr

def _old_extract_sr_unused(raw_hdr: bytes) -> int:
    if len(raw_hdr) >= 44 and raw_hdr[16:20] == b'RIFF':
        fmt_idx = raw_hdr.find(b'fmt ', 20, min(len(raw_hdr), 512))
        if fmt_idx != -1 and fmt_idx + 16 <= len(raw_hdr):
            cand_sr = struct.unpack('<I', raw_hdr[fmt_idx + 12:fmt_idx + 16])[0]
            if 8000 <= cand_sr <= 384000:
                return int(cand_sr)
        cand_sr = struct.unpack('<I', raw_hdr[40:44])[0]
        if 8000 <= cand_sr <= 384000:
            return int(cand_sr)
    return 44100

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
                        raw_hdr = decomp.decompress(comp_chunk, max_length=512)
                    else:
                        raw_hdr = comp_chunk[:512]
                    sr = _extract_wav_sr_from_raw_meta_v156(raw_hdr)
                except Exception:
                    pass
                sr, bits_hdr, ch = _extract_wav_meta_from_raw_hdr_v157(raw_hdr if 'raw_hdr' in locals() else b'', flags)
                wav_sz = int(nf) * ch * (bits_hdr // 8) + 44
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
SAVED_MUSIC_DIRS = ["/storage/emulated/0/Music", "/storage/emulated/0/JennyVideo", "/storage/emulated/0/Music/mp3_test", "/storage/emulated/0/Download"]
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
        if dur_sec <= 0:
            pr2 = subprocess.run([ff_bin, '-hide_banner', '-i', fp, '-vn', '-c:a', 'copy', '-f', 'null', '-'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10)
            t_all = re.findall(r"time=(\d{2}):(\d{2}):(\d{2}\.\d+)", (pr2.stderr or ""))
            if t_all:
                hh, mm, ss = t_all[-1]
                dur_sec = int(hh) * 3600 + int(mm) * 60 + float(ss)
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
    return ('.mp3', '.opus', '.m4a', '.flac', '.wav', '.xflac', '.ogg', '.mp4', '.aac', '.webm', '.3gp', '.mkv', '.avi', '.mov', '.m4v', '.flv')


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
        bit_depth_mode = request.forms.get('bit_depth_mode', 'orig').strip().lower()
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

        valid_srs = ('44100', '48000', '88200', '96000', '192000')
        # Определяем родную битность исходника (16, 24 или 32 бит)
        orig_bits = 16
        if os.path.isfile(orig_path):
            if orig_path.lower().endswith('.xflac'):
                try:
                    with open(orig_path, 'rb') as xff_b:
                        xh = xff_b.read(25)
                        if len(xh) >= 5 and xh[:4] == b'XFC3':
                            fl_b = xh[4]
                            orig_bits = 24 if (fl_b & 8) else (32 if (fl_b & 16) else 16)
                except Exception:
                    pass
            else:
                try:
                    pr_bits = subprocess.run([ffmpeg_bin, '-hide_banner', '-i', orig_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=4)
                    info_b = (pr_bits.stderr or '') + (pr_bits.stdout or '')
                    if any(w in info_b for w in ('24 bit', 'pcm_s24', 's24')):
                        orig_bits = 24
                    elif any(w in info_b for w in ('32 bit', 'pcm_s32', 'pcm_f32', 's32 (32 bit)')):
                        orig_bits = 32
                except Exception:
                    pass

        target_bits = orig_bits if bit_depth_mode == 'orig' else (int(bit_depth_mode) if bit_depth_mode in ('16', '24', '32') else orig_bits)
        pcm_codec = 'pcm_s24le' if target_bits == 24 else ('pcm_f32le' if (target_bits == 32 and is_wav_unpack) else ('pcm_s32le' if target_bits == 32 else 'pcm_s16le'))

        if direct_clean and os.path.isfile(orig_path):
            if orig_path.lower().endswith('.xflac'):
                with open(orig_path, 'rb') as xf:
                    dec_wav = _decode_xflac_bytes_to_wav_v85(xf.read())
                with open(temp_wav, 'wb') as wf:
                    wf.write(dec_wav)
                if sr_mode in valid_srs or target_bits != orig_bits:
                    temp_sr_wav = temp_wav + ".sr.wav"
                    ar_args = ['-ar', sr_mode] if sr_mode in valid_srs else []
                    r_sr = subprocess.run([ffmpeg_bin, '-y', '-i', temp_wav] + ar_args + ['-ac', '2', '-c:a', pcm_codec, temp_sr_wav], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    if r_sr.returncode == 0 and os.path.exists(temp_sr_wav):
                        os.replace(temp_sr_wav, temp_wav)
            elif orig_path.lower().endswith('.wav') and sr_mode not in valid_srs and target_bits == orig_bits:
                # 100% побитовая копия исходного WAV (включая родной 24-bit 96000 Hz и все чанки) без перекодирования!
                shutil.copyfile(orig_path, temp_wav)
            else:
                ar_args = ['-ar', sr_mode] if sr_mode in valid_srs else []
                af_args = ['-af', 'aresample=dither_method=triangular_hp'] if target_bits == 16 and orig_bits > 16 else []
                subprocess.run([ffmpeg_bin, '-y', '-i', orig_path] + ar_args + af_args + ['-ac', '2', '-c:a', pcm_codec, temp_wav], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        else:
            with open(temp_wav, 'wb') as out_f:
                shutil.copyfileobj(upload.file, out_f)
            if sr_mode in valid_srs or target_bits in (16, 24, 32):
                temp_sr_wav = temp_wav + ".sr.wav"
                ar_args = ['-ar', sr_mode] if sr_mode in valid_srs else []
                r_sr = subprocess.run([ffmpeg_bin, '-y', '-i', temp_wav] + ar_args + ['-ac', '2', '-c:a', pcm_codec, temp_sr_wav], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
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
            try:
                pr_meta = subprocess.run([ffmpeg_bin, '-hide_banner', '-i', orig_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=4)
                orig_tags = get_merged_track_tags_v74(original_name, (pr_meta.stderr or '') + (pr_meta.stdout or ''))
                orig_tags.pop('ENCODER', None)
                if orig_tags:
                    db_t = load_custom_tags_db_v74()
                    db_t[new_filename] = orig_tags
                    save_custom_tags_db_v74(db_t)
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
                            comp_chunk = xff.read(min(int(x_cm_sz), 65536))
                            if x_flags & 2:
                                decomp = lzma.LZMADecompressor()
                                raw_hdr = decomp.decompress(comp_chunk, max_length=512)
                            else:
                                raw_hdr = comp_chunk[:512]
                            x_sr = _extract_wav_sr_from_raw_meta_v156(raw_hdr)
                        except Exception:
                            pass
                        x_sr, x_bits, x_ch = _extract_wav_meta_from_raw_hdr_v157(raw_hdr if 'raw_hdr' in locals() else b'', x_flags)
                        if x_sr < 8000 or x_sr > 384000:
                            x_sr = 44100
                        tr_xf = read_jenny_rev_trailer(full_path)
                        xf_audio_bytes = int(tr_xf["audio_end"]) if (tr_xf and tr_xf.get("audio_end")) else size_bytes
                        wav_orig_bytes = int(x_nf) * x_ch * (x_bits // 8) + 44
                        dur_s = float(x_nf) / float(x_sr) if x_sr > 0 else 0.0
                        ratio_pct = (xf_audio_bytes * 100.0) / max(1, wav_orig_bytes)
                        eff_kbps = int((xf_audio_bytes * 8) / max(0.1, dur_s * 1000))
                        wav_eq_kbps = int((x_sr * x_ch * x_bits) / 1000)
                        mm, ss = int(dur_s // 60), dur_s % 60
                        hh, mm = int(mm // 60), int(mm % 60)
                        xflac_custom_meta = {
                            "container": f"XFLAC (XFC3 + LZMA2) [{ratio_pct:.1f}% от WAV {wav_orig_bytes/(1024*1024):.2f} MB]",
                            "codec": f"libxflac C++17 ({x_bits}-bit 21-tap Pitch-OLS + Psycho-LSB)",
                            "sr": f"{x_sr} Hz",
                            "ch": "mono (1 ch)" if x_ch == 1 else "stereo (2 ch)",
                            "fmt": f"s{x_bits}p ({x_bits}-bit Direct Time-Domain Wave)",
                            "dur_str": f"{hh:02d}:{mm:02d}:{ss:05.2f}",
                            "dur_s": dur_s,
                            "br": f"{eff_kbps} kb/s (WAV экв. {wav_eq_kbps} kb/s)",
                            "samples": f"{x_nf:,}".replace(",", " ")
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
        if dur_seconds <= 0 and os.path.isfile(full_path):
            try:
                pr_null = subprocess.run([ffmpeg_bin, '-hide_banner', '-i', full_path, '-vn', '-c:a', 'copy', '-f', 'null', '-'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=12)
                t_all = re.findall(r"time=(\d{2}):(\d{2}):(\d{2}\.\d+)", (pr_null.stderr or ""))
                if t_all:
                    hh, mm, ss = t_all[-1]
                    dur_seconds = int(hh) * 3600 + int(mm) * 60 + float(ss)
                    if dur_seconds > 0:
                        duration_str = f"{hh}:{mm}:{ss[:5]}"
            except Exception:
                pass

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
                elif any(p.startswith(fp) for fp in ('fltp', 'flt', 's16', 's24', 's32', 'dblp', 'u8')):
                    if '24 bit' in p or 'pcm_s24' in codec_str.lower():
                        fmt_str = 's24le (24-bit Signed Integer PCM)'
                    elif p.startswith('s16') or 'pcm_s16' in codec_str.lower():
                        fmt_str = 's16le (16-bit Signed Integer PCM)'
                    elif p.startswith('s32') or 'pcm_s32' in codec_str.lower():
                        fmt_str = 's32le (32-bit Signed Integer PCM)'
                    else:
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
    safe_alb = re.sub(r'[\\/:*?"<>|]+', '_', (album_title or 'Game OST')).strip()[:90]
    safe_trk = re.sub(r'[\\/:*?"<>|]+', '_', (track_title or 'Track')).strip()[:150]
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

        safe_st = re.sub(r'[\\/:*?"<>|\[\]]+', '_', _RADIO_REC_V91.get("station") or "Radio").strip()[:100]
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

# ☁️ JENNY V105: UNIFIED SOUNDCLOUD + GO TORRENT ENGINE (ZERO DUPLICATE ROUTES)
import http.cookiejar

_SC_CLIENT_ID_V92 = None
_SC_COOKIE_JAR_V95 = http.cookiejar.CookieJar()
_SC_DESKTOP_UA_V95 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
_SC_FALLBACK_IDS_V105 = [
    "iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX",
    "a3e059563d7fd3372b49b37f00a00bcf",
    "2t9loNQH90kzJcsFCODdigxfp325aq4z"
]
_SC_DL_STATE_V99 = {"active": False, "pct": 0, "title": ""}

def _sc_headers_v93():
    return {
        "User-Agent": _SC_DESKTOP_UA_V95,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
        "Referer": "https://soundcloud.com/",
        "Origin": "https://soundcloud.com"
    }

def _sc_urlopen_v95(url: str, timeout: int = 10):
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_SC_COOKIE_JAR_V95))
    req = urllib.request.Request(url, headers=_sc_headers_v93())
    return opener.open(req, timeout=timeout)

def _sc_get_client_id_v92(force_refresh: bool = False):
    global _SC_CLIENT_ID_V92
    if _SC_CLIENT_ID_V92 and not force_refresh:
        return _SC_CLIENT_ID_V92
    for page_u in ("https://soundcloud.com/discover", "https://soundcloud.com"):
        try:
            with _sc_urlopen_v95(page_u, timeout=8) as r:
                html = r.read().decode("utf-8", errors="ignore")
            scripts = re.findall(r'src="(https://a-v2\.sndcdn\.com/assets/[^"]+\.js)"', html)
            for s_url in reversed(scripts[-8:]):
                try:
                    with _sc_urlopen_v95(s_url, timeout=6) as sr:
                        js_txt = sr.read().decode("utf-8", errors="ignore")
                    m = re.search(r'client_id\s*[:=]\s*"([a-zA-Z0-9]{32})"', js_txt)
                    if m:
                        _SC_CLIENT_ID_V92 = m.group(1)
                        return _SC_CLIENT_ID_V92
                except Exception:
                    pass
        except Exception:
            pass
    for cand in _SC_FALLBACK_IDS_V105:
        try:
            with _sc_urlopen_v95(f"https://api-v2.soundcloud.com/search/tracks?q=test&client_id={cand}&limit=1", timeout=5) as r:
                if r.status == 200:
                    _SC_CLIENT_ID_V92 = cand
                    return cand
        except Exception:
            pass
    _SC_CLIENT_ID_V92 = _SC_FALLBACK_IDS_V105[0]
    return _SC_CLIENT_ID_V92

def _sc_sort_transcodings_v107(trans_list):
    ordered = []
    for tr in (trans_list or []):
        if tr.get("snipped"):
            continue
        tu = (tr.get("url") or "").strip()
        fmt = tr.get("format") or {}
        proto = (fmt.get("protocol") or "").lower()
        mime = (fmt.get("mime_type") or "").lower()
        preset = (tr.get("preset") or "").lower()
        quality = (tr.get("quality") or "").lower()
        # Отсекаем битые адаптивные плейлисты abr_sq (audio/mpegurl -> 404) и зашифрованные потоки
        if not tu or "encrypted" in proto or "mpegurl" in mime or preset.startswith("abr"):
            continue

        # Выстраиваем строгий рейтинг по реальному битрейту:
        # 0: HQ 256k | 1: aac_160k (160 kbps) | 2: mp3_1_0 (128 kbps) | 3: прочие sq | 4: aac_96k (lq) | 5: opus (64 kbps)
        if quality == "hq" or "256" in preset:
            tier = 0
        elif "160" in preset:
            tier = 1
        elif mime == "audio/mpeg" or preset.startswith("mp3"):
            tier = 2
        elif quality == "sq" and "opus" not in mime and "opus" not in preset:
            tier = 3
        elif "96" in preset or quality == "lq":
            tier = 4
        else:
            tier = 5

        prog_bonus = 0 if proto == "progressive" else 1
        ordered.append((tier, prog_bonus, tu, preset))
    ordered.sort(key=lambda x: (x[0], x[1]))
    return [x[2] for x in ordered]

@post('/api/soundcloud/search')
def api_soundcloud_search_v105():
    response.content_type = 'application/json'
    try:
        req = json.loads(request.body.read().decode('utf-8') or "{}")
        q = (req.get("query") or "").strip()
        if not q:
            return json.dumps({"status": "error", "error": "Введите запрос"})
        cid = _sc_get_client_id_v92(False)
        u = f"https://api-v2.soundcloud.com/search/tracks?q={urllib.parse.quote(q)}&client_id={cid}&limit=35"
        try:
            with _sc_urlopen_v95(u, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
        except Exception:
            cid = _sc_get_client_id_v92(True)
            u2 = f"https://api-v2.soundcloud.com/search/tracks?q={urllib.parse.quote(q)}&client_id={cid}&limit=35"
            with _sc_urlopen_v95(u2, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))

        tracks = []
        for item in (data.get("collection") or []):
            trans = (item.get("media") or {}).get("transcodings") or []
            urls_list = _sc_sort_transcodings_v107(trans)
            if not urls_list:
                continue

            idx = len(tracks) + 1
            dur_s = int(item.get("duration") or 0) // 1000
            art = (item.get("user") or {}).get("username") or "SoundCloud"
            title = item.get("title") or f"Track {idx}"
            full_t = f"{art} — {title}" if art.lower() not in title.lower() else title
            pack_str = json.dumps({
                "id": item.get("id"),
                "auth": item.get("track_authorization") or "",
                "permalink": item.get("permalink_url") or "",
                "urls": urls_list
            }, ensure_ascii=False)
            b64_p = "sc:" + base64.urlsafe_b64encode(pack_str.encode("utf-8")).decode("ascii")
            ex = _ost_find_existing_track_v89("SoundCloud", idx, full_t)
            tracks.append({
                "index": idx, "title": full_t,
                "duration": f"{dur_s // 60}:{dur_s % 60:02d}",
                "mp3_size": "AAC 160k / MP3", "page_path": b64_p,
                "downloaded": ex["exists"], "local_ext": ex["ext"], "local_size_mb": ex["size_mb"]
            })
        return json.dumps({"status": "ok", "tracks": tracks}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "ok", "tracks": [], "err": str(e)}, ensure_ascii=False)

def _sc_resolve_direct_url_v92(page_path: str) -> str:
    raw_dec = base64.urlsafe_b64decode(page_path[3:].encode("ascii")).decode("utf-8")
    urls_to_try, t_auth, track_id = [], "", None
    if raw_dec.startswith("{"):
        info = json.loads(raw_dec)
        urls_to_try = list(info.get("urls") or [])
        t_auth = info.get("auth") or ""
        track_id = info.get("id")
    else:
        urls_to_try = [raw_dec]

    for force_new in (False, True):
        cid = _sc_get_client_id_v92(force_new)
        if force_new and track_id:
            for info_ep in (
                f"https://api-v2.soundcloud.com/tracks/{track_id}?client_id={cid}",
                f"https://api-widget.soundcloud.com/tracks/{track_id}?client_id={cid}&format=json"
            ):
                try:
                    with _sc_urlopen_v95(info_ep, timeout=7) as r_tr:
                        tr_obj = json.loads(r_tr.read().decode("utf-8", errors="replace"))
                    t_auth = tr_obj.get("track_authorization") or t_auth
                    fresh_sorted = _sc_sort_transcodings_v107((tr_obj.get("media") or {}).get("transcodings") or [])
                    if fresh_sorted:
                        urls_to_try = fresh_sorted
                except Exception:
                    pass

        for api_u in urls_to_try:
            sep = "&" if "?" in api_u else "?"
            cands = []
            if t_auth:
                cands.append(f"{api_u}{sep}client_id={cid}&track_authorization={urllib.parse.quote(t_auth)}")
            cands.append(f"{api_u}{sep}client_id={cid}")
            for full_u in cands:
                try:
                    with _sc_urlopen_v95(full_u, timeout=8) as resp:
                        j = json.loads(resp.read().decode("utf-8", errors="replace"))
                    if j.get("url"):
                        return j["url"]
                except Exception:
                    continue
    raise RuntimeError("SoundCloud не отдал поток для этого трека (попробуй соседний)")

def _clean_concatenated_hls_mp3_bytes_v102(raw_bytes: bytes) -> bytes:
    out = bytearray()
    i, n = 0, len(raw_bytes)
    while i < n:
        idx = raw_bytes.find(b'ID3', i)
        if idx == -1:
            out.extend(raw_bytes[i:])
            break
        if idx + 10 <= n and raw_bytes[idx+3] in (2, 3, 4) and raw_bytes[idx+4] == 0 and all((b & 0x80) == 0 for b in raw_bytes[idx+6:idx+10]):
            out.extend(raw_bytes[i:idx])
            b6, b7, b8, b9 = raw_bytes[idx+6], raw_bytes[idx+7], raw_bytes[idx+8], raw_bytes[idx+9]
            tag_len = 10 + ((b6 & 0x7F) << 21) + ((b7 & 0x7F) << 14) + ((b8 & 0x7F) << 7) + (b9 & 0x7F)
            if idx + tag_len <= n:
                i = idx + tag_len
                continue
        out.extend(raw_bytes[i:idx+3])
        i = idx + 3
    return bytes(out)

def _mux_clean_sc_stream_v107(src_file: str, base_dst_no_ext: str):
    with open(src_file, "rb") as f:
        head = f.read(64)

    ff_bin = find_ffmpeg_binary()
    is_fmp4 = (b'ftyp' in head or b'moov' in head or b'styp' in head)
    is_ogg = (head[:4] == b'OggS')

    if is_fmp4:
        # Сохраняем 160 kbps AAC в родной контейнер .m4a со 100% сохранением качества (без пережатия!)
        final_path = base_dst_no_ext + ".m4a"
        tmp_out = final_path + f".tmp_{os.getpid()}.m4a"
        try:
            subprocess.run(
                [ff_bin, '-y', '-i', src_file, '-vn', '-c:a', 'copy', '-movflags', '+faststart', tmp_out],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60
            )
            if os.path.isfile(tmp_out) and os.path.getsize(tmp_out) >= 16384:
                shutil.move(tmp_out, final_path)
                return final_path, "M4A"
        finally:
            if os.path.exists(tmp_out):
                try: os.remove(tmp_out)
                except Exception: pass

    if is_ogg:
        final_path = base_dst_no_ext + ".opus"
        shutil.move(src_file, final_path)
        return final_path, "OPUS"

    # Если поток — классический MP3
    final_path = base_dst_no_ext + ".mp3"
    tmp_out = final_path + f".tmp_{os.getpid()}.mp3"
    try:
        with open(src_file, "rb") as f:
            clean_b = _clean_concatenated_hls_mp3_bytes_v102(f.read())
        with open(src_file, "wb") as f:
            f.write(clean_b)
        subprocess.run(
            [ff_bin, '-y', '-i', src_file, '-vn', '-c:a', 'copy', '-write_xing', '1', tmp_out],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60
        )
        if not os.path.isfile(tmp_out) or os.path.getsize(tmp_out) < 16384:
            subprocess.run(
                [ff_bin, '-y', '-i', src_file, '-vn', '-ar', '44100', '-ac', '2', '-b:a', '192k', '-write_xing', '1', tmp_out],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90
            )
        if os.path.isfile(tmp_out) and os.path.getsize(tmp_out) >= 16384:
            shutil.move(tmp_out, final_path)
        elif src_file != final_path:
            shutil.move(src_file, final_path)
        return final_path, "MP3"
    finally:
        if os.path.exists(tmp_out):
            try: os.remove(tmp_out)
            except Exception: pass

@post('/api/soundcloud/download_track')
def api_soundcloud_download_track_v105():
    response.content_type = 'application/json'
    tmp_raw = os.path.join(MUSIC_DIR, f"temp_final_sc_{os.getpid()}.stream")
    try:
        load_multi_dirs_v71()
        req = json.loads(request.body.read().decode('utf-8') or "{}")
        page_path = (req.get("page_path") or "").strip()
        track_title = (req.get("track_title") or "Track").strip()
        track_num = int(req.get("track_num") or 1)
        _SC_DL_STATE_V99.update({"active": True, "pct": 4, "title": track_title})

        stream_u = _sc_resolve_direct_url_v92(page_path)
        os.makedirs(MUSIC_DIR, exist_ok=True)
        with _sc_urlopen_v95(stream_u, timeout=20) as r:
            first_b = r.read(16384)
            if first_b.lstrip().startswith(b"#EXTM3U") or ".m3u8" in stream_u.lower():
                m3u8_txt = (first_b + r.read()).decode("utf-8", errors="ignore")
                seg_urls = []
                for ln in m3u8_txt.splitlines():
                    s_ln = ln.strip()
                    if s_ln.startswith("#EXT-X-MAP:"):
                        m_map = re.search(r'URI="([^"]+)"', s_ln)
                        if m_map and m_map.group(1).startswith("http"):
                            seg_urls.append(m_map.group(1))
                    elif s_ln.startswith("http"):
                        seg_urls.append(s_ln)
                tot_s = max(1, len(seg_urls))
                with open(tmp_raw, "wb") as out_f:
                    for idx_s, su in enumerate(seg_urls, 1):
                        with _sc_urlopen_v95(su, timeout=15) as sr:
                            out_f.write(sr.read())
                        _SC_DL_STATE_V99["pct"] = min(88, max(5, int((idx_s * 85) / tot_s)))
            else:
                tot_b = int(r.headers.get("Content-Length") or 0)
                done_b = len(first_b)
                with open(tmp_raw, "wb") as out_f:
                    out_f.write(first_b)
                    while True:
                        chunk = r.read(65536)
                        if not chunk:
                            break
                        out_f.write(chunk)
                        done_b += len(chunk)
                        if tot_b > 0:
                            _SC_DL_STATE_V99["pct"] = min(88, int((done_b * 85) / tot_b))

        _SC_DL_STATE_V99["pct"] = 92
        safe_t = re.sub(r'[\\/:*?"<>|\[\]]+', '_', track_title).strip()[:160]
        base_dst = os.path.join(MUSIC_DIR, f"SoundCloud - {track_num:02d}. {safe_t}")
        final_path, ext_label = _mux_clean_sc_stream_v107(tmp_raw, base_dst)
        final_name = os.path.basename(final_path)

        db = load_custom_tags_db_v74()
        db[final_name] = {"TITLE": track_title, "ARTIST": "SoundCloud", "ALBUM": "SoundCloud Stream", "GENRE": "SoundCloud"}
        save_custom_tags_db_v74(db)
        TRACK_META_CACHE_V71.pop(final_path, None)
        sz_mb = round(os.path.getsize(final_path) / (1024.0 * 1024.0), 2)
        _SC_DL_STATE_V99["pct"] = 100
        return json.dumps({"status": "ok", "filename": final_name, "size_mb": sz_mb, "ext": ext_label})
    except Exception as e:
        response.status = 500
        return json.dumps({"status": "error", "error": str(e)})
    finally:
        _SC_DL_STATE_V99["active"] = False
        _SC_DL_STATE_V99["pct"] = 0
        if os.path.exists(tmp_raw):
            try: os.remove(tmp_raw)
            except Exception: pass

# ==============================================================================
# 🧲 GO TORRENT ENGINE BRIDGE (libjtorrent.so + MULTI-FORMAT TAGS + XFLAC PROGRESS)
# ==============================================================================
_JTORRENT_PROC_V96 = None
_JTORRENT_PORT_V96 = "18081"
_JTORRENT_CONVERTED_V96 = {}
_TOR_IMPORT_LOCK_V98 = threading.Lock()
_TOR_ENC_PROGRESS_V99 = {
    "active": False, "current_key": "", "current_track": "",
    "track_pct": 0, "done_count": 0, "total_count": 0, "overall_pct": 0
}

def _recalc_tor_enc_overall_v99():
    tot = max(1, _TOR_ENC_PROGRESS_V99.get("total_count", 0))
    done = _TOR_ENC_PROGRESS_V99.get("done_count", 0)
    tp = _TOR_ENC_PROGRESS_V99.get("track_pct", 0)
    _TOR_ENC_PROGRESS_V99["overall_pct"] = min(100, int(((done * 100) + tp) / tot))

def find_jtorrent_binary_v96():
    cands = []
    ff_dir = os.path.dirname(find_ffmpeg_binary())
    if ff_dir:
        cands.append(os.path.join(ff_dir, "libjtorrent.so"))
    for env_k in ("JENNY_NATIVE_DIR", "PATH", "LD_LIBRARY_PATH"):
        for d in os.environ.get(env_k, "").split(":"):
            if d:
                cands.append(os.path.join(d, "libjtorrent.so"))
    cands.append(os.path.abspath(os.path.join(BASE_DIR, "..", "jniLibs", "arm64-v8a", "libjtorrent.so")))

    for cand in cands:
        if cand and os.path.isfile(cand):
            # Если бинарник лежит на /storage/ (где стоит флаг noexec), копируем его в исполняемый каталог
            if cand.startswith("/storage/"):
                import tempfile
                exec_dir = os.environ.get("JENNY_FILES_DIR") or tempfile.gettempdir()
                if exec_dir and os.path.isdir(exec_dir):
                    exec_bin = os.path.join(exec_dir, "libjtorrent_exec.so")
                    try:
                        if not os.path.isfile(exec_bin) or os.path.getsize(exec_bin) != os.path.getsize(cand):
                            shutil.copy2(cand, exec_bin)
                        os.chmod(exec_bin, 0o755)
                        return exec_bin
                    except Exception:
                        pass
            return cand
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
    try:
        os.chmod(bin_p, 0o755)
    except Exception:
        pass
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

# Запускаем Go-демон заранее при старте сервера, чтобы DHT-таблица успела набрать пиров!
threading.Thread(target=ensure_jtorrent_daemon_v96, daemon=True).start()

# ==============================================================================
# 🧠 JENNY V124: ISOLATED CRASH-PROOF OMNITORRENT DAEMON BRIDGE (127.0.0.1:18999)
# ==============================================================================
_OMNI_PORT_V124 = "18998"
_OMNI_URL_V124 = f"http://127.0.0.1:{_OMNI_PORT_V124}"
_OMNI_PROC_V124 = None
_OMNI_LOCK_V124 = threading.Lock()

def find_omnitorrent_binary_v124():
    cand = None
    ff_dir = os.path.dirname(find_ffmpeg_binary())
    if ff_dir and os.path.isfile(os.path.join(ff_dir, "libomnitorrent.so")):
        cand = os.path.join(ff_dir, "libomnitorrent.so")
    if not cand:
        for env_k in ("JENNY_NATIVE_DIR", "PATH", "LD_LIBRARY_PATH"):
            for d in os.environ.get(env_k, "").split(":"):
                if d and os.path.isfile(os.path.join(d, "libomnitorrent.so")):
                    cand = os.path.join(d, "libomnitorrent.so")
                    break
            if cand:
                break
    if not cand:
        local_so = os.path.join(BASE_DIR, "..", "jniLibs", "arm64-v8a", "libomnitorrent.so")
        if os.path.isfile(local_so):
            cand = os.path.abspath(local_so)
    if not cand and os.path.isfile("/data/data/com.termux/files/home/omnibuild/libomnitorrent.so"):
        cand = "/data/data/com.termux/files/home/omnibuild/libomnitorrent.so"
    if not cand:
        return "libomnitorrent.so"

    if cand.startswith(("/storage/", "/sdcard/")) and os.path.isfile(cand):
        for exec_dir in (
            os.environ.get("JENNY_FILES_DIR", ""),
            "/data/data/com.termux/files/usr/tmp",
            os.path.expanduser("~")
        ):
            if exec_dir and os.path.isdir(exec_dir):
                cached_bin = os.path.join(exec_dir, "libomnitorrent_exec.so")
                try:
                    if not os.path.isfile(cached_bin) or int(os.path.getmtime(cached_bin)) != int(os.path.getmtime(cand)):
                        shutil.copy2(cand, cached_bin)
                    os.chmod(cached_bin, 0o755)
                    return cached_bin
                except Exception:
                    continue
    return cand

def ensure_omnitorrent_daemon_v124():
    global _OMNI_PROC_V124
    try:
        with urllib.request.urlopen(f"{_OMNI_URL_V124}/health", timeout=0.35) as r:
            if r.status == 200:
                return True
    except Exception:
        pass

    with _OMNI_LOCK_V124:
        try:
            with urllib.request.urlopen(f"{_OMNI_URL_V124}/health", timeout=0.25) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass
        try:
            bin_p = find_omnitorrent_binary_v124()
            try:
                os.chmod(bin_p, 0o755)
            except Exception:
                pass
            _OMNI_PROC_V124 = subprocess.Popen(
                [bin_p, "--serve", f"127.0.0.1:{_OMNI_PORT_V124}"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            for _ in range(15):
                time.sleep(0.08)
                try:
                    with urllib.request.urlopen(f"{_OMNI_URL_V124}/health", timeout=0.25) as r:
                        if r.status == 200:
                            return True
                except Exception:
                    continue
        except Exception as e:
            print("OmniTorrent daemon start error:", e)
    return False

threading.Thread(target=ensure_omnitorrent_daemon_v124, daemon=True).start()

def _enrich_omni_response_trackers_v124(data_dict: dict) -> dict:
    if "enrich_magnet_with_cached_trackers_v109" not in globals():
        return data_dict
    for item in (data_dict.get("results") or []):
        if item.get("magnet"):
            item["magnet"] = enrich_magnet_with_cached_trackers_v109(item["magnet"])
    for grp in (data_dict.get("groups") or []):
        for item in (grp.get("results") or []):
            if item.get("magnet"):
                item["magnet"] = enrich_magnet_with_cached_trackers_v109(item["magnet"])
    return data_dict

@route('/api/torrent/config', method=['GET'])
def api_torrent_config_v125():
    response.content_type = 'application/json'
    return json.dumps({"status": "ok", "config": OMNI_TORRENT_CONFIG}, ensure_ascii=False)

@post('/api/torrent/search')
def api_torrent_search_v105():
    response.content_type = 'application/json'
    try:
        req = json.loads(request.body.read().decode('utf-8') or "{}")
        q = (req.get("query") or "").strip()
        if not q:
            return json.dumps({"status": "error", "error": "Пустой запрос"})

        ensure_omnitorrent_daemon_v124()

        cfg = globals().get("OMNI_TORRENT_CONFIG", {})
        fmt_tag = (req.get("format_tag") or cfg.get("default_format_tag", "all")).strip().lower()
        year_val = str(req.get("year") if req.get("year") is not None else cfg.get("default_year", "")).strip()
        # Оставляем в году только цифры (например "2003")
        year_clean = "".join(ch for ch in year_val if ch.isdigit())[:4]

        payload = json.dumps({
            "query": q,
            "force_new": bool(req.get("force_new", False)),
            "format_tag": fmt_tag,
            "year": year_clean,
            "profile": str(req.get("profile") or cfg.get("profile", "audio")).strip().lower(),
            "enable_phonetic": bool(req.get("enable_phonetic", cfg.get("enable_phonetic", True))),
            "enable_catalog": bool(req.get("enable_catalog", cfg.get("enable_catalog", True))),
            "enable_udp": bool(req.get("enable_udp", cfg.get("enable_udp", True))),
            "exact": bool(req.get("exact", False)),
            "hide_zero": bool(req.get("hide_zero", True)),
            "min_two_seeds": bool(req.get("min_two_seeds", False)),
            "max_results": 60,
            "timeout_ms": int(req.get("timeout_ms") or cfg.get("timeout_ms", 10000))
        }, ensure_ascii=False).encode("utf-8")

        http_req = urllib.request.Request(
            f"{_OMNI_URL_V124}/search",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        http_timeout = float(cfg.get("http_timeout_sec", 20.0))
        with urllib.request.urlopen(http_req, timeout=http_timeout) as r:
            raw_json = r.read().decode("utf-8", errors="replace")

        parsed = json.loads(raw_json)
        parsed = _enrich_omni_response_trackers_v124(parsed)
        return json.dumps(parsed, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

# === 🌐 JENNY V110: SERVICE AUTH STORAGE + TRACKERS MANAGER (DIFF REPORT & 24H AUTO-SYNC) ===
import socket
from concurrent.futures import ThreadPoolExecutor

TRACKERS_CACHE_FILE_V109 = os.path.join(DEFAULT_MUSIC_DIR, "jenny_trackers_cache.json")
SOURCES_AUTH_FILE_V110 = os.path.join(DEFAULT_MUSIC_DIR, "jenny_sources_auth.json")

_DEFAULT_SOURCES_AUTH_V110 = {
    "sc_oauth_token": "",
    "sc_client_id": "",
    "ia_s3_keys": "",
    "ia_cookie": "",
    "tor_passkey": ""
}

def load_sources_auth_v110():
    data = dict(_DEFAULT_SOURCES_AUTH_V110)
    if os.path.exists(SOURCES_AUTH_FILE_V110):
        try:
            with open(SOURCES_AUTH_FILE_V110, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            if isinstance(loaded, dict):
                for k in _DEFAULT_SOURCES_AUTH_V110:
                    if k in loaded and loaded[k] is not None:
                        data[k] = str(loaded[k]).strip()
        except Exception:
            pass
    return data

def save_sources_auth_v110(new_data: dict):
    cur = load_sources_auth_v110()
    for k in _DEFAULT_SOURCES_AUTH_V110:
        if k in new_data and new_data[k] is not None:
            cur[k] = str(new_data[k]).strip()
    try:
        os.makedirs(os.path.dirname(SOURCES_AUTH_FILE_V110), exist_ok=True)
        with open(SOURCES_AUTH_FILE_V110, "w", encoding="utf-8") as f:
            json.dump(cur, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
    # Если задан пользовательский client_id для SoundCloud — сразу активируем его
    if cur.get("sc_client_id"):
        global _SC_CLIENT_ID_V92
        _SC_CLIENT_ID_V92 = cur["sc_client_id"]
    return cur

# Подключаем сохранённую авторизацию к заголовкам SoundCloud и Archive.org
def _sc_headers_v93():
    auth = load_sources_auth_v110()
    hdrs = {
        "User-Agent": _SC_DESKTOP_UA_V95,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
        "Referer": "https://soundcloud.com/",
        "Origin": "https://soundcloud.com"
    }
    tok = auth.get("sc_oauth_token", "").strip()
    if tok:
        if "=" in tok or ";" in tok:
            hdrs["Cookie"] = tok
            m_tok = re.search(r'oauth_token=([^;\s]+)', tok)
            if m_tok:
                hdrs["Authorization"] = f"OAuth {m_tok.group(1)}"
        else:
            clean_t = tok.replace("OAuth ", "").strip()
            hdrs["Authorization"] = f"OAuth {clean_t}"
            hdrs["Cookie"] = f"oauth_token={clean_t}"
    return hdrs

def _ost_headers_with_auth_v110():
    auth = load_sources_auth_v110()
    hdrs = dict(OST_HEADERS)
    s3 = auth.get("ia_s3_keys", "").strip()
    iac = auth.get("ia_cookie", "").strip()
    if s3:
        hdrs["Authorization"] = f"LOW {s3}" if not s3.lower().startswith("low ") else s3
    if iac:
        hdrs["Cookie"] = iac
    return hdrs

def _ost_fetch_json_v88(url: str, timeout: int = 18):
    req = urllib.request.Request(url, headers=_ost_headers_with_auth_v110())
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))

@route('/api/sources/auth', method=['GET', 'POST'])
def api_sources_auth_v110():
    response.content_type = 'application/json'
    if request.method == 'GET':
        return json.dumps({"status": "ok", "auth": load_sources_auth_v110()}, ensure_ascii=False)
    try:
        req = json.loads(request.body.read().decode("utf-8") or "{}")
        if "key" in req and "value" in req:
            saved = save_sources_auth_v110({req["key"]: req["value"]})
        elif "auth" in req and isinstance(req["auth"], dict):
            saved = save_sources_auth_v110(req["auth"])
        else:
            saved = save_sources_auth_v110(req)
        return json.dumps({"status": "ok", "auth": saved}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

@post('/api/soundcloud/save_auth')
def api_sc_save_auth_compat_v110():
    response.content_type = 'application/json'
    try:
        req = json.loads(request.body.read().decode("utf-8") or "{}")
        upd = {}
        if "cookie" in req: upd["sc_oauth_token"] = req["cookie"]
        if "client_id" in req: upd["sc_client_id"] = req["client_id"]
        saved = save_sources_auth_v110(upd)
        return json.dumps({"status": "ok", "auth": saved})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

_FLUD_BASE_TRACKERS_V109 = [
    "udp://tracker.opentrackr.org:1337/announce",
    "http://tracker.opentrackr.org:1337/announce",
    "udp://open.stealth.si:80/announce",
    "udp://tracker.torrent.eu.org:451/announce",
    "udp://open.demonii.com:1337/announce",
    "udp://exodus.desync.com:6969/announce",
    "udp://tracker.openbittorrent.com:6969/announce",
    "udp://tracker.skynetcloud.site:6969/announce",
    "udp://tracker.qu.ax:6969/announce",
    "http://tracker.qu.ax:6969/announce",
    "udp://tracker.tryhackx.org:6969/announce",
    "udp://explodie.org:6969/announce",
    "udp://tracker.nyaa.vc:6969/announce",
    "udp://tracker.corpscorp.online:80/announce",
    "udp://tracker.bittor.pw:1337/announce",
    "udp://retracker01-msk-virt.corbina.net:80/announce",
    "udp://tracker-udp.gbitt.info:80/announce",
    "udp://tracker2.dler.org:80/announce",
    "http://tracker2.dler.org:80/announce",
    "http://tracker.dler.org:6969/announce",
    "http://tracker.dler.com:6969/announce",
    "udp://tracker.gmi.gd:6969/announce",
    "udp://tracker.dler.org:6969/announce",
    "udp://tracker.ducks.party:1984/announce",
    "http://tracker.renfei.net:8080/announce",
    "udp://tracker.farted.net:6969/announce",
    "udp://tracker.peerfect.org:6969/announce",
    "udp://tracker.opentrackr.com:6969/announce",
    "udp://tracker.ilibr.org:6969/announce",
    "udp://mail.segso.net:6969/announce",
    "udp://bittorrent-tracker.e-n-c-r-y-p-t.net:1337/announce",
    "http://bittorrent-tracker.e-n-c-r-y-p-t.net:1337/announce",
    "udp://t.overflow.biz:6969/announce",
    "http://t.overflow.biz:6969/announce",
    "https://tracker.pmman.tech:443/announce",
    "udp://ipv4announce.sktorrent.eu:6969/announce",
    "http://ipv4announce.sktorrent.eu:6969/announce",
    "udp://tracker.004430.xyz:1337/announce",
    "https://tracker.nekomi.cn:443/announce",
    "https://004430.xyz:443/announce",
    "http://004430.xyz:80/announce",
    "udp://evan.im:6969/announce",
    "udp://tr4ck3r.duckdns.org:6969/announce",
    "udp://tracker.wildkat.net:6969/announce",
    "udp://tracker.filemail.com:6969/announce",
    "udp://ns575949.ip-51-222-82.net:6969/announce",
    "udp://martin-gebhardt.eu:25/announce",
    "https://tracker.zhuqiy.com:443/announce",
    "http://tracker.mywaifu.best:6969/announce",
    "http://tracker.dhitechnical.com:6969/announce",
    "http://open.tracker.cl:1337/announce",
    "udp://seedpeer.net:6969/announce",
    "udp://open.ftorrent.com:443/announce",
    "https://tracker.7471.top:443/announce",
    "https://tr.nyacat.pw:443/announce",
    "http://tracker.waaa.moe:6969/announce",
    "http://tr.nyacat.pw:80/announce",
    "udp://admin.52ywp.com:6969/announce",
    "https://open.ftorrent.com:443/announce",
    "udp://tracker.nyaa.net:6969/announce",
    "udp://tracker.cn.nyaa.net:6969/announce",
    "udp://tracker.aruku.ovh:8081/announce",
    "udp://tr3.ysagin.top:2715/announce",
    "udp://anime-tracker.aruku.kro.kr:8081/announce",
    "https://tracker.foreverpirates.co:443/announce",
    "udp://tracker.torrents.observer:80/announce",
    "udp://tracker.k.vu:6969/announce",
    "udp://tr.btube3.com:2010/announce",
    "udp://kolankoalastree.newtrackon.co.nz:1337/announce",
    "http://tracker.zhuqiy.dgj055.icu:80/announce",
    "http://1337.abcvg.info:80/announce",
    "udp://yuptracker-eu.gaijinent.com:27022/announce",
    "udp://tracker.playground.ru:6969/announce",
    "udp://tracker.ddunlimited.net:6969/announce",
    "udp://edgev.duckdns.org:6969/announce",
    "udp://archive.torrentonline.cc:42069/announce",
    "https://t.213891.xyz:443/announce"
]

_LIVE_TRACKERS_URLS_V109 = [
    "https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt",
    "https://newtrackon.com/api/stable",
    "https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_all.txt"
]

_TRACKERS_MEM_V109 = {
    "list": None,
    "last_sync": 0.0,
    "auto_update": True,
    "lock": threading.Lock()
}

def _load_trackers_state_v110():
    if _TRACKERS_MEM_V109["list"] is not None:
        return _TRACKERS_MEM_V109["list"], _TRACKERS_MEM_V109["last_sync"], _TRACKERS_MEM_V109["auto_update"]
    if os.path.exists(TRACKERS_CACHE_FILE_V109):
        try:
            with open(TRACKERS_CACHE_FILE_V109, "r", encoding="utf-8") as f:
                d = json.load(f)
            t_list = d.get("trackers")
            last_s = float(d.get("last_sync") or 0.0)
            auto_u = bool(d.get("auto_update", True))
            if isinstance(t_list, list) and len(t_list) > 0:
                _TRACKERS_MEM_V109["list"] = t_list
                _TRACKERS_MEM_V109["last_sync"] = last_s
                _TRACKERS_MEM_V109["auto_update"] = auto_u
                return t_list, last_s, auto_u
        except Exception:
            pass
    _TRACKERS_MEM_V109["list"] = list(_FLUD_BASE_TRACKERS_V109)
    _TRACKERS_MEM_V109["last_sync"] = 0.0
    _TRACKERS_MEM_V109["auto_update"] = True
    return _TRACKERS_MEM_V109["list"], 0.0, True

def _save_trackers_state_v110(t_list, last_sync, auto_update):
    _TRACKERS_MEM_V109["list"] = list(t_list)
    _TRACKERS_MEM_V109["last_sync"] = float(last_sync)
    _TRACKERS_MEM_V109["auto_update"] = bool(auto_update)
    try:
        os.makedirs(os.path.dirname(TRACKERS_CACHE_FILE_V109), exist_ok=True)
        with open(TRACKERS_CACHE_FILE_V109, "w", encoding="utf-8") as f:
            json.dump({
                "last_sync": _TRACKERS_MEM_V109["last_sync"],
                "auto_update": _TRACKERS_MEM_V109["auto_update"],
                "trackers": _TRACKERS_MEM_V109["list"]
            }, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def _check_tracker_host_alive_v110(tr_url: str) -> bool:
    try:
        p = urllib.parse.urlparse(tr_url)
        host = p.hostname
        port = p.port or (443 if p.scheme == "https" else 80)
        if not host:
            return False
        # Проверяем DNS-разрешение (мёртвые домены .xyz/.top/.icu сразу отсеиваются)
        ips = socket.getaddrinfo(host, port, socket.AF_UNSPEC, socket.SOCK_DGRAM if p.scheme == "udp" else socket.SOCK_STREAM)
        if not ips:
            return False
        if p.scheme in ("http", "https"):
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1.2)
            try:
                s.connect((ips[0][4][0], port))
            finally:
                s.close()
        return True
    except Exception:
        return False

def perform_trackers_update_with_diff_v110(force=False):
    with _TRACKERS_MEM_V109["lock"]:
        old_list, last_sync, auto_update = _load_trackers_state_v110()
        now = time.time()

        if not force:
            if not auto_update:
                return {
                    "status": "ok", "updated": False, "auto_update": False,
                    "count": len(old_list), "trackers": old_list, "added": [], "outdated": []
                }
            if last_sync > 0 and (now - last_sync) < 86400:
                rem_h = round((86400 - (now - last_sync)) / 3600.0, 1)
                return {
                    "status": "ok", "updated": False, "auto_update": auto_update,
                    "count": len(old_list), "next_in_hours": rem_h,
                    "trackers": old_list, "added": [], "outdated": []
                }

        # 1. Загружаем свежие списки из ngosang и newTrackon
        online_live = []
        online_set = set()
        for u in _LIVE_TRACKERS_URLS_V109:
            try:
                req = urllib.request.Request(u, headers=OST_HEADERS)
                with urllib.request.urlopen(req, timeout=5) as r:
                    txt = r.read().decode("utf-8", errors="ignore")
                for line in txt.splitlines():
                    tr = line.strip()
                    if tr and tr.startswith(("udp://", "http://", "https://")) and tr not in online_set:
                        online_set.add(tr)
                        online_live.append(tr)
            except Exception:
                pass

        if not online_live:
            return {
                "status": "error",
                "error": "Не удалось связаться с серверами списков трекеров (проверь сеть)",
                "trackers": old_list, "count": len(old_list), "added": [], "outdated": []
            }

        old_set = set(old_list)
        added_trackers = [tr for tr in online_live if tr not in old_set]

        # 2. Проверяем трекеры из старого списка, которых нет в свежих онлайн-радарах:
        # если домен/порт больше не резолвится или не отвечает — помечаем как устаревший!
        candidates_to_check = [tr for tr in old_list if tr not in online_set]
        outdated_set = set()
        if candidates_to_check:
            with ThreadPoolExecutor(max_workers=20) as ex:
                results = list(ex.map(_check_tracker_host_alive_v110, candidates_to_check))
            for tr, is_alive in zip(candidates_to_check, results):
                if not is_alive:
                    outdated_set.add(tr)

        outdated_trackers = [tr for tr in old_list if tr in outdated_set]

        # 3. Формируем обновлённый список: живые из старого списка + новые из онлайн-баз
        new_merged = []
        seen_new = set()
        for tr in old_list:
            if tr not in outdated_set and tr not in seen_new:
                seen_new.add(tr)
                new_merged.append(tr)
        for tr in added_trackers:
            if tr not in seen_new:
                seen_new.add(tr)
                new_merged.append(tr)

        _save_trackers_state_v110(new_merged, now, auto_update)
        return {
            "status": "ok",
            "updated": True,
            "auto_update": auto_update,
            "last_sync": now,
            "count": len(new_merged),
            "trackers": new_merged,
            "added": added_trackers,
            "outdated": outdated_trackers
        }

def enrich_magnet_with_cached_trackers_v109(magnet_uri: str) -> str:
    if not magnet_uri or not magnet_uri.lower().startswith("magnet:?"):
        return magnet_uri
    cur_list, _, _ = _load_trackers_state_v110()
    auth = load_sources_auth_v110()
    passkey = auth.get("tor_passkey", "").strip()
    existing_low = magnet_uri.lower()
    extra = []
    for tr in cur_list:
        final_tr = f"{tr}?passkey={urllib.parse.quote(passkey)}" if (passkey and "?" not in tr) else tr
        q_tr = urllib.parse.quote(final_tr)
        if q_tr.lower() not in existing_low and final_tr.lower() not in existing_low:
            extra.append(f"&tr={q_tr}")
    return magnet_uri + "".join(extra)

@route('/api/torrent/trackers', method=['GET', 'POST'])
def api_torrent_trackers_manage_v110():
    response.content_type = 'application/json'
    if request.method == 'GET':
        t_list, last_s, auto_u = _load_trackers_state_v110()
        return json.dumps({
            "status": "ok",
            "trackers": t_list,
            "count": len(t_list),
            "last_sync": last_s,
            "auto_update": auto_u
        }, ensure_ascii=False)
    try:
        req = json.loads(request.body.read().decode("utf-8") or "{}")
        act = (req.get("action") or "save").strip()
        t_list, last_s, auto_u = _load_trackers_state_v110()

        if "auto_update" in req:
            auto_u = bool(req["auto_update"])

        if act == "reset_flud":
            _save_trackers_state_v110(list(_FLUD_BASE_TRACKERS_V109), last_s, auto_u)
            return json.dumps({
                "status": "ok",
                "trackers": _FLUD_BASE_TRACKERS_V109,
                "count": len(_FLUD_BASE_TRACKERS_V109),
                "auto_update": auto_u
            }, ensure_ascii=False)

        if "trackers" in req:
            raw_in = req["trackers"]
            if isinstance(raw_in, str):
                lines = raw_in.splitlines()
            elif isinstance(raw_in, list):
                lines = [str(x) for x in raw_in]
            else:
                lines = []
            cleaned = []
            seen = set()
            for ln in lines:
                s = ln.strip()
                if s and s.startswith(("udp://", "http://", "https://")) and s not in seen:
                    seen.add(s)
                    cleaned.append(s)
            t_list = cleaned

        _save_trackers_state_v110(t_list, last_s, auto_u)
        return json.dumps({
            "status": "ok",
            "trackers": t_list,
            "count": len(t_list),
            "last_sync": last_s,
            "auto_update": auto_u
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

@post('/api/torrent/sync_trackers')
def api_torrent_sync_trackers_v109():
    response.content_type = 'application/json'
    try:
        req = json.loads(request.body.read().decode("utf-8") or "{}")
        force_now = bool(req.get("force", False))
        res = perform_trackers_update_with_diff_v110(force=force_now)
        return json.dumps(res, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

@post('/api/torrent/add')
def api_torrent_add_v96():
    response.content_type = 'application/json'
    try:
        if not ensure_jtorrent_daemon_v96():
            return json.dumps({"status": "error", "error": "Не удалось запустить демон libjtorrent.so"})
        raw_body = request.body.read().decode("utf-8") or "{}"
        req_obj = json.loads(raw_body)
        mag = (req_obj.get("magnet") or "").strip()
        if mag:
            req_obj["magnet"] = enrich_magnet_with_cached_trackers_v109(mag)
        cached_trs, _, _ = _load_trackers_state_v110()
        req_obj["trackers"] = list(cached_trs or [])
        out_body = json.dumps(req_obj).encode("utf-8")
        req = urllib.request.Request(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/add", data=out_body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=32) as r:
            res_str = r.read().decode("utf-8")
        try:
            d_obj = json.loads(res_str)
            if d_obj.get("hash"):
                _KNOWN_TORRENT_META_V143[d_obj["hash"].lower()] = {
                    "magnet": mag,
                    "name": d_obj.get("name") or "Torrent"
                }
        except Exception:
            pass
        return res_str
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

# === 📂 JENNY V113: INSTANT .TORRENT FILE PARSER + BACKGROUND DAEMON SYNC ===
def _bdecode_with_info_slice_v113(data: bytes):
    info_slice = [0, 0]
    def _parse( idx):
        c = data[idx:idx+1]
        if c == b'i':
            end_i = data.index(b'e', idx + 1)
            return int(data[idx+1:end_i]), end_i + 1
        elif c == b'l':
            idx += 1
            arr = []
            while data[idx:idx+1] != b'e':
                val, idx = _parse(idx)
                arr.append(val)
            return arr, idx + 1
        elif c == b'd':
            idx += 1
            d_out = {}
            while data[idx:idx+1] != b'e':
                k, idx = _parse(idx)
                v_start = idx
                v, idx = _parse(idx)
                v_end = idx
                if k == b'info' and info_slice[1] == 0:
                    info_slice[0], info_slice[1] = v_start, v_end
                d_out[k] = v
            return d_out, idx + 1
        elif c.isdigit():
            colon = data.index(b':', idx)
            length = int(data[idx:colon])
            s_start = colon + 1
            s_end = s_start + length
            return data[s_start:s_end], s_end
        else:
            raise ValueError(f"Invalid bencode byte at {idx}")
    root, _ = _parse(0)
    return root, tuple(info_slice)

@post('/api/torrent/add_file_legacy')
def api_torrent_add_file_v113():
    response.content_type = 'application/json'
    try:
        upload = request.files.get('torrent_file')
        if not upload:
            return json.dumps({"status": "error", "error": "Файл .torrent не передан"})
        raw_bytes = upload.file.read()
        meta, (i_start, i_end) = _bdecode_with_info_slice_v113(raw_bytes)
        if i_end <= i_start or b'info' not in meta:
            return json.dumps({"status": "error", "error": "Повреждённый .torrent файл (нет секции info)"})

        info_hash = hashlib.sha1(raw_bytes[i_start:i_end]).hexdigest().lower()
        info_dict = meta[b'info']
        raw_name = info_dict.get(b'name.utf-8') or info_dict.get(b'name') or b'Torrent'
        tor_name = raw_name.decode('utf-8', errors='replace').strip() or "Torrent"

        file_trackers = []
        if b'announce' in meta and isinstance(meta[b'announce'], bytes):
            u_tr = meta[b'announce'].decode('utf-8', errors='ignore').strip()
            if u_tr:
                file_trackers.append(u_tr)
        if b'announce-list' in meta and isinstance(meta[b'announce-list'], list):
            for tier in meta[b'announce-list']:
                if isinstance(tier, list):
                    for item in tier:
                        if isinstance(item, bytes):
                            u_tr = item.decode('utf-8', errors='ignore').strip()
                            if u_tr and u_tr not in file_trackers:
                                file_trackers.append(u_tr)

        tor_dir = os.path.join(MUSIC_DIR, "torrents_tmp")
        os.makedirs(tor_dir, exist_ok=True)
        saved_tor_path = os.path.join(tor_dir, f"{info_hash}.torrent")
        with open(saved_tor_path, "wb") as tf:
            tf.write(raw_bytes)

        cached_trs, _, _ = _load_trackers_state_v110()
        all_trackers = list(dict.fromkeys(file_trackers + list(cached_trs or [])))

        if ensure_jtorrent_daemon_v96():
            try:
                add_req = urllib.request.Request(
                    f"http://127.0.0.1:{_JTORRENT_PORT_V96}/add",
                    data=json.dumps({
                        "torrent_path": saved_tor_path,
                        "trackers": all_trackers
                    }).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(add_req, timeout=12) as r:
                    d_resp = json.loads(r.read().decode("utf-8"))
                if d_resp.get("status") == "ok" and d_resp.get("files"):
                    files_out = []
                    for f_item in d_resp["files"]:
                        files_out.append({
                            "index": int(f_item.get("index", 0)),
                            "path": f_item.get("path", ""),
                            "length": int(f_item.get("length", 0)),
                            "completed": 0,
                            "percent": 0,
                            "done": False,
                            "full_path": f_item.get("full_path") or os.path.join(tor_dir, f_item.get("path", ""))
                        })
                    return json.dumps({
                        "status": "ok",
                        "hash": info_hash,
                        "name": d_resp.get("name") or tor_name,
                        "files": files_out,
                        "from_torrent_file": True
                    }, ensure_ascii=False)
            except Exception as e:
                print("Direct .torrent daemon register warning:", e)

        files_out = []
        if b'files' in info_dict and isinstance(info_dict[b'files'], list):
            for idx, f_item in enumerate(info_dict[b'files']):
                f_len = int(f_item.get(b'length') or 0)
                p_list = f_item.get(b'path.utf-8') or f_item.get(b'path') or []
                parts = [x.decode('utf-8', errors='replace') for x in p_list if isinstance(x, bytes)]
                rel_p = "/".join(parts) if parts else f"track_{idx}.mp3"
                full_p = os.path.join(tor_dir, tor_name, *parts) if parts else os.path.join(tor_dir, tor_name, rel_p)
                files_out.append({
                    "index": idx, "path": rel_p, "length": f_len,
                    "completed": 0, "percent": 0, "done": False, "full_path": full_p
                })
        else:
            f_len = int(info_dict.get(b'length') or 0)
            full_p = os.path.join(tor_dir, tor_name)
            files_out.append({
                "index": 0, "path": tor_name, "length": f_len,
                "completed": 0, "percent": 0, "done": False, "full_path": full_p
            })

        return json.dumps({
            "status": "ok", "hash": info_hash, "name": tor_name,
            "files": files_out, "from_torrent_file": True
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": f"Ошибка чтения .torrent: {e}"})

_JTORRENT_ACTIVE_FILES_V106 = {}

@post('/api/torrent/download_legacy')
def api_torrent_download_v96():
    response.content_type = 'application/json'
    try:
        ensure_jtorrent_daemon_v96()
        raw_body = request.body.read()
        req_obj = json.loads(raw_body.decode("utf-8") or "{}")
        h = (req_obj.get("hash") or "").strip().lower()
        flist = [int(x) for x in (req_obj.get("files") or [])]
        if h:
            _JTORRENT_ACTIVE_FILES_V106[h] = set(flist)

        cached_trs, _, _ = _load_trackers_state_v110()
        req_obj["trackers"] = list(cached_trs or [])
        payload = json.dumps(req_obj).encode("utf-8")

        req = urllib.request.Request(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/download", data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as r:
            res_str = r.read().decode("utf-8")

        res_json = json.loads(res_str)
        if res_json.get("status") != "ok" and h:
            saved_tor = os.path.join(MUSIC_DIR, "torrents_tmp", f"{h}.torrent")
            if os.path.isfile(saved_tor):
                add_req = urllib.request.Request(
                    f"http://127.0.0.1:{_JTORRENT_PORT_V96}/add",
                    data=json.dumps({"torrent_path": saved_tor, "trackers": list(cached_trs or [])}).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                urllib.request.urlopen(add_req, timeout=8).read()
                req2 = urllib.request.Request(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/download", data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req2, timeout=10) as r2:
                    return r2.read().decode("utf-8")
        return res_str
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
        persisted_st = _load_persisted_dl_state_v143() if '_load_persisted_dl_state_v143' in globals() else {}
        for t in (data.get("torrents") or []):
            th = (t.get("hash") or "").strip().lower()
            exp_set = set(int(x) for x in (persisted_st.get(th, {}).get("explicit_files") or []))
            t["has_explicit_dl"] = bool(exp_set)
            for f in (t.get("files") or []):
                f_idx = int(f.get("index", 0))
                key = f"{th}_{f_idx}"
                f["xflac_file"] = _JTORRENT_CONVERTED_V96.get(key, "")
                f["explicit_dl"] = (f_idx in exp_set)
        return json.dumps(data, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

@post('/api/torrent/queue_plan')
def api_torrent_queue_plan_v99():
    response.content_type = 'application/json'
    try:
        req = json.loads(request.body.read().decode('utf-8') or "{}")
        _TOR_ENC_PROGRESS_V99["total_count"] = int(req.get("total") or 0)
        _TOR_ENC_PROGRESS_V99["done_count"] = int(req.get("done") or 0)
        _recalc_tor_enc_overall_v99()
        return json.dumps({"status": "ok"})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

@post('/api/torrent/import_track')
def api_torrent_import_track_v105():
    response.content_type = 'application/json'
    req = json.loads(request.body.read().decode('utf-8') or "{}")
    full_p = (req.get("full_path") or "").strip()
    tor_name = (req.get("torrent_name") or "Torrent").strip()
    fmt = (req.get("format_mode") or "xflac_psycho").strip().lower()
    key = f"{req.get('hash')}_{req.get('index')}"
    if key in _JTORRENT_CONVERTED_V96:
        return json.dumps({"status": "ok", "filename": _JTORRENT_CONVERTED_V96[key], "size_mb": 0})
    if not full_p or not os.path.isfile(full_p):
        return json.dumps({"status": "error", "error": "Файл ещё не докачан"})

    base_nm = os.path.splitext(os.path.basename(full_p))[0]
    ext = os.path.splitext(full_p)[1].lower()
    xf_map = {'xflac_lossless': 0, 'xflac_psycho': 25, 'xflac_ultra': 15}
    need_xflac = (fmt in xf_map and ext in ('.flac', '.wav'))

    try:
        with _TOR_IMPORT_LOCK_V98:
            load_multi_dirs_v71()
            if need_xflac:
                _TOR_ENC_PROGRESS_V99.update({"active": True, "current_key": key, "current_track": base_nm, "track_pct": 8})
                _recalc_tor_enc_overall_v99()
                xf_mode = xf_map[fmt]
                suf = {0: "_bitperfect.xflac", 15: "_ultra.xflac", 25: "_psycho.xflac"}[xf_mode]
                final_name = f"{base_nm}{suf}"
                final_path = os.path.join(MUSIC_DIR, final_name)
                tmp_xf = os.path.join(MUSIC_DIR, f"temp_final_torxf_{os.getpid()}_{threading.get_ident()}.tmp")
                twav = os.path.join(MUSIC_DIR, f"temp_final_tor_{os.getpid()}_{threading.get_ident()}.wav")
                stop_ticker = False
                def _pct_ticker():
                    while not stop_ticker:
                        time.sleep(0.18)
                        cur = _TOR_ENC_PROGRESS_V99.get("track_pct", 8)
                        if cur < 92:
                            _TOR_ENC_PROGRESS_V99["track_pct"] = min(92, cur + 7)
                            _recalc_tor_enc_overall_v99()
                threading.Thread(target=_pct_ticker, daemon=True).start()
                try:
                    subprocess.run([find_ffmpeg_binary(), '-y', '-i', full_p, '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', twav], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90)
                    _TOR_ENC_PROGRESS_V99["track_pct"] = max(_TOR_ENC_PROGRESS_V99.get("track_pct", 0), 45)
                    _recalc_tor_enc_overall_v99()
                    with open(twav, "rb") as wf:
                        xfc_b = _encode_wav_to_xflac_bytes_v85(wf.read(), xf_mode)
                    _TOR_ENC_PROGRESS_V99["track_pct"] = 96
                    _recalc_tor_enc_overall_v99()
                    with open(tmp_xf, "wb") as of:
                        of.write(xfc_b)
                    shutil.move(tmp_xf, final_path)
                finally:
                    stop_ticker = True
                    for fp in (twav, tmp_xf):
                        if os.path.exists(fp):
                            try: os.remove(fp)
                            except Exception: pass
            else:
                # Прямой перенос MP3 / OGG / M4A / AAC без пережатия в xFLAC!
                final_name = os.path.basename(full_p)
                final_path = os.path.join(MUSIC_DIR, final_name)
                if full_p.lower().endswith(('.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.3gp')):
                    os.makedirs(VIDEO_DIR_V137, exist_ok=True)
                    vid_dst = os.path.join(VIDEO_DIR_V137, final_name)
                    if os.path.abspath(full_p) != os.path.abspath(vid_dst):
                        try:
                            os.replace(full_p, vid_dst)
                            full_p = vid_dst
                        except Exception:
                            try:
                                shutil.copy2(full_p, vid_dst)
                                full_p = vid_dst
                            except Exception:
                                pass
                    _discovered_video_paths_v134[final_name] = full_p
                    return json.dumps({"ok": True, "status": "ok", "xflac_file": final_name, "imported": final_name})
                if os.path.abspath(full_p) != os.path.abspath(final_path):
                    try:
                        if os.path.exists(final_path):
                            os.remove(final_path)
                        os.link(full_p, final_path)
                    except Exception:
                        shutil.copy2(full_p, final_path)

            _JTORRENT_CONVERTED_V96[key] = final_name
            if '_mark_explicit_file_done_v143' in globals():
                _mark_explicit_file_done_v143(str(req.get('hash') or ''), int(req.get('index') or 0))
            _TOR_ENC_PROGRESS_V99["track_pct"] = 100
            _TOR_ENC_PROGRESS_V99["done_count"] = _TOR_ENC_PROGRESS_V99.get("done_count", 0) + 1
            _recalc_tor_enc_overall_v99()
            db = load_custom_tags_db_v74()
            db[final_name] = {"TITLE": base_nm, "ARTIST": tor_name[:40], "ALBUM": tor_name[:50], "GENRE": "Torrent P2P"}
            save_custom_tags_db_v74(db)
            TRACK_META_CACHE_V71.pop(final_path, None)
            sz_mb = round(os.path.getsize(final_path) / (1024 * 1024), 2)
            return json.dumps({"status": "ok", "filename": final_name, "size_mb": sz_mb, "direct": not need_xflac})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})
    finally:
        # Всегда сбрасываем active=False, когда текущий файл обработан, чтобы UI никогда не зависал в ожидании остальных!
        _TOR_ENC_PROGRESS_V99["active"] = False
        _TOR_ENC_PROGRESS_V99["current_key"] = ""
        _TOR_ENC_PROGRESS_V99["track_pct"] = 0

@route('/api/torrent/stream/<hash_str>/<file_idx:int>', method='GET')
def api_torrent_stream_proxy_v97(hash_str, file_idx):
    ensure_jtorrent_daemon_v96()
    h_low = hash_str.strip().lower()
    if '_ensure_torrent_registered_in_daemon_v145' in globals():
        _ensure_torrent_registered_in_daemon_v145(h_low)
    # Добавляем прослушиваемый файл к уже качающемуся списку, НЕ отменяя загрузку остальных выбранных треков!
    cur_set = set(_JTORRENT_ACTIVE_FILES_V106.get(h_low, set()))
    _STREAM_ONLY_ACTIVE_V143.setdefault(h_low, set()).add(int(file_idx))
    if file_idx not in cur_set:
        cur_set.add(int(file_idx))
        _JTORRENT_ACTIVE_FILES_V106[h_low] = cur_set
        try:
            cached_trs, _, _ = _load_trackers_state_v110()
            dl_req = urllib.request.Request(
                f"http://127.0.0.1:{_JTORRENT_PORT_V96}/download",
                data=json.dumps({"hash": h_low, "files": sorted(list(cur_set)), "trackers": list(cached_trs or [])}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            urllib.request.urlopen(dl_req, timeout=3).read()
            bst_req = urllib.request.Request(
                f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                data=json.dumps({"hash": h_low, "action": "boost_file", "file_index": int(file_idx)}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            urllib.request.urlopen(bst_req, timeout=2).read()
        except Exception:
            pass

    u = f"http://127.0.0.1:{_JTORRENT_PORT_V96}/stream?hash={h_low}&file={file_idx}"
    hdrs = {"Range": request.headers.get("Range")} if request.headers.get("Range") else {}
    r = urllib.request.urlopen(urllib.request.Request(u, headers=hdrs), timeout=20)
    resp_hdrs = {}
    for k in ("Content-Type", "Content-Length", "Accept-Ranges", "Content-Range"):
        if r.headers.get(k):
            resp_hdrs[k] = r.headers.get(k)
    def _chunk_gen():
        try:
            while True:
                chunk = r.read(65536)
                if not chunk:
                    break
                yield chunk
        finally:
            try: r.close()
            except Exception: pass
    return bottle.HTTPResponse(body=_chunk_gen(), status=r.status, headers=resp_hdrs)

@route('/api/sources/live_badges', method='GET')
def api_sources_live_badges_v99():
    response.content_type = 'application/json'
    ost_st = globals().get("_OST_PROGRESS_V89", {})
    rad_st = globals().get("_RADIO_REC_V91", {})
    rad_sec = max(0, int(time.time() - (rad_st.get("start_ts") or time.time()))) if rad_st.get("active") else 0
    return json.dumps({
        "ost": {"active": bool(ost_st.get("active")), "pct": int(ost_st.get("percent") or 0)},
        "radio": {"active": bool(rad_st.get("active")), "sec": rad_sec},
        "soundcloud": {"active": bool(_SC_DL_STATE_V99.get("active")), "pct": int(_SC_DL_STATE_V99.get("pct") or 0)},
        "torrent_enc": _TOR_ENC_PROGRESS_V99
    }, ensure_ascii=False)

@post('/api/sources/kill_all')
def api_sources_kill_all_v94():
    response.content_type = 'application/json'
    try:
        if "_RADIO_REC_V91" in globals():
            _RADIO_REC_V91["stop_flag"] = True
            _RADIO_REC_V91["active"] = False
        if "_OST_PROGRESS_V89" in globals():
            _OST_PROGRESS_V89.update({"active": False, "stage": "idle", "percent": 0, "message": ""})
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/kill_all", timeout=1)
        except Exception:
            pass
        cleanup_stale_temps(MUSIC_DIR)
        return json.dumps({"status": "ok"})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})


# === 🚀 JENNY V127: DIRECT .TORRENT DAEMON BRIDGE ===
@post('/api/torrent/add_file')
def api_torrent_add_file_v127():
 response.content_type = 'application/json'
 try:
  upload = request.files.get('torrent_file')
  if not upload: return json.dumps({"status": "error", "error": "Файл .torrent не передан"})
  raw_bytes = upload.file.read()
  meta, (i_start, i_end) = _bdecode_with_info_slice_v113(raw_bytes)
  if i_end <= i_start or b'info' not in meta: return json.dumps({"status": "error", "error": "Повреждённый .torrent файл"})
  info_hash = hashlib.sha1(raw_bytes[i_start:i_end]).hexdigest().lower()
  info_dict = meta[b'info']
  raw_name = info_dict.get(b'name.utf-8') or info_dict.get(b'name') or b'Torrent'
  tor_name = raw_name.decode('utf-8', errors='replace').strip() or "Torrent"
  file_trackers = []
  if b'announce' in meta and isinstance(meta[b'announce'], bytes):
   u_tr = meta[b'announce'].decode('utf-8', errors='ignore').strip()
   if u_tr: file_trackers.append(u_tr)
  if b'announce-list' in meta and isinstance(meta[b'announce-list'], list):
   for tier in meta[b'announce-list']:
    if isinstance(tier, list):
     for item in tier:
      if isinstance(item, bytes):
       u_tr = item.decode('utf-8', errors='ignore').strip()
       if u_tr and u_tr not in file_trackers: file_trackers.append(u_tr)
  tor_dir = os.path.join(MUSIC_DIR, "torrents_tmp")
  os.makedirs(tor_dir, exist_ok=True)
  saved_tor_path = os.path.join(tor_dir, f"{info_hash}.torrent")
  with open(saved_tor_path, "wb") as tf: tf.write(raw_bytes)
  cached_trs, _, _ = _load_trackers_state_v110()
  all_trackers = list(dict.fromkeys(file_trackers + list(cached_trs or [])))
  if ensure_jtorrent_daemon_v96():
   try:
    add_req = urllib.request.Request(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/add", data=json.dumps({"torrent_path": saved_tor_path, "trackers": all_trackers}).encode("utf-8"), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(add_req, timeout=12) as r: d_resp = json.loads(r.read().decode("utf-8"))
    if d_resp.get("status") == "ok" and d_resp.get("files"):
     files_out = [{"index": int(f.get("index", 0)), "path": f.get("path", ""), "length": int(f.get("length", 0)), "completed": 0, "percent": 0, "done": False, "full_path": f.get("full_path") or os.path.join(tor_dir, f.get("path", "")), "begin_piece": int(f.get("begin_piece", 0)), "end_piece": int(f.get("end_piece", 0))} for f in d_resp["files"]]
     return json.dumps({"status": "ok", "hash": info_hash, "name": d_resp.get("name") or tor_name, "files": files_out, "from_torrent_file": True}, ensure_ascii=False)
   except Exception: pass
 except Exception as e:
  return json.dumps({"status": "error", "error": str(e)})

@post('/api/torrent/download')
def api_torrent_download_v127():
 response.content_type = 'application/json'
 try:
  ensure_jtorrent_daemon_v96()
  raw_body = request.body.read()
  req_obj = json.loads(raw_body.decode("utf-8") or "{}")
  h = (req_obj.get("hash") or "").strip().lower()
  flist = [int(x) for x in (req_obj.get("files") or [])]
  if h:
   if '_ensure_torrent_registered_in_daemon_v145' in globals():
    _ensure_torrent_registered_in_daemon_v145(h, str(req_obj.get('magnet') or ''))
   _JTORRENT_ACTIVE_FILES_V106[h] = set(flist)
   if req_obj.get("explicit", True):
    _register_explicit_download_v143(h, flist, torrent_path=os.path.join(MUSIC_DIR, "torrents_tmp", f"{h}.torrent"))
  cached_trs, _, _ = _load_trackers_state_v110()
  req_obj["trackers"] = list(cached_trs or [])
  payload = json.dumps(req_obj).encode("utf-8")
  req = urllib.request.Request(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/download", data=payload, headers={"Content-Type": "application/json"})
  with urllib.request.urlopen(req, timeout=10) as r: res_str = r.read().decode("utf-8")
  res_json = json.loads(res_str)
  if res_json.get("status") != "ok" and h:
   saved_tor = os.path.join(MUSIC_DIR, "torrents_tmp", f"{h}.torrent")
   if os.path.isfile(saved_tor):
    add_req = urllib.request.Request(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/add", data=json.dumps({"torrent_path": saved_tor, "trackers": list(cached_trs or [])}).encode("utf-8"), headers={"Content-Type": "application/json"})
    urllib.request.urlopen(add_req, timeout=8).read()
    req2 = urllib.request.Request(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/download", data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req2, timeout=10) as r2: return r2.read().decode("utf-8")
  return res_str
 except Exception as e:
  return json.dumps({"status": "error", "error": str(e)})


# === 🧩 JENNY V128 + V142: TORRENT CONTROL ROUTE WITH PHYSICAL FILE DELETION ===
def _delete_torrent_files_from_disk_v142(target_hash: str, nuke_all: bool = False, keep_torrent_meta: bool = False) -> float:
    freed_bytes = 0
    h = (target_hash or "").strip().lower()
    tor_dir = os.path.join(MUSIC_DIR, "torrents_tmp")
    target_names = set()
    target_paths = set()

    # 1. Снимаем список файлов раздачи из демона перед удалением
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=1.5) as r:
            st = json.loads(r.read().decode("utf-8", "ignore"))
            for tor in (st.get("torrents") or []):
                th = (tor.get("hash") or "").strip().lower()
                if nuke_all or (h and th == h):
                    if tor.get("name"):
                        target_names.add(tor["name"].strip())
                    for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                        for k in ("full_path", "path"):
                            fp = (fobj.get(k) or "").strip()
                            if fp:
                                target_paths.add(fp)
                                target_names.add(os.path.basename(fp))
                                top_seg = fp.replace(tor_dir, "").lstrip("/").split("/")[0]
                                if len(top_seg) >= 2:
                                    target_names.add(top_seg)
    except Exception:
        pass

    def _rm_item(p):
        nonlocal freed_bytes
        try:
            if os.path.isfile(p) or os.path.islink(p):
                freed_bytes += os.path.getsize(p)
                os.remove(p)
            elif os.path.isdir(p):
                for root_w, _, files_w in os.walk(p):
                    for fn_w in files_w:
                        try:
                            freed_bytes += os.path.getsize(os.path.join(root_w, fn_w))
                        except Exception:
                            pass
                shutil.rmtree(p, ignore_errors=True)
        except Exception:
            pass

    if nuke_all:
        if os.path.isdir(tor_dir):
            _rm_item(tor_dir)
            os.makedirs(tor_dir, exist_ok=True)
        _JTORRENT_ACTIVE_FILES_V106.clear()
        _JTORRENT_CONVERTED_V96.clear()
    else:
        if h:
            _JTORRENT_ACTIVE_FILES_V106.pop(h, None)
            if not keep_torrent_meta:
                _rm_item(os.path.join(tor_dir, f"{h}.torrent"))
        for fp in target_paths:
            if os.path.isabs(fp) and os.path.exists(fp):
                _rm_item(fp)
            else:
                cand = os.path.join(tor_dir, fp.lstrip("/"))
                if os.path.exists(cand):
                    _rm_item(cand)
        if os.path.isdir(tor_dir):
            for entry in os.listdir(tor_dir):
                if keep_torrent_meta and entry.lower() == f"{h}.torrent":
                    continue
                if (h and h in entry.lower()) or (entry in target_names):
                    _rm_item(os.path.join(tor_dir, entry))

    # Удаляем также перенесенные видеофайлы этой раздачи из JennyVideo и кэша вкладки Видео
    if "VIDEO_DIR_V137" in globals() and os.path.isdir(VIDEO_DIR_V137):
        for fn in list(os.listdir(VIDEO_DIR_V137)):
            meta = _discovered_video_meta_v137.get(fn) or {}
            if nuke_all or fn in target_names or (h and meta.get("tor_hash") == h):
                _rm_item(os.path.join(VIDEO_DIR_V137, fn))
                _discovered_video_paths_v134.pop(fn, None)
                _discovered_video_meta_v137.pop(fn, None)

    for fn in list(_discovered_video_meta_v137.keys()):
        meta = _discovered_video_meta_v137.get(fn) or {}
        if nuke_all or fn in target_names or (h and meta.get("tor_hash") == h):
            _discovered_video_paths_v134.pop(fn, None)
            _discovered_video_meta_v137.pop(fn, None)

    return round(freed_bytes / (1024.0 * 1024.0), 1)

@post('/api/torrent/control')
def api_torrent_control_v128():
    response.content_type = 'application/json'
    try:
        ensure_jtorrent_daemon_v96()
        raw_b = request.body.read()
        data = json.loads(raw_b.decode("utf-8") or "{}")
        act = (data.get("action") or "").strip().lower()
        h = (data.get("hash") or "").strip().lower()

        if act == "drop_all":
            if '_remove_persisted_dl_v143' in globals():
                _remove_persisted_dl_v143("", nuke_all=True)
            freed_mb = _delete_torrent_files_from_disk_v142("", nuke_all=True)
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/kill_all", timeout=1.5).read()
            except Exception:
                pass
            global _JTORRENT_PROC_V96
            if _JTORRENT_PROC_V96:
                try:
                    _JTORRENT_PROC_V96.kill()
                except Exception:
                    pass
                _JTORRENT_PROC_V96 = None
            ensure_jtorrent_daemon_v96()
            return json.dumps({"status": "ok", "freed_mb": freed_mb})

        freed_mb = 0.0
        if act == "drop" and h:
            if '_remove_persisted_dl_v143' in globals():
                _remove_persisted_dl_v143(h, nuke_all=False)
            freed_mb = _delete_torrent_files_from_disk_v142(h, nuke_all=False, keep_torrent_meta=True)
        elif act == "stop_or_pause" and h:
            # Если раздача была запущена только для потока (▶), останавливаем и чистим её кэш; если качалась (⬇️) — ставим на паузу без удаления кэша!
            st_dl = _load_persisted_dl_state_v143() if '_load_persisted_dl_state_v143' in globals() else {}
            exp_files = st_dl.get(h, {}).get("explicit_files") or []
            if not exp_files:
                res_clean = _stop_and_clean_stream_data_v143(h, None)
                return json.dumps({"status": "ok", "mode": "stream_cleaned", "freed_mb": res_clean.get("cleaned_mb", 0.0)})
            else:
                raw_b = json.dumps({"hash": h, "action": "pause"}).encode("utf-8")

        req = urllib.request.Request(
            f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
            data=raw_b,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            res_txt = r.read().decode("utf-8")
        try:
            res_obj = json.loads(res_txt)
            res_obj["freed_mb"] = freed_mb
            return json.dumps(res_obj)
        except Exception:
            return json.dumps({"status": "ok", "freed_mb": freed_mb})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})


# === 🎬 JENNY V130: VIDEO STREAM & LIVE FFMPEG REMUX ENGINE ===
@route('/api/video/live_remux', method='GET')
def api_video_live_remux_v130():
    src = (request.query.get('src') or '').strip()
    start_sec = float(request.query.get('start') or 0.0)
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

    ff_bin = find_ffmpeg_binary()
    cmd = [ff_bin, '-hide_banner', '-loglevel', 'error']
    if start_sec > 0.5:
        cmd.extend(['-ss', f"{start_sec:.2f}"])
    force_transcode = (request.query.get('transcode') == '1') or src_input.lower().endswith(('.avi', '.wmv', '.flv', '.mpeg', '.mpg', '.vob'))
    v_codec_args = [
        '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '23', '-pix_fmt', 'yuv420p'
    ] if force_transcode else ['-c:v', 'copy']
    cmd.extend(['-fflags', '+genpts+igndts', '-i', src_input] + v_codec_args + [
        '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4', '-'
    ])
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    resp_hdrs = {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
    def _remux_gen():
        try:
            while True:
                chunk = proc.stdout.read(65536)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                proc.kill()
            except Exception:
                pass
    return bottle.HTTPResponse(body=_remux_gen(), status=200, headers=resp_hdrs)


# === 🎬 JENNY V131: VIDEO RAM PCM CHUNK & META ENGINE ===
def _resolve_video_src_input_v131(src: str) -> str:
    src = (src or "").strip()
    if src.startswith('/api/torrent/stream/'):
        parts = src.strip('/').split('/')
        if len(parts) >= 5:
            h_low = parts[3].lower()
            f_idx = parts[4].split('?')[0]
            ensure_jtorrent_daemon_v96()
            return f"http://127.0.0.1:{_JTORRENT_PORT_V96}/stream?hash={h_low}&file={f_idx}"
    elif src.startswith('/api/media/'):
        fn = urllib.parse.unquote(src[len('/api/media/'):].split('?')[0])
        return resolve_track_full_path_v71(fn)
    return resolve_track_full_path_v71(src)

@route('/api/video/pcm_meta', method='GET')
def api_video_pcm_meta_v131():
    response.content_type = 'application/json'
    src = (request.query.get('src') or '').strip()
    if not src:
        return json.dumps({"duration": 0, "size": 0})
    src_input = _resolve_video_src_input_v131(src)
    dur_sec, sz_bytes = 0.0, 0
    try:
        if os.path.isfile(src_input):
            sz_bytes = os.path.getsize(src_input)
        ff_bin = find_ffmpeg_binary()
        pr = subprocess.run([ff_bin, '-hide_banner', '-i', src_input], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=8)
        raw = (pr.stderr or "") + (pr.stdout or "")
        m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", raw)
        if m:
            dur_sec = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    except Exception:
        pass
    return json.dumps({"duration": dur_sec, "size": sz_bytes})

@route('/api/video/pcm_chunk', method='GET')
def api_video_pcm_chunk_v131():
    src = (request.query.get('src') or '').strip()
    if not src:
        response.status = 400
        return "Missing src"
    try:
        st_sec = max(0.0, float(request.query.get('start', 0.0)))
        dur_sec = max(0.5, min(60.0, float(request.query.get('dur', 30.0))))
        sr = int(request.query.get('sr', 44100))
        if sr < 8000 or sr > 48000:
            sr = 44100
        src_input = _resolve_video_src_input_v131(src)
        cmd = [
            find_ffmpeg_binary(), '-v', 'error',
            '-ss', f"{st_sec:.3f}", '-t', f"{dur_sec:.3f}",
            '-i', src_input, '-vn', '-ac', '2', '-ar', str(sr),
            '-f', 'f32le', '-acodec', 'pcm_f32le', '-'
        ]
        pr = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20)
        raw_interleaved = pr.stdout or b""
        frames = (len(raw_interleaved) // 4) // 2
        if frames <= 0:
            response.content_type = 'application/octet-stream'
            return b""
        import array
        arr = array.array('f')
        arr.frombytes(raw_interleaved[:frames * 8])
        out_bytes = arr[0::2].tobytes() + arr[1::2].tobytes()
        response.content_type = 'application/octet-stream'
        response.set_header('Content-Length', str(len(out_bytes)))
        return out_bytes
    except Exception as e:
        response.status = 500
        return str(e)


# === 🎬 JENNY V134: AUTO-DISCOVER TORRENT VIDEOS IN LIBRARY ===
# === 📁 JENNY V137: DEDICATED /storage/emulated/0/JennyVideo FOLDER ===
VIDEO_DIR_V137 = "/storage/emulated/0/JennyVideo"
try:
    os.makedirs(VIDEO_DIR_V137, exist_ok=True)
except Exception:
    pass

_VIDEO_EXTS_V134 = ('.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.3gp')
_discovered_video_paths_v134 = {}
_discovered_video_meta_v137 = {}
_last_vid_scan_ts_v136 = 0.0

def _migrate_videos_from_music_dir_v137():
    """Если видеофайлы оказались в папке музыки MUSIC_DIR — переносим их в /storage/emulated/0/JennyVideo."""
    try:
        if 'MUSIC_DIR' not in globals() or not os.path.isdir(MUSIC_DIR):
            return
        os.makedirs(VIDEO_DIR_V137, exist_ok=True)
        for fn in os.listdir(MUSIC_DIR):
            if fn.lower().endswith(_VIDEO_EXTS_V134) and not fn.startswith('.'):
                src_p = os.path.join(MUSIC_DIR, fn)
                dst_p = os.path.join(VIDEO_DIR_V137, fn)
                if os.path.isfile(src_p) and os.path.abspath(src_p) != os.path.abspath(dst_p):
                    try:
                        os.replace(src_p, dst_p)
                    except Exception:
                        pass
    except Exception:
        pass

def _collect_video_scan_dirs_v137():
    load_multi_dirs_v71()
    roots = []
    for d in list(ACTIVE_MUSIC_DIRS) + [VIDEO_DIR_V137]:
        if d and os.path.isdir(d) and d not in roots:
            roots.append(d)
    tor_tmp = os.path.join(MUSIC_DIR, "torrents_tmp")
    if os.path.isdir(tor_tmp) and tor_tmp not in roots:
        roots.append(tor_tmp)
    return roots

def sync_downloaded_videos_to_library_v134(force=False):
    global _last_vid_scan_ts_v136
    now = time.time()
    if not force and (now - _last_vid_scan_ts_v136 < 2.0) and (_discovered_video_paths_v134 or _discovered_video_meta_v137):
        return list(_discovered_video_meta_v137.values())
    _last_vid_scan_ts_v136 = now
    if force:
        _discovered_video_paths_v134.clear()
        _discovered_video_meta_v137.clear()

    _migrate_videos_from_music_dir_v137()
    scan_dirs = _collect_video_scan_dirs_v137()

    # 1. Сканируем физические папки (в первую очередь /storage/emulated/0/JennyVideo и папки торрентов)
    for root_d in scan_dirs:
        try:
            for r, dirs, files in os.walk(root_d):
                dirs[:] = [d for d in dirs if d not in ('.git', 'Android', 'proc', 'sys', 'usr', 'lib')]
                for fn in files:
                    if fn.lower().endswith(_VIDEO_EXTS_V134) and not fn.startswith('.'):
                        full_p = os.path.join(r, fn)
                        try:
                            sz = os.path.getsize(full_p)
                            if sz < 16 * 1024:
                                continue
                        except Exception:
                            continue
                        # Если готовый видеофайл лежит на /storage/emulated/0 вне VIDEO_DIR_V137 (например в папке музыки), переносим в JennyVideo
                        if full_p.startswith('/storage/emulated/0/') and not full_p.startswith(VIDEO_DIR_V137) and ('torrents' in full_p.lower()):
                            dst_v = os.path.join(VIDEO_DIR_V137, fn)
                            if not os.path.exists(dst_v):
                                try:
                                    os.replace(full_p, dst_v)
                                    full_p = dst_v
                                except Exception:
                                    pass
                        _discovered_video_paths_v134[fn] = full_p
                        _discovered_video_meta_v137[fn] = {
                            "name": fn,
                            "size_mb": round(sz / (1024 * 1024), 1),
                            "in_video_dir": full_p.startswith(VIDEO_DIR_V137),
                            "stream_url": "/api/media/" + urllib.parse.quote(fn)
                        }
        except Exception:
            pass

    # 2. Опрашиваем демон libjtorrent: добавляем все видео из активных/скачанных раздач (даже если путь относительный!)
    try:
        ensure_jtorrent_daemon_v96()
        port = globals().get('_JTORRENT_PORT_V96', 42070)
        req = urllib.request.Request(f"http://127.0.0.1:{port}/status")
        with urllib.request.urlopen(req, timeout=0.6) as resp:
            raw_txt = resp.read().decode('utf-8', 'ignore')
            st_data = json.loads(raw_txt)
            tor_list = st_data if isinstance(st_data, list) else (st_data.get('torrents') or [])
            for tor in tor_list:
                h = (tor.get('hash') or '').lower()
                for f in (tor.get('files') or []):
                    rel_p = f.get('path') or f.get('name') or ''
                    if not rel_p or not rel_p.lower().endswith(_VIDEO_EXTS_V134):
                        continue
                    bn = os.path.basename(rel_p)
                    f_idx = f.get('index', 0)
                    pct = f.get('percent', 0)
                    sz_mb = round((f.get('size') or 0) / (1024 * 1024), 1)
                    # Проверяем, существует ли этот относительный путь внутри любой из наших папок
                    for cand_root in scan_dirs:
                        cand_full = os.path.join(cand_root, rel_p.lstrip('/'))
                        if os.path.isfile(cand_full):
                            # Если скачан на 100% и на одной файловой системе — переносим в /storage/emulated/0/JennyVideo
                            if pct >= 100 and cand_full.startswith('/storage/emulated/0/') and not cand_full.startswith(VIDEO_DIR_V137):
                                dst_v = os.path.join(VIDEO_DIR_V137, bn)
                                try:
                                    os.replace(cand_full, dst_v)
                                    cand_full = dst_v
                                except Exception:
                                    pass
                            _discovered_video_paths_v134[bn] = cand_full
                            break
                    if bn not in _discovered_video_meta_v137:
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
                        _discovered_video_meta_v137[bn]["percent"] = pct
    except Exception:
        pass

    return list(_discovered_video_meta_v137.values())

_orig_resolve_v134 = resolve_track_full_path_v71
def resolve_track_full_path_v71(filename: str) -> str:
    bn = os.path.basename(str(filename).split('?')[0])
    v_path = os.path.join(VIDEO_DIR_V137, bn)
    if os.path.isfile(v_path):
        return v_path
    if bn in _discovered_video_paths_v134 and os.path.isfile(_discovered_video_paths_v134[bn]):
        return _discovered_video_paths_v134[bn]
    sync_downloaded_videos_to_library_v134(False)
    if os.path.isfile(v_path):
        return v_path
    if bn in _discovered_video_paths_v134 and os.path.isfile(_discovered_video_paths_v134[bn]):
        return _discovered_video_paths_v134[bn]
    return _orig_resolve_v134(filename)

@route('/api/video/discovered_list', method='GET')
def api_video_discovered_list_v134():
    response.content_type = 'application/json'
    force = (request.query.get('force') == '1')
    items = sync_downloaded_videos_to_library_v134(force)
    names = sorted([x["name"] for x in items])
    return json.dumps({
        "video_dir": VIDEO_DIR_V137,
        "videos": names,
        "items": items
    })

# === 🧠⚡ JENNY V139: HOT-SWAPPABLE SEARCH CORES MANAGER (v3.6-ir / Classic / Custom) ===
_OMNI_CORES_STATE_V139 = {
    "active_core": "v40ir",
    "procs": {},
    "config": {
        "disable_logs": False,
        "enable_simple_log": True,
        "enable_trace_log": False,
        "log_dir": "/storage/emulated/0/scripts/JennyPlayer",
        "enable_soundcloud": True,
        "enable_seeker_p2p": True,
        "slskd_url": "http://127.0.0.1:5000",
        "slsk_user": "",
        "slsk_pass": ""
    }
}

_OMNI_CORE_REGISTRY_V139 = {}

def _get_native_lib_dirs_v140():
    dirs = []
    # 1. Через Android ApplicationInfo.nativeLibraryDir (Chaquopy)
    try:
        from java import jclass
        app = jclass("com.chaquo.python.Python").getPlatform().getApplication()
        nat_d = str(app.getApplicationInfo().nativeLibraryDir)
        if nat_d and os.path.isdir(nat_d) and nat_d not in dirs:
            dirs.append(nat_d)
    except Exception:
        pass

    # 2. Через /proc/self/maps (точный путь установленного APK в /data/app/.../lib/arm64)
    try:
        with open("/proc/self/maps", "r", encoding="utf-8", errors="ignore") as f:
            for ln in f:
                if "/lib/" in ln and ".so" in ln and ("jenny" in ln or "/data/app/" in ln):
                    p = ln.split()[-1]
                    d = os.path.dirname(p)
                    if os.path.isdir(d) and d not in dirs:
                        dirs.append(d)
    except Exception:
        pass

    # 3. Через любые штатные функции поиска .so в player.py
    for fn_name, fn_obj in list(globals().items()):
        if callable(fn_obj) and ("native" in fn_name.lower() or "so" in fn_name.lower()):
            try:
                probe = fn_obj("libomnitorrent.so")
                if isinstance(probe, str) and os.path.isfile(probe):
                    d = os.path.dirname(probe)
                    if d not in dirs:
                        dirs.append(d)
            except Exception:
                pass

    # 4. Папка проекта jniLibs и папка cores
    for extra in (
        "/storage/emulated/0/scripts/JennyPlayer/app/src/main/jniLibs/arm64-v8a",
        "/storage/emulated/0/scripts/JennyPlayer/cores",
    ):
        if os.path.isdir(extra) and extra not in dirs:
            dirs.append(extra)
    return dirs

def _prepare_executable_so_v140(src_path, fn):
    if src_path.startswith("/data/"):
        return src_path
    priv_dir = "/data/user/0/com.jenny.player/files/cores"
    try:
        os.makedirs(priv_dir, exist_ok=True)
        dst_p = os.path.join(priv_dir, fn)
        if not os.path.isfile(dst_p) or os.path.getsize(src_path) != os.path.getsize(dst_p) or int(os.path.getmtime(src_path)) != int(os.path.getmtime(dst_p)):
            shutil.copy2(src_path, dst_p)
            os.chmod(dst_p, 0o755)
        return dst_p
    except Exception:
        return src_path

def _discover_custom_cores_v139():
    found_so = {}
    for d in _get_native_lib_dirs_v140():
        try:
            for fn in sorted(os.listdir(d)):
                if fn.startswith("libomni") and fn.endswith(".so"):
                    full_p = os.path.join(d, fn)
                    if os.path.isfile(full_p):
                        if fn not in found_so or full_p.startswith("/data/app/"):
                            found_so[fn] = full_p
        except Exception:
            pass

    new_reg = {}
    port_seq = 18990

    def _sort_key(fn_name):
        if fn_name == "libomnitorrent.so":
            return (1, fn_name)
        return (0, fn_name)

    for fn in sorted(found_so.keys(), key=_sort_key, reverse=True):
        raw_p = found_so[fn]
        exec_p = _prepare_executable_so_v140(raw_p, fn)
        if fn == "libomnitorrent.so":
            cid = "classic"
            title = "🏛️ Classic Core"
            port = 18998
        elif fn == "libomnitorrent_v36ir.so":
            cid = "v36ir"
            title = "⚡ v3.6-ir Live Wave"
            port = 18999
        else:
            clean_label = re.sub(r"^libomni(torrent)?_?", "", fn[:-3]) or fn[:-3]
            cid = re.sub(r"[^a-zA-Z0-9_]", "_", clean_label).lower()
            title = f"🔥 {clean_label}"
            port = port_seq
            port_seq += 1

        new_reg[cid] = {
            "id": cid,
            "title": title,
            "desc": f"{fn} (:{port})",
            "custom_path": exec_p,
            "so_name": fn,
            "port": port
        }

    if not new_reg:
        new_reg["classic"] = {
            "id": "classic",
            "title": "🏛️ Classic Core",
            "desc": "libomnitorrent.so (:18998)",
            "custom_path": None,
            "so_name": "libomnitorrent.so",
            "port": 18998
        }

    _OMNI_CORE_REGISTRY_V139.clear()
    _OMNI_CORE_REGISTRY_V139.update(new_reg)
    if _OMNI_CORES_STATE_V139.get("active_core") not in _OMNI_CORE_REGISTRY_V139:
        _OMNI_CORES_STATE_V139["active_core"] = next(iter(_OMNI_CORE_REGISTRY_V139.keys()))

def _resolve_core_binary_v139(core_info):
    p = core_info.get("custom_path")
    if p and os.path.isfile(p):
        return p
    for d in _get_native_lib_dirs_v140():
        cand = os.path.join(d, core_info.get("so_name", "libomnitorrent.so"))
        if os.path.isfile(cand):
            return _prepare_executable_so_v140(cand, os.path.basename(cand))
    return None

def _push_core_config_v139(port):
    raw_cfg = dict(_OMNI_CORES_STATE_V139["config"])
    if not raw_cfg.get("slsk_user"):
        raw_cfg.pop("slsk_user", None)
        raw_cfg.pop("slsk_pass", None)
    try:
        payload = json.dumps(raw_cfg).encode("utf-8")
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/config",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            resp.read()
    except Exception:
        pass

def ensure_active_omni_core_v139(core_id=None):
    global _OMNI_PORT_V96
    _discover_custom_cores_v139()
    cid = core_id or _OMNI_CORES_STATE_V139.get("active_core")
    if cid not in _OMNI_CORE_REGISTRY_V139:
        cid = next(iter(_OMNI_CORE_REGISTRY_V139.keys()))
    _OMNI_CORES_STATE_V139["active_core"] = cid
    info = _OMNI_CORE_REGISTRY_V139[cid]
    port = info["port"]

    alive = False
    version_str = ""
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{port}/health")
        with urllib.request.urlopen(req, timeout=0.35) as r:
            alive = (r.status == 200)
            h_data = json.loads(r.read().decode("utf-8", "ignore"))
            version_str = h_data.get("version", "")
    except Exception:
        alive = False

    bin_p = _resolve_core_binary_v139(info)
    if not alive and bin_p:
        cfg = _OMNI_CORES_STATE_V139["config"]
        log_dir = cfg.get("log_dir") or "/storage/emulated/0/scripts/JennyPlayer"
        try:
            os.makedirs(log_dir, exist_ok=True)
        except Exception:
            pass
        cmd = [
            bin_p,
            f"-addr=127.0.0.1:{port}",
            f"-log-dir={log_dir}",
            f"-simple-log={'true' if cfg.get('enable_simple_log') else 'false'}",
            f"-trace-log={'true' if cfg.get('enable_trace_log') else 'false'}"
        ]
        if cfg.get("disable_logs"):
            cmd.append("-no-logs")
        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            _OMNI_CORES_STATE_V139["procs"][cid] = proc
            for _ in range(20):
                time.sleep(0.06)
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=0.25) as r:
                        if r.status == 200:
                            alive = True
                            h_data = json.loads(r.read().decode("utf-8", "ignore"))
                            version_str = h_data.get("version", "")
                            break
                except Exception:
                    pass
        except Exception:
            pass
        if alive:
            _push_core_config_v139(port)

    proc_obj = _OMNI_CORES_STATE_V139["procs"].get(cid)
    pid_val = proc_obj.pid if (proc_obj and proc_obj.poll() is None) else 0

    _OMNI_PORT_V96 = port
    return {
        "ok": True,
        "active_core": cid,
        "title": info["title"],
        "so_name": info["so_name"],
        "bin_path": bin_p or "not_found",
        "port": port,
        "pid": pid_val,
        "alive": alive,
        "version": version_str,
        "info": info
    }

if 'ensure_omnitorrent_daemon_v96' in globals():
    _orig_ensure_omni_v96 = ensure_omnitorrent_daemon_v96
    def ensure_omnitorrent_daemon_v96():
        res = ensure_active_omni_core_v139()
        if not res.get("alive"):
            return _orig_ensure_omni_v96()
        return True

_orig_urlopen_v139_1 = urllib.request.urlopen
def _omni_adapted_urlopen_v139_1(url_or_req, *args, **kwargs):
    try:
        u_str = url_or_req.full_url if hasattr(url_or_req, 'full_url') else str(url_or_req)
        if ('127.0.0.1:1899' in u_str):
            active_port = globals().get('_OMNI_PORT_V96', 18998)
            u_str = re.sub(r'127\.0\.0\.1:1899\d', f'127.0.0.1:{active_port}', u_str)
            if '/search' in u_str:
                cfg = _OMNI_CORES_STATE_V139.get("config", {})
                if 'simple_log=' not in u_str:
                    sep = "&" if "?" in u_str else "?"
                    extra_q = urllib.parse.urlencode({
                        "simple_log": 0 if cfg.get("disable_logs") else (1 if cfg.get("enable_simple_log", True) else 0),
                        "trace_log": 0 if cfg.get("disable_logs") else (1 if cfg.get("enable_trace_log", False) else 0),
                        "log_dir": cfg.get("log_dir") or "/storage/emulated/0/scripts/JennyPlayer"
                    })
                    u_str = u_str + sep + extra_q
                if 'timeout' not in kwargs or (kwargs['timeout'] is not None and kwargs['timeout'] < 20):
                    kwargs['timeout'] = 20
            if hasattr(url_or_req, 'full_url'):
                url_or_req.full_url = u_str
            else:
                url_or_req = u_str
    except Exception:
        pass
    return _orig_urlopen_v139_1(url_or_req, *args, **kwargs)

urllib.request.urlopen = _omni_adapted_urlopen_v139_1

@route('/api/omni/cores', method='GET')
def api_omni_cores_list_v139():
    response.content_type = 'application/json'
    st = ensure_active_omni_core_v139()
    cores_out = []
    for k, v in _OMNI_CORE_REGISTRY_V139.items():
        cores_out.append({
            "id": k,
            "title": v["title"],
            "desc": v["desc"],
            "so_name": v["so_name"],
            "port": v["port"],
            "active": (k == _OMNI_CORES_STATE_V139["active_core"])
        })
    return json.dumps({
        "ok": True,
        "active_core": _OMNI_CORES_STATE_V139["active_core"],
        "title": st.get("title", ""),
        "so_name": st.get("so_name", ""),
        "port": st["port"],
        "pid": st.get("pid", 0),
        "alive": st["alive"],
        "version": st.get("version", ""),
        "config": _OMNI_CORES_STATE_V139["config"],
        "cores": cores_out
    })

@route('/api/omni/switch_core', method='POST')
def api_omni_switch_core_v139():
    response.content_type = 'application/json'
    data = request.json or {}
    target_id = data.get("core_id")
    if isinstance(data.get("config"), dict):
        _OMNI_CORES_STATE_V139["config"].update(data["config"])
    st = ensure_active_omni_core_v139(target_id)
    _push_core_config_v139(st["port"])
    return json.dumps(st)

@route('/api/omni/logs_tail', method='GET')
def api_omni_logs_tail_v139():
    response.content_type = 'application/json'
    log_type = request.query.get('type') or 'simple'
    log_dir = _OMNI_CORES_STATE_V139["config"].get("log_dir") or "/storage/emulated/0/scripts/JennyPlayer"
    fn = "omni_full_trace.log" if log_type == "trace" else "omni_simple.log"
    fp = os.path.join(log_dir, fn)
    text_out = ""
    if os.path.isfile(fp):
        try:
            with open(fp, "r", encoding="utf-8", errors="ignore") as f:
                all_lines = f.readlines()[-400:]
            raw_tail = "".join(all_lines)
            marker = "🔎 НОВЫЙ ПОИСК" if log_type != "trace" else "[INIT]"
            idx = raw_tail.rfind(marker)
            if idx > 0:
                sep_idx = raw_tail.rfind("====", 0, idx)
                text_out = raw_tail[sep_idx if sep_idx >= 0 else idx:]
            else:
                text_out = "".join(all_lines[-160:])
        except Exception:
            pass
    return json.dumps({"ok": True, "file": fp, "text": text_out if text_out else "Лог пока пуст — сделай поиск в Торрент-студии."})

@route('/api/omni/search_start', method=['GET', 'POST'])
def api_omni_live_wave_start_v141():
    response.content_type = 'application/json'
    st = ensure_active_omni_core_v139()
    port = st["port"]
    qs = request.query_string or ""
    url_t = f"http://127.0.0.1:{port}/search_start" + (f"?{qs}" if qs else "")
    body_b = request.body.read() if request.method == 'POST' else None
    req = urllib.request.Request(url_t, data=body_b, method=request.method)
    if body_b:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=5) as r:
        return r.read().decode("utf-8", "ignore")

@route('/api/omni/search_poll', method='GET')
def api_omni_live_wave_poll_v141():
    response.content_type = 'application/json'
    port = globals().get('_OMNI_PORT_V96', 18998)
    qs = request.query_string or ""
    url_t = f"http://127.0.0.1:{port}/search_poll" + (f"?{qs}" if qs else "")
    with urllib.request.urlopen(url_t, timeout=5) as r:
        return r.read().decode("utf-8", "ignore")


# === 🎯🧲 JENNY V143: STREAM-ONLY AUTO-CLEANUP VS EXPLICIT DOWNLOAD AUTO-RESUME ===
TORRENT_DL_STATE_FILE_V143 = os.path.join(DEFAULT_MUSIC_DIR, "jenny_torrent_downloads.json")
_TORRENT_DL_LOCK_V143 = threading.Lock()
_STREAM_ONLY_ACTIVE_V143 = {}   # hash -> set(file_idx)
_KNOWN_TORRENT_META_V143 = {}   # hash -> {"magnet": str, "torrent_path": str, "name": str}

def _load_persisted_dl_state_v143() -> dict:
    if os.path.isfile(TORRENT_DL_STATE_FILE_V143):
        try:
            with open(TORRENT_DL_STATE_FILE_V143, "r", encoding="utf-8") as f:
                d = json.load(f)
                if isinstance(d, dict):
                    return d
        except Exception:
            pass
    return {}

def _save_persisted_dl_state_v143(state: dict):
    try:
        os.makedirs(os.path.dirname(TORRENT_DL_STATE_FILE_V143), exist_ok=True)
        with open(TORRENT_DL_STATE_FILE_V143, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def _register_explicit_download_v143(h: str, files_list: list, magnet: str = "", torrent_path: str = "", name: str = ""):
    h = (h or "").strip().lower()
    if not h:
        return
    with _TORRENT_DL_LOCK_V143:
        st = _load_persisted_dl_state_v143()
        meta = _KNOWN_TORRENT_META_V143.get(h, {})
        entry = st.get(h) or {
            "hash": h,
            "name": name or meta.get("name") or "Torrent",
            "magnet": magnet or meta.get("magnet") or "",
            "torrent_path": torrent_path or meta.get("torrent_path") or "",
            "explicit_files": [],
            "completed_files": []
        }
        if magnet:
            entry["magnet"] = magnet
        if torrent_path:
            entry["torrent_path"] = torrent_path
        if name:
            entry["name"] = name
        cur_exp = set(int(x) for x in entry.get("explicit_files", []))
        for f_idx in (files_list or []):
            cur_exp.add(int(f_idx))
            if h in _STREAM_ONLY_ACTIVE_V143:
                _STREAM_ONLY_ACTIVE_V143[h].discard(int(f_idx))
        entry["explicit_files"] = sorted(list(cur_exp))
        st[h] = entry
        _save_persisted_dl_state_v143(st)

def _mark_explicit_file_done_v143(h: str, file_idx: int):
    h = (h or "").strip().lower()
    if not h:
        return
    with _TORRENT_DL_LOCK_V143:
        st = _load_persisted_dl_state_v143()
        if h in st:
            comp = set(int(x) for x in st[h].get("completed_files", []))
            comp.add(int(file_idx))
            st[h]["completed_files"] = sorted(list(comp))
            _save_persisted_dl_state_v143(st)

def _remove_persisted_dl_v143(h: str = "", nuke_all: bool = False):
    with _TORRENT_DL_LOCK_V143:
        if nuke_all:
            _STREAM_ONLY_ACTIVE_V143.clear()
            _save_persisted_dl_state_v143({})
            return
        h = (h or "").strip().lower()
        _STREAM_ONLY_ACTIVE_V143.pop(h, None)
        st = _load_persisted_dl_state_v143()
        if h in st:
            st.pop(h, None)
            _save_persisted_dl_state_v143(st)

def _stop_and_clean_stream_data_v143(h: str, file_idx=None) -> dict:
    """Если раздача запускалась только для потока (▶) без скачивания (⬇️) — останавливает торрент и удаляет кэш потока с диска."""
    h = (h or "").strip().lower()
    if not h:
        return {"status": "ok", "cleaned_mb": 0.0, "dropped_torrent": False}

    st = _load_persisted_dl_state_v143()
    entry = st.get(h) or {}
    explicit_set = set(int(x) for x in entry.get("explicit_files", []))
    comp_set = set(int(x) for x in entry.get("completed_files", []))
    pending_explicit = explicit_set - comp_set

    if file_idx is not None:
        f_i = int(file_idx)
        if h in _STREAM_ONLY_ACTIVE_V143:
            _STREAM_ONLY_ACTIVE_V143[h].discard(f_i)
        if h in _JTORRENT_ACTIVE_FILES_V106 and f_i not in explicit_set:
            _JTORRENT_ACTIVE_FILES_V106[h].discard(f_i)
    else:
        _STREAM_ONLY_ACTIVE_V143.pop(h, None)

    # Если у торрента НЕТ активных скачиваний через ⬇️ — полностью гасим торрент и чистим его временные данные с диска!
    if not pending_explicit:
        freed_mb = _delete_torrent_files_from_disk_v142(h, nuke_all=False)
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                data=json.dumps({"hash": h, "action": "drop"}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            urllib.request.urlopen(req, timeout=2.5).read()
        except Exception:
            pass
        return {"status": "ok", "cleaned_mb": freed_mb, "dropped_torrent": True}

    # Если в этом же торренте качаются другие файлы через ⬇️ — оставляем качаться ТОЛЬКО их, а временный файл потока удаляем
    freed_mb = 0.0
    if file_idx is not None and int(file_idx) not in explicit_set:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=1.0) as r:
                d_st = json.loads(r.read().decode("utf-8", "ignore"))
                for tor in (d_st.get("torrents") or []):
                    if (tor.get("hash") or "").strip().lower() == h:
                        for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                            if int(fobj.get("index", -1)) == int(file_idx):
                                fp = fobj.get("full_path") or os.path.join(MUSIC_DIR, "torrents_tmp", (fobj.get("path") or "").lstrip("/"))
                                if fp and os.path.isfile(fp):
                                    freed_mb = round(os.path.getsize(fp) / (1024.0 * 1024.0), 1)
                                    os.remove(fp)
        except Exception:
            pass
        try:
            cached_trs, _, _ = _load_trackers_state_v110()
            dl_req = urllib.request.Request(
                f"http://127.0.0.1:{_JTORRENT_PORT_V96}/download",
                data=json.dumps({"hash": h, "files": sorted(list(pending_explicit)), "trackers": list(cached_trs or [])}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            urllib.request.urlopen(dl_req, timeout=2.5).read()
        except Exception:
            pass

    return {"status": "ok", "cleaned_mb": freed_mb, "dropped_torrent": False}

@post('/api/torrent/stream_stop')
def api_torrent_stream_stop_v143():
    response.content_type = 'application/json'
    try:
        req = json.loads(request.body.read().decode("utf-8") or "{}")
        h = (req.get("hash") or "").strip().lower()
        f_idx = req.get("file_index")
        res = _stop_and_clean_stream_data_v143(h, f_idx)
        return json.dumps(res)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

def _startup_resume_downloads_and_clean_streams_v143():
    """На старте плеера вычищает временный кэш потоков (▶) и автоматически докачивает недокачанные закачки (⬇️)."""
    time.sleep(2.2)
    if not ensure_jtorrent_daemon_v96():
        return
    st = _load_persisted_dl_state_v143()
    tor_dir = os.path.join(MUSIC_DIR, "torrents_tmp")
    active_hashes = set()
    to_resume = []

    for h, entry in list(st.items()):
        exp = set(int(x) for x in entry.get("explicit_files", []))
        comp = set(int(x) for x in entry.get("completed_files", []))
        pending = sorted(list(exp - comp))
        if pending:
            active_hashes.add(h.lower())
            to_resume.append((h.lower(), entry, pending))
        else:
            st.pop(h, None)
    _save_persisted_dl_state_v143(st)

    # 1. Останавливаем и удаляем из демона и torrents_tmp все раздачи, которые НЕ ставились на скачивание ⬇️
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=2.0) as r:
            d_st = json.loads(r.read().decode("utf-8", "ignore"))
            for tor in (d_st.get("torrents") or []):
                th = (tor.get("hash") or "").strip().lower()
                if th and th not in active_hashes:
                    _delete_torrent_files_from_disk_v142(th, nuke_all=False)
                    try:
                        req = urllib.request.Request(
                            f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                            data=json.dumps({"hash": th, "action": "drop"}).encode("utf-8"),
                            headers={"Content-Type": "application/json"}
                        )
                        urllib.request.urlopen(req, timeout=2.0).read()
                    except Exception:
                        pass
    except Exception:
        pass

    if not active_hashes and os.path.isdir(tor_dir):
        try:
            shutil.rmtree(tor_dir, ignore_errors=True)
            os.makedirs(tor_dir, exist_ok=True)
        except Exception:
            pass

    # 2. Автоматически запускаем докачку всех недокачанных треков (⬇️) прямо на старте!
    cached_trs, _, _ = _load_trackers_state_v110()
    for h, entry, pending_files in to_resume:
        try:
            t_path = entry.get("torrent_path") or os.path.join(tor_dir, f"{h}.torrent")
            mag = entry.get("magnet") or ""
            add_payload = {"trackers": list(cached_trs or [])}
            if os.path.isfile(t_path):
                add_payload["torrent_path"] = t_path
            elif mag:
                add_payload["magnet"] = enrich_magnet_with_cached_trackers_v109(mag)
            else:
                continue
            add_req = urllib.request.Request(
                f"http://127.0.0.1:{_JTORRENT_PORT_V96}/add",
                data=json.dumps(add_payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            urllib.request.urlopen(add_req, timeout=15).read()
            _JTORRENT_ACTIVE_FILES_V106[h] = set(pending_files)
            dl_req = urllib.request.Request(
                f"http://127.0.0.1:{_JTORRENT_PORT_V96}/download",
                data=json.dumps({"hash": h, "files": pending_files, "trackers": list(cached_trs or [])}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            urllib.request.urlopen(dl_req, timeout=8).read()
        except Exception:
            pass

threading.Thread(target=_startup_resume_downloads_and_clean_streams_v143, daemon=True).start()


def _ensure_torrent_registered_in_daemon_v145(h: str, magnet_hint: str = ""):
    h = (h or "").strip().lower()
    if not h:
        return
    ensure_jtorrent_daemon_v96()
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=1.0) as r:
            st = json.loads(r.read().decode("utf-8", "ignore"))
            for tor in (st.get("torrents") or []):
                if (tor.get("hash") or "").strip().lower() == h:
                    if (tor.get("num_pieces") or 0) > 0 or len(tor.get("all_files") or tor.get("files") or []) > 0:
                        return
    except Exception:
        pass

    cached_trs, _, _ = _load_trackers_state_v110()
    tor_file = os.path.join(MUSIC_DIR, "torrents_tmp", f"{h}.torrent")
    meta = _KNOWN_TORRENT_META_V143.get(h, {}) if "_KNOWN_TORRENT_META_V143" in globals() else {}
    mag = magnet_hint or meta.get("magnet") or f"magnet:?xt=urn:btih:{h}"

    add_payload = {"trackers": list(cached_trs or [])}
    if os.path.isfile(tor_file):
        add_payload["torrent_path"] = tor_file
    else:
        add_payload["magnet"] = enrich_magnet_with_cached_trackers_v109(mag)

    try:
        req = urllib.request.Request(
            f"http://127.0.0.1:{_JTORRENT_PORT_V96}/add",
            data=json.dumps(add_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        urllib.request.urlopen(req, timeout=18).read()
    except Exception:
        pass

def start_server():
    load_saved_music_dir()
    cleanup_stale_temps(DEFAULT_MUSIC_DIR)
    if MUSIC_DIR != DEFAULT_MUSIC_DIR:
        cleanup_stale_temps(MUSIC_DIR)
    print("🎧 АВТОНОМНЫЙ ПЛЕЕР ЗАПУЩЕН НА ПОРТУ 8080")
    run(host='127.0.0.1', port=8080, quiet=True, server='waitress')

if __name__ == "__main__":
    start_server()
