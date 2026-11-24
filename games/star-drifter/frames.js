// Sprite sheets from the MAS Space Roguelike pack by Aleksandr Makarov (see shared/assets/LICENSE-ART.md).
// Every sheet is an 8px grid under an 8px title strip. Frames are named 'col,row' (row 0 = first row
// under the title). Art references look like 'ts:3,5' (sheet:col,row).
import tsUrl from '../../shared/assets/mas-mini-retro/MAS-Space-Roguelike-v.1.0/TilesetSpriteSheet.png?url';
import chUrl from '../../shared/assets/mas-mini-retro/MAS-Space-Roguelike-v.1.0/CharactersSpriteSheet.png?url';
import itUrl from '../../shared/assets/mas-mini-retro/MAS-Space-Roguelike-v.1.0/ItemSpriteSheet.png?url';
import f2Url from '../../shared/assets/mas-mini-retro/MAS-Space-Roguelike-v.1.0/2FrameAnimTilesetSpriteSheet.png?url';

export const SHEETS = { ts: tsUrl, ch: chUrl, it: itUrl, f2: f2Url };
/** key -> [cols, rows] of 8px cells below the 8px title strip. */
export const GRIDS = { ts: [9, 36], ch: [6, 25], it: [6, 5], f2: [2, 10] };

/** Crew frames: character sheet row for a sprite y (152 -> row 18). Columns 0 idle, 1-4 walk, 5 dead. */
export const crewRow = (y) => (y - 8) / 8;

export const ART = {
  power: 'f2:0,0', shields: 'f2:0,1', drones: 'f2:0,3', missile: 'f2:0,7', teleporter: 'f2:0,9',
  oxygen: 'it:4,2', medbay: 'it:1,3', engines: 'it:5,3', weapons: 'it:0,2', crewIcon: 'it:3,3',
  piloting: 'ts:0,1', sensors: 'ts:1,0', fuel: 'ts:2,0', scrap: 'it:0,0', parts: 'it:3,2',
  store: 'it:4,3', exit: 'it:5,4', fire: 'ts:0,23', crate: 'it:3,4',
};
