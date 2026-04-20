/**
 * Atomic file I/O primitives for the Geas CLI.
 *
 * Writes follow CLI.md §6.6:
 *
 *   1. open(temp, O_WRONLY | O_CREAT | O_EXCL)
 *   2. write
 *   3. fsync(fd)
 *   4. close(fd)
 *   5. rename(temp, target)
 *
 * Temp files live in `.geas/.tmp/`. If that directory is unavailable
 * (e.g. `.geas/` is not yet set up for the setup command itself) callers
 * fall back to same-directory temps. Rename is atomic within a single
 * POSIX volume and atomic on Windows via MoveFileExW.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Read and parse a JSON file.
 * Returns null when the file does not exist. Any other read/parse failure
 * throws with the path baked into the message.
 */
export function readJsonFile<T>(filePath: string): T | null {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') return null;
    throw err;
  }
  try {
    return JSON.parse(content) as T;
  } catch (err: unknown) {
    if (err instanceof SyntaxError) {
      throw new Error(
        `Failed to parse JSON at ${filePath.replace(/\\/g, '/')}: ${err.message}`,
      );
    }
    throw err;
  }
}

function makeTempPath(targetPath: string, tmpRoot: string | null): string {
  const baseName = path.basename(targetPath);
  const rand = crypto.randomBytes(6).toString('hex');
  const name = `${baseName}.${process.pid}.${rand}`;
  if (tmpRoot) return path.join(tmpRoot, name);
  return path.join(path.dirname(targetPath), `.${name}.tmp`);
}

/**
 * Atomically write `content` to `targetPath`.
 *
 * @param targetPath Absolute path to the final file.
 * @param content UTF-8 content to write.
 * @param tmpRoot Optional temp directory. When null, temp file lives
 *                alongside the target (hidden-prefixed).
 */
export function atomicWrite(
  targetPath: string,
  content: string,
  tmpRoot: string | null = null,
): void {
  ensureDir(path.dirname(targetPath));
  if (tmpRoot) ensureDir(tmpRoot);

  const tmpPath = makeTempPath(targetPath, tmpRoot);
  let fd: number | null = null;
  try {
    fd = fs.openSync(tmpPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    fs.writeSync(fd, content, 0, 'utf-8');
    try {
      fs.fsyncSync(fd);
    } catch {
      // Some filesystems (e.g. tmpfs on certain CI, Windows network shares)
      // reject fsync with EINVAL. We accept this — rename still provides
      // the atomicity guarantee the CLI needs.
    }
    fs.closeSync(fd);
    fd = null;

    try {
      fs.renameSync(tmpPath, targetPath);
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'EXDEV' || e.code === 'EPERM') {
        // Cross-device or Windows permissions quirk. Fall back to
        // copy-then-delete. Not perfectly atomic but preserves caller
        // semantics.
        fs.copyFileSync(tmpPath, targetPath);
        fs.unlinkSync(tmpPath);
      } else {
        throw err;
      }
    }
  } catch (err) {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

/**
 * Write a JSON value atomically. Content is pretty-printed with 2-space
 * indent and terminates with a newline.
 */
export function atomicWriteJson(
  targetPath: string,
  data: unknown,
  tmpRoot: string | null = null,
): void {
  const content = JSON.stringify(data, null, 2) + '\n';
  atomicWrite(targetPath, content, tmpRoot);
}

/**
 * Append a single line to a JSONL file. Not atomic in the strict sense
 * but uses appendFileSync, which is safe for concurrent appends on POSIX
 * for writes smaller than PIPE_BUF. events.jsonl tolerates this because
 * the protocol states hook failures must not rollback primary writes.
 */
export function appendJsonl(filePath: string, entry: unknown): void {
  ensureDir(path.dirname(filePath));
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(filePath, line, 'utf-8');
}

export function exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}
