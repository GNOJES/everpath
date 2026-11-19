import type {HeroId} from './types';

const note = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
// D minor, B-flat, F, C. Each measure has a bass ostinato and brass-like harmony.
const chords = [[38, 53, 57, 62], [34, 53, 58, 62], [41, 53, 57, 60], [36, 52, 55, 60]];
const melody = [
 [74, 0, 69, 72, 74, 76, 77, 0], [77, 0, 74, 70, 72, 74, 69, 0],
 [72, 0, 69, 72, 77, 79, 81, 0], [79, 77, 76, 72, 74, 72, 69, 0],
 [74, 74, 77, 81, 84, 81, 77, 76], [77, 77, 74, 70, 74, 77, 82, 0],
 [81, 77, 72, 77, 84, 81, 79, 77], [76, 79, 77, 76, 74, 0, 69, 0],
];
const eighth = 60 / 124 / 2;
const volume=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
export class GameAudio {
 private context?:AudioContext;private musicBus?:GainNode;private sfxBus?:GainNode;private musicGate?:GainNode;
 private musicVolume=.25;private sfxVolume=.5;private musicClock=0;private step=0;private lastFx=-Infinity;private lastAttack=-Infinity;private voices=new Set<OscillatorNode>();
 get music(){return this.musicVolume;}set music(v:number){this.musicVolume=volume(v);if(this.musicBus)this.musicBus.gain.setTargetAtTime(this.musicVolume,this.context!.currentTime,.015);}
 get sfx(){return this.sfxVolume;}set sfx(v:number){this.sfxVolume=volume(v);if(this.sfxBus)this.sfxBus.gain.setTargetAtTime(this.sfxVolume * 1.6,this.context!.currentTime,.015);}
 unlock(){try{
  if(!this.context){const c=this.context=new AudioContext();const master=c.createGain();master.gain.value=.9;const limiter=c.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=18;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.15;master.connect(limiter);limiter.connect(c.destination);
   this.musicBus=c.createGain();this.musicBus.gain.value=this.musicVolume;this.musicBus.connect(master);
   this.sfxBus=c.createGain();this.sfxBus.gain.value=this.sfxVolume * 1.6;this.sfxBus.connect(master);
   this.musicGate=c.createGain();this.musicGate.gain.value=0;this.musicGate.connect(this.musicBus);
  }void this.context.resume().catch(()=>{});
 }catch{/* Sound remains optional if audio is unavailable. */}}
 suspend(){for(const voice of this.voices){try{voice.stop();voice.disconnect();}catch{}}this.voices.clear();this.musicClock=0;this.step=0;void this.context?.suspend().catch(()=>{});}
 private tone(frequency:number,duration:number,level:number,type:OscillatorType='sine',delay=0,music=false){
  const c=this.context;if(!c||c.state!=='running'||this.voices.size>=24||(music?this.musicVolume:this.sfxVolume)<=0)return;
  const o=c.createOscillator(),g=c.createGain(),at=c.currentTime+delay;o.type=type;o.frequency.value=frequency;
  g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(level,at+.012);g.gain.exponentialRampToValueAtTime(.0001,at+duration);
  o.connect(g);g.connect(music?this.musicGate!:this.sfxBus!);this.voices.add(o);o.onended=()=>{this.voices.delete(o);o.disconnect();g.disconnect();};o.start(at);o.stop(at+duration+.02);
 }
 click(){this.tone(523,.09,.06,'triangle');}
 hit(){const now=performance.now();if(now-this.lastFx<85)return;this.lastFx=now;this.tone(215,.06,.025,'triangle');}
 hurt(){this.tone(98,.18,.1,'triangle');this.tone(73,.2,.04);}
 attack(hero:HeroId){const now=performance.now();if(now-this.lastAttack<140)return;this.lastAttack=now;this.tone(hero==='mage'?880:hero==='archer'?660:260,.07,.018,'triangle');}
 levelUp(){[523,659,784].forEach((f,i)=>this.tone(f,.28,.065,'triangle',i*.07));}
 boss(){[164,155,130].forEach((f,i)=>this.tone(f,.38,.075,'triangle',i*.18));}
 victory(){[523,659,784,1046].forEach((f,i)=>this.tone(f,.45,.075,'triangle',i*.15));}
 defeat(){[330,261,196].forEach((f,i)=>this.tone(f,.4,.06,'triangle',i*.2));}
 bossDefeated(final: boolean) {
  this.tone(55, .48, .28, 'sine');
  const fanfare = final ? [62, 65, 69, 74, 77, 81] : [62, 69, 74];
  fanfare.forEach((pitch, i) => this.tone(note(pitch), .52, .13, 'triangle', i * .085));
 }
 tick(dt: number, playing: boolean) {
  if (this.context && this.musicGate) this.musicGate.gain.setTargetAtTime(playing ? 1 : 0, this.context.currentTime, .035);
  if (!playing || this.context?.state !== 'running') return;
  this.musicClock -= dt;
  if (this.musicClock > 0) return;
  this.musicClock += eighth;
  const step = this.step++ % 64, beat = step % 8, bar = Math.floor(step / 8);
  const [root, ...harmony] = chords[bar % chords.length];
  const pitch = melody[bar][beat];
  if (pitch) {
   this.tone(note(pitch), beat === 0 || beat === 6 ? .38 : .22, .16, 'triangle', 0, true);
   this.tone(note(pitch - 12), .22, .065, 'triangle', 0, true);
  }
  this.tone(note(root + (beat % 4 === 2 ? 7 : 0)), .21, beat % 2 === 0 ? .21 : .12, 'triangle', 0, true);
  if (beat === 0 || beat === 4) {
   harmony.forEach(p => this.tone(note(p), .52, .11, 'triangle', 0, true));
   this.tone(57, .2, .35, 'sine', 0, true);
   this.tone(105, .075, .13, 'triangle', 0, true);
  } else if (beat === 2 || beat === 6) {
   this.tone(167, .08, .12, 'triangle', 0, true);
   this.tone(277, .065, .055, 'square', 0, true);
  }
 }
}
