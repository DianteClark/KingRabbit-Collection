// Animation columns and direction rows of the SportSeries Soccer sheet (pure, so tests can use it).

// Rows: down, down-right, right, up-right, up, up-left, left, down-left.
export const ANIM = {
  idle: [1], walk: [2, 3, 4, 5, 6, 7], run: [8, 9, 10, 11], kick: [12, 13, 14, 15],
  tackle: [16, 17, 18, 19], damage: [20, 21, 22, 23], ohno: [26, 27, 28, 29],
  defense: [30, 31, 32, 33], gate: [36, 37, 38, 39, 40], jump: [41, 42, 43], catch: [44, 45, 46],
};

/** 8-way direction row from a facing vector (y down). */
export function dirIndex(fx, fy) {
  const a = (Math.atan2(fy, fx) * 180) / Math.PI;
  return (((Math.round((90 - a) / 45)) % 8) + 8) % 8;
}
