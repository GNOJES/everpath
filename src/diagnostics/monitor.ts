import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { App as NativeApp } from '@capacitor/app';
import { version } from '../../package.json';
import { DiagnosticsRecorder } from './recorder';
import type { DiagnosticContext, InputObservation } from './types';
const FLAG = 'everpath.diagnostics.enabled.v1';
let sessionSerial = 0;
export class DiagnosticsMonitor {
 recorder = new DiagnosticsRecorder(); enabled = false; note = ''; storageAvailable = true;
 private context: DiagnosticContext = { screen: 'title', running: false, enemies: 0, projectiles: 0, effects: 0 };
 private blocked = new Set<string>(); private raf = 0; private startedAt = new Date().toISOString(); private sessionId = `${Date.now()}-${++sessionSerial}`;
 private metadata: Record<string, unknown> = {}; private metadataTask?: Promise<void>; private lastMove = -Infinity; private lastUi = 0; private contextKey = '';
 onChange?: () => void;
 constructor() {
  try { this.enabled = localStorage.getItem(FLAG) === 'true'; } catch { this.storageAvailable = false; }
  if (document.hidden) this.blocked.add('visibility');
  window.addEventListener('blur', () => this.setForeground(false, 'focus'));
  window.addEventListener('focus', () => this.setForeground(true, 'focus'));
  document.addEventListener('visibilitychange', () => this.setForeground(!document.hidden, 'visibility'));
  window.addEventListener('error', event => this.error('error', event.error ?? event.message));
  window.addEventListener('unhandledrejection', event => this.error('unhandledrejection', event.reason));
  window.addEventListener('resize', () => { if (this.enabled) this.recorder.event('viewport', this.viewport(), performance.now()); });
  if (this.enabled) this.activate();
 }
 private viewport() { return { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, orientation: screen.orientation?.type ?? 'unknown' }; }
 private activate() {
  this.recorder.setForeground(this.blocked.size === 0, performance.now()); this.recorder.setRecording(true, performance.now());
  void this.ensureMetadata(); this.schedule();
 }
 setEnabled(enabled: boolean) {
  if (this.enabled === enabled) return; this.enabled = enabled;
  try { localStorage.setItem(FLAG, String(enabled)); } catch { this.storageAvailable = false; }
  if (enabled) this.activate(); else { cancelAnimationFrame(this.raf); this.raf = 0; this.recorder.setRecording(false, performance.now()); }
  this.onChange?.();
 }
 newSession() {
  this.recorder = new DiagnosticsRecorder(); this.startedAt = new Date().toISOString(); this.sessionId = `${Date.now()}-${++sessionSerial}`; this.lastMove = -Infinity; this.contextKey = '';
  this.recorder.setForeground(this.blocked.size === 0, performance.now()); if (this.enabled) this.recorder.setRecording(true, performance.now()); this.onChange?.();
 }
 setContext(context: DiagnosticContext) {
  if (!this.enabled) return;
  const key = `${context.screen}/${context.running}/${context.runId ?? ''}`;
  if (key !== this.contextKey) { this.recorder.clearPendingInput(); this.recorder.event('context', { screen: context.screen, running: context.running, hero: context.hero, runId: context.runId }, performance.now()); this.contextKey = key; }
  this.context = context;
 }
 observeInput(observation: InputObservation) {
  if (!this.enabled) return;
  const now = performance.now(); let eventAt = observation.at;
  if (eventAt > 1e12) eventAt -= performance.timeOrigin;
  if (!Number.isFinite(eventAt) || eventAt < 0 || eventAt > now) eventAt = now;
  this.recorder.input(eventAt, this.context.running && observation.accepted && observation.kind !== 'reset');
  if (observation.kind !== 'move' || now - this.lastMove >= 200) {
   this.recorder.event('input', { action: observation.kind, accepted: observation.accepted, reason: observation.reason, state: observation.snapshot }, now);
   if (observation.kind === 'move') this.lastMove = now;
  }
 }
 consumeInput(at: number) { if (this.enabled) this.recorder.consumeInput(at); }
 setForeground(active: boolean, reason: string) {
  if (active) this.blocked.delete(reason); else this.blocked.add(reason);
  this.recorder.setForeground(this.blocked.size === 0, performance.now());
  if (this.blocked.size) { cancelAnimationFrame(this.raf); this.raf = 0; } else this.schedule();
 }
 private schedule() { if (this.enabled && !this.blocked.size && !this.raf) this.raf = requestAnimationFrame(this.frame); }
 private frame = (time: number) => {
  this.raf = 0; this.recorder.frame(time, this.context);
  if (time - this.lastUi >= 250) { this.lastUi = time; this.onChange?.(); }
  this.schedule();
 };
 private error(kind: string, value: unknown) {
  if (!this.enabled) return;
  const error = value instanceof Error ? value : new Error(typeof value === 'string' ? value : 'Non-Error rejection');
  this.recorder.event(kind, { name: error.name, message: error.message.slice(0, 500), stack: error.stack?.slice(0, 1500) }, performance.now());
 }
 async ensureMetadata() {
  this.metadataTask ??= (async () => {
   if (!Capacitor.isNativePlatform()) return;
   try {
    const [device, app] = await Promise.all([Device.getInfo(), NativeApp.getInfo()]);
    this.metadata = { device: { model: device.model, manufacturer: device.manufacturer, platform: device.platform, osVersion: device.osVersion, androidSDKVersion: device.androidSDKVersion, webViewVersion: device.webViewVersion, isVirtual: device.isVirtual }, app: { id: app.id, version: app.version, build: app.build } };
   } catch (error) { this.error('metadata_error', error); }
  })();
  await this.metadataTask;
 }
 report() {
  const now = performance.now(); this.recorder.flush(now);
  return { ...this.recorder.report(now), sessionId: this.sessionId, startedAt: this.startedAt, exportedAt: new Date().toISOString(), appVersion: version, note: this.note.slice(0, 200),
   measurement: { frames: 'Raw requestAnimationFrame callback intervals; not GPU presentation or physical display latency.', input: 'Accepted input event timestamp to next running simulation update; not glass-to-photon.', windowMs: 1000, moveEventLogRateHz: 5, simulationStepClampMs: 50 },
   environment: { platform: Capacitor.getPlatform(), userAgent: navigator.userAgent, language: navigator.language, viewport: this.viewport(), ...this.metadata },
  };
 }
 latest() { return this.recorder.latest(); }
 currentInput() { return this.context.input; }
 isForeground() { return this.blocked.size === 0; }
}
