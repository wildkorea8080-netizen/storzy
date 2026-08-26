# Printful 카탈로그 호출 제한 복구

상품 후보 생성 worker가 Printful 카탈로그 조회 중 `429`를 받으면 `Retry-After`까지 작업을 `PENDING`으로 연기한다. 제한 대기는 attempts를 소모하지 않으며 `WAITING_FOR_PRINTFUL_RATE_LIMIT`으로 구분한다.

`Retry-After`가 없으면 기존 지수 백오프를 사용한다. `408`과 `5xx`는 최대 시도 횟수 안에서 일반 재시도하고, 잘못된 프로필이나 카탈로그 계약 오류는 영구 실패로 유지한다.
