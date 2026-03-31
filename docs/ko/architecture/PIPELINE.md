# 파이프라인 참조

Geas Contract Engine의 모든 모드에 대한 정확한 단계별 실행 흐름이다.

---

## 목차

1. [Initiative 파이프라인](#initiative-파이프라인)
   - [Phase 1: Discovery](#phase-1-discovery)
   - [Phase 2: MVP Build](#phase-2-mvp-build)
   - [Phase 3: Polish](#phase-3-polish)
   - [Phase 4: Evolution](#phase-4-evolution)
2. [Sprint 파이프라인](#sprint-파이프라인)
3. [Debate 파이프라인](#debate-파이프라인)
4. [Checkpoint와 복구](#checkpoint와-복구)
5. [스킵 조건](#스킵-조건)
6. [에스컬레이션 경로](#에스컬레이션-경로)
7. [이벤트 로깅](#이벤트-로깅)

---

## Initiative 파이프라인

`/geas:initiative`로 실행한다. Discovery, MVP Build, Polish, Evolution 네 단계를 순서대로 거친다. Contract Engine이 모든 단계를 통제한다 -- 근거 없이 에이전트가 완료를 자체 보고하는 건 불가능하다.

---

### Phase 1: Discovery

코드 한 줄 쓰기 전에 모든 기획 산출물을 만든다.

#### 1.1 Seed 확인

- `.geas/spec/seed.json`(`/geas:intake`가 작성)을 읽는다.
- `completeness_checklist`에 `false`가 있고 override 플래그가 없으면: 사용자에게 알리고 `/geas:intake`를 다시 돌린다.
- 파일 자체가 없으면: 진행 전에 `/geas:intake`를 호출한다.

#### 1.2 비전 (Nova)

```
Agent(agent: "nova", ...)
Output: .geas/evidence/discovery/nova.json
```

Nova가 `seed.json`을 읽고 비전 선언, MVP 범위, 사용자 가치 제안을 작성한다. 다음으로 넘어가기 전에 출력 파일 존재를 확인한다.

#### 1.3 PRD와 사용자 스토리 (Nova)

```
Agent(agent: "nova", ...)
Outputs: .geas/spec/prd.md
         .geas/spec/stories.md
```

Nova가 `seed.json`과 `nova.json`을 읽고, `write-prd` skill로 PRD를 만든 다음 `write-stories` skill로 사용자 스토리를 분해한다. 두 파일 모두 있어야 다음으로 진행한다.

#### 1.4 아키텍처 (Forge)

```
Agent(agent: "forge", ...)
Output: .geas/memory/_project/conventions.md
        .geas/evidence/discovery/forge.json
```

Forge가 `seed.json`, `nova.json`, `prd.md`를 읽는다. 아키텍처와 기술 스택을 제안한다. 프로젝트 규칙과 아키텍처 근거를 기록한다. 검증 후 `.geas/decisions/dec-001.json`에 DecisionRecord를 쓴다.

#### 1.5 투표 라운드

세 에이전트가 Forge의 아키텍처에 대해 병렬로 투표한다:

```
Agent(agent: "circuit", ...) → .geas/evidence/discovery/vote-circuit.json
Agent(agent: "palette", ...) → .geas/evidence/discovery/vote-palette.json
Agent(agent: "critic",  ...) → .geas/evidence/discovery/vote-critic.json
```

Critic은 모든 투표 라운드에 반드시 참여해야 한다 -- 대체로 동의하더라도 악마의 대변인 역할로 리스크를 찾도록 설정되어 있다.

- 전원 동의 → 1.6으로 진행.
- 이견 발생 → `/geas:debate` 실행 후 재투표.

#### 1.6 TaskContract 컴파일

- `.geas/spec/stories.md`를 입력으로 쓴다. 각 사용자 스토리마다 `/geas:task-compiler`를 호출한다.
- 모든 TaskContract에 `rubric` 배열이 반드시 있어야 한다.

기본 rubric 차원:

| Dimension | Evaluator | Threshold |
|---|---|---|
| `core_interaction` | sentinel | 3 |
| `feature_completeness` | sentinel | 4 |
| `code_quality` | forge | 4 |
| `regression_safety` | sentinel | 4 |

UI 요소가 있는 태스크에 추가:

| Dimension | Evaluator | Threshold |
|---|---|---|
| `ux_clarity` | sentinel | 3 |
| `visual_coherence` | sentinel | 3 |

컴파일된 계약마다 로그를 남긴다:
```json
{"event": "task_compiled", "task_id": "...", "timestamp": "<actual>"}
```

#### 1.7 MCP 서버 추천

Forge의 아키텍처 결정에서 기술 스택을 분석하고 카테고리별 MCP 서버를 추천한다:

| 스택 카테고리 | MCP 카테고리 | 이유 |
|---|---|---|
| 관계형 데이터베이스 | Database query MCP | Worker가 스키마를 살펴보고 읽기 전용 쿼리를 돌릴 수 있다 |
| 문서형 데이터베이스 | Database query MCP | Worker가 컬렉션을 탐색할 수 있다 |
| 웹 프론트엔드 | Web standards MCP | Worker가 스펙 문서를 참조할 수 있다 |
| 배포 대상이 있음 | Performance audit MCP | Sentinel이 성능과 접근성을 감사할 수 있다 |
| Git 호스팅 | Git platform MCP | Keeper가 PR과 이슈를 관리할 수 있다 |

MCP 레지스트리의 설치 명령어와 함께 추천한다. 사용자가 연결하면 `.geas/config.json`의 `connected_mcp`에 기록한다.

#### 1.8 Discovery 종료

- 실행 상태 갱신: `{ "phase": "mvp", "status": "in_progress" }`
- 로그: `{"event": "phase_complete", "phase": "discovery", "timestamp": "<actual>"}`

---

### Phase 2: MVP Build

`.geas/tasks/`의 모든 TaskContract를 의존성 순서대로 전체 파이프라인에 태운다. Code Review와 Testing은 모든 태스크에서 필수다.

#### 2.0 태스크 시작

1. TaskContract를 읽는다. 선언된 의존성이 전부 `"passed"` 상태인지 확인한다.
2. 태스크 상태를 `"in_progress"`로 바꾼다.
3. `task_started` 이벤트를 기록한다.
4. **`.geas/state/run.json`에 `remaining_steps`를 기록한다** -- 이 태스크의 전체 단계 목록:

```json
"remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "code_review", "testing", "evidence_gate", "critic_review", "nova_review", "retrospective", "resolve"]
```

스킵할 단계는 미리 빼고 기록한다(예: 사용자 인터페이스가 없으면 `"design"` 제거). 각 단계가 끝나면 배열 앞에서 빼고 `run.json`을 갱신한다.

5. **Rubric 확인**: TaskContract에 `rubric` 필드가 없으면 기본 rubric을 넣고 진행한다(1.6의 차원 표 참조).

#### 2.1 디자인 (Palette) [기본 실행 -- 스킵 조건은 5장 참조]

태스크에 사용자 대면 인터페이스(페이지, 폼, 대시보드)가 있으면 실행한다.

```
Update run.json: pipeline_step = "design", agent_in_flight = "palette"
Agent(agent: "palette", prompt: "Read .geas/packets/{task-id}/palette.md. Write design spec to .geas/evidence/{task-id}/palette.json")
```

`.geas/evidence/{task-id}/palette.json` 존재를 확인한다.

#### 2.2 Tech Guide (Forge) [기본 실행 -- 스킵 조건은 5장 참조]

```
Update run.json: pipeline_step = "tech_guide", agent_in_flight = "forge"
Agent(agent: "forge", prompt: "Read .geas/packets/{task-id}/forge.md. Write tech guide to .geas/evidence/{task-id}/forge.json")
```

`.geas/evidence/{task-id}/forge.json` 존재를 확인한다.

#### 2.3 Implementation Contract [MANDATORY]

`/geas:implementation-contract`를 호출한다. Worker가 구체적 행동 계획을 제안하고, 코드 작성 전에 Sentinel과 Forge가 둘 다 승인해야 한다.

```
Update run.json: pipeline_step = "implementation_contract", agent_in_flight = "{worker}"
```

내부적으로 세 단계가 돌아간다:
1. **Worker가 계약 초안 작성** -- `planned_actions`, `edge_cases`, `state_transitions`, `non_goals`, `demo_steps`를 `.geas/contracts/{task-id}.json`에 `status: "draft"`로 기록한다.
2. **Sentinel 리뷰** -- `demo_steps`가 모든 인수 기준을 커버하는지 확인하고, 빠진 엣지 케이스를 지적한다.
3. **Forge 리뷰** -- `planned_actions`가 tech guide와 일치하고 기술적으로 실현 가능한지 확인한다.

처리:
- 둘 다 승인 → 계약 상태를 `"approved"`로, `approved_by`를 설정한다. 2.4로 진행.
- 수정 요청 → worker가 수정 후 재제출한다. 수정 사이클은 1회만 허용하며, 이후 Forge가 최종 결정을 내린다.

`.geas/contracts/{task-id}.json`이 `status: "approved"`인지 확인한 뒤 진행한다.

이벤트 기록:
```json
{"event": "implementation_contract", "task_id": "...", "status": "approved|revision_requested", "timestamp": "..."}
```

#### 2.4 구현 [MANDATORY -- worktree 격리]

```
Update run.json: pipeline_step = "implementation", agent_in_flight = "{worker}"
Agent(agent: "{worker}", isolation: "worktree", prompt: "Read .geas/packets/{task-id}/{worker}.md. Implement the feature. Write evidence to .geas/evidence/{task-id}/{worker}.json")
```

근거 존재를 확인한다. 진행 전에 worktree 브랜치를 머지한다.

#### 2.5 코드 리뷰 (Forge) [MANDATORY]

```
Update run.json: pipeline_step = "code_review", agent_in_flight = "forge"
Agent(agent: "forge", prompt: "Read .geas/packets/{task-id}/forge-review.md. Review implementation. Write to .geas/evidence/{task-id}/forge-review.json")
```

`.geas/evidence/{task-id}/forge-review.json` 존재를 확인한다.

#### 2.6 테스트 (Sentinel) [MANDATORY]

```
Update run.json: pipeline_step = "testing", agent_in_flight = "sentinel"
Agent(agent: "sentinel", prompt: "Read .geas/packets/{task-id}/sentinel.md. Test the feature. Write QA results to .geas/evidence/{task-id}/sentinel.json")
```

`.geas/evidence/{task-id}/sentinel.json` 존재를 확인한다.

#### 2.7 Evidence Gate

`/geas:evidence-gate` skill을 실행한다. 전체 3단계 프로토콜은 [Evidence Gate](#evidence-gate) 참조.

- TaskContract의 `eval_commands`를 실행한다.
- 수집한 근거 대비 모든 인수 기준을 확인한다.
- Rubric 차원별 점수를 매긴다.
- 단계별 분석이 포함된 상세 결과를 기록한다.

Gate 실패 시 → `/geas:verify-fix-loop`를 호출한다. Worker를 스폰해서 수정한 뒤, gate를 다시 돌린다.

#### 2.8 Critic 출시 전 리뷰 [MANDATORY]

```
Update run.json: pipeline_step = "critic_review", agent_in_flight = "critic"
Agent(agent: "critic", prompt: "Read all evidence at .geas/evidence/{task-id}/. Challenge: is this truly ready to ship? Identify risks, missing edge cases, or technical debt. Write to .geas/evidence/{task-id}/critic-review.json")
```

`.geas/evidence/{task-id}/critic-review.json` 존재를 확인한다.

#### 2.9 Nova 제품 리뷰 [MANDATORY]

```
Update run.json: pipeline_step = "nova_review", agent_in_flight = "nova"
Agent(agent: "nova", prompt: "Read all evidence at .geas/evidence/{task-id}/ including critic-review.json. Verdict: Ship, Iterate, or Cut. Write to .geas/evidence/{task-id}/nova-verdict.json")
```

#### 2.10 Ship Gate

태스크를 `"passed"`로 표시하기 전에, 네 개의 필수 근거 파일이 전부 있는지 각각 읽어 확인한다:

| 파일 | 출처 단계 |
|---|---|
| `.geas/evidence/{task-id}/forge-review.json` | 2.5 코드 리뷰 |
| `.geas/evidence/{task-id}/sentinel.json` | 2.6 테스트 |
| `.geas/evidence/{task-id}/critic-review.json` | 2.8 Critic 출시 전 리뷰 |
| `.geas/evidence/{task-id}/nova-verdict.json` | 2.9 Nova 제품 리뷰 |

빠진 파일이 있으면: 돌아가서 해당 단계를 실행한다. 네 개가 다 없이는 절대 진행하지 않는다.

#### 회고 (Scrum) [MANDATORY]

```
Update run.json: pipeline_step = "retrospective", agent_in_flight = "scrum"
Agent(agent: "scrum", prompt: "Read all evidence at .geas/evidence/{task-id}/. Run retrospective: update rules.md with new conventions, write lessons to .geas/memory/retro/{task-id}.json")
```

`.geas/memory/retro/{task-id}.json` 존재를 확인한다.

#### 2.11 종결

2.9 단계의 Nova 판정에 따라:

| 판정 | 행동 |
|---|---|
| **Ship** | `.geas/tasks/{task-id}.json`을 읽어 `"status": "passed"`로 설정하고 다시 쓴다. Keeper를 스폰해서 커밋한다(아래 참조). |
| **Iterate** | Nova의 피드백을 추가 컨텍스트로 넣어 worker를 다시 보낸다. |
| **Cut** | 태스크 상태를 `"failed"`로 설정한다. `.geas/decisions/{dec-id}.json`에 DecisionRecord를 쓴다. |

Keeper 커밋 (Ship인 경우만):
```
Update run.json: pipeline_step = "resolve", agent_in_flight = "keeper"
Agent(agent: "keeper", prompt: "Commit all changes for {task-id} with conventional commit format. Write to .geas/evidence/{task-id}/keeper.json")
```

로그: `{"event": "task_resolved", "task_id": "...", "verdict": "ship|iterate|cut", "timestamp": "<actual>"}`

#### Phase 2 종료

모든 TaskContract가 종결되면:

```json
{"event": "phase_complete", "phase": "mvp", "timestamp": "<actual>"}
```

---

### Phase 3: Polish

필수 -- 건너뛰면 안 된다.

```
Agent(agent: "shield", prompt: "Security review of the project. Write to .geas/evidence/polish/shield.json")
```

`.geas/evidence/polish/shield.json` 존재를 확인한다.

```
Agent(agent: "scroll", prompt: "Write README and docs. Write to .geas/evidence/polish/scroll.json")
```

`.geas/evidence/polish/scroll.json` 존재를 확인한다.

Shield나 Scroll이 찾은 이슈를 수정한다. 단계 완료 기록:

```json
{"event": "phase_complete", "phase": "polish", "timestamp": "<actual>"}
```

---

### Phase 4: Evolution

필수 -- 건너뛰면 안 된다.

seed의 `scope_in`에 남은 작업이 있는지 평가한다. `scope_out`에 있는 기능은 거부한다. 범위 내 개선이 필요하면 에이전트를 스폰한다.

**Nova 최종 브리핑 (필수):**
```
Agent(agent: "nova", prompt: "Final product review. Read all evidence. Deliver strategic summary and recommendations. Write to .geas/evidence/evolution/nova-final.json")
```

**Keeper 릴리스 관리:**
```
Agent(agent: "keeper", prompt: "Create release: version bump, changelog, final commit. Write to .geas/evidence/evolution/keeper-release.json")
```

`/geas:run-summary`를 호출해서 세션 감사 추적을 생성한다.

종료:
```json
{"event": "phase_complete", "phase": "complete", "timestamp": "<actual>"}
```

---

## Sprint 파이프라인

`/geas:sprint`로 실행한다. 기존 프로젝트에 범위가 정해진 기능 하나를 추가한다. Discovery를 건너뛴다. 기능 하나, 파이프라인 하나.

### 사전 조건

**seed.json 동작:**

| 상황 | 행동 |
|---|---|
| `.geas/spec/seed.json`이 있다 | 읽기 전용. 미션과 제약을 불러온다. Sprint는 절대 수정하지 않는다. |
| `.geas/spec/seed.json`이 없다 | Intake가 최소 seed를 생성한다. |

**규칙 감지:**

| 상황 | 행동 |
|---|---|
| `.geas/memory/_project/conventions.md`가 있다 | 온보딩을 건너뛴다. 규칙을 읽고 진행한다. |
| `.geas/memory/_project/conventions.md`가 없다 | Forge를 스폰해서 온보딩한다(아래 [온보딩](#온보딩) 참조). |

### 온보딩 (첫 Sprint 한정)

Compass가 `.geas/state/run.json`이 없는 걸 감지하면 시작된다. Forge 혼자 돌린다 -- 병렬 에이전트 없음.

단계:

1. **구조 스캔** -- 마커 파일(`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`)로 스택을 감지한다. 프레임워크, 빌드 시스템, 테스트 프레임워크, 패키지 매니저를 식별한다.
2. **아키텍처 매핑** -- 진입점, 라우팅 패턴, DB 연결, 핵심 모듈, 외부 서비스를 파악한다.
3. **규칙 감지** -- 린터 설정, 네이밍 패턴, 임포트 스타일, 타입 검사 설정을 읽는다.
4. **적응적 깊이** -- 프로젝트 규모에 따라 스캔 깊이를 조절한다:

| 규모 | 파일 수 | 스캔 전략 |
|---|---|---|
| 소형 | ~50개 | 전체 스캔 -- 모든 소스 파일을 읽는다 |
| 중형 | 50-500개 | 집중 스캔 -- `src/` + 설정 + 진입점 + 핵심 모듈 |
| 대형 | 500개 이상 | 타겟 스캔 -- Sprint 기능과 관련된 디렉토리만 |

5. **출력** -- `.geas/memory/_project/conventions.md`와 `.geas/memory/_project/state.json`을 기록한다.

두 번째 Sprint부터는 conventions.md가 이미 있으므로 온보딩을 완전히 건너뛴다.

### Sprint 단계

#### Step 1: TaskContract 컴파일

기능에 대해 `/geas:task-compiler`를 호출한다. TaskContract에 `rubric` 배열이 반드시 있어야 한다(Initiative 1.6과 동일한 차원).

checkpoint에 `remaining_steps`를 기록한다:
```json
"remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "code_review", "testing", "evidence_gate", "critic_review", "nova_review", "retrospective", "resolve"]
```

스킵할 단계를 미리 빼고 기록한다. 각 단계 완료 후 앞에서 빼고 `run.json`을 갱신한다.

Rubric 확인: TaskContract에 `rubric`이 없으면 기본값을 넣는다.

#### Step 2: 디자인 (Palette) [기본 실행 -- 스킵 조건은 5장 참조]

```
Update run.json: pipeline_step = "design", agent_in_flight = "palette"
Agent(agent: "palette", ...) → .geas/evidence/{task-id}/palette.json
```

#### Step 3: Tech Guide (Forge) [기본 실행 -- 스킵 조건은 5장 참조]

```
Update run.json: pipeline_step = "tech_guide", agent_in_flight = "forge"
Agent(agent: "forge", ...) → .geas/evidence/{task-id}/forge.json
```

#### Step 4: Implementation Contract [MANDATORY]

`/geas:implementation-contract`를 호출한다. Initiative 2.3과 동일한 3단계 과정이다. `.geas/contracts/{task-id}.json`이 `status: "approved"`인지 확인한다.

#### Step 5: 구현 [MANDATORY -- worktree 격리]

```
Update run.json: pipeline_step = "implementation", agent_in_flight = "{worker}"
Agent(agent: "{worker}", isolation: "worktree", ...) → .geas/evidence/{task-id}/{worker}.json
```

근거를 확인한다. Worktree를 머지한다.

#### Step 6: 코드 리뷰 (Forge) [MANDATORY]

```
Update run.json: pipeline_step = "code_review", agent_in_flight = "forge"
Agent(agent: "forge", ...) → .geas/evidence/{task-id}/forge-review.json
```

#### Step 7: 테스트 (Sentinel) [MANDATORY]

```
Update run.json: pipeline_step = "testing", agent_in_flight = "sentinel"
Agent(agent: "sentinel", ...) → .geas/evidence/{task-id}/sentinel.json
```

#### Step 8: Evidence Gate

`eval_commands` 실행, 인수 기준 확인, rubric 채점. 실패 시 → `/geas:verify-fix-loop` 호출. Worker를 스폰해서 수정한다. 수정 후 gate를 다시 돌린다.

#### Step 8.5: Critic 출시 전 리뷰 [MANDATORY]

```
Update run.json: pipeline_step = "critic_review", agent_in_flight = "critic"
Agent(agent: "critic", ...) → .geas/evidence/{task-id}/critic-review.json
```

파일 존재를 확인한다.

#### Step 9: Nova 제품 리뷰 [MANDATORY]

```
Update run.json: pipeline_step = "nova_review", agent_in_flight = "nova"
Agent(agent: "nova", ...) → .geas/evidence/{task-id}/nova-verdict.json
```

판정: Ship / Iterate / Cut.

#### Ship Gate

Initiative 2.10과 동일하게 네 파일을 확인한다. 빠진 파일이 있으면 해당 단계를 먼저 실행한다.

#### 회고 (Scrum) [MANDATORY]

```
Update run.json: pipeline_step = "retrospective", agent_in_flight = "scrum"
Agent(agent: "scrum", ...) → .geas/memory/retro/{task-id}.json
```

#### Step 10: 종결

| 판정 | 행동 |
|---|---|
| Ship | 태스크 `"status": "passed"` 설정. Keeper를 스폰해서 커밋. |
| Iterate | Nova 피드백을 넣어 worker를 다시 보낸다. |
| Cut | `"status": "failed"` 설정. DecisionRecord 작성. |

#### Step 11: 실행 요약

`/geas:run-summary`를 호출해서 세션 감사 추적을 생성한다.

---

## Debate 파이프라인

`/geas:debate`로 실행한다. 코드를 만들지 않는다. 산출물은 `DecisionRecord`다.

### Step 1: 질문 구성

사용자의 질문을 명확한 결정으로 정리한다. 2-3개의 구체적 선택지를 만든다. 에이전트를 스폰하기 전에 사용자와 프레이밍을 확인한다.

### Step 2: 토론자 스폰

네 에이전트가 병렬로 실행한다:

```
Agent(agent: "forge",   prompt: "Argue FOR option A. Technical rationale, pros, cons, risks.")
Agent(agent: "critic",  prompt: "Argue AGAINST option A / FOR option B. Challenge assumptions.")
Agent(agent: "circuit", prompt: "Evaluate both from backend/scalability perspective.")
Agent(agent: "palette", prompt: "Evaluate both from UX/frontend perspective.")
```

### Step 3: 종합

사용자에게 요약을 보여준다: 각 에이전트의 논거, 트레이드오프, 각자의 추천.

### Step 4: 결정

사용자에게 최종 결정을 요청한다. `.geas/decisions/{dec-id}.json`에 DecisionRecord를 쓴다.

---

## Evidence Gate

`/geas:evidence-gate`로 실행한다. 각 구현 단계 후(그리고 2.7 / Step 8에서 명시적으로) 호출한다.

### 입력

1. `EvidenceBundle` -- `.geas/evidence/{task-id}/{worker-name}.json`
2. `TaskContract` -- `.geas/tasks/{task-id}.json`
3. Gate 레벨 -- 어떤 단계를 돌릴지

### 단계 선택

| 상황 | 실행 단계 |
|---|---|
| 구현 태스크 (코드 변경) | Tier 1 + Tier 2 |
| 디자인 스펙 (코드 없음) | Tier 2만 |
| 기능 완료 (릴리스 준비) | Tier 1 + Tier 2 + Tier 3 |
| 코드 리뷰 (Forge 리뷰) | Tier 2만 |
| QA 테스트 (Sentinel) | Tier 1 + Tier 2 |
| 보안 리뷰 (Shield) | Tier 2만 |
| 단계 완료 | Tier 1 + Tier 2 + Tier 3 |

### Tier 1: 기계적 Gate

1. TaskContract에서 `eval_commands`를 읽는다.
2. 각 명령어를 실행한다. 기록: `pass` (exit 0), `fail` (비정상 종료, 출력 캡처), `skip` (해당 없음).
3. 첫 실패에서 중단한다 -- 빌드가 깨지면 의미적 검사를 돌릴 이유가 없다.
4. 명령어가 없으면 `"skip"`으로 기록한다. 명령어가 있는데 실행하지 않는 건 gate 위반이다.

EvidenceBundle에 `verify_results`가 있으면 새로 실행한 결과와 비교한다. 새 결과를 신뢰한다.

### Tier 2: 의미적 Gate

**Part A -- 인수 기준:**
`acceptance_criteria`의 각 기준마다:
1. Worker 근거(summary, files_changed, criteria_results)를 읽는다.
2. Worker가 `criteria_results`를 제공했으면 자기 평가를 검증한다. 없으면 근거에서 추론한다.
3. `{ "criterion": "...", "met": true/false, "evidence": "..." }`를 기록한다.

모든 기준이 충족되어야 rubric 채점으로 넘어간다.

**Part B -- Rubric 채점:**
1. TaskContract에서 `rubric` 배열을 읽는다.
2. 평가자 근거를 읽는다: Forge 근거 → `code_quality` 점수, Sentinel 근거 → 나머지 차원.
3. 각 `rubric_scores` 항목을 해당 `threshold`와 비교한다.

임곗값 조정 규칙:
- Worker의 `self_check.confidence`가 2 이하이면: 모든 임곗값에 +1 (더 엄격한 리뷰).
- Worker의 `self_check.possible_stubs`가 비어있지 않으면: 스텁이 해결되었는지 확인한다. 확인된 스텁이 있으면 → `feature_completeness`를 2로 제한한다.

모든 rubric 차원이 임곗값을 넘어야 Tier 2가 통과한다. `blocking_dimensions`에 실패한 차원이 정확히 나열된다.

### Tier 3: 제품 Gate

Nova를 스폰한다. 입력: 태스크 목표, 모든 근거 번들, Tier 2 기준 결과, seed의 미션 맥락.

Nova의 판정: **Ship** / **Iterate** / **Cut**.

Tier 3는 기능 완료, 단계 완료, 피벗 결정에서만 돌린다.

### Gate 출력

```json
{
  "task_id": "task-003",
  "verdict": "pass | fail | iterate",
  "tiers": {
    "mechanical": { "status": "pass", "results": {} },
    "semantic": { "status": "pass", "criteria_met": 5, "criteria_total": 5, "rubric_pass": true, "rubric_scores": [], "blocking_dimensions": [] },
    "product": { "status": "ship", "nova_notes": "..." }
  },
  "failures": [],
  "timestamp": "..."
}
```

`.geas/ledger/events.jsonl`에 기록:
```json
{
  "event": "gate_result",
  "task_id": "task-001",
  "result": "pass",
  "tiers": { ... },
  "timestamp": "<actual ISO 8601>"
}
```

### Verify-Fix Loop (gate 실패 시)

Gate가 실패하면 `/geas:verify-fix-loop`를 호출한다.

**진입:**
1. TaskContract에서 `retry_budget`(기본값: 3)과 `escalation_policy`를 읽는다.
2. `.geas/evidence/{task-id}/sentinel.json`에서 실패한 EvidenceBundle을 읽는다.
3. Gate 판정을 읽는다 -- 어떤 단계가 왜 실패했는지.

**반복당:**

| 하위 단계 | 행동 |
|---|---|
| A: 수정자 결정 | 프론트엔드 버그 → Pixel. 백엔드 버그 → Circuit. 둘 다 → 명확한 소유권으로 둘 다 스폰. |
| B: 수정자 스폰 | `isolation: "worktree"`. ContextPacket에 실패 사항, 미충족 기준, `blocking_dimensions`, files_changed를 포함한다. |
| C: Gate 재실행 | `/evidence-gate` 호출. Tier 1 + Tier 2를 돌린다. |
| D: 평가 | 통과 → 루프를 빠져나가 Nova(Tier 3)로 진행. 실패 → 다음 반복 또는 에스컬레이션. |

수정자가 끝나면 worktree 브랜치를 머지한 뒤 gate를 다시 돌린다.

**예산 소진 후** -- `escalation_policy`에 따른다([에스컬레이션 경로](#에스컬레이션-경로) 참조).

---

## Checkpoint와 복구

### remaining_steps 배열 동작

`.geas/state/run.json`의 `remaining_steps`는 현재 태스크에서 남은 작업의 권위 있는 기록이다.

- 태스크 시작 시(2.0 / Sprint Step 1) 전체 단계 목록으로 기록된다.
- 스킵할 단계는 기록 전에 배열에서 뺀다.
- 각 단계가 성공적으로 끝나면: 배열 **앞**에서 빼고 갱신된 배열을 `run.json`에 다시 쓴다.
- 세션이 단계 도중에 중단되면, `remaining_steps[0]`이 재개할 단계다.

### run.json checkpoint 필드

각 단계는 에이전트를 스폰하기 전에 `.geas/state/run.json`의 이 필드들을 갱신한다:

```json
{
  "current_task_id": "{task-id}",
  "pipeline_step": "{step_name}",
  "agent_in_flight": "{agent_name}",
  "remaining_steps": [...]
}
```

### 세션 재개 프로토콜

Compass가 시작할 때 `status: "in_progress"`인 `run.json`이 있으면:

1. `run.json`에서 `current_task_id`, `pipeline_step`, `remaining_steps`를 읽는다.
2. 중단된 단계의 근거가 이미 있는지 확인한다.
   - 근거가 있다 → 세션 종료 전에 단계가 완료된 것이다. `remaining_steps`에서 빼고 다음 단계로 넘어간다.
   - 근거가 없다 → 해당 단계를 처음부터 다시 실행한다.
3. 하위 단계를 재개하기 전에, 이전 단계의 필수 근거 파일이 있는지 확인한다(완료 직전 태스크에는 Ship Gate 검사를 적용한다).

`restore-context` 훅이 세션 시작 시 `run.json`을 불러오고, 진행 전에 재개 지점을 사용자에게 보여준다.

---

## 스킵 조건

### 디자인 (Palette) -- 단계 2.1 / Sprint step 2

| 조건 | 디자인 실행? |
|---|---|
| 태스크에 페이지, 폼, 대시보드가 있다 | 예 -- 항상 실행 |
| 태스크가 백엔드 전용이다 (API, CI, Docker, DB 마이그레이션) | 아니오 -- 스킵 |
| 태스크가 순수 라이브러리 또는 유틸리티 모듈이다 | 아니오 -- 스킵 |

디자인은 기본적으로 실행한다. 사용자 대면 인터페이스가 **전혀 없을 때만** 스킵한다.

### Tech Guide (Forge) -- 단계 2.2 / Sprint step 3

Tech Guide는 다음 조건이 **전부 동시에** 참일 때만 스킵한다:

| 조건 | 스킵하려면 참이어야 함 |
|---|---|
| 태스크가 `conventions.md`의 기존 패턴을 따른다 | O |
| 새 외부 라이브러리나 서비스가 필요 없다 | O |
| 단일 모듈 범위다 (모듈 경계를 넘는 변경 없음) | O |
| 데이터 모델이나 스키마 변경이 없다 | O |

Tech Guide는 다음 중 **하나라도** 해당하면 실행한다:

| 트리거 | Tech Guide 실행? |
|---|---|
| 새 외부 라이브러리나 서비스 연동 | 예 |
| 아키텍처 패턴 변경 | 예 |
| 모듈 간 의존성 | 예 |
| 새 데이터 모델이나 스키마 변경 | 예 |

---

## 에스컬레이션 경로

Verify-fix loop이 재시도 예산(`retry_budget`, TaskContract에서 정의, 기본값: 3)을 소진하면 에스컬레이션이 발생한다.

| `escalation_policy` 값 | 담당자 | 행동 |
|---|---|---|
| `"forge-review"` (기본값) | Forge | 아키텍처 리뷰. 고칠 수 있는 근본 원인을 찾으면 → 수정 + 테스트 1회 더. 접근 자체가 잘못되었으면 → Nova에게 넘긴다. |
| `"nova-decision"` | Nova | 전략적 결정: 범위 축소, 기능 폐기, 대안 접근, 또는 밀어붙이기. |
| `"pivot"` | Compass | 전체 맥락을 가지고 `/pivot-protocol`을 호출한다. |

모든 에스컬레이션에 공통:
1. TaskContract 상태를 `"escalated"`로 변경한다.
2. `.geas/decisions/{dec-id}.json`에 DecisionRecord를 쓴다.
3. `.geas/ledger/events.jsonl`에 에스컬레이션 이벤트를 기록한다.

`forge-review` → Nova 경로:

```
Gate가 N번 실패
  → Forge가 리뷰 (forge-escalation.json)
      → 고칠 수 있나? → 수정 1회 + gate 재실행
      → 접근이 잘못됐나? → Nova가 결정
          → 범위 축소 / 기능 폐기 / 대안 / 밀어붙이기
  → DecisionRecord 작성
  → status: "escalated"
```

---

## 이벤트 로깅

모든 이벤트는 `.geas/ledger/events.jsonl`(줄바꿈 구분 JSON)에 추가된다. 타임스탬프는 `date -u`로 얻은 실제 ISO 8601 값이어야 하며, 플레이스홀더 문자열은 안 된다.

### 표준 step_complete 이벤트

각 단계가 끝나고 `remaining_steps`에서 제거된 후 기록한다.

```json
{"event": "step_complete", "task_id": "{task-id}", "step": "{step_name}", "agent": "{agent_name}", "timestamp": "<actual>"}
```

`step_complete`를 쓰는 단계: `design`, `tech_guide`, `implementation`, `code_review`, `testing`, `critic_review`, `nova_review`, `retrospective`.

### 자체 형식이 있는 이벤트 (step_complete 중복 없음)

| 단계 | 이벤트 이름 | 기록 시점 |
|---|---|---|
| Implementation Contract | `implementation_contract` | 승인 또는 수정 요청 후 |
| Evidence Gate | `gate_result` | gate 완료 후 (통과 또는 실패) |
| Resolve | `task_resolved` | Ship/Iterate/Cut 결정 후 |

### 단계 및 생명주기 이벤트

| 이벤트 | 기록 시점 |
|---|---|
| `task_compiled` | 각 TaskContract 컴파일 후 (Discovery 1.6) |
| `task_started` | 각 태스크 시작 시 (단계 2.0) |
| `phase_complete` | 각 단계 종료 시 (Discovery, MVP, Polish, Evolution) |
| 에스컬레이션 이벤트 | 재시도 예산 소진 후 escalation_policy 발동 시 |

### gate_result 이벤트 구조

```json
{
  "event": "gate_result",
  "task_id": "task-001",
  "result": "pass|fail",
  "tiers": {
    "mechanical": { "status": "pass|fail|skip", "commands_run": ["..."] },
    "semantic": { "status": "pass|fail", "criteria_met": 5, "criteria_total": 5, "rubric_pass": true, "rubric_scores": [], "blocking_dimensions": [] },
    "product": { "status": "ship|iterate|cut", "nova_notes": "..." }
  },
  "timestamp": "<actual ISO 8601>"
}
```
