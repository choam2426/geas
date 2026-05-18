# Skills

## 목적

이 문서는 Geas Skill 체계의 기준 문서다. Skill의 종류, 책임 경계, 입력, 출력, runtime artifact 기록 지점, handoff 기준, resource 작성 기준을 정한다.

Geas Skill은 agent 작업을 명확한 계약, 실행, 검증 근거, 수용 판단, 회고로 이어지게 하는 반복 절차다. Skill의 목적은 agent가 산출물을 더 많이 만들게 하는 것이 아니라, User가 더 낮은 비용으로 검토하고 수용 판단할 수 있는 작업 상태를 남기는 것이다.

이 문서는 개별 `SKILL.md`의 전문을 대신하지 않는다. 각 `SKILL.md`는 이 기준을 바탕으로 자기 책임 범위의 실행 절차를 작성한다.

## 경계

이 문서는 Skill 체계와 Skill 작성 기준을 다룬다.

제외 범위:

- CLI 명령 표면 자체의 설계
- runtime artifact schema 자체의 설계
- plugin packaging 방식
- hook 구현
- 시각화 UI 구현
- 저장된 Mission이나 Task 기록 변환
- 실제 `plugins/geas/skills/` 폴더와 resource 파일 생성
- 개별 `SKILL.md` 전문 작성

## 기본 원칙

### 수용 판단 가능한 작업 상태

Skill은 User가 결과를 검토하고 수용 판단할 수 있는 상태를 만들기 위한 절차다. Skill은 계약, 검증 근거, 미검증 범위, 판단 입력, 기록 지점을 분리해 User의 수용 판단 비용을 낮춘다.

Evidence는 agent가 준비하는 검증 근거다. User Judgment는 User가 Evidence와 미검증 범위, 남은 위험을 검토한 뒤 내리는 결정이다. Evidence verdict, recommendation, Task State, Run State, CLI 성공 결과는 User Judgment의 입력이 될 수 있지만 User Judgment가 아니다.

### 독립 실행과 안전 중단

각 Skill은 자기 Skill 폴더 안의 `SKILL.md`, `references/`, `scripts/`, `assets/`만으로 실행 흐름을 이해하거나 안전하게 중단할 수 있어야 한다.

프로젝트 루트 문서는 Geas repository를 작업 대상으로 다룰 때 읽는 설계 문서다. 배포되는 Skill의 일반 실행 prerequisite으로 프로젝트 루트 문서를 요구하지 않는다.

다른 Skill 폴더의 reference는 필수 실행 경로가 아니다. Skill 사이에 정보 전달이 필요하면 caller가 handoff packet에 필요한 입력과 `read_first` 경로를 넣는다.

### Role handoff와 Evidence 작성 책임

role handoff는 Implementer, Verifier, Reviewer, Challenger처럼 role-producing Evidence나 challenge finding을 맡기는 절차다.

caller는 role이 작성하고 기록해야 하는 Evidence 본문이나 challenge finding의 substantive content를 대신 쓰지 않는다. caller가 할 수 있는 일은 role이 기록한 Evidence ref와 요약을 User briefing으로 연결하는 것이다.

role handoff 없이 Evidence 흐름을 진행할 때는 생략 이유와 남는 한계를 User briefing에 드러낸다.

이미 수용된 Evidence나 명시적 User 결정이 해당 role의 책임을 충족할 때만 role handoff를 생략한다.

role handoff에는 `read_first`를 넣는다. role이 필요한 artifact path를 읽을 수 없으면 handoff 실패로 보고, caller는 role 산출물을 대신 만들지 않는다.

Challenge finding을 반영해야 하면 해당 artifact를 책임지는 stage나 role에 revision handoff를 보낸다. caller가 직접 고치는 범위는 User가 명시적으로 맡긴 기계적 문구 정리나 포맷팅에 한정한다.

Mission Design, Pre-build Design Surface 결정, Task Contract는 `specifying`이 작성하고 조율하는 기준선 흐름이며, 이 role handoff 규칙의 대상이 아니다.

### Resource 절제

`SKILL.md` 본문은 실행 흐름, 핵심 규칙, resource navigation만 담는다. 긴 briefing shape, artifact shape, handoff packet, 예시는 `references/`로 분리한다.

반복적이고 결정적인 작업은 `scripts/`로 둔다. 출력물에 실제로 쓰이는 템플릿, 이미지, 폰트, 샘플 파일은 `assets/`로 둔다.

resource는 필요가 확인된 것만 만든다. 후보 resource는 `reference`, `script`, `asset`, `none` 중 하나로 분류하고, Skill body가 아니라 resource로 분리하는 이유를 남긴다.

## Skill 종류

