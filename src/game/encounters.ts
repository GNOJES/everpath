import { BALANCE, CAMPAIGN } from './config';
import { clamp } from './math';
import type { EnemyKind } from './types';
// A continuous arrival rate avoids the old 65-second jumps in simultaneous spawns.
export function spawnInterval(seconds: number): number {
 const normal = Math.max(BALANCE.minSpawnInterval, 1 / (1 / BALANCE.spawnInterval + Math.max(0, seconds) * BALANCE.spawnRateRamp));
 const approach = clamp((seconds - CAMPAIGN.approachAt) / (CAMPAIGN.finalAt - CAMPAIGN.approachAt), 0, 1);
 return normal / (1 - approach * .84);
}
export const FOREST_ENCOUNTERS: { from: number; mix: [EnemyKind, number][] }[] = [
 { from: 0, mix: [['slime', 1]] },
 { from: 16, mix: [['slime', .65], ['goblin', .35]] },
 { from: 38, mix: [['slime', .4], ['goblin', .35], ['bat', .25]] },
 { from: 85, mix: [['slime', .32], ['goblin', .28], ['bat', .2], ['skeleton', .2]] },
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
 { from: 120, name: '가시의 오솔길', hint: '3:00 그롬 · 무기와 보조스킬을 집중 강화' },
 { from: 240, name: '갑주의 행진', hint: '갑주병 등장 · 무기5 + 진화 패시브2 준비' },
 { from: 360, name: '황혼의 포위', hint: '그롬 두 마리 · 주술사의 독 장판을 피하세요' },
 { from: 480, name: '뿌리의 심장', hint: '10:00 모르바 출현' },
 { from: 600, name: '모르바의 결계', hint: '100초 안에 뿌리의 군주를 처치하세요' },
];
export const encounterPhase = (seconds: number) => [...FOREST_PHASES].reverse().find(p => seconds >= p.from) ?? FOREST_PHASES[0];
