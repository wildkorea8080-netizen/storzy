# Shopify 배송 반영 lease 안전성

Shopify fulfillment worker는 작업 처리 중 20초마다 60초 lease를 연장하고 외부 게시 직전에 소유권을 다시 확인한다. lease를 잃으면 Shopify 호출과 로컬 상태 변경을 중단한다.

성공, 실패, 재시도, 연결 대기, 호출 제한 대기 전이는 모두 `RUNNING` 상태, worker ID, 만료되지 않은 lease를 확인한다. 오래 걸린 이전 worker가 새 worker의 결과를 덮어쓸 수 없다.
