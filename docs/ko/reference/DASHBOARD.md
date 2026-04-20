# Dashboard (v3 규격)

**상태.** 선행 규격이다. 이 문서는 Phase 3 구현에 들어가기 전에 작성되어 `src/dashboard/` 재구현의 구체적 표적이 된다. Phase 3 동안 soft-freeze — 구현 피드백에서 나온 미세 조정은 허용하지만 구조 변경은 설계 라운드로 되돌린다.

이 규격은 dashboard가 *무엇을 보여주는가*, *어느 데이터를 읽는가*, *결함 입력에서 어떻게 degrade하는가*, *무엇을 하지 않는가*를 정의한다. 프레임워크·위젯 라이브러리 같은 구체 선택은 Phase 3 조사 단계에서 정한다.

---

## 1. 목적

Dashboard는 Geas 프로젝트에 대한 읽기 전용 관찰자다. 소비자는 JSON을 직접 열지 않고 CLI가 남긴 상태를 조감하고 싶은 개발자 · operator다.

다음은 *아니다*.

- 편집기. 화면 어떤 필드도 `.geas/`로 되쓰지 않는다.
- CLI 래퍼. 어떤 버튼도 `geas` 명령을 실행하지 않는다.
- 다중 사용자 표면. 인증·권한·원격 접근 없음.
- `geas status` / `geas context` 대체제. 저건 단발 JSON, dashboard는 상호작용형 집계 뷰다.

Dashboard의 가치는 artifact(task state + evidence + gate run + debt + event)를 교차 참조하여 원 JSON이 직접 답하지 않는 질문에 답하는 데 있다.

---

## 2. 데이터 출처

Dashboard는 CLI가 만든 `.geas/` artifact 트리만 읽는다. `geas`를 호출하지 않고, hook을 거치지 않고, 어디에도 쓰지 않는다.

### 2.1 프로젝트 수준

| 경로 | Schema | 용도 |
|---|---|---|
| `.geas/debts.json` | `debts.schema.json` | Debt register 뷰. |
| `.geas/events.jsonl` | (events 계약 — `architecture/CLI.md` §14.7) | Events timeline. |
| `.geas/memory/shared.md` | (free markdown) | Memory panel. |
| `.geas/memory/agents/{agent}.md` | (free markdown) | Memory panel. |

### 2.2 Mission 수준

Mission id 패턴: `mission-YYYYMMDD-xxxxxxxx`. 각 디렉토리 `.geas/missions/{mission_id}/`가 담을 수 있는 파일:

| 경로 | Schema | 용도 |
|---|---|---|
| `spec.json` | `mission-spec.schema.json` | Mission overview. |
| `mission-design.md` | (free markdown) | Mission overview (선택). |
| `mission-state.json` | `mission-state.schema.json` | Mission overview, phase 배지. |
| `phase-reviews.json` | `phase-reviews.schema.json` | Phase review history 뷰. |
| `mission-verdicts.json` | `mission-verdicts.schema.json` | Mission overview (final verdict). |
| `deliberations.json` | `deliberation.schema.json` | Evidence · gate 상세 배경. |
| `consolidation/gap.json` | `gap.schema.json` | Gap signals 뷰. |
| `consolidation/memory-update.json` | `memory-update.schema.json` | Memory panel (changelog). |
| `consolidation/candidates.json` | (보조 artifact, schema 검증 대상 아님) | Consolidation packet 뷰. |

### 2.3 Task 수준

`.geas/missions/{mission_id}/tasks/{task_id}/` 하위:

| 경로 | Schema | 용도 |
|---|---|---|
| `contract.json` | `task-contract.schema.json` | Task table, evidence gate 상태. |
| `task-state.json` | `task-state.schema.json` | Task table. |
| `implementation-contract.json` | `implementation-contract.schema.json` | Task 상세. |
| `self-check.json` | `self-check.schema.json` | Evidence gate 상태. |
| `evidence/{agent}.{slot}.json` | `evidence.schema.json` | Evidence gate 상태, closure 뷰. |
| `gate-results.json` | `gate-results.schema.json` | Evidence gate 상태. |
| `deliberations.json` | `deliberation.schema.json` | Evidence gate 상세. |

### 2.4 Refresh 의미론

Dashboard는 요청 시에만 artifact를 재조회한다. 최소 계약:

- 각 뷰에서 수동 refresh (사용자 액션 명시).
- 선택적으로 `.geas/`에 대한 파일시스템 watcher가 변경을 debounce하여 캐시 무효화.

Watcher를 쓸 수 없는 환경에선 폴링도 허용. 폴링 간격은 설정 가능해야 하며 기본 ≥2초로 스래싱을 막는다.

---

## 3. 뷰

Dashboard는 9개 뷰로 구성한다. 각 뷰는 *표시 대상*, *읽는 파일*, *집계 방식*, *결함 · 누락 입력 처리* 순으로 규정한다.

### 3.1 Mission overview

**표시.** 선택된 mission의 id, mode, phase, 사용자 승인 상태, final verdict(있다면), 범위 요약(`mission-spec.scope` 기준), 상태별 task 수, `mission-design.md`가 있으면 본문.

