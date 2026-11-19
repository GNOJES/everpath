# EVERPATH pilot design

The supplied Korean project brief is the product specification. The user explicitly asks for implementation, build, and tests without stopping at design, and delegates unspecified decisions. This document records implementation decisions rather than introducing an approval gate.

Build a local-only static browser game using Phaser 4, TypeScript and Vite/npm. A fixed logical 432×768 portrait playfield scales to the viewport. HTML UI surrounds a Phaser canvas; desktop gains a field journal and expedition panel while mobile retains the portrait game. All visible game art is original generated pixel art. No remote fonts, game assets, backend, login, advertisements, or paid services.

## Approaches
- Canvas-only UI: unified rendering, but difficult accessible menus and responsive text.
- Phaser playfield with semantic HTML UI (selected by implementer): crisp sprites, efficient rendering, readable touch-friendly controls, pure simulation tests.
- DOM-only game: fails the explicit Phaser requirement.

## Systems
- Data: centralized characters, enemy parameters, skill upgrades, progression, spawn and input limits.
- Pure simulation: player state, independent scroll offset, enemy patterns, basic weapons, nine class skills, projectiles, boss telegraphs, XP/upgrade choices and results.
- Save: defensive versioned parsing, bounded values, last hero, settings, permanent upgrades and idempotent run payout. Handle unavailable storage gracefully.
- Rendering: Phaser scene, generated pixel atlas, scrolling forest, pooled sprites, bounded combat effects, audio via Web Audio synthesis.
- Input: keyboard and single active pointer floating joystick; reset on cancel, pause, blur, resize. UI lives above playfield and does not propagate pointer input.
- Flow: title → hero selection → fight ↔ upgrades/pause → results → permanent shop → retry. Abandoning a paused run settles earned gold once before title.

## Defaults
Boss at 180 seconds, continued endless play, repeated bosses every 180 seconds. First upgrade around 20–40 seconds. Enemy cap 100, projectile cap 180, VFX cap 60. Permanent upgrade caps 10 with escalating costs, starting purchase cost 12 gold. High HP warrior, agile archer, high-damage mage. Class skill caps 3, weapon cap 5, common passive caps 5. Korean instructions with English fantasy titles. All balance values editable in src/game/config.ts.

## Verification
Vitest pure logic checks: input, pause/scroll independence, targeting/skills, boss, caps, progression, corrupted saves and duplicate payouts. Playwright real-browser flows for all heroes, upgrade selection, pause, defeat, shop/reload, mobile input and overflow, repeated starts. Accelerated deterministic simulation stays in test code; debug UI exposes only FPS/counts. Test execution limitations are reported honestly.
