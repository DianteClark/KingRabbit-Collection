// Every map in Pixel Quest, drawn as text. Pure data plus tile rules (no Phaser).
//
// World legend: . grass  , flowers  f forest  ^ mountain  ~ sea  _ sand  c cactus  y palm
//   A desert peak  - snow  p snow pines  W snow peak  i ice  % dark sea  = bridge  : road  l lava
//   k / n: grass / snow under a big building (blocked)
//   Gates: x broken bridge  g wind wall  r rockfall  b dark barrier (each opens with a story flag)
//   Digits: places (see LANDMARKS).
// Inside legend: # wall  . floor  , grass  ; flowers  : path  _ sand  - snow  ~ water  l lava
//   T tree  P pine  Y palm  F fence  D door  K locked door  < stairs up  > stairs down  E exit
//   C chest  W carpet  + counter  B bed  O pot  Q table  S sign  G grave  J the Sun Bell  X altar
//   R red barrier (open while the floor's switch is on)  U blue barrier (open while it is off)
//   Z crystal switch  V lever  I brazier  * secret passage (looks like a wall)
//   lowercase letters: people (see each map's npcs)

export const LANDMARKS = {
  1: { to: 'bw', at: [9, 18], ground: 'grass', over: 'house', name: 'Brightwater' },
  2: { to: 'fe', at: [9, 1], ground: 'grass', over: 'houseB', name: 'Ferrow' },
  3: { to: 'em', at: [9, 16], ground: 'sand', over: 'tent', name: 'Emberfall' },
  4: { to: 'fr', at: [9, 16], ground: 'snow', over: 'house2', name: 'Frosthollow' },
  5: { to: 'mc1', at: [8, 14], ground: 'grass', over: 'cave', name: 'Mole Cave' },
  6: {
    to: 'tw1', at: [7, 7], ground: 'grass', over: null, name: 'Wind Tower',
    need: 'party:mage', locked: ['A howling wind seal bars the tower door.', 'Only a mage could unweave it.'],
    opened: { flag: 'tw_open', lines: ['Wren: A wind seal! Stand back...', 'Wren: There. The door is open!'] },
  },
  7: { to: 'ec1', at: [10, 10], ground: 'sand', over: 'caveRed', name: 'Ember Cave' },
  8: { to: 'cs1', at: [9, 12], ground: 'snow', over: null, name: 'Nightspire' },
};

export const GATES = {
  x: { flag: 'stonehide', open: '=' },
  g: { flag: 'galewing', open: '.' },
  r: { flag: 'pyrescorp', open: '_' },
  b: { flag: 'barrier', open: 'i' },
};

