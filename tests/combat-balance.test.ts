import { describe, it, expect } from 'vitest';
import { GameSimulation } from '../src/game/simulation';
import { parseSave } from '../src/game/save';
const frames = (sim: GameSimulation, seconds: number) => { for (let i = 0; i < seconds * 30; i++) sim.update(1 / 30); };
describe('weapon and skill balance regressions', () => {
 it('keeps an aimed arrow at weapon level three instead of missing both sides of a small target', () => {
  const sim = new GameSimulation('archer', parseSave(null), () => .5); sim.state.weaponLevel = 3;
  const target = sim.spawnEnemy('slime', 216, 274)!; target.hp = target.maxHp = 1000; target.speed = 0;
  frames(sim, 1); expect(target.hp).toBeLessThan(1000);
 });
 it('keeps trained magic single-target even with a second enemy in the line of fire', () => {
  const sim = new GameSimulation('mage', parseSave(null), () => .5); sim.state.weaponLevel = 4;
  const front = sim.spawnEnemy('slime', 216, 430)!, back = sim.spawnEnemy('slime', 216, 295)!;
  for (const e of [front, back]) { e.hp = e.maxHp = 10000; e.speed = 0; }
  frames(sim, 1.5); expect(front.hp).toBeLessThan(10000); expect(back.hp).toBe(10000);
 });
 it('upgrading the basic weapon does not secretly multiply the damage or recharge of learned skills', () => {
  const cast = (weapon: number) => { const sim = new GameSimulation('mage', parseSave(null), () => .5); sim.state.weaponLevel = weapon; sim.state.skills.fire = 1; const e = sim.spawnEnemy('slime', 216, 450)!; e.hp = 10000; sim.update(.05); return 10000 - e.hp; };
  expect(cast(5)).toBeCloseTo(cast(1));
 });
 it('slows enemies whose collision radius overlaps the visible upgraded frost aura', () => {
  const run = (frost: number) => { const sim = new GameSimulation('mage', parseSave(null), () => .5); sim.state.skills.frost = frost; sim.update(.05); const e = sim.spawnEnemy('slime', 216, 389)!; const before = e.y; sim.update(.05); return e.y - before; };
  // Level two is a 118px circle; this 13px-radius slime at 126px overlaps it.
  expect(run(2)).toBeLessThan(run(0));
 });
});

it('makes both level-three bow arrows contribute against a narrow distant target', () => {
 const sim = new GameSimulation('archer', parseSave(null), () => .5); sim.state.weaponLevel = 3;
 const target = sim.spawnEnemy('slime', 216, 274)!; target.hp = target.maxHp = 1000; target.speed = 0;
 frames(sim, 1); expect(1000 - target.hp).toBeGreaterThanOrEqual(sim.damage * 2 - .001);
});

it('higher shield ranks improve recharge without stockpiling three fully blocked hits', () => {
 const sim = new GameSimulation('warrior', parseSave(null)); sim.state.skills.shield = 3; sim.update(.05);
 expect(sim.state.player.shield).toBe(1);
});

it('keeps skill recharge independent of weapon haste bonuses', () => {
 const recharge = (level: number) => { const sim = new GameSimulation('warrior', parseSave(null)); sim.state.skills.shield = 1; sim.state.weaponLevel = level; sim.update(.05); sim.damagePlayer(1); let time = 0; while (sim.state.player.shield === 0 && time < 13) { sim.update(.05); time += .05; } return time; };
 expect(recharge(5)).toBeCloseTo(recharge(1));
});

it('lets a sword start a swing when the enemy body already intersects its visible reach', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const target = sim.spawnEnemy('slime', 216, 431)!; target.hp = 1000; target.speed = 0;
 sim.update(.05); sim.update(.05); sim.update(.05); expect(target.hp).toBeLessThan(1000);
});

it('the warrior sweeps away an approaching enemy projectile without a melee target', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const { player, projectiles } = sim.state;
 projectiles.push({ id: 900, x: player.x, y: player.y - 40, kind:'enemy',
  vx:0, vy:50, pierce:1, damage:25, radius:4, life:1, hit:new Set() });
 frames(sim, .2);
 expect(sim.state.projectiles.some(shot => shot.id === 900)).toBe(false);
 expect(player.hp).toBe(player.maxHp);
});

it('puts three enemies on the field on the first frame of a normal expedition', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 sim.update(.016);
 expect(sim.state.spawned).toBe(3);
 expect(sim.state.enemies.every(enemy => enemy.y > 0)).toBe(true);
});

it('lets a basic arrow hit two lined-up targets without hitting a third', () => {
 const sim = new GameSimulation('archer', parseSave(null), () => .5);
 const targets = [445, 397, 349].map(y => sim.spawnEnemy('brute', 216, y)!);
 for (const enemy of targets) enemy.speed = 0;
 frames(sim, .4);
 expect(targets[0].hp).toBeLessThan(targets[0].maxHp);
 expect(targets[1].hp).toBeLessThan(targets[1].maxHp);
 expect(targets[2].hp).toBe(targets[2].maxHp);
});

it.each([[1, false, 84], [5, true, 136]])('limits sword level %i to the advertised frontal cone', (weaponLevel, evolved, degrees) => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const p = sim.state.player;
 sim.state.weaponLevel = weaponLevel;
 sim.state.evolved = evolved;
 const front = sim.spawnEnemy('brute', p.x, p.y - 55)!;
 const rear = sim.spawnEnemy('brute', p.x, p.y + 62)!;
 for (const enemy of [front, rear]) enemy.speed = 0;
 frames(sim, .15);
 expect(front.hp).toBeLessThan(front.maxHp);
 expect(rear.hp).toBe(rear.maxHp);
 const slash = sim.state.effects.find(effect => effect.kind === 'slash');
 expect((slash?.halfAngle ?? 0) * 360 / Math.PI).toBeCloseTo(degrees);
});
