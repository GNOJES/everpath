# 텍스트 없는 전투 피드백 및 전사 '청은 기사' 적용 설계

## 배경과 목표

기존 로컬 미커밋 작업(`/?opening=polish`)에는 첫 2분 및 그롬전의 피격 원인·돌진 예고·타격감·보물 상자 피드백과 전사 외형 후보 A·B·C가 준비되어 있다. 사용자 피드백에 따라 다음 두 가지를 반영하고, 로컬 검증 후 `main` 푸시를 통해 Vercel 운영 웹에 배포한다.

1. **게임 영역 내 텍스트 박스 전면 제거 및 기본 미니 월드 적용**
   - `돌진 · 옆으로 피하기`, `보물 상자 · 다가가기`, `그롬 돌진 피격 −31` 등 박스형 안내·원인·획득 문구 4종을 모두 제거한다.
   - 플레이어가 행동 지시 텍스트 없이 그래픽과 소리로 상황을 직관적으로 읽도록 유지한다.
   - 보물 상자 획득 시에만 기존 전장 부유 스타일(배경 박스 없는 외곽선 텍스트)로 `+150G`(골드 획득량 반영 실제 금액)만 띄운다.
   - `?opening=polish` 쿼리 없이도 기본 미니 월드(`this.miniPolish`)에서 바로 활성화되도록 연결한다 (`?polish=classic`은 기존 동작 유지).

2. **전사 에셋 '시안 C · 청은 기사' 적용**
   - 궁수(18px)·마법사(20px)와 체격 비율을 맞춘 시안 C(18px 청은 기사)를 미니 월드 전사 기본 에셋으로 채택한다.
   - 타이틀 대기, 영웅 선택, 성장의 제단, 전투 HUD, 레벨업 선택, 결과 화면 초상화(`mini/warrior.png`)와 전장 방향별 이동 4프레임·공격 3프레임 시트(`mini/warrior-motion.png`)를 모두 시안 C로 일치시킨다.

## 세부 설계

### 1. 텍스트 없는 전투·돌진·보상 피드백

- **대상 파일**: `src/ui/app.ts`, `src/game/scene.ts`, `src/game/opening-feedback.ts`, `src/game/mini-enemies.ts`, `src/game/audio.ts`
- **`src/ui/app.ts`**: `ForestScene`의 `openingPreview` 인자를 `this.miniPolish`로 전달해 기본 미니 월드에서 바로 활성화한다. (`/?opening=polish` 경로도 동일 동작)
- **`src/game/opening-feedback.ts`**:
  - `hurtLabel`, `chestLabel`, `chargeLabel`, `rewardLabel` 4개 `Phaser.GameObjects.Text` 박스를 제거한다.
  - **피격 원인 그래픽 (`drawHurt`)**: 플레이어 발밑 파동과 공격 원점 방향 화살표를 피격 원인(`contact`, `projectile`, `charge`, `ground`, `slam`)별 색상과 형태로 구분한다.
    - `contact`(적 접촉): 진홍색 발밑 원과 단발 화살표
    - `projectile`(탄환): 주황-금빛 외곽 링과 예리한 투사체 방향 화살표
    - `charge`(그롬 돌진): 굵은 적갈색/주황 충격 링과 이중 방향 화살표
    - `ground` / `slam`(장판·강타): 붉은-자주 이중 확장 파동 (방향 화살표 없음)
  - **직업별 타격 섬광 (`drawStrike`)**: 전사 검격(금빛 3갈래 섬광), 탄환 쳐내기(밝은 금빛 원형 파동+섬광), 궁수 명중/관통(청록 선명한 사선 섬광), 마법사 유도탄(보라 파동+별빛 섬광)과 `audio.openingImpact`를 유지한다.
  - **보물 상자 시각 마커 & `+150G` 보상**: 첫 그롬 상자 드랍 시 상자 주위 펄스 금빛 원과 상단 점멸 아래 화살표를 그린다. 획득 시 `simulation.ts`의 기존 `'중간보스 보물 · +150G'` 텍스트를 억제(`replacesRewardText`)하고, 배경 박스 없는 외곽선 부유 텍스트 `+${amount}G`와 `audio.openingTreasure` 차임·금빛 폭죽을 출력한다.
- **`src/game/mini-enemies.ts`**: 그롬 돌진 예고(`renderChargeLane`)는 기존 `clearCharge` 그래픽(플레이어 반경을 포함한 실제 판정 폭, 굵은 테두리, 큰 진행 화살표 4개, 상단 진행 막대)을 유지하되 어떤 텍스트도 그리지 않는다.

### 2. 전사 '시안 C · 청은 기사' 에셋 파이프라인

- **재현 가능한 생성 스크립트**: `docs/art/opening-polish/warrior/build-knight-assets.py`
  - 입력 원본: `docs/art/opening-polish/warrior/source/Knight-SpriteSheet.png`, `Sword.png`
  - 팔레트: `render-options.py`의 시안 C 청은 기사 색상표 그대로 적용 (푸른 투구·은빛 갑옷·황금 장식·청백은 장검).
  - **`src/game/assets/preview-packs/mini/warrior.png`**: 시안 C(`warrior-option-C.png`)를 좌우 반전 시 기사 몸통 중심이 흔들리지 않도록 좌측 3px 투명 여백을 보정(`20×18`, 몸통 중심 `x=10`)하거나 `warrior-option-C.png`와 픽셀 실루엣·높이(18px)를 일치시킨다.
  - **`src/game/assets/preview-packs/mini/warrior-motion.png`**: 궁수·마법사와 동일한 `280×120` (`40×40` 셀 × 7열 × 3행, 발 바닥 `y=40`, 발 중심 `x=20`).
    - 0행(우측, 좌측은 Phaser `scaleX` 반전), 1행(정면/하단), 2행(후면/상단)
    - 0~3열(이동 4프레임): `Knight-SpriteSheet` 0~3행 보행 자세 + 청은 장검 손 위치 추적 합성
    - 4~6열(공격 3프레임): `Knight-SpriteSheet` 4행 돌진/휘두름 자세를 활용해 예비 자세(검 들기) → 전방 검격(청은빛 호 궤적 포함) → 마무리 자세로 구성
- **시각·문서 정합**: `src/game/assets/preview-packs/README.md`, `docs/art/opening-polish/README.md`, `PROGRESS.md`에 시안 C 적용 내역을 반영한다.

## 검증 및 배포 계획

1. **TDD 순서**: `e2e/opening-feedback.spec.ts`와 `tests/opening-feedback.test.ts`를 먼저 작성·수정해 새 요구사항(박스 텍스트 부재, `+150G`, 기본 `/` 동작, 시안 C 시트 규격/피격 원인 구분)으로 실패 확인 후 구현한다.
2. **자동 검증**: `npm run build`, Vitest 주요 테스트(시뮬레이션·저장·백업·오디오·인카운터·캠페인), Playwright 모바일 Chrome(`320×568` 포함 `opening-feedback`, `storybook-preview`, `campaign`, `audio`, `results`, `game`) 통과 및 모바일 스크린샷 육안 확인.
3. **운영 배포**: `main` 커밋·푸시 → Vercel `READY` 확인 → `https://everpath-roan.vercel.app/` 및 `/version.json` 누적 버전(`20261126-38`) 확인 → 동일 Chrome 프로필 저장(골드·영구 강화·원정 기록) 보존 검증 → `PROGRESS.md` 최종 기록.
