/**
 * Schema drift test.
 *
 * Asserts that the SCHEMAS object exported by the compiled
 * schemas-embedded module has the exact same content as the canonical
 * schemas under docs/schemas/*.schema.json.
 *
 * If this test fails, run `npm run schemas:regen` from src/cli/ to
 * regenerate schemas-embedded.ts.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { REPO_ROOT } = require('./helpers/setup');

test('schemas-embedded content matches docs/schemas originals', () => {
  const schemasDir = path.join(REPO_ROOT, 'docs', 'schemas');
  const files = fs
    .readdirSync(schemasDir)
    .filter((f) => f.endsWith('.schema.json'))
    .sort();

  const originals = {};
  for (const f of files) {
    const name = f.replace(/\.schema\.json$/, '');
    const content = fs.readFileSync(path.join(schemasDir, f), 'utf-8');
    originals[name] = JSON.parse(content);
  }

  const { SCHEMAS, SCHEMA_NAMES } = require(path.join(
    REPO_ROOT,
    'src',
    'cli',
    'dist',
    'lib',
    'schemas-embedded.js',
  ));

  assert.deepEqual(
    [...SCHEMA_NAMES].sort(),
    Object.keys(originals).sort(),
    'SCHEMA_NAMES must match the list of *.schema.json files',
  );

  for (const name of Object.keys(originals)) {
    assert.deepEqual(
      SCHEMAS[name],
      originals[name],
      `embedded schema '${name}' drifted from docs/schemas/${name}.schema.json — run npm run schemas:regen`,
    );
  }
});
