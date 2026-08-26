# Shopify 누락 주문 안전 재수신

`MISSING_LOCAL_ORDER` 대조 이슈만 관리자가 명시적으로 재수신할 수 있다.

## 처리 흐름

1. Shopify Admin GraphQL API로 주문, 배송지, 현재 수량, SKU, 상품 ID와 가격을 다시 조회한다.
2. 기존 Shopify 주문 수신 데이터 형태로 변환한다.
3. 내부 전용 `orders/replay` 주제로 기존 주소·상품 매핑·디자인·결제·마진 정책을 다시 평가한다.
4. 평가 결과와 관계없이 로컬 주문은 `HELD` 및 `RECONCILIATION_REPLAY_REVIEW` 사유로 저장한다.
5. Printful 주문 작업은 생성하지 않는다.
6. 수신 성공 후 대조 이슈를 해결 처리하고 `REPLAY_MISSING_ORDER` 감사 기록을 남긴다.

## 운영 규칙

- API: `POST /api/workspaces/:workspaceId/order-reconciliation/issues/:issueId/replay`
- 관리자 인증, 처리자, 1~500자 사유, `Idempotency-Key`가 필수다.
- 다른 이슈 유형과 이미 해결된 이슈는 재수신할 수 없다.
- 실제 제작은 주문 검수 화면에서 별도의 관리자 승인을 거쳐야 한다.
- Shopify 연결 정보 또는 Webhook 비밀키가 없으면 실행하지 않는다.
