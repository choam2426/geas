# Initiative 모드 가이드

## 사용 시기

Initiative 모드는 제품, 서비스, 도구 등 새로운 것을 처음부터 시작할 때 사용합니다. 다음과 같은 경우에 사용하세요:

- 미션은 있지만 아직 코드베이스가 없을 때
- 단순히 코드를 작성하는 것이 아니라 아키텍처를 고민할 팀이 필요할 때
- 모든 결정이 추적 가능하고 모든 출력물이 검증되기를 원할 때

기존 프로젝트에 기능을 추가하는 경우에는 Sprint 모드를 사용하세요.

---

## 시작 전: Intake

Initiative를 실행하기 전에 Geas는 고정된 미션 명세가 필요합니다. 없다면 먼저 `/geas:intake`를 실행하세요.

Intake는 섹션별로 진행됩니다:

1. 에이전트가 원시 미션을 읽고 너무 광범위한지 확인합니다. 그렇다면 분해 방안을 제안하고 첫 번째 서브프로젝트에 집중합니다.
2. 범위 경계, 대상 사용자, 제약 조건, 성공 기준, 명시적 제외 범위 등 질문을 하나씩 합니다.
3. 트레이드오프가 담긴 2–3가지 접근 방식 옵션을 제시하고 방향을 선택하게 합니다.
4. 명세의 각 섹션을 검토하고 승인을 받은 후 고정합니다.

결과는 `.geas/spec/seed.json`입니다. 확인 후 seed는 세션 중에 변경되지 않습니다. 미션이 중간에 바뀌어야 한다면 편집이 아닌 pivot 프로토콜이 실행됩니다.

**Intake에서 결정하는 것:** 미션 선언문, 범위 포함/제외, 인수 기준, 대상 사용자, 제약 조건, 접근 방향.

---

## 네 단계

### 1단계: Genesis

코드 한 줄도 작성하기 전에 이루어지는 모든 것.

**진행 내용:**

1. Seed 확인 — Geas가 `seed.json`을 읽습니다. 완전성 체크리스트에 누락이 있고 오버라이드가 설정되지 않은 경우 intake로 돌아갑니다.
2. **Nova**가 비전 선언문, MVP 범위 정의, 사용자 가치 제안을 제공합니다.
3. **Nova**가 PRD를 작성하고 사용자 스토리로 분해합니다.
4. **Forge**가 아키텍처와 기술 스택을 제안하고, 프로젝트 규칙을 `.geas/memory/_project/conventions.md`에 작성하며 결정을 기록합니다.
5. 세 에이전트가 아키텍처에 대해 병렬로 투표합니다: **Circuit** (백엔드/확장성), **Palette** (UX/프론트엔드), **Critic** (악마의 대변인 — 폭넓게 동의하더라도 위험을 식별). 모두 동의하면 Genesis가 계속됩니다. 누군가 동의하지 않으면 구조적 토론이 먼저 진행된 후 재투표합니다.
6. **Task Compiler**가 각 사용자 스토리를 인수 기준과 점수화된 차원의 rubric이 포함된 TaskContract로 변환합니다.
7. 기술 스택을 기반으로 Geas가 빌드 중 에이전트에게 도움이 될 MCP 서버를 추천합니다 (데이터베이스 쿼리, 웹 표준, git 플랫폼 등).

**여러분이 결정하는 것:** intake 중 미션 세부사항, 아키텍처 승인 (투표가 각 에이전트의 입장을 구조적으로 보여줌), 연결할 MCP 서버.

---

### 2단계: MVP Build

모든 태스크가 전체 파이프라인을 실행합니다. 지름길 없음. 각 태스크의 파이프라인:

#### 시작
- 태스크가 의존성 순서로 선택됩니다.
- 상태가 `"in_progress"`로 설정됩니다.
- `remaining_steps`이 체크포인트에 기록됩니다 — 이 태스크의 정확한 단계 목록. 단계가 완료되면 앞에서부터 제거되므로 세션이 중단되어도 Geas가 재개 위치를 정확히 압니다.

#### Design (Palette) — UI 태스크만
백엔드, API, CI, 데이터베이스, 유틸리티 태스크는 건너뜁니다. 페이지, 폼, 대시보드가 있는 태스크에 실행됩니다. Palette가 구현 시작 전에 디자인 명세를 작성합니다.

#### Tech Guide (Forge) — 조건부
다음 네 가지 조건이 동시에 성립할 때만 건너뜁니다: 태스크가 기존 패턴을 따르고, 새 라이브러리가 필요 없고, 단일 모듈만 변경하고, 스키마 변경이 없을 때. 이 조건 중 하나라도 거짓이면 Forge가 먼저 기술적 방향을 제시합니다.