**읽기.** `spec.json`, `mission-state.json`, `mission-design.md`, `mission-verdicts.json`, `tasks/*/task-state.json`의 요약.

**집계.** Task 수는 9-state lifecycle(`drafted`, `ready`, `implementing`, `reviewed`, `verified`, `passed`, `blocked`, `escalated`, `cancelled`)로 그룹화.

**경계.**
- `mission-state.json` 부재 → phase `unknown`과 경고 배지로 렌더링.
- `mission-design.md` 부재 → design 섹션 숨김(오류 아님).
- `mission-verdicts.json` 부재 · 비어 있음 → final verdict 영역에 "아직 발행되지 않음".

### 3.2 Task table

**표시.** 선택된 mission의 task 1행씩. 컬럼: id, 제목(`contract.goal`), 현재 state, risk level, active agent, verify-fix 반복 횟수, 필수 reviewer 요약, 다음 예상 전이.

**읽기.** 해당 mission의 `tasks/*/contract.json`, `tasks/*/task-state.json` 전부.

**집계.** State 그룹(진행 중 우선, 종결 이후)으로 정렬 후 id 순. State · risk · implementer로 필터 가능.

**경계.**
- Task 디렉토리에 `contract.json` 없음 → 행에 id + "contract missing"과 경고 표시.
- Task 디렉토리에 `task-state.json` 없음 → state 컬럼을 `?`와 경고로.
- Schema-invalid state → 값 그대로 표시하고 경고 배지, 행은 유지.

### 3.3 Evidence gate 상태

**표시.** 선택된 task의 필수 reviewer slot과 각 slot의 evidence entry 존재 여부, 마지막 gate run verdict(`pass` / `fail` / `block` / `error`)와 사유, 최신 `self-check.json` 요약, 각 evidence 파일 링크.

**읽기.** `contract.json`(routing), `self-check.json`, 모든 slot의 `evidence/{agent}.{slot}.json`, `gate-results.json`.

**집계.** 각 필수 reviewer slot의 presence ∈ {present, absent}. 전이를 막는 첫 번째 누락 slot을 강조.

**경계.**
- Gate run 없음 → verdict 영역에 "gate 실행 안 됨".
- 필수 reviewer의 evidence 파일 없음 → 해당 slot을 "missing"으로 강조(오류 아님 — 일반적 pre-gate 상태).
- Schema-invalid evidence 파일 → 목록에 포함하되 플래그, verdict 영역에 "evidence 결함; 파일 확인 요망".

### 3.4 Phase review 이력

**표시.** 선택된 mission의 append된 phase review entry. from/to phase, 상태(passed / changes-requested / blocked), 검토자, verdict 요약, 타임스탬프.

**읽기.** `phase-reviews.json`.

**집계.** 역시간순(최신이 위). Phase · 상태로 필터 가능.

**경계.**
- 파일 부재 → empty state "phase review 기록 없음".
- Schema-invalid entry → 건너뛰며 "결함 entry 1건 스킵" 표시.

### 3.5 Debt register

**표시.** 프로젝트 전역 debt entry. 컬럼: id, title, severity, status, owner, source mission, opened, resolved(있다면).

**읽기.** `.geas/debts.json`.

**집계.** 기본 필터: status=open. severity · source mission으로 그룹 가능.

**경계.**
- 파일 부재 → empty state "등록된 부채 없음".
- 알 수 없는 status → 값 그대로 표시 + 경고.

### 3.6 Gap signals 요약

**표시.** 선택된 mission의 `consolidation/gap.json` 내용. gap 카테고리(design, process, tooling 등)별 entry.

**읽기.** `missions/{mid}/consolidation/gap.json`.

**집계.** 카테고리 그룹 · 카테고리별 건수 · 교차 참조 evidence 링크.

**경계.**
- 파일 부재(consolidation 이전) → empty state "미션이 아직 consolidating phase에 진입하지 않음".
- `gap.json`은 있고 내용 비어 있음 → 명시적 "surfaced된 gap 없음".

### 3.7 Memory panel

**표시.** 현재의 `.geas/memory/shared.md`와 `.geas/memory/agents/{agent}.md` 본문, 가장 최근 mission의 `consolidation/memory-update.json` changelog.

**읽기.** `.geas/memory/shared.md`, `.geas/memory/agents/*.md` 전부, 최신 `missions/{mid}/consolidation/memory-update.json`.

**집계.** 에이전트 타입별 탭; changelog는 diff 스타일 목록(entry별 `reason`과 `evidence_refs` 포함한 added / modified / removed).

**경계.**
- memory 디렉토리 부재 → empty state "memory 작성 기록 없음".
- `memory-update.json` 부재 → changelog 탭 숨김; markdown 탭은 정상 렌더.

### 3.8 Events timeline

**표시.** 이벤트를 시간순으로. kind, actor, mission · task id(있다면), payload 요약.

**읽기.** `.geas/events.jsonl`.

