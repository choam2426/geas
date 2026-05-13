# Runtime

## 목적

이 문서는 Geas runtime model을 정의한다.

Runtime artifact는 인간이 agent 작업을 낮은 비용으로 검토하고 수용 판단할 수 있도록, 계약, 작업 결과 참조, 검증 근거, 미검증 범위, User Judgment, Memory, 진행 위치를 구조화해 남기는 운영 산출물이다.

Runtime model은 다음을 정한다.

- Geas runtime에서 사용하는 artifact
- runtime artifact의 정본 파일 형식
- artifact별 파일 형식과 schema
- `.geas/` storage 구조
- Mission과 Task identifier 규칙
- artifact 참조 규칙

## 파일 형식

Runtime artifact의 정본 파일 형식은 artifact별로 정의한다.

YAML frontmatter + Markdown 형식의 artifact는 `.md` 파일로 저장한다. 기본 규칙은 다음과 같다.

- Frontmatter에는 runtime이 식별, 색인, 상태 전이, 참조에 쓰는 짧은 metadata를 둔다.
- Frontmatter key는 기존 schema와 이어지는 영어 식별자를 쓴다.
- Markdown body에는 User가 검토하고 수용 판단할 계약, 판단 맥락, Evidence 요약, 미검증 범위, 위험을 둔다.
- Markdown section heading은 영어 label을 쓴다.
- Markdown body는 H1 없이 `##` section부터 시작한다. artifact 식별은 파일명과 frontmatter metadata가 맡는다.
- 같은 의미를 frontmatter와 Markdown body에 중복 저장하지 않는다.

Mission Spec, Mission Design, Task Contract, Implementation Evidence, Verification Evidence, Review Evidence, Challenger Evidence, Task Evidence, Mission Evidence, User Judgment의 정본 파일 형식은 YAML frontmatter와 Markdown body를 함께 쓰는 Markdown이다. 이들 artifact는 `.md` 파일로 저장한다.

그 밖의 Runtime artifact의 정본 파일 형식은 YAML이다. YAML 형식의 artifact는 `.yaml` 파일로 저장한다.

Run State와 Task State는 진행 위치를 찾기 위한 pointer artifact다. 두 artifact는 User가 검토할 계약 본문이나 Evidence 본문을 담지 않으므로 YAML 형식으로 둔다.

Memory는 이후 작업에 반복 적용할 운영 지식 record의 목록이므로 YAML 형식으로 둔다.

## Artifact 목록

Geas runtime에서 사용하는 artifact는 다음과 같다.

|Artifact|책임|
|---|---|
|Mission Spec|Mission의 목표, 배경, 범위, 제외 범위, 수용 기준을 검토 가능한 기준선으로 남긴다.|
|Mission Design|Mission Spec을 사용자가 검토하기 쉬운 진행 계획으로 구체화하고, 접근 전략, 대안, 핵심 개념, scope, 계획 outline, 판단 지점, 주요 가정, 위험, 변경 trigger를 남긴다.|
|Task Contract|Task 분리와 Task의 설명, Mission 수용 기준 참조, 의존 관계, 범위, 산출물, 수용 기준, verification checks, review focus, 위험 수준, 변경 trigger를 고정한다.|
|Task State|Task 안에서 현재 이어갈 phase를 찾는 진행 위치 pointer를 남긴다.|
|Implementation Evidence|Implementer가 Task 안에서 만든 결과, 구현 판단, 영향 범위, 자기 점검, 한계를 남긴다.|
|Verification Evidence|Verifier가 수행한 verification checks, 기준별 확인 결과, 미검증 범위, verdict를 남긴다.|
|Review Evidence|Reviewer가 review focus에 따라 산출물과 Evidence를 점검하고, finding, 남은 위험, verdict, overall recommendation을 남긴다.|
|Challenger Evidence|Challenger가 Task Contract, 산출물, role별 Evidence를 압박해 Task 수용 판단 전에 봐야 할 위험과 판단 항목을 finding으로 남긴다.|
|Task Evidence|Task 종료 후 Task 결과, User의 Task 수용 판단, 기준별 결과, 주요 Evidence, 받아들인 미검증 범위와 위험을 요약한다.|
|Mission Evidence|Mission 종료 후 Mission 결과, User의 Mission 수용 판단, 주요 Evidence, gap, debt, follow-up, 회고 요약, 반영한 Memory를 종합한다.|
|User Judgment|User가 Task 결과나 Mission 결과를 검토한 뒤 내린 결정을 남긴다.|
|Memory|이후 작업의 판단과 행동에 반복적으로 적용할 공통 또는 role별 운영 지식을 남긴다.|
|Run State|현재 Mission id, 현재 단계, 현재 Task id를 찾는 최소 색인이다.|