#### Implementation Contract — 필수
코드를 작성하기 전에 worker가 구체적인 실행 계획을 제안합니다: 취할 행동, 다루는 엣지 케이스, 명시적 제외 범위, 완료 데모 방법. Sentinel이 데모 단계가 모든 인수 기준을 다루는지 확인합니다. Forge가 계획된 행동이 기술적으로 실현 가능하고 tech guide와 일치하는지 확인합니다. 둘 다 승인해야 합니다. 수정이 요청되면 worker가 업데이트하여 재제출합니다 — 한 번의 수정 사이클 후 Forge가 최종 결정을 내립니다. 승인된 contract는 `.geas/contracts/{task-id}.json`에 저장됩니다.

#### Implementation — 필수, worktree 격리
Worker가 git worktree 브랜치에서 구현하여 main 브랜치를 깨끗하게 유지합니다. 증거는 `.geas/evidence/{task-id}/{worker}.json`에 기록됩니다. Worktree 브랜치는 구현 후 병합됩니다.

#### Code Review (Forge) — 필수
Forge가 rubric의 `code_quality` 차원에 대해 구현을 검토하고 `.geas/evidence/{task-id}/forge-review.json`에 리뷰를 작성합니다.

#### QA (Sentinel) — 필수
Sentinel이 다섯 가지 품질 차원에 걸쳐 기능을 테스트합니다: `core_interaction`, `feature_completeness`, `regression_safety`, 그리고 UI 태스크의 경우 `ux_clarity`와 `visual_coherence`. 결과는 `.geas/evidence/{task-id}/sentinel.json`에 저장됩니다.

#### Evidence Gate — 필수
3단계 검증:
- **Tier 1 (Mechanical):** TaskContract의 `eval_commands`를 실행합니다. 빌드, 린트, 테스트. 첫 번째 실패 시 중단.
- **Tier 2 (Semantic):** 각 인수 기준을 증거와 대조합니다. 임계값에 대해 rubric 차원을 채점합니다. Worker의 신뢰도가 낮거나 미해결 stub이 있으면 임계값이 높아집니다.
- **Tier 3 (Product):** Nova를 생성하여 제품 판단을 내립니다 — Ship, Iterate, 또는 Cut.

게이트가 실패하면 `/geas:verify-fix-loop`가 실행됩니다. fixer 에이전트 (백엔드는 Circuit, 프론트엔드는 Pixel)가 worktree에 생성되어 실패를 처리하고 게이트가 재실행됩니다. 재시도 예산은 기본 3회입니다. 예산이 소진되면 Forge가 아키텍처를 검토하고 Nova가 전략적 결정을 내립니다.

#### Critic Review — 필수
Critic이 모든 증거를 읽고 태스크가 정말로 출시 준비가 되어 있는지 도전합니다. 위험, 누락된 엣지 케이스, 기술 부채를 찾습니다. 이것은 형식적 승인이 아닙니다 — Critic은 문제를 찾아야 합니다.

#### Nova Review — 필수
Nova가 Critic의 도전을 포함한 모든 증거를 읽습니다. 판정을 내립니다: **Ship**, **Iterate**, 또는 **Cut**.

#### Ship Gate
태스크를 통과로 표시하기 전에 Geas가 네 가지 필수 파일이 모두 존재하는지 확인합니다: forge-review, sentinel QA, critic-review, nova-verdict. 누락된 것이 있으면 해당 단계가 먼저 실행됩니다.

#### Retrospective (Scrum) — 필수
Scrum이 모든 증거를 읽고 태스크 중 발견된 새 패턴으로 `conventions.md`를 업데이트하며, `.geas/memory/retro/{task-id}.json`에 교훈을 기록합니다. 각 태스크의 교훈이 다음 태스크에 반영됩니다.

#### 해결
- **Ship:** 태스크 상태가 `"passed"`로 설정됩니다. Keeper가 conventional commit 형식으로 커밋합니다.
- **Iterate:** Worker가 Nova의 피드백과 함께 재배치됩니다.
- **Cut:** 태스크 상태가 `"failed"`로 설정됩니다. 이유를 설명하는 DecisionRecord가 작성됩니다.

---

### 3단계: Polish

필수 — 모든 MVP 태스크가 해결된 후 실행됩니다.

- **Shield**가 프로젝트의 보안 검토를 실행합니다. 발견된 문제는 계속 진행하기 전에 수정됩니다.
- **Scroll**이 README와 문서를 작성합니다.

---

### 4단계: Evolution

필수 — 출시 전 최종 단계.

- Geas가 seed의 `scope_in` 내 잔여 작업을 평가합니다. `scope_out`에 있는 것은 거부됩니다.
- **Nova**가 최종 전략적 요약과 권고사항을 제공합니다.
- **Keeper**가 릴리스를 생성합니다: 버전 업, changelog, 최종 커밋.
- `/geas:run-summary`가 전체 세션 감사 추적을 생성합니다.

---

## 실제 예시: 경매 플랫폼

온라인 경매 플랫폼을 처음부터 구축하는 세션. 15개 태스크, 모든 단계에서 약 56회의 에이전트 생성.

