# Full-Run Combat Feedback, Boss/Shaman Tells & Pickup/Evolution Polish Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend directional hurt/strike and multi-chest feedback across the entire 10-minute run while keeping `PICKUPS.radius = 30` direct touch collection, differentiate `shaman` poison hazards and Grorm/Warden projectiles visually and sonically, and add distinct audio/visual effects for coins, heals, and weapon evolution.

**Architecture:** Types and sound tables live in `types.ts` and `combat-sounds.ts`; simulation events, sprite tags, and cues live in `simulation.ts`; pixel projectile textures, shaman telegraphs, evolution pillar rendering, and multi-chest overlay live in `art.ts`, `mini-enemies.ts`, `skill-effects.ts`, `opening-feedback.ts`, `scene.ts`, and `audio.ts`.

**Tech Stack:** TypeScript, Phaser 4, Web Audio API, Vite, Vitest, Playwright (Chrome).

## Global Constraints

- Keep `PICKUPS.radius = 30` direct-contact pickup rules and balance numbers unchanged.
- Do not add boxed instructional text to the battlefield.
- Preserve existing `firstChest` event semantics for the 2-minute Grorm chest.

---

### Task 1: Write Failing Tests First (TDD Red)

**Files:**
- Modify: `tests/opening-feedback.test.ts`
- Modify: `tests/combat-sound.test.ts`
- Modify: `tests/pickups-time-stop.test.ts`
- Modify: `tests/simulation.test.ts`
- Modify: `e2e/opening-feedback.spec.ts`
- Modify: `e2e/storybook-preview.spec.ts`

- [ ] **Step 1: Add failing unit tests for multi-chest tracking, full-run feedback, shaman/boss tells, pickups & evolution cues**
  - `tests/opening-feedback.test.ts`: verify `OpeningFeedback` draws markers for multiple simultaneous 4m/8m chests (`chest` events) until each is collected without clearing `hurt` on later chests, and reports `relevant(state) === true` past 120s.
  - `tests/combat-sound.test.ts`: verify every `CombatSound` (including `shamanCast`, `shamanImpact`, `coinPickup`, `healPickup`, `evolve`) has a valid profile in `COMBAT_SOUNDS`.
  - `tests/pickups-time-stop.test.ts`: verify `coinPickup` & `healPickup` cues + ring effects emit only on direct `30px` contact.
  - `tests/simulation.test.ts`: verify `shaman` emits `shamanCast` and schedules `shamanImpact` slam hazard; first Grorm volley uses `sprite: 'grorm-orb'` and Warden fan/ring/twin bolts use `sprite: 'warden-thorn'`; `chooseUpgrade('evolve')` emits `'evolve'` cue + `'evolve'` effect + weapon evolution floating text.
- [ ] **Step 2: Add failing Playwright E2E checks for late-run hurt feedback, 4m multi-chest markers, shaman green hazard, Grorm/Warden sprites, and evolution visuals**
- [ ] **Step 3: Run targeted Vitest tests to verify RED**
  - Run `npx vitest run tests/opening-feedback.test.ts tests/combat-sound.test.ts tests/pickups-time-stop.test.ts tests/simulation.test.ts`

### Task 2: Implement Feedback, Enemy Tells, Textures, Effects & Sounds (TDD Green)

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/combat-sounds.ts`
- Modify: `src/game/simulation.ts`
- Modify: `src/game/opening-feedback.ts`
- Modify: `src/game/art.ts`
- Modify: `src/game/mini-enemies.ts`
- Modify: `src/game/skill-effects.ts`
- Modify: `src/game/scene.ts`
- Modify: `src/game/audio.ts`

- [ ] **Step 1: Update `types.ts`, `combat-sounds.ts`, `simulation.ts`, and `opening-feedback.ts`**
  - Add `'shamanCast' | 'shamanImpact' | 'coinPickup' | 'healPickup' | 'evolve'` to `CombatSound`, `'evolve'` to `SkillEffect`, `{ kind: 'chest'; pickup: Pickup }` to `CombatFeedback`, and `'grorm-orb' | 'warden-thorn'` to `Projectile['sprite']`.
  - Define distinct sound profiles in `COMBAT_SOUNDS` and `MINI_WORLD_CUES`.
  - Wire `simulation.ts` (`dropPickup`, `collectPickups`, `chooseUpgrade('evolve')`, `shaman`, `boss`, `moveWarden`).
  - Update `OpeningFeedback` to track `Set<Pickup>` chests and stay relevant all run.
- [ ] **Step 2: Update `art.ts`, `mini-enemies.ts`, `skill-effects.ts`, `scene.ts`, and `audio.ts`**
  - Add `'grorm-orb'` (`11×11`) and `'warden-thorn'` (`15×9`) pixel sprites in `art.ts`.
  - Add `shaman` green poison palette & bubble/spore hazard rendering in `mini-enemies.ts`.
  - Add `'evolve'` golden/hero light-pillar burst rendering in `skill-effects.ts`.
  - Remove the 2-minute cutoff on `sim.onFeedback` in `scene.ts` and adjust `openingImpact` throttle to `.075` in `audio.ts`.
- [ ] **Step 3: Run targeted Vitest & Playwright tests to verify GREEN**

### Task 3: Visual Verification & Full Local Validation

- [ ] **Step 1: Capture 320×568 mobile screenshots covering shaman poison hazard, Grorm/Warden sprites, 4m multi-chest markers, late hurt feedback, and weapon evolution pillar; inspect via `read_file`**
- [ ] **Step 2: Run `npm run build`, all 20 Vitest feature suites, Playwright Chrome E2E suite, `git diff --check`, and update `PROGRESS.md`**
