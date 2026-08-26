# 브랜드 온보딩 제출 멱등성

브랜드 프로필 생성 요청은 `Idempotency-Key` 헤더를 필수로 사용한다. 키는 영문·숫자와 `._:-` 문자로 구성된 1~128자 값이어야 한다.

서버는 브랜드 프로필별 키를 revision에 저장한다. 같은 워크스페이스와 키로 요청이 다시 들어오면 새 revision, generation job, outbox event를 만들지 않고 처음 생성한 결과를 반환한다. PostgreSQL advisory transaction lock으로 같은 키의 동시 요청도 직렬화한다.

온보딩 화면은 제출 요청에 `crypto.randomUUID()` 키를 자동으로 추가하며, 동시에 발생한 제출은 같은 진행 중 키를 사용한다. 키가 누락되거나 형식이 잘못되면 `400 INVALID_INPUT`을 반환한다.
