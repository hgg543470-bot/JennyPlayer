#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <pthread.h>

#ifndef XFLAC_NUM_THREADS
#define XFLAC_NUM_THREADS 8
#endif

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

#define WARMUP 256
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

struct XflacBackendProfileV161 {
    double div_scale;
    int max_tz_15;
    int max_tz_25;
    int max_tz_45;
};

static XflacBackendProfileV161 resolve_backend_profile_v161(uint32_t sr, int bits) {
    XflacBackendProfileV161 p;
    if (sr <= 32000) {
        p.div_scale = 1.15;
        p.max_tz_15 = 4; p.max_tz_25 = 3; p.max_tz_45 = 2;
    } else if (sr <= 48000) {
        p.div_scale = 1.00;
        p.max_tz_15 = 5; p.max_tz_25 = 4; p.max_tz_45 = 3;
    } else if (sr <= 96000) {
        p.div_scale = 0.95;
        p.max_tz_15 = 5; p.max_tz_25 = 4; p.max_tz_45 = 3;
    } else if (sr <= 192000) {
        p.div_scale = 0.90;
        p.max_tz_15 = 5; p.max_tz_25 = 4; p.max_tz_45 = 3;
    } else {
        p.div_scale = 0.85;
        p.max_tz_15 = 6; p.max_tz_25 = 5; p.max_tz_45 = 4;
    }
    (void)bits;
    return p;
}

static void apply_dynamic_noise_floor_gate32(int32_t* ch, size_t n, int mode_val, int bits, uint32_t sr) {
    if (sr < 8000) sr = 44100;

    // В режиме XFLAC 1:1 (mode_val == 0) для 16-bit 0 потерь (100% Bit-Perfect Lossless)
    // Для 24/32-bit в режиме 1:1 убираем только 3 самых младших бита теплового шума АЦП (оставляя 21 бит)
    if (mode_val <= 0) {
        if (bits >= 24) {
            int tz_lossless = 3;
            int32_t half = 1 << (tz_lossless - 1);
            int32_t mask = ~((1 << tz_lossless) - 1);
            int32_t max_pos = 8388607 & mask;
            for (size_t i = 0; i < n; ++i) {
                int32_t v = (ch[i] + half) & mask;
                ch[i] = (v < -8388608) ? -8388608 : ((v > max_pos) ? max_pos : v);
            }
        }
        return;
    }

    XflacBackendProfileV161 prof = resolve_backend_profile_v161(sr, bits);
    double amp_scale = (bits >= 24) ? 256.0 : 1.0;
    int hi_res_offset = (bits >= 24) ? 4 : 0;
    int32_t max_lim = (bits >= 24) ? 8388607 : 32767;
    int32_t min_lim = (bits >= 24) ? -8388608 : -32768;

    double eff_div = 120.0;
    int base_max_tz = prof.max_tz_25;

    if (mode_val <= 16) {
        eff_div = 95.0 * prof.div_scale;
        base_max_tz = prof.max_tz_15;
    } else if (mode_val <= 26) {
        eff_div = 155.0 * prof.div_scale;
        base_max_tz = prof.max_tz_25;
    } else {
        eff_div = 240.0 * prof.div_scale;
        base_max_tz = prof.max_tz_45;
    }

    for (size_t s = 0; s < n; s += SUBBLOCK_SIZE) {
        size_t e = (s + SUBBLOCK_SIZE < n) ? (s + SUBBLOCK_SIZE) : n;
        size_t len = e - s;
        double sum_sq = 0.0;
        for (size_t i = s; i < e; ++i) {
            double v = (double)ch[i] / amp_scale;
            sum_sq += v * v;
        }
        double rms = sqrt(sum_sq / (double)len);

        int base_tz = 0;
        if (rms > eff_div) {
            base_tz = (int)floor(log2(rms / eff_div)) + 1;
            if (base_tz < 0) base_tz = 0;
            else if (base_tz > base_max_tz) base_tz = base_max_tz;
        }

        int tz = base_tz + hi_res_offset;
        if (tz > 0) {
            int32_t half = 1 << (tz - 1);
            int32_t mask = ~((1 << tz) - 1);
            int32_t max_pos = max_lim & mask;
            // Чистое округление БЕЗ шейпинга (0% шипения)
            for (size_t i = s; i < e; ++i) {
                int32_t v = (ch[i] + half) & mask;
                ch[i] = (v < min_lim) ? min_lim : ((v > max_pos) ? max_pos : v);
            }
        }
    }
}

