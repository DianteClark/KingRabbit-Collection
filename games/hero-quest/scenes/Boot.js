import Phaser from 'phaser';
import { SHEETS, charStrips, slimeStrips, ROW_OF, GROUP, NPC_ROW } from '../art.js';
import { PALETTE } from '../../../shared/core/palette.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const w = this.scale.width;
    const bar = this.add.rectangle(w / 2 - 100, 320, 0, 8, 0xe3d245).setOrigin(0, 0.5);
    this.load.on('progress', (v) => { bar.width = 200 * v; });
    this.load.image('tileset', SHEETS.tileset);
    this.load.image('labTiles', SHEETS.labTiles);
    this.load.spritesheet('items', SHEETS.items, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('npcs', SHEETS.npcs, { frameWidth: 16, frameHeight: 16 });
    this.load.image('gremlin', SHEETS.gremlin);
    this.load.image('golem', SHEETS.golem);
    this.load.spritesheet('smoke', SHEETS.smoke, { frameWidth: 32, frameHeight: 32 });
    this.load.image('shadow', SHEETS.shadow);
    this.load.spritesheet('U-ShowItem', SHEETS.showItem, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('A-Defeat', SHEETS.defeat, { frameWidth: 32, frameHeight: 32 });
    for (const [key, url] of charStrips()) this.load.spritesheet(key, url, { frameWidth: 32, frameHeight: 32 });
    for (const [key, url] of slimeStrips()) this.load.spritesheet(key, url, { frameWidth: 16, frameHeight: 16 });
  }

  create() {
    makeAnims(this);
    makeTextures(this);
    this.scene.start('Title');
  }
}

function makeAnims(scene) {
  const A = scene.anims;
  const strip = (key, rate, repeat = -1) => {
    if (!scene.textures.exists(key) || A.exists(key)) return;
    A.create({ key, frames: A.generateFrameNumbers(key, { start: 0, end: 3 }), frameRate: rate, repeat });
  };
  for (const set of ['A', 'U', 'IA']) {
    for (const d of ['Down', 'Up', 'Left', 'Right']) {
      strip(`${set}-Idle-${d}`, 5);
      strip(`${set}-Walk-${d}`, 10);
      strip(`${set}-Push-${d}`, 6);
      strip(`${set}-Hit-${d}`, 14, 0);
      strip(`${set}-Attack-${d}`, 16, 0);
    }
  }
  A.create({ key: 'A-Defeat', frames: A.generateFrameNumbers('A-Defeat', { start: 0, end: 3 }), frameRate: 5, repeat: 0 });
  for (const color of ['Green', 'Blue', 'Red']) {
    const k = `${color}Slime`;
    strip(`${k}-Idle`, 5); strip(`${k}-Hit`, 10);
    for (const d of ['Down', 'Up', 'Left', 'Right']) { strip(`${k}-Walk${d}`, 8); strip(`${k}-Attack${d}`, 8); }
  }
  // Gremlin (32px cells under a 16px header) and golem (48px cells under a 32px header)
  sheetAnims(scene, 'gremlin', 32, 16);
  sheetAnims(scene, 'golem', 48, 32);
  // NPCs
  for (const [who, row] of Object.entries(NPC_ROW)) {
    A.create({ key: `npc-${who}`, frames: A.generateFrameNumbers('npcs', { start: row * 4, end: row * 4 + 3 }), frameRate: 4, repeat: -1 });
  }
  A.create({ key: 'smoke', frames: A.generateFrameNumbers('smoke', { start: 0, end: 3 }), frameRate: 14, repeat: 0 });
  // torch flames from the tileset (4 tiles in a row)
  const tex = scene.textures.get('tileset');
  for (let i = 0; i < 4; i++) tex.add(`torch${i}`, 0, i * 16, 45 * 16, 16, 16);
  A.create({ key: 'torch', frames: [0, 1, 2, 3].map((i) => ({ key: 'tileset', frame: `torch${i}` })), frameRate: 8, repeat: -1 });
}

