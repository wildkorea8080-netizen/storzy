# 관리자 주문 대시보드

`GET /admin/orders`는 별도 프론트엔드 빌드 없이 현재 API 서버에서 제공되는 운영 화면이다. workspace UUID와 관리자 토큰은 브라우저 `sessionStorage`에만 보관하며 예외 API 호출에 Bearer token으로 전달한다.

화면은 상태 필터, 매출·원가·마진·차단 사유, line item mapping과 디자인 상태, Printful 및 배송 이력, 감사 이력을 보여준다. 재검증, 수동 승인, 거절을 지원하며 위험 액션은 사유와 확인을 요구하고 매 요청마다 새 `Idempotency-Key`를 사용한다.

운영에서는 `ADMIN_API_TOKEN`을 반드시 설정한다. 설정된 경우 주문 예외 API 전체가 constant-time 비교 기반 Bearer 인증으로 보호된다. 화면에는 인라인 script/style을 넣지 않고 자체 origin만 허용하는 CSP와 `frame-ancestors 'none'`을 적용한다.

이 토큰 방식은 단일 운영자 MVP용이다. 공개 서비스 전에는 사용자 로그인, workspace membership, 역할 기반 권한, CSRF 방어를 갖춘 세션 인증으로 교체해야 한다.
