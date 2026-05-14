import * as yaml from 'js-yaml';

export type EvidenceKind = 'implementation' | 'verification' | 'review' | 'challenger' | 'task';
export type JudgmentTarget = 'task-result' | 'mission-result';

export type MarkdownArtifactKind =
  | 'mission-spec'
  | 'mission-design'
  | 'task-contract'
  | 'implementation-evidence'
  | 'verification-evidence'
  | 'review-evidence'
  | 'challenger-evidence'
  | 'task-evidence'
  | 'mission-evidence'
  | 'user-judgment';

export type MarkdownArtifact = {
  kind: MarkdownArtifactKind;
  frontmatter: Record<string, unknown>;
  body: string;
  text: string;
  sections: string[];
};

export type ArtifactParseResult =
  | { ok: true; artifact: MarkdownArtifact }
  | { ok: false; code: string; detail: string };

type ArtifactSpec = {
  requiredFrontmatter: string[];
  requiredSections: string[];
  enums?: Record<string, readonly string[]>;
};

const EVIDENCE_VERDICTS = ['passed', 'changes_requested', 'escalated'] as const;
const RESULT_DECISIONS = ['accepted', 'accepted_with_limits', 'revise', 'deferred', 'stopped'] as const;

const ARTIFACT_SPECS: Record<MarkdownArtifactKind, ArtifactSpec> = {
  'mission-spec': {
    requiredFrontmatter: ['name'],
    requiredSections: [
      'Goal',
      'Background',
      'Scope',
      'Acceptance Criteria',
      'Constraints',
      'Assumptions',
      'Risks',
    ],
  },
  'mission-design': {
    requiredFrontmatter: ['name'],
    requiredSections: [
      'Plan Summary',
      'Approach Strategy',
      'Alternatives Considered',
      'Key Concepts',
      'Scope',
      'Plan Outline',
      'Decision Points',
      'Assumptions',
      'Risks',
      'Change Triggers',
    ],
  },
  'task-contract': {
    requiredFrontmatter: ['name', 'task_id', 'mission_acceptance_refs', 'depends_on', 'risk_level'],
    requiredSections: [
      'Description',
      'Mission Relation',
      'Scope',
      'Deliverables',
      'Acceptance Criteria',
      'Verification Checks',
      'Review Focus',
      'Assumptions',
      'Constraints',
      'Risks',
      'Change Triggers',
    ],
    enums: { risk_level: ['low', 'medium', 'high'] },
  },
  'implementation-evidence': {
    requiredFrontmatter: ['name', 'task_id', 'evidence_type', 'task_contract_ref'],
    requiredSections: [
      'Summary',
      'Changed Outputs',
      'Affected Scope',
      'Implementation Decisions',
      'Assumptions',
      'Contract Deltas',
      'Self Checks',
      'Limits',
      'Reflection Candidates',
    ],
    enums: { evidence_type: ['implementation'] },
  },
  'verification-evidence': {
    requiredFrontmatter: [
      'name',
      'task_id',
      'evidence_type',
      'task_contract_ref',
      'implementation_evidence_ref',
      'verdict',
    ],
    requiredSections: [
      'Summary',
      'Environment',
      'Target',
      'Checks Performed',
      'Criteria Results',
      'Outputs',
      'Deviations',
      'Unverified Scope',
      'Recheck Needed',
    ],
    enums: { evidence_type: ['verification'], verdict: EVIDENCE_VERDICTS },
  },
  'review-evidence': {
    requiredFrontmatter: [
      'name',
      'task_id',
      'evidence_type',
      'task_contract_ref',
      'implementation_evidence_ref',
      'verification_evidence_ref',
      'verdict',
    ],
    requiredSections: [
      'Summary',
      'Target',
      'Review Focus Used',
      'Review Coverage',
      'Review Methods',
      'Findings',
      'Remaining Risks',
      'Overall Recommendation',
    ],
    enums: { evidence_type: ['review'], verdict: EVIDENCE_VERDICTS },
  },
  'challenger-evidence': {
    requiredFrontmatter: [
      'name',
      'task_id',
      'evidence_type',
      'task_contract_ref',
      'implementation_evidence_ref',
      'verification_evidence_ref',
      'review_evidence_ref',
      'verdict',
    ],
    requiredSections: [
      'Target',
      'Challenge Focus',
      'Challenge Methods',
      'Findings',
      'User Decisions Needed',
      'Deeper Checks Needed',
      'Overall Recommendation',
    ],
    enums: { evidence_type: ['challenger'], verdict: EVIDENCE_VERDICTS },
  },
  'task-evidence': {
    requiredFrontmatter: ['name', 'task_id', 'evidence_type', 'task_contract_ref', 'user_judgment_ref'],
    requiredSections: [
      'Summary',
      'User Judgment Summary',
      'Criteria Results',
      'Accepted Unverified Scope',
      'Accepted Remaining Risks',
    ],
    enums: { evidence_type: ['task'] },
  },
  'mission-evidence': {
    requiredFrontmatter: [
      'name',
      'evidence_type',
      'mission_spec_ref',
      'mission_design_ref',
      'user_judgment_ref',
    ],
    requiredSections: [
      'Summary',
      'User Judgment Summary',
      'Mission Criteria Results',
      'Mission Design Deltas',
      'Accepted Unverified Scope',
      'Accepted Remaining Risks',
      'Gaps',
      'Debts',
      'Follow Ups',
      'Reflection Summary',
      'Memory Updates',
    ],
    enums: { evidence_type: ['mission'] },
  },
  'user-judgment': {
    requiredFrontmatter: ['name', 'judgment_type', 'decision'],
    requiredSections: [
      'Decision Trail',
      'Accepted Unverified Scope',
      'Accepted Remaining Risks',
      'Requested Actions',
      'Notes',
    ],
    enums: { judgment_type: ['task-result', 'mission-result'], decision: RESULT_DECISIONS },
  },
};