## Artifact Formats

각 artifact 형식에 정의된 frontmatter key와 YAML artifact key는 모두 필수다. 작성할 내용이 없는 문자열 field는 `""`, 목록 field는 `[]`로 채운다.

빈 문자열과 빈 배열은 작성할 내용이 없음을 뜻한다. 미확인, 생략, 차단, 해당 없음은 빈 값으로 숨기지 않고 해당 artifact의 기존 field에 명시한다.

Markdown body에 정의된 section은 모두 필수다. 작성할 내용이 없으면 해당 section 안에 `없음.`을 남긴다.

### Mission Spec

Mission Spec은 User의 목표를 검토 가능한 기준선으로 만든다.

Mission Spec은 YAML frontmatter + Markdown 형식으로 저장한다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`name`|string|Mission을 식별할 수 있는 짧은 이름|

Markdown body에는 H1 없이 다음 section을 둔다.

|Section|내용|
|---|---|
|`Goal`|User가 agent를 사용해 이루려는 목표|
|`Background`|왜 이 Mission이 필요한지|
|`Scope`|이번 Mission이 맡는 일과 하지 않을 일. 하위 section `Included`, `Excluded`로 나눈다.|
|`Acceptance Criteria`|결과를 판단할 구체 기준. 각 기준은 `AC-001:` 같은 안정적인 식별자로 시작한다.|
|`Constraints`|반드시 지켜야 하는 조건|
|`Assumptions`|User 요청을 해석할 때 둔 전제|
|`Risks`|Mission을 실행하거나 수용 판단할 때 미리 의식해야 할 위험|

Mission Spec은 User의 목표를 정확히 반영하고, User가 Mission 기준선을 검토하고 수용 판단할 수 있게 작성한다.

Acceptance Criteria의 식별자는 Mission Evidence와 Task Evidence에서 기준별 결과와 근거를 추적하기 위한 참조 label이다. 식별자는 기준의 의미가 바뀌지 않는 한 유지한다.

Mission Spec은 Mission을 수용 판단으로 올릴 준비 조건을 별도 field로 갖지 않는다. 수용 판단 준비 여부는 consolidating과 Evidence 흐름에서 Task Evidence, Mission Evidence, 미검증 범위, 남은 위험을 대조해 판단한다.

### Mission Design

Mission Design은 Mission Spec을 바탕으로 User가 읽고 판단할 수 있는 Mission 진행 계획을 정한다.

Mission Design은 YAML frontmatter + Markdown 형식으로 저장한다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`name`|string|Mission Spec의 `name`과 같은 Mission 식별자|

Markdown body에는 H1 없이 다음 section을 둔다.

|Section|내용|
|---|---|---|
|`Plan Summary`|Mission을 어떤 계획으로 진행할지에 대한 짧은 요약|
|`Approach Strategy`|Mission을 어떤 방식으로 진행할지와 그 이유|
|`Alternatives Considered`|검토했지만 선택하지 않은 주요 접근과 선택하지 않은 이유|
|`Key Concepts`|Mission을 이해하는 데 필요한 핵심 개념과 이번 Mission에서의 의미|
|`Scope`|Mission 진행 계획에 포함하는 구조적 범위와 제외하는 구조적 범위. 하위 section `In`, `Out`으로 나눈다.|
|`Plan Outline`|Task로 쪼개기 전, User가 이해해야 할 주요 진행 초점과 기대 결과|
|`Decision Points`|진행 중 User에게 돌아가야 하거나 기준선 재검토가 필요한 판단 지점|
|`Assumptions`|작업 계획이 의존하는 전제|
|`Risks`|선택한 Mission 진행 계획에서 고려해야 하는 위험|
|`Change Triggers`|Mission Design이나 Task Contract를 다시 합의해야 하는 조건|

Alternatives Considered는 `Approach`, `Benefit`, `Cost`, `Decision Reason` 열을 가진 Markdown table로 쓴다. 실질적으로 검토한 대안이 없으면 그 이유를 짧게 쓴다.

Key Concepts 항목은 `개념: 이번 Mission에서의 의미` 형식으로 작성한다.

Plan Outline은 각 focus마다 purpose와 User-visible result를 함께 드러낸다. Plan Outline은 Task 목록, Task id, dependency를 정의하지 않는다. 그 책임은 Task Contract에 둔다.

Mission Design은 Mission의 목표, 범위, 제약을 어떤 핵심 개념, scope, 접근, 판단 지점, 위험 관리 방식으로 다룰지 드러내야 한다.

