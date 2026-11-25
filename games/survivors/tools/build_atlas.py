#!/usr/bin/env python3
"""Build games/survivors/atlas/survivors.png + survivors.json and the launcher thumbnail.

Every sprite comes from Aleksandr Makarov's RAS Overworld pack (the 16x16 redraw of MAS
Roguelike): heroes, monsters, weapons, items and scenery. The sheets have a solid black
background, so each cell is flood-filled from its edges to make the background see-through
(dark pixels inside a sprite stay). Run from the repo root:
    python3 games/survivors/tools/build_atlas.py
"""
import json
import os
import random

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
RAS = os.path.join(ROOT, 'shared/assets/mas-mini-retro/RAS-Overworld-v.1.0')
OUT = os.path.join(ROOT, 'games/survivors/atlas')
THUMB = os.path.join(ROOT, 'games/public/thumbs/survivors.png')
BG = (4, 3, 3)

sheets = {k: Image.open(os.path.join(RAS, f)).convert('RGBA') for k, f in {
    'chr': 'CharactersSpriteSheet.png', 'en': 'EnemySpriteSheet.png',
    'wp': 'WeaponsAndItemSpriteSheet.png', 'ts': 'TilesetSpriteSheet.png'}.items()}


def cell(sheet, row, col, keep_bg=False):
    im = sheets[sheet].crop((col * 16, row * 16, col * 16 + 16, row * 16 + 16)).copy()
    if keep_bg:
        return im
    px = im.load()
    stack = [(x, y) for x in range(16) for y in (0, 15)] + [(x, y) for y in range(16) for x in (0, 15)]
    seen = set()
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < 16 and 0 <= y < 16):
            continue
        seen.add((x, y))
        r, g, b, a = px[x, y]
        if a == 0 or (abs(r - BG[0]) < 6 and abs(g - BG[1]) < 6 and abs(b - BG[2]) < 6):
            px[x, y] = (0, 0, 0, 0)
            stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return im


frames = {}
# heroes: character sheet rows (row 0 is the title). cols 1..4 are a walk cycle, col 5 is down.
HEROES = {'wanderer': 1, 'ranger': 9, 'wizard': 8, 'brute': 4}
for k, r in HEROES.items():
    for f in range(4):
        frames[f'h_{k}_{f}'] = cell('chr', r, 1 + f)
    frames[f'h_{k}_face'] = cell('chr', r, 0, keep_bg=True)
    frames[f'h_{k}_dead'] = cell('chr', r, 5)
# monsters
ENEMIES = {'bat': 5, 'rat': 4, 'slime': 10, 'snake': 1, 'skeleton': 11, 'zombie': 12, 'orc': 6,
           'mummy': 7, 'vampire': 8, 'hound': 2, 'crab': 3, 'goblin': 9, 'brute': 13, 'devil': 14}
for k, r in ENEMIES.items():
    for f in range(4):
        frames[f'e_{k}_{f}'] = cell('en', r, 1 + f)
# weapons and items
ITEMS = {
    'knife': (1, 0), 'shield': (9, 7), 'boomerang': (11, 6), 'bomb': (11, 8), 'book': (5, 3),
    'staff': (11, 5), 'orb': (6, 0), 'boots': (6, 6), 'heart': (11, 7), 'horseshoe': (13, 3),
    'ring': (4, 6), 'amulet': (3, 7), 'sword': (1, 3), 'gem': (12, 6), 'coin': (13, 6),
    'chest': (15, 6), 'skull': (15, 8), 'meat': (12, 7), 'potion': (10, 7), 'axe': (10, 4),
    'bigsword': (2, 5), 'goldshield': (9, 8),
}
for k, (r, c) in ITEMS.items():
    frames[f'i_{k}'] = cell('wp', r, c)
# scenery
DECOR = {'tree1': (18, 1), 'tree2': (19, 3), 'tree3': (18, 2), 'bush': (19, 4), 'grave1': (2, 4),
         'grave2': (3, 4), 'cross': (2, 3), 'deadtree': (20, 1), 'pine': (20, 4), 'pine2': (20, 3)}
for k, (r, c) in DECOR.items():
    frames[f'd_{k}'] = cell('ts', r, c)
# floor: 8x8 tiles of 16 = 128x128, mostly plain night ground with speckles
FLOOR_TILES = [cell('ts', 29, c, keep_bg=True) for c in (0, 1, 3, 4, 5)] + [cell('ts', 30, c, keep_bg=True) for c in (1, 2, 4)]
rng = random.Random(7)
floor = Image.new('RGBA', (128, 128), (28, 22, 24, 255))
for y in range(8):
    for x in range(8):
        if rng.random() < 0.14:
            t = rng.choice(FLOOR_TILES).copy()
            # lift the black of the tile to the night colour so the field isn't pitch black
            px = t.load()
            for i in range(16):
                for j in range(16):
                    r, g, b, a = px[i, j]
                    if r < 10 and g < 10 and b < 10:
                        px[i, j] = (28, 22, 24, 255)
                    else:  # and fade the speckles so they don't fight the sprites
                        px[i, j] = ((r + 28 * 2) // 3, (g + 22 * 2) // 3, (b + 24 * 2) // 3, 255)
            floor.alpha_composite(t, (x * 16, y * 16))

# pack: 17px pitch grid (16 + 1 gap), floor at the bottom
names = list(frames)
cols = 16
rows = (len(names) + cols - 1) // cols
W, H = cols * 17, rows * 17 + 128
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
out = {}
for i, n in enumerate(names):
    x, y = (i % cols) * 17, (i // cols) * 17
    atlas.alpha_composite(frames[n], (x, y))
    out[n] = [x, y, 16, 16]
atlas.alpha_composite(floor, (0, rows * 17))
out['floor'] = [0, rows * 17, 128, 128]
os.makedirs(OUT, exist_ok=True)
atlas.save(os.path.join(OUT, 'survivors.png'))
with open(os.path.join(OUT, 'survivors.json'), 'w') as f:
    json.dump(out, f, separators=(',', ':'))

# thumbnail: hero in a ring of monsters on night ground
th = Image.new('RGBA', (32, 32), (28, 22, 24, 255))
th.alpha_composite(frames['e_bat_0'].resize((12, 12), Image.NEAREST), (0, 1))
th.alpha_composite(frames['e_skeleton_0'].resize((12, 12), Image.NEAREST), (20, 0))
th.alpha_composite(frames['e_slime_0'].resize((12, 12), Image.NEAREST), (0, 20))
th.alpha_composite(frames['e_zombie_0'].resize((12, 12), Image.NEAREST), (20, 20))
th.alpha_composite(frames['h_wanderer_0'], (8, 8))
th.save(THUMB)
print('atlas', W, H, len(out), 'frames')
