import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.resolve(__dirname, '..', '..', 'plugin', 'bin', 'geas');

// Ensure output directory exists
fs.mkdirSync(path.dirname(outfile), { recursive: true });

await esbuild.build({
  entryPoints: [path.resolve(__dirname, 'src', 'bundle-entry.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile,
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: [],
  minify: false,
  sourcemap: false,
  loader: {
    '.json': 'json',
  },
});

console.log(`Bundled → ${outfile}`);
