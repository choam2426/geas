# Runtime

## 목적

이 문서는 Geas runtime model을 정의한다.

Runtime artifact는 인간이 agent 작업을 낮은 비용으로 검토하고 수용 판단할 수 있도록, 계약, 작업 결과 참조, 검증 근거, 미검증 범위, User Judgment, Memory, 진행 위치를 구조화해 남기는 운영 산출물이다.

Runtime model은 다음을 정한다.

- Geas runtime에서 사용하는 artifact
- runtime artifact의 정본 파일 형식
- artifact별 YAML schema
- `.geas/` storage 구조
- Mission과 Task identifier 규칙
- artifact 참조 규칙

## 파일 형식

Runtime artifact의 정본 파일 형식은 YAML이다.

Runtime artifact는 `.yaml` 파일로 저장한다. 필요한 경우 YAML artifact를 사람이 읽기 쉬운 Markdown으로 렌더링할 수 있다.

## Artifact 목록

Geas runtime에서 사용하는 artifact는 다음과 같다.

|Artifact|책임|
|---|---|
|Mission Spec|Mission의 목표, 배경, 범위, 제외 범위, 완료 기준, 수용 기준을 검토 가능한 기준선으로 남긴다.|
|Mission Design|Mission Spec을 실행 가능한 작업 구조로 바꾸고, 접근 전략, 대안, 핵심 개념, scope, Task 분해와 의존 관계, 주요 가정, 위험을 남긴다.|
|Task Contract|Task의 설명, Mission과의 관계, 범위, 산출물, 수용 기준, verification checks, review focus를 고정한다.|
|Implementation Evidence|Implementer가 Task 안에서 만든 결과, 구현 판단, 영향 범위, 자기 점검, 한계를 남긴다.|
|Verification Evidence|Verifier가 수행한 verification checks, 기준별 확인 결과, 미검증 범위, verdict를 남긴다.|
|Review Evidence|Reviewer가 review focus에 따라 산출물과 Evidence를 점검하고, finding, 남은 위험, verdict, overall recommendation을 남긴다.|
|Challenger Evidence|Challenger가 기준선, 산출물, Evidence를 압박해 User 수용 판단 전에 봐야 할 위험과 판단 항목을 finding으로 남긴다.|
|Task Evidence|Task 종료 후 Task 결과, User의 Task 수용 판단, 기준별 결과, 주요 Evidence, 받아들인 미검증 범위와 위험을 요약한다.|
|Mission Evidence|Mission 종료 후 Mission 결과, User의 Mission 수용 판단, 주요 Evidence, gap, debt, follow-up, 회고 요약, 반영한 Memory를 종합한다.|
|User Judgment|User가 Mission 기준선, Task Contract, Task 결과, Mission 결과를 검토한 뒤 내린 결정을 남긴다.|
|Memory|이후 작업의 판단과 행동에 반복적으로 적용할 공통 또는 role별 운영 지식을 남긴다.|
|Run State|현재 Mission id, 현재 단계, 현재 Task id를 찾는 최소 색인이다.|

## Artifact Schemas

각 schema에 정의된 key는 모두 필수다. 작성할 내용이 없는 문자열 field는 `""`, 목록 field는 `[]`로 채운다.

### Mission Spec

Mission Spec은 User의 목표를 검토 가능한 기준선으로 만든다.

|Key|Type|내용|
|---|---|---|
|`name`|string|Mission을 식별할 수 있는 짧은 이름|
|`goal`|string|User가 agent를 사용해 이루려는 목표|
|`background`|string|왜 이 Mission이 필요한지|
|`completion_criteria`|list of string|Mission이 끝났다고 판단할 상위 기준|
|`included_scope`|list of string|이번 Mission이 맡는 일|
|`excluded_scope`|list of string|이번 Mission에서 하지 않을 일|
|`acceptance_criteria`|list of string|결과를 판단할 구체 기준|
|`constraints`|list of string|반드시 지켜야 하는 조건|
|`assumptions`|list of string|User 요청을 해석할 때 둔 전제|
|`risks`|list of string|Mission을 실행하거나 수용 판단할 때 미리 의식해야 할 위험|

Mission Spec은 User의 목표를 정확히 반영하고, User가 Mission 기준선을 검토하고 수용 판단할 수 있게 작성한다.

### Mission Design

Mission Design은 Mission Spec을 바탕으로 Mission 진행 계획을 정한다.

