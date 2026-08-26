# Shopify 필수 개인정보 보호 Webhook

공개 Shopify 앱은 다음 compliance topic을 앱 설정으로 구독해야 한다.

- `customers/data_request`
- `customers/redact`
- `shop/redact`

예제 설정은 루트의 `shopify.app.toml.example`에 있다. 실제 Shopify 앱과 연결한 `shopify.app.toml`에 client ID와 공개 URI를 설정한 뒤 Shopify CLI로 배포해야 구독이 활성화된다.

## 수신 보안

각 endpoint는 raw JSON body의 `X-Shopify-Hmac-Sha256`을 앱 secret으로 검증한다. 위조되거나 누락된 서명은 데이터베이스에 접근하기 전에 `401`로 거부한다. 유효한 요청은 처리 작업을 저장하고 빠르게 200으로 응답한다.

## 최소 정보 저장

개인정보 처리 큐에는 shop ID/domain, customer ID, order ID 목록, Shopify request ID와 payload SHA-256 digest만 저장한다. payload의 이메일, 전화번호, 주소 및 원문 JSON은 저장하지 않는다. 동일 webhook ID 또는 동일 payload는 멱등하게 처리한다.

처리 기한은 공식 요구사항에 맞춰 수신 후 30일로 설정한다. `PENDING` 저장만으로 법적 의무가 완료되는 것은 아니며, 다음 단계에서 데이터 제공·익명화·삭제 실행과 관리자 완료 승인을 연결해야 한다. 법률상 보존 의무가 있는 경우에는 `RETAINED_LEGAL` 상태와 근거를 기록해야 한다.
