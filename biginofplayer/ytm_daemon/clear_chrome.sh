#!/usr/bin/env bash

# 1. Убиваем Chrome (полный путь + Shizuku)
rish /system/bin/am force-stop com.android.chrome

# 2. Открываем окно свойств (полный путь + Shizuku)
rish /system/bin/am start -a android.settings.APPLICATION_DETAILS_SETTINGS -d package:com.android.chrome --activity-no-history --activity-exclude-from-recents > /dev/null 2>&1

# 3. Пауза на отрисовку интерфейса
sleep 0.8

# 4. Клики (полный путь + Shizuku)
rish /system/bin/input tap 1128 2567
rish /system/bin/input tap 762 2358
rish /system/bin/input tap 874 2530

# 5. Запуск Chrome (полный путь + Shizuku)
rish /system/bin/am start -a android.intent.action.VIEW -d "http://127.0.0.1:8080" > /dev/null 2>&1
