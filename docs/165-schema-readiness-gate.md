# DB schema readiness gate

API의 `/ready`는 PostgreSQL 연결뿐 아니라 실행 이미지와 DB schema 이력의 정확한 일치 여부를 확인한다.

서버 시작 시 이미지에 포함된 migration 파일 목록과 SHA-256 checksum을 읽는다. 각 readiness 검사에서 `schema_migrations`와 비교하며 필요한 migration 누락, checksum 불일치, 현재 이미지가 모르는 더 최신 migration, checksum 기준화 미완료 상태에서는 HTTP `503`을 반환한다.

오류 응답은 migration 이름이나 내부 DB 오류를 외부에 노출하지 않고 `database: false`, `schema: false`만 반환한다. Kubernetes readiness probe가 실패하므로 해당 Pod는 Service 트래픽을 받지 않는다.

배포는 반드시 migration Job 완료 후 workload 적용 순서를 지킨다. 이전 이미지로 rollback하려면 DB 변경이 이전 코드와 호환되는지 먼저 확인해야 한다.
