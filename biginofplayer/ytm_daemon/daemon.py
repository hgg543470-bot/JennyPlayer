import time
import config
from audio_core import scan_directory, process_audio_stream, dprint

def daemon_worker():
    streams = {}
    while True:
        time.sleep(1)
        current_streams = scan_directory(config.YTM_DATA_DIR)
        
        # Подготавливаем данные для веб-интерфейса
        temp_streams_out = {}
        
        for stream_id, data in current_streams.items():
            sample_file = data['chunks'][0]['filename']
            
            # Для интерфейса собираем список ВСЕХ активных потоков, кроме старых
            if sample_file not in config.old_saved_files and sample_file not in config.old_ignored_files:
                temp_streams_out[stream_id] = {
                    'total_size': data['total_size'],
                    'saved': sample_file in config.saved_files,
                    'ignored': sample_file in config.ignored_files,
                    'chunks': [c['filename'] for c in data['chunks']]
                }
            
            # Логика сборщика
            if sample_file in config.saved_files or sample_file in config.ignored_files: continue
            
            if stream_id not in streams:
                streams[stream_id] = {'total_size': data['total_size'], 'max_mtime': data['max_mtime'], 'stable_count': 0, 'processed': False}
                dprint(f"👀 Засекли поток [{stream_id}] (Кусков: {len(data['chunks'])})")
            else:
                state = streams[stream_id]
                if state['processed']: continue
                
                if data['total_size'] > state['total_size'] or data['max_mtime'] > state['max_mtime']:
                    state['total_size'], state['max_mtime'], state['stable_count'] = data['total_size'], data['max_mtime'], 0
                elif data['total_size'] == state['total_size'] and data['total_size'] > 0:
                    state['stable_count'] += 1
                    
                    if state['stable_count'] >= config.DAEMON_WAIT_SECS:
                        state['processed'] = True
                        dprint(f"🛑 Загрузка [{stream_id}] завершена. Авто-сборка...")
                        process_audio_stream(stream_id, data)
                        
        # Обновляем глобальный кеш для мгновенной отдачи веб-сервером
        config.cached_streams_out = temp_streams_out

