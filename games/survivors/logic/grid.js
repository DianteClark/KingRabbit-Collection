// Uniform grid for cheap circle collision between up to a few hundred monsters and everything
// else (no physics bodies). Linked lists in typed arrays: clear + insert is O(n) per frame.
export class Grid {
  constructor(w, h, cell = 32, max = 512) {
    this.cell = cell;
    this.cols = Math.ceil(w / cell); this.rows = Math.ceil(h / cell);
    this.head = new Int32Array(this.cols * this.rows).fill(-1);
    this.next = new Int32Array(max).fill(-1);
  }
  clear() { this.head.fill(-1); }
  key(x, y) {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cell)));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cell)));
    return cx + cy * this.cols;
  }
  insert(i, x, y) { const k = this.key(x, y); this.next[i] = this.head[k]; this.head[k] = i; }
  /** Writes the items in cells overlapping the square around (x, y) into out; returns how many.
   *  No callback, so nothing is allocated in the hot loops. */
  collect(x, y, r, out) {
    const c = this.cell; let n = 0;
    const x0 = Math.max(0, Math.floor((x - r) / c)); const x1 = Math.min(this.cols - 1, Math.floor((x + r) / c));
    const y0 = Math.max(0, Math.floor((y - r) / c)); const y1 = Math.min(this.rows - 1, Math.floor((y + r) / c));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        for (let i = this.head[cx + cy * this.cols]; i !== -1 && n < out.length; i = this.next[i]) out[n++] = i;
      }
    }
    return n;
  }
  /** Calls fn(i) for every item in cells overlapping the square around (x, y) of half-size r. */
  query(x, y, r, fn) {
    const c = this.cell;
    const x0 = Math.max(0, Math.floor((x - r) / c)); const x1 = Math.min(this.cols - 1, Math.floor((x + r) / c));
    const y0 = Math.max(0, Math.floor((y - r) / c)); const y1 = Math.min(this.rows - 1, Math.floor((y + r) / c));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        for (let i = this.head[cx + cy * this.cols]; i !== -1; i = this.next[i]) if (fn(i) === false) return;
      }
    }
  }
}
