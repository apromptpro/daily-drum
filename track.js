'use strict';
// Play along with your own music: open a song file, find its beats, and play it exactly in step with the falling notes.

// Drum parts that fit most pop songs. Every part repeats twice per bar, so it does not matter which beat is "1" or "3".
const TRACK_PARTS = [
  { id: 'boomtap', name: 'Boom, tap (easiest)', div: 1, bar: { kick: 'x-x-', snare: '-x-x' },
    goal: 'Kick, snare, kick, snare: one hit on every beat of the song.' },
  { id: 'first', name: 'First beat', div: 1, bar: { hihat: 'xxxx', snare: '-x-x', kick: 'x-x-' },
    goal: 'Hi-hat on every beat, with kick and snare taking turns.' },
  { id: 'clap', name: 'Boom, boom, clap', div: 2, bar: { kick: 'xx--xx--', snare: '--x---x-' },
    goal: 'Two quick kicks, then one snare.' },
  { id: 'rock', name: 'Rock beat', div: 2, bar: { hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x---x---' },
    goal: 'Hi-hat twice per beat, kick on 1 and 3, snare on 2 and 4.' },
  { id: 'dance', name: 'Dance beat', div: 2, bar: { hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x-x-x-x-' },
    goal: 'Kick on every beat, snare on 2 and 4, hi-hat twice per beat.' }
];

// The song files are kept in the browser's own storage on this computer, so a song only has to be added once.
const SongFiles = {
  _db: null,
  _open() {
    if (!this._db) {
      this._db = new Promise((res, rej) => {
        const r = indexedDB.open('drumcoach', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('songs');
        r.onsuccess = () => res(r.result);
        r.onerror = () => { this._db = null; rej(r.error); };
      });
    }
    return this._db;
  },
  async _tx(mode, fn) {
    const db = await this._open();
    return new Promise((res, rej) => {
      const tx = db.transaction('songs', mode);
      const rq = fn(tx.objectStore('songs'));
      tx.oncomplete = () => res(rq.result);
      tx.onerror = tx.onabort = () => rej(tx.error);
    });
  },
  put(id, blob) { return this._tx('readwrite', s => s.put(blob, id)); },
  get(id) { return this._tx('readonly', s => s.get(id)); },
  del(id) { return this._tx('readwrite', s => s.delete(id)); }
};

function medianOf(a) {
  const s = Array.from(a).sort((x, y) => x - y);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
}

// ---------- Finding the beats of a song ----------
// 1. envelope(): how strongly "something new starts" at each moment (drum hits, notes).
// 2. period():   the spacing at which those moments repeat = the beat length.
// 3. beats():    follows the beat through the whole song, so songs that speed up or slow down still line up.
const BeatFinder = {
  N: 1024, H: 512,
  BIAS: 350,   // samples from the start of an analysis frame to the moment a hit in it really happens (measured)

  envelope(buffer) {
    const sr = buffer.sampleRate, N = this.N, H = this.H;
    const len = Math.min(buffer.length, Math.floor(sr * 600));
    const a = buffer.getChannelData(0);
    const b = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
    const frames = Math.max(0, Math.floor((len - N) / H) + 1);
    const raw = new Float32Array(frames), low = new Float32Array(frames);
    const win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    const lowBins = Math.max(2, Math.round(160 * N / sr));   // up to about 160 Hz: where the kick drum lives
    let prev = new Float32Array(N / 2), cur = new Float32Array(N / 2);
    const buf = new Float32Array(N);
    for (let f = 0; f < frames; f++) {
      const off = f * H;
      if (b) for (let i = 0; i < N; i++) buf[i] = (a[off + i] + b[off + i]) * 0.5 * win[i];
      else for (let i = 0; i < N; i++) buf[i] = a[off + i] * win[i];
      const p = powerSpectrum(buf);
      let flux = 0, lf = 0;
      for (let k = 1; k < N / 2; k++) {
        const v = Math.log1p(Math.sqrt(p[k]) / 25);   // gentle squeeze: loud drum hits still stand out above hi-hats
        const d = v - prev[k];
        if (d > 0) { flux += d; if (k <= lowBins) lf += d; }
        cur[k] = v;
      }
      if (f) { raw[f] = flux; low[f] = lf; }
      const t = prev; prev = cur; cur = t;
    }
    // Take away the slowly changing level and keep what sticks out above it.
    const w = Math.max(1, Math.round(0.4 * sr / H));
    const pre = new Float64Array(frames + 1);
    for (let i = 0; i < frames; i++) pre[i + 1] = pre[i] + raw[i];
    const env = new Float32Array(frames);
    let sq = 0;
    for (let i = 0; i < frames; i++) {
      const lo = Math.max(0, i - w), hi = Math.min(frames, i + w + 1);
      const v = raw[i] - (pre[hi] - pre[lo]) / (hi - lo);
      env[i] = v > 0 ? v : 0;
      sq += env[i] * env[i];
    }
    const sd = Math.sqrt(sq / Math.max(1, frames)) || 1;
    for (let i = 0; i < frames; i++) env[i] /= sd;
    return { env, low, fps: sr / H, sr };
  },

  acf(env, lag) {
    let s = 0;
    const n = env.length - lag;
    for (let i = 0; i < n; i++) s += env[i] * env[i + lag];
    return n > 0 ? s / n : 0;
  },

  // Beat length in analysis frames. near (frames): look only close to this value (used after "Tap the beat").
  period(env, fps, near) {
    const maxLag = Math.ceil(fps * 60 / 55), minLag = Math.floor(fps * 60 / 200);
    let lo = minLag, hi = maxLag;
    if (near) { lo = Math.max(3, Math.floor(near * 0.9)); hi = Math.ceil(near * 1.1); }
    const ac = new Float32Array(4 * hi + 3);
    for (let lag = 1; lag < ac.length; lag++) ac[lag] = this.acf(env, lag);
    // Strongest repeat within r frames of lag c (a whole-frame lag is up to half a frame off, which adds up at multiples).
    const near2 = (c, r) => { let m = 0; for (let j = c - r; j <= c + r; j++) if (ac[j] > m) m = ac[j]; return m; };
    let best = lo, bestS = -Infinity;
    for (let lag = lo; lag <= hi; lag++) {
      const bpm = 60 * fps / lag;
      // Without other information, a moderate tempo is the most likely. When a song can be counted fast or
      // half as fast, this leans towards the slower count, which is the easier one to drum along with.
      const prior = near ? 1 : Math.exp(-0.5 * Math.pow(Math.log2(bpm / 95) / 0.6, 2));
      // A real beat length also repeats 2, 3 and 4 beats apart. Half a beat, or a beat and a half, does not.
      const s = prior * (ac[lag] + near2(2 * lag, 1) + near2(3 * lag, 2) + near2(4 * lag, 2));
      if (s > bestS) { bestS = s; best = lag; }
    }
    const peak = (y0, y1, y2) => {
      const den = y0 - 2 * y1 + y2;
      return den < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (y0 - y2) / den)) : 0;
    };
    let p = best + peak(ac[best - 1], ac[best], ac[best + 1]);
    // Four beats apart the pattern repeats too; measuring there gives the beat length four times as precisely.
    const c = Math.round(4 * p);
    let bl = c, bv = -Infinity;
    for (let l = c - 3; l <= c + 3; l++) { const v = this.acf(env, l); if (v > bv) { bv = v; bl = l; } }
    if (bv > 0) p = (bl + peak(this.acf(env, bl - 1), bv, this.acf(env, bl + 1))) / 4;
    return p;
  },

  // Follow the beat through the song. Returns { beats: [seconds...], steady: bool } or null.
  beats(e, period, dur) {
    const env = e.env, n = env.length, H = this.H, sr = e.sr;
    const sig = Math.max(1, period / 32), r = Math.ceil(sig * 3);
    const kern = [];
    for (let j = -r; j <= r; j++) kern.push(Math.exp(-0.5 * (j / sig) * (j / sig)));
    const local = new Float32Array(n);
    let mx = 0;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = -r; j <= r; j++) { const q = i + j; if (q >= 0 && q < n) s += env[q] * kern[j + r]; }
      local[i] = s;
      if (s > mx) mx = s;
    }
    if (!(mx > 0)) return null;
    // Each beat prefers to sit one beat length after the previous one, and on top of a strong moment.
    const lo = Math.max(1, Math.round(period / 2)), hi = Math.round(period * 2);
    const pen = new Float32Array(hi + 1);
    for (let d = lo; d <= hi; d++) pen[d] = -100 * Math.pow(Math.log(d / period), 2);
    const cum = new Float32Array(n), back = new Int32Array(n);
    let first = true;
    const thr = 0.01 * mx;
    for (let i = 0; i < n; i++) {
      let bv = -Infinity, bj = -1;
      for (let d = lo; d <= hi; d++) {
        const j = i - d;
        if (j < 0) break;
        const v = cum[j] + pen[d];
        if (v > bv) { bv = v; bj = j; }
      }
      cum[i] = local[i] + (bj >= 0 ? bv : 0);
      if (first && local[i] < thr) back[i] = -1; else { back[i] = bj; first = false; }
    }
    const peaks = [];
    for (let i = 1; i < n - 1; i++) if (cum[i] >= cum[i - 1] && cum[i] > cum[i + 1]) peaks.push(i);
    if (!peaks.length) return null;
    const med = medianOf(peaks.map(i => cum[i]));
    let last = peaks[peaks.length - 1];
    for (let k = peaks.length - 1; k >= 0; k--) if (cum[peaks[k]] >= 0.5 * med) { last = peaks[k]; break; }
    let fr = [];
    for (let i = last; i >= 0; i = back[i]) fr.push(i);
    fr.reverse();
    // The chain can begin and end on moments where nothing happens; drop those (the beat is carried through silence below).
    let ms = 0;
    for (const f of fr) ms += local[f] * local[f];
    const weak = 0.5 * Math.sqrt(ms / fr.length);
    let s0 = 0, s1 = fr.length - 1;
    while (s0 < s1 && local[fr[s0]] < weak) s0++;
    while (s1 > s0 && local[fr[s1]] < weak) s1--;
    fr = fr.slice(s0, s1 + 1);
    if (fr.length < 8) return null;
    const t = fr.map(f => {
      let d = 0;
      if (f > 0 && f < n - 1) {
        const den = local[f - 1] - 2 * local[f] + local[f + 1];
        if (den < 0) d = Math.max(-0.5, Math.min(0.5, 0.5 * (local[f - 1] - local[f + 1]) / den));
      }
      return ((f + d) * H + this.BIAS) / sr;
    });
    // Straight line through (beat number, time): if every beat sits on it, the song keeps perfect time.
    const fit = (from, to) => {
      let sx = 0, sy = 0, sxx = 0, sxy = 0;
      const m = to - from + 1;
      for (let i = from; i <= to; i++) { sx += i; sy += t[i]; sxx += i * i; sxy += i * t[i]; }
      const b = (m * sxy - sx * sy) / (m * sxx - sx * sx);
      return { a: (sy - b * sx) / m, b };
    };
    const g = fit(0, t.length - 1);
    const res = t.map((v, i) => Math.abs(v - (g.a + g.b * i))).sort((x, y) => x - y);
    const steady = res[Math.floor(0.9 * (res.length - 1))] < 0.02;
    let out;
    if (steady) {
      // Slide both ends of the line by up to 25 ms and keep the position where the beats sit best on the strong moments.
      const at = (x) => {
        const fp = (x * sr - this.BIAS) / H, i = Math.floor(fp);
        return i < 0 || i + 1 >= n ? 0 : local[i] + (fp - i) * (local[i + 1] - local[i]);
      };
      const m = t.length;
      let bs = -Infinity, ba = g.a, bb = g.b;
      for (let e0 = -25; e0 <= 25; e0++) for (let e1 = -25; e1 <= 25; e1++) {
        const a = g.a + e0 / 1000, b = g.b + (e1 - e0) / 1000 / (m - 1);
        let s = 0;
        for (let i = 0; i < m; i++) s += at(a + b * i);
        if (s > bs) { bs = s; ba = a; bb = b; }
      }
      g.a = ba; g.b = bb;
      out = t.map((v, i) => g.a + g.b * i);
    } else out = t.map((v, i) => {   // otherwise smooth each beat against its neighbours
      const l = fit(Math.max(0, i - 6), Math.min(t.length - 1, i + 6));
      return l.a + l.b * i;
    });
    // Carry the beat on through a silent start and end.
    const gaps = (arr) => arr.slice(1).map((v, i) => v - arr[i]);
    const p0 = steady ? g.b : medianOf(gaps(out.slice(0, 9)));
    const p1 = steady ? g.b : medianOf(gaps(out.slice(-9)));
    if (!(p0 > 0.1) || !(p1 > 0.1)) return null;
    while (out[0] - p0 >= 0) out.unshift(out[0] - p0);
    while (out[out.length - 1] + p1 < dur) out.push(out[out.length - 1] + p1);
    return { beats: out.map(v => +v.toFixed(4)), steady };
  },

  // 0 or 1: do the kick-drum beats fall on the even or the odd beats of this list?
  parity(e, beats) {
    const s = [0, 0];
    for (let i = 0; i < beats.length; i++) {
      const f = Math.round((beats[i] * e.sr - this.BIAS) / this.H);
      let v = 0;
      for (let k = f - 2; k <= f + 2; k++) if (k >= 0 && k < e.low.length && e.low[k] > v) v = e.low[k];
      s[i % 2] += v;
    }
    return s[1] > s[0] * 1.15 ? 1 : 0;
  }
};

