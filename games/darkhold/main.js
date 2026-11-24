import { startGame } from '../../shared/core/boot.js';
import { Boot } from './scenes/Boot.js';
import { Title } from './scenes/Title.js';
import { ClassSelect } from './scenes/ClassSelect.js';
import { Play } from './scenes/Play.js';
import { End } from './scenes/End.js';
import * as G from './logic/game.js';
import * as Bot from './logic/bot.js';
import { save, saveRun, loadRun } from './save.js';
import { DEBUG } from './debug.js';

startGame({ scenes: [Boot, Title, ClassSelect, Play, End], background: '#08070d' });

// Test hooks for the automated browser checks: only in dev, or with ?debug in the address.
if (DEBUG) window.__dark = { G, Bot, save, saveRun, loadRun };
