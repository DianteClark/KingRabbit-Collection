import Phaser from 'phaser';
import { URLS, LAB, ADV, FLASK } from '../art.js';
import { addFrames } from '../../../shared/core/ui.js';
import { POTIONS, EL_INFO, ELEMENTS } from '../logic/data.js';
import { PALETTE } from '../../../shared/core/palette.js';
import { IMG } from './common.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const bar = this.add.rectangle(80, 320, 0, 8, 0xe3d245).setOrigin(0, 0.5);
    this.load.on('progress', (v) => { bar.width = 200 * v; });
    this.load.image('lab', URLS.labTiles);
    this.load.image('adv', URLS.advTiles);
    this.load.image('items', URLS.items);
    this.load.image('labHouse', URLS.lab);
    this.load.image('vein', URLS.vein);
    this.load.image('shadow', URLS.shadow);
    this.load.spritesheet('ing', URLS.ingredients, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('npcs', URLS.npcs, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('smoke', URLS.smoke, { frameWidth: 32, frameHeight: 32 });
    this.load.image('alchemist', URLS.alchemist);
    this.load.image('apprentice', URLS.apprentice);
    this.load.image('gremlin', URLS.gremlin);
    this.load.image('golem', URLS.golem);
  }

  create() {
    addFrames(this, 'lab', LAB);
    addFrames(this, 'adv', ADV);
    const A = this.anims;
    // Alchemist sheets: 32px cells under a 16px header; rows down, left, up, right; groups of 4 frames.
    for (const key of ['alchemist', 'apprentice', 'gremlin']) cutSheet(this, key, 32, 16, key === 'alchemist' ? 28 : key === 'apprentice' ? 24 : 20);
    cutSheet(this, 'golem', 48, 32, 20);
    const strip = (key, sheet, row, from, rate, repeat = -1) => A.create({ key, frames: [0, 1, 2, 3].map((i) => ({ key: sheet, frame: `${row}_${from + i}` })), frameRate: rate, repeat });
    strip('alch-idle', 'alchemist', 0, 0, 4);
    strip('alch-brew', 'alchemist', 0, 8, 8);
    strip('appr-idle', 'apprentice', 0, 0, 4);
    strip('appr-magic', 'apprentice', 0, 8, 8);
    for (const g of ['gremlin', 'golem']) {
      strip(`${g}-idle`, g, 0, 0, 5);
      strip(`${g}-hit`, g, 0, 12, 12, 0);
      strip(`${g}-flee`, g, 1, 4, 10);
    }
    for (let r = 0; r < 6; r++) A.create({ key: `npc${r}`, frames: A.generateFrameNumbers('npcs', { start: r * 4, end: r * 4 + 3 }), frameRate: 4, repeat: -1 });
    A.create({ key: 'smoke', frames: A.generateFrameNumbers('smoke', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
    makePotions(this);
    makeBits(this);
    this.scene.start('Title');
  }
}

function cutSheet(scene, key, cell, header, cols) {
  const tex = scene.textures.get(key);
  for (let row = 0; row < 4; row++) for (let c = 0; c < cols; c++) tex.add(`${row}_${c}`, 0, c * cell, header + row * cell, cell, cell);
}

const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (c, t, k) => c.map((v, i) => Math.round(v + (t[i] - v) * k));

/** Recolour the flask from the Adventure Pack items for every potion; keep data URLs for the HTML panels. */
function makePotions(scene) {
  const src = scene.textures.get('items').getSourceImage();
  const base = document.createElement('canvas');
  base.width = 16; base.height = 16;
  const bctx = base.getContext('2d');
  bctx.drawImage(src, FLASK[0], FLASK[1], 16, 16, 0, 0, 16, 16);
  const data = bctx.getImageData(0, 0, 16, 16);
  // the red flask's five shades, darkest to brightest
  const shades = [[115, 23, 45], [180, 32, 42], [223, 62, 35], [250, 106, 10], [249, 163, 27]];
  for (const [id, p] of Object.entries(POTIONS)) {
    const c = rgb(p.color);
    const pal = [mixc(c, [20, 10, 30], 0.45), c, mixc(c, [255, 255, 255], 0.25), mixc(c, [255, 255, 255], 0.5), mixc(c, [255, 255, 255], 0.75)];
    const t = scene.textures.createCanvas(`potion_${id}`, 16, 16);
    const ctx = t.getContext();
    const img = ctx.createImageData(16, 16);
    for (let i = 0; i < data.data.length; i += 4) {
      const px = [data.data[i], data.data[i + 1], data.data[i + 2]];
      const k = shades.findIndex((s) => s[0] === px[0] && s[1] === px[1] && s[2] === px[2]);
      const out = k >= 0 ? pal[k] : px;
      img.data[i] = out[0]; img.data[i + 1] = out[1]; img.data[i + 2] = out[2]; img.data[i + 3] = data.data[i + 3];
    }
    // legendary potions get a little sparkle
    if (p.legendary) { for (const [x, y] of [[12, 2], [13, 3], [12, 4], [11, 3]]) { const j = (y * 16 + x) * 4; img.data.set([255, 255, 220, 255], j); } }
    ctx.putImageData(img, 0, 0);
    t.refresh();
    IMG.potion[id] = t.getSourceImage().toDataURL();
  }
  // the HTML panels use the bundled sheet URL (Phaser's own blob URLs are revoked after loading)
  IMG.ingSheet = URLS.ingredients;
}

/** Tiny pixel bits: stars, element dots, a lock. */
function makeBits(scene) {
  const px = (key, rows, colors) => {
    const t = scene.textures.createCanvas(key, rows[0].length, rows.length);
    const c = t.getContext();
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { c.fillStyle = colors[ch]; c.fillRect(x, y, 1, 1); } }));
    t.refresh();
    return t;
  };
  const starRows = ['...k...', '..kyk..', 'kkkyykk', 'kyyyywk', '.kyyyk.', 'kyykyyk', 'kk...kk'];
  IMG.star = px('star', starRows, { k: PALETTE.ink, y: PALETTE.gold, w: '#fff6b0' }).getSourceImage().toDataURL();
  IMG.starOff = px('starOff', starRows, { k: PALETTE.ink, y: '#5a5070', w: '#6a6080' }).getSourceImage().toDataURL();
  for (const e of ELEMENTS) {
    IMG.el[e] = px(`dot_${e}`, ['kkkkk', 'kcccK', 'kcccK', 'kcccK', 'kKKKK'].map((r) => r), { k: PALETTE.ink, K: PALETTE.ink, c: EL_INFO[e].color }).getSourceImage().toDataURL();
  }
  px('lock', ['.kkk.', 'k...k', 'k...k', 'kkkkk', 'kgggk', 'kgkgk', 'kgggk', 'kkkkk'], { k: PALETTE.ink, g: PALETTE.gold });
  px('coin', ['.kkk.', 'kyywk', 'kyyyk', 'kyyyk', '.kkk.'], { k: PALETTE.ink, y: PALETTE.gold, w: '#fff6b0' });
  px('rep', ['.k.k.', 'krkrk', 'krrrk', '.krk.', '..k..'], { k: PALETTE.ink, r: '#d84868' });
  px('pip', ['kkk', 'kgk', 'kkk'], { k: PALETTE.ink, g: '#9fe070' });
  px('pipOff', ['kkk', 'k.k', 'kkk'], { k: PALETTE.ink });
  px('white', ['w'], { w: '#ffffff' });
}
