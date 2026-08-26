# 생존 및 준비 상태 엔드포인트

호스팅 플랫폼의 상태 검사를 목적별로 분리한다.

- `GET /health`: Node.js 프로세스가 요청을 처리할 수 있는지 확인하는 liveness probe
- `GET /ready`: PostgreSQL에 `SELECT 1`을 수행하는 readiness probe

`/ready`는 데이터베이스가 정상일 때 `200`과 `status: ready`를 반환한다. 연결 실패 또는 준비 검사 미설정 상태에서는 `503`, `status: unavailable`, `checks.database: false`를 반환한다. 두 응답 모두 `Cache-Control: no-store`를 사용하며 자격증명이나 데이터베이스 오류 상세는 노출하지 않는다.

배포 플랫폼은 liveness 실패 시 프로세스를 재시작하고 readiness 실패 시 인스턴스로 신규 트래픽을 보내지 않도록 구성한다.

종료 신호를 받으면 readiness 서비스가 먼저 draining 상태로 전환되므로 `/ready`는 DB가 정상이어도 즉시 `503`을 반환한다.
