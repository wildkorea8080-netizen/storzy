# Shopify 취소 상태 불일치 동기화

`CANCELLATION_MISMATCH` 이슈는 관리자가 명시적으로 실행할 때만 로컬 주문에 반영한다.

## 처리 순서

1. Shopify Admin GraphQL API로 해당 주문을 다시 조회한다.
2. `cancelledAt`이 현재도 존재하는지 확인한다. 취소가 해제되었거나 원격 상태가 바뀌었다면 작업을 중단하고 대조 재실행을 안내한다.
3. 검증된 주문 ID와 취소 시각으로 내부 서명된 `orders/cancelled` 이벤트를 만든다.
4. 기존 Shopify 취소 처리기를 실행한다.
5. 취소 처리가 성공한 뒤 `SYNC_CANCELLATION` 감사 기록과 함께 대조 이슈를 해결한다.

## 안전 정책

- Printful에 아직 제출되지 않은 작업은 중단하고 로컬 주문을 `REJECTED`로 전환한다.
- 이미 Printful에 제출되었거나 실행 중인 작업은 외부에서 자동 취소하지 않고 로컬 주문을 `HELD`로 전환한다.
- 모든 작업은 관리자 인증, 처리 사유와 `Idempotency-Key`를 요구한다.
- API는 `POST /api/workspaces/:workspaceId/order-reconciliation/issues/:issueId/sync-cancellation`이다.
