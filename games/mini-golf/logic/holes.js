// Every hole in the game. Coordinates are world px (the ball is 10 px across).
//   bounds:  the course outline (rect or polygon). The ball bounces off its edges.
//   blocks:  solid walls inside the course.
//   zones:   sand | water | ice | slope (g = push per second) | boost (dir) | ramp (dir: launches the ball)
//            On the castle course water is drawn as a moat or lava; on the frost course sand is snow.
//   bumpers: [x, y, r]   teleports: { a: [x, y], b: [x, y] } (a sends to b)
//   movers:  windmill { x, y, len, blades, speed } | slider { r, to, period, hold, phase } (hold = gate)
//   tip:     shown on the hole's intro card.

const R = (x, y, w, h, extra) => ({ r: [x, y, w, h], ...extra });
const C = (x, y, r, extra) => ({ c: [x, y, r], ...extra });
const P = (pts, extra) => ({ p: pts, ...extra });

export const COURSES = [
  { id: 'meadow', name: 'Meadow Greens', blurb: 'Grass, sand and ponds', theme: 'meadow' },
  { id: 'frost', name: 'Frost Peak', blurb: 'Ice, boosts and portals', theme: 'frost' },
  { id: 'castle', name: 'Castle Keep', blurb: 'Moats, ramps and gates', theme: 'castle' },
];

const MEADOW = [
  {
    name: 'First Putt', par: 2, tip: 'Put your finger on the ball, pull back and let go.',
    bounds: R(0, 0, 120, 340), tee: [60, 290], cup: [60, 62],
  },
  {
    name: 'The Bend', par: 3, tip: 'Walls bounce the ball. Bank it round the corner.',
    bounds: P([[0, 0], [250, 0], [250, 110], [110, 110], [110, 420], [0, 420]]), tee: [55, 370], cup: [195, 55],
  },
  {
    name: 'Sand Trap', par: 2, tip: 'Sand slows the ball right down. Go round it.',
    bounds: R(0, 0, 180, 420), tee: [90, 370], cup: [90, 62],
    zones: [R(36, 170, 108, 70, { t: 'sand' })],
  },
  {
    name: 'Bumper Garden', par: 2, tip: 'Red bumpers kick the ball away, faster.',
    bounds: R(0, 0, 240, 420), tee: [120, 370], cup: [120, 58],
    bumpers: [[120, 215, 12], [58, 150, 10], [182, 150, 10], [68, 290, 10], [172, 290, 10]],
  },
  {
    name: 'Duck Pond', par: 3, tip: 'Water costs one stroke and the ball goes back.',
    bounds: R(0, 0, 260, 440), tee: [130, 395], cup: [130, 58],
    zones: [C(130, 220, 72, { t: 'water' })],
  },
  {
    name: 'The Windmill', par: 2, tip: 'Time your putt between the windmill sails.',
    bounds: R(0, 0, 180, 470), tee: [90, 420], cup: [90, 60],
    blocks: [R(0, 210, 70, 34), R(110, 210, 70, 34)],
    movers: [{ t: 'windmill', x: 90, y: 270, len: 40, blades: 4, speed: 1.3 }],
  },
  {
    name: 'Hillside', par: 3, tip: 'Arrows show a slope. The ball rolls downhill.',
    bounds: R(0, 0, 260, 470), tee: [60, 420], cup: [60, 62],
    zones: [R(0, 150, 260, 170, { t: 'slope', g: [110, 0] })],
    blocks: [R(150, 0, 20, 110)],
  },
  {
    name: 'Zig Zag', par: 3, tip: 'Use the walls to zig and zag up the hill.',
    bounds: R(0, 0, 240, 540), tee: [55, 490], cup: [55, 58],
    blocks: [R(0, 400, 160, 22), R(80, 265, 160, 22), R(0, 130, 160, 22)],
  },
  {
    name: 'Meadow Finale', par: 4, tip: 'Sand, pond, bumpers and a windmill. Take your time.',
    bounds: R(0, 0, 300, 640), tee: [150, 595], cup: [235, 62],
    zones: [R(0, 300, 190, 70, { t: 'water' }), C(235, 62, 42, { t: 'sand' }), C(235, 62, 13, { t: 'grass' })],
    bumpers: [[240, 470, 11], [80, 480, 11]],
    blocks: [R(100, 150, 200, 26)],
    movers: [{ t: 'windmill', x: 50, y: 210, len: 46, blades: 3, speed: -1.1 }],
  },
];

