# Shopify 결제 상태 불일치 동기화

`FINANCIAL_STATUS_MISMATCH` 이슈는 관리자가 명시적으로 실행할 때 Shopify 최신 주문을 다시 읽어 로컬 결제 상태와 주문 원문을 갱신한다.

## 안전 흐름

1. Shopify Admin GraphQL API로 주문, 결제 상태, 현재 상품 수량, 가격과 배송지를 조회한다.
2. 기존 주문 수신기와 정책 엔진으로 주소, 결제, 매핑, 디자인, 원가와 마진을 평가한다.
3. 평가 결과와 관계없이 `HELD` 및 `FINANCIAL_STATUS_SYNC_REVIEW` 상태로 저장한다.
4. Printful 작업은 이 단계에서 생성하지 않는다.
5. 성공 후 `SYNC_FINANCIAL_STATUS` 감사 기록을 남기고 대조 이슈를 해결한다.
6. 관리자가 주문 상세에서 `REVALIDATE`를 실행해 모든 규칙을 통과한 경우에만 Printful 작업을 생성한다.

일반 `MANUAL_APPROVE`는 결제 상태 동기화 검수 표식을 제거할 수 없다. API는 `POST /api/workspaces/:workspaceId/order-reconciliation/issues/:issueId/sync-financial-status`이며 관리자 인증, 처리 사유와 `Idempotency-Key`가 필수다.
