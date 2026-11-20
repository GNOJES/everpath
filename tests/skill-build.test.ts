import { expect, it } from 'vitest';
import { playTrial } from './helpers/playtest';

it.each(['warrior', 'archer', 'mage'] as const)('supports a %s clear with a level-one weapon and permanent growth', hero => {
 const seeds = [42, 271, 2026];
 const play = (rank: number) => seeds.map(seed => playTrial(hero, seed, 'reactive', 'weapon-light', 710, rank));
 const base = play(0), grown = play(20);
 expect([...base, ...grown].every(trial => trial.weaponLevel === 1)).toBe(true);
 expect(base.every(trial => trial.status !== 'victory')).toBe(true);
 expect(grown.filter(trial => trial.maxSkillRank === 4 && trial.status === 'victory').length).toBeGreaterThanOrEqual(2);
}, 45000);
