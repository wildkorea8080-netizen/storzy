# 운영 현황의 주문 대조 경보

운영 현황 API는 활성 주문 대조 이슈를 전체 자동화 경보와 함께 반환한다.

## 집계

`counts.reconciliation`은 `OPEN`, `ACKNOWLEDGED` 상태만 이슈 유형별로 집계한다.

- `MISSING_LOCAL_ORDER`
- `CANCELLATION_MISMATCH`
- `FINANCIAL_STATUS_MISMATCH`

## 확인 필요 경보

활성 이슈는 `ORDER_RECONCILIATION` 종류로 운영 현황의 최근 경보 20건에 포함된다. 메시지는 이슈 유형과 Shopify 주문 ID만 포함하며 고객 개인정보나 배송 주소는 노출하지 않는다.

해결되거나 재대조에서 자동 종결된 이슈는 활성 집계와 확인 필요 경보에서 제거되지만 주문 화면의 처리 이력에는 계속 보존된다.
