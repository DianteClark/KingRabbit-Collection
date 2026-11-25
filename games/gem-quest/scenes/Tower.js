import { Phaser, PALETTE, hex, text, button, WIDTH, HEIGHT, go, setBackground, header, icon, unit, unitSize, modal, sfx } from './common.js';
import { getProgress, getBattle, setBattle, abandonBattle, save } from '../save.js';
import { HEROES } from '../logic/heroes.js';
import { ENEMIES } from '../logic/world.js';
import * as PR from '../logic/progress.js';
import { MAP_ART } from '../art.js';

export class Tower extends Phaser.Scene {
  constructor() { super('Tower'); }

  create() {
    setBackground(this, '#1f2433');
    header(this, 'Endless Tower', () => go(this, 'Menu'));
    const p = getProgress();
    const g = this.add.graphics();
    for (let i = 0; i < 30; i++) g.fillStyle(0xf9f5ef, Math.random() * 0.5 + 0.2).fillRect(Math.random() * WIDTH, 50 + Math.random() * 180, 2, 2);
    icon(this, WIDTH / 2, 150, MAP_ART.tower, 4);
    const best = save.get('towerBest') || 0;
    text(this, WIDTH / 2, 256, `Best floor: ${best}`, { color: PALETTE.gold });
    text(this, WIDTH / 2, 300, 'Climb with one hero. HP carries over; you heal 35% between floors. Every 5th floor is a boss. Each floor pays gold for the campaign.', { wrap: WIDTH - 40, color: PALETTE.lavender });

    const tower = save.get('tower');
    let y = 400;
    if (tower) {
      const f = PR.towerFloor(tower.seed, tower.floor);
      const e = ENEMIES[f.enemy];
      text(this, WIDTH / 2, y - 24, `${HEROES[tower.hero].name} is on floor ${tower.floor}, next foe: ${e.name}${f.boss ? ' (boss)' : ''}`, { wrap: WIDTH - 30, color: PALETTE.cream });
      button(this, WIDTH / 2, y + 24, 280, 46, `Climb on (floor ${tower.floor})`, () => this.climb(), { fill: PALETTE.gold });
      button(this, WIDTH / 2, y + 80, 280, 44, 'End this climb', () => this.endClimb(), { fill: PALETTE.red, color: PALETTE.cream });
    } else {
      button(this, WIDTH / 2, y + 24, 280, 46, 'Start a new climb', () => this.pickHero(), { fill: PALETTE.gold });
    }
    unit(this, 60, 600, HEROES[p.active].sprite, 3);
    text(this, 90, 590, `${p.gold} gold`, { origin: [0, 0.5], color: PALETTE.gold });
  }

  pickHero() {
    if (this._modals) return;
    sfx('select');
    const p = getProgress();
    const ids = PR.heroIds(p);
    const buttons = ids.map((id) => [`${HEROES[id].name}  Lv ${p.heroes[id].lvl}`, (close) => { close(); this.begin(id); }, PALETTE.lavender]);
    buttons.push(['Cancel', (close) => close(), PALETTE.indigo, PALETTE.cream]);
    modal(this, 'Who climbs?', 'Your hero uses their level and gear.', buttons);
  }

  begin(heroId) {
    const cur = getBattle();
    const start = () => {
      const p = getProgress();
      const hero = PR.heroFighter(p, heroId);
      save.set('tower', { hero: heroId, floor: 1, hp: hero.maxHp, seed: (Math.random() * 2 ** 31) >>> 0 });
      this.climb();
    };
    if (cur) {
      modal(this, 'Battle in progress', 'You left a battle unfinished. Starting a climb gives it up (it counts as a loss).', [
        ['Give it up', (close) => { close(); abandonBattle(); start(); }, PALETTE.red, PALETTE.cream],
        ['Cancel', (close) => close()],
      ]);
    } else start();
  }

  climb() {
    const cur = getBattle();
    if (cur && cur.ctx.mode === 'tower') { go(this, 'Battle', cur); return; }
    if (cur) {
      modal(this, 'Battle in progress', 'You left another battle unfinished. Give it up to climb?', [
        ['Give it up', (close) => { close(); abandonBattle(); this.climb(); }, PALETTE.red, PALETTE.cream],
        ['Cancel', (close) => close()],
      ]);
      return;
    }
    const tower = save.get('tower');
    if (!tower) return;
    const { battle, ctx } = PR.towerBattle(getProgress(), tower);
    setBattle({ battle, ctx });
    go(this, 'Battle', { battle, ctx });
  }

  endClimb() {
    if (this._modals) return;
    modal(this, 'End this climb?', 'Your best floor is kept. You start again from floor 1 next time.', [
      ['End climb', (close) => {
        close();
        const cur = getBattle();
        if (cur?.ctx.mode === 'tower') abandonBattle();
        save.set('tower', null);
        go(this, 'Tower');
      }, PALETTE.red, PALETTE.cream],
      ['Keep it', (close) => close()],
    ]);
  }
}

export { unitSize, hex };
