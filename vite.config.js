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

export default defineConfig({
  root: gamesDir,
  // Relative paths so the site works at github.io/KingRabbit-Collection/ and on any custom domain.
  base: './',
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
