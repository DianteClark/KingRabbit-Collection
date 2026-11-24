// Sprite sheets from the HAS Heroic Fantasy pack by Aleksandr Makarov, and the rectangles we cut
// from them. Only these files are bundled. Frames are added to the loaded textures on demand:
// a frame "ref" is [sheetKey, x, y, w, h].
import humans from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Creatures/Humans-Castle/HumansSpriteSheet.png?url';
import undead from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Creatures/Undeads-Necropolis/UndeadsSpriteSheet.png?url';
import barb from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Creatures/Barbarians-Stronghold/BarbariansSpriteSheet.png?url';
import elves from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Creatures/WoodElves-Rampart/WoodElvesSpriteSheet.png?url';
import projectiles from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Creatures/Projectiles.png?url';
import heroC from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Heroes/Humans-Castle/CastleHeroesSpriteSheet.png?url';
import heroN from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Heroes/Undeads-Necropolis/NecropolisHeroesSpriteSheet.png?url';
import heroIcons from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Heroes/HeroIconSheet.png?url';
import towns from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Buildings/Towns/AllTownsSpriteSheet.png?url';
import dwell from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Buildings/Dwellings/AllDwellingsSpriteSheet.png?url';
import b11 from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Buildings/1x1/1x1BuildingsSpriteSheet.png?url';
import b22 from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Buildings/2x2/2x2BuildingsSpriteSheet.png?url';
import trees from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Landscape-Objects/TreesAndMountainsSpriteSheet.png?url';
import tGrass from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Biomes/GrassBiome/GB-LandTileset.png?url';
import tSand from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Biomes/SandBiome/SB-LandTileset.png?url';
import tIce from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Biomes/IceBiome/IB-LandTileset.png?url';
import tDirt from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Biomes/DirtBiome/DB-LandTileset.png?url';
import items from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Items/AllItems.png?url';
import spells from '../../shared/assets/has-heroic-fantasy/e-all-in-one-compilation/HAS2020-alpha-1/Magic-Spells/MagicSpellsIcons.png?url';
import battle from '../../shared/assets/has-heroic-fantasy/a-terrain-world-maps/HAS-Battlegrounds-v.0.1/Battlegrounds-sheet.png?url';

export const SHEETS = {
  humans, undead, barb, elves, projectiles, heroC, heroN, heroIcons, towns, dwell, b11, b22, trees,
  tiles_grass: tGrass, tiles_sand: tSand, tiles_ice: tIce, tiles_dirt: tDirt, items, spells, battle,
};

/** Make sure the rectangle exists as a frame on its sheet; returns [textureKey, frameName]. */
export function frame(scene, ref) {
  const [key, x, y, w = 16, h = 16] = ref;
  const name = `${x}_${y}_${w}_${h}`;
  const tex = scene.textures.get(key);
  if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
  return [key, name];
}

/** Add an image cut from a sheet. */
export function sprite(scene, x, y, ref, scale = 2) {
  const [k, f] = frame(scene, ref);
  return scene.add.image(Math.round(x), Math.round(y), k, f).setScale(scale);
}

// ---- Creatures: every creature sheet has 16x16 frames, one row per unit (first row at y = 16).
// Columns: 0 portrait, 2-5 idle, 6-9 walk, 10-13 attack, 14-17 hit, 18-21 death.
export function unitFrame(spriteDef, anim = 'idle', i = 0) {
  const [sheet, row] = spriteDef;
  const col = { portrait: 0, idle: 2, walk: 6, attack: 10, hit: 14, death: 18 }[anim] + (anim === 'portrait' ? 0 : i);
  return [sheet, col * 16, 16 + row * 16, 16, 16];
}

// ---- Heroes on horseback: walking right, 4 frames. Might heroes use the first rider, magic heroes the second.
export const heroFrame = (sheet, might, i = 0) => [sheet, 16 + i * 16, might ? 32 : 128, 16, 16];

// ---- Towns are 64x64. Variant by hall level (1-3).
export function townFrame(faction, level = 1) {
  const y = faction === 'necro' ? 416 : 176;
  return ['towns', 64 * Math.min(3, Math.max(1, level)), y, 64, 64];
}
export const dwellingFrame = (faction, tier) => ['dwell', tier * 32, faction === 'necro' ? 256 : 112, 32, 32];

// ---- Terrain per biome.
export const BIOMES = {
  grass: { tiles: 'tiles_grass', trees: [[16, 0], [16, 144]], mountain: [16, 336], bg: '#5fb83c', battleSky: 0 },
  sand: { tiles: 'tiles_sand', trees: [[16, 192], [160, 192]], mountain: [224, 336], bg: '#d7b98a', battleSky: 0 },
  ice: { tiles: 'tiles_ice', trees: [[224, 48], [368, 48], [432, 96]], mountain: [432, 336], bg: '#dfe6f7', battleSky: 1 },
  dirt: { tiles: 'tiles_dirt', trees: [[224, 0], [368, 0], [16, 288]], mountain: [16, 336], bg: '#9c6b43', battleSky: 1 },
};
export const groundFrame = (biome) => [BIOMES[biome].tiles, 16, 0, 16, 16];
export const groundFrame2 = (biome) => [BIOMES[biome].tiles, 16, 16, 16, 16];
export const DECOR = [[32, 0], [48, 0], [64, 0], [80, 0], [96, 0], [112, 0], [128, 0], [160, 0], [176, 0], [64, 16], [80, 16], [96, 16], [112, 16], [160, 16]];
/** Water edge piece from the 3x3 lake block (dx, dy in -1..1). */
export const waterFrame = (biome, dx, dy) => [BIOMES[biome].tiles, 112 + dx * 16, 144 + dy * 16, 16, 16];
// A single tree / mountain inside each 16x16 forest block.
export const treeFrame = (biome, n) => { const t = BIOMES[biome].trees[n % BIOMES[biome].trees.length]; return ['trees', t[0], t[1], 16, 16]; };
export const mountainFrame = (biome) => ['trees', BIOMES[biome].mountain[0], BIOMES[biome].mountain[1], 16, 16];

// ---- Map objects.
export const CHEST = ['b11', 208, 32, 16, 16];
export const CAMPFIRE = ['b11', 80, 48, 16, 16];
export const RES_ICON = { gold: ['b11', 112, 32, 16, 16], wood: ['b11', 96, 32, 16, 16], ore: ['b11', 128, 32, 16, 16], gems: ['b11', 176, 32, 16, 16] };
export const artifactFrame = (icon) => ['items', icon[0], icon[1], 16, 16];
export const spellFrame = (icon) => ['spells', icon[0], icon[1], 16, 16];
export const projectileFrame = (i) => ['projectiles', i * 8, 0, 8, 8];

// Icons for town buildings (from the 2x2 buildings sheet).
export const BUILDING_ICON = {
  hall1: ['b22', 32, 0, 32, 32], hall2: ['b22', 32, 0, 32, 32], hall3: ['b22', 32, 0, 32, 32],
  fort: ['b22', 32, 192, 32, 32], tavern: ['b22', 96, 192, 32, 32], market: ['b22', 160, 192, 32, 32],
  guild1: ['b22', 0, 192, 32, 32], guild2: ['b22', 0, 192, 32, 32], guild3: ['b22', 0, 192, 32, 32],
};

// ---- Battle field.
export const BATTLE = {
  sky: [['battle', 16, 16, 304, 48], ['battle', 336, 16, 304, 48]],
  rocks: [['battle', 176, 288, 32, 32], ['battle', 176, 336, 32, 32], ['battle', 176, 288, 32, 32]],
};
