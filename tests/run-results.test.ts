import {it,expect}from 'vitest';
import {GameSimulation}from '../src/game/simulation';
import {SaveStore,parseSave}from '../src/game/save';
it('counts successful spawns, kills, escaped enemies and unresolved enemies without double counting',()=>{
 const sim=new GameSimulation('warrior',parseSave(null),()=>.5);const killed=sim.spawnEnemy('slime',10,10)!;sim.damageEnemy(killed,1e6);sim.spawnEnemy('slime',100,850);sim.spawnEnemy('brute',30,30);sim.update(.01);
 const r=sim.result().combat!;expect(r).toMatchObject({spawned:4,killed:1,missed:3,escaped:1,withdrawn:0,remaining:2});expect(r.missRate).toBeCloseTo(75);expect(r.killRate+r.missRate).toBeCloseTo(100);sim.update(.01);expect(sim.result().combat!.escaped).toBe(1);
});
it('does not count rejected spawns and marks cap replacements as un defeated',()=>{
 const sim=new GameSimulation('warrior',parseSave(null));for(let i=0;i<100;i++)sim.spawnEnemy('slime',10,10);expect(sim.spawnEnemy('slime',10,10)).toBeUndefined();sim.spawnEnemy('boss',216,160);expect(sim.result().combat).toMatchObject({spawned:101,killed:0,missed:101,withdrawn:1,remaining:100});
});
it('counts enemies still on the field at victory and freezes every result',()=>{
 const sim=new GameSimulation('mage',parseSave(null),()=>.5);sim.spawnEnemy('slime',10,10);sim.state.elapsed=599.99;sim.update(.05);const boss=sim.state.enemies.find(e=>e.kind==='warden')!;sim.damageEnemy(boss,1e9);
 expect(sim.result().combat).toMatchObject({spawned:2,killed:1,missed:1,withdrawn:0,remaining:1,killRate:50,missRate:50});const r=sim.result();for(let i=0;i<100;i++)sim.update(.05);expect(sim.result()).toEqual(r);
});
it('uses zero rates for no encounters and counts surviving monsters at death',()=>{
 const sim=new GameSimulation('mage',parseSave(null));expect(sim.result().combat).toMatchObject({spawned:0,missRate:0,killRate:0});sim.spawnEnemy('slime',30,30);sim.damagePlayer(1e6);expect(sim.result().combat).toMatchObject({spawned:1,missed:1,remaining:1,missRate:100});
});
it('keeps recent twenty immutable records, dedupes and restores history',()=>{
 let raw:string|null=null;const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}};const store=new SaveStore(storage);const sim=new GameSimulation('mage',parseSave(null));
 for(let i=0;i<24;i++)store.settle({...sim.result(),runId:`history-${i}`,gold:1});store.settle({...sim.result(),runId:'history-23',gold:99});expect(store.data.history).toHaveLength(20);expect(store.data.gold).toBe(24);expect(new SaveStore(storage).data.history).toEqual(store.data.history);expect(store.data.history[0].runId).toBe('history-4');
});
it('migrates absent history and rejects corrupt summaries without inventing old combat counts',()=>{
 expect(parseSave(JSON.stringify({version:1,gold:5})).history).toEqual([]);const s=parseSave(JSON.stringify({version:1,history:[{runId:'bad',hero:'hacker'}]}));expect(s.history).toEqual([]);
});
