// The overworld: eight small areas joined at their edges. Pure data plus a few helpers.
//
// Tiles: '.' grass  ',' tall grass (wild pets)  '=' path  'f' flowers  'T' tree  '~' water  'r' rock
//        'F' fence  's' sign  'X' cave wall  ':' cave floor (wild pets)  ';' cave floor (safe)
//        'o' cave mouth (walk in to change area)  '#' building (drawn from the buildings list)
// Buildings have their door on the bottom row, in the middle. Walk into a door to use it.
// NPC sprite rows come from the RAS Characters sheet (0-10).

export const WALKABLE = new Set(['.', ',', '=', 'f', ':', ';', 'o', 'b']);
export const GRASS = new Set([',', ':']);

const SP = { prof: 7, rival: 6, nurse: 9, clerk: 0, kid: 0, lass: 9, hiker: 3, punk: 5, mage: 7, knight: 2, bard: 4, guard: 1, king: 10, girl: 6 };

/** Rival's pet is the starter that does best against yours. */
export const RIVAL_PICK = { embit: 'dribbit', dribbit: 'sprigling', sprigling: 'embit' };
const RIVAL_EVO = { dribbit: ['splashpod', 'octorrent'], sprigling: ['budhorn', 'bloomhorn'], embit: ['cindrel', 'blazquill'] };

/** Rival teams depend on the player's starter: 'R' in a team stands for the rival's starter line. */
export function rivalTeam(team, starter) {
  const mine = RIVAL_PICK[starter] || 'dribbit';
  return team.map(([sp, lv]) => {
    if (sp === 'R') return [mine, lv];
    if (sp === 'R2') return [RIVAL_EVO[mine][0], lv];
    if (sp === 'R3') return [RIVAL_EVO[mine][1], lv];
    return [sp, lv];
  });
}

