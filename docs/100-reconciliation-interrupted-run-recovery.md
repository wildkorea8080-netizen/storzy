# 중단된 주문 대조 실행 복구

주기 대조 프로세스가 강제 종료되면 PostgreSQL 연결 종료와 함께 advisory lock은 자동 해제되지만 실행 원장은 `RUNNING` 상태로 남을 수 있다.

다음 스캐너가 전역 advisory lock을 새로 획득하면 기존 `RUNNING` 원장을 다음 값으로 먼저 종결한다.

- 상태: `FAILED`
- 오류: `PROCESS_INTERRUPTED_BEFORE_COMPLETION`
- 종료 시각: 새 스캐너가 복구를 수행한 시각

복구가 끝난 뒤 새로운 실행 원장을 만들고 정상 대조를 시작한다. 복구된 원장 수는 실행 결과의 `recoveredRuns`로 구조화 로그에 포함된다.

다른 스캐너가 advisory lock을 보유하고 있으면 기존 `RUNNING` 원장은 정상 실행 중일 수 있으므로 변경하지 않고 `ALREADY_RUNNING`으로 종료한다.
