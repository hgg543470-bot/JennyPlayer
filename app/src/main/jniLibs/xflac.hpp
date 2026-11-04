#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum { XFLAC_MODE_BITPERFECT = 0, XFLAC_MODE_PSYCHO_LSB = 1 } xflac_mode_t;
typedef struct {
    size_t original_bytes, compressed_bytes;
    uint32_t sample_rate, num_frames;
    uint8_t stereo_dedup;
    double encode_ms;
} xflac_stats_t;

#define WARMUP 440
#define BLOCK_SIZE 2048
#define AR_ORDER 16
#define TOTAL_TAPS 21
#define RICE_BLOCK 128
#define SUBBLOCK_SIZE 256

typedef struct { uint8_t* data; size_t size, cap; } ByteVec;
static inline void bv_init(ByteVec* v, size_t c) { v->size = 0; v->cap = c ? c : 1024; v->data = (uint8_t*)malloc(v->cap); }
static inline void bv_free(ByteVec* v) { if (v->data) free(v->data); v->data = NULL; v->size = v->cap = 0; }
static inline void bv_reserve(ByteVec* v, size_t need) {
    if (v->size + need > v->cap) {
        v->cap = (v->cap * 2) + need + 1024;
        v->data = (uint8_t*)realloc(v->data, v->cap);
    }
}
static inline void bv_push(ByteVec* v, uint8_t b) { bv_reserve(v, 1); v->data[v->size++] = b; }
static inline void bv_append(ByteVec* v, const void* s, size_t n) { if (!n) return; bv_reserve(v, n); memcpy(v->data + v->size, s, n); v->size += n; }
static inline void bv_u16(ByteVec* v, uint16_t x) { bv_append(v, &x, 2); }
static inline void bv_u32(ByteVec* v, uint32_t x) { bv_append(v, &x, 4); }
static inline void bv_i32(ByteVec* v, int32_t x)  { bv_append(v, &x, 4); }

static inline uint8_t rd_u8(const uint8_t** p) { uint8_t v = **p; (*p) += 1; return v; }
static inline uint16_t rd_u16(const uint8_t** p) { uint16_t v; memcpy(&v, *p, 2); (*p) += 2; return v; }
static inline uint32_t rd_u32(const uint8_t** p) { uint32_t v; memcpy(&v, *p, 4); (*p) += 4; return v; }
static inline int32_t rd_i32(const uint8_t** p) { int32_t v; memcpy(&v, *p, 4); (*p) += 4; return v; }

typedef struct { ByteVec buf; uint64_t acc; int bits; } BitWriter;
static inline void bw_put(BitWriter* bw, uint32_t val, int n) {
    if (n <= 0) return;
    bw->acc |= ((uint64_t)val << bw->bits);
    bw->bits += n;
    while (bw->bits >= 8) { bv_push(&bw->buf, (uint8_t)(bw->acc & 0xFF)); bw->acc >>= 8; bw->bits -= 8; }
}
static inline void bw_flush(BitWriter* bw) {
    if (bw->bits > 0) { bv_push(&bw->buf, (uint8_t)(bw->acc & 0xFF)); bw->acc = 0; bw->bits = 0; }
}

typedef struct { const uint8_t* data; size_t size, pos; uint64_t acc; int bits; } BitReader;
static inline uint32_t br_get(BitReader* br, int n) {
    if (n <= 0) return 0;
    while (br->bits <= 56 && br->pos < br->size) { br->acc |= ((uint64_t)br->data[br->pos++] << br->bits); br->bits += 8; }
    uint32_t val = (uint32_t)(br->acc & ((1ULL << n) - 1ULL));
    br->acc >>= n; br->bits -= n;
    return val;
}

