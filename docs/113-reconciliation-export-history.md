# 주문 대조 CSV 내보내기 이력

스캔별 CSV 접근 감사 기록을 관리자 화면에서 조회할 수 있다. 각 기록에는 담당자, 내보내기 사유, 포함된 불일치 건수와 시각이 표시된다.

API는 `GET /api/workspaces/:workspaceId/order-reconciliation/scans/:scanId/exports?limit=50`이다. 최대 100건을 반환하며 `workspace_id`와 `scan_id`를 함께 조건으로 사용해 다른 작업공간의 감사 기록을 노출하지 않는다.
