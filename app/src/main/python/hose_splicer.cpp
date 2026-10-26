#include <cmath>
#include <cstdint>
#include <cstring>
#include <algorithm>
extern "C" {
__attribute__((visibility("default")))
int32_t hose_splice_channel_cpp(const float* __restrict in_buf, int32_t in_len, float* __restrict out_buf, int32_t max_out_len, int32_t sr, float speed, float tension) {
    if (!in_buf || !out_buf || in_len <= 0 || max_out_len <= 0) return 0;
    if (std::fabs(speed - 1.0f) < 0.002f) {
        int32_t n = std::min(in_len, max_out_len);
        std::memcpy(out_buf, in_buf, n * sizeof(float));
        return n;
    }
    const int32_t step_out = std::max(384, (int32_t)std::lround((speed < 0.75f ? 0.010f : 0.016f) * sr));
    const int32_t search_rad = std::max(160, (int32_t)std::lround(0.0065f * sr));
    const int32_t fillet_len = std::max(96, (int32_t)std::lround(0.0040f * sr));
    int32_t out_len = std::min(max_out_len, (int32_t)std::lround((double)in_len / speed));
    int32_t init_copy = std::min(step_out, out_len);
    std::memcpy(out_buf, in_buf, init_copy * sizeof(float));
    int32_t out_pos = init_copy, in_cursor = init_copy;
    float env_gain = 1.0f;
    while (out_pos + step_out + fillet_len + 64 < out_len && in_cursor + step_out + fillet_len + 64 < in_len) {
        int32_t adv = 0;
        for (int32_t k = 0; k <= 44; ++k) {
            if (in_buf[in_cursor + k - 1] <= 0.0f && in_buf[in_cursor + k] >= 0.0f) { adv = k; break; }
        }
        for (int32_t k = 0; k < adv && out_pos < out_len; ++k) out_buf[out_pos++] = in_buf[in_cursor++] * env_gain;
        int32_t p1 = in_cursor;
        int32_t ideal_p2 = (int32_t)std::lround((double)out_pos * speed);
        int32_t exp_shift = (int32_t)std::lround((double)step_out * std::fabs(speed - 1.0f));
        int32_t min_sh = std::max(16, (int32_t)(exp_shift * 0.30f));
        int32_t max_sh = std::max(min_sh + 96, (int32_t)(exp_shift * 1.90f));
        int32_t lim_min = (speed > 1.0f) ? (p1 + min_sh) : (p1 - max_sh);
        int32_t lim_max = (speed > 1.0f) ? (p1 + max_sh) : (p1 - min_sh);
        int32_t min_p2 = std::max(32, std::max(lim_min, ideal_p2 - search_rad));
        int32_t max_p2 = std::min(in_len - step_out - fillet_len - 32, std::min(lim_max, ideal_p2 + search_rad));
        if (min_p2 > max_p2) {
            int32_t fb = (speed > 1.0f) ? (p1 + exp_shift) : (p1 - exp_shift);
            min_p2 = std::max(32, fb - 64);
            max_p2 = std::min(in_len - step_out - fillet_len - 32, fb + 64);
        }
        int32_t best_p2 = std::clamp(ideal_p2, min_p2, max_p2);
        float best_cost = 1e9f, s1 = in_buf[p1 + 1] - in_buf[p1 - 1], bs1 = in_buf[p1 + 8] - in_buf[p1 - 8];
        for (int32_t c = min_p2; c <= max_p2; ++c) {
            float s2 = in_buf[c + 1] - in_buf[c - 1], bs2 = in_buf[c + 8] - in_buf[c - 8];
            if (s1 * s2 < 0.0f || bs1 * bs2 < 0.0f) continue;
            float zc_bonus = (in_buf[c - 1] <= 0.0f && in_buf[c] >= 0.0f) ? 0.0f : 0.08f;
            float err = 0.0f;
            for (int32_t w = -8; w <= 32; w += 8) { float d = in_buf[c + w] - in_buf[p1 + w]; err += d * d; }
            float cost = err * 1.5f + std::fabs(in_buf[c] - in_buf[p1]) * 12.0f + std::fabs(s2 - s1) * 5.0f + zc_bonus;
            if (cost < best_cost) { best_cost = cost; best_p2 = c; }
        }
        float dy = in_buf[best_p2] - in_buf[p1];
        for (int32_t i = 0; i < step_out; ++i) {
            float v = in_buf[best_p2 + i];
            if (i < fillet_len) {
                float b = 0.5f * (1.0f - std::cos(3.14159265f * i / fillet_len)), r = 1.0f - b;
                v = in_buf[p1 + i] * r + (v - dy * r * r) * b;
            }
            out_buf[out_pos + i] = v * env_gain;
        }
        out_pos += step_out;
        in_cursor = best_p2 + step_out;
    }
    return out_pos;
}
}
