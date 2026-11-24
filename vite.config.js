import { defineConfig } from 'vite';
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Every folder in games/ that has an index.html becomes its own page:
//   games/index.html            -> /            (the launcher)
//   games/<game-id>/index.html  -> /<game-id>/  (each game)
const gamesDir = resolve(__dirname, 'games');
const input = { launcher: resolve(gamesDir, 'index.html') };
for (const entry of readdirSync(gamesDir, { withFileTypes: true })) {
  const page = resolve(gamesDir, entry.name, 'index.html');
  if (entry.isDirectory() && existsSync(page)) input[entry.name] = page;
}

// Every game page gets a tiny loading screen that shows the moment the page opens (before the
// game engine has downloaded), with a progress bar, and a "Tap to reload" fallback if loading
// fails or stalls. shared/core/boot.js removes it once the game's first real screen is up.
const LOADER = `
<style>
#boot-loading{position:fixed;inset:0;z-index:95;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#1c1618;color:#f9f5ef;font:16px BoldPixels,monospace;text-align:center;padding:24px}
#boot-loading .bar{width:180px;height:10px;border:3px solid #040303;background:#47416b}
#boot-loading .bar i{display:block;height:100%;width:8%;background:#e3d245;transition:width .2s}
#boot-loading small{color:#8a8fc4;max-width:300px;line-height:1.4}
#boot-loading button{font:inherit;padding:12px 20px;background:#e3d245;color:#1c1618;border:3px solid #040303;box-shadow:0 4px 0 #040303;display:none}
#boot-loading.stuck button{display:block}
</style>
<div id="boot-loading"><div class="t">Loading...</div><div class="bar"><i></i></div><small></small><button type="button" onclick="location.reload()">Tap to reload</button></div>
<script>
(function(){
  var el=document.getElementById('boot-loading'), bar=el.querySelector('i'), msg=el.querySelector('small'), p=8;
  var tick=setInterval(function(){ if(p<60){p+=2; bar.style.width=p+'%';} },250);
  function stuck(text){ if(!el.isConnected) return; clearInterval(tick); el.classList.add('stuck'); el.querySelector('.t').textContent='Hmm, that didn\\'t load'; msg.textContent=text; }
  window.__bootProgress=function(v){ clearInterval(tick); bar.style.width=Math.max(p,Math.round(60+v*40))+'%'; };
  window.__bootDone=function(){ clearInterval(tick); clearTimeout(slow); el.remove(); };
  var slow=setTimeout(function(){ stuck('It is taking a long time. Check your connection, then reload.'); },20000);
  window.addEventListener('error',function(e){ if(!e.target||e.target===window){ stuck((e.message||'A script error happened.')+''); } else if(e.target.tagName==='SCRIPT'){ stuck('Part of the game could not be downloaded.'); } },true);
  window.addEventListener('unhandledrejection',function(e){ stuck(String(e.reason&&e.reason.message||e.reason||'Loading failed.')); });
})();
</script>`;

const bootLoader = {
  name: 'boot-loader',
  transformIndexHtml(html, ctx) {
    if (ctx.filename === resolve(gamesDir, 'index.html')) return html; // not the launcher
    return html.replace('<body>', `<body>${LOADER}`);
  },
};

export default defineConfig({
  root: gamesDir,
  // Relative paths so the site works at github.io/KingRabbit-Collection/ and on any custom domain.
  base: './',
  plugins: [bootLoader],
  publicDir: resolve(gamesDir, 'public'),
  server: { host: true, fs: { allow: [__dirname] } },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    // Phaser is big (~1.5 MB); keep it in its own file so the browser caches it once for every game.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input,
      output: { manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined) },
    },
  },
});