Mission Design은 Task 분리의 정본이 아니다. Task 추가, 삭제, Task id, dependency, Task별 mission coverage 변경은 Task Contract 갱신으로 다룬다. Mission 진행 방식, 주요 scope framing, 판단 지점, 가정, 위험, 변경 trigger가 바뀌면 Mission Design을 갱신한다.

### Task Contract

Task Contract는 개별 Task의 실행 계약이다.

Task Contract는 YAML frontmatter + Markdown 형식으로 저장한다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`name`|string|Mission Spec의 `name`과 같은 Mission 식별자|
|`task_id`|string|Mission 안에서 Task를 식별하는 id|
|`mission_acceptance_refs`|list of string|이 Task가 담당하는 Mission Spec의 Acceptance Criteria 식별자|
|`depends_on`|list of string|이 Task를 시작하기 전에 수용되어야 하는 Task id|
|`risk_level`|string|`low`, `medium`, `high` 중 하나. Task 실행 전 검토 비용, Challenger 검토, Task 분리 판단에 쓰는 위험 수준|

Markdown body에는 H1 없이 다음 section을 둔다.

|Section|내용|
|---|---|
|`Description`|이 Task가 달성하려는 상태와 작업 의도|
|`Mission Relation`|이 Task가 Mission의 어떤 부분을 담당하는지|
|`Scope`|이번 Task에서 변경하거나 작성할 표면과 하지 않을 일. 하위 section `In`, `Out`으로 나눈다.|
|`Deliverables`|Task가 끝났을 때 남아야 하는 결과|
|`Acceptance Criteria`|Task 결과를 판단할 기준. 각 기준은 `TC-AC-001:` 같은 안정적인 식별자로 시작한다.|
|`Verification Checks`|Verifier가 확인할 대상, 기준, 방법|
|`Review Focus`|Reviewer가 품질, 경계, 위험 관점에서 특히 점검할 지점|
|`Assumptions`|Task 실행 계약이 의존하는 전제|
|`Constraints`|Task 안에서 지켜야 하는 제약|
|`Risks`|Task를 실행하거나 수용 판단할 때 미리 의식해야 할 위험|
|`Change Triggers`|Task Contract를 다시 합의해야 하는 조건|

Task Contract는 실행 전에 User가 수용 판단할 수 있는 기준선이어야 한다.

Task Contract는 Task 분리와 개별 Task 실행 계약의 정본이다. Task id, dependency, Task별 scope와 mission coverage는 Task Contract 기록으로 확정한다. `mission_acceptance_refs`는 Task가 담당하는 Mission 기준을 추적하기 위한 참조 label이며, 각 값은 Mission Spec의 Acceptance Criteria 식별자를 가리킨다.

`risk_level`은 구체 위험 목록을 대체하지 않는다. `low`는 좁고 되돌리기 쉬운 변경, `medium`은 코드·스키마·여러 문서처럼 일반적인 verification과 review가 필요한 변경, `high`는 실패 비용이 크고 되돌리기 어렵거나, 사용자·운영·데이터·보안·배포·외부 동작에 큰 영향을 줄 수 있는 변경을 뜻한다.

verification checks와 review focus는 Evidence 자체가 아니라, Verification Evidence와 Review Evidence가 무엇을 확인하고 점검해야 하는지 정하는 초점이다.

Task Contract의 Acceptance Criteria 식별자는 Mission Acceptance Criteria와 구분하기 위해 `TC-AC-001:` 형식을 쓴다. 식별자는 기준의 의미가 바뀌지 않는 한 유지한다.

Task 추가, 삭제, dependency, Mission Acceptance Criteria 참조, 실행 범위, 산출물, 수용 기준, verification checks, review focus, risk_level, change trigger가 바뀌면 Task Contract를 갱신한다.

### Task State

Task State는 Task 안에서 현재 이어갈 phase를 찾는 진행 위치 pointer다.

|Key|Type|내용|
|---|---|---|
|`phase`|string|`unstarted`, `implementing`, `verifying`, `reviewing`, `challenging`, `awaiting_user_judgment`, `closed` 중 하나|

Task State는 Task Contract, Evidence, User Judgment, Task Evidence를 대체하지 않는다. Task State는 현재 Task를 재개할 때 어느 phase부터 이어갈지 찾기 위한 artifact다.

`unstarted`는 Task Contract가 기록되었지만 아직 Task 실행 loop에 들어가지 않은 상태를 가리킨다.

`closed`는 Task result User Judgment와 Task Evidence가 기록된 뒤 Task 흐름이 종료 요약까지 도달했음을 가리키는 phase pointer다. Task 수용 판단의 근거는 User Judgment와 Task Evidence에 남긴다.

### Implementation Evidence

