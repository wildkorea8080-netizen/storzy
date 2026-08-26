# Shopify 주문 수신과 1차 안전 검증

`POST /webhooks/shopify/orders`는 raw body와 `X-Shopify-Hmac-Sha256`을 검증하고 `X-Shopify-Webhook-Id`를 유일 키로 저장한다. 지원 topic은 `orders/create`, `orders/paid`, `orders/updated`다. 동일 delivery 재전송은 성공 응답으로 멱등 처리한다.

line item은 Shopify product GID와 결정적 SKU `STORZY-PF-{Printful variant ID}`를 모두 사용해 성공한 publication과 candidate를 찾는다. 하나가 아닌 mapping, 디자인 누락, 미결제, 주소 누락, 허용 국가 밖 배송, 음수 마진, 고액·대량 주문은 기존 `order-policy.v1`으로 분류한다.

결과는 `commerce_orders`의 `READY`, `WAITING`, `HELD`, `ALREADY_PROCESSED` 중 하나와 모든 사유 코드로 저장한다. `READY`도 아직 Printful로 전송하지 않는다. 다음 worker가 실시간 공급가·재고·배송 가능 여부를 재검증하고 draft order를 만든 뒤 실제 견적을 다시 확인해야 한다.

환경 변수: `SHOPIFY_WEBHOOK_SECRET`, `SHOPIFY_ORDER_WORKSPACE_ID`, `ORDER_ALLOWED_COUNTRIES`, `ORDER_MAX_AMOUNT_MINOR`, `ORDER_MAX_ITEM_COUNT`, `ORDER_MAX_COST_INCREASE_BPS`.

현재 workspace 연결은 단일 스토어 MVP 설정이다. 공개 앱 단계에서는 shop domain별 설치 credential 테이블에서 workspace와 secret을 조회하도록 교체한다.
