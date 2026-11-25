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

// Cache the collection on the phone for quick, offline-friendly opens (see public/sw.js).
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
}

// ---------------------------------------------------------------- Trophies, Daily, Backup

import { profile, today } from '../shared/core/trophies.js';

const TIER_PTS = { bronze: 10, silver: 25, gold: 50 };
const titleOf = (id) => GAMES.find((g) => g.id === id)?.title || id;

function sheet(title, html) {
  const el = document.createElement('div');
  el.className = 'sheet-wrap';
  el.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="x" aria-label="Close">X</button></div><div class="sheet-body">${html}</div></div>`;
  const close = () => el.remove();
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('.x')) close(); });
  document.body.appendChild(el);
  return { el, body: el.querySelector('.sheet-body'), close };
}

function refreshHeader() {
  const p = profile();
  document.getElementById('pts').textContent = p.earned ? `${p.earned}` : '';
  const open = Object.entries(p.daily).filter(([, d]) => d.best?.[today()] == null).length;
  document.getElementById('dailyBadge').textContent = open ? `${open}` : '';
}
refreshHeader();

function trophiesPage() {
  const p = profile();
  const rows = Object.entries(p.games).filter(([, g]) => g.defs.length || g.plays)
    .sort((a, b) => (b[1].last || 0) - (a[1].last || 0))
    .map(([id, g]) => {
      const got = g.defs.filter((d) => g.trophies[d.id]).length;
      const pct = g.defs.length ? Math.round((got / g.defs.length) * 100) : 0;
      const list = g.defs.map((d) => {
        const has = g.trophies[d.id];
        const hidden = d.secret && !has;
        return `<li class="${has ? 'got' : ''}"><i class="tier ${d.tier}"></i><span><b>${esc(hidden ? 'Secret trophy' : d.name)}</b>${esc(hidden ? 'Keep playing to find it.' : d.desc)}</span></li>`;
      }).join('');
      const stats = Object.entries(g.stats || {}).map(([k, v]) => `${esc(k)} ${v}`).join(' &middot; ');
      return `<details class="tgame"><summary><img src="./thumbs/${id}.png" alt="" width="32" height="32"><span class="tname">${esc(titleOf(id))}<small>${got}/${g.defs.length} trophies &middot; played ${g.plays}x</small></span><span class="pct">${pct}%</span></summary>
        ${stats ? `<p class="stats">${stats}</p>` : ''}<ul class="tlist">${list || '<li>No trophies yet in this game.</li>'}</ul></details>`;
    }).join('');
  const s = sheet('Trophies', `
    <div class="totals"><div><b>${p.points}</b><span>points</span></div><div><b>${p.earned}/${p.total}</b><span>trophies</span></div><div><b>${Object.values(p.games).reduce((a, g) => a + g.plays, 0)}</b><span>games played</span></div></div>
    ${rows || '<p class="empty">Play any game to start collecting trophies. Each game lists its trophies here after you open it.</p>'}
    <p class="note">Bronze ${TIER_PTS.bronze}, silver ${TIER_PTS.silver}, gold ${TIER_PTS.gold} points.</p>`);
  s.body.querySelectorAll('img').forEach((img) => img.addEventListener('error', () => { img.style.visibility = 'hidden'; }));
}

function dailyPage() {
  const p = profile();
  const day = today();
  const rows = Object.entries(p.daily).map(([id, d]) => {
    const done = d.best?.[day] != null;
    const g = GAMES.find((x) => x.id === id);
    return `<a class="drow ${done ? 'done' : ''}" href="./${id}/" data-id="${id}">
      <img src="./thumbs/${id}.png" alt="" width="32" height="32">
      <span class="tname">${esc(d.title || titleOf(id))}<small>${esc(g?.title || id)}${d.desc ? ` &middot; ${esc(d.desc)}` : ''}</small></span>
      <span class="dstat">${done ? `Best ${d.best[day]}` : 'Not played'}<small>${d.streak ? `Streak ${d.streak}` : ''}</small></span></a>`;
  }).join('');
  sheet(`Daily challenges`, `<p class="note">New challenges every day at midnight, the same for everyone.</p>${rows || '<p class="empty">Daily challenges appear here once you open games that have one (like Darkhold\'s Daily Run).</p>'}`);
}

function backupPage() {
  const s = sheet('Backup', `
    <p>Save all your progress, trophies and settings from every game, then restore it on this phone or a new one.</p>
    <div class="brow"><button type="button" class="big" data-b="save">Save backup file</button><button type="button" class="big" data-b="copy">Copy backup code</button></div>
    <p class="note" id="bmsg"></p>
    <h3>Restore</h3>
    <p>Choose a backup file, or paste a backup code. This replaces your current progress.</p>
    <div class="brow"><label class="big file">Choose file<input type="file" accept=".json,.txt,application/json" hidden></label></div>
    <textarea rows="3" placeholder="...or paste a backup code here"></textarea>
    <div class="brow"><button type="button" class="big" data-b="restore">Restore from code</button></div>`);
  const msg = s.body.querySelector('#bmsg');
  const dump = () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('kingrabbit')) data[k] = localStorage.getItem(k); }
    return { app: 'kingrabbit', v: 1, at: new Date().toISOString(), data };
  };
  const encode = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const restore = (text) => {
    let o;
    try { o = JSON.parse(text.trim().startsWith('{') ? text : decodeURIComponent(escape(atob(text.trim())))); } catch { msg.textContent = 'That is not a valid backup.'; return; }
    if (o?.app !== 'kingrabbit' || !o.data) { msg.textContent = 'That is not a KingRabbit backup.'; return; }
    if (!confirm(`Restore the backup from ${new Date(o.at).toLocaleString()}? Your current progress will be replaced.`)) return;
    for (const k of Object.keys(localStorage)) if (k.startsWith('kingrabbit')) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(o.data)) localStorage.setItem(k, v);
    location.reload();
  };
  s.body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-b]')?.dataset.b;
    if (!b) return;
    if (b === 'save') {
      const blob = new Blob([JSON.stringify(dump())], { type: 'application/json' });
      const name = `kingrabbit-backup-${today()}.json`;
      const file = new File([blob], name, { type: 'application/json' });
      try {
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'KingRabbit backup' }); msg.textContent = 'Backup shared.'; return; }
      } catch (err) { if (err?.name === 'AbortError') return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
      msg.textContent = 'Backup file saved.';
    }
    if (b === 'copy') {
      const code = encode(dump());
      try { await navigator.clipboard.writeText(code); msg.textContent = `Backup code copied (${Math.round(code.length / 1024)} KB of text). Paste it somewhere safe, like Notes.`; } catch { s.body.querySelector('textarea').value = code; msg.textContent = 'Copy the code from the box below.'; }
    }
    if (b === 'restore') restore(s.body.querySelector('textarea').value);
  });
  s.body.querySelector('input[type=file]').addEventListener('change', async (e) => { const f = e.target.files?.[0]; if (f) restore(await f.text()); });
}

document.getElementById('tools').addEventListener('click', (e) => {
  const b = e.target.closest('[data-open]');
  if (!b) return;
  ({ trophies: trophiesPage, daily: dailyPage, backup: backupPage })[b.dataset.open]();
});
