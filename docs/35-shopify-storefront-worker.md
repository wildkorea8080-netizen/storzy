# Shopify storefront worker

`npm run storefront`는 승인된 Store Config 게시 job을 처리한다.

## Idempotent upsert

각 페이지는 `storzy-{pageKey}` handle로 조회한다. 존재하지 않으면 `pageCreate`, 존재하면 같은 ID에 `pageUpdate`를 실행한다. Main menu도 `main-menu` handle로 조회한 뒤 create/update를 선택한다. 따라서 외부 응답을 받기 전에 timeout이 발생해도 다음 실행에서 같은 handle을 갱신한다.

페이지는 안전을 위해 `isPublished=false`로 생성한다. Shopify 반영 결과가 모두 성공하면 job을 `SUCCEEDED`, Store Config를 `PUBLISHED`로 원자적으로 변경한다.

## 오류 정책

- 네트워크, 408, 429, 5xx: exponential backoff 후 재시도
- Shopify `userErrors`와 4xx 계약 오류: 즉시 FAILED
- lease 만료: 다른 worker가 회수
- 최대 시도 횟수: 기본 4회

## 환경 변수

- `SHOPIFY_SHOP_DOMAIN`
- `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `SHOPIFY_API_VERSION`
- `DATABASE_URL`

필요 scope는 페이지 read/write와 online store navigation read/write다. 테마 파일 게시 작업은 Shopify exemption 승인 전까지 worker가 실행하지 않는다.
