import {test,expect} from '@playwright/test';
test('production audio renders finite audible PCM, mutes live channels and bounds dense peaks',async({page})=>{
 await page.goto('/');
 const results=await page.evaluate(async()=>{
  // Real Web Audio DSP offline; software signal validation, not a speaker listening test.
  const {GameAudio}=await import('/src/game/audio.ts' as string);const Original=window.AudioContext;const results=[];
  try{for(const mute of [false,true]){
   const offline=new OfflineAudioContext(1,44100*3,44100);
   (window as any).AudioContext=class{state='running';currentTime=0;destination=offline.destination;createGain=()=>offline.createGain();createOscillator=()=>offline.createOscillator();createDynamicsCompressor=()=>offline.createDynamicsCompressor();resume=()=>Promise.resolve();suspend=()=>Promise.resolve();};
   const a=new GameAudio();a.music=1;a.sfx=1;a.unlock();a.tick(.1,true);a.click();a.hurt();a.boss();a.victory();a.defeat();a.levelUp();a.attack('mage');if(mute){a.music=0;a.sfx=0;}
   const samples=(await offline.startRendering()).getChannelData(0);let peak=0,energy=0,count=0;for(let i=4410;i<samples.length;i++){if(!Number.isFinite(samples[i]))throw new Error('Nonfinite PCM');peak=Math.max(peak,Math.abs(samples[i]));energy+=samples[i]*samples[i];count++;}results.push({mute,peak,rms:Math.sqrt(energy/count)});
  }}finally{window.AudioContext=Original;}return results;
 });
 expect(results[0].rms).toBeGreaterThan(.001);expect(results[0].peak).toBeLessThan(1);expect(results[1].rms).toBeLessThan(.0001);
});
test('audio survives native suspension and resumes only on user gesture',async({page})=>{
 await page.addInitScript(()=>{const Original=window.AudioContext;(window as any).__contexts=[];window.AudioContext=class extends Original{constructor(...args:any[]){super(...args);(window as any).__contexts.push(this);}};});
 await page.goto('/e2e/playtest.html');await page.locator('[data-action="embark"]').click();await page.locator('[data-action="start"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__contexts[0]?.state)).toBe('running');
 await page.evaluate(()=>(window as any).__playtest.nativePause());await expect.poll(()=>page.evaluate(()=>(window as any).__contexts[0]?.state)).toBe('suspended');
 await page.locator('[data-action="resume"]').click();await expect.poll(()=>page.evaluate(()=>(window as any).__contexts[0]?.state)).toBe('running');
});
