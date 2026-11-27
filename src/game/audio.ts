import type { BattleMusic, CombatSound, HeroId, RunState, StrikeFeedback } from './types';
import { DEFAULT_SFX_VOLUME } from './config';
import { COMBAT_SOUNDS, MINI_WORLD_CUES, STORYBOOK_CUES } from './combat-sounds';

const volume=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
const battleTracks = { 1: 'battle', 2: 'reprise', 3: 'original' } as const;
type BattleTrack = typeof battleTracks[BattleMusic];
type MusicTrack = BattleTrack | 'warden';
export class GameAudio {
 private context?:AudioContext;private musicBus?:GainNode;private sfxBus?:GainNode;private musicGate?:GainNode;
 private soundtracks: Partial<Record<MusicTrack, AudioBuffer>> = {};
 private soundtrackLoading = new Set<MusicTrack>();
 private battleDownload?: { track: BattleTrack; data: Promise<ArrayBuffer | undefined> };
 private battleTrack: BattleTrack = 'battle';
 private track: MusicTrack = 'battle';
 private musicSource?: AudioBufferSourceNode;
 private trackGain?: GainNode;
 private outgoingTracks = new Set<{ source: AudioBufferSourceNode; gain: GainNode; timer: ReturnType<typeof setTimeout> }>();
 private fadeTimer?: ReturnType<typeof setTimeout>;
 private musicOffset = 0;
 private musicStarted = 0;
 private musicLevel = 0;
 private lastOpeningHit = -Infinity;
 private suspended = false;
 private musicVolume=1;private sfxVolume=DEFAULT_SFX_VOLUME;private lastFx=-Infinity;private lastAttack=-Infinity;
 private voices = new Set<AudioScheduledSourceNode>();
 private lastCues = new Map<CombatSound, number>();
 private noiseBuffer?: AudioBuffer;
 private readonly clickDownload?: Promise<ArrayBuffer | undefined>;
 private clickBuffer?: Promise<AudioBuffer | undefined>;
 constructor(clickUrl?: string, private readonly miniWorld = false) {
  if (clickUrl) this.clickDownload = fetch(clickUrl)
   .then(response => response.ok ? response.arrayBuffer() : undefined)
   .catch(() => undefined);
 }
 get music(){return this.musicVolume;}set music(v:number){this.musicVolume=volume(v);if(this.musicBus)this.musicBus.gain.setTargetAtTime(this.musicVolume,this.context!.currentTime,.015);}
 get sfx(){return this.sfxVolume;}set sfx(v:number){this.sfxVolume=volume(v);if(this.sfxBus)this.sfxBus.gain.setTargetAtTime(this.sfxVolume * 1.6,this.context!.currentTime,.015);}
 get bgm(): BattleMusic { return this.battleTrack === 'original' ? 3 : this.battleTrack === 'reprise' ? 2 : 1; }
 set bgm(value: BattleMusic) {
  const track = this.miniWorld ? battleTracks[value] : 'battle';
  if (track === this.battleTrack) return;
  this.battleTrack = track;
  if (this.track !== 'warden') {
   this.stopMusic();
   this.track = track;
   this.musicOffset = 0;
  }
  this.loadSoundtrack(track);
  this.startMusic();
 }
 preloadBattle() {
  const track = this.battleTrack;
  if (!this.soundtracks[track] && !this.soundtrackLoading.has(track) && this.battleDownload?.track !== track) {
   this.battleDownload = { track, data: this.fetchSoundtrack(track).catch(() => undefined) };
  }
 }
 beginRun(finalBoss = false) {
  this.stopMusic();
  this.track = finalBoss ? 'warden' : this.battleTrack;
  this.musicOffset = 0;
  this.musicLevel = 1;
  if (this.context && this.musicGate) {
   const now = this.context.currentTime;
   this.musicGate.gain.cancelScheduledValues(now);
   this.musicGate.gain.setValueAtTime(1, now);
  }
  this.loadSoundtrack(this.track);
  this.startMusic();
 }
 unlock(){try{
  this.suspended = false;
  if(!this.context){const c=this.context=new AudioContext();const master=c.createGain();master.gain.value=.9;const limiter=c.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=18;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.15;master.connect(limiter);limiter.connect(c.destination);
   this.musicBus=c.createGain();this.musicBus.gain.value=this.musicVolume;this.musicBus.connect(master);
   this.sfxBus=c.createGain();this.sfxBus.gain.value=this.sfxVolume * 1.6;this.sfxBus.connect(master);
   this.musicGate=c.createGain();this.musicGate.gain.value=this.musicLevel;this.musicGate.connect(this.musicBus);
 }void this.context.resume().then(()=>this.startMusic()).catch(()=>{});
  this.loadSoundtrack(this.battleTrack);
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
 click(kind: 'touch' | 'back' | 'confirm' = 'touch') {
  if (this.miniWorld) {
   this.noise(1340, .055, .095);
   this.tone(kind === 'back' ? 392 : 587, .105, .072, 'triangle');
   if (kind === 'confirm') this.tone(784, .16, .056, 'sine', .048);
   return;
  }
  const c = this.context;
  if (!this.clickDownload || !c) {
   this.tone(523, .09, .06, 'triangle');
   return;
  }
  this.clickBuffer ??= this.clickDownload.then(data => data ? c.decodeAudioData(data) : undefined).catch(() => undefined);
  void this.clickBuffer.then(buffer => {
   if (!this.canPlay(c) || this.voices.size >= 24) return;
   if (!buffer) {
    this.tone(523, .09, .06, 'triangle');
    return;
   }
   const source = c.createBufferSource();
   source.buffer = buffer;
   this.playVoice(c, source, c.currentTime, buffer.duration, .21);
  });
 }
 hit(){const now=performance.now();if(now-this.lastFx<85)return;this.lastFx=now;this.tone(215,.06,.025,'triangle');}
 hurt(){
  if (this.miniWorld) { this.noise(580, .12, .11); this.tone(190, .16, .086, 'triangle', 0, 81); return; }
  this.tone(98,.18,.1,'triangle');this.tone(73,.2,.04);
 }
 attack(hero:HeroId){
  const now=performance.now();if(now-this.lastAttack<140)return;this.lastAttack=now;
  if (!this.miniWorld) { this.tone(hero==='mage'?880:hero==='archer'?660:260,.07,.018,'triangle'); return; }
  if (hero === 'warrior') { this.noise(1770, .13, .09); this.tone(294, .12, .049, 'triangle', 0, 135); }
  if (hero === 'archer') { this.noise(3130, .08, .067); this.tone(414, .095, .063, 'triangle', 0, 243); }
  if (hero === 'mage') { this.tone(660, .13, .058, 'sine', 0, 840); this.tone(990, .16, .033, 'triangle', .024, 1320); }
 }
 levelUp(){
  const notes = this.miniWorld ? [587, 740, 880, 1175] : [523, 659, 784];
  notes.forEach((f,i)=>this.tone(f,.28,.065,this.miniWorld && i % 2 ? 'sine' : 'triangle',i*.07));
 }
 openingImpact(style: StrikeFeedback) {
  const context = this.context;
  if (!this.canPlay(context) || context.currentTime - this.lastOpeningHit < .075) return;
  this.lastOpeningHit = context.currentTime;
  if (style === 'parry') {
   this.tone(1175, .14, .073, 'triangle');
   this.tone(1680, .09, .04, 'sine', .02, 860);
  } else if (style === 'sword') {
   this.tone(218, .105, .075, 'triangle', 0, 94);
   this.noise(1230, .09, .075);
  } else if (style === 'magic') {
   this.tone(510, .16, .052, 'sine', 0, 805);
   this.tone(910, .14, .033, 'triangle', .023, 600);
  } else {
   this.noise(2620, .065, .06);
   this.tone(style === 'pierce' ? 640 : 420, .083, .042, 'triangle', 0, 240);
  }
 }
 openingTreasure() {
  this.tone(660, .17, .061, 'triangle');
  this.tone(1319, .22, .048, 'sine', .24);
 }
 boss(storybook = false) {
  const notes = storybook ? [196, 262, 220] : [164, 155, 130];
  notes.forEach((f, i) => this.tone(f, .38, .075, 'triangle', i * .18));
 }
 playCue(cue: CombatSound, storybook = false) {
  if (!this.canPlay(this.context)) return;
  const terminal = cue === 'defeat' || cue === 'victory';
  const now = this.context.currentTime;
  if (!terminal && now - (this.lastCues.get(cue) ?? -Infinity) < .07) return;
  this.lastCues.set(cue, now);
  if (terminal) this.stopVoices();
  const {tones, noise} = (this.miniWorld ? MINI_WORLD_CUES[cue] : undefined)
   ?? (storybook ? STORYBOOK_CUES[cue] : undefined) ?? COMBAT_SOUNDS[cue];
  for (const [pitch, end, seconds, gain, wave, delay] of tones) this.tone(pitch, seconds, gain, wave, delay, end);
  if (noise) this.noise(...noise);
 }
 private async fetchSoundtrack(track: MusicTrack) {
  const file = track === 'original' ? 'battle' : `${this.miniWorld ? 'mini-' : ''}${track}`;
  const response = await fetch(`${import.meta.env.BASE_URL}audio/everpath-${file}.m4a`);
  return response.ok ? response.arrayBuffer() : undefined;
 }
 private loadSoundtrack(track: MusicTrack) {
  const context = this.context;
  if (!context?.decodeAudioData || this.soundtrackLoading.has(track) || this.soundtracks[track]) return;
  this.soundtrackLoading.add(track);
  void (async () => {
   const download = this.battleDownload?.track === track ? this.battleDownload : undefined;
   if (download) this.battleDownload = undefined;
   let data = await download?.data;
   data ??= await this.fetchSoundtrack(track);
   if (!data) return;
   this.soundtracks[track] = await context.decodeAudioData(data);
   this.startMusic();
  })().catch(() => { /* Failed music downloads leave sound effects available. */ })
   .finally(() => this.soundtrackLoading.delete(track));
 }
 private clearFade() {
  for (const entry of this.outgoingTracks) {
   clearTimeout(entry.timer);
   try { entry.source.onended = () => { entry.source.disconnect(); entry.gain.disconnect(); }; entry.source.stop(); } catch {}
  }
  this.outgoingTracks.clear();
  this.fadeTimer = undefined;
 }
 private startMusic(fadeIn = false) {
  const context = this.context;
  const buffer = this.soundtracks[this.track];
  if (this.fadeTimer || this.suspended || !context || context.state !== 'running' || !buffer || this.musicSource || !this.musicLevel) return;
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  gain.connect(this.musicGate!);
  this.musicStarted = context.currentTime;
  if (fadeIn) {
   gain.gain.setValueAtTime(.001, this.musicStarted);
   gain.gain.linearRampToValueAtTime(1, this.musicStarted + .25);
  } else {
   gain.gain.setValueAtTime(1, this.musicStarted);
  }
  const offset = this.musicOffset % buffer.duration;
  source.start(this.musicStarted, offset);
  this.musicSource = source;
  this.trackGain = gain;
 }
 private stopMusic() {
  this.clearFade();
  const context = this.context, source = this.musicSource, gain = this.trackGain;
  if (!context || !source) return;
  this.musicOffset += Math.max(0, context.currentTime - this.musicStarted);
  source.onended = () => { source.disconnect(); gain?.disconnect(); };
  source.stop();
  this.musicSource = undefined;
  this.trackGain = undefined;
 }
 syncMusic(status?: RunState['status'], finalBoss = false) {
  const level = status === 'running' ? 1 : status === 'upgrade' ? .3 : 0;
  const desiredTrack = finalBoss ? 'warden' : this.battleTrack;
  if (this.track !== desiredTrack) {
   const context = this.context;
   if (desiredTrack === 'warden' && context && this.musicSource && this.trackGain && level > 0) {
    this.clearFade();
    const source = this.musicSource, gain = this.trackGain;
    this.musicSource = undefined;
    this.trackGain = undefined;
    this.track = desiredTrack;
    this.musicOffset = 0;
    const fadeSeconds = .85, now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value || 1, now);
    gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
    const entry = { source, gain, timer: undefined as unknown as ReturnType<typeof setTimeout> };
    entry.timer = setTimeout(() => {
     this.outgoingTracks.delete(entry);
     try { source.onended = () => { source.disconnect(); gain.disconnect(); }; source.stop(); } catch {}
     if (this.fadeTimer === entry.timer) this.fadeTimer = undefined;
     if (this.musicLevel > 0 && !this.suspended) this.startMusic(true);
    }, fadeSeconds * 1000);
    this.outgoingTracks.add(entry);
    this.fadeTimer = entry.timer;
   } else {
    this.stopMusic();
    this.track = desiredTrack;
    this.musicOffset = 0;
   }
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
