# Shopify 주문 상태 Reconciliation

Webhook 누락이나 순서 역전으로 발생한 로컬 주문 상태 차이를 최근 Shopify 주문과 대조하는 읽기 전용 스캔이다.

## 조회 범위

- Shopify GraphQL `orders` query
- `updated_at` 검색 필터
- `UPDATED_AT` 정렬과 cursor pagination
- 최대 1,000건
- 관리자 지정 범위 1~168시간

고객명, 이메일, 주소는 조회하지 않는다. 주문 ID, 갱신 시각, 취소 시각, 결제 상태만 사용한다.

## 불일치 유형

- `MISSING_LOCAL_ORDER`
- `CANCELLATION_MISMATCH`
- `FINANCIAL_STATUS_MISMATCH`

스캔은 주문 상태를 자동 변경하거나 Printful 작업을 생성하지 않는다. 결과는 `order_reconciliation_scans`와 `order_reconciliation_issues`에 저장하고 관리자 주문 화면에 표시한다.

## API

- `POST /api/workspaces/:workspaceId/order-reconciliation`
- `GET /api/workspaces/:workspaceId/order-reconciliation`

실제 스캔에는 암호화 저장소의 활성 Shopify 연결이 필요하다.
