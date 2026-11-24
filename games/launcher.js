import '../shared/core/base.css';
import './launcher.css';
import { GAMES } from '../shared/games.js';

const list = document.getElementById('games');

for (const g of GAMES.filter((g) => g.status !== 'hidden')) {
  const li = document.createElement('li');
  const soon = g.status === 'soon';
  li.innerHTML = `
    <${soon ? 'div' : 'a'} class="card ${soon ? 'soon' : ''}" ${soon ? '' : `href="./${g.id}/"`}>
      <img src="./thumbs/${g.id}.png" alt="" width="64" height="64" />
      <div class="info">
        <strong>${g.title}</strong>
        <span>${g.tagline}</span>
        ${soon ? '<em>Coming soon</em>' : ''}
      </div>
    </${soon ? 'div' : 'a'}>`;
  list.appendChild(li);
}

// Missing thumbnail? Hide the image rather than show a broken icon.
list.querySelectorAll('img').forEach((img) => img.addEventListener('error', () => (img.style.visibility = 'hidden')));
