import { describe, it, expect } from 'vitest';
import { SaveStore, parseSave } from '../src/game/save';

class MemoryStorage { data = new Map<string, string>(); getItem(k: string) { return this.data.get(k) ?? null; } setItem(k: string, v: string) { this.data.set(k, v); } }
describe('persistent progression', () => {
 it('recovers corrupt, future and malformed saves without accepting invalid currency', () => {
  expect(parseSave('{oops').gold).toBe(0);
  expect(parseSave(JSON.stringify({ version: 999, gold: 100 })).gold).toBe(0);
  const save = parseSave(JSON.stringify({ version: 1, gold: -20, upgrades: { attack: 999, hp: -2 }, lastHero: 'hacker', settings: { music: 5, sfx: -1 } }));
  expect(save.gold).toBe(0); expect(save.upgrades.attack).toBe(20); expect(save.upgrades.hp).toBe(0); expect(save.lastHero).toBe('warrior'); expect(save.settings.music).toBe(1); expect(save.settings.sfx).toBe(0);
 });
 it('settles each run exactly once, including after reload', () => {
  const storage = new MemoryStorage(); const store = new SaveStore(storage);
  const result = { runId: 'run-1', hero: 'warrior' as const, time: 82, level: 4, kills: 23, bosses: 0, gold: 27 };
  expect(store.settle(result)).toBe(true); expect(store.settle(result)).toBe(false);
  const next = new SaveStore(storage); expect(next.settle(result)).toBe(false); expect(next.data.gold).toBe(27); expect(next.data.bestTime).toBe(82);
 });
 it('charges purchases once and persists levels, rejects unaffordable and capped upgrades', () => {
  const store = new SaveStore(new MemoryStorage()); store.data.gold = 100;
  expect(store.purchase('attack')).toBe(true); expect(store.data.gold).toBe(76); expect(store.data.upgrades.attack).toBe(1);
  store.data.gold = 0; expect(store.purchase('hp')).toBe(false);
  store.data.gold = 9999; store.data.upgrades.attack = 20; expect(store.purchase('attack')).toBe(false);
 });
 it('continues in memory when storage is denied', () => {
  const store = new SaveStore({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } });
  store.data.gold = 30; expect(store.purchase('hp')).toBe(true); expect(store.data.upgrades.hp).toBe(1); expect(store.persistent).toBe(false);
 });
});

it('reallocates one rank at a time without creating gold across saves', () => {
 const disk = new MemoryStorage();
 disk.setItem('everpath.save.v1', JSON.stringify({
  version: 1, gold: 100, upgrades: { attack: 2, hp: 1 }, bestTime: 123, settledRuns: ['legacy-run'],
 }));
 let store = new SaveStore(disk);
 const worth = store.data.gold + store.data.invested;
 expect(store.data.upgradePayments).toBeUndefined();
 const refund = store.upgradeRefund('attack');
 expect(refund).toBeGreaterThan(0);
 expect(store.downgrade('attack')).toBe(true);
 expect(store.data.gold).toBe(100 + refund);
 expect(store.data.upgrades).toEqual({ attack: 3, hp: 2, speed: 0, gold: 0, timeStop: 0 });
 expect(store.purchase('speed')).toBe(true);
 store = new SaveStore(disk);
 expect(store.upgradeRefund('speed')).toBe(24);
 expect(store.downgrade('speed')).toBe(true);
 expect(store.downgrade('speed')).toBe(false);
 while (store.downgrade('attack')) {}
 while (store.downgrade('hp')) {}
 expect(store.data.gold).toBe(worth);
 expect(store.data.invested).toBe(0);
 expect(store.data.bestTime).toBe(123);
 expect(store.data.settledRuns).toEqual(['legacy-run']);
});

it('defaults both volume channels to 100% and keeps saved volume choices', () => {
 expect(parseSave(null).settings).toEqual({music:1,sfx:1});
 const saved = JSON.stringify({version:1,settings:{music:0,sfx:.25}});
 expect(parseSave(saved).settings).toEqual({music:0,sfx:.25});
});
