import type Phaser from 'phaser';
import { WORLD as W } from './config';
import { MIDDLE_BOSS_WAVES } from './encounters';
import { clamp } from './math';
import type { CombatFeedback, DamageCause, Enemy, Pickup, RunState, Vec } from './types';

const firstGrormAt = MIDDLE_BOSS_WAVES[0].at;
const chestRewardPrefix = '중간보스 보물 · ';
const strikeColors = { sword: 0xffcf71, parry: 0xfff3ae, arrow: 0x84e9ff, pierce: 0x84e9ff, magic: 0xdcb6ff };
const hurtPalettes: Record<DamageCause, { ring: number; outer: number; fill: number; core: number }> = {
 contact: { ring: 0x9e253e, outer: 0x7c1d33, fill: 0x9e253e, core: 0xffdfd9 },
 projectile: { ring: 0xd45b1c, outer: 0x943514, fill: 0xd45b1c, core: 0xffe8ba },
 charge: { ring: 0x842228, outer: 0x6f1a24, fill: 0xd96124, core: 0xffe3b0 },
 ground: { ring: 0xa82854, outer: 0xffc8dc, fill: 0xa82854, core: 0xffd2e0 },
 slam: { ring: 0xa82854, outer: 0xffd18c, fill: 0xa82854, core: 0xffe4b8 },
};
type Timed<T> = T & { atTime: number };
type Strike = Extract<CombatFeedback, { kind: 'strike' }>;
type Hurt = Extract<CombatFeedback, { kind: 'hurt' }>;

export class OpeningFeedback {
 private strikes: Timed<Strike>[] = [];
 private hurt?: Timed<Hurt>;
 private chests = new Set<Pickup>();

 relevant(_s: RunState) {
  return true;
 }

 isFirstGrorm(e: Enemy) {
  return e.kind === 'boss' && e.middleWave === firstGrormAt;
 }

 record(event: CombatFeedback, clock: number) {
  if (event.kind === 'firstChest') {
   this.chests.add(event.pickup);
   this.hurt = undefined;
  } else if (event.kind === 'chest') {
   this.chests.add(event.pickup);
  } else if (event.kind === 'chestCollected') {
   return this.chests.delete(event.pickup);
  } else if (event.kind === 'hurt') {
   this.hurt = { ...event, source: { x: event.source.x, y: event.source.y }, atTime: clock };
  } else if (event.kind === 'strike') {
   if (this.strikes.length >= 12) this.strikes.shift();
   this.strikes.push({ ...event, at: { x: event.at.x, y: event.at.y }, atTime: clock });
  }
  return false;
 }

 formatWorldText(text: string | undefined) {
  if (!text) return '';
  return text.startsWith(chestRewardPrefix) ? text.slice(chestRewardPrefix.length) : text;
 }

 reset() {
  this.strikes = [];
  this.hurt = undefined;
  this.chests.clear();
 }

 draw(g: Phaser.GameObjects.Graphics, s: RunState, clock: number) {
  if (s.status !== 'running' && s.status !== 'gameover') return;
  this.strikes = this.strikes.filter(strike => clock - strike.atTime < .27);
  for (const strike of this.strikes) this.drawStrike(g, strike, clock - strike.atTime);

  for (const chest of [...this.chests]) {
   if (!s.pickups.includes(chest)) {
    this.chests.delete(chest);
    continue;
   }
   const { x, groundY } = chest, y = groundY + s.scroll;
   if (y >= 0 && y < W.height - 8) {
    const pulse = .6 + .4 * Math.sin(clock * 6) ** 2;
    const bob = Math.sin(clock * 6) * 2.5;
    g.lineStyle(2.5, 0xffe19b, pulse).strokeEllipse(x, y + 3, 67, 34);
    g.fillStyle(0x713f18, pulse).fillTriangle(x - 7, y - 28 + bob, x + 7, y - 28 + bob, x, y - 18 + bob);
    g.fillStyle(0xffefae, pulse).fillTriangle(x - 5, y - 26 + bob, x + 5, y - 26 + bob, x, y - 20 + bob);
   }
  }
  if (this.hurt && clock - this.hurt.atTime < .36) {
   this.drawHurt(g, s.player, this.hurt, clock - this.hurt.atTime);
  }
 }

 private drawHurt(g: Phaser.GameObjects.Graphics, player: Vec, { cause, source }: Hurt, age: number) {
  const alpha = clamp(1 - age / .36, 0, 1);
  if (!alpha) return;
  const { x, y } = player;
  const palette = hurtPalettes[cause];
  g.lineStyle(3, palette.ring, alpha).strokeEllipse(x, y + 3, 48 + age * 30, 26 + age * 18);
  if (cause === 'ground' || cause === 'slam') {
   g.lineStyle(2, palette.outer, alpha * .9).strokeEllipse(x, y + 3, 30 + age * 46, 16 + age * 26);
   return;
  }
  const angle = Math.atan2(source.y - y, source.x - x);
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const tipX = x + dx * 26, tipY = y + dy * 26;
  const halfWidth = cause === 'projectile' ? 6 : 8;
  g.fillStyle(palette.outer, alpha).fillTriangle(
   tipX, tipY,
   x + dx * 46 - dy * halfWidth, y + dy * 46 + dx * halfWidth,
   x + dx * 46 + dy * halfWidth, y + dy * 46 - dx * halfWidth,
  );
  g.fillStyle(palette.core, alpha).fillTriangle(
   x + dx * 31, y + dy * 31,
   x + dx * 43 - dy * 4, y + dy * 43 + dx * 4,
   x + dx * 43 + dy * 4, y + dy * 43 - dx * 4,
  );
  if (cause === 'charge') {
   g.lineStyle(2.5, palette.core, alpha).strokeEllipse(x, y + 3, 56 + age * 34, 31 + age * 20);
   g.fillStyle(palette.fill, alpha).fillTriangle(
    x + dx * 46, y + dy * 46,
    x + dx * 60 - dy * 7, y + dy * 60 + dx * 7,
    x + dx * 60 + dy * 7, y + dy * 60 - dx * 7,
   );
  }
 }

 private drawStrike(g: Phaser.GameObjects.Graphics, { style, at, angle }: Strike, age: number) {
  const alpha = 1 - age / .27;
  const { x, y } = at;
  const color = strikeColors[style];
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const reach = 11 + age * 42;
  if (style === 'magic') {
   g.lineStyle(2, color, alpha).strokeCircle(x, y - 5, reach);
   g.fillStyle(color, alpha).fillTriangle(x, y - reach - 5, x - 5, y - 4, x + 5, y - 4);
  } else if (style === 'arrow' || style === 'pierce') {
   g.lineStyle(style === 'pierce' ? 4 : 2.5, color, alpha).lineBetween(x - dx * reach, y - dy * reach, x + dx * reach, y + dy * reach);
   g.lineStyle(1, 0xf4ffff, alpha).lineBetween(x - dy * 6, y + dx * 6, x + dy * 6, y - dx * 6);
  } else {
   if (style === 'parry') g.lineStyle(2.5, color, alpha).strokeCircle(x, y, reach);
   for (const spread of [-.52, 0, .52]) {
    const a = angle + spread, vx = Math.cos(a), vy = Math.sin(a);
    g.lineStyle(2.5, color, alpha).lineBetween(x + vx * 5, y + vy * 5, x + vx * reach, y + vy * reach);
   }
  }
  g.fillStyle(0xfff8de, alpha).fillRect(x - 2, y - 2, 4, 4);
 }
}
