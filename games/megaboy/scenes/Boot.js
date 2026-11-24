import Phaser from 'phaser';
import {
  SHEETS, heroFiles, HERO_FRAMES, HERO_ANIMS, WEAPON_PAL, BOSS_PAL, heroMap, recolor, ENEMY_FRAMES,
  keyAndOutline, outline, BIG_FRAMES, DARK_MAP, GUARD_MAP,
} from '../art.js';
import { PALETTE } from '../../../shared/core/palette.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const w = this.scale.width;
    this.add.rectangle(w / 2 - 100, 180, 200, 8, 0x47416b).setOrigin(0, 0.5);
    const bar = this.add.rectangle(w / 2 - 100, 180, 0, 8, 0xe3d245).setOrigin(0, 0.5);
    this.load.on('progress', (v) => { bar.width = 200 * v; });
    for (const [k, url] of Object.entries(SHEETS)) this.load.image(k, url);
    for (const [k, url] of heroFiles()) this.load.image(k, url);
  }

  create() {
    buildHero(this);
    buildBosses(this);
    buildEnemies(this);
    buildBig(this);
    buildMisc(this);
    buildAnims(this);
    this.scene.start('Title');
  }
}

/** A canvas texture with numbered frames laid out in a row. */
function sheet(scene, key, fw, fh, n, draw) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, fw * n, fh);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  for (let i = 0; i < n; i++) tex.add(i, 0, i * fw, 0, fw, fh);
  tex.refresh();
  return tex;
}

const img = (scene, k) => scene.textures.get(k).getSourceImage();

function drawHeroFrames(scene, ctx) {
  HERO_FRAMES.forEach((name, i) => ctx.drawImage(img(scene, `hf-${name}`), i * 24, 0));
}

function buildHero(scene) {
  for (const [w, pal] of Object.entries(WEAPON_PAL)) {
    sheet(scene, `hero-${w}`, 24, 24, HERO_FRAMES.length, (ctx) => {
      drawHeroFrames(scene, ctx);
      if (pal) {
        const d = ctx.getImageData(0, 0, 24 * HERO_FRAMES.length, 24);
        ctx.putImageData(recolor(d, heroMap(pal)), 0, 0);
      }
    });
  }
}

function buildBosses(scene) {
  for (const [kind, bp] of Object.entries(BOSS_PAL)) {
    sheet(scene, `boss-${kind}`, 24, 24, HERO_FRAMES.length, (ctx) => {
      drawHeroFrames(scene, ctx);
      const W = 24 * HERO_FRAMES.length;
      const d = ctx.getImageData(0, 0, W, 24);
      recolor(d, heroMap(bp.body, bp.visor));
      // a crest on top of the head of every frame
      const buf = d.data;
      for (let f = 0; f < HERO_FRAMES.length; f++) {
        let top = -1; let xs = [];
        for (let y = 0; y < 24 && top < 0; y++) {
          for (let x = 0; x < 24; x++) if (buf[(y * W + f * 24 + x) * 4 + 3]) xs.push(x);
          if (xs.length) top = y;
        }
        if (top < 0) continue;
        const cx = Math.round((xs[0] + xs[xs.length - 1]) / 2);
        const rows = bp.crest;
        const cw = rows[0].length;
        rows.forEach((row, ry) => {
          const y = top - rows.length + ry + 1;
          [...row].forEach((ch, rx) => {
            if (ch === '.' || y < 0) return;
            const x = f * 24 + cx - Math.floor(cw / 2) + rx;
            const col = Phaser.Display.Color.HexStringToColor(bp.colors[ch]);
            const o = (y * W + x) * 4;
            buf[o] = col.red; buf[o + 1] = col.green; buf[o + 2] = col.blue; buf[o + 3] = 255;
          });
        });
      }
      // re-outline so the crest gets the same ink edge as the body
      outlineOpaqueEdges(buf, W, 24);
      ctx.putImageData(d, 0, 0);
    });
  }
}

/** Outline only where colour meets transparency and no ink is there yet. */
function outlineOpaqueEdges(buf, W, H) {
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? buf[(y * W + x) * 4 + 3] : 0);
  const isInk = (x, y) => { const o = (y * W + x) * 4; return buf[o + 3] && buf[o] < 10 && buf[o + 1] < 10 && buf[o + 2] < 10; };
  const add = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (at(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx; const ny = y + dy;
        if (at(nx, ny) && !isInk(nx, ny) && (nx % 24 === x % 24 + dx || dx === 0)) { add.push((y * W + x) * 4); break; }
      }
    }
  }
  for (const o of add) { buf[o] = 0; buf[o + 1] = 0; buf[o + 2] = 0; buf[o + 3] = 255; }
}

