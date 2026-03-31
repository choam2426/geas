# 파이프라인 참조

Geas 계약 엔진의 모든 모드에 대한 정확한 단계별 실행 흐름입니다.

---

## 목차

1. [Initiative 파이프라인](#initiative-파이프라인)
   - [Phase 1: Genesis](#phase-1-genesis)
   - [Phase 2: MVP Build](#phase-2-mvp-build)
   - [Phase 3: Polish](#phase-3-polish)
   - [Phase 4: Evolution](#phase-4-evolution)
2. [Sprint 파이프라인](#sprint-파이프라인)
3. [Debate 파이프라인](#debate-파이프라인)
4. [체크포인트 및 복구](#체크포인트-및-복구)
5. [건너뛰기 조건](#건너뛰기-조건)
6. [에스컬레이션 경로](#에스컬레이션-경로)
7. [이벤트 로깅](#이벤트-로깅)

---

## Initiative 파이프라인

`/geas:initiative`를 통해 호출됩니다. 네 개의 순차적 단계를 실행합니다: Genesis, MVP Build, Polish, Evolution. 계약 엔진이 모든 단계를 관장합니다 — 어떤 에이전트도 증거 없이 완료를 자체 보고하지 않습니다.

---

### Phase 1: Genesis

코드 한 줄도 작성되기 전에 모든 계획 아티팩트를 생성합니다.

#### 1.1 Seed 확인

- `/geas:intake`가 작성한 `.geas/spec/seed.json`을 읽습니다.
- `completeness_checklist`에 `false` 값이 있고 override 플래그가 설정되지 않은 경우: 사용자에게 프롬프트하고 `/geas:intake`를 재실행합니다.
- 파일이 완전히 없는 경우: 계속하기 전에 `/geas:intake`를 호출합니다.

#### 1.2 비전 (Nova)

```
Agent(agent: "nova", ...)
출력: .geas/evidence/genesis/nova.json
```

Nova는 `seed.json`을 읽고 비전 진술, MVP 범위, 사용자 가치 제안을 전달합니다. 진행하기 전에 출력 파일이 존재하는지 확인합니다.

#### 1.3 PRD 및 사용자 스토리 (Nova)

```
Agent(agent: "nova", ...)
출력: .geas/spec/prd.md
       .geas/spec/stories.md
```

Nova는 `seed.json`과 `nova.json`을 읽고, `write-prd` 스킬을 사용하여 PRD를 생성한 다음 `write-stories` 스킬을 사용하여 사용자 스토리로 분해합니다. 진행하기 전에 두 파일이 모두 존재해야 합니다.

#### 1.4 아키텍처 (Forge)

```
Agent(agent: "forge", ...)
출력: .geas/memory/_project/conventions.md
      .geas/evidence/genesis/forge.json
```

Forge는 `seed.json`, `nova.json`, `prd.md`를 읽습니다. 아키텍처와 기술 스택을 제안합니다. 프로젝트 관례와 아키텍처 증거를 작성합니다. 검증 후 `.geas/decisions/dec-001.json`에 `DecisionRecord`를 작성합니다.

#### 1.5 Vote Round

세 에이전트가 Forge의 아키텍처에 대해 병렬로 투표합니다:

```
Agent(agent: "circuit", ...) → .geas/evidence/genesis/vote-circuit.json
Agent(agent: "palette", ...) → .geas/evidence/genesis/vote-palette.json
Agent(agent: "critic",  ...) → .geas/evidence/genesis/vote-critic.json
```

Critic은 모든 vote round에 반드시 참여해야 합니다 — Critic은 전반적으로 동의하더라도 악마의 변호인 역할을 하고 위험을 식별하도록 지시받습니다.

- 모두 동의 → 1.6으로 진행.
- 하나라도 동의하지 않으면 → `/geas:debate` 실행 후 재투표.

#### 1.6 TaskContract 컴파일

- `.geas/spec/stories.md`를 입력으로 사용합니다. 각 사용자 스토리에 대해 `/geas:task-compiler`를 호출합니다.
- 모든 TaskContract는 반드시 `rubric` 배열을 포함해야 합니다.

기본 rubric 차원:

| 차원 | 평가자 | 임계값 |
|---|---|---|
| `core_interaction` | sentinel | 3 |
| `feature_completeness` | sentinel | 4 |
| `code_quality` | forge | 4 |
| `regression_safety` | sentinel | 4 |

UI 컴포넌트가 있는 작업에 추가:

| 차원 | 평가자 | 임계값 |
|---|---|---|
| `ux_clarity` | sentinel | 3 |
| `visual_coherence` | sentinel | 3 |

컴파일된 각 계약을 기록합니다:
```json
{"event": "task_compiled", "task_id": "...", "timestamp": "<actual>"}
```

#### 1.7 MCP 서버 권장사항

Forge의 아키텍처 결정에서 기술 스택을 분석하고 카테고리별로 MCP 서버를 권장합니다:

| 스택 카테고리 | MCP 카테고리 | 이유 |
|---|---|---|
| 관계형 데이터베이스 | Database query MCP | Worker들이 스키마를 검사하고 읽기 전용 쿼리를 실행할 수 있음 |
| 문서 데이터베이스 | Database query MCP | Worker들이 컬렉션을 탐색할 수 있음 |
| 웹 프론트엔드 | Web standards MCP | Worker들이 명세 문서를 참조할 수 있음 |
| 배포 대상이 있음 | Performance audit MCP | Sentinel이 성능 및 접근성을 감사할 수 있음 |
| Git 호스팅 | Git platform MCP | Keeper가 PR과 이슈를 관리할 수 있음 |

MCP 레지스트리에서 설치 명령어와 함께 권장사항을 제시합니다. 사용자가 연결하면 `connected_mcp` 아래 `.geas/config.json`에 기록합니다.

#### 1.8 Genesis 종료

- 실행 상태 업데이트: `{ "phase": "mvp", "status": "in_progress" }`
- 기록: `{"event": "phase_complete", "phase": "genesis", "timestamp": "<actual>"}`

---

### Phase 2: MVP Build

`.geas/tasks/`의 모든 TaskContract가 의존성 순서대로 전체 파이프라인을 실행합니다. 코드 리뷰와 테스팅은 모든 작업에 필수입니다.

#### 2.0 작업 시작

1. TaskContract를 읽습니다. 선언된 모든 의존성이 `"passed"` 상태인지 확인합니다.
2. 작업 상태를 `"in_progress"`로 설정합니다.
3. `task_started` 이벤트를 기록합니다.
4. **`.geas/state/run.json`에 `remaining_steps` 작성** — 이 작업의 전체 단계 목록:

```json
"remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "code_review", "testing", "evidence_gate", "critic_review", "nova_review", "retrospective", "resolve"]
```

건너뛸 단계를 제거합니다 (예: 사용자 대면 인터페이스가 없는 작업은 `"design"` 제거). 각 단계가 완료된 후 배열의 앞에서 제거하고 `run.json`을 업데이트합니다.

5. **Rubric 확인**: TaskContract에 `rubric` 필드가 없으면 진행하기 전에 기본 rubric을 삽입합니다 (1.6의 차원 테이블 참조).

#### 2.1 디자인 (Palette) [기본값 — 섹션 5의 건너뛰기 조건]

작업에 사용자 대면 인터페이스(페이지, 양식, 대시보드)가 있을 때 실행됩니다.

```
run.json 업데이트: pipeline_step = "design", agent_in_flight = "palette"
Agent(agent: "palette", prompt: ".geas/packets/{task-id}/palette.md를 읽으세요. .geas/evidence/{task-id}/palette.json에 디자인 명세를 작성하세요")
```

`.geas/evidence/{task-id}/palette.json`이 존재하는지 확인합니다.

#### 2.2 Tech Guide (Forge) [기본값 — 섹션 5의 건너뛰기 조건]

```
run.json 업데이트: pipeline_step = "tech_guide", agent_in_flight = "forge"
Agent(agent: "forge", prompt: ".geas/packets/{task-id}/forge.md를 읽으세요. .geas/evidence/{task-id}/forge.json에 tech guide를 작성하세요")
```

`.geas/evidence/{task-id}/forge.json`이 존재하는지 확인합니다.

#### 2.3 Implementation Contract [필수]

`/geas:implementation-contract`를 호출합니다. worker가 구체적인 행동 계획을 제안하고 코드 작성 전에 Sentinel과 Forge 모두 승인해야 합니다.

```
run.json 업데이트: pipeline_step = "implementation_contract", agent_in_flight = "{worker}"
```

스킬은 내부적으로 세 단계를 실행합니다:
1. **Worker가 계약 초안 작성** — `planned_actions`, `edge_cases`, `state_transitions`, `non_goals`, `demo_steps`를 `status: "draft"`로 `.geas/contracts/{task-id}.json`에 작성.
2. **Sentinel 검토** — `demo_steps`가 모든 인수 기준을 커버하는지 확인하고 누락된 엣지 케이스를 표시.
3. **Forge 검토** — `planned_actions`가 tech guide와 일치하고 기술적으로 실행 가능한지 확인.

해결:
- 둘 다 승인 → 계약 상태를 `"approved"`로 설정하고 `approved_by`를 설정. 2.4로 진행.
- 수정 요청 → worker가 업데이트하고 재제출. 한 번의 수정 주기 허용, 그 후 Forge가 최종 결정.

계속하기 전에 `.geas/contracts/{task-id}.json`이 `status: "approved"`로 존재하는지 확인합니다.

이벤트 기록:
```json
{"event": "implementation_contract", "task_id": "...", "status": "approved|revision_requested", "timestamp": "..."}
```

#### 2.4 구현 [필수 — worktree 격리]

```
run.json 업데이트: pipeline_step = "implementation", agent_in_flight = "{worker}"
Agent(agent: "{worker}", isolation: "worktree", prompt: ".geas/packets/{task-id}/{worker}.md를 읽으세요. 기능을 구현하세요. .geas/evidence/{task-id}/{worker}.json에 증거를 작성하세요")
```

증거가 존재하는지 확인합니다. 진행하기 전에 worktree 브랜치를 병합합니다.

#### 2.5 코드 리뷰 (Forge) [필수]

```
run.json 업데이트: pipeline_step = "code_review", agent_in_flight = "forge"
Agent(agent: "forge", prompt: ".geas/packets/{task-id}/forge-review.md를 읽으세요. 구현을 리뷰하세요. .geas/evidence/{task-id}/forge-review.json에 작성하세요")
```

`.geas/evidence/{task-id}/forge-review.json`이 존재하는지 확인합니다.

#### 2.6 테스팅 (Sentinel) [필수]

```
run.json 업데이트: pipeline_step = "testing", agent_in_flight = "sentinel"
Agent(agent: "sentinel", prompt: ".geas/packets/{task-id}/sentinel.md를 읽으세요. 기능을 테스트하세요. .geas/evidence/{task-id}/sentinel.json에 QA 결과를 작성하세요")
```

`.geas/evidence/{task-id}/sentinel.json`이 존재하는지 확인합니다.

#### 2.7 Evidence Gate

`/geas:evidence-gate` 스킬을 실행합니다. 전체 3계층 프로토콜은 [Evidence Gate](#evidence-gate)를 참조하세요.

- TaskContract에서 `eval_commands`를 실행합니다.
- 수집된 증거에 대해 모든 인수 기준을 확인합니다.
- rubric 차원을 채점합니다.
- 계층 세부 내용과 함께 상세 결과를 기록합니다.

Gate 실패 → `/geas:verify-fix-loop`를 호출합니다. worker 에이전트를 spawn하여 수정합니다. 수정 후 gate를 재실행합니다.

#### 2.8 Critic 출시 전 리뷰 [필수]

```
run.json 업데이트: pipeline_step = "critic_review", agent_in_flight = "critic"
Agent(agent: "critic", prompt: ".geas/evidence/{task-id}/의 모든 증거를 읽으세요. 도전: 이것이 정말 출시 준비가 되었나요? 위험, 누락된 엣지 케이스, 또는 기술 부채를 식별하세요. .geas/evidence/{task-id}/critic-review.json에 작성하세요")
```

`.geas/evidence/{task-id}/critic-review.json`이 존재하는지 확인합니다.

#### 2.9 Nova 제품 리뷰 [필수]

```
run.json 업데이트: pipeline_step = "nova_review", agent_in_flight = "nova"
Agent(agent: "nova", prompt: "critic-review.json을 포함한 .geas/evidence/{task-id}/의 모든 증거를 읽으세요. 판단: Ship, Iterate, 또는 Cut. .geas/evidence/{task-id}/nova-verdict.json에 작성하세요")
```

#### 2.10 Ship Gate

어떤 작업을 `"passed"`로 표시하기 전에, 각각을 읽어 네 개의 필수 증거 파일이 모두 존재하는지 확인합니다:

| 파일 | 소스 단계 |
|---|---|
| `.geas/evidence/{task-id}/forge-review.json` | 2.5 코드 리뷰 |
| `.geas/evidence/{task-id}/sentinel.json` | 2.6 테스팅 |
| `.geas/evidence/{task-id}/critic-review.json` | 2.8 Critic 출시 전 리뷰 |
| `.geas/evidence/{task-id}/nova-verdict.json` | 2.9 Nova 제품 리뷰 |

파일이 없는 경우: 돌아가서 누락된 단계를 실행합니다. 네 개 없이는 진행하지 마세요.

#### 회고 (Scrum) [필수]

```
run.json 업데이트: pipeline_step = "retrospective", agent_in_flight = "scrum"
Agent(agent: "scrum", prompt: ".geas/evidence/{task-id}/의 모든 증거를 읽으세요. 회고 실행: 새 관례로 rules.md 업데이트, .geas/memory/retro/{task-id}.json에 교훈 작성")
```

`.geas/memory/retro/{task-id}.json`이 존재하는지 확인합니다.

#### 2.11 해결

2.9 단계에서 Nova의 판단에 따라:

| 판단 | 행동 |
|---|---|
| **Ship** | `.geas/tasks/{task-id}.json`을 읽고 `"status": "passed"`로 설정하고 다시 씁니다. 커밋을 위해 Keeper를 spawn합니다 (아래 참조). |
| **Iterate** | Nova의 피드백을 추가 컨텍스트로 worker를 재파견합니다. |
| **Cut** | 작업 상태를 `"failed"`로 설정합니다. `.geas/decisions/{dec-id}.json`에 DecisionRecord를 작성합니다. |

Keeper 커밋 (Ship만):
```
run.json 업데이트: pipeline_step = "resolve", agent_in_flight = "keeper"
Agent(agent: "keeper", prompt: "conventional commit 형식으로 {task-id}의 모든 변경사항을 커밋하세요. .geas/evidence/{task-id}/keeper.json에 작성하세요")
```

기록: `{"event": "task_resolved", "task_id": "...", "verdict": "ship|iterate|cut", "timestamp": "<actual>"}`

#### Phase 2 종료

모든 TaskContract가 해결된 후:

```json
{"event": "phase_complete", "phase": "mvp", "timestamp": "<actual>"}
```

---

### Phase 3: Polish

필수 — 건너뛰지 마세요.

```
Agent(agent: "shield", prompt: "프로젝트의 보안 리뷰를 수행하세요. .geas/evidence/polish/shield.json에 작성하세요")
```

`.geas/evidence/polish/shield.json`이 존재하는지 확인합니다.

```
Agent(agent: "scroll", prompt: "README와 문서를 작성하세요. .geas/evidence/polish/scroll.json에 작성하세요")
```

`.geas/evidence/polish/scroll.json`이 존재하는지 확인합니다.

Shield나 Scroll이 발견한 이슈를 수정합니다. 단계 완료를 기록합니다:

```json
{"event": "phase_complete", "phase": "polish", "timestamp": "<actual>"}
```

---

### Phase 4: Evolution

필수 — 건너뛰지 마세요.

seed의 `scope_in` 내에서 남은 작업을 평가합니다. `scope_out`에 나열된 기능은 거부합니다. 범위 내 개선을 위해 필요에 따라 에이전트를 spawn합니다.

**Nova 최종 브리핑 (필수):**
```
Agent(agent: "nova", prompt: "최종 제품 리뷰. 모든 증거를 읽으세요. 전략적 요약과 권장사항을 전달하세요. .geas/evidence/evolution/nova-final.json에 작성하세요")
```

**Keeper 릴리스 관리:**
```
Agent(agent: "keeper", prompt: "릴리스 생성: 버전 업, 변경 로그, 최종 커밋. .geas/evidence/evolution/keeper-release.json에 작성하세요")
```

세션 감사 추적을 생성하기 위해 `/geas:run-summary`를 호출합니다.

종료:
```json
{"event": "phase_complete", "phase": "complete", "timestamp": "<actual>"}
```

---

## Sprint 파이프라인

`/geas:sprint`를 통해 호출됩니다. 기존 프로젝트에 제한된 기능을 추가합니다. Genesis를 건너뜁니다. 하나의 기능, 하나의 파이프라인.

### 사전 조건

**seed.json 동작:**

| 상황 | 행동 |
|---|---|
| `.geas/spec/seed.json` 존재 | 읽기 전용. 미션과 제약을 로드합니다. Sprint는 절대 수정하지 않습니다. |
| `.geas/spec/seed.json` 미존재 | Intake가 최소한의 것을 생성합니다. |

**관례 감지:**

| 상황 | 행동 |
|---|---|
| `.geas/memory/_project/conventions.md` 존재 | 온보딩 건너뜁니다. 관례를 읽고 진행합니다. |
| `.geas/memory/_project/conventions.md` 없음 | 온보딩을 위해 Forge를 spawn합니다 (아래 [온보딩](#온보딩) 참조). |

### 온보딩 (첫 번째 Sprint만)

Compass가 `.geas/state/run.json`이 없음을 감지할 때 트리거됩니다. Forge가 단독으로 실행됩니다 — 병렬 에이전트 없음.

단계:

1. **구조 스캔** — 마커 파일에서 스택 감지 (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`). 프레임워크, 빌드 시스템, 테스트 프레임워크, 패키지 관리자 식별.
2. **아키텍처 매핑** — 진입점, 라우팅 패턴, 데이터베이스 연결, 주요 모듈, 외부 서비스 찾기.
3. **관례 감지** — linter 설정, 네이밍 패턴, import 스타일, 타입 검사 설정 읽기.
4. **적응적 깊이** — 프로젝트 크기에 따라 스캔 깊이 조정:

| 크기 | 파일 수 | 스캔 전략 |
|---|---|---|
| 소규모 | ~50개 파일 | 전체 스캔 — 모든 소스 파일 읽기 |
| 중규모 | 50-500개 파일 | 집중 스캔 — `src/` + 설정 + 진입점 + 주요 모듈 |
| 대규모 | 500개+ 파일 | 타겟 스캔 — Sprint 기능과 관련된 디렉토리만 |

5. **출력** — `.geas/memory/_project/conventions.md`와 `.geas/memory/_project/state.json` 작성.

두 번째 Sprint부터는 conventions.md가 이미 존재합니다 — 온보딩을 완전히 건너뜁니다.

### Sprint 단계

#### 단계 1: TaskContract 컴파일

기능을 위해 `/geas:task-compiler`를 호출합니다. TaskContract는 반드시 `rubric` 배열을 포함해야 합니다 (Initiative 1.6과 동일한 차원).

체크포인트에 `remaining_steps` 작성:
```json
"remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "code_review", "testing", "evidence_gate", "critic_review", "nova_review", "retrospective", "resolve"]
```

작성 전에 건너뛸 단계를 제거합니다. 각 단계가 완료된 후 앞에서 제거하고 `run.json`을 업데이트합니다.

Rubric 확인: TaskContract에서 `rubric`가 없으면 기본값을 삽입합니다.

#### 단계 2: 디자인 (Palette) [기본값 — 섹션 5의 건너뛰기 조건]

```
run.json 업데이트: pipeline_step = "design", agent_in_flight = "palette"
Agent(agent: "palette", ...) → .geas/evidence/{task-id}/palette.json
```

#### 단계 3: Tech Guide (Forge) [기본값 — 섹션 5의 건너뛰기 조건]

```
run.json 업데이트: pipeline_step = "tech_guide", agent_in_flight = "forge"
Agent(agent: "forge", ...) → .geas/evidence/{task-id}/forge.json
```

#### 단계 4: Implementation Contract [필수]

`/geas:implementation-contract`를 호출합니다. Initiative 2.3과 동일한 3단계 프로세스. `status: "approved"`로 `.geas/contracts/{task-id}.json`을 확인합니다.

#### 단계 5: 구현 [필수 — worktree 격리]

```
run.json 업데이트: pipeline_step = "implementation", agent_in_flight = "{worker}"
Agent(agent: "{worker}", isolation: "worktree", ...) → .geas/evidence/{task-id}/{worker}.json
```

증거를 확인합니다. worktree를 병합합니다.

#### 단계 6: 코드 리뷰 (Forge) [필수]

```
run.json 업데이트: pipeline_step = "code_review", agent_in_flight = "forge"
Agent(agent: "forge", ...) → .geas/evidence/{task-id}/forge-review.json
```

#### 단계 7: 테스팅 (Sentinel) [필수]

```
run.json 업데이트: pipeline_step = "testing", agent_in_flight = "sentinel"
Agent(agent: "sentinel", ...) → .geas/evidence/{task-id}/sentinel.json
```

#### 단계 8: Evidence Gate

`eval_commands`를 실행하고, 인수 기준을 확인하고, rubric을 채점합니다. 실패 → `/geas:verify-fix-loop`를 호출합니다. worker 에이전트를 spawn하여 수정합니다. 수정 후 gate를 재실행합니다.

#### 단계 8.5: Critic 출시 전 리뷰 [필수]

```
run.json 업데이트: pipeline_step = "critic_review", agent_in_flight = "critic"
Agent(agent: "critic", ...) → .geas/evidence/{task-id}/critic-review.json
```

파일이 존재하는지 확인합니다.

#### 단계 9: Nova 제품 리뷰 [필수]

```
run.json 업데이트: pipeline_step = "nova_review", agent_in_flight = "nova"
Agent(agent: "nova", ...) → .geas/evidence/{task-id}/nova-verdict.json
```

판단: Ship / Iterate / Cut.

#### Ship Gate

Initiative 2.10과 동일한 4개 파일 검증. 파일이 없는 경우: 먼저 누락된 단계를 실행합니다.

#### 회고 (Scrum) [필수]

```
run.json 업데이트: pipeline_step = "retrospective", agent_in_flight = "scrum"
Agent(agent: "scrum", ...) → .geas/memory/retro/{task-id}.json
```

#### 단계 10: 해결

| 판단 | 행동 |
|---|---|
| Ship | 작업 `"status": "passed"` 설정. 커밋을 위해 Keeper spawn. |
| Iterate | Nova의 피드백으로 worker 재파견. |
| Cut | `"status": "failed"` 설정. DecisionRecord 작성. |

#### 단계 11: 실행 요약

세션 감사 추적을 생성하기 위해 `/geas:run-summary`를 호출합니다.

---

## Debate 파이프라인

`/geas:debate`를 통해 호출됩니다. 코드는 생성되지 않습니다. 출력은 `DecisionRecord`입니다.

### 단계 1: 질문 구성

사용자의 질문을 2-3개의 구체적인 옵션이 있는 명확한 결정으로 공식화합니다. 에이전트를 spawn하기 전에 사용자와 구성을 확인합니다.

### 단계 2: 토론자 spawn

네 에이전트 모두 병렬로 실행합니다:

```
Agent(agent: "forge",   prompt: "옵션 A에 찬성 논거. 기술적 근거, 장단점, 위험.")
Agent(agent: "critic",  prompt: "옵션 A에 반대 / 옵션 B에 찬성 논거. 가정에 도전.")
Agent(agent: "circuit", prompt: "백엔드/확장성 관점에서 둘 다 평가.")
Agent(agent: "palette", prompt: "UX/프론트엔드 관점에서 둘 다 평가.")
```

### 단계 3: 종합

사용자에게 요약 제시: 각 에이전트의 논거, 트레이드오프, 각 에이전트의 권장사항.

### 단계 4: 결정

사용자에게 최종 결정을 요청합니다. `.geas/decisions/{dec-id}.json`에 `DecisionRecord`를 작성합니다.

---

## Evidence Gate

각 구현 단계 후 (그리고 단계 2.7 / 단계 8에서 명시적으로) `/geas:evidence-gate`를 통해 호출됩니다.

### 입력

1. `EvidenceBundle` — `.geas/evidence/{task-id}/{worker-name}.json`
2. `TaskContract` — `.geas/tasks/{task-id}.json`
3. Gate 수준 — 실행할 계층

### 계층 선택

| 상황 | 실행할 계층 |
|---|---|
| 구현 작업 (코드 변경) | Tier 1 + Tier 2 |
| 디자인 명세 (코드 없음) | Tier 2만 |
| 기능 완료 (릴리스 준비) | Tier 1 + Tier 2 + Tier 3 |
| 코드 리뷰 (Forge 리뷰) | Tier 2만 |
| QA 테스팅 (Sentinel) | Tier 1 + Tier 2 |
| 보안 리뷰 (Shield) | Tier 2만 |
| 단계 완료 | Tier 1 + Tier 2 + Tier 3 |

### Tier 1: 기계적 Gate

1. TaskContract에서 `eval_commands`를 읽습니다.
2. 각 명령어를 실행합니다. 기록: `pass` (exit 0), `fail` (비정상 종료, 출력 캡처), `skip` (해당 없음).
3. 첫 번째 실패에서 중지 — 빌드가 실패하면 의미론적 검사를 실행할 의미가 없습니다.
4. 명령어가 없으면 `"skip"`으로 기록합니다. 명령어가 있지만 실행하지 않는 것은 gate 위반입니다.

EvidenceBundle에 `verify_results`가 포함된 경우 새 실행과 비교합니다. 새 실행을 신뢰합니다.

### Tier 2: 의미론적 Gate

**Part A — 인수 기준:**
`acceptance_criteria`의 각 기준에 대해:
1. worker 증거를 읽습니다 (summary, files_changed, criteria_results).
2. worker가 `criteria_results`를 제공한 경우 자기 평가를 검증합니다; 그렇지 않으면 증거에서 추론합니다.
3. `{ "criterion": "...", "met": true/false, "evidence": "..." }`를 기록합니다.

rubric을 채점하기 전에 모든 기준이 충족되어야 합니다.

**Part B — Rubric 채점:**
1. TaskContract에서 `rubric` 배열을 읽습니다.
2. 평가자 증거를 읽습니다: Forge의 증거 → `code_quality` 점수; Sentinel의 증거 → 다른 모든 차원.
3. 각 `rubric_scores` 항목을 해당 `threshold`와 비교합니다.

임계값 조정 규칙:
- worker의 `self_check.confidence` ≤ 2인 경우: 모든 임계값에 +1 추가 (더 엄격한 검토).
- worker의 `self_check.possible_stubs`가 비어 있지 않은 경우: 스텁이 해결되었는지 확인. 확인된 스텁 → `feature_completeness`가 2로 상한 설정.

모든 rubric 차원이 임계값을 충족해야 Tier 2를 통과합니다. `blocking_dimensions`는 정확히 어떤 차원이 실패했는지 나열합니다.

### Tier 3: 제품 Gate

Nova를 spawn합니다: 작업 목표, 모든 증거 번들, Tier 2 기준 결과, seed의 미션 컨텍스트.

Nova의 판단: **Ship** / **Iterate** / **Cut**.

Tier 3는 기능 완료, 단계 완료, 또는 pivot 결정에 대해서만 실행합니다.

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

### Verify-Fix Loop (gate 실패)

gate가 실패할 때 `/geas:verify-fix-loop`를 통해 호출됩니다.

**진입점:**
1. `retry_budget` (기본값: 3)과 `escalation_policy`를 위해 TaskContract를 읽습니다.
2. `.geas/evidence/{task-id}/sentinel.json`에서 실패한 EvidenceBundle을 읽습니다.
3. gate 판단을 읽습니다 — 어떤 계층이 실패했고 왜인지.

**반복당:**

| 하위 단계 | 행동 |
|---|---|
| A: 수정자 식별 | 프론트엔드 버그 → Pixel. 백엔드 버그 → Circuit. 둘 다 → 명확한 소유권으로 둘 다 spawn. |
| B: 수정자 spawn | `isolation: "worktree"`. ContextPacket에는 실패, 미충족 기준, `blocking_dimensions`, files_changed 포함. |
| C: gate 재실행 | `/evidence-gate` 호출. Tier 1 + Tier 2 실행. |
| D: 평가 | 통과 → 루프 종료, Nova(Tier 3)로 진행. 실패 → 다음 반복 또는 에스컬레이션. |

gate 재실행 전에 수정자 완료 후 worktree 브랜치를 병합합니다.

**예산 소진 후** — `escalation_policy`를 따릅니다 ([에스컬레이션 경로](#에스컬레이션-경로) 참조).

---

## 체크포인트 및 복구

### remaining_steps 배열 동작

`.geas/state/run.json`의 `remaining_steps`는 현재 작업에 남은 것의 권위 있는 기록입니다.

- 전체 단계 목록으로 작업 시작 시 작성됩니다 (2.0 / Sprint 단계 1).
- 건너뛸 단계는 작성 전에 배열에서 제거됩니다.
- 각 단계가 성공적으로 완료된 후: 배열의 **앞**에서 제거하고 업데이트된 배열을 `run.json`에 다시 씁니다.
- 세션이 단계 중간에 중단된 경우, `remaining_steps[0]`의 단계가 재개할 단계입니다.

### run.json 체크포인트 필드

각 단계는 에이전트를 spawn하기 전에 `.geas/state/run.json`의 다음 필드를 업데이트합니다:

```json
{
  "current_task_id": "{task-id}",
  "pipeline_step": "{step_name}",
  "agent_in_flight": "{agent_name}",
  "remaining_steps": [...]
}
```

### 세션 재개 프로토콜

Compass가 시작하고 `status: "in_progress"`로 기존 `run.json`을 감지할 때:

1. `current_task_id`, `pipeline_step`, `remaining_steps`를 찾기 위해 `run.json`을 읽습니다.
2. 중단된 단계의 증거가 이미 존재하는지 확인합니다.
   - 증거 존재 → 단계가 세션이 종료되기 전에 완료되었습니다. `remaining_steps`에서 단계를 제거하고 다음 단계에서 계속합니다.
   - 증거 없음 → 처음부터 단계를 재실행합니다.
3. 하위 단계를 재개하기 전에 이전 단계의 필수 증거 파일이 존재하는지 확인합니다 (완료에 가까운 작업에 Ship Gate 검사 적용).

`restore-context` hook은 세션 시작 시 `run.json`을 로드하고 진행하기 전에 재개 지점을 사용자에게 알립니다.

---

## 건너뛰기 조건

### 디자인 (Palette) — 단계 2.1 / Sprint 단계 2

| 조건 | 디자인 실행? |
|---|---|
| 작업에 페이지, 양식, 또는 대시보드가 있음 | 예 — 항상 실행 |
| 작업이 백엔드 전용 (API, CI, Docker, DB 마이그레이션) | 아니오 — 건너뜀 |
| 작업이 순수 라이브러리 또는 유틸리티 모듈 | 아니오 — 건너뜀 |

디자인은 기본적으로 실행됩니다. 작업에 사용자 대면 인터페이스가 **없을 때만** 건너뜁니다.

### Tech Guide (Forge) — 단계 2.2 / Sprint 단계 3

다음이 **모두** 동시에 true일 때만 Tech Guide를 건너뜁니다:

| 조건 | 건너뛰기 위해 true여야 함 |
|---|---|
| 작업이 `conventions.md`의 기존 패턴을 따름 | 예 |
| 새 외부 라이브러리나 서비스 필요 없음 | 예 |
| 단일 모듈 범위 (경계를 넘는 변경 없음) | 예 |
| 데이터 모델이나 스키마 변경 없음 | 예 |

다음 중 **하나라도** true이면 Tech Guide를 실행합니다:

| 트리거 | Tech Guide spawn? |
|---|---|
| 새 외부 라이브러리 또는 서비스 통합 | 예 |
| 아키텍처 패턴 변경 | 예 |
| 모듈 간 의존성 | 예 |
| 새 데이터 모델 또는 스키마 변경 | 예 |

---

## 에스컬레이션 경로

에스컬레이션은 verify-fix-loop가 재시도 예산을 소진할 때 트리거됩니다 (TaskContract의 `retry_budget`, 기본값: 3).

| `escalation_policy` 값 | 담당자 | 발생하는 일 |
|---|---|---|
| `"forge-review"` (기본값) | Forge | 아키텍처 리뷰. Forge가 수정 가능한 근본 원인을 찾으면 → 수정 적용, 테스트 한 번 더. 접근 방식이 깨진 경우 → Nova에게 에스컬레이션. |
| `"nova-decision"` | Nova | 전략적 결정: 범위 축소, 기능 삭제, 대안 접근 방식, 또는 강행. |
| `"pivot"` | Compass | 전체 컨텍스트로 `/pivot-protocol` 호출. |

모든 에스컬레이션 경로에 대해:
1. TaskContract 상태를 `"escalated"`로 업데이트합니다.
2. `.geas/decisions/{dec-id}.json`에 `DecisionRecord`를 작성합니다.
3. `.geas/ledger/events.jsonl`에 에스컬레이션 이벤트를 기록합니다.

`forge-review` → Nova 경로:

```
Gate N번 실패
  → Forge 검토 (forge-escalation.json)
      → 수정 가능? → 수정 한 번 더 + 재-gate
      → 깨짐? → Nova 결정
          → 범위 축소 / 기능 삭제 / 대안 / 강행
  → DecisionRecord 작성
  → status: "escalated"
```

---

## 이벤트 로깅

모든 이벤트는 `.geas/ledger/events.jsonl`에 추가됩니다 (개행 구분 JSON). 타임스탬프는 `date -u`에서 가져온 실제 ISO 8601 값이어야 하며 절대 플레이스홀더 문자열이 되어서는 안 됩니다.

### 표준 step_complete 이벤트

각 단계가 완료되고 `remaining_steps`에서 제거된 후 기록됩니다.

```json
{"event": "step_complete", "task_id": "{task-id}", "step": "{step_name}", "agent": "{agent_name}", "timestamp": "<actual>"}
```

`step_complete`를 사용하는 단계: `design`, `tech_guide`, `implementation`, `code_review`, `testing`, `critic_review`, `nova_review`, `retrospective`.

### 자체 형식이 있는 이벤트 (step_complete 중복 없음)

| 단계 | 이벤트 이름 | 기록 시점 |
|---|---|---|
| Implementation Contract | `implementation_contract` | 승인 또는 수정 요청 후 |
| Evidence Gate | `gate_result` | gate 완료 후 (통과 또는 실패) |
| Resolve | `task_resolved` | Ship/Iterate/Cut 결정 후 |

### 단계 및 생명주기 이벤트

| 이벤트 | 기록 시점 |
|---|---|
| `task_compiled` | 각 TaskContract 컴파일 후 (Genesis 1.6) |
| `task_started` | 각 작업 시작 시 (단계 2.0) |
| `phase_complete` | 각 단계 종료 시 (Genesis, MVP, Polish, Evolution) |
| 에스컬레이션 이벤트 | 재시도 예산이 소진되고 escalation_policy가 호출될 때 |

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
