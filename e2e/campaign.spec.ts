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
 await page.locator('[data-action="buy"][data-id="gold"]').click();await expect(page.locator('.shop-item').filter({has:page.locator('[data-action=buy][data-id=gold]')})).toContainText('+2.5%');
 await page.screenshot({path:'test-results/campaign-refund-small.png'});await context.close();
});
test('first objective and locked challenges are visible before a normal run',async({page})=>{
 await page.goto('/');await page.locator('[data-action="embark"]').click();await expect(page.locator('.hero-clear-record')).toContainText('무기 진화');await expect(page.locator('[data-rank="1"]')).toBeDisabled();await page.locator('[data-action="start"]').click();
 await expect(page.locator('#campaign-goal')).toContainText('10:00 모르바');await expect(page.locator('#hud')).toBeVisible();
});

test('common menus fit one small screen and refund buttons work without a reset', async ({ browser }) => {
 const context = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
 try {
  const page = await context.newPage();
  const noScroll = async () => {
   const overflow = await page.locator('.menu-panel').evaluate(panel => ({
    panel: panel.scrollHeight - panel.clientHeight,
    page: document.documentElement.scrollHeight - innerHeight,
   }));
   expect(overflow.panel).toBeLessThanOrEqual(1);
   expect(overflow.page).toBeLessThanOrEqual(1);
  };
  await page.addInitScript(() => localStorage.setItem('everpath.save.v1', JSON.stringify({ version:1, progressionEconomy:2, gold:100 })));
  await page.goto('/');
  await page.getByRole('button', {name:'설정', exact:true}).tap();
  await noScroll();
  await page.getByRole('button', {name:'설정 완료'}).tap();
  await page.getByRole('button', {name:'영구 강화'}).tap();
  await noScroll();
  await page.locator('[data-action="buy"][data-id="attack"]').tap();
  await expect(page.locator('.gold-wallet strong')).toHaveText('76');
  await page.getByRole('button', {name:'공격력 한 단계 낮추기 · 24 골드 환불'}).tap();
  await expect(page.locator('.gold-wallet strong')).toHaveText('100');
  await expect(page.locator('[data-action="downgrade"][data-id="attack"]')).toBeDisabled();
  await page.getByRole('button', {name:'원정 준비로 돌아가기'}).tap();
  await page.getByRole('button', {name:'모험 시작'}).tap();
  for (const hero of ['warrior', 'archer', 'mage']) {
   await page.locator(`[data-hero="${hero}"]`).tap();
   await noScroll();
  }
 } finally { await context.close(); }
});

test('buys three watch charges and uses a touch charge that refills next run', async ({ browser }) => {
 const context = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
 try {
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('everpath.save.v1', JSON.stringify({version:1, progressionEconomy:2, gold:1100})));
  await page.goto('/');
  const watch = page.locator('.time-stop-button');
  const frozen = page.locator('#time-stop-fx');
  const start = async () => {
   await page.getByRole('button', {name:'모험 시작'}).tap();
   await page.getByRole('button', {name:'숲으로 떠나기'}).tap();
  };
  const returnToTitle = async () => {
   await page.getByRole('button', {name:'일시정지', exact:true}).tap();
   await page.getByRole('button', {name:'원정 마치고 타이틀로'}).tap();
  };
  await start();
  await expect(watch).toHaveText('0');
  await expect(watch).toBeDisabled();
  await returnToTitle();
  await page.getByRole('button', {name:'영구 강화'}).tap();
  const buy = page.locator('[data-action="buy"][data-id="timeStop"]');
  for (let i = 0; i < 3; i++) await buy.tap();
  await expect(buy).toBeDisabled();
  await expect(page.locator('.gold-wallet strong')).toHaveText('100');
  await page.getByRole('button', {name:'원정 준비로 돌아가기'}).tap();
  await start();
  await expect(watch).toHaveText('3');
  await watch.tap();
  await expect(frozen).toBeVisible();
  await expect(watch).toHaveText('2');
  await expect(watch).toBeDisabled();
  await expect(frozen).toBeHidden();
  await expect(watch).toBeEnabled();
  await returnToTitle();
  await start();
  await expect(watch).toHaveText('3');
 } finally { await context.close(); }
});
