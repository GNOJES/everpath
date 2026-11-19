import type { HeroConfig, HeroId, EnemyKind, SkillConfig, PermanentId, PassiveId } from './types';
export const WORLD = { width: 432, height: 768, scrollSpeed: 22, playerRadius: 12, minY: 38, margin: 22, joystickRadius: 48, joystickDeadzone: 7, invincibility: .8, maxEnemies: 100, maxProjectiles: 180, maxEffects: 60, maxHazards: 12 };
export const BALANCE = { bossAt: 180, bossEvery: 180, firstSpawn: 0, spawnInterval: 1.05, minSpawnInterval: .23, spawnRateRamp: .0045, initialXp: 16, xpGrowth: 1.18, xpIncrement: 4, weaponMax: 5, skillMax: 3, passiveMax: 5, permanentMax: 20, baseCost: 24, costGrowth: 1.5, powerStep: .15, hasteStep: .1, vitalityStep: .18, speedStep: .08, weaponDamageStep: .24, weaponHasteStep: .08, weaponRangeStep: .09, eliteAfter: 80, goldPerKill: .75, bossGold: 40, bossXp: 40, enemyHpGrowth: .0056, enemySpeedGrowth: .0008, maxEnemySpeedScale: 1.8, recoveryChoiceThreshold: .45, healOnLevel: .08, skillDamageStep: .4, skillHasteStep: .12, skillRadiusStep: 16 };
export const HEROES: Record<HeroId, HeroConfig> = {
 warrior: { id: 'warrior', name: '로완', title: 'THE VANGUARD', role: '전사', description: '전방 검격으로 탄환을 지우고 적과 부딪힐 때 피해를 줄입니다.', weapon: '새벽의 검', upgradeDescription: '강한 전방 검격. 강화하면 부채꼴이 넓어지며 5레벨부터 탄환을 최대 두 개 지웁니다.', icon: 'sword', color: '#efae35', hp: 160, speed: 149, damage: 23, cooldown: .88, range: 104, projectileSpeed: 320, skills: ['whirl', 'blade', 'shield'], bars: [5, 3, 3] },
 archer: { id: 'archer', name: '린', title: 'THE WAYFARER', role: '궁수', description: '가장 빠르게 이동하며 일직선의 적을 연속으로 관통합니다.', weapon: '바람의 활', upgradeDescription: '적 둘을 관통하며 두 번째 적은 피해가 줄어듭니다. 3·5레벨에 같은 직선으로 후속 화살을 발사합니다.', icon: 'bow', color: '#f47153', hp: 134, speed: 190, damage: 17, cooldown: .35, range: 310, projectileSpeed: 390, skills: ['multishot', 'pierce', 'rain'], bars: [2, 5, 4] },
 mage: { id: 'mage', name: '엘라', title: 'THE ARCANIST', role: '마법사', description: '적 하나에 주문을 집중하고 해골 궁수의 화살 피해를 줄입니다.', weapon: '별빛 지팡이', upgradeDescription: '단일 유도탄. 레벨이 오르면 피해·사거리·공격 속도가 증가합니다.', icon: 'staff', color: '#7583e8', hp: 132, speed: 146, damage: 48, cooldown: .55, range: 290, projectileSpeed: 290, skills: ['chain', 'fire', 'frost'], bars: [2, 3, 5] },
};
export const SKILLS: Record<string, SkillConfig> = {
 whirl: { name: '휩쓸기', subtitle: 'WHIRLWIND', description: '전방에 넓은 검격을 가합니다. 강화하면 부채꼴과 피해가 증가합니다.', icon: 'whirl', color: '#dfc183', cooldown: 5, damage: 1.6, radius: 115, count: 1 },
 blade: { name: '검기 발사', subtitle: 'DAWNBLADE', description: '적을 관통하는 검기를 발사합니다. 레벨마다 검기가 추가됩니다.', icon: 'sword', color: '#9fd9d0', cooldown: 4.4, damage: 1.65, radius: 12, count: 1 },
 shield: { name: '수호의 방패', subtitle: 'OAKHEART', description: '피해를 한 번 막는 보호막. 레벨이 오르면 재충전이 빨라지며 중첩되지 않습니다.', icon: 'shield', color: '#e1c988', cooldown: 13, hastePerLevel: .65, damage: 0, radius: 28, count: 1 },
 multishot: { name: '다중 화살', subtitle: 'WIND VOLLEY', description: '적을 향해 부채꼴로 추가 화살을 발사합니다.', icon: 'volley', color: '#f4795f', cooldown: 2.6, damage: 2.0, radius: 7, count: 3 },
 pierce: { name: '관통 화살', subtitle: 'TRUEFLIGHT', description: '일직선의 적들을 꿰뚫는 강력한 화살을 발사합니다.', icon: 'arrow', color: '#f1cc82', cooldown: 3.65, damage: 4, radius: 9, count: 1 },
 rain: { name: '화살비', subtitle: 'SKYFALL', description: '적이 밀집한 곳을 조준해 잠시 후 화살비를 쏟아냅니다.', icon: 'rain', color: '#a5d7b5', cooldown: 3.75, damage: 4.2, radius: 102, count: 1 },
 chain: { name: '집중 낙뢰', subtitle: 'STORMTHREAD', description: '대상 하나에 강한 번개를 내리칩니다.', icon: 'bolt', color: '#a4c8f3', cooldown: 2.15, damage: 3.4, radius: 165, count: 3 },
 fire: { name: '화염 낙인', subtitle: 'EMBERBLOOM', description: '한 대상에 화염을 집중시킵니다.', icon: 'flame', color: '#f0a376', cooldown: 2.7, damage: 4.0, radius: 78, count: 1 },
 frost: { name: '냉기 오라', subtitle: 'WINTERVEIL', description: '주변 적을 늦추고 가장 가까운 적 하나에 냉기 피해를 줍니다.', icon: 'snow', color: '#a6dcd9', cooldown: .83, damage: 1.0, radius: 102, count: 1 },
};
export const ENEMIES: Record<EnemyKind, { hp: number; speed: number; damage: number; radius: number; xp: number; name: string }> = {
 slime: { hp: 30, speed: 27, damage: 9, radius: 13, xp: 2, name: '이끼 슬라임' },
 goblin: { hp: 46, speed: 49, damage: 12, radius: 12, xp: 3, name: '가시 고블린' },
 bat: { hp: 24, speed: 63, damage: 8, radius: 10, xp: 2, name: '황혼 박쥐' },
 skeleton: { hp: 52, speed: 29, damage: 13, radius: 12, xp: 4, name: '해골 궁수' },
 brute: { hp: 170, speed: 31, damage: 22, radius: 20, xp: 8, name: '가시 갑주병' },
 shaman: { hp: 80, speed: 26, damage: 16, radius: 13, xp: 6, name: '독안개 주술사' },
 warden: { hp: 69000, speed: 31, damage: 34, radius: 34, xp: 150, name: '모르바 · 뿌리의 군주' },
 boss: { hp: 1800, speed: 34, damage: 25, radius: 29, xp: 40, name: '그롬 · 숲을 삼킨 자' },
};
export const PERMANENT: Record<PermanentId, { name: string; subtitle: string; icon: string; step: number; description: string }> = {
 attack: { name: '힘의 맹세', subtitle: 'MIGHT', icon: 'sword', step: .06, description: '공격력' }, hp: { name: '참나무 심장', subtitle: 'VITALITY', icon: 'heart', step: .06, description: '최대 체력' }, speed: { name: '바람의 걸음', subtitle: 'SWIFTNESS', icon: 'wind', step: .01, description: '이동속도' }, gold: { name: '황금의 축복', subtitle: 'FORTUNE', icon: 'coin', step: .025, description: '골드 획득량' },
};
export const PASSIVES: Record<PassiveId, { name: string; subtitle: string; icon: string; description: string }> = {
 power: { name: '강인한 일격', subtitle: 'MIGHT', icon: 'sword', description: '모든 공격 피해 +15%' }, haste: { name: '신속한 손놀림', subtitle: 'HASTE', icon: 'wind', description: '모든 공격 주기 단축 +10%' }, vitality: { name: '생명의 뿌리', subtitle: 'VITALITY', icon: 'heart', description: '기본 최대 체력 +18%, 체력 회복' }, speed: { name: '가벼운 발걸음', subtitle: 'SWIFTNESS', icon: 'leaf', description: '기본 이동속도 +8%' },
};

