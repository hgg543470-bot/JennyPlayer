#!/data/data/com.termux/files/usr/bin/bash
set -e
BASE_DIR="/storage/emulated/0/scripts/JennyPlayer"
SRC="$BASE_DIR/native_src_backup/jenny_vcore.cpp"
OUT_SO="$BASE_DIR/app/src/main/jniLibs/arm64-v8a/libjenny_vcore.so"

CXX_BIN=$(command -v clang++ || command -v aarch64-linux-android-clang++ || command -v g++)
echo "[BUILD] Компиляция $SRC через $CXX_BIN..."
"$CXX_BIN" -O3 -fPIC -shared -march=armv8-a+simd "$SRC" -lm -o "$OUT_SO"
chmod 755 "$OUT_SO"
rm -f "$BASE_DIR/app/src/main/python/libjenny_vcore.so" "$BASE_DIR/app/src/main/python/jenny_vcore.cpp"
ls -lh "$OUT_SO"
echo "[OK] libjenny_vcore.so (V206 5-Step NEON) успешно собрана в jniLibs/arm64-v8a!"
