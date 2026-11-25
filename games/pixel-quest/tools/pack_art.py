# Builds games/pixel-quest/assets/atlas.png + atlas.json from Aleksandr Makarov's RAS Overworld
# sheets (16px tiles, characters, items) plus a few ground tiles painted here in the same palette.
# Run from the repo root:  python3 games/pixel-quest/tools/pack_art.py
# The game only loads the small packed atlas (and the Darkness Pack creature sheet, recoloured at
# runtime), never the full source sheets.
import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(ROOT, '..', '..', '..'))
RAS = os.path.join(REPO, 'shared/assets/mas-mini-retro/RAS-Overworld-v.1.0')
OUT = os.path.join(ROOT, '..', 'assets')

tiles = Image.open(os.path.join(RAS, 'TilesetSpriteSheet.png')).convert('RGBA')
anim = Image.open(os.path.join(RAS, '2FrameAnimTilesetSpriteSheet.png')).convert('RGBA')
chars = Image.open(os.path.join(RAS, 'CharactersSpriteSheet.png')).convert('RGBA')
items = Image.open(os.path.join(RAS, 'WeaponsAndItemSpriteSheet.png')).convert('RGBA')

INK = (4, 3, 3, 255)
OUTLINE = (28, 22, 24, 255)


def rgb(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def cell(sheet, c, r, w=1, h=1):
    return sheet.crop((c * 16, r * 16, (c + w) * 16, (r + h) * 16))


def is_black(p):
    return p[3] > 0 and p[0] < 10 and p[1] < 10 and p[2] < 10


def cut(img, outline=True):
    """Make the black background (black connected to the border) see-through, then outline."""
    img = img.copy()
    w, h = img.size
    px = img.load()
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    seen = set()
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or x < 0 or y < 0 or x >= w or y >= h:
            continue
        seen.add((x, y))
        if not is_black(px[x, y]) and px[x, y][3] != 0:
            continue
        px[x, y] = (0, 0, 0, 0)
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    if outline:
        add_outline(img)
    return img


def add_outline(img, color=OUTLINE):
    w, h = img.size
    px = img.load()
    src = img.copy().load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3]:
                    px[x, y] = color
                    break
    return img


def solid(color):
    return Image.new('RGBA', (16, 16), rgb(color))


def speckle(base, spots):
    img = solid(base)
    px = img.load()
    for x, y, c in spots:
        px[x, y] = rgb(c)
    return img


def over(base, top, dx=0, dy=0):
    out = base.copy()
    out.alpha_composite(top, (dx, dy))
    return out


# ----------------------------------------------------------------------------- ground tiles
G, GD, GL = '#6c8c50', '#4f6e3c', '#8fb062'
grass = speckle(G, [(2, 3, GD), (3, 3, GL), (10, 2, GD), (11, 2, GL), (6, 8, GD), (7, 8, GL), (13, 10, GD), (14, 10, GL), (3, 12, GD), (4, 12, GL), (9, 14, GD), (10, 14, GL)])
grass2 = grass.copy()
for x, y, c in [(4, 5, '#f9f5ef'), (3, 6, '#f9f5ef'), (5, 6, '#f9f5ef'), (4, 7, '#f9f5ef'), (4, 6, '#e3d245'),
                (11, 10, '#d88038'), (10, 11, '#d88038'), (12, 11, '#d88038'), (11, 12, '#d88038'), (11, 11, '#e3d245')]:
    grass2.putpixel((x, y), rgb(c))
S, SD = '#f0d472', '#d8a850'
sand = speckle(S, [(2, 2, SD), (9, 4, SD), (13, 1, SD), (5, 9, SD), (12, 11, SD), (2, 13, SD), (8, 14, SD), (6, 5, '#f9f5ef'), (14, 7, '#f9f5ef')])
W, WD = '#f9f5ef', '#c8cce8'
snow = speckle(W, [(3, 2, WD), (10, 3, WD), (6, 7, WD), (13, 8, WD), (2, 11, WD), (9, 12, WD), (14, 14, WD)])
R, RD = '#e3bf8f', '#c9a070'
road = speckle(R, [(2, 3, RD), (8, 2, RD), (12, 6, RD), (4, 9, RD), (10, 11, RD), (6, 14, RD), (14, 13, RD)])

