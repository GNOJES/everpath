import { BALANCE, HEROES, PASSIVES, SKILLS, EVOLUTIONS, FROST_AURA, ATTACK_SKILL_UPGRADE, skillRankLimit } from './config';
import type { RunState, Upgrade, PassiveId } from './types';
const reserveChoices: Upgrade[] = [
 { id: 'reserve:gold', name: '골드', subtitle: '', description: '원정 골드 +8', icon: 'coin', level: 0, max: 0, color: '#a36a28' },
 { id: 'reserve:hp', name: '최대 체력', subtitle: '', description: '이번 원정의 최대 체력 +4', icon: 'heart', level: 0, max: 0, color: '#ae4b56' },
 { id: 'reserve:speed', name: '이동 속도', subtitle: '', description: '이번 원정의 이동 속도 +3', icon: 'wind', level: 0, max: 0, color: '#53689d' },
];
export function availableUpgrades(run: RunState): Upgrade[] {
 const hero = HEROES[run.hero], options: Upgrade[] = [];
 const evolution = EVOLUTIONS[run.hero];
 if (!run.evolved && run.weaponLevel >= BALANCE.weaponMax && run.passives[evolution.passive] >= 2) options.push({ id: 'evolve', name: evolution.name, subtitle: 'WEAPON EVOLUTION', description: evolution.description, icon: hero.icon, level: 0, max: 1, color: hero.color });
 if (run.weaponLevel < BALANCE.weaponMax) options.push({ id: 'weapon', name: hero.weapon, subtitle: 'WEAPON UPGRADE', description: hero.upgradeDescription, icon: hero.icon, level: run.weaponLevel, max: BALANCE.weaponMax, color: hero.color });
 for (const id of hero.skills) {
  const skill = SKILLS[id], level = run.skills[id] ?? 0, max = skillRankLimit(skill);
  if (run.level < (skill.unlockLevel ?? 1) || level >= max) continue;
  let description = skill.description;
  if (id === 'frost' && level > 0) {
   const slow = Math.round(FROST_AURA.slow[level] * 100);
   description = `오라 반경 ${FROST_AURA.radius[level - 1]} → ${FROST_AURA.radius[level]}. 일반 적 ${slow}%, 중간보스 ${slow / 2}% 감속.`;
  } else if (level === BALANCE.skillMax) {
   description = ATTACK_SKILL_UPGRADE.description;
   if (id === 'chain') description += ' 처치 시 다음 낙뢰 대기 시간 절반.';
   if (id === 'ricochet') description += ' 최대 명중 대상 5 → 6명.';
   if (id === 'snare') description += ' 덫 4 → 5초, 감속 68 → 80%.';
   if (id === 'blastArrow') description += ' 불 장판 4 → 5초.';
   if (id === 'gravity') description += ' 중력장 반경 140 → 165.';
  }
  options.push({ id: `skill:${id}`, ...skill, level, max, description });
 }
 for (const id of Object.keys(PASSIVES) as PassiveId[]) {
  if (id === 'vitality' && run.player.hp >= run.player.maxHp) continue;
  const max = id === 'speed' ? BALANCE.speedMax : BALANCE.passiveMax;
  if (run.passives[id] < max) options.push({ id: `passive:${id}`, ...PASSIVES[id], level: run.passives[id], max, color: '#c7c2a0' });
 }
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
 const unlockLevel = (option: Upgrade) => SKILLS[option.id.slice(6)]?.unlockLevel;
 const isFinalSkillRank = (option: Upgrade) => option.id.startsWith('skill:') && option.level === BALANCE.skillMax;
 const regular = pool.filter(option => !isFinalSkillRank(option) && !unlockLevel(option));
 const advanced = pool.filter(option => !isFinalSkillRank(option) && unlockLevel(option));
 const finalRanks = pool.filter(isFinalSkillRank);
 const featured = advanced.find(option => unlockLevel(option) === run.level)
  ?? (advanced.length && run.level >= 9 && run.level % 3 === 0 ? advanced[(run.level / 3 - 3) % advanced.length] : undefined)
  ?? (finalRanks.length ? finalRanks[run.level % finalRanks.length] : undefined);
 if (featured) result.push(featured);
 for (const candidates of [regular, advanced.filter(option => option !== featured), finalRanks.filter(option => option !== featured)]) {
  while (result.length < 3 && candidates.length) result.push(...candidates.splice(Math.min(candidates.length - 1, Math.floor(random() * candidates.length)), 1));
 }
 return [...result, ...reserveChoices].slice(0, 3);
}
