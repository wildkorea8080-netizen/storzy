# Printful variant·목업 이미지 Shopify 매핑 E2E

`docs/20`의 variant·이미지 매핑 계약을 실제 Shopify 개발 스토어와 Printful 계정으로 검증한 기록이다.
기준일은 2026-08-27이다.

`docs/203`의 draft 쓰기 smoke는 단일 variant 고정 픽스처를 사용하므로 매핑 경로를 타지 않는다.
이 문서는 색상·사이즈 조합, SKU, metafield, 목업 이미지가 실제로 연결되는지를 확인한다.

## 대상 구성

| 항목 | 값 |
|---|---|
| Printful 상품 | `71` Unisex Staple T-Shirt / Bella + Canvas 3001 |
| placement / technique | `front` / `dtg` |
| mockup style | `744` Men's Lifestyle |
| 색상 | White, Navy |
| 사이즈 | S, M, L, XL, 2XL |
| variant | 10개 |
| 판매가 | USD 39.00 |
| Shopify handle | `storzy-tee-seoul-side-v1` |

원단 색에 따라 대비되는 마크를 사용한다. White에는 `seoul-side-mark-navy.png`,
Navy에는 `seoul-side-mark-ivory.png`를 인쇄한다.

| Printful variant | 색상 / 사이즈 |
|---|---|
| `4011` `4012` `4013` `4014` `4015` | White S · M · L · XL · 2XL |
| `4111` `4112` `4113` `4114` `4115` | Navy S · M · L · XL · 2XL |

## 목업은 색상 단위로 생성된다

Printful은 사이즈가 아니라 색상 단위로 목업을 만든다. 한 task에 사이즈 5개를 넣어도
반환되는 이미지 URL은 하나다.

```text
White task 961941027   이미지 5개 · 고유 URL 1개
Navy  task 961941183   이미지 5개 · 고유 URL 1개
```

따라서 variant 10개에 대한 고유 이미지는 2개이며, 색상 수와 일치해야 정상이다.
사이즈별로 목업 task를 만들면 동일 이미지를 중복 생성하므로 rate limit만 소모한다.

## 매핑 결과

`mapProductSet`이 만든 입력과 Shopify가 반환한 결과가 일치했다.

```text
options    Size=[S,M,L,XL,2XL]  Color=[White,Navy]
variants   10개
files      2개
status     DRAFT
```

| 계약 | 확인 결과 |
|---|---|
| Printful `size` → Shopify `Size` option | 통과 |
| Printful `color` → Shopify `Color` option | 통과 |
| catalog variant ID → `STORZY-PF-{id}` SKU | 통과 |
| catalog variant ID → `storzy.printful_variant_id` metafield | 통과 |
| 목업 이미지 → product `files`와 variant `file` | 통과 |
| 재고 정책 `DENY` | 통과 |
| inventory tracking 비활성화 | 통과 |
| SEO·태그·vendor·productType | 통과 |

variant 10개가 모두 media 1개씩 연결됐고 product media는 2개다.
매퍼가 `files`를 중복 제거해 전달하고 Shopify가 같은 `MediaImage`를 여러 variant에
연결하므로 색상당 한 번만 업로드된다.

## 이미지는 비동기로 처리된다

게시 직후 조회하면 variant media가 비어 있을 수 있다. 외부 URL 이미지는 Shopify가
내려받아 처리하는 동안 `PROCESSING` 상태이며, 완료 후 `READY`가 되면서 연결이 보인다.

게시 직후의 조회 결과만으로 이미지 누락을 판정하지 않는다. `mediaErrors`와 `status`를
함께 확인해야 실제 실패와 처리 지연을 구분할 수 있다.

## 멱등성

같은 payload로 다시 게시해도 상품과 variant는 중복 생성되지 않는다.

```text
1회차   productId gid://shopify/Product/10413565247784
2회차   productId gid://shopify/Product/10413565247784   동일
media   2개 유지
```

다만 **재게시할 때마다 Shopify가 외부 URL에서 이미지를 다시 내려받는다.**
`MediaImage` ID가 매번 바뀐다.

```text
1회차   MediaImage/45202566316328, MediaImage/45202566349096
2회차   MediaImage/45202567430440, MediaImage/45202567463208
```

총 개수는 2개로 유지되므로 누적되지는 않는다.

### 목업 URL 만료가 재게시를 깨뜨린다

Printful 목업 이미지 URL은 72시간 후 만료된다. 재게시가 매번 원본 URL을 다시 가져가므로,
만료된 URL로 재게시하면 이미지 처리가 실패한다.

`docs/21`이 요구하는 `mockup_snapshots` 저장은 감사 목적만이 아니라 **재게시 안전성의
전제 조건**이다. 완료 이미지는 자체 저장소에 보관하고 그 URL을 Shopify에 전달해야
72시간 이후에도 재게시가 가능하다. 이 저장소는 아직 자체 이미지 호스팅을 갖고 있지 않으므로
공개 배포 후 해결해야 할 항목이다.

## 재현 방법

디자인 파일은 공개 URL에 있어야 한다(`docs/206`). 목업 생성과 게시는 외부 쓰기이므로
실행 전에 확인을 받는다.

1. 색상별로 `POST /v2/mockup-tasks` 실행. 신규 스토어는 분당 2회 제한이므로 간격을 둔다.
2. 완료 이미지 URL을 색상별로 확보한다.
3. `mapProductSet`에 `variants: [{externalVariantId, size, color, imageUrl}]`를 전달한다.
4. `ShopifyProductPublisher.publish`로 게시한다.
5. 이미지가 `READY`가 된 뒤 variant media 연결을 확인한다.

## 남은 확인 사항

- 자체 이미지 호스팅으로 목업 URL 만료 문제를 해소한다.
- size/color가 같은 variant가 둘 이상일 때 422로 중단되는 경로는 아직 실환경에서
  확인하지 않았다. `docs/20`의 차단 조건이며 단위 테스트로만 검증돼 있다.
- 개발 스토어에 남은 draft 상품은 `storzy-provider-smoke-v1`과
  `storzy-tee-seoul-side-v1`이다. 둘 다 `do-not-publish` 태그가 있다.