function sheetAnims(scene, key, cell, header) {
  const tex = scene.textures.get(key);
  const A = scene.anims;
  for (const [dir, row] of Object.entries(ROW_OF)) {
    for (let c = 0; c < 20; c++) tex.add(`${row}_${c}`, 0, c * cell, header + row * cell, cell, cell);
    for (const [g, gi] of Object.entries(GROUP)) {
      const r = g === 'death' ? 0 : row;
      const frames = [0, 1, 2, 3].map((i) => ({ key, frame: `${r}_${gi * 4 + i}` }));
      A.create({ key: `${key}-${g}-${dir}`, frames, frameRate: g === 'walk' ? 8 : g === 'attack' ? 10 : 6, repeat: g === 'death' ? 0 : -1 });
    }
  }
}

/** Little procedural pixel textures: hearts, rocks, push blocks. */
function makeTextures(scene) {
  const px = (key, w, h, rows, colors) => {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, w, h);
    const c = t.getContext();
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === ' ' || ch === '.') return;
      c.fillStyle = colors[ch]; c.fillRect(x, y, 1, 1);
    }));
    t.refresh();
  };
  const heartRows = [
    '.kk.kk.',
    'krrkrrk',
    'krwrrrk',
    'krrrrrk',
    '.krrrk.',
    '..krk..',
    '...k...',
  ];
  const ink = PALETTE.ink;
  px('heart', 7, 7, heartRows, { k: ink, r: '#d8343a', w: '#f9f5ef' });
  px('heartHalf', 7, 7, heartRows.map((r) => r.slice(0, 4) + r.slice(4).replace(/[rw]/g, 'e')), { k: ink, r: '#d8343a', w: '#f9f5ef', e: '#4e282e' });
  px('heartEmpty', 7, 7, heartRows.map((r) => r.replace(/[rw]/g, 'e')), { k: ink, e: '#4e282e' });
  px('heartBig', 13, 12, [
    '..kkk...kkk..',
    '.krrrk.krrrk.',
    'krwwrrkrrrrrk',
    'krwrrrrrrrrrk',
    'krrrrrrrrrrrk',
    'krrrrrrrrrrrk',
    '.krrrrrrrrrk.',
    '..krrrrrrrk..',
    '...krrrrrk...',
    '....krrrk....',
    '.....krk.....',
    '......k......',
  ], { k: ink, r: '#d8343a', w: '#f9f5ef' });
  px('rock', 6, 6, ['.kkkk.', 'kgwggk', 'kgggdk', 'kggddk', 'kdddk.', '.kkk..'], { k: ink, g: '#9a8f86', w: '#cfc4b6', d: '#5d5650' });
  px('block', 16, 16, [
    'kkkkkkkkkkkkkkkk',
    'kwwwwwwwwwwwwwgk',
    'kwggggggggggggdk',
    'kwgllllllllllgdk',
    'kwglmmmmmmmmlgdk',
    'kwglmggmmggmlgdk',
    'kwglmggmmggmlgdk',
    'kwglmmmmmmmmlgdk',
    'kwglmmmmmmmmlgdk',
    'kwglmggmmggmlgdk',
    'kwglmggmmggmlgdk',
    'kwglmmmmmmmmlgdk',
    'kwgllllllllllgdk',
    'kwggggggggggggdk',
    'kgddddddddddddddk',
    'kkkkkkkkkkkkkkkk',
  ].map((r) => r.slice(0, 16)), { k: ink, w: '#cfc4b6', g: '#9a8f86', d: '#5d5650', l: '#7d746c', m: '#8a8079' });
  px('spark', 5, 5, ['..w..', '..w..', 'wwyww', '..w..', '..w..'], { w: '#f9f5ef', y: '#e3d245' });
  px('star', 3, 3, ['.y.', 'yyy', '.y.'], { y: '#e3d245' });
}