waves = [cut(cell(anim, 0, 4), False), cut(cell(anim, 1, 4), False)]
water = [over(solid('#3b4178'), w) for w in waves]
dark_waves = [w.copy() for w in waves]
for w in dark_waves:
    px = w.load()
    for y in range(16):
        for x in range(16):
            if px[x, y][3]:
                px[x, y] = rgb('#6a4a88') if px[x, y][0] > 100 else rgb('#3a2850')
darkwater = [over(solid('#1c1426'), w) for w in dark_waves]
lava_cr = [cut(cell(anim, 0, 6), False), cut(cell(anim, 1, 6), False)]
lava = [over(solid('#a13d3b'), l) for l in lava_cr]
ice = speckle('#b8c8ec', [(2, 2, '#f9f5ef'), (3, 3, '#f9f5ef'), (10, 6, '#f9f5ef'), (11, 7, '#f9f5ef'), (5, 11, '#8a8fc4'), (13, 13, '#8a8fc4')])


def bridge(horizontal):
    img = water[0].copy()
    px = img.load()
    for a in range(16):
        for b in range(1, 15):
            x, y = (a, b) if horizontal else (b, a)
            plank = (a % 4 == 3)
            px[x, y] = rgb('#4e282e') if plank else rgb('#d88038')
            if b in (1, 14):
                px[x, y] = rgb('#4e282e')
    return img


bridgeH = bridge(True)
bridgeV = bridge(False)
broken = water[0].copy()
for x, y in [(0, 6), (1, 6), (2, 7), (1, 8), (0, 9), (14, 5), (15, 6), (13, 8), (15, 9), (14, 10)]:
    broken.putpixel((x, y), rgb('#d88038'))
    broken.putpixel((x, y + 1), rgb('#4e282e'))

wood = cell(tiles, 4, 26).copy()
carpet = solid('#a13d3b')
cp = carpet.load()
for i in range(16):
    for j in (1, 14):
        cp[i, j] = rgb('#e3d245')
        cp[j, i] = rgb('#e3d245')
    for j in (0, 15):
        cp[i, j] = rgb('#4e282e')
        cp[j, i] = rgb('#4e282e')

FRAMES = {}


def put(name, img):
    FRAMES[name] = img


for name, img in [('grass', grass), ('grass2', grass2), ('sand', sand), ('snow', snow), ('road', road),
                  ('water0', water[0]), ('water1', water[1]), ('dark0', darkwater[0]), ('dark1', darkwater[1]),
                  ('lava0', lava[0]), ('lava1', lava[1]), ('ice', ice), ('bridgeH', bridgeH), ('bridgeV', bridgeV),
                  ('broken', broken), ('wood', wood), ('carpet', carpet)]:
    put(name, img)

# Opaque wall and floor tiles straight from the tileset.
for name, (c, r) in {
    'wallY': (0, 26), 'wallR': (1, 26), 'wallB': (2, 26),
    'rockW': (0, 23), 'rockS': (1, 23), 'rockO': (2, 23), 'rockB': (3, 23), 'rockR': (4, 23),
    'doorY': (0, 28), 'doorR': (1, 28), 'doorB': (2, 28), 'gateD': (3, 28),
    'floorK': (0, 29), 'floorC': (3, 29), 'floorRing': (4, 29), 'floorB': (7, 30), 'floorR': (8, 30), 'floorRw': (2, 30),
    'floorS': (6, 29), 'magma': (3, 26), 'caveO': (0, 24), 'caveR': (1, 24), 'caveD': (2, 24),
}.items():
    put(name, cell(tiles, c, r))