const Track = {
  rec: null,       // the saved facts about the open song: { id, name, dur, beats, steady, mult, half, shift, nudge, part }
  buffer: null,    // the decoded sound
  env: null,       // analysis of the sound (only needed while lining up)
  map: [],         // time in the song (seconds) of every beat the notes use
  src: null, out: null, c0: 0, v0: 0, rate: 1,

  list() { return store.get('tracks', []); },
  save() {
    const l = this.list();
    const i = l.findIndex(r => r.id === this.rec.id);
    if (i >= 0) l[i] = this.rec; else l.push(this.rec);
    store.set('tracks', l);
  },
  async remove(id) {
    store.set('tracks', this.list().filter(r => r.id !== id));
    if (this.rec && this.rec.id === id) { this.stop(); this.rec = this.buffer = this.env = null; }
    try { await SongFiles.del(id); } catch (e) {}
  },

  async decode(blob) {
    const ctx = Ear.ensureCtx();
    try { return await ctx.decodeAudioData(await blob.arrayBuffer()); }
    catch (e) { throw new Error('bad'); }
  },

  // Add a new song file. say(text) reports progress. Throws Error('bad' | 'short' | 'nobeat').
  async add(file, say) {
    const wait = () => new Promise(r => setTimeout(r, 40));
    say('Opening the song...');
    await wait();
    const buffer = await this.decode(file);
    if (buffer.duration < 20) throw new Error('short');
    say('Listening for the beat...');
    await wait();
    const e = BeatFinder.envelope(buffer);
    const found = BeatFinder.beats(e, BeatFinder.period(e.env, e.fps), buffer.duration);
    if (!found) throw new Error('nobeat');
    this.stop();
    this.buffer = buffer; this.env = e;
    this.rec = {
      id: 't' + Date.now().toString(36), name: file.name.replace(/\.[^.]+$/, ''), dur: +buffer.duration.toFixed(2),
      beats: found.beats, steady: found.steady, mult: 1, half: false, shift: BeatFinder.parity(e, found.beats), nudge: 0, part: 'boomtap'
    };
    this.save();
    this.buildMap();
    try { await SongFiles.put(this.rec.id, file); } catch (err) { this.rec.notStored = true; }
    return this.rec;
  },

  // Open a song added earlier. Throws Error('gone' | 'bad').
  async open(rec, say) {
    if (!(this.rec && this.rec.id === rec.id && this.buffer)) {
      say('Opening the song...');
      let blob = null;
      try { blob = await SongFiles.get(rec.id); } catch (e) {}
      if (!blob) throw new Error('gone');
      const buffer = await this.decode(blob);
      this.stop();
      this.buffer = buffer; this.env = null;
    }
    this.rec = rec;
    this.buildMap();
  },

  ensureEnv() { if (!this.env) this.env = BeatFinder.envelope(this.buffer); return this.env; },

  // Find the beats again around a beat length the player tapped (seconds). False when nothing usable was found.
  retrack(periodSec) {
    const e = this.ensureEnv();
    const found = BeatFinder.beats(e, BeatFinder.period(e.env, e.fps, periodSec * e.fps), this.buffer.duration);
    if (!found) return false;
    Object.assign(this.rec, { beats: found.beats, steady: found.steady, mult: 1, half: false, shift: BeatFinder.parity(e, found.beats) });
    return true;
  },

  // The beat list before "which beat gets the kick" and the fine nudge are applied.
  _base() {
    const r = this.rec;
    let m = r.beats.slice();
    if (r.mult === 2) {
      const o = [];
      for (let i = 0; i < m.length; i++) { o.push(m[i]); if (i + 1 < m.length) o.push((m[i] + m[i + 1]) / 2); }
      m = o;
    } else if (r.mult === 0.5) m = m.filter((t, i) => i % 2 === 0);
    if (r.half) { const o = []; for (let i = 0; i + 1 < m.length; i++) o.push((m[i] + m[i + 1]) / 2); m = o; }
    return m;
  },
  buildMap() {
    const nd = (this.rec.nudge || 0) / 1000;
    this.map = this._base().slice(this.rec.shift ? 1 : 0).map(t => t + nd);
  },
  guessShift() { this.rec.shift = BeatFinder.parity(this.ensureEnv(), this._base()); },
  usable() { return this.map.length >= 8; },

  // ----- song time <-> beat number -----
  timeOf(b) {
    const m = this.map, n = m.length;
    if (b <= 0) return m[0] + b * (m[1] - m[0]);
    if (b >= n - 1) return m[n - 1] + (b - (n - 1)) * (m[n - 1] - m[n - 2]);
    const i = Math.floor(b);
    return m[i] + (b - i) * (m[i + 1] - m[i]);
  },
  beatOf(t) {
    const m = this.map, n = m.length;
    if (t <= m[0]) return (t - m[0]) / (m[1] - m[0]);
    if (t >= m[n - 1]) return n - 1 + (t - m[n - 1]) / (m[n - 1] - m[n - 2]);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (m[mid] <= t) lo = mid; else hi = mid; }
    return lo + (t - m[lo]) / (m[lo + 1] - m[lo]);
  },
  interval(b) {
    const m = this.map;
    const i = Math.max(0, Math.min(m.length - 2, Math.floor(b)));
    return m[i + 1] - m[i];
  },
  totalBeats() {
    let n = 0;
    while (n < this.map.length && this.map[n] < this.rec.dur - 0.25) n++;
    return Math.floor(n / 4) * 4;
  },
  bpm() { return 60 / medianOf(this.map.slice(1).map((v, i) => v - this.map[i])); },

  // ----- audio clock <-> song time (valid while playing) -----
  media(ctxT) { return this.v0 + (ctxT - this.c0) * this.rate; },
  beatAt(ctxT) { return this.beatOf(this.media(ctxT)); },
  timeOfBeat(b) { return this.c0 + (this.timeOf(b) - this.v0) / this.rate; },
  beatSec(b) { return this.interval(b) / this.rate; },

  // Start the song so that song time v0 is heard at audio-clock time c0. v0 may be negative: silence first.
  play(c0, v0, rate) {
    this.stop();
    const ctx = Ear.ctx;
    this.c0 = c0; this.v0 = v0; this.rate = rate;
    if (v0 >= this.buffer.duration) return;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = rate;
    const out = ctx.createGain();
    src.connect(out).connect(ctx.destination);
    if (v0 >= 0) src.start(c0, v0); else src.start(c0 - v0 / rate, 0);
    this.src = src; this.out = out;
  },
  stop() {
    if (!this.src) return;
    const src = this.src, out = this.out, t = Ear.ctx.currentTime;
    this.src = this.out = null;
    try {
      out.gain.setTargetAtTime(0, t, 0.01);   // fade out quickly instead of cutting with a click
      src.stop(t + 0.06);
    } catch (e) {}
    setTimeout(() => { try { src.disconnect(); out.disconnect(); } catch (e) {} }, 200);
  }
};
