import { describe, it, expect } from 'vitest';
import { GameSimulation } from '../src/game/simulation';
import { HEROES, SKILLS } from '../src/game/config';
import { parseSave } from '../src/game/save';
import { availableUpgrades } from '../src/game/progression';
const frames = (sim: GameSimulation, seconds: number) => { for (let i = 0; i < seconds * 30; i++) sim.update(1 / 30); };
describe('weapon and skill balance regressions', () => {
 it('keeps an aimed arrow at weapon level three instead of missing both sides of a small target', () => {
  const sim = new GameSimulation('archer', parseSave(null), () => .5); sim.state.weaponLevel = 3;
  const target = sim.spawnEnemy('slime', 216, 274)!; target.hp = target.maxHp = 1000; target.speed = 0;
  frames(sim, 1); expect(target.hp).toBeLessThan(1000);
 });
 it('fires one narrow arrow through a line without hitting the flank', () => {
  const sim = new GameSimulation('archer', parseSave(null), () => .5);
  sim.state.weaponLevel = 5;
  sim.state.timeStopRemaining = 2;
  const line = [440, 380, 320, 260].map(y => sim.spawnEnemy('brute', 216, y)!);
  const flank = sim.spawnEnemy('slime', 234, 360)!;
  frames(sim, .15);
  expect(sim.state.projectiles).toHaveLength(1);
  expect(sim.state.projectiles[0].radius).toBe(4);
  frames(sim, .61);
  expect(line.every(enemy => enemy.hp < enemy.maxHp)).toBe(true);
  expect(flank.hp).toBe(flank.maxHp);
 });
 it('starts the bow farther away than either other weapon and keeps opening slime hits below lethal', () => {
  expect(HEROES.archer.range).toBe(410);
  expect(HEROES.mage.range).toBe(280);
  expect(HEROES.warrior.range).toBe(98);
  expect(HEROES.warrior.speed).toBe(168);
  for (const [hero, hp] of [['warrior', 285], ['archer', 235], ['mage', 190]] as const) {
   const sim = new GameSimulation(hero, parseSave(null), () => .5);
   const slime = sim.spawnEnemy('slime', 216, 455)!;
   expect(sim.state.player.maxHp).toBe(hp);
   expect(sim.damage).toBeLessThan(slime.hp);
   expect(sim.damage * 2).toBeGreaterThanOrEqual(slime.hp);
  }
 });
 it('increases expedition movement speed by 18% of base per pick, up to three picks', () => {
  const sim = new GameSimulation('archer', parseSave(null), () => .5);
  for (let level = 0; level < 3; level++) {
   const speed = availableUpgrades(sim.state).find(upgrade => upgrade.id === 'passive:speed')!;
   expect(speed.max).toBe(3);
   expect(speed.description).toContain('+18%');
   sim.state.status = 'upgrade';
   sim.state.choices = [speed];
   expect(sim.chooseUpgrade(speed.id)).toBe(true);
   expect(sim.state.player.speed).toBeCloseTo(HEROES.archer.speed * (1 + .18 * (level + 1)));
  }
  expect(availableUpgrades(sim.state).some(upgrade => upgrade.id === 'passive:speed')).toBe(false);
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
  // The level-two aura overlaps this slime's collision radius.
  expect(run(2)).toBeLessThan(run(0));
 });
 it('slows regular enemies and middle bosses without damaging them', () => {
  const cast = (frost: number) => {
   const sim = new GameSimulation('mage', parseSave(null), () => .5);
   sim.state.skills.frost = frost;
   const p = sim.state.player;
   const briar = sim.spawnEnemy('briar', p.x, p.y - 145)!;
   const warden = sim.spawnEnemy('warden', p.x + 30, p.y - 90)!;
   const slime = sim.spawnEnemy('slime', p.x, p.y - 140)!;
   const startingY = [briar.y, warden.y, slime.y];
   sim.update(.05);
   return {
    moved: [briar, warden, slime].map((enemy, index) => enemy.y - startingY[index]),
    slimeDamage: slime.maxHp - slime.hp,
   };
  };
  const normal = cast(0), frost = cast(4);
  expect(frost.moved[0]).toBeCloseTo(normal.moved[0] * .65);
  expect(frost.moved[1]).toBeCloseTo(normal.moved[1]);
  expect(frost.moved[2] - .14).toBeCloseTo((normal.moved[2] - .14) * .3);
  expect(frost.slimeDamage).toBe(0);
 });
 it('applies and removes the aura slow as the player moves into and out of range', () => {
  const sim = new GameSimulation('mage', parseSave(null), () => .5);
  const { player, skills } = sim.state;
  skills.frost = 1;
  const mob = sim.spawnEnemy('slime', player.x, player.y - 150)!;
  mob.speed = 100;
  for (const [y, multiplier] of [[515, 1], [475, .6], [515, 1]]) {
   player.y = y;
   const before = mob.y;
   sim.update(.025);
   expect(mob.y - before).toBeCloseTo((100 * multiplier + 2.8) * .025);
  }
 });
 it('adds no timed hit damage over multiple former pulse intervals', () => {
  const damage = (rank: number) => {
   const sim = new GameSimulation('mage', parseSave(null), () => .5);
   sim.state.skills.frost = rank;
   sim.state.timeStopRemaining = 15;
   const target = sim.spawnEnemy('brute', 216, 395)!;
   target.hp = target.maxHp = 10000;
   frames(sim, 14);
   return target.maxHp - target.hp;
  };
  expect(damage(4)).toBe(damage(0));
 });
 it('applies half of mastered frost slow to a middle boss during its dash', () => {
  const sim = new GameSimulation('mage', parseSave(null), () => .5);
  sim.state.skills.frost = 4;
  const { player } = sim.state;
  const boss = sim.spawnEnemy('boss', player.x, player.y - 140)!;
  const y = boss.y;
  boss.phase = 'dash'; boss.timer = .5;
  sim.update(.05);
  expect(boss.y - y).toBeCloseTo(265 * .65 * .05);
  expect(boss.timer).toBeCloseTo(.45);
 });
 it('tracks three screen-wide meteor impacts at half-second intervals and leaves off-screen enemies alone', () => {
  const sim = new GameSimulation('mage', parseSave(null), () => .5);
  const { skills } = sim.state;
  skills.meteor = 1;
  const impacts: number[] = [];
  sim.onSound = sound => { if (sound === 'meteorImpact') impacts.push(sim.state.meteorShower!.elapsed); };
  sim.state.timeStopRemaining = 3;
  const left = sim.spawnEnemy('brute', 30, 100)!;
  const right = sim.spawnEnemy('brute', 400, 100)!;
  const outside = sim.spawnEnemy('brute', -50, 110)!;
  for (const enemy of [left, right, outside]) enemy.hp = enemy.maxHp = 1000;
  sim.update(.05);
  expect(left.hp).toBe(1000);
  sim.pause();
  frames(sim, .5);
  sim.resume();
  for (let wave = 1; wave <= 3; wave++) {
   for (let frame = 0; frame < 9; frame++) sim.update(.05);
   expect(left.hp).toBeCloseTo(1000 - (wave - 1) * 7.4);
   sim.update(.05);
   expect(left.hp).toBeCloseTo(1000 - wave * 7.4);
   expect(right.hp).toBeCloseTo(left.hp);
   expect(outside.hp).toBe(1000);
  }
  frames(sim, .55);
  expect(left.hp).toBeCloseTo(977.8);
  expect(impacts.map(time => Number(time.toFixed(2)))).toEqual([.5, 1, 1.5]);
  expect(sim.state.meteorShower).toBeUndefined();
 });
 it('keeps cross rune shaped like a cross with a nine-second base interval', () => {
  const sim = new GameSimulation('mage', parseSave(null), () => .5);
  sim.state.skills.runeCross = 1;
  sim.state.timeStopRemaining = 12;
  const center = sim.spawnEnemy('brute', 216, 180)!;
  const arm = sim.spawnEnemy('brute', 295, 180)!;
  const diagonal = sim.spawnEnemy('brute', 295, 112)!;
  for (const enemy of [center, arm, diagonal]) enemy.hp = enemy.maxHp = 1000;
  sim.update(.05);
  expect(center.maxHp - center.hp).toBeCloseTo(59.2);
  expect(arm.hp).toBeCloseTo(center.hp);
  expect(diagonal.hp).toBe(1000);
  frames(sim, 8.8);
  expect(center.hp).toBeCloseTo(940.8);
  frames(sim, .25);
  expect(center.hp).toBeCloseTo(881.6);
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
 it('casts focused lightning for 66.6 damage on the nearest target within 360', () => {
  const sim = new GameSimulation('mage', parseSave(null), () => .5);
  const { player, skills } = sim.state;
  skills.chain = 1;
  sim.state.timeStopRemaining = 1;
  const target = sim.spawnEnemy('brute', player.x, player.y - 359)!;
  const outside = sim.spawnEnemy('brute', player.x, player.y - 361)!;
  target.hp = outside.hp = 1000;
  sim.update(.05);
  expect(target.hp).toBeCloseTo(933.4);
  expect(outside.hp).toBe(1000);
  const next = new GameSimulation('mage', parseSave(null), () => .5);
  next.state.skills.chain = 1;
  next.state.timeStopRemaining = 1;
  const lone = next.spawnEnemy('brute', player.x, player.y - 361)!;
  lone.hp = 1000;
  next.update(.05);
  expect(lone.hp).toBe(1000);
 });
 it('uses fire mark on the nearest elite within 350 before nearby regular targets', () => {
  const sim = new GameSimulation('mage', parseSave(null), () => .5);
  const { player, skills } = sim.state;
  skills.fire = 1;
  sim.state.timeStopRemaining = 1;
  const mob = sim.spawnEnemy('brute', player.x, player.y - 100)!;
  const elite = sim.spawnEnemy('brute', player.x, player.y - 290)!;
  const fartherElite = sim.spawnEnemy('brute', player.x, player.y - 315)!;
  const outside = sim.spawnEnemy('brute', player.x, player.y - 351)!;
  for (const enemy of [mob, elite, fartherElite, outside]) enemy.hp = enemy.maxHp = 1000;
  elite.elite = fartherElite.elite = outside.elite = true;
  sim.update(.05);
  expect(elite.hp).toBeCloseTo(881.6);
  expect([mob.hp, fartherElite.hp, outside.hp]).toEqual([1000, 1000, 1000]);
 });
 it.each([[1, 80], [2, 110], [3, 140], [4, 165]])('grows gravity well at rank %i around the farthest eligible regular target', (rank, radius) => {
  const sim = new GameSimulation('mage', parseSave(null), () => .5);
  const { player, skills } = sim.state;
  skills.gravity = rank;
  sim.state.timeStopRemaining = 1;
  const close = sim.spawnEnemy('brute', player.x, player.y - 120)!;
  const far = sim.spawnEnemy('brute', player.x, player.y - 255)!;
  const fartherBoss = sim.spawnEnemy('boss', player.x, player.y - 320)!;
  const outside = sim.spawnEnemy('brute', player.x, player.y - 351)!;
  for (const enemy of [close, far, fartherBoss, outside]) enemy.hp = enemy.maxHp = 1000;
  sim.update(.05);
  const hitbox = sim.state.effects.find(effect => effect.kind === 'gravity');
  expect(hitbox).toMatchObject({x: far.x, y: far.y, radius});
  if (rank === 1) expect(far.hp).toBeCloseTo(988.9);
 });
 it('pulls an approaching enemy away, leaves a middle boss in place, and protects enemies on the near side from being pulled inward', () => {
  const sim = new GameSimulation('mage', parseSave(null), () => .5);
  const { player, skills } = sim.state;
  skills.gravity = 4;
  const anchor = sim.spawnEnemy('brute', player.x, player.y - 155)!;
  const approach = sim.spawnEnemy('brute', player.x, player.y - 95)!;
  const behind = sim.spawnEnemy('brute', player.x, player.y + 25)!;
  const boss = sim.spawnEnemy('boss', player.x + 40, player.y - 160)!;
  for (const enemy of [anchor, approach, behind, boss]) { enemy.speed = 0; enemy.hp = enemy.maxHp = 1000; }
  const [a, b, c] = [approach.y, behind.y, boss.y];
  sim.update(.05);
  expect(approach.y).toBeLessThan(a - 20);
  expect(behind.y).toBeCloseTo(b + .14);
  expect(boss.y).toBe(c);
  expect(boss.hp).toBeLessThan(1000);
 });
});

it('higher shield ranks improve recharge without stockpiling three fully blocked hits', () => {
 const sim = new GameSimulation('warrior', parseSave(null)); sim.state.skills.shield = 3; sim.update(.05);
 expect(sim.state.player.shield).toBe(1);
});

it.each([[1, 40], [2, 30], [3, 20]])('starts the rank %i shield recharge after a hit is blocked', (rank, cooldown) => {
 const sim = new GameSimulation('warrior', parseSave(null));
 const { player, skills, effects } = sim.state;
 skills.shield = rank;
 sim.state.timeStopRemaining = 60;
 sim.update(.05);
 expect(effects.some(effect => effect.kind === 'shieldRaise')).toBe(true);
 frames(sim, 5);
 sim.damagePlayer(30);
 expect(player.shield).toBe(0);
 expect(player.hp).toBe(player.maxHp);
 expect(sim.state.effects.some(effect => effect.kind === 'shieldBreak')).toBe(true);
 frames(sim, cooldown - .1);
 expect(player.shield).toBe(0);
 frames(sim, .2);
 expect(player.shield).toBe(1);
});

it('keeps skill recharge independent of weapon haste bonuses', () => {
 const recharge = (level: number) => { const sim = new GameSimulation('warrior', parseSave(null)); sim.state.skills.shield = 1; sim.state.weaponLevel = level; sim.state.timeStopRemaining = 60; sim.update(.05); sim.damagePlayer(1); let time = 0; while (sim.state.player.shield === 0 && time < 42) { sim.update(.05); time += .05; } return time; };
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

it.each([[1, false, 50], [5, false, 66], [5, true, 72]])('limits sword level %i to the advertised frontal cone', (weaponLevel, evolved, degrees) => {
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

it.each([[1, false, 1], [3, false, 2], [5, false, 3], [5, true, 4]])('parries more shots at sword level %i', (weaponLevel, evolved, count) => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const { player, projectiles } = sim.state;
 sim.state.weaponLevel = weaponLevel;
 sim.state.evolved = evolved;
 for (let i = 0; i < 5; i++) {
  projectiles.push({ id: 900 + i, x: player.x, y: player.y - 60 + i, kind: 'enemy',
   vx: 0, vy: 50, pierce: 1, damage: 25, radius: 4, life: 1, hit: new Set() });
 }
 frames(sim, .15);
 expect(sim.state.projectiles.filter(shot => shot.kind === 'enemy')).toHaveLength(5 - count);
});

it('aims dawn thrust at the highest remaining health within its reach', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const { player } = sim.state;
 sim.state.skills.lunge = 1;
 sim.state.timeStopRemaining = 1;
 const nearby = sim.spawnEnemy('slime', player.x + 48, player.y)!;
 const boss = sim.spawnEnemy('boss', player.x, player.y - 200)!;
 const injured = sim.spawnEnemy('warden', player.x + 135, player.y + 20)!;
 injured.hp = 10;
 const outOfRange = sim.spawnEnemy('warden', player.x, player.y - 240)!;
 sim.update(.05);
 expect(boss.hp).toBeLessThan(boss.maxHp);
 expect(nearby.hp).toBe(nearby.maxHp);
 expect(injured.hp).toBe(10);
 expect(outOfRange.hp).toBe(outOfRange.maxHp);
});

it('makes whirlwind a stronger close frontal attack and keeps enemies outside its narrowed arc safe', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const { player } = sim.state;
 sim.state.skills.whirl = 1;
 const center = sim.spawnEnemy('brute', player.x, player.y - 50)!;
 const flank = sim.spawnEnemy('brute', player.x + 73, player.y - 45)!;
 sim.update(.05);
 expect(center.maxHp - center.hp).toBeCloseTo(16.64);
 expect(flank.hp).toBe(flank.maxHp);
});

it('limits a level-one sword wave to four hits, with damage falling off per target', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const { player } = sim.state;
 sim.state.skills.blade = 1;
 sim.state.timeStopRemaining = 1;
 const line = [120, 175, 230, 285, 340].map(distance => sim.spawnEnemy('brute', player.x, player.y - distance)!);
 frames(sim, 1);
 const damage = line.map(enemy => enemy.maxHp - enemy.hp);
 expect(damage[0]).toBeCloseTo(10.14);
 for (let i = 1; i < 4; i++) expect(damage[i]).toBeCloseTo(damage[i - 1] * .9);
 expect(damage[4]).toBe(0);
});

it('shoves an ordinary enemy hundreds of units without pushing bosses', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const { player } = sim.state;
 sim.state.skills.bash = 1;
 const mob = sim.spawnEnemy('brute', player.x, player.y - 50)!;
 const boss = sim.spawnEnemy('boss', player.x + 12, player.y - 76)!;
 mob.speed = boss.speed = 0;
 const before = mob.y, bossY = boss.y;
 sim.update(.05);
 expect(before - mob.y).toBeGreaterThan(295);
 expect(boss.y).toBe(bossY);
 expect(sim.state.effects.some(effect => effect.kind === 'bashImpact')).toBe(true);
});

it('adds an outer quake hit that slows regular enemies without slowing a boss', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const { player } = sim.state;
 sim.state.skills.quake = 1;
 const mob = sim.spawnEnemy('brute', player.x, player.y - 137)!;
 const boss = sim.spawnEnemy('boss', player.x + 5, player.y - 140)!;
 mob.speed = boss.speed = 0;
 sim.update(.05);
 expect(mob.hp).toBeLessThan(mob.maxHp);
 expect(mob.slowedUntil).toBeCloseTo(sim.state.elapsed + 1.6);
 expect(boss.hp).toBeLessThan(boss.maxHp);
 expect(boss.slowedUntil).toBeUndefined();
});

