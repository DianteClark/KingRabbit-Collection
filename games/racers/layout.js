// Touch layout for the race screen (640x360), kept pure so tests can check hit areas and that
// nothing overlaps. Left thumb: two steering pads (the whole left side of the screen counts).
// Right thumb: DRIFT (big) and BOOST, plus GAS when automatic gas is switched off.

export const W = 640;
export const H = 360;

export function layout(autoGas = true) {
  const bar = 40;
  const pads = [
    { dir: -1, x: 76, y: 292, w: 120, h: 96 },
    { dir: 1, x: 218, y: 292, w: 120, h: 96 },
  ];
  const buttons = autoGas
    ? {
      drift: { x: 572, y: 288, r: 48, label: 'DRIFT' },
      boost: { x: 466, y: 306, r: 38, label: 'BOOST' },
    }
    : {
      gas: { x: 572, y: 288, r: 48, label: 'GAS' },
      drift: { x: 466, y: 306, r: 38, label: 'DRIFT' },
      boost: { x: 572, y: 186, r: 34, label: 'BOOST' },
    };
  return {
    bar,
    pads,
    split: (pads[0].x + pads[0].w / 2 + pads[1].x - pads[1].w / 2) / 2,   // left of this steers left
    steerMaxX: 330,
    buttons,
    map: { x: 526, y: 46, w: 108, h: 70 },
  };
}

/** A steering touch at screen x: -1 left, +1 right. */
export const steerFromX = (x, L) => (x < L.split ? -1 : 1);

export const inCircle = (x, y, b, extra = 0) => Math.hypot(x - b.x, y - b.y) < b.r + extra;
