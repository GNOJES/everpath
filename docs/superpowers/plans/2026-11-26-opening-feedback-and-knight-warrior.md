# Text-Free Opening Feedback & Knight Warrior (Option C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all boxed instructional/feedback text from the battlefield while keeping visual/audio hit, charge, strike, and `+150G` chest cues active by default in Mini World, replace the Mini World warrior portraits and 40×40 directional walk/attack sheet with Option C (Blue-Silver Knight), verify locally, and deploy to Vercel production.

**Architecture:** `src/game/opening-feedback.ts` handles canvas-only visual indicators (`Graphics`) plus clean floating stroked `+150G` text for the opening chest, wired unconditionally when `this.miniPolish` is enabled in `src/ui/app.ts`. A deterministic Python asset script builds `mini/warrior.png` and `mini/warrior-motion.png` (280×120) from the preserved Ninja Adventure Knight source sheets using Option C's exact palette so idle, portraits, walk, and attack frames stay pixel-consistent.

**Tech Stack:** TypeScript, Phaser 4, Vite, Python 3 + Pillow, Vitest, Playwright (Chrome), Vercel/GitHub.

## Global Constraints

- Preserve `simulation.ts` combat timings, hitboxes, damage, and rewards unchanged (visual/audio feedback only).
- Do not leave any background-boxed text labels (`돌진 · 옆으로 피하기`, `보물 상자 · 다가가기`, `그롬 돌진 피격 −31`, `보물 획득 +150G`) in the game area.
- Only `+150G` (clean floating stroked text, matching standard damage numbers) remains for chest reward feedback.
- Follow `README.md#운영-배포`: verify local build & tests first, push `main`, verify Vercel `READY`, live title + `/version.json`, and same Chrome profile save preservation.

---

### Task 1: Generate Option C Warrior Assets (`mini/warrior.png` & `mini/warrior-motion.png`)

**Files:**
- Create: `docs/art/opening-polish/warrior/build-knight-assets.py`
- Modify: `src/game/assets/preview-packs/mini/warrior.png`
- Modify: `src/game/assets/preview-packs/mini/warrior-motion.png`

- [ ] **Step 1: Write deterministic sprite generator `build-knight-assets.py`**
  - Recolor `Knight-SpriteSheet.png` and `Sword.png` using the exact `render-options.py` Option C palette map.
  - Export `mini/warrior.png` (`20×18`, Option C front knight + upright sword with knight body centered horizontally so left/right flip stays aligned with walk cells).
  - Export `mini/warrior-motion.png` (`280×120`, `40×40` cells, 7 cols × 3 rows [right, down, up], bottom feet at `y=40` centered at `x=20`: 4 walk frames + 3 sword-swing attack frames with crisp silver-blue slash arcs).
- [ ] **Step 2: Run generator and visually inspect output sheet & portrait**
  - Run `python3 docs/art/opening-polish/warrior/build-knight-assets.py` and render an enlarged preview sheet to verify cell alignment, proportions, sword orientation, and zero stray pixels.

### Task 2: Write Failing Tests First (TDD Red)

**Files:**
- Create: `tests/opening-feedback.test.ts`
- Modify: `e2e/opening-feedback.spec.ts`

- [ ] **Step 1: Add unit test `tests/opening-feedback.test.ts`**
  - Verify `GameSimulation` emits `CombatFeedback` (`strike`, `hurt`, `firstChest`, `chestCollected`) without changing run balance/state, and verify `mini/warrior.png` + `mini/warrior-motion.png` dimensions (`18px` opaque knight height, `280×120` sheet, all 21 cells non-empty and bottom-aligned).
- [ ] **Step 2: Update `e2e/opening-feedback.spec.ts` for `/` default path & zero boxed feedback texts**
  - Navigate to `/` (no `?opening=polish` query needed).
  - Assert that during Grorm charge warning, hit, and chest discovery, NO visible Phaser `Text` contains `'돌진 · 옆으로 피하기'`, `'보물 상자 · 다가가기'`, `'피격'`, `'충돌'`, or `'보물 획득'`.
  - Assert `opening.hasActiveVisualFeedback()` / canvas graphics & `feedbackEvents` confirm charge warning, hit causes (`charge`, `projectile`, `ground`, `contact`), basic weapon impacts (`sword`, `arrow`, `magic`), chest discovery, and floating `+150G` (without `'중간보스 보물 · +150G'`).
