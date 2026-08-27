# Printful → Shopify variant·이미지 매핑

## 원칙

Printful catalog variant는 실제 blank product의 size/color 조합이다. candidate snapshot은 모든 목표 시장에서 선택 technique가 `in stock`인 variant만 `catalogVariants`에 보존한다. Shopify worker는 이 배열을 그대로 사용하며 size/color Cartesian product를 만들지 않는다.

## Shopify 매핑

- Printful `size` → Shopify `Size` option
- Printful `color` → Shopify `Color` option
- catalog variant ID → `STORZY-PF-{id}` SKU
- catalog variant ID → `storzy.printful_variant_id` variant metafield
- Printful variant image HTTPS URL → product `files`와 variant `file`
- 재고 정책 → `DENY`
- Shopify inventory tracking → 비활성화. 실제 주문 전 Printful 가용성을 다시 검증한다.

이미지는 Shopify `FileSetInput.originalSource` 외부 URL로 전달한다. variant에 지정하는 파일은 product `files`에도 동일하게 포함한다.

## 차단 조건

- size/color가 같은 Printful variant가 둘 이상이면 Shopify option 조합이 중복되므로 422로 중단한다.
- variant image가 없으면 상품 등록은 계속하되 해당 variant file은 생략한다.
- 가용 variant가 없으면 candidate 단계에서 `OUT_OF_STOCK_TARGET_MARKET`으로 제외한다.

공식 계약: [ProductVariantSetInput](https://shopify.dev/docs/api/admin-graphql/latest/input-objects/productvariantsetinput), [FileSetInput](https://shopify.dev/docs/api/admin-graphql/latest/input-objects/filesetinput)

## 실환경 검증

2026-08-27에 디자인이 합성된 실제 mockup 이미지로 매핑 전 경로를 확인했다. 색상 2종 x 사이즈 5종의 variant 10개, SKU, metafield, 이미지 연결, 멱등 재게시가 모두 성립한다. 상세는 [208 variant 매핑 E2E](208-variant-mapping-e2e.md)에 있다.

Printful은 사이즈가 아니라 색상 단위로 목업을 만든다. 같은 색상의 모든 사이즈는 하나의 이미지 URL을 공유하므로, 사이즈별로 목업 task를 만들면 동일 이미지를 중복 생성한다.

## 현재 제한

외부 URL 이미지는 Shopify가 비동기로 내려받아 처리한다. 게시 직후에는 variant media가 `PROCESSING` 상태라 비어 보일 수 있으므로 `status`와 `mediaErrors`를 함께 확인해야 실패와 지연을 구분할 수 있다.

재게시할 때마다 Shopify가 원본 URL에서 이미지를 다시 가져간다. Printful 목업 URL은 72시간 후 만료되므로, 만료 뒤 재게시하면 이미지 처리가 실패한다. `docs/21`의 `mockup_snapshots` 저장과 자체 이미지 호스팅이 갖춰져야 장기 재게시가 안전하다.