|Key|Type|내용|
|---|---|---|
|`approach_strategy`|string|Mission을 어떤 방식으로 진행할지와 그 이유|
|`alternatives_considered`|list of object|검토했지만 선택하지 않은 주요 접근과 선택하지 않은 이유|
|`key_concepts`|list of string|Mission을 이해하는 데 필요한 핵심 개념과 이번 Mission에서의 의미|
|`scope_in`|list of string|Mission 진행 계획에 포함하는 구조적 범위|
|`scope_out`|list of string|Mission 진행 계획에서 제외하는 구조적 범위|
|`task_breakdown`|list of object|Mission을 어떤 Task로 나누는지, 각 Task의 의존 관계, 그 이유|
|`assumptions`|list of string|작업 계획이 의존하는 전제|
|`risks`|list of string|선택한 Mission 진행 계획과 Task 구조에서 고려해야 하는 위험|

`alternatives_considered` 각 항목은 다음 schema를 따른다.

|Key|Type|내용|
|---|---|---|
|`approach`|string|검토한 대안적 Mission 진행 방식|
|`benefit`|string|이 접근을 선택했을 때 얻을 수 있는 장점|
|`cost`|string|이 접근을 선택했을 때 생기는 비용, 복잡도, 판단 부담|
|`decision_reason`|string|이 접근을 선택하지 않고 현재 접근을 택한 이유|

`key_concepts` 항목은 `개념: 이번 Mission에서의 의미` 형식으로 작성한다.

`task_breakdown` 각 항목은 다음 schema를 따른다.

|Key|Type|내용|
|---|---|---|
|`task_id`|string|Storage에서 사용할 Task id. 예: `task-001`|
|`description`|string|계획상 Task가 달성하려는 상태와 작업 의도|
|`mission_coverage`|list of string|이 Task가 다루는 Mission 목표, 범위, 제약|
|`depends_on`|list of string|이 Task를 진행하기 전에 기준선이 필요한 선행 Task id 목록|
|`reason`|string|이 Task 단위로 나누는 이유|

`task_breakdown`의 배열 순서는 기본 진행 순서다.

Mission Design은 Mission의 목표, 범위, 제약을 어떤 핵심 개념, scope, Task 구조, 의존 관계로 다룰지 드러내야 한다.

### Task Contract

Task Contract는 개별 Task의 실행 계약이다.

|Key|Type|내용|
|---|---|---|
|`description`|string|이 Task가 달성하려는 상태와 작업 의도|
|`mission_relation`|string|이 Task가 Mission의 어떤 부분을 담당하는지|
|`depends_on`|list of string|이 Task를 시작하기 전에 충족되어야 하는 Task나 조건|
|`scope_in`|list of string|이번 Task에서 변경하거나 작성할 표면|
|`scope_out`|list of string|이번 Task에서 하지 않을 일|
|`deliverables`|list of string|Task가 끝났을 때 남아야 하는 결과|
|`acceptance_criteria`|list of string|Task 결과를 판단할 기준|
|`verification_checks`|list of string|Verifier가 확인할 대상, 기준, 방법|
|`review_focus`|list of string|Reviewer가 품질, 경계, 위험 관점에서 특히 점검할 지점|
|`risks`|list of string|Task를 실행하거나 수용 판단할 때 미리 의식해야 할 위험|

Task Contract는 실행 전에 User가 수용 판단할 수 있는 기준선이어야 한다.

verification checks와 review focus는 Evidence 자체가 아니라, Verification Evidence와 Review Evidence가 무엇을 확인하고 점검해야 하는지 정하는 초점이다.

Task Contract의 범위, 산출물, 수용 기준, verification checks, review focus가 바뀌면 실행 기준이 바뀐 것이다. 이 경우 갱신된 Task Contract와 User Judgment를 남긴다.

### Implementation Evidence

Implementation Evidence는 Implementer가 Task Contract 안에서 실제로 수행한 작업과 구현 맥락을 남긴다.

|Key|Type|내용|
|---|---|---|
|`summary`|string|수행한 작업을 독립적으로 이해할 수 있게 요약|
|`changed_outputs`|list of string|변경 또는 생성한 파일, 문서, 코드, 산출물 참조|
|`affected_scope`|list of string|작업 결과가 영향을 준 기능, 문서 영역, 개념, 사용자 흐름|
|`decisions`|list of string|작업 중 내린 중요한 구현 판단과 그 이유|
|`contract_deltas`|list of string|계약과 달라진 점이나 갱신이 필요한 지점|
|`self_checks`|list of string|Implementer가 산출물을 넘기기 전에 직접 확인한 범위와 결과|
|`limits`|list of string|Implementer가 확인하지 못한 범위, 알려진 한계, 남은 불확실성|
|`reflection_candidates`|list of string|다음 Task나 Mission에 반영할 수 있는 회고 후보|

