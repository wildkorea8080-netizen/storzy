# Shopify 상품 등록 worker

승인된 콘텐츠 revision만 `shopify_publication_jobs`로 전달하며 GraphQL Admin API의 `productSet`을 동기 모드로 호출한다.

## 매핑

- Shopify handle: `storzy-{contentRevisionId}` — 재시도 시 동일 상품을 upsert하는 식별자
- 상태: 항상 `DRAFT`
- 제목·HTML 설명·태그·SEO·vendor·product type: 승인 콘텐츠와 Brand Profile에서 결정
- 가격: 승인 후보의 minor-unit 값을 통화 자릿수에 맞춰 문자열로 변환
- variant: snapshot에 보존된 실제 Printful size/color 조합을 사용하고, 없을 때만 `Default Title`을 생성

`productSet`은 전달한 list 필드에 없는 기존 항목을 제거할 수 있으므로, 사이즈·색상 조합을 추측하지 않고 snapshot의 실제 가용 variant만 전달한다.

## 오류와 복구

- GraphQL `userErrors`는 입력/계약 오류로 보고 422 영구 실패 처리한다.
- 408·429·5xx·네트워크 오류만 backoff 재시도한다.
- request payload, response payload, Shopify product GID를 job에 저장한다.
- lease 만료 job은 다른 worker가 회수한다.

## 실행

```bash
npm run shopify
```

`SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`이 필요하다.

공식 계약: [Shopify productSet](https://shopify.dev/docs/api/admin-graphql/latest/mutations/productSet), [ProductSetInput](https://shopify.dev/docs/api/admin-graphql/latest/input-objects/productsetinput)

## 다음 단계

Printful variant ID와 Shopify variant/inventory item 매핑, 이미지 업로드, collection ID 해석, 비동기 operation 추적을 추가해야 한다.
