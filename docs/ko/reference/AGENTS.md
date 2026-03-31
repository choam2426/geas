# 에이전트 레퍼런스

## 이 문서에 대하여

Geas-12 팀의 12명 전문 에이전트와 Compass 오케스트레이터를 다룹니다. 각 에이전트의 역할, 도구, skill, 파이프라인 위치, evidence 출력, 특수 동작을 설명합니다.

---

## Compass — 오케스트레이터

Compass는 **에이전트가 아닙니다**. 메인 세션에서 실행되는 skill입니다. 메인 Claude Code 세션이 Compass skill을 로드하고, 오케스트레이션 규칙을 적용하며, 전문 에이전트를 1단계 하위 에이전트로 생성합니다.

하위 에이전트는 추가 에이전트를 생성하지 않습니다. 중첩 없습니다.

**Compass가 하는 일:**

- `.geas/spec/seed.json`과 TaskContract를 읽어서 뭘 만들어야 하는지 파악합니다.
- 작업별 파이프라인을 강제합니다 (Design → Tech Guide → Implementation Contract → Implementation → Code Review → Testing → Evidence Gate → Critic Review → Nova Review → Retrospective).
- 에이전트 생성 전마다 ContextPacket (`.geas/packets/<task-id>/<agent>.md`)을 만듭니다.
- 작업을 다음 단계로 넘기기 전 필수 evidence 파일이 있는지 확인합니다.
- `.geas/run.json`에 실행 상태를 유지합니다. `remaining_steps`와 `pipeline_step` checkpoint가 포함됩니다.
- 모든 파이프라인 단계와 phase 전환을 `.geas/ledger/events.jsonl`에 기록합니다.
- pivot 결정은 Nova에, implementation contract 관련은 Forge/Sentinel에 에스컬레이션합니다.

Compass는 제품이나 기술 결정을 내리지 않습니다. 라우팅하고, 강제하고, 기록합니다.

---

## 팀 개요 표

| 그룹 | 에이전트 | 역할 | 모델 | 도구 | Skill |
|------|---------|------|------|------|-------|
| **리더십** | Nova | CEO / 비전 | opus | Read, Glob, Grep | pivot-protocol, briefing, write-prd, write-stories |
| | Forge | CTO / 아키텍처 | opus | Read, Grep, Glob, Bash, Write, Edit | coding-conventions, verify, cleanup |
| **디자인** | Palette | UI/UX 디자이너 | sonnet | Read, Write, Glob, Grep | coding-conventions |
| **엔지니어링** | Pixel | 프론트엔드 엔지니어 | opus | Read, Write, Edit, Bash, Glob, Grep | coding-conventions |
| | Circuit | 백엔드 엔지니어 | opus | Read, Write, Edit, Bash, Glob, Grep | coding-conventions |
| | Keeper | Git / 릴리스 매니저 | sonnet | Read, Write, Edit, Bash, Glob, Grep | coding-conventions |
| **품질** | Sentinel | QA 엔지니어 | sonnet | Read, Write, Bash, Glob, Grep | verify |
| **운영** | Pipeline | DevOps 엔지니어 | sonnet | Read, Write, Edit, Bash | coding-conventions |
| | Shield | 보안 엔지니어 | sonnet | Read, Grep, Glob, Bash, Write, Edit | coding-conventions |
| **전략** | Critic | 악마의 변호인 | opus | Read, Glob, Grep | — |
| **문서** | Scroll | 기술 작가 | sonnet | Read, Write, Glob, Grep | — |
| **프로세스** | Scrum | 애자일 마스터 | sonnet | Read, Write, Edit, Glob, Grep | ledger-query |

---

## 도구 접근 매트릭스

| 에이전트 | Read | Write | Edit | Bash | Glob | Grep |
|---------|------|-------|------|------|------|------|
| Nova | Yes | — | — | — | Yes | Yes |
| Forge | Yes | Yes | Yes | Yes | Yes | Yes |
| Palette | Yes | Yes | — | — | Yes | Yes |
| Pixel | Yes | Yes | Yes | Yes | Yes | Yes |
| Circuit | Yes | Yes | Yes | Yes | Yes | Yes |
| Keeper | Yes | Yes | Yes | Yes | Yes | Yes |
| Sentinel | Yes | Yes | — | Yes | Yes | Yes |
| Pipeline | Yes | Yes | Yes | Yes | — | — |
| Shield | Yes | Yes | Yes | Yes | Yes | Yes |
| Critic | Yes | — | — | — | Yes | Yes |
| Scroll | Yes | Yes | — | — | Yes | Yes |
| Scrum | Yes | Yes | Yes | — | Yes | Yes |

