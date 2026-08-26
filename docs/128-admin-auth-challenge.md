# 관리자 인증 실패 응답

관리자 Bearer 토큰이 없거나 일치하지 않으면 다음 표준 응답을 반환한다.

- HTTP 상태: `401 Unauthorized`
- 헤더: `WWW-Authenticate: Bearer realm="storzy-admin"`
- 오류 코드: `ADMIN_AUTH_REQUIRED`
- 사용자 메시지: `관리자 인증이 필요합니다.`

관리자 인증 오류에는 내부 토큰 비교 정보나 입력값을 포함하지 않는다. Shopify·Printful Webhook 서명 실패는 기존 `INVALID_WEBHOOK_SIGNATURE` 코드로 유지해 관리자 세션 만료와 공급자 서명 오류를 클라이언트 및 운영 로그에서 구분할 수 있다.
