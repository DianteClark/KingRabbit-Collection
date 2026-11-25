# Builds Hearth Valley's single texture atlas from the LAS packs by Aleksandr Makarov
# (iknowkingrabbit) plus a few small sprites drawn here to match (soil, crops, tools, animals,
# fish, farm objects). Run from the repo root:  python3 games/hearth-valley/tools/pack.py
# Writes games/hearth-valley/assets/atlas.png and games/hearth-valley/frames.js.
import colorsys
import json
import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
LAS = os.path.join(ROOT, 'shared/assets/las-zelda-adventure/LAS-Adventure-Pack-1.0')
LAB = os.path.join(ROOT, 'shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02')
OUT = os.path.join(ROOT, 'games/hearth-valley')

tiles = Image.open(os.path.join(LAS, 'Tileset/Tileset.png')).convert('RGBA')
items = Image.open(os.path.join(LAS, 'Item/Items.png')).convert('RGBA')
ingr = Image.open(os.path.join(LAB, 'Item/Ingredients.png')).convert('RGBA')
npcs = Image.open(os.path.join(LAS, 'NPC/AllNPC.png')).convert('RGBA')

frames = {}  # name -> Image


def crop(img, x, y, w=16, h=16):
    return img.crop((x, y, x + w, y + h))


def add(name, im):
    frames[name] = im


# ---------------------------------------------------------------- palette for drawn sprites
PAL = {
    'k': (28, 22, 24), 'w': (249, 245, 239), 'g': (150, 144, 134), 'd': (90, 84, 80), 'b': (138, 90, 52),
    'B': (90, 58, 34), 't': (216, 176, 128), 'n': (240, 224, 192), 'o': (216, 128, 56), 'O': (168, 90, 32),
    'r': (200, 60, 60), 'R': (122, 32, 32), 'y': (227, 210, 69), 'Y': (176, 138, 26), 'G': (108, 184, 60),
    'D': (58, 122, 44), 'l': (168, 224, 96), 'u': (74, 138, 224), 'U': (42, 74, 154), 'c': (138, 216, 240),
    'p': (138, 74, 192), 'P': (90, 42, 128), 's': (240, 176, 160), 'm': (196, 160, 112), 'h': (232, 200, 96),
    'e': (110, 72, 44), 'E': (70, 46, 30), 'x': (255, 255, 255),
}


def draw(rows, pal=None, w=16, h=16, bottom=False):
    pal = {**PAL, **(pal or {})}
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    oy = h - len(rows) if bottom else (h - len(rows)) // 2
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '.' or ch == ' ':
                continue
            c = pal[ch]
            im.putpixel((x, y + oy), (*c, 255))
    return im


def drawb(rows, pal=None, w=16, h=16):
    return draw(rows, pal, w, h, bottom=True)


# ---------------------------------------------------------------- terrain
GRASS = crop(tiles, 16, 32)
GRASS2 = crop(tiles, 64, 32)
GRASS3 = crop(tiles, 32, 112)
WATER = crop(tiles, 16, 176)
WATER2 = crop(tiles, 208, 160)


def recolor(im, season):
    """Seasonal recolour of greens (0 spring, 1 summer, 2 fall, 3 winter)."""
    if season == 0:
        return im.copy()
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if not (0.17 < h < 0.48 and s > 0.2):
                continue
            if season == 1:
                h, l, s = h + 0.02, l * 0.85, min(1, s * 1.05)
            elif season == 2:
                h, l, s = 0.115 + (h - 0.3) * 0.25, l * 0.92, s * 0.62
            else:
                h, l, s = 0.58, min(0.95, 0.62 + l * 0.35), 0.25
            rr, gg, bb = colorsys.hls_to_rgb(h % 1, max(0, min(1, l)), max(0, min(1, s)))
            px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), a)
    return out


for s in range(4):
    add(f'grass{s}', recolor(GRASS, s))
    add(f'grassb{s}', recolor(GRASS2, s))
    add(f'grassc{s}', recolor(GRASS3, s))
    add(f'tree{s}', recolor(crop(tiles, 256, 0, 32, 32), s))       # big tree (2x2)
    add(f'bush{s}', recolor(crop(tiles, 256, 32), s))               # small tree you can chop
    add(f'forest{s}', recolor(crop(tiles, 288, 0), s))              # dense woods border
    add(f'tall{s}', recolor(crop(tiles, 272, 32), s))               # tall grass -> hay
    add(f'weed{s}', recolor(crop(tiles, 272, 48), s))               # weeds -> fiber
    add(f'weedb{s}', recolor(crop(tiles, 304, 48), s))
add('water0', WATER)
add('water1', WATER2)
add('rock', crop(tiles, 240, 16))
add('flowers', crop(tiles, 224, 0))
add('sign', crop(tiles, 208, 32))
add('chest', crop(tiles, 208, 16))
add('chestOpen', crop(tiles, 224, 16))
add('caveDoor', crop(tiles, 0, 64))
add('stairs', crop(tiles, 64, 64))
add('ladderUp', crop(tiles, 48, 64))
add('cliff', crop(tiles, 0, 128))
add('cliffb', crop(tiles, 16, 128))
add('mineFloor', crop(tiles, 48, 688))
add('mineFloorb', crop(tiles, 16, 688))
add('sand', crop(tiles, 32, 80))

