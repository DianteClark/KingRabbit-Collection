// Art for MegaBoy Run, all by Aleksandr Makarov (iknowkingrabbit): the MAS MegaBoy pack (hero and
// tiles), robots from MAS Robbox, little enemies from MAS Roguelike and MAS Space Roguelike, and
// two creatures from the MAS Darkness pack recoloured as fortress machines. Everything is cut,
// recoloured and outlined at load time in Boot; only the files imported here are bundled.
import tileset from '../../shared/assets/mas-mini-retro/MAS-MegaBoy/Tileset/Tileset.png?url';
import robot from '../../shared/assets/mas-mini-retro/MASRobbox-v.1.2/16x16/Character/Robot.png?url';
import spaceChars from '../../shared/assets/mas-mini-retro/MAS-Space-Roguelike-v.1.0/CharactersSpriteSheet.png?url';
import rogueEnemies from '../../shared/assets/mas-mini-retro/MAS-Roguelike-v.1.01/EnemySpriteSheet.png?url';
import creatures from '../../shared/assets/mas-mini-retro/MAS-Darkness-Pack-1.0/MonsterPack/Creatures.png?url';

const HERO = import.meta.glob('../../shared/assets/mas-mini-retro/MAS-MegaBoy/Hero/*.png', { eager: true, query: '?url', import: 'default' });

export const SHEETS = { tileset, robot, spaceChars, rogueEnemies, creatures };

// Hero frames in sheet order (one 24x24 cell each)
export const HERO_FRAMES = [
  'Idle-frame-1', 'Idle-frame-2', 'Idle-frame-3', 'Idle-frame-4', 'Standing',
  'Walk-frame-1', 'Walk-frame-2', 'Walk-frame-3', 'Walk-frame-4',
  'Jump', 'Falling',
  'Climbing-frame-1', 'Climbing-frame-2', 'Climbing-frame-3', 'Climbing-frame-4',
  'Damage-frame-1', 'Damage-frame-2', 'Damage-frame-3',
  'AttackStanding', 'AttackIdle-frame-1', 'AttackIdle-frame-2',
  'AttackWalk-frame-1', 'AttackWalk-frame-2', 'AttackWalk-frame-3', 'AttackWalk-frame-4',
  'AttackJump-frame-1', 'AttackJump-frame-2', 'AttackFalling-frame-1', 'AttackFalling-frame-2',
];
const F = (name) => HERO_FRAMES.indexOf(name);

/** [key, url] for every hero frame file. */
export function heroFiles() {
  const out = [];
  for (const [path, url] of Object.entries(HERO)) {
    const m = path.match(/\/([\w-]+)\.png$/);
    if (m && HERO_FRAMES.includes(m[1])) out.push([`hf-${m[1]}`, url]);
  }
  return out;
}

// name -> [frames, fps, repeat]
export const HERO_ANIMS = {
  idle: [[0, 1, 2, 3], 4, -1],
  run: [[5, 6, 7, 8], 10, -1],
  jump: [[F('Jump')], 1, 0],
  fall: [[F('Falling')], 1, 0],
  climb: [[11, 12, 13, 12], 7, -1],
  hurt: [[15, 16, 17], 12, 0],
  shoot: [[F('AttackStanding')], 1, 0],
  runShoot: [[21, 22, 23, 24], 10, -1],
  jumpShoot: [[F('AttackJump-frame-1')], 1, 0],
  fallShoot: [[F('AttackFalling-frame-1')], 1, 0],
};

