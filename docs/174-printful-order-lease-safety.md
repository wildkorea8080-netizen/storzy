# Printful 주문 lease 안전성

Printful 주문 worker는 작업을 가져올 때 60초 lease를 획득하고 처리 중 20초마다 lease를 연장한다. 초안 생성 및 주문 확정처럼 비용이나 중복 제작을 유발할 수 있는 외부 쓰기 직전에는 소유권을 다시 확인한다.

소유권을 잃은 worker는 외부 쓰기와 로컬 상태 변경을 중단한다. `SUCCEEDED` 또는 `HELD` 전환도 `RUNNING`, worker ID, 유효한 lease를 모두 만족할 때만 주문 원장 상태와 함께 트랜잭션으로 반영된다. 따라서 만료된 worker가 후속 worker의 처리 결과를 덮어쓸 수 없다.