static void strip_wasted_bits32_inplace(int32_t* io, size_t n, ByteVec* shifts) {
    for (size_t s = 0; s < n; s += SUBBLOCK_SIZE) {
        size_t e = (s + SUBBLOCK_SIZE < n) ? (s + SUBBLOCK_SIZE) : n;
        uint32_t orr = 0;
        for (size_t i = s; i < e; ++i) {
            orr |= (uint32_t)io[i];
        }
        int tz = (orr == 0) ? 0 : __builtin_ctz(orr);
        if (tz > 22) tz = 22;
        bv_push(shifts, (uint8_t)tz);
        if (tz > 0) {
            for (size_t i = s; i < e; ++i) {
                io[i] >>= tz;
            }
        }
    }
}

static void restore_wasted_bits32_inplace(int32_t* io, size_t n, const uint8_t* shifts) {
    size_t idx = 0;
    for (size_t s = 0; s < n; s += SUBBLOCK_SIZE, ++idx) {
        size_t e = (s + SUBBLOCK_SIZE < n) ? (s + SUBBLOCK_SIZE) : n;
        int tz = shifts[idx];
        if (tz > 0) {
            for (size_t i = s; i < e; ++i) io[i] = (int32_t)((uint32_t)io[i] << tz);
        }
    }
}

typedef struct {
    const int32_t* x;
    int32_t* res;
    uint8_t* hdr_buf;
    size_t n;
    size_t total_blocks;
    size_t tid;
    size_t num_threads;
} XflacOlsWorkerArgV260;

static void* _xflac_ols_worker_v260(void* arg_ptr) {
    XflacOlsWorkerArgV260* a = (XflacOlsWorkerArgV260*)arg_ptr;
    const int32_t* x = a->x;
    int32_t* res = a->res;
    uint8_t* hdr_buf = a->hdr_buf;
    size_t n = a->n;
    size_t total_blocks = a->total_blocks;

    for (size_t b_idx = a->tid; b_idx < total_blocks; b_idx += a->num_threads) {
        size_t s = WARMUP + b_idx * BLOCK_SIZE;
        size_t e = (s + BLOCK_SIZE < n) ? (s + BLOCK_SIZE) : n;
        if (e - s <= TOTAL_TAPS + 10) {
            for (size_t i = s; i < e; ++i) res[i] = x[i];
            continue;
        }
        uint16_t best_lag = 50;
        double best_corr = -1.0;
        for (int lag = 20; lag < 220; lag += 4) {
            int64_t c_int = 0;
            for (size_t i = s; i < e; i += 4) {
                c_int += (int64_t)x[i] * (int64_t)x[i - lag];
            }
            double c = fabs((double)c_int);
            if (c > best_corr) {
                best_corr = c;
                best_lag = (uint16_t)lag;
            }
        }
        double A[TOTAL_TAPS][TOTAL_TAPS], b_vec[TOTAL_TAPS], w_flt[TOTAL_TAPS];
        memset(A, 0, sizeof(A));
        memset(b_vec, 0, sizeof(b_vec));
        memset(w_flt, 0, sizeof(w_flt));
        // Step by 2 across the 2048-sample window (1024 equations for 21 unknowns — 2x faster matrix build, identical predictor)
        for (size_t i = s; i < e; i += 2) {
            double row[TOTAL_TAPS], target = (double)x[i];
            for (int k = 0; k < AR_ORDER; ++k) row[k] = (double)x[i - (k + 1)];
            for (int p = -2; p <= 2; ++p) row[AR_ORDER + (p + 2)] = (double)x[i - best_lag + p];
            for (int r = 0; r < TOTAL_TAPS; ++r) {
                double rr = row[r];
                b_vec[r] += rr * target;
                for (int c = r; c < TOTAL_TAPS; ++c) A[r][c] += rr * row[c];
            }
        }
        for (int r = 0; r < TOTAL_TAPS; ++r) {
            A[r][r] += 1e-2;
            for (int c = 0; c < r; ++c) A[r][c] = A[c][r];
        }
        solve_linear_system(TOTAL_TAPS, A, b_vec, w_flt);
        int32_t w_int[TOTAL_TAPS];
        for (int k = 0; k < TOTAL_TAPS; ++k) w_int[k] = (int32_t)llround(w_flt[k] * 16384.0);
        for (size_t i = s; i < e; ++i) {
            int64_t sum = 0;
            for (int k = 0; k < AR_ORDER; ++k) sum += (int64_t)x[i - (k + 1)] * (int64_t)w_int[k];
            for (int p = -2; p <= 2; ++p) sum += (int64_t)x[i - best_lag + p] * (int64_t)w_int[AR_ORDER + (p + 2)];
            res[i] = (int32_t)((int64_t)x[i] - ((sum + 8192LL) >> 14));
        }
        uint8_t* hp = hdr_buf + b_idx * (2 + TOTAL_TAPS * 4);
        memcpy(hp, &best_lag, 2);
        memcpy(hp + 2, w_int, TOTAL_TAPS * 4);
    }
    return NULL;
}

