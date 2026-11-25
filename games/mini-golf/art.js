// Art: Tiny Tile Town trees and decorations by Aleksandr Makarov, plus shapes drawn in the MAS palette.
import Phaser from 'phaser';
import { PALETTE, hex } from '../../shared/core/palette.js';
import trees from '../../shared/assets/modern-city/TinyTileTown-v.1.0/Tileset-n-Decorations/Trees.png?url';
import tiles from '../../shared/assets/modern-city/TinyTileTown-v.1.0/Tileset-n-Decorations/Tileset.png?url';

export const SHEETS = { trees, tiles };

export const FRAMES = {
  trees: { tree0: [16, 48, 16, 16], tree1: [16, 112, 16, 16], tree2: [16, 176, 16, 16], tree3: [16, 240, 16, 16], tree4: [16, 304, 16, 16] },
  tiles: Object.fromEntries([
    ['flowers', 3, 0], ['flowers2', 3, 1], ['logs', 4, 0], ['logs2', 4, 1], ['berries', 5, 0], ['berries2', 5, 1],
    ['shrub', 6, 0], ['shrub2', 6, 1], ['sapling', 7, 0], ['sapling2', 7, 1], ['rocks', 8, 0], ['rocks2', 8, 1], ['mix', 9, 0], ['mix2', 9, 1],
  ].map(([n, x, y]) => [n, [x * 16, y * 16, 16, 16]])),
};

// Extra shades that sit between the palette's colours.
export const SHADE = {
  feltDark: 0x5f7d46, feltLight: 0x77985a, sandDot: 0xd2b55a, ice: 0xc3c8ea, iceLine: 0xe8eafa,
  water: 0x3d5a8c, waterLine: 0x6f8fc4, lava: 0xc0502c, lavaLine: 0xf0a040, stone: 0x5e5468, stoneLine: 0x7a7088,
};

/** Look of each course. Colours are numbers for Phaser. */
export const THEMES = {
  meadow: {
    bg: 0x4a6a3a, bgDot: 0x557a42, felt: hex(PALETTE.leaf), feltStripe: SHADE.feltDark, rail: hex(PALETTE.orange), railDark: hex(PALETTE.wine),
    block: hex(PALETTE.orange), blockTop: 0xe89a58, water: SHADE.water, waterLine: SHADE.waterLine, sand: hex(PALETTE.sand), sandDot: SHADE.sandDot,
    decor: ['tree0', 'tree1', 'tree2', 'tree4', 'flowers', 'flowers2', 'shrub', 'berries', 'rocks', 'mix', 'sapling'], tint: null, waterName: 'water', sandName: 'sand',
    page: '#2f4527',
  },
  frost: {
    bg: 0xe6e3ef, bgDot: 0xcfd0e6, felt: 0x5f8a6a, feltStripe: 0x557d60, rail: hex(PALETTE.lavender), railDark: hex(PALETTE.indigo),
    block: hex(PALETTE.lavender), blockTop: 0xb4b8e0, water: 0x2f3f6e, waterLine: 0x5b6fa6, sand: hex(PALETTE.cream), sandDot: 0xd8d6e6,
    decor: ['tree0', 'tree3', 'tree0', 'rocks', 'rocks2', 'shrub2'], tint: 0xdfe4ff, waterName: 'icy water', sandName: 'snow',
    page: '#2b2a40',
  },
  castle: {
    bg: 0x2a2433, bgDot: 0x342c40, felt: 0x587a44, feltStripe: 0x4f6e3d, rail: SHADE.stone, railDark: hex(PALETTE.ink),
    block: SHADE.stone, blockTop: SHADE.stoneLine, water: SHADE.lava, waterLine: SHADE.lavaLine, sand: hex(PALETTE.sand), sandDot: SHADE.sandDot,
    decor: ['rocks', 'rocks2', 'tree4', 'logs', 'mix2'], tint: 0x9a90b8, waterName: 'lava', sandName: 'sand', torches: true,
    page: '#1c1618',
  },
};

export const BALL_COLORS = [PALETTE.cream, PALETTE.gold, '#e58fd0', '#9fd8ff'];

/** Make the small textures drawn in code: balls (one per player colour), star, lock, hand. */
export function makeTextures(scene) {
  BALL_COLORS.forEach((c, i) => {
    const key = `ball${i}`;
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ add: false });
    // 12x12 pixel ball: ink outline, colour, shade, highlight
    const rows = ['....xxxx....', '..xxccccxx..', '.xcchhcccsx.', '.xchhcccccx.', 'xccccccccccx', 'xccccccccccx', 'xcccccccccsx', 'xccccccccssx', '.xccccccssx.', '.xsccccsssx.', '..xxsssxx...', '....xxxx....'];
    const col = { x: hex(PALETTE.ink), c: hex(c), h: 0xffffff, s: Phaser.Display.Color.ValueToColor(hex(c)).darken(25).color };
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (col[ch] != null) g.fillStyle(col[ch]).fillRect(x, y, 1, 1); }));
    g.generateTexture(key, 12, 12);
    g.destroy();
  });
  if (!scene.textures.exists('star')) {
    const g = scene.make.graphics({ add: false });
    const star = (r1, r2) => Array.from({ length: 10 }, (_, k) => {
      const a = -Math.PI / 2 + (k * Math.PI) / 5; const r = k % 2 ? r2 : r1;
      return new Phaser.Math.Vector2(12 + Math.cos(a) * r, 12 + Math.sin(a) * r);
    });
    g.fillStyle(hex(PALETTE.ink)).fillPoints(star(12, 5.6), true);
    g.fillStyle(0xffffff).fillPoints(star(9, 4), true);
    g.generateTexture('star', 24, 24);
    g.destroy();
  }
  if (!scene.textures.exists('lock')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(hex(PALETTE.ink)).fillRect(4, 0, 12, 4).fillRect(2, 2, 4, 8).fillRect(14, 2, 4, 8).fillRect(0, 8, 20, 14);
    g.fillStyle(0xffffff).fillRect(2, 10, 16, 10);
    g.fillStyle(hex(PALETTE.ink)).fillRect(8, 13, 4, 5);
    g.generateTexture('lock', 20, 22);
    g.destroy();
  }
  if (!scene.textures.exists('flag')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(hex(PALETTE.ink)).fillRect(0, 0, 3, 30);
    g.fillStyle(hex(PALETTE.cream)).fillRect(1, 0, 1, 30);
    g.generateTexture('pole', 3, 30);
    g.destroy();
  }
}

export function addSheetFrames(scene) {
  for (const [key, frames] of Object.entries(FRAMES)) {
    const tex = scene.textures.get(key);
    for (const [name, [x, y, w, h]] of Object.entries(frames)) if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
  }
}

/** Which sheet a decoration frame lives on. */
export const decorSheet = (name) => (name.startsWith('tree') ? 'trees' : 'tiles');
