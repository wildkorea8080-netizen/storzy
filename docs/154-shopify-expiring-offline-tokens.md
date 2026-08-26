# Shopify 만료형 오프라인 토큰

## 결정

- 신규 Shopify OAuth 승인 코드 교환은 `expiring=1`로 요청한다.
- access token, refresh token, 두 만료 시각은 workspace 연결 credential payload 안에 암호화해 저장한다.
- 목록 API에는 토큰을 노출하지 않고 token mode와 만료 시각만 metadata로 제공한다.
- 기존 비만료형 토큰 응답은 마이그레이션 기간 동안 계속 읽을 수 있다.
- refresh token이 만료됐거나 Shopify가 확정적인 무효 응답을 반환하면 연결 상태를 `REAUTH_REQUIRED`로 바꾸고 감사 이력을 남긴다.

## 구현된 자동 갱신 경계

상품 게시, 스토어 게시, 배송 반영 worker는 공통 access-token provider를 사용한다. Provider는 access token 만료 5분 전부터 회전 요청을 수행하고 새 access/refresh token 쌍을 함께 저장한다. 네트워크 오류, `429`, `5xx`는 연결 상태를 유지해 기존 refresh token으로 다시 시도할 수 있게 하고, Shopify가 명시한 확정적 무효 응답 또는 로컬 refresh 만료 시에만 재인증 상태로 전환한다.

관리자 API의 연결 테스트, webhook 동기화, 수동 주문 대조·재수신과 예약 주문 대조 CLI도 같은 provider를 사용한다. 따라서 Shopify Admin API를 호출하는 운영 경로는 호출 전에 만료를 확인하고 필요하면 token pair를 회전한다.

## 동시 회전 제어

Provider는 `workspaceId + SHOPIFY` 단위 PostgreSQL advisory lock을 획득한 뒤 credential을 다시 읽는다. 먼저 잠금을 얻은 프로세스가 새 token pair를 저장하면 뒤의 프로세스는 갱신 요청을 반복하지 않고 새 access token을 재사용한다. 잠금은 성공·실패와 관계없이 `finally`에서 해제되며 프로세스가 비정상 종료되면 PostgreSQL 세션 종료와 함께 해제된다.

참조: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens
