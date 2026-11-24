// Art for Alchemist's Shop: LAS Alchemist Lab + LAS Adventure Pack by Aleksandr Makarov (iknowkingrabbit).
// Only the files imported here are bundled.
import labTiles from '../../shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02/Tileset/AlchemistLabTileset.png?url';
import smoke from '../../shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02/Tileset/Smoke.png?url';
import ingredients from '../../shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02/Item/Ingredients.png?url';
import alchemist from '../../shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02/NPC/AlchemistAllFrames.png?url';
import apprentice from '../../shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02/NPC/ApprenticeAlchemistAllFrames.png?url';
import shadow from '../../shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02/NPC/NPCShadow.png?url';
import gremlin from '../../shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02/Enemy/GremlinAllFrames.png?url';
import golem from '../../shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02/Enemy/GolemAllFrames.png?url';
import lab from '../../shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02/Objects/AlchemistLab.png?url';
import vein from '../../shared/assets/las-zelda-adventure/LAS-AlchemistLab-v.1.02/Objects/CinnabarVein.png?url';
import advTiles from '../../shared/assets/las-zelda-adventure/LAS-Adventure-Pack-1.0/Tileset/Tileset.png?url';
import items from '../../shared/assets/las-zelda-adventure/LAS-Adventure-Pack-1.0/Item/Items.png?url';
import npcs from '../../shared/assets/las-zelda-adventure/LAS-Adventure-Pack-1.0/NPC/AllNPC.png?url';

export const URLS = { labTiles, smoke, ingredients, alchemist, apprentice, shadow, gremlin, golem, lab, vein, advTiles, items, npcs };

// [x, y, w, h] in AlchemistLabTileset.png
export const LAB = {
  cauldron: [0, 144, 32, 32],
  tableLong: [0, 112, 32, 32],
  tableDistill: [32, 112, 32, 32],
  tableFlask: [64, 112, 32, 32],
  tableTools: [96, 112, 32, 32],
  counterShelf: [160, 144, 32, 16],
  bookEmpty: [48, 80, 16, 32],
  books: [64, 80, 16, 32],
  smallFlask: [16, 80, 16, 16],
  smallJar: [32, 80, 16, 16],
  hearth: [80, 80, 32, 32],
  barrel: [160, 80, 16, 16],
  barrelOpen: [176, 80, 16, 16],
  stool: [112, 80, 16, 16],
  notice: [144, 80, 16, 16],
  vines: [144, 96, 16, 16],
  winWall: [96, 144, 48, 32],
  door: [256, 144, 16, 32],
  cobble: [272, 144, 16, 16],
  grass: [0, 32, 16, 16],
  dirt: [16, 0, 64, 80],
  herbYellow: [112, 32, 16, 16],
  herbBlue: [128, 32, 16, 16],
  herbSprout: [144, 32, 16, 16],
  mushrooms: [160, 32, 16, 16],
  herbOrange: [176, 32, 16, 16],
  herbGreen: [112, 64, 16, 16],
  pickedHerb: [112, 16, 16, 16],
  pickedMush: [160, 16, 16, 16],
  bushGreen: [224, 32, 16, 16],
  bushOrange: [240, 32, 16, 16],
  bushRed: [256, 32, 16, 16],
  bushPink: [272, 32, 16, 16],
  treeBig: [256, 0, 32, 32],
  treeDead: [192, 0, 32, 32],
  canopy: [288, 0, 32, 32],
  crystalBig: [0, 608, 32, 32],
  crystal: [96, 576, 16, 32],
  crystal2: [112, 576, 16, 32],
  crystalSpikes: [80, 560, 32, 16],
  crystalShard: [112, 560, 32, 16],
  caveFloor: [0, 576, 32, 32],
  caveWall: [128, 608, 64, 48],
};

// [x, y, w, h] in the LAS Adventure Tileset.png
export const ADV = {
  grass: [16, 48, 16, 16],
  daisy: [208, 0, 16, 16],
  daisies: [224, 0, 16, 16],
  bush: [256, 32, 16, 16],
  shrub: [272, 48, 16, 16],
  rock: [240, 16, 16, 16],
  chest: [208, 16, 16, 16],
  sign: [208, 32, 16, 16],
  water: [32, 176, 16, 16],
  fence: [80, 0, 64, 64],
};

// Items.png (16x16 cells, 8 per row): the flask we recolour for every potion.
export const FLASK = [16, 16, 16, 16];

// Spot art in the gathering scenes: [sheet, frame, scale, pickedFrame, tint]
export const SPOT_ART = {
  bushPink: ['lab', 'bushPink', 3, 'bushGreen'],
  herbGreen: ['lab', 'herbGreen', 3, 'pickedHerb'],
  herbBlue: ['lab', 'herbBlue', 3, 'pickedHerb'],
  herbYellow: ['lab', 'herbYellow', 3, 'pickedHerb'],
  herbOrange: ['lab', 'herbOrange', 3, 'pickedHerb'],
  herbSprout: ['lab', 'herbSprout', 3, 'pickedHerb'],
  mushrooms: ['lab', 'mushrooms', 3, 'pickedMush'],
  bushRed: ['lab', 'bushRed', 3, 'bushGreen'],
  bushOrange: ['lab', 'bushOrange', 3, 'bushGreen'],
  pond: ['adv', 'water', 3, 'water'],
  stump: ['adv', 'shrub', 3, 'shrub'],
  nest: ['lab', 'treeDead', 2, 'treeDead'],
  rocks: ['adv', 'rock', 3, 'rock'],
  crystal: ['lab', 'crystal', 2, 'crystalSpikes'],
  crystalBlue: ['lab', 'crystal2', 2, 'crystalSpikes', 0x9fc8ff],
  ore: ['lab', 'crystalBig', 2, 'crystalSpikes', 0xd8d8f0],
  chest: ['adv', 'chest', 3, 'chest'],
};
