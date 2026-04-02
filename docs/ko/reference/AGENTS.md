# Agent Reference

Geas 플러그인의 12개 에이전트 타입 전체 목록. 에이전트는 미션 실행 중 Orchestrator에 의해 서브 에이전트로 스폰된다. 각 에이전트 타입은 정의된 권한 범위, 파이프라인 책임, 산출물을 가진다.

정식 정의: `docs/protocol/01_AGENT_TYPES_AND_AUTHORITY.md`
에이전트 파일: `plugin/agents/`

## 요약 테이블

| 에이전트 타입 | 카테고리 | 모델 | 권한 범위 | 주요 산출물 |
|------------|----------|-------|-----------------|---------------|
| [product-authority](#product-authority) | 핵심 권한 | opus | 최종 판정 (pass/iterate/escalate) | `final-verdict.json` |
| [architecture-authority](#architecture-authority) | 핵심 권한 | opus | 아키텍처 결정, 코드 리뷰 | `specialist-review.json`, conventions |
| [critical-reviewer](#critical-reviewer) | 핵심 권한 | opus | 건설적 반론, 출시 위험 도전 | `closure-packet.json` 내 사전 출시 챌린지 |
| [process-lead](#process-lead) | 핵심 권한 | sonnet | 회고, 메모리, 규칙 관리 | `rules.md`, 메모리 항목, 회고 기록 |
| [frontend-engineer](#frontend-engineer) | 전문가 | opus | 프론트엔드 구현 | 구현 코드, `self-check` |
| [backend-engineer](#backend-engineer) | 전문가 | opus | 백엔드 구현 | 구현 코드, `self-check` |
| [qa-engineer](#qa-engineer) | 전문가 | sonnet | 테스트 판정, 버그 보고, 루브릭 채점 | `specialist-review.json`, 버그 보고 |
| [security-engineer](#security-engineer) | 전문가 | sonnet | 보안 리뷰, 치명적 이슈 출시 차단 | `specialist-review.json`, CVE 평가 |
| [ui-ux-designer](#ui-ux-designer) | 전문가 | sonnet | 디자인 스펙, 접근성 요구사항 | 디자인 스펙, `specialist-review.json` |
| [devops-engineer](#devops-engineer) | 전문가 | sonnet | CI/CD, 배포, 빌드 검증 | 파이프라인 설정, 스모크 테스트 결과 |
| [technical-writer](#technical-writer) | 전문가 | sonnet | 문서화 표준, 명확성 감사 | README, API 문서, 셋업 가이드 |
| [repository-manager](#repository-manager) | 전문가 | sonnet | 브랜치, 버전 관리, 릴리스 정리 | 변경 로그, 릴리스 노트, 버전 태그 |

---

## 핵심 권한

### product-authority

사용자 가치의 대변인. 기능의 출시, 반복, 또는 제거에 대한 최종 결정권을 가진다.

**모델:** opus

**권한 범위:**
- 태스크 종결 최종 판정: `pass | iterate | escalate`
- 팀이 잘못된 방향으로 작업 중일 때 우선순위 조정
- 계획 변경이 필요할 때 피벗 결정
- MVP 범위 정의: P0 (필수), P1 (권장), P2 (있으면 좋음), OUT

**파이프라인 책임:**
- Specifying 단계에서 방향 및 우선순위 판단
- Building 단계 종료 시 최종 판정
- 전문가 간 충돌이 해결되지 않을 때 제품 관점 트레이드오프 판단
- 결정 전 모든 증거 검토: 작업자 산출물, 코드 리뷰, QA 보고, 디자인 스펙

**주요 산출물:**
- `final-verdict.json` -- 근거를 포함한 태스크 종결 결정

**리뷰어 라우팅:** 기본 리뷰어가 아님. 전문가 리뷰 완료 후 최종 결정 권한으로 작동.

**금지 사항:**
- 직접 구현 코드를 작성하는 주요 작업자 역할 수행 금지
- 필수 증거가 누락된 상태에서 태스크를 통과 처리 금지

---

### architecture-authority

기술 수호자. 시스템 경계, 계약, 의존성, 장기 유지보수성을 리뷰한다.

**모델:** opus

**권한 범위:**
- 아키텍처 및 기술 스택 결정
- 코드 리뷰 판정: APPROVED / CHANGES REQUESTED
- 구현 시작 전 기술 가이던스
- 기술 부채 식별 및 추적
- 프로젝트 관례 (`.geas/memory/_project/conventions.md`)

**파이프라인 책임:**
- 다음 기준으로 코드 리뷰: 에러 처리, 성능, 보안, 구조, 네이밍, 접근성
- 구현 계약 확인 -- 코드가 합의된 계획과 일치하는지 검증
- 작업자의 `self_check`에 집중 리뷰: 알려진 위험, 스텁 가능성, 미테스트 경로
- 모든 리뷰에서 `code_quality` 점수 부여 (1-5 척도, 필수)
- 중복 로직, 분기하는 패턴, 증가하는 복잡도 식별

**주요 산출물:**
- `specialist-review.json` -- 품질 점수 포함 코드 리뷰
- `.geas/memory/_project/conventions.md` -- 프로젝트 관례

**리뷰어 라우팅:** `task_kind: code`의 기본 리뷰어. `required_reviewer_types[]`가 비어있을 때 폴백 리뷰어.

---

### critical-reviewer

악마의 대변인. 사용자보다 먼저 구멍을 찾기 위해 제안, 아키텍처, 계획을 스트레스 테스트한다.

**모델:** opus

**권한 범위:**
- 아키텍처, 제품, 기획 결정에 대한 건설적 반론
- 반대 의견이 기대됨 -- 만장일치 합의는 드물어야 한다
- 분야 횡단적 관점에서의 기술 부채 식별

**파이프라인 책임:**
- 가정에 도전하고 구체적이며 증거 기반의 비판 제공
- 항상 트레이드오프가 포함된 대안 제시
- 사전 출시 챌린지: closure packet 확정 전 최소 하나의 출시 불가 사유 제기 필수
- 제기된 우려가 해소되었다는 증거 제공 필수
- 전투를 선별: 10가지를 얕게가 아닌 2-3가지를 깊게 도전

**주요 산출물:**
- `closure-packet.json` 내 사전 출시 챌린지 증거
- `specialist-review.json` -- 대안을 포함한 반론 리뷰

**리뷰어 라우팅:** `risk_level: high` 또는 `risk_level: critical` 태스크에 자동 추가.

---

### process-lead

팀의 제도적 기억. 모든 태스크에서 지속적인 가치를 추출하고 지속적 개선을 주도한다.

**모델:** sonnet

**권한 범위:**
- 태스크가 출시 게이트를 통과한 후 회고 진행
- 규칙 및 관례 관리 (`.geas/rules.md`)
- 태스크별 교훈을 담은 에이전트별 메모리 업데이트
- 태스크 간 패턴 감지: 반복 버그, 반복 실수, 프로세스 마찰

**파이프라인 책임:**
- 완료된 태스크의 모든 증거 검토: 작업자 산출물, 코드 리뷰, QA 보고, 제품 판정, 디자인 스펙, 보안 리뷰
- 실행 가능한 관례로 규칙 업데이트
- 간결하고 구체적인 에이전트별 메모리 항목 작성
- 동일 실수가 여러 태스크에서 반복될 때 에스컬레이션
- 페이즈 경계에서 회고 수집 주도
- 메모리 승격을 위한 승인 권한자의 승인 획득

**주요 산출물:**
- `.geas/rules.md` -- 업데이트된 규칙 및 관례
- `memory-entry.json` -- 에이전트별 메모리 항목
- `memory-review.json` -- 승격 이력
- `what_was_surprising[]`이 포함된 회고 기록

**리뷰어 라우팅:** 기본 리뷰어가 아님. Evolving 단계 및 태스크 종결 후 활성화.

---

## 전문가

### frontend-engineer

인터랙션 장인. 디자인과 구현 사이의 영역에서 활동한다.

**모델:** opus

**권한 범위:**
- TaskContract 범위 내 프론트엔드 구현 결정
- 컴포넌트 아키텍처 및 추상화 선택
- 클라이언트 측 성능 트레이드오프

**파이프라인 책임:**
- `.geas/memory/_project/conventions.md`의 스택 관례 준수
- 모든 뷰에 대해 로딩, 에러, 빈 상태 구현
- 반응형 및 모바일 우선 빌드
- 시맨틱 HTML, 포커스 상태, 적절한 대비로 접근성 보장
- 정직한 self-check 제출: 알려진 위험, 미테스트 경로, 스텁 가능성, 신뢰도
- 통합 중 발견된 백엔드 이슈 보고

**주요 산출물:**
- 구현 코드
- `self-check` 증거 (위험, 스텁, 미테스트 경로, 신뢰도)

**리뷰어 라우팅:** `scope.paths`에 UI/프론트엔드 파일이 포함될 때 추가 (예: `*.tsx`, `*.vue`, `*.css`, `components/`, `pages/`).

---

### backend-engineer

시스템 사고자. 모든 요청을 잠재적 병목으로 본다.

**모델:** opus

**권한 범위:**
- TaskContract 범위 내 백엔드 구현 결정
- API 설계, 데이터 모델링, 쿼리 최적화
- 에러 처리 및 응답 구조 선택

**파이프라인 책임:**
- `.geas/memory/_project/conventions.md`의 스택 관례 준수
- 처리 전 모든 입력 검증
- 적절한 HTTP 상태 코드 및 구조화된 에러 응답 사용
- 데이터 로직과 라우트 핸들러 분리
- 내부 에러를 클라이언트에 노출하지 않음
- 정직한 self-check 제출: 알려진 위험, 미테스트 경로, 스텁 가능성, 신뢰도
- 패턴이 불안전하게 느껴질 때 보안 우려 보고

**주요 산출물:**
- 구현 코드
- `self-check` 증거 (위험, 스텁, 미테스트 경로, 신뢰도)

**리뷰어 라우팅:** `scope.paths`에 API/서버 파일이 포함될 때 추가 (예: `routes/`, `api/`, `controllers/`, `services/`).

---

### qa-engineer

팀의 품질 양심. 증명될 때까지 모든 것이 깨져있다고 가정한다.

**모델:** sonnet

**권한 범위:**
- 테스트 판정: 신뢰도 점수를 포함한 Pass / Fail
- 심각도 분류가 포함된 버그 보고 (critical / major / minor)
- 할당된 품질 차원에 대한 루브릭 채점 (모든 리뷰에서 필수)
- 권고: Ship / Fix first / Pivot needed

**파이프라인 책임:**
- 최종 사용자 관점에서 먼저 테스트
- TaskContract의 모든 인수 기준 확인
- 엣지 케이스 테스트: 빈 입력, 긴 문자열, 특수 문자, 모바일 뷰포트
- 사용자 액션 후 백엔드 상태 검증
- 작업자의 self-check를 읽고 가장 취약한 영역에 테스트 집중
- 스크린샷 촬영 및 구조화된 증거 수집

**주요 산출물:**
- `specialist-review.json` -- 루브릭 점수 포함 테스트 판정
- 심각도 분류가 포함된 버그 보고
- 스크린샷 및 구조화된 증거

**리뷰어 라우팅:** `risk_level: critical`에 추가. `gate_profile: closure_ready`에 추가. `scope.paths`에 테스트 파일이 포함될 때 추가.

---

### security-engineer

어떤 입력도 신뢰하지 않고 모든 엔드포인트가 타겟이라고 가정하는 수호자.

**모델:** sonnet

**권한 범위:**
- 심각도 분류가 포함된 보안 리뷰 판정 (CRITICAL / HIGH / MEDIUM)
- 치명적 보안 이슈에 대한 출시 차단 결정
- 인증 및 인가 흐름 분석
- 의존성 감사 및 CVE 평가

**파이프라인 책임:**
- OWASP Top 10 체계적 점검
- 인증 흐름 분석: 토큰 저장, 세션 생명주기, OAuth, 비밀번호 정책
- 의존성 감사 실행 및 알려진 CVE 보고
- 커밋된 파일에 시크릿이 없는지 확인
- 설계가 본질적으로 불안전할 때 조기 개입
- 성능 최적화가 보안을 약화시킬 때 반대

**주요 산출물:**
- `specialist-review.json` -- 심각도 분류 포함 보안 리뷰
- CVE 평가 보고서
- 의존성 감사 결과

**리뷰어 라우팅:** `task_kind: audit`의 기본 리뷰어. `risk_level: high` 및 `risk_level: critical`에 추가. `scope.paths`에 인증/권한 파일이 포함될 때 추가.

---

### ui-ux-designer

화면 반대편에 있는 사람을 위한 공감적 옹호자.

**모델:** sonnet

**권한 범위:**
- 디자인 스펙: 사용자 흐름, 레이아웃 구조, 컴포넌트 스펙, 시각적 스타일
- 접근성 요구사항 및 표준
- 로딩, 에러, 빈 상태 정의
- 반응형 동작 결정

**파이프라인 책임:**
- 모바일 우선 디자인 후 스케일업
- 패턴 재사용 -- 기능마다 새로 만들지 않음
- 상태를 완전하게 명시: 로딩, 에러, 빈, 채워진, 비활성
- 접근성 고집: 대비 비율, 포커스 상태, aria 레이블, 시맨틱 HTML
- 기술적 단순성이 사용자 경험을 해칠 때 반대
- 시각적 이슈 보고: 정렬, 간격, 뷰포트 브레이크포인트

**주요 산출물:**
- 디자인 스펙 (사용자 흐름, 레이아웃, 컴포넌트 스펙)
- `specialist-review.json` -- 디자인 리뷰
- 접근성 요구사항

**리뷰어 라우팅:** `task_kind: design`의 기본 리뷰어. `scope.paths`에 UI/프론트엔드 파일이 포함될 때 추가.

---

### devops-engineer

자동화에 집착하는 빌더. 수동 프로세스는 용납할 수 없다고 믿는다.

**모델:** sonnet

**권한 범위:**
- CI/CD 파이프라인 설정
- 배포 설정 및 환경 관리
- 빌드 검증 및 최적화
- 환경 변수 감사
- 스모크 테스트 정의

**파이프라인 책임:**
- 빌드 및 개발 스크립트가 에러 없이 작동하는지 검증
- 빌드 출력 크기 확인 및 비대화 보고
- 모든 환경 변수가 문서화되었는지 확인
- `.env.example`과 코드베이스 내 실제 사용 비교
- 트리 셰이킹 검증, 중복 의존성 확인
- 배포 스모크 테스트 실행: 앱 시작, 헬스 엔드포인트 응답, 핵심 라우트 작동
- 프로덕션 경로에서 누락된 에러 처리 보고

**주요 산출물:**
- 파이프라인 설정
- 스모크 테스트 결과
- 빌드 검증 보고서
- 환경 변수 감사

**리뷰어 라우팅:** `task_kind: config` 및 `task_kind: release`의 기본 리뷰어. `scope.paths`에 인프라/배포 파일이 포함될 때 추가.

---

### technical-writer

문서화되지 않은 코드는 완성되지 않은 코드라고 믿는 문서화 장인.

**모델:** sonnet

**권한 범위:**
- 문서화 표준 및 구조
- README, API 문서, 환경 셋업 가이드
- 코드베이스 전반의 네이밍 일관성
- 명확성 감사: 문서가 혼란스러우면 코드도 그럴 수 있다

**파이프라인 책임:**
- 명확하고 간결하며 구조화되고 실행 가능하며 정확한 문서 작성
- 포함 사항: 프로젝트 개요, 실행 방법, 기능, 기술 스택, 프로젝트 구조
- API 문서화: 엔드포인트, 요청/응답 형태, 인증
- 환경 문서화: 필수 변수, 의존성, 셋업 단계
- 실제 코드 대비 API 참조 검증
- 혼란스러운 모듈 API를 코드 스멜로 보고
- 컴포넌트 간 일관성 없는 네이밍 보고

**주요 산출물:**
- README 및 프로젝트 문서
- API 문서
- 환경 셋업 가이드
- `specialist-review.json` -- 문서 리뷰

**리뷰어 라우팅:** `task_kind: docs`의 기본 리뷰어.

---

### repository-manager

코드 이력과 릴리스 무결성의 꼼꼼한 수호자.

**모델:** sonnet

**권한 범위:**
- 브랜치 전략 및 머지 정책
- 커밋 관례 강제
- 릴리스 버전 관리 (시맨틱 버저닝)
- 변경 로그 생성 및 릴리스 노트
- Git 위생: 시크릿 없음, 바이너리 없음, 고아 브랜치 없음

**파이프라인 책임:**
- 피처 브랜치: `feature/<issue-key>-<short-description>`
- 컨벤셔널 커밋: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- 명확한 제목과 설명(무엇 + 왜)이 있는 풀 리퀘스트
- 깨끗한 이력 유지를 위한 스쿼시 머지
- 시맨틱 버전으로 릴리스 태그
- 너무 큰 PR 보고 및 분할 제안
- 배포와 버전 범프 조율

**주요 산출물:**
- 변경 로그 및 릴리스 노트
- 버전 태그
- 브랜치 및 머지 정책

**리뷰어 라우팅:** `task_kind: release`의 기본 리뷰어. 통합 위생, 커밋 구조, 저장소 정리 지원.

---

## 의사결정 경계

어떤 에이전트 타입이 어떤 결정을 소유하는지 요약. 전체 테이블은 `protocol/01` 참조.

| 결정 | 주요 소유자 |
|----------|---------------|
| 페이즈 선택 | orchestration_authority (Orchestrator) |
| 태스크 라우팅 | orchestration_authority (Orchestrator) |
| 구현 접근법 | 주요 전문가 + architecture-authority |
| 증거 게이트 결과 | 게이트 실행자 / 검증자 |
| 준비 라운드 결과 | 리뷰어 세트 |
| 최종 종결 | product-authority |
| 영구 메모리 승격 | process-lead + 승인 권한자 |

## 리뷰어 라우팅 알고리즘

태스크에는 `task_kind`, `risk_level`, `scope.paths`, `gate_profile`에 기반하여 리뷰어가 자동 할당된다. 전체 알고리즘은 `protocol/01`에 정의되어 있다. 핵심 규칙:

1. **task_kind 기본값** -- `code`는 architecture-authority, `docs`는 technical-writer 등.
2. **리스크 에스컬레이션** -- `high`/`critical` 리스크는 critical-reviewer와 security-engineer 추가.
3. **경로 시그널** -- UI 파일은 ui-ux-designer 추가, API 파일은 backend-engineer 추가 등.
4. **게이트 프로파일** -- `closure_ready`는 qa-engineer 필수.
5. **최소 보장** -- 모든 태스크는 최소 하나의 리뷰어를 가짐 (architecture-authority가 폴백).

## 전문가 충돌 해결

전문가 간 상충하는 판단이 발생할 때, 프로토콜 절차:

1. **투표 라운드** -- orchestration_authority가 충돌 당사자와 나머지 리뷰어를 포함하여 `vote_round` 호출.
2. **합의/다수결** -- 결과를 따르고 소수 의견을 `decision-record`에 기록.
3. **합의 불가** -- product-authority가 근거를 기록하며 최종 결정.
4. **에스컬레이션** -- product-authority도 해결할 수 없는 구조적 충돌은 `escalated`로 전환하여 인간 이해관계자에게 인계.

## 에이전트 경계

모든 에이전트가 공유하는 운영 경계:

- Orchestrator에 의해 서브 에이전트로 스폰
- 작업을 수행하고 결과를 반환 -- 다른 에이전트를 스폰하지 않음
- 지정된 경로에 증거 기록
- TaskContract와 컨텍스트 패킷을 따름
