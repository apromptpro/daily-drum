'use strict';
// Sound input, "which pad was that?" recognition, and the metronome click.

const NB = 24;            // frequency bands per frame
const FRAME = 2048;       // samples captured per hit (about 43 ms)
const UNKNOWN_BELOW = 0.55;
const PAIR_MARGIN = 0.03; // a two-pad guess must beat the best one-pad guess by this much

function powerSpectrum(re) {
  const n = re.length;
  const im = new Float32Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  const out = new Float32Array(n >> 1);
  for (let i = 0; i < out.length; i++) out[i] = re[i] * re[i] + im[i] * im[i];
  return out;
}

// Turns the captured sound of one hit into a "fingerprint": energy per frequency band,
// once weighted towards the attack (whole capture, fading out) and once for the body (second half only).
// Normalised so loudness does not matter.
function fingerprint(samples, sampleRate) {
  const feat = new Float32Array(NB * 2);
  const lo = 60, hi = Math.min(14000, sampleRate / 2 - 100);
  const half = FRAME / 2;
  for (let f = 0; f < 2; f++) {
    const buf = new Float32Array(FRAME);
    if (f === 0) {
      for (let i = 0; i < FRAME; i++) buf[i] = (samples[i] || 0) * 0.5 * (1 + Math.cos(Math.PI * i / FRAME));
    } else {
      for (let i = 0; i < half; i++) buf[i] = (samples[half + i] || 0) * 0.5 * (1 - Math.cos(2 * Math.PI * i / half));
    }
    const p = powerSpectrum(buf);
    const binHz = sampleRate / FRAME;
    for (let b = 1; b < p.length; b++) {
      const hz = b * binHz;
      if (hz < lo || hz >= hi) continue;
      const band = Math.min(NB - 1, Math.floor(NB * Math.log(hz / lo) / Math.log(hi / lo)));
      feat[f * NB + band] += p[b];
    }
  }
  let sum = 0;
  for (let i = 0; i < feat.length; i++) sum += feat[i];
  if (sum > 0) for (let i = 0; i < feat.length; i++) feat[i] /= sum;
  return feat;
}

function shape(v) { // log-compress and centre, so comparison looks at the spectrum's shape
  const out = new Float32Array(v.length);
  let m = 0;
  for (let i = 0; i < v.length; i++) { out[i] = Math.log(1e-4 + v[i]); m += out[i]; }
  m /= v.length;
  let n = 0;
  for (let i = 0; i < v.length; i++) { out[i] -= m; n += out[i] * out[i]; }
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < v.length; i++) out[i] /= n;
  return out;
}
function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
function mix(a, b, wa) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = wa * a[i] + (1 - wa) * b[i];
  return out;
}
const PAIR_WEIGHTS = [[0.5, 0.5], [0.3, 0.7], [0.7, 0.3], [0.15, 0.85], [0.85, 0.15]];
const TRIPLE_WEIGHTS = [[0.34, 0.33, 0.33], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6], [0.45, 0.45, 0.1], [0.45, 0.1, 0.45], [0.1, 0.45, 0.45]];
function blend(list, ws) {
  const out = new Float32Array(list[0].length);
  list.forEach((v, k) => { for (let i = 0; i < out.length; i++) out[i] += ws[k] * v[i]; });
  return out;
}
function meanOf(list) {
  const out = new Float32Array(list[0].length);
  for (const v of list) for (let i = 0; i < out.length; i++) out[i] += v[i] / list.length;
  return out;
}

// A hit as a small piece of text: about a fifth of a second, thinned out to roughly 16000 values a second,
// as loud as it will go, one byte for each value. Small enough to keep with the taught pads.
function packSound(head, tail, rate) {
  const n = head.length + (tail ? tail.length : 0), f = Math.max(1, Math.round(rate / 16000)), m = Math.floor(n / f);
  const at = (i) => (i < head.length ? head[i] : tail[i - head.length]);
  const v = new Float32Array(m);
  let peak = 1e-4;
  for (let j = 0; j < m; j++) { let s = 0; for (let k = 0; k < f; k++) s += at(j * f + k); v[j] = s / f; const a = Math.abs(v[j]); if (a > peak) peak = a; }
  let bin = '';
  for (let j = 0; j < m; j++) bin += String.fromCharCode(Math.max(0, Math.min(255, Math.round(v[j] / peak * 127 + 128))));
  return Math.round(rate / f) + ':' + btoa(bin);
}