const FROST = [
  {
    name: 'Thin Ice', par: 2, tip: 'Ice hardly slows the ball. Putt gently.',
    bounds: R(0, 0, 160, 440), tee: [80, 395], cup: [80, 110],
    zones: [R(0, 0, 160, 250, { t: 'ice' })],
  },
  {
    name: 'Speed Pad', par: 2, tip: 'Gold arrows boost the ball the way they point.',
    bounds: R(0, 0, 130, 660), tee: [65, 610], cup: [65, 60],
    zones: [R(25, 450, 80, 44, { t: 'boost', dir: [0, -1] }), R(0, 0, 130, 34, { t: 'sand' }), R(0, 90, 130, 60, { t: 'ice' })],
  },
  {
    name: 'Glacier Slide', par: 3, tip: 'Icy slope: aim uphill and let it slide down.',
    bounds: R(0, 0, 260, 470), tee: [210, 420], cup: [205, 62],
    zones: [R(40, 150, 220, 170, { t: 'ice' }), R(40, 150, 220, 170, { t: 'slope', g: [-80, 0] }), R(0, 140, 40, 190, { t: 'sand' })],
  },
  {
    name: 'Sliding Doors', par: 2, tip: 'Wait for a gap, then go.',
    bounds: R(0, 0, 180, 470), tee: [90, 420], cup: [90, 60],
    movers: [{ t: 'slider', r: [0, 222, 92, 24], to: [88, 0], period: 3.2 }],
    zones: [R(0, 300, 180, 60, { t: 'ice' })],
  },
  {
    name: 'Portal Pass', par: 2, tip: 'Roll into a portal and pop out of its twin.',
    bounds: R(0, 0, 280, 470), tee: [140, 420], cup: [140, 62],
    blocks: [R(0, 225, 280, 24)],
    teleports: [{ a: [70, 330], b: [210, 152] }],
  },
  {
    name: 'Ice Rink', par: 3, tip: 'All ice! Bumpers guard the cup.',
    bounds: P([[50, 0], [230, 0], [280, 50], [280, 400], [230, 450], [50, 450], [0, 400], [0, 50]]), tee: [140, 405], cup: [140, 110],
    zones: [P([[50, 0], [230, 0], [280, 50], [280, 400], [230, 450], [50, 450], [0, 400], [0, 50]], { t: 'ice' })],
    bumpers: [[100, 150, 10], [180, 150, 10], [140, 200, 10], [70, 280, 10], [210, 280, 10]],
  },
  {
    name: 'Avalanche', par: 3, tip: 'Uphill all the way. Hit it firmly.',
    bounds: R(0, 0, 240, 640), tee: [120, 595], cup: [190, 60],
    zones: [R(0, 140, 240, 160, { t: 'slope', g: [0, 120] }), R(0, 360, 240, 160, { t: 'slope', g: [0, 120] }), R(0, 300, 90, 60, { t: 'sand' })],
    blocks: [R(150, 300, 90, 30), R(0, 110, 140, 24)],
  },
  {
    name: 'Ice Gates', par: 3, tip: 'Gates open and close. Watch the rhythm.',
    bounds: R(0, 0, 200, 600), tee: [100, 550], cup: [100, 60],
    movers: [
      { t: 'slider', r: [0, 400, 100, 18], to: [-100, 0], period: 3.6, hold: 0.25 },
      { t: 'slider', r: [100, 400, 100, 18], to: [100, 0], period: 3.6, hold: 0.25 },
      { t: 'slider', r: [0, 190, 100, 18], to: [-100, 0], period: 3.6, hold: 0.25, phase: 0.5 },
      { t: 'slider', r: [100, 190, 100, 18], to: [100, 0], period: 3.6, hold: 0.25, phase: 0.5 },
    ],
    zones: [R(0, 230, 200, 140, { t: 'ice' })],
  },
  {
    name: 'The Summit', par: 4, tip: 'Boost, portal and ice. The top of the mountain!',
    bounds: R(0, 0, 300, 660), tee: [60, 610], cup: [235, 70],
    blocks: [R(120, 160, 26, 500), R(146, 300, 154, 24)],
    zones: [R(20, 380, 80, 44, { t: 'boost', dir: [0, -1] }), R(146, 40, 154, 120, { t: 'ice' }), R(0, 60, 120, 80, { t: 'sand' })],
    teleports: [{ a: [60, 200], b: [225, 520] }],
    movers: [{ t: 'slider', r: [146, 200, 70, 20], to: [84, 0], period: 2.8 }],
  },
];

