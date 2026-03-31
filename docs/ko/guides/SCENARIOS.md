# 실전 시나리오

## 시나리오 1: 실시간 경매 플랫폼 구축 (Initiative)

### 미션
"실시간 경매 플랫폼 — WebSocket bidding, anti-sniping, optimistic locking, admin dashboard"

### 타임라인
| 시간 | 이벤트 |
|------|--------|
| 0:00 | 세션 시작, .geas/ 초기화 |
| 0:03 | Seed 확정 (기준 6개, scope_in 7개) |
| 0:04 | Genesis: Nova 비전 + PRD + 스토리 |
| 0:08 | Forge 아키텍처 (19KB 문서) |
| 0:12 | 투표 라운드: 3/3 찬성 |
| 0:15 | TaskContract 15개 컴파일 |
| 0:20 | MVP Build 시작, US-01 Implementation Contract 포함 |
| 2:10 | 15/15 태스크 통과 |
| 2:25 | Polish + Evolution 완료, v0.1.0 태그 |

### 주요 관찰

- 전체 Initiative에서 서브에이전트 56회 생성
- US-01 Implementation Contract: 계획된 작업 24개, 엣지 케이스 7개, non-goal 8개
- Worker self-check: 모든 worker가 신뢰도 점수를 남김 (4-5)
- Forge rubric: 전 태스크에 걸쳐 code_quality=4로 일관
- Sentinel rubric: 점수 1-5 분포. 실제 품질 차이가 드러남
- US-15 (Admin Suspend Bidder): 참담한 점수 (core=2, feat=2, regr=1) -- "조건부"로 Ship 처리

### Rubric 점수표
| 태스크 | core(>=3) | feat(>=4) | regr(>=4) | code(>=4) |
|--------|----------|----------|----------|----------|
| US-01 | 5 | 5 | 4 | 4 |
| US-02 | 5 | 5 | 4 | 4 |
| US-03 | 5 | 5 | 4 | 4 |
| US-04 | 5 | 4 | **2** | 4 |
| US-05 | 4 | 5 | **2** | 4 |
| US-15 | **2** | **2** | **1** | **3** |

채점된 태스크 6개 중 3개에서 임계값 위반이 나왔다.

## 시나리오 2: 정산 + 분쟁 기능 추가 (Sprint)

### 미션
"경매 플랫폼에 정산 내역 조회 및 분쟁 시스템 추가"

### Initiative와 뭐가 달랐나

- seed.json은 읽기 전용 (덮어쓰지 않음)
- Rubric 6차원 생성
- Implementation Contract: 작업 21개, 엣지 케이스 10개, 데모 단계 15개
- remaining_steps 전부 정상적으로 추적 및 소화
- Rubric 점수: 전 차원 4 이상 (regression_safety=5)

### 주요 지표
| 지표 | Initiative (수정 전) | Sprint (수정 후) |
|------|---------------------|-----------------|
| TaskContract rubric | 0% | 100% |
| Implementation Contract | 6.7% | 100% |
| Sentinel rubric | 40% | 100% |
| remaining_steps | N/A | 11개 단계 전부 추적 |

## 배운 것

### 잘 된 것
1. 에이전트 정의는 100% 지켜진다. 지침을 넣기에 가장 확실한 곳이다
2. Self-check와 Forge rubric은 별도 개입 없이 잘 돌아간다
3. Implementation Contract 덕분에 요구사항 오해가 사전에 잡힌다

### 고쳐야 했던 것
1. SKILL.md의 파이프라인 단계가 context compaction 후 증발한다 -> remaining_steps로 해결
2. 선택적 스키마 필드를 에이전트가 무시한다 -> 중요한 필드는 required로 바꿔야 한다
3. core skill에 특정 도구가 하드코딩되어 있었다 -> conventions.md 참조 패턴으로 전환
