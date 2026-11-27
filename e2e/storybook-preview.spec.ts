import { expect, test } from '@playwright/test';

test('local storybook preview uses new art and shares the existing save', async ({ page }, testInfo) => {
 await page.setViewportSize({ width: 360, height: 640 });
 await page.addInitScript(() => {
  if (sessionStorage.getItem('storybookSaveSeeded')) return;
  localStorage.setItem('everpath.save.v1', JSON.stringify({
   version: 1, progressionEconomy: 2, gold: 375, upgrades: { attack: 2 },
  }));
  sessionStorage.setItem('storybookSaveSeeded', 'yes');
 });
 const portraits = async (url: string) => {
  await page.goto(url);
  await page.getByRole('button', { name: '모험 시작' }).click();
  await page.locator('.game-frame').screenshot({path: testInfo.outputPath((new URL(url, 'http://preview.invalid').searchParams.get('art') ?? 'original') + '-heroes.png')});
  return page.locator('.hero-card img').evaluateAll(async elements => {
   const images = elements as HTMLImageElement[];
   await Promise.all(images.map(image => image.decode()));
   return images.map(image => image.src);
  });
 };
 const original = await portraits('/?art=original');
 const storybook = await portraits('/?art=storybook');
 expect(original).toHaveLength(3);
 expect(storybook).toHaveLength(3);
 expect(await portraits('/?art=storybook-cc0')).toEqual(storybook);
 for (const pack of ['puny', 'ninja', 'mini']) {
  const assets = await portraits('/?art=' + pack);
  expect(assets).toHaveLength(3);
  expect(new Set(assets).size).toBe(3);
  assets.forEach((source, index) => expect(source).not.toBe(storybook[index]));
  if (pack === 'mini') expect(await portraits('/')).toEqual(assets);
 }
 storybook.forEach((source, index) => expect(source).not.toBe(original[index]));
 await page.goto('/?art=storybook');
 await page.getByRole('button', { name: /영구 강화/ }).click();
 await expect(page.locator('[aria-label="보유 골드"]')).toContainText('375');
 await expect(page.locator('[data-permanent="attack"] [role="meter"]')).toHaveAttribute('aria-valuenow', '2');
});

