import { it, expect, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { GameSimulation } from '../src/game/simulation';
import { parseSave } from '../src/game/save';
import { WORLD } from '../src/game/config';
import { playTrial } from './helpers/playtest';

it('uses three upper entries with an exact 3:1:1 split across complete groups', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const spawns = vi.spyOn(sim, 'spawnEnemy');
 sim.state.player.y = WORLD.minY;
 for (let i = 0; i < 1800 && spawns.mock.calls.length < 30; i++) {
  sim.update(.025);
  if (sim.state.choices[0]) sim.chooseUpgrade(sim.state.choices[0].id);
 }
 const calls = spawns.mock.calls.slice(0, 30);
 expect(calls).toHaveLength(30);
 expect(calls.filter(([,x]) => x < 0)).toHaveLength(6);
 expect(calls.filter(([,x]) => x > WORLD.width)).toHaveLength(6);
 expect(calls.filter(([,x]) => x >= 0 && x <= WORLD.width)).toHaveLength(18);
 expect(calls.every(([, ,y]) => y <= 176)).toBe(true);
});

it('warns, advances diagonally through the middle-upper lane, then starts chasing', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 sim.state.player.y = 75;
 while (!sim.state.sideEntries.length && sim.state.elapsed < 4) sim.update(.025);
 const pending = sim.state.sideEntries[0];
 expect(pending.remaining).toBeCloseTo(.8);
 expect(sim.state.enemies.every(e => !e.entryTarget)).toBe(true);
 for (let i = 0; i < 20; i++) sim.update(.025);
 expect(sim.state.sideEntries[0].remaining).toBeGreaterThan(.25);
 let side = sim.state.enemies.find(e => e.entryTarget);
 for (let i = 0; !side && i < 25; i++) {
  sim.update(.025);
  side = sim.state.enemies.find(e => e.entryTarget);
 }
 expect(side).toBeDefined();
 const enemy = side!;
 const start = { x: enemy.x, y: enemy.y };
 sim.update(.05);
 expect(enemy.x).toBeGreaterThan(start.x);
 expect(enemy.y).toBeGreaterThan(start.y);
 for (let i = 0; enemy.entryTarget && i < 300; i++) {
  sim.update(.025);
  if (sim.state.choices[0]) sim.chooseUpgrade(sim.state.choices[0].id);
 }
 expect(enemy.entryTarget).toBeUndefined();
 expect(enemy.y).toBeCloseTo(pending.target.y);
 sim.update(.05);
 expect(enemy.y).toBeLessThan(pending.target.y);
});

it('compares camping lanes and mobile play for all heroes across six seeds', () => {
 const results = [];
 for (const hero of ['warrior','archer','mage'] as const) {
  for (const rank of [0, 10]) for (const seed of [42,271,2026,91,777,4096]) {
   for (const policy of ['high-camp','mid-camp','reactive'] as const) {
    results.push(playTrial(hero, seed, policy, 'weapon', 360, rank));
   }
  }
 }
 if (process.env.UPPER_WAVE_REPORT) {
  mkdirSync('artifacts/web', { recursive: true });
  writeFileSync('artifacts/web/upper-waves.json', JSON.stringify(results, null, 2));
 }
 for (const hero of ['warrior','archer','mage'] as const) {
  const subset = results.filter(r => r.hero === hero);
  const alive = (policy: string) => subset.filter(r => r.policy === policy).reduce((n,r) => n+r.survived,0);
  expect(alive('reactive')).toBeGreaterThan(alive('high-camp'));
 }
}, 60000);
