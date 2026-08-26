# Shopify 배포 전 점검 명령

실제 배포 전에 `npm run deploy:preflight`를 실행한다. 명령은 `.env`가 있으면 로드하고 루트의 `shopify.app.toml`을 검사한다. 다른 설정 파일은 `npm run deploy:preflight -- 경로`로 지정할 수 있다.

## 검사 항목

- OAuth 환경 변수와 32바이트 암호화 키
- 데이터베이스, 관리자 토큰, OpenAI, Shopify, Printful 필수 운영 비밀값
- TOML `client_id`와 `SHOPIFY_API_KEY`
- `application_url`과 `PUBLIC_APP_URL`
- `[auth].redirect_urls`와 OAuth callback
- 환경 변수와 TOML의 필수 scope
- Webhook API 버전
- 개인정보 보호 Webhook 3종

하나라도 실패하면 프로세스 종료 코드는 `1`이다. 따라서 배포 파이프라인에서 이 명령을 빌드 이전 gate로 사용할 수 있다. Shopify 앱 설정 변경은 운영 환경에서 명시적인 앱 배포가 필요하므로 사전점검 통과 후 Shopify CLI 배포를 수행한다.

`__SECRET_*__` 자리표시자는 실제 비밀값으로 인정하지 않는다. 점검 결과에는 비밀값이나 자리표시자 이름을 그대로 포함하지 않고 항목의 준비 여부만 표시한다.
