// Candidate hit finder ("engine 2"). Used only when engine 2 is switched on; worklet.js stays the default.
// Same job and same messages as worklet.js, with two additions:
//  - besides the overall loudness it watches three frequency ranges, so a drum hit under a cymbal that is still
//    ringing, or a softer second hit shortly after the first, is still found;
//  - with each hit it sends the 1024 samples heard just before it, so the recogniser can tell what was already sounding.
class OnsetProcessor2 extends AudioWorkletProcessor {
  constructor() {
    super();
    this.floor = 0.01;
    this.env = 0;
    this.capLen = 2048;
    this.cap = null; this.capPos = 0; this.capTime = 0; this.capPeak = 0;
    this.tailLen = Math.round(0.2 * sampleRate);
    this.tail = null; this.tailPos = 0; this.tailTime = 0;
    this.gap = 0;
    this.gapBlocks = Math.ceil(0.06 * sampleRate / 128);
    this.pre = new Float32Array(128);
    this.hist = new Float32Array(1024);   // what came before "pre"
    this.meter = 0; this.meterCount = 0;
    // one-pole low-pass filters that split the sound into low (below about 400 Hz), middle and high (above about 3000 Hz)
    this.kA = 1 - Math.exp(-2 * Math.PI * 400 / sampleRate);
    this.kB = 1 - Math.exp(-2 * Math.PI * 3000 / sampleRate);
    this.zA = 0; this.zB = 0; this.zC = 0;
    this.envB = [0, 0, 0];
    this.decay = [0.97, 0.95, 0.93];   // deep sounds swing slowly, so their level is forgotten slowly
    this.port.onmessage = (e) => { if (e.data && typeof e.data.floor === 'number') this.floor = e.data.floor; };
  }
  flushTail() {
    if (!this.tail) return;
    const out = this.tail.slice(0, this.tailPos);
    this.tail = null;
    this.port.postMessage({ type: 'tail', time: this.tailTime, samples: out }, [out.buffer]);
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch || !ch.length) return true;
    let sum = 0, peak = 0, peakIdx = 0, sL = 0, sM = 0, sH = 0;
    let zA = this.zA, zB = this.zB, zC = this.zC;
    const kA = this.kA, kB = this.kB;
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i];
      sum += v * v;
      const a = v < 0 ? -v : v;
      if (a > peak) { peak = a; peakIdx = i; }
      zA += kA * (v - zA); zB += kB * (v - zB); zC += kB * (zB - zC);
      const lo = zA, mid = zC - zA, hi = v - zC;
      sL += lo * lo; sM += mid * mid; sH += hi * hi;
    }
    this.zA = zA; this.zB = zB; this.zC = zC;
    const rms = Math.sqrt(sum / ch.length);
    const band = [Math.sqrt(sL / ch.length), Math.sqrt(sM / ch.length), Math.sqrt(sH / ch.length)];

    if (rms > this.meter) this.meter = rms;
    if (++this.meterCount >= 8) { this.port.postMessage({ type: 'level', rms: this.meter }); this.meter = 0; this.meterCount = 0; }
    if (this.gap > 0) this.gap--;

    if (this.cap) {
      const n = Math.min(ch.length, this.capLen - this.capPos);
      this.cap.set(ch.subarray(0, n), this.capPos);
      this.capPos += n;
      if (peak > this.capPeak) this.capPeak = peak;
      if (this.capPos >= this.capLen) {
        const buf = this.cap, before = this.capPre;
        this.cap = null;
        this.port.postMessage({ type: 'hit', time: this.capTime, peak: this.capPeak, samples: buf, pre: before }, [buf.buffer, before.buffer]);
        this.tail = new Float32Array(this.tailLen);
        this.tailTime = this.capTime;
        const rest = ch.subarray(n);
        this.tail.set(rest, 0);
        this.tailPos = rest.length;
        this.tailNew = true;
      }
    } else if (this.gap <= 0 && rms > this.floor) {
      let rise = rms > this.env * 2.2;   // the rule worklet.js uses
      if (!rise) for (let b = 0; b < 3; b++) if (band[b] > this.floor * 0.6 && band[b] > this.envB[b] * 2.5 && band[b] > rms * 0.25) rise = true;
      if (rise) {
        this.flushTail();
        let idx = 0;
        const thr = peak * 0.3;
        for (let i = 0; i <= peakIdx; i++) { const a = ch[i] < 0 ? -ch[i] : ch[i]; if (a >= thr) { idx = i; break; } }
        this.cap = new Float32Array(this.capLen);
        this.cap.set(this.pre, 0);
        this.cap.set(ch, this.pre.length);
        this.capPos = this.pre.length + ch.length;
        this.capPeak = peak;
        this.capPre = this.hist.slice();
        this.capTime = (currentFrame + idx) / sampleRate;
        this.gap = this.gapBlocks;
        this.port.postMessage({ type: 'onset', time: this.capTime });
      }
    }

    if (this.tailNew) this.tailNew = false;
    else if (this.tail && !this.cap) {
      const m = Math.min(ch.length, this.tailLen - this.tailPos);
      this.tail.set(ch.subarray(0, m), this.tailPos);
      this.tailPos += m;
      if (this.tailPos >= this.tailLen) this.flushTail();
    }
    this.env = Math.max(rms, this.env * 0.97);
    for (let b = 0; b < 3; b++) this.envB[b] = Math.max(band[b], this.envB[b] * this.decay[b]);
    this.hist.copyWithin(0, 128); this.hist.set(this.pre, 1024 - 128);
    this.pre.set(ch.length === 128 ? ch : ch.subarray(0, 128));
    return true;
  }
}
registerProcessor('onset-processor-2', OnsetProcessor2);
