# Printful 반송 주문 운영

Printful `shipment_returned` webhook을 받으면 해당 주문을 `RETURNED` 상태로 전환해 주문 운영 화면의 반송 큐에 표시한다.

## 처리 원칙

- 반송 배송 snapshot과 항목을 저장한다.
- 주문에 `PRINTFUL_SHIPMENT_RETURNED` 사유를 추가한다.
- `PRINTFUL_RETURNED` 감사 작업을 기록한다.
- Shopify fulfillment 생성 작업은 만들지 않는다.
- 이미 제작된 주문이므로 일반 재검증·수동 승인·재제작 버튼을 제공하지 않는다.

관리자 주문 화면에는 `반송 접수` 필터와 안내 문구가 표시된다. 환불, 재배송, 주소 수정 같은 고객 지원 결정은 후속 전용 처리 흐름에서 명시적으로 기록해야 하며 현재 단계에서는 자동 실행하지 않는다.
