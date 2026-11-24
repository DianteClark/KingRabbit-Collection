// Every room of Hollow Crown as data. Map legend: see tiles.js.
// Room ids are `${area}:${x},${y}`. Rooms in the same area that sit next to each other on the
// grid connect through matching openings on their shared edge (tests check they match).
// Interiors ('in') are single rooms reached through warps.

export const ROOMS = {};

function R(area, x, y, spec) {
  const id = `${area}:${x},${y}`;
  ROOMS[id] = { id, area, gx: x, gy: y, enemies: [], npcs: [], warps: [], houses: [], signs: {}, chests: {}, on: {}, exits: {}, ...spec };
}
function I(name, spec) {
  const id = `in:${name}`;
  ROOMS[id] = { id, area: 'in', gx: 0, gy: 0, enemies: [], npcs: [], warps: [], houses: [], signs: {}, chests: {}, on: {}, exits: {}, ...spec };
}

export const START = { room: 'in:elder', x: 5, y: 8, dir: 'up' };

// ------------------------------------------------------------------ overworld: Fernwick Vale

R('ow', 0, 2, {
  theme: 'village', name: 'Fernwick',
  map: [
    'TTTT...TTTT',
    'TT,......TT',
    'T.hhhhh.,.T',
    'T.hhhhh...T',
    'T.hhhhh..,T',
    'T.hDhhh....',
    'T..::::::::',
    'T.,:.,.....',
    'T..:..v..,T',
    'T,.:......T',
    'T..b..ff.bT',
    'TT...,...TT',
    'TTTTTTTTTTT',
  ],
  houses: [{ x: 2, y: 2, roof: 'green' }],
  warps: [{ x: 3, y: 5, to: 'in:elder', tx: 5, ty: 11, dir: 'up' }],
  npcs: [{ x: 8, y: 9, who: 'mira' }],
  signs: { '6,8': ['Fernwick village.', 'North: Mosswood.  East: the market and the lake.'] },
});

R('ow', 1, 2, {
  theme: 'village', name: 'Fernwick',
  map: [
    'TT...TTTTTT',
    'T.....hhhhh',
    'T.,...hhhhh',
    'T.....hhhhh',
    'T..:..hDhhh',
    '...:...:...',
    ':::::::::::',
    '..,....,...',
    'T..v......T',
    'T.....,...T',
    'T.ff...ff.T',
    'T....,....T',
    'TTTTTTTTTTT',
  ],
  houses: [{ x: 6, y: 1, roof: 'red' }],
  warps: [{ x: 7, y: 4, to: 'in:shop', tx: 5, ty: 11, dir: 'up' }],
  npcs: [{ x: 2, y: 9, who: 'pip' }, { x: 9, y: 8, who: 'wen' }],
  signs: { '3,8': ["Odo's Shop: potions, bombs and more.", 'North of here: the open fields.'] },
});

R('ow', 2, 2, {
  theme: 'field', name: 'Lake Sorrel',
  map: [
    'TTTT...wwTT',
    'T......ww.T',
    'T..,..www.T',
    'T..wwwwww.T',
    'T.wwwwwww.T',
    '..wwwwwww.T',
    '..wwwwwww.T',
    '...wwwww..T',
    'T,.......,T',
    'T..###....T',
    'T..#c#..v.T',
    'TT.......TT',
    'TTTTTTTTTTT',
  ],
  warps: [{ x: 4, y: 10, to: 'in:cave', tx: 5, ty: 11, dir: 'up' }],
  signs: { '8,10': ['That rock to the west has a deep crack in it.', 'Something that goes BOOM might open it.'] },
  enemies: [['slime', 6, 9], ['slime', 2, 8]],
});

