import type Phaser from 'phaser';
export const artUrls: Record<string, string> = {};
type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
function canvas(w: number, h: number, draw: Draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d')!; ctx.imageSmoothingEnabled = false; draw(ctx, w, h); return c; }
const rect = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); };
function random(seed: number) { let n = seed; return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; }; }
function pixelSprite(map: string[], colors: Record<string, string>) { return canvas(Math.max(...map.map(r => r.length)), map.length, ctx => { map.forEach((row, y) => [...row].forEach((key, x) => { if (colors[key]) rect(ctx, colors[key], x, y, 1, 1); })); }); }
const palette = { o: '#17272a', d: '#35444b', a: '#748b8c', b: '#aec0b3', l: '#e8e5c5', s: '#d7ab7f', h: '#805c42', r: '#aa5947', R: '#df8c60', g: '#4f805a', G: '#8fba79', p: '#75648f', P: '#b9a2d4', c: '#81cdd1', y: '#ebd699', w: '#f6f0cf' };
const heroMaps = {
 warrior: ['       oo       ', '     oaaaao     ', '    oabbbbao    ', '    oaddddao    ', '    oalsslao    ', '     osssso     ', '     orrro      ', '   oaarRraao    ', '  oabaarabaab   ', '  osdabbbaaso   ', '  osoabbbaoso l ', '   ooaabaaao  l ', '    oadddao  ll ', '   oadddddao ll ', '   oddoodddo ol ', '   oddo oddo oh ', '   ohho ohho    ', '  odddo odddo   ', '  ooooo ooooo   '],
 archer: ['       oo       ', '      oggo      ', '     ogGGgo     ', '    oggGGggo    ', '    ogshhsgo    ', '    ogsswsgo h  ', '     ogssgo  hh ', '     ogggo   h h', '   ogGGGGggo h h', '   oshGGhso  h h', '   osghhgs   h h', '    oghhgo   h h', '    ogGGgo   hh ', '   ogGGGGgo  h  ', '    oddddo      ', '    odoodo      ', '    oh  ho      ', '   ohhoohho     ', '   ooo oooo     '],
 mage: ['        p       ', '       opo      ', '      opPpo     ', '     oppPppo    ', '    opppPPppo   ', '   oPPPPPPPPPo  ', '    oswsswso  c ', '     osssso  cwc', '     oppppo   c ', '   opPPPPppo  h ', '   osPpPpPso  h ', '   osppPppso  h ', '    opPPppo   h ', '    oppPppo   h ', '   opppPpppo  h ', '   opPPPPPpo  h ', '  opppPpPpppo h ', '  oPPPPPPPPPo   ', '  ooooooooooo   '],
};
export function createArt(scene: Phaser.Scene) {
 const add = (key: string, source: HTMLCanvasElement) => { if (!scene.textures.exists(key)) scene.textures.addCanvas(key, source); artUrls[key] = source.toDataURL(); };
 for (const [key, map] of Object.entries(heroMaps)) add(key, pixelSprite(map, palette));
 add('slime', pixelSprite(['      ggggg     ', '    ggGGGGGgg   ', '   gGGGGGllGGg  ', '  gGGGGGGGlGGGg ', ' gGGGGGGGGGGGGGg', ' gGGdoGGGGdoGGGg', ' gGGooGGGGooGGGg', ' gGGGGGGGGGGGGGg', '  ggGGGddGGGggg ', '   ggggggggggg  '], { ...palette, g: '#356c51', G: '#80b868' }));
 add('goblin', pixelSprite(['       rrr      ', '      rrRrr     ', '  go ogggggo og ', '  gGogGGGGGogGg ', '   gGGlGGGlGGg  ', '    gGoGGoGg    ', '     gGssGg     ', '     ohhhho     ', '   oghGhGhgo  a ', '   osghhggso aa ', '   osohhhoso ah ', '    ogggggo  h  ', '     ohhho      ', '    ogo ogo     ', '   ohho ohho    ', '   oooo oooo    '], palette));
 add('skeleton', pixelSprite(['      ooooo     ', '     obbbbbo    ', '     obllbbo    ', '     boddobo    ', '     obbdbbo    ', '      obbbo     ', '      oddo   h  ', '    obbbbbo  hh ', '    osdbdso  h h', '    obbbbo   h h', '     obdbo   h h', '     obbbo   hh ', '     obdbo   h  ', '    obo obo     ', '    obo obo     ', '   obbo obbo    ', '   oooo oooo    '], palette));
 add('bat', pixelSprite([' o              o ', ' opo    oo    opo ', ' oppo  oppo  oppo ', ' opppoopPpooppppo ', ' opppppPPpppppppo ', '  opppPlPlPppppo  ', '   oppPPPPPPppo   ', '    ooopppooo     ', '       opo        '], palette));
 add('boss', pixelSprite(['           oooooo           ', '       oo oaddddao oo       ', '       oyoaaaddaaoyo        ', '       oyaaaddaaayo         ', '       oaaaggggaaao         ', '       ogGGGGGGGGgo         ', '      ogGlGGGGlGGGgo        ', '       gGdoGGdoGGGg         ', '      ogGGsssssGGGgo        ', '       ogGwlwlwGGgo         ', '        oggggggggo          ', '    oooodhhhhhhddooo        ', '   oaaaadddhhdddaaaao       ', '  ogaaaaaaddddaaaaaaago     ', '  ogGGaaddddddddaaGGGgo  a  ', '  ogGGGoddhhdhddoGGGGgo aaa ', '  ogGGGoddhhddhdoGGGGgo aaa ', '   ogGgoddddddddogGGgo aaaaa', '    ooooddddddddoooo   aaaaa', '       ohhhhhhhho       h  ', '       oddddddddo       h  ', '       ogGgoodGGgo      h  ', '       ogGgo ogGgo      h  ', '       ogGgo ogGgo      h  ', '      ohhhho ohhhho     h  ', '      oooooo oooooo        '], palette));
 add('brute', pixelSprite(['  a   a   a  ', ' aadddddaa   ', ' addlllllda  ', ' adlldldlda  ', '  ddllllld   ', ' dddddddddd  ', 'aaddddddddaa ', 'aalllldlllaa ', '  dddddddd   ', '  ddd  ddd   ', '  ooo  ooo   '], { ...palette, a: '#82998a', d: '#485764', l: '#beceaa' }));
 add('shaman', pixelSprite(['     ppp     ', '    pPPpp    ', '   pPPPppp   ', '  pPllPllpp  ', '   pPPPPpp   ', '    ppppp    ', '  pPPPPPPpp  ', ' pPPPPPPPPpp ', ' pPPPPPPPPpp ', '  ppppppppp  ', '   oo  oo    '], { p: '#493c60', P: '#9474a4', l: '#bded9b', o: '#26352d' }));
 add('warden', pixelSprite([' a   a     a   a ', ' aa  aa   aa  aa ', '  aadddddddddaa  ', '   ddPPPPPPPdd   ', '  ddPPllPllPPdd  ', '   dPPPPPPPPPd   ', '    dPPPpPPPd    ', '   aaadddddaaa   ', ' aadddddddddddaa ', 'adddPPdddPPddddda', 'addPPPPdPPPPdddda', ' addddddddddddda ', '   ddddddddddd   ', '   dd  ddd  dd   ', '  aaa  aaa  aaa  '], { a: '#9a9c74', d: '#344a45', P: '#8b6e9b', p: '#bda0ba', l: '#f7d48f' }));
 add('arrow', canvas(19, 5, c => { rect(c, '#e5d7a3', 0, 2, 16, 1); rect(c, '#a6cdb7', 14, 1, 3, 3); rect(c, '#edf0cf', 17, 2, 2, 1); rect(c, '#cbd2b1', 0, 0, 4, 1); rect(c, '#cbd2b1', 0, 4, 4, 1); }));
 add('magic', canvas(13, 13, c => { rect(c, '#554875', 2, 2, 9, 9); rect(c, '#a89de0', 1, 4, 11, 5); rect(c, '#b5b1ee', 4, 1, 5, 11); rect(c, '#e0d9ff', 3, 3, 7, 7); rect(c, '#f4f0d4', 5, 4, 3, 4); }));
 add('blade', canvas(20, 13, c => { rect(c, '#a8e8da', 0, 5, 20, 3); rect(c, '#d5fff0', 3, 3, 13, 7); rect(c, '#efffe0', 7, 1, 4, 11); }));
 add('enemy', canvas(10, 10, c => { rect(c, '#a5564f', 0, 3, 10, 4); rect(c, '#e49c79', 2, 1, 6, 8); rect(c, '#ffd8a2', 4, 3, 3, 4); }));
 add('tree', canvas(54, 83, c => {
  const rng = random(18); rect(c, '#132e29', 9, 66, 40, 9); rect(c, '#3e4130', 25, 47, 8, 30); rect(c, '#6b6240', 27, 51, 3, 23); rect(c, '#374b32', 20, 73, 18, 4);
  const leaf = (x: number, y: number, w: number, h: number, color: string) => { rect(c, '#172f29', x + 4, y + h - 3, w - 4, 7); rect(c, color, x, y + 5, w, h - 10); rect(c, color, x + 5, y, w - 10, h); };
  leaf(3, 29, 48, 31, '#244c3b'); leaf(1, 20, 49, 29, '#2b5940'); leaf(8, 9, 39, 36, '#326244'); leaf(16, 2, 27, 32, '#3d7050');
  for (let i = 0; i < 80; i++) { const x = 7 + rng() * 39, y = 7 + rng() * 45; if ((x - 28) ** 2 / 550 + (y - 30) ** 2 / 850 < 1) rect(c, rng() > .5 ? '#4c7a4f' : '#3d6e46', x, y, 2 + Math.floor(rng() * 4), 2); }
 }));
 add('pine', canvas(40, 78, c => { rect(c, '#4f5135', 18, 51, 5, 24); for (let i = 0; i < 5; i++) { const y = 3 + i * 12, w = 8 + i * 7; for (let j = 0; j < 13; j++) { const rw = Math.min(w, 2 + j * 2); rect(c, j > 10 ? '#1a3e32' : i % 2 ? '#2c5741' : '#356347', 20 - rw / 2, y + j, rw, 2); } } }));
 add('bush', canvas(26, 17, c => { rect(c, '#193e31', 2, 5, 22, 10); rect(c, '#3e6b43', 4, 2, 19, 10); rect(c, '#508052', 6, 0, 11, 9); for (const [x, y] of [[3, 6], [12, 3], [21, 7], [17, 11]]) rect(c, '#c48c74', x, y, 2, 2); }));
 add('rock', canvas(24, 18, c => { rect(c, '#293c34', 0, 13, 24, 4); rect(c, '#5c6759', 2, 5, 20, 10); rect(c, '#748074', 5, 1, 14, 12); rect(c, '#9a9f87', 6, 1, 9, 3); rect(c, '#3e5c40', 2, 12, 12, 3); }));
 add('stump', canvas(21, 19, c => { rect(c, '#443e2b', 3, 3, 15, 14); rect(c, '#826841', 4, 0, 13, 8); rect(c, '#b09861', 6, 2, 9, 4); rect(c, '#5f4f32', 8, 2, 3, 2); rect(c, '#7c7044', 5, 9, 2, 6); rect(c, '#35563a', 0, 16, 21, 3); }));
 add('mushroom', canvas(15, 13, c => { rect(c, '#d6c29b', 6, 6, 3, 7); rect(c, '#963e39', 1, 3, 13, 5); rect(c, '#be6852', 3, 0, 9, 7); rect(c, '#edc68d', 5, 1, 2, 2); rect(c, '#edc68d', 10, 4, 2, 2); }));
 add('lantern', canvas(14, 37, c => { rect(c, '#403f2d', 6, 1, 3, 36); rect(c, '#9a8652', 0, 1, 12, 2); rect(c, '#4c4430', 1, 4, 10, 14); rect(c, '#f1b564', 3, 6, 6, 9); rect(c, '#ffe3a0', 5, 8, 2, 5); rect(c, '#a98a4e', 0, 4, 12, 2); rect(c, '#a98a4e', 1, 17, 10, 2); }));
 add('terrain', canvas(432, 1024, c => {
  const rng = random(112); rect(c, '#233d2e', 0, 0, 432, 1024);
  for (let y = 0; y < 1024; y += 4) { const center = 216 + Math.sin(y / 1024 * Math.PI * 2) * 34, width = 135 + Math.sin(y / 1024 * Math.PI * 4) * 10; rect(c, '#3c4c32', center - width / 2 - 13, y, width + 26, 4); rect(c, '#69694a', center - width / 2, y, width, 4); rect(c, '#737052', center - width / 2 + 6, y, width - 12, 4); }
  for (let i = 0; i < 11500; i++) { const x = rng() * 432, y = rng() * 1024, center = 216 + Math.sin(y / 1024 * Math.PI * 2) * 34, onPath = Math.abs(x - center) < 65;
   const colors = onPath ? ['#7e7959', '#68694c', '#8d825c', '#5d6145'] : ['#2b4733', '#35513a', '#3e583c', '#1c372b', '#466043']; rect(c, colors[Math.floor(rng() * colors.length)], x, y, onPath ? 2 + Math.floor(rng() * 5) : 2, onPath ? 2 : 3);
  }
  for (let i = 0; i < 55; i++) { const y = rng() * 1024, center = 216 + Math.sin(y / 1024 * Math.PI * 2) * 34, x = center + (rng() - .5) * 100; rect(c, '#515b43', x, y + 2, 5 + Math.floor(rng() * 8), 4); rect(c, '#a39a73', x, y, 5 + Math.floor(rng() * 6), 3); }
  for (let i = 0; i < 170; i++) { const x = rng() < .5 ? 70 + rng() * 65 : 300 + rng() * 65, y = rng() * 1024; rect(c, '#6e8850', x, y, 1, 5); rect(c, '#8b9c63', x - 2, y + 1, 5, 2); if (rng() > .55) rect(c, '#d5ba7f', x, y, 2, 2); }
 }));
}
export function portrait(id: string, className = '') { return `<img class="pixel-portrait ${className}" src="${artUrls[id] ?? ''}" alt="" draggable="false">`; }