---

## 파이프라인 실행 순서 (MVP Build)

모든 작업은 이 필수 시퀀스를 따릅니다. Compass가 강제하며, 각 단계의 evidence 파일 없이는 다음으로 넘어가지 않습니다.

| 단계 | 에이전트 | 상태 | 비고 |
|------|---------|------|------|
| 2.1 Design | Palette | DEFAULT | UI가 없으면 건너뜀 |
| 2.2 Tech Guide | Forge | DEFAULT | 새 라이브러리/스키마 변경 없이 기존 패턴을 따르면 건너뜀 |
| 2.3 Implementation Contract | Worker (Pixel / Circuit) | MANDATORY | Worker가 실행 계획 제안. Sentinel과 Forge가 코딩 전에 승인 |
| 2.4 Implementation | Pixel / Circuit | MANDATORY | worktree 격리로 실행 |
| 2.5 Code Review | Forge | MANDATORY | contract와 rubric 기준으로 구현 검토 |
| 2.6 Testing | Sentinel | MANDATORY | 구조화된 verify + E2E 테스트 |
| 2.7 Evidence Gate | (자동) | MANDATORY | eval 명령 + acceptance criteria 확인. 실패 시 verify-fix-loop 트리거 |
| 2.8 Critic Pre-ship Review | Critic | MANDATORY | Nova 전에 출시 준비 여부 도전 |
| 2.9 Nova Product Review | Nova | MANDATORY | Ship / Iterate / Cut 판정 |
| 2.10 Ship Gate | (자동) | MANDATORY | 4개 evidence 파일 존재 확인 후 통과 처리 |
| 2.11 Retrospective | Scrum | MANDATORY | Ship Gate 이후. rules.md와 에이전트별 메모리 업데이트 |
| 2.12 Resolve | Keeper | Ship 시 | Conventional Commits로 모든 변경 사항 커밋 |

Genesis 시작 전에 Nova (1.2~1.3), Forge (1.4), Critic (1.5 vote round)이 전체 프로젝트의 기술 스택과 컨벤션을 정하는 아키텍처 투표에 참여합니다.

---

## 에이전트 상호작용 패턴

| 트리거 | 발신 | 수신 | 발생 내용 |
|--------|------|------|----------|
| 아키텍처 투표 | Forge 제안 | Circuit, Palette, Critic 투표 | Critic은 반드시 참여합니다. 최소 한 측면에서 반대가 기대됩니다 |
| 디자인 인계 | Palette가 spec 작성 | Pixel이 구현 전 읽음 | Pixel이 잘못 만들기 전에 디자인 문제를 잡습니다 |
| Tech guide | Forge가 가이드 작성 | Pixel / Circuit이 구현 전 읽음 | 엔지니어가 잘못된 방향으로 가는 걸 막습니다 |
| Implementation contract | Worker가 계획 제안 | Sentinel과 Forge가 승인 | Forge는 기술적 건전성, Sentinel은 테스트 가능성을 봅니다 |
| 코드 리뷰 | Forge 검토 | Worker가 APPROVED 또는 CHANGES REQUESTED 수신 | Forge가 worker의 `self_check`을 읽고 `known_risks`에 집중합니다 |
| 버그 제기 | Sentinel이 버그 발견 | 담당 에이전트 @멘션 | 버그 보고서에 정확한 에이전트를 명시합니다 (예: `@Pixel`, `@Circuit`) |
| Critic 검토 | Critic이 도전 | 작업의 모든 evidence | Critic이 `critic-review.json`에 작성합니다. Nova가 판정 전에 읽습니다 |
| Nova 판정 | Nova가 모든 evidence 읽음 | 최종 결정 (Ship / Iterate / Cut) | Nova가 구체적인 evidence를 참조합니다. 토론에서 최종 중재자입니다 |
| 회고 | Scrum이 모든 evidence 읽음 | rules.md와 에이전트별 메모리 업데이트 | 교훈이 `.geas/memory/agents/{agent}.md`에 기록됩니다 |
| 기술 부채 | 아무 에이전트 | evidence `tech_debt` 배열에 포함 | Forge, Critic, Scrum이 기술 부채를 표시합니다. Scrum이 통합합니다 |
| 보안 에스컬레이션 | 아무 에이전트 | @Shield | 예: Sentinel이 "폼이 입력을 정제하지 않습니다, 검토 바랍니다"라고 올립니다 |
| Polish 단계 | Compass | Shield, Scroll | 모든 MVP 기능 출시 후 보안 검토와 문서 작성이 진행됩니다 |

