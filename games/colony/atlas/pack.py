#!/usr/bin/env python3
"""Pack Colony's art into one small sheet (colony.png + colony.json).

Sources (Aleksandr Makarov, see shared/assets/LICENSE-ART.md):
  MASOverworld/Dawnbringer-16/MAS-Tileset-DB.png    terrain, trees, bushes, rock, crops (4 seasons)
  MASOverworld/Dawnbringer-16/MAS-Characters-DB.png animals
  MAS-Roguelike-v.1.01/CharactersSpriteSheet.png    settlers (black background keyed out, outlined)
  MAS-Roguelike-v.1.01/EnemySpriteSheet.png         goblin raiders and wolves
  MAS-Roguelike-v.1.01/RoguelikeAllSpriteSheet.png  fire
Buildings, items and markers are drawn here in the same Dawnbringer-16 colours.

Run from the repo root:  python3 games/colony/atlas/pack.py
"""
import json
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', '..')
MAS = os.path.join(ROOT, 'shared/assets/mas-mini-retro')
OUT = os.path.dirname(__file__)

C = {
    'ink': (20, 12, 28), 'plum': (68, 36, 52), 'navy': (48, 52, 109), 'grey': (78, 74, 78),
    'brown': (133, 76, 48), 'green': (52, 101, 36), 'red': (208, 70, 72), 'stone': (117, 113, 97),
    'blue': (89, 125, 206), 'orange': (210, 125, 44), 'steel': (133, 149, 161), 'grass': (109, 170, 44),
    'skin': (210, 170, 153), 'cyan': (109, 194, 202), 'yellow': (218, 212, 94), 'white': (222, 238, 214),
}

tiles = Image.open(f'{MAS}/MASOverworld/Dawnbringer-16/MAS-Tileset-DB.png').convert('RGBA')
owchars = Image.open(f'{MAS}/MASOverworld/Dawnbringer-16/MAS-Characters-DB.png').convert('RGBA')
rlchars = Image.open(f'{MAS}/MAS-Roguelike-v.1.01/CharactersSpriteSheet.png').convert('RGBA')
rlenemy = Image.open(f'{MAS}/MAS-Roguelike-v.1.01/EnemySpriteSheet.png').convert('RGBA')
rlall = Image.open(f'{MAS}/MAS-Roguelike-v.1.01/RoguelikeAllSpriteSheet.png').convert('RGBA')

SEASONS = {'sp': 0, 'su': 0, 'fa': 48, 'wi': 32}  # column offsets (spring reuses summer, with more flowers)
COLS = 32
cells = []  # (name, Image 8x8)


def add(name, im):
    cells.append((name, im))


def tile(c, r, off=0):
    return tiles.crop(((c + off) * 8, r * 8, (c + off) * 8 + 8, r * 8 + 8))


def blank(col=None):
    return Image.new('RGBA', (8, 8), (*col, 255) if col else (0, 0, 0, 0))


def px(im, pts, col):
    for x, y in pts:
        if 0 <= x < 8 and 0 <= y < 8:
            im.putpixel((x, y), (*C[col], 255))


def rect(im, x, y, w, h, col):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if 0 <= xx < 8 and 0 <= yy < 8:
                im.putpixel((xx, yy), (*C[col], 255))


