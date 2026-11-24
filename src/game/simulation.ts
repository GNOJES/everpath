import { BALANCE as B, WORLD as W, HEROES, ENEMIES, SKILLS, PERMANENT, BOSS_PATTERN, PAIRED_GRORM, FIRST_GRORM, CAMPAIGN, PICKUPS, TIME_STOP, WARRIOR_PARRY, BLAST_ARROW_AIM_RANGE, ATTACK_SKILL_UPGRADE, warriorSweepAngle, isBoss } from './config';
import { clamp, distance, normalize, unit } from './math';
import { rollUpgrades } from './progression';
import { spawnInterval, chooseEnemyKind, MIDDLE_BOSS_WAVES, openingProgress } from './encounters';
import type { CombatSound, Hazard, HeroId, SaveData, RunState, Vec, EnemyKind, Enemy, Projectile, Pickup, Effect, PassiveId, RunResult, SkillId, SkillShot } from './types';
let runCounter = 0;
export function createRun(hero: HeroId, save: SaveData, rank = 0): RunState {
 const config = HEROES[hero], maxHp = Math.round(config.hp * (1 + save.upgrades.hp * PERMANENT.hp.step));
 return { runId: `${Date.now()}-${++runCounter}-${Math.random().toString(36).slice(2)}`, hero, status: 'running', elapsed: 0, rank, evolved: false, finalSpawned: false, timeStopCharges: clamp(save.upgrades.timeStop, 0, TIME_STOP.maxCharges), timeStopRemaining: 0, pickups: [], scroll: 0,
  player: { x: W.width / 2, y: 515, hp: maxHp, maxHp, speed: config.speed * (1 + save.upgrades.speed * PERMANENT.speed.step), invincible: 0, shield: 0, facing: -Math.PI / 2 },
  enemies: [], projectiles: [], effects: [], hazards: [], level: 1, xp: 0, xpNext: B.initialXp, kills: 0, spawned: 0, escaped: 0, withdrawn: 0, bosses: 0, gold: 0, weaponLevel: 1, skills: {}, passives: { power: 0, haste: 0, vitality: 0, speed: 0 }, choices: [], nextBoss: MIDDLE_BOSS_WAVES[0].at };
}
export class GameSimulation {
 readonly state: RunState;
 speedMultiplier: 1 | 2 = 1;
 onSound?: (cue: CombatSound) => void;
 private regularSpawns = 0; private sideSpawns = 0;
 private healDrops = 0;
 private nextShamanAt = 0;
 private parryTimer = 0;
 private serial = 0; private spawnTimer = B.firstSpawn; private attackTimer = .1; private skillTimers: Record<string, number> = {}; private pendingChoices = 0; private goldRaw = 0;
 constructor(hero: HeroId, private save: SaveData, private random: () => number = Math.random, rank = 0) { this.save = structuredClone(save); this.state = createRun(hero, this.save, Math.floor(clamp(rank, 0, save.challengeUnlocked))); }
 private hasWon() { return this.state.status === 'victory'; }
 private get attackMultiplier() { return (1 + this.save.upgrades.attack * PERMANENT.attack.step) * (1 + this.state.passives.power * B.powerStep); }
 get power() { return HEROES[this.state.hero].skillPower * this.attackMultiplier; }
 get damage() {
  const { hero, weaponLevel, evolved } = this.state;
  const weaponScale = 1 + (weaponLevel - 1) * B.weaponDamageStep;
  return HEROES[hero].weaponDamage * this.attackMultiplier * weaponScale * (evolved ? B.weaponEvolutionDamage : 1);
 }
 get haste() { return 1 + this.state.passives.haste * B.hasteStep; }
 get weaponHaste() { return this.haste + (this.state.weaponLevel - 1) * B.weaponHasteStep + (this.state.evolved ? .25 : 0); }
 get range() {
  const { hero, weaponLevel, evolved } = this.state;
  return HEROES[hero].range * (1 + (weaponLevel - 1) * B.weaponRangeStep) * (evolved ? 1.25 : 1);
 }
 pause() { if (this.state.status === 'running') this.state.status = 'paused'; }
 resume() { if (this.state.status === 'paused') this.state.status = 'running'; }
 activateTimeStop(): boolean {
  const s = this.state;
  if (s.status !== 'running' || s.timeStopRemaining > 0 || s.timeStopCharges <= 0) return false;
  s.timeStopCharges--;
  s.timeStopRemaining = TIME_STOP.duration;
  this.onSound?.('timeStop');
  return true;
 }
 update(seconds: number, direction: Vec = { x: 0, y: 0 }) {
  const s = this.state;
  const dt = clamp(seconds, 0, .05);
  for (let step = 0; step < this.speedMultiplier && s.status === 'running'; step++) {
   const frozen = s.timeStopRemaining > 0;
   this.advance(dt, direction, frozen);
   if (frozen) s.timeStopRemaining = s.timeStopRemaining - dt > 1e-9 ? s.timeStopRemaining - dt : 0;
  }
 }
 private advance(dt: number, direction: Vec, frozen: boolean) {
  const s = this.state, p = s.player;
  const invincibilityRemaining = p.invincible - dt;
  p.invincible = invincibilityRemaining > 1e-9 ? invincibilityRemaining : 0;
  const input = normalize(direction.x, direction.y); p.x = clamp(p.x + input.x * p.speed * dt, W.margin, W.width - W.margin); p.y = clamp(p.y + input.y * p.speed * dt, W.minY, W.height - W.margin);
  if (input.x || input.y) p.facing = Math.atan2(input.y, input.x);
  if (!frozen) {
   s.elapsed += dt; s.scroll += W.scrollSpeed * dt;
   if (s.elapsed >= CAMPAIGN.finalAt && !s.finalSpawned) {
    s.finalSpawned = true;
    this.spawnBossFromTop('warden', W.width / 2);
    s.nextBoss = Infinity;
    this.spawnTimer = CAMPAIGN.reinforcementInterval;
    const heal = Math.min(p.maxHp - p.hp, p.maxHp * CAMPAIGN.arenaHeal * this.save.upgrades.hp / B.permanentMax);
    p.hp += heal;
    this.effect('text', { x: W.width / 2, y: 260 }, 0xffd38a, 0, 3, 0, heal >= 1 ? `모르바 등장 · 체력 +${Math.floor(heal)}` : '모르바 등장');
   }
   if (s.finalSpawned && s.elapsed >= CAMPAIGN.finalAt + CAMPAIGN.arenaLimit) { p.shield = 0; p.invincible = 0; this.damagePlayer(p.hp); return; }
   this.spawnTimer -= dt;
   if (this.spawnTimer <= 0) { this.spawnWave(); this.spawnTimer = spawnInterval(s.elapsed); }
   if (!s.finalSpawned && s.elapsed >= s.nextBoss) this.spawnMiddleBossWave();
   this.moveEnemies(dt); if (p.hp <= 0) return;
  }
  this.collectPickups();
  this.attackTimer -= dt;
  this.parryTimer -= dt;
  if (this.attackTimer <= 0) {
   if (this.basicAttack()) this.attackTimer = HEROES[s.hero].cooldown / this.weaponHaste;
  } else if (!frozen && s.hero === 'warrior' && this.parryTimer <= 0) {
   this.parryProjectile(dt);
  }
  if (this.hasWon()) return;
  for (const id of HEROES[s.hero].skills) {
   const level = s.skills[id];
   if (!level) continue;
   this.skillTimers[id] = (this.skillTimers[id] ?? 0) - dt;
   if (this.skillTimers[id] > 0) continue;
   const skill = SKILLS[id];
   const baseRank = Math.min(level, B.skillMax);
   const finalRank = level === ATTACK_SKILL_UPGRADE.rank;
   const killsBeforeCast = s.kills;
   if (this.castSkill(id, baseRank, finalRank)) {
    const rankHaste = 1 + (baseRank - 1) * (skill.hastePerLevel ?? B.skillHasteStep);
    this.skillTimers[id] = skill.cooldown / this.haste / rankHaste / (finalRank ? ATTACK_SKILL_UPGRADE.haste : 1);
    if (id === 'chain' && finalRank && s.kills > killsBeforeCast) this.skillTimers[id] *= .5;
    if (!this.hasWon()) this.onSound?.(id);
   }
  }
  if (this.hasWon()) return;
  this.moveProjectiles(dt, frozen); if (this.hasWon()) return; if (p.hp <= 0) return; this.updateHazards(dt, frozen);
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
  const openingHealth = isBoss(kind) ? 1 : .86 + .14 * openingProgress(s.elapsed);
  const hp = cfg.hp * (kind === 'warden' ? 1 + s.rank * .35 : scale) * (elite ? 2.3 : 1) * openingHealth;
  const enemy: Enemy = { id: ++this.serial, kind, x, y, hp, maxHp: hp, speed: cfg.speed * Math.min(B.maxEnemySpeedScale, 1 + s.elapsed * B.enemySpeedGrowth), damage: cfg.damage * (isBoss(kind) ? 1 : .83) * (1 + s.elapsed / 600) * (elite ? 1.3 : 1), radius: cfg.radius * (elite ? 1.2 : 1), elite, timer: isBoss(kind) ? 3 : 1.8 + this.random(), phase: 'chase', aim: { x: 0, y: 1 }, hitFlash: 0, seed: this.random() * Math.PI * 2 };
  s.enemies.push(enemy); s.spawned++; return enemy;
 }
 private spawnMiddleBossWave() {
  const s = this.state;
  const index = MIDDLE_BOSS_WAVES.findIndex(wave => wave.at === s.nextBoss);
  const wave = MIDDLE_BOSS_WAVES[index];
  if (!wave) { s.nextBoss = Infinity; return; }
  wave.enemies.forEach(({ kind, x, hp }, slot) => {
   const boss = this.spawnBossFromTop(kind, W.width * x);
   if (!boss) return;
   boss.hp = boss.maxHp *= hp;
   boss.damage *= wave.damageScale;
   boss.rewardScale = wave.rewardScale;
   boss.paired = wave.enemies.length > 1;
   boss.timer += slot * (wave.enemies.length > 2 ? 2.45 : 1.45);
   boss.middleWave = wave.at;
  });
  s.nextBoss = MIDDLE_BOSS_WAVES[index + 1]?.at ?? Infinity;
  this.effect('text', { x: W.width / 2, y: 215 }, 0xffd38a, 0, 2, 0, wave.title);
 }
 private spawnBossFromTop(kind: 'boss' | 'briar' | 'warden', x: number) {
  const boss = this.spawnEnemy(kind, x, -ENEMIES[kind].radius - 16);
  if (!boss) return;
  boss.entryTarget = { x, y: kind === 'warden' ? 170 : 162 };
  return boss;
 }
 private spawnWave() {
  const { elapsed, player, enemies, finalSpawned } = this.state;
  if (finalSpawned && enemies.filter(enemy => enemy.reinforcement && enemy.hp > 0).length >= CAMPAIGN.maxReinforcements) return;
  if (this.state.spawned === 0) {
   for (const x of [164, 216, 268]) {
    if (this.spawnEnemy('slime', x, 171)) this.regularSpawns++;
   }
   return;
  }
  const doubleChance = .12 * clamp((elapsed - 90) / 30, 0, 1);
  const count = !finalSpawned && this.random() < doubleChance ? 2 : 1;
  for (let i = 0; i < count && enemies.length < W.maxEnemies; i++) {
   let kind: EnemyKind = finalSpawned ? (this.random() < .55 ? 'goblin' : 'bat') : chooseEnemyKind(elapsed, this.random);
   if (kind === 'shaman') {
    if (elapsed < this.nextShamanAt || enemies.some(enemy => enemy.kind === 'shaman' && enemy.hp > 0)) kind = 'brute';
    else this.nextShamanAt = elapsed + 18;
   }
   const offset = this.random();
   // Count arrivals so double waves and seeded RNG cannot bias the split.
   const side = this.sideSpawns < Math.floor((this.regularSpawns + 1) * 2 / 5);
   if (side) {
    const fromLeft = this.sideSpawns % 2 === 0;
    const from = { x: fromLeft ? -18 : W.width + 18, y: 112 + offset * 64 };
    const inset = 72 + offset * 44;
    const enemy = this.spawnEnemy(kind, from.x, from.y);
    if (enemy) {
     enemy.entryTarget = { x: fromLeft ? inset : W.width - inset, y: 328 + offset * 48 };
     if (finalSpawned) enemy.reinforcement = true;
    }
    this.sideSpawns++;
   } else {
    let x = 28 + offset * (W.width - 56);
    if (distance({ x, y: -18 }, player) < 110) x = clamp(player.x + (player.x > W.width / 2 ? -155 : 155), 28, W.width - 28);
    const enemy = this.spawnEnemy(kind, x, -18);
    if (enemy && finalSpawned) enemy.reinforcement = true;
   }
   this.regularSpawns++;
  }
 }
 private moveEnemies(dt: number) {
  const s = this.state, p = s.player;
  for (const e of s.enemies) {
   if (e.hp <= 0) continue; e.hitFlash = Math.max(0, e.hitFlash - dt);
   const bossEntering = e.entryTarget !== undefined && isBoss(e.kind);
   if (!bossEntering) e.timer -= dt;
   let dir = unit(e, p), speed = e.speed;
   if (!isBoss(e.kind) && (e.slowedUntil ?? 0) > s.elapsed) speed *= .52;
   if (!isBoss(e.kind) && s.skills.frost && distance(e, p) < SKILLS.frost.radius + (Math.min(s.skills.frost, B.skillMax) - 1) * B.skillRadiusStep + e.radius) speed *= .76 - .075 * Math.min(3, s.skills.frost);
   if (e.entryTarget) {
    const step = (bossEntering ? 140 : speed * 1.75) * dt;
    const remaining = distance(e, e.entryTarget);
    dir = unit(e, e.entryTarget);
    if (remaining <= step) {
     e.x = e.entryTarget.x;
     e.y = e.entryTarget.y;
     e.entryTarget = undefined;
    } else {
     e.x += dir.x * step;
     e.y += dir.y * step;
    }
    if (!bossEntering && distance(e, p) < e.radius + W.playerRadius) this.damageEnemyContact(e);
    continue;
   }
   if (e.kind === 'warden') {
    speed *= this.moveWarden(e, p);
   } else if (e.kind === 'briar') {
    speed *= this.moveBriar(e, p);
   } else if (e.kind === 'boss') {
    if (e.phase === 'chase' && e.timer <= 0) {
     e.phase = 'warn'; e.timer = BOSS_PATTERN.windup; e.aim = dir;
     this.onSound?.('grormWarn');
     if (!e.paired && distance(e, p) > FIRST_GRORM.volleyRange) {
      for (const spread of [-.28, 0, .28]) this.shoot(e, p, 'enemy', e.damage * FIRST_GRORM.volleyDamage, FIRST_GRORM.volleySpeed, 1, spread);
      this.onSound?.('grormVolley');
     }
    }
    else if (e.phase === 'warn') {
     speed = 0;
     if (e.timer <= 0) { e.phase = 'dash'; e.timer = BOSS_PATTERN.dashDuration; this.onSound?.('grormDash'); }
    }
    else if (e.phase === 'dash') {
     dir = e.aim; speed = BOSS_PATTERN.dashSpeed;
     if (e.timer <= 0) {
      const pattern = e.paired ? PAIRED_GRORM : BOSS_PATTERN;
      e.phase = 'recover'; e.timer = pattern.recover;
      this.addHazard(e, pattern.slamRadius, BOSS_PATTERN.slamDelay, e.damage * BOSS_PATTERN.slamDamage, 'enemy', 'slam', 'grormSlam');
     }
    }
    else if (e.phase === 'recover') { speed = 0; if (e.timer <= 0) { e.phase = 'chase'; e.timer = BOSS_PATTERN.chase; } }
   } else if (e.kind === 'shaman') {
    if (distance(e, p) < 200) speed = 0;
    if (e.timer <= 0 && e.y > 80) { this.addHazard({ ...p }, 43, 1.55, e.damage, 'enemy', 'slam'); e.timer = 4.2; }
   } else if (e.kind === 'skeleton') {
    if (distance(e, p) < 220 && distance(e, p) > 140) { dir = { x: Math.sin(s.elapsed + e.seed) * .5, y: 0 }; }
    if (e.timer <= 0 && e.y > 70) {
     this.shoot(e, p, 'enemy', e.damage, 155, 1); e.timer = 2.65;
    }
   } else if (e.kind === 'bat') { dir.x += Math.sin(s.elapsed * 5 + e.seed) * .65; dir = normalize(dir.x, dir.y); }
   e.x += dir.x * speed * dt; e.y += (dir.y * speed + (isBoss(e.kind) ? 0 : W.enemyDrift)) * dt;
   if (e.kind === 'boss' || e.kind === 'briar') { e.x = clamp(e.x, 30, W.width - 30); e.y = clamp(e.y, 137, W.height - 60); }
   if (distance(e, p) < e.radius + W.playerRadius) this.damageEnemyContact(e);
  }
 }
 private moveBriar(enemy: Enemy, player: Vec) {
  if (enemy.phase === 'warn') {
   if (enemy.timer <= 0) { enemy.phase = 'recover'; enemy.timer = 1.6; }
   return 0;
  }
  if (enemy.phase === 'recover') {
   if (enemy.timer <= 0) { enemy.phase = 'chase'; enemy.timer = 2; }
   return 0;
  }
  if (enemy.timer <= 0) {
   enemy.phase = 'warn'; enemy.timer = 1.42;
   this.onSound?.('briarWarn');
   const side = player.x < W.width / 2 ? 1 : -1;
   this.addHazard(player, 38, 1.05, enemy.damage * .88, 'enemy', 'slam', 'briarImpact');
   this.addHazard({x: player.x + side * 77, y: player.y - 46}, 35, 1.42, enemy.damage * .74, 'enemy', 'slam', 'briarImpact');
   return 0;
  }
  return distance(enemy, player) > 215 ? 1 : .18;
 }
 private moveWarden(e: Enemy, player: Vec) {
  const enraged = e.hp <= e.maxHp / 2;
  if (e.phase === 'warn') {
   if (e.timer <= 0) {
    for (let i = -2; i <= 2; i++) this.shoot(e, { x: e.x + e.aim.x, y: e.y + e.aim.y }, 'enemy', e.damage * .72, enraged ? 205 : 170, 1, i * .19);
    this.onSound?.('wardenFan');
    e.phase = 'chase'; e.timer = enraged ? 1.55 : 2.05;
   }
   return 0;
  }
  if (e.timer <= 0) {
   const attack = (e.wardenAttack ?? 0) % 3;
   e.wardenAttack = attack + 1;
   e.timer = enraged ? 2.1 : 2.7;
   if (attack === 0) {
    this.onSound?.('wardenRoots');
    this.addHazard(player, 51, 1.15, e.damage * 1.25, 'enemy', 'slam', 'wardenSlam');
    const offset = player.x < W.width / 2 ? 85 : -85;
    this.addHazard({ x: player.x + offset, y: player.y - 38 }, 43, 1.52, e.damage, 'enemy', 'slam', 'wardenSlam');
    if (enraged) this.addHazard({ x: player.x + offset / 2, y: player.y + 89 }, 39, 1.76, e.damage, 'enemy', 'slam', 'wardenSlam');
   } else if (attack === 1) {
    e.phase = 'warn'; e.timer = .74; e.aim = unit(e, player);
    this.onSound?.('wardenAim');
    return 0;
   } else {
    const count = enraged ? 14 : 10;
    for (let i = 0; i < count; i++) {
     const angle = e.seed + i * 2 * Math.PI / count;
     this.shoot(e, { x: e.x + Math.cos(angle), y: e.y + Math.sin(angle) }, 'enemy', e.damage * .67, enraged ? 154 : 128, 1);
    }
    this.onSound?.('wardenRing');
    if (enraged) this.addHazard(player, 41, 1.18, e.damage, 'enemy', 'slam', 'wardenSlam');
   }
  }
  return enraged ? .95 : .80;
 }
 private damageEnemyContact(enemy: Enemy) {
  let damage = enemy.damage;
  if (enemy.paired && enemy.phase !== 'dash') damage *= .68;
  if (enemy.kind === 'warden' && enemy.phase === 'recover') damage *= .65;
  this.damagePlayer(damage);
 }
 private nearest(origin: Vec, range = Infinity, excluded = new Set<number>(), includeRadius = false): Enemy | undefined {
  let best: Enemy | undefined, min = range;
  for (const e of this.state.enemies) { if (e.hp <= 0 || excluded.has(e.id)) continue; const d = distance(origin, e) - (includeRadius ? e.radius : 0); if (d < min) { best = e; min = d; } }
  return best;
 }
 private inSweep(origin: Vec, point: Vec, angle: number, halfAngle: number) {
  const dir = unit(origin, point);
  return (dir.x === 0 && dir.y === 0) || dir.x * Math.cos(angle) + dir.y * Math.sin(angle) >= Math.cos(halfAngle);
 }
 private slash(origin: Vec, radius: number, angle: number, halfAngle: number, damage: number, color: number, knockback = 0, style: 'slash' | 'whirl' | 'guard' = 'slash') {
  this.effect(style, origin, color, radius, style === 'slash' ? .24 : .42, angle, undefined, undefined, halfAngle);
  for (const enemy of [...this.state.enemies]) {
   if (distance(origin, enemy) <= radius + enemy.radius && this.inSweep(origin, enemy, angle, halfAngle)) {
    this.damageEnemy(enemy, damage);
    if (knockback && enemy.hp > 0 && !isBoss(enemy.kind) && this.state.timeStopRemaining <= 0) {
     const away = unit(origin, enemy);
     enemy.x = clamp(enemy.x + away.x * knockback, -18, W.width + 18);
     enemy.y = clamp(enemy.y + away.y * knockback, -18, W.height + 35);
    }
   }
  }
 }
 private swordThreats(lookahead?: number) {
  const { player, projectiles } = this.state;
  const range = this.range;
  return projectiles.filter(shot => {
   if (shot.kind !== 'enemy' || shot.life <= 0 || distance(player, shot) > range + shot.radius) return false;
   if (lookahead === undefined) return true;
   const dx = player.x - shot.x, dy = player.y - shot.y;
   const speedSquared = shot.vx * shot.vx + shot.vy * shot.vy;
   if (speedSquared === 0) return false;
   const closest = clamp((dx * shot.vx + dy * shot.vy) / speedSquared, 0, Math.min(lookahead, shot.life));
   return Math.hypot(dx - shot.vx * closest, dy - shot.vy * closest) <= W.playerRadius + shot.radius;
  }).sort((a, b) => distance(player, a) - distance(player, b));
 }
 private swingSword(aim: Vec, threats: Projectile[]) {
  const { player, weaponLevel, evolved } = this.state;
  const angle = player.facing = Math.atan2(aim.y - player.y, aim.x - player.x);
  const halfAngle = warriorSweepAngle(weaponLevel, evolved);
  const blockLimit = evolved ? 4 : 1 + Math.floor((weaponLevel - 1) / 2);
  for (const blocked of threats.filter(shot => this.inSweep(player, shot, angle, halfAngle)).slice(0, blockLimit)) {
   blocked.life = 0;
   this.effect('crystal', blocked, 0xffd982, 17, .24);
   this.parryTimer = WARRIOR_PARRY.cooldown;
  }
  this.slash(player, this.range, angle, halfAngle, this.damage, 0xffd067, 15);
 }
 private parryProjectile(dt: number) {
  const threats = this.swordThreats(Math.min(this.attackTimer + dt, WARRIOR_PARRY.lookahead));
  if (!threats.length || this.nearest(this.state.player, this.range, new Set<number>(), true)) return;
  this.swingSword(threats[0], threats);
 }
 private basicAttack(): boolean {
  const s = this.state, p = s.player;
  const target = this.nearest(p, this.range, new Set<number>(), s.hero === 'warrior');
  if (s.hero === 'warrior') {
   const threats = this.swordThreats();
   const aim = target ?? threats[0];
   if (!aim) return false;
   this.swingSword(aim, threats);
  } else {
   if (!target) return false;
   const angle = p.facing = Math.atan2(target.y - p.y, target.x - p.x);
   const config = HEROES[s.hero];
   if (s.hero === 'mage') {
    this.shoot(p, target, 'magic', this.damage, config.projectileSpeed, 1, 0, target.id);
   } else {
    const pierce = s.evolved ? 5 : s.weaponLevel >= 5 ? 4 : s.weaponLevel >= 3 ? 3 : s.weaponLevel >= 2 ? 2 : 1;
    this.shoot(p, target, 'arrow', this.damage, config.projectileSpeed, pierce, 0, undefined, .94);
   }
  }
  return true;
 }
 private shoot(from: Vec, to: Vec, kind: Projectile['kind'], damage: number, speed: number, pierce: number, spread = 0, target?: number, pierceScale = 1, skillShot?: SkillShot, blastRadius?: number) {
  const s = this.state; if (s.projectiles.length >= W.maxProjectiles) return false;
  const a = Math.atan2(to.y - from.y, to.x - from.x) + spread;
  const radius = kind === 'magic' ? 7 : kind === 'blade' ? 11 : kind === 'arrow' && skillShot ? 6 : 4;
  s.projectiles.push({ id: ++this.serial, x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, radius, damage, kind, life: 3.5, pierce, hit: new Set(), target, pierceScale, skillShot, blastRadius });
  return true;
 }
 private castSkill(id: SkillId, level: number, finalRank: boolean): boolean {
  const s = this.state, p = s.player, cfg = SKILLS[id], target = this.nearest(p, 500);
  const damage = this.power * cfg.damage * (1 + (level - 1) * B.skillDamageStep) * (finalRank ? ATTACK_SKILL_UPGRADE.damage : 1);
  const radius = cfg.radius + (level - 1) * (cfg.radiusPerLevel ?? B.skillRadiusStep);
  if (id === 'shield') { p.shield = 1; this.effect('guard', p, 0xf4d998, 36, .5); return true; }
  if (id === 'frost') {
   const chilled = this.nearest(p, radius, new Set<number>(), true);
   if (!chilled) return false;
   this.aoe(p, radius, damage, 'frost', 0x4be0f2);
   return true;
  }
  if (!target) return false;
  if (id === 'lunge') {
   const close = this.nearest(p, radius, new Set<number>(), true);
   if (!close) return false;
   const aim = unit(p, close), width = 12 + (level - 1) * 2;
   const direction = aim.x || aim.y ? aim : { x: Math.cos(p.facing), y: Math.sin(p.facing) };
   const end = { x: p.x + direction.x * radius, y: p.y + direction.y * radius };
   for (const enemy of s.enemies) {
    const along = clamp((enemy.x - p.x) * direction.x + (enemy.y - p.y) * direction.y, 0, radius);
    if (Math.hypot(enemy.x - p.x - direction.x * along, enemy.y - p.y - direction.y * along) < width + enemy.radius) this.damageEnemy(enemy, damage);
   }
   this.effect('lance', p, 0xffbf53, width, .43, 0, undefined, end);
  } else if (id === 'quake') {
   if (!this.nearest(p, radius, new Set<number>(), true)) return false;
   this.aoe(p, radius, damage, 'quake', 0xbe6839);
  } else if (id === 'sunder' || id === 'meteor' || id === 'deadeye') {
   const inReach = s.enemies.filter(enemy => enemy.hp > 0 && distance(p, enemy) <= radius + enemy.radius);
   const marked = inReach.reduce<Enemy | undefined>((best, enemy) => {
    const priority = (candidate: Enemy) => id === 'deadeye'
     ? distance(p, candidate) + (isBoss(candidate.kind) ? radius * 2 : 0)
     : candidate.hp;
    return !best || priority(enemy) > priority(best) ? enemy : best;
   }, undefined);
   if (!marked) return false;
   if (id === 'deadeye') this.effect('deadeye', p, 0xffdf75, 12, .46, 0, undefined, marked);
   else this.effect(id, marked, id === 'meteor' ? 0xff964e : 0xaf4c21, id === 'meteor' ? 46 : 31, .55);
   this.damageEnemy(marked, damage);
  } else if (id === 'ricochet' || id === 'prism') {
   const hit = new Set<number>();
   let origin: Vec = p;
   for (let i = 0; i < cfg.count + level - 1; i++) {
    const marked = this.nearest(origin, id === 'ricochet' && i > 0 ? 104 : radius, hit);
    if (!marked) return hit.size > 0;
    hit.add(marked.id);
    this.effect(id, origin, id === 'ricochet' ? 0xff9543 : 0x6651fa, 12, .4, i, undefined, marked);
    this.damageEnemy(marked, damage * (id === 'ricochet' ? .9 ** i : 1));
    if (id === 'ricochet') origin = marked;
   }
  } else if (id === 'blastArrow') {
   const marked = this.nearest(p, BLAST_ARROW_AIM_RANGE);
   return !!marked && this.shoot(p, marked, 'arrow', damage, 520, 1, 0, undefined, 1, 'blast', radius);
  } else if (id === 'gravity') {
   const center = { x: target.x, y: target.y };
   for (const enemy of s.enemies) {
    const separation = distance(center, enemy);
    if (enemy.hp <= 0 || separation >= radius + enemy.radius) continue;
    this.damageEnemy(enemy, damage);
    if (enemy.hp > 0 && !isBoss(enemy.kind) && !enemy.entryTarget && s.timeStopRemaining <= 0) {
     const pull = unit(enemy, center), travel = Math.min(36, separation * .55);
     enemy.x += pull.x * travel;
     enemy.y += pull.y * travel;
    }
   }
   this.effect('gravity', center, 0x6a41b9, radius, .62);
  } else if (id === 'runeCross') {
   const width = 14 + (level - 1) * 3;
   for (const enemy of s.enemies) {
    const dx = Math.abs(enemy.x - target.x), dy = Math.abs(enemy.y - target.y);
    if (Math.max(dx, dy) <= radius + enemy.radius && Math.min(dx, dy) <= width + enemy.radius) this.damageEnemy(enemy, damage);
   }
   this.effect('runeCross', target, 0xa34bc9, radius, .53, 0, undefined, undefined, width);
  } else if (id === 'snare') {
   const marked = this.nearest(p, radius);
   if (!marked) return false;
   for (const enemy of s.enemies) {
    if (!isBoss(enemy.kind) && enemy.hp > 0 && distance(marked, enemy) <= 62) enemy.slowedUntil = s.elapsed + 3;
   }
   this.effect('snare', marked, 0x23795f, 62, .57);
   this.damageEnemy(marked, damage);
  } else if (id === 'whirl' || id === 'bash') {
   const close = this.nearest(p, radius, new Set<number>(), true);
   if (!close) return false;
   const angle = Math.atan2(close.y - p.y, close.x - p.x);
   this.slash(p, radius, angle, (64 + (level - 1) * 5) * Math.PI / 180, damage, id === 'bash' ? 0xd89835 : 0xc86536, id === 'bash' ? 45 : 0, id === 'bash' ? 'guard' : 'whirl');
  }
  else if (id === 'blade' || id === 'multishot' || id === 'pierce') {
   const count = id === 'multishot' ? cfg.count + (level - 1) * 2 : id === 'blade' ? level : 1;
   const style = id === 'multishot' ? 'volley' : id;
   for (let i = 0; i < count; i++) this.shoot(p, target, id === 'blade' ? 'blade' : 'arrow', damage, id === 'pierce' ? 490 : 350, id === 'multishot' ? 1 : 5 + level, (i - (count - 1) / 2) * .2, undefined, 1, style);
  } else if (id === 'rain') {
   this.addHazard(this.densest(target), radius, .65, damage, 'player', 'rain', 'rainImpact');
  } else if (id === 'fire') {
   this.effect('fire', target, 0xff6b36, 25, .44);
   this.damageEnemy(target, damage);
  } else if (id === 'chain') {
   this.effect('lightning', { x: target.x + 25, y: target.y - 115 }, 0x807aff, 0, .34, 0, undefined, target);
   this.damageEnemy(target, damage);
  }
  return true;
 }
 private densest(fallback: Enemy): Vec {
  let best = fallback, count = 0;
  for (const e of this.state.enemies.filter(e => e.hp > 0).slice(0, 35)) { let n = 0; for (const other of this.state.enemies) if (other.hp > 0 && distance(e, other) < 80) n++; if (n > count) { best = e; count = n; } }
  return { x: best.x, y: best.y };
 }
 private aoe(center: Vec, radius: number, damage: number, effect: Effect['kind'], color: number) {
  const s = this.state;
  this.effect(effect, center, color, radius, .45);
  for (const e of s.enemies) {
   if (e.hp <= 0 || distance(center, e) >= radius + e.radius) continue;
   this.damageEnemy(e, damage);
   if (effect === 'blast' && e.hp > 0 && !isBoss(e.kind)) e.slowedUntil = Math.max(e.slowedUntil ?? 0, s.elapsed + 2.4);
  }
 }
 private moveProjectiles(dt: number, frozen: boolean) {
  const s = this.state;
  for (const shot of s.projectiles) {
   if (s.player.hp <= 0 || s.status === 'victory') break;
   if (frozen && shot.kind === 'enemy') continue;
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
   const startX = shot.x, startY = shot.y, dx = shot.vx * dt, dy = shot.vy * dt;
   shot.x += dx; shot.y += dy;
   const lengthSquared = dx * dx + dy * dy;
   if (shot.kind === 'enemy') { if (distance(shot, s.player) < shot.radius + W.playerRadius) { this.damagePlayer(shot.damage); shot.life = 0; } }
   else for (const e of s.enemies) {
    if (shot.life <= 0 || e.hp <= 0 || shot.hit.has(e.id)) continue;
    const radius = shot.radius + e.radius;
    if (Math.abs(e.x - startX) >= radius + Math.abs(dx) || Math.abs(e.y - startY) >= radius + Math.abs(dy)) continue;
    const t = lengthSquared ? clamp(((e.x - startX) * dx + (e.y - startY) * dy) / lengthSquared, 0, 1) : 0;
    const offX = startX + t * dx - e.x, offY = startY + t * dy - e.y;
    if (offX * offX + offY * offY >= radius * radius) continue;
    if (shot.blastRadius !== undefined) {
     this.onSound?.('blastImpact');
     this.aoe({ x: e.x, y: e.y }, shot.blastRadius, shot.damage, 'blast', 0xcf5828);
     shot.life = 0;
     break;
    }
    shot.hit.add(e.id); this.damageEnemy(e, shot.damage); shot.damage *= shot.pierceScale ?? 1; if (shot.kind === 'magic') this.effect('crystal', shot, 0xad8dff, 20, .24); shot.pierce--; if (shot.pierce <= 0) shot.life = 0;
   }
  }
  s.projectiles = s.projectiles.filter(p => p.life > 0 && p.x > -50 && p.x < W.width + 50 && p.y > -60 && p.y < W.height + 60);
 }
 private addHazard(center: Vec, radius: number, delay: number, damage: number, owner: Hazard['owner'], kind: Hazard['kind'], impactSound?: CombatSound) {
  if (this.state.hazards.length < W.maxHazards) this.state.hazards.push({ id: ++this.serial, x: center.x, y: center.y, radius, delay, life: delay + .45, damage, owner, kind, fired: false, windup: delay, impactSound });
 }
 private updateHazards(dt: number, frozen: boolean) {
  for (const h of this.state.hazards) {
   if (this.state.player.hp <= 0) break;
   if (frozen && h.owner === 'enemy') continue;
   h.delay -= dt; h.life -= dt;
   if (h.delay <= 0 && !h.fired) {
    h.fired = true;
    if (h.impactSound) this.onSound?.(h.impactSound);
    if (h.owner === 'player') this.aoe(h, h.radius, h.damage, 'ring', 0xdcecc3);
    else {
     this.effect('ring', h, 0xee936d, h.radius, .4);
     if (distance(h, this.state.player) < h.radius) this.damagePlayer(h.damage);
    }
   }
  }
  this.state.hazards = this.state.hazards.filter(h => h.life > 0);
 }
 damageEnemy(enemy: Enemy, amount: number) {
  if (enemy.hp <= 0 || this.state.status === 'victory' || this.state.status === 'gameover') return;
  enemy.hp -= amount; enemy.hitFlash = .12;
  this.effect('hit', enemy, 0xffedc2, 13, .14); this.effect('text', { x: enemy.x + this.random() * 12 - 6, y: enemy.y - 15 }, 0xffecc9, 0, .65, 0, `${Math.round(amount)}`);
  if (!isBoss(enemy.kind) && this.state.timeStopRemaining <= 0) { const away = unit(this.state.player, enemy); enemy.x += away.x * 4; enemy.y += away.y * 4; }
  if (enemy.hp > 0) return;
  const s = this.state; s.kills++; if (isBoss(enemy.kind)) s.bosses++;
  const killGold = enemy.kind === 'warden' ? B.bossGold : isBoss(enemy.kind) ? 0 : B.goldPerKill * (enemy.elite ? 3 : 1);
  this.goldRaw += killGold * (1 + this.save.upgrades.gold * PERMANENT.gold.step);
  s.gold = Math.floor(this.goldRaw);
  if (isBoss(enemy.kind)) this.effect('boss-death', enemy, 0xffd68a, enemy.kind === 'warden' ? 220 : 150, enemy.kind === 'warden' ? 1.6 : 1.1);
  else this.effect('death', enemy, 0xadd48a, enemy.radius, .4);
  if (enemy.kind === 'warden') {
   this.goldRaw += CAMPAIGN.clearGold * (1 + s.rank * .5); s.gold = Math.floor(this.goldRaw); s.status = 'victory'; s.timeStopRemaining = 0; s.choices = []; s.projectiles = []; s.hazards = []; this.pendingChoices = 0;
   this.onSound?.('victory');
   return;
  }
  if (isBoss(enemy.kind)) this.onSound?.('grormDefeat');
  this.dropPickup(enemy);
  const openingXp = .78 * (1 - openingProgress(s.elapsed));
  const xpScale = isBoss(enemy.kind) ? (enemy.rewardScale ?? 1) : (B.regularXpScale + openingXp) * (enemy.elite ? 2 : 1);
  this.gainXp(Math.round(ENEMIES[enemy.kind].xp * xpScale));
 }
 private dropPickup(enemy: Enemy) {
  const s = this.state;
  let kind: Pickup['kind'], gold = 0;
  if (isBoss(enemy.kind)) {
   kind = 'chest';
   gold = enemy.rewardScale === undefined
    ? (enemy.paired ? PICKUPS.pairedChestGold : PICKUPS.firstChestGold)
    : Math.round(PICKUPS.firstChestGold * enemy.rewardScale);
  } else {
   if (s.elapsed < PICKUPS.from || s.finalSpawned) return;
   const roll = enemy.seed / (Math.PI * 2);
   if (roll < PICKUPS.healChance && this.healDrops < PICKUPS.maxHeals) {
    kind = 'heal';
    this.healDrops++;
   } else if (roll >= PICKUPS.healChance && roll < PICKUPS.healChance + PICKUPS.coinChance) {
    kind = 'coin';
    gold = PICKUPS.coinGold;
   } else return;
  }
  // Ground-space Y remains fixed while the camera scrolls down the field.
  s.pickups.push({ kind, gold,
   x: clamp(enemy.x, W.margin, W.width - W.margin), groundY: clamp(enemy.y, W.minY, W.height - W.margin) - s.scroll });
 }
 private collectPickups() {
  const s = this.state, p = s.player;
  s.pickups = s.pickups.filter(pickup => {
   const y = pickup.groundY + s.scroll;
   if (y > W.height + PICKUPS.radius) return false;
   if (Math.hypot(p.x - pickup.x, p.y - y) > PICKUPS.radius) return true;
   if (pickup.kind === 'heal') {
    const heal = Math.min(p.maxHp - p.hp, p.maxHp * PICKUPS.healFraction);
    if (heal <= 0) return true;
    p.hp += heal;
    this.effect('text', p, 0xcce8ad, 0, 1.3, 0, `체력 +${Math.ceil(heal)}`);
   } else {
    const before = s.gold;
    this.goldRaw += pickup.gold * (1 + this.save.upgrades.gold * PERMANENT.gold.step);
    s.gold = Math.floor(this.goldRaw);
    const label = pickup.kind === 'chest' ? '중간보스 보물 · ' : '';
    this.effect('text', p, 0xffd38a, 0, 1.4, 0, `${label}+${s.gold - before}G`);
   }
   return false;
  });
 }
 damagePlayer(amount: number) {
  const s = this.state, p = s.player; if (p.invincible > 0 || s.status !== 'running') return;
  p.invincible = W.invincibility; if (p.shield > 0) { p.shield--; this.effect('ring', p, 0xf6dc92, 38, .4); this.onSound?.('shieldBlock'); return; }
  p.hp = Math.max(0, p.hp - amount); this.effect('hit', p, 0xf2937e, 27, .25);
  if (p.hp <= 0) { s.status = 'gameover'; this.onSound?.('defeat'); }
 }
 gainXp(amount: number) {
  const s = this.state; s.xp += amount;
  while (s.xp >= s.xpNext) { s.xp -= s.xpNext; s.level++; s.xpNext = Math.round(s.xpNext * B.xpGrowth + B.xpIncrement); this.pendingChoices++; }
  if (this.pendingChoices > 0 && s.status === 'running') this.nextChoice();
 }
 private nextChoice() {
  const s = this.state; if (this.pendingChoices <= 0) { s.choices = []; s.status = 'running'; return; }
  s.choices = rollUpgrades(s, this.random); s.status = 'upgrade';
 }
 chooseUpgrade(id: string): boolean {
  const s = this.state; if (s.status !== 'upgrade' || !s.choices.some(c => c.id === id)) return false;
  if (id === 'evolve') { s.evolved = true; this.effect('ring', s.player, 0xffe2a4, 130, 1); }
  else if (id === 'weapon') s.weaponLevel++;
  else if (id === 'reserve:gold') { this.goldRaw += 8; s.gold = Math.floor(this.goldRaw); }
  else if (id === 'reserve:hp') s.player.maxHp += 4;
  else if (id === 'reserve:speed') s.player.speed += 3;
  else if (id.startsWith('skill:')) { const key = id.slice(6); s.skills[key] = (s.skills[key] ?? 0) + 1; this.skillTimers[key] = 0; }
  else { const key = id.slice(8) as PassiveId; s.passives[key]++; if (key === 'vitality') { const extra = HEROES[s.hero].hp * B.vitalityStep; s.player.maxHp += extra; s.player.hp = Math.min(s.player.maxHp, s.player.hp + extra * 1.6); } else if (key === 'speed') s.player.speed += HEROES[s.hero].speed * B.speedStep; }
  this.pendingChoices--; this.nextChoice(); return true;
 }
 private effect(kind: Effect['kind'], at: Vec, color: number, radius: number, duration: number, angle = 0, text?: string, to?: Vec, halfAngle?: number) {
  const effects = this.state.effects; if (effects.length >= W.maxEffects) effects.shift(); effects.push({ id: ++this.serial, kind, x: at.x, y: at.y, color, radius, life: duration, duration, angle, text, halfAngle, x2: to?.x, y2: to?.y });
 }
 result(): RunResult { const s = this.state; return { runId: s.runId, hero: s.hero, time: s.elapsed, level: s.level, kills: s.kills, bosses: s.bosses, gold: s.gold, cleared: s.status === 'victory', outcome: s.status === 'victory' ? 'victory' : s.status === 'gameover' ? 'defeat' : 'abandoned', rank: s.rank, combat: { spawned: s.spawned, killed: s.kills, missed: s.spawned - s.kills, escaped: s.escaped, withdrawn: s.withdrawn, remaining: s.enemies.filter(e => e.hp > 0).length, killRate: s.spawned ? s.kills / s.spawned * 100 : 0, missRate: s.spawned ? (s.spawned - s.kills) / s.spawned * 100 : 0 } }; }
}