function buildEnemies(scene) {
  for (const [kind, def] of Object.entries(ENEMY_FRAMES)) {
    const s = def.size; const cell = def.ink ? s + 2 : s;
    sheet(scene, `en-${kind}`, cell, cell, def.frames.length, (ctx) => {
      const src = img(scene, def.sheet);
      const tmp = document.createElement('canvas');
      tmp.width = s; tmp.height = s;
      const tctx = tmp.getContext('2d');
      def.frames.forEach(([x, y], i) => {
        tctx.clearRect(0, 0, s, s);
        tctx.drawImage(src, x, y, s, s, 0, 0, s, s);
        const d = tctx.getImageData(0, 0, s, s);
        if (def.ink) {
          const out = keyAndOutline(d.data, s, s);
          ctx.putImageData(new ImageData(out, s + 2, s + 2), i * cell, 0);
        } else {
          if (def.tint === 'guard') recolor(d, GUARD_MAP);
          ctx.putImageData(d, i * cell, 0);
        }
      });
    });
  }
}

function buildBig(scene) {
  for (const [k, [x, y, w, h]] of Object.entries(BIG_FRAMES)) {
    sheet(scene, `big-${k}`, w + 2, h + 2, 1, (ctx) => {
      ctx.drawImage(img(scene, 'creatures'), x, y, w, h, 1, 1, w, h);
      const d = ctx.getImageData(0, 0, w + 2, h + 2);
      recolor(d, DARK_MAP);
      outline(d.data, w + 2, h + 2);
      ctx.putImageData(d, 0, 0);
    });
  }
}

/** Tiny pixel textures from text rows. */
function px(scene, key, rows, colors) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const w = Math.max(...rows.map((r) => r.length)); const h = rows.length;
  const t = scene.textures.createCanvas(key, w, h);
  const c = t.getContext();
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || ch === ' ') return;
    c.fillStyle = colors[ch]; c.fillRect(x, y, 1, 1);
  }));
  t.refresh();
  return t;
}

