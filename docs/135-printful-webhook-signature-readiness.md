# Printful Webhook 서명 준비 조건

Printful Webhook 수신기의 필수 무결성 검증은 `PRINTFUL_WEBHOOK_SECRET_HEX`를 이용한 HMAC-SHA256 서명 확인이다. 따라서 준비 상태의 `signatureVerification`은 이 secret이 설정되면 통과한다.

`PRINTFUL_WEBHOOK_PUBLIC_KEY`는 선택적인 발신 키 allowlist다. 값이 설정된 운영 환경에서는 요청의 public-key 헤더가 정확히 일치해야 하지만, 설정하지 않았다고 Webhook 서명 검증 자체가 미준비 상태가 되지는 않는다.

이 변경으로 연동 화면의 준비 조건이 실제 수신기 계약과 일치한다. Secret이 없는 경우에는 계속 준비 실패로 표시하며 Webhook 서버도 구성되지 않는다.
