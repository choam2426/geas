# Runtime

## 목적

이 문서는 Geas Workflow가 남기는 runtime artifact와 `.geas/` 저장 구조를 정의한다.

Runtime artifact는 User와 agent가 같은 작업 기준, Evidence, `User Judgment`, 이어갈 맥락을 다시 읽을 수 있게 남기는 저장 산출물이다. 여기서 작업 기준은 `Mission Spec`, `Mission Plan`, Task Direction, `Task Contract`를 포함한다.

Runtime model은 다음을 정한다.

- Geas runtime에서 사용하는 artifact
- artifact의 정본 파일 형식
- artifact별 frontmatter와 Markdown section
- `.geas/` storage 구조
- Mission, Task, ledger item identifier 규칙
- artifact 참조 규칙

## 파일 형식

Markdown 형식의 artifact는 `.md` 파일로 저장한다.

기본 규칙은 다음과 같다.

- Frontmatter가 필요한 artifact는 runtime이 참조와 판단 맥락에 쓰는 metadata만 둔다.
- Markdown body는 H1 없이 `##` section부터 시작한다.
- Markdown section heading은 영어 label을 쓴다.
- 같은 의미를 frontmatter와 Markdown body에 중복 저장하지 않는다.
- artifact 위치나 파일명이 이미 표현하는 Mission id, Task id, artifact kind는 frontmatter에 반복하지 않는다.

다음 artifact는 Markdown 파일이다. 각 artifact section에서 frontmatter field를 정의하지 않으면 frontmatter를 요구하지 않는다.

- Mission Spec
- Mission Plan
- Task Contract
- Implementation Evidence
- Verification Evidence
- Review Evidence
- Challenger Evidence
- User Judgment
- Task Evidence
- Task Memory
- Mission Evidence
- Debt Ledger
- Memory
- Continuity Ledger

Task Direction은 자유 형식 산출물이다. Markdown 문서, HTML artifact, UI 시안, Mermaid diagram, 비교표, 짧은 브리핑처럼 User가 방향을 판단하기 쉬운 형식을 사용할 수 있다. Runtime은 Task Direction의 파일 형식이나 schema를 지정하지 않는다.

Task Memory, Debt Ledger, Memory, Continuity Ledger는 Markdown ledger artifact다. 파일 하나가 Runtime artifact이며, ledger item 자체는 Runtime artifact가 아니다.

## Storage 구조

Geas runtime은 project root의 `.geas/` 아래에 저장한다.

```text
.geas/
  debts.md
  continuity.md
  memory/
    common.md
    roles/
      orchestrator.md
      implementer.md
      verifier.md
      reviewer.md
      challenger.md
  missions/
    <mission-id>/
      mission-spec-001.md
      mission-plan-001.md
      mission-evidence.md
      task-memory.md
      user-judgment-001.md
      tasks/
        <task-id>/
          directions/
          task-contract-001.md
          implementation-evidence-001.md
          verification-evidence-001.md
          review-evidence-001.md
          challenger-evidence-001.md
          task-evidence.md
          user-judgment-001.md
```

## Artifact Formats

### Mission Spec

Mission Spec은 User의 핵심 의도와 Mission 결과를 판단할 기준을 남긴다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`name`|string|Mission을 식별할 수 있는 짧은 이름|

Markdown body에는 다음 section을 둔다.

|Section|내용|
|---|---|
|`Goal`|User가 이루려는 목표|
|`Background`|이 Mission이 필요한 이유|
|`Scope`|이번 Mission이 맡는 일과 제외하는 일. 하위 section `Included`, `Excluded`로 나눈다.|
|`Acceptance Criteria`|Mission 결과를 판단할 구체 기준. 각 기준은 `AC-001:` 같은 안정적인 식별자로 시작한다.|
|`Constraints`|Mission 안에서 지켜야 하는 조건|
|`Assumptions`|User 요청을 해석할 때 둔 전제|
|`Risks`|Mission을 실행하거나 수용 판단할 때 의식해야 할 위험|

Acceptance Criteria 식별자는 Task Contract, Task Evidence, Mission Evidence가 Mission 기준별 결과와 근거를 추적하기 위한 참조 label이다. 식별자는 기준의 의미가 유지되는 동안 그대로 둔다.

### Mission Plan

