# 미리보기 Shopify 상품 게시

미리보기는 운영 `ShopifyPublicationWorker`, `ShopifyJobStore`, `ShopifyProductPublisher`, `productSet` payload 매퍼를 그대로 실행한다. 네트워크 호출 계층만 `createPreviewShopifyClient`의 결정론적 GraphQL 응답으로 교체한다.

목업이 완료된 `PENDING` 게시 작업은 `SUCCEEDED`로 전환되며, 요청 payload·응답 payload·가상 Shopify Product GID가 운영과 동일한 필드에 저장된다. 결과 상품 상태는 항상 `DRAFT`이다. 실제 Shopify 도메인이나 관리자 토큰은 사용하지 않는다.
