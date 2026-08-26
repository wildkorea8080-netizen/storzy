# Printful 보안 연결 등록

관리자 연동 화면은 Printful token과 숫자 Store ID를 입력받는다. token 입력은 password field이며 autocomplete를 비활성화하고, 성공·실패와 관계없이 요청 직후 값을 지운다. token을 localStorage, sessionStorage, URL 또는 API 응답에 넣지 않는다.

- 등록: `POST /api/workspaces/{workspaceId}/integrations/printful/register`
- 인증: 관리자 Bearer token
- workspace: `ACTIVE`
- 저장 전 검증: `GET https://api.printful.com/stores/{storeId}`
- 제한 시간: 8초

서버는 token 길이, Store ID 형식과 actorId를 검증한 후 Printful Store Information API를 읽기 전용으로 호출한다. 응답 Store ID가 요청과 정확히 일치할 때만 `IntegrationConnectionRepository`에 token과 Store ID를 전달한다. repository는 credential payload를 AES-256-GCM으로 암호화하고 연결 변경 감사를 함께 기록한다.

등록 응답에는 provider, 상태, 계정 표시명, Store ID와 갱신 시각만 포함한다. token과 Printful 오류 본문은 반환하지 않는다. 이후 연결 상태 조회와 `실제 연결 테스트`는 환경 변수보다 workspace 암호화 연결을 우선 사용한다.
