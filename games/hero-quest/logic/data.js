// Every room of Hollow Crown as data. Map legend: see tiles.js.
// Rooms are wide (17 x 11 tiles, like a classic screen) so in landscape the room fills the
// phone. Room ids are `${area}:${x},${y}`; rooms next to each other on the grid connect
// through matching openings on their shared edge (tests check they match). Interiors ('in')
// are single rooms reached through warps.
//
// v2 layout (wide rooms). Saves from the v1 (11 x 13) layout are moved over by migrate.js.

export const ROOMS = {};

function R(area, x, y, spec) {
  const id = `${area}:${x},${y}`;
  ROOMS[id] = { id, area, gx: x, gy: y, enemies: [], npcs: [], warps: [], houses: [], signs: {}, chests: {}, on: {}, exits: {}, ...spec };
}
function I(name, spec) {
  const id = `in:${name}`;
  ROOMS[id] = { id, area: 'in', gx: 0, gy: 0, enemies: [], npcs: [], warps: [], houses: [], signs: {}, chests: {}, on: {}, exits: {}, ...spec };
}

export const START = { room: 'in:elder', x: 8, y: 7, dir: 'up' };

// ------------------------------------------------------------------ overworld: Fernwick Vale

R('ow', 0, 2, {
  theme: 'village', name: 'Fernwick',
  houses: [{ x: 2, y: 2, roof: 'green' }],
  warps: [{ x: 3, y: 5, to: 'in:elder', tx: 8, ty: 9, dir: 'up' }],
  npcs: [{ x: 10, y: 8, who: 'mira' }],
  signs: { '11,2': ['Fernwick village.', 'North: Mosswood.  East: the market and the lake.'] },
  map: [
    'TTTTTTT.:.TTTTTTT',
    'T,......:......,T',
    'T.hhhhh.:..v....T',
    'T.hhhhh.:.......T',
    'T.hhhhh.:........',
    'T.hDhhh.::::::::.',
    'T..:::::::...,...',
    'T,.........ff...T',
    'T..b.........,b.T',
    'TT.....,.....,.TT',
    'TTTTTTTTTTTTTTTTT',
  ],
});

R('ow', 1, 2, {
  theme: 'village', name: 'Fernwick',
  houses: [{ x: 10, y: 1, roof: 'red' }],
  warps: [{ x: 11, y: 4, to: 'in:shop', tx: 8, ty: 9, dir: 'up' }],
  npcs: [{ x: 5, y: 8, who: 'pip' }, { x: 11, y: 8, who: 'wen' }],
  signs: { '3,7': ["Odo's Shop: potions, bombs and more.", 'North of here: the open fields.'] },
  map: [
    'TTTTTTT...TTTTTTT',
    'T.......:.hhhhh.T',
    'T.,.....:.hhhhh.T',
    'T.......:.hhhhh.T',
    '........:.hDhhh..',
    '::::::::::::::::.',
    '.....,.......,...',
    'T..v.........ff.T',
    'T.....,......,..T',
    'TT.ff........,.TT',
    'TTTTTTTTTTTTTTTTT',
  ],
});

R('ow', 2, 2, {
  theme: 'field', name: 'Lake Sorrel',
  warps: [{ x: 4, y: 8, to: 'in:cave', tx: 8, ty: 9, dir: 'up' }],
  signs: { '13,7': ['That rock to the west has a deep crack in it.', 'Something that goes BOOM might open it.'] },
  enemies: [['slime', 10, 8], ['slime', 2, 7]],
  map: [
    'TTTTTTT...TwwTTTT',
    'T..........ww...T',
    'T.,......wwwww..T',
    'T......wwwwwwww.T',
    '......wwwwwwwww.T',
    '.......wwwwwww..T',
    '..,......www....T',
    'T..###.......v..T',
    'T..#c#..b....,..T',
    'TT.............TT',
    'TTTTTTTTTTTTTTTTT',
  ],
});

