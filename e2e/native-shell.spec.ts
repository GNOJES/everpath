import { test, expect } from '@playwright/test';
test('Android back and background callbacks preserve menu and combat state', async ({ page }) => {
 const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
 await page.goto('/e2e/playtest.html?debug&seed=42');
 const back = () => page.evaluate(() => (window as unknown as { __playtest: { nativeBack(): boolean } }).__playtest.nativeBack());
 await expect(page.getByRole('heading', { name: 'EVERPATH', exact: true })).toBeVisible(); expect(await back()).toBe(false);
 await page.getByRole('button', { name: '모험 시작' }).click(); expect(await back()).toBe(true); await expect(page.getByRole('heading', { name: 'EVERPATH', exact: true })).toBeVisible();
 await page.getByRole('button', { name: '영구 강화' }).click(); await back(); await expect(page.getByRole('heading', { name: 'EVERPATH', exact: true })).toBeVisible();
 await page.getByRole('button', { name: '모험 시작' }).click(); await page.getByRole('button', { name: '숲으로 떠나기' }).click();
 await back(); await expect(page.getByRole('heading', { name: '일시정지' })).toBeVisible();
 await page.getByRole('button', { name: '설정', exact: true }).click(); await back(); await expect(page.getByRole('heading', { name: '일시정지' })).toBeVisible();
 await back(); await expect(page.locator('.overlay')).toHaveClass(/inactive/);
 await page.evaluate(() => (window as unknown as { __playtest: { nativePause(): void } }).__playtest.nativePause());
 const time = await page.locator('#hud-time').textContent(); await page.waitForTimeout(1000); await expect(page.locator('#hud-time')).toHaveText(time!);
 await expect(page.getByRole('heading', { name: '일시정지' })).toBeVisible();
 await expect(page.locator('#debug-stats')).toContainText('IDLE'); expect(errors).toEqual([]);
});
