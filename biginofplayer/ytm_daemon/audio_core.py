import os
import subprocess
import time
import datetime
import re
import sqlite3
import json
import urllib.request
from Crypto.Cipher import AES
from Crypto.Util import Counter
import config 

try:
    import blackboxprotobuf
except ImportError:
    blackboxprotobuf = None

try:
    import base64
    from mutagen.mp4 import MP4, MP4Cover
    from mutagen.oggopus import OggOpus
    from mutagen.flac import Picture
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False

def load_history(filepath):
    history = set()
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    history.add(line.split(" | ")[0].strip())
    return history

def dprint(msg, write_log=True):
    out = f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}"
    #print(out)
    if write_log:
        with open(config.LOG_FILE, "a", encoding="utf-8") as f_log:
            f_log.write(out + "\n")
            f_log.flush()

def forget_files(filenames):
    changed = False
    for f in filenames:
        if f in config.saved_files: config.saved_files.discard(f); changed = True
        if f in config.ignored_files: config.ignored_files.discard(f); changed = True
            
    if changed:
        if os.path.exists(config.SAVED_FILE):
            valid = [line for line in open(config.SAVED_FILE) if line.split(" | ")[0].strip() not in filenames]
            with open(config.SAVED_FILE, "w", encoding="utf-8") as f: f.writelines(valid)
        if os.path.exists(config.IGNORED_FILE):
            valid = [line for line in open(config.IGNORED_FILE) if line.strip() not in filenames]
            with open(config.IGNORED_FILE, "w", encoding="utf-8") as f: f.writelines(valid)
        dprint("🧹 История очищена: трек пойдет на пересборку с чистого листа.", write_log=False)

def download_cover(video_id, out_path):
    headers = {'User-Agent': 'Mozilla/5.0'}
    for res in ['maxresdefault', 'hqdefault', 'mqdefault']:
        try:
            req = urllib.request.Request(f"https://i.ytimg.com/vi/{video_id}/{res}.jpg", headers=headers)
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    data = resp.read()
                    if len(data) > 2000:
                        with open(out_path, 'wb') as f: f.write(data)
                        return True
        except: continue
    return False

def apply_tags_and_cover(filepath, ext, title, artist, album, cover_path=None):
    if not MUTAGEN_AVAILABLE: return False
    try:
        if ext == "m4a":
            audio = MP4(filepath)
            audio['\xa9nam'], audio['\xa9ART'], audio['\xa9alb'] = [title], [artist], [album]
            if cover_path and os.path.exists(cover_path):
                with open(cover_path, 'rb') as f_img:
                    audio['covr'] = [MP4Cover(f_img.read(), imageformat=MP4Cover.FORMAT_JPEG)]
            audio.save()
            return True
        elif ext == "opus":
            audio = OggOpus(filepath)
            audio['title'], audio['artist'], audio['album'] = [title], [artist], [album]
            if cover_path and os.path.exists(cover_path):
                pic = Picture()
                with open(cover_path, 'rb') as f_img: pic.data = f_img.read()
                pic.type, pic.mime, pic.desc = 3, 'image/jpeg', 'Cover'
                audio['metadata_block_picture'] = [base64.b64encode(pic.write()).decode('ascii')]
            audio.save()
            return True
    except Exception as e:
        dprint(f"⚠️ Ошибка mutagen: {e}", write_log=False)
    return False

def get_track_metadata(total_size):
    if not blackboxprotobuf: return None, None, None
    try:
        db_path = os.path.join(config.DIR, "offline_temp.db")
        os.system(f"rish -c 'run-as app.morphe.android.apps.youtube.music cat databases/offline.S1ERuS6soTjENNDyc6iFUQ.db' > {db_path}")
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT video_id, bytes_transferred FROM streams")
        rows = cursor.fetchall()
        
        best_match = None
        min_diff = float('inf')
        
        for row in rows:
            vid, db_size = row[0], row[1]
            if db_size is None: continue
            diff = abs(db_size - total_size)
            if diff < 5120 and diff < min_diff:  
                min_diff = diff
                best_match = vid
                
        if not best_match: return None, None, None
        video_id = best_match
        
        cursor.execute("SELECT offline_video_data_proto FROM videosV2 WHERE id = ?", (video_id,))
        blob_result = cursor.fetchone()
        
        if blob_result and blob_result[0]:
            message, _ = blackboxprotobuf.decode_message(blob_result[0])
            title = message.get('4', b'Unknown Title').decode('utf-8', errors='ignore') if isinstance(message.get('4'), bytes) else 'Unknown Title'
            artist = 'Unknown Artist'
            if '14' in message and isinstance(message['14'], dict):
                for k, v in message['14'].items():
                    if isinstance(v, dict) and '3' in v and isinstance(v['3'], bytes):
                        artist = v['3'].decode('utf-8', errors='ignore')
                        break
            return video_id, artist, title
    except Exception as e:
        dprint(f"⚠️ Ошибка БД: {e}")
    finally:
        if 'conn' in locals(): conn.close()
    return None, None, None

