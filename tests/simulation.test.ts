import { describe, it, expect } from 'vitest';
import { HEROES, SKILLS, skillRankLimit } from '../src/game/config';
import { GameSimulation } from '../src/game/simulation';
import { parseSave } from '../src/game/save';
import { directionFromDrag } from '../src/game/math';
const tick = (sim: GameSimulation, seconds: number, direction = { x: 0, y: 0 }) => { for (let t = 0; t < seconds; t += .05) { if (sim.state.status === 'upgrade') sim.chooseUpgrade(sim.state.choices[0].id); sim.update(.05, direction); } };
describe('movement and scroll', () => {
 it('uses a deadzone, analog strength and normalized diagonal speed', () => {
  expect(directionFromDrag(3, 2)).toEqual({ x: 0, y: 0 });
  const d = directionFromDrag(100, 100); expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
  expect(directionFromDrag(25, 0).x).toBeGreaterThan(0); expect(directionFromDrag(25, 0).x).toBeLessThan(1);
 });
 it('scrolls identically when standing still, going up, or going down', () => {
  const a = new GameSimulation('warrior', parseSave(null), () => .5); const b = new GameSimulation('warrior', parseSave(null), () => .5); const c = new GameSimulation('warrior', parseSave(null), () => .5);
  tick(a, 1); tick(b, 1, { x: 0, y: -1 }); tick(c, 1, { x: 0, y: 1 });
  expect(a.state.scroll).toBeGreaterThan(0); expect(a.state.scroll).toBe(b.state.scroll); expect(b.state.scroll).toBe(c.state.scroll); expect(b.state.player.y).toBeLessThan(a.state.player.y);
 });
 it('clamps movement and freezes the entire world when paused', () => {
  const sim = new GameSimulation('archer', parseSave(null)); tick(sim, 3, { x: -1, y: -1 }); expect(sim.state.player.x).toBeGreaterThanOrEqual(22); expect(sim.state.player.y).toBeGreaterThanOrEqual(104);
  sim.pause(); const before = JSON.stringify(sim.state); sim.update(1, { x: 1, y: 1 }); expect(JSON.stringify(sim.state)).toBe(before);
 });
});
describe('combat and run lifecycle', () => {
 for (const hero of ['warrior', 'archer', 'mage'] as const) {
  it(`${hero} automatically attacks and earns XP/gold`, () => {
   const sim = new GameSimulation(hero, parseSave(null), () => .5); sim.spawnEnemy('slime', 216, 470); sim.spawnEnemy('slime', 229, 465); tick(sim, 4); expect(sim.state.kills).toBeGreaterThan(0); expect(sim.state.gold).toBeGreaterThan(0); expect(sim.state.xp).toBeGreaterThan(0);
  });
 }
 it('pauses for a level choice, rejects forged choices, and resumes after applying it', () => {
  const sim = new GameSimulation('mage', parseSave(null)); sim.gainXp(100); expect(sim.state.status).toBe('upgrade'); expect(sim.chooseUpgrade('skill:shield')).toBe(false);
  const before = sim.state.choices[0]; expect(sim.chooseUpgrade(before.id)).toBe(true); expect(sim.state.status).toBe('upgrade');
  while (sim.state.status === 'upgrade') sim.chooseUpgrade(sim.state.choices[0].id);
  expect(sim.state.status).toBe('running'); expect(sim.state.level).toBeGreaterThan(2);
 });
 it('offers three repeatable rewards after normal upgrades are capped', () => {
  const sim = new GameSimulation('warrior', parseSave(null)); sim.state.weaponLevel = 5; sim.state.evolved = true; sim.state.skills = Object.fromEntries(HEROES.warrior.skills.map(id => [id, skillRankLimit(SKILLS[id])])); sim.state.passives = { power: 5, haste: 5, vitality: 5, speed: 5 };
  sim.state.player.hp -= 20;
  const player = { ...sim.state.player };
  for (const reward of ['reserve:gold', 'reserve:hp', 'reserve:speed']) {
   sim.gainXp(sim.state.xpNext);
   expect(sim.state.choices).toHaveLength(3);
   expect(sim.chooseUpgrade(reward)).toBe(true);
   expect(sim.state.status).toBe('running');
  }
  expect(sim.state.gold).toBeGreaterThan(0);
  expect(sim.state.player.maxHp).toBeGreaterThan(player.maxHp);
  expect(sim.state.player.speed).toBeGreaterThan(player.speed);
  expect(sim.state.player.hp).toBe(player.hp);
 });
 it('spawns a boss at 2 minutes without stopping the scroll, stays bounded over a long run', () => {
  const sim = new GameSimulation('warrior', parseSave(null), () => .4); sim.state.player.hp = sim.state.player.maxHp = 100000;
  tick(sim, 121); expect(sim.state.enemies.some(e => e.kind === 'boss')).toBe(true); const scroll = sim.state.scroll; tick(sim, 20); expect(sim.state.scroll).toBeGreaterThan(scroll); expect(sim.state.enemies.length).toBeLessThanOrEqual(100); expect(sim.state.projectiles.length).toBeLessThanOrEqual(180); expect(sim.state.effects.length).toBeLessThanOrEqual(60);
 });
 it('applies permanent stats to all heroes and damage invulnerability', () => {
  const save = parseSave(null); save.upgrades = { attack: 2, hp: 2, speed: 2, gold: 2, timeStop: 0 };
  const sim = new GameSimulation('warrior', save); expect(sim.state.player.maxHp).toBe(Math.round(HEROES.warrior.hp * 1.12)); const hp = sim.state.player.hp; sim.damagePlayer(10); sim.damagePlayer(10); expect(sim.state.player.hp).toBe(hp - 10);
 });
 it('ends on zero HP and retry creates clean state', () => {
  const sim = new GameSimulation('mage', parseSave(null)); sim.damagePlayer(10000); expect(sim.state.status).toBe('gameover'); expect(sim.result().hero).toBe('mage');
  const next = new GameSimulation('mage', parseSave(null)); expect(next.state.elapsed).toBe(0); expect(next.state.enemies).toHaveLength(0); expect(next.state.player.hp).toBe(next.state.player.maxHp);
 });
});

