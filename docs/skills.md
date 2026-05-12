# Skills

## 목적

5단계 Skills 작업은 Geas의 실행 절차를 Codex Skill 형태로 고정한다. Skill은 Mission을 만들고, Task를 수행하고, Evidence를 준비하고, User의 검토와 수용 판단으로 이어지는 절차를 담는다.

이 문서는 5단계에서 만들 Skill의 구조와 책임 경계를 정한다. 실제 plugin packaging, 노출 방식, 설치 방식은 6단계에서 확정한다.

## 성공 상태

5단계가 끝나면 다음 상태가 성립한다.

- `mission` Skill이 User entrypoint와 Orchestrator 역할을 맡는다.
- 내부 절차 Skill은 `specifying`, `building`, `implementing`, `verifying`, `reviewing`, `challenging`, `consolidating`으로 구성된다.
- 각 Skill은 `SKILL.md`와 필요한 `references/` 파일을 가진다.
- `geas-cli` Skill은 CLI 실행 방법과 bundled `scripts/geas`를 제공한다.
- 각 절차 Skill은 자기 단계에서 직접 쓰는 CLI 명령을 절차 안에 녹이고, 전체 실행 참조는 `geas-cli`가 제공한다.
- Skill 문서는 절차를 담고, Agent reference 문서는 역할 정의를 담는다.
- Evidence는 agent가 준비하는 근거이며, 검토와 수용 판단은 User 쪽 행위로 유지된다.

## 구조

```text
skills/
  mission/
    SKILL.md
    references/
      dispatch.md
      briefings.md
      mission-closure.md
      session-handoff.md
      agents/
        work-designer.md
        implementer.md
        verifier.md
        reviewer.md
        challenger.md

  specifying/
    SKILL.md
    references/
      interview.md
      ambiguity-patterns.md
      mission-spec.md
      mission-design.md
      task-contract.md
      baseline-review.md

  building/
    SKILL.md
    references/
      task-loop.md
      task-closure.md
      git-checkpoint.md

  implementing/
    SKILL.md
    references/
      implementation-evidence.md

  verifying/
    SKILL.md
    references/
      verification-evidence.md

  reviewing/
    SKILL.md
    references/
      review-evidence.md

  challenging/
    SKILL.md
    references/
      challenger-evidence.md

  consolidating/
    SKILL.md
    references/
      mission-judgment-input.md
      reflection-memory.md

  geas-cli/
    SKILL.md
    scripts/
      geas
```

Skill 이름에는 plugin namespace가 붙는 상황을 전제로 하며, 디렉터리 이름은 기능 이름만 사용한다.

## Skill 목록

| Skill | 공개 범위 | 책임 |
| --- | --- | --- |
| `mission` | User entrypoint | Mission 전체 흐름을 잡고, 단계별 내부 Skill을 호출하며, User briefing과 Mission closure를 조율한다. |
| `specifying` | 내부 절차 | User와 상호작용해 목표, 범위, 성공 기준, 제약, Mission 진행 계획, Task 계약 baseline을 만든다. |
| `building` | 내부 절차 | building 단계의 Task loop, Task User Judgment, Task Evidence, Task 종료 checkpoint, 다음 Task 또는 consolidating 전환을 조율한다. |
| `implementing` | 내부 절차 | Task Contract에 맞춰 변경을 수행하고 Implementation Evidence를 준비한다. |
| `verifying` | 내부 절차 | 테스트, 실행 확인, 정적 확인 등 agent-side 검증을 수행하고 Verification Evidence를 준비한다. |
| `reviewing` | 내부 절차 | 변경의 위험, 회귀 가능성, 누락, Evidence 품질을 점검하고 Review Evidence를 준비한다. |
| `challenging` | 내부 절차 | 숨은 가정, 범위 누수, 장기 비용, 약한 성공 기준, 미검증 범위를 압박해 Challenger Evidence를 준비한다. |
| `consolidating` | 내부 절차 | accepted Task Evidence를 Mission 기준으로 묶고, User의 Mission 수용 판단에 필요한 입력과 Memory 후보를 준비한다. |
| `geas-cli` | 지원 | Geas CLI 실행 방법과 bundled CLI script를 제공한다. |

