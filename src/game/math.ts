import { WORLD } from './config';
import type { Vec } from './types';
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export function normalize(x: number, y: number): Vec { const n = Math.hypot(x, y); return n > 1 ? { x: x / n, y: y / n } : { x, y }; }
export function directionFromDrag(dx: number, dy: number): Vec {
 const length = Math.hypot(dx, dy); if (length <= WORLD.joystickDeadzone) return { x: 0, y: 0 };
 const strength = clamp((length - WORLD.joystickDeadzone) / (WORLD.joystickRadius - WORLD.joystickDeadzone), 0, 1);
 return { x: dx / length * strength, y: dy / length * strength };
}
export function unit(a: Vec, b: Vec): Vec { const d = distance(a, b) || 1; return { x: (b.x - a.x) / d, y: (b.y - a.y) / d }; }
export function formatTime(seconds: number) { const s = Math.floor(seconds); return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`; }