test('first Grorm and chest keep the same encounter and reward across all art modes', async ({ page }, testInfo) => {
 await page.setViewportSize({ width: 360, height: 640 });
 await page.route('**/storybook-check*', route => route.fulfill({
  contentType: 'text/html',
  body: '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="app"></div><script type="module">import "/src/style.css"; import {App} from "/src/ui/app.ts"; window.storybookFixture = new App(document.querySelector("#app"));</script>',
 }));
 const runs = [];
 for (const mode of ['original', 'storybook', 'storybook-cc0', 'puny', 'ninja', 'mini']) {
  await page.goto('/storybook-check?art=' + mode);
  await page.getByRole('button', { name: '모험 시작' }).click();
  await page.getByRole('button', { name: '숲으로 떠나기' }).click();
  // Freeze only the browser fixture so both screenshots use identical encounter state.
  const assets = await page.evaluate(() => {
   const context = window as unknown as {
    storybookFixture: {sim: import('../src/game/simulation').GameSimulation; scene: import('../src/game/scene').ForestScene};
    stepStorybookFixture: (seconds: number) => void;
    storybookCues: [string, boolean | undefined][];
   };
   const { sim, scene } = context.storybookFixture;
   context.stepStorybookFixture = sim.update.bind(sim);
   sim.update = () => {};
   context.storybookCues = [];
   const playCue = scene.audio.playCue.bind(scene.audio);
   scene.audio.playCue = (cue, preview) => {
    context.storybookCues.push([cue, preview]);
    playCue(cue, preview);
   };
   sim.state.enemies = [];
   sim.state.elapsed = 119.99;
   context.stepStorybookFixture(.02);
   const grorm = sim.state.enemies.find(enemy => enemy.middleWave === 120)!;
   sim.state.enemies = [grorm];
   grorm.entryTarget = undefined;
   grorm.y = 320;
   grorm.phase = 'warn';
   grorm.aim = {x:0, y:1};
   sim.state.player.y = 530;
   sim.state.effects = [];
   const props = scene.children.list.flatMap(child => {
    const texture = (child as { texture?: { key: string } }).texture?.key;
    return texture?.startsWith('kenney-') ? [texture] : [];
   });
   return { props, packTerrain: scene.textures.exists('pack-terrain') };
  });
  expect([...new Set(assets.props)].sort()).toEqual(mode === 'storybook-cc0'
   ? ['kenney-blossoms', 'kenney-shrub', 'kenney-sprout'] : []);
  expect(assets.packTerrain).toBe(['puny', 'ninja', 'mini'].includes(mode));
  await page.locator('.game-frame').screenshot({ path: testInfo.outputPath(mode + '-grorm.png') });
  const result = await page.evaluate(() => {
   const context = window as unknown as {
    storybookFixture: {sim: import('../src/game/simulation').GameSimulation};
    stepStorybookFixture: (seconds: number) => void;
    storybookCues: [string, boolean | undefined][];
   };
   const sim = context.storybookFixture.sim;
   const grorm = sim.state.enemies.find(enemy => enemy.middleWave === 120)!;
   const hp = grorm.maxHp;
   sim.damageEnemy(grorm, hp, 0);
   const awardedBeforePickup = sim.state.gold;
   while (sim.state.choices.length) sim.chooseUpgrade(sim.state.choices[0].id);
   const chest = sim.state.pickups.find(pickup => pickup.kind === 'chest')!;
   sim.state.player.x = chest.x;
   sim.state.player.y = chest.groundY + sim.state.scroll;
   context.stepStorybookFixture(.02);
   return { hp, awardedBeforePickup, awarded: sim.state.gold, cues: context.storybookCues };
  });
  expect(result.awardedBeforePickup).toBe(0);
  expect(result.awarded).toBe(150);
  expect(result.cues).toContainEqual(['grormDefeat', mode !== 'original']);
  expect(result.cues).toContainEqual(['chestPickup', mode !== 'original']);
  runs.push(result.hp);
 }
 expect(new Set(runs).size).toBe(1);
});

test('CC0 button plays the downloaded sample', async ({ page }) => {
 const sampleStarts = () => (window as unknown as { cc0SampleStarts: number }).cc0SampleStarts;
 await page.addInitScript(() => {
  const probe = window as unknown as { cc0SampleStarts: number };
  probe.cc0SampleStarts = 0;
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
   if (this.buffer && this.buffer.duration < .3) probe.cc0SampleStarts++;
   return start.apply(this, args);
  };
 });
 const downloads: string[] = [];
 page.on('request', request => {
  if (request.resourceType() === 'fetch' && request.url().includes('/click-001.mp3')) downloads.push(request.url());
 });
 await page.goto('/?art=storybook');
 await page.getByRole('button', { name: '모험 시작' }).click();
 expect(await page.evaluate(sampleStarts)).toBe(0);
 expect(downloads).toHaveLength(0);

 await page.goto('/?art=storybook-cc0');
 await page.getByRole('button', { name: '모험 시작' }).click();
 await expect.poll(() => page.evaluate(sampleStarts)).toBe(1);
 expect(downloads).toHaveLength(1);
});

