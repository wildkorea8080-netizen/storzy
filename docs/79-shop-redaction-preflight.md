# Shopify 스토어 삭제 사전 점검

`shop/redact` 요청의 실제 전체 삭제를 실행하기 전에 영향 범위와 진행 중 작업을 확인하는 읽기 전용 단계다.

## 실행 조건

- 요청 유형이 `SHOP_REDACT`여야 한다.
- 요청 상태가 `IN_PROGRESS`여야 한다.
- 요청이 내부 워크스페이스에 연결되어 있어야 한다.

## 차단 조건

다음 작업이 하나라도 진행 중이면 `canExecute`는 `false`다.

- Printful 주문 작업
- Shopify 배송 반영 작업
- Shopify 스토어 게시 작업

관리자 화면은 영향받는 주문, Shopify 주문 원본 payload, Printful 이벤트, 연결 자격 증명 수를 함께 표시한다.

## API

`GET /api/admin/privacy-requests/:id/shop-redaction-impact`

관리자 인증이 필요하며 데이터를 변경하지 않는다. 이 단계에는 실제 삭제 엔드포인트나 삭제 버튼이 포함되지 않는다.
