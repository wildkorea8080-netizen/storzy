# Shopify 배송 작업 이벤트

Shopify 배송 worker는 작업 성공 상태와 같은 트랜잭션에서 `CREATED` 또는 `RECOVERED` 이벤트를 기록한다. 이벤트에는 워크스페이스, Printful 배송, worker ID, Shopify fulfillment ID가 포함된다.

주문 상세 감사 타임라인은 운영자 조치, Printful 주문 이벤트와 함께 Shopify 배송 생성 및 응답 유실 복구 이벤트를 시간순으로 표시한다.