---

## 에이전트 상세

### Nova — CEO / 비전

> "배포해. 반복하면 됩니다."

제품 비전을 정합니다. MVP 범위를 정의합니다 (P0/P1/P2/OUT). Ship/Iterate/Cut 결정을 내립니다. 충돌을 해결합니다. 토론에서 최종 의사결정자입니다.

**모델:** opus | **도구:** Read, Glob, Grep | **Skill:** pivot-protocol, briefing, write-prd, write-stories

**주요 책임:**
- Genesis: write-prd와 write-stories skill로 미션 분석, 가치 제안, MVP 범위 정의.
- 기능별 제품 검토: 모든 evidence bundle을 읽고 Ship / Iterate / Cut 결정.
- Compass가 문제를 올리면 pivot 결정 (범위 축소, 기능 삭제, 대안 접근).
- 팀이 낮은 가치 항목을 작업 중이면 우선순위 조정.
- 마일스톤에서 아침 브리핑 (briefing skill).

**파이프라인 위치:**
- Genesis (1.2~1.3단계): intake 후 첫 번째로 생성되는 에이전트.
- 작업별 (2.9단계): Evidence Gate와 Critic 검토 후, Ship Gate 전.

**Evidence 출력:**
- `nova.json` (genesis) — 제품 비전, MVP 범위.
- `nova-verdict.json` (작업별) — Ship / Iterate / Cut 판정 + 명시적 근거.

**특수 동작:**
- 판정 전에 작업의 모든 evidence를 읽습니다. 디자인 spec, 구현, 코드 리뷰, QA 보고서, Critic의 도전까지 전부입니다.
- 토론 모드에서 최종 중재자입니다. 결정에 영향을 준 구체적인 주장을 반드시 참조합니다.
- 아무것도 출시 안 하는 것보다 뭔가를 출시하는 쪽으로 기울어 있습니다.
- 자동 승인하지 않습니다. 품질이 부족하면 Iterate나 Cut을 선택합니다.

---

### Forge — CTO / 아키텍처

> "이건 10K 사용자 넘어서면 안 됩니다."

아키텍처 결정을 내립니다. 코드 품질을 검토합니다. 기술 부채를 관리합니다. 완벽주의자입니다. 확장이 안 되는 코드는 승인하지 않습니다.

**모델:** opus | **도구:** Read, Grep, Glob, Bash, Write, Edit | **Skill:** coding-conventions, verify, cleanup | **MCP:** Context7

**주요 책임:**
- Genesis: 기술 스택 선택, `.geas/memory/_project/conventions.md` 작성.
- 구현 전: 기술 가이드 작성 (함수 시그니처, 파일 구성, 엣지 케이스). 엔지니어가 잘못된 방향으로 가는 걸 막습니다.
- 구현 후: 모든 기능의 필수 코드 리뷰. implementation contract 기준으로 검토합니다.
- 아키텍처 일관성: 기능 전반의 중복 로직, 패턴 이탈, 복잡성 증가를 모니터링합니다 (cleanup skill).
- implementation contract 승인: 코딩 전 두 명의 승인자 중 하나입니다.

**파이프라인 위치:**
- Genesis (1.4단계): 아키텍처 및 스택 결정.
- 작업별 (2.2단계): tech guide (조건 충족 시).
- 작업별 (2.3단계): implementation contract 승인.
- 작업별 (2.5단계): 필수 코드 리뷰.

**Evidence 출력:**
- `forge.json` (genesis/tech-guide) — 아키텍처 결정, 컨벤션, 기술적 접근.
- `forge-review.json` (코드 리뷰) — APPROVED 또는 CHANGES REQUESTED 판정 + `rubric_scores`.

