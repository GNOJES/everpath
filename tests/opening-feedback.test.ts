import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OpeningFeedback } from '../src/game/opening-feedback';
import { parseSave } from '../src/game/save';
import { GameSimulation } from '../src/game/simulation';
import type { CombatFeedback, DamageCause } from '../src/game/types';

function pngSize(file: string) {
 const bytes = readFileSync(resolve(process.cwd(), file));
 expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
 return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

class GraphicsRecorder {
 calls: string[] = [];
 lineStyle() { this.calls.push('lineStyle'); return this; }
 fillStyle() { this.calls.push('fillStyle'); return this; }
 strokeEllipse() { this.calls.push('strokeEllipse'); return this; }
 strokeCircle() { this.calls.push('strokeCircle'); return this; }
 fillTriangle() { this.calls.push('fillTriangle'); return this; }
 fillRect() { this.calls.push('fillRect'); return this; }
 lineBetween() { this.calls.push('lineBetween'); return this; }
}

describe('Option C warrior sprite assets', () => {
 it('stores the 20x18 knight portrait and 280x120 7x3 directional motion sheet', () => {
  expect(pngSize('src/game/assets/preview-packs/mini/warrior.png')).toEqual({ width: 20, height: 18 });
  expect(pngSize('src/game/assets/preview-packs/mini/warrior-motion.png')).toEqual({ width: 280, height: 120 });
 });
});

describe('text-free opening feedback', () => {
 it('draws chest marker and weapon strike without Phaser text objects', () => {
  const feedback = new OpeningFeedback();
  const sim = new GameSimulation('warrior', parseSave(null), () => .5);
  const grorm = sim.spawnEnemy('boss', 216, 200)!;
  grorm.middleWave = 120;
  sim.damageEnemy(grorm, grorm.hp);
  while (sim.state.choices.length) sim.chooseUpgrade(sim.state.choices[0].id);

  const chest = sim.state.pickups.find(p => p.kind === 'chest')!;
  expect(chest).toBeDefined();
  feedback.record({ kind: 'firstChest', pickup: chest }, 1);
  feedback.record({ kind: 'strike', style: 'sword', at: { x: 210, y: 400 }, angle: -Math.PI / 2 }, 1);
  const g = new GraphicsRecorder();
  feedback.draw(g as unknown as Parameters<OpeningFeedback['draw']>[0], sim.state, 1.05);
  expect(g.calls).toContain('strokeEllipse');
  expect(g.calls).toContain('fillTriangle');
  expect(g.calls).toContain('lineBetween');
 });

 it('distinguishes directional hurt causes from ground/slam circles visually without text', () => {
  const sim = new GameSimulation('warrior', parseSave(null), () => .5);
  for (const cause of ['contact', 'projectile', 'ground', 'charge', 'slam'] as DamageCause[]) {
   const feedback = new OpeningFeedback();
   feedback.record({ kind: 'hurt', cause, source: { x: 216, y: 300 }, amount: 12 }, 1);
   const g = new GraphicsRecorder();
   feedback.draw(g as unknown as Parameters<OpeningFeedback['draw']>[0], sim.state, 1.05);
   expect(g.calls.length).toBeGreaterThan(0);
   if (cause === 'ground' || cause === 'slam') {
    expect(g.calls).not.toContain('fillTriangle');
   } else {
    expect(g.calls).toContain('fillTriangle');
   }
  }
 });

 it('simplifies midboss chest reward floating text to +gold without instructional prefixes', () => {
  const feedback = new OpeningFeedback();
  expect(feedback.formatWorldText('중간보스 보물 · +150G')).toBe('+150G');
  expect(feedback.formatWorldText('+10G')).toBe('+10G');
  expect(feedback.formatWorldText('18')).toBe('18');
  expect(feedback.formatWorldText(undefined)).toBe('');
 });

 it('emits combat feedback for strikes, hit causes, and chest collection without altering simulation values', () => {
  const events: CombatFeedback[] = [];
  const sim = new GameSimulation('warrior', parseSave(null), () => .5);
  sim.onFeedback = event => events.push(event);
  sim.state.elapsed = 119.99;
  sim.update(.02);
  const grorm = sim.state.enemies.find(e => e.middleWave === 120)!;
  sim.damageEnemy(grorm, grorm.hp);
  while (sim.state.choices.length) sim.chooseUpgrade(sim.state.choices[0].id);
  expect(events.some(e => e.kind === 'firstChest')).toBe(true);
  const chest = sim.state.pickups.find(p => p.kind === 'chest')!;
  sim.state.player.x = chest.x;
  sim.state.player.y = chest.groundY + sim.state.scroll;
  sim.update(.02);
  expect(events).toContainEqual(expect.objectContaining({ kind: 'chestCollected', amount: 150 }));
  expect(sim.state.gold).toBe(150);
 });

 it('tracks multiple midboss chests past two minutes without clearing hurt indicators', () => {
  const events: CombatFeedback[] = [];
  const feedback = new OpeningFeedback();
  const sim = new GameSimulation('warrior', parseSave(null), () => .5);
  sim.onFeedback = event => events.push(event);
  sim.state.elapsed = 239.99;
  sim.state.nextBoss = 240;
  expect(feedback.relevant(sim.state)).toBe(true);
  sim.update(.02);
  const pair = sim.state.enemies.filter(e => e.middleWave === 240);
  expect(pair).toHaveLength(2);
  sim.damageEnemy(pair[0], pair[0].hp);
  while (sim.state.choices.length) sim.chooseUpgrade(sim.state.choices[0].id);
  sim.damageEnemy(pair[1], pair[1].hp);
  while (sim.state.choices.length) sim.chooseUpgrade(sim.state.choices[0].id);

  const chestEvents = events.filter(e => (e as { kind: string }).kind === 'chest');
  expect(chestEvents).toHaveLength(2);
  feedback.record({ kind: 'hurt', cause: 'contact', source: { x: 216, y: 300 }, amount: 12 }, 1);
  for (const event of chestEvents) feedback.record(event, 1);
  const g = new GraphicsRecorder();
  feedback.draw(g as unknown as Parameters<OpeningFeedback['draw']>[0], sim.state, 1.05);
  expect(g.calls.filter(c => c === 'strokeEllipse')).toHaveLength(3);
  expect(g.calls).toContain('fillTriangle');

  const chests = sim.state.pickups.filter(p => p.kind === 'chest');
  feedback.record({ kind: 'chestCollected', pickup: chests[0], amount: 100 }, 1.1);
  const g2 = new GraphicsRecorder();
  feedback.draw(g2 as unknown as Parameters<OpeningFeedback['draw']>[0], sim.state, 1.15);
  expect(g2.calls.filter(c => c === 'strokeEllipse')).toHaveLength(2);

  feedback.record({ kind: 'chestCollected', pickup: chests[1], amount: 100 }, 1.2);
  const g3 = new GraphicsRecorder();
  feedback.draw(g3 as unknown as Parameters<OpeningFeedback['draw']>[0], sim.state, 1.5);
  expect(g3.calls).toHaveLength(0);
 });
});
