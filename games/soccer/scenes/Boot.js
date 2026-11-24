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
    this.scene.start('Menu');
  }
}
