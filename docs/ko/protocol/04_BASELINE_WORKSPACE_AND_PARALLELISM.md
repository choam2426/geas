# 04. Baseline, Workspace, and Parallelism

> Geas가 task를 어떤 baseline 위에서 시작하고, 어떤 workspace에 격리하며, 어떤 조건에서 병렬로 돌릴 수 있는지 정의한다.

## 목적

이 문서는 세 가지를 다룬다.

- task가 어떤 기준선에서 시작하는가
- 작업 중인 상태를 어떤 workspace에 격리하는가
- 여러 task를 언제 함께 돌릴 수 있는가

목표는 빠르게 돌리는 것이 아니라, 서로 충돌하지 않는 병렬성과 복구 가능한 실행 상태를 유지하는 것이다.

## Baseline

Baseline은 task가 출발할 때 신뢰한 공유 기준선이다. Task contract의 `base_snapshot`은 그 기준선을 고정하는 필드다.

### baseline 규칙

- Orchestrator는 `ready`에서 `implementing`으로 들어가기 전, baseline이 여전히 유효한지 확인해야 한다.
- baseline이 바뀌었으면 Orchestrator가 그대로 진행할지, 기준선을 다시 잠글지, task를 재검토할지 판단한다.
- baseline 차이가 task의 `scope.surfaces`와 충돌하면 그대로 진행해서는 안 된다.

## Workspace

Workspace는 task가 실제 변경을 쌓는 작업 표면이다. 프로토콜은 구체 방식을 강제하지 않지만, 한 task의 변경과 다른 task의 변경을 구분할 수 있을 만큼은 격리되어야 한다.

### workspace 원칙

- active task는 자기 작업을 추적 가능한 workspace에 남겨야 한다.
- workspace 상태와 mission/runtime 상태는 같은 것이 아니다.
- dirty workspace 자체가 곧 invalid는 아니지만, 어떤 task의 어떤 변경인지 설명 가능해야 한다.
- 복구 시에는 workspace가 artifact보다 앞서 권위를 갖지 않는다. 계약과 evidence가 먼저다.

## 병렬 실행 원칙

병렬 실행은 기본값이 아니라 조건부 허용이다.

### 안전한 병렬 조건

- baseline이 서로 충돌하지 않는다.
- `scope.surfaces`가 실질적으로 겹치지 않는다.
- reviewer와 evidence를 task별로 분리해 읽을 수 있다.
- 하나의 task가 다른 task의 결과나 판단 근거에 의존하지 않는다.

### 병렬 실행을 피해야 하는 경우

- 같은 인터페이스나 같은 자원을 동시에 바꾸는 경우
- integration 순서가 결과 품질에 직접 영향을 주는 경우

## 조율 원칙

- Orchestrator는 충돌을 뒤늦게 봉합하기보다 먼저 피하도록 task 순서를 잡아야 한다.
- 병렬 실행 중이라도 task closure decision과 mission final verdict는 각 owner 문서의 절차를 따른다.
- 구현체가 실행기 상태(active/idle/paused 같은 신호)를 노출할 수는 있지만, 그것이 병렬 안전성을 스스로 보장하지는 않는다.
