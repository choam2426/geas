# Geas CLI 구현 설계

## 배경

`docs/roadmap.md`의 7단계 "CLI 구현"을 다룬다. `docs/cli.md`가 정의한 명령 표면과 `docs/runtime.md`가 정의한 artifact schema를 실제 실행 가능한 CLI로 구현한다.

CLI는 Orchestrator와 agent role이 `.geas/` runtime artifact를 기록하고 허용된 stage/phase 전이를 수행하기 위한 비대화형 도구다. CLI 자체는 완료 선언, 수용 판단, role 행위를 수행하지 않는다.

## 결정 요약

| 항목 | 결정 |
|---|---|
| 언어/런타임 | TypeScript, Node 18+ |
| 빌드 | esbuild → `bin/geas` 단일 번들 |
| 명령 파싱 | Commander.js |
| Schema 검증 | AJV + `cli/schemas/*.json` |
| YAML | js-yaml |
| 출력 | JSON result object (stdout), exit 0/1 |
| 테스트 | node:test, command-unit, tmpdir 격리 |
| Skill | `skills/geas-cli.md`, 얇은 참조 |
| 빌드 결과물 | `bin/geas`를 git에 commit, `git update-index --chmod=+x`로 실행 권한 설정 |
| Legacy 재사용 | 없음. 처음부터 작성 |

## 범위

### 포함

- `docs/cli.md`에 정의된 모든 명령의 구현
- 모든 runtime artifact의 JSON Schema 작성과 AJV 검증
- 명령별 transition guard 구현
- 명령 단위 smoke test (정상 흐름 + 주요 guard 실패 + schema 오류)
- `skills/geas-cli.md`: agent용 얇은 실행 레퍼런스 스킬

### 제외

- Dashboard 구현 (8단계)
- Plugin marketplace 구조 확장
- Payload scaffold/template 생성 명령
- 별도 `validate` 명령 (검증은 모든 명령에 inline)
- Agent client별 plugin 형식 고정

## Package 구조

```
cli/
  src/
    main.ts
    commands/
      init.ts
      mission.ts
      task.ts
      judgment.ts
      memory.ts
    lib/
      runtime.ts
      guards.ts
      schema.ts
      output.ts
  schemas/
    mission-spec.json
    mission-design.json
    task-contract.json
    task-state.json
    implementation-evidence.json
    verification-evidence.json
    review-evidence.json
    challenger-evidence.json
    task-evidence.json
    mission-evidence.json
    user-judgment.json
    memory-file.json
    memory-item.json
    run-state.json
  test/
    init.test.ts
    mission.test.ts
    task.test.ts
    judgment.test.ts
    memory.test.ts
  package.json
  tsconfig.json
  build.ts

bin/
  geas
```

`cli/`는 source와 test, `bin/geas`는 빌드 결과물이다. `cli/schemas/*.json`은 빌드 시 esbuild가 inline string으로 번들에 포함한다.

## Schema

### 작성 규칙

`docs/runtime.md`의 schema 정의를 JSON Schema로 그대로 옮긴다. 모든 schema는 다음 규칙을 따른다.

- 정의된 모든 key는 `required`. 작성할 내용이 없는 string field는 `""`, list field는 `[]`로 채운다 (`docs/runtime.md`의 규칙).
- `additionalProperties: false`. schema에 정의되지 않은 key는 거부한다.
- 모든 string field는 `type: "string"`이고 `minLength` 제약 없음 (빈 문자열 허용).
- 모든 list field는 `type: "array"`, `items: { type: "string" }` (또는 정의된 nested schema)이고 `minItems` 제약 없음 (빈 배열 허용).
- enum 값을 가진 field는 `enum` keyword로 enumerate.

### Schema 목록

