import { BALANCE as B, WORLD as W, HEROES, ENEMIES, SKILLS, PERMANENT, BOSS_PATTERN, PAIRED_GRORM, FIRST_GRORM, CAMPAIGN, PICKUPS, TIME_STOP, WARRIOR_PARRY, BLAST_ARROW_AIM_RANGE, ARCHER_FIELDS, SHIELD_RECHARGE, FROST_AURA, METEOR_SHOWER, GRAVITY_WELL, ATTACK_SKILL_UPGRADE, warriorSweepAngle, isBoss } from './config';
import { clamp, distance, normalize, unit } from './math';
import { rollUpgrades } from './progression';
import { spawnInterval, chooseEnemyKind, MIDDLE_BOSS_WAVES, openingProgress } from './encounters';
import type { CombatSound, FieldShot, GroundField, Hazard, HeroId, SaveData, RunState, Vec, EnemyKind, Enemy, Projectile, Pickup, Effect, PassiveId, RunResult, SkillId, SkillShot } from './types';
const SHIELD_FX_COLOR = 0x8ce6ff;
let runCounter = 0;
export function createRun(hero: HeroId, save: SaveData, rank = 0): RunState {
 const config = HEROES[hero], maxHp = Math.round(config.hp * (1 + save.upgrades.hp * PERMANENT.hp.step));
 return { runId: `${Date.now()}-${++runCounter}-${Math.random().toString(36).slice(2)}`, hero, status: 'running', elapsed: 0, rank, evolved: false, finalSpawned: false, timeStopCharges: clamp(save.upgrades.timeStop, 0, TIME_STOP.maxCharges), timeStopRemaining: 0, pickups: [], scroll: 0,
  player: { x: W.width / 2, y: 515, hp: maxHp, maxHp, speed: config.speed * (1 + save.upgrades.speed * PERMANENT.speed.step), invincible: 0, shield: 0, facing: -Math.PI / 2 },
  enemies: [], projectiles: [], effects: [], hazards: [], groundFields: [], level: 1, xp: 0, xpNext: B.initialXp, kills: 0, spawned: 0, escaped: 0, withdrawn: 0, bosses: 0, gold: 0, weaponLevel: 1, skills: {}, passives: { power: 0, haste: 0, vitality: 0, speed: 0 }, choices: [], nextBoss: MIDDLE_BOSS_WAVES[0].at };
}
export class GameSimulation {
 readonly state: RunState;
 speedMultiplier: 1 | 2 = 1;
 onSound?: (cue: CombatSound) => void;
 private regularSpawns = 0; private sideSpawns = 0;
 private healDrops = 0;
 private rewardedMiddleWaves = new Set<number>();
 private nextShamanAt = 0;
 private parryTimer = 0;
 private burnExposure = new WeakMap<Enemy, number>();
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
  this.updateMeteorShower(dt);
  if (this.hasWon()) return;
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
   if (!level || id === 'frost' || (id === 'shield' && p.shield)) continue;
   this.skillTimers[id] = (this.skillTimers[id] ?? 0) - dt;
   if (this.skillTimers[id] > 0) continue;
   const skill = SKILLS[id];
   const baseRank = Math.min(level, B.skillMax);
   const finalRank = level === ATTACK_SKILL_UPGRADE.rank;
   const killsBeforeCast = s.kills;
   if (this.castSkill(id, baseRank, finalRank)) {
    const rankHaste = 1 + (baseRank - 1) * (skill.hastePerLevel ?? B.skillHasteStep);
    if (id !== 'shield') this.skillTimers[id] = skill.cooldown / this.haste / rankHaste / (finalRank ? ATTACK_SKILL_UPGRADE.haste : 1);
    if (id === 'chain' && finalRank && s.kills > killsBeforeCast) this.skillTimers[id] *= .5;
    if (!this.hasWon()) this.onSound?.(id);
   }
  }
  if (this.hasWon()) return;
  this.updateGroundFields(dt);
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
  const frostRank = (s.skills.frost ?? 0) - 1;
  for (const e of s.enemies) {
   if (e.hp <= 0) continue; e.hitFlash = Math.max(0, e.hitFlash - dt);
   const bossEntering = e.entryTarget !== undefined && isBoss(e.kind);
   if (!bossEntering) e.timer -= dt;
   let dir = unit(e, p), speed = e.speed;
   if (!isBoss(e.kind)) {
    let slow = (e.slowedUntil ?? 0) > s.elapsed ? .48 : 0;
    for (const field of s.groundFields) {
     if (field.kind === 'snare' && this.inGroundField(field, e)) slow = Math.max(slow, field.slow);
    }
    speed *= 1 - slow;
   }
   const frost = frostRank >= 0 && e.kind !== 'warden' && distance(e, p) < FROST_AURA.radius[frostRank] + e.radius
    ? FROST_AURA.slow[frostRank] * (isBoss(e.kind) ? .5 : 1) : 0;
   if (e.entryTarget) {
    const step = (bossEntering ? 140 : speed * (1 - frost) * 1.75) * dt;
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
   speed *= 1 - frost;
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
 private nearest(origin: Vec, range = Infinity, excluded = new Set<number>(), includeRadius = false, eligible?: (enemy: Enemy) => boolean): Enemy | undefined {
  let best: Enemy | undefined, min = range;
  for (const e of this.state.enemies) { if (e.hp <= 0 || excluded.has(e.id) || (eligible && !eligible(e))) continue; const d = distance(origin, e) - (includeRadius ? e.radius : 0); if (d < min) { best = e; min = d; } }
  return best;
 }
 private priorityTarget(origin: Vec, range: number, tier?: (enemy: Enemy) => number) {
  let target: Enemy | undefined, bestTier = -Infinity;
  for (const enemy of this.state.enemies) {
   if (enemy.hp <= 0 || distance(origin, enemy) > range + enemy.radius) continue;
   const currentTier = tier?.(enemy) ?? 0;
   if (!target || currentTier > bestTier || (currentTier === bestTier && enemy.hp > target.hp)) {
    target = enemy; bestTier = currentTier;
   }
  }
  return target;
 }
 private inSweep(origin: Vec, point: Vec, angle: number, halfAngle: number) {
  const dir = unit(origin, point);
  return (dir.x === 0 && dir.y === 0) || dir.x * Math.cos(angle) + dir.y * Math.sin(angle) >= Math.cos(halfAngle);
 }
 private slash(origin: Vec, radius: number, angle: number, halfAngle: number, damage: number, color: number, knockback = 0, style: 'slash' | 'whirl' | 'bash' = 'slash') {
  this.effect(style, origin, color, radius, style === 'slash' ? .24 : .42, angle, undefined, undefined, halfAngle);
  for (const enemy of [...this.state.enemies]) {
   if (distance(origin, enemy) <= radius + enemy.radius && this.inSweep(origin, enemy, angle, halfAngle)) {
    this.damageEnemy(enemy, damage);
    if (knockback && enemy.hp > 0 && !isBoss(enemy.kind) && this.state.timeStopRemaining <= 0) {
     const away = unit(origin, enemy);
     const travel = away.x || away.y ? away : { x: Math.cos(angle), y: Math.sin(angle) };
     const end = { x: clamp(enemy.x + travel.x * knockback, -18, W.width + 18), y: clamp(enemy.y + travel.y * knockback, -18, W.height + 35) };
     if (style === 'bash') this.effect('bashImpact', enemy, color, 16, .42, 0, undefined, end);
     enemy.x = end.x; enemy.y = end.y;
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
 private shoot(from: Vec, to: Vec, kind: Projectile['kind'], damage: number, speed: number, pierce: number, spread = 0, target?: number, pierceScale = 1, skillShot?: SkillShot, field?: FieldShot) {
  const s = this.state; if (s.projectiles.length >= W.maxProjectiles) return false;
  const a = Math.atan2(to.y - from.y, to.x - from.x) + spread;
  const radius = skillShot === 'pierce' ? SKILLS.pierce.radius : kind === 'magic' ? 7 : kind === 'blade' ? 11 : kind === 'arrow' && skillShot ? 6 : 4;
  s.projectiles.push({ id: ++this.serial, x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, radius, damage, kind, life: 3.5, pierce, hit: new Set(), target, pierceScale, skillShot, field });
  return true;
 }
 private castSkill(id: Exclude<SkillId, 'frost'>, level: number, finalRank: boolean): boolean {
  const s = this.state, p = s.player, cfg = SKILLS[id], target = this.nearest(p, 500);
  const damage = this.power * cfg.damage * (1 + (level - 1) * B.skillDamageStep) * (finalRank ? ATTACK_SKILL_UPGRADE.damage : 1);
  const radius = cfg.radius + (level - 1) * (cfg.radiusPerLevel ?? B.skillRadiusStep);
  const rankIndex = finalRank ? ATTACK_SKILL_UPGRADE.rank - 1 : level - 1;
  if (id === 'shield') { p.shield = 1; this.effect('shieldRaise', p, SHIELD_FX_COLOR, cfg.radius, .55); return true; }
  if (id === 'meteor') {
   if (s.meteorShower || !s.enemies.some(enemy => enemy.hp > 0 && this.onScreen(enemy))) return false;
   s.meteorShower = { elapsed: 0, waves: 0, damage: damage / METEOR_SHOWER.waves };
   return true;
  }
  if (!target) return false;
  if (id === 'lunge') {
   const close = this.priorityTarget(p, radius);
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
   this.aoe(p, radius, damage, 'quake', 0xbe6839, 1.6);
  } else if (id === 'sunder' || id === 'deadeye') {
   const marked = this.priorityTarget(p, radius, id === 'deadeye'
    ? candidate => isBoss(candidate.kind) ? 2 : Number(candidate.elite)
    : undefined);
   if (!marked) return false;
   if (id === 'deadeye') this.effect('deadeye', p, 0xffdf75, 12, .46, 0, undefined, marked);
   else this.effect(id, marked, 0xaf4c21, 31, .55);
   this.damageEnemy(marked, damage);
  } else if (id === 'ricochet' || id === 'prism') {
   const hit = new Set<number>();
   let origin: Vec = p;
   const count = cfg.count + level - 1 + (id === 'ricochet' && finalRank ? 1 : 0);
   for (let i = 0; i < count; i++) {
    const marked = this.nearest(origin, id === 'ricochet' && i > 0 ? 104 : radius, hit);
    if (!marked) return hit.size > 0;
    hit.add(marked.id);
    const impact = { x: marked.x, y: marked.y };
    this.effect(id, origin, id === 'ricochet' ? 0x67d9ff : 0x6651fa, 12, id === 'ricochet' ? .42 + i * .025 : .4, i, undefined, impact);
    this.damageEnemy(marked, damage * (id === 'ricochet' ? .9 ** i : 1));
    if (id === 'ricochet') origin = impact;
   }
  } else if (id === 'blastArrow') {
   const marked = this.nearest(p, BLAST_ARROW_AIM_RANGE);
   return !!marked && this.shoot(p, marked, 'arrow', damage, 520, 1, 0, undefined, 1, 'blast', {
    kind: 'burn', radius, duration: ARCHER_FIELDS.duration[rankIndex],
   });
  } else if (id === 'gravity') {
   return this.castGravityWell(GRAVITY_WELL.radius[rankIndex], damage);
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
   const trapRadius = ARCHER_FIELDS.snareRadius + (level - 1) * ARCHER_FIELDS.snareRadiusStep;
   return this.shoot(p, marked, 'arrow', damage, 460, 1, 0, undefined, 1, 'snare', {
    kind: 'snare', radius: trapRadius, duration: ARCHER_FIELDS.duration[rankIndex], slow: ARCHER_FIELDS.snareSlow[rankIndex],
   });
  } else if (id === 'whirl' || id === 'bash') {
   const close = this.nearest(p, radius, new Set<number>(), true);
   if (!close) return false;
   const angle = Math.atan2(close.y - p.y, close.x - p.x);
   const bash = id === 'bash';
   const halfAngle = ((bash ? 64 : 48) + (level - 1) * 5) * Math.PI / 180;
   this.slash(p, radius, angle, halfAngle, damage, bash ? 0xffb35a : 0xc86536, bash ? 300 + (level - 1) * 20 : 0, id);
  }
  else if (id === 'pierce') {
   return this.shoot(p, target, 'arrow', damage, 490, Infinity, 0, undefined, 1, 'pierce');
  } else if (id === 'blade' || id === 'multishot') {
   const count = id === 'multishot' ? cfg.count + (level - 1) * 2 : id === 'blade' ? level : 1;
   const style = id === 'multishot' ? 'volley' : id;
   const pierce = id === 'multishot' ? 1 : 3 + level;
   for (let i = 0; i < count; i++) this.shoot(p, target, id === 'blade' ? 'blade' : 'arrow', damage, 350, pierce, (i - (count - 1) / 2) * .2, undefined, id === 'blade' ? .9 : 1, style);
  } else if (id === 'rain') {
   this.addHazard(this.densest(target), radius, .65, damage, 'player', 'rain', 'rainImpact');
  } else if (id === 'fire' || id === 'chain') {
   const preferred = id === 'fire' ? this.nearest(p, cfg.radius, undefined, false, enemy => enemy.elite) : undefined;
   const marked = preferred ?? this.nearest(p, cfg.radius);
   if (!marked) return false;
   if (id === 'fire') this.effect('fire', marked, 0xff6b36, 25, .44);
   else this.effect('lightning', { x: marked.x + 25, y: marked.y - 115 }, 0x807aff, 0, .34, 0, undefined, marked);
   this.damageEnemy(marked, damage);
  }
  return true;
 }
 private castGravityWell(radius: number, damage: number) {
  const { player, enemies, timeStopRemaining } = this.state;
  const { minRange, maxRange, nearGuard } = GRAVITY_WELL;
  let anchor: Enemy | undefined, bestDistance = 0;
  for (const enemy of enemies) {
   if (enemy.hp <= 0 || isBoss(enemy.kind)) continue;
   const range = distance(player, enemy);
   if (range < minRange || range > maxRange || range <= bestDistance) continue;
   anchor = enemy; bestDistance = range;
  }
  if (!anchor) return false;
  const center = { x: anchor.x, y: anchor.y };
  for (const enemy of enemies) {
   const separation = distance(center, enemy);
   if (enemy.hp <= 0 || separation >= radius + enemy.radius) continue;
   this.damageEnemy(enemy, damage, 0);
   if (enemy.hp <= 0 || isBoss(enemy.kind) || enemy.entryTarget || timeStopRemaining > 0) continue;
   const pull = unit(enemy, center), travel = Math.min(36, separation * .55);
   const next = { x: enemy.x + pull.x * travel, y: enemy.y + pull.y * travel };
   const before = distance(player, enemy);
   if (before < nearGuard && distance(player, next) < before) continue;
   enemy.x = next.x; enemy.y = next.y;
  }
  this.effect('gravity', center, 0x6a41b9, radius, .62);
  return true;
 }
 private densest(fallback: Enemy): Vec {
  let best = fallback, count = 0;
  for (const e of this.state.enemies.filter(e => e.hp > 0).slice(0, 35)) { let n = 0; for (const other of this.state.enemies) if (other.hp > 0 && distance(e, other) < 80) n++; if (n > count) { best = e; count = n; } }
  return { x: best.x, y: best.y };
 }
 private aoe(center: Vec, radius: number, damage: number, effect: Effect['kind'], color: number, slowDuration = 0) {
  const s = this.state;
  this.effect(effect, center, color, radius, .45);
  for (const e of s.enemies) {
   if (e.hp <= 0 || distance(center, e) >= radius + e.radius) continue;
   this.damageEnemy(e, damage);
   if (slowDuration && e.hp > 0 && !isBoss(e.kind)) e.slowedUntil = Math.max(e.slowedUntil ?? 0, s.elapsed + slowDuration);
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
    if (shot.field) {
     this.landFieldShot(shot.damage, e, shot.field);
     shot.life = 0;
     break;
    }
    shot.hit.add(e.id); this.damageEnemy(e, shot.damage); shot.damage *= shot.pierceScale ?? 1; if (shot.kind === 'magic') this.effect('crystal', shot, 0xad8dff, 20, .24); shot.pierce--; if (shot.pierce <= 0) shot.life = 0;
   }
  }
  s.projectiles = s.projectiles.filter(p => p.life > 0 && p.x > -50 && p.x < W.width + 50 && p.y > -60 && p.y < W.height + 60);
 }
 private landFieldShot(damage: number, enemy: Enemy, { radius, duration, ...spec }: FieldShot) {
  const impact = { x: enemy.x, y: enemy.y };
  const field = { x: impact.x, groundY: impact.y - this.state.scroll, radius, remaining: duration };
  if (spec.kind === 'snare') {
   this.state.groundFields.push({ ...field, ...spec });
   this.damageEnemy(enemy, damage);
  } else {
   this.state.groundFields.push({ ...field, kind: 'burn', damage: damage * ARCHER_FIELDS.burnDamageScale });
   this.onSound?.('blastImpact');
   this.aoe(impact, radius, damage, 'blast', 0xcf5828);
  }
 }
 private inGroundField(field: GroundField, enemy: Enemy) {
  return Math.hypot(enemy.x - field.x, enemy.y - field.groundY - this.state.scroll) < field.radius + enemy.radius;
 }
 private onScreen({ x, y, radius }: Enemy) {
  return x + radius > 0 && x - radius < W.width && y + radius > 0 && y - radius < W.height;
 }
 private updateMeteorShower(dt: number) {
  const s = this.state, shower = s.meteorShower;
  if (!shower) return;
  const { interval, waves, afterglow } = METEOR_SHOWER;
  shower.elapsed += dt;
  if (shower.waves < waves && shower.elapsed >= (shower.waves + 1) * interval - 1e-9) {
   shower.waves++;
   this.onSound?.('meteorImpact');
   for (const enemy of s.enemies) {
    if (enemy.hp > 0 && this.onScreen(enemy)) this.damageEnemy(enemy, shower.damage, 0);
    if (this.hasWon()) return;
   }
  }
  if (shower.elapsed >= waves * interval + afterglow) s.meteorShower = undefined;
 }
 private updateGroundFields(dt: number) {
  const s = this.state;
  if (!s.groundFields.length) return;
  const burning = s.groundFields.filter(field => field.kind === 'burn');
  if (burning.length) {
   for (const enemy of s.enemies) {
    if (enemy.hp <= 0) continue;
    let damage = 0, covered = 0;
    for (const field of burning) {
     if (!this.inGroundField(field, enemy)) continue;
     damage = Math.max(damage, field.damage);
     covered = Math.max(covered, field.remaining);
    }
    if (!covered) { this.burnExposure.delete(enemy); continue; }
    let exposure = (this.burnExposure.get(enemy) ?? 0) + Math.min(dt, covered);
    if (exposure >= ARCHER_FIELDS.burnInterval - 1e-9) {
     this.damageEnemy(enemy, damage, 0);
     exposure = Math.max(0, exposure - ARCHER_FIELDS.burnInterval);
    }
    this.burnExposure.set(enemy, exposure);
    if (this.hasWon()) return;
   }
  }
  for (const field of s.groundFields) field.remaining -= dt;
  if (burning.length && burning.every(field => field.remaining <= 1e-9)) this.burnExposure = new WeakMap();
  s.groundFields = s.groundFields.filter(field => field.remaining > 1e-9);
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
 damageEnemy(enemy: Enemy, amount: number, knockback = 4) {
  if (enemy.hp <= 0 || this.state.status === 'victory' || this.state.status === 'gameover') return;
  enemy.hp -= amount; enemy.hitFlash = .12;
  this.effect('hit', enemy, 0xffedc2, 13, .14); this.effect('text', { x: enemy.x + this.random() * 12 - 6, y: enemy.y - 15 }, 0xffecc9, 0, .65, 0, `${Math.round(amount)}`);
  if (knockback && !isBoss(enemy.kind) && this.state.timeStopRemaining <= 0) { const away = unit(this.state.player, enemy); enemy.x += away.x * knockback; enemy.y += away.y * knockback; }
  if (enemy.hp > 0) return;
  const s = this.state; s.kills++; if (isBoss(enemy.kind)) s.bosses++;
  const killGold = enemy.kind === 'warden' ? B.bossGold : isBoss(enemy.kind) ? 0 : B.goldPerKill * (enemy.elite ? 3 : 1);
  this.goldRaw += killGold * (1 + this.save.upgrades.gold * PERMANENT.gold.step);
  s.gold = Math.floor(this.goldRaw);
  if (isBoss(enemy.kind)) this.effect('boss-death', enemy, 0xffd68a, enemy.kind === 'warden' ? 220 : 150, enemy.kind === 'warden' ? 1.6 : 1.1);
  else this.effect('death', enemy, 0xadd48a, enemy.radius, .4);
  if (enemy.kind === 'warden') {
   this.goldRaw += CAMPAIGN.clearGold * (1 + s.rank * .5); s.gold = Math.floor(this.goldRaw); s.status = 'victory'; s.timeStopRemaining = 0; s.choices = []; s.projectiles = []; s.hazards = []; s.groundFields = []; s.meteorShower = undefined; this.pendingChoices = 0;
   this.onSound?.('victory');
   return;
  }
  if (isBoss(enemy.kind)) this.onSound?.('grormDefeat');
  const wave = isBoss(enemy.kind) ? MIDDLE_BOSS_WAVES.find(w => w.at === enemy.middleWave) : undefined;
  this.dropPickup(enemy, wave?.chestGold);
  const openingXp = .78 * (1 - openingProgress(s.elapsed));
  const xpScale = isBoss(enemy.kind) ? (wave?.xpScale ?? 1) : (B.regularXpScale + openingXp) * (enemy.elite ? 2 : 1);
  let xp = ENEMIES[enemy.kind].xp * xpScale;
  if (wave && !this.rewardedMiddleWaves.has(wave.at)) {
   this.rewardedMiddleWaves.add(wave.at);
   const bossRatio = ENEMIES[enemy.kind].xp / ENEMIES.boss.xp;
   xp = Math.max(xp, s.xpNext * wave.firstKillXp * bossRatio);
  }
  this.gainXp(Math.round(xp));
 }
 private dropPickup(enemy: Enemy, chestGold = PICKUPS.firstChestGold) {
  const s = this.state;
  let kind: Pickup['kind'], gold = 0;
  if (isBoss(enemy.kind)) {
   kind = 'chest';
   gold = chestGold;
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
    const chest = pickup.kind === 'chest';
    const label = chest ? '중간보스 보물 · ' : '';
    if (chest) {
     this.effect('chestPickup', { x: pickup.x, y }, 0xffce63, 58, .8);
     this.onSound?.('chestPickup');
    }
    this.effect('text', p, 0xffd38a, 0, 1.4, 0, `${label}+${s.gold - before}G`);
   }
   return false;
  });
 }
 damagePlayer(amount: number) {
  const s = this.state, p = s.player; if (p.invincible > 0 || s.status !== 'running') return;
  p.invincible = W.invincibility;
  if (p.shield > 0) {
   p.shield = 0;
   this.skillTimers.shield = SHIELD_RECHARGE[(s.skills.shield || 1) - 1] / this.haste;
   this.effect('shieldBreak', p, SHIELD_FX_COLOR, 44, .55);
   this.onSound?.('shieldBlock');
   return;
  }
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
  else if (id.startsWith('skill:')) {
   const key = id.slice(6);
   s.skills[key] = (s.skills[key] ?? 0) + 1;
   if (key !== 'frost') {
    const remaining = this.skillTimers[key] ?? 0;
    this.skillTimers[key] = key === 'shield' ? Math.min(remaining, SHIELD_RECHARGE[s.skills[key] - 1] / this.haste) : 0;
   }
  }
  else { const key = id.slice(8) as PassiveId; s.passives[key]++; if (key === 'vitality') { const extra = HEROES[s.hero].hp * B.vitalityStep; s.player.maxHp += extra; s.player.hp = Math.min(s.player.maxHp, s.player.hp + extra * 1.6); } else if (key === 'speed') s.player.speed += HEROES[s.hero].speed * B.speedStep; }
  this.pendingChoices--; this.nextChoice(); return true;
 }
 private effect(kind: Effect['kind'], at: Vec, color: number, radius: number, duration: number, angle = 0, text?: string, to?: Vec, halfAngle?: number) {
  const effects = this.state.effects; if (effects.length >= W.maxEffects) effects.shift(); effects.push({ id: ++this.serial, kind, x: at.x, y: at.y, color, radius, life: duration, duration, angle, text, halfAngle, x2: to?.x, y2: to?.y });
 }
 result(): RunResult { const s = this.state; return { runId: s.runId, hero: s.hero, time: s.elapsed, level: s.level, kills: s.kills, bosses: s.bosses, gold: s.gold, cleared: s.status === 'victory', outcome: s.status === 'victory' ? 'victory' : s.status === 'gameover' ? 'defeat' : 'abandoned', rank: s.rank, combat: { spawned: s.spawned, killed: s.kills, missed: s.spawned - s.kills, escaped: s.escaped, withdrawn: s.withdrawn, remaining: s.enemies.filter(e => e.hp > 0).length, killRate: s.spawned ? s.kills / s.spawned * 100 : 0, missRate: s.spawned ? (s.spawned - s.kills) / s.spawned * 100 : 0 } }; }
}
