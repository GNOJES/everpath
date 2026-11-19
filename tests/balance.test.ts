import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { playTrial, type Build, type Policy } from './helpers/playtest';
import type { HeroId } from '../src/game/types';
describe('normal-HP ten-minute playtest matrix', () => {
 it('records reproducible movement/build trials without preloading progression', () => {
  const results: ReturnType<typeof playTrial>[] = [];
  for (const hero of ['warrior', 'archer', 'mage'] as HeroId[]) for (const seed of [42, 271, 2026]) for (const policy of ['idle', 'circuit', 'reactive'] as Policy[]) for (const build of ['balanced', 'weapon', 'skills'] as Build[]) {
   const result = playTrial(hero, seed, policy, build); results.push(result);
   expect(result.survived).toBeGreaterThan(0); expect(result.survived).toBeLessThanOrEqual(600); expect(result.maxEnemies).toBeLessThanOrEqual(100); expect(result.maxShots).toBeLessThanOrEqual(180);
  }
  if (process.env.BALANCE_REPORT) { mkdirSync('docs/playtests', { recursive: true }); writeFileSync(`docs/playtests/${process.env.BALANCE_REPORT}.json`, JSON.stringify({ conditions: 'Normal HP, no meta upgrades, no state edits, 30 Hz simulation, 10 Hz steering; capped at 600 game seconds', results }, null, 2)); }
  for (const hero of ['warrior', 'archer', 'mage'] as HeroId[]) {
   const trials = results.filter(r => r.hero === hero && r.policy === 'reactive');
   expect(trials.every(r => r.status !== 'victory')).toBe(true);
   const mean = trials.reduce((sum, r) => sum + r.survived, 0) / trials.length; expect(mean).toBeGreaterThan(180); expect(mean).toBeLessThan(600);
   const idle = results.filter(r => r.hero === hero && r.policy === 'idle');
   expect(idle.every(r => r.survived < 600)).toBe(true);
   expect(idle.reduce((sum, r) => sum + r.survived, 0) / idle.length).toBeLessThan(mean);
  }
  console.table((['warrior', 'archer', 'mage'] as HeroId[]).flatMap(hero => (['idle', 'circuit', 'reactive'] as Policy[]).map(policy => { const trials = results.filter(r => r.hero === hero && r.policy === policy); return { hero, policy, min: Math.min(...trials.map(r => r.survived)), mean: Math.round(trials.reduce((n, r) => n + r.survived, 0) / trials.length), max: Math.max(...trials.map(r => r.survived)), kills: Math.round(trials.reduce((n, r) => n + r.kills, 0) / trials.length), bosses: trials.reduce((n, r) => n + r.bosses, 0) }; })));
 }, 60000);
});
