import os
import shutil
import subprocess

source_file = "/storage/emulated/0/scripts/ytm_daemon/keep_adb_alive.sh"
dest_file = os.path.expanduser("~/keep_adb_alive.sh")

if not os.path.exists(source_file):
    print(f"Ошибка: файл {source_file} не найден. Проверь путь!")
    exit(1)

print("Копирую свежий keep_adb_alive.sh в Termux...")
shutil.copy2(source_file, dest_file)

print("Выдаю права на исполнение...")
os.chmod(dest_file, 0o755)

print("Запускаю скрипт удержания отладки...")
try:
    # Явно указываем bash как интерпретатор
    subprocess.run(["bash", dest_file])
except KeyboardInterrupt:
    print("\nСкрипт остановлен.")
