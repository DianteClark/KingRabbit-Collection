// Art from "Battle of the Sands" by Aleksandr Makarov (iknowkingrabbit), packed into one small atlas
// by tools/pack_atlas.py so the game loads a single 30 KB image.
import atlasUrl from './art/atlas.png?url';
import { ATLAS } from './art/atlas.js';

export { atlasUrl };
export const KEY = 'atlas';

/** Add every frame to the loaded atlas texture. */
export function addAtlasFrames(scene) {
  const tex = scene.textures.get(KEY);
  for (const [name, [x, y, w, h]] of Object.entries(ATLAS)) if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
}

export const has = (name) => !!ATLAS[name];

export function img(scene, x, y, name, scale = 2) {
  return scene.add.image(Math.round(x), Math.round(y), KEY, name).setScale(scale);
}

// Foot soldiers: 16 frames (idle 0-3, walk 4-7, attack 8-11, death 12-15), facing right.
const FOOT = new Set(['inf', 'hinf', 'scout']);
export const isFoot = (art) => FOOT.has(art);
const ANIM = { idle: 0, walk: 4, attack: 8, death: 12 };
export const footFrame = (art, team, anim, i) => `${art}_${team}_${ANIM[anim] + (i % 4)}`;
/** Vehicles: 8 facings (u, d, l, r, ul, ur, dl, dr). */
export const vehFrame = (art, team, dir) => `${art}_${team}_${dir}`;
/** Big vehicle frames are 24px; small ones 12px. */
export const BIG = new Set(['arty', 'drone', 'heavy', 'flak']);

/** Terrain tile on the tileset by its position there. */
export const tile = (x, y) => `t_${x}_${y}`;
export const TILE = {
  sand: [[24, 120], [24, 120], [24, 120], [24, 120], [24, 120], [24, 120], [24, 120], [40, 120], [24, 136], [40, 136]],
  sandDecal: [[8, 120], [8, 136]],
  dunesFill: [[24, 56], [40, 56], [40, 72], [24, 56]],
  dunesRing: [56, 56],
  mesaFill: [[24, 184], [40, 184], [24, 200], [40, 200]],
  mesaRing: [56, 184],
  waterRing: [96, 24],
  oasis: [[40, 24], [40, 24], [40, 40]],
  shrub: [72, 248],
  rocks: [[8, 248], [24, 248]],
};
