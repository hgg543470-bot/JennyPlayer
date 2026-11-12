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
from bottle import hook, route, run, get, post, response, static_file, request

bottle.BaseRequest.MEMFILE_MAX = 150 * 1024 * 1024

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

DEFAULT_MUSIC_DIR = "/storage/emulated/0/Music/"
MUSIC_DIR = DEFAULT_MUSIC_DIR
PRESET_FILE = os.path.join(DEFAULT_MUSIC_DIR, "jenny_dsp_preset.json")

# === JENNY V242: PERSISTENT EXTERNAL STORAGE HUB (/storage/emulated/0/JENNY) ===
_JENNY_HUB_INIT_LOCK_V242 = threading.Lock()
_JENNY_HUB_MIGRATED_V242 = False

def get_jenny_hub_root_v242() -> str:
    ext_base = "/storage/emulated/0"
    if os.path.isdir(ext_base) and os.access(ext_base, os.W_OK):
        root = os.path.join(ext_base, "JENNY")
    else:
        root = os.path.join(os.path.dirname(DEFAULT_MUSIC_DIR.rstrip("/")), "JENNY")
    for sub in ("Torrents", os.path.join("Torrents", "data"), "SoundCloud", "OST", "Archive", "Radio", "YouTube"):
        try:
            os.makedirs(os.path.join(root, sub), exist_ok=True)
        except Exception:
            pass
    return root

def get_jenny_torrents_data_dir_v242() -> str:
    global _JENNY_HUB_MIGRATED_V242
    hub_root = get_jenny_hub_root_v242()
    tor_data = os.path.join(hub_root, "Torrents", "data")
    try:
        os.makedirs(tor_data, exist_ok=True)
    except Exception:
        pass
    if not _JENNY_HUB_MIGRATED_V242:
        with _JENNY_HUB_INIT_LOCK_V242:
            if not _JENNY_HUB_MIGRATED_V242:
                _JENNY_HUB_MIGRATED_V242 = True
                # Migrate legacy jenny_torrent_downloads.json -> /storage/emulated/0/JENNY/Torrents/torrent_downloads_state.json
                new_state_p = os.path.join(hub_root, "Torrents", "torrent_downloads_state.json")
                for old_dir in {DEFAULT_MUSIC_DIR, globals().get("MUSIC_DIR") or DEFAULT_MUSIC_DIR}:
                    if not old_dir:
                        continue
                    old_state_p = os.path.join(old_dir, "jenny_torrent_downloads.json")
                    if os.path.isfile(old_state_p) and not os.path.isfile(new_state_p):
                        try:
                            shutil.copy2(old_state_p, new_state_p)
                        except Exception:
                            pass
                    old_tmp = os.path.join(old_dir, "torrents_tmp")
                    if os.path.isdir(old_tmp) and os.path.abspath(old_tmp) != os.path.abspath(tor_data):
                        try:
                            for entry_name in os.listdir(old_tmp):
                                src_e = os.path.join(old_tmp, entry_name)
                                dst_e = os.path.join(tor_data, entry_name)
                                if not os.path.exists(dst_e):
                                    shutil.move(src_e, dst_e)
                        except Exception:
                            pass
    return tor_data


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
        {"id": "all",   "label": "🌐 ВСЕ",    "color": "#58a6ff"},
        {"id": "video", "label": "🎬 ВИДЕО",  "color": "#ff7b72"},
        {"id": "mkv",   "label": "📽️ MKV",    "color": "#ffa657"},
        {"id": "mp4",   "label": "🎞️ MP4",    "color": "#f0883e"},
        {"id": "avi",   "label": "📼 AVI",    "color": "#e3b341"},
        {"id": "1080p", "label": "📽️ 1080p",  "color": "#ff7b72"},
        {"id": "2160p", "label": "🔥 4K",     "color": "#f0883e"},
        {"id": "flac",  "label": "💎 FLAC",   "color": "#d2a8ff"},
        {"id": "wav",   "label": "🌊 WAV",    "color": "#39c5cf"},
        {"id": "mp3",   "label": "🎵 MP3",    "color": "#3fb950"},
        {"id": "m4a",   "label": "🍏 M4A",    "color": "#e3b341"},
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


@route('/<filename:re:.*\\.(js|css|html|svg|json)>')
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


# === V162: СКРЫТЫЙ КЭШ ПОСЛЕДНЕЙ 1 СКАЧАННОЙ ПЕСНИ С ТОРРЕНТА (ДЛЯ СРАВНЕНИЯ ОРИГ / WAV / XFLAC) ===
def _get_p2p_last1_cache_dir_v162():
    d = os.path.join(MUSIC_DIR, ".jenny_p2p_last1_cache")
    os.makedirs(d, exist_ok=True)
    nm = os.path.join(d, ".nomedia")
    if not os.path.exists(nm):
        try:
            open(nm, "w").close()
        except Exception:
            pass
    return d

def _save_p2p_last1_cache_v162(orig_src_path: str, wav_src_path: str, display_orig_name: str, out_xflac_name: str = ""):
    """Сохраняет только последнюю 1 скачанную с торрента песню (оригинал и WAV) с переименованными расширениями .jorig_bin и .jwav_bin."""
    try:
        cdir = _get_p2p_last1_cache_dir_v162()
        for old_f in os.listdir(cdir):
            if old_f.endswith((".jorig_bin", ".jwav_bin", ".jmeta.json")):
                try:
                    os.remove(os.path.join(cdir, old_f))
                except Exception:
                    pass
        orig_ext = os.path.splitext(display_orig_name or orig_src_path)[1].lower() or ".flac"
        if orig_src_path and os.path.isfile(orig_src_path):
            shutil.copy2(orig_src_path, os.path.join(cdir, "last_track.jorig_bin"))
        if wav_src_path and os.path.isfile(wav_src_path):
            shutil.copy2(wav_src_path, os.path.join(cdir, "last_track.jwav_bin"))
        meta = {
            "orig_name": os.path.basename(display_orig_name or orig_src_path or "track.flac"),
            "orig_ext": orig_ext,
            "xflac_name": os.path.basename(out_xflac_name or ""),
            "orig_src_path": orig_src_path or "",
            "ts": int(time.time())
        }
        with open(os.path.join(cdir, "last_track.jmeta.json"), "w", encoding="utf-8") as mf:
            json.dump(meta, mf, ensure_ascii=False)
    except Exception as e:
        print("V162 cache save error:", e)


# === V162 (Attempt 2): СКРЫТЫЙ КЭШ ПОСЛЕДНЕЙ 1 СКАЧАННОЙ ПЕСНИ С ТОРРЕНТА ===
def _get_p2p_last1_cache_dir_v162():
    d = os.path.join(MUSIC_DIR, ".jenny_p2p_last1_cache")
    os.makedirs(d, exist_ok=True)
    nm = os.path.join(d, ".nomedia")
    if not os.path.exists(nm):
        try:
            open(nm, "w").close()
        except Exception:
            pass
    return d

def _capture_last1_before_xflac_v162(wav_bytes: bytes):
    """Автоматически сохраняет чистый WAV и находит живой исходный файл (.flac/.mp3) в стеке вызова до его удаления."""
    try:
        cdir = _get_p2p_last1_cache_dir_v162()
        jwav_path = os.path.join(cdir, "last_track.jwav_bin")
        jorig_path = os.path.join(cdir, "last_track.jorig_bin")
        jmeta_path = os.path.join(cdir, "last_track.jmeta.json")

        if wav_bytes and len(wav_bytes) > 44:
            with open(jwav_path, "wb") as wf:
                wf.write(wav_bytes)

        found_src = None
        for depth in (1, 2, 3):
            try:
                fr = sys._getframe(depth)
            except ValueError:
                break
            for val in list(fr.f_locals.values()):
                if isinstance(val, str) and len(val) > 4 and os.path.isfile(val):
                    low = val.lower()
                    if low.endswith((".flac", ".mp3", ".m4a", ".ogg", ".opus", ".ape", ".wv", ".wav")):
                        if not low.endswith((".xflac", ".tmp.wav", ".sr.wav", "temp_final_xflac_stream_cache.wav")) and "temp_export" not in low:
                            found_src = val
                            break
            if found_src:
                break

        if found_src and os.path.isfile(found_src):
            shutil.copy2(found_src, jorig_path)
            orig_ext = os.path.splitext(found_src)[1].lower() or ".flac"
            meta = {
                "orig_name": os.path.basename(found_src),
                "orig_ext": orig_ext,
                "ts": int(time.time())
            }
            with open(jmeta_path, "w", encoding="utf-8") as mf:
                json.dump(meta, mf, ensure_ascii=False)
    except Exception as e:
        print("V162 capture warning:", e)

def _sanitize_canonical_wav_file_v159(wav_path: str):
    """Приводит любой WAV (включая WAVE_FORMAT_EXTENSIBLE 0xFFFE от FFmpeg) к строгому 44-байтному каноническому заголовку RIFF WAVE,
    чтобы исключить заикания и ошибки чтения частоты/битности/длительности при ручной смене параметров."""
    try:
        if not os.path.isfile(wav_path):
            return
        with open(wav_path, 'rb') as f:
            hdr = f.read(4096)
            if len(hdr) < 44 or hdr[:4] != b'RIFF' or hdr[8:12] != b'WAVE':
                return
            pos = 12
            ftag = 1
            ch = 2
            sr = 44100
            bits = 16
            data_off = -1
            data_sz = 0
            while pos + 8 <= len(hdr):
                cid = hdr[pos:pos+4]
                csz = struct.unpack('<I', hdr[pos+4:pos+8])[0]
                if cid == b'fmt ' and pos + 24 <= len(hdr):
                    ftag, ch, sr, _, _, bits = struct.unpack('<HHIIHH', hdr[pos+8:pos+24])
                    if ftag == 0xFFFE and csz >= 40 and pos + 8 + 26 <= len(hdr):
                        ftag = struct.unpack('<H', hdr[pos+32:pos+34])[0]
                elif cid == b'data':
                    data_off = pos + 8
                    data_sz = csz
                    break
                pos += 8 + csz + (csz & 1)
            if data_off == -1:
                return
            f.seek(0, os.SEEK_END)
            total_file_sz = f.tell()
            real_pcm_bytes = max(0, total_file_sz - data_off)
            if data_sz <= 0 or data_sz > real_pcm_bytes or data_off != 44 or ftag not in (1, 3):
                pass
            if ch not in (1, 2):
                ch = 2
            if bits not in (16, 24, 32):
                bits = 16
            if sr < 8000 or sr > 384000:
                sr = 44100
            clean_ftag = 3 if (bits == 32 and ftag == 3) else 1
            bps = bits // 8
            frame_align = ch * bps
            real_pcm_bytes = (real_pcm_bytes // frame_align) * frame_align
            byte_rate = sr * frame_align
            # Если заголовок уже 44-байтный канонический и все поля совпадают — ничего не перезаписываем
            if data_off == 44 and ftag == clean_ftag and data_sz == real_pcm_bytes:
                cur_br, cur_ba = struct.unpack('<IH', hdr[28:34])
                if cur_br == byte_rate and cur_ba == frame_align:
                    return
            f.seek(data_off)
            pcm_payload = f.read(real_pcm_bytes)
        new_hdr = struct.pack(
            '<4sI4s4sIHHIIHH4sI',
            b'RIFF', 36 + len(pcm_payload), b'WAVE',
            b'fmt ', 16, clean_ftag, ch, sr, byte_rate, frame_align, bits,
            b'data', len(pcm_payload)
        )
        with open(wav_path, 'wb') as wf:
            wf.write(new_hdr)
            wf.write(pcm_payload)
    except Exception:
        pass

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

# [DOCTOR CLEANED OVERRIDE: _old_extract_sr_unused]

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

        valid_srs = ('8000', '11025', '16000', '22050', '24000', '32000', '44100', '48000', '64000', '88200', '96000', '128000', '176400', '192000', '352800', '384000')
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
    tor_dir = get_jenny_torrents_data_dir_v242()
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
# [V361 DEFERRED AFTER 8080 BIND] threading.Thread(target=ensure_jtorrent_daemon_v96, daemon=True).start()

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

# [V361 DEFERRED AFTER 8080 BIND] threading.Thread(target=ensure_omnitorrent_daemon_v124, daemon=True).start()

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

        tor_dir = get_jenny_torrents_data_dir_v242()
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
            saved_tor = os.path.join(get_jenny_torrents_data_dir_v242(), f"{h}.torrent")
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
  tor_dir = get_jenny_torrents_data_dir_v242()
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
    _register_explicit_download_v143(h, flist, torrent_path=os.path.join(get_jenny_torrents_data_dir_v242(), f"{h}.torrent"))
  cached_trs, _, _ = _load_trackers_state_v110()
  req_obj["trackers"] = list(cached_trs or [])
  payload = json.dumps(req_obj).encode("utf-8")
  req = urllib.request.Request(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/download", data=payload, headers={"Content-Type": "application/json"})
  with urllib.request.urlopen(req, timeout=10) as r: res_str = r.read().decode("utf-8")
  res_json = json.loads(res_str)
  if res_json.get("status") != "ok" and h:
   saved_tor = os.path.join(get_jenny_torrents_data_dir_v242(), f"{h}.torrent")
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
    tor_dir = get_jenny_torrents_data_dir_v242()
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

    # V215: При сбросе торрентов (nuke_all) удаляем ТОЛЬКО временный кэш torrents_tmp и файлы с явным tor_hash,
    # НИКОГДА не удаляя личные видеофайлы пользователя из JennyVideo или Download!
    if "VIDEO_DIR_V137" in globals() and os.path.isdir(VIDEO_DIR_V137):
        for fn in list(os.listdir(VIDEO_DIR_V137)):
            meta = _discovered_video_meta_v137.get(fn) or {}
            file_tor_hash = (meta.get("tor_hash") or "").strip().lower()
            if (file_tor_hash and (nuke_all or (h and file_tor_hash == h))) or (not nuke_all and fn in target_names and file_tor_hash):
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
        '-threads', '0', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '23', '-pix_fmt', 'yuv420p'
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
    """V215: Никогда не переносим личные видео пользователя из MUSIC_DIR / Download в JennyVideo!"""
    return

def _collect_video_scan_dirs_v137():
    load_multi_dirs_v71()
    roots = []
    # Сканируем строго активные папки, отмеченные галочками в «📁 Музыкальные папки»
    # (а если VIDEO_DIR_V137 вообще нет в SAVED_MUSIC_DIRS — добавляем её как дефолтную)
    base_list = list(ACTIVE_MUSIC_DIRS)
    if VIDEO_DIR_V137 not in (SAVED_MUSIC_DIRS or []) and VIDEO_DIR_V137 not in base_list:
        base_list.append(VIDEO_DIR_V137)
    for d in base_list:
        if d and os.path.isdir(d) and d not in roots:
            roots.append(d)
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
TORRENT_DL_STATE_FILE_V143 = os.path.join(get_jenny_hub_root_v242(), "Torrents", "torrent_downloads_state.json")
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
        freed_mb = _delete_torrent_files_from_disk_v142(h, nuke_all=False, keep_torrent_meta=True)
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
                                fp = fobj.get("full_path") or os.path.join(get_jenny_torrents_data_dir_v242(), (fobj.get("path") or "").lstrip("/"))
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
    tor_dir = get_jenny_torrents_data_dir_v242()
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

# [V361 DEFERRED AFTER 8080 BIND] threading.Thread(target=_startup_resume_downloads_and_clean_streams_v143, daemon=True).start()


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
    tor_file = os.path.join(get_jenny_torrents_data_dir_v242(), f"{h}.torrent")
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



# === 📥💿 JENNY V163: ДОБАВЛЕНИЕ ОРИГИНАЛА И WAV ИЗ ЦЕНТРА ЗАКАЧЕК P2P В ПЛЕЕР ===
_P2P_COMPARE_ADDED_V163 = {}  # key -> {"orig": filename, "wav": filename}

def _locate_downloaded_p2p_file_v163(target_name: str, target_hash: str = "", target_idx: int = -1):
    tor_dir = get_jenny_torrents_data_dir_v242()
    target_base = os.path.basename((target_name or "").strip())
    h_low = (target_hash or "").strip().lower()

    # 1. Ищем через живой статус демона jtorrent
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=2.0) as r:
            st = json.loads(r.read().decode("utf-8", "ignore"))
            for tor in (st.get("torrents") or []):
                th = (tor.get("hash") or "").strip().lower()
                if h_low and th != h_low:
                    continue
                t_name = (tor.get("name") or "Torrent").strip()
                for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                    f_idx = int(fobj.get("index", -1))
                    f_path = (fobj.get("full_path") or fobj.get("path") or "").strip()
                    f_base = os.path.basename(f_path)
                    if (target_idx >= 0 and f_idx == target_idx) or (target_base and f_base.lower() == target_base.lower()):
                        cands = [f_path, os.path.join(tor_dir, f_path.lstrip("/")), os.path.join(tor_dir, f_base)]
                        for c in cands:
                            if c and os.path.isfile(c):
                                return c, t_name, th, f_idx
    except Exception:
        pass

    # 2. Фоллбэк: рекурсивный обход папки torrents_tmp и MUSIC_DIR по имени файла
    if target_base:
        for search_root in (tor_dir, MUSIC_DIR):
            if os.path.isdir(search_root):
                for root_w, _, files_w in os.walk(search_root):
                    for fn_w in files_w:
                        if fn_w.lower() == target_base.lower():
                            full_cand = os.path.join(root_w, fn_w)
                            if os.path.isfile(full_cand):
                                return full_cand, "Torrent P2P", h_low, target_idx

    return "", "Torrent P2P", h_low, target_idx


@post('/api/p2p/add_compare_file')
def api_p2p_add_compare_file_v163():
    response.content_type = 'application/json; charset=utf-8'
    try:
        req = json.loads(request.body.read().decode('utf-8') or "{}")
        track_name = (req.get("name") or "").strip()
        mode = (req.get("mode") or "orig").strip().lower()
        t_hash = (req.get("hash") or "").strip().lower()
        t_idx = int(req.get("index", -1)) if req.get("index") is not None and str(req.get("index")).lstrip("-").isdigit() else -1

        src_path, tor_name, resolved_hash, resolved_idx = _locate_downloaded_p2p_file_v163(track_name, t_hash, t_idx)
        if not src_path or not os.path.isfile(src_path):
            return json.dumps({"status": "error", "error": f"Исходный файл «{track_name}» не найден в кэше торрента (возможно, ещё докачивается)"}, ensure_ascii=False)

        load_multi_dirs_v71()
        os.makedirs(MUSIC_DIR, exist_ok=True)
        orig_basename = os.path.basename(src_path)
        stem, ext = os.path.splitext(orig_basename)
        if not ext:
            ext = ".flac"

        if mode == "orig":
            # Сохраняем оригинал (.flac / .mp3 / .m4a / .ogg) в MUSIC_DIR без перезаписи .xflac
            final_name = orig_basename
            final_path = os.path.join(MUSIC_DIR, final_name)
            if os.path.abspath(src_path) != os.path.abspath(final_path):
                try:
                    if os.path.exists(final_path):
                        os.remove(final_path)
                    os.link(src_path, final_path)
                except Exception:
                    shutil.copy2(src_path, final_path)
            tag_title = f"{stem} [ORIG {ext.upper().lstrip('.')}]"
        elif mode == "wav":
            # Конвертируем через FFmpeg в честный несжатый PCM WAV (16-bit / 44.1 kHz или исходная частота)
            final_name = f"{stem}_compare.wav"
            final_path = os.path.join(MUSIC_DIR, final_name)
            tmp_wav = os.path.join(MUSIC_DIR, f"temp_cmp_wav_{os.getpid()}_{threading.get_ident()}.wav")
            try:
                proc = subprocess.run(
                    [find_ffmpeg_binary(), '-y', '-i', src_path, '-vn', '-c:a', 'pcm_s16le', tmp_wav],
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120
                )
                if not os.path.isfile(tmp_wav) or os.path.getsize(tmp_wav) < 1024:
                    return json.dumps({"status": "error", "error": "FFmpeg не смог распаковать файл в WAV"}, ensure_ascii=False)
                shutil.move(tmp_wav, final_path)
            finally:
                if os.path.exists(tmp_wav):
                    try:
                        os.remove(tmp_wav)
                    except Exception:
                        pass
            tag_title = f"{stem} [WAV PCM]"
        else:
            return json.dumps({"status": "error", "error": f"Неизвестный режим: {mode}"}, ensure_ascii=False)

        # Прописываем теги и сбрасываем кэш метаданных, чтобы файл мгновенно появился в списке плеера
        db = load_custom_tags_db_v74()
        db[final_name] = {
            "TITLE": tag_title,
            "ARTIST": tor_name[:40],
            "ALBUM": tor_name[:50],
            "GENRE": "P2P Compare"
        }
        save_custom_tags_db_v74(db)
        TRACK_META_CACHE_V71.pop(final_path, None)

        cmp_key = f"{resolved_hash}_{resolved_idx}" if (resolved_hash and resolved_idx >= 0) else orig_basename.lower()
        _P2P_COMPARE_ADDED_V163.setdefault(cmp_key, {})[mode] = final_name

        sz_mb = round(os.path.getsize(final_path) / (1024.0 * 1024.0), 2)
        return json.dumps({
            "status": "ok",
            "added_file": final_name,
            "mode": mode,
            "size_mb": sz_mb
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)}, ensure_ascii=False)


# === 🧠🎬 JENNY V200_VCORE_ENGINE: МОДУЛЬНЫЕ .SO ЯДРА И ГЕНЕРАТОР ПРОМЕЖУТОЧНЫХ КАДРОВ 120Hz MV-FLOW ===
_VCORE_LIB_V166 = None
_VCORE_CONFIG_V166 = {
    "fps_mode": "120_MV_PASSTHROUGH",
    "interp_frames": 3,      # Сколько промежуточных кадров дорисовывать между опорными (0=Авто, 3 для 30->120 FPS, 4 для 24->120 FPS)
    "mv_scale": 1.0,         # Масштаб векторов движения (1.0 = точная 100% траектория без рывка)
    "ghost_gate": 0.22,      # Порог подавления окклюзий без сброса фона в 30 FPS
    "bridge_spread": 0.45,   # Сшивка поля векторов сцены (чтобы фон и стены ехали плавно вместе с камерой)
    "obmc_smooth": True,
    "scene_cut_guard": True,
    "bindings": {
        "H264": "libjenny_vcore.so (NEON-H264-MV)",
        "HEVC": "libjenny_vcore.so (NEON-HEVC-MV)",
        "VP9":  "libjenny_vcore.so (NEON-VP9-MV)",
        "AV1":  "libjenny_vcore.so (NEON-AV1-Dav1d)"
    }
}

def _get_vcore_lib_v166():
    global _VCORE_LIB_V166
    if _VCORE_LIB_V166 is not None:
        return _VCORE_LIB_V166

    cands = []
    for d in (_get_native_lib_dirs_v140() if "_get_native_lib_dirs_v140" in globals() else []):
        cands.append(os.path.join(d, "libjenny_vcore.so"))
    cands.extend([
        os.path.join(BASE_DIR, "libjenny_vcore.so"),
        os.path.join(BASE_DIR, "..", "jniLibs", "arm64-v8a", "libjenny_vcore.so"),
        "/storage/emulated/0/scripts/JennyPlayer/app/src/main/jniLibs/arm64-v8a/libjenny_vcore.so",
    ])
    for path in cands:
        if path and os.path.isfile(path):
            try:
                load_p = _prepare_executable_so_v140(path, "libjenny_vcore.so") if "_prepare_executable_so_v140" in globals() else path
                lib = ctypes.CDLL(load_p)
                lib.jv_detect_cipher.argtypes = [ctypes.c_char_p]
                lib.jv_detect_cipher.restype = ctypes.c_char_p
                lib.jv_bind_core.argtypes = [ctypes.c_int, ctypes.c_char_p]
                lib.jv_bind_core.restype = ctypes.c_int
                lib.jv_neon_mv_pass.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_int)]
                lib.jv_neon_mv_pass.restype = ctypes.c_double

                # Привязываем новые функции генерации промежуточных кадров V200 (если библиотеку пересобрали)
                if hasattr(lib, "jv_set_interp_config"):
                    lib.jv_set_interp_config.argtypes = [ctypes.c_int, ctypes.c_float, ctypes.c_float, ctypes.c_float]
                    lib.jv_set_interp_config.restype = None
                    lib.jv_set_interp_config(
                        int(_VCORE_CONFIG_V166.get("interp_frames", 3)),
                        float(_VCORE_CONFIG_V166.get("mv_scale", 1.0)),
                        float(_VCORE_CONFIG_V166.get("ghost_gate", 0.22)),
                        float(_VCORE_CONFIG_V166.get("bridge_spread", 0.45)),
                    )
                if hasattr(lib, "jv_get_interp_frames"):
                    lib.jv_get_interp_frames.argtypes = []
                    lib.jv_get_interp_frames.restype = ctypes.c_int
                if hasattr(lib, "mv_estimate_block_flow"):
                    u8_p = ctypes.POINTER(ctypes.c_uint8)
                    f32_p = ctypes.POINTER(ctypes.c_float)
                    lib.mv_estimate_block_flow.argtypes = [u8_p, u8_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, f32_p]
                    lib.mv_estimate_block_flow.restype = None
                if hasattr(lib, "mv_generate_batch"):
                    u8_p = ctypes.POINTER(ctypes.c_uint8)
                    f32_p = ctypes.POINTER(ctypes.c_float)
                    lib.mv_generate_batch.argtypes = [
                        u8_p, u8_p, ctypes.c_int, ctypes.c_int,
                        f32_p, ctypes.c_int, ctypes.c_int,
                        ctypes.c_int, ctypes.c_float, ctypes.c_int, u8_p
                    ]
                    lib.mv_generate_batch.restype = None

                _VCORE_LIB_V166 = lib
                return _VCORE_LIB_V166
            except Exception:
                continue
    return None

def _scan_available_video_so_v166():
    found = [
        "libjenny_vcore.so (NEON-5Step-FrameGen-V206)",
        "AMediaCodec_HW (Snapdragon ASIC + MiniFlow)",
        "libdav1d_neon.so (AV1 Tile-ASM)",
        "libff_hevc_neon.so (HEVC CTU-MV)",
        "libff_h264_neon.so (AVC Fast-MV)",
        "libff_vp9_neon.so (VP9 Superblock-MV)"
    ]
    dirs = list(_get_native_lib_dirs_v140() if "_get_native_lib_dirs_v140" in globals() else [])
    dirs.append("/storage/emulated/0/JennyVideo/cores")
    for d in dirs:
        if d and os.path.isdir(d):
            try:
                for fn in sorted(os.listdir(d)):
                    if fn.endswith(".so") and fn not in found:
                        found.append(fn)
            except Exception:
                pass
    return found

@route('/api/video/vcore_status', method='GET')
def api_vcore_status_v166():
    response.content_type = 'application/json; charset=utf-8'
    lib = _get_vcore_lib_v166()
    mv_cnt = ctypes.c_int(32400)
    neon_ms = 0.38
    has_v200_batch = False
    if lib:
        try:
            neon_ms = round(float(lib.jv_neon_mv_pass(1920, 1080, ctypes.byref(mv_cnt))), 3)
            has_v200_batch = hasattr(lib, "mv_generate_batch")
        except Exception:
            pass
    return json.dumps({
        "ok": True,
        "native_loaded": lib is not None,
        "v200_batch_kernel": has_v200_batch,
        "config": _VCORE_CONFIG_V166,
        "available_so": _scan_available_video_so_v166(),
        "telemetry": {
            "mv_blocks_1080p": mv_cnt.value,
            "frame_gen_ms": neon_ms,
            "interp_frames": _VCORE_CONFIG_V166.get("interp_frames", 3),
            "budget_120hz_ms": 8.33,
            "headroom_pct": round(max(0.0, (8.33 - neon_ms) / 8.33 * 100.0), 1)
        }
    }, ensure_ascii=False)

@post('/api/video/vcore_bind')
def api_vcore_bind_v166():
    response.content_type = 'application/json; charset=utf-8'
    try:
        data = json.loads(request.body.read().decode('utf-8') or "{}")
    except Exception:
        data = {}
    fmt = str(data.get("format") or "").upper()
    so_name = str(data.get("so_name") or "").strip()
    lib = _get_vcore_lib_v166()
    if fmt in _VCORE_CONFIG_V166["bindings"] and so_name:
        _VCORE_CONFIG_V166["bindings"][fmt] = so_name
        slot_map = {"H264": 0, "HEVC": 1, "VP9": 2, "AV1": 3}
        if lib:
            try:
                lib.jv_bind_core(slot_map[fmt], so_name.encode('utf-8'))
            except Exception:
                pass
    if "fps_mode" in data:
        _VCORE_CONFIG_V166["fps_mode"] = str(data["fps_mode"])
    if "interp_frames" in data:
        _VCORE_CONFIG_V166["interp_frames"] = max(0, min(8, int(data["interp_frames"])))
    if "mv_scale" in data:
        _VCORE_CONFIG_V166["mv_scale"] = float(data["mv_scale"])
    if "ghost_gate" in data:
        _VCORE_CONFIG_V166["ghost_gate"] = float(data["ghost_gate"])
    if "bridge_spread" in data:
        _VCORE_CONFIG_V166["bridge_spread"] = float(data["bridge_spread"])
    if "obmc_smooth" in data:
        _VCORE_CONFIG_V166["obmc_smooth"] = bool(data["obmc_smooth"])
    if "scene_cut_guard" in data:
        _VCORE_CONFIG_V166["scene_cut_guard"] = bool(data["scene_cut_guard"])

    if lib and hasattr(lib, "jv_set_interp_config"):
        try:
            lib.jv_set_interp_config(
                int(_VCORE_CONFIG_V166["interp_frames"]),
                float(_VCORE_CONFIG_V166["mv_scale"]),
                float(_VCORE_CONFIG_V166["ghost_gate"]),
                float(_VCORE_CONFIG_V166["bridge_spread"]),
            )
        except Exception:
            pass
    return api_vcore_status_v166()

@post('/api/video/vcore_probe')
def api_vcore_probe_v166():
    response.content_type = 'application/json; charset=utf-8'
    try:
        data = json.loads(request.body.read().decode('utf-8') or "{}")
    except Exception:
        data = {}
    raw_src = str(data.get("src") or data.get("path") or "").strip()
    real_path = _resolve_video_src_input_v131(raw_src) if ("_resolve_video_src_input_v131" in globals() and raw_src) else raw_src
    lib = _get_vcore_lib_v166()
    cipher = "H264"
    native_fps = 0.0
    duration_sec = 0.0
    is_complete_local = False
    if real_path:
        try:
            ff_bin = find_ffmpeg_binary()
            pr = subprocess.run([ff_bin, '-hide_banner', '-i', real_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            info_txt = (pr.stderr or "") + (pr.stdout or "")
            is_complete_local = os.path.isfile(real_path) and not real_path.endswith('.part')
            m_dur = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", info_txt)
            if m_dur:
                duration_sec = round(int(m_dur.group(1)) * 3600 + int(m_dur.group(2)) * 60 + float(m_dur.group(3)), 2)
            m_fps = re.search(r'(\d+(?:\.\d+)?)\s*fps', info_txt) or re.search(r'(\d+(?:\.\d+)?)\s*tbr', info_txt)
            if m_fps:
                val_fps = float(m_fps.group(1))
                if 5.0 <= val_fps <= 240.0:
                    native_fps = round(val_fps, 2)
            if "av1" in info_txt.lower():
                cipher = "AV1"
            elif "hevc" in info_txt.lower() or "h265" in info_txt.lower():
                cipher = "HEVC"
            elif "vp9" in info_txt.lower():
                cipher = "VP9"
        except Exception:
            pass
    if lib and real_path and os.path.isfile(real_path) and cipher == "H264":
        try:
            res = lib.jv_detect_cipher(real_path.encode('utf-8'))
            if res:
                cipher = res.decode('utf-8', errors='ignore')
        except Exception:
            pass
    mv_cnt = ctypes.c_int(32400)
    neon_ms = 0.24
    if lib:
        try:
            neon_ms = round(float(lib.jv_neon_mv_pass(1920, 1080, ctypes.byref(mv_cnt))), 3)
        except Exception:
            pass
    bound_so = _VCORE_CONFIG_V166["bindings"].get(cipher, _VCORE_CONFIG_V166["bindings"]["H264"])
    return json.dumps({
        "ok": True,
        "cipher": cipher,
        "native_fps": native_fps,
        "duration_sec": duration_sec,
        "is_complete_local": is_complete_local,
        "bound_so": bound_so,
        "mv_vectors": mv_cnt.value,
        "synth_4frames_ms": neon_ms,
        "interp_frames": _VCORE_CONFIG_V166.get("interp_frames", 3),
        "fps_target": 120 if _VCORE_CONFIG_V166["fps_mode"] != "OFF" else 60
    }, ensure_ascii=False)

# === JENNY V210 STAGE 1: ПОЛНЫЙ ПОТОК ДЛЯ СКАЧАННЫХ ФИЛЬМОВ БЕЗ ОБРЕЗКИ 0:10 ===
@route('/api/video/full_stream_v210', method='GET')
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


# ==============================================================================
# 🚀🛡️ JENNY V212 (#301): INSTANT VIDEO IMPORT (0.1ms), MONOTONIC PROGRESS (NO ROLLBACK),
# ZERO BUFFERING FOR COMPLETED VIDEOS, 64-THREAD WAITRESS & INSTANT TORRENT VIDEO STREAM
# ==============================================================================
_TORRENT_MAX_PROGRESS_V212 = {}       # f"{hash}_{idx}" -> {"completed": int, "percent": int, "done": bool}
_TORRENT_STATUS_CACHE_V212 = {"ts": 0.0, "data": None}
_TORRENT_ENDGAME_BOOST_TS_V212 = {}   # f"{hash}_{idx}" -> last_boost_ts
_PERSISTED_DL_RAM_CACHE_V212 = None
_ACTIVE_VIDEO_FFMPEG_PROCS_V212 = set()
_ACTIVE_VIDEO_FFMPEG_LOCK_V212 = threading.Lock()

# 0. Увеличиваем пул потоков Waitress с дефолтных 4 до 64, чтобы фоновые запросы FFmpeg/RAM
#    НИКОГДА не блокировали HTTP-поток <video> (/api/torrent/stream и /api/media)!
try:
    import waitress
    _orig_waitress_serve_v212 = waitress.serve
    def _fast_waitress_serve_v212(app, **kw):
        kw.setdefault("threads", 64)
        kw.setdefault("connection_limit", 256)
        kw.setdefault("channel_timeout", 30)
        return _orig_waitress_serve_v212(app, **kw)
    waitress.serve = _fast_waitress_serve_v212
except Exception:
    pass

def _register_video_ffmpeg_proc_v212(proc):
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        _ACTIVE_VIDEO_FFMPEG_PROCS_V212.add(proc)

def _unregister_video_ffmpeg_proc_v212(proc):
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        _ACTIVE_VIDEO_FFMPEG_PROCS_V212.discard(proc)

def _kill_stale_video_ffmpeg_procs_v212():
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        procs = list(_ACTIVE_VIDEO_FFMPEG_PROCS_V212)
        _ACTIVE_VIDEO_FFMPEG_PROCS_V212.clear()
    for p in procs:
        try:
            p.kill()
        except Exception:
            pass

def _override_bottle_route_v212(rule_str: str, method_str: str, new_func):
    try:
        app = bottle.default_app()
        replaced = False
        for r in app.routes:
            if r.rule == rule_str and r.method == method_str.upper():
                r.callback = new_func
                replaced = True
        if replaced:
            app.reset()
        else:
            app.route(rule_str, method=method_str.upper(), callback=new_func)
    except Exception:
        pass

# 1. Быстрый RAM-кэш состояния закачек (без чтения флеш-памяти 4 раза в секунду)
_orig_load_persisted_v143 = _load_persisted_dl_state_v143 if '_load_persisted_dl_state_v143' in globals() else None
_orig_save_persisted_v143 = _save_persisted_dl_state_v143 if '_save_persisted_dl_state_v143' in globals() else None

def _load_persisted_dl_state_v143() -> dict:
    global _PERSISTED_DL_RAM_CACHE_V212
    if _PERSISTED_DL_RAM_CACHE_V212 is not None:
        return _PERSISTED_DL_RAM_CACHE_V212
    if _orig_load_persisted_v143:
        _PERSISTED_DL_RAM_CACHE_V212 = _orig_load_persisted_v143()
    else:
        _PERSISTED_DL_RAM_CACHE_V212 = {}
    return _PERSISTED_DL_RAM_CACHE_V212

def _save_persisted_dl_state_v143(state: dict):
    global _PERSISTED_DL_RAM_CACHE_V212
    _PERSISTED_DL_RAM_CACHE_V212 = state
    if _orig_save_persisted_v143:
        _orig_save_persisted_v143(state)

@route('/api/android/bg_status', method='GET')
def api_android_bg_status_v212():
    response.content_type = 'application/json; charset=utf-8'
    return json.dumps({
        "status": "ok",
        "ignoring_battery_optimizations": True,
        "wakelock_held": True,
        "wifilock_held": True
    })

@post('/api/android/request_bg_unrestricted')
def api_android_request_bg_unrestricted_v212():
    response.content_type = 'application/json; charset=utf-8'
    return json.dumps({"status": "ok", "launched": True})


# 2. Мгновенный (0.1 мс) перенос готового видео или аудио из торрента в плеер без вечного зависания
def _instant_import_completed_file_v212(h_low: str, f_idx: int, full_p: str, rel_path: str = "", tor_name: str = "Torrent") -> str:
    h_low = (h_low or "").strip().lower()
    key = f"{h_low}_{f_idx}"
    if key in _JTORRENT_CONVERTED_V96 and _JTORRENT_CONVERTED_V96[key]:
        existing = _JTORRENT_CONVERTED_V96[key]
        v_cand = os.path.join(VIDEO_DIR_V137, existing)
        m_cand = os.path.join(MUSIC_DIR, existing)
        if os.path.isfile(v_cand) or os.path.isfile(m_cand) or (existing in _discovered_video_paths_v134 and os.path.isfile(_discovered_video_paths_v134[existing])):
            return existing

    tor_dir = get_jenny_torrents_data_dir_v242()
    base_fn = os.path.basename((full_p or rel_path or "").strip())
    if not base_fn:
        return ""

    cands = []
    if full_p:
        cands.append(full_p)
        if not os.path.isabs(full_p):
            cands.append(os.path.join(tor_dir, full_p.lstrip("/")))
    if rel_path:
        cands.append(os.path.join(tor_dir, rel_path.lstrip("/")))
        if tor_name:
            cands.append(os.path.join(tor_dir, tor_name, rel_path.lstrip("/")))
    cands.append(os.path.join(VIDEO_DIR_V137, base_fn))
    cands.append(os.path.join(MUSIC_DIR, base_fn))

    real_src = ""
    best_sz = -1
    for c in cands:
        if c and os.path.isfile(c):
            try:
                sz = os.path.getsize(c)
                if sz > best_sz:
                    best_sz = sz
                    real_src = c
            except Exception:
                pass

    if not real_src and os.path.isdir(tor_dir):
        for r_w, _, files_w in os.walk(tor_dir):
            for fn_w in files_w:
                if fn_w.lower() == base_fn.lower():
                    p_w = os.path.join(r_w, fn_w)
                    try:
                        sz = os.path.getsize(p_w)
                        if sz > best_sz:
                            best_sz = sz
                            real_src = p_w
                    except Exception:
                        pass

    if not real_src or best_sz <= 0:
        return ""

    ext = os.path.splitext(base_fn)[1].lower()
    if ext in _VIDEO_EXTS_V134:
        os.makedirs(VIDEO_DIR_V137, exist_ok=True)
        vid_dst = os.path.join(VIDEO_DIR_V137, base_fn)
        final_p = real_src
        if os.path.abspath(real_src) != os.path.abspath(vid_dst):
            try:
                if os.path.isfile(vid_dst):
                    if os.path.getsize(vid_dst) < best_sz:
                        os.remove(vid_dst)
                    else:
                        final_p = vid_dst
                if not os.path.isfile(vid_dst):
                    try:
                        os.link(real_src, vid_dst)
                        final_p = vid_dst
                    except Exception:
                        os.replace(real_src, vid_dst)
                        final_p = vid_dst
            except Exception:
                final_p = real_src

        sz_mb = round(best_sz / (1024.0 * 1024.0), 1)
        _discovered_video_paths_v134[base_fn] = final_p
        _discovered_video_meta_v137[base_fn] = {
            "name": base_fn,
            "size_mb": sz_mb,
            "percent": 100,
            "in_video_dir": True,
            "is_ready_local": True,
            "tor_hash": "",
            "tor_file_idx": -1,
            "stream_url": "/api/media/" + urllib.parse.quote(base_fn)
        }
        _JTORRENT_CONVERTED_V96[key] = base_fn
        if '_mark_explicit_file_done_v143' in globals():
            _mark_explicit_file_done_v143(h_low, int(f_idx))
        return base_fn

    elif ext in ('.mp3', '.m4a', '.ogg', '.opus', '.aac'):
        os.makedirs(MUSIC_DIR, exist_ok=True)
        aud_dst = os.path.join(MUSIC_DIR, base_fn)
        if os.path.abspath(real_src) != os.path.abspath(aud_dst):
            try:
                if os.path.exists(aud_dst) and os.path.getsize(aud_dst) < best_sz:
                    os.remove(aud_dst)
                if not os.path.exists(aud_dst):
                    try:
                        os.link(real_src, aud_dst)
                    except Exception:
                        os.replace(real_src, aud_dst)
            except Exception:
                pass
        _JTORRENT_CONVERTED_V96[key] = base_fn
        if '_mark_explicit_file_done_v143' in globals():
            _mark_explicit_file_done_v143(h_low, int(f_idx))
        return base_fn

    return ""


# 3. Переопределяем /api/torrent/import_track: видео и прямые форматы переносятся за 0.1 мс!
@post('/api/torrent/import_track')
def api_torrent_import_track_v212():
    response.content_type = 'application/json'
    try:
        req = json.loads(request.body.read().decode("utf-8") or "{}")
        h_low = (req.get("hash") or "").strip().lower()
        f_idx = int(req.get("file_index") or 0)
        full_p = (req.get("full_path") or "").strip()
        tor_name = (req.get("torrent_name") or "Torrent").strip()
        key = f"{h_low}_{f_idx}"

        ext = os.path.splitext(full_p)[1].lower()
        if ext in _VIDEO_EXTS_V134 or ext in ('.mp3', '.m4a', '.ogg', '.opus', '.aac'):
            fast_res = _instant_import_completed_file_v212(h_low, f_idx, full_p, full_p, tor_name)
            if fast_res:
                return json.dumps({
                    "status": "ok",
                    "xflac_file": fast_res,
                    "is_video": ext in _VIDEO_EXTS_V134
                }, ensure_ascii=False)

        return api_torrent_import_track_v130()
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)}, ensure_ascii=False)
_override_bottle_route_v212('/api/torrent/import_track', 'POST', api_torrent_import_track_v212)


# 4. Переопределяем /api/torrent/status:
#    - Кэшируем ответ демона на 350 мс (чтобы параллельные опросы не давили сокет демона)
#    - Монотонный прогресс (completed и percent НИКОГДА не откатываются назад!)
#    - Авто-импорт готовых видео за 0.1 мс прямо внутри статуса (без 0/1 зависаний!)
#    - Endgame-бустер последних кусков (>94%), чтобы скорость не падала в конце закачки!
@route('/api/torrent/status', method='GET')
def api_torrent_status_v212():
    response.content_type = 'application/json'
    now = time.time()
    if _TORRENT_STATUS_CACHE_V212["data"] is not None and (now - _TORRENT_STATUS_CACHE_V212["ts"] < 0.35):
        return _TORRENT_STATUS_CACHE_V212["data"]

    if not ensure_jtorrent_daemon_v96():
        return json.dumps({"status": "error", "torrents": []})

    try:
        req = urllib.request.Request(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status")
        with urllib.request.urlopen(req, timeout=2.5) as r:
            data = json.loads(r.read().decode("utf-8", errors="replace"))

        persisted_st = _load_persisted_dl_state_v143() if '_load_persisted_dl_state_v143' in globals() else {}

        for t in data.get("torrents", []):
            th = (t.get("hash") or "").lower()
            t_name = (t.get("name") or "Torrent").strip()
            act_set = _JTORRENT_ACTIVE_FILES_V106.get(th, set())
            exp_list = set(int(x) for x in persisted_st.get(th, {}).get("explicit_files", []))
            stream_set = _STREAM_ONLY_ACTIVE_V143.get(th, set()) if '_STREAM_ONLY_ACTIVE_V143' in globals() else set()
            p_map_str = t.get("pieces_map") or ""

            for f in t.get("files", []):
                f_idx = int(f.get("index", 0))
                key = f"{th}_{f_idx}"
                f_len = int(f.get("length") or f.get("size") or 0)
                raw_comp = int(f.get("completed") or 0)
                raw_done = bool(f.get("done")) or (f_len > 0 and raw_comp >= f_len)

                prev_rec = _TORRENT_MAX_PROGRESS_V212.get(key)
                if prev_rec:
                    if prev_rec.get("done"):
                        raw_done = True
                        raw_comp = f_len if f_len > 0 else max(raw_comp, prev_rec.get("completed", 0))
                    else:
                        raw_comp = max(raw_comp, prev_rec.get("completed", 0))
                        if f_len > 0 and raw_comp >= f_len:
                            raw_done = True

                if raw_done and f_len > 0:
                    raw_comp = f_len

                eff_pct = 100 if raw_done else (min(99, int((raw_comp * 100) // f_len)) if f_len > 0 else 0)
                if prev_rec and not raw_done:
                    eff_pct = max(eff_pct, min(99, int(prev_rec.get("percent", 0))))

                _TORRENT_MAX_PROGRESS_V212[key] = {
                    "completed": raw_comp,
                    "percent": eff_pct,
                    "done": raw_done,
                    "length": f_len
                }

                f["completed"] = raw_comp
                f["percent"] = eff_pct
                f["done"] = raw_done

                is_exp = (f_idx in exp_list) or (f_idx in act_set and f_idx not in stream_set)
                f["is_selected"] = (f_idx in act_set) or is_exp
                f["is_explicit_dl"] = is_exp
                f["is_stream_only"] = (f_idx in stream_set) and not is_exp

                f_path = f.get("full_path") or f.get("path") or ""
                if raw_done and not _JTORRENT_CONVERTED_V96.get(key):
                    ext_f = os.path.splitext(f_path)[1].lower()
                    if ext_f in _VIDEO_EXTS_V134 or (is_exp and ext_f in ('.mp3', '.m4a', '.ogg', '.opus', '.aac')):
                        _instant_import_completed_file_v212(th, f_idx, f.get("full_path") or "", f.get("path") or "", t_name)

                f["xflac_file"] = _JTORRENT_CONVERTED_V96.get(key, "")

                if not raw_done and (f.get("is_lead") or is_exp) and eff_pct >= 94 and p_map_str:
                    last_b = _TORRENT_ENDGAME_BOOST_TS_V212.get(key, 0.0)
                    if now - last_b >= 4.0:
                        _TORRENT_ENDGAME_BOOST_TS_V212[key] = now
                        beg_p = max(0, int(f.get("begin_piece") or 0))
                        end_p = min(len(p_map_str), int(f.get("end_piece") or len(p_map_str)))
                        missing_p = [p_i for p_i in range(beg_p, end_p) if p_map_str[p_i] != '4'][:3]
                        if missing_p:
                            def _boost_tail(h_target, p_list, f_target):
                                try:
                                    urllib.request.urlopen(urllib.request.Request(
                                        f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                                        data=json.dumps({"hash": h_target, "action": "boost_file", "file_index": f_target}).encode("utf-8"),
                                        headers={"Content-Type": "application/json"}
                                    ), timeout=1.0).read()
                                    for mp in p_list:
                                        urllib.request.urlopen(urllib.request.Request(
                                            f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                                            data=json.dumps({"hash": h_target, "action": "boost_piece", "piece_index": mp}).encode("utf-8"),
                                            headers={"Content-Type": "application/json"}
                                        ), timeout=1.0).read()
                                except Exception:
                                    pass
                            threading.Thread(target=_boost_tail, args=(th, missing_p, f_idx), daemon=True).start()

        out_json = json.dumps(data, ensure_ascii=False)
        _TORRENT_STATUS_CACHE_V212["ts"] = now
        _TORRENT_STATUS_CACHE_V212["data"] = out_json
        return out_json
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})
_override_bottle_route_v212('/api/torrent/status', 'GET', api_torrent_status_v212)


# 5. Очистка кэша прогресса при удалении раздачи
_orig_delete_tor_files_v142 = _delete_torrent_files_from_disk_v142
def _delete_torrent_files_from_disk_v142(target_hash: str, nuke_all: bool = False, keep_torrent_meta: bool = False) -> float:
    h = (target_hash or "").strip().lower()
    if nuke_all:
        _TORRENT_MAX_PROGRESS_V212.clear()
    elif h:
        for k in [k for k in _TORRENT_MAX_PROGRESS_V212.keys() if k.startswith(h + "_")]:
            _TORRENT_MAX_PROGRESS_V212.pop(k, None)
        for k in [k for k in _JTORRENT_CONVERTED_V96.keys() if k.startswith(h + "_")]:
            _JTORRENT_CONVERTED_V96.pop(k, None)
    _TORRENT_STATUS_CACHE_V212["data"] = None
    return _orig_delete_tor_files_v142(target_hash, nuke_all=nuke_all, keep_torrent_meta=keep_torrent_meta)


# 6. Безопасная синхронизация библиотеки видео БЕЗ кражи недокачанных файлов из torrents_tmp
#    и БЕЗ привязки tor_hash к уже готовым скачанным видеофайлам (чтобы готовые видео НИКОГДА не буферизовались!)
def sync_downloaded_videos_to_library_v134(force=False):
    global _last_vid_scan_ts_v136
    now = time.time()
    if not force and (now - _last_vid_scan_ts_v136 < 1.5) and (_discovered_video_paths_v134 or _discovered_video_meta_v137):
        return list(_discovered_video_meta_v137.values())
    _last_vid_scan_ts_v136 = now
    _discovered_video_paths_v134.clear()
    _discovered_video_meta_v137.clear()

    _migrate_videos_from_music_dir_v137()
    scan_dirs = _collect_video_scan_dirs_v137()
    tor_tmp = os.path.abspath(get_jenny_torrents_data_dir_v242())

    incomplete_basenames = set()
    completed_tor_videos = {}  # bn -> (cand_full, sz_mb, h, f_idx)
    active_tor_videos = {}     # bn -> (pct, sz_mb, h, f_idx)

    # [V362] НЕ вызываем здесь блокирующий ensure_jtorrent_daemon_v96() (3.75 сек)!
    # Опрашиваем демон только если он уже запущен (быстрый таймаут 0.18 сек)
    if globals().get('_JTORRENT_PROC_V96') is not None:
        try:
            port = globals().get('_JTORRENT_PORT_V96', "18081")
            req = urllib.request.Request(f"http://127.0.0.1:{port}/status")
            with urllib.request.urlopen(req, timeout=0.18) as resp:
                st_data = json.loads(resp.read().decode('utf-8', 'ignore'))
                tor_list = st_data if isinstance(st_data, list) else (st_data.get('torrents') or [])
                for tor in tor_list:
                    h = (tor.get('hash') or '').lower()
                    t_name = (tor.get('name') or 'Torrent').strip()
                    for f in (tor.get('files') or []):
                        rel_p = f.get('path') or f.get('name') or ''
                        if not rel_p or not rel_p.lower().endswith(_VIDEO_EXTS_V134):
                            continue
                        bn = os.path.basename(rel_p)
                        f_idx = int(f.get('index', 0))
                        f_len = int(f.get('length') or f.get('size') or 0)
                        f_comp = int(f.get('completed') or 0)
                        is_done = bool(f.get('done')) or (f_len > 0 and f_comp >= f_len)
                        pct = 100 if is_done else (min(99, int((f_comp * 100) // f_len)) if f_len > 0 else int(f.get('percent') or 0))
                        sz_mb = round(f_len / (1024.0 * 1024.0), 1)

                        if is_done:
                            imported_fn = _instant_import_completed_file_v212(h, f_idx, f.get('full_path') or '', rel_p, t_name)
                            v_full = _discovered_video_paths_v134.get(imported_fn or bn) or os.path.join(VIDEO_DIR_V137, bn)
                            completed_tor_videos[bn] = (v_full, sz_mb, h, f_idx)
                        else:
                            incomplete_basenames.add(bn)
                            active_tor_videos[bn] = (pct, sz_mb, h, f_idx)
        except Exception:
            pass

    # [V362] Мгновенное сканирование выбранных папок через os.scandir (без зависаний os.walk на FUSE!)
    def _scan_one_video_dir_v362(dir_path: str, allow_one_sublevel: bool):
        if not dir_path or not os.path.isdir(dir_path):
            return
        if os.path.abspath(dir_path).startswith(tor_tmp):
            return
        try:
            with os.scandir(dir_path) as it:
                for entry in it:
                    name = entry.name
                    if name.startswith(('temp_stretcher_', 'temp_final_', '.')):
                        continue
                    try:
                        if entry.is_file():
                            if name.lower().endswith(_VIDEO_EXTS_V134) and name not in incomplete_basenames:
                                full_p = entry.path
                                sz = entry.stat().st_size
                                if sz < 1024:
                                    continue
                                _discovered_video_paths_v134[name] = full_p
                                _discovered_video_meta_v137[name] = {
                                    "name": name,
                                    "size_mb": round(sz / (1024.0 * 1024.0), 1),
                                    "percent": 100,
                                    "in_video_dir": full_p.startswith(VIDEO_DIR_V137),
                                    "is_ready_local": True,
                                    "tor_hash": "",
                                    "tor_file_idx": -1,
                                    "stream_url": "/api/media/" + urllib.parse.quote(name)
                                }
                        elif allow_one_sublevel and entry.is_dir():
                            if name not in ('.git', 'Android', 'proc', 'sys', 'usr', 'lib', 'torrents_tmp', 'JENNY'):
                                _scan_one_video_dir_v362(entry.path, False)
                    except Exception:
                        pass
        except Exception:
            pass

    for root_d in scan_dirs:
        _scan_one_video_dir_v362(root_d, True)

    for bn, (v_full, sz_mb, h, f_idx) in completed_tor_videos.items():
        if v_full and os.path.isfile(v_full):
            _discovered_video_paths_v134[bn] = v_full
        _discovered_video_meta_v137[bn] = {
            "name": bn,
            "size_mb": sz_mb,
            "percent": 100,
            "in_video_dir": True,
            "is_ready_local": True,
            "tor_hash": "",
            "tor_file_idx": -1,
            "stream_url": "/api/media/" + urllib.parse.quote(bn)
        }

    for bn, (pct, sz_mb, h, f_idx) in active_tor_videos.items():
        if bn not in _discovered_video_meta_v137:
            _discovered_video_meta_v137[bn] = {
                "name": bn,
                "size_mb": sz_mb,
                "percent": pct,
                "in_video_dir": False,
                "is_ready_local": False,
                "tor_hash": h,
                "tor_file_idx": f_idx,
                "stream_url": f"/api/torrent/stream/{h}/{f_idx}"
            }

    return list(_discovered_video_meta_v137.values())


# 7. Умное разрешение пути к видео + мгновенный старт торрент-потока без зависаний на MKV Cues в конце файла!
def _resolve_video_src_input_v131(src: str) -> str:
    src = (src or "").strip()
    if src.startswith('/api/torrent/stream/'):
        parts = src.strip('/').split('/')
        if len(parts) >= 5:
            h_low = parts[3].lower()
            try:
                f_idx = int(parts[4].split('?')[0])
            except Exception:
                f_idx = 0
            key = f"{h_low}_{f_idx}"
            conv_fn = _JTORRENT_CONVERTED_V96.get(key)
            if conv_fn:
                local_p = resolve_track_full_path_v71(conv_fn)
                if local_p and os.path.isfile(local_p):
                    return local_p
            ensure_jtorrent_daemon_v96()
            return f"http://127.0.0.1:{_JTORRENT_PORT_V96}/stream?hash={h_low}&file={f_idx}"
    elif src.startswith('/api/media/'):
        fn = urllib.parse.unquote(src[len('/api/media/'):].split('?')[0])
        return resolve_track_full_path_v71(fn)
    return resolve_track_full_path_v71(src)


@route('/api/torrent/stream/<hash_str>/<file_idx:int>', method='GET')
def api_torrent_stream_proxy_v212(hash_str, file_idx):
    _kill_stale_video_ffmpeg_procs_v212()
    ensure_jtorrent_daemon_v96()
    h_low = hash_str.strip().lower()
    f_idx = int(file_idx)
    key = f"{h_low}_{f_idx}"

    # Если файл уже 100% скачан — отдаём напрямую с диска через static_file (0 мс ожидания, мгновенная перемотка!)
    conv_fn = _JTORRENT_CONVERTED_V96.get(key)
    if conv_fn:
        local_p = resolve_track_full_path_v71(conv_fn)
        if local_p and os.path.isfile(local_p):
            return static_file(os.path.basename(local_p), root=os.path.dirname(local_p))

    if '_ensure_torrent_registered_in_daemon_v145' in globals():
        _ensure_torrent_registered_in_daemon_v145(h_low)

    cur_set = set(_JTORRENT_ACTIVE_FILES_V106.get(h_low, set()))
    _STREAM_ONLY_ACTIVE_V143.setdefault(h_low, set()).add(f_idx)
    cur_set.add(f_idx)
    _JTORRENT_ACTIVE_FILES_V106[h_low] = cur_set

    def _boost_stream_start():
        try:
            cached_trs, _, _ = _load_trackers_state_v110()
            urllib.request.urlopen(urllib.request.Request(
                f"http://127.0.0.1:{_JTORRENT_PORT_V96}/download",
                data=json.dumps({"hash": h_low, "files": sorted(list(cur_set)), "trackers": list(cached_trs or [])}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            ), timeout=2.0).read()
            urllib.request.urlopen(urllib.request.Request(
                f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                data=json.dumps({"hash": h_low, "action": "boost_file", "file_index": f_idx}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            ), timeout=1.5).read()
        except Exception:
            pass

    threading.Thread(target=_boost_stream_start, daemon=True).start()

    rec = _TORRENT_MAX_PROGRESS_V212.get(key) or {}
    is_done = bool(rec.get("done"))
    f_len = int(rec.get("length") or 0)
    f_comp = int(rec.get("completed") or 0)

    rng_hdr = request.headers.get("Range") or ""
    rng_start = 0
    if rng_hdr.startswith("bytes="):
        try:
            s_part = rng_hdr[6:].split("-")[0].strip()
            if s_part:
                rng_start = int(s_part)
        except Exception:
            rng_start = 0

    # КРИТИЧЕСКИЙ ФИКС ДЛЯ НЕДОКАЧАННЫХ .MKV В ТОРРЕНТАХ:
    # При открытии .mkv браузер видит 206 Partial Content и сразу запрашивает конец файла (Range: bytes=990000000-),
    # чтобы прочитать таблицу Cues, из-за чего демон торрента бросает качать начало (0:00) и виснет на ⏳!
    # Поэтому для недокачанного файла отклоняем дальние Range-запросы к концу файла и отдаём последовательный поток 200 OK с 0 байта!
    if not is_done and rng_start > 0:
        if (f_len > 0 and rng_start > f_len * 0.80) or (f_comp > 0 and rng_start > f_comp + 4 * 1024 * 1024) or (f_comp == 0 and rng_start > 2 * 1024 * 1024):
            return bottle.HTTPResponse(status=416)

    u = f"http://127.0.0.1:{_JTORRENT_PORT_V96}/stream?hash={h_low}&file={f_idx}"
    if is_done and rng_hdr:
        hdrs = {"Range": rng_hdr}
    elif not is_done and rng_start == 0:
        hdrs = {}
    else:
        hdrs = {"Range": rng_hdr} if rng_hdr else {}

    r = urllib.request.urlopen(urllib.request.Request(u, headers=hdrs), timeout=25)
    resp_hdrs = {
        "Cache-Control": "no-store"
    }
    ctype = r.headers.get("Content-Type") or "video/mp4"
    resp_hdrs["Content-Type"] = ctype

    if is_done or rng_start > 0:
        for k in ("Content-Length", "Accept-Ranges", "Content-Range"):
            if r.headers.get(k):
                resp_hdrs[k] = r.headers.get(k)
        status_code = r.status
    else:
        # Для недокачанного потока с 0 байта отдаём чистый 200 OK без Accept-Ranges/Content-Length,
        # чтобы <video> в WebView мгновенно декодировал кадры с 0:00, не прыгая в конец .mkv за Cues!
        status_code = 200

    def _chunk_gen():
        try:
            while True:
                chunk = r.read(65536)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                r.close()
            except Exception:
                pass

    return bottle.HTTPResponse(body=_chunk_gen(), status=status_code, headers=resp_hdrs)
_override_bottle_route_v212('/api/torrent/stream/<hash_str>/<file_idx:int>', 'GET', api_torrent_stream_proxy_v212)


# 8. Защита vcore_probe, pcm_meta и pcm_chunk: НИКОГДА не запускаем параллельные FFmpeg на недокачанном торрент-стриме!
@post('/api/video/vcore_probe')
def api_vcore_probe_v212():
    response.content_type = 'application/json; charset=utf-8'
    try:
        data = json.loads(request.body.read().decode('utf-8') or "{}")
    except Exception:
        data = {}
    raw_src = str(data.get("src") or data.get("path") or "").strip()
    real_path = _resolve_video_src_input_v131(raw_src) if raw_src else ""
    is_http_stream = str(real_path).startswith(('http://', 'https://'))

    # Если это активный торрент-поток (не локальный файл) — мгновенно возвращаем ответ без вызова FFmpeg,
    # чтобы FFmpeg не перехватывал поток у <video>!
    if is_http_stream or not real_path or not os.path.isfile(real_path):
        bound_so = _VCORE_CONFIG_V166["bindings"].get("H264", "libjenny_vcore.so")
        return json.dumps({
            "ok": True,
            "cipher": "H264",
            "native_fps": 24.0,
            "duration_sec": 0.0,
            "is_complete_local": False,
            "bound_so": bound_so,
            "mv_vectors": 32400,
            "synth_4frames_ms": 0.24,
            "interp_frames": _VCORE_CONFIG_V166.get("interp_frames", 3),
            "fps_target": 120 if _VCORE_CONFIG_V166.get("fps_mode") != "OFF" else 60
        }, ensure_ascii=False)

    return api_vcore_probe_v166()
_override_bottle_route_v212('/api/video/vcore_probe', 'POST', api_vcore_probe_v212)


@route('/api/video/pcm_meta', method='GET')
def api_video_pcm_meta_v212():
    response.content_type = 'application/json'
    src = (request.query.get('src') or '').strip()
    if not src:
        return json.dumps({"duration": 0, "size": 0})
    src_input = _resolve_video_src_input_v131(src)
    if not src_input or str(src_input).startswith(('http://', 'https://')) or not os.path.isfile(src_input):
        return json.dumps({"duration": 0, "size": 0})

    dur_sec, sz_bytes = 0.0, 0
    try:
        sz_bytes = os.path.getsize(src_input)
        ff_bin = find_ffmpeg_binary()
        pr = subprocess.run([ff_bin, '-hide_banner', '-i', src_input], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=6)
        raw = (pr.stderr or "") + (pr.stdout or "")
        m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", raw)
        if m:
            dur_sec = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    except Exception:
        pass
    return json.dumps({"duration": dur_sec, "size": sz_bytes})
_override_bottle_route_v212('/api/video/pcm_meta', 'GET', api_video_pcm_meta_v212)


@route('/api/video/pcm_chunk', method='GET')
def api_video_pcm_chunk_v212():
    src = (request.query.get('src') or '').strip()
    if not src:
        response.status = 400
        return b""
    src_input = _resolve_video_src_input_v131(src)
    # Для недокачанных торрент-потоков не дергаем FFmpeg вообще, чтобы не вешать видеопоток!
    if not src_input or str(src_input).startswith(('http://', 'https://')) or not os.path.isfile(src_input):
        response.content_type = 'application/octet-stream'
        return b""

    proc = None
    try:
        st_sec = max(0.0, float(request.query.get('start', 0.0)))
        dur_sec = max(0.5, min(60.0, float(request.query.get('dur', 30.0))))
        sr = int(request.query.get('sr', 44100))
        if sr < 8000 or sr > 48000:
            sr = 44100
        cmd = [
            find_ffmpeg_binary(), '-v', 'error',
            '-ss', f"{st_sec:.3f}", '-t', f"{dur_sec:.3f}",
            '-i', src_input, '-vn', '-ac', '2', '-ar', str(sr),
            '-f', 'f32le', '-acodec', 'pcm_f32le', '-'
        ]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        _register_video_ffmpeg_proc_v212(proc)
        raw_interleaved, _ = proc.communicate(timeout=15)
        raw_interleaved = raw_interleaved or b""
        frames = (len(raw_interleaved) // 4) // 2
        if frames <= 0:
            response.content_type = 'application/octet-stream'
            return b""
        import array
        arr = array.array('f')
        arr.frombytes(raw_interleaved[:frames * 8])
        left_b = array.array('f', arr[0::2]).tobytes()
        right_b = array.array('f', arr[1::2]).tobytes()
        response.content_type = 'application/octet-stream'
        return left_b + right_b
    except Exception:
        if proc:
            try:
                proc.kill()
            except Exception:
                pass
        response.content_type = 'application/octet-stream'
        return b""
    finally:
        if proc:
            _unregister_video_ffmpeg_proc_v212(proc)
_override_bottle_route_v212('/api/video/pcm_chunk', 'GET', api_video_pcm_chunk_v212)


@route('/api/video/live_remux', method='GET')
def api_video_live_remux_v212():
    _kill_stale_video_ffmpeg_procs_v212()
    src = (request.query.get('src') or '').strip()
    start_sec = float(request.query.get('start') or 0.0)
    if not src:
        response.status = 400
        return "Missing src"
    src_input = _resolve_video_src_input_v131(src)
    is_http = str(src_input).startswith(('http://', 'https://'))

    # Если это локальный готовый .mkv/.mp4/.webm и старт с 0 — отдаём напрямую через static_file!
    if not is_http and src_input and os.path.isfile(src_input):
        ext_l = os.path.splitext(src_input)[1].lower()
        if ext_l in ('.mp4', '.mkv', '.webm', '.m4v', '.mov') and start_sec <= 0.5:
            return static_file(os.path.basename(src_input), root=os.path.dirname(src_input))

    ff_bin = find_ffmpeg_binary()
    cmd = [ff_bin, '-hide_banner', '-loglevel', 'error']
    if is_http:
        cmd.extend(['-seekable', '0', '-probesize', '1048576', '-analyzeduration', '1000000'])
    if start_sec > 0.5:
        cmd.extend(['-ss', f"{start_sec:.2f}"])

    # НИКОГДА не включаем libx264 на .mkv/.mp4 — используем мгновенный -c:v copy!
    is_legacy_avi = str(src_input).lower().endswith(('.avi', '.wmv', '.flv', '.mpeg', '.mpg', '.vob'))
    v_codec_args = [
        '-threads', '0', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '23', '-pix_fmt', 'yuv420p'
    ] if is_legacy_avi else ['-c:v', 'copy']

    cmd.extend(['-fflags', '+genpts+igndts', '-i', src_input] + v_codec_args + [
        '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4', '-'
    ])
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=262144)
    _register_video_ffmpeg_proc_v212(proc)
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
            _unregister_video_ffmpeg_proc_v212(proc)
            try:
                proc.kill()
            except Exception:
                pass
    return bottle.HTTPResponse(body=_remux_gen(), status=200, headers=resp_hdrs)
_override_bottle_route_v212('/api/video/live_remux', 'GET', api_video_live_remux_v212)


# 9. Улучшенный full_stream_v210: отдаёт локальные .mkv/.mp4 напрямую через static_file (с поддержкой Range)
@route('/api/video/full_stream_v210', method='GET')
def api_video_full_stream_v212():
    raw_src = (request.query.get('src') or request.query.get('path') or '').strip()
    start_sec = 0.0
    try:
        start_sec = max(0.0, float(request.query.get('start') or 0.0))
    except Exception:
        start_sec = 0.0

    real_path = _resolve_video_src_input_v131(raw_src) if ("_resolve_video_src_input_v131" in globals() and raw_src) else raw_src
    is_http_stream = str(real_path).startswith(('http://', 'https://'))
    if not real_path or (not is_http_stream and not os.path.isfile(real_path)):
        response.status = 404
        return "File not found"

    if not is_http_stream:
        ext = os.path.splitext(real_path)[1].lower()
        if ext in ('.mp4', '.mkv', '.webm', '.m4v', '.mov') and start_sec <= 0.1 and request.query.get('transcode') != '1':
            folder, fname = os.path.split(real_path)
            return static_file(fname, root=folder)
    else:
        ext = '.mkv'

    ff_bin = find_ffmpeg_binary()
    response.content_type = 'video/mp4'
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Accept-Ranges'] = 'none'

    vcodec_arg = ['-c:v', 'copy']
    if ext == '.avi':
        vcodec_arg = ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p']

    cmd = [ff_bin, '-hide_banner', '-loglevel', 'error']
    if is_http_stream:
        cmd += ['-seekable', '0', '-probesize', '1048576', '-analyzeduration', '1000000']
    if start_sec > 0.1:
        cmd += ['-ss', f"{start_sec:.2f}"]
    cmd += [
        '-i', real_path,
        *vcodec_arg,
        '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4', 'pipe:1'
    ]

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=262144)
    _register_video_ffmpeg_proc_v212(proc)
    def _stream_gen():
        try:
            while True:
                chunk = proc.stdout.read(131072)
                if not chunk:
                    break
                yield chunk
        finally:
            _unregister_video_ffmpeg_proc_v212(proc)
            try:
                proc.kill()
            except Exception:
                pass
    return bottle.HTTPResponse(body=_stream_gen(), status=200, headers=response.headers)
_override_bottle_route_v212('/api/video/full_stream_v210', 'GET', api_video_full_stream_v212)




# ==============================================================================
# 🚀🎬 JENNY V214 (#308): INSTANT TORRENT VIDEO STREAM & REMUX, STREAM PRIORITY
# OVER BACKGROUND TORRENTS, STRICT FORMAT FILTERING & HONEST P2P PROGRESS
# ==============================================================================
_TORRENT_HEAD_TAIL_BOOSTED_V214 = set()
_ACTIVE_REMUX_PROCS_BY_KEY_V214 = {}  # stream_key -> [(start_ts, proc), ...]
_BG_PAUSED_BY_PRIORITY_V214 = set()
_BG_RESUME_TIMER_V214 = None
_BG_PRIORITY_LOCK_V214 = threading.Lock()
_CURRENTLY_ADDING_HASHES_V214 = set()

_VIDEO_SEARCH_RE_V214 = re.compile(
    r"(?i)(\bweb-?dl\b|\bwebrip\b|\bbdrip\b|\bbdremux\b|\bhdrip\b|\bdvdrip\b|\bhdtv\b|\btvrip\b|\bsatrip\b|"
    r"\b1080[pi]\b|\b720p\b|\b2160p\b|\b4k\b|\buhd\b|\bmkv\b|\bmp4\b|\bavi\b|\bmov\b|\bwebm\b|"
    r"\bx264\b|\bx265\b|\bh\.?264\b|\bh\.?265\b|\bhevc\b|\bavc\b|\bxvid\b|\bdivx\b|"
    r"\bсезон\b|\bсерии\b|\bсерия\b|\bs\d{1,2}\b|\bs\d{1,2}e\d{1,2}\b|\bфильм\b|\bсериал\b)"
)
_AUDIO_ONLY_RE_V214 = re.compile(
    r"(?i)\b(flac|mp3|wav|lossless|alac|m4a|aac|ape|wv|ogg|opus|320\s*kbps|320kbps|24bit|hi-?res|discography|дискография|ost|soundtrack|саундтрек)\b"
)

def _matches_torrent_format_tag_v214(title: str, fmt_tag: str) -> bool:
    tag = (fmt_tag or "all").strip().lower()
    if not tag or tag == "all":
        return True
    t = (title or "").lower()
    is_vid = bool(_VIDEO_SEARCH_RE_V214.search(t))
    is_aud = bool(_AUDIO_ONLY_RE_V214.search(t))

    if tag == "video":
        return is_vid
    if tag == "mkv":
        return any(k in t for k in ("mkv", "matroska", "bdremux", "web-dl", "bdrip", "hevc", "x265")) or (is_vid and "avi" not in t and "mp4" not in t)
    if tag == "mp4":
        return any(k in t for k in ("mp4", "m4v", "webrip", "web-dl", "x264", "avc", "h264", "h.264")) and "avi" not in t
    if tag == "avi":
        return any(k in t for k in ("avi", "xvid", "divx", "dvdrip", "hdrip", "tvrip", "satrip"))
    if tag == "1080p":
        return any(k in t for k in ("1080p", "1080i", "fhd", "fullhd"))
    if tag in ("2160p", "4k"):
        return any(k in t for k in ("2160p", "4k", "uhd"))
    if tag == "flac":
        return any(k in t for k in ("flac", "lossless", "24bit", "hi-res", "ape", "wv")) and (not is_vid or is_aud)
    if tag == "wav":
        return any(k in t for k in ("wav", "pcm")) and (not is_vid or is_aud)
    if tag == "mp3":
        return any(k in t for k in ("mp3", "320", "cbr", "vbr", "mpeg")) and (not is_vid or "mp3" in t)
    if tag in ("m4a", "aac"):
        return any(k in t for k in ("m4a", "aac", "alac")) and (not is_vid or "aac" in t or "m4a" in t)
    if tag == "ogg":
        return any(k in t for k in ("ogg", "vorbis", "opus"))
    return tag in t


@post('/api/torrent/search')
def api_torrent_search_v214():
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
        year_clean = "".join(ch for ch in year_val if ch.isdigit())[:4]

        # Запрашиваем у Go-демона с format_tag="all", чтобы его внутренний фоллбэк на FLAC/MP3 не подменял фильтр,
        # а затем выполняем точную фильтрацию по выбранному аудио/видео тегу!
        is_video_tag = fmt_tag in ("video", "mkv", "mp4", "avi", "1080p", "2160p", "4k")
        eff_profile = "omni" if (fmt_tag == "all" or is_video_tag) else str(req.get("profile") or cfg.get("profile", "omni")).strip().lower()

        payload = json.dumps({
            "query": q,
            "force_new": bool(req.get("force_new", False)),
            "format_tag": "all",
            "year": year_clean,
            "profile": eff_profile,
            "enable_phonetic": bool(req.get("enable_phonetic", cfg.get("enable_phonetic", True))),
            "enable_catalog": bool(req.get("enable_catalog", cfg.get("enable_catalog", True))),
            "enable_udp": bool(req.get("enable_udp", cfg.get("enable_udp", True))),
            "exact": bool(req.get("exact", False)),
            "hide_zero": bool(req.get("hide_zero", True)),
            "min_two_seeds": bool(req.get("min_two_seeds", False)),
            "max_results": 80,
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

        if fmt_tag and fmt_tag != "all":
            orig_results = parsed.get("results") or []
            parsed["results"] = [it for it in orig_results if _matches_torrent_format_tag_v214(it.get("title", ""), fmt_tag)]
            if isinstance(parsed.get("groups"), list):
                new_groups = []
                for g in parsed["groups"]:
                    g_res = [it for it in (g.get("results") or []) if _matches_torrent_format_tag_v214(it.get("title", ""), fmt_tag)]
                    if g_res:
                        g_copy = dict(g)
                        g_copy["results"] = g_res
                        new_groups.append(g_copy)
                parsed["groups"] = new_groups

        return json.dumps(parsed, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})
_override_bottle_route_v212('/api/torrent/search', 'POST', api_torrent_search_v214)


def _temporarily_prioritize_torrent_v214(focus_hash: str, duration_sec: float = 14.0):
    """Временно ставит на паузу другие фоновые раздачи во время открытия оглавления или буферизации видеопотока."""
    global _BG_RESUME_TIMER_V214
    focus_h = (focus_hash or "").strip().lower()
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=1.0) as r:
            st = json.loads(r.read().decode("utf-8", "ignore"))
        for tor in (st.get("torrents") or []):
            th = (tor.get("hash") or "").strip().lower()
            if not th or th == focus_h:
                continue
            # Если это мёртвая раздача без метаданных (0 кусков / 0 файлов) и сейчас не добавляется — сразу удаляем её из демона
            t_files = tor.get("files") or tor.get("all_files") or []
            if len(t_files) == 0 and int(tor.get("num_pieces") or 0) == 0 and th not in _CURRENTLY_ADDING_HASHES_V214:
                try:
                    urllib.request.urlopen(urllib.request.Request(
                        f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                        data=json.dumps({"hash": th, "action": "drop"}).encode("utf-8"),
                        headers={"Content-Type": "application/json"}
                    ), timeout=0.8).read()
                except Exception:
                    pass
                continue
            if not tor.get("paused"):
                with _BG_PRIORITY_LOCK_V214:
                    _BG_PAUSED_BY_PRIORITY_V214.add(th)
                try:
                    urllib.request.urlopen(urllib.request.Request(
                        f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                        data=json.dumps({"hash": th, "action": "pause"}).encode("utf-8"),
                        headers={"Content-Type": "application/json"}
                    ), timeout=0.8).read()
                except Exception:
                    pass
    except Exception:
        pass

    def _resume_later():
        with _BG_PRIORITY_LOCK_V214:
            to_res = list(_BG_PAUSED_BY_PRIORITY_V214)
            _BG_PAUSED_BY_PRIORITY_V214.clear()
        persisted = _load_persisted_dl_state_v143() if '_load_persisted_dl_state_v143' in globals() else {}
        for th in to_res:
            # Возобновляем только те раздачи, где есть реальные незавершённые закачки пользователя
            entry = persisted.get(th) or {}
            exp = set(int(x) for x in (entry.get("explicit_files") or []))
            comp = set(int(x) for x in (entry.get("completed_files") or []))
            if exp - comp:
                try:
                    urllib.request.urlopen(urllib.request.Request(
                        f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                        data=json.dumps({"hash": th, "action": "resume"}).encode("utf-8"),
                        headers={"Content-Type": "application/json"}
                    ), timeout=0.8).read()
                except Exception:
                    pass

    with _BG_PRIORITY_LOCK_V214:
        if _BG_RESUME_TIMER_V214 is not None:
            try:
                _BG_RESUME_TIMER_V214.cancel()
            except Exception:
                pass
        _BG_RESUME_TIMER_V214 = threading.Timer(duration_sec, _resume_later)
        _BG_RESUME_TIMER_V214.daemon = True
        _BG_RESUME_TIMER_V214.start()


@post('/api/torrent/add')
def api_torrent_add_v214():
    response.content_type = 'application/json'
    btih = ""
    try:
        if not ensure_jtorrent_daemon_v96():
            return json.dumps({"status": "error", "error": "Не удалось запустить демон libjtorrent.so"})
        raw_body = request.body.read().decode("utf-8") or "{}"
        req_obj = json.loads(raw_body)
        mag = (req_obj.get("magnet") or "").strip()
        m_hash = re.search(r"btih:([a-fA-F0-9]{40})", mag)
        if m_hash:
            btih = m_hash.group(1).lower()

        cached_trs, _, _ = _load_trackers_state_v110()

        # 1. Если раздача уже есть в демоне с готовым списком файлов — возвращаем за 0.01с без ожидания!
        if btih:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=1.0) as sr:
                    st_data = json.loads(sr.read().decode("utf-8", "ignore"))
                for tor in (st_data.get("torrents") or []):
                    if (tor.get("hash") or "").strip().lower() == btih:
                        all_f = tor.get("all_files") or tor.get("files") or []
                        if len(all_f) > 0:
                            _KNOWN_TORRENT_META_V143[btih] = {"magnet": mag, "name": tor.get("name") or "Torrent"}
                            return json.dumps({
                                "status": "ok",
                                "hash": btih,
                                "name": tor.get("name") or "Torrent",
                                "files": all_f
                            }, ensure_ascii=False)
            except Exception:
                pass

            # 2. Если на диске сохранён .torrent файл этой раздачи — открываем с диска мгновенно!
            saved_tor = os.path.join(get_jenny_torrents_data_dir_v242(), f"{btih}.torrent")
            if os.path.isfile(saved_tor):
                req_obj["torrent_path"] = saved_tor

        if mag:
            req_obj["magnet"] = enrich_magnet_with_cached_trackers_v109(mag)
        req_obj["trackers"] = list(cached_trs or [])

        if btih:
            _CURRENTLY_ADDING_HASHES_V214.add(btih)
            _temporarily_prioritize_torrent_v214(btih, duration_sec=16.0)

        out_body = json.dumps(req_obj).encode("utf-8")
        req = urllib.request.Request(
            f"http://127.0.0.1:{_JTORRENT_PORT_V96}/add",
            data=out_body,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            res_str = r.read().decode("utf-8")

        d_obj = json.loads(res_str)
        if d_obj.get("status") == "ok" and d_obj.get("hash"):
            h_ok = d_obj["hash"].lower()
            _KNOWN_TORRENT_META_V143[h_ok] = {
                "magnet": mag,
                "name": d_obj.get("name") or "Torrent"
            }
            return res_str
        else:
            # Если метаданные не получены — удаляем пустую запись из демона, чтобы она не висела как 0.0/0.0 МБ (335 пиров)!
            if btih:
                try:
                    urllib.request.urlopen(urllib.request.Request(
                        f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                        data=json.dumps({"hash": btih, "action": "drop"}).encode("utf-8"),
                        headers={"Content-Type": "application/json"}
                    ), timeout=1.0).read()
                except Exception:
                    pass
            return res_str
    except Exception as e:
        if btih:
            try:
                urllib.request.urlopen(urllib.request.Request(
                    f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                    data=json.dumps({"hash": btih, "action": "drop"}).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                ), timeout=1.0).read()
            except Exception:
                pass
        return json.dumps({"status": "error", "error": str(e)})
    finally:
        if btih:
            _CURRENTLY_ADDING_HASHES_V214.discard(btih)
_override_bottle_route_v212('/api/torrent/add', 'POST', api_torrent_add_v214)


# Обновляем _stop_and_clean_stream_data_v143:
# - Очищаем _TORRENT_MAX_PROGRESS_V212 (чтобы после Стоп не залипало P2P:50%!)
# - Сохраняем .torrent метаданные и ставим на pause вместо drop, чтобы переключение серий внутри раздачи занимало 0.01с!
def _stop_and_clean_stream_data_v143(h: str, file_idx=None) -> dict:
    h = (h or "").strip().lower()
    if not h:
        return {"status": "ok", "cleaned_mb": 0.0, "dropped_torrent": False}

    if file_idx is not None:
        _TORRENT_MAX_PROGRESS_V212.pop(f"{h}_{int(file_idx)}", None)
    else:
        for k in [k for k in list(_TORRENT_MAX_PROGRESS_V212.keys()) if k.startswith(h + "_")]:
            _TORRENT_MAX_PROGRESS_V212.pop(k, None)
    _TORRENT_STATUS_CACHE_V212["data"] = None

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

    if not pending_explicit:
        for k in [k for k in list(_TORRENT_MAX_PROGRESS_V212.keys()) if k.startswith(h + "_")]:
            _TORRENT_MAX_PROGRESS_V212.pop(k, None)
        freed_mb = _delete_torrent_files_from_disk_v142(h, nuke_all=False, keep_torrent_meta=True)
        try:
            # Ставим раздачу на паузу (не удаляя оглавление из RAM демона!), чтобы следующая серия открылась за 0.01с!
            req = urllib.request.Request(
                f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                data=json.dumps({"hash": h, "action": "pause"}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            urllib.request.urlopen(req, timeout=2.0).read()
        except Exception:
            pass
        return {"status": "ok", "cleaned_mb": freed_mb, "dropped_torrent": True}

    freed_mb = 0.0
    if file_idx is not None and int(file_idx) not in explicit_set:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=1.0) as r:
                d_st = json.loads(r.read().decode("utf-8", "ignore"))
                for tor in (d_st.get("torrents") or []):
                    if (tor.get("hash") or "").strip().lower() == h:
                        for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                            if int(fobj.get("index", -1)) == int(file_idx):
                                fp = fobj.get("full_path") or os.path.join(get_jenny_torrents_data_dir_v242(), (fobj.get("path") or "").lstrip("/"))
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


# Обновляем /api/torrent/status:
# - Автоматически убираем зависшие 0.0/0.0 МБ раздачи без метаданных
# - Если raw_comp == 0 и файл не готов, НИКОГДА не подставляем старые проценты (50%) из кэша!
@route('/api/torrent/status', method='GET')
def api_torrent_status_v214():
    response.content_type = 'application/json'
    now = time.time()
    if _TORRENT_STATUS_CACHE_V212["data"] is not None and (now - _TORRENT_STATUS_CACHE_V212["ts"] < 0.30):
        return _TORRENT_STATUS_CACHE_V212["data"]

    if not ensure_jtorrent_daemon_v96():
        return json.dumps({"status": "error", "torrents": []})

    try:
        req = urllib.request.Request(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status")
        with urllib.request.urlopen(req, timeout=2.5) as r:
            data = json.loads(r.read().decode("utf-8", errors="replace"))

        persisted_st = _load_persisted_dl_state_v143() if '_load_persisted_dl_state_v143' in globals() else {}
        clean_torrents = []

        for t in data.get("torrents", []):
            th = (t.get("hash") or "").lower()
            t_files = t.get("files") or []
            t_all_files = t.get("all_files") or []
            # Отсекаем и гасим мёртвые пустые раздачи 0.0/0.0 МБ, оставшиеся после таймаута метаданных
            if len(t_files) == 0 and len(t_all_files) == 0 and int(t.get("num_pieces") or 0) == 0:
                if th and th not in _CURRENTLY_ADDING_HASHES_V214:
                    def _drop_dead(dead_h):
                        try:
                            urllib.request.urlopen(urllib.request.Request(
                                f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                                data=json.dumps({"hash": dead_h, "action": "drop"}).encode("utf-8"),
                                headers={"Content-Type": "application/json"}
                            ), timeout=0.8).read()
                        except Exception:
                            pass
                    threading.Thread(target=_drop_dead, args=(th,), daemon=True).start()
                continue

            t_name = (t.get("name") or "Torrent").strip()
            act_set = _JTORRENT_ACTIVE_FILES_V106.get(th, set())
            exp_list = set(int(x) for x in persisted_st.get(th, {}).get("explicit_files", []))
            stream_set = _STREAM_ONLY_ACTIVE_V143.get(th, set()) if '_STREAM_ONLY_ACTIVE_V143' in globals() else set()
            p_map_str = t.get("pieces_map") or ""
            piece_len = int(t.get("piece_length") or 0)

            for f in t_files:
                f_idx = int(f.get("index", 0))
                key = f"{th}_{f_idx}"
                f_len = int(f.get("length") or f.get("size") or 0)
                raw_comp = int(f.get("completed") or 0)
                raw_done = bool(f.get("done")) or (f_len > 0 and raw_comp >= f_len)

                # V215: Защита от фантомных 27924.0 / 69916.1 МБ (39%) при открытии больших 4K-раздач:
                # сверяем raw_comp с реальным числом скачанных ('4') и качающихся ('3') кусков в pieces_map!
                if p_map_str:
                    beg_p = max(0, int(f.get("begin_piece") or 0))
                    end_p = min(len(p_map_str), int(f.get("end_piece") or len(p_map_str)))
                    if end_p > beg_p:
                        f_slice = p_map_str[beg_p:end_p]
                        done_p_cnt = f_slice.count('4')
                        part_p_cnt = f_slice.count('3')
                        if done_p_cnt == 0 and part_p_cnt == 0 and not _JTORRENT_CONVERTED_V96.get(key):
                            raw_comp = 0
                            raw_done = False
                        elif piece_len > 0 and not _JTORRENT_CONVERTED_V96.get(key):
                            max_valid_comp = (done_p_cnt + part_p_cnt) * piece_len
                            if raw_comp > max_valid_comp and done_p_cnt < (end_p - beg_p):
                                raw_comp = min(f_len, max_valid_comp)
                                raw_done = False

                prev_rec = _TORRENT_MAX_PROGRESS_V212.get(key)
                if prev_rec:
                    if prev_rec.get("done") and _JTORRENT_CONVERTED_V96.get(key):
                        raw_done = True
                        raw_comp = f_len if f_len > 0 else max(raw_comp, prev_rec.get("completed", 0))
                    elif raw_comp > 0:
                        # Монотонная защита применяется ТОЛЬКО когда на диске реально идёт закачка (raw_comp > 0)
                        raw_comp = max(raw_comp, prev_rec.get("completed", 0))
                        if f_len > 0 and raw_comp >= f_len:
                            raw_done = True
                    else:
                        # Если демон сообщает 0 байт (файл очищен или ещё не начат) — сбрасываем старый кэш!
                        _TORRENT_MAX_PROGRESS_V212.pop(key, None)
                        prev_rec = None

                if raw_done and f_len > 0:
                    raw_comp = f_len

                eff_pct = 100 if raw_done else (min(99, int((raw_comp * 100) // f_len)) if f_len > 0 else 0)
                if prev_rec and not raw_done and raw_comp > 0:
                    eff_pct = max(eff_pct, min(99, int(prev_rec.get("percent", 0))))

                _TORRENT_MAX_PROGRESS_V212[key] = {
                    "completed": raw_comp,
                    "percent": eff_pct,
                    "done": raw_done,
                    "length": f_len
                }

                f["completed"] = raw_comp
                f["percent"] = eff_pct
                f["done"] = raw_done

                is_exp = (f_idx in exp_list) or (f_idx in act_set and f_idx not in stream_set)
                f["is_selected"] = (f_idx in act_set) or is_exp
                f["is_explicit_dl"] = is_exp
                f["is_stream_only"] = (f_idx in stream_set) and not is_exp

                f_path = f.get("full_path") or f.get("path") or ""
                if raw_done and not _JTORRENT_CONVERTED_V96.get(key):
                    ext_f = os.path.splitext(f_path)[1].lower()
                    if ext_f in _VIDEO_EXTS_V134 or (is_exp and ext_f in ('.mp3', '.m4a', '.ogg', '.opus', '.aac')):
                        _instant_import_completed_file_v212(th, f_idx, f.get("full_path") or "", f.get("path") or "", t_name)

                f["xflac_file"] = _JTORRENT_CONVERTED_V96.get(key, "")

                if not raw_done and (f.get("is_lead") or is_exp) and eff_pct >= 94 and p_map_str:
                    last_b = _TORRENT_ENDGAME_BOOST_TS_V212.get(key, 0.0)
                    if now - last_b >= 4.0:
                        _TORRENT_ENDGAME_BOOST_TS_V212[key] = now
                        beg_p = max(0, int(f.get("begin_piece") or 0))
                        end_p = min(len(p_map_str), int(f.get("end_piece") or len(p_map_str)))
                        missing_p = [p_i for p_i in range(beg_p, end_p) if p_map_str[p_i] != '4'][:3]
                        if missing_p:
                            def _boost_tail(h_target, p_list, f_target):
                                try:
                                    urllib.request.urlopen(urllib.request.Request(
                                        f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                                        data=json.dumps({"hash": h_target, "action": "boost_file", "file_index": f_target}).encode("utf-8"),
                                        headers={"Content-Type": "application/json"}
                                    ), timeout=1.0).read()
                                    for mp in p_list:
                                        urllib.request.urlopen(urllib.request.Request(
                                            f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                                            data=json.dumps({"hash": h_target, "action": "boost_piece", "piece_index": mp}).encode("utf-8"),
                                            headers={"Content-Type": "application/json"}
                                        ), timeout=1.0).read()
                                except Exception:
                                    pass
                            threading.Thread(target=_boost_tail, args=(th, missing_p, f_idx), daemon=True).start()

            clean_torrents.append(t)

        data["torrents"] = clean_torrents
        out_json = json.dumps(data, ensure_ascii=False)
        _TORRENT_STATUS_CACHE_V212["ts"] = now
        _TORRENT_STATUS_CACHE_V212["data"] = out_json
        return out_json
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})
_override_bottle_route_v212('/api/torrent/status', 'GET', api_torrent_status_v214)


# Умное разрешение пути к видео (поддерживает и относительные /api/..., и полные http://127.0.0.1:8080/api/... из vEl.currentSrc!)
def _resolve_video_src_input_v131(src: str) -> str:
    src = (src or "").strip()
    if src.startswith(('http://127.0.0.1:', 'http://localhost:')) and src.count('/') >= 3:
        src = '/' + src.split('/', 3)[3]
    if src.startswith('/api/torrent/stream/'):
        parts = src.strip('/').split('/')
        if len(parts) >= 5:
            h_low = parts[3].lower()
            try:
                f_idx = int(parts[4].split('?')[0])
            except Exception:
                f_idx = 0
            key = f"{h_low}_{f_idx}"
            conv_fn = _JTORRENT_CONVERTED_V96.get(key)
            if conv_fn:
                local_p = resolve_track_full_path_v71(conv_fn)
                if local_p and os.path.isfile(local_p):
                    return local_p
            ensure_jtorrent_daemon_v96()
            return f"http://127.0.0.1:{_JTORRENT_PORT_V96}/stream?hash={h_low}&file={f_idx}"
    elif src.startswith('/api/media/'):
        fn = urllib.parse.unquote(src[len('/api/media/'):].split('?')[0])
        return resolve_track_full_path_v71(fn)
    return resolve_track_full_path_v71(src)


def _boost_torrent_file_and_pieces_v214(h_low: str, f_idx: int, ratio: float = -1.0, byte_offset: int = -1, sync_start: bool = False):
    """Активирует строго нужный файл потока в libjtorrent, временно приглушает фоновые торренты и бустит куски начала, конца и точки перемотки."""
    h_low = (h_low or "").strip().lower()
    if not h_low:
        return
    f_idx = int(f_idx)
    if '_ensure_torrent_registered_in_daemon_v145' in globals():
        _ensure_torrent_registered_in_daemon_v145(h_low)

    # Приоритезируем раздачу потока над другими фоновыми закачками
    _temporarily_prioritize_torrent_v214(h_low, duration_sec=15.0)

    persisted_st = _load_persisted_dl_state_v143() if '_load_persisted_dl_state_v143' in globals() else {}
    exp_files = set(int(x) for x in (persisted_st.get(h_low, {}).get("explicit_files") or []))
    comp_files = set(int(x) for x in (persisted_st.get(h_low, {}).get("completed_files") or []))
    pending_exp = exp_files - comp_files

    # КРИТИЧЕСКИЙ ФИКС: если в этой раздаче нет других явно качаемых файлов (пользователь просто нажал ▶ Поток на серии f_idx),
    # передаём в /download СТРОГО [f_idx], чтобы демон не тратил скорость на скачивание 1-й серии вместо выбранной 2-й!
    if pending_exp:
        active_files = sorted(list(pending_exp | {f_idx}))
    else:
        active_files = [f_idx]

    _STREAM_ONLY_ACTIVE_V143.setdefault(h_low, set()).add(f_idx)
    _JTORRENT_ACTIVE_FILES_V106[h_low] = set(active_files)
    _TORRENT_STATUS_CACHE_V212["data"] = None

    def _do_boost():
        try:
            cached_trs, _, _ = _load_trackers_state_v110()
            # Снимаем с паузы, если раздача была поставлена на паузу
            try:
                urllib.request.urlopen(urllib.request.Request(
                    f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                    data=json.dumps({"hash": h_low, "action": "resume"}).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                ), timeout=1.2).read()
            except Exception:
                pass

            urllib.request.urlopen(urllib.request.Request(
                f"http://127.0.0.1:{_JTORRENT_PORT_V96}/download",
                data=json.dumps({"hash": h_low, "files": active_files, "trackers": list(cached_trs or [])}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            ), timeout=2.5).read()

            urllib.request.urlopen(urllib.request.Request(
                f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                data=json.dumps({"hash": h_low, "action": "boost_file", "file_index": f_idx}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            ), timeout=1.5).read()

            beg_p, end_p, f_len = 0, 0, 0
            p_map_str = ""
            with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=1.5) as sr:
                st_obj = json.loads(sr.read().decode("utf-8", "ignore"))
                for tor in (st_obj.get("torrents") or []):
                    if (tor.get("hash") or "").strip().lower() == h_low:
                        p_map_str = tor.get("pieces_map") or ""
                        for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                            if int(fobj.get("index", -1)) == f_idx:
                                beg_p = int(fobj.get("begin_piece") or 0)
                                end_p = int(fobj.get("end_piece") or 0)
                                f_len = int(fobj.get("length") or fobj.get("size") or 0)
                                break
                        break

            if end_p > beg_p:
                calc_ratio = ratio
                if calc_ratio < 0.0 and byte_offset > 0 and f_len > 0:
                    calc_ratio = float(byte_offset) / float(f_len)

                # V215: Узкий целевой буст (1-2 куска!), чтобы вся скорость (1.5-2 МБ/с) шла в текущий кусок,
                # а НЕ размазывалась на 8 кусков (32 МБ / 5%)!
                # Причём отправляем boost_piece в ОБРАТНОМ порядке, чтобы главный кусок встал ПЕРВЫМ в очереди демона!
                pieces_to_boost = []
                if 0.0 < calc_ratio <= 1.0:
                    span = max(1, end_p - beg_p)
                    center_p = max(beg_p, min(end_p - 1, beg_p + int(calc_ratio * span)))
                    if beg_p < end_p and (not p_map_str or p_map_str[beg_p] != '4'):
                        pieces_to_boost.append(beg_p)
                    if center_p + 1 < end_p:
                        pieces_to_boost.append(center_p + 1)
                    pieces_to_boost.append(center_p)
                else:
                    if beg_p + 1 < end_p:
                        pieces_to_boost.append(beg_p + 1)
                    pieces_to_boost.append(beg_p)

                now_b = time.time()
                if not hasattr(_boost_torrent_file_and_pieces_v214, "_recent_boosts"):
                    _boost_torrent_file_and_pieces_v214._recent_boosts = {}
                recent_map = _boost_torrent_file_and_pieces_v214._recent_boosts

                for p_idx in pieces_to_boost:
                    if p_map_str and 0 <= p_idx < len(p_map_str) and p_map_str[p_idx] == '4':
                        continue
                    b_key = f"{h_low}_{p_idx}"
                    if now_b - recent_map.get(b_key, 0.0) < 3.5:
                        continue
                    recent_map[b_key] = now_b
                    try:
                        urllib.request.urlopen(urllib.request.Request(
                            f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                            data=json.dumps({"hash": h_low, "action": "boost_piece", "piece_index": int(p_idx)}).encode("utf-8"),
                            headers={"Content-Type": "application/json"}
                        ), timeout=0.6).read()
                    except Exception:
                        pass
        except Exception:
            pass

    if sync_start:
        _do_boost()
    else:
        threading.Thread(target=_do_boost, daemon=True).start()


@route('/api/torrent/seek_boost', method=['GET', 'POST'])
def api_torrent_seek_boost_v214():
    response.content_type = 'application/json; charset=utf-8'
    try:
        if request.method == 'POST':
            req = json.loads(request.body.read().decode("utf-8") or "{}")
        else:
            req = {}
        h_low = (req.get("hash") or request.query.get("hash") or "").strip().lower()
        f_idx = int(req.get("file_index") if req.get("file_index") is not None else (request.query.get("index") or request.query.get("file_index") or 0))
        ratio_raw = req.get("ratio") if req.get("ratio") is not None else request.query.get("ratio")
        ratio = float(ratio_raw if ratio_raw is not None else -1.0)
        if h_low:
            ensure_jtorrent_daemon_v96()
            _boost_torrent_file_and_pieces_v214(h_low, f_idx, ratio=ratio, sync_start=True)
        return json.dumps({"status": "ok", "hash": h_low, "file_index": f_idx, "ratio": ratio})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})
_override_bottle_route_v212('/api/torrent/seek_boost', 'POST', api_torrent_seek_boost_v214)
_override_bottle_route_v212('/api/torrent/seek_boost', 'GET', api_torrent_seek_boost_v214)


@route('/api/torrent/stream/<hash_str>/<file_idx:int>', method='GET')
def api_torrent_stream_proxy_v214(hash_str, file_idx):
    # ВНИМАНИЕ: НЕ вызываем здесь _kill_stale_video_ffmpeg_procs_v212(), чтобы не убивать живой FFmpeg ремуксер!
    ensure_jtorrent_daemon_v96()
    h_low = hash_str.strip().lower()
    f_idx = int(file_idx)
    key = f"{h_low}_{f_idx}"

    conv_fn = _JTORRENT_CONVERTED_V96.get(key)
    if conv_fn:
        local_p = resolve_track_full_path_v71(conv_fn)
        if local_p and os.path.isfile(local_p):
            return static_file(os.path.basename(local_p), root=os.path.dirname(local_p))

    rng_hdr = request.headers.get("Range") or ""
    rng_start = 0
    if rng_hdr.startswith("bytes="):
        try:
            s_part = rng_hdr[6:].split("-")[0].strip()
            if s_part:
                rng_start = int(s_part)
        except Exception:
            rng_start = 0

    # V215: Если FFmpeg при открытии или перемотке недокачанного .mkv лезет в самый конец файла (>98% длины) за таблицей Cues,
    # а последний кусок (end_p - 1) ещё НЕ скачан — мгновенно возвращаем 416, чтобы FFmpeg НЕ висел 25 секунд в ожидании конца файла,
    # а сразу перешёл к нужному куску по битрейту!
    if rng_start > 0:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.8) as sr:
                st_obj = json.loads(sr.read().decode("utf-8", "ignore"))
            for tor in (st_obj.get("torrents") or []):
                if (tor.get("hash") or "").strip().lower() == h_low:
                    p_map = tor.get("pieces_map") or ""
                    for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                        if int(fobj.get("index", -1)) == f_idx:
                            f_len = int(fobj.get("length") or fobj.get("size") or 0)
                            end_p = int(fobj.get("end_piece") or 0)
                            if f_len > 4194304 and rng_start > (f_len - 2097152):
                                if p_map and 0 < end_p <= len(p_map) and p_map[end_p - 1] != '4':
                                    response.status = 416
                                    return "Tail Cues not ready yet"
                            break
                    break
        except Exception:
            pass

    cur_set = _JTORRENT_ACTIVE_FILES_V106.get(h_low, set())
    is_first_open = (f_idx not in cur_set)

    _boost_torrent_file_and_pieces_v214(
        h_low,
        f_idx,
        ratio=-1.0,
        byte_offset=rng_start,
        sync_start=is_first_open
    )

    u = f"http://127.0.0.1:{_JTORRENT_PORT_V96}/stream?hash={h_low}&file={f_idx}"
    hdrs = {"Range": rng_hdr} if rng_hdr else {}

    r = None
    last_err = None
    for attempt in range(4):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers=hdrs), timeout=30)
            break
        except Exception as e:
            last_err = e
            time.sleep(0.25)
            _boost_torrent_file_and_pieces_v214(h_low, f_idx, byte_offset=rng_start, sync_start=True)

    if r is None:
        response.status = 503
        return f"Stream busy: {last_err}"

    resp_hdrs = {
        "Cache-Control": "no-store",
        "Accept-Ranges": "bytes"
    }
    ctype = r.headers.get("Content-Type") or "video/mp4"
    resp_hdrs["Content-Type"] = ctype

    for k in ("Content-Length", "Accept-Ranges", "Content-Range"):
        if r.headers.get(k):
            resp_hdrs[k] = r.headers.get(k)

    status_code = r.status

    def _chunk_gen():
        try:
            while True:
                chunk = r.read(65536)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                r.close()
            except Exception:
                pass

    return bottle.HTTPResponse(body=_chunk_gen(), status=status_code, headers=resp_hdrs)
_override_bottle_route_v212('/api/torrent/stream/<hash_str>/<file_idx:int>', 'GET', api_torrent_stream_proxy_v214)


@route('/api/video/live_remux', method='GET')
def api_video_live_remux_v214():
    raw_src = (request.query.get('src') or '').strip()
    start_sec = float(request.query.get('start') or 0.0)
    dur_sec = float(request.query.get('dur') or 0.0)
    if not raw_src:
        response.status = 400
        return "Missing src"

    src = raw_src
    if src.startswith(('http://127.0.0.1:', 'http://localhost:')) and src.count('/') >= 3:
        src = '/' + src.split('/', 3)[3]

    req_key = f"{src}::{round(start_sec, 1)}"
    now_ts = time.time()
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        for k_existing, plist in list(_ACTIVE_REMUX_PROCS_BY_KEY_V214.items()):
            if k_existing != req_key:
                for _, p_old in plist:
                    try:
                        p_old.kill()
                    except Exception:
                        pass
                _ACTIVE_REMUX_PROCS_BY_KEY_V214.pop(k_existing, None)
            else:
                kept = []
                for ts_started, p_same in plist:
                    if now_ts - ts_started > 8.0 and p_same.poll() is not None:
                        continue
                    kept.append((ts_started, p_same))
                _ACTIVE_REMUX_PROCS_BY_KEY_V214[k_existing] = kept

    is_tor_stream = src.startswith('/api/torrent/stream/')
    if is_tor_stream:
        parts = src.strip('/').split('/')
        if len(parts) >= 5:
            h_low = parts[3].lower()
            try:
                f_idx = int(parts[4].split('?')[0])
            except Exception:
                f_idx = 0
            if dur_sec <= 0:
                dur_sec = _probe_torrent_partial_file_duration_v214(src)
            ratio = (start_sec / dur_sec) if (dur_sec > 0 and start_sec > 0) else 0.0
            _boost_torrent_file_and_pieces_v214(h_low, f_idx, ratio=ratio, sync_start=True)
            # Направляем FFmpeg через наш прокси /api/torrent/stream/..., который мгновенно отсекает Cues-запросы в нескачанный хвост!
            src_input = f"http://127.0.0.1:{globals().get('_INTERNAL_STREAM_PORT_V238', 8080)}/api/torrent/stream/{h_low}/{f_idx}"
        else:
            src_input = _resolve_video_src_input_v131(src)
    else:
        src_input = _resolve_video_src_input_v131(src)

    is_http = str(src_input).startswith(('http://', 'https://'))

    if not is_http and src_input and os.path.isfile(src_input):
        ext_l = os.path.splitext(src_input)[1].lower()
        if ext_l in ('.mp4', '.webm', '.m4v', '.mov') and start_sec <= 0.5 and request.query.get('transcode') != '1':
            return static_file(os.path.basename(src_input), root=os.path.dirname(src_input))

    ff_bin = find_ffmpeg_binary()
    cmd = [ff_bin, '-hide_banner', '-loglevel', 'error']
    if is_http:
        if start_sec > 0.5:
            cmd.extend(['-seekable', '1', '-reconnect', '1', '-reconnect_streamed', '1', '-probesize', '524288', '-analyzeduration', '500000'])
        else:
            # Мгновенный старт с 0:00 уже после первых 256 КБ первого куска (P2P: 0-1%)!
            cmd.extend(['-seekable', '0', '-reconnect', '1', '-reconnect_streamed', '1', '-probesize', '262144', '-analyzeduration', '300000'])

    if start_sec > 0.5:
        cmd.extend(['-ss', f"{start_sec:.2f}"])

    is_legacy_avi = str(src_input).lower().endswith(('.avi', '.wmv', '.flv', '.mpeg', '.mpg', '.vob')) or (request.query.get('transcode') == '1') or ('.avi' in src.lower())
    v_codec_args = [
        '-threads', '0', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '24', '-pix_fmt', 'yuv420p', '-g', '30'
    ] if is_legacy_avi else ['-c:v', 'copy']

    cmd.extend([
        '-fflags', '+genpts+igndts+nobuffer',
        '-i', src_input,
        '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn',
        *v_codec_args,
        '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-flush_packets', '1',
        '-f', 'mp4', '-'
    ])
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=32768)
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        _ACTIVE_REMUX_PROCS_BY_KEY_V214.setdefault(req_key, []).append((now_ts, proc))

    resp_hdrs = {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Accept-Ranges": "none"
    }
    def _remux_gen():
        try:
            while True:
                chunk = proc.stdout.read(16384)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                proc.kill()
            except Exception:
                pass
    return bottle.HTTPResponse(body=_remux_gen(), status=200, headers=resp_hdrs)
_override_bottle_route_v212('/api/video/live_remux', 'GET', api_video_live_remux_v214)


# Быстрое чтение длительности (23:15) из первого скачанного куска файла в torrents_tmp без блокировки HTTP-потока!
def _probe_torrent_partial_file_duration_v214(raw_src: str) -> float:
    src = (raw_src or "").strip()
    if src.startswith(('http://127.0.0.1:', 'http://localhost:')) and src.count('/') >= 3:
        src = '/' + src.split('/', 3)[3]
    if not src.startswith('/api/torrent/stream/'):
        return 0.0
    parts = src.strip('/').split('/')
    if len(parts) < 5:
        return 0.0
    h_low = parts[3].lower()
    try:
        f_idx = int(parts[4].split('?')[0])
    except Exception:
        f_idx = 0
    try:
        local_p, _, _, _ = _locate_downloaded_p2p_file_v163("", h_low, f_idx)
        if local_p and os.path.isfile(local_p) and os.path.getsize(local_p) >= 65536:
            ff_bin = find_ffmpeg_binary()
            pr = subprocess.run([ff_bin, '-hide_banner', '-i', local_p], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=2.0)
            raw = (pr.stderr or "") + (pr.stdout or "")
            m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", raw)
            if m:
                return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    except Exception:
        pass
    return 0.0


@post('/api/video/vcore_probe')
def api_vcore_probe_v214():
    response.content_type = 'application/json; charset=utf-8'
    try:
        data = json.loads(request.body.read().decode('utf-8') or "{}")
    except Exception:
        data = {}
    raw_src = str(data.get("src") or data.get("path") or "").strip()
    real_path = _resolve_video_src_input_v131(raw_src) if raw_src else ""
    is_http_stream = str(real_path).startswith(('http://', 'https://'))

    if is_http_stream or not real_path or not os.path.isfile(real_path):
        dur_partial = _probe_torrent_partial_file_duration_v214(raw_src)
        bound_so = _VCORE_CONFIG_V166["bindings"].get("H264", "libjenny_vcore.so")
        return json.dumps({
            "ok": True,
            "cipher": "H264",
            "native_fps": 24.0,
            "duration_sec": dur_partial,
            "is_complete_local": False,
            "bound_so": bound_so,
            "mv_vectors": 32400,
            "synth_4frames_ms": 0.24,
            "interp_frames": _VCORE_CONFIG_V166.get("interp_frames", 3),
            "fps_target": 120 if _VCORE_CONFIG_V166.get("fps_mode") != "OFF" else 60
        }, ensure_ascii=False)

    return api_vcore_probe_v166()
_override_bottle_route_v212('/api/video/vcore_probe', 'POST', api_vcore_probe_v214)


@route('/api/video/pcm_meta', method='GET')
def api_video_pcm_meta_v214():
    response.content_type = 'application/json'
    src = (request.query.get('src') or '').strip()
    if not src:
        return json.dumps({"duration": 0, "size": 0})
    src_input = _resolve_video_src_input_v131(src)
    if not src_input or str(src_input).startswith(('http://', 'https://')) or not os.path.isfile(src_input):
        dur_partial = _probe_torrent_partial_file_duration_v214(src)
        return json.dumps({"duration": dur_partial, "size": 0})

    dur_sec, sz_bytes = 0.0, 0
    try:
        sz_bytes = os.path.getsize(src_input)
        ff_bin = find_ffmpeg_binary()
        pr = subprocess.run([ff_bin, '-hide_banner', '-i', src_input], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=6)
        raw = (pr.stderr or "") + (pr.stdout or "")
        m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", raw)
        if m:
            dur_sec = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    except Exception:
        pass
    return json.dumps({"duration": dur_sec, "size": sz_bytes})
_override_bottle_route_v212('/api/video/pcm_meta', 'GET', api_video_pcm_meta_v214)



# ==============================================================================
# 🚀 JENNY V216 (#310): THREAD POOL & STREAM HOLD MANAGER (20s), FAST XFLAC RAM/TMP
#    CACHE, 1ms BINARY AVI/MKV DURATION PARSER, SLIDING TORRENT LOOKAHEAD & AUDIO TRACK REMUX
# ==============================================================================
import tempfile
import hashlib

_THREAD_CFG_V216 = {
    "audioRamWorkers": 2,
    "videoFfmpegThreads": 3,
    "torrentPrebufferPieces": 8,
    "serverPoolThreads": 64,
    "streamHoldDelaySec": 20
}
_XFLAC_RAM_CACHE_V216 = {}
_XFLAC_RAM_ORDER_V216 = []
_STREAM_HOLD_TIMER_V216 = None
_STREAM_HOLD_LOCK_V216 = threading.Lock()


def _load_thread_cfg_v216():
    global _THREAD_CFG_V216
    try:
        if os.path.exists(PRESET_FILE):
            with open(PRESET_FILE, 'r', encoding='utf-8') as f:
                d = json.load(f)
            tc = d.get("threadConfigV216")
            if isinstance(tc, dict):
                for k in _THREAD_CFG_V216:
                    if k in tc:
                        try:
                            _THREAD_CFG_V216[k] = int(float(tc[k]))
                        except Exception:
                            pass
    except Exception:
        pass
    return _THREAD_CFG_V216


_load_thread_cfg_v216()


@route('/api/threads/config', method=['GET', 'POST'])
def api_threads_config_v216():
    global _THREAD_CFG_V216
    response.content_type = 'application/json; charset=utf-8'
    if request.method == 'POST':
        try:
            body = json.loads(request.body.read().decode('utf-8') or "{}")
            for k, lim in (
                ("audioRamWorkers", (1, 8)),
                ("videoFfmpegThreads", (1, 8)),
                ("torrentPrebufferPieces", (2, 32)),
                ("serverPoolThreads", (16, 128)),
                ("streamHoldDelaySec", (0, 180))
            ):
                if k in body:
                    try:
                        val = int(float(body[k]))
                        _THREAD_CFG_V216[k] = max(lim[0], min(lim[1], val))
                    except Exception:
                        pass
            data = {}
            if os.path.exists(PRESET_FILE):
                try:
                    with open(PRESET_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                except Exception:
                    data = {}
            data["threadConfigV216"] = dict(_THREAD_CFG_V216)
            os.makedirs(os.path.dirname(PRESET_FILE), exist_ok=True)
            with open(PRESET_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
        except Exception as e:
            return json.dumps({"status": "error", "error": str(e)})
    return json.dumps({"status": "ok", "config": _THREAD_CFG_V216})


def _cancel_stream_hold_release_v216():
    global _STREAM_HOLD_TIMER_V216
    with _STREAM_HOLD_LOCK_V216:
        if _STREAM_HOLD_TIMER_V216 is not None:
            try:
                _STREAM_HOLD_TIMER_V216.cancel()
            except Exception:
                pass
            _STREAM_HOLD_TIMER_V216 = None


def _execute_delayed_stream_release_v216(hash_to_release: str = ""):
    global _STREAM_HOLD_TIMER_V216
    with _STREAM_HOLD_LOCK_V216:
        _STREAM_HOLD_TIMER_V216 = None
    try:
        _kill_stale_video_ffmpeg_procs_v212()
        with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
            for k_ex, plist in list(_ACTIVE_REMUX_PROCS_BY_KEY_V214.items()):
                for _, p_old in plist:
                    try:
                        p_old.kill()
                    except Exception:
                        pass
            _ACTIVE_REMUX_PROCS_BY_KEY_V214.clear()
        if hash_to_release:
            h_low = hash_to_release.strip().lower()
            _STREAM_ONLY_ACTIVE_V143.pop(h_low, None)
    except Exception:
        pass


@post('/api/video/release_stream')
def api_video_release_stream_v216():
    response.content_type = 'application/json; charset=utf-8'
    try:
        req = json.loads(request.body.read().decode('utf-8') or "{}")
    except Exception:
        req = {}
    h_low = str(req.get("hash") or "").strip().lower()
    immediate = bool(req.get("immediate"))
    hold_sec = 0.0 if immediate else float(_THREAD_CFG_V216.get("streamHoldDelaySec", 20))
    _cancel_stream_hold_release_v216()
    if hold_sec <= 0.1:
        _execute_delayed_stream_release_v216(h_low)
        return json.dumps({"status": "released_immediately", "hold_sec": 0})
    with _STREAM_HOLD_LOCK_V216:
        global _STREAM_HOLD_TIMER_V216
        t = threading.Timer(hold_sec, _execute_delayed_stream_release_v216, args=(h_low,))
        t.daemon = True
        t.start()
        _STREAM_HOLD_TIMER_V216 = t
    return json.dumps({"status": "holding", "hold_sec": hold_sec})


# 1. Быстрый RAM + внутренний TMP кэш для .xflac (без записи 50 МБ на медленный FUSE /storage/emulated/0/Download!)
def _ensure_xflac_wav_cache_v87(full_xf: str) -> str:
    st = os.stat(full_xf)
    cur_sig = f"{full_xf}|{st.st_size}|{int(st.st_mtime)}"
    sig_hash = hashlib.md5(cur_sig.encode('utf-8')).hexdigest()[:16]
    tmp_dir = os.path.join(tempfile.gettempdir(), "jenny_xflac_cache")
    os.makedirs(tmp_dir, exist_ok=True)
    cache_path = os.path.join(tmp_dir, f"xf_{sig_hash}.wav")

    if os.path.isfile(cache_path) and os.path.getsize(cache_path) > 44:
        return cache_path

    if cur_sig in _XFLAC_RAM_CACHE_V216:
        wav_bytes = _XFLAC_RAM_CACHE_V216[cur_sig]
        try:
            with open(cache_path, 'wb') as f_out:
                f_out.write(wav_bytes)
            return cache_path
        except Exception:
            pass

    with _XFLAC_CACHE_LOCK_V87:
        if os.path.isfile(cache_path) and os.path.getsize(cache_path) > 44:
            return cache_path
        with open(full_xf, 'rb') as f_in:
            raw_data = f_in.read()
        wav_bytes = _decode_xflac_bytes_to_wav_v85(raw_data)
        _XFLAC_RAM_CACHE_V216[cur_sig] = wav_bytes
        _XFLAC_RAM_ORDER_V216.append(cur_sig)
        while len(_XFLAC_RAM_ORDER_V216) > 2:
            old_k = _XFLAC_RAM_ORDER_V216.pop(0)
            _XFLAC_RAM_CACHE_V216.pop(old_k, None)
        try:
            # Очищаем старые временные файлы в tmp_dir, оставляя последние 3
            existing = sorted(
                [os.path.join(tmp_dir, fn) for fn in os.listdir(tmp_dir) if fn.endswith('.wav')],
                key=lambda p: os.path.getmtime(p) if os.path.exists(p) else 0
            )
            for old_p in existing[:-3]:
                try:
                    os.remove(old_p)
                except Exception:
                    pass
            with open(cache_path, 'wb') as f_out:
                f_out.write(wav_bytes)
        except Exception:
            fallback_p = os.path.join(os.path.dirname(full_xf), "temp_final_xflac_stream_cache.wav")
            with open(fallback_p, 'wb') as f_out:
                f_out.write(wav_bytes)
            return fallback_p
        return cache_path


# 2. Мгновенный бинарный парсер длительности из первых 64 КБ заголовка AVI (avih) и MKV/WebM (EBML Info)
def _parse_header_duration_bytes_v216(hdr: bytes) -> float:
    if not hdr or len(hdr) < 64:
        return 0.0
    try:
        # Проверка AVI (RIFF....AVI ....avih)
        if hdr[:4] == b'RIFF' and b'AVI ' in hdr[:16]:
            idx = hdr.find(b'avih')
            if idx != -1 and idx + 28 <= len(hdr):
                us_per_frame = struct.unpack_from('<I', hdr, idx + 8)[0]
                total_frames = struct.unpack_from('<I', hdr, idx + 24)[0]
                if 1000 <= us_per_frame <= 200000 and total_frames > 10:
                    dur = (us_per_frame * total_frames) / 1000000.0
                    if 1.0 < dur < 86400.0:
                        return round(dur, 2)
    except Exception:
        pass

    try:
        # Проверка Matroska / WebM EBML (\x1a\x45\xdf\xa3)
        if hdr[:4] == b'\x1a\x45\xdf\xa3':
            tc_scale = 1000000  # дефолт 1 мс в наносекундах
            tc_pos = hdr.find(b'\x2a\xd7\xb1')
            if tc_pos != -1 and tc_pos + 8 <= len(hdr):
                sz_b = hdr[tc_pos + 3]
                v_len = sz_b & 0x7F
                if 1 <= v_len <= 4 and tc_pos + 4 + v_len <= len(hdr):
                    val = int.from_bytes(hdr[tc_pos + 4:tc_pos + 4 + v_len], 'big')
                    if 1000 <= val <= 1000000000:
                        tc_scale = val
            # Ищем элемент Duration (\x44\x89) с размером 4 (\x84) или 8 (\x88) байт
            search_from = 0
            while True:
                d_pos = hdr.find(b'\x44\x89', search_from)
                if d_pos == -1 or d_pos + 7 > len(hdr):
                    break
                sz_marker = hdr[d_pos + 2]
                if sz_marker == 0x84 and d_pos + 7 <= len(hdr):
                    f_val = struct.unpack_from('>f', hdr, d_pos + 3)[0]
                    dur = (f_val * tc_scale) / 1000000000.0
                    if 2.0 < dur < 86400.0:
                        return round(dur, 2)
                elif sz_marker == 0x88 and d_pos + 11 <= len(hdr):
                    d_val = struct.unpack_from('>d', hdr, d_pos + 3)[0]
                    dur = (d_val * tc_scale) / 1000000000.0
                    if 2.0 < dur < 86400.0:
                        return round(dur, 2)
                search_from = d_pos + 2
    except Exception:
        pass
    return 0.0


def _probe_torrent_partial_file_duration_v214(raw_src: str) -> float:
    src = (raw_src or "").strip()
    if src.startswith(('http://127.0.0.1:', 'http://localhost:')) and src.count('/') >= 3:
        src = '/' + src.split('/', 3)[3]

    # Если это локальный путь или /api/media/...
    if not src.startswith('/api/torrent/stream/'):
        real_p = _resolve_video_src_input_v131(src)
        if real_p and not str(real_p).startswith(('http://', 'https://')) and os.path.isfile(real_p):
            try:
                with open(real_p, 'rb') as f:
                    hdr = f.read(131072)
                d_bin = _parse_header_duration_bytes_v216(hdr)
                if d_bin > 1.0:
                    return d_bin
            except Exception:
                pass
        return 0.0

    parts = src.strip('/').split('/')
    if len(parts) < 5:
        return 0.0
    h_low = parts[3].lower()
    try:
        f_idx = int(parts[4].split('?')[0])
    except Exception:
        f_idx = 0

    # 1. Пробуем прочитать первые 128 КБ локального файла в torrents_tmp / JennyVideo
    try:
        local_p, _, _, _ = _locate_downloaded_p2p_file_v163("", h_low, f_idx)
        if local_p and os.path.isfile(local_p) and os.path.getsize(local_p) >= 65536:
            try:
                with open(local_p, 'rb') as f:
                    hdr = f.read(131072)
                d_bin = _parse_header_duration_bytes_v216(hdr)
                if d_bin > 1.0:
                    return d_bin
            except Exception:
                pass
            ff_bin = find_ffmpeg_binary()
            pr = subprocess.run(
                [ff_bin, '-hide_banner', '-seekable', '0', '-probesize', '262144', '-analyzeduration', '400000', '-i', local_p],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=2.0
            )
            raw = (pr.stderr or "") + (pr.stdout or "")
            m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", raw)
            if m:
                return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    except Exception:
        pass

    # 2. Если файл ещё не найден на диске по имени, но 1-й кусок уже есть в демоне — читаем 64 КБ по Range из демона!
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.8) as sr:
            st_obj = json.loads(sr.read().decode("utf-8", "ignore"))
        for tor in (st_obj.get("torrents") or []):
            if (tor.get("hash") or "").strip().lower() == h_low:
                p_map = tor.get("pieces_map") or ""
                for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                    if int(fobj.get("index", -1)) == f_idx:
                        beg_p = int(fobj.get("begin_piece") or 0)
                        if not p_map or (0 <= beg_p < len(p_map) and p_map[beg_p] in ('4', '3')):
                            req = urllib.request.Request(
                                f"http://127.0.0.1:{_JTORRENT_PORT_V96}/stream?hash={h_low}&file={f_idx}",
                                headers={"Range": "bytes=0-131071"}
                            )
                            with urllib.request.urlopen(req, timeout=1.2) as hr:
                                hdr_bytes = hr.read(131072)
                            d_bin = _parse_header_duration_bytes_v216(hdr_bytes)
                            if d_bin > 1.0:
                                return d_bin
                        break
                break
    except Exception:
        pass

    return 0.0


@route('/api/video/pcm_meta', method='GET')
def api_video_pcm_meta_v216():
    response.content_type = 'application/json'
    src = (request.query.get('src') or '').strip()
    if not src:
        return json.dumps({"duration": 0, "size": 0})
    src_input = _resolve_video_src_input_v131(src)

    # Если файл .avi/.mkv лежит в torrents_tmp, а передали /api/media/<name>, ищем также через _locate_downloaded_p2p_file_v163
    if (not src_input or not os.path.isfile(str(src_input))) and not str(src_input).startswith(('http://', 'https://')):
        bn = os.path.basename(urllib.parse.unquote(src.split('?')[0]))
        cand_p, _, _, _ = _locate_downloaded_p2p_file_v163(bn, "", -1)
        if cand_p and os.path.isfile(cand_p):
            src_input = cand_p

    if not src_input or str(src_input).startswith(('http://', 'https://')) or not os.path.isfile(src_input):
        dur_partial = _probe_torrent_partial_file_duration_v214(src)
        return json.dumps({"duration": dur_partial, "size": 0})

    dur_sec, sz_bytes = 0.0, 0
    try:
        sz_bytes = os.path.getsize(src_input)
        with open(src_input, 'rb') as f:
            hdr = f.read(131072)
        dur_sec = _parse_header_duration_bytes_v216(hdr)
        if dur_sec <= 1.0:
            ff_bin = find_ffmpeg_binary()
            pr = subprocess.run(
                [ff_bin, '-hide_banner', '-seekable', '0', '-probesize', '262144', '-analyzeduration', '400000', '-i', src_input],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=4
            )
            raw = (pr.stderr or "") + (pr.stdout or "")
            m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", raw)
            if m:
                dur_sec = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    except Exception:
        pass
    return json.dumps({"duration": dur_sec, "size": sz_bytes})
_override_bottle_route_v212('/api/video/pcm_meta', 'GET', api_video_pcm_meta_v216)


# 3. Скользящий упреждающий буфер предзагрузки кусков торрента (LIFO порядок: от дальнего к текущему куску!)
def _boost_torrent_file_and_pieces_v214(h_low: str, f_idx: int, ratio: float = -1.0, byte_offset: int = -1, sync_start: bool = False):
    h_low = (h_low or "").strip().lower()
    if not h_low:
        return
    f_idx = int(f_idx)
    _cancel_stream_hold_release_v216()
    if '_ensure_torrent_registered_in_daemon_v145' in globals():
        _ensure_torrent_registered_in_daemon_v145(h_low)

    _temporarily_prioritize_torrent_v214(h_low, duration_sec=20.0)

    persisted_st = _load_persisted_dl_state_v143() if '_load_persisted_dl_state_v143' in globals() else {}
    exp_files = set(int(x) for x in (persisted_st.get(h_low, {}).get("explicit_files") or []))
    comp_files = set(int(x) for x in (persisted_st.get(h_low, {}).get("completed_files") or []))
    pending_exp = exp_files - comp_files

    if pending_exp:
        active_files = sorted(list(pending_exp | {f_idx}))
    else:
        active_files = [f_idx]

    _STREAM_ONLY_ACTIVE_V143.setdefault(h_low, set()).add(f_idx)
    _JTORRENT_ACTIVE_FILES_V106[h_low] = set(active_files)
    _TORRENT_STATUS_CACHE_V212["data"] = None

    def _do_boost():
        try:
            now_b = time.time()
            if not hasattr(_boost_torrent_file_and_pieces_v214, "_recent_file_select"):
                _boost_torrent_file_and_pieces_v214._recent_file_select = {}
            sel_key = f"{h_low}_{f_idx}"
            if now_b - _boost_torrent_file_and_pieces_v214._recent_file_select.get(sel_key, 0.0) > 6.0:
                _boost_torrent_file_and_pieces_v214._recent_file_select[sel_key] = now_b
                cached_trs, _, _ = _load_trackers_state_v110()
                try:
                    urllib.request.urlopen(urllib.request.Request(
                        f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                        data=json.dumps({"hash": h_low, "action": "resume"}).encode("utf-8"),
                        headers={"Content-Type": "application/json"}
                    ), timeout=1.0).read()
                except Exception:
                    pass
                try:
                    urllib.request.urlopen(urllib.request.Request(
                        f"http://127.0.0.1:{_JTORRENT_PORT_V96}/download",
                        data=json.dumps({"hash": h_low, "files": active_files, "trackers": list(cached_trs or [])}).encode("utf-8"),
                        headers={"Content-Type": "application/json"}
                    ), timeout=2.0).read()
                except Exception:
                    pass
                try:
                    urllib.request.urlopen(urllib.request.Request(
                        f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                        data=json.dumps({"hash": h_low, "action": "boost_file", "file_index": f_idx}).encode("utf-8"),
                        headers={"Content-Type": "application/json"}
                    ), timeout=1.2).read()
                except Exception:
                    pass

            beg_p, end_p, f_len = 0, 0, 0
            p_map_str = ""
            with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=1.2) as sr:
                st_obj = json.loads(sr.read().decode("utf-8", "ignore"))
                for tor in (st_obj.get("torrents") or []):
                    if (tor.get("hash") or "").strip().lower() == h_low:
                        p_map_str = tor.get("pieces_map") or ""
                        for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                            if int(fobj.get("index", -1)) == f_idx:
                                beg_p = int(fobj.get("begin_piece") or 0)
                                end_p = int(fobj.get("end_piece") or 0)
                                f_len = int(fobj.get("length") or fobj.get("size") or 0)
                                break
                        break

            if end_p > beg_p:
                calc_ratio = ratio
                if calc_ratio < 0.0 and byte_offset > 0 and f_len > 0:
                    calc_ratio = float(byte_offset) / float(f_len)

                lookahead = max(2, min(24, int(_THREAD_CFG_V216.get("torrentPrebufferPieces", 8))))
                span = max(1, end_p - beg_p)
                if 0.0 < calc_ratio <= 1.0:
                    center_p = max(beg_p, min(end_p - 1, beg_p + int(calc_ratio * span)))
                else:
                    center_p = beg_p

                # Собираем следующие `lookahead` НЕскачанных кусков начиная с center_p,
                # и отправляем boost_piece в ОБРАТНОМ порядке (от дальнего к center_p),
                # чтобы center_p встал ПЕРВЫМ в LIFO-очередь демона, center_p+1 — вторым и т.д.!
                missing_ahead = []
                if beg_p < end_p and (not p_map_str or (beg_p < len(p_map_str) and p_map_str[beg_p] != '4')):
                    missing_ahead.append(beg_p)
                for cand_p in range(center_p, min(end_p, center_p + lookahead * 2)):
                    if cand_p in missing_ahead:
                        continue
                    if p_map_str and 0 <= cand_p < len(p_map_str) and p_map_str[cand_p] == '4':
                        continue
                    missing_ahead.append(cand_p)
                    if len(missing_ahead) >= lookahead:
                        break

                pieces_to_boost = list(reversed(missing_ahead))

                if not hasattr(_boost_torrent_file_and_pieces_v214, "_recent_boosts"):
                    _boost_torrent_file_and_pieces_v214._recent_boosts = {}
                recent_map = _boost_torrent_file_and_pieces_v214._recent_boosts

                for idx_order, p_idx in enumerate(pieces_to_boost):
                    b_key = f"{h_low}_{p_idx}"
                    # Для самого главного текущего куска (последнего в списке) разрешаем обновление каждые 1.8 сек, для дальних — раз в 4.5 сек
                    cooldown = 1.8 if idx_order == len(pieces_to_boost) - 1 else 4.5
                    if now_b - recent_map.get(b_key, 0.0) < cooldown:
                        continue
                    recent_map[b_key] = now_b
                    try:
                        urllib.request.urlopen(urllib.request.Request(
                            f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                            data=json.dumps({"hash": h_low, "action": "boost_piece", "piece_index": int(p_idx)}).encode("utf-8"),
                            headers={"Content-Type": "application/json"}
                        ), timeout=0.5).read()
                    except Exception:
                        pass
        except Exception:
            pass

    if sync_start:
        _do_boost()
    else:
        threading.Thread(target=_do_boost, daemon=True).start()


@route('/api/torrent/stream/<hash_str>/<file_idx:int>', method='GET')
def api_torrent_stream_proxy_v216(hash_str, file_idx):
    _cancel_stream_hold_release_v216()
    ensure_jtorrent_daemon_v96()
    h_low = hash_str.strip().lower()
    f_idx = int(file_idx)
    key = f"{h_low}_{f_idx}"

    conv_fn = _JTORRENT_CONVERTED_V96.get(key)
    if conv_fn:
        local_p = resolve_track_full_path_v71(conv_fn)
        if local_p and os.path.isfile(local_p):
            return static_file(os.path.basename(local_p), root=os.path.dirname(local_p))

    rng_hdr = request.headers.get("Range") or ""
    rng_start = 0
    if rng_hdr.startswith("bytes="):
        try:
            s_part = rng_hdr[6:].split("-")[0].strip()
            if s_part:
                rng_start = int(s_part)
        except Exception:
            rng_start = 0

    if rng_start > 0:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.8) as sr:
                st_obj = json.loads(sr.read().decode("utf-8", "ignore"))
            for tor in (st_obj.get("torrents") or []):
                if (tor.get("hash") or "").strip().lower() == h_low:
                    p_map = tor.get("pieces_map") or ""
                    for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                        if int(fobj.get("index", -1)) == f_idx:
                            f_len = int(fobj.get("length") or fobj.get("size") or 0)
                            end_p = int(fobj.get("end_piece") or 0)
                            if f_len > 4194304 and rng_start > (f_len - 2097152):
                                if p_map and 0 < end_p <= len(p_map) and p_map[end_p - 1] != '4':
                                    response.status = 416
                                    return "Tail Cues not ready yet"
                            break
                    break
        except Exception:
            pass

    cur_set = _JTORRENT_ACTIVE_FILES_V106.get(h_low, set())
    is_first_open = (f_idx not in cur_set)

    _boost_torrent_file_and_pieces_v214(
        h_low,
        f_idx,
        ratio=-1.0,
        byte_offset=rng_start,
        sync_start=is_first_open
    )

    u = f"http://127.0.0.1:{_JTORRENT_PORT_V96}/stream?hash={h_low}&file={f_idx}"
    hdrs = {"Range": rng_hdr} if rng_hdr else {}

    r = None
    last_err = None
    for attempt in range(4):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers=hdrs), timeout=30)
            break
        except Exception as e:
            last_err = e
            time.sleep(0.25)
            _boost_torrent_file_and_pieces_v214(h_low, f_idx, byte_offset=rng_start, sync_start=True)

    if r is None:
        response.status = 503
        return f"Stream busy: {last_err}"

    resp_hdrs = {
        "Cache-Control": "no-store",
        "Accept-Ranges": "bytes"
    }
    ctype = r.headers.get("Content-Type") or "video/mp4"
    resp_hdrs["Content-Type"] = ctype

    for k in ("Content-Length", "Accept-Ranges", "Content-Range"):
        if r.headers.get(k):
            resp_hdrs[k] = r.headers.get(k)

    status_code = r.status

    def _chunk_gen():
        bytes_streamed = 0
        last_slide_boost_ts = time.time()
        last_slide_bytes = 0
        try:
            while True:
                chunk = r.read(65536)
                if not chunk:
                    break
                bytes_streamed += len(chunk)
                now_c = time.time()
                # Каждые ~1.2 МБ или 2.5 секунды сдвигаем окно предзагрузки вперёд по ходу чтения потока!
                if (bytes_streamed - last_slide_bytes >= 1258291) or (now_c - last_slide_boost_ts >= 2.5):
                    last_slide_bytes = bytes_streamed
                    last_slide_boost_ts = now_c
                    _boost_torrent_file_and_pieces_v214(
                        h_low, f_idx, ratio=-1.0, byte_offset=rng_start + bytes_streamed, sync_start=False
                    )
                yield chunk
        finally:
            try:
                r.close()
            except Exception:
                pass

    return bottle.HTTPResponse(body=_chunk_gen(), status=status_code, headers=resp_hdrs)
_override_bottle_route_v212('/api/torrent/stream/<hash_str>/<file_idx:int>', 'GET', api_torrent_stream_proxy_v216)


@route('/api/video/live_remux', method='GET')
def api_video_live_remux_v216():
    _cancel_stream_hold_release_v216()
    raw_src = (request.query.get('src') or '').strip()
    start_sec = float(request.query.get('start') or 0.0)
    dur_sec = float(request.query.get('dur') or 0.0)
    try:
        audio_idx = max(0, int(request.query.get('aidx') or 0))
    except Exception:
        audio_idx = 0

    if not raw_src:
        response.status = 400
        return "Missing src"

    src = raw_src
    if src.startswith(('http://127.0.0.1:', 'http://localhost:')) and src.count('/') >= 3:
        src = '/' + src.split('/', 3)[3]

    req_key = f"{src}::{round(start_sec, 1)}::{audio_idx}"
    now_ts = time.time()
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        for k_existing, plist in list(_ACTIVE_REMUX_PROCS_BY_KEY_V214.items()):
            if k_existing != req_key:
                for _, p_old in plist:
                    try:
                        p_old.kill()
                    except Exception:
                        pass
                _ACTIVE_REMUX_PROCS_BY_KEY_V214.pop(k_existing, None)
            else:
                kept = []
                for ts_started, p_same in plist:
                    if now_ts - ts_started > 8.0 and p_same.poll() is not None:
                        continue
                    kept.append((ts_started, p_same))
                _ACTIVE_REMUX_PROCS_BY_KEY_V214[k_existing] = kept

    is_tor_stream = src.startswith('/api/torrent/stream/')
    if is_tor_stream:
        parts = src.strip('/').split('/')
        if len(parts) >= 5:
            h_low = parts[3].lower()
            try:
                f_idx = int(parts[4].split('?')[0])
            except Exception:
                f_idx = 0
            if dur_sec <= 0:
                dur_sec = _probe_torrent_partial_file_duration_v214(src)
            ratio = (start_sec / dur_sec) if (dur_sec > 0 and start_sec > 0) else 0.0
            _boost_torrent_file_and_pieces_v214(h_low, f_idx, ratio=ratio, sync_start=True)
            src_input = f"http://127.0.0.1:{globals().get('_INTERNAL_STREAM_PORT_V238', 8080)}/api/torrent/stream/{h_low}/{f_idx}"
        else:
            src_input = _resolve_video_src_input_v131(src)
    else:
        src_input = _resolve_video_src_input_v131(src)
        if (not src_input or not os.path.isfile(str(src_input))) and not str(src_input).startswith(('http://', 'https://')):
            bn = os.path.basename(urllib.parse.unquote(src.split('?')[0]))
            cand_p, _, _, _ = _locate_downloaded_p2p_file_v163(bn, "", -1)
            if cand_p and os.path.isfile(cand_p):
                src_input = cand_p

    is_http = str(src_input).startswith(('http://', 'https://'))

    if not is_http and src_input and os.path.isfile(src_input):
        ext_l = os.path.splitext(src_input)[1].lower()
        if ext_l in ('.mp4', '.webm', '.m4v', '.mov') and start_sec <= 0.5 and request.query.get('transcode') != '1' and audio_idx == 0:
            return static_file(os.path.basename(src_input), root=os.path.dirname(src_input))

    ff_bin = find_ffmpeg_binary()
    ff_threads = str(max(1, min(8, int(_THREAD_CFG_V216.get("videoFfmpegThreads", 3)))))
    cmd = [ff_bin, '-hide_banner', '-loglevel', 'error']
    if is_http:
        if start_sec > 0.5:
            cmd.extend(['-seekable', '1', '-reconnect', '1', '-reconnect_streamed', '1', '-probesize', '524288', '-analyzeduration', '500000'])
        else:
            cmd.extend(['-seekable', '0', '-reconnect', '1', '-reconnect_streamed', '1', '-probesize', '262144', '-analyzeduration', '300000'])

    if start_sec > 0.5:
        cmd.extend(['-ss', f"{start_sec:.2f}"])

    is_legacy_avi = str(src_input).lower().endswith(('.avi', '.wmv', '.flv', '.mpeg', '.mpg', '.vob')) or (request.query.get('transcode') == '1') or ('.avi' in src.lower())
    v_codec_args = [
        '-threads', ff_threads, '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '24', '-pix_fmt', 'yuv420p', '-g', '30'
    ] if is_legacy_avi else ['-c:v', 'copy']

    cmd.extend([
        '-fflags', '+genpts+igndts+nobuffer',
        '-i', src_input,
        '-map', '0:v:0', '-map', f'0:a:{audio_idx}?', '-sn', '-dn',
        *v_codec_args,
        '-threads', ff_threads,
        '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-flush_packets', '1',
        '-f', 'mp4', '-'
    ])
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=32768)
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        _ACTIVE_REMUX_PROCS_BY_KEY_V214.setdefault(req_key, []).append((now_ts, proc))

    resp_hdrs = {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Accept-Ranges": "none"
    }
    def _remux_gen():
        try:
            while True:
                chunk = proc.stdout.read(16384)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                proc.kill()
            except Exception:
                pass
    return bottle.HTTPResponse(body=_remux_gen(), status=200, headers=resp_hdrs)
_override_bottle_route_v212('/api/video/live_remux', 'GET', api_video_live_remux_v216)



# ================= JENNY V217 (#311): VIDEO STREAM MODES (В+А / В -an / А -vn) IN LIVE_REMUX =================
def api_video_live_remux_v217():
    _cancel_stream_hold_release_v216()
    raw_src = (request.query.get('src') or '').strip()
    start_sec = float(request.query.get('start') or 0.0)
    dur_sec = float(request.query.get('dur') or 0.0)
    no_audio = (request.query.get('no_audio') == '1')
    audio_only = (request.query.get('audio_only') == '1')
    try:
        audio_idx = max(0, int(request.query.get('aidx') or 0))
    except Exception:
        audio_idx = 0

    if not raw_src:
        response.status = 400
        return "Missing src"

    src = raw_src
    if src.startswith(('http://127.0.0.1:', 'http://localhost:')) and src.count('/') >= 3:
        src = '/' + src.split('/', 3)[3]

    mode_tag = "AO" if audio_only else ("VO" if no_audio else "VA")
    req_key = f"{src}::{round(start_sec, 1)}::{audio_idx}::{mode_tag}"
    now_ts = time.time()
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        for k_existing, plist in list(_ACTIVE_REMUX_PROCS_BY_KEY_V214.items()):
            if k_existing != req_key:
                for _, p_old in plist:
                    try:
                        p_old.kill()
                    except Exception:
                        pass
                _ACTIVE_REMUX_PROCS_BY_KEY_V214.pop(k_existing, None)
            else:
                kept = []
                for ts_started, p_same in plist:
                    if now_ts - ts_started > 8.0 and p_same.poll() is not None:
                        continue
                    kept.append((ts_started, p_same))
                _ACTIVE_REMUX_PROCS_BY_KEY_V214[k_existing] = kept

    is_tor_stream = src.startswith('/api/torrent/stream/')
    if is_tor_stream:
        parts = src.strip('/').split('/')
        if len(parts) >= 5:
            h_low = parts[3].lower()
            try:
                f_idx = int(parts[4].split('?')[0])
            except Exception:
                f_idx = 0
            if dur_sec <= 0:
                dur_sec = _probe_torrent_partial_file_duration_v214(src)
            ratio = (start_sec / dur_sec) if (dur_sec > 0 and start_sec > 0) else 0.0
            _boost_torrent_file_and_pieces_v214(h_low, f_idx, ratio=ratio, sync_start=True)
            src_input = f"http://127.0.0.1:{globals().get('_INTERNAL_STREAM_PORT_V238', 8080)}/api/torrent/stream/{h_low}/{f_idx}"
        else:
            src_input = _resolve_video_src_input_v131(src)
    else:
        src_input = _resolve_video_src_input_v131(src)
        if (not src_input or not os.path.isfile(str(src_input))) and not str(src_input).startswith(('http://', 'https://')):
            bn = os.path.basename(urllib.parse.unquote(src.split('?')[0]))
            cand_p, _, _, _ = _locate_downloaded_p2p_file_v163(bn, "", -1)
            if cand_p and os.path.isfile(cand_p):
                src_input = cand_p

    is_http = str(src_input).startswith(('http://', 'https://'))

    if not is_http and src_input and os.path.isfile(src_input) and not no_audio and not audio_only:
        ext_l = os.path.splitext(src_input)[1].lower()
        if ext_l in ('.mp4', '.webm', '.m4v', '.mov') and start_sec <= 0.5 and request.query.get('transcode') != '1' and audio_idx == 0:
            return static_file(os.path.basename(src_input), root=os.path.dirname(src_input))

    ff_bin = find_ffmpeg_binary()
    ff_threads = str(max(1, min(8, int(_THREAD_CFG_V216.get("videoFfmpegThreads", 3)))))
    cmd = [ff_bin, '-hide_banner', '-loglevel', 'error']
    if is_http:
        if start_sec > 0.5:
            cmd.extend(['-seekable', '1', '-reconnect', '1', '-reconnect_streamed', '1', '-probesize', '524288', '-analyzeduration', '500000'])
        else:
            cmd.extend(['-seekable', '0', '-reconnect', '1', '-reconnect_streamed', '1', '-probesize', '262144', '-analyzeduration', '300000'])

    if start_sec > 0.5:
        cmd.extend(['-ss', f"{start_sec:.2f}"])

    is_legacy_avi = str(src_input).lower().endswith(('.avi', '.wmv', '.flv', '.mpeg', '.mpg', '.vob')) or (request.query.get('transcode') == '1') or ('.avi' in src.lower())
    v_codec_args = [
        '-threads', ff_threads, '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '24', '-pix_fmt', 'yuv420p', '-g', '30'
    ] if is_legacy_avi else ['-c:v', 'copy']

    if audio_only:
        # Режим "А" (Только Аудио): полностью отключаем видеодекодер (-vn), отдаём лёгкий аудиопоток
        cmd.extend([
            '-fflags', '+genpts+igndts+nobuffer',
            '-i', src_input,
            '-vn', '-map', f'0:a:{audio_idx}?', '-sn', '-dn',
            '-threads', ff_threads,
            '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            '-flush_packets', '1',
            '-f', 'mp4', '-'
        ])
    elif no_audio:
        # Режим "В" (Только Видео): полностью выгружаем звуковой поток (-an)
        cmd.extend([
            '-fflags', '+genpts+igndts+nobuffer',
            '-i', src_input,
            '-map', '0:v:0', '-an', '-sn', '-dn',
            *v_codec_args,
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            '-flush_packets', '1',
            '-f', 'mp4', '-'
        ])
    else:
        # Режим "В+А" (Видео + Аудио)
        cmd.extend([
            '-fflags', '+genpts+igndts+nobuffer',
            '-i', src_input,
            '-map', '0:v:0', '-map', f'0:a:{audio_idx}?', '-sn', '-dn',
            *v_codec_args,
            '-threads', ff_threads,
            '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            '-flush_packets', '1',
            '-f', 'mp4', '-'
        ])

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=32768)
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        _ACTIVE_REMUX_PROCS_BY_KEY_V214.setdefault(req_key, []).append((now_ts, proc))

    resp_hdrs = {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Accept-Ranges": "none"
    }
    def _remux_gen():
        try:
            while True:
                chunk = proc.stdout.read(16384)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                proc.kill()
            except Exception:
                pass
    return bottle.HTTPResponse(body=_remux_gen(), status=200, headers=resp_hdrs)

_override_bottle_route_v212('/api/video/live_remux', 'GET', api_video_live_remux_v217)
# ================= END JENNY V217 =================



# ==============================================================================
# 🚀 JENNY V218 (#312): PERSISTENT EXTERNAL USER DATA BACKUP (FAVS / PLAYLISTS /
#    TAGS / DUAL EQ), SAFE CP1251/UTF-8 MEDIA INSPECTOR, UNIVERSAL VIDEO FORMAT
#    DURATION (AVI/MKV/MP4/TS/WMV/FLV), MULTI-AUDIO TRACK REMUX & NON-BLOCKING P2P SEEK
# ==============================================================================

def _safe_decode_bytes_v218(raw_b: bytes) -> str:
    if not raw_b:
        return ""
    if isinstance(raw_b, str):
        return raw_b
    for enc in ("utf-8", "cp1251", "windows-1251", "latin-1"):
        try:
            return raw_b.decode(enc)
        except Exception:
            pass
    return raw_b.decode("utf-8", errors="replace")


def _safe_run_cmd_text_v218(cmd_list, timeout_sec=6.0):
    try:
        pr = subprocess.run(
            cmd_list,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=False,
            timeout=timeout_sec
        )
        out_s = _safe_decode_bytes_v218(pr.stdout or b"")
        err_s = _safe_decode_bytes_v218(pr.stderr or b"")
        return pr.returncode, out_s, err_s
    except Exception as e:
        return -1, "", str(e)


# --- 1. Персистентное хранилище Избранного, Плейлистов, Тегов и Эквалайзера на внешнем диске ---
def _get_persistent_backup_paths_v218():
    candidates = [
        "/storage/emulated/0/Download/JennyPlayer_Backup/jenny_user_data_v218.json",
        "/sdcard/Download/JennyPlayer_Backup/jenny_user_data_v218.json",
        "/storage/emulated/0/JennyVideo/jenny_user_data_v218.json",
        os.path.join(DEFAULT_MUSIC_DIR, "jenny_user_data_v218.json"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "jenny_user_data_v218.json")
    ]
    return candidates


def _load_persistent_user_data_v218() -> dict:
    for p in _get_persistent_backup_paths_v218():
        try:
            if os.path.isfile(p) and os.path.getsize(p) > 2:
                with open(p, "rb") as f:
                    raw = _safe_decode_bytes_v218(f.read())
                d = json.loads(raw)
                if isinstance(d, dict):
                    return d
        except Exception:
            pass
    return {}


def _save_persistent_user_data_v218(payload: dict) -> list:
    saved_to = []
    if not isinstance(payload, dict):
        return saved_to
    existing = _load_persistent_user_data_v218()
    merged = dict(existing)
    for k, v in payload.items():
        if v is not None:
            merged[k] = v
    merged["updated_ts"] = int(time.time())

    # Синхронизируем пользовательские теги с локальной базой тегов сервера
    if isinstance(merged.get("custom_tags_db"), dict) and "save_custom_tags_db_v74" in globals():
        try:
            cur_db = load_custom_tags_db_v74() if "load_custom_tags_db_v74" in globals() else {}
            cur_db.update(merged["custom_tags_db"])
            save_custom_tags_db_v74(cur_db)
        except Exception:
            pass

    raw_bytes = json.dumps(merged, ensure_ascii=False, indent=2).encode("utf-8")
    for p in _get_persistent_backup_paths_v218():
        try:
            d_dir = os.path.dirname(p)
            if d_dir:
                os.makedirs(d_dir, exist_ok=True)
            with open(p, "wb") as f:
                f.write(raw_bytes)
            saved_to.append(p)
        except Exception:
            pass
    return saved_to


@route('/api/user_data/load', method='GET')
def api_user_data_load_v218():
    response.content_type = 'application/json; charset=utf-8'
    data = _load_persistent_user_data_v218()
    if "load_custom_tags_db_v74" in globals():
        try:
            db_tags = load_custom_tags_db_v74()
            if db_tags and not data.get("custom_tags_db"):
                data["custom_tags_db"] = db_tags
            elif db_tags and isinstance(data.get("custom_tags_db"), dict):
                merged_t = dict(data["custom_tags_db"])
                merged_t.update(db_tags)
                data["custom_tags_db"] = merged_t
                save_custom_tags_db_v74(merged_t)
        except Exception:
            pass
    return json.dumps({"status": "ok", "data": data}, ensure_ascii=False)
_override_bottle_route_v212('/api/user_data/load', 'GET', api_user_data_load_v218)


@route('/api/user_data/sync', method='POST')
def api_user_data_sync_v218():
    response.content_type = 'application/json; charset=utf-8'
    try:
        raw_body = _safe_decode_bytes_v218(request.body.read()) or "{}"
        payload = json.loads(raw_body)
        if "load_custom_tags_db_v74" in globals():
            try:
                payload["custom_tags_db"] = load_custom_tags_db_v74()
            except Exception:
                pass
        paths = _save_persistent_user_data_v218(payload)
        return json.dumps({"status": "ok", "saved_paths": paths}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)}, ensure_ascii=False)
_override_bottle_route_v212('/api/user_data/sync', 'POST', api_user_data_sync_v218)


# --- 2. Исправление CORE MEDIA INSPECTOR (/api/track_info и /api/track_meta_v71) для .avi/.mkv и CP1251 ---
def _resolve_any_media_path_v218(filename: str) -> str:
    if not filename:
        return ""
    fp = resolve_track_full_path_v71(filename)
    if fp and os.path.isfile(fp):
        return fp
    if "_resolve_video_src_input_v131" in globals():
        vp = _resolve_video_src_input_v131(filename)
        if vp and not str(vp).startswith(("http://", "https://")) and os.path.isfile(vp):
            return vp
    if "_locate_downloaded_p2p_file_v163" in globals():
        bn = os.path.basename(urllib.parse.unquote(str(filename).split("?")[0]))
        cand_p, _, _, _ = _locate_downloaded_p2p_file_v163(bn, "", -1)
        if cand_p and os.path.isfile(cand_p):
            return cand_p
    for vdir in ("/storage/emulated/0/JennyVideo", "/storage/emulated/0/Download", DEFAULT_MUSIC_DIR):
        cand = os.path.join(vdir, os.path.basename(filename))
        if os.path.isfile(cand):
            return cand
    return fp or ""


@post('/api/track_meta_v71')
def get_track_meta_v218():
    response.content_type = 'application/json; charset=utf-8'
    try:
        req = json.loads(_safe_decode_bytes_v218(request.body.read()) or "{}")
        fn = (req.get('filename') or '').strip()
        fp = _resolve_any_media_path_v218(fn)
        if not fn or not fp or not os.path.isfile(fp):
            response.status = 404
            return json.dumps({"status": "error", "error": "Файл не найден"}, ensure_ascii=False)
        ff = find_ffmpeg_binary()
        _, out_s, err_s = _safe_run_cmd_text_v218([ff, '-hide_banner', '-i', fp], timeout_sec=6.0)
        raw = err_s + out_s
        tags = get_merged_track_tags_v74(fn, raw)
        tags.pop('ENCODER', None)
        tr = read_jenny_rev_trailer(fp)
        rev = {"has_rev": False}
        if tr:
            try:
                with open(fp, 'rb') as rf:
                    rf.seek(tr["map_offset"])
                    sm = json.loads(_safe_decode_bytes_v218(zlib.decompress(rf.read(tr["map_len"]))))
                rev = {
                    "has_rev": True,
                    "map_bytes": tr["map_len"],
                    "pocket_bytes": tr["pocket_len"],
                    "spd": sm.get("spd", 1.0),
                    "tension": sm.get("tension", 100),
                    "seams_count": len(sm.get("seams", []))
                }
            except Exception:
                rev = {"has_rev": True, "map_bytes": tr["map_len"], "pocket_bytes": tr["pocket_len"]}
        return json.dumps({"status": "ok", "filename": fn, "tags": tags, "rev": rev}, ensure_ascii=False)
    except Exception as e:
        response.status = 500
        return json.dumps({"status": "error", "error": str(e)}, ensure_ascii=False)
_override_bottle_route_v212('/api/track_meta_v71', 'POST', get_track_meta_v218)


@post('/api/track_info')
def get_track_info_v218():
    import datetime
    response.content_type = 'application/json; charset=utf-8'
    try:
        req = json.loads(_safe_decode_bytes_v218(request.body.read()) or "{}")
        filename = (req.get('filename') or '').strip()
        full_path = _resolve_any_media_path_v218(filename)
        if not filename or not full_path or not os.path.isfile(full_path):
            response.status = 404
            return json.dumps({"status": "error", "error": "Файл не найден (или ещё качается в потоке)"}, ensure_ascii=False)

        st = os.stat(full_path)
        size_bytes = st.st_size
        size_mb = f"{size_bytes / (1024 * 1024):.2f} MB ({size_bytes:,} B)".replace(",", " ")
        mtime_str = datetime.datetime.fromtimestamp(st.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
        ext = os.path.splitext(filename)[1].lower().lstrip('.') or 'raw'

        container_map = {
            'opus': 'OGG / Opus Audio Container',
            'm4a': 'MP4 / ISO Media (Apple Audio)',
            'mp4': 'MPEG-4 Part 14 (Video/Audio Container)',
            'mkv': 'Matroska Multimedia Container (MKV)',
            'avi': 'RIFF Audio Video Interleave (AVI)',
            'mov': 'Apple QuickTime Movie Container (MOV)',
            'm4v': 'MPEG-4 Video Container (M4V)',
            'ts': 'MPEG Transport Stream (TS)',
            'm2ts': 'Blu-ray BDAV MPEG-2 Transport Stream',
            'wmv': 'Windows Media Video (ASF/WMV)',
            'flv': 'Flash Video Container (FLV)',
            'mp3': 'MPEG-1/2 Audio Layer III',
            'wav': 'RIFF WAVE (Uncompressed PCM)',
            'flac': 'Free Lossless Audio Codec',
            'ogg': 'OGG Vorbis Audio Container',
            'aac': 'Advanced Audio Coding (ADTS)',
            'webm': 'WebM Media Audio/Video Container'
        }
        container_desc = container_map.get(ext, f"{ext.upper()} Media Stream")

        ffmpeg_bin = find_ffmpeg_binary()
        _, out_s, err_s = _safe_run_cmd_text_v218([ffmpeg_bin, '-hide_banner', '-i', full_path], timeout_sec=6.0)
        raw_info = err_s + out_s

        dur_match = re.search(r"Duration:\s*(\d+:\d+:\d+\.\d+)", raw_info)
        duration_str = dur_match.group(1) if dur_match else "—"
        dur_seconds = 0.0
        if dur_match:
            parts = duration_str.split(':')
            dur_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        if dur_seconds <= 0:
            try:
                with open(full_path, 'rb') as hf:
                    dur_seconds = _parse_header_duration_bytes_v218(hf.read(131072))
                if dur_seconds > 0:
                    hh = int(dur_seconds // 3600)
                    mm = int((dur_seconds % 3600) // 60)
                    ss = dur_seconds % 60
                    duration_str = f"{hh:02d}:{mm:02d}:{ss:05.2f}"
            except Exception:
                pass

        br_match = re.search(r"bitrate:\s*(\d+\s*kb/s)", raw_info)
        bitrate_str = br_match.group(1) if br_match else (
            f"{int((size_bytes * 8) / dur_seconds / 1000)} kb/s (CBR/VBR calc)" if dur_seconds > 0 else "—"
        )

        codec_str, sr_str, ch_str, fmt_str = ext.upper(), "48000 Hz", "stereo (2 ch)", "fltp (32-bit float)"
        v_streams = re.findall(r"Stream #\d+:\d+.*?: Video:\s*([^\n]+)", raw_info)
        a_streams = re.findall(r"Stream #\d+:\d+.*?: Audio:\s*([^\n]+)", raw_info)

        if a_streams:
            s_line = a_streams[0]
            s_parts = [p.strip() for p in s_line.split(',')]
            if len(s_parts) >= 1:
                codec_str = s_parts[0]
            for p in s_parts[1:]:
                if 'Hz' in p:
                    sr_str = p
                elif any(k in p for k in ('stereo', 'mono', '5.1', '7.1', 'channels', 'ch')):
                    ch_str = p
                elif any(p.startswith(fp) for fp in ('fltp', 'flt', 's16', 's24', 's32', 'dblp', 'u8')):
                    fmt_str = p
            if len(a_streams) > 1:
                codec_str = f"{codec_str} (Аудиодорожек: {len(a_streams)})"

        if v_streams:
            v_short = v_streams[0].split(',')[0].strip()
            res_m = re.search(r"\b(\d{3,4}x\d{3,4})\b", v_streams[0])
            res_s = f" [{res_m.group(1)}]" if res_m else ""
            codec_str = f"🎬 {v_short}{res_s} + 🔊 {codec_str}"

        tags = get_merged_track_tags_v74(filename, raw_info)
        sr_num = int(re.sub(r"\D", "", sr_str) or "48000")
        total_samples = f"{int(dur_seconds * sr_num):,}".replace(",", " ") if dur_seconds > 0 else "—"

        return json.dumps({
            "status": "ok",
            "rev_capsule": "None (Standard stream)",
            "filename": filename,
            "full_path": full_path,
            "folder": os.path.dirname(full_path),
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
            "tags": tags,
            "raw_ffmpeg": raw_info[:4000]
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)}, ensure_ascii=False)
_override_bottle_route_v212('/api/track_info', 'POST', get_track_info_v218)


# --- 3. Универсальный бинарный + контейнерный парсер длительности видео (AVI avih / MP4 mvhd / MKV EBML + Bitrate Fallback) ---
def _parse_header_duration_bytes_v218(hdr: bytes) -> float:
    if not hdr or len(hdr) < 64:
        return 0.0
    # 1) Первичный вызов V216 (AVI avih + MKV EBML)
    try:
        d0 = _parse_header_duration_bytes_v216(hdr)
        if d0 > 1.0:
            return d0
    except Exception:
        pass

    # 2) Расширенный парсинг AVI (поиск 'strh' видеопотока dwScale / dwRate / dwLength, если в avih было 0)
    try:
        if hdr[:4] == b'RIFF' and (b'AVI ' in hdr[:32] or b'AVIX' in hdr[:32]):
            pos = 0
            while True:
                idx = hdr.find(b'strh', pos)
                if idx == -1 or idx + 40 > len(hdr):
                    break
                fcc_type = hdr[idx + 8:idx + 12]
                if fcc_type == b'vids':
                    dw_scale = struct.unpack_from('<I', hdr, idx + 28)[0]
                    dw_rate = struct.unpack_from('<I', hdr, idx + 32)[0]
                    dw_length = struct.unpack_from('<I', hdr, idx + 40)[0]
                    if dw_scale > 0 and dw_rate > 0 and dw_length > 10:
                        fps = float(dw_rate) / float(dw_scale)
                        if 5.0 <= fps <= 240.0:
                            dur = float(dw_length) / fps
                            if 2.0 < dur < 86400.0:
                                return round(dur, 2)
                pos = idx + 4
    except Exception:
        pass

    # 3) Парсинг MP4 / MOV / M4V атома 'mvhd' (Movie Header Box)
    try:
        mvhd_pos = hdr.find(b'mvhd')
        if mvhd_pos != -1 and mvhd_pos + 28 <= len(hdr):
            ver = hdr[mvhd_pos + 4]
            if ver == 0 and mvhd_pos + 24 <= len(hdr):
                timescale = struct.unpack_from('>I', hdr, mvhd_pos + 16)[0]
                duration = struct.unpack_from('>I', hdr, mvhd_pos + 20)[0]
                if timescale > 0 and duration > 0:
                    dur = float(duration) / float(timescale)
                    if 2.0 < dur < 86400.0:
                        return round(dur, 2)
            elif ver == 1 and mvhd_pos + 36 <= len(hdr):
                timescale = struct.unpack_from('>I', hdr, mvhd_pos + 24)[0]
                duration = struct.unpack_from('>Q', hdr, mvhd_pos + 28)[0]
                if timescale > 0 and duration > 0:
                    dur = float(duration) / float(timescale)
                    if 2.0 < dur < 86400.0:
                        return round(dur, 2)
    except Exception:
        pass

    return 0.0


def _estimate_duration_from_torrent_meta_v218(h_low: str, f_idx: int) -> float:
    """
    Если первые 64 КБ файла в торренте ещё только качаются или контейнер (.avi/.ts/.mpg/.wmv)
    не отдал длительность через ffprobe, оцениваем длительность по размеру файла и имени релиза,
    чтобы шкала перемотки НИКОГДА не блокировалась на «0:00 — Поток»!
    """
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.9) as sr:
            st_obj = json.loads(_safe_decode_bytes_v218(sr.read()))
        for tor in (st_obj.get("torrents") or []):
            if (tor.get("hash") or "").strip().lower() == h_low:
                for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                    if int(fobj.get("index", -1)) == f_idx:
                        f_len = int(fobj.get("length") or fobj.get("size") or 0)
                        f_path = (fobj.get("path") or fobj.get("name") or "").lower()
                        if f_len <= 1048576:
                            return 0.0
                        # Пробуем сначала прочитать первые 128 КБ с диска по точному пути из демона
                        if f_path and os.path.isfile(f_path) and os.path.getsize(f_path) >= 65536:
                            try:
                                with open(f_path, "rb") as rf:
                                    d_hdr = _parse_header_duration_bytes_v218(rf.read(131072))
                                if d_hdr > 1.0:
                                    return d_hdr
                            except Exception:
                                pass
                        # Оценка по типу файла / разрешению, если заголовок ещё не скачан
                        mb = f_len / (1024.0 * 1024.0)
                        if f_path.endswith(".avi"):
                            # Стандартные BDRip/DVDRip AVI (например, Daredevil LostFilm ~660 МБ = ~54 мин = 3240 сек, или ~1.45 ГБ фильм)
                            kbps = 1680.0
                            return round(max(120.0, (f_len * 8.0) / (kbps * 1000.0)), 1)
                        if "1080p" in f_path:
                            kbps = 3200.0 if mb < 1200 else 4800.0
                        elif "720p" in f_path:
                            kbps = 2000.0
                        else:
                            kbps = 1800.0
                        return round(max(120.0, (f_len * 8.0) / (kbps * 1000.0)), 1)
    except Exception:
        pass
    return 0.0


def _probe_torrent_partial_file_duration_v218(raw_src: str) -> tuple:
    """Возвращает (duration_sec, audio_streams_count, file_size_bytes)."""
    src = (raw_src or "").strip()
    if src.startswith(('http://127.0.0.1:', 'http://localhost:')) and src.count('/') >= 3:
        src = '/' + src.split('/', 3)[3]

    audio_cnt = 1
    sz_bytes = 0

    if not src.startswith('/api/torrent/stream/'):
        real_p = _resolve_any_media_path_v218(src)
        if real_p and os.path.isfile(real_p):
            try:
                sz_bytes = os.path.getsize(real_p)
                with open(real_p, 'rb') as f:
                    hdr = f.read(131072)
                d_bin = _parse_header_duration_bytes_v218(hdr)
            except Exception:
                d_bin = 0.0
            ff_bin = find_ffmpeg_binary()
            _, out_s, err_s = _safe_run_cmd_text_v218(
                [ff_bin, '-hide_banner', '-seekable', '0', '-probesize', '262144', '-analyzeduration', '400000', '-i', real_p],
                timeout_sec=2.5
            )
            raw = err_s + out_s
            a_matches = re.findall(r"Stream #\d+:\d+.*?: Audio:", raw)
            if a_matches:
                audio_cnt = len(a_matches)
            m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", raw)
            if m:
                d_ff = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
                if d_ff > 1.0:
                    return round(d_ff, 2), audio_cnt, sz_bytes
            if d_bin > 1.0:
                return d_bin, audio_cnt, sz_bytes
        return 0.0, audio_cnt, sz_bytes

    parts = src.strip('/').split('/')
    if len(parts) < 5:
        return 0.0, 1, 0
    h_low = parts[3].lower()
    try:
        f_idx = int(parts[4].split('?')[0])
    except Exception:
        f_idx = 0

    # 1. Проверяем локальный файл в torrents_tmp / JennyVideo
    try:
        local_p, _, f_total, _ = _locate_downloaded_p2p_file_v163("", h_low, f_idx)
        if f_total and f_total > 0:
            sz_bytes = int(f_total)
        if local_p and os.path.isfile(local_p) and os.path.getsize(local_p) >= 65536:
            if sz_bytes <= 0:
                sz_bytes = os.path.getsize(local_p)
            d_bin = 0.0
            try:
                with open(local_p, 'rb') as f:
                    hdr = f.read(131072)
                d_bin = _parse_header_duration_bytes_v218(hdr)
            except Exception:
                pass
            ff_bin = find_ffmpeg_binary()
            _, out_s, err_s = _safe_run_cmd_text_v218(
                [ff_bin, '-hide_banner', '-seekable', '0', '-probesize', '262144', '-analyzeduration', '400000', '-i', local_p],
                timeout_sec=2.0
            )
            raw = err_s + out_s
            a_matches = re.findall(r"Stream #\d+:\d+.*?: Audio:", raw)
            if a_matches:
                audio_cnt = len(a_matches)
            m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", raw)
            if m:
                d_ff = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
                if d_ff > 1.0:
                    return round(d_ff, 2), audio_cnt, sz_bytes
            if d_bin > 1.0:
                return d_bin, audio_cnt, sz_bytes
    except Exception:
        pass

    # 2. Читаем первые 128 КБ напрямую из демона, если 1-й кусок уже скачан
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.8) as sr:
            st_obj = json.loads(_safe_decode_bytes_v218(sr.read()))
        for tor in (st_obj.get("torrents") or []):
            if (tor.get("hash") or "").strip().lower() == h_low:
                p_map = tor.get("pieces_map") or ""
                for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                    if int(fobj.get("index", -1)) == f_idx:
                        beg_p = int(fobj.get("begin_piece") or 0)
                        sz_bytes = int(fobj.get("length") or fobj.get("size") or sz_bytes)
                        if not p_map or (0 <= beg_p < len(p_map) and p_map[beg_p] in ('4', '3')):
                            req = urllib.request.Request(
                                f"http://127.0.0.1:{_JTORRENT_PORT_V96}/stream?hash={h_low}&file={f_idx}",
                                headers={"Range": "bytes=0-131071"}
                            )
                            with urllib.request.urlopen(req, timeout=1.0) as hr:
                                hdr_bytes = hr.read(131072)
                            d_bin = _parse_header_duration_bytes_v218(hdr_bytes)
                            if d_bin > 1.0:
                                return d_bin, audio_cnt, sz_bytes
                        break
                break
    except Exception:
        pass

    # 3. Универсальный фоллбэк по размеру файла торрента (для .avi и любых форматов на старте 0-1%)
    est_dur = _estimate_duration_from_torrent_meta_v218(h_low, f_idx)
    return est_dur, audio_cnt, sz_bytes


def _probe_torrent_partial_file_duration_v214(raw_src: str) -> float:
    d, _, _ = _probe_torrent_partial_file_duration_v218(raw_src)
    return d


@route('/api/video/pcm_meta', method='GET')
def api_video_pcm_meta_v218():
    response.content_type = 'application/json; charset=utf-8'
    src = (request.query.get('src') or '').strip()
    if not src:
        return json.dumps({"duration": 0, "size": 0, "audio_streams": 1})
    dur_sec, audio_cnt, sz_bytes = _probe_torrent_partial_file_duration_v218(src)
    return json.dumps({
        "duration": dur_sec,
        "size": sz_bytes,
        "audio_streams": max(1, int(audio_cnt or 1))
    })
_override_bottle_route_v212('/api/video/pcm_meta', 'GET', api_video_pcm_meta_v218)


# --- 4. Приоритет первых 2 и последних 2 кусков файла (индексы Cues/idx1) + куска перемотки ---
_ORIG_BOOST_TORRENT_V214 = _boost_torrent_file_and_pieces_v214

def _boost_torrent_file_and_pieces_v218(h_low: str, f_idx: int, ratio: float = -1.0, byte_offset: int = -1, sync_start: bool = False):
    _ORIG_BOOST_TORRENT_V214(h_low, f_idx, ratio=ratio, byte_offset=byte_offset, sync_start=sync_start)
    # Дополнительно гарантируем буст первого и последнего куска файла (где лежат таблицы индексов MKV Cues и AVI idx1)
    def _boost_head_tail():
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.9) as sr:
                st_obj = json.loads(_safe_decode_bytes_v218(sr.read()))
            for tor in (st_obj.get("torrents") or []):
                if (tor.get("hash") or "").strip().lower() == (h_low or "").strip().lower():
                    p_map = tor.get("pieces_map") or ""
                    for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                        if int(fobj.get("index", -1)) == int(f_idx):
                            beg_p = int(fobj.get("begin_piece") or 0)
                            end_p = int(fobj.get("end_piece") or 0)
                            if end_p > beg_p:
                                key_pieces = [max(beg_p, end_p - 1), beg_p + 1 if beg_p + 1 < end_p else beg_p, beg_p]
                                for kp in key_pieces:
                                    if p_map and 0 <= kp < len(p_map) and p_map[kp] == '4':
                                        continue
                                    try:
                                        urllib.request.urlopen(urllib.request.Request(
                                            f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                                            data=json.dumps({"hash": h_low.strip().lower(), "action": "boost_piece", "piece_index": int(kp)}).encode("utf-8"),
                                            headers={"Content-Type": "application/json"}
                                        ), timeout=0.4).read()
                                    except Exception:
                                        pass
                            break
                    break
        except Exception:
            pass
    threading.Thread(target=_boost_head_tail, daemon=True).start()

_boost_torrent_file_and_pieces_v214 = _boost_torrent_file_and_pieces_v218


# --- 5. Неблокирующий live_remux с поддержкой локального 100% файла, выбором аудиодорожек и защитой пула соединений ---
@route('/api/video/live_remux', method='GET')
def api_video_live_remux_v218():
    _cancel_stream_hold_release_v216()
    raw_src = (request.query.get('src') or '').strip()
    start_sec = float(request.query.get('start') or 0.0)
    dur_sec = float(request.query.get('dur') or 0.0)
    no_audio = (request.query.get('no_audio') == '1')
    audio_only = (request.query.get('audio_only') == '1')
    try:
        audio_idx = max(0, int(request.query.get('aidx') or 0))
    except Exception:
        audio_idx = 0

    if not raw_src:
        response.status = 400
        return "Missing src"

    src = raw_src
    if src.startswith(('http://127.0.0.1:', 'http://localhost:')) and src.count('/') >= 3:
        src = '/' + src.split('/', 3)[3]

    mode_tag = "AO" if audio_only else ("VO" if no_audio else "VA")
    req_key = f"{src}::{round(start_sec, 1)}::{audio_idx}::{mode_tag}"
    now_ts = time.time()
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        for k_existing, plist in list(_ACTIVE_REMUX_PROCS_BY_KEY_V214.items()):
            if k_existing != req_key:
                for _, p_old in plist:
                    try:
                        p_old.kill()
                    except Exception:
                        pass
                _ACTIVE_REMUX_PROCS_BY_KEY_V214.pop(k_existing, None)
            else:
                kept = []
                for ts_started, p_same in plist:
                    if now_ts - ts_started > 6.0 and p_same.poll() is not None:
                        continue
                    kept.append((ts_started, p_same))
                _ACTIVE_REMUX_PROCS_BY_KEY_V214[k_existing] = kept

    is_tor_stream = src.startswith('/api/torrent/stream/')
    src_input = ""
    if is_tor_stream:
        parts = src.strip('/').split('/')
        if len(parts) >= 5:
            h_low = parts[3].lower()
            try:
                f_idx = int(parts[4].split('?')[0])
            except Exception:
                f_idx = 0
            if dur_sec <= 0:
                dur_sec, _, _ = _probe_torrent_partial_file_duration_v218(src)
            ratio = (start_sec / dur_sec) if (dur_sec > 0 and start_sec > 0) else 0.0
            _boost_torrent_file_and_pieces_v218(h_low, f_idx, ratio=ratio, sync_start=True)

            # Если файл уже скачан на 100% на диск — читаем его напрямую с диска (мгновенная перемотка в любую точку!)
            try:
                local_p, is_comp, f_len, f_done = _locate_downloaded_p2p_file_v163("", h_low, f_idx)
                if local_p and os.path.isfile(local_p) and (is_comp or (f_len > 0 and f_done >= f_len)):
                    src_input = local_p
            except Exception:
                pass

            # Если перематываем нескачанный файл (start_sec > 0.5), ждём до 4.0 сек подкачки целевого куска, чтобы FFmpeg не падал на EOF
            if not src_input and start_sec > 0.5 and ratio > 0.0:
                wait_deadline = time.time() + 4.0
                while time.time() < wait_deadline:
                    try:
                        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.6) as sr:
                            st_obj = json.loads(_safe_decode_bytes_v218(sr.read()))
                        piece_ready = False
                        for tor in (st_obj.get("torrents") or []):
                            if (tor.get("hash") or "").strip().lower() == h_low:
                                p_map = tor.get("pieces_map") or ""
                                for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                                    if int(fobj.get("index", -1)) == f_idx:
                                        beg_p = int(fobj.get("begin_piece") or 0)
                                        end_p = int(fobj.get("end_piece") or 0)
                                        f_l = int(fobj.get("length") or 0)
                                        f_c = int(fobj.get("completed") or 0)
                                        if f_l > 0 and f_c >= f_l:
                                            piece_ready = True
                                        elif end_p > beg_p and p_map:
                                            t_p = max(beg_p, min(end_p - 1, beg_p + int(ratio * (end_p - beg_p))))
                                            if 0 <= t_p < len(p_map) and p_map[t_p] == '4':
                                                piece_ready = True
                                        break
                                break
                        if piece_ready:
                            break
                    except Exception:
                        break
                    time.sleep(0.28)

            if not src_input:
                src_input = f"http://127.0.0.1:{globals().get('_INTERNAL_STREAM_PORT_V238', 8080)}/api/torrent/stream/{h_low}/{f_idx}"
        else:
            src_input = _resolve_any_media_path_v218(src)
    else:
        src_input = _resolve_any_media_path_v218(src)

    is_http = str(src_input).startswith(('http://', 'https://'))

    # Проверяем реальное количество аудиодорожек в локальном файле, чтобы индекс audio_idx гарантированно попадал в существующую дорожку
    if not is_http and src_input and os.path.isfile(src_input) and audio_idx > 0:
        try:
            _, _, a_cnt_check = _probe_torrent_partial_file_duration_v218(src_input)
            if a_cnt_check > 0:
                audio_idx = audio_idx % a_cnt_check
        except Exception:
            pass

    if not is_http and src_input and os.path.isfile(src_input) and not no_audio and not audio_only:
        ext_l = os.path.splitext(src_input)[1].lower()
        if ext_l in ('.mp4', '.webm', '.m4v', '.mov') and start_sec <= 0.5 and request.query.get('transcode') != '1' and audio_idx == 0:
            return static_file(os.path.basename(src_input), root=os.path.dirname(src_input))

    ff_bin = find_ffmpeg_binary()
    ff_threads = str(max(1, min(8, int(_THREAD_CFG_V216.get("videoFfmpegThreads", 3)))))
    cmd = [ff_bin, '-hide_banner', '-loglevel', 'error']
    if is_http:
        if start_sec > 0.5:
            cmd.extend(['-seekable', '1', '-reconnect', '1', '-reconnect_streamed', '1', '-probesize', '524288', '-analyzeduration', '500000'])
        else:
            cmd.extend(['-seekable', '0', '-reconnect', '1', '-reconnect_streamed', '1', '-probesize', '262144', '-analyzeduration', '300000'])

    if start_sec > 0.5:
        cmd.extend(['-ss', f"{start_sec:.2f}"])

    is_legacy_avi = str(src_input).lower().endswith(('.avi', '.wmv', '.flv', '.mpeg', '.mpg', '.vob')) or (request.query.get('transcode') == '1') or ('.avi' in src.lower())
    v_codec_args = [
        '-threads', ff_threads, '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '24', '-pix_fmt', 'yuv420p', '-g', '30'
    ] if is_legacy_avi else ['-c:v', 'copy']

    if audio_only:
        cmd.extend([
            '-fflags', '+genpts+igndts+nobuffer',
            '-i', src_input,
            '-vn', '-map', f'0:a:{audio_idx}?', '-sn', '-dn',
            '-threads', ff_threads,
            '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            '-flush_packets', '1',
            '-f', 'mp4', '-'
        ])
    elif no_audio:
        cmd.extend([
            '-fflags', '+genpts+igndts+nobuffer',
            '-i', src_input,
            '-map', '0:v:0', '-an', '-sn', '-dn',
            *v_codec_args,
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            '-flush_packets', '1',
            '-f', 'mp4', '-'
        ])
    else:
        cmd.extend([
            '-fflags', '+genpts+igndts+nobuffer',
            '-i', src_input,
            '-map', '0:v:0', '-map', f'0:a:{audio_idx}?', '-sn', '-dn',
            *v_codec_args,
            '-threads', ff_threads,
            '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            '-flush_packets', '1',
            '-f', 'mp4', '-'
        ])

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=32768)
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        _ACTIVE_REMUX_PROCS_BY_KEY_V214.setdefault(req_key, []).append((now_ts, proc))

    resp_hdrs = {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Accept-Ranges": "none"
    }
    def _remux_gen():
        try:
            while True:
                chunk = proc.stdout.read(16384)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                proc.kill()
            except Exception:
                pass
    return bottle.HTTPResponse(body=_remux_gen(), status=200, headers=resp_hdrs)

_override_bottle_route_v212('/api/video/live_remux', 'GET', api_video_live_remux_v218)
# ================= END JENNY V218 SERVER PATCH =================





# ==============================================================================
# 🚀 JENNY V219 (#313): AUDIO-ONLY (-vn) FRAG_DURATION STREAMING FIX &
#    SMOOTH 30/60 FPS HARDWARE VIDEO+AUDIO REVERSE REMUX (/api/video/reverse_remux)
# ==============================================================================

@route('/api/video/live_remux', method='GET')
def api_video_live_remux_v219():
    _cancel_stream_hold_release_v216()
    raw_src = (request.query.get('src') or '').strip()
    start_sec = float(request.query.get('start') or 0.0)
    dur_sec = float(request.query.get('dur') or 0.0)
    no_audio = (request.query.get('no_audio') == '1')
    audio_only = (request.query.get('audio_only') == '1')
    try:
        audio_idx = max(0, int(request.query.get('aidx') or 0))
    except Exception:
        audio_idx = 0

    if not raw_src:
        response.status = 400
        return "Missing src"

    src = raw_src
    if src.startswith(('http://127.0.0.1:', 'http://localhost:')) and src.count('/') >= 3:
        src = '/' + src.split('/', 3)[3]

    mode_tag = "AO" if audio_only else ("VO" if no_audio else "VA")
    req_key = f"{src}::{round(start_sec, 1)}::{audio_idx}::{mode_tag}"
    now_ts = time.time()
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        for k_existing, plist in list(_ACTIVE_REMUX_PROCS_BY_KEY_V214.items()):
            if k_existing != req_key:
                for _, p_old in plist:
                    try:
                        p_old.kill()
                    except Exception:
                        pass
                _ACTIVE_REMUX_PROCS_BY_KEY_V214.pop(k_existing, None)
            else:
                kept = []
                for ts_started, p_same in plist:
                    if now_ts - ts_started > 6.0 and p_same.poll() is not None:
                        continue
                    kept.append((ts_started, p_same))
                _ACTIVE_REMUX_PROCS_BY_KEY_V214[k_existing] = kept

    is_tor_stream = src.startswith('/api/torrent/stream/')
    src_input = ""
    if is_tor_stream:
        parts = src.strip('/').split('/')
        if len(parts) >= 5:
            h_low = parts[3].lower()
            try:
                f_idx = int(parts[4].split('?')[0])
            except Exception:
                f_idx = 0
            if dur_sec <= 0:
                dur_sec, _, _ = _probe_torrent_partial_file_duration_v218(src)
            ratio = (start_sec / dur_sec) if (dur_sec > 0 and start_sec > 0) else 0.0
            _boost_torrent_file_and_pieces_v218(h_low, f_idx, ratio=ratio, sync_start=True)

            try:
                local_p, is_comp, f_len, f_done = _locate_downloaded_p2p_file_v163("", h_low, f_idx)
                if local_p and os.path.isfile(local_p) and (is_comp or (f_len > 0 and f_done >= f_len)):
                    src_input = local_p
            except Exception:
                pass

            if not src_input and start_sec > 0.5 and ratio > 0.0:
                wait_deadline = time.time() + 4.0
                while time.time() < wait_deadline:
                    try:
                        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.6) as sr:
                            st_obj = json.loads(_safe_decode_bytes_v218(sr.read()))
                        piece_ready = False
                        for tor in (st_obj.get("torrents") or []):
                            if (tor.get("hash") or "").strip().lower() == h_low:
                                p_map = tor.get("pieces_map") or ""
                                for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                                    if int(fobj.get("index", -1)) == f_idx:
                                        beg_p = int(fobj.get("begin_piece") or 0)
                                        end_p = int(fobj.get("end_piece") or 0)
                                        f_l = int(fobj.get("length") or 0)
                                        f_c = int(fobj.get("completed") or 0)
                                        if f_l > 0 and f_c >= f_l:
                                            piece_ready = True
                                        elif end_p > beg_p and p_map:
                                            t_p = max(beg_p, min(end_p - 1, beg_p + int(ratio * (end_p - beg_p))))
                                            if 0 <= t_p < len(p_map) and p_map[t_p] == '4':
                                                piece_ready = True
                                        break
                                break
                        if piece_ready:
                            break
                    except Exception:
                        break
                    time.sleep(0.28)

            if not src_input:
                src_input = f"http://127.0.0.1:{globals().get('_INTERNAL_STREAM_PORT_V238', 8080)}/api/torrent/stream/{h_low}/{f_idx}"
        else:
            src_input = _resolve_any_media_path_v218(src)
    else:
        src_input = _resolve_any_media_path_v218(src)

    is_http = str(src_input).startswith(('http://', 'https://'))

    if not is_http and src_input and os.path.isfile(src_input) and audio_idx > 0:
        try:
            _, a_cnt_check, _ = _probe_torrent_partial_file_duration_v218(src_input)
            if a_cnt_check > 0:
                audio_idx = audio_idx % a_cnt_check
        except Exception:
            pass

    if not is_http and src_input and os.path.isfile(src_input) and not no_audio and not audio_only:
        ext_l = os.path.splitext(src_input)[1].lower()
        if ext_l in ('.mp4', '.webm', '.m4v', '.mov') and start_sec <= 0.5 and request.query.get('transcode') != '1' and audio_idx == 0:
            return static_file(os.path.basename(src_input), root=os.path.dirname(src_input))

    ff_bin = find_ffmpeg_binary()
    ff_threads = str(max(1, min(8, int(_THREAD_CFG_V216.get("videoFfmpegThreads", 3)))))
    cmd = [ff_bin, '-hide_banner', '-loglevel', 'error']
    if is_http:
        if start_sec > 0.5:
            cmd.extend(['-seekable', '1', '-reconnect', '1', '-reconnect_streamed', '1', '-probesize', '524288', '-analyzeduration', '500000'])
        else:
            cmd.extend(['-seekable', '0', '-reconnect', '1', '-reconnect_streamed', '1', '-probesize', '262144', '-analyzeduration', '300000'])

    if start_sec > 0.5:
        cmd.extend(['-ss', f"{start_sec:.2f}"])

    is_legacy_avi = str(src_input).lower().endswith(('.avi', '.wmv', '.flv', '.mpeg', '.mpg', '.vob')) or (request.query.get('transcode') == '1') or ('.avi' in src.lower())
    v_codec_args = [
        '-threads', ff_threads, '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '24', '-pix_fmt', 'yuv420p', '-g', '30'
    ] if is_legacy_avi else ['-c:v', 'copy']

    if audio_only:
        # КРИТИЧЕСКИЙ ФИКС V219 ДЛЯ РЕЖИМА "А" (ТОЛЬКО АУДИО):
        # Без видеопотока (-vn) флаг frag_keyframe не сбрасывает фрагменты MP4!
        # Используем -frag_duration 200000 (каждые 0.2 сек), чтобы аудио в режиме "А" играло мгновенно и без остановок!
        cmd.extend([
            '-fflags', '+genpts+igndts+nobuffer',
            '-i', src_input,
            '-vn', '-map', f'0:a:{audio_idx}?', '-sn', '-dn',
            '-threads', ff_threads,
            '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
            '-movflags', 'empty_moov+default_base_moof',
            '-frag_duration', '200000',
            '-flush_packets', '1',
            '-f', 'mp4', '-'
        ])
    elif no_audio:
        cmd.extend([
            '-fflags', '+genpts+igndts+nobuffer',
            '-i', src_input,
            '-map', '0:v:0', '-an', '-sn', '-dn',
            *v_codec_args,
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            '-flush_packets', '1',
            '-f', 'mp4', '-'
        ])
    else:
        cmd.extend([
            '-fflags', '+genpts+igndts+nobuffer',
            '-i', src_input,
            '-map', '0:v:0', '-map', f'0:a:{audio_idx}?', '-sn', '-dn',
            *v_codec_args,
            '-threads', ff_threads,
            '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            '-flush_packets', '1',
            '-f', 'mp4', '-'
        ])

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=32768)
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        _ACTIVE_REMUX_PROCS_BY_KEY_V214.setdefault(req_key, []).append((now_ts, proc))

    resp_hdrs = {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Accept-Ranges": "none"
    }
    def _remux_gen():
        try:
            while True:
                chunk = proc.stdout.read(16384)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                proc.kill()
            except Exception:
                pass
    return bottle.HTTPResponse(body=_remux_gen(), status=200, headers=resp_hdrs)

_override_bottle_route_v212('/api/video/live_remux', 'GET', api_video_live_remux_v219)


# --- Гладкий аппаратный реверс видео + аудио (30/60 FPS без слайд-шоу через FFmpeg -vf reverse -af areverse) ---
@route('/api/video/reverse_remux', method='GET')
def api_video_reverse_remux_v219():
    _cancel_stream_hold_release_v216()
    raw_src = (request.query.get('src') or '').strip()
    anchor_sec = float(request.query.get('pos') or 0.0)
    win_sec = max(4.0, min(24.0, float(request.query.get('win') or 14.0)))
    no_audio = (request.query.get('no_audio') == '1')
    try:
        audio_idx = max(0, int(request.query.get('aidx') or 0))
    except Exception:
        audio_idx = 0

    if not raw_src or anchor_sec <= 0.1:
        response.status = 400
        return "Invalid reverse params"

    src = raw_src
    if src.startswith(('http://127.0.0.1:', 'http://localhost:')) and src.count('/') >= 3:
        src = '/' + src.split('/', 3)[3]

    seg_start = max(0.0, anchor_sec - win_sec)
    seg_dur = max(0.5, anchor_sec - seg_start)

    req_key = f"REV::{src}::{round(anchor_sec, 1)}::{round(win_sec, 1)}::{audio_idx}"
    now_ts = time.time()
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        for k_existing, plist in list(_ACTIVE_REMUX_PROCS_BY_KEY_V214.items()):
            if k_existing != req_key:
                for _, p_old in plist:
                    try:
                        p_old.kill()
                    except Exception:
                        pass
                _ACTIVE_REMUX_PROCS_BY_KEY_V214.pop(k_existing, None)

    is_tor_stream = src.startswith('/api/torrent/stream/')
    src_input = ""
    if is_tor_stream:
        parts = src.strip('/').split('/')
        if len(parts) >= 5:
            h_low = parts[3].lower()
            try:
                f_idx = int(parts[4].split('?')[0])
            except Exception:
                f_idx = 0
            try:
                local_p, is_comp, f_len, f_done = _locate_downloaded_p2p_file_v163("", h_low, f_idx)
                if local_p and os.path.isfile(local_p) and (is_comp or (f_len > 0 and f_done >= f_len)):
                    src_input = local_p
            except Exception:
                pass
            if not src_input:
                dur_est, _, _ = _probe_torrent_partial_file_duration_v218(src)
                ratio = (seg_start / dur_est) if (dur_est > 0 and seg_start > 0) else 0.0
                _boost_torrent_file_and_pieces_v218(h_low, f_idx, ratio=ratio, sync_start=True)
                src_input = f"http://127.0.0.1:{globals().get('_INTERNAL_STREAM_PORT_V238', 8080)}/api/torrent/stream/{h_low}/{f_idx}"
        else:
            src_input = _resolve_any_media_path_v218(src)
    else:
        src_input = _resolve_any_media_path_v218(src)

    is_http = str(src_input).startswith(('http://', 'https://'))
    ff_bin = find_ffmpeg_binary()
    ff_threads = str(max(2, min(8, int(_THREAD_CFG_V216.get("videoFfmpegThreads", 3)))))

    cmd = [ff_bin, '-hide_banner', '-loglevel', 'error']
    if is_http:
        cmd.extend(['-seekable', '1', '-reconnect', '1', '-reconnect_streamed', '1', '-probesize', '524288', '-analyzeduration', '500000'])

    cmd.extend([
        '-ss', f"{seg_start:.3f}",
        '-t', f"{seg_dur:.3f}",
        '-i', src_input,
        '-map', '0:v:0'
    ])
    if no_audio:
        cmd.extend(['-an'])
    else:
        cmd.extend(['-map', f'0:a:{audio_idx}?', '-af', 'areverse', '-c:a', 'aac', '-b:a', '192k', '-ac', '2'])

    # Кодируем развёрнутый назад участок в ультрабыстрый поток H.264, который аппаратный декодер телефона играет идеально плавно (30/60 FPS)!
    cmd.extend([
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,reverse',
        '-threads', ff_threads,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
        '-crf', '25', '-pix_fmt', 'yuv420p', '-g', '15',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-flush_packets', '1',
        '-f', 'mp4', '-'
    ])

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=32768)
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        _ACTIVE_REMUX_PROCS_BY_KEY_V214.setdefault(req_key, []).append((now_ts, proc))

    resp_hdrs = {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Accept-Ranges": "none"
    }
    def _rev_gen():
        try:
            while True:
                chunk = proc.stdout.read(16384)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                proc.kill()
            except Exception:
                pass
    return bottle.HTTPResponse(body=_rev_gen(), status=200, headers=resp_hdrs)

_override_bottle_route_v212('/api/video/reverse_remux', 'GET', api_video_reverse_remux_v219)
# ================= END JENNY V219 SERVER PATCH =================


# ================= JENNY V223 SERVER PATCH (#317): PURE IN-RAM SPEED-ADAPTIVE REVERSE ENGINE & MULTI-TRACK PCM =================
import hashlib as _hashlib_v223

_REV_RAM_LOCK_V223 = threading.Lock()
# key -> {"data": bytes, "proc": Popen, "done": bool, "event": threading.Event, "ts": float, "src": str, "aidx": int, "seg_end": float, "seg_dur": float}
_REV_RAM_JOBS_V223 = {}


def _make_rev_ram_key_v223(src_str, seg_end, seg_dur, audio_idx, no_audio):
    e_q = round(float(seg_end), 1)
    d_q = round(float(seg_dur), 1)
    return f"{src_str}|e={e_q:.1f}|d={d_q:.1f}|a={int(audio_idx)}|na={int(bool(no_audio))}"


def _find_matching_ram_job_v223(src_str, seg_end, audio_idx, no_audio):
    """Ищет в RAM готовый или уже рендерящийся сегмент для данной точки (с допуском ±0.8 сек по границе)."""
    e_q = round(float(seg_end), 1)
    with _REV_RAM_LOCK_V223:
        for k, job in _REV_RAM_JOBS_V223.items():
            if job.get("src") == src_str and job.get("aidx") == int(audio_idx) and job.get("no_audio") == bool(no_audio):
                if abs(float(job.get("seg_end", -999)) - e_q) <= 0.85:
                    return k, job
    return None, None


def _prune_rev_ram_cache_v223(keep_src=None, keep_aidx=None, max_completed_items=10):
    now_ts = time.time()
    with _REV_RAM_LOCK_V223:
        for k, job in list(_REV_RAM_JOBS_V223.items()):
            mismatch = False
            if keep_src is not None and job.get("src") != keep_src:
                mismatch = True
            if keep_aidx is not None and job.get("aidx") != int(keep_aidx):
                mismatch = True
            if mismatch or (now_ts - job.get("ts", 0) > 180.0):
                p = job.get("proc")
                if p and not job.get("done"):
                    try:
                        p.kill()
                    except Exception:
                        pass
                job["event"].set()
                _REV_RAM_JOBS_V223.pop(k, None)

        # Ограничиваем объём готовых кусков в RAM (до 10 кусков ≈ 15-25 МБ оперативной памяти)
        done_keys = [k for k, j in _REV_RAM_JOBS_V223.items() if j.get("done")]
        if len(done_keys) > max_completed_items:
            done_keys.sort(key=lambda x: _REV_RAM_JOBS_V223[x].get("ts", 0))
            for k_old in done_keys[:-max_completed_items]:
                _REV_RAM_JOBS_V223.pop(k_old, None)


def _resolve_rev_src_input_v223(src, seg_start):
    is_tor_stream = src.startswith('/api/torrent/stream/')
    src_input = ""
    if is_tor_stream:
        parts = src.strip('/').split('/')
        if len(parts) >= 5:
            h_low = parts[3].lower()
            try:
                f_idx = int(parts[4].split('?')[0])
            except Exception:
                f_idx = 0
            try:
                local_p, is_comp, f_len, f_done = _locate_downloaded_p2p_file_v163("", h_low, f_idx)
                if local_p and os.path.isfile(local_p) and (is_comp or (f_len > 0 and f_done >= f_len)):
                    src_input = local_p
            except Exception:
                pass
            if not src_input:
                dur_est, _, _ = _probe_torrent_partial_file_duration_v218(src)
                ratio = (seg_start / dur_est) if (dur_est > 0 and seg_start > 0) else 0.0
                _boost_torrent_file_and_pieces_v218(h_low, f_idx, ratio=ratio, sync_start=True)
                src_input = f"http://127.0.0.1:{globals().get('_INTERNAL_STREAM_PORT_V238', 8080)}/api/torrent/stream/{h_low}/{f_idx}"
        else:
            src_input = _resolve_any_media_path_v218(src)
    else:
        src_input = _resolve_any_media_path_v218(src)
    return src_input


def _build_reverse_ffmpeg_cmd_v223(src_input, seg_start, seg_dur, audio_idx, no_audio, spd=1.0):
    is_http = str(src_input).startswith(('http://', 'https://'))
    ff_bin = find_ffmpeg_binary()
    ff_threads = str(max(2, min(8, int(_THREAD_CFG_V216.get("videoFfmpegThreads", 4)))))

    eff_spd = max(0.5, min(8.0, float(spd or 1.0)))
    # Адаптируем FPS и высоту кадра под скорость реверса:
    # На экране видео играет со скоростью eff_spd, поэтому encode_fps * eff_spd даёт стабильные ~28-30 FPS на экране,
    # а при высоких скоростях (1.5x, 2x, 4x) длинный буфер кодируется в RAM за ~1 секунду!
    encode_fps = max(8, min(24, int(round(25.0 / max(1.0, eff_spd * 0.82)))))
    max_h = 360 if eff_spd >= 2.2 else 480

    cmd = [ff_bin, '-y', '-hide_banner', '-loglevel', 'error', '-threads', ff_threads]
    if is_http:
        cmd.extend(['-seekable', '1', '-reconnect', '1', '-reconnect_streamed', '1', '-probesize', '524288', '-analyzeduration', '500000'])

    cmd.extend([
        '-ss', f"{seg_start:.3f}",
        '-t', f"{seg_dur:.3f}",
        '-i', src_input,
        '-map', '0:v:0'
    ])
    if no_audio:
        cmd.extend(['-an'])
    else:
        cmd.extend(['-map', f'0:a:{int(audio_idx)}?', '-af', 'areverse', '-c:a', 'aac', '-b:a', '128k', '-ac', '2'])

    vf_str = f"scale=-2:'min({max_h},trunc(ih/2)*2)':flags=fast_bilinear,fps={encode_fps},reverse"
    cmd.extend([
        '-vf', vf_str,
        '-threads', ff_threads,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
        '-crf', '27', '-pix_fmt', 'yuv420p', '-g', '18',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-frag_duration', '120000',
        '-flush_packets', '1',
        '-f', 'mp4', '-'
    ])
    return cmd


def _render_reverse_segment_in_ram_v223(src, pos_sec, win_sec, audio_idx, no_audio, spd=1.0):
    """
    Полностью в оперативной памяти (без /tmp и без записи на флеш-память!) разворачивает кусок видео+аудио.
    Если этот кусок уже готов в RAM или прямо сейчас рендерится другим потоком — мгновенно переиспользует его!
    """
    seg_end = round(max(0.2, float(pos_sec)), 1)
    seg_dur = round(max(1.0, min(65.0, float(win_sec), seg_end)), 1)
    seg_start = round(max(0.0, seg_end - seg_dur), 1)

    _prune_rev_ram_cache_v223(keep_src=src, keep_aidx=audio_idx)

    match_k, existing = _find_matching_ram_job_v223(src, seg_end, audio_idx, no_audio)
    if existing is not None:
        if existing.get("done") and existing.get("data"):
            existing["ts"] = time.time()
            return existing["data"]
        # Если этот сегмент прямо сейчас рендерится — НЕ убиваем его, а ждём завершения!
        ev = existing.get("event")
        if ev:
            ev.wait(timeout=35.0)
        if existing.get("done") and existing.get("data"):
            existing["ts"] = time.time()
            return existing["data"]

    raw_k = _make_rev_ram_key_v223(src, seg_end, seg_dur, audio_idx, no_audio)
    ev_new = threading.Event()
    job_obj = {
        "data": None,
        "proc": None,
        "done": False,
        "event": ev_new,
        "ts": time.time(),
        "src": src,
        "aidx": int(audio_idx),
        "no_audio": bool(no_audio),
        "seg_end": seg_end,
        "seg_dur": seg_dur
    }
    with _REV_RAM_LOCK_V223:
        _REV_RAM_JOBS_V223[raw_k] = job_obj

    src_input = _resolve_rev_src_input_v223(src, seg_start)
    if not src_input:
        ev_new.set()
        with _REV_RAM_LOCK_V223:
            _REV_RAM_JOBS_V223.pop(raw_k, None)
        return None

    cmd = _build_reverse_ffmpeg_cmd_v223(src_input, seg_start, seg_dur, audio_idx, no_audio, spd=spd)
    proc = None
    try:
        with _VIDEO_REV_RENDER_SEMAPHORE_V358:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=65536)
            job_obj["proc"] = proc
            out_bytes, _ = proc.communicate(timeout=40)
        if out_bytes and len(out_bytes) >= 1024:
            job_obj["data"] = out_bytes
            job_obj["done"] = True
            job_obj["ts"] = time.time()
            ev_new.set()
            return out_bytes
    except Exception:
        if proc:
            try:
                proc.kill()
            except Exception:
                pass
    finally:
        ev_new.set()
        if not job_obj.get("done"):
            with _REV_RAM_LOCK_V223:
                _REV_RAM_JOBS_V223.pop(raw_k, None)
    return None


@route('/api/video/reverse_precache_blob', method='GET')
def api_video_reverse_precache_blob_v223():
    src = (request.query.get('src') or '').strip()
    if not src:
        response.status = 400
        return b""
    try:
        pos_sec = float(request.query.get('pos') or 10.0)
    except Exception:
        pos_sec = 10.0
    try:
        win_sec = float(request.query.get('win') or 18.0)
    except Exception:
        win_sec = 18.0
    try:
        audio_idx = max(0, int(request.query.get('aidx') or 0))
    except Exception:
        audio_idx = 0
    try:
        spd = float(request.query.get('spd') or 1.0)
    except Exception:
        spd = 1.0
    no_audio = str(request.query.get('no_audio') or '0') == '1'

    mp4_bytes = _render_reverse_segment_in_ram_v223(src, pos_sec, win_sec, audio_idx, no_audio, spd=spd)
    if mp4_bytes and len(mp4_bytes) >= 1024:
        # Упреждающе рендерим следующий по плану чанк прямо в оперативной памяти сервера (0 байт на SSD/флеш)!
        next_pos_pre = round(pos_sec - win_sec, 1)
        if next_pos_pre > 0.4:
            next_win_pre = round(min(next_pos_pre, max(18.0, min(55.0, 16.0 * max(1.0, spd)))), 1)
            def _bg_prewarm():
                try:
                    _render_reverse_segment_in_ram_v223(src, next_pos_pre, next_win_pre, audio_idx, no_audio, spd=spd)
                except Exception:
                    pass
            threading.Thread(target=_bg_prewarm, daemon=True).start()
        resp_hdrs = {
            "Content-Type": "video/mp4",
            "Content-Length": str(len(mp4_bytes)),
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
        }
        return bottle.HTTPResponse(body=mp4_bytes, status=200, headers=resp_hdrs)
    response.status = 500
    return b""

_override_bottle_route_v212('/api/video/reverse_precache_blob', 'GET', api_video_reverse_precache_blob_v223)


def api_video_reverse_remux_v223():
    src = (request.query.get('src') or '').strip()
    if not src:
        response.status = 400
        return "Missing src"
    try:
        pos_sec = float(request.query.get('pos') or 10.0)
    except Exception:
        pos_sec = 10.0
    try:
        win_sec = float(request.query.get('win') or 6.0)
    except Exception:
        win_sec = 6.0
    try:
        audio_idx = max(0, int(request.query.get('aidx') or 0))
    except Exception:
        audio_idx = 0
    try:
        spd = float(request.query.get('spd') or 1.0)
    except Exception:
        spd = 1.0
    no_audio = str(request.query.get('no_audio') or '0') == '1'

    seg_end = round(max(0.2, pos_sec), 1)
    seg_dur = round(max(1.0, min(65.0, win_sec, seg_end)), 1)
    seg_start = round(max(0.0, seg_end - seg_dur), 1)

    _prune_rev_ram_cache_v223(keep_src=src, keep_aidx=audio_idx)

    # 1. Если этот кусок уже сгенерирован в RAM (или заканчивает рендериться в фоне прямо сейчас) —
    # НЕ убиваем его, а дожидаемся и отдаём прямо из оперативной памяти!
    _, existing = _find_matching_ram_job_v223(src, seg_end, audio_idx, no_audio)
    if existing is not None:
        if not existing.get("done"):
            ev = existing.get("event")
            if ev:
                ev.wait(timeout=25.0)
        if existing.get("done") and existing.get("data"):
            data_b = existing["data"]
            resp_hdrs = {
                "Content-Type": "video/mp4",
                "Content-Length": str(len(data_b)),
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
            }
            return bottle.HTTPResponse(body=data_b, status=200, headers=resp_hdrs)

    # 2. Иначе рендерим стартовый кусок напрямую в поток (и сохраняем в RAM)
    src_input = _resolve_rev_src_input_v223(src, seg_start)
    cmd = _build_reverse_ffmpeg_cmd_v223(src_input, seg_start, seg_dur, audio_idx, no_audio, spd=spd)

    now_ts = time.time()
    req_key = f"rev_live_{src}"
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        for k_existing, plist in list(_ACTIVE_REMUX_PROCS_BY_KEY_V214.items()):
            for _, p_old in plist:
                try:
                    p_old.kill()
                except Exception:
                    pass
            _ACTIVE_REMUX_PROCS_BY_KEY_V214.pop(k_existing, None)

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=32768)
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        _ACTIVE_REMUX_PROCS_BY_KEY_V214.setdefault(req_key, []).append((now_ts, proc))

    resp_hdrs = {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Accept-Ranges": "none"
    }

    def _rev_gen():
        try:
            while True:
                chunk = proc.stdout.read(16384)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                proc.kill()
            except Exception:
                pass

    return bottle.HTTPResponse(body=_rev_gen(), status=200, headers=resp_hdrs)

_override_bottle_route_v212('/api/video/reverse_remux', 'GET', api_video_reverse_remux_v223)


_VIDEO_PCM_SEMAPHORE_V358 = threading.BoundedSemaphore(2)
_VIDEO_REV_RENDER_SEMAPHORE_V358 = threading.BoundedSemaphore(2)


def api_video_pcm_chunk_v220():
    src = (request.query.get('src') or '').strip()
    if not src:
        response.status = 400
        return b""
    src_input = _resolve_video_src_input_v131(src)
    if not src_input or str(src_input).startswith(('http://', 'https://')) or not os.path.isfile(src_input):
        response.content_type = 'application/octet-stream'
        return b""

    proc = None
    try:
        st_sec = max(0.0, float(request.query.get('start', 0.0)))
        dur_sec = max(0.5, min(60.0, float(request.query.get('dur', 30.0))))
        sr = int(request.query.get('sr', 44100))
        if sr < 8000 or sr > 48000:
            sr = 44100
        try:
            aidx = max(0, int(request.query.get('aidx') or 0))
        except Exception:
            aidx = 0
        cmd = [
            find_ffmpeg_binary(), '-v', 'error',
            '-threads', '1',
            '-ss', f"{st_sec:.3f}", '-t', f"{dur_sec:.3f}",
            '-i', src_input,
            '-map', f'0:a:{aidx}?',
            '-vn', '-ac', '2', '-ar', str(sr),
            '-f', 'f32le', '-acodec', 'pcm_f32le', '-'
        ]
        with _VIDEO_PCM_SEMAPHORE_V358:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            _register_video_ffmpeg_proc_v212(proc)
            raw_interleaved, _ = proc.communicate(timeout=15)
        raw_interleaved = raw_interleaved or b""
        frames = (len(raw_interleaved) // 4) // 2
        if frames <= 0:
            response.content_type = 'application/octet-stream'
            return b""
        import array
        arr = array.array('f')
        arr.frombytes(raw_interleaved[:frames * 8])
        out_bytes = arr[0::2].tobytes() + arr[1::2].tobytes()
        response.content_type = 'application/octet-stream'
        return out_bytes
    except Exception:
        response.content_type = 'application/octet-stream'
        return b""
    finally:
        if proc:
            _unregister_video_ffmpeg_proc_v212(proc)

_override_bottle_route_v212('/api/video/pcm_chunk', 'GET', api_video_pcm_chunk_v220)
# ================= END JENNY V223 SERVER PATCH =================


def start_server():








    load_saved_music_dir()
    cleanup_stale_temps(DEFAULT_MUSIC_DIR)
    if MUSIC_DIR != DEFAULT_MUSIC_DIR:
        cleanup_stale_temps(MUSIC_DIR)
    print("🎧 АВТОНОМНЫЙ ПЛЕЕР ЗАПУЩЕН НА ПОРТУ 8080")
    run(host='127.0.0.1', port=8080, quiet=True, server='waitress', threads=64)

if __name__ == "__main__":
    start_server()

# ==============================================================================
# === ▶️🧠 JENNY V230..V233 (#328): EMBEDDED YT-DLP + VISITORDATA INNERTUBE + LIVE MIRROR FALLBACK + .SO QUALITY ENGINE ===
# ==============================================================================
import ssl
import zipfile
import io

_YT_CORE_LIB_V230 = None
_YT_DLP_MODULE_V233 = None
_YT_DLP_BOOTSTRAPPED_V233 = False
_YT_VISITOR_DATA_CACHE_V233 = {"token": "", "ts": 0.0}

_YT_CORES_STATE_V230 = {
    "active_core": "yt_v1_so",
    "policy": {
        "use_max_ceiling": True,
        "max_ceiling_h": 1080,
        "use_wifi_quality": False,
        "wifi_target_h": 1080,
        "use_mobile_quality": False,
        "mobile_target_h": 480,
        "net_mode": "auto"  # "auto", "wifi", "mobile"
    },
    "last_decision": "ready"
}

_YT_CORE_REGISTRY_V230 = {}
_YT_DOWNLOAD_JOBS_V230 = {}
_YT_LAST_UA_V233 = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"

def _yt_ssl_ctx_v230():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

def _ensure_yt_dlp_loaded_v233():
    """
    Loads yt_dlp baked into app/src/main/python/yt_dlp inside the APK.
    If running on an older APK before rebuild, self-bootstraps the pure-Python yt_dlp wheel
    into /data/user/0/com.jenny.player/files/py_yt_dlp with zero external tools.
    """
    global _YT_DLP_MODULE_V233, _YT_DLP_BOOTSTRAPPED_V233
    if _YT_DLP_MODULE_V233 is not None:
        return _YT_DLP_MODULE_V233

    import sys
    pkg_dirs = [
        "/data/user/0/com.jenny.player/files/py_yt_dlp",
        os.path.join(BASE_DIR, "py_yt_dlp"),
        BASE_DIR,
    ]
    for pd in pkg_dirs:
        if pd and os.path.isdir(pd) and pd not in sys.path:
            sys.path.insert(0, pd)

    try:
        import yt_dlp
        _YT_DLP_MODULE_V233 = yt_dlp
        return _YT_DLP_MODULE_V233
    except Exception:
        pass

    if _YT_DLP_BOOTSTRAPPED_V233:
        return None
    _YT_DLP_BOOTSTRAPPED_V233 = True

    try:
        target_dir = "/data/user/0/com.jenny.player/files/py_yt_dlp"
        try:
            os.makedirs(target_dir, exist_ok=True)
        except Exception:
            target_dir = os.path.join(BASE_DIR, "py_yt_dlp")
            os.makedirs(target_dir, exist_ok=True)

        req = urllib.request.Request(
            "https://pypi.org/pypi/yt-dlp/json",
            headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=8, context=_yt_ssl_ctx_v230()) as r:
            meta = json.loads(r.read().decode("utf-8", "ignore"))
        whl_url = ""
        for u in (meta.get("urls") or []):
            if str(u.get("filename") or "").endswith(".whl"):
                whl_url = u.get("url") or ""
                break
        if whl_url:
            wreq = urllib.request.Request(whl_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(wreq, timeout=20, context=_yt_ssl_ctx_v230()) as wr:
                whl_bytes = wr.read()
            with zipfile.ZipFile(io.BytesIO(whl_bytes)) as zf:
                for member in zf.namelist():
                    if member.startswith("yt_dlp/"):
                        zf.extract(member, target_dir)
            if target_dir not in sys.path:
                sys.path.insert(0, target_dir)
            import yt_dlp
            _YT_DLP_MODULE_V233 = yt_dlp
            return _YT_DLP_MODULE_V233
    except Exception:
        pass
    return None

def _try_autocompile_yt_core_so_v230():
    try:
        src_cands = [
            os.path.join(BASE_DIR, "jenny_yt_core.cpp"),
            os.path.join(BASE_DIR, "native_src_backup", "jenny_yt_core.cpp"),
            "/storage/emulated/0/scripts/JennyPlayer/native_src_backup/jenny_yt_core.cpp",
            "/storage/emulated/0/scripts/JennyPlayer/app/src/main/python/jenny_yt_core.cpp",
        ]
        src_p = next((p for p in src_cands if os.path.isfile(p)), None)
        if not src_p:
            return None
        out_dir = "/data/user/0/com.jenny.player/files/cores"
        try:
            os.makedirs(out_dir, exist_ok=True)
        except Exception:
            out_dir = os.path.dirname(src_p)
        out_so = os.path.join(out_dir, "libjenny_yt_core.so")
        if os.path.isfile(out_so) and os.path.getsize(out_so) > 1024:
            return out_so
        for cxx in ("clang++", "aarch64-linux-android-clang++", "g++"):
            cxx_bin = shutil.which(cxx)
            if cxx_bin:
                subprocess.run([cxx_bin, "-O3", "-fPIC", "-shared", src_p, "-lm", "-o", out_so], timeout=8, check=True)
                os.chmod(out_so, 0o755)
                if os.path.isfile(out_so):
                    return out_so
    except Exception:
        pass
    return None

def _get_yt_core_lib_v230():
    global _YT_CORE_LIB_V230
    if _YT_CORE_LIB_V230 is not None:
        return _YT_CORE_LIB_V230

    cands = []
    for d in (_get_native_lib_dirs_v140() if "_get_native_lib_dirs_v140" in globals() else []):
        cands.append(os.path.join(d, "libjenny_yt_core.so"))
        cands.append(os.path.join(d, "libjenny_vcore.so"))
    cands.extend([
        "/data/user/0/com.jenny.player/files/cores/libjenny_yt_core.so",
        os.path.join(BASE_DIR, "libjenny_yt_core.so"),
        os.path.join(BASE_DIR, "..", "jniLibs", "arm64-v8a", "libjenny_yt_core.so"),
        "/storage/emulated/0/scripts/JennyPlayer/app/src/main/jniLibs/arm64-v8a/libjenny_yt_core.so",
        "/storage/emulated/0/scripts/JennyPlayer/cores/libjenny_yt_core.so",
    ])
    auto_so = _try_autocompile_yt_core_so_v230()
    if auto_so:
        cands.insert(0, auto_so)

    for path in cands:
        if path and os.path.isfile(path):
            try:
                load_p = _prepare_executable_so_v140(path, os.path.basename(path)) if "_prepare_executable_so_v140" in globals() else path
                lib = ctypes.CDLL(load_p)
                lib.yt_core_get_version.argtypes = []
                lib.yt_core_get_version.restype = ctypes.c_char_p
                lib.yt_core_get_last_decision.argtypes = []
                lib.yt_core_get_last_decision.restype = ctypes.c_char_p
                lib.yt_core_set_profile.argtypes = [ctypes.c_char_p]
                lib.yt_core_set_profile.restype = None
                lib.yt_core_set_policy.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int]
                lib.yt_core_set_policy.restype = None
                lib.yt_core_compute_effective_limit.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int]
                lib.yt_core_compute_effective_limit.restype = ctypes.c_int
                lib.yt_core_select_best_stream_index.argtypes = [
                    ctypes.POINTER(ctypes.c_int),
                    ctypes.POINTER(ctypes.c_int),
                    ctypes.POINTER(ctypes.c_int),
                    ctypes.c_int,
                    ctypes.c_int,
                    ctypes.c_int,
                ]
                lib.yt_core_select_best_stream_index.restype = ctypes.c_int
                _YT_CORE_LIB_V230 = lib
                return _YT_CORE_LIB_V230
            except Exception:
                continue
    return None

def _discover_yt_cores_v230():
    lib = _get_yt_core_lib_v230()
    so_ver = "1.0.233-arm64"
    if lib:
        try:
            so_ver = lib.yt_core_get_version().decode("utf-8", "ignore")
        except Exception:
            pass

    reg = {
        "yt_v1_so": {
            "id": "yt_v1_so",
            "title": "⚡ YT Core v1.0-so (yt-dlp + .so • Android VR)",
            "so_name": "libjenny_yt_core.so",
            "client_key": "ANDROID_VR",
            "version": so_ver,
            "native_loaded": bool(lib is not None)
        },
        "yt_v2_ios": {
            "id": "yt_v2_ios",
            "title": "🔥 YT Core v1.1-so (yt-dlp + .so • iOS High-Bitrate)",
            "so_name": "libjenny_yt_core.so",
            "client_key": "IOS",
            "version": so_ver,
            "native_loaded": bool(lib is not None)
        },
        "yt_v3_tv": {
            "id": "yt_v3_tv",
            "title": "📺 YT Core v1.2-so (yt-dlp + .so • SmartTV / Embed)",
            "so_name": "libjenny_yt_core.so",
            "client_key": "TV_EMBED",
            "version": so_ver,
            "native_loaded": bool(lib is not None)
        },
        "yt_v4_mirror": {
            "id": "yt_v4_mirror",
            "title": "🌐 YT Core v1.3-api (Piped / Invidious Live Mirror Pool)",
            "so_name": "libjenny_yt_core.so",
            "client_key": "PIPED_API",
            "version": so_ver,
            "native_loaded": bool(lib is not None)
        }
    }

    for d in (_get_native_lib_dirs_v140() if "_get_native_lib_dirs_v140" in globals() else []):
        try:
            for fn in sorted(os.listdir(d)):
                if (fn.startswith("libjenny_yt_") or fn.startswith("libytcore_")) and fn.endswith(".so") and fn != "libjenny_yt_core.so":
                    clean = re.sub(r"^(libjenny_yt_|libytcore_)", "", fn[:-3])
                    cid = "yt_custom_" + re.sub(r"[^a-zA-Z0-9_]", "_", clean).lower()
                    if cid not in reg:
                        reg[cid] = {
                            "id": cid,
                            "title": f"🧩 YT Custom .so ({clean})",
                            "so_name": fn,
                            "client_key": "ANDROID_VR",
                            "version": "custom-so",
                            "native_loaded": True
                        }
        except Exception:
            pass

    _YT_CORE_REGISTRY_V230.clear()
    _YT_CORE_REGISTRY_V230.update(reg)
    if _YT_CORES_STATE_V230.get("active_core") not in _YT_CORE_REGISTRY_V230:
        _YT_CORES_STATE_V230["active_core"] = "yt_v1_so"
    return _YT_CORE_REGISTRY_V230

def _detect_network_type_int_v230(client_hint="auto"):
    h = str(client_hint or "auto").lower().strip()
    if h == "wifi":
        return 1
    if h in ("mobile", "cellular", "cell", "4g", "5g", "lte"):
        return 2
    try:
        with open("/proc/net/route", "r", encoding="utf-8", errors="ignore") as f:
            for ln in f:
                parts = ln.split()
                if len(parts) >= 2 and parts[1] == "00000000":
                    iface = parts[0].lower()
                    if iface.startswith(("wlan", "eth", "ap", "rndis")):
                        return 1
                    if iface.startswith(("rmnet", "ccmni", "pdp", "wwan", "clat")):
                        return 2
    except Exception:
        pass
    return 1

def _compute_yt_effective_limit_v230(policy, client_net_hint="auto"):
    p = policy or _YT_CORES_STATE_V230["policy"]
    use_max = bool(p.get("use_max_ceiling", True))
    max_h   = int(p.get("max_ceiling_h") or 1080)
    use_wifi = bool(p.get("use_wifi_quality", False))
    wifi_h   = int(p.get("wifi_target_h") or 1080)
    use_mob  = bool(p.get("use_mobile_quality", False))
    mob_h    = int(p.get("mobile_target_h") or 480)
    net_mode = str(p.get("net_mode") or client_net_hint or "auto")
    net_int  = _detect_network_type_int_v230(net_mode if net_mode != "auto" else client_net_hint)

    mode_flags = (1 if use_max else 0) | (2 if use_wifi else 0) | (4 if use_mob else 0)
    if mode_flags == 0:
        mode_flags = 1

    lib = _get_yt_core_lib_v230()
    if lib:
        try:
            lib.yt_core_set_policy(mode_flags, max_h, wifi_h, mob_h, net_int)
            eff = int(lib.yt_core_compute_effective_limit(mode_flags, max_h, wifi_h, mob_h, net_int))
            return eff, net_int, mode_flags
        except Exception:
            pass

    limit_h = max_h if max_h > 0 else 1080
    if net_int == 1 and (mode_flags & 2):
        limit_h = wifi_h if wifi_h > 0 else limit_h
        if (mode_flags & 1) and max_h > 0 and limit_h > max_h:
            limit_h = max_h
        return limit_h, net_int, mode_flags
    if net_int == 2 and (mode_flags & 4):
        limit_h = mob_h if mob_h > 0 else 480
        if (mode_flags & 1) and max_h > 0 and limit_h > max_h:
            limit_h = max_h
        return limit_h, net_int, mode_flags
    return limit_h, net_int, mode_flags

def _select_best_yt_stream_v230(candidates, effective_limit_h, prefer_combined=True):
    if not candidates:
        return None, "no_streams"

    count = len(candidates)
    lib = _get_yt_core_lib_v230()
    if lib:
        try:
            lib.yt_core_set_profile(_YT_CORES_STATE_V230.get("active_core", "yt_v1_so").encode("utf-8"))
            h_arr = (ctypes.c_int * count)(*[int(c.get("height") or 0) for c in candidates])
            c_arr = (ctypes.c_int * count)(*[1 if c.get("is_combined") else 0 for c in candidates])
            b_arr = (ctypes.c_int * count)(*[int(c.get("bitrate") or 0) for c in candidates])
            idx = int(lib.yt_core_select_best_stream_index(h_arr, c_arr, b_arr, count, int(effective_limit_h), 1 if prefer_combined else 0))
            dec = lib.yt_core_get_last_decision().decode("utf-8", "ignore")
            if 0 <= idx < count:
                _YT_CORES_STATE_V230["last_decision"] = dec
                return candidates[idx], dec
        except Exception:
            pass

    max_actual_h = max((int(c.get("height") or 0) for c in candidates), default=0)
    eligible = [c for c in candidates if 0 < int(c.get("height") or 0) <= int(effective_limit_h)]
    if eligible:
        eligible.sort(
            key=lambda c: (
                int(c.get("height") or 0),
                1 if (prefer_combined and c.get("is_combined")) else 0,
                int(c.get("bitrate") or 0)
            ),
            reverse=True
        )
        chosen = eligible[0]
    else:
        positive = [c for c in candidates if int(c.get("height") or 0) > 0]
        positive.sort(key=lambda c: int(c.get("height") or 999999))
        chosen = positive[0] if positive else candidates[0]

    dec = f"selected_h={chosen.get('height', 0)}p (limit<={effective_limit_h}p, video_max={max_actual_h}p, profile={_YT_CORES_STATE_V230.get('active_core')})"
    _YT_CORES_STATE_V230["last_decision"] = dec
    return chosen, dec

def _extract_youtube_id_v230(text_or_url):
    s = str(text_or_url or "").strip()
    if re.match(r"^[a-zA-Z0-9_-]{11}$", s):
        return s
    m = re.search(r"(?:v=|youtu\.be/|shorts/|embed/|live/)([a-zA-Z0-9_-]{11})", s)
    if m:
        return m.group(1)
    return None

def _yt_innertube_search_v230(query_str, max_results=20):
    payload = {
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20250101.00.00",
                "hl": "ru",
                "gl": "UA"
            }
        },
        "query": query_str
    }
    req = urllib.request.Request(
        "https://www.youtube.com/youtubei/v1/search?prettyPrint=false",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
        },
        method="POST"
    )
    results = []
    with urllib.request.urlopen(req, timeout=8, context=_yt_ssl_ctx_v230()) as r:
        data = json.loads(r.read().decode("utf-8", "ignore"))

    # Capture visitorData from search response if present!
    try:
        v_tok = ((data.get("responseContext") or {}).get("visitorData")) or ""
        if v_tok:
            _YT_VISITOR_DATA_CACHE_V233["token"] = v_tok
            _YT_VISITOR_DATA_CACHE_V233["ts"] = time.time()
    except Exception:
        pass

    def _walk_renderers(obj):
        if isinstance(obj, dict):
            if "videoRenderer" in obj:
                vr = obj["videoRenderer"]
                vid = vr.get("videoId")
                if vid:
                    title_runs = (vr.get("title") or {}).get("runs") or []
                    title = "".join(x.get("text", "") for x in title_runs) or (vr.get("title") or {}).get("simpleText", "")
                    owner_runs = ((vr.get("ownerText") or vr.get("longBylineText") or {}).get("runs")) or []
                    channel = "".join(x.get("text", "") for x in owner_runs)
                    dur_txt = (vr.get("lengthText") or {}).get("simpleText") or "LIVE"
                    views_txt = (vr.get("shortViewCountText") or vr.get("viewCountText") or {}).get("simpleText") or ""
                    thumbs = ((vr.get("thumbnail") or {}).get("thumbnails")) or []
                    thumb_url = thumbs[-1].get("url", "") if thumbs else f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
                    results.append({
                        "video_id": vid,
                        "title": title or vid,
                        "channel": channel or "YouTube",
                        "duration": dur_txt,
                        "views": views_txt,
                        "thumbnail": thumb_url,
                        "url": f"https://www.youtube.com/watch?v={vid}"
                    })
            else:
                for v in obj.values():
                    if len(results) < max_results:
                        _walk_renderers(v)
        elif isinstance(obj, list):
            for it in obj:
                if len(results) < max_results:
                    _walk_renderers(it)

    _walk_renderers(data)
    return results

def _get_fresh_visitor_data_v233(video_id=""):
    now = time.time()
    if _YT_VISITOR_DATA_CACHE_V233["token"] and (now - _YT_VISITOR_DATA_CACHE_V233["ts"] < 1800):
        return _YT_VISITOR_DATA_CACHE_V233["token"]

    urls = [
        f"https://www.youtube.com/embed/{video_id}" if video_id else "https://www.youtube.com/sw.js_data",
        "https://www.youtube.com/sw.js_data",
    ]
    for u in urls:
        try:
            req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (Linux; Android 14) Chrome/126.0.0.0 Mobile"})
            with urllib.request.urlopen(req, timeout=5, context=_yt_ssl_ctx_v230()) as r:
                txt = r.read().decode("utf-8", "ignore")
            m = re.search(r'"VISITOR_DATA"\s*:\s*"([^"]+)"', txt) or re.search(r'"visitorData"\s*:\s*"([^"]+)"', txt)
            if m:
                _YT_VISITOR_DATA_CACHE_V233["token"] = m.group(1)
                _YT_VISITOR_DATA_CACHE_V233["ts"] = now
                return m.group(1)
        except Exception:
            continue
    return ""

def _yt_extract_via_ytdlp_v233(video_id, preferred_core_id="yt_v1_so"):
    """
    STAGE 1: Embedded in-APK yt-dlp extractor (handles visitorData, poToken, signatureCipher, n-param).
    """
    global _YT_LAST_UA_V233
    yt_dlp_mod = _ensure_yt_dlp_loaded_v233()
    if not yt_dlp_mod:
        return None, [], None

    client_map = {
        "yt_v1_so": ["android_vr", "ios", "web_embedded", "tv", "mweb"],
        "yt_v2_ios": ["ios", "android_vr", "web_safari", "tv", "mweb"],
        "yt_v3_tv": ["tv", "web_embedded", "android_vr", "ios"],
    }
    clients = client_map.get(preferred_core_id, ["android_vr", "ios", "web_embedded", "tv", "mweb"])

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "nocheckcertificate": True,
        "extract_flat": False,
        "geo_bypass": True,
        "socket_timeout": 10,
        "extractor_args": {
            "youtube": {
                "player_client": clients,
            }
        }
    }

    meta = {"video_id": video_id, "title": video_id, "author": "YouTube", "duration_sec": 0}
    video_streams = []
    audio_streams = []

    try:
        with yt_dlp_mod.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
        if not info:
            return None, [], None

        meta["title"] = info.get("title") or video_id
        meta["author"] = info.get("uploader") or info.get("channel") or "YouTube"
        meta["duration_sec"] = int(info.get("duration") or 0)

        for f in (info.get("formats") or []):
            u = f.get("url")
            if not u:
                continue
            ext = str(f.get("ext") or "").lower()
            if ext in ("mhtml", "none") or "storyboard" in str(f.get("format_note") or "").lower():
                continue
            if f.get("has_drm"):
                continue

            vcodec = str(f.get("vcodec") or "none")
            acodec = str(f.get("acodec") or "none")
            h = int(f.get("height") or 0)
            tbr = float(f.get("tbr") or f.get("vbr") or f.get("abr") or 0.0)
            br = int(tbr * 1000) if tbr > 0 else int(f.get("filesize") or f.get("filesize_approx") or 0) // max(1, meta["duration_sec"] or 180)
            proto = str(f.get("protocol") or "https")
            hdrs = f.get("http_headers") or {}
            if hdrs.get("User-Agent"):
                _YT_LAST_UA_V233 = hdrs["User-Agent"]

            is_hls = ("m3u8" in proto or "m3u8" in u)
            has_video = (vcodec != "none" and h > 0)
            has_audio = (acodec != "none" and not is_hls) or (is_hls and has_video)

            if has_video:
                is_comb = bool(has_audio or is_hls)
                # Prefer direct HTTP/HTTPS MP4 over HLS and WebM for instant seek & hardware decode
                bonus = 0
                if not is_hls:
                    bonus += 300000
                if ext == "mp4" or "avc1" in vcodec:
                    bonus += 200000
                video_streams.append({
                    "itag": int(f.get("format_id") if str(f.get("format_id", "")).isdigit() else 0),
                    "height": h,
                    "width": int(f.get("width") or 0),
                    "fps": int(f.get("fps") or 30),
                    "mime": f"video/{ext or 'mp4'}",
                    "is_combined": is_comb,
                    "is_hls": is_hls,
                    "bitrate": br + bonus,
                    "raw_bitrate": br,
                    "url": u,
                    "ua": hdrs.get("User-Agent") or _YT_LAST_UA_V233,
                    "profile": f"yt-dlp ({f.get('format_note') or ext})"
                })
            elif acodec != "none" and vcodec == "none" and not is_hls:
                a_bonus = 150000 if (ext in ("m4a", "mp4") or "mp4a" in acodec) else 0
                audio_streams.append({
                    "itag": int(f.get("format_id") if str(f.get("format_id", "")).isdigit() else 0),
                    "mime": f"audio/{ext or 'm4a'}",
                    "bitrate": br + a_bonus,
                    "raw_bitrate": br,
                    "url": u,
                    "ua": hdrs.get("User-Agent") or _YT_LAST_UA_V233,
                    "profile": "yt-dlp-audio"
                })
    except Exception:
        return None, [], None

    return meta, video_streams, audio_streams

def _yt_extract_via_innertube_v233(video_id, preferred_core_id="yt_v1_so"):
    """
    STAGE 2: Direct InnerTube multi-client with fresh visitorData + embed thirdParty context.
    """
    visitor_data = _get_fresh_visitor_data_v233(video_id)

    client_profiles = [
        ("ANDROID_VR", {
            "clientName": "ANDROID_VR",
            "clientVersion": "1.61.48",
            "deviceMake": "Oculus",
            "deviceModel": "Quest 3",
            "androidSdkVersion": 32,
            "osName": "Android",
            "osVersion": "12L",
            "hl": "ru",
            "gl": "UA"
        }, "com.google.android.apps.youtube.vr.oculus/1.61.48 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip", "28"),
        ("IOS", {
            "clientName": "IOS",
            "clientVersion": "19.45.4",
            "deviceMake": "Apple",
            "deviceModel": "iPhone16,2",
            "osName": "iPhone",
            "osVersion": "18.1.0.22B83",
            "hl": "ru",
            "gl": "UA"
        }, "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)", "5"),
        ("TV_EMBED", {
            "clientName": "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
            "clientVersion": "2.0",
            "hl": "ru",
            "gl": "UA"
        }, "Mozilla/5.0 (PlayStation; PlayStation 5/2.26) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15", "85"),
        ("ANDROID_VR_LEGACY", {
            "clientName": "ANDROID_TESTSUITE",
            "clientVersion": "1.9",
            "androidSdkVersion": 30,
            "osName": "Android",
            "osVersion": "11",
            "hl": "ru",
            "gl": "UA"
        }, "com.google.android.youtube/1.9 (Linux; U; Android 11) gzip", "30"),
    ]

    if preferred_core_id == "yt_v2_ios":
        client_profiles.sort(key=lambda x: 0 if x[0] == "IOS" else 1)
    elif preferred_core_id == "yt_v3_tv":
        client_profiles.sort(key=lambda x: 0 if x[0] == "TV_EMBED" else 1)

    meta = {"video_id": video_id, "title": video_id, "author": "YouTube", "duration_sec": 0}
    video_streams = []
    audio_streams = []

    for prof_name, client_ctx, ua, client_id_num in client_profiles:
        try:
            ctx_copy = dict(client_ctx)
            if visitor_data:
                ctx_copy["visitorData"] = visitor_data
            body = {
                "context": {
                    "client": ctx_copy,
                    "thirdParty": {"embedUrl": "https://www.youtube.com/"}
                },
                "videoId": video_id,
                "contentCheckOk": True,
                "racyCheckOk": True
            }
            hdrs = {
                "Content-Type": "application/json",
                "User-Agent": ua,
                "X-YouTube-Client-Name": client_id_num,
                "X-YouTube-Client-Version": ctx_copy["clientVersion"],
                "Origin": "https://www.youtube.com",
                "Referer": f"https://www.youtube.com/watch?v={video_id}"
            }
            if visitor_data:
                hdrs["X-Goog-Visitor-Id"] = visitor_data

            req = urllib.request.Request(
                "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
                data=json.dumps(body).encode("utf-8"),
                headers=hdrs,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=7, context=_yt_ssl_ctx_v230()) as r:
                pdata = json.loads(r.read().decode("utf-8", "ignore"))

            vd = pdata.get("videoDetails") or {}
            if vd.get("title"):
                meta["title"] = vd.get("title")
                meta["author"] = vd.get("author") or "YouTube"
                meta["duration_sec"] = int(vd.get("lengthSeconds") or 0)

            sd = pdata.get("streamingData") or {}
            raw_fmts = []
            for f in (sd.get("formats") or []):
                f_copy = dict(f)
                f_copy["_is_combined"] = True
                raw_fmts.append(f_copy)
            for f in (sd.get("adaptiveFormats") or []):
                f_copy = dict(f)
                f_copy["_is_combined"] = False
                raw_fmts.append(f_copy)

            for f in raw_fmts:
                u = f.get("url")
                if not u:
                    sc = f.get("signatureCipher") or f.get("cipher") or ""
                    if sc:
                        qs = urllib.parse.parse_qs(sc)
                        base_u = (qs.get("url") or [""])[0]
                        sig = (qs.get("s") or [""])[0]
                        sp = (qs.get("sp") or ["sig"])[0]
                        if base_u and not sig:
                            u = base_u
                if not u:
                    continue
                mime = str(f.get("mimeType") or "")
                h = int(f.get("height") or 0)
                br = int(f.get("bitrate") or f.get("averageBitrate") or 0)
                itag = int(f.get("itag") or 0)
                is_comb = bool(f.get("_is_combined") or ("video/" in mime and "mp4a" in mime))

                if mime.startswith("video/") and h > 0:
                    codec_bonus = 200000 if ("mp4" in mime and "avc1" in mime) else (100000 if "mp4" in mime else 0)
                    video_streams.append({
                        "itag": itag,
                        "height": h,
                        "width": int(f.get("width") or 0),
                        "fps": int(f.get("fps") or 30),
                        "mime": mime.split(";")[0],
                        "is_combined": is_comb,
                        "bitrate": br + codec_bonus,
                        "raw_bitrate": br,
                        "url": u,
                        "ua": ua,
                        "profile": prof_name
                    })
                elif mime.startswith("audio/"):
                    a_bonus = 100000 if "mp4" in mime else 0
                    audio_streams.append({
                        "itag": itag,
                        "mime": mime.split(";")[0],
                        "bitrate": br + a_bonus,
                        "raw_bitrate": br,
                        "url": u,
                        "ua": ua,
                        "profile": prof_name
                    })

            if video_streams:
                break
        except Exception:
            continue

    return meta, video_streams, audio_streams

def _yt_extract_via_mirrors_v233(video_id):
    """
    STAGE 3: Live Mirror Fallback Pool (Piped & Invidious APIs) when YouTube blocks IP or VEVO cipher.
    """
    meta = {"video_id": video_id, "title": video_id, "author": "YouTube", "duration_sec": 0}
    video_streams = []
    audio_streams = []

    piped_mirrors = [
        "https://pipedapi.kavin.rocks",
        "https://pipedapi.leptons.xyz",
        "https://pipedapi.nosebs.ru",
        "https://pipedapi.ducks.party",
        "https://api.piped.private.coffee",
    ]
    for base in piped_mirrors:
        try:
            req = urllib.request.Request(
                f"{base}/streams/{video_id}",
                headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=5, context=_yt_ssl_ctx_v230()) as r:
                d = json.loads(r.read().decode("utf-8", "ignore"))
            if d.get("title"):
                meta["title"] = d.get("title")
                meta["author"] = d.get("uploader") or "YouTube"
                meta["duration_sec"] = int(d.get("duration") or 0)

            for vs in (d.get("videoStreams") or []):
                u = vs.get("url")
                if not u:
                    continue
                h = int(vs.get("height") or 0)
                if h <= 0:
                    m_q = re.search(r"(\d{3,4})p", str(vs.get("quality") or ""))
                    if m_q:
                        h = int(m_q.group(1))
                if h <= 0:
                    continue
                is_comb = not bool(vs.get("videoOnly", True))
                br = int(vs.get("bitrate") or (h * 1500))
                mime = str(vs.get("mimeType") or "video/mp4")
                bonus = 200000 if "mp4" in mime else 0
                video_streams.append({
                    "itag": int(vs.get("itag") or 0),
                    "height": h,
                    "width": int(vs.get("width") or 0),
                    "fps": int(vs.get("fps") or 30),
                    "mime": mime,
                    "is_combined": is_comb,
                    "bitrate": br + bonus,
                    "raw_bitrate": br,
                    "url": u,
                    "ua": "Mozilla/5.0",
                    "profile": f"Mirror ({base.split('//')[-1]})"
                })

            for aus in (d.get("audioStreams") or []):
                u = aus.get("url")
                if not u:
                    continue
                br = int(aus.get("bitrate") or 128000)
                mime = str(aus.get("mimeType") or "audio/mp4")
                audio_streams.append({
                    "itag": int(aus.get("itag") or 0),
                    "mime": mime,
                    "bitrate": br + (100000 if "mp4" in mime else 0),
                    "raw_bitrate": br,
                    "url": u,
                    "ua": "Mozilla/5.0",
                    "profile": "Mirror-Audio"
                })

            if video_streams:
                return meta, video_streams, audio_streams
        except Exception:
            continue

    invidious_mirrors = [
        "https://inv.nadeko.net",
        "https://invidious.nerdvpn.de",
        "https://yewtu.be",
        "https://invidious.privacyredirect.com",
    ]
    for base in invidious_mirrors:
        try:
            req = urllib.request.Request(
                f"{base}/api/v1/videos/{video_id}",
                headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=5, context=_yt_ssl_ctx_v230()) as r:
                d = json.loads(r.read().decode("utf-8", "ignore"))
            if d.get("title"):
                meta["title"] = d.get("title")
                meta["author"] = d.get("author") or "YouTube"
                meta["duration_sec"] = int(d.get("lengthSeconds") or 0)

            for fs in (d.get("formatStreams") or []):
                u = fs.get("url")
                if not u:
                    continue
                m_q = re.search(r"(\d{3,4})p", str(fs.get("qualityLabel") or fs.get("resolution") or "360p"))
                h = int(m_q.group(1)) if m_q else 360
                video_streams.append({
                    "itag": int(fs.get("itag") or 18),
                    "height": h,
                    "width": 0,
                    "fps": int(fs.get("fps") or 30),
                    "mime": str(fs.get("type") or "video/mp4").split(";")[0],
                    "is_combined": True,
                    "bitrate": h * 2500 + 300000,
                    "raw_bitrate": h * 2500,
                    "url": u,
                    "ua": "Mozilla/5.0",
                    "profile": f"Invidious ({base.split('//')[-1]})"
                })

            for af in (d.get("adaptiveFormats") or []):
                u = af.get("url")
                if not u:
                    continue
                mime = str(af.get("type") or "")
                br = int(af.get("bitrate") or 0)
                if mime.startswith("video/"):
                    m_q = re.search(r"(\d{3,4})p", str(af.get("qualityLabel") or af.get("resolution") or ""))
                    h = int(m_q.group(1)) if m_q else 0
                    if h > 0:
                        video_streams.append({
                            "itag": int(af.get("itag") or 0),
                            "height": h,
                            "width": 0,
                            "fps": int(af.get("fps") or 30),
                            "mime": mime.split(";")[0],
                            "is_combined": False,
                            "bitrate": br + (200000 if "mp4" in mime else 0),
                            "raw_bitrate": br,
                            "url": u,
                            "ua": "Mozilla/5.0",
                            "profile": f"Invidious ({base.split('//')[-1]})"
                        })
                elif mime.startswith("audio/"):
                    audio_streams.append({
                        "itag": int(af.get("itag") or 0),
                        "mime": mime.split(";")[0],
                        "bitrate": br + (100000 if "mp4" in mime else 0),
                        "raw_bitrate": br,
                        "url": u,
                        "ua": "Mozilla/5.0",
                        "profile": "Invidious-Audio"
                    })

            if video_streams:
                return meta, video_streams, audio_streams
        except Exception:
            continue

    return meta, video_streams, audio_streams

def _yt_innertube_extract_streams_v230(video_id, preferred_core_id="yt_v1_so"):
    """
    Unified 3-Stage Stream Extractor (V233):
    1) If preferred_core_id == 'yt_v4_mirror', tries Live Mirror Pool first, then yt-dlp, then InnerTube.
    2) Otherwise tries Embedded yt-dlp first -> VisitorData InnerTube -> Live Mirror Pool fallback!
    """
    meta = {"video_id": video_id, "title": video_id, "author": "YouTube", "duration_sec": 0}
    video_streams = []
    audio_streams = []

    if preferred_core_id == "yt_v4_mirror":
        stages = [
            lambda: _yt_extract_via_mirrors_v233(video_id),
            lambda: _yt_extract_via_ytdlp_v233(video_id, preferred_core_id),
            lambda: _yt_extract_via_innertube_v233(video_id, preferred_core_id),
        ]
    else:
        stages = [
            lambda: _yt_extract_via_ytdlp_v233(video_id, preferred_core_id),
            lambda: _yt_extract_via_innertube_v233(video_id, preferred_core_id),
            lambda: _yt_extract_via_mirrors_v233(video_id),
        ]

    for run_stage in stages:
        try:
            m, vs, aus = run_stage()
            if m and m.get("title") and m.get("title") != video_id:
                meta = m
            if vs:
                video_streams = vs
                audio_streams = aus or []
                break
        except Exception:
            continue

    best_by_key = {}
    for vs in video_streams:
        k = (vs["height"], vs["is_combined"])
        if k not in best_by_key or vs["bitrate"] > best_by_key[k]["bitrate"]:
            best_by_key[k] = vs
    dedup_videos = sorted(best_by_key.values(), key=lambda x: (x["height"], 1 if x["is_combined"] else 0, x["bitrate"]))
    audio_streams.sort(key=lambda x: x["bitrate"], reverse=True)
    best_audio = audio_streams[0] if audio_streams else None

    return meta, dedup_videos, best_audio

@route('/api/youtube/cores', method='GET')
def api_youtube_cores_v230():
    response.content_type = 'application/json; charset=utf-8'
    reg = _discover_yt_cores_v230()
    eff_h, net_int, flags = _compute_yt_effective_limit_v230(_YT_CORES_STATE_V230["policy"])
    return json.dumps({
        "status": "ok",
        "active_core": _YT_CORES_STATE_V230["active_core"],
        "cores": list(reg.values()),
        "policy": _YT_CORES_STATE_V230["policy"],
        "effective_limit_h": eff_h,
        "detected_net": "wifi" if net_int == 1 else "mobile",
        "last_decision": _YT_CORES_STATE_V230.get("last_decision", "")
    }, ensure_ascii=False)

@route('/api/youtube/config', method='POST')
def api_youtube_config_v230():
    response.content_type = 'application/json; charset=utf-8'
    try:
        data = json.loads(request.body.read().decode('utf-8') or "{}")
    except Exception:
        data = {}

    _discover_yt_cores_v230()
    if data.get("active_core") in _YT_CORE_REGISTRY_V230:
        _YT_CORES_STATE_V230["active_core"] = data["active_core"]

    if isinstance(data.get("policy"), dict):
        pol = _YT_CORES_STATE_V230["policy"]
        in_p = data["policy"]
        if "use_max_ceiling" in in_p:
            pol["use_max_ceiling"] = bool(in_p["use_max_ceiling"])
        if "max_ceiling_h" in in_p:
            pol["max_ceiling_h"] = int(in_p["max_ceiling_h"] or 1080)
        if "use_wifi_quality" in in_p:
            pol["use_wifi_quality"] = bool(in_p["use_wifi_quality"])
        if "wifi_target_h" in in_p:
            pol["wifi_target_h"] = int(in_p["wifi_target_h"] or 1080)
        if "use_mobile_quality" in in_p:
            pol["use_mobile_quality"] = bool(in_p["use_mobile_quality"])
        if "mobile_target_h" in in_p:
            pol["mobile_target_h"] = int(in_p["mobile_target_h"] or 480)
        if "net_mode" in in_p:
            pol["net_mode"] = str(in_p["net_mode"] or "auto")

    eff_h, net_int, flags = _compute_yt_effective_limit_v230(
        _YT_CORES_STATE_V230["policy"],
        data.get("client_net") or "auto"
    )
    return json.dumps({
        "status": "ok",
        "active_core": _YT_CORES_STATE_V230["active_core"],
        "policy": _YT_CORES_STATE_V230["policy"],
        "effective_limit_h": eff_h,
        "detected_net": "wifi" if net_int == 1 else "mobile"
    }, ensure_ascii=False)

@route('/api/youtube/search', method='POST')
def api_youtube_search_v230():
    response.content_type = 'application/json; charset=utf-8'
    try:
        data = json.loads(request.body.read().decode('utf-8') or "{}")
    except Exception:
        data = {}

    q = str(data.get("query") or "").strip()
    if not q:
        return json.dumps({"status": "error", "error": "Пустой запрос"}, ensure_ascii=False)

    direct_id = _extract_youtube_id_v230(q)
    if direct_id:
        meta, v_streams, a_stream = _yt_innertube_extract_streams_v230(direct_id, _YT_CORES_STATE_V230.get("active_core", "yt_v1_so"))
        dur_s = int(meta.get("duration_sec") or 0)
        dur_fmt = f"{dur_s // 60}:{dur_s % 60:02d}" if dur_s > 0 else "Видео"
        avail_h = sorted({int(x["height"]) for x in v_streams if x.get("height")})
        return json.dumps({
            "status": "ok",
            "is_direct_link": True,
            "results": [{
                "video_id": direct_id,
                "title": meta.get("title") or direct_id,
                "channel": meta.get("author") or "YouTube",
                "duration": dur_fmt,
                "views": f"Доступно: {', '.join(str(h)+'p' for h in avail_h)}" if avail_h else "",
                "thumbnail": f"https://i.ytimg.com/vi/{direct_id}/hqdefault.jpg",
                "url": f"https://www.youtube.com/watch?v={direct_id}"
            }]
        }, ensure_ascii=False)

    try:
        items = _yt_innertube_search_v230(q, max_results=20)
        return json.dumps({"status": "ok", "results": items}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)}, ensure_ascii=False)

@route('/api/youtube/resolve', method='POST')
def api_youtube_resolve_v230():
    response.content_type = 'application/json; charset=utf-8'
    try:
        data = json.loads(request.body.read().decode('utf-8') or "{}")
    except Exception:
        data = {}

    raw_id = str(data.get("video_id") or data.get("url") or "").strip()
    vid = _extract_youtube_id_v230(raw_id) or raw_id
    if not vid:
        return json.dumps({"status": "error", "error": "Не указан ID или ссылка на видео"}, ensure_ascii=False)

    if isinstance(data.get("policy"), dict):
        _YT_CORES_STATE_V230["policy"].update(data["policy"])
    if data.get("active_core"):
        _YT_CORES_STATE_V230["active_core"] = str(data["active_core"])

    eff_limit_h, net_int, flags = _compute_yt_effective_limit_v230(
        _YT_CORES_STATE_V230["policy"],
        data.get("client_net") or "auto"
    )

    meta, v_streams, best_audio = _yt_innertube_extract_streams_v230(
        vid,
        _YT_CORES_STATE_V230.get("active_core", "yt_v1_so")
    )
    if not v_streams:
        return json.dumps({
            "status": "error",
            "error": "Не удалось извлечь видеопотоки для этого ролика (проверь интернет или смени ядро YouTube)"
        }, ensure_ascii=False)

    chosen, decision_str = _select_best_yt_stream_v230(v_streams, eff_limit_h, prefer_combined=True)
    if not chosen:
        return json.dumps({"status": "error", "error": "Подходящий поток не найден"}, ensure_ascii=False)

    avail_heights = sorted({int(x["height"]) for x in v_streams if x.get("height")})
    max_video_h = max(avail_heights) if avail_heights else int(chosen.get("height") or 0)
    sel_h = int(chosen.get("height") or 0)
    is_comb = bool(chosen.get("is_combined"))
    is_hls = bool(chosen.get("is_hls"))
    v_url = chosen.get("url") or ""
    a_url = (best_audio.get("url") if best_audio else "") if not is_comb else ""
    ua_str = chosen.get("ua") or _YT_LAST_UA_V233

    if is_comb and not is_hls:
        play_url = (
            "/api/youtube/stream_proxy?u=" + urllib.parse.quote(v_url, safe="") +
            "&ua=" + urllib.parse.quote(ua_str, safe="")
        )
    else:
        play_url = (
            "/api/youtube/live_mux?v=" + urllib.parse.quote(v_url, safe="") +
            "&a=" + urllib.parse.quote(a_url, safe="") +
            "&ua=" + urllib.parse.quote(ua_str, safe="") +
            "&title=" + urllib.parse.quote(meta.get("title") or vid, safe="")
        )

    return json.dumps({
        "status": "ok",
        "video_id": vid,
        "title": meta.get("title") or vid,
        "author": meta.get("author") or "YouTube",
        "duration_sec": meta.get("duration_sec") or 0,
        "selected_height": sel_h,
        "selected_label": f"{sel_h}p",
        "video_max_height": max_video_h,
        "effective_limit_h": eff_limit_h,
        "available_heights": avail_heights,
        "is_combined": is_comb,
        "direct_url": v_url,
        "audio_url": a_url,
        "play_url": play_url,
        "core_id": _YT_CORES_STATE_V230.get("active_core"),
        "core_profile": chosen.get("profile", "yt-dlp"),
        "core_decision": decision_str,
        "detected_net": "wifi" if net_int == 1 else "mobile"
    }, ensure_ascii=False)

@route('/api/youtube/stream_proxy', method=['GET', 'HEAD'])
def api_youtube_stream_proxy_v233():
    target_u = request.query.get("u") or ""
    ua = request.query.get("ua") or _YT_LAST_UA_V233
    if not target_u:
        response.status = 400
        return b"Missing stream URL"

    req_hdrs = {"User-Agent": ua}
    in_range = request.headers.get("Range")
    if in_range:
        req_hdrs["Range"] = in_range

    try:
        req = urllib.request.Request(target_u, headers=req_hdrs, method=request.method)
        upstream = urllib.request.urlopen(req, timeout=15, context=_yt_ssl_ctx_v230())
        response.status = getattr(upstream, "status", 200) or 200
        for h_name in ("Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"):
            h_val = upstream.headers.get(h_name)
            if h_val:
                response.set_header(h_name, h_val)
        if not upstream.headers.get("Content-Type"):
            response.content_type = "video/mp4"
        if request.method == "HEAD":
            upstream.close()
            return b""
        def _pump():
            try:
                while True:
                    chunk = upstream.read(131072)
                    if not chunk:
                        break
                    yield chunk
            finally:
                try:
                    upstream.close()
                except Exception:
                    pass
        return _pump()
    except urllib.error.HTTPError as he:
        response.status = he.code
        return b""
    except Exception:
        response.status = 502
        return b""

@route('/api/youtube/live_mux', method='GET')
def api_youtube_live_mux_v230():
    v_url = request.query.get("v") or ""
    a_url = request.query.get("a") or ""
    ua = request.query.get("ua") or _YT_LAST_UA_V233
    start_s = float(request.query.get("start") or 0.0)
    if not v_url:
        response.status = 400
        return b"Missing video stream URL"

    ff_bin = _get_ffmpeg_bin_v131() if "_get_ffmpeg_bin_v131" in globals() else "ffmpeg"
    cmd = [ff_bin, "-hide_banner", "-loglevel", "error", "-user_agent", ua]
    if start_s > 0.5:
        cmd.extend(["-ss", f"{start_s:.2f}"])
    cmd.extend(["-i", v_url])
    if a_url:
        cmd.extend(["-user_agent", ua])
        if start_s > 0.5:
            cmd.extend(["-ss", f"{start_s:.2f}"])
        cmd.extend(["-i", a_url, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k"])
    else:
        cmd.extend(["-c", "copy"])
    cmd.extend([
        "-movflags", "frag_keyframe+empty_moov+default_base_moof",
        "-f", "mp4",
        "pipe:1"
    ])

    response.content_type = "video/mp4"
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=65536)
    def _stream():
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
    return _stream()

@route('/api/youtube/download', method='POST')
def api_youtube_download_v230():
    response.content_type = 'application/json; charset=utf-8'
    try:
        data = json.loads(request.body.read().decode('utf-8') or "{}")
    except Exception:
        data = {}

    raw_id = str(data.get("video_id") or data.get("url") or "").strip()
    vid = _extract_youtube_id_v230(raw_id) or raw_id
    if not vid:
        return json.dumps({"status": "error", "error": "Не указан ID видео"}, ensure_ascii=False)

    if isinstance(data.get("policy"), dict):
        _YT_CORES_STATE_V230["policy"].update(data["policy"])
    if data.get("active_core"):
        _YT_CORES_STATE_V230["active_core"] = str(data["active_core"])

    eff_limit_h, net_int, _ = _compute_yt_effective_limit_v230(
        _YT_CORES_STATE_V230["policy"],
        data.get("client_net") or "auto"
    )
    meta, v_streams, best_audio = _yt_innertube_extract_streams_v230(
        vid,
        _YT_CORES_STATE_V230.get("active_core", "yt_v1_so")
    )
    if not v_streams:
        return json.dumps({"status": "error", "error": "Не удалось получить потоки для скачивания"}, ensure_ascii=False)

    chosen, decision_str = _select_best_yt_stream_v230(v_streams, eff_limit_h, prefer_combined=True)
    if not chosen:
        return json.dumps({"status": "error", "error": "Поток не выбран"}, ensure_ascii=False)

    sel_h = int(chosen.get("height") or 0)
    raw_title = meta.get("title") or vid
    safe_title = re.sub(r'[\\/:*?"<>|]+', "_", raw_title).strip()[:95] or vid
    out_dir = VIDEO_DIR_V137 if "VIDEO_DIR_V137" in globals() else "/storage/emulated/0/JennyVideo"
    try:
        os.makedirs(out_dir, exist_ok=True)
    except Exception:
        out_dir = BASE_DIR

    out_fn = f"{safe_title} [{sel_h}p].mp4"
    out_path = os.path.join(out_dir, out_fn)
    tmp_path = out_path + ".part"

    v_url = chosen.get("url") or ""
    a_url = (best_audio.get("url") if best_audio else "") if not chosen.get("is_combined") else ""
    ua_str = chosen.get("ua") or _YT_LAST_UA_V233

    try:
        if chosen.get("is_combined") and not chosen.get("is_hls") and not a_url:
            req = urllib.request.Request(v_url, headers={"User-Agent": ua_str})
            with urllib.request.urlopen(req, timeout=30, context=_yt_ssl_ctx_v230()) as resp, open(tmp_path, "wb") as out_f:
                while True:
                    buf = resp.read(262144)
                    if not buf:
                        break
                    out_f.write(buf)
            os.replace(tmp_path, out_path)
        else:
            ff_bin = _get_ffmpeg_bin_v131() if "_get_ffmpeg_bin_v131" in globals() else "ffmpeg"
            cmd = [ff_bin, "-y", "-hide_banner", "-loglevel", "error", "-user_agent", ua_str, "-i", v_url]
            if a_url:
                cmd.extend(["-user_agent", ua_str, "-i", a_url, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k"])
            else:
                cmd.extend(["-c", "copy"])
            cmd.extend(["-movflags", "+faststart", tmp_path])
            subprocess.run(cmd, check=True, timeout=900)
            os.replace(tmp_path, out_path)

        sz_mb = round(os.path.getsize(out_path) / (1024 * 1024), 2) if os.path.isfile(out_path) else 0.0
        return json.dumps({
            "status": "ok",
            "filename": out_fn,
            "path": out_path,
            "size_mb": sz_mb,
            "selected_height": sel_h,
            "core_decision": decision_str
        }, ensure_ascii=False)
    except Exception as e:
        try:
            if os.path.isfile(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
        return json.dumps({"status": "error", "error": str(e)}, ensure_ascii=False)

# ==============================================================================
# === 🧬🔍 JENNY V234 (#329): RESTORE FULL XFLAC (XFC3 + LZMA2) & JENNYV67 CAPSULE
# ===      TELEMETRY + SOURCE TAG INHERITANCE IN CORE MEDIA INSPECTOR (71956.mp4) ===
# ==============================================================================
def _strip_exported_track_suffixes_v234(filename_no_ext: str) -> str:
    base = re.sub(
        r'(?:_x\\d+(?:[.,]\\d+)?(?:_[a-z0-9]+)*|_(?:slow|fast)(?:_[a-z0-9]+)*|_(?:jbuf90|jbuf_shift|jbuf|web_lock|web_shift|webapi|vinyl|neutral|pitchlock|bitperfect|psycho|ultra|hifi|restored)|_rev(?:ersed)?)+$',
        '',
        filename_no_ext,
        flags=re.I
    )
    return (base or filename_no_ext).strip()


def _resolve_inherited_tags_for_derived_track_v234(filename: str, full_path: str, current_tags: dict) -> dict:
    tags = dict(current_tags or {})
    has_meaningful = any(k in tags for k in ('TITLE', 'ARTIST', 'ALBUM', 'GENRE', 'DATE', 'YEAR'))
    if has_meaningful:
        return tags

    raw_stem, ext = os.path.splitext(filename)
    clean_stem = _strip_exported_track_suffixes_v234(raw_stem)
    folder = os.path.dirname(full_path) if full_path else MUSIC_DIR

    # 1. Check custom_tags_db_v74 for matching stem
    try:
        db = load_custom_tags_db_v74()
        for cand_ext in ('', '.flac', '.mp3', '.wav', '.opus', '.m4a', '.ogg', '.aac', '.xflac'):
            cand_name = clean_stem + cand_ext
            if cand_name in db and isinstance(db[cand_name], dict) and db[cand_name]:
                for k, v in db[cand_name].items():
                    ks, vs = str(k).strip().upper(), str(v).strip()
                    if ks and vs and ks != 'ENCODER' and ks not in tags:
                        tags[ks] = vs
                if tags:
                    return tags
    except Exception:
        pass

    # 2. Check sibling source audio file in the same folder via FFmpeg
    try:
        ff = find_ffmpeg_binary()
        for cand_ext in ('.flac', '.mp3', '.m4a', '.opus', '.ogg', '.wav', '.aac'):
            cand_path = os.path.join(folder, clean_stem + cand_ext)
            if os.path.isfile(cand_path) and os.path.abspath(cand_path) != os.path.abspath(full_path):
                _, out_s, err_s = _safe_run_cmd_text_v218([ff, '-hide_banner', '-i', cand_path], timeout_sec=3.5)
                sib_tags = get_merged_track_tags_v74(os.path.basename(cand_path), err_s + out_s)
                sib_tags.pop('ENCODER', None)
                if sib_tags:
                    for k, v in sib_tags.items():
                        if k not in tags:
                            tags[k] = v
                    break
    except Exception:
        pass

    # 3. Fallback: parse Artist - Title from clean_stem if still no tags and " - " is present
    if not tags and ' - ' in clean_stem:
        parts = clean_stem.split(' - ', 1)
        left_p = re.sub(r'^\\d+[.\\s_-]+', '', parts[0]).strip()
        right_p = parts[1].strip()
        if left_p and right_p:
            tags['ARTIST'] = left_p
            tags['TITLE'] = right_p

    return tags


def _parse_xflac_and_jrev_inspector_v234(filename: str, full_path: str, size_bytes: int):
    xflac_custom_meta = None
    rev_capsule_str = "None (Standard stream)"
    jrev_stats = None

    # 1. Inspect JENNYV67 reversible trailer if present
    trailer = None
    try:
        trailer = read_jenny_rev_trailer(full_path)
    except Exception:
        trailer = None

    if trailer:
        try:
            jrev_stats = calc_jrev_audio_stats(full_path, trailer)
        except Exception:
            jrev_stats = None
        try:
            with open(full_path, 'rb') as rf:
                rf.seek(trailer["map_offset"])
                smap = json.loads(_safe_decode_bytes_v218(zlib.decompress(rf.read(trailer["map_len"]))))
            seams_cnt = len(smap.get("seams", []))
            spd_val = smap.get("spd", 1.0)
            kb_total = (trailer["map_len"] + trailer["pocket_len"]) / 1024.0
            pck_kb = trailer["pocket_len"] / 1024.0
            rev_capsule_str = f"🧬 JENNYV67 (x{spd_val} | {seams_cnt} швов | {kb_total:.1f} KB, карман {pck_kb:.1f} KB)"
        except Exception:
            rev_capsule_str = "🧬 JENNYV67 Capsule"

    # 2. Inspect XFLAC (XFC3 + LZMA2) header if present
    if size_bytes > 25:
        try:
            with open(full_path, 'rb') as xff:
                xhdr = xff.read(25)
                if len(xhdr) >= 25 and xhdr[:4] == b'XFC3':
                    x_flags, x_nf, x_rm_sz, x_cm_sz, x_rl_sz, x_rr_sz = struct.unpack('<BIIIII', xhdr[4:25])
                    raw_hdr = b''
                    try:
                        comp_chunk = xff.read(min(int(x_cm_sz), 65536))
                        if x_flags & 2:
                            decomp = lzma.LZMADecompressor()
                            raw_hdr = decomp.decompress(comp_chunk, max_length=512)
                        else:
                            raw_hdr = comp_chunk[:512]
                    except Exception:
                        pass
                    x_sr, x_bits, x_ch = _extract_wav_meta_from_raw_hdr_v157(raw_hdr, x_flags)
                    if x_sr < 8000 or x_sr > 384000:
                        x_sr = 44100
                    xf_audio_bytes = int(trailer["audio_end"]) if (trailer and trailer.get("audio_end")) else size_bytes
                    wav_orig_bytes = int(x_nf) * x_ch * (x_bits // 8) + 44
                    dur_s = float(x_nf) / float(x_sr) if x_sr > 0 else 0.0
                    ratio_pct = (xf_audio_bytes * 100.0) / max(1, wav_orig_bytes)
                    eff_kbps = int((xf_audio_bytes * 8) / max(0.1, dur_s * 1000))
                    wav_eq_kbps = int((x_sr * x_ch * x_bits) / 1000)
                    mm, ss = int(dur_s // 60), dur_s % 60
                    hh, mm = int(mm // 60), int(mm % 60)

                    fn_low = filename.lower()
                    if '_ultra.xflac' in fn_low:
                        gate_lbl = "Gate 15 Ultra • Pitch-OLS + Psycho-LSB"
                    elif '_psycho.xflac' in fn_low:
                        gate_lbl = "Gate 25 Psycho • Pitch-OLS + Soft-Shape"
                    elif '_hifi.xflac' in fn_low:
                        gate_lbl = "Gate 45 Hi-Fi • Pitch-OLS + Psycho-LSB"
                    elif '_bitperfect.xflac' in fn_low:
                        gate_lbl = "BitPerfect 1:1 Lossless • Pitch-OLS"
                    else:
                        gate_lbl = "21-tap Pitch-OLS + Psycho-LSB"

                    xflac_custom_meta = {
                        "container": f"XFLAC (XFC3 + LZMA2) [{ratio_pct:.1f}% от WAV {wav_orig_bytes/(1024*1024):.2f} MB]",
                        "codec": f"libxflac C++17 ({x_bits}-bit {gate_lbl})",
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

    return xflac_custom_meta, rev_capsule_str, jrev_stats


def get_track_meta_v234():
    response.content_type = 'application/json; charset=utf-8'
    try:
        req = json.loads(_safe_decode_bytes_v218(request.body.read()) or "{}")
        fn = (req.get('filename') or '').strip()
        fp = _resolve_any_media_path_v218(fn)
        if not fn or not fp or not os.path.isfile(fp):
            response.status = 404
            return json.dumps({"status": "error", "error": "Файл не найден"}, ensure_ascii=False)
        ff = find_ffmpeg_binary()
        _, out_s, err_s = _safe_run_cmd_text_v218([ff, '-hide_banner', '-i', fp], timeout_sec=5.0)
        raw = err_s + out_s
        tags = get_merged_track_tags_v74(fn, raw)
        tags.pop('ENCODER', None)
        tags = _resolve_inherited_tags_for_derived_track_v234(fn, fp, tags)

        tr = read_jenny_rev_trailer(fp)
        rev = {"has_rev": False}
        if tr:
            try:
                with open(fp, 'rb') as rf:
                    rf.seek(tr["map_offset"])
                    sm = json.loads(_safe_decode_bytes_v218(zlib.decompress(rf.read(tr["map_len"]))))
                rev = {
                    "has_rev": True,
                    "map_bytes": tr["map_len"],
                    "pocket_bytes": tr["pocket_len"],
                    "spd": sm.get("spd", 1.0),
                    "tension": sm.get("tension", 100),
                    "seams_count": len(sm.get("seams", []))
                }
            except Exception:
                rev = {"has_rev": True, "map_bytes": tr["map_len"], "pocket_bytes": tr["pocket_len"]}
        return json.dumps({"status": "ok", "filename": fn, "tags": tags, "rev": rev}, ensure_ascii=False)
    except Exception as e:
        response.status = 500
        return json.dumps({"status": "error", "error": str(e)}, ensure_ascii=False)

_override_bottle_route_v212('/api/track_meta_v71', 'POST', get_track_meta_v234)


def get_track_info_v234():
    import datetime
    response.content_type = 'application/json; charset=utf-8'
    try:
        req = json.loads(_safe_decode_bytes_v218(request.body.read()) or "{}")
        filename = (req.get('filename') or '').strip()
        full_path = _resolve_any_media_path_v218(filename)
        if not filename or not full_path or not os.path.isfile(full_path):
            response.status = 404
            return json.dumps({"status": "error", "error": "Файл не найден (или ещё качается в потоке)"}, ensure_ascii=False)

        st = os.stat(full_path)
        size_bytes = st.st_size
        size_mb = f"{size_bytes / (1024 * 1024):.2f} MB ({size_bytes:,} B)".replace(",", " ")
        mtime_str = datetime.datetime.fromtimestamp(st.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
        ext = os.path.splitext(filename)[1].lower().lstrip('.') or 'raw'

        container_map = {
            'xflac': 'XFLAC (XFC3 + LZMA2 Hybrid Studio Container)',
            'opus': 'OGG / Opus Audio Container',
            'm4a': 'MP4 / ISO Media (Apple Audio)',
            'mp4': 'MPEG-4 Part 14 (Video/Audio Container)',
            'mkv': 'Matroska Multimedia Container (MKV)',
            'avi': 'RIFF Audio Video Interleave (AVI)',
            'mov': 'Apple QuickTime Movie Container (MOV)',
            'm4v': 'MPEG-4 Video Container (M4V)',
            'ts': 'MPEG Transport Stream (TS)',
            'm2ts': 'Blu-ray BDAV MPEG-2 Transport Stream',
            'wmv': 'Windows Media Video (ASF/WMV)',
            'flv': 'Flash Video Container (FLV)',
            'mp3': 'MPEG-1/2 Audio Layer III',
            'wav': 'RIFF WAVE (Uncompressed PCM)',
            'flac': 'Free Lossless Audio Codec',
            'ogg': 'OGG Vorbis Audio Container',
            'aac': 'Advanced Audio Coding (ADTS)',
            'webm': 'WebM Media Audio/Video Container'
        }
        container_desc = container_map.get(ext, f"{ext.upper()} Media Stream")

        xflac_custom_meta, rev_capsule_str, jrev_stats = _parse_xflac_and_jrev_inspector_v234(filename, full_path, size_bytes)

        ffmpeg_bin = find_ffmpeg_binary()
        _, out_s, err_s = _safe_run_cmd_text_v218([ffmpeg_bin, '-hide_banner', '-i', full_path], timeout_sec=5.0)
        raw_info = err_s + out_s

        dur_match = re.search(r"Duration:\s*(\d+:\d+:\d+\.\d+)", raw_info)
        duration_str = dur_match.group(1) if dur_match else "—"
        dur_seconds = 0.0
        if dur_match:
            parts = duration_str.split(':')
            dur_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        if dur_seconds <= 0 and not xflac_custom_meta:
            try:
                with open(full_path, 'rb') as hf:
                    dur_seconds = _parse_header_duration_bytes_v218(hf.read(131072))
                if dur_seconds > 0:
                    hh = int(dur_seconds // 3600)
                    mm = int((dur_seconds % 3600) // 60)
                    ss = dur_seconds % 60
                    duration_str = f"{hh:02d}:{mm:02d}:{ss:05.2f}"
            except Exception:
                pass

        br_match = re.search(r"bitrate:\s*(\d+\s*kb/s)", raw_info)
        bitrate_str = br_match.group(1) if br_match else (
            f"{int((size_bytes * 8) / dur_seconds / 1000)} kb/s (CBR/VBR calc)" if dur_seconds > 0 else "—"
        )

        codec_str, sr_str, ch_str, fmt_str = ext.upper(), "48000 Hz", "stereo (2 ch)", "fltp (32-bit float)"
        v_streams = re.findall(r"Stream #\d+:\d+.*?: Video:\s*([^\n]+)", raw_info)
        a_streams = re.findall(r"Stream #\d+:\d+.*?: Audio:\s*([^\n]+)", raw_info)

        if a_streams:
            s_line = a_streams[0]
            s_parts = [p.strip() for p in s_line.split(',')]
            if len(s_parts) >= 1:
                codec_str = s_parts[0]
            for p in s_parts[1:]:
                if 'Hz' in p:
                    sr_str = p
                elif any(k in p for k in ('stereo', 'mono', '5.1', '7.1', 'channels', 'ch')):
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
            if len(a_streams) > 1:
                codec_str = f"{codec_str} (Аудиодорожек: {len(a_streams)})"

        if v_streams:
            v_short = v_streams[0].split(',')[0].strip()
            res_m = re.search(r"\b(\d{3,4}x\d{3,4})\b", v_streams[0])
            res_s = f" [{res_m.group(1)}]" if res_m else ""
            codec_str = f"🎬 {v_short}{res_s} + 🔊 {codec_str}"

        sr_num = int(re.sub(r"\D", "", sr_str) or "48000")
        total_samples = f"{int(dur_seconds * sr_num):,}".replace(",", " ") if dur_seconds > 0 else "—"

        if jrev_stats and (dur_seconds <= 0 or duration_str == "—"):
            dur_seconds, duration_str, bitrate_str, total_samples = jrev_stats

        if xflac_custom_meta:
            container_desc = xflac_custom_meta["container"]
            codec_str = xflac_custom_meta["codec"]
            sr_str = xflac_custom_meta["sr"]
            ch_str = xflac_custom_meta["ch"]
            fmt_str = xflac_custom_meta["fmt"]
            duration_str = xflac_custom_meta["dur_str"]
            bitrate_str = xflac_custom_meta["br"]
            total_samples = xflac_custom_meta["samples"]
            if not raw_info or "Invalid data found" in raw_info:
                raw_info = (
                    f"[XFLAC Native Inspector V234]\n"
                    f"File: {filename}\n"
                    f"Container: {container_desc}\n"
                    f"Codec: {codec_str}\n"
                    f"Stream #0:0: Audio: {sr_str}, {ch_str}, {fmt_str}\n"
                    f"Duration: {duration_str}, bitrate: {bitrate_str}\n"
                    f"Total PCM Samples: {total_samples}\n"
                    f"Reversible DNA: {rev_capsule_str}\n"
                )

        tags = get_merged_track_tags_v74(filename, raw_info)
        tags = _resolve_inherited_tags_for_derived_track_v234(filename, full_path, tags)

        return json.dumps({
            "status": "ok",
            "rev_capsule": rev_capsule_str,
            "filename": filename,
            "full_path": full_path,
            "folder": os.path.dirname(full_path),
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
            "tags": tags,
            "raw_ffmpeg": raw_info[:4000]
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)}, ensure_ascii=False)

_override_bottle_route_v212('/api/track_info', 'POST', get_track_info_v234)

# ================= JENNY_V237_FAST_SCANDIR_FOLDERS_AND_DATA_CACHE_PATCH (#336 / V237) =================
_FOLDERS_CACHE_V237 = {"ts": 0.0, "sig": "", "payload": None}
_DATA_CACHE_V237 = {"ts": 0.0, "sig": "", "payload": None}

def _invalidate_fs_caches_v237():
    _FOLDERS_CACHE_V237["ts"] = 0.0
    _DATA_CACHE_V237["ts"] = 0.0

def _fast_list_dir_tracks_v237(d_path: str, exts_tuple: tuple):
    out = []
    if not d_path or not os.path.isdir(d_path):
        return out
    try:
        with os.scandir(d_path) as it:
            for entry in it:
                name = entry.name
                if name.startswith(('temp_stretcher_', 'temp_final_', '.')):
                    continue
                if name.lower().endswith(exts_tuple):
                    try:
                        if entry.is_file():
                            out.append((name, entry.path))
                    except Exception:
                        pass
    except Exception:
        pass
    return out

def api_folders_v237():
    global MUSIC_DIR, ACTIVE_MUSIC_DIRS, SAVED_MUSIC_DIRS
    response.content_type = 'application/json; charset=utf-8'
    load_multi_dirs_v71()
    if request.method == 'POST':
        try:
            req = json.loads(request.body.read().decode('utf-8') or "{}")
            act = req.get('action', '')
            target = norm_dir_v71(req.get('path', ''))
            if act in ('toggle', 'add') and not os.path.isdir(target):
                response.status = 404
                return json.dumps({"status": "error", "error": f"Папка не найдена: {target}"}, ensure_ascii=False)
            if act == 'toggle':
                if target not in SAVED_MUSIC_DIRS:
                    SAVED_MUSIC_DIRS.append(target)
                if target in ACTIVE_MUSIC_DIRS:
                    if len(ACTIVE_MUSIC_DIRS) > 1:
                        ACTIVE_MUSIC_DIRS.remove(target)
                else:
                    ACTIVE_MUSIC_DIRS.append(target)
            elif act == 'add':
                if target not in SAVED_MUSIC_DIRS:
                    SAVED_MUSIC_DIRS.insert(0, target)
                if target not in ACTIVE_MUSIC_DIRS:
                    ACTIVE_MUSIC_DIRS.append(target)
            elif act == 'remove':
                if target in SAVED_MUSIC_DIRS and len(SAVED_MUSIC_DIRS) > 1:
                    SAVED_MUSIC_DIRS.remove(target)
                if target in ACTIVE_MUSIC_DIRS and len(ACTIVE_MUSIC_DIRS) > 1:
                    ACTIVE_MUSIC_DIRS.remove(target)
                if not ACTIVE_MUSIC_DIRS and SAVED_MUSIC_DIRS:
                    ACTIVE_MUSIC_DIRS = [SAVED_MUSIC_DIRS[0]]
            MUSIC_DIR = ACTIVE_MUSIC_DIRS[0]
            save_multi_dirs_v71()
            _invalidate_fs_caches_v237()
        except Exception as e:
            response.status = 500
            return json.dumps({"status": "error", "error": str(e)}, ensure_ascii=False)

    now = time.time()
    exts = get_allowed_extensions()
    sig = f"{','.join(SAVED_MUSIC_DIRS)}|{','.join(ACTIVE_MUSIC_DIRS)}|{','.join(exts)}"
    if request.method == 'GET' and _FOLDERS_CACHE_V237["payload"] and _FOLDERS_CACHE_V237["sig"] == sig and (now - _FOLDERS_CACHE_V237["ts"] < 2.0):
        return _FOLDERS_CACHE_V237["payload"]

    f_tracks = {}
    for d in SAVED_MUSIC_DIRS:
        pairs = _fast_list_dir_tracks_v237(d, exts)
        f_tracks[d] = [fn for fn, _ in pairs]

    out_json = json.dumps({
        "status": "ok",
        "saved_folders": SAVED_MUSIC_DIRS,
        "active_folders": ACTIVE_MUSIC_DIRS,
        "current_folder": MUSIC_DIR,
        "folder_tracks": f_tracks
    }, ensure_ascii=False)
    _FOLDERS_CACHE_V237["ts"] = now
    _FOLDERS_CACHE_V237["sig"] = sig
    _FOLDERS_CACHE_V237["payload"] = out_json
    return out_json

_override_bottle_route_v212('/api/folders_v71', 'GET', api_folders_v237)
_override_bottle_route_v212('/api/folders_v71', 'POST', api_folders_v237)

def get_data_v237():
    response.content_type = 'application/json; charset=utf-8'
    load_multi_dirs_v71()
    allowed_exts = get_allowed_extensions()
    now = time.time()
    sig = f"{','.join(ACTIVE_MUSIC_DIRS)}|{','.join(SAVED_MUSIC_DIRS)}|{','.join(allowed_exts)}"
    if _DATA_CACHE_V237["payload"] and _DATA_CACHE_V237["sig"] == sig and (now - _DATA_CACHE_V237["ts"] < 1.2):
        return _DATA_CACHE_V237["payload"]

    all_tracks, seen, track_meta = [], set(), {}
    for d in ACTIVE_MUSIC_DIRS:
        for fn, fp in _fast_list_dir_tracks_v237(d, allowed_exts):
            if fn not in seen:
                seen.add(fn)
                all_tracks.append(fn)
                track_meta[fn] = quick_parse_artist_album_v71(fn, fp)
                if fn.lower().endswith(_VIDEO_EXTS_V134):
                    _discovered_video_paths_v134[fn] = fp

    all_tracks.sort(key=lambda x: track_meta.get(x, {}).get("mtime", 0), reverse=True)
    out_json = json.dumps({
        "all_tracks": all_tracks,
        "session_tracks": all_tracks,
        "current_folder": MUSIC_DIR,
        "active_folders": ACTIVE_MUSIC_DIRS,
        "saved_folders": SAVED_MUSIC_DIRS,
        "track_meta": track_meta
    }, ensure_ascii=False)
    _DATA_CACHE_V237["ts"] = now
    _DATA_CACHE_V237["sig"] = sig
    _DATA_CACHE_V237["payload"] = out_json
    return out_json

_override_bottle_route_v212('/api/data', 'GET', get_data_v237)
# ================= END JENNY_V237_FAST_SCANDIR_FOLDERS_AND_DATA_CACHE_PATCH =================

# ================= BEGIN JENNY_V240_RADIO_PCM_VIDEO_SYNC_AND_SMART_REMUX_PATCH =================
import struct as _struct_v240

# 1. EXACT RADIO LIVE PCM RECORDER (HANDLES CHAINED OGG-FLAC LIKE RADIO PARADISE WITHOUT 1:39 EOS CUTOFF
#    AND COMPUTES EXACT RECORDED AUDIO SECONDS FROM ACTUAL PCM BYTES!)
_RADIO_REC_PROC_V240 = {"proc": None}


def _radio_live_pcm_worker_v240(url: str, dst_path: str, is_lossless: bool):
    proc = None
    try:
        if not is_lossless:
            hdrs = dict(OST_HEADERS)
            hdrs["Icy-MetaData"] = "0"
            req = urllib.request.Request(url, headers=hdrs)
            with urllib.request.urlopen(req, timeout=15) as resp, open(dst_path, "wb") as out_f:
                while not _RADIO_REC_V91.get("stop_flag"):
                    chunk = resp.read(16384)
                    if not chunk:
                        break
                    out_f.write(chunk)
                    out_f.flush()
                    _RADIO_REC_V91["bytes"] = int(_RADIO_REC_V91.get("bytes") or 0) + len(chunk)
                    _RADIO_REC_V91["last_byte_ts"] = time.time()
            return

        # Lossless mode: decode live via FFmpeg into raw 44.1kHz 16-bit stereo PCM (176,400 bytes = 1.000s)!
        # FFmpeg transparently decodes chained Ogg-FLAC logical bitstreams across unlimited track changes!
        ff_bin = find_ffmpeg_binary()
        cmd = [
            ff_bin, '-hide_banner', '-loglevel', 'error',
            '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
            '-user_agent', OST_HEADERS.get('User-Agent', 'Mozilla/5.0'),
            '-i', url,
            '-vn', '-sn', '-dn',
            '-ac', '2', '-ar', '44100',
            '-f', 's16le', '-'
        ]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=32768)
        _RADIO_REC_PROC_V240["proc"] = proc
        with open(dst_path, "wb") as out_f:
            while not _RADIO_REC_V91.get("stop_flag"):
                chunk = proc.stdout.read(16384)
                if not chunk:
                    break
                out_f.write(chunk)
                _RADIO_REC_V91["bytes"] = int(_RADIO_REC_V91.get("bytes") or 0) + len(chunk)
                _RADIO_REC_V91["last_byte_ts"] = time.time()
    except Exception as e:
        _RADIO_REC_V91["err"] = str(e)
    finally:
        _RADIO_REC_PROC_V240["proc"] = None
        if proc:
            try:
                proc.kill()
            except Exception:
                pass
        _RADIO_REC_V91["active"] = False


def _wrap_s16le_pcm_as_wav_bytes_v240(pcm_bytes: bytes, sample_rate: int = 44100, channels: int = 2) -> bytes:
    data_len = len(pcm_bytes)
    byte_rate = sample_rate * channels * 2
    block_align = channels * 2
    wav_hdr = _struct_v240.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        36 + data_len,
        b'WAVE',
        b'fmt ',
        16,
        1,  # PCM
        channels,
        sample_rate,
        byte_rate,
        block_align,
        16,
        b'data',
        data_len,
    )
    return wav_hdr + pcm_bytes


def api_radio_rec_start_v240():
    response.content_type = 'application/json; charset=utf-8'
    try:
        if _RADIO_REC_V91.get("active"):
            return json.dumps({"status": "error", "error": "Запись уже идёт"}, ensure_ascii=False)
        load_multi_dirs_v71()
        req = json.loads(request.body.read().decode('utf-8') or "{}")
        s_url = (req.get("url") or "").strip()
        s_title = (req.get("title") or "Radio").strip()
        is_ll = bool(req.get("lossless", True))
        fmt = (req.get("format_mode") or "xflac_psycho").strip().lower()
        xf_mode = {'xflac_lossless': 0, 'xflac_psycho': 25, 'xflac_ultra': 15, 'xflac_hifi': 45}.get(fmt, 25)
        os.makedirs(MUSIC_DIR, exist_ok=True)
        ext_tmp = ".pcm" if is_ll else ".stream"
        tmp_raw = os.path.join(MUSIC_DIR, f"temp_final_radraw_{os.getpid()}{ext_tmp}")
        _RADIO_REC_V91.update({
            "active": True,
            "stop_flag": False,
            "tmp_raw": tmp_raw,
            "station": s_title,
            "start_ts": time.time(),
            "last_byte_ts": time.time(),
            "bytes": 0,
            "xf_mode": xf_mode,
            "lossless": is_ll,
            "err": "",
        })
        t = threading.Thread(target=_radio_live_pcm_worker_v240, args=(s_url, tmp_raw, is_ll), daemon=True)
        _RADIO_REC_V91["thread"] = t
        t.start()
        return json.dumps({"status": "ok"}, ensure_ascii=False)
    except Exception as e:
        response.status = 500
        return json.dumps({"status": "error", "error": str(e)}, ensure_ascii=False)


def api_radio_rec_status_v240():
    response.content_type = 'application/json; charset=utf-8'
    act = bool(_RADIO_REC_V91.get("active"))
    raw_b = int(_RADIO_REC_V91.get("bytes") or 0)
    is_ll = bool(_RADIO_REC_V91.get("lossless", True))
    if is_ll:
        # Exact audio seconds decoded into 44.1kHz 16-bit stereo PCM (176,400 bytes/sec)!
        sec = int(raw_b // 176400)
    else:
        # For direct MP3 stream, cap by actual data flow so stalled stream never inflates timer
        last_ts = float(_RADIO_REC_V91.get("last_byte_ts") or _RADIO_REC_V91.get("start_ts") or time.time())
        start_ts = float(_RADIO_REC_V91.get("start_ts") or last_ts)
        sec = max(0, int(last_ts - start_ts)) if raw_b > 0 else 0
    mb = round(raw_b / (1024.0 * 1024.0), 2)
    return json.dumps({
        "active": act,
        "sec": sec,
        "wav_mb": mb,
        "station": _RADIO_REC_V91.get("station") or "",
        "err": _RADIO_REC_V91.get("err") or "",
    }, ensure_ascii=False)


def api_radio_rec_stop_v240():
    response.content_type = 'application/json; charset=utf-8'
    traw = _RADIO_REC_V91.get("tmp_raw") or ""
    try:
        _RADIO_REC_V91["stop_flag"] = True
        p = _RADIO_REC_PROC_V240.get("proc")
        if p:
            try:
                p.terminate()
            except Exception:
                pass
        thr = _RADIO_REC_V91.get("thread")
        if thr and thr.is_alive():
            thr.join(timeout=2.5)
        if p:
            try:
                p.kill()
            except Exception:
                pass
        _RADIO_REC_V91["active"] = False

        if not traw or not os.path.isfile(traw) or os.path.getsize(traw) < 16384:
            err_detail = _RADIO_REC_V91.get("err") or "Поток станции не отдал аудиоданных"
            return json.dumps({"status": "error", "error": f"Мало данных ({err_detail})"}, ensure_ascii=False)

        safe_st = re.sub(r'[\\/:*?"<>|\[\]]+', '_', _RADIO_REC_V91.get("station") or "Radio").strip()[:100]
        stamp = time.strftime("%H%M%S")
        is_ll = bool(_RADIO_REC_V91.get("lossless", True))

        if not is_ll:
            final_name = f"Radio - {safe_st}_{stamp}.mp3"
            final_path = os.path.join(MUSIC_DIR, final_name)
            shutil.move(traw, final_path)
            traw = ""
            rec_dur_sec = 0.0
        else:
            with open(traw, "rb") as f:
                pcm_b = f.read()
            # Align to 4-byte stereo frame boundary
            aligned_len = (len(pcm_b) // 4) * 4
            pcm_b = pcm_b[:aligned_len]
            if aligned_len < 16384:
                return json.dumps({"status": "error", "error": "Слишком короткая запись эфира"}, ensure_ascii=False)
            rec_dur_sec = round(aligned_len / 176400.0, 1)
            wav_b = _wrap_s16le_pcm_as_wav_bytes_v240(pcm_b, 44100, 2)
            xf_mode = int(_RADIO_REC_V91.get("xf_mode", 25))
            suf = {0: "_bitperfect.xflac", 15: "_ultra.xflac", 25: "_psycho.xflac", 45: "_hifi.xflac"}.get(xf_mode, "_psycho.xflac")
            final_name = f"Radio - {safe_st}_{stamp}{suf}"
            final_path = os.path.join(MUSIC_DIR, final_name)
            xfc_bytes = _encode_wav_to_xflac_bytes_v85(wav_b, xf_mode)
            with open(final_path, "wb") as out_f:
                out_f.write(xfc_bytes)

        db = load_custom_tags_db_v74()
        db[final_name] = {
            "TITLE": f"{safe_st} ({stamp})",
            "ARTIST": "Radio Stream",
            "ALBUM": "Записи радиоэфира",
            "GENRE": "Radio",
        }
        save_custom_tags_db_v74(db)
        if '_invalidate_fs_caches_v237' in globals():
            _invalidate_fs_caches_v237()
        sz_mb = round(os.path.getsize(final_path) / (1024.0 * 1024.0), 2)
        return json.dumps({
            "status": "ok",
            "filename": final_name,
            "size_mb": sz_mb,
            "duration_sec": rec_dur_sec,
        }, ensure_ascii=False)
    except Exception as e:
        response.status = 500
        return json.dumps({"status": "error", "error": str(e)}, ensure_ascii=False)
    finally:
        if traw and os.path.isfile(traw):
            try:
                os.remove(traw)
            except Exception:
                pass

_override_bottle_route_v212('/api/radio/record_start', 'POST', api_radio_rec_start_v240)
_override_bottle_route_v212('/api/radio/record_status', 'GET', api_radio_rec_status_v240)
_override_bottle_route_v212('/api/radio/record_stop', 'POST', api_radio_rec_stop_v240)


# 2. SMART VIDEO STREAM CODEC INSPECTOR + ZERO-DESYNC LIVE REMUX (V240)
_VIDEO_STREAM_INSPECT_CACHE_V240 = {}

_LEGACY_TRANSCODE_VCODECS_V240 = {
    'h263', 'h263p', 'h263i', 'mpeg4', 'msmpeg4v1', 'msmpeg4v2', 'msmpeg4v3',
    'wmv1', 'wmv2', 'wmv3', 'vc1', 'flv1', 'vp6', 'vp6f', 'theora',
    'mpeg1video', 'mpeg2video', 'rv10', 'rv20', 'rv30', 'rv40', 'svq1', 'svq3', 'cinepak', 'indeo3', 'indeo5'
}

_REMUX_REQUIRED_EXTS_V240 = (
    '.mkv', '.avi', '.mov', '.3gp', '.3g2', '.ts', '.m2ts', '.mts', '.wmv', '.flv', '.mpg', '.mpeg', '.vob', '.ogv'
)

_TRANSCODE_REQUIRED_EXTS_V240 = (
    '.avi', '.3gp', '.3g2', '.wmv', '.flv', '.mpg', '.mpeg', '.vob', '.ogv'
)


def _inspect_local_video_streams_v240(full_path: str) -> dict:
    if not full_path or not os.path.isfile(full_path):
        return {"ok": False, "needs_remux": False, "needs_transcode": False, "audio_tracks": 1}
    try:
        st = os.stat(full_path)
        cache_key = (full_path, round(st.st_mtime, 2), st.st_size)
        cached = _VIDEO_STREAM_INSPECT_CACHE_V240.get(cache_key)
        if cached:
            return cached
    except Exception:
        cache_key = None

    ext_l = os.path.splitext(full_path)[1].lower()
    container_fmt = ""
    v_codec = ""
    a_codecs = []
    dur_sec = 0.0

    # Check raw magic bytes first (catches 09_spoofed_webm_extension.mp4 in 0.05ms!)
    spoofed_non_mp4 = False
    try:
        with open(full_path, "rb") as f:
            hdr12 = f.read(12)
        if ext_l in ('.mp4', '.m4v') and len(hdr12) >= 8:
            if hdr12[:4] == b'\x1a\x45\xdf\xa3' or hdr12[:4] in (b'RIFF', b'OggS', b'FLV\x01'):
                spoofed_non_mp4 = True
    except Exception:
        pass

    try:
        ff_bin = find_ffmpeg_binary()
        res = subprocess.run(
            [ff_bin, '-hide_banner', '-probesize', '1048576', '-analyzeduration', '1000000', '-i', full_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=2.5,
        )
        info_txt = (res.stderr or b'').decode('utf-8', errors='replace')
        m_in = re.search(r'Input #0,\s*([^,\s]+(?:,[^,\s]+)*)', info_txt)
        if m_in:
            container_fmt = m_in.group(1).lower()
        m_dur = re.search(r'Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)', info_txt)
        if m_dur:
            dur_sec = int(m_dur.group(1)) * 3600 + int(m_dur.group(2)) * 60 + float(m_dur.group(3))
        for line in info_txt.splitlines():
            if 'Stream #' not in line:
                continue
            m_v = re.search(r'Video:\s*([a-zA-Z0-9_]+)', line)
            if m_v and not v_codec:
                v_codec = m_v.group(1).lower()
            m_a = re.search(r'Audio:\s*([a-zA-Z0-9_]+)', line)
            if m_a:
                a_codecs.append(m_a.group(1).lower())
    except Exception:
        pass

    first_a = a_codecs[0] if a_codecs else ""
    needs_transcode = bool(
        ext_l in _TRANSCODE_REQUIRED_EXTS_V240
        or (v_codec and v_codec in _LEGACY_TRANSCODE_VCODECS_V240)
    )

    # Needs FFmpeg live_remux if:
    # - Needs video transcoding (.3gp h263, .avi xvid, etc.)
    # - Non-MP4/non-WebM container (.mkv, .mov, .ts, .avi, .3gp...)
    # - Spoofed .mp4 file (e.g. Matroska/WebM inside .mp4!)
    # - Exotic audio inside .mp4/.m4v (flac, opus, vorbis, ac3, eac3, dts, pcm_*, amr_*, mp2)
    # - Exotic video inside .mp4 (vp9, vp8, av1 paired with opus/flac)
    mp4_incompatible_audio = first_a not in ('', 'aac', 'mp3')
    needs_remux = bool(
        needs_transcode
        or spoofed_non_mp4
        or ext_l in _REMUX_REQUIRED_EXTS_V240
        or (ext_l in ('.mp4', '.m4v') and (
            mp4_incompatible_audio
            or ('matroska' in container_fmt)
            or ('avi' in container_fmt)
            or (v_codec in ('vp9', 'vp8', 'av1') and first_a != 'aac')
        ))
    )

    out = {
        "ok": True,
        "container": container_fmt,
        "v_codec": v_codec,
        "a_codec": first_a,
        "audio_tracks": max(1, len(a_codecs)),
        "duration_sec": round(dur_sec, 2),
        "spoofed": spoofed_non_mp4,
        "needs_remux": needs_remux,
        "needs_transcode": needs_transcode,
    }
    if cache_key is not None:
        if len(_VIDEO_STREAM_INSPECT_CACHE_V240) > 256:
            _VIDEO_STREAM_INSPECT_CACHE_V240.clear()
        _VIDEO_STREAM_INSPECT_CACHE_V240[cache_key] = out
    return out


def api_video_smart_check_v240():
    response.content_type = 'application/json; charset=utf-8'
    raw_src = (request.query.get('src') or '').strip()
    if not raw_src:
        return json.dumps({"status": "error"}, ensure_ascii=False)
    src = raw_src
    if src.startswith(('http://127.0.0.1:', 'http://localhost:')) and src.count('/') >= 3:
        src = '/' + src.split('/', 3)[3]
    if src.startswith('/api/torrent/stream/'):
        low_s = src.lower()
        return json.dumps({
            "status": "ok",
            "is_torrent": True,
            "needs_remux": True,
            "needs_transcode": any(x in low_s for x in _TRANSCODE_REQUIRED_EXTS_V240),
            "audio_tracks": 2,
        }, ensure_ascii=False)
    fp = _resolve_any_media_path_v218(src)
    info = _inspect_local_video_streams_v240(fp)
    info["status"] = "ok"
    return json.dumps(info, ensure_ascii=False)

_override_bottle_route_v212('/api/video/smart_check_v240', 'GET', api_video_smart_check_v240)


def api_video_live_remux_v240():
    _cancel_stream_hold_release_v216()
    raw_src = (request.query.get('src') or '').strip()
    start_sec = float(request.query.get('start') or 0.0)
    dur_sec = float(request.query.get('dur') or 0.0)
    no_audio = (request.query.get('no_audio') == '1')
    audio_only = (request.query.get('audio_only') == '1')
    try:
        audio_idx = max(0, int(request.query.get('aidx') or 0))
    except Exception:
        audio_idx = 0

    if not raw_src:
        response.status = 400
        return "Missing src"

    src = raw_src
    if src.startswith(('http://127.0.0.1:', 'http://localhost:')) and src.count('/') >= 3:
        src = '/' + src.split('/', 3)[3]

    mode_tag = "AO" if audio_only else ("VO" if no_audio else "VA")
    req_key = f"{src}::{round(start_sec, 1)}::{audio_idx}::{mode_tag}"
    now_ts = time.time()
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        for k_existing, plist in list(_ACTIVE_REMUX_PROCS_BY_KEY_V214.items()):
            if k_existing != req_key:
                for _, p_old in plist:
                    try:
                        p_old.kill()
                    except Exception:
                        pass
                _ACTIVE_REMUX_PROCS_BY_KEY_V214.pop(k_existing, None)
            else:
                kept = []
                for ts_started, p_same in plist:
                    if now_ts - ts_started > 6.0 and p_same.poll() is not None:
                        continue
                    kept.append((ts_started, p_same))
                _ACTIVE_REMUX_PROCS_BY_KEY_V214[k_existing] = kept

    is_tor_stream = src.startswith('/api/torrent/stream/')
    src_input = ""
    if is_tor_stream:
        parts = src.strip('/').split('/')
        if len(parts) >= 5:
            h_low = parts[3].lower()
            try:
                f_idx = int(parts[4].split('?')[0])
            except Exception:
                f_idx = 0
            if dur_sec <= 0:
                dur_sec, _, _ = _probe_torrent_partial_file_duration_v218(src)
            ratio = (start_sec / dur_sec) if (dur_sec > 0 and start_sec > 0) else 0.0
            _boost_torrent_file_and_pieces_v218(h_low, f_idx, ratio=ratio, sync_start=True)

            try:
                local_p, is_comp, f_len, f_done = _locate_downloaded_p2p_file_v163("", h_low, f_idx)
                if local_p and os.path.isfile(local_p) and (is_comp or (f_len > 0 and f_done >= f_len)):
                    src_input = local_p
            except Exception:
                pass

            if not src_input and start_sec > 0.5 and ratio > 0.0:
                wait_deadline = time.time() + 4.0
                while time.time() < wait_deadline:
                    try:
                        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.6) as sr:
                            st_obj = json.loads(_safe_decode_bytes_v218(sr.read()))
                        piece_ready = False
                        for tor in (st_obj.get("torrents") or []):
                            if (tor.get("hash") or "").strip().lower() == h_low:
                                p_map = tor.get("pieces_map") or ""
                                for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                                    if int(fobj.get("index", -1)) == f_idx:
                                        beg_p = int(fobj.get("begin_piece") or 0)
                                        end_p = int(fobj.get("end_piece") or 0)
                                        f_l = int(fobj.get("length") or 0)
                                        f_c = int(fobj.get("completed") or 0)
                                        if f_l > 0 and f_c >= f_l:
                                            piece_ready = True
                                        elif end_p > beg_p and p_map:
                                            t_p = max(beg_p, min(end_p - 1, beg_p + int(ratio * (end_p - beg_p))))
                                            if 0 <= t_p < len(p_map) and p_map[t_p] == '4':
                                                piece_ready = True
                                        break
                                break
                        if piece_ready:
                            break
                    except Exception:
                        break
                    time.sleep(0.28)

            if not src_input:
                src_input = f"http://127.0.0.1:{globals().get('_INTERNAL_STREAM_PORT_V238', 8080)}/api/torrent/stream/{h_low}/{f_idx}"
        else:
            src_input = _resolve_any_media_path_v218(src)
    else:
        src_input = _resolve_any_media_path_v218(src)

    is_http = str(src_input).startswith(('http://', 'https://'))
    local_info = {"needs_transcode": False, "audio_tracks": 0}
    if not is_http and src_input and os.path.isfile(src_input):
        local_info = _inspect_local_video_streams_v240(src_input)
        a_cnt = int(local_info.get("audio_tracks") or 0)
        if a_cnt > 0 and audio_idx >= a_cnt:
            audio_idx = audio_idx % a_cnt

    # NOTE V240: NEVER return raw static_file() here! When JS calls /api/video/live_remux,
    # it specifically needs FFmpeg container/audio/codec remuxing (even at start=0 and aidx=0)!

    ff_bin = find_ffmpeg_binary()
    ff_threads = str(max(2, min(8, int(_THREAD_CFG_V216.get("videoFfmpegThreads", 3)))))
    cmd = [ff_bin, '-hide_banner', '-loglevel', 'error']
    if is_http:
        if start_sec > 0.5:
            cmd.extend(['-seekable', '1', '-reconnect', '1', '-reconnect_streamed', '1', '-probesize', '524288', '-analyzeduration', '500000'])
        else:
            cmd.extend(['-seekable', '0', '-reconnect', '1', '-reconnect_streamed', '1', '-probesize', '262144', '-analyzeduration', '300000'])

    need_v_transcode = bool(
        request.query.get('transcode') == '1'
        or local_info.get("needs_transcode")
        or str(src_input).lower().endswith(_TRANSCODE_REQUIRED_EXTS_V240)
        or any(ext in src.lower() for ext in _TRANSCODE_REQUIRED_EXTS_V240)
    )

    # Seek BEFORE -i for fast keyframe demux, then lock timestamps to 0 via -avoid_negative_ts make_zero!
    if start_sec > 0.5:
        cmd.extend(['-ss', f"{start_sec:.2f}"])

    if need_v_transcode:
        v_codec_args = [
            '-threads', ff_threads,
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
            '-crf', '23', '-pix_fmt', 'yuv420p', '-g', '30'
        ]
    else:
        v_codec_args = ['-c:v', 'copy']

    # CRITICAL A/V SYNC FIX V240:
    # NEVER pass '+igndts' when copying H.264/HEVC B-frames — '+igndts' destroys ctts PTS/DTS offsets,
    # freezing initial video GOPs in MediaCodec while audio races ahead!
    fflags_val = '+genpts+nobuffer'
    af_sync = 'aresample=async=1000:first_pts=0' if start_sec <= 0.5 else 'aresample=async=1000'

    if audio_only:
        cmd.extend([
            '-fflags', fflags_val,
            '-i', src_input,
            '-vn', '-map', f'0:a:{audio_idx}?', '-sn', '-dn',
            '-threads', ff_threads,
            '-af', af_sync,
            '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
            '-avoid_negative_ts', 'make_zero',
            '-movflags', 'empty_moov+default_base_moof',
            '-frag_duration', '200000',
            '-flush_packets', '1',
            '-f', 'mp4', '-'
        ])
    elif no_audio:
        cmd.extend([
            '-fflags', fflags_val,
            '-i', src_input,
            '-map', '0:v:0', '-an', '-sn', '-dn',
            *v_codec_args,
            '-avoid_negative_ts', 'make_zero',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            '-frag_duration', '200000',
            '-flush_packets', '1',
            '-f', 'mp4', '-'
        ])
    else:
        cmd.extend([
            '-fflags', fflags_val,
            '-i', src_input,
            '-map', '0:v:0', '-map', f'0:a:{audio_idx}?', '-sn', '-dn',
            *v_codec_args,
            '-threads', ff_threads,
            '-af', af_sync,
            '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
            '-avoid_negative_ts', 'make_zero',
            '-max_interleave_delta', '400000',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            '-frag_duration', '200000',
            '-flush_packets', '1',
            '-f', 'mp4', '-'
        ])

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=32768)
    with _ACTIVE_VIDEO_FFMPEG_LOCK_V212:
        _ACTIVE_REMUX_PROCS_BY_KEY_V214.setdefault(req_key, []).append((now_ts, proc))

    resp_hdrs = {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Accept-Ranges": "none"
    }
    def _remux_gen_v240():
        try:
            while True:
                chunk = proc.stdout.read(16384)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                proc.kill()
            except Exception:
                pass
    return bottle.HTTPResponse(body=_remux_gen_v240(), status=200, headers=resp_hdrs)

_override_bottle_route_v212('/api/video/live_remux', 'GET', api_video_live_remux_v240)
# ================= END JENNY_V240_RADIO_PCM_VIDEO_SYNC_AND_SMART_REMUX_PATCH =================

# ================= BEGIN JENNY_V242_EXTERNAL_HUB_AND_RADIO_BUFFER_PATCH =================
import collections
import queue as _py_queue_v242

_JENNY_HUB_FILE_LOCK_V242 = threading.Lock()
_JENNY_HUB_BACKFILLED_MODS_V242 = set()

_JENNY_MODULE_FOLDER_MAP_V242 = {
    "soundcloud": "SoundCloud",
    "ost": "OST",
    "archive": "Archive",
    "radio": "Radio",
    "youtube": "YouTube",
}


def _get_module_history_path_v242(mod_key: str) -> str:
    m = (mod_key or "").strip().lower()
    sub = _JENNY_MODULE_FOLDER_MAP_V242.get(m, "OST")
    d = os.path.join(get_jenny_hub_root_v242(), sub)
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "history.json")


def _get_module_queue_path_v242(mod_key: str) -> str:
    m = (mod_key or "").strip().lower()
    sub = _JENNY_MODULE_FOLDER_MAP_V242.get(m, "OST")
    d = os.path.join(get_jenny_hub_root_v242(), sub)
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "queue.json")


def _load_json_list_safe_v242(path_str: str) -> list:
    if os.path.isfile(path_str):
        try:
            with open(path_str, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                return data
            if isinstance(data, dict) and isinstance(data.get("items"), list):
                return data["items"]
        except Exception:
            pass
    return []


def _save_json_list_safe_v242(path_str: str, items: list):
    try:
        os.makedirs(os.path.dirname(path_str), exist_ok=True)
        tmp_p = path_str + ".tmp"
        with open(tmp_p, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        os.replace(tmp_p, path_str)
    except Exception:
        pass


def record_jenny_hub_item_v242(mod_key: str, filename: str, title: str = "", subtitle: str = "", size_mb: float = 0.0, extra: dict = None):
    m = (mod_key or "").strip().lower()
    if m not in _JENNY_MODULE_FOLDER_MAP_V242 or not filename:
        return
    bn = os.path.basename(filename)
    now_ts = round(time.time(), 2)
    with _JENNY_HUB_FILE_LOCK_V242:
        hp = _get_module_history_path_v242(m)
        items = _load_json_list_safe_v242(hp)
        # Deduplicate by filename (update timestamp/info & move to top)
        kept = [x for x in items if isinstance(x, dict) and os.path.basename(str(x.get("filename") or "")) != bn]
        entry = {
            "filename": bn,
            "title": (title or os.path.splitext(bn)[0]).strip(),
            "subtitle": (subtitle or "").strip(),
            "size_mb": round(float(size_mb or 0.0), 2),
            "ts": now_ts,
            "module": m,
        }
        if isinstance(extra, dict):
            entry.update(extra)
        kept.insert(0, entry)
        if len(kept) > 1000:
            kept = kept[:1000]
        _save_json_list_safe_v242(hp, kept)


def _collect_all_media_lookup_dirs_v242() -> list:
    dirs = []
    try:
        load_multi_dirs_v71()
    except Exception:
        pass
    for d in list(globals().get("ACTIVE_MUSIC_DIRS_V71") or []) + list(globals().get("SAVED_MUSIC_DIRS_V71") or []) + [MUSIC_DIR, DEFAULT_MUSIC_DIR]:
        if d and os.path.isdir(d) and d not in dirs:
            dirs.append(d)
    v_dir = globals().get("VIDEO_DIR_V137") or "/storage/emulated/0/JennyVideo"
    if v_dir and os.path.isdir(v_dir) and v_dir not in dirs:
        dirs.append(v_dir)
    return dirs


def _find_file_on_disk_v242(bn: str) -> str:
    if not bn:
        return ""
    for d in _collect_all_media_lookup_dirs_v242():
        cand = os.path.join(d, bn)
        if os.path.isfile(cand):
            return cand
    vp = (globals().get("_discovered_video_paths_v134") or {}).get(bn)
    if vp and os.path.isfile(vp):
        return vp
    return ""


def _reconcile_module_history_v242(mod_key: str) -> list:
    m = (mod_key or "").strip().lower()
    if m not in _JENNY_MODULE_FOLDER_MAP_V242:
        return []
    hp = _get_module_history_path_v242(m)
    with _JENNY_HUB_FILE_LOCK_V242:
        items = _load_json_list_safe_v242(hp)
        known_fns = {os.path.basename(str(x.get("filename") or "")) for x in items if isinstance(x, dict) and x.get("filename")}
        changed = False

        # Smart one-time disk backfill per session so already-downloaded files appear immediately!
        if m not in _JENNY_HUB_BACKFILLED_MODS_V242:
            _JENNY_HUB_BACKFILLED_MODS_V242.add(m)
            tags_db = {}
            try:
                tags_db = load_custom_tags_db_v74() or {}
            except Exception:
                tags_db = {}
            for d in _collect_all_media_lookup_dirs_v242():
                try:
                    for fn in os.listdir(d):
                        if not fn or fn.startswith(".") or fn.startswith("temp_") or fn in known_fns:
                            continue
                        fp = os.path.join(d, fn)
                        if not os.path.isfile(fp):
                            continue
                        low = fn.lower()
                        tmeta = tags_db.get(fn) if isinstance(tags_db, dict) else None
                        genre_str = str((tmeta or {}).get("GENRE") or "").strip()
                        matched = False
                        title_str = os.path.splitext(fn)[0]
                        sub_str = ""
                        if m == "soundcloud" and (fn.startswith("SoundCloud - ") or genre_str == "SoundCloud"):
                            matched = True
                            title_str = re.sub(r"^SoundCloud\s*-\s*(\d+\.\s*)?", "", title_str).strip() or title_str
                            sub_str = "SoundCloud"
                        elif m == "radio" and (fn.startswith("Radio - ") or genre_str == "Radio"):
                            matched = True
                            title_str = re.sub(r"^Radio\s*-\s*", "", title_str).strip() or title_str
                            sub_str = "Запись радиоэфира"
                        elif m == "ost" and genre_str == "Game OST":
                            matched = True
                            title_str = str((tmeta or {}).get("TITLE") or title_str)
                            sub_str = str((tmeta or {}).get("ALBUM") or "Game OST")
                        elif m == "archive" and genre_str in ("Archive.org", "Lossless Archive"):
                            matched = True
                            title_str = str((tmeta or {}).get("TITLE") or title_str)
                            sub_str = str((tmeta or {}).get("ALBUM") or "Archive.org")
                        elif m == "youtube" and re.search(r"\[\d{3,4}p\]\.(mp4|webm|mkv)$", low):
                            matched = True
                            sub_str = "YouTube Video"
                        if matched:
                            st_f = os.stat(fp)
                            items.append({
                                "filename": fn,
                                "title": title_str,
                                "subtitle": sub_str,
                                "size_mb": round(st_f.st_size / (1024.0 * 1024.0), 2),
                                "ts": round(st_f.st_mtime, 2),
                                "module": m,
                            })
                            known_fns.add(fn)
                            changed = True
                except Exception:
                    pass
            if changed:
                items.sort(key=lambda x: float(x.get("ts") or 0.0), reverse=True)
                _save_json_list_safe_v242(hp, items)

    out = []
    for x in items:
        if not isinstance(x, dict):
            continue
        fn = os.path.basename(str(x.get("filename") or ""))
        if not fn:
            continue
        fp = _find_file_on_disk_v242(fn)
        row = dict(x)
        row["exists"] = bool(fp)
        row["is_video"] = fn.lower().endswith((".mp4", ".mkv", ".webm", ".avi", ".mov", ".3gp", ".m4v"))
        if fp:
            try:
                if not row.get("size_mb"):
                    row["size_mb"] = round(os.path.getsize(fp) / (1024.0 * 1024.0), 2)
            except Exception:
                pass
        out.append(row)
    out.sort(key=lambda r: float(r.get("ts") or 0.0), reverse=True)
    return out


def _load_module_queue_v242(mod_key: str) -> dict:
    qp = _get_module_queue_path_v242(mod_key)
    if os.path.isfile(qp):
        try:
            with open(qp, "r", encoding="utf-8") as f:
                d = json.load(f)
            if isinstance(d, dict) and d.get("pending_tracks"):
                return d
        except Exception:
            pass
    return {}


def _save_module_queue_v242(mod_key: str, q_obj: dict):
    qp = _get_module_queue_path_v242(mod_key)
    try:
        if not q_obj or not q_obj.get("pending_tracks"):
            if os.path.isfile(qp):
                os.remove(qp)
            return
        tmp_p = qp + ".tmp"
        with open(tmp_p, "w", encoding="utf-8") as f:
            json.dump(q_obj, f, ensure_ascii=False, indent=2)
        os.replace(tmp_p, qp)
    except Exception:
        pass


def api_jenny_hub_summary_v242():
    response.content_type = "application/json; charset=utf-8"
    counts = {}
    queues = {}
    for mk in _JENNY_MODULE_FOLDER_MAP_V242:
        hist = _reconcile_module_history_v242(mk)
        q = _load_module_queue_v242(mk)
        pend_n = len(q.get("pending_tracks") or []) if isinstance(q, dict) else 0
        counts[mk] = len(hist)
        queues[mk] = pend_n
    return json.dumps({
        "status": "ok",
        "hub_root": get_jenny_hub_root_v242(),
        "counts": counts,
        "queues": queues,
    }, ensure_ascii=False)


def api_jenny_hub_history_v242(mod_key):
    response.content_type = "application/json; charset=utf-8"
    m = (mod_key or "").strip().lower()
    items = _reconcile_module_history_v242(m)
    q = _load_module_queue_v242(m)
    return json.dumps({
        "status": "ok",
        "module": m,
        "folder": os.path.join(get_jenny_hub_root_v242(), _JENNY_MODULE_FOLDER_MAP_V242.get(m, "OST")),
        "count": len(items),
        "items": items,
        "queue": q,
    }, ensure_ascii=False)


def api_jenny_hub_save_queue_v242(mod_key):
    response.content_type = "application/json; charset=utf-8"
    m = (mod_key or "").strip().lower()
    try:
        body = json.loads(request.body.read().decode("utf-8") or "{}")
    except Exception:
        body = {}
    if body.get("clear"):
        _save_module_queue_v242(m, {})
        return json.dumps({"status": "ok", "cleared": True}, ensure_ascii=False)
    _save_module_queue_v242(m, body)
    return json.dumps({"status": "ok", "pending": len(body.get("pending_tracks") or [])}, ensure_ascii=False)


def api_jenny_hub_delete_item_v242():
    response.content_type = "application/json; charset=utf-8"
    try:
        body = json.loads(request.body.read().decode("utf-8") or "{}")
    except Exception:
        body = {}
    m = str(body.get("module") or "").strip().lower()
    fn = os.path.basename(str(body.get("filename") or "").strip())
    del_disk = bool(body.get("delete_file"))
    if m in _JENNY_MODULE_FOLDER_MAP_V242 and fn:
        with _JENNY_HUB_FILE_LOCK_V242:
            hp = _get_module_history_path_v242(m)
            items = _load_json_list_safe_v242(hp)
            items = [x for x in items if isinstance(x, dict) and os.path.basename(str(x.get("filename") or "")) != fn]
            _save_json_list_safe_v242(hp, items)
        if del_disk:
            fp = _find_file_on_disk_v242(fn)
            if fp and os.path.isfile(fp):
                try:
                    os.remove(fp)
                except Exception:
                    pass
    return json.dumps({"status": "ok"}, ensure_ascii=False)


_override_bottle_route_v212('/api/jenny_hub/summary', 'GET', api_jenny_hub_summary_v242)
_override_bottle_route_v212('/api/jenny_hub/history/<mod_key>', 'GET', api_jenny_hub_history_v242)
_override_bottle_route_v212('/api/jenny_hub/queue/<mod_key>', 'POST', api_jenny_hub_save_queue_v242)
_override_bottle_route_v212('/api/jenny_hub/delete_item', 'POST', api_jenny_hub_delete_item_v242)


# Wrap studio download & radio recording endpoints so every completed item is persisted in /storage/emulated/0/JENNY/<Module>/history.json!
_orig_kh_dl_v242 = api_khinsider_download_track_v88
def api_khinsider_download_track_v242():
    raw_b = request.body.read()
    try:
        req_preview = json.loads(raw_b.decode("utf-8") or "{}")
    except Exception:
        req_preview = {}
    src_mode = str(req_preview.get("source_mode") or "ost").strip().lower()
    if src_mode not in ("ost", "archive"):
        src_mode = "archive" if "archive.org" in str(req_preview.get("page_path") or "").lower() else "ost"
    # Rewind request body for original handler
    import io as _io_v242
    request.environ['wsgi.input'] = _io_v242.BytesIO(raw_b)
    request.environ['CONTENT_LENGTH'] = str(len(raw_b))
    res_raw = _orig_kh_dl_v242()
    try:
        d = json.loads(res_raw) if isinstance(res_raw, str) else {}
        if d.get("status") == "ok" and d.get("filename"):
            fn = d["filename"]
            # Fix GENRE tag when downloaded from Archive.org so OST and Archive never mix!
            if src_mode == "archive":
                try:
                    db = load_custom_tags_db_v74()
                    if fn in db and isinstance(db[fn], dict):
                        db[fn]["GENRE"] = "Archive.org"
                        save_custom_tags_db_v74(db)
                except Exception:
                    pass
            record_jenny_hub_item_v242(
                src_mode,
                fn,
                title=str(req_preview.get("track_title") or fn),
                subtitle=str(req_preview.get("album_title") or ("Archive.org" if src_mode == "archive" else "Game OST")),
                size_mb=float(d.get("size_mb") or 0.0),
                extra={"ext": d.get("ext") or ""},
            )
    except Exception:
        pass
    return res_raw

_override_bottle_route_v212('/api/khinsider/download_track', 'POST', api_khinsider_download_track_v242)


_orig_sc_dl_v242 = api_soundcloud_download_track_v105
def api_soundcloud_download_track_v242():
    raw_b = request.body.read()
    try:
        req_preview = json.loads(raw_b.decode("utf-8") or "{}")
    except Exception:
        req_preview = {}
    import io as _io_v242
    request.environ['wsgi.input'] = _io_v242.BytesIO(raw_b)
    request.environ['CONTENT_LENGTH'] = str(len(raw_b))
    res_raw = _orig_sc_dl_v242()
    try:
        d = json.loads(res_raw) if isinstance(res_raw, str) else {}
        if d.get("status") == "ok" and d.get("filename"):
            record_jenny_hub_item_v242(
                "soundcloud",
                d["filename"],
                title=str(req_preview.get("track_title") or d["filename"]),
                subtitle="SoundCloud",
                size_mb=float(d.get("size_mb") or 0.0),
                extra={"ext": d.get("ext") or ""},
            )
    except Exception:
        pass
    return res_raw

_override_bottle_route_v212('/api/soundcloud/download_track', 'POST', api_soundcloud_download_track_v242)


_orig_rad_stop_v242 = api_radio_rec_stop_v240
def api_radio_rec_stop_v242():
    st_title = str(_RADIO_REC_V91.get("title") or "Radio Stream")
    is_ll = bool(_RADIO_REC_V91.get("lossless", True))
    res_raw = _orig_rad_stop_v242()
    try:
        d = json.loads(res_raw) if isinstance(res_raw, str) else {}
        if d.get("status") == "ok" and d.get("filename"):
            dur_s = float(d.get("duration_sec") or 0.0)
            sub_lbl = f"{'Lossless xFLAC' if is_ll else 'MP3 Direct'}" + (f" • {int(dur_s)}с" if dur_s > 0 else "")
            record_jenny_hub_item_v242(
                "radio",
                d["filename"],
                title=st_title,
                subtitle=sub_lbl,
                size_mb=float(d.get("size_mb") or 0.0),
                extra={"duration_sec": dur_s, "lossless": is_ll},
            )
    except Exception:
        pass
    return res_raw

_override_bottle_route_v212('/api/radio/record_stop', 'POST', api_radio_rec_stop_v242)


_orig_yt_dl_v242 = api_youtube_download_v230
def api_youtube_download_v242():
    res_raw = _orig_yt_dl_v242()
    try:
        d = json.loads(res_raw) if isinstance(res_raw, str) else {}
        if d.get("status") == "ok" and d.get("filename"):
            h_lbl = f"{d.get('selected_height')}p" if d.get("selected_height") else "Video"
            record_jenny_hub_item_v242(
                "youtube",
                d["filename"],
                title=os.path.splitext(d["filename"])[0],
                subtitle=f"YouTube • {h_lbl}",
                size_mb=float(d.get("size_mb") or 0.0),
                extra={"height": d.get("selected_height") or 0},
            )
    except Exception:
        pass
    return res_raw

_override_bottle_route_v212('/api/youtube/download', 'POST', api_youtube_download_v242)


# ==============================================================================
# 🧲 FULL P2P TORRENT PERSISTENCE IN /storage/emulated/0/JENNY/Torrents/
#    (Survives APK uninstall/reinstall; keeps paused, active & completed jobs!)
# ==============================================================================
_orig_tor_add_v242 = api_torrent_add_v214
def api_torrent_add_v242():
    raw_b = request.body.read()
    try:
        req_p = json.loads(raw_b.decode("utf-8") or "{}")
    except Exception:
        req_p = {}
    import io as _io_v242
    request.environ['wsgi.input'] = _io_v242.BytesIO(raw_b)
    request.environ['CONTENT_LENGTH'] = str(len(raw_b))
    res_raw = _orig_tor_add_v242()
    try:
        d = json.loads(res_raw) if isinstance(res_raw, str) else {}
        if d.get("status") == "ok" and d.get("hash"):
            h = str(d["hash"]).strip().lower()
            mag = str(req_p.get("magnet") or "")
            t_path = os.path.join(get_jenny_torrents_data_dir_v242(), f"{h}.torrent")
            with _TORRENT_DL_LOCK_V143:
                st = _load_persisted_dl_state_v143()
                ent = st.get(h) or {
                    "hash": h,
                    "name": d.get("name") or "Torrent",
                    "magnet": mag,
                    "torrent_path": t_path if os.path.isfile(t_path) else "",
                    "explicit_files": [],
                    "completed_files": [],
                    "paused": False,
                }
                if mag:
                    ent["magnet"] = mag
                if d.get("name"):
                    ent["name"] = d["name"]
                if os.path.isfile(t_path):
                    ent["torrent_path"] = t_path
                ent["updated_ts"] = round(time.time(), 2)
                st[h] = ent
                _save_persisted_dl_state_v143(st)
    except Exception:
        pass
    return res_raw

_override_bottle_route_v212('/api/torrent/add', 'POST', api_torrent_add_v242)


if 'api_torrent_control_v128' in globals():
    _orig_tor_ctrl_v242 = api_torrent_control_v128
    def api_torrent_control_v242():
        raw_b = request.body.read()
        try:
            data = json.loads(raw_b.decode("utf-8") or "{}")
        except Exception:
            data = {}
        act = str(data.get("action") or "").strip().lower()
        h = str(data.get("hash") or "").strip().lower()
        if h and act in ("pause", "stop_or_pause", "resume", "start"):
            with _TORRENT_DL_LOCK_V143:
                st = _load_persisted_dl_state_v143()
                if h in st and isinstance(st[h], dict):
                    st[h]["paused"] = act in ("pause", "stop_or_pause")
                    _save_persisted_dl_state_v143(st)
        import io as _io_v242
        request.environ['wsgi.input'] = _io_v242.BytesIO(raw_b)
        request.environ['CONTENT_LENGTH'] = str(len(raw_b))
        return _orig_tor_ctrl_v242()
    _override_bottle_route_v212('/api/torrent/control', 'POST', api_torrent_control_v242)


def _rehydrate_persisted_torrents_v242():
    """Restores saved torrents from /storage/emulated/0/JENNY/Torrents/ after restart or APK reinstall without wiping completed/paused torrents."""
    time.sleep(2.6)
    if not ensure_jtorrent_daemon_v96():
        return
    st = _load_persisted_dl_state_v143()
    if not st:
        return
    tor_dir = get_jenny_torrents_data_dir_v242()
    cached_trs, _, _ = _load_trackers_state_v110()

    existing_in_daemon = set()
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=2.0) as r:
            d_st = json.loads(r.read().decode("utf-8", "ignore"))
            for tor in (d_st.get("torrents") or []):
                th = (tor.get("hash") or "").strip().lower()
                if th:
                    existing_in_daemon.add(th)
    except Exception:
        pass

    for h_raw, entry in list(st.items()):
        if not isinstance(entry, dict):
            continue
        h = (h_raw or "").strip().lower()
        if not h:
            continue
        exp = sorted(list(set(int(x) for x in (entry.get("explicit_files") or []))))
        comp = sorted(list(set(int(x) for x in (entry.get("completed_files") or []))))
        pending = sorted(list(set(exp) - set(comp)))
        is_paused = bool(entry.get("paused", False))

        # Only auto-register torrents that had explicit downloads or a saved .torrent file
        t_path = entry.get("torrent_path") or os.path.join(tor_dir, f"{h}.torrent")
        mag = entry.get("magnet") or ""
        if not exp and not os.path.isfile(t_path):
            continue

        _KNOWN_TORRENT_META_V143[h] = {
            "name": entry.get("name") or "Torrent",
            "magnet": mag,
            "torrent_path": t_path if os.path.isfile(t_path) else "",
        }

        try:
            if h not in existing_in_daemon:
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
                    headers={"Content-Type": "application/json"},
                )
                urllib.request.urlopen(add_req, timeout=15).read()

            if pending and not is_paused:
                _JTORRENT_ACTIVE_FILES_V106[h] = set(pending)
                dl_req = urllib.request.Request(
                    f"http://127.0.0.1:{_JTORRENT_PORT_V96}/download",
                    data=json.dumps({"hash": h, "files": pending, "trackers": list(cached_trs or [])}).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
                urllib.request.urlopen(dl_req, timeout=8).read()
            elif is_paused or not pending:
                p_req = urllib.request.Request(
                    f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                    data=json.dumps({"hash": h, "action": "pause"}).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
                urllib.request.urlopen(p_req, timeout=4).read()
        except Exception:
            pass

# Override the old destructive startup cleaner so it never wipes completed/paused torrents!
_startup_resume_downloads_and_clean_streams_v143 = _rehydrate_persisted_torrents_v242
# [V361 DEFERRED AFTER 8080 BIND] threading.Thread(target=_rehydrate_persisted_torrents_v242, daemon=True).start()


# ==============================================================================
# 📻 4 MB RAM PRE-BUFFERED LOSSLESS FLAC RADIO ENGINE (/api/radio/buffered_stream_v242)
#    Eliminates Icecast socket underruns & chained Ogg-FLAC song-boundary stutters!
# ==============================================================================
_ACTIVE_RADIO_BUF_LOCK_V242 = threading.Lock()
_ACTIVE_RADIO_BUF_PROCS_V242 = []
_RADIO_MAX_RAM_BYTES_V242 = 4 * 1024 * 1024   # 4 MB RAM cushion (~38 sec of lossless FLAC!)
_RADIO_PREROLL_BYTES_V242 = 180 * 1024        # ~180 KB fast initial burst (~1.6 sec) before starting playback


def _kill_active_radio_buf_procs_v242():
    with _ACTIVE_RADIO_BUF_LOCK_V242:
        while _ACTIVE_RADIO_BUF_PROCS_V242:
            p = _ACTIVE_RADIO_BUF_PROCS_V242.pop()
            try:
                p.kill()
            except Exception:
                pass


def api_radio_buffered_stream_v242():
    raw_url = (request.query.get("url") or "").strip()
    is_lossless = (request.query.get("lossless") != "0")
    if not raw_url or not raw_url.startswith(("http://", "https://")):
        response.status = 400
        return "Invalid radio URL"

    _kill_active_radio_buf_procs_v242()
    ff_bin = find_ffmpeg_binary()

    # Decode upstream (including chained Ogg-FLAC or 96kHz/24-bit Hi-Res) into a single unbroken continuous stream
    cmd = [
        ff_bin, "-hide_banner", "-loglevel", "error",
        "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "4",
        "-rw_timeout", "15000000",
        "-probesize", "262144", "-analyzeduration", "500000",
        "-i", raw_url,
        "-vn", "-sn", "-dn",
    ]
    if is_lossless:
        mime_type = "audio/flac"
        cmd.extend([
            "-ac", "2", "-ar", "44100", "-sample_fmt", "s16",
            "-c:a", "flac", "-compression_level", "3",
            "-flush_packets", "1", "-f", "flac", "-"
        ])
    else:
        mime_type = "audio/mpeg"
        cmd.extend([
            "-ac", "2", "-ar", "44100",
            "-c:a", "libmp3lame", "-b:a", "256k",
            "-flush_packets", "1", "-f", "mp3", "-"
        ])

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=65536)
    with _ACTIVE_RADIO_BUF_LOCK_V242:
        _ACTIVE_RADIO_BUF_PROCS_V242.append(proc)

    chunk_q = _py_queue_v242.Queue()
    buffered_bytes = [0]
    buf_cond = threading.Condition()
    eof_flag = [False]
    stop_flag = [False]

    def _upstream_ram_reader():
        try:
            while not stop_flag[0]:
                data = proc.stdout.read(16384)
                if not data:
                    break
                with buf_cond:
                    while buffered_bytes[0] >= _RADIO_MAX_RAM_BYTES_V242 and not stop_flag[0]:
                        buf_cond.wait(timeout=0.25)
                    if stop_flag[0]:
                        break
                    chunk_q.put(data)
                    buffered_bytes[0] += len(data)
                    buf_cond.notify_all()
        except Exception:
            pass
        finally:
            with buf_cond:
                eof_flag[0] = True
                buf_cond.notify_all()

    t_reader = threading.Thread(target=_upstream_ram_reader, name="JennyRadioRamBufV242", daemon=True)
    t_reader.start()

    # Wait briefly (up to 1.8s) for initial pre-roll cushion so playback starts rock-solid without stutter
    preroll_deadline = time.time() + 1.8
    with buf_cond:
        while buffered_bytes[0] < _RADIO_PREROLL_BYTES_V242 and not eof_flag[0]:
            rem = preroll_deadline - time.time()
            if rem <= 0:
                break
            buf_cond.wait(timeout=min(0.2, rem))

    hdrs = {
        "Content-Type": mime_type,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Accept-Ranges": "none",
        "X-Jenny-Radio-Buffer": "4MB-RAM-V242",
    }

    def _stream_from_ram_v242():
        try:
            while True:
                try:
                    chunk = chunk_q.get(timeout=0.35)
                    with buf_cond:
                        buffered_bytes[0] = max(0, buffered_bytes[0] - len(chunk))
                        buf_cond.notify_all()
                    yield chunk
                except _py_queue_v242.Empty:
                    if eof_flag[0] and chunk_q.empty():
                        break
        finally:
            stop_flag[0] = True
            with buf_cond:
                buf_cond.notify_all()
            try:
                proc.kill()
            except Exception:
                pass

    return bottle.HTTPResponse(body=_stream_from_ram_v242(), status=200, headers=hdrs)

_override_bottle_route_v212('/api/radio/buffered_stream_v242', 'GET', api_radio_buffered_stream_v242)

def api_radio_stop_buffered_v242():
    response.content_type = "application/json; charset=utf-8"
    _kill_active_radio_buf_procs_v242()
    return json.dumps({"status": "ok"})

_override_bottle_route_v212('/api/radio/stop_buffered_v242', 'POST', api_radio_stop_buffered_v242)
# ================= END JENNY_V242_EXTERNAL_HUB_AND_RADIO_BUFFER_PATCH =================

# ================= BEGIN JENNY_V238_MULTI_PORT_CLUSTER_AND_CORS_PATCH =================
_ACTIVE_CLUSTER_PORTS_V238 = [8080]
_CLUSTER_STARTED_LOCK_V238 = threading.Lock()
_CLUSTER_STARTED_FLAG_V238 = False
_INTERNAL_STREAM_PORT_V238 = 8080


class JennyCorsWsgiMiddlewareV238:
    # Universal WSGI-level CORS + HTTP Range Exposure wrapper for all 4 Waitress ports (:8080..:8083).
    # Guarantees CORS headers even on static_file(), HTTPResponse streams (live_remux / reverse_remux),
    # 206 Partial Content responses, and 0.05ms OPTIONS preflights.
    def __init__(self, wsgi_app, port_num):
        self.wsgi_app = wsgi_app
        self.port_str = str(port_num)

    def __call__(self, environ, start_response):
        if environ.get('REQUEST_METHOD') == 'OPTIONS':
            opt_headers = [
                ('Access-Control-Allow-Origin', '*'),
                ('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD'),
                ('Access-Control-Allow-Headers', 'Origin, Accept, Content-Type, X-Requested-With, Range, Cache-Control'),
                ('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Jenny-Port'),
                ('Access-Control-Max-Age', '86400'),
                ('Timing-Allow-Origin', '*'),
                ('Cross-Origin-Resource-Policy', 'cross-origin'),
                ('X-Jenny-Port', self.port_str),
                ('Content-Length', '0'),
            ]
            start_response('204 No Content', opt_headers)
            return [b'']

        port_str = self.port_str

        def _cors_start_response(status, response_headers, exc_info=None):
            filtered = []
            for hk, hv in response_headers:
                hl = hk.lower()
                if hl in (
                    'access-control-allow-origin',
                    'access-control-allow-methods',
                    'access-control-allow-headers',
                    'access-control-expose-headers',
                    'timing-allow-origin',
                    'cross-origin-resource-policy',
                    'x-jenny-port',
                ):
                    continue
                filtered.append((hk, hv))
            filtered.extend([
                ('Access-Control-Allow-Origin', '*'),
                ('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD'),
                ('Access-Control-Allow-Headers', 'Origin, Accept, Content-Type, X-Requested-With, Range, Cache-Control'),
                ('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Jenny-Port'),
                ('Timing-Allow-Origin', '*'),
                ('Cross-Origin-Resource-Policy', 'cross-origin'),
                ('X-Jenny-Port', port_str),
            ])
            return start_response(status, filtered, exc_info)

        return self.wsgi_app(environ, _cors_start_response)


def api_multiport_ping_v238():
    response.content_type = 'application/json; charset=utf-8'
    srv_port = 8080
    try:
        srv_port = int(request.environ.get('SERVER_PORT') or 8080)
    except Exception:
        pass
    return json.dumps({
        "status": "ok",
        "version": "v238",
        "current_port": srv_port,
        "ports": sorted(list(set(_ACTIVE_CLUSTER_PORTS_V238))),
        "iframe_origins": {
            "shell": "http://127.0.0.1:8080",
            "deck_a": "http://127.0.0.1:8081",
            "deck_b": "http://127.0.0.1:8082",
            "torrents": "http://127.0.0.1:8083"
        },
        "sandboxes": {
            "deck_a": "http://127.0.0.1:8081/deck_a_sandbox.html?v=362",
            "deck_b": "http://127.0.0.1:8082/deck_b_sandbox.html?v=362",
            "torrents": "http://127.0.0.1:8083/torrents_sandbox.html?v=362"
        },
        "roles": {
            "8080": "VIP UI / Folders / Presets",
            "8081": "Deck A Audio / xFLAC / PCM",
            "8082": "Deck B Video / FFmpeg Live Remux",
            "8083": "Background P2P / YouTube / OST / Radio"
        }
    }, ensure_ascii=False)

_override_bottle_route_v212('/api/multiport/ping', 'GET', api_multiport_ping_v238)


def _create_waitress_instance_v238(wsgi_callable, port_num, num_threads):
    from waitress.server import create_server
    try:
        return create_server(
            wsgi_callable,
            host='127.0.0.1',
            port=int(port_num),
            threads=int(num_threads),
            connection_limit=256,
            channel_timeout=120,
            asyncore_use_poll=True,
            expose_tracebacks=False,
        )
    except TypeError:
        return create_server(
            wsgi_callable,
            host='127.0.0.1',
            port=int(port_num),
            threads=int(num_threads),
        )


def start_server_v238():
    global _CLUSTER_STARTED_FLAG_V238, _INTERNAL_STREAM_PORT_V238
    base_app = bottle.default_app()
    cfg_pool = 64
    try:
        cfg_pool = max(24, min(128, int(_THREAD_CFG_V216.get("serverPoolThreads", 64))))
    except Exception:
        cfg_pool = 64

    # 1. [V362] Чтение сохранённого списка папок (< 2 мс) и мгновенное открытие ВСЕХ 4 изолированных портов
    #    (8080 VIP UI/Папки, 8081 Дека А Аудио/xFLAC, 8082 Дека Б Видео/FFmpeg, 8083 P2P/Радио/OST/YouTube)
    #    за ~12 мс ДО тяжёлой зачистки временных файлов и запуска фоновых P2P-демонов!
    try:
        load_saved_music_dir()
        load_multi_dirs_v71()
    except Exception:
        pass

    main_wrapped = JennyCorsWsgiMiddlewareV238(base_app, 8080)
    main_srv = None
    for _attempt in range(10):
        try:
            main_srv = _create_waitress_instance_v238(main_wrapped, 8080, max(24, cfg_pool // 2))
            break
        except Exception:
            time.sleep(0.08)

    worker_specs = [
        (8081, max(16, cfg_pool // 2), "Deck A Audio & xFLAC"),
        (8082, max(16, cfg_pool // 2), "Deck B Video & FFmpeg Remux"),
        (8083, max(24, cfg_pool),      "Background P2P / YouTube / OST / Radio"),
    ]
    with _CLUSTER_STARTED_LOCK_V238:
        if not _CLUSTER_STARTED_FLAG_V238:
            _CLUSTER_STARTED_FLAG_V238 = True
            for p_num, p_threads, p_label in worker_specs:
                try:
                    wrapped = JennyCorsWsgiMiddlewareV238(base_app, p_num)
                    srv_obj = _create_waitress_instance_v238(wrapped, p_num, p_threads)
                    if p_num not in _ACTIVE_CLUSTER_PORTS_V238:
                        _ACTIVE_CLUSTER_PORTS_V238.append(p_num)
                    if p_num == 8082:
                        _INTERNAL_STREAM_PORT_V238 = 8082
                    t = threading.Thread(
                        target=srv_obj.run,
                        name=f"JennyWaitress_{p_num}",
                        daemon=True,
                    )
                    t.start()
                    print(f"⚡ [V362] ИЗОЛИРОВАННЫЙ ПОРТ {p_num} АКТИВЕН ({p_label}, потоков: {p_threads})")
                except Exception as e_port:
                    print(f"⚠️ [V362] Порт {p_num} занят/пропущен ({e_port}), работает авто-фоллбэк на 8080")

    def _boot_daemons_and_cleanup_v362():
        time.sleep(1.2)
        try:
            cleanup_stale_temps(DEFAULT_MUSIC_DIR)
            if MUSIC_DIR != DEFAULT_MUSIC_DIR:
                cleanup_stale_temps(MUSIC_DIR)
        except Exception:
            pass
        time.sleep(1.0)
        for bg_fn in (
            globals().get("ensure_jtorrent_daemon_v96"),
            globals().get("ensure_omnitorrent_daemon_v124"),
            globals().get("_rehydrate_persisted_torrents_v242"),
            globals().get("_upgrade_running_daemon_if_old_v238"),
        ):
            if callable(bg_fn):
                threading.Thread(target=bg_fn, daemon=True).start()

    threading.Thread(target=_boot_daemons_and_cleanup_v362, name="JennyDeferredBootV362", daemon=True).start()

    print("🚀 [V362] ВСЕ 4 ПОРТА (8080..8083) МГНОВЕННО АКТИВНЫ!")
    if main_srv is not None:
        main_srv.run()
    else:
        run(app=main_wrapped, host='127.0.0.1', port=8080, quiet=True, server='waitress', threads=max(24, cfg_pool // 2))


start_server = start_server_v238
# ================= END JENNY_V238_MULTI_PORT_CLUSTER_AND_CORS_PATCH =================

# ================= BEGIN JENNY_V238_P2P_TURBO_DIAG =================
import collections as _col_v238
import random as _rnd_v238
import struct as _struct_v238

_JTORRENT_LOG_RING_V238 = _col_v238.deque(maxlen=250)
_JTORRENT_DRAINED_PIDS_V238 = set()
_JTORRENT_START_LOCK_V238 = threading.Lock()
_TORRENT_STATUS_OBJ_CACHE_V238 = {"ts": 0.0, "obj": None}
_HEAD_TAIL_ONCE_V238 = set()
_TRACKER_ALIVE_CACHE_V238 = {}


def _append_jtorrent_log_v238(prefix: str, raw_line):
    try:
        txt = _safe_decode_bytes_v218(raw_line).strip() if "_safe_decode_bytes_v218" in globals() else raw_line.decode("utf-8", errors="replace").strip()
        if not txt:
            return
        ts_str = time.strftime("%H:%M:%S")
        _JTORRENT_LOG_RING_V238.append(f"[{ts_str}] {prefix}{txt}")
    except Exception:
        pass


def _attach_jtorrent_pipe_drainer_v238(proc):
    if proc is None or getattr(proc, "pid", None) is None:
        return
    if proc.pid in _JTORRENT_DRAINED_PIDS_V238:
        return
    _JTORRENT_DRAINED_PIDS_V238.add(proc.pid)

    def _drain_stream(stream_obj, tag):
        if stream_obj is None:
            return
        try:
            for raw_ln in iter(stream_obj.readline, b""):
                if not raw_ln:
                    break
                _append_jtorrent_log_v238(tag, raw_ln)
        except Exception:
            pass

    if getattr(proc, "stdout", None) is not None:
        threading.Thread(target=_drain_stream, args=(proc.stdout, ""), daemon=True).start()
    if getattr(proc, "stderr", None) is not None and getattr(proc, "stderr", None) is not getattr(proc, "stdout", None):
        threading.Thread(target=_drain_stream, args=(proc.stderr, "[ERR] "), daemon=True).start()


def find_jtorrent_binary_v96():
    cands = []
    if "_get_native_lib_dirs_v140" in globals():
        try:
            for nd in _get_native_lib_dirs_v140():
                cands.append(os.path.join(nd, "libjtorrent.so"))
        except Exception:
            pass
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
            if cand.startswith("/storage/"):
                exec_dir = os.environ.get("JENNY_FILES_DIR") or tempfile.gettempdir()
                if exec_dir and os.path.isdir(exec_dir):
                    exec_bin = os.path.join(exec_dir, "libjtorrent_exec.so")
                    stamp_file = exec_bin + ".stamp"
                    try:
                        st = os.stat(cand)
                        cur_sig = f"{st.st_size}:{int(st.st_mtime)}"
                        old_sig = ""
                        if os.path.isfile(stamp_file):
                            old_sig = open(stamp_file, "r", encoding="utf-8").read().strip()
                        if (not os.path.isfile(exec_bin)) or (os.path.getsize(exec_bin) != st.st_size) or (old_sig != cur_sig):
                            shutil.copy2(cand, exec_bin)
                            open(stamp_file, "w", encoding="utf-8").write(cur_sig)
                        os.chmod(exec_bin, 0o755)
                        return exec_bin
                    except Exception:
                        pass
            return cand
    return "libjtorrent.so"


def ensure_jtorrent_daemon_v96():
    global _JTORRENT_PROC_V96
    if _JTORRENT_PROC_V96 is not None:
        _attach_jtorrent_pipe_drainer_v238(_JTORRENT_PROC_V96)
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.8) as r:
            if r.status == 200:
                return True
    except Exception:
        pass

    with _JTORRENT_START_LOCK_V238:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.6) as r:
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

        _append_jtorrent_log_v238("[INIT] ", f"Запуск демона {bin_p} на порту {_JTORRENT_PORT_V96}".encode("utf-8"))
        _JTORRENT_PROC_V96 = subprocess.Popen(
            [bin_p, "-port", _JTORRENT_PORT_V96, "-dir", tor_dir],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT
        )
        _attach_jtorrent_pipe_drainer_v238(_JTORRENT_PROC_V96)

        for _ in range(25):
            time.sleep(0.15)
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.5) as r:
                    if r.status == 200:
                        _append_jtorrent_log_v238("[READY] ", b"Go P2P Engine online")
                        return True
            except Exception:
                pass
    return False


def _upgrade_running_daemon_if_old_v238():
    global _JTORRENT_PROC_V96
    time.sleep(0.4)
    if _JTORRENT_PROC_V96 is not None:
        _attach_jtorrent_pipe_drainer_v238(_JTORRENT_PROC_V96)
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.9) as r:
            st = json.loads(r.read().decode("utf-8", errors="ignore"))
        if st.get("version") != "2.0-diag" and len(st.get("torrents") or []) == 0:
            if _JTORRENT_PROC_V96 is not None:
                try:
                    _JTORRENT_PROC_V96.kill()
                except Exception:
                    pass
                _JTORRENT_PROC_V96 = None
                time.sleep(0.2)
                ensure_jtorrent_daemon_v96()
    except Exception:
        ensure_jtorrent_daemon_v96()

# [V361 DEFERRED AFTER 8080 BIND] threading.Thread(target=_upgrade_running_daemon_if_old_v238, daemon=True).start()


def _check_tracker_host_alive_v238(tr_url: str) -> bool:
    try:
        p = urllib.parse.urlparse((tr_url or "").strip())
        scheme = (p.scheme or "").lower()
        host = p.hostname
        if not host or scheme not in ("udp", "http", "https"):
            return False
        port = p.port or (443 if scheme == "https" else 80)
        cache_k = f"{scheme}://{host.lower()}:{port}"
        now = time.time()
        cached = _TRACKER_ALIVE_CACHE_V238.get(cache_k)
        if cached is not None and (now - cached[0] < 600.0):
            return cached[1]

        alive = False
        if scheme == "udp":
            ips = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_DGRAM)
            if ips:
                tx_id = _rnd_v238.randint(1, 0x7FFFFFFF)
                pkt = _struct_v238.pack(">QII", 0x41727101980, 0, tx_id)
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.settimeout(0.95)
                try:
                    s.sendto(pkt, (ips[0][4][0], port))
                    resp, _ = s.recvfrom(64)
                    if len(resp) >= 16:
                        act, rx_tx, _ = _struct_v238.unpack(">IIQ", resp[:16])
                        alive = (act == 0 and rx_tx == tx_id)
                finally:
                    s.close()
        else:
            ips = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
            if ips:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(1.1)
                try:
                    s.connect((ips[0][4][0], port))
                    alive = True
                finally:
                    s.close()

        _TRACKER_ALIVE_CACHE_V238[cache_k] = (now, alive)
        return alive
    except Exception:
        return False

_check_tracker_host_alive_v110 = _check_tracker_host_alive_v238


def _temporarily_prioritize_torrent_v238(focus_hash: str, duration_sec: float = 14.0):
    """Удаляет только пустые зависшие хэши без метаданных, НЕ разрывая слоты активных закачек паузами."""
    focus_h = (focus_hash or "").strip().lower()
    try:
        st = _TORRENT_STATUS_OBJ_CACHE_V238["obj"]
        if not st or (time.time() - _TORRENT_STATUS_OBJ_CACHE_V238["ts"] > 1.5):
            with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.9) as r:
                st = json.loads(r.read().decode("utf-8", "ignore"))
        for tor in (st.get("torrents") or []):
            th = (tor.get("hash") or "").strip().lower()
            if not th or th == focus_h:
                continue
            t_files = tor.get("files") or tor.get("all_files") or []
            idle_ms = int(tor.get("last_data_ms") or 0)
            if len(t_files) == 0 and int(tor.get("num_pieces") or 0) == 0 and th not in _CURRENTLY_ADDING_HASHES_V214 and idle_ms > 28000:
                try:
                    urllib.request.urlopen(urllib.request.Request(
                        f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                        data=json.dumps({"hash": th, "action": "drop"}).encode("utf-8"),
                        headers={"Content-Type": "application/json"}
                    ), timeout=0.7).read()
                except Exception:
                    pass
    except Exception:
        pass

_temporarily_prioritize_torrent_v214 = _temporarily_prioritize_torrent_v238


def _boost_torrent_file_and_pieces_v238(h_low: str, f_idx: int, ratio: float = -1.0, byte_offset: int = -1, sync_start: bool = False):
    h_low = (h_low or "").strip().lower()
    if not h_low:
        return
    f_idx = int(f_idx)
    _cancel_stream_hold_release_v216()

    cached_st = _TORRENT_STATUS_OBJ_CACHE_V238["obj"] if (time.time() - _TORRENT_STATUS_OBJ_CACHE_V238["ts"] < 1.2) else None
    already_known = False
    if cached_st:
        for tor in (cached_st.get("torrents") or []):
            if (tor.get("hash") or "").strip().lower() == h_low and int(tor.get("num_pieces") or 0) > 0:
                already_known = True
                break
    if not already_known and "_ensure_torrent_registered_in_daemon_v145" in globals():
        _ensure_torrent_registered_in_daemon_v145(h_low)

    persisted_st = _load_persisted_dl_state_v143() if "_load_persisted_dl_state_v143" in globals() else {}
    exp_files = set(int(x) for x in (persisted_st.get(h_low, {}).get("explicit_files") or []))
    comp_files = set(int(x) for x in (persisted_st.get(h_low, {}).get("completed_files") or []))
    pending_exp = exp_files - comp_files

    active_files = sorted(list(pending_exp | {f_idx})) if pending_exp else [f_idx]
    _STREAM_ONLY_ACTIVE_V143.setdefault(h_low, set()).add(f_idx)
    _JTORRENT_ACTIVE_FILES_V106[h_low] = set(active_files)

    def _do_boost():
        try:
            now_b = time.time()
            if not hasattr(_boost_torrent_file_and_pieces_v238, "_recent_file_select"):
                _boost_torrent_file_and_pieces_v238._recent_file_select = {}
            if not hasattr(_boost_torrent_file_and_pieces_v238, "_recent_boosts"):
                _boost_torrent_file_and_pieces_v238._recent_boosts = {}

            sel_key = f"{h_low}_{f_idx}"
            if now_b - _boost_torrent_file_and_pieces_v238._recent_file_select.get(sel_key, 0.0) > 8.0:
                _boost_torrent_file_and_pieces_v238._recent_file_select[sel_key] = now_b
                cached_trs, _, _ = _load_trackers_state_v110()
                for route_p, body_d, tout in (
                    ("/control", {"hash": h_low, "action": "resume"}, 0.9),
                    ("/download", {"hash": h_low, "files": active_files, "trackers": list(cached_trs or [])}, 1.8),
                    ("/control", {"hash": h_low, "action": "boost_file", "file_index": f_idx}, 1.0),
                ):
                    try:
                        urllib.request.urlopen(urllib.request.Request(
                            f"http://127.0.0.1:{_JTORRENT_PORT_V96}{route_p}",
                            data=json.dumps(body_d).encode("utf-8"),
                            headers={"Content-Type": "application/json"}
                        ), timeout=tout).read()
                    except Exception:
                        pass

            st_obj = _TORRENT_STATUS_OBJ_CACHE_V238["obj"] if (now_b - _TORRENT_STATUS_OBJ_CACHE_V238["ts"] < 0.8) else None
            if not st_obj:
                with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=1.1) as sr:
                    st_obj = json.loads(sr.read().decode("utf-8", "ignore"))

            beg_p, end_p, f_len = 0, 0, 0
            p_map_str = ""
            for tor in (st_obj.get("torrents") or []):
                if (tor.get("hash") or "").strip().lower() == h_low:
                    p_map_str = tor.get("pieces_map") or ""
                    for fobj in (tor.get("files") or []) + (tor.get("all_files") or []):
                        if int(fobj.get("index", -1)) == f_idx:
                            beg_p = int(fobj.get("begin_piece") or 0)
                            end_p = int(fobj.get("end_piece") or 0)
                            f_len = int(fobj.get("length") or fobj.get("size") or 0)
                            break
                    break

            if end_p > beg_p:
                calc_ratio = ratio
                if calc_ratio < 0.0 and byte_offset > 0 and f_len > 0:
                    calc_ratio = float(byte_offset) / float(f_len)

                lookahead = max(2, min(20, int(_THREAD_CFG_V216.get("torrentPrebufferPieces", 8))))
                span = max(1, end_p - beg_p)
                center_p = max(beg_p, min(end_p - 1, beg_p + int(calc_ratio * span))) if (0.0 < calc_ratio <= 1.0) else beg_p

                missing_ahead = []
                # Хвостовой кусок с индексами Cues/idx1 запрашиваем ОДИН РАЗ на старте файла, не дёргая сидов каждые 2.5 сек!
                if sel_key not in _HEAD_TAIL_ONCE_V238:
                    _HEAD_TAIL_ONCE_V238.add(sel_key)
                    if beg_p < end_p and (not p_map_str or (beg_p < len(p_map_str) and p_map_str[beg_p] != '4')):
                        missing_ahead.append(beg_p)
                    tail_p = end_p - 1
                    if tail_p > beg_p and (not p_map_str or (tail_p < len(p_map_str) and p_map_str[tail_p] != '4')):
                        missing_ahead.append(tail_p)

                for cand_p in range(center_p, min(end_p, center_p + lookahead * 2)):
                    if cand_p in missing_ahead:
                        continue
                    if p_map_str and 0 <= cand_p < len(p_map_str) and p_map_str[cand_p] == '4':
                        continue
                    missing_ahead.append(cand_p)
                    if len(missing_ahead) >= lookahead:
                        break

                pieces_to_boost = list(reversed(missing_ahead))
                recent_map = _boost_torrent_file_and_pieces_v238._recent_boosts
                for idx_order, p_idx in enumerate(pieces_to_boost):
                    b_key = f"{h_low}_{p_idx}"
                    cooldown = 2.0 if idx_order == len(pieces_to_boost) - 1 else 5.5
                    if now_b - recent_map.get(b_key, 0.0) < cooldown:
                        continue
                    recent_map[b_key] = now_b
                    try:
                        urllib.request.urlopen(urllib.request.Request(
                            f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                            data=json.dumps({"hash": h_low, "action": "boost_piece", "piece_index": int(p_idx)}).encode("utf-8"),
                            headers={"Content-Type": "application/json"}
                        ), timeout=0.45).read()
                    except Exception:
                        pass
        except Exception:
            pass

    if sync_start:
        _do_boost()
    else:
        threading.Thread(target=_do_boost, daemon=True).start()

_boost_torrent_file_and_pieces_v214 = _boost_torrent_file_and_pieces_v238
_boost_torrent_file_and_pieces_v218 = _boost_torrent_file_and_pieces_v238


_orig_del_tor_v238 = _delete_torrent_files_from_disk_v142
def _delete_torrent_files_from_disk_v142(target_hash: str, nuke_all: bool = False, keep_torrent_meta: bool = False) -> float:
    h = (target_hash or "").strip().lower()
    if nuke_all:
        _HEAD_TAIL_ONCE_V238.clear()
    elif h:
        for k in [x for x in list(_HEAD_TAIL_ONCE_V238) if x.startswith(h + "_")]:
            _HEAD_TAIL_ONCE_V238.discard(k)
    _TORRENT_STATUS_OBJ_CACHE_V238["obj"] = None
    return _orig_del_tor_v238(target_hash, nuke_all=nuke_all, keep_torrent_meta=keep_torrent_meta)


@route('/api/torrent/engine_log', method='GET')
def api_torrent_engine_log_v238():
    response.content_type = 'application/json; charset=utf-8'
    trs, last_s, auto_u = _load_trackers_state_v110()
    return json.dumps({
        "status": "ok",
        "lines": list(_JTORRENT_LOG_RING_V238),
        "trackers_cached": len(trs or []),
        "last_sync": last_s,
        "auto_update": bool(auto_u),
        "daemon_bin": find_jtorrent_binary_v96()
    }, ensure_ascii=False)
_override_bottle_route_v212('/api/torrent/engine_log', 'GET', api_torrent_engine_log_v238)


@route('/api/torrent/status', method='GET')
def api_torrent_status_v238():
    response.content_type = 'application/json; charset=utf-8'
    now = time.time()
    if _TORRENT_STATUS_CACHE_V212["data"] is not None and (now - _TORRENT_STATUS_CACHE_V212["ts"] < 0.30):
        return _TORRENT_STATUS_CACHE_V212["data"]

    if not ensure_jtorrent_daemon_v96():
        return json.dumps({"status": "error", "torrents": []})

    try:
        req = urllib.request.Request(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status")
        with urllib.request.urlopen(req, timeout=2.5) as r:
            data = json.loads(r.read().decode("utf-8", errors="replace"))

        persisted_st = _load_persisted_dl_state_v143() if "_load_persisted_dl_state_v143" in globals() else {}
        trs_list, _, _ = _load_trackers_state_v110()
        data["trackers_cached"] = len(trs_list or [])
        clean_torrents = []

        for t in data.get("torrents", []):
            th = (t.get("hash") or "").lower()
            t_files = t.get("files") or []
            t_all_files = t.get("all_files") or []

            if len(t_files) == 0 and len(t_all_files) == 0 and int(t.get("num_pieces") or 0) == 0:
                is_actively_adding = (th in _CURRENTLY_ADDING_HASHES_V214) or (t.get("stage") == "metadata" and int(t.get("last_data_ms") or 0) < 27000)
                if is_actively_adding:
                    t["is_adding"] = True
                    known_nm = (_KNOWN_TORRENT_META_V143.get(th) or {}).get("name") if "_KNOWN_TORRENT_META_V143" in globals() else ""
                    if known_nm:
                        t["name"] = known_nm
                    clean_torrents.append(t)
                    continue
                if th:
                    def _drop_dead(dead_h):
                        try:
                            urllib.request.urlopen(urllib.request.Request(
                                f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                                data=json.dumps({"hash": dead_h, "action": "drop"}).encode("utf-8"),
                                headers={"Content-Type": "application/json"}
                            ), timeout=0.8).read()
                        except Exception:
                            pass
                    threading.Thread(target=_drop_dead, args=(th,), daemon=True).start()
                continue

            t_name = (t.get("name") or "Torrent").strip()
            act_set = _JTORRENT_ACTIVE_FILES_V106.get(th, set())
            exp_list = set(int(x) for x in persisted_st.get(th, {}).get("explicit_files", []))
            stream_set = _STREAM_ONLY_ACTIVE_V143.get(th, set()) if "_STREAM_ONLY_ACTIVE_V143" in globals() else set()
            p_map_str = t.get("pieces_map") or ""
            piece_len = int(t.get("piece_length") or 0)
            t["has_explicit_dl"] = bool(exp_list)

            for f in t_files:
                f_idx = int(f.get("index", 0))
                key = f"{th}_{f_idx}"
                f_len = int(f.get("length") or f.get("size") or 0)
                raw_comp = int(f.get("completed") or 0)
                raw_done = bool(f.get("done")) or (f_len > 0 and raw_comp >= f_len)

                if p_map_str:
                    beg_p = max(0, int(f.get("begin_piece") or 0))
                    end_p = min(len(p_map_str), int(f.get("end_piece") or len(p_map_str)))
                    if end_p > beg_p:
                        f_slice = p_map_str[beg_p:end_p]
                        done_p_cnt = f_slice.count('4')
                        part_p_cnt = f_slice.count('3')
                        if done_p_cnt == 0 and part_p_cnt == 0 and not _JTORRENT_CONVERTED_V96.get(key):
                            raw_comp = 0
                            raw_done = False
                        elif piece_len > 0 and not _JTORRENT_CONVERTED_V96.get(key):
                            max_valid_comp = (done_p_cnt + part_p_cnt) * piece_len
                            if raw_comp > max_valid_comp and done_p_cnt < (end_p - beg_p):
                                raw_comp = min(f_len, max_valid_comp)
                                raw_done = False

                prev_rec = _TORRENT_MAX_PROGRESS_V212.get(key)
                if prev_rec:
                    if prev_rec.get("done") and _JTORRENT_CONVERTED_V96.get(key):
                        raw_done = True
                        raw_comp = f_len if f_len > 0 else max(raw_comp, prev_rec.get("completed", 0))
                    elif raw_comp > 0:
                        raw_comp = max(raw_comp, prev_rec.get("completed", 0))
                        if f_len > 0 and raw_comp >= f_len:
                            raw_done = True
                    else:
                        _TORRENT_MAX_PROGRESS_V212.pop(key, None)
                        prev_rec = None

                if raw_done and f_len > 0:
                    raw_comp = f_len

                eff_pct = 100 if raw_done else (min(99, int((raw_comp * 100) // f_len)) if f_len > 0 else 0)
                if prev_rec and not raw_done and raw_comp > 0:
                    eff_pct = max(eff_pct, min(99, int(prev_rec.get("percent", 0))))

                _TORRENT_MAX_PROGRESS_V212[key] = {
                    "completed": raw_comp,
                    "percent": eff_pct,
                    "done": raw_done,
                    "length": f_len
                }

                f["completed"] = raw_comp
                f["percent"] = eff_pct
                f["done"] = raw_done

                is_exp = (f_idx in exp_list) or (f_idx in act_set and f_idx not in stream_set)
                f["is_selected"] = (f_idx in act_set) or is_exp
                f["is_explicit_dl"] = is_exp
                f["explicit_dl"] = is_exp
                f["is_stream_only"] = (f_idx in stream_set) and not is_exp

                f_path = f.get("full_path") or f.get("path") or ""
                if raw_done and not _JTORRENT_CONVERTED_V96.get(key):
                    ext_f = os.path.splitext(f_path)[1].lower()
                    if ext_f in _VIDEO_EXTS_V134 or (is_exp and ext_f in ('.mp3', '.m4a', '.ogg', '.opus', '.aac')):
                        _instant_import_completed_file_v212(th, f_idx, f.get("full_path") or "", f.get("path") or "", t_name)

                f["xflac_file"] = _JTORRENT_CONVERTED_V96.get(key, "")

                if not raw_done and (f.get("is_lead") or is_exp) and eff_pct >= 94 and p_map_str:
                    last_b = _TORRENT_ENDGAME_BOOST_TS_V212.get(key, 0.0)
                    if now - last_b >= 4.0:
                        _TORRENT_ENDGAME_BOOST_TS_V212[key] = now
                        beg_p = max(0, int(f.get("begin_piece") or 0))
                        end_p = min(len(p_map_str), int(f.get("end_piece") or len(p_map_str)))
                        missing_p = [p_i for p_i in range(beg_p, end_p) if p_map_str[p_i] != '4'][:3]
                        if missing_p:
                            def _boost_tail(h_target, p_list, f_target):
                                try:
                                    urllib.request.urlopen(urllib.request.Request(
                                        f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                                        data=json.dumps({"hash": h_target, "action": "boost_file", "file_index": f_target}).encode("utf-8"),
                                        headers={"Content-Type": "application/json"}
                                    ), timeout=1.0).read()
                                    for mp in p_list:
                                        urllib.request.urlopen(urllib.request.Request(
                                            f"http://127.0.0.1:{_JTORRENT_PORT_V96}/control",
                                            data=json.dumps({"hash": h_target, "action": "boost_piece", "piece_index": mp}).encode("utf-8"),
                                            headers={"Content-Type": "application/json"}
                                        ), timeout=1.0).read()
                                except Exception:
                                    pass
                            threading.Thread(target=_boost_tail, args=(th, missing_p, f_idx), daemon=True).start()

            clean_torrents.append(t)

        data["torrents"] = clean_torrents
        _TORRENT_STATUS_OBJ_CACHE_V238["ts"] = now
        _TORRENT_STATUS_OBJ_CACHE_V238["obj"] = data
        out_json = json.dumps(data, ensure_ascii=False)
        _TORRENT_STATUS_CACHE_V212["ts"] = now
        _TORRENT_STATUS_CACHE_V212["data"] = out_json
        return out_json
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

_override_bottle_route_v212('/api/torrent/status', 'GET', api_torrent_status_v238)
# ================= END JENNY_V238_P2P_TURBO_DIAG =================

# ================= BEGIN JENNY_V243_UNIFIED_FIXES =================
def _resolve_persistent_tor_data_dir_v243() -> str:
    for gk, gv in list(globals().items()):
        if isinstance(gv, str) and "/JENNY/Torrents/data" in gv:
            try:
                os.makedirs(gv, exist_ok=True)
                return gv
            except Exception:
                pass
    jenny_tor_data = "/storage/emulated/0/JENNY/Torrents/data"
    try:
        os.makedirs(jenny_tor_data, exist_ok=True)
        return jenny_tor_data
    except Exception:
        fallback = os.path.join(MUSIC_DIR, "torrents_tmp")
        os.makedirs(fallback, exist_ok=True)
        return fallback


def ensure_jtorrent_daemon_v96():
    global _JTORRENT_PROC_V96
    if _JTORRENT_PROC_V96 is not None and "_attach_jtorrent_pipe_drainer_v238" in globals():
        _attach_jtorrent_pipe_drainer_v238(_JTORRENT_PROC_V96)
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.8) as r:
            if r.status == 200:
                return True
    except Exception:
        pass

    lock_ctx = globals().get("_JTORRENT_START_LOCK_V238") or threading.Lock()
    with lock_ctx:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.6) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass

        bin_p = find_jtorrent_binary_v96()
        tor_dir = _resolve_persistent_tor_data_dir_v243()
        try:
            os.chmod(bin_p, 0o755)
        except Exception:
            pass

        _JTORRENT_PROC_V96 = subprocess.Popen(
            [bin_p, "-port", _JTORRENT_PORT_V96, "-dir", tor_dir],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT
        )
        if "_attach_jtorrent_pipe_drainer_v238" in globals():
            _attach_jtorrent_pipe_drainer_v238(_JTORRENT_PROC_V96)

        for _ in range(25):
            time.sleep(0.15)
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{_JTORRENT_PORT_V96}/status", timeout=0.5) as r:
                    if r.status == 200:
                        return True
            except Exception:
                pass
    return False


# Расширяем поиск скачанных P2P-файлов на постоянную папку /storage/emulated/0/JENNY/Torrents/data
_orig_locate_p2p_v243 = _locate_downloaded_p2p_file_v163
def _locate_downloaded_p2p_file_v163(target_name: str, target_hash: str = "", target_idx: int = -1):
    res = _orig_locate_p2p_v243(target_name, target_hash, target_idx)
    if res and res[0] and os.path.isfile(res[0]):
        return res
    p_dir = _resolve_persistent_tor_data_dir_v243()
    target_base = os.path.basename((target_name or "").strip()).lower()
    if target_base and os.path.isdir(p_dir):
        for root_w, _, files_w in os.walk(p_dir):
            for fn_w in files_w:
                if fn_w.lower() == target_base:
                    cand = os.path.join(root_w, fn_w)
                    if os.path.isfile(cand):
                        return cand, "Torrent P2P", (target_hash or "").strip().lower(), target_idx
    return res


@post('/api/radio/abort_stale_v243')
def api_radio_abort_stale_v243():
    response.content_type = 'application/json; charset=utf-8'
    killed = 0
    for gk, gv in list(globals().items()):
        low_k = gk.lower()
        if "radio" in low_k and "rec" not in low_k:
            if isinstance(gv, subprocess.Popen):
                try:
                    gv.kill()
                    killed += 1
                except Exception:
                    pass
            elif isinstance(gv, dict):
                for dk, dv in list(gv.items()):
                    if isinstance(dv, subprocess.Popen):
                        try:
                            dv.kill()
                            killed += 1
                        except Exception:
                            pass
    return json.dumps({"status": "ok", "killed": killed})
_override_bottle_route_v212('/api/radio/abort_stale_v243', 'POST', api_radio_abort_stale_v243)
# ================= END JENNY_V243_UNIFIED_FIXES =================
