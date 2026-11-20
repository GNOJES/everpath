import Phaser from 'phaser';
import type { Effect, Projectile } from './types';

export function renderSkillShot(g: Phaser.GameObjects.Graphics, shot: Projectile, angle: number) {
 const { x, y, skillShot } = shot;
 if (!skillShot) return;
 const dx = Math.cos(angle), dy = Math.sin(angle);
 switch (skillShot) {
  case 'blade':
   for (const offset of [-9, 9]) {
    g.lineStyle(3, 0x198c91, .8).lineBetween(x - dx * 22 - dy * offset, y - dy * 22 + dx * offset, x + dx * 7, y + dy * 7);
   }
   g.lineStyle(2, 0xcafcf0, 1).lineBetween(x - dy * 9, y + dx * 9, x + dy * 9, y - dx * 9);
   break;
  case 'volley':
   for (let i = 1; i <= 4; i++) {
    const distance = i * 8;
    g.fillStyle(i % 2 ? 0x9c3c30 : 0xffdc78, 1 - i * .14).fillRect(x - dx * distance - 2, y - dy * distance - 2, 4, 4);
   }
   break;
  case 'pierce':
   g.lineStyle(8, 0xab551e, .65).lineBetween(x - dx * 45, y - dy * 45, x + dx * 12, y + dy * 12);
   g.lineStyle(3, 0xffe388, 1).lineBetween(x - dx * 34, y - dy * 34, x + dx * 12, y + dy * 12);
   g.lineStyle(2, 0xffffea, .9).strokeEllipse(x, y, 13, 13);
   break;
  case 'blast':
   g.fillStyle(0x8c312e, .8).fillCircle(x, y, 9);
   g.fillStyle(0xff962e, .95).fillCircle(x, y, 6);
   g.fillStyle(0xffedae, 1).fillCircle(x, y, 3);
   for (let i = 1; i < 4; i++) {
    g.fillStyle(0xa84423, .6 - i * .11).fillCircle(x - dx * i * 8, y - dy * i * 8, 5 + i * 2);
   }
   break;
 }
}

