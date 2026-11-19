import { BALANCE as B, WORLD as W, HEROES, ENEMIES, SKILLS, PERMANENT, BOSS_PATTERN, CAMPAIGN, EVOLUTIONS, WARRIOR_WEAPON_STEPS, isBoss } from './config';
import { clamp, distance, normalize, unit } from './math';
import { rollUpgrades } from './progression';
import { spawnInterval, chooseEnemyKind } from './encounters';
import type { HeroId, SaveData, RunState, Vec, EnemyKind, Enemy, Projectile, Effect, PassiveId, RunResult } from './types';
let runCounter = 0;
export function createRun(hero: HeroId, save: SaveData, rank = 0): RunState {
 const config = HEROES[hero], maxHp = Math.round(config.hp * (1 + save.upgrades.hp * PERMANENT.hp.step));
 return { runId: `${Date.now()}-${++runCounter}-${Math.random().toString(36).slice(2)}`, hero, status: 'running', elapsed: 0, rank, evolved: false, finalSpawned: false, supplies: 0, scroll: 0,
  player: { x: W.width / 2, y: 515, hp: maxHp, maxHp, speed: config.speed * (1 + save.upgrades.speed * PERMANENT.speed.step), invincible: 0, shield: 0, facing: -Math.PI / 2 },
  enemies: [], projectiles: [], effects: [], hazards: [], level: 1, xp: 0, xpNext: B.initialXp, kills: 0, spawned: 0, escaped: 0, withdrawn: 0, bosses: 0, gold: 0, weaponLevel: 1, skills: {}, passives: { power: 0, haste: 0, vitality: 0, speed: 0 }, choices: [], nextBoss: B.bossAt };
}
export class GameSimulation {
 readonly state: RunState;
 private serial = 0; private spawnTimer = B.firstSpawn; private attackTimer = .1; private skillTimers: Record<string, number> = {}; private pendingChoices = 0; private goldRaw = 0;
 constructor(hero: HeroId, private save: SaveData, private random: () => number = Math.random, rank = 0) { this.save = structuredClone(save); this.state = createRun(hero, this.save, Math.floor(clamp(rank, 0, save.challengeUnlocked))); }
 private hasWon() { return this.state.status === 'victory'; }
 get power() { return HEROES[this.state.hero].damage * (1 + this.save.upgrades.attack * PERMANENT.attack.step) * (1 + this.state.passives.power * B.powerStep); }
 get damage() {
  const { hero, weaponLevel, evolved } = this.state;
  const weaponScale = hero === 'warrior'
   ? WARRIOR_WEAPON_STEPS[weaponLevel - 1]
   : 1 + (weaponLevel - 1) * B.weaponDamageStep;
  return this.power * weaponScale * (evolved ? EVOLUTIONS[hero].damageMultiplier : 1);
 }
 get haste() { return 1 + this.state.passives.haste * B.hasteStep; }
 get weaponHaste() { return this.haste + (this.state.weaponLevel - 1) * B.weaponHasteStep + (this.state.evolved ? .25 : 0); }
 get range() { return HEROES[this.state.hero].range * (1 + (this.state.weaponLevel - 1) * B.weaponRangeStep) * (this.state.evolved ? 1.25 : 1); }
 pause() { if (this.state.status === 'running') this.state.status = 'paused'; }
 resume() { if (this.state.status === 'paused') this.state.status = 'running'; }
 update(seconds: number, direction: Vec = { x: 0, y: 0 }) {
  const s = this.state; if (s.status !== 'running') return; const dt = clamp(seconds, 0, .05), p = s.player;
  s.elapsed += dt; s.scroll += W.scrollSpeed * dt; p.invincible = Math.max(0, p.invincible - dt);
  const input = normalize(direction.x, direction.y); p.x = clamp(p.x + input.x * p.speed * dt, W.margin, W.width - W.margin); p.y = clamp(p.y + input.y * p.speed * dt, W.minY, W.height - W.margin);
  if (input.x || input.y) p.facing = Math.atan2(input.y, input.x);
  if (s.elapsed >= (s.supplies + 1) * 120 && s.supplies < 4) { s.supplies++; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * CAMPAIGN.supplyHeal); this.goldRaw += 15; s.gold = Math.floor(this.goldRaw); this.effect('text', p, 0xcce8ad, 0, 2, 0, '보급 · 체력 +30% · 15G'); }
  if (s.elapsed >= CAMPAIGN.finalAt && !s.finalSpawned) {
   s.finalSpawned = true; s.withdrawn += s.enemies.filter(e => e.hp > 0).length; s.enemies = []; s.projectiles = []; s.hazards = []; this.spawnEnemy('warden', W.width / 2, 170); s.nextBoss = Infinity;
   const heal = Math.min(p.maxHp - p.hp, p.maxHp * CAMPAIGN.arenaHeal * this.save.upgrades.hp / B.permanentMax);
   p.hp += heal;
   this.effect('text', { x: W.width / 2, y: 260 }, 0xffd38a, 0, 3, 0, heal >= 1 ? `모르바 등장 · 체력 +${Math.floor(heal)}` : '모르바 등장');
  }
  if (s.finalSpawned && s.elapsed >= CAMPAIGN.finalAt + CAMPAIGN.arenaLimit) { p.shield = 0; p.invincible = 0; this.damagePlayer(p.hp); return; }
  this.spawnTimer -= dt; if (!s.finalSpawned && this.spawnTimer <= 0) { this.spawnWave(); this.spawnTimer = spawnInterval(s.elapsed); }
  if (!s.finalSpawned && s.elapsed >= s.nextBoss && s.nextBoss < 540) { this.spawnEnemy('boss', W.width / 2, 162); s.nextBoss += B.bossEvery; this.effect('text', { x: W.width / 2, y: 215 }, 0xffd38a, 0, 2, 0, '그롬 등장'); }
  this.moveEnemies(dt); if (p.hp <= 0) return;
  this.attackTimer -= dt; if (this.attackTimer <= 0) { if (this.basicAttack()) this.attackTimer = HEROES[s.hero].cooldown / this.weaponHaste; }
  if (this.hasWon()) return;
  for (const id of HEROES[s.hero].skills) {
   if (!s.skills[id]) continue; this.skillTimers[id] = (this.skillTimers[id] ?? 0) - dt;
   if (this.skillTimers[id] <= 0 && this.castSkill(id, s.skills[id])) this.skillTimers[id] = SKILLS[id].cooldown / this.haste / (1 + (s.skills[id] - 1) * (SKILLS[id].hastePerLevel ?? B.skillHasteStep));
  }
  if (this.hasWon()) return;
  this.moveProjectiles(dt); if (this.hasWon()) return; if (p.hp <= 0) return; this.updateHazards(dt);
  for (const effect of s.effects) effect.life -= dt;
  s.effects = s.effects.filter(e => e.life > 0); s.enemies = s.enemies.filter(e => { if (e.hp <= 0) return false; const inside = e.y < W.height + 70 && e.y > -160 && e.x > -130 && e.x < W.width + 130; if (!inside) s.escaped++; return inside; });
 }
 spawnEnemy(kind: EnemyKind, x: number, y: number): Enemy | undefined {
  const s = this.state;
  if (s.enemies.length >= W.maxEnemies) {
   if (!isBoss(kind)) return;
   const replace = s.enemies.findIndex(e => !isBoss(e.kind)); if (replace < 0) return;
   if (s.enemies[replace].hp > 0) s.withdrawn++; s.enemies.splice(replace, 1);
  }
  const cfg = ENEMIES[kind], elite = !isBoss(kind) && s.elapsed > B.eliteAfter && this.random() < Math.min(.23, (s.elapsed - B.eliteAfter) / 1800), scale = (1 + s.elapsed * B.enemyHpGrowth) * (1 + s.rank * .35);
  const hp = cfg.hp * (kind === 'warden' ? 1 + s.rank * .35 : scale) * (elite ? 2.3 : 1) * (kind === 'boss' ? 1 + s.bosses * .35 : 1);
  const enemy: Enemy = { id: ++this.serial, kind, x, y, hp, maxHp: hp, speed: cfg.speed * Math.min(B.maxEnemySpeedScale, 1 + s.elapsed * B.enemySpeedGrowth), damage: cfg.damage * (1 + s.elapsed / 600) * (elite ? 1.3 : 1), radius: cfg.radius * (elite ? 1.2 : 1), elite, timer: isBoss(kind) ? 3 : 1.8 + this.random(), phase: 'chase', aim: { x: 0, y: 1 }, hitFlash: 0, seed: this.random() * Math.PI * 2 };
  s.enemies.push(enemy); s.spawned++; return enemy;
 }
 private spawnWave() {
  if (this.state.spawned === 0) {
   for (const x of [112, 216, 320]) this.spawnEnemy('slime', x, 280);
   return;
  }
  const t = this.state.elapsed, kind = chooseEnemyKind(t, this.random), side = this.random();
  let x = 32 + this.random() * (W.width - 64), y = -24 - this.random() * 50;
  if (t > 30 && side < .28) { x = side < .14 ? -20 : W.width + 20; y = 125 + this.random() * 330; }
  this.spawnEnemy(kind, x, y);
 }
 private moveEnemies(dt: number) {
  const s = this.state, p = s.player;
  for (const e of s.enemies) {
   if (e.hp <= 0) continue; e.hitFlash = Math.max(0, e.hitFlash - dt); e.timer -= dt;
   let dir = unit(e, p), speed = e.speed;
   if (s.skills.frost && distance(e, p) < SKILLS.frost.radius + (s.skills.frost - 1) * B.skillRadiusStep + e.radius) speed *= .82 - .06 * Math.min(3, s.skills.frost);
   if (e.kind === 'warden') {
    speed *= .8; if (e.timer <= 0) {
     this.addHazard({ ...p }, 68, 1.15, e.damage * 1.15, 'enemy', 'slam');
     for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + e.seed + s.elapsed * .08; this.shoot(e, { x: e.x + Math.cos(a), y: e.y + Math.sin(a) }, 'enemy', e.damage * .65, 115, 1); }
     e.timer = e.hp < e.maxHp * .5 ? 1.9 : 2.8;
    }
   } else if (isBoss(e.kind)) {
    if (e.phase === 'chase' && e.timer <= 0) { e.phase = 'warn'; e.timer = BOSS_PATTERN.windup; e.aim = dir; }
    else if (e.phase === 'warn') { speed = 0; if (e.timer <= 0) { e.phase = 'dash'; e.timer = BOSS_PATTERN.dashDuration; } }
    else if (e.phase === 'dash') { dir = e.aim; speed = BOSS_PATTERN.dashSpeed; if (e.timer <= 0) { e.phase = 'recover'; e.timer = BOSS_PATTERN.recover; this.addHazard(e, BOSS_PATTERN.slamRadius, BOSS_PATTERN.slamDelay, e.damage * BOSS_PATTERN.slamDamage, 'enemy', 'slam'); } }
    else if (e.phase === 'recover') { speed = 0; if (e.timer <= 0) { e.phase = 'chase'; e.timer = BOSS_PATTERN.chase; } }
   } else if (e.kind === 'shaman') {
    if (distance(e, p) < 200) speed = 0;
    if (e.timer <= 0 && e.y > 80) { this.addHazard({ ...p }, 52, 1.15, e.damage, 'enemy', 'slam'); e.timer = 4.2; }
   } else if (e.kind === 'skeleton') {
    if (distance(e, p) < 220 && distance(e, p) > 140) { dir = { x: Math.sin(s.elapsed + e.seed) * .5, y: 0 }; }
    if (e.timer <= 0 && e.y > 70) { this.shoot(e, p, 'enemy', e.damage, 155, 1); e.timer = 2.65; }
   } else if (e.kind === 'bat') { dir.x += Math.sin(s.elapsed * 5 + e.seed) * .65; dir = normalize(dir.x, dir.y); }
   e.x += dir.x * speed * dt; e.y += (dir.y * speed + (isBoss(e.kind) ? 0 : W.scrollSpeed * .3)) * dt;
   if (e.kind === 'boss') { e.x = clamp(e.x, 30, W.width - 30); e.y = clamp(e.y, 137, W.height - 60); }
   if (distance(e, p) < e.radius + W.playerRadius) this.damagePlayer(e.damage);
  }
 }
 private nearest(origin: Vec, range = Infinity, excluded = new Set<number>(), includeRadius = false): Enemy | undefined {
  let best: Enemy | undefined, min = range;
  for (const e of this.state.enemies) { if (e.hp <= 0 || excluded.has(e.id)) continue; const d = distance(origin, e) - (includeRadius ? e.radius : 0); if (d < min) { best = e; min = d; } }
  return best;
 }
 private basicAttack(): boolean {
  const s = this.state, p = s.player;
  const target = this.nearest(p, this.range, new Set<number>(), s.hero === 'warrior');
  if (s.hero === 'warrior') {
   const threats = s.projectiles.filter(shot => shot.kind === 'enemy' && shot.life > 0 && distance(p, shot) <= this.range + shot.radius);
   threats.sort((a, b) => distance(p, a) - distance(p, b));
   const aim = target ?? threats[0];
   if (!aim) return false;
   const angle = p.facing = Math.atan2(aim.y - p.y, aim.x - p.x);
   const inSweep = (point: Vec) => {
    const d = unit(p, point);
    return s.weaponLevel >= 5 || Math.hypot(d.x, d.y) === 0 || d.x * Math.cos(angle) + d.y * Math.sin(angle) >= Math.cos(1.7);
   };
   this.effect(s.weaponLevel >= 5 ? 'ring' : 'slash', p, 0xf7e8b6, this.range, .23, angle);
   const blocked = threats.find(inSweep);
   if (blocked) {
    blocked.life = 0;
    this.effect('ring', blocked, 0xffeabc, 18, .24);
   }
   for (const e of [...s.enemies]) if (distance(p, e) <= this.range + e.radius && inSweep(e)) this.damageEnemy(e, this.damage);
  } else {
   if (!target) return false;
   const angle = p.facing = Math.atan2(target.y - p.y, target.x - p.x);
   const count = (s.evolved ? s.hero === 'archer' ? 3 : 2 : 1) + (s.weaponLevel >= 3 ? 1 : 0) + (s.weaponLevel >= 5 ? 1 : 0);
   for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * B.weaponShotSpacing;
    const origin = { x: p.x - Math.sin(angle) * offset, y: p.y + Math.cos(angle) * offset };
    this.shoot(origin, target, s.hero === 'archer' ? 'arrow' : 'magic', this.damage, HEROES[s.hero].projectileSpeed, s.evolved ? 4 : s.weaponLevel >= 4 ? 2 : 1, 0, s.hero === 'mage' ? target.id : undefined, s.hero === 'mage' && s.weaponLevel >= 5 ? s.evolved ? 61 : 36 : 0);
   }
  }
  return true;
 }
 private shoot(from: Vec, to: Vec, kind: Projectile['kind'], damage: number, speed: number, pierce: number, spread = 0, target?: number, splash = 0) {
  const s = this.state; if (s.projectiles.length >= W.maxProjectiles) return;
  const a = Math.atan2(to.y - from.y, to.x - from.x) + spread;
  s.projectiles.push({ id: ++this.serial, x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, radius: kind === 'magic' ? 7 : kind === 'blade' ? 11 : 4, damage, kind, life: 3.5, pierce, hit: new Set(), target, splash });
 }
 private castSkill(id: string, level: number): boolean {
  const s = this.state, p = s.player, cfg = SKILLS[id], target = this.nearest(p, 500), damage = this.power * cfg.damage * (1 + (level - 1) * B.skillDamageStep), radius = cfg.radius + (level - 1) * B.skillRadiusStep;
  if (id === 'shield') { p.shield = 1; this.effect('ring', p, 0xf4d998, 36, .5); return true; }
  if (id === 'frost') { this.aoe(p, radius, damage, 'ring', 0xa3e3e5); return true; }
  if (!target) return false;
  if (id === 'whirl') this.aoe(p, radius, damage, 'ring', 0xffdf9f);
  else if (id === 'blade' || id === 'multishot' || id === 'pierce') {
   const count = id === 'multishot' ? cfg.count + (level - 1) * 2 : id === 'blade' ? level : 1;
   for (let i = 0; i < count; i++) this.shoot(p, target, id === 'blade' ? 'blade' : 'arrow', damage, id === 'pierce' ? 490 : 350, id === 'multishot' ? 1 : 5 + level, (i - (count - 1) / 2) * .2);
  } else if (id === 'fire' || id === 'rain') {
   const center = this.densest(target); if (id === 'fire') this.aoe(center, radius, damage, 'fire', 0xffb16e); else this.addHazard(center, radius, .65, damage, 'player', 'rain');
  } else if (id === 'chain') {
   const hit = new Set<number>(); let from: Vec = p; let next: Enemy | undefined = target;
   for (let i = 0; i < cfg.count + (level - 1) * 2 && next; i++) { this.effect('lightning', from, 0xb6dfff, 0, .3, 0, undefined, next); hit.add(next.id); this.damageEnemy(next, damage); from = { x: next.x, y: next.y }; next = this.nearest(from, cfg.radius, hit); }
  }
  return true;
 }
 private densest(fallback: Enemy): Vec {
  let best = fallback, count = 0;
  for (const e of this.state.enemies.filter(e => e.hp > 0).slice(0, 35)) { let n = 0; for (const other of this.state.enemies) if (other.hp > 0 && distance(e, other) < 80) n++; if (n > count) { best = e; count = n; } }
  return { x: best.x, y: best.y };
 }
 private aoe(center: Vec, radius: number, damage: number, effect: Effect['kind'], color: number) { this.effect(effect, center, color, radius, .45); for (const e of [...this.state.enemies]) if (e.hp > 0 && distance(center, e) < radius + e.radius) this.damageEnemy(e, damage); }
 private moveProjectiles(dt: number) {
  const s = this.state;
  for (const shot of s.projectiles) {
   if (s.player.hp <= 0 || s.status === 'victory') break;
   shot.life -= dt;
   if (shot.life <= 0) continue;
   if (shot.target) {
    const enemy = s.enemies.find(e => e.id === shot.target && e.hp > 0 && !shot.hit.has(e.id)) ?? this.nearest(shot, 260, shot.hit);
    if (enemy) {
     shot.target = enemy.id; const d = unit(shot, enemy), speed = Math.hypot(shot.vx, shot.vy), turn = Math.min(1, dt * 6);
     const vx = shot.vx + (d.x * speed - shot.vx) * turn, vy = shot.vy + (d.y * speed - shot.vy) * turn, length = Math.hypot(vx, vy) || 1;
     shot.vx = vx / length * speed; shot.vy = vy / length * speed;
    }
   }
   shot.x += shot.vx * dt; shot.y += shot.vy * dt;
   if (shot.kind === 'enemy') { if (distance(shot, s.player) < shot.radius + W.playerRadius) { this.damagePlayer(shot.damage); shot.life = 0; } }
   else for (const e of s.enemies) {
    if (shot.life <= 0 || e.hp <= 0 || shot.hit.has(e.id)) continue;
    if (distance(shot, e) < shot.radius + e.radius) { shot.hit.add(e.id); this.damageEnemy(e, shot.damage); if (shot.splash) this.aoe(shot, shot.splash, shot.damage * .38, 'fire', 0xc2afff); shot.pierce--; if (shot.pierce <= 0) shot.life = 0; }
   }
  }
  s.projectiles = s.projectiles.filter(p => p.life > 0 && p.x > -50 && p.x < W.width + 50 && p.y > -60 && p.y < W.height + 60);
 }
 private addHazard(center: Vec, radius: number, delay: number, damage: number, owner: 'player' | 'enemy', kind: 'rain' | 'slam') {
  if (this.state.hazards.length < W.maxHazards) this.state.hazards.push({ id: ++this.serial, x: center.x, y: center.y, radius, delay, life: delay + .45, damage, owner, kind, fired: false });
 }
 private updateHazards(dt: number) {
  for (const h of this.state.hazards) {
   if (this.state.player.hp <= 0) break;
   h.delay -= dt; h.life -= dt;
   if (h.delay <= 0 && !h.fired) { h.fired = true; if (h.owner === 'player') this.aoe(h, h.radius, h.damage, 'ring', 0xdcecc3); else { this.effect('ring', h, 0xee936d, h.radius, .4); if (distance(h, this.state.player) < h.radius + W.playerRadius) this.damagePlayer(h.damage); } }
  }
  this.state.hazards = this.state.hazards.filter(h => h.life > 0);
 }
 damageEnemy(enemy: Enemy, amount: number) {
  if (enemy.hp <= 0 || this.state.status === 'victory' || this.state.status === 'gameover') return; enemy.hp -= amount; enemy.hitFlash = .12;
  this.effect('hit', enemy, 0xffedc2, 13, .14); this.effect('text', { x: enemy.x + this.random() * 12 - 6, y: enemy.y - 15 }, 0xffecc9, 0, .65, 0, `${Math.round(amount)}`);
  if (!isBoss(enemy.kind)) { const away = unit(this.state.player, enemy); enemy.x += away.x * 4; enemy.y += away.y * 4; }
  if (enemy.hp > 0) return;
  const s = this.state; s.kills++; if (isBoss(enemy.kind)) s.bosses++;
  this.goldRaw += (isBoss(enemy.kind) ? B.bossGold : B.goldPerKill * (enemy.elite ? 3 : 1)) * (1 + this.save.upgrades.gold * PERMANENT.gold.step); s.gold = Math.floor(this.goldRaw);
  if (isBoss(enemy.kind)) this.effect('boss-death', enemy, 0xffd68a, enemy.kind === 'warden' ? 220 : 150, 1.1);
  else this.effect('death', enemy, 0xadd48a, enemy.radius, .4);
  if (enemy.kind === 'warden') {
   this.goldRaw += CAMPAIGN.clearGold * (1 + s.rank * .5); s.gold = Math.floor(this.goldRaw); s.status = 'victory'; s.choices = []; s.projectiles = []; s.hazards = []; this.pendingChoices = 0; return;
  }
  this.gainXp(ENEMIES[enemy.kind].xp * (enemy.elite ? 2 : 1));
 }
 damagePlayer(amount: number) {
  const s = this.state, p = s.player; if (p.invincible > 0 || s.status !== 'running') return;
  p.invincible = W.invincibility; if (p.shield > 0) { p.shield--; this.effect('ring', p, 0xf6dc92, 38, .4); return; }
  p.hp = Math.max(0, p.hp - amount); this.effect('hit', p, 0xf2937e, 27, .25);
  if (p.hp <= 0) s.status = 'gameover';
 }
 gainXp(amount: number) {
  const s = this.state; s.xp += amount;
  while (s.xp >= s.xpNext) { s.xp -= s.xpNext; s.level++; s.xpNext = Math.round(s.xpNext * B.xpGrowth + B.xpIncrement); this.pendingChoices++; s.player.hp = Math.min(s.player.maxHp, s.player.hp + s.player.maxHp * B.healOnLevel); }
  if (this.pendingChoices > 0 && s.status === 'running') this.nextChoice();
 }
 private nextChoice() {
  const s = this.state; if (this.pendingChoices <= 0) { s.choices = []; s.status = 'running'; return; }
  s.choices = rollUpgrades(s, this.random); if (!s.choices.length) { this.pendingChoices = 0; s.status = 'running'; return; } s.status = 'upgrade';
 }
 chooseUpgrade(id: string): boolean {
  const s = this.state; if (s.status !== 'upgrade' || !s.choices.some(c => c.id === id)) return false;
  if (id === 'evolve') { s.evolved = true; this.effect('ring', s.player, 0xffe2a4, 130, 1); }
  else if (id === 'weapon') s.weaponLevel++;
  else if (id.startsWith('skill:')) { const key = id.slice(6); s.skills[key] = (s.skills[key] ?? 0) + 1; this.skillTimers[key] = 0; }
  else { const key = id.slice(8) as PassiveId; s.passives[key]++; if (key === 'vitality') { const extra = HEROES[s.hero].hp * B.vitalityStep; s.player.maxHp += extra; s.player.hp = Math.min(s.player.maxHp, s.player.hp + extra * 1.6); } else if (key === 'speed') s.player.speed += HEROES[s.hero].speed * B.speedStep; }
  this.pendingChoices--; this.nextChoice(); return true;
 }
 private effect(kind: Effect['kind'], at: Vec, color: number, radius: number, duration: number, angle = 0, text?: string, to?: Vec) {
  const effects = this.state.effects; if (effects.length >= W.maxEffects) effects.shift(); effects.push({ id: ++this.serial, kind, x: at.x, y: at.y, color, radius, life: duration, duration, angle, text, x2: to?.x, y2: to?.y });
 }
 result(): RunResult { const s = this.state; return { runId: s.runId, hero: s.hero, time: s.elapsed, level: s.level, kills: s.kills, bosses: s.bosses, gold: s.gold, cleared: s.status === 'victory', outcome: s.status === 'victory' ? 'victory' : s.status === 'gameover' ? 'defeat' : 'abandoned', rank: s.rank, combat: { spawned: s.spawned, killed: s.kills, missed: s.spawned - s.kills, escaped: s.escaped, withdrawn: s.withdrawn, remaining: s.enemies.filter(e => e.hp > 0).length, killRate: s.spawned ? s.kills / s.spawned * 100 : 0, missRate: s.spawned ? (s.spawned - s.kills) / s.spawned * 100 : 0 } }; }
}
