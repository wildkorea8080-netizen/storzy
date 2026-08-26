# Shopify OAuth 연결 사전점검

`GET /api/workspaces/:workspaceId/integrations/shopify/oauth/readiness`는 Shopify 설치 화면으로 이동하기 전에 서버 설정을 점검한다. 응답에는 비밀값을 포함하지 않는다.

## 필수 검사

- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`
- 자격증명 암호화를 위한 `INTEGRATION_CREDENTIAL_KEY_BASE64`
- 암호화 키는 정확히 32바이트를 Base64로 인코딩한 값
- 공개 HTTPS `SHOPIFY_OAUTH_CALLBACK_URL`
- 정확한 callback 경로 `/api/integrations/shopify/oauth/callback`
- callback과 `PUBLIC_APP_URL`의 동일 origin
- `write_products`, `write_content`, `read_orders` scope

관리자 연동 화면은 모든 검사가 통과할 때만 `Shopify 연결` 버튼을 활성화한다. 미완료 상태에서는 누락된 환경 변수나 설정 범위를 표시하므로 OAuth 시작 후 `SERVICE_UNAVAILABLE`로 실패하는 흐름을 예방한다.

실제 파일럿 배포에서는 `PUBLIC_APP_URL`과 callback origin을 같은 공개 도메인으로 구성하고 Shopify Partner 앱의 허용 redirect URL에도 동일한 callback을 등록한다.

운영 환경에서 Shopify OAuth 관련 변수 중 하나라도 설정하면 서버 기동 시 전체 검사를 수행한다. 일부 설정만 있거나 callback origin이 다르면 서버가 즉시 종료되어 잘못 배포된 상태로 연결을 받지 않는다.
