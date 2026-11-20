import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import type { PlaytestView } from './playtest-harness';
test.use({ trace: 'off' });
const runTag = process.env.PLAYTEST_RUN ?? 'campaign-grown';
const build = process.env.PLAYTEST_BUILD ?? 'weapon';
for (const hero of ['mage']) test(`${hero}: normal-HP grown mobile touch ten-minute boss victory`, async ({ browser }) => {
 test.setTimeout(600000);
 const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }); const page = await context.newPage();
 const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
 await page.addInitScript(() => localStorage.setItem('everpath.save.v1', JSON.stringify({ version: 1, gold: 0, invested: 10864, upgrades: { attack: 10, hp: 10, speed: 10, gold: 10 } })));
 const started = Date.now(); await page.clock.install(); await page.goto(`/e2e/playtest.html?debug&seed=42&build=${build}`);
 await page.getByRole('button', { name: '모험 시작' }).click(); await page.locator(`[data-hero="${hero}"]`).click(); await page.getByRole('button', { name: '숲으로 떠나기' }).click();
 const read = () => page.evaluate(() => (window as unknown as { __playtest: { view(): PlaytestView } }).__playtest.view());
 const touch = await context.newCDPSession(page); let down = false, lastCapture = 0, warningCaptured = false;
 for (let i = 0; i < 3800; i++) {
  let s = (await read())!; if (s.status === 'gameover' || s.status === 'victory' || s.elapsed >= 710) break;
  if (s.status === 'upgrade') {
   if (down) { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); down = false; }
   await page.locator(`[data-action="upgrade"][data-id="${s.choice}"]`).click(); continue;
  }
  const rect = (await page.locator('canvas').boundingBox())!;
  if (!down || !s.dragging) {
   if (down) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
   await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x + rect.width * .5, y: rect.y + rect.height * .72, id: 1 }] }); down = true;
   s = (await read())!;
  }
  const x = rect.x + (s.center.x + s.direction.x * 48) / 432 * rect.width;
  const y = rect.y + (s.center.y + s.direction.y * 48) / 768 * rect.height;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
  await page.clock.runFor(200);
  s = (await read())!;
  if (s.bossWarning && !warningCaptured) { warningCaptured = true; await page.screenshot({ path: `test-results/${hero}-dash-warning-mobile.png` }); }
  if (s.elapsed >= (lastCapture + 1) * 180) { lastCapture++; await page.screenshot({ path: `test-results/${hero}-${lastCapture * 3}min-mobile.png` }); }
 }
 if (down) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
 await page.clock.runFor(1800); // Finish the victory animation on the accelerated clock.
 const end = (await read())!; const summary = { ...end, seed: 42, meta: 'All four permanent ranks10 fixture, normal HP, no combat edits', input: 'Native CDP touch, 200ms steering, real App/Phaser, accelerated browser clock', realSeconds: Math.round((Date.now() - started) / 1000), errors };
 mkdirSync('docs/playtests', { recursive: true });
 writeFileSync(`docs/playtests/browser-${runTag}-${hero}.json`, JSON.stringify(summary, null, 2));
 const paths = ['warrior', 'archer', 'mage'].map(id => `docs/playtests/browser-${runTag}-${id}.json`);
 const results = paths.filter(existsSync).map(path => JSON.parse(readFileSync(path, 'utf8')));
 writeFileSync(`docs/playtests/browser-${runTag}.json`, JSON.stringify(results, null, 2));
 await page.screenshot({ path: `test-results/${hero}-playtest-end-mobile.png` });
 console.log(JSON.stringify({ hero, elapsed: end.elapsed, hp: end.hp, kills: end.kills, bosses: end.bosses, maxObjects: end.maxObjects, errors }));
 expect(errors).toEqual([]); expect(end.elapsed).toBeGreaterThanOrEqual(600); expect(end.status).toBe('victory'); await expect(page.locator('.result-panel')).toContainText('뿌리의 군주를 쓰러뜨렸습니다'); const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('everpath.save.v1')!)); expect(saved.clears.mage).toBe(1); expect(saved.history).toHaveLength(1); const c=saved.history[0].combat;expect(c.spawned).toBe(c.killed+c.missed);expect(c.missed).toBe(c.escaped+c.withdrawn+c.remaining);expect(c.killed).toBe(end.kills);await expect(page.locator('[data-record-missed]')).toContainText(`${c.missed}마리`);const frozen=await read();await page.clock.runFor(5000);expect(await read()).toEqual(frozen); expect(saved.challengeUnlocked).toBe(1); expect(end.maxEnemies).toBeLessThanOrEqual(100); expect(end.maxShots).toBeLessThanOrEqual(180); expect(end.maxObjects).toBeLessThan(500);
 await context.close();
});
