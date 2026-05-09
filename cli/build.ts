import { build } from 'esbuild';
import { existsSync, readFileSync, writeFileSync, chmodSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

async function main() {
  const schemasDir = resolve(__dirname, 'schemas');
  const schemas: Record<string, unknown> = {};
  if (existsSync(schemasDir)) {
    for (const file of readdirSync(schemasDir)) {
      if (file.endsWith('.json')) {
        const id = file.replace(/\.json$/, '');
        schemas[id] = JSON.parse(readFileSync(join(schemasDir, file), 'utf8'));
      }
    }
  }
  const schemasModule = `module.exports = ${JSON.stringify(schemas)};`;

  const outFile = resolve(__dirname, '..', 'skills', 'geas-cli', 'scripts', 'geas');
  const outDir = dirname(outFile);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  await build({
    entryPoints: [resolve(__dirname, 'src', 'main.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: outFile,
    minify: false,
    plugins: [
      {
        name: 'inline-schemas',
        setup(b) {
          b.onResolve({ filter: /^virtual:schemas$/ }, (args) => ({
            path: args.path,
            namespace: 'virtual',
          }));
          b.onLoad({ filter: /^virtual:schemas$/, namespace: 'virtual' }, () => ({
            contents: schemasModule,
            loader: 'js',
          }));
        },
      },
    ],
  });

  const built = readFileSync(outFile, 'utf8');
  writeFileSync(outFile, '#!/usr/bin/env node\n' + built);
  try {
    chmodSync(outFile, 0o755);
  } catch {
    // Windows or restricted FS — git update-index --chmod=+x carries the bit.
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