// Hero colours (main red, light pink, dark shade) and their replacement per weapon.
const HERO_RED = [172, 50, 50]; const HERO_PINK = [217, 87, 99]; const HERO_DARK = [69, 40, 60];
const HERO_VISOR = [95, 205, 228];
export const WEAPON_PAL = {
  buster: null,
  ember: [[216, 128, 56], [240, 212, 114], [110, 50, 30]],
  ice: [[60, 110, 200], [120, 200, 240], [36, 38, 96]],
  thorn: [[80, 140, 60], [150, 210, 90], [36, 60, 40]],
  volt: [[200, 160, 40], [240, 228, 110], [96, 70, 30]],
  drill: [[140, 92, 60], [206, 156, 104], [70, 40, 32]],
  gale: [[138, 143, 196], [232, 236, 246], [56, 56, 88]],
};
// Bosses: body colours, visor colour and a crest drawn on the head
export const BOSS_PAL = {
  ember: { body: [[200, 90, 30], [250, 190, 70], [96, 36, 24]], visor: [255, 230, 120], crest: ['..o..', '.ooo.', '.oyo.', 'ooyoo'], colors: { o: '#d85020', y: '#f9e070' } },
  glacia: { body: [[90, 140, 220], [210, 236, 252], [40, 50, 110]], visor: [240, 250, 255], crest: ['c.c.c', 'c.c.c', 'ccccc'], colors: { c: '#c8ecfc' } },
  thorn: { body: [[60, 120, 50], [130, 200, 80], [30, 50, 30]], visor: [240, 200, 60], crest: ['...gg', '..gg.', 'gg.g.', '.ggg.'], colors: { g: '#6cbe50' } },
  volt: { body: [[60, 56, 90], [228, 210, 69], [28, 22, 40]], visor: [255, 240, 120], crest: ['y...y', 'yy.yy', '.yyy.'], colors: { y: '#f0e040' } },
  drill: { body: [[150, 100, 60], [210, 170, 110], [70, 44, 30]], visor: [255, 120, 80], crest: ['..w..', '..w..', '.www.', 'wwwww'], colors: { w: '#c8ccd8' } },
  gale: { body: [[150, 156, 176], [244, 246, 252], [70, 70, 96]], visor: [120, 220, 255], crest: ['wwwwwww', '...w...', '..www..'], colors: { w: '#f4f6fc' } },
};

// Little enemies: [sheet, x, y, w, h] frames. 'ink' sheets have a solid ink background that is
// keyed out and replaced by an outline (each frame gets a 1 px border).
export const ENEMY_FRAMES = {
  walker: { sheet: 'robot', frames: [[48, 48], [64, 48], [80, 48], [96, 48]], size: 16 },
  guard: { sheet: 'robot', frames: [[48, 112], [64, 112], [80, 112], [96, 112], [16, 112]], size: 16, tint: 'guard' },
  hardhat: { sheet: 'spaceChars', frames: [[8, 48], [16, 48], [24, 48], [32, 48], [40, 48]], size: 8, ink: true },
  hopper: { sheet: 'rogueEnemies', frames: [[8, 8], [16, 8], [24, 8], [32, 8]], size: 8, ink: true },
  bat: { sheet: 'rogueEnemies', frames: [[8, 40], [16, 40], [24, 40], [32, 40]], size: 8, ink: true },
  flyer: { sheet: 'spaceChars', frames: [[8, 160], [16, 160], [24, 160], [32, 160]], size: 8, ink: true },
  turret: { sheet: 'spaceChars', frames: [[8, 184], [16, 184], [24, 184], [32, 184]], size: 8, ink: true },
  crawler: { sheet: 'rogueEnemies', frames: [[8, 24], [16, 24], [24, 24], [32, 24]], size: 8, ink: true },
};

// Darkness pack creatures recoloured into steel and red for the fortress guardians.
export const BIG_FRAMES = { gate: [0, 160, 32, 32], engine: [96, 128, 48, 32] };
const DARK_MAP = {
  '243,228,210': [203, 219, 252], '227,191,143': [155, 173, 183], '185,132,143': [161, 61, 59],
  '124,89,152': [71, 65, 107], '59,65,120': [28, 22, 24],
};
const GUARD_MAP = {
  '117,113,97': [161, 61, 59], '133,149,161': [217, 87, 99], '78,74,78': [78, 40, 46],
};

