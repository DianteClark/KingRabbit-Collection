import '../shared/core/base.css';
import './launcher.css';
import { GAMES, CATEGORIES } from '../shared/games.js';

// The home screen: a "jump back in" card for the last game played, category chips,
// then a two-column grid of game tiles. Games still in development sit at the end.

const RECENT_KEY = 'kingrabbit:recent';
const CAT_KEY = 'kingrabbit:launcherCat';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const listed = GAMES.filter((g) => g.status !== 'hidden');
const playable = listed.filter((g) => g.status === 'playable');
const hasSave = (id) => { try { return localStorage.getItem(`kingrabbit:${id}`) != null; } catch { return false; } };
const recent = store.get(RECENT_KEY, []).filter((id) => playable.some((g) => g.id === id));

document.getElementById('count').textContent = `${playable.length} games${listed.length > playable.length ? ` + ${listed.length - playable.length} on the way` : ''}`;

function thumb(g, size = 64) {
  return `<span class="thumb" style="width:${size}px;height:${size}px"><img src="./thumbs/${g.id}.png" alt="" width="${size}" height="${size}" /><b>${esc(g.title[0])}</b></span>`;
}

function badges(g) {
  const out = [];
  if (g.landscape) out.push('<i class="badge side" title="Played sideways">Sideways</i>');
  if (g.status === 'playable' && !hasSave(g.id) && !recent.includes(g.id)) out.push('<i class="badge new">New</i>');
  return out.join('');
}

function remember(id) {
  store.set(RECENT_KEY, [id, ...recent.filter((x) => x !== id)].slice(0, 6));
}

// Jump back in
const last = playable.find((g) => g.id === recent[0]);
if (last) {
  const box = document.getElementById('continue');
  box.hidden = false;
  box.innerHTML = `
    <a class="resume cat-${last.cat}" href="./${last.id}/" data-id="${last.id}">
      ${thumb(last, 72)}
      <span class="info"><small>Jump back in</small><strong>${esc(last.title)}</strong><span>${esc(last.tagline)}</span></span>
      <span class="play" aria-hidden="true">&#9654;</span>
    </a>
    ${recent.length > 1 ? `<div class="recent">${recent.slice(1, 5).map((id) => {
      const g = playable.find((x) => x.id === id);
      return `<a href="./${g.id}/" data-id="${g.id}" title="${esc(g.title)}">${thumb(g, 40)}</a>`;
    }).join('')}</div>` : ''}`;
}

// Category chips (only categories that have games)
const chips = document.getElementById('chips');
const used = CATEGORIES.filter((c) => c.id === 'all' || listed.some((g) => g.cat === c.id));
let cat = store.get(CAT_KEY, 'all');
if (!used.some((c) => c.id === cat)) cat = 'all';
chips.innerHTML = used.map((c) => `<button type="button" data-cat="${c.id}">${esc(c.label)}</button>`).join('');

const list = document.getElementById('games');
function render() {
  chips.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.cat === cat));
  const shown = listed.filter((g) => cat === 'all' || g.cat === cat);
  const ready = shown.filter((g) => g.status === 'playable');
  const soon = shown.filter((g) => g.status === 'soon');
  const tile = (g) => {
    const s = g.status === 'soon';
    const tag = s ? 'div' : 'a';
    return `<li><${tag} class="tile cat-${g.cat} ${s ? 'soon' : ''}" ${s ? '' : `href="./${g.id}/" data-id="${g.id}"`}>
      ${thumb(g, 64)}
      <strong>${esc(g.title)}</strong>
      <span>${esc(g.tagline)}</span>
      <span class="badges">${s ? '<i class="badge soon">Coming soon</i>' : ''}${badges(g)}</span>
    </${tag}></li>`;
  };
  list.innerHTML = ready.map(tile).join('')
    + (soon.length ? `<li class="divider">In the workshop</li>${soon.map(tile).join('')}` : '');
  list.querySelectorAll('img').forEach((img) => img.addEventListener('error', () => img.closest('.thumb').classList.add('noimg')));
}
render();

chips.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-cat]');
  if (!b) return;
  cat = b.dataset.cat;
  store.set(CAT_KEY, cat);
  render();
  b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
});
document.getElementById('continue').querySelectorAll('img').forEach((img) => img.addEventListener('error', () => img.closest('.thumb').classList.add('noimg')));

// Remember what was opened so it shows as "Jump back in" next time.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-id]');
  if (a) remember(a.dataset.id);
});

// Coming back with the browser's back button can restore a stale page: refresh it.
window.addEventListener('pageshow', (e) => { if (e.persisted) window.location.reload(); });