Implementation Evidence는 변경 결과만 나열하지 않고, 왜 그렇게 했는지, 무엇이 바뀌었는지, 어디까지 직접 확인했는지, 무엇이 한계로 남는지를 함께 남긴다.

contract_deltas는 실행 중 Task Contract와 달라졌거나 갱신이 필요한 지점을 드러내는 데 둔다. 조용히 실행 범위를 넓히는 대신, 변경된 기준선과 User Judgment로 이어질 수 있게 남긴다.

self_checks는 Implementer가 산출물을 넘기기 전에 직접 확인한 범위와 결과를 남기며, 이후 Verification Evidence와 Review Evidence가 확인할 기초 맥락이 된다.

### Verification Evidence

Verification Evidence는 Verifier가 Task Contract의 acceptance criteria와 verification checks에 따라 실제로 확인한 결과를 남긴다.

|Key|Type|내용|
|---|---|---|
|`summary`|string|검증 결과와 주요 한계를 짧게 요약|
|`environment`|string|검증이 수행된 환경, 도구, 버전, 실행 조건|
|`target`|list of string|실제로 확인한 대상 artifact, 파일, 기능, 출력, 변경 범위|
|`checks_performed`|list of string|실제로 수행한 테스트, 실행, 검색, 비교, 출력 확인 항목|
|`criteria_results`|list of object|acceptance criteria별 결과|
|`outputs`|list of string|User가 검토할 가치가 있는 실행 출력, 테스트 결과, 비교 결과, artifact 참조|
|`deviations`|list of string|Task Contract, 기준선, 예상 결과와 달라진 점|
|`unverified_scope`|list of string|미검증 범위와 이유|
|`recheck_needed`|list of string|보정 또는 재검증이 필요한 항목|
|`verdict`|string|확인 범위 안에서의 Verifier 판단 입력|

`criteria_results` 각 항목은 다음 schema를 따른다.

|Key|Type|내용|
|---|---|---|
|`criterion`|string|Task Contract의 acceptance criterion 원문 또는 참조|
|`result`|string|`passed`, `failed`, `partial`, `not_checked`, `blocked` 중 하나|
|`basis`|string|결과를 뒷받침하는 확인 근거, 출력 참조, 한계|

Verification Evidence의 verdict는 확인 범위 안에서의 agent 측 판단 입력이다. User는 이를 근거 중 하나로 삼아 별도의 수용 판단을 남긴다.

Verification Evidence는 실제로 수행한 check와 수행하지 못한 check를 구분해 남긴다. 확인하지 못한 범위는 unverified_scope에 이유와 함께 남긴다.

criteria_results는 acceptance criteria별로 확인 결과와 근거를 연결한다. result가 `passed`가 아닌 항목은 basis, unverified_scope, recheck_needed 중 필요한 위치에 판단 비용을 낮출 수 있는 근거를 남긴다.

### Review Evidence

Review Evidence는 Reviewer가 산출물과 관련 Evidence를 품질, 경계, 누락, 위험, 일관성 관점에서 점검한 결과를 남긴다.

|Key|Type|내용|
|---|---|---|
|`summary`|string|Review 결과와 주요 한계를 짧게 요약|
|`target`|list of string|실제로 점검한 산출물, 변경, Implementation Evidence, Verification Evidence|
|`review_focus_used`|list of string|Task Contract의 review focus 중 실제로 사용한 점검 초점|
|`scope_in`|list of string|이번 Review가 점검한 품질, 경계, 누락, 위험, 일관성 범위|
|`scope_out`|list of string|이번 Review에서 점검하지 않은 범위와 관점|
|`review_methods`|list of string|리뷰를 수행한 방식, 비교 기준, 읽은 순서, 확인 방법|
|`findings`|list of object|User가 수용 판단 전에 봐야 할 Review finding|
|`remaining_risks`|list of string|Review 이후에도 남아 있는 위험과 판단상 주의점|
|`verdict`|string|Review 범위 안에서의 Reviewer 판단 입력|
|`overall_recommendation`|string|Review 결과 기준으로 권장되는 다음 조치 요약|

`findings` 각 항목은 다음 schema를 따른다.

