# 전투 밸런스·장판 가독성·해골 화살·모르바 패턴·음악 전환·회복 개편 설계

## 목표

사용자 피드백 6건을 반영해 전투 가독성·보스 긴장감·성장 체감을 개선하고, 로컬 검증 후 `main` 푸시로 Vercel 운영 웹에 배포한다.

1. **궁수 `폭발 화살(blastArrow)` 조정**: 범위 약 70% 축소 및 최대 강화 기준 동시 중첩 최대 2개 제한
2. **장판 레이어 깊이 및 가독성**: 아군 장판·적 장판·캐릭터·투사체 깊이 분리, 연한 투명도 및 아군/적 색상 분리
3. **해골 궁수 화살 디자인**: 에셋 확인 후 적 전용 화살 텍스처 제작·연결
4. **10분 보스 등장 음악 전환**: 기존 탐험곡 페이드아웃 후 모르바 전용곡(`warden`) 진입
5. **10분 보스 모르바 패턴 강화**: 부채꼴 예고 종료 시 미회피 즉시 피격 수준 강화 + 4패턴 순환
6. **레벨업 체력 회복(`생명의 뿌리`) 개편**: 최대 체력 증가 제거, 고정 `+120 HP` 즉시 회복(최대 5회, 부상 시 등장, HP 30% 미만 확정 보장)

## 상세 설계

### 1. 궁수 `폭발 화살` (`src/game/config.ts`)
- `SKILLS.blastArrow`: `radius: 74 → 52`, `radiusPerLevel: 41 → 29` (1~4단계 반경 `52, 81, 110, 139`, 기존 대비 약 70%).
- `SKILLS.blastArrow`: `cooldown: 4.1 → 6.0`, `hastePerLevel: 0.82 → 0.15`.
  - 최대 4단계(`baseRank=3`, `ATTACK_SKILL_UPGRADE.haste=1.18`), 지속시간 `5초` 기준 재사용 대기시간은 가속 패시브 0단계 `3.91초`, 5단계(`1.5x`) `2.61초`로 동시에 최대 2개까지만 중첩된다.

### 2. 장판 깊이 분리 및 시각 구분 (`src/game/scene.ts`, `src/game/mini-enemies.ts`)
- `ForestScene` 그래픽 계층 분리:
  - `groundFx` (`depth = 10`): 아군 `burn`·`snare` 장판, 아군 `rain` 목표 원, 마법사 `frost` 오라
  - `hazardFx` (`depth = 20`): 적 장판·보스 예고(`renderMiniBossTell`, `renderMiniBossHazard`, 클래식 예고)
  - 기존 `scenery`(`50+y`), `actors/hero`(`100+y`), `shots`(`1600`), 전경 `fx`(`2000` — 타격/검격/화살비 낙하/픽업/피격 피드백) 유지
- 아군 장판 톤·투명도:
  - `burn`: 옅은 금빛-호박색 채우기(`0xffa947`, alpha `0.09`), 가는 점선 테두리(`0xffd17a`, alpha `0.36`), 작은 불씨 점 7개(alpha `0.45`).
  - `snare`: 옅은 세이지-잎빛 채우기(`0x7ad678`, alpha `0.08`), 가는 점선 테두리(`0xb8f29c`, alpha `0.36`), 모서리 가시 틱 4개(alpha `0.34`).
  - `rain` 바닥 원: 옅은 하늘색(`0x4fc3f7` / `0x9be7ff`, alpha `0.07` / `0.38`) 점선 원.

### 3. 해골 궁수 화살 텍스처 (`src/game/art.ts`, `src/game/types.ts`, `src/game/simulation.ts`, `src/game/scene.ts`)
- `src/game/assets/` 및 `docs/art/` 점검 결과 별도 적 화살 PNG가 없어 `art.ts`에 `19×7` 픽셀 스프라이트 `'enemy-arrow'`(어두운 자주빛 윤곽 `#2b1620`, 상아색 대 `#efe3cf`, 붉은 화살촉 `#ff5a48`/`#ffd4b8`, 붉은 깃 `#b82e3d`)를 추가한다.
- `Projectile`에 선택적 `sprite?: 'enemy-arrow'`를 추가해 `kind: 'enemy'` 판정과 전사 쳐내기를 그대로 유지하면서 `skeleton` 발사 시 `sprite`를 지정한다.

### 4. 10분 보스 음악 페이드아웃 전환 (`src/game/audio.ts`)
- `syncMusic`에서 트랙이 `warden`으로 전환될 때 즉시 `stopMusic()` 하지 않고, 나가는 트랙을 전용 `GainNode`로 `0.85초` 동안 지수/선형 페이드아웃 후 정지시키며, 동시에 `warden` 트랙을 페이드아웃 완료 시점(또는 짧은 크로스페이드 종료 후 `0.35초` 페이드인)에 시작한다.
- `beginRun`, `suspend`, `bgm` 변경, `level === 0` 전환 시 예약된 페이드 타이머/노드를 즉시 취소·정리한다.

### 5. 10분 보스(모르바) 패턴 강화 (`src/game/simulation.ts`, `src/game/mini-enemies.ts`)
- `moveWarden`의 `wardenAttack % 4` 4패턴 순환 및 주기 단축(`2.7/2.1초 → 2.35/1.85초`):
  - `0` (`wardenRoots`): 뿌리 장판 2개(광폭 3개), 예고 `1.05초 / 1.35초`
  - `1` (`wardenAim` → `wardenFan`): `0.90초`(광폭 `0.78초`) 부채꼴 예고 + `renderFan` 진행 채움 표시. 예고 종료 즉시 245px 부채꼴 범위 안 플레이어 직접 피격 판정 + 고속 부채꼴 탄환 5발(`520` / 광폭 `620`) 발사
  - `2` (`wardenRing`): 10/14발 방사 탄환 속도 상향(`165` / 광폭 `205`) + 광폭 시 추가 뿌리 장판
  - `3` (신규 십자·삼각 뿌리 쇄도): 플레이어 주변 이동 경로를 조이는 3연동 뿌리 장판(`0.95초` 예고) + 2발 조준탄(`260`) 발사

### 6. 레벨업 체력 회복 (`src/game/config.ts`, `src/game/progression.ts`, `src/game/simulation.ts`)
- `BALANCE.vitalityHeal = 120`, `BALANCE.recoveryChoiceThreshold = 0.30`.
- `PASSIVES.vitality.description`: `'체력 즉시 +120 회복'`.
- `availableUpgrades`: `run.player.hp < run.player.maxHp`일 때만 `passive:vitality` 포함(최대 5회 유지).
- `rollUpgrades`: `hp / maxHp < 0.30`일 때 `passive:vitality` 확정 포함.
- `chooseUpgrade('passive:vitality')`: `maxHp` 변경 없이 `hp = Math.min(maxHp, hp + 120)` 회복.
