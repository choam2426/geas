# Evidence

## 목적

이 문서는 Evidence, 검증 근거, 미검증 범위, review, verification, agent 측 verdict 입력을 정의한다.

Evidence는 agent가 인간의 검토와 수용 판단을 돕기 위해 검증 근거와 미검증 범위를 함께 정리한 근거 자료다.

## Evidence의 역할

Evidence는 다음 질문에 답해야 한다.

- 무엇을 했는가?
- 무엇을 확인했는가?
- 무엇을 확인하지 못했는가?
- 어떤 결과가 나왔는가?
- 계약 기준과 어떻게 대응하는가?
- 남은 위험은 무엇인가?

Evidence는 완료 선언이 아니다. Evidence는 User가 검토하고 수용 판단할 수 있게 만드는 근거 자료다.

## 검증 근거

검증 근거는 agent가 남기는 확인 자료다.

예시는 다음과 같다.

- 테스트 결과
- 리뷰 결과
- 실행 출력
- 변경 내역
- 확인한 파일이나 화면
- acceptance criteria별 결과
- 계약 기준과 결과의 대응

## 미검증 범위

미검증 범위는 확인하지 못한 작업이나 범위다.

미검증 범위는 검증 근거가 아니다. 검증 근거와 함께 드러내야 하는 한계다.

미검증 범위에는 다음 내용이 들어갈 수 있다.

- 실행하지 못한 테스트
- 확인하지 못한 환경
- 검토하지 못한 파일이나 화면
- 시간이나 접근 권한 때문에 확인하지 못한 범위
- User가 받아들일지 판단해야 하는 남은 위험

## Evidence 종류

### Implementation Evidence

Implementer가 실제로 수행한 작업과 자기 점검을 정리한 Evidence다.

포함할 내용은 다음과 같다.

- 수행한 작업 요약
- 변경 또는 생성한 산출물
- 중요한 판단과 이유
- 계약과 달라진 점
- 자기 점검

### Review Evidence

Reviewer가 특정 관점에서 결과를 검토한 Evidence다.

포함할 내용은 다음과 같다.

- 검토 관점
- 검토한 범위
- 사용한 방법
- 발견한 문제
- 제외한 범위
- verdict 또는 권고

### Challenger Evidence

Challenger가 devil's advocate 관점에서 기준선이나 결과를 압박해 본 Evidence다.

포함할 내용은 다음과 같다.

- 압박한 기준선이나 결과
- 드러난 모호한 가정이나 빠진 질문
- 과도한 낙관, 암묵적 확장, scope 경계 위반
- acceptance criteria, 검증 방법, Evidence 요구의 공백
- 보류, 중단, User 판단으로 올려야 할 위험
- 더 깊은 review나 verification이 필요한 지점

### Verification Evidence

Verifier가 acceptance criteria와 검증 방법을 확인한 Evidence다.

포함할 내용은 다음과 같다.

- 실행한 검증 방법
- 기준별 결과
- 실행 출력 또는 관찰 결과
- 실패한 항목
- 실행하지 못한 항목과 이유
- 미검증 범위

### Decision Input Evidence

Orchestrator가 여러 Evidence를 종합해 User의 수용 판단을 돕기 위해 남기는 입력이다.

포함할 내용은 다음과 같다.

- 결과 요약
- 충족한 기준
- 충족하지 못한 기준
- 미검증 범위
- 남은 위험
- 가능한 선택지
- agent 측 verdict 또는 권고

이 입력은 User의 수용 판단을 대체하지 않는다.

## Verdict

agent는 Evidence를 바탕으로 verdict나 권고를 남길 수 있다.

권장 verdict는 다음과 같다.

|verdict|의미|
|---|---|
|satisfied|계약 기준을 만족한다고 볼 근거가 충분하다.|
|changes_requested|재작업이나 추가 확인이 필요하다.|
|blocked|현재 기준으로 진행하거나 판단할 수 없다.|
|escalated|Task나 agent 판단 범위를 넘어 User 또는 Mission 수준 판단이 필요하다.|
|cancelled|더 진행하지 않는 것이 타당하다.|

verdict는 agent 측 판단이다. 최종 완료는 User가 Evidence를 검토하고 수용 판단을 남겨야 성립한다.

## Evidence 품질 기준

좋은 Evidence는 다음 조건을 만족한다.

- 계약 기준과 연결되어 있다.
- 무엇을 확인했는지 구체적으로 말한다.
- 무엇을 확인하지 못했는지 숨기지 않는다.
- 실행 출력이나 관찰 결과처럼 재검토 가능한 근거를 남긴다.
- 단순한 자신감 표현으로 검증을 대신하지 않는다.
- User가 판단해야 할 남은 위험을 드러낸다.

나쁜 Evidence는 다음과 같다.

- "완료됨"처럼 결론만 있고 근거가 없다.
- 테스트를 실행하지 않았는데 검증된 것처럼 표현한다.
- 미검증 범위를 생략한다.
- contract와 무관한 작업 요약만 남긴다.
- agent verdict를 User 수용 판단처럼 표현한다.
