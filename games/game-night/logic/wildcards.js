// Wild Cards: an Uno-style shedding game. You (player 0) vs 2 CPUs.
// Card: { color: 0..3 | null (wild), value: 0..9 | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4' }
// Simplified house rules: no challenging +4, no stacking draws, a drawn card may be played at once.

export const COLORS = ['Red', 'Orange', 'Blue', 'Green'];
export const HAND = 7;

export function newDeck(rng = Math.random) {
  const d = [];
  for (let c = 0; c < 4; c++) {
    d.push({ color: c, value: 0 });
    for (let k = 0; k < 2; k++) {
      for (let v = 1; v <= 9; v++) d.push({ color: c, value: v });
      for (const v of ['skip', 'reverse', 'draw2']) d.push({ color: c, value: v });
    }
  }
  for (let k = 0; k < 4; k++) { d.push({ color: null, value: 'wild' }); d.push({ color: null, value: 'wild4' }); }
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

export function newRound(players = 3, rng = Math.random) {
  const deck = newDeck(rng);
  const hands = Array.from({ length: players }, () => deck.splice(0, HAND));
  // The first discard must be a plain number.
  let k = deck.findIndex((c) => typeof c.value === 'number');
  const [first] = deck.splice(k, 1);
  return { deck, discard: [first], hands, turn: 0, dir: 1, color: first.color, rng };
}

const isWild = (c) => c.value === 'wild' || c.value === 'wild4';
export const top = (r) => r.discard[r.discard.length - 1];

export function canPlay(r, card) {
  if (isWild(card)) return true;
  const t = top(r);
  return card.color === r.color || card.value === t.value;
}

export const playableIdx = (r, p) => r.hands[p].map((c, i) => (canPlay(r, c) ? i : -1)).filter((i) => i >= 0);

export const nextPlayer = (r, steps = 1) => {
  const n = r.hands.length;
  return (((r.turn + r.dir * steps) % n) + n) % n;
};

function drawCards(r, p, n) {
  for (let k = 0; k < n; k++) {
    if (!r.deck.length) {
      // Reshuffle the discard pile (except the top card) into a new deck.
      const keep = r.discard.pop();
      r.deck = r.discard.map((c) => (isWild(c) ? { ...c, color: null } : c));
      for (let i = r.deck.length - 1; i > 0; i--) { const j = Math.floor(r.rng() * (i + 1)); [r.deck[i], r.deck[j]] = [r.deck[j], r.deck[i]]; }
      r.discard = [keep];
      if (!r.deck.length) return;
    }
    r.hands[p].push(r.deck.pop());
  }
}

/** Play hand[p][i]. chosenColor needed for wilds. Mutates and returns an event summary. */
export function play(r, p, i, chosenColor) {
  const [card] = r.hands[p].splice(i, 1);
  const placed = isWild(card) ? { ...card, color: chosenColor } : card;
  r.discard.push(placed);
  r.color = placed.color;
  const ev = { card: placed, player: p, effect: null };
  if (card.value === 'reverse') {
    r.dir = -r.dir;
    ev.effect = 'reverse';
    // With two players a reverse acts like a skip.
    r.turn = r.hands.length === 2 ? p : nextPlayer(r);
  } else if (card.value === 'skip') {
    ev.effect = 'skip'; ev.target = nextPlayer(r);
    r.turn = nextPlayer(r, 2);
  } else if (card.value === 'draw2' || card.value === 'wild4') {
    const target = nextPlayer(r);
    const n = card.value === 'draw2' ? 2 : 4;
    drawCards(r, target, n);
    ev.effect = `draw${n}`; ev.target = target;
    r.turn = nextPlayer(r, 2);
  } else {
    r.turn = nextPlayer(r);
  }
  return ev;
}

/** Draw one card for the player whose turn it is. Returns its index in their hand. */
export function drawOne(r) {
  drawCards(r, r.turn, 1);
  return r.hands[r.turn].length - 1;
}

export const passTurn = (r) => { r.turn = nextPlayer(r); };

export const winner = (r) => r.hands.findIndex((h) => h.length === 0);

/** Most common colour in a hand (for choosing a wild colour). */
export function favouriteColor(hand) {
  const n = [0, 0, 0, 0];
  for (const c of hand) if (c.color !== null) n[c.color]++;
  return n.indexOf(Math.max(...n));
}

/** CPU choice: index to play (or -1 to draw). */
export function cpuPick(r, p) {
  const opts = playableIdx(r, p);
  if (!opts.length) return -1;
  const nextCount = r.hands[nextPlayer(r)].length;
  const score = (c) => {
    if (c.value === 'wild4') return nextCount <= 2 ? 50 : -20;
    if (c.value === 'wild') return -10;                    // save wilds for later
    if (typeof c.value !== 'number') return nextCount <= 2 ? 30 : 8;
    return c.value;                                        // dump high numbers first
  };
  return opts.sort((a, b) => score(r.hands[p][b]) - score(r.hands[p][a]))[0];
}