it.each([
 ['warrior', 'lunge', 'lance'], ['warrior', 'quake', 'quake'], ['warrior', 'sunder', 'sunder'],
 ['archer', 'ricochet', 'ricochet'], ['archer', 'blastArrow', 'blast'], ['archer', 'deadeye', 'deadeye'],
 ['mage', 'gravity', 'gravity'], ['mage', 'prism', 'prism'], ['mage', 'runeCross', 'runeCross'],
] as const)('%s %s damages an enemy and emits its own effect', (hero, skill, effect) => {
 const sim = new GameSimulation(hero, parseSave(null), () => .5);
 const p = sim.state.player;
 const target = sim.spawnEnemy('brute', p.x, p.y - (skill === 'gravity' ? 190 : 42))!;
 target.hp = target.maxHp = 1000;
 sim.state.skills[skill] = 1;
 sim.state.timeStopRemaining = 1;
 sim.update(.05);
 if (skill === 'blastArrow') sim.update(.05);
 expect(target.hp).toBeLessThan(1000);
 expect(sim.state.effects.some(entry => entry.kind === effect)).toBe(true);
});

it('ignites the impact area with much lower initial damage and six burn ticks without slowing', () => {
 const sim = new GameSimulation('archer', parseSave(null), () => .5);
 const { player } = sim.state;
 const target = sim.spawnEnemy('brute', player.x, player.y - 35)!;
 const nearby = sim.spawnEnemy('brute', player.x + 44, player.y - 35)!;
 const distant = sim.spawnEnemy('brute', player.x + 106, player.y - 35)!;
 for (const enemy of [target, nearby, distant]) enemy.hp = enemy.maxHp = 1000;
 sim.state.skills.blastArrow = 1;
 sim.state.timeStopRemaining = 4;
 sim.update(.05);
 expect(target.maxHp - target.hp).toBeCloseTo(9.6);
 expect(nearby.hp).toBeCloseTo(target.hp);
 const impactHp = nearby.hp;
 frames(sim, .5);
 distant.x = player.x + 44;
 frames(sim, .5);
 expect(distant.maxHp - distant.hp).toBeCloseTo(2.88);
 distant.x = player.x + 106;
 frames(sim, 2);
 expect(impactHp - nearby.hp).toBeCloseTo(2.88 * 6);
 expect(distant.maxHp - distant.hp).toBeCloseTo(2.88);
 expect(sim.state.groundFields).toHaveLength(0);
 expect(nearby.slowedUntil).toBeUndefined();
 expect(distant.slowedUntil).toBeUndefined();
});

