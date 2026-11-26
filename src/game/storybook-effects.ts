import type Phaser from 'phaser';
import type { Effect, Projectile } from './types';

export function storybookSlash(g: Phaser.GameObjects.Graphics, effect: Effect, alpha: number) {
 const { x, y, angle, radius } = effect;
 const span = effect.halfAngle ?? Math.PI / 4;
 const front = radius - 6 * alpha;
 g.lineStyle(10 * alpha + 1, 0x9f503c, .56 * alpha).beginPath()
  .arc(x, y, front, angle - span, angle + span).strokePath();
 g.lineStyle(7 * alpha + 1, 0xffb45f, .93 * alpha).beginPath()
  .arc(x, y, front, angle - span, angle + span).strokePath();
 g.lineStyle(3, 0xfff5cf, alpha).beginPath()
  .arc(x, y, radius - 2, angle - span * .77, angle + span * .8).strokePath();
 for (const fraction of [-.86, -.42, .18, .68]) {
  const a = angle + span * fraction;
  const r = radius - 8 + (1 - alpha) * 8;
  g.fillStyle(0xffe7ab, alpha).fillRect(x + Math.cos(a) * r - 1, y + Math.sin(a) * r - 1, 3, 3);
 }
}

export function storybookShot(g: Phaser.GameObjects.Graphics, shot: Projectile, angle: number) {
 const { x, y } = shot;
 const dx = Math.cos(angle), dy = Math.sin(angle);
 if (shot.kind === 'arrow') {
  g.lineStyle(4, 0x446e65, .75).lineBetween(x - dx * 32, y - dy * 32, x, y);
  g.lineStyle(2, 0xe9ffca, .96).lineBetween(x - dx * 27, y - dy * 27, x + dx * 8, y + dy * 8);
  return;
 }
 for (let i = 1; i <= 4; i++) {
  const size = 9 - i * 2, offset = i % 2 ? i * 1.3 : -i * 1.3;
  const tailX = x - dx * i * 7 - dy * offset, tailY = y - dy * i * 7 + dx * offset;
  g.fillStyle(i % 2 ? 0x8060c1 : 0xb287df, .83 - i * .12).fillRect(tailX - size / 2, tailY - size / 2, size, size);
 }
 g.lineStyle(2, 0xa493df, .8).strokeCircle(x, y, 10);
 g.fillStyle(0xffebba, .95).fillRect(x - 2, y - 2, 4, 4);
}
