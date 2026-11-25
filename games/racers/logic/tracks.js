// Track layouts and the race list. A layout is a closed loop of control points (world px, the
// spline runs through them in order); a track is a layout plus theme, weather and direction.
// Boost pads: [fraction of the lap, lateral offset]. Puddles (rain): [fraction, lateral, radius].

export const LAYOUTS = {
  downtown: {
    width: 46,
    points: [[200, 150], [700, 150], [900, 160], [1010, 260], [1000, 450], [880, 530], [720, 500], [600, 590], [640, 720], [500, 790], [220, 770], [120, 650], [170, 470], [100, 300]],
    pads: [[0.12, 0], [0.56, 6], [0.86, -6]],
  },
  harbor: {
    scale: 0.76,
    width: 48,
    points: [[150, 200], [600, 180], [1100, 200], [1260, 300], [1210, 430], [930, 440], [820, 540], [930, 650], [1200, 660], [1260, 770], [1100, 840], [420, 830], [210, 770], [120, 610], [270, 470], [150, 330]],
    pads: [[0.08, 0], [0.42, 0], [0.7, 8]],
  },
  park: {
    scale: 0.92,
    width: 46,
    points: [[300, 150], [600, 100], [850, 200], [900, 380], [1100, 450], [1150, 650], [950, 790], [720, 700], [550, 790], [300, 760], [170, 600], [360, 450], [150, 300]],
    pads: [[0.2, 0], [0.5, -6], [0.8, 0]],
  },
  highway: {
    scale: 0.72,
    width: 60,
    points: [[150, 180], [1250, 180], [1410, 300], [1350, 470], [920, 480], [770, 570], [910, 670], [1350, 690], [1430, 810], [1260, 920], [300, 910], [130, 790], [120, 500], [100, 300]],
    pads: [[0.05, 0], [0.3, -10], [0.62, 10], [0.9, 0]],
  },
  downtown2: {
    scale: 0.86,
    width: 46,
    points: [[160, 130], [530, 130], [590, 260], [720, 320], [900, 250], [1090, 150], [1260, 250], [1210, 450], [1010, 510], [1060, 680], [910, 810], [660, 770], [610, 610], [420, 570], [310, 710], [150, 630], [120, 360]],
    pads: [[0.1, 0], [0.45, 0], [0.75, 6]],
  },
  harbor2: {
    scale: 0.78,
    width: 48,
    points: [[150, 150], [900, 140], [1110, 260], [960, 390], [710, 370], [610, 470], [810, 570], [1150, 570], [1260, 710], [1110, 830], [600, 840], [250, 810], [140, 630], [310, 490], [160, 340]],
    pads: [[0.07, 0], [0.5, 0], [0.8, -6]],
  },
  park2: {
    scale: 0.88,
    width: 46,
    points: [[200, 170], [520, 130], [760, 220], [710, 420], [900, 530], [1100, 380], [1260, 500], [1210, 760], [900, 830], [610, 710], [410, 830], [180, 710], [270, 510], [120, 360]],
    pads: [[0.15, 0], [0.48, 6], [0.83, 0]],
  },
  highway2: {
    scale: 0.84,
    width: 60,
    points: [[160, 300], [500, 150], [1000, 140], [1400, 250], [1460, 500], [1210, 610], [1360, 800], [1010, 910], [610, 830], [420, 660], [220, 720], [100, 520]],
    pads: [[0.06, 0], [0.33, 0], [0.55, -10], [0.82, 10]],
  },
};

export const THEMES = ['downtown', 'harbor', 'park', 'highway'];

// laps: 3 everywhere (a lap is 20-30 s at full speed)
export const TRACKS = [
  // Cup 1: Sunny Cup
  { id: 'downtown', name: 'Downtown Loop', layout: 'downtown', theme: 'downtown', mood: 'day', cup: 0 },
  { id: 'harbor', name: 'Harbor Run', layout: 'harbor', theme: 'harbor', mood: 'day', cup: 0 },
  { id: 'park', name: 'Park Lane', layout: 'park', theme: 'park', mood: 'day', cup: 0 },
  { id: 'highway', name: 'Highway Dash', layout: 'highway', theme: 'highway', mood: 'day', cup: 0 },
  // Cup 2: Moonlight Cup
  { id: 'neon', name: 'Neon Streets', layout: 'downtown2', theme: 'downtown', mood: 'night', cup: 1 },
  { id: 'storm', name: 'Harbor Storm', layout: 'harbor2', theme: 'harbor', mood: 'rain', cup: 1 },
  { id: 'moonpark', name: 'Moonlit Park', layout: 'park2', theme: 'park', mood: 'night', cup: 1 },
  { id: 'wetway', name: 'Wet Highway', layout: 'highway2', theme: 'highway', mood: 'rain', cup: 1 },
  // Cup 3: Champion Cup (earlier layouts, driven the other way, in tougher weather)
  { id: 'downtown-r', name: 'Downtown Rain', layout: 'downtown', theme: 'downtown', mood: 'rain', reverse: true, cup: 2 },
  { id: 'harbor-r', name: 'Harbor Lights', layout: 'harbor', theme: 'harbor', mood: 'night', reverse: true, cup: 2 },
  { id: 'park-r', name: 'Park Showers', layout: 'park', theme: 'park', mood: 'rain', reverse: true, cup: 2 },
  { id: 'highway-r', name: 'Midnight Run', layout: 'highway2', theme: 'highway', mood: 'night', reverse: true, cup: 2 },
];

export const CUPS = [
  { id: 'sunny', name: 'Sunny Cup', tracks: TRACKS.filter((t) => t.cup === 0).map((t) => t.id) },
  { id: 'moon', name: 'Moonlight Cup', tracks: TRACKS.filter((t) => t.cup === 1).map((t) => t.id) },
  { id: 'champ', name: 'Champion Cup', tracks: TRACKS.filter((t) => t.cup === 2).map((t) => t.id) },
];

export const LAPS = 3;

export const trackById = (id) => TRACKS.find((t) => t.id === id) || TRACKS[0];

/** The full definition buildTrack() wants: layout + direction + per-weather extras. */
export function trackDef(id) {
  const tr = trackById(id);
  const lay = LAYOUTS[tr.layout];
  let pads = lay.pads;
  if (tr.reverse) pads = pads.map(([f, lat]) => [1 - f, -lat]);
  // Rain tracks get puddles: patches with little grip, spread round the lap.
  const puddles = tr.mood === 'rain'
    ? [0.18, 0.37, 0.53, 0.68, 0.93].map((f, k) => [f, (k % 2 ? 1 : -1) * (lay.width / 2 - 12), 9 + (k % 3) * 2])
    : [];
  return { ...tr, points: lay.points, scale: lay.scale || 1, width: lay.width, pads, puddles };
}
