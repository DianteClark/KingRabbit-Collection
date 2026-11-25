#!/usr/bin/env python3
"""Build games/racers/atlas/racers.png + racers.json, and the launcher thumbnail.

Race cars are drawn here as small top-down pixel sprites (the packs' cars are 3/4 views in four
directions only), then pre-rotated to 16 headings with a RotSprite-style method (Scale2x three
times, nearest-neighbour rotation, sample back down) so they stay crisp. Their body colours are
key colours that the game swaps at load time for the garage paint jobs.

Scenery comes from Aleksandr Makarov's packs: BAS Town buildings and parked cars, Tiny Tile Town
trees and ground decorations. Run from the repo root:  python3 games/racers/tools/build_atlas.py
"""
import json
import math
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
BAS = os.path.join(ROOT, 'shared/assets/modern-city/BAS-Town-v.1.0')
TTT = os.path.join(ROOT, 'shared/assets/modern-city/TinyTileTown-v.1.0')
OUT = os.path.join(ROOT, 'games/racers/atlas')

INK = (20, 12, 28, 255)
K1 = (255, 0, 255, 255)    # body light  (swapped at runtime)
K2 = (200, 0, 200, 255)    # body mid
K3 = (140, 0, 140, 255)    # body dark
GLASS = (109, 194, 202, 255)
GLASS2 = (48, 52, 109, 255)
LIGHT = (240, 246, 230, 255)
TAIL = (208, 70, 72, 255)
STRIPE = (222, 238, 214, 255)
METAL = (133, 149, 161, 255)
SEAT = (68, 36, 52, 255)