Mission Plan은 `Mission Spec`을 실제 Task 흐름으로 옮기는 진행 맥락이다.

Mission Plan은 frontmatter field를 요구하지 않는다.

Markdown body에는 다음 section을 둔다.

|Section|내용|
|---|---|
|`Plan Summary`|Mission을 어떤 흐름으로 진행할지 한눈에 잡는 요약|
|`Approach`|선택한 접근 방식과 이유|
|`Key Context`|Task 진행 중 계속 참고해야 할 User 의도, 도메인 맥락, 제약, 선행 결정|
|`Impact Surface`|관련 파일, 문서, 모듈, UI 흐름, 데이터, 의존 관계, side effect 가능 범위|
|`Task Structure`|Mission을 User가 검토 가능한 Task 단위로 나누고, 각 Task가 어떤 `Mission Spec` 기준에 기여하는지 연결한 구조|
|`Validation And Review Strategy`|필요한 검증, review, challenge, 수동 확인 근거에 대한 전략|
|`User Decision Points`|어느 시점에 User 판단으로 돌아와야 하는지와 그때 무엇을 보고 판단할지|
|`Risks And Mitigations`|불확실성, side effect, 누락 위험, 장기 비용과 대응 방식|
|`Change Triggers`|`Mission Spec`, `Mission Plan`, `Task Contract`를 다시 봐야 하는 조건|
|`Continuity Requirements`|다음 Task, 다음 세션, 다른 agent 도구가 이어받아야 할 상태, 결정, 열린 질문, 반복 위험|

Mission Plan은 Task들이 같은 `Mission Spec`과 맥락을 공유한 채 이어지도록 잡아 준다. 개별 Task의 실행 계약은 `Task Contract`에 둔다.

### Task Direction

`Task Direction`은 Task를 실행하기 전에 User 선택이 필요한 방향을 먼저 고정하는 자유 형식 산출물이다.

Runtime은 `Task Direction`의 frontmatter, Markdown section, schema를 정의하지 않는다. `Task Direction`은 Task scope 안의 `directions/` 디렉터리에 저장한다.

```text
.geas/missions/<mission-id>/tasks/<task-id>/directions/
```

`Task Direction`은 User가 방향을 판단하기 쉬운 형식을 우선한다. Markdown 문서, HTML artifact, UI 시안, Mermaid diagram, 비교표, 짧은 브리핑을 사용할 수 있다.

`Task Direction`은 `Task Contract`를 대체하지 않는다. `Task Direction`은 어떤 방향으로 갈지 정하고, `Task Contract`는 그 방향을 실행 가능한 경계와 수용 기준으로 고정한다.

`Task Contract`가 수용된 `Task Direction`을 기준으로 삼으면 `task_direction_ref`에 `directions/` 아래의 상대 경로를 남긴다.

### Task Contract

`Task Contract`는 개별 Task의 실행 경계와 수용 판단 기준을 남긴다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`task_direction_ref`|string|수용된 `Task Direction` 산출물 참조. Task Direction을 쓰지 않았으면 `""`|
|`mission_acceptance_refs`|list of string|이 Task가 담당하는 `Mission Spec` Acceptance Criteria 식별자|
|`depends_on`|list of string|이 Task를 시작하기 전에 수용되어야 하는 Task id|
|`risk_level`|string|`low`, `medium`, `high` 중 하나|

Markdown body에는 다음 section을 둔다.

|Section|내용|
|---|---|
|`Task Summary`|Task가 달성하려는 상태를 짧게 고정한다.|
|`Mission Relation`|`Mission Spec` 기준과 `Mission Plan`의 Task Structure를 연결한다.|
|`Starting Context`|수용된 선행 Task, 기준 산출물, 필요한 입력, 먼저 읽고 확인해야 할 파일, 문서, 테스트, 실행 흐름|
|`Scope`|이번 Task에서 포함하는 범위와 제외하는 범위. 하위 section `In`, `Out`으로 나눈다.|
|`Deliverables`|Task가 끝났을 때 남아야 하는 산출물|
|`Impact Surface`|변경이 닿을 파일, 문서, UI 흐름, 데이터, 의존 관계, side effect 가능 범위|
|`Acceptance Criteria`|Task 결과를 판단할 기준. 각 기준은 `TC-AC-001:` 같은 안정적인 식별자로 시작한다.|
|`Execution Guardrails`|지켜야 할 구현 경계, 기존 스타일, 건드리지 않을 영역, 관련 없는 리팩터링 금지|
|`Verification Strategy`|어떤 테스트, 실행 확인, 수동 확인, regression 확인을 할지|
|`Review And Challenge Focus`|review와 User 검토에서 봐야 할 품질, 경계, 사용자 영향, edge case, 유지보수 위험, challenge 조건|
|`Assumptions`|Task 실행 계약이 의존하는 전제|
|`Risks`|Task를 실행하거나 수용 판단할 때 의식해야 할 위험|
|`Change Triggers`|Task Direction, `Task Contract`, `Mission Plan`, `Mission Spec`을 다시 봐야 하는 조건|

