import os
import json
import threading
import time
from bottle import route, run, post, response, static_file, request
import sys
import shutil
import subprocess
import time
import config
from audio_core import load_history, scan_directory, forget_files, process_audio_stream, dprint
from daemon import daemon_worker

def start_adb_keepalive():
    source_file = "/storage/emulated/0/scripts/ytm_daemon/keep_adb_alive.sh"
    dest_file = os.path.expanduser("~/keep_adb_alive.sh")

    if not os.path.exists(source_file):
        dprint(f"⚠️ (SYSTEM) Ошибка: файл {source_file} не найден. Удержание ADB отменено.")
        return

    try:
        shutil.copy2(source_file, dest_file)
        os.chmod(dest_file, 0o755)
        
        subprocess.Popen(["bash", dest_file], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        dprint("🛡️ (SYSTEM) Скрипт удержания отладки (ADB) запущен в фоне.")
    except Exception as e:
        dprint(f"⚠️ (SYSTEM) Ошибка при запуске keep_adb_alive: {e}")

@route('/')
def index():
    with open('index.html', 'r', encoding='utf-8') as f:
        return f.read()

# =========================================================================
# 🚀 УМНЫЙ РОУТ ДЛЯ РАЗДАЧИ ВСЕХ СТАТИЧЕСКИХ ФАЙЛОВ (JS, CSS)
# =========================================================================
@route('/<filename:re:.*\\.(js|css)>')
def serve_static(filename):
    return static_file(filename, root='.')

@route('/api/media/<filename:path>')
def serve_media(filename):
    client_ip = request.remote_addr
    range_header = request.headers.get('Range', 'Целиком')
    dprint(f"📡 (SERVER) Запрос трека: {filename} | Range: {range_header}", write_log=False)
    
    start_time = time.time()
    res = static_file(filename, root=config.DIR)
    delay = time.time() - start_time
    
    dprint(f"⚡ (SERVER) Файл подхвачен за {delay:.4f} сек", write_log=False)
    return res

@route('/api/log', method='POST')
def log_from_ui():
    try:
        data = json.loads(request.body.read().decode('utf-8'))
        msg = data.get('msg', '')
        if msg:
            dprint(f"🖥️ (UI) {msg}")
    except:
        pass
    return {"status": "ok"}

@route('/api/data')
def get_data():
    logs = []
    if os.path.exists(config.LOG_FILE):
        with open(config.LOG_FILE, 'r', encoding='utf-8') as f:
            logs = f.readlines()[-5000:] 
            
    all_tracks = []
    if os.path.exists(config.DIR):
        for f in os.listdir(config.DIR):
            if f.endswith(('.opus', '.m4a', '.mp3')) and os.path.isfile(os.path.join(config.DIR, f)):
                all_tracks.append(f)
    all_tracks.sort(key=lambda x: os.path.getmtime(os.path.join(config.DIR, x)), reverse=True)
        
    response.content_type = 'application/json'
    return json.dumps({
        "timer": config.DAEMON_WAIT_SECS,
        "logs": [l.strip() for l in logs],
        "streams": config.cached_streams_out, 
        "session_tracks": list(reversed(config.session_tracks)),
        "all_tracks": all_tracks,
        "track_mapping": config.track_mapping
    })

@route('/api/force/<action>/<stream_id>', method='POST')
def force_action(action, stream_id):
    streams_raw = scan_directory(config.YTM_DATA_DIR)
    if stream_id in streams_raw:
        data = streams_raw[stream_id]
        if action == 'process':
            dprint(f"🚀 (WEB) Принудительная сборка [{stream_id}]...")
            forget_files([c['filename'] for c in data['chunks']])
            threading.Thread(target=process_audio_stream, args=(stream_id, data)).start()
        elif action == 'ignore':
            dprint(f"🗑️ (WEB) Помещено в игнор [{stream_id}]")
            with open(config.IGNORED_FILE, "a", encoding="utf-8") as f_ign:
                for chunk in data['chunks']:
                    f_ign.write(f"{chunk['filename']}\n")
                    config.ignored_files.add(chunk['filename'])
    return {"status": "ok"}

@route('/api/timer/<val>', method='POST')
def set_timer(val):
    try:
        config.DAEMON_WAIT_SECS = int(val)
        dprint(f"⚙️ (WEB) Таймер изменен на {config.DAEMON_WAIT_SECS} сек.")
    except Exception as e:
        pass
    return {"status": "ok"}

# =========================================================================
# 💾 API БЭКАПОВ (ТОЧЕЧНОЕ И ПОЛНОЕ СОХРАНЕНИЕ)
# =========================================================================
@route('/api/config', method='GET')
def get_config():
    backup_path = os.path.join(config.DIR, 'jenny_dsp_preset.json')
    if os.path.exists(backup_path):
        with open(backup_path, 'r', encoding='utf-8') as f:
            return f.read()
    return "{}"

@route('/api/config/save_all', method='POST')
def save_config_all():
    try:
        data = json.loads(request.body.read().decode('utf-8'))
        backup_path = os.path.join(config.DIR, 'jenny_dsp_preset.json')
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error"}

@route('/api/config/save_single', method='POST')
def save_config_single():
    try:
        req = json.loads(request.body.read().decode('utf-8'))
        cat = req.get('category')
        key = req.get('key')
        val = req.get('value')
        
        backup_path = os.path.join(config.DIR, 'jenny_dsp_preset.json')
        data = {}
        if os.path.exists(backup_path):
            with open(backup_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        
        if cat not in data: data[cat] = {}
        data[cat][key] = val
        
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error"}


DIR = "/storage/emulated/0/Music/"
# --- 1. ЭНДПОИНТ ДЛЯ ХИРУРГИЧЕСКОЙ РАСТЯЖКИ (ХОД ПИТОНА) ---
@post('/api/stretch')
def stretch_track():
    try:
        filename = request.forms.get('filename')
        speed = float(request.forms.get('speed', 1.0))
        
        # Берем оригинальный файл
        original_path = os.path.join(DIR, filename)
        # Имя для временного сырого WAV
        temp_stretched = os.path.join(DIR, f"temp_stretcher_{filename}.wav")
        
        # ffmpeg меняет время без изменения тональности (atempo)
        cmd = ['ffmpeg', '-y', '-i', original_path, '-filter:a', f'atempo={speed}', temp_stretched]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Отдаем браузеру этот WAV файл
        return static_file(f"temp_stretcher_{filename}.wav", root=DIR)
        
    except Exception as e:
        response.status = 500
        return {"error": str(e)}

# --- 2. ЭНДПОИНТ ДЛЯ ФИНАЛЬНОГО ЭКСПОРТА В OPUS ---
@post('/api/export')
def export_track():
    try:
        original_name = request.forms.get('filename')
        speed = request.forms.get('speed')
        is_reversed = request.forms.get('is_reversed') == 'true'
        pitch_lock = request.forms.get('pitch_lock') == 'true'
        
        upload = request.files.get('audio_data')

        if not upload or not original_name:
            response.status = 400
            return {"error": "Нет файла"}

        base_name, _ = os.path.splitext(original_name)
        speed_float = float(speed)
        
        speed_suffix = f"_x{speed}" if speed_float != 1.0 else ""
        rev_suffix = "_rev" if is_reversed else ""
        pitch_suffix = "_pitchLock" if pitch_lock else "_vinyl"
        
        slow_fast = ""
        if speed_float < 1.0:
            slow_fast = "_slow"
        elif speed_float > 1.0:
            slow_fast = "_fast"
            
        new_filename = f"{base_name}{speed_suffix}{rev_suffix}{slow_fast}{pitch_suffix}.opus"
        
        temp_wav = os.path.join(DIR, f"temp_final_{new_filename}.wav")
        final_opus = os.path.join(DIR, new_filename)

        # Сохраняем "мокрый" WAV с эффектами из браузера
        upload.save(temp_wav, overwrite=True)

        # Пакуем в Opus
        cmd = ['ffmpeg', '-y', '-i', temp_wav, '-c:a', 'libopus', '-b:a', '128k', final_opus]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        return {"status": "ok", "new_file": new_filename}

    except Exception as e:
        response.status = 500
        return {"error": str(e)}

def prepare_clean_environment():
    print("🧹 [CLEANUP] Уничтожаем кэш YTM и старые логи демона...")

    # 1. Глушим YTM принудительно
    os.system('rish -c "am force-stop app.morphe.android.apps.youtube.music"')
    time.sleep(1) 

    # 2. Выжигаем SQLite базы скачанных треков
    os.system('rish -c "run-as app.morphe.android.apps.youtube.music sh -c \'rm -f databases/offline.*\'"')

    # 3. Вычищаем физические куски аудио (папка streams)
    streams_path = "/storage/emulated/0/Android/data/app.morphe.android.apps.youtube.music/files/offline/*/streams/*"
    os.system(f'rish -c "sh -c \'rm -rf {streams_path}\'"')

    # 4. Удаляем временные файлы из папки Music
    music_path = "/storage/emulated/0/Music"
    os.system(f'rm -f "{music_path}/daemon_raw.txt"')
    os.system(f'rm -f "{music_path}/saved.txt"')
    os.system(f'rm -f "{music_path}/offline_temp.db"')
    os.system(f'rm -f "{music_path}/ignored.txt"')

    print("✨ [CLEANUP] Территория зачищена! Сервер готов к перехвату.")

prepare_clean_environment()

# =========================================================================
# 🧹 ПОСЛЕДОВАТЕЛЬНЫЙ ЗАПУСК ОЧИСТКИ КЭША ЧЕРЕЗ TERMUX HOME
# =========================================================================
def execute_clear_cache_sync():
    source_script = "/storage/emulated/0/scripts/ytm_daemon/clear_chrome.sh"
    dest_script = os.path.expanduser("~/clear_chrome.sh")
    
    if os.path.exists(source_script):
        dprint("🧹 (SYSTEM) Копирование clear_chrome.sh в память Termux...")
        try:
            shutil.copy2(source_script, dest_script)
            os.chmod(dest_script, 0o755)
            dprint("🖱️ (SYSTEM) Выполнение прокликивания интерфейса...")
            subprocess.run(["bash", dest_script], check=True)
            dprint("✨ (SYSTEM) Кэш уничтожен, Chrome запущен!")
        except Exception as e:
            dprint(f"❌ (SYSTEM) Ошибка при выполнении скрипта очистки: {e}")
    else:
        dprint(f"⚠️ (SYSTEM) Скрипт {source_script} не найден.")

if __name__ == "__main__":
    config.saved_files = load_history(config.SAVED_FILE)
    config.ignored_files = load_history(config.IGNORED_FILE)
    config.old_saved_files = config.saved_files.copy()
    config.old_ignored_files = config.ignored_files.copy()
    
    if os.path.exists(config.TRACK_MAP_FILE):
        try:
            with open(config.TRACK_MAP_FILE, "r", encoding="utf-8") as f_map:
                config.track_mapping = json.load(f_map)
        except: pass

    open(config.RAW_LOG_FILE, 'w').close()
    
    with open(config.LOG_FILE, 'a', encoding='utf-8') as f:
        f.write("\n" + "—"*35 + "\n")
        f.write("🔄 НОВАЯ СЕССИЯ ДЕМОНА\n")
        f.write("—"*35 + "\n")

    os.system(f"rish -c 'logcat -s EXO_KEY_DUMP EXO_NONCE_DUMP' >> {config.RAW_LOG_FILE} &")
    start_adb_keepalive()
    dprint("🎧 МОДУЛЬНЫЙ WEB-ДЕМОН ЗАПУЩЕН И ГОТОВ К РАБОТЕ!")
    
    t = threading.Thread(target=daemon_worker, daemon=True)
    t.start()
    
    execute_clear_cache_sync()
    
    run(host='127.0.0.1', port=8080, quiet=True, server='waitress')