Implementation Evidence는 Implementer가 Task Contract 안에서 실제로 수행한 작업과 구현 맥락을 남긴다.

Implementation Evidence는 YAML frontmatter + Markdown 형식으로 저장한다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`name`|string|Mission Spec의 `name`과 같은 Mission 식별자|
|`task_id`|string|Mission 안에서 Task를 식별하는 id|
|`evidence_type`|string|`implementation`|
|`task_contract_ref`|string|이 Evidence가 기준으로 삼은 Task Contract artifact 참조|

Markdown body에는 H1 없이 다음 section을 둔다.

|Section|내용|
|---|---|
|`Summary`|수행한 작업을 독립적으로 이해할 수 있게 요약|
|`Changed Outputs`|변경 또는 생성한 파일, 문서, 코드, 산출물 참조|
|`Affected Scope`|작업 결과가 영향을 준 기능, 문서 영역, 개념, 사용자 흐름|
|`Implementation Decisions`|작업 중 내린 중요한 구현 판단과 그 이유|
|`Assumptions`|구현 중 의존한 전제|
|`Contract Deltas`|계약과 달라진 점이나 갱신이 필요한 지점|
|`Self Checks`|Implementer가 산출물을 넘기기 전에 직접 확인한 범위와 결과|
|`Limits`|Implementer가 확인하지 못한 범위, 알려진 한계, 남은 불확실성|
|`Reflection Candidates`|다음 Task나 Mission에 반영할 수 있는 회고 후보|

Implementation Evidence는 변경 결과만 나열하지 않고, 왜 그렇게 했는지, 무엇이 바뀌었는지, 어디까지 직접 확인했는지, 무엇이 한계로 남는지를 함께 남긴다.

contract_deltas는 실행 중 Task Contract와 달라졌거나 갱신이 필요한 지점을 드러내는 데 둔다. 조용히 실행 범위를 넓히는 대신, 갱신된 Task Contract나 결과 수용 판단으로 이어질 수 있게 남긴다.

self_checks는 Implementer가 산출물을 넘기기 전에 직접 확인한 범위와 결과를 남기며, 이후 Verification Evidence와 Review Evidence가 확인할 기초 맥락이 된다.

Implementer의 self check는 독립 Verification Evidence나 Review Evidence를 대체하지 않는다.

### Evidence Verdict

Evidence verdict는 Verification Evidence, Review Evidence, Challenger Evidence에서 쓰는 agent 측 판단 입력이다.

verdict 값은 `passed`, `changes_requested`, `escalated` 중 하나다. Implementation Evidence는 verdict를 쓰지 않는다.

`passed`는 해당 Evidence가 맡은 필수 확인, 점검, 압박을 수행했고, 확인 범위 안에서 기준을 충족한다고 볼 근거가 있을 때만 쓴다.

### Verification Evidence

Verification Evidence는 Verifier가 Task Contract의 acceptance criteria와 verification checks에 따라 실제로 확인한 결과를 남긴다.

Verification Evidence는 YAML frontmatter + Markdown 형식으로 저장한다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`name`|string|Mission Spec의 `name`과 같은 Mission 식별자|
|`task_id`|string|Mission 안에서 Task를 식별하는 id|
|`evidence_type`|string|`verification`|
|`task_contract_ref`|string|검증 기준으로 삼은 Task Contract artifact 참조|
|`implementation_evidence_ref`|string|검증 대상 구현 결과를 설명하는 Implementation Evidence artifact 참조|
|`verdict`|string|`passed`, `changes_requested`, `escalated` 중 하나|

Markdown body에는 H1 없이 다음 section을 둔다.

|Section|내용|
|---|---|---|
|`Summary`|검증 결과와 주요 한계를 짧게 요약|
|`Environment`|검증이 수행된 환경, 도구, 버전, 실행 조건|
|`Target`|실제로 확인한 대상 artifact, 파일, 기능, 출력, 변경 범위|
|`Checks Performed`|실제로 수행한 테스트, 실행, 검색, 비교, 출력 확인 항목. 각 check는 `VC-001:` 같은 식별자로 시작한다.|
|`Criteria Results`|Task Contract acceptance criteria별 결과, 연결된 check, 근거|
|`Outputs`|User가 검토할 가치가 있는 실행 출력, 테스트 결과, 비교 결과, artifact 참조|
|`Deviations`|Task Contract, 기준선, 예상 결과와 달라진 점|
|`Unverified Scope`|미검증 범위와 이유|
|`Recheck Needed`|보정 또는 재검증이 필요한 항목|

Verification Evidence의 verdict는 확인 범위 안에서의 agent 측 판단 입력이다. User는 이를 근거 중 하나로 삼아 별도의 수용 판단을 남긴다.

