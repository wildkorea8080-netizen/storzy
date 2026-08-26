# Shopify OAuth 연결 기반

STORZY 관리자 서비스는 Shopify Admin 내부 iframe 앱이 아닌 standalone 운영 도구이므로 authorization code grant를 사용한다. 공개 embedded 앱으로 전환할 때는 Shopify managed installation과 token exchange 기반 공식 앱 템플릿으로 교체한다.

## 경로

- 시작: `POST /api/workspaces/{workspaceId}/integrations/shopify/oauth/start`
- callback: `GET /api/integrations/shopify/oauth/callback`

시작 요청은 관리자 인증과 ACTIVE workspace를 요구하며 `shopDomain`, `actorId`를 받는다. 응답의 Shopify authorization URL로 사용자를 이동해야 한다.

## 보안 검증

- shop hostname을 `{name}.myshopify.com` allowlist 형식으로 제한
- 256-bit random state 생성 후 DB에는 SHA-256 digest만 저장
- state cookie를 app secret으로 서명하고 `HttpOnly`, `SameSite=Lax`, HTTPS 환경에서 `Secure` 적용
- callback query의 `hmac`을 Shopify authorization-code 규칙으로 검증
- state cookie, callback state, DB state, shop domain을 모두 일치 확인
- state는 10분 만료이며 한 번만 소비
- 요청한 scope가 모두 실제 응답에 포함됐는지 검증

검증을 모두 통과한 offline access token만 `IntegrationConnectionRepository`를 통해 AES-256-GCM으로 저장한다. callback 응답과 로그에는 authorization code, token, app secret과 공급자 오류 원문을 포함하지 않는다.

필수 환경 변수는 `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_OAUTH_CALLBACK_URL`, `SHOPIFY_SCOPES`, `INTEGRATION_CREDENTIAL_KEY_BASE64`다. 하나라도 없으면 OAuth 시작 endpoint는 503을 반환한다.

관리자 연동 화면은 `.myshopify.com` 도메인을 입력받아 OAuth 시작 API를 호출한다. 서버가 반환한 redirect URL도 HTTPS, 동일 shop hostname, `/admin/oauth/authorize` 경로인지 브라우저에서 한 번 더 검증한 후에만 이동한다. Callback 성공 후에는 연동 화면으로 돌아와 완료 메시지를 표시한다.

연동 상태 API는 process 환경 변수보다 workspace의 암호화 연결 원장을 우선한다. 따라서 OAuth callback 저장이 끝나면 해당 workspace의 Shopify 카드가 `CONNECTED`와 실제 shop domain을 표시하며 다른 workspace 상태에는 영향을 주지 않는다.
