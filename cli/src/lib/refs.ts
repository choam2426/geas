import { existsSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { geasRoot, missionDir, taskDir } from './runtime';

export type RefResolveOk = {
  ok: true;
  ref: string;
  path: string;
};

export type RefResolveFailure = {
  ok: false;
  code: 'ref_empty' | 'ref_absolute' | 'ref_escape' | 'ref_stale_yaml_artifact' | 'ref_outside_scope' | 'ref_missing';
  ref: string;
  path?: string;
};

export type RefResolveResult = RefResolveOk | RefResolveFailure;

export function resolveMissionRef(missionId: string, ref: string, cwd?: string): RefResolveResult {
  return resolveUnderRoot(missionDir(missionId, cwd), ref);
}

export function resolveTaskArtifactRef(missionId: string, taskId: string, ref: string, cwd?: string): RefResolveResult {
  const root = hasDirectorySegment(ref) ? missionDir(missionId, cwd) : taskDir(missionId, taskId, cwd);
  return resolveUnderRoot(root, ref);
}

export function resolveProjectRef(ref: string, cwd?: string): RefResolveResult {
  const normalized = normalizeRef(ref);
  const stripped = normalized.startsWith('.geas/') ? normalized.slice('.geas/'.length) : normalized;
  return resolveUnderRoot(geasRoot(cwd), stripped, ref);
}

function resolveUnderRoot(root: string, ref: string, originalRef = ref): RefResolveResult {
  const normalized = normalizeRef(ref);
  if (normalized === '') return { ok: false, code: 'ref_empty', ref: originalRef };
  if (isAbsolute(ref) || isAbsolute(normalized)) return { ok: false, code: 'ref_absolute', ref: originalRef };
  if (normalized.split('/').includes('..')) return { ok: false, code: 'ref_escape', ref: originalRef };
  if (normalized.endsWith('.yaml')) return { ok: false, code: 'ref_stale_yaml_artifact', ref: originalRef };

  const path = join(root, normalized);
  const rel = relative(root, path);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    return { ok: false, code: 'ref_outside_scope', ref: originalRef, path };
  }
  if (!existsSync(path)) return { ok: false, code: 'ref_missing', ref: originalRef, path };
  return { ok: true, ref: originalRef, path };
}

function normalizeRef(ref: string): string {
  return ref.trim().replace(/\\/g, '/').replace(/^\/+/, '');
}

function hasDirectorySegment(ref: string): boolean {
  return normalizeRef(ref).includes('/');
}