| Schema id | 대상 artifact | 입출력 | 비고 |
|---|---|---|---|
| `mission-spec` | `mission-spec-NNN.yaml` | input + storage | |
| `mission-design` | `mission-design-NNN.yaml` | input + storage | nested: `alternatives_considered`, `task_breakdown` |
| `task-contract` | `task-contract-NNN.yaml` | input + storage | |
| `task-state` | `task-state.yaml` | storage | CLI가 직접 갱신 |
| `implementation-evidence` | `implementation-evidence-NNN.yaml` | input + storage | |
| `verification-evidence` | `verification-evidence-NNN.yaml` | input + storage | nested: `criteria_results`(verification 전용) |
| `review-evidence` | `review-evidence-NNN.yaml` | input + storage | nested: `findings`(review 전용) |
| `challenger-evidence` | `challenger-evidence-NNN.yaml` | input + storage | nested: `findings`(challenger 전용) |
| `task-evidence` | `task-evidence.yaml` | input + storage | nested: `criteria_results`(task 전용) |
| `mission-evidence` | `mission-evidence.yaml` | input + storage | nested: `mission_criteria_results` |
| `user-judgment` | `user-judgment-result-NNN.yaml` | input + storage | task/mission 모두 동일 schema, 위치로 구분 |
| `memory-file` | `memory/common.yaml`, `memory/roles/<role>.yaml` | storage | shape: `{ items: [memory-item] }`. common/role 동일 shape이므로 schema 통합 |
| `memory-item` | `memory record` payload | input | 단일 memory item |
| `run-state` | `run-state.yaml` | storage | CLI가 직접 갱신 |

### Enum 목록

CLI에서 사용하는 enum 값:

| 위치 | 필드 | 허용 값 |
|---|---|---|
| Run State | `current_stage` | `""`, `specifying`, `building`, `consolidating` |
| Task State | `phase` | `unstarted`, `implementing`, `verifying`, `reviewing`, `challenging`, `awaiting_user_judgment`, `closed` |
| Verification/Review/Challenger Evidence | `verdict` | `passed`, `changes_requested`, `escalated` |
| Verification Evidence | `criteria_results.result` | `passed`, `failed`, `partial`, `not_checked`, `blocked` |
| Task Evidence | `criteria_results.result` | `satisfied`, `satisfied_with_limits`, `not_satisfied` |
| Mission Evidence | `mission_criteria_results.result` | `satisfied`, `satisfied_with_limits`, `not_satisfied` |
| Challenger Evidence | `findings.risk_type` | `assumption`, `scope`, `verification_gap`, `operational_risk`, `tradeoff`, `repeat_risk` |
| User Judgment | `decision` | `accepted`, `accepted_with_limits`, `revise`, `deferred`, `stopped` |

### Nested object schema

각 nested object는 자기 schema 파일 안에 inline 정의한다 (별도 파일 분리 없음).

| Schema | nested key | nested 필드 |
|---|---|---|
| `mission-design` | `alternatives_considered[]` | `approach`, `benefit`, `cost`, `decision_reason` (모두 string) |
| `mission-design` | `task_breakdown[]` | `task_id`, `description`, `mission_coverage`(list of string), `depends_on`(list of string), `reason` |
| `verification-evidence` | `criteria_results[]` | `criterion`, `result`(enum), `basis` |
| `review-evidence` | `findings[]` | `finding`, `severity`, `basis`, `recommendation` |
| `challenger-evidence` | `findings[]` | `finding`, `risk_type`(enum), `basis`, `escalation` |
| `task-evidence` | `criteria_results[]` | `criterion`, `result`(enum), `evidence_refs`(list), `unverified_scope`(list), `remaining_risks`(list) |
| `mission-evidence` | `mission_criteria_results[]` | 위 `task-evidence`와 동일 |
| `memory-file` | `items[]` | `memory-item` schema와 동일: `guideline`, `applies_when`(list), `source_refs`(list) |

`memory-item` schema는 `memory-file.items[]`의 단일 항목 schema와 동일하다. 입력 검증(`memory record` payload)과 파일 검증(`common.yaml`, `roles/<role>.yaml`)의 단위가 달라 별도 schema id를 둔다.

## 의존성

