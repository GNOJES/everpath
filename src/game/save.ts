import { BALANCE, HEROES } from './config';
import { clamp } from './math';
import type { SaveData, PermanentId, RunResult } from './types';
export const SAVE_KEY = 'everpath.save.v1';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
const number = (value: unknown, max = 1e9, decimal = false) => typeof value === 'number' && Number.isFinite(value) ? (decimal ? clamp(value, 0, max) : Math.floor(clamp(value, 0, max))) : 0;
function cleanResult(value: unknown): RunResult | undefined {
 if (!value || typeof value !== 'object') return;
 const r = value as Record<string, unknown>;
 if (typeof r.runId !== 'string' || !r.runId.length || r.runId.length >= 160 || typeof r.hero !== 'string' || !Object.hasOwn(HEROES, r.hero) || typeof r.time !== 'number' || !Number.isFinite(r.time) || r.time < 0) return;
 const result: RunResult = { runId: r.runId, hero: r.hero as RunResult['hero'], time: number(r.time, 1e8, true), level: number(r.level, 10000), kills: number(r.kills), bosses: number(r.bosses), gold: number(r.gold), cleared: r.cleared === true, outcome: r.outcome === 'victory' || r.outcome === 'defeat' || r.outcome === 'abandoned' ? r.outcome : undefined, rank: number(r.rank, 3) };
 if (r.combat && typeof r.combat === 'object') {
  const c = r.combat as Record<string, unknown>, keys = ['spawned', 'killed', 'missed', 'escaped', 'withdrawn', 'remaining'] as const;
  if (keys.every(k => typeof c[k] === 'number' && Number.isSafeInteger(c[k]) && (c[k] as number) >= 0 && (c[k] as number) <= 1e9)) {
   const values = Object.fromEntries(keys.map(k => [k, c[k]])) as unknown as NonNullable<RunResult['combat']>;
   if (values.killed === result.kills && values.spawned === values.killed + values.missed && values.missed === values.escaped + values.withdrawn + values.remaining) result.combat = { ...values, killRate: values.spawned ? values.killed / values.spawned * 100 : 0, missRate: values.spawned ? values.missed / values.spawned * 100 : 0 };
  }
 }
 return result;
}
export function parseSave(raw: string | null): SaveData {
 const defaults: SaveData = { version: 1, progressionEconomy: 2, gold: 0, history: [], invested: 0, clears: { warrior: 0, archer: 0, mage: 0 }, challengeUnlocked: 0, upgrades: { attack: 0, hp: 0, speed: 0, gold: 0 }, bestTime: 0, bestKills: 0, totalRuns: 0, lastHero: 'warrior', settings: { music: .55, sfx: .75 }, settledRuns: [] };
 try {
  const data = raw ? JSON.parse(raw) : null; if (!data || data.version !== 1) return defaults;
  if (Array.isArray(data.history)) defaults.history = data.history.slice(-20).map(cleanResult).filter((r: RunResult | undefined): r is RunResult => !!r);
  defaults.gold = number(data.gold); defaults.bestTime = number(data.bestTime, 1e8, true); defaults.bestKills = number(data.bestKills); defaults.totalRuns = number(data.totalRuns);
  for (const key of Object.keys(defaults.upgrades) as PermanentId[]) defaults.upgrades[key] = number(data.upgrades?.[key], data.progressionEconomy === 2 ? BALANCE.permanentMax : 10);
  defaults.invested = typeof data.invested === 'number' ? number(data.invested) : Object.values(defaults.upgrades).reduce((sum, level) => sum + Array.from({ length: level }, (_, i) => Math.floor(12 * 1.65 ** i)).reduce((a, b) => a + b, 0), 0);
  if (data.progressionEconomy !== 2) for (const key of Object.keys(defaults.upgrades) as PermanentId[]) defaults.upgrades[key] *= 2;
  for (const hero of ['warrior', 'archer', 'mage'] as const) defaults.clears[hero] = number(data.clears?.[hero]);
  defaults.challengeUnlocked = number(data.challengeUnlocked, 3);
  if (typeof data.lastHero === 'string' && Object.hasOwn(HEROES, data.lastHero)) defaults.lastHero = data.lastHero;
  for (const key of ['music', 'sfx'] as const) if (typeof data.settings?.[key] === 'number') defaults.settings[key] = number(data.settings[key], 1, true);
  if (Array.isArray(data.settledRuns)) defaults.settledRuns = data.settledRuns.filter((x: unknown) => typeof x === 'string' && x.length < 160).slice(-128);
 } catch { /* A corrupt save must never prevent boot. */ }
 return defaults;
}
export const upgradeCost = (level: number) => Math.floor(BALANCE.baseCost + 12 * level + 3 * level * level);
export class SaveStore {
 data: SaveData; persistent = true;
 onPersistenceChange?: () => void;
 constructor(private storage?: StorageLike, loadedData?: SaveData) {
  if (loadedData) { this.data = loadedData; return; }
  try { this.storage ??= window.localStorage; this.data = parseSave(this.storage.getItem(SAVE_KEY)); }
  catch { this.data = parseSave(null); this.persistent = false; }
 }
 protected setPersistent(value: boolean) {
  if (this.persistent === value) return;
  this.persistent = value;
  this.onPersistenceChange?.();
 }
 write() { try { if (!this.storage) throw new Error('Storage unavailable'); this.storage.setItem(SAVE_KEY, JSON.stringify(this.data)); this.setPersistent(true); } catch { this.setPersistent(false); } }
 async restore(data: SaveData) {
  if (!this.storage) throw new Error('Storage unavailable');
  this.storage.setItem(SAVE_KEY, JSON.stringify(data));
  this.data = data;
  this.setPersistent(true);
 }
 purchase(key: PermanentId): boolean {
  const level = this.data.upgrades[key], cost = upgradeCost(level); if (level >= BALANCE.permanentMax || this.data.gold < cost) return false;
  this.data.gold -= cost; this.data.invested += cost; this.data.upgrades[key]++; this.write(); return true;
 }
 refundUpgrades(): number {
  const refund = this.data.invested; this.data.gold = Math.min(1e9, this.data.gold + refund); this.data.invested = 0;
  this.data.upgrades = { attack: 0, hp: 0, speed: 0, gold: 0 }; this.write(); return refund;
 }
 settle(result: RunResult): boolean {
  if (this.data.settledRuns.includes(result.runId)) return false;
  this.data.gold = Math.min(1e9, this.data.gold + number(result.gold)); this.data.bestTime = Math.max(this.data.bestTime, result.time); this.data.bestKills = Math.max(this.data.bestKills, result.kills); this.data.totalRuns++;
  if (result.cleared && Object.hasOwn(this.data.clears, result.hero)) { this.data.clears[result.hero]++; this.data.challengeUnlocked = Math.max(this.data.challengeUnlocked, Math.min(3, number(result.rank, 3) + 1)); }
  const record = cleanResult(result); if (record) { this.data.history.push(record); this.data.history = this.data.history.slice(-20); }
  this.data.settledRuns.push(result.runId); this.data.settledRuns = this.data.settledRuns.slice(-128); this.write(); return true;
 }
}