R('ow', 1, 1, {
  theme: 'field', name: 'Open Fields',
  map: [
    'TTTT...TTTT',
    'T.....,...T',
    'T.r.....b.T',
    'T....:....T',
    'T,...:v.,.T',
    '..:::::::..',
    '...:...:...',
    '...:.,.:...',
    'T..:...:..T',
    'T..:.r.:,.T',
    'T,.:.....bT',
    'T..:.....,T',
    'TT...TTTTTT',
  ],
  signs: { '6,4': ['North: Northwood.  West: Mosswood.', 'East: the river and the old Ember Lab.'] },
  enemies: [['slime', 2, 3], ['slime', 8, 9], ['slime', 6, 7]],
});

R('ow', 0, 1, {
  theme: 'forest', name: 'Mosswood',
  map: [
    'TTTT...TTTT',
    'TTT.....TTT',
    'TT..b.b..TT',
    'T..Yy...YyT',
    'T..yy...yyT',
    'T..........',
    'T....,.....',
    'TT.........',
    'T..b...b..T',
    'T.Yy...Yy.T',
    'T.yy.,.yy.T',
    'TT.......TT',
    'TTTT...TTTT',
  ],
  enemies: [['slime', 5, 5], ['slime', 3, 7], ['blueSlime', 6, 10]],
});

R('ow', 0, 0, {
  theme: 'forest', name: 'Mosswood',
  map: [
    '###########',
    '###########',
    '###########',
    '#####e#####',
    'TT.....v.TT',
    'T..b.:.b...',
    'T.,..:...,.',
    'T....:.....',
    'T.Yy.:.Yy.T',
    'T.yy.:.yy.T',
    'T.,..:....T',
    'TT...:...TT',
    'TTTT...TTTT',
  ],
  warps: [{ x: 5, y: 3, to: 'd1:1,2', tx: 5, ty: 11, dir: 'up' }],
  signs: { '7,4': ['MOSSY HOLLOW', 'Slimes live down there. Mind the hopping ones.'] },
  enemies: [['slime', 3, 7], ['slime', 8, 10]],
});

R('ow', 1, 0, {
  theme: 'forest', name: 'Northwood',
  map: [
    'TTTTTTTTTTT',
    'TTT.....TTT',
    'TT..Yy...TT',
    'T...yy..b.T',
    'T,........T',
    '...b...r...',
    '...........',
    '....,......',
    'T.r....Yy.T',
    'T......yy.T',
    'TT..b....TT',
    'TTT.....TTT',
    'TTTT...TTTT',
  ],
  enemies: [['gremlin', 7, 3], ['gremlin', 3, 9], ['slime', 5, 6]],
});

R('ow', 2, 0, {
  theme: 'mountain', name: 'Grey Peaks',
  map: [
    '###########',
    '###########',
    '###########',
    '#####e#####',
    '####rcr####',
    '..r.....r.#',
    '......v...#',
    '...,..r...#',
    '#.r.......#',
    '##....,..##',
    '###.....###',
    '####...####',
    '####...####',
  ],
  warps: [{ x: 5, y: 3, to: 'd3:1,2', tx: 5, ty: 11, dir: 'up' }],
  signs: { '6,6': ['HOLLOW KEEP', 'The Gremlin King sealed the way with a great rock.'] },
  enemies: [['golem', 4, 8], ['gremlin', 8, 6]],
});

R('ow', 2, 1, {
  theme: 'field', name: 'Ember River',
  map: [
    'TTTT...T###',
    'T......T###',
    'T.....v.#e#',
    'T,.....ww.#',
    'T......ww.#',
    '::::::.WW.#',
    '.......ww.#',
    '.......ww,#',
    'T......wwX#',
    'T..b...ww.#',
    'T.....,ww.#',
    'TT.....ww.#',
    'TTTT...wwTT',
  ],
  warps: [{ x: 9, y: 2, to: 'd2:1,2', tx: 5, ty: 11, dir: 'up' }],
  signs: { '6,2': ['EMBER LAB, across the river.', 'Its bridge is raised. The crystal on the far bank lowers it.'] },
  on: { crystal: { bridge: true } },
  enemies: [['blueSlime', 3, 3], ['slime', 4, 9]],
});