## Skill 파일 작성 기준

`SKILL.md`는 해당 Skill을 언제 쓰는지, 어떤 순서로 진행하는지, 어떤 reference를 열어야 하는지, 어떤 Evidence를 준비하는지에 집중한다. 세부 운영 모델과 예시는 `references/`에 둔다.

각 Skill은 자신이 실제로 쓰는 CLI 명령만 설명한다. CLI 설명은 절차 안에서 필요한 순간과 기대 결과를 함께 다룬다.

Skill 원문은 영어로 작성한다. Geas 설계 문서는 한국어로 작성한다.

## Mission Skill

`mission`은 Geas 실행의 단일 User entrypoint다. Orchestrator 책임은 `mission` Skill 안에 녹아 있다.

`mission`은 다음 일을 담당한다.

- Mission 시작 시 기존 상태를 읽고 User의 목표를 파악한다.
- 필요한 시점에 stage 단위 내부 Skill을 고른다.
- Mission baseline, User briefing, stage handoff, Mission closure의 흐름을 연결한다.
- Mission 단위 User Judgment 이후 Mission Evidence를 정리한다.
- User가 판단해야 할 결정, tradeoff, 미검증 범위를 드러낸다.

`mission/references/dispatch.md`는 stage Skill을 언제 호출할지 다룬다. 5단계의 호출 모델은 prompt-level 절차 handoff다. 구체적인 plugin dispatch API나 skill 노출 정책은 6단계에서 다룬다.

`mission/references/agents/`는 role prompt reference를 담는다. `mission`은 필요한 역할 pass가 Evidence 품질을 높일 때 이 reference를 읽고 client별 subagent mechanism에 주입한다.

## Specifying Skill

`specifying`은 Mission 품질을 결정하는 핵심 단계다. 이 Skill은 User와 상호작용해 목표를 끝까지 끌어내는 고강도 요구 도출 절차다.

`specifying`은 다음 질문에 답할 수 있어야 한다.

- User가 실제로 달성하려는 상태는 무엇인가?
- 성공 여부를 무엇으로 판단할 수 있는가?
- User가 직접 결정해야 하는 기준과 agent에게 위임할 수 있는 기준은 무엇인가?
- 현재 요구가 애매한 지점은 어디인가?
- Mission을 어떤 Task Contract 단위로 나누면 Evidence와 User Judgment가 자연스럽게 이어지는가?
- 어떤 baseline을 잡아야 이후 구현, 검증, review, challenge가 같은 목표를 보게 되는가?

Mission Spec 작성 전에 `specifying`은 intake를 통해 User 요청을 Baseline Candidate로 구체화한다. 이 candidate는 목표, 범위, Evidence와 review path, decision ownership, review cost를 담고, User가 Mission Spec 초안의 basis로 수용하거나 수정할 수 있어야 한다.

구현 전에 요구사항 도출, acceptance criteria, scope boundary, clarifying questions, Definition of Done, user story, Jobs-to-be-Done, risk framing 같은 실무적 기법을 리서치하고 최종 reference에 반영한다. 리서치 결과를 별도 문서로 남기는 대신 `interview.md`, `ambiguity-patterns.md`, `mission-spec.md`, `mission-design.md`, `task-contract.md`, `baseline-review.md`에 흡수한다.

`specifying` 중 `mission`은 Mission의 중요도, 애매함, 되돌리기 어려운 결정, 약한 성공 기준, User 위임 수준을 보고 Challenger 호출을 User에게 권장할 수 있다. 이 호출은 baseline 형성의 깊이와 비용을 바꾸므로 User의 동의를 받아 진행한다.

## Building Skill

`building`은 Mission의 building 단계 안에서 Task 수용 loop를 운영한다.

`building`은 다음 일을 담당한다.