Verification Evidence는 실제로 수행한 check와 수행하지 못한 check를 구분해 남긴다. 확인하지 못한 범위는 unverified_scope에 이유와 함께 남긴다.

Criteria Results는 Task Contract의 `TC-AC-001:` 같은 기준별로 확인 결과와 근거를 연결한다. 각 기준 결과는 `Result`, `Checks`, `Basis`를 드러낸다. result 값은 `passed`, `failed`, `partial`, `not_checked`, `blocked` 중 하나다. result가 `passed`가 아닌 항목은 Basis, Unverified Scope, Recheck Needed 중 필요한 위치에 판단 비용을 낮출 수 있는 근거를 남긴다.

필수 확인이 수행되지 않았거나 기준별 미검증 범위가 남아 있으면 `passed`로 표현하지 않는다.

### Review Evidence

Review Evidence는 Reviewer가 산출물과 관련 Evidence를 품질, 경계, 누락, 위험, 일관성 관점에서 점검한 결과를 남긴다.

Review Evidence는 YAML frontmatter + Markdown 형식으로 저장한다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`name`|string|Mission Spec의 `name`과 같은 Mission 식별자|
|`task_id`|string|Mission 안에서 Task를 식별하는 id|
|`evidence_type`|string|`review`|
|`task_contract_ref`|string|Review 기준으로 삼은 Task Contract artifact 참조|
|`implementation_evidence_ref`|string|Review 대상 구현 결과를 설명하는 Implementation Evidence artifact 참조|
|`verification_evidence_ref`|string|Review가 함께 읽은 Verification Evidence artifact 참조|
|`verdict`|string|`passed`, `changes_requested`, `escalated` 중 하나|

Markdown body에는 H1 없이 다음 section을 둔다.

|Section|내용|
|---|---|---|
|`Summary`|Review 결과와 주요 한계를 짧게 요약|
|`Target`|실제로 점검한 산출물, 변경, Implementation Evidence, Verification Evidence|
|`Review Focus Used`|Task Contract의 review focus 중 실제로 사용한 점검 초점|
|`Review Coverage`|이번 Review가 점검한 범위와 점검하지 않은 범위. 하위 section `Covered`, `Not Covered`로 나눈다.|
|`Review Methods`|리뷰를 수행한 방식, 비교 기준, 읽은 순서, 확인 방법|
|`Findings`|User가 수용 판단 전에 봐야 할 Review finding|
|`Remaining Risks`|Review 이후에도 남아 있는 위험과 판단상 주의점|
|`Overall Recommendation`|Review 결과 기준으로 권장되는 다음 조치 요약|

Review Evidence는 Verification Evidence와 함께 읽히며, 품질, 경계, 누락, 위험, 일관성 점검 결과를 남긴다.

verdict와 overall_recommendation은 Reviewer의 판단 입력이다. User는 이를 근거 중 하나로 삼아 별도의 검토와 수용 판단을 남긴다.

Review Evidence는 Review Focus Used와 Review Coverage 안에서 발견한 finding을 basis와 함께 남긴다. Reviewer가 보지 않은 범위나 관점은 Review Coverage의 Not Covered에 남긴다.

Findings는 User가 수용 판단 전에 확인해야 할 구체 항목이다. 각 finding은 `RV-001:` 같은 식별자를 heading으로 두고 `Finding`, `Severity`, `Category`, `Affected refs`, `Basis`, `Recommendation`을 드러낸다. 전체 방향이나 다음 조치는 Overall Recommendation에 요약하고, 개별 finding의 조치는 Recommendation에 남긴다. finding이 없으면 Findings에 `없음.`을 남긴다.

overall_recommendation은 User Judgment가 아니라 다음 확인, 재작업, 보류, 판단 요청을 제안하는 판단 입력이다.

필수 review focus를 점검하지 못했거나 Review 범위 안에 User가 받아들여야 할 미검증 범위가 남아 있으면 `passed`로 표현하지 않는다.

### Challenger Evidence

Challenger Evidence는 Task Contract, 산출물, Evidence를 압박해 놓치기 쉬운 위험을 드러낸다.

Challenger Evidence는 YAML frontmatter + Markdown 형식으로 저장한다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`name`|string|Mission Spec의 `name`과 같은 Mission 식별자|
|`task_id`|string|Mission 안에서 Task를 식별하는 id|
|`evidence_type`|string|`challenger`|
|`task_contract_ref`|string|압박 기준으로 삼은 Task Contract artifact 참조|
|`implementation_evidence_ref`|string|압박 대상 구현 결과를 설명하는 Implementation Evidence artifact 참조|
|`verification_evidence_ref`|string|압박 대상 검증 근거를 설명하는 Verification Evidence artifact 참조|
|`review_evidence_ref`|string|압박 대상 review 근거를 설명하는 Review Evidence artifact 참조|
|`verdict`|string|`passed`, `changes_requested`, `escalated` 중 하나|

