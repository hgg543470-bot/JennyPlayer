/*
 * JENNY PLAYER — C++17 90-DEGREE WAVE SPLICER V49 (Full-Arc Profile Matching + Whole-Cycle Elastic Gain)
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

    const int32_t step_out = std::max(512, (int32_t)std::lround(0.018f * sample_rate));
    const int32_t search_rad = std::max(256, (int32_t)std::lround(0.012f * sample_rate));
    const int32_t fillet_len = std::max(128, (int32_t)std::lround(0.0045f * sample_rate));

    int32_t out_len = std::min(max_out_len, (int32_t)std::lround((double)in_len / speed));
    int32_t init_copy = std::min(step_out, out_len);
    std::memcpy(out_buf, in_buf, init_copy * sizeof(float));

    int32_t out_pos = init_copy;
    double in_cursor = (double)init_copy;
    float env_gain = 1.0f;

    while (out_pos + step_out + fillet_len < out_len) {
        int32_t p1 = (int32_t)std::lround(in_cursor);
        int32_t ideal_p2 = (int32_t)std::lround((double)out_pos * speed);
        if (p1 < 16 || p1 + step_out + fillet_len >= in_len) break;
        if (ideal_p2 < 16 || ideal_p2 + step_out + fillet_len >= in_len) break;

        // Сдвигаем p1 к ближайшему восходящему переходу через 0 (где мембрана в покое)
        for (int32_t k = -12; k <= 12; ++k) {
            if (in_buf[p1 + k - 1] <= 0.0f && in_buf[p1 + k] >= 0.0f) {
                p1 += k;
                break;
            }
        }

        int32_t min_p2 = std::max(16, ideal_p2 - search_rad);
        int32_t max_p2 = std::min(in_len - step_out - fillet_len - 16, ideal_p2 + search_rad);
        int32_t best_p2 = ideal_p2;
        float best_cost = 1e9f;

        // Сравниваем целый профиль дуги (16 точек вдоль склона), чтобы сошлись и бас, и гитара, и вокал
        for (int32_t cand = min_p2; cand <= max_p2; cand += 2) {
            float s1 = in_buf[p1 + 1] - in_buf[p1 - 1];
            float s2 = in_buf[cand + 1] - in_buf[cand - 1];
            if (s1 * s2 < 0.0f) continue;

            float profile_err = 0.0f;
            for (int32_t w = -8; w <= 24; w += 4) {
                float d = in_buf[cand + w] - in_buf[p1 + w];
                profile_err += d * d;
            }
            float slope_err = std::fabs(s2 - s1) * 2.0f;
            float cost = profile_err + slope_err;
            if (cost < best_cost) {
                best_cost = cost;
                best_p2 = cand;
            }
        }

        // Измеряем амплитуду всего сегмента целиком (чтобы менять громкость всей дуги без сплющивания верхушек!)
        float seg_peak = 0.0f;
        for (int32_t i = 0; i < step_out; i += 4) {
            float a = std::fabs(in_buf[best_p2 + i]);
            if (a > seg_peak) seg_peak = a;
        }
        float target_gain = 1.0f;
        if (speed > 1.005f && seg_peak > 0.25f) {
            target_gain = 1.0f - std::min(0.25f, (speed - 1.0f) * tension * 0.28f) * (seg_peak - 0.25f);
        } else if (speed < 0.995f && seg_peak > 0.25f) {
            target_gain = 1.0f + std::min(0.18f, (1.0f - speed) * tension * 0.22f) * (seg_peak - 0.25f);
        }

        float dy = in_buf[best_p2] - in_buf[p1];
        for (int32_t i = 0; i < step_out; ++i) {
            env_gain = env_gain * 0.998f + target_gain * 0.002f;
            float raw_b = in_buf[best_p2 + i];
            float sample = raw_b;

            if (i < fillet_len) {
                float t = (float)i / (float)fillet_len;
                float b = 0.5f * (1.0f - std::cos(3.14159265f * t));
                float r = 1.0f - b;
                float raw_a = in_buf[p1 + i];
                sample = raw_a * r + (raw_b - dy * r * r) * b;
            }

            sample *= env_gain;
            if (std::fabs(sample) > 0.98f) sample = std::tanh(sample);
            out_buf[out_pos + i] = sample;
        }

        out_pos += step_out;
        in_cursor = (double)(best_p2 + step_out);
    }

    return out_pos;
}

} // extern "C"
