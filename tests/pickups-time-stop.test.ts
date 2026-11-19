import { describe, expect, it } from 'vitest';
import { PICKUPS } from '../src/game/config';
import { GameSimulation } from '../src/game/simulation';
import { parseSave, SaveStore } from '../src/game/save';

describe('field pickups', () => {
 it('removes timed supplies and only grants random drops on contact', () => {
  const sim = new GameSimulation('warrior', parseSave(null), () => .5);
  sim.state.elapsed = 119.99;
  const p = sim.state.player;
  p.hp = 20;
  sim.update(.05);
  expect([p.hp, sim.state.gold]).toEqual([20, 0]);
  const enemy = sim.spawnEnemy('goblin', p.x + 100, p.y)!;
  enemy.seed = PICKUPS.healChance * Math.PI * 3;
  sim.damageEnemy(enemy, 1e9);
  const coin = sim.state.pickups[0];
  expect(coin.kind).toBe('coin');
  const gold = sim.state.gold;
  sim.update(.05);
  expect(sim.state.gold).toBe(gold);
  p.x = coin.x;
  sim.update(.05);
  expect(sim.state.gold).toBe(gold + PICKUPS.coinGold);
  expect(sim.state.pickups).toHaveLength(0);
 });

 it('caps scarce recovery drops, keeps them at full HP, and heals on contact', () => {
  const sim = new GameSimulation('warrior', parseSave(null), () => .5);
  const p = sim.state.player;
  sim.state.elapsed = 120;
  for (let i = 0; i < 4; i++) {
   const enemy = sim.spawnEnemy('slime', p.x, p.y)!;
   enemy.seed = 0;
   sim.damageEnemy(enemy, 1e9);
  }
  expect(sim.state.pickups.map(p => p.kind)).toEqual(['heal', 'heal']);
  sim.update(.05);
  expect(sim.state.pickups).toHaveLength(2);
  p.hp -= 45;
  sim.update(.05);
  expect(p.hp).toBe(p.maxHp);
  expect(sim.state.pickups).toHaveLength(1);
 });

 it('guarantees a chest with gold after a middle boss', () => {
  const sim = new GameSimulation('warrior', parseSave(null), () => .5);
  const s = sim.state;
  const enemy = sim.spawnEnemy('boss', s.player.x + 100, s.player.y)!;
  sim.damageEnemy(enemy, 1e9);
  while (s.choices.length) sim.chooseUpgrade(s.choices[0].id);
  const chest = s.pickups[0], before = s.gold;
  expect(chest.kind).toBe('chest');
  sim.update(.05);
  expect(s.gold).toBe(before);
  s.player.x = chest.x; s.player.y = chest.y;
  sim.update(.05);
  expect(s.gold).toBe(before + PICKUPS.chestGold);
  expect(s.status).toBe('running');
  expect(s.pickups).toHaveLength(0);
 });
});

describe('time-stop pocket watch', () => {
 it('migrates old saves and preserves exact paid upgrades when selling charges', () => {
  const legacy = parseSave(JSON.stringify({version:1, progressionEconomy:2, gold:1000, invested:85,
   upgrades:{attack:2}, upgradePayments:{attack:[30,55],hp:[],speed:[],gold:[]}}));
  const store = new SaveStore({getItem:()=>null,setItem:()=>{}}, legacy);
  expect(store.data.upgrades.timeStop).toBe(0);
  expect(store.upgradeRefund('attack')).toBe(55);
  for (let i = 0; i < 3; i++) expect(store.purchase('timeStop')).toBe(true);
  expect(store.purchase('timeStop')).toBe(false);
  expect(parseSave(JSON.stringify(store.data)).upgrades.timeStop).toBe(3);
  expect(store.downgrade('timeStop')).toBe(true);
  expect(store.data.gold).toBe(500);
  expect(store.refundUpgrades()).toBe(585);
  expect(store.data.upgrades.timeStop).toBe(0);
 });

 it('uses charges per run and freezes all hostile updates while movement and attacks continue', () => {
  const save = parseSave(null);
  expect(new GameSimulation('warrior', save).activateTimeStop()).toBe(false);
  save.upgrades.timeStop = 2;
  const sim = new GameSimulation('warrior', save, () => .5), s = sim.state, p = s.player;
  const enemy = sim.spawnEnemy('brute', p.x + 65, p.y)!;
  const shot = {id:2000, x:p.x, y:p.y, vx:0, vy:0, life:2, damage:99, radius:6, kind:'enemy' as const, pierce:1, hit:new Set<number>()};
  const hazard = {id:2001, x:p.x, y:p.y, radius:180, delay:.1, life:1, fired:false, damage:80, owner:'enemy' as const, kind:'slam' as const};
  s.projectiles.push(shot); s.hazards.push(hazard);
  expect(sim.activateTimeStop()).toBe(true);
  expect(sim.activateTimeStop()).toBe(false);
  sim.pause(); sim.update(.05);
  expect(s.timeStopRemaining).toBe(2);
  sim.resume();
  for (let i = 0; i < 40; i++) sim.update(.05, {x:0,y:i < 2 ? 1 : 0});
  expect(p.y).toBeGreaterThan(515);
  expect(p.hp).toBe(p.maxHp);
  expect(enemy.hp).toBeLessThan(enemy.maxHp);
  expect([enemy.x, enemy.y, shot.life, hazard.delay, s.elapsed, s.timeStopRemaining]).toEqual([281,515,2,.1,0,0]);
  sim.update(.05);
  expect(shot.life).toBeLessThan(2);
  expect(hazard.delay).toBeLessThan(.1);
  expect(s.timeStopCharges).toBe(1);
  expect(new GameSimulation('warrior', save).state.timeStopCharges).toBe(2);
 });
});
