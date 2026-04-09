# Skills 레퍼런스

Geas는 **12개의 core skill**을 가진다. 도메인 비종속, 도구 비종속 contract engine skill로서 통제된 실행 파이프라인을 구현한다.

Skill은 `/geas:{name}`으로 호출한다. 대부분의 skill은 orchestrator가 실행 파이프라인의 일부로 호출하며, 일부는 사용자가 직접 호출할 수 있다(아래 표시). 각 skill의 상세 동작은 해당 skill의 `SKILL.md`를 참조한다.

---

## Core Skills

| Skill | 설명 | 핵심 역할 |
|-------|------|----------|
| `mission` | Orchestrator — 4-phase 실행, slot 해소 | 전체 mission 생명주기를 통해 멀티 에이전트 팀을 조율한다 |
| `intake` | Socratic 요구사항 수집 | 협업 탐색을 통해 mission spec을 확정한다 |
| `task-compiler` | Mission spec → TaskContract 변환 | 스토리를 rubric이 포함된 기계 판독 가능 작업 계약으로 컴파일한다 |
| `implementation-contract` | 구현 전 합의 | Worker가 계획을 제안하고, reviewer가 구현 시작 전에 승인한다 |
| `evidence-gate` | Tier 0/1/2 검증 | TaskContract 기준으로 worker 산출물을 객관적으로 검증한다 |
| `verify-fix-loop` | 실패 → 수정 → 재검증 | budget 소진 시 escalation이 포함된 제한 재시도 루프 |
| `vote-round` | 구조화된 투표와 의사결정 | 병렬 agent 투표; 이견 발생 시 구조화된 의사결정으로 전환한다 |
| `memorizing` | Memory 생명주기 | rules.md 갱신 + agent memory 노트 |
| `scheduling` | 병렬 task 스케줄링 | 배치 구성, lock 확인, 안전 병렬 조건 |
| `setup` | 프로젝트 초기화 및 코드베이스 탐색 | `.geas/` 런타임 디렉토리 초기화 및 프로젝트 관례 탐색 |
| `policy-managing` | Rules.md 오버라이드 | 사유, 만료일, 감사 이력이 포함된 임시 규칙 오버라이드 |
| `reporting` | 건강 신호 및 대시보드 | 8개 건강 신호, 부채/갭 요약, 세션 브리핑 |

### mission

Geas orchestrator. 도메인 비종속 slot 해소를 통해 멀티 에이전트 팀을 조율한다. setup, intake, 라우팅, 4-phase 실행 흐름(Specifying, Building, Polishing, Evolving)을 관리한다. Agent slot을 도메인 profile 기반으로 구체 타입에 해소한 뒤 스폰한다. 메인 세션에서 직접 실행되며 sub-agent가 아니다.

**호출:** `/geas:mission` (사용자 진입점)

### intake

Mission intake gate. 한 번에 하나씩 질문하며 사용자 의도를 탐색하고, 숨은 가정과 모호한 스코프를 드러내어 불변 mission spec(`spec.json`)을 확정한다. 대규모 mission은 독립적인 sub-mission으로 분해한다. 빠른 시작을 위한 "그냥 만들어" 오버라이드를 지원한다.

**호출:** 시작 시 `mission`이 호출한다.

### task-compiler

사용자 스토리를 TaskContract로 컴파일한다 — acceptance criteria, 경로 제한, eval 명령, rubric 차원이 포함된 기계 판독 가능 작업 계약이다. task 유형별로 worker와 reviewer slot을 배정한다. 프로젝트 관례에서 eval 명령을 읽으며, 없으면 설정 파일 탐지로 대체한다.

**호출:** Specifying 및 Building phase에서 `mission`이 호출한다.

### implementation-contract

구현 전 합의. Worker가 구체적인 실행 계획(`planned_actions`, `edge_cases`, `demo_steps`)을 초안하면, quality specialist와 design authority가 구현 시작 전에 검토한다. 요구사항 오해로 인한 재작업을 방지한다.

**호출:** Tech guide 이후, implementation 이전에 `mission`이 호출한다.

### evidence-gate

객관적 검증 gate. Tier 0(Precheck)은 artifact 존재 여부와 state 적격성을 확인한다. Tier 1(Mechanical)은 eval 명령을 실행한다. Tier 2(Contract + Rubric)는 acceptance criteria를 확인하고 rubric 차원 점수를 평가한다. `pass`, `fail`, `block`, `error`를 반환한다. Gate 통과 후 Closure Packet 조립, Challenger review, Final Verdict로 이어진다.

**호출:** Implementation 및 specialist review 단계 이후 `mission`이 호출한다.

### verify-fix-loop

제한된 수정-검증 내부 루프. Gate 실패 시 적합한 fixer를 스폰하고, 차단 차원이 포함된 수정 전용 context packet을 제공한다. 수정마다 evidence-gate를 재실행한다. Retry budget 소진 시 TaskContract의 escalation policy를 따른다.

**호출:** evidence-gate가 `fail`을 반환하면 `mission`이 호출한다.

### vote-round

주요 제안에 대한 구조화된 병렬 투표. 여러 agent가 독립적으로 평가하고 근거와 함께 투표한다(agree/disagree). Challenger는 항상 참여한다. 이견이 있으면 구조화된 의사결정을 거친 뒤 진행한다. 기존 `decision`과 `pivot-protocol` skill을 흡수하였다.