| 패키지 | 용도 | 종류 |
|---|---|---|
| `commander` | CLI 명령 파싱 | runtime |
| `ajv` | JSON Schema 검증 | runtime |
| `js-yaml` | YAML read/write | runtime |
| `esbuild` | 번들 빌드 | dev |
| `tsx` | TypeScript dev runner (build script, tests) | dev |
| `typescript` | 타입 체크 | dev |
| `@types/node` | Node 타입 | dev |
| `@types/js-yaml` | js-yaml 타입 | dev |

번들된 `bin/geas`는 Node 표준 라이브러리만 외부 의존성으로 가진다 (esbuild가 모든 npm 의존성을 inline).

## 빌드

`cli/build.ts`는 esbuild로 `cli/src/main.ts`를 `bin/geas`로 번들한다.

- `platform: 'node'`, `target: 'node18'`
- `bundle: true`, `format: 'cjs'`, `minify: false`
- shebang `#!/usr/bin/env node`을 첫 줄에 prepend
- `cli/schemas/*.json`은 import해서 string으로 inline

`npm run build` 스크립트:

```bash
tsx cli/build.ts && git update-index --chmod=+x bin/geas
```

`bin/geas`는 git에 commit하고 plugin 설치 시 바로 실행 가능하게 둔다. `cli/dist/`는 두지 않고 빌드 결과물의 정본은 `bin/geas` 하나다.

## Core lib 아키텍처

### `lib/runtime.ts`

`.geas/` 파일시스템 접근의 단일 진입점.

함수 목록:

- `readRunState(): RunState | null`
- `writeRunState(state: RunState): void`
- `readTaskState(missionId: string, taskId: string): TaskState | null`
- `writeTaskState(missionId: string, taskId: string, state: TaskState): void`
- `readLatestBaseline(missionId: string, type: 'mission-spec' | 'mission-design'): { number: number, payload: any } | null`
- `readLatestTaskContract(missionId: string, taskId: string): { number: number, payload: any } | null`
- `readLatestUserJudgment(missionId: string, taskId?: string): { number: number, payload: any } | null`
- `writeNumberedArtifact(dir: string, prefix: string, payload: any): { path: string, number: number }`
- `writeFixedArtifact(path: string, payload: any): void`
- `existsArtifact(path: string): boolean`
- `missionDir(missionId: string): string`
- `taskDir(missionId: string, taskId: string): string`
- `materializeTaskDir(missionId: string, taskId: string): void`
- `nextNumber(dir: string, prefix: string): number`

쓰기는 임시 파일 → `fs.rename`으로 원자성 보장. 읽기는 파일 부재 시 `null` 반환.

타입 정의는 같은 파일에 둔다 (`RunState`, `TaskState` 등).

### `lib/guards.ts`

Transition 조건 확인.

함수 시그니처:

```typescript
type GuardFailure = {
  code: string;
  path?: string;
  status?: 'missing' | 'mismatched' | 'invalid';
  detail?: string;
};

type GuardResult = { ok: true } | { ok: false; guards: GuardFailure[] };
```

함수 목록:

- `checkInit(): GuardResult` — `.geas/` 부재 확인
- `checkMissionCreate(runState: RunState): GuardResult`
- `checkMissionSpecRecord(runState, payload): GuardResult`
- `checkMissionDesignRecord(runState, payload): GuardResult`
- `checkTaskContractRecord(runState, taskId, payload): GuardResult`
- `checkMissionTransition(runState, toStage, taskId?): GuardResult`
- `checkTaskTransition(runState, taskId, toPhase): GuardResult`
- `checkTaskEvidenceRecord(runState, taskId, kind, payload): GuardResult`
- `checkMissionEvidenceRecord(runState, payload): GuardResult`
- `checkJudgmentRecord(runState, target, taskId?, payload): GuardResult`
- `checkMemoryRecord(runState, scope, role?, payload): GuardResult`

각 guard 함수는 `docs/cli.md`의 명령별 조건을 그대로 검사한다. 실패 시 모든 위반 조건을 한 번에 모아 반환한다 (early return하지 않음).

### `lib/schema.ts`

AJV 인스턴스 초기화와 검증 진입점.

```typescript
function validate(schemaId: SchemaId, payload: unknown): { valid: true } | { valid: false; errors: string[] };
```

