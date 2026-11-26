import { GameAudio } from '../src/game/audio';
import type { CombatSound, HeroId } from '../src/game/types';

const themes = { old: new GameAudio(), mini: new GameAudio(undefined, true) };
let selected: keyof typeof themes = 'mini';
let track: 'battle' | 'warden' | undefined;
const audio = () => themes[selected];
const styleButtons = document.querySelectorAll<HTMLButtonElement>('[data-style]');
const tracks = document.querySelectorAll<HTMLButtonElement>('[data-music]');
const render = () => {
 for (const button of styleButtons) button.setAttribute('aria-pressed', String(button.dataset.style === selected));
 for (const button of tracks) button.setAttribute('aria-pressed', String(button.dataset.music === track));
};

document.querySelector('main')!.addEventListener('click', event => {
 const button = (event.target as Element).closest('button');
 if (!button) return;
 const { style, music, hero, cue, ui } = button.dataset;
 if (style === 'old' || style === 'mini') {
  if (style === selected) return;
  audio().suspend();
  selected = style;
  if (track) { audio().unlock(); audio().beginRun(track === 'warden'); }
 } else if (button.id === 'stop') {
  track = undefined;
  audio().syncMusic();
 } else {
  audio().unlock();
  if (music === 'battle' || music === 'warden') {
   track = music;
   audio().beginRun(music === 'warden');
  } else if (hero) audio().attack(hero as HeroId);
  else if (cue) audio().playCue(cue as CombatSound, selected === 'old');
  else if (ui === 'click') audio().click();
  else if (ui === 'levelUp') audio().levelUp();
 }
 render();
});
function stopOnExit() {
 if (!document.hidden) return;
 audio().suspend();
 track = undefined;
 audio().syncMusic();
 render();
}
document.addEventListener('visibilitychange', stopOnExit);
