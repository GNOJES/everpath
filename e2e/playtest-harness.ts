// Test-only entry: the production App and input path are unchanged. The bridge reads
// diagnostics and recommends steering; it never writes player, XP, skills or enemies.
import '../src/style.css';
import { App } from '../src/ui/app';
import { Pilot, chooseAbility, seededRandom } from '../tests/helpers/playtest';
import type { GameSimulation } from '../src/game/simulation';
import type { ForestScene } from '../src/game/scene';
const requestedBuild = new URLSearchParams(location.search).get('build');
const build = requestedBuild === 'weapon' ? 'weapon' : requestedBuild === 'skills' ? 'skills' : 'balanced';
const seed = Number(new URLSearchParams(location.search).get('seed') ?? 42);
Math.random = seededRandom(seed);
const app = new App(document.querySelector<HTMLElement>('#app')!);
const runtime = app as unknown as { sim?: GameSimulation; scene: ForestScene };
const pilot = new Pilot('reactive');
let decisionAt = -1; let direction = { x: 0, y: 0 };
const checkpoints: unknown[] = []; let maxEnemies = 0, maxShots = 0, maxObjects = 0, firstLevel = 0, hpLost = 0, lastHp: number | undefined, lastRun = '';
const originalFrame = runtime.scene.onFrame;
runtime.scene.onFrame = (state, victoryFxTime) => {
 if (state) {
  if (lastRun !== state.runId) { lastHp = undefined; lastRun = state.runId; }
  if (lastHp !== undefined && state.player.hp < lastHp) hpLost += lastHp - state.player.hp; lastHp = state.player.hp;
  if (state.level > 1 && !firstLevel) firstLevel = state.elapsed;
  maxEnemies = Math.max(maxEnemies, state.enemies.length); maxShots = Math.max(maxShots, state.projectiles.length); maxObjects = Math.max(maxObjects, runtime.scene.children.length);
  if (Math.floor(state.elapsed / 60) > checkpoints.length) checkpoints.push({ seconds: Math.round(state.elapsed), hp: Math.round(state.player.hp), level: state.level, kills: state.kills, bosses: state.bosses, enemies: state.enemies.length });
 }
 originalFrame?.(state, victoryFxTime);
};
function view() {
 const s = runtime.sim?.state; if (!s) return null;
 if (s.elapsed - decisionAt >= .09) { direction = pilot.direction(s); decisionAt = s.elapsed; }
 return { build, hero: s.hero, elapsed: s.elapsed, status: s.status, hp: s.player.hp, maxHp: s.player.maxHp, level: s.level, skills: { ...s.skills }, kills: s.kills, bosses: s.bosses,
  direction: { ...direction }, center: { ...runtime.scene.controls.center }, dragging: runtime.scene.controls.dragging,
  choice: s.status === 'upgrade' ? chooseAbility(s, build) : null,
  combat: runtime.sim!.result().combat, scroll: s.scroll, maxEnemies, maxShots, maxObjects, firstLevel, hpLost: Math.round(hpLost), checkpoints,
  bossWarning: s.enemies.some(e => e.kind === 'boss' && e.phase === 'warn'),
  bossVisible: s.enemies.some(e => e.kind === 'boss'),
 };
}
Object.defineProperty(window, '__playtest', { value: { view, nativeBack: () => app.handleNativeBack(), nativePause: () => app.suspendForNative() }, writable: false });
export type PlaytestView = ReturnType<typeof view>;
