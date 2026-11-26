import Phaser from 'phaser';
import { BOSS_PATTERN } from './config';
import { clamp } from './math';
import type { Enemy, EnemyKind, Hazard, Vec } from './types';

export const miniEnemyTexture = 'mini-enemy-motion';
const atlasRows: Record<EnemyKind, number> = {
 slime: 0, goblin: 1, bat: 2, skeleton: 3, brute: 4, shaman: 5, boss: 6, briar: 7, warden: 8,
};
const scales: Partial<Record<EnemyKind, number>> = { boss: 4.25, briar: 4, warden: 4.75, brute: 2.8 };
export const miniWardenRest = { frame: atlasRows.warden * 21 + 7, scale: scales.warden! };
const telegraphs = {
 grorm: { ink: 0x843518, light: 0xffead0, fill: 0xf48e39 },
 briar: { ink: 0x106459, light: 0xcdffea, fill: 0x36b897 },
 warden: { ink: 0x562679, light: 0xeddcff, fill: 0xb77ef5 },
};

export function miniEnemyPose(enemy: Enemy, player: Vec, clock: number, attackAt?: number) {
 const { kind, phase } = enemy;
 const target = enemy.entryTarget ?? player;
 const aim = phase === 'dash' || (phase === 'warn' && kind !== 'briar')
  ? enemy.aim : { x: target.x - enemy.x, y: target.y - enemy.y };
 const direction = Math.abs(aim.x) > Math.abs(aim.y) ? 0 : aim.y >= 0 ? 1 : 2;
 const attackTime = attackAt === undefined ? Infinity : clock - attackAt;
 let column = Math.floor(clock * (kind === 'bat' ? 11 : 7) + enemy.seed) % 4;
 if (phase === 'dash') column = enemy.timer > BOSS_PATTERN.dashDuration * .55 ? 5 : 6;
 else if (attackTime < .33) column = 4 + Math.min(2, Math.floor(attackTime / .11));
 else if (phase === 'warn') column = 4;
 else if (phase === 'recover' || (kind === 'shaman' && !enemy.entryTarget && Math.hypot(aim.x, aim.y) < 200)) column = 0;
 const lift = kind === 'bat' ? Math.sin(clock * 12 + enemy.seed) * 3
  : kind === 'slime' && column < 4 ? -[0, 1, 4, 2][column] : 0;
 return {
  frame: atlasRows[kind] * 21 + direction * 7 + column,
  scale: (scales[kind] ?? 2.35) * (enemy.elite ? 1.14 : 1),
  flip: direction === 0 && aim.x < 0,
  lift,
 };
}

type Graphics = Phaser.GameObjects.Graphics;
export function renderMiniBossTell(g: Graphics, e: Enemy) {
 if (e.entryTarget) return;
 if (e.kind === 'boss' && e.phase === 'warn') renderChargeLane(g, e);
 if (e.kind !== 'warden') return;
 if (e.phase === 'warn') renderFan(g, e);
 else if (e.phase === 'chase' && (e.wardenAttack ?? 0) % 3 === 2 && e.timer < .55) renderRing(g, e);
}

function renderChargeLane(g: Graphics, {x, y, aim, radius, timer}: Enemy) {
 const { ink, light, fill } = telegraphs.grorm;
 const reach = BOSS_PATTERN.dashSpeed * BOSS_PATTERN.dashDuration + radius;
 const progress = clamp(1 - timer / BOSS_PATTERN.windup, 0, 1);
 const at = (along: number, across: number) => new Phaser.Math.Vector2(
  x + aim.x * along - aim.y * across, y + aim.y * along + aim.x * across,
 );
 const lane = [at(-radius, -radius), at(reach, -radius), at(reach, radius), at(-radius, radius)];
 g.fillStyle(fill, .18 + .18 * progress).fillPoints(lane, true);
 g.lineStyle(3, ink, .8).strokePoints(lane, true);
 g.lineStyle(1.5, light, .95).strokePoints(lane, true);
 for (let i = 1; i <= 4; i++) {
  const center = reach * i / 5;
  const arrow = [at(center - 10, -radius * .5), at(center + 8, 0), at(center - 10, radius * .5)];
  g.lineStyle(5, ink, .94).strokePoints(arrow, false);
  g.lineStyle(2, light, .96).strokePoints(arrow, false);
 }
}

