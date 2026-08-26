# Shopify 필수 Webhook 동기화

관리자 Webhook 동기화는 주문 4종과 앱 삭제 1종을 각각 올바른 공개 HTTPS 경로에 멱등 등록한다.

- 주문: `ORDERS_CREATE`, `ORDERS_PAID`, `ORDERS_UPDATED`, `ORDERS_CANCELLED`
- 앱 수명주기: `APP_UNINSTALLED`
- 주문 이벤트는 `/webhooks/shopify/orders`, 앱 삭제는 `/webhooks/shopify/app-uninstalled`로 분리한다.
- 배포 사전 점검은 개인정보 필수 Webhook 3종과 `app/uninstalled` 토픽·경로를 모두 확인한다.
