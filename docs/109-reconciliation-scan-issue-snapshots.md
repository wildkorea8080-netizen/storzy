# 주문 대조 스캔 불일치 스냅샷

각 대조 스캔에서 발견한 불일치를 별도 스냅샷으로 보존한다. 스냅샷에는 Shopify 주문 ID, 이슈 유형, 로컬 상태, Shopify 상태와 원격 갱신 시각이 포함된다.

활성 이슈는 다음 스캔에서 갱신되거나 해결될 수 있지만 스냅샷은 변경하지 않는다. 따라서 과거 스캔의 유형별 건수와 상세 주문 근거가 계속 일치한다.

주문 관리의 `스캔 이력` 탭에서 `불일치 상세`를 누르면 다음 읽기 전용 API를 호출한다.

`GET /api/workspaces/:workspaceId/order-reconciliation/scans/:scanId/issues`

조회 조건에는 `workspace_id`와 `scan_id`가 모두 포함되므로 다른 워크스페이스의 주문 ID나 상태는 반환되지 않는다.
