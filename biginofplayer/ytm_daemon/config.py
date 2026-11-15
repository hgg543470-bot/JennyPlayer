import os
import re

# --- НАСТРОЙКИ ПУТЕЙ ---
DIR = "/storage/emulated/0/Music/"
YTM_DATA_DIR = "/storage/emulated/0/Android/data/app.morphe.android.apps.youtube.music/files/offline"

# --- ФАЙЛЫ ДАННЫХ И ЛОГОВ ---
LOG_FILE = os.path.join(DIR, "daemon_smart.txt")
RAW_LOG_FILE = os.path.join(DIR, "daemon_raw.txt")
SAVED_FILE = os.path.join(DIR, "saved.txt")
IGNORED_FILE = os.path.join(DIR, "ignored.txt")
TRACK_MAP_FILE = os.path.join(DIR, "track_map.json")

# --- КОНСТАНТЫ ---
EXO_PATTERN = re.compile(r"^([^.]+)\.(\d+)\.\d+\.v\d+\.exo$")
ALBUM_SIGNATURE = "🅷🅰🅲🅺🅴🅳🐞🅱🆈 🅹🅴🅽🅽🆈"

# --- ГЛОБАЛЬНОЕ СОСТОЯНИЕ (STATE) ---
saved_files = set()
ignored_files = set()
old_saved_files = set()
old_ignored_files = set()
DAEMON_WAIT_SECS = 2
session_tracks = [] 
track_mapping = {}

# НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ АСИНХРОННОСТИ
cached_streams_out = {}