R('ow', 1, 1, {
  theme: 'field', name: 'Open Fields',
  signs: { '10,2': ['North: Northwood.  West: Mosswood.', 'East: the river and the old Ember Lab.'] },
  enemies: [['slime', 3, 2], ['slime', 13, 7], ['slime', 5, 7], ['blueSlime', 12, 3]],
  map: [
    'TTTTTTT.:.TTTTTTT',
    'T.r.....:....b..T',
    'T.......:.v.....T',
    'T,......:....r..T',
    '........:........',
    ':::::::::::::::::',
    '........:....,...',
    'T..r....:.......T',
    'T.....b.:...r...T',
    'TT..,...:.....,TT',
    'TTTTTTT.:.TTTTTTT',
  ],
});

R('ow', 0, 1, {
  theme: 'forest', name: 'Mosswood',
  enemies: [['slime', 5, 5], ['slime', 10, 7], ['blueSlime', 14, 8]],
  map: [
    'TTTTTTT.:.TTTTTTT',
    'TTT.b...:...b.TTT',
    'TT.Yy...:...Yy.TT',
    'T..yy...:...yy..T',
    'T.......::::::...',
    'T..b..........,..',
    'TT.....Yy....b...',
    'T...,..yy.......T',
    'TT.Yy.......Yy.TT',
    'TT.yy...:...yy.TT',
    'TTTTTTT.:.TTTTTTT',
  ],
});

R('ow', 0, 0, {
  theme: 'forest', name: 'Mosswood',
  warps: [{ x: 8, y: 2, to: 'd1:1,2', tx: 8, ty: 9, dir: 'up' }],
  signs: { '13,3': ['MOSSY HOLLOW', 'Slimes live down there. Mind the hopping ones.'] },
  enemies: [['slime', 5, 7], ['slime', 11, 8]],
  map: [
    '#################',
    '#################',
    '########e########',
    'TTT.....:....v.TT',
    'T..b....:...b....',
    'T.,.....:.....,..',
    'T..Yy...:...Yy...',
    'T..yy...:...yy..T',
    'TT......:......TT',
    'TTT..,..:..,..TTT',
    'TTTTTTT.:.TTTTTTT',
  ],
});

R('ow', 1, 0, {
  theme: 'forest', name: 'Northwood',
  chests: { '4,1': { item: 'gems20' } },
  enemies: [['gremlin', 12, 3], ['gremlin', 5, 8], ['slime', 10, 5]],
  map: [
    'TTTTTTTTTTTTTTTTT',
    'TTT.C......Yy.TTT',
    'TT.........yy..TT',
    'T..Yy...b.......T',
    '...yy.......r....',
    '.................',
    '....,....b.......',
    'T.r.....Yy....b.T',
    'T.......yy......T',
    'TTT..b.......,TTT',
    'TTTTTTT...TTTTTTT',
  ],
});

R('ow', 2, 0, {
  theme: 'mountain', name: 'Grey Peaks',
  warps: [{ x: 8, y: 2, to: 'd3:1,2', tx: 8, ty: 9, dir: 'up' }],
  signs: { '9,5': ['HOLLOW KEEP', 'The Gremlin King sealed the way with a great rock.'] },
  enemies: [['golem', 5, 7], ['gremlin', 12, 5]],
  map: [
    '#################',
    '#################',
    '########e########',
    '#######rcr#######',
    '....r.........r.#',
    '.........v......#',
    '...,...r.....r..#',
    '#..r.........,..#',
    '##.....,.....r.##',
    '###...........###',
    '#######...#######',
  ],
});

R('ow', 2, 1, {
  theme: 'field', name: 'Ember River',
  warps: [{ x: 13, y: 1, to: 'd2:1,2', tx: 8, ty: 9, dir: 'up' }],
  signs: { '7,2': ['EMBER LAB, across the river.', 'Its bridge is raised. The crystal on the far bank lowers it.'] },
  on: { crystal: { bridge: true } },
  enemies: [['blueSlime', 4, 3], ['slime', 5, 8]],
  map: [
    'TTTTTTT...T######',
    'T.........T##e###',
    'T......v...ww...#',
    'T,.........ww...#',
    '...........ww...#',
    ':::::::::::WW...#',
    '...........ww.,.#',
    'T..........ww..X#',
    'T..b.......ww...#',
    'TT....,....ww...#',
    'TTTTTTT...TwwTTTT',
  ],
});

// ------------------------------------------------------------------ interiors

