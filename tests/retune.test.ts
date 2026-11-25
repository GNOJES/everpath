import { it,expect } from 'vitest';
import { parseSave,upgradeCost } from '../src/game/save';
import { BALANCE,PERMANENT } from '../src/game/config';
it('keeps twenty permanent ranks and rounds all shop prices to tens',()=>{
 expect(BALANCE.permanentMax).toBe(20);
 expect(PERMANENT.attack.step).toBe(.06);
 expect(Array.from({length:6},(_,level)=>upgradeCost(level))).toEqual([20,40,60,90,120,160]);
 for(let level=0;level<20;level++) expect(upgradeCost(level)%10).toBe(0);
});
it('migrates previous ranks once preserving their bonus, investment and records',()=>{const a=parseSave(JSON.stringify({version:1,gold:55,invested:200,upgrades:{attack:5,hp:3},bestTime:340}));expect(a.upgrades.attack).toBe(10);expect(a.upgrades.hp).toBe(6);expect(a.invested).toBe(200);expect(a.gold).toBe(55);expect(parseSave(JSON.stringify(a))).toEqual(a);});
