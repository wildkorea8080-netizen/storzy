# 주문 대조 스캔 상세 페이지네이션

스캔 불일치 상세 API는 한 요청에서 최대 100건만 반환한다.

`GET /api/workspaces/:workspaceId/order-reconciliation/scans/:scanId/issues?limit=100&offset=0`

`limit`은 1~100, `offset`은 0 이상의 정수여야 한다. 조회에는 항상 워크스페이스 ID와 스캔 ID를 함께 사용한다. 화면은 100건이 반환되면 `다음 100건` 버튼으로 같은 상세 영역에 다음 페이지를 추가한다.

CSV 내보내기는 감사 목적의 전체 자료이므로 별도 트랜잭션에서 모든 스냅샷을 조회하며 이 화면 페이지네이션의 영향을 받지 않는다.
