/*
 * JENNY PLAYER — C++17 90-DEGREE WAVE MICRO-SPLICER V47 (4ms Period / ~0.18ms Single-Slope Cut)
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

    // Шаг 4 мс (192 сэмпла при 48кГц) -> вырез всего ~9 сэмплов (0.18 мс), оба края всегда на одном склоне!
    const int32_t G_in = std::max(80, (int32_t)std::lround(0.004f * sample_rate));
    const int32_t G_out = std::max(40, (int32_t)std::lround((float)G_in / speed));
    const int32_t delta = G_in - G_out;
    const int32_t abs_d = std::abs(delta);
    const int32_t fillet_r = 6;

    int32_t in_pos = 0;
    int32_t out_pos = 0;

    while (in_pos + G_in < in_len && out_pos + G_out < max_out_len) {
        int32_t search_start = std::min(G_in / 4, 24);
        int32_t search_end = std::max(search_start + 1, G_in - abs_d - 20);
        int32_t best_off = search_start;
        float best_cost = 1e9f;

        for (int32_t off = search_start; off < search_end; off += 2) {
            int32_t p1 = in_pos + off;
            int32_t p2 = (delta >= 0) ? (p1 + abs_d) : (p1 - std::min(off - 2, abs_d));

            float s1 = in_buf[p1] - in_buf[p1 - 1];
            float s2 = in_buf[p2 + 1] - in_buf[p2];
            // Проверяем, что оба разреза под 90° лежат на одном направлении склона (знак наклона совпадает)
            float dir_penalty = (s1 * s2 < 0.0f) ? 1.5f : 0.0f;
            float slope_diff = std::fabs(s1 - s2);
            float cost = slope_diff * 6.0f + dir_penalty;

            if (cost < best_cost) {
                best_cost = cost;
                best_off = off;
            }
        }

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

        // Стягивание вдоль склона волны: убирает ступеньку dy, уменьшая высоту высоких петель
        float dy = (yR - (yL + sL)) * std::min(1.25f, tension);
        int32_t rem = G_out - best_off;

        for (int32_t m = 0; m < rem; ++m) {
            float r = 1.0f - (float)m / (float)std::max(1, rem);
            float sample = in_buf[p_right + m] - dy * (r * r);
            if (std::fabs(sample) > 0.96f) sample = std::tanh(sample);
            out_buf[out_pos + best_off + m] = sample;
        }

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
                out_buf[idxA + k] =
                    (2.0f * t3 - 3.0f * t2 + 1.0f) * pA +
                    (t3 - 2.0f * t2 + t) * mA +
                    (-2.0f * t3 + 3.0f * t2) * pB +
                    (t3 - t2) * mB;
            }
        }

        in_pos += G_in;
        out_pos += G_out;
    }

    return out_pos;
}

} // extern "C"