- [ ] **Step 3: Run tests to verify they fail before implementation changes**
  - Run `npx vitest run tests/opening-feedback.test.ts` and `PLAYWRIGHT_CHANNEL=chrome npx playwright test e2e/opening-feedback.spec.ts`.

### Task 3: Implement Text-Free Opening Feedback & Default Mini World Wiring (TDD Green)

**Files:**
- Modify: `src/game/opening-feedback.ts`
- Modify: `src/game/scene.ts`
- Modify: `src/ui/app.ts`

- [ ] **Step 1: Remove all boxed text labels from `src/game/opening-feedback.ts`**
  - Remove `hurtLabel`, `chestLabel`, `chargeLabel`, and `rewardLabel` box texts.
  - Enhance `drawHurt` so each `DamageCause` (`contact`, `projectile`, `charge`, `ground`, `slam`) has a clear distinct visual silhouette & color without text.
  - Keep `drawStrike` weapon hit flashes and chest pulsing ring + downward triangle marker.
  - Render chest reward as clean stroked floating `+${amount}G` (no `backgroundColor` box) and keep `replacesRewardText` suppressing `'중간보스 보물 · +150G'`.
- [ ] **Step 2: Enable `openingPreview` by default for `miniPolish` in `src/ui/app.ts`**
  - Change `ForestScene` argument from `this.miniPolish && preview?.get('opening') === 'polish'` to `this.miniPolish`.
  - Ensure `scene.ts` renders the clean floating `+150G` label cleanly alongside `OpeningFeedback`.
- [ ] **Step 3: Run failing tests again to confirm GREEN**
  - Re-run `npx vitest run tests/opening-feedback.test.ts` and `PLAYWRIGHT_CHANNEL=chrome npx playwright test e2e/opening-feedback.spec.ts` and visually inspect captured mobile screenshots (`320×568`).

### Task 4: Full Verification, Docs Update, and Live Web Deployment

**Files:**
- Modify: `PROGRESS.md`
- Modify: `docs/art/opening-polish/README.md`
- Modify: `src/game/assets/preview-packs/README.md`

- [ ] **Step 1: Update documentation**
  - Update `docs/art/opening-polish/README.md`, `src/game/assets/preview-packs/README.md`, and `PROGRESS.md` with accurate paths, behavior, and test results.
- [ ] **Step 2: Run build, Vitest suite, and Playwright Chrome tests**
  - Run `npm run build`.
  - Run Vitest feature tests (excluding long 10-minute `campaign-balance` / `retry-economy` that overwrite `docs/playtests/` unless isolated, or verify exact non-playtest suite cleanly).
  - Run `PLAYWRIGHT_CHANNEL=chrome npx playwright test e2e/opening-feedback.spec.ts e2e/storybook-preview.spec.ts e2e/campaign.spec.ts e2e/audio.spec.ts e2e/results.spec.ts e2e/game.spec.ts`.
  - Visually verify mobile screenshots of Hero Select (Option C knight portrait), combat walk/attack, Grorm charge (text-free), hit visual, and chest `+150G`.
- [ ] **Step 3: Commit, push to `main`, and verify Vercel production deployment**
  - Capture pre-deploy save state on `https://everpath-roan.vercel.app/` with an isolated persistent Chrome profile.
  - Commit all intended changes to `main` and `git push origin main`.
  - Poll Vercel deployment status until `READY`, confirm title & `/version.json` incremented to `20261126-38`, verify Option C knight & combat screen on live URL, and verify same Chrome profile save data preserved.
  - Update `PROGRESS.md` with final production deployment verification (`20261126-38`) and commit/push if needed (note: check if updating `PROGRESS.md` after deploy needs a separate doc commit or if we only push once before/after — wait: let's think carefully! Pushing again after deploy triggers ANOTHER Vercel build (`20261126-39`)! Look at how previous commits in git log did it: let's check `git log -n 5 -p -- PROGRESS.md` so we follow the exact repo convention!).
