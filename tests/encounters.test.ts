import { it, expect } from 'vitest';
import { spawnInterval } from '../src/game/encounters';
it('increases spawn pressure smoothly across minute boundaries and caps it below five enemies per second', () => {
 expect(spawnInterval(0)).toBeCloseTo(1.05, 2);
 for (const t of [65, 130, 180, 260, 300, 600]) { expect(Math.abs(spawnInterval(t + .01) - spawnInterval(t - .01))).toBeLessThan(.001); }
 expect(1 / spawnInterval(300)).toBeGreaterThan(2); expect(1 / spawnInterval(600)).toBeLessThan(5);
 expect(spawnInterval(36000)).toBeGreaterThanOrEqual(.2);
});
