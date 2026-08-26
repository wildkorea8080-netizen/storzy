# 운영 Printful Webhook secret 시작 검증

운영 환경에서는 설정된 `PRINTFUL_WEBHOOK_SECRET_HEX`가 최소 32바이트 hexadecimal 형식이 아니면 서버 시작을 중단한다.

또한 선택적 `PRINTFUL_WEBHOOK_PUBLIC_KEY`를 설정한 경우 HMAC secret도 반드시 함께 설정해야 한다. Public key 단독 설정은 요청 본문 무결성 검증을 제공하지 않기 때문이다.

개발과 미리보기 환경에서는 잘못된 설정을 준비 화면에 표시할 수 있도록 서버 시작을 허용하지만, 실제 Webhook 서명 검증은 실패한다. 운영에서는 모든 Webhook이 배포 후 `401`이 되는 상태를 시작 전에 차단한다.