static void solve_linear_system(int n, double A[TOTAL_TAPS][TOTAL_TAPS], double b[TOTAL_TAPS], double x[TOTAL_TAPS]) {
    for (int i = 0; i < n; ++i) {
        int pivot = i;
        double max_v = fabs(A[i][i]);
        for (int r = i + 1; r < n; ++r) { double v = fabs(A[r][i]); if (v > max_v) { max_v = v; pivot = r; } }
        if (pivot != i) {
            for (int c = i; c < n; ++c) { double t = A[i][c]; A[i][c] = A[pivot][c]; A[pivot][c] = t; }
            double tb = b[i]; b[i] = b[pivot]; b[pivot] = tb;
        }
        double diag = fabs(A[i][i]) < 1e-12 ? 1e-12 : A[i][i];
        for (int r = i + 1; r < n; ++r) {
            double f = A[r][i] / diag;
            for (int c = i; c < n; ++c) A[r][c] -= f * A[i][c];
            b[r] -= f * b[i];
        }
    }
    for (int i = n - 1; i >= 0; --i) {
        double s = b[i];
        for (int c = i + 1; c < n; ++c) s -= A[i][c] * x[c];
        x[i] = s / (fabs(A[i][i]) < 1e-12 ? 1e-12 : A[i][i]);
    }
}

static void apply_dynamic_noise_floor_gate32(int32_t* ch, size_t n, double gate_div, int bits, uint32_t sr) {
    if (gate_div < 5.0) gate_div = 25.0;
    if (sr < 8000) sr = 44100;
    double scale = (bits >= 24) ? 256.0 : 1.0;
    int32_t max_lim = (bits >= 24) ? 8388607 : 32767;
    int32_t min_lim = (bits >= 24) ? -8388608 : -32768;
    double sr_factor = (double)sr / 44100.0;
    int extra_hi_bits = (bits >= 24) ? 8 : 0;

    for (size_t s = 0; s < n; s += SUBBLOCK_SIZE) {
        size_t e = (s + SUBBLOCK_SIZE < n) ? (s + SUBBLOCK_SIZE) : n;
        size_t len = e - s;
        double sum_sq = 0.0, diff_sq = 0.0, diff2_sq = 0.0;
        double peak16 = 0.0;
        for (size_t i = s; i < e; ++i) {
            double v = (double)ch[i] / scale;
            double av = fabs(v);
            if (av > peak16) peak16 = av;
            sum_sq += v * v;
            if (i > s) {
                double d1 = v - ((double)ch[i - 1] / scale);
                diff_sq += d1 * d1;
                if (i > s + 1) {
                    double d0 = ((double)ch[i - 1] - (double)ch[i - 2]) / scale;
                    double d2 = d1 - d0;
                    diff2_sq += d2 * d2;
                }
            }
        }
        double rms = sqrt(sum_sq / (double)len);
        if (rms <= gate_div * 1.15) continue;

        double diff1_rms = sqrt(diff_sq / (double)(len > 1 ? len - 1 : 1)) * sr_factor;
        double diff2_rms = sqrt(diff2_sq / (double)(len > 2 ? len - 2 : 1)) * (sr_factor * sr_factor);
        // Кривизна второй производной: у чистого рояля/синуса очень гладкая волна (curv < 0.045), у микса с ударными/вокалом/гитарами > 0.08
        double curv_ratio = (diff1_rms > 1.0) ? (diff2_rms / diff1_rms) : 0.0;
        bool is_pure_solo_tone = (curv_ratio < 0.048 && diff1_rms < rms * 0.14);

        int tz = 0;
        int max_tz = 0;

        if (bits == 16 && sr <= 48000 && !is_pure_solo_tone) {
            // ПРОФИЛЬ 1: Стандартный 16-bit 44.1/48 kHz (Roxette, Maxx, RATM и др.) — плотное сжатие как раньше (< 20 МБ)
            double eff_div = gate_div * 1.35;
            tz = (int)floor(log2(rms / eff_div));
            max_tz = (gate_div <= 16.0) ? 8 : ((gate_div <= 26.0) ? 7 : 6);
        } else if (bits >= 24 || sr >= 88200) {
            // ПРОФИЛЬ 2: Hi-Res 24/32-bit или 88.2/96/192 kHz — адаптивный срез младших разрядов с учетом глубины 24 бит
            double hi_div = gate_div * (is_pure_solo_tone ? 4.2 : 1.85);
            int base_tz = (int)floor(log2(rms / hi_div));
            if (base_tz < 1) base_tz = 1;
            int base_max = is_pure_solo_tone
                ? ((gate_div <= 16.0) ? 6 : ((gate_div <= 26.0) ? 5 : 4))
                : ((gate_div <= 16.0) ? 8 : ((gate_div <= 26.0) ? 7 : 6));
            if (base_tz > base_max) base_tz = base_max;
            tz = base_tz + extra_hi_bits;
            max_tz = base_max + extra_hi_bits;
        } else {
            // ПРОФИЛЬ 3: 16-bit сольный чистый академический инструмент (пианино/флейта)
            double tone_div = gate_div * 3.8;
            tz = (int)floor(log2(rms / tone_div));
            max_tz = (gate_div <= 16.0) ? 6 : ((gate_div <= 26.0) ? 5 : 4);
        }

        if (tz < 0) tz = 0;
        else if (tz > max_tz) tz = max_tz;

        if (tz > 0) {
            int32_t step = 1 << tz;
            int32_t half = 1 << (tz - 1);
            int32_t mask = ~(step - 1);
            int32_t max_pos = max_lim & mask;
            int32_t err_prev = 0;
            for (size_t i = s; i < e; ++i) {
                // Error-feedback шейпинг: убирает гармонический ступенчатый дребезг на пианино, оставляя младшие tz бит нулями!
                int32_t shaped = ch[i] + ((err_prev * 3) >> 3);
                int32_t q = (shaped + half) & mask;
                if (q < min_lim) q = min_lim;
                else if (q > max_pos) q = max_pos;
                err_prev = ch[i] - q;
                if (err_prev > step) err_prev = step;
                else if (err_prev < -step) err_prev = -step;
                ch[i] = q;
            }
        }
    }
}

