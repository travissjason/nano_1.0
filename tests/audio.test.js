import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { AudioEngine } from "../src/audio/AudioEngine.js";
import { FeedbackProtection } from "../src/audio/FeedbackProtection.js";

function setup({ deferred = false, denied = false, workletFailure = false } = {}) {
  const nodes = [], contexts = [], intervals = new Map(), timers = new Map();
  let release, requests = 0, id = 0;
  const param = () => ({ value: 1, cancelScheduledValues() {}, setTargetAtTime(v) { this.value = v; }, setValueAtTime(v) { this.value = v; } });
  const node = type => {
    const n = { type, edges: [], gain: param(), frequency: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
      connect(other) { this.edges.push(other); }, disconnect(other) { this.edges = other ? this.edges.filter(n => n !== other) : []; },
      getFloatTimeDomainData(data) { data.fill(0); } };
    nodes.push(n); return n;
  };
  const track = { stopped: false, stop() { this.stopped = true; }, getSettings() { return { echoCancellation: true, noiseSuppression: true, autoGainControl: false }; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const media = { getSupportedConstraints: () => ({ echoCancellation: true, noiseSuppression: true, autoGainControl: true }),
    async getUserMedia(c) { requests++; media.constraints = c; if (denied) throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); return deferred ? new Promise(r => { release = () => r(stream); }) : stream; },
    addEventListener(_, fn) { media.changed = fn; }, removeEventListener() { media.changed = null; } };
  class Context {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 48000; this.baseLatency = 0.01; this.destination = node('destination'); this.audioWorklet = { addModule: async () => { if (workletFailure) throw new Error('module failure'); } }; contexts.push(this); }
    async close() { this.state = 'closed'; }
    createMediaStreamSource() { return node('source'); }
    createBiquadFilter() { return node('filter'); }
    createGain() { return node('gain'); }
    createDynamicsCompressor() { return node('limiter'); }
    createAnalyser() { return node('analyser'); }
    createConvolver() { return node('convolver'); }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  }
  class Worklet {
    constructor() { const n = node('worklet'); n.port = { postMessage(m) { n.disposed = m; }, close() {} }; return n; }
  }
  const platform = { navigator: { mediaDevices: media }, AudioContext: Context, AudioWorkletNode: Worklet,
    setInterval(fn) { intervals.set(++id, fn); return id; }, clearInterval(id) { intervals.delete(id); },
    setTimeout(fn) { timers.set(++id, fn); return id; }, clearTimeout(id) { timers.delete(id); } };
  const engine = new AudioEngine(() => {}, platform);
  return { engine, nodes, contexts, media, track, intervals, timers, release: () => release(), requests: () => requests };
}

test('native dry route, conservative gain, wet and music paths are separate', async () => {
  const { engine: e, media } = setup();
  assert.equal(await e.startMicrophone(), true);
  assert.equal(e.micGain.gain.value, 0.2);
  assert.equal(media.constraints.audio.autoGainControl, false);
  assert.deepEqual(e.filter.edges, [e.dry]);
  assert.ok(e.dry.edges.includes(e.micGain));
  assert.ok(e.micGain.edges.includes(e.limiter));
  assert.deepEqual(e.wet.edges, [e.limiter]);
  assert.deepEqual(e.musicGain.edges, [e.mix]);
  assert.equal(e.worklet, undefined);
  e.setMicrophoneGain(20); assert.equal(e.gain, 1);
  e.setReverb(true); assert.equal(e.wet.gain.value, 0.15);
  e.setReverb(false); assert.equal(e.wet.gain.value, 0);
  e.cleanup();
});

test('pending permission cannot cause duplicate starts or survive stop', async () => {
  const s = setup({ deferred: true });
  const first = s.engine.startMicrophone();
  assert.equal(await s.engine.startMicrophone(), false);
  s.engine.stopMicrophone(); s.release();
  assert.equal(await first, false);
  assert.equal(s.requests(), 1);
  assert.equal(s.track.stopped, true);
  assert.ok(s.contexts.every(c => c.state === 'closed'));
  assert.equal(s.intervals.size, 0);
});

