import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import type { PlaytestView } from './playtest-harness';
const runTag = process.env.PLAYTEST_RUN ?? 'latest';
const build = process.env.PLAYTEST_BUILD ?? 'weapon';
for (const hero of ['warrior', 'archer', 'mage']) test(`${hero}: normal-HP mobile touch survival through 5–10 game minutes`, async ({ browser }) => {
 test.setTimeout(600000);
 const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }); const page = await context.newPage();
 const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
 const started = Date.now(); await page.clock.install(); await page.goto(`/e2e/playtest.html?debug&seed=42&build=${build}`);
 await page.getByRole('button', { name: '모험 시작' }).click(); await page.locator(`[data-hero="${hero}"]`).click(); await page.getByRole('button', { name: '숲으로 떠나기' }).click();
 const read = () => page.evaluate(() => (window as unknown as { __playtest: { view(): PlaytestView } }).__playtest.view());
 const touch = await context.newCDPSession(page); let down = false, lastCapture = 0, warningCaptured = false;
 for (let i = 0; i < 6500; i++) {
  let s = (await read())!; if (s.status === 'gameover' || s.elapsed >= 600) break;
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
  await page.clock.runFor(100);
  s = (await read())!;
  if (s.bossWarning && !warningCaptured) { warningCaptured = true; await page.screenshot({ path: `test-results/${hero}-dash-warning-mobile.png` }); }
  if (s.elapsed >= (lastCapture + 1) * 180) { lastCapture++; await page.screenshot({ path: `test-results/${hero}-${lastCapture * 3}min-mobile.png` }); }
 }
 if (down) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
 const end = (await read())!; const summary = { ...end, seed: 42, input: 'Native CDP touch, 100ms steering, real App/Phaser, accelerated browser clock', realSeconds: Math.round((Date.now() - started) / 1000), errors };
 mkdirSync('docs/playtests', { recursive: true });
 writeFileSync(`docs/playtests/browser-${runTag}-${hero}.json`, JSON.stringify(summary, null, 2));
 const paths = ['warrior', 'archer', 'mage'].map(id => `docs/playtests/browser-${runTag}-${id}.json`);
 const results = paths.filter(existsSync).map(path => JSON.parse(readFileSync(path, 'utf8')));
 writeFileSync(`docs/playtests/browser-${runTag}.json`, JSON.stringify(results, null, 2));
 await page.screenshot({ path: `test-results/${hero}-playtest-end-mobile.png` });
 console.log(JSON.stringify({ hero, elapsed: end.elapsed, hp: end.hp, kills: end.kills, bosses: end.bosses, maxObjects: end.maxObjects, errors }));
 expect(errors).toEqual([]); expect(end.elapsed).toBeGreaterThanOrEqual(300); expect(end.maxEnemies).toBeLessThanOrEqual(100); expect(end.maxShots).toBeLessThanOrEqual(180); expect(end.maxObjects).toBeLessThan(500);
 await context.close();
});