- 현재 Task State와 Task Contract를 읽고 다음 Task phase를 고른다.
- `implementing`, `verifying`, `reviewing`, 조건부 `challenging`을 호출한다.
- Task Judgment briefing을 준비하고 User의 Task 수용 판단으로 이어지게 한다.
- Task 수용 판단 이후 Task Evidence를 정리한다.
- accepted Task 이후 git checkpoint를 권장하거나 User가 명시한 경우 수행한다.
- 다음 Task로 이동하거나 Mission을 `consolidating`으로 전환한다.

`building`은 새 runtime stage가 아니다. 이미 존재하는 `building` stage의 실행 절차를 Skill로 분리한 것이다.

## Implementing, Verifying, Reviewing

`implementing`은 `building`에서 호출되며 Task Contract에 맞는 변경을 수행한다. 변경의 요약, 영향을 받은 파일, 실행한 명령, 남은 작업을 Implementation Evidence로 준비한다.

`verifying`은 `building`에서 호출되며 agent 쪽 검증을 맡는다. 테스트 실행, 실행 출력 확인, 정적 확인, 실패 로그, 확인하지 못한 범위를 Verification Evidence로 준비한다.

`reviewing`은 `building`에서 호출되며 구현 결과와 Evidence의 질을 점검한다. 버그 위험, 회귀 가능성, 누락된 테스트, 설계 기준 위반, User가 알아야 할 tradeoff를 Review Evidence로 준비한다.

기본 순서는 다음과 같다.

```text
implementation -> verification -> review -> optional challenge -> User Judgment
```

## Challenging Skill

`challenging`은 조건부로 호출되는 독립 Skill이다. 목적은 baseline과 Evidence가 놓친 가정과 비용을 드러내는 것이다.

호출 기준은 다음과 같다.

- Task가 runtime, CLI, schema, data, permission/security, deployment/migration, critical baseline을 건드린다.
- 의미 있는 미검증 범위가 남아 있다.
- Verification Evidence나 Review Evidence의 근거가 약하다.
- Mission 범위가 새어 나갈 가능성이 있다.
- User가 판단해야 할 tradeoff가 숨겨져 있다.

Challenger finding이 없을 때도 초점과 근거를 남긴다. 이는 challenge가 바라본 관점과 한계를 설명하는 기록이다.

## Consolidating Skill

`consolidating`은 Mission 수용 판단의 입력을 준비한다. accepted Task Evidence를 Mission Spec과 Mission Design에 대조하고, 남은 gap, debt, follow-up, memory 후보, 미검증 범위, remaining risk를 정리한다.

Task Evidence는 `building`이 Task User Judgment 이후 정리한다. `consolidating`은 Mission-level 판단 입력을 준비한다.

Mission Evidence는 User의 Mission 수용 판단 이후 `mission`이 정리한다. Memory record는 User가 Mission을 수용한 뒤에 조율한다.

## CLI 연결

CLI는 runtime artifact를 쓰는 수단이다. Skill은 CLI를 절차 안에서 사용하고, Draft는 working draft로 유지한다.

각 Skill은 다음 원칙으로 CLI를 설명한다.

- 해당 Skill이 직접 쓰는 명령만 포함한다.
- 명령의 목적과 기대되는 상태 변화를 함께 설명한다.
- `docs/cli.md`의 명령 이름과 인자를 따른다.
- Evidence에 포함할 출력과 User에게 briefing할 요약을 구분한다.

## 구조 검증 기준

5단계의 검증은 구조 검증까지 수행한다.

- 8개 절차 Skill 디렉터리와 `geas-cli` 지원 Skill 디렉터리가 존재하고 각 디렉터리에 `SKILL.md`가 있다.
- 각 `SKILL.md`의 frontmatter 이름과 설명이 Skill 책임과 맞는다.
- 위 구조에 포함된 `references/` 파일과 Agent reference 파일이 존재한다.
- Skill 이름이 기능 이름으로만 구성되어 있다.
- 각 Skill이 자신의 `references/`를 가진다.
- `mission`이 Orchestrator 책임을 담는다.
- 각 Skill의 CLI 사용법이 `docs/cli.md`와 맞는다.
- Evidence, 검증, User의 검토, User Judgment의 책임 경계가 유지된다.
- `specifying` reference는 리서치 기반의 목표 도출 절차를 반영한다.
