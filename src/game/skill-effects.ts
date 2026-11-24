import Phaser from 'phaser';
import { METEOR_SHOWER, WORLD } from './config';
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
   g.lineStyle(6, 0xab551e, .7).lineBetween(x - dx * 52, y - dy * 52, x + dx * 8, y + dy * 8);
   g.lineStyle(2, 0xfff3ab, 1).lineBetween(x - dx * 43, y - dy * 43, x + dx * 8, y + dy * 8);
   break;
  case 'snare':
   g.lineStyle(4, 0x156962, .88).lineBetween(x - dx * 21, y - dy * 21, x, y);
   g.fillStyle(0xb2ffdc, 1).fillCircle(x, y, 4);
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

export function renderShield(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, alpha: number) {
 const points = [
  new Phaser.Math.Vector2(x, y - radius),
  new Phaser.Math.Vector2(x + radius * .82, y - radius * .64),
  new Phaser.Math.Vector2(x + radius * .72, y + radius * .25),
  new Phaser.Math.Vector2(x, y + radius * .9),
  new Phaser.Math.Vector2(x - radius * .72, y + radius * .25),
  new Phaser.Math.Vector2(x - radius * .82, y - radius * .64),
 ];
 g.fillStyle(0x68d4ee, alpha * .13).fillPoints(points, true);
 g.lineStyle(5, 0x174e66, alpha * .88).strokePoints(points, true);
 g.lineStyle(2, 0xbdf4ff, alpha).strokePoints(points, true);
 g.fillStyle(0xeeffff, alpha).fillRect(x - 2, y - radius - 2, 4, 4);
}

