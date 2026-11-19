import { test, expect, type Page } from '@playwright/test';
const embark = async (page: Page, hero = 'warrior') => { await page.getByRole('button', { name: '모험 시작' }).click(); await page.locator(`[data-hero="${hero}"]`).click(); await page.getByRole('button', { name: '숲으로 떠나기' }).click(); };

test('title, all three heroes, pause, sound and clean restarts', async ({ page }) => {
 const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
 await page.goto('/'); await expect(page.getByRole('heading', { name: 'EVERPATH', exact: true })).toBeVisible();
 await page.screenshot({ path: 'test-results/title-desktop.png' });
 for (const [id, name] of [['warrior', '로완'], ['archer', '린'], ['mage', '엘라']]) {
  await embark(page, id); await expect(page.locator('.hud-hero')).toContainText(name); await expect(page.locator('#hud-time')).toHaveText('00:00');
  await page.keyboard.press('Escape'); await expect(page.getByRole('heading', { name: '일시정지' })).toBeVisible();
  const before = await page.locator('#hud-time').textContent(); await page.waitForTimeout(1200); await expect(page.locator('#hud-time')).toHaveText(before!);
  await page.getByRole('button', { name: '설정', exact: true }).click(); await page.getByLabel('배경음 음량').fill('0'); await page.getByRole('button', { name: '설정 완료' }).click();
  await page.getByRole('button', { name: '모험 계속하기' }).click(); await expect(page.locator('.overlay')).toHaveClass(/inactive/);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: '원정 마치고 타이틀로' }).click();
  await expect(page.getByRole('heading', { name: 'EVERPATH', exact: true })).toBeVisible();
 }
 expect(errors).toEqual([]);
});

test('natural combat, level-up, game over, upgrade purchase and persistence', async ({ page }) => {
 const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
 await page.addInitScript(() => { let seed = 42; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; });
 await page.clock.install(); await page.goto('/'); await embark(page);
 let sawLevel = false;
 for (let i = 0; i < 90; i++) {
  if (await page.locator('.result-panel').isVisible()) break;
  if (await page.locator('.upgrade-card').count()) { sawLevel = true; await page.locator('.upgrade-card').first().click(); }
  await page.clock.runFor(5000);
 }
 expect(sawLevel).toBe(true); await expect(page.locator('.result-panel')).toBeVisible();
 await expect(page.locator('.result-reward strong')).not.toContainText('+0'); await page.screenshot({ path: 'test-results/results-desktop.png' });
 await page.getByRole('button', { name: '성장의 제단으로' }).click(); const walletBefore = await page.locator('.gold-wallet strong').textContent();
 await page.locator('[data-action="buy"][data-id="attack"]').click(); await expect(page.locator('.shop-item').first()).toContainText('+6%');
 const walletAfter = await page.locator('.gold-wallet strong').textContent(); expect(walletAfter).not.toBe(walletBefore);
 await page.reload(); await page.getByRole('button', { name: '영구 강화' }).click(); await expect(page.locator('.shop-item').first()).toContainText('+6%'); await expect(page.locator('.gold-wallet strong')).toHaveText(walletAfter!);
 await page.screenshot({ path: 'test-results/shop-desktop.png' }); expect(errors).toEqual([]);
});

