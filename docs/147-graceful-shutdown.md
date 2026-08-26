# 무중단 종료와 트래픽 드레이닝

API 프로세스는 `SIGINT`와 `SIGTERM`을 동일하게 처리한다.

1. readiness를 draining으로 전환한다.
2. `SHUTDOWN_DRAIN_MS` 동안 로드밸런서가 인스턴스를 제외하도록 기다린다.
3. HTTP 서버가 기존 연결을 마칠 때까지 기다린다.
4. 전체 제한 시간에 도달하면 남은 연결을 닫는다.
5. PostgreSQL pool을 종료한다.

기본값은 드레이닝 5초, 전체 제한 30초다. `SHUTDOWN_TIMEOUT_MS`는 반드시 드레이닝 시간보다 길어야 한다. 반복 신호는 같은 종료 Promise를 사용해 DB 풀이나 서버를 중복 종료하지 않는다.