| 종류 | 책임 |
| --- | --- |
| `entrypoint` | User 요청을 받아 Mission 시작, 재개, 상태 점검, 다음 절차 선택을 조율한다. |
| `stage` | Mission 안의 큰 작업 단계를 조율하고 User briefing, runtime 기록 시점, 다음 단계 전환을 준비한다. |
| `role-producing` | 특정 role 책임으로 Evidence를 기록하거나 challenge finding을 만든다. |
| `adapter` | runtime 기록이나 외부 도구 연결처럼 다른 Skill이 복사하지 않을 공통 실행 표면을 제공한다. |

## Skill 목록

| Skill | 종류 | 존재 이유 |
| --- | --- | --- |
| `mission` | `entrypoint` | Mission 시작, 재개, 상태 점검, stage 전환, User briefing을 하나의 진입점에서 조율한다. |
| `specifying` | `stage` | User 목표를 Mission Spec, Mission Design, Pre-build Design Surface, Task Contract로 검토 가능한 기준선과 실행 전 판단 표면으로 만든다. |
| `building` | `stage` | Task 실행 loop를 조율하고 Task 수용 판단 입력과 Task Evidence 기록으로 이어지게 한다. |
| `implementing` | `role-producing` | Task Contract 안에서 변경을 수행하고 Implementation Evidence를 기록한다. |
| `verifying` | `role-producing` | Task 결과를 검증하고 Verification Evidence를 기록한다. |
| `reviewing` | `role-producing` | 변경과 Evidence를 점검하고 Review Evidence를 기록한다. |
| `challenging` | `role-producing` | 숨은 가정, 범위 누수, 약한 기준, 미검증 범위, 장기 비용을 압박해 Challenger Evidence를 기록하거나 baseline challenge finding을 만든다. |
| `consolidating` | `stage` | 수용된 Task Evidence를 Mission 기준으로 종합하고 Mission 수용 판단 입력, debt 후보, memory 후보를 준비한다. |
| `geas-cli` | `adapter` | runtime artifact 기록을 CLI를 통해 수행하는 단일 write adapter를 제공한다. |

설명 전용 Skill은 기본 Skill 목록에 포함하지 않는다. 사용자가 Geas 사용법을 묻는 경우에는 일반 문서 응답으로 처리하고, 반복 사용 필요가 확인되면 별도 Skill 후보로 검토한다.

## 전체 흐름

```text
mission
  -> specifying
     -> Mission Spec
     -> Mission Design
     -> Pre-build Design Surface
     -> Task Contract

  -> building
     -> implementing
     -> verifying
     -> reviewing
     -> optional challenging
     -> Task 수용 판단 입력
     -> User Judgment
     -> Task Evidence

  -> consolidating
     -> Mission 수용 판단 입력
     -> User Judgment
     -> Debt / Memory candidates
     -> Mission Evidence
```

흐름은 User Judgment에서 끊긴다. Skill은 판단 입력을 준비하고, User는 수용, 제한부 수용, 재작업, 보류, 중단을 결정한다.

## Skill별 계약

### `mission`

`mission`은 Geas 작업의 단일 User entrypoint다.

책임:

- User 요청이 Mission 작업인지 확인하고, 모호하면 Mission으로 다룰지 User에게 묻는다.
- runtime 상태와 현재 pointer를 확인한다.
- Mission Spec, Mission Design, Task Contract, Evidence, User Judgment, Debt Ledger, Memory를 복귀 기준으로 읽는다.
- 다음 stage Skill을 선택한다.
- 진행 가능한 stage가 없거나 기준선이 불명확하면 stop condition을 드러낸다.
- User에게 현재 상태, 다음 행동, 필요한 결정을 briefing한다.
- Mission 종료가 필요하면 `consolidating`으로 연결한다.

간단 흐름:

1. User 요청과 runtime 상태를 읽는다.
2. active Mission과 current stage를 확인한다.
3. 다음 stage Skill 또는 stop condition을 고른다.
4. User에게 현재 상태와 다음 판단 지점을 brief한다.
5. stage 결과를 받아 다음 stage 또는 stop condition으로 연결한다.

경계:

- Task 구현, 검증, review, challenge output을 직접 작성하는 책임은 role-producing Skill에 둔다.
- Mission Design이나 Task Contract 작성이 필요하면 `specifying`으로 연결한다.
- User Judgment는 User 결정에서만 온다.

입력:

- User 요청
- runtime status
- 최신 Mission Spec, Mission Design, Task Contract
- 관련 Evidence와 User Judgment
- Debt Ledger와 Memory

출력:

- User-facing briefing
- stage handoff
- stop briefing

runtime artifact 기록 지점:

- Mission 시작 시 CLI 초기화와 Mission 생성을 기록한다.

handoff 경계:

- `specifying`, `building`, `consolidating`으로 stage handoff를 보낸다.
- role-producing output이 필요하면 해당 stage가 role handoff를 준비한다.

resource 계획:

| Resource | Type | 읽히는 단계 | 분리 이유 |
| --- | --- | --- | --- |
| `references/dispatch.md` | `reference` | 상태 점검, stage 선택, stop condition | dispatch 규칙은 본문에 넣기 길고 drift 처리 기준이 필요하다. |
| `references/briefings.md` | `reference` | User briefing | 대화 출력 shape는 절차 본문보다 길고 상황별 변형이 많다. |
| `scripts/` | `none` | 없음 | `mission`은 직접 결정적 계산을 수행하지 않는다. |
| `assets/` | `none` | 없음 | Mission briefing은 텍스트 출력으로 충분하다. |

### `specifying`

`specifying`은 User 목표를 Mission Spec, Mission Design, 필요한 Pre-build Design Surface, 초기 Task Contract로 이어지는 검토 가능한 기준선으로 만든다.

책임:

- User 요청의 목표, 배경, 범위, 제외 범위, 성공 기준, 제약, 위험을 이끌어낸다.
- 애매한 요구를 Baseline Candidate로 구체화한다.
- Mission Spec draft를 만들고 User review로 올린다.
- Mission Design draft를 만들고 User review로 올린다.
- Mission Design 수용 뒤 Task Contract Set 작성 전에 Pre-build Design Surface가 필요한지 판단한다.
- 필요한 경우 HTML, diagram, prototype, comparison 같은 임시 판단 표면으로 User가 구현 전 결정을 내릴 수 있게 한다.
- 초기 Task Contract Set draft를 만들고 User review로 올린다.
- User가 수용한 Mission Spec, Mission Design, 초기 Task Contract Set을 기록한다.

간단 흐름:

1. User 목표와 프로젝트 관찰 사실을 모은다.
2. 애매한 지점을 질문이나 candidate assumption으로 드러낸다.
3. Mission Spec 후보를 만들고 User review로 올린다.
4. User가 Mission Spec을 수용하면 Mission Design 후보를 만들고 User review로 올린다.
5. User가 Mission Design을 수용하면 Pre-build Design Surface 필요 여부를 판단하고, 필요한 경우 User가 비교·시각화·조작·탐색 가능한 표면에서 결정을 내리게 한다.
6. 선택된 design decision을 반영해 초기 Task Contract 후보를 만들고 User review로 올린다.
7. User가 수용한 기준선만 runtime에 기록한다.

경계:

- Mission Spec 수용은 Mission Design 수용을 뜻하지 않는다.
- Mission Design 수용은 Pre-build Design Surface 결정이나 초기 Task Contract 수용을 뜻하지 않는다.
- Pre-build Design Surface는 runtime artifact, Evidence, User Judgment가 아니며, 선택된 결정이 Task Contract Set에 반영될 때 실행 기준이 된다.
- Task 분리와 dependency는 초기 Task Contract에서 정하고, Mission Design은 Task graph의 정본이 아니다.
- implementation, verification, review, challenge Evidence는 담당하지 않는다.
- 하나의 User 응답으로 Mission Spec, Mission Design, Pre-build Design Surface 결정, 초기 Task Contract Set을 한꺼번에 수용한 것으로 처리하지 않는다.

입력:

- User 목표와 대화 맥락
- 프로젝트 관찰 사실
- 새 Mission이면 이전 기준선 없음
- 기준선 갱신이면 accepted Mission Spec, Mission Design, Task Contract
- 기준선 갱신이면 관련 Evidence와 User Judgment
- User가 명시한 결정과 위임 범위

출력:

- Baseline Candidate
- Mission Spec payload
- Mission Design payload
- Pre-build Design Surface briefing 또는 생략 사유
- 초기 Task Contract Set payload
- baseline readiness briefing
- 기록 불가 시 payload와 stop briefing

runtime artifact 기록 지점:

- User가 Mission Spec을 수용한 뒤 Mission Spec을 기록한다.
- User가 Mission Design을 수용한 뒤 Mission Design을 기록한다.
- User가 초기 Task Contract를 수용한 뒤 Task Contract를 기록한다.
- User가 building 진입을 선택한 뒤 Mission stage를 `building`으로 기록한다.

baseline challenge 경계:

- Challenge가 필요하면 `challenging`에 baseline challenge handoff를 보낸다.

resource 계획:

| Resource | Type | 읽히는 단계 | 분리 이유 |
| --- | --- | --- | --- |
| `references/intake-interview.md` | `reference` | intake와 draft 전 | 질문 흐름, readiness gate, 모호성 패턴, 질문 전환 기준은 함께 사용된다. |
| `references/mission-spec.md` | `reference` | Mission Spec 작성 | artifact shape와 작성 기준은 본문에서 분리할 만큼 상세하다. |
| `references/mission-design.md` | `reference` | Mission Design 작성 | design payload shape와 review 기준이 길다. |
| `references/pre-build-design-surface.md` | `reference` | Mission Design 수용 뒤 Task Contract 작성 전 | HTML, diagram, prototype, comparison 같은 임시 판단 표면의 trigger, 생략 조건, 결정 반영 기준이 필요하다. |
| `references/task-contract.md` | `reference` | Task Contract 작성 | Task 분리, acceptance, verification, review focus 기준이 길다. |
| `references/baseline-readiness.md` | `reference` | building 진입 전 | 기준선 완성도 점검과 User briefing shape가 반복된다. |
| `scripts/` | `none` | 없음 | intake와 기준선 작성은 판단 중심이며 결정적 계산으로 분리할 부분이 확인된 뒤 만든다. |
| `assets/` | `none` | 없음 | Pre-build Design Surface가 임시 파일을 만들 수는 있지만 Skill 공통 output asset은 필요 없다. |

### `building`

`building`은 Mission의 Task 실행 loop를 조율한다.

책임:

- 현재 Task State와 current Task Contract를 읽는다.
- Task phase에 맞는 role-producing Skill을 호출한다.
- Implementation, Verification, Review, optional Challenge 결과를 모아 Task 수용 판단 입력을 준비한다.
- User의 Task 수용 판단을 기록한다.
- Task result User Judgment가 accepted 또는 accepted_with_limits이면 Task Evidence를 기록한다.
- 다음 Task 또는 Mission consolidation 전환을 준비한다.

간단 흐름:

1. current Task Contract와 Task State를 읽는다.
2. 필요한 role-producing Skill을 호출하고 handoff packet을 전달한다.
3. role Evidence를 모아 Task 수용 판단 입력을 준비한다.
4. User의 Task 수용 판단을 기록한다.
5. accepted 또는 accepted_with_limits 판단 이후 Task Evidence를 준비하고 다음 Task 또는 `consolidating`으로 전환한다.

경계:

- 변경 작업, 검증, review, challenge finding의 substantive content는 해당 role-producing Skill이 작성한다.
- Task Contract가 바뀌어야 하면 조용히 실행 범위를 넓히지 않고 Task Contract 갱신안을 만들고 User 수용 뒤 기록한다.
- User Judgment 전에는 Task Evidence를 기록하지 않는다.
- git checkpoint는 Evidence나 User Judgment가 아니다.

입력:

- current Mission baseline
- current Task State
- current Task Contract
- role Evidence
- Task result User Judgment
- relevant Memory

출력:

- role handoff packet
- Task 수용 판단 입력
- Task Evidence ref
- 다음 Task 또는 consolidating 전환 briefing
- 기록 불가 시 stop briefing

runtime artifact 기록 지점:

- Task phase transition을 기록한다.
- role-producing Skill이 자기 Evidence를 기록하면 building은 Evidence ref를 받는다.
- Task result User Judgment를 기록한다.
- Task Evidence를 기록한다.
- Mission stage transition을 기록한다.

handoff 경계:

- `implementing`, `verifying`, `reviewing`, `challenging`을 호출할 때 handoff packet을 전달한다.
- 각 handoff packet에는 current Task Contract와 관련 Evidence를 `read_first`로 넣는다.

resource 계획:

| Resource | Type | 읽히는 단계 | 분리 이유 |
| --- | --- | --- | --- |
| `references/task-loop.md` | `reference` | Task phase 선택 | phase별 dispatch와 recovery 기준이 반복된다. |
| `references/role-handoff.md` | `reference` | role 호출 전 | handoff packet shape와 `read_first` 규칙이 공통으로 쓰인다. |
| `references/task-environment.md` | `reference` | Task 실행 전과 role handoff 전 | toolchain, verification support, runtime service, setup mutation boundary 합의가 필요하다. |
| `references/task-acceptance-input.md` | `reference` | User 판단 입력 | Evidence 요약, 미검증 범위, 선택지 briefing shape가 길다. |
| `references/task-evidence.md` | `reference` | Task 수용 판단 이후 | Task Evidence shape와 기준별 결과 표현이 반복된다. |
| `references/git-checkpoint.md` | `reference` | Task 실행 전과 checkpoint 요청 시 | worktree, branch, Task commit policy와 checkpoint 경계가 필요하다. |
| `scripts/` | `none` | 없음 | phase 선택은 runtime state와 User 결정에 묶여 있어 script보다 절차 기준이 우선이다. |
| `assets/` | `none` | 없음 | Task briefing은 텍스트 출력으로 충분하다. |

### `implementing`

`implementing`은 Task Contract 안에서 변경을 수행하고 Implementation Evidence를 기록한다.

책임:

- `read_first`에 있는 Mission baseline과 Task Contract를 읽는다.
- Task Contract 범위 안에서 변경을 수행한다.
- 변경 내역, 영향 범위, 구현 판단, self check, 한계를 정리한다.
- contract delta가 생기면 조용히 범위를 넓히지 않고 caller에게 알린다.

