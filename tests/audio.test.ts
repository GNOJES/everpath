import {it,expect,vi,afterEach} from 'vitest';
import {GameAudio} from '../src/game/audio';
class Param {value=1;setValueAtTime(v:number){this.value=v;}linearRampToValueAtTime(v:number){this.value=v;}exponentialRampToValueAtTime(v:number){this.value=v;}cancelScheduledValues(){}setTargetAtTime(v:number){this.value=v;}}
class Gain {gain=new Param();connect(){}disconnect(){}}
class Osc {frequency=new Param();type='sine';onended?:()=>void;stopped=false;connect(){}disconnect(){}start(){}stop(){this.stopped=true;}}
class Context {static last:Context;state='running';currentTime=0;destination={};gains:Gain[]=[];voices:Osc[]=[];constructor(){Context.last=this;}createDynamicsCompressor(){return {threshold:new Param(),knee:new Param(),ratio:new Param(),attack:new Param(),release:new Param(),connect(){}};}createGain(){const g=new Gain();this.gains.push(g);return g;}createOscillator(){const o=new Osc();this.voices.push(o);return o;}resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}}
afterEach(()=>vi.unstubAllGlobals());
it('ducks only the music on pause and upgrade, and leaves volume settings alone', () => {
 vi.stubGlobal('AudioContext', Context);
 const a = new GameAudio();
 expect([a.music, a.sfx]).toEqual([1, 1]);
 a.unlock();
 a.music = .8;
 a.syncMusic('running');
 const [, track, effects, duck] = Context.last.gains;
 expect(duck.gain.value).toBe(1);
 for (const status of ['paused', 'upgrade'] as const) {
  a.syncMusic(status);
  expect(duck.gain.value).toBe(.5);
  expect(track.gain.value).toBe(.8);
  expect(effects.gain.value).toBe(1.6);
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
