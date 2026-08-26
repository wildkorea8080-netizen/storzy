# 미리보기 주문 수신

`POST /api/workspaces/{workspaceId}/preview/orders`는 관리자 토큰이 필요한 미리보기 전용 주문 생성 API다. 최근 성공한 Shopify 초안 상품과 실제 catalog variant를 조회해 `STORZY-PF-{variantId}` SKU를 구성하고, 정상 배송 주소와 결제 완료 상태를 가진 Shopify 주문 payload를 만든다.

생성한 payload는 DB에 직접 저장하지 않는다. 내부 전용 secret으로 HMAC을 서명한 뒤 운영 `ShopifyOrderWebhookService.receive`에 전달하므로 webhook 서명, 중복 수신, 상품 매핑, 디자인 존재, 주소, 국가, 결제, 수량, 마진 정책을 모두 동일하게 통과해야 한다. 정책을 통과한 주문만 `READY`와 `printful_order_jobs`를 생성한다.
