import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { GameSimulation } from '../src/game/simulation';
import type { CombatFeedback, HeroId } from '../src/game/types';

type Fixture = {
 sim: GameSimulation;
 scene: { children: { list: Phaser.GameObjects.GameObject[] } };
};
type FixturePage = Window & { openingApp: Fixture; feedbackEvents: string[] };

test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });

async function start(page: Page, hero: HeroId) {
 await page.clock.install();
 await page.route('**/opening-feedback-check*', route => route.fulfill({
  contentType: 'text/html',
  body: '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="app"></div><script type="module">import "/src/style.css";import {App} from "/src/ui/app.ts";window.openingApp=new App(document.querySelector("#app"));</script>',
 }));
 await page.goto('/opening-feedback-check');
 await page.getByRole('button', { name: '모험 시작' }).tap();
 await page.locator('[data-hero="' + hero + '"]').tap();
 await page.getByRole('button', { name: '숲으로 떠나기' }).tap();
 await page.clock.pauseAt(await page.evaluate(() => Date.now() + 40));
 await page.evaluate(() => {
  const f = window as unknown as FixturePage;
  const original = f.openingApp.sim.onFeedback!;
  f.feedbackEvents = [];
  f.openingApp.sim.onFeedback = (event: CombatFeedback) => {
   if (event.kind === 'strike') f.feedbackEvents.push(event.style);
   if (event.kind === 'hurt') f.feedbackEvents.push(event.cause);
   original(event);
  };
 });
}

const visibleText = (page: Page) => page.evaluate(() => {
 const { scene } = (window as unknown as FixturePage).openingApp;
 return scene.children.list.filter(child => child.type === 'Text' && (child as Phaser.GameObjects.Text).visible)
  .map(child => (child as Phaser.GameObjects.Text).text);
});
const events = (page: Page) => page.evaluate(() => (window as unknown as FixturePage).feedbackEvents);

for (const [hero, hit] of [['warrior', 'sword'], ['archer', 'arrow'], ['mage', 'magic']] as const) {
 test(`${hero}: confirms a real basic weapon hit by default in Mini World`, async ({ page }) => {
  await start(page, hero);
  await page.evaluate(() => {
   const { sim } = (window as unknown as FixturePage).openingApp;
   sim.state.enemies = [];
   const { x, y } = sim.state.player;
   sim.spawnEnemy('slime', x, y - 78);
  });
  await page.clock.runFor(570);
  expect(await events(page)).toContain(hit);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(568);
 });
}

test('Grorm warning, hit, and earned chest use graphics and +150G without instruction text boxes', async ({ page }, testInfo) => {
 await start(page, 'warrior');
 await page.evaluate(() => {
  const { sim } = (window as unknown as FixturePage).openingApp;
  const s = sim.state;
  s.elapsed = 119.99;
  s.enemies = [];
  sim.update(.02);
  const grorm = s.enemies.find(e => e.middleWave === 120)!;
  const p = s.player;
  p.x = 215; p.y = 480;
  grorm.x = p.x; grorm.y = p.y - 150; grorm.timer = .02; grorm.entryTarget = undefined;
 });
 await page.clock.runFor(420);
 const warnTexts = await visibleText(page);
 expect(warnTexts.some(text => text.includes('피하기') || text.includes('돌진'))).toBe(false);
 await page.screenshot({ path: testInfo.outputPath('grorm-warning.png'), timeout: 3500 });

 await page.clock.runFor(1240);
 expect(await events(page)).toContain('charge');
 const hitTexts = await visibleText(page);
 expect(hitTexts.some(text => text.includes('피격') || text.includes('충돌'))).toBe(false);
 await page.screenshot({ path: testInfo.outputPath('grorm-hit.png'), timeout: 3500 });

 const goldBefore = await page.evaluate(() => {
  const { sim } = (window as unknown as FixturePage).openingApp;
  const s = sim.state;
  const grorm = s.enemies.find(e => e.middleWave === 120)!;
  grorm.x = 240; grorm.y = 333;
  sim.damageEnemy(grorm, grorm.hp, 0);
  while (s.choices.length) sim.chooseUpgrade(s.choices[0].id);
  return s.gold;
 });
 await page.clock.runFor(150);
 const chestTexts = await visibleText(page);
 expect(chestTexts.some(text => text.includes('보물 상자') || text.includes('다가가기'))).toBe(false);
 await page.screenshot({ path: testInfo.outputPath('grorm-chest.png'), timeout: 3500 });

 await page.evaluate(() => {
  const { sim } = (window as unknown as FixturePage).openingApp;
  const s = sim.state;
  const chest = s.pickups.find(item => item.kind === 'chest')!;
  s.player.x = chest.x;
  s.player.y = chest.groundY + s.scroll;
 });
 await page.clock.runFor(100);
 const rewardText = await visibleText(page);
 expect(rewardText).toContain('+150G');
 expect(rewardText.some(text => text.includes('중간보스 보물') || text.includes('보물 획득'))).toBe(false);
 expect(await page.evaluate(() => (window as unknown as FixturePage).openingApp.sim.state.gold)).toBe(goldBefore + 150);
 await page.screenshot({ path: testInfo.outputPath('grorm-reward.png'), timeout: 3500 });
});

