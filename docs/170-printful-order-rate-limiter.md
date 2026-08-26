# Printful 주문 생성 호출 제한

Printful 주문 worker는 workspace별 1분 고정 구간 rate limiter를 PostgreSQL에 공유한다. 여러 worker 인스턴스가 실행되어도 `workspace_printful_order_rate_limits` 행을 `FOR UPDATE`로 잠근 뒤 용량을 차감하므로 동일 workspace의 외부 쓰기 호출 수가 합산된다.

- 기본 용량: 분당 2회
- 설정: `PRINTFUL_ORDER_RATE_LIMIT_PER_MINUTE`
- 적용 호출: 주문 초안 생성, 주문 확정
- 제한 도달: job을 기존 phase로 되돌리고 다음 구간까지 지연
- 제한 대기는 처리 시도 횟수에서 제외
- 조회 호출은 주문 생성 용량을 차감하지 않음
- Printful이 `429`와 `Retry-After`를 반환하면 해당 지연 시간을 우선 적용하며, 이 대기도 실패 횟수에서 제외

운영 중 Printful 계정의 실제 한도가 상향된 경우에만 환경 변수를 조정한다. 여러 API 프로세스나 worker마다 서로 다른 값을 사용하지 않는다.