# path and soil, drawn
def noise_tile(base, specks, seed):
    im = Image.new('RGBA', (16, 16), (*base, 255))
    v = seed
    for i in range(18):
        v = (v * 1103515245 + 12345) & 0x7fffffff
        x, y = v % 16, (v // 16) % 16
        im.putpixel((x, y), (*specks[i % len(specks)], 255))
    return im


add('path', noise_tile((214, 186, 134), [(190, 160, 110), (232, 210, 166)], 7))
add('plaza', noise_tile((196, 186, 170), [(170, 160, 146), (222, 214, 200)], 3))


def soil(wet):
    base = (110, 72, 44) if not wet else (74, 48, 32)
    line = (90, 58, 34) if not wet else (52, 34, 24)
    hi = (140, 96, 60) if not wet else (96, 64, 44)
    im = Image.new('RGBA', (16, 16), (*base, 255))
    for y in (3, 8, 13):
        for x in range(1, 15):
            im.putpixel((x, y), (*line, 255))
            im.putpixel((x, y - 1), (*hi, 255))
    for x in range(16):
        im.putpixel((x, 0), (*line, 255)); im.putpixel((x, 15), (*line, 255))
    for y in range(16):
        im.putpixel((0, y), (*line, 255)); im.putpixel((15, y), (*line, 255))
    return im


add('soil', soil(False))
add('soilWet', soil(True))

add('fenceH', draw([
    '................',
    '................',
    '................',
    '..kk........kk..',
    '.kbbk......kbbk.',
    'kkbbkkkkkkkkbbkk',
    'ttbbttttttttbbtt',
    'bbbbbbbbbbbbbbbb',
    'kkbbkkkkkkkkbbkk',
    'ttbbttttttttbbtt',
    'bbbbbbbbbbbbbbbb',
    'kkBBkkkkkkkkBBkk',
    '.kBBk......kBBk.',
    '.kBBk......kBBk.',
    '..kk........kk..',
    '................',
]))
add('fenceV', draw([
    '......kk........',
    '.....kbbk.......',
    '.....kbbk.......',
    '.....ktbk.......',
    '.....kbbk.......',
    '.....kbbk.......',
    '.....kbbk.......',
    '.....ktbk.......',
    '.....kbbk.......',
    '.....kbbk.......',
    '.....kbbk.......',
    '.....ktbk.......',
    '.....kBBk.......',
    '.....kBBk.......',
    '.....kBBk.......',
    '......kk........',
]))

# ---------------------------------------------------------------- characters
for d in ('Down', 'Up', 'Left', 'Right'):
    for act in ('Walk', 'Idle', 'Hit'):
        sheet = Image.open(os.path.join(LAS, f'Character/Unarmed/{act}/U-Char-{act}-{d}.png')).convert('RGBA')
        for i in range(4):
            add(f'p{act}{d}{i}', sheet.crop((i * 32 + 8, 8, i * 32 + 24, 24)))
show = Image.open(os.path.join(LAS, 'Character/Unarmed/Single-Animation/ShowItem/U-Char-ShowItem-Down.png')).convert('RGBA')
add('pShow', show.crop((32 + 8, 8, 32 + 24, 24)))
defeat = Image.open(os.path.join(LAS, 'Character/Unarmed/Single-Animation/Defeat/U-Char-Defeat-Down.png')).convert('RGBA')
add('pDefeat', defeat.crop((96 + 8, 8, 96 + 24, 24)))
for r in range(6):
    for c in range(4):
        add(f'npc{r}_{c}', crop(npcs, c * 16, r * 16))
for color in ('Green', 'Blue', 'Red'):
    for act in ('Idle', 'Hit', 'Death'):
        sheet = Image.open(os.path.join(LAS, f'Enemy/Slimes/{color}Slime/{color}Slime{act}.png')).convert('RGBA')
        for i in range(4):
            add(f'slime{color}{act}{i}', crop(sheet, i * 16, 0))

# animals (drawn)
CHICKEN = [
    '................',
    '................',
    '................',
    '.........rr.....',
    '........krrk....',
    '........kwwkk...',
    '.......kwkwwyk..',
    '.......kwwwwk...',
    '..k...kwwwwk....',
    '.kwkkkwwwwwk....',
    '.kwwwwwwwwwk....',
    '.kwwwnwwwwwk....',
    '..kwwnnwwwk.....',
    '...kwwwwwk......',
    '....kykyk.......',
    '....yk.yk.......',
]
CHICKEN2 = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..k.............',
    '.kwkkkkkk.rr....',
    '.kwwwwwwwkrrk...',
    '.kwwwnwwwwwwkk..',
    '.kwwwnnwwwkwyk..',
    '..kwwwwwwwwwk...',
    '...kwwwwwwkk....',
    '....kykyk.......',
    '....yk.yk.......',
]
add('chicken0', drawb(CHICKEN))
add('chicken1', drawb(CHICKEN2))
add('chickenB0', drawb(CHICKEN, {'w': (196, 140, 80), 'n': (150, 100, 56)}))
add('chickenB1', drawb(CHICKEN2, {'w': (196, 140, 80), 'n': (150, 100, 56)}))
COW = [
    '................',
    '................',
    '................',
    '..kk.......kk...',
    '.kwnk.....kwkk..',
    '.kkkkkkkkkkwwwk.',
    'kwwkkwwwwwkwkwk.',
    'kwkkkwwwkkwwwwk.',
    'kwwkwwwkkkkwssk.',
    'kwwwwwwwwwwkssk.',
    '.kwwwkkwwwwwkkk.',
    '.kwwkkkwwwwwk...',
    '.kwwwwwwswwwk...',
    '.kwkkkkkkkkwk...',
    '.kwk.....kwkk...',
    '.kkk.....kkk....',
]
COW2 = [r for r in COW]
COW2[13] = '.kwkkkkkkkkwk...'
COW2[14] = '..kwk....kwk....'
COW2[15] = '..kkk....kkk....'
add('cow0', draw(COW))
add('cow1', draw(COW2))
add('cowB0', draw(COW, {'w': (176, 120, 72), 'k': (60, 36, 24)}))
add('cowB1', draw(COW2, {'w': (176, 120, 72), 'k': (60, 36, 24)}))

