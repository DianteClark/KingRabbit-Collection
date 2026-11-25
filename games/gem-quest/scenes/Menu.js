import { Phaser, PALETTE, hex, text, button, WIDTH, HEIGHT, go, setBackground, openHowTo, unit, modal, sfx, soundLabel } from './common.js';
import { isMuted, setMuted } from '../../../shared/core/sfx.js';
import { playedDailyToday, today, dailySeed, profile } from '../../../shared/core/trophies.js';
import { getProgress, getBattle, setBattle, abandonBattle } from '../save.js';
import { HEROES } from '../logic/heroes.js';
import { REGIONS, findNode } from '../logic/world.js';
import * as PR from '../logic/progress.js';
import { GAME_ID } from '../awards.js';

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    setBackground(this, PALETTE.night);
    const g = this.add.graphics();
    g.fillStyle(hex('#241c2c')).fillRect(0, 130, WIDTH, 150);
    g.fillStyle(hex('#2f2638')).fillRect(0, 230, WIDTH, 50);
    for (let i = 0; i < 36; i++) g.fillStyle(0xf9f5ef, Phaser.Math.FloatBetween(0.2, 0.7)).fillRect(Phaser.Math.Between(0, WIDTH), Phaser.Math.Between(4, 200), 2, 2);
    // Title with a falling-gem border.
    ['gem0', 'gem1', 'gem2', 'gem3', 'skull', 'coin', 'gem0', 'gem1', 'gem2'].forEach((f, i) => {
      const img = this.add.image(36 + i * 36, 30, 'gq', f).setScale(3);
      this.tweens.add({ targets: img, y: 36, duration: 600 + i * 40, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    text(this, WIDTH / 2, 88 + 4, 'GEM QUEST', { size: 32, color: PALETTE.red });
    text(this, WIDTH / 2, 88, 'GEM QUEST', { size: 32, color: PALETTE.gold });
    text(this, WIDTH / 2, 120, 'Match gems. Power your hero.', { color: PALETTE.lavender });

    const p = getProgress();
    const ids = PR.heroIds(p);
    ids.forEach((id, i) => unit(this, WIDTH / 2 - (ids.length - 1) * 30 + i * 60, 266, HEROES[id].sprite, 3));
    unit(this, 320, 270, 'boss2:0', 2, true).setAlpha(0.9);

    const battle = getBattle();
    let y = 312;
    const B = (label, fn, fill = PALETTE.lavender, color = PALETTE.night) => { const b = button(this, WIDTH / 2, y, 290, 44, label, fn, { fill, color }); y += 52; return b; };
    if (battle) B(`Resume: ${this.battleLabel(battle)}`, () => go(this, 'Battle', battle), PALETTE.gold);
    const fresh = !Object.keys(p.cleared).length;
    B(fresh ? 'Start your quest' : PR.campaignDone(p) ? 'World Map (complete!)' : 'World Map', () => go(this, 'WorldMap', {}), battle ? PALETTE.lavender : PALETTE.gold);
    B('Heroes & gear', () => go(this, 'Heroes', { from: 'Menu' }));
    B('Endless Tower', () => go(this, 'Tower'));
    const daily = playedDailyToday(GAME_ID);
    B(daily ? `Daily Duel (best ${profile().daily[GAME_ID]?.best?.[today()] ?? 0})` : 'Daily Duel - new today!', () => this.daily(), daily ? PALETTE.lavender : PALETTE.sand);

    button(this, 90, 606, 160, 40, '< All Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, 268, 606, 140, 40, '', () => { setMuted(!isMuted()); this.syncSound(); }, { color: PALETTE.cream });
    this.syncSound();
    button(this, WIDTH - 26, 158, 44, 36, '?', () => openHowTo(this), { fill: PALETTE.gold });
    text(this, 10, 158, `Gold ${p.gold}`, { origin: [0, 0.5], color: PALETTE.gold });
  }

  battleLabel(b) {
    const c = b.ctx;
    if (c.mode === 'tower') return `tower floor ${c.floor}`;
    if (c.mode === 'daily') return 'daily duel';
    const n = findNode(c.node);
    return n.kind === 'quest' ? n.quest.name : `${REGIONS[n.region].name} ${n.k}/8`;
  }

  syncSound() {
    this.soundBtn.setLabel(soundLabel(isMuted()));
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
  }

  daily() {
    sfx('select');
    const seed = dailySeed(GAME_ID);
    const { battle, ctx } = PR.dailyBattle(seed);
    const heroName = HEROES[ctx.hero].name;
    const start = () => {
      ctx.day = today();
      setBattle({ battle, ctx });
      go(this, 'Battle', { battle, ctx });
    };
    const body = `Everyone gets the same duel today: a level 8 ${heroName} with no gear against ${battle.enemy.name}, on the same board.\n\nWin fast and keep your HP for a high score. Play as often as you like: your best counts.`;
    const current = getBattle();
    modal(this, 'Daily Duel', body, [
      ['Fight!', (close) => {
        close();
        if (current) {
          modal(this, 'Leave your battle?', 'You have a battle in progress. Starting the duel counts it as a loss.', [
            ['Start duel', (c2) => { c2(); abandonBattle(); start(); }, PALETTE.red, PALETTE.cream],
            ['Cancel', (c2) => c2()],
          ]);
        } else start();
      }],
      ['Close', (close) => close(), PALETTE.lavender],
    ], { width: 330 });
  }
}
