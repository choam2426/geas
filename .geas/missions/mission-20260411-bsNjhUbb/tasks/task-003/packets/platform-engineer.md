# Task-003: Bundle + Verify

## Goal
task-001(CLI stdin 리팩터)과 task-002(docs stdin 전수 치환)가 완료된 상태에서, `cd src/cli && npm run build && npm run bundle`로 `plugin/bin/geas`를 재생성하고, 레포 전수 grep 가드 + 번들 내부 문자열 검사로 JSON 용례의 `--data/--file`이 0건임을 교차 검증한다. 또한 번들된 바이너리로 실제 write 명령 스모크 테스트를 stdin pipe/heredoc/redirection 세 형태로 실행하고, TTY 시뮬레이션으로 hang 없는 종료를 확인한다.

## Scope
- plugin/bin/geas (번들 산출물)
- src/cli/package.json
- src/cli/esbuild.config.mjs

## Key Checks
1. `cd src/cli && npm run build && npm run bundle` exit 0
2. `cd src/cli && npm test` exit 0
3. `plugin/bin/geas` 내부 strings 검사: JSON 입력용 `--data`/`--file` 옵션 선언 0건 (event log --data, context write --data, packet create --file/--content만 허용)
4. 레포 전수 grep: src/cli/, plugin/skills/, plugin/agents/, src/cli/test/ — JSON 입력 의도 사용처 0건 (화이트리스트 제외)
5. 스모크 테스트 3건 with bundled binary:
   - `echo '{"id":"test","title":"t"}' | ./plugin/bin/geas mission write-spec`
   - `./plugin/bin/geas task create <<'EOF' ... EOF`
   - `./plugin/bin/geas evidence add ... < /tmp/ev.json`
6. TTY 시뮬레이션: child_process.spawn + 1초 타임아웃 → non-zero exit, hang 없음

## Memory
- orchestration-authority: Agent worktree 비영속; 절대경로 사용
- software-engineer: 존재하지 않는 서브커맨드 참조 시 remap 문서화
- technical-writer: docs sweep은 per-file grep hit count 선계산

## 당부
이 단계에서는 코드 작성 금지 — planned_actions / edge_cases / state_transitions / non_goals / demo_steps만. status='draft'.
