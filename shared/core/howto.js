// Full-screen, scrollable "How to play" sheet drawn as HTML on top of the game canvas.
// rules = { title, sections: [{ heading, items: [string] | text: string }] }

export function showHowTo(rules, onClose) {
  document.getElementById('howto')?.remove();
  const el = document.createElement('div');
  el.id = 'howto';
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const body = rules.sections.map((s) => `
    <section>
      <h3>${esc(s.heading)}</h3>
      ${s.text ? `<p>${esc(s.text)}</p>` : ''}
      ${s.items ? `<ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
    </section>`).join('');
  el.innerHTML = `
    <div class="sheet" role="dialog" aria-label="How to play ${esc(rules.title)}">
      <header><h2>How to play<br><span>${esc(rules.title)}</span></h2></header>
      <div class="scroll">${body}</div>
      <button type="button">Got it</button>
    </div>`;
  const close = () => { el.remove(); onClose?.(); };
  el.querySelector('button').addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  // Keep touches inside the sheet from reaching the game.
  for (const t of ['pointerdown', 'pointerup', 'touchstart', 'touchend']) el.addEventListener(t, (e) => e.stopPropagation());
  document.body.appendChild(el);
}