it('fires a narrow heavy piercing shot that hits more than six aligned enemies at rank one', () => {
 const sim = new GameSimulation('archer', parseSave(null), () => .5);
 const { player } = sim.state;
 player.y = 710;
 sim.state.skills.pierce = 1;
 sim.state.timeStopRemaining = 2;
 const line = Array.from({length: 9}, (_, index) => sim.spawnEnemy('slime', player.x, player.y - 425 - index * 28)!);
 const flank = sim.spawnEnemy('slime', player.x + 20, player.y - 455)!;
 for (const mob of [...line, flank]) mob.hp = mob.maxHp = 1000;
 frames(sim, 1.5);
 expect(line.map(mob => mob.hp)).toEqual(Array(9).fill(955));
 expect(flank.hp).toBe(1000);
});

it.each([[1,3], [2,4], [3,5], [4,6]])('gives lightning arrow rank %i its own chain limit and 10% falloff', (rank, hits) => {
 const sim = new GameSimulation('archer', parseSave(null), () => .5);
 const { player } = sim.state;
 sim.state.skills.ricochet = rank;
 sim.state.timeStopRemaining = 2;
 const line = Array.from({length: 7}, (_, index) => sim.spawnEnemy('slime', player.x, player.y - 50 - index * 45)!);
 for (const mob of line) mob.hp = mob.maxHp = 1000;
 sim.update(.05);
 const damage = line.map(mob => mob.maxHp - mob.hp);
 expect(damage.filter(value => value > 0)).toHaveLength(hits);
 for (let i = 1; i < hits; i++) expect(damage[i]).toBeCloseTo(damage[i - 1] * .9);
});

