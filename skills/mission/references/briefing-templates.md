# Briefing Templates (Korean)

사용자 대면 브리핑은 모두 한국어로 자연스러운 문장으로 출력한다. 네 종류의 템플릿이 있으며, `mission` 스킬이 각 시점에 맞춰 한 번씩 렌더링한다.

- **Current status** — `/mission` 호출 직후, 상태 점검을 마친 뒤 1회.
- **Task completion** — `closing-task` 또는 gate가 cancelled / escalated로 복귀했을 때 1회.
- **Phase transition** — `reviewing-phase`가 phase-review를 기록하고 phase가 다음 단계로 넘어간 직후 1회.
- **Mission verdict** — `verdicting-mission`이 mission verdict를 기록한 뒤, 사용자 최종 확인 직전 1회.

기본은 full 브리핑이다. 사용자가 `/mission --brief`로 짧게 요청하면 phase·완료 요약을 한 줄로 줄이되, 승인·escalated·드리프트 감지 같은 결정 지점에서는 항상 full 브리핑으로 돌아간다.

---

## User-facing vocabulary

브리핑 본문에는 아래 화이트리스트(allowlist)에 있는 protocol 어휘만 사용한다. 그 외의 거친 protocol 내부 용어는 블랙리스트(blacklist)에 모아두며, 등장하면 verifier가 fail로 간주한다.

### Allowlist

브리핑이 자연스럽게 사용해도 되는 사용자 대면 어휘:

- `mission`
- `task`
- `phase`
- `gate`
- `verdict`
- `drafted`
- `implementing`
- `reviewing`
- `deciding`
- `passed`
- `cancelled`
- `escalated`
- `blocked`
- `evidence`
- `review`
- `approve`
- `debt`
- `memory`
- `ready`
- `complete`

영문 식별자(예: `task-002`, `mission-20260427-xIPG1sDY`)와 phase 이름(`specifying`, `building`, `polishing`, `consolidating`)은 어휘가 아니라 고유 명칭이라 자유롭게 인용한다. 숫자, 시각, 제목 텍스트도 어휘 검사 대상이 아니다.

### Blacklist

아래 어휘는 사용자 대면 브리핑 본문에 등장하면 안 된다. 이들은 모두 protocol 내부 구조를 가리키는 단어이며 사용자에게는 의미가 없다.

- `slot`
- `tier`
- `evidence_kind`
- `task-state`
- `closure packet`
- `verify-fix`
- `base_snapshot`
- `gap_signals`
- `carry_forward`
- `FSM`
- `dispatcher`
- `surfaces`
- `deliberation`

블랙리스트 단어는 본 섹션과 fixture(verifier가 set 추출용으로 읽음)에서만 등장한다. 템플릿 본문, rendering rules, 그리고 emission SKILL.md의 사용자 대면 문장에서는 0건이어야 한다.

---

## 1. Current-status 브리핑

```
지금은 mission "{name}"({mission_id})의 {phase} phase 중간 시점입니다. task가 총 {total}개이며 {passed}개는 passed, {active}개는 진행 중, {blocked}개는 멈춰 있습니다. 가장 최근 활동은 {last_event}이고, 다음으로는 {next_action}을(를) 진행하려고 합니다.
```

**Rendering rules**

- `{active}`는 implementing, reviewing, deciding 상태인 task의 합계로 채운다.
- `{blocked}`는 blocked, escalated, cancelled를 합한 값.
- `{next_action}`은 곧 일어날 사용자 결정 또는 다음에 호출될 작업을 한 구절로 적는다.
- 드리프트나 이상 신호가 있으면 마지막에 한 문장을 덧붙여 사용자에게 알린다.

---

## 2. Task-completion 브리핑

```
task {task_id}({title})가 {result} 결과로 마무리됐습니다. 핵심 산출물은 {key_deliverable}이며, 이번 task에서 남긴 메모와 debt는 {memory_count}건과 {debt_count}건입니다. 이어서 {next_candidate}로 넘어갈 차례입니다.
```

**Rendering rules**

- `{result}`는 passed, cancelled, escalated 중 하나를 그대로 적는다.
- 결과가 cancelled나 escalated이면 두 번째 문장에 사유 한 구절을 덧붙인다.
- `{next_candidate}`가 phase 종료를 의미하면 곧 phase transition 브리핑이 이어진다는 한 줄을 추가한다.

---

## 3. Phase-transition 브리핑

```
mission이 {previous} phase를 마치고 {next} phase로 넘어왔습니다. 직전 phase에서는 task가 {passed_count}개 passed, {cancelled_count}개 cancelled, {escalated_count}개 escalated로 정리됐고, review가 {review_count}건 기록됐습니다. 새 phase에서는 {next_purpose}이(가) 핵심 활동이며 {exit_condition}에 도달하면 다시 다음 phase로 넘어갑니다.
```

**Rendering rules**

- `{next}`가 `complete`이면 이 템플릿 대신 mission-verdict 브리핑을 사용한다.
- `{next_purpose}`는 다음 phase에서 곧바로 호출될 작업을 한 구절로 적는다.
- 사용자가 phase 진입을 승인해야 진행되는 시점에서는 마지막에 "사용자 확인을 기다립니다." 한 문장을 덧붙인다.

---

## 4. Mission-verdict 브리핑

```
mission "{name}"({mission_id})이 모든 phase를 마쳤습니다. 전체 task {total}개 중 {passed}개가 passed로 끝났고, {definition_of_done_status}로 판단됩니다. 남은 debt {open_debt}건과 memory {memory_count}건은 다음 mission으로 이어집니다. 사용자 최종 확인 후 mission을 complete 상태로 전환합니다.
```

**Rendering rules**

- 이 브리핑은 항상 full 모드로 출력한다. `--brief`는 무시한다.
- `{definition_of_done_status}`는 "definition of done 충족" 또는 "definition of done 일부 미충족(이유: ...)" 같은 한 구절로 적는다.
- 마지막 문장의 사용자 최종 확인 안내는 사용자가 approve하기 전까지 반드시 유지한다. 사용자 approve 이후에만 `geas mission-state update --phase complete`를 호출한다.
