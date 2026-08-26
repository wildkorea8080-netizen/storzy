# CI 실제 PostgreSQL migration 검증

CI의 `Apply migrations twice` job은 깨끗한 PostgreSQL 17 컨테이너에서 저장소의 전체 migration을 검증한다.

1. 모든 SQL을 최초 적용한다.
2. 같은 migration 명령을 다시 실행해 멱등성을 확인한다.
3. `schema_migrations`의 파일명과 SHA-256 checksum을 저장소 파일과 전부 비교한다.

누락, 알 수 없는 추가 migration, checksum 불일치, checksum 미기록을 서로 구분해 출력하며 하나라도 있으면 CI가 실패한다. 애플리케이션 검사와 DB migration 검증이 모두 통과해야 프로덕션 Dockerfile 빌드가 시작된다.

로컬에서는 실행 중인 PostgreSQL에 `DATABASE_URL`을 지정하고 `npm run db:migrate:verify`로 같은 검증을 수행할 수 있다.