const CASTLE = [
  {
    name: 'Moat Jump', par: 2, tip: 'Hit the ramp fast to fly over the moat.',
    bounds: R(0, 0, 180, 520), tee: [90, 470], cup: [90, 90],
    zones: [R(0, 0, 180, 40, { t: 'sand' }), R(0, 250, 180, 64, { t: 'water' }), R(60, 314, 60, 26, { t: 'ramp', dir: [0, -1] })],
  },
  {
    name: 'Portcullis', par: 2, tip: 'The castle gate goes up and down.',
    bounds: R(0, 0, 220, 480), tee: [110, 430], cup: [110, 64],
    blocks: [R(0, 220, 90, 30), R(130, 220, 90, 30)],
    movers: [{ t: 'slider', r: [90, 222, 40, 26], to: [0, -48], period: 3, hold: 0.22 }],
    bumpers: [[50, 120, 10], [170, 120, 10]],
  },
  {
    name: 'Twin Mills', par: 3, tip: 'Two windmills, spinning opposite ways.',
    bounds: R(0, 0, 260, 560), tee: [130, 510], cup: [130, 60],
    blocks: [R(0, 360, 110, 30), R(150, 360, 110, 30), R(0, 170, 60, 30), R(100, 170, 160, 30)],
    movers: [
      { t: 'windmill', x: 130, y: 420, len: 40, blades: 4, speed: 1.4 },
      { t: 'windmill', x: 80, y: 230, len: 38, blades: 4, speed: -1.5 },
    ],
  },
  {
    name: 'Throne Room', par: 3, tip: 'Portals and bumpers. Find the quick way.',
    bounds: R(0, 0, 280, 500), tee: [140, 455], cup: [140, 70],
    blocks: [R(0, 250, 110, 26), R(170, 250, 110, 26)],
    bumpers: [[140, 330, 12], [140, 175, 12], [80, 130, 10], [200, 130, 10]],
    teleports: [{ a: [40, 400], b: [240, 120] }],
  },
  {
    name: 'Dungeon Maze', par: 4, tip: 'A maze! The portal is a shortcut if you can reach it.',
    bounds: R(0, 0, 300, 560), tee: [40, 515], cup: [260, 50],
    blocks: [R(80, 420, 220, 22), R(0, 300, 220, 22), R(80, 170, 220, 22), R(120, 442, 22, 60)],
    teleports: [{ a: [260, 360], b: [40, 110] }],
  },
  {
    name: 'Lava Bridge', par: 3, tip: 'Cross the narrow bridge, or ramp over the lava.',
    bounds: R(0, 0, 240, 560), tee: [60, 510], cup: [120, 64],
    zones: [R(0, 180, 240, 200, { t: 'water' }), R(150, 180, 40, 200, { t: 'grass' }), R(20, 380, 60, 28, { t: 'ramp', dir: [0, -1] })],
  },
  {
    name: 'Guard Patrol', par: 3, tip: 'Three guards march across. Slip past them.',
    bounds: R(0, 0, 220, 600), tee: [110, 550], cup: [110, 60],
    movers: [
      { t: 'slider', r: [0, 420, 70, 22], to: [150, 0], period: 3 },
      { t: 'slider', r: [150, 290, 70, 22], to: [-150, 0], period: 2.6 },
      { t: 'slider', r: [0, 160, 70, 22], to: [150, 0], period: 3.4, phase: 0.3 },
    ],
  },
  {
    name: 'Spiral Tower', par: 4, tip: 'Wind your way into the middle of the tower.',
    bounds: R(0, 0, 300, 440), tee: [40, 400], cup: [150, 225],
    blocks: [R(80, 300, 220, 22), R(80, 100, 22, 200), R(80, 100, 150, 22), R(208, 122, 22, 110), R(150, 270, 80, 22)],
    zones: [R(102, 122, 106, 178, { t: 'slope', g: [0, -40] })],
  },
  {
    name: "King's Green", par: 4, tip: 'The grand finale: moat, gate, mill and bumpers.',
    bounds: R(0, 0, 300, 700), tee: [150, 655], cup: [150, 62],
    zones: [R(0, 470, 300, 60, { t: 'water' }), R(120, 530, 60, 26, { t: 'ramp', dir: [0, -1] })],
    blocks: [R(0, 300, 130, 30), R(170, 300, 130, 30)],
    movers: [
      { t: 'slider', r: [130, 302, 40, 26], to: [0, -48], period: 3, hold: 0.22 },
      { t: 'windmill', x: 150, y: 200, len: 44, blades: 4, speed: 1.2 },
    ],
    bumpers: [[60, 400, 11], [240, 400, 11], [70, 110, 10], [230, 110, 10]],
  },
];

