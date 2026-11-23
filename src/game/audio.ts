import type { CombatSound, HeroId, RunState } from './types';
import { DEFAULT_SFX_VOLUME } from './config';
import { COMBAT_SOUNDS } from './combat-sounds';

const volume=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
type MusicTrack = 'battle' | 'warden';
export class GameAudio {
 private context?:AudioContext;private musicBus?:GainNode;private sfxBus?:GainNode;private musicGate?:GainNode;
 private soundtracks: Partial<Record<MusicTrack, AudioBuffer>> = {};
 private soundtrackLoading = new Set<MusicTrack>();
 private battleDownload?: Promise<ArrayBuffer | undefined>;
 private track: MusicTrack = 'battle';
 private musicSource?: AudioBufferSourceNode;
 private musicOffset = 0;
 private musicStarted = 0;
 private musicLevel = 0;
 private suspended = false;
 private musicVolume=1;private sfxVolume=DEFAULT_SFX_VOLUME;private lastFx=-Infinity;private lastAttack=-Infinity;
 private voices = new Set<AudioScheduledSourceNode>();
 private lastCues = new Map<CombatSound, number>();
 private noiseBuffer?: AudioBuffer;
 get music(){return this.musicVolume;}set music(v:number){this.musicVolume=volume(v);if(this.musicBus)this.musicBus.gain.setTargetAtTime(this.musicVolume,this.context!.currentTime,.015);}
 get sfx(){return this.sfxVolume;}set sfx(v:number){this.sfxVolume=volume(v);if(this.sfxBus)this.sfxBus.gain.setTargetAtTime(this.sfxVolume * 1.6,this.context!.currentTime,.015);}
 preloadBattle() {
  if (!this.soundtracks.battle && !this.soundtrackLoading.has('battle')) {
   this.battleDownload ??= this.fetchSoundtrack('battle').catch(() => undefined);
  }
 }
 beginRun() {
  this.stopMusic();
  this.track = 'battle';
  this.musicOffset = 0;
  this.musicLevel = 1;
  if (this.context && this.musicGate) {
   const now = this.context.currentTime;
   this.musicGate.gain.cancelScheduledValues(now);
   this.musicGate.gain.setValueAtTime(1, now);
  }
  this.loadSoundtrack('battle');
  this.startMusic();
 }
 unlock(){try{
  this.suspended = false;
  if(!this.context){const c=this.context=new AudioContext();const master=c.createGain();master.gain.value=.9;const limiter=c.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=18;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.15;master.connect(limiter);limiter.connect(c.destination);
   this.musicBus=c.createGain();this.musicBus.gain.value=this.musicVolume;this.musicBus.connect(master);
   this.sfxBus=c.createGain();this.sfxBus.gain.value=this.sfxVolume * 1.6;this.sfxBus.connect(master);
   this.musicGate=c.createGain();this.musicGate.gain.value=this.musicLevel;this.musicGate.connect(this.musicBus);
 }void this.context.resume().then(()=>this.startMusic()).catch(()=>{});
  this.loadSoundtrack('battle');
  this.loadSoundtrack('warden');
 }catch{/* Sound remains optional if audio is unavailable. */}}
 suspend(){
  if (this.suspended) return;
  this.suspended = true;
  this.stopVoices();
  this.stopMusic();
  void this.context?.suspend().catch(()=>{});
 }
 resume(){
  if (!this.suspended) return;
  this.suspended = false;
  void this.context?.resume().then(()=>this.startMusic()).catch(()=>{});
 }
 private stopVoices() {
  for (const voice of this.voices) { try { voice.stop(); voice.disconnect(); } catch {} }
  this.voices.clear();
 }
 private canPlay(context: AudioContext | undefined): context is AudioContext {
  return !!context && !this.suspended && context.state === 'running' && this.sfxVolume > 0;
 }
 private playVoice(c: AudioContext, source: AudioScheduledSourceNode, at: number, duration: number, level: number, filter?: BiquadFilterNode) {
  const envelope = c.createGain();
  envelope.gain.setValueAtTime(.0001, at);
  envelope.gain.exponentialRampToValueAtTime(level, at + .012);
  envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
  if (filter) { source.connect(filter); filter.connect(envelope); }
  else source.connect(envelope);
  envelope.connect(this.sfxBus!);
  this.voices.add(source);
  source.onended = () => { this.voices.delete(source); source.disconnect(); filter?.disconnect(); envelope.disconnect(); };
  source.start(at);
  source.stop(at + duration + .02);
 }
 private tone(frequency:number,duration:number,level:number,type:OscillatorType='sine',delay=0,endPitch=frequency){
  const c=this.context;if(!this.canPlay(c)||this.voices.size>=24)return;
  const source=c.createOscillator(),at=c.currentTime+delay;
  source.type=type;
  source.frequency.setValueAtTime(frequency, at);
  if (endPitch !== frequency) source.frequency.exponentialRampToValueAtTime(endPitch, at + duration * .8);
  this.playVoice(c, source, at, duration, level);
 }
 private noise(center: number, duration: number, level: number, delay = 0) {
  const c=this.context;if(!this.canPlay(c)||this.voices.size>=24)return;
  if (!this.noiseBuffer) {
   this.noiseBuffer = c.createBuffer(1, Math.ceil(c.sampleRate / 2), c.sampleRate);
   const samples = this.noiseBuffer.getChannelData(0);
   let seed = 317;
   for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    samples[i] = seed / 2147483648 - 1;
   }
  }
  const source = c.createBufferSource(), filter = c.createBiquadFilter();
  source.buffer = this.noiseBuffer;
  filter.type = 'bandpass'; filter.frequency.value = center; filter.Q.value = .65;
  this.playVoice(c, source, c.currentTime + delay, duration, level, filter);
 }
 click(){this.tone(523,.09,.06,'triangle');}
 hit(){const now=performance.now();if(now-this.lastFx<85)return;this.lastFx=now;this.tone(215,.06,.025,'triangle');}
 hurt(){this.tone(98,.18,.1,'triangle');this.tone(73,.2,.04);}
 attack(hero:HeroId){const now=performance.now();if(now-this.lastAttack<140)return;this.lastAttack=now;this.tone(hero==='mage'?880:hero==='archer'?660:260,.07,.018,'triangle');}
 levelUp(){[523,659,784].forEach((f,i)=>this.tone(f,.28,.065,'triangle',i*.07));}
 boss(){[164,155,130].forEach((f,i)=>this.tone(f,.38,.075,'triangle',i*.18));}
 playCue(cue: CombatSound) {
  if (!this.canPlay(this.context)) return;
  const terminal = cue === 'defeat' || cue === 'victory';
  const now = this.context.currentTime;
  if (!terminal && now - (this.lastCues.get(cue) ?? -Infinity) < .07) return;
  this.lastCues.set(cue, now);
  if (terminal) this.stopVoices();
  const {tones, noise} = COMBAT_SOUNDS[cue];
  for (const [pitch, end, seconds, gain, wave, delay] of tones) this.tone(pitch, seconds, gain, wave, delay, end);
  if (noise) this.noise(...noise);
 }
 private async fetchSoundtrack(track: MusicTrack) {
  const response = await fetch(`${import.meta.env.BASE_URL}audio/everpath-${track}.m4a`);
  return response.ok ? response.arrayBuffer() : undefined;
 }
 private loadSoundtrack(track: MusicTrack) {
  const context = this.context;
  if (!context?.decodeAudioData || this.soundtrackLoading.has(track) || this.soundtracks[track]) return;
  this.soundtrackLoading.add(track);
  void (async () => {
   let data = track === 'battle' ? await this.battleDownload : undefined;
   if (track === 'battle') this.battleDownload = undefined;
   data ??= await this.fetchSoundtrack(track);
   if (!data) return;
   this.soundtracks[track] = await context.decodeAudioData(data);
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
  source.stop();
  this.musicSource = undefined;
 }
 syncMusic(status?: RunState['status'], finalBoss = false) {
  const level = status === 'running' ? 1 : status === 'upgrade' ? .3 : 0;
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