**사용자 호출 가능:** `/geas:vote-round`

### memorizing

Memory 생명주기 관리. `rules.md` 갱신과 agent별 노트(`memory/agents/*.md`)를 관리한다. 회고에서 memory 후보를 추출한다.

**호출:** 회고 후 및 Evolving phase에서 `mission`이 호출한다.

### scheduling

병렬 task 관리 프로토콜. 배치 구성 규칙, 파이프라인 인터리빙, 체크포인트 관리를 정의한다. 안전 병렬 조건: `scope.paths` 경로 겹침 없음, 공유 인터페이스 lock 없음, 통합 의존성 없음. Task 수준 병렬화만 지원한다.

**호출:** Building phase에서 여러 task가 ready 상태일 때 `mission`이 호출한다.

### setup

최초 프로젝트 초기화. `.geas/` 런타임 디렉토리 구조를 생성하고, 기본 규칙이 포함된 `rules.md`를 생성하며, 코드베이스 관례(스택, 빌드 명령, 아키텍처)를 탐색하여 `conventions.md`에 기록한다. 기존 `onboard` skill을 흡수하였다. 멱등 — 기존 프로젝트에서도 안전하게 실행할 수 있다.

**호출:** 최초 실행 시(`run.json`이 없을 때) `mission`이 호출한다.

### policy-managing

`.geas/rules.md` 오버라이드 관리. 사유, 만료일, 승인자를 지정하여 정식 규칙 파일을 수정하지 않고 임시 오버라이드를 적용한다. 감사를 위한 전체 오버라이드 이력을 보존한다.

**사용자 호출 가능:** `/geas:policy-managing`

### reporting

부채/갭 대시보드 및 건강 신호 계산. `health-check.json`과 마크다운 요약을 생성한다. 프로토콜 doc 10의 8개 건강 신호: gate 통과율, retry budget 사용률, 부채 심각도 롤업, 규칙 갱신율, evidence 완전성, lock 경합, 복구 빈도, 규칙 신선도. 기존 `briefing`과 `run-summary` skill을 흡수하였다.

**사용자 호출 가능:** `/geas:reporting`

---

## Skill 의존 관계

실행 파이프라인은 정해진 순서로 skill을 호출한다. 아래 다이어그램은 주요 호출 체인을 보여준다:

```
mission (orchestrator)
  |
  +-- setup               (최초 실행만)
  +-- intake               (mission spec 확정)
  +-- task-compiler         (스토리를 TaskContract로 컴파일)
  |
  +-- [task별, 파이프라인 순서]:
  |     implementation-contract  (구현 전 합의)
  |     evidence-gate       (산출물 검증)
  |       +-- verify-fix-loop  (실패 시)
  |
  +-- vote-round            (주요 제안, Specifying phase)
  +-- scheduling            (병렬 배치 구성, Building phase)
  +-- memorizing            (회고 후 + Evolving phase)
  +-- reporting             (phase 전환, 세션 종료)
  +-- policy-managing       (필요 시 규칙 오버라이드)
```

---

## 흡수 이력

Skill이 27개에서 12개로 통합되었다. 아래 표는 무엇이 병합되고 무엇이 삭제되었는지를 기록한다.

| 이전 Skill | 처리 | 비고 |
|-----------|------|------|
| `orchestrating` | `mission`으로 개명 | Orchestrator가 `mission` skill 자체가 되었다 |
| `onboard` | `setup`에 흡수 | 코드베이스 탐색은 프로젝트 초기화의 일부이다 |
| `decision` | `vote-round`에 흡수 | 구조화된 의사결정은 투표의 한 유형이다 |
| `pivot-protocol` | `vote-round`에 흡수 | Pivot은 의사결정의 한 유형이다 |
| `briefing` | `reporting`에 흡수 | 상태 브리핑은 건강 보고의 일부이다 |
| `run-summary` | `reporting`에 흡수 | 세션 요약은 건강 보고의 일부이다 |
| `verify` | 삭제 | 기계적 검사는 evidence-gate Tier 1에 흡수되었다 |
| `cleanup` | 삭제 | 부채 감지는 evidence-gate와 reporting이 처리한다 |
| `coding-conventions` | 삭제 | 관례는 `.geas/rules.md`에 존재한다 |
| `ledger-query` | 삭제 | Orchestrator가 ledger를 직접 조회한다 |
| `conformance-checking` | 삭제 | 개발 시점 도구이며 런타임 skill이 아니다 |
| `chaos-exercising` | 삭제 | 개발 시점 도구이며 런타임 skill이 아니다 |
| `mission` (기존 wrapper) | 삭제 | 기존의 얇은 셸이며, orchestrator가 `mission`을 직접 담당한다 |
| `context-packet` | `mission`에 흡수 (v4) | CLI `geas packet create`로 패킷 생성; 내용은 orchestrator가 구성한다 |
| `write-prd` | 삭제 (v4) | 미사용 스텁 -- 파이프라인에서 호출된 적 없음 |
| `write-stories` | 삭제 (v4) | 미사용 스텁 -- 파이프라인에서 호출된 적 없음 |