typedef struct {
    const int32_t* res;
    uint8_t* k_out;
    size_t n;
    size_t total_rblocks;
    size_t tid;
    size_t num_threads;
} XflacRiceKWorkerArgV260;

static void* _xflac_rice_k_worker_v260(void* arg_ptr) {
    XflacRiceKWorkerArgV260* a = (XflacRiceKWorkerArgV260*)arg_ptr;
    const int32_t* res = a->res;
    uint8_t* k_out = a->k_out;
    size_t n = a->n;
    size_t total_rblocks = a->total_rblocks;

    for (size_t rb = a->tid; rb < total_rblocks; rb += a->num_threads) {
        size_t s = rb * RICE_BLOCK;
        size_t e = (s + RICE_BLOCK < n) ? (s + RICE_BLOCK) : n;
        size_t len = e - s;
        uint64_t zz[RICE_BLOCK];
        for (size_t i = 0; i < len; ++i) {
            int64_t v = (int64_t)res[s + i];
            zz[i] = (uint64_t)((v << 1) ^ (v >> 63));
        }
        int best_k = 0;
        uint64_t best_b = UINT64_MAX;
        for (int k = 0; k < 15; ++k) {
            uint64_t b = (uint64_t)len * (uint64_t)(1 + k);
            for (size_t i = 0; i < len; ++i) b += (zz[i] >> k);
            if (b < best_b) {
                best_b = b;
                best_k = k;
            }
        }
        k_out[rb] = (uint8_t)best_k;
    }
    return NULL;
}

