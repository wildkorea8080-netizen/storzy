# 주문 대조 스캔 상세 유형 필터

스캔 상세는 전체, 누락 주문, 취소 상태 불일치, 결제 상태 불일치로 필터링할 수 있다. 필터는 페이지네이션보다 먼저 적용되어 선택한 유형 안에서 100건 단위로 조회한다.

API의 `issueType`은 `MISSING_LOCAL_ORDER`, `CANCELLATION_MISMATCH`, `FINANCIAL_STATUS_MISMATCH`만 허용한다. 허용되지 않은 값은 `400`을 반환하며 SQL에는 바인딩 파라미터로 전달한다.
