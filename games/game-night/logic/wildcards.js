// Wild Cards: an Uno-style shedding game following the official rules. You (player 0) vs 2 CPUs;
// player 2 deals, so you go first.
// Card: { color: 0..3 | null (wild), value: 0..9 | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4' }
//  - Match the top card by colour, number or symbol, or play a wild. You may always draw instead;
//    a drawn card that matches may be played straight away.
//  - Wild Draw Four is only legal when you hold no card of the current colour; it can be challenged.
//  - Call "Uno" when you go down to one card or draw 2 if caught. No stacking of draw cards.
//  - The round winner scores the cards left in the other hands; first to 500 wins.

export const COLORS = ['Red', 'Orange', 'Blue', 'Green'];
export const HAND = 7;
export const TARGET = 500;

export const cardPoints = (c) => (typeof c.value === 'number' ? c.value : c.value === 'wild' || c.value === 'wild4' ? 50 : 20);
export const handPoints = (hand) => hand.reduce((s, c) => s + cardPoints(c), 0);

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
  let deck = newDeck(rng);
  const hands = Array.from({ length: players }, () => deck.splice(0, HAND));
  // Turn over the first card. A Wild Draw Four goes back into the deck and another is turned.
  let first = deck.pop();
  while (first.value === 'wild4') {
    deck.unshift(first);
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    first = deck.pop();
  }
  const r = { deck, discard: [first], hands, turn: 0, dir: 1, color: first.color, rng, startEffect: null };
  // The first card's action applies to the first player (player 0, left of the dealer).
  if (first.value === 'skip') { r.turn = 1; r.startEffect = 'skip'; }
  else if (first.value === 'reverse') { r.dir = -1; r.turn = players - 1; r.startEffect = 'reverse'; }
  else if (first.value === 'draw2') { drawCards(r, 0, 2); r.turn = 1; r.startEffect = 'draw2'; }
  else if (first.value === 'wild') { r.color = null; r.startEffect = 'wild'; }   // first player picks the colour
  return r;
}

const isWild = (c) => c.value === 'wild' || c.value === 'wild4';
export const top = (r) => r.discard[r.discard.length - 1];

export function canPlay(r, card) {
  if (isWild(card)) return true;
  if (r.color === null) return true;   // opening wild before a colour is chosen
  const t = top(r);
  return card.color === r.color || card.value === t.value;
}

/** A Wild Draw Four is only legal when the player holds no card of the current colour. */
export const wild4Legal = (r, p) => !r.hands[p].some((c) => c.color === r.color);

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

/**
 * Play hand[p][i]. chosenColor needed for wilds. Mutates and returns an event summary.
 * A Wild Draw Four leaves r.pending4 = { offender, target, illegal } for resolveWild4().
 */
export function play(r, p, i, chosenColor) {
  const illegal4 = r.hands[p][i].value === 'wild4' && !wild4Legal(r, p);
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
  } else if (card.value === 'draw2') {
    const target = nextPlayer(r);
    drawCards(r, target, 2);
    ev.effect = 'draw2'; ev.target = target;
    r.turn = nextPlayer(r, 2);
  } else if (card.value === 'wild4') {
    ev.effect = 'wild4'; ev.target = nextPlayer(r);
    r.pending4 = { offender: p, target: ev.target, illegal: illegal4 };
  } else {
    r.turn = nextPlayer(r);
  }
  return ev;
}

/**
 * Settle a Wild Draw Four. challenge: did the target challenge it?
 * Not challenged: target draws 4 and is skipped. Challenged and the +4 was illegal: the offender
 * draws 4 and the challenger plays next. Challenged but legal: the challenger draws 6 and is skipped.
 * Returns 'accepted' | 'caught' | 'failed'.
 */
export function resolveWild4(r, challenge) {
  const { offender, target, illegal } = r.pending4;
  r.pending4 = null;
  if (challenge && illegal) { drawCards(r, offender, 4); r.turn = target; return 'caught'; }
  drawCards(r, target, challenge ? 6 : 4);
  r.turn = target; r.turn = nextPlayer(r);
  return challenge ? 'failed' : 'accepted';
}

/** Draw cards as a penalty (e.g. forgetting to call Uno). */
export const penalty = (r, p, n = 2) => drawCards(r, p, n);

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

/** CPU choice: index to play (or -1 to draw). CPUs only play a +4 legally. */
export function cpuPick(r, p) {
  const opts = playableIdx(r, p).filter((i) => r.hands[p][i].value !== 'wild4' || wild4Legal(r, p));
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
