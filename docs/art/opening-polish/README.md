# 첫 원정·전사 외형 시안 인수인계

[전사 A·B·C 비교판](warrior/drafts/warrior-options.png) · [그롬전 모바일 캡처](reference/opening-scenes.png)

## 전사 외형

장비를 포함한 불투명 영역의 높이다. 비교판에서 전사·궁수·마법사를 게임과 같은 2배 배율로 표시했다. 기존 전사는 24px, 궁수는 18px, 마법사는 20px다.

| 후보 | 가공 시안 | 원본과 구현 메모 |
| --- | --- | --- |
| A · 붉은 방패 기사, 20px | [PNG](warrior/drafts/warrior-option-A.png) | Mini World [SwordsmanRed 전체 시트](warrior/source/SwordsmanRed.png). [현재 미니 월드 유휴 프레임](../../../src/game/assets/preview-packs/mini/warrior.png)을 23×20 셀로 줄였다. |
| B · 붉은 망토 검객, 19px | [PNG](warrior/drafts/warrior-option-B.png) | Puny Characters [Warrior-Red 전체 시트](warrior/source/Warrior-Red.png). [기존 추출 프레임](../../../src/game/assets/preview-packs/puny/warrior.png)을 재채색하고 가는 장검을 픽셀로 그려 붙였다. 궁수·마법사와 같은 원본 팩을 사용했다. |
| C · 청은 기사, 18px | [PNG](warrior/drafts/warrior-option-C.png) | Ninja Adventure Knight의 [전체 시트](warrior/source/Knight-SpriteSheet.png), [유휴](warrior/source/Knight-Idle.png)·[이동](warrior/source/Knight-Walk.png)·[공격](warrior/source/Knight-Attack.png) 프레임과 [Sword](warrior/source/Sword.png). [기존 합성 프레임](../../../src/game/assets/preview-packs/ninja/warrior.png)의 투구와 칼을 재채색했다. |

비교에 사용한 궁수·마법사 원본도 보존했다. [Archer-Green](warrior/source/Archer-Green.png)·[Bow](warrior/source/Bow.png), [Mage-Cyan](warrior/source/Mage-Cyan.png)·[MagicWand](warrior/source/MagicWand.png). 에셋 출처·제작자와 CC0 1.0 안내는 [기존 에셋 명세](../../../src/game/assets/preview-packs/README.md)에 있다.

[비교판 생성기](warrior/render-options.py)는 저장소 내부 PNG를 사용한다. Python과 Pillow가 필요하다. macOS 외 환경에서 한글 글꼴을 지정할 때는 `--font <파일> --font-index 0`을 사용한다.

```sh
python3 docs/art/opening-polish/warrior/render-options.py --output /tmp/everpath-warrior-options
```

다음 단계에서 사용자 선택에 따라 **시안 C · 청은 기사**를 최종 채택해 [build-knight-assets.py](warrior/build-knight-assets.py)로 [전사 유휴·초상화](../../../src/game/assets/preview-packs/mini/warrior.png)(20×18, 불투명 높이 18px)와 [전사 이동·공격 시트](../../../src/game/assets/preview-packs/mini/warrior-motion.png)(280×120, 40×40 셀 × 7열 × 3행)를 제작·연결했다. [art.ts](../../../src/game/art.ts)에서 초상화와 시트를 로드하며, [scene.ts](../../../src/game/scene.ts)의 `miniMotion`이 이동 4프레임·공격 3프레임과 발 위치를 맞춘다.

## 첫 2분·그롬전

기본 미니 월드(`/`)에서 원정 초반과 첫 그롬의 피격·명중·돌진 예고·보상 연출을 바로 확인할 수 있다 (`?opening=polish`도 동일 동작). 게임 영역 내 박스형 안내·원인 문구는 모두 제거하고 그래픽·음향 피드백과 부유 `+150G`만 표시한다.

- [app.ts](../../../src/ui/app.ts)에서 기본 미니 월드(`this.miniPolish`)에 연결하고 [scene.ts](../../../src/game/scene.ts)가 렌더링과 사운드를 연결한다.
- [simulation.ts](../../../src/game/simulation.ts)와 [types.ts](../../../src/game/types.ts)의 `onFeedback`·`CombatFeedback`이 기존 전투 사건과 실피해·실획득량을 전달한다.
- [opening-feedback.ts](../../../src/game/opening-feedback.ts)는 텍스트 박스 없이 원인별 피격 방향·직업별 명중 섬광·상자 펄스/화살표 마커와 `+gold` 표기를 담당한다. [mini-enemies.ts](../../../src/game/mini-enemies.ts)는 텍스트 없는 돌진 예고, [audio.ts](../../../src/game/audio.ts)는 명중 및 보상 효과음이다.
- 그롬·슬라임 원본은 [Minotaur](reference/source/Minotaur.png)·[Slime](reference/source/Slime.png), 실제 전장 시트는 [enemy-motion.png](../../../src/game/assets/preview-packs/mini/enemy-motion.png)다.
- 320×568 눈검사용 원본 캡처가 있다. [돌진 예고](reference/grorm-warning.png), [피격](reference/grorm-hit.png), [상자 발견](reference/grorm-chest.png), [획득](reference/grorm-reward.png).
- [Playwright 재현](../../../e2e/opening-feedback.spec.ts)은 박스형 안내·피격 텍스트 부재, 무강화 상자 150G와 `+150G` 부유 텍스트, 세 영웅 명중·피격 분류를 확인한다.

```sh
npm run dev
PLAYWRIGHT_CHANNEL=chrome npx playwright test e2e/opening-feedback.spec.ts
```

적용 작업은 `5ff05f1` (`ver. 20261126-37`) 기반 위에 진행했다.
