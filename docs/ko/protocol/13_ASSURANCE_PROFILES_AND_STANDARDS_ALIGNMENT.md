# 13. Assurance Profiles and Standards Alignment

> **기준 + 참고 문서.**
> 이 문서는 Geas assurance profile을 정의하고, AI 지원 구조화된 작업에서 흔히 사용되는 외부 표준 및 공식 가이던스와 프로토콜이 어떻게 정렬되는지 설명한다.

## 목적

Geas는 내부 운영 프로토콜이지만, 본격적으로 구조화된 작업을 수행하는 팀이라면 이 프로토콜이 업계의 통제 체계와 어떻게 연결되는지 알아야 한다. 이 문서는 두 가지 목적을 가진다:

1. 최소 엄격성 기대치를 묶는 **assurance profile**을 정의한다
2. 잘 알려진 외부 표준 및 가이던스와의 정렬을 문서화한다

이 문서는 해당 표준에 대한 공식 인증을 주장하지 않는다. 구현 및 감사 계획을 위한 실용적 control mapping을 제공한다.

## Why Assurance Profiles Exist

모든 mission이 동일한 엄격성을 필요로 하는 것은 아니다. 프로토콜은 핵심 invariant를 포기하지 않으면서 위험에 따라 확장되어야 한다.

Assurance profile은 프로젝트가 아래 질문에 답할 수 있게 한다:

- 이 mission의 최소 review 엄격성은 무엇인가?
- 어떤 traceability와 evaluation이 필요한가?
- 어떤 provenance 또는 security 통제가 기대되는가?
- 언제 사용자의 승인이 필요한가?

## Assurance Profiles

Geas는 엄격성의 수준이 증가하는 네 가지 assurance profile을 정의한다. 각 profile은 이전 profile을 기반으로 하며, 더 높은 위험 또는 영향의 작업에 적합한 통제를 추가한다.

### `prototype`

탐색적, 내부, 저위험 작업에 최적.

최소 기대치:

- task lifecycle 보존
- 최소 1개의 독립적 review 경로
- evidence gate 존재
- closure packet 및 final verdict 존재
- retrospective 및 debt surface 보존

### `delivery`

일반 제품 개발에 최적.

최소 기대치:

- 전체 baseline conformance
- task kind 및 risk에 따른 reviewer routing
- health signal monitoring
- 명시적 recovery 및 packet freshness 처리
- memory 및 rules feedback loop 활성

### `hardened`

보안 민감, 사용자 영향, 운영 위험이 높은 작업에 최적.

최소 기대치:

- 더 강력한 다중 관점 review
- 고위험 작업에 대한 명시적 critical-review challenge
- agentic-control 변경에 대한 evaluation evidence
- 더 강력한 provenance 및 delivery 준비 기대치
- policy override 기록 및 감사

### `regulated`

고위험 환경 또는 강력한 조직 거버넌스가 적용되는 프로젝트에 최적.

최소 기대치:

- 모든 hardened 통제
- 더 엄격한 승인 및 변경 문서화
- 중요 결정에 대한 강력한 사용자 review
- 명시적 provenance 및 retention 정책
- 강화된 recovery 보수성
- 더 엄격한 evidence 보존 및 감사 가능성

프로젝트는 profile 이름을 로컬에서 변경할 수 있으나, 기능적 구분은 가시적으로 유지되어야 한다.

## Recommended Profile Selection

| 상황 | 권장 최소 profile |
|---|---|
| 낮은 blast radius의 소규모 내부 실험 | `prototype` |
| 일반 제품 작업 | `delivery` |
| 인증, 권한, 금융, PII, 운영, 공개 출력물 | `hardened` |
| 규제 또는 고위험 환경 | `regulated` |

선택된 profile은 mission 시작 시 가시적이어야 한다.

## Profile Control Matrix

Control matrix는 각 profile이 주요 control surface에서 enforcement를 어떻게 확장하는지 보여준다.

| control surface | prototype | delivery | hardened | regulated |
|---|---|---|---|---|
| task contract and gate | required | required | required | required |
| independent review | 1 reviewer | routing-based | routing + stronger challenge | stronger + 사용자 참여 (policy 요구 시) |
| critical review for high risk | recommended | required | required | required |
| recovery packet and safe-boundary discipline | required | required | required | required |
| health signals | basic | required | required | required |
| eval evidence for agentic changes | optional | recommended | required | required |
| provenance / delivery attestation | optional | recommended | required | required |
| explicit override logging | required if used | required | required | required |
| 사용자 sign-off on critical exceptions | optional | recommended | recommended / policy-based | required by policy |

## Alignment Themes

Geas는 현대 AI 및 구조화된 작업 가이던스에서 반복되는 여러 주제와 의도적으로 정렬한다:

- 암시적 prompt 동작이 아닌 명시적 거버넌스
- 구조화된 handoff 및 tool contract
- tracing 및 observability
- eval 기반 개선
- 보안 개발 통제
- provenance 및 supply-chain 무결성
- LLM 특유의 위협 클래스에 대한 보호
- 무제한 prompt stuffing 대신 just-in-time context

## Standards and Guidance Mapping

