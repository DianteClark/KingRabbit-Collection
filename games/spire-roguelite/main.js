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
import { Gallery } from './scenes/Gallery.js';
import * as R from './logic/run.js';
import { saveRun, loadRun } from './save.js';

startGame({
  scenes: [Boot, Menu, HeroSelect, MapScene, Battle, Reward, Rest, Treasure, Event, Shop, RunEnd, DeckView, Gallery],
});

// Test hooks (used by the automated browser checks).
window.__spire = { R, saveRun, loadRun };