# ---------------------------------------------------------------- crop icons (drawn)
CROPS = {
    'radish': ([
        '......D.D.......',
        '.....DGDGD......',
        '......DGD.......',
        '.......D........',
        '.....kkkkk......',
        '....krrrrrk.....',
        '...krrwrrrrk....',
        '...krrrrrrrk....',
        '...krrrrrrrk....',
        '....krrrrrk.....',
        '.....krrrk......',
        '......kwk.......',
        '.......k........',
    ], (200, 60, 60)),
    'potato': ([
        '.....kkkkk......',
        '...kkttttnkk....',
        '..kttntttttnk...',
        '..ktttttbtttk...',
        '.kttbttttttttk..',
        '.ktttttttnttbk..',
        '.kttttttttttk...',
        '..ktttbtttttk...',
        '...kkttttkkk....',
        '.....kkkk.......',
    ], (216, 176, 128)),
    'cabbage': ([
        '.....kkkkk......',
        '...kkllGllkk....',
        '..klGllGllGlk...',
        '.klllGlllGlllk..',
        '.kGlllllllllGk..',
        '.klGlllGlllGlk..',
        '.kDlllGlllllDk..',
        '..kDGlllllGDk...',
        '...kkDDDDDkk....',
        '.....kkkkk......',
    ], (168, 224, 96)),
    'strawberry': ([
        '.....D.D.D......',
        '......DDD.......',
        '.....kkkkk......',
        '....krrwrrk.....',
        '...krrrrryrk....',
        '...kryrrrrrk....',
        '...krrrryrrk....',
        '....kryrrrk.....',
        '.....krrrk......',
        '......kkk.......',
    ], (200, 60, 60)),
    'tomato': ([
        '......DDD.......',
        '.....D.D.D......',
        '...kkkkkkkkk....',
        '..krrrwrrrrrk...',
        '.krrwrrrrrrrrk..',
        '.krrrrrrrrrrrk..',
        '.krrrrrrrrrRrk..',
        '.krrrrrrrrRRrk..',
        '..krrrrrrRRrk...',
        '...kkkkkkkkk....',
    ], (220, 70, 50)),
    'melon': ([
        '....kkkkkkk.....',
        '..kkGlGlGlGkk...',
        '.kGlGlGlGlGlGk..',
        'kGlGlGlGlGlGlGk.',
        'kGlGlGlGlGlGlGk.',
        'kDlGlGlGlGlGlDk.',
        'kDGlGlGlGlGlGDk.',
        '.kDGlGlGlGlGDk..',
        '..kkDDDDDDDkk...',
        '....kkkkkkk.....',
    ], (108, 184, 60)),
    'blueberry': ([
        '......D.........',
        '.....DGD........',
        '...kkk.kkk......',
        '..kuuuk.kuukk...',
        '..kucuukuucuuk..',
        '..kuuukkkuuuuk..',
        '...kkkuuukkkk...',
        '....kucuuuk.....',
        '....kuuuuuk.....',
        '.....kkkkk......',
    ], (74, 138, 224)),
    'pumpkin': ([
        '.......DD.......',
        '.......kD.......',
        '..kkkkkkkkkkk...',
        '.kooOoooOoooOk..',
        'kooOoyooOoooOok.',
        'kooOooooOoooOok.',
        'kooOooooOoooOok.',
        'kOoOooooOoooOOk.',
        '.kOOoooOOoooOk..',
        '..kkkkkkkkkkk...',
    ], (216, 128, 56)),
    'yam': ([
        '...........kk...',
        '.........kkppk..',
        '.......kkpppPk..',
        '.....kkppspppk..',
        '...kkppppppPk...',
        '..kppppsppPk....',
        '.kpppppppPk.....',
        '.kPpppPPkk......',
        '..kkkkk.........',
    ], (138, 74, 192)),
    'cranberry': ([
        '....kkk..kkk....',
        '...krrwk.krwrk..',
        '...krrRkkkrRRk..',
        '....kkkrrwkkk...',
        '..kkk.krRRk.....',
        '.krwrk.kkk.kkk..',
        '.krRRk....krwrk.',
        '..kkk.....kRRRk.',
        '...........kkk..',
    ], (170, 40, 50)),
}
for cid, (rows, _c) in CROPS.items():
    add(f'i_{cid}', draw(rows))
