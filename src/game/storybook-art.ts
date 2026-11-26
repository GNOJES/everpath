type Draw = (ctx: CanvasRenderingContext2D) => void;
type Rect = (ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => void;

export function createStorybookArt(
 add: (key: string, source: HTMLCanvasElement) => void,
 sprite: (map: string[], colors: Record<string, string>) => HTMLCanvasElement,
 canvas: (width: number, height: number, draw: Draw) => HTMLCanvasElement,
 rect: Rect,
 random: (seed: number) => () => number,
) {
 const ink = { o: '#3b2a47', s: '#eba770', S: '#ffe0a8', W: '#fff9de', y: '#bc7344', Y: '#f9ca69' };
 add('field-warrior', sprite([
  '     ooooo', '    ooooooo', '   obBWWBbo', '  obBBWBbBbo',
  '  obBBbBBBbo', '  oBbooooBbo', '  oyooSSSoYo', '   oooSSSoo          oo',
  '    ooSsoo          oLlo', '    oRRRoo         oLLlo', '   oRoBBoBo       oLLlo',
  '  oRRbBWBbBo     oLLlo', '  oRRoBBbBBbo   oLLlo', '  oRRoBBBBbbo  oLLlo',
  '  orooBBboBBo oLLlo', '  orooBYYYBoooyylo', '  ooroYYYYBooSYYo',
  '   oobbbBbooooyyo', '    obboBbo    oo', '    obo obo', '    obo obo',
  '    obbo obbo', '    oooo oooo',
 ], { ...ink, R: '#e65848', r: '#9f3436', b: '#52698f', B: '#8dbace', L: '#f0faff', l: '#a5d8ec' }));
 add('field-archer', sprite([
  '      oooo', '     oGGGGo', '    oGLLGGGo', '   oGLGGggGo',
  '   oGGgooogo', '   oGgrRRSo       oo', '   ogorRSoSo     oYso',
  '    oosSSsSo     os oyo', '    ogosSso      os  oYo',
  '   oGggooo       os   oYo', '  oLGgoGGGo       os   oYo',
  '  oGgogGLGoo       os  oYo', '  oggogpYGgSooooooosSYo',
  '  oggogGgGGsoSSSSSSoyo', '   ogoGggGgo        soYo',
  '    oogYYgo        osYo', '     obbbbo        oYo',
  '     obobbo       oyo', '     obo obo     oyo', '    obbo obbo   oo',
  '    oooo oooo',
 ], { ...ink, G: '#79b75e', L: '#c8ea93', g: '#407c63', b: '#664c63', R: '#c95e40', r: '#944336', p: '#85629b' }));
 add('field-mage', sprite([
  '         oo', '        oPPo', '       oPPpo', '      oPPpo',
  '     oPPpYo        oo', '    oPPPYpoo      ocCo', '  oooPPPPPPoo    oCWCCo',
  ' oPPPPPPPPPPPo   oCWCCo', '  oooooooooooo    ocCo', '    obSSSSbo       oo',
  '    obSoSSoo      oYo', '     osSSSoo      oYo', '    ooosoo       oYo',
  '   oPcPPPo     ooYo', '   oPoPWPPoooooSSYo', '  oPPoPYPPoooSSooYo',
  '  oPPpPPPPo   oo oYo', '  oPPpPPPPpo     oYo', '  oppPPPPPpo     oYo',
  '   ooooooooo     oYo', '    obo obo      oyo', '    obbo obbo    oyo',
  '    oooo oooo     oo',
 ], { ...ink, p: '#64538e', P: '#b187d4', b: '#5a446f', c: '#37aa9d', C: '#8febca' }));
 add('storybook-grorm', sprite([
  '          ooooooo', '     oo  oaaaaaao  oo', '     oyoaAaaaAaaooyo',
  '     oyYAaaaAaaaayYo', '      oaAAAAAAAAao', '      oaggGGGggaao',
  '      ogGYGGGYGgo', '     oggGooGooGggo', '     ogGGGGGGGGGgo',
  '      oggoWWoggo', '      ooGGGGGoo', '   oooaaoooooaoaooo',
  '  oaaAaaaaaAaaaaAao', ' ogGaAaaoHHHoaaAGGgo',
  ' oGGGAaoHyYyHoaAGGGo', ' oGGGoaHHYWHHaaoGGGo',
  '  oGgoaaHHHHaaogGGo', '   ooooaaaaaaooooo',
  '      ooaAaaao', '      oaaAaaao', '      oaAaoaAo',
  '     ogGooogGgo', '     ogGo  ogGo', '     oggo  oggo',
  '    ogggo  ogggo', '    ooooo  ooooo',
 ], { ...ink, a: '#78505a', A: '#b37b63', g: '#4c8460', G: '#95bd5d', H: '#c0855b' }));

 add('terrain', canvas(432, 1024, ctx => {
  const rng = random(216);
  rect(ctx, '#88dfa5', 0, 0, 432, 1024);
  for (let y = 0; y < 1024; y += 4) {
   const turn = y / 1024 * 2 * Math.PI;
   const center = 216 + Math.sin(turn) * 29;
   const width = 159 + Math.cos(turn * 2) * 22;
   const left = center - width / 2;
   rect(ctx, '#50c7a1', 0, y, 43 + Math.sin(turn) * 12, 4);
   rect(ctx, '#61cfa0', 383 + Math.sin(turn) * 10, y, 49 - Math.sin(turn) * 10, 4);
   rect(ctx, '#a8ebbd', left - 16, y, width + 32, 4);
   rect(ctx, '#b6d6e5', left - 6, y, width + 12, 4);
   rect(ctx, '#e5f1f6', left, y, width, 4);
  }
  // Paint the light into the repeating ground texture so there is no frame-by-frame filter.
  for (let i = 0; i < 11; i++) {
   const x = 39 + rng() * 350, y = rng() * 1024;
   const width = 42 + rng() * 53;
   ctx.globalAlpha = .22;
   for (const offset of [-1024, 0, 1024]) {
    for (let row = 0; row < 9; row++) {
     const chord = width * Math.sin((row + .5) * Math.PI / 9);
     rect(ctx, '#f4ffff', x - chord / 2 - row * 3, y + offset + row * 4, chord, 4);
    }
   }
   ctx.globalAlpha = 1;
  }
  for (let i = 0; i < 420; i++) {
   const x = rng() * 432, y = 4 + rng() * 1016;
   const turn = y / 1024 * 2 * Math.PI;
   if (Math.abs(x - (216 + Math.sin(turn) * 29)) < 69 + Math.cos(turn * 2) * 11) {
    rect(ctx, i % 3 ? '#c3ddea' : '#f5fcff', x, y, 3 + rng() * 5, 2);
    continue;
   }
   rect(ctx, '#55c991', x, y - 2, 2, 5);
   rect(ctx, '#62d3a3', x - 3, y, 3, 2);
   if (i % 6 === 0) {
    rect(ctx, i % 2 ? '#ff648e' : '#f9fcff', x - 2, y - 4, 6, 3);
    rect(ctx, '#fcec94', x, y - 4, 2, 2);
   }
  }
 }));

 add('tree', canvas(62, 75, ctx => {
  rect(ctx, '#39a989', 10, 69, 44, 5);
  rect(ctx, '#75507f', 26, 33, 10, 39);
  rect(ctx, '#b4779a', 28, 38, 4, 30);
  rect(ctx, '#75507f', 21, 49, 9, 5);
  rect(ctx, '#17697b', 3, 25, 55, 25);
  rect(ctx, '#128879', 8, 17, 50, 28);
  rect(ctx, '#1bab83', 12, 9, 41, 34);
  rect(ctx, '#46ca87', 17, 3, 29, 25);
  rect(ctx, '#87ebad', 19, 6, 23, 9);
  rect(ctx, '#64dc9e', 9, 20, 16, 11);
  rect(ctx, '#bbffd1', 21, 6, 10, 4);
  rect(ctx, '#39cf96', 42, 20, 10, 7);
  for (const [x,y] of [[14,35],[26,19],[40,32]]) rect(ctx, '#f7faff', x, y, 3, 3);
 }));
 add('bush', canvas(26, 17, ctx => {
  rect(ctx, '#17697b', 2, 6, 22, 10);
  rect(ctx, '#1bab83', 4, 3, 19, 10);
  rect(ctx, '#87ebad', 7, 0, 12, 8);
  for (const [x, y] of [[6, 8], [15, 4], [20, 8]]) rect(ctx, '#ff648e', x, y, 2, 2);
 }));
 add('rock', canvas(24, 18, ctx => {
  rect(ctx, '#17697b', 1, 12, 22, 5);
  rect(ctx, '#659bb6', 3, 5, 18, 10);
  rect(ctx, '#b6d6e5', 6, 2, 12, 7);
  rect(ctx, '#e5f1f6', 7, 2, 8, 2);
 }));
 add('pine', canvas(42, 63, ctx => {
  rect(ctx, '#75507f', 18, 34, 7, 27);
  for (let tier = 0; tier < 3; tier++) {
   for (let row = 0; row < 10; row++) {
    const width = 4 + tier * 5 + row * 2;
    const shade = row >= 8 ? '#17697b' : ['#79e6aa', '#38c691', '#23b59b'][tier];
    rect(ctx, shade, 21 - width / 2, 4 + tier * 13 + row * 2, width, 2);
   }
  }
 }));
}
