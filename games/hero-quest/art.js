// Art for Hollow Crown: the LAS Adventure Pack, LAS Alchemist Lab and pieces of the Minish pack,
// all by Aleksandr Makarov (iknowkingrabbit). Only the files listed here are bundled.
const LAS = '../../shared/assets/las-zelda-adventure/LAS-Adventure-Pack-1.0';

import tileset from '../../shared/assets/las-zelda-adventure/LAS-Adventure-Pack-1.0/Tileset/Tileset.png?url';
import labTiles from '../../shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02/Tileset/AlchemistLabTileset.png?url';
import items from '../../shared/assets/las-zelda-adventure/LAS-Adventure-Pack-1.0/Item/Items.png?url';
import npcs from '../../shared/assets/las-zelda-adventure/LAS-Adventure-Pack-1.0/NPC/AllNPC.png?url';
import gremlin from '../../shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02/Enemy/GremlinAllFrames.png?url';
import golem from '../../shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02/Enemy/GolemAllFrames.png?url';
import smoke from '../../shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02/Tileset/Smoke.png?url';
import shadow from '../../shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02/NPC/NPCShadow.png?url';
import showItem from '../../shared/assets/las-zelda-adventure/LAS-Adventure-Pack-1.0/Character/Unarmed/Single-Animation/ShowItem/U-Char-ShowItem-Down.png?url';
import defeat from '../../shared/assets/las-zelda-adventure/LAS-Adventure-Pack-1.0/Character/Armed/Single-Animation/Defeat/A-Char-Defeat-Down.png?url';

// Character strips: 4 frames of 32x32, one file per action and direction.
const CHAR = import.meta.glob('../../shared/assets/las-zelda-adventure/LAS-Adventure-Pack-1.0/Character/{Armed,Unarmed,InArms}/{Idle,Walk,Push,Hit,Attack}/*.png', { eager: true, query: '?url', import: 'default' });
const SLIME = import.meta.glob('../../shared/assets/las-zelda-adventure/LAS-Adventure-Pack-1.0/Enemy/Slimes/*/*.png', { eager: true, query: '?url', import: 'default' });

export const SHEETS = { tileset, labTiles, items, npcs, gremlin, golem, smoke, shadow, showItem, defeat };
export { LAS };

/** [key, url] for every character strip, keyed like "A-Walk-Down" (A armed, U unarmed, IA sword out). */
export function charStrips() {
  const out = [];
  for (const [path, url] of Object.entries(CHAR)) {
    const m = path.match(/\/(A|U|IA)-Char-(\w+)-(Down|Up|Left|Right)\.png$/);
    if (m) out.push([`${m[1]}-${m[2]}-${m[3]}`, url]);
  }
  return out;
}

/** [key, url] for slime strips, keyed like "GreenSlime-WalkDown". */
export function slimeStrips() {
  const out = [];
  for (const [path, url] of Object.entries(SLIME)) {
    const m = path.match(/\/(\w+Slime)(\w+)\.png$/);
    if (m) out.push([`${m[1]}-${m[2]}`, url]);
  }
  return out;
}

export const DIR_NAME = { down: 'Down', up: 'Up', left: 'Left', right: 'Right' };
// Gremlin and golem sheets: rows are down, left, up, right; 20 frames per row in groups of four
// (idle, walk, attack, hit, death).
export const ROW_OF = { down: 0, left: 1, up: 2, right: 3 };
export const GROUP = { idle: 0, walk: 1, attack: 2, hit: 3, death: 4 };

// Item sheet (16x16 cells, 8 x 6): [col, row]
export const ITEM = {
  key: [0, 0], bigkey: [2, 0], sword: [3, 0], gem: [4, 0], potion: [1, 1], bombs: [2, 3],
  boomerang: [4, 4], orb: [7, 4], crown: [7, 2], pot: [7, 3], gem5: [4, 0],
};

// NPC sheet rows (16x16, 4 idle frames each)
export const NPC_ROW = { odo: 0, tam: 1, elder: 2, wen: 3, pip: 4, mira: 5 };