// ------------------------------------------------------------------ interiors

I('elder', {
  theme: 'house', name: "Elder Bram's house",
  map: [
    '###########',
    '###########',
    '#ll....FF.#',
    '#.........#',
    '#.q.....m.#',
    '#.q.......#',
    '#.........#',
    '#.........#',
    '#..m......#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#####D#####',
  ],
  npcs: [{ x: 5, y: 5, who: 'elder' }],
  warps: [{ x: 5, y: 12, to: 'ow:0,2', tx: 3, ty: 6, dir: 'down' }],
});

I('shop', {
  theme: 'house', name: "Odo's Shop",
  map: [
    '###########',
    '###########',
    '#l.l...l.l#',
    '#.........#',
    '#.._____..#',
    '#.........#',
    '#.........#',
    '#.m.....m.#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#####D#####',
  ],
  npcs: [{ x: 5, y: 3, who: 'odo' }],
  warps: [{ x: 5, y: 12, to: 'ow:1,2', tx: 7, ty: 5, dir: 'down' }],
});

I('cave', {
  theme: 'cave', name: 'Hidden cave',
  map: [
    '###########',
    '###########',
    '###.....###',
    '##..t.t..##',
    '##.......##',
    '##...C...##',
    '##.......##',
    '###.....###',
    '####...####',
    '####...####',
    '####...####',
    '####...####',
    '#####D#####',
  ],
  chests: { '5,5': { item: 'heart' } },
  warps: [{ x: 5, y: 12, to: 'ow:2,2', tx: 4, ty: 11, dir: 'down' }],
});

// ------------------------------------------------------------------ dungeon 1: Mossy Hollow

R('d1', 1, 2, {
  theme: 'moss',
  map: [
    '#####k#####',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#..o...o..#',
    '#.........#',
    '...........',
    '#.........#',
    '#..~...~..#',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#####.#####',
  ],
  exits: { bottom: { to: 'ow:0,0', tx: 5, ty: 4, dir: 'down' } },
  enemies: [['slime', 3, 7], ['slime', 7, 5]],
});

R('d1', 0, 2, {
  theme: 'moss',
  map: [
    '###########',
    '#.........#',
    '#.##...##.#',
    '#.#.....#.#',
    '#.........#',
    '#....C....#',
    '#..........',
    '#.........#',
    '#.#.....#.#',
    '#.##...##.#',
    '#.........#',
    '#.........#',
    '###########',
  ],
  chests: { '5,5': { item: 'key', hidden: 'clear' } },
  on: { clear: { chest: true } },
  enemies: [['slime', 4, 3], ['slime', 6, 3], ['slime', 4, 9], ['slime', 6, 9]],
});

R('d1', 2, 2, {
  theme: 'moss',
  map: [
    '#####s#####',
    '#.........#',
    '#.##...##.#',
    '#.#..x..#.#',
    '#.#.....#.#',
    '#.........#',
    '...P......#',
    '#.........#',
    '#..#####..#',
    '#.........#',
    '#..g...g..#',
    '#.........#',
    '###########',
  ],
  on: { switch: { door: 'top' } },
  enemies: [['slime', 8, 10]],
  hint: 'Push the block onto the switch.',
});

R('d1', 2, 1, {
  theme: 'moss',
  map: [
    '###########',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#...~.~...#',
    '#....C....#',
    '#.........#',
    '#.........#',
    '#...~.~...#',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#####s#####',
  ],
  chests: { '5,5': { item: 'boomerang' } },
  enemies: [['blueSlime', 2, 8], ['blueSlime', 8, 3]],
});

R('d1', 1, 1, {
  theme: 'moss',
  map: [
    '#####K#####',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#..##.##..#',
    '#..#...#..#',
    '...#...#..#',
    '#..#...#..#',
    '#..##.##..#',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#####k#####',
  ],
  enemies: [['slime', 2, 3], ['slime', 8, 9], ['blueSlime', 5, 6]],
});

