import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';

export interface NativeShell {
 suspendForNative(): void;
 handleNativeBack(): boolean;
 resumeForNative?(): void;
}
export interface NativeEvents {
 addListener(name: 'pause' | 'resume', listener: () => void): Promise<PluginListenerHandle>;
 addListener(name: 'appStateChange', listener: (state: { isActive: boolean }) => void): Promise<PluginListenerHandle>;
 addListener(name: 'backButton', listener: () => void): Promise<PluginListenerHandle>;
 minimizeApp(): Promise<void>;
}
export async function connectNativeApp(shell: NativeShell, events: NativeEvents = NativeApp, native = Capacitor.isNativePlatform()) {
 const handles: PluginListenerHandle[] = [];
 const cleanup = async () => { await Promise.all(handles.splice(0).map(handle => handle.remove())); };
 if (!native) return cleanup;
 try {
  handles.push(await events.addListener('pause', () => shell.suspendForNative()));
  handles.push(await events.addListener('resume', () => shell.resumeForNative?.()));
  handles.push(await events.addListener('appStateChange', state => { if (!state.isActive) shell.suspendForNative(); else shell.resumeForNative?.(); }));
  handles.push(await events.addListener('backButton', () => {
   if (!shell.handleNativeBack()) void events.minimizeApp().catch(error => console.warn('Could not minimize native app', error));
  }));
 } catch (error) { await cleanup(); throw error; }
 return cleanup;
}