I('elder', {
  theme: 'house', name: "Elder Bram's house",
  npcs: [{ x: 8, y: 4, who: 'elder' }],
  warps: [{ x: 8, y: 10, to: 'ow:0,2', tx: 3, ty: 6, dir: 'down' }],
  map: [
    '#################',
    '#################',
    '#ll.........FF..#',
    '#...............#',
    '#.q........m....#',
    '#.q.............#',
    '#...............#',
    '#...m...........#',
    '#...............#',
    '#...............#',
    '########D########',
  ],
});

I('shop', {
  theme: 'house', name: "Odo's Shop",
  npcs: [{ x: 8, y: 3, who: 'odo' }],
  warps: [{ x: 8, y: 10, to: 'ow:1,2', tx: 11, ty: 5, dir: 'down' }],
  map: [
    '#################',
    '#################',
    '#l.l.......l.l..#',
    '#...............#',
    '#....._____.....#',
    '#...............#',
    '#...............#',
    '#.m...........m.#',
    '#...............#',
    '#...............#',
    '########D########',
  ],
});

I('cave', {
  theme: 'cave', name: 'Hidden cave',
  chests: { '8,4': { item: 'heart' } },
  warps: [{ x: 8, y: 10, to: 'ow:2,2', tx: 4, ty: 9, dir: 'down' }],
  map: [
    '#################',
    '######.....######',
    '####..t...t..####',
    '###...........###',
    '###.....C.....###',
    '###...........###',
    '####.........####',
    '######.....######',
    '#######...#######',
    '#######...#######',
    '########D########',
  ],
});

// ------------------------------------------------------------------ dungeon 1: Mossy Hollow

R('d1', 1, 2, {
  theme: 'moss',
  exits: { bottom: { to: 'ow:0,0', tx: 8, ty: 3, dir: 'down' } },
  enemies: [['slime', 4, 7], ['slime', 12, 4]],
  map: [
    '########k########',
    '#...............#',
    '#.t...........t.#',
    '#....o.....o....#',
    '#...............#',
    '.................',
    '#.....~...~.....#',
    '#...............#',
    '#.t...........t.#',
    '#...............#',
    '########.########',
  ],
});

R('d1', 0, 2, {
  theme: 'moss',
  chests: { '8,5': { item: 'key', hidden: 'clear' } },
  on: { clear: { chest: true } },
  enemies: [['slime', 5, 3], ['slime', 11, 3], ['slime', 5, 7], ['slime', 11, 7]],
  map: [
    '#################',
    '#...............#',
    '#.###.......###.#',
    '#.#...........#.#',
    '#...............#',
    '#.......C........',
    '#...............#',
    '#.#...........#.#',
    '#.###.......###.#',
    '#...............#',
    '#################',
  ],
});

R('d1', 2, 2, {
  theme: 'moss',
  on: { switch: { door: 'top' } },
  enemies: [['slime', 13, 8]],
  hint: 'Push the block onto the switch.',
  map: [
    '########s########',
    '#...............#',
    '#.##.......##...#',
    '#.#....x....#...#',
    '#.#.........#...#',
    '....P...........#',
    '#...............#',
    '#...#######.....#',
    '#...............#',
    '#..g.........g..#',
    '#################',
  ],
});

R('d1', 2, 1, {
  theme: 'moss',
  chests: { '8,5': { item: 'boomerang' } },
  enemies: [['blueSlime', 3, 7], ['blueSlime', 13, 3]],
  map: [
    '#################',
    '#...............#',
    '#.t...........t.#',
    '#......~.~......#',
    '#...............#',
    '#.......C.......#',
    '#...............#',
    '#......~.~......#',
    '#.t...........t.#',
    '#...............#',
    '########s########',
  ],
});

R('d1', 1, 1, {
  theme: 'moss',
  chests: { '8,5': { item: 'gems20' } },
  enemies: [['slime', 3, 3], ['slime', 13, 7], ['blueSlime', 3, 8]],
  map: [
    '########K########',
    '#...............#',
    '#.t...........t.#',
    '#.....##.##.....#',
    '#.....#...#.....#',
    '......#.C.#.....#',
    '#.....#...#.....#',
    '#.....##.##.....#',
    '#.t...........t.#',
    '#...............#',
    '########k########',
  ],
});

