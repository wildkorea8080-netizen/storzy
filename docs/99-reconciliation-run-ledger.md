# 주문 대조 주기 실행 원장

각 주기 대조 실행은 `order_reconciliation_runs`에 영구 기록한다.

## 상태

- `RUNNING`: advisory lock을 획득하고 실행을 시작함
- `SUCCEEDED`: 모든 워크스페이스가 성공함
- `PARTIAL`: 일부 워크스페이스만 실패함
- `FAILED`: 모든 워크스페이스가 실패했거나 실행 자체가 중단됨

원장은 조회 시간 범위, 처리자, 전체·성공·실패 워크스페이스 수, 워크스페이스별 결과와 시작·종료 시각을 저장한다. 결과에는 토큰이나 고객 주문 원문을 저장하지 않는다.

`GET /api/workspaces/:workspaceId/order-reconciliation/schedule-status`는 가장 최근 주기 실행을 반환한다. 주문 대조 화면은 마지막 상태와 성공·실패 건수를 표시한다. 아직 실행 이력이 없다면 별도 안내를 표시한다.