it('creates a ground trap on projectile impact and slows a regular enemy entering it later', () => {
 const sim = new GameSimulation('archer', parseSave(null), () => .5);
 const { player } = sim.state;
 sim.state.skills.snare = 1;
 const target = sim.spawnEnemy('brute', player.x, player.y - 140)!;
 target.speed = 0;
 sim.update(.05);
 expect(target.hp).toBe(target.maxHp);
 expect(sim.state.groundFields).toHaveLength(0);
 frames(sim, .25);
 const trap = sim.state.groundFields.find(field => field.kind === 'snare')!;
 expect(trap).toBeDefined();
 const y = trap.groundY + sim.state.scroll;
 const entrant = sim.spawnEnemy('slime', trap.x, y)!;
 const boss = sim.spawnEnemy('boss', trap.x, y)!;
 entrant.speed = boss.speed = 100;
 const start = sim.state.scroll;
 sim.update(.05);
 expect(entrant.y - y).toBeCloseTo((100 * .52 + 2.8) * .05);
 expect(boss.y - y).toBeCloseTo(100 * .05);
 expect(trap.groundY + sim.state.scroll - y).toBeCloseTo(sim.state.scroll - start);
});

it.each([['snare', 'snare'], ['blastArrow', 'burn']] as const)('holds a mastered %s field for five seconds', (skill, kind) => {
 const sim = new GameSimulation('archer', parseSave(null), () => .5);
 const { player, skills } = sim.state;
 const target = sim.spawnEnemy('brute', player.x, player.y - 32)!;
 target.speed = 0;
 target.hp = target.maxHp = 1000;
 skills[skill] = 4;
 sim.update(.05);
 const field = sim.state.groundFields.find(entry => entry.kind === kind)!;
 expect(field.remaining).toBe(5);
 if (field.kind === 'snare') expect(field.slow).toBe(.8);
 delete skills[skill];
 frames(sim, 4.9);
 expect(sim.state.groundFields).toContain(field);
 frames(sim, .15);
 expect(sim.state.groundFields).not.toContain(field);
});

