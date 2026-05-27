## Plan Summary

Todo 상태 모델을 하나로 유지하고, 선택된 필터에 따라 보이는 목록만 파생한다. Todo 항목은 상태가 바뀔 때마다 localStorage에 저장하고, 앱 시작 시 저장된 값을 복원한다.

## Approach

필터와 저장 유지 기능은 기존 Todo 추가, 완료 토글, 삭제 흐름과 같은 상태 모델을 공유한다. 별도 경로나 백엔드를 추가하지 않고, 기존 클라이언트 상태 위에 필터 파생값과 localStorage 입출력을 붙인다.

## Key Context

- Todo item: 텍스트, 완료 상태, 안정적인 id를 가진 항목
- Filter: 같은 Todo 상태 위에서 선택된 보기
- Persistence: 앱 시작 시 복원되는 localStorage 스냅샷

## Impact Surface

- Todo 상태 모델
- 필터 컨트롤
- localStorage 로드와 저장 동작
- 저장 유지와 필터 동작을 확인할 테스트 또는 수동 확인

## Task Structure

### task-001

목적: Todo 항목 저장 유지와 All, Active, Completed 필터를 추가한다.

Mission 기준: AC-001, AC-002, AC-003, AC-004

## Validation And Review Strategy

- Todo 추가, 삭제, 완료 토글이 기존처럼 동작하는지 확인한다.
- 필터가 같은 Todo 목록에서 화면 표시만 바꾸는지 확인한다.
- 새로고침 뒤 Todo 항목과 완료 상태가 유지되는지 확인한다.
- localStorage 비활성화 환경과 여러 모바일 브라우저는 미검증 범위로 드러낸다.

## User Decision Points

- localStorage가 비활성화된 환경까지 이번 Mission에서 처리할지 판단한다.
- 손상된 저장 데이터가 발견될 때 사용자에게 알릴지, 안전하게 초기화할지 판단한다.

## Risks And Mitigations

- 손상된 localStorage 데이터가 앱 시작을 깨뜨릴 수 있다.
- 필터 UI가 기존 항목을 숨기면 사용자가 Todo가 사라진 것으로 오해할 수 있다.
- 브라우저 로컬 저장의 한계는 Mission Evidence와 Debt Ledger에 남긴다.

## Change Triggers

- 서버 저장소, 로그인, 여러 기기 동기화가 필요해진다.
- 필터 상태를 URL이나 외부 내비게이션과 연결해야 한다.
- 저장 데이터 스키마 변경이나 마이그레이션이 필요해진다.

## Continuity Requirements

- 저장 유지 한계와 필터 상태 URL 미연동은 이후 작업에서 다시 판단할 수 있게 남긴다.
- Todo 저장 스키마가 바뀌면 Debt Ledger의 마이그레이션 항목을 다시 본다.
