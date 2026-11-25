import {
  Phaser, PALETTE, hex, text, button, WIDTH, HEIGHT, sfx, go, setBackground, header, icon, unit, unitSize, playOnce,
  outlined, floatText, toast, modal, info, bar, GEM_COLORS,
} from './common.js';
import { BoardView } from './boardview.js';
import { move, cast, canCast, canAfford, intent, skullHit } from '../logic/combat.js';
import { enemyChoice, hintMove } from '../logic/ai.js';
import { SKILLS, describe, fxValue } from '../logic/skills.js';
import { HEROES, SKILL_LEVELS, GEAR } from '../logic/heroes.js';
import { REGIONS, findNode } from '../logic/world.js';
import * as PR from '../logic/progress.js';
import { MAP_ART } from '../art.js';
import { save, getProgress, setProgress, setBattle, clearBattle, seen, markSeen } from '../save.js';
import { currentAi, reportResult } from '../adaptive.js';
import { give, stat, checkBattleTrophies, GAME_ID } from '../awards.js';
import { reportDaily, today } from '../../../shared/core/trophies.js';
import { aiParams } from '../logic/ai.js';
import { DEBUG } from '../debug.js';

const BOARD = { x: 12, y: 150, cell: 42 };
const EP = { top: 46, h: 100 };   // enemy panel
const HP_TOP = 492;               // hero panel
const SKILL_Y = [574, 618];
const STATUS_ICONS = { shield: MAP_ART.shield, poison: MAP_ART.poison, stun: MAP_ART.stun, rage: MAP_ART.rage, weak: MAP_ART.weak };

