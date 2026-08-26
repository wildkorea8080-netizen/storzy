# 안전한 DB migration 실행

`npm run db:migrate`와 운영 이미지의 `node dist/src/db/migrate.js`는 동일한 migration runner를 사용한다.

## 동시 실행 방지

Runner는 전용 PostgreSQL 연결에서 session advisory lock을 획득한다. 다른 배포 도구나 운영자가 동시에 migration을 시작해도 하나의 실행만 schema를 변경한다. 잠금 대기는 최대 10분이며 제한을 넘으면 작업이 실패한다.

## 원자적 적용

각 SQL 파일의 기존 `BEGIN/COMMIT` 표식을 제거하고 runner가 다음 작업을 하나의 transaction으로 실행한다.

1. Migration SQL 실행
2. `schema_migrations` 적용 이력 기록
3. Commit

SQL 또는 이력 기록이 실패하면 rollback되므로 schema만 변경되고 적용 이력이 누락되는 상태를 방지한다. SQL 파일에 `BEGIN` 또는 `COMMIT` 중 하나만 있으면 실행 전에 실패한다.

## 파일 드리프트 감지

Runner는 줄바꿈 형식을 정규화한 SQL 파일의 SHA-256 checksum을 `schema_migrations`에 기록한다. 이미 적용된 버전의 파일 내용이 달라지면 migration 실행을 즉시 중단한다. 기존 checksum이 없는 이력은 새 runner의 최초 실행에서 현재 파일을 기준으로 한 번만 채운다.

적용된 migration 파일을 수정하지 말고 변경이 필요하면 항상 새로운 번호의 SQL 파일을 추가한다.

Kubernetes 배포에서는 `storzy.migration.k8s.yaml` Job의 성공을 확인한 후에만 workload를 적용한다. 실패 시 로그를 확인하고 SQL을 수정한 새 이미지 digest로 다시 배포한다. 이미 적용된 migration 파일은 수정하지 않는다.
