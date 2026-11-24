import Phaser from 'phaser';
import atlasUrl from '../atlas/bas-town.png?url';
import ATLAS from '../atlas/bas-town.json';

// BAS Town art (Aleksandr Makarov). Buildings and cars are packed into one sheet (atlas/) so the
// game downloads one image instead of ~300; each piece then becomes its own texture ('b:Name',
// 'car:Name') exactly as before. Regenerate the atlas if the art changes.
const iconUrl = import.meta.glob('../../../shared/assets/modern-city/BAS-Town-v.1.0/Icons/Icons.png', { eager: true, query: '?url', import: 'default' });
const peopleUrl = import.meta.glob('../../../shared/assets/modern-city/BAS-Town-v.1.0/Miscellaneous/People.png', { eager: true, query: '?url', import: 'default' });

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const g = this.add.graphics();
    this.load.on('progress', (v) => { g.clear().fillStyle(0xe3d245).fillRect(80, 318, 200 * v, 4); });
    this.load.image('bas-town', atlasUrl);
    this.load.spritesheet('icons', Object.values(iconUrl)[0], { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('people', Object.values(peopleUrl)[0], { frameWidth: 4, frameHeight: 5 });
  }

  create() {
    const src = this.textures.get('bas-town').getSourceImage();
    for (const [key, [x, y, w, h]] of Object.entries(ATLAS)) {
      const tex = this.textures.createCanvas(key, w, h);
      tex.context.drawImage(src, x, y, w, h, 0, 0, w, h);
      tex.refresh();
    }
    this.scene.start('Title');
  }
}
