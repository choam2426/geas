import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import * as yaml from 'js-yaml';
import {
  parseMarkdownArtifact,
  type MarkdownArtifact,
  type MarkdownArtifactKind,
} from './artifacts';

export type RunState = {
  current_mission_id: string;
  current_stage: '' | 'specifying' | 'building' | 'consolidating';
  current_task_id: string;
};

export type TaskPhase =
  | 'unstarted'
  | 'implementing'
  | 'verifying'
  | 'reviewing'
  | 'challenging'
  | 'awaiting_user_judgment'
  | 'closed';

export type TaskState = {
  phase: TaskPhase;
};

export type BaselineKind = 'mission-spec' | 'mission-design';

const ROLE_NAMES = [
  'orchestrator',
  'work-designer',
  'implementer',
  'verifier',
  'reviewer',
  'challenger',
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const ALL_ROLES: readonly RoleName[] = ROLE_NAMES;

export function geasRoot(cwd: string = process.cwd()): string {
  return join(cwd, '.geas');
}

export function missionDir(missionId: string, cwd?: string): string {
  return join(geasRoot(cwd), 'missions', missionId);
}

export function taskDir(missionId: string, taskId: string, cwd?: string): string {
  return join(missionDir(missionId, cwd), 'tasks', taskId);
}

export function readYaml<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  // CORE_SCHEMA disables timestamp parsing so date-like strings stay strings.
  const parsed = yaml.load(text, { schema: yaml.CORE_SCHEMA });
  return parsed as T;
}

export function writeYamlAtomic(path: string, payload: unknown): void {
  const text = yaml.dump(payload, { schema: yaml.CORE_SCHEMA, lineWidth: -1, noRefs: true });
  writeTextAtomic(path, text);
}

export function writeTextAtomic(path: string, text: string): void {
  ensureDir(dirname(path));
  const tmp = `${path}.tmp.${randomBytes(4).toString('hex')}`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, path);
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function existsArtifact(path: string): boolean {
  return existsSync(path);
}

export function readRunState(cwd?: string): RunState | null {
  return readYaml<RunState>(join(geasRoot(cwd), 'run-state.yaml'));
}

export function writeRunState(state: RunState, cwd?: string): void {
  writeYamlAtomic(join(geasRoot(cwd), 'run-state.yaml'), state);
}

export function readTaskState(missionId: string, taskId: string, cwd?: string): TaskState | null {
  return readYaml<TaskState>(join(taskDir(missionId, taskId, cwd), 'task-state.yaml'));
}

export function writeTaskState(missionId: string, taskId: string, state: TaskState, cwd?: string): void {
  writeYamlAtomic(join(taskDir(missionId, taskId, cwd), 'task-state.yaml'), state);
}

export function nextNumber(dir: string, prefix: string): number {
  if (!existsSync(dir)) return 1;
  let max = 0;
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d{3})\\.yaml$`);
  for (const file of readdirSync(dir)) {
    const m = file.match(re);
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

export function nextArtifactNumber(dir: string, prefix: string, extension: 'md' | 'yaml'): number {
  if (!existsSync(dir)) return 1;
  let max = 0;
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d{3})\\.${extension}$`);
  for (const file of readdirSync(dir)) {
    const m = file.match(re);
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

export function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

export function readLatestNumbered<T>(dir: string, prefix: string): { number: number; payload: T; path: string } | null {
  if (!existsSync(dir)) return null;
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d{3})\\.yaml$`);
  let best: { number: number; file: string } | null = null;
  for (const file of readdirSync(dir)) {
    const m = file.match(re);
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (!best || n > best.number) best = { number: n, file };
    }
  }
  if (!best) return null;
  const p = join(dir, best.file);
  return { number: best.number, payload: readYaml<T>(p)!, path: p };
}

export function writeNumberedArtifact(dir: string, prefix: string, payload: unknown): { path: string; number: number } {
  ensureDir(dir);
  const n = nextNumber(dir, prefix);
  const path = join(dir, `${prefix}-${pad3(n)}.yaml`);
  writeYamlAtomic(path, payload);
  return { path, number: n };
}

export function readLatestMarkdownArtifact(
  dir: string,
  prefix: string,
  kind: MarkdownArtifactKind,
): { number: number; artifact: MarkdownArtifact; path: string } | null {
  if (!existsSync(dir)) return null;
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d{3})\\.md$`);
  let best: { number: number; file: string } | null = null;
  for (const file of readdirSync(dir)) {
    const m = file.match(re);
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (!best || n > best.number) best = { number: n, file };
    }
  }
  if (!best) return null;
  const path = join(dir, best.file);
  const parsed = parseMarkdownArtifact(readFileSync(path, 'utf8'), kind);
  if (!parsed.ok) {
    throw new Error(`invalid stored artifact ${path}: ${parsed.code}: ${parsed.detail}`);
  }
  return { number: best.number, artifact: parsed.artifact, path };
}

export function writeNumberedMarkdownArtifact(dir: string, prefix: string, artifact: MarkdownArtifact): { path: string; number: number } {
  ensureDir(dir);
  const n = nextArtifactNumber(dir, prefix, 'md');
  const path = join(dir, `${prefix}-${pad3(n)}.md`);
  writeTextAtomic(path, artifact.text);
  return { path, number: n };
}

export function writeMarkdownArtifact(path: string, artifact: MarkdownArtifact): void {
  writeTextAtomic(path, artifact.text);
}

export function generateMissionId(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear().toString();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const random = randomBytes(8).toString('hex').slice(0, 6);
  return `${yyyy}${mm}${dd}-${random}`;
}

export function listTaskIds(missionId: string, cwd?: string): string[] {
  const tasks = join(missionDir(missionId, cwd), 'tasks');
  if (!existsSync(tasks)) return [];
  return readdirSync(tasks).filter((name) => existsSync(join(tasks, name)));
}

export function relMissionPath(absolute: string, missionId: string, cwd?: string): string {
  const root = missionDir(missionId, cwd);
  if (absolute.startsWith(root)) {
    return absolute.slice(root.length + 1).replace(/\\/g, '/');
  }
  return absolute.replace(/\\/g, '/');
}

export function relGeasPath(absolute: string, cwd?: string): string {
  const root = geasRoot(cwd);
  if (absolute.startsWith(root)) {
    return ('.geas/' + absolute.slice(root.length + 1)).replace(/\\/g, '/');
  }
  return absolute.replace(/\\/g, '/');
}