`risk_level`은 구체 위험 목록을 대체하지 않는다. `low`는 좁고 되돌리기 쉬운 변경, `medium`은 일반적인 verification과 review가 필요한 변경, `high`는 실패 비용이 크거나 사용자, 운영, 데이터, 보안, 배포, 외부 동작에 큰 영향을 줄 수 있는 변경을 뜻한다.

`Task Contract`의 Acceptance Criteria 식별자는 `Mission Spec`의 Acceptance Criteria와 구분하기 위해 `TC-AC-001:` 형식을 쓴다. 식별자는 기준의 의미가 유지되는 동안 그대로 둔다.

### Implementation Evidence

`Implementation Evidence`는 Implementer가 `Task Contract` 안에서 실제로 수행한 작업과 구현 맥락을 남긴다.

Markdown body에는 다음 section을 둔다.

|Section|내용|
|---|---|
|`Summary`|수행한 작업을 독립적으로 이해할 수 있게 요약|
|`Changed Outputs`|변경 또는 생성한 파일, 문서, 코드, 산출물 참조|
|`Affected Scope`|작업 결과가 영향을 준 기능, 문서 영역, 개념, 사용자 흐름|
|`Implementation Decisions`|작업 중 내린 중요한 구현 판단과 그 이유|
|`Assumptions`|구현 중 의존한 전제|
|`Contract Deltas`|`Task Contract`와 달라졌거나 갱신이 필요한 지점|
|`Self Checks`|Implementer가 산출물을 넘기기 전에 직접 확인한 범위와 결과|
|`Limits`|확인하지 못한 범위, 알려진 한계, 남은 불확실성|
|`Reflection Candidates`|`Task Memory`, Memory, `Debt Ledger`, `Continuity Ledger` 후보로 검토할 신호|

`Implementation Evidence`는 변경 결과만 나열하지 않고 왜 그렇게 했는지, 무엇이 바뀌었는지, 어디까지 직접 확인했는지, 무엇이 한계로 남는지 함께 남긴다.

`Implementation Evidence`는 verdict를 갖지 않는다. Implementer의 self check는 독립적인 `Verification Evidence`나 `Review Evidence`를 대체하지 않는다.

### Verification Evidence

`Verification Evidence`는 Verifier가 `Task Contract`의 Acceptance Criteria와 Verification Strategy에 따라 실제로 확인한 결과를 남긴다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`verdict`|string|`passed`, `changes_requested`, `escalated` 중 하나|

Markdown body에는 다음 section을 둔다.

|Section|내용|
|---|---|
|`Summary`|검증 결과와 주요 한계를 짧게 요약|
|`Environment`|검증이 수행된 환경, 도구, 버전, 실행 조건|
|`Target`|실제로 확인한 artifact, 파일, 기능, 출력, 변경 범위|
|`Checks Performed`|수행한 테스트, 실행, 검색, 비교, 출력 확인 항목. 각 check는 `VC-001:` 같은 식별자로 시작한다.|
|`Criteria Results`|`Task Contract` 기준별 결과, 연결된 check, 근거|
|`Outputs`|User가 다시 검토할 실행 출력, 테스트 결과, 비교 결과, artifact 참조|
|`Deviations`|`Task Contract`, 수용된 방향, 예상 결과와 달라진 점|
|`Unverified Scope`|확인하지 못한 범위와 이유|
|`Recheck Needed`|보정 또는 재검증이 필요한 항목|
|`Reflection Candidates`|`Task Memory`, Memory, `Debt Ledger`, `Continuity Ledger` 후보로 검토할 신호|

