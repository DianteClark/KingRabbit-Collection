// Pangea art: Aleksandr Makarov's Pangea packs. Only the files imported here are bundled.
// The land and feature tilesets are "dual grid" sheets: each 16x16 piece sits on the corner
// between four map cells, and the piece to use is picked from which of those cells are land.
import additional from '../../shared/assets/pangea-strategy/Pangea-v.1.01/Tileset/AdditionalTileset.png?url';
import features from '../../shared/assets/pangea-strategy/Pangea-v.1.01/Tileset/TreesHillsMountaines.png?url';
import water from '../../shared/assets/pangea-strategy/Pangea-v.1.01/Tileset/DefaultTileset.png?url';
import fog from '../../shared/assets/pangea-strategy/Pangea-v.1.01/Tileset/FogOfWar.png?url';
import towns from '../../shared/assets/pangea-strategy/Pangea-v.1.01/Objects/Towns.png?url';
import resources from '../../shared/assets/pangea-strategy/Pangea-v.1.01/Objects/Resources.png?url';
import upgrades from '../../shared/assets/pangea-strategy/Pangea-v.1.01/Objects/TerrainUpgrade.png?url';
import flags from '../../shared/assets/pangea-strategy/Pangea-v.1.01/Objects/FlagsAndBorder.png?url';
import avatars from '../../shared/assets/pangea-strategy/Pangea-v.1.01/Leaders/Avatars.png?url';
import wondersSheet from '../../shared/assets/pangea-strategy/Pangea-v.1.01/Objects/Wonders.png?url';
import { UNITS } from './logic/data.js';

const UNIT_URLS = import.meta.glob('../../shared/assets/pangea-strategy/Pangea-v.1.01/Units/{Settlers,Caravan,Militia,Phalanx,Legion,Chariot,Catapult,Knight,Musketeer,Cannon,Cavalry,Riflemen,Artillery,Armor,Mech}.png', { eager: true, query: '?url', import: 'default' });
const ICON_URLS = import.meta.glob('../../shared/assets/pangea-strategy/Pangea-v.1.01/Objects/{Buildings,Wonders,TerrainUpgrade,Resources}/*.png', { eager: true, query: '?url', import: 'default' });
const TECH_URLS = import.meta.glob('../../shared/assets/pangea-strategy/Pangea-v.1.01/Technology/*.png', { eager: true, query: '?url', import: 'default' });
const UNIT_ICON_URLS = import.meta.glob('../../shared/assets/pangea-strategy/Pangea-v.1.01/Units/*Icon.png', { eager: true, query: '?url', import: 'default' });

const base = (p) => p.split('/').pop().replace('.png', '');
const byName = (glob) => Object.fromEntries(Object.entries(glob).map(([k, v]) => [base(k), v]));
const UNIT_SHEETS = byName(UNIT_URLS);
export const ICONS = byName(ICON_URLS);
export const TECH_ICONS = byName(TECH_URLS);
export const UNIT_ICONS = byName(UNIT_ICON_URLS);
export const AVATARS_URL = avatars;

export const SHEETS = { additional, features, water, fog, towns, resources, upgrades, flags, avatars, wondersSheet };
export function loadArt(scene) {
  for (const [k, url] of Object.entries(SHEETS)) scene.load.image(k, url);
  for (const [k, url] of Object.entries(UNIT_SHEETS)) scene.load.image(`u_${k}`, url);
}

/** Make sure the rectangle exists as a frame; returns [key, frameName]. */
export function frame(scene, key, x, y, w = 16, h = 16) {
  const name = `${x}_${y}_${w}_${h}`;
  const tex = scene.textures.get(key);
  if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
  return [key, name];
}

// Rows of the land sheet (AdditionalTileset) and the feature sheet (TreesHillsMountaines).
export const LAND_ROW = { desert: 1, plains: 2, grass: 4, snow: 5, tundra: 6 };
const HILL_ROW = { desert: 5, plains: 6, grass: 8, snow: 9, tundra: 10 };
const FOREST_ROW = { grass: 0, plains: 0, tundra: 1, snow: 1, desert: 3 };
export const RES_COL = { coal: 0, fish: 1, fur: 2, gem: 3, gold: 4, horses: 5, oasis: 6, oil: 7, seals: 8, iron: 9 };
export const IMP_COL = { farm: 1, mine: 2 };
export const ERA_TOWN = (era) => Math.min(3, era);

/** Unit sprite frame: row 0 idle, 1 walk, 2 hit, 3 attack, 4 death; 4 frames each. */
export function unitFrame(scene, type, row = 0, k = 0) {
  return frame(scene, `u_${UNITS[type].art}`, (k % 4) * 16, row * 16);
}