Markdown body에는 H1 없이 다음 section을 둔다.

|Section|내용|
|---|---|---|
|`Target`|압박한 Task Contract, 산출물, Evidence|
|`Challenge Focus`|숨은 가정, scope 경계, 검증 공백, 장기 비용 등 압박한 관점|
|`Challenge Methods`|trace check, assumption challenge, failure-mode scan처럼 압박에 사용한 방법|
|`Findings`|압박 결과 드러난 핵심 finding|
|`User Decisions Needed`|User 판단으로 올려야 할 항목|
|`Deeper Checks Needed`|더 깊은 review나 verification이 필요한 지점|
|`Overall Recommendation`|Challenger 결과 기준으로 권장되는 다음 조치 요약|

Challenger Evidence는 Verification Evidence와 Review Evidence 이후에도 User 수용 판단 전에 봐야 할 위험을 압박해 드러낸다.

Challenger Evidence는 User 수용 판단에 영향을 줄 수 있는 위험을 finding과 근거로 선별해 남긴다.

Findings는 `CH-001:` 같은 식별자를 heading으로 두고 `Risk type`, `Severity`, `Concern`, `Basis`, `Escalation`을 드러낸다. Risk type은 고정 enum이 아니라 User가 위험 성격을 빠르게 이해하기 위한 짧은 label이다. 예: `assumption`, `scope boundary`, `verification gap`, `operational risk`, `tradeoff`, `repeat risk`.

overall_recommendation은 User Judgment가 아니라 다음 확인, 재작업, 보류, 판단 요청을 제안하는 판단 입력이다.

필수 challenge focus를 압박하지 못했거나 Task contract 안에서 닫기 어려운 User 판단 지점이 남아 있으면 `passed`로 표현하지 않는다.

### Task Evidence

Task Evidence는 Task가 User 수용 판단으로 종료된 뒤 남기는 종료 요약 Evidence다.

Task Evidence는 YAML frontmatter + Markdown 형식으로 저장한다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`name`|string|Mission Spec의 `name`과 같은 Mission 식별자|
|`task_id`|string|Mission 안에서 Task를 식별하는 id|
|`evidence_type`|string|`task`|
|`task_contract_ref`|string|종료 요약 기준으로 삼은 Task Contract artifact 참조|
|`user_judgment_ref`|string|이 Task Evidence가 반영한 Task result User Judgment artifact 참조|

Markdown body에는 H1 없이 다음 section을 둔다.

|Section|내용|
|---|---|---|
|`Summary`|Task 결과 요약|
|`User Judgment Summary`|User의 Task 수용 판단 요약|
|`Criteria Results`|Task Contract 기준별 결과|
|`Accepted Unverified Scope`|User가 알고 받아들인 미검증 범위|
|`Accepted Remaining Risks`|User가 알고 받아들인 남은 위험|

Task Evidence는 Task를 다시 열지 않고도 결과, User 수용 판단, 기준별 근거, 받아들인 미검증 범위와 위험을 빠르게 확인할 수 있게 남기는 종료 요약이다. Criteria Results의 evidence refs에는 최신 Evidence뿐 아니라 재작업 후에도 여전히 유효한 이전 Evidence를 포함할 수 있다.

Criteria Results는 Task Contract의 `TC-AC-001:` 같은 기준별로 `Result`, `Evidence refs`, `Unverified scope`, `Remaining risks`를 드러낸다. Result 값은 `satisfied`, `satisfied_with_limits`, `not_satisfied` 중 하나다.

`satisfied`는 기준이 충족되었고 User가 별도 한계를 받아들이지 않아도 되는 상태다. `satisfied_with_limits`는 기준을 닫되 User가 알고 받아들인 미검증 범위나 남은 위험이 있는 상태다. `not_satisfied`는 기준이 닫히지 않은 상태이며 실패, 미검증, 보류된 판단, 재작업 필요를 포함할 수 있다.

### Mission Evidence

Mission Evidence는 User가 role Evidence, Task Evidence, gap, debt, follow-up 후보를 검토해 User Judgment를 남긴 뒤 작성하는 Mission 종료 요약이다.

Mission Evidence는 YAML frontmatter + Markdown 형식으로 저장한다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`name`|string|Mission Spec의 `name`과 같은 Mission 식별자|
|`evidence_type`|string|`mission`|
|`mission_spec_ref`|string|Mission Evidence가 대조한 Mission Spec artifact 참조|
|`mission_design_ref`|string|Mission Evidence가 대조한 Mission Design artifact 참조|
|`user_judgment_ref`|string|이 Mission Evidence가 반영한 Mission result User Judgment artifact 참조|

