import type { CombatSound } from './types';

type Tone = [pitch: number, endPitch: number, seconds: number, gain: number, wave: OscillatorType, delay?: number];
type Noise = [center: number, seconds: number, gain: number, delay?: number];
interface SoundProfile { tones: Tone[]; noise?: Noise }

export const COMBAT_SOUNDS: Record<CombatSound, SoundProfile> = {
 // Steel, shields and impact.
 whirl: { tones: [[265, 95, .17, .055, 'triangle']], noise: [1700, .19, .16] },
 blade: { tones: [[195, 465, .16, .06, 'triangle'], [740, 330, .14, .038, 'sine', .045]], noise: [3600, .1, .08] },
 shield: { tones: [[431, 431, .24, .06, 'sine'], [654, 654, .25, .052, 'triangle', .06]] },
 shieldBlock: { tones: [[325, 155, .12, .095, 'triangle'], [1320, 800, .13, .045, 'sine']], noise: [1900, .1, .105] },
 bash: { tones: [[158, 79, .15, .115, 'triangle']], noise: [530, .15, .16] },
 lunge: { tones: [[122, 340, .095, .075, 'triangle'], [610, 290, .08, .047, 'sine', .043]], noise: [2500, .105, .115] },
 quake: { tones: [[91, 38, .31, .2, 'sine'], [164, 62, .24, .065, 'triangle', .025]], noise: [300, .29, .19] },
 sunder: { tones: [[180, 76, .16, .1, 'triangle'], [997, 490, .21, .075, 'sine', .022]], noise: [2400, .18, .14] },
 // Strings, fletching and impacts.
 multishot: { tones: [[318, 178, .08, .07, 'triangle'], [410, 213, .08, .055, 'triangle', .045], [501, 285, .08, .045, 'triangle', .092]], noise: [3900, .12, .06] },
 pierce: { tones: [[880, 178, .17, .083, 'triangle']], noise: [4350, .14, .135] },
 rain: { tones: [[387, 743, .18, .07, 'sine']], noise: [2850, .16, .12] },
 rainImpact: { tones: [[515, 218, .08, .064, 'triangle'], [668, 350, .09, .052, 'triangle', .085], [434, 214, .08, .053, 'triangle', .15]], noise: [2000, .26, .14] },
 snare: { tones: [[243, 405, .13, .075, 'triangle'], [197, 122, .14, .057, 'triangle', .07]], noise: [860, .11, .09] },
 ricochet: { tones: [[610, 455, .09, .077, 'sine'], [870, 715, .095, .062, 'triangle', .066], [1055, 925, .095, .05, 'sine', .126]] },
 blastArrow: { tones: [[440, 225, .13, .081, 'triangle']], noise: [2400, .14, .14] },
 blastImpact: { tones: [[103, 46, .26, .17, 'sine']], noise: [565, .25, .23] },
 deadeye: { tones: [[715, 285, .09, .097, 'triangle'], [230, 102, .10, .064, 'triangle', .03]], noise: [4950, .075, .14] },
 // Elements and spells.
 chain: { tones: [[560, 83, .15, .08, 'sawtooth'], [231, 99, .13, .09, 'triangle', .04]], noise: [2950, .14, .22] },
 fire: { tones: [[155, 360, .14, .07, 'triangle'], [300, 134, .21, .062, 'sine', .08]], noise: [670, .27, .18] },
 frost: { tones: [[1020, 820, .23, .04, 'sine'], [1350, 1150, .28, .037, 'sine', .037], [1550, 1220, .28, .035, 'triangle', .09]], noise: [4600, .14, .066] },
 meteor: { tones: [[560, 185, .28, .075, 'triangle']], noise: [1600, .28, .08] },
 meteorImpact: { tones: [[108, 43, .25, .16, 'sine'], [240, 120, .14, .055, 'triangle']], noise: [420, .2, .14] },
 gravity: { tones: [[321, 89, .36, .079, 'triangle'], [145, 51, .42, .077, 'sine', .075]], noise: [490, .29, .085] },
 prism: { tones: [[493, 715, .23, .056, 'sine'], [659, 955, .23, .049, 'triangle', .045], [831, 1180, .28, .045, 'sine', .09]] },
 runeCross: { tones: [[365, 520, .15, .05, 'sine'], [734, 921, .17, .069, 'triangle', .09], [190, 91, .24, .092, 'triangle', .12]], noise: [2000, .13, .11, .1] },
 timeStop: { tones: [[1440, 1440, .07, .065, 'triangle'], [1077, 1077, .09, .06, 'triangle', .09], [420, 74, .46, .12, 'sine', .14]], noise: [2200, .12, .07, .11] },
 // Enemy telegraphs, releases and outcomes.
 grormWarn: { tones: [[62, 103, .32, .13, 'triangle'], [115, 84, .27, .068, 'triangle', .18]], noise: [290, .32, .12] },
 grormVolley: { tones: [[259, 118, .11, .09, 'triangle'], [318, 140, .1, .06, 'triangle', .042]], noise: [2200, .13, .115] },
 grormDash: { tones: [[117, 68, .21, .12, 'triangle']], noise: [1020, .26, .20] },
 grormSlam: { tones: [[96, 37, .26, .21, 'sine'], [214, 81, .14, .086, 'triangle']], noise: [410, .22, .23] },
 grormDefeat: { tones: [[104, 43, .26, .15, 'triangle'], [392, 392, .27, .08, 'triangle', .13], [523, 523, .38, .09, 'sine', .24]], noise: [360, .24, .13] },
 briarWarn: { tones: [[133, 220, .33, .095, 'triangle'], [245, 288, .30, .065, 'sine', .14]], noise: [730, .31, .10] },
 briarImpact: { tones: [[177, 52, .24, .11, 'triangle'], [77, 36, .28, .145, 'sine']], noise: [970, .18, .19] },
 wardenRoots: { tones: [[72, 111, .42, .105, 'sine'], [180, 263, .42, .077, 'triangle', .075]], noise: [590, .37, .155] },
 wardenAim: { tones: [[230, 556, .53, .105, 'triangle'], [100, 215, .55, .095, 'sine', .045]] },
 wardenFan: { tones: [[605, 118, .22, .12, 'triangle'], [238, 78, .27, .105, 'triangle', .05]], noise: [1580, .19, .19] },
 wardenRing: { tones: [[89, 55, .3, .17, 'sine'], [430, 570, .20, .09, 'triangle'], [570, 705, .22, .076, 'triangle', .11]], noise: [1950, .24, .15] },
 wardenSlam: { tones: [[96, 32, .35, .23, 'sine'], [372, 137, .20, .09, 'triangle']], noise: [270, .35, .22] },
 defeat: { tones: [[110, 42, .39, .19, 'sine'], [294, 294, .35, .105, 'triangle', .07], [233, 233, .38, .1, 'triangle', .26], [147, 118, .53, .113, 'sine', .44]], noise: [350, .25, .17] },
 victory: { tones: [[83, 48, .40, .21, 'sine'], [392, 392, .28, .09, 'triangle', .075], [493, 493, .30, .09, 'triangle', .2], [587, 587, .36, .1, 'triangle', .32], [784, 784, .59, .108, 'triangle', .46], [988, 988, .57, .064, 'sine', .46], [1175, 1175, .54, .052, 'sine', .49]], noise: [430, .26, .18] },
};
