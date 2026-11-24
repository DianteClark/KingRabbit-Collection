import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text, button, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { sfx } from '../../../shared/core/sfx.js';
import { fmtTime } from './Title.js';
import { playMusic } from '../music.js';

const STORY = [
  'The Hollow King crumbled to dust,',
  'and the Crown was light in your hands.',
  '',
  'You carried it home through the Grey Peaks,',
  'over the Ember River and down to Fernwick.',
  '',
  'Elder Bram set it back on its old stone.',
  'By morning the vale was green again.',
];

export class Ending extends Phaser.Scene {
  constructor() { super('Ending'); }

  init(data) { this.stats = data.stats || {}; }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.night).fadeIn(800, 249, 245, 239);
    sfx('win');
    playMusic('village');
    const s = this.stats;
    const crown = this.add.image(WIDTH / 2, 92, 'items', 2 * 8 + 7).setScale(4);
    this.tweens.add({ targets: crown, y: 84, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
    text(this, WIDTH / 2, 150, 'THE END', { size: 32, color: PALETTE.gold });
    const lines = STORY.map((l, i) => text(this, WIDTH / 2, 196 + i * 22, l, { color: PALETTE.cream }).setAlpha(0));
    lines.forEach((t, i) => this.tweens.add({ targets: t, alpha: 1, delay: 400 + i * 350, duration: 500 }));
    const y = 196 + STORY.length * 22 + 20;
    const stats = [
      `Time ${fmtTime(s.time)}`,
      `Hearts ${s.maxHp / 2}   Gems ${s.gems}`,
      `Enemies beaten ${s.kills}   Falls ${s.deaths}`,
    ];
    stats.forEach((l, i) => text(this, WIDTH / 2, y + i * 22, l, { color: PALETTE.sand }));
    text(this, WIDTH / 2, y + 80, 'Art: Aleksandr Makarov', { color: PALETTE.lavender });
    button(this, WIDTH / 2, 548, 240, 46, 'Keep exploring', () => fadeTo(this, () => this.scene.start('Play', { fresh: false })), { fill: PALETTE.gold });
    button(this, WIDTH / 2, 604, 240, 40, 'Title screen', () => fadeTo(this, () => this.scene.start('Title')), { fill: PALETTE.lavender });
  }
}