간단 흐름:

1. `read_first`에 있는 기준선과 Task Contract를 읽는다.
2. Task Contract 범위와 stop condition을 확인한다.
3. 계약 범위 안에서 변경을 수행한다.
4. self check와 contract delta를 정리한다.
5. Implementation Evidence를 기록하고 Evidence ref와 한계를 caller에게 반환한다.

경계:

- Verification Evidence와 Review Evidence를 작성하지 않는다.
- Task 수용 판단에 필요한 구현 측 사실, 한계, contract delta만 남긴다.
- Task Contract 밖 변경이 필요하면 contract delta로 드러낸다.

입력:

- Task Contract
- Mission Spec과 Mission Design
- 관련 prior Evidence
- handoff focus
- 작업 대상 파일이나 산출물

출력:

- 변경된 산출물
- Implementation Evidence ref
- contract delta와 미검증 범위
- handoff 실패 보고

runtime artifact 기록 지점:

- Implementation Evidence를 기록한다.

resource 계획:

| Resource | Type | 읽히는 단계 | 분리 이유 |
| --- | --- | --- | --- |
| `references/implementation-evidence.md` | `reference` | Evidence 작성 | Implementation Evidence shape와 self check 기준이 반복된다. |
| `scripts/` | `none` | 없음 | 구현 자동화는 프로젝트별 도구가 다르므로 Skill 공통 script로 두지 않는다. |
| `assets/` | `none` | 없음 | 구현 산출물은 Task 대상 repository에 생성된다. |

### `verifying`

`verifying`은 Task 결과를 agent 쪽에서 검증하고 Verification Evidence를 기록한다.

책임:

- Task Contract의 acceptance criteria와 verification checks를 읽는다.
- 실제 수행 가능한 검증을 실행한다.
- 기준별 결과, 실행 출력, 실패, blocked 상태, 미검증 범위를 남긴다.
- 검증 결과에 따라 Evidence verdict를 제시한다.

간단 흐름:

1. `read_first`에 있는 Task Contract와 Implementation Evidence를 읽는다.
2. acceptance criteria와 verification checks를 확인한다.
3. 실행 가능한 검증을 수행한다.
4. 기준별 결과와 미검증 범위를 정리한다.
5. Verification Evidence를 기록하고 Evidence ref와 미검증 범위를 caller에게 반환한다.

경계:

- 확인하지 않은 기준을 passed로 표현하지 않는다.
- Review Evidence를 작성하지 않는다.
- 검증 결과와 미검증 범위만 남기고, 수용 여부를 결정하지 않는다.

입력:

- Task Contract
- Implementation Evidence
- 변경된 산출물
- 검증 환경과 실행 가능 도구

출력:

- Verification Evidence ref
- 실행 출력 요약
- 미검증 범위와 recheck 필요 항목
- handoff 실패 보고

runtime artifact 기록 지점:

- Verification Evidence를 기록한다.

resource 계획:

| Resource | Type | 읽히는 단계 | 분리 이유 |
| --- | --- | --- | --- |
| `references/verification-evidence.md` | `reference` | Evidence 작성 | 기준별 결과, check id, output, unverified scope shape가 반복된다. |
| `scripts/` | `none` | 없음 | Evidence 구조 검증 script는 반복 오류가 확인된 뒤 만든다. |
| `assets/` | `none` | 없음 | 검증 output은 runtime artifact와 실행 출력으로 충분하다. |

### `reviewing`

`reviewing`은 변경과 Evidence를 품질, 경계, 누락, 위험 관점에서 점검한다.

책임:

- Task Contract의 review focus를 읽는다.
- Implementation Evidence와 Verification Evidence를 함께 점검한다.
- finding, 남은 위험, 점검 범위, recommendation을 근거와 함께 남긴다.
- Evidence 자체의 충분성과 미검증 범위를 점검한다.

간단 흐름:

1. `read_first`에 있는 Task Contract와 관련 Evidence를 읽는다.
2. review focus와 실제 점검 범위를 정한다.
3. 변경과 Evidence를 함께 점검한다.
4. finding, 남은 위험, 점검하지 않은 범위를 정리한다.
5. Review Evidence를 기록하고 Evidence ref와 finding 요약을 caller에게 반환한다.

경계:

- 구현 변경을 직접 수행하지 않는다.
- Verification Evidence를 대신 작성하지 않는다.
- recommendation은 review 관점의 다음 조치 제안으로만 남긴다.

입력:

- Task Contract
- Implementation Evidence
- Verification Evidence
- 변경 산출물
- review focus

출력:

- Review Evidence ref
- finding 목록
- 남은 위험과 점검하지 않은 범위
- handoff 실패 보고

runtime artifact 기록 지점:

- Review Evidence를 기록한다.

resource 계획:

| Resource | Type | 읽히는 단계 | 분리 이유 |
| --- | --- | --- | --- |
| `references/review-evidence.md` | `reference` | Evidence 작성 | finding shape, severity, coverage, recommendation 기준이 반복된다. |
| `scripts/` | `none` | 없음 | Evidence 구조 검증 script는 반복 오류가 확인된 뒤 만든다. |
| `assets/` | `none` | 없음 | review output은 Markdown Evidence로 충분하다. |

### `challenging`

`challenging`은 기준선과 Evidence가 놓친 위험을 압박한다.

책임:

- Mission baseline, Task Contract, 산출물, Evidence를 challenge focus에 따라 읽는다.
- 숨은 가정, scope boundary, verification gap, operational risk, tradeoff, repeat risk를 찾는다.
- finding이 있으면 User 수용 판단에 영향을 줄 수 있는 이유와 근거를 남긴다.
- finding이 없으면 압박한 초점과 한계를 남긴다.

간단 흐름:

1. challenge target과 `read_first` 입력을 읽는다.
2. challenge focus와 User 수용 판단에 영향을 줄 수 있는 위험 기준을 정한다.
3. 숨은 가정, scope boundary, verification gap, 장기 비용을 압박한다.
4. finding, User에게 올릴 판단 항목, 추가 점검·평가 또는 verification 필요 항목을 정리한다.
5. Task-scoped challenge는 Challenger Evidence를 기록하고, baseline challenge는 finding을 caller에게 반환한다.

경계:

- 불만 목록을 늘리는 역할이 아니라 User 판단 비용을 낮추는 위험 선별 역할이다.
- Review Evidence를 반복하지 않는다.
- Challenge finding을 반영해야 하면 해당 artifact를 책임지는 stage나 role로 돌려보낸다.

입력:

- challenge target
- Mission Spec과 Mission Design
- Task Contract
- Implementation, Verification, Review Evidence
- User가 우려한 지점

출력:

- Challenger Evidence ref 또는 baseline challenge finding
- User에게 올릴 판단 항목
- 추가 점검·평가 또는 verification 필요 항목
- handoff 실패 보고

runtime artifact 기록 지점:

- Task-scoped challenge는 Challenger Evidence를 기록한다.
- specifying-stage baseline challenge는 runtime artifact가 아니라 User briefing 입력으로 남긴다.

resource 계획:

| Resource | Type | 읽히는 단계 | 분리 이유 |
| --- | --- | --- | --- |
| `references/challenger-evidence.md` | `reference` | Task challenge Evidence 작성 | finding shape와 escalation 기준이 반복된다. |
| `references/baseline-challenge.md` | `reference` | specifying-stage challenge | runtime Evidence가 아닌 baseline finding shape가 필요하다. |
| `scripts/` | `none` | 없음 | challenge는 판단 중심이며 초기 공통 script 후보가 없다. |
| `assets/` | `none` | 없음 | challenge output은 Markdown payload로 충분하다. |

### `consolidating`

`consolidating`은 Mission 수용 판단 입력을 준비한다.

책임:

- 수용된 Task Evidence를 Mission Spec과 Mission Design에 대조한다.
- Mission acceptance criteria별 결과와 근거를 정리한다.
- gap, 수용된 Task들의 미검증 범위, 남은 위험, follow-up 후보를 드러낸다.
- Debt Ledger 후보와 Memory 후보를 준비한다.
- Mission 수용 판단 입력을 User briefing으로 올린다.
- User가 Mission 결과 수용 판단을 내리면 Mission result User Judgment를 기록한다.
- Mission result User Judgment 이후 Debt, Memory, Mission Evidence를 기록한다.

간단 흐름:

1. Mission 기준선과 수용된 Task Evidence를 읽는다.
2. Mission acceptance criteria별 결과와 근거를 대조한다.
3. gap, 수용된 Task들의 미검증 범위, 남은 위험을 정리한다.
4. Debt 후보, Memory 후보, follow-up 후보를 준비한다.
5. Mission 수용 판단 입력을 User briefing으로 올리고, User 판단 이후 필요한 기록으로 이어 간다.

경계:

- Mission result User Judgment를 대신 작성하지 않는다.
- Mission Evidence는 Mission result User Judgment 이후에 작성된다.
- Memory와 Debt 기록은 User가 수용한 후보를 기준으로 한다.

입력:

- Mission Spec
- Mission Design
- 수용된 Task Evidence
- Task result User Judgment
- relevant role Evidence
- Debt Ledger와 Memory

출력:

- Mission 수용 판단 입력
- Debt 후보
- Memory 후보
- Mission Evidence ref
- 기록 불가 시 stop briefing

runtime artifact 기록 지점:

- Mission result User Judgment를 기록한다.
- Mission result User Judgment 이후 Debt를 기록한다.
- Mission result User Judgment 이후 Memory를 기록한다.
- Debt와 Memory 반영 이후 Mission Evidence를 기록한다.