CROP_COLOR = {cid: c for cid, (_r, c) in CROPS.items()}
# from the Alchemist Lab ingredients sheet (16x16, [col,row])
ING = {
    'corn': (1, 0), 'wheat': (7, 2), 'stone': (2, 0), 'morel': (0, 1), 'leek': (4, 0), 'salmonberry': (4, 1),
    'daffodil': (0, 5), 'sunbloom': (1, 5), 'hazelnut': (3, 0), 'blackberry': (3, 4), 'snowroot': (0, 3),
    'holly': (2, 5), 'clover': (1, 4), 'diamond': (1, 2), 'ruby': (5, 2), 'jade': (4, 2), 'slime': (3, 2),
    'fiber': (2, 1), 'snowdrop': (5, 3), 'feather': (7, 4),
}
for k, (c, r) in ING.items():
    add(f'i_{k}', crop(ingr, c * 16, r * 16))
CROP_COLOR['corn'] = (227, 210, 69)
CROP_COLOR['wheat'] = (232, 200, 96)
# LAS adventure items
IT = {'sword': (3, 0), 'aquamarine': (4, 0), 'snack': (7, 0), 'apple': (4, 3), 'sack': (7, 3), 'book': (5, 0),
      'scroll': (2, 2), 'bell': (3, 3), 'crown': (7, 2), 'chestIcon': (6, 2), 'map': (6, 0), 'lantern': (3, 4)}
for k, (c, r) in IT.items():
    add(f'i_{k}', crop(items, c * 16, r * 16))

# crop growth stages (drawn over soil)
add('cropSeed', draw([
    '................', '................', '................', '................', '................',
    '................', '.....t....t.....', '.......t........', '...t.......t....', '.......t..t.....',
    '....t...........', '................', '................', '................', '................', '................',
]))
add('cropSprout', drawb([
    '......DD.DD.....',
    '.......DGD......',
    '........G.......',
    '........G.......',
    '................',
    '................',
]))
add('cropYoung', drawb([
    '...DD.....DD....',
    '..DGGD...DGGD...',
    '...DGGD.DGGD....',
    '....DDGDGDD.....',
    '......DGD.......',
    '.......G........',
    '.......G........',
    '................',
    '................',
]))
LEAVES = [
    '.DD..........DD.',
    'DGlD..DD....DlGD',
    'DGGlDDlGD..DlGGD',
    '.DGGlDGlGDDlGGD.',
    '..DDGlDGlDGlDD..',
    '....DDGGGGDD....',
    '......DGGD......',
    '.......GG.......',
    '................',
    '................',
]
add('cropGrown', drawb(LEAVES))
add('cropTall', draw([
    '.......DD.......', '......DGlD......', '.....DGlGD......', '..DD..DGD..DD...', '.DGlD.DGD.DlGD..',
    '..DGlDDGDDlGD...', '...DDGDGDGDD....', '.DD..DGGGD..DD..', 'DGlD..DGD..DlGD.', '.DGlDDDGDDDlGD..',
    '..DDGGDGDGGDD...', '....DDGGGDD.....', '......DGD.......', '.......G........', '................', '................',
]))
add('cropDead', drawb([
    '................', '...BB.....BB....', '..BbbB...BbbB...', '...BbbB.BbbB....', '....BBbBbBB.....',
    '......BbB.......', '.......b........', '.......b........', '................', '................',
]))

# ---------------------------------------------------------------- tools
add('t_hoe', draw([
    '................',
    '..........kkkk..',
    '.........kggggk.',
    '........kkgddgk.',
    '.......kbk.kkk..',
    '......kbk.......',
    '.....kbk........',
    '....kbk.........',
    '...kbk..........',
    '..kbk...........',
    '.kbk............',
    '.kk.............',
]))
add('t_can', draw([
    '................',
    '.....kkkkk......',
    '....kk...kk.....',
    '...kk.....kk....',
    '..kkkkkkkkkk..k.',
    '.kuuuuuuuuuk.kck',
    'kkucuuuuuuuukkck',
    'k.kuuuuuuuuuuuk.',
    'k.kuuuuuuuuuuk..',
    '.kkuuuuuuuuuk...',
    '...kUUUUUUUUk...',
    '...kkkkkkkkkk...',
]))
add('t_axe', draw([
    '................',
    '.......kkk......',
    '......kgggkk....',
    '.....kggwggk....',
    '.....kgggkbk....',
    '......kkkbk.....',
    '........kbk.....',
    '.......kbk......',
    '......kbk.......',
    '.....kbk........',
    '....kbk.........',
    '...kbk..........',
    '...kk...........',
]))
add('t_pick', draw([
    '................',
    '...kkkkkkk......',
    '..kgggggggkk....',
    '.kggkkkkbggk....',
    '.kgk...kbkkgk...',
    '.kk...kbk..kk...',
    '.....kbk........',
    '....kbk.........',
    '...kbk..........',
    '..kbk...........',
    '.kbk............',
    '.kk.............',
]))
add('t_rod', draw([
    '............kk..',
    '...........kbk..',
    '..........kbk.w.',
    '.........kbk..w.',
    '........kbk...w.',
    '.......kbk....w.',
    '......kbk.....w.',
    '.....kbk......w.',
    '....kkk......krk',
    '...krrk......kwk',
    '..kbkk........k.',
    '.kbk............',
    '.kk.............',
]))

