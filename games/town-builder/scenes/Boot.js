import Phaser from 'phaser';
import { FRAMES } from '../logic/sprites.js';

// Tiny Tile Town art (Aleksandr Makarov) plus BAS Town icons and people.
const TTT = '../../../shared/assets/modern-city/TinyTileTown-v.1.0';
const urls = import.meta.glob('../../../shared/assets/modern-city/TinyTileTown-v.1.0/{Buildings,Disasters,Vehicle,Tileset-n-Decorations}/*.png', { eager: true, query: '?url', import: 'default' });
const basUrls = import.meta.glob('../../../shared/assets/modern-city/BAS-Town-v.1.0/{Icons/Icons,Miscellaneous/People}.png', { eager: true, query: '?url', import: 'default' });
const url = (p) => urls[`${TTT}/${p}`];
const bas = (p) => basUrls[`../../../shared/assets/modern-city/BAS-Town-v.1.0/${p}`];

const SHEETS = {
  res: 'Buildings/ResidentalSpriteSheet.png', com: 'Buildings/CommercialSpriteSheet.png', ind: 'Buildings/IndustrialSpriteSheet.png',
  farm: 'Buildings/FarmSpriteSheet.png', fire: 'Buildings/FireSpriteSheet.png', police: 'Buildings/PoliceSpriteSheet.png',
  med: 'Buildings/MedicalSpriteSheet.png', edu: 'Buildings/EducationSpriteSheet.png', mt: 'Buildings/MassTransitSpriteSheet.png',
  airport: 'Buildings/Airport.png',
};

// Colours sampled from the pack's road and terrain tiles.
export const COL = {
  grass: '#6daa2c', grassDark: '#34652a', grassLight: '#86c03e', asphalt: '#4e4a4e', line: '#deeed6', walk: '#8595a1',
  water: '#597dce', waterLight: '#8fb0ec', waterDark: '#46629f', dirt: '#854c30', stone: '#757161',
};