static void strip_wasted_bits32(const int32_t* in, size_t n, int64_t* out, ByteVec* shifts) {
    for (size_t s = 0; s < n; s += SUBBLOCK_SIZE) {
        size_t e = (s + SUBBLOCK_SIZE < n) ? (s + SUBBLOCK_SIZE) : n;
        uint32_t cor = 0;
        for (size_t i = s; i < e; ++i) { int32_t v = in[i]; cor |= (uint32_t)(v < 0 ? -v : v); }
        int tz = cor ? __builtin_ctz(cor) : 0;
        if (tz > 22) tz = 22;
        bv_push(shifts, (uint8_t)tz);
        for (size_t i = s; i < e; ++i) out[i] = ((int64_t)in[i]) >> tz;
    }
}

static void restore_wasted_bits32(const int64_t* in, size_t n, const uint8_t* shifts, int32_t* out) {
    size_t idx = 0;
    for (size_t s = 0; s < n; s += SUBBLOCK_SIZE, ++idx) {
        size_t e = (s + SUBBLOCK_SIZE < n) ? (s + SUBBLOCK_SIZE) : n;
        int tz = shifts[idx];
        for (size_t i = s; i < e; ++i) out[i] = (int32_t)(in[i] << tz);
    }
}

static void encode_channel_pitch_ols(const int64_t* x, size_t n, ByteVec* meta_q_out, ByteVec* rem_packed_out) {
    int64_t* res = (int64_t*)calloc(n > 0 ? n : 1, sizeof(int64_t));
    size_t warm = n < WARMUP ? n : WARMUP;
    for (size_t i = 0; i < warm; ++i) res[i] = x[i];
    ByteVec hdr; bv_init(&hdr, 4096);

    for (size_t s = WARMUP; s < n; s += BLOCK_SIZE) {
        size_t e = (s + BLOCK_SIZE < n) ? (s + BLOCK_SIZE) : n;
        if (e - s <= TOTAL_TAPS + 10) { for (size_t i = s; i < e; ++i) res[i] = x[i]; continue; }
        uint16_t best_lag = 50; double best_corr = -1.0;
        for (int lag = 20; lag < 420; lag += 4) {
            double c = 0.0;
            for (size_t i = s; i < e; i += 2) c += (double)x[i] * (double)x[i - lag];
            if (fabs(c) > best_corr) { best_corr = fabs(c); best_lag = (uint16_t)lag; }
        }
        double A[TOTAL_TAPS][TOTAL_TAPS], b_vec[TOTAL_TAPS], w_flt[TOTAL_TAPS];
        memset(A, 0, sizeof(A)); memset(b_vec, 0, sizeof(b_vec)); memset(w_flt, 0, sizeof(w_flt));
        for (size_t i = s; i < e; ++i) {
            double row[TOTAL_TAPS], target = (double)x[i];
            for (int k = 0; k < AR_ORDER; ++k) row[k] = (double)x[i - (k + 1)];
            for (int p = -2; p <= 2; ++p) row[AR_ORDER + (p + 2)] = (double)x[i - best_lag + p];
            for (int r = 0; r < TOTAL_TAPS; ++r) {
                b_vec[r] += row[r] * target;
                for (int c = r; c < TOTAL_TAPS; ++c) A[r][c] += row[r] * row[c];
            }
        }
        for (int r = 0; r < TOTAL_TAPS; ++r) { A[r][r] += 1e-2; for (int c = 0; c < r; ++c) A[r][c] = A[c][r]; }
        solve_linear_system(TOTAL_TAPS, A, b_vec, w_flt);
        int32_t w_int[TOTAL_TAPS];
        for (int k = 0; k < TOTAL_TAPS; ++k) w_int[k] = (int32_t)llround(w_flt[k] * 16384.0);
        for (size_t i = s; i < e; ++i) {
            int64_t sum = 0;
            for (int k = 0; k < AR_ORDER; ++k) sum += x[i - (k + 1)] * (int64_t)w_int[k];
            for (int p = -2; p <= 2; ++p) sum += x[i - best_lag + p] * (int64_t)w_int[AR_ORDER + (p + 2)];
            res[i] = x[i] - ((sum + 8192LL) >> 14);
        }
        bv_u16(&hdr, best_lag);
        for (int k = 0; k < TOTAL_TAPS; ++k) bv_i32(&hdr, w_int[k]);
    }

    ByteVec k_vals, esc_i, esc_v;
    bv_init(&k_vals, (n / RICE_BLOCK) + 16); bv_init(&esc_i, 1024); bv_init(&esc_v, 1024);
    uint8_t* q_bytes = (uint8_t*)malloc(n > 0 ? n : 1);
    BitWriter rem_bw; bv_init(&rem_bw.buf, n); rem_bw.acc = 0; rem_bw.bits = 0;
    uint32_t n_esc = 0;

    for (size_t s = 0; s < n; s += RICE_BLOCK) {
        size_t e = (s + RICE_BLOCK < n) ? (s + RICE_BLOCK) : n, len = e - s;
        uint64_t zz[RICE_BLOCK];
        for (size_t i = 0; i < len; ++i) { int64_t v = res[s + i]; zz[i] = (uint64_t)((v << 1) ^ (v >> 63)); }
        int best_k = 0; uint64_t best_b = UINT64_MAX;
        for (int k = 0; k < 24; ++k) {
            uint64_t b = (uint64_t)len * (uint64_t)(1 + k);
            for (size_t i = 0; i < len; ++i) b += (zz[i] >> k);
            if (b < best_b) { best_b = b; best_k = k; }
        }
        bv_push(&k_vals, (uint8_t)best_k);
        uint32_t mask = (1U << best_k) - 1U;
        for (size_t i = 0; i < len; ++i) {
            uint64_t q = zz[i] >> best_k;
            if (q >= 255) { bv_u32(&esc_i, (uint32_t)(s + i)); bv_u32(&esc_v, (uint32_t)q); q_bytes[s + i] = 255; n_esc++; }
            else q_bytes[s + i] = (uint8_t)q;
            if (best_k > 0) bw_put(&rem_bw, (uint32_t)zz[i] & mask, best_k);
        }
    }
    bw_flush(&rem_bw);
    *rem_packed_out = rem_bw.buf;

    bv_init(meta_q_out, hdr.size + k_vals.size + esc_i.size + esc_v.size + n + 32);
    bv_u32(meta_q_out, (uint32_t)hdr.size); bv_u32(meta_q_out, (uint32_t)k_vals.size); bv_u32(meta_q_out, n_esc);
    bv_append(meta_q_out, hdr.data, hdr.size); bv_append(meta_q_out, k_vals.data, k_vals.size);
    bv_append(meta_q_out, esc_i.data, esc_i.size); bv_append(meta_q_out, esc_v.data, esc_v.size);
    bv_append(meta_q_out, q_bytes, n);
    free(res); free(q_bytes); bv_free(&hdr); bv_free(&k_vals); bv_free(&esc_i); bv_free(&esc_v);
}