resource 계획:

| Resource | Type | 읽히는 단계 | 분리 이유 |
| --- | --- | --- | --- |
| `references/mission-acceptance-input.md` | `reference` | Mission 수용 판단 입력 | criteria별 종합과 gap 표현 shape가 길다. |
| `references/reflection-memory.md` | `reference` | User 수용 판단 이후 | Memory 후보와 Debt 후보의 경계가 반복된다. |
| `references/mission-evidence.md` | `reference` | Mission Evidence 작성 | Mission Evidence shape와 기록 순서가 반복된다. |
| `scripts/` | `none` | 없음 | criteria trace 검증 script는 반복 오류가 확인된 뒤 만든다. |
| `assets/` | `none` | 없음 | Mission 종합 output은 Markdown/YAML payload로 충분하다. |

### `geas-cli`

`geas-cli`는 runtime write adapter다.

책임:

- 다른 Skill이 runtime artifact를 기록할 때 사용할 CLI 호출 기준을 제공한다.
- readable `.md` artifact와 runtime `.yaml` data를 구분한다.
- 기록 전 payload shape, 현재 state, 기록 가능한 위치를 확인하도록 안내한다.
- CLI write 실패 시 payload와 기록 불가 상태를 보존하고 stop하도록 안내한다.

간단 흐름:

1. 기록하려는 payload와 command 목적을 받는다.
2. current runtime state와 기록 가능 조건을 확인한다.
3. CLI로 기록을 시도한다.
4. 성공 path와 state update를 반환한다.
5. 실패하면 payload를 보존하고 stop condition을 반환한다.

경계:

- CLI는 User Judgment를 만들지 않는다.
- CLI는 Evidence 본문의 충분성을 판단하지 않는다.
- CLI는 runtime artifact 내용을 대신 작성하지 않는다.
- 다른 Skill은 CLI 명령 표면을 복사해 독자 기준으로 만들지 않는다.

입력:

- 기록하려는 payload
- 기록 대상 command
- current runtime state
- CLI 실행 결과

출력:

- CLI invocation 기준
- 성공 시 기록 path와 state update 요약
- 실패 시 stop condition과 보존할 payload

runtime artifact 기록 지점:

- `geas-cli` 자체가 기록 지점을 소유하지 않는다. 다른 Skill의 기록을 안전하게 실행하는 adapter다.

resource 계획:

| Resource | Type | 읽히는 단계 | 분리 이유 |
| --- | --- | --- | --- |
| `scripts/geas` | `script` | CLI 실행 | runtime write adapter는 실행 가능한 bundled CLI가 필요할 수 있다. |
| `references/invocation.md` | `reference` | CLI 실행 전 | command 호출 형태와 실패 처리 기준이 반복된다. |
| `references/write-failure.md` | `reference` | CLI 실패 시 | payload 보존과 stop briefing 기준이 반복된다. |
| `assets/` | `none` | 없음 | CLI adapter는 output asset이 필요 없다. |

## Handoff 기준

handoff packet에는 다음 정보를 넣는다.

- role 또는 stage
- 목적
- expected output
- `read_first`
- current accepted artifact refs
- draft payload path 또는 target path
- focus
- responsibility boundary
- stop condition

Mission 안에서 실행되는 role은 존재하는 최신 accepted Mission Spec과 Mission Design을 `read_first`에 포함한다.

Task-scoped role은 current Task Contract와 관련 Evidence를 `read_first`에 포함한다.

handoff 실패 조건:

- required `read_first` path를 읽을 수 없다.
- expected output shape가 불분명하다.
- role prompt나 role-producing Skill이 unavailable하다.
- caller가 role 산출물 없이 진행할 근거를 User에게 설명할 수 없다.

## Runtime artifact 경계

| 산출물 | 성격 | 기록 기준 |
| --- | --- | --- |
| Draft | 작업 중 후보 | runtime artifact가 아니며 User review 전까지 working state로 둔다. |
| Briefing | User-facing 대화 출력 | runtime artifact가 아니며 User 결정과 Evidence를 대체하지 않는다. |
| Evidence payload | agent가 준비한 검증 근거 | 해당 role 또는 stage 책임자가 작성하고 CLI로 기록한다. |
| User Judgment payload | User 결정 원본 | User가 결정한 뒤 기록한다. |
| Runtime record | CLI가 guard한 artifact | CLI는 구조와 state guard를 수행하며 본문 의미를 대신 작성하지 않는다. |
| Debt 후보 | Mission 이후 남을 비용 후보 | User가 수용한 뒤 Debt Ledger 기록 대상으로 삼는다. |
| Memory 후보 | 반복 적용할 운영 지식 후보 | User가 수용한 뒤 Memory 기록 대상으로 삼는다. |

## Skill 작성 기준

개별 `SKILL.md`의 공통 section 계약은 `docs/skill-template.md`를 기준으로 한다.

