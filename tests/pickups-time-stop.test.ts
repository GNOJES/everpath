import { describe, expect, it } from 'vitest';
import { PICKUPS, WORLD } from '../src/game/config';
import { GameSimulation } from '../src/game/simulation';
import { parseSave, SaveStore } from '../src/game/save';

describe('field pickups', () => {
 it('awards 1G for regular enemies and 3G for elites before gold upgrades', () => {
  const sim = new GameSimulation('warrior', parseSave(null), () => .5);
  for (let i = 0; i < 20; i++) {
   const enemy = sim.spawnEnemy('slime', 100, 350)!;
   sim.damageEnemy(enemy, 10000);
  }
  expect(sim.state.gold).toBe(20);
  const elite = sim.spawnEnemy('goblin', 100, 350)!;
  elite.elite = true;
  sim.damageEnemy(elite, 10000);
  expect(sim.state.gold).toBe(23);
 });

 it.each([
  [120, 150, 1], [240, 100, 1.25], [360, 120, 1.4], [480, 80, 1.5],
 ])('awards milestone XP on the first kill of the %is wave and its chest on contact', (at, gold, xpScale) => {
  const sim = new GameSimulation('warrior', parseSave(null), () => .5);
  const s = sim.state;
  s.elapsed = at - .02;
  s.nextBoss = at;
  s.xpNext = 100;
  const cues: string[] = [];
  sim.onSound = cue => cues.push(cue);
  sim.update(.025);
  const wave = s.enemies.filter(enemy => enemy.middleWave === at);
  sim.damageEnemy(wave[0], 1e8);
  expect(s.level).toBe(2);
  expect(s.xp).toBe(Math.round(100 * xpScale) - 100);
  expect(s.gold).toBe(0);
  while (s.choices.length) sim.chooseUpgrade(s.choices[0].id);
  const chest = s.pickups[0];
  expect(chest).toMatchObject({kind: 'chest', gold});
  s.player.x = chest.x; s.player.y = chest.groundY + s.scroll;
  sim.update(.025);
  expect(s.gold).toBe(gold);
  expect(cues.filter(cue => cue === 'chestPickup')).toHaveLength(1);
  expect(s.effects.some(effect => effect.kind === 'chestPickup')).toBe(true);
  if (wave[1]) {
   sim.damageEnemy(wave[1], 1e8);
   expect(s.level).toBe(2);
  }
 });

 it('grants more first-kill XP for Briar than Grorm in the same wave', () => {
  const firstKillXp = (kind: 'boss' | 'briar') => {
   const sim = new GameSimulation('mage', parseSave(null), () => .5);
   const s = sim.state;
   s.elapsed = 359.99;
   s.nextBoss = 360;
   s.xpNext = 100;
   sim.update(.025);
   sim.damageEnemy(s.enemies.find(enemy => enemy.kind === kind)!, 1e8);
   expect(s.level).toBe(2);
   return 100 + s.xp;
  };
  expect(firstKillXp('boss')).toBe(140);
  expect(firstKillXp('briar')).toBe(175);
 });

 it('grants the increased chances for both types of ground drops', () => {
  const sim = new GameSimulation('archer', parseSave(null), () => .5);
  sim.state.elapsed = 180;
  for (const roll of [.0027, .0147, .0149]) {
   const enemy = sim.spawnEnemy('goblin', 160, 300)!;
   enemy.seed = roll * Math.PI * 2;
   sim.damageEnemy(enemy, 1e8);
  }
  expect(sim.state.pickups.map(item => [item.kind, item.gold])).toEqual([['heal', 0], ['coin', 10]]);
 });
 it('removes timed supplies and only grants random drops on contact', () => {
  const sim = new GameSimulation('warrior', parseSave(null), () => .5);
  sim.state.elapsed = 119.99;
  const p = sim.state.player;
  p.hp = 20;
  sim.update(.05);
  expect([p.hp, sim.state.gold]).toEqual([20, 0]);
  const earlyEnemy = sim.spawnEnemy('goblin', p.x + 100, p.y)!;
  earlyEnemy.seed = 0;
  sim.damageEnemy(earlyEnemy, 1e9);
  expect(sim.state.pickups).toHaveLength(0);
  sim.state.elapsed = PICKUPS.from;
  sim.state.nextBoss = Infinity;
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
  sim.state.elapsed = PICKUPS.from;
  sim.state.nextBoss = Infinity;
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

 it('carries drops with the scrolled ground until they leave the bottom', () => {
  const sim = new GameSimulation('archer', parseSave(null), () => .5);
  sim.state.elapsed = PICKUPS.from;
  sim.state.nextBoss = Infinity;
  const p = sim.state.player;
  const enemy = sim.spawnEnemy('goblin', WORLD.margin, WORLD.height - 20)!;
  enemy.seed = 0;
  sim.damageEnemy(enemy, 1e9);
  const item = sim.state.pickups[0];
  const anchoredY = item.groundY;
  sim.update(.05);
  expect(item.groundY).toBe(anchoredY);
  expect(item.groundY + sim.state.scroll).toBeGreaterThan(anchoredY);
  expect(sim.state.pickups).toContain(item);
  for (let i = 0; i < 45; i++) sim.update(.05);
  expect(sim.state.pickups).not.toContain(item);
  expect(p.hp).toBe(p.maxHp);
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
  s.player.x = chest.x; s.player.y = chest.groundY + s.scroll;
  sim.update(.05);
  expect(s.gold).toBe(before + PICKUPS.firstChestGold);
  expect(s.status).toBe('running');
  expect(s.pickups).toHaveLength(0);
 });

 it('emits coinPickup and healPickup cues and ring effects on direct 30px contact', () => {
  const sim = new GameSimulation('warrior', parseSave(null), () => .5);
  const s = sim.state, p = s.player;
  s.elapsed = PICKUPS.from;
  s.nextBoss = Infinity;
  const cues: string[] = [];
  sim.onSound = cue => cues.push(cue);
  p.hp = p.maxHp - 40;
  const healEnemy = sim.spawnEnemy('goblin', p.x + 65, p.y)!;
  healEnemy.seed = 0;
  sim.damageEnemy(healEnemy, 1e8);
  const coinEnemy = sim.spawnEnemy('goblin', p.x + 115, p.y)!;
  coinEnemy.seed = PICKUPS.healChance * Math.PI * 3;
  sim.damageEnemy(coinEnemy, 1e8);

  sim.update(.05);
  expect(s.pickups).toHaveLength(2);
  expect(cues).not.toContain('healPickup');
  expect(cues).not.toContain('coinPickup');

  p.x = s.pickups[0].x; p.y = s.pickups[0].groundY + s.scroll;
  sim.update(.05);
  expect(cues).toContain('healPickup');
  expect(s.effects.some(e => e.kind === 'ring' && e.radius === 36)).toBe(true);

  p.x = s.pickups[0].x; p.y = s.pickups[0].groundY + s.scroll;
  sim.update(.05);
  expect(cues).toContain('coinPickup');
  expect(s.effects.some(e => e.kind === 'ring' && e.radius === 26)).toBe(true);
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
