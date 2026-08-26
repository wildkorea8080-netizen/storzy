# Shopify OAuth 운영 기동 차단

운영 서버는 Shopify OAuth 관련 설정이 시작된 경우 `shopifyOAuthReadinessFromEnv`의 전체 기준을 기동 시 적용한다.

- 앱 키와 비밀키가 한 쌍으로 존재해야 한다.
- 암호화 키는 AES-256에 맞는 32바이트 Base64 값이어야 한다.
- callback은 공개 HTTPS이며 애플리케이션의 `PUBLIC_APP_URL`과 같은 origin이어야 한다.
- callback 경로와 필수 scope가 정확해야 한다.

OAuth 설정을 전혀 사용하지 않는 배포는 기존처럼 기동할 수 있다. 하지만 관련 변수 중 하나라도 설정된 부분 구성은 허용하지 않는다. 이 정책은 관리자 사전점검 API와 서버 기동 검사가 서로 다른 결과를 내는 것을 방지한다.
