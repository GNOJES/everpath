import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InputObservation } from '../src/diagnostics/types';
import { PlayerInput } from '../src/game/input';
class TestCanvas extends EventTarget {
 private captures = new Set<number>();
 getBoundingClientRect() { return { left: 100, top: 50, width: 216, height: 384 }; }
 setPointerCapture(id: number) { this.captures.add(id); }
 hasPointerCapture(id: number) { return this.captures.has(id); }
 releasePointerCapture(id: number) { this.captures.delete(id); }
}
const event = (target: EventTarget, type: string, props: Record<string, unknown> = {}) => { const e = new Event(type, { cancelable: true }); Object.assign(e, props); target.dispatchEvent(e); };
let windowTarget: EventTarget, canvas: TestCanvas, input: PlayerInput;
beforeEach(() => { windowTarget = new EventTarget(); canvas = new TestCanvas(); vi.stubGlobal('window', windowTarget); vi.stubGlobal('HTMLInputElement', class {}); vi.stubGlobal('HTMLTextAreaElement', class {}); input = new PlayerInput(canvas as unknown as HTMLCanvasElement, () => {}); });
afterEach(() => { input.destroy(); vi.unstubAllGlobals(); });
describe('floating joystick lifecycle', () => {
 it('anchors at the touch, scales to logical pixels, and stops on release', () => {
  event(canvas, 'pointerdown', { pointerId: 1, isPrimary: true, button: 0, clientX: 130, clientY: 150 });
  expect(input.center).toEqual({ x: 60, y: 200 }); expect(input.direction()).toEqual({ x: 0, y: 0 });
  event(canvas, 'pointermove', { pointerId: 1, clientX: 154, clientY: 150 }); expect(input.direction()).toEqual({ x: 1, y: 0 });
  event(canvas, 'pointerup', { pointerId: 1 }); expect(input.direction()).toEqual({ x: 0, y: 0 }); expect(input.dragging).toBe(false);
 });
 it('ignores secondary fingers and creates a fresh center on the next touch', () => {
  event(canvas, 'pointerdown', { pointerId: 1, isPrimary: true, button: 0, clientX: 130, clientY: 150 });
  event(canvas, 'pointerdown', { pointerId: 2, isPrimary: false, button: 0, clientX: 170, clientY: 200 });
  event(canvas, 'pointermove', { pointerId: 2, clientX: 200, clientY: 200 }); expect(input.direction()).toEqual({ x: 0, y: 0 });
  event(canvas, 'pointercancel', { pointerId: 1 });
  event(canvas, 'pointerdown', { pointerId: 3, isPrimary: true, button: 0, clientX: 150, clientY: 200 }); expect(input.center).toEqual({ x: 100, y: 300 });
 });
 for (const reason of ['blur', 'resize']) it(`clears keyboard and joystick on ${reason}`, () => {
  event(windowTarget, 'keydown', { key: 'w' }); expect(input.direction().y).toBe(-1);
  event(windowTarget, reason); expect(input.direction()).toEqual({ x: 0, y: 0 }); expect(input.dragging).toBe(false);
 });
 it('normalizes keyboard diagonals, ignores right click and does not react to UI touches', () => {
  event(windowTarget, 'keydown', { key: 'w' }); event(windowTarget, 'keydown', { key: 'd' }); expect(Math.hypot(input.direction().x, input.direction().y)).toBeCloseTo(1);
  input.reset(); event(canvas, 'pointerdown', { pointerId: 4, isPrimary: true, button: 2, clientX: 200, clientY: 200 }); expect(input.dragging).toBe(false);
  event(new EventTarget(), 'pointerdown', { pointerId: 5, isPrimary: true, button: 0 }); expect(input.direction()).toEqual({ x: 0, y: 0 });
 });
 it('removes owned listeners when destroyed', () => { input.destroy(); event(windowTarget, 'keydown', { key: 'd' }); expect(input.direction()).toEqual({ x: 0, y: 0 }); });
});

describe('long touch drag reversals', () => {
 it('follows an overextended thumb so a short physical reversal immediately changes direction', () => {
  event(canvas, 'pointerdown', { pointerId: 1, isPrimary: true, button: 0, clientX: 130, clientY: 150 });
  event(canvas, 'pointermove', { pointerId: 1, clientX: 200, clientY: 150 }); expect(input.direction().x).toBe(1);
  event(canvas, 'pointermove', { pointerId: 1, clientX: 170, clientY: 150 }); expect(input.direction().x).toBeLessThan(0);
 });
});


describe('diagnostic input observations', () => {
 it('keeps held secondary touches visible after the primary lifts and resets on blur', () => {
  input.destroy(); const observations: InputObservation[] = [];
  input = new PlayerInput(canvas as unknown as HTMLCanvasElement, () => {}, observation => observations.push(observation));
  event(canvas, 'pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 130, clientY: 150 });
  event(canvas, 'pointerdown', { pointerId: 2, pointerType: 'touch', isPrimary: false, button: 0, clientX: 170, clientY: 200 });
  expect(observations.at(-1)?.accepted).toBe(false); expect(input.snapshot().touches).toBe(2);
  event(canvas, 'pointerup', { pointerId: 1 }); expect(input.snapshot()).toMatchObject({ touches: 1, dragging: false, source: 'idle' });
  event(canvas, 'pointermove', { pointerId: 2, clientX: 190, clientY: 200 });
  expect(observations.at(-1)).toMatchObject({ kind: 'move', accepted: false, snapshot: { touches: 1 } });
  event(windowTarget, 'blur'); expect(observations.at(-1)).toMatchObject({ kind: 'reset', reason: 'blur', snapshot: { touches: 0 } });
  expect(observations[0].snapshot.touches).toBe(1);
 });
});
