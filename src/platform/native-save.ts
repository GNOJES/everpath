import type { PreferencesPlugin } from '@capacitor/preferences';
import { parseSave, SAVE_KEY, SaveStore } from '../game/save';

type NativePreferences = Pick<PreferencesPlugin, 'get' | 'set'>;

class NativeSaveStore extends SaveStore {
 private restoring = false;
 private pending?: string;
 private writing?: Promise<void>;

 constructor(raw: string | null, private readonly preferences: NativePreferences) {
  super(undefined, parseSave(raw));
 }

 override write() {
  if (this.restoring) return;
  this.pending = JSON.stringify(this.data);
  this.startWriting();
 }

 private startWriting() {
  if (this.writing) return;
  this.writing = this.drain().finally(() => {
   this.writing = undefined;
   if (this.pending !== undefined) this.startWriting();
  });
 }

 private async drain() {
  while (this.pending !== undefined) {
   const value = this.pending;
   this.pending = undefined;
   try {
    await this.preferences.set({ key: SAVE_KEY, value });
    this.setPersistent(true);
   } catch {
    this.setPersistent(false);
   }
  }
 }

 override async restore(data: ReturnType<typeof parseSave>) {
  if (this.restoring) throw new Error('Restore in progress');
  this.restoring = true;
  try {
   await this.flush();
   await this.preferences.set({ key: SAVE_KEY, value: JSON.stringify(data) });
   this.data = data;
   this.setPersistent(true);
  } finally {
   this.restoring = false;
  }
 }

 async flush() {
  while (this.writing) await this.writing;
 }
}

export async function openNativeSave(preferences: NativePreferences, readLegacy: () => string | null) {
 const { value } = await preferences.get({ key: SAVE_KEY });
 if (value !== null) return new NativeSaveStore(value, preferences);

 const legacy = readLegacy();
 if (legacy !== null) await preferences.set({ key: SAVE_KEY, value: legacy });
 return new NativeSaveStore(legacy, preferences);
}
