# Combat Fields, Skeleton Arrow, Morva Pattern, Music Fadeout & Recovery Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and deploy 6 gameplay/visual/audio refinements: nerfed Blast Arrow (`70%` range, max 2 overlapping fields), depth-sorted & softer ally ground fields, skeleton enemy arrow sprite, 10-minute boss BGM fadeout transition, varied Morva attacks with instant cone punish at telegraph end, and fixed `+120 HP` level-up recovery guaranteed below 30% HP.

**Architecture:** Balance & progression numbers live in `config.ts`, `progression.ts`, and `simulation.ts`; rendering layers (`groundFx`, `hazardFx`, `fx`) and enemy arrow sprites live in `art.ts`, `scene.ts`, and `mini-enemies.ts`; soundtrack fadeout lives in `audio.ts`.

**Tech Stack:** TypeScript, Phaser 4, Web Audio API, Vite, Vitest, Playwright (Chrome), Vercel/GitHub.

---

### Task 1: Write Failing Tests First (TDD Red)

**Files:**
- Modify: `tests/combat-balance.test.ts`
- Modify: `tests/progression.test.ts`
- Modify: `tests/campaign.test.ts`
- Modify: `tests/audio.test.ts`
- Modify: `e2e/storybook-preview.spec.ts`

- [ ] **Step 1: Add/update failing Vitest specs for Items 1, 3, 4, 5, 6**
  - `tests/combat-balance.test.ts`: test `blastArrow` nerfed radius (`52..139`) & max 2 simultaneous `burn` fields at Lv.4 with max 5/5 haste; test `skeleton` projectile has `kind: 'enemy'` and `sprite: 'enemy-arrow'`; test `vitality` heals fixed `+120` HP without changing `maxHp`.
  - `tests/progression.test.ts`: test `passive:vitality` excluded when `hp === maxHp`, included when injured, and guaranteed when `hp / maxHp < 0.30` (and NOT guaranteed at `0.35`).
  - `tests/campaign.test.ts`: test `warden` `attack 1` deals instant fan hit inside 245px cone at windup end + fast bolts, and `attack 3` spawns root hazards & twin shots in a 4-pattern cycle.
  - `tests/audio.test.ts`: test `syncMusic('running', true)` fades out active exploration track via outgoing GainNode instead of abruptly cutting immediately, and transitions to `warden` after fadeout (and cancels fade cleanly on `suspend`/`beginRun`).
- [ ] **Step 2: Add Playwright depth & sprite checks in `e2e/storybook-preview.spec.ts` (or `e2e/opening-feedback.spec.ts`)**
  - Verify `enemy-arrow` texture exists and renders on skeleton shots, and `groundFx` (`depth 10`) / `hazardFx` (`depth 20`) render below `hero` (`100+y`) and `shots` (`1600`).
- [ ] **Step 3: Run the targeted tests to verify RED**
  - Run `npx vitest run tests/combat-balance.test.ts tests/progression.test.ts tests/campaign.test.ts tests/audio.test.ts`.

### Task 2: Implement Changes (TDD Green)

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/config.ts`
- Modify: `src/game/progression.ts`
- Modify: `src/game/simulation.ts`
- Modify: `src/game/art.ts`
- Modify: `src/game/mini-enemies.ts`
- Modify: `src/game/scene.ts`
- Modify: `src/game/audio.ts`
- Modify: `README.md`

- [ ] **Step 1: Implement config, progression, simulation, and types (Items 1, 3, 5, 6)**
  - Update `SKILLS.blastArrow`, `BALANCE.recoveryChoiceThreshold`, `BALANCE.vitalityHeal`, `PASSIVES.vitality` in `config.ts`.
  - Update `availableUpgrades` in `progression.ts` to gate `passive:vitality` on `hp < maxHp`.
  - Update `types.ts` (`Projectile.sprite?: 'enemy-arrow'`).
  - Update `simulation.ts` (`skeleton` sprite, `moveWarden` 4-pattern cycle + fan cone strike + faster bolts, `vitality` fixed `+120` heal).
- [ ] **Step 2: Implement visuals & audio (Items 2, 3, 4, 5)**
  - Add `'enemy-arrow'` pixel texture in `art.ts`.
  - Add `groundFx` (`depth 10`) & `hazardFx` (`depth 20`) in `scene.ts`; soften & recolor `burn`, `snare`, `rain` ground circles; use `shot.sprite ?? shot.kind` in `renderShots`.
  - Update `renderFan` in `mini-enemies.ts` with closing progress fill/border so players see exact cone timing.
  - Add clean fade-out track transition in `audio.ts`.
- [ ] **Step 3: Update `README.md` hero/recovery notes to match new behavior**
- [ ] **Step 4: Run Vitest & Playwright to verify GREEN**

### Task 3: Full Verification, Visual Review, and Web Deployment

- [ ] **Step 1: Run `npm run build`, all 20 Vitest feature test files, and Playwright Chrome suite + inspect mobile screenshots**
- [ ] **Step 2: Capture pre-deploy save baseline (`artifacts/local/release-39-profile`) on `https://everpath-roan.vercel.app/`**
- [ ] **Step 3: Commit & push `main`, wait for Vercel `READY`, verify incremented version & save preservation, and update `PROGRESS.md`**
