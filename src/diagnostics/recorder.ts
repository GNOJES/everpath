import type { DiagnosticContext, DiagnosticEvent, FrameStats, Sample } from './types';
class Ring<T> {
 private values: T[] = []; private cursor = 0; dropped = 0;
 constructor(readonly capacity: number) {}
 push(value: T) { if (this.values.length < this.capacity) this.values.push(value); else { this.values[this.cursor] = value; this.cursor = (this.cursor + 1) % this.capacity; this.dropped++; } }
 get size() { return this.values.length; }
 latest(): T | undefined { return this.values.length ? this.values[this.values.length < this.capacity ? this.values.length - 1 : (this.cursor + this.capacity - 1) % this.capacity] : undefined; }
 array(): T[] { return this.values.length < this.capacity ? [...this.values] : [...this.values.slice(this.cursor), ...this.values.slice(0, this.cursor)]; }
}
const percentile = (values: number[], fraction: number) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] : 0;
const latencyStats = (values: number[]) => ({ count: values.length, meanMs: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0, p95Ms: percentile(values, .95), maxMs: values.length ? Math.max(...values) : 0 });
function frameStats(values: number[]): FrameStats {
 const durationMs = values.reduce((a, b) => a + b, 0), frames = values.length;
 return { frames, durationMs, fps: durationMs > 0 ? frames * 1000 / durationMs : 0, meanMs: frames ? durationMs / frames : 0, p95Ms: percentile(values, .95), maxMs: frames ? Math.max(...values) : 0, over33Ms: values.filter(v => v > 1000 / 30).length, over50Ms: values.filter(v => v > 50).length, over100Ms: values.filter(v => v > 100).length };
}
class Totals {
 frames = 0; durationMs = 0; maxMs = 0; over33Ms = 0; over50Ms = 0; over100Ms = 0;
 add(ms: number) { this.frames++; this.durationMs += ms; this.maxMs = Math.max(this.maxMs, ms); if (ms > 1000 / 30) this.over33Ms++; if (ms > 50) this.over50Ms++; if (ms > 100) this.over100Ms++; }
 snapshot() { return { frames: this.frames, durationMs: this.durationMs, fps: this.durationMs ? this.frames * 1000 / this.durationMs : 0, meanMs: this.frames ? this.durationMs / this.frames : 0, maxMs: this.maxMs, over33Ms: this.over33Ms, over50Ms: this.over50Ms, over100Ms: this.over100Ms }; }
}
export class DiagnosticsRecorder {
 private recording = false; private foreground = true; private started = 0; private lastFrame?: number; private windowStart?: number; private backgroundAt?: number;
 private backgroundMs = 0; private durations: number[] = []; private latencies: number[] = []; private pending: number[] = []; private droppedInput = 0;
 private context: DiagnosticContext = { screen: 'title', running: false, enemies: 0, projectiles: 0, effects: 0 };
 private samples: Ring<Sample>; private events: Ring<DiagnosticEvent>; private all = new Totals(); private running = new Totals();
 constructor(options: { sampleLimit?: number; eventLimit?: number } = {}) { this.samples = new Ring(options.sampleLimit ?? 1800); this.events = new Ring(options.eventLimit ?? 4000); }
 setRecording(enabled: boolean, at: number) {
  if (enabled === this.recording) return;
  if (enabled) {
   if (!this.all.frames && !this.events.array().length) this.started = at;
   this.recording = true; this.lastFrame = undefined; this.windowStart = undefined;
   if (!this.foreground) this.backgroundAt = at;
   this.event('recording_start', {}, at);
  } else {
   this.flush(at); this.event('recording_stop', {}, at);
   if (this.backgroundAt !== undefined) this.backgroundMs += Math.max(0, at - this.backgroundAt);
   this.backgroundAt = undefined; this.recording = false; this.lastFrame = undefined; this.pending = [];
  }
 }
 setForeground(active: boolean, at: number) {
  if (active === this.foreground) return;
  if (!active) { this.flush(at); if (this.recording) this.backgroundAt = at; }
  else if (this.backgroundAt !== undefined) { this.backgroundMs += Math.max(0, at - this.backgroundAt); this.backgroundAt = undefined; }
  this.foreground = active; this.lastFrame = undefined; this.windowStart = undefined; this.pending = [];
  this.event(active ? 'foreground' : 'background', {}, at);
 }
 frame(at: number, context: DiagnosticContext) {
  if (!this.recording || !this.foreground || !Number.isFinite(at) || at < 0) return;
  if (this.lastFrame === undefined) { this.lastFrame = at; this.windowStart = at; this.context = context; return; }
  if (at <= this.lastFrame) return;
  if (context.screen !== this.context.screen || context.running !== this.context.running || context.runId !== this.context.runId) this.flush(at);
  const delta = at - this.lastFrame; this.lastFrame = at; this.context = context; this.durations.push(delta); this.all.add(delta); if (context.running) this.running.add(delta);
  this.windowStart ??= at;
  if (at - this.windowStart >= 1000) this.flush(at);
 }
 input(at: number, accepted: boolean) {
  if (!this.recording || !this.foreground || !accepted || !Number.isFinite(at) || at < 0) return;
  if (this.pending.length === 32) { this.pending.shift(); this.droppedInput++; } this.pending.push(at);
 }
 consumeInput(at: number) {
  if (!this.recording || !this.foreground) return;
  for (const pending of this.pending) if (at >= pending && Number.isFinite(at)) this.latencies.push(at - pending);
  this.pending = [];
 }
 clearPendingInput() { this.pending = []; }
 event(kind: string, data: Record<string, unknown>, at: number) {
  if (this.recording) this.events.push({ atMs: Math.max(0, at - this.started), kind, data: structuredClone(data) });
 }
 flush(at: number) {
  if (this.durations.length || this.latencies.length) {
   this.samples.push({ atMs: Math.max(0, at - this.started), spanMs: Math.max(0, at - (this.windowStart ?? at)), frames: frameStats(this.durations), inputLatency: latencyStats(this.latencies), context: structuredClone(this.context) });
  }
  this.durations = []; this.latencies = []; this.windowStart = at;
 }
 latest() { const sample = this.samples.latest(); return sample ? structuredClone(sample) : undefined; }
 status() { return { samples: this.samples.size, events: this.events.size, frames: this.all.frames, slowFrames: this.all.over50Ms, droppedSamples: this.samples.dropped, droppedEvents: this.events.dropped }; }
 report(at: number) {
  return structuredClone({ schemaVersion: 1, active: this.recording, spanMs: Math.max(0, at - this.started),
   summary: { all: this.all.snapshot(), running: this.running.snapshot(), excludedBackgroundMs: this.backgroundMs + (this.backgroundAt !== undefined ? Math.max(0, at - this.backgroundAt) : 0) },
   retention: { sampleLimit: this.samples.capacity, eventLimit: this.events.capacity, droppedSamples: this.samples.dropped, droppedEvents: this.events.dropped, droppedInputTimings: this.droppedInput }, samples: this.samples.array(), events: this.events.array() });
 }
}
