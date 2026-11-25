import type { HeroConfig, HeroId, EnemyKind, SkillConfig, PermanentId, PassiveId } from './types';
export const DEFAULT_SFX_VOLUME = .7;
export const WORLD = { width: 432, height: 768, scrollSpeed: 42, enemyDrift: 2.8, playerRadius: 12, minY: 38, margin: 22, joystickRadius: 48, joystickDeadzone: 7, invincibility: .2, maxEnemies: 100, maxProjectiles: 180, maxEffects: 60, maxHazards: 12 };
export const BALANCE = { firstSpawn: 0, spawnInterval: .96, minSpawnInterval: .39, spawnRateRamp: .0032, initialXp: 16, xpGrowth: 1.18, xpIncrement: 4, weaponMax: 5, skillMax: 3, passiveMax: 5, speedMax: 3, permanentMax: 20, baseCost: 24, costGrowth: 1.5, powerStep: .15, hasteStep: .1, vitalityStep: .18, speedStep: .18, weaponDamageStep: .13, weaponHasteStep: .08, weaponRangeStep: .06, weaponEvolutionDamage: 1.15, eliteAfter: 80, goldPerKill: 1.08, regularXpScale: 1.42, bossGold: 40, bossXp: 40, enemyHpGrowth: .0044, enemySpeedGrowth: .0008, maxEnemySpeedScale: 1.8, recoveryChoiceThreshold: .45, skillDamageStep: .4, skillHasteStep: .12, skillRadiusStep: 16 };
export const HEROES: Record<HeroId, HeroConfig> = {
 warrior: { id: 'warrior', name: '로완', title: 'THE VANGUARD', role: '전사', description: '새벽의 검으로 적을 밀고, 다가오는 탄환을 자동으로 쳐냅니다.', weapon: '새벽의 검', upgradeDescription: '강한 전방 검격으로 일반 적을 밀어냅니다. 검격이 닿는 탄환을 쳐냅니다. 1·3·5레벨과 진화에서 최대 1·2·3·4발을 막습니다.', icon: 'sword', color: '#efae35', hp: 285, speed: 168, weaponDamage: 17.8, skillPower: 5.2, cooldown: 1.1, range: 98, projectileSpeed: 320, skills: ['whirl', 'blade', 'shield', 'bash', 'lunge', 'quake', 'sunder'], bars: [5, 3, 3] },
 archer: { id: 'archer', name: '린', title: 'THE WAYFARER', role: '궁수', description: '빠르고 약한 화살로 거리를 유지합니다. 활을 강화하면 적을 관통합니다.', weapon: '바람의 활', upgradeDescription: '1레벨은 적 하나에 명중합니다. 2레벨부터 관통합니다. 좁은 직선으로 화살 한 발을 쏘며, 강화할수록 더 많은 적을 관통합니다.', icon: 'bow', color: '#f47153', hp: 235, speed: 190, weaponDamage: 9.6, skillPower: 6.0, cooldown: .78, range: 410, projectileSpeed: 390, skills: ['multishot', 'pierce', 'rain', 'snare', 'ricochet', 'blastArrow', 'deadeye'], bars: [2, 5, 4] },
 mage: { id: 'mage', name: '엘라', title: 'THE ARCANIST', role: '마법사', description: '유도탄으로 견제하고, 재사용 시간이 긴 강력한 주문으로 적을 제압합니다.', weapon: '별빛 지팡이', upgradeDescription: '단일 유도탄. 레벨이 오르면 피해·사거리·공격 속도가 증가합니다.', icon: 'staff', color: '#7583e8', hp: 190, speed: 177, weaponDamage: 17.6, skillPower: 7.4, cooldown: 1, range: 280, projectileSpeed: 350, skills: ['chain', 'fire', 'frost', 'meteor', 'gravity', 'prism', 'runeCross'], bars: [2, 3, 5] },
};
export const SHIELD_RECHARGE = [40, 30, 20] as const;
export const FROST_AURA = { radius: [110, 122, 134, 146], slow: [.4, .5, .6, .7] } as const;
export const METEOR_SHOWER = { interval: .5, waves: 3, afterglow: .22 };
export const GRAVITY_WELL = { minRange: 150, maxRange: 350, nearGuard: 120, radius: [80, 110, 140, 165] } as const;
export const SKILLS: Record<string, SkillConfig> = {
 whirl: { name: '휩쓸기', subtitle: 'WHIRLWIND', description: '가까운 전방에 강한 검격을 가합니다. 강화하면 공격 범위와 피해가 증가합니다.', icon: 'whirl', color: '#dfc183', cooldown: 5, damage: 3.2, radius: 102, count: 1 },
 blade: { name: '검기 발사', subtitle: 'DAWNBLADE', description: '검기를 발사합니다. 검기마다 최대 4~6명을 관통하며, 관통할 때마다 피해가 10% 줄어듭니다.', icon: 'sword', color: '#9fd9d0', cooldown: 4.4, damage: 1.95, radius: 12, count: 1 },
 shield: { name: '수호의 방패', subtitle: 'OAKHEART', description: '피격 한 번을 막습니다. 방패가 깨진 뒤 기본 40 / 30 / 20초에 다시 충전됩니다.', icon: 'shield', color: '#8ce6ff', cooldown: SHIELD_RECHARGE[0], damage: 0, radius: 32, count: 1 },
 multishot: { name: '다중 화살', subtitle: 'WIND VOLLEY', description: '적을 향해 부채꼴로 추가 화살을 발사합니다.', icon: 'volley', color: '#f4795f', cooldown: 2.6, damage: 2.0, radius: 7, count: 3 },
 pierce: { name: '관통 화살', subtitle: 'TRUEFLIGHT', description: '좁은 직선에 강한 화살 한 발을 쏩니다. 맞는 적 수에 제한이 없습니다.', icon: 'arrow', color: '#f1cc82', cooldown: 7.4, damage: 7.5, radius: 3, count: 1 },
 rain: { name: '화살비', subtitle: 'SKYFALL', description: '적이 밀집한 곳을 조준해 잠시 후 좁은 범위에 화살비를 쏟아냅니다.', icon: 'rain', color: '#a5d7b5', cooldown: 3.75, damage: 4.2, radius: 34, radiusPerLevel: 16 / 3, count: 1 },
 chain: { name: '집중 낙뢰', subtitle: 'STORMTHREAD', description: '사거리 360 안의 가장 가까운 적 하나에 빠르게 번개를 내리칩니다.', icon: 'bolt', color: '#a4c8f3', cooldown: 3.3, hastePerLevel: .28, damage: 9, radius: 360, count: 1 },
 fire: { name: '화염 낙인', subtitle: 'EMBERBLOOM', description: '사거리 350 안에서 가까운 정예를 먼저 맞힙니다. 정예가 없으면 가장 가까운 적을 공격합니다.', icon: 'flame', color: '#f0a376', cooldown: 5.2, hastePerLevel: .24, damage: 16, radius: 350, count: 1 },
 bash: { name: '방패 밀치기', subtitle: 'SHIELD BASH', description: '전방의 일반 적을 멀리 밀어냅니다. 강화하면 밀어내는 거리가 300에서 최대 340까지 늘어납니다.', icon: 'shield', color: '#ffb35a', cooldown: 6.3, damage: 1.3, radius: 86, count: 1 },
 snare: { name: '덫 화살', subtitle: 'SNARE', description: '명중 지점에 3~5초간 덫을 깝니다. 일반 적을 48~80% 감속합니다. 겹치면 가장 강한 덫이 적용됩니다.', icon: 'bow', color: '#81bdaa', cooldown: 5.2, damage: 2.1, radius: 270, count: 1 },
 meteor: { name: '별똥별', subtitle: 'FALLING STAR', description: '화면 안의 적에게 0.5초 간격으로 별똥별 피해를 세 번 줍니다.', icon: 'flame', color: '#fdba72', cooldown: 15, hastePerLevel: .20, damage: 3, radius: 0, count: METEOR_SHOWER.waves },
 frost: { name: '냉기 오라', subtitle: 'WINTERVEIL', description: '마법사를 따라다니는 오라입니다. 범위 안의 일반 적을 상시 40~70% 감속하며 중간보스에는 절반을 적용합니다.', icon: 'snow', color: '#a6dcd9', cooldown: 0, damage: 0, radius: FROST_AURA.radius[0], count: 0, maxRank: FROST_AURA.radius.length },
 lunge: { name: '새벽 찌르기', subtitle: 'DAWN THRUST', description: '범위 안에서 남은 체력이 가장 높은 적을 겨냥해 좁은 직선을 꿰뚫습니다.', icon: 'sword', color: '#ffda88', cooldown: 3.8, damage: 5.2, radius: 186, count: 1, unlockLevel: 4 },
 quake: { name: '지면 강타', subtitle: 'GROUND BREAK', description: '주변 적에게 범위 피해를 주고 일반 적을 1.6초간 48% 느리게 합니다.', icon: 'mountain', color: '#df9862', cooldown: 5.4, hastePerLevel: .3, damage: 4.5, radius: 126, count: 1, unlockLevel: 6 },
 sunder: { name: '갑주 가르기', subtitle: 'SUNDER', description: '범위 안에서 남은 체력이 가장 높은 적 하나를 강하게 벱니다.', icon: 'sword', color: '#f19a63', cooldown: 5.2, hastePerLevel: .4, damage: 19.4, radius: 200, count: 1, unlockLevel: 8 },
 ricochet: { name: '전격 화살', subtitle: 'CHAIN ARROW', description: '전기가 서로 다른 적 3 / 4 / 5 / 6명에게 이어집니다. 튕길 때마다 피해가 10% 감소합니다.', icon: 'bolt', color: '#70d7ff', cooldown: 3.9, hastePerLevel: .3, damage: 3.6, radius: 310, count: 3, unlockLevel: 4 },
 blastArrow: { name: '폭발 화살', subtitle: 'BLAST ARROW', description: '폭발 뒤 3~5초간 불 장판을 남깁니다. 0.5초마다 피해를 주며 장판 피해는 중첩되지 않습니다.', icon: 'flame', color: '#ffa970', cooldown: 4.1, hastePerLevel: .82, damage: 1.6, radius: 74, radiusPerLevel: 41, count: 1, unlockLevel: 6 },
 deadeye: { name: '매의 눈', subtitle: 'DEADEYE', description: '보스, 정예, 일반 적 순으로 조준합니다. 같은 종류에서는 남은 체력이 가장 높은 적을 맞힙니다.', icon: 'compass', color: '#ffdf95', cooldown: 4.5, hastePerLevel: .42, damage: 15, radius: 370, count: 1, unlockLevel: 8 },
 gravity: { name: '중력장', subtitle: 'GRAVITY WELL', description: '거리 150~350에서 가장 먼 일반 적을 중심으로 주변 적을 끌어당깁니다. 피해는 낮고 강화할수록 범위가 넓어집니다.', icon: 'whirl', color: '#c0abff', cooldown: 4.8, damage: 1.5, radius: GRAVITY_WELL.radius[0], count: 1, unlockLevel: 4 },
 prism: { name: '프리즘 광선', subtitle: 'PRISM', description: '가까운 적 최대 셋에게 각각 광선을 쏩니다. 강화하면 대상이 늘어납니다.', icon: 'staff', color: '#b6f4f5', cooldown: 6.2, damage: 6.2, radius: 300, count: 3, unlockLevel: 6 },
 runeCross: { name: '십자 룬', subtitle: 'CROSS RUNE', description: '대상을 중심으로 십자형 룬을 폭발시킵니다.', icon: 'plus', color: '#f5beff', cooldown: 9, damage: 8.0, radius: 96, count: 1, unlockLevel: 8 },
};
export const ENEMIES: Record<EnemyKind, { hp: number; speed: number; damage: number; radius: number; xp: number; name: string }> = {
 slime: { hp: 21, speed: 27, damage: 9, radius: 13, xp: 2, name: '이끼 슬라임' },
 goblin: { hp: 28, speed: 49, damage: 12, radius: 12, xp: 3, name: '가시 고블린' },
 bat: { hp: 19, speed: 63, damage: 8, radius: 10, xp: 2, name: '황혼 박쥐' },
 skeleton: { hp: 32, speed: 29, damage: 13, radius: 12, xp: 4, name: '해골 궁수' },
 brute: { hp: 59, speed: 31, damage: 22, radius: 20, xp: 8, name: '가시 갑주병' },
 shaman: { hp: 33, speed: 26, damage: 16, radius: 13, xp: 6, name: '독안개 주술사' },
 warden: { hp: 12000, speed: 31, damage: 34, radius: 34, xp: 150, name: '모르바 · 뿌리의 군주' },
 boss: { hp: 820, speed: 34, damage: 25, radius: 29, xp: 40, name: '그롬 · 숲을 삼킨 자' },
 briar: { hp: 1700, speed: 26, damage: 22, radius: 27, xp: 40, name: '바르크 · 가시 포격수' },
};
export const PERMANENT: Record<PermanentId, { name: string; subtitle: string; icon: string; step: number; description: string }> = {
 attack: { name: '힘의 맹세', subtitle: 'MIGHT', icon: 'sword', step: .06, description: '공격력' }, hp: { name: '참나무 심장', subtitle: 'VITALITY', icon: 'heart', step: .06, description: '최대 체력' }, speed: { name: '바람의 걸음', subtitle: 'SWIFTNESS', icon: 'wind', step: .01, description: '이동속도' }, gold: { name: '황금의 축복', subtitle: 'FORTUNE', icon: 'coin', step: .025, description: '골드 획득량' },
 timeStop: { name: '시간의 회중시계', subtitle: 'TIME STOP', icon: 'watch', step: 0, description: '시간의 회중시계' },
};
export const PASSIVES: Record<PassiveId, { name: string; subtitle: string; icon: string; description: string }> = {
 power: { name: '강인한 일격', subtitle: 'MIGHT', icon: 'sword', description: '모든 공격 피해 +15%' }, haste: { name: '신속한 손놀림', subtitle: 'HASTE', icon: 'wind', description: '모든 공격 주기 단축 +10%' }, vitality: { name: '생명의 뿌리', subtitle: 'VITALITY', icon: 'heart', description: '기본 최대 체력 +18%, 체력 회복' }, speed: { name: '가벼운 발걸음', subtitle: 'SWIFTNESS', icon: 'leaf', description: `기본 이동속도 +${Math.round(BALANCE.speedStep * 100)}%` },
};