|Key|Type|내용|
|---|---|---|
|`finding`|string|품질, 경계, 누락, 위험, 일관성 관점에서 발견한 사항|
|`severity`|string|User가 우선순위를 판단할 수 있는 심각도 또는 중요도|
|`basis`|string|finding을 뒷받침하는 근거, 위치, 비교 기준, 관찰 내용|
|`recommendation`|string|해당 finding에 대해 권장되는 국소 조치|

Review Evidence는 Verification Evidence와 함께 읽히며, 품질, 경계, 누락, 위험, 일관성 점검 결과를 남긴다.

verdict와 overall_recommendation은 Reviewer의 판단 입력이다. User는 이를 근거 중 하나로 삼아 별도의 검토와 수용 판단을 남긴다.

Review Evidence는 review_focus_used와 scope_in 안에서 발견한 finding을 basis와 함께 남긴다. Reviewer가 보지 않은 범위나 관점은 scope_out에 남긴다.

findings는 User가 수용 판단 전에 확인해야 할 구체 항목이다. 전체 방향이나 다음 조치는 overall_recommendation에 요약하고, 개별 finding의 조치는 findings.recommendation에 남긴다.

overall_recommendation은 User Judgment가 아니라 다음 확인, 재작업, 보류, 판단 요청을 제안하는 판단 입력이다.

### Challenger Evidence

Challenger Evidence는 기준선, 산출물, Evidence를 압박해 놓치기 쉬운 위험을 드러낸다.

|Key|Type|내용|
|---|---|---|
|`target`|list of string|압박한 기준선, 산출물, Evidence|
|`challenge_focus`|list of string|숨은 가정, scope 경계, 검증 공백, 장기 비용 등 압박한 관점|
|`findings`|list of object|압박 결과 드러난 핵심 finding|
|`user_decisions_needed`|list of string|User 판단으로 올려야 할 항목|
|`deeper_checks_needed`|list of string|더 깊은 review나 verification이 필요한 지점|
|`verdict`|string|Challenger 범위 안에서의 판단 입력|
|`overall_recommendation`|string|Challenger 결과 기준으로 권장되는 다음 조치 요약|

`findings` 각 항목은 다음 schema를 따른다.

|Key|Type|내용|
|---|---|---|
|`finding`|string|드러난 숨은 가정, scope 경계, 검증 공백, 장기 비용, tradeoff, 반복 위험|
|`risk_type`|string|`assumption`, `scope`, `verification_gap`, `operational_risk`, `tradeoff`, `repeat_risk` 중 하나|
|`basis`|string|finding을 뒷받침하는 기준선, 산출물, Evidence, 관찰 근거|
|`escalation`|string|보류, 중단, User 판단, 추가 review나 verification이 필요한 이유|

Challenger Evidence는 Verification Evidence와 Review Evidence 이후에도 User 수용 판단 전에 봐야 할 위험을 압박해 드러낸다.

Challenger Evidence는 User 수용 판단에 영향을 줄 수 있는 위험을 finding과 근거로 선별해 남긴다.

overall_recommendation은 User Judgment가 아니라 다음 확인, 재작업, 보류, 판단 요청을 제안하는 판단 입력이다.

### Task Evidence

Task Evidence는 Task가 User 수용 판단으로 종료된 뒤 남기는 종료 요약 Evidence다.

|Key|Type|내용|
|---|---|---|
|`summary`|string|Task 결과 요약|
|`user_judgment_summary`|string|User의 Task 수용 판단 요약|
|`criteria_results`|list of object|Task Contract 기준별 결과|
|`accepted_unverified_scope`|list of string|User가 알고 받아들인 미검증 범위|
|`accepted_remaining_risks`|list of string|User가 알고 받아들인 남은 위험|

`criteria_results` 각 항목은 다음 schema를 따른다.

|Key|Type|내용|
|---|---|---|
|`criterion`|string|Task Contract의 acceptance criterion 원문 또는 참조|
|`result`|string|User 수용 판단 이후 기준별 결과 요약|
|`evidence_refs`|list of string|이 기준 결과를 뒷받침하는 주요 Evidence 참조|
|`unverified_scope`|list of string|이 기준에서 남은 미검증 범위|
|`remaining_risks`|list of string|이 기준에서 남은 위험|

Task Evidence는 Task를 다시 열지 않고도 결과, User 수용 판단, 기준별 근거, 받아들인 미검증 범위와 위험을 빠르게 확인할 수 있게 남기는 종료 요약이다. `evidence_refs`에는 최신 Evidence뿐 아니라 재작업 후에도 여전히 유효한 이전 Evidence를 포함할 수 있다.

