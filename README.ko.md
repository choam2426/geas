<div align="center">

**[English](README.md)** | **한국어**

# Geas

### 멀티 에이전트 AI 개발을 위한 거버넌스

[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)
[![Release](https://img.shields.io/github/v/release/choam2426/geas?style=for-the-badge)](https://github.com/choam2426/geas/releases)

</div>

Geas는 에이전트 팀이 엔지니어링 조직처럼 동작하도록 만드는 프로토콜입니다.

- **통제된 의사결정** — 12개 에이전트 타입마다 권한 범위가 정해져 있고, 아키텍처 선택은 투표를 거칩니다. 의견이 갈리면 구조화된 절차와 에스컬레이션 경로로 풀고, 역할마다 낼 수 있는 결과물이 명시되어 있습니다.
- **추적 가능한 기록** — 태스크 계약, 상태 전이, 증거, 판결이 `.geas/`에 쌓입니다. 세션 체크포인트 덕분에 중단됐던 지점에서 그대로 재개할 수 있고, 이벤트 원장이 주요 행동을 전부 남깁니다.
- **계약 기반 검증** — 태스크마다 수용 기준과 루브릭이 붙습니다. 3단계 Evidence Gate가 사전 조건, 빌드/린트/테스트, 루브릭 점수를 차례로 확인합니다. 위험도가 높으면 Critical Reviewer가 따로 검증하고, 마지막에 제품 수준 Final Verdict로 닫습니다.
- **지속적 학습** — 태스크가 끝날 때마다 회고가 남고, 거기서 나온 교훈은 메모리 후보로 올라가 리뷰를 거쳐 승격됩니다. 규칙은 공유 `rules.md`에서 계속 갱신되고, 기술 부채는 debt register에 기록되어 다음 미션의 우선순위에 반영됩니다. 컨텍스트 패킷이 다음 작업에 관련 메모리를 넣어줍니다.

## 빠른 시작

> Geas는 프로토콜입니다. 여기서는 프로토콜의 구현체 중 하나인 **Claude Code 플러그인**을 씁니다.

```bash
/plugin marketplace add choam2426/geas
/plugin install geas@choam2426-geas
/geas:mission
```

만들고 싶은 걸 설명하면 됩니다. 오케스트레이터가 거버넌스 워크플로 전체를 이끌어 갑니다.

## 설계 원칙

- **사람이 최종 결정권을 쥔다** — 에이전트는 제안만 하고, 권한과 최종 판정은 사람에게 남아 있습니다
- **증거 없이 끝났다고 할 수 없다** — 검증을 통과하지 못하면 완료가 아닙니다
- **중단돼도 이어갈 수 있어야 한다** — 체크포인트와 복구 아티팩트로 정확히 재개합니다
- **지속할수록 성장한다** — 규칙과 메모리는 부산물이 아니라 핵심 산출물입니다

---

## 왜 Geas가 필요한가

멀티 에이전트 개발은 강력하지만, 거버넌스 없이 돌리면 거의 같은 방식으로 망가집니다:

- **증거 없는 "완료"** — 에이전트가 끝났다고 하는데, 수용 기준 대비 확인한 사람이 없습니다
- **사라지는 결정** — 아키텍처를 왜 이렇게 골랐는지, 리뷰에서 뭘 논의했는지 기록이 안 남습니다
- **병렬 충돌** — 에이전트 여럿이 같은 파일을 건드리고, 깨진 건 한참 뒤에야 드러납니다
- **학습 제로** — 세션이 바뀌면 같은 실수를 처음부터 다시 합니다

에이전트를 하나에서 여럿으로 늘리면, 이런 문제는 더해지는 게 아니라 곱해집니다.

---

## 동작 방식

```mermaid
graph LR
    A[사용자 의도] --> B[Specifying]
    B --> C[Building]
    C --> D[Polishing]
    D --> E[Evolving]

    B -.- B1["Intake -> 스펙 -> 아키텍처\n-> 태스크 컴파일"]
    C -.- C1["태스크별 파이프라인 x N\n(안전하면 병렬)"]
    D -.- D1["보안 -> 문서 -> 정리"]
    E -.- E1["Gap 평가 -> 규칙\n-> 메모리 -> 요약"]
```

미션은 언제나 네 단계를 전부 밟습니다. 작은 요청이면 가볍게, 큰 작업이면 풀코스로 — 규모만 달라집니다.

태스크 하나는 **14단계 거버넌스 파이프라인**을 거칩니다: 구현 계약 -> 구현 -> 셀프체크 -> 코드 리뷰 + 테스트 -> Evidence Gate -> Closure Packet -> Critical Reviewer -> Final Verdict -> 회고 -> 메모리 추출. [-> 파이프라인 상세](docs/ko/architecture/DESIGN.md)

### 검증 흐름

태스크는 다음을 통과해야 닫힙니다:

- **Tier 0** — 사전 조건, 필수 아티팩트, 태스크 상태 적합성
- **Tier 1** — build, lint, test, typecheck
- **Tier 2** — 수용 기준 충족 여부와 루브릭 점수
- **Final Verdict** — 증거를 모두 모은 뒤 내리는 제품 수준 최종 판정

*에이전트가 끝났다고 말하는 것*과 *프로토콜이 계약 충족을 증명하는 것*은 다릅니다.

### 저장소에 남는 것

Geas는 운영 상태와 증거를 `.geas/`에 남깁니다:

```
.geas/
├── state/          # 세션 체크포인트, 락, 상태 신호
├── tasks/          # 계약, 증거, 판결 (태스크별)
├── memory/         # 학습 패턴 (candidate -> canonical)
├── ledger/         # 추가 전용 이벤트 로그
└── rules.md        # 공유 규칙 (시간이 갈수록 쌓임)
```

---

## 팀

프로토콜이 정의하는 에이전트 타입은 **12개**이고, 역할마다 권한 범위와 결과물 책임이 정해져 있습니다.

**핵심 권한 역할** — Product Authority, Architecture Authority, Critical Reviewer, Process Lead

**전문 역할** — Frontend Engineer, Backend Engineer, QA Engineer, Security Engineer, UI/UX Designer, DevOps Engineer, Technical Writer, Repository Manager

[-> 전체 팀 레퍼런스](docs/ko/reference/AGENTS.md)

---

## 실제 동작 예시

```
[Orchestrator]     Specifying: intake 완료. 태스크 3개 컴파일됨.
[Orchestrator]     Building: task-001 시작.

[UI/UX Designer]   모바일 퍼스트 레이아웃. 세로 카드 스택.
[사람]              파이차트 대신 막대그래프로 해줘.              <- 사람의 개입
[Arch Authority]   동의. CSS-only 막대그래프.
[Frontend Eng]     구현 완료. 5개 컴포넌트.
[QA Engineer]      수용 기준 5/5 통과.
[Critical Rev]     리스크: 오프라인 폴백 없음.
[Orchestrator]     Evidence Gate: PASS. Closure packet 조립됨.
[Product Auth]     Final Verdict: PASS.
[Process Lead]     회고: CSS 애니메이션 규칙을 rules.md에 추가.

[Orchestrator]     Polishing: 보안 리뷰, 문서, 정리.
[Orchestrator]     Evolving: gap 평가, 메모리 승격, 요약.
[Orchestrator]     미션 완료. 3/3 태스크 통과.
```

사람이 통제합니다. 에이전트가 제안하고, 사람이 결정하고, 프로토콜이 검증 없는 배포를 막습니다.

---

## 문서

| 문서 | 설명 |
|------|------|
| [아키텍처](docs/ko/architecture/DESIGN.md) | 시스템 설계, 데이터 흐름, 원칙 |
| [프로토콜](docs/ko/protocol/) | 14개 운영 프로토콜 문서 |
| [스키마](docs/protocol/schemas/) | 29개 JSON Schema 정의 (draft 2020-12) |
| [Agents](docs/ko/reference/AGENTS.md) | 12개 에이전트 타입과 권한 모델 |
| [Skills](docs/ko/reference/SKILLS.md) | 27개 스킬 레퍼런스 |
| [Hooks](docs/ko/reference/HOOKS.md) | 18개 라이프사이클 hook 레퍼런스 |

---

## 라이선스

[Apache License 2.0](LICENSE)

---

<div align="center">

**프로토콜을 정의하세요. 미션을 설명하세요. 결과를 검증하세요. 팀이 성장하는 걸 지켜보세요.**

</div>
