import Phaser from 'phaser';
import { BUILDINGS } from '../logic/buildings.js';

// BAS Town art (Aleksandr Makarov). Only the files the city uses are bundled.
const buildingUrls = import.meta.glob('../../../shared/assets/modern-city/BAS-Town-v.1.0/Buildings/*/*.png', { eager: true, query: '?url', import: 'default' });
const carUrls = import.meta.glob('../../../shared/assets/modern-city/BAS-Town-v.1.0/Cars/Separate/*.png', { eager: true, query: '?url', import: 'default' });
const iconUrl = import.meta.glob('../../../shared/assets/modern-city/BAS-Town-v.1.0/Icons/Icons.png', { eager: true, query: '?url', import: 'default' });
const peopleUrl = import.meta.glob('../../../shared/assets/modern-city/BAS-Town-v.1.0/Miscellaneous/People.png', { eager: true, query: '?url', import: 'default' });

const base = (p) => p.split('/').pop().replace('.png', '');

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const g = this.add.graphics();
    this.load.on('progress', (v) => { g.clear().fillStyle(0xe3d245).fillRect(80, 318, 200 * v, 4); });
    for (const [path, url] of Object.entries(buildingUrls)) {
      const k = base(path);
      if (BUILDINGS[k]) this.load.image(`b:${k}`, url);
    }
    for (const [path, url] of Object.entries(carUrls)) this.load.image(`car:${base(path)}`, url);
    this.load.spritesheet('icons', Object.values(iconUrl)[0], { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('people', Object.values(peopleUrl)[0], { frameWidth: 4, frameHeight: 5 });
  }

  create() { this.scene.start('Title'); }
}