function buildMisc(scene) {
  const k = PALETTE.ink; const W = '#f9f5ef'; const Y = '#e3d245'; const O = '#d88038'; const R = '#d84a4a';
  const B = '#5fcde4'; const G = '#6cbe50'; const L = '#8a8fc4'; const N = '#47416b'; const S = '#cfd6e0';
  // player shots
  px(scene, 'sh-pellet', ['.yy.', 'ywwy', 'ywwy', '.yy.'], { y: Y, w: W });
  px(scene, 'sh-mid', ['.yyyy.', 'yywwyy', 'ywwwwy', 'ywwwwy', 'yywwyy', '.yyyy.'], { y: Y, w: W });
  px(scene, 'sh-full', ['..oyyyyy..', '.oyywwwyy.', 'oyywwwwwyy', 'oyywwwwwyy', 'oyywwwwwyy', 'oyywwwwwyy', '.oyywwwyy.', '..oyyyyy..'], { o: O, y: Y, w: W });
  px(scene, 'sh-ember', ['.ooo.', 'oyyyo', 'oywyo', 'oyyyo', '.ooo.'], { o: O, y: Y, w: W });
  px(scene, 'sh-ice', ['..bbbbbb..', 'bwwwwwwwwb', '..bbbbbb..'], { b: B, w: W });
  px(scene, 'sh-leaf', ['..gg..', '.gGGg.', 'gGGGGg', 'gGGGGg', '.gGGg.', '..gg..'], { g: '#2f5a2a', G });
  px(scene, 'sh-volt', ['..y..', '.yyy.', 'yywyy', '.yyy.', '..y..'], { y: Y, w: W });
  px(scene, 'sh-drill', ['ss....', 'sSSs..', 'sSSSSs', 'sSSSSs', 'sSSs..', 'ss....'], { s: '#8a8079', S });
  px(scene, 'sh-gale', ['ww....ww', 'wLw..wLw', '.wLwwLw.', '..wLLw..', '...ww...'], { w: W, L });
  // enemy bullets and boss attacks
  px(scene, 'eb', ['.kk.', 'kwrk', 'krrk', '.kk.'], { k, w: W, r: R });
  px(scene, 'eb-bomb', ['..kk..', '.kook.', 'koyyok', 'koyook', '.kook.', '..kk..'], { k, o: O, y: Y });
  px(scene, 'eb-flame0', ['...o....', '..oyo...', '.oyyo.o.', '.oywyooy', 'oyywwyyo', 'oywwwwyo', 'oyywwyyo', '.oooooo.'], { o: O, y: Y, w: W });
  px(scene, 'eb-flame1', ['....o...', '...oyo..', '.o.oyyo.', 'oyooywyo', 'oyywwyyo', 'oywwwwyo', 'oyywwyyo', '.oooooo.'], { o: O, y: Y, w: W });
  px(scene, 'eb-lance', ['..kbbbbbk.', 'kbwwwwwwbk', '..kbbbbbk.'], { k, b: B, w: W });
  px(scene, 'eb-leaf', ['..kk..', '.kgGk.', 'kgGGGk', 'kgGGGk', '.kgGk.', '..kk..'], { k, g: '#2f5a2a', G });
  px(scene, 'eb-spark', ['..y..', '.ywy.', 'ywwwy', '.ywy.', '..y..'], { y: Y, w: W });
  px(scene, 'eb-seeker', ['.kkk..', 'ksssk.', 'ksSSsk', 'ksSSsk', 'ksssk.', '.kkk..'], { k, s: '#8a5a3a', S: '#d8a070' });
  px(scene, 'eb-rang', ['kk....kk', 'kwk..kwk', '.kwkkwk.', '..kwwk..', '...kk...'], { k, w: W });
  px(scene, 'eb-rock', ['.kkkk...', 'kssssk..', 'ksSSssk.', 'ksSssssk', 'kssssssk', '.kssssk.', '..kkkk..'], { k, s: '#7d746c', S: '#cfc4b6' });
  px(scene, 'eb-orb', ['.kkkk.', 'krrrrk', 'krwrrk', 'krrrrk', 'krrrrk', '.kkkk.'], { k, r: '#b03080', w: W });
  // pickups and icons
  px(scene, 'etank', ['kkkkkkkk', 'kbbbbbbk', 'kbwwwwbk', 'kbwbbbbk', 'kbwwwbbk', 'kbwbbbbk', 'kbwwwwbk', 'kkkkkkkk'], { k, b: '#5b6ee1', w: W });
  px(scene, 'life', ['..kkkk..', '.krrrrk.', 'krrrrrrk', 'krbbbbrk', 'krbwbwrk', 'krrbbrrk', '.krrrrk.', '..kkkk..'], { k, r: '#ac3232', b: '#5fcde4', w: W });
  // weapon icons (10x10) for the HUD and menus
  const icons = {
    buster: [['..kkkk....', '.kyyyyk...', 'kyywwyyk..', 'kywwwwyk..', 'kywwwwyk..', 'kyywwyyk..', '.kyyyyk...', '..kkkk....'], { k, y: Y, w: W }],
    ember: [['...kk.....', '..kook....', '.koyyok...', 'koyywyok..', 'koywwyok..', 'koyyyyok..', '.koooook..', '..kkkkk...'], { k, o: O, y: Y, w: W }],
    ice: [['......kk..', '.....kbk..', '....kbwk..', '...kbwk...', '..kbwk....', '.kbwk.....', 'kbbk......', 'kkk.......'], { k, b: B, w: W }],
    thorn: [['..kk.kk...', '.kgGkGgk..', 'kgGGkGGgk.', 'kgGk.kGgk.', 'kgGk.kGgk.', 'kgGGkGGgk.', '.kgGkGgk..', '..kk.kk...'], { k, g: '#2f5a2a', G }],
    volt: [['....kkk...', '...kyyk...', '..kyyk....', '.kyyyykk..', '.kkkyyyk..', '...kyyk...', '..kyyk....', '..kkk.....'], { k, y: Y }],
    drill: [['kk........', 'kSsk......', 'kSSssk....', 'kSSSSssk..', 'kSSSSssk..', 'kSSssk....', 'kSsk......', 'kk........'], { k, s: '#8a8079', S }],
    gale: [['kk....kk..', 'kwk..kwk..', 'kLwkkwLk..', '.kLwwLk...', '..kLLk....', '...kk.....', '..........', '..........'], { k, w: W, L }],
  };
  for (const [name, [rows, cols]] of Object.entries(icons)) px(scene, `icon-${name}`, rows, cols);
  // world bits
  px(scene, 'spike-up', ['...kk...', '..kssk..', '..kSsk..', '.kSSssk.', '.kSsssk.', 'kSSsssskk', 'kssssssk', 'kkkkkkkk'].map((r) => r.slice(0, 8)), { k, s: '#8a8fc4', S: W });
  px(scene, 'oneway', ['kkkkkkkk', 'kSSSSSSk', 'kssssssk', 'kkkkkkkk'], { k, S: '#cfd6e0', s: '#8a8079' });
  px(scene, 'conv', ['kkkkkkkk', 'kyykkyyk', 'kkyykkyy', 'kyykkyyk', 'kkkkkkkk'], { k, y: '#e3d245' });
  px(scene, 'mover', ['kkkkkkkkkkkkkkkkkkkkkkkk', 'kSSSSSSSSSSSSSSSSSSSSSSk', 'ksrsssssssssssssssssrssk', 'kkkkkkkkkkkkkkkkkkkkkkkk', '.kNNk..............kNNk.', '..kk................kk..'], { k, S: '#cfd6e0', s: '#8a8079', r: '#d84a4a', N });
  px(scene, 'door', ['kkkkkkkk', 'kSSSSSSk', 'kssssssk', 'knnnnnnk'], { k, S: '#cfd6e0', s: '#8a8fc4', n: N });
  px(scene, 'cp', ['kk....', 'kyyk..', 'kyyyyk', 'kyyk..', 'kk....', 'k.....', 'k.....', 'k.....', 'k.....', 'k.....'], { k, y: Y });
  // effects
  px(scene, 'fx-spark', ['...w...', '...w...', '..wyw..', 'wwyyyww', '..wyw..', '...w...', '...w...'], { w: W, y: Y });
  px(scene, 'fx-dot', ['.ww.', 'wyyw', 'wyyw', '.ww.'], { w: W, y: Y });
  px(scene, 'fx-ring', ['..kkkk..', '.kwwwwk.', 'kwwkkwwk', 'kwk..kwk', 'kwk..kwk', 'kwwkkwwk', '.kwwwwk.', '..kkkk..'], { k, w: W });
  const boom = (r, core) => {
    const rows = [];
    for (let y = 0; y < 16; y++) {
      let row = '';
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        row += d < core ? 'w' : d < r - 1.5 ? 'y' : d < r ? 'o' : '.';
      }
      rows.push(row);
    }
    return rows;
  };
  [[4, 2], [6.5, 3.5], [8, 3], [8, 0]].forEach(([r, c], i) => px(scene, `fx-boom${i}`, boom(r, c), { w: W, y: Y, o: O }));
  px(scene, 'px', ['w'], { w: '#ffffff' });
}

