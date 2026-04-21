# Briefing Templates (Korean)

사용자 대면 브리핑은 모두 한국어로 출력한다. 아래 네 종류의 템플릿이 있으며, `mission` 디스패처가 각 시점에 맞춰 렌더링한다.

- **Current status** — `/mission` 호출 직후, 상태 점검을 마친 뒤 1회.
- **Task completion** — `closing-task` 또는 `running-gate`가 cancelled/escalated로 복귀했을 때 1회.
- **Phase transition** — `reviewing-phase`가 phase-review를 기록하고 `mission-state update --phase`가 성공한 뒤 1회.
- **Mission verdict** — `verdicting-mission`이 mission-verdict를 기록한 뒤, `complete` 전환 직전 1회.

기본값은 full 브리핑이다. 사용자가 `/mission --brief`로 요청하면 phase/완료 요약만 1줄로 내보내되, 승인·에스컬레이션·드리프트 감지 같은 결정 지점에서는 항상 full 브리핑으로 전환한다.

---

## 1. Current-status 브리핑

```
━━━ Mission 현재 상태: {mission_id} — {name} ━━━
Mode         : {mode}
현재 phase   : {phase} ({phase 내 진행 위치})
마지막 활동  : {last event timestamp} — {summary}

진행 상황:
  Tasks        : {passed}/{active}/{blocked+escalated+cancelled} (총 {total})
  Phase-review : {count}건
  Open debts   : {count}

다음 예정 action: {dispatched sub-skill or user input required}

{드리프트·이상 시 ⚠ 경고 블록}
```

**렌더링 규칙**
- `{phase 내 진행 위치}`는 phase별로 의미가 다르다. specifying이면 "spec 승인 대기" / "task 초안 작성 중" 등, building이면 "batch 실행 중" / "gate 대기" 등.
- `active`는 implementing·reviewed·verified 상태를 합산한 값.
- `⚠ 경고 블록`은 artifact drift / 알 수 없는 상태 / CLI 거부 등이 있을 때만 붙인다.

---

## 2. Task-completion 브리핑

```
━━━ Task {task_id} 완료: {title} ━━━
결과         : passed | cancelled | escalated
risk_level   : {level}
경과         : verify-fix {n}회, evidence {m}개
주요 산출물  : {surfaces 기반 파일 목록}
gap signals  : {count}건{, 심각도 요약}
핵심 메모    : {closure evidence의 key findings}

다음 candidate: {next task or phase-end 임박 여부}
```

**렌더링 규칙**
- 결과가 `cancelled` 또는 `escalated`일 때는 "핵심 메모"에 사유(closure evidence rationale)를 반드시 포함한다.
- "다음 candidate"가 phase 종료가 임박했음을 가리키면, 곧이어 Phase-transition 브리핑이 출력될 것임을 한 줄로 예고한다.

---

## 3. Phase-transition 브리핑

```
━━━ Phase 전환: {previous} → {next} ━━━

[{previous} 결산]
  Tasks       : {passed}/{cancelled}/{escalated}
  기간        : {duration}
  Evidence    : {count} ({kind별 분포})
  Gap signals : {count} ({kind별})
  Debt 신규   : {count} (누적 {total} open)
  Phase-review 요지: {summary 발췌}

[{next} 시작]
  Phase 목적 : {one-line}
  진입 조건  : ✓
  주요 activity: {2–4 bullets}
  종료 조건  : {exit criteria}
```

**렌더링 규칙**
- `{next}`가 `complete`면 이 템플릿 대신 Mission-verdict 브리핑을 사용한다.
- "주요 activity"는 다음 phase에서 곧바로 디스패치될 sub-skill을 기준으로 요약한다.

---

## 4. Mission-verdict 브리핑

```
━━━ Mission 완료 예정: {mission_id} — {name} ━━━
Mode           : {mode}
전체 기간      : {start → end}
Tasks          : {passed}/{cancelled}/{escalated} (총 {total})
Phase-review   : {count}
Deliberation   : {count}
Debt 누적      : {open} open / {resolved} resolved
Memory update  : shared {s}건, agent {a}건

Definition of done 달성도: {mission-spec.definition_of_done vs actual}

Acceptance criteria:
  {criterion별 ✓/✗ 및 증빙}

Carry-forward: {mission-verdict.carry_forward}

사용자 최종 확인 필요.
```

**렌더링 규칙**
- 이 브리핑은 항상 full 모드로 출력한다. `--brief`는 무시한다.
- "사용자 최종 확인 필요."는 사용자 승인 전까지 반드시 유지한다. 승인 후에만 `mission-state update --phase complete`를 호출한다.
