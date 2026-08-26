# Webhook 수신 상태 모니터

`GET /api/workspaces/{workspaceId}/integrations/webhook-health`는 공급사 Webhook이 실제로 STORZY에 도착했는지 요약한다.

표시 항목:

- 최근 24시간 고유 수신 건수
- 누적 고유 수신 건수
- 마지막 수신 시각
- Printful payload의 `retries > 0` 재전송 건수

상태는 마지막 수신 시각을 기준으로 구분한다.

- `RECENT`: 최근 24시간 안에 수신
- `STALE`: 마지막 수신 후 24시간 경과
- `NEVER_RECEIVED`: 아직 수신 기록 없음

Shopify는 `shopify_order_webhook_receipts.workspace_id`로 집계한다. Printful은 저장 연결의 Store ID와 mockup·fulfillment 수신 기록의 Store ID를 비교해 워크스페이스 범위로 집계한다.

수신이 없다는 사실만으로 장애라고 단정할 수는 없다. 주문이나 목업 작업 자체가 없을 수 있기 때문이다. `STALE` 또는 `NEVER_RECEIVED` 상태에서는 공급사 구독 설정, 공개 HTTPS 접근성, 최근 실제 주문·작업 존재 여부를 함께 확인한다.