// Some instruments can be played from two places on the pad (two crash pads; the kick as a pedal or as the Bass Drum pad).
// Each place is taught on its own, under its own key, and they all count as the same instrument.
const ALIAS = { crash2: 'crash', kickpad: 'kick', hihatopen: 'hihat' };   // hihatopen = the hi-hat pad with the pedal up (long ring)
const canon = (k) => ALIAS[k] || k;
const canonPads = (keys) => keys.map(canon).filter((p, i, a) => a.indexOf(p) === i);

// ----- ready-made drum sounds -----
// A new player has taught nothing yet. So that the app can listen from the first minute, it starts with its own idea
// of what each drum sounds like: typical kick, snare, cymbal and tom sounds, worked out here with plain arithmetic.
// They are a guess. A real pad plays its own recordings through its own small speaker, so the pad check in Setup
// shows how well they fit, and any pad can be taught properly, which then replaces the ready-made sound.
const STARTER_BELOW = 0.45;   // ready-made sounds are only roughly right, so a weaker match is still accepted
const STARTER_KIT = {
  kick: [{ f0: 150, f1: 50, dur: 0.25, vol: 1 }, { hp: 2000, dur: 0.012, vol: 0.2 }],
  snare: [{ hp: 1500, dur: 0.16, vol: 0.6 }, { f0: 220, f1: 160, dur: 0.1, vol: 0.5 }],
  hihat: [{ hp: 7000, dur: 0.05, vol: 0.5 }],
  hihatopen: [{ hp: 6500, dur: 0.6, vol: 0.5 }],
  hhpedal: [{ hp: 4500, dur: 0.03, vol: 0.4 }],
  crash: [{ hp: 3500, dur: 0.9, vol: 0.5 }],
  ride: [{ hp: 8000, dur: 0.3, vol: 0.3 }, { f0: 900, f1: 880, dur: 0.25, vol: 0.25 }],
  tom1: [{ f0: 220, f1: 150, dur: 0.3, vol: 1 }],
  tom2: [{ f0: 165, f1: 110, dur: 0.3, vol: 1 }],
  tom3: [{ f0: 120, f1: 75, dur: 0.35, vol: 1 }]
};
function highpass(buf, hz, sr) {
  const w = 2 * Math.PI * hz / sr, cs = Math.cos(w), al = Math.sin(w) / 1.414;
  const b0 = (1 + cs) / 2 / (1 + al), b1 = -(1 + cs) / (1 + al), a1 = -2 * cs / (1 + al), a2 = (1 - al) / (1 + al);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) { const x = buf[i], y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; buf[i] = y; }
  return buf;
}
// One ready-made hit. pitch makes it a little higher or lower; speaker cuts the deep notes the way a small speaker does.
function starterHit(parts, pitch, speaker, seed) {
  const sr = 44100, out = new Float32Array(FRAME);
  let rnd = seed;
  const noise = () => { rnd = (rnd * 1664525 + 1013904223) >>> 0; return rnd / 2147483648 - 1; };
  parts.forEach(p => {
    const part = new Float32Array(FRAME);
    if (p.hp) {
      for (let i = 0; i < FRAME; i++) part[i] = noise();
      highpass(part, p.hp * pitch, sr);
    } else {
      let ph = 0;
      for (let i = 0; i < FRAME; i++) {
        const t = i / sr, f = p.f0 * Math.pow(p.f1 / p.f0, Math.min(1, t / (p.dur * 0.6))) * pitch;
        ph += 2 * Math.PI * f / sr;
        part[i] = Math.sin(ph);
      }
    }
    for (let i = 0; i < FRAME; i++) out[i] += part[i] * p.vol * Math.exp(-6.9 * (i / sr) / p.dur);
  });
  if (speaker) highpass(out, speaker, sr);
  return fingerprint(out, sr);
}
function starterFeats(key) {
  return [[1, 0, 11], [0.88, 180, 23], [1.15, 300, 37], [1, 300, 51]].map(v => starterHit(STARTER_KIT[key], v[0], v[1], v[2]));
}

