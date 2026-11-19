import type { HeroConfig, HeroId, EnemyKind, SkillConfig, PermanentId, PassiveId } from './types';
export const WORLD = { width: 432, height: 768, scrollSpeed: 22, playerRadius: 12, minY: 38, margin: 22, joystickRadius: 48, joystickDeadzone: 7, invincibility: .8, maxEnemies: 100, maxProjectiles: 180, maxEffects: 60, maxHazards: 12 };
export const BALANCE = { bossAt: 180, bossEvery: 180, firstSpawn: 0, spawnInterval: 1.4, minSpawnInterval: .25, spawnRateRamp: .0051, initialXp: 16, xpGrowth: 1.18, xpIncrement: 4, weaponMax: 5, skillMax: 3, passiveMax: 5, permanentMax: 20, baseCost: 24, costGrowth: 1.5, powerStep: .15, hasteStep: .1, vitalityStep: .18, speedStep: .08, weaponShotSpacing: 8, weaponDamageStep: .24, weaponHasteStep: .08, weaponRangeStep: .09, eliteAfter: 80, goldPerKill: 1, bossGold: 40, bossXp: 40, enemyHpGrowth: .0065, enemySpeedGrowth: .0008, maxEnemySpeedScale: 1.8, recoveryChoiceThreshold: .45, healOnLevel: .08, skillDamageStep: .4, skillHasteStep: .12, skillRadiusStep: 16 };
export const HEROES: Record<HeroId, HeroConfig> = {
 warrior: { id: 'warrior', name: '로완', title: 'THE VANGUARD', role: '전사', description: '가까운 적을 베고 검격마다 적 탄환 하나를 지웁니다.', weapon: '새벽의 검', upgradeDescription: '피해 +24%, 공격 주기 단축, 사거리 증가. 5레벨에 검격이 전 방향을 휩씁니다.', icon: 'sword', color: '#dfb875', hp: 160, speed: 137, damage: 23, cooldown: .98, range: 82, projectileSpeed: 320, skills: ['whirl', 'blade', 'shield'], bars: [5, 3, 3] },
 archer: { id: 'archer', name: '린', title: 'THE WAYFARER', role: '궁수', description: '빠르게 움직이며 먼 거리에서 화살을 쏩니다.', weapon: '바람의 활', upgradeDescription: '피해 +24%, 공격 주기 단축, 사거리 증가. 3·5레벨에 화살 추가, 4레벨에 관통을 얻습니다.', icon: 'bow', color: '#9dca95', hp: 105, speed: 168, damage: 20, cooldown: .52, range: 310, projectileSpeed: 390, skills: ['multishot', 'pierce', 'rain'], bars: [2, 5, 4] },
 mage: { id: 'mage', name: '엘라', title: 'THE ARCANIST', role: '마법사', description: '유도 마법탄과 범위 주문으로 적 무리를 공격합니다.', weapon: '별빛 지팡이', upgradeDescription: '피해 +24%, 공격 주기 단축, 사거리 증가. 3·5레벨에 마법탄 추가, 5레벨에 범위 폭발을 얻습니다.', icon: 'staff', color: '#b5a5de', hp: 85, speed: 139, damage: 24, cooldown: 1.07, range: 285, projectileSpeed: 215, skills: ['chain', 'fire', 'frost'], bars: [2, 3, 5] },
};
export const SKILLS: Record<string, SkillConfig> = {
 whirl: { name: '회전베기', subtitle: 'WHIRLWIND', description: '주변을 휩쓰는 검의 소용돌이. 레벨마다 범위와 피해가 증가합니다.', icon: 'whirl', color: '#dfc183', cooldown: 5, damage: 1.6, radius: 115, count: 1 },
 blade: { name: '검기 발사', subtitle: 'DAWNBLADE', description: '적을 관통하는 검기를 발사합니다. 레벨마다 검기가 추가됩니다.', icon: 'sword', color: '#9fd9d0', cooldown: 4.4, damage: 1.65, radius: 12, count: 1 },
 shield: { name: '수호의 방패', subtitle: 'OAKHEART', description: '피해를 한 번 막는 보호막. 레벨이 오르면 재충전이 빨라지며 중첩되지 않습니다.', icon: 'shield', color: '#e1c988', cooldown: 13, hastePerLevel: .65, damage: 0, radius: 28, count: 1 },
 multishot: { name: '다중 화살', subtitle: 'WIND VOLLEY', description: '적을 향해 부채꼴로 추가 화살을 발사합니다.', icon: 'volley', color: '#b8d796', cooldown: 3.4, damage: 1.6, radius: 7, count: 3 },
 pierce: { name: '관통 화살', subtitle: 'TRUEFLIGHT', description: '일직선의 적들을 꿰뚫는 강력한 화살을 발사합니다.', icon: 'arrow', color: '#f1cc82', cooldown: 4.6, damage: 4, radius: 9, count: 1 },
 rain: { name: '화살비', subtitle: 'SKYFALL', description: '적이 밀집한 곳을 조준해 잠시 후 화살비를 쏟아냅니다.', icon: 'rain', color: '#a5d7b5', cooldown: 5.5, damage: 3.4, radius: 94, count: 1 },
 chain: { name: '연쇄 번개', subtitle: 'STORMTHREAD', description: '가까운 적들 사이로 번개가 전이됩니다. 레벨마다 전이 수가 증가합니다.', icon: 'bolt', color: '#a4c8f3', cooldown: 4.5, damage: 1.2, radius: 165, count: 3 },
 fire: { name: '화염 폭발', subtitle: 'EMBERBLOOM', description: '적이 모인 지점에서 화염이 폭발해 넓은 범위에 피해를 줍니다.', icon: 'flame', color: '#f0a376', cooldown: 5.8, damage: 1.8, radius: 78, count: 1 },
 frost: { name: '냉기 오라', subtitle: 'WINTERVEIL', description: '주변의 적에게 주기적인 냉기 피해를 주고 이동을 늦춥니다.', icon: 'snow', color: '#a6dcd9', cooldown: 1.28, damage: .32, radius: 84, count: 1 },
};
export const ENEMIES: Record<EnemyKind, { hp: number; speed: number; damage: number; radius: number; xp: number; name: string }> = {
 slime: { hp: 30, speed: 27, damage: 9, radius: 13, xp: 2, name: '이끼 슬라임' },
 goblin: { hp: 46, speed: 49, damage: 12, radius: 12, xp: 3, name: '가시 고블린' },
 bat: { hp: 24, speed: 63, damage: 8, radius: 10, xp: 2, name: '황혼 박쥐' },
 skeleton: { hp: 52, speed: 29, damage: 13, radius: 12, xp: 4, name: '해골 궁수' },
 brute: { hp: 170, speed: 31, damage: 22, radius: 20, xp: 8, name: '가시 갑주병' },
 shaman: { hp: 80, speed: 26, damage: 16, radius: 13, xp: 6, name: '독안개 주술사' },
 warden: { hp: 58000, speed: 31, damage: 34, radius: 34, xp: 150, name: '모르바 · 뿌리의 군주' },
 boss: { hp: 1800, speed: 34, damage: 25, radius: 29, xp: 40, name: '그롬 · 숲을 삼킨 자' },
};
export const PERMANENT: Record<PermanentId, { name: string; subtitle: string; icon: string; step: number; description: string }> = {
 attack: { name: '힘의 맹세', subtitle: 'MIGHT', icon: 'sword', step: .06, description: '공격력' }, hp: { name: '참나무 심장', subtitle: 'VITALITY', icon: 'heart', step: .06, description: '최대 체력' }, speed: { name: '바람의 걸음', subtitle: 'SWIFTNESS', icon: 'wind', step: .01, description: '이동속도' }, gold: { name: '황금의 축복', subtitle: 'FORTUNE', icon: 'coin', step: .025, description: '골드 획득량' },
};
export const PASSIVES: Record<PassiveId, { name: string; subtitle: string; icon: string; description: string }> = {
 power: { name: '강인한 일격', subtitle: 'MIGHT', icon: 'sword', description: '모든 공격 피해 +15%' }, haste: { name: '신속한 손놀림', subtitle: 'HASTE', icon: 'wind', description: '모든 공격 주기 단축 +10%' }, vitality: { name: '생명의 뿌리', subtitle: 'VITALITY', icon: 'heart', description: '기본 최대 체력 +18%, 체력 회복' }, speed: { name: '가벼운 발걸음', subtitle: 'SWIFTNESS', icon: 'leaf', description: '기본 이동속도 +8%' },
};

export const BOSS_PATTERN = { windup: 1.15, dashSpeed: 265, dashDuration: .62, recover: 1.6, chase: 3.2, slamRadius: 94, slamDelay: .9, slamDamage: 1.4 };

export const CAMPAIGN = { finalAt: 600, arenaLimit: 100, clearGold: 300, supplyHeal: .3, rankMax: 3 };
export const EVOLUTIONS = {
 warrior: { name: '여명의 성검', passive: 'power' as const, description: '검격 범위 +25%, 피해 +65%, 공격 주기 추가 단축.' },
 archer: { name: '폭풍의 활', passive: 'haste' as const, description: '화살 2발 추가, 관통 4회, 피해 +65%.' },
 mage: { name: '천체의 지팡이', passive: 'power' as const, description: '마법탄 1발 추가, 폭발 범위 확대, 피해 +65%.' },
};
export const isBoss = (kind: EnemyKind) => kind === 'boss' || kind === 'warden';