test('Mini World uses directional walk and strike sprites for all heroes', async ({ page }) => {
 await page.setViewportSize({width:320,height:568});
 await page.route('**/mini-motion-check*', route => route.fulfill({
  contentType:'text/html',
  body:'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="app"></div><script type="module">import "/src/style.css";import {App} from "/src/ui/app.ts";window.miniMotionFixture=new App(document.querySelector("#app"));</script>',
 }));
 const expectMenuFits = async () => {
  const menu = page.locator('.menu-panel');
  await expect(menu).toBeVisible();
  expect(await menu.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
 };
 await page.goto('/mini-motion-check');
 await page.locator('[data-action="shop"]').first().click();
 await expectMenuFits();
 await page.goto('/mini-motion-check');
 await page.locator('.settings-button').click();
 await expectMenuFits();
 for (const hero of ['warrior','archer','mage']) {
  await page.goto('/mini-motion-check');
  await expect(page.locator('#app')).toHaveClass(/mini-world/);
  await page.getByRole('button',{name:'모험 시작'}).click();
  await page.locator('[data-hero="' + hero + '"]').click();
  await expectMenuFits();
  await page.getByRole('button',{name:'숲으로 떠나기'}).click();
  const resetEnemies = (spawn: boolean) => page.evaluate(spawn => {
   const {sim} = (window as unknown as {
    miniMotionFixture: { sim: import('../src/game/simulation').GameSimulation };
   }).miniMotionFixture;
   sim.state.enemies = [];
   if (spawn) sim.spawnEnemy('slime',sim.state.player.x + 38,sim.state.player.y);
  }, spawn);
  await resetEnemies(false);
  const state = () => page.evaluate(() => {
   const mini = (window as unknown as {
    miniMotionFixture: { scene: { hero: import('phaser').GameObjects.Image } };
   }).miniMotionFixture;
   const image = mini.scene.hero;
   return { texture:image.texture.key, frame:Number(image.frame.name), facing:Math.sign(image.scaleX) };
  });
  await page.keyboard.down('ArrowLeft');
  try {
   await expect.poll(async () => {
    const image = await state();
    return image.texture === 'mini-motion-' + hero && image.facing === -1 && image.frame < 4;
   }).toBe(true);
  } finally { await page.keyboard.up('ArrowLeft'); }
  for (const [key, firstFrame] of [['ArrowDown',7],['ArrowUp',14]] as const) {
   await page.keyboard.down(key);
   try {
    await expect.poll(async () => {
     const image = await state();
     return image.texture === 'mini-motion-' + hero && image.frame >= firstFrame && image.frame < firstFrame + 4;
    }).toBe(true);
   } finally { await page.keyboard.up(key); }
  }
  await expect.poll(async () => (await state()).texture).toBe('field-' + hero);
  await resetEnemies(true);
  await expect.poll(async () => {
   const image = await state();
   return image.texture === 'mini-motion-' + hero && image.frame >= 4 && image.frame <= 6 && image.facing === 1;
  },{intervals:[15,25,40,50],timeout:3000}).toBe(true);
 }
});

test('Mini World enemy preview follows the existing attack and freeze states', async ({ page }) => {
 await page.setViewportSize({ width: 360, height: 640 });
 await page.route('**/mini-enemies-check*', route => route.fulfill({
  contentType: 'text/html',
  body: '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="app"></div><script type="module">import "/src/style.css"; import {App} from "/src/ui/app.ts"; window.enemyArtFixture = new App(document.querySelector("#app"));</script>',
 }));
 await page.goto('/mini-enemies-check');
 await page.getByRole('button', { name: '모험 시작' }).click();
 await page.getByRole('button', { name: '숲으로 떠나기' }).click();
 await page.evaluate(() => {
  type Fixture = {
   sim: import('../src/game/simulation').GameSimulation;
   scene: import('../src/game/scene').ForestScene;
  };
  const browser = window as unknown as {
   enemyArtFixture: Fixture;
   resetEnemy: (kind: import('../src/game/types').EnemyKind, attack: number, timer: number) => void;
   observeEnemy: () => { frame: number; phase?: string; marks: string[]; projectileCount: number };
  };
  const {sim, scene} = browser.enemyArtFixture;
  const s = sim.state;
  const observe = sim.update.bind(sim);
  let target: import('../src/game/types').Enemy | undefined;
  sim.update = (dt, direction) => {
   observe(dt, direction);
   s.enemies = target ? s.enemies.filter(enemy => enemy === target) : [];
  };
  browser.resetEnemy = (kind, attack, timer) => {
   s.enemies = []; s.hazards = []; s.projectiles = [];
   s.player.x = 216; s.player.y = 515; s.timeStopRemaining = 0;
   target = sim.spawnEnemy(kind, 216, 220)!;
   target.timer = timer;
   target.wardenAttack = attack;
  };
  browser.observeEnemy = () => {
   const image = scene.children.list.find(child => {
    const sprite = child as Phaser.GameObjects.Image;
    return sprite.texture?.key === 'mini-enemy-motion' && sprite.visible && sprite.y > 0;
   }) as Phaser.GameObjects.Image | undefined;
   return {
    frame: Number(image?.frame.name), phase: target?.phase,
    marks: s.hazards.filter(hazard => !hazard.fired).map(hazard => hazard.impactSound ?? 'slam'),
    projectileCount: s.projectiles.filter(shot => shot.kind === 'enemy').length,
   };
  };
 });
 const setup = (kind: import('../src/game/types').EnemyKind, attack = 0, timer = .1) =>
  page.evaluate(([kind, attack, timer]) => (window as unknown as {
   resetEnemy: (kind: import('../src/game/types').EnemyKind, attack: number, timer: number) => void;
  }).resetEnemy(kind, attack, timer), [kind, attack, timer] as const);
 const observe = () => page.evaluate(() => (window as unknown as {
  observeEnemy: () => { frame: number; phase?: string; marks: string[]; projectileCount: number };
 }).observeEnemy());
 const fresh = { intervals: [20, 30, 40], timeout: 3200 };
 await setup('skeleton', 0, .35);
 await expect.poll(async () => Math.floor((await observe()).frame / 21), fresh).toBe(3);
 await expect.poll(async () => {
  const {frame, projectileCount} = await observe();
  return frame % 7 >= 4 && projectileCount === 1;
 }, fresh).toBe(true);
 const skeletonShotTexture = await page.evaluate(() => {
  const { scene } = (window as unknown as { enemyArtFixture: { scene: import('phaser').Scene } }).enemyArtFixture;
  const arrow = scene.children.list.find(child => (child as Phaser.GameObjects.Image).visible && (child as Phaser.GameObjects.Image).texture?.key === 'enemy-arrow') as Phaser.GameObjects.Image | undefined;
  return arrow ? { key: arrow.texture.key, depth: arrow.depth } : null;
 });
 expect(skeletonShotTexture).toEqual({ key: 'enemy-arrow', depth: 1600 });

 const layerDepths = await page.evaluate(() => {
  const { scene } = (window as unknown as { enemyArtFixture: { scene: { groundFx: Phaser.GameObjects.Graphics; hazardFx: Phaser.GameObjects.Graphics; fx: Phaser.GameObjects.Graphics; hero: Phaser.GameObjects.Image } } }).enemyArtFixture;
  return { groundFx: scene.groundFx?.depth, hazardFx: scene.hazardFx?.depth, fx: scene.fx?.depth, hero: scene.hero?.depth };
 });
 expect(layerDepths.groundFx).toBeLessThan(layerDepths.hazardFx);
 expect(layerDepths.hazardFx).toBeLessThan(layerDepths.hero);
 expect(layerDepths.hero).toBeLessThan(layerDepths.fx);

 await setup('boss');
 await expect.poll(async () => (await observe()).phase, fresh).toBe('warn');
 await expect.poll(async () => (await observe()).phase, fresh).toBe('dash');
 await expect.poll(async () => (await observe()).marks, fresh).toEqual(['grormSlam']);
 await setup('briar');
 await expect.poll(async () => (await observe()).marks, fresh).toEqual(['briarImpact', 'briarImpact']);
 await setup('warden');
 await expect.poll(async () => (await observe()).marks, fresh).toEqual(['wardenSlam', 'wardenSlam']);
 await setup('warden', 1);
 await expect.poll(async () => (await observe()).phase, fresh).toBe('warn');
 await expect.poll(async () => (await observe()).projectileCount, fresh).toBe(5);
 await setup('warden', 2);
 await expect.poll(async () => (await observe()).projectileCount, fresh).toBe(10);
 const wardenThorn = await page.evaluate(() => {
  const { scene } = (window as unknown as { enemyArtFixture: { scene: import('phaser').Scene } }).enemyArtFixture;
  const thorn = scene.children.list.find(child => (child as Phaser.GameObjects.Image).visible && (child as Phaser.GameObjects.Image).texture?.key === 'warden-thorn') as Phaser.GameObjects.Image | undefined;
  return thorn ? { key: thorn.texture.key, depth: thorn.depth } : null;
 });
 expect(wardenThorn).toEqual({ key: 'warden-thorn', depth: 1600 });

 await setup('shaman', 0, .05);
 await expect.poll(async () => (await observe()).marks, fresh).toEqual(['shamanImpact']);

 await setup('boss', 0, .05);
 await expect.poll(async () => (await observe()).projectileCount, fresh).toBe(3);
 const grormOrb = await page.evaluate(() => {
  const { scene } = (window as unknown as { enemyArtFixture: { scene: import('phaser').Scene } }).enemyArtFixture;
  const orb = scene.children.list.find(child => (child as Phaser.GameObjects.Image).visible && (child as Phaser.GameObjects.Image).texture?.key === 'grorm-orb') as Phaser.GameObjects.Image | undefined;
  return orb ? { key: orb.texture.key, depth: orb.depth } : null;
 });
 expect(grormOrb).toEqual({ key: 'grorm-orb', depth: 1600 });

 await setup('bat', 0, 2);
 await expect.poll(async () => Math.floor((await observe()).frame / 21), fresh).toBe(2);
 await page.evaluate(() => {
  const { sim } = (window as unknown as { enemyArtFixture: { sim: import('../src/game/simulation').GameSimulation } }).enemyArtFixture;
  sim.state.timeStopRemaining = 1;
 });
 const frozen = (await observe()).frame;
 await page.waitForTimeout(210);
 expect((await observe()).frame).toBe(frozen);
});

test('Mini World polish shows compact menus and a temporary guide on a small touch screen', async ({ browser }) => {
 const context = await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true});
 try {
  const page = await context.newPage();
  await page.route('**/mini-guide-check*', route => route.fulfill({
   contentType:'text/html',
   body:'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="app"></div><script type="module">import "/src/style.css"; import {App} from "/src/ui/app.ts"; window.guideFixture = new App(document.querySelector("#app"));</script>',
  }));
  await page.goto('/mini-guide-check');
  await expect(page.locator('.title-objective')).toContainText('10분에 등장하는 모르바');
  const noScroll = async () => {
   expect(await page.locator('.menu-panel').evaluate(panel => panel.scrollHeight - panel.clientHeight)).toBeLessThanOrEqual(1);
   expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(568);
  };
  await page.getByRole('button', {name:'설정',exact:true}).tap();
  await expect(page.getByRole('heading',{name:'소리와 저장'})).toBeVisible();
  await noScroll();
  await page.getByRole('button',{name:'설정 완료'}).tap();
  await page.getByRole('button',{name:'모험 시작'}).tap();
  await page.locator('[data-hero="mage"]').tap();
  await expect(page.locator('.hero-detail > p')).toContainText('냉기 오라');
  await noScroll();
  await page.getByText('스킬과 무기 진화',{exact:true}).tap();
  await expect(page.getByText('집중 낙뢰',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'숲으로 떠나기'}).tap();
  await expect(page.locator('.first-steps')).toContainText('화면을 끌어서 이동');
  await page.evaluate(() => {
   const { sim } = (window as unknown as { guideFixture: { sim: import('../src/game/simulation').GameSimulation } }).guideFixture;
   sim.state.elapsed = 7;
  });
  await expect(page.locator('.first-steps')).toHaveCount(0);
 } finally { await context.close(); }
});