const Ear = {
  starter: {},            // padId -> true while its sound is the ready-made one, not taught from the real pad
  // Gives every pad that was never taught its ready-made sound.
  addStarters() {
    const add = {};
    Object.keys(STARTER_KIT).forEach(k => { if (!this.templates[k]) { add[k] = this.makeTemplate(starterFeats(k)); this.starter[k] = true; } });
    if (Object.keys(add).length) this.templates = Object.assign({}, this.templates, add);
  },
  taughtIds() { return this.padIds().filter(k => !this.starter[k]); },
  ctx: null, stream: null, src: null, node: null, monitor: null, moduleLoaded: false,
  listening: false, deviceLabel: '',
  templates: {},          // padId -> { mean: Float32Array, samples: [Float32Array] }; "_click" = metronome heard by the input
  onHit: null,            // ({ time, peak, feat })
  onLevel: null,          // (rms)
  onOnset: null,          // (time) fires the instant a hit starts, before the pad is known
  clickVolume: 0.5,

  ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
    }
    if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); }   // "interrupted" on an iPad counts too
    return this.ctx;
  },

  async listInputs() {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter(d => d.kind === 'audioinput');
  },

  // The small program that finds hits in the sound. Fetched once; it can be fetched ahead of time, before the
  // microphone is asked for, so pressing Start has nothing left to wait for.
  loadModule() {
    if (this.moduleLoaded) return Promise.resolve();
    if (!this._mod) {
      this._mod = this.ensureCtx().audioWorklet.addModule('worklet.js').then(() => { this.moduleLoaded = true; }, (e) => { this._mod = null; throw e; });
    }
    return this._mod;
  },

  async start(deviceId) {
    this.stop();
    const ctx = this.ensureCtx();
    const base = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: Object.assign({}, base, deviceId ? { deviceId: { exact: deviceId } } : {}) });
    } catch (e) {
      if (!deviceId) throw e;
      stream = await navigator.mediaDevices.getUserMedia({ audio: base }); // saved device is gone: use the default
    }
    try { await this.loadModule(); } catch (e) { stream.getTracks().forEach(t => t.stop()); throw e; }
    this.stream = stream;
    const track = stream.getAudioTracks()[0];
    this.deviceLabel = track ? track.label : '';
    // Microphone unplugged or taken away by another program: say so instead of silently hearing nothing.
    if (track) track.onended = () => { if (this.stream === stream) { this.stop(); if (this.onLost) this.onLost(); } };
    this.src = ctx.createMediaStreamSource(stream);
    this.node = new AudioWorkletNode(ctx, 'onset-processor', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    this.node.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'level') { if (this.onLevel) this.onLevel(d.rms); }
      else if (d.type === 'onset') { if (this.onOnset) this.onOnset(d.time); }
      else if (d.type === 'hit' && this.onHit) {
        const feat = fingerprint(d.samples, ctx.sampleRate);
        feat.snd = packSound(d.samples, null, ctx.sampleRate);   // the first 43 ms now; the rest follows in a moment
        this._last = { time: d.time, feat, head: d.samples };
        if (d.time < this.deafUntil) return;   // the app is playing a saved hit back: that is not the player
        this.onHit({ time: d.time, peak: d.peak, feat });
      } else if (d.type === 'tail' && this._last && this._last.time === d.time) {
        this._last.feat.snd = packSound(this._last.head, d.samples, ctx.sampleRate);
        this._last = null;
        if (this.onSound) this.onSound();
      }
    };
    const mute = ctx.createGain();
    mute.gain.value = 0;
    this.src.connect(this.node);
    this.node.connect(mute).connect(ctx.destination);
    this.monitor = ctx.createGain();
    this.monitor.gain.value = 0;
    this.src.connect(this.monitor).connect(ctx.destination);
    this.listening = true;
    return this.deviceLabel;
  },

  stop() {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    try { if (this.src) this.src.disconnect(); } catch (e) {}
    try { if (this.node) this.node.disconnect(); } catch (e) {}
    this.stream = this.src = this.node = this.monitor = null;
    this.listening = false;
  },

  setFloor(v) { if (this.node) this.node.port.postMessage({ floor: v }); },
  setMonitor(on) { if (this.monitor) this.monitor.gain.value = on ? 1 : 0; },

  // atLeast: lowest volume to use (measuring clicks must be audible even when the metronome is turned down to zero)
  click(time, accent, atLeast) {
    const ctx = this.ensureCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 1200; // same pitch for every click so the input can learn to ignore it
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, Math.max(this.clickVolume, atLeast || 0) * (accent ? 1 : 0.55)), time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    o.connect(g).connect(ctx.destination);
    o.start(time);
    o.stop(time + 0.06);
  },

  // ----- sounds the app plays itself: demo drums and the song melody -----
  _noiseHit(time, dur, highpass, vol) {
    const ctx = this.ctx;
    if (!this._noise) {
      this._noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this._noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource();
    s.buffer = this._noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = highpass;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    s.connect(f).connect(g).connect(ctx.destination);
    s.start(time); s.stop(time + dur + 0.02);
  },
  _thump(time, f0, f1, dur, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(f0, time);
    o.frequency.exponentialRampToValueAtTime(f1, time + dur * 0.6);
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g).connect(ctx.destination);
    o.start(time); o.stop(time + dur + 0.02);
  },
  drum(pad, time) {
    this.ensureCtx();
    const v = 0.7;
    if (pad === 'kick') this._thump(time, 150, 45, 0.28, v);
    else if (pad === 'snare') { this._noiseHit(time, 0.16, 1500, v * 0.6); this._thump(time, 220, 160, 0.1, v * 0.5); }
    else if (pad === 'hihat') this._noiseHit(time, 0.05, 7000, v * 0.35);
    else if (pad === 'hhpedal') this._noiseHit(time, 0.04, 6000, v * 0.3);
    else if (pad === 'crash') this._noiseHit(time, 0.9, 4500, v * 0.4);
    else if (pad === 'ride') { this._noiseHit(time, 0.3, 8000, v * 0.22); this._thump(time, 900, 880, 0.2, v * 0.08); }
    else if (pad === 'tom1') this._thump(time, 220, 150, 0.3, v * 0.8);
    else if (pad === 'tom2') this._thump(time, 165, 110, 0.3, v * 0.8);
    else if (pad === 'tom3') this._thump(time, 120, 75, 0.35, v * 0.8);
  },
  // A soft melody note. The slow fade-in keeps the microphone from mistaking it for a drum hit.
  tone(freq, time, dur, vol) {
    const ctx = this.ensureCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    const end = time + Math.max(0.12, dur);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.05);
    g.gain.setValueAtTime(vol, end - 0.06);
    g.gain.linearRampToValueAtTime(0, end);
    o.connect(g).connect(ctx.destination);
    o.start(time); o.stop(end + 0.02);
  },

  makeTemplate(samples) { return { mean: meanOf(samples), samples: samples }; },

  // ----- the sound of a taught hit, kept so that it can be played back in Setup -----
  deafUntil: 0,
  playSound(snd) {
    if (!snd) return 0;
    const ctx = this.ensureCtx(), at = snd.indexOf(':'), rate = +snd.slice(0, at), bin = atob(snd.slice(at + 1));
    const buf = ctx.createBuffer(1, bin.length, rate), d = buf.getChannelData(0);
    for (let i = 0; i < bin.length; i++) d[i] = (bin.charCodeAt(i) - 128) / 127;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = buf; g.gain.value = 0.8;
    s.connect(g).connect(ctx.destination);
    const t = ctx.currentTime + 0.03;
    s.start(t);
    this.deafUntil = t + buf.duration + 0.25;   // the microphone hears it too: do not take it for a hit
    return buf.duration;
  },
  exportSounds() {
    const out = {};
    for (const k of Object.keys(this.templates)) if (k !== '_click' && !this.starter[k]) out[k] = this.templates[k].samples.map(s => s.snd || '');
    return out;
  },
  importSounds(obj) {
    for (const k of Object.keys(obj || {})) {
      const t = this.templates[k];
      if (t && Array.isArray(obj[k]) && obj[k].length === t.samples.length) t.samples.forEach((s, i) => { if (obj[k][i]) s.snd = obj[k][i]; });
    }
  },

  padIds() { return Object.keys(this.templates).filter(k => k !== '_click' && k.indexOf('+') < 0); },
  comboIds() { return Object.keys(this.templates).filter(k => k.indexOf('+') > 0); },   // pads taught as hit together, e.g. "hihat+kick"
  knows(pad) { return this.padIds().some(k => canon(k) === pad); },   // has any place that plays this instrument been taught?

  // Decide which pad (or pads hit together) a fingerprint belongs to.
  // opts.expected: pad lists the lesson expects right now (gets a small benefit of the doubt, and is
  //                the only way pads-at-once are guessed from single-pad sounds during a lesson)
  // opts.allPairs: consider every pair of pads (used on the test screen)
  // Returns { pads: instruments, keys: the taught places that matched, score }.
  classify(feat, opts) {
    opts = opts || {};
    const T = this.templates;
    const ids = this.padIds();
    if (!ids.length) return { pads: [], keys: [], score: 0 };
    const x = shape(feat);
    const expected = (opts.expected || []).map(p => p.slice().sort().join('+'));
    const isExpected = (keys) => expected.indexOf(canonPads(keys).sort().join('+')) >= 0;
    const click = T._click ? T._click.mean : null;
    // Prepared comparison shapes are kept until the calibration changes, so each hit costs only a few dot products.
    if (this._cacheFor !== T) { this._cache = {}; this._cacheFor = T; }
    const cache = this._cache;
    const shaped = (key, make) => cache[key] || (cache[key] = shape(make()));
    const cands = [];
    const consider = (keys, cacheKey, make, taught) => {
      const raw = dot(x, shaped(cacheKey, make));
      const c = { keys, raw, size: canonPads(keys).length, exp: isExpected(keys), taught: !!taught };
      cands.push(c);
      return c;
    };
    for (const id of ids) {
      const c = consider([id], id, () => T[id].mean);
      // Besides the average sound of the pad, look at the two taught hits that are most like this one. A pad that
      // sounds different when hit hard or soft, or in the middle or at the edge, is then still recognised.
      const sm = T[id].samples;
      if (sm.length >= 3) {
        const sims = sm.map((v, i) => dot(x, shaped(id + '#' + i, () => v))).sort((a, b) => b - a);
        c.near = (sims[0] + sims[1]) / 2;
      }
      if (click) for (const r of [0.5, 0.3, 0.7]) consider([id], id + '~click@' + r, () => mix(T[id].mean, click, r));
    }
    // Pads hit together. A combination the player has taught is compared as it really sounded;
    // any other is guessed by blending the single-pad sounds at a few loudness ratios.
    const taughtSets = {};
    for (const k of this.comboIds()) { consider(k.split('+'), k, () => T[k].mean, true); taughtSets[canonPads(k.split('+')).sort().join('+')] = true; }
    let groups = [];
    if (opts.allPairs) {
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (canon(ids[i]) !== canon(ids[j])) groups.push([ids[i], ids[j]]);
    } else {
      // The lesson names instruments; try every taught place that plays each of them.
      (opts.expected || []).filter(p => p.length === 2 || p.length === 3).forEach(p => {
        let sets = [[]];
        p.forEach(inst => { const next = []; sets.forEach(s => ids.filter(a => canon(a) === inst).forEach(a => next.push(s.concat(a)))); sets = next; });
        groups = groups.concat(sets);
      });
    }
    for (const g of groups) {
      if (taughtSets[canonPads(g).sort().join('+')]) continue;   // the real sound is known: no need to guess
      const w = g.length === 2 ? PAIR_WEIGHTS : TRIPLE_WEIGHTS;
      w.forEach((ws, n) => consider(g, g.join('+') + '@' + n, () => blend(g.map(k => T[k].mean), ws)));
    }
    // More pads must explain the sound clearly better than fewer pads, or a single hit would be credited as two.
    const bestRaw = [0, -1, -1, -1];
    for (const c of cands) if (c.raw > bestRaw[c.size]) bestRaw[c.size] = c.raw;
    let best = { keys: [], raw: -1, score: -1 };
    const byPad = {};
    for (const c of cands) {
      if (c.size > 1) {
        const margin = c.taught ? this.TAUGHT_MARGIN : c.exp ? this.EXPECTED_MARGIN : PAIR_MARGIN;
        let fewer = bestRaw[1];
        if (c.size === 3 && bestRaw[2] > fewer) fewer = bestRaw[2];
        if (c.raw < fewer + margin) continue;
      }
      const own = c.near !== undefined ? 0.5 * (c.raw + c.near) : c.raw;
      const score = own + (c.exp ? this.EXPECTED_BONUS : 0);
      if (score > best.score) best = { keys: c.keys, raw: c.raw, score };
      if (c.size === 1) { const k = canon(c.keys[0]); if (!(own <= byPad[k])) byPad[k] = own; }
    }
    // How far ahead of the next most likely pad the winner is: a small lead means the two pads sound alike.
    const ranked = Object.keys(byPad).map(k => byPad[k]).sort((a, b) => b - a);
    const lead = ranked.length > 1 ? ranked[0] - ranked[1] : 1;
    const clickScore = click ? dot(x, shaped('_click', () => click)) : -1;
    if (clickScore > best.raw) return { pads: [], keys: [], score: clickScore, click: true };
    const readyMade = best.keys.length > 0 && best.keys.every(k => this.starter[k]);
    if (best.raw < (readyMade ? STARTER_BELOW : UNKNOWN_BELOW)) return { pads: [], keys: [], score: best.raw };
    return { pads: canonPads(best.keys), keys: best.keys, score: best.raw, lead, starter: readyMade };
  },
  EXPECTED_BONUS: 0.04,
  // Guessed blends of an expected combination get the benefit of the doubt (a quiet pad under a loud one cannot be
  // told apart from the loud one alone); combinations the player has taught are judged strictly.
  EXPECTED_MARGIN: -0.02,
  TAUGHT_MARGIN: -0.005,

  // How well do the taught hits separate? Each hit is set aside in turn and recognised from the others alone,
  // so the figure is not flattered by a hit matching itself. Returns { accuracy 0..1, confusions: [[a,b],...] }
  quality() {
    const keep = this.templates, ids = this.taughtIds();   // only what was taught from the real pad
    let total = 0, ok = 0;
    const conf = {};
    for (const id of ids) {
      const all = keep[id].samples;
      if (all.length < 2) continue;
      all.forEach((s, i) => {
        this.templates = Object.assign({}, keep, { [id]: this.makeTemplate(all.filter((v, j) => j !== i)) });
        const r = this.classify(s);
        total++;
        if (r.pads.length === 1 && r.pads[0] === canon(id)) ok++;
        else if (r.pads.length === 1) conf[[canon(id), r.pads[0]].sort().join('|')] = true;
      });
    }
    this.templates = keep;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      if (canon(ids[i]) === canon(ids[j])) continue;   // two places for one instrument are allowed to sound alike
      if (dot(shape(keep[ids[i]].mean), shape(keep[ids[j]].mean)) > 0.97) conf[[canon(ids[i]), canon(ids[j])].sort().join('|')] = true;
    }
    return { accuracy: total ? ok / total : 0, confusions: Object.keys(conf).map(k => k.split('|')) };
  },
  exportTemplates() {
    const out = {};
    for (const k of Object.keys(this.templates)) if (!this.starter[k]) out[k] = this.templates[k].samples.map(s => Array.from(s, v => +v.toFixed(6)));   // ready-made sounds are never saved: they are built again each time
    return out;
  },
  importTemplates(obj) {
    this.templates = {}; this.starter = {};
    for (const k of Object.keys(obj || {})) {
      const samples = obj[k].map(a => Float32Array.from(a));
      if (samples.length) this.templates[k] = this.makeTemplate(samples);
    }
  }
};
