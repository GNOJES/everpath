import {test,expect}from '@playwright/test';
test('a naturally ended run shows accurate totals and rates, then persists in small-phone history',async({browser})=>{
 const context=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true});const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto('/');
 await page.locator('[data-action="embark"]').click();await page.locator('[data-action="start"]').click();
 for(let i=0;i<100;i++){if(await page.locator('.result-panel').isVisible())break;if(await page.locator('.upgrade-card').count())await page.locator('.upgrade-card').first().click();await page.clock.runFor(5000);}
 await expect(page.locator('.result-panel')).toBeVisible();await expect(page.getByRole('heading',{name:'원정이 종료되었습니다.'})).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('everpath.save.v1')!));expect(saved.history).toHaveLength(1);const r=saved.history[0],c=r.combat;expect(c.spawned).toBe(c.killed+c.missed);expect(c.missed).toBe(c.escaped+c.withdrawn+c.remaining);expect(c.missRate).toBeCloseTo(100*c.missed/c.spawned);expect(c.missed).toBeGreaterThan(0);
 await expect(page.locator('[data-record-killed]')).toContainText(`${c.killed}마리`);await expect(page.locator('[data-record-missed]')).toContainText(`${c.missed}마리 · ${c.missRate.toFixed(1)}%`);
 await page.locator('[data-action="history"]').click();await page.locator('details summary').click();await expect(page.locator('[data-record-spawned]')).toContainText(`${c.spawned}마리`);await page.screenshot({path:'test-results/run-history-small.png'});
 await page.reload();await page.getByRole('button',{name:'설정',exact:true}).click();await page.getByRole('button',{name:'최근 원정 기록',exact:true}).click();await expect(page.locator('details')).toHaveCount(1);await expect(page.locator('details summary')).toContainText(`처치 ${c.killed}`);expect(errors).toEqual([]);await context.close();
});

test('final boss defeat plays on the field before showing and saving the result', async ({ page }) => {
 await page.clock.install();
 // Use the real App entry points with a final-boss fixture in the test page.
 await page.route('**/boss-effect-test', route => route.fulfill({
  contentType: 'text/html',
  body: '<meta name="viewport" content="width=device-width"><div id="app"></div><script type="module">import "/src/style.css"; import {App} from "/src/ui/app.ts"; window.bossTest = new App(document.querySelector("#app"));</script>',
 }));
 await page.setViewportSize({ width: 390, height: 844 });
 await page.goto('/boss-effect-test');
 await page.getByRole('button', { name: '모험 시작' }).click();
 await page.getByRole('button', { name: '숲으로 떠나기' }).click();
 await page.clock.pauseAt(await page.evaluate(() => Date.now() + 250));
 await page.evaluate(() => {
  const { sim } = (window as unknown as { bossTest: { sim: import('../src/game/simulation').GameSimulation } }).bossTest;
  sim.state.elapsed = 599.99;
  sim.update(.033);
  sim.damageEnemy(sim.state.enemies.find(enemy => enemy.kind === 'warden')!, 1e9);
 });
 await page.clock.runFor(300);
 await expect(page.locator('.result-panel')).toHaveCount(0);
 await expect(page.locator('canvas')).toBeVisible();
 expect(await page.evaluate(() => JSON.parse(localStorage.getItem('everpath.save.v1')!).history[0].cleared)).toBe(true);
 await page.screenshot({ path: 'test-results/warden-victory-effect.png' });
 await page.clock.runFor(1000);
 await expect(page.locator('.result-panel')).toContainText('뿌리의 군주를 쓰러뜨렸습니다');
 expect(await page.evaluate(() => JSON.parse(localStorage.getItem('everpath.save.v1')!).history.length)).toBe(1);
});
