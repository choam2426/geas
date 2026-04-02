<div align="center">

**[English](README.md)** | **한국어**

# Geas

### Governance. Traceability. Verification. Evolution.

멀티 에이전트 AI 개발을 위한 거버넌스 프로토콜.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)

</div>

---

## 문제

멀티 에이전트 AI 개발은 강력하지만 통제되지 않습니다:

- **"완료"가 의미 없음** — 에이전트가 작업이 끝났다고 하지만, 수용 기준 대비 검증한 사람이 없음
- **결정이 사라짐** — 누가 이 아키텍처를 골랐나? 왜 그 라이브러리를 선택했나? 기록이 없음
- **학습 제로** — 세션마다 같은 실수를 반복
- **병렬 혼돈** — 두 에이전트가 같은 파일을 수정하고, 통합이 깨져야 발견

에이전트를 1개에서 12개로 늘리면, 문제는 더해지는 게 아니라 곱해집니다.

---

## Geas가 하는 일

Geas는 멀티 에이전트 작업의 전체 생명주기를 통제하는 프로토콜입니다:

**모든 결정에 프로세스가 있음** — 아키텍처 선택은 투표를 거칩니다. 이견이 있으면 구조화된 의사결정이 실행됩니다. 트레이드오프는 결정 기록에 남습니다.

**모든 행동이 추적 가능** — 상태 전환은 추가 전용 원장에 기록됩니다. 체크포인트가 파이프라인 위치를 추적합니다. 복구 패킷으로 중단 후 정확히 재개할 수 있습니다.

**모든 결과물이 계약 대비 검증됨** — Evidence Gate가 3단계로 검증: 기계적(빌드/린트/테스트), 의미론적(수용 기준 + 루브릭 점수), 그리고 Product Authority가 최종 판결. "완료" = "계약 충족."

**팀이 점점 똑똑해짐** — 작업마다 회고. 교훈이 메모리 후보가 되어 리뷰를 거쳐 승격됩니다. 규칙이 진화합니다. 컨텍스트 패킷이 미래 작업에 관련 메모리를 주입합니다.

---

## 실제 동작

```
[Orchestrator]     Specifying: intake 완료. 태스크 3개 컴파일됨.
[Orchestrator]     Building: task-001 시작.

[UI/UX Designer]   모바일 퍼스트 레이아웃. 세로 카드 스택.
[사람]              파이차트 대신 막대그래프로 해줘.              ← 사람의 개입
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

당신이 통제합니다. 에이전트가 제안하고, 당신이 결정합니다. 프로토콜이 검증 없는 배포를 막습니다.

---

## 동작 방식

```mermaid
graph LR
    A[사용자 의도] --> B[Specifying]
    B --> C[Building]
    C --> D[Polishing]
    D --> E[Evolving]

    B -.- B1["Intake → 스펙 → 아키텍처\n→ 태스크 컴파일"]
    C -.- C1["Per-task 파이프라인 × N\n(안전할 때 병렬)"]
    D -.- D1["보안 → 문서 → 정리"]
    E -.- E1["Gap 평가 → 규칙\n→ 메모리 → 요약"]
```

모든 phase가 항상 실행됩니다. 규모만 요청에 따라 조절 — 기능 하나면 가볍게, 풀 프로덕트면 풀코스.

각 태스크는 **14단계 거버넌스 파이프라인**을 거칩니다: 구현 계약 → 구현 → 셀프체크 → 코드 리뷰 + 테스팅 → Evidence Gate → Closure Packet → Critical Reviewer → Final Verdict → 회고 → 메모리 추출. [→ 상세 파이프라인](docs/ko/architecture/DESIGN.md)

모든 것이 `.geas/`에 기록됩니다:

```
.geas/
├── state/          # 세션 체크포인트, 락, 건강 신호
├── tasks/          # 계약, 증거, 판결 (태스크별)
├── memory/         # 학습된 패턴 (candidate → canonical)
├── ledger/         # 추가 전용 이벤트 로그
└── rules.md        # 공유 규칙 (시간이 갈수록 성장)
```

[→ 전체 디렉토리 구조](docs/ko/architecture/DESIGN.md)

---

## 팀

프로토콜은 **12개 에이전트 타입**을 정의합니다 — Product Authority(제품 판단, 최종 판결)부터 Process Lead(회고, 규칙 진화)까지 — 각각 거버넌스 파이프라인 내에서 명시적 권한과 책임을 가집니다.

[→ 전체 팀 레퍼런스](docs/ko/reference/AGENTS.md)

---

## 빠른 시작

> Geas는 프로토콜입니다. 이 빠른 시작은 프로토콜의 한 구현체인 **Claude Code 플러그인**을 사용합니다.

**준비물**: [Claude Code CLI](https://claude.ai/code) 설치 및 인증

```bash
# 설치
/plugin marketplace add choam2426/geas
/plugin install geas@choam2426-geas

# 실행
/geas:mission
```

만들고 싶은 것, 추가할 기능, 결정할 사안을 설명하면 됩니다. 오케스트레이터가 나머지를 처리합니다.

---

## 문서

| | 문서 | 설명 |
|---|------|------|
| 📐 | [아키텍처](docs/ko/architecture/DESIGN.md) | 시스템 설계, 데이터 흐름, 원칙 |
| 📋 | [프로토콜](docs/ko/protocol/) | 14개 운영 프로토콜 문서 |
| 📦 | [스키마](docs/protocol/schemas/) | 29개 JSON Schema 정의 (draft 2020-12) |
| 🔧 | [Skills](docs/ko/reference/SKILLS.md) | 27개 스킬 레퍼런스 |
| 🤖 | [Agents](docs/ko/reference/AGENTS.md) | 12개 에이전트 타입 레퍼런스 |
| ⚡ | [Hooks](docs/ko/reference/HOOKS.md) | 18개 라이프사이클 hook 레퍼런스 |

---

## 라이선스

[Apache License 2.0](LICENSE)

---

<div align="center">

**프로토콜을 정의하세요. 미션을 설명하세요. 결과를 검증하세요. 팀이 성장하는 걸 지켜보세요.**

</div>