`SchemaId`는 `'mission-spec' | 'mission-design' | ...` union type. 빌드 타임에 `cli/schemas/*.json`을 import해서 AJV에 등록.

`docs/runtime.md`에 format 제약(date-time 등)이 없으므로 `ajv-formats`은 사용하지 않는다. AJV 기본 keyword (`type`, `enum`, `required`, `additionalProperties`, `items`, `properties`)만 사용.

### `lib/output.ts`

성공/실패 result object 생성과 stdout 출력.

```typescript
type SuccessResult = {
  ok: true;
  command: string;
  current: { mission_id: string; stage: string; task_id: string; phase: string };
  writes: Array<{ path: string; type: 'created' | 'updated' }>;
  state_changes: Array<{ pointer: string; from: string; to: string }>;
};

type FailureResult = {
  ok: false;
  command: string;
  current: { mission_id: string; stage: string; task_id: string; phase: string };
  writes: [];
  error: { code: string; guards?: GuardFailure[]; detail?: string };
};

function success(result: SuccessResult): never;  // stdout JSON, exit(0)
function failure(result: FailureResult): never;  // stdout JSON, exit(1)
```

JSON output은 `JSON.stringify(result, null, 2)`로 들여쓰기. diagnostic log는 stderr로 분리.

## 명령별 동작

### `commands/init.ts`

`geas init`

1. `checkInit()` — `.geas/` 부재 확인
2. `.geas/` 디렉토리 생성
3. `.geas/run-state.yaml`을 `current_mission_id: ""`, `current_stage: ""`, `current_task_id: ""`로 생성
4. `.geas/memory/common.yaml`을 `items: []`로 생성
5. `.geas/memory/roles/` 아래 6개 role 파일 (`orchestrator.yaml`, `work-designer.yaml`, `implementer.yaml`, `verifier.yaml`, `reviewer.yaml`, `challenger.yaml`)을 `items: []`로 생성
6. `.geas/missions/` 디렉토리 생성
7. success output

### `commands/mission.ts`

**`geas mission create`**

1. `readRunState()`, `checkMissionCreate(runState)`
2. mission id 생성 (`YYYYMMDD-` + 6자리 lowercase alphanumeric). 디렉토리 충돌 시 random 재생성
3. `missionDir(missionId)` 생성
4. `run-state.yaml`을 `current_mission_id: <id>`, `current_stage: 'specifying'`, `current_task_id: ''`로 갱신
5. success output

**`geas mission spec record --from <path|->`**

1. payload read (`--from -`이면 stdin, 아니면 파일)
2. YAML parse
3. `validate('mission-spec', payload)`
4. `readRunState()`, `checkMissionSpecRecord(runState, payload)`
5. `writeNumberedArtifact(missionDir, 'mission-spec', payload)`
6. success output

**`geas mission design record --from <path|->`**

1. payload read, YAML parse, `validate('mission-design', ...)`
2. `checkMissionDesignRecord(runState, payload)` — 이전 Mission Spec 존재, task_id 중복 없음, dependency가 존재하는 task 가리킴, dependency 순환 없음
3. `writeNumberedArtifact(missionDir, 'mission-design', payload)`
4. payload의 각 `task_breakdown` 항목에 대해 `materializeTaskDir(missionId, taskId)` — Task 디렉토리만 생성. `task-state.yaml`은 `task contract record`가 생성하므로 여기서는 만들지 않는다.
5. success output

**`geas mission transition --to <stage> [--task <task-id>]`**

1. `readRunState()`, `checkMissionTransition(runState, toStage, taskId)`
2. `building` 진입 시: 진입할 Task의 Task Contract 존재, dependency Task들이 Task Evidence + 수용된 result judgment 보유 등 확인
3. `consolidating` 진입 시: 대상 Task들의 Task Evidence + 수용된 result judgment 확인
4. `writeRunState(...)`로 stage/task_id 갱신
5. success output

**`geas mission evidence record --from <path|->`**