### Mission Evidence

Mission Evidence는 User가 role Evidence, Task Evidence, gap, debt, follow-up 후보를 검토해 User Judgment를 남긴 뒤 작성하는 Mission 종료 요약이다.

|Key|Type|내용|
|---|---|---|
|`summary`|string|Mission 결과 요약|
|`user_judgment_summary`|string|User의 Mission 수용 판단 요약|
|`mission_criteria_results`|list of object|Mission Spec 기준별 결과|
|`mission_design_deltas`|list of string|Mission Design과 실제 진행의 차이|
|`accepted_unverified_scope`|list of string|User가 알고 받아들인 미검증 범위의 최종 요약|
|`accepted_remaining_risks`|list of string|User가 알고 받아들인 남은 위험의 최종 요약|
|`gaps`|list of string|Mission 기준선과 실제 결과 사이에 남은 차이|
|`debts`|list of string|현재 Mission에서 수용한 결과 안에 남는 이후 비용|
|`follow_ups`|list of string|현재 Mission 밖에서 새로 다룰 수 있는 다음 작업 후보|
|`reflection_summary`|string|회고 요약|
|`memory_updates`|list of string|Mission 이후 Memory에 반영한 운영 지식 요약|

`mission_criteria_results` 각 항목은 다음 schema를 따른다.

|Key|Type|내용|
|---|---|---|
|`criterion`|string|Mission Spec의 acceptance criterion 원문 또는 참조|
|`result`|string|User 수용 판단 이후 기준별 결과 요약|
|`evidence_refs`|list of string|이 기준 결과를 뒷받침하는 주요 Evidence 참조|
|`unverified_scope`|list of string|이 기준에서 남은 미검증 범위|
|`remaining_risks`|list of string|이 기준에서 남은 위험|

Mission Evidence는 Mission 전체를 다시 열어볼 때 출발점이다. Task별 상세 결과는 Task Evidence에 두고, Mission Evidence는 Mission 기준별 결과와 그 근거 참조를 남긴다.

`accepted_unverified_scope`와 `accepted_remaining_risks`는 User Judgment 이후 최종적으로 받아들인 한계와 위험을 요약한다. 기준별 한계와 위험은 `mission_criteria_results` 안에 남긴다.

### User Judgment

User Judgment는 User가 기준선이나 결과를 검토한 뒤 내린 결정을 남긴다.

|Key|Type|내용|
|---|---|---|
|`decision`|string|User가 내린 결정. `accepted`, `accepted_with_limits`, `rework_requested`, `deferred`, `stopped` 중 하나|
|`accepted_unverified_scope`|list of string|User가 알고 받아들인 미검증 범위|
|`accepted_remaining_risks`|list of string|User가 알고 받아들인 남은 위험|
|`requested_actions`|list of string|요청한 수정, 재작업, 추가 Task, 보류, 중단|

User Judgment는 Evidence와 분리된 User 결정 원본이다. 판단 대상은 User Judgment 파일의 위치와 파일명으로 구분한다.

`accepted`와 `accepted_with_limits`는 기준선이나 결과를 수용한 판단이다. `rework_requested`, `deferred`, `stopped`는 수용 판단을 보류하거나 작업 방향을 바꾸는 판단이다.

### Common Memory

Common Memory는 이후 작업에서 모든 role이 공통으로 적용할 운영 지식이다.

|Key|Type|내용|
|---|---|---|
|`items`|list of object|반복 적용할 운영 지식 항목|

`items` 각 항목은 다음 schema를 따른다.

|Key|Type|내용|
|---|---|---|
|`guideline`|string|이후 작업에서 적용할 운영 기준|
|`applies_when`|list of string|이 기준을 적용할 상황이나 조건|
|`source_refs`|list of string|이 기준의 근거가 된 Evidence, Mission Evidence, User Judgment 참조|

`applies_when: []`는 모든 작업에서 참고 가능한 일반 운영 지식을 뜻한다.

### Role Memory

Role Memory는 특정 role이 자기 책임 범위에서 이후 작업에 적용할 운영 지식이다.

|Key|Type|내용|
|---|---|---|
|`items`|list of object|반복 적용할 role별 운영 지식 항목|

`items` 각 항목은 Common Memory와 같은 schema를 따른다.

Memory는 Mission 수용 판단 이후 반영한다. Memory file 하나가 Runtime artifact이며, Memory item은 Runtime artifact가 아니다.

### Run State

Run State는 현재 작업 위치를 찾기 위한 최소 색인이다.