Criteria Results는 `Task Contract`의 `TC-AC-001:` 같은 기준별로 `Result`, `Checks`, `Evidence refs`, `Unverified scope`, `Remaining risks`를 드러낸다. Result 값은 `passed`, `failed`, `partial`, `not_checked`, `blocked` 중 하나다.

`Verification Evidence`에서 미검증 범위는 실패와 구분한다. 실패는 확인한 결과가 기준을 만족하지 못한 것이고, 미검증 범위는 확인하지 못해 판단 근거가 없는 것이다.

`Verdict`는 Verification Evidence, Review Evidence, Challenger Evidence에서 쓰는 agent 측 결론이다. 값은 `passed`, `changes_requested`, `escalated` 중 하나다. 필수 확인이 수행되지 않았거나 기준별 미검증 범위가 남아 있으면 `passed`로 표현하지 않는다. `Verdict`는 `User Judgment`가 아니다.

### Review Evidence

`Review Evidence`는 Reviewer가 Task 결과와 관련 Evidence를 품질, 경계, 누락, 사용자 영향, 유지보수 위험, Evidence 충분성 관점에서 점검한 결과를 남긴다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`verdict`|string|`passed`, `changes_requested`, `escalated` 중 하나|

Markdown body에는 다음 section을 둔다.

|Section|내용|
|---|---|
|`Summary`|Review 결과와 주요 한계를 짧게 요약|
|`Target`|실제로 점검한 산출물, 변경, `Implementation Evidence`, `Verification Evidence`|
|`Review Focus Used`|`Task Contract`의 Review And Challenge Focus 중 실제로 사용한 점검 초점|
|`Review Coverage`|점검한 범위와 점검하지 않은 범위. 하위 section `Covered`, `Not Covered`로 나눈다.|
|`Review Methods`|리뷰를 수행한 방식, 비교 기준, 읽은 순서, 확인 방법|
|`Findings`|User가 수용 판단 전에 봐야 할 Review finding|
|`Remaining Risks`|Review 이후에도 남아 있는 위험과 판단상 주의점|
|`Overall Recommendation`|Review 결과 기준으로 권장되는 다음 조치 요약|
|`Reflection Candidates`|`Task Memory`, Memory, `Debt Ledger`, `Continuity Ledger` 후보로 검토할 신호|

Findings는 `RV-001:` 같은 식별자를 heading으로 두고 `Finding`, `Severity`, `Category`, `Affected refs`, `Basis`, `Recommendation`을 드러낸다. finding이 없으면 `없음.`을 남긴다.

Overall Recommendation은 `User Judgment`가 아니다. Reviewer가 Evidence를 기준으로 제안하는 다음 조치다.

### Challenger Evidence

`Challenger Evidence`는 `Task Contract`, 산출물, Evidence를 압박해 놓치기 쉬운 위험을 드러낸다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`verdict`|string|`passed`, `changes_requested`, `escalated` 중 하나|

Markdown body에는 다음 section을 둔다.

|Section|내용|
|---|---|
|`Target`|압박한 `Task Contract`, 산출물, Evidence|
|`Challenge Focus`|숨은 가정, scope 경계, 검증 공백, 장기 비용 등 압박한 관점|
|`Challenge Methods`|trace check, assumption challenge, failure-mode scan처럼 사용한 압박 방법|
|`Findings`|압박 결과 드러난 핵심 finding|
|`User Decisions Needed`|User 판단으로 올려야 할 항목|
|`Deeper Checks Needed`|더 깊은 review나 verification이 필요한 지점|
|`Overall Recommendation`|Challenger 결과 기준으로 권장되는 다음 조치 요약|
|`Reflection Candidates`|`Task Memory`, Memory, `Debt Ledger`, `Continuity Ledger` 후보로 검토할 신호|

Findings는 `CH-001:` 같은 식별자를 heading으로 두고 `Risk type`, `Severity`, `Concern`, `Basis`, `Escalation`을 드러낸다.

Overall Recommendation은 `User Judgment`가 아니다. Challenger가 Evidence를 기준으로 제안하는 다음 조치다.

### User Judgment

User Judgment는 User가 Task 결과나 Mission 결과를 검토한 뒤 내린 결정을 남긴다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`decision`|string|`accepted`, `revise`, `additional_task`, `canceled` 중 하나|

