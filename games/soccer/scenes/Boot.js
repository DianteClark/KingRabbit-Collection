import Phaser from 'phaser';
import { URLS, buildFieldTextures, kitTexture } from '../sprites.js';
import { GOAL_W } from '../logic/constants.js';
import { PLAYER_TEAM, TEAMS } from '../logic/teams.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.image('sprites', URLS.sprites);
    this.load.image('field', URLS.field);
  }

  create() {
    buildFieldTextures(this, GOAL_W);
    // Bake the menu's players now; match kits are baked on demand.
    kitTexture(this, PLAYER_TEAM.shirt, PLAYER_TEAM.shorts, 0);
    kitTexture(this, TEAMS[0].shirt, TEAMS[0].shorts, 3);
    // Opened held upright: pause behind the rotate overlay straight away. (shared/core/boot.js
    // misses its first orientation check because Phaser fires 'ready' before it listens; its
    // change listener still wakes the game once the phone is turned.)
    if (window.matchMedia?.('(orientation: portrait) and (max-width: 540px)').matches) this.game.loop.sleep();
    this.scene.start('Menu');
  }
}
