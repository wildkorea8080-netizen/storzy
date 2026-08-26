# Printful Webhook HMAC secret 검증

`PRINTFUL_WEBHOOK_SECRET_HEX`는 최소 32바이트의 짝수 길이 hexadecimal 문자열이어야 한다.

- 허용 문자: `0-9`, `a-f`, `A-F`
- 최소 길이: 64자(32바이트)
- 전체 문자 수: 짝수

연동 준비 상태와 실제 Webhook 검증기가 같은 형식 검사를 사용한다. 잘못된 문자, 홀수 길이 또는 짧은 키는 준비 실패로 표시되고 서명 검증에서도 즉시 거절된다.

이 검증은 `Buffer.from(value, "hex")`가 잘못된 문자열을 조용히 잘라내거나 빈 키로 해석할 수 있는 동작에 의존하지 않도록 한다.