export function renderSkillEffect(g: Phaser.GameObjects.Graphics, effect: Effect, opacity: number) {
 const { kind, x, y, radius, angle, color, halfAngle, x2 = x, y2 = y } = effect;
 const progress = 1 - opacity;
 const alpha = Math.min(1, opacity * 1.6);
 switch (kind) {
  case 'whirl': {
   const span = halfAngle ?? 1;
   for (let i = 0; i < 3; i++) {
    const r = radius * (.68 + i * .16);
    g.lineStyle(6 - i, i === 1 ? 0xffefaa : color, alpha * .86).beginPath()
     .arc(x, y, r, angle - span + progress * .25 + i * .08, angle + span - i * .07).strokePath();
   }
   break;
  }
  case 'guard': {
   const r = radius * (.62 + progress * .38);
   if (halfAngle !== undefined) {
    for (let i = -2; i <= 2; i++) {
     const a = angle + i * halfAngle / 2, dx = Math.cos(a), dy = Math.sin(a);
     const bx = x + dx * r, by = y + dy * r;
     g.lineStyle(3, color, alpha).strokePoints([
      new Phaser.Math.Vector2(bx - dx * 13 + dy * 8, by - dy * 13 - dx * 8),
      new Phaser.Math.Vector2(bx, by),
      new Phaser.Math.Vector2(bx - dx * 13 - dy * 8, by - dy * 13 + dx * 8),
     ]);
    }
   } else {
    const corners = [new Phaser.Math.Vector2(x, y - r), new Phaser.Math.Vector2(x + r * .8, y - r * .65), new Phaser.Math.Vector2(x + r * .63, y + r * .4), new Phaser.Math.Vector2(x, y + r), new Phaser.Math.Vector2(x - r * .63, y + r * .4), new Phaser.Math.Vector2(x - r * .8, y - r * .65)];
    g.fillStyle(color, alpha * .18).fillPoints(corners, true);
    g.lineStyle(3, color, alpha).strokePoints(corners, true);
   }
   break;
  }
  case 'lance':
  case 'deadeye':
  case 'prism':
  case 'ricochet': {
   const dx = x2 - x, dy = y2 - y, length = Math.hypot(dx, dy) || 1;
   const width = kind === 'lance' ? radius * alpha : kind === 'prism' ? 8 : 4;
   const ox = dy / length * width, oy = -dx / length * width;
   if (kind === 'lance') {
    g.fillStyle(color, alpha * .86).fillTriangle(x - ox, y - oy, x + ox, y + oy, x2, y2);
   } else if (kind === 'ricochet') {
    for (let i = 1; i <= 5; i++) {
     const t = i / 5;
     g.fillStyle(color, alpha).fillRect(x + dx * t - 2, y + dy * t - 2, 4, 4);
    }
   } else {
    g.lineStyle(width + 3, kind === 'deadeye' ? 0xa45026 : color, alpha * .66).lineBetween(x, y, x2, y2);
    if (kind === 'prism') g.lineStyle(2, 0x65f1ea, alpha).lineBetween(x + ox, y + oy, x2, y2);
   }
   if (kind !== 'ricochet') g.lineStyle(kind === 'deadeye' ? 2 : 3, 0xfff5d5, alpha).lineBetween(x, y, x2, y2);
   const marker = radius * (.65 + progress * .72);
   g.lineStyle(2, color, alpha).strokeCircle(x2, y2, kind === 'lance' ? marker * .45 : marker);
   if (kind === 'deadeye') {
    g.lineBetween(x2 - marker - 6, y2, x2 - marker + 4, y2).lineBetween(x2 + marker - 4, y2, x2 + marker + 6, y2)
     .lineBetween(x2, y2 - marker - 6, x2, y2 - marker + 4).lineBetween(x2, y2 + marker - 4, x2, y2 + marker + 6);
   }
   break;
  }
  case 'quake':
  case 'blast': {
   const r = radius * (.23 + progress * .77);
   g.fillStyle(color, alpha * .19).fillCircle(x, y, r);
   g.lineStyle(kind === 'quake' ? 4 : 2, color, alpha).strokeCircle(x, y, r);
   for (let i = 0; i < 9; i++) {
    const a = i * 2.399, cx = Math.cos(a), cy = Math.sin(a);
    const inner = r * (.28 + .12 * (i % 3)), outer = r * (.7 + .08 * (i % 4));
    if (kind === 'quake') {
     const bend = (inner + outer) / 2;
     g.lineStyle(2.5, color, alpha).strokePoints([
      new Phaser.Math.Vector2(x + cx * inner, y + cy * inner),
      new Phaser.Math.Vector2(x + cx * bend + cy * 7, y + cy * bend - cx * 7),
      new Phaser.Math.Vector2(x + cx * outer, y + cy * outer),
     ]);
    } else {
     g.fillStyle(i % 2 ? color : 0xffce70, alpha).fillTriangle(
      x + cx * inner - cy * 6, y + cy * inner + cx * 6, x + cx * inner + cy * 6, y + cy * inner - cx * 6,
      x + cx * outer, y + cy * outer);
    }
   }
   break;
  }
  case 'sunder':
  case 'meteor': {
   const meteor = kind === 'meteor', fall = Math.max(0, 1 - progress * 3);
   const vertical = fall * (meteor ? 108 : 44);
   const drift = fall * (meteor ? 46 : -22);
   g.fillStyle(color, .23 * alpha).fillCircle(x, y, radius * (.7 + progress * .3));
   g.lineStyle(meteor ? 11 : 7, color, alpha).lineBetween(x + drift, y - vertical, x + drift * 2 + 18, y - vertical - 38);
   g.lineStyle(3, 0xffedb2, alpha).lineBetween(x + drift, y - vertical, x + drift * 2 + 18, y - vertical - 34);
   for (let i = 0; i < 7; i++) {
    const a = i * 2.399, r = radius * (.3 + progress * .8);
    const bx = x + Math.cos(a) * r, by = y + Math.sin(a) * r;
    g.fillStyle(i % 2 ? color : 0xffd779, alpha).fillRect(bx, by, 4, meteor ? 7 : 4);
   }
   break;
  }
  case 'snare':
  case 'frost':
  case 'gravity': {
   const r = radius * (kind === 'gravity' ? 1 - progress * .72 : .73 + progress * .27);
   g.fillStyle(color, alpha * .13).fillCircle(x, y, r);
   for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + (kind === 'gravity' ? progress * 2 : 0);
    const dx = Math.cos(a), dy = Math.sin(a), bx = x + dx * r, by = y + dy * r;
    if (kind === 'gravity') {
     g.lineStyle(4, color, alpha * .8).beginPath().arc(x, y, r * (.78 + i % 2 * .18), a, a + Math.PI / 4).strokePath();
    } else {
     g.lineStyle(2.4, color, alpha).lineBetween(bx, by, x + dx * r * .63, y + dy * r * .63);
     g.strokePoints([new Phaser.Math.Vector2(bx - dy * 7, by + dx * 7), new Phaser.Math.Vector2(bx - dx * 9, by - dy * 9), new Phaser.Math.Vector2(bx + dy * 7, by - dx * 7)]);
    }
   }
   if (kind === 'gravity') g.fillStyle(0x35224d, alpha).fillCircle(x, y, 6 + r * .14);
   else g.lineStyle(1.5, color, alpha * .72).strokeCircle(x, y, r);
   break;
  }
  case 'runeCross': {
   const width = (halfAngle ?? 14) * 2;
   const reach = radius * (.76 + progress * .24);
   g.fillStyle(color, alpha * .39).fillRect(x - reach, y - width / 2, reach * 2, width).fillRect(x - width / 2, y - reach, width, reach * 2);
   g.lineStyle(3, 0xffe9ff, alpha).lineBetween(x - reach, y, x + reach, y).lineBetween(x, y - reach, x, y + reach);
   g.lineStyle(2, color, alpha).strokePoints([new Phaser.Math.Vector2(x, y - width), new Phaser.Math.Vector2(x + width, y), new Phaser.Math.Vector2(x, y + width), new Phaser.Math.Vector2(x - width, y)], true);
   break;
  }
  default:
   return false;
 }
 return true;
}