static void decode_channel_pitch_ols(const uint8_t* meta_q, size_t m_sz, const uint8_t* rem_p, size_t r_sz, size_t n, int64_t* x_out) {
    (void)m_sz;
    const uint8_t* p = meta_q;
    uint32_t hdr_len = rd_u32(&p), k_len = rd_u32(&p), n_esc = rd_u32(&p);
    const uint8_t* hdr = p; p += hdr_len;
    const uint8_t* k_vals = p; p += k_len;
    const uint8_t* esc_i = p; p += n_esc * 4;
    const uint8_t* esc_v = p; p += n_esc * 4;
    const uint8_t* q_bytes = p;

    uint64_t* q_full = (uint64_t*)malloc((n > 0 ? n : 1) * sizeof(uint64_t));
    for (size_t i = 0; i < n; ++i) q_full[i] = q_bytes[i];
    for (uint32_t i = 0; i < n_esc; ++i) {
        uint32_t idx, val; memcpy(&idx, esc_i + i * 4, 4); memcpy(&val, esc_v + i * 4, 4);
        if (idx < n) q_full[idx] = val;
    }
    BitReader br = { rem_p, r_sz, 0, 0, 0 };
    int64_t* res = (int64_t*)malloc((n > 0 ? n : 1) * sizeof(int64_t));
    size_t blk = 0;
    for (size_t s = 0; s < n; s += RICE_BLOCK, ++blk) {
        size_t e = (s + RICE_BLOCK < n) ? (s + RICE_BLOCK) : n;
        int k = k_vals[blk];
        for (size_t i = s; i < e; ++i) {
            uint64_t rem = (k > 0) ? br_get(&br, k) : 0;
            uint64_t zz = (q_full[i] << k) | rem;
            res[i] = (int64_t)(zz >> 1) ^ -(int64_t)(zz & 1);
        }
    }
    memset(x_out, 0, n * sizeof(int64_t));
    size_t warm = n < WARMUP ? n : WARMUP;
    for (size_t i = 0; i < warm; ++i) x_out[i] = res[i];
    const uint8_t* hp = hdr;
    for (size_t s = WARMUP; s < n; s += BLOCK_SIZE) {
        size_t e = (s + BLOCK_SIZE < n) ? (s + BLOCK_SIZE) : n;
        if (e - s <= TOTAL_TAPS + 10) { for (size_t i = s; i < e; ++i) x_out[i] = res[i]; continue; }
        uint16_t lag = rd_u16(&hp);
        int32_t w[TOTAL_TAPS];
        for (int k = 0; k < TOTAL_TAPS; ++k) w[k] = rd_i32(&hp);
        for (size_t i = s; i < e; ++i) {
            int64_t sum = 0;
            for (int k = 0; k < AR_ORDER; ++k) sum += x_out[i - (k + 1)] * (int64_t)w[k];
            for (int pt = -2; pt <= 2; ++pt) sum += x_out[i - lag + pt] * (int64_t)w[AR_ORDER + (pt + 2)];
            x_out[i] = res[i] + ((sum + 8192LL) >> 14);
        }
    }
    free(q_full); free(res);
}

