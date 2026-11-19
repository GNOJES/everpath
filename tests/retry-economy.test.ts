import { it,expect } from 'vitest';
import { mkdirSync,writeFileSync } from 'node:fs';
import { SaveStore } from '../src/game/save';
import { playTrial,type Build } from './helpers/playtest';
import type { HeroId,PermanentId } from '../src/game/types';

it.each([[13, 57, 310], [6841, 8089, 16381]])('requires more than three mage attempts on seeds %i, %i, %i', (...seeds) => {
 const store = new SaveStore({ getItem: () => null, setItem: () => {} });
 const priority: PermanentId[] = ['attack', 'hp', 'speed', 'gold'];
 const deferred = { attack: 0, hp: 0, speed: 5, gold: 7 };
 for (const [index, seed] of seeds.entries()) {
  const trial = playTrial('mage', seed, 'reactive', 'weapon', 710, 0, store.data);
  expect(trial.status, `attempt ${index + 1}`).not.toBe('victory');
  if (index === seeds.length - 1) break;
  store.settle({ runId: `mage-regression-${index}`, hero: 'mage', time: trial.survived, level: trial.level, kills: trial.kills, bosses: trial.bosses, gold: trial.gold, cleared: false, rank: 0 });
  const costPriority = (id: PermanentId) => store.data.upgrades[id] + deferred[id];
  for (let purchase = 0; purchase < 80; purchase++) {
   const candidates = [...priority].sort((a, b) => costPriority(a) - costPriority(b));
   if (!candidates.some(id => store.purchase(id))) break;
  }
 }
}, 15000);

it('turns only earned run gold into a first clear and supports refund/rebuild',()=>{
 const records: {hero:HeroId;build:Build;strategy:string;offset:number;trials:{attempt:number;levels:Record<PermanentId,number>;time:number;gold:number;cleared:boolean}[]}[]=[];
 for(const hero of ['warrior','archer','mage'] as HeroId[])for(const build of ['weapon','skills'] as Build[])for(const strategy of ['balanced','offense'])for(const offset of [0,1,2,3]){
  const store=new SaveStore({getItem:()=>null,setItem:()=>{}});const trials=[];
  for(let attempt=0;attempt<36;attempt++){
   const levels={...store.data.upgrades};const trial=playTrial(hero,[42,271,2026,91,777,4096][(attempt+offset)%6],'reactive',build,710,0,store.data);
   store.settle({runId:`${hero}-${attempt}`,hero,time:trial.survived,level:trial.level,kills:trial.kills,bosses:trial.bosses,gold:trial.gold,cleared:trial.status==='victory',rank:0});
   trials.push({attempt:attempt+1,levels,time:trial.survived,gold:trial.gold,cleared:trial.status==='victory'});
   if(trial.status==='victory')break;
   for(let purchase=0;purchase<80;purchase++){
    const priority:PermanentId[]=['attack','hp','speed','gold'];const candidates=priority.filter(k=>store.data.upgrades[k]<20).sort((a,b)=>store.data.upgrades[a]+(a==='speed'?5:a==='gold'?7:strategy==='offense'&&a==='hp'?3:0)-store.data.upgrades[b]-(b==='speed'?5:b==='gold'?7:strategy==='offense'&&b==='hp'?3:0));
    if(!candidates.some(k=>store.purchase(k)))break;
   }
  }
  records.push({hero,build,strategy,offset,trials});
  mkdirSync('docs/playtests',{recursive:true});writeFileSync('docs/playtests/retry-economy.json',JSON.stringify(records,null,2));expect(trials[0].cleared).toBe(false);
  const wealth=store.data.gold+store.data.invested;store.refundUpgrades();expect(store.data.gold).toBe(wealth);expect(store.data.upgrades.attack).toBe(0);expect(store.data.clears[hero]).toBe(trials.at(-1)!.cleared?1:0);
 }
 mkdirSync('docs/playtests',{recursive:true});writeFileSync('docs/playtests/retry-economy.json',JSON.stringify(records,null,2));
 // Even the fastest successful trial should require multiple rounds of earned upgrades.
 for(const row of records){expect(row.trials.at(-1)!.cleared,`${row.hero}/${row.build}/${row.strategy}/${row.offset}`).toBe(true);expect(row.trials.length,`${row.hero}/${row.build}/${row.strategy}/${row.offset}`).toBeGreaterThanOrEqual(4);}
 const medians = (['warrior','archer','mage'] as const).map(hero=>{ const n=records.filter(r=>r.hero===hero).map(r=>r.trials.length).sort((a,b)=>a-b);const median=(n[7]+n[8])/2;expect(median).toBeGreaterThanOrEqual(7);expect(median).toBeLessThanOrEqual(20);return median;});
 expect(Math.max(...medians)/Math.min(...medians)).toBeLessThan(1.6);
},240000);
