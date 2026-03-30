**[English](SKILLS.md)** | **한국어**

# skill reference

## 개요

skill은 Geas framework의 구성 요소입니다. 각 skill은 `plugin/skills/` 하위의 개별 directory에 YAML 프론트매터(`name`, `description`)가 포함된 `SKILL.md` 파일로 정의된 독립적인 명령 세트입니다.

skill은 두 가지 방식으로 호출됩니다:

1. **자동 트리거** -- Claude가 skill의 `description` field를 사용자의 자연어 입력과 대조하여 가장 적합한 skill을 자동으로 활성화합니다.
2. **명시적 호출** -- 다른 skill이나 오케스트레이터가 `/geas:<skill-name>` 구문(예: `/geas:intake`, `/geas:task-compiler`)을 사용하여 skill을 직접 호출합니다.

skill 자체는 상태를 보유하지 않습니다. 모든 런타임 상태는 `.geas/` directory(gitignored, project별)에 저장됩니다. skill은 `.geas/` 하위 directory인 `spec/`, `state/`, `tasks/`, `packets/`, `evidence/`, `decisions/`, `ledger/`, `memory/`에서 읽고 씁니다.

---

## skill 체인

사용자가 미션을 설명하면 다음 체인이 실행됩니다:

```
User input
  |
  v
mission              진입점 -- Geas 트리거
  |
  v
compass              오케스트레이터 -- 설정, intake, mode 감지
  |                  SubagentStart hook이 rules.md + agent memory를 자동 주입
  |
  +---> setup        최초 실행: 의존성, .geas/ 초기화
  |
  +---> intake       소크라테스식 질문, seed.json 생성
  |
  +---> [mode 감지]
        |
        +---> initiative     신규 제품 (Genesis -> MVP -> Polish -> Evolution)
        +---> sprint        기존 project에 범위 한정 기능 추가
        +---> debate        의사결정 전용 토론, 코드 없음
```

`initiative`과 `sprint` 내부에서는 task별로 계약 engine skill이 실행됩니다:

```
task-compiler  -->  context-packet  -->  [agent 작업]  -->  evidence-gate
                                                                |
                                                          통과? |
                                                          아니오 --+--> verify-fix-loop --> 재검증
                                                          예 --+--> 완료 (다음 task)
```

---

## 카테고리별 skill

### 진입

