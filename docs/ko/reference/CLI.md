# Geas CLI 레퍼런스

Geas CLI는 `.geas/` 런타임 상태 디렉터리에 대한 원자적(atomic) 읽기/쓰기를 수행하는 명령줄 도구이다. 모든 `.geas/` 파일 쓰기는 반드시 이 CLI를 통해야 하며, CLI가 타임스탬프 관리와 스키마 검증을 자동으로 처리한다.

## 설치 위치

```
plugin/bin/geas
```

## 전역 옵션

| 옵션 | 설명 |
|------|------|
| `-V, --version` | 버전 번호 출력 |
| `--cwd <path>` | 작업 디렉터리 경로 지정 (기본값: 현재 디렉터리) |
| `--json` | JSON 형식으로 출력 강제 (기본값: true) |
| `-h, --help` | 도움말 표시 |

## 명령어 개요

| 카테고리 | 명령어 | 설명 |
|----------|--------|------|
| 상태 관리 | `state` | 실행 상태(run.json) 및 체크포인트 관리 |
| 미션 관리 | `mission` | 미션 생성, 스펙/디자인 브리프 작성 및 읽기 |
| 태스크 관리 | `task` | 태스크 생성, 상태 전이, 실행 기록, 검증 |
| 근거 관리 | `evidence` | 역할 기반 근거 파일 생성 및 읽기 |
| 이벤트 관리 | `event` | 이벤트 원장(JSONL)에 기록 추가 |
| 잠금 관리 | `lock` | 동시성 제어를 위한 잠금 획득, 해제, 조회 |
| 부채 관리 | `debt` | 기술 부채 항목 등록, 해결, 조회 |
| 메모리 관리 | `memory` | 규칙 파일 및 에이전트 메모리 노트 관리 |
| 컨텍스트 | `context` | 컨텍스트 패킷 쓰기 |
| 복구 | `recovery` | 복구 패킷 작성 |
| 페이즈 | `phase` | 페이즈 리뷰 작성 및 읽기 |
| 의사결정 | `decision` | 의사결정 기록 작성, 읽기, 목록 조회 |
| 상태 점검 | `health` | 프로젝트 건강 상태 점검 생성 및 읽기 |
| 진화 | `evolution` | 갭 평가 및 규칙 업데이트 아티팩트 작성 |
| 패킷 | `packet` | 컨텍스트 패킷 생성 및 읽기 |
| 스키마 | `schema` | 스키마 유형 조회 및 템플릿 생성 |

---

## state — 실행 상태 관리

실행 상태(`run.json`)와 체크포인트를 관리한다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `init` | `.geas/` 디렉터리 구조 및 초기 `run.json` 생성 |
| `read` | 현재 실행 상태 읽기 |
| `update` | `run.json` 필드 원자적 업데이트 |
| `checkpoint` | 체크포인트 설정/해제 |
| `session-update` | `session-latest.md` 작성 |

### state init

`.geas/` 디렉터리 구조를 생성하고 초기 `run.json`을 작성한다.

```
geas state init
```

**옵션:** 없음

**사용 예시:**
```bash
geas state init
```

### state read

현재 실행 상태(`run.json`)를 읽어 출력한다.

```
geas state read
```

**옵션:** 없음

**사용 예시:**
```bash
geas state read
```

### state update

`run.json`의 특정 필드를 원자적으로 업데이트한다.

```
geas state update --field <field> --value <value>
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--field <field>` | 예 | 업데이트할 필드 이름 |
| `--value <value>` | 예 | 새 값 (JSON 파싱 시도) |

**사용 예시:**
```bash
geas state update --field current_phase --value specifying
```

### state checkpoint set

`run.json`에 체크포인트를 설정한다.

```
geas state checkpoint set [options]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--step <step>` | 예 | 파이프라인 단계 이름 |
| `--agent <agent>` | 예 | 현재 진행 중인 에이전트 |
| `--retry-count <n>` | 아니오 | 재시도 횟수 (기본값: 0) |
| `--batch <tasks>` | 아니오 | 병렬 배치 태스크 ID (쉼표 구분) |

