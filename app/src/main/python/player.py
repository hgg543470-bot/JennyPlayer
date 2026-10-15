import os
import json
import subprocess
from bottle import route, run, post, response, static_file, request

MUSIC_DIR = "/storage/emulated/0/Music/"
PRESET_FILE = os.path.join(MUSIC_DIR, "jenny_dsp_preset.json")

@route('/')
def index():
    with open('index.html', 'r', encoding='utf-8') as f:
        return f.read()

@route('/<filename:re:.*\\.(js|css)>')
def serve_static(filename):
    return static_file(filename, root='.')

@route('/api/media/<filename:path>')
def serve_media(filename):
    return static_file(filename, root=MUSIC_DIR)

@route('/api/data')
def get_data():
    all_tracks = []
    if os.path.exists(MUSIC_DIR):
        for f in os.listdir(MUSIC_DIR):
            if f.endswith(('.opus', '.m4a', '.mp3')) and os.path.isfile(os.path.join(MUSIC_DIR, f)):
                all_tracks.append(f)
    all_tracks.sort(key=lambda x: os.path.getmtime(os.path.join(MUSIC_DIR, x)), reverse=True)
    
    response.content_type = 'application/json'
    return json.dumps({ "all_tracks": all_tracks, "session_tracks": all_tracks })

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
        
        if cat not in data: data[cat] = {}
        data[cat][key] = val
        
        with open(PRESET_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        return {"status": "ok"}
    except Exception:
        return {"status": "error"}

@post('/api/stretch')
def stretch_track():
    try:
        filename = request.forms.get('filename')
        speed = float(request.forms.get('speed', 1.0))
        original_path = os.path.join(MUSIC_DIR, filename)
        temp_stretched = os.path.join(MUSIC_DIR, f"temp_stretcher_{filename}.wav")
        cmd = ['ffmpeg', '-y', '-i', original_path, '-filter:a', f'atempo={speed}', temp_stretched]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return static_file(f"temp_stretcher_{filename}.wav", root=MUSIC_DIR)
    except Exception as e:
        response.status = 500
        return {"error": str(e)}

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
        slow_fast = "_slow" if speed_float < 1.0 else ("_fast" if speed_float > 1.0 else "")
            
        new_filename = f"{base_name}{speed_suffix}{rev_suffix}{slow_fast}{pitch_suffix}.opus"
        temp_wav = os.path.join(MUSIC_DIR, f"temp_final_{new_filename}.wav")
        final_opus = os.path.join(MUSIC_DIR, new_filename)

        upload.save(temp_wav, overwrite=True)
        cmd = ['ffmpeg', '-y', '-i', temp_wav, '-c:a', 'libopus', '-b:a', '128k', final_opus]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        if os.path.exists(temp_wav):
            try: os.remove(temp_wav)
            except: pass

        return {"status": "ok", "new_file": new_filename}
    except Exception as e:
        response.status = 500
        return {"error": str(e)}

def start_server():
    print("🎧 АВТОНОМНЫЙ ПЛЕЕР ЗАПУЩЕН НА ПОРТУ 8080")
    run(host='127.0.0.1', port=8080, quiet=True, server='waitress')

if __name__ == "__main__":
    start_server()