# ---------------------------------------------------------------- products and goods
add('i_egg', draw([
    '......kkk.......',
    '.....kwwwk......',
    '....kwwwwwk.....',
    '...kwxwwwwnk....',
    '...kwxwwwwnk....',
    '...kwwwwwwnk....',
    '...kwwwwwnnk....',
    '....knnnnnk.....',
    '.....kkkkk......',
]))
add('i_brownegg', draw([
    '......kkk.......',
    '.....kooOk......',
    '....koooooO.....',
    '...kotoooOOk....',
    '...kotooooOk....',
    '...koooooOOk....',
    '...kooooOOOk....',
    '....kOOOOOk.....',
    '.....kkkkk......',
], {'O': (168, 100, 50)}))
add('i_milk', draw([
    '.....kkkkk......',
    '.....kuuuk......',
    '.....kwwwk......',
    '....kwwwwwk.....',
    '...kwxwwwwwk....',
    '...kwxwwwwwk....',
    '...kwwuuuwwk....',
    '...kwwuwuwwk....',
    '...kwwuuuwwk....',
    '...kwwwwwwnk....',
    '...kwwwwwwnk....',
    '....kkkkkkk.....',
]))
add('i_cheese', draw([
    '................',
    '.......kkkk.....',
    '.....kkyyyyk....',
    '...kkyyyyyyyk...',
    '..kyyyyyyyyyk...',
    '..kkkkkkkkkhk...',
    '..khyyYyyyyhk...',
    '..khyyyyyYyhk...',
    '..khyYyyyyyhk...',
    '..kkkkkkkkkkk...',
]))
add('i_mayo', draw([
    '.....kkkkk......',
    '.....kooook.....',
    '....kkkkkkk.....',
    '....kwwwwwk.....',
    '...kwxwwwwwk....',
    '...kwxwyywwk....',
    '...kwwyyyywk....',
    '...kwwwyywwk....',
    '...kwwwwwwnk....',
    '....kkkkkkk.....',
]))
add('i_wood', draw([
    '................',
    '..kkkkkkkkkk....',
    '.kbbbbbbbbbbk...',
    'ktnbbBbbbbBbbk..',
    'kntkbbbbbbbbbk..',
    'kttkBbbbbBbbbk..',
    '.kkkkkkkkkkkk...',
    '..kkkkkkkkkkkk..',
    '.kbbbbbbbbbbbbk.',
    'ktnbbbBbbbbbBbk.',
    'kntkbbbbbbbbbbk.',
    'kttkbbbBbbbbbbk.',
    '.kkkkkkkkkkkkk..',
]))
add('i_hay', draw([
    '................',
    '...kkkkkkkkk....',
    '..khhyhhyhhyk...',
    '.khyhhyhhyhhyk..',
    '.kYYYYYYYYYYYk..',
    '.khhyhhyhhyhhk..',
    '.khyhhyhhyhhyk..',
    '.kYYYYYYYYYYYk..',
    '.khhyhhyhhyhhk..',
    '..kkkkkkkkkkk...',
]))
ORE = [
    '................',
    '.....kkkkk......',
    '...kkgggggkk....',
    '..kgg1gggg1gk...',
    '.kgggg11ggggdk..',
    '.kg1gggggg1gdk..',
    '.kgggg1ggggddk..',
    '.kdg11gggg1ddk..',
    '..kddgggddddk...',
    '...kkkkkkkkk....',
]
add('i_copperore', draw(ORE, {'1': (216, 128, 56)}))
add('i_ironore', draw(ORE, {'1': (230, 230, 240)}))
add('i_goldore', draw(ORE, {'1': (240, 214, 60)}))
BAR = [
    '................',
    '................',
    '....kkkkkkkk....',
    '...k22222222k...',
    '..k2x2222222k...',
    '.kkkkkkkkkk2k...',
    '.k1111111111k...',
    '.k1x11111111k...',
    '.k1111111111k...',
    '.kkkkkkkkkkkk...',
]
add('i_copperbar', draw(BAR, {'1': (200, 110, 50), '2': (232, 150, 80)}))
add('i_ironbar', draw(BAR, {'1': (170, 172, 184), '2': (214, 216, 226)}))
add('i_goldbar', draw(BAR, {'1': (220, 180, 40), '2': (250, 226, 100)}))
add('i_bait', draw([
    '................',
    '..........kkk...',
    '.........kssskk.',
    '........kssk.ksk',
    '...kkk.kssk...k.',
    '..kssskssk......',
    '.ksskssssk......',
    '.ksk.kkkk.......',
    '..k.............',
]))
add('i_compost', draw([
    '......kkkk......',
    '.....kttttk.....',
    '......kbbk......',
    '....kkttttkk....',
    '...kttttttttk...',
    '..kttkkkkkkttk..',
    '..ktkGDGGDGktk..',
    '..ktkDGGDGDktk..',
    '..ktkkkkkkkktk..',
    '..kttttttttttk..',
    '...kkkkkkkkkk...',
]))
SPRINK = [
    '.......k........',
    '......kck.......',
    '.....kc1ck......',
    '....kk111kk.....',
    '...k1k111k1k....',
    '..kc11k1k11ck...',
    '...k1k111k1k....',
    '....kk111kk.....',
    '.....k111k......',
    '...kkk111kkk....',
    '..k222222222k...',
    '..kkkkkkkkkkk...',
]
add('o_sprinkler', drawb(SPRINK, {'1': (200, 110, 50), '2': (140, 80, 40)}))
add('o_qsprinkler', drawb(SPRINK, {'1': (220, 180, 40), '2': (170, 172, 184)}))
add('o_furnace', drawb([
    '.....kkkkkk.....',
    '....kggggggk....',
    '...kggdggdggk...',
    '..kgdggggggdgk..',
    '..kggkkkkkkggk..',
    '..kgkoyyyyokgk..',
    '..kgkyoyoyykgk..',
    '..kgkkoooookgk..',
    '..kgkkkkkkkkgk..',
    '..kdggdggdggdk..',
    '..kkkkkkkkkkkk..',
]))
add('o_furnaceOff', drawb([
    '.....kkkkkk.....',
    '....kggggggk....',
    '...kggdggdggk...',
    '..kgdggggggdgk..',
    '..kggkkkkkkggk..',
    '..kgkdddddkkgk..',
    '..kgkkdddddkgk..',
    '..kgkkdddddkgk..',
    '..kgkkkkkkkkgk..',
    '..kdggdggdggdk..',
    '..kkkkkkkkkkkk..',
]))
add('o_mayojar', drawb([
    '....kkkkkkkk....',
    '...kbbbbbbbbk...',
    '...kkkkkkkkkk...',
    '...kcxcccccck...',
    '..kcxcwwwwwcck..',
    '..kcxwwyywwcck..',
    '..kccwyyyywcck..',
    '..kccwwyywwcck..',
    '..kcccwwwwccck..',
    '..kcccccccccck..',
    '...kkkkkkkkkk...',
]))
add('o_press', drawb([
    '.......kk.......',
    '......kggk......',
    '..kkkkkggkkkkk..',
    '..kbbbbbbbbbbk..',
    '..kkkkkggkkkkk..',
    '...kb..gg..bk...',
    '...kb.kkkk.bk...',
    '...kbkyyyykbk...',
    '...kbkyYyykbk...',
    '..kkkkkkkkkkkk..',
    '..kbbbbbbbbbbk..',
    '..kkkkkkkkkkkk..',
]))
add('o_stair', draw([
    '................',
    '..kkkkkkkkkkk...',
    '..kbbbbbbbbbk...',
    '..kkkkkkkkkkk...',
    '...kttttttttk...',
    '...kkkkkkkkkk...',
    '....kbbbbbbbk...',
    '....kkkkkkkkk...',
    '.....kttttttk...',
    '.....kkkkkkkk...',
]))
FISH_A = [
    '................',
    '................',
    '.......kkk......',
    '.....kk111kk..k.',
    '....k1111111kk1k',
    '...k1wk111111k1k',
    '...k1kk1111111k.',
    '...k111111111k1k',
    '....k2222222kk1k',
    '.....kk2222k..k.',
    '.......kkk......',
]
FISH_B = [
    '................',
    '..........kk....',
    '..kkkkkkkk11k...',
    '.k11111111111kkk',
    'k1wk1111111111kk',
    'k1kk11111111k11k',
    '.k2222222222kkkk',
    '..kkkkkkkkkk....',
]
FISH_C = [
    '.......kk.......',
    '......k11k......',
    '....kk1111kk....',
    '...k11111111k.k.',
    '..k1wk1111111k1k',
    '..k1kk11111111kk',
    '..k1111111111k1k',
    '...k22222222k.k.',
    '....kk2222kk....',
    '......k11k......',
    '.......kk.......',
]
FISH = {
    'perch': (FISH_A, (120, 160, 80), (220, 220, 150)),
    'carp': (FISH_A, (140, 120, 80), (210, 190, 140)),
    'sunfish': (FISH_C, (230, 180, 60), (240, 120, 60)),
    'trout': (FISH_B, (150, 150, 200), (230, 140, 170)),
    'dace': (FISH_B, (200, 210, 220), (240, 240, 250)),
    'pike': (FISH_B, (90, 140, 90), (200, 220, 160)),
    'bass': (FISH_A, (80, 120, 70), (190, 210, 160)),
    'eel': (FISH_B, (70, 60, 90), (130, 120, 160)),
    'koi': (FISH_C, (240, 140, 60), (249, 245, 239)),
    'icepip': (FISH_C, (150, 210, 240), (240, 250, 255)),
    'whiskers': (FISH_A, (100, 90, 70), (230, 200, 90)),
}
for fid, (rows, c1, c2) in FISH.items():
    add(f'i_{fid}', draw(rows, {'1': c1, '2': c2}))

