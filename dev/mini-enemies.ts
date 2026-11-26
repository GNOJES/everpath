import Phaser from 'phaser';
import { WORLD } from '../src/game/config';
import { ForestScene } from '../src/game/scene';
import { parseSave } from '../src/game/save';
import { GameSimulation } from '../src/game/simulation';
import type { Enemy, EnemyKind } from '../src/game/types';

const descriptions = {
 common: '슬라임, 고블린, 박쥐, 해골 궁수, 갑주병, 주술사',
 boss: '주황 화살표 경로를 따라 돌진. 멈춘 지점 주위에 균열 공격.',
 briar: '청록 조준점 두 곳을 차례로 포격.',
 warden: '보라 뿌리 표식, 다섯 갈래 부채꼴, 방사형 투사체를 차례로 사용.',
};
type Example = keyof typeof descriptions;
const query = new URLSearchParams(location.search).get('case');
let selected: Example = query && Object.hasOwn(descriptions, query) ? query as Example : 'common';
const buttons = document.querySelectorAll<HTMLButtonElement>('[data-case]');
const description = document.querySelector('#description')!;
const scene = new ForestScene(true, false, 'mini', true);
scene.audio.music = 0;
scene.audio.sfx = 0;

function show(example: Example) {
 selected = example;
 for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.case === example));
 description.textContent = descriptions[example];
 if (!scene.controls) return;
 const sim = new GameSimulation('warrior', parseSave(null), () => .41);
 const { state } = sim;
 state.nextBoss = Infinity;
 state.player.x = 210;
 state.player.y = 492;
 const enemies: Enemy[] = [];
 const add = (kind: EnemyKind, x: number, y: number) => {
  const enemy = sim.spawnEnemy(kind, x, y)!;
  enemy.timer = 1.25;
  enemies.push(enemy);
 };
 if (example === 'common') {
  add('slime', 78, 253);
  add('goblin', 160, 218);
  add('bat', 345, 192);
  add('skeleton', 90, 143);
  add('brute', 327, 270);
  add('shaman', 268, 133);
 } else {
  add(example, 195, 232);
 }
 const roster = new Set(enemies);
 scene.onFrame = () => {
  // The display loops without settling an expedition or touching web saves.
  state.enemies = state.enemies.filter(enemy => roster.has(enemy));
  state.player.hp = state.player.maxHp;
  for (const enemy of enemies) {
   enemy.hp = enemy.maxHp;
   if (!state.enemies.includes(enemy)) state.enemies.push(enemy);
  }
  if (state.status !== 'running') state.status = 'running';
 };
 scene.setRun(sim);
}

for (const button of buttons) button.addEventListener('click', () => show(button.dataset.case as Example));
document.querySelector('#replay')!.addEventListener('click', () => show(selected));
scene.onReady = () => show(selected);

new Phaser.Game({
 type: Phaser.AUTO, parent: 'field', width: WORLD.width, height: WORLD.height,
 backgroundColor: '#233d2e', pixelArt: true, roundPixels: true, antialias: false,
 scene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
 audio: { noAudio: true }, banner: false,
});