아래 섹션은 Geas가 외부 가이던스의 광범위한 범주와 어떻게 정렬하는지 기술한다. Geas는 특정 단일 표준을 대상으로 하지 않지만, 여러 표준에 공통되는 원칙을 설계에 반영한다.

### AI risk management

Geas는 명시적 역할, risk 비례 review, 측정 가능한 gate 결과, health signal, feedback loop를 요구함으로써 거버넌스, 매핑, 측정, 관리 사이클과 정렬한다.

### Secure development

Geas는 reviewer routing, risk-area review, artifact 검증, recovery 보수성, 숨겨진 shortcut 대신 명시적 debt 처리를 통해 보안 개발 사고와 정렬한다.

### Supply-chain integrity and provenance

Geas는 integration, artifact lineage, delivery 준비, 직렬화된 base_snapshot mutation을 최우선 관심사로 취급함으로써 provenance 지향 delivery와 정렬한다.

### LLM-application security

Geas는 tool output, repository text, memory, summary를 잠재적으로 신뢰할 수 없는 context로 취급하고, least-privilege와 명시적 policy 경계를 보존하며, 위험 surface 주변에서 review와 logging을 필수로 함으로써 LLM 보안 가이던스와 정렬한다.

### Tool and context interoperability

Geas는 자유 형식 hidden tool invocation 대신 명시적 contract, schema, 귀속 가능한 handoff를 선호함으로써 구조화된 tool 생태계와 정렬한다.

### Observability

Geas는 gate, hook, slot action, artifact, recovery event를 상관시켜야 하는 telemetry-worthy event로 취급함으로써 trace-first 실천과 정렬한다.

### Eval-driven AI development

Geas는 위험 또는 assurance profile이 요구하는 경우 prompt, routing, tool, memory 동작 또는 기타 agentic control surface 변경에 대해 대표적 evidence를 요구함으로써 eval 기반 실천과 정렬한다.

## Practical Mapping to Geas Documents

| 외부 control 주제 | 주요 Geas 문서 |
|---|---|
| governance and authority | 00, 01, 02 |
| task contracts and lifecycle | 03, 05 |
| parallelism and safe integration | 04 |
| review evidence and challenge | 05, 06 |
| memory and context governance | 07, 08, 09 |
| recovery and resumability | 10 |
| artifacts and validation | 11 |
| enforcement, health, and observability | 12 |
| debt, retrospectives, and continuous improvement | 14 |

## Policy Overrides

Override는 프로젝트가 제한된 상황에서 일반 hard-stop 또는 요구사항을 의도적으로 약화시킬 때 존재한다.

Override 규칙:

- 명시적이어야 한다
- 소유자와 근거가 있어야 한다
- 범위와 만료를 명시해야 한다
- evidence 의무를 삭제해서는 안 된다
- 후속 debt 또는 review 작업을 trigger해야 한다

더 강력한 assurance profile은 override를 더 드물고 가시적으로 만들어야 하며, 더 쉽게 만들어서는 안 된다.

## Delivery and Shipping Guidance by Profile

각 profile은 작업이 출하 또는 전달되기 전에 충족해야 하는 기대치가 다르다.

### Prototype

일부 문서화된 debt를 허용할 수 있으나, 알려지지 않은 blocker는 여전히 피해야 한다.

### Delivery

일관된 packet completeness와 review coverage를 요구해야 한다.

### Hardened

추가로 open risk의 명시적 처리, challenge output, agentic 변경에 대한 대표적 eval evidence를 요구해야 한다.

### Regulated

추가로 지역 의무에 따른 더 강력한 사용자 거버넌스, retention, provenance discipline을 요구해야 한다.

## Implementation Guidance

Assurance profile을 도입하는 프로젝트는:

1. 기본 profile을 선언한다
2. profile 업그레이드가 어떻게 발생하는지 정의한다
3. 각 profile에 어떤 로컬 hook 또는 check이 매핑되는지 정의한다
4. 누가 override를 승인할 수 있는지 문서화한다
5. profile 선택이 delivery 시점뿐 아니라 mission 계획에 반영되도록 보장한다

## External Reference Set (Informative)

아래 공식 자료가 이 정렬 모델에 크게 영향을 미쳤다:

- Anthropic — *Building Effective AI Agents*
- Anthropic — *Effective Context Engineering for AI Agents*
- Anthropic — *Introducing the Model Context Protocol*
- Anthropic — *Harness design for long-running application development*
- OpenAI — *Agents SDK* documentation
- OpenAI — *Tracing* documentation for Agents SDK
- OpenAI — *Evaluation best practices*
- OpenAI — *Working with evals*
- OpenAI — *Eval Driven System Design — From Prototype to Production*
- OpenAI — *Using PLANS.md for multi-hour problem solving*
- NIST — *AI Risk Management Framework (AI RMF 1.0)*
- NIST — *Secure Software Development Framework (SP 800-218)*
- SLSA — build and provenance levels
- OWASP — *Top 10 for LLM Applications 2025*
- OpenTelemetry — semantic conventions for traces, logs, and metrics

## Key Statement

Geas는 내부적으로 일관될 뿐만 아니라 외부적으로 판독 가능할 때 가장 강력하다. Assurance profile은 추상적 엄격성을 선택 가능한 운영 자세로 변환하고, 표준 정렬은 로컬 프로세스를 조직 수준의 discipline으로 변환한다.
