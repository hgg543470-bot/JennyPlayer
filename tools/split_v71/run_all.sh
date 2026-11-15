#!/usr/bin/env bash
# Пересобрать модули из исходного ui_v71.js (коммит 9ae6639) и проверить результат.
# Запуск: cd tools/split_v71 && npm install && bash run_all.sh
set -e
cd "$(dirname "$0")"
REPO="$(git rev-parse --show-toplevel)"
BASE="${BASE_COMMIT:-9ae6639}"
PYDIR="app/src/main/python"
ORDER="engine_audio.js engine_video_deck_b.js engine_heads.js engine_fav.js ui_init.js ui_config.js ui_render.js ui_playback.js ui_scrub_engine.js ui_touch_arc.js ui_controls.js ui_export.js ui_help.js ui_v71.js jenny_deck_b_modals.js"

rm -rf orig out newtree && mkdir -p orig out newtree
for f in $ORDER; do git -C "$REPO" show "$BASE:$PYDIR/$f" > "orig/$f"; done

node an2.js orig                 # разбор всех файлов -> out2.json
node dups.js > /dev/null         # повторные определения -> dups.json, allwrites.json
node split.js out                # нарезка -> out/ui_*.js + out/_manifest.json

for f in out/ui_*.js; do node --check "$f"; done
( cd out && cat $(node -e 'console.log(require("./_manifest.json").join(" "))') ) > bundle_new.js
node --check bundle_new.js

cp orig/*.js newtree/ && cp bundle_new.js newtree/ui_v71.js
node an2.js newtree out2_new.json > /dev/null
echo "--- статическая сверка порядка определений"; node verify.js
echo "--- полнота (ни один блок не потерян)";      node complete.js | head -1
echo "--- прогон в Node с заглушкой браузера (элементов нет)"; node dyn.js null | tail -11
echo "--- прогон в Node с заглушкой браузера (элементы есть)"; node dyn.js stub | tail -11
echo
echo "Готово. Модули лежат в tools/split_v71/out/. Чтобы применить: cp out/ui_*.js \"$REPO/$PYDIR/\""