def scan_directory(target_dir):
    cmd = f"rish -c 'find \"{target_dir}\" -type f -name \"*.exo\" -exec stat -c \"%s %Y %n\" {{}} \\; 2>/dev/null'"
    try:
        paths_str = subprocess.check_output(cmd, shell=True).decode('utf-8').strip()
    except:
        return {}

    streams = {}
    for p_line in paths_str.split('\n'):
        if not p_line.strip(): continue
        parts = p_line.split(' ', 2)
        if len(parts) == 3:
            size, mtime, filepath = int(parts[0]), int(parts[1]), parts[2].strip()
            filename = os.path.basename(filepath)
            match = config.EXO_PATTERN.match(filename)
            if match:
                s_id, offset = match.group(1), int(match.group(2))
                if s_id not in streams:
                    streams[s_id] = {'total_size': 0, 'max_mtime': 0, 'chunks': []}
                streams[s_id]['total_size'] += size
                streams[s_id]['max_mtime'] = max(streams[s_id]['max_mtime'], mtime)
                streams[s_id]['chunks'].append({'offset': offset, 'path': filepath, 'filename': filename})
    return streams

def process_audio_stream(stream_id, data):
    if not os.path.exists(config.RAW_LOG_FILE):
        os.system(f"rish -c 'logcat -s EXO_KEY_DUMP EXO_NONCE_DUMP' >> {config.RAW_LOG_FILE} &")
        time.sleep(1)
        
    try:
        with open(config.RAW_LOG_FILE, "r", encoding="utf-8") as raw_f: raw_data = raw_f.read()
        keys_raw = re.findall(r"EXO_KEY_DUMP:\s*(\[[^\]]+\])", raw_data)
        nonces_raw = re.findall(r"EXO_NONCE_DUMP:\s*(-?\d+)", raw_data)
        
        if not keys_raw or not nonces_raw:
            dprint(f"⏳ Нужных ключей пока нет в RAW-логе для [{stream_id}].")
            return False
            
        unique_keys_str = list(dict.fromkeys(reversed(keys_raw)))[:3]
        parsed_keys = [bytes(x % 256 for x in eval(k)) for k in unique_keys_str]
        unique_nonces = list(dict.fromkeys(reversed(nonces_raw)))[:20]
    except Exception as e:
        dprint(f"❌ Ошибка чтения RAW: {e}")
        return False

    temp_merged = os.path.join(config.DIR, f"merged_stream_{stream_id}.exo")
    sorted_chunks = sorted(data['chunks'], key=lambda x: x['offset'])
    
    try:
        open(temp_merged, "wb").close()
        with open(temp_merged, "r+b") as f_m:
            for chunk in sorted_chunks:
                temp_c_path = os.path.join(config.DIR, f"temp_{chunk['filename']}")
                os.system(f"rish -c 'cp \"{chunk['path']}\" \"{temp_c_path}\"'")
                with open(temp_c_path, "rb") as f_c:
                    f_m.seek(chunk['offset'])
                    while chunk_data := f_c.read(65536): f_m.write(chunk_data)
                os.remove(temp_c_path)
            
        dprint(f"🧩 Монолит ({stream_id}) собран! Примеряю ключи...")
        correct_nonce, correct_key = None, None
        
        for TEST_KEY in parsed_keys:
            for test_nonce in unique_nonces:
                NONCE = int(test_nonce)
                initial_ctr = (NONCE & 0xFFFFFFFFFFFFFFFF) << 64
                ctr = Counter.new(128, initial_value=initial_ctr)
                cipher = AES.new(TEST_KEY, AES.MODE_CTR, counter=ctr)
                
                with open(temp_merged, "rb") as f_in:
                    head_enc = f_in.read(1000)
                    head_dec = cipher.decrypt(head_enc)
                    if b'ftyp' in head_dec or b'webm' in head_dec or b'matroska' in head_dec or b'mp4' in head_dec:
                        correct_nonce, correct_key = test_nonce, TEST_KEY
                        break 
            if correct_nonce: break 

        if correct_nonce:
            ext = "opus" if b'webm' in head_dec or b'matroska' in head_dec else "m4a"
            dprint(f"🔓 Ключ подошел! Формат: {ext.upper()}. Ищу метаданные...")
            
            f_in = open(temp_merged, "rb")
            initial_ctr = (int(correct_nonce) & 0xFFFFFFFFFFFFFFFF) << 64
            cipher = AES.new(correct_key, AES.MODE_CTR, counter=Counter.new(128, initial_value=initial_ctr))
            
            raw_file_out = os.path.join(config.DIR, f"raw_{stream_id}_{int(time.time())}.raw")
            with open(raw_file_out, "wb") as f_out:
                while chunk_enc := f_in.read(65536): f_out.write(cipher.decrypt(chunk_enc))
            f_in.close()
            
            video_id, artist, title = get_track_metadata(data['total_size'])
            
            if not video_id:
                video_id = stream_id 
                artist = 'Unknown Artist'
                title = f"Unknown_{stream_id}"
                
            elif artist == 'Unknown Artist' or artist is None or title == 'Unknown Title':
                dprint(f"⚠️ Фолбек на yt-dlp для ID [{video_id}]...")
                try:
                    ytd_cmd = f'yt-dlp --dump-json --no-warnings "https://music.youtube.com/watch?v={video_id}"'
                    ytd_out = subprocess.check_output(ytd_cmd, shell=True, stderr=subprocess.DEVNULL).decode('utf-8')
                    info = json.loads(ytd_out)
                    if info.get('track') or info.get('title'): title = info.get('track') or info.get('title')
                    if info.get('artist') or info.get('uploader'):
                        yt_artist = info.get('artist') or info.get('uploader')
                        artist = yt_artist[:-8] if yt_artist.endswith(' - Topic') else yt_artist
                    dprint(f"🌐 yt-dlp спас: {artist} - {title}")
                except Exception:
                    dprint(f"❌ yt-dlp не смог. Оставляем базу.")

            safe_name = re.sub(r'[\\/*?:"<>|]', '_', f"{artist} - {title}")
            final_out = os.path.join(config.DIR, f"{safe_name}.{ext}")
            thumb_path = os.path.join(config.DIR, f"temp_cover_{video_id}.jpg")
            has_cover = download_cover(video_id, thumb_path)
            
            safe_art, safe_tit, safe_alb = artist.replace('"', '\\"'), title.replace('"', '\\"'), config.ALBUM_SIGNATURE.replace('"', '\\"')
            
            if has_cover and ext == "m4a" and not MUTAGEN_AVAILABLE:
                ff_cmd = f'ffmpeg -y -i "{raw_file_out}" -i "{thumb_path}" -map 0:a -map 1:v -c:a copy -c:v copy -disposition:v:0 attached_pic -metadata title="{safe_tit}" -metadata artist="{safe_art}" -metadata album="{safe_alb}" "{final_out}" < /dev/null 2>/dev/null'
            else:
                ff_cmd = f'ffmpeg -y -i "{raw_file_out}" -c copy -metadata title="{safe_tit}" -metadata artist="{safe_art}" -metadata album="{safe_alb}" "{final_out}" < /dev/null 2>/dev/null'
            
            os.system(ff_cmd)
            
            if os.path.exists(final_out) and os.path.getsize(final_out) > 0:
                os.remove(raw_file_out)
                if MUTAGEN_AVAILABLE:
                    apply_tags_and_cover(final_out, ext, title, artist, config.ALBUM_SIGNATURE, thumb_path if has_cover else None)
                dprint(f"✨ Сохранено: {safe_name}.{ext}")
            else:
                os.rename(raw_file_out, final_out)
            
            # --- ИЗМЕНЕНО: СОХРАНЯЕМ СПИСОК ФАЙЛОВ EXO ВМЕСТО ID ---
            final_filename = f"{safe_name}.{ext}"
            config.session_tracks.append(final_filename)
            
            exo_chunks = [chunk['filename'] for chunk in data['chunks']]
            config.track_mapping[final_filename] = exo_chunks
            
            try:
                with open(config.TRACK_MAP_FILE, "w", encoding="utf-8") as f_map:
                    json.dump(config.track_mapping, f_map, ensure_ascii=False)
            except Exception as e:
                dprint(f"⚠️ Ошибка сохранения реестра: {e}", write_log=False)
            # ---------------------------------------------------------
                
            if os.path.exists(thumb_path): os.remove(thumb_path)
            
            with open(config.SAVED_FILE, "a", encoding="utf-8") as f_sav:
                for chunk in data['chunks']:
                    f_sav.write(f"{chunk['filename']} | Nonce: {correct_nonce}\n")
                    config.saved_files.add(chunk['filename'])
            return True
                    
        if not correct_nonce:
            dprint(f"🗑️ Ключ не найден. Игнор: {stream_id}")
            with open(config.IGNORED_FILE, "a", encoding="utf-8") as f_ign:
                for chunk in data['chunks']:
                    f_ign.write(f"{chunk['filename']}\n")
                    config.ignored_files.add(chunk['filename'])
            return False
            
    except Exception as e:
        dprint(f"❌ Ошибка {stream_id}: {e}")
    finally:
        if os.path.exists(temp_merged): os.remove(temp_merged)
    return False