export class Battle extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) {
    this.st = data.battle;
    this.ctx = data.ctx;
    this.busy = false;
    this.ended = false;
    this.ai = this.ctx.mode === 'daily' ? aiParams(0.5) : currentAi();
    this.tut = this.ctx.mode === 'campaign' && this.ctx.node === 'b0-1' && !seen('tut-battle');
    this.tutStep = 0;
  }

  create() {
    const region = this.ctx.mode === 'campaign' ? REGIONS[findNode(this.ctx.node).region] : null;
    const bg = region?.bg ?? (this.ctx.mode === 'daily' ? '#2a2440' : '#1f2433');
    setBackground(this, bg);
    header(this, this.title(), () => this.pauseMenu());
    this.drawEnemyPanel(region);
    this.drawHeroPanel();
    this.board = new BoardView(this, this.st.board, BOARD);
    this.board.onSwap = (a, b) => this.heroSwap(a, b);
    this.board.onTapBlocked = () => { if (!this.busy && this.st.turn === 'enemy') toast(this, 'Wait for the monster\'s turn', BOARD.y + 40, PALETTE.lavender, 500); };
    this.turnLabel = outlined(this, WIDTH / 2, BOARD.y + BOARD.cell * 4, '', { size: 32, color: PALETTE.gold }).setDepth(85).setAlpha(0);
    this.refresh();
    if (DEBUG) window.__battle = this;
    this.saveNow();
    this.idle = 0;
    // Resume where we left off: a finished fight goes to the results, the monster's turn plays.
    if (this.st.over) { this.time.delayedCall(300, () => this.finish()); return; }
    this.time.delayedCall(350, () => this.afterAction(true));
  }

  title() {
    const c = this.ctx;
    if (c.mode === 'tower') return `Tower - floor ${c.floor}`;
    if (c.mode === 'daily') return 'Daily Duel';
    const n = findNode(c.node);
    if (n.kind === 'quest') return 'Side quest';
    return `${REGIONS[n.region].name} ${n.k}/8`;
  }

  update(_, dt) {
    // Gentle nudge after a while without a move: show a good swap.
    if (this.busy || this.st.over || this.st.turn !== 'hero' || this._modals) { this.idle = 0; return; }
    this.idle += dt;
    if (this.idle > 9000 && !this.hinted) { this.hinted = true; this.showHint(); }
  }

  // ------------------------------------------------------------------ drawing

  drawEnemyPanel(region) {
    const e = this.st.enemy;
    const g = this.add.graphics();
    g.fillStyle(hex(region?.ground ?? '#2f2a44')).fillRect(0, EP.top, WIDTH, EP.h);
    g.fillStyle(hex(PALETTE.ink), 0.35).fillRect(0, EP.top + EP.h - 6, WIDTH, 6);
    this.enemyFrame = this.add.rectangle(1, EP.top + 1, WIDTH - 2, EP.h - 2).setOrigin(0).setStrokeStyle(2, hex(PALETTE.gold)).setVisible(false);
    const size = unitSize(e.sprite);
    const scale = size === 24 ? 3 : 4;
    this.add.ellipse(304, EP.top + 92, 60, 10, hex(PALETTE.ink), 0.4);
    this.enemySprite = unit(this, 304, EP.top + 94, e.sprite, scale, true);
    this.add.zone(304, EP.top + 50, 80, 96).setInteractive({ useHandCursor: true }).on('pointerup', () => this.enemyInfo());
    this.enemyName = text(this, 12, EP.top + 12, `${e.name}  Lv ${e.level}`, { origin: [0, 0.5], color: PALETTE.cream });
    this.enemyHp = bar(this, 12, EP.top + 32, 230, 18, PALETTE.red);
    this.enemyMana = this.manaBars(12, EP.top + 52, 54, 10, false);
    this.enemyStatus = this.add.container(0, 0);
    // Intent box
    const iy = EP.top + 78;
    const ib = this.add.rectangle(12, iy, 230, 30, hex(PALETTE.ink), 0.75).setOrigin(0, 0.5).setStrokeStyle(2, hex(PALETTE.indigo))
      .setInteractive({ useHandCursor: true });
    ib.on('pointerup', () => this.enemyInfo());
    this.intentBox = ib;
    this.intentIcon = icon(this, 26, iy, 'sp:2,0', 1.5);
    this.intentText = text(this, 40, iy, '', { origin: [0, 0.5], color: PALETTE.cream });
    this.intentNeed = text(this, 236, iy, '', { origin: [1, 0.5], color: PALETTE.lavender });
  }

  manaBars(x, y, w, h, labels) {
    return [0, 1, 2, 3].map((c) => bar(this, x + c * (w + 4), y, w, h, GEM_COLORS[c], { label: labels }));
  }

  drawHeroPanel() {
    const h = this.st.hero;
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.night)).fillRect(0, HP_TOP, WIDTH, HEIGHT - HP_TOP);
    g.fillStyle(hex(PALETTE.ink)).fillRect(0, HP_TOP, WIDTH, 3);
    this.heroFrame = this.add.rectangle(1, HP_TOP + 3, WIDTH - 2, 64).setOrigin(0).setStrokeStyle(2, hex(PALETTE.gold)).setVisible(false);
    this.heroSprite = unit(this, 26, HP_TOP + 46, h.sprite, 3);
    this.add.zone(26, HP_TOP + 26, 48, 48).setInteractive({ useHandCursor: true }).on('pointerup', () => this.heroInfo());
    this.heroName = text(this, 52, HP_TOP + 14, `${h.name}  Lv ${h.level}`, { origin: [0, 0.5] });
    this.goldText = text(this, WIDTH - 10, HP_TOP + 14, '', { origin: [1, 0.5], color: PALETTE.gold });
    this.heroHp = bar(this, 52, HP_TOP + 34, 196, 18, PALETTE.leaf);
    this.heroStatus = this.add.container(0, 0);
    this.heroMana = this.manaBars(12, HP_TOP + 58, 81, 16, true);
    // Skills 2 x 2
    this.skillBtns = [];
    const heroId = this.ctx.hero;
    HEROES[heroId].skills.forEach((id, k) => {
      const x = k % 2 === 0 ? 92 : 268;
      const y = SKILL_Y[Math.floor(k / 2)];
      const learned = h.skills.includes(id);
      const b = button(this, x, y, 172, 40, '', () => this.skillTap(id, learned, k), { fill: PALETTE.indigo, color: PALETTE.cream, silent: true });
      if (learned) {
        b.face.add(icon(this, -70, 0, SKILLS[id].icon, 1.5));
        const name = text(this, -56, 0, SKILLS[id].name, { origin: [0, 0.5], color: PALETTE.cream });
        b.face.add(name);
        const chips = this.add.container(0, 0);
        let cx = 80;
        SKILLS[id].cost.forEach((n, c) => {
          if (!n) return;
          const t = outlined(this, cx, 0, String(n), { origin: [1, 0.5], color: GEM_COLORS[c] });
          chips.add(t);
          cx -= t.width + 4;
        });
        b.face.add(chips);
        b.nameText = name;
      } else {
        b.label.setText(`Opens at Lv ${SKILL_LEVELS[k]}`).setColor(PALETTE.lavender);
      }
      b.skill = id;
      b.learned = learned;
      this.skillBtns.push(b);
    });
  }

  statusRow(container, f, x, y, dir = 1) {
    container.removeAll(true);
    const list = [];
    if (f.st.shield) list.push(['shield', f.st.shield]);
    if (f.st.poisonT) list.push(['poison', f.st.poison]);
    if (f.st.stun) list.push(['stun', f.st.stun]);
    if (f.st.rageT) list.push(['rage', f.st.rage]);
    if (f.st.weakT) list.push(['weak', f.st.weak]);
    list.forEach(([k, n], i) => {
      const bx = x + dir * i * 26;
      container.add(icon(this, bx, y, STATUS_ICONS[k], 1));
      container.add(outlined(this, bx + 6, y + 6, String(n)));
    });
  }

  refresh() {
    const { hero, enemy } = this.st;
    this.enemyHp.set(enemy.hp, enemy.maxHp);
    this.heroHp.set(hero.hp, hero.maxHp);
    this.enemyMana.forEach((b, c) => b.set(enemy.mana[c], enemy.cap));
    this.heroMana.forEach((b, c) => b.set(hero.mana[c], hero.cap, String(hero.mana[c])));
    this.statusRow(this.enemyStatus, enemy, 262, EP.top + 14, -1);
    this.statusRow(this.heroStatus, hero, 264, HP_TOP + 34);
    this.goldText.setText(this.ctx.mode === 'daily' ? `Turn ${this.st.heroTurns}` : `${this.st.gold} gold`);
    if (this.st.rules?.turnLimit) this.goldText.setText(`Turn ${Math.min(this.st.heroTurns, this.st.rules.turnLimit)}/${this.st.rules.turnLimit}`);
    this.refreshIntent();
    this.refreshSkills();
    const mine = this.st.turn === 'hero' && !this.st.over;
    this.heroFrame.setVisible(mine);
    this.enemyFrame.setVisible(!mine && !this.st.over);
  }

  refreshIntent() {
    const it = intent(this.st);
    const sk = SKILLS[it.skill];
    this.intentIcon.setFrame(`i:${sk.icon}`);
    const main = sk.fx.find((f) => f.k === 'dmg' || f.k === 'leech');
    const v = main ? ` ${fxValue(main, this.st.enemy.level, this.st.enemy.power)}` : '';
    this.intentText.setText(`${sk.name}${v}`);
    this.intentNeed.setText(it.ready ? 'READY' : `${it.have}/${it.need}`).setColor(it.ready ? PALETTE.orange : PALETTE.lavender);
    this.intentBox.setStrokeStyle(2, hex(it.ready ? PALETTE.orange : PALETTE.indigo));
  }

  refreshSkills() {
    const mine = this.st.turn === 'hero' && !this.busy && !this.st.over;
    for (const b of this.skillBtns) {
      if (!b.learned) { b.setAlpha(0.5); continue; }
      const can = canAfford(this.st.hero, b.skill);
      b.setAlpha(can ? 1 : 0.55);
      b.body.setFillStyle(hex(can && mine ? PALETTE.plum : PALETTE.indigo));
      if (can && mine && !b.glow) {
        b.glow = this.tweens.add({ targets: b.body, alpha: 0.7, duration: 450, yoyo: true, repeat: -1 });
      } else if (!(can && mine) && b.glow) { b.glow.stop(); b.glow = null; b.body.setAlpha(1); }
    }
    if (mine && !seen('tut-skill') && this.skillBtns.some((b) => b.learned && canAfford(this.st.hero, b.skill))) this.coach('skill');
  }

  // ------------------------------------------------------------------ player actions

  heroSwap(a, b) {
    if (this.busy || this.st.turn !== 'hero' || this.st.over || this.ended) return;
    const res = move(this.st, 'hero', a, b);
    this.busy = true;
    this.board.setEnabled(false);
    this.hinted = false;
    this.idle = 0;
    if (res.ok) this.saveNow();
    this.playEvents(res.events).then(() => {
      if (!res.ok) { this.busy = false; this.board.setEnabled(true); return; }
      if (this.tut && this.tutStep === 1) this.tutStep = 2;
      this.afterAction();
    });
  }

  skillTap(id, learned, k) {
    if (this._modals) return;
    sfx('tap');
    const h = this.st.hero;
    if (!learned) { info(this, SKILLS[id].name, `${describe(id, Math.max(h.level, SKILL_LEVELS[k]), h.power)}\n\nYour hero learns this at level ${SKILL_LEVELS[k]}.`); return; }
    const ready = canCast(this.st, 'hero', id) && !this.busy;
    const cost = SKILLS[id].cost.map((n, c) => (n ? `${n} ${['red', 'blue', 'green', 'yellow'][c]}` : '')).filter(Boolean).join(' + ');
    const have = SKILLS[id].cost.map((n, c) => (n ? `${h.mana[c]}/${n}` : '')).filter(Boolean).join(', ');
    let why = '';
    if (!canAfford(h, id)) why = `\nYou have ${have}.`;
    else if (this.st.turn !== 'hero' || this.busy) why = '\nWait for your turn.';
    const buttons = [];
    if (ready) buttons.push(['Cast', (close) => { close(); this.heroCast(id); }, PALETTE.gold]);
    buttons.push(['Close', (close) => close(), PALETTE.lavender]);
    modal(this, SKILLS[id].name, `${describe(id, h.level, h.power)}\nCost: ${cost}.${why}`, buttons, { row: true, art: { make: (x, y) => icon(this, x, y, SKILLS[id].icon, 4) } });
  }

  heroCast(id) {
    if (this.busy || !canCast(this.st, 'hero', id) || this.ended) return;
    const res = cast(this.st, 'hero', id);
    if (!res.ok) return;
    markSeen('tut-skill');
    this.hideCoach('skill');
    this.busy = true;
    this.board.setEnabled(false);
    this.saveNow();
    this.refreshSkills();
    this.playEvents(res.events).then(() => this.afterAction());
  }

  /** After any action: trophies, end of battle, the monster's turn or the player's. */
  afterAction(resumed = false) {
    if (!this.scene.isActive() && !this.scene.isPaused()) return;
    checkBattleTrophies(this.st);
    this.refresh();
    if (this.st.over) { this.finish(); return; }
    if (this.st.turn === 'enemy') { this.runEnemy(resumed); return; }
    this.busy = false;
    this.board.setEnabled(true);
    this.refresh();
    this.tutorialTick();
  }

  async runEnemy(first) {
    this.busy = true;
    this.board.setEnabled(false);
    this.refreshSkills();
    if (this.tut && this.tutStep === 2) { this.tutStep = 3; this.coach('enemy'); }
    await this.board.wait(first ? 400 : 650);
    if (this.ended || this.st.over || this.st.turn !== 'enemy') { this.afterAction(); return; }
    const choice = enemyChoice(this.st, this.ai);
    if (!choice) { this.afterAction(); return; }
    let res;
    if (choice.type === 'move') {
      // Show which gems the monster grabs before it swaps them.
      this.board.select(choice.a);
      await this.board.wait(260);
      this.board.select(choice.b);
      await this.board.wait(220);
      this.board.select(-1);
      res = move(this.st, 'enemy', choice.a, choice.b);
    } else res = cast(this.st, 'enemy', choice.skill);
    this.saveNow();
    await this.playEvents(res.events);
    if (this.tut && this.tutStep === 3) { this.tutStep = 4; this.hideCoach('enemy'); }
    this.afterAction();
  }

  showHint() {
    const m = hintMove(this.st);
    if (m) this.board.hint(m.a, m.b);
  }

  // ------------------------------------------------------------------ event playback

  sideSprite(side) { return side === 'hero' ? this.heroSprite : this.enemySprite; }

  async playEvents(events) {
    for (const ev of events) {
      if (!this.sys.isActive()) return;
      switch (ev.t) {
        case 'board': await this.board.play(ev.steps); break;
        case 'convert': await this.board.playConvert(ev.cells); break;
        case 'cast': {
          const sk = SKILLS[ev.skill];
          playOnce(this.sideSprite(ev.side), 'attack');
          sfx('power');
          const y = ev.side === 'hero' ? HP_TOP - 30 : EP.top + EP.h + 24;
          const banner = this.add.container(WIDTH / 2, y).setDepth(88);
          const w = Math.max(160, sk.name.length * 10 + 70);
          banner.add(this.add.rectangle(0, 0, w, 40, hex(PALETTE.ink), 0.9).setStrokeStyle(2, hex(ev.side === 'hero' ? PALETTE.gold : PALETTE.orange)));
          banner.add(icon(this, -w / 2 + 22, 0, sk.icon, 1.5));
          banner.add(text(this, 12, 0, sk.name, { color: ev.side === 'hero' ? PALETTE.gold : PALETTE.orange }));
          this.tweens.add({ targets: banner, alpha: 0, delay: 700, duration: 250, onComplete: () => banner.destroy() });
          await this.board.wait(550);
          break;
        }
        case 'dmg': {
          const spr = this.sideSprite(ev.side);
          playOnce(spr, 'hit');
          if (ev.src === 'skull' || ev.src === 'skill') playOnce(this.sideSprite(ev.side === 'hero' ? 'enemy' : 'hero'), 'attack');
          const fx = ev.side === 'hero' ? 150 : 304;
          const fy = ev.side === 'hero' ? HP_TOP + 10 : EP.top + 40;
          if (ev.amount > 0) floatText(this, fx, fy, `-${ev.amount}`, ev.side === 'hero' ? PALETTE.orange : PALETTE.cream);
          if (ev.blocked) floatText(this, fx, fy + 22, `${ev.blocked} blocked`, '#8fc3ff', 16);
          sfx(ev.amount >= 15 ? 'boom' : 'hit');
          if (ev.amount >= 15) this.cameras.main.shake(160, 0.006);
          const f = this.st[ev.side];
          (ev.side === 'hero' ? this.heroHp : this.enemyHp).set(ev.hp, f.maxHp);
          this.statusRowFor(ev.side, { shield: ev.shield });
          await this.board.wait(260);
          break;
        }
        case 'heal': {
          const f = this.st[ev.side];
          (ev.side === 'hero' ? this.heroHp : this.enemyHp).set(ev.hp, f.maxHp);
          floatText(this, ev.side === 'hero' ? 150 : 304, ev.side === 'hero' ? HP_TOP + 10 : EP.top + 40, `+${ev.amount}`, '#8fd16a');
          sfx('coin');
          await this.board.wait(220);
          break;
        }
        case 'shield': case 'status': {
          const label = { shield: 'Shield', poison: 'Poisoned', stun: 'Stunned', rage: 'Rage', weak: 'Weakened' }[ev.key || 'shield'];
          floatText(this, ev.side === 'hero' ? 150 : 304, ev.side === 'hero' ? HP_TOP + 10 : EP.top + 40, label, PALETTE.sand, 16);
          this.statusRowFor(ev.side);
          await this.board.wait(220);
          break;
        }
        case 'mana': {
          const bars = ev.side === 'hero' ? this.heroMana : this.enemyMana;
          const f = this.st[ev.side];
          bars.forEach((b, c) => b.set(ev.mana[c], f.cap, ev.side === 'hero' ? String(ev.mana[c]) : undefined));
          break;
        }
        case 'gold':
          this.goldText.setText(`${ev.total} gold`);
          if (!this.st.rules?.turnLimit && this.ctx.mode !== 'daily') floatText(this, WIDTH - 40, HP_TOP + 14, `+${ev.amount}`, PALETTE.gold, 16);
          break;
        case 'extra':
          sfx('goal');
          toast(this, ev.side === 'hero' ? 'Extra turn!' : `${this.st.enemy.name} goes again!`, BOARD.y + 150, ev.side === 'hero' ? PALETTE.gold : PALETTE.orange, 700);
          await this.board.wait(500);
          break;
        case 'turn': this.showTurn(ev.side); break;
        case 'poison': {
          const f = this.st[ev.side];
          (ev.side === 'hero' ? this.heroHp : this.enemyHp).set(ev.hp, f.maxHp);
          floatText(this, ev.side === 'hero' ? 150 : 304, ev.side === 'hero' ? HP_TOP + 10 : EP.top + 40, `-${ev.amount}`, '#a0d060');
          sfx('hit');
          await this.board.wait(300);
          break;
        }
        case 'stunned':
          toast(this, ev.side === 'hero' ? 'You are stunned!' : `${this.st.enemy.name} is stunned!`, BOARD.y + 150, PALETTE.sand, 700);
          await this.board.wait(650);
          break;
        default: break;
      }
    }
    this.refresh();
  }

  statusRowFor(side) {
    if (side === 'hero') this.statusRow(this.heroStatus, this.st.hero, 264, HP_TOP + 34);
    else this.statusRow(this.enemyStatus, this.st.enemy, 262, EP.top + 14, -1);
  }

  showTurn(side) {
    const mine = side === 'hero';
    this.heroFrame.setVisible(mine);
    this.enemyFrame.setVisible(!mine);
    this.turnLabel.setText(mine ? 'Your turn' : `${this.st.enemy.name}'s turn`).setColor(mine ? PALETTE.gold : PALETTE.orange);
    this.tweens.killTweensOf(this.turnLabel);
    this.turnLabel.setAlpha(1);
    this.tweens.add({ targets: this.turnLabel, alpha: 0, delay: 450, duration: 300 });
  }

  // ------------------------------------------------------------------ info popups

  enemyInfo() {
    if (this._modals) return;
    sfx('select');
    const e = this.st.enemy;
    const it = intent(this.st);
    const lines = [`HP ${e.hp}/${e.maxHp}. Each skull it matches deals ${skullHit(e)} damage.`, ''];
    lines.push(`Charging: ${SKILLS[it.skill].name}${it.ready ? ' (ready: it casts on its turn)' : ` (${it.have}/${it.need} mana)`}.`);
    lines.push('', 'Its skills:');
    for (const id of e.skills) lines.push(`${SKILLS[id].name} (${this.costText(id)}): ${describe(id, e.level, e.power)}`);
    lines.push(...this.statusLines(e));
    info(this, e.name, lines.join('\n'), { width: 340 });
  }

  heroInfo() {
    if (this._modals) return;
    sfx('select');
    const h = this.st.hero;
    const lines = [`HP ${h.hp}/${h.maxHp}. Each skull you match deals ${skullHit(h)} damage.`, `Mana: ${h.mana.join(' / ')} (max ${h.cap}).`];
    lines.push(...this.statusLines(h));
    info(this, `${h.name}  Lv ${h.level}`, lines.join('\n'), { width: 340 });
  }

  statusLines(f) {
    const out = [];
    if (f.st.shield) out.push(`Shield: soaks the next ${f.st.shield} damage.`);
    if (f.st.poisonT) out.push(`Poison: ${f.st.poison} damage a turn, ${f.st.poisonT} turns left.`);
    if (f.st.stun) out.push(`Stunned: skips ${f.st.stun} turn${f.st.stun > 1 ? 's' : ''}.`);
    if (f.st.rageT) out.push(`Rage: skulls +${f.st.rage}.`);
    if (f.st.weakT) out.push(`Weak: skulls -${f.st.weak}.`);
    return out.length ? ['', ...out] : [];
  }

  costText(id) {
    return SKILLS[id].cost.map((n, c) => (n ? `${n}${'RBGY'[c]}` : '')).filter(Boolean).join(' ');
  }

  // ------------------------------------------------------------------ tutorial

  tutorialTick() {
    if (!this.tut) return;
    if (this.tutStep === 0) {
      this.tutStep = 1;
      this.coach('swap');
      this.showHint();
    } else if (this.tutStep === 4) {
      this.tutStep = 5;
      this.coach('gems');
    } else if (this.tutStep === 5) {
      this.tutStep = 6;
      this.hideCoach('gems');
      this.coach('intent');
    } else if (this.tutStep === 6) {
      this.tutStep = 7;
      this.hideCoach('intent');
    }
  }

  /** Coach box over the monster panel (tap it to hide). */
  coach(key) {
    const msgs = {
      swap: 'Swipe a gem onto a neighbour to swap them. Line up 3 of a kind! (The glowing pair works.)',
      enemy: 'Now the monster takes its turn on the same board.',
      gems: 'Skulls hit the monster. Red, blue, green and yellow gems fill your mana bars for skills.',
      intent: 'The box under its HP shows the skill the monster is charging. Match those colours first to slow it.',
      skill: 'A skill is ready! Tap it to read it, then tap Cast.',
    };
    if (this.coachBox?.key === key) return;
    this.hideCoach();
    const c = this.add.container(0, 0).setDepth(95);
    const y = key === 'skill' ? HP_TOP - 58 : EP.top + 2;
    const h = key === 'skill' ? 52 : EP.h - 4;
    c.add(this.add.rectangle(4, y, WIDTH - 8, h, hex(PALETTE.night), 0.96).setOrigin(0).setStrokeStyle(3, hex(PALETTE.gold))
      .setInteractive().on('pointerup', () => this.hideCoach()));
    c.add(text(this, WIDTH / 2, y + h / 2, msgs[key], { wrap: WIDTH - 36, color: PALETTE.cream }));
    c.key = key;
    this.coachBox = c;
    if (key === 'skill') {
      const b = this.skillBtns.find((s) => s.learned && canAfford(this.st.hero, s.skill));
      if (b) { this.coachArrow = this.tweens.add({ targets: b, y: b.y - 4, duration: 300, yoyo: true, repeat: -1 }); this.coachArrowTarget = b; }
    }
  }

  hideCoach(key) {
    if (!this.coachBox || (key && this.coachBox.key !== key)) return;
    if (this.coachBox.key === 'skill') markSeen('tut-skill');
    this.coachBox.destroy();
    this.coachBox = null;
    if (this.coachArrow) { this.coachArrow.stop(); this.coachArrowTarget.y = SKILL_Y[this.skillBtns.indexOf(this.coachArrowTarget) >> 1]; this.coachArrow = null; }
  }

  // ------------------------------------------------------------------ saving, pausing, ending

  saveNow() {
    if (this.st.over) return;
    setBattle({ battle: this.st, ctx: this.ctx });
  }

  pauseMenu() {
    if (this._modals || this.ended) return;
    const leaveTo = this.ctx.mode === 'campaign' ? 'WorldMap' : this.ctx.mode === 'tower' ? 'Tower' : 'Menu';
    modal(this, 'Paused', 'The battle is saved. You can come back to it any time.', [
      ['Resume', (close) => close()],
      ['Save & leave', (close) => { close(); this.saveNow(); go(this, leaveTo); }, PALETTE.lavender],
      ['Give up', (close) => {
        close();
        modal(this, 'Give up?', 'The battle counts as a loss.', [
          ['Give up', (c2) => { c2(); this.surrender(); }, PALETTE.red, PALETTE.cream],
          ['Keep fighting', (c2) => c2()],
        ]);
      }, PALETTE.red, PALETTE.cream],
    ]);
  }

  surrender() {
    if (this.st.over || this.busy) {
      if (this.busy && !this.st.over) { toast(this, 'Wait a moment...', BOARD.y + 150); return; }
    }
    this.st.over = 'lose';
    this.st.reason = 'gave up';
    this.finish();
  }

  finish() {
    if (this.ended) return;
    this.ended = true;
    this.busy = true;
    this.board.setEnabled(false);
    this.hideCoach();
    const won = this.st.over === 'win';
    if (this.tut) markSeen('tut-battle');
    clearBattle();
    if (won) { playOnce(this.enemySprite, 'hit'); this.tweens.add({ targets: this.enemySprite, alpha: 0, duration: 600, delay: 200 }); sfx('win'); } else sfx('lose');
    stat('battles');
    if (won) {
      stat('wins');
      give('first-win');
      if (this.st.hero.hp <= 5) give('close-call');
    }
    stat('gems', this.st.stats.gems);
    this.time.delayedCall(900, () => {
      if (this.ctx.mode === 'campaign') this.finishCampaign(won);
      else if (this.ctx.mode === 'tower') this.finishTower(won);
      else this.finishDaily(won);
    });
  }

  finishCampaign(won) {
    const p = getProgress();
    const node = findNode(this.ctx.node);
    const r = PR.finishCampaignBattle(p, this.ctx.node, this.st, this.ctx.hero);
    setProgress(p);
    if (this.st.reason !== 'gave up') reportResult(won, won ? this.st.hero.hp / this.st.hero.maxHp : 1 - this.st.enemy.hp / this.st.enemy.maxHp);
    if (won && this.ctx.node === 'b0-8') give('boss-1');
    if (won && this.ctx.node === 'b3-8') give('champion');
    if (PR.heroIds(p).length >= 4) give('party');
    if (PR.heroIds(p).some((id) => p.heroes[id].lvl >= 10)) give('level-10');
    if (PR.questsDone(p)) give('quests');
    const lines = [];
    if (won) lines.push(`+${r.xp} XP for ${HEROES[this.ctx.hero].name}`, `+${r.gold} gold (you have ${p.gold})`);
    else lines.push(this.st.reason === 'time' ? 'Out of turns!' : `${this.st.enemy.name} wins this time.`, `+${r.xp} XP and ${r.gold} gold for trying.`);
    for (const [id, n] of Object.entries(r.levelUps)) if (n > 0) lines.push(`${HEROES[id].name} is now level ${p.heroes[id].lvl}!`);
    if (r.item) lines.push(`Reward: ${this.gearName(r.item)}! Equip it on the Heroes screen.`);
    for (const id of r.joined) lines.push(`${HEROES[id].name} joins your party!`);
    if (r.boss && won && r.firstClear) lines.push(node.region < 3 ? `The road to ${REGIONS[node.region + 1].name} is open.` : 'The Rift is sealed. You win the campaign!');
    if (Object.values(r.levelUps).some((n) => n > 0)) sfx('power');
    const title = won ? (node.region === 3 && node.kind === 'boss' ? 'Dragon slain!' : 'Victory!') : 'Defeated';
    const buttons = won
      ? [['Continue', () => go(this, 'WorldMap', { region: node.region, justWon: this.ctx.node })]]
      : [['Try again', () => this.retry()], ['Back to map', () => go(this, 'WorldMap', { region: node.region }), PALETTE.lavender]];
    modal(this, title, lines.join('\n'), buttons, { width: 330 });
  }

  gearName(id) { return GEAR[id]?.name || id; }

  retry() {
    const p = getProgress();
    const { battle, ctx } = PR.campaignBattle(p, this.ctx.node, (Math.random() * 2 ** 31) >>> 0);
    setBattle({ battle, ctx });
    go(this, 'Battle', { battle, ctx });
  }

  finishTower(won) {
    const p = getProgress();
    const tower = save.get('tower');
    if (this.st.reason !== 'gave up') reportResult(won, won ? this.st.hero.hp / this.st.hero.maxHp : 1 - this.st.enemy.hp / this.st.enemy.maxHp);
    const floor = this.ctx.floor;
    const best = Math.max(save.get('towerBest') || 0, won ? floor : floor - 1);
    save.set('towerBest', best);
    if (best >= 10) give('tower-10');
    if (best >= 25) give('tower-25');
    if (won) {
      const gold = PR.towerGold(floor) + this.st.gold;
      p.gold += gold;
      setProgress(p);
      const hp = PR.towerHeal(this.st.hero.hp, this.st.hero.maxHp);
      save.set('tower', { ...tower, floor: floor + 1, hp });
      modal(this, `Floor ${floor} cleared!`, `+${gold} gold for the campaign.\nYou rest and heal to ${hp}/${this.st.hero.maxHp} HP.\nBest floor: ${best}.`, [
        ['Next floor', () => this.nextFloor()],
        ['Rest (leave tower)', () => go(this, 'Tower'), PALETTE.lavender],
      ], { width: 330 });
    } else {
      p.gold += this.st.gold;
      setProgress(p);
      save.set('tower', null);
      modal(this, 'The climb ends', `You fell on floor ${floor}.\nBest floor: ${best}.${this.st.gold ? `\n+${this.st.gold} gold from coins.` : ''}`, [['OK', () => go(this, 'Tower')]]);
    }
  }

  nextFloor() {
    const p = getProgress();
    const { battle, ctx } = PR.towerBattle(p, save.get('tower'));
    setBattle({ battle, ctx });
    go(this, 'Battle', { battle, ctx });
  }

  finishDaily(won) {
    const score = PR.dailyScore(this.st);
    let res = null;
    if (this.ctx.day === today()) res = reportDaily(GAME_ID, score);
    give('daily');
    const lines = [won ? `You won in ${this.st.heroTurns} turns with ${this.st.hero.hp} HP left.` : `You dealt ${this.st.stats.dmgDealt} damage.`, `Score: ${score}`];
    if (res) lines.push(`Today's best: ${res.best}${res.isBest ? ' (new!)' : ''}`, `Streak: ${res.streak} day${res.streak === 1 ? '' : 's'}`);
    modal(this, won ? 'Duel won!' : 'Duel lost', lines.join('\n'), [['Done', () => go(this, 'Menu')]]);
  }
}

