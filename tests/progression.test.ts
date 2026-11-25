import { describe, it, expect } from 'vitest';
import { availableUpgrades, rollUpgrades } from '../src/game/progression';
import { createRun, GameSimulation } from '../src/game/simulation';
import { parseSave } from '../src/game/save';
describe('upgrade choices', () => {
 it('offers only the selected hero skills and unique choices', () => {
  const run = createRun('archer', parseSave(null)); const pool = availableUpgrades(run);
  expect(pool.some(x => x.id === 'skill:rain')).toBe(true); expect(pool.some(x => x.id === 'skill:chain')).toBe(false);
  const rolled = rollUpgrades(run, () => .1); expect(rolled).toHaveLength(3); expect(new Set(rolled.map(x => x.id)).size).toBe(3);
 });
 it('excludes capped upgrades and handles an empty pool', () => {
  const run = createRun('warrior', parseSave(null)); run.weaponLevel = 5; run.evolved = true; run.skills = { whirl: 4, blade: 4, shield: 3, bash: 4 }; run.passives = { power: 5, haste: 5, vitality: 5, speed: 5 };
  expect(availableUpgrades(run)).toHaveLength(0);
  expect(rollUpgrades(run, () => 0).map(x => x.id)).toEqual(['reserve:gold', 'reserve:hp', 'reserve:speed']);
  run.skills.shield = 2;
  expect(rollUpgrades(run, () => 0).map(x => x.id)).toEqual(['skill:shield', 'reserve:gold', 'reserve:hp']);
 });
});

it('offers a recovery choice at critical HP rather than leaving survival entirely to the draw', () => {
 const run = createRun('archer', parseSave(null)); run.player.hp = 20;
 expect(rollUpgrades(run, () => 0).map(x => x.id)).toContain('passive:vitality');
 const picks = rollUpgrades(run, () => 0); expect(new Set(picks.map(x => x.id)).size).toBe(picks.length);
});

it.each([
 ['warrior', 'lunge', 'quake', 'sunder'],
 ['archer', 'ricochet', 'blastArrow', 'deadeye'],
 ['mage', 'gravity', 'prism', 'runeCross'],
] as const)('unlocks three additional %s skills through run levels', (hero, early, middle, late) => {
 const run = createRun(hero, parseSave(null));
 for (const [level, expected] of [[3, []], [4, [early]], [6, [early, middle]], [8, [early, middle, late]]] as const) {
  run.level = level;
  const options = availableUpgrades(run).filter(option => [early, middle, late].some(id => option.id === `skill:${id}`));
  expect(options.map(option => option.id)).toEqual(expected.map(id => `skill:${id}`));
  const rolled = rollUpgrades(run, () => 0);
  expect(rolled).toHaveLength(3);
  if (expected.length) expect(rolled.map(option => option.id)).toContain(`skill:${expected.at(-1)}`);
 }
});

it('offers the same offensive skill at rank four and caps the shield at rank three', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => 0);
 const run = sim.state;
 run.skills = { whirl: 3, shield: 3 };
 const options = availableUpgrades(run);
 expect(options.find(option => option.id === 'skill:whirl')).toMatchObject({level:3, max:4});
 expect(options.some(option => option.id === 'skill:shield')).toBe(false);
 sim.gainXp(run.xpNext);
 expect(sim.chooseUpgrade('skill:whirl')).toBe(true);
 expect(run.skills.whirl).toBe(4);
 expect(run.weaponLevel).toBe(1);
 expect(availableUpgrades(run).some(option => option.id === 'skill:whirl')).toBe(false);
});

it('offers a fourth aura rank that describes only the movement debuff', () => {
 const run = createRun('mage', parseSave(null));
 run.skills.frost = 3;
 const option = availableUpgrades(run).find(upgrade => upgrade.id === 'skill:frost');
 expect(option).toMatchObject({ level: 3, max: 4 });
 expect(option?.description).toContain('70%');
 expect(option?.description).not.toMatch(/피해|발동 빈도/);
 run.skills.frost = 4;
 expect(availableUpgrades(run).some(upgrade => upgrade.id === 'skill:frost')).toBe(false);
});
