# Skill Template

## 목적

이 문서는 새 Geas `SKILL.md`가 따르는 공통 작성 기준이다. 목적은 모든 Skill에 같은 문서 형식을 강제하는 것이 아니라, agent가 실제로 실행하기 쉬운 짧은 runbook 구조를 유지하는 것이다.

좋은 Geas Skill은 다음 상태를 만든다.

- `description`만 봐도 언제 이 Skill을 써야 하는지 알 수 있다.
- 본문은 trigger된 뒤 agent가 실행할 절차에 집중한다.
- Skill 책임, 입력, 종료 형태, 기록 지점, 중단 조건이 분명하다.
- 자주 생기는 경계 위반이 `Gotchas`에 드러난다.
- 세부 shape, 긴 예시, 반복 검증은 필요할 때만 읽거나 실행하는 resource로 분리된다.

## Frontmatter

`SKILL.md` frontmatter는 `name`과 `description`만 사용한다.

```yaml
---
name: skill-name
description: Third-person trigger description. Include what this Skill does, when to use it, concrete trigger words, and adjacent boundaries when needed.
---
```

기준:

- `name`은 소문자, 숫자, 하이픈만 사용하고 64자 이하로 둔다.
- `description`은 3인칭으로 쓴다.
- `description`은 Skill이 하는 일과 사용할 조건을 함께 담는다.
- `description`은 사용자가 말할 가능성이 높은 trigger 단어, workflow 단어, domain 단어, 파일 확장자를 담는다.
- 인접 Skill과 충돌할 수 있으면 boundary 문구를 넣는다.
- `description`은 1024자 이하로 둔다.

## Body Structure

새 `SKILL.md`는 다음 section을 기본 뼈대로 쓴다.

1. `Job`
2. `Workflow`
3. `Inputs`
4. `Resources`
5. `Gotchas`
6. `Stop Conditions`
7. `Boundary`

Skill 책임이 작으면 section을 짧게 쓴다. 해당 section에 채울 내용이 없으면 넣지 않는다.

## Job

`Job`은 Skill의 책임을 한두 문장으로 고정한다.

포함할 내용:

- 이 Skill이 맡는 workflow 단계
- 이 Skill이 남기는 concrete output
- User가 더 낮은 비용으로 검토하고 수용 판단할 수 있게 만드는 상태

예시:

```markdown
## Job

Prepare Verification Evidence for a Task by running the agreed checks, summarizing results, and exposing unverified scope.
```

## Workflow

`Workflow`는 agent가 실제로 따라야 하는 절차와 각 종료 형태다. 각 종료 branch는 caller가 이어받을 산출물, record ref, briefing, 미검증 범위를 명시한다.

기본 흐름:

1. 필요한 입력과 `read_first`를 확인한다.
2. 책임 경계를 확인한다.
3. 계약 범위 안에서 실행하거나 필요한 role/stage로 handoff한다.
4. output payload 또는 User briefing을 만든다.
5. 기록 가능하면 `geas-cli` 기준으로 기록한다.
6. 기록할 수 없으면 payload를 보존하고 stop condition을 드러낸다.

복잡한 Skill은 checklist와 종료 형태를 함께 둔다.

```markdown
## Workflow

Normal:
- Read required inputs and current runtime state.
- Confirm this Skill owns the requested output.
- Execute the assigned work inside the accepted contract.
- Record through `geas-cli` when recording is available.
- Return the record ref, summary, and unverified scope.

Handoff:
- Prepare role or stage handoff packet with `read_first`, focus, expected output, and stop condition.

User Decision:
- Prepare briefing with options, evidence refs, risks, and unverified scope.

Stop:
- Preserve payload.
- Report missing input, unreadable reference, unavailable CLI write, or required decision.
```

`Workflow` 안에서 필요한 경우에만 CLI recording, role handoff, validation loop를 설명한다. 모든 Skill에 별도 section으로 반복하지 않는다.

User-facing briefing:
- When output is long or decision-heavy, split it into TUI-friendly chunks of 2-3 related items.
- Detailed chunk order belongs in the owning Skill, not a global briefing reference.

## Inputs

`Inputs`는 Skill이 실행 전에 받아야 하는 정보를 분류한다.

권장 분류:

- User request
- accepted Mission Spec
- accepted Mission Design
- current Task Contract
- relevant Evidence
- User Judgment
- runtime state
- target files or payload
- handoff focus

필수 입력과 선택 입력을 구분한다. 필수 입력이 없으면 `Stop Conditions`로 간다.

## Resources

`Resources`는 이 Skill 폴더 안의 resource만 직접 링크한다.

규칙:

- 모든 필수 reference는 `SKILL.md`에서 직접 링크한다.
- reference chain은 한 단계로 둔다.
- reference는 필요할 때만 읽는 세부 형식, 예시, briefing shape, handoff packet shape를 담는다.
- script는 실행하는 대상으로 안내한다.
- asset은 실제 output 생성에 쓰일 때만 링크한다.
- 경로는 forward slash를 사용한다.

권장 형식:

| Resource | When to use | Purpose |
| --- | --- | --- |
| `references/example.md` | Evidence payload 작성 시 | 긴 shape와 예시를 확인한다. |
| `scripts/validate-example` | 기록 전 payload 검증 시 | 반복적이고 결정적인 검증을 실행한다. |

resource 선택 기준:

| Resource | 선택 기준 |
| --- | --- |
| `references/` | domain 설명, 산출물 형식, briefing shape, handoff packet, 예시처럼 필요할 때만 읽는 세부 문서 |
| `scripts/` | 반복적이고 결정적인 검증, 정렬, schema 확인, CLI wrapper 같은 실행 작업 |
| `assets/` | 실제 output에 쓰이는 템플릿, 이미지, 폰트, 샘플 파일 |
| `none` | Skill body와 일반 실행 도구로 충분한 경우 |

resource 후보는 만든 뒤 쓰는 방식이 아니라, `SKILL.md`가 안정되고 필요가 확인된 뒤 만든다.

## Gotchas

`Gotchas`는 이 Skill에서 자주 생기는 경계 위반과 방지 기준을 짧게 적는다.

Geas Skill에서 반복되는 gotcha 예시:

- Evidence verdict, recommendation, CLI 성공 상태를 User Judgment처럼 취급한다.
- role output의 substantive content를 caller나 coordinator가 대신 작성한다.
- CLI write 실패 뒤 기록된 것처럼 다음 단계로 간다.
- `read_first`나 필수 reference를 못 읽었는데 handoff를 진행한다.
- draft payload를 accepted artifact처럼 사용한다.
- Task Contract나 Mission baseline 밖 변경을 조용히 실행한다.
- repo root 문서를 Skill 실행 prerequisite으로 만든다.
- 다른 Skill 폴더의 reference를 필수 실행 경로로 만든다.

각 Skill은 자기 책임에서 실제로 자주 생길 gotcha만 남긴다.

## Stop Conditions

`Stop Conditions`는 계속 진행하기 위해 필요한 결정을 드러낸다.

공통 stop condition:

- User 결정이 필요하다.
- 필수 입력이 없다.
- required `read_first` path를 읽을 수 없다.
- 필수 reference path를 읽을 수 없다.
- expected output shape가 불명확하다.
- role-producing Skill이나 role prompt가 unavailable하다.
- CLI write가 unavailable하다.
- Task Contract나 Mission baseline 밖 변경이 필요하다.
- 검증 가능한 기준 없이 수용 판단 입력을 만들 수 없다.

stop briefing에는 현재까지 확인한 사실, 보존한 payload, 필요한 결정, 다음 가능한 행동을 담는다.

## Boundary

`Boundary`는 이 Skill이 하지 않는 일을 긍정 기준과 함께 적는다.

공통 경계:

- User Judgment는 User 결정에서 온다.
- Evidence는 User Judgment의 입력이지 대체물이 아니다.
- CLI 성공 결과는 기록 상태로만 다룬다.
- role-producing output의 substantive content는 해당 role이 작성한다.
- 프로젝트 루트 문서는 Geas repository 작업 문서이며, 배포 Skill의 일반 실행 prerequisite이 아니다.
- 다른 Skill 폴더의 reference는 handoff 입력이 될 수 있지만 필수 실행 경로가 아니다.
- 실제 output에 쓰이지 않는 placeholder reference, script, asset은 만들지 않는다.

## Archetype Notes

### Entry Skill

Entry Skill은 User 요청, runtime 상태, 다음 stage 선택을 조율한다.

강조할 것:

- current state recovery
- stage dispatch
- User briefing
- stop condition

상세 role output이나 Evidence content를 직접 작성하지 않는다.

### Stage Skill

Stage Skill은 Mission 안의 큰 단계를 조율한다.

강조할 것:

- accepted baseline 확인
- role handoff packet
- User 판단 입력
- runtime record 지점
- 다음 stage 전환

role-producing output의 substantive content를 대신 작성하지 않는다.

### Role-Producing Skill

Role-producing Skill은 특정 role 책임으로 Evidence나 finding을 만든다.

강조할 것:

- `read_first` 확인
- Task Contract 또는 challenge focus 확인
- 실제 실행 또는 점검
- Evidence payload
- 미검증 범위

수용 여부를 결정하지 않는다.

### Adapter Skill

Adapter Skill은 다른 Skill이 복사하지 않을 공통 실행 표면을 제공한다.

강조할 것:

- command 목적
- 입력 payload
- 성공 output
- 실패 시 payload 보존
- caller가 이어갈 stop briefing

artifact 본문의 의미를 대신 판단하지 않는다.

## Simple Application

다음은 `checking-links`라는 간단한 Skill에 구조를 적용한 축약 예시다.

```markdown
---
name: checking-links
description: Checks Markdown links in documentation files and reports broken targets. Use when the user asks to validate docs links, Markdown references, or `.md` link targets. Use coding tools for broader repository tests.
---

# Checking Links

## Job

Check Markdown link targets and prepare Verification Evidence with checked files, broken links, and unverified external links.

## Workflow

Normal:
- Confirm target Markdown files and accepted Task Contract.
- Run `scripts/check-links` for deterministic local target checks.
- Separate broken local links from skipped external links.
- Prepare Verification Evidence payload.
- Record through `geas-cli`.
- Return the Evidence ref, checked file list, broken link list, and unverified external link scope.

Stop:
- Preserve checker output and Verification Evidence payload.
- Report missing files, unavailable Task Contract, or unavailable CLI write.

## Inputs

- target Markdown files
- accepted Task Contract
- runtime state

## Resources

- Run `scripts/check-links` for deterministic local target checks.

## Gotchas

- Do not mark external links as passed unless they were actually checked.
- Do not fix links unless the Task Contract assigns that responsibility.

## Stop Conditions

- target files are missing
- Task Contract is unavailable
- CLI write is unavailable

## Boundary

This Skill checks Markdown links. It does not decide User acceptance or perform broader repository test coverage.
```