static int find_wav_data_chunk(const uint8_t* wav, size_t sz, size_t* off, size_t* pcm_b, uint32_t* sr, uint16_t* ch, uint16_t* bits_out, uint16_t* ftag_out) {
    if (sz < 44 || memcmp(wav, "RIFF", 4) != 0 || memcmp(wav + 8, "WAVE", 4) != 0) return 0;
    size_t pos = 12; *sr = 48000; *ch = 2; *bits_out = 16; *ftag_out = 1;
    while (pos + 8 <= sz) {
        uint32_t csz = 0; memcpy(&csz, wav + pos + 4, 4);
        if (memcmp(wav + pos, "fmt ", 4) == 0 && pos + 24 <= sz) {
            uint16_t ftag = 1, bits = 16;
            memcpy(&ftag, wav + pos + 8, 2);
            memcpy(ch, wav + pos + 10, 2);
            memcpy(sr, wav + pos + 12, 4);
            memcpy(&bits, wav + pos + 22, 2);
            if (ftag == 0xFFFE && csz >= 40 && pos + 8 + 26 <= sz) {
                memcpy(&ftag, wav + pos + 8 + 24, 2);
            }
            if ((*ch != 1 && *ch != 2) || (bits != 16 && bits != 24 && bits != 32)) return 0;
            *bits_out = bits;
            *ftag_out = ftag;
        } else if (memcmp(wav + pos, "data", 4) == 0) {
            *off = pos + 8; *pcm_b = (csz < sz - *off) ? csz : (sz - *off); return 1;
        }
        pos += 8 + csz + (csz & 1);
    }
    return 0;
}

