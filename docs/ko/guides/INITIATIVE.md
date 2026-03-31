# Initiative 모드 가이드

## 언제 쓰나

Initiative 모드는 뭔가를 밑바닥부터 새로 만들 때 쓴다. 제품이든, 서비스든, 도구든. 이런 상황에 맞다:

- 미션은 있는데 코드베이스가 아직 없다
- 코드만 찍어내는 게 아니라 아키텍처를 같이 고민할 팀이 필요하다
- 모든 결정을 추적하고, 모든 결과물을 검증하고 싶다

기존 프로젝트에 기능을 추가하는 거라면 Sprint 모드를 쓰면 된다.

---

## 시작 전: Intake

Initiative를 돌리려면 먼저 확정된 미션 명세가 있어야 한다. 없으면 `/geas:intake`부터 실행한다.

Intake는 섹션별로 진행된다:

1. 에이전트가 미션을 읽고 범위가 너무 넓은지 판단한다. 넓으면 분해안을 제시하고 첫 번째 서브프로젝트에 집중한다.
2. 범위, 대상 사용자, 제약 조건, 성공 기준, 명시적 제외 사항 등을 하나씩 물어본다.
3. 트레이드오프가 담긴 접근 방식 2-3가지를 제시하고, 방향을 고르게 한다.
4. 명세의 각 섹션을 확인받고 나면 확정한다.

결과물은 `.geas/spec/seed.json`이다. 한번 확정하면 세션 중에는 바뀌지 않는다. 빌드 도중 미션이 바뀌어야 한다면 seed를 수정하는 게 아니라 pivot 프로토콜을 탄다.

**Intake에서 정하는 것:** 미션 선언문, 범위 포함/제외, 인수 기준, 대상 사용자, 제약 조건, 접근 방향.

---

## 네 단계

### 1단계: Genesis

코드 한 줄 짜기 전에 벌어지는 모든 일.

**진행 과정:**

1. Seed 확인 -- Geas가 `seed.json`을 읽는다. 완전성 체크리스트에 빈 곳이 있고 override가 없으면 intake로 되돌아간다.
2. **Nova**가 비전 선언문, MVP 범위 정의, 사용자 가치 제안을 내놓는다.
3. **Nova**가 PRD를 작성하고 사용자 스토리로 쪼갠다.
4. **Forge**가 아키텍처와 기술 스택을 제안하고, 프로젝트 컨벤션을 `.geas/memory/_project/conventions.md`에 기록하고, 결정을 남긴다.
5. 세 에이전트가 아키텍처에 대해 병렬로 투표한다: **Circuit** (백엔드/확장성), **Palette** (UX/프론트엔드), **Critic** (악마의 변호인 -- 다들 찬성해도 리스크를 짚어낸다). 전원 찬성이면 Genesis가 계속된다. 반대가 나오면 구조적 토론을 먼저 하고 다시 투표한다.
6. **Task Compiler**가 각 사용자 스토리를 인수 기준과 채점 rubric이 달린 TaskContract로 변환한다.
7. 기술 스택에 맞춰 Geas가 빌드에 도움될 MCP 서버를 추천한다 (DB 쿼리, 웹 표준, git 플랫폼 등).

**내가 정하는 것:** intake 중 미션 세부사항, 아키텍처 승인 (투표 결과로 각 에이전트 입장을 한눈에 볼 수 있다), 연결할 MCP 서버.

---

### 2단계: MVP Build

모든 태스크가 파이프라인 전체를 탄다. 지름길 없다.

#### 시작
- 태스크가 의존성 순서대로 선택된다.
- 상태가 `"in_progress"`로 바뀐다.
- `remaining_steps`가 체크포인트에 기록된다. 이 태스크가 밟아야 할 단계 목록이다. 단계가 끝나면 앞에서부터 빠지기 때문에, 세션이 끊겨도 어디서 이어갈지 정확히 안다.

#### Design (Palette) -- UI 태스크만
백엔드, API, CI, DB, 유틸리티 태스크는 건너뛴다. 페이지, 폼, 대시보드가 있는 태스크에서 실행된다. Palette가 구현 전에 디자인 명세를 먼저 잡는다.

#### Tech Guide (Forge) -- 조건부
네 가지가 동시에 성립할 때만 건너뛴다: 기존 패턴을 따르고, 새 라이브러리가 필요 없고, 단일 모듈만 건드리고, 스키마 변경이 없을 때. 하나라도 아니면 Forge가 기술적 방향을 먼저 잡아준다.

