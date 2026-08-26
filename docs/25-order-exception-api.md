# 관리자 주문 예외 큐 API

## 조회

- `GET /api/workspaces/{workspaceId}/order-exceptions?status=HELD&limit=50&offset=0`
- `GET /api/workspaces/{workspaceId}/order-exceptions/{orderId}`

목록은 오래된 예외부터 반환한다. 상세 응답에는 주문, line item별 mapping/design 상태, Printful job과 실제 견적, shipment, 과거 관리자 액션이 포함된다.

## 액션

`POST /api/workspaces/{workspaceId}/order-exceptions/{orderId}/actions`에는 `Idempotency-Key`가 필수다.

```json
{"action":"REVALIDATE","actorId":"admin-1"}
```

```json
{"action":"MANUAL_APPROVE","actorId":"admin-1","reason":"Supplier availability manually verified"}
```

```json
{"action":"REJECT","actorId":"admin-1","reason":"Invalid customer address"}
```

수동 승인과 거절은 1~500자 사유가 필수다. 모든 액션은 이전/이후 상태와 사유, actor, 시간, idempotency key를 `order_exception_actions`에 기록한다. `HELD`, `WAITING`만 액션 가능하며 `SUBMITTED` 주문은 변경할 수 없다.

수동 승인은 Printful job을 재개하지만 즉시 confirm하지 않는다. draft 비용 계산과 음수 마진·원가 급등 검증은 주문 worker에서 다시 수행된다. 거절은 confirm 전 job만 `HELD`로 중단하며 이미 제작 중인 주문을 취소하지 않는다.
