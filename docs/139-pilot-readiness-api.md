# 파일럿 준비 상태 API

`GET /api/workspaces/:workspaceId/integrations/pilot-readiness`는 E2E 파일럿 실행에 필요한 여섯 조건을 서버에서 한 번에 판정한다.

## 판정 항목

1. 승인된 브랜드 프로필
2. Shopify 연결
3. Printful 연결
4. Shopify·Printful Webhook 수신 준비
5. Shopify 상품 게시 성공
6. 테스트 주문 제출

응답은 `ready`, `completed`, `total`, `nextStep`, `steps`를 포함한다. 관리자 화면과 배포 점검 도구는 개별 API 결과를 다시 조합하지 않고 이 응답을 기준으로 사용한다.

요청에는 관리자 Bearer 토큰이 필요하며, 비활성 워크스페이스는 판정하지 않는다. `nextStep`은 아직 완료하지 않은 첫 작업이고 모든 조건이 완료되면 `null`이다.