#### Implementation Contract -- 필수
코드를 짜기 전에, worker가 구체적인 실행 계획을 제출한다: 어떤 작업을 할 건지, 어떤 엣지 케이스를 다루는지, 뭘 안 할 건지, 완료를 어떻게 증명할 건지. Sentinel은 데모 단계가 인수 기준을 전부 커버하는지 확인한다. Forge는 계획이 기술적으로 실현 가능하고 tech guide와 맞는지 확인한다. 둘 다 승인해야 한다. 수정 요청이 오면 worker가 고쳐서 다시 내는데, 수정은 한 번만 가능하고 그 뒤는 Forge가 최종 판단한다. 승인된 contract는 `.geas/contracts/{task-id}.json`에 저장된다.

#### Implementation -- 필수, worktree 격리
Worker가 git worktree 브랜치에서 구현한다. main 브랜치는 깨끗하게 유지된다. 증거는 `.geas/evidence/{task-id}/{worker}.json`에 남긴다. 구현이 끝나면 worktree 브랜치를 merge한다.

#### Code Review (Forge) -- 필수
Forge가 rubric의 `code_quality` 기준으로 구현을 리뷰하고 `.geas/evidence/{task-id}/forge-review.json`에 결과를 쓴다.

#### QA (Sentinel) -- 필수
Sentinel이 다섯 가지 품질 기준으로 테스트한다: `core_interaction`, `feature_completeness`, `regression_safety`, 그리고 UI 태스크면 `ux_clarity`, `visual_coherence`까지. 결과는 `.geas/evidence/{task-id}/sentinel.json`에 들어간다.

#### Evidence Gate -- 필수
3단계 검증:
- **Tier 1 (Mechanical):** TaskContract의 `eval_commands`를 돌린다. 빌드, 린트, 테스트. 하나라도 실패하면 멈춘다.
- **Tier 2 (Semantic):** 각 인수 기준을 증거와 대조한다. rubric 차원별로 임계값 이상인지 채점한다. worker의 신뢰도가 낮거나 미해결 stub이 있으면 임계값이 올라간다.
- **Tier 3 (Product):** Nova가 제품 관점에서 판단한다 -- Ship, Iterate, 또는 Cut.

게이트를 통과 못 하면 `/geas:verify-fix-loop`가 돈다. fixer 에이전트 (백엔드는 Circuit, 프론트엔드는 Pixel)가 worktree에서 문제를 고치고 게이트를 다시 돌린다. 재시도 횟수는 기본 3회다. 예산을 다 쓰면 Forge가 아키텍처를 점검하고, Nova가 전략적 판단을 내린다.

#### Critic Review -- 필수
Critic이 모든 증거를 읽고, 이 태스크가 진짜 출시해도 되는지 따진다. 리스크, 빠진 엣지 케이스, 기술 부채를 찾는다. 고무도장이 아니다 -- Critic은 문제를 찾아내야 한다.

#### Nova Review -- 필수
Nova가 Critic의 의견을 포함한 전체 증거를 읽고 판정을 내린다: **Ship**, **Iterate**, 또는 **Cut**.

#### Ship Gate
태스크를 통과로 찍기 전에, Geas가 필수 파일 네 개가 다 있는지 확인한다: forge-review, sentinel QA, critic-review, nova-verdict. 빠진 게 있으면 해당 단계를 먼저 돌린다.

#### Retrospective (Scrum) -- 필수
Scrum이 모든 증거를 읽고, 태스크에서 발견한 새 패턴으로 `conventions.md`를 갱신하고, `.geas/memory/retro/{task-id}.json`에 교훈을 기록한다. 각 태스크의 교훈이 다음 태스크에 반영된다.

#### 해결
- **Ship:** 태스크 상태가 `"passed"`로 바뀐다. Keeper가 conventional commit 형식으로 커밋한다.
- **Iterate:** Nova의 피드백을 달고 worker가 다시 투입된다.
- **Cut:** 태스크 상태가 `"failed"`로 바뀐다. 이유를 설명하는 DecisionRecord가 남는다.

---

### 3단계: Polish

필수. MVP 태스크가 전부 끝난 뒤 돌아간다.

- **Shield**가 프로젝트 보안 검토를 한다. 문제가 나오면 다음으로 넘어가기 전에 고친다.
- **Scroll**이 README와 문서를 작성한다.

---

### 4단계: Evolution

필수. 릴리스 전 마지막 단계.

- Geas가 seed의 `scope_in` 안에서 남은 작업이 있는지 본다. `scope_out`에 있는 건 거부한다.
- **Nova**가 최종 전략 요약과 추천사항을 내놓는다.
- **Keeper**가 릴리스를 만든다: 버전 올리고, changelog 쓰고, 마지막 커밋.
- `/geas:run-summary`로 세션 전체 감사 추적을 생성한다.

---

## 실전 예시: 경매 플랫폼

온라인 경매 플랫폼을 밑바닥부터 만든 세션이다. 태스크 15개, 전체 단계에 걸쳐 에이전트 약 56회 생성.