export const MAPS = {
  sproutvale: {
    name: 'Sproutvale', town: true, music: 'town',
    tiles: [
      'TTTTT==TTTTT',
      'T....==..f.T',
      'Tf...==....T',
      'T###.==.###T',
      'T###.==.###T',
      'T###.==.###T',
      'T.=..==..=.T',
      'T.========.T',
      'T....==....T',
      'Tff..==..ffT',
      'T####==.###T',
      'T####==.###T',
      'T####==.###T',
      'T..=.==..=.T',
      'T..=======.T',
      'T.f..~~~.f.T',
      'T....~~~...T',
      'TTTTTTTTTTTT',
    ],
    buildings: [
      { kind: 'home', x: 1, y: 3, w: 3, h: 3, name: 'Your home' },
      { kind: 'lab', x: 8, y: 3, w: 3, h: 3, name: 'Prof. Rowan\'s lab' },
      { kind: 'clinic', x: 1, y: 10, w: 4, h: 3, name: 'Pet Clinic' },
      { kind: 'shop', x: 8, y: 10, w: 3, h: 3, name: 'Pet Shop', stock: 'basic' },
    ],
    exits: [{ x: 5, y: 0, to: 'route1', tx: 5, ty: 24 }, { x: 6, y: 0, to: 'route1', tx: 6, ty: 24 }],
    npcs: [
      { id: 'prof', x: 5, y: 1, ch: SP.prof, name: 'Prof. Rowan', kind: 'prof', aside: [4, 2], asideFlag: 'starter' },
      { id: 'rival1', x: 6, y: 1, ch: SP.rival, name: 'Kit', title: 'Rival', kind: 'trainer', face: 'left', sight: 0, needFlag: 'starter', hideWhenBeaten: true, rival: true,
        team: [['R', 4]], reward: 15, skillWeight: 0.5, friendly: true,
        intro: ['Kit: Hey! Grandpa gave you a pet too?', 'Let\'s see whose is better. Battle me!'],
        lose: ['Kit: Aw, no way! I\'ll train harder. See you in Peakside!'], win: ['Kit: Ha! Better luck next time!'] },
      { id: 'mom', x: 3, y: 7, ch: SP.lass, name: 'Mom', kind: 'talk', face: 'right',
        text: ['Mom: Take care out there, dear!', 'If your pets get tired, come home or visit the Pet Clinic to rest them.'] },
      { id: 'sv_kid', x: 9, y: 15, ch: SP.kid, name: 'Boy', kind: 'talk', face: 'left',
        text: ['Tall grass hides wild pets! Weaken one, then throw a Capsule.', 'A sleepy or paralysed pet is much easier to catch.'] },
    ],
    signs: [{ x: 4, y: 8, text: ['SPROUTVALE', 'A quiet town where every journey begins.'] }],
    items: [{ id: 'sv_potion', x: 10, y: 16, item: 'potion', n: 1 }],
  },

  route1: {
    name: 'Meadow Path',
    tiles: [
      'TTTTT==TTTTT',
      'T,,,.==.,,,T',
      'T,,,.==.,,,T',
      'T....==....T',
      'TTT..==.TTTT',
      'T,,,,==..f.T',
      'T,,,,==..r.T',
      'T,,,,==....T',
      'T....=====.T',
      'TTTT.....=.T',
      'T~~~T,,,.=.T',
      'T~~~.,,,.=.T',
      'T~~~.,,,.=.T',
      'TTTT..====.T',
      'T,,,,.=....T',
      'T,,,,.=..TTT',
      'T,,,,.=....T',
      'T.....=,,,,T',
      'TTT...=,,,,T',
      'T.f...=,,,,T',
      'T,,,..=....T',
      'T,,,..==...T',
      'T,,,...=...T',
      'T.r....=.f.T',
      'T....===...T',
      'TTTTT==TTTTT',
    ],
    exits: [
      { x: 5, y: 0, to: 'brookton', tx: 6, ty: 16 }, { x: 6, y: 0, to: 'brookton', tx: 7, ty: 16 },
      { x: 5, y: 25, to: 'sproutvale', tx: 5, ty: 1 }, { x: 6, y: 25, to: 'sproutvale', tx: 6, ty: 1 },
    ],
    wild: { rate: 0.14, grass: [['peeplet', 3, 6, 35], ['mewlet', 3, 6, 25], ['tadling', 3, 6, 20], ['emberkit', 4, 6, 12], ['fernkit', 4, 6, 8]] },
    npcs: [
      { id: 'r1_pip', x: 4, y: 19, ch: SP.kid, name: 'Pip', title: 'Bug Kid', kind: 'trainer', face: 'right', sight: 3,
        team: [['peeplet', 4], ['peeplet', 4]], reward: 10, intro: ['Pip: My Peeplets will peck you to pieces!'], lose: ['Pip: Peep...'] },
      { id: 'r1_mae', x: 8, y: 7, ch: SP.lass, name: 'Mae', title: 'Lass', kind: 'trainer', face: 'left', sight: 3,
        team: [['mewlet', 4], ['tadling', 5]], reward: 14, intro: ['Mae: You look new. Let me show you how it\'s done!'], lose: ['Mae: Okay, you\'re pretty good.'] },
      { id: 'r1_tom', x: 4, y: 12, ch: SP.bard, name: 'Tom', title: 'Fisher', kind: 'trainer', face: 'right', sight: 5,
        team: [['tadling', 5], ['peeplet', 6]], reward: 14, intro: ['Tom: Nothing biting today. Let\'s battle instead!'], lose: ['Tom: Tide pets hate Spark moves. Remember that!'] },
      { id: 'r1_tip', x: 10, y: 22, ch: SP.bard, name: 'Old man', kind: 'talk', face: 'left',
        text: ['Every type beats the next one round the wheel:', 'Flame > Leaf > Stone > Spark > Tide > Flame.', 'Plain pets have no strengths and no weaknesses.'] },
    ],
    signs: [{ x: 9, y: 23, text: ['MEADOW PATH', 'North: Brookton'] }],
    items: [{ id: 'r1_cap', x: 4, y: 11, item: 'capsule', n: 3 }, { id: 'r1_pot', x: 10, y: 5, item: 'potion', n: 1 }],
  },

  brookton: {
    name: 'Brookton', town: true,
    tiles: [
      'TTTTTTT=TTTTTT',
      'T.....F=F....T',
      'T.f....==F.f.T',
      'T#####.==.###T',
      'T#####.==.###T',
      'T#####.==.###T',
      'T#####.==.###T',
      'T...=..==..=.T',
      'T~~.========.T',
      'T~~...==.....T',
      'T####.==.###.T',
      'T####.==.###.T',
      'T####.==.###.T',
      'T..=..==..=..T',
      'T..========f.T',
      'Tf....==.....T',
      'T.....==.....T',
      'TTTTTT==TTTTTT',
    ],
    buildings: [
      { kind: 'hall', x: 1, y: 3, w: 5, h: 4, name: 'Brookton Hall', leader: 'fern' },
      { kind: 'house', x: 10, y: 3, w: 3, h: 4, name: 'House', text: ['A family lives here.', '"Fern\'s pets love to put you to sleep. Pack some Cure Drops!"'] },
      { kind: 'clinic', x: 1, y: 10, w: 4, h: 3, name: 'Pet Clinic' },
      { kind: 'shop', x: 9, y: 10, w: 3, h: 3, name: 'Pet Shop', stock: 'town' },
    ],
    exits: [
      { x: 6, y: 17, to: 'route1', tx: 5, ty: 1 }, { x: 7, y: 17, to: 'route1', tx: 6, ty: 1 },
      { x: 7, y: 0, to: 'woods', tx: 6, ty: 26 },
    ],
    npcs: [
      { id: 'bk_guard', x: 7, y: 1, ch: SP.guard, name: 'Guard', kind: 'gate', need: { badges: 1 }, aside: [8, 2], face: 'down',
        text: ['Guard: Whisperwood is full of strong wild pets.', 'Come back once you have Fern\'s Leaf Badge.'] },
      { id: 'bk_apprentice', x: 4, y: 9, ch: SP.lass, name: 'Bea', title: 'Apprentice', kind: 'trainer', face: 'right', sight: 3,
        team: [['sprigling', 7], ['fernkit', 8]], reward: 12,
        intro: ['Bea: I train at Fern\'s Hall! Let me see if you\'re ready for her.'],
        lose: ['Bea: You\'re ready. Fern\'s pets love Sleep Pollen, so bring a Cure Drop!'] },
      { id: 'bk_girl', x: 12, y: 15, ch: SP.girl, name: 'Girl', kind: 'talk', face: 'left',
        text: ['Fern uses Leaf pets.', 'Flame burns Leaf! A Flame pet hits it twice as hard.'] },
      { id: 'bk_man', x: 3, y: 14, ch: SP.bard, name: 'Man', kind: 'gift', face: 'right', item: 'capsule', n: 5,
        text: ['You\'re collecting pets? Take these!'], after: ['Catch a few different types. A full team of six covers every match-up.'] },
    ],
    signs: [{ x: 4, y: 7, text: ['BROOKTON HALL', 'Leader: Fern, the Leaf tamer'] }],
    items: [],
  },

  woods: {
    name: 'Whisperwood',
    tiles: [
      'TTTTTTTTTTTTTT',
      'TTTTTTooTTTTTT',
      'TT,,,..=...,TT',
      'T,,,,..=..,,,T',
      'T,,TT..=..TT,T',
      'T,,TT..=..TT.T',
      'T.....===....T',
      'TTTT,,,.=,,,,T',
      'T~~T,,,.=,,,,T',
      'T~~~,,,.=TTT.T',
      'T~~~....=....T',
      'TTTT.TTT=TT..T',
      'T,,,....=,,,,T',
      'T,,,TT..=,,,,T',
      'T,,,TT..=TT,,T',
      'T....=====...T',
      'TTT..=.TTT.TTT',
      'T,,,.=.,,,,,,T',
      'T,,,.=.,,,,,,T',
      'T,,,.=....TT.T',
      'TT...=..f.TT.T',
      'T.f..====....T',
      'T,,,,,..=TT..T',
      'T,,,,,..=TT,,T',
      'TTT.....=..,,T',
      'T.r....==....T',
      'T.....==.....T',
      'TTTTTT==TTTTTT',
    ],
    exits: [
      { x: 6, y: 27, to: 'brookton', tx: 7, ty: 1 }, { x: 7, y: 27, to: 'brookton', tx: 7, ty: 1 },
      { x: 6, y: 1, to: 'cave', tx: 6, ty: 22 }, { x: 7, y: 1, to: 'cave', tx: 7, ty: 22 },
    ],
    wild: { rate: 0.14, grass: [['sprigling', 7, 11, 15], ['fernkit', 7, 11, 25], ['zapkit', 8, 11, 20], ['peeplet', 8, 11, 15], ['tadling', 8, 11, 15], ['chirrup', 12, 13, 5], ['mewlet', 8, 11, 5]] },
    npcs: [
      { id: 'wd_ivy', x: 4, y: 21, ch: SP.lass, name: 'Ivy', title: 'Picnicker', kind: 'trainer', face: 'right', sight: 3,
        team: [['fernkit', 10], ['tadling', 11]], reward: 12, intro: ['Ivy: The woods are lovely, aren\'t they? Let\'s battle!'], lose: ['Ivy: Oh! You\'re strong.'] },
      { id: 'wd_rook', x: 10, y: 15, ch: SP.punk, name: 'Rook', title: 'Ranger', kind: 'trainer', face: 'left', sight: 4,
        team: [['zapkit', 11], ['peeplet', 11], ['zapkit', 12]], reward: 13, intro: ['Rook: Nobody gets past my Zapkits!'], lose: ['Rook: Zapped out...'] },
      { id: 'wd_ash', x: 6, y: 6, ch: SP.mage, name: 'Ash', title: 'Mystic', kind: 'trainer', face: 'down', sight: 0,
        team: [['mewlet', 12], ['sprigling', 12], ['emberkit', 13]], reward: 14, intro: ['Ash: The cave ahead burns with Flame pets. Prove you\'re ready!'], lose: ['Ash: You are ready. Pack Tide pets for the cave.'] },
      { id: 'wd_tip', x: 12, y: 10, ch: SP.kid, name: 'Kid', kind: 'talk', face: 'left',
        text: ['Status moves are sneaky!', 'Flame pets never get burned, Leaf pets never get poisoned and Spark pets never get paralysed.'] },
    ],
    signs: [{ x: 9, y: 25, text: ['WHISPERWOOD', 'North: Ember Cave'] }],
    items: [{ id: 'wd_pot', x: 4, y: 10, item: 'superpotion', n: 1 }, { id: 'wd_cure', x: 12, y: 3, item: 'curedrop', n: 2 }, { id: 'wd_cap', x: 12, y: 19, item: 'supercap', n: 2 }],
  },

  cave: {
    name: 'Ember Cave', cave: true,
    tiles: [
      'XXXXXXoXXXXXXX',
      'X;;;;;;;;;;;;X',
      'X;;XXXX;;XXX;X',
      'X;;X::::::::;X',
      'X;;X::XXXX::;X',
      'X:::::X;;X:::X',
      'X::XXXX;;XXX:X',
      'X::::r;;;;::;X',
      'XXX:::;;;;:::X',
      'X:::XX;;XXX::X',
      'X::::X;;X::::X',
      'X:XX:::;;::XXX',
      'X:X::::;;::::X',
      'X:::XXX;;XX::X',
      'XX::::;;;:::;X',
      'X:::r::;;:::;X',
      'X::XXX:;;XXX;X',
      'X::::X:;;:::;X',
      'XXX::::;;:::XX',
      'X;;;:::;;:::;X',
      'X;XX:::;;XX::X',
      'X;;;;;;;;;;;;X',
      'X;;;;;;;;;;;;X',
      'XXXXXXooXXXXXX',
    ],
    exits: [
      { x: 6, y: 23, to: 'woods', tx: 6, ty: 2 }, { x: 7, y: 23, to: 'woods', tx: 7, ty: 2 },
      { x: 6, y: 0, to: 'peakside', tx: 6, ty: 16 },
    ],
    wild: { rate: 0.1, grass: [['pebbit', 13, 17, 22], ['pebbleby', 13, 17, 22], ['sparkpod', 13, 17, 20], ['emberkit', 14, 17, 18], ['zapkit', 14, 16, 10], ['joltlet', 18, 19, 4], ['rockhorn', 18, 19, 4]] },
    npcs: [
      { id: 'cv_dig', x: 2, y: 19, ch: SP.hiker, name: 'Dig', title: 'Hiker', kind: 'trainer', face: 'right', sight: 4,
        team: [['pebbit', 14], ['pebbleby', 14], ['pebbit', 15]], reward: 14, intro: ['Dig: Rocks and more rocks! Battle!'], lose: ['Dig: Crumbled...'] },
      { id: 'cv_volt', x: 12, y: 14, ch: SP.punk, name: 'Volt', title: 'Ranger', kind: 'trainer', face: 'left', sight: 4,
        team: [['sparkpod', 15], ['zapkit', 15], ['emberkit', 16]], reward: 15, intro: ['Volt: My pets light up this cave!'], lose: ['Volt: Lights out.'] },
      { id: 'cinder', x: 6, y: 1, ch: SP.hiker, name: 'Cinder', title: 'Leader', kind: 'leader', face: 'down', sight: 0, aside: [8, 1], badge: 2 },
      { id: 'cv_tip', x: 1, y: 22, ch: SP.kid, name: 'Kid', kind: 'talk', face: 'right',
        text: ['Leader Cinder trains deep in this cave.', 'Tide douses Flame. Bring Tide pets!', 'There\'s no clinic in here, so stock up on Potions.'] },
    ],
    signs: [],
    items: [{ id: 'cv_revive', x: 1, y: 3, item: 'revive', n: 1 }, { id: 'cv_cap', x: 12, y: 17, item: 'supercap', n: 3 }, { id: 'cv_pot', x: 2, y: 14, item: 'superpotion', n: 2 }],
  },

  peakside: {
    name: 'Peakside', town: true,
    tiles: [
      'TTTTTTTT=TTTTT',
      'T......F=F...T',
      'T.ff...==F.f.T',
      'T#####.==.###T',
      'T#####.==.###T',
      'T#####.==.###T',
      'T#####.==.###T',
      'T...=..==..=.T',
      'T.=========..T',
      'T.=...==.....T',
      'T####.==.###.T',
      'T####.==.###.T',
      'T####.==.###.T',
      'T..=..==..=..T',
      'T..========..T',
      'T~~...==...f.T',
      'T~~...==.....T',
      'TTTTTT==TTTTTT',
    ],
    buildings: [
      { kind: 'hall', x: 1, y: 3, w: 5, h: 4, name: 'Peakside Hall', leader: 'marina' },
      { kind: 'house', x: 10, y: 3, w: 3, h: 4, name: 'House', text: ['An old tamer lives here.', '"Marina\'s pets heal themselves with Dew Drink. Hit hard and fast!"'] },
      { kind: 'clinic', x: 1, y: 10, w: 4, h: 3, name: 'Pet Clinic' },
      { kind: 'shop', x: 9, y: 10, w: 3, h: 3, name: 'Pet Shop', stock: 'city' },
    ],
    exits: [
      { x: 6, y: 17, to: 'cave', tx: 6, ty: 1 }, { x: 7, y: 17, to: 'cave', tx: 6, ty: 1 },
      { x: 8, y: 0, to: 'trail', tx: 5, ty: 28 },
    ],
    npcs: [
      { id: 'pk_guard', x: 8, y: 1, ch: SP.guard, name: 'Guard', kind: 'gate', need: { badges: 3 }, aside: [7, 2], face: 'down',
        text: ['Guard: The Summit Trail is only for tamers with three badges.'] },
      { id: 'rival2', x: 7, y: 14, ch: SP.rival, name: 'Kit', title: 'Rival', kind: 'trainer', face: 'down', sight: 0, ambush: true, hideWhenBeaten: true, rival: true,
        team: [['chirrup', 19], ['zapkit', 19], ['R2', 21]], reward: 25, skillWeight: 0.7,
        intro: ['Kit: There you are! I\'ve been training non-stop.', 'This time I won\'t lose!'],
        lose: ['Kit: Again?! Fine... Marina\'s Tide pets hate Spark moves. Good luck.'], win: ['Kit: Yes! Finally!'] },
      { id: 'pk_gift', x: 12, y: 14, ch: SP.lass, name: 'Nurse Joy', kind: 'gift', face: 'left', item: 'revive', n: 2,
        text: ['You\'ve come through the cave? Take these Revive Seeds.'], after: ['A Revive Seed wakes a fainted pet with half its HP.'] },
    ],
    signs: [{ x: 4, y: 7, text: ['PEAKSIDE HALL', 'Leader: Marina, the Tide tamer'] }],
    items: [{ id: 'pk_tonic', x: 1, y: 2, item: 'tonic', n: 1 }],
  },

  trail: {
    name: 'Summit Trail',
    tiles: [
      'TTTTT==TTTTT',
      'T....==....T',
      'T,,,.==.,,,T',
      'T,,,.==.,,,T',
      'TTT..==..TTT',
      'T,,,,==,,,,T',
      'T,,,,==,,,,T',
      'Tr...==...rT',
      'TT..====..TT',
      'T,,,,=.,,,,T',
      'T,,,,=.,,,,T',
      'T,,TT=.TT,,T',
      'T....=.....T',
      'T.r..====..T',
      'TTTT....=TTT',
      'T,,,,,..=,,T',
      'T,,,,,..=,,T',
      'T,,TTT..=..T',
      'T.......=..T',
      'T..=====...T',
      'TT.=..TTTT.T',
      'T,,=,,,,,,,T',
      'T,,=,,,,,,,T',
      'T..=....r..T',
      'T..====....T',
      'TTTTT=TT.TTT',
      'T,,,.=..,,,T',
      'T,,,.=..,,,T',
      'T....==....T',
      'TTTTT==TTTTT',
    ],
    exits: [
      { x: 5, y: 29, to: 'peakside', tx: 8, ty: 1 }, { x: 6, y: 29, to: 'peakside', tx: 8, ty: 1 },
      { x: 5, y: 0, to: 'summit', tx: 5, ty: 12 }, { x: 6, y: 0, to: 'summit', tx: 6, ty: 12 },
    ],
    wild: { rate: 0.14, grass: [['whiskar', 22, 26, 12], ['voltfox', 22, 25, 12], ['cragtoad', 23, 26, 12], ['bogtoad', 22, 26, 14], ['joltlet', 22, 25, 12], ['rockhorn', 22, 25, 12], ['chirrup', 22, 26, 12], ['flarefox', 22, 25, 8], ['mossmew', 22, 25, 6]] },
    npcs: [
      { id: 'tr_lee', x: 9, y: 24, ch: SP.knight, name: 'Lee', title: 'Ace', kind: 'trainer', face: 'left', sight: 4,
        team: [['voltfox', 24], ['bogtoad', 24], ['chirrup', 25]], reward: 16, intro: ['Lee: Only aces climb this trail!'], lose: ['Lee: You\'re an ace too.'] },
      { id: 'tr_sol', x: 2, y: 18, ch: SP.mage, name: 'Sol', title: 'Mystic', kind: 'trainer', face: 'right', sight: 5,
        team: [['flarefox', 25], ['mossmew', 25], ['joltlet', 25]], reward: 16, intro: ['Sol: I sense a strong bond with your pets. Show me!'], lose: ['Sol: As I foresaw.'] },
      { id: 'tr_bo', x: 10, y: 12, ch: SP.hiker, name: 'Bo', title: 'Hiker', kind: 'trainer', face: 'left', sight: 4,
        team: [['rockhorn', 25], ['cragtoad', 26], ['whiskar', 25]], reward: 17, intro: ['Bo: Rocco\'s the toughest leader there is. Try me first!'], lose: ['Bo: Leaf cracks Stone. Remember that up top.'] },
      { id: 'tr_ada', x: 4, y: 6, ch: SP.knight, name: 'Ada', title: 'Ace', kind: 'trainer', face: 'right', sight: 3,
        team: [['crestwing', 30], ['granitroot', 30]], reward: 18, intro: ['Ada: Last test before the summit!'], lose: ['Ada: Go on. The Champion is waiting.'] },
    ],
    signs: [{ x: 7, y: 28, text: ['SUMMIT TRAIL', 'North: the Summit'] }],
    items: [{ id: 'tr_ultra', x: 1, y: 12, item: 'ultracap', n: 2 }, { id: 'tr_max', x: 10, y: 1, item: 'maxpotion', n: 1 }, { id: 'tr_rev', x: 1, y: 23, item: 'revive', n: 1 }],
  },

  summit: {
    name: 'The Summit', town: true,
    tiles: [
      'TTTTTTTTTTTT',
      'Tr..#####.rT',
      'T...#####..T',
      'T...#####..T',
      'T...#####..T',
      'T......=...T',
      'T###..==.f.T',
      'T###..=####T',
      'T###..=####T',
      'T.=...=####T',
      'T.=====..=.T',
      'Tf...==....T',
      'T....==....T',
      'TTTTT==TTTTT',
    ],
    buildings: [
      { kind: 'tower', x: 4, y: 1, w: 5, h: 4, name: 'Champion Tower', champion: true },
      { kind: 'clinic', x: 1, y: 6, w: 3, h: 3, name: 'Summit Lodge' },
      { kind: 'hall', x: 7, y: 7, w: 4, h: 3, name: 'Summit Hall', leader: 'rocco' },
    ],
    exits: [{ x: 5, y: 13, to: 'trail', tx: 5, ty: 1 }, { x: 6, y: 13, to: 'trail', tx: 6, ty: 1 }],
    npcs: [
      { id: 'sm_guard', x: 6, y: 5, ch: SP.guard, name: 'Guard', kind: 'gate', need: { badges: 4 }, aside: [5, 5], face: 'down',
        text: ['Guard: Only tamers with all four badges may face the Champion.'] },
    ],
    signs: [{ x: 10, y: 10, text: ['THE SUMMIT', 'Champion Tower: four badges needed.'] }],
    items: [],
  },
};

