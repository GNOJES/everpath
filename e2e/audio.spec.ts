import {test,expect} from '@playwright/test';
test('production audio renders finite audible PCM, mutes live channels and bounds dense peaks',async({page})=>{
 await page.goto('/');
 const results=await page.evaluate(async()=>{
  // Real Web Audio DSP offline; software signal validation, not a speaker listening test.
  const {GameAudio}=await import('/src/game/audio.ts' as string);const Original=window.AudioContext;const results=[];
  try{for(const mute of [false,true]){
   const offline=new OfflineAudioContext(1,44100*3,44100);
   (window as any).AudioContext=class{state='running';currentTime=0;destination=offline.destination;createGain=()=>offline.createGain();createOscillator=()=>offline.createOscillator();createDynamicsCompressor=()=>offline.createDynamicsCompressor();resume=()=>Promise.resolve();suspend=()=>Promise.resolve();};
   const a=new GameAudio();a.music=1;a.sfx=1;a.unlock();a.syncMusic('running');a.click();a.hurt();a.boss();a.victory();a.defeat();a.levelUp();a.attack('mage');if(mute){a.music=0;a.sfx=0;}
   const samples=(await offline.startRendering()).getChannelData(0);let peak=0,energy=0,count=0;for(let i=4410;i<samples.length;i++){if(!Number.isFinite(samples[i]))throw new Error('Nonfinite PCM');peak=Math.max(peak,Math.abs(samples[i]));energy+=samples[i]*samples[i];count++;}results.push({mute,peak,rms:Math.sqrt(energy/count)});
  }}finally{window.AudioContext=Original;}return results;
 });
 expect(results[0].rms).toBeGreaterThan(.001);expect(results[0].peak).toBeLessThan(1);expect(results[1].rms).toBeLessThan(.0001);
});
test('audio survives native suspension and resumes only on user gesture',async({page})=>{
 await page.addInitScript(() => {
  const Original = window.AudioContext;
  const probe = window as unknown as { contexts: AudioContext[]; soundtrack: { duration: number; channels: number; offset: number; loop: boolean }[] };
  probe.contexts = [];
  probe.soundtrack = [];
  window.AudioContext = class extends Original {
   constructor(options?: AudioContextOptions) { super(options); probe.contexts.push(this); }
   createBufferSource() {
    const source = super.createBufferSource();
    const start = source.start.bind(source);
    source.start = (when, offset, duration) => {
     probe.soundtrack.push({ duration: source.buffer!.duration, channels: source.buffer!.numberOfChannels, offset: offset ?? 0, loop: source.loop });
     start(when, offset, duration);
    };
    return source;
   }
  };
 });
 await page.goto('/e2e/playtest.html');await page.locator('[data-action="embark"]').click();await page.locator('[data-action="start"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as unknown as { contexts:AudioContext[] }).contexts[0]?.state)).toBe('running');
 const music = () => page.evaluate(() => (window as unknown as { soundtrack: { offset: number; channels: number; duration: number; loop: boolean }[] }).soundtrack);
 await expect.poll(async () => (await music()).length).toBe(1);
 expect((await music())[0]).toMatchObject({ offset: 0, channels: 2, loop: true });
 expect((await music())[0].duration).toBeGreaterThan(50);
 await page.evaluate(()=>(window as any).__playtest.nativePause());await expect.poll(()=>page.evaluate(()=>(window as unknown as { contexts:AudioContext[] }).contexts[0]?.state)).toBe('suspended');
 await page.locator('[data-action="resume"]').click();await expect.poll(()=>page.evaluate(()=>(window as unknown as { contexts:AudioContext[] }).contexts[0]?.state)).toBe('running');
 await expect.poll(async () => (await music()).length).toBe(2);
 expect((await music())[1].offset).toBeGreaterThan(0);
});

test('pause and upgrade duck the battle loop without replacing its playing source', async ({ page }) => {
 await page.route('**/music-menu-test', route => route.fulfill({
  contentType:'text/html',
  body:'<meta name="viewport" content="width=device-width"><div id="app"></div><script type="module">import "/src/style.css"; import {App} from "/src/ui/app.ts"; window.musicTest = new App(document.querySelector("#app"));</script>',
 }));
 await page.goto('/music-menu-test');
 await page.getByRole('button', {name:'모험 시작'}).click();
 await page.getByRole('button', {name:'숲으로 떠나기'}).click();
 type AudioProbe = {
  scene: { audio: { musicGate?: GainNode; musicSource?: AudioBufferSourceNode } };
  sim: { gainXp(amount: number): void; state: {elapsed:number}; update(seconds:number):void };
 };
 const music = () => page.evaluate(() => {
  const scope = window as unknown as {musicTest:AudioProbe;originalMusic?:AudioBufferSourceNode};
  const {musicSource, musicGate} = scope.musicTest.scene.audio;
  scope.originalMusic ??= musicSource;
  return {playing:Boolean(musicSource),same:musicSource === scope.originalMusic,duration:musicSource?.buffer?.duration,volume:musicGate?.gain.value};
 });
 await expect.poll(async () => (await music()).playing).toBe(true);
 await page.getByRole('button', {name:'일시정지',exact:true}).click();
 await expect.poll(async () => (await music()).volume).toBeCloseTo(.5, 1);
 expect((await music()).same).toBe(true);
 await page.locator('[data-action="resume"]').click();
 await expect.poll(async () => (await music()).volume).toBeCloseTo(1, 1);
 await page.evaluate(() => (window as unknown as {musicTest:AudioProbe}).musicTest.sim.gainXp(16));
 await expect(page.locator('.upgrade-panel')).toBeVisible();
 await expect.poll(async () => (await music()).volume).toBeCloseTo(.5, 1);
 expect((await music()).same).toBe(true);
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
 await advance(599.99);
 await expect.poll(async () => (await music()).duration ?? 0).toBeGreaterThan(40);
 await expect.poll(async () => (await music()).duration ?? 0).toBeLessThan(50);
 expect((await music()).same).toBe(false);
});
