import { startGame } from '../../shared/core/boot.js';
import { Boot } from './scenes/Boot.js';
import { Menu } from './scenes/Menu.js';
import { HeroSelect } from './scenes/HeroSelect.js';
import { MapScene } from './scenes/MapScene.js';
import { Battle } from './scenes/Battle.js';
import { Reward } from './scenes/Reward.js';
import { Rest, Treasure, Event, Shop } from './scenes/Rooms.js';
import { RunEnd } from './scenes/RunEnd.js';
import { DeckView } from './scenes/DeckView.js';
import * as R from './logic/run.js';
import * as B from './logic/bot.js';
import { saveRun, loadRun } from './save.js';
import { DEBUG } from './debug.js';
import { initTrophies } from './trophies.js';

initTrophies();
import * as C from './logic/cards.js';
import { installPad } from '../../shared/core/padkit.js';
import { handCard, wideCard } from './scenes/cardview.js';

startGame({
  scenes: [Boot, Menu, HeroSelect, MapScene, Battle, Reward, Rest, Treasure, Event, Shop, RunEnd, DeckView],
}).then(installPad);

// Test hooks for the automated browser checks: only in dev, or with ?debug in the address.
if (DEBUG) window.__spire = { R, B, C, handCard, wideCard, saveRun, loadRun };
