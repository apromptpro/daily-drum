// Runs on the audio thread: finds the moment a pad is hit and captures ~43 ms of its sound.
class OnsetProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.floor = 0.01;      // minimum loudness that counts as a hit
    this.env = 0;           // recent loudness (decays), used to spot sudden rises
    this.capLen = 2048;
    this.cap = null;
    this.capPos = 0;
    this.capTime = 0;
    this.capPeak = 0;
    this.tailLen = Math.round(0.2 * sampleRate);   // what follows the 43 ms: only for playing the hit back in Setup
    this.tail = null;
    this.tailPos = 0;
    this.tailTime = 0;
    this.gap = 0;           // blocks left before another hit may start (about 60 ms)
    this.gapBlocks = Math.ceil(0.06 * sampleRate / 128);
    this.pre = new Float32Array(128);
    this.meter = 0;
    this.meterCount = 0;
    this.port.onmessage = (e) => {
      if (e.data && typeof e.data.floor === 'number') this.floor = e.data.floor;
    };
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
    let sum = 0, peak = 0, peakIdx = 0;
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i];
      sum += v * v;
      const a = v < 0 ? -v : v;
      if (a > peak) { peak = a; peakIdx = i; }
    }
    const rms = Math.sqrt(sum / ch.length);

    if (rms > this.meter) this.meter = rms;
    if (++this.meterCount >= 8) {
      this.port.postMessage({ type: 'level', rms: this.meter });
      this.meter = 0;
      this.meterCount = 0;
    }
    if (this.gap > 0) this.gap--;

    if (this.cap) {
      const n = Math.min(ch.length, this.capLen - this.capPos);
      this.cap.set(ch.subarray(0, n), this.capPos);
      this.capPos += n;
      if (peak > this.capPeak) this.capPeak = peak;
      if (this.capPos >= this.capLen) {
        const buf = this.cap;
        this.cap = null;
        this.port.postMessage({ type: 'hit', time: this.capTime, peak: this.capPeak, samples: buf }, [buf.buffer]);
        this.tail = new Float32Array(this.tailLen);
        this.tailTime = this.capTime;
        const rest = ch.subarray(n);
        this.tail.set(rest, 0);
        this.tailPos = rest.length;
        this.tailNew = true;   // this block is already in it
      }
    } else if (this.gap <= 0 && rms > this.floor && rms > this.env * 2.2) {
      // Sudden rise in loudness: a hit starts in this block.
      this.flushTail();
      let idx = 0;
      const thr = peak * 0.3;
      for (let i = 0; i <= peakIdx; i++) {
        const a = ch[i] < 0 ? -ch[i] : ch[i];
        if (a >= thr) { idx = i; break; }
      }
      this.cap = new Float32Array(this.capLen);
      this.cap.set(this.pre, 0);
      this.cap.set(ch, this.pre.length);
      this.capPos = this.pre.length + ch.length;
      this.capPeak = peak;
      this.capTime = (currentFrame + idx) / sampleRate;
      this.gap = this.gapBlocks;
      this.port.postMessage({ type: 'onset', time: this.capTime });   // tell the page at once; "which pad" follows
    }

    if (this.tailNew) this.tailNew = false;
    else if (this.tail && !this.cap) {
      const m = Math.min(ch.length, this.tailLen - this.tailPos);
      this.tail.set(ch.subarray(0, m), this.tailPos);
      this.tailPos += m;
      if (this.tailPos >= this.tailLen) this.flushTail();
    }
    this.env = Math.max(rms, this.env * 0.97);
    this.pre.set(ch.length === 128 ? ch : ch.subarray(0, 128));
    return true;
  }
}
registerProcessor('onset-processor', OnsetProcessor);
