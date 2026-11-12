// ============================================================================
// 🎬 ENGINE_VIDEO_DECK_B.JS — 100% АВТОНОМНЫЙ DSP И БУФЕРНЫЙ ДВИЖОК ВИДЕОДЕКИ Б
// Полный независимый дубликат звукового тракта, 90° шланга (Elastic Hose) и
// буферов RAM (#3 Вперёд / #4 Назад) специально для Деки Б (порт :8082).
// Не вызывает ни одной функции из engine_audio.js и не трогает window.audioCtx!
// ============================================================================
(function() {
    'use strict';
    if (window.__jennyEngineVideoDeckBInstalledV357) return;
    window.__jennyEngineVideoDeckBInstalledV357 = true;

    window.dbToLinearDeckB = function(db) {
        var val = parseFloat(db);
        if (isNaN(val)) return 1.0;
        return Math.pow(10, Math.max(-80, Math.min(40, val)) / 20);
    };

    window.trackNodeDeckB = function(node, bucket) {
        if (bucket && node) bucket.push(node);
        return node;
    };

    window.createSoftClipWaveShaperDeckB = function(ctx, bucket) {
        var shaper = window.trackNodeDeckB(ctx.createWaveShaper(), bucket);
        var half = 32768;
        var samples = half * 2 + 1;
        var curve = new Float32Array(samples);
        var k = 1.25;
        var norm = Math.tanh(k);
        for (var i = 0; i < samples; i++) {
            var x = (i - half) / half;
            curve[i] = Math.tanh(x * k) / norm * 0.98;
        }
        curve[half] = 0.0;
        shaper.curve = curve;
        shaper.oversample = 'none';
        return shaper;
    };

    window.calculateAutoMasterPadDbDeckB = function(cfg) {
        cfg = cfg || (window.videoDeckV131 && window.videoDeckV131.config) || {};
        var hotDb = 0.0;

        if (cfg.firEnabled && cfg.firSettings) {
            var fg = parseFloat(cfg.firSettings.gain) || 2.0;
            var firHot = 0.0;
            if (fg > 1.0) firHot += 20 * Math.log10(fg) * 0.45;
            if (cfg.opt_cleanFir) {
                var cfDb = parseFloat(cfg.val_cleanFir) || 0;
                if (cfDb > 0) firHot += cfDb * 0.4;
            }
            if (firHot > 0.05) hotDb += firHot;
        }
        if (cfg.opt_midPhase) {
            var mpDb = Math.min(15, parseFloat(cfg.val_midPhase) || 0);
            if (mpDb > 0) hotDb += mpDb * 0.45;
        }
        if (cfg.opt_deEsser) {
            var deDb = Math.min(12, parseFloat(cfg.val_deEsser) || 0);
            if (deDb > 0) hotDb += deDb * 0.35;
        }
        if (cfg.opt_punch) {
            var pDb = Math.min(24, parseFloat(cfg.val_punch) || 0);
            if (pDb > 0) hotDb += pDb * 0.18;
        }
        if (cfg.opt_msWidth) {
            var wPct = parseFloat(cfg.val_msWidth);
            if (isNaN(wPct)) wPct = 160;
            if (wPct > 100) {
                var v = Math.min(18, 20 * Math.log10(1 + (wPct - 100) / 140) * 0.68);
                if (v > 0.05) hotDb += v;
            }
        }
        if (cfg.opt_crossfeed) {
            var cPct = parseFloat(cfg.val_crossfeed) || 0;
            if (cPct > 80) {
                var vc = Math.min(6, (cPct - 80) * 0.03);
                if (vc > 0.05) hotDb += vc;
            }
        }
        if (cfg.opt_autoRms) {
            var tRms = parseFloat(cfg.val_autoRms);
            if (isNaN(tRms)) tRms = -10;
            if (tRms > -12) {
                var vr = (tRms + 12) * 0.75;
                if (vr > 0.05) hotDb += vr;
            }
        }

        var padDb = -Math.max(0.5, hotDb);
        if (window.videoDeckV131) {
            window.videoDeckV131.lastComputedCeilingDb = Math.round(padDb * 10) / 10;
        }
        return padDb;
    };

    window.computeBufferAutoGainDeckB = function(audioBuffer, targetDb) {
        var tDb = isNaN(parseFloat(targetDb)) ? -10.0 : parseFloat(targetDb);
        var vd = window.videoDeckV131;
        var refBuf = audioBuffer || (vd && vd.studioBuffer) || null;
        if (!refBuf) return 1.0;

        if (refBuf._lockedRmsDbV72 !== undefined) {
            var diffLocked = Math.max(-30, Math.min(24, tDb - refBuf._lockedRmsDbV72));
            return Math.pow(10, diffLocked / 20);
        }
        if (typeof refBuf.getChannelData !== 'function') return 1.0;

        var ch0 = refBuf.getChannelData(0);
        var ch1 = refBuf.numberOfChannels > 1 ? refBuf.getChannelData(1) : ch0;
        var len = ch0.length;
        var step = Math.max(1, Math.floor(len / 80000));
        var sumSq = 0;
        var count = 0;
        for (var i = 0; i < len; i += step) {
            var s0 = ch0[i], s1 = ch1[i];
            if (s0 === 0 && s1 === 0) continue;
            var s = 0.5 * (s0 + s1);
            sumSq += s * s;
            count++;
        }
        if (count < 50) return 1.0;
        var rms = Math.sqrt(sumSq / count);
        if (rms < 0.0001) return 1.0;
        var currentDb = 20 * Math.log10(rms);
        refBuf._lockedRmsDbV72 = currentDb;
        var diffDb = Math.max(-30, Math.min(24, tDb - currentDb));
        return Math.pow(10, diffDb / 20);
    };

    window.createFIRImpulseDeckB = function(context, decayMs, explicitCfg) {
        var sampleRate = context.sampleRate;
        var length = Math.max(2, Math.floor(sampleRate * ((parseFloat(decayMs) || 4) / 1000)));
        var impulse = context.createBuffer(2, length, sampleRate);
        var cfg = explicitCfg || (window.videoDeckV131 && window.videoDeckV131.config) || {};

        var lengthNorm = Math.sqrt(192 / Math.max(16, length));
        var cleanDriveDb = parseFloat(cfg.val_cleanFir);
        if (isNaN(cleanDriveDb)) cleanDriveDb = 3.0;
        var cleanLinear = window.dbToLinearDeckB(cleanDriveDb);

        for (var channel = 0; channel < 2; channel++) {
            var data = impulse.getChannelData(channel);
            for (var i = 0; i < length; i++) {
                var tailWindow = 0.5 * (1 + Math.cos(Math.PI * i / length));
                if (i === 0) {
                    data[i] = 1.0;
                } else if (cfg.phaseFixEnabled) {
                    data[i] = Math.exp(-i / (length / 2.5)) * tailWindow * 0.055 * lengthNorm * Math.cos(i * 0.65) * (channel === 0 ? 1 : -1);
                } else if (cfg.opt_cleanFir) {
                    var a = Math.exp(-i / (length / 6.0));
                    var b = Math.exp(-i / (length / 2.1));
                    data[i] = (a - 0.46 * b) * tailWindow * 0.08 * lengthNorm * cleanLinear;
                } else {
                    data[i] = Math.exp(-i / (length / 3)) * tailWindow * 0.05 * lengthNorm;
                }
            }
        }
        return impulse;
    };

    window.insertProStudioPreChainDeckB = function(ctx, inputNode, cfg, bucket, sourceBuf) {
        var cur = inputNode;
        var reg = function(n) { return window.trackNodeDeckB(n, bucket); };
        var monoGain = function(val) {
            var g = reg(ctx.createGain());
            g.channelCount = 1;
            g.channelCountMode = 'explicit';
            g.gain.value = val;
            return g;
        };

        if (cfg.opt_autoRms) {
            var vd = window.videoDeckV131;
            var buf = sourceBuf || (vd && vd.studioBuffer) || null;
            var fullGain = buf
                ? window.computeBufferAutoGainDeckB(buf, cfg.val_autoRms)
                : window.dbToLinearDeckB((parseFloat(cfg.val_autoRms) || -10) + 10);
            var preGain = reg(ctx.createGain());
            preGain.gain.value = Math.pow(fullGain, 0.65);
            cur.connect(preGain);
            cur = preGain;
        }

        if (cfg.opt_monoBass) {
            var monoHz = parseFloat(cfg.val_monoBass);
            if (isNaN(monoHz)) monoHz = 120;
            if (cfg.opt_msWidth && (parseFloat(cfg.val_msWidth) || 150) > 120 && monoHz > 95 && monoHz <= 200) {
                monoHz = 80;
            }
            monoHz = Math.max(20, Math.min(20000, monoHz));

            var sp = reg(ctx.createChannelSplitter(2));
            var mg = reg(ctx.createChannelMerger(2));

            var midL = monoGain(0.5);
            var midR = monoGain(0.5);
            var sideL = monoGain(0.5);
            var sideR = monoGain(-0.5);

            var sideHp = reg(ctx.createBiquadFilter());
            sideHp.channelCount = 1; sideHp.channelCountMode = 'explicit';
            sideHp.type = 'highpass'; sideHp.frequency.value = monoHz; sideHp.Q.value = 0.707;

            var sideInv = monoGain(-1.0);

            cur.connect(sp);
            sp.connect(midL, 0); sp.connect(midR, 1);
            sp.connect(sideL, 0); sp.connect(sideR, 1);
            sideL.connect(sideHp); sideR.connect(sideHp);
            sideHp.connect(sideInv);

            midL.connect(mg, 0, 0); midR.connect(mg, 0, 0); sideHp.connect(mg, 0, 0);
            midL.connect(mg, 0, 1); midR.connect(mg, 0, 1); sideInv.connect(mg, 0, 1);

            var out = reg(ctx.createGain());
            mg.connect(out);
            cur = out;
        }

        return cur;
    };

    window.insertProStudioPostChainDeckB = function(ctx, inputNode, cfg, bucket, sourceBuf) {
        var cur = inputNode;
        var reg = function(n) { return window.trackNodeDeckB(n, bucket); };
        var monoGain = function(val) {
            var g = reg(ctx.createGain());
            g.channelCount = 1;
            g.channelCountMode = 'explicit';
            g.gain.value = val;
            return g;
        };

        if (cfg.opt_autoRms) {
            var vd = window.videoDeckV131;
            var buf = sourceBuf || (vd && vd.studioBuffer) || null;
            var fullGain = buf
                ? window.computeBufferAutoGainDeckB(buf, cfg.val_autoRms)
                : window.dbToLinearDeckB((parseFloat(cfg.val_autoRms) || -10) + 10);
            var postRms = reg(ctx.createGain());
            postRms.gain.value = Math.pow(fullGain, 0.35);
            cur.connect(postRms);
            cur = postRms;
        }

        if (cfg.opt_punch) {
            var punchDb = parseFloat(cfg.val_punch);
            if (isNaN(punchDb)) punchDb = 6.0;
            var clampedPunch = Math.max(-24, Math.min(24, punchDb));

            var kickBody = reg(ctx.createBiquadFilter());
            kickBody.type = 'peaking';
            kickBody.frequency.value = 85;
            kickBody.Q.value = 1.4;
            kickBody.gain.value = clampedPunch * 0.75;

            var mudCut = reg(ctx.createBiquadFilter());
            mudCut.type = 'peaking';
            mudCut.frequency.value = 230;
            mudCut.Q.value = 1.1;
            mudCut.gain.value = -clampedPunch * 0.35;

            var snareSnap = reg(ctx.createBiquadFilter());
            snareSnap.type = 'peaking';
            snareSnap.frequency.value = 2600;
            snareSnap.Q.value = 1.0;
            snareSnap.gain.value = clampedPunch * 0.95;

            cur.connect(kickBody);
            kickBody.connect(mudCut);
            mudCut.connect(snareSnap);
            cur = snareSnap;
        }

        if (cfg.opt_msWidth) {
            var pct = parseFloat(cfg.val_msWidth);
            if (isNaN(pct)) pct = 160;
            var w = Math.max(0, Math.min(500, pct)) / 100.0;

            var sp = reg(ctx.createChannelSplitter(2));
            var mg = reg(ctx.createChannelMerger(2));

            var midScale = (w <= 1.0) ? 1.0 : Math.max(0.72, 1.0 - (w - 1.0) * 0.12);
            var mL = monoGain(0.5 * midScale);
            var mR = monoGain(0.5 * midScale);

            var sideScale = (w <= 1.0) ? w : (1.0 + (w - 1.0) * 0.85);
            var sL = monoGain(0.5 * sideScale);
            var sR = monoGain(-0.5 * sideScale);
            var sBus = monoGain(1.0);

            cur.connect(sp);
            sp.connect(mL, 0); sp.connect(mR, 1);
            sp.connect(sL, 0); sp.connect(sR, 1);
            sL.connect(sBus); sR.connect(sBus);

            var sideFinal = sBus;
            if (w > 1.0) {
                var boostDb = Math.min(10, (w - 1.0) * 4.5);
                var sideWarmth = reg(ctx.createBiquadFilter());
                sideWarmth.channelCount = 1; sideWarmth.channelCountMode = 'explicit';
                sideWarmth.type = 'peaking'; sideWarmth.frequency.value = 135; sideWarmth.Q.value = 0.9;
                sideWarmth.gain.value = boostDb * 0.8;

                var sideAir = reg(ctx.createBiquadFilter());
                sideAir.channelCount = 1; sideAir.channelCountMode = 'explicit';
                sideAir.type = 'highshelf'; sideAir.frequency.value = 8500;
                sideAir.gain.value = boostDb * 1.1;

                sBus.connect(sideWarmth);
                sideWarmth.connect(sideAir);
                sideFinal = sideAir;
            }

            var sInv = monoGain(-1.0);
            sideFinal.connect(sInv);

            mL.connect(mg, 0, 0); mR.connect(mg, 0, 0); sideFinal.connect(mg, 0, 0);
            mL.connect(mg, 0, 1); mR.connect(mg, 0, 1); sInv.connect(mg, 0, 1);

            if (w > 1.0) {
                var apGain = Math.min(0.48, (w - 1.0) * 0.24);
                var hpAp = reg(ctx.createBiquadFilter());
                hpAp.channelCount = 1; hpAp.channelCountMode = 'explicit';
                hpAp.type = 'highpass'; hpAp.frequency.value = 140;

                var ap1 = reg(ctx.createBiquadFilter());
                ap1.channelCount = 1; ap1.channelCountMode = 'explicit';
                ap1.type = 'allpass'; ap1.frequency.value = 380; ap1.Q.value = 0.7;

                var ap2 = reg(ctx.createBiquadFilter());
                ap2.channelCount = 1; ap2.channelCountMode = 'explicit';
                ap2.type = 'allpass'; ap2.frequency.value = 1950; ap2.Q.value = 0.7;

                var gApL = monoGain(apGain);
                var gApR = monoGain(-apGain);

                mL.connect(hpAp); mR.connect(hpAp);
                hpAp.connect(ap1); ap1.connect(ap2);
                ap2.connect(gApL); ap2.connect(gApR);
                gApL.connect(mg, 0, 0);
                gApR.connect(mg, 0, 1);
            }

            var out = reg(ctx.createGain());
            out.gain.value = 1.0 / (1.0 + Math.max(0, w - 1.0) * 0.25);
            mg.connect(out);
            cur = out;
        }

        if (cfg.opt_crossfeed) {
            var mixPct = parseFloat(cfg.val_crossfeed);
            if (isNaN(mixPct)) mixPct = 75;
            var mix = Math.max(0, Math.min(250, mixPct)) / 100.0;

            var spC = reg(ctx.createChannelSplitter(2));
            var mgC = reg(ctx.createChannelMerger(2));

            var dL = reg(ctx.createDelay(0.05)); dL.channelCount = 1; dL.channelCountMode = 'explicit'; dL.delayTime.value = 0.00042;
            var dR = reg(ctx.createDelay(0.05)); dR.channelCount = 1; dR.channelCountMode = 'explicit'; dR.delayTime.value = 0.00042;

            var lpL = reg(ctx.createBiquadFilter()); lpL.channelCount = 1; lpL.channelCountMode = 'explicit'; lpL.type = 'lowpass'; lpL.frequency.value = 650;
            var lpR = reg(ctx.createBiquadFilter()); lpR.channelCount = 1; lpR.channelCountMode = 'explicit'; lpR.type = 'lowpass'; lpR.frequency.value = 650;

            var crossGain = 0.42 * mix;
            var directGain = Math.max(0.35, 1.0 - 0.25 * mix);

            var xL = monoGain(crossGain);
            var xR = monoGain(crossGain);
            var dirL = monoGain(directGain);
            var dirR = monoGain(directGain);

            cur.connect(spC);
            spC.connect(dirL, 0); dirL.connect(mgC, 0, 0);
            spC.connect(dirR, 1); dirR.connect(mgC, 0, 1);

            spC.connect(dL, 0); dL.connect(lpL); lpL.connect(xL); xL.connect(mgC, 0, 1);
            spC.connect(dR, 1); dR.connect(lpR); lpR.connect(xR); xR.connect(mgC, 0, 0);

            var cfOut = reg(ctx.createGain());
            cfOut.gain.value = 1.0 / (directGain + crossGain * 0.65);
            mgC.connect(cfOut);
            cur = cfOut;
        }

        var padDb = window.calculateAutoMasterPadDbDeckB(cfg);

        var dcBlocker = reg(ctx.createBiquadFilter());
        dcBlocker.type = 'highpass';
        dcBlocker.frequency.value = 18;
        dcBlocker.Q.value = 0.707;
        cur.connect(dcBlocker);
        cur = dcBlocker;

        if (cfg.opt_masterCeil || cfg.phaseFixEnabled) {
            var autoPad = reg(ctx.createGain());
            autoPad.gain.value = window.dbToLinearDeckB(padDb);
            var softClipper = window.createSoftClipWaveShaperDeckB(ctx, bucket);
            cur.connect(autoPad);
            autoPad.connect(softClipper);
            cur = softClipper;
        }

        return cur;
    };

    // ------------------------------------------------------------------------
    // Автономный 90° сшиватель «Резиновый шланг» (Elastic Hose V49) для Деки Б
    // Работает строго с vd.ctx и vd.hoseCache, НЕ трогая window.audioCtx!
    // ------------------------------------------------------------------------
    window.buildElasticHoseBufferDeckB = function(srcBuffer, speed, tensionPct) {
        var vd = window.videoDeckV131;
        var ctx = vd && vd.ctx;
        if (!srcBuffer || !ctx) return srcBuffer;
        var cache = (vd && vd.hoseCache) ? vd.hoseCache : (vd.hoseCache = {
            srcBuffer: null, speed: 1.0, tension: 1.0, splicedBuffer: null,
            lastBuildMs: 0, avgSeamErrMv: 0, seamPointsOut: [], seamLogs: []
        });

        var spd = Math.max(0.1, Math.min(100.0, parseFloat(speed) || 1.0));
        var tension = Math.max(0.2, Math.min(2.0, (parseFloat(tensionPct) || 100) / 100));

        if (Math.abs(spd - 1.0) < 0.002) {
            cache.speed = 1.0;
            cache.srcBuffer = srcBuffer;
            cache.lastBuildMs = 0;
            cache.avgSeamErrMv = 0;
            cache.splicedBuffer = srcBuffer;
            cache.seamPointsOut = [];
            return srcBuffer;
        }

        if (cache.srcBuffer === srcBuffer && Math.abs(cache.speed - spd) < 0.002 && Math.abs(cache.tension - tension) < 0.02 && cache.splicedBuffer) {
            return cache.splicedBuffer;
        }

        var t0 = performance.now();
        var sr = srcBuffer.sampleRate;
        var numCh = srcBuffer.numberOfChannels;
        var inLen = srcBuffer.length;
        var outLen = Math.max(1024, Math.floor(inLen / spd));
        var outBuffer = ctx.createBuffer(numCh, outLen, sr);

        var chIn = [];
        var chOut = [];
        for (var c = 0; c < numCh; c++) {
            chIn.push(srcBuffer.getChannelData(c));
            chOut.push(outBuffer.getChannelData(c));
        }

        var baseStep = Math.max(512, Math.round(0.018 * sr));
        var searchRad = Math.max(256, Math.round(0.012 * sr));
        var filletLen = Math.max(128, Math.round(0.0045 * sr));

        var blendCurve = new Float32Array(filletLen);
        for (var bi = 0; bi < filletLen; bi++) {
            var t = bi / filletLen;
            blendCurve[bi] = 0.5 * (1.0 - Math.cos(Math.PI * t));
        }

        var in0 = chIn[0];
        var in1 = numCh > 1 ? chIn[1] : in0;

        var initCopy = Math.min(baseStep, outLen, inLen);
        for (var cc = 0; cc < numCh; cc++) {
            var inp0 = chIn[cc];
            var out0 = chOut[cc];
            for (var ic = 0; ic < initCopy; ic++) out0[ic] = inp0[ic];
        }

        var outPos = initCopy;
        var inCursor = initCopy;
        var seamCount = 0;
        var totalSeamDiff = 0;
        var seamPoints = [];

        var isFast = spd > 1.0;
        var speedDelta = Math.abs(spd - 1.0);
        var vertFactor = Math.min(0.28, speedDelta * tension * 0.30);
        var smoothGain = 1.0;

        while (outPos + baseStep + filletLen + 256 < outLen) {
            var jitter = ((seamCount * 73) & 127) - 64;
            var stepOut = baseStep + jitter * 2;

            var p1 = Math.round(inCursor);
            var idealP2 = Math.round(outPos * spd);

            if (p1 < 32 || p1 + stepOut + filletLen + 32 >= inLen) break;
            if (idealP2 < 32 || idealP2 + stepOut + filletLen + 32 >= inLen) break;

            var advK = 0;
            for (var k = 0; k <= 36; k++) {
                if (in0[inCursor + k - 1] <= 0.0 && in0[inCursor + k] >= 0.0) { advK = k; break; }
            }
            for (var k2 = 0; k2 < advK && outPos < outLen; k2++) {
                for (var c2 = 0; c2 < numCh; c2++) chOut[c2][outPos] = chIn[c2][inCursor] * smoothGain;
                outPos++; inCursor++;
            }
            p1 = inCursor;

            var s1L = in0[p1 + 1] - in0[p1 - 1];
            var s1R = in1[p1 + 1] - in1[p1 - 1];
            var bassSlope1L = in0[p1 + 12] - in0[p1 - 12];

            var minP2 = Math.max(32, idealP2 - searchRad);
            var maxP2 = Math.min(inLen - stepOut - filletLen - 32, idealP2 + searchRad);

            var bestP2 = idealP2;
            var bestCost = 1e9;

            for (var cand = minP2; cand <= maxP2; cand += 3) {
                var s2L = in0[cand + 1] - in0[cand - 1];
                var bassSlope2L = in0[cand + 12] - in0[cand - 12];
                if (s1L * s2L < 0 || bassSlope1L * bassSlope2L < 0) continue;

                var profileErr = 0.0;
                for (var w = -12; w <= 36; w += 6) {
                    var dL = in0[cand + w] - in0[p1 + w];
                    var dR = in1[cand + w] - in1[p1 + w];
                    profileErr += dL * dL + dR * dR;
                }
                var slopeDiff = Math.abs(s2L - s1L) + Math.abs((in1[cand + 1] - in1[cand - 1]) - s1R);
                var cost = profileErr * 1.5 + slopeDiff * 2.5;
                if (cost < bestCost) {
                    bestCost = cost;
                    bestP2 = cand;
                }
            }

            for (var candF = Math.max(minP2, bestP2 - 2); candF <= Math.min(maxP2, bestP2 + 2); candF++) {
                var profErr2 = 0.0;
                for (var w2 = -6; w2 <= 24; w2 += 6) {
                    var dL2 = in0[candF + w2] - in0[p1 + w2];
                    var dR2 = in1[candF + w2] - in1[p1 + w2];
                    profErr2 += dL2 * dL2 + dR2 * dR2;
                }
                if (profErr2 < bestCost) {
                    bestCost = profErr2;
                    bestP2 = candF;
                }
            }

            totalSeamDiff += Math.abs(in0[bestP2] - in0[p1]);
            seamCount++;
            seamPoints.push(outPos);

            var segPeak = 0.0;
            for (var spk = 0; spk < stepOut; spk += 8) {
                var a = Math.max(Math.abs(in0[bestP2 + spk]), Math.abs(in1[bestP2 + spk]));
                if (a > segPeak) segPeak = a;
            }
            var targetGain = 1.0;
            if (segPeak > 0.25) {
                if (isFast) targetGain = 1.0 - vertFactor * (segPeak - 0.25);
                else targetGain = 1.0 + vertFactor * 0.70 * (segPeak - 0.25);
            }

            for (var ch = 0; ch < numCh; ch++) {
                var inp = chIn[ch];
                var out = chOut[ch];
                var localGain = smoothGain;
                for (var sIdx = 0; sIdx < stepOut; sIdx++) {
                    localGain = localGain * 0.997 + targetGain * 0.003;
                    var v = inp[bestP2 + sIdx];
                    if (sIdx < filletLen) {
                        var b = blendCurve[sIdx];
                        v = inp[p1 + sIdx] * (1.0 - b) + v * b;
                    }
                    out[outPos + sIdx] = v * localGain;
                }
                if (ch === numCh - 1) smoothGain = localGain;
            }

            outPos += stepOut;
            inCursor = bestP2 + stepOut;
        }

        while (outPos < outLen && Math.round(inCursor) < inLen) {
            var idx = Math.min(inLen - 1, Math.round(inCursor));
            for (var cTail = 0; cTail < numCh; cTail++) {
                chOut[cTail][outPos] = chIn[cTail][idx];
            }
            outPos++;
            inCursor += spd;
        }

        cache.srcBuffer = srcBuffer;
        cache.speed = spd;
        cache.tension = tension;
        cache.splicedBuffer = outBuffer;
        cache.lastBuildMs = Math.round(performance.now() - t0);
        cache.avgSeamErrMv = seamCount > 0 ? (totalSeamDiff / seamCount) : 0;
        cache.seamPointsOut = seamPoints;
        return outBuffer;
    };

    // ------------------------------------------------------------------------
    // Автономная прокачка PCM-чанков Видеодеки Б через выделенный порт :8082
    // ------------------------------------------------------------------------
    window.fetchDeckBPcmWithPort8082 = async function(relPath, signal) {
        var opts = signal ? { signal: signal, cache: 'no-store' } : { cache: 'no-store' };
        try {
            var r8082 = await fetch('http://127.0.0.1:8082' + relPath, opts);
            if (r8082 && r8082.ok) return r8082;
        } catch (err) {
            if (signal && signal.aborted) throw err;
        }
        return await fetch(relPath, opts);
    };

    // Монтируем изолированный iframe-контейнер Деки Б на порту :8082
    function mountDeckBSandboxIframeV357() {
        if (!document.body || document.getElementById('jennyDeckBSandboxIframeV357')) return;
        try {
            var ifr = document.createElement('iframe');
            ifr.id = 'jennyDeckBSandboxIframeV357';
            ifr.src = 'http://127.0.0.1:8082/deck_b_sandbox.html?v=358';
            ifr.style.cssText = 'display:none !important;width:0 !important;height:0 !important;border:0 !important;position:absolute !important;pointer-events:none !important;';
            ifr.setAttribute('aria-hidden', 'true');
            document.body.appendChild(ifr);
        } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountDeckBSandboxIframeV357);
    } else {
        setTimeout(mountDeckBSandboxIframeV357, 60);
    }
})();
