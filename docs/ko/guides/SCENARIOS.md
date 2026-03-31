# 실제 시나리오

## 시나리오 1: 실시간 경매 플랫폼 구축 (Initiative)

### 미션
"실시간 경매 플랫폼 — WebSocket bidding, anti-sniping, optimistic locking, admin dashboard"

### 타임라인
| 시간 | 이벤트 |
|------|--------|
| 0:00 | 세션 시작, .geas/ 초기화 |
| 0:03 | Seed 고정 (6개 기준, 7개 scope_in) |
| 0:04 | Genesis: Nova 비전 + PRD + 스토리 |
| 0:08 | Forge 아키텍처 (19KB 문서) |
| 0:12 | 투표 라운드: 3/3 동의 |
| 0:15 | 15개 TaskContract 컴파일 |
| 0:20 | MVP Build 시작, US-01 Implementation Contract 포함 |
| 2:10 | 15/15 태스크 통과 |
| 2:25 | Polish + Evolution 완료, v0.1.0 태그 생성 |

### 주요 관찰사항
- 전체 Initiative에서 56개 서브에이전트 생성
- US-01 Implementation Contract: 24개 계획된 행동, 7개 엣지 케이스, 8개 non-goal
- Worker self-check: 모든 worker가 신뢰도 점수 포함 (4-5)
- Forge rubric: 모든 태스크에서 일관된 code_quality=4
- Sentinel rubric: 점수 범위 1-5, 실제 품질 차이를 부각
- US-15 (Admin Suspend Bidder): 치명적 점수 (core=2, feat=2, regr=1) — "조건부"로 Ship

### Rubric 점수표
| 태스크 | core(≥3) | feat(≥4) | regr(≥4) | code(≥4) |
|--------|----------|----------|----------|----------|
| US-01 | 5 | 5 | 4 | 4 |
| US-02 | 5 | 5 | 4 | 4 |
| US-03 | 5 | 5 | 4 | 4 |
| US-04 | 5 | 4 | **2** | 4 |
| US-05 | 4 | 5 | **2** | 4 |
| US-15 | **2** | **2** | **1** | **3** |

6개 채점 태스크 중 3개에서 임계값 위반 발생.

## 시나리오 2: 정산 + 분쟁 기능 추가 (Sprint)

### 미션
"경매 플랫폼에 정산 내역 조회 및 분쟁 시스템 추가"

### Initiative와 달라진 점
- seed.json이 읽기 전용 (덮어쓰지 않음)
- Rubric 생성: 6개 차원
- Implementation Contract: 21개 행동, 10개 엣지 케이스, 15개 데모 단계
- 모든 remaining_steps가 올바르게 추적 및 제거됨
- Rubric 점수: 모든 차원 ≥ 4 (regression_safety=5)

### 주요 지표
| 지표 | Initiative (수정 전) | Sprint (수정 후) |
|------|---------------------|-----------------|
| TaskContract rubric | 0% | 100% |
| Implementation Contract | 6.7% | 100% |
| Sentinel rubric | 40% | 100% |
| remaining_steps | 해당 없음 | 11개 단계 모두 추적됨 |

## 교훈

### 잘 작동하는 것
1. 에이전트 정의가 100% 준수됨 — 지침을 두기에 가장 신뢰할 수 있는 곳
2. Self-check와 Forge rubric이 개입 없이 작동함
3. Implementation Contract가 잘못 이해된 요구사항을 방지함

### 수정이 필요했던 것
1. SKILL.md의 파이프라인 단계가 context compaction 후 누락됨 → remaining_steps으로 해결
2. 선택적 스키마 필드가 에이전트에 의해 무시됨 → 중요한 필드를 필수로 설정
3. core skill의 도구별 하드코딩 → conventions.md 참조 패턴으로 해결
