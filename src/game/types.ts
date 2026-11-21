export type HeroId = 'warrior' | 'archer' | 'mage';
export type EnemyKind = 'slime' | 'goblin' | 'bat' | 'skeleton' | 'brute' | 'shaman' | 'boss' | 'briar' | 'warden';
export type PermanentId = 'attack' | 'hp' | 'speed' | 'gold' | 'timeStop';
export type PassiveId = 'power' | 'haste' | 'vitality' | 'speed';
export interface Vec { x: number; y: number }
export interface SaveData { version: 1; progressionEconomy: 2; gold: number; history: RunResult[]; invested: number; upgradePayments?: Record<PermanentId, number[]>; clears: Record<HeroId, number>; challengeUnlocked: number; upgrades: Record<PermanentId, number>; bestTime: number; bestKills: number; totalRuns: number; lastHero: HeroId; settings: { music: number; sfx: number }; settledRuns: string[] }
export interface CombatRecord { spawned: number; killed: number; missed: number; escaped: number; withdrawn: number; remaining: number; killRate: number; missRate: number }
export interface RunResult { runId: string; hero: HeroId; time: number; level: number; kills: number; bosses: number; gold: number; cleared?: boolean; outcome?: 'victory' | 'defeat' | 'abandoned'; rank?: number; combat?: CombatRecord }
export interface Upgrade { id: string; name: string; subtitle: string; description: string; icon: string; level: number; max: number; color: string }
export interface Player extends Vec { hp: number; maxHp: number; speed: number; invincible: number; shield: number; facing: number }
export interface Enemy extends Vec { id: number; kind: EnemyKind; hp: number; maxHp: number; speed: number; damage: number; radius: number; elite: boolean; timer: number; phase: 'chase' | 'warn' | 'dash' | 'recover'; aim: Vec; hitFlash: number; seed: number; entryTarget?: Vec; rewardScale?: number; paired?: boolean; middleWave?: number; reinforcement?: boolean; wardenAttack?: number; slowedUntil?: number }
export type SkillShot = 'blade' | 'volley' | 'pierce' | 'blast';
export type SkillId = 'whirl' | 'blade' | 'shield' | 'bash' | 'lunge' | 'quake' | 'sunder'
 | 'multishot' | 'pierce' | 'rain' | 'snare' | 'ricochet' | 'blastArrow' | 'deadeye'
 | 'chain' | 'fire' | 'frost' | 'meteor' | 'gravity' | 'prism' | 'runeCross';
export type CombatSound = SkillId | 'shieldBlock' | 'rainImpact' | 'blastImpact' | 'timeStop'
 | 'grormWarn' | 'grormVolley' | 'grormDash' | 'grormSlam' | 'grormDefeat'
 | 'briarWarn' | 'briarImpact' | 'wardenRoots' | 'wardenAim' | 'wardenFan' | 'wardenRing' | 'wardenSlam' | 'defeat' | 'victory';
export type SkillEffect = 'whirl' | 'guard' | 'snare' | 'meteor' | 'frost' | 'lance' | 'quake' | 'sunder' | 'ricochet' | 'blast' | 'deadeye' | 'gravity' | 'prism' | 'runeCross';
export interface Projectile extends Vec { id: number; vx: number; vy: number; radius: number; damage: number; life: number; kind: 'arrow' | 'magic' | 'blade' | 'enemy'; pierce: number; hit: Set<number>; target?: number; pierceScale?: number; skillShot?: SkillShot; blastRadius?: number }
export interface Effect extends Vec { id: number; kind: SkillEffect | 'slash' | 'crystal' | 'ring' | 'fire' | 'lightning' | 'hit' | 'death' | 'boss-death' | 'heal' | 'text'; color: number; life: number; duration: number; radius: number; angle: number; halfAngle?: number; x2?: number; y2?: number; text?: string }
export interface Hazard extends Vec { id: number; radius: number; delay: number; life: number; damage: number; owner: 'enemy' | 'player'; kind: 'rain' | 'slam'; fired: boolean; windup?: number; impactSound?: CombatSound }
export interface Pickup { x: number; groundY: number; kind: 'coin' | 'heal' | 'chest'; gold: number }
export interface RunState { runId: string; hero: HeroId; status: 'running' | 'paused' | 'upgrade' | 'gameover' | 'victory'; elapsed: number; rank: number; evolved: boolean; finalSpawned: boolean; timeStopCharges: number; timeStopRemaining: number; pickups: Pickup[]; scroll: number; player: Player; enemies: Enemy[]; projectiles: Projectile[]; effects: Effect[]; hazards: Hazard[]; level: number; xp: number; xpNext: number; kills: number; spawned: number; escaped: number; withdrawn: number; bosses: number; gold: number; weaponLevel: number; skills: Record<string, number>; passives: Record<PassiveId, number>; choices: Upgrade[]; nextBoss: number }
export interface HeroConfig { id: HeroId; name: string; title: string; role: string; description: string; weapon: string; upgradeDescription: string; icon: string; color: string; hp: number; speed: number; damage: number; basicDamageScale: number; cooldown: number; range: number; projectileSpeed: number; skills: SkillId[]; bars: [number, number, number] }
export interface SkillConfig { name: string; subtitle: string; description: string; icon: string; color: string; cooldown: number; damage: number; radius: number; count: number; hastePerLevel?: number; radiusPerLevel?: number; unlockLevel?: number }
