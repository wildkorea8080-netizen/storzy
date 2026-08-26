# Printful 배송 → Shopify fulfillment

서명 검증된 Printful `shipment_sent`, `shipment_returned` 이벤트는 기존 `/webhooks/printful`에서 분기된다. payload digest로 재전송을 제거하고 Printful external order ID를 내부 주문에 연결한다. shipment와 `order_item_external_id`별 수량을 별도 snapshot으로 저장하므로 부분 배송과 여러 shipment·송장을 독립적으로 처리할 수 있다.

`shipment_sent`만 Shopify job을 만든다. worker는 Shopify 주문의 현재 `FulfillmentOrder`와 남은 line item 수량을 GraphQL로 조회하고, Printful shipment item을 정확한 `FulfillmentOrderLineItem`으로 변환한 뒤 최신 `fulfillmentCreate` mutation을 호출한다. 누락 매핑과 초과 수량은 422 영구 실패로 분리하며 고객 알림은 현재 MVP 정책상 활성화한다.

필요 권한은 스토어 유형에 맞는 fulfillment order write scope와 `fulfill_and_ship_orders` 권한이다. 실행 명령은 `npm run shopify-fulfillment`, 설정은 기존 `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN` 및 선택적 `SHOPIFY_FULFILLMENT_MAX_ATTEMPTS`다.

반품 이벤트는 상태와 원본만 보존하며 자동 환불·재배송은 하지 않는다. 다음 운영 단계에서 관리자 승인 workflow로 연결한다.