export function parseMarkdownArtifact(text: string, kind: MarkdownArtifactKind): ArtifactParseResult {
  const normalized = text.replace(/^\uFEFF/, '');
  const frontmatterMatch = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { ok: false, code: 'frontmatter_missing', detail: 'Markdown artifact must start with YAML frontmatter' };
  }

  let frontmatter: unknown;
  try {
    frontmatter = yaml.load(frontmatterMatch[1]!, { schema: yaml.CORE_SCHEMA });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, code: 'frontmatter_parse_failed', detail };
  }

  if (!isPlainObject(frontmatter)) {
    return { ok: false, code: 'frontmatter_invalid', detail: 'frontmatter must be a YAML object' };
  }

  const body = frontmatterMatch[2]!;
  const structure = validateBodySections(body, ARTIFACT_SPECS[kind].requiredSections);
  if (!structure.ok) return structure;

  const fm = validateFrontmatter(frontmatter, ARTIFACT_SPECS[kind]);
  if (!fm.ok) return fm;

  return {
    ok: true,
    artifact: {
      kind,
      frontmatter,
      body,
      text: normalized,
      sections: structure.sections,
    },
  };
}

function validateBodySections(
  body: string,
  requiredSections: string[],
): { ok: true; sections: string[] } | { ok: false; code: string; detail: string } {
  const trimmed = body.trimStart();
  if (!trimmed.startsWith('## ')) {
    return { ok: false, code: 'body_section_start_invalid', detail: 'Markdown body must start with a level-2 section' };
  }

  const sections: string[] = [];
  const seen = new Set<string>();
  const h1: string[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (/^#(?!#)\s+/.test(line)) h1.push(line);
    const section = line.match(/^##\s+(.+?)\s*$/);
    if (section) {
      const name = section[1]!.trim();
      if (seen.has(name)) {
        return { ok: false, code: 'section_duplicate', detail: name };
      }
      seen.add(name);
      sections.push(name);
    }
  }

  if (h1.length > 0) {
    return { ok: false, code: 'h1_forbidden', detail: h1[0]! };
  }

  const missing = requiredSections.filter((section) => !seen.has(section));
  if (missing.length > 0) {
    return { ok: false, code: 'section_missing', detail: missing.join(', ') };
  }

  return { ok: true, sections };
}

function validateFrontmatter(
  frontmatter: Record<string, unknown>,
  spec: ArtifactSpec,
): { ok: true } | { ok: false; code: string; detail: string } {
  for (const key of spec.requiredFrontmatter) {
    if (!Object.prototype.hasOwnProperty.call(frontmatter, key)) {
      return { ok: false, code: 'frontmatter_key_missing', detail: key };
    }
  }

  for (const key of spec.requiredFrontmatter) {
    const value = frontmatter[key];
    if (key === 'depends_on' || key === 'mission_acceptance_refs') {
      if (!isStringArray(value)) return { ok: false, code: 'frontmatter_key_invalid', detail: `${key} must be a string array` };
    } else if (typeof value !== 'string') {
      return { ok: false, code: 'frontmatter_key_invalid', detail: `${key} must be a string` };
    }
  }

  for (const [key, allowed] of Object.entries(spec.enums ?? {})) {
    const value = frontmatter[key];
    if (typeof value !== 'string' || !allowed.includes(value)) {
      return { ok: false, code: 'frontmatter_enum_invalid', detail: `${key}=${String(value)}` };
    }
  }

  return { ok: true };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function frontmatterString(artifact: MarkdownArtifact, key: string): string {
  const value = artifact.frontmatter[key];
  return typeof value === 'string' ? value : '';
}

export function frontmatterStringArray(artifact: MarkdownArtifact, key: string): string[] {
  const value = artifact.frontmatter[key];
  return isStringArray(value) ? value : [];
}

export function kindForEvidence(evidenceKind: EvidenceKind): MarkdownArtifactKind {
  if (evidenceKind === 'implementation') return 'implementation-evidence';
  if (evidenceKind === 'verification') return 'verification-evidence';
  if (evidenceKind === 'review') return 'review-evidence';
  if (evidenceKind === 'challenger') return 'challenger-evidence';
  return 'task-evidence';
}