| skill | 설명 | 호출 방식 | 입력 | 출력 |
|-------|------|-----------|------|------|
| [mission](#mission) | Geas 멀티 agent 팀을 활성화하는 진입점 | 사용자가 제품 아이디어, project 목표, 기능 요청 또는 구조화된 토론을 설명하면 자동 트리거 | 사용자의 자연어 요청 | `compass`에 위임 |

### orchestration

| skill | 설명 | 호출 방식 | 입력 | 출력 |
|-------|------|-----------|------|------|
| [compass](#compass) | 멀티 agent 팀 전체를 조율 -- 설정, intake, mode 감지, 위임 관리 | `mission`이 `/geas:compass`를 통해 호출 | `.geas/state/run.json` (재개 시) | `initiative`, `sprint`, 또는 `debate`에 위임 |

### 코어 (Contract Engine)

| skill | 설명 | 호출 방식 | 입력 | 출력 |
|-------|------|-----------|------|------|
| [intake](#intake) | 소크라테스식 요구사항 수집 -- 숨겨진 가정을 드러내고 seed 스펙을 확정 | `compass`가 `/geas:intake`를 통해 호출 | 사용자의 미션 문자열 | `.geas/spec/seed.json` |
| [task-compiler](#task-compiler) | 사용자 story를 검증 가능한 수락 기준이 포함된 TaskContract로 컴파일 | initiative 또는 sprint 중 `compass`가 호출 | Seed 스펙, architecture context, 사용자 story | `.geas/tasks/{id}.json` |
| [context-packet](#context-packet) | worker agent를 위한 역할 맞춤형 briefing 생성 | worker 디스패치 전 `compass`가 호출 | TaskContract, 이전 에비던스, seed 스펙 | `.geas/packets/{task-id}/{worker}.md` |
| [evidence-gate](#evidence-gate) | TaskContract 대비 출력을 평가하는 3단계 품질 gate | EvidenceBundle 수집 후 `compass`가 호출 | EvidenceBundle, TaskContract, gate level | `.geas/evidence/`에 gate 판정 (pass/fail/iterate) |
| [verify-fix-loop](#verify-fix-loop) | Evidence Gate 실패 후 제한된 수정-검증 내부 loop | gate 실패 시 `compass`(또는 evidence-gate)가 호출 | 실패한 EvidenceBundle, TaskContract, gate 판정 | 수정된 에비던스 또는 escalation DecisionRecord |
| [vote-round](#vote-round) | 주요 제안에 대한 구조화된 agent 투표 및 토론 | architecture/설계 제안 후 `compass`가 호출 | 제안(예: Forge의 architecture), 투표자 목록 | 투표 결과 요약; 의견 불일치 시 DecisionRecord |

### 팀 (실행 protocol)

| skill | 설명 | 호출 방식 | 입력 | 출력 |
|-------|------|-----------|------|------|
| [initiative](#initiative) | 4단계 신규 제품 build: Genesis, MVP, Polish, Evolution. Critic이 모든 vote round에 참여하고 출시 전 review 수행. Keeper가 Resolve/Evolution에서 commit | `compass`가 호출하거나 `/geas:initiative`으로 명시 호출 | intake의 seed 스펙 | 에비던스 트레일이 포함된 완성된 project |
| [sprint](#sprint) | 단일 기능 pipeline: Design, Build, Review, QA, Retrospective. Keeper가 Resolve에서 commit | `compass`가 호출하거나 `/geas:sprint`로 명시 호출 | seed 스펙, 기존 codebase convention | 에비던스 트레일이 포함된 배포된 기능 |
| [debate](#debate) | 의사결정을 위한 멀티 agent 구조화 토론, 코드 생성 없음 | `compass`가 호출하거나 `/geas:debate`로 명시 호출 | 2-3개 옵션으로 구성된 사용자의 질문 | `.geas/decisions/`에 DecisionRecord |

### 서피스 (협업)

| skill | 설명 | 호출 방식 | 입력 | 출력 |
|-------|------|-----------|------|------|
| [setup](#setup) | 최초 설정 -- 의존성 확인, 설정 파일 생성 | 최초 실행 시 `compass`가 `/geas:setup`을 통해 호출 | N/A | `.geas/` directory 구조, `.geas/config.json`, `.geas/rules.md` |

### 유틸리티

| skill | 설명 | 호출 방식 | 입력 | 출력 |
|-------|------|-----------|------|------|
| [briefing](#briefing) | 제품 건강 상태에 대한 Nova의 구조화된 상태 보고 | Nova agent skill; milestone, phase 전환 시 또는 요청 시 | 실행 상태, 이전 briefing | 상태 보고서 (콘솔) |
| [cleanup](#cleanup) | AI 슬롭, 데드 코드, convention 이탈을 탐지하는 엔트로피 scan | Forge agent skill; MVP 이후 또는 Evolution 중 | source 파일, conventions.md | 기술 부채 항목 (`.geas/debt.json`) |
| [coding-conventions](#coding-conventions) | AI 스타트업 워크스페이스를 위한 범용 코딩 표준 -- stack 무관 | 구현 시 agent가 참조 | N/A (참조 문서) | N/A (표준 정의) |
| [ledger-query](#ledger-query) | `.geas/ledger/events.jsonl`에 대한 읽기 전용 검색 | Scrum agent skill; 진단, 상태 확인 또는 history 조회 시 | query 타입 + 선택적 필터 | 서식화된 markdown 테이블 |
| [onboard](#onboard) | codebase 탐색: 구조 scan, stack 감지, architecture mapping | Sprint mode에서 기존 상태가 없을 때 자동 트리거 | project source 파일 | `.geas/memory/_project/conventions.md` |
| [pivot-protocol](#pivot-protocol) | 현재 접근 방식이 실패할 때의 전략적 방향 전환 | 반복적 실패, Nova "Cut" 판정, agent 우려 시 트리거 | 실패 context, 에비던스, 옵션 | Nova의 피벗 결정 |
| [run-summary](#run-summary) | 세션 종료 요약 생성 -- 결정사항, 완료된 이슈, agent 통계, verify-fix loop. 콘솔에 게시 | initiative Phase 4 끝 / sprint 끝에 compass가 호출, 또는 요청 시 | 실행 상태, agent 로그 | 콘솔 출력 |
| [verify](#verify) | 구조화된 검증 checklist -- BUILD, LINT, TEST, ERROR_FREE, FUNCTIONALITY. 완료 선언 전 코드 품질 확인용 | 기능 완료 선언 전 | project build/lint/test 명령어 | 항목별 판정 (PASS/FAIL) |
| [write-prd](#write-prd) | 기능 아이디어 또는 미션으로부터 PRD 작성 | Nova agent skill; initiative Genesis 1.4에서 호출 | seed 스펙, Nova vision 에비던스 | `.geas/spec/prd.md` |
| [write-stories](#write-stories) | 기능이나 미션을 수락 기준이 포함된 사용자 story로 분해 | Nova agent skill; initiative Genesis 1.4에서 호출 | PRD 또는 기능 설명 | `.geas/spec/stories.md` |

---

## skill 상세

### mission

| | |
|---|---|
| **이름** | mission |
| **카테고리** | 진입 |
| **설명** | 제품을 build하거나, 기능을 추가하거나, 기술적 의사결정을 수행합니다. 계약 기반 검증이 적용된 Geas 멀티 agent 팀을 활성화합니다. |
| **호출 시점** | 사용자가 제품 아이디어, project 목표, 기능 요청을 설명하거나 구조화된 토론을 요청하면 자동 트리거됩니다. |
| **입력** | 사용자의 자연어 요청. |
| **출력** | 직접 출력 없음. 즉시 `/geas:compass`에 위임합니다. |

---

### compass

| | |
|---|---|
| **이름** | compass |
| **카테고리** | orchestration |
| **설명** | Geas 오케스트레이터. 멀티 agent 팀을 조율합니다. 메인 세션에서 직접 실행됩니다(subagent가 아님). |
| **호출 시점** | `mission`이 호출합니다. 이것은 skill이지 agent가 아닙니다 -- subagent로 spawn되지 않습니다. |
| **입력** | 재개 감지를 위한 `.geas/state/run.json`. |
| **출력** | 시작 시퀀스 완료 후 적절한 protocol에 위임합니다. |

시작 시퀀스:
1. **환경 확인** -- `.geas/state/run.json`을 찾아 신규 실행인지 재개인지 판단합니다.
2. **Intake gate** -- `/geas:intake`를 호출하여 `seed.json`을 생성합니다.
3. **mode 감지** -- 사용자 의도에서 initiative, sprint, debate를 추론하고 해당 mode에 위임합니다.

핵심 규칙:
- subagent는 1단계 agent로 spawn됩니다(중첩 없음).
- SubagentStart hook이 모든 subagent에 `rules.md`와 agent별 memory를 자동으로 주입합니다. spawn 프롬프트에 "Read rules.md" 지시를 수동으로 추가할 필요가 없습니다.
- agent 반환 후 매번 예상 에비던스 파일의 존재를 검증합니다.
- 모든 전환을 실제 timestamp와 함께 `.geas/ledger/events.jsonl`에 기록합니다.
- 모든 git 작업(commit, branch, PR)은 Keeper가 수행합니다 -- 직접 commit하지 않습니다.
- 코드를 직접 구현하지 않습니다 -- orchestration만 수행합니다.

---

### intake

| | |
|---|---|
| **이름** | intake |
| **카테고리** | 코어 (Contract Engine) |
| **설명** | 미션 intake gate. 소크라테스식 질문을 통해 숨겨진 가정을 드러낸 후 실행 시작 전에 seed 스펙을 확정합니다. |
| **호출 시점** | 모든 실행 mode 전에 `compass`가 `/geas:intake`를 통해 호출합니다. Debate mode에서는 생략됩니다. |
| **입력** | 사용자의 원시 미션 문자열. |
| **출력** | `.geas/spec/seed.json` (`schemas/seed.schema.json` 준수). |

process:
1. 브레인스토밍 스타일로 한 번에 하나씩 질문하며, 이전 답변을 기반으로 합니다.
2. 핵심 영역(범위, 사용자, 제약 조건, 수락 기준)에 걸쳐 checklist로 완전성을 추적합니다.
3. 수락 기준(3개 이상), 범위 경계, 완전성 checklist가 포함된 `seed.json`을 생성합니다.
4. 확정 전 사용자에게 확인을 받습니다.

---

### task-compiler

| | |
|---|---|
| **이름** | task-compiler |
| **카테고리** | 코어 (Contract Engine) |
| **설명** | 사용자 story를 검증 가능한 수락 기준, 경로 경계, eval 명령어가 포함된 TaskContract(기계 판독 가능한 작업 합의서)로 컴파일합니다. |
| **호출 시점** | Initiative(Genesis에서 이슈 생성 후) 및 Sprint(기능 작업) 중 `compass`가 호출합니다. |
| **입력** | 사용자 story 또는 기능 설명, seed 스펙, architecture context, 기존 task contract. |
| **출력** | `.geas/tasks/{id}.json` (`schemas/task-contract.schema.json` 준수). |

TaskContract에 포함되는 항목:
- 순차 task ID, 제목, 목표
- 할당된 worker와 reviewer
- 금지 파일 경로
- 수락 기준 (3개 이상, 검증 가능)
- Eval 명령어 (build, lint, test)
- 재시도 예산 및 escalation 정책
- 다른 task에 대한 의존성

---

### context-packet

| | |
|---|---|
| **이름** | context-packet |
| **카테고리** | 코어 (Contract Engine) |
| **설명** | worker를 위한 역할 맞춤형 ContextPacket을 생성합니다 -- "모든 comment 읽기"를 집중적이고 관련성 높은 context만으로 대체하는 압축된 briefing입니다. |
| **호출 시점** | task에 worker를 디스패치하기 전에 `compass`가 호출합니다. |
| **입력** | TaskContract, 업스트림 worker의 이전 에비던스, seed 스펙. |
| **출력** | `.geas/packets/{task-id}/{worker-name}.md` |

worker 역할에 따라 packet 내용이 달라집니다:
- **Designer (Palette)**: 미션 context, 사용자 요구사항, UI pattern, design 제약.
- **Implementer (Pixel/Circuit)**: design 스펙, 기술 접근 방식, 금지 경로, eval 명령어.
- **Reviewer (Forge)**: 변경된 파일, architecture 결정, 수락 기준.
- **Tester (Sentinel)**: 수락 기준, eval 명령어, 기대 동작, 엣지 케이스.
- **Product (Nova)**: 기능 목표, 모든 에비던스 bundle, 미션 정합성.

각 packet은 200줄 이내로 유지해야 합니다.

---

### evidence-gate

| | |
|---|---|
| **이름** | evidence-gate |
| **카테고리** | 코어 (Contract Engine) |
| **설명** | 3단계 품질 gate. EvidenceBundle을 TaskContract 대비 평가합니다. "완료"가 "계약 이행 완료"를 의미하도록 보장합니다. |
| **호출 시점** | worker로부터 EvidenceBundle을 수집한 후 `compass`가 호출합니다. |
| **입력** | EvidenceBundle (`.geas/evidence/{task-id}/{worker}.json`), TaskContract, gate level. |
| **출력** | 단계별 결과가 포함된 gate 판정 (pass/fail/iterate). |

3단계:
| 단계 | 확인 내용 | 실행 시점 |
|------|----------|-----------|
| **Tier 1: 기계적 검증** | eval 명령어 실행 (build, lint, test). 첫 실패 시 중단. | 구현 task, QA test, 기능/phase 완료 |
| **Tier 2: 의미적 검증** | 각 수락 기준을 에비던스 대비 확인. 모두 충족해야 함. | 모든 task 타입 |
| **Tier 3: 제품 검증** | 미션 정합성과 품질에 대한 Nova의 ship/iterate/cut 판단. | 기능 완료, phase 완료, 피벗 결정 |

통과 시: TaskContract 상태 갱신, event 기록.
실패 시: 재시도 예산 확인, `/verify-fix-loop` 호출 또는 escalation.

---

### verify-fix-loop

| | |
|---|---|
| **이름** | verify-fix-loop |
| **카테고리** | 코어 (Contract Engine) |
| **설명** | 제한된 수정-검증 내부 loop. TaskContract에서 재시도 예산을 읽고, 수정자(Pixel/Circuit)를 디스패치하며, Evidence Gate를 재실행합니다. 최대 반복 횟수는 계약에서 지정(기본값 3). |
| **호출 시점** | Evidence Gate가 실패하고 재시도 횟수가 남아있을 때 호출됩니다. |
| **입력** | TaskContract (재시도 예산, escalation 정책), 실패한 EvidenceBundle, gate 판정 상세. |
| **출력** | 성공 시 갱신된 에비던스; escalation 시 DecisionRecord. |

loop:
1. 수정자를 식별합니다 (프론트엔드는 Pixel, 백엔드는 Circuit).
2. worktree 격리 환경에서 수정 전용 ContextPacket과 함께 수정자를 spawn합니다.
3. Evidence Gate를 재실행합니다 (Tier 1 + Tier 2).
4. 통과: Nova 제품 review로 이동. 실패: 다음 반복 또는 escalation.

escalation 정책: `forge-review` (기본값), `nova-decision`, `pivot`.

---

### vote-round

| | |
|---|---|
| **이름** | vote-round |
| **카테고리** | 코어 (Contract Engine) |
| **설명** | 주요 제안 이후의 구조화된 agent 투표. 의견 불일치 시 토론을 트리거합니다. |
| **호출 시점** | architecture 제안(Forge), design system 제안(Palette), 또는 횡단적 결정 후 `compass`가 호출합니다. |
| **입력** | 제안 상세, 2-3명의 투표 agent 목록(제안자는 제외). |
| **출력** | 투표 결과 요약 comment. Nova에 escalation 시 DecisionRecord. |

process:
1. 2-3명의 투표자를 spawn하여 각각 동의/반대와 근거를 게시합니다.
2. 전원 동의: 즉시 진행.
3. 반대 있음: 구조화된 토론 진입 (최대 3round). Nova가 동점을 해소합니다.

사용하지 않는 경우: 개별 기능 스펙, 기능별 기술 가이드, 단일 도메인 구현 세부사항, bug 수정.

---

### initiative

| | |
|---|---|
| **이름** | initiative |
| **카테고리** | 팀 (실행 protocol) |
| **설명** | 전체 Geas 팀으로 신규 제품을 시작합니다. 4개 phase: Genesis, MVP Build, Polish, Evolution. |
| **호출 시점** | mode가 "신규 제품 또는 광범위한 미션"일 때 `compass`가 호출하거나, `/geas:initiative`으로 명시 호출합니다. |
| **입력** | intake의 seed 스펙. |
| **출력** | 전체 phase에 걸친 에비던스 트레일이 포함된 완성된 project. |

phase:

| phase | 주요 활동 |
|--------|----------|
| **Genesis** | Seed 확인, Nova vision, PRD & 사용자 story (Nova), Forge architecture, vote round (Critic 필수 참여), story 기반 TaskContract 컴파일, MCP server 추천 |
| **MVP Build** | task별 pipeline: Design (Palette) -> Tech Guide (Forge) -> Implementation (worktree 내 worker) -> Code Review (Forge) -> Testing (Sentinel) -> Evidence Gate -> Critic 출시 전 review -> Nova 제품 review -> Ship Gate -> Retrospective (Scrum) -> Resolve (Keeper commit) |
| **Polish** | 보안 review (Shield), 문서화 (Scroll), 발견된 이슈 수정 |
| **Evolution** | seed 범위 내 개선, Nova 최종 briefing, Keeper release 관리, run-summary |

모든 task는 전체 pipeline을 거칩니다. Code Review와 Testing은 첫 번째뿐 아니라 모든 task에 필수입니다. Critic은 Nova 판정 전에 출시 전 review(step 2.7)를 수행합니다. Keeper는 Resolve에서 commit하고 Evolution에서 release 관리를 담당합니다.

---

### sprint

| | |
|---|---|
| **이름** | sprint |
| **카테고리** | 팀 (실행 protocol) |
| **설명** | 기존 project에 범위가 한정된 기능을 추가합니다. 하나의 기능, 하나의 pipeline. Genesis를 생략합니다. |
| **호출 시점** | mode가 "기존 project의 범위 한정 기능"일 때 `compass`가 호출하거나, `/geas:sprint`로 명시 호출합니다. |
| **입력** | intake의 seed 스펙, 기존 codebase convention (`.geas/memory/_project/conventions.md`). |
| **출력** | 전체 에비던스 트레일이 포함된 배포된 기능. |

pipeline: Compile TaskContract -> Design (Palette) -> Tech Guide (Forge) -> Implementation (worktree) -> Code Review (Forge) -> Testing (Sentinel) -> Evidence Gate -> Critic Pre-ship Review (Critic) -> Nova Product Review -> Ship Gate -> Retrospective (Scrum) -> Resolve (Keeper commit) -> Run Summary.

Evidence Gate 실패 시, verify-fix-loop가 원래 worker agent를 spawn하여 수정합니다(직접 코드를 수정하지 않음).

conventions.md가 없으면 먼저 Forge를 spawn하여 온보딩을 수행합니다.

---

### debate

| | |
|---|---|
| **이름** | debate |
| **카테고리** | 팀 (실행 protocol) |
| **설명** | 기술 또는 제품 의사결정을 위한 구조화된 멀티 agent 토론. 코드를 생성하지 않습니다. |
| **호출 시점** | mode가 "의사결정 전용 토론"일 때 `compass`가 호출하거나, `/geas:debate`로 명시 호출합니다. |
| **입력** | 2-3개 명확한 옵션으로 구성된 사용자의 질문. |
| **출력** | `.geas/decisions/{dec-id}.json`에 DecisionRecord. |

플로우: 질문 구성 -> 토론자 spawn (Forge, Critic, Circuit, Palette) -> 논거 종합 -> 사용자 결정 -> DecisionRecord 작성.

---

### setup

| | |
|---|---|
| **이름** | setup |
| **카테고리** | 서피스 (협업) |
| **설명** | 최초 설정 -- 의존성 확인, 설정 파일 생성. |
| **호출 시점** | 최초 실행 시 `compass`가 자동으로 호출합니다. 사용자가 직접 호출하는 경우는 일반적으로 없습니다. |
| **입력** | N/A |
| **출력** | `.geas/` directory 구조, `.geas/state/run.json`, `.geas/rules.md`, `.geas/config.json`. |

설정 단계:
1. `.geas/` 하위 directory 생성 (spec, state, tasks, packets, evidence, decisions, ledger, memory). 초기 `run.json`과 `rules.md` 작성.

---

### briefing

| | |
|---|---|
| **이름** | briefing |
| **카테고리** | 유틸리티 |
| **설명** | Nova 모닝 briefing -- 배포된 항목, 차단된 항목, 사람의 주의가 필요한 항목에 대한 구조화된 상태 보고. 60초 이내에 읽을 수 있도록 설계되었습니다. |
| **호출 시점** | milestone(Genesis/MVP/Polish 완료) 시, Evolution phase 시작 시, 명시적 요청 시. |
| **입력** | `.geas/state/run.json`, 이전 briefing. |
| **출력** | 콘솔에 출력되는 briefing. |

section: What Shipped, What's Blocked, Needs Human Attention, Product Health (미션 정합성, 품질, 속도, 사용자 가치), Next Priority.

---

### cleanup

| | |
|---|---|
| **이름** | cleanup |
| **카테고리** | 유틸리티 |
| **설명** | 엔트로피 scan -- AI 슬롭, 미사용 코드, 데드 코드, 중복, 과도한 추상화, convention 이탈을 탐지합니다. 기술 부채를 `.geas/debt.json`에 기록합니다. |
| **호출 시점** | Phase 2 (MVP) 이후, Phase 4 (Evolution) 중, 또는 명시적 요청 시. |
| **입력** | project source 파일, `.geas/memory/_project/conventions.md`. |
| **출력** | 기술 부채 항목 (`.geas/debt.json`). |

scan 카테고리: 불필요한 comment, 데드 코드, 중복, 과도한 추상화, convention 이탈, AI 보일러플레이트.

---

### coding-conventions

| | |
|---|---|
| **이름** | coding-conventions |
| **카테고리** | 유틸리티 |
| **설명** | AI 스타트업 워크스페이스를 위한 범용 코딩 표준 -- stack 무관. |
| **호출 시점** | 구현 시 agent가 참조합니다. 절차적 skill이 아닙니다. |
| **입력** | N/A (참조 문서). |
| **출력** | N/A (표준 정의). |

다루는 내용: 코드 품질, 오류 처리, 구조, git 관행, UI 표준 (해당 시).

---

### ledger-query

| | |
|---|---|
| **이름** | ledger-query |
| **카테고리** | 유틸리티 |
| **설명** | `.geas/ledger/events.jsonl`에 대한 구조화된 읽기 전용 검색. TaskContract, EvidenceBundle, DecisionRecord를 상호 참조합니다. |
| **호출 시점** | 필요 시 -- pipeline 문제 진단, 상태 보고서 생성, agent 성과 review, project history 조회. |
| **입력** | query 타입: `timeline <task-id>`, `phase <name>`, `failures`, `agent <name>`, 또는 `status`. |
| **출력** | 상호 참조된 데이터가 포함된 서식화된 markdown 테이블. |

읽기 전용. 어떤 파일도 수정하지 않습니다.

---

### onboard

| | |
|---|---|
| **이름** | onboard |
| **카테고리** | 유틸리티 |
| **설명** | codebase 탐색 protocol -- project 구조를 scan하고, stack을 감지하며, architecture를 mapping합니다. 팀이 즉시 작업할 수 있도록 convention 파일을 생성합니다. |
| **호출 시점** | Sprint mode에서 기존 `.geas/state/run.json`이나 convention 파일이 없을 때 자동 트리거됩니다. |
| **입력** | project source 파일 및 설정 파일. |
| **출력** | `.geas/memory/_project/conventions.md`, `.geas/memory/_project/state.json`. |

단계: 구조 scan (마커 파일로 stack 감지) -> architecture mapping (entry point, routing, DB, 핵심 module) -> convention 감지 (linter 설정, naming pattern, import 스타일) -> convention 파일 작성.

반복 Sprint에서 conventions.md가 이미 있으면 전체 생략됩니다.

---

### pivot-protocol

| | |
|---|---|
| **이름** | pivot-protocol |
| **카테고리** | 유틸리티 |
| **설명** | 제품 개발 중 피벗이 필요한 시점과 방법을 정의합니다. 피벗은 전략적 방향 전환이며 코드 수정이 아닙니다. |
| **호출 시점** | 반복적 test 실패(>50%), 기술적 실현 불가, 근본적 architecture 문제, Nova "Cut" 판정, 또는 agent 우려에 의해 트리거됩니다. |
| **입력** | 전체 실패 context, 에비던스, 가용 옵션. |
| **출력** | Nova의 피벗 결정 (범위 축소, 기능 제거, 접근 방식 변경, 밀어붙이기, 단순화). |

---

### run-summary

| | |
|---|---|
| **이름** | run-summary |
| **카테고리** | 유틸리티 |
| **설명** | 세션 종료 요약 생성 -- 결정사항, 완료된 이슈, agent 통계, verify-fix loop. 콘솔에 게시합니다. |
| **호출 시점** | initiative Phase 4 끝과 sprint 끝에 compass가 호출. 세션 핸드오프 전 또는 명시적 요청 시에도 호출. |
| **입력** | `.geas/state/run.json`, `.geas/memory/_project/agent-log.jsonl`. |
| **출력** | 콘솔 출력. |

---

### verify

| | |
|---|---|
| **이름** | verify |
| **카테고리** | 유틸리티 |
| **설명** | 구조화된 검증 checklist -- BUILD, LINT, TEST, ERROR_FREE, FUNCTIONALITY. 완료 선언 전 코드 품질을 확인하기 위해 호출합니다. |
| **호출 시점** | 기능 완료 선언 전. Forge 사전 검사 mode(BUILD + LINT만)에서도 사용됩니다. |
| **입력** | project build/lint/test 명령어 (conventions.md에서 가져오거나 마커 파일에서 자동 감지). |
| **출력** | 항목별 판정 (PASS/FAIL/SKIP/PENDING)과 전체 VERDICT. |

| 항목 | 확인 내용 |
|------|----------|
| BUILD | project가 오류 없이 컴파일/bundle |
| LINT | lint 위반 없음 |
| TEST | 유닛 및 통합 test 통과 |
| ERROR_FREE | 개발 server가 깨끗하게 시작, 콘솔 오류 없음 |
| FUNCTIONALITY | Playwright E2E test가 수락 기준을 커버 (Sentinel 전용) |

---

### write-prd

| | |
|---|---|
| **이름** | write-prd |
| **카테고리** | 유틸리티 |
| **설명** | 기능 아이디어 또는 미션으로부터 PRD를 작성합니다. |
| **호출 시점** | Nova agent skill. initiative Genesis 1.4에서 Nova vision 이후 호출, 또는 요청 시. |
| **입력** | seed 스펙 (`.geas/spec/seed.json`)과 Nova의 vision 에비던스. |
| **출력** | `.geas/spec/prd.md` — markdown PRD (Problem, Objective, Target Users, Scope, User Flows, Requirements, Success Metrics, Open Questions). |

---

### write-stories

| | |
|---|---|
| **이름** | write-stories |
| **카테고리** | 유틸리티 |
| **설명** | 기능이나 미션을 수락 기준이 포함된 사용자 story로 분해합니다. |
| **호출 시점** | Nova agent skill. initiative Genesis 1.4에서 PRD 작성 후 호출, 또는 요청 시. |
| **입력** | PRD (`.geas/spec/prd.md`) 또는 기능 설명. |
| **출력** | `.geas/spec/stories.md` — markdown 사용자 story. 각 story에 "As a / I want to / So that" 형식, 수락 기준 checklist, 우선순위 (P0/P1/P2), 규모 추정치 (S/M/L) 포함. story는 task-compiler (1.7단계)로 전달. |
