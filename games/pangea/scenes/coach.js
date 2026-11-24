// The guided first game: a strip under the top bar with one tip at a time, a pulsing ring on the
// unit it talks about, and a hint inside the city and research panels. Progress is saved with the
// game (s.coach), so a reload carries on from the same tip.
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import * as G from '../logic/game.js';
import * as P from './panels.js';
import { save } from '../save.js';

const T = 16;
const STEPS = [
  { id: 'select', msg: 'Welcome! This is your Settler. Tap it to select it.', ring: 'settler' },
  { id: 'found', msg: 'Tap Found City (bottom) to build your capital right here.', ring: 'settler' },
  { id: 'build', msg: 'Tap your city to choose what it builds.', panel: 'Pick something to build. A Warrior guards the city; Settlers found new cities. Add one or two, then tap Done.' },
  { id: 'research', msg: 'Tap Tech to choose what your scholars study.', panel: 'Choose a technology. Pottery leads to Writing and libraries; Bronze Working gives Spearmen. Then tap Done.' },
  { id: 'explore', msg: 'Tap your Warrior, then tap a light tile to explore.', ring: 'warrior' },
  { id: 'worker', msg: 'Tap your Worker. On your own land it can build a Farm or a Mine.', ring: 'worker' },
  { id: 'end', msg: 'Done for now? Tap End Turn. Cities grow and build between turns.' },
  { id: 'tips', msg: 'Found more cities, keep the Joy number happy, and research toward the Space Ark. Tap ? for help.', last: true },
];
export const COACH_STEPS = STEPS.length;

export class Coach {
  constructor(scene) {
    this.scene = scene;
    this.s = scene.s;
    this.box = null;
    this.ring = scene.add.circle(0, 0, 11).setStrokeStyle(1.5, hex(PALETTE.gold)).setVisible(false);
    scene.world.add(this.ring);
    scene.tweens.add({ targets: this.ring, scale: 1.25, alpha: 0.4, yoyo: true, repeat: -1, duration: 500 });
  }

  step() { return this.s.tutorial ? (this.s.coach || 0) : STEPS.length; }
  /** A tip that wants the player's attention (the last tip doesn't hold up the usual prompts). */
  active() { return this.step() < STEPS.length - 1 && this.scene.myTurn(); }

  start() {
    if (!this.s.tutorial) return;
    this.refresh();
    const st = STEPS[this.step()];
    if (st?.id === 'research' && !this.s.civs[this.scene.me].research) this.openResearch();
  }

  advance(to) {
    const n = to ?? this.step() + 1;
    if (n <= this.step()) return;
    this.s.coach = n;
    this.scene.saveSoon();
    this.refresh();
    const st = STEPS[n];
    if (st?.id === 'research') this.scene.time.delayedCall(250, () => this.openResearch());
  }

  openResearch() {
    if (P.anyOpen()) return;
    this.scene.coachText = STEPS[3].panel;
    P.showTech(this.scene, { onClose: () => { this.scene.coachText = null; if (this.s.civs[this.scene.me].research) this.advance(4); } });
  }

  event(kind, obj) {
    if (!this.s.tutorial || this.step() >= STEPS.length) return;
    const id = STEPS[this.step()].id;
    const me = this.scene.me;
    if (id === 'select' && kind === 'selected' && obj?.type === 'settler') this.advance(1);
    else if ((id === 'select' || id === 'found') && kind === 'founded') { this.advance(2); this.scene.coachText = STEPS[2].panel; }
    else if (id === 'build' && kind === 'cityClosed') {
      this.scene.coachText = null;
      if (G.citiesOf(this.s, me).some((c) => c.queue.length)) this.advance(3);
    } else if (id === 'build' && kind === 'queued') { /* wait for the panel to close */ }
    else if (id === 'research' && kind === 'research') { /* advanced when the panel closes */ }
    else if (id === 'explore' && kind === 'moved' && obj && !obj.type.match(/settler|worker/)) this.advance(5);
    else if (id === 'worker' && kind === 'job') this.advance(6);
    else if (kind === 'endTurn' && this.step() >= 4 && this.step() < 7) this.advance(7);
    this.refresh();
  }

  /** Taps on the tip strip don't reach the map. */
  blocks(p) { return !!(this.box && this.box.visible && p.y <= this.boxBottom); }

  refresh() {
    const sc = this.scene;
    if (this.box) { this.box.destroy(); this.box = null; }
    this.ring.setVisible(false);
    const n = this.step();
    if (n >= STEPS.length || !sc.myTurn()) return;
    const st = STEPS[n];
    if (st.id === 'build' && P.anyOpen()) this.scene.coachText = st.panel;
    const c = sc.add.container(0, 0);
    sc.hud.add(c);
    const top = 62;
    const t = text(sc, 12, top + 8, st.msg, { origin: [0, 0], wrap: st.last ? 330 : 262, align: 'left', color: PALETTE.cream });
    const h = Math.max(48, t.height + 16 + (st.last ? 50 : 0));
    const bg = sc.add.rectangle(4, top, 352, h, hex(PALETTE.wine), 0.95).setOrigin(0).setStrokeStyle(2, hex(PALETTE.gold));
    c.add([bg, t]);
    if (st.last) c.add(button(sc, 300, top + h - 26, 100, 40, 'Got it', () => this.finish(), { fill: PALETTE.gold }));
    else c.add(button(sc, 316, top + 24, 70, 40, 'Skip', () => this.skipAll(), { fill: PALETTE.indigo, color: PALETTE.cream }));
    this.box = c;
    this.boxBottom = top + h + 4;
    if (st.ring) {
      const u = G.unitsOf(this.s, sc.me).find((x) => x.type === st.ring || (st.ring === 'warrior' && !G.isCivilian(x)));
      if (u) { this.ring.setPosition(u.x * T + T / 2, u.y * T + T / 2).setVisible(true); sc.ensureVisible(u.x, u.y); }
    }
  }

  skipAll() {
    P.confirm({ title: 'Skip the tips?', text: 'You can read everything again under the ? button.', yes: 'Skip tips', onYes: () => this.finish() });
  }

  finish() {
    this.s.coach = STEPS.length;
    this.scene.coachText = null;
    this.refresh();
    this.scene.saveSoon();
    save.set('tutorialDone', true);
  }

  destroy() { this.box?.destroy(); this.box = null; }
}