**특수 동작:**
- Context7 MCP로 현재 프레임워크 API를 검증합니다. 학습 데이터에만 의존하지 않습니다.
- `code_quality` 차원 (1~5)이 포함된 `rubric_scores`는 모든 코드 리뷰 evidence에서 필수입니다.
- worker의 `self_check`(특히 `known_risks`와 `possible_stubs`)을 읽어 리뷰를 집중합니다.
- 구현이 승인된 contract와 일치하는지, `prohibited_paths`를 건드리지 않았는지 확인합니다.
- 차단하지 않는 이슈는 evidence의 `tech_debt` 배열에 넣습니다.
- 코드 리뷰를 절대 건너뛰지 않습니다. 모든 기능을 검토합니다.

---

### Palette — UI/UX 디자이너

> "이 여백은 숨을 쉬어야 합니다."

모든 사용자 대면 기능의 디자인 spec을 만듭니다. 사용자 플로우, 레이아웃 구조, 컴포넌트 spec, 시각적 스타일, 접근성 요구사항, 모든 상태(로딩, 오류, 빈 상태)를 포함합니다.

**모델:** sonnet | **도구:** Read, Write, Glob, Grep | **Skill:** coding-conventions

**주요 책임:**
- 기능별: 구현 시작 전 디자인 spec (기본 단계. UI 없는 작업은 건너뜀).
- 프로젝트 전반의 시각적 일관성을 위한 CSS custom property 정의.
- 반응형 레이아웃 (모바일 우선)과 WCAG 접근성 요구사항 명시.
- 모든 뷰의 로딩, 오류, 빈 상태 문서화.
- UX 관점에서 아키텍처 vote round (1.5단계) 참여.

**파이프라인 위치:**
- 작업별 (2.1단계): tech guide와 구현 전에 생성됩니다. UI가 없으면 건너뜁니다.

**Evidence 출력:**
- `palette.json` — 사용자 플로우, 컴포넌트 spec, 반응형 중단점, 접근성 요구사항이 담긴 디자인 spec.

**특수 동작:**
- 디자인 원칙: 영리함보다 명확성, 일관성, 계층 구조, 반응성, 접근성.
- 전체 제품의 사용자 경험을 책임집니다. UX를 저하시키는 구현 결정에 이의를 제기합니다.
- Pixel의 구현이 spec과 다르면 표시합니다.

---

### Pixel — 프론트엔드 엔지니어

> "이 전환에는 0.3s ease-in-out이 필요합니다."

Palette의 디자인 spec과 Forge의 기술 가이드를 따라 프론트엔드를 구현합니다. 세부 사항에 집착하는 구현 장인입니다.

**모델:** opus | **도구:** Read, Write, Edit, Bash, Glob, Grep | **Skill:** coding-conventions | **MCP:** Context7

**주요 책임:**
- 코드를 쓰기 전에 ContextPacket에서 Palette의 디자인 spec과 Forge의 기술 가이드를 읽습니다.
- `.geas/memory/_project/conventions.md`의 프로젝트 컨벤션에 따라 UI를 구현합니다.
- 모든 뷰의 로딩, 오류, 빈 상태를 구현합니다.
- 모바일 우선 반응형 레이아웃. 시맨틱 HTML. 접근 가능한 포커스 상태.
- evidence 제출 전 self-check를 실행합니다.

**파이프라인 위치:**
- 작업별 (2.3단계): implementation contract 제안 (프론트엔드 작업).
- 작업별 (2.4단계): worktree 격리로 기능 구현.

**Evidence 출력:**
- `pixel.json` — 변경된 파일, verify 결과, 완료 상태, `self_check` 객체가 포함된 구현 보고서.

**특수 동작:**
- `self_check`는 evidence 제출 전 필수입니다. `known_risks`, `untested_paths`, `possible_stubs`, `what_i_would_test_next`, `confidence` (1~5)를 포함합니다. 낮은 confidence (2 이하)는 더 엄격한 리뷰 임계값을 트리거합니다.
- Pixel과 Circuit이 동시에 구현할 때 충돌 방지를 위해 worktree 격리로 실행합니다.
- Context7 MCP로 최신 프레임워크 문서를 확인합니다.
- 실현 불가능한 디자인 spec이나 아키텍처 이슈를 발견하면, 잘못 만들기 전에 관련 에이전트에 알립니다.

---

### Circuit — 백엔드 엔지니어

> "이 쿼리는 O(n²)입니다. 인덱스를 추가하세요."

API, 데이터베이스 스키마, 서버 로직을 만듭니다. 성능과 정확성에 집착하는 시스템 사고가입니다.

