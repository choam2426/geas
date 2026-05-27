# Agents

## 목적

5단계 Agents 작업은 Geas Skill이 호출할 수 있는 역할 prompt reference를 정의한다. Agent는 책임과 관점을 정의하고, 절차는 `docs/skills.md`와 각 Skill reference에 둔다.

이 문서는 어떤 Agent reference 파일을 둘지, 각 역할이 무엇을 책임지는지, Skill과 Agent가 어떻게 만나는지 정한다.

## 구조

```text
plugins/geas/skills/mission/references/agents/
  implementer.md
  verifier.md
  reviewer.md
  challenger.md
```

Orchestrator 책임은 `mission` entrypoint와 stage Skill 흐름 안에 있다.

## Agent 목록

| Agent | 책임 |
| --- | --- |
| `implementer` | 주어진 Task Contract 안에서 변경을 수행하고 Implementation Evidence에 필요한 사실을 남긴다. |
| `verifier` | agent-side 검증을 계획하고 실행하며 Verification Evidence를 준비한다. |
| `reviewer` | 변경과 Evidence를 점검해 Review Evidence를 준비한다. |
| `challenger` | 숨은 가정, 약한 기준, 범위 누수, 장기 비용, User-level tradeoff를 압박해 Challenger Evidence를 준비한다. |

## Skills와 Agents의 관계

Skill은 절차를 정의한다. Agent reference는 그 절차를 수행하는 역할의 태도, 책임, 판단 기준을 정의한다.

예를 들어 `reviewing` Skill은 review 단계의 절차와 Review Evidence 형식을 설명한다. `plugins/geas/skills/mission/references/agents/reviewer.md`는 Reviewer답게 무엇을 예민하게 보고, 어떤 위험 감각으로 판단하며, 어떤 말투로 근거와 한계를 드러낼지 설명한다.

기본 운영 모델은 Task 안의 역할별 책임 분리다. `implementer`가 만든 변경은 `verifier`와 `reviewer`가 별도 책임으로 바라보고, 필요하면 `challenger`가 다른 관점에서 압박한다.

Mission Plan과 Task Contract 작성은 Orchestrator와 `specifying` 흐름의 책임이며, 별도 Agent reference로 분리하지 않는다.

## Role Prompt 작성 기준

각 Agent reference 파일은 실행 가능한 완성 role prompt로 작성한다. Agent reference 파일은 절차가 아니라 페르소나, 책임 감각, 판단 성향을 담는다.

- 역할의 목적
- Mission과 Task 안에서 바라보는 관점
- 중요하게 여기는 품질과 위험
- Evidence를 다룰 때의 태도
- User 판단을 존중하는 방식
- 말투와 보고 성향
- 흔한 실패 모드와 회피 기준

Agent reference 파일은 영어로 작성한다. Geas 설계 문서는 한국어로 작성한다.

## Handoff Checklist

Handoff는 prompt/context checklist다. `mission` Skill은 Agent에게 일을 맡길 때 다음 정보를 담아야 한다.

- role
- Mission context
- Task context
- 읽어야 할 입력
- 요청 출력
- Evidence 종류
- 집중할 관점
- 책임 경계
- User에게 올려야 할 결정

이 checklist는 Agent가 같은 목표와 기준을 보도록 돕는다. 이후 Handoff를 artifact로 승격하려면 `docs/runtime.md`를 먼저 바꾼다.

## Evidence 책임

Agent는 User가 검토하고 판단할 근거를 준비한다. 수용 판단 책임은 User에게 있다.

| Agent | Evidence 책임 |
| --- | --- |
| `implementer` | 변경 내역, 실행한 작업, 남은 작업, 구현 중 발견한 한계를 드러낸다. |
| `verifier` | 실행한 검증, 결과, 실패, 미검증 범위를 드러낸다. |
| `reviewer` | 위험, 회귀 가능성, 누락, Evidence 품질, User가 판단해야 할 tradeoff를 드러낸다. |
| `challenger` | 숨은 가정, 약한 기준, 범위 누수, 장기 비용, 남은 불확실성을 드러낸다. |

## 구조 검증 기준

5단계의 검증은 구조 검증까지 수행한다.

- 위 4개 Agent reference 파일이 `plugins/geas/skills/mission/references/agents/`에 존재한다.
- Orchestrator 책임이 `mission` entrypoint와 stage Skill 흐름 안에 위치한다.
- 각 Agent reference 파일이 role prompt로 완성되어 있다.
- Agent reference 파일이 role prompt 범위에 머문다.
- Agent reference 파일이 절차, payload schema, workflow 전환을 정의하지 않는다.
- Agent 책임과 Skill 책임이 구분된다.
- User의 검토와 수용 판단 책임이 User에게 남아 있다.
