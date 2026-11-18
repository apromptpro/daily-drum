'use strict';
// Candidate recognisers ("engine 2"). Not used by the app unless engine 2 is switched on; Ear.classify stays the default.
// Both work on the same 48-number fingerprints the app has always saved, so every existing calibration stays usable.
//   makeNmf: explains a hit as a sum of taught hits (how much of each pad is in it) and names every pad with a clear share.
//   makeNet: a small neural network with one yes/no output per instrument, trained on the taught hits and on
//            artificial mixtures of them.
const Ear2 = (() => {
  const D = NB * 2;
  // Energy per band, not normalised. Same bands and windows as fingerprint() in audio.js.
  function bandEnergies(samples, sampleRate) {
    const feat = new Float32Array(D), lo = 60, hi = Math.min(14000, sampleRate / 2 - 100), half = FRAME / 2;
    for (let f = 0; f < 2; f++) {
      const buf = new Float32Array(FRAME);
      if (f === 0) for (let i = 0; i < FRAME; i++) buf[i] = (samples[i] || 0) * 0.5 * (1 + Math.cos(Math.PI * i / FRAME));
      else for (let i = 0; i < half; i++) buf[i] = (samples[half + i] || 0) * 0.5 * (1 - Math.cos(2 * Math.PI * i / half));
      const p = powerSpectrum(buf), binHz = sampleRate / FRAME;
      for (let b = 1; b < p.length; b++) { const hz = b * binHz; if (hz < lo || hz >= hi) continue; feat[f * NB + Math.min(NB - 1, Math.floor(NB * Math.log(hz / lo) / Math.log(hi / lo)))] += p[b]; }
    }
    return feat;
  }
  // What a sound that was already ringing before the hit would add to the capture, judged from the samples before it.
  function background(pre, sampleRate) {
    const n = pre.length, buf = new Float32Array(FRAME), out = new Float32Array(D);
    for (let i = 0; i < n; i++) buf[i] = pre[i] * 0.5 * (1 - Math.cos(2 * Math.PI * i / n));
    const p = powerSpectrum(buf), binHz = sampleRate / FRAME, lo = 60, hi = Math.min(14000, sampleRate / 2 - 100);
    for (let b = 1; b < p.length; b++) {
      const hz = b * binHz; if (hz < lo || hz >= hi) continue;
      const band = Math.min(NB - 1, Math.floor(NB * Math.log(hz / lo) / Math.log(hi / lo)));
      out[band] += p[b] * FRAME / n; out[NB + band] += p[b] * (FRAME / 2) / n;
    }
    return out;
  }
  const total = (v) => { let s = 0; for (let i = 0; i < v.length; i++) s += v[i]; return s; };
  const unit = (v) => { const s = total(v) || 1, o = new Float32Array(v.length); for (let i = 0; i < v.length; i++) o[i] = v[i] / s; return o; };
  const binsPerBand = (sampleRate) => { const c = new Float32Array(D), lo = 60, hi = Math.min(14000, sampleRate / 2 - 100); for (let b = 1; b < FRAME / 2; b++) { const hz = b * sampleRate / FRAME; if (hz < lo || hz >= hi) continue; const k = Math.min(NB - 1, Math.floor(NB * Math.log(hz / lo) / Math.log(hi / lo))); c[k]++; c[NB + k] += 0.5; } return c; };
  function groups(T) {
    const insts = [], keys = Object.keys(T).filter(k => k !== '_click');
    keys.forEach(k => k.split('+').forEach(p => { if (insts.indexOf(canon(p)) < 0) insts.push(canon(p)); }));
    return { insts, keys };
  }
  // Which pads to name, from how strongly each one shows. Pads the lesson expects need less proof; a pad that is
  // known to "leak" into another (they sound alike) needs more.
  function decide(ev, insts, opts, P, leak) {
    const exp = {}; let lesson = false;
    (opts && opts.expected || []).forEach(l => { lesson = true; l.forEach(p => { exp[p] = true; }); });
    const order = insts.map((p, i) => i).sort((a, b) => ev[b] - ev[a]), got = [];
    for (const q of order) {
      if (got.length >= 3) break;
      let need = exp[insts[q]] ? P.tE : lesson ? P.tU : P.tO;
      if (!got.length) need = Math.max(need, P.top);
      if (leak) for (const p of got) need += P.kappa * leak[p][q] * ev[p];
      if (ev[q] >= need) got.push(q);
    }
    return got;
  }

  // ---------- 1. sum of taught hits ----------
  const NMF_P = { tE: 0.08, tU: 0.22, tO: 0.16, top: 0.25, kappa: 1.3, iters: 40, unknown: 0.5, noiseMax: 0.6, clickMin: 0.75 };
  function makeNmf(T, params) {
    const P = Object.assign({}, NMF_P, params || {}), { insts, keys } = groups(T);
    const atoms = [];
    keys.forEach(k => { const pads = canonPads(k.split('+')).map(p => insts.indexOf(p)); T[k].samples.forEach(s => atoms.push({ v: s, pads, key: k })); });
    if (T._click) T._click.samples.forEach(s => atoms.push({ v: s, pads: [], click: true }));
    const flat = new Float32Array(D).fill(1 / D);
    atoms.push({ v: flat, pads: [], noise: true });
    const K = atoms.length, W = new Float32Array((K + 1) * D);
    atoms.forEach((a, k) => W.set(a.v, k * D));
    const h = new Float32Array(K + 1), r = new Float32Array(D);
    function decompose(x, skip, bg) {
      const n = bg ? K + 1 : K;
      if (bg) W.set(bg, K * D);
      for (let k = 0; k < n; k++) h[k] = k === skip ? 0 : 1 / n;
      for (let it = 0; it < P.iters; it++) {
        r.fill(1e-7);
        for (let k = 0; k < n; k++) { const hk = h[k]; if (hk < 1e-9) continue; const o = k * D; for (let i = 0; i < D; i++) r[i] += hk * W[o + i]; }
        for (let i = 0; i < D; i++) r[i] = x[i] / r[i];
        for (let k = 0; k < n; k++) { if (h[k] < 1e-9) { h[k] = 0; continue; } const o = k * D; let s = 0; for (let i = 0; i < D; i++) s += W[o + i] * r[i]; h[k] *= s; }
      }
      const ev = new Float32Array(insts.length), byKey = {};
      let click = 0, noise = 0;
      for (let k = 0; k < K; k++) { const a = atoms[k]; if (a.click) click += h[k]; else if (a.noise) noise += h[k]; else { a.pads.forEach(p => { ev[p] += h[k]; }); if (a.pads.length === 1) byKey[a.key] = (byKey[a.key] || 0) + h[k]; } }
      const rec = new Float32Array(D);
      for (let k = 0; k < n; k++) { const o = k * D; for (let i = 0; i < D; i++) rec[i] += h[k] * W[o + i]; }
      const heard = Math.max(0.05, 1 - (bg ? h[K] : 0));   // the share of the sound that is new, not what was already ringing
      const rest = Math.max(0.05, heard - click);           // ... and is not the metronome click either
      for (let i = 0; i < ev.length; i++) ev[i] /= rest;
      return { ev, click: click / heard, noise: noise / rest, byKey, rec };
    }
    // How much of pad q appears when only pad p was hit: each taught hit is explained without itself.
    const leak = insts.map(() => new Float32Array(insts.length));
    atoms.forEach((a, k) => {
      if (a.pads.length !== 1) return;
      const d = decompose(a.v, k, null), p = a.pads[0];
      for (let q = 0; q < insts.length; q++) if (q !== p) leak[p][q] = Math.max(leak[p][q], Math.min(3, d.ev[q] / Math.max(0.2, d.ev[p])));
    });
    function classify(feat, opts, bg) {
      const d = decompose(feat, -1, bg || null);
      const score = dot(shape(feat), shape(d.rec));
      let top = 0; for (let i = 0; i < d.ev.length; i++) if (d.ev[i] > top) top = d.ev[i];
      if (d.click > P.clickMin) return { pads: [], keys: [], score, click: true };
      if (score < P.unknown || d.noise > P.noiseMax) return { pads: [], keys: [], score };
      const got = decide(d.ev, insts, opts, P, leak);
      const pads = got.map(i => insts[i]);
      const ks = pads.map(p => { let best = null; keys.forEach(k => { if (k.indexOf('+') < 0 && canon(k) === p && (best === null || (d.byKey[k] || 0) > (d.byKey[best] || 0))) best = k; }); return best || p; });
      const ev = {}; insts.forEach((p, i) => { ev[p] = d.ev[i]; });
      return { pads, keys: ks, score, lead: got.length ? d.ev[got[0]] : 0, ev };
    }
    return { classify, insts, leak, size: W.length * 4 };
  }

  // ---------- 2. small neural network ----------
  const NET_P = { hidden: 32, steps: 2500, batch: 48, lr: 0.01, tE: 0.3, tU: 0.6, tO: 0.5, top: 0.35, kappa: 0, seed: 5 };
  // waves: optional { key: [Float32Array(2048) captures] } and sampleRate, for mixing real waveforms instead of fingerprints
  function makeNet(T, params, waves, sampleRate) {
    const P = Object.assign({}, NET_P, params || {}), { insts, keys } = groups(T);
    let s = P.seed >>> 0;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(6.2832 * rnd());
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const O = insts.length + 1, H = P.hidden, bins = binsPerBand(sampleRate || 48000);
    const singles = keys.filter(k => k.indexOf('+') < 0), combos = keys.filter(k => k.indexOf('+') > 0);
    const byInst = insts.map(p => singles.filter(k => canon(k) === p)).map(l => l.length ? l : null);
    const playable = insts.map((p, i) => i).filter(i => byInst[i]);
    const one = (key) => { const sm = T[key].samples, a = pick(sm), b = pick(sm), w = rnd(), o = new Float32Array(D); for (let i = 0; i < D; i++) o[i] = w * a[i] + (1 - w) * b[i]; return o; };
    // A mixture as fingerprints: band energies add, plus the swing that two sounds in the same band cause.
    const mixFeat = (parts) => { const o = new Float32Array(D); for (let i = 0; i < D; i++) { let e = 0, amp = 0; parts.forEach(([v, w]) => { e += w * v[i]; amp += Math.sqrt(w * v[i]); }); const cross = (amp * amp - e) * Math.cos(6.2832 * rnd()) / Math.sqrt(Math.max(1, bins[i])); o[i] = Math.max(0, e + (parts.length > 1 ? 0.5 * cross : 0)); } return o; };
    const mixWave = (list) => { const buf = new Float32Array(FRAME); list.forEach(([w, g, lag]) => { for (let i = lag; i < FRAME; i++) buf[i] += g * w[i - lag]; }); return bandEnergies(buf, sampleRate); };
    const pool = [];
    if (waves) {   // real waveforms of two or three taught hits added together, a few milliseconds apart
      for (let n = 0; n < (P.pool || 3000); n++) {
        const m = rnd() < 0.75 ? 2 : 3, ids = [];
        while (ids.length < Math.min(m, playable.length)) { const i = pick(playable); if (ids.indexOf(i) < 0) ids.push(i); }
        const parts = ids.map((i, j) => { const w = pick(waves[pick(byInst[i])]); let e = 0; for (let t = 0; t < FRAME; t++) e += w[t] * w[t]; const db = j === 0 ? 0 : (rnd() * 2 - 1) * 12; return [w, Math.pow(10, db / 20) / Math.sqrt(e || 1), j === 0 ? 0 : Math.floor((rnd() < 0.8 ? rnd() * 0.012 : rnd() * 0.03) * sampleRate)]; });
        const y = new Float32Array(O), es = parts.map(p => p[1] * p[1]), tot = es.reduce((a, b) => a + b, 0);
        ids.forEach((i, j) => { y[i] = es[j] / tot >= 0.05 ? 1 : es[j] / tot >= 0.025 ? -1 : 0; });
        pool.push([unit(mixWave(parts)), y]);
      }
    }
    function example() {
      const y = new Float32Array(O), u = rnd();
      let x;
      if (u < 0.3) { const i = pick(playable); x = one(pick(byInst[i])); y[i] = 1; }
      else if (u < 0.8) {
        if (combos.length && rnd() < 0.5) { const k = pick(combos); x = one(k); canonPads(k.split('+')).forEach(p => { y[insts.indexOf(p)] = 1; }); }
        else if (pool.length) { const e = pick(pool); x = e[0]; y.set(e[1]); }
        else {
          const m = rnd() < 0.75 ? 2 : 3, ids = [];
          while (ids.length < Math.min(m, playable.length)) { const i = pick(playable); if (ids.indexOf(i) < 0) ids.push(i); }
          const ws = ids.map((i, j) => Math.pow(10, (j === 0 ? 0 : (rnd() * 2 - 1) * 12) / 10)), tot = ws.reduce((a, b) => a + b, 0);
          x = mixFeat(ids.map((i, j) => [one(pick(byInst[i])), ws[j] / tot]));
          ids.forEach((i, j) => { y[i] = ws[j] / tot >= 0.05 ? 1 : ws[j] / tot >= 0.025 ? -1 : 0; });
        }
      } else if (u < 0.9 && T._click) {
        const c = pick(T._click.samples);
        if (rnd() < 0.5) { x = Float32Array.from(c); y[O - 1] = 1; }
        else { const i = pick(playable), w = 0.25 + 0.6 * rnd(); x = mixFeat([[one(pick(byInst[i])), w], [c, 1 - w]]); y[i] = 1; y[O - 1] = -1; }
      } else {   // something that is no drum: a smooth random spectrum
        x = new Float32Array(D); let v = 0; const tilt = gauss() * 0.3;
        for (let f = 0; f < 2; f++) for (let i = 0; i < NB; i++) { v = 0.7 * v + gauss(); x[f * NB + i] = Math.exp(v + tilt * i) * (f ? 0.5 : 1); }
      }
      const e = rnd() * 0.06;
      for (let i = 0; i < D; i++) x[i] = Math.max(0, x[i]);
      x = unit(x);
      for (let i = 0; i < D; i++) x[i] = (1 - e) * x[i] + e / D;
      return [x, y];
    }
    const prep = (x) => { const z = shape(x); for (let i = 0; i < D; i++) z[i] *= 7; return z; };
    const W1 = new Float32Array(H * D), b1 = new Float32Array(H), W2 = new Float32Array(O * H), b2 = new Float32Array(O);
    for (let i = 0; i < W1.length; i++) W1[i] = gauss() * Math.sqrt(2 / D);
    for (let i = 0; i < W2.length; i++) W2[i] = gauss() * Math.sqrt(1 / H);
    const par = [W1, b1, W2, b2], g = par.map(p => new Float32Array(p.length)), m1 = par.map(p => new Float32Array(p.length)), m2 = par.map(p => new Float32Array(p.length));
    const hid = new Float32Array(H), out = new Float32Array(O);
    function forward(z) {
      for (let j = 0; j < H; j++) { let a = b1[j]; const o = j * D; for (let i = 0; i < D; i++) a += W1[o + i] * z[i]; hid[j] = a > 0 ? a : 0; }
      for (let k = 0; k < O; k++) { let a = b2[k]; const o = k * H; for (let j = 0; j < H; j++) a += W2[o + j] * hid[j]; out[k] = 1 / (1 + Math.exp(-a)); }
    }
    const t0 = (typeof performance !== 'undefined' ? performance.now() : 0), dh = new Float32Array(H);
    for (let step = 1; step <= P.steps; step++) {
      g.forEach(a => a.fill(0));
      for (let n = 0; n < P.batch; n++) {
        const [x, y] = example(), z = prep(x);
        forward(z);
        dh.fill(0);
        for (let k = 0; k < O; k++) { if (y[k] < 0) continue; const d = out[k] - y[k]; g[3][k] += d; const o = k * H; for (let j = 0; j < H; j++) { g[2][o + j] += d * hid[j]; dh[j] += d * W2[o + j]; } }
        for (let j = 0; j < H; j++) { if (hid[j] <= 0) continue; const d = dh[j]; g[1][j] += d; const o = j * D; for (let i = 0; i < D; i++) g[0][o + i] += d * z[i]; }
      }
      const lr = P.lr * (step < P.steps * 0.6 ? 1 : 0.3), c1 = 1 - Math.pow(0.9, step), c2 = 1 - Math.pow(0.999, step);
      par.forEach((p, a) => { for (let i = 0; i < p.length; i++) { const gr = g[a][i] / P.batch; m1[a][i] = 0.9 * m1[a][i] + 0.1 * gr; m2[a][i] = 0.999 * m2[a][i] + 0.001 * gr * gr; p[i] -= lr * (m1[a][i] / c1) / (Math.sqrt(m2[a][i] / c2) + 1e-8); } });
    }
    const trainMs = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    function classify(feat, opts, bg, abs) {
      let x = feat;
      if (bg && abs) { const c = new Float32Array(D); for (let i = 0; i < D; i++) c[i] = Math.max(abs[i] - bg[i], 0.02 * abs[i]); x = unit(c); }
      forward(prep(x));
      const ev = out.slice(0, O - 1);
      let top = 0; for (let i = 0; i < ev.length; i++) if (ev[i] > top) top = ev[i];
      if (out[O - 1] > 0.5 && out[O - 1] > top) return { pads: [], keys: [], score: out[O - 1], click: true };
      const got = decide(ev, insts, opts, P, null), pads = got.map(i => insts[i]);
      const evm = {}; insts.forEach((p, i) => { evm[p] = ev[i]; });
      return { pads, keys: pads.slice(), score: top, lead: top, ev: evm };
    }
    return { classify, insts, trainMs, size: (W1.length + b1.length + W2.length + b2.length) * 4 };
  }
  // The fingerprint of a hit with the sound that was already ringing taken away.
  function cleaned(abs, bg) { const c = new Float32Array(D); for (let i = 0; i < D; i++) c[i] = Math.max(abs[i] - bg[i], 0.02 * abs[i]); return unit(c); }
  return { bandEnergies, background, cleaned, unit, total, makeNmf, makeNet };
})();
