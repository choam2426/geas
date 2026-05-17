# Runtime Minimal Example

이 디렉터리는 `docs/runtime.md`의 runtime 저장 모델을 최소 형태로 예행 실행한 예시다.

예시는 현실적인 작은 제품 변경을 사용한다.

> 기존 Todo 앱에 상태 필터와 localStorage 기반 저장 유지를 추가한다.

artifact에서 참조하는 앱 소스 파일은 예시 Mission의 설명용 산출물이다. 이 디렉터리에는 포함하지 않고, 남겨질 Geas runtime 산출물만 보여 준다.

예시는 하나의 Mission과 하나의 Task가 버전이 있는 기준선 artifact에서 수용된 결과 요약까지 이동하는 흐름을 따른다.

- Mission 기준 산출물: `mission-spec-001.md`, `mission-design-001.md`
- Task 계약: `tasks/task-001/task-contract-001.md`
- Task 상태: `tasks/task-001/task-state.yaml`
- Task 작업과 Evidence: implementation, verification, review, task challenger, Task Evidence, result judgment
- Mission 마감: Mission 결과 수용 판단, Mission Evidence
- Debt Ledger: `.geas/debts.yaml`
- 연속성: `.geas/run-state.yaml`
- Memory: `.geas/memory/common.yaml`, `.geas/memory/roles/reviewer.yaml`

내용은 의도적으로 얇게 유지한다. 목적은 모든 필수 key를 채울 수 있는지, 최소 작성 비용으로도 artifact 참조가 이해 가능한지 확인하는 것이다.
