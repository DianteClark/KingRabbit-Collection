// Ten-pin scoring. rolls = pins knocked per ball, in order.

/** Frame-by-frame breakdown: [{ rolls: [..], score: running total | null }] for 10 frames. */
export function frames(rolls) {
  const out = [];
  let i = 0;
  let total = 0;
  for (let f = 0; f < 10; f++) {
    if (i >= rolls.length) { out.push({ rolls: [], score: null }); continue; }
    if (f === 9) {
      const r = rolls.slice(i, i + 3);
      const needThird = r.length >= 2 && (r[0] === 10 || r[0] + r[1] === 10);
      const done = needThird ? r.length === 3 : r.length >= 2;
      total += done ? r.reduce((a, b) => a + b, 0) : 0;
      out.push({ rolls: needThird ? r : r.slice(0, 2), score: done ? total : null });
      i += r.length;
      continue;
    }
    if (rolls[i] === 10) {
      const bonus = rolls.slice(i + 1, i + 3);
      const ready = bonus.length === 2;
      if (ready) total += 10 + bonus[0] + bonus[1];
      out.push({ rolls: [10], score: ready ? total : null });
      i += 1;
    } else {
      const two = rolls.slice(i, i + 2);
      if (two.length < 2) { out.push({ rolls: two, score: null }); i += 2; continue; }
      const spare = two[0] + two[1] === 10;
      const bonus = rolls[i + 2];
      const ready = !spare || bonus !== undefined;
      if (ready) total += two[0] + two[1] + (spare ? bonus : 0);
      out.push({ rolls: two, score: ready ? total : null });
      i += 2;
    }
    // A frame without a score blocks the running total for later frames.
    if (out[out.length - 1].score === null) {
      for (let k = f + 1; k < 10; k++) out.push({ rolls: [], score: null });
      // Still fill the raw rolls for display.
      let j = i;
      for (let k = f + 1; k < 10 && j < rolls.length; k++) {
        if (k === 9) { out[k].rolls = rolls.slice(j, j + 3); j += 3; }
        else if (rolls[j] === 10) { out[k].rolls = [10]; j += 1; }
        else { out[k].rolls = rolls.slice(j, j + 2); j += 2; }
      }
      return out;
    }
  }
  return out;
}

export function totalScore(rolls) {
  const fs = frames(rolls);
  let last = 0;
  for (const f of fs) if (f.score !== null) last = f.score;
  return last;
}

/** Where we are: { frame: 0..9, ball: 0..2, freshRack: bool, over: bool } */
export function position(rolls) {
  let i = 0;
  for (let f = 0; f < 9; f++) {
    if (i >= rolls.length) return { frame: f, ball: 0, freshRack: true, over: false };
    if (rolls[i] === 10) { i += 1; continue; }
    if (i + 1 >= rolls.length) return { frame: f, ball: 1, freshRack: false, over: false };
    i += 2;
  }
  const r = rolls.slice(i);
  if (r.length === 0) return { frame: 9, ball: 0, freshRack: true, over: false };
  if (r.length === 1) return { frame: 9, ball: 1, freshRack: r[0] === 10, over: false };
  if (r.length === 2) {
    if (r[0] === 10 || r[0] + r[1] === 10) {
      const fresh = r[0] === 10 ? r[1] === 10 : true;   // strike+strike or a spare resets the pins
      return { frame: 9, ball: 2, freshRack: fresh, over: false };
    }
    return { frame: 9, ball: 2, freshRack: false, over: true };
  }
  return { frame: 9, ball: 3, freshRack: false, over: true };
}

/** Text for a frame's boxes: X strike, / spare, - miss. */
export function marks(frameRolls, isTenth) {
  const out = [];
  frameRolls.forEach((v, k) => {
    const prev = frameRolls[k - 1];
    if (v === 10 && (k === 0 || isTenth && (prev === 10 || (k === 2 && frameRolls[0] + frameRolls[1] === 10)))) out.push('X');
    else if (k > 0 && prev !== 10 && prev + v === 10 && !(isTenth && k === 2 && frameRolls[0] + frameRolls[1] === 10)) out.push('/');
    else out.push(v === 0 ? '-' : String(v));
  });
  return out;
}
