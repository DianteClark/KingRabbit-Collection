import Phaser from 'phaser';
import atlasPng from '../assets/atlas.png?url';
import atlasJson from '../assets/atlas.json?url';

// Unit strips in the atlas: frames u:<ref>:0-11 = idle 0-3, attack 4-7, hit 8-11.
const ANIMS = { idle: [0, 1, 2, 3], attack: [4, 5, 6, 7], hit: [8, 9, 10, 11] };

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.atlas('gq', atlasPng, atlasJson);
  }

  create() {
    const names = this.textures.get('gq').getFrameNames();
    const refs = new Set(names.filter((n) => n.startsWith('u:')).map((n) => n.slice(2, n.lastIndexOf(':'))));
    for (const ref of refs) {
      for (const [name, idx] of Object.entries(ANIMS)) {
        this.anims.create({
          key: `${ref}:${name}`,
          frames: idx.map((i) => ({ key: 'gq', frame: `u:${ref}:${i}` })),
          frameRate: name === 'idle' ? 5 : 10,
          repeat: name === 'idle' ? -1 : 0,
        });
      }
    }
    this.scene.start('Menu');
  }
}
