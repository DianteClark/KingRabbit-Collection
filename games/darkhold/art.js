// Art from the MAS Darkness Pack by Aleksandr Makarov (see shared/assets/LICENSE-ART.md).
//   tiles:  Tileset.png. Walls are a thin-wall autotile: each 16px floor cell is drawn as four
//           8px quarters chosen by its neighbours (QUARTERS). Lit floors use these colours; the
//           remembered (unlit) map uses a darkened copy ('tilesDim', the pack's night palette).
//   cre:    MonsterPack/Creatures.png, 16px cells 'c:col,row' plus the 32px boss 'c:king'.
//   creB:   MonsterPack/CreaturesBlack.png (the black variant), used for class portraits.
//   items:  Items/Items.png, 16px cells 'i:col,row'.
import tilesUrl from '../../shared/assets/mas-mini-retro/MAS-Darkness-Pack-1.0/Tileset/Tileset.png?url';
import creUrl from '../../shared/assets/mas-mini-retro/MAS-Darkness-Pack-1.0/MonsterPack/Creatures.png?url';
import creBUrl from '../../shared/assets/mas-mini-retro/MAS-Darkness-Pack-1.0/MonsterPack/CreaturesBlack.png?url';
import itemsUrl from '../../shared/assets/mas-mini-retro/MAS-Darkness-Pack-1.0/Items/Items.png?url';

export const SHEETS = { tiles: tilesUrl, cre: creUrl, creB: creBUrl, items: itemsUrl };

// Quarter tiles [x, y] on Tileset.png for each corner of a floor cell. Case: none (open), v (wall
// at the side), h (wall above/below), both (inner corner), post (only the diagonal is wall).
export const QUARTERS = {
  TL: { none: [0, 128], post: [16, 128], v: [0, 160], h: [64, 160], both: [32, 192] },
  TR: { none: [8, 128], post: [40, 128], v: [8, 176], h: [72, 160], both: [72, 192] },
  BL: { none: [0, 136], post: [0, 152], v: [0, 168], h: [64, 184], both: [0, 216] },
  BR: { none: [8, 136], post: [72, 136], v: [8, 184], h: [72, 184], both: [104, 200] },
};

// 16px objects on Tileset.png.
export const OBJECTS = {
  ladder: [112, 0], door: [112, 48], doorOpen: [48, 32], urn: [112, 64], chest: [64, 80],
  crack: [0, 16], rubble: [32, 16], pebbles: [32, 80], candles: [48, 80], shelf: [80, 16],
};

// Lit palette -> unlit (remembered) palette.
const DIM = [
  [[185, 132, 143], [42, 38, 74]],
  [[227, 191, 143], [66, 60, 108]],
  [[59, 65, 120], [24, 24, 50]],
  [[124, 89, 152], [72, 62, 116]],
  [[243, 228, 210], [104, 94, 146]],
  [[32, 33, 65], [18, 18, 36]],
];

export function buildTextures(scene) {
  const T = scene.textures;
  // Creatures and items: 16px grids.
  for (const key of ['cre', 'creB']) {
    const tex = T.get(key);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) tex.add(`c:${c},${r}`, 0, c * 16, r * 16, 16, 16);
    tex.add('c:king', 0, 96, 128, 32, 32);
  }
  const it = T.get('items');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) it.add(`i:${c},${r}`, 0, c * 16, r * 16, 16, 16);
  const tl = T.get('tiles');
  for (const [name, [x, y]] of Object.entries(OBJECTS)) tl.add(`o:${name}`, 0, x, y, 16, 16);

  // The dim (remembered) tileset.
  if (!T.exists('tilesDim')) {
    const src = tl.getSourceImage();
    const cv = T.createCanvas('tilesDim', src.width, src.height);
    const ctx = cv.getContext();
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, src.width, src.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const hit = DIM.find(([[r, g, b]]) => r === d[i] && g === d[i + 1] && b === d[i + 2]);
      if (hit) [d[i], d[i + 1], d[i + 2]] = hit[1];
      else { d[i] >>= 2; d[i + 1] >>= 2; d[i + 2] >>= 1; }
    }
    ctx.putImageData(img, 0, 0);
    cv.refresh();
  }

  const make = (key, w, h, draw) => {
    if (T.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  // Brazier flame (two frames).
  const flame = (g, k) => {
    g.fillStyle(0xd88038).fillRect(2, 4 - k, 6, 6 + k);
    g.fillStyle(0xe3bf8f).fillRect(3 + k, 2 - k, 3, 6);
    g.fillStyle(0xf3e4d2).fillRect(4, 6, 2, 3);
    g.fillStyle(0xd88038).fillRect(4 - k, 0, 2, 2);
  };
  make('flame0', 10, 10, (g) => flame(g, 0));
  make('flame1', 10, 10, (g) => flame(g, 1));
  // Trap plates.
  const plate = (g, accent) => {
    g.fillStyle(0x202141).fillRect(2, 2, 12, 12);
    g.lineStyle(2, accent).strokeRect(3, 3, 10, 10);
    g.fillStyle(accent);
  };
  make('trap:spike', 16, 16, (g) => { plate(g, 0xa13d3b); for (const x of [5, 8, 11]) { g.fillTriangle(x - 1, 11, x + 1, 11, x, 5); } });
  make('trap:alarm', 16, 16, (g) => { plate(g, 0xe3d245); g.fillRect(6, 5, 4, 5); g.fillRect(5, 9, 6, 2); g.fillRect(7, 11, 2, 1); });
  make('trap:smoke', 16, 16, (g) => { plate(g, 0x8a8fc4); g.fillCircle(6, 9, 2); g.fillCircle(9, 7, 2); g.fillCircle(10, 10, 1); });
  make('trap:teleport', 16, 16, (g) => { plate(g, 0x9a407e); g.strokeCircle(8, 8, 3); g.fillRect(7, 7, 2, 2); });
  make('trap:dart', 16, 16, (g) => { plate(g, 0x6c8c50); g.fillRect(5, 7, 6, 2); g.fillTriangle(11, 6, 11, 10, 13, 8); });
  // Aim reticle, path marker and shot.
  make('reticle', 16, 16, (g) => {
    g.fillStyle(0xd88038);
    for (const [x, y, w, h] of [[0, 0, 5, 2], [0, 0, 2, 5], [11, 0, 5, 2], [14, 0, 2, 5], [0, 14, 5, 2], [0, 11, 2, 5], [11, 14, 5, 2], [14, 11, 2, 5]]) g.fillRect(x, y, w, h);
  });
  make('dot', 4, 4, (g) => { g.fillStyle(0xe3bf8f).fillRect(0, 0, 4, 4); });
  make('arrow', 8, 2, (g) => { g.fillStyle(0xf3e4d2).fillRect(0, 0, 8, 2); });
  make('bolt', 6, 6, (g) => { g.fillStyle(0xd88038).fillRect(0, 0, 6, 6); g.fillStyle(0xf3e4d2).fillRect(2, 2, 2, 2); });
  make('spark', 2, 2, (g) => { g.fillStyle(0xffffff).fillRect(0, 0, 2, 2); });
  make('glow', 64, 64, (g) => {
    for (let r = 32; r > 0; r -= 4) { g.fillStyle(0xd88038, 0.05).fillCircle(32, 32, r); }
  });
}
