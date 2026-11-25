// Art: the packed atlas (atlas/racers.png, built by tools/build_atlas.py), paint jobs for the
// race cars, and the baked picture of each track (ground, road and scenery in one texture).
import atlasUrl from './atlas/racers.png?url';
import ATLAS from './atlas/racers.json';
import { addFrames } from '../../shared/core/ui.js';
import { paintTrack, placeScenery, lampSpots, light } from './logic/raster.js';

export const ATLAS_KEY = 'racers';

export function preloadArt(scene) {
  scene.load.image(ATLAS_KEY, atlasUrl);
}

export function setupArt(scene) {
  addFrames(scene, ATLAS_KEY, ATLAS);
}

// Body colours (light, mid, dark) swapped in for the atlas's key colours.
export const PAINT = {
  red: [[240, 96, 96], [208, 70, 72], [140, 40, 52]],
  blue: [[120, 164, 240], [89, 125, 206], [48, 52, 109]],
  yellow: [[244, 234, 130], [218, 200, 70], [160, 128, 40]],
  green: [[150, 210, 90], [109, 170, 44], [52, 101, 36]],
  purple: [[200, 130, 220], [154, 64, 126], [90, 40, 90]],
  white: [[252, 252, 246], [214, 226, 214], [140, 150, 164]],
  orange: [[244, 168, 90], [210, 125, 44], [150, 80, 40]],
  black: [[110, 106, 120], [66, 62, 72], [34, 30, 42]],
};
export const PAINT_HEX = Object.fromEntries(Object.entries(PAINT).map(([k, v]) => [k, (v[1][0] << 16) | (v[1][1] << 8) | v[1][2]]));
const KEYS = [[255, 0, 255], [200, 0, 200], [140, 0, 140]];
export const CELL = 20;

