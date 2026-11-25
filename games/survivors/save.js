import { createSave } from '../../shared/core/save.js';
import { META_DEFAULTS } from './logic/meta.js';

// Coins, shop levels and heroes live in one 'meta' object so logic/meta.js can work on it.
export const save = createSave('survivors', { meta: META_DEFAULTS });

export function meta() { return { ...META_DEFAULTS, ...save.get('meta') }; }
export function setMeta(m) { save.set('meta', m); }
