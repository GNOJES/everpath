import { backupLimit, decodeBackup, encodeBackup } from '../game/backup';
import { exportBackupFile } from '../platform/backup-file';
import type { SaveData } from '../game/types';
import Phaser from 'phaser';
import { ForestScene } from '../game/scene';
import { SaveStore, upgradeCost } from '../game/save';
import { GameSimulation } from '../game/simulation';
import { HEROES, SKILLS, PERMANENT, WORLD, permanentLimit, EVOLUTIONS, CAMPAIGN } from '../game/config';
import { portrait } from '../game/art';
import { formatTime } from '../game/math';
import { icon } from './icons';
import { DiagnosticsMonitor } from '../diagnostics/monitor';
import { exportDiagnosticLog } from '../diagnostics/export';
import type { HeroId, PermanentId, RunState, RunResult } from '../game/types';

type Screen = 'title' | 'select' | 'run' | 'result' | 'shop' | 'settings' | 'diagnostics' | 'history';
export class App {
 private backupMessage = '';
 private backupBusy = false;
 private pendingBackup?: SaveData;
 private historyPage = 0;
 private historyReturn: Screen = 'settings';
 private rank = 0; private refundConfirm = false;
 private diagnostics = new DiagnosticsMonitor(); private diagnosticReturn: Screen = 'settings'; private diagnosticExporting = false; private diagnosticMessage = '';
 private scene = new ForestScene(); private game: Phaser.Game;
 private screen: Screen = 'title'; private hero: HeroId; private sim?: GameSimulation;
 private root: HTMLElement; private overlay: HTMLElement; private hud: HTMLElement; private previousStatus = ''; private lastHud = 0;
 private settingsReturn: Screen = 'title'; private shopReturn: Screen = 'title'; private lastResult?: RunResult; private newRecord = false;
 constructor(element: HTMLElement, private readonly store = new SaveStore()) {
  this.hero = store.data.lastHero;
  this.root = element;
  element.innerHTML = `<div class="shell"><header class="site-header"><a class="brand" href="/" aria-label="EVERPATH 타이틀">EVERPATH</a><button class="icon-button" data-action="sound" aria-label="효과음 켜기 / 끄기">${icon('sound')}</button></header>
  <main class="expedition-layout"><aside class="journal left-journal"><section class="records"><div class="section-label">${icon('trophy')} 원정 기록</div><div class="record-row"><span>최고 생존</span><strong id="best-time">00:00</strong></div><div class="record-row"><span>최고 처치</span><strong id="best-kills">0 <small>마리</small></strong></div><div class="record-row"><span>완료한 원정</span><strong id="total-runs">0 <small>회</small></strong></div></section></aside>
  <section class="game-column" aria-label="EVERPATH 게임"><div id="hud" class="hud hidden"></div><div id="diagnostics-hud" class="diagnostics-hud hidden"></div><div class="game-frame"><div id="game-canvas"></div><div id="time-stop-fx" class="time-stop-fx" hidden><span>시간 정지</span></div><button type="button" class="time-stop-button" data-action="time-stop" aria-label="시간의 회중시계 · 0회 남음" hidden>${icon('watch')}<b>0</b></button><div id="overlay" class="overlay"></div><p id="save-warning" role="alert" hidden>저장하지 못했습니다. <button type="button" data-action="save-retry">다시 저장</button></p></div></section>
  <aside class="journal right-journal"><div class="section-label">${icon('compass')} 조작</div><p>이동 · WASD / 방향키 / 드래그</p><p>일시정지 · ESC</p><p>공격은 자동으로 진행됩니다.</p></aside></main>
  <footer class="site-footer"><span id="save-status">이 기기에 자동 저장</span></footer></div>`;
  store.onPersistenceChange = () => this.syncSaveStatus();
  this.overlay = element.querySelector('#overlay')!; this.hud = element.querySelector('#hud')!;
  element.addEventListener('click', event => this.onClick(event));
  element.addEventListener('change', event => {
   const input = event.target as HTMLInputElement;
   if (input.id === 'backup-file' && input.files?.[0]) void this.readBackup(input.files[0]);
  });
  element.addEventListener('input', event => this.onSlider(event));
  window.addEventListener('blur', () => this.autoPause()); window.addEventListener('resize', () => this.autoPause()); document.addEventListener('visibilitychange', () => { if (document.hidden) this.autoPause(); });
  this.scene.onReady = () => { this.render(); this.syncRecords(); };
  this.scene.onPause = () => this.togglePause(); this.scene.onFrame = (state, victoryFxTime) => this.onFrame(state, victoryFxTime);
  this.scene.onInputObservation = event => this.diagnostics.observeInput(event); this.scene.onInputFrame = at => this.diagnostics.consumeInput(at); this.diagnostics.onChange = () => this.updateDiagnostics();
  this.game = new Phaser.Game({ type: Phaser.AUTO, parent: 'game-canvas', width: WORLD.width, height: WORLD.height, backgroundColor: '#233d2e', pixelArt: true, roundPixels: true, antialias: false, scene: this.scene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { pixelArt: true, antialias: false, roundPixels: true }, audio: { noAudio: true }, banner: false });
  this.scene.audio.music = this.store.data.settings.music; this.scene.audio.sfx = this.store.data.settings.sfx;
  window.addEventListener('pagehide', () => this.store.write());
  // Kept as an owned field so lifecycle is explicit when embedding this app later.
  void this.game;
 }
 private onClick(event: MouseEvent) {
  if (this.backupBusy) return;
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-action]'); if (!button || button.disabled) return;
  this.scene.audio.unlock(); this.scene.audio.click(); const action = button.dataset.action!;
  if (action === 'embark') { this.screen = 'select'; this.render(); }
  else if (action === 'hero') { const id = button.dataset.hero as HeroId; if (!Object.hasOwn(HEROES, id)) return; this.hero = id; this.store.data.lastHero = id; this.store.write(); this.render(); }
  else if (action === 'start') this.startRun();
  else if (action === 'retry') {
   this.sim = undefined;
   this.scene.setRun();
   this.screen = 'select';
   this.render();
  }
  else if (action === 'title') { if (this.sim && this.sim.state.status !== 'gameover') this.store.settle(this.sim.result()); this.sim = undefined; this.scene.setRun(); this.screen = 'title'; this.render(); }
  else if (action === 'time-stop' && this.sim?.activateTimeStop()) this.updateTimeStop(this.sim.state);
  else if (action === 'pause' || action === 'resume') this.togglePause();
  else if (action === 'upgrade') { if (this.sim?.chooseUpgrade(button.dataset.id!)) { this.scene.controls.reset(); this.previousStatus = ''; this.render(); } }
  else if (action === 'history') { this.historyReturn = this.screen; this.historyPage = 0; this.screen = 'history'; this.render(); }
  else if (action === 'history-page') { this.historyPage += Number(button.dataset.direction); this.render(); }
  else if (action === 'history-back') { this.screen = this.historyReturn; this.render(); }
  else if (action === 'shop') { this.shopReturn = this.screen === 'result' ? 'result' : 'title'; this.screen = 'shop'; this.render(); }
  else if (action === 'shop-back') { this.screen = this.shopReturn; this.render(); }
  else if (action === 'rank') { this.rank = Math.min(this.store.data.challengeUnlocked, Number(button.dataset.rank) || 0); this.render(); }
  else if (action === 'refund-preview') { this.refundConfirm = true; this.render(); }
  else if (action === 'refund-cancel') { this.refundConfirm = false; this.render(); }
  else if (action === 'refund-confirm') { this.store.refundUpgrades(); this.refundConfirm = false; this.render(); }
  else if (action === 'buy' || action === 'downgrade') {
   const id = button.dataset.id as PermanentId;
   const changed = action === 'buy' ? this.store.purchase(id) : this.store.downgrade(id);
   if (changed) {
    this.render();
    if (event.detail === 0) {
     const control = this.overlay.querySelector<HTMLButtonElement>(`[data-action="${action}"][data-id="${id}"]`);
     (control?.disabled ? this.overlay.querySelector<HTMLButtonElement>(`[data-action="${action === 'buy' ? 'downgrade' : 'buy'}"][data-id="${id}"]`) : control)?.focus();
    }
   }
  }
  else if (action === 'settings') { this.settingsReturn = this.screen; this.pendingBackup = undefined; this.backupMessage = ''; this.screen = 'settings'; this.render(); }
  else if (action === 'backup-export') void this.backupAction(async () => exportBackupFile(encodeBackup(this.store.data)));
  else if (action === 'backup-select') this.overlay.querySelector<HTMLInputElement>('#backup-file')?.click();
  else if (action === 'backup-cancel') { this.pendingBackup = undefined; this.backupMessage = '복원을 취소했습니다.'; this.render(); }
  else if (action === 'backup-restore' && this.pendingBackup) void this.applyBackup(this.pendingBackup);
  else if (action === 'diagnostics') { this.diagnosticReturn = this.screen; this.autoPause(); this.screen = 'diagnostics'; this.render(); }
  else if (action === 'diagnostics-back') { this.screen = this.diagnosticReturn; this.render(); }
  else if (action === 'diagnostics-toggle') { this.diagnostics.setEnabled(!this.diagnostics.enabled); this.render(); }
  else if (action === 'diagnostics-new') { this.diagnostics.newSession(); this.diagnosticMessage = '새 기록을 시작했습니다. 이전 메모리 기록은 초기화했습니다.'; this.render(); }
  else if (action === 'diagnostics-export') { void this.exportDiagnostics(); }
  else if (action === 'settings-back') { this.screen = this.settingsReturn; this.render(); }
  else if (action === 'save-retry') this.store.write();
  else if (action === 'sound') { this.store.data.settings.sfx = this.store.data.settings.sfx ? 0 : .5; this.scene.audio.sfx = this.store.data.settings.sfx; this.store.write(); this.syncSound(); }
  this.syncRecords();
 }
 private onSlider(event: Event) { if ((event.target as HTMLElement).id === 'diagnostics-note') { this.diagnostics.note = (event.target as HTMLTextAreaElement).value.slice(0, 200); return; } const input = event.target as HTMLInputElement; const key = input.dataset.volume as 'music' | 'sfx' | undefined; if (!key) return; this.scene.audio.unlock(); const value = Number(input.value) / 100; this.store.data.settings[key] = value; this.scene.audio[key] = value; this.store.write(); const label = this.overlay.querySelector(`#volume-${key}`); if (label) label.textContent = `${input.value}%`; this.syncSound(); }
 private startRun() {
  this.store.data.lastHero = this.hero; this.store.write(); this.sim = new GameSimulation(this.hero, this.store.data, Math.random, this.rank); this.scene.setRun(this.sim); this.screen = 'run'; this.previousStatus = 'running'; this.render();
 }
 suspendForNative() { this.diagnostics.setForeground(false, 'native'); this.autoPause(); this.store.write(); this.scene.audio.suspend(); }
 resumeForNative() { this.diagnostics.setForeground(true, 'native'); if (!this.store.persistent) this.store.write(); }
 handleNativeBack(): boolean {
  if (this.backupBusy) return true;
  this.scene.controls?.reset();
  if (this.screen === 'title') return false;
  if (this.screen === 'run') {
   if (this.sim?.state.status === 'paused') this.scene.audio.unlock();
   this.togglePause(); // A mandatory level choice remains open; it cannot be skipped.
   return true;
  }
  if (this.screen === 'history') this.screen = this.historyReturn;
  else if (this.screen === 'diagnostics') this.screen = this.diagnosticReturn;
  else if (this.screen === 'settings') this.screen = this.settingsReturn;
  else if (this.screen === 'shop') this.screen = this.shopReturn;
  else { this.sim = undefined; this.scene.setRun(); this.screen = 'title'; }
  this.render(); this.syncRecords(); return true;
 }
 private autoPause() { this.scene.controls?.reset(); if (this.screen === 'run' && this.sim?.state.status === 'running') { this.sim.pause(); this.render(); } }
 private togglePause() {
  if (this.screen !== 'run' || !this.sim) return; const status = this.sim.state.status; if (status === 'running') this.sim.pause(); else if (status === 'paused') this.sim.resume(); else return; this.scene.controls.reset(); this.previousStatus = this.sim.state.status; this.render();
 }
 private syncDiagnosticContext(state = this.sim?.state) {
  if (this.diagnostics.enabled) this.diagnostics.setContext({ screen: this.screen, running: this.screen === 'run' && state?.status === 'running', hero: state?.hero, runId: state?.runId, elapsed: state?.elapsed, level: state?.level, hp: state?.player.hp, enemies: state?.enemies.length ?? 0, projectiles: state?.projectiles.length ?? 0, effects: state?.effects.length ?? 0, input: this.scene.controls?.snapshot() });
 }
 private onFrame(state?: RunState, victoryFxTime = 0) {
  this.syncDiagnosticContext(state);
  if (!state || this.screen !== 'run') return;
  if (state.status !== this.previousStatus) {
   this.previousStatus = state.status; this.scene.controls.reset();
   if (state.status === 'gameover' || state.status === 'victory') {
    if (state.status === 'gameover') { this.scene.audio.defeat(); this.screen = 'result'; }
    this.lastResult = this.sim!.result();
    this.newRecord = state.elapsed > this.store.data.bestTime;
    this.store.settle(this.lastResult);
    this.syncRecords();
   }
   if (state.status === 'upgrade') this.scene.audio.levelUp();
   if (state.status !== 'victory') this.render();
  }
  if (state.status === 'victory' && victoryFxTime >= 1.05) { this.screen = 'result'; this.render(); return; }
  if (performance.now() - this.lastHud > 70) { this.lastHud = performance.now(); this.updateHud(state); }
 }
 private syncSound() { const button = this.root.querySelector('[data-action="sound"]'); if (button) button.innerHTML = icon(this.store.data.settings.sfx ? 'sound' : 'mute'); }
 private syncRecords() {
  const s = this.store.data; this.root.querySelector('#best-time')!.textContent = formatTime(s.bestTime); this.root.querySelector('#best-kills')!.innerHTML = `${s.bestKills} <small>마리</small>`; this.root.querySelector('#total-runs')!.innerHTML = `${s.totalRuns} <small>회</small>`;
  this.syncSaveStatus(); this.syncSound();
 }
 private syncSaveStatus() {
  const available = this.store.persistent;
  this.root.querySelector('#save-status')!.textContent = available ? '이 기기에 자동 저장' : '변경 사항을 저장하지 못했습니다';
  const warning = this.root.querySelector<HTMLElement>('#save-warning')!;
  warning.hidden = available;
 }
 private topbar(title: string, action: string) { return `<div class="modal-topbar"><button class="icon-button" data-action="${action}" aria-label="뒤로">${icon('back')}</button><span>${title}</span><span class="purse">${icon('coin')} ${this.store.data.gold}</span></div>`; }
 private render() {
  if (this.sim?.state.status !== 'running') this.scene.audio.tick(0, false);
  this.syncDiagnosticContext();
  this.hud.classList.toggle('hidden', this.screen !== 'run'); this.overlay.className = `overlay screen-${this.screen}`;
  if (this.screen === 'title') this.renderTitle(); else if (this.screen === 'select') this.renderSelect(); else if (this.screen === 'shop') this.renderShop(); else if (this.screen === 'settings') this.renderSettings(); else if (this.screen === 'diagnostics') this.renderDiagnostics(); else if (this.screen === 'history') this.renderHistory(); else if (this.screen === 'result') this.renderResult(); else this.renderRun();
  this.updateTimeStop(this.sim?.state);
  this.updateDiagnostics();
 }
 private renderTitle() {
  this.overlay.innerHTML = `<div class="title-screen"><div class="title-logo"><h1>EVERPATH</h1><div class="title-subtitle">푸른 숲 원정</div></div><div class="title-actions"><button class="button primary embark-button" data-action="embark">${icon('compass')}<span>모험 시작</span>${icon('right')}</button><div class="secondary-actions"><button class="button secondary" data-action="shop">${icon('leaf')} 영구 강화 <span class="mini-coin">${this.store.data.gold}</span></button><button class="button secondary settings-button" data-action="settings" aria-label="설정">${icon('settings')}</button></div><p class="title-footnote">10분 동안 생존하고 모르바를 처치하세요.</p></div></div>`;
 }
 private renderSelect() {
  const selected = HEROES[this.hero];
  this.overlay.innerHTML = `<div class="menu-panel">${this.topbar('영웅 선택', 'title')}<div class="menu-heading"><h2>누구와 떠날까요?</h2></div><div class="hero-cards">${Object.values(HEROES).map(h => `<button class="hero-card ${this.hero === h.id ? 'selected' : ''}" data-action="hero" data-hero="${h.id}" aria-pressed="${this.hero === h.id}" style="--hero-color:${h.color}"><span class="hero-role">${h.role}</span><div class="hero-portrait-scene">${portrait(h.id)}</div><strong>${h.name}</strong></button>`).join('')}</div><div class="hero-detail" style="--hero-color:${selected.color}"><div class="hero-detail-title"><span class="skill-icon">${icon(selected.icon)}</span><div><h3>${selected.name} <small>· ${selected.role}</small></h3></div></div><p>${selected.description}</p><p class="hero-clear-record">클리어 ${this.store.data.clears[this.hero]}회 · 무기 진화: ${EVOLUTIONS[this.hero].name}<br>조건: 기본무기 5 + ${EVOLUTIONS[this.hero].passive === 'power' ? '강인한 일격' : '신속한 손놀림'} 2</p><div class="hero-base-stats"><span>HP <b>${selected.hp}</b></span><span>이동 <b>${selected.speed}</b></span><span>무기 <b>${selected.weapon}</b></span></div><div class="starting-skills">${selected.skills.map(id => `<span title="${SKILLS[id].description}">${icon(SKILLS[id].icon)} ${SKILLS[id].name}</span>`).join('')}</div></div><div class="menu-bottom"><div class="challenge-selector" aria-label="도전 단계">${[0, 1, 2, 3].map(rank => `<button data-action="rank" data-rank="${rank}" aria-pressed="${rank === this.rank}" ${rank > this.store.data.challengeUnlocked ? 'disabled' : ''}>${rank === 0 ? '첫 원정' : `도전 ${rank}${rank > this.store.data.challengeUnlocked ? ' · 잠김' : ''}`}</button>`).join('')}</div><button class="button primary" data-action="start">${icon('play')} 숲으로 떠나기 ${icon('right')}</button></div></div>`;
 }
 private renderShop() {
  const { gold, upgrades, invested } = this.store.data;
  this.overlay.innerHTML = `<div class="menu-panel shop-panel">${this.topbar('영구 강화', 'shop-back')}
   <div class="gold-wallet"><h2>성장의 제단</h2><strong aria-label="보유 골드">${icon('coin')} ${gold.toLocaleString()}</strong></div>
   <div class="shop-list">${(Object.keys(PERMANENT) as PermanentId[]).map(id => {
    const item = PERMANENT[id], level = upgrades[id], max = permanentLimit(id), maxed = level >= max, cost = upgradeCost(level, id);
    const refund = this.store.upgradeRefund(id), bonus = Number((level * item.step * 100).toFixed(1));
    return `<div class="shop-item">
     <button class="buy-button step-button" aria-label="${item.description} 한 단계 낮추기 · ${refund.toLocaleString()} 골드 환불" data-action="downgrade" data-id="${id}" ${level ? '' : 'disabled'}><b>−</b><small>${level ? refund.toLocaleString() : '—'}</small></button>
     <div class="shop-item-copy"><h3>${item.description}</h3><p>${id === 'timeStop' ? `원정당 ${level}/${max}회 · 한 번에 2초` : `레벨 ${level}/${max} <b>+${bonus}%</b>`}</p></div>
     <button class="buy-button step-button" aria-label="${item.description} 한 단계 올리기 · ${maxed ? '최대 레벨' : cost.toLocaleString() + ' 골드'}" data-action="buy" data-id="${id}" ${maxed || gold < cost ? 'disabled' : ''}><b>+</b><small>${maxed ? '최대' : cost.toLocaleString()}</small></button>
    </div>`;
   }).join('')}</div>
   <p class="shrine-tip">− 환불 · + 구매 · 다음 원정부터 적용</p>
   <div class="menu-bottom">${this.refundConfirm ? `<div class="refund-section"><button class="button secondary" data-action="refund-confirm">전체 초기화 · ${invested.toLocaleString()} 골드 환불</button><button class="text-button" data-action="refund-cancel">취소 · 유지하기</button></div>` :
    `<button class="text-button" data-action="refund-preview" ${invested === 0 ? 'disabled' : ''}>영구 강화 초기화 · 전액 환불</button>`}
    <button class="button primary" data-action="shop-back">${icon('back')} 원정 준비로 돌아가기</button>
   </div></div>`;
 }
 private async backupAction(action: () => Promise<string>) {
  this.backupBusy = true;
  this.overlay.inert = true;
  try { this.backupMessage = await action(); }
  catch { this.backupMessage = '작업을 완료하지 못했습니다. 백업 파일과 저장 위치를 확인하세요.'; }
  finally {
   this.backupBusy = false;
   this.overlay.inert = false;
   if (this.screen === 'settings') this.render();
  }
 }
 private async readBackup(file: File) {
  this.pendingBackup = undefined;
  await this.backupAction(async () => {
   if (file.size > backupLimit) throw new Error('File too large');
   this.pendingBackup = decodeBackup(await file.text());
   return '';
  });
 }
 private async applyBackup(save: SaveData) {
  await this.backupAction(async () => {
   await this.store.restore(save);
   this.pendingBackup = undefined;
   this.hero = save.lastHero;
   this.rank = Math.min(this.rank, save.challengeUnlocked);
   this.scene.audio.music = save.settings.music;
   this.scene.audio.sfx = save.settings.sfx;
   this.syncSound();
   this.syncRecords();
   return '백업에서 저장 데이터를 복원했습니다.';
  });
 }
 private backupControls() {
  const save = this.pendingBackup;
  return `<section class="backup-controls"><h3>저장 데이터 백업·복원</h3>
   <button class="button secondary" data-action="backup-export">JSON 백업 내보내기</button>
   ${this.settingsReturn === 'run' ? '<p>복원은 원정을 마친 뒤 타이틀 설정에서 할 수 있습니다.</p>' :
    `<input hidden id="backup-file" type="file" accept=".json,application/json"><button class="button secondary" data-action="backup-select">백업 파일 선택</button>`}
   ${save ? `<p>보유 골드 ${save.gold.toLocaleString()} · 영구 강화 합계 ${Object.values(save.upgrades).reduce((a,b) => a+b,0)}레벨 · 최근 원정 ${save.history.length}건</p><p>현재 진행 상황을 이 백업으로 교체합니다.</p><button class="button primary" data-action="backup-restore">이 백업으로 복원</button><button class="text-button" data-action="backup-cancel">취소</button>` : ''}
   <p class="backup-message" role="status">${this.backupMessage}</p></section>`;
 }
 private renderSettings() {
  this.overlay.innerHTML = `<div class="menu-panel settings-panel">${this.topbar('설정', 'settings-back')}<div class="menu-heading"><h2>설정</h2></div><div class="settings-sliders">${(['music', 'sfx'] as const).map(key => `<label><span>${icon(key === 'music' ? 'leaf' : 'sound')} ${key === 'music' ? '배경음' : '효과음'}<b id="volume-${key}">${Math.round(this.store.data.settings[key] * 100)}%</b></span><input aria-label="${key === 'music' ? '배경음' : '효과음'} 음량" type="range" min="0" max="100" value="${Math.round(this.store.data.settings[key] * 100)}" data-volume="${key}"></label>`).join('')}</div><details class="settings-controls"><summary>이동 방법</summary><p>PC · WASD, 방향키, 마우스 드래그</p><p>모바일 · 드래그</p><p>일시정지 · ESC 또는 상단 버튼</p></details><div class="save-info">${icon('shield')} ${this.store.persistent ? '진행 기록과 설정이 이 기기에 저장됩니다.' : '저장 공간에 접근할 수 없어 새로고침하면 초기화됩니다.'}</div>${this.backupControls()}<div class="menu-bottom"><button class="button secondary" data-action="diagnostics">실기기 진단 · 로그</button><button class="button secondary" data-action="history">최근 원정 기록</button><button class="button primary" data-action="settings-back">설정 완료 ${icon('check')}</button></div></div>`;
 }
 private renderDiagnostics() {
  this.overlay.innerHTML = `<div class="menu-panel diagnostics-panel">${this.topbar('DEVICE DIAGNOSTICS', 'diagnostics-back')}<div class="menu-heading"><span class="eyebrow">ON-DEVICE TEST LOG</span><h2>실기기 진단</h2><p>FPS · 프레임 지연 · 게임 입력 상태</p></div>
   <button class="button ${this.diagnostics.enabled ? 'primary' : 'secondary'}" data-action="diagnostics-toggle" aria-pressed="${this.diagnostics.enabled}">${this.diagnostics.enabled ? '진단 끄기 · 기록 보관' : '진단 켜기 · 기록 시작'}</button>
   <div class="diagnostics-metrics"><div><span>최근 FPS</span><strong data-diag-fps>—</strong></div><div><span>프레임 p95 / 최대</span><strong data-diag-frame>—</strong></div><div><span>입력 → 게임 갱신 p95</span><strong data-diag-input>—</strong></div><div><span>50ms 초과 프레임 (전체)</span><strong data-diag-slow>0</strong></div></div>
   <output class="diagnostics-touch" data-diag-touch></output><p class="diagnostics-counts" data-diag-counts></p>
   <label class="diagnostics-note">테스트 메모 (선택, 200자)<textarea id="diagnostics-note" maxlength="200" rows="2" placeholder="예: 궁수 · 5분 · 화면 60Hz"></textarea></label>
   <p class="diagnostics-help">최대 1,800개 요약(약 30분)과 4,000개 이벤트를 메모리에 보관합니다. 백그라운드 대기는 FPS에서 제외합니다. 앱 종료 전에 내보내세요.</p>
   <p class="diagnostics-help">프레임 값은 애니메이션 콜백 간격입니다. 입력 대기는 이벤트 → 게임 갱신 구간이며, 실제 화면 표시 지연과 다릅니다.</p>
   <div class="menu-bottom"><button class="button primary" data-action="diagnostics-export" ${this.diagnosticExporting ? 'disabled' : ''}>${this.diagnosticExporting ? '로그 준비 중…' : '진단 로그 내보내기 (JSON)'}</button><button class="button secondary" data-action="diagnostics-new" ${this.diagnosticExporting ? 'disabled' : ''}>새 기록 · 기존 기록 초기화</button><output id="diagnostics-message" aria-live="polite"></output><button class="text-button" data-action="diagnostics-back">이전 화면으로</button></div></div>`;
  this.overlay.querySelector<HTMLTextAreaElement>('#diagnostics-note')!.value = this.diagnostics.note;
 }
 private async exportDiagnostics() {
  if (this.diagnosticExporting) return; this.diagnosticExporting = true; this.diagnosticMessage = '기기 정보와 로그를 준비하고 있습니다.'; this.render();
  try { await this.diagnostics.ensureMetadata(); this.diagnostics.recorder.event('export_requested', {}, performance.now()); this.diagnosticMessage = await exportDiagnosticLog(this.diagnostics.report()); }
  catch (error) { this.diagnosticMessage = `내보내지 못했습니다. 기록은 메모리에 남아 있습니다. ${error instanceof Error ? error.message.slice(0, 150) : ''}`; }
  finally { this.diagnosticExporting = false; this.render(); }
 }
 private updateDiagnostics() {
  const latest = this.diagnostics.latest(), stats = this.diagnostics.recorder.status(), input = this.diagnostics.currentInput();
  const live = this.root.querySelector<HTMLElement>('#diagnostics-hud'); if (!live) return;
  live.classList.toggle('hidden', !this.diagnostics.enabled || this.screen !== 'run');
  if (this.diagnostics.enabled && !live.innerHTML) live.innerHTML = `<div><span class="diagnostics-rec">● REC</span> <b data-diag-fps>—</b> FPS<br><span data-diag-frame>—</span> ms p95/max<br><span data-diag-input>—</span> ms 입력 p95<br><span data-diag-touch></span></div><button class="icon-button" data-action="diagnostics" aria-label="진단 로그 열기">${icon('settings')}</button>`;
  const put = (selector: string, text: string) => this.root.querySelectorAll<HTMLElement>(selector).forEach(element => { if (element.textContent !== text) element.textContent = text; });
  put('[data-diag-fps]', latest?.frames.frames ? latest.frames.fps.toFixed(0) : '—');
  put('[data-diag-frame]', latest?.frames.frames ? `${latest.frames.p95Ms.toFixed(1)} / ${latest.frames.maxMs.toFixed(1)}` : '—');
  put('[data-diag-input]', latest?.inputLatency.count ? latest.inputLatency.p95Ms.toFixed(1) : '—');
  put('[data-diag-slow]', String(stats.slowFrames));
  put('[data-diag-touch]', `${input?.dragging ? 'DRAG' : input?.source === 'keyboard' ? 'KEY' : 'IDLE'} · ${input?.pointerType || '—'} #${input?.pointerId ?? '—'} · 터치 ${input?.touches ?? 0} · 방향 ${input?.direction.x.toFixed(2) ?? '0'},${input?.direction.y.toFixed(2) ?? '0'}`);
  put('[data-diag-counts]', `요약 ${stats.samples}/1800 · 이벤트 ${stats.events}/4000 · 측정 프레임 ${stats.frames} · 오래된 기록 제외 ${stats.droppedSamples}/${stats.droppedEvents}${this.diagnostics.storageAvailable ? '' : ' · 진단 설정은 이번 실행만 유지'}`);
  const message = this.root.querySelector('#diagnostics-message'); if (message) message.textContent = this.diagnosticMessage;
 }
 private renderRun() {
  const s = this.sim!.state;
  this.hud.innerHTML = `<div class="hud-top"><div class="hud-first-row"><span class="hud-hero">${portrait(s.hero)}<b>${HEROES[s.hero].name}</b><small id="hud-level">Lv.${s.level}</small></span><span class="hud-time">${icon('clock')}<strong id="hud-time">00:00</strong></span><button class="pause-button" data-action="pause" aria-label="일시정지">${icon('pause')}</button></div><div class="hp-row">${icon('heart')}<div class="hp-track"><div id="hp-fill"></div></div><span id="hp-text"></span></div><div class="xp-row"><div class="xp-track"><div id="xp-fill"></div></div><span id="xp-text"></span></div><div class="hud-meta"><div class="loadout">${[{ icon: HEROES[s.hero].icon, level: s.weaponLevel, name: s.evolved ? EVOLUTIONS[s.hero].name : HEROES[s.hero].weapon }, ...HEROES[s.hero].skills.map(id => ({ icon: SKILLS[id].icon, level: s.skills[id] ?? 0, name: SKILLS[id].name }))].map(item => `<div class="loadout-slot ${item.level ? 'learned' : ''}" title="${item.name} Lv.${item.level}">${item.level ? icon(item.icon) : icon('plus')}<small>${item.level || '·'}</small></div>`).join('')}</div><div class="hud-counters"><span>${icon('skull')} <b id="hud-kills">0</b></span><span>${icon('coin')} <b id="hud-gold">0</b></span></div></div></div><div class="hud-objective"><span id="campaign-goal"></span></div>${new URLSearchParams(location.search).has('debug') ? '<output id="debug-stats" class="debug-stats"></output>' : ''}`;
  this.updateHud(s);
  if (s.status === 'running') { this.overlay.innerHTML = ''; this.overlay.classList.add('inactive'); }
  else if (s.status === 'paused') this.overlay.innerHTML = `<div class="pause-panel"><div class="modal-emblem">${icon('leaf')}</div><h2>일시정지</h2><div class="pause-stats"><span>${formatTime(s.elapsed)}<small>생존 시간</small></span><span>${s.kills}<small>처치한 적</small></span><span>${s.gold}<small>획득 골드</small></span></div><button class="button primary" data-action="resume">${icon('play')} 모험 계속하기</button><button class="button secondary" data-action="settings">${icon('settings')} 설정</button><button class="button secondary" data-action="diagnostics">실기기 진단 · 로그</button><button class="text-button" data-action="title">원정 마치고 타이틀로</button></div>`;
  else if (s.status === 'upgrade') this.overlay.innerHTML = `<div class="upgrade-panel"><div class="level-emblem">✦</div><h2>강화 선택</h2><p>레벨 ${s.level} · 하나를 고르세요</p><div class="upgrade-choices">${s.choices.map(c => `<button class="upgrade-card" data-action="upgrade" data-id="${c.id}" style="--choice-color:${c.color}"><span class="skill-icon">${icon(c.icon)}</span><span class="upgrade-copy"><strong>${c.name}<small>${c.level} → ${c.level + 1}</small></strong><span class="upgrade-description">${c.description}</span><span class="upgrade-levels">${Array.from({ length: c.max }, (_, i) => `<i class="${i < c.level ? 'lit' : i === c.level ? 'next' : ''}"></i>`).join('')}</span></span>${icon('right', 'upgrade-arrow')}</button>`).join('')}</div><div class="quiet-note">선택하는 동안 숲의 시간은 멈춥니다.</div></div>`;
 }
 private updateTimeStop(state?: RunState) {
  const button = this.root.querySelector<HTMLButtonElement>('.time-stop-button')!;
  const active = this.screen === 'run' && state?.status === 'running';
  const remaining = state?.timeStopCharges ?? 0;
  const frozen = active && (state?.timeStopRemaining ?? 0) > 0;
  button.hidden = !active;
  button.disabled = !remaining || frozen;
  const counter = button.querySelector('b')!;
  const count = String(remaining);
  if (counter.textContent !== count) {
   counter.textContent = count;
   button.setAttribute('aria-label', `시간의 회중시계 · ${count}회 남음`);
  }
  this.root.querySelector<HTMLElement>('#time-stop-fx')!.hidden = !frozen;
 }
 private updateHud(s: RunState) {
  this.updateTimeStop(s);
  const text = (id: string, value: string) => { const el = this.hud.querySelector(`#${id}`); if (el && el.textContent !== value) el.textContent = value; };
  text('campaign-goal', s.finalSpawned
   ? `남은 시간 ${Math.max(0, Math.ceil(CAMPAIGN.finalAt + CAMPAIGN.arenaLimit - s.elapsed))}초`
   : `10:00 모르바${s.rank ? ' · 도전 ' + s.rank : ''}`);
  text('hud-level', `Lv.${s.level}`); text('hud-time', formatTime(s.elapsed)); text('hp-text', `${Math.ceil(s.player.hp)} / ${Math.round(s.player.maxHp)}`); text('xp-text', `${Math.floor(s.xp)} / ${s.xpNext}`); text('hud-kills', `${s.kills}`); text('hud-gold', `${s.gold}`);
  const hp = this.hud.querySelector<HTMLElement>('#hp-fill'), xp = this.hud.querySelector<HTMLElement>('#xp-fill'); if (hp) hp.style.width = `${s.player.hp / s.player.maxHp * 100}%`; if (xp) xp.style.width = `${s.xp / s.xpNext * 100}%`;
  text('debug-stats', `${Math.round(this.game?.loop.actualFps ?? 0)} FPS · ENEMY ${s.enemies.length}/${WORLD.maxEnemies} · SHOT ${s.projectiles.length}/${WORLD.maxProjectiles} · POS ${Math.round(s.player.x)},${Math.round(s.player.y)} · ${this.scene.controls.dragging ? 'DRAG' : 'IDLE'}`);
 }
 private combatSummary(r: RunResult) {
  const c = r.combat; if (!c) return '<p class="combat-explanation">이전 버전 원정의 상세 전투 집계는 기록되지 않았습니다.</p>';
  return `<section class="combat-summary" aria-label="몬스터 기록"><div><span>전체 등장</span><strong data-record-spawned>${c.spawned}마리</strong></div><div><span>처치한 몬스터</span><strong data-record-killed>${c.killed}마리 · ${c.killRate.toFixed(1)}%</strong></div><div><span>놓친 몬스터 · 미처치</span><strong data-record-missed>${c.missed}마리 · ${c.missRate.toFixed(1)}%</strong></div><div><span>전투 플레이 시간</span><strong>${formatTime(r.time)}</strong></div></section><p class="combat-explanation">일반 적·보스를 모두 포함합니다. 놓친 비율 = 미처치 ÷ 전체 등장 × 100.<br>화면 밖 이탈 ${c.escaped} · 보스전 전환/상한 정리 ${c.withdrawn} · 종료 시 생존 ${c.remaining}.<br>일시정지·강화 선택 시간은 플레이 시간에서 제외합니다.</p>`;
 }
 private renderHistory() {
  const records = [...this.store.data.history].reverse();
  const index = this.historyPage * 3;
  const page = records.slice(index, index + 3);
  this.overlay.innerHTML = `<div class="menu-panel history-panel">${this.topbar('원정 기록', 'history-back')}<div class="menu-heading"><h2>최근 원정 기록</h2></div>
   <div class="history-list">${page.length ? page.map(r => `<details class="history-record"><summary>${HEROES[r.hero].name} · ${r.cleared ? '클리어' : r.outcome === 'abandoned' ? '중도 종료' : '미완료'} · ${formatTime(r.time)}<br><small>처치 ${r.kills} · ${r.combat ? `놓침 ${r.combat.missed} (${r.combat.missRate.toFixed(1)}%)` : '상세 집계 미기록'} · 골드 ${r.gold}</small></summary><p>레벨 ${r.level} · 보스 ${r.bosses} · 숲 재도전 ${r.rank ?? 0}</p>${this.combatSummary(r)}</details>`).join('') : '<p>저장된 원정이 없습니다.</p>'}</div>
   <div class="menu-bottom">${records.length > 3 ? `<nav class="history-pages" aria-label="기록 페이지"><button class="icon-button" data-action="history-page" data-direction="-1" aria-label="최근 기록" ${index === 0 ? 'disabled' : ''}>${icon('back')}</button><span>${this.historyPage + 1} / ${Math.ceil(records.length / 3)}</span><button class="icon-button" data-action="history-page" data-direction="1" aria-label="이전 기록" ${index + 3 >= records.length ? 'disabled' : ''}>${icon('right')}</button></nav>` : ''}<button class="button secondary" data-action="history-back">이전 화면으로</button></div></div>`;
 }
 private renderResult() {
  const r = this.lastResult; if (!r) { this.screen = 'title'; this.render(); return; }
  this.overlay.innerHTML = `<div class="menu-panel result-panel">
   <div class="result-heading">${portrait(r.hero)}<h2>${r.cleared ? '뿌리의 군주를 쓰러뜨렸습니다!' : '원정이 종료되었습니다.'}</h2></div>
   <div class="result-time" aria-label="전투 플레이 시간">${formatTime(r.time)}${this.newRecord ? '<span>최고 생존 기록</span>' : ''}</div>
   <div class="result-grid"><div><strong>${r.level}</strong><span>도달 레벨</span></div><div><strong>${r.kills}</strong><span>처치한 적</span></div><div><strong>${r.bosses}</strong><span>처치한 보스</span></div></div>
   ${this.combatSummary(r)}<div class="result-reward"><span>이번 원정의 보상</span><strong>${icon('coin')} +${r.gold}</strong></div>
   <div class="menu-bottom"><button class="button primary" data-action="retry">${icon('compass')} 숲 다시 도전 ${icon('right')}</button>
    <div class="result-actions"><button class="button secondary" data-action="shop">성장의 제단으로</button><button class="button secondary" data-action="history">최근 원정 기록</button></div>
    <button class="text-button" data-action="title">타이틀로 돌아가기</button></div></div>`;
 }
}
