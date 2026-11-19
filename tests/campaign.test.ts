import { describe,it,expect } from 'vitest';
import { GameSimulation } from '../src/game/simulation';
import { SaveStore,parseSave,upgradeCost } from '../src/game/save';
import { availableUpgrades } from '../src/game/progression';
import { encounterPhase } from '../src/game/encounters';
describe('refundable growth',()=>{
 it('refunds exact investment once, preserves records, survives reload',()=>{
  let raw:string|null=null;const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}};const store=new SaveStore(storage);store.data.gold=1000;store.data.bestTime=123;
  store.purchase('attack');store.purchase('attack');const cost=upgradeCost(0)+upgradeCost(1);
  expect(store.data.invested).toBe(cost);expect(store.refundUpgrades()).toBe(cost);expect(store.data.gold).toBe(1000);expect(store.data.bestTime).toBe(123);expect(store.data.upgrades.attack).toBe(0);expect(store.refundUpgrades()).toBe(0);
  expect(new SaveStore(storage).data.gold).toBe(1000);
 });
 it('migrates legacy purchases at historical prices',()=>{const s=parseSave(JSON.stringify({version:1,gold:7,upgrades:{attack:2}}));expect(s.invested).toBe(12+Math.floor(12*1.65));});
 it('isolates active run stats from later refunds',()=>{const s=parseSave(null);s.upgrades.attack=5;const sim=new GameSimulation('warrior',s);const power=sim.power;s.upgrades.attack=0;expect(sim.power).toBe(power);});
});
describe('ten minute objective',()=>{
 it('has distinct late phases and schedules the final boss once',()=>{
  expect(encounterPhase(10).name).not.toBe(encounterPhase(500).name);
  const sim=new GameSimulation('mage',parseSave(null),()=>.5);sim.state.elapsed=599.99;sim.state.nextBoss=600;sim.update(.05);
  expect(sim.state.enemies.filter(e=>e.kind==='warden')).toHaveLength(1);sim.update(.05);expect(sim.state.enemies.filter(e=>e.kind==='warden')).toHaveLength(1);
 });
 it('final boss death wins once, clears dangers and freezes simulation',()=>{
  const sim=new GameSimulation('mage',parseSave(null));sim.state.elapsed=605;const boss=sim.spawnEnemy('warden',216,160)!;
  sim.damageEnemy(boss,1e9);expect(sim.state.status).toBe('victory');expect(sim.result().cleared).toBe(true);expect(sim.state.hazards).toHaveLength(0);expect(sim.state.effects.some(effect => effect.kind === 'boss-death')).toBe(true);
  const snapshot=JSON.stringify(sim.state);sim.update(.05);sim.damageEnemy(boss,1e9);expect(JSON.stringify(sim.state)).toBe(snapshot);
 });
 it('clears persist once and unlock the next challenge rank',()=>{
  const store=new SaveStore({getItem:()=>null,setItem:()=>{}});const result={runId:'win',hero:'archer' as const,time:620,level:20,kills:1000,bosses:3,gold:300,cleared:true,rank:0};
  store.settle(result);store.settle(result);expect(store.data.clears.archer).toBe(1);expect(store.data.challengeUnlocked).toBe(1);
 });
 for(const [hero,passive] of [['warrior','power'],['archer','haste'],['mage','power']] as const)it(`${hero} evolution needs a fully raised weapon and matching passive`,()=>{
  const sim=new GameSimulation(hero,parseSave(null));expect(availableUpgrades(sim.state).some(c=>c.id==='evolve')).toBe(false);
  sim.state.weaponLevel=5;sim.state.passives[passive]=2;expect(availableUpgrades(sim.state).some(c=>c.id==='evolve')).toBe(true);
  sim.state.status='upgrade';sim.state.choices=availableUpgrades(sim.state);expect(sim.chooseUpgrade('evolve')).toBe(true);expect(sim.state.evolved).toBe(true);expect(availableUpgrades(sim.state).some(c=>c.id==='evolve')).toBe(false);
 });
});