test('permission denial closes the context and exposes the error', async () => {
  const s = setup({ denied: true });
  assert.equal(await s.engine.startMicrophone(), false);
  assert.equal(s.engine.status, 'stopped');
  assert.match(s.engine.warning, /권한/);
  assert.ok(s.contexts.every(c => c.state === 'closed'));
});

test('autotune OFF fully disconnects DSP; worklet failures preserve dry path', async () => {
  const { engine: e, timers } = setup(); await e.startMicrophone();
  assert.equal(await e.setAutotune(true), true);
  const processor = e.worklet;
  assert.ok(e.filter.edges.includes(processor));
  await e.setAutotune(false);
  for (const fn of timers.values()) fn();
  assert.equal(processor.disposed, 'dispose');
  assert.deepEqual(e.filter.edges, [e.dry]);
  assert.equal(e.dry.gain.value, 1);
  e.cleanup();
  const failed = setup({ workletFailure: true }).engine;
  await failed.startMicrophone();
  assert.equal(await failed.setAutotune(true), false);
  assert.equal(failed.dry.gain.value, 1);
  assert.equal(failed.status, 'running');
  assert.match(failed.warning, /기본 경로/);
  failed.cleanup();
});

test('MUTE is latched, device changes stop tracks and clear timers', async () => {
  const s = setup(), e = s.engine; await e.startMicrophone();
  e.emergencyMute();
  e.setMicrophoneGain(1);
  for (const fn of s.intervals.values()) fn();
  assert.equal(e.guard.gain.value, 0);
  s.media.changed();
  assert.equal(e.status, 'stopped');
  assert.equal(s.track.stopped, true);
  assert.equal(s.intervals.size, 0);
  assert.equal(e.gain, 0.2);
  assert.ok(s.nodes.every(n => n.edges.length === 0));
});

test('settings change stops monitoring; actual settings are separate from requests', async () => {
  const { engine: e } = setup(); await e.startMicrophone();
  assert.equal(e.getAudioDiagnostics().trackSettings.echoCancellation, true);
  e.setEchoCancellation(false);
  assert.equal(e.status, 'stopped');
  assert.equal(e.settings.echoCancellation, false);
  assert.equal(e.settings.autoGainControl, false);
});

test('level protection attenuates peaks and surges, never restores gain automatically', () => {
  const p = new FeedbackProtection();
  assert.equal(p.inspect(new Float32Array(32)).scale, 1);
  assert.equal(p.inspect(new Float32Array(32).fill(0.9)).scale, 0.5);
  assert.equal(p.inspect(new Float32Array(32)).scale, 0.5);
  assert.equal(p.inspect(new Float32Array(32).fill(0.3)).scale, 0.25);
});

test('worklet processes silence and sine without non-finite or unbounded output, then disposes', async () => {
  const source = await readFile(new URL('../src/audio/autotune.worklet.js', import.meta.url), 'utf8');
  let Processor;
  vm.runInNewContext(source, { sampleRate: 48000, Float32Array, Math, Number,
    AudioWorkletProcessor: class { constructor() { this.port = {}; } },
    registerProcessor: (_, p) => { Processor = p; } });
  const processor = new Processor(), output = new Float32Array(128);
  for (let block = 0; block < 200; block++) {
    const input = Float32Array.from({ length: 128 }, (_, i) => block < 10 ? 0 : 0.3 * Math.sin(2 * Math.PI * 233 * (block * 128 + i) / 48000));
    assert.equal(processor.process([[input]], [[output]]), true);
    assert.ok(output.every(value => Number.isFinite(value) && Math.abs(value) <= 0.301));
  }
  processor.port.onmessage({ data: 'dispose' });
  assert.equal(processor.process([], [[output]]), false);
});