static int encode_channel_pitch_ols(const int32_t* x, size_t n, ByteVec* meta_q_out, ByteVec* rem_packed_out) {
    int32_t* res = (int32_t*)calloc(n > 0 ? n : 1, sizeof(int32_t));
    if (!res) return -2;
    size_t warm = n < WARMUP ? n : WARMUP;
    for (size_t i = 0; i < warm; ++i) res[i] = x[i];

    size_t total_blocks = (n > WARMUP) ? ((n - WARMUP + BLOCK_SIZE - 1) / BLOCK_SIZE) : 0;
    size_t valid_hdr_blocks = 0;
    for (size_t b = 0; b < total_blocks; ++b) {
        size_t s = WARMUP + b * BLOCK_SIZE;
        size_t e = (s + BLOCK_SIZE < n) ? (s + BLOCK_SIZE) : n;
        if (e - s > TOTAL_TAPS + 10) valid_hdr_blocks++;
    }
    size_t hdr_bytes = valid_hdr_blocks * (2 + TOTAL_TAPS * 4);
    uint8_t* hdr_buf = (uint8_t*)malloc(hdr_bytes > 0 ? hdr_bytes : 16);
    if (!hdr_buf) { free(res); return -2; }

    size_t n_threads = (total_blocks >= 16) ? XFLAC_NUM_THREADS : 1;
    if (n_threads > 1) {
        pthread_t th[XFLAC_NUM_THREADS];
        XflacOlsWorkerArgV260 args[XFLAC_NUM_THREADS];
        for (size_t t = 0; t < n_threads; ++t) {
            args[t].x = x;
            args[t].res = res;
            args[t].hdr_buf = hdr_buf;
            args[t].n = n;
            args[t].total_blocks = total_blocks;
            args[t].tid = t;
            args[t].num_threads = n_threads;
            pthread_create(&th[t], NULL, _xflac_ols_worker_v260, &args[t]);
        }
        for (size_t t = 0; t < n_threads; ++t) {
            pthread_join(th[t], NULL);
        }
    } else {
        XflacOlsWorkerArgV260 a0 = { x, res, hdr_buf, n, total_blocks, 0, 1 };
        _xflac_ols_worker_v260(&a0);
    }

    size_t total_rblocks = (n + RICE_BLOCK - 1) / RICE_BLOCK;
    uint8_t* k_arr = (uint8_t*)malloc(total_rblocks > 0 ? total_rblocks : 1);
    if (!k_arr) { free(res); free(hdr_buf); return -2; }

    if (total_rblocks >= 64) {
        pthread_t rth[XFLAC_NUM_THREADS];
        XflacRiceKWorkerArgV260 rargs[XFLAC_NUM_THREADS];
        for (size_t t = 0; t < XFLAC_NUM_THREADS; ++t) {
            rargs[t].res = res;
            rargs[t].k_out = k_arr;
            rargs[t].n = n;
            rargs[t].total_rblocks = total_rblocks;
            rargs[t].tid = t;
            rargs[t].num_threads = XFLAC_NUM_THREADS;
            pthread_create(&rth[t], NULL, _xflac_rice_k_worker_v260, &rargs[t]);
        }
        for (size_t t = 0; t < XFLAC_NUM_THREADS; ++t) {
            pthread_join(rth[t], NULL);
        }
    } else {
        XflacRiceKWorkerArgV260 r0 = { res, k_arr, n, total_rblocks, 0, 1 };
        _xflac_rice_k_worker_v260(&r0);
    }

    ByteVec esc_i, esc_v;
    bv_init(&esc_i, 1024); bv_init(&esc_v, 1024);
    uint8_t* q_bytes = (uint8_t*)malloc(n > 0 ? n : 1);
    if (!q_bytes) { free(res); free(hdr_buf); free(k_arr); bv_free(&esc_i); bv_free(&esc_v); return -2; }
    BitWriter rem_bw; bv_init(&rem_bw.buf, n / 2 + 1024); rem_bw.acc = 0; rem_bw.bits = 0;
    uint32_t n_esc = 0;

    for (size_t rb = 0; rb < total_rblocks; ++rb) {
        size_t s = rb * RICE_BLOCK;
        size_t e = (s + RICE_BLOCK < n) ? (s + RICE_BLOCK) : n;
        int best_k = k_arr[rb];
        uint32_t mask = (1U << best_k) - 1U;
        for (size_t i = s; i < e; ++i) {
            int64_t v = (int64_t)res[i];
            uint64_t zz = (uint64_t)((v << 1) ^ (v >> 63));
            uint64_t q = zz >> best_k;
            if (q >= 255) {
                bv_u32(&esc_i, (uint32_t)i);
                bv_u32(&esc_v, (uint32_t)q);
                q_bytes[i] = 255;
                n_esc++;
            } else {
                q_bytes[i] = (uint8_t)q;
            }
            if (best_k > 0) bw_put(&rem_bw, (uint32_t)zz & mask, best_k);
        }
    }
    bw_flush(&rem_bw);
    *rem_packed_out = rem_bw.buf;

    // Free res immediately BEFORE allocating meta_q_out to save 1.6 GB RAM on long tracks!
    free(res);

    bv_init(meta_q_out, hdr_bytes + total_rblocks + esc_i.size + esc_v.size + n + 32);
    bv_u32(meta_q_out, (uint32_t)hdr_bytes);
    bv_u32(meta_q_out, (uint32_t)total_rblocks);
    bv_u32(meta_q_out, n_esc);
    bv_append(meta_q_out, hdr_buf, hdr_bytes);
    bv_append(meta_q_out, k_arr, total_rblocks);
    bv_append(meta_q_out, esc_i.data, esc_i.size);
    bv_append(meta_q_out, esc_v.data, esc_v.size);
    bv_append(meta_q_out, q_bytes, n);
    free(q_bytes); free(hdr_buf); free(k_arr); bv_free(&esc_i); bv_free(&esc_v);
    return 0;
}

