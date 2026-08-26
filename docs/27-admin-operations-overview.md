# 관리자 Operations Overview

`GET /admin`은 workspace의 전체 자동화 파이프라인을 요약한다. `GET /api/workspaces/{workspaceId}/admin-overview`에서 다음 상태를 집계한다.

- Brand Profile revision
- 상품 후보 검수
- 상품 콘텐츠 생성
- Printful mockup
- Shopify 상품 발행
- 주문 검증·제출
- Shopify fulfillment

`HELD`, `WAITING`, `FAILED` 상태는 최근 20개 attention feed로 합쳐 표시한다. API는 주문 예외 API와 동일한 `ADMIN_API_TOKEN` Bearer 인증을 사용하고, 화면의 workspace·token 설정은 주문 화면과 같은 `sessionStorage`를 공유한다.

Overview는 운영 상태를 보여주는 read-only 화면이다. 실제 상태 변경은 각 도메인의 검수 API나 주문 예외 화면에서만 수행한다. 집계 쿼리는 workspace 범위를 모든 하위 쿼리에 적용한다.
