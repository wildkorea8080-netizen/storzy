# Webhook 운영 준비 상태

## 목적

Shopify 주문과 Printful 제작·배송 상태를 자동 처리하려면 공급사가 접근 가능한 공개 수신 주소와 서명 검증 설정이 필요하다. 관리 화면은 실제 비밀값을 반환하지 않고 준비 여부만 표시한다.

## 수신 주소

- Shopify: `{PUBLIC_APP_URL}/webhooks/shopify/orders`
- Printful: `{PUBLIC_APP_URL}/webhooks/printful`

운영 환경의 `PUBLIC_APP_URL`은 HTTPS origin이어야 한다. HTTP는 `PREVIEW_MODE=1`인 로컬 미리보기에서만 허용한다.

## 준비 상태 API

`GET /api/workspaces/{workspaceId}/integrations/webhook-readiness`

관리자 인증이 필요하며 다음 항목만 반환한다.

- 공개 URL 유효 여부
- 서명 검증 설정 여부
- 워크스페이스 또는 공급사 Store 대상 설정 여부
- 누락된 환경 변수 이름

Webhook secret, API token, 공개키의 실제 값은 응답이나 화면에 포함하지 않는다.

## 공급사 설정

Shopify에서는 주문 생성·결제·변경 topic을 Shopify 수신 주소로 전송하도록 구성한다. Printful에서는 mockup 완료와 배송 상태 이벤트를 Printful 수신 주소로 구성한다. 운영 등록 후 공급사 대시보드의 테스트 전송과 STORZY 수신 로그를 함께 확인한다.

Shopify OAuth로 저장된 연결이 있으면 서명 검증을 먼저 통과한 `X-Shopify-Shop-Domain`을 연결의 `account_label`과 비교해 워크스페이스를 동적으로 선택한다. 같은 Shopify shop을 둘 이상의 활성 워크스페이스에 연결하지 못하도록 데이터베이스 고유 인덱스로 제한한다. 저장형 연결을 사용하지 않는 단일 스토어 배포에서는 `SHOPIFY_ORDER_WORKSPACE_ID` 방식이 호환 경로로 유지된다.

Printful 저장 연결이 있으면 서명과 공개키를 먼저 검증한 다음 payload의 `store_id`를 연결 메타데이터와 비교해 워크스페이스를 선택한다. 목업 작업 깨우기와 배송 주문 조회에는 해당 워크스페이스 조건을 추가한다. 같은 Printful Store ID 역시 둘 이상의 활성 워크스페이스에서 사용할 수 없다.