export function renderMeteorShower(g: Phaser.GameObjects.Graphics, elapsed: number) {
 const { interval, waves, afterglow } = METEOR_SHOWER;
 for (let wave = 0; wave < waves; wave++) {
  const time = elapsed - wave * interval;
  if (time < 0 || time >= interval + afterglow) continue;
  const impact = time >= interval;
  const fade = impact ? 1 - (time - interval) / afterglow : 1;
  for (let index = 0; index < 16; index++) {
   const x = (index % 4 + .5) * WORLD.width / 4 + Math.sin(index * 2.3 + wave * 3.1) * 32;
   const y = (Math.floor(index / 4) + .5) * WORLD.height / 4 + Math.cos(index * 1.7 + wave * 2.2) * 49;
   if (impact) {
    const ring = 8 + 26 * (1 - fade);
    g.fillStyle(0xc75327, fade * .35).fillEllipse(x, y, ring * 2, ring);
    g.lineStyle(2.5, 0xffcf89, fade * .8).strokeEllipse(x, y, ring * 2, ring);
    g.fillStyle(0xffefb9, fade).fillRect(x - 2, y - 3, 4, 6);
   } else {
    const drop = (time / interval) ** (1.2 + .38 * (index % 3));
    const height = (1 - drop) * (140 + 18 * (index % 5));
    const bx = x - height * .48, by = y - height;
    g.lineStyle(1.5, 0xe4a967, drop * .58).strokeEllipse(x, y, 20, 10);
    g.lineStyle(8, 0xac4d2f, .78).lineBetween(bx - 21, by - 44, bx, by);
    g.lineStyle(4, 0xffa247, .94).lineBetween(bx - 15, by - 30, bx, by);
    g.fillStyle(0xffedab, 1).fillCircle(bx, by, 4);
   }
  }
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
  case 'shieldRaise':
   renderShield(g, x, y - 12, radius * (1.05 + progress * .65), opacity * .8);
   break;
  case 'shieldBreak': {
   const cy = y - 12, reach = radius * (.55 + progress);
   g.lineStyle(3, color, opacity).strokeCircle(x, cy, reach * .84);
   for (let i = 0; i < 7; i++) {
    const direction = i * Math.PI * 2 / 7;
    const dx = Math.cos(direction), dy = Math.sin(direction);
    const px = x + dx * reach, py = cy + dy * reach;
    g.fillStyle(i % 2 ? color : 0xefffff, alpha).fillTriangle(
     px + dx * 10, py + dy * 10, px - dx * 5 + dy * 5, py - dy * 5 - dx * 5, px - dx * 5 - dy * 5, py - dy * 5 + dx * 5);
   }
   break;
  }
  case 'bash': {
   const span = halfAngle ?? 1, front = radius * (.46 + progress * .54);
   g.lineStyle(13, 0x883d28, alpha * .78).beginPath().arc(x, y, front, angle - span, angle + span).strokePath();
   g.lineStyle(6, color, alpha).beginPath().arc(x, y, front, angle - span, angle + span).strokePath();
   g.lineStyle(2, 0xfff2ce, alpha).beginPath().arc(x, y, front + 4, angle - span * .75, angle + span * .75).strokePath();
   break;
  }
  case 'bashImpact': {
   const dx = x2 - x, dy = y2 - y, length = Math.hypot(dx, dy) || 1;
   const ox = dy / length * 7, oy = -dx / length * 7;
   g.fillStyle(0xb46e3f, opacity * .33).fillTriangle(x + ox, y + oy, x - ox, y - oy, x2, y2);
   for (let i = 1; i <= 5; i++) {
    const t = (i - .5) / 5;
    g.lineStyle(2.5, i % 2 ? color : 0xffe4af, opacity * .7)
     .lineBetween(x + dx * t + ox, y + dy * t + oy, x + dx * (t + .06) + ox, y + dy * (t + .06) + oy);
   }
   g.lineStyle(2, color, opacity).strokeCircle(x2, y2, radius * (.4 + progress));
   break;
  }
  case 'lance':
  case 'deadeye':
  case 'prism': {
   const dx = x2 - x, dy = y2 - y, length = Math.hypot(dx, dy) || 1;
   const width = kind === 'lance' ? radius * alpha : kind === 'prism' ? 8 : 4;
   const ox = dy / length * width, oy = -dx / length * width;
   if (kind === 'lance') {
    g.fillStyle(color, alpha * .86).fillTriangle(x - ox, y - oy, x + ox, y + oy, x2, y2);
   } else {
    g.lineStyle(width + 3, kind === 'deadeye' ? 0xa45026 : color, alpha * .66).lineBetween(x, y, x2, y2);
    if (kind === 'prism') g.lineStyle(2, 0x65f1ea, alpha).lineBetween(x + ox, y + oy, x2, y2);
   }
   g.lineStyle(kind === 'deadeye' ? 2 : 3, 0xfff5d5, alpha).lineBetween(x, y, x2, y2);
   const marker = radius * (.65 + progress * .72);
   g.lineStyle(2, color, alpha).strokeCircle(x2, y2, kind === 'lance' ? marker * .45 : marker);
   if (kind === 'deadeye') {
    g.lineBetween(x2 - marker - 6, y2, x2 - marker + 4, y2).lineBetween(x2 + marker - 4, y2, x2 + marker + 6, y2)
     .lineBetween(x2, y2 - marker - 6, x2, y2 - marker + 4).lineBetween(x2, y2 + marker - 4, x2, y2 + marker + 6);
   }
   break;
  }
  case 'ricochet': {
   const dx = x2 - x, dy = y2 - y, length = Math.hypot(dx, dy) || 1;
   const ox = -dy / length, oy = dx / length;
   const points = [new Phaser.Math.Vector2(x, y)];
   for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const offset = (i % 2 ? -1 : 1) * Math.min(10, length * .12) * (.7 + .3 * Math.cos(i + angle + progress * 13));
    points.push(new Phaser.Math.Vector2(x + dx * t + ox * offset, y + dy * t + oy * offset));
   }
   points.push(new Phaser.Math.Vector2(x2, y2));
   const midpoint = points[3];
   g.lineStyle(6, 0x247fc4, opacity * .6).strokePoints(points);
   g.lineStyle(3, color, alpha).strokePoints(points);
   g.lineStyle(1.2, 0xefffff, alpha).strokePoints(points);
   g.lineStyle(1.5, color, opacity).lineBetween(midpoint.x, midpoint.y, midpoint.x + dx * .19 + ox * 12, midpoint.y + dy * .19 + oy * 12);
   g.lineStyle(1.5, 0xb5faff, opacity).strokeCircle(x2, y2, 3 + progress * 12);
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
  case 'sunder': {
   const fall = Math.max(0, 1 - progress * 3);
   const vertical = fall * 44, drift = fall * -22;
   g.fillStyle(color, .23 * alpha).fillCircle(x, y, radius * (.7 + progress * .3));
   g.lineStyle(7, color, alpha).lineBetween(x + drift, y - vertical, x + drift * 2 + 18, y - vertical - 38);
   g.lineStyle(3, 0xffedb2, alpha).lineBetween(x + drift, y - vertical, x + drift * 2 + 18, y - vertical - 34);
   for (let i = 0; i < 7; i++) {
    const a = i * 2.399, r = radius * (.3 + progress * .8);
    const bx = x + Math.cos(a) * r, by = y + Math.sin(a) * r;
    g.fillStyle(i % 2 ? color : 0xffd779, alpha).fillRect(bx, by, 4, 4);
   }
   break;
  }
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
   g.lineStyle(2, 0xf5b4ff, opacity * .86).strokeCircle(x, y, width * (.46 + progress * .28));
   g.lineStyle(2, color, alpha).strokePoints([new Phaser.Math.Vector2(x, y - width), new Phaser.Math.Vector2(x + width, y), new Phaser.Math.Vector2(x, y + width), new Phaser.Math.Vector2(x - width, y)], true);
   for (let arm = 0; arm < 4; arm++) {
    const angle = arm * Math.PI / 2, dx = Math.cos(angle), dy = Math.sin(angle);
    for (const mark of [.48, .76]) {
     const bx = x + dx * reach * mark, by = y + dy * reach * mark;
     g.lineBetween(bx - dy * 8, by + dx * 8, bx + dy * 8, by - dx * 8);
    }
    g.fillStyle(0xfff4ff, opacity).fillRect(x + dx * reach - 2, y + dy * reach - 2, 4, 4);
   }
   break;
  }
  default:
   return false;
 }
 return true;
}