Markdown body에는 H1 없이 다음 section을 둔다.

|Section|내용|
|---|---|---|
|`Summary`|Mission 결과 요약|
|`User Judgment Summary`|User의 Mission 수용 판단 요약|
|`Mission Criteria Results`|Mission Spec 기준별 결과|
|`Mission Design Deltas`|Mission Design과 실제 진행의 차이|
|`Accepted Unverified Scope`|User가 알고 받아들인 미검증 범위의 최종 요약|
|`Accepted Remaining Risks`|User가 알고 받아들인 남은 위험의 최종 요약|
|`Gaps`|Mission 기준선과 실제 결과 사이에 남은 차이|
|`Debts`|현재 Mission에서 수용한 결과 안에 남는 이후 비용|
|`Follow Ups`|현재 Mission 밖에서 새로 다룰 수 있는 다음 작업 후보|
|`Reflection Summary`|회고 요약|
|`Memory Updates`|Mission 이후 Memory에 반영한 운영 지식 요약|

Mission Evidence는 Mission 전체를 다시 열어볼 때 출발점이다. Task별 상세 결과는 Task Evidence에 두고, Mission Evidence는 Mission 기준별 결과와 그 근거 참조를 남긴다.

Accepted Unverified Scope와 Accepted Remaining Risks는 User Judgment 이후 최종적으로 받아들인 한계와 위험을 요약한다. 기준별 한계와 위험은 Mission Criteria Results 안에 남긴다.

Mission Criteria Results는 Mission Spec의 `AC-001:` 같은 기준별로 `Result`, `Evidence refs`, `Unverified scope`, `Remaining risks`를 드러낸다. Result 값은 `satisfied`, `satisfied_with_limits`, `not_satisfied` 중 하나다.

`satisfied`는 기준이 충족되었고 User가 별도 한계를 받아들이지 않아도 되는 상태다. `satisfied_with_limits`는 기준을 닫되 User가 알고 받아들인 미검증 범위나 남은 위험이 있는 상태다. `not_satisfied`는 기준이 닫히지 않은 상태이며 실패, 미검증, 보류된 판단, 추가 Task 필요를 포함할 수 있다.

### User Judgment

User Judgment는 User가 Task 결과나 Mission 결과를 검토한 뒤 내린 결정을 남긴다.

User Judgment는 YAML frontmatter + Markdown 형식으로 저장한다.

Frontmatter에는 다음 field를 둔다.

|Key|Type|내용|
|---|---|---|
|`name`|string|Mission Spec의 `name`과 같은 Mission 식별자|
|`judgment_type`|string|`task-result` 또는 `mission-result`|
|`task_id`|string|Task result judgment일 때 Mission 안에서 Task를 식별하는 id. Mission result judgment에는 두지 않는다.|
|`decision`|string|User가 내린 결정. `accepted`, `accepted_with_limits`, `revise`, `deferred`, `stopped` 중 하나|

Markdown body에는 H1 없이 다음 section을 둔다.

|Section|내용|
|---|---|
|`Decision Trail`|Orchestrator가 제시한 판단 입력, User에게 올라간 선택지, User가 선택하거나 요청한 내용을 짧게 요약한 판단 흐름|
|`Accepted Unverified Scope`|User가 알고 받아들인 미검증 범위|
|`Accepted Remaining Risks`|User가 알고 받아들인 남은 위험|
|`Requested Actions`|요청한 수정, 재작업, 추가 Task, 보류, 중단|
|`Notes`|User가 남긴 추가 판단, 선호, 보류 이유, 다음에 다시 볼 조건|

User Judgment는 Evidence와 분리된 User 결정 원본이다. 판단 대상은 User Judgment 파일의 위치와 파일명으로 구분한다.

Decision Trail은 대화 전문이 아니다. User 수용 판단에 이르기까지 Orchestrator와 User 사이에서 오간 판단 입력과 선택 흐름을 복원할 수 있게 남기는 요약이다. Decision Trail은 agent Evidence나 verdict가 아니며, User의 결정을 대체하지 않는다.

`accepted`와 `accepted_with_limits`는 결과를 수용한 판단이다. `revise`는 현재 결과를 그대로 수용하지 않고, 재작업, Task Contract 갱신, 추가 Task, Mission 기준선 재검토, 폐기 중 필요한 조치를 요청하는 판단이다. 구체 조치는 `requested_actions`에 남긴다.

`deferred`는 판단 보류, `stopped`는 작업 중단을 뜻한다.

### Common Memory

