import { BALANCE, HEROES, PASSIVES, SKILLS, EVOLUTIONS } from './config';
import type { RunState, Upgrade, PassiveId } from './types';
export function availableUpgrades(run: RunState): Upgrade[] {
 const hero = HEROES[run.hero], options: Upgrade[] = [];
 const evolution = EVOLUTIONS[run.hero];
 if (!run.evolved && run.weaponLevel >= BALANCE.weaponMax && run.passives[evolution.passive] >= 2) options.push({ id: 'evolve', name: evolution.name, subtitle: 'WEAPON EVOLUTION', description: evolution.description, icon: hero.icon, level: 0, max: 1, color: hero.color });
 if (run.weaponLevel < BALANCE.weaponMax) options.push({ id: 'weapon', name: hero.weapon, subtitle: 'WEAPON UPGRADE', description: hero.upgradeDescription, icon: hero.icon, level: run.weaponLevel, max: BALANCE.weaponMax, color: hero.color });
 for (const id of hero.skills) { const skill = SKILLS[id], level = run.skills[id] ?? 0; if (level < BALANCE.skillMax) options.push({ id: `skill:${id}`, ...skill, level, max: BALANCE.skillMax }); }
 for (const id of Object.keys(PASSIVES) as PassiveId[]) if (run.passives[id] < BALANCE.passiveMax) options.push({ id: `passive:${id}`, ...PASSIVES[id], level: run.passives[id], max: BALANCE.passiveMax, color: '#c7c2a0' });
 return options;
}
export function rollUpgrades(run: RunState, random: () => number): Upgrade[] {
 const pool = availableUpgrades(run), result: Upgrade[] = [];
 const evolution = pool.findIndex(option => option.id === 'evolve'); if (evolution >= 0) result.push(...pool.splice(evolution, 1));
 // A low-health level-up keeps one recoverable route, while the other choices stay random.
 if (run.player.hp / run.player.maxHp < BALANCE.recoveryChoiceThreshold) {
  const recovery = pool.findIndex(option => option.id === 'passive:vitality');
  if (recovery >= 0) result.push(...pool.splice(recovery, 1));
 }
 while (result.length < 3 && pool.length) result.push(...pool.splice(Math.min(pool.length - 1, Math.floor(random() * pool.length)), 1));
 return result;
}
