import { readFileSync } from 'node:fs';
import * as yaml from 'js-yaml';
import { parseMarkdownArtifact, type MarkdownArtifact, type MarkdownArtifactKind } from './artifacts';

export type ReadPayloadResult =
  | { ok: true; payload: unknown }
  | { ok: false; code: 'payload_read_failed' | 'payload_parse_failed'; detail: string };

export function readPayload(from: string): ReadPayloadResult {
  let text: string;
  try {
    text = from === '-' ? readFileSync(0, 'utf8') : readFileSync(from, 'utf8');
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, code: 'payload_read_failed', detail };
  }
  try {
    const payload = yaml.load(text, { schema: yaml.CORE_SCHEMA });
    return { ok: true, payload };
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, code: 'payload_parse_failed', detail };
  }
}

export type ReadMarkdownArtifactResult =
  | { ok: true; artifact: MarkdownArtifact }
  | { ok: false; code: 'payload_read_failed' | 'payload_parse_failed'; detail: string };

export function readMarkdownArtifact(from: string, kind: MarkdownArtifactKind): ReadMarkdownArtifactResult {
  let text: string;
  try {
    text = from === '-' ? readFileSync(0, 'utf8') : readFileSync(from, 'utf8');
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, code: 'payload_read_failed', detail };
  }

  const parsed = parseMarkdownArtifact(text, kind);
  if (!parsed.ok) {
    return { ok: false, code: 'payload_parse_failed', detail: `${parsed.code}: ${parsed.detail}` };
  }
  return { ok: true, artifact: parsed.artifact };
}
