# Shopify 주문 취소 처리

Shopify `orders/cancelled` webhook을 받아 Printful 제출 상태에 따라 안전하게 주문을 중단하거나 관리자 검토로 전환한다.

## 처리 규칙

- Printful 제출 전: 로컬 주문 `REJECTED`, Printful 작업 `HELD`
- Printful 제출 완료 후: 로컬 주문 `HELD`, 자동 취소하지 않고 관리자 검토
- Printful worker가 처리 중인 경우: 제출 결과가 불명확할 수 있으므로 제출 후 취소와 동일하게 보수적으로 처리
- 주문 생성보다 취소가 먼저 도착한 경우: `PENDING` 취소로 저장하고 주문 유입 시 자동 적용
- 중복 webhook: webhook ID와 취소 이벤트 고유키로 중복 처리 방지

취소 결과는 `order_exception_actions`에 `SHOPIFY_CANCELLED` 작업과 차단 사유로 기록한다.

## 구독 Topic

스토어 webhook 동기화 대상에 `ORDERS_CANCELLED`가 추가된다. 기존 스토어는 관리자 연동 화면에서 webhook 동기화를 다시 실행해야 한다.