R('d1', 0, 1, {
  theme: 'moss',
  map: [
    '###########',
    '#...ww....#',
    '#.X.ww....#',
    '#...ww....#',
    '#...ww....#',
    '#.C.ww....#',
    '#...WW.....',
    '#...ww....#',
    '#...ww....#',
    '#...ww....#',
    '#...ww....#',
    '#...ww....#',
    '###########',
  ],
  chests: { '2,5': { item: 'bigkey' } },
  on: { crystal: { bridge: true } },
  enemies: [['slime', 7, 3], ['slime', 8, 9]],
  hint: 'The crystal is out of reach of your sword...',
});

R('d1', 1, 0, {
  theme: 'moss', seal: true, boss: 'slimeKing',
  map: [
    '###########',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#####K#####',
  ],
  enemies: [['slimeKing', 5, 4]],
});

// ------------------------------------------------------------------ dungeon 2: Ember Lab

R('d2', 1, 2, {
  theme: 'lab',
  map: [
    '#####k#####',
    '#.l.....l.#',
    '#.........#',
    '#..o...o..#',
    '#.........#',
    '#.........#',
    '..........#',
    '#.........#',
    '#..t...t..#',
    '#.........#',
    '#.o.....o.#',
    '#.........#',
    '#####.#####',
  ],
  exits: { bottom: { to: 'ow:2,1', tx: 9, ty: 3, dir: 'down' } },
  enemies: [['redSlime', 3, 5], ['slime', 7, 9]],
});

R('d2', 0, 2, {
  theme: 'lab',
  map: [
    '###########',
    '#.........#',
    '#.x.....x.#',
    '#.........#',
    '#..P...P..#',
    '#.........#',
    '#....C.....',
    '#.........#',
    '#.........#',
    '#.~.....~.#',
    '#.........#',
    '#.........#',
    '###########',
  ],
  chests: { '5,6': { item: 'key', hidden: 'switch' } },
  on: { switch: { chest: true } },
  enemies: [['redSlime', 2, 10], ['redSlime', 8, 10]],
  hint: 'Two switches, two blocks.',
});

R('d2', 1, 1, {
  theme: 'lab',
  map: [
    '#####K#####',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#...o.o...#',
    '#.........#',
    '..........c',
    '#.........#',
    '#...l.l...#',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#####k#####',
  ],
  enemies: [['gremlin', 2, 3], ['gremlin', 8, 9]],
});

R('d2', 0, 1, {
  theme: 'lab',
  map: [
    '###########',
    '#.........#',
    '#.l.l.l.l.#',
    '#.........#',
    '#.........#',
    '#....C....#',
    '#.........z',
    '#.........#',
    '#..~...~..#',
    '#.........#',
    '#.o.....o.#',
    '#.........#',
    '###########',
  ],
  chests: { '5,5': { item: 'bombs' } },
  enemies: [['gremlin', 2, 3], ['gremlin', 8, 3], ['redSlime', 5, 9]],
});

R('d2', 2, 1, {
  theme: 'lab',
  map: [
    '###########',
    '#.........#',
    '#.wwwwwww.#',
    '#.w.....w.#',
    '#.w..X..w.#',
    '#.w.....w.#',
    'c.w..C..W.#',
    '#.w.....w.#',
    '#.wwwwwww.#',
    '#.........#',
    '#..o...o..#',
    '#.........#',
    '#####k#####',
  ],
  chests: { '5,6': { item: 'key' } },
  on: { crystal: { bridge: true } },
  enemies: [['redSlime', 9, 10], ['gremlin', 1, 10]],
});

R('d2', 2, 2, {
  theme: 'lab', seal: true,
  map: [
    '#####k#####',
    '#.........#',
    '#.~.....~.#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#....C....#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.~.....~.#',
    '#.........#',
    '###########',
  ],
  chests: { '5,6': { item: 'bigkey', hidden: 'clear' } },
  on: { clear: { chest: true } },
  enemies: [['golem', 5, 9, { hp: 10, mini: true }]],
});

