import { startGame } from '../../shared/core/boot.js';
import './sd.css';
import { Boot } from './scenes/Boot.js';
import { Menu } from './scenes/Menu.js';
import { MapScene } from './scenes/MapScene.js';
import { Combat } from './scenes/Combat.js';
import { RunEnd } from './scenes/RunEnd.js';
import * as R from './logic/run.js';
import * as C from './logic/combat.js';
import * as S from './logic/ship.js';
import * as B from './logic/bot.js';
import * as D from './logic/data.js';
import { save, saveRun, loadRun } from './save.js';
import { DEBUG } from './debug.js';

startGame({ scenes: [Boot, Menu, MapScene, Combat, RunEnd], background: '#1c1618' });

// Test hooks for the automated browser checks: only in dev, or with ?debug in the address.
if (DEBUG) window.__sd = { R, C, S, B, D, save, saveRun, loadRun };
