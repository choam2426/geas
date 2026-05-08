export function run(): void {
  process.stdout.write(JSON.stringify({ ok: false, error: { code: 'not_implemented' } }) + '\n');
  process.exit(1);
}

if (require.main === module) {
  run();
}
