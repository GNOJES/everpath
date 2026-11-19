# Ten-minute progression Implementation Plan
> **For agentic workers:** Use superpowers:executing-plans inline. User already delegates routine implementation and asks actual code/build/tests; no additional implementation handoff required.
**Goal:** Make ten-minute boss victory the first meaningful progression goal with refunded shared power-ups and replay content.
**Architecture:** Keep deterministic simulation, typed config/encounters, SaveStore transactions and current Phaser/UI. Extend additive save fields and existing rendering pools.
**Tech Stack:** Phaser4, TypeScript, Vitest, Playwright, Capacitor8.
**Spec:** docs/superpowers/specs/2026-11-18-ten-minute-progression-design.md
## Global Constraints
Retain save key/appId/diagnostics; normal HP in balance trials; entity caps100/180/60/12; no purchase gate or copied assets. No Git metadata in checkout, work inline; no commits possible.
## Review Focus
Old save investment conversion; repeated refund/settlement; final-kill same-frame death; evolved max-choice exhaustion; menus/reset do not modify active-run stats.
## Tasks
- [x] 1. SaveStore progression/refund. Test exact purchase/refund/reload and legacy conversion before implementing additive fields invested/clears/challenge and safe transactions in save.ts/types.ts.
- [x] 2. Forest campaign. Tests for600s final scheduling/single final, victory final-kill and no post-victory updates; implement encounters/config/types/simulation with brute/shaman/finalboss and bounded attacks/milestone supplies.
- [x] 3. Hero evolution. Tests for weapon5+matching passive2 then legal evolution selection, distinct attack properties; implement config/progression/simulation and render appearance.
- [x] 4. UI/art. Connect objective phase/progress, evolved weapon name, rank selection/unlock, refund preview/confirm/cancel, victory/rewards and clear history; create original pixel enemies and render telegraphs.
- [x] 5. Balance verification. Extend helpers with meta/rank conditions and victory duration720s, normal HP; collect0/5/10 and economic retry trials, tune until progression matrix objective met. Update old assertions to new specified contracts, not weaken new contracts.
- [x] 6. Whole flow E2E, fresh review, docs and Android0.3.0/code3 build with signature and byte-exact web asset verification.
## Ledger
Ruling: power-up reset means full gold refund and rebuild, preserving records; shared progression retained as original spec and reference. Active simulation takes a save snapshot, so shop changes only affect next run.

Final: 80 unit tests, 10 short browser tests, 1 grown normal-HP touch campaign victory; APK0.3.0 built/signed/asset equality checked. Read-only review found no Critical/Important defects.