# seed packets
PACKET = [
    '...kkkkkkkkkk...',
    '...kwwwwwwwwk...',
    '...kkkkkkkkkk...',
    '...knnnnnnnnk...',
    '...kn111111nk...',
    '...kn1x1111nk...',
    '...kn111111nk...',
    '...kn111111nk...',
    '...knnnnnnnnk...',
    '...knnBnBnnnk...',
    '...knnnnnnnnk...',
    '...kkkkkkkkkk...',
]
for cid, col in CROP_COLOR.items():
    add(f's_{cid}', draw(PACKET, {'1': col}))

# ---------------------------------------------------------------- farm and town objects
add('o_bin', drawb([
    '................',
    '.kkkkkkkkkkkkkk.',
    'kbbbbbbbbbbbbbbk',
    'kttttttttttttttk',
    'kkkkkkkkkkkkkkkk',
    'kbBbbBbbbBbbBbbk',
    'kbBbbBbbbBbbBbbk',
    'kbBbbBbyybbbBbbk',
    'kbBbbBbyybbbBbbk',
    'kbBbbBbbbBbbBbbk',
    'kbBbbBbbbBbbBbbk',
    'kkkkkkkkkkkkkkkk',
    '.kBk........kBk.',
    '..k..........k..',
]))
MAILBOX = [
    '................',
    '...kkkkkkkk.....',
    '..kuuuuuuuuk.k..',
    '.kuuuuuuuuuukrk.',
    '.kuucccccuuukrk.',
    '.kuuuuuuuuuuk1k.',
    '.kUUUUUUUUUUk1k.',
    '..kkkkkkkkkk.k..',
    '......kbk.......',
    '......kbk.......',
    '......kbk.......',
    '......kbk.......',
    '.....kbbbk......',
    '.....kkkkk......',
]
add('o_mailbox', drawb(MAILBOX, {'1': (200, 60, 60)}))
mb2 = [r for r in MAILBOX]
mb2[1] = '...kkkkkkkk.kk..'
mb2[2] = '..kuuuuuuuukrrk.'
mb2[3] = '.kuuuuuuuuuukrk.'
add('o_mailboxNew', drawb(mb2, {'1': (200, 60, 60)}))
add('o_board', drawb([
    'kkkkkkkkkkkkkkkk',
    'kbbbbbbbbbbbbbbk',
    'kbwwwkbwwwwkbbbk',
    'kbwkwkbwkkwkwwwk',
    'kbwwwkbwwwwkwkwk',
    'kbwkwkbwkkwkwwwk',
    'kbwwwkbwwwwkwkwk',
    'kbkkkkbkkkkkwwwk',
    'kbbbbbbbbbbbkkkk',
    'kkkkkkkkkkkkkkkk',
    '..kbk......kbk..',
    '..kbk......kbk..',
    '..kbk......kbk..',
    '..kkk......kkk..',
]))
TROUGH = [
    '................',
    '................',
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    'kbbbbbbbbbbbbbbk',
    'kb111111111111bk',
    'kb111111111111bk',
    'kkkkkkkkkkkkkkkk',
    'kbBbbbbbbbbbBbbk',
    'kkkkkkkkkkkkkkkk',
    '.kk..........kk.',
]
add('o_trough', drawb(TROUGH, {'1': (60, 40, 30)}))
add('o_troughFull', drawb(TROUGH, {'1': (232, 200, 96)}))
add('o_twig', draw([
    '................', '................', '................', '................', '................',
    '................', '.........k......', '....kk..kbk.....', '...kbbkkbk......', '....kkbbbkkk....',
    '......kbbbbbk...', '.....kbkkkkk....', '......k.........', '................', '................', '................',
]))
add('o_stump', draw([
    '................', '................', '................', '................', '................',
    '....kkkkkkkk....', '...ktttttttk....', '..kttbbbbtttk...', '..ktbtttbtttk...', '..kttbbbbtttk...',
    '..kbtttttttbk...', '..kbbbbbbbbbk...', '.kbBbbBbbBbbbk..', 'kbbkbbkbbkbbkbk.', '.kk.kk.kk.kk.kk.', '................',
]))
add('o_egghunt', draw([
    '................', '................', '................', '................', '................', '................',
    '......kkk.......', '.....kpppk......', '....kpyypyk.....', '...kppppppk.....', '...kyypyypk.....',
    '...kppppppk.....', '....kpppk.......', '.....kkk........', '................', '................',
]))
add('o_lantern', drawb([
    '.......k........', '......kkk.......', '.....kyyyk......', '....kyhhhyk.....', '....kyhxhyk.....',
    '....kyhhhyk.....', '....kyyyyyk.....', '.....kkkkk......', '.......k........', '.......k........',
    '.......k........', '.......k........', '......kkk.......',
]))
add('o_present', drawb([
    '................', '................', '.....k...k......', '....krk.krk.....', '.....krrrk......',
    '..kkkkkrkkkkk...', '..kuuuurruuuk...', '..kkkkkrkkkkk...', '...kuuurruuk....', '...kuuurruuk....',
    '...kuuurruuk....', '...kkkkkkkkk....',
]))
HEART = [
    '.kk.kk..',
    'k11k11k.',
    'k11111k.',
    'k11111k.',
    '.k111k..',
    '..k1k...',
    '...k....',
    '........',
]
add('heart', draw(HEART, {'1': (216, 64, 80)}, 8, 8))
add('heartEmpty', draw(HEART, {'1': (70, 60, 80)}, 8, 8))