**사용 예시:**
```bash
geas state checkpoint set --step implementation --agent software-engineer --retry-count 0
```

### state checkpoint clear

`run.json`에서 체크포인트를 제거한다.

```
geas state checkpoint clear
```

**옵션:** 없음

**사용 예시:**
```bash
geas state checkpoint clear
```

### state session-update

`session-latest.md` 파일을 작성하여 현재 세션 상태를 기록한다.

```
geas state session-update [options]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--phase <phase>` | 아니오 | 현재 페이즈 |
| `--task <task>` | 아니오 | 현재 태스크 ID |
| `--step <step>` | 아니오 | 현재 파이프라인 단계 |
| `--summary <text>` | 아니오 | 요약 텍스트 |

**사용 예시:**
```bash
geas state session-update --phase building --task task-001 --step implementation --summary "기능 구현 진행 중"
```

---

## mission — 미션 관리

미션 디렉터리 생성, 스펙 및 디자인 브리프 작성과 읽기를 수행한다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `create` | 미션 디렉터리 및 하위 구조 생성 |
| `write-spec` | 미션 스펙(spec.json) 작성 |
| `write-brief` | 디자인 브리프(design-brief.json) 작성 |
| `read` | 미션 아티팩트 읽기 |

### mission create

미션 디렉터리와 전체 하위 디렉터리 구조를 생성한다. `--id`를 생략하면 자동으로 ID가 부여된다.

```
geas mission create [--id <mission-id>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--id <mission-id>` | 아니오 | 미션 식별자 (생략 시 자동 생성) |

**사용 예시:**
```bash
geas mission create --id mission-001
```

### mission write-spec

스키마 검증을 거쳐 `spec.json`을 작성한다. JSON 데이터는 stdin으로 전달한다.

```
geas mission write-spec --id <mission-id> [--dry-run]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--id <mission-id>` | 예 | 미션 식별자 |
| `--dry-run` | 아니오 | 파일 쓰기 없이 검증만 수행 |

**사용 예시:**
```bash
echo '{"title":"CLI 개선","objective":"사용성 향상","success_criteria":["응답 속도 50% 개선"]}' | geas mission write-spec --id mission-001
```

### mission write-brief

스키마 검증을 거쳐 `design-brief.json`을 작성한다. JSON 데이터는 stdin으로 전달한다.

```
geas mission write-brief --id <mission-id> [--dry-run]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--id <mission-id>` | 예 | 미션 식별자 |
| `--dry-run` | 아니오 | 파일 쓰기 없이 검증만 수행 |

**사용 예시:**
```bash
echo '{"approach":"단계적 리팩터링","constraints":["하위 호환 유지"]}' | geas mission write-brief --id mission-001
```

### mission read

미션 아티팩트(spec.json, design-brief.json 또는 둘 다)를 읽어 출력한다.

```
geas mission read --id <mission-id> [--artifact <type>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--id <mission-id>` | 예 | 미션 식별자 |
| `--artifact <type>` | 아니오 | 읽을 아티팩트: `spec`, `brief` (생략 시 둘 다) |

**사용 예시:**
```bash
geas mission read --id mission-001 --artifact spec
```

---

## task — 태스크 관리

태스크 생성, 상태 전이, 실행 기록, 아티팩트 검증 등 태스크 생명주기 전체를 관리한다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `create` | 스키마 검증을 거쳐 태스크 계약 생성 |
| `transition` | 태스크 상태 전이 검증 및 적용 |
| `advance` | 다음 기본 체인 상태로 자동 전진 |
| `read` | 태스크 계약 읽기 |
| `list` | 전체 태스크 목록 조회 |
| `record add` | 실행 기록(record.json) 섹션 추가 |
| `record get` | 실행 기록 읽기 |
| `resolve` | 태스크 해결 (전이 + 이벤트 기록 + 잠금 해제 원자 번들) |
| `harvest-memory` | 근거에서 메모리 제안 일괄 추출 |
| `check-artifacts` | 파이프라인 단계별 필수 아티팩트 존재/검증 확인 |
| `closure-assemble` | 폐쇄 패킷 조립 (forbidden-pass 사전 검사 포함) |
| `revalidate` | 현재 HEAD 대비 태스크 신선도 확인 및 드리프트 분류 |
| `retrospective-draft` | 근거와 기록 섹션에서 구조화된 회고 JSON 생성 |

