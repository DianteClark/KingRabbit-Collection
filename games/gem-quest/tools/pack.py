#!/usr/bin/env python3
"""Pack only the frames Gem Quest uses into games/gem-quest/assets/atlas.png + atlas.json.

Art: HAS Heroic Fantasy and MAS Mini Retro by Aleksandr Makarov (see shared/assets/LICENSE-ART.md).
Usage (from the repo root):
  node games/gem-quest/tools/refs.mjs > /tmp/gq-refs.json && python3 games/gem-quest/tools/pack.py /tmp/gq-refs.json
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
A = os.path.join(ROOT, 'shared', 'assets')
HAS = os.path.join(A, 'has-heroic-fantasy')
CRE = os.path.join(HAS, 'b-factions-creatures-heroes/HAS-CreaturePack-v.1.3/HAS-Creature-Pack-1.2')
ITEMS = os.path.join(HAS, 'd-magic-items-ui/HAS-IconPack-v.1.2/IconPack-1.0/AllItems')

UNIT_SHEETS = {
    'necro': (f'{CRE}/Necromancer/NecromancerSpriteSheet.png', 16, 0),
    'castle': (f'{CRE}/Castle/CastleSpriteSheet.png', 16, 0),
    'tower': (f'{CRE}/Tower/TowerSpriteSheet.png', 16, 0),
    'strong': (f'{CRE}/Stronghold/StrongholdSpriteSheet.png', 16, 0),
    'rampart': (f'{CRE}/Rampart/RampartSpriteSheet.png', 16, 0),
    'inferno': (f'{CRE}/Inferno/InfernoSpriteSheet.png', 16, 0),
    'boss1': (f'{HAS}/h-patron-request-add-ons-wr/WR-2.02.21-BossLizardHerosFirstAidPeasant/BossesSpriteSheet.png', 24, 1),
    'boss2': (f'{HAS}/h-patron-request-add-ons-wr/WR5-02.21-BossHeroShipWall/Bosses/BossesSpriteSheetDnD.png', 24, 0),
}
ICON_SHEETS = {
    'sp': (f'{HAS}/d-magic-items-ui/HAS-Magic-Book-1.1/MagicSpellsIcons.png', 16),
    'ar': (f'{ITEMS}/Miscellaneous/Artifact/ArtifactOriginal.png', 16),
    'sw': (f'{ITEMS}/Weapon/Sword/SwordOriginal.png', 16),
    'st': (f'{ITEMS}/Weapon/Staff/StaffOriginal.png', 16),
    'to': (f'{ITEMS}/Torso/TorsoOriginal.png', 16),
    'ri': (f'{ITEMS}/Ring/RingOriginal.png', 16),
    'ne': (f'{ITEMS}/Necklace/NecklaceOriginal.png', 16),
    'ui': (f'{HAS}/d-magic-items-ui/HAS-UI-Pack-v.1.0/Icons/Icons.png', 16),
    'bld': (f'{HAS}/c-buildings-towns/HAS-Buildings-Pack-1.01/HAS-Buildings-Pack/CompilationBuilding/Compilation-Building32x32.png', 32),
    'tr': (f'{HAS}/b-factions-creatures-heroes/HAS-Hero-Pack-v.1.0/HAS-Overworld-Starter-Pack/SP-Trees.png', 16),
}
SIXBALL = f'{A}/mas-mini-retro/MASFunPack-v.1.2/AllGames/6BallPuzzleSpriteSheet.png'
# Animation columns kept per unit: idle 0-3, attack 8-11, hit 12-15.
UNIT_COLS = [0, 1, 2, 3, 8, 9, 10, 11, 12, 13, 14, 15]

# Hand-drawn 8x8 gems in the Six Ball style (same outline and palette).
PAL = {'K': (4, 3, 3, 255), 'W': (249, 245, 239, 255), 'L': (138, 143, 196, 255), 'G': (185, 182, 201, 255),
       'Y': (227, 210, 69, 255), 'S': (240, 212, 114, 255), 'O': (216, 128, 56, 255), 'P': (154, 64, 126, 255),
       'R': (161, 61, 59, 255), '.': (0, 0, 0, 0)}
DRAWN = {
    'skull': ['..KKKK..', '.KWWWWK.', 'KWWWWWGK', 'KWKKWKKK', 'KWKKWKKK', '.KWWKWGK', '..KWWGK.', '..KKKK..'],
    'coin': ['..KKKK..', '.KSYYOK.', 'KSYYYYOK', 'KSYOOYOK', 'KYYOOYOK', 'KYYYYOOK', '.KOOOOK.', '..KKKK..'],
    'star': ['...KK...', '..KWWK..', 'KKKWWKKK', 'KWWWWWWK', '.KWWWWK.', '.KWWWWK.', 'KWWKKWWK', 'KKK..KKK'],
    'ov_h': ['........', '........', 'KKKKKKKK', 'WWWWWWWW', 'WWWWWWWW', 'KKKKKKKK', '........', '........'],
    'ov_v': ['..KWWK..', '..KWWK..', '..KWWK..', '..KWWK..', '..KWWK..', '..KWWK..', '..KWWK..', '..KWWK..'],
    'ov_bomb': ['..KKKK..', '.K....K.', 'K..WW..K', 'K.WWWW.K', 'K.WWWW.K', 'K..WW..K', '.K....K.', '..KKKK..'],
}


def main():
    refs = json.load(open(sys.argv[1]))
    pieces = []  # (name, image)
    six = Image.open(SIXBALL).convert('RGBA')
    for name, sx in [('gem0', 0), ('gem1', 24), ('gem2', 16), ('gem3', 40)]:  # red, blue, green, yellow
        pieces.append((name, six.crop((sx, 40, sx + 8, 48))))
    for name, rows in DRAWN.items():
        im = Image.new('RGBA', (8, 8))
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                im.putpixel((x, y), PAL[ch])
        pieces.append((name, im))
    sheets = {}
    for ref in refs['icons']:
        key, cr = ref.split(':')
        c, r = map(int, cr.split(','))
        path, size = ICON_SHEETS[key]
        sheets.setdefault(path, Image.open(path).convert('RGBA'))
        pieces.append((f'i:{ref}', sheets[path].crop((c * size, r * size, (c + 1) * size, (r + 1) * size))))
    unit_rows = []
    for ref in refs['units']:
        key, row = ref.split(':')
        row = int(row)
        path, size, off = UNIT_SHEETS[key]
        sheets.setdefault(path, Image.open(path).convert('RGBA'))
        frames = [sheets[path].crop(((col + off) * size, row, (col + off + 1) * size, row + size)) for col in UNIT_COLS]
        unit_rows.append((ref, size, frames))

    # Simple shelf packing: unit strips first (wide), then small pieces in rows.
    W = 12 * 24
    placed = {}
    y = 0
    for ref, size, frames in unit_rows:
        for k, fr in enumerate(frames):
            placed[f'u:{ref}:{k}'] = (k * size, y, fr)
        y += size
    x = 0
    row_h = 0
    for name, im in sorted(pieces, key=lambda p: -p[1].height):
        if x + im.width > W:
            x = 0
            y += row_h
            row_h = 0
        placed[name] = (x, y, im)
        x += im.width
        row_h = max(row_h, im.height)
    H = y + row_h
    atlas = Image.new('RGBA', (W, H))
    frames = {}
    for name, (px, py, im) in placed.items():
        atlas.alpha_composite(im, (px, py))
        # Phaser's JSON Hash parser only needs 'frame' for untrimmed, unrotated frames.
        frames[name] = {'frame': {'x': px, 'y': py, 'w': im.width, 'h': im.height}}
    out = os.path.join(ROOT, 'games', 'gem-quest', 'assets')
    os.makedirs(out, exist_ok=True)
    atlas.save(os.path.join(out, 'atlas.png'), optimize=True)
    json.dump({'frames': frames, 'meta': {'image': 'atlas.png', 'size': {'w': W, 'h': H}, 'scale': 1}},
              open(os.path.join(out, 'atlas.json'), 'w'), separators=(',', ':'))
    print('atlas', W, H, len(frames), 'frames', os.path.getsize(os.path.join(out, 'atlas.png')), 'bytes')


if __name__ == '__main__':
    main()