Markdown body에는 다음 section을 둔다.

|Section|내용|
|---|---|
|`Decision Trail`|Orchestrator가 제시한 선택지, User에게 올라간 결정 항목, User가 선택하거나 요청한 내용을 짧게 요약한 판단 흐름|
|`Accepted Limits`|User가 알고 받아들인 미검증 범위와 남은 위험. 하위 section `Unverified Scope`, `Remaining Risks`로 나눈다.|
|`Requested Actions`|요청한 수정, 재작업, 추가 Task, 기준 갱신, 취소 후 처리|
|`Notes`|User가 남긴 추가 판단, 선호, 다음에 다시 볼 조건|

판단 대상은 User Judgment 파일의 위치로 구분한다. Task scope의 `user-judgment-NNN.md`는 해당 Task 결과 판단이고, Mission scope의 `user-judgment-NNN.md`는 Mission 결과 판단이다.

Task 결과 판단에서는 `accepted`, `revise`, `canceled`를 쓴다.

Mission 결과 판단에서는 `accepted`, `additional_task`, `canceled`를 쓴다.

`accepted`는 Task 결과 또는 Mission 결과를 수용하는 판단이다. User가 미검증 범위나 남은 위험을 알고 받아들였으면 decision 값을 나누지 않고 `Accepted Limits`에 남긴다.

`revise`는 현재 결과를 그대로 수용하지 않고 재작업, Task Contract 갱신, 추가 Task, Mission 기준 재검토 중 필요한 조치를 요청하는 판단이다.

`additional_task`는 Mission 결과를 아직 완료로 받아들이지 않고 추가 Task를 진행하는 판단이다. 추가 Task의 방향, 기준, 범위는 Requested Actions와 이후 Task Contract에 남긴다.

`canceled`는 현재 Task 또는 Mission 결과를 수용하지 않고 취소하는 판단이다.

### Task Evidence

Task Evidence는 Task User Judgment 뒤에 남기는 종료 기록이다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`user_judgment_ref`|string|이 Task Evidence가 반영한 `User Judgment` artifact 참조|

Markdown body에는 다음 section을 둔다.

|Section|내용|
|---|---|
|`Task Result`|User가 판단한 Task 결과 요약|
|`User Judgment Summary`|User가 수용, 재작업, 취소 중 무엇을 선택했는지|
|`Contract Criteria Results`|Task Contract 기준별 결과와 근거 참조|
|`Changed Outputs`|변경되거나 생성된 산출물|
|`Evidence References`|Implementation Evidence, Verification Evidence, Review Evidence, Challenger Evidence 참조|
|`Accepted Limits`|User가 알고 받아들인 미검증 범위와 남은 위험|
|`Decision Notes`|Task 중 확정된 User 결정과 tradeoff|
|`Task Memory Reference`|같은 Mission 안의 이후 Task를 위해 갱신한 Task Memory 참조|
|`Next Task Hints`|이어질 Task에서 확인하거나 피해야 할 지점|
|`Cancellation Summary`|취소된 Task일 때 취소 이유와 되돌린 변경 범위|

Contract Criteria Results는 Task Contract의 `TC-AC-001:` 같은 기준별로 `Result`, `Evidence refs`, `Unverified scope`, `Remaining risks`를 드러낸다. Result 값은 `satisfied`, `satisfied_with_limits`, `not_satisfied` 중 하나다.

### Task Memory

Task Memory는 같은 Mission 안의 이후 Task 비용을 낮추기 위해 갱신하는 Mission-local 작업 맥락이다.

Task Memory는 Markdown 형식으로 저장한다.

Markdown body에는 다음 section을 둔다.

|Section|내용|
|---|---|
|`Active Items`|같은 Mission 안의 이후 Task에 적용할 작업 맥락|
|`Superseded Items`|다른 Task Memory나 기준으로 대체된 항목|
|`Promoted Items`|Mission consolidating에서 장기 Memory로 승격한 항목|
|`Dropped Items`|더 이상 적용하지 않기로 한 항목|

각 item은 `### TM-001: <title>` 형식의 heading으로 시작한다.

각 item에는 다음 label을 둔다.