describe('skills, bosses and bounded encounters', () => {
 for (const [hero, skills] of [ ['warrior', ['whirl', 'blade', 'shield', 'bash']], ['archer', ['multishot', 'pierce', 'rain', 'snare']], ['mage', ['chain', 'fire', 'frost', 'meteor']] ] as const) {
  for (const id of skills) it(`${hero} casts ${id} automatically`, () => {
   const sim = new GameSimulation(hero, parseSave(null), () => .5); sim.state.skills[id] = 3;
   const enemy = sim.spawnEnemy('slime', 216, 450)!; enemy.hp = enemy.maxHp = 1000;
   const before = enemy.hp; sim.update(.05); // The basic weapon is still on its initial cooldown.
   if (id === 'shield') expect(sim.state.player.shield).toBe(1);
   else if (id === 'blade') expect(sim.state.projectiles.filter(p => p.kind === 'blade')).toHaveLength(3);
   else if (id === 'multishot') expect(sim.state.projectiles.filter(p => p.kind === 'arrow')).toHaveLength(7);
   else if (id === 'pierce') { expect(sim.state.projectiles).toHaveLength(1); expect(sim.state.projectiles[0].pierce).toBeGreaterThan(3); }
   else if (id === 'rain') { expect(sim.state.hazards).toHaveLength(1); expect(sim.state.hazards[0].kind).toBe('rain'); }
   else expect(enemy.hp).toBeLessThan(before);
  });
 }
 it.each([[1, 102], [2, 118], [3, 134], [4, 134]])('limits rank %i arrow rain to one third of its former radius', (rank, oldRadius) => {
  const sim = new GameSimulation('archer', parseSave(null), () => .5);
  sim.state.timeStopRemaining = 1;
  sim.state.skills.rain = rank;
  const center = sim.spawnEnemy('slime', 216, 450)!;
  const nearby = sim.spawnEnemy('slime', 241, 450)!;
  const outside = sim.spawnEnemy('slime', 280, 450)!;
  for (const enemy of [center, nearby, outside]) enemy.hp = enemy.maxHp = 1000;
  sim.update(.05);
  const rain = sim.state.hazards.find(hazard => hazard.kind === 'rain')!;
  expect(rain.radius).toBeCloseTo(oldRadius / 3);
  expect(rain.x).toBe(center.x);
  tick(sim, .7);
  expect(nearby.hp).toBeLessThan(nearby.maxHp);
  expect(outside.hp).toBe(outside.maxHp);
 });
 it('boss telegraphs a dash, stays on screen and awards a kill without ending the run', () => {
  const sim = new GameSimulation('warrior', parseSave(null)); const boss = sim.spawnEnemy('boss', 216, 160)!;
  tick(sim, 3.1); expect(boss.phase).toBe('warn'); tick(sim, 1.2); expect(boss.phase).toBe('dash');
  tick(sim, 1); expect(boss.y).toBeLessThan(768); expect(sim.state.scroll).toBeGreaterThan(0);
  sim.damageEnemy(boss, 1e6); expect(sim.state.bosses).toBe(1); expect(sim.state.pickups).toContainEqual(expect.objectContaining({kind:'chest',gold:120})); expect(sim.state.status).not.toBe('gameover');
 });
 it('reserves room for a scheduled boss even when normal enemies fill the cap', () => {
  const sim = new GameSimulation('warrior', parseSave(null));
  for (let i = 0; i < 100; i++) sim.spawnEnemy('slime', 20, 20);
  sim.state.elapsed = 179.99; sim.update(.05);
  expect(sim.state.enemies.some(e => e.kind === 'boss')).toBe(true); expect(sim.state.enemies.length).toBeLessThanOrEqual(100);
 });
 it('removes enemies beyond the bottom without applying missed-enemy damage', () => {
  const sim = new GameSimulation('warrior', parseSave(null)); const escaped = sim.spawnEnemy('slime', 100, 850)!; const hp = sim.state.player.hp;
  sim.update(.05); expect(sim.state.enemies).not.toContain(escaped); expect(sim.state.escaped).toBe(1); expect(sim.state.player.hp).toBe(hp);
 });
});

