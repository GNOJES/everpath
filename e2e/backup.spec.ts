import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('download, preview, cancel and restore into a fresh installation', async ({ page, browser }) => {
 await page.addInitScript(() => localStorage.setItem('everpath.save.v1', JSON.stringify({
  version: 1, progressionEconomy: 2, gold: 286, invested: 87, upgrades: { attack: 2, speed: 1 },
  history: [{ runId: 'portable', time: 618, kills: 1312, hero: 'mage' }]
 })));
 await page.goto('/');
 await page.getByRole('button', { name: '설정', exact: true }).click();
 const downloading = page.waitForEvent('download');
 await page.getByRole('button', { name: 'JSON 백업 내보내기' }).click();
 const file = await downloading;
 const bytes = await readFile((await file.path())!);
 const expected = JSON.parse(bytes.toString()).save;
 expect(expected.gold).toBe(286);
 expect(expected.upgrades.attack).toBe(2);
 expect(expected.history[0].kills).toBe(1312);

 const dest = await browser.newContext({viewport: {width:390,height:844}});
 try {
  const fresh = await dest.newPage();
  await fresh.goto(page.url());
  await fresh.getByRole('button', { name: '설정', exact: true }).click();
  const select = (buffer: Buffer) => fresh.locator('#backup-file').setInputFiles({name: file.suggestedFilename(), mimeType:'application/json',buffer});
  await select(Buffer.from('{}'));
  await expect(fresh.getByText(/작업을 완료하지 못했습니다/)).toBeVisible();
  await select(bytes);
  await expect(fresh.getByText(/보유 골드 286/)).toBeVisible();
  await fresh.getByRole('button',{name:'취소',exact:true}).click();
  expect(await fresh.evaluate(()=>localStorage.getItem('everpath.save.v1'))).toBeNull();
  await select(bytes);
  await fresh.getByRole('button',{name:'이 백업으로 복원'}).click();
  await expect(fresh.getByText('백업에서 저장 데이터를 복원했습니다.')).toBeVisible();
  await fresh.reload();
  await expect(fresh.getByRole('button',{name:/영구 강화.*286/})).toBeVisible();
  expect(await fresh.evaluate(()=>JSON.parse(localStorage.getItem('everpath.save.v1')!))).toEqual(expected);
 } finally { await dest.close(); }
});
