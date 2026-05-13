---
name: "todo-filter-and-persistence"
task_id: "task-001"
evidence_type: "implementation"
task_contract_ref: "task-contract-001.md"
---

## Summary

Todo 필터 컨트롤을 추가하고, 선택된 필터 상태에서 보이는 Todo 목록을 파생했으며, Todo 항목을 localStorage에 저장하고 앱 시작 시 복원하도록 구현했다.

## Changed Outputs

- `src/App.tsx`
- `src/todoStorage.ts`
- `src/App.test.tsx`
- `README.md`

## Affected Scope

- Todo 목록 렌더링
- Todo 추가, 완료 토글, 삭제 흐름
- 앱 초기 로드
- 브라우저 새로고침 동작

## Implementation Decisions

- 단일 Todo 배열을 기준 상태로 두고 필터별 보이는 목록을 파생했다.
- 선택된 필터는 저장하지 않고 Todo 항목만 저장해 새로고침 뒤 앱이 All 필터에서 시작하게 했다.
- localStorage 파싱이 실패하면 빈 Todo 목록으로 대체하도록 했다.

## Assumptions

- 기존 Todo 앱의 상태 구조는 필터 파생값과 localStorage 입출력을 같은 컴포넌트 흐름 안에서 처리할 수 있다.
- 선택된 필터를 새로고침 뒤 유지하는 것은 이번 Task의 수용 기준에 포함되지 않는다.

## Contract Deltas

- 없음.

## Self Checks

- 각 필터에서 Todo를 추가하고 보이는 목록이 예상대로 갱신되는지 확인했다.
- Todo를 추가하고 완료한 뒤 새로고침해 항목과 완료 상태가 유지되는지 확인했다.
- 저장된 Todo를 삭제한 뒤 새로고침해 삭제된 항목이 다시 나타나지 않는지 확인했다.

## Limits

- localStorage가 비활성화된 브라우저는 확인하지 않았다.
- 여러 기기 동기화는 다루지 않았다.

## Reflection Candidates

- 클라이언트 저장 유지 작업에서는 파싱 실패 대체 동작을 Evidence에서 명시적으로 드러낸다.