// Civilian cars: columns of the small-car row in the vehicle sheet (the dented and dark variants are skipped).
export const CARS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const g = this.add.graphics();
    this.load.on('progress', (v) => { g.clear().fillStyle(0xe3d245).fillRect(80, 318, 200 * v, 4); });
    for (const [k, p] of Object.entries(SHEETS)) this.load.image(k, url(p));
    this.load.image('veh', url('Vehicle/VehicleSpriteSheet.png'));
    this.load.image('trees', url('Tileset-n-Decorations/Trees.png'));
    this.load.spritesheet('quake', url('Disasters/EarthquakeSpriteSheet.png'), { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('tornado', url('Disasters/TornadoSpriteSheet.png'), { frameWidth: 32, frameHeight: 32 });
    this.load.image('meteorSheet', url('Disasters/MeteorSpriteSheet.png'));
    this.load.image('ufoSheet', url('Disasters/UfoSpriteSheet.png'));
    this.load.spritesheet('icons', bas('Icons/Icons.png'), { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('people', bas('Miscellaneous/People.png'), { frameWidth: 4, frameHeight: 5 });
  }

  create() {
    // Building frames: texture = sheet name, frame = index in the catalog.
    for (const [sheet, list] of Object.entries(FRAMES)) {
      const tex = this.textures.get(sheet);
      list.forEach((r, i) => { if (r && !tex.has(String(i))) tex.add(String(i), 0, r[0], r[1], r[2], r[3]); });
    }
    // Vehicles: each 48x48 cell has the car facing left/right (left column) and up/down (right column).
    const veh = this.textures.get('veh');
    const cell = (name, cx, cy) => {
      const x = cx * 48; const y = cy * 48;
      for (const [d, dx, dy] of [['L', 16, 16], ['R', 16, 32], ['D', 32, 16], ['U', 32, 32]]) veh.add(`${name}${d}`, 0, x + dx, y + dy, 16, 16);
    };
    CARS.forEach((c, k) => cell(`car${k}`, c, 2));
    cell('bus', 0, 1); cell('bus2', 9, 1); cell('firetruck', 15, 0); cell('police', 2, 2); cell('truck', 3, 0);
    // Trees for forest tiles.
    const trees = this.textures.get('trees');
    [[16, 48], [16, 112], [16, 176], [16, 240], [16, 304]].forEach(([x, y], k) => trees.add(`t${k}`, 0, x, y, 16, 16));
    // Meteor and UFO strips have a 16 px label row on top.
    const strip = (key, src, n) => {
      const t = this.textures.get(src);
      for (let i = 0; i < n; i++) t.add(`${key}${i}`, 0, i * 32, 16, 32, 32);
    };
    strip('m', 'meteorSheet', 16);
    strip('u', 'ufoSheet', 28);
    this.makeTiles();
    this.makeAnims();
    this.scene.start('Title');
  }

  /** Roads, bridges, water edges, grass and rubble, drawn in the pack's colours (16 neighbour masks each). */
  makeTiles() {
    const S = 16;
    const cv = this.textures.createCanvas('tiles', S * 16, S * 6);
    const c = cv.getContext();
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    // mask bits: 1 = north, 2 = east, 4 = south, 8 = west
    for (let m = 0; m < 16; m++) {
      for (const bridge of [0, 1]) {
        const ox = m * S; const oy = bridge * S;
        const n = m & 1; const e = m & 2; const s = m & 4; const w = m & 8;
        if (bridge) px(ox, oy, S, S, COL.water);
        if (bridge) {
          // Deck with railings on the open sides.
          px(ox + (w ? 0 : 2), oy + (n ? 0 : 2), S - (w ? 0 : 2) - (e ? 0 : 2), S - (n ? 0 : 2) - (s ? 0 : 2), COL.asphalt);
          if (!n) px(ox + 1, oy + 1, S - 2, 1, COL.walk);
          if (!s) px(ox + 1, oy + S - 2, S - 2, 1, COL.walk);
          if (!w) px(ox + 1, oy + 1, 1, S - 2, COL.walk);
          if (!e) px(ox + S - 2, oy + 1, 1, S - 2, COL.walk);
        } else {
          px(ox, oy, S, S, COL.asphalt);
          if (!n) px(ox, oy, S, 1, COL.line);
          if (!s) px(ox, oy + S - 1, S, 1, COL.line);
          if (!w) px(ox, oy, 1, S, COL.line);
          if (!e) px(ox + S - 1, oy, 1, S, COL.line);
          // Corner kerbs where two roads meet at a junction.
          if (n && w) px(ox, oy, 1, 1, COL.line);
          if (n && e) px(ox + S - 1, oy, 1, 1, COL.line);
          if (s && w) px(ox, oy + S - 1, 1, 1, COL.line);
          if (s && e) px(ox + S - 1, oy + S - 1, 1, 1, COL.line);
        }
        // Centre dashes on straight pieces and ends.
        const count = !!n + !!e + !!s + !!w;
        if (count <= 2) {
          if ((n || s) && !(e || w)) { px(ox + 7, oy + 2, 2, 4, COL.line); px(ox + 7, oy + 10, 2, 4, COL.line); }
          if ((e || w) && !(n || s)) { px(ox + 2, oy + 7, 4, 2, COL.line); px(ox + 10, oy + 7, 4, 2, COL.line); }
        }
      }
    }
    // Water with a light shore on sides that touch land (row 2), mask = which sides are water.
    for (let m = 0; m < 16; m++) {
      const ox = m * S; const oy = 2 * S;
      px(ox, oy, S, S, COL.water);
      px(ox + 3, oy + 5, 3, 1, COL.waterLight); px(ox + 10, oy + 11, 3, 1, COL.waterLight);
      if (!(m & 1)) { px(ox, oy, S, 2, COL.line); px(ox, oy + 2, S, 1, COL.waterLight); }
      if (!(m & 4)) { px(ox, oy + S - 2, S, 2, COL.waterDark); }
      if (!(m & 8)) { px(ox, oy, 2, S, COL.line); px(ox + 2, oy, 1, S, COL.waterLight); }
      if (!(m & 2)) { px(ox + S - 2, oy, 2, S, COL.line); px(ox + S - 3, oy, 1, S, COL.waterLight); }
    }
    // Grass variants (row 3, frames 0-3), rubble (4-5), dirt lot (6).
    const rnd = (k) => { const v = Math.sin(k * 99.7) * 43758.5; return v - Math.floor(v); };
    for (let k = 0; k < 4; k++) {
      const ox = k * S; const oy = 3 * S;
      px(ox, oy, S, S, COL.grass);
      for (let j = 0; j < 3 + k; j++) {
        const x = Math.floor(rnd(k * 13 + j) * 14); const y = Math.floor(rnd(k * 31 + j * 7) * 13);
        px(ox + x, oy + y, 1, 2, COL.grassDark); px(ox + x + 1, oy + y + 1, 1, 1, COL.grassDark);
      }
      if (k === 3) { px(ox + 4, oy + 4, 1, 1, '#f9f5ef'); px(ox + 11, oy + 10, 1, 1, '#e3d245'); }
    }
    for (let k = 0; k < 2; k++) {
      const ox = (4 + k) * S; const oy = 3 * S;
      px(ox, oy, S, S, COL.dirt);
      for (let j = 0; j < 7; j++) {
        const x = Math.floor(rnd(k * 17 + j * 3) * 13); const y = Math.floor(rnd(k * 5 + j * 11) * 13);
        px(ox + x, oy + y, 3, 2, COL.stone); px(ox + x, oy + y + 2, 3, 1, '#4e4a4e');
      }
    }
    px(6 * S, 3 * S, S, S, '#a88a5c');
    // Zone lot overlays (row 4): R, C, I, F as dotted borders with a light fill.
    ['#6ec05a', '#5aa0e6', '#e3c045', '#c08848'].forEach((col, k) => {
      const ox = k * S; const oy = 4 * S;
      c.globalAlpha = 0.28; px(ox + 1, oy + 1, S - 2, S - 2, col); c.globalAlpha = 1;
      for (let i = 1; i < S - 1; i += 3) { px(ox + i, oy + 1, 2, 1, col); px(ox + i, oy + S - 2, 2, 1, col); px(ox + 1, oy + i, 1, 2, col); px(ox + S - 2, oy + i, 1, 2, col); }
    });
    // Farm field furrows for empty farm zones (row 4, frame 4).
    px(4 * S + 1, 4 * S + 1, S - 2, S - 2, '#a87b4c');
    for (let i = 3; i < S - 2; i += 3) px(4 * S + 2, 4 * S + i, S - 4, 1, '#8b6238');
    cv.refresh();
    const tex = this.textures.get('tiles');
    for (let m = 0; m < 16; m++) { tex.add(`r${m}`, 0, m * S, 0, S, S); tex.add(`b${m}`, 0, m * S, S, S, S); tex.add(`w${m}`, 0, m * S, 2 * S, S, S); }
    for (let k = 0; k < 4; k++) tex.add(`g${k}`, 0, k * S, 3 * S, S, S);
    tex.add('x0', 0, 4 * S, 3 * S, S, S); tex.add('x1', 0, 5 * S, 3 * S, S, S); tex.add('lot', 0, 6 * S, 3 * S, S, S);
    ['R', 'C', 'I', 'F'].forEach((z, k) => tex.add(`z${z}`, 0, k * S, 4 * S, S, S));
    tex.add('field', 0, 4 * S, 4 * S, S, S);
  }

  makeAnims() {
    const a = this.anims;
    if (a.exists('tornado')) return;
    a.create({ key: 'tornado', frames: a.generateFrameNumbers('tornado', { start: 0, end: 7 }), frameRate: 12, repeat: -1 });
    a.create({ key: 'quake', frames: a.generateFrameNumbers('quake', { start: 0, end: 11 }), frameRate: 10, repeat: 0 });
    const fr = (tex, key, from, to) => Array.from({ length: to - from + 1 }, (_, i) => ({ key: tex, frame: `${key}${from + i}` }));
    a.create({ key: 'meteorFly', frames: fr('meteorSheet', 'm', 8, 11), frameRate: 10, repeat: -1 });
    a.create({ key: 'meteorHit', frames: fr('meteorSheet', 'm', 12, 15), frameRate: 10, repeat: 0 });
    a.create({ key: 'ufoFly', frames: fr('ufoSheet', 'u', 0, 3), frameRate: 8, repeat: -1 });
    a.create({ key: 'ufoZap', frames: fr('ufoSheet', 'u', 4, 13), frameRate: 12, repeat: -1 });
    a.create({ key: 'ufoDown', frames: fr('ufoSheet', 'u', 19, 27), frameRate: 10, repeat: 0 });
  }
}
