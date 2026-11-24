// Art from "MAS Robbox" v1.2 by Aleksandr Makarov (iknowkingrabbit), the 16x16 set, drawn at 2x.
// A frame ref is [sheetKey, x, y, w, h]. Command icons are tiny pixel bitmaps drawn here.
import robot from '../../shared/assets/mas-mini-retro/MASRobbox-v.1.2/16x16/Character/Robot.png?url';
import items from '../../shared/assets/mas-mini-retro/MASRobbox-v.1.2/16x16/Items/Items.png?url';
import floor from '../../shared/assets/mas-mini-retro/MASRobbox-v.1.2/16x16/Tileset/Floor.png?url';
import lab from '../../shared/assets/mas-mini-retro/MASRobbox-v.1.2/16x16/Tileset/Laboratory.png?url';
import conv from '../../shared/assets/mas-mini-retro/MASRobbox-v.1.2/16x16/Tileset/Conveyor.png?url';

export const SHEETS = { robot, items, floor, lab, conv };

const t16 = (key, x, y) => [key, x, y, 16, 16];
export const ART = {
  floor: t16('floor', 80, 16),
  floorBlue: t16('floor', 48, 16),
  floorOrange: t16('floor', 304, 16),
  floorGreen: t16('floor', 144, 16),
  floorDark: t16('floor', 112, 16),
  pad: t16('floor', 272, 16),
  hazard: t16('floor', 208, 16),
  wall: t16('lab', 112, 48),
  block: t16('lab', 112, 16),
  gate: t16('lab', 80, 16),
  gateOpen: t16('lab', 16, 16),
  tele: t16('lab', 112, 80),
  crate: t16('items', 16, 16),
  lamp: t16('items', 112, 16),
  battery: t16('items', 80, 16),
  gear: (k) => t16('items', 176 + 16 * (k % 4), 16),
};

// Conveyor rows in the sheet: down, up, right, left. Our directions are N E S W.
const CONV_ROW = [1, 2, 0, 3];
export const convRef = (dir, k) => t16('conv', 16 + 32 * (k % 4), 16 + 32 * CONV_ROW[dir]);

// Robot rows: facing S, W, N, E. Idle at x 16, walk at 48 + 16k, push at 128 + 16k.
const ROBOT_ROW = { 0: 80, 1: 112, 2: 16, 3: 48 };
export function robotRef(dir, kind = 'idle', k = 0) {
  const y = ROBOT_ROW[dir];
  if (kind === 'walk') return t16('robot', 48 + 16 * (k % 4), y);
  if (kind === 'push') return t16('robot', 128 + 16 * (k % 4), y);
  return t16('robot', 16, y);
}

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

export function setRef(scene, img, ref) {
  const [k, f] = frame(scene, ref);
  img.setTexture(k, f);
  return img;
}

// ---------------------------------------------------------------- command icons (12x12 bitmaps)

const ICONS = {
  F: [
    '.....##.....',
    '....####....',
    '...######...',
    '..########..',
    '.####.#####.',
    '.###.##..##.',
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '............',
  ],
  L: [
    '............',
    '...#........',
    '..##........',
    '.#########..',
    '##########..',
    '.#########..',
    '..##....##..',
    '...#....##..',
    '........##..',
    '........##..',
    '........##..',
    '............',
  ],
  J: [
    '............',
    '...######...',
    '..########..',
    '.###....###.',
    '.##......##.',
    '.##....#####',
    '.##.....###.',
    '.##......#..',
    '.##.........',
    '.##.........',
    '############',
    '############',
  ],
  A: [
    '......####..',
    '.....####...',
    '....####....',
    '...####.....',
    '..#########.',
    '.#########..',
    '.....####...',
    '....####....',
    '...####.....',
    '..###.......',
    '..##........',
    '.#..........',
  ],
  brush: [
    '.........###',
    '........####',
    '.......####.',
    '......####..',
    '.....####...',
    '....####....',
    '...###......',
    '..####......',
    '.#####......',
    '.####.......',
    '.###........',
    '##..........',
  ],
  star: [
    '.....##.....',
    '.....##.....',
    '....####....',
    '############',
    '.##########.',
    '..########..',
    '...######...',
    '...######...',
    '..###..###..',
    '..##....##..',
    '.##......##.',
    '............',
  ],
  lock: [
    '....####....',
    '...##..##...',
    '..##....##..',
    '..##....##..',
    '.##########.',
    '.##########.',
    '.####..####.',
    '.####..####.',
    '.#####.####.',
    '.##########.',
    '.##########.',
    '............',
  ],
};
ICONS.R = ICONS.L.map((row) => [...row].reverse().join(''));

/** Build the 'icons' texture: every icon in cream, plus outline-only star. Frame names are the keys. */
export function makeIcons(scene) {
  if (scene.textures.exists('icons')) return;
  const names = Object.keys(ICONS);
  const S = 2; // pixel size
  const size = 12 * S + 4;
  const tex = scene.textures.createCanvas('icons', size * names.length, size);
  const ctx = tex.getContext();
  names.forEach((n, i) => {
    const rows = ICONS[n];
    // Dark outline first, then the cream pixels, so icons read on any cell colour.
    for (const [col, off] of [['#040303', 1], ['#f9f5ef', 0]]) {
      ctx.fillStyle = col;
      for (let y = 0; y < 12; y++) {
        for (let x = 0; x < 12; x++) {
          if (rows[y][x] !== '#') continue;
          if (off) {
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.fillRect(i * size + 2 + x * S + dx, 2 + y * S + dy, S, S);
          } else ctx.fillRect(i * size + 2 + x * S, 2 + y * S, S, S);
        }
      }
    }
    tex.add(n, 0, i * size, 0, size, size);
  });
  tex.refresh();
}

export const iconFrame = (name) => name;
