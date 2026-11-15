#!/usr/bin/env bash
# Пересобрать модули из исходных ui_v71.js и ui_help.js (коммит 9ae6639) и проверить результат.
# Запуск: cd tools/split_v71 && npm install && bash run_all.sh [ui_v71.js|ui_help.js]
# Без аргумента обрабатываются оба файла.
set -e
cd "$(dirname "$0")"
REPO="$(git rev-parse --show-toplevel)"
BASE="${BASE_COMMIT:-9ae6639}"
PYDIR="app/src/main/python"
ORDER="engine_audio.js engine_video_deck_b.js engine_heads.js engine_fav.js ui_init.js ui_config.js ui_render.js ui_playback.js ui_scrub_engine.js ui_touch_arc.js ui_controls.js ui_export.js ui_help.js ui_v71.js jenny_deck_b_modals.js"
TARGETS="${1:-ui_v71.js ui_help.js}"

rm -rf orig && mkdir -p orig
for f in $ORDER; do git -C "$REPO" show "$BASE:$PYDIR/$f" > "orig/$f"; done
node an2.js orig > /dev/null      # разбор всех файлов -> out2.json
node dups.js > /dev/null          # повторные определения -> dups.json, allwrites.json

for T in $TARGETS; do
  export TARGET="$T"
  OUT="out_${T%.js}"
  echo "================ $T -> $OUT/"
  rm -rf "$OUT" newtree && mkdir -p "$OUT" newtree
  node split.js "$OUT"            # нарезка -> $OUT/ui_*.js + $OUT/_manifest.json
  for f in "$OUT"/ui_*.js; do node --check "$f"; done
  ( cd "$OUT" && cat $(node -e 'console.log(require("./_manifest.json").join(" "))') ) > bundle_new.js
  node --check bundle_new.js
  cp orig/*.js newtree/ && cp bundle_new.js "newtree/$T"
  node an2.js newtree out2_new.json > /dev/null
  echo "--- статическая сверка порядка определений"; node verify.js
  echo "--- полнота (ни один блок не потерян)";      node complete.js | head -1
  echo "--- прогон в Node с заглушкой браузера (элементов нет)"; node dyn.js null | tail -9
  echo "--- прогон в Node с заглушкой браузера (элементы есть)"; node dyn.js stub | tail -9
done
echo
echo "Готово. Чтобы применить: cp out_*/ui_*.js \"$REPO/$PYDIR/\" и сверить списки JENNY_BUNDLE_STUDIO / JENNY_BUNDLE_PLAYER в player.py с out_*/_manifest.json"
