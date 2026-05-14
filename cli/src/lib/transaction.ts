import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as yaml from 'js-yaml';
import type { MarkdownArtifact } from './artifacts';
import { nextArtifactNumber, pad3, writeTextAtomic } from './runtime';

export class Transaction {
  private readonly rollbackActions: Array<() => void> = [];
  private committed = false;

  ensureDir(path: string): void {
    const existed = existsSync(path);
    mkdirSync(path, { recursive: true });
    if (!existed) {
      this.rollbackActions.push(() => {
        rmSync(path, { recursive: true, force: true });
      });
    }
  }

  writeText(path: string, text: string): void {
    const existed = existsSync(path);
    const previous = existed ? readFileSync(path, 'utf8') : null;
    this.ensureDir(dirname(path));
    writeTextAtomic(path, text);
    this.rollbackActions.push(() => {
      if (previous !== null) {
        writeTextAtomic(path, previous);
      } else {
        rmSync(path, { force: true });
      }
    });
  }

  writeYaml(path: string, payload: unknown): void {
    const text = yaml.dump(payload, { schema: yaml.CORE_SCHEMA, lineWidth: -1, noRefs: true });
    this.writeText(path, text);
  }

  writeMarkdown(path: string, artifact: MarkdownArtifact): void {
    this.writeText(path, artifact.text);
  }

  writeNumberedMarkdown(
    dir: string,
    prefix: string,
    artifact: MarkdownArtifact,
  ): { path: string; number: number } {
    this.ensureDir(dir);
    const number = nextArtifactNumber(dir, prefix, 'md');
    const path = join(dir, `${prefix}-${pad3(number)}.md`);
    if (existsSync(path)) {
      throw new Error(`artifact path already exists: ${path}`);
    }
    this.writeMarkdown(path, artifact);
    return { path, number };
  }

  rollback(): void {
    if (this.committed) return;
    for (const action of [...this.rollbackActions].reverse()) {
      try {
        action();
      } catch {
        // best-effort rollback
      }
    }
  }

  commit(): void {
    this.committed = true;
  }
}

export function runTransaction<T>(fn: (tx: Transaction) => T): T {
  const tx = new Transaction();
  try {
    const result = fn(tx);
    tx.commit();
    return result;
  } catch (e) {
    tx.rollback();
    throw e;
  }
}
