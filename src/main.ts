import './style.css';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { SAVE_KEY } from './game/save';
import { App } from './ui/app';
import { connectNativeApp } from './platform/native';
import { openNativeSave } from './platform/native-save';

const root = document.querySelector<HTMLElement>('#app')!;

async function boot() {
 let store;
 if (Capacitor.isNativePlatform()) {
  root.innerHTML = '<p class="save-startup" role="status">원정 기록을 불러오는 중입니다.</p>';
  try {
   store = await openNativeSave(Preferences, () => window.localStorage.getItem(SAVE_KEY));
  } catch (error) {
   console.warn('Native save unavailable', error);
   root.innerHTML = '<div class="save-startup"><p role="alert">저장 데이터를 불러오지 못했습니다.</p><button class="button secondary" type="button">다시 시도</button></div>';
   root.querySelector('button')?.addEventListener('click', () => { void boot(); }, { once: true });
   return;
  }
 }
 const app = new App(root, store);
 const nativeLifecycle = connectNativeApp(app).catch(error => { console.warn('Native lifecycle unavailable', error); return async () => {}; });
 if (import.meta.hot) import.meta.hot.dispose(() => { void nativeLifecycle.then(cleanup => cleanup()); });
}

void boot();
