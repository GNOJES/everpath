import { GameSimulation } from '../../src/game/simulation';
import { parseSave } from '../../src/game/save';
import { HEROES, WORLD } from '../../src/game/config';
import { distance, normalize } from '../../src/game/math';
import type { Enemy, HeroId, RunState, Vec, SaveData } from '../../src/game/types';
export function seededRandom(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
export type Policy = 'idle' | 'circuit' | 'reactive' | 'high-camp' | 'mid-camp';
export type Build = 'balanced' | 'weapon' | 'skills';
export function chooseAbility(state: RunState, build: Build): string {
 const skills = HEROES[state.hero].skills;
 const score = (id: string) => {
  const hp = state.player.hp / state.player.maxHp;
  if (id === 'passive:vitality' && hp < .45) return 120;
  if (id === 'evolve') return 200;
  if (id === 'weapon') return build === 'weapon' ? 110 : 70;
  if (id.startsWith('skill:')) { const level = state.skills[id.slice(6)] ?? 0; return (build === 'skills' ? 100 : 85) - level * 12 + skills.indexOf(id.slice(6)) * .01; }
  return ({ 'passive:power': 65, 'passive:haste': 60, 'passive:vitality': 45, 'passive:speed': 40 } as Record<string, number>)[id] ?? 0;
 };
 return [...state.choices].sort((a, b) => score(b.id) - score(a.id))[0].id;
}
const waypoints: Vec[] = [{ x: 100, y: 540 }, { x: 100, y: 270 }, { x: 332, y: 270 }, { x: 332, y: 580 }];
export class Pilot {
 private waypoint = 0; private heading: Vec = { x: 0, y: 0 };
 constructor(private policy: Policy) {}
 direction(s: RunState): Vec {
  if (this.policy === 'idle') return { x: 0, y: 0 };
  if (this.policy === 'high-camp' || this.policy === 'mid-camp') {
   const y = this.policy === 'high-camp' ? 75 : 355;
   const gap = y - s.player.y;
   return Math.abs(gap) < 14 ? { x: 0, y: 0 } : { x: 0, y: Math.sign(gap) };
  }
  const p = s.player, target = waypoints[this.waypoint]; if (distance(p, target) < 24) this.waypoint = (this.waypoint + 1) % waypoints.length;
  const destination = waypoints[this.waypoint]; let desired = normalize((destination.x - p.x) / 20, (destination.y - p.y) / 20);
  if (this.policy === 'reactive') {
   // Deliberately modest 10 Hz local steering, not a perfect full-world optimizer.
   let best = -Infinity; const previous = this.heading; let chosen = this.heading;
   for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, d = { x: Math.cos(a), y: Math.sin(a) };
    const future = { x: p.x + d.x * p.speed * .45, y: p.y + d.y * p.speed * .45 };
    if (future.x < 30 || future.x > WORLD.width - 30 || future.y < 120 || future.y > WORLD.height - 45) continue;
    let score = (desired.x * d.x + desired.y * d.y) * 16 + (previous.x * d.x + previous.y * d.y) * 6;
    for (const e of s.enemies) {
     if (e.hp <= 0) continue; const separation = distance(future, e) - e.radius - WORLD.playerRadius;
     if (separation < 100) score -= (100 - separation) * (separation < 12 ? 3 : .6);
     if (e.kind === 'boss' && (e.phase === 'warn' || e.phase === 'dash')) { const rx = future.x - e.x, ry = future.y - e.y, along = rx * e.aim.x + ry * e.aim.y, cross = Math.abs(rx * e.aim.y - ry * e.aim.x); if (along > 0 && along < 210 && cross < 55) score -= 180; }
    }
    for (const shot of s.projectiles) if (shot.kind === 'enemy' && distance(future, shot) < 50) score -= 50;
    for (const h of s.hazards) if (h.owner === 'enemy' && !h.fired && distance(future, h) < h.radius + 20) score -= 180;
    if (score > best) { best = score; chosen = d; }
   }
   this.heading = chosen; return this.heading;
  }
  this.heading = desired; return desired;
 }
}
export interface Checkpoint { seconds: number; hp: number; maxHp: number; kills: number; level: number; bosses: number; enemies: number; skills: Record<string, number> }
export function playTrial(hero: HeroId, seed: number, policy: Policy, build: Build, duration = 600, meta = 0, saved?: SaveData) {
 const save = saved ? structuredClone(saved) : parseSave(null); for (const key of Object.keys(save.upgrades) as (keyof typeof save.upgrades)[]) if (!saved) save.upgrades[key] = meta;
 const sim = new GameSimulation(hero, save, seededRandom(seed)), pilot = new Pilot(policy);
 let direction = { x: 0, y: 0 }, firstKill = 0, firstLevel = 0, hpLost = 0, hits = 0, maxEnemies = 0, maxShots = 0; const checkpoints: Checkpoint[] = [], upgrades: { time: number; id: string }[] = [];
 const pair = new Set<Enemy>();
 const step = 1 / 30;
 for (let frame = 0; frame < duration * 30; frame++) {
  const s = sim.state; if (s.status === 'gameover' || s.status === 'victory') break;
  while (s.status === 'upgrade') { firstLevel ||= s.elapsed; const id = chooseAbility(s, build); upgrades.push({ time: Math.round(s.elapsed * 10) / 10, id }); sim.chooseUpgrade(id); }
  if (frame % 3 === 0) direction = pilot.direction(s);
  const before = s.player.hp; sim.update(step, direction); if (s.player.hp < before) { hpLost += before - s.player.hp; hits++; }
  if (s.kills && !firstKill) firstKill = s.elapsed;
  if (s.elapsed >= 360 && !s.finalSpawned) for (const enemy of s.enemies) {
   if (enemy.kind === 'boss' && enemy.rewardScale === .5) pair.add(enemy);
  }
  maxEnemies = Math.max(maxEnemies, s.enemies.length); maxShots = Math.max(maxShots, s.projectiles.length);
  if (Math.floor(s.elapsed / 60) > checkpoints.length) checkpoints.push({ seconds: Math.round(s.elapsed), hp: Math.round(s.player.hp), maxHp: Math.round(s.player.maxHp), kills: s.kills, level: s.level, bosses: s.bosses, enemies: s.enemies.length, skills: { ...s.skills } });
 }
 const s = sim.state;
 return { hero, seed, policy, build, duration, meta, gold: s.gold, evolved: s.evolved, survived: Math.round(s.elapsed * 10) / 10, status: s.status, firstKill: Math.round(firstKill * 10) / 10, firstLevel: Math.round(firstLevel * 10) / 10, sixMinuteBossKills: [...pair].filter(enemy => enemy.hp <= 0).length, kills: s.kills, bosses: s.bosses, level: s.level, hp: Math.round(s.player.hp), maxHp: Math.round(s.player.maxHp), hpLost: Math.round(hpLost), hits, maxEnemies, maxShots, upgrades, checkpoints };
}