# Overlays (see-through, outlined), drawn on top of a ground tile.
for name, (c, r) in {
    'tree': (4, 19), 'treeY': (1, 19), 'treeO': (2, 19), 'treeW': (0, 19), 'treeB': (3, 19),
    'pine': (4, 20), 'pineW': (2, 20), 'pineB': (3, 20), 'bushes': (1, 18), 'palm': (0, 18), 'dead': (3, 18), 'deadR': (4, 18),
    'bush': (4, 21), 'bushY': (1, 21), 'bushW': (0, 21),
    'mtnW': (0, 22), 'mtnS': (1, 22), 'mtnO': (2, 22), 'mtnB': (3, 22), 'mtnR': (4, 22),
    'cave': (0, 25), 'caveRed': (1, 25), 'caveBrown': (2, 25),
    'house': (1, 2), 'house2': (1, 3), 'houseB': (6, 2), 'tent': (7, 4),
    'sword': (0, 2), 'mound': (0, 3), 'cross': (3, 2), 'grave': (8, 2), 'tomb': (3, 3), 'bell': (5, 2),
    'banner': (5, 3), 'cactus': (6, 3), 'shrub': (7, 3), 'stairsU': (8, 3), 'altar': (6, 4), 'skull': (6, 5),
    'fence': (7, 5), 'bushG': (8, 5), 'table': (3, 1), 'sign': (4, 1), 'pot': (4, 28), 'potG': (5, 28),
    'ladder': (6, 28), 'bed': (7, 28), 'log': (8, 28), 'gateTop': (8, 4),
}.items():
    put(name, cut(cell(tiles, c, r)))

# 2-frame objects.
for name, row in {'chest': 11, 'lever': 12, 'plate': 13, 'orbDark': 14, 'portal': 16, 'orb': 17,
                  'fire': 18, 'brazier': 19, 'flame': 20, 'stars': 22, 'block': 23}.items():
    for k in range(2):
        put(f'{name}{k}', cut(cell(anim, k, row)))
# Unlit brazier: the bowl without its flame.
unlit = FRAMES['brazier0'].copy()
px = unlit.load()
for y in range(16):
    for x in range(16):
        p = px[x, y]
        if p[3] and p[0] > 150 and p[2] < 120:
            px[x, y] = (0, 0, 0, 0)
add_outline(unlit)
put('brazierOff', unlit)
# Barrier blocks: the raised one reads as a wall, the lowered one as a floor plate.
for k, (hexc, dark) in enumerate([('#a13d3b', '#4e282e'), ('#5b74d0', '#28305c')]):
    for up in (0, 1):
        b = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
        bp = b.load()
        if up:
            for y in range(1, 15):
                for x in range(1, 15):
                    bp[x, y] = rgb(hexc) if y < 11 else rgb(dark)
            for x in range(3, 13):
                bp[x, 3] = rgb('#f9f5ef')
        else:
            for y in range(9, 15):
                for x in range(2, 14):
                    bp[x, y] = rgb(dark)
            for x in range(4, 12):
                bp[x, 11] = rgb(hexc)
        add_outline(b)
        put(f'bar{"RB"[k]}{up}', b)
# Crystal switches (red / blue), painted to match the barriers.
for k, hexc in enumerate(['#a13d3b', '#5b74d0']):
    c = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    cpx = c.load()
    shape = ['......XX......', '.....XLLX.....', '....XLLDDX....', '...XLLDDDDX...', '...XLDDDDDX...',
             '....XDDDDX....', '.....XDDX.....', '......XX......']
    for y, row in enumerate(shape):
        for x, ch in enumerate(row):
            if ch == 'X':
                cpx[x + 1, y + 2] = rgb('#1c1618')
            elif ch == 'L':
                cpx[x + 1, y + 2] = rgb('#f9f5ef')
            elif ch == 'D':
                cpx[x + 1, y + 2] = rgb(hexc)
    for x in range(4, 12):
        cpx[x, 12] = rgb('#8a8fc4')
        cpx[x, 13] = rgb('#47416b')
    add_outline(c)
    put(f'crystal{"RB"[k]}', c)
