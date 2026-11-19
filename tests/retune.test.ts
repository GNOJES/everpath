import { it,expect } from 'vitest';
import { parseSave,upgradeCost } from '../src/game/save';
import { BALANCE,PERMANENT } from '../src/game/config';
it('splits permanent growth into twenty small ranks with unchanged full bonus',()=>{expect(BALANCE.permanentMax).toBe(20);expect(PERMANENT.attack.step).toBe(.06);expect(upgradeCost(5)).toBe(159);});
it('migrates previous ranks once preserving their bonus, investment and records',()=>{const a=parseSave(JSON.stringify({version:1,gold:55,invested:200,upgrades:{attack:5,hp:3},bestTime:340}));expect(a.upgrades.attack).toBe(10);expect(a.upgrades.hp).toBe(6);expect(a.invested).toBe(200);expect(a.gold).toBe(55);expect(parseSave(JSON.stringify(a))).toEqual(a);});
