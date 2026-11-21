import type Phaser from 'phaser';
import warrior from './sprites/warrior.png';
import archer from './sprites/archer.png';
import mage from './sprites/mage.png';

export const HERO_SPRITES = { warrior, archer, mage };
export const artUrls: Record<string, string> = { ...HERO_SPRITES };
type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
function canvas(w: number, h: number, draw: Draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d')!; ctx.imageSmoothingEnabled = false; draw(ctx, w, h); return c; }
const rect = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); };
function random(seed: number) { let n = seed; return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; }; }
function pixelSprite(map: string[], colors: Record<string, string>) { return canvas(Math.max(...map.map(r => r.length)), map.length, ctx => { map.forEach((row, y) => [...row].forEach((key, x) => { if (colors[key]) rect(ctx, colors[key], x, y, 1, 1); })); }); }
// A limited ink-and-pigment palette keeps silhouettes readable on the bright field.
const palette = { o: '#202943', d: '#344c72', a: '#4e8ac4', b: '#a4daef', l: '#f9f5db', s: '#efb586', h: '#81513c', r: '#bc3540', R: '#fc6650', g: '#286d69', G: '#82c8a3', p: '#5549ab', P: '#aca0ff', c: '#44d6f4', y: '#ffd367', w: '#fff7ee' };
export function createArt(scene: Phaser.Scene) {
 const add = (key: string, source: HTMLCanvasElement) => { if (!scene.textures.exists(key)) scene.textures.addCanvas(key, source); artUrls[key] = source.toDataURL(); };
 const heroColors = { o: '#342640', d: '#814c43', s: '#eb9867', S: '#ffcc91' };
 add('field-warrior', pixelSprite([
  '      oooo', '     oyyyyoo', '    oyyYYyyyo', '  oyyyYYYYyyoo', ' oyyooYYYyYyyo',
  ' ooooyyYyYYYyo      o', '    oyYYyYYyoo     olo', '   oyyyoyooo      ollo',
  '   ooybSSSbSo    ollLo', '    obSSoSSoo    ollLo', '    odSSSSSo    ollLo',
  '    oodSSdo     ollo', '   obbboooobo  ollo', '  obbbBLbBBBo ollo',
  '  obyLBByBBbooyo', '  oyyBBoLBbooYyo', '   oyobBBobooyo', '    oobbbyboo',
  '     obobybo', '     obo obo', '    obbo obbo', '    oooo oooo',
 ], { ...heroColors, y: '#df883c', Y: '#ffd86f', b: '#4a4b73', B: '#7184ab', L: '#dce9de', l: '#a6bdd2' }));
 add('field-archer', pixelSprite([
  '     oooo', '    ogGGgoo', '   ogGggGGgo', '  ogGoorrRGgo', ' oggooRRRRGGgo',
  '  oooRRRdRRRGgo', '    odRdSdRRGGo   oo', '   odRSoSSdoGgo  oygo',
  '   odRSSSoSodgo  oyGgo', '    odSSSSSogo  oy o',
  '   ogodSSdogoo  oY o', '  oggGGoooGgggo oY o', '  oggGYgYggggsooY o',
  '  oggGggGGggosooY o', '   ogggYYgggo   oY o', '   oogyyYggoo   oy o',
  '    oggggggo     oyo', '     obbybbo      oo', '     obo obo', '     obo obo',
  '    odbo obdo', '    oooo oooo',
 ], { ...heroColors, g: '#557749', G: '#95ac5d', r: '#a74c34', R: '#e77e47', b: '#54445b', y: '#ad6b3e', Y: '#e7b26b' }));
 add('field-mage', pixelSprite([
  '      oooo', '     opPPpo', '    opPPPppo', '    opPPpYOo', '    opPPpYyoo',
  '   opPPppYyppo', ' ooppPPPPPPpPpo', 'oppPPPPPPPPPPppo',
  ' opPPoobbbobppoo   o', '  oooobSSSbooo    oco', '    obSoSSobo    ocCo',
  '    obSSSSSbo   oCCcco', '    obbdSSdoo    ocCo', '    opPoooopPo   oco',
  '   opPPpYpPPpo    so', '   opPPpyPPppso   so', '  oppPPYPppopso   so',
  '  oppPPpPPppo ooooso', '   oppPpPPpo      so', '    obpo pbo      so',
  '    obbo obbo', '    oooo oooo',
 ], { ...heroColors, p: '#7851a7', P: '#ad79d0', b: '#4d416e', c: '#4c9890', C: '#a4e9cd', y: '#b87355', Y: '#efb866', O: '#ffc773' }));
 add('slime', pixelSprite(['      ggggg     ', '    ggGGGGGgg   ', '   gGGGGGllGGg  ', '  gGGGGGGGlGGGg ', ' gGGGGGGGGGGGGGg', ' gGGdoGGGGdoGGGg', ' gGGooGGGGooGGGg', ' gGGGGGGGGGGGGGg', '  ggGGGddGGGggg ', '   ggggggggggg  '], { ...palette, g: '#226d83', G: '#55d0c4' }));
 add('goblin', pixelSprite(['       rrr      ', '      rrRrr     ', '  go ogggggo og ', '  gGogGGGGGogGg ', '   gGGlGGGlGGg  ', '    gGoGGoGg    ', '     gGssGg     ', '     ohhhho     ', '   oghGhGhgo  a ', '   osghhggso aa ', '   osohhhoso ah ', '    ogggggo  h  ', '     ohhho      ', '    ogo ogo     ', '   ohho ohho    ', '   oooo oooo    '], palette));
 add('skeleton', pixelSprite(['      ooooo     ', '     obbbbbo    ', '     obllbbo    ', '     boddobo    ', '     obbdbbo    ', '      obbbo     ', '      oddo   h  ', '    obbbbbo  hh ', '    osdbdso  h h', '    obbbbo   h h', '     obdbo   h h', '     obbbo   hh ', '     obdbo   h  ', '    obo obo     ', '    obo obo     ', '   obbo obbo    ', '   oooo oooo    '], palette));
 add('bat', pixelSprite([' o              o ', ' opo    oo    opo ', ' oppo  oppo  oppo ', ' opppoopPpooppppo ', ' opppppPPpppppppo ', '  opppPlPlPppppo  ', '   oppPPPPPPppo   ', '    ooopppooo     ', '       opo        '], palette));
 add('boss', pixelSprite(['           oooooo           ', '       oo oaddddao oo       ', '       oyoaaaddaaoyo        ', '       oyaaaddaaayo         ', '       oaaaggggaaao         ', '       ogGGGGGGGGgo         ', '      ogGlGGGGlGGGgo        ', '       gGdoGGdoGGGg         ', '      ogGGsssssGGGgo        ', '       ogGwlwlwGGgo         ', '        oggggggggo          ', '    oooodhhhhhhddooo        ', '   oaaaadddhhdddaaaao       ', '  ogaaaaaaddddaaaaaaago     ', '  ogGGaaddddddddaaGGGgo  a  ', '  ogGGGoddhhdhddoGGGGgo aaa ', '  ogGGGoddhhddhdoGGGGgo aaa ', '   ogGgoddddddddogGGgo aaaaa', '    ooooddddddddoooo   aaaaa', '       ohhhhhhhho       h  ', '       oddddddddo       h  ', '       ogGgoodGGgo      h  ', '       ogGgo ogGgo      h  ', '       ogGgo ogGgo      h  ', '      ohhhho ohhhho     h  ', '      oooooo oooooo        '], palette));
 add('brute', pixelSprite(['  a   a   a  ', ' aadddddaa   ', ' addlllllda  ', ' adlldldlda  ', '  ddllllld   ', ' dddddddddd  ', 'aaddddddddaa ', 'aalllldlllaa ', '  dddddddd   ', '  ddd  ddd   ', '  ooo  ooo   '], { ...palette, a: '#82998a', d: '#485764', l: '#beceaa' }));
 add('shaman', pixelSprite(['     ppp     ', '    pPPpp    ', '   pPPPppp   ', '  pPllPllpp  ', '   pPPPPpp   ', '    ppppp    ', '  pPPPPPPpp  ', ' pPPPPPPPPpp ', ' pPPPPPPPPpp ', '  ppppppppp  ', '   oo  oo    '], { p: '#493c60', P: '#9474a4', l: '#bded9b', o: '#26352d' }));
 add('warden', pixelSprite([' a   a     a   a ', ' aa  aa   aa  aa ', '  aadddddddddaa  ', '   ddPPPPPPPdd   ', '  ddPPllPllPPdd  ', '   dPPPPPPPPPd   ', '    dPPPpPPPd    ', '   aaadddddaaa   ', ' aadddddddddddaa ', 'adddPPdddPPddddda', 'addPPPPdPPPPdddda', ' addddddddddddda ', '   ddddddddddd   ', '   dd  ddd  dd   ', '  aaa  aaa  aaa  '], { a: '#9a9c74', d: '#344a45', P: '#8b6e9b', p: '#bda0ba', l: '#f7d48f' }));
 add('briar', pixelSprite([
  '   h                h', '   hh     oooo     hh', '   hoh   oaAAao   hoh', '    hoh oAAaaAAo hoh',
  '     oooaddddaooo', '    oggoaddddagoggo', '   ogGGoddccddoGGgo', '   ogGGodcLlcdoGGgo',
  '    oggaadccdaaggo', '    oaasodddosaaao', '   oddaAaooooaaaddo', '  odddhAAahaaadddddo',
  '  odoodAAaAAadooddo', '  oohhoddadddohhhoo', '   hh  oooooo  hh', '       oddddo',
  '      oao  oao', '      odd  ddo', '     ohho  ohho', '     oooo  oooo',
 ], { o: '#30284a', h: '#80534c', a: '#9775bd', A: '#d0aff0', d: '#564976', g: '#396260', G: '#78ad92', c: '#e99545', L: '#fff3ab', l: '#fcbd65', s: '#ae765d' }));
 add('arrow', canvas(19, 5, c => { rect(c, '#e5d7a3', 0, 2, 16, 1); rect(c, '#a6cdb7', 14, 1, 3, 3); rect(c, '#edf0cf', 17, 2, 2, 1); rect(c, '#cbd2b1', 0, 0, 4, 1); rect(c, '#cbd2b1', 0, 4, 4, 1); }));
 add('magic', canvas(13, 13, c => { rect(c, '#554875', 2, 2, 9, 9); rect(c, '#a89de0', 1, 4, 11, 5); rect(c, '#b5b1ee', 4, 1, 5, 11); rect(c, '#e0d9ff', 3, 3, 7, 7); rect(c, '#f4f0d4', 5, 4, 3, 4); }));
 add('blade', canvas(20, 13, c => { rect(c, '#a8e8da', 0, 5, 20, 3); rect(c, '#d5fff0', 3, 3, 13, 7); rect(c, '#efffe0', 7, 1, 4, 11); }));
 add('enemy', canvas(10, 10, c => { rect(c, '#a5564f', 0, 3, 10, 4); rect(c, '#e49c79', 2, 1, 6, 8); rect(c, '#ffd8a2', 4, 3, 3, 4); }));
 add('tree', canvas(58, 73, c => {
  rect(c, '#416478', 9, 64, 40, 6);
  rect(c, '#75524d', 25, 29, 8, 38);
  rect(c, '#e3a479', 26, 41, 3, 21);
  const canopy = (x: number, y: number, w: number, h: number, tone: string) => {
   rect(c, '#266c72', x + 3, y + 6, w - 6, h);
   rect(c, tone, x, y + 5, w, h - 9);
   rect(c, tone, x + 5, y, w - 10, h);
  };
  canopy(5, 21, 50, 26, '#409c94');
  canopy(0, 13, 38, 28, '#51ada1');
  canopy(17, 4, 39, 32, '#74c6a4');
  rect(c, '#a3dcaf', 24, 8, 20, 5);
  rect(c, '#ffe296', 11, 23, 3, 3);
  rect(c, '#ffd28d', 42, 23, 4, 4);
 }));
 add('pine', canvas(42, 63, c => {
  rect(c, '#895e57', 19, 35, 6, 25);
  for (let section = 0; section < 3; section++) {
   const y = 3 + section * 12;
   for (let row = 0; row < 11; row++) {
    const width = 6 + section * 4 + row * 2;
    rect(c, row > 8 ? '#27758a' : section === 0 ? '#6bc3bd' : '#40999f', 21 - width / 2, y + row * 2, width, 2);
   }
  }
 }));
 add('bush', canvas(26, 17, c => {
  rect(c, '#438e87', 2, 6, 22, 10);
  rect(c, '#78bd8a', 4, 3, 19, 10);
  rect(c, '#a4d2a3', 7, 0, 12, 8);
  for (const [x, y] of [[6, 6], [12, 3], [20, 8]]) rect(c, '#ffde77', x, y, 2, 2);
 }));
 add('rock', canvas(24, 18, c => { rect(c, '#293c34', 0, 13, 24, 4); rect(c, '#5c6759', 2, 5, 20, 10); rect(c, '#748074', 5, 1, 14, 12); rect(c, '#9a9f87', 6, 1, 9, 3); rect(c, '#3e5c40', 2, 12, 12, 3); }));
 add('stump', canvas(21, 19, c => { rect(c, '#443e2b', 3, 3, 15, 14); rect(c, '#826841', 4, 0, 13, 8); rect(c, '#b09861', 6, 2, 9, 4); rect(c, '#5f4f32', 8, 2, 3, 2); rect(c, '#7c7044', 5, 9, 2, 6); rect(c, '#35563a', 0, 16, 21, 3); }));
 add('mushroom', canvas(15, 13, c => { rect(c, '#d6c29b', 6, 6, 3, 7); rect(c, '#963e39', 1, 3, 13, 5); rect(c, '#be6852', 3, 0, 9, 7); rect(c, '#edc68d', 5, 1, 2, 2); rect(c, '#edc68d', 10, 4, 2, 2); }));
 add('lantern', canvas(14, 37, c => { rect(c, '#403f2d', 6, 1, 3, 36); rect(c, '#9a8652', 0, 1, 12, 2); rect(c, '#4c4430', 1, 4, 10, 14); rect(c, '#f1b564', 3, 6, 6, 9); rect(c, '#ffe3a0', 5, 8, 2, 5); rect(c, '#a98a4e', 0, 4, 12, 2); rect(c, '#a98a4e', 1, 17, 10, 2); }));
 add('terrain', canvas(432, 1024, c => {
  const rng = random(112);
  rect(c, '#b8d9a5', 0, 0, 432, 1024);
  // Broad, clean bands keep foreground attacks readable at phone size.
  for (let y = 0; y < 1024; y += 4) {
   const sway = Math.sin(y / 1024 * Math.PI * 2);
   const center = 216 + sway * 35;
   const width = 162 + Math.sin(y / 1024 * Math.PI * 4) * 26;
   rect(c, '#85c5a6', 0, y, 48 + sway * 14, 4);
   rect(c, '#91c7a1', 377 + sway * 13, y, 72, 4);
   rect(c, '#d7dc9d', center - width / 2 - 10, y, width + 20, 4);
   rect(c, '#efce9d', center - width / 2, y, width, 4);
   rect(c, '#f4d8aa', center - width / 2 + 7, y, width - 14, 4);
  }
  for (let i = 0; i < 430; i++) {
   const x = rng() * 432, y = rng() * 1024;
   const center = 216 + Math.sin(y / 1024 * Math.PI * 2) * 35;
   if (Math.abs(x - center) < 62) {
    rect(c, '#e6bd8c', x, y, 2 + rng() * 6, 2);
   } else {
    rect(c, '#82b591', x, y, 2, 6);
    rect(c, '#96c99c', x - 3, y + 2, 3, 3);
    if (i % 5 === 0) rect(c, i % 2 ? '#fff1ae' : '#ee8f7e', x - 1, y - 2, 4, 3);
   }
  }
 }));
}
export function portrait(id: string, className = '') { return `<img class="pixel-portrait ${className}" src="${artUrls[id] ?? ''}" alt="" draggable="false">`; }