|Label|내용|
|---|---|
|`Status`|`active`, `superseded`, `promoted`, `dropped` 중 하나|
|`Category`|`user_preference`, `accepted_limit`, `working_context`, `avoid_next_time`, `verification_habit`, `reporting_hint` 중 하나|
|`Summary`|다음 Task가 바로 이해할 수 있는 짧은 내용|
|`Applies To`|적용할 Task, scope, 조건|
|`Source Refs`|근거가 된 User Judgment, Task Evidence, Role Evidence 참조|
|`Accepted By`|`user` 또는 `orchestrator`|
|`Expires When`|이 항목을 더 이상 적용하지 않아도 되는 조건|

Task Memory는 Mission 안에서 쓰는 단기 맥락이다. consolidating에서 반복 적용할 가치가 확인되면 Memory로 승격한다.

### Mission Evidence

Mission Evidence는 Mission User Judgment 뒤에 Mission 결과와 장기 기록 반영을 종합해 남기는 종료 기록이다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`user_judgment_ref`|string|이 Mission Evidence가 반영한 `User Judgment` artifact 참조|

Markdown body에는 다음 section을 둔다.

|Section|내용|
|---|---|
|`Mission Result`|Mission 결과 요약|
|`User Judgment Summary`|User의 Mission 수용 판단 요약|
|`Mission Criteria Results`|Mission Spec 기준별 결과와 근거 참조|
|`Task Evidence References`|Mission 판단을 뒷받침한 Task Evidence 참조|
|`Mission Plan Deltas`|Mission Plan과 실제 진행의 차이|
|`Accepted Limits`|최종적으로 받아들인 미검증 범위와 남은 위험|
|`Decisions And Tradeoffs`|Mission 중 확정된 주요 결정과 대가|
|`Debt Ledger Updates`|Debt Ledger에 남긴 항목의 참조와 이유|
|`Memory Updates`|장기 Memory로 승격한 교훈|
|`Continuity Ledger Updates`|Continuity Ledger에 남긴 상태, 열린 질문, 다음 행동|

Mission Criteria Results는 Mission Spec의 `AC-001:` 같은 기준별로 `Result`, `Evidence refs`, `Unverified scope`, `Remaining risks`를 드러낸다. Result 값은 `satisfied`, `satisfied_with_limits`, `not_satisfied` 중 하나다.

Mission Evidence의 Debt Ledger Updates, Memory Updates, Continuity Ledger Updates는 각 ledger의 정본을 대체하지 않는다. Mission Evidence에는 이번 Mission에서 새로 기록하거나 갱신한 항목의 참조와 요약을 남긴다.

### Debt Ledger

Debt Ledger는 User가 알고 받아들였고 이후 프로젝트 유지 비용으로 남는 item 목록이다.

Debt Ledger는 Markdown 형식으로 저장한다.

Markdown body에는 다음 section을 둔다.

|Section|내용|
|---|---|
|`Open Items`|아직 프로젝트 비용으로 남아 있는 항목|
|`Resolved Items`|해결되었거나 더 이상 적용되지 않는 항목|
|`Dropped Items`|추적하지 않기로 한 항목|

각 item은 `### DEBT-001: <title>` 형식의 heading으로 시작한다.

각 item에는 다음 label을 둔다.

|Label|내용|
|---|---|
|`Status`|`open`, `resolved`, `dropped` 중 하나|
|`Category`|`accepted_risk`, `unverified_scope`, `quality_debt`, `remaining_gap`, `follow_up_candidate` 중 하나|
|`Summary`|무엇을 받아들였고 어떤 비용이 남는지에 대한 요약|
|`Impact`|이 항목이 이후 변경, 유지보수, 검증, 운영에 만드는 비용|
|`Source Refs`|후보를 드러낸 Evidence, Task Evidence, Mission Evidence 참조|
|`Accepted In Ref`|User가 받아들인 판단을 담은 User Judgment 또는 Mission Evidence 참조|
|`Revisit When`|이 항목을 다시 봐야 하는 조건|
|`Resolved By Refs`|해결했거나 더 이상 적용되지 않게 만든 artifact 참조|

Debt Ledger는 Mission scope에 종속되지 않는 프로젝트 수준 artifact다.

### Memory

Memory는 Mission을 넘어 반복 적용할 운영 지식이다.

Memory는 Markdown 형식으로 저장한다. Memory scope와 role은 파일 위치로 구분한다.

Markdown body에는 다음 section을 둔다.