export const BOSS_PATTERN = { windup: 1.15, dashSpeed: 265, dashDuration: .62, recover: 1.6, chase: 3.2, slamRadius: 75, slamDelay: 1.35, slamDamage: 1.4 };
export const PAIRED_GRORM = { recover: 2.15, slamRadius: 60 };
export const FIRST_GRORM = { volleyRange: 150, volleySpeed: 205, volleyDamage: .72 };

export const CAMPAIGN = { finalAt: 600, approachAt: 555, arenaLimit: 100, reinforcementInterval: 4, maxReinforcements: 3, clearGold: 300, arenaHeal: .2, rankMax: 3 };
export const TIME_STOP = { maxCharges: 3, duration: 2, prices: [180, 320, 500] };
export const PICKUPS = { from: 180, healChance: .0017, maxHeals: 2, healFraction: .50, coinChance: .006, coinGold: 9, firstChestGold: 120, pairedChestGold: 85, radius: 30 };
export const permanentLimit = (id: PermanentId) => id === 'timeStop' ? TIME_STOP.maxCharges : BALANCE.permanentMax;
export const EVOLUTIONS = {
 warrior: { name: '여명의 성검', passive: 'power' as const, description: '검격 거리 +25%, 검격 각도 +6°, 최대 4발 방어, 피해 +15%.' },
 archer: { name: '폭풍의 활', passive: 'haste' as const, description: '최대 5대상을 관통하며 피해가 15% 증가합니다.' },
 mage: { name: '천체의 지팡이', passive: 'power' as const, description: '단일 유도탄 피해 +15%, 공격 주기 단축.' },
};
export const WARRIOR_PARRY = { cooldown: .65, lookahead: .2 };
export const BLAST_ARROW_AIM_RANGE = 310;
export const ARCHER_FIELDS = {
 duration: [3, 3.5, 4, 5], snareSlow: [.48, .58, .68, .8],
 snareRadius: 62, snareRadiusStep: 6, burnInterval: .5, burnDamageScale: .3,
} as const;
export const ATTACK_SKILL_UPGRADE = {
 rank: BALANCE.skillMax + 1, damage: 1.32, haste: 1.18,
 description: '이 스킬의 피해 +32%, 발동 빈도 +18%.',
};
export const skillRankLimit = (skill: SkillConfig) => skill.maxRank ?? (skill.damage > 0 ? ATTACK_SKILL_UPGRADE.rank : BALANCE.skillMax);
export const warriorSweepAngle = (level: number, evolved: boolean) =>
 (25 + (level - 1) * 2 + (evolved ? 3 : 0)) * Math.PI / 180;

export const isBoss = (kind: EnemyKind) => kind === 'boss' || kind === 'briar' || kind === 'warden';
