/*
 * JENNY PLAYER — C++17 90-DEGREE WAVE MICRO-SPLICER (hose_splicer.cpp)
 * Строгий период 10 мс + разрез под 90° к склону волны + стягивание вдоль вектора склона + кубическое скругление Эрмита.
 */
#include <cmath>
#include <cstdint>
#include <cstring>
#include <algorithm>

extern "C" {

__attribute__((visibility("default")))
int32_t hose_splice_channel_cpp(
    const float* __restrict in_buf,
    int32_t in_len,
    float* __restrict out_buf,
    int32_t max_out_len,
    int32_t sample_rate,
    float speed,
    float tension
) {
    if (!in_buf || !out_buf || in_len <= 0 || max_out_len <= 0) return 0;
    if (std::fabs(speed - 1.0f) < 0.002f) {
        int32_t copy_n = std::min(in_len, max_out_len);
        std::memcpy(out_buf, in_buf, copy_n * sizeof(float));
        return copy_n;
    }

    // Период резки строго 10 мс (например 480 сэмплов при 48000 Гц)
    const int32_t G_in = std::max(120, (int32_t)std::lround(0.010f * sample_rate));
    const int32_t G_out = std::max(60, (int32_t)std::lround((float)G_in / speed));
    const int32_t delta = G_in - G_out; // >0 вырезаем микро-слой (ускорение), <0 вставляем (замедление)
    const int32_t abs_d = std::abs(delta);
    const int32_t fillet_r = 8; // радиус скругления торцов вокруг шва (16 сэмплов ~ 0.33 мс)

    int32_t in_pos = 0;
    int32_t out_pos = 0;

    while (in_pos + G_in < in_len && out_pos + G_out < max_out_len) {
        // 1. Ищем на склоне внутри 10 мс окна точку, где два разреза под 90° к волне максимально параллельны
        int32_t search_start = std::min(G_in / 4, 64);
        int32_t search_end = std::max(search_start + 1, G_in - abs_d - 64);
        int32_t best_off = search_start;
        float best_cost = 1e9f;

        for (int32_t off = search_start; off < search_end; off += 2) {
            int32_t p1 = in_pos + off;
            int32_t p2 = (delta >= 0) ? (p1 + abs_d) : (p1 - std::min(off - 2, abs_d));

            float y1 = in_buf[p1];
            float y2 = in_buf[p2];
            float s1 = in_buf[p1] - in_buf[p1 - 1];     // касательная (угол волны) на левом торце
            float s2 = in_buf[p2 + 1] - in_buf[p2];     // касательная (угол волны) на правом торце

            // Штрафуем за разницу углов (непараллельность 90° разрезов) и за резкие пики ударных
            float slope_diff = std::fabs(s1 - s2);
            float height_diff = std::fabs(y2 - y1);
            float transient_penalty = (std::fabs(s1) > 0.25f || std::fabs(s2) > 0.25f) ? 2.0f : 0.0f;
            float cost = slope_diff * 5.0f + height_diff * 1.2f + transient_penalty;

            if (cost < best_cost) {
                best_cost = cost;
                best_off = off;
            }
        }

        // 2. Копируем левую часть до линии первого 90° разреза
        for (int32_t i = 0; i < best_off; ++i) {
            out_buf[out_pos + i] = in_buf[in_pos + i];
        }

        int32_t p_left = in_pos + best_off - 1;
        int32_t p_right = (delta >= 0)
            ? (in_pos + best_off + abs_d)
            : std::max(1, in_pos + best_off - abs_d);

        float yL = in_buf[p_left];
        float sL = in_buf[p_left] - in_buf[p_left - 1];
        float yR = in_buf[p_right];
        float sR = in_buf[p_right + 1] - in_buf[p_right];

        // 3. Стягивание концов по направлению друг к другу (вдоль склона волны):
        // На крутом склоне (высокая амплитуда) вычитание dy само прижимает высоту (громкость) дуги,
        // а на пологом участке (низкая амплитуда) dy ~ 0, и сжимается чистое время!
        float dy = (yR - (yL + sL)) * std::min(1.35f, tension);
        int32_t rem = G_out - best_off;

        for (int32_t m = 0; m < rem; ++m) {
            float decay = 1.0f - (float)m / (float)std::max(1, rem);
            decay = decay * decay; // плавный возврат упругого шланга к оси
            float sample = in_buf[p_right + m] - dy * decay;

            // На крутых высоких петлях при стягивании чуть прижимаем амплитуду верхушки
            float inst_abs = std::fabs(sample);
            if (delta > 0 && inst_abs > 0.35f) {
                sample *= (1.0f - 0.12f * tension * (inst_abs - 0.35f));
            }
            if (std::fabs(sample) > 0.95f) {
                sample = std::tanh(sample);
            }
            out_buf[out_pos + best_off + m] = sample;
        }

        // 4. Скругление концов (кубический сплайн Эрмита вокруг точки стыка best_off)
        int32_t seam = out_pos + best_off;
        if (seam > fillet_r && seam + fillet_r < out_pos + G_out) {
            int32_t idxA = seam - fillet_r;
            int32_t idxB = seam + fillet_r;
            float pA = out_buf[idxA];
            float pB = out_buf[idxB];
            float mA = (out_buf[idxA] - out_buf[idxA - 1]) * (2.0f * fillet_r);
            float mB = (out_buf[idxB + 1] - out_buf[idxB]) * (2.0f * fillet_r);

            for (int32_t k = 1; k < 2 * fillet_r; ++k) {
                float t = (float)k / (float)(2 * fillet_r);
                float t2 = t * t;
                float t3 = t2 * t;
                float h00 = 2.0f * t3 - 3.0f * t2 + 1.0f;
                float h10 = t3 - 2.0f * t2 + t;
                float h01 = -2.0f * t3 + 3.0f * t2;
                float h11 = t3 - t2;
                out_buf[idxA + k] = h00 * pA + h10 * mA + h01 * pB + h11 * mB;
            }
        }

        in_pos += G_in;
        out_pos += G_out;
    }

    return out_pos;
}

} // extern "C"
