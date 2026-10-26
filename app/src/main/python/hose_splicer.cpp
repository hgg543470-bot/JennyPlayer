/*
 * JENNY PLAYER — C++17 90-DEGREE ELASTIC HOSE SPLICER V48 (Zero-Rasp Slope & Height Lock + C2 Fillet)
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

    const int32_t step_out = std::max(256, (int32_t)std::lround(0.012f * sample_rate)); // 12 мс шаг между микро-швами
    const int32_t search_rad = std::max(128, (int32_t)std::lround(0.007f * sample_rate)); // радиус поиска 90° совпадения дуги
    const int32_t fillet_len = std::max(32, (int32_t)std::lround(0.0012f * sample_rate)); // 1.2 мс C2-скругление концов

    int32_t out_Len = std::min(max_out_len, (int32_t)std::lround((double)in_len / speed));
    double in_cursor = 0.0;
    int32_t out_pos = 0;

    // Копируем стартовый сегмент
    int32_t init_copy = std::min(step_out, out_Len);
    for (int32_t i = 0; i < init_copy; ++i) {
        out_buf[i] = in_buf[i];
    }
    out_pos = init_copy;
    in_cursor = (double)init_copy;

    while (out_pos + step_out + fillet_len < out_Len) {
        int32_t p1 = (int32_t)std::lround(in_cursor);
        int32_t ideal_p2 = (int32_t)std::lround((double)out_pos * speed);

        if (p1 < 4 || p1 + step_out + fillet_len >= in_len) break;
        if (ideal_p2 < 4 || ideal_p2 + step_out + fillet_len >= in_len) break;

        // Вектор волны в точке разреза p1 (высота, угол наклона 1-го порядка и кривизна)
        float y1 = in_buf[p1];
        float s1 = in_buf[p1] - in_buf[p1 - 1];
        float s1_wide = in_buf[p1 + 2] - in_buf[p1 - 2];

        int32_t min_p2 = std::max(4, ideal_p2 - search_rad);
        int32_t max_p2 = std::min(in_len - step_out - fillet_len - 4, ideal_p2 + search_rad);

        int32_t best_p2 = ideal_p2;
        float best_cost = 1e9f;

        for (int32_t cand = min_p2; cand <= max_p2; cand += 2) {
            float y2 = in_buf[cand];
            float s2 = in_buf[cand] - in_buf[cand - 1];
            float s2_wide = in_buf[cand + 2] - in_buf[cand - 2];

            // Оба разреза под 90° должны идти в одном направлении склона и совпадать по высоте и углу
            float dir_pen = (s1 * s2 < 0.0f || s1_wide * s2_wide < 0.0f) ? 2.5f : 0.0f;
            float height_diff = std::fabs(y2 - y1);
            float slope_diff = std::fabs(s2 - s1) * 4.0f + std::fabs(s2_wide - s1_wide) * 2.0f;
            float dist_pen = (float)std::abs(cand - ideal_p2) / (float)search_rad * 0.15f;

            float cost = height_diff * 2.5f + slope_diff + dir_pen + dist_pen;
            if (cost < best_cost) {
                best_cost = cost;
                best_p2 = cand;
            }
        }

        // Стягивание торцов строго заподлицо (100% точность стыка без перелёта) + C2-скругление Эрмита-Косинуса
        float dy = in_buf[best_p2] - (y1 + s1);
        float ds = (in_buf[best_p2 + 1] - in_buf[best_p2]) - s1;

        for (int32_t i = 0; i < step_out; ++i) {
            int32_t src_idx = best_p2 + i;
            float raw_b = in_buf[src_idx];

            float sample = raw_b;
            if (i < fillet_len) {
                // Гладкая C2-дуга скругления на стыке двух склонов (первые 1.2 мс после разреза)
                float t = (float)i / (float)fillet_len;
                float blend = 0.5f * (1.0f - std::cos(3.14159265f * t)); // от 0.0 до 1.0 с нулевой производной на краях
                int32_t cont_idx = std::min(in_len - 1, p1 + i);
                float raw_a = in_buf[cont_idx];
                // Плавно переводим траекторию старого склона в новый + компенсируем остаточную микро-ступеньку dy
                float tang_corr = (dy + ds * (float)i * 0.25f) * (1.0f - blend);
                sample = raw_a * (1.0f - blend) + (raw_b - tang_corr) * blend;
            }

            // Физика "Упругого Шланга": на высокой амплитуде стягивание плавно прижимает высоту петли
            float abs_s = std::fabs(sample);
            if (speed > 1.005f && abs_s > 0.35f) {
                float compress = 1.0f - std::min(0.28f, (speed - 1.0f) * tension * 0.35f) * (abs_s - 0.35f);
                sample *= compress;
            } else if (speed < 0.995f && abs_s > 0.35f) {
                float expand = 1.0f + std::min(0.22f, (1.0f - speed) * tension * 0.30f) * (abs_s - 0.35f);
                sample *= expand;
            }
            if (std::fabs(sample) > 0.96f) {
                sample = std::tanh(sample);
            }

            out_buf[out_pos + i] = sample;
        }

        out_pos += step_out;
        in_cursor = (double)(best_p2 + step_out);
    }

    return out_pos;
}

} // extern "C"
