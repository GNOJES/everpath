import { describe, it, expect } from 'vitest';
import { connectNativeApp, type NativeEvents } from '../src/platform/native';
import { GameSimulation } from '../src/game/simulation';
import { parseSave } from '../src/game/save';

class NativeBus implements NativeEvents {
 listeners = new Map<string, (data: any) => void>(); minimized = false;
 async addListener(name: 'appStateChange' | 'pause' | 'resume' | 'backButton', callback: (data: any) => void) { this.listeners.set(name, callback); return { remove: async () => { this.listeners.delete(name); } }; }
 async minimizeApp() { this.minimized = true; }
 emit(name: string, data?: unknown) { this.listeners.get(name)?.(data); }
}
describe('native lifecycle boundary', () => {
 it('freezes a normal run on native pause and never resumes it automatically', async () => {
  const bus = new NativeBus(), sim = new GameSimulation('warrior', parseSave(null));
  const cleanup = await connectNativeApp({ suspendForNative: () => sim.pause(), handleNativeBack: () => true }, bus, true);
  sim.update(.05, { x: 1, y: 0 }); bus.emit('pause'); const before = JSON.stringify(sim.state);
  bus.emit('appStateChange', { isActive: true }); sim.update(.05, { x: 1, y: 0 }); expect(JSON.stringify(sim.state)).toBe(before);
  await cleanup(); expect(bus.listeners.size).toBe(0);
 });
 it('restores diagnostics foreground on native resume without resuming combat', async () => {
  const bus = new NativeBus(), sim = new GameSimulation('warrior', parseSave(null)); let foreground = true;
  await connectNativeApp({ suspendForNative: () => { foreground = false; sim.pause(); }, resumeForNative: () => { foreground = true; }, handleNativeBack: () => true }, bus, true);
  bus.emit('pause'); expect(foreground).toBe(false); bus.emit('resume'); expect(foreground).toBe(true); expect(sim.state.status).toBe('paused');
 });
 it('routes handled game back presses locally and minimizes only at the root', async () => {
  const bus = new NativeBus(), sim = new GameSimulation('archer', parseSave(null)); let root = false;
  await connectNativeApp({ suspendForNative: () => sim.pause(), handleNativeBack: () => { if (root) return false; sim.pause(); return true; } }, bus, true);
  bus.emit('backButton'); expect(sim.state.status).toBe('paused'); expect(bus.minimized).toBe(false);
  root = true; bus.emit('backButton'); expect(bus.minimized).toBe(true);
 });
 it('does not register native listeners in a browser', async () => {
  const bus = new NativeBus(); await connectNativeApp({ suspendForNative() {}, handleNativeBack: () => false }, bus, false); expect(bus.listeners.size).toBe(0);
 });
});