static inline int32_t read_pcm_sample_v157(const uint8_t* p, uint16_t bits, uint16_t ftag) {
    if (bits == 16) {
        int16_t v; memcpy(&v, p, 2); return (int32_t)v;
    } else if (bits == 24) {
        int32_t v = (int32_t)p[0] | ((int32_t)p[1] << 8) | ((int32_t)((int8_t)p[2]) << 16);
        return v;
    } else if (bits == 32) {
        if (ftag == 3) {
            float fv; memcpy(&fv, p, 4);
            if (fv > 1.0f) fv = 1.0f; else if (fv < -1.0f) fv = -1.0f;
            return (int32_t)llround((double)fv * 8388607.0);
        } else {
            int32_t iv; memcpy(&iv, p, 4);
            return iv >> 8;
        }
    }
    return 0;
}

static inline void write_pcm_sample_v157(uint8_t* p, int32_t v, uint16_t bits, uint16_t ftag) {
    if (bits == 16) {
        int16_t s = (int16_t)(v < -32768 ? -32768 : (v > 32767 ? 32767 : v));
        memcpy(p, &s, 2);
    } else if (bits == 24) {
        int32_t c = (v < -8388608) ? -8388608 : ((v > 8388607) ? 8388607 : v);
        p[0] = (uint8_t)(c & 0xFF);
        p[1] = (uint8_t)((c >> 8) & 0xFF);
        p[2] = (uint8_t)((c >> 16) & 0xFF);
    } else if (bits == 32) {
        int32_t c = (v < -8388608) ? -8388608 : ((v > 8388607) ? 8388607 : v);
        if (ftag == 3) {
            float fv = (float)((double)c / 8388607.0);
            memcpy(p, &fv, 4);
        } else {
            int32_t iv = c << 8;
            memcpy(p, &iv, 4);
        }
    }
}

