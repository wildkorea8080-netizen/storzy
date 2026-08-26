# Shopify GraphQL throttle 처리

Shopify Admin GraphQL API는 HTTP 200 응답 안에서도 `errors[].extensions.code=THROTTLED`를 반환할 수 있다. STORZY는 이를 영구 GraphQL 오류와 구분한다.

- `extensions.cost.requestedQueryCost`
- `extensions.cost.throttleStatus.currentlyAvailable`
- `extensions.cost.throttleStatus.restoreRate`

부족한 query cost를 복원 속도로 나눠 재시도 지연을 계산하며 최소 1초, 최대 60초를 적용한다. 상품 게시, 스토어 페이지·메뉴 게시, 배송 반영 worker는 작업을 `PENDING`으로 되돌리고 `WAITING_FOR_SHOPIFY_RATE_LIMIT`을 기록한다. 호출 제한 대기는 처리 실패가 아니므로 attempts를 1회 차감한다.

`THROTTLED`가 아닌 GraphQL 최상위 오류는 422 영구 오류로 분류하여 잘못된 query 또는 입력을 무한 재시도하지 않는다.