// Stage themes: 24x24 nine-slice blocks in the tileset (riveted, plain, cracked) and colours.
export const THEMES = {
  orange: { block: 288, bg: '#2a1712', bg2: '#4e282e', deco: '#d88038', orn: 240 },
  blue: { block: 216, bg: '#121a30', bg2: '#47416b', deco: '#5fcde4', orn: 160 },
  green: { block: 144, bg: '#5a8fc4', bg2: '#a8d0e8', deco: '#6c8c50', sky: true },
  dark: { block: 0, bg: '#100c18', bg2: '#2a2440', deco: '#e3d245', darken: '#6a6290', orn: 160 },
  red: { block: 72, bg: '#1e0e10', bg2: '#4e282e', deco: '#a13d3b', orn: 0 },
  grey: { block: 0, bg: '#6aa0d8', bg2: '#d8ecf8', deco: '#f9f5ef', sky: true },
  fort: { block: 216, bg: '#140f1c', bg2: '#47416b', deco: '#a13d3b', darken: '#9a8fc8', orn: 0 },
};

// Pickup frames in the tileset: [x, y] 8x8, two animation frames each
export const PICKUP_FRAMES = {
  hpSmall: [[16, 428], [24, 428]],
  wpSmall: [[48, 428], [56, 428]],
  hpBig: [[20, 440], [20, 448]],
  wpBig: [[52, 440], [52, 448]],
};
// Weapon icons: the 24x24 chip tiles (lit) in the tileset bottom row
export const CHIP = { white: 0, red: 24, green: 48, blue: 72, dark: 96 };

// ------------------------------------------------------------------ canvas helpers

const key3 = (r, g, b) => `${r},${g},${b}`;

/** Replace exact colours in an ImageData. map: 'r,g,b' -> [r, g, b] */
export function recolor(data, map) {
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const to = map[key3(d[i], d[i + 1], d[i + 2])];
    if (to) { d[i] = to[0]; d[i + 1] = to[1]; d[i + 2] = to[2]; }
  }
  return data;
}

export function heroMap(pal, visor) {
  const m = {};
  if (pal) { m[key3(...HERO_RED)] = pal[0]; m[key3(...HERO_PINK)] = pal[1]; m[key3(...HERO_DARK)] = pal[2]; }
  if (visor) m[key3(...HERO_VISOR)] = visor;
  return m;
}

/** Key out a solid ink background touching the edges of a cell, then outline the sprite in ink. */
export function keyAndOutline(src, w, h) {
  const out = new Uint8ClampedArray((w + 2) * (h + 2) * 4);
  const W = w + 2;
  const isInk = (i) => src[i + 3] && src[i] < 12 && src[i + 1] < 12 && src[i + 2] < 12;
  const bg = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push([x, 0], [x, h - 1]); }
  for (let y = 0; y < h; y++) { stack.push([0, y], [w - 1, y]); }
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h || bg[y * w + x]) continue;
    const i = (y * w + x) * 4;
    if (src[i + 3] && !isInk(i)) continue;
    bg[y * w + x] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (bg[y * w + x]) continue;
      const i = (y * w + x) * 4; const o = ((y + 1) * W + x + 1) * 4;
      out[o] = src[i]; out[o + 1] = src[i + 1]; out[o + 2] = src[i + 2]; out[o + 3] = 255;
    }
  }
  outline(out, W, h + 2);
  return out;
}

/** Draw a 1 px ink outline around every opaque area of an RGBA buffer (in place). */
export function outline(buf, W, H) {
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && buf[(y * W + x) * 4 + 3] > 0;
  const add = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (solid(x, y)) continue;
      if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) add.push((y * W + x) * 4);
    }
  }
  for (const o of add) { buf[o] = 4; buf[o + 1] = 3; buf[o + 2] = 3; buf[o + 3] = 255; }
}

export { DARK_MAP, GUARD_MAP };