const world = {
  id: 'world', name: 'World', kind: 'world', music: 'field',
  tiles: [
    '~~~~~~~~~~~~~~~~WA~~~~~~~~~~~~~~~~~~~~~~',
    '~%%%%%%%%%%----~WA~______________AAAAA~~',
    '~%%-W-W-%%%--p--WA________c______AAAAA~~',
    '~%%-nnn-%%%Wp---WA__c____________AlllA_~',
    '~%%-n8n-%%%--pW-WA_____________c___7___~',
    '~%%%%i%%%%%-----WA____AA_c___::::::____~',
    '~%%%%b%%%%%---p-WA____A______:_________~',
    '~----i---::p::::-r:::::::::::____c_____~',
    '~-p------:p-----WA__c_______:y_________~',
    '~W-------:--p-p-WA__________3__AA______~',
    '~W-p-----4------WA____c____y:_______c__~',
    '~--p--------p---WA__________:__________~',
    '~-p----p-----p--WA_y____c___:_c______y_~',
    '~---------------WA_________::__________~',
    '^^^^^^^^^^^^^^^^^^^^^^^^^^^g^^^^^^^^^^^^',
    '^^^^^^^^^^^^^^^^^^^^^^^^^^^.^^^^^^^^^^^^',
    '~~.^^^5^^^.....~~~.........:..........~~',
    '~~.^^^.^^^.....~~.........,:,........,,~',
    '~..,..:.:......~~..,ff.....:......^^^..~',
    '~.....:::......~~...f...,..:......^^^,.~',
    '~.ff....:...f..~~....,,..^^:......^k^..~',
    '~.f.....:......~~.........^:.......6,..~',
    '~......,:.^^...~~........::::::::::....~',
    '~...,,..:.^....~~........:.............~',
    '~.......:......~~..f.....:....ff.......~',
    '~...ff..:,.....~~.......,:.....f.....,.~',
    '~.......:......~~........:.............~',
    '~......,:::::::xx:::::::::...^^........~',
    '~.......:......~~.....ff.:...........,.~',
    '~.......1......~~........:..,...,ff,...~',
    '~.f........ff..~~....,,..:............,~',
    '~..f........f.,~~........2........,....~',
    '~.......,......~~.....................~~',
    '~~~,.,,.......~~~~....................~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ],
  // Big buildings drawn over the map: frame, tile x/y of the bottom-centre.
  decor: [{ frame: 'castle', x: 5, y: 4 }, { frame: 'tower', x: 35, y: 21 }],
  // Encounter areas by rectangle (first match wins).
  zones: [
    { x0: 0, y0: 0, x1: 16, y1: 13, area: 'frost' },
    { x0: 17, y0: 0, x1: 39, y1: 13, area: 'desert' },
    { x0: 0, y0: 14, x1: 15, y1: 35, area: 'plains' },
    { x0: 16, y0: 14, x1: 39, y1: 35, area: 'eastfield' },
  ],
  rate: 1 / 22,
};

// ------------------------------------------------------------------ towns

const bw = {
  id: 'bw', name: 'Brightwater', kind: 'town', music: 'town', wall: 'wallY', door: 'doorY', floor: 'wood', world: [8, 29],
  exitNeed: { flag: 'quest', lines: ['Sola: Wait, Ash! Elder Bram asked to see us first.', 'Sola: He is by the Sun Bell in the square.'] },
  tiles: [
    'TTTTTTTTT::TTTTTTTTT',
    'T,,,,,,,,::,,,,,,,,T',
    'T,######,::,######,T',
    'T,#.a..#,::,#..b.#,T',
    'T,#+++.#,::,#.+++#,T',
    'T,#B...#,::,#...O#,T',
    'T,#B...#,::,#....#,T',
    'T,###D##,::,##D###,T',
    'T,,,,:,,,::,,,:,,,,T',
    'T,,,,::::::::::,,,,T',
    'T,T,,,,,:J:,,,,,,T,T',
    'T,,,,,,,:r:,,,,,,,,T',
    'T;,,d,,,:::,,,e,,;,T',
    'T,######,::,######,T',
    'T,#....#,::,#..g.#,T',
    'T,#.f..#,::,#.+++#,T',
    'T,#B..Q#,::,#....#,T',
    'T,###D##,::,##D###,T',
    'T,,;,,,,,::,,,,,;,,T',
    'TTTTTTTTT::TTTTTTTTT',
  ],
  npcs: {
    a: { ch: 4, face: 'down', talk: [{ do: 'inn:bw', lines: ['Welcome to the Lamplight Inn!'] }] },
    b: { ch: 3, face: 'down', talk: [{ do: 'shop:bw_items', lines: ['Herbs and charms for the road!'] }] },
    g: { ch: 0, face: 'down', talk: [{ do: 'shop:bw_gear', lines: ['Blades, staves and good leather.'] }] },
    r: {
      ch: 10, face: 'down', name: 'Elder Bram',
      talk: [
        { if: '!quest', do: 'quest', lines: [
          'Elder Bram: Ash, Sola. Thank you for coming.',
          'Three nights ago the Night Warden, Vesper, crept into our square and tore the three Chimes from the Sun Bell.',
          'Without its chimes the Bell is silent, and the sun no longer rises. The whole land is sinking into the night.',
          'Monsters grow bolder in the dark. Vesper hid each Chime in a place full of them.',
          'The first lies in the Mole Cave, north of town. Please, bring the Chimes home!',
          'Take this pouch of coins. Buy Herbs at the shop on the right. And rest at the inn whenever you are hurt.',
        ] },
        { if: 'vesper', lines: ['Elder Bram: The sun is back! Brightwater will sing of you for a hundred years.'] },
        { if: 'barrier', lines: ['Elder Bram: Nightspire... Be careful, both of you. All of you!'] },
        { if: 'pyrescorp', lines: ['Elder Bram: All three Chimes! Old Sage Elra in Frosthollow knows the lore of the Bell. Go to her, past the rockfall west of the desert.'] },
        { if: 'galewing', lines: ['Elder Bram: Two Chimes! The last, they say, burns in the Ember Cave, beyond the desert town of Emberfall.'] },
        { if: 'stonehide', lines: ['Elder Bram: The Earth Chime! The east bridge is mended now. Ferrow lies beyond it, by the sea.'] },
        { lines: ['Elder Bram: The Mole Cave is north of town, in the hills. Follow the road.'] },
      ],
    },
    d: { ch: 6, face: 'right', talk: [
      { if: 'stonehide', lines: ['The bridge to the east is fixed! Ferrow is a port town. They say a young mage studies there.'] },
      { lines: ['Since the sun stopped rising, the east bridge collapsed in a quake. Something big is digging in the Mole Cave...'] },
    ] },
    e: { ch: 8, face: 'left', talk: [
      'Tip: open the Menu to equip new gear. Better weapons make a big difference!',
      'Each hero can only use some kinds of gear. The shop shows who can use what.',
    ] },
    f: { ch: 1, face: 'down', talk: [
      { if: '!quest', lines: ['Mom: Ash, Sola! Elder Bram is waiting for you by the Sun Bell. Go on, I will keep the beds warm.'] },
      { do: 'heal', lines: ['Mom: You look worn out. Have a rest, it\'s free at home.'] },
    ] },
  },
  signs: [],
};

const fe = {
  id: 'fe', name: 'Ferrow', kind: 'town', music: 'town', wall: 'wallB', door: 'doorB', floor: 'wood', world: [25, 31],
  tiles: [
    'TTTTTTTT,::,TTTTTTTT',
    'T,,,,,,,,::,,,,,,,,T',
    'T,######,::,######,T',
    'T,#.a..#,::,#..b.#,T',
    'T,#+++.#,::,#.+++#,T',
    'T,#B...#,::,#...O#,T',
    'T,###D##,::,##D###,T',
    'T,,,,:::::::::,,,,,T',
    'T,,d,,,,,::,,,,,e,,T',
    'T,#######::#######,T',
    'T,#.....#::#..g..#,T',
    'T,#..w..D::D.+++.#,T',
    'T,#Q.Q..#::#.....#,T',
    'T,#######::#######,T',
    'T,,,,,,,,::,,h,,,,,T',
    '~~~~~~~~=~~=~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~',
  ],
  npcs: {
    a: { ch: 4, face: 'down', talk: [{ do: 'inn:fe', lines: ['The Gull\'s Rest. Sea air and soft beds!'] }] },
    b: { ch: 3, face: 'down', talk: [{ do: 'shop:fe_items', lines: ['Fresh off the boats!'] }] },
    g: { ch: 0, face: 'down', talk: [{ do: 'shop:fe_gear', lines: ['Iron and chain, forged by the sea.'] }] },
    w: {
      ch: 7, face: 'down', name: 'Wren', join: 'mage',
      talk: [
        { if: '!stonehide', lines: ['Wren: Shh, I\'m reading. Something about the Sun Bell...'] },
        { do: 'join:mage', lines: [
          'Wren: Is that... the Earth Chime? You actually found one!',
          'Wren: I\'ve read every book on the Sun Bell. The Sky Chime is at the top of the Wind Tower, east of here.',
          'Wren: The tower is sealed with wind magic. You need a mage. Lucky for you, I\'m a very good one.',
        ] },
      ],
    },
    d: { ch: 6, face: 'down', talk: [
      'Wren from the Academy is always reading about the old Sun Bell.',
      'Her spells hit every monster at once. Handy in a pinch!',
    ] },
    e: { ch: 8, face: 'down', talk: [
      { if: 'galewing', lines: ['The winds have calmed! The mountain pass north is open again.'] },
      { lines: ['A wind wall blocks the pass to the north desert. It started when that tower began to howl.'] },
    ] },
    h: { ch: 0, face: 'up', talk: [
      'Tip: Mages are fragile. If someone falls, a Life Leaf or the inn brings them back.',
      'Tip: Auto battle is great for weak monsters. Turn it off for bosses!',
    ] },
  },
  signs: [],
};

const em = {
  id: 'em', name: 'Emberfall', kind: 'town', music: 'desert', wall: 'wallR', door: 'doorR', floor: 'wood', world: [28, 9],
  tiles: [
    'YYYYYYYYY__YYYYYYYYY',
    'Y_________________cY',
    'Y_######____######_Y',
    'Y_#.a..#____#..b.#_Y',
    'Y_#+++.#____#.+++#_Y',
    'Y_#B...#____#...O#_Y',
    'Y_###D##____##D###_Y',
    'Y____:::::::::_____Y',
    'Y_d____~~~~______e_Y',
    'Y______~~~~_______cY',
    'Y_######_______###_Y',
    'Y_#..g#____h___#X#_Y',
    'Y_#+++#________#.#_Y',
    'Y_#...D________#D#_Y',
    'Y_#####__________c_Y',
    'Yc______________YY_Y',
    'Y______________cY__Y',
    'YYYYYYYYY__YYYYYYYYY',
  ],
  npcs: {
    a: { ch: 4, face: 'down', talk: [{ do: 'inn:em', lines: ['Cool water and a shady bed!'] }] },
    b: { ch: 3, face: 'down', talk: [{ do: 'shop:em_items', lines: ['Bombs! Life Leaves! Get them while it\'s dark!'] }] },
    g: { ch: 0, face: 'down', talk: [{ do: 'shop:em_gear', lines: ['Desert steel. The best this side of the sea.'] }] },
    d: { ch: 6, face: 'right', talk: [
      'The Ember Cave is in the volcano to the north-east.',
      'Fire monsters there hate the cold. Wren\'s Frost spell will work wonders.',
    ] },
    e: { ch: 8, face: 'left', talk: [
      { if: 'pyrescorp', lines: ['A rockfall blocked the west pass for days, but the quakes shook it loose. Frosthollow is beyond.'] },
      { lines: ['The west pass to the snowlands is buried under a rockfall. Every time the volcano rumbles, more rocks fall.'] },
    ] },
    h: { ch: 1, face: 'down', talk: [
      'Tip: Kit can Steal from monsters. Bosses often carry something good.',
      'Tip: Poison stays after battle. Antidotes, Clear Salts or Sola\'s Cure will fix it.',
    ] },
  },
  signs: [],
};

const fr = {
  id: 'fr', name: 'Frosthollow', kind: 'town', music: 'snow', wall: 'wallB', door: 'doorB', floor: 'wood', world: [9, 10],
  tiles: [
    'PPPPPPPPP--PPPPPPPPP',
    'P--------------P---P',
    'P-######----######-P',
    'P-#.a..#----#..b.#-P',
    'P-#+++.#----#.+++#-P',
    'P-#B...#----#...O#-P',
    'P-###D##----##D###-P',
    'P----:::::::::-----P',
    'P-d------s-------e-P',
    'P-------------P----P',
    'P-######---######--P',
    'P-#..g#----#.W.O#--P',
    'P-#+++#----#.W..#--P',
    'P-#...D----##D###--P',
    'P-#####----------P-P',
    'P--P-----------P---P',
    'P-----------h------P',
    'PPPPPPPPP--PPPPPPPPP',
  ],
  npcs: {
    a: { ch: 4, face: 'down', talk: [{ do: 'inn:fr', lines: ['Warm up by the fire, travellers.'] }] },
    b: { ch: 3, face: 'down', talk: [{ do: 'shop:fr_items', lines: ['Elixirs! The real thing!'] }] },
    g: { ch: 0, face: 'down', talk: [{ do: 'shop:fr_gear', lines: ['Mithril from the deep mines. Nothing finer.'] }] },
    s: {
      ch: 10, face: 'down', name: 'Sage Elra',
      talk: [
        { if: 'barrier', lines: ['Sage Elra: The barrier is down. Vesper waits at the top of Nightspire. Be strong.'] },
        { if: 'pyrescorp', do: 'barrier', lines: [
          'Sage Elra: The three Chimes, together again! I can hear them humming.',
          'Sage Elra: Vesper hides in Nightspire, the black castle across the frozen sea, behind a wall of night.',
          'Sage Elra: Hold up the Chimes... yes! Their song has torn the barrier open.',
          'Sage Elra: Walk north across the ice. And take this: an Elixir for the hardest moment.',
        ] },
        { lines: ['Sage Elra: You carry Chimes of the Sun Bell... but not all three. Come back when you have them all.'] },
      ],
    },
    d: { ch: 6, face: 'right', talk: [
      'Nightspire was empty for a hundred years. Then the lights came on, and the sun went out.',
    ] },
    e: { ch: 8, face: 'left', talk: [
      'Tip: Undead monsters fear holy light. Sola\'s Holy spell hits them twice as hard.',
      'Tip: Before Nightspire, rest at the inn and stock up on Tonics and Ethers.',
    ] },
    h: { ch: 1, face: 'up', talk: [
      'They say the Night Warden keeps a monster bigger than a house in the castle. Even bigger when she\'s angry.',
    ] },
  },
  signs: [],
};

// ------------------------------------------------------------------ dungeons

const mc1 = {
  id: 'mc1', name: 'Mole Cave', kind: 'dungeon', music: 'cave', wall: 'rockO', floor: 'floorC', back: 'cave', area: 'molecave', rate: 1 / 16,
  world: [6, 16],
  tiles: [
    '##################',
    '#######>.....#####',
    '#######......#C..#',
    '#######......#...#',
    '########RR####...#',
    '#C.....#..#......#',
    '#......#..#..##..#',
    '#..V...#.....##..#',
    '#......#..#......#',
    '###.####..####.###',
    '#.....#....#.....#',
    '#.C........#...C.#',
    '#.....##..##.....#',
    '#......#..#......#',
    '########..########',
    '########E.########',
    '##################',
  ],
  red: 'mc_lever', levers: ['mc_lever'],
  stairs: [{ to: 'mc2', at: [9, 6] }],
  chests: [{ gold: 80 }, { item: 'herb', n: 3 }, { gear: 'leather' }, { mimic: 'mimic' }],
  signs: [],
  npcs: {},
};

const mc2 = {
  id: 'mc2', name: 'Mole Cave B2', kind: 'dungeon', music: 'cave', wall: 'rockO', floor: 'floorC', back: 'cave', area: 'molecave', rate: 1 / 16,
  tiles: [
    '##################',
    '########C#########',
    '######..s..#######',
    '######.....#######',
    '########K#########',
    '####.........#####',
    '#C..#...<....#...#',
    '#...#........#.k.#',
    '#............#...#',
    '#...#........##K##',
    '#...#............#',
    '##################',
  ],
  stairs: [{ to: 'mc1', at: [8, 2] }],
  chests: [{ gear: 'powerband' }, { key: 'cellkey' }],
  locks: [
    { flag: 'mc_door', need: 'party:thief', lines: ['Kit: A rusty old lock? Give me two seconds.', 'Click! The door swings open.'], locked: ['The door is locked tight. A thief could pick it.'] },
    { flag: 'mc_cell', key: 'cellkey', lines: ['The Cell Key fits! The cell door opens.'], locked: ['A cell door. Someone is inside! It needs a key.'] },
  ],
  npcs: {
    s: { boss: 'stonehide', show: '!stonehide', talk: [{ do: 'boss:stonehide', lines: ['The ground shakes. A living boulder rises, the Earth Chime glowing in its back!', 'Stonehide: GRRRRAAAH!'] }] },
    k: {
      ch: 5, face: 'down', name: 'Kit', join: 'thief',
      talk: [
        { if: '!mc_cell', lines: ['???: Hey! You two! Get me out of here!'] },
        { do: 'join:thief', lines: [
          'Kit: Phew, thanks! The name\'s Kit. I came for the Chime too... the rock beast caught me first.',
          'Kit: You\'re after Vesper? Then you need someone with quick hands. I\'m in!',
          'Kit: The boss is behind the locked door up north. Leave the lock to me.',
        ] },
      ],
    },
  },
  bossWin: {
    stonehide: { give: 'chime1', lines: ['Stonehide crumbles into gravel. You got the Earth Chime!', 'The tremors stop. Far away, the villagers can mend the east bridge now.'] },
  },
  signs: [],
};

const tw1 = {
  id: 'tw1', name: 'Wind Tower 1F', kind: 'dungeon', music: 'tower', wall: 'wallB', floor: 'floorRing', back: 'tower', area: 'tower', rate: 1 / 17,
  world: [35, 21], bar: 'tw_sw',
  tiles: [
    '################',
    '#C...#.....#..<#',
    '#....#.....#...#',
    '#....U.....R...#',
    '#....#.....#...#',
    '######..Z..#####',
    '#..............#',
    '#..............#',
    '#......E.......#',
    '################',
  ],
  stairs: [{ to: 'tw2', at: [13, 1] }],
  chests: [{ item: 'ether', n: 2 }],
  signs: [],
  npcs: {},
};

const tw2 = {
  id: 'tw2', name: 'Wind Tower 2F', kind: 'dungeon', music: 'tower', wall: 'wallB', floor: 'floorRing', back: 'tower', area: 'tower', rate: 1 / 17, bar: 'tw_sw',
  tiles: [
    '################',
    '#<..#......#..>#',
    '#...#..C...#...#',
    '#...U......#...#',
    '#...#..S...#...#',
    '#####..Z.###.###',
    '#..............#',
    '#.C............#',
    '################',
  ],
  stairs: [{ to: 'tw3', at: [2, 1] }, { to: 'tw1', at: [13, 2] }],
  chests: [{ gear: 'robe' }, { item: 'tonic', n: 2 }],
  signs: [['Blue walls fall while the crystal sleeps.', 'Red walls fall while it shines.']],
  npcs: {},
};

const tw3 = {
  id: 'tw3', name: 'Wind Tower 3F', kind: 'dungeon', music: 'tower', wall: 'wallB', floor: 'floorRing', back: 'tower', area: 'tower', rate: 1 / 17, bar: 'tw_sw',
  tiles: [
    '##################',
    '#>..#.........#.<#',
    '#...#..C......#..#',
    '#...#....Z....R..#',
    '#...U.........#..#',
    '#*###.........####',
    '#C#..............#',
    '##################',
  ],
  stairs: [{ to: 'tw2', at: [2, 1] }, { to: 'tw4', at: [7, 4] }],
  chests: [{ gear: 'kukri' }, { gear: 'guard' }],
  signs: [],
  npcs: {},
};

const tw4 = {
  id: 'tw4', name: 'Tower Roof', kind: 'dungeon', music: 'tower', wall: 'wallB', floor: 'floorB', back: 'sky', area: null,
  tiles: [
    '##############',
    '#.....###....#',
    '#.....#C#....#',
    '#......g.....#',
    '#............#',
    '#......>.....#',
    '##############',
  ],
  stairs: [{ to: 'tw3', at: [16, 2] }],
  chests: [{ gear: 'iron' }],
  signs: [],
  npcs: {
    g: { boss: 'galewing', show: '!galewing', talk: [{ do: 'boss:galewing', lines: ['A shriek splits the wind. A winged demon lands on the Sky Chime!', 'Galewing: Little candles. I will blow you out!'] }] },
  },
  bossWin: {
    galewing: { give: 'chime2', lines: ['Galewing scatters into the wind. You got the Sky Chime!', 'The howling stops. The wind wall over the northern pass fades away.'] },
  },
};

const ec1 = {
  id: 'ec1', name: 'Ember Cave', kind: 'dungeon', music: 'cave', wall: 'rockR', floor: 'floorS', back: 'lava', area: 'embercave', rate: 1 / 16,
  world: [35, 4], red: 'ec1_torches', torches: 'ec1',
  tiles: [
    '####################',
    '########..>#########',
    '########...#########',
    '#########R##########',
    '#C...I.I...I.I.....#',
    '#.ll.............ll#',
    '#.ll.....S.......ll#',
    '#....ll......ll...C#',
    '#....ll......ll....#',
    '#########..#########',
    '#ll.....ll.ll.....l#',
    '#.........E........#',
    '####################',
  ],
  stairs: [{ to: 'ec2', at: [10, 8] }],
  chests: [{ item: 'bomb', n: 2 }, { gear: 'speedring' }],
  signs: [['Four flames guard the way.', 'Each flame you touch stirs its neighbours too.']],
  npcs: {},
};

const ec2 = {
  id: 'ec2', name: 'Ember Cave B2', kind: 'dungeon', music: 'cave', wall: 'rockR', floor: 'floorS', back: 'lava', area: 'embercave', rate: 1 / 16,
  tiles: [
    '####################',
    '#########C##########',
    '#######..p..########',
    '#######.....########',
    '#C*....ll.ll......C#',
    '###....l...l.......#',
    '#......l...l...ll..#',
    '#..ll..........ll..#',
    '#..ll....>.........#',
    '####################',
  ],
  stairs: [{ to: 'ec1', at: [10, 2] }],
  chests: [{ gear: 'crystal' }, { gear: 'clover' }, { mimic: 'mimic2' }],
  signs: [],
  npcs: {
    p: { boss: 'pyrescorp', show: '!pyrescorp', talk: [{ do: 'boss:pyrescorp', lines: ['The lava hisses. A burning scorpion clutches the Fire Chime in its claws!', 'Pyrescorp: Ssss... you will melt like wax.'] }] },
  },
  bossWin: {
    pyrescorp: { give: 'chime3', lines: ['Pyrescorp sinks into the magma. You got the Fire Chime!', 'The mountain rumbles. Far to the west, the rockfall shakes loose.'] },
  },
};

const cs1 = {
  id: 'cs1', name: 'Nightspire', kind: 'dungeon', music: 'castle', wall: 'wallR', floor: 'floorR', back: 'castle', area: 'castle', rate: 1 / 18,
  world: [5, 4],
  tiles: [
    '##################',
    '#C..#...<....#...#',
    '#...#........#.C.#',
    '#...#........#...#',
    '#...#####K####...#',
    '#...#...WW...#...#',
    '#.......WW.......#',
    '#####...WW...#####',
    '#...#...WW...#.O.#',
    '#.C.D...WW...D...#',
    '#...#...WW...#O..#',
    '#####...WW...#####',
    '#..O....WW....O..#',
    '#.......WE.......#',
    '##################',
  ],
  stairs: [{ to: 'cs2', at: [10, 7] }],
  chests: [{ item: 'tonic', n: 3 }, { item: 'ether', n: 2 }, { key: 'spirekey' }],
  locks: [{ flag: 'cs_door', key: 'spirekey', lines: ['The Spire Key turns. The great door opens!'], locked: ['A great black door with a silver keyhole.'] }],
  signs: [],
  npcs: {},
};

const cs2 = {
  id: 'cs2', name: 'Nightspire 2F', kind: 'dungeon', music: 'castle', wall: 'wallR', floor: 'floorR', back: 'castle', area: 'castle', rate: 1 / 18,
  red: 'cs_l0&cs_l1', levers: ['cs_l0', 'cs_l1'],
  tiles: [
    '####################',
    '#V..######<#####..V#',
    '#...#.....w....#...#',
    '#...#RRRRRRRRRR#...#',
    '#...#..........#...#',
    '#..................#',
    '#C..#..........#.C.#',
    '###*#....>.....#####',
    '#.Ch#..........#####',
    '####################',
  ],
  stairs: [{ to: 'cs3', at: [7, 6] }, { to: 'cs1', at: [9, 1] }],
  chests: [{ gear: 'sunblade' }, { gear: 'silk' }, { gear: 'ribbon' }],
  signs: [],
  npcs: {
    w: { boss: 'wyvern', show: '!wyvern', talk: [{ do: 'boss:wyvern', lines: ['Bones rattle. A skeletal wyvern unfolds its wings across the stairs!'] }] },
    h: { boss: 'hive', show: '!hive', talk: [{ do: 'boss:hive', lines: ['A hidden nest! The Hive Queen buzzes with fury.'] }] },
  },
  bossWin: {
    wyvern: { lines: ['The Bone Wyvern collapses into dust. The way up is clear.'] },
    hive: { give: 'gear:fang', lines: ['The Hive Queen falls. In the nest you find the Shadow Fang!'] },
  },
};

const cs3 = {
  id: 'cs3', name: 'Throne of Night', kind: 'dungeon', music: 'castle', wall: 'wallR', floor: 'floorR', back: 'castle', area: null,
  tiles: [
    '################',
    '#......v.......#',
    '#.....WWW......#',
    '#.O...WWW....O.#',
    '#.....WWW......#',
    '#.....WWW......#',
    '#.O...WWW....O.#',
    '#.....W>W......#',
    '################',
  ],
  stairs: [{ to: 'cs2', at: [10, 2] }],
  chests: [],
  signs: [],
  npcs: {
    v: {
      boss: 'vesper', show: '!vesper', ch: 'vesper',
      talk: [{ do: 'boss:vesper', lines: [
        'Vesper: So the little bell-ringers climbed my tower.',
        'Vesper: Day after day, that Bell burned my eyes. Now the night belongs to me, forever.',
        'Ash: Not if we have anything to say about it!',
        'Vesper: Then say it to the dark!',
      ] }],
    },
  },
};

export const MAPS = { world, bw, fe, em, fr, mc1, mc2, tw1, tw2, tw3, tw4, ec1, ec2, cs1, cs2, cs3 };

// ------------------------------------------------------------------ tile rules

const WORLD_TILES = {
  '.': { g: 'grass', walk: true }, ',': { g: 'grass2', walk: true }, f: { g: 'grass', o: 'tree', walk: true },
  '^': { g: 'grass', o: 'mtnB' }, '~': { g: 'water', anim: true }, _: { g: 'sand', walk: true }, c: { g: 'sand', o: 'cactus' },
  y: { g: 'sand', o: 'palm', walk: true }, A: { g: 'sand', o: 'mtnO' }, '-': { g: 'snow', walk: true },
  p: { g: 'snow', o: 'pineW', walk: true }, W: { g: 'snow', o: 'mtnW' }, i: { g: 'ice', walk: true },
  '%': { g: 'dark', anim: true }, '=': { g: 'bridgeH', walk: true }, ':': { g: 'road', walk: true },
  l: { g: 'lava', anim: true }, k: { g: 'grass' }, n: { g: 'snow' },
  x: { g: 'broken' }, g: { g: 'grass', o: 'stars0' }, r: { g: 'sand', o: 'mound' }, b: { g: 'ice', o: 'portal0' },
};

const INSIDE_TILES = {
  ',': { g: 'grass', walk: true }, ';': { g: 'grass2', walk: true }, ':': { g: 'road', walk: true },
  _: { g: 'sand', walk: true }, '-': { g: 'snow', walk: true }, '~': { g: 'water', anim: true }, l: { g: 'lava', anim: true },
  T: { g: 'grass', o: 'tree' }, P: { g: 'snow', o: 'pineW' }, Y: { g: 'sand', o: 'palm' }, c: { g: 'sand', o: 'cactus' },
  F: { g: 'grass', o: 'fence' }, W: { g: 'carpet', walk: true }, '+': { g: '$floor', o: 'fence', counter: true },
  B: { g: '$floor', o: 'bed' }, O: { g: '$floor', o: 'pot' }, Q: { g: '$floor', o: 'table' }, S: { g: '$floor', o: 'sign', sign: true },
  G: { g: 'grass', o: 'grave' }, J: { g: 'road', o: 'bell', bell: true }, X: { g: '$floor', o: 'altar' },
  '#': { g: '$wall' }, '=': { g: 'bridgeH', walk: true }, '.': { g: '$floor', walk: true }, D: { g: '$door', walk: true }, E: { g: '$floor', walk: true, exit: true },
  '<': { g: '$floor', o: 'stairsU', walk: true, stairs: true }, '>': { g: 'gateD', walk: true, stairs: true },
  C: { g: '$floor', chest: true }, K: { g: '$lock', lock: true },
  R: { g: '$floor', bar: 'R' }, U: { g: '$floor', bar: 'U' }, Z: { g: '$floor', crystal: true },
  V: { g: '$floor', lever: true }, I: { g: '$floor', torch: true }, '*': { g: '$wall', walk: true, secret: true },
};

/** Static info for a character on a map. */
export function tileDef(map, ch) {
  if (map.kind === 'world') {
    if (LANDMARKS[ch]) return { landmark: Number(ch), walk: true };
    return WORLD_TILES[ch] || WORLD_TILES['.'];
  }
  if (ch >= 'a' && ch <= 'z' && ch !== 'l' && ch !== 'c') return { npc: ch, walk: true };
  return INSIDE_TILES[ch] || INSIDE_TILES['#'];
}

export const charAt = (map, x, y) => (y >= 0 && y < map.tiles.length && x >= 0 && x < map.tiles[0].length ? map.tiles[y][x] : null);

/** Objects of one kind in reading order: [{x, y}] (chests, levers, locks, stairs, braziers, signs). */
export function objectsOf(map, test) {
  map.__obj ||= {};
  const key = String(test);
  if (map.__obj[key]) return map.__obj[key];
  const out = [];
  map.tiles.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (test(row[x])) out.push({ x, y }); });
  map.__obj[key] = out;
  return out;
}
export const chestsOf = (map) => objectsOf(map, (c) => c === 'C');
export const stairsOf = (map) => objectsOf(map, (c) => c === '<' || c === '>');
export const leversOf = (map) => objectsOf(map, (c) => c === 'V');
export const locksOf = (map) => objectsOf(map, (c) => c === 'K');
export const torchesOf = (map) => objectsOf(map, (c) => c === 'I');
export const signsOf = (map) => objectsOf(map, (c) => c === 'S');
export const npcSpots = (map) => {
  const out = {};
  map.tiles.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const d = tileDef(map, row[x]); if (d.npc) out[d.npc] = { x, y }; } });
  return out;
};
export const indexAt = (list, x, y) => list.findIndex((p) => p.x === x && p.y === y);

/** Evaluate a flag expression: 'a&b', '!a', 'party:mage', 'item:chime1'. */
export function cond(state, expr) {
  if (!expr) return true;
  return expr.split('&').every((part) => {
    const neg = part.startsWith('!');
    const p = neg ? part.slice(1) : part;
    let v;
    if (p.startsWith('party:')) v = state.party.some((m) => m.cls === p.slice(6));
    else if (p.startsWith('item:')) v = !!state.keys?.[p.slice(5)];
    else v = !!state.flags[p];
    return neg ? !v : v;
  });
}

/** The ground under a person: the first plain walkable neighbour. */
export function groundUnder(map, x, y) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) {
    const ch = charAt(map, x + dx, y + dy);
    if (ch && '.,;:_-W'.includes(ch)) return ch;
  }
  return '.';
}