1. payload read, YAML parse, `validate('mission-evidence', ...)`
2. `checkMissionEvidenceRecord(runState, payload)` — `consolidating` stage, 수용된 mission-result judgment 존재
3. `writeFixedArtifact(missionDir/mission-evidence.yaml, payload)`
4. `writeRunState({mission_id: '', stage: '', task_id: ''})`
5. success output

### `commands/task.ts`

**`geas task contract record --task <id> --from <path|->`**

1. payload read, YAML parse, `validate('task-contract', ...)`
2. `checkTaskContractRecord(runState, taskId, payload)`:
   - stage가 `specifying` 또는 `building`
   - task_id가 현재 Mission Design의 task_breakdown에 존재
   - stage가 `building`이면 `current_task_id == taskId`이고 phase가 `awaiting_user_judgment`이고 current task-result judgment의 decision이 `revise`
3. `writeNumberedArtifact(taskDir, 'task-contract', payload)`
4. `task-state.yaml` 부재 시 `phase: 'unstarted'`로 생성
5. success output

**`geas task transition --to <phase> --task <id>`**

1. `checkTaskTransition(runState, taskId, toPhase)` — 공통 조건 + `docs/cli.md`의 허용 전이 표 확인
2. `writeTaskState(missionId, taskId, {phase: toPhase})`
3. success output

**`geas task evidence record --task <id> --kind <kind> --from -`**

1. payload read, YAML parse, kind별 schema 검증 (`implementation-evidence`, `verification-evidence`, `review-evidence`, `challenger-evidence`, `task-evidence`)
2. `checkTaskEvidenceRecord(runState, taskId, kind, payload)`:
   - `building` stage, `current_task_id == taskId`, Task Contract 존재, task-state 존재
   - kind가 현재 phase와 대응
   - `verification`/`review`/`challenger`는 `verdict` 값이 허용된 enum
   - `task` kind는 phase가 `awaiting_user_judgment`이고 current task-result judgment의 decision이 `accepted` 또는 `accepted_with_limits`
3. Evidence 기록 (kind에 따라 numbered 또는 fixed)
4. phase 자동 전진 (`docs/cli.md`의 phase 전이 표 따름)
5. `writeTaskState(...)`로 phase 갱신
6. success output

### `commands/judgment.ts`

**`geas judgment record --target <task-result|mission-result> [--task <id>] --from <path|->`**

1. payload read, YAML parse, `validate('user-judgment', ...)`
2. `checkJudgmentRecord(runState, target, taskId, payload)`
3. target에 따라 `taskDir/user-judgment-result-NNN.yaml` 또는 `missionDir/user-judgment-result-NNN.yaml`에 numbered 기록
4. state pointer 갱신은 하지 않음 (Evidence 기록 명령이 담당)
5. success output

### `commands/memory.ts`

**`geas memory record --scope <common|role> [--role <role>] --from <path|->`**

1. payload read, YAML parse, `validate('memory-item', payload)` — payload는 단일 memory item 구조 (`{guideline, applies_when, source_refs}`)
2. `checkMemoryRecord(runState, scope, role, payload)`:
   - `consolidating` stage, 수용된 mission-result judgment 존재
   - source_refs가 존재하는 runtime artifact 가리킴
   - `--scope role`이면 role이 허용된 6개 (`orchestrator`, `work-designer`, `implementer`, `verifier`, `reviewer`, `challenger`) 중 하나
3. 대상 memory file (`common.yaml` 또는 `roles/<role>.yaml`) read → `items` 배열에 payload append → write
4. success output

`memory-item.json`은 입력 payload 검증용 schema이고, `memory-file.json`은 파일 전체 구조 (`{items: [...]}`) schema다 (common/role 공용).

## 공통 동작

### Payload 입력

`--from <path>`는 파일 read. `--from -`는 stdin read. 둘 다 UTF-8 텍스트 → `js-yaml.load(...)`로 parse. parse 실패 시 `error.code = 'payload_parse_failed'`로 즉시 실패.

### Expected state 옵션

`--expect-stage <stage>`, `--expect-phase <phase>`, `--expect-task <task-id>`는 모든 쓰기 명령에 공통으로 추가. 실제 runtime 상태와 다르면 `error.code = 'state_conflict'`로 실패.