|Section|내용|
|---|---|
|`Active Items`|이후 작업에 적용할 Memory item|
|`Superseded Items`|다른 Memory나 기준으로 대체된 item|
|`Dropped Items`|더 이상 적용하지 않기로 한 item|

각 item은 `### MEM-001: <title>` 형식의 heading으로 시작한다.

각 item에는 다음 label을 둔다.

|Label|내용|
|---|---|
|`Status`|`active`, `superseded`, `dropped` 중 하나|
|`Guideline`|이후 작업에서 적용할 운영 기준|
|`Applies When`|이 기준을 적용할 상황이나 조건|
|`Rationale`|이 기준이 이후 판단, 실행, 검증, 보고 비용을 낮추는 이유|
|`Source Refs`|근거가 된 Evidence, Mission Evidence, User Judgment 참조|

공통 Memory는 `.geas/memory/common.md`에 둔다. role별 Memory는 `.geas/memory/roles/<role>.md`에 둔다.

### Continuity Ledger

Continuity Ledger는 다음 Task, 다음 세션, 다른 Agent가 이어받아야 하는 상태와 결정을 남긴다.

Continuity Ledger는 Markdown 형식으로 저장한다.

Markdown body에는 다음 section을 둔다.

|Section|내용|
|---|---|
|`Open Items`|작업 재개에 영향을 주는 열린 상태, 결정, 질문, 다음 행동|
|`Closed Items`|해결되었거나 더 이상 복귀 지점에 영향을 주지 않는 항목|

각 item은 `### CONT-001: <title>` 형식의 heading으로 시작한다.

각 item에는 다음 label을 둔다.

|Label|내용|
|---|---|
|`Status`|`open` 또는 `closed`|
|`Kind`|`current_state`, `accepted_decision`, `tradeoff`, `open_question`, `next_action`, `handoff_note` 중 하나|
|`Summary`|재개할 Agent가 빠르게 이해할 수 있는 짧은 요약|
|`Details`|상태, 결정, tradeoff, 질문, 다음 행동의 판단 맥락|
|`Next Action`|열린 item일 때 다음에 할 행동. 닫힌 item이면 `""`|
|`Source Refs`|근거가 된 Mission Spec, Mission Plan, Task Contract, Evidence, User Judgment, Task Evidence, Mission Evidence 참조|
|`Closed By Refs`|item을 닫은 artifact 참조|

Continuity Ledger는 복귀 기준을 빠르게 찾는 작업 상태 기록이다. 복귀 지점은 Continuity Ledger와 수용된 기준, Evidence, User Judgment를 함께 대조해 정한다.

## Storage 규칙

`<mission-id>`, `<task-id>`, Debt id, Task Memory id, Memory id, Continuity id는 Runtime artifact와 ledger item을 안정적으로 찾기 위한 id다.

Mission id는 `YYYYMMDD-<random>` 형식을 쓴다. `<random>`은 6자리 소문자 영문자와 숫자 조합이다.

Task id는 Mission 안에서 `task-001`, `task-002`처럼 3자리 증가 번호를 쓴다.

Debt id는 프로젝트 안에서 `DEBT-001`, `DEBT-002`처럼 3자리 증가 번호를 쓴다.

Task Memory id는 Mission 안에서 `TM-001`, `TM-002`처럼 3자리 증가 번호를 쓴다.

Memory id는 Memory file 안에서 `MEM-001`, `MEM-002`처럼 3자리 증가 번호를 쓴다.

Continuity id는 프로젝트 안에서 `CONT-001`, `CONT-002`처럼 3자리 증가 번호를 쓴다.

Debt Ledger는 `.geas/debts.md`에 둔다.

Continuity Ledger는 `.geas/continuity.md`에 둔다.

Task Memory는 `.geas/missions/<mission-id>/task-memory.md`에 둔다.

Memory는 `.geas/memory/` 아래에 둔다. 공통 Memory는 `.geas/memory/common.md`, role별 Memory는 `.geas/memory/roles/<role>.md`에 둔다.

파일 하나는 하나의 Runtime artifact다. 반복 생성될 수 있는 artifact는 파일명 끝의 번호를 증가시켜 쌓는다.

Mission Spec, Mission Plan, Task Contract는 versioned 기준 artifact다. `mission-spec-NNN.md`, `mission-plan-NNN.md`, `task-contract-NNN.md`처럼 파일명 끝의 번호를 증가시켜 남긴다.

