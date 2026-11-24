// Small per-game save helper on top of localStorage.
// Storage can be missing or blocked (private mode, embedded frames), so every call is guarded
// and the game keeps working, it just won't remember anything.

export function createSave(gameId, defaults = {}) {
  const key = `kingrabbit:${gameId}`;
  let data = { ...defaults };
  try {
    const raw = localStorage.getItem(key);
    if (raw) data = { ...defaults, ...JSON.parse(raw) };
  } catch { /* ignore */ }

  const persist = () => {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
  };

  return {
    get: (k) => data[k],
    set(k, v) { data[k] = v; persist(); },
    update(k, fn) { data[k] = fn(data[k]); persist(); return data[k]; },
    all: () => ({ ...data }),
  };
}
