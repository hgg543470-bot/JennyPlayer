import os
import shutil
import subprocess

# Указываем пути
source_script = '/storage/emulated/0/scripts/ytm_daemon/clear_chrome.sh'
termux_home = os.path.expanduser('~')
target_script = os.path.join(termux_home, 'clear_chrome.sh')

# 1. Копируем файл из внутренней памяти в дом Термукса
try:
    shutil.copy2(source_script, target_script)
    print("Скрипт успешно скопирован.")
except FileNotFoundError:
    print(f"Ошибка: Файл {source_script} не найден!")
    exit(1)

# 2. Возвращаем права на исполнение (аналог chmod +x)
# 0o755 означает rwxr-xr-x
os.chmod(target_script, 0o755)

# 3. Запускаем скрипт
print("Запускаю очистку кэша Chrome...")
subprocess.run([target_script])

# --- ДАЛЬШЕ ИДЕТ ТВОЙ КОД ЗАПУСКА BOTTLE ---
print("Поднимаю сервер Bottle...")
# run(host='localhost', port=8080)