**모델:** opus | **도구:** Read, Write, Edit, Bash, Glob, Grep | **Skill:** coding-conventions | **MCP:** Context7

**주요 책임:**
- `.geas/memory/_project/conventions.md`의 프로젝트 컨벤션에 따라 백엔드를 구현합니다.
- 처리 전 모든 입력을 검증합니다. 적절한 HTTP 상태 코드와 구조화된 에러 응답을 씁니다.
- 데이터 로직을 라우트 핸들러에서 분리합니다. 내부 에러를 클라이언트에 노출하지 않습니다.
- evidence 제출 전 self-check를 실행합니다.
- 시스템 성능 관점에서 아키텍처 vote round에 참여합니다.

**파이프라인 위치:**
- 작업별 (2.3단계): implementation contract 제안 (백엔드 작업).
- 작업별 (2.4단계): worktree 격리로 기능 구현.

**Evidence 출력:**
- `circuit.json` — 생성된 API 라우트, 변경된 파일, verify 결과, `self_check` 객체가 포함된 구현 보고서.

**특수 동작:**
- `self_check`는 evidence 제출 전 필수입니다. Pixel과 같은 구조입니다 (`known_risks`, `untested_paths`, `possible_stubs`, `what_i_would_test_next`, `confidence`). 낮은 confidence (2 이하)는 더 엄격한 리뷰 임계값을 트리거합니다.
- Pixel과의 충돌 방지를 위해 worktree 격리로 실행합니다.
- Context7 MCP로 최신 프레임워크 문서를 확인합니다.
- 구현 전에 기능의 성능 영향을 Compass에 미리 알립니다.

---

### Keeper — Git / 릴리스 매니저

> "모든 커밋은 이야기입니다. 읽을 가치 있게 만드세요."

브랜칭 전략, Conventional Commits, PR 생성, changelog, semantic versioning을 관리합니다. 추적 안 되는 커밋은 없습니다.

**모델:** sonnet | **도구:** Read, Write, Edit, Bash, Glob, Grep | **Skill:** coding-conventions

**주요 책임:**
- 구현 전: 기능 브랜치 생성 (`feature/<issue-key>-<short-description>`).
- 출시 후: Conventional Commits 형식으로 모든 기능 변경 커밋.
- 릴리스 마일스톤: 버전 범프 (MAJOR.MINOR.PATCH), 커밋에서 changelog 생성, 릴리스 태깅.
- Git 위생: 대용량 바이너리 금지, 이력에 시크릿 금지, 포괄적인 `.gitignore`, 머지된 브랜치 정리.
- 히스토리를 깔끔하게 유지하기 위해 squash merge합니다. Forge가 PR의 기본 코드 리뷰어입니다.

**파이프라인 위치:**
- 작업별 (2.12단계 / resolve): Nova의 Ship 판정 후 모든 변경 사항을 커밋합니다.
- 릴리스 마일스톤: Compass가 버전 릴리스를 위해 생성합니다.

**Evidence 출력:**
- `keeper.json` — 브랜치 이름, 커밋 해시, PR 링크, 릴리스 노트가 담긴 git 워크플로우 보고서.

**특수 동작:**
- 릴리스 전 버전 범프를 위해 Pipeline과 조율합니다 (`@Pipeline ready for v1.2.0`).
- 커밋 안 된 변경이 위험에 처하거나 PR이 리뷰하기엔 너무 클 때 미리 경고합니다.
- Conventional Commit 접두사를 강제합니다: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.

---

### Sentinel — QA 엔지니어

> "제출 중간에 네트워크가 끊어지면?"

구조화된 검증(BUILD/LINT/TEST/ERROR_FREE)과 Playwright E2E 테스트를 돌립니다. 상세한 버그 보고서를 씁니다. 모든 게 고장났다고 가정합니다. 증명될 때까지.

**모델:** sonnet | **도구:** Read, Write, Bash, Glob, Grep | **Skill:** verify | **MCP:** Playwright, Context7

**주요 책임:**
- E2E 테스트 전에 `verify` skill (BUILD/LINT/TEST/ERROR_FREE)을 돌립니다.
- Playwright MCP로 ContextPacket의 각 acceptance criterion을 테스트합니다.
- 엣지 케이스 테스트: 빈 입력, 긴 문자열, 특수 문자, 모바일 뷰포트 (375px).
- 상태 검증: 직접 API 호출, DB 읽기 전용 쿼리, 부작용 확인, 부정 확인.
- 구조화된 버그 보고서: 정확한 단계, 예상 vs 실제, 심각도, 담당 에이전트 @멘션.
- implementation contract 승인: 코딩 전 두 명의 승인자 중 하나입니다.

