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

## 현재 제한

Printful의 blank catalog 이미지를 사용하며 디자인이 합성된 mockup은 아직 아니다. 다음 단계에서 mockup task 생성·완료 polling/webhook과 생성 이미지 URL snapshot을 연결한다.
