// Sprite sheets from the HAS Heroic Fantasy pack by Aleksandr Makarov (see shared/assets/LICENSE-ART.md),
// and how to cut frames out of them. Art references in the game data look like:
//   'sp:3,1'      16px icon grid (col,row) on sheet 'sp'      (also ar, sk, ui)
//   'bld:2,8'     32px building grid
//   'necro:96'    creature row (y) on a 16px creature sheet; frames are named 'row:index'
//   'boss2:24'    boss row on a 24px boss sheet
//   'img:chest'   a single small image

import necroUrl from '../../shared/assets/has-heroic-fantasy/b-factions-creatures-heroes/HAS-CreaturePack-v.1.3/HAS-Creature-Pack-1.2/Necromancer/NecromancerSpriteSheet.png?url';
import castleUrl from '../../shared/assets/has-heroic-fantasy/b-factions-creatures-heroes/HAS-CreaturePack-v.1.3/HAS-Creature-Pack-1.2/Castle/CastleSpriteSheet.png?url';
import towerUrl from '../../shared/assets/has-heroic-fantasy/b-factions-creatures-heroes/HAS-CreaturePack-v.1.3/HAS-Creature-Pack-1.2/Tower/TowerSpriteSheet.png?url';
import strongUrl from '../../shared/assets/has-heroic-fantasy/b-factions-creatures-heroes/HAS-CreaturePack-v.1.3/HAS-Creature-Pack-1.2/Stronghold/StrongholdSpriteSheet.png?url';
import rampartUrl from '../../shared/assets/has-heroic-fantasy/b-factions-creatures-heroes/HAS-CreaturePack-v.1.3/HAS-Creature-Pack-1.2/Rampart/RampartSpriteSheet.png?url';
import infernoUrl from '../../shared/assets/has-heroic-fantasy/b-factions-creatures-heroes/HAS-CreaturePack-v.1.3/HAS-Creature-Pack-1.2/Inferno/InfernoSpriteSheet.png?url';
import boss1Url from '../../shared/assets/has-heroic-fantasy/h-patron-request-add-ons-wr/WR-2.02.21-BossLizardHerosFirstAidPeasant/BossesSpriteSheet.png?url';
import boss2Url from '../../shared/assets/has-heroic-fantasy/h-patron-request-add-ons-wr/WR5-02.21-BossHeroShipWall/Bosses/BossesSpriteSheetDnD.png?url';
import spUrl from '../../shared/assets/has-heroic-fantasy/d-magic-items-ui/HAS-Magic-Book-1.1/MagicSpellsIcons.png?url';
import arUrl from '../../shared/assets/has-heroic-fantasy/d-magic-items-ui/HAS-IconPack-v.1.2/IconPack-1.0/AllItems/Miscellaneous/Artifact/ArtifactOriginal.png?url';
import skUrl from '../../shared/assets/has-heroic-fantasy/d-magic-items-ui/HAS-IconPack-v.1.2/IconPack-1.2/Skills/Skills.png?url';
import uiUrl from '../../shared/assets/has-heroic-fantasy/d-magic-items-ui/HAS-UI-Pack-v.1.0/Icons/Icons.png?url';
import bldUrl from '../../shared/assets/has-heroic-fantasy/c-buildings-towns/HAS-Buildings-Pack-1.01/HAS-Buildings-Pack/CompilationBuilding/Compilation-Building32x32.png?url';
import chestUrl from '../../shared/assets/has-heroic-fantasy/c-buildings-towns/HAS-Buildings-Pack-1.01/HAS-Buildings-Pack/Resources/Chest.png?url';
import campfireUrl from '../../shared/assets/has-heroic-fantasy/c-buildings-towns/HAS-Buildings-Pack-1.01/HAS-Buildings-Pack/Resources/Campfire.png?url';
import treesUrl from '../../shared/assets/has-heroic-fantasy/b-factions-creatures-heroes/HAS-Hero-Pack-v.1.0/HAS-Overworld-Starter-Pack/SP-Trees.png?url';
import b64Url from '../../shared/assets/has-heroic-fantasy/c-buildings-towns/HAS-Buildings-Pack-1.01/HAS-Buildings-Pack/CompilationBuilding/Compilation-Building64x64.png?url';
import landUrl from '../../shared/assets/has-heroic-fantasy/b-factions-creatures-heroes/HAS-Hero-Pack-v.1.0/HAS-Overworld-Starter-Pack/SP-Overworld.png?url';

export const SHEETS = {
  necro: necroUrl,
  castle: castleUrl,
  tower: towerUrl,
  strong: strongUrl,
  rampart: rampartUrl,
  inferno: infernoUrl,
  boss1: boss1Url,
  boss2: boss2Url,
  sp: spUrl,
  ar: arUrl,
  sk: skUrl,
  ui: uiUrl,
  bld: bldUrl,
  chest: chestUrl,
  campfire: campfireUrl,
  trees: treesUrl,
  land: landUrl,
  b64: b64Url,
};

// Grid sheets: key -> [cell size, cols, rows]
export const GRIDS = {
  sp: [16, 8, 7], ar: [16, 10, 10], sk: [16, 21, 8], ui: [16, 6, 5], bld: [32, 8, 9],
  trees: [16, 8, 9], land: [16, 8, 24], b64: [64, 4, 2],
};

// Creature sheets: 16px frames, 7 + 7 creature rows. Columns: idle 0-3, walk 4-7, attack 8-11, hit 12-15, death 16-19.
export const CREATURE_SHEETS = ['necro', 'castle', 'tower', 'strong', 'rampart', 'inferno'];
export const CREATURE_ROWS = [16, 32, 48, 64, 80, 96, 112, 144, 160, 176, 192, 208, 224, 240];
// Boss sheets: 24px frames. boss1 has a portrait in column 0, so its animation starts one column later.
export const BOSS_SHEETS = { boss1: { rows: [0, 24, 48], offset: 1, cols: 21 }, boss2: { rows: [0, 24, 48, 72, 96, 120], offset: 0, cols: 20 } };

export const ANIMS = { idle: [0, 1, 2, 3], attack: [8, 9, 10, 11], hit: [12, 13, 14, 15], death: [16, 17, 18, 19] };

/** Parse an art reference into { key, frame, size, kind }. */
export function artRef(ref) {
  const [key, rest] = ref.split(':');
  if (key === 'img') return { key: rest, frame: undefined, size: 16, kind: 'img' };
  if (GRIDS[key]) return { key, frame: rest, size: GRIDS[key][0], kind: 'grid' };
  if (BOSS_SHEETS[key]) return { key, frame: `${rest}:0`, size: 24, kind: 'unit', row: Number(rest) };
  return { key, frame: `${rest}:0`, size: 16, kind: 'unit', row: Number(rest) };
}