describe('endless run endurance', () => {
 it('keeps actors, projectiles, hazards and effects bounded through ten minutes', () => {
  const sim = new GameSimulation('mage', parseSave(null), () => .37); sim.state.player.hp = sim.state.player.maxHp = 1e7;
  sim.state.skills = Object.fromEntries(HEROES.mage.skills.map(id => [id, skillRankLimit(SKILLS[id])])); sim.state.weaponLevel = 5; sim.state.evolved = true; sim.state.passives = { power: 5, haste: 5, vitality: 5, speed: 5 };
  for (let i = 0; i < 12000; i++) { sim.update(.05, { x: Math.sin(i / 60), y: Math.cos(i / 80) });
   if (sim.state.status === 'upgrade') sim.chooseUpgrade('reserve:gold');
   if (sim.state.enemies.length > 100 || sim.state.projectiles.length > 180 || sim.state.effects.length > 60 || sim.state.hazards.length > 12) throw new Error('entity limit exceeded');
  }
  expect(sim.state.elapsed).toBeCloseTo(600); expect(sim.state.status).toBe('running'); expect(sim.state.kills).toBeGreaterThan(500); expect(sim.state.bosses).toBeGreaterThan(0);
 });
});

describe('fatal frame ordering', () => {
 it('stops combat at lethal contact so XP cannot heal a defeated player', () => {
  const sim = new GameSimulation('warrior', parseSave(null)); sim.update(.05); sim.state.player.hp = 1; sim.state.xp = 14;
  const enemy = sim.spawnEnemy('slime', sim.state.player.x, sim.state.player.y)!; enemy.hp = 1;
  sim.update(.05); expect(sim.state.status).toBe('gameover'); expect(sim.state.player.hp).toBe(0); expect(sim.state.kills).toBe(0); expect(sim.state.level).toBe(1);
 });
});

for (const [hero, previousInterval] of [['warrior', .59], ['archer', .42], ['mage', .51]] as const) it(`slows ${hero}'s starting attack and leaves the first enemies alive after one hit`, () => {
 const sim = new GameSimulation(hero, parseSave(null), () => .5);
 sim.state.timeStopRemaining = 4;
 const player = sim.state.player;
 const slime = sim.spawnEnemy('slime', player.x, player.y - 50)!;
 const hits: number[] = [];
 const step = 1 / 120;
 for (let frame = 1; frame <= 4 / step && hits.length < 2; frame++) {
  const before = slime.hp;
  sim.update(step);
  if (slime.hp < before) {
   if (!hits.length) expect(slime.hp).toBeGreaterThan(0);
   hits.push(frame * step);
  }
 }
 expect(hits).toHaveLength(2);
 expect(hits[1] - hits[0]).toBeGreaterThanOrEqual(previousInterval * 2 - step);
 expect(slime.hp).toBeLessThanOrEqual(0);

 sim.state.timeStopRemaining = 0;
 for (const kind of ['slime','goblin','bat'] as const) {
  const enemy = sim.spawnEnemy(kind, 216, 160)!;
  sim.damageEnemy(enemy, sim.damage);
  expect(enemy.hp).toBeGreaterThan(0);
 }
});

it('does not recover health from earning a level or selecting an unrelated upgrade', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => 0);
 const { player } = sim.state;
 sim.damagePlayer(40);
 const wounded = player.hp;
 sim.gainXp(sim.state.xpNext);
 expect(sim.state.level).toBe(2);
 expect(player.hp).toBe(wounded);
 expect(sim.chooseUpgrade('weapon')).toBe(true);
 expect(player.hp).toBe(wounded);
});

it('takes another hit after the shortened damage immunity window', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const { player } = sim.state;
 sim.damagePlayer(10);
 expect(player.invincible).toBe(.2);
 for (let i = 0; i < 3; i++) sim.update(.05);
 sim.damagePlayer(10);
 expect(player.hp).toBe(player.maxHp - 10);
 sim.update(.05);
 sim.damagePlayer(10);
 expect(player.hp).toBe(player.maxHp - 20);
});
