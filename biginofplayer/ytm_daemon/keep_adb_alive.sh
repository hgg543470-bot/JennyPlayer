#!/bin/bash

echo "Режим бессмертной отладки запущен. Для остановки нажми Ctrl+C."

while true; do
    # Проверяем текущее состояние
    STATUS=$(rish -c "settings get global adb_wifi_enabled")
    
    # Если система скинула значение в 0 (или null), врубаем обратно
    if [ "$STATUS" != "1" ]; then
        echo "Отладка отвалилась. Врубаю обратно намертво!"
        rish -c "settings put global adb_wifi_enabled 1"
    fi
    
    # Проверяем каждые 5 секунд (можешь изменить время)
    sleep 5
done
