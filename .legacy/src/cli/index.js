#!/usr/bin/env node
/**
 * Geas CLI bootstrap.
 * Thin shim that requires the compiled dist/main.js and calls run().
 * This file is the stable entry point — never compile over it.
 */
try {
  require('./dist/main').run();
} catch (e) {
  if (e && e.code === 'MODULE_NOT_FOUND') {
    process.stderr.write(
      JSON.stringify({
        error: 'CLI not built. Run: cd src/cli && npm run build',
        code: 'NOT_BUILT',
      }) + '\n'
    );
    process.exit(2);
  }
  throw e;
}
