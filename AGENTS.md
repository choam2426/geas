# Geas 문서 작업 기준

Geas 문서를 작성하거나 수정하기 전에 `docs/definition.md`를 먼저 읽고, 현재 정의와 문제의식에 맞춰 작업한다.

이 규칙은 이 repository에서 Geas 문서를 수정하는 작업자 규칙이다. 배포되는 Skill의 실행 절차나 prerequisite으로 repo root 문서 경로를 복사하지 않는다.

# Skill 배포 독립성

- Skill은 자기 `SKILL.md`와 같은 Skill 폴더 안의 `references/`, `scripts/`, `assets/`만으로 절차를 이해하고 실행하거나 안전하게 중단할 수 있어야 한다.
- Skill workflow는 repo root의 `docs/definition.md`, `docs/runtime.md`, `docs/cli.md`, `AGENTS.md` 같은 현재 repository 문서를 필수 입력으로 요구하지 않는다.
- Root docs는 이 repository를 작업 대상으로 다룰 때 읽을 수 있는 프로젝트 문서이며, Skill의 일반 실행 규칙으로 승격하지 않는다.
- 다른 Skill 폴더의 reference를 필수 실행 경로로 읽게 하지 않는다. 필요한 briefing, handoff, output shape는 해당 Skill 안에 두거나 caller가 제공하는 입력 계약으로 표현한다.
- CLI나 runtime write가 필요하지만 사용할 수 없으면, Skill은 payload나 briefing을 준비한 뒤 기록 불가 상태와 필요한 caller/User 결정을 드러낸다.

# Skill 작성과 감사 기준

- Frontmatter `description`에는 Skill이 하는 일, 사용 조건, 비사용 조건을 드러낸다.
- `SKILL.md`는 실행 흐름, 핵심 규칙, reference navigation만 담고, 긴 briefing shape, payload shape, Evidence shape, 예시는 내부 `references/`로 둔다.
- Workflow는 `inspect -> decide -> act or handoff -> output -> record or stop` 흐름이 보이게 쓴다.
- "필요하면", "적절히", "useful", "materially improves" 같은 표현은 trigger, 생략 조건, 생략 사유로 바꾼다.
- Caller는 role output을 직접 작성하지 않는다. Role handoff packet은 subagent에게 전달되는 실행 프롬프트이며, Caller는 packet을 만든 뒤 분리된 role handoff result를 기다린다.
- Role handoff packet에는 `read_first`를 넣는다. Role은 `read_first`에 있는 artifact path를 먼저 읽고 작업한다.
- Mission 안에서 실행되는 role은 존재하는 최신 accepted Mission Spec과 Mission Design을 `read_first`에 포함한다. Task-scoped role은 current Task Contract와 관련 Evidence도 포함한다.
- `read_first` path를 읽을 수 없으면 handoff 실패로 보고, caller는 role output을 대신 쓰지 않는다.
- Role이 필요한 artifact나 Evidence는 해당 role이 draft payload, candidate payload, 또는 Evidence payload를 작성한다. Coordinator는 이를 렌더링, 직렬화, 기록할 수 있지만 substantive content를 새로 쓰거나 채우지 않는다.
- Challenge finding을 반영해야 하면 원 artifact author에게 revision handoff를 보낸다. Coordinator가 직접 고치는 것은 User가 명시적으로 맡긴 기계적 문구 정리나 포맷팅에 한정한다.
- 각 산출물이 draft, Evidence, User Judgment, runtime artifact 중 무엇인지 구분한다. Agent verdict, recommendation, briefing은 User Judgment가 아니다.
- Transcript dry-run과 검색은 보조 검증으로 사용하되, 문자열 존재만으로 실패 처리하지 않는다.
- 주요 실패 패턴은 pre-scan 직후 Intake Sketch 없이 Mission Spec Review로 이동, work-designer decision 없이 Mission Design Review 작성, role handoff 뒤 coordinator가 role output을 작성, building context가 role Evidence를 직접 작성, role handoff 불가 시 caller가 role output을 대신 작성하는 것이다.

# Geas 설계 경계

- 인간의 검토와 수용 판단을 agent의 완료 선언, 자동 판단, 도구 실행 결과로 대체하지 않는다.
- 단순한 작업까지 과도한 문서, 승인, 역할 분리, 기록 형식을 강제하지 않는다.
- 빠른 생성을 억제하지 않고, 빠르게 만든 결과가 검토 가능한 작업 상태와 Evidence로 남게 한다.
- v2.x의 artifact, 상태, agent roster, dashboard, CLI, plugin 구조를 자동 계승하지 않는다.
- 특정 agent client, plugin 형식, CLI 구현, dashboard 구현에 종속되도록 정의하지 않는다.
- 초기 구현에서 CLI, skills, agents, plugin, dashboard의 모든 가능성을 한 번에 구현하려고 하지 않는다.

# Geas 문서 용어 구분

Geas 문서를 작성하거나 수정할 때 `검증`, `검토`, `수용 판단`을 섞어 쓰지 않는다.

- `검증`은 agent 쪽 행위다. 테스트 실행, 리뷰, 실행 출력 확인, 변경 내역 제시, 미검증 범위 드러내기처럼 인간이 판단할 근거를 준비하는 일을 뜻한다.
- `Evidence`는 검증 근거와 미검증 범위를 함께 정리한 근거 자료다.
- `검증 근거`는 agent가 남기는 확인 자료다. 예: 테스트 결과, 리뷰 결과, 실행 출력, 변경 내역.
- `미검증 범위`는 확인하지 못한 작업이나 범위다. 이는 검증 근거가 아니며, 검증 근거와 함께 드러내야 하는 한계다.
- `검토`는 인간 쪽 행위다. 인간이 Evidence를 읽고, 필요한 경우 직접 확인하는 일을 뜻한다.
- `수용 판단`은 인간 쪽 결정이다. 완료로 받아들일지, 재작업할지, 보류할지, 중단할지 판단하는 일을 뜻한다.
- 완료는 agent의 선언이 아니라, Evidence와 인간의 수용 판단 위에 성립한다.

# Writing rule

- Define in positive form.
- Put exclusions in a boundary section.
- Convert corrective feedback into a final baseline.