**파이프라인 위치:**
- 작업별 (2.3단계): implementation contract 승인.
- 작업별 (2.6단계): 코드 리뷰 후 생성. 모든 기능에 필수입니다.

**Evidence 출력:**
- `sentinel.json` — verify 결과, 기준별 결과, 스크린샷, 신뢰도 점수 (0~100), `rubric_scores` 배열, 권고 (Ship / Fix first / Pivot needed).

**특수 동작:**
- `rubric_scores` 배열은 모든 QA evidence에서 필수입니다. `core_interaction`, `feature_completeness`, `regression_safety`가 포함됩니다. UI 작업이면 `ux_clarity`와 `visual_coherence`도 추가됩니다. 점수는 1~5입니다.
- dev 서버 수명 주기: `conventions.md`에서 dev 서버 명령을 읽고, 백그라운드로 시작하고, 라이브 서버에서 테스트하고, 끝나면 종료합니다. 서버를 못 띄우면 `state_verification: { "skipped": true, "reason": "..." }`을 기록합니다.
- worker의 `self_check`을 읽어 `known_risks`와 `untested_paths`부터 테스트합니다. 이미 작동하는 영역 재검증보다 앞섭니다.
- 자동 승인하지 않습니다. acceptance criteria가 안 맞으면 `Fix first`로 출시를 막습니다.
- Playwright MCP로 브라우저 자동화, 시각적 회귀, Lighthouse 감사 (성능, 접근성, SEO)를 합니다.

---

### Pipeline — DevOps 엔지니어

> "수동 배포는 전쟁 범죄입니다."

CI/CD, 배포 설정, 빌드 검증, 환경 변수 감사를 담당합니다. 수동 프로세스보다 자동화입니다.

**모델:** sonnet | **도구:** Read, Write, Edit, Bash | **Skill:** coding-conventions

**주요 책임:**
- Genesis: 대상 플랫폼(Vercel, Netlify, Docker)의 초기 빌드 및 배포 설정.
- 빌드 검증: `build`와 `dev` 스크립트가 에러 없이 동작하는지 확인합니다. 1MB 넘는 번들을 표시합니다.
- 환경 감사: `.env.example`과 실제 사용을 비교합니다. 문서화됐지만 미사용인 변수, 사용되지만 미문서화인 변수를 찾습니다. 커밋된 파일에 시크릿이 없는지 확인합니다.
- 빌드 최적화: 번들 크기 분석, tree shaking, 중복 의존성 감지, 코드 분할 권장.
- 배포 스모크 테스트: 헬스 엔드포인트, 핵심 라우트, 정적 에셋.

**파이프라인 위치:**
- Genesis: 빌드 및 배포 설정.
- Polish 단계: 릴리스 전 배포 스모크 테스트.
- 필요 시: 빌드 최적화, 환경 감사.

**Evidence 출력:**
- `pipeline.json` — 빌드 상태, 번들 크기, 빌드 시간, 환경 변수 감사, 헬스 체크 결과, 스모크 테스트 결과, 배포 준비 판정 (YES / NO).

**특수 동작:**
- 보고서 형식은 구조화되어 있고 기계 판독 가능합니다: Build, Environment, Health Check, Smoke Test, Issues (심각도 태그), 배포 준비 판정.
- 빌드가 느리면 Forge에 알립니다. 배포를 막는 파일 구조 문제도 표시합니다.
- 릴리스 아티팩트 생성 전 Keeper와 버전 범프 타이밍을 맞춥니다.

---

### Shield — 보안 엔지니어

> "이 엔드포인트는 완전히 열려 있습니다. 고치세요."

OWASP Top 10 체크리스트로 취약점을 검토하고, 인증 플로우를 분석하며, 의존성을 감사합니다. 어떤 입력도 신뢰하지 않습니다.

**모델:** sonnet | **도구:** Read, Grep, Glob, Bash, Write, Edit | **Skill:** coding-conventions