def car_sprite(L, W, cabin, *, stripe=0, spoiler=False, nose=0, open_top=False, scoop=False, wheels=(2, None)):
    """Top-down car facing right. Returns an RGBA image (L+2) x (W+2) incl. tyres."""
    im = Image.new('RGBA', (L + 2, W + 2), (0, 0, 0, 0))
    px = im.load()
    ox, oy = 1, 1
    # tyres sticking out a pixel each side
    wf = wheels[1] if wheels[1] is not None else L - 4
    for wx in (wheels[0], wheels[0] + 1, wf, wf + 1):
        px[ox + wx, 0] = INK
        px[ox + wx, W + 1] = INK

    def inside(x, y):
        # rounded corners, optional pointed nose
        if (x in (0, L - 1)) and (y in (0, W - 1)):
            return False
        if nose and x >= L - nose and (y < (x - (L - nose)) + 1 or y > W - 2 - (x - (L - nose))):
            return False
        return 0 <= x < L and 0 <= y < W

    for y in range(W):
        for x in range(L):
            if not inside(x, y):
                continue
            edge = not (inside(x - 1, y) and inside(x + 1, y) and inside(x, y - 1) and inside(x, y + 1))
            if edge:
                c = INK
            elif y == 1:
                c = K1
            elif y == W - 2:
                c = K3
            else:
                c = K2
            px[ox + x, oy + y] = c
    c0, c1 = cabin
    for y in range(2, W - 2):
        for x in range(c0, c1 + 1):
            if open_top:
                c = SEAT if c0 < x < c1 else K3
            elif x == c0:
                c = GLASS2                        # rear window
            elif x >= c1 - 1:
                c = GLASS if x == c1 - 1 else GLASS2   # windscreen
            else:
                c = K1 if y < W // 2 else K2      # roof, lit on one side
            px[ox + x, oy + y] = c
    if open_top:
        for y in range(1, W - 1):
            px[ox + c0 + 1, oy + y] = METAL       # roll bar
    if stripe:
        mid = [W // 2 - 1, W // 2] if W % 2 == 0 else [W // 2]
        rows = mid if stripe == 1 else [W // 2 - 2, W // 2 + 1] if W % 2 == 0 else [W // 2 - 1, W // 2 + 1]
        for y in rows:
            for x in range(1, L - 1):
                if px[ox + x, oy + y] in (K1, K2, K3) and not (c0 <= x <= c1):
                    px[ox + x, oy + y] = STRIPE
    if scoop:
        for y in (W // 2 - 1, W // 2):
            px[ox + c1 + 2, oy + y] = INK
    # lights
    for y in (1, W - 2):
        fx = L - 2 - (nose - 1 if nose else 0)
        if px[ox + fx, oy + y][3]:
            px[ox + fx, oy + y] = LIGHT
        px[ox + 1, oy + y] = TAIL
    if spoiler:
        for y in range(0, W):
            px[ox + 0, oy + y] = INK
        px[ox, oy - 1] = INK
        px[ox, oy + W] = INK
    return im


MODELS = {
    'hatch': dict(L=14, W=8, cabin=(4, 9)),
    'buggy': dict(L=13, W=9, cabin=(3, 8), open_top=True, wheels=(1, 9)),
    'coupe': dict(L=16, W=8, cabin=(5, 10), stripe=1),
    'muscle': dict(L=16, W=9, cabin=(5, 10), stripe=2, scoop=True),
    'rally': dict(L=15, W=8, cabin=(4, 10), stripe=1, spoiler=True),
    'gold': dict(L=16, W=8, cabin=(5, 10), stripe=1, spoiler=True, nose=2),
}


# ------------------------------------------------------------------ RotSprite-ish rotation

def scale2x(im):
    w, h = im.size
    src = im.load()
    out = Image.new('RGBA', (w * 2, h * 2))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            P = src[x, y]
            A = src[x, y - 1] if y > 0 else P
            B = src[x + 1, y] if x < w - 1 else P
            C = src[x - 1, y] if x > 0 else P
            D = src[x, y + 1] if y < h - 1 else P
            e0 = C if (C == A and C != D and A != B) else P
            e1 = B if (A == B and A != C and B != D) else P
            e2 = C if (D == C and D != B and C != A) else P
            e3 = B if (B == D and B != A and D != C) else P
            dst[2 * x, 2 * y] = e0
            dst[2 * x + 1, 2 * y] = e1
            dst[2 * x, 2 * y + 1] = e2
            dst[2 * x + 1, 2 * y + 1] = e3
    return out


def rotsprite(im, deg, size):
    big = scale2x(scale2x(scale2x(im)))
    S = size * 8
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    canvas.paste(big, ((S - big.width) // 2, (S - big.height) // 2))
    rot = canvas.rotate(-deg, resample=Image.NEAREST)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    rp = rot.load()
    op = out.load()
    for y in range(size):
        for x in range(size):
            op[x, y] = rp[x * 8 + 4, y * 8 + 4]
    return out


# ------------------------------------------------------------------ packing

def crop_alpha(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def pack(items, width=512):
    items = sorted(items, key=lambda kv: (-kv[1].height, -kv[1].width))
    x = y = row_h = 0
    placed = {}
    for name, im in items:
        if x + im.width > width:
            x = 0
            y += row_h + 1
            row_h = 0
        placed[name] = (x, y, im)
        x += im.width + 1
        row_h = max(row_h, im.height)
    H = y + row_h
    sheet = Image.new('RGBA', (width, H), (0, 0, 0, 0))
    frames = {}
    for name, (px, py, im) in placed.items():
        sheet.paste(im, (px, py))
        frames[name] = [px, py, im.width, im.height]
    return sheet, frames


def main():
    items = []
    # race cars: 16 headings each, all in 20x20 cells (centre = car centre)
    previews = []
    for mid, spec in MODELS.items():
        base = car_sprite(spec['L'], spec['W'], spec['cabin'], **{k: v for k, v in spec.items() if k not in ('L', 'W', 'cabin')})
        previews.append(base)
        for a in range(16):
            items.append((f'car:{mid}:{a}', rotsprite(base, a * 22.5, 20)))

    # BAS Town buildings
    sys.path.insert(0, os.path.join(ROOT, 'games/city-chief/logic'))
    groups = {
        'Commercial': [f'C{i}' for i in range(6, 27)],
        'Residental': [f'R{i}' for i in list(range(1, 34)) + list(range(71, 82)) + list(range(102, 108))],
        'Industry': [f'I{i}' for i in range(1, 21)],
        'Transport': ['BusStopD', 'BusStopU', 'GasStation1', 'GasStation2'],
        'Water': ['TankReservoir', 'WaterTower', 'WaterPumping'],
        'Electriciry': ['WindTurbine', 'SolarPowerPlant'],
        'Education': ['Library', 'Kindergarden'],
    }
    for folder, names in groups.items():
        for n in names:
            p = os.path.join(BAS, 'Buildings', folder, n + '.png')
            if os.path.exists(p):
                items.append((f'b:{n}', Image.open(p).convert('RGBA')))
    # BAS parked cars (four directions)
    for n in [f'SmallCar{i}' for i in range(1, 14)] + [f'BigCar{i}' for i in range(1, 16)]:
        for d in 'LRUD':
            p = os.path.join(BAS, 'Cars/Separate', f'{n}-{d}.png')
            items.append((f'p:{n}-{d}', Image.open(p).convert('RGBA')))
    # Tiny Tile Town trees (the single ones in the first column)
    trees = Image.open(os.path.join(TTT, 'Tileset-n-Decorations/Trees.png')).convert('RGBA')
    for k, (x, y, w, h) in enumerate([(19, 50, 10, 12), (19, 114, 10, 12), (19, 178, 10, 12), (20, 242, 7, 12), (17, 306, 13, 12)]):
        items.append((f't:{k}', trees.crop((x, y, x + w, y + h))))
    # ground decorations (flowers, bushes, rocks): the 16x16 cells right of grass and water
    tiles = Image.open(os.path.join(TTT, 'Tileset-n-Decorations/Tileset.png')).convert('RGBA')
    k = 0
    for ty in (0, 16):
        for tx in range(48, 160, 16):
            cell = crop_alpha(tiles.crop((tx, ty, tx + 16, ty + 16)))
            if cell.getbbox():
                items.append((f'd:{k}', cell))
                k += 1

    sheet, frames = pack(items)
    os.makedirs(OUT, exist_ok=True)
    sheet.save(os.path.join(OUT, 'racers.png'), optimize=True)
    with open(os.path.join(OUT, 'racers.json'), 'w') as f:
        json.dump(frames, f, separators=(',', ':'))
    print('atlas', sheet.size, len(frames), 'frames')

    # preview of the cars (scratch)
    if len(sys.argv) > 1:
        prev = Image.new('RGBA', (16 * 22, len(MODELS) * 22), (60, 60, 70, 255))
        for r, mid in enumerate(MODELS):
            for a in range(16):
                fx, fy, w, h = frames[f'car:{mid}:{a}']
                prev.alpha_composite(sheet.crop((fx, fy, fx + w, fy + h)), (a * 22, r * 22))
        prev.resize((prev.width * 5, prev.height * 5), Image.NEAREST).save(sys.argv[1])

    # launcher thumbnail (32x32): a red coupe drifting across a bit of road
    th = Image.new('RGBA', (32, 32), (109, 170, 44, 255))
    tp = th.load()
    for y in range(32):
        for x in range(32):
            if 7 <= y <= 24:
                tp[x, y] = (78, 74, 78, 255)
            if y in (8, 23):
                tp[x, y] = (222, 238, 214, 255)
            if y in (6, 25) or y in (5, 26) and (x // 4) % 2 == 0:
                tp[x, y] = (208, 70, 72, 255) if (x // 4) % 2 == 0 else (222, 238, 214, 255)
            if y == 16 and (x // 4) % 2 == 0:
                tp[x, y] = (222, 238, 214, 255)
    red = recolour(rotsprite(car_sprite(**MODELS['coupe']), -22.5, 20), [(240, 96, 96), (208, 70, 72), (140, 40, 52)])
    blue = recolour(rotsprite(car_sprite(**MODELS['hatch']), 0, 20), [(120, 164, 240), (89, 125, 206), (48, 52, 109)])
    # skid marks behind the drifting red car
    for x in range(3, 13):
        tp[x, 20 + (x % 3 == 0)] = (52, 48, 56, 255)
    th.alpha_composite(blue, (-9, 6))
    th.alpha_composite(red, (10, 4))
    th.save(os.path.join(ROOT, 'games/public/thumbs/racers.png'))


def recolour(im, pal):
    out = im.copy()
    p = out.load()
    keys = {K1: pal[0], K2: pal[1], K3: pal[2]}
    for y in range(out.height):
        for x in range(out.width):
            if p[x, y] in keys:
                p[x, y] = keys[p[x, y]] + (255,)
    return out


if __name__ == '__main__':
    main()