// Daily holes: one is picked each day from dailySeed().
const DAILY = [
  {
    name: 'Daily: Crossroads', par: 3, theme: 'meadow', tip: 'Same hole for everyone today.',
    bounds: P([[100, 0], [180, 0], [180, 160], [280, 160], [280, 260], [180, 260], [180, 460], [100, 460], [100, 260], [0, 260], [0, 160], [100, 160]]),
    tee: [140, 420], cup: [40, 210], bumpers: [[140, 210, 12]],
  },
  {
    name: 'Daily: Frozen Pond', par: 3, theme: 'frost', tip: 'Same hole for everyone today.',
    bounds: R(0, 0, 260, 480), tee: [130, 430], cup: [130, 70],
    zones: [C(130, 250, 90, { t: 'ice' }), C(130, 250, 40, { t: 'water' })],
    bumpers: [[60, 120, 10], [200, 120, 10]],
  },
  {
    name: 'Daily: Pinball', par: 3, theme: 'castle', tip: 'Same hole for everyone today.',
    bounds: R(0, 0, 260, 520), tee: [130, 470], cup: [130, 60],
    bumpers: [[70, 160, 11], [130, 200, 11], [190, 160, 11], [100, 290, 11], [160, 290, 11], [130, 120, 9]],
  },
  {
    name: 'Daily: Sandy Bay', par: 3, theme: 'meadow', tip: 'Same hole for everyone today.',
    bounds: R(0, 0, 280, 500), tee: [50, 450], cup: [230, 60],
    zones: [R(0, 180, 280, 60, { t: 'sand' }), R(120, 260, 160, 90, { t: 'water' }), R(0, 60, 150, 60, { t: 'water' })],
  },
  {
    name: 'Daily: Portal Hop', par: 3, theme: 'frost', tip: 'Same hole for everyone today.',
    bounds: R(0, 0, 280, 500), tee: [50, 450], cup: [230, 60],
    blocks: [R(0, 300, 280, 24), R(0, 150, 280, 24)],
    teleports: [{ a: [230, 400], b: [50, 250] }, { a: [230, 230], b: [50, 100] }],
  },
  {
    name: 'Daily: Mill Run', par: 3, theme: 'meadow', tip: 'Same hole for everyone today.',
    bounds: R(0, 0, 200, 560), tee: [100, 510], cup: [100, 60],
    blocks: [R(0, 330, 80, 30), R(120, 330, 80, 30)],
    movers: [{ t: 'windmill', x: 100, y: 390, len: 40, blades: 3, speed: 1.6 }, { t: 'slider', r: [0, 180, 80, 20], to: [120, 0], period: 2.8 }],
    zones: [R(0, 420, 200, 40, { t: 'slope', g: [0, 80] })],
  },
  {
    name: 'Daily: High Jump', par: 3, theme: 'castle', tip: 'Same hole for everyone today.',
    bounds: R(0, 0, 220, 560), tee: [110, 510], cup: [110, 60],
    zones: [R(0, 330, 220, 60, { t: 'water' }), R(80, 390, 60, 26, { t: 'ramp', dir: [0, -1] }), R(0, 140, 220, 50, { t: 'water' }), R(140, 190, 60, 26, { t: 'ramp', dir: [0, -1] })],
  },
];

const build = (list, course, ci) => list.map((h, i) => ({ ...h, id: `${ci + 1}-${i + 1}`, course: ci, index: i, theme: h.theme || course.theme }));

export const HOLES = [
  ...build(MEADOW, COURSES[0], 0),
  ...build(FROST, COURSES[1], 1),
  ...build(CASTLE, COURSES[2], 2),
];
export const DAILY_HOLES = DAILY.map((h, i) => ({ ...h, id: `d${i + 1}`, course: -1, index: i }));

export const holesOf = (ci) => HOLES.filter((h) => h.course === ci);
export const holeById = (id) => HOLES.find((h) => h.id === id) || DAILY_HOLES.find((h) => h.id === id);
export const coursePar = (ci) => holesOf(ci).reduce((n, h) => n + h.par, 0);
export const dailyHole = (seed) => DAILY_HOLES[seed % DAILY_HOLES.length];

/** Most strokes allowed on a hole before the ball is picked up. */
export const strokeCap = (h) => h.par + 5;

/** Stars for a score: 3 at par or better, 2 at one over, 1 for finishing. */
export const starsFor = (strokes, par) => (strokes == null ? 0 : strokes <= par ? 3 : strokes <= par + 1 ? 2 : 1);

/** Golf name for a score against par. */
export function scoreName(strokes, par) {
  if (strokes === 1) return 'Hole in one!';
  const d = strokes - par;
  return { '-3': 'Albatross!', '-2': 'Eagle!', '-1': 'Birdie!', 0: 'Par', 1: 'Bogey', 2: 'Double bogey' }[d] || (d < 0 ? 'Amazing!' : `${d} over par`);
}