describe('campaign boundary cases',()=>{
 it('uses fixed final-boss HP irrespective of killed middle bosses',()=>{
  const a=new GameSimulation('mage',parseSave(null)),b=new GameSimulation('mage',parseSave(null));a.state.elapsed=b.state.elapsed=600;b.state.bosses=2;
  expect(a.spawnEnemy('warden',216,160)!.hp).toBe(b.spawnEnemy('warden',216,160)!.hp);
 });
 it('arena timeout defeats shields and invulnerability, but does not run while paused',()=>{
  const sim=new GameSimulation('warrior',parseSave(null));sim.state.elapsed=699.99;sim.state.finalSpawned=true;sim.state.player.shield=1;sim.state.player.invincible=100;
  sim.pause();sim.update(.05);expect(sim.state.elapsed).toBe(699.99);sim.resume();sim.update(.05);expect(sim.state.status).toBe('gameover');expect(sim.state.player.hp).toBe(0);
 });
 it('caps forged challenge choices at the earned unlock and records each clear only once',()=>{
  const sim=new GameSimulation('mage',parseSave(null),Math.random,3);expect(sim.state.rank).toBe(0);
  const s=parseSave(null);s.challengeUnlocked=2;expect(new GameSimulation('mage',s,Math.random,3).state.rank).toBe(2);
 });
 it('guarantees a legal evolution in the next offered choice',()=>{
  const sim=new GameSimulation('warrior',parseSave(null),()=>.99);sim.state.weaponLevel=5;sim.state.passives.power=2;sim.gainXp(20);
  expect(sim.state.choices.some(c=>c.id==='evolve')).toBe(true);expect(new Set(sim.state.choices.map(c=>c.id)).size).toBe(sim.state.choices.length);
 });
});

describe('boss entry waves', () => {
 it('sends one centered boss at three minutes and two staggered bosses at six', () => {
  const sim = new GameSimulation('warrior', parseSave(null), () => .5);
  sim.state.elapsed = 179.99;
  sim.update(.025);
  const first = sim.state.enemies.filter(e => e.kind === 'boss');
  expect(first).toHaveLength(1);
  expect(first[0]).toMatchObject({ x: 216, entryTarget: { x: 216, y: 162 } });
  expect(first[0].y).toBeLessThan(0);
  sim.damageEnemy(first[0], 1e9);
  while (sim.state.choices[0]) sim.chooseUpgrade(sim.state.choices[0].id);
  sim.state.elapsed = 359.99;
  sim.update(.025);
  const pair = sim.state.enemies.filter(e => e.kind === 'boss');
  expect(pair.map(e => e.x)).toEqual([108, 324]);
  expect(pair.every(e => e.y < 0)).toBe(true);
  expect(pair[1].timer - pair[0].timer).toBeCloseTo(1.55);
  const goldBefore = sim.state.gold;
  const killsBefore = sim.state.bosses;
  for (const boss of pair) sim.damageEnemy(boss, 1e9);
  expect(sim.state.gold - goldBefore).toBe(40);
  expect(sim.state.bosses - killsBefore).toBe(2);
 });

 it('starts the final boss offscreen and skips contact damage during its visible entrance', () => {
  const sim = new GameSimulation('warrior', parseSave(null), () => .5);
  const { player } = sim.state;
  player.y = 105;
  sim.state.elapsed = 599.99;
  sim.update(.025);
  const boss = sim.state.enemies.find(e => e.kind === 'warden')!;
  expect(boss.y).toBeLessThan(0);
  expect(boss.entryTarget).toEqual({ x: player.x, y: 170 });
  const hp = player.hp;
  for (let i = 0; i < 80 && boss.entryTarget; i++) sim.update(.025);
  expect(boss.entryTarget).toBeUndefined();
  expect(boss.y).toBe(170);
  expect(player.hp).toBe(hp);
  expect(boss.timer).toBe(3);
 });
});