Common Memory는 이후 작업에서 모든 role이 공통으로 적용할 운영 지식이다.

Common Memory는 반복 적용할 운영 지식 record의 목록이므로 YAML 형식으로 저장한다.

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

Role Memory는 반복 적용할 role별 운영 지식 record의 목록이므로 YAML 형식으로 저장한다.

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
|`current_stage`|string|`""`, `specifying`, `building`, `consolidating` 중 하나. 현재 Mission이 없으면 `""`|
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
      mission-spec-001.md
      mission-design-001.md
      mission-evidence.md
      user-judgment-result-001.md
      tasks/
        <task-id>/
          task-contract-001.md
          task-state.yaml
          implementation-evidence-001.md
          verification-evidence-001.md
          review-evidence-001.md
          challenger-evidence-001.md
          task-evidence.md
          user-judgment-result-001.md
```

`<mission-id>`와 `<task-id>`는 Runtime artifact가 Mission과 Task를 안정적으로 찾기 위한 id다.

Mission id는 `YYYYMMDD-<random>` 형식을 쓴다. `<random>`은 6자리 소문자 영문자와 숫자 조합이다.

Task id는 Mission 안에서 `task-001`, `task-002`처럼 3자리 증가 번호를 쓴다.

같은 Mission id 디렉토리가 이미 있으면 Mission id의 random 값을 다시 생성한다. 새 Task id는 Task Contract 작성자가 해당 Mission의 `tasks/` 아래에서 가장 큰 Task 번호에 1을 더해 정하고, `task contract record --task <task-id>`로 기록한다.

Run State는 `.geas/run-state.yaml`에 둔다.

Memory는 `.geas/memory/` 아래에 둔다. 공통 Memory는 `.geas/memory/common.yaml`에 두고, role별 Memory는 `.geas/memory/roles/<role>.yaml`에 둔다.

파일 하나는 하나의 Runtime artifact다. 반복 생성될 수 있는 artifact는 파일명 끝의 번호를 증가시켜 쌓는다.

Mission Spec, Mission Design, Task Contract는 versioned 기준선 artifact다. `mission-spec-NNN.md`, `mission-design-NNN.md`, `task-contract-NNN.md`처럼 파일명 끝의 번호를 증가시켜 남긴다.

기준선 draft는 Runtime artifact가 아니다. Runtime storage에 남은 Mission Spec, Mission Design, Task Contract는 User와 합의된 기준선으로 본다.

현재 Mission 기준선은 해당 Mission scope에서 가장 큰 번호의 `mission-spec-NNN.md`와 `mission-design-NNN.md`이다.

현재 Task 실행 기준선은 해당 Task scope에서 가장 큰 번호의 `task-contract-NNN.md`이다.

`task-state.yaml`은 현재 Task phase pointer다. Task scope 안에서 하나의 고정 파일명을 유지한다.

Mission Spec, Mission Design, Task Contract가 갱신되면 다음 번호의 versioned artifact로 남긴다. 기준선이 바뀐 이유와 영향은 `contract_deltas`, `mission_design_deltas`, 관련 Evidence, 종료 요약에 남긴다.

`user-judgment-result-NNN.md`는 결과 판단 시도 번호다. `task-evidence.md`와 `mission-evidence.md`는 최종 수용된 result judgment를 반영한 current summary다.

종료 요약, Task State, Run State, Memory는 고정 파일명을 쓴다.

artifact 참조는 `.geas/missions/<mission-id>/` 기준 상대 경로를 기본으로 쓴다. 같은 Task scope 안의 artifact를 참조할 때는 Task directory 기준 파일명을 쓸 수 있다. 기준선 artifact를 참조할 때는 versioned filename을 쓴다. 예: `mission-spec-001.md`, `tasks/task-001/task-contract-001.md`, `tasks/task-001/challenger-evidence-001.md`, `tasks/task-001/task-evidence.md`, `verification-evidence-002.md`.

## 책임 경계

Runtime artifact의 책임 경계는 다음과 같다.

- User 수용 판단은 Runtime artifact를 검토한 뒤 User Judgment로 남긴다.
- Evidence verdict는 User Judgment의 판단 입력으로 읽는다.
- Task State는 Evidence verdict나 User Judgment가 아니다.
- User는 Evidence와 User Judgment를 함께 대조해 완료 수용 여부를 판단한다.
- 회고 후보는 User 수용 판단 이후 Memory 반영 대상으로 검토한다.
- Mission Evidence는 User가 Mission 수용 판단을 남긴 뒤 gap, debt, follow-up, 회고, Memory 반영 결과를 종합한다.
- Runtime storage는 자동 완료 상태 파일을 만들지 않는다.