Draft는 Runtime artifact가 아니다. Runtime storage에 남은 Mission Spec, Mission Plan, Task Contract는 User와 합의된 작업 기준으로 본다.

현재 Mission 기준은 해당 Mission scope에서 가장 큰 번호의 `mission-spec-NNN.md`와 `mission-plan-NNN.md`이다.

현재 Task 기준은 해당 Task scope에서 가장 큰 번호의 `task-contract-NNN.md`이다. Task Direction을 사용한 Task에서는 Task Contract의 `task_direction_ref`가 가리키는 산출물을 현재 방향 기준으로 본다.

Role Evidence와 `Task Evidence`는 같은 Task scope의 현재 Task 기준에 대조해 읽는다. `Mission Evidence`는 같은 Mission scope의 현재 Mission 기준에 대조해 읽는다.

특정 과거 기준을 근거로 삼아야 하는 예외는 frontmatter field로 고정하지 않고 Evidence 본문이나 `Continuity Ledger`에 남긴다.

Mission Spec, Mission Plan, Task Contract가 갱신되면 다음 번호의 versioned artifact로 남긴다. 작업 기준이 바뀐 이유와 영향은 관련 Evidence, Task Evidence, Mission Evidence, Continuity Ledger에 남긴다.

Task Direction이 갱신되면 새 자유 형식 산출물을 `directions/` 아래에 남기고, 이를 기준으로 작성한 Task Contract의 `task_direction_ref`가 새 산출물을 가리키게 한다.

Role Evidence는 같은 역할이 다시 수행될 수 있으므로 numbered artifact로 남긴다.

Task Evidence, Mission Evidence, Debt Ledger, Task Memory, Memory, Continuity Ledger는 고정 파일명을 쓴다.

User Judgment는 판단 시도 번호를 파일명에 남긴다. Task scope와 Mission scope 모두 `user-judgment-NNN.md`를 쓴다. 판단 대상은 파일 위치로 구분한다.

## 참조 규칙

Mission scope 안의 artifact 참조는 `.geas/missions/<mission-id>/` 기준 상대 경로를 기본으로 쓴다.

같은 Task scope 안의 artifact를 참조할 때는 Task directory 기준 파일명을 쓸 수 있다.

versioned 기준 artifact를 참조할 때는 versioned filename을 쓴다.

예:

- `mission-spec-001.md`
- `mission-plan-001.md`
- `tasks/task-001/task-contract-001.md`
- `tasks/task-001/directions/<direction-output>`
- `tasks/task-001/verification-evidence-002.md`
- `tasks/task-001/task-evidence.md`

Debt Ledger, Memory, Continuity Ledger처럼 Mission scope 밖의 프로젝트 수준 artifact가 다른 artifact를 참조할 때는 `.geas/` 기준 상대 경로를 쓴다.

예:

- `missions/20260507-a1b2c3/mission-evidence.md`
- `missions/20260507-a1b2c3/tasks/task-001/review-evidence-001.md`
- `missions/20260507-a1b2c3/tasks/task-001/task-evidence.md`

## 책임 경계

Runtime artifact의 책임 경계는 다음과 같다.

- User 수용 판단은 Evidence를 검토한 뒤 User Judgment로 남긴다.
- Evidence verdict는 Evidence의 일부로 읽는다.
- Task Direction과 Task Contract 수용은 Task 결과 수용 판단이 아니다.
- Task 요약은 User Judgment 전에 User가 결과를 검토하도록 돕는 요약이며, 정본 종료 기록은 User Judgment와 Task Evidence에 남긴다.
- Task Evidence는 Role Evidence를 대체하지 않고, User가 무엇을 보고 Task를 판단했는지 요약한다.
- Task Memory는 Task Evidence와 분리된 Mission-local 작업 맥락이다.
- Mission Evidence는 Debt Ledger, Memory, Continuity Ledger의 정본을 대체하지 않고, 이번 Mission에서 반영한 항목의 참조와 요약을 남긴다.
- Debt Ledger item은 성과가 아니라 User가 비용을 알고 받아들인 남은 부담이다.
- Continuity Ledger는 완료 선언이 아니라 이어가기 위한 상태 기록이다.
- Runtime storage는 자동 완료 선언을 만들지 않는다.
