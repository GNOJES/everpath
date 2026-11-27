import {test,expect} from '@playwright/test';
test('production audio renders finite audible PCM, mutes live channels and bounds dense peaks',async({page})=>{
 await page.goto('/');
 const results=await page.evaluate(async()=>{
  // Real Web Audio DSP offline; software signal validation, not a speaker listening test.
  const {GameAudio}=await import('/src/game/audio.ts' as string);const Original=window.AudioContext;const results=[];
  try{for(const mute of [false,true]){
   const offline=new OfflineAudioContext(1,44100*3,44100);
   (window as any).AudioContext=class{state='running';currentTime=0;sampleRate=offline.sampleRate;destination=offline.destination;createBuffer=offline.createBuffer.bind(offline);createBufferSource=()=>offline.createBufferSource();createBiquadFilter=()=>offline.createBiquadFilter();createGain=()=>offline.createGain();createOscillator=()=>offline.createOscillator();createDynamicsCompressor=()=>offline.createDynamicsCompressor();resume=()=>Promise.resolve();suspend=()=>Promise.resolve();};
   const a=new GameAudio();a.music=1;a.sfx=1;a.unlock();a.syncMusic('running');a.click();a.hurt();a.boss();a.levelUp();a.attack('mage');a.playCue('whirl');a.playCue('wardenFan');if(mute){a.music=0;a.sfx=0;}
   const samples=(await offline.startRendering()).getChannelData(0);let peak=0,energy=0,count=0;for(let i=4410;i<samples.length;i++){if(!Number.isFinite(samples[i]))throw new Error('Nonfinite PCM');peak=Math.max(peak,Math.abs(samples[i]));energy+=samples[i]*samples[i];count++;}results.push({mute,peak,rms:Math.sqrt(energy/count)});
  }}finally{window.AudioContext=Original;}return results;
 });
 expect(results[0].rms).toBeGreaterThan(.001);expect(results[0].peak).toBeLessThan(1);expect(results[1].rms).toBeLessThan(.0001);
});
test('audio survives native suspension and resumes only on user gesture',async({page})=>{
 await page.addInitScript(() => {
  const Original = window.AudioContext;
  const probe = window as unknown as { contexts: AudioContext[]; soundtrack: { duration: number; channels: number; offset: number; loop: boolean; startedAt: number }[] };
  probe.contexts = [];
  probe.soundtrack = [];
  window.AudioContext = class extends Original {
   constructor(options?: AudioContextOptions) { super(options); probe.contexts.push(this); }
   createBufferSource() {
    const source = super.createBufferSource();
    const start = source.start.bind(source);
    source.start = (when, offset, duration) => {
     if (source.loop && source.buffer) {
      probe.soundtrack.push({ duration: source.buffer.duration, channels: source.buffer.numberOfChannels, offset: offset ?? 0, loop: true, startedAt: this.currentTime });
     }
     start(when, offset, duration);
    };
    return source;
   }
  };
 });
 const preload = page.waitForResponse(response => response.url().endsWith('/audio/everpath-mini-battle.m4a') && response.ok());
 await page.goto('/e2e/playtest.html');
 const battleTrack = await preload;
 await battleTrack.finished();
 expect(await page.evaluate(() => (window as unknown as { contexts: AudioContext[] }).contexts.length)).toBe(0);
 await page.locator('[data-action="embark"]').click();await page.locator('[data-action="start"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as unknown as { contexts:AudioContext[] }).contexts[0]?.state)).toBe('running');
 const music = () => page.evaluate(() => (window as unknown as { soundtrack: { offset: number; channels: number; duration: number; loop: boolean }[] }).soundtrack);
 await expect.poll(async () => (await music()).length).toBe(1);
 expect((await music())[0]).toMatchObject({ offset: 0, channels: 2, loop: true });
 expect((await music())[0].duration).toBeGreaterThan(50);
 await expect.poll(() => page.evaluate(() => {
  const probe = window as unknown as { contexts: AudioContext[]; soundtrack: { startedAt: number }[] };
  return probe.contexts[0].currentTime - probe.soundtrack[0].startedAt;
 })).toBeGreaterThan(.025);
 await page.evaluate(()=>(window as any).__playtest.nativePause());await expect.poll(()=>page.evaluate(()=>(window as unknown as { contexts:AudioContext[] }).contexts[0]?.state)).toBe('suspended');
 await page.locator('[data-action="resume"]').click();await expect.poll(()=>page.evaluate(()=>(window as unknown as { contexts:AudioContext[] }).contexts[0]?.state)).toBe('running');
 await expect.poll(async () => (await music()).length).toBe(2);
 expect((await music())[1].offset).toBeGreaterThan(0);
 await page.locator('[data-action="pause"]').click();
 await page.locator('[data-action="title"]').click();
 await page.locator('[data-action="embark"]').click();
 await page.locator('[data-action="start"]').click();
 await expect.poll(async () => (await music()).length).toBe(3);
 expect((await music())[2].offset).toBe(0);
});

for (const mini of [false, true]) test(`music pauses on pause and background and plays at 30% during upgrades (${mini ? 'Mini World' : 'classic'})`, async ({ page }) => {
 await page.route('**/music-menu-test*', route => route.fulfill({
  contentType:'text/html',
  body:'<meta name="viewport" content="width=device-width"><div id="app"></div><script type="module">import "/src/style.css"; import {App} from "/src/ui/app.ts"; window.musicTest = new App(document.querySelector("#app"));</script>',
 }));
 const prefix = mini ? 'everpath-mini-' : 'everpath-';
 const warden = page.waitForResponse(response => response.url().endsWith('/audio/' + prefix + 'warden.m4a') && response.ok());
 const battle = page.waitForResponse(response => response.url().endsWith('/audio/' + prefix + 'battle.m4a') && response.ok());
 await page.goto(mini ? '/music-menu-test' : '/music-menu-test?polish=classic');
 await battle;
 await page.getByRole('button', {name:'모험 시작'}).click();
 await page.getByRole('button', {name:'숲으로 떠나기'}).click();
 type AudioProbe = {
  scene: { audio: { context: AudioContext; musicGate?: GainNode; musicSource?: AudioBufferSourceNode } };
  sim: { gainXp(amount: number): void; state: {elapsed:number}; update(seconds:number):void };
 };
 const music = () => page.evaluate(() => {
  const scope = window as unknown as {musicTest:AudioProbe;originalMusic?:AudioBufferSourceNode};
  const {context, musicSource, musicGate} = scope.musicTest.scene.audio;
  scope.originalMusic ??= musicSource;
  return {context:context.state, playing:Boolean(musicSource),same:musicSource === scope.originalMusic,duration:musicSource?.buffer?.duration,volume:musicGate?.gain.value};
 });
 await expect.poll(async () => (await music()).playing).toBe(true);
 await page.getByRole('button', {name:'일시정지',exact:true}).click();
 await expect.poll(async () => (await music()).playing).toBe(false);
 await page.locator('[data-action="resume"]').click();
 await expect.poll(async () => (await music()).volume).toBeCloseTo(1, 1);
 await page.evaluate(() => {
  const scope = window as unknown as {musicTest:AudioProbe;originalMusic?:AudioBufferSourceNode};
  scope.originalMusic = scope.musicTest.scene.audio.musicSource;
  scope.musicTest.sim.gainXp(16);
 });
 await expect(page.locator('.upgrade-panel')).toBeVisible();
 await expect.poll(async () => (await music()).volume).toBeCloseTo(.3, 1);
 expect((await music()).same).toBe(true);
 const visibility = (hidden:boolean) => page.evaluate(value => {
  Object.defineProperty(document, 'hidden', {configurable:true,value});
  document.dispatchEvent(new Event('visibilitychange'));
 }, hidden);
 await visibility(true);
 await expect.poll(async () => (await music()).context).toBe('suspended');
 expect((await music()).playing).toBe(false);
 await visibility(false);
 await expect.poll(async () => (await music()).playing).toBe(true);
 await expect.poll(async () => (await music()).volume).toBeCloseTo(.3, 1);
 await expect(page.locator('.upgrade-panel')).toBeVisible();
 await page.evaluate(() => {
  const scope = window as unknown as {musicTest:AudioProbe;originalMusic?:AudioBufferSourceNode};
  scope.originalMusic = scope.musicTest.scene.audio.musicSource;
 });
 await page.locator('.upgrade-card').first().click();
 await expect.poll(async () => (await music()).volume).toBeCloseTo(1, 1);
 expect((await music()).same).toBe(true);
 const advance = (elapsed:number) => page.evaluate(time => {
  const {sim} = (window as unknown as {musicTest:AudioProbe}).musicTest;
  sim.state.elapsed = time;
  sim.update(.04);
 }, elapsed);
 await advance(179.99);
 expect((await music()).same).toBe(true);
 await warden;
 if (mini) expect((await music()).duration).toBeGreaterThan(66);
 await advance(599.99);
 await expect.poll(async () => (await music()).duration ?? 0).toBeGreaterThan(40);
 await expect.poll(async () => (await music()).duration ?? 0).toBeLessThan(50);
 expect((await music()).same).toBe(false);
});

test('each combat cue renders a different audible waveform', async ({ page }) => {
 await page.goto('/');
 const values = await page.evaluate(async () => {
  const {GameAudio} = await import('/src/game/audio.ts' as string) as typeof import('../src/game/audio');
  const {COMBAT_SOUNDS, STORYBOOK_CUES, MINI_WORLD_CUES} = await import('/src/game/combat-sounds.ts' as string) as typeof import('../src/game/combat-sounds');
  const Original = window.AudioContext;
  const values = [];
  try {
   const profiles = [
    ...Object.keys(COMBAT_SOUNDS).map(cue => ({ cue, style: 'default' })),
    ...Object.keys(STORYBOOK_CUES).map(cue => ({ cue, style: 'storybook' })),
    ...Object.keys(MINI_WORLD_CUES).map(cue => ({ cue, style: 'mini' })),
   ];
   for (const {cue, style} of profiles) {
    const render = new OfflineAudioContext(1, 44100 * 1.2, 44100);
    window.AudioContext = class {
     readonly state = 'running';
     readonly currentTime = 0;
     readonly sampleRate = render.sampleRate;
     readonly destination = render.destination;
     createGain = render.createGain.bind(render);
     createDynamicsCompressor = render.createDynamicsCompressor.bind(render);
     createOscillator = render.createOscillator.bind(render);
     createBuffer = render.createBuffer.bind(render);
     createBufferSource = render.createBufferSource.bind(render);
     createBiquadFilter = render.createBiquadFilter.bind(render);
     resume = () => Promise.resolve();
    } as unknown as typeof AudioContext;
    const audio = new GameAudio(undefined, style === 'mini');
    audio.unlock();
    audio.playCue(cue as keyof typeof COMBAT_SOUNDS, style === 'storybook');
    const pcm = (await render.startRendering()).getChannelData(0);
    let peak = 0, signature = 0;
    for (const value of pcm) {
     peak = Math.max(peak, Math.abs(value));
     signature = (Math.imul(signature, 31) + Math.round(value * 1e6)) | 0;
    }
    values.push({cue: style + '-' + cue, peak, signature});
   }
  } finally { window.AudioContext = Original; }
  return values;
 });
 expect(values).toHaveLength(69);
 for (const {cue,peak} of values) {
  expect(peak, cue).toBeGreaterThan(.005);
  expect(peak, cue).toBeLessThan(1);
 }
 expect(new Set(values.map(value => value.signature)).size).toBe(values.length);
});

test('chooses all three exploration tracks from pause settings and retains the choice', async ({ browser }) => {
 const context = await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true});
 try {
  const page = await context.newPage();
  await page.addInitScript(() => {
   const Original = window.AudioContext;
   const probe = window as unknown as { musicDuration: number };
   window.AudioContext = class extends Original {
    createBufferSource() {
     const source = super.createBufferSource();
     const start = source.start.bind(source);
     source.start = (...args) => {
      if (source.loop && source.buffer) probe.musicDuration = source.buffer.duration;
      start(...args);
     };
     return source;
    }
   };
  });
  const duration = () => page.evaluate(() => (window as unknown as {musicDuration:number}).musicDuration);
  const start = async () => {
   await page.getByRole('button',{name:'모험 시작'}).tap();
   await page.getByRole('button',{name:'숲으로 떠나기'}).tap();
  };
  await page.goto('/');
  await start();
  await expect.poll(duration).toBeCloseTo(66.67,1);
  await page.getByRole('button',{name:'일시정지',exact:true}).tap();
  await page.getByRole('button',{name:'설정',exact:true}).tap();
  const bgm2 = page.getByRole('button',{name:/BGM 2/});
  await bgm2.tap();
  await expect(bgm2).toHaveAttribute('aria-pressed','true');
  expect(await page.locator('.settings-panel').evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);
  expect(await duration()).toBeCloseTo(66.67,1);

  await page.getByRole('button',{name:'설정 완료'}).tap();
  await page.getByRole('button',{name:'모험 계속하기'}).tap();
  await expect.poll(duration).toBeCloseTo(80,1);
  await page.getByRole('button',{name:'일시정지',exact:true}).tap();
  await page.getByRole('button',{name:'설정',exact:true}).tap();
  const bgm3 = page.getByRole('button',{name:/BGM 3/});
  const original = page.waitForResponse(response => response.url().endsWith('/audio/everpath-battle.m4a') && response.ok());
  await bgm3.tap();
  await original;
  await expect(bgm3).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'설정 완료'}).tap();
  await page.getByRole('button',{name:'모험 계속하기'}).tap();
  await expect.poll(duration).toBeCloseTo(74.8,1);
  await page.reload();
  await page.getByRole('button',{name:'설정',exact:true}).tap();
  await expect(bgm3).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'설정 완료'}).tap();
  await start();
  await expect.poll(duration).toBeCloseTo(74.8,1);
  await page.getByRole('button',{name:'일시정지',exact:true}).tap();
  await page.getByRole('button',{name:'설정',exact:true}).tap();
  await page.getByRole('button',{name:/BGM 1/}).tap();
  await page.getByRole('button',{name:'설정 완료'}).tap();
  await page.getByRole('button',{name:'모험 계속하기'}).tap();
  await expect.poll(duration).toBeCloseTo(66.67,1);
 } finally { await context.close(); }
});
