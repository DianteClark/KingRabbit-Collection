import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { LANDSCAPE } from '../../../shared/core/boot.js';
import { STAGES } from '../logic/stages.js';
import { BOSSES } from '../logic/bosses.js';
import { WEAPONS } from '../logic/constants.js';
import { robotsBeaten } from '../logic/progress.js';
import { loadProgress, go, header, escBack, guardTaps } from './common.js';
import { jingle, playMusic } from '../music.js';

const { WIDTH } = LANDSCAPE;

const ABOUT = {
  ember: 'A lobbed fire bomb that bursts\nwhere it lands. Good on things below you.',
  ice: 'A fast spear that flies straight\nthrough every enemy in a line.',
  thorn: 'Leaves circle you and eat bullets.\nPress again to throw them.',
  volt: 'Three sparks in a fan: up, ahead\nand down. Great on flying foes.',
  drill: 'A slow drill that homes in on enemies.\nIt also breaks cracked blocks.',
  gale: 'A boomerang that comes back to you\nand grabs pickups on the way.',
};

/** After a boss: the weapon you got (or the fortress gate falling). */
export class Result extends Phaser.Scene {
  constructor() { super('Result'); }

  init(data) { this.stageId = data?.stage || 'foundry'; this.first = data?.first !== false; }

  create() {
    this._leaving = false;
    guardTaps(this);
    this.cameras.main.setBackgroundColor(PALETTE.night).fadeIn(400, 249, 245, 239);
    playMusic(null);
    const st = STAGES[this.stageId]; const boss = BOSSES[st.boss];
    const p = loadProgress();
    header(this, () => go(this, 'Select'));
    escBack(this, () => go(this, 'Select'));
    if (this.stageId === 'fort1') {
      jingle('clear');
      text(this, WIDTH / 2, 70, 'THE GATE IS DOWN', { size: 32, color: PALETTE.gold });
      this.add.image(WIDTH / 2, 150, 'big-gate').setScale(3).setTint(0x8a8f8a);
      text(this, WIDTH / 2, 236, 'Doctor Null waits in the fortress core.', { color: PALETTE.cream });
      button(this, WIDTH / 2 - 110, 300, 196, 48, 'Onward!', () => go(this, 'Stage', { stage: 'fort2' }), { fill: PALETTE.gold });
      button(this, WIDTH / 2 + 110, 300, 196, 48, 'Stage Select', () => go(this, 'Select'), { fill: PALETTE.lavender });
      return;
    }
    const wpn = boss.weapon; const W = WEAPONS[wpn];
    jingle('weapon');
    text(this, WIDTH / 2, 50, `${boss.name} BEATEN`, { size: 32, color: PALETTE.cream });
    const hero = this.add.sprite(170, 196, `hero-${wpn}`).setScale(4).setOrigin(0.5, 20 / 24).play(`hero-${wpn}-idle`);
    this.tweens.add({ targets: hero, y: 190, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
    this.add.image(170, 98, `icon-${wpn}`).setScale(4);
    text(this, 420, 108, this.first ? 'YOU GOT' : 'YOU HAVE', { color: PALETTE.lavender });
    text(this, 420, 140, W.name, { size: 32, color: PALETTE.gold });
    text(this, 420, 196, ABOUT[wpn], { color: PALETTE.cream });
    const left = 6 - robotsBeaten(p);
    const msg = left ? `${left} boss${left === 1 ? '' : 'es'} to go. Try it on one of them!` : 'All six beaten: the fortress is open!';
    text(this, 420, 250, msg, { color: PALETTE.sand });
    button(this, 420, 306, 230, 48, 'Stage Select', () => go(this, 'Select'), { fill: PALETTE.gold });
  }
}
