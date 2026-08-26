# 외부 서비스 연동 준비 상태

`GET /admin/integrations`는 실제 판매 채널인 Shopify와 제작·배송 공급자인 Printful의 서버 설정 준비 상태를 표시한다.

- 상태 API: `GET /api/workspaces/{workspaceId}/integrations`
- 인증: 관리자 Bearer token
- workspace 조건: `ACTIVE`
- 반환 상태: `CONNECTED`, `PARTIAL`, `NOT_CONFIGURED`

Shopify는 OAuth 앱 자격 증명, Admin GraphQL API, 주문 Webhook 준비 여부를 구분한다. Printful은 API token, Store 범위와 상태 Webhook 준비 여부를 구분한다.

API는 shop domain과 Printful store ID처럼 운영자가 식별해야 하는 값만 반환한다. Admin access token, API secret, Webhook secret과 Printful token 원문은 반환하거나 브라우저에 저장하지 않는다. 현재 단계의 입력 원장은 환경 변수이며 운영 배포에서는 암호화된 비밀 저장소로 교체한다.

현재 상태 화면은 읽기 전용 기반이다. 다음 단계에서 연결 테스트 버튼을 화면에 연결하고 Shopify OAuth 설치 URL·callback, encrypted credential repository, Printful OAuth 또는 token 등록 workflow를 추가한다.

## 실제 연결 테스트 API

- `POST /api/workspaces/{workspaceId}/integrations/shopify/test`
- `POST /api/workspaces/{workspaceId}/integrations/printful/test`

Shopify 테스트는 공식 Admin GraphQL의 읽기 전용 `shop { name myshopifyDomain }`만 조회한다. Printful 테스트는 공식 Store Information API의 `GET /stores/{id}`만 조회한다. 두 요청 모두 8초 제한을 적용하고 상품·주문·Webhook을 변경하지 않는다.

결과는 공급자, 성공 여부, 정규화된 상태, 계정 식별자, 응답 시간과 확인 시각만 포함한다. 공급자 오류 본문, access token과 secret은 성공·실패 응답 모두에 포함하지 않는다.

관리자 화면은 각 공급자 카드에 `실제 연결 테스트` 버튼을 추가한다. 실행 중에는 중복 요청을 막고, 완료 후 성공·설정 필요·실패 상태와 정규화된 메시지, 응답 시간, 확인 시각을 카드 내부의 polite live region에 표시한다. 이 결과는 진단용이며 브라우저 저장소나 DB에 보존하지 않는다.
