# Geas 재정의 로드맵

## 1. 방향

이 작업의 중심은 **Geas가 무엇인지 다시 정의하는 것**이다. v3.0.0은 그 새 정의를 처음 구현하는 버전이다.

기존 문서, 코드, 플러그인, 대시보드는 `.legacy/`에 보존하고 참고 자료로만 사용한다. v2.x의 개념, 이름, 상태, artifact는 필요가 확인될 때만 다시 가져온다.

로드맵의 목적은 Geas를 다시 정의하는 순서, 구현 산출물을 고정하는 지점, 구현 중 생긴 판단을 되돌릴 문서 위치를 정하는 것이다. 세부 구현 계획은 각 구현 단위에서 다룬다.

기본 방향은 다음과 같다.

- Geas의 정체성을 먼저 정의한다.
- 사용자 흐름과 작업 운영 흐름을 같은 문서층에서 다룬다.
- `docs/definition.md`, `docs/operating/`, `docs/runtime.md`, `docs/cli.md`를 초기 기준선으로 삼는다.
- Skills와 Agents는 전체 실행 흐름을 설계하고 구현 산출물로 고정한다.
- v3.0.0은 새 정의의 첫 구현 버전으로 다룬다.

## 2. 현재 위치

Geas 정의, 작업 운영 흐름, 런타임 모델, CLI 최소 표면까지 초기 기준선을 작성했다.

다음 작업은 Skills와 Agents의 전체 실행 흐름을 설계하고 구현하는 것이다.

## 3. 작업 흐름

Geas 재정의 작업은 아래 순서로 진행한다.

1. Geas 정의
2. 작업 운영 흐름 정의
3. 런타임 모델 정의
4. CLI 최소 표면 정의
5. Skills/Agents 설계와 구현
6. Plugin packaging 정의
7. 대시보드가 읽을 정보 정의
8. 남은 구현 정리
9. Dogfood
10. v3.0.0 릴리스 준비

1번부터 4번까지는 초기 기준선을 먼저 세우는 단계다. 5번부터는 각 단계의 목표, 범위, 산출물, 검증 방법, 경계를 먼저 고정하고 구현한다.

뒤 단계에서 앞 단계의 결정이 흔들리면 해당 문서를 갱신한 뒤 이어간다.

## 4. 단계별 의미

### 1. Geas 정의

Geas가 무엇인지, 어떤 문제를 해결하려는지, 도달해야 할 목표와 핵심 원칙이 무엇인지 정의한다. 이 단계에서는 Geas의 정체성과 사용자에게 제공하는 가치를 기능 목록보다 앞에 둔다.

### 2. 작업 운영 흐름 정의

사용자가 경험하는 흐름과 작업 운영 흐름을 함께 정의한다. 예를 들어 `intent -> contract -> work -> Evidence -> decision` 같은 중심축이 여기서 결정된다.

이 단계의 정본 문서군은 `docs/operating/`이다.

### 3. 런타임 모델 정의

핵심 흐름을 디스크에 어떤 artifact로 남길지 정한다. `.geas/` 구조, artifact 이름, 각 artifact가 책임지는 정보의 경계를 여기서 잡는다.

### 4. CLI 최소 표면 정의

런타임 모델을 쓰고 읽기 위한 CLI의 최소 명령 표면을 정한다. 이 단계에서는 CLI가 runtime 기록과 전이에 집중하도록 경계를 분명히 한다.

### 5. Skills/Agents 설계와 구현

사용자 entrypoint, 내부 Skill, agent 역할을 전체 운영 흐름 기준으로 정한다. 세부 기준 문서는 `docs/skills.md`와 `docs/agents.md`로 나눈다.

이 단계는 다음 기준을 고정한 뒤 구현 산출물을 만든다.

- 목표
- 범위
- 산출물
- 검증 방법
- 경계

Skills는 `mission` Skill을 User entrypoint로 삼고, Orchestrator 책임을 그 안에 둔다. 내부 절차는 `specifying`, `implementing`, `verifying`, `reviewing`, `challenging`, `consolidating` Skill로 나누며, 각 Skill의 CLI 사용법은 해당 절차 안에 녹인다.

Agents는 `work-designer`, `implementer`, `verifier`, `reviewer`, `challenger` 역할을 정의한다. 역할은 인간이 검토하고 수용 판단할 수 있도록 계약, 실행, 검증 근거, 미검증 범위, 회고를 남기는 실행 책임으로 정의한다.

Skill은 절차를 담고 Agent는 역할 정의를 담는다. Orchestrator 책임은 `mission` Skill 안에 둔다.

5단계의 검증은 구조 검증까지 수행한다.

#### 5단계 경계

- v2.x의 큰 agent roster를 자동 계승하지 않는다.
- agent 완료 선언, 자동 판단, 도구 실행 결과를 인간의 수용 판단으로 승격하지 않는다.
- 특정 agent client의 plugin 형식을 고정하지 않는다.
- dashboard와 통합하지 않는다.
- dogfood dry-run을 포함하지 않는다.

### 6. Plugin packaging 정의

Codex/Claude 같은 agent client에 skills, agents, CLI, assets를 어떤 구조로 노출할지 정한다. 이 단계는 5단계에서 확인한 흐름을 plugin package로 묶는 데 집중한다.

### 7. 대시보드가 읽을 정보 정의

대시보드는 우선 읽기 표면으로 본다. 어떤 runtime artifact를 어떤 관점으로 보여줄지 정하고, 필요가 확인된 v2.x 대시보드 기능만 다시 다룬다.

### 8. 남은 구현 정리

Skills/Agents 구현을 통해 확인한 내용을 바탕으로 v3.0.0에 필요한 남은 구현을 정리한다.

이 단계에서는 파일 구조, 테스트 전략, 작업 단위, 커밋 단위를 구체화하고, Dogfood에 필요한 최소 실행 경로를 맞춘다.

### 9. Dogfood

Geas 자체를 사용해 실제 작업 하나를 수행한다. 이 단계의 목적은 흐름이 실제로 가볍고 이해 가능한지 확인하는 것이다.

### 10. v3.0.0 릴리스 준비

README, changelog, 설치 경로, release workflow, 버전 정보를 정리한다. v3.0.0이 breaking change라면 그 사실과 legacy 위치를 명확히 알린다.

## 5. 진행 원칙

- 한 번에 한 단계씩 진행한다.
- 각 단계의 결정은 문서로 남긴다.
- 구현 중 생긴 새 결정은 문서로 되돌린다.
- 단순한 길이 있으면 그 길을 우선한다.
- 부채를 줄이는 것이 새 기능을 늘리는 것보다 우선이다.

## 6. 경계

- v2.x의 이름, 상태, artifact를 필요 없이 되살리지 않는다.
- 단순한 작업까지 무거운 승인, 역할 분리, 기록 형식을 요구하지 않는다.
- 인간의 검토와 수용 판단을 agent 판단, 자동 상태, 도구 실행 결과로 대체하지 않는다.
