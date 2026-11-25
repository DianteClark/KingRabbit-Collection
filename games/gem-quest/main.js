import { startGame } from '../../shared/core/boot.js';
import { Boot } from './scenes/Boot.js';
import { Menu } from './scenes/Menu.js';
import { WorldMap } from './scenes/WorldMap.js';
import { Battle } from './scenes/Battle.js';
import { Heroes } from './scenes/Heroes.js';
import { Shop } from './scenes/Shop.js';
import { Tower } from './scenes/Tower.js';
import { Puzzle } from './scenes/Puzzle.js';
import { setupAwards } from './awards.js';
import { DEBUG } from './debug.js';
import * as B from './logic/board.js';
import * as C from './logic/combat.js';
import * as AI from './logic/ai.js';
import * as PR from './logic/progress.js';
import { installPad } from '../../shared/core/padkit.js';
import * as S from './save.js';

setupAwards();
startGame({ scenes: [Boot, Menu, WorldMap, Battle, Heroes, Shop, Tower, Puzzle] }).then(installPad);

// Test hooks for the automated browser checks: only in dev, or with ?debug in the address.
if (DEBUG) window.__gq = { B, C, AI, PR, S };
