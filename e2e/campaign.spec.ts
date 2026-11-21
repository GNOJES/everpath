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
 await expect(page.locator('#campaign-goal')).toBeHidden();await expect(page.locator('#hud')).toBeVisible();
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
  const shopPortrait = await page.locator('.shop-hero img').evaluate(async (image: HTMLImageElement) => {
   await image.decode();
   return { src: image.src, height: image.naturalHeight };
  });
  expect(shopPortrait.height).toBe(22);
  await noScroll();
  await page.locator('[data-action="buy"][data-id="attack"]').tap();
  await expect(page.locator('.gold-wallet strong')).toHaveText('76');
  const attack = page.locator('.shop-item').filter({has:page.locator('[data-action=buy][data-id=attack]')});
  await expect(attack.locator('.shop-rank strong')).toHaveText('1');
  await expect(attack.locator('.shop-bonus')).toHaveText('+6%');
  await expect(attack.getByRole('meter')).toHaveAttribute('aria-valuenow', '1');
  await noScroll();
  await page.screenshot({path:'test-results/shop-ranks-mobile.png'});
  await page.getByRole('button', {name:'공격력 한 단계 낮추기 · 24 골드 환불'}).tap();
  await expect(page.locator('.gold-wallet strong')).toHaveText('100');
  await expect(page.locator('[data-action="downgrade"][data-id="attack"]')).toBeDisabled();
  await page.getByRole('button', {name:'원정 준비로 돌아가기'}).tap();
  await page.getByRole('button', {name:'모험 시작'}).tap();
  await expect(page.locator('[data-hero="warrior"] img')).toHaveAttribute('src', shopPortrait.src);
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

test('skill upgrades fit a short phone and remain legible while pressed', async ({ page }) => {
 await page.setViewportSize({width:320,height:480});
 await page.route('**/skill-choice-test', route => route.fulfill({
  contentType:'text/html',
  body:'<meta name="viewport" content="width=device-width"><div id="app"></div><script type="module">import "/src/style.css"; import {App} from "/src/ui/app.ts"; window.skillTest = new App(document.querySelector("#app"));</script>',
 }));
 await page.goto('/skill-choice-test');
 await page.getByRole('button', {name:'모험 시작'}).click();
 const portraits = await page.locator('.hero-card img').evaluateAll(async elements => {
  const images = elements as HTMLImageElement[];
  await Promise.all(images.map(image => image.decode()));
  return images.map(image => ({src:image.src, height:image.naturalHeight}));
 });
 expect(new Set(portraits.map(portrait => portrait.src)).size).toBe(3);
 expect(portraits.map(portrait => portrait.height)).toEqual([22, 22, 22]);
 await page.getByRole('button', {name:'숲으로 떠나기'}).click();
 await page.evaluate(async () => {
  const {sim} = (window as unknown as {skillTest:{sim:import('../src/game/simulation').GameSimulation}}).skillTest;
  const {availableUpgrades} = await import('../src/game/progression');
  sim.state.skills.shield = 1;
  sim.state.skills.bash = 1;
  sim.state.choices = availableUpgrades(sim.state).filter(choice => ['skill:whirl','skill:shield','passive:vitality'].includes(choice.id));
  sim.state.status = 'upgrade';
 });
 const panel = page.locator('.upgrade-panel');
 await expect(panel.locator('.upgrade-card')).toHaveCount(3);
 await expect(panel.locator('.upgrade-heading img')).toHaveAttribute('src', portraits[0].src);
 const whirl = panel.locator('[data-id="skill:whirl"]');
 await expect(whirl.locator('.upgrade-badge')).toHaveText('새 습득');
 await expect(whirl.locator('.upgrade-transition')).toHaveText('Lv.1');
 const shield = panel.locator('[data-id="skill:shield"]');
 await expect(shield.locator('.upgrade-badge')).toHaveText('보유 강화');
 await expect(shield.locator('.upgrade-transition')).toHaveText('1 → 2');
 const size = await panel.evaluate(el => ({
  panel:el.scrollHeight - el.clientHeight,
  page:document.documentElement.scrollHeight - innerHeight,
 }));
 expect(size.panel).toBeLessThanOrEqual(1);
 expect(size.page).toBeLessThanOrEqual(1);
 const bounds = (await shield.boundingBox())!;
 await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
 await page.mouse.down();
 try {
  const palette = await shield.evaluate(button => ({
   background:getComputedStyle(button).backgroundColor,
   title:getComputedStyle(button.querySelector('.upgrade-name')!).color,
   description:getComputedStyle(button.querySelector('.upgrade-description')!).color,
  }));
  const luminance = (color: string) => {
   const values = color.match(/[\d.]+/g)!.slice(0,3).map(value => Number(value) / 255);
   return values.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126,.7152,.0722][index],0);
  };
  for (const text of [palette.title,palette.description]) {
   const values = [luminance(text),luminance(palette.background)].sort((a,b) => a-b);
   expect((values[1] + .05) / (values[0] + .05)).toBeGreaterThanOrEqual(4.5);
  }
  await page.screenshot({path:'test-results/skill-upgrade-pressed-small.png'});
 } finally { await page.mouse.up(); }
 await page.getByRole('button', {name:'일시정지',exact:true}).click();
 await expect(page.getByRole('heading', {name:'습득한 스킬'})).toBeVisible();
 await expect(page.locator('.pause-skills')).toContainText('방패 밀치기');
 await expect(page.locator('.pause-skills')).toContainText('수호의 방패');
 await expect(page.locator('#hud .loadout')).toHaveCount(0);
 expect(await page.locator('.pause-panel').evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);
});