function buildAnims(scene) {
  const A = scene.anims;
  const sets = [...Object.keys(WEAPON_PAL).map((w) => `hero-${w}`), ...Object.keys(BOSS_PAL).map((b) => `boss-${b}`)];
  for (const key of sets) {
    for (const [name, [frames, fps, repeat]] of Object.entries(HERO_ANIMS)) {
      const k = `${key}-${name}`;
      if (!A.exists(k)) A.create({ key: k, frames: frames.map((f) => ({ key, frame: f })), frameRate: fps, repeat });
    }
  }
  for (const [kind, def] of Object.entries(ENEMY_FRAMES)) {
    const k = `en-${kind}`;
    const n = kind === 'hardhat' || kind === 'guard' ? 4 : def.frames.length;
    if (!A.exists(k)) A.create({ key: k, frames: Array.from({ length: n }, (_, i) => ({ key: k, frame: i })), frameRate: kind === 'bat' ? 10 : 6, repeat: -1 });
  }
  if (!A.exists('fx-boom')) A.create({ key: 'fx-boom', frames: [0, 1, 2, 3].map((i) => ({ key: `fx-boom${i}` })), frameRate: 16, repeat: 0 });
  if (!A.exists('eb-flame')) A.create({ key: 'eb-flame', frames: [{ key: 'eb-flame0' }, { key: 'eb-flame1' }], frameRate: 10, repeat: -1 });
}
