# 주문 예외 API 인증 경계

주문 예외 목록, 상세, 조치 API는 모두 관리자 Bearer 토큰을 요구한다.

보호 경로는 다음 세 형태로 제한한다.

- `GET /api/workspaces/:workspaceId/order-exceptions`
- `GET /api/workspaces/:workspaceId/order-exceptions/:orderId`
- `POST /api/workspaces/:workspaceId/order-exceptions/:orderId/actions`

경로 문자열 포함 여부가 아니라 전체 경로 패턴을 검사하므로, 이름이 비슷한 다른 API가 의도치 않게 관리자 인증 대상에 포함되지 않는다. 인증은 요청 본문 파싱이나 서비스 호출보다 먼저 수행하며, 토큰이 없거나 일치하지 않으면 `401`을 반환한다.

회귀 테스트는 세 경로의 무인증 차단과 올바른 토큰을 사용한 목록 조회를 함께 검증한다.