/** Texture with the 16 headings of a model in a paint job; frames '0'..'15'. */
export function carTexture(scene, model, colour) {
  const key = `car-${model}-${colour}`;
  if (scene.textures.exists(key)) return key;
  const src = scene.textures.get(ATLAS_KEY).getSourceImage();
  const tex = scene.textures.createCanvas(key, CELL * 16, CELL);
  const ctx = tex.context;
  for (let a = 0; a < 16; a++) {
    const [x, y, w, h] = ATLAS[`car:${model}:${a}`];
    ctx.drawImage(src, x, y, w, h, a * CELL, 0, w, h);
  }
  const img = ctx.getImageData(0, 0, CELL * 16, CELL);
  const d = img.data;
  const pal = PAINT[colour] || PAINT.red;
  for (let o = 0; o < d.length; o += 4) {
    if (!d[o + 3]) continue;
    for (let k = 0; k < 3; k++) {
      if (d[o] === KEYS[k][0] && d[o + 1] === KEYS[k][1] && d[o + 2] === KEYS[k][2]) {
        d[o] = pal[k][0]; d[o + 1] = pal[k][1]; d[o + 2] = pal[k][2];
        break;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  for (let a = 0; a < 16; a++) tex.add(String(a), 0, a * CELL, 0, CELL, CELL);
  tex.refresh();
  return key;
}

/** Heading (radians, 0 = right, clockwise) -> one of the 16 pre-rotated frames. */
export const headingFrame = (h) => String(((Math.round(h / (Math.PI / 8)) % 16) + 16) % 16);

// Scenery that fits each theme (atlas frame names) and how densely to scatter it.
const range = (p, a, b) => Array.from({ length: b - a + 1 }, (_, i) => `${p}${a + i}`).filter((n) => ATLAS[n]);
const TREES = range('t:', 0, 4);
const DECO = range('d:', 0, 20);
const PARKED = Object.keys(ATLAS).filter((n) => n.startsWith('p:'));
export const CATALOG = {
  sizes: Object.fromEntries(Object.entries(ATLAS).map(([k, v]) => [k, [v[2], v[3]]])),
  downtown: [
    { frames: [...range('b:C', 11, 26), ...range('b:R', 102, 107), ...range('b:R', 71, 81)], every: 900, minD: 40 },
    { frames: [...range('b:C', 6, 10), 'b:BusStopD', 'b:BusStopU', 'b:GasStation1'], every: 1600, minD: 34 },
    { frames: PARKED, every: 2200, minD: 30, maxD: 70 },
    { frames: TREES, every: 2600, minD: 30 },
  ],
  harbor: [
    { frames: [...range('b:I', 1, 9), 'b:TankReservoir', 'b:WaterTower', 'b:I12', 'b:I11'], every: 1400, minD: 40 },
    { frames: [...range('b:I', 13, 20), 'b:WaterPumping'], every: 2400, minD: 32 },
    { frames: PARKED.filter((n) => n.includes('Big')), every: 2400, minD: 30, maxD: 80 },
  ],
  park: [
    { frames: ['b:Library', 'b:Kindergarden', ...range('b:R', 1, 10)], every: 9000, minD: 50 },
    { frames: TREES, every: 260, minD: 30 },
    { frames: DECO, every: 500, minD: 26 },
  ],
  highway: [
    { frames: ['b:WindTurbine', 'b:SolarPowerPlant', 'b:GasStation1', 'b:GasStation2', ...range('b:R', 26, 33)], every: 4200, minD: 46 },
    { frames: TREES, every: 700, minD: 30 },
    { frames: DECO, every: 1400, minD: 26 },
  ],
};

let currentTrackKey = null;

/**
 * Bake the whole track (ground, road, scenery, lamps, lighting) into one canvas texture.
 * Only one track picture is kept in memory at a time.
 */
export function trackTexture(scene, race) {
  const id = race.def.id;
  const key = `track-${id}`;
  if (scene.textures.exists(key)) return key;
  if (currentTrackKey && scene.textures.exists(currentTrackKey)) scene.textures.remove(currentTrackKey);
  const t = race.t;
  const seed = [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const r = paintTrack(t, { theme: race.def.theme, mood: race.def.mood, seed });
  const tex = scene.textures.createCanvas(key, r.W, r.H);
  const ctx = tex.context;
  ctx.imageSmoothingEnabled = false;
  ctx.putImageData(new ImageData(r.data, r.W, r.H), 0, 0);
  const src = scene.textures.get(ATLAS_KEY).getSourceImage();
  const items = placeScenery(t, r.f, race.def.theme, CATALOG, seed);
  for (const it of items) {
    const [x, y, w, h] = ATLAS[it.name];
    ctx.drawImage(src, x, y, w, h, it.x, it.y, w, h);
  }
  const lamps = race.def.mood === 'night' ? lampSpots(t) : [];
  if (race.def.mood !== 'day') {
    const img = ctx.getImageData(0, 0, r.W, r.H);
    light(img.data, r.W, r.H, race.def.mood, lamps, seed);
    ctx.putImageData(img, 0, 0);
  }
  // lamp posts on top of the lighting: a dark post with a bright head
  for (const l of lamps) {
    ctx.fillStyle = '#140c1c'; ctx.fillRect(Math.round(l.x) - 1, Math.round(l.y) - 1, 3, 3);
    ctx.fillStyle = '#f4ea82'; ctx.fillRect(Math.round(l.x), Math.round(l.y), 1, 1);
  }
  tex.refresh();
  currentTrackKey = key;
  return key;
}

/** A soft cone of headlight for night races (drawn additively in front of each car). */
export function headlightTexture(scene) {
  const key = 'headlight';
  if (scene.textures.exists(key)) return key;
  const W = 44; const H = 30;
  const tex = scene.textures.createCanvas(key, W, H);
  const ctx = tex.context;
  for (let x = 0; x < W; x++) {
    const half = 3 + x * 0.32;
    for (let y = 0; y < H; y++) {
      const dy = Math.abs(y - H / 2);
      if (dy > half) continue;
      const a = (1 - x / W) * (dy > half - 2 ? 0.5 : 1);
      const step = a > 0.66 ? 0.5 : a > 0.33 ? 0.32 : 0.16;
      ctx.fillStyle = `rgba(255,240,190,${step})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  tex.refresh();
  return key;
}
