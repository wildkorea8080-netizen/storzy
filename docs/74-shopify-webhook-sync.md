# Shopify 주문 Webhook 구독 동기화

`POST /api/workspaces/{workspaceId}/integrations/shopify/webhooks/sync`는 암호화 저장된 Shopify access token을 서버 내부에서 복호화하고 주문 Webhook 구독을 동기화한다.

대상 topic:

- `ORDERS_CREATE`
- `ORDERS_PAID`
- `ORDERS_UPDATED`

먼저 `webhookSubscriptions` GraphQL query를 `uri`와 topic으로 조회하고, 같은 URI에 없는 topic만 `webhookSubscriptionCreate`로 생성한다. 따라서 동일 요청을 다시 실행해도 중복 구독을 만들지 않는다. 최신 Shopify Admin GraphQL의 통합 `uri` 필드를 사용하며 더 이상 권장되지 않는 `callbackUrl`은 사용하지 않는다.

Webhook URI는 `{PUBLIC_APP_URL}/webhooks/shopify/orders`이며 반드시 공개 HTTPS 주소여야 한다. 로컬 `http://localhost` 주소는 공급사 등록에 사용할 수 없으므로 `409 WEBHOOK_PUBLIC_HTTPS_REQUIRED`로 차단한다.

응답에는 endpoint, 전체 topic 수, 신규 생성 수, 기존 구독 수와 subscription ID만 포함한다. access token은 응답·로그·GraphQL body에 포함하지 않는다.