R('d2', 1, 0, {
  theme: 'lab', seal: true, boss: 'golemKing',
  map: [
    '###########',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#####K#####',
  ],
  enemies: [['golemKing', 5, 4]],
});

// ------------------------------------------------------------------ dungeon 3: Hollow Keep

R('d3', 1, 2, {
  theme: 'keep',
  map: [
    '#####k#####',
    '#.........#',
    '#.~.....~.#',
    '#.........#',
    '#...t.t...#',
    '#.........#',
    '..........c',
    '#.........#',
    '#...t.t...#',
    '#.........#',
    '#.~.....~.#',
    '#.........#',
    '#####.#####',
  ],
  exits: { bottom: { to: 'ow:2,0', tx: 5, ty: 5, dir: 'down' } },
  enemies: [['blueSlime', 3, 5], ['gremlin', 7, 3]],
});

R('d3', 0, 2, {
  theme: 'keep',
  map: [
    '###########',
    '#...~.....#',
    '#.x.~..P..#',
    '#...~.....#',
    '#.......~~#',
    '#.P.......#',
    '#....C.....',
    '#~~~...~~~#',
    '#.....P...#',
    '#.x.......#',
    '#.........#',
    '#.........#',
    '###########',
  ],
  chests: { '5,6': { item: 'key', hidden: 'switch' } },
  on: { switch: { chest: true } },
  enemies: [['blueSlime', 8, 10], ['slime', 7, 3]],
  hint: 'Blocks that get stuck reset when you leave the room.',
});

R('d3', 2, 2, {
  theme: 'keep',
  map: [
    '###########',
    '#.........#',
    '#.~..C..X.#',
    '#.........#',
    '#wwwwWwwww#',
    '#.........#',
    'c.........#',
    '#.........#',
    '#..t...t..#',
    '#.........#',
    '#.o.....o.#',
    '#.........#',
    '###########',
  ],
  chests: { '5,2': { item: 'key' } },
  on: { crystal: { bridge: true } },
  enemies: [['gremlin', 8, 9], ['gremlin', 2, 6], ['blueSlime', 5, 8]],
});

R('d3', 1, 1, {
  theme: 'keep',
  map: [
    '#####K#####',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#..~...~..#',
    '#.........#',
    'k..........',
    '#.........#',
    '#..~...~..#',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#####k#####',
  ],
  enemies: [['golem', 5, 3], ['gremlin', 2, 9], ['gremlin', 8, 9]],
});

R('d3', 0, 1, {
  theme: 'keep', seal: true,
  map: [
    '###########',
    '#.........#',
    '#.~.....~.#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#....C....k',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.~.....~.#',
    '#.........#',
    '###########',
  ],
  chests: { '5,6': { item: 'bigkey', hidden: 'clear' } },
  on: { clear: { chest: true } },
  enemies: [['golem', 3, 3, { hp: 8, mini: true }], ['golem', 7, 9, { hp: 8, mini: true }]],
});

R('d3', 2, 1, {
  theme: 'keep',
  map: [
    '###########',
    '#.........#',
    '#.###.....#',
    '#.#C#..o..#',
    '#.#c#.....#',
    '#.........#',
    '..........#',
    '#.........#',
    '#..~...~..#',
    '#.........#',
    '#.o.....o.#',
    '#.........#',
    '###########',
  ],
  chests: { '3,3': { item: 'gems50' } },
  enemies: [['redSlime', 7, 6], ['gremlin', 8, 2]],
});

R('d3', 1, 0, {
  theme: 'keep', seal: true, boss: 'hollowKing',
  map: [
    '###########',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.t.....t.#',
    '#.........#',
    '#####K#####',
  ],
  enemies: [['hollowKing', 5, 4]],
});