test('hit feedback records projectiles, ground circles, and contact without canvas text boxes', async ({ page }) => {
 await start(page, 'mage');
 const trigger = (kind: 'projectile' | 'ground' | 'contact') => page.evaluate(kind => {
  const { sim } = (window as unknown as FixturePage).openingApp;
  const s = sim.state, { x, y } = s.player;
  s.enemies = []; s.hazards = []; s.projectiles = []; s.player.invincible = 0;
  if (kind === 'projectile') s.projectiles.push({
   id: 50_000, x: x - 8, y, vx: 150, vy: 0, kind: 'enemy', radius: 4, damage: 10, life: 1, pierce: 1, hit: new Set(),
  });
  if (kind === 'ground') s.hazards.push({
   id: 50_001, x, y, radius: 38, delay: 0, life: .45, damage: 11, owner: 'enemy', kind: 'slam', fired: false,
  });
  if (kind === 'contact') sim.spawnEnemy('slime', x - 16, y);
 }, kind);
 for (const kind of ['projectile', 'ground', 'contact'] as const) {
  await trigger(kind);
  await page.clock.runFor(90);
  expect(await events(page)).toContain(kind);
  const texts = await visibleText(page);
  expect(texts.some(text => text.includes('피격') || text.includes('충돌'))).toBe(false);
 }
});

test('keeps hurt feedback and multi-chest markers active at 4 minutes without text boxes', async ({ page }) => {
 await start(page, 'archer');
 await page.evaluate(() => {
  const { sim } = (window as unknown as FixturePage).openingApp;
  const s = sim.state;
  s.elapsed = 239.99;
  s.nextBoss = 240;
  s.enemies = []; s.hazards = []; s.projectiles = []; s.player.invincible = 0;
  sim.update(.02);
  s.projectiles.push({
   id: 60_000, x: s.player.x - 8, y: s.player.y, vx: 150, vy: 0, kind: 'enemy', radius: 4, damage: 10, life: 1, pierce: 1, hit: new Set(),
  });
  for (const boss of s.enemies.filter(e => e.middleWave === 240)) {
   sim.damageEnemy(boss, boss.hp, 0);
   while (s.choices.length) sim.chooseUpgrade(s.choices[0].id);
  }
 });
 await page.clock.runFor(90);
 expect(await events(page)).toContain('projectile');
 const chests = await page.evaluate(() => {
  const { sim } = (window as unknown as FixturePage).openingApp;
  return sim.state.pickups.filter(p => p.kind === 'chest').length;
 });
 expect(chests).toBe(2);
 expect((await visibleText(page)).some(t => t.includes('피격') || t.includes('보물 상자'))).toBe(false);
});
