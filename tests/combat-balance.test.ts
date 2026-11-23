import { describe, it, expect } from 'vitest';
import { GameSimulation } from '../src/game/simulation';
import { HEROES, SKILLS } from '../src/game/config';
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
 it('keeps frost damage secondary and leaves bosses free to move', () => {
  const cast = (frost: number) => {
   const sim = new GameSimulation('mage', parseSave(null), () => .5);
   sim.state.skills.frost = frost;
   const p = sim.state.player;
   const boss = sim.spawnEnemy('briar', p.x, p.y - 125)!;
   const slime = sim.spawnEnemy('slime', p.x + 60, p.y - 45)!;
   const start = boss.y;
   sim.update(.05);
   return { bossMoved: boss.y - start, slimeDamage: slime.maxHp - slime.hp, chainDamage: sim.power * SKILLS.chain.damage };
  };
  const frost = cast(3);
  expect(frost.bossMoved).toBeCloseTo(cast(0).bossMoved);
  expect(frost.slimeDamage).toBeGreaterThan(0);
  expect(frost.slimeDamage).toBeLessThan(frost.chainDamage / 4);
 });
 it('recasts a mastered lightning spell sooner only if the spell killed its target', () => {
  const countCasts = (firstHp: number) => {
   const sim = new GameSimulation('mage', parseSave(null), () => .5);
   sim.state.skills.chain = 4;
   sim.state.timeStopRemaining = 3;
   const p = sim.state.player;
   const first = sim.spawnEnemy('slime', p.x, p.y - 200)!;
   first.hp = firstHp;
   sim.spawnEnemy('slime', p.x + 30, p.y - 235);
   let casts = 0;
   sim.onSound = cue => { if (cue === 'chain') casts++; };
   frames(sim, 1);
   return casts;
  };
  expect(countCasts(15)).toBe(2);
  expect(countCasts(1000)).toBe(1);
 });
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

it.each([[1, 1], [2, 2], [3, 3]])('unlocks pierce with bow rank %i', (rank, hits) => {
 const sim = new GameSimulation('archer', parseSave(null), () => .5);
 sim.state.weaponLevel = rank;
 const targets = [465, 420, 375, 330].map(y => sim.spawnEnemy('brute', 216, y)!);
 for (const enemy of targets) enemy.speed = 0;
 frames(sim, .41);
 expect(targets.filter(enemy => enemy.hp < enemy.maxHp)).toHaveLength(hits);
});

it('gives the archer the lowest base single-target DPS', () => {
 const dps = (id: keyof typeof HEROES) => new GameSimulation(id, parseSave(null)).damage / HEROES[id].cooldown;
 expect(dps('archer')).toBeLessThan(dps('mage'));
 expect(dps('archer')).toBeLessThan(dps('warrior'));
});

it('gives the close-range warrior the strongest starting hit', () => {
 const damage = (id: keyof typeof HEROES) => new GameSimulation(id, parseSave(null)).damage;
 expect(damage('warrior')).toBeGreaterThan(damage('mage'));
 expect(damage('mage')).toBeGreaterThan(damage('archer'));
});

it.each([[1, false, 52], [5, true, 86]])('limits sword level %i to the advertised frontal cone', (weaponLevel, evolved, degrees) => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const p = sim.state.player;
 sim.state.weaponLevel = weaponLevel;
 sim.state.evolved = evolved;
 const front = sim.spawnEnemy('brute', p.x, p.y - 55)!;
 const rear = sim.spawnEnemy('brute', p.x, p.y + 62)!;
 const flank = sim.spawnEnemy('brute', p.x + 54, p.y - 86)!;
 for (const enemy of [front, rear, flank]) enemy.speed = 0;
 frames(sim, .15);
 expect(front.hp).toBeLessThan(front.maxHp);
 expect(front.y).toBeLessThan(p.y - 65);
 expect(rear.hp).toBe(rear.maxHp);
 if (weaponLevel === 1) expect(flank.hp).toBe(flank.maxHp);
 const slash = sim.state.effects.find(effect => effect.kind === 'slash');
 expect((slash?.halfAngle ?? 0) * 360 / Math.PI).toBeCloseTo(degrees);
});

it.each([
 ['warrior', 'lunge', 'lance'], ['warrior', 'quake', 'quake'], ['warrior', 'sunder', 'sunder'],
 ['archer', 'ricochet', 'ricochet'], ['archer', 'blastArrow', 'blast'], ['archer', 'deadeye', 'deadeye'],
 ['mage', 'gravity', 'gravity'], ['mage', 'prism', 'prism'], ['mage', 'runeCross', 'runeCross'],
] as const)('%s %s damages an enemy and emits its own effect', (hero, skill, effect) => {
 const sim = new GameSimulation(hero, parseSave(null), () => .5);
 const p = sim.state.player;
 const target = sim.spawnEnemy('brute', p.x, p.y - 42)!;
 target.hp = target.maxHp = 1000;
 sim.state.skills[skill] = 1;
 sim.state.timeStopRemaining = 1;
 sim.update(.05);
 if (skill === 'blastArrow') sim.update(.05);
 expect(target.hp).toBeLessThan(1000);
 expect(sim.state.effects.some(entry => entry.kind === effect)).toBe(true);
});