### Frontmatter

- `name`과 `description`만 사용한다.
- `name`은 소문자, 숫자, 하이픈만 사용한다.
- `name`은 64자 이하로 둔다.
- `description`은 3인칭으로 쓴다.
- `description`에는 Skill이 하는 일과 사용할 조건을 모두 넣는다.
- `description`에는 실제 trigger 단어, workflow 단어, 파일 확장자, domain 단어를 넣는다.
- 인접 Skill과 충돌할 수 있으면 description에 boundary를 넣는다.
- `description`은 1024자 이하로 둔다.

### Body

- 명령형 절차로 쓴다.
- 본문은 500줄 이하를 목표로 한다.
- 한 개념에는 한 용어만 사용한다.
- 다단계 workflow에는 checklist를 둔다.
- 중요한 검증 작업에는 `검증 -> 수정 -> 재검증` loop를 둔다.
- 강한 제약은 반복적인 강조보다 이유와 stop condition으로 표현한다.
- Skill 문서 안의 경로는 forward slash를 사용한다.

### Progressive disclosure

- Tier 1은 frontmatter `name`과 `description`이다.
- Tier 2는 `SKILL.md` 본문이다.
- Tier 3은 필요할 때만 읽거나 실행하는 `references/`, `scripts/`, `assets/`다.
- 모든 필수 reference는 `SKILL.md`에서 직접 링크한다.
- reference chain은 한 단계로 둔다.
- 100줄이 넘는 reference에는 목차를 둔다.

### Resource 선택

| Resource | 사용 기준 |
| --- | --- |
| `references/` | domain 설명, 산출물 형식, briefing shape, handoff packet, 예시처럼 필요할 때만 읽을 문서 |
| `scripts/` | 반복적이고 결정적인 검증, 정렬, schema 확인, CLI wrapper 같은 실행 작업 |
| `assets/` | 실제 output에 쓰이는 템플릿, 이미지, 폰트, 샘플 파일 |
| `none` | Skill body와 일반 실행 도구로 충분한 경우 |

## 작성 대상 resource

이 문서에서 resource 후보로 분류한 항목은 resource 작성 단계에서 필요 여부를 다시 확인한 뒤 만든다. 후보 resource는 `SKILL.md`가 해당 resource를 직접 링크하고, 실행 흐름에서 읽히는 단계가 분명할 때 만든다.

## 만들지 않을 resource

다음 resource는 만들지 않는다.

- 예시만 담은 placeholder reference
- 모든 Skill briefing을 한 파일에 모은 mega briefing reference
- 프로젝트 루트 문서 내용을 복사한 prerequisite reference
- 다른 Skill 폴더의 reference를 필수로 읽게 하는 wrapper reference
- Skill body와 같은 내용을 반복하는 summary reference
- 실제 output에 쓰이지 않는 template asset
- runtime state만 보고 완료를 선언하는 판단 reference
- plugin packaging 전용 reference
- 시각화 UI 전용 reference

## 확정 전 결정 사항

개별 `SKILL.md` 작성 전에 다음 결정을 확정한다.

| 결정 | 선택지 | 기준 |
| --- | --- | --- |
| role prompt 배치 | stage-owned reference / role-producing Skill reference / 별도 role catalog | 각 Skill이 자기 폴더 리소스만으로 실행하거나 안전 중단할 수 있는 구조를 선택한다. |
| 설명 전용 Skill | 기본 Skill 밖에 둔다 / 별도 helper Skill로 둔다 | 반복적인 사용 안내 요청이 실제로 많아지면 helper Skill로 둔다. |
| dry-run transcript 보관 | 검토 note로만 둔다 / fixture로 둔다 | 반복 검증이 필요하고 transcript가 안정된 입력이면 fixture로 둔다. |
| shape 검증 script | 만들지 않는다 / Evidence별 script를 둔다 | agent가 같은 구조 오류를 반복하면 script로 둔다. |

## 검증 기준

`docs/skills.md`는 다음 조건을 만족해야 한다.

- 이 문서만 읽어도 Geas Skill 체계가 설명된다.
- 각 Skill의 존재 이유가 한 문장으로 설명된다.
- 각 Skill의 책임과 경계가 분리되어 있다.
- stage Skill과 role-producing workflow의 경계가 분리되어 있다.
- Skill이 프로젝트 루트 문서를 필수 실행 입력으로 요구하지 않는다는 기준이 들어 있다.
- 각 Skill의 `references/`, `scripts/`, `assets/` 계획이 포함되어 있다.
- 각 resource 후보에는 Skill body가 아니라 resource로 분리하는 이유가 적혀 있다.
- 개별 `SKILL.md` 작성 전에 확정해야 할 결정 사항이 드러난다.
- Evidence, 검증, 검토, User Judgment의 용어 경계가 유지된다.
