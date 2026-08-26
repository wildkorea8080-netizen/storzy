# Shopify 개인정보 Webhook 토픽 계약 검증

개인정보 Webhook 수신 경로가 Shopify의 `X-Shopify-Topic` 헤더와 정확히 일치하는지 서명 검증 후, 데이터 저장 전에 확인한다.

- `/customers/data_request`는 `customers/data_request`만 허용한다.
- `/customers/redact`는 `customers/redact`만 허용한다.
- `/shop/redact`는 `shop/redact`만 허용한다.
- 토픽 헤더가 없거나 URL과 다르면 `400`으로 거부하고 개인정보 요청을 저장하지 않는다.
- HMAC이 올바르지 않으면 기존과 동일하게 데이터베이스 접근 전에 `401`로 거부한다.

HTTP 통합 테스트는 실제 서버 라우팅, 원문 본문 HMAC 검증, 헤더 전달, 요청 저장 경계를 함께 검증한다.