it('damages and slows the impact target and nearby enemies once', () => {
 const sim = new GameSimulation('archer', parseSave(null), () => .5);
 const { player } = sim.state;
 const target = sim.spawnEnemy('brute', player.x, player.y - 35)!;
 const nearby = sim.spawnEnemy('brute', player.x + 44, player.y - 35)!;
 const distant = sim.spawnEnemy('brute', player.x + 106, player.y - 35)!;
 sim.state.skills.blastArrow = 1;
 sim.state.timeStopRemaining = 1;
 sim.update(.05);
 expect(target.hp).toBeLessThan(target.maxHp);
 expect(nearby.hp).toBeCloseTo(target.hp);
 expect(distant.hp).toBe(distant.maxHp);
 expect(nearby.slowedUntil).toBeGreaterThan(sim.state.elapsed);
 expect(distant.slowedUntil).toBeUndefined();
});

it('parries an imminent shot without a melee target during basic attack recovery', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const { player } = sim.state;
 const target = sim.spawnEnemy('slime', player.x, player.y - 60)!;
 target.hp = 1;
 frames(sim, .15);
 expect(target.hp).toBeLessThanOrEqual(0);
 const arrow = { id: 901, x: player.x + 32, y: player.y, kind: 'enemy' as const, vx: -360, vy: 0, pierce: 1, damage: 25, radius: 4, life: 1, hit: new Set<number>() };
 const outgoing = { ...arrow, id:902, vx:360 };
 sim.state.projectiles.push(arrow, outgoing);
 sim.update(.05);
 expect(sim.state.projectiles).not.toContain(arrow);
 expect(sim.state.projectiles).toContain(outgoing);
 expect(outgoing.life).toBeGreaterThan(0);
 expect(player.hp).toBe(player.maxHp);
 expect(sim.state.effects.filter(effect => effect.kind === 'slash')).toHaveLength(2);
});

it('rank-four damage improves only the selected offensive skill', () => {
 const cast = (rank: number) => {
  const sim = new GameSimulation('mage', parseSave(null), () => .5);
  sim.state.skills.fire = rank;
  const target = sim.spawnEnemy('brute', 216, 450)!;
  target.hp = 10000;
  sim.update(.05);
  return { dealt: 10000 - target.hp, weaponDamage: sim.damage };
 };
 const base = cast(3), mastered = cast(4);
 expect(mastered.dealt).toBeGreaterThan(base.dealt);
 expect(mastered.weaponDamage).toBe(base.weaponDamage);
});

it.each(['warrior', 'archer', 'mage'] as const)('applies the same incoming and outgoing damage for %s', hero => {
 const sim = new GameSimulation(hero, parseSave(null), () => .5);
 for (const kind of ['brute', 'boss', 'briar', 'warden'] as const) {
  const target = sim.spawnEnemy(kind, 216, 150)!;
  sim.damageEnemy(target, 10);
  expect(target.maxHp - target.hp).toBe(10);
  if (kind === 'boss') {
   target.paired = true;
   sim.damageEnemy(target, 10);
   expect(target.maxHp - target.hp).toBe(20);
  }
 }
 const p = sim.state.player;
 const contact = sim.spawnEnemy('slime', p.x, p.y)!;
 const skeleton = sim.spawnEnemy('skeleton', p.x, p.y - 90)!;
 skeleton.timer = 0;
 const before = p.hp;
 sim.update(.025);
 expect(before - p.hp).toBeCloseTo(contact.damage);
 expect(sim.state.projectiles.find(shot => shot.kind === 'enemy')?.damage).toBe(skeleton.damage);
});

it('keeps single-target and area spells distinct with the same damage rules', () => {
 const cast = (skill: 'fire' | 'frost') => {
  const sim = new GameSimulation('mage', parseSave(null), () => .5);
  const targets = [
   sim.spawnEnemy('brute', 216, 441)!,
   sim.spawnEnemy('brute', 270, 441)!,
   sim.spawnEnemy('slime', 162, 441)!,
  ];
  sim.state.skills[skill] = 1;
  sim.update(.05);
  return targets.map(target => (target.maxHp - target.hp) / (sim.power * SKILLS[skill].damage));
 };
 const focused = cast('fire'), area = cast('frost');
 expect(focused[0]).toBeCloseTo(1);
 expect(focused.slice(1)).toEqual([0, 0]);
 for (const multiplier of area) expect(multiplier).toBeCloseTo(1);
});

it('retains the bow pierce with falloff on each subsequent target', () => {
 const sim = new GameSimulation('archer', parseSave(null), () => .5);
 sim.state.weaponLevel = 2;
 const front = sim.spawnEnemy('brute', 216, 460)!;
 const back = sim.spawnEnemy('brute', 216, 398)!;
 for (const enemy of [front, back]) enemy.speed = 0;
 frames(sim, .33);
 expect(front.maxHp - front.hp).toBeCloseTo(sim.damage);
 expect(back.maxHp - back.hp).toBeCloseTo(sim.damage * .94);
});