export const BOSS_PATTERN = { windup: 1.15, dashSpeed: 265, dashDuration: .62, recover: 1.6, chase: 3.2, slamRadius: 75, slamDelay: 1.35, slamDamage: 1.4 };
export const PAIRED_GRORM = { healthScale: .44, recover: 2.35, slamRadius: 60, archerDamage: .70 };
export const WARRIOR_CONTACT_DAMAGE = .50;
export const MAGE_ARROW_DAMAGE = .25;

export const CAMPAIGN = { finalAt: 600, arenaLimit: 100, clearGold: 300, supplyHeal: .3, arenaHeal: .2, wardenRangedDamage: { archer: .57, mage: .62 }, rankMax: 3 };
export const WARDEN_MAGIC_ARMOR = { lowRankDamage: .44, lowAttackRank: 9, fullAttackRank: 13 };
export const EVOLUTIONS = {
 warrior: { name: '여명의 성검', passive: 'power' as const, damageMultiplier: 1.15, description: '검격 거리 +25%, 검격 각도 +12°, 피해 +15%.' },
 archer: { name: '폭풍의 활', passive: 'haste' as const, damageMultiplier: 1.65, description: '같은 직선에 화살 1발 추가, 관통 5회, 피해 +65%.' },
 mage: { name: '천체의 지팡이', passive: 'power' as const, damageMultiplier: 1.95, description: '단일 마법탄 피해 +95%, 공격 주기 추가 단축.' },
};
export const WARRIOR_WEAPON_STEPS = [2.15, 2.19, 2.23, 2.28, 2.33] as const;
export const warriorSweepAngle = (level: number, evolved: boolean) =>
 (42 + (level - 1) * 5 + (evolved ? 6 : 0)) * Math.PI / 180;

export const isBoss = (kind: EnemyKind) => kind === 'boss' || kind === 'warden';