# Locked door: a door with a gold lock plate.
for name in ('doorY', 'doorR', 'doorB'):
    d = FRAMES[name].copy()
    dp = d.load()
    for y in range(9, 14):
        for x in range(6, 10):
            dp[x, y] = rgb('#e3d245') if not (x == 7 and y in (10, 11)) else rgb('#1c1618')
    for y in range(7, 16):
        for x in range(3, 13):
            if dp[x, y][:3] == (4, 3, 3):
                dp[x, y] = rgb('#4e282e')
    put(name.replace('door', 'lock'), d)

# Big structures (transparent).
put('castle', cut(cell(tiles, 3, 12, 3, 2)))
put('palace', cut(cell(tiles, 0, 8, 3, 2)))
# The Wind Tower: a tall stone tower with a pennant, painted in the tileset's blues.
TOWER = [
    '.......F........',
    '.......FRR......',
    '.......FRRR.....',
    '.......F........',
    '..L.L.LFL.L.L...',
    '..LLLLLLLLLLL...',
    '..DDDDDDDDDDD...',
    '...LMMMMMMML....',
    '...LMLLLLLML....',
    '...LMLKKKLML....',
    '...LMLKKKLML....',
    '...LMLLLLLML....',
    '...LMMMMMMML....',
    '...LLMMMMMLL....',
    '...LMMMMMMML....',
    '...LMLLLLLML....',
    '...LMLKKKLML....',
    '...LMLKKKLML....',
    '...LMLLLLLML....',
    '...LMMMMMMML....',
    '...LMMMMMMML....',
    '...LLMMMMMLL....',
    '...LMMMMMMML....',
    '...LMMMMMMML....',
    '...LMMLLLMML....',
    '...LMLKKKLML....',
    '...LMLKKKLML....',
    '...LMLKKKLML....',
    '...LMLKKKLML....',
    '..DDDDDDDDDDD...',
    '................',
    '................',
]
COLS = {'L': '#8a8fc4', 'M': '#5b6aa8', 'D': '#47416b', 'K': '#1c1618', 'F': '#f9f5ef', 'R': '#d84848'}
tower = Image.new('RGBA', (16, 32), (0, 0, 0, 0))
for y, row in enumerate(TOWER):
    for x, ch in enumerate(row):
        if ch in COLS:
            tower.putpixel((x, y), rgb(COLS[ch]))
add_outline(tower)
put('tower', tower)
put('volcano', cut(cell(anim, 0, 7, 2, 2)))

# Characters: 11 rows. Columns: 0 portrait, 1 side, 2 side step, 3 attack, 4 alt, 5 down,
# 6 front, 7 front step, 8 back, 9 back step (front/back made by mirroring the side view).
SKIN = [(240, 212, 114), (249, 245, 239)]


def view_from(side, kind):
    w = 16
    sp = side.load()
    xs = [x for y in range(16) for x in range(16) if sp[x, y][3]]
    cx = (min(xs) + max(xs)) // 2
    out = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    op = out.load()
    for y in range(16):
        for x in range(16):
            sx = cx + (x - 7 if x >= 8 else 8 - x)
            if 0 <= sx < 16:
                op[x, y] = sp[sx, y]
    top = 0
    while top < 15 and not any(op[x, top][3] for x in range(16)):
        top += 1
    if kind == 'front':
        for y in range(top + 3, top + 6):
            for x in range(6, 10):
                op[x, y] = SKIN[0] + (255,)
        op[6, top + 4] = OUTLINE
        op[9, top + 4] = OUTLINE
    else:
        count = {}
        for y in range(7):
            for x in range(16):
                p = sp[x, y]
                if p[3] and p[:3] not in SKIN and p[:3] != (28, 22, 24):
                    count[p] = count.get(p, 0) + 1
        hair = max(count, key=count.get) if count else OUTLINE
        for y in range(9):
            for x in range(16):
                if op[x, y][3] and op[x, y][:3] in SKIN:
                    op[x, y] = hair
    return out


