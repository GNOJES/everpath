import { test,expect } from '@playwright/test';
test('growth refund requires confirmation, preserves records, persists and can be rebuilt on a small phone',async({browser})=>{
 const context=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true});const page=await context.newPage();
 // Menu transaction fixture, not a balance/playtime trial.
 await page.addInitScript(()=>{if(!localStorage.getItem('campaign.fixture')){localStorage.setItem('everpath.save.v1',JSON.stringify({version:1,gold:1000,bestTime:123,upgrades:{attack:2,hp:1,speed:0,gold:0},settledRuns:['preserve-me']}));localStorage.setItem('campaign.fixture','true');}});
 await page.goto('/');await page.locator('[data-action="shop"]').click();const before=await page.locator('.gold-wallet strong').textContent();
 await page.locator('[data-action="refund-preview"]').click();await expect(page.locator('[data-action="refund-confirm"]')).toContainText('43 골드');
 await page.locator('[data-action="refund-cancel"]').click();await expect(page.locator('.gold-wallet strong')).toHaveText(before!);
 await page.locator('[data-action="refund-preview"]').click();await page.locator('[data-action="refund-confirm"]').click();await expect(page.locator('.gold-wallet strong')).toContainText('1,043');
 await expect(page.locator('[data-action="refund-preview"]')).toBeDisabled();await page.locator('[data-action="buy"][data-id="attack"]').click();await expect(page.locator('.shop-item').first()).toContainText('+6%');
 await page.reload();await page.locator('[data-action="shop"]').click();await expect(page.locator('.gold-wallet strong')).toContainText('1,019');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('everpath.save.v1')!));expect(saved.bestTime).toBe(123);expect(saved.settledRuns).toContain('preserve-me');expect(saved.invested).toBe(24);
 await page.locator('[data-action="buy"][data-id="gold"]').click();await expect(page.locator('.shop-item').last()).toContainText('+2.5%');
 await page.screenshot({path:'test-results/campaign-refund-small.png'});await context.close();
});
test('first objective and locked challenges are visible before a normal run',async({page})=>{
 await page.goto('/');await page.locator('[data-action="embark"]').click();await expect(page.locator('.hero-clear-record')).toContainText('무기 진화');await expect(page.locator('[data-rank="1"]')).toBeDisabled();await page.locator('[data-action="start"]').click();
 await expect(page.locator('#campaign-goal')).toContainText('10:00 모르바');await expect(page.locator('#hud')).toBeVisible();
});