static void decode_channel_pitch_ols(const uint8_t* meta_q, size_t m_sz, const uint8_t* rem_p, size_t r_sz, size_t n, int32_t* x_out) {
    (void)m_sz;
    const uint8_t* p = meta_q;
    uint32_t hdr_len = rd_u32(&p), k_len = rd_u32(&p), n_esc = rd_u32(&p);
    const uint8_t* hdr = p; p += hdr_len;
    const uint8_t* k_vals = p; p += k_len;
    const uint8_t* esc_i = p; p += n_esc * 4;
    const uint8_t* esc_v = p; p += n_esc * 4;
    const uint8_t* q_bytes = p;

    uint32_t* q_full = (uint32_t*)malloc((n > 0 ? n : 1) * sizeof(uint32_t));
    for (size_t i = 0; i < n; ++i) q_full[i] = q_bytes[i];
    for (uint32_t i = 0; i < n_esc; ++i) {
        uint32_t idx, val; memcpy(&idx, esc_i + i * 4, 4); memcpy(&val, esc_v + i * 4, 4);
        if (idx < n) q_full[idx] = val;
    }
    BitReader br = { rem_p, r_sz, 0, 0, 0 };
    int32_t* res = (int32_t*)malloc((n > 0 ? n : 1) * sizeof(int32_t));
    size_t blk = 0;
    for (size_t s = 0; s < n; s += RICE_BLOCK, ++blk) {
        size_t e = (s + RICE_BLOCK < n) ? (s + RICE_BLOCK) : n;
        int k = k_vals[blk];
        for (size_t i = s; i < e; ++i) {
            uint64_t rem = (k > 0) ? br_get(&br, k) : 0;
            uint64_t zz = ((uint64_t)q_full[i] << k) | rem;
            res[i] = (int32_t)((int64_t)(zz >> 1) ^ -(int64_t)(zz & 1));
        }
    }
    free(q_full);
    memset(x_out, 0, n * sizeof(int32_t));
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
            for (int k = 0; k < AR_ORDER; ++k) sum += (int64_t)x_out[i - (k + 1)] * (int64_t)w[k];
            for (int pt = -2; pt <= 2; ++pt) sum += (int64_t)x_out[i - lag + pt] * (int64_t)w[AR_ORDER + (pt + 2)];
            x_out[i] = res[i] + (int32_t)((sum + 8192LL) >> 14);
        }
    }
    free(res);
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
    int32_t* ch_buf = (int32_t*)malloc((n + 1) * sizeof(int32_t));
    if (!ch_buf) return -2;
    const uint8_t* pcm_ptr = wav + pcm_off;
    int eq = 1;
    for (size_t i = 0; i < n; ++i) {
        const uint8_t* frame_p = pcm_ptr + i * ch * bps;
        int32_t l_val = read_pcm_sample_v157(frame_p, bits, ftag);
        int32_t r_val = (ch == 2) ? read_pcm_sample_v157(frame_p + bps, bits, ftag) : l_val;
        ch_buf[i] = l_val;
        if (l_val != r_val) eq = 0;
    }
    int mval = (int)mode;
    apply_dynamic_noise_floor_gate32(ch_buf, n, mval, (int)bits, sr);

    ByteVec sh_l, meta_l, rem_l; bv_init(&sh_l, (n / SUBBLOCK_SIZE) + 16);
    strip_wasted_bits32_inplace(ch_buf, n, &sh_l);
    if (encode_channel_pitch_ols(ch_buf, n, &meta_l, &rem_l) != 0) {
        free(ch_buf); bv_free(&sh_l); return -2;
    }

    ByteVec rm; bv_init(&rm, pcm_off + suf_len + sh_l.size + meta_l.size + 1024);
    bv_u32(&rm, (uint32_t)pcm_off); bv_u32(&rm, (uint32_t)suf_len); bv_u32(&rm, (uint32_t)sh_l.size); bv_u32(&rm, (uint32_t)meta_l.size);
    bv_append(&rm, wav, pcm_off); bv_append(&rm, wav + suf_off, suf_len); bv_append(&rm, sh_l.data, sh_l.size); bv_append(&rm, meta_l.data, meta_l.size);
    bv_free(&sh_l); bv_free(&meta_l);

    ByteVec rem_r = { NULL, 0, 0 };
    if (!eq) {
        for (size_t i = 0; i < n; ++i) {
            const uint8_t* frame_p = pcm_ptr + i * ch * bps;
            ch_buf[i] = read_pcm_sample_v157(frame_p + bps, bits, ftag);
        }
        apply_dynamic_noise_floor_gate32(ch_buf, n, mval, (int)bits, sr);
        ByteVec sh_r, meta_r; bv_init(&sh_r, (n / SUBBLOCK_SIZE) + 16);
        strip_wasted_bits32_inplace(ch_buf, n, &sh_r);
        if (encode_channel_pitch_ols(ch_buf, n, &meta_r, &rem_r) != 0) {
            free(ch_buf); bv_free(&sh_r); bv_free(&rm); bv_free(&rem_l); return -2;
        }
        bv_u32(&rm, (uint32_t)sh_r.size); bv_u32(&rm, (uint32_t)meta_r.size);
        bv_append(&rm, sh_r.data, sh_r.size); bv_append(&rm, meta_r.data, meta_r.size);
        bv_free(&sh_r); bv_free(&meta_r);
    }
    // Free ch_buf BEFORE allocating final output fb to cut peak RAM!
    free(ch_buf);

    uint8_t bit_flag = (bits == 24) ? 8 : ((bits == 32) ? 16 : 0);
    uint8_t flags = (eq ? 1 : 0) | ((ch == 1) ? 4 : 0) | bit_flag;
    size_t rm_len = rm.size, rl_len = rem_l.size, rr_len = rem_r.size;
    ByteVec fb; bv_init(&fb, 32 + rm_len + rl_len + rr_len);
    bv_append(&fb, "XFC3", 4); bv_push(&fb, flags); bv_u32(&fb, (uint32_t)n);
    bv_u32(&fb, (uint32_t)rm_len); bv_u32(&fb, (uint32_t)rm_len); bv_u32(&fb, (uint32_t)rl_len); bv_u32(&fb, (uint32_t)rr_len);
    bv_append(&fb, rm.data, rm_len); bv_free(&rm);
    bv_append(&fb, rem_l.data, rl_len); bv_free(&rem_l);
    if (rr_len > 0) bv_append(&fb, rem_r.data, rr_len);
    bv_free(&rem_r);
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

    int32_t* ch_buf = (int32_t*)malloc((n + 1) * sizeof(int32_t));
    if (!ch_buf) return -2;

    size_t ch = mono ? 1 : 2, bps = bits / 8, pcm_b = (size_t)n * ch * bps;
    *out_sz = p_len + pcm_b + s_len;
    *out_w = (uint8_t*)malloc(*out_sz);
    if (!*out_w) { free(ch_buf); *out_sz = 0; return -2; }

    memcpy(*out_w, w_pre, p_len);
    uint8_t* dst = *out_w + p_len;

    decode_channel_pitch_ols(meta_l, ml_len, rl, rl_sz, n, ch_buf);
    restore_wasted_bits32_inplace(ch_buf, n, sh_l);
    if (ch == 1) {
        for (size_t i = 0; i < n; ++i) {
            write_pcm_sample_v157(dst + i * bps, ch_buf[i], bits, ftag);
        }
    } else if (eq) {
        for (size_t i = 0; i < n; ++i) {
            uint8_t* frame_p = dst + i * 2 * bps;
            write_pcm_sample_v157(frame_p, ch_buf[i], bits, ftag);
            write_pcm_sample_v157(frame_p + bps, ch_buf[i], bits, ftag);
        }
    } else {
        for (size_t i = 0; i < n; ++i) {
            write_pcm_sample_v157(dst + i * 2 * bps, ch_buf[i], bits, ftag);
        }
        uint32_t shr_len = rd_u32(&mp), mr_len = rd_u32(&mp);
        const uint8_t* sh_r = mp; mp += shr_len; const uint8_t* meta_r = mp; mp += mr_len;
        decode_channel_pitch_ols(meta_r, mr_len, rr, rr_sz, n, ch_buf);
        restore_wasted_bits32_inplace(ch_buf, n, sh_r);
        for (size_t i = 0; i < n; ++i) {
            write_pcm_sample_v157(dst + i * 2 * bps + bps, ch_buf[i], bits, ftag);
        }
    }
    free(ch_buf);
    if (s_len > 0) memcpy(*out_w + p_len + pcm_b, w_suf, s_len);
    return 0;
}

int xflac_decode_to_wav_file(const uint8_t* xd, size_t x_sz, const char* out_path) {
    if (!out_path) return -1;
    uint8_t* w_buf = NULL;
    size_t w_sz = 0;
    int rc = xflac_decode_wav_mem(xd, x_sz, &w_buf, &w_sz);
    if (rc != 0 || !w_buf || w_sz == 0) {
        if (w_buf) free(w_buf);
        return rc != 0 ? rc : -3;
    }
    FILE* fp = fopen(out_path, "wb");
    if (!fp) {
        free(w_buf);
        return -4;
    }
    size_t written = 0;
    while (written < w_sz) {
        size_t chunk = (w_sz - written > (4 * 1024 * 1024)) ? (4 * 1024 * 1024) : (w_sz - written);
        size_t nw = fwrite(w_buf + written, 1, chunk, fp);
        if (nw == 0) break;
        written += nw;
    }
    fclose(fp);
    free(w_buf);
    return (written == w_sz) ? 0 : -5;
}
void xflac_free(void* ptr) { free(ptr); }
#ifdef __cplusplus
}
#endif
