# Printful draft·비용 검증·confirm worker

`READY` 주문은 `printful_order_jobs`에 결정적 external ID `storzy:{workspaceId}:{shopifyOrderId}`로 한 번만 등록된다. worker는 다음 상태를 순서대로 처리한다.

draft 단계는 먼저 `@external_id`로 기존 주문을 조회한다. 이전 POST가 성공했지만 응답이 timeout된 경우 기존 draft를 이어서 사용하며, 404일 때만 새 주문을 생성한다.

1. `PENDING_DRAFT`: 주소, 정확한 Printful variant, 디자인 placement/file을 이용해 v2 draft order 생성
2. `WAITING_COST`: `GET /v2/orders/{id}`로 비동기 비용 계산 완료 대기
3. `READY_CONFIRM`: 통화, 음수 마진, 승인 원가 대비 상승률을 재검증한 주문만 confirm
4. `SUCCEEDED`: Printful이 `pending`, `inreview`, `inprocess` 중 하나를 반환하면 내부 주문을 `SUBMITTED`로 전환

비용 계산 실패, 통화 불일치, 손실 주문, 원가 급등, 예상하지 못한 응답은 `HELD`로 보내며 자동 confirm하지 않는다. HTTP 408, 429, 5xx만 backoff 재시도한다. Printful은 draft 상태에서는 과금·제작하지 않고 confirm 이후 fulfillment를 시작하므로 이 경계가 최종 자동 주문 안전장치다.

실행: `npm run printful-order`. 설정: `PRINTFUL_TOKEN`, 선택적 `PRINTFUL_STORE_ID`, `PRINTFUL_ORDER_MAX_ATTEMPTS`, `ORDER_MAX_COST_INCREASE_BPS`.
