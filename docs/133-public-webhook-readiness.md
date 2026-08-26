# 공개 Webhook 주소 판정

Shopify와 Printful E2E 연결에서 Webhook 준비 완료로 인정되는 주소는 외부에서 접근 가능한 HTTPS origin이어야 한다.

- `https://` 프로토콜 필수
- `localhost`, `127.0.0.1`, `::1` 제외
- 미리보기 모드의 `http://localhost:3000`은 로컬 endpoint 안내용으로만 표시
- 로컬 endpoint가 존재해도 `publicUrl` 검사는 실패하며 전체 준비 상태는 완료되지 않음

이 판정으로 로컬 개발 서버가 실제 공급자에서 호출 가능한 공개 Webhook 주소인 것처럼 표시되는 잘못된 준비 완료 상태를 방지한다.
