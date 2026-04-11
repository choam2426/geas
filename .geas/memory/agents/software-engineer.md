# Software Engineer Memory

- When generating templates with variant selection (e.g., --role), the selected variant value must override the enum default in the output, not just merge conditional required fields
- CLI test files go in src/cli/src/test/ (inside src/) for proper TypeScript compilation with the existing tsconfig
- When task contract references a CLI subcommand that does not exist, remap to nearest real subcommands and document the remap in implementation evidence — do not fail the task
