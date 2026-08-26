# Printful 주문 작업 이벤트

Printful 주문 worker는 주문 상태 변경과 같은 트랜잭션 안에서 다음 이벤트를 기록한다.

- `CONFIRMED`: 현재 요청으로 원격 주문을 확정함
- `CONFIRMATION_RECOVERED`: 이전 요청이 이미 원격에서 확정된 사실을 발견해 로컬 상태를 복구함
- `HELD`: 안전 정책이나 원격 상태 때문에 자동 처리를 중단함

이벤트에는 워크스페이스, 로컬 주문, Printful 작업과 원격 주문 ID, worker ID, 중단 상세 사유가 연결된다.