# ---------------------------------------------------------------- buildings (from the LAS house tiles)
def house(color, door_variant=1):
    ci = {'green': 0, 'purple': 1, 'red': 2, 'blue': 3}[color]
    im = Image.new('RGBA', (80, 64), (0, 0, 0, 0))
    roof = tiles.crop((240, 464 + ci * 48, 320, 464 + ci * 48 + 48))
    im.alpha_composite(roof, (0, 0))
    door = tiles.crop((80 * door_variant, 656, 80 * door_variant + 80, 672))
    im.alpha_composite(door, (0, 48))
    return im


for c in ('green', 'purple', 'red', 'blue'):
    add(f'house_{c}', house(c))


def hall(ruined):
    # A wider building: the house widened to 7 tiles by repeating its middle columns.
    base = house('blue')
    im = Image.new('RGBA', (112, 64), (0, 0, 0, 0))
    im.alpha_composite(base.crop((0, 0, 32, 64)), (0, 0))
    im.alpha_composite(base.crop((16, 0, 64, 64)), (32, 0))
    im.alpha_composite(base.crop((48, 0, 80, 64)), (80, 0))
    # fix the door row: windows either side of a central door
    row = tiles.crop((80, 656, 160, 672))
    im.alpha_composite(row.crop((0, 0, 16, 16)), (0, 48))
    im.alpha_composite(row.crop((16, 0, 32, 16)), (16, 48))
    im.alpha_composite(row.crop((16, 0, 32, 16)), (32, 48))
    im.alpha_composite(row.crop((32, 0, 48, 16)), (48, 48))
    im.alpha_composite(row.crop((48, 0, 64, 16)), (64, 48))
    im.alpha_composite(row.crop((48, 0, 64, 16)), (80, 48))
    im.alpha_composite(row.crop((64, 0, 80, 16)), (96, 48))
    if ruined:
        px = im.load()
        for y in range(64):
            for x in range(112):
                r, g, b, a = px[x, y]
                if a:
                    gr = (r + g + b) // 3
                    px[x, y] = ((r + gr) // 2 - 20, (g + gr) // 2 - 22, (b + gr) // 2 - 26, a)
        # holes in the roof and boards over the windows
        for (hx, hy, hw, hh) in [(20, 14, 12, 7), (70, 22, 10, 6), (46, 8, 7, 5)]:
            for y in range(hy, hy + hh):
                for x in range(hx, hx + hw):
                    if (x - hx) * (hh) + (y - hy) * hw > 2 and (x + y) % 7:
                        px[x, y] = (28, 22, 24, 255)
        plank = (138, 90, 52, 255)
        for (bx, by) in [(18, 50), (82, 50)]:
            for x in range(bx, bx + 14):
                for dy in (0, 1, 2):
                    yy = by + dy + (x - bx) // 5
                    if yy < 64:
                        px[x, yy] = plank
    return im


add('hall', hall(False))
add('hallRuin', hall(True))

# ---------------------------------------------------------------- pack
names = list(frames.keys())
order = sorted(names, key=lambda n: (-frames[n].height, -frames[n].width, n))
W = 512
x = y = 0
row_h = 0
pos = {}
for n in order:
    im = frames[n]
    if x + im.width > W:
        x = 0
        y += row_h + 1
        row_h = 0
    pos[n] = (x, y, im.width, im.height)
    x += im.width + 1
    row_h = max(row_h, im.height)
H = y + row_h
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for n, (px_, py_, w, h) in pos.items():
    atlas.alpha_composite(frames[n], (px_, py_))
os.makedirs(os.path.join(OUT, 'assets'), exist_ok=True)
atlas.save(os.path.join(OUT, 'assets/atlas.png'), optimize=True)
with open(os.path.join(OUT, 'frames.js'), 'w') as f:
    f.write('// Generated by tools/pack.py: frame name -> [x, y, w, h] in assets/atlas.png. Do not edit.\n')
    f.write('export const FRAMES = ')
    f.write(json.dumps({n: list(pos[n]) for n in sorted(pos)}, separators=(',', ':')))
    f.write(';\n')
print('atlas', W, H, len(pos), 'frames')
