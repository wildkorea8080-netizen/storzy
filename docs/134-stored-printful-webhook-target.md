# 저장된 Printful 연결의 Webhook 대상 판정

Printful 연결 화면에서 token과 Store ID를 검증해 암호화 저장한 연결은 해당 워크스페이스의 Webhook 대상으로 인정한다.

이전 판정은 서버 환경 변수 `PRINTFUL_STORE_ID`만 확인했기 때문에 저장 연결이 `CONNECTED`여도 Webhook 준비 상태가 계속 미완료로 표시됐다. 이제 다음 중 하나면 워크스페이스 대상 검사를 통과한다.

- 워크스페이스에 암호화 저장된 `PRINTFUL` 연결이 `CONNECTED`
- 서버 환경 변수 `PRINTFUL_STORE_ID`가 설정됨

공개 HTTPS 주소와 Printful Webhook 서명키 검사는 별도로 모두 통과해야 전체 준비 상태가 완료된다. API 응답에는 저장된 token이나 Store ID 원문을 추가하지 않는다.
