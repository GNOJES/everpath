import { describe, it, expect } from 'vitest';
import { DiagnosticsRecorder } from '../src/diagnostics/recorder';
const context = { screen: 'run', running: true, hero: 'archer', enemies: 3, projectiles: 2, effects: 0 };
describe('raw device diagnostic collector', () => {
 it('measures real intervals including a long frame without applying the simulation clamp', () => {
  const r = new DiagnosticsRecorder(); r.setRecording(true, 0); r.frame(0, context);
  for (const at of [16, 32, 48, 128]) r.frame(at, context); r.flush(128);
  const sample = r.report(128).samples[0]; expect(sample.frames.frames).toBe(4); expect(sample.frames.fps).toBeCloseTo(31.25); expect(sample.frames.p95Ms).toBe(80); expect(sample.frames.maxMs).toBe(80); expect(sample.frames.over50Ms).toBe(1);
 });
 it('excludes background and disabled gaps and waits for a new baseline after resume', () => {
  const r = new DiagnosticsRecorder(); r.setRecording(true, 0); r.frame(0, context); r.frame(20, context); r.setForeground(false, 20);
  r.frame(10000, context); r.setForeground(true, 10000); r.frame(10000, context); r.frame(10020, context); r.flush(10020);
  const out = r.report(10020); expect(out.summary.all.frames).toBe(2); expect(out.summary.all.maxMs).toBe(20); expect(out.summary.excludedBackgroundMs).toBe(9980);
  r.setRecording(false, 10020); r.frame(50000, context); expect(r.report(50000).summary.all.frames).toBe(2);
 });
 it('keeps running performance separate from paused/menu frames', () => {
  const r = new DiagnosticsRecorder(); r.setRecording(true, 0); r.frame(0, context); r.frame(20, context);
  r.frame(40, { ...context, running: false, screen: 'settings' }); r.frame(140, { ...context, running: false, screen: 'settings' }); r.flush(140);
  expect(r.report(140).summary.running.maxMs).toBe(20); expect(r.report(140).summary.all.maxMs).toBe(100);
 });
 it('measures accepted input until the next game update, ignores rejected fingers and clears pending input on suspension', () => {
  const r = new DiagnosticsRecorder(); r.setRecording(true, 0); r.frame(0, context);
  r.input(10, true); r.input(5, false); r.consumeInput(25); r.frame(30, context); r.flush(30);
  expect(r.report(30).samples[0].inputLatency).toEqual({ count: 1, meanMs: 15, p95Ms: 15, maxMs: 15 });
  r.input(31, true); r.setForeground(false, 32); r.setForeground(true, 1000); r.consumeInput(1010); r.frame(1010, context); r.frame(1030, context); r.flush(1030);
  expect(r.report(1030).samples.at(-1)!.inputLatency.count).toBe(0);
 });
 it('bounds sample/event retention, reports dropped entries and returns immutable snapshots', () => {
  const r = new DiagnosticsRecorder({ sampleLimit: 2, eventLimit: 3 }); r.setRecording(true, 0); r.frame(0, context);
  for (let t = 1000; t <= 5000; t += 1000) { r.frame(t, context); r.event('marker', { t }, t); }
  const out = r.report(5000); expect(out.samples).toHaveLength(2); expect(out.events).toHaveLength(3); expect(out.retention.droppedSamples).toBe(3); expect(out.retention.droppedEvents).toBeGreaterThan(0);
  out.samples[0].context.enemies = 999; expect(r.report(5000).samples[0].context.enemies).toBe(3);
 });
 it('does not emit NaN or Infinity for an empty session or invalid timestamps', () => {
  const r = new DiagnosticsRecorder(); r.setRecording(true, 0); r.frame(NaN, context); r.frame(10, context); r.frame(10, context); r.frame(5, context);
  const out = r.report(10); expect(out.summary.all.frames).toBe(0); expect(out.summary.all.fps).toBe(0); expect(JSON.stringify(out)).not.toContain('null');
 });
 it('bounds queued input observations during a stalled frame', () => {
  const r = new DiagnosticsRecorder(); r.setRecording(true, 0); for (let i = 0; i < 100; i++) r.input(i, true); r.consumeInput(110); r.frame(110, context); r.frame(130, context); r.flush(130);
  expect(r.report(130).retention.droppedInputTimings).toBe(68); expect(r.report(130).samples[0].inputLatency.count).toBe(32);
 });
});
