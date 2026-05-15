# Skill 리팩토링 로드맵

## 요약

이 로드맵은 v3 Skill 체계를 처음부터 설계하고 작성하는 계획이다.

새 기준선은 먼저 `docs/skills.md`에서 확정하고, 그 다음 각 Skill의 `SKILL.md`를 작성한다. `references/`, `scripts/`, `assets/`는 `SKILL.md`가 안정된 뒤 필요한 것만 추가한다.

## 성공 상태

리팩토링은 다음 상태에 도달하면 완료로 본다.

- `docs/skills.md`가 v3 Skill 체계의 기준 문서로 재작성되어 있다.
- 각 Skill의 존재 이유, 책임, 비책임, 입력, 출력, 기록 지점이 명확하다.
- 각 `SKILL.md`는 새 기준에 맞춰 처음부터 작성되어 있다.
- 각 Skill은 자기 폴더 안의 `SKILL.md`, `references/`, `scripts/`, `assets/`만으로 실행 흐름을 이해하거나 안전하게 중단할 수 있다.
- `description`은 trigger 계약으로 기능하며, 무엇을 하는지와 언제 쓰는지가 모두 드러난다.
- Skill 본문은 짧고 절차 중심이며, 긴 산출물 형식과 예시는 reference로 분리되어 있다.
- agent가 만드는 draft, Evidence, runtime record, User Judgment가 구분되어 있다.
- 인간의 검토와 수용 판단을 agent verdict나 자동 판단으로 대체하지 않는다.
- CLI 기록은 `geas-cli` Skill과 현재 CLI 계약을 기준으로 연결된다.
- 주요 workflow dry-run이 recordable output 또는 명확한 stop condition에 도달한다.

## 경계

이 로드맵은 Skill 체계와 Skill 문서 재작성에 한정한다.

제외 범위:

- CLI 명령 재설계
- runtime model 재설계
- dashboard 구현
- plugin packaging 변경
- 과거 Mission/Task 기록 migration
- filesystem 정리 자동화
- 호환 레이어 작성

## 기본 원칙

- `docs/skills.md`를 먼저 재작성하고, 이후 모든 Skill 작성은 그 문서를 기준으로 진행한다.
- `writing-good-skills.md`를 Skill 작성 베이스라인으로 삼는다.
- `SKILL.md`를 먼저 작성하고, reference와 script는 나중에 필요가 확인된 것만 추가한다.
- 각 Skill은 독립 배포 가능해야 한다.
- repo root 문서를 Skill 실행 prerequisite으로 만들지 않는다.
- 다른 Skill 폴더의 reference를 필수 실행 경로로 만들지 않는다.
- coordinator는 role output의 substantive content를 대신 쓰지 않는다.
- Role output이 필요하면 role handoff 결과를 기다리거나 stop condition을 드러낸다.
- 완료는 agent 선언이 아니라 Evidence와 인간의 수용 판단 위에 성립한다.

## 작성 기준

`writing-good-skills.md`를 Skill 작성 품질 기준으로 사용한다. `docs/skills.md`는 이 기준을 v3 Skill 체계에 적용한 설계 문서가 되어야 한다.

Frontmatter 기준:

- `name`과 `description`만 사용한다.
- `name`은 소문자, 숫자, 하이픈만 사용한다.
- `name`은 64자 이하로 둔다.
- `description`은 3인칭으로 쓴다.
- `description`에는 Skill이 하는 일과 사용할 조건을 모두 넣는다.
- `description`에는 실제 trigger 단어, workflow 단어, 파일 확장자, domain 단어를 넣는다.
- 인접 Skill과 충돌할 수 있으면 negative scope를 넣는다.
- `description`은 1024자 이하로 둔다.

본문 기준:

- 명령형 절차로 쓴다.
- 본문은 500줄 이하를 목표로 한다.
- 한 개념에는 한 용어만 사용한다.
- 긴 briefing shape, artifact shape, handoff packet, 예시는 `references/`로 분리한다.
- 다단계 workflow에는 checklist를 둔다.
- 중요한 검증 작업에는 `검증 -> 수정 -> 재검증` loop를 둔다.
- 강한 제약은 반복적인 `MUST`, `NEVER`, `ALWAYS`보다 이유와 stop condition으로 표현한다.

Progressive disclosure 기준:

- Tier 1은 frontmatter `name`과 `description`이다.
- Tier 2는 `SKILL.md` 본문이다.
- Tier 3은 필요할 때만 읽거나 실행하는 `references/`, `scripts/`, `assets/`다.
- 모든 필수 reference는 `SKILL.md`에서 직접 링크한다.
- 100줄이 넘는 reference에는 목차를 둔다.
- Skill 문서 안의 경로는 forward slash를 사용한다.

Resource 기준:

- 반복적이고 결정적인 작업은 `scripts/`로 둔다.
- script는 실패 시 바로 고칠 수 있는 오류 메시지를 낸다.
- domain 설명, 산출물 형식, 예시는 `references/`로 둔다.
- 출력물에 실제로 쓰이는 템플릿, 이미지, 폰트, 샘플 파일은 `assets/`로 둔다.

## Phase 1: `docs/skills.md` 재작성

목표: v3 Skill 체계의 기준 문서를 먼저 만든다.

작업:

- `docs/skills.md`를 새 설계 문서로 재작성한다.
- `writing-good-skills.md`의 frontmatter, progressive disclosure, resource 분리 기준을 `docs/skills.md`의 baseline으로 반영한다.
- v3에 필요한 Skill 목록을 다시 정의한다.
- 각 Skill의 책임과 비책임을 명확히 쓴다.
- 각 Skill이 받는 입력과 내는 출력을 정의한다.
- 각 Skill이 기록하거나 기록하지 않는 runtime artifact를 정의한다.
- Skill 간 handoff 경계를 정의한다.
- role handoff가 필요한 지점과 role output 책임자를 정의한다.
- `geas-cli` Skill의 위치를 runtime write adapter로 정의한다.
- Skill 작성 기준을 `description`, progressive disclosure, references/scripts/assets 기준으로 정리한다.
- 각 Skill 폴더의 resource blueprint를 정의한다.
- 각 Skill의 `references/` 후보와 각 reference가 읽히는 workflow 단계를 정의한다.
- 각 Skill의 `scripts/` 필요 여부와 script 후보의 반복적·결정적 책임을 정의한다.
- 각 Skill의 `assets/` 필요 여부와 실제 output 사용 근거를 정의한다.
- 만들지 않을 resource를 명시해 불필요한 파일 생성을 막는다.

완료 기준:

- `docs/skills.md`만 읽어도 새 Skill 체계가 설명된다.
- 각 Skill의 존재 이유가 한 문장으로 설명된다.
- 각 Skill의 non-goal이 명시되어 있다.
- stage Skill과 role-producing workflow의 경계가 분리되어 있다.
- Skill이 repo root 문서를 필수 실행 입력으로 요구하지 않는다는 기준이 들어 있다.
- 각 Skill의 `references/`, `scripts/`, `assets/` 계획이 포함되어 있다.
- 각 resource 후보에는 Skill body가 아니라 resource로 분리하는 이유가 적혀 있다.
- `SKILL.md` 작성 전에 확정해야 할 open decision이 드러난다.

검증:

- `docs/skills.md` 안에 이전 구조를 자동 계승하는 표현이 없는지 확인한다.
- `docs/skills.md` 안에서 agent verdict가 User Judgment를 대체하지 않는지 확인한다.
- Skill 목록과 책임이 `docs/definition.md`의 문제의식과 충돌하지 않는지 확인한다.
- `docs/skills.md` 안에 `writing-good-skills.md` 기준이 반영되어 있는지 확인한다.
- 모든 resource 후보가 `reference`, `script`, `asset`, `none` 중 하나로 분류되어 있는지 확인한다.
- `rg "dashboard|자동 계승|agent verdict|자동 판단" docs/skills.md`

## Phase 2: 공통 `SKILL.md` 계약 확정

목표: 모든 새 `SKILL.md`가 따를 공통 뼈대를 정한다.

작업:

- 공통 section 구조를 정한다.
- frontmatter description checklist를 만든다.
- reference navigation 규칙을 정한다.
- CLI recording 규칙을 정한다.
- role handoff 규칙을 정한다.
- gotcha 작성 기준을 정한다.
- stop condition 규칙을 정한다.
- scripts/references/assets 선택 기준을 정한다.

권장 section:

- `Job`
- `Workflow`
- `Inputs`
- `Resources`
- `Gotchas`
- `Stop Conditions`
- `Boundary`

완료 기준:

- 위 section 구조로 단일 Skill 초안을 작성할 수 있다.
- `description`이 trigger 계약을 맡고, body는 실행 절차에 집중한다.
- `Workflow`가 상태 확인, 실행 또는 handoff, User decision, record or stop 경로와 종료 형태를 보여준다.
- `Resources`가 직접 reference 링크나 직접 실행 script만 사용한다.
- `Gotchas`가 반복 경계 위반을 드러낸다.
- `Stop Conditions`가 user decision, missing input, unreadable reference, unavailable CLI write를 다룬다.

