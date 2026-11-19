import { it,expect } from 'vitest';
import { writeFileSync,mkdirSync } from 'node:fs';
import { playTrial,type Build } from './helpers/playtest';
import type { HeroId } from '../src/game/types';
it('makes permanent progression improve normal-HP ten-minute boss outcomes',()=>{
 const results: ReturnType<typeof playTrial>[]=[];
 for(const meta of [0,5,10,15,20])for(const hero of ['warrior','archer','mage'] as HeroId[])for(const seed of [42,271,2026,91,777,4096])for(const build of ['weapon','balanced','skills'] as Build[])results.push(playTrial(hero,seed,'reactive',build,710,meta));
 mkdirSync('docs/playtests',{recursive:true});writeFileSync('docs/playtests/campaign-growth.json',JSON.stringify({conditions:'Normal HP, reactive 10Hz steering/30Hz simulation, 710 second cap, permanent ranks0/5/10/15/20; no combat state edits',results},null,2));
 console.table([0,5,10,15,20].flatMap(meta=>['warrior','archer','mage'].map(hero=>{const a=results.filter(r=>r.meta===meta&&r.hero===hero);return{meta,hero,mean:Math.round(a.reduce((n,r)=>n+r.survived,0)/a.length),min:Math.min(...a.map(r=>r.survived)),max:Math.max(...a.map(r=>r.survived)),clears:a.filter(r=>r.status==='victory').length,evolved:a.filter(r=>r.evolved).length,gold:Math.round(a.reduce((n,r)=>n+r.gold,0)/a.length)}})));
 expect(results.filter(r=>r.meta===0&&r.status==='victory')).toHaveLength(0);
 const baselinePairClears = ['warrior','archer','mage'].map(hero => results.filter(r => r.meta === 0 && r.hero === hero && r.sixMinuteBossKills === 2).length);
 expect(Math.min(...baselinePairClears), 'each hero clears both Grorms in at least two thirds of unupgraded trials').toBeGreaterThanOrEqual(12);
 expect(Math.max(...baselinePairClears) - Math.min(...baselinePairClears), 'unupgraded pair clear gap between heroes').toBeLessThanOrEqual(5);
 for(const hero of ['warrior','archer','mage']){
  const base=results.filter(r=>r.hero===hero&&r.meta===0),grown=results.filter(r=>r.hero===hero&&r.meta===20);
  expect(grown.filter(r=>r.status==='victory').length,hero).toBeGreaterThanOrEqual(3);
  expect(grown.reduce((n,r)=>n+r.survived,0),hero).toBeGreaterThan(base.reduce((n,r)=>n+r.survived,0));
 }
},180000);