def keyed(src, x, y, outline=True):
    """Cut an 8x8 cell from a black-background sheet, make the black see-through, add an outline."""
    im = src.crop((x, y, x + 8, y + 8)).copy()
    data = im.load()
    for yy in range(8):
        for xx in range(8):
            r, g, b, a = data[xx, yy]
            if r < 12 and g < 12 and b < 12:
                data[xx, yy] = (0, 0, 0, 0)
    if outline:
        solid = [[data[xx, yy][3] > 0 for xx in range(8)] for yy in range(8)]
        for yy in range(8):
            for xx in range(8):
                if solid[yy][xx]:
                    continue
                if any(0 <= xx + dx < 8 and 0 <= yy + dy < 8 and solid[yy + dy][xx + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    data[xx, yy] = (*C['ink'], 255)
    return im


# ---------------------------------------------------------------- terrain (per season)
for s, off in SEASONS.items():
    g = tile(1, 1, off)
    add(f'{s}:g0', g)
    add(f'{s}:g1', tile(4, 1, off))
    add(f'{s}:g2', tile(5, 1, off))
    add(f'{s}:g3', tile(2, 1, off) if s in ('sp', 'su') else tile(4, 1, off))
    add(f'{s}:g4', tile(3, 1, off) if s == 'sp' else g)
    add(f'{s}:tree0', tile(0, 8, off))
    add(f'{s}:tree1', tile(6, 8, off))
    bush = tile(0, 9, off)
    add(f'{s}:bush', bush)
    bb = bush.copy()
    if s != 'wi':
        px(bb, [(2, 3), (5, 2), (4, 5)], 'red')
    add(f'{s}:bushB', bb)
    herb = g.copy()
    px(herb, [(3, 3), (3, 4), (2, 5), (4, 5), (3, 5), (5, 2), (5, 3)], 'green')
    px(herb, [(3, 2), (5, 1)], 'white' if s != 'wi' else 'steel')
    add(f'{s}:herb', herb)
    rock = tile(1, 15, off)
    add(f'{s}:rock', rock)
    ore = rock.copy()
    px(ore, [(1, 2), (2, 2), (5, 5), (6, 5), (4, 1), (2, 6)], 'yellow')
    px(ore, [(2, 3), (6, 6)], 'orange')
    add(f'{s}:ore', ore)
    add(f'{s}:dirt', tile(1, 1, off) if s == 'wi' else tile(4, 24, off))  # snow covers bare earth
    # water with shore edges: mask bits 1 = N water, 2 = E, 4 = S, 8 = W
    base = tile(0, 2, off)
    for m in range(16):
        w = base.copy()
        edge = 'white' if s != 'wi' else 'steel'
        if not m & 1:
            rect(w, 0, 0, 8, 1, edge)
        if not m & 4:
            rect(w, 0, 7, 8, 1, 'navy')
        if not m & 8:
            rect(w, 0, 0, 1, 8, edge)
        if not m & 2:
            rect(w, 7, 0, 1, 8, edge)
        if m == 15 and s != 'wi':
            px(w, [(2, 3), (3, 3)], 'white')
        add(f'{s}:w{m}', w)

# crops (season independent; drawn on tilled soil)
soil = blank(C['brown'])
for y in (1, 4, 7):
    rect(soil, 0, y, 8, 1, 'plum')
add('soil', soil)
sprout = soil.copy()
px(sprout, [(1, 0), (5, 0), (3, 3), (7, 3), (1, 6), (5, 6)], 'grass')
add('crop0', sprout)
grow = soil.copy()
for x in (1, 5):
    for y in (0, 3, 6):
        px(grow, [(x, y), (x + 1, y), (x, y - 1)], 'grass')
        px(grow, [(x + 1, y - 1)], 'green')
add('crop1', grow)
ripe = tiles.crop((2 * 8, 27 * 8, 3 * 8, 28 * 8))
add('crop2', ripe)
dead = soil.copy()
px(dead, [(1, 0), (5, 0), (3, 3), (7, 3), (1, 6), (5, 6)], 'stone')
add('crop3', dead)

# ---------------------------------------------------------------- buildings
for kind, (face, dark, light) in {'wall': ('brown', 'plum', 'orange'), 'swall': ('stone', 'grey', 'steel')}.items():
    for m in range(16):
        im = blank(C[face])
        if kind == 'wall':
            for y in (2, 5):
                rect(im, 0, y, 8, 1, dark)
        else:
            rect(im, 0, 3, 8, 1, dark)
            px(im, [(3, 0), (3, 1), (3, 2), (6, 4), (6, 5), (6, 6)], dark)
        rect(im, 0, 0, 8, 1, light) if not m & 1 else None
        if not m & 4:
            rect(im, 0, 7, 8, 1, 'ink')
        if not m & 8:
            rect(im, 0, 0, 1, 8, 'ink')
        if not m & 2:
            rect(im, 7, 0, 1, 8, 'ink')
        add(f'{kind}{m}', im)

door = blank(C['orange'])
rect(door, 0, 0, 8, 8, 'brown')
rect(door, 1, 1, 6, 6, 'orange')
rect(door, 1, 3, 6, 1, 'brown')
px(door, [(5, 4)], 'yellow')
add('door', door)

bed = blank()
rect(bed, 1, 0, 6, 8, 'ink')
rect(bed, 2, 1, 4, 6, 'blue')
rect(bed, 2, 1, 4, 2, 'white')
rect(bed, 2, 4, 4, 1, 'navy')
add('bed', bed)

camp = blank()
rect(camp, 1, 5, 6, 2, 'brown')
px(camp, [(0, 6), (7, 6), (2, 7), (5, 7)], 'plum')
px(camp, [(1, 4), (6, 4), (0, 7), (7, 7)], 'stone')
add('campfire', camp)
ashes = camp.copy()
px(ashes, [(3, 4), (4, 4), (3, 5), (4, 5)], 'grey')
add('campfireOut', ashes)

stove = blank()
rect(stove, 0, 1, 8, 7, 'ink')
rect(stove, 1, 2, 6, 5, 'stone')
rect(stove, 2, 4, 4, 2, 'ink')
px(stove, [(2, 2), (5, 2)], 'steel')
add('stove', stove)
stoveLit = stove.copy()
px(stoveLit, [(2, 5), (3, 4), (4, 5), (5, 4)], 'orange')
px(stoveLit, [(3, 5), (4, 4)], 'yellow')
add('stoveLit', stoveLit)

bench = blank()
rect(bench, 0, 2, 8, 4, 'ink')
rect(bench, 1, 3, 6, 2, 'orange')
rect(bench, 1, 6, 1, 2, 'brown')
rect(bench, 6, 6, 1, 2, 'brown')
px(bench, [(2, 2), (3, 2), (5, 1), (5, 2)], 'steel')
add('workbench', bench)

crate = blank()
rect(crate, 0, 1, 8, 7, 'ink')
rect(crate, 1, 2, 6, 5, 'orange')
rect(crate, 1, 4, 6, 1, 'brown')
px(crate, [(1, 2), (6, 2), (1, 6), (6, 6)], 'brown')
add('storage', crate)

radio = blank()
rect(radio, 0, 3, 8, 5, 'ink')
rect(radio, 1, 4, 6, 3, 'steel')
px(radio, [(2, 5), (3, 5)], 'red')
px(radio, [(5, 5)], 'yellow')
rect(radio, 6, 0, 1, 3, 'grey')
px(radio, [(5, 0), (7, 0)], 'grey')
add('radio', radio)
radioOn = radio.copy()
px(radioOn, [(2, 5), (3, 5)], 'grass')
px(radioOn, [(6, 0)], 'yellow')
add('radioOn', radioOn)

frame = blank()
for x in range(0, 8, 2):
    px(frame, [(x, 0), (x, 7), (0, x), (7, x)], 'yellow')
px(frame, [(i, i) for i in range(8)], 'orange')
add('frame', frame)

# ---------------------------------------------------------------- items
def item(name, draw):
    im = blank()
    draw(im)
    add(f'i:{name}', im)


item('wood', lambda im: (rect(im, 1, 2, 6, 2, 'brown'), rect(im, 1, 4, 6, 2, 'brown'), px(im, [(1, 2), (1, 4)], 'orange'), px(im, [(6, 3), (6, 5)], 'plum'), rect(im, 0, 6, 8, 1, 'ink')))
item('stone', lambda im: (rect(im, 1, 3, 6, 4, 'stone'), rect(im, 2, 2, 4, 1, 'steel'), px(im, [(2, 4), (5, 5)], 'grey'), rect(im, 1, 7, 6, 1, 'ink')))
item('metal', lambda im: (rect(im, 1, 3, 6, 3, 'steel'), rect(im, 2, 2, 4, 1, 'white'), rect(im, 1, 6, 6, 1, 'grey'), rect(im, 1, 7, 6, 1, 'ink')))
item('berries', lambda im: (px(im, [(2, 3), (4, 2), (5, 4), (3, 5), (2, 5)], 'red'), px(im, [(3, 3), (4, 4), (2, 4)], 'red'), px(im, [(4, 1), (5, 1)], 'green')))
item('meat', lambda im: (rect(im, 1, 2, 5, 4, 'red'), rect(im, 2, 3, 3, 2, 'skin'), rect(im, 5, 5, 2, 1, 'white'), px(im, [(7, 4), (7, 6)], 'white')))
item('crop', lambda im: (rect(im, 3, 1, 2, 6, 'yellow'), px(im, [(3, 2), (4, 4), (3, 5)], 'orange'), px(im, [(2, 5), (5, 4), (2, 6), (5, 5), (4, 7)], 'green')))
item('meal', lambda im: (rect(im, 1, 4, 6, 3, 'white'), rect(im, 2, 3, 4, 1, 'orange'), px(im, [(3, 2), (4, 2)], 'red'), rect(im, 2, 7, 4, 1, 'steel')))
item('herbs', lambda im: (px(im, [(3, 6), (3, 5), (2, 4), (4, 4), (3, 3), (5, 3), (1, 3), (4, 2)], 'grass'), px(im, [(3, 7), (2, 6)], 'green'), px(im, [(4, 1), (1, 2)], 'white')))
item('medicine', lambda im: (rect(im, 1, 2, 6, 5, 'white'), rect(im, 3, 3, 2, 3, 'red'), rect(im, 2, 4, 4, 1, 'red'), rect(im, 1, 7, 6, 1, 'ink')))
item('leather', lambda im: (rect(im, 1, 2, 6, 4, 'orange'), px(im, [(0, 2), (7, 2), (0, 5), (7, 5), (3, 6), (4, 6)], 'orange'), px(im, [(2, 3), (5, 4)], 'brown')))
item('tools', lambda im: (px(im, [(1, 6), (2, 5), (3, 4), (4, 3)], 'brown'), rect(im, 3, 1, 4, 1, 'steel'), px(im, [(5, 2), (6, 2), (2, 2), (7, 2)], 'steel')))
item('spear', lambda im: (px(im, [(1, 7), (2, 6), (3, 5), (4, 4), (5, 3)], 'brown'), px(im, [(6, 2), (7, 1), (6, 1), (7, 0), (5, 2)], 'white')))
item('bow', lambda im: (px(im, [(5, 0), (6, 1), (6, 2), (6, 3), (6, 4), (6, 5), (5, 6), (4, 7)], 'brown'), px(im, [(4, 0), (3, 1), (2, 2), (1, 3), (1, 4), (2, 5), (3, 6)], 'white')))
item('club', lambda im: (px(im, [(1, 7), (2, 6), (3, 5)], 'brown'), rect(im, 4, 2, 3, 3, 'brown'), px(im, [(5, 1), (7, 3)], 'plum')))
item('parka', lambda im: (rect(im, 2, 1, 4, 6, 'blue'), rect(im, 1, 2, 1, 4, 'blue'), rect(im, 6, 2, 1, 4, 'blue'), rect(im, 2, 1, 4, 1, 'white'), px(im, [(4, 3), (4, 5)], 'yellow')))

# ---------------------------------------------------------------- order markers (drawn small, top-right of the tile)
def mark(name, draw):
    im = blank()
    draw(im)
    add(f'm:{name}', im)


mark('chop', lambda im: (rect(im, 1, 1, 6, 6, 'ink'), px(im, [(2, 5), (3, 4), (4, 3)], 'orange'), rect(im, 4, 2, 2, 2, 'white')))
mark('mine', lambda im: (rect(im, 1, 1, 6, 6, 'ink'), px(im, [(2, 5), (3, 4), (4, 3)], 'orange'), px(im, [(3, 2), (4, 2), (5, 3), (5, 4)], 'steel')))
mark('harvest', lambda im: (rect(im, 1, 1, 6, 6, 'ink'), rect(im, 2, 3, 4, 3, 'grass'), px(im, [(3, 2), (4, 2)], 'grass')))
mark('hunt', lambda im: (rect(im, 1, 1, 6, 6, 'ink'), rect(im, 2, 2, 4, 4, 'red'), rect(im, 3, 3, 2, 2, 'ink')))
mark('stuck', lambda im: (rect(im, 1, 1, 6, 6, 'ink'), rect(im, 3, 2, 2, 3, 'yellow'), rect(im, 3, 6, 2, 1, 'yellow')))
mark('zz', lambda im: (rect(im, 1, 1, 6, 6, 'ink'), rect(im, 2, 2, 4, 1, 'cyan'), px(im, [(4, 3), (3, 4)], 'cyan'), rect(im, 2, 5, 4, 1, 'cyan')))
mark('sick', lambda im: (rect(im, 1, 1, 6, 6, 'ink'), rect(im, 2, 2, 4, 4, 'grass'), px(im, [(3, 3), (4, 4)], 'ink')))
mark('heart', lambda im: (px(im, [(1, 2), (2, 1), (3, 2), (4, 2), (5, 1), (6, 2)], 'red'), rect(im, 1, 3, 6, 1, 'red'), rect(im, 2, 4, 4, 1, 'red'), rect(im, 3, 5, 2, 1, 'red')))
mark('alert', lambda im: (rect(im, 1, 1, 6, 6, 'ink'), rect(im, 3, 2, 2, 2, 'red'), rect(im, 3, 5, 2, 1, 'red')))

# ---------------------------------------------------------------- creatures
for r in range(1, 16):
    add(f'c{r}:p', keyed(rlchars, 0, r * 8, outline=False))
    for f in range(4):
        add(f'c{r}:{f}', keyed(rlchars, (f + 1) * 8, r * 8))
    add(f'c{r}:x', keyed(rlchars, 40, r * 8))
for r in (6, 9, 12, 13, 14):
    add(f'e{r}:p', keyed(rlenemy, 0, r * 8, outline=False))
    for f in range(4):
        add(f'e{r}:{f}', keyed(rlenemy, (f + 1) * 8, r * 8))
    add(f'e{r}:x', keyed(rlenemy, 40, r * 8))
for i, name in enumerate(['duck', 'hen', 'goose', 'sheep', 'boar', 'fox']):
    add(f'a:{name}', owchars.crop((i * 8, 32, i * 8 + 8, 40)))
for f in range(2):
    add(f'fire{f}', keyed(rlall, 72 + f * 8, 160))

rows = (len(cells) + COLS - 1) // COLS
sheet = Image.new('RGBA', (COLS * 8, rows * 8), (0, 0, 0, 0))
frames = {}
for i, (name, im) in enumerate(cells):
    x, y = (i % COLS) * 8, (i // COLS) * 8
    sheet.paste(im, (x, y))
    frames[name] = [x, y]
sheet.save(os.path.join(OUT, 'colony.png'), optimize=True)
with open(os.path.join(OUT, 'colony.json'), 'w') as f:
    json.dump(frames, f, separators=(',', ':'))
print(f'{len(cells)} cells, {sheet.size[0]}x{sheet.size[1]}')