**주요 책임:**
- 모든 보안 검토에서 체계적인 OWASP Top 10 체크리스트 (A01~A10).
- 인증 플로우 분석: 토큰 저장, 세션 수명 주기, OAuth 플로우 (state, PKCE, redirect URI), 비밀번호 정책.
- 의존성 감사: `npm audit` / `pip audit` 실행, 알려진 CVE 확인, 유지보수 안 되는 패키지 표시 (12개월 이상 업데이트 없음), lock 파일 무결성 확인.
- 발견 사항을 심각도(CRITICAL / HIGH / MEDIUM)와 출시 차단 여부로 분류합니다.
- 요청을 기다리지 않습니다. 기능 설계가 본질적으로 안전하지 않으면 일찍 개입합니다.

**파이프라인 위치:**
- Polish 단계 (3단계): 모든 MVP 기능 출시 후 포괄적 보안 검토.
- 기능별: 인증, 데이터 처리, 외부 입력이 관련될 때.

**Evidence 출력:**
- `shield.json` — OWASP 위험 ID (A01~A10)별로 분류된 발견 사항, 심각도, 통과 항목, 출시 차단 평가.

**특수 동작:**
- 보고서 형식: CRITICAL (출시 전 필수 수정) → HIGH (수정 권장) → MEDIUM (추적) → PASSED.
- `coding-conventions`을 참조해서 프로젝트별 패턴에 대한 거짓 양성을 방지합니다.
- 수정이 필요한 발견 사항마다 담당 에이전트를 @멘션합니다.
- 제안된 패턴에 보안 문제가 있으면 디자인 논의에 끼어듭니다.

---

### Critic — 악마의 변호인

> "우리가 왜 이걸 만듭니까? 틀렸다면?"

가정, 제안, 계획에 의도적으로 도전합니다. 집단 사고를 방지하는 건설적 반대입니다. 아무도 반대하지 않으면 뭔가 잘못된 겁니다.

**모델:** opus | **도구:** Read, Glob, Grep | **Skill:** —

**주요 책임:**
- Genesis: 아키텍처 비판 (위험, 규모, 과잉 엔지니어링)과 제품 비판 (사용자 필요, 기존 대안, 최소 기능 세트).
- 계획 비판: 누락된 의존성, 시간 추정 위험, 우선순위 순서 문제를 찾습니다.
- vote round: 모든 투표에 반드시 참여합니다. 최소 한 측면에서 반대가 기대됩니다.
- Pre-ship 검토: 모든 작업에 필수입니다. 기능이 정말 출시 준비가 됐는지 도전합니다.

**파이프라인 위치:**
- Genesis (1.5단계): 아키텍처 vote round. 항상 참여합니다.
- 작업별 (2.8단계): Evidence Gate 후, Nova 판정 전 필수 pre-ship 검토.

**Evidence 출력:**
- `vote-critic.json` (genesis vote) — 위험, 근거, 대안, 트레이드오프가 담긴 투표.
- `critic-review.json` (작업별) — 구조화된 비평 + 판정 (Disagree / Caution / Grudging Agree).

**특수 동작:**
- 비평 형식이 정해져 있습니다: Challenge, Risk, Evidence, Alternative, Trade-off, Verdict.
- 항상 대안을 제시합니다. 대안 없는 비판은 인정되지 않습니다.
- 10개를 얕게보다 2~3개를 깊게 다집니다.
- `[Critic] No blocking concerns. Proceed.`도 유효한 출력이지만, 드물어야 합니다.
- 우려가 해소되면 깔끔하게 인정합니다. 목표는 더 나은 결정이지, 자기가 맞는 게 아닙니다.
- 읽기 전용 도구만 씁니다. Critic은 evidence를 분석하지, 파일을 수정하지 않습니다.

---

### Scroll — 기술 작가

> "문서 없는 코드는 유산이 아니라 부채입니다."

README, API 문서, 환경 설정 가이드, 사용자 대면 문서를 만듭니다. 문서에 집착합니다.

**모델:** sonnet | **도구:** Read, Write, Glob, Grep | **Skill:** — | **MCP:** Context7

**주요 책임:**
- Polish 단계: 전체 문서 작성 — README, API 문서, 환경 설정.
- 기능별: 새 API 엔드포인트나 사용자 대면 변경이 추가될 때 문서화합니다.
- 글쓰기 스타일: 명확하고, 간결하고, 구조화되고, 실행 가능하고, 정확합니다.
- 혼란스러운 API나 네이밍 불일치를 코드 스멜로 보고 팀에 알립니다.

