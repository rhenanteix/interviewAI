import { execSync } from 'child_process';
import { copyFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath, dirname, join } from 'path';

const require = createRequire(import.meta.url);
const BIN = require.resolve('esbuild/bin/esbuild');
const APP_DIR = dirname(fileURLToPath(import.meta.url));
const ENTRY = ['src/background.ts', 'src/offscreen.ts', 'src/audio-worklet.ts', 'src/sidepanel.ts'];
const ASSETS = ['manifest.json', 'sidepanel.html', 'offscreen.html', 'popup.html', 'popup.js'];

mkdirSync(join(APP_DIR, 'dist'), { recursive: true });

execSync(
  `${BIN} ${ENTRY.join(' ')} --bundle --outdir=dist --format=esm --platform=browser --target=es2022 --log-level=error`,
  { stdio: 'inherit', cwd: APP_DIR },
);

for (const asset of ASSETS) copyFileSync(join(APP_DIR, asset), join(APP_DIR, 'dist', asset));

console.log('build @copilot/extension: dist/ pronto');
