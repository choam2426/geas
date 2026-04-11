# Task-001: stdin 단일 입력 리팩터 (CLI)

## Goal
geas CLI의 write 계열 명령에서 JSON 입력 경로를 stdin으로 단일화한다. `--data`/`--file` 플래그를 제거하되, 비-JSON 값 플래그(event log --data, context write --data, packet create --file/--content)와 `evidence add`/`task record add`의 `--set` 단독 경로는 보존한다.

## Scope (surfaces)
- src/cli/src/lib/input.ts (핵심 변경)
- src/cli/src/lib/output.ts (NO_STDIN 에러 헬퍼)
- src/cli/src/commands/mission.ts, task.ts, evidence.ts, decision.ts, phase.ts, recovery.ts, evolution.ts
- src/cli/test/integration.js (약 17건 --file/--data 사용처 stdin pipe로 재작성)
- src/cli/src/lib/input.test.ts (신규 유닛 테스트)

## 핵심 제약 (acceptance criteria에서)
1. `readInputData()`는 0-arg 시그니처, stdin 전용. `--data`/`--file` 파라미터 완전 제거.
2. `process.stdin.isTTY === true`이면 NO_STDIN 에러 코드 + stderr에 heredoc/pipe/redirection 예시 → 즉시 throw. 무한 대기 금지.
3. `isTTY === undefined || false`면 TTY 가드 발동 안 함 (Claude Code Bash/CI 오발 방지).
4. 0바이트 stdin → 명확한 empty-stdin 에러. Windows `fs.readFileSync(0)` EAGAIN/EOF도 동일 처리.
5. 잘못된 JSON → 라인 정보 포함된 파싱 에러.
6. `evidence add`와 `task record add`: readInputData() try/catch로 감싸 빈 stdin + --set 단독 경로 허용. stdin JSON 먼저, --set이 덮어쓴다. 빈 stdin + --set도 없으면 에러.
7. `event.ts --data`, `context.ts(write) --data`, `packet.ts(create) --file/--content`는 변경 없이 보존 (비-JSON 값).
8. 유닛 테스트 케이스: isTTY=true 가드, 비-TTY stdin JSON 파싱, 0바이트 empty 에러, 잘못된 JSON 라인 힌트, isTTY=undefined 오발 없음, Windows readFileSync(0) EAGAIN/EOF 경로.
9. integration.js의 --file/--data 사용처를 execSync `input:` 옵션(stdin pipe)로 재작성.

## 평가 명령
- `cd src/cli && npm run build`
- `cd src/cli && npm test`

## 현재 base
base_snapshot: 7f76655 (main HEAD)

## Memory from orchestration-authority
- CLI eval_commands must include both build and bundle steps. (bundle is task-003)
- envelope.ts ENVELOPE_REGISTRY is centralized source for envelope defaults.

## 당부
이 단계(Implementation Contract)에서는 **코드를 작성하지 마라**. planned_actions / edge_cases / state_transitions / non_goals / demo_steps만 작성하고 status='draft'로 제출한다.