/**
 * Draw the whole terrain (water, land, features, improvements, resources) into a render texture
 * of w*16 x h*16 pixels. view(i) says whether a tile has been seen (unseen tiles still get drawn;
 * fog goes on top).
 */
export function drawTerrain(scene, rt, s) {
  const { w, h } = s;
  rt.clear();
  rt.beginDraw();
  const put = (key, fx, fy, px, py) => { const [k, f] = frame(scene, key, fx, fy); rt.batchDrawFrame(k, f, px, py); };
  // Water: plain water everywhere, waves sprinkled on the open ocean.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = s.tiles[y * w + x];
      put('water', 48, 16, x * 16, y * 16);
      if (t.t === 'ocean' && ((x * 7 + y * 13) % 5 === 0)) put('water', 304, 16, x * 16, y * 16);
    }
  }
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? s.tiles[y * w + x] : null);
  const dual = (key, row, test) => {
    for (let cy = 0; cy <= h; cy++) {
      for (let cx = 0; cx <= w; cx++) {
        const m = (test(at(cx - 1, cy - 1)) ? 1 : 0) | (test(at(cx, cy - 1)) ? 2 : 0) | (test(at(cx - 1, cy)) ? 4 : 0) | (test(at(cx, cy)) ? 8 : 0);
        if (!m) continue;
        put(key, (16 - m) * 16, row * 16, cx * 16 - 8, cy * 16 - 8);
      }
    }
  };
  const land = (t) => t && t.t !== 'ocean' && t.t !== 'coast';
  dual('additional', LAND_ROW.plains, land);
  for (const k of ['grass', 'desert', 'tundra', 'snow']) dual('additional', LAND_ROW[k], (t) => t && t.t === k);
  // Little grass tufts and stones so big fields don't look flat.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = s.tiles[y * w + x];
      if (!land(t) || t.f) continue;
      const n = (x * 31 + y * 17) % 11;
      if (t.t === 'grass' && n < 3) put('additional', 16 + n * 16, 0, x * 16, y * 16);
      if ((t.t === 'desert' || t.t === 'plains') && n === 4) put('additional', 80 + (x % 2) * 16, 0, x * 16, y * 16);
    }
  }
  // Features: forests per climate, hills per climate, mountains.
  for (const k of Object.keys(FOREST_ROW)) dual('features', FOREST_ROW[k], (t) => t && t.f === 'forest' && t.t === k);
  for (const k of Object.keys(HILL_ROW)) dual('features', HILL_ROW[k], (t) => t && t.f === 'hills' && t.t === k);
  dual('features', 4, (t) => t && t.f === 'mountain');
  // Lone mountains get a proper peak.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (s.tiles[y * w + x].f === 'mountain') put('features', 272, 64, x * 16, y * 16);
  rt.endDraw();
  // Improvements (farms half see-through so fields don't drown the map) and resources.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = s.tiles[y * w + x];
      if (t.imp && IMP_COL[t.imp] != null) { const [k, f] = frame(scene, 'upgrades', IMP_COL[t.imp] * 16, 16); rt.stamp(k, f, x * 16 + 8, y * 16 + 8, { alpha: t.imp === 'farm' ? 0.5 : 1 }); }
      if (t.r) { const [k, f] = frame(scene, 'resources', RES_COL[t.r] * 16, 16); rt.stamp(k, f, x * 16 + 8, y * 16 + 8); }
    }
  }
}

/**
 * Fog: clouds over unexplored tiles (soft edges toward explored land) and a dark veil over tiles
 * that were seen before but aren't watched right now.
 */
export function drawFog(scene, rt, s, explored, visible, veil) {
  const { w, h } = s;
  rt.clear();
  rt.beginDraw();
  const ex = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? false : !!explored[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (explored[i]) continue;
      // Pick a piece of the big 3x3 cloud (x 0..48, y 64..112) by which sides face explored land.
      const col = ex(x - 1, y) ? 0 : ex(x + 1, y) ? 2 : 1;
      const row = ex(x, y - 1) ? 0 : ex(x, y + 1) ? 2 : 1;
      const [k, f] = frame(scene, 'fog', col * 16, 64 + row * 16);
      rt.batchDrawFrame(k, f, x * 16, y * 16);
    }
  }
  rt.endDraw();
  // The veil is drawn solid on its own texture, which is shown see-through (no seams between tiles).
  veil.clear();
  for (let y = 0; y < h; y++) {
    let run = -1;
    for (let x = 0; x <= w; x++) {
      const i = y * w + x;
      const on = x < w && explored[i] && !visible[i];
      if (on && run < 0) run = x;
      if (!on && run >= 0) { veil.fill(0x0c0a1c, 1, run * 16, y * 16, (x - run) * 16, 16); run = -1; }
    }
  }
}
