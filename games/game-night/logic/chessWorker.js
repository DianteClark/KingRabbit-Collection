// Runs the chess CPU off the main thread so animations stay smooth while it thinks.
import { cpuMove } from './chess.js';

self.onmessage = (e) => {
  const { state, level, id } = e.data;
  const move = cpuMove(state, { level });
  self.postMessage({ id, move });
};