|Key|Type|내용|
|---|---|---|
|`current_mission_id`|string|현재 Mission id|
|`current_stage`|string|`specifying`, `building`, `consolidating` 중 하나|
|`current_task_id`|string|현재 Task id. 없으면 `""`|

Run State는 작업 재개의 출발점이다. 복귀 지점은 Run State만으로 확정하지 않고 기준선, Evidence, User Judgment, Mission Evidence, Memory를 대조해 정한다.

## Storage

초기 runtime storage는 Mission과 Task scope 중심으로 배치한다.

```text
.geas/
  run-state.yaml
  memory/
    common.yaml
    roles/
      orchestrator.yaml
      work-designer.yaml
      implementer.yaml
      verifier.yaml
      reviewer.yaml
      challenger.yaml
  missions/
    <mission-id>/
      mission-spec-001.yaml
      mission-design-001.yaml
      user-judgment-baseline-001.yaml
      challenger-evidence-001.yaml
      mission-evidence.yaml
      user-judgment-result-001.yaml
      tasks/
        <task-id>/
          task-contract-001.yaml
          user-judgment-contract-001.yaml
          implementation-evidence-001.yaml
          verification-evidence-001.yaml
          review-evidence-001.yaml
          challenger-evidence-001.yaml
          task-evidence.yaml
          user-judgment-result-001.yaml
```

`<mission-id>`와 `<task-id>`는 Runtime artifact가 Mission과 Task를 안정적으로 찾기 위한 id다.

Mission id는 `YYYYMMDD-<random>` 형식을 쓴다. `<random>`은 6자리 소문자 영문자와 숫자 조합이다.

Task id는 Mission 안에서 `task-001`, `task-002`처럼 3자리 증가 번호를 쓴다.

같은 Mission id 디렉토리가 이미 있으면 Mission id의 random 값을 다시 생성한다. 새 Task id는 해당 Mission의 `tasks/` 아래에서 가장 큰 Task 번호에 1을 더해 정한다.

Run State는 `.geas/run-state.yaml`에 둔다.

Memory는 `.geas/memory/` 아래에 둔다. 공통 Memory는 `.geas/memory/common.yaml`에 두고, role별 Memory는 `.geas/memory/roles/<role>.yaml`에 둔다.

파일 하나는 하나의 Runtime artifact다. 반복 생성되거나 갱신될 수 있는 artifact는 파일명 끝의 번호를 증가시켜 쌓는다.

Mission Spec, Mission Design, Task Contract는 번호 파일을 쓴다. 현재 기준선은 `accepted` 또는 `accepted_with_limits` User Judgment가 있는 가장 큰 번호의 기준선이다.

`mission-spec-NNN.yaml`, `mission-design-NNN.yaml`, `user-judgment-baseline-NNN.yaml`은 하나의 Mission baseline generation이다. `user-judgment-baseline-NNN.yaml`은 같은 번호의 Mission Spec과 Mission Design을 함께 판단한다.

`task-contract-NNN.yaml`과 `user-judgment-contract-NNN.yaml`은 하나의 Task contract generation이다. `user-judgment-contract-NNN.yaml`은 같은 번호의 Task Contract를 판단한다.

`user-judgment-result-NNN.yaml`은 결과 판단 시도 번호다. `task-evidence.yaml`과 `mission-evidence.yaml`은 최종 수용된 result judgment를 반영한 current summary다.

종료 요약, Run State, Memory는 고정 파일명을 쓴다.

artifact 참조는 `.geas/missions/<mission-id>/` 기준 상대 경로를 기본으로 쓴다. 같은 Task scope 안의 artifact를 참조할 때는 Task directory 기준 파일명을 쓸 수 있다. 예: `challenger-evidence-001.yaml`, `tasks/task-001/task-evidence.yaml`, `verification-evidence-002.yaml`.

## 책임 경계

Runtime artifact의 책임 경계는 다음과 같다.

- User 수용 판단은 Runtime artifact를 검토한 뒤 User Judgment로 남긴다.
- Evidence verdict는 User Judgment의 판단 입력으로 읽는다.
- User는 Evidence와 User Judgment를 함께 대조해 완료 수용 여부를 판단한다.
- 회고 후보는 User 수용 판단 이후 Memory 반영 대상으로 검토한다.
- Mission Evidence는 User가 Mission 수용 판단을 남긴 뒤 gap, debt, follow-up, 회고, Memory 반영 결과를 종합한다.
- Runtime storage는 자동 완료 상태 파일을 만들지 않는다.
