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

/** Most common colour in a hand (for choosing a wild colour). With `avoid` (colours the next
 *  player has shown they lack), ties go to a colour they can't follow. */
export function favouriteColor(hand, avoidFor = null) {
  const n = [0, 0, 0, 0];
  for (const c of hand) if (c.color !== null) n[c.color] += 1;
  let best = 0;
  for (let k = 1; k < 4; k++) {
    const score = (x) => n[x] + (avoidFor?.has(x) ? 0.5 : 0);
    if (score(k) > score(best)) best = k;
  }
  return best;
}

// random / smart: chance a turn is played at random / with the card-tracking strategy
// (otherwise the plain strategy). uno: chance of remembering to call UNO. challenge: how often
// it challenges your +4 when it suspects a bluff.
export const LEVELS = {
  easy: { random: 0.7, smart: 0, uno: 0.6, challenge: 0.15 },
  normal: { random: 0, smart: 0, uno: 0.85, challenge: 0.3 },
  hard: { random: 0, smart: 1, uno: 1, challenge: 0.5 },
};
export const UNO_MEMORY = { easy: 0.6, normal: 0.85, hard: 1 };

/**
 * CPU choice: index to play (or -1 to draw). CPUs only play a +4 legally.
 * lacks: array of Sets, lacks[q] = colours player q has shown they don't hold (Hard uses it).
 */
export function cpuPick(r, p, { level = 'normal', cfg = LEVELS[level], lacks = null, rng = Math.random } = {}) {
  const opts = playableIdx(r, p).filter((i) => r.hands[p][i].value !== 'wild4' || wild4Legal(r, p));
  if (!opts.length) return -1;
  if (rng() < cfg.random) return opts[Math.floor(rng() * opts.length)];
  level = rng() < cfg.smart ? 'hard' : 'normal';
  const nxt = nextPlayer(r);
  const nextCount = r.hands[nxt].length;
  if (level === 'normal') {
    const score = (c) => {
      if (c.value === 'wild4') return nextCount <= 2 ? 50 : -20;
      if (c.value === 'wild') return -10;
      if (typeof c.value !== 'number') return nextCount <= 2 ? 30 : 8;
      return c.value;
    };
    return opts.sort((a, b) => score(r.hands[p][b]) - score(r.hands[p][a]))[0];
  }
  // Hard
  const hand = r.hands[p];
  const colourCount = [0, 0, 0, 0];
  for (const c of hand) if (c.color !== null) colourCount[c.color]++;
  const danger = nextCount <= 2;
  const leader = Math.min(...r.hands.map((h, q) => (q === p ? 99 : h.length)));
  const nonWild = opts.filter((i) => !['wild', 'wild4'].includes(hand[i].value));
  const score = (i) => {
    const c = hand[i];
    let v = 0;
    if (c.value === 'wild4') v = danger ? 60 : -40;
    else if (c.value === 'wild') v = nonWild.length ? -30 : 5;            // save wilds for when you're stuck
    else {
      v += typeof c.value === 'number' ? c.value * 0.6 : 0;               // shed points
      v += colourCount[c.color] * 2;                                       // stay in your strong colour
      if (lacks?.[nxt]?.has(c.color)) v += 8;                              // a colour the next player can't follow
      if (c.value === 'skip' || c.value === 'draw2') v += danger ? 45 : 4;
      if (c.value === 'reverse') {
        // Reverse is good if it sends the turn away from someone about to go out.
        const prev = (((p - r.dir) % r.hands.length) + r.hands.length) % r.hands.length;
        v += danger && r.hands[prev].length > nextCount ? 35 : 2;
      }
      if (leader <= 2 && typeof c.value !== 'number') v += 6;
    }
    return v + rng() * 0.5;
  };
  return opts.sort((a, b) => score(b) - score(a))[0];
}