test('mobile native touch, cancellation, resize and UI isolation', async ({ browser }) => {
 const context = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }); const page = await context.newPage();
 const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
 await page.goto('/?debug'); await page.screenshot({ path: 'test-results/title-mobile.png' }); await embark(page, 'archer');
 const frame = await page.locator('.game-frame').boundingBox(); expect(frame!.width).toBe(360); expect(frame!.height).toBeLessThanOrEqual(640);
 const hud = (await page.locator('#hud').boundingBox())!;
 expect(hud.y + hud.height).toBeLessThanOrEqual(frame!.y + 1);
 expect(frame!.y + frame!.height).toBeCloseTo(640, 0);
 expect(await page.locator('.game-frame #hud').count()).toBe(0);
 await page.screenshot({ path: 'test-results/combat-mobile.png' });
 const position = async () => { const text = await page.locator('#debug-stats').textContent(); const match = /POS (\d+),(\d+)/.exec(text!); return { x: Number(match![1]), y: Number(match![2]) }; };
 const session = await context.newCDPSession(page);
 await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 420, id: 1 }] });
 await expect(page.locator('#debug-stats')).toContainText('DRAG'); const start = await position();
 await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 220, y: 380, id: 1 }] });
 await expect.poll(async () => (await position()).x).toBeGreaterThan(start.x + 12); await expect.poll(async () => (await position()).y).toBeLessThan(start.y - 12);
 await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await expect(page.locator('#debug-stats')).toContainText('IDLE');
 const stopped = await position(); await page.waitForTimeout(250); expect(await position()).toEqual(stopped);
 await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 400, id: 2 }] });
 await expect(page.locator('#debug-stats')).toContainText('DRAG');
 await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 400, id: 2 }] });
 await page.waitForTimeout(180); const beforeReverse = await position();
 await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 140, y: 400, id: 2 }] });
 await expect.poll(async () => (await position()).x).toBeLessThan(beforeReverse.x - 5);
 await page.evaluate(() => {
  const trace: unknown[] = []; (window as unknown as { pointerTrace: unknown[] }).pointerTrace = trace;
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, event => { const p = event as PointerEvent; trace.push({ type, id: p.pointerId, primary: p.isPrimary, x: p.clientX }); });
 });
 // A second finger must not steal the primary pointer or keep movement alive after it lifts.
 await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 140, y: 400, id: 2 }, { x: 290, y: 450, id: 3 }] });
 await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 140, y: 400, id: 2 }, { x: 20, y: 450, id: 3 }] });
 await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: 140, y: 400, id: 2 }] });
 const events = await page.evaluate(() => (window as unknown as { pointerTrace: { type: string; primary: boolean }[] }).pointerTrace);
 expect(events.some(event => event.type === 'pointerup' && event.primary)).toBe(true);
 await expect(page.locator('#debug-stats')).toContainText('IDLE');
 const afterPrimaryLift = await position(); await page.waitForTimeout(160); expect(await position()).toEqual(afterPrimaryLift);
 await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
 await page.getByRole('button', { name: '일시정지', exact: true }).click(); await expect(page.getByRole('heading', { name: '일시정지' })).toBeVisible();
 const paused = await position(); await page.getByRole('button', { name: '모험 계속하기' }).click(); expect(await position()).toEqual(paused);
 const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth); expect(overflow).toBe(false);
 await page.setViewportSize({ width: 390, height: 844 }); await expect(page.getByRole('heading', { name: '일시정지' })).toBeVisible();
 await expect(page.locator('#debug-stats')).toContainText('IDLE'); await page.screenshot({ path: 'test-results/pause-mobile.png' });
 await context.close(); expect(errors).toEqual([]);
});

test('small phones keep menu actions inside the portrait and settings persist', async ({ browser }) => {
 const context = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true }); const page = await context.newPage();
 await page.goto('/'); await page.getByRole('button', { name: '모험 시작' }).click(); await page.screenshot({ path: 'test-results/select-small-mobile.png' });
 await page.getByRole('button', { name: '숲으로 떠나기' }).scrollIntoViewIfNeeded(); const button = await page.getByRole('button', { name: '숲으로 떠나기' }).boundingBox(); expect(button!.y + button!.height).toBeLessThanOrEqual(568);
 await page.getByRole('button', { name: '뒤로', exact: true }).click(); await page.getByRole('button', { name: '설정', exact: true }).click();
 await page.getByLabel('배경음 음량').fill('10'); await page.getByLabel('효과음 음량').fill('25'); await page.getByRole('button', { name: '설정 완료' }).click();
 await page.reload(); await page.getByRole('button', { name: '설정', exact: true }).click(); await expect(page.getByLabel('배경음 음량')).toHaveValue('10'); await expect(page.getByLabel('효과음 음량')).toHaveValue('25');
 await context.close();
});

test('mobile screen edge remains usable during a long drag', async ({ browser }) => {
 const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const page = await context.newPage();
 await page.goto('/?debug'); await embark(page);
 const touch = await context.newCDPSession(page), rect = (await page.locator('canvas').boundingBox())!;
 const y = rect.y + rect.height * .72;
 await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 220, y, id: 1 }] });
 await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 50, y, id: 1 }] });
 await expect(page.locator('#debug-stats')).toContainText('POS 22,515');
 await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
 await page.screenshot({ path: `docs/playtests/mobile-edge-${process.env.EDGE_CAPTURE ?? 'after'}.png` });
 await context.close();
});