**Genesis:**
- Intake에서 범위 관련 질문 4개가 나왔다: 입찰 규칙, 결제 연동, 실시간 업데이트, 관리 도구. 결제와 관리는 scope out 처리.
- Nova가 집중된 MVP를 제안했다: 아이템 등록, 입찰, 경매 종료.
- Forge가 Node.js/PostgreSQL + REST API + React 프론트엔드 스택을 제안했다.
- 아키텍처 투표: Circuit 찬성 (관심사 분리가 깔끔), Palette 찬성 (REST가 UI 상태와 잘 맞음), Critic 찬성이되 실시간 입찰 업데이트에 SSE나 WebSocket 검토가 필요하다는 메모 첨부.
- 사용자 스토리 12개에서 TaskContract 15개가 나왔다 (스토리 3개가 여러 태스크로 쪼개짐).

**MVP Build -- US-01 (아이템 등록) 예시:**
- Implementation Contract: 계획된 작업 24개. 스키마 생성, API 엔드포인트, 이미지 업로드 처리, 빈 경매나 동시 입찰 경합 같은 엣지 케이스 6개 포함.
- Code Review rubric: `code_quality` 4/4.
- QA rubric: `core_interaction` 3/3, `feature_completeness` 4/4, `regression_safety` 4/4, `ux_clarity` 3/3, `visual_coherence` 2/3. 게이트 통과 -- `visual_coherence`가 수정 한 번 거치고 임계값 3 달성.
- Critic이 설명 필드 길이의 입력 유효성 검사 누락을 잡아냈다. Ship 판정 전에 worker가 수정.
- Nova 판정: Ship.

**전체 실행 Rubric 점수**는 1~5 분포였다. 낮은 점수의 태스크는 수정 루프를 탔고, 높은 점수는 바로 통과했다. "다 된 것 같은" 태스크 중 상당수가 첫 시도에서 semantic tier를 못 넘겼다. rubric이 실제 빈틈을 잡아낸 셈이다.

**Polish:** Shield가 관리자 관련 엔드포인트에서 인증 체크 2개가 빠진 걸 찾았다. Scroll이 문서 쓰기 전에 수정됨.

**Evolution:** Keeper가 완료 시점에 `v0.1.0` 태그를 찍었다.

---

## 세션 재개

세션이 태스크 중간에 끊기면, Geas가 끊긴 지점부터 정확히 이어간다.

`.geas/state/run.json` 체크포인트가 추적하는 것:
- `current_task_id` -- 진행 중이던 태스크
- `pipeline_step` -- 돌고 있던 단계
- `agent_in_flight` -- 실행 중이던 에이전트
- `remaining_steps` -- 아직 남은 단계의 순서 목록

재개할 때 Geas는 끊긴 단계의 증거가 이미 있는지 확인한다. 있으면 세션이 끊기기 전에 완료된 거니까 다음 단계로 넘어간다. 없으면 그 단계를 처음부터 다시 돌린다.

특별히 해야 할 건 없다. 진행 중인 `run.json`이 있는 프로젝트에서 새 세션을 열면 자동으로 재개된다.

---

## 팁

- **미션을 구체적으로 쓴다.** 모호한 미션은 범위가 넓어지고 트레이드오프가 어려워진다. 미션이 뚜렷할수록 MVP가 빠르고 단단하다.
- **Intake 질문에 성의 있게 답한다.** seed가 모든 걸 좌우한다. PRD, 사용자 스토리, TaskContract, 인수 기준이 전부 여기서 나온다. seed가 허술하면 contract도 허술하고 Evidence Gate도 힘들어진다.
- **아키텍처 투표를 꼭 읽어본다.** Circuit, Palette, Critic이 각자 다른 각도에서 평가한다. 의견이 갈리면 그게 신호다. Critic의 "찬성이긴 한데..." 메모도 읽어볼 가치가 있다.
- **파이프라인을 믿는다.** 문제를 늦게가 아니라 일찍 터뜨리려고 만든 구조다. 첫 시도에서 Evidence Gate를 못 넘는 태스크는 시스템이 제대로 작동하고 있다는 뜻이다. verify-fix loop가 돌게 두면 된다.
- **요청이 올 때 개입한다.** Geas가 사람 입력을 기다리는 시점은 intake, 아키텍처 승인, 태스크 Cut일 때다. 그 외에는 에이전트가 일하는 중이니 파이프라인 중간에 끼어들면 단계를 다시 돌려야 할 수 있다.
- **seed는 일부러 불변으로 만들었다.** 빌드 중에 미션을 바꾸고 싶다면, 그건 편집이 아니라 pivot이다. `/geas:pivot-protocol`로 DecisionRecord와 함께 깔끔하게 처리하면 된다.