**집계.** 기본: 최근 100건. kind · actor · mission · task로 필터. 알 수 없는 `kind` entry는 미리 정의된 요약 없이 값 그대로 렌더.

**경계.**
- 파일 부재 → empty state "이벤트 기록 없음".
- 결함 JSONL 라인 → 조용히 스킵; 푸터에 스킵 건수 표시.
- `actor`가 `cli:auto`면 별도 배지로 렌더(`architecture/CLI.md` §14.7); 알 수 없는 actor는 값 그대로.

### 3.9 Consolidation packet 뷰

**표시.** `consolidating` phase에 들어간 · 지난 mission에 대해, `geas consolidation scaffold`가 만든 `candidates.json`(미션 evidence에서 수집한 debt 후보, memory suggestion, gap signal)과, orchestrator가 이 후보에서 승격한 공식 `debts.json` entry, `gap.json`, `memory-update.json`을 병치.

**읽기.** `consolidation/candidates.json`, `consolidation/gap.json`, `consolidation/memory-update.json`, `debts.json`.

**집계.** 나란히 비교: 각 후보에 대해 orchestrator가 대응하는 공식 entry를 남겼는지 여부로 "promoted", "dropped", "still pending" 마킹.

**경계.**
- `candidates.json` 부재 → "이 mission에 scaffold가 실행되지 않았음".
- 승격 기록 없음 → 모든 후보가 "still pending"으로 표시되며 오류 아님.

---

## 4. UX 원칙

1. **Graceful degradation.** Artifact 부재 · 결함은 치명적이지 않다. 해당 뷰 · 필드만 명시적 empty state나 경고 배지로 대체되고 나머지는 정상 동작한다.
2. **Read-only.** 화면의 어떤 액션도 `.geas/`에 쓰지 않는다. 클립보드 복사, 외부 에디터로 열기 같은 외부 액션은 허용; mutation은 불가.
3. **Schema 인식은 하되 rigid하지 않음.** 파서는 방어적으로 읽는다(모르는 필드 보존, 미지의 enum 값은 원문 그대로 렌더). 유효성의 source of truth는 schema지만 dashboard는 viewer이므로 파일을 거부하지 않는다.
4. **빠른 첫 화면.** 첫 그리기에서 artifact 트리를 전부 읽지 않는다. 뷰는 지연 로드; 인덱스 페이지는 최소 요약만 읽는다.
5. **Offline · single-project 기본.** 단일 프로젝트가 공통 케이스다. Multi-project 전환이 추가된다면 각 프로젝트는 사용자가 선택한 로컬 경로에서 읽는다.
6. **설명하되 꾸짖지 않음.** 무언가 없을 때 CLI로 다음 스텝을 어떻게 밟아야 하는지 설명한다. "Gate 실행 안 됨. 누락된 필수 reviewer: risk-assessor." 처럼 안내하지 "404 gate-results.json" 같은 일반 오류를 띄우지 않는다.

---

## 5. Non-goals

- `.geas/`에 어떤 형태로도 쓰지 않는다.
- UI에서 `geas` CLI 명령을 호출하지 않는다.
- 인증 · 멀티유저 · 원격 접근 없음.
- 분석 · 사용량 수집 · 백그라운드 보고 없음.
- Task · evidence 편집 없음.
- 스크립트용 상태 조회(`geas status`, `geas context`)의 대체가 아니다 — dashboard는 사람용이다.
- 스케줄링된 보고서 · 이메일 요약 없음.

---

## 6. 기술 스택 제약

구체 스택은 Phase 3 조사 단계에서 정한다. 조사 선택에 다음 제약을 건다.

1. `.geas/` 트리를 로컬 파일시스템에서 읽는다. UI 런타임이 로컬에 필요로 하는 것 외의 서버 컴포넌트는 없다.
2. Windows · POSIX가 만드는 forward-slash / backslash 경로를 사용자 설정 없이 모두 처리한다.
3. 결함 JSON을 방어적으로 파싱한다. 첫 파싱 오류에서 crash는 불가 — 나머지 트리는 계속 렌더되어야 한다.
4. 번들을 합리적으로 작게 유지한다. 목표는 "단일 로컬 viewer", 플랫폼이 아니다.
5. Phase 3 조사가 TUI 선호의 강한 근거를 찾지 못하는 한, UI는 웹 기반(브라우저 또는 로컬 desktop shell)을 타겟으로 한다. 선호일 뿐 하드 제약 아님.

구체 선택(프레임워크, 번들러, 스타일링, 위젯 라이브러리, filesystem-watch 전략)은 Phase 3 설계 라운드에서 별도 spec으로 확정한다.

---

## 7. 교차 참조

- `architecture/CLI.md` — dashboard가 읽는 artifact를 만드는 명령 표면.
- `architecture/DESIGN.md` — artifact 트리 owner, events.jsonl 범위.
- `protocol/08` — 정규 artifact 인벤토리와 schema 연결.
- `SKILLS.md` / `HOOKS.md` — dashboard가 렌더링하는 상태를 만드는 다른 Phase 1 · Phase 2 표면.
