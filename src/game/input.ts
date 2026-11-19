import { WORLD } from './config';
import { directionFromDrag, normalize } from './math';
import type { Vec } from './types';
import type { InputObservation, InputSnapshot } from '../diagnostics/types';
export class PlayerInput {
 private keys = new Set<string>(); private pointerId: number | null = null; private pointerType = ''; private touches = new Set<number>();
 center: Vec = { x: 0, y: 0 }; thumb: Vec = { x: 0, y: 0 }; dragging = false;
 private abort = new AbortController();
 constructor(private canvas: HTMLCanvasElement, private onPause: () => void, private observation?: (event: InputObservation) => void) {
  const options = { signal: this.abort.signal };
  window.addEventListener('keydown', e => {
   if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
   if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
   if (e.key === 'Escape' && !e.repeat) this.onPause(); this.keys.add(e.key.toLowerCase());
   if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) this.emit('key', true, e.timeStamp);
  }, options);
  window.addEventListener('keyup', e => { const changed = this.keys.delete(e.key.toLowerCase()); if (changed && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) this.emit('key', true, e.timeStamp); }, options);
  canvas.addEventListener('pointerdown', e => {
   if (e.pointerType === 'touch') this.touches.add(e.pointerId);
   if (this.pointerId !== null || e.button !== 0 || !e.isPrimary) { this.emit('down', false, e.timeStamp, 'non_primary_or_busy'); return; }
   e.preventDefault(); this.pointerId = e.pointerId; this.pointerType = e.pointerType || 'mouse'; this.dragging = true; this.center = this.point(e); this.thumb = { ...this.center }; canvas.setPointerCapture(e.pointerId); this.emit('down', true, e.timeStamp);
  }, options);
  canvas.addEventListener('pointermove', e => {
   if (e.pointerId !== this.pointerId) { if (this.touches.has(e.pointerId)) this.emit('move', false, e.timeStamp, 'non_primary'); return; }
   e.preventDefault(); this.thumb = this.point(e);
   const dx = this.thumb.x - this.center.x, dy = this.thumb.y - this.center.y, reach = Math.hypot(dx, dy);
   if (reach > WORLD.joystickRadius) this.center = { x: this.thumb.x - dx / reach * WORLD.joystickRadius, y: this.thumb.y - dy / reach * WORLD.joystickRadius };
   this.emit('move', true, e.timeStamp);
  }, options);
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) canvas.addEventListener(event, e => {
   this.touches.delete(e.pointerId); const accepted = e.pointerId === this.pointerId;
   if (accepted) this.clear(false, event, false);
   this.emit(event === 'pointerup' ? 'up' : event === 'pointercancel' ? 'cancel' : 'capture_lost', accepted, e.timeStamp, accepted ? undefined : 'unowned');
  }, options);
  window.addEventListener('blur', () => this.reset('blur'), options); window.addEventListener('resize', () => this.reset('resize'), options);
 }
 private point(e: PointerEvent): Vec { const r = this.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * WORLD.width, y: (e.clientY - r.top) / r.height * WORLD.height }; }
 direction(): Vec {
  const x = Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft'));
  const y = Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup'));
  if (x || y) return normalize(x, y); return this.dragging ? directionFromDrag(this.thumb.x - this.center.x, this.thumb.y - this.center.y) : { x: 0, y: 0 };
 }
 snapshot(): InputSnapshot {
  const keyboard = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].some(key => this.keys.has(key));
  return { source: keyboard ? 'keyboard' : this.dragging ? 'pointer' : 'idle', pointerId: this.pointerId, pointerType: this.pointerType, touches: this.touches.size, dragging: this.dragging, direction: this.direction(), center: { ...this.center }, thumb: { ...this.thumb } };
 }
 private emit(kind: InputObservation['kind'], accepted: boolean, at: number, reason?: string) { if (this.observation) this.observation({ kind, accepted, at, reason, snapshot: this.snapshot() }); }
 private clear(notify: boolean, reason: string, clearTouches = true) {
  const id = this.pointerId, hadState = id !== null || this.keys.size > 0 || this.touches.size > 0;
  this.pointerId = null; this.pointerType = ''; this.dragging = false; this.keys.clear(); if (clearTouches) this.touches.clear();
  if (id !== null && this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
  if (notify && hadState) this.emit('reset', false, performance.now(), reason);
 }
 reset(reason = 'reset') { this.clear(true, reason); }
 destroy() { this.reset('destroy'); this.abort.abort(); }
}
