# 운영 공개 URL 시작 검증

운영 환경(`NODE_ENV=production`)에서는 `PUBLIC_APP_URL`이 외부에서 접근 가능한 HTTPS origin이어야 한다. 조건을 만족하지 않으면 서버 시작을 중단한다.

검증 조건:

- `https://` 프로토콜
- `localhost`, `127.0.0.1`, `::1` 제외
- URL 사용자명과 비밀번호 제외
- query string과 fragment 제외
- 문법적으로 유효한 절대 URL

이 주소는 Shopify OAuth callback 기준 주소와 Shopify·Printful Webhook endpoint 생성에 사용된다. 잘못된 주소로 애플리케이션만 정상 기동되고 외부 callback이 모두 실패하는 배포 상태를 예방한다.
