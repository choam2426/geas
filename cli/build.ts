import { build } from 'esbuild';
import { existsSync, readFileSync, writeFileSync, chmodSync, readdirSync, mkdirSync, renameSync, rmSync } from 'node:fs';
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

  const outFile = resolve(__dirname, '..', 'plugins', 'geas', 'skills', 'geas-cli', 'scripts', 'geas');
  const tempOutFile = `${outFile}.tmp`;
  const outDir = dirname(outFile);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  rmSync(tempOutFile, { force: true });

  await build({
    entryPoints: [resolve(__dirname, 'src', 'main.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: tempOutFile,
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

  const built = readFileSync(tempOutFile, 'utf8');
  writeFileSync(tempOutFile, '#!/usr/bin/env node\n' + built);
  rmSync(outFile, { force: true });
  renameSync(tempOutFile, outFile);
  try {
    chmodSync(outFile, 0o755);
  } catch {
    // Windows or restricted filesystems may ignore chmod; Git carries the executable bit.
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
