# 주문 대조 스캔 CSV 내보내기

주문 관리의 스캔 이력에서 불일치가 있는 스캔을 CSV로 내려받을 수 있다. 파일에는 Shopify 주문 ID, 이슈 유형, 로컬·Shopify 상태, 원격 갱신 시각과 기록 시각이 포함된다.

API는 `GET /api/workspaces/:workspaceId/order-reconciliation/scans/:scanId/export.csv`이다. 관리자 인증이 필요하며 스캔 소유 작업공간이 일치하지 않으면 `404`를 반환한다.

CSV는 UTF-8 BOM과 RFC 4180 방식의 따옴표 escaping을 사용한다. `=`, `+`, `-`, `@`, 탭 또는 캐리지 리턴으로 시작하는 셀에는 작은따옴표를 붙여 스프레드시트 수식 실행을 차단한다. 응답에는 `Cache-Control: no-store, private`를 적용한다.
