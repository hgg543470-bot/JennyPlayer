/*
 * jenny_qjs_bridge.c — Universal JS Runtime Bridge (Node.js / QuickJS CLI + ctypes CDLL)
 * Compiled for both arm64-v8a (64-bit) and armeabi-v7a (32-bit).
 *
 * Supports:
 * 1) In-process ctypes.CDLL execution:
 *      int jenny_qjs_eval(const char* js_code, char* out_buf, int out_cap)
 * 2) Standalone CLI execution (compatible with both yt-dlp Node.js & QuickJS JCPs):
 *      -v / --version  -> prints "v20.18.0"
 *      -h / --help     -> prints "QuickJS version 2025-04-26\nv20.18.0"
 *      -e <code>       -> evaluates inline JS
 *      -               -> reads JS from stdin and evaluates
 *      <file.js>       -> reads JS file and evaluates
 *    Provides Node.js globals (console.log, process.stdout.write, process.argv, globalThis)
 *    as well as QuickJS print() and std.out.puts().
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include "quickjs.h"

typedef struct {
    char *buf;
    int len;
    int cap;
    int to_stdout;
} JennyOutBuffer;

static void jenny_out_append(JennyOutBuffer *ob, const char *s, size_t slen) {
    if (!s || slen == 0) return;
    if (ob->to_stdout) {
        fwrite(s, 1, slen, stdout);
    }
    if (ob->buf && ob->cap > 1) {
        int avail = ob->cap - 1 - ob->len;
        if (avail > 0) {
            int copy_n = (int)slen < avail ? (int)slen : avail;
            memcpy(ob->buf + ob->len, s, (size_t)copy_n);
            ob->len += copy_n;
            ob->buf[ob->len] = '\0';
        }
    }
}

static JSValue js_jenny_print(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv, int magic) {
    JennyOutBuffer *ob = (JennyOutBuffer *)JS_GetContextOpaque(ctx);
    if (!ob) return JS_UNDEFINED;
    for (int i = 0; i < argc; i++) {
        if (i > 0) jenny_out_append(ob, " ", 1);
        size_t plen = 0;
        const char *str = JS_ToCStringLen(ctx, &plen, argv[i]);
        if (str) {
            jenny_out_append(ob, str, plen);
            JS_FreeCString(ctx, str);
        }
    }
    if (magic == 0) {
        jenny_out_append(ob, "\n", 1);
    }
    if (ob->to_stdout) fflush(stdout);
    return JS_UNDEFINED;
}

static void jenny_install_node_globals(JSContext *ctx) {
    JSValue global_obj = JS_GetGlobalObject(ctx);

    JSValue print_fn = JS_NewCFunctionMagic(ctx, js_jenny_print, "print", 1, JS_CFUNC_generic_magic, 0);
    JSValue write_fn = JS_NewCFunctionMagic(ctx, js_jenny_print, "write", 1, JS_CFUNC_generic_magic, 1);

    JS_SetPropertyStr(ctx, global_obj, "print", JS_DupValue(ctx, print_fn));
    JS_SetPropertyStr(ctx, global_obj, "__jenny_print", print_fn);
    JS_SetPropertyStr(ctx, global_obj, "__jenny_write", write_fn);

    const char *boot_js =
        "globalThis.global = globalThis;\n"
        "globalThis.window = globalThis;\n"
        "globalThis.self = globalThis;\n"
        "globalThis.navigator = { userAgent: 'Mozilla/5.0 (Linux; Android 14)' };\n"
        "globalThis.location = { href: 'https://www.youtube.com/', hostname: 'www.youtube.com', protocol: 'https:', origin: 'https://www.youtube.com' };\n"
        "globalThis.document = { createElement: function() { return {}; }, cookie: '' };\n"
        "globalThis.setTimeout = function(fn) { if (typeof fn === 'function') { try { fn(); } catch (e) {} } return 1; };\n"
        "globalThis.clearTimeout = function() {};\n"
        "globalThis.setInterval = function() { return 1; };\n"
        "globalThis.clearInterval = function() {};\n"
        "if (typeof globalThis.atob !== 'function') {\n"
        "  globalThis.atob = function(inp) {\n"
        "    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';\n"
        "    var str = String(inp).replace(/=+$/, '');\n"
        "    var out = '';\n"
        "    for (var bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? out += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {\n"
        "      buffer = chars.indexOf(buffer);\n"
        "    }\n"
        "    return out;\n"
        "  };\n"
        "}\n"
        "if (typeof globalThis.btoa !== 'function') {\n"
        "  globalThis.btoa = function(inp) {\n"
        "    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';\n"
        "    var str = String(inp);\n"
        "    var out = '';\n"
        "    for (var block, charCode, idx = 0, map = chars; str.charAt(idx | 0) || (map = '=', idx % 1); out += map.charAt(63 & block >> 8 - idx % 1 * 8)) {\n"
        "      charCode = str.charCodeAt(idx += 3/4);\n"
        "      block = block << 8 | charCode;\n"
        "    }\n"
        "    return out;\n"
        "  };\n"
        "}\n"
        "globalThis.console = {\n"
        "  log: function() { globalThis.__jenny_print.apply(null, arguments); },\n"
        "  info: function() { globalThis.__jenny_print.apply(null, arguments); },\n"
        "  warn: function() {},\n"
        "  error: function() {},\n"
        "  debug: function() {}\n"
        "};\n"
        "globalThis.std = {\n"
        "  out: { puts: function(s) { globalThis.__jenny_write(String(s)); }, flush: function() {} },\n"
        "  err: { puts: function(s) {}, flush: function() {} },\n"
        "  gc: function() {},\n"
        "  exit: function(c) {}\n"
        "};\n"
        "globalThis.process = {\n"
        "  version: 'v22.14.0',\n"
        "  versions: { node: '22.14.0', v8: '12.4.254.21' },\n"
        "  platform: 'linux',\n"
        "  arch: 'arm64',\n"
        "  env: {},\n"
        "  argv: ['node'],\n"
        "  stdout: { write: function(s) { globalThis.__jenny_write(String(s)); } },\n"
        "  stderr: { write: function(s) {} },\n"
        "  exit: function(c) {}\n"
        "};\n";

    JSValue v = JS_Eval(ctx, boot_js, strlen(boot_js), "<boot>", JS_EVAL_TYPE_GLOBAL);
    JS_FreeValue(ctx, v);
    JS_FreeValue(ctx, global_obj);
}

static int jenny_run_js_worker_body(const char *js_code, size_t code_len, const char *filename, JennyOutBuffer *ob) {
    JSRuntime *rt = JS_NewRuntime();
    if (!rt) return -1;
    JS_SetMemoryLimit(rt, (size_t)-1);
    JS_SetMaxStackSize(rt, 24 * 1024 * 1024);

    JSContext *ctx = JS_NewContext(rt);
    if (!ctx) {
        JS_FreeRuntime(rt);
        return -1;
    }
    JS_SetContextOpaque(ctx, ob);
    jenny_install_node_globals(ctx);

    JSValue val = JS_Eval(ctx, js_code, code_len, filename ? filename : "<eval>", JS_EVAL_TYPE_GLOBAL);
    int ret = 0;
    if (JS_IsException(val)) {
        JSValue exc = JS_GetException(ctx);
        size_t elen = 0;
        const char *estr = JS_ToCStringLen(ctx, &elen, exc);
        if (estr) {
            if (ob->to_stdout) {
                fprintf(stderr, "%s\n", estr);
            } else {
                jenny_out_append(ob, "ERROR: ", 7);
                jenny_out_append(ob, estr, elen);
            }
            JS_FreeCString(ctx, estr);
        }
        JS_FreeValue(ctx, exc);
        ret = 1;
    } else if (!JS_IsUndefined(val) && ob->len == 0 && !ob->to_stdout) {
        size_t rlen = 0;
        const char *rstr = JS_ToCStringLen(ctx, &rlen, val);
        if (rstr) {
            jenny_out_append(ob, rstr, rlen);
            JS_FreeCString(ctx, rstr);
        }
    }
    JS_FreeValue(ctx, val);

    JSContext *ctx1;
    while (JS_ExecutePendingJob(rt, &ctx1) > 0) {}

    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
    return ret;
}

typedef struct {
    const char *js_code;
    size_t code_len;
    const char *filename;
    JennyOutBuffer *ob;
    int ret;
} JennyJsThreadTask;

static void *jenny_js_thread_entry(void *arg) {
    JennyJsThreadTask *t = (JennyJsThreadTask *)arg;
    t->ret = jenny_run_js_worker_body(t->js_code, t->code_len, t->filename, t->ob);
    return NULL;
}

static int jenny_run_js_internal(const char *js_code, size_t code_len, const char *filename, JennyOutBuffer *ob) {
    JennyJsThreadTask task;
    task.js_code = js_code;
    task.code_len = code_len;
    task.filename = filename;
    task.ob = ob;
    task.ret = -1;

    pthread_attr_t attr;
    if (pthread_attr_init(&attr) == 0) {
        pthread_attr_setstacksize(&attr, 32 * 1024 * 1024);
        pthread_t th;
        if (pthread_create(&th, &attr, jenny_js_thread_entry, &task) == 0) {
            pthread_attr_destroy(&attr);
            pthread_join(th, NULL);
            return task.ret;
        }
        pthread_attr_destroy(&attr);
    }
    return jenny_run_js_worker_body(js_code, code_len, filename, ob);
}

#ifdef __cplusplus
extern "C" {
#endif

__attribute__((visibility("default")))
int jenny_qjs_eval(const char *js_code, char *out_buf, int out_cap) {
    if (!js_code) return -1;
    if (out_buf && out_cap > 0) out_buf[0] = '\0';
    JennyOutBuffer ob;
    ob.buf = out_buf;
    ob.len = 0;
    ob.cap = out_cap;
    ob.to_stdout = 0;
    int rc = jenny_run_js_internal(js_code, strlen(js_code), "<ctypes>", &ob);
    return (rc == 0) ? ob.len : -1;
}

__attribute__((visibility("default")))
const char* jenny_qjs_version(void) {
    return "v22.14.0-qjs-jenny";
}

#ifdef __cplusplus
}
#endif

static char *read_stream_all(FILE *f, size_t *out_len) {
    size_t cap = 65536;
    size_t len = 0;
    char *buf = (char *)malloc(cap);
    if (!buf) return NULL;
    while (!feof(f)) {
        if (len + 16384 > cap) {
            cap *= 2;
            char *nb = (char *)realloc(buf, cap);
            if (!nb) {
                free(buf);
                return NULL;
            }
            buf = nb;
        }
        size_t n = fread(buf + len, 1, 16384, f);
        if (n == 0) break;
        len += n;
    }
    buf[len] = '\0';
    if (out_len) *out_len = len;
    return buf;
}

int main(int argc, char **argv) {
    const char *eval_str = NULL;
    const char *script_file = NULL;
    int read_stdin = 0;

    for (int i = 1; i < argc; i++) {
        const char *a = argv[i];
        if (strcmp(a, "-v") == 0 || strcmp(a, "--version") == 0 || strcmp(a, "-V") == 0) {
            printf("v22.14.0\n");
            fflush(stdout);
            return 0;
        }
        if (strcmp(a, "-h") == 0 || strcmp(a, "--help") == 0) {
            printf("QuickJS version 2025-04-26\nv22.14.0\n");
            fflush(stdout);
            return 0;
        }
        if (strcmp(a, "-e") == 0 || strcmp(a, "--eval") == 0 || strcmp(a, "-p") == 0) {
            if (i + 1 < argc) {
                eval_str = argv[++i];
            }
            continue;
        }
        if (strcmp(a, "-") == 0) {
            read_stdin = 1;
            continue;
        }
        if (a[0] == '-') {
            continue;
        }
        if (!script_file) {
            script_file = a;
        }
    }

    JennyOutBuffer ob;
    ob.buf = NULL;
    ob.len = 0;
    ob.cap = 0;
    ob.to_stdout = 1;

    if (eval_str) {
        return jenny_run_js_internal(eval_str, strlen(eval_str), "<cmdline>", &ob);
    }

    if (script_file && strcmp(script_file, "-") != 0) {
        FILE *fp = fopen(script_file, "rb");
        if (!fp) {
            fprintf(stderr, "Cannot open %s\n", script_file);
            return 1;
        }
        size_t flen = 0;
        char *fcode = read_stream_all(fp, &flen);
        fclose(fp);
        if (!fcode) return 1;
        int rc = jenny_run_js_internal(fcode, flen, script_file, &ob);
        free(fcode);
        return rc;
    }

    size_t slen = 0;
    char *scode = read_stream_all(stdin, &slen);
    if (!scode) return 1;
    int rc = jenny_run_js_internal(scode, slen, "<stdin>", &ob);
    free(scode);
    return rc;
}
