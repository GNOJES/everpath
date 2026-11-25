import { expect, it } from 'vitest';
import { HEROES, SKILLS } from '../src/game/config';
import { GameSimulation } from '../src/game/simulation';
import { parseSave } from '../src/game/save';
import type { CombatSound } from '../src/game/types';
import { COMBAT_SOUNDS } from '../src/game/combat-sounds';

it('has a distinct sound profile for every castable hero skill', () => {
 const profiles = Object.keys(SKILLS).filter(id => id !== 'frost').map(id => COMBAT_SOUNDS[id as CombatSound]);
 expect(profiles.every(Boolean)).toBe(true);
 expect(new Set(profiles.map(profile => JSON.stringify(profile))).size).toBe(profiles.length);
});

for (const {id: hero, skills} of Object.values(HEROES)) {
 it.each(skills.filter(id => id !== 'frost'))('%s emits exactly one cue when it is cast', id => {
  const sim = new GameSimulation(hero, parseSave(null), () => .5);
  const cues: CombatSound[] = [];
  sim.onSound = cue => cues.push(cue);
  sim.state.skills[id] = 3;
  const target = sim.spawnEnemy('brute', 216, id === 'gravity' ? 325 : 465)!;
  target.hp = target.maxHp = 10000;
  sim.update(.05);
  expect(cues.filter(cue => cue === id)).toHaveLength(1);
  sim.update(.05);
  expect(cues.filter(cue => cue === id)).toHaveLength(1);
 });
}

it('plays midboss windup, dash, slam impact and defeat cues at their own triggers', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5);
 const cues: CombatSound[] = [];
 sim.onSound = cue => cues.push(cue);
 const boss = sim.spawnEnemy('boss', 216, 180)!;
 sim.state.player.hp = sim.state.player.maxHp = 100000;
 boss.timer = 0;
 sim.update(.05);
 expect(cues).toEqual(['grormWarn', 'grormVolley']);
 boss.timer = 0;
 sim.update(.05);
 expect(cues.at(-1)).toBe('grormDash');
 boss.timer = 0;
 sim.update(.05);
 expect(cues).not.toContain('grormSlam');
 sim.state.hazards[0].delay = 0;
 sim.update(.05);
 expect(cues.at(-1)).toBe('grormSlam');
 sim.damageEnemy(boss, 1e6);
 expect(cues.at(-1)).toBe('grormDefeat');
});

it('plays distinct final boss attacks and exactly one clear cue', () => {
 const sim = new GameSimulation('mage', parseSave(null), () => .5);
 sim.state.player.hp = sim.state.player.maxHp = 100000;
 const cues: CombatSound[] = [];
 sim.onSound = cue => cues.push(cue);
 const warden = sim.spawnEnemy('warden', 216, 180)!;
 warden.timer = 0;
 sim.update(.05);
 expect(cues).toContain('wardenRoots');
 sim.state.hazards[0].delay = 0;
 warden.timer = 0;
 sim.update(.05);
 expect(cues).toEqual(expect.arrayContaining(['wardenAim', 'wardenSlam']));
 warden.timer = 0;
 sim.update(.05);
 expect(cues.at(-1)).toBe('wardenFan');
 warden.timer = 0;
 sim.update(.05);
 expect(cues.at(-1)).toBe('wardenRing');
 sim.damageEnemy(warden, 1e6);
 sim.damageEnemy(warden, 1e6);
 expect(cues.filter(cue => cue === 'victory')).toHaveLength(1);
});

it('emits the death cue once at lethal damage', () => {
 const sim = new GameSimulation('warrior', parseSave(null));
 const cues: CombatSound[] = [];
 sim.onSound = cue => cues.push(cue);
 sim.damagePlayer(10000);
 sim.damagePlayer(10000);
 expect(cues).toEqual(['defeat']);
});