int xflac_encode_wav_mem(const uint8_t* wav, size_t wav_sz, uint8_t** out_d, size_t* out_sz, xflac_mode_t mode, xflac_stats_t* st) {
    size_t pcm_off = 0, pcm_b = 0; uint32_t sr = 48000; uint16_t ch = 2, bits = 16, ftag = 1;
    if (!find_wav_data_chunk(wav, wav_sz, &pcm_off, &pcm_b, &sr, &ch, &bits, &ftag)) return -1;
    size_t bps = bits / 8;
    size_t n = pcm_b / (ch * bps), suf_off = pcm_off + pcm_b, suf_len = wav_sz - suf_off;
    int32_t* mid = (int32_t*)malloc((n + 1) * 4), *side = (int32_t*)malloc((n + 1) * 4);
    const uint8_t* pcm_ptr = wav + pcm_off;
    int eq = 1;
    for (size_t i = 0; i < n; ++i) {
        const uint8_t* frame_p = pcm_ptr + i * ch * bps;
        mid[i] = read_pcm_sample_v157(frame_p, bits, ftag);
        side[i] = (ch == 2) ? read_pcm_sample_v157(frame_p + bps, bits, ftag) : mid[i];
        if (mid[i] != side[i]) eq = 0;
    }
    if ((int)mode > 0) {
        double gdiv = ((int)mode >= 5) ? (double)((int)mode) : 25.0;
        apply_dynamic_noise_floor_gate32(mid, n, gdiv, (int)bits, sr);
        if (eq) memcpy(side, mid, n * 4); else apply_dynamic_noise_floor_gate32(side, n, gdiv, (int)bits, sr);
    }

    int64_t* ls = (int64_t*)malloc((n + 1) * 8);
    ByteVec sh_l, meta_l, rem_l; bv_init(&sh_l, (n / SUBBLOCK_SIZE) + 16);
    strip_wasted_bits32(mid, n, ls, &sh_l); encode_channel_pitch_ols(ls, n, &meta_l, &rem_l);
    free(ls); free(mid);

    ByteVec rm; bv_init(&rm, pcm_off + suf_len + sh_l.size + meta_l.size + 1024);
    bv_u32(&rm, (uint32_t)pcm_off); bv_u32(&rm, (uint32_t)suf_len); bv_u32(&rm, (uint32_t)sh_l.size); bv_u32(&rm, (uint32_t)meta_l.size);
    bv_append(&rm, wav, pcm_off); bv_append(&rm, wav + suf_off, suf_len); bv_append(&rm, sh_l.data, sh_l.size); bv_append(&rm, meta_l.data, meta_l.size);
    bv_free(&sh_l); bv_free(&meta_l);

    ByteVec rem_r = { NULL, 0, 0 };
    if (!eq) {
        int64_t* rs = (int64_t*)malloc((n + 1) * 8); ByteVec sh_r, meta_r; bv_init(&sh_r, (n / SUBBLOCK_SIZE) + 16);
        strip_wasted_bits32(side, n, rs, &sh_r); encode_channel_pitch_ols(rs, n, &meta_r, &rem_r);
        bv_u32(&rm, (uint32_t)sh_r.size); bv_u32(&rm, (uint32_t)meta_r.size);
        bv_append(&rm, sh_r.data, sh_r.size); bv_append(&rm, meta_r.data, meta_r.size);
        free(rs); bv_free(&sh_r); bv_free(&meta_r);
    }
    free(side);

    uint8_t bit_flag = (bits == 24) ? 8 : ((bits == 32) ? 16 : 0);
    uint8_t flags = (eq ? 1 : 0) | ((ch == 1) ? 4 : 0) | bit_flag;
    ByteVec fb; bv_init(&fb, 32 + rm.size + rem_l.size + rem_r.size);
    bv_append(&fb, "XFC3", 4); bv_push(&fb, flags); bv_u32(&fb, (uint32_t)n);
    bv_u32(&fb, (uint32_t)rm.size); bv_u32(&fb, (uint32_t)rm.size); bv_u32(&fb, (uint32_t)rem_l.size); bv_u32(&fb, (uint32_t)rem_r.size);
    bv_append(&fb, rm.data, rm.size); bv_append(&fb, rem_l.data, rem_l.size);
    if (rem_r.size > 0) bv_append(&fb, rem_r.data, rem_r.size);
    bv_free(&rm); bv_free(&rem_l); bv_free(&rem_r);
    *out_sz = fb.size; *out_d = fb.data;
    if (st) { st->original_bytes = wav_sz; st->compressed_bytes = *out_sz; st->sample_rate = sr; st->num_frames = (uint32_t)n; st->stereo_dedup = eq ? 1 : 0; st->encode_ms = 0; }
    return 0;
}

