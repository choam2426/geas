import { Command } from 'commander';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('geas')
    .description('Geas CLI — atomic actuator for .geas/ runtime artifacts')
    .version('3.0.0');
  return program;
}

export function run(argv: string[] = process.argv): void {
  const program = buildProgram();
  program.parse(argv);
}

if (require.main === module) {
  run();
}
