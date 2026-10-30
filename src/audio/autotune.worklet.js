// Experimental chromatic pitch snap. 1024-sample analysis history and a 28 ms
// granular window affect ONLY this optional branch, never the native dry path.
class NanoAutotune extends AudioWorkletProcessor {
  constructor() {
    super();
    this.history = new Float32Array(1024);
    this.grain = Math.floor(sampleRate * 0.028);
    this.ring = new Float32Array(this.grain * 4);
    this.index = 0;
    this.historyIndex = 0;
    this.count = 0;
    this.phase = 0;
    this.ratio = 1;
    this.target = 1;
    this.alive = true;
    this.port.onmessage = event => { if (event.data === "dispose") this.alive = false; };
  }
  detect() {
    const h = this.history, length = h.length;
    let energy = 0;
    for (let i = 0; i < length; i++) energy += h[i] ** 2;
    if (energy / length < 0.000144) { this.target = 1; return; }
    let best = 0, lag = 0;
    const maxLag = Math.min(Math.floor(sampleRate / 75), length - 256);
    for (let offset = Math.floor(sampleRate / 750); offset <= maxLag; offset += 2) {
      let cross = 0, a = 0, b = 0;
      for (let i = 0; i < length - maxLag; i += 4) {
        const x = h[(this.historyIndex + i) % length];
        const y = h[(this.historyIndex + i + offset) % length];
        cross += x * y; a += x * x; b += y * y;
      }
      const correlation = cross / (Math.sqrt(a * b) + 1e-12);
      if (correlation > best) { best = correlation; lag = offset; }
    }
    this.target = 1;
    if (best > 0.75 && lag) {
      const hz = sampleRate / lag;
      const midi = 69 + 12 * Math.log2(hz / 440);
      this.target = Math.max(0.75, Math.min(1.35, 440 * 2 ** ((Math.round(midi) - 69) / 12) / hz));
    }
  }
  read(delay) {
    const pos = (this.index - delay + this.ring.length) % this.ring.length;
    const base = Math.floor(pos), fraction = pos - base;
    return this.ring[base] * (1 - fraction) + this.ring[(base + 1) % this.ring.length] * fraction;
  }
  process(inputs, outputs) {
    const output = outputs[0]?.[0];
    if (!this.alive) return false;
    if (!output) return true;
    const input = inputs[0]?.[0];
    if (!input) { output.fill(0); return true; }
    for (let i = 0; i < output.length; i++) {
      const value = Number.isFinite(input[i]) ? input[i] : 0;
      this.history[this.historyIndex] = value;
      this.historyIndex = (this.historyIndex + 1) % this.history.length;
      if (++this.count % 1024 === 0) this.detect();
      this.ratio = this.ratio * 0.999 + this.target * 0.001;
      this.ring[this.index] = value;
      this.phase += (1 - this.ratio) / this.grain;
      this.phase -= Math.floor(this.phase);
      const phase2 = (this.phase + 0.5) % 1;
      const weight = 0.5 * (1 - Math.cos(2 * Math.PI * this.phase));
      output[i] = this.read(this.phase * this.grain) * weight + this.read(phase2 * this.grain) * (1 - weight);
      this.index = (this.index + 1) % this.ring.length;
    }
    return true;
  }
}
registerProcessor("nano-autotune", NanoAutotune);