**Genesis:**
- Intake에서 4가지 범위 질문이 표면화됨: 입찰 규칙, 결제 통합, 실시간 업데이트, 관리 도구. 결제와 관리는 제외 범위로 설정.
- Nova가 집중된 MVP를 제안: 아이템 목록, 입찰, 경매 종료.
- Forge가 REST API와 React 프론트엔드를 갖춘 Node.js/PostgreSQL 스택을 제안.
- 아키텍처 투표: Circuit 동의 (관심사 분리 명확), Palette 동의 (REST가 UI 상태에 잘 매핑), Critic 동의 (실시간 입찰 업데이트에 SSE 또는 WebSocket 고려 필요 메모 포함).
- 12개 사용자 스토리에서 15개 TaskContract 컴파일됨 (3개 스토리가 여러 태스크로 분해).

**MVP Build — 예시 태스크 (US-01: 아이템 목록):**
- Implementation Contract: 24개 계획된 행동, 스키마 생성, API 엔드포인트, 이미지 업로드 처리, 빈 경매 및 동시 입찰 경쟁 조건을 포함한 6개 엣지 케이스 다룸.
- Code Review rubric 점수: `code_quality` 4/4.
- QA rubric 점수: `core_interaction` 3/3, `feature_completeness` 4/4, `regression_safety` 4/4, `ux_clarity` 3/3, `visual_coherence` 2/3. 게이트 통과 — `visual_coherence`가 한 번의 수정 사이클 후 임계값 3을 충족.
- Critic이 설명 필드 길이에 대한 입력 유효성 검사 누락을 지적. Worker가 Ship 판정 전에 수정.
- Nova 판정: Ship.

**전체 실행의 Rubric 점수**는 1에서 5 사이. 낮은 점수의 태스크는 수정 루프를 촉발했고, 높은 점수의 태스크는 순조롭게 진행됨. Rubric이 실제 격차를 표면화했습니다 — "완료된 것처럼 보이는" 여러 태스크가 첫 번째 시도에서 semantic tier를 통과하지 못했습니다.

**Polish:** Shield가 관리자 인접 엔드포인트에서 두 개의 누락된 인증 확인을 발견. Scroll이 문서를 작성하기 전에 수정됨.

**Evolution:** Keeper가 완료 시 `v0.1.0` 태그 생성.

---

## 세션 재개

세션이 태스크 중간에 중단되면 Geas가 정확히 중단된 위치에서 재개합니다.

`.geas/state/run.json`의 체크포인트가 추적합니다:
- `current_task_id` — 진행 중인 태스크
- `pipeline_step` — 실행 중인 단계
- `agent_in_flight` — 실행 중인 에이전트
- `remaining_steps` — 아직 완료해야 할 단계의 순서 목록

재개 시 Geas는 중단된 단계의 증거가 이미 존재하는지 확인합니다. 존재한다면 세션 종료 전에 단계가 완료된 것이므로 Geas는 다음 단계로 넘어갑니다. 증거가 없으면 단계가 처음부터 다시 실행됩니다.

특별한 작업이 필요하지 않습니다 — 진행 중인 `run.json`이 있는 프로젝트에서 새 세션을 시작하면 자동으로 재개가 트리거됩니다.

---

## 팁

- **미션 설명을 구체적으로 하세요.** 모호한 미션은 넓은 범위와 어려운 트레이드오프를 만듭니다. 집중된 미션은 더 타이트하고 빠른 MVP를 만들어냅니다.
- **Intake 질문에 신중하게 답하세요.** Seed가 모든 것을 형성합니다: PRD, 사용자 스토리, task contract, 인수 기준이 모두 여기서 도출됩니다. 약한 seed는 약한 contract와 더 어려운 evidence gate를 의미합니다.
- **승인 전에 아키텍처 투표를 검토하세요.** Circuit, Palette, Critic이 각각 다른 각도에서 평가합니다. 그들의 이견은 신호입니다 — Critic의 "우려 사항과 함께 동의" 메모도 읽을 가치가 있습니다.
- **파이프라인을 신뢰하세요.** 파이프라인은 문제를 늦게가 아니라 일찍 표면화하도록 설계되었습니다. 첫 번째 시도에서 evidence gate를 실패한 태스크는 제 역할을 하는 것입니다. verify-fix loop가 실행되도록 두세요.
- **요청 시 개입하세요.** Geas는 intake, 아키텍처 승인, 태스크가 Cut될 때마다 사람의 입력을 위해 일시 중지합니다. 이 체크포인트 밖에서는 에이전트들이 작업 중입니다 — 파이프라인 중간에 중단하면 단계가 다시 실행되어야 할 수 있습니다.
- **Seed는 이유가 있어 불변입니다.** 빌드 중간에 미션을 변경하고 싶다면 그것은 편집이 아닌 pivot입니다. `/geas:pivot-protocol`을 사용하여 DecisionRecord와 함께 범위 변경을 깔끔하게 처리하세요.
