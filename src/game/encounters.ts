import { BALANCE, CAMPAIGN, PICKUPS } from './config';
import { clamp } from './math';
import type { EnemyKind } from './types';
export const openingProgress = (seconds: number) => clamp(seconds / 120, 0, 1);
// A continuous arrival rate avoids the old 65-second jumps in simultaneous spawns.
export function spawnInterval(seconds: number): number {
 if (seconds >= CAMPAIGN.finalAt) return CAMPAIGN.reinforcementInterval;
 const openingPace = 1 + .65 * (1 - openingProgress(seconds));
 const normal = Math.max(BALANCE.minSpawnInterval, 1 / (1 / BALANCE.spawnInterval + Math.max(0, seconds) * BALANCE.spawnRateRamp)) * openingPace;
 const approach = clamp((seconds - CAMPAIGN.approachAt) / (CAMPAIGN.finalAt - CAMPAIGN.approachAt), 0, 1);
 return normal / (1 - approach * 2 / 3);
}

export const MIDDLE_BOSS_WAVES = [
 { at: 120, enemies: [{ kind: 'boss', x: .5, hp: 1.14 }], damageScale: 1, xpScale: 1, firstKillXp: 1, chestGold: PICKUPS.firstChestGold, title: '그롬 등장' },
 { at: 240, enemies: [{ kind: 'boss', x: .25, hp: .64 }, { kind: 'boss', x: .75, hp: .64 }], damageScale: .82, xpScale: .64, firstKillXp: 1.25, chestGold: 100, title: '그롬 두 마리 등장' },
 { at: 360, enemies: [{ kind: 'boss', x: .25, hp: .86 }, { kind: 'briar', x: .75, hp: .85 }], damageScale: .82, xpScale: .8, firstKillXp: 1.4, chestGold: 120, title: '그롬과 바르크 등장' },
 { at: 480, enemies: [{ kind: 'boss', x: .17, hp: .56 }, { kind: 'briar', x: .39, hp: .59 }, { kind: 'boss', x: .61, hp: .56 }, { kind: 'briar', x: .83, hp: .59 }], damageScale: .65, xpScale: .56, firstKillXp: 1.5, chestGold: 80, title: '그롬 둘과 바르크 둘 등장' },
] as const;
export const FOREST_ENCOUNTERS: { from: number; mix: [EnemyKind, number][] }[] = [
 { from: 0, mix: [['slime', 1]] },
 { from: 22, mix: [['slime', .78], ['goblin', .22]] },
 { from: 50, mix: [['slime', .63], ['goblin', .25], ['bat', .12]] },
 { from: 95, mix: [['slime', .50], ['goblin', .27], ['bat', .13], ['skeleton', .10]] },
 { from: 145, mix: [['slime', .32], ['goblin', .28], ['bat', .2], ['skeleton', .2]] },
 { from: 240, mix: [['goblin', .25], ['bat', .26], ['skeleton', .30], ['brute', .19]] },
 { from: 390, mix: [['goblin', .17], ['bat', .21], ['skeleton', .2], ['brute', .35], ['shaman', .07]] },
 { from: 510, mix: [['bat', .29], ['skeleton', .22], ['brute', .41], ['shaman', .08]] },
];
export function chooseEnemyKind(seconds: number, random: () => number): EnemyKind {
 const encounter = [...FOREST_ENCOUNTERS].reverse().find(e => seconds >= e.from) ?? FOREST_ENCOUNTERS[0]; let roll = random();
 for (const [kind, weight] of encounter.mix) { roll -= weight; if (roll <= 0) return kind; } return encounter.mix.at(-1)![0];
}

export const FOREST_PHASES = [
 { from: 0, name: '숲의 입구', hint: '이동과 무기 강화 · 떨어진 아이템은 접근해서 획득' },
 { from: 120, name: '가시의 오솔길', hint: '그롬 등장 · 돌진 예고를 피하세요' },
 { from: 240, name: '갑주의 행진', hint: '그롬 두 마리 등장 · 갑주병 출현' },
 { from: 360, name: '황혼의 포위', hint: '그롬과 바르크 등장 · 포격 예고를 피하세요' },
 { from: 480, name: '뿌리의 심장', hint: '그롬 둘과 바르크 둘 등장 · 10:00 모르바 출현' },
 { from: 600, name: '모르바의 결계', hint: '100초 안에 모르바를 처치하세요 · 소규모 증원' },
];
export const encounterPhase = (seconds: number) => [...FOREST_PHASES].reverse().find(p => seconds >= p.from) ?? FOREST_PHASES[0];