### Output

성공/실패 모두 stdout에 JSON object 출력. exit code는 성공 0, 실패 1.

다음 정보 포함:

- `command`: 실행한 명령 문자열
- `current`: 명령 실행 후의 runtime 위치 (실패 시 변경 전 위치)
- `writes`: 생성/갱신한 artifact 경로
- `state_changes`: state pointer 변경 내역
- (실패 시) `error.code`, `error.guards`

`run-state.yaml` 갱신 시 phase pointer는 함께 출력. `task-state.yaml` 갱신 시 phase 변화는 `state_changes`에 명시.

## 테스트

`test/*.test.ts`는 Node 내장 `node:test` + `node:assert`를 사용한다. `npm test` → `tsx --test test/*.test.ts`.

각 테스트는 다음 패턴을 따른다:

1. `os.tmpdir()` 아래 임시 디렉토리 생성, `process.chdir(tmpdir)`
2. 명령 모듈을 직접 import해서 함수 호출 (Commander parse를 거치지 않음). 각 명령 모듈은 `register*Commands(program)` 외에 명령 함수 자체를 export.
3. exit code mock과 stdout capture로 결과 확인
4. teardown: `fs.rm(tmpdir, {recursive: true, force: true})`

커버 범위:

- 정상 실행 (exit 0, output JSON 구조)
- 주요 guard 실패 (exit 1, error.guards 정확성)
- payload schema 오류 (exit 1, error.code)
- 자동 phase/stage 전이 (Evidence 기록 후 task-state 변화)

명령 흐름 전체를 검증하는 통합 시나리오는 7단계 범위 외다. command-unit 단위로만 본다.

## CLI Agent Skill

`skills/geas-cli.md`는 Orchestrator와 agent가 `geas` 명령을 호출하는 방법을 다루는 얇은 참조 스킬이다.

내용:

1. **호출 패턴 요약**: 임시 payload 파일 작성 → `geas <cmd> --from <path>` 호출 → JSON output 파싱
2. **주요 흐름별 명령 순서**:
   - Mission 시작: `init` (한 번) → `mission create` → `mission spec record` → `mission design record`
   - Task 실행: `mission transition --to building --task <id>` → `task contract record` → `task transition --to implementing` → `task evidence record --kind implementation` → ...
   - Mission 종료: `mission transition --to consolidating` → `judgment record --target mission-result` → `memory record` → `mission evidence record`
3. **Output 읽는 법**: `ok`, `current`, `writes`, `error.code`, `error.guards`
4. **자주 막히는 guard와 대응**: `current_task_contract_required`, `state_conflict`, `decision_not_revise` 등 4-5개 사례
5. **payload 예시**: Mission Spec, Task Contract, Implementation Evidence, User Judgment 각각 1개

전체 명령 레퍼런스는 `docs/cli.md` 링크. 분량은 200-300줄 이내로 유지.

## 책임 경계

- CLI는 완료 선언, 수용 판단, role 행위, agent verdict 승격을 수행하지 않는다.
- CLI는 `run-state.yaml`/`task-state.yaml`을 수동 set하는 명령을 두지 않는다.
- CLI는 별도 `validate` 명령을 두지 않는다. 검증은 모든 명령의 실행 전후 조건이다.
- CLI는 payload scaffold/template 명령을 두지 않는다.
- CLI는 dashboard, plugin marketplace 확장, agent client별 plugin 형식을 다루지 않는다.

## 산출물 (DoD)

- [ ] `cli/` 디렉토리에 source, schemas, test, build 구성
- [ ] `bin/geas` 빌드 결과물 commit, executable bit 설정
- [ ] `docs/cli.md`에 정의된 모든 명령이 동작
- [ ] 모든 runtime artifact의 JSON Schema 작성
- [ ] 명령별 transition guard 구현
- [ ] command-unit smoke test (정상 + 주요 실패 경로)
- [ ] `skills/geas-cli.md` 작성
- [ ] `docs/examples/runtime-minimal/` 시나리오를 실제 CLI로 재현 가능
