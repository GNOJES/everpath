import { expect, it, vi } from 'vitest';
import { SAVE_KEY } from '../src/game/save';
import { openNativeSave } from '../src/platform/native-save';

const legacy = JSON.stringify({ version: 1, progressionEconomy: 2, gold: 137, invested: 24, upgrades: { attack: 1 }, history: [{ runId: 'previous', hero: 'mage', time: 105, level: 4, kills: 20, bosses: 0, gold: 42 }] });

function preferences(initial: string | null = null) {
 let value = initial;
 return {
  get: vi.fn(async () => ({ value })),
  set: vi.fn(async (entry: { key: string; value: string }) => { value = entry.value; }),
 };
}

it('copies the old payload once and prefers the native copy on all later launches', async () => {
 const prefs = preferences();
 const readLegacy = vi.fn(() => legacy);
 const first = await openNativeSave(prefs, readLegacy);
 expect(prefs.set).toHaveBeenCalledExactlyOnceWith({ key: SAVE_KEY, value: legacy });
 expect(first.data.gold).toBe(137);
 expect(first.data.upgrades.attack).toBe(1);
 expect(first.data.history[0]?.runId).toBe('previous');
 expect(first.purchase('hp')).toBe(true);
 await first.flush();
 const restarted = await openNativeSave(prefs, readLegacy);
 expect(restarted.data).toEqual(first.data);
 expect(restarted.data.gold).toBe(117);
 expect(readLegacy).toHaveBeenCalledTimes(1);
});

it('avoids overwriting an existing save when native reads fail', async () => {
 const prefs = preferences(legacy);
 prefs.get.mockRejectedValueOnce(new Error('bridge unavailable'));
 const readLegacy = vi.fn(() => null);
 await expect(openNativeSave(prefs, readLegacy)).rejects.toThrow('bridge unavailable');
 expect(prefs.set).not.toHaveBeenCalled();
 expect(readLegacy).not.toHaveBeenCalled();
});

it('retries a failed migration from the same legacy value', async () => {
 const prefs = preferences();
 prefs.set.mockRejectedValueOnce(new Error('disk unavailable'));
 const readLegacy = vi.fn(() => legacy);
 await expect(openNativeSave(prefs, readLegacy)).rejects.toThrow('disk unavailable');
 expect((await openNativeSave(prefs, readLegacy)).data.gold).toBe(137);
 expect(prefs.set).toHaveBeenCalledTimes(2);
});

it('serializes rapid writes, retains the newest snapshot and recovers after a rejected write', async () => {
 const prefs = preferences(legacy);
 let finish!: () => void;
 prefs.set.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
 const save = await openNativeSave(prefs, () => null);
 save.purchase('hp');
 save.purchase('speed');
 save.purchase('gold');
 expect(prefs.set).toHaveBeenCalledTimes(1);
 finish();
 await save.flush();
 expect(prefs.set).toHaveBeenCalledTimes(2);
 expect(JSON.parse((await prefs.get()).value!)).toEqual(save.data);
 prefs.set.mockRejectedValueOnce(new Error('write unavailable'));
 save.write();
 await save.flush();
 expect(save.persistent).toBe(false);
 save.write();
 await save.flush();
 expect(save.persistent).toBe(true);
});

it('restores the whole backup after pending writes and keeps the current save on failure', async () => {
 const prefs = preferences(legacy);
 const store = await openNativeSave(prefs, () => null);
 const backup = structuredClone(store.data);
 store.purchase('hp');
 const restoring = store.restore(backup);
 store.write(); // Android may pause while restoring.
 await restoring;
 expect((await openNativeSave(prefs, () => null)).data).toEqual(backup);
 prefs.set.mockRejectedValueOnce(new Error('disk unavailable'));
 await expect(store.restore({ ...backup, gold: 0 })).rejects.toThrow();
 expect(store.data).toEqual(backup);
 expect((await openNativeSave(prefs, () => null)).data).toEqual(backup);
});
