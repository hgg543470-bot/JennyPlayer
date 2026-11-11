// ============================================================================
// 🎵 WORKER_DECK_A.JS — ИЗОЛИРОВАННЫЙ ФОНОВЫЙ ПОТОК АУДИОДЕКИ А (:8081)
// Выполняется в отдельном потоке ОС Chromium (не касается UI, Деки Б и Торрентов)
// ============================================================================
'use strict';

self.onmessage = function(ev) {
    var msg = ev.data || {};
    var id = msg.id;
    var cmd = msg.cmd;

    try {
        if (cmd === 'reverse_and_rms') {
            var chBuffers = msg.channels || [];
            var numCh = chBuffers.length;
            var outBuffers = new Array(numCh);
            var transferList = [];

            var ch0View = numCh > 0 ? new Float32Array(chBuffers[0]) : null;
            var ch1View = numCh > 1 ? new Float32Array(chBuffers[1]) : ch0View;
            var len = ch0View ? ch0View.length : 0;

            var rmsDb = null;
            if (len > 0 && ch0View) {
                var step = Math.max(1, Math.floor(len / 80000));
                var sumSq = 0.0;
                var count = 0;
                for (var r = 0; r < len; r += step) {
                    var s0 = ch0View[r];
                    var s1 = ch1View ? ch1View[r] : s0;
                    if (s0 === 0 && s1 === 0) continue;
                    var s = 0.5 * (s0 + s1);
                    sumSq += s * s;
                    count++;
                }
                if (count >= 50) {
                    var rms = Math.sqrt(sumSq / count);
                    if (rms >= 0.0001) {
                        rmsDb = 20.0 * Math.log10(rms);
                    }
                }
            }

            for (var c = 0; c < numCh; c++) {
                var arr = new Float32Array(chBuffers[c]);
                var half = arr.length >> 1;
                var last = arr.length - 1;
                for (var i = 0; i < half; i++) {
                    var tmp = arr[i];
                    arr[i] = arr[last - i];
                    arr[last - i] = tmp;
                }
                outBuffers[c] = arr.buffer;
                transferList.push(arr.buffer);
            }

            self.postMessage({ id: id, ok: true, channels: outBuffers, rmsDb: rmsDb }, transferList);
            return;
        }

        if (cmd === 'compute_rms_only') {
            var b0 = msg.ch0 ? new Float32Array(msg.ch0) : null;
            var b1 = msg.ch1 ? new Float32Array(msg.ch1) : b0;
            var total = b0 ? b0.length : 0;
            var computedDb = null;
            if (total > 0 && b0) {
                var stp = Math.max(1, Math.floor(total / 80000));
                var sq = 0.0, cnt = 0;
                for (var k = 0; k < total; k += stp) {
                    var v0 = b0[k], v1 = b1 ? b1[k] : v0;
                    if (v0 === 0 && v1 === 0) continue;
                    var m = 0.5 * (v0 + v1);
                    sq += m * m;
                    cnt++;
                }
                if (cnt >= 50) {
                    var rv = Math.sqrt(sq / cnt);
                    if (rv >= 0.0001) computedDb = 20.0 * Math.log10(rv);
                }
            }
            self.postMessage({ id: id, ok: true, rmsDb: computedDb });
            return;
        }

        self.postMessage({ id: id, ok: false, error: 'unknown_cmd' });
    } catch (err) {
        self.postMessage({ id: id, ok: false, error: String((err && err.message) || err) });
    }
};
