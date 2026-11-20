import type {HeroId, RunState} from './types';

const note = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const volume=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
type MusicTrack = 'battle' | 'warden';
export class GameAudio {
 private context?:AudioContext;private musicBus?:GainNode;private sfxBus?:GainNode;private musicGate?:GainNode;
 private soundtracks: Partial<Record<MusicTrack, AudioBuffer>> = {};
 private soundtrackLoading = new Set<MusicTrack>();
 private track: MusicTrack = 'battle';
 private musicSource?: AudioBufferSourceNode;
 private musicOffset = 0;
 private musicStarted = 0;
 private musicLevel = 0;
 private suspended = false;
 private musicVolume=1;private sfxVolume=1;private lastFx=-Infinity;private lastAttack=-Infinity;private voices=new Set<OscillatorNode>();
 get music(){return this.musicVolume;}set music(v:number){this.musicVolume=volume(v);if(this.musicBus)this.musicBus.gain.setTargetAtTime(this.musicVolume,this.context!.currentTime,.015);}
 get sfx(){return this.sfxVolume;}set sfx(v:number){this.sfxVolume=volume(v);if(this.sfxBus)this.sfxBus.gain.setTargetAtTime(this.sfxVolume * 1.6,this.context!.currentTime,.015);}
 unlock(){try{
  this.suspended = false;
  if(!this.context){const c=this.context=new AudioContext();const master=c.createGain();master.gain.value=.9;const limiter=c.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=18;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.15;master.connect(limiter);limiter.connect(c.destination);
   this.musicBus=c.createGain();this.musicBus.gain.value=this.musicVolume;this.musicBus.connect(master);
   this.sfxBus=c.createGain();this.sfxBus.gain.value=this.sfxVolume * 1.6;this.sfxBus.connect(master);
   this.musicGate=c.createGain();this.musicGate.gain.value=this.musicLevel;this.musicGate.connect(this.musicBus);
  }void this.context.resume().catch(()=>{});
  this.loadSoundtrack('battle');
  this.loadSoundtrack('warden');
 }catch{/* Sound remains optional if audio is unavailable. */}}
 suspend(){this.suspended = true;for(const voice of this.voices){try{voice.stop();voice.disconnect();}catch{}}this.voices.clear();this.syncMusic(undefined, this.track === 'warden');void this.context?.suspend().catch(()=>{});}
 private tone(frequency:number,duration:number,level:number,type:OscillatorType='sine',delay=0){
  const c=this.context;if(!c||c.state!=='running'||this.voices.size>=24||this.sfxVolume<=0)return;
  const o=c.createOscillator(),g=c.createGain(),at=c.currentTime+delay;o.type=type;o.frequency.value=frequency;
  g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(level,at+.012);g.gain.exponentialRampToValueAtTime(.0001,at+duration);
  o.connect(g);g.connect(this.sfxBus!);this.voices.add(o);o.onended=()=>{this.voices.delete(o);o.disconnect();g.disconnect();};o.start(at);o.stop(at+duration+.02);
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
 private loadSoundtrack(track: MusicTrack) {
  const context = this.context;
  if (!context?.decodeAudioData || this.soundtrackLoading.has(track) || this.soundtracks[track]) return;
  this.soundtrackLoading.add(track);
  void (async () => {
   const response = await fetch(`${import.meta.env.BASE_URL}audio/everpath-${track}.m4a`);
   if (!response.ok) return;
   this.soundtracks[track] = await context.decodeAudioData(await response.arrayBuffer());
   this.startMusic();
  })().catch(() => { /* Failed music downloads leave sound effects available. */ })
   .finally(() => this.soundtrackLoading.delete(track));
 }
 private startMusic() {
  const context = this.context;
  const buffer = this.soundtracks[this.track];
  if (this.suspended || !context || context.state !== 'running' || !buffer || this.musicSource || !this.musicLevel) return;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(this.musicGate!);
  this.musicStarted = context.currentTime;
  const offset = this.musicOffset % buffer.duration;
  source.start(this.musicStarted, offset);
  this.musicSource = source;
 }
 private stopMusic() {
  const context = this.context, source = this.musicSource;
  if (!context || !source) return;
  this.musicOffset += Math.max(0, context.currentTime - this.musicStarted);
  source.onended = () => source.disconnect();
  source.stop(context.currentTime + .035);
  this.musicSource = undefined;
 }
 syncMusic(status?: RunState['status'], finalBoss = false) {
  const level = status === 'running' ? 1 : status === 'paused' || status === 'upgrade' ? .5 : 0;
  const desiredTrack = finalBoss ? 'warden' : 'battle';
  if (this.track !== desiredTrack) {
   this.stopMusic();
   this.track = desiredTrack;
   this.musicOffset = 0;
  }
  const context = this.context;
  if (this.musicLevel !== level) {
   this.musicLevel = level;
   if (context && this.musicGate) this.musicGate.gain.setTargetAtTime(level, context.currentTime, .08);
   if (level === 0) this.stopMusic();
  }
  if (level > 0) this.startMusic();
 }
}