function renderFan(g: Graphics, {x, y, aim}: Enemy) {
 const { ink, light, fill } = telegraphs.warden;
 const angle = Math.atan2(aim.y, aim.x);
 const fan = [new Phaser.Math.Vector2(x, y)];
 for (let i = -2; i <= 2; i++) {
  const spoke = angle + i * .19;
  fan.push(new Phaser.Math.Vector2(x + Math.cos(spoke) * 245, y + Math.sin(spoke) * 245));
 }
 g.fillStyle(fill, .22).fillPoints(fan, true);
 g.lineStyle(3, ink, .75).strokePoints(fan, true);
 for (const point of fan.slice(1)) {
  g.lineStyle(1.5, light, .95).lineBetween(x, y, point.x, point.y);
 }
}

function renderRing(g: Graphics, e: Enemy) {
 const { ink, light } = telegraphs.warden;
 const count = e.hp <= e.maxHp / 2 ? 14 : 10;
 const reach = e.radius + 13 + 14 * clamp(1 - e.timer / .55, 0, 1);
 for (let i = 0; i < count; i++) {
  const angle = e.seed + i * 2 * Math.PI / count;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const x = e.x + dx * reach, y = e.y + dy * reach;
  g.lineStyle(5, ink, .86).lineBetween(x - dx * 13, y - dy * 13, x, y);
  g.lineStyle(2, light, 1).lineBetween(x - dx * 13, y - dy * 13, x, y);
 }
}

export function renderMiniBossHazard(g: Graphics, h: Hazard, progress: number) {
 const kind = h.impactSound === 'briarImpact' ? 'briar' : h.impactSound === 'wardenSlam' ? 'warden'
  : h.impactSound === 'grormSlam' ? 'grorm' : undefined;
 if (!kind) return false;
 const { ink, light, fill } = telegraphs[kind];
 const { x, y, radius } = h;
 g.fillStyle(fill, h.fired ? .4 : .13 + progress * .12).fillCircle(x, y, radius);
 g.lineStyle(2, ink, .7).strokeCircle(x, y, radius);
 g.lineStyle(1.3, light, .85).strokeCircle(x, y, radius - 2);
 if (!h.fired && progress > 0) {
  g.lineStyle(3, ink, .95).beginPath()
   .arc(x, y, radius + 3, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2).strokePath();
 }
 const detail = kind === 'briar' ? .56 : .48;
 const size = radius * detail * (h.fired ? 1.2 : .85 + progress * .15);
 if (kind === 'briar') {
  g.lineStyle(2, ink, .93).strokeCircle(x, y, size * .46)
   .lineBetween(x - size, y, x - size * .6, y).lineBetween(x + size, y, x + size * .6, y)
   .lineBetween(x, y - size, x, y - size * .6).lineBetween(x, y + size, x, y + size * .6);
  g.fillStyle(light, 1).fillRect(x - 2, y - 2, 4, 4);
 } else if (kind === 'warden') {
  const root = [[x, y - size], [x, y + size * .1], [x - size * .4, y + size * .38], [x - size * .75, y + size * .38]]
   .map(([px, py]) => new Phaser.Math.Vector2(px, py));
  const branch = [[x, y - size * .16], [x + size * .42, y + size * .03], [x + size * .72, y + size * .48]]
   .map(([px, py]) => new Phaser.Math.Vector2(px, py));
  g.lineStyle(5, ink, .88).strokePoints(root, false).strokePoints(branch, false);
  g.lineStyle(2, light, .95).strokePoints(root, false).strokePoints(branch, false);
 } else {
  const crack = [[x - size, y - size * .28], [x - size * .27, y - size * .1],
   [x + size * .11, y - size * .58], [x + size * .24, y + size * .22], [x + size, y + size * .38]]
   .map(([px, py]) => new Phaser.Math.Vector2(px, py));
  g.lineStyle(4, ink, .88).strokePoints(crack, false);
  g.lineStyle(2, light, .96).strokePoints(crack, false);
 }
 return true;
}