it('uses the strongest overlapping trap once, including the mastered 80% slow', () => {
 const sim = new GameSimulation('archer', parseSave(null), () => .5);
 const { player, groundFields } = sim.state;
 const mob = sim.spawnEnemy('brute', player.x, player.y - 150)!;
 mob.speed = 100;
 const y = mob.y;
 const field = { kind: 'snare' as const, x: mob.x, groundY: y, radius: 65, remaining: 5 };
 groundFields.push({...field, slow: .48}, {...field, slow: .8});
 sim.update(.05);
 expect(mob.y - y).toBeCloseTo((100 * .2 + 2.8) * .05);
});

it('deals one burn tick per half second in overlapping fields with different strengths and start times', () => {
 const sim = new GameSimulation('archer', parseSave(null), () => .5);
 const { player } = sim.state;
 const enemy = sim.spawnEnemy('brute', player.x, player.y - 440)!;
 enemy.hp = enemy.maxHp = 1000;
 sim.state.timeStopRemaining = 3;
 const area = { kind: 'burn' as const, x: enemy.x, groundY: enemy.y, radius: 65 };
 sim.state.groundFields.push({...area, damage: 2, remaining: 1});
 frames(sim, .25);
 sim.state.groundFields.push({...area, damage: 7, remaining: .75});
 frames(sim, .25);
 expect(enemy.hp).toBe(993);
 frames(sim, .25);
 expect(enemy.hp).toBe(993);
 frames(sim, .25);
 expect(enemy.hp).toBe(986);
});