for r in range(11):
    row = r + 1
    put(f'c{r}_0', cell(chars, 0, row))
    sides = {}
    for col in range(1, 6):
        img = cut(cell(chars, col, row), outline=False)
        sides[col] = img
    for col, img in sides.items():
        put(f'c{r}_{col}', add_outline(img.copy()))
    for k, (src, kind) in enumerate([(1, 'front'), (2, 'front'), (1, 'back'), (2, 'back')]):
        put(f'c{r}_{6 + k}', add_outline(view_from(sides[src], kind)))

# Item icons [col, row] on the weapons sheet (row 0 is the title).
ITEMS = {
    'dagger': (3, 1), 'sword': (4, 2), 'blade': (5, 2), 'axe': (4, 3), 'hammer': (5, 10), 'club': (3, 10),
    'staff': (5, 11), 'wand': (4, 11), 'rod': (3, 11), 'bow': (5, 4), 'knife': (3, 2),
    'helm': (6, 1), 'helmW': (7, 1), 'helmG': (8, 1), 'armor': (6, 2), 'armorW': (7, 2), 'armorG': (8, 2),
    'amulet': (6, 3), 'amuletB': (7, 3), 'amuletG': (8, 3), 'ring': (6, 4), 'ringG': (7, 4), 'charm': (8, 4),
    'book': (3, 5), 'bookB': (4, 5), 'bookG': (5, 5), 'belt': (6, 5), 'beltB': (7, 5), 'beltG': (8, 5),
    'boots': (6, 6), 'bootsW': (7, 6), 'bootsG': (8, 6), 'glove': (6, 7), 'gloveW': (7, 7), 'gloveG': (8, 7),
    'cloak': (6, 8), 'cloakB': (7, 8), 'cloakG': (8, 8), 'shield': (6, 9), 'shieldB': (7, 9), 'shieldG': (8, 9),
    'key': (6, 10), 'potion': (7, 10), 'compass': (8, 10), 'boomerang': (6, 11), 'heart': (7, 11), 'bomb': (8, 11),
    'gem': (6, 12), 'meat': (7, 12), 'bone': (8, 12), 'coin': (6, 13), 'leaf': (7, 13), 'apple': (8, 13),
    'shovel': (6, 14), 'dynamite': (7, 14), 'lantern': (8, 14), 'chestI': (6, 15), 'bellI': (7, 15), 'skullI': (8, 15),
    'music': (0, 7), 'star': (0, 6), 'harp': (4, 7), 'lute': (3, 7), 'feather': (5, 8),
}
for name, (c, r) in ITEMS.items():
    put(f'i_{name}', cut(cell(items, c, r)))

# ----------------------------------------------------------------------------- pack
names = list(FRAMES.keys())
names.sort(key=lambda n: (-FRAMES[n].size[1], -FRAMES[n].size[0], n))
W = 256
x = y = row_h = 0
pos = {}
for n in names:
    w, h = FRAMES[n].size
    if x + w > W:
        x = 0
        y += row_h + 1
        row_h = 0
    pos[n] = (x, y, w, h)
    x += w + 1
    row_h = max(row_h, h)
H = y + row_h
sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for n, (x, y, w, h) in pos.items():
    sheet.alpha_composite(FRAMES[n], (x, y))
os.makedirs(OUT, exist_ok=True)
sheet.save(os.path.join(OUT, 'atlas.png'), optimize=True)
with open(os.path.join(OUT, 'atlas.json'), 'w') as f:
    json.dump({n: list(p) for n, p in sorted(pos.items())}, f, separators=(',', ':'))
print('atlas', W, H, len(pos), 'frames')
