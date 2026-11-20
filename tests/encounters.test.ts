import { it, expect } from 'vitest';
import { GameSimulation } from '../src/game/simulation';
import { parseSave } from '../src/game/save';
import { spawnInterval } from '../src/game/encounters';
it('increases spawn pressure smoothly across minute boundaries and caps it below five enemies per second', () => {
 expect(spawnInterval(0)).toBeLessThan(.85);
 for (const t of [65, 130, 180, 260, 300, 555]) { expect(Math.abs(spawnInterval(t + .01) - spawnInterval(t - .01))).toBeLessThan(.001); }
 expect(1 / spawnInterval(300)).toBeGreaterThan(2); expect(spawnInterval(590)).toBeGreaterThan(spawnInterval(555) * 2);
 expect(1 / spawnInterval(600)).toBeLessThan(1);
 expect(Math.abs(spawnInterval(600.01) - spawnInterval(599.99))).toBeLessThan(.003);
 expect(spawnInterval(36000)).toBeGreaterThanOrEqual(.2);
});

it('spaces out late shaman arrivals and keeps only one active', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .99);
 sim.state.elapsed = 500;
 sim.state.nextBoss = Infinity;
 sim.state.player.hp = sim.state.player.maxHp = 10000;
 sim.spawnEnemy('slime', 20, 30);
 sim.update(.05);
 const first = sim.state.enemies.find(enemy => enemy.kind === 'shaman')!;
 expect(first).toBeDefined();
 for (let i = 0; i < 120; i++) sim.update(.05);
 expect(sim.state.enemies.filter(enemy => enemy.kind === 'shaman' && enemy.hp > 0)).toHaveLength(1);
 sim.damageEnemy(first, 1e9);
 while (sim.state.choices.length) sim.chooseUpgrade(sim.state.choices[0].id);
 for (let i = 0; i < 120; i++) sim.update(.05);
 expect(sim.state.enemies.filter(enemy => enemy.kind === 'shaman' && enemy.hp > 0)).toHaveLength(0);
});
