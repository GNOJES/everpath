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
 it('doubles the previous HP of each scheduled middle boss', () => {
  const baseline = [
   [120, [410 * 1.14]],
   [240, [410 * .64, 410 * .64]],
   [360, [410 * .86, 850 * .85]],
   [480, [410 * .56, 850 * .59, 410 * .56, 850 * .59]],
  ] as const;
  for (const [at, health] of baseline) {
   const sim = new GameSimulation('warrior', parseSave(null), () => .5);
   sim.state.elapsed = at - .025;
   sim.state.nextBoss = at;
   sim.update(.025);
   const wave = sim.state.enemies.filter(enemy => enemy.middleWave === at);
   expect(wave).toHaveLength(health.length);
   wave.forEach((enemy, slot) => {
    expect(enemy.maxHp).toBeCloseTo(2 * health[slot] * (1 + at * .0044));
    expect(enemy.hp).toBe(enemy.maxHp);
   });
  }
 });

 it('sends the requested four middle-boss waves from offscreen', () => {
  const sim = new GameSimulation('warrior', parseSave(null), () => .5);
  const schedule = [
   [120, ['boss']], [240, ['boss', 'boss']],
   [360, ['boss', 'briar']], [480, ['boss', 'briar', 'boss', 'briar']],
  ] as const;
  for (const [elapsed, kinds] of schedule) {
   sim.state.elapsed = elapsed - .01;
   const previous = new Set(sim.state.enemies.map(enemy => enemy.id));
   sim.update(.025);
   const wave = sim.state.enemies.filter(enemy => !previous.has(enemy.id) && ['boss', 'briar'].includes(enemy.kind));
   expect(wave.map(enemy => enemy.kind)).toEqual(kinds);
   expect(wave.every(enemy => enemy.y < 0 && !!enemy.entryTarget)).toBe(true);
   expect(new Set(wave.map(enemy => enemy.x)).size).toBe(kinds.length);
   expect(new Set(wave.map(enemy => enemy.timer)).size).toBe(kinds.length);
   const grormHp = Math.max(...wave.filter(enemy => enemy.kind === 'boss').map(enemy => enemy.maxHp));
   for (const briar of wave.filter(enemy => enemy.kind === 'briar')) {
    expect(briar.maxHp).toBeGreaterThanOrEqual(2 * grormHp);
    expect(briar.hp).toBe(briar.maxHp);
   }
   const before = sim.state.bosses;
   for (const enemy of wave) sim.damageEnemy(enemy, 1e9);
   while (sim.state.choices[0]) sim.chooseUpgrade(sim.state.choices[0].id);
   expect(sim.state.bosses - before).toBe(kinds.length);
   expect(sim.state.pickups.filter(pickup => pickup.kind === 'chest').length).toBe(sim.state.bosses);
  }
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

it('keeps living enemies, shots and telegraphs as the Warden joins the field', () => {
 const sim = new GameSimulation('mage', parseSave(null), () => .5);
 const s = sim.state;
 s.elapsed = 599.99;
 s.player.invincible = 999;
 const regular = sim.spawnEnemy('goblin', 35, 120)!;
 const shot = {id:4001, x:40, y:35, vx:0, vy:95, life:3, damage:5, radius:4, kind:'enemy' as const, pierce:1, hit:new Set<number>()};
 const zone = {id:4002, x:40, y:70, life:1, delay:.7, radius:25, damage:3, owner:'enemy' as const, kind:'slam' as const, fired:false};
 s.projectiles.push(shot); s.hazards.push(zone);
 sim.update(.025);
 expect(s.enemies).toContain(regular);
 expect(s.enemies.find(enemy => enemy.kind === 'warden')?.y).toBeLessThan(0);
 expect(s.projectiles).toContain(shot);
 expect(s.hazards).toContain(zone);
 expect(s.withdrawn).toBe(0);
 const spawned = s.spawned;
 for (let i = 0; i < 152; i++) sim.update(.025);
 expect(s.spawned).toBe(spawned);
 for (let i = 0; i < 16; i++) sim.update(.025);
 expect(s.spawned - spawned).toBe(1);
 expect(s.enemies.some(enemy => enemy.reinforcement)).toBe(true);
 for (let i = 0; i < 1200; i++) {
  for (const enemy of s.enemies) {
   if (enemy.reinforcement) { enemy.hp = 1e9; enemy.speed = 0; }
  }
  sim.update(.025);
 }
 expect(s.spawned - spawned).toBe(3);
 expect(s.enemies.filter(enemy => enemy.reinforcement)).toHaveLength(3);
});

it('gives Briar staggered artillery and a recovery window without a dash', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const boss = sim.spawnEnemy('briar', 90, 200)!;
 boss.timer = 0;
 const p = sim.state.player;
 sim.update(.05);
 expect(boss.phase).toBe('warn');
 const zones = sim.state.hazards.filter(hazard => hazard.impactSound === 'briarImpact');
 expect(zones).toHaveLength(2);
 expect(zones[0]).toMatchObject({x:p.x, y:p.y});
 expect(zones[0].delay).toBeLessThan(zones[1].delay);
 for (let i = 0; i < 29; i++) sim.update(.05);
 expect(boss.phase).toBe('recover');
 expect(zones.every(zone => zone.fired)).toBe(true);
});

it('cycles through warning circles, a targeted fan and a radial volley in the Warden fight', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const s = sim.state;
 s.elapsed = 600; s.finalSpawned = true;
 const boss = sim.spawnEnemy('warden', 216, 155)!;
 expect(boss.maxHp).toBe(12000);
 boss.speed = 0; boss.timer = 0;
 sim.update(.025);
 expect(s.hazards.filter(zone => zone.owner === 'enemy')).toHaveLength(2);
 boss.timer = 0;
 sim.update(.025);
 expect(boss.phase).toBe('warn');
 boss.timer = 0;
 sim.update(.025);
 expect(s.projectiles.filter(shot => shot.kind === 'enemy')).toHaveLength(5);
 boss.hp = boss.maxHp / 2; boss.timer = 0;
 sim.update(.025);
 expect(s.projectiles.filter(shot => shot.kind === 'enemy')).toHaveLength(19);
 expect(s.hazards.filter(zone => zone.owner === 'enemy')).toHaveLength(3);
});
