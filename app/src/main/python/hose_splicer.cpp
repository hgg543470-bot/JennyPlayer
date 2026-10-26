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
    const int32_t step_out = std::max(512, (int32_t)std::lround(0.018f * sr));
    const int32_t search_rad = std::max(256, (int32_t)std::lround(0.012f * sr));
    const int32_t fillet_len = std::max(160, (int32_t)std::lround(0.005f * sr));
    int32_t out_len = std::min(max_out_len, (int32_t)std::lround((double)in_len / speed));
    int32_t init_copy = std::min(step_out, out_len);
    std::memcpy(out_buf, in_buf, init_copy * sizeof(float));
    int32_t out_pos = init_copy, in_cursor = init_copy;
    float env_gain = 1.0f;
    while (out_pos + step_out + fillet_len + 64 < out_len && in_cursor + step_out + fillet_len + 64 < in_len) {
        int32_t adv = 0;
        for (int32_t k = 0; k <= 32; ++k) {
            if (in_buf[in_cursor + k - 1] <= 0.0f && in_buf[in_cursor + k] >= 0.0f) { adv = k; break; }
        }
        for (int32_t k = 0; k < adv && out_pos < out_len; ++k) out_buf[out_pos++] = in_buf[in_cursor++] * env_gain;
        int32_t p1 = in_cursor;
        int32_t ideal_p2 = (int32_t)std::lround((double)out_pos * speed);
        if (ideal_p2 < 32 || ideal_p2 + step_out + fillet_len + 32 >= in_len) break;
        int32_t min_p2 = std::max(32, ideal_p2 - search_rad), max_p2 = std::min(in_len - step_out - fillet_len - 32, ideal_p2 + search_rad);
        int32_t best_p2 = ideal_p2;
        float best_cost = 1e9f, s1 = in_buf[p1 + 1] - in_buf[p1 - 1], bs1 = in_buf[p1 + 12] - in_buf[p1 - 12];
        for (int32_t c = min_p2; c <= max_p2; ++c) {
            float s2 = in_buf[c + 1] - in_buf[c - 1], bs2 = in_buf[c + 12] - in_buf[c - 12];
            if (s1 * s2 < 0.0f || bs1 * bs2 < 0.0f) continue;
            float err = 0.0f;
            for (int32_t w = 0; w < fillet_len; w += 8) { float d = in_buf[c + w] - in_buf[p1 + w]; err += d * d; }
            float cost = err + std::fabs(s2 - s1) * 4.0f + std::fabs(in_buf[c] - in_buf[p1]) * 6.0f;
            if (cost < best_cost) { best_cost = cost; best_p2 = c; }
        }
        for (int32_t i = 0; i < step_out; ++i) {
            float v = in_buf[best_p2 + i];
            if (i < fillet_len) {
                float b = 0.5f * (1.0f - std::cos(3.14159265f * i / fillet_len));
                v = in_buf[p1 + i] * (1.0f - b) + v * b;
            }
            out_buf[out_pos + i] = v * env_gain;
        }
        out_pos += step_out;
        in_cursor = best_p2 + step_out;
    }
    return out_pos;
}
}
