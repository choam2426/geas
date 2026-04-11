# Task-002: Skills/Agents 문서 sweep — stdin 패턴 전수 치환

## Goal
task-001에서 geas CLI write 계열 커맨드가 stdin-only로 전환됨. 이제 플러그인 skill 문서와 agent 문서에서 `--data '<json>'`, `--file <path>` 사용 예시를 stdin pipe/heredoc 패턴으로 전수 치환한다. 비-JSON 값 플래그(event log --data, context write --data, packet create --file/--content)는 손대지 않는다.

## Scope (surfaces, from contract)
- plugin/skills/mission/references/
- plugin/skills/vote-round/SKILL.md
- plugin/skills/verify-fix-loop/SKILL.md
- plugin/skills/task-compiler/SKILL.md
- plugin/skills/evidence-gate/SKILL.md
- plugin/skills/intake/SKILL.md
- plugin/skills/implementation-contract/SKILL.md
- plugin/skills/memorizing/SKILL.md
- plugin/agents/authority/challenger.md
- plugin/agents/software/qa-engineer.md

## 치환 원칙
1. **JSON 입력 예시 → stdin pipe/heredoc**
   - BEFORE: `geas task record add --task t1 --section self_check --data '{"confidence":4}'`
   - AFTER:  `geas task record add --task t1 --section self_check <<<'{"confidence":4}'`
2. **Bash 툴 호출 내부 예시도 동일**: 문서 내 Bash("geas ... --data '...'") 같은 예시는 heredoc 또는 pipe 형태로 재작성.
3. **비-JSON 값 플래그는 보존**: event log --data "message", context write --data "string", packet create --file foo.md, packet create --content "text" — 이 네 개 용례는 절대 건드리지 않는다. grep-verify 필수.
4. **가독성 유지**: 문서에서는 간결성이 우선이므로 <<<'{...}' 단일라인 기본. 긴 페이로드만 임시 파일 + 리다이렉션.

## 비목표
- plugin/bin/geas 리번들 (task-003)
- CLI 소스 수정 (task-001에서 완료)
- 한국어 번역 문서 동기화 (별도 미션)
- 프로토콜 스키마 변경

## 평가 명령
- grep -rE "geas [a-z-]+ .*--data '" plugin/skills/ plugin/agents/ → 0건 (비-JSON event/context 예외 제외)
- grep -rE "geas [a-z-]+ .*--file " plugin/skills/ plugin/agents/ → 0건 (packet create --file 예외 제외)

## 당부
이 단계는 Implementation Contract — planned_actions / edge_cases / state_transitions / non_goals / demo_steps 작성만. 코드/문서 수정은 다음 단계.
