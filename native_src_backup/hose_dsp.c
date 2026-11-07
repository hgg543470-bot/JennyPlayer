/*
 * JENNY PLAYER — ELASTIC HOSE WAVE ENGINE (C99 / WebAssembly / Native ARM64)
 * Физика змейки:
 *   Высокая амплитуда петли -> стягивается вертикаль (режется громкость, скорость держится у базы).
 *   Низкая амплитуда (плоский шланг) -> стягивается горизонталь (режется время / растёт скорость).
 */
#include <math.h>
#include <stdint.h>

typedef struct {
    float env_amp;
    float smooth_rate;
    float smooth_gain;
    float phase_offset;
} HoseState;

static HoseState g_hose = {0.0f, 1.0f, 1.0f, 0.0f};

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define EXPORT __attribute__((visibility("default")))
#endif

EXPORT void hose_reset(void) {
    g_hose.env_amp = 0.0f;
    g_hose.smooth_rate = 1.0f;
    g_hose.smooth_gain = 1.0f;
    g_hose.phase_offset = 0.0f;
}

/*
 * Принимает текущую пиковую/RMS амплитуду волны (0.0 .. 1.0),
 * целевую скорость трека (base * arc, например 1.5 или 0.9)
 * и натяжение шланга (0.2 .. 2.0).
 * Возвращает упакованную пару: [мгновенная_скорость, множитель_громкости].
 */
EXPORT float hose_compute_step(float inst_amp, float target_speed, float tension, float* out_gain) {
    if (inst_amp > g_hose.env_amp) {
        g_hose.env_amp = g_hose.env_amp * 0.82f + inst_amp * 0.18f;
    } else {
        g_hose.env_amp = g_hose.env_amp * 0.94f + inst_amp * 0.06f;
    }

    float norm_amp = g_hose.env_amp * 1.45f;
    if (norm_amp > 1.0f) norm_amp = 1.0f;
    if (norm_amp < 0.0f) norm_amp = 0.0f;

    /* Натяжение змейки работает даже около 1.0x за счёт собственной упругости tension */
    float effective_delta = (target_speed - 1.0f);
    if (fabsf(effective_delta) < 0.03f) {
        effective_delta = 0.12f * (tension - 0.2f);
    }

    /*
     * 1. ВЕРТИКАЛЬ (Амплитуда -> Громкость):
     * Чем выше петля (norm_amp -> 1), тем сильнее стягивание давит высоту петли вниз.
     */
    float target_gain = 1.0f;
    if (effective_delta >= 0.0f) {
        /* Стягивание шланга (короче и тише на пиках) */
        target_gain = 1.0f - (norm_amp * tension * (0.38f + fabsf(effective_delta) * 0.45f));
    } else {
        /* Растяжение шланга при замедлении (длиннее и громче на пиках) */
        target_gain = 1.0f + (norm_amp * tension * (0.28f + fabsf(effective_delta) * 0.40f));
    }
    if (target_gain < 0.22f) target_gain = 0.22f;
    if (target_gain > 1.65f) target_gain = 1.65f;

    /*
     * 2. ГОРИЗОНТАЛЬ (Плоский участок -> Скорость):
     * Когда амплитуда низкая (1.0 - norm_amp -> 1), шланг прямой — режется время (растёт скорость).
     * Когда амплитуда высокая (удар бочки/вокала), скорость притормаживает к родной, чтобы не шакалить атаку!
     */
    float flat_ratio = 1.0f - norm_amp; /* 1.0 на тишине, 0.0 на пике */
    float speed_swing = effective_delta * tension * (flat_ratio * 1.55f - norm_amp * 0.45f);
    float desired_rate = target_speed + speed_swing;

    if (desired_rate < 0.35f) desired_rate = 0.35f;
    if (desired_rate > 3.00f) desired_rate = 3.00f;

    g_hose.smooth_rate = g_hose.smooth_rate * 0.72f + desired_rate * 0.28f;
    g_hose.smooth_gain = g_hose.smooth_gain * 0.75f + target_gain * 0.25f;

    if (out_gain) *out_gain = g_hose.smooth_gain;
    return g_hose.smooth_rate;
}