it.each(['boss', 'elite', 'regular'] as const)('prioritizes %s for deadeye and breaks ties by remaining health', priority => {
 const sim = new GameSimulation('archer', parseSave(null), () => .5);
 const { player } = sim.state;
 sim.state.skills.deadeye = 1;
 sim.state.timeStopRemaining = 2;
 const far = sim.spawnEnemy('brute', player.x, player.y - 300)!;
 const chosen = sim.spawnEnemy(priority === 'boss' ? 'boss' : 'brute', player.x, player.y - 90)!;
 const weak = sim.spawnEnemy(priority === 'boss' ? 'briar' : 'brute', player.x, player.y - 200)!;
 const outOfRange = sim.spawnEnemy('warden', player.x, player.y - 460)!;
 chosen.hp = priority === 'regular' ? 200 : 120;
 far.hp = priority === 'regular' ? 110 : 400;
 weak.hp = 100;
 if (priority !== 'regular') weak.elite = chosen.elite = true;
 if (priority === 'boss') far.elite = true;
 sim.update(.05);
 expect(chosen.hp).toBe((priority === 'regular' ? 200 : 120) - 90);
 expect(far.hp).toBe(priority === 'regular' ? 110 : 400);
 expect(weak.hp).toBe(100);
 expect(outOfRange.hp).toBe(outOfRange.maxHp);
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
 const cast = (skill: 'fire' | 'runeCross') => {
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
 const focused = cast('fire'), area = cast('runeCross');
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
  frames(sim, .4);
  expect(front.maxHp - front.hp).toBeCloseTo(sim.damage);
  expect(back.maxHp - back.hp).toBeCloseTo(sim.damage * .94);
 });

 it('scales blastArrow to 70% radius and limits maxed haste builds to at most 2 overlapping burn fields', () => {
  expect(SKILLS.blastArrow.radius).toBe(52);
  expect(SKILLS.blastArrow.radiusPerLevel).toBe(29);
  const sim = new GameSimulation('archer', parseSave(null), () => .5);
  sim.state.skills.blastArrow = 4;
  sim.state.passives.haste = 5;
  sim.state.timeStopRemaining = 20;
  let maxFields = 0;
  for (let step = 0; step < 300; step++) {
   const target = sim.spawnEnemy('brute', 216, 420)!;
   target.hp = target.maxHp = 10000;
   sim.update(.05);
   maxFields = Math.max(maxFields, sim.state.groundFields.filter(f => f.kind === 'burn').length);
   sim.state.enemies = [];
  }
  expect(maxFields).toBeLessThanOrEqual(2);
 });

 it('tags skeleton shots with the enemy-arrow sprite while keeping enemy projectile collisions', () => {
  const sim = new GameSimulation('warrior', parseSave(null), () => .5);
  const { player } = sim.state;
  const skeleton = sim.spawnEnemy('skeleton', player.x, player.y - 120)!;
  skeleton.timer = 0;
  sim.update(.025);
  const arrow = sim.state.projectiles.find(shot => shot.kind === 'enemy');
  expect(arrow?.sprite).toBe('enemy-arrow');
 });

 it('heals a fixed +120 HP from vitality without raising maxHp', () => {
  const sim = new GameSimulation('mage', parseSave(null), () => .5);
  const baseMax = sim.state.player.maxHp;
  sim.state.player.hp = 40;
  sim.state.status = 'upgrade';
  sim.state.choices = [{ id: 'passive:vitality', name: '생명의 뿌리', subtitle: '', description: '', icon: 'heart', level: 0, max: 5, color: '#c7c2a0' }];
  expect(sim.chooseUpgrade('passive:vitality')).toBe(true);
  expect(sim.state.player.maxHp).toBe(baseMax);
  expect(sim.state.player.hp).toBe(160);
 });