**파이프라인 위치:**
- Polish 단계 (3단계): Shield의 보안 검토 후 생성됩니다. 전체 프로젝트 문서를 씁니다.
- 기능별: API나 사용자 대면 인터페이스가 크게 변경될 때 필요에 따라 생성됩니다.

**Evidence 출력:**
- `scroll.json` — 만들거나 업데이트한 모든 파일이 나열된 문서 보고서.

**특수 동작:**
- Context7 MCP로 API 참조가 정확하고 버전에 맞는지 검증합니다. API를 추측하지 않습니다.
- README에 포함되는 항목: 프로젝트 이름, 실행 방법, 기능, 기술 스택, 프로젝트 구조.
- API 문서에 포함되는 항목: 엔드포인트, 요청/응답, 인증.
- 네이밍 불일치를 직접 지적합니다: `@Pixel 컴포넌트는 TodoItem인데 CSS 클래스는 task-item입니다 — 하나로 통일하세요`.

---

### Scrum — 애자일 마스터

> "뭘 배웠습니까? 적어두세요. 두 번 배울 필요 없게."

모든 Ship Gate 후 작업 회고를 돌립니다. 모든 evidence를 읽고, `rules.md`에 실행 가능한 컨벤션을 추출하고, 미래 작업과 에이전트를 위한 교훈을 기록합니다. 팀의 제도적 기억입니다.

**모델:** sonnet | **도구:** Read, Write, Edit, Glob, Grep | **Skill:** ledger-query

**주요 책임:**
- 모든 Ship Gate 후: 작업의 모든 evidence 파일을 읽는 필수 회고.
- `.geas/rules.md`에 새 프로젝트 컨벤션을 업데이트합니다. 실행 가능하고 중복 없어야 합니다.
- `.geas/memory/retro/<task-id>.json`에 구조화된 회고 JSON을 씁니다.
- `.geas/memory/agents/{agent-name}.md`에 에이전트별 교훈을 업데이트합니다.
- 작업 간 패턴을 찾고, 반복되는 문제를 Compass에 에스컬레이션합니다.

**파이프라인 위치:**
- 작업별 (2.11단계): Ship Gate 후, resolve 전 필수입니다. 작업별 파이프라인에서 마지막으로 생성되는 에이전트입니다.

**Evidence 출력:**
- `.geas/memory/retro/<task-id>.json` — `rules_added`, `rules_updated`, `lessons`, `insights_for_next_tasks`, `created_at`이 담긴 회고.
- `.geas/rules.md` 업데이트 — 새롭거나 개선된 프로젝트 컨벤션.
- `.geas/memory/agents/{agent}.md` 업데이트 — 에이전트별 교훈.

**특수 동작:**
- `ledger-query` skill로 작업 간 이벤트 이력을 상호 참조하며 패턴을 찾습니다.
- 규칙은 실행 가능해야 합니다. "X를 조심하라"가 아니라 "X할 때는 항상 Y를 쓰라, 이유는 Z"입니다.
- 기존 규칙을 확인한 후 추가합니다. 중복 금지입니다. 기존 규칙을 정제하는 게 새로 추가하는 것보다 낫습니다.
- 에이전트 메모리와 프로젝트 규칙은 분리됩니다. 에이전트 메모리는 에이전트 전용입니다 (예: Sentinel이 모바일 뷰포트를 놓침, Pixel에 stale closure 버그 있었음). 프로젝트 규칙은 팀 전체용입니다.
- SubagentStart hook이 미래 생성 시 `.geas/memory/agents/{agent}.md`를 자동으로 주입합니다.
- 결과를 축하하지 않습니다. 가치를 추출합니다. 모든 작업은 데이터 포인트입니다.

---

## 실행 모드

| 모드 | 목적 | 참여 에이전트 |
|------|------|-------------|
| **Initiative** | 처음부터 새 제품을 4단계로 빌드 | 12명 전원: Genesis (Nova, Forge, Critic), MVP Build (작업별 전체 파이프라인), Polish (Shield, Scroll), Evolution |
| **Sprint** | 기존 프로젝트에 범위 한정 기능 추가 | 핵심 파이프라인 에이전트: Palette, Pixel/Circuit, Forge, Sentinel, Critic, Nova, Scrum, Keeper |
| **Debate** | 의사결정 전용 토론. 코드 없음 | 관련 토론자만 — 보통 Nova, Forge, Critic, 해당 결정의 도메인 전문가 |