int xflac_decode_wav_mem(const uint8_t* xd, size_t x_sz, uint8_t** out_w, size_t* out_sz) {
    if (x_sz < 25 || memcmp(xd, "XFC3", 4) != 0) return -1;
    const uint8_t* p = xd + 4;
    uint8_t flags = rd_u8(&p); uint32_t n = rd_u32(&p), rm_sz = rd_u32(&p), cm_sz = rd_u32(&p), rl_sz = rd_u32(&p), rr_sz = rd_u32(&p);
    (void)rm_sz; (void)rr_sz;
    int eq = (flags & 1) != 0, mono = (flags & 4) != 0;
    const uint8_t* mp = p; p += cm_sz; const uint8_t* rl = p; p += rl_sz; const uint8_t* rr = p;
    uint32_t p_len = rd_u32(&mp), s_len = rd_u32(&mp), shl_len = rd_u32(&mp), ml_len = rd_u32(&mp);
    const uint8_t* w_pre = mp; mp += p_len; const uint8_t* w_suf = mp; mp += s_len;
    const uint8_t* sh_l = mp; mp += shl_len; const uint8_t* meta_l = mp; mp += ml_len;

    uint16_t bits = (flags & 8) ? 24 : ((flags & 16) ? 32 : 16);
    uint16_t ftag = 1;
    if (p_len >= 44 && memcmp(w_pre, "RIFF", 4) == 0) {
        size_t pos = 12;
        while (pos + 8 <= p_len) {
            uint32_t csz = 0; memcpy(&csz, w_pre + pos + 4, 4);
            if (memcmp(w_pre + pos, "fmt ", 4) == 0 && pos + 24 <= p_len) {
                memcpy(&ftag, w_pre + pos + 8, 2);
                memcpy(&bits, w_pre + pos + 22, 2);
                if (ftag == 0xFFFE && csz >= 40 && pos + 8 + 26 <= p_len) {
                    memcpy(&ftag, w_pre + pos + 8 + 24, 2);
                }
                break;
            }
            pos += 8 + csz + (csz & 1);
        }
    }
    if (bits != 16 && bits != 24 && bits != 32) bits = 16;

    int64_t* ls = (int64_t*)malloc((n + 1) * 8);
    int32_t* mid = (int32_t*)malloc((n + 1) * 4), *side = (int32_t*)malloc((n + 1) * 4);
    decode_channel_pitch_ols(meta_l, ml_len, rl, rl_sz, n, ls); restore_wasted_bits32(ls, n, sh_l, mid); free(ls);
    if (!eq) {
        uint32_t shr_len = rd_u32(&mp), mr_len = rd_u32(&mp);
        const uint8_t* sh_r = mp; mp += shr_len; const uint8_t* meta_r = mp; mp += mr_len;
        int64_t* rs = (int64_t*)malloc((n + 1) * 8);
        decode_channel_pitch_ols(meta_r, mr_len, rr, rr_sz, n, rs); restore_wasted_bits32(rs, n, sh_r, side); free(rs);
    }
    size_t ch = mono ? 1 : 2, bps = bits / 8, pcm_b = (size_t)n * ch * bps;
    *out_sz = p_len + pcm_b + s_len; *out_w = (uint8_t*)malloc(*out_sz);
    memcpy(*out_w, w_pre, p_len);
    uint8_t* dst = *out_w + p_len;
    for (size_t i = 0; i < n; ++i) {
        uint8_t* frame_p = dst + i * ch * bps;
        write_pcm_sample_v157(frame_p, mid[i], bits, ftag);
        if (ch == 2) {
            write_pcm_sample_v157(frame_p + bps, eq ? mid[i] : side[i], bits, ftag);
        }
    }
    if (s_len > 0) memcpy(*out_w + p_len + pcm_b, w_suf, s_len);
    free(mid); free(side);
    return 0;
}
void xflac_free(void* ptr) { free(ptr); }
#ifdef __cplusplus
}
#endif