검증:

- 하나의 간단한 Skill에 template을 적용한다.
- 본문이 500줄 이하인지 확인한다.
- 필수 실행 정보가 숨은 reference에만 들어 있지 않은지 확인한다.

## Phase 3: `mission`과 `geas-cli` 먼저 작성

목표: entrypoint와 runtime write adapter를 먼저 안정화한다.

작업:

- `mission/SKILL.md`를 새로 작성한다.
- `mission`을 user entrypoint와 coordinator로 정의한다.
- `mission`이 stage Skill을 선택하는 규칙을 정의한다.
- `mission`이 role output을 대신 쓰지 않는 규칙을 정의한다.
- `geas-cli/SKILL.md`를 새로 작성한다.
- `geas-cli`가 readable `.md` artifact와 runtime `.yaml` data를 구분하도록 쓴다.
- `geas-cli`가 CLI write 실패 시 payload 또는 briefing만 남기고 stop하도록 쓴다.

완료 기준:

- `mission`은 전체 workflow를 조율하지만 stage 세부 절차를 내장하지 않는다.
- `geas-cli`는 다른 Skill들이 CLI 기록 방식을 복사하지 않게 만드는 단일 기준이 된다.
- Mission Evidence는 accepted Mission Judgment 이후에만 기록되는 것으로 설명된다.

검증:

- 새 Mission 시작 dry-run
- accepted Task Evidence 이후 Mission closure dry-run
- `skills/geas-cli/scripts/geas --help`

## Phase 4: Skill별 수직 작성

목표: 한 번에 하나의 Skill을 `SKILL.md`, 필요한 `references/`, 필요한 `scripts/`, 필요한 `assets/`, dry-run까지 함께 안정화한다.

순서:

1. `specifying`
2. `building`
3. `implementing`
4. `verifying`
5. `reviewing`
6. `challenging`
7. `consolidating`

각 Skill 작업:

- 새 `SKILL.md`를 작성한다.
- description에 trigger 단어와 negative scope를 넣는다.
- `Job`에 Skill 책임과 concrete output을 넣는다.
- `Workflow`에 단계별 실행, handoff, User decision, record or stop 흐름과 종료 형태를 둔다.
- `Inputs`를 명확히 구분한다.
- `Gotchas`에 반복 경계 위반을 넣는다.
- Evidence, draft, briefing, runtime record를 구분한다.
- role handoff가 필요하면 handoff packet과 `read_first` 요구를 둔다.
- CLI 기록 지점은 `geas-cli` 기준으로 연결한다.
- 실행에 필요한 reference만 해당 Skill 폴더 안에 만들고 `SKILL.md`에서 직접 링크한다.
- 반복적이고 결정적인 검증이나 CLI wrapper가 필요한 경우에만 script를 만든다.
- 실제 output 생성에 쓰이는 경우에만 asset을 만든다.
- 만들지 않을 resource를 명시해 placeholder 생성을 막는다.

완료 기준:

- 각 Skill은 자기 책임만 설명한다.
- 각 Skill은 다른 Skill reference를 필수로 읽게 하지 않는다.
- 각 Skill은 repo root docs를 prerequisite으로 요구하지 않는다.
- 각 Skill은 기록 가능 상태와 중단 상태를 모두 설명한다.
- 각 Skill에 필요한 reference/script/asset만 남아 있다.
- resource가 없는 경우에는 왜 없는지 `Resources`에 드러난다.

검증:

- Skill별 정상 흐름 dry-run
- Skill별 missing input dry-run
- adjacent Skill trigger 충돌 검토
- `rg "\\.\\./|skills/" skills/*/SKILL.md skills/*/references`
- `rg "\\\\" skills/*/SKILL.md skills/*/references`
- reference가 100줄을 넘으면 목차가 있는지 확인
- script가 있으면 대표 성공 케이스와 실패 케이스 실행
- asset이 있으면 inbound reference 확인

## Phase 5: cross-Skill 정합성 검토

목표: Skill별 수직 작성 후 전체 Skill set의 reference, handoff, trigger 경계가 서로 충돌하지 않는지 검토한다.

작업:

- 모든 필수 reference가 owner Skill 폴더 안에 있는지 확인한다.
- 중첩 reference chain을 제거한다.
- Skill 간 trigger 충돌과 책임 중복을 검토한다.
- stage handoff와 role handoff의 용어를 분리한다.
- runtime record 지점이 `geas-cli` 기준으로 연결되는지 확인한다.
- 같은 artifact shape가 여러 Skill에 중복 설명되어 있으면 owner Skill 기준으로 줄인다.

완료 기준:

- 모든 필수 reference는 `SKILL.md`에서 직접 링크된다.
- reference는 해당 Skill 폴더 안에 있다.
- reference는 repo root 문서를 필수 실행 입력으로 요구하지 않는다.
- reference 하나가 여러 책임을 섞지 않는다.
- role-producing output의 substantive content를 caller가 대신 쓰는 흐름이 없다.

검증:

- `rg "\\.\\./|skills/" skills/*/SKILL.md skills/*/references`
- `rg "docs/(definition|runtime|cli|agents|skills)\\.md|AGENTS\\.md" skills`
- 수동으로 100줄 초과 reference 목차 확인

## Phase 6: scripts/assets 감사

목표: Skill별로 추가된 script와 asset이 실제 실행 또는 output 생성에 필요한지 감사한다.

작업:

- 반복적이고 결정적인 검증 작업만 script로 남긴다.
- CLI wrapper가 실제로 필요한지 확인한다.
- script 실패 메시지가 실행자가 바로 고칠 수 있는 정보를 주도록 작성한다.
- output template이 실제로 쓰이는 경우에만 `assets/`를 둔다.
- 불필요한 placeholder와 예시 파일을 만들지 않는다.

완료 기준:

- 각 script는 실행 목적과 입력/출력을 설명한다.
- 각 script는 대표 성공 케이스와 실패 케이스로 확인된다.
- 각 asset은 실제 output 생성에 쓰인다.

검증:

- 대표 script 실행
- 실패 입력 실행
- asset inbound reference 확인

## Phase 7: dry-run 검증

목표: 새 Skill 체계가 실제 요청에서 작동하는지 확인한다.

최소 시나리오:

- 새 Mission intake에서 Mission Spec과 Mission Design 후보까지
- Mission Design에서 Task Contract 후보까지
- Task Contract에서 Implementation Evidence까지
- Verification 실패에서 User Judgment briefing까지
- Review finding에서 revision handoff까지
- Challenge finding에서 artifact author revision handoff까지
- accepted Task Evidence에서 Mission Judgment briefing까지
- Mission Judgment 이후 Debt, Memory, Mission Evidence까지

완료 기준:

- 각 dry-run은 recordable output 또는 명확한 stop condition으로 끝난다.
- stop condition은 필요한 user/caller 결정을 드러낸다.
- role output이 필요한 경우 coordinator가 대신 작성하지 않는다.
- CLI 기록 실패 시 payload와 기록 불가 상태가 드러난다.

검증:

- dry-run transcript 검토
- frontmatter trigger 충돌 검토
- Evidence와 User Judgment 경계 검토

## Phase 8: 적용 및 정리

목표: 검증된 Skill set을 최종 구조로 정리한다.

작업:

- 한 번에 하나의 Skill 또는 작게 묶인 Skill 그룹만 적용한다.
- 적용 전 dry-run 결과를 확인한다.
- 새 Skill에 필요한 reference/script/asset만 남긴다.
- 제거되는 파일의 inbound reference를 확인한다.
- cohesive 단위로 커밋한다.

권장 커밋 단위:

- `docs/skills.md`
- 공통 Skill template 또는 기준 문서
- `mission`과 `geas-cli`
- `specifying`
- `building`
- `implementing`, `verifying`, `reviewing`
- `challenging`
- `consolidating`
- 최종 reference/script cleanup

완료 기준:

- 새 Skill set만 남아 있다.
- 제거된 파일에 대한 참조가 없다.
- dry-run 검증 결과가 남아 있다.
- 최종 구조가 `docs/skills.md`와 일치한다.

검증:

- `git status --short`
- `rg "<removed-file-name>|old reference title" skills docs`
- `rg "docs/(definition|runtime|cli|agents|skills)\\.md|AGENTS\\.md" skills`

## Open Decisions

- v3 Skill 수와 stage Skill 분리 단위를 결정해야 한다.
- role prompt를 `mission` 아래에 둘지 stage-owned reference로 옮길지 결정해야 한다.
- dry-run transcript를 repo fixture로 남길지 review note로만 둘지 결정해야 한다.
- reference link/frontmatter 검증 script를 새로 만들지 결정해야 한다.
