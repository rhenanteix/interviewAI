import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';

const ROOT_ASSETS = ['manifest.json', 'popup.html'];

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: 'src/background.ts',
        sidepanel: 'src/sidepanel.html',
        options: 'src/options.html',
        offscreen: 'src/offscreen.html',
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background.js';
          if (chunk.name === 'sidepanel') return 'sidepanel.js';
          if (chunk.name === 'options') return 'options.js';
          if (chunk.name === 'offscreen') return 'offscreen.js';
          return 'assets/[name]-[hash].js';
        },
        assetFileNames: (asset) => {
          if (asset.name?.endsWith('.html')) return '[name].[ext]';
          return 'assets/[name]-[hash].[ext]';
        },
      },
    },
  },
  plugins: [
    {
      name: 'copy-and-flatten-html',
      writeBundle() {
        const outDir = join(process.cwd(), 'dist');
        mkdirSync(outDir, { recursive: true });

        // Copia assets raiz
        for (const asset of ROOT_ASSETS) {
          copyFileSync(join(process.cwd(), asset), join(outDir, asset));
        }

        // Move HTML de dist/src/ para dist/
        const srcHtmlDir = join(outDir, 'src');
        const htmlFiles = readdirSync(srcHtmlDir).filter((f) => f.endsWith('.html'));
        for (const f of htmlFiles) {
          copyFileSync(join(srcHtmlDir, f), join(outDir, f));
        }
        rmSync(srcHtmlDir, { recursive: true, force: true });
      },
    },
  ],
});
