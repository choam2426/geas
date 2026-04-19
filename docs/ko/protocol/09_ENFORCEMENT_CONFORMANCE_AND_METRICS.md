# 09. Enforcement, Conformance, and Metrics

> GEAS를 구현하는 validator, guard, observer가 무엇을 자동으로 막고 무엇을 agent 판단에 남겨 두는지, 그리고 어떤 conformance/metrics를 추적할지 정의한다.

## 목적

Enforcement는 프로토콜을 대신해 판단하는 계층이 아니다. 이 문서는 자동화가 어디까지 구조와 전이를 검사할 수 있고, 어디서부터는 agent의 명시적 판단을 기다려야 하는지 정한다.

## Enforcement가 할 일

| 범주 | 예시 |
|---|---|
| 구조 검증 | schema 적합성, required field 존재, enum 유효성 |
| 전이 가드 | phase 전이, task 상태 전이, artifact completeness 검사 |
| 관측 | health signal 계산, drift 감지, 지표 집계 |
| 차단 | 명백히 불가능한 상태 주장 차단 |

## Enforcement가 대신하지 않을 일

| 금지 대상 | 이유 |
|---|---|
| task closure decision 대행 | closure는 Orchestrator 판단이다 |
| mission final verdict 대행 | final verdict는 Decision Maker 판단이다 |
| missing review를 임의 통과 처리 | required reviewer는 대체 불가다 |
| rules 변경 자동 승인 | rule update는 근거와 승인 절차가 필요하다 |

## Conformance 층위

| 층위 | 무엇을 본다 |
|---|---|
| structural conformance | schema와 경로, 파일 존재, 필수 artifact 여부 |
| semantic conformance | 상태 주장과 artifact 조합이 논리적으로 가능한지 |
| process conformance | phase와 task가 owner 절차를 밟았는지 |

## 핵심 가드 시나리오

### 미션과 phase

- mission spec이 승인되지 않았는데 `building`으로 넘어가려는 경우
- mission design이나 초기 task contract 집합 승인 없이 `specifying`을 빠져나가려는 경우
- consolidating 근거 없이 mission final verdict를 주장하는 경우

### task와 evidence

- `ready`가 아닌 task를 실행하려는 경우
- required reviewer evidence 없이 closure를 주장하는 경우
- gate result 없이 `verified`나 `passed`를 주장하는 경우
- `decision` evidence 없이 `passed`를 주장하는 경우

### runtime과 recovery

- task state의 `checkpoint_phase`가 `pending`인데 committed처럼 복원하려는 경우
- mission state가 주장하는 현재 task와 실제 artifact가 모순되는 경우
- recovery packet이 manual repair를 요구하는데 자동 전이를 시도하는 경우

## Health Signals

구현체는 health check를 통해 다음 종류의 신호를 계산할 수 있다.

- review gap
- repeated failure class
- contradiction accumulation
- debt stagnation
- scope control weakness
- memory bloat
- gate quality issue

정확한 직렬화 구조는 `health-check.schema.json`이 관리한다. 어떤 신호를 언제 측정할지는 구현체가 정하더라도, threshold와 mandatory response는 문서화되어야 한다.

## Metrics

지표는 자동화 품질을 뽐내기 위한 숫자가 아니라, 프로토콜 운영이 실제로 좋아지는지 보기 위한 관측값이어야 한다.

| 범주 | 예시 |
|---|---|
| quality | review changes_requested 비율, gate failure 비율 |
| reliability | recovery 빈도, invalid transition 차단 수 |
| throughput | task cycle time, mission phase 소요 시간 |
| safety / risk | blocked challenge 비율, high/critical debt 잔량 |
| learning | rules update 채택 수, harmful reuse rollback 수 |
| cost / efficiency | 불필요한 재작업 비율, 과도한 deliberation 반복 수 |

## Policy Override

일시적으로 rule을 우회해야 한다면 그 사실을 숨기지 말고 override로 남겨야 한다. exact 구조는 `policy-override.schema.json`이 관리한다.

Override는 최소한 다음을 밝혀야 한다.

- 어떤 rule을 어떻게 바꾸는지
- 왜 필요한지
- 언제 만료되는지
- 누가 승인했는지

Override는 조용한 예외가 아니라, 추적 가능한 예외여야 한다.
