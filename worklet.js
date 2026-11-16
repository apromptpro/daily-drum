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
    this.gap = 0;           // blocks left before another hit may start (about 60 ms)
    this.gapBlocks = Math.ceil(0.06 * sampleRate / 128);
    this.pre = new Float32Array(128);
    this.meter = 0;
    this.meterCount = 0;
    this.port.onmessage = (e) => {
      if (e.data && typeof e.data.floor === 'number') this.floor = e.data.floor;
    };
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
      }
    } else if (this.gap <= 0 && rms > this.floor && rms > this.env * 2.2) {
      // Sudden rise in loudness: a hit starts in this block.
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

    this.env = Math.max(rms, this.env * 0.97);
    this.pre.set(ch.length === 128 ? ch : ch.subarray(0, 128));
    return true;
  }
}
registerProcessor('onset-processor', OnsetProcessor);