R('d1', 0, 1, {
  theme: 'moss',
  chests: { '2,5': { item: 'bigkey' } },
  on: { crystal: { bridge: true } },
  enemies: [['slime', 10, 3], ['slime', 12, 8]],
  hint: 'The crystal is out of reach of your sword...',
  map: [
    '#################',
    '#....ww.........#',
    '#.X..ww.........#',
    '#....ww.........#',
    '#....ww.........#',
    '#.C..WW..........',
    '#....ww.........#',
    '#....ww.........#',
    '#....ww.........#',
    '#....ww.........#',
    '#################',
  ],
});

R('d1', 1, 0, {
  theme: 'moss', seal: true, boss: 'slimeKing',
  enemies: [['slimeKing', 8, 3]],
  map: [
    '#################',
    '#...............#',
    '#.t...........t.#',
    '#...............#',
    '#...............#',
    '#...............#',
    '#...............#',
    '#...............#',
    '#.t...........t.#',
    '#...............#',
    '########K########',
  ],
});

// ------------------------------------------------------------------ dungeon 2: Ember Lab

R('d2', 1, 2, {
  theme: 'lab',
  exits: { bottom: { to: 'ow:2,1', tx: 13, ty: 2, dir: 'down' } },
  enemies: [['redSlime', 5, 4], ['slime', 11, 7]],
  map: [
    '########k########',
    '#.l...........l.#',
    '#...............#',
    '#....o.....o....#',
    '#...............#',
    '................#',
    '#...t.......t...#',
    '#...............#',
    '#.o...........o.#',
    '#...............#',
    '########.########',
  ],
});

R('d2', 0, 2, {
  theme: 'lab',
  chests: { '8,5': { item: 'key', hidden: 'switch' } },
  on: { switch: { chest: true } },
  enemies: [['redSlime', 3, 8], ['redSlime', 13, 8]],
  hint: 'Two switches, two blocks.',
  map: [
    '#################',
    '#...............#',
    '#..x.......x....#',
    '#..~.......~....#',
    '#....P...P......#',
    '#.......C........',
    '#...............#',
    '#...~.......~...#',
    '#...............#',
    '#...............#',
    '#################',
  ],
});

R('d2', 1, 1, {
  theme: 'lab',
  enemies: [['gremlin', 3, 3], ['gremlin', 13, 7]],
  map: [
    '########K########',
    '#...............#',
    '#.t...........t.#',
    '#...............#',
    '#.....o...o.....#',
    '................c',
    '#.....l...l.....#',
    '#...............#',
    '#.t...........t.#',
    '#...............#',
    '########k########',
  ],
});

R('d2', 0, 1, {
  theme: 'lab',
  chests: { '8,5': { item: 'bombs' } },
  enemies: [['gremlin', 3, 3], ['gremlin', 13, 3], ['redSlime', 8, 8]],
  map: [
    '#################',
    '#...............#',
    '#.l.l.l...l.l.l.#',
    '#...............#',
    '#...............#',
    '#.......C.......z',
    '#...............#',
    '#....~.....~....#',
    '#...............#',
    '#.o...........o.#',
    '#################',
  ],
});

R('d2', 2, 1, {
  theme: 'lab',
  chests: { '8,5': { item: 'key' } },
  on: { crystal: { bridge: true } },
  enemies: [['redSlime', 14, 8], ['gremlin', 2, 8]],
  map: [
    '#################',
    '#...............#',
    '#...wwwwwwwww...#',
    '#...w.......w...#',
    '#...w...X...w...#',
    'c...w...C...W...#',
    '#...w.......w...#',
    '#...wwwwwwwww...#',
    '#...............#',
    '#..o.........o..#',
    '########k########',
  ],
});

R('d2', 2, 2, {
  theme: 'lab', seal: true,
  chests: { '8,5': { item: 'bigkey', hidden: 'clear' } },
  on: { clear: { chest: true } },
  enemies: [['golem', 8, 8, { hp: 10, mini: true }]],
  map: [
    '########k########',
    '#...............#',
    '#.~...........~.#',
    '#...............#',
    '#...............#',
    '#.......C.......#',
    '#...............#',
    '#...............#',
    '#.~...........~.#',
    '#...............#',
    '#################',
  ],
});