// Badge leaders and the champion. `badge` is the badge number they give.
export const LEADERS = {
  fern: { name: 'Fern', title: 'Leader', ch: 9, type: 'leaf', badge: 1, badgeName: 'Leaf Badge', reward: 40, skillWeight: 1,
    team: [['fernkit', 8], ['sprigling', 9], ['budhorn', 11]], items: { potion: 1 },
    intro: ['Fern: Welcome to Brookton Hall!', 'My Leaf pets grow stronger in every battle. Let\'s see yours!'],
    rematch: [['mossmew', 38], ['voltfox', 37], ['bloomhorn', 40]],
    lose: ['Fern: Wonderful! You\'ve earned the Leaf Badge.', 'The guard will let you into Whisperwood now.'], win: ['Fern: Train a little more and come back!'] },
  cinder: { name: 'Cinder', title: 'Leader', ch: 3, type: 'flame', badge: 2, badgeName: 'Ember Badge', reward: 45, skillWeight: 1,
    team: [['emberkit', 16], ['zapkit', 16], ['flarefox', 19]], items: { superpotion: 1 },
    intro: ['Cinder: You found my hideout! Nobody leaves the cave without beating me.', 'Feel the heat!'],
    rematch: [['flarefox', 39], ['voltfox', 38], ['blazquill', 41]],
    lose: ['Cinder: Burned out... Take the Ember Badge.', 'Peakside is just through the tunnel behind me.'], win: ['Cinder: Too hot for you! Cool off and try again.'] },
  marina: { name: 'Marina', title: 'Leader', ch: 1, type: 'tide', badge: 3, badgeName: 'Wave Badge', reward: 50, skillWeight: 1,
    team: [['tadling', 20], ['splashpod', 21], ['bogtoad', 22], ['octorrent', 25]], items: { superpotion: 1 },
    intro: ['Marina: The tide always comes in. Can you hold it back?'],
    rematch: [['bogtoad', 40], ['voltopus', 39], ['mossmew', 39], ['octorrent', 42]],
    lose: ['Marina: Swept away! The Wave Badge is yours.', 'The Summit Trail is open to you now.'], win: ['Marina: The tide wins today.'] },
  rocco: { name: 'Rocco', title: 'Leader', ch: 2, type: 'stone', badge: 4, badgeName: 'Summit Badge', reward: 55, skillWeight: 1,
    team: [['pebbit', 27], ['rockhorn', 28], ['cragtoad', 29], ['granitroot', 31]], items: { superpotion: 2 },
    intro: ['Rocco: I am the last wall before the Champion.', 'Stone does not crack easily!'],
    rematch: [['cragtoad', 41], ['crestwing', 40], ['rockhorn', 41], ['granitroot', 43]],
    lose: ['Rocco: Cracked... You have all four badges.', 'Champion Aria waits in the tower.'], win: ['Rocco: Solid as ever. Come back stronger.'] },
  aria: { name: 'Aria', title: 'Champion', ch: 10, type: 'plain', badge: 5, reward: 80, skillWeight: 1, champion: true,
    team: [['crestwing', 32], ['voltfox', 32], ['mossmew', 32], ['bogtoad', 33], ['flarefox', 33], ['granitroot', 34]], items: { maxpotion: 2 },
    intro: ['Aria: So you\'re the tamer everyone is talking about.', 'I am Aria, the Champion. Show me everything you and your pets have learned!'],
    rematch: [['crestwing', 40], ['voltfox', 40], ['mossmew', 40], ['bogtoad', 41], ['flarefox', 41], ['granitroot', 43]],
    lose: ['Aria: Magnificent... You are the new Champion!'], win: ['Aria: A fine effort. Come back when you\'re ready.'] },
};

export const BADGES = ['fern', 'cinder', 'marina', 'rocco'];

export const SHOPS = {
  basic: ['capsule', 'potion', 'curedrop'],
  town: ['capsule', 'supercap', 'potion', 'superpotion', 'curedrop'],
  city: ['capsule', 'supercap', 'ultracap', 'potion', 'superpotion', 'maxpotion', 'curedrop', 'revive', 'tonic'],
};

// ---------------------------------------------------------------- helpers

export const tileAt = (map, x, y) => (y < 0 || y >= map.tiles.length || x < 0 || x >= map.tiles[0].length ? 'T' : map.tiles[y][x]);
export const mapSize = (map) => ({ w: map.tiles[0].length, h: map.tiles.length });

export function buildingAt(map, x, y) {
  return (map.buildings || []).find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) || null;
}
export const doorOf = (b) => ({ x: b.x + Math.floor(b.w / 2), y: b.y + b.h - 1 });

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
