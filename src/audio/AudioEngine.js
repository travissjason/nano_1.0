import { FeedbackProtection } from "./FeedbackProtection.js";
import workletSource from "./autotune.worklet.js?raw";

export class AudioEngine {
  constructor(onUpdate = () => {}, platform = globalThis) {
    this.platform = platform;
    this.onUpdate = onUpdate;
    this.serial = 0;
    this.effectSerial = 0;
    this.status = "stopped";
    this.settings = { echoCancellation: true, noiseSuppression: true, autoGainControl: false };
    this.gain = 0.35;
    this.musicVolume = 0.5;
    this.reverb = false;
    this.autotune = false;
    this.muted = false;
    this.warning = "";
  }
  supportedConstraints() {
    return this.platform.navigator?.mediaDevices?.getSupportedConstraints?.() || {};
  }
  publish() { this.onUpdate(this.getAudioDiagnostics()); }
  getAudioDiagnostics() {
    return {
      status: this.status, contextState: this.ctx?.state || "없음",
      sampleRate: this.ctx?.sampleRate ?? null,
      baseLatency: this.ctx?.baseLatency ?? null,
      outputLatency: this.ctx?.outputLatency ?? null,
      trackSettings: this.stream?.getAudioTracks()[0]?.getSettings?.() || {},
      supported: this.supportedConstraints(), requested: { ...this.settings },
      level: this.metrics?.rms || 0, peak: this.metrics?.peak || 0,
      protectionScale: this.protection?.scale ?? 1,
      warning: this.warning || this.protection?.reason || "",
      muted: this.muted, gain: this.gain,
      mode: this.autotune ? "AudioWorklet 오토튠" : "기본 경로 · 오토튠 우회",
      autotune: this.autotune, reverb: this.reverb,
      workletAvailable: Boolean(this.ctx?.audioWorklet && this.platform.AudioWorkletNode),
    };
  }
  ramp(param, value, seconds = 0.02) {
    param.cancelScheduledValues(this.ctx.currentTime);
    param.setTargetAtTime(value, this.ctx.currentTime, seconds);
  }
  async startMicrophone() {
    if (this.status === "starting" || this.status === "running") return false;
    const serial = ++this.serial;
    this.status = "starting";
    this.warning = "";
    this.gain = 0.35;
    this.muted = false;
    this.publish();
    let stream, ctx;
    try {
      const media = this.platform.navigator?.mediaDevices;
      if (!media?.getUserMedia) throw new Error("마이크는 HTTPS 또는 localhost의 지원 브라우저가 필요합니다.");
      const AudioContext = this.platform.AudioContext || this.platform.webkitAudioContext;
      // Resume inside the user gesture, before waiting for permission.
      ctx = new AudioContext({ latencyHint: "interactive", sampleRate: 48000 });
      this.ctx = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      const supported = this.supportedConstraints();
      const constraints = Object.fromEntries(Object.entries(this.settings).filter(([key]) => supported[key]));
      // Preferences, not guarantees: inspect getSettings() after capture.
      if (supported.latency) constraints.latency = { ideal: 0.01 };
      if (supported.channelCount) constraints.channelCount = { ideal: 1 };
      if (supported.sampleRate) constraints.sampleRate = { ideal: ctx.sampleRate };
      stream = await media.getUserMedia({ audio: constraints });
      if (serial !== this.serial) {
        stream.getTracks().forEach(track => track.stop());
        if (ctx.state !== "closed") await ctx.close();
        return false;
      }
      this.stream = stream;
      this.protection = new FeedbackProtection();
      this.metrics = null;
      this.source = ctx.createMediaStreamSource(stream);
      this.filter = ctx.createBiquadFilter();
      this.filter.type = "highpass";
      this.filter.frequency.value = 85;
      this.micGain = ctx.createGain();
      this.micGain.gain.value = this.gain;
      this.dry = ctx.createGain();
      this.tuned = ctx.createGain();
      this.tuned.gain.value = 0;
      this.limiter = ctx.createDynamicsCompressor();
      Object.assign(this.limiter.threshold, { value: -6 });
      this.limiter.knee.value = 0;
      this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.1;
      this.guard = ctx.createGain();
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.samples = new Float32Array(this.analyser.fftSize);
      this.mix = ctx.createGain();
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.wet = ctx.createGain();
      this.wet.gain.value = 0;
      this.convolver = ctx.createConvolver();
      const impulse = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 0.65), ctx.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
      }
      this.convolver.buffer = impulse;
      this.source.connect(this.filter);
      this.filter.connect(this.dry);
      this.dry.connect(this.micGain);
      this.tuned.connect(this.micGain);
      this.micGain.connect(this.limiter);
      this.micGain.connect(this.convolver);
      this.convolver.connect(this.wet);
      this.wet.connect(this.limiter);
      this.limiter.connect(this.guard);
      this.guard.connect(this.mix);
      this.guard.connect(this.analyser); // Meter is a side branch, not in the dry path.
      this.musicGain.connect(this.mix); // Future licensed accompaniment input, no fake playback.
      this.mix.connect(ctx.destination);
      this.autotune = false;
      this.reverb = false;
      this.status = "running";
      ctx.onstatechange = () => { if (this.ctx === ctx) this.publish(); };
      this.deviceChanged = () => {
        this.stopMicrophone();
        this.warning = "오디오 장치 변경: 출력을 중단했습니다. 다시 켜면 게인 0.35로 시작합니다.";
        this.publish();
      };
      media.addEventListener?.("devicechange", this.deviceChanged);
      ctx.onsinkchange = this.deviceChanged;
      stream.getAudioTracks().forEach(track => { track.onended = this.deviceChanged; });
      this.meterTimer = this.platform.setInterval(() => {
        if (this.ctx !== ctx) return;
        this.analyser.getFloatTimeDomainData(this.samples);
        this.metrics = this.protection.inspect(this.samples);
        this.ramp(this.guard.gain, this.muted ? 0 : this.metrics.scale, 0.005);
        this.publish();
      }, 100);
      this.publish();
      return true;
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (ctx && ctx.state !== "closed") await ctx.close().catch(() => {});
      if (serial !== this.serial) return false;
      this.stopMicrophone();
      this.warning = error.name === "NotAllowedError" ? "마이크 권한이 거부됐습니다." : `마이크 시작 실패: ${error.message}`;
      this.publish();
      return false;
    }
  }
  setMicrophoneGain(value) {
    this.gain = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.micGain && this.ctx) this.ramp(this.micGain.gain, this.gain);
    this.publish();
  }
  setMusicVolume(value) {
    this.musicVolume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.musicGain && this.ctx) this.ramp(this.musicGain.gain, this.musicVolume);
  }
  setReverb(enabled) {
    this.reverb = Boolean(enabled && this.status === "running");
    if (this.wet && this.ctx) this.ramp(this.wet.gain, this.reverb ? 0.15 : 0);
    this.publish();
  }
  async setAutotune(enabled) {
    const serial = ++this.effectSerial;
    const ctx = this.ctx;
    if (!ctx || this.status !== "running") return false;
    this.removeWorkletTimer && this.platform.clearTimeout(this.removeWorkletTimer);
    if (!enabled) {
      this.autotune = false;
      this.ramp(this.dry.gain, 1, 0.005);
      this.ramp(this.tuned.gain, 0, 0.005);
      // Disconnect and terminate DSP after the crossfade; OFF is a full bypass.
      const old = this.worklet;
      this.removeWorkletTimer = this.platform.setTimeout(() => {
        if (serial === this.effectSerial) this.disposeWorklet(old);
      }, 60);
      this.publish();
      return false;
    }
    try {
      if (!ctx.audioWorklet || !this.platform.AudioWorkletNode) throw new Error("AudioWorklet 미지원 또는 보안 컨텍스트가 아닙니다.");
      if (!this.workletLoaded) {
        // Inline source also preserves standalone HTML export; module code is local.
        if (!this.workletLoading) this.workletLoading = (async () => {
          const url = URL.createObjectURL(new Blob([workletSource], { type: "text/javascript" }));
          try { await ctx.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
        })();
        await this.workletLoading;
        if (ctx !== this.ctx) return false;
        this.workletLoaded = true;
      }
      if (ctx !== this.ctx || serial !== this.effectSerial) return false;
      if (!this.worklet) {
        this.worklet = new this.platform.AudioWorkletNode(ctx, "nano-autotune", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        this.filter.connect(this.worklet);
        this.worklet.connect(this.tuned);
        this.worklet.onprocessorerror = () => {
          if (this.ctx !== ctx) return;
          this.setAutotune(false);
          this.warning = "오토튠 오류: 기본 마이크 경로로 복귀했습니다.";
          this.publish();
        };
      }
      this.autotune = true;
      // Smooth entry; the optional processor fills its history during the fade.
      this.ramp(this.dry.gain, 0, 0.015);
      this.ramp(this.tuned.gain, 1, 0.015);
      this.publish();
      return true;
    } catch (error) {
      if (ctx !== this.ctx || serial !== this.effectSerial) return false;
      this.workletLoading = null;
      this.autotune = false;
      this.ramp(this.dry.gain, 1);
      this.ramp(this.tuned.gain, 0);
      this.disposeWorklet(this.worklet);
      this.warning = `오토튠 사용 불가, 기본 경로 유지: ${error.message}`;
      this.publish();
      return false;
    }
  }
  disposeWorklet(node) {
    if (!node) return;
    try { this.filter?.disconnect(node); } catch { /* already disconnected */ }
    node.onprocessorerror = null;
    node.port.postMessage("dispose");
    node.disconnect();
    node.port.close();
    if (this.worklet === node) this.worklet = null;
  }
  setCaptureSettings(settings) {
    // Never change capture processing while monitoring. Stop first; explicit restart at 0.35.
    this.stopMicrophone();
    this.settings = { ...this.settings, ...settings, autoGainControl: false };
    this.warning = "입력 설정 변경됨: 노래방을 다시 켜 실제 적용값을 확인하세요.";
    this.publish();
  }
  setEchoCancellation(value) { this.setCaptureSettings({ echoCancellation: Boolean(value) }); }
  setNoiseSuppression(value) { this.setCaptureSettings({ noiseSuppression: Boolean(value) }); }
  emergencyMute() {
    this.muted = true;
    if (this.guard && this.ctx) {
      this.guard.gain.cancelScheduledValues(this.ctx.currentTime);
      this.guard.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    this.warning = "긴급 음소거: 다시 출력하려면 노래방을 껐다 켜세요.";
    this.publish();
  }
  stopMicrophone() {
    ++this.serial;
    ++this.effectSerial;
    this.platform.clearInterval(this.meterTimer);
    this.platform.clearTimeout(this.removeWorkletTimer);
    this.platform.navigator?.mediaDevices?.removeEventListener?.("devicechange", this.deviceChanged);
    if (this.guard && this.ctx) {
      this.guard.gain.cancelScheduledValues(this.ctx.currentTime);
      this.guard.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    this.disposeWorklet(this.worklet);
    this.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    const ctx = this.ctx;
    if (ctx) { ctx.onstatechange = null; ctx.onsinkchange = null; }
    for (const key of ["source", "filter", "dry", "tuned", "micGain", "convolver", "wet", "limiter", "guard", "musicGain", "mix", "analyser"]) {
      this[key]?.disconnect();
      this[key] = null;
    }
    this.ctx = null;
    this.stream = null;
    this.workletLoaded = false;
    this.workletLoading = null;
    this.autotune = false;
    this.reverb = false;
    this.metrics = null;
    this.protection = null;
    this.gain = 0.35;
    this.status = "stopped";
    if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
    this.publish();
  }
  cleanup() { this.stopMicrophone(); }
}
