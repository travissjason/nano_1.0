// Level protection, NOT a detector of acoustic feedback or a brick-wall limiter.
export class FeedbackProtection {
  constructor() { this.scale = 1; this.previous = 0; this.reason = ""; }
  inspect(samples) {
    let sum = 0, peak = 0;
    for (const value of samples) {
      sum += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
    const rms = Math.sqrt(sum / samples.length);
    const surge = rms > 0.25 && this.previous < 0.06;
    if (peak > 0.85 || rms > 0.35 || surge) {
      this.scale = Math.max(0.025, this.scale * 0.5);
      this.reason = "큰 출력/급상승 감지: 자동 감쇠 중 (하울링 판정 아님)";
    }
    this.previous = rms;
    return { rms, peak, scale: this.scale, warning: this.reason };
  }
}
