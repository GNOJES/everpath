import { describe, it, expect } from 'vitest';
import { availableUpgrades, rollUpgrades } from '../src/game/progression';
import { createRun } from '../src/game/simulation';
import { parseSave } from '../src/game/save';
describe('upgrade choices', () => {
 it('offers only the selected hero skills and unique choices', () => {
  const run = createRun('archer', parseSave(null)); const pool = availableUpgrades(run);
  expect(pool.some(x => x.id === 'skill:rain')).toBe(true); expect(pool.some(x => x.id === 'skill:chain')).toBe(false);
  const rolled = rollUpgrades(run, () => .1); expect(rolled).toHaveLength(3); expect(new Set(rolled.map(x => x.id)).size).toBe(3);
 });
 it('excludes capped upgrades and handles an empty pool', () => {
  const run = createRun('warrior', parseSave(null)); run.weaponLevel = 5; run.evolved = true; run.skills = { whirl: 3, blade: 3, shield: 3, bash: 3 }; run.passives = { power: 5, haste: 5, vitality: 5, speed: 5 };
  expect(availableUpgrades(run)).toHaveLength(0); expect(rollUpgrades(run, Math.random)).toEqual([]);
  run.skills.shield = 2; expect(rollUpgrades(run, Math.random).map(x => x.id)).toEqual(['skill:shield']);
 });
});

it('offers a recovery choice at critical HP rather than leaving survival entirely to the draw', () => {
 const run = createRun('archer', parseSave(null)); run.player.hp = 20;
 expect(rollUpgrades(run, () => 0).map(x => x.id)).toContain('passive:vitality');
 const picks = rollUpgrades(run, () => 0); expect(new Set(picks.map(x => x.id)).size).toBe(picks.length);
});
