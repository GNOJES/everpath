import { it, expect } from 'vitest';
import { GameSimulation } from '../src/game/simulation';
import { parseSave } from '../src/game/save';
import { chooseEnemyKind, spawnInterval } from '../src/game/encounters';
it('uses fewer arrivals early and tapers smoothly into sparse final-boss reinforcements', () => {
 expect(spawnInterval(0)).toBeGreaterThan(.85);
 expect(spawnInterval(300)).toBeLessThan(spawnInterval(0));
 for (const t of [65, 120, 240, 360, 480, 555]) expect(Math.abs(spawnInterval(t + .01) - spawnInterval(t - .01))).toBeLessThan(.001);
 expect(spawnInterval(580)).toBeGreaterThan(spawnInterval(555));
 expect(spawnInterval(590)).toBeGreaterThan(spawnInterval(580));
 expect(spawnInterval(599.999)).toBeCloseTo(7.5, 1);
 expect(spawnInterval(600)).toBe(7.5);
 expect(spawnInterval(670)).toBe(7.5);
});

it('gives single-target builds time to level before fast enemies build up', () => {
 expect(spawnInterval(0)).toBeGreaterThan(1.3);
 expect(chooseEnemyKind(49.99, () => .95)).toBe('goblin');
 expect(chooseEnemyKind(50, () => .95)).toBe('bat');
 expect(chooseEnemyKind(94.99, () => .95)).toBe('bat');
 const sim = new GameSimulation('mage', parseSave(null), () => .5);
 for (let i = 0; i < 4; i++) sim.damageEnemy(sim.spawnEnemy('slime', 216, 280)!, 99);
 expect(sim.state.level).toBe(2);
 expect(sim.state.status).toBe('upgrade');
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
