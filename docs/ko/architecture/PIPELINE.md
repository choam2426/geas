# 파이프라인 참조

Geas Contract Engine의 모든 모드별 실행 흐름을 단계별로 정리합니다.

---

## 목차

1. [Initiative 파이프라인](#initiative-파이프라인)
   - [Phase 1: Genesis](#phase-1-genesis)
   - [Phase 2: MVP Build](#phase-2-mvp-build)
   - [Phase 3: Polish](#phase-3-polish)
   - [Phase 4: Evolution](#phase-4-evolution)
2. [Sprint 파이프라인](#sprint-파이프라인)
3. [Debate 파이프라인](#debate-파이프라인)
4. [체크포인트와 복구](#체크포인트와-복구)
5. [스킵 조건](#스킵-조건)
6. [에스컬레이션 경로](#에스컬레이션-경로)
7. [이벤트 로깅](#이벤트-로깅)

---

## Initiative 파이프라인

`/geas:initiative`로 시작합니다. Genesis, MVP Build, Polish, Evolution 네 단계를 순서대로 실행합니다. Contract Engine이 모든 단계를 관장합니다. 에이전트가 증거 없이 스스로 완료를 보고하는 일은 없습니다.

---

### Phase 1: Genesis

코드를 한 줄도 쓰기 전에 모든 기획 산출물을 만듭니다.

#### 1.1 Seed 확인

- `/geas:intake`가 작성한 `.geas/spec/seed.json`을 읽습니다.
- `completeness_checklist`에 `false` 값이 있고 override 플래그가 없으면: 사용자에게 안내하고 `/geas:intake`를 다시 돌립니다.
- 파일이 아예 없으면: 계속하기 전에 `/geas:intake`를 호출합니다.

#### 1.2 비전 (Nova)

```
Agent(agent: "nova", ...)
출력: .geas/evidence/genesis/nova.json
```

Nova가 `seed.json`을 읽고 비전 선언, MVP 범위, 사용자 가치 제안을 만듭니다. 출력 파일이 있는지 확인한 뒤 다음으로 넘어갑니다.

#### 1.3 PRD와 사용자 스토리 (Nova)

```
Agent(agent: "nova", ...)
출력: .geas/spec/prd.md
       .geas/spec/stories.md
```

Nova가 `seed.json`과 `nova.json`을 읽습니다. `write-prd` 스킬로 PRD를 만들고, `write-stories` 스킬로 사용자 스토리로 분해합니다. 두 파일이 다 있어야 다음으로 넘어갑니다.

#### 1.4 아키텍처 (Forge)

```
Agent(agent: "forge", ...)
출력: .geas/memory/_project/conventions.md
      .geas/evidence/genesis/forge.json
```

Forge가 `seed.json`, `nova.json`, `prd.md`를 읽습니다. 아키텍처와 기술 스택을 제안합니다. 프로젝트 규칙과 아키텍처 근거를 기록합니다. 검증 후 `.geas/decisions/dec-001.json`에 DecisionRecord를 씁니다.

#### 1.5 Vote Round

세 에이전트가 Forge의 아키텍처 제안에 병렬로 투표합니다.

```
Agent(agent: "circuit", ...) → .geas/evidence/genesis/vote-circuit.json
Agent(agent: "palette", ...) → .geas/evidence/genesis/vote-palette.json
Agent(agent: "critic",  ...) → .geas/evidence/genesis/vote-critic.json
```

Critic은 모든 vote round에 반드시 참여합니다. 전반적으로 동의하더라도 악마의 변호인 역할로 위험을 짚어야 합니다.

- 전원 동의 → 1.6으로 진행합니다.
- 하나라도 반대 → `/geas:debate` 실행 후 재투표합니다.

#### 1.6 TaskContract 컴파일

- `.geas/spec/stories.md`를 입력으로 씁니다. 각 사용자 스토리마다 `/geas:task-compiler`를 호출합니다.
- 모든 TaskContract에 `rubric` 배열이 필수입니다.

기본 rubric 차원:

| 차원 | 평가자 | threshold |
|---|---|---|
| `core_interaction` | sentinel | 3 |
| `feature_completeness` | sentinel | 4 |
| `code_quality` | forge | 4 |
| `regression_safety` | sentinel | 4 |

UI가 있는 태스크에 추가:

| 차원 | 평가자 | threshold |
|---|---|---|
| `ux_clarity` | sentinel | 3 |
| `visual_coherence` | sentinel | 3 |

컴파일된 계약마다 로그를 남깁니다.
```json
{"event": "task_compiled", "task_id": "...", "timestamp": "<actual>"}
```

#### 1.7 MCP 서버 권장

Forge의 아키텍처 결정에서 기술 스택을 분석하고 카테고리별 MCP 서버를 권장합니다.

| 스택 카테고리 | MCP 카테고리 | 이유 |
|---|---|---|
| 관계형 DB | Database query MCP | Worker가 스키마를 조회하고 읽기 전용 쿼리를 돌릴 수 있습니다 |
| 문서 DB | Database query MCP | Worker가 컬렉션을 탐색할 수 있습니다 |
| 웹 프론트엔드 | Web standards MCP | Worker가 명세 문서를 참조할 수 있습니다 |
| 배포 대상 있음 | Performance audit MCP | Sentinel이 성능과 접근성을 감사할 수 있습니다 |
| Git 호스팅 | Git platform MCP | Keeper가 PR과 이슈를 관리할 수 있습니다 |

MCP 레지스트리의 설치 명령어와 함께 권장합니다. 사용자가 연결하면 `.geas/config.json`의 `connected_mcp`에 기록합니다.

#### 1.8 Genesis 종료

- 실행 상태 업데이트: `{ "phase": "mvp", "status": "in_progress" }`
- 로그: `{"event": "phase_complete", "phase": "genesis", "timestamp": "<actual>"}`

---

### Phase 2: MVP Build

`.geas/tasks/`의 모든 TaskContract를 의존성 순서대로 실행합니다. 코드 리뷰와 테스팅은 모든 태스크에 필수입니다.

#### 2.0 태스크 시작

1. TaskContract를 읽습니다. 선언된 의존성이 전부 `"passed"` 상태인지 확인합니다.
2. 태스크 상태를 `"in_progress"`로 바꿉니다.
3. `task_started` 이벤트를 로그합니다.
4. **`.geas/state/run.json`에 `remaining_steps`를 씁니다.** 이 태스크의 전체 단계 목록입니다.

```json
"remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "code_review", "testing", "evidence_gate", "critic_review", "nova_review", "retrospective", "resolve"]
```

스킵할 단계는 미리 뺍니다(예: 사용자 대면 인터페이스가 없으면 `"design"` 제거). 각 단계가 끝나면 배열 맨 앞에서 빼고 `run.json`을 갱신합니다.

5. **Rubric 확인**: TaskContract에 `rubric` 필드가 없으면 기본 rubric을 넣고 진행합니다(1.6의 차원 표 참고).

#### 2.1 디자인 (Palette) [기본 -- 스킵 조건은 섹션 5]

태스크에 사용자 대면 인터페이스(페이지, 폼, 대시보드)가 있을 때 실행합니다.

```
run.json 갱신: pipeline_step = "design", agent_in_flight = "palette"
Agent(agent: "palette", prompt: ".geas/packets/{task-id}/palette.md를 읽고 .geas/evidence/{task-id}/palette.json에 디자인 스펙을 쓰세요")
```

`.geas/evidence/{task-id}/palette.json`이 있는지 확인합니다.

#### 2.2 Tech Guide (Forge) [기본 -- 스킵 조건은 섹션 5]

```
run.json 갱신: pipeline_step = "tech_guide", agent_in_flight = "forge"
Agent(agent: "forge", prompt: ".geas/packets/{task-id}/forge.md를 읽고 .geas/evidence/{task-id}/forge.json에 tech guide를 쓰세요")
```

`.geas/evidence/{task-id}/forge.json`이 있는지 확인합니다.

#### 2.3 Implementation Contract [필수]

`/geas:implementation-contract`를 호출합니다. worker가 구체적 행동 계획을 제안하고, Sentinel과 Forge가 둘 다 승인해야 코드를 쓸 수 있습니다.

```
run.json 갱신: pipeline_step = "implementation_contract", agent_in_flight = "{worker}"
```

스킬이 내부적으로 세 단계를 돌립니다.

1. **Worker가 초안 작성** -- `planned_actions`, `edge_cases`, `state_transitions`, `non_goals`, `demo_steps`를 `status: "draft"`로 `.geas/contracts/{task-id}.json`에 씁니다.
2. **Sentinel 검토** -- `demo_steps`가 모든 인수 기준을 커버하는지 확인합니다. 빠진 엣지 케이스를 표시합니다.
3. **Forge 검토** -- `planned_actions`가 tech guide와 맞는지, 기술적으로 가능한지 확인합니다.

결과 처리:
- 둘 다 승인 → 계약 상태를 `"approved"`로 바꾸고 `approved_by`를 설정합니다. 2.4로 넘어갑니다.
- 수정 요청 → worker가 고쳐서 다시 냅니다. 수정은 한 번만 허용하고, 그 뒤에는 Forge가 최종 결정합니다.

`.geas/contracts/{task-id}.json`이 `status: "approved"`로 있는지 확인한 뒤 진행합니다.

이벤트 로그:
```json
{"event": "implementation_contract", "task_id": "...", "status": "approved|revision_requested", "timestamp": "..."}
```

#### 2.4 구현 [필수 -- worktree 격리]

```
run.json 갱신: pipeline_step = "implementation", agent_in_flight = "{worker}"
Agent(agent: "{worker}", isolation: "worktree", prompt: ".geas/packets/{task-id}/{worker}.md를 읽고 기능을 구현하세요. .geas/evidence/{task-id}/{worker}.json에 근거를 쓰세요")
```

근거 파일이 있는지 확인합니다. 다음 단계 전에 worktree 브랜치를 병합합니다.

#### 2.5 코드 리뷰 (Forge) [필수]

```
run.json 갱신: pipeline_step = "code_review", agent_in_flight = "forge"
Agent(agent: "forge", prompt: ".geas/packets/{task-id}/forge-review.md를 읽고 구현을 리뷰하세요. .geas/evidence/{task-id}/forge-review.json에 쓰세요")
```

`.geas/evidence/{task-id}/forge-review.json`이 있는지 확인합니다.

#### 2.6 테스팅 (Sentinel) [필수]

```
run.json 갱신: pipeline_step = "testing", agent_in_flight = "sentinel"
Agent(agent: "sentinel", prompt: ".geas/packets/{task-id}/sentinel.md를 읽고 기능을 테스트하세요. .geas/evidence/{task-id}/sentinel.json에 QA 결과를 쓰세요")
```

`.geas/evidence/{task-id}/sentinel.json`이 있는지 확인합니다.

#### 2.7 Evidence Gate

`/geas:evidence-gate` 스킬을 돌립니다. 3단계 프로토콜은 [Evidence Gate](#evidence-gate) 참고.

- TaskContract의 `eval_commands`를 실행합니다.
- 수집된 근거로 인수 기준을 확인합니다.
- rubric 차원을 채점합니다.
- tier별 상세 결과를 로그합니다.

Gate 실패 → `/geas:verify-fix-loop`를 호출합니다. worker 에이전트를 스폰해서 수정합니다. 수정 후 gate를 다시 돌립니다.

#### 2.8 Critic 출시 전 리뷰 [필수]

```
run.json 갱신: pipeline_step = "critic_review", agent_in_flight = "critic"
Agent(agent: "critic", prompt: ".geas/evidence/{task-id}/의 모든 근거를 읽으세요. 정말 출시 준비가 됐는지 따져보세요. 위험, 빠진 엣지 케이스, 기술 부채를 찾으세요. .geas/evidence/{task-id}/critic-review.json에 쓰세요")
```

`.geas/evidence/{task-id}/critic-review.json`이 있는지 확인합니다.

#### 2.9 Nova 제품 리뷰 [필수]

```
run.json 갱신: pipeline_step = "nova_review", agent_in_flight = "nova"
Agent(agent: "nova", prompt: "critic-review.json 포함 .geas/evidence/{task-id}/의 모든 근거를 읽으세요. 판정: Ship, Iterate, 또는 Cut. .geas/evidence/{task-id}/nova-verdict.json에 쓰세요")
```

#### 2.10 Ship Gate

태스크를 `"passed"`로 표시하기 전에 필수 근거 파일 4개가 전부 있는지 확인합니다.

| 파일 | 만드는 단계 |
|---|---|
| `.geas/evidence/{task-id}/forge-review.json` | 2.5 코드 리뷰 |
| `.geas/evidence/{task-id}/sentinel.json` | 2.6 테스팅 |
| `.geas/evidence/{task-id}/critic-review.json` | 2.8 Critic 출시 전 리뷰 |
| `.geas/evidence/{task-id}/nova-verdict.json` | 2.9 Nova 제품 리뷰 |

빠진 파일이 있으면 돌아가서 해당 단계를 실행합니다. 4개 전부 없으면 진행하지 않습니다.

#### 회고 (Scrum) [필수]

```
run.json 갱신: pipeline_step = "retrospective", agent_in_flight = "scrum"
Agent(agent: "scrum", prompt: ".geas/evidence/{task-id}/의 모든 근거를 읽으세요. 회고: rules.md에 새 규칙을 추가하고, .geas/memory/retro/{task-id}.json에 교훈을 쓰세요")
```

`.geas/memory/retro/{task-id}.json`이 있는지 확인합니다.

#### 2.11 해결

2.9의 Nova 판정에 따라 처리합니다.

| 판정 | 행동 |
|---|---|
| **Ship** | `.geas/tasks/{task-id}.json`을 읽고 `"status": "passed"`로 바꿔 씁니다. 커밋을 위해 Keeper를 스폰합니다(아래 참고). |
| **Iterate** | Nova의 피드백을 추가 컨텍스트로 worker를 다시 보냅니다. |
| **Cut** | 태스크 상태를 `"failed"`로 바꿉니다. `.geas/decisions/{dec-id}.json`에 DecisionRecord를 씁니다. |

Keeper 커밋 (Ship일 때만):
```
run.json 갱신: pipeline_step = "resolve", agent_in_flight = "keeper"
Agent(agent: "keeper", prompt: "conventional commit 형식으로 {task-id} 변경사항을 커밋하세요. .geas/evidence/{task-id}/keeper.json에 쓰세요")
```

로그: `{"event": "task_resolved", "task_id": "...", "verdict": "ship|iterate|cut", "timestamp": "<actual>"}`

#### Phase 2 종료

모든 TaskContract가 해결된 후:

```json
{"event": "phase_complete", "phase": "mvp", "timestamp": "<actual>"}
```

---

### Phase 3: Polish

필수입니다. 건너뛰지 마세요.

```
Agent(agent: "shield", prompt: "프로젝트 보안 리뷰. .geas/evidence/polish/shield.json에 쓰세요")
```

`.geas/evidence/polish/shield.json`이 있는지 확인합니다.

```
Agent(agent: "scroll", prompt: "README와 문서 작성. .geas/evidence/polish/scroll.json에 쓰세요")
```

`.geas/evidence/polish/scroll.json`이 있는지 확인합니다.

Shield나 Scroll이 찾은 이슈를 수정합니다. 단계 완료를 로그합니다.

```json
{"event": "phase_complete", "phase": "polish", "timestamp": "<actual>"}
```

---

### Phase 4: Evolution

필수입니다. 건너뛰지 마세요.

seed의 `scope_in` 안에서 남은 작업이 있는지 살핍니다. `scope_out`에 있는 기능은 거부합니다. 범위 안의 개선이 필요하면 에이전트를 스폰합니다.

**Nova 최종 브리핑 (필수):**
```
Agent(agent: "nova", prompt: "최종 제품 리뷰. 모든 근거를 읽으세요. 전략 요약과 권장 사항을 만드세요. .geas/evidence/evolution/nova-final.json에 쓰세요")
```

**Keeper 릴리스 관리:**
```
Agent(agent: "keeper", prompt: "릴리스: 버전 올리기, 변경 로그, 최종 커밋. .geas/evidence/evolution/keeper-release.json에 쓰세요")
```

세션 감사 추적을 만들기 위해 `/geas:run-summary`를 호출합니다.

종료:
```json
{"event": "phase_complete", "phase": "complete", "timestamp": "<actual>"}
```

---

## Sprint 파이프라인

`/geas:sprint`로 시작합니다. 기존 프로젝트에 기능 하나를 추가합니다. Genesis를 건너뜁니다. 기능 하나, 파이프라인 하나입니다.

### 사전 조건

**seed.json 동작:**

| 상황 | 행동 |
|---|---|
| `.geas/spec/seed.json`이 있음 | 읽기 전용입니다. 미션과 제약을 읽습니다. Sprint는 절대 수정하지 않습니다. |
| `.geas/spec/seed.json`이 없음 | Intake가 최소한의 seed를 만듭니다. |

**규칙 감지:**

| 상황 | 행동 |
|---|---|
| `.geas/memory/_project/conventions.md`가 있음 | 온보딩을 건너뜁니다. 규칙을 읽고 진행합니다. |
| `.geas/memory/_project/conventions.md`가 없음 | 온보딩을 위해 Forge를 스폰합니다(아래 [온보딩](#온보딩) 참고). |

### 온보딩 (첫 Sprint만)

Compass가 `.geas/state/run.json`이 없는 걸 감지하면 시작합니다. Forge만 단독으로 돌립니다. 병렬 에이전트는 없습니다.

단계:

1. **구조 스캔** -- 마커 파일(`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`)로 스택을 감지합니다. 프레임워크, 빌드 시스템, 테스트 프레임워크, 패키지 매니저를 식별합니다.
2. **아키텍처 매핑** -- 진입점, 라우팅 패턴, DB 연결, 핵심 모듈, 외부 서비스를 찾습니다.
3. **규칙 감지** -- linter 설정, 네이밍 패턴, import 스타일, 타입 체크 설정을 읽습니다.
4. **적응형 깊이** -- 프로젝트 크기에 따라 스캔 깊이를 조절합니다.

| 크기 | 파일 수 | 스캔 전략 |
|---|---|---|
| 소규모 | ~50개 | 전체 스캔 -- 모든 소스 파일을 읽습니다 |
| 중규모 | 50-500개 | 집중 스캔 -- `src/` + 설정 + 진입점 + 핵심 모듈 |
| 대규모 | 500개+ | 타겟 스캔 -- Sprint 기능과 관련된 디렉토리만 |

5. **출력** -- `.geas/memory/_project/conventions.md`와 `.geas/memory/_project/state.json`을 씁니다.

두 번째 Sprint부터는 conventions.md가 이미 있으므로 온보딩을 통째로 건너뜁니다.

### Sprint 단계

#### 단계 1: TaskContract 컴파일

기능 하나에 대해 `/geas:task-compiler`를 호출합니다. TaskContract에 `rubric` 배열이 필수입니다(Initiative 1.6과 같은 차원).

checkpoint에 `remaining_steps`를 씁니다.
```json
"remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "code_review", "testing", "evidence_gate", "critic_review", "nova_review", "retrospective", "resolve"]
```

쓰기 전에 스킵할 단계를 뺍니다. 각 단계 완료 후 앞에서 빼고 `run.json`을 갱신합니다.

Rubric 확인: TaskContract에 `rubric`이 없으면 기본값을 넣습니다.

#### 단계 2: 디자인 (Palette) [기본 -- 스킵 조건은 섹션 5]

```
run.json 갱신: pipeline_step = "design", agent_in_flight = "palette"
Agent(agent: "palette", ...) → .geas/evidence/{task-id}/palette.json
```

#### 단계 3: Tech Guide (Forge) [기본 -- 스킵 조건은 섹션 5]

```
run.json 갱신: pipeline_step = "tech_guide", agent_in_flight = "forge"
Agent(agent: "forge", ...) → .geas/evidence/{task-id}/forge.json
```

#### 단계 4: Implementation Contract [필수]

`/geas:implementation-contract`를 호출합니다. Initiative 2.3과 같은 3단계 프로세스입니다. `.geas/contracts/{task-id}.json`이 `status: "approved"`인지 확인합니다.

#### 단계 5: 구현 [필수 -- worktree 격리]

```
run.json 갱신: pipeline_step = "implementation", agent_in_flight = "{worker}"
Agent(agent: "{worker}", isolation: "worktree", ...) → .geas/evidence/{task-id}/{worker}.json
```

근거를 확인합니다. worktree를 병합합니다.

#### 단계 6: 코드 리뷰 (Forge) [필수]

```
run.json 갱신: pipeline_step = "code_review", agent_in_flight = "forge"
Agent(agent: "forge", ...) → .geas/evidence/{task-id}/forge-review.json
```

#### 단계 7: 테스팅 (Sentinel) [필수]

```
run.json 갱신: pipeline_step = "testing", agent_in_flight = "sentinel"
Agent(agent: "sentinel", ...) → .geas/evidence/{task-id}/sentinel.json
```

#### 단계 8: Evidence Gate

`eval_commands`를 돌리고, 인수 기준을 확인하고, rubric을 채점합니다. 실패 → `/geas:verify-fix-loop`를 호출합니다. worker 에이전트를 스폰해서 수정합니다. 수정 후 gate를 다시 돌립니다.

#### 단계 8.5: Critic 출시 전 리뷰 [필수]

```
run.json 갱신: pipeline_step = "critic_review", agent_in_flight = "critic"
Agent(agent: "critic", ...) → .geas/evidence/{task-id}/critic-review.json
```

파일이 있는지 확인합니다.

#### 단계 9: Nova 제품 리뷰 [필수]

```
run.json 갱신: pipeline_step = "nova_review", agent_in_flight = "nova"
Agent(agent: "nova", ...) → .geas/evidence/{task-id}/nova-verdict.json
```

판정: Ship / Iterate / Cut.

#### Ship Gate

Initiative 2.10과 같은 4개 파일 검증입니다. 빠진 파일이 있으면 해당 단계를 먼저 실행합니다.

#### 회고 (Scrum) [필수]

```
run.json 갱신: pipeline_step = "retrospective", agent_in_flight = "scrum"
Agent(agent: "scrum", ...) → .geas/memory/retro/{task-id}.json
```

#### 단계 10: 해결

| 판정 | 행동 |
|---|---|
| Ship | 태스크 `"status": "passed"` 설정. 커밋을 위해 Keeper 스폰. |
| Iterate | Nova의 피드백으로 worker 재배치. |
| Cut | `"status": "failed"` 설정. DecisionRecord 작성. |

#### 단계 11: 실행 요약

세션 감사 추적을 만들기 위해 `/geas:run-summary`를 호출합니다.

---

## Debate 파이프라인

`/geas:debate`로 시작합니다. 코드를 만들지 않습니다. 결과물은 DecisionRecord입니다.

### 단계 1: 질문 구성

사용자의 질문을 2-3개 구체적 옵션이 있는 명확한 결정으로 정리합니다. 에이전트를 스폰하기 전에 사용자에게 구성을 확인받습니다.

### 단계 2: 토론자 스폰

네 에이전트가 병렬로 돕니다.

```
Agent(agent: "forge",   prompt: "옵션 A 찬성. 기술 근거, 장단점, 위험.")
Agent(agent: "critic",  prompt: "옵션 A 반대 / 옵션 B 찬성. 가정에 도전.")
Agent(agent: "circuit", prompt: "백엔드/확장성 관점에서 둘 다 평가.")
Agent(agent: "palette", prompt: "UX/프론트엔드 관점에서 둘 다 평가.")
```

### 단계 3: 종합

사용자에게 요약을 보여줍니다. 각 에이전트의 논거, 트레이드오프, 각 에이전트의 권장 사항을 포함합니다.

### 단계 4: 결정

사용자에게 최종 결정을 받습니다. `.geas/decisions/{dec-id}.json`에 DecisionRecord를 씁니다.

---

## Evidence Gate

구현 단계 후마다(그리고 단계 2.7 / Sprint 단계 8에서 명시적으로) `/geas:evidence-gate`를 호출합니다.

### 입력

1. `EvidenceBundle` -- `.geas/evidence/{task-id}/{worker-name}.json`
2. `TaskContract` -- `.geas/tasks/{task-id}.json`
3. Gate 수준 -- 돌릴 tier

### tier 선택

| 상황 | 돌릴 tier |
|---|---|
| 구현 태스크 (코드 변경) | Tier 1 + Tier 2 |
| 디자인 스펙 (코드 없음) | Tier 2만 |
| 기능 완료 (릴리스 준비) | Tier 1 + Tier 2 + Tier 3 |
| 코드 리뷰 (Forge 리뷰) | Tier 2만 |
| QA 테스팅 (Sentinel) | Tier 1 + Tier 2 |
| 보안 리뷰 (Shield) | Tier 2만 |
| 단계 완료 | Tier 1 + Tier 2 + Tier 3 |

### Tier 1: 기계적 Gate

1. TaskContract에서 `eval_commands`를 읽습니다.
2. 각 명령어를 돌립니다. 결과 기록: `pass`(exit 0), `fail`(비정상 종료, 출력 캡처), `skip`(해당 없음).
3. 첫 실패에서 멈춥니다. 빌드가 깨졌으면 의미 검증을 돌릴 이유가 없습니다.
4. 명령어가 없으면 `"skip"`으로 기록합니다. 명령어가 있는데 안 돌리는 건 gate 위반입니다.

EvidenceBundle에 `verify_results`가 있으면 새로 돌린 결과와 비교합니다. 새 결과를 믿습니다.

### Tier 2: 의미 Gate

**Part A -- 인수 기준:**

`acceptance_criteria`의 각 기준마다:
1. worker 근거를 읽습니다(summary, files_changed, criteria_results).
2. worker가 `criteria_results`를 냈으면 자기 평가를 검증합니다. 없으면 근거에서 추론합니다.
3. `{ "criterion": "...", "met": true/false, "evidence": "..." }`를 기록합니다.

rubric 채점 전에 모든 기준이 충족돼야 합니다.

**Part B -- Rubric 채점:**

1. TaskContract에서 `rubric` 배열을 읽습니다.
2. 평가자 근거를 읽습니다. Forge 근거 → `code_quality` 점수. Sentinel 근거 → 나머지 차원.
3. 각 `rubric_scores` 항목을 해당 `threshold`와 비교합니다.

threshold 조정 규칙:
- worker의 `self_check.confidence`가 2 이하이면: 모든 threshold에 +1을 더합니다(더 엄격한 검토).
- worker의 `self_check.possible_stubs`가 비어 있지 않으면: 스텁이 해결됐는지 확인합니다. 확인된 스텁이 있으면 `feature_completeness`를 2로 제한합니다.

모든 rubric 차원이 threshold를 넘어야 Tier 2를 통과합니다. `blocking_dimensions`에 실패한 차원이 나열됩니다.

### Tier 3: 제품 Gate

Nova를 스폰합니다. 태스크 목표, 전체 근거 번들, Tier 2 기준 결과, seed의 미션 컨텍스트를 줍니다.

Nova의 판정: **Ship** / **Iterate** / **Cut**.

Tier 3는 기능 완료, 단계 완료, pivot 결정에만 돌립니다.

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

`.geas/ledger/events.jsonl`에 로그:
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

gate가 실패하면 `/geas:verify-fix-loop`를 호출합니다.

**시작:**
1. TaskContract에서 `retry_budget`(기본값 3)과 `escalation_policy`를 읽습니다.
2. `.geas/evidence/{task-id}/sentinel.json`에서 실패한 EvidenceBundle을 읽습니다.
3. gate 결과를 읽습니다. 어떤 tier가 왜 실패했는지 확인합니다.

**반복마다:**

| 하위 단계 | 행동 |
|---|---|
| A: 수정자 결정 | 프론트엔드 버그 → Pixel. 백엔드 버그 → Circuit. 둘 다 → 소유권을 나눠서 둘 다 스폰. |
| B: 수정자 스폰 | `isolation: "worktree"`. ContextPacket에 실패 내용, 미충족 기준, `blocking_dimensions`, files_changed를 넣습니다. |
| C: gate 재실행 | `/evidence-gate` 호출. Tier 1 + Tier 2를 돌립니다. |
| D: 판단 | 통과 → 루프 종료, Nova(Tier 3)로 진행. 실패 → 다음 반복 또는 에스컬레이션. |

gate 재실행 전에 수정자가 끝나면 worktree 브랜치를 병합합니다.

**예산 소진 후** -- `escalation_policy`를 따릅니다([에스컬레이션 경로](#에스컬레이션-경로) 참고).

---

## 체크포인트와 복구

### remaining_steps 배열 동작

`.geas/state/run.json`의 `remaining_steps`는 현재 태스크에 남은 단계의 기준 기록입니다.

- 태스크 시작 시(2.0 / Sprint 단계 1) 전체 단계 목록으로 씁니다.
- 스킵할 단계는 쓰기 전에 뺍니다.
- 각 단계가 끝나면 배열 **맨 앞**에서 빼고 갱신된 배열을 `run.json`에 다시 씁니다.
- 단계 도중에 세션이 끊기면 `remaining_steps[0]`이 재개할 단계입니다.

### run.json checkpoint 필드

각 단계는 에이전트를 스폰하기 전에 `.geas/state/run.json`의 아래 필드를 갱신합니다.

```json
{
  "current_task_id": "{task-id}",
  "pipeline_step": "{step_name}",
  "agent_in_flight": "{agent_name}",
  "remaining_steps": [...]
}
```

### 세션 재개 프로토콜

Compass가 시작됐을 때 `status: "in_progress"`인 `run.json`이 있으면:

1. `run.json`에서 `current_task_id`, `pipeline_step`, `remaining_steps`를 읽습니다.
2. 끊긴 단계의 근거 파일이 이미 있는지 확인합니다.
   - 근거가 있으면 → 세션이 끊기기 전에 단계가 끝난 겁니다. `remaining_steps`에서 빼고 다음 단계부터 이어갑니다.
   - 근거가 없으면 → 처음부터 해당 단계를 다시 돌립니다.
3. 하위 단계를 재개하기 전에 이전 단계의 필수 근거 파일이 있는지 확인합니다(완료에 가까운 태스크는 Ship Gate 검사를 적용합니다).

`restore-context` 훅이 세션 시작 시 `run.json`을 읽어서 재개 지점을 사용자에게 알린 뒤 진행합니다.

---

## 스킵 조건

### 디자인 (Palette) -- 단계 2.1 / Sprint 단계 2

| 조건 | 디자인 실행? |
|---|---|
| 태스크에 페이지, 폼, 대시보드가 있음 | 예 -- 항상 실행 |
| 백엔드 전용 태스크 (API, CI, Docker, DB 마이그레이션) | 아니오 -- 스킵 |
| 순수 라이브러리나 유틸리티 모듈 | 아니오 -- 스킵 |

디자인은 기본적으로 실행합니다. 사용자 대면 인터페이스가 **아예 없을 때만** 스킵합니다.

### Tech Guide (Forge) -- 단계 2.2 / Sprint 단계 3

아래가 **전부** 동시에 true일 때만 스킵합니다.

| 조건 | 스킵하려면 true여야 함 |
|---|---|
| `conventions.md`의 기존 패턴을 따르는 태스크 | 예 |
| 새 외부 라이브러리나 서비스가 필요 없음 | 예 |
| 단일 모듈 범위 (경계를 넘는 변경 없음) | 예 |
| 데이터 모델이나 스키마 변경 없음 | 예 |

아래 중 **하나라도** true이면 Tech Guide를 돌립니다.

| 트리거 | Tech Guide 스폰? |
|---|---|
| 새 외부 라이브러리 또는 서비스 연동 | 예 |
| 아키텍처 패턴 변경 | 예 |
| 모듈 간 의존성 | 예 |
| 새 데이터 모델 또는 스키마 변경 | 예 |

---

## 에스컬레이션 경로

verify-fix-loop가 재시도 예산을 소진하면 에스컬레이션이 시작됩니다(TaskContract의 `retry_budget`, 기본값 3).

| `escalation_policy` 값 | 담당 | 행동 |
|---|---|---|
| `"forge-review"` (기본값) | Forge | 아키텍처 리뷰입니다. 수정 가능한 근본 원인을 찾으면 → 수정 후 테스트 한 번 더. 접근 방식이 틀렸으면 → Nova에 에스컬레이션. |
| `"nova-decision"` | Nova | 전략적 결정입니다. 범위 축소, 기능 삭제, 대안, 또는 강행. |
| `"pivot"` | Compass | 전체 컨텍스트로 `/pivot-protocol`을 호출합니다. |

모든 에스컬레이션 경로에서:
1. TaskContract 상태를 `"escalated"`로 바꿉니다.
2. `.geas/decisions/{dec-id}.json`에 DecisionRecord를 씁니다.
3. `.geas/ledger/events.jsonl`에 에스컬레이션 이벤트를 로그합니다.

`forge-review` → Nova 경로:

```
Gate N번 실패
  → Forge 검토 (forge-escalation.json)
      → 수정 가능? → 수정 한 번 더 + 재gate
      → 접근 방식이 틀림? → Nova 결정
          → 범위 축소 / 기능 삭제 / 대안 / 강행
  → DecisionRecord 작성
  → status: "escalated"
```

---

## 이벤트 로깅

모든 이벤트는 `.geas/ledger/events.jsonl`에 append합니다(newline-delimited JSON). 타임스탬프는 `date -u`의 실제 ISO 8601 값이어야 합니다. 플레이스홀더 문자열은 안 됩니다.

### 표준 step_complete 이벤트

각 단계가 끝나고 `remaining_steps`에서 빠진 뒤 로그합니다.

```json
{"event": "step_complete", "task_id": "{task-id}", "step": "{step_name}", "agent": "{agent_name}", "timestamp": "<actual>"}
```

`step_complete`를 쓰는 단계: `design`, `tech_guide`, `implementation`, `code_review`, `testing`, `critic_review`, `nova_review`, `retrospective`.

### 자체 형식이 있는 이벤트 (step_complete 중복 없음)

| 단계 | 이벤트 이름 | 로그 시점 |
|---|---|---|
| Implementation Contract | `implementation_contract` | 승인 또는 수정 요청 후 |
| Evidence Gate | `gate_result` | gate 완료 후 (통과 또는 실패) |
| Resolve | `task_resolved` | Ship/Iterate/Cut 결정 후 |

### 단계 및 생명주기 이벤트

| 이벤트 | 로그 시점 |
|---|---|
| `task_compiled` | 각 TaskContract 컴파일 후 (Genesis 1.6) |
| `task_started` | 각 태스크 시작 시 (단계 2.0) |
| `phase_complete` | 각 단계 종료 시 (Genesis, MVP, Polish, Evolution) |
| 에스컬레이션 이벤트 | 재시도 예산 소진 후 escalation_policy 호출 시 |

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
