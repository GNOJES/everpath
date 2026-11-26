import {it,expect,vi,afterEach} from 'vitest';
import {GameAudio} from '../src/game/audio';
class Param {value=1;setValueAtTime(v:number, _at?:number){this.value=v;}linearRampToValueAtTime(v:number, _at?:number){this.value=v;}exponentialRampToValueAtTime(v:number, _at?:number){this.value=v;}cancelScheduledValues(_at?:number){}setTargetAtTime(v:number, _at?:number, _tc?:number){this.value=v;}}
class Gain {gain=new Param();connect(){}disconnect(){}}
class Osc {frequency=new Param();type='sine';onended?:()=>void;stopped=false;connect(){}disconnect(){}start(){}stop(){this.stopped=true;}}
class Context {static last:Context;state='running';currentTime=0;destination={};gains:Gain[]=[];voices:Osc[]=[];constructor(){Context.last=this;}createDynamicsCompressor(){return {threshold:new Param(),knee:new Param(),ratio:new Param(),attack:new Param(),release:new Param(),connect(){}};}createGain(){const g=new Gain();this.gains.push(g);return g;}createOscillator(){const o=new Osc();this.voices.push(o);return o;}resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}}
afterEach(()=>vi.unstubAllGlobals());
it('pauses music in the pause menu and plays at 30% during a level-up', () => {
 vi.stubGlobal('AudioContext', Context);
 const a = new GameAudio();
 expect([a.music, a.sfx]).toEqual([1, .7]);
 a.unlock();
 a.music = .8;
 a.syncMusic('running');
 const [, track, effects, duck] = Context.last.gains;
 expect(duck.gain.value).toBe(1);
 for (const [status, level] of [['paused', 0], ['upgrade', .3]] as const) {
  a.syncMusic(status);
  expect(duck.gain.value).toBe(level);
  expect(track.gain.value).toBe(.8);
  expect(effects.gain.value).toBeCloseTo(1.12);
 }
 a.syncMusic('running');
 expect(duck.gain.value).toBe(1);
 a.music = 0;
 a.sfx = 0;
 expect(track.gain.value).toBe(0);
 expect(effects.gain.value).toBe(0);
});
it('suspend stops scheduled level chimes, is idempotent and can resume',()=>{vi.stubGlobal('AudioContext',Context);const a=new GameAudio();a.unlock();a.levelUp();a.suspend();expect(Context.last.voices.every(v=>v.stopped)).toBe(true);a.suspend();a.unlock();a.click();expect(Context.last.state).toBe('running');});
it('sound does not consume gameplay randomness and bounds simultaneous voices',()=>{vi.stubGlobal('AudioContext',Context);const random=vi.spyOn(Math,'random');const a=new GameAudio();a.unlock();for(let i=0;i<100;i++)a.levelUp();expect(Context.last.voices.length).toBeLessThanOrEqual(24);expect(random).not.toHaveBeenCalled();random.mockRestore();});
it('fades out the battle soundtrack before starting the 10-minute warden track', async () => {
 vi.useFakeTimers();
 try {
  const ramps: { at: number; val: number }[] = [];
  class Source {
   buffer: { duration: number } | null = null; loop = false; stopped = false; started = false;
   onended: (() => void) | null = null;
   connect() {} disconnect() {}
   start() { this.started = true; }
   stop() { this.stopped = true; this.onended?.(); }
  }
  class TrackGain extends Gain {
   constructor() {
    super();
    this.gain.linearRampToValueAtTime = (v: number, at: number) => { this.gain.value = v; ramps.push({ at, val: v }); };
   }
  }
  class MusicContext extends Context {
   sources: Source[] = [];
   createGain() { const g = new TrackGain(); this.gains.push(g); return g; }
   createBufferSource() { const s = new Source(); this.sources.push(s); return s; }
   decodeAudioData() { return Promise.resolve({ duration: 60 }); }
  }
  vi.stubGlobal('AudioContext', MusicContext);
  vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }));
  const a = new GameAudio();
  a.unlock();
  a.syncMusic('running', false);
  await vi.advanceTimersByTimeAsync(10);
  const ctx = Context.last as unknown as MusicContext;
  expect(ctx.sources).toHaveLength(1);
  const battleSource = ctx.sources[0];
  expect(battleSource.started).toBe(true);
  a.syncMusic('running', true);
  // Immediately after warden spawns, the battle track is fading out rather than hard-stopped.
  expect(battleSource.stopped).toBe(false);
  expect(ramps.some(r => r.val === 0)).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(battleSource.stopped).toBe(true);
  expect(ctx.sources).toHaveLength(2);
  expect(ctx.sources[1].started).toBe(true);
 } finally {
  vi.useRealTimers();
 }
});
