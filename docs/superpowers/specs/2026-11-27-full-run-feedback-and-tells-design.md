# 전 구간 전투 피드백·주술사·보스 탄환·드랍·진화 연출 설계

## 목표

1번 묶음(전투 가독성과 손맛 개선)의 3가지 축을 기존 밸런스·직접 접촉 회수 규칙(`PICKUPS.radius = 30`)을 보존한 채 구현한다.

1. **전 구간 전투 피드백 확장**: 첫 그롬(2분)까지만 동작하던 피격 원인 방향 그래픽·기본 타격 섬광/타격음·보물 상자 펄스/화살표를 4·6·8분 중간보스 및 10분 모르바전까지 전 원정으로 확장한다.
2. **독안개 주술사·보스 탄환 시각/음향 차별화**: 6분 30초 이후 등장하는 `shaman`의 독장판 예고/파열 그래픽과 효과음을 분리하고, 첫 그롬과 모르바의 적 탄환에 전용 픽셀 스프라이트를 연결한다.
3. **동전·회복약·무기 진화 연출**: 동전(`coin`)·회복 아이템(`heal`) 획득 시 전용 효과음과 작은 링 파장을 추가하고, 무기 진화(`evolve`) 시 전용 팡파르·빛기둥 이펙트·각성 무기명 텍스트를 추가한다.

## 상세 설계

### 1. 전 구간 피격 방향·기본 타격·다중 상자 피드백
- **`src/game/types.ts` (`CombatFeedback`)**:
  - 기존 `'firstChest'`(2분 상자 하위 호환)를 유지하면서 4·6·8분 중간보스 상자를 알리는 `{ kind: 'chest'; pickup: Pickup }` 추가.
- **`src/game/simulation.ts` (`dropPickup`)**:
  - `isBoss(enemy.kind)`로 상자가 생성될 때 `enemy.middleWave === MIDDLE_BOSS_WAVES[0].at ? 'firstChest' : 'chest'` 이벤트 발송.
- **`src/game/opening-feedback.ts` (`OpeningFeedback`)**:
  - 단일 `chest?: Pickup` 대신 `chests = new Set<Pickup>()`로 4·6·8분 다중 상자를 동시 추적.
  - `'firstChest'`일 때만 기존 동작대로 `this.hurt = undefined` 처리하고 `'chest'`일 때는 다중 보스 교전 중 피격 방향 표시를 지우지 않는다.
  - `'chestCollected'`에서 해당 `pickup`만 `chests`에서 제거하고, `draw()`에서 `s.pickups`에 더 이상 없는 상자 참조는 자동 정리하며 남은 상자마다 황금 타원 펄스·화살표를 그린다.
  - `relevant()`는 항상 `true`를 반환한다.
- **`src/game/scene.ts` (`setRun`) & `src/game/audio.ts` (`openingImpact`)**:
  - `setRun`에서 2분 경과 필터링(`!opening.relevant(sim.state)`)을 제거해 `10:00` 모르바전까지 `hurt`·`strike`·`chest` 피드백이 동작하게 한다.
  - 후반 관통/다중 히트 난전 시 타격음이 배경음과 보스 예고를 덮지 않도록 `openingImpact` 최소 재발동 간격을 `0.052s → 0.075s`로 조절한다.

### 2. 독안개 주술사 장판 & 보스 전용 탄환
- **`src/game/types.ts` (`CombatSound`, `Projectile`)**:
  - `CombatSound`에 `'shamanCast' | 'shamanImpact' | 'coinPickup' | 'healPickup' | 'evolve'` 추가.
  - `Projectile.sprite`를 `'enemy-arrow' | 'grorm-orb' | 'warden-thorn'`으로 확장.
- **`src/game/art.ts` (`createArt`)**:
  - `'grorm-orb'`: `11×11` 대칭 주황 불씨 구체 (`#401b14`, `#d85722`, `#ffae4c`, `#fff1bf`).
  - `'warden-thorn'`: `15×9` 진행 방향(`+X`)을 향하는 보라빛 가시창 탄환 (`#2a153a`, `#8c4fd9`, `#c592ff`, `#f7e8ff`). `scene.ts`의 `renderShots`가 속도로 자동 회전한다.
- **`src/game/simulation.ts` (`moveEnemies`, `moveWarden`)**:
  - `shaman` 공격 시 `addHazard({ ...p }, 43, 1.55, e.damage, 'enemy', 'slam', 'shamanImpact')`와 `this.onSound?.('shamanCast')` 호출.
  - 첫 그롬 견제 3발(`FIRST_GRORM`)에 `'grorm-orb'`, 모르바 부채꼴·방사·이중 조준탄에 `'warden-thorn'` 지정. 속도·반경·피해·전사 쳐내기 판정은 기존과 동일.
- **`src/game/mini-enemies.ts` (`telegraphs`, `renderMiniBossHazard`)**:
  - `telegraphs.shaman = { ink: 0x422659, light: 0xe6ffa6, fill: 0x76d658 }` 추가.
  - `h.impactSound === 'shamanImpact'`일 때 자줏빛 외곽선 + 독연두 채움과 3개의 독거품/십자 포자 문양으로 렌더링해 그롬·바르크·모르바 장판과 즉시 구분한다.

### 3. 동전·회복약·무기 진화 연출 및 효과음
- **`src/game/combat-sounds.ts` (`COMBAT_SOUNDS`, `MINI_WORLD_CUES`)**:
  - `shamanCast`, `shamanImpact`, `coinPickup`, `healPickup`, `evolve` 프로필 정의.
- **`src/game/simulation.ts` (`collectPickups`, `chooseUpgrade`)**:
  - `PICKUPS.radius = 30` 직접 접촉 회수 규칙은 그대로 유지.
  - `heal` 획득 시 `onSound('healPickup')` + `effect('ring', p, 0x9ef7c6, 36, .35)`.
  - `coin` 획득 시 `onSound('coinPickup')` + `effect('ring', p, 0xffdf80, 26, .25)`.
  - `chooseUpgrade('evolve')` 시 기존 `130px` 링에 더해 `onSound('evolve')`, `effect('evolve', s.player, hexColor, 96, .95)`, 부유 텍스트 `'★ ' + EVOLUTIONS[s.hero].name` 추가.
- **`src/game/skill-effects.ts` (`renderSkillEffect`)**:
  - `'evolve'` 케이스 추가: 영웅 위로 솟는 금빛·영웅색 빛기둥, 확장 별빛 광선 6줄기, 상승 스파크 6개 렌더링.

### 4. 비범위 및 검증 계획
- **비범위**: 드랍 자석·반경 확대(현 `30px` 유지), 장기 밸런스 수치 조정, 2단계(고정 월드 분기 루트 탐험) 구현, 웹 운영 배포.
- **검증**: `npm run build`, Vitest 20개 기능 스위트(`combat-sound.test.ts`, `opening-feedback.test.ts`, `pickups-time-stop.test.ts`, `simulation.test.ts`, `audio.test.ts` 신규 테스트 포함), Playwright Chrome E2E (`opening-feedback.spec.ts`, `storybook-preview.spec.ts`), `320×568` 모바일 화면 캡처 육안 검수.
