// Art from "Battle of the Sands" by Aleksandr Makarov (iknowkingrabbit), and the rectangles we cut from it.
// A frame "ref" is [sheetKey, x, y, w, h]. Everything is drawn at 2x.
import tiles from '../../shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/Tileset/Tilemap.png?url';
import bBlue from '../../shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/Buildings/BlueTeamBuildings.png?url';
import bRed from '../../shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/Buildings/RedTeamBuildings.png?url';
import infBlue from '../../shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/Units/Sprites/BlueInfantry8x8.png?url';
import infRed from '../../shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/Units/Sprites/RedInfantry8x8.png?url';
import hinfBlue from '../../shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/Units/Sprites/BlueHighInfantry8x8.png?url';
import hinfRed from '../../shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/Units/Sprites/RedHighInfantry8x8.png?url';
import scoutBlue from '../../shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/Units/Sprites/BlueScout8x8.png?url';
import scoutRed from '../../shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/Units/Sprites/RedScout8x8.png?url';
import vehBlue from '../../shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/Units/Sprites/BlueVehicle-v.1.1.png?url';
import vehRed from '../../shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/Units/Sprites/RedVehicle-v.1.1.png?url';
import fxBoom from '../../shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/Effects/ExplosiveEffect.png?url';
import fxShot from '../../shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/Effects/ShootingEffect.png?url';
import fxDeath from '../../shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/Effects/SoldierDeathEffect.png?url';
import ui from '../../shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/UI/UI.png?url';

export const SHEETS = {
  tiles, bBlue, bRed, infBlue, infRed, hinfBlue, hinfRed, scoutBlue, scoutRed, vehBlue, vehRed, fxBoom, fxShot, fxDeath, ui,
};
export const TEAM = ['Blue', 'Red'];

/** Make sure the rectangle exists as a frame on its sheet; returns [textureKey, frameName]. */
export function frame(scene, ref) {
  const [key, x, y, w, h] = ref;
  const name = `${x}_${y}_${w}_${h}`;
  const tex = scene.textures.get(key);
  if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
  return [key, name];
}

export function sprite(scene, x, y, ref, scale = 2) {
  const [k, f] = frame(scene, ref);
  return scene.add.image(Math.round(x), Math.round(y), k, f).setScale(scale);
}

/** Point an existing image at another frame ref. */
export function setRef(scene, img, ref) {
  const [k, f] = frame(scene, ref);
  img.setTexture(k, f);
  return img;
}

// ---------- Units ----------
// Foot soldiers: 16 frames of 12x12 in one row at y = 12 (idle 0-3, walk 4-7, attack 8-11, death 12-15), facing right.
const FOOT = { inf: 'inf', hinf: 'hinf', scout: 'scout' };
const FOOT_ANIM = { idle: 0, walk: 4, attack: 8, death: 12 };
// Vehicles: each type is a 3x3 block of facings (the middle is empty).
// Small ones are 12x12 frames at (36 + 24c, 12 + 24r); big ones 24x24 at (12 + 32c, 232 + 32r).
const VEH = {
  recon: { big: false, c: 0, r: 3 },
  tank: { big: false, c: 3, r: 0 },
  arty: { big: true, c: 0, r: 0 },
  drone: { big: true, c: 3, r: 0 },
  heavy: { big: true, c: 0, r: 3 },
  flak: { big: true, c: 3, r: 3 },
};
const FACING = { up: [1, 0], down: [1, 2], left: [0, 1], right: [2, 1] };

export const isFoot = (art) => !!FOOT[art];

/** Frame for a unit art key, side, facing and (for foot soldiers) animation + frame index. */
export function unitRef(art, side, facing = 'right', anim = 'idle', i = 0) {
  if (FOOT[art]) return [`${FOOT[art]}${TEAM[side]}`, 12 * (FOOT_ANIM[anim] + (i % 4)), 12, 12, 12];
  const v = VEH[art];
  const [dc, dr] = FACING[facing] || FACING.right;
  const c = v.c + dc; const r = v.r + dr;
  return v.big ? [`veh${TEAM[side]}`, 12 + 32 * c, 232 + 32 * r, 24, 24] : [`veh${TEAM[side]}`, 36 + 24 * c, 12 + 24 * r, 12, 12];
}

// ---------- Buildings ----------
// Team sheets: small 16x16 at x = 8 + 24i, y = 24; large 24x24 at x = 8 + 32i, y = 48.
const SMALL = (i) => [8 + 24 * i, 24, 16, 16];
const LARGE = (i) => [8 + 32 * i, 48, 24, 24];
export const BUILDING = { hq: LARGE(0), factory: LARGE(2), city: SMALL(3) };
/** owner -1 uses the grey copy made in Boot. */
export function buildingRef(kind, owner) {
  const key = owner === 0 ? 'bBlue' : owner === 1 ? 'bRed' : 'bNeutral';
  return [key, ...BUILDING[kind]];
}

// ---------- Effects ----------
export const BOOM = (i) => ['fxBoom', 12 * i, 0, 12, 12];
export const SHOT = (i) => ['fxShot', 8 * i, 0, 8, 8];
export const DEATH = (i) => ['fxDeath', 8 * i, 0, 8, 8];
export const CURSOR = { tl: ['ui', 0, 16, 8, 8], tr: ['ui', 8, 16, 8, 8], bl: ['ui', 0, 24, 8, 8], br: ['ui', 8, 24, 8, 8] };

// ---------- Terrain (8x8 tiles, 2x2 per map cell) ----------
export const TILE = {
  sand: [[24, 120], [24, 120], [24, 120], [24, 120], [24, 120], [24, 120], [24, 120], [40, 120], [24, 136], [40, 136]],
  sandDecal: [[8, 120], [8, 136]],
  dunesFill: [[24, 56], [40, 56], [40, 72], [24, 56]],
  dunesRing: [56, 56],
  mesaFill: [[24, 184], [40, 184], [24, 200], [40, 200]],
  mesaRing: [56, 184],
  waterRing: [96, 24],
  waterFill: [[104, 32]],
  oasis: [[40, 24], [40, 24], [40, 40]],
  shrub: [72, 248],
  rocks: [[8, 248], [24, 248]],
};

/** Make a greyed-out copy of the red buildings for neutral ones. */
export function makeNeutralSheet(scene) {
  if (scene.textures.exists('bNeutral')) return;
  const src = scene.textures.get('bRed').getSourceImage();
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]; const gg = d[i + 1]; const b = d[i + 2];
    if (r > gg + 25 && r > b + 25) {
      const v = (r + gg + b) / 3;
      d[i] = Math.min(255, v * 1.25 + 30); d[i + 1] = Math.min(255, v * 1.15 + 28); d[i + 2] = Math.min(255, v * 0.95 + 20);
    }
  }
  g.putImageData(img, 0, 0);
  scene.textures.addCanvas('bNeutral', c);
}