R('d2', 1, 0, {
  theme: 'lab', seal: true, boss: 'golemKing',
  enemies: [['golemKing', 8, 3]],
  map: [
    '#################',
    '#...............#',
    '#.t...........t.#',
    '#...............#',
    '#...............#',
    '#...............#',
    '#...............#',
    '#...............#',
    '#.t...........t.#',
    '#...............#',
    '########K########',
  ],
});

// ------------------------------------------------------------------ dungeon 3: Hollow Keep

R('d3', 1, 2, {
  theme: 'keep',
  exits: { bottom: { to: 'ow:2,0', tx: 8, ty: 4, dir: 'down' } },
  enemies: [['blueSlime', 4, 4], ['gremlin', 12, 3]],
  map: [
    '########k########',
    '#...............#',
    '#.~...........~.#',
    '#.....t...t.....#',
    '#...............#',
    '................c',
    '#...............#',
    '#.....t...t.....#',
    '#.~...........~.#',
    '#...............#',
    '########.########',
  ],
});

R('d3', 0, 2, {
  theme: 'keep',
  chests: { '8,5': { item: 'key', hidden: 'switch' } },
  on: { switch: { chest: true } },
  enemies: [['blueSlime', 12, 8], ['slime', 12, 3]],
  hint: 'Blocks that get stuck can be reset from the pause menu.',
  map: [
    '#################',
    '#.....~.........#',
    '#..x..~....P....#',
    '#.....~.........#',
    '#.........~~....#',
    '#..P....C........',
    '#~~~~.......~~~.#',
    '#.......P.......#',
    '#..x............#',
    '#...............#',
    '#################',
  ],
});

R('d3', 2, 2, {
  theme: 'keep',
  chests: { '7,2': { item: 'key' } },
  on: { crystal: { bridge: true } },
  enemies: [['gremlin', 13, 8], ['gremlin', 3, 6], ['blueSlime', 8, 7]],
  map: [
    '#################',
    '#...............#',
    '#.~....C....X...#',
    '#...............#',
    '#wwwwwwwWwwwwwww#',
    'c...............#',
    '#...............#',
    '#....t.....t....#',
    '#...............#',
    '#..o.........o..#',
    '#################',
  ],
});

R('d3', 1, 1, {
  theme: 'keep',
  enemies: [['golem', 8, 3], ['gremlin', 3, 8], ['gremlin', 13, 8]],
  map: [
    '########K########',
    '#...............#',
    '#.t...........t.#',
    '#.....~...~.....#',
    '#...............#',
    'k................',
    '#...............#',
    '#.....~...~.....#',
    '#.t...........t.#',
    '#...............#',
    '########k########',
  ],
});

R('d3', 0, 1, {
  theme: 'keep', seal: true,
  chests: { '8,5': { item: 'bigkey', hidden: 'clear' } },
  on: { clear: { chest: true } },
  enemies: [['golem', 4, 3, { hp: 8, mini: true }], ['golem', 12, 7, { hp: 8, mini: true }]],
  map: [
    '#################',
    '#...............#',
    '#.~...........~.#',
    '#...............#',
    '#...............#',
    '#.......C.......k',
    '#...............#',
    '#...............#',
    '#.~...........~.#',
    '#...............#',
    '#################',
  ],
});

R('d3', 2, 1, {
  theme: 'keep',
  chests: { '3,3': { item: 'gems50' } },
  enemies: [['redSlime', 11, 5], ['gremlin', 13, 2]],
  map: [
    '#################',
    '#...............#',
    '#.###...........#',
    '#.#C#.....o.....#',
    '#.#c#...........#',
    '................#',
    '#...............#',
    '#.....~...~.....#',
    '#...............#',
    '#.o...........o.#',
    '#################',
  ],
});

R('d3', 1, 0, {
  theme: 'keep', seal: true, boss: 'hollowKing',
  enemies: [['hollowKing', 8, 3]],
  map: [
    '#################',
    '#...............#',
    '#.t...........t.#',
    '#...............#',
    '#...............#',
    '#...............#',
    '#...............#',
    '#...............#',
    '#.t...........t.#',
    '#...............#',
    '########K########',
  ],
});
