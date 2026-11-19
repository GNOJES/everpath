import Phaser from 'phaser';
import { createArt } from './art';
import { WORLD as W, BALANCE, BOSS_PATTERN, HEROES, ENEMIES, SKILLS, isBoss } from './config';
import { PlayerInput } from './input';
import { GameSimulation } from './simulation';
import { GameAudio } from './audio';
import { clamp } from './math';
import type { InputObservation } from '../diagnostics/types';
import type { RunState } from './types';

class ImagePool {
 private images: Phaser.GameObjects.Image[] = [];
 constructor(private scene: Phaser.Scene) {}
 at(index: number, texture: string) { let image = this.images[index]; if (!image) { image = this.scene.add.image(0, 0, texture); this.images.push(image); } image.setVisible(true); if (image.texture.key !== texture) image.setTexture(texture); return image; }
 trim(count: number) { for (let i = count; i < this.images.length; i++) this.images[i].setVisible(false); }
}
export class ForestScene extends Phaser.Scene {
 simulation?: GameSimulation; controls!: PlayerInput; audio = new GameAudio();
 onReady?: () => void; onFrame?: (state?: RunState, victoryFxTime?: number) => void; onPause?: () => void; onInputObservation?: (event: InputObservation) => void; onInputFrame?: (at: number) => void;
 private announcedBosses = new Set<number>(); private lastShotSound = 0;
 private ground!: Phaser.GameObjects.TileSprite; private actors!: ImagePool; private shots!: ImagePool;
 private shadows!: Phaser.GameObjects.Graphics; private fx!: Phaser.GameObjects.Graphics; private joystick!: Phaser.GameObjects.Graphics;
 private hero!: Phaser.GameObjects.Image; private companions: Phaser.GameObjects.Image[] = []; private scenery: { image: Phaser.GameObjects.Image; y: number; x: number }[] = [];
 private labels: Phaser.GameObjects.Text[] = []; private titleScroll = 0; private clock = 0; private lastEffect = 0; private victoryFxTime = 0;
 constructor() { super('forest'); }
 create() {
  createArt(this); this.ground = this.add.tileSprite(216, 384, 432, 768, 'terrain').setDepth(-10);
  this.shadows = this.add.graphics().setDepth(5); this.fx = this.add.graphics().setDepth(2000); this.joystick = this.add.graphics().setDepth(3000);
  for (let i = 0; i < 24; i++) { const row = Math.floor(i / 2), left = i % 2 === 0; const x = left ? 8 + Math.sin(i * 41) * 28 : 417 + Math.sin(i * 17) * 25; const y = row * 102 - 120; const image = this.add.image(x, y, i % 4 === 0 ? 'pine' : 'tree').setOrigin(.5, 1).setScale(i % 4 === 0 ? 1.25 : 1.35); this.scenery.push({ image, x, y }); }
  for (let i = 0; i < 22; i++) { const x = i % 2 ? 323 + (i * 17 % 59) : 48 + (i * 17 % 58), y = i * 56; const key = ['bush', 'rock', 'bush', 'mushroom', 'stump'][i % 5]; const image = this.add.image(x, y, key).setOrigin(.5, 1).setScale(1.7); this.scenery.push({ image, x, y }); }
  for (const [x, y] of [[133, 480], [299, 1010]]) { const image = this.add.image(x, y, 'lantern').setOrigin(.5, 1).setScale(1.8); this.scenery.push({ image, x, y }); }
  this.actors = new ImagePool(this); this.shots = new ImagePool(this); this.hero = this.add.image(216, 515, 'warrior').setScale(2.4).setOrigin(.5, .8);
  this.companions = [this.add.image(174, 559, 'archer'), this.add.image(263, 548, 'mage')]; this.companions.forEach(image => image.setScale(2.25).setOrigin(.5, .8));
  this.controls = new PlayerInput(this.game.canvas, () => this.onPause?.(), event => this.onInputObservation?.(event));
  this.events.once('shutdown', () => this.controls.destroy()); this.onReady?.();
 }
 setRun(sim?: GameSimulation) { this.simulation = sim; this.controls?.reset(); this.lastEffect = 0; this.victoryFxTime = 0; this.announcedBosses.clear(); this.lastShotSound = 0; }
 update(_time: number, delta: number) {
  const dt = Math.min(delta / 1000, .05); const sim = this.simulation; if (!sim || sim.state.status === 'running') this.clock += dt;
  if (sim) { const direction = this.controls.direction(); if (sim.state.status === 'running') this.onInputFrame?.(performance.now()); sim.update(dt, direction); } else this.titleScroll += dt * 9;
  if (sim?.state.status === 'victory') this.victoryFxTime += dt;
  const s = sim?.state, scroll = s?.scroll ?? this.titleScroll; this.ground.tilePositionY = -scroll;
  for (const prop of this.scenery) { const y = ((prop.y + scroll) % 1240 + 1240) % 1240 - 175; prop.image.setPosition(prop.x, y).setDepth(50 + y); }
  this.shadows.clear(); this.fx.clear();
  this.hero.setTint(s?.evolved ? 0xffe9a8 : 0xffffff); this.hero.setTexture(s?.hero ?? 'warrior'); const p = s?.player ?? { x: 216, y: 480, invincible: 0, facing: 0, shield: 0 };
  const moving = s && s.status === 'running' && Math.hypot(this.controls.direction().x, this.controls.direction().y) > .01;
  this.hero.setPosition(p.x, p.y + (moving ? Math.sin(this.clock * 18) * 1.5 : Math.sin(this.clock * 2) * .7)).setDepth(100 + p.y).setFlipX(Math.cos(p.facing) < -.2).setAlpha(p.invincible > 0 && Math.sin(this.clock * 40) > 0 ? .4 : 1);
  this.shadow(p.x, p.y + 7, 18, 7);
  this.companions.forEach((image, i) => { image.setVisible(!s); if (!s) { image.y = 530 + i * 12 + Math.sin(this.clock * 2 + i) * .8; image.setDepth(100 + image.y); this.shadow(image.x, image.y + 7, 15, 6); } });
  if (s) { this.renderEnemies(s); this.renderShots(s); this.renderHazards(s); this.renderPickups(s); this.renderEffects(s); if (p.shield) { this.fx.lineStyle(1.5, 0xf2da99, .75); this.fx.strokeCircle(p.x, p.y - 9, 27); } if (s.skills.frost) { this.fx.lineStyle(1, 0xb0e5dc, .2 + Math.sin(this.clock * 3) * .1); this.fx.strokeCircle(p.x, p.y, SKILLS.frost.radius + (s.skills.frost - 1) * BALANCE.skillRadiusStep); } }
  else { this.actors.trim(0); this.shots.trim(0); for (const label of this.labels) label.setVisible(false); }
  // Small drifting spores are bounded and deterministic, rather than particle emitters.
  for (let i = 0; i < 17; i++) { const x = ((i * 107 + Math.sin(this.clock * .6 + i) * 18) % 430 + 430) % 430, y = (i * 61 + this.clock * (6 + i % 4)) % 768; this.fx.fillStyle(0xf5dca0, .15 + (Math.sin(this.clock * 1.3 + i) + 1) * .15); this.fx.fillRect(x, y, 2, 2); }
  if (s?.status === 'running') { for (const e of s.enemies) if (isBoss(e.kind) && !this.announcedBosses.has(e.id)) { this.announcedBosses.add(e.id); this.audio.boss(); } const shot = s.projectiles.find(p => p.kind !== 'enemy' && p.id > this.lastShotSound); if (shot) { this.lastShotSound = Math.max(...s.projectiles.map(p => p.id)); this.audio.attack(s.hero); } }
  this.renderJoystick(s); this.audio.tick(dt, s?.status === 'running'); this.onFrame?.(s, this.victoryFxTime);
 }
 private shadow(x: number, y: number, w: number, h: number) { this.shadows.fillStyle(0x34475d, .26); this.shadows.fillEllipse(x, y, w * 2, h * 2); }
 private renderEnemies(s: RunState) {
  const living = s.enemies.filter(enemy => enemy.hp > 0);
  living.forEach((e, i) => { const image = this.actors.at(i, e.kind); image.setPosition(e.x, e.y + (s.timeStopRemaining > 0 ? 0 : Math.sin(this.clock * (e.kind === 'bat' ? 15 : 7) + e.seed) * (e.kind === 'bat' ? 4 : 1))).setOrigin(.5, .8).setDepth(100 + e.y).setScale(isBoss(e.kind) ? 2.9 : e.elite ? 2.6 : 2.2).setFlipX(e.x > s.player.x); image.setTint(s.timeStopRemaining > 0 ? 0xb7e2ff : e.hitFlash > 0 ? 0xffffff : e.elite ? 0xffdc98 : 0xffffff);
   image.setAlpha(e.hitFlash > 0 ? .6 : 1); this.shadow(e.x, e.y + 5, e.radius * 1.2, 5);
   if (isBoss(e.kind)) this.renderBossHealth(e);
   else if (e.hp < e.maxHp) {
    this.fx.fillStyle(0x172824, .8).fillRect(e.x - 13, e.y - 35, 26, 3);
    this.fx.fillStyle(e.elite ? 0xe1b46b : 0xaec17d).fillRect(e.x - 13, e.y - 35, 26 * Math.max(0, e.hp / e.maxHp), 3);
   }
   if (e.kind === 'warden') this.fx.lineStyle(2, 0xd0a3e9, .6).strokeCircle(e.x, e.y - 12, e.radius + 12 + Math.sin(this.clock * 3) * 4);
   if (isBoss(e.kind) && e.phase === 'warn') {
    const travel = BOSS_PATTERN.dashSpeed * BOSS_PATTERN.dashDuration, side = { x: -e.aim.y * e.radius, y: e.aim.x * e.radius };
    const start = { x: e.x - e.aim.x * e.radius, y: e.y - e.aim.y * e.radius }, end = { x: e.x + e.aim.x * (travel + e.radius), y: e.y + e.aim.y * (travel + e.radius) };
    const lane = [new Phaser.Math.Vector2(start.x + side.x, start.y + side.y), new Phaser.Math.Vector2(end.x + side.x, end.y + side.y), new Phaser.Math.Vector2(end.x - side.x, end.y - side.y), new Phaser.Math.Vector2(start.x - side.x, start.y - side.y)];
    this.fx.fillStyle(0xe58165, .2 + Math.sin(this.clock * 16) * .05).fillPoints(lane, true);
    this.fx.lineStyle(2, 0xffba8f, .8).strokePoints(lane, true);
    this.fx.lineStyle(1, 0xffd6a6, .7).lineBetween(e.x, e.y, end.x, end.y);
   }
  }); this.actors.trim(living.length);
 }
 private renderBossHealth(boss: RunState['enemies'][number]) {
  // Same origin and scale as the sprite; the bar enters the field with its boss.
  const height = this.textures.getFrame(boss.kind).height;
  const head = boss.y - height * 2.9 * .8 - 12;
  if (boss.entryTarget && head < 0) return;
  const y = Math.max(3, head);
  const final = boss.kind === 'warden', width = final ? 92 : 68;
  const x = clamp(boss.x - width / 2, 3, W.width - width - 3);
  const fill = width * clamp(boss.hp / boss.maxHp, 0, 1);
  this.fx.fillStyle(0x222337, 1).fillRect(x - 2, y - 2, width + 4, 11);
  this.fx.fillStyle(final ? 0xcaa1ff : 0xffab4f, 1).fillRect(x, y, fill, 7);
  this.fx.fillStyle(0xffffff, .48).fillRect(x, y, fill, 2);
 }
 private renderShots(s: RunState) {
  s.projectiles.forEach((shot, i) => {
   const image = this.shots.at(i, shot.kind);
   const angle = Math.atan2(shot.vy, shot.vx);
   image.setPosition(shot.x, shot.y).setDepth(1600).setRotation(angle).setScale(shot.kind === 'blade' ? 1.8 : 1.45);
   if (shot.kind === 'enemy') return;
   const length = shot.kind === 'arrow' ? 29 : 19;
   const color = shot.kind === 'magic' ? 0x795dff : shot.kind === 'blade' ? 0x1badb7 : 0xe85e33;
   const dx = Math.cos(angle), dy = Math.sin(angle);
   const tip = { x: shot.x + dx * 4, y: shot.y + dy * 4 };
   const tail = { x: shot.x - dx * length, y: shot.y - dy * length };
   const spread = shot.kind === 'arrow' ? 3 : 6;
   this.fx.fillStyle(color, .55).fillTriangle(tail.x, tail.y,
    tip.x - dy * spread, tip.y + dx * spread, tip.x + dy * spread, tip.y - dx * spread);
   this.fx.lineStyle(1.6, 0xfff5e3, .9)
    .lineBetween(shot.x - dx * length * .52, shot.y - dy * length * .52, tip.x, tip.y);
  });
  this.shots.trim(s.projectiles.length);
 }
 private renderHazards(s: RunState) {
  const g = this.fx;
  for (const h of s.hazards) {
   const hostile = h.owner === 'enemy', color = hostile ? 0xd92e61 : 0x1b8cba;
   const progress = h.fired ? 1 : clamp(1 - h.delay / (h.windup ?? .65), 0, 1);
   g.fillStyle(color, h.fired ? .31 : .10 + progress * .10).fillCircle(h.x, h.y, h.radius);
   g.lineStyle(hostile ? 2.5 : 5, hostile ? 0x652b57 : 0x235477, hostile ? .40 : .77).strokeCircle(h.x, h.y, h.radius);
   g.lineStyle(hostile ? 1 : 2, hostile ? 0xffe2cf : 0xccfdff, hostile ? .63 : .95).strokeCircle(h.x, h.y, h.radius);
   if (!h.fired) {
    g.lineStyle(hostile ? 2.5 : 4, color, hostile ? .72 : 1).beginPath().arc(h.x, h.y, h.radius + 3, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2).strokePath();
    if (hostile) g.lineStyle(3, 0x82274e, .92).lineBetween(h.x, h.y - 11, h.x, h.y + 2).fillStyle(0x82274e, 1).fillCircle(h.x, h.y + 8, 2);
   } else if (!hostile) {
    for (let i = 0; i < 15; i++) {
     const a = i * 2.399, radius = Math.sqrt(i / 15) * h.radius;
     const x = h.x + Math.cos(a) * radius, y = h.y + Math.sin(a) * radius;
     g.lineStyle(3, i % 2 ? 0x247fa4 : 0xf3feff, .8).lineBetween(x + 13, y - 27, x, y);
    }
   }
  }
 }
 private renderPickups(s: RunState) {
  const g = this.fx;
  for (const { x, y, kind, life } of s.pickups) {
   const lift = y - 10 + Math.sin(this.clock * 4 + x) * 2;
   const alpha = clamp(life, .25, 1);
   g.fillStyle(0x172927, .4 * alpha).fillEllipse(x, y + 5, kind === 'chest' ? 34 : 20, 8);
   if (kind === 'chest') {
    g.fillStyle(0xffcf69, .15 * alpha).fillCircle(x, lift, 29);
    g.fillStyle(0x71452e, alpha).fillRoundedRect(x - 14, lift - 9, 28, 20, 4);
    g.lineStyle(2, 0xffdd92, alpha).strokeRoundedRect(x - 14, lift - 9, 28, 20, 4);
    g.lineBetween(x - 14, lift, x + 14, lift);
    g.fillStyle(0xffdc82, alpha).fillRect(x - 3, lift - 3, 6, 8);
   } else if (kind === 'heal') {
    g.fillStyle(0x58cda0, .22 * alpha).fillCircle(x, lift, 20);
    g.fillStyle(0x39785e, alpha).fillCircle(x, lift + 1, 9);
    g.lineStyle(2, 0xc7f7c8, alpha).strokeCircle(x, lift + 1, 9);
    g.lineBetween(x - 4, lift + 1, x + 4, lift + 1).lineBetween(x, lift - 3, x, lift + 5);
   } else {
    g.fillStyle(0xe3a640, alpha).fillCircle(x, lift, 7);
    g.lineStyle(1.4, 0xffe197, alpha).strokeCircle(x, lift, 7);
    g.lineBetween(x, lift - 3, x, lift + 3);
   }
  }
 }
 private renderEffects(s: RunState) {
  let labelIndex = 0;
  for (const e of s.effects) {
   const remaining = e.life - this.victoryFxTime;
   if (remaining <= 0) continue;
   const f = remaining / e.duration, progress = 1 - f, g = this.fx;
   if (e.kind === 'boss-death') {
    if (e.id > this.lastEffect) this.audio.bossDefeated(s.status === 'victory');
    const radius = e.radius * (1 - f * f);
    g.fillStyle(e.color, f * f * .25).fillCircle(e.x, e.y, radius);
    g.lineStyle(3 + 6 * f, 0xffe5af, f * .9).strokeCircle(e.x, e.y, radius);
    g.lineStyle(2, e.color, f * .65).strokeCircle(e.x, e.y, radius * .71);
    for (let i = 0; i < 32; i++) {
     const angle = i * 2.399, travel = radius * (.4 + i % 7 / 10);
     const x = e.x + Math.cos(angle) * travel, y = e.y + Math.sin(angle) * travel - 30 * progress;
     g.fillStyle(i % 2 ? e.color : 0xfff6d7, f).fillRect(x, y, 3 + i % 4, 4 + i % 5);
    }
    continue;
   }
   if (e.kind === 'text') { if (labelIndex >= 32) continue; let label = this.labels[labelIndex++]; if (!label) { label = this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '17px', color: '#fff0cd', stroke: '#27372c', strokeThickness: 3, fontStyle: 'bold' }).setOrigin(.5).setDepth(2100); this.labels.push(label); } label.setText(e.text ?? '').setPosition(e.x, e.y - progress * 27).setAlpha(Math.min(1, f * 2)).setVisible(true); continue; }
   if (e.id > this.lastEffect && e.kind === 'hit') { if (e.color === 0xf2937e) this.audio.hurt(); else this.audio.hit(); }
   if (e.id > this.lastEffect && e.kind === 'slash' && s.status === 'running') this.audio.attack(s.hero);
   g.lineStyle(2, e.color, f);
   if (e.kind === 'slash') {
    const span = e.halfAngle ?? Math.PI / 4;
    const radius = e.radius * (.85 + progress * .15);
    const segments = 18;
    const inner = (angle: number) => radius - 14 * Math.max(0, 1 - Math.abs(angle - e.angle) / span) * f;
    g.fillStyle(e.color, f * .82);
    for (let i = 0; i < segments; i++) {
     const a = e.angle - span + i / segments * span * 2;
     const b = e.angle - span + (i + 1) / segments * span * 2;
     const ax = Math.cos(a), ay = Math.sin(a), bx = Math.cos(b), by = Math.sin(b);
     g.fillTriangle(e.x + ax * radius, e.y + ay * radius, e.x + bx * radius, e.y + by * radius,
      e.x + ax * inner(a), e.y + ay * inner(a));
     g.fillTriangle(e.x + ax * inner(a), e.y + ay * inner(a), e.x + bx * radius, e.y + by * radius,
      e.x + bx * inner(b), e.y + by * inner(b));
    }
    g.lineStyle(2.5, 0xfff9e9, f).beginPath()
     .arc(e.x, e.y, radius, e.angle - span, e.angle + span).strokePath();
    g.lineStyle(1.5, 0x994e27, f * .65).beginPath()
     .arc(e.x, e.y, radius - 5, e.angle - span * .76, e.angle + span * .76).strokePath();
   }
   else if (e.kind === 'crystal') {
    g.lineStyle(2, 0xfff5ef, f * .72).strokeCircle(e.x, e.y, 4 + e.radius * progress);
    for (let i = 0; i < 7; i++) {
     const angle = i * 2.399, x = e.x + Math.cos(angle) * e.radius * progress, y = e.y + Math.sin(angle) * e.radius * progress;
     g.fillStyle(i % 2 ? e.color : 0xfff1ff, f).fillTriangle(x, y - 8, x + 4, y, x - 3, y + 4);
    }
   }
   else if (e.kind === 'ring') { g.strokeCircle(e.x, e.y, e.radius * (.7 + progress * .3)); g.lineStyle(1, e.color, f * .3).strokeCircle(e.x, e.y, e.radius * (.5 + progress * .3)); }
   else if (e.kind === 'fire') { g.fillStyle(e.color, f * .22).fillCircle(e.x, e.y, e.radius * (.5 + progress * .5)); for (let i = 0; i < 15; i++) { const a = i * 2.4, r = e.radius * progress; g.fillStyle(i % 2 ? e.color : 0xffe1aa, f).fillRect(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 4, 6); } }
   else if (e.kind === 'lightning') { const x2 = e.x2 ?? e.x, y2 = e.y2 ?? e.y; g.lineStyle(5, e.color, f); g.beginPath().moveTo(e.x, e.y); for (let i = 1; i < 7; i++) g.lineTo(e.x + (x2 - e.x) * i / 7 + Math.sin(i * 27) * 10, e.y + (y2 - e.y) * i / 7 + Math.cos(i * 14) * 10); g.lineTo(x2, y2).strokePath(); g.fillStyle(0xf0ecff, f).fillCircle(x2, y2, 12 * f); }
   else { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.fillStyle(e.color, f).fillRect(e.x + Math.cos(a) * e.radius * progress, e.y + Math.sin(a) * e.radius * progress, 3, 3); } }
  }
  this.lastEffect = s.effects.reduce((max, e) => Math.max(max, e.id), this.lastEffect); for (let i = labelIndex; i < this.labels.length; i++) this.labels[i].setVisible(false);
 }
 private renderJoystick(s?: RunState) {
  const g = this.joystick; g.clear(); if (!this.controls.dragging || s?.status !== 'running') return;
  const c = this.controls.center, t = this.controls.thumb, dx = t.x - c.x, dy = t.y - c.y, len = Math.hypot(dx, dy), factor = Math.min(1, W.joystickRadius / (len || 1));
  g.fillStyle(0x172b28, .18).fillCircle(c.x, c.y, W.joystickRadius); g.lineStyle(1, 0xe5e8cd, .32).strokeCircle(c.x, c.y, W.joystickRadius); g.fillStyle(0xe5e8cd, .34).fillCircle(c.x + dx * factor, c.y + dy * factor, 18); g.lineStyle(1, 0xf8eed2, .4).strokeCircle(c.x + dx * factor, c.y + dy * factor, 18);
 }
}