### task create

스키마 검증을 거쳐 태스크 계약을 생성한다. JSON 데이터는 stdin으로 전달한다.

```
geas task create [--mission <mission-id>] [--dry-run]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mission-id>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |
| `--dry-run` | 아니오 | 파일 쓰기 없이 검증만 수행 |

**사용 예시:**
```bash
echo '{"id":"task-001","title":"사용자 인증 구현","priority":"high","acceptance_criteria":["로그인 성공 시 토큰 발급"]}' | geas task create
```

### task transition

태스크 상태 전이를 검증하고 적용한다. 전이 가드가 자동으로 실행된다.

```
geas task transition --id <task-id> --to <status> [--mission <mission-id>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mission-id>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |
| `--id <task-id>` | 예 | 태스크 식별자 |
| `--to <status>` | 예 | 목표 상태 |

**사용 예시:**
```bash
geas task transition --id task-001 --to ready
```

### task advance

태스크를 기본 체인의 다음 상태로 자동 전진시킨다. 가드 사전 검사를 수행한다.

```
geas task advance --id <task-id> [--mission <mission-id>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mission-id>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |
| `--id <task-id>` | 예 | 태스크 식별자 |

**사용 예시:**
```bash
geas task advance --id task-001
```

### task read

태스크 계약을 읽어 출력한다.

```
geas task read --id <task-id> [--mission <mission-id>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mission-id>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |
| `--id <task-id>` | 예 | 태스크 식별자 |

**사용 예시:**
```bash
geas task read --id task-001
```

### task list

미션 내 전체 태스크의 ID, 제목, 상태를 목록으로 출력한다.

```
geas task list [--mission <mission-id>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mission-id>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |

**사용 예시:**
```bash
geas task list
```

### task record add

실행 기록(`record.json`)에 섹션을 추가하거나 덮어쓴다. JSON 데이터는 stdin 또는 `--set`으로 전달한다.

```
geas task record add --task <task-id> --section <name> [options]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mission-id>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |
| `--task <task-id>` | 예 | 태스크 식별자 |
| `--section <name>` | 예 | 섹션 이름: `implementation_contract`, `self_check`, `gate_result`, `challenge_review`, `verdict`, `closure`, `retrospective` |
| `--set <key=value>` | 아니오 | 개별 필드 설정 (여러 개 가능) |
| `--dry-run` | 아니오 | 파일 쓰기 없이 검증만 수행 |

**사용 예시:**
```bash
geas task record add --task task-001 --section self_check \
  --set "summary=단위 테스트 통과 확인" \
  --set "verdict=pass"
```

### task record get

실행 기록(`record.json`)을 전체 또는 특정 섹션만 읽어 출력한다.

```
geas task record get --task <task-id> [--section <name>] [--mission <mission-id>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mission-id>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |
| `--task <task-id>` | 예 | 태스크 식별자 |
| `--section <name>` | 아니오 | 섹션 이름 (생략 시 전체 기록) |

**사용 예시:**
```bash
geas task record get --task task-001 --section gate_result
```

### task resolve

태스크를 해결한다. 상태 전이, 이벤트 기록, 잠금 해제를 원자적으로 수행한다.

```
geas task resolve --id <task-id> --verdict <verdict> [--mission <mission-id>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mission-id>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |
| `--id <task-id>` | 예 | 태스크 식별자 |
| `--verdict <verdict>` | 예 | 해결 판정: `pass`, `cancel`, `escalate` |

**사용 예시:**
```bash
geas task resolve --id task-001 --verdict pass
```

### task harvest-memory

태스크 근거에서 `memory_suggestions`를 일괄 추출하여 에이전트 메모리 노트로 기록한다.

```
geas task harvest-memory --id <task-id> [--mission <mission-id>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--id <task-id>` | 예 | 태스크 식별자 |
| `--mission <mission-id>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |

**사용 예시:**
```bash
geas task harvest-memory --id task-001
```

### task check-artifacts

파이프라인 단계에 필요한 아티팩트가 존재하는지 확인하고 검증한다.

```
geas task check-artifacts --id <task-id> --step <step> [--mission <mission-id>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mission-id>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |
| `--id <task-id>` | 예 | 태스크 식별자 |
| `--step <step>` | 예 | 파이프라인 단계: `implementation_contract`, `implementation`, `self_check`, `specialist_review`, `testing`, `gate_result`, `closure`, `challenge_review`, `verdict`, `retrospective` |

**사용 예시:**
```bash
geas task check-artifacts --id task-001 --step gate_result
```

### task closure-assemble

폐쇄 패킷을 조립한다. forbidden-pass 사전 검사를 수행하여 요건 미충족 시 차단한다.

```
geas task closure-assemble --id <task-id> [--write] [--mission <mission-id>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mission-id>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |
| `--id <task-id>` | 예 | 태스크 식별자 |
| `--write` | 아니오 | 결과를 stdout 대신 `record.json`에 직접 기록 |

**사용 예시:**
```bash
geas task closure-assemble --id task-001 --write
```

### task revalidate

현재 Git HEAD 대비 태스크의 신선도를 확인하고 드리프트를 분류한다.

```
geas task revalidate --id <task-id> [--mission <mission-id>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mission-id>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |
| `--id <task-id>` | 예 | 태스크 식별자 |

**사용 예시:**
```bash
geas task revalidate --id task-001
```

### task retrospective-draft

근거 파일과 실행 기록 섹션에서 구조화된 회고 JSON을 생성한다.

```
geas task retrospective-draft --id <task-id> [--mission <mission-id>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mission-id>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |
| `--id <task-id>` | 예 | 태스크 식별자 |

**사용 예시:**
```bash
geas task retrospective-draft --id task-001
```

---

## evidence — 근거 관리

역할 기반 근거 파일을 생성하고 읽는다. 각 역할(implementer, reviewer, tester, authority)별로 고유한 근거 구조를 지원한다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `add` | 역할 기반 근거 파일 생성/덮어쓰기 |
| `read` | 태스크 근거 읽기 |

### evidence add

역할 기반 근거 파일을 생성하거나 덮어쓴다. JSON 데이터는 stdin 또는 `--set`으로 전달한다.

```
geas evidence add [options]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mid>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |
| `--task <tid>` | 조건부 | 태스크 식별자 (`--phase` 미사용 시 필수) |
| `--phase <phase>` | 조건부 | 미션 수준 근거의 페이즈 이름 (`polishing`, `evolving`) |
| `--agent <name>` | 예 | 에이전트 이름 (파일명으로 사용) |
| `--role <role>` | 예 | 에이전트 역할: `implementer`, `reviewer`, `tester`, `authority` |
| `--set <key=value>` | 아니오 | 개별 필드 설정 (여러 개 가능) |
| `--dry-run` | 아니오 | 파일 쓰기 없이 검증만 수행 |

**사용 예시:**
```bash
geas evidence add --task task-001 --agent software-engineer --role implementer \
  --set "summary=사용자 인증 모듈 구현 완료" \
  --set "files_changed=[\"src/auth.ts\",\"src/auth.test.ts\"]"
```

### evidence read

태스크의 근거 파일을 읽는다. 특정 에이전트 또는 전체를 조회할 수 있다.

```
geas evidence read --task <tid> [--agent <name>] [--mission <mid>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mid>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |
| `--task <tid>` | 예 | 태스크 식별자 |
| `--agent <name>` | 아니오 | 에이전트 이름 (생략 시 전체 목록) |

**사용 예시:**
```bash
geas evidence read --task task-001 --agent software-engineer
```

---

## event — 이벤트 관리

이벤트 원장(`events.jsonl`)에 이벤트를 추가한다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `log` | 이벤트 원장에 항목 추가 |

### event log

`events.jsonl`에 이벤트를 추가한다.

```
geas event log [options]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--type <type>` | 예 | 이벤트 유형 (예: `step_complete`, `task_start`) |
| `--task <id>` | 아니오 | 관련 태스크 ID |
| `--agent <agent>` | 아니오 | 이벤트를 생성한 에이전트 |
| `--data <json>` | 아니오 | 추가 데이터 (JSON 문자열) |
| `--message <text>` | 아니오 | 사람이 읽을 수 있는 메시지 |
| `--update-checkpoint` | 아니오 | `run.json` 체크포인트도 함께 업데이트 (`step_complete` 전용) |

**사용 예시:**
```bash
geas event log --type step_complete --task task-001 --agent software-engineer \
  --message "구현 단계 완료" --update-checkpoint
```

---

## lock — 잠금 관리

동시성 제어를 위한 잠금을 획득, 해제, 조회한다. 여러 태스크가 동일 리소스에 충돌하지 않도록 보장한다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `acquire` | 태스크에 대한 잠금 획득 |
| `release` | 태스크가 보유한 잠금 전체 해제 |
| `list` | 활성 잠금 목록 조회 |
| `cleanup` | 유효하지 않은 세션의 고아 잠금 제거 |

### lock acquire

태스크에 대한 잠금을 획득한다.

```
geas lock acquire --task <id> --type <type> --targets <targets> --session <id>
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--task <id>` | 예 | 잠금을 요청하는 태스크 ID |
| `--type <type>` | 예 | 잠금 유형: `path`, `interface`, `resource`, `integration` |
| `--targets <targets>` | 예 | 잠금 대상 (쉼표 구분) |
| `--session <id>` | 예 | 세션 ID |

**사용 예시:**
```bash
geas lock acquire --task task-001 --type path --targets "src/auth.ts,src/auth.test.ts" --session session-abc123
```

### lock release

태스크가 보유한 모든 잠금을 해제한다.

```
geas lock release --task <id>
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--task <id>` | 예 | 잠금을 해제할 태스크 ID |

**사용 예시:**
```bash
geas lock release --task task-001
```

### lock list

활성 잠금 목록을 조회한다. 태스크 ID나 잠금 유형으로 필터링할 수 있다.

```
geas lock list [--task <id>] [--type <type>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--task <id>` | 아니오 | 태스크 ID로 필터링 |
| `--type <type>` | 아니오 | 잠금 유형으로 필터링 |

**사용 예시:**
```bash
geas lock list --type path
```

### lock cleanup

존재하지 않는 세션의 고아 잠금을 제거한다.

```
geas lock cleanup --session <id>
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--session <id>` | 예 | 현재 유효한 세션 ID |

**사용 예시:**
```bash
geas lock cleanup --session session-abc123
```

---

## debt — 기술 부채 관리

기술 부채 항목을 등록, 해결, 조회한다. 자동 ID 부여와 중복 탐지를 지원한다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `add` | 부채 항목 추가 (자동 ID, 중복 탐지) |
| `resolve` | 부채 항목을 해결 처리 |
| `list` | 부채 항목 목록 조회 (필터 지원) |

### debt add

부채 레지스터에 항목을 추가한다. ID는 자동 생성되며 중복 탐지가 적용된다.

```
geas debt add --mission <mid> --title <title> --severity <severity> --kind <kind> [options]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mid>` | 예 | 미션 식별자 |
| `--title <title>` | 예 | 부채 항목 제목 |
| `--severity <severity>` | 예 | 심각도: `low`, `normal`, `high`, `critical` |
| `--kind <kind>` | 예 | 종류: `output_quality`, `verification_gap`, `structural`, `risk`, `process`, `documentation`, `operations` |
| `--task <tid>` | 아니오 | 부채를 발생시킨 태스크 |
| `--owner <owner>` | 아니오 | 담당 에이전트 유형 |
| `--description <desc>` | 아니오 | 상세 설명 (기본값: 빈 문자열) |

**사용 예시:**
```bash
geas debt add --mission mission-001 --title "인증 에러 핸들링 미흡" \
  --severity high --kind output_quality --task task-001 \
  --description "토큰 만료 시 적절한 에러 메시지 미반환"
```

### debt resolve

부채 항목을 해결 처리하고 롤업을 업데이트한다.

```
geas debt resolve --mission <mid> --id <debt-id>
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mid>` | 예 | 미션 식별자 |
| `--id <debt-id>` | 예 | 부채 항목 ID (예: `DEBT-001`) |

**사용 예시:**
```bash
geas debt resolve --mission mission-001 --id DEBT-001
```

### debt list

부채 항목 목록을 조회한다. 상태나 심각도로 필터링할 수 있다.

```
geas debt list --mission <mid> [--status <status>] [--severity <severity>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mid>` | 예 | 미션 식별자 |
| `--status <status>` | 아니오 | 상태 필터: `open`, `resolved`, `accepted`, `scheduled`, `dropped` |
| `--severity <severity>` | 아니오 | 심각도 필터: `low`, `normal`, `high`, `critical` |

**사용 예시:**
```bash
geas debt list --mission mission-001 --status open --severity high
```

---

## memory — 메모리 관리

규칙 파일(`rules.md`)과 에이전트별 메모리 노트를 관리한다. 세션 간 학습을 지속시키는 핵심 메커니즘이다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `init-rules` | 초기 `rules.md` 생성 |
| `agent-note` | 에이전트 메모리 파일에 노트 추가 |
| `read` | 에이전트 메모리 노트 또는 `rules.md` 읽기 |

### memory init-rules

`.geas/rules.md`를 초기 에이전트 규칙 내용으로 생성한다.

```
geas memory init-rules [--code-section <text>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--code-section <text>` | 아니오 | Code 섹션에 추가할 내용 |

**사용 예시:**
```bash
geas memory init-rules --code-section "TypeScript strict 모드 필수"
```

### memory agent-note

에이전트의 메모리 파일(`memory/agents/{agent}.md`)에 노트를 추가한다.

```
geas memory agent-note --agent <name> --add <text>
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--agent <name>` | 예 | 에이전트 유형 이름 (예: `software-engineer`) |
| `--add <text>` | 예 | 추가할 노트 텍스트 |

**사용 예시:**
```bash
geas memory agent-note --agent software-engineer --add "이 프로젝트에서는 Zod 스키마 검증을 표준으로 사용"
```

### memory read

에이전트의 메모리 노트 또는 `rules.md`를 읽어 출력한다.

```
geas memory read [--agent <name>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--agent <name>` | 아니오 | 에이전트 이름 (생략 시 `rules.md` 읽기) |

**사용 예시:**
```bash
geas memory read --agent software-engineer
```

---

## context — 컨텍스트 패킷

컨텍스트 패킷 파일을 작성한다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `write` | 컨텍스트 패킷 파일 작성 |

### context write

컨텍스트 패킷 파일을 작성한다.

```
geas context write --mission <mid> --task <tid> --agent <name> --data <content>
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mid>` | 예 | 미션 ID |
| `--task <tid>` | 예 | 태스크 ID |
| `--agent <name>` | 예 | 에이전트 유형 이름 (파일명으로 사용) |
| `--data <content>` | 예 | 패킷 내용 (문자열 또는 JSON) |

**사용 예시:**
```bash
geas context write --mission mission-001 --task task-001 --agent software-engineer \
  --data "구현 시 참고: API 응답 형식은 JSON으로 통일"
```

---

## recovery — 복구 관리

세션 복구를 위한 복구 패킷을 작성한다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `write` | 복구 패킷 작성 |

### recovery write

복구 패킷을 작성한다. JSON 데이터는 stdin으로 전달한다.

```
geas recovery write [--dry-run]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--dry-run` | 아니오 | 파일 쓰기 없이 검증만 수행 |

**사용 예시:**
```bash
echo '{"session_id":"session-001","reason":"비정상 종료 후 복구"}' | geas recovery write
```

---

## phase — 페이즈 리뷰

페이즈 리뷰를 작성하고 읽는다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `write` | 페이즈 리뷰 작성 |
| `read-latest` | 특정 페이즈의 최신 리뷰 읽기 |

### phase write

페이즈 리뷰를 작성한다. JSON 데이터는 stdin으로 전달한다.

```
geas phase write --mission <mid> [--dry-run]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mid>` | 예 | 미션 ID |
| `--dry-run` | 아니오 | 파일 쓰기 없이 검증만 수행 |

**사용 예시:**
```bash
echo '{"phase":"building","verdict":"pass","summary":"모든 태스크 완료"}' | geas phase write --mission mission-001
```

### phase read-latest

특정 페이즈의 가장 최근 리뷰를 읽어 출력한다.

```
geas phase read-latest --mission <mid> --phase <phase>
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mid>` | 예 | 미션 ID |
| `--phase <phase>` | 예 | 페이즈 이름 |

**사용 예시:**
```bash
geas phase read-latest --mission mission-001 --phase building
```

---

## decision — 의사결정 기록

의사결정 기록(Decision Record)을 작성, 읽기, 목록 조회한다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `write` | 의사결정 기록 작성 |
| `read` | 의사결정 기록 읽기 |
| `list` | 미션의 전체 의사결정 기록 목록 |

### decision write

의사결정 기록을 작성한다. JSON 데이터는 stdin으로 전달한다.

```
geas decision write --mission <mid> [--dry-run]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mid>` | 예 | 미션 식별자 |
| `--dry-run` | 아니오 | 파일 쓰기 없이 검증만 수행 |

**사용 예시:**
```bash
echo '{"id":"DEC-001","title":"인증 방식 선택","decision":"JWT 토큰 방식 채택","rationale":"확장성과 무상태 유지"}' | geas decision write --mission mission-001
```

### decision read

의사결정 기록을 ID로 읽어 출력한다.

```
geas decision read --mission <mid> --id <dec-id>
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mid>` | 예 | 미션 식별자 |
| `--id <dec-id>` | 예 | 의사결정 기록 ID |

**사용 예시:**
```bash
geas decision read --mission mission-001 --id DEC-001
```

### decision list

미션의 전체 의사결정 기록 목록을 조회한다.

```
geas decision list --mission <mid>
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mid>` | 예 | 미션 식별자 |

**사용 예시:**
```bash
geas decision list --mission mission-001
```

---

## health — 상태 점검

프로젝트의 건강 상태를 진단하고 `health-check.json`을 생성/읽기한다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `generate` | 현재 상태에서 `health-check.json` 생성 |
| `read` | 현재 `health-check.json` 읽기 |

### health generate

현재 프로젝트 상태를 분석하여 `health-check.json`을 생성한다.

```
geas health generate
```

**옵션:** 없음

**사용 예시:**
```bash
geas health generate
```

### health read

현재 `health-check.json`을 읽어 출력한다.

```
geas health read
```

**옵션:** 없음

**사용 예시:**
```bash
geas health read
```

---

## evolution — 진화 단계 아티팩트

진화(Evolving) 페이즈의 갭 평가와 규칙 업데이트 아티팩트를 작성한다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `gap-assessment` | 미션 페이즈에 대한 갭 평가 작성 |
| `rules-update` | 규칙 업데이트 아티팩트 작성 |

### evolution gap-assessment

미션 페이즈에 대한 갭 평가를 작성한다. JSON 데이터는 stdin으로 전달한다.

```
geas evolution gap-assessment --mission <mid> --phase <phase> [--dry-run]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mid>` | 예 | 미션 식별자 |
| `--phase <phase>` | 예 | 미션 페이즈 (예: `building`, `polishing`, `evolving`) |
| `--dry-run` | 아니오 | 파일 쓰기 없이 검증만 수행 |

**사용 예시:**
```bash
echo '{"gaps":[{"area":"테스트 커버리지","severity":"high","description":"통합 테스트 부재"}]}' | geas evolution gap-assessment --mission mission-001 --phase building
```

### evolution rules-update

미션에 대한 규칙 업데이트 아티팩트를 작성한다. JSON 데이터는 stdin으로 전달한다.

```
geas evolution rules-update --mission <mid> [--dry-run]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mid>` | 예 | 미션 식별자 |
| `--dry-run` | 아니오 | 파일 쓰기 없이 검증만 수행 |

**사용 예시:**
```bash
echo '{"rules_added":["통합 테스트 필수 작성"],"rules_removed":[]}' | geas evolution rules-update --mission mission-001
```

---

## packet — 컨텍스트 패킷 관리

컨텍스트 패킷 마크다운 파일을 생성하고 읽는다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `create` | 컨텍스트 패킷 마크다운 파일 생성 |
| `read` | 컨텍스트 패킷 읽기 |

### packet create

컨텍스트 패킷 마크다운 파일을 생성한다. 내용은 인라인 또는 파일에서 읽을 수 있다.

```
geas packet create --task <tid> --agent <name> [options]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mid>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |
| `--task <tid>` | 예 | 태스크 식별자 |
| `--agent <name>` | 예 | 에이전트 이름 (파일명으로 사용) |
| `--content <text>` | 조건부 | 마크다운 내용 (인라인) |
| `--file <path>` | 조건부 | 마크다운 파일 경로에서 내용 읽기 |

**사용 예시:**
```bash
geas packet create --task task-001 --agent software-engineer \
  --content "## 구현 컨텍스트\n\n인증 모듈은 JWT 기반으로 구현한다."
```

### packet read

컨텍스트 패킷을 읽어 출력한다.

```
geas packet read --task <tid> --agent <name> [--mission <mid>]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--mission <mid>` | 아니오 | 미션 식별자 (run.json에서 자동 해석) |
| `--task <tid>` | 예 | 태스크 식별자 |
| `--agent <name>` | 예 | 에이전트 이름 |

**사용 예시:**
```bash
geas packet read --task task-001 --agent software-engineer
```

---

## schema — 스키마 유틸리티

사용 가능한 스키마 유형을 조회하고, JSON 템플릿을 생성한다.

### 하위 명령어

| 명령어 | 설명 |
|--------|------|
| `list` | 사용 가능한 스키마 유형 전체 목록 |
| `template` | 스키마 유형에 대한 채워넣기 JSON 템플릿 생성 |
| `sections` | 유효한 record 섹션 이름 목록 |

### schema list

사용 가능한 모든 스키마 유형을 나열한다.

```
geas schema list
```

**옵션:** 없음

**사용 예시:**
```bash
geas schema list
```

### schema template

스키마 유형에 대한 채워넣기 JSON 템플릿을 생성한다. 근거 스키마는 `--role`로 역할별 필드를 확인할 수 있다.

```
geas schema template <type> [options]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `<type>` | 예 | 스키마 유형 (위치 인수) |
| `--role <role>` | 아니오 | 역할 변형 (근거 스키마 전용) |
| `--strip-envelope` | 아니오 | CLI가 자동 주입하는 엔벨로프 필드 제거 (기본값: true) |
| `--no-strip-envelope` | 아니오 | 자동 주입 엔벨로프 필드 유지 |
| `--section <name>` | 아니오 | record 섹션 하위 스키마 추출 |
| `--pretty` | 아니오 | JSON 출력 정렬 (기본값: false) |

**사용 예시:**
```bash
# 태스크 계약 템플릿 생성
geas schema template task-contract --pretty

# 구현자 역할 근거 템플릿 생성
geas schema template evidence --role implementer --pretty

# record의 self_check 섹션 템플릿 생성
geas schema template record --section self_check --pretty
```

### schema sections

유효한 record 섹션 이름 목록을 출력한다.

```
geas schema sections
```

**옵션:** 없음

**사용 예시:**
```bash
geas schema sections
```
