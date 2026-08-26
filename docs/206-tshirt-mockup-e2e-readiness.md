# 티셔츠 목업 E2E 준비 상태

Printful 실제 목업 생성 E2E에 필요한 상품 규격과 디자인 파일을 확보한 기록이다.
기준일은 2026-08-26이며 이 시점에 남은 차단 요인도 함께 남긴다.

## 대상 상품

읽기 전용 `GET /v2/catalog-products`로 반팔 티셔츠 후보를 조회해 다음을 선택했다.

| 항목 | 값 |
|---|---|
| `catalog_product_id` | `71` |
| 상품명 | Unisex Staple T-Shirt / Bella + Canvas 3001 |
| 지원 기법 | `dtg`, `embroidery`, `dtfilm` |
| variant 총수 | 590 |

POD 업계에서 가장 널리 쓰이는 기본 티셔츠라 mockup style과 variant 표본이 충분하다.

## placement 규격

`GET /v2/catalog-products/71/mockup-styles` 응답에서 확인한 값이다.

| placement | technique | 인쇄 영역 | DPI |
|---|---|---|---:|
| `front` | `dtg` | 12 × 16 in | 150 |
| `back` | `dtg` | 12 × 16 in | 150 |
| `sleeve_left` / `sleeve_right` | `dtg` | 4 × 3.5 in | 150 |
| `embroidery_chest_left` / `embroidery_chest_center` | `embroidery` | 4 × 4 in | 300 |
| `label_outside` | `dtg` | 3 × 3 in | 150 |
| `label_inside` | `dtg` | 3 × 1.13 in | 300 |

E2E는 `front` / `dtg`를 사용한다.

## mockup style

`front` placement에 118개 style이 있으며 `view_name`이 `Front`인 것만 사용한다.

| ID | category |
|---:|---|
| `742` | Couple's |
| `744` | Men's Lifestyle |
| `754` | Men's Lifestyle 2 |
| `766` | Flat Lifestyle |
| `768` | Women's Lifestyle |

`docs/43`의 등록 게이트에 따라 style ID는 AI가 추측하지 않고 카탈로그 스냅샷의
`allowedMockupStyleIds`와 대조한다. E2E 기본값은 `744`다.

## 디자인 파일

`assets/brand/seoul-side-mark-navy.png`를 사용한다.

| 항목 | 값 |
|---|---|
| 크기 | 4500 × 3150 px |
| 형식 | 8-bit RGBA PNG, 투명 배경 |
| 색상 | `#0D1B33` |
| 파일 크기 | 약 104 KB |

`front` / `dtg` 규격(12 × 16 in, 150 DPI)에 대한 판정은 다음과 같다.

```text
requiredWidthPx  = ceil(12 × 150) = 1800
requiredHeightPx = ceil(16 × 150) = 2400
effectiveDpi     = min(4500 / 12, 3150 / 16) = min(375, 196.87) = 196.87
```

두 축 모두 필요 픽셀 이상이므로 `PASSED`다. 50 MB와 20,000 px 제한도 통과한다.

## 목업 task payload

`src/mockups/job-store.ts`의 `createPayload`가 만드는 구조에 위 값을 대입하면 다음과 같다.

```json
{
  "format": "jpg",
  "mockup_width_px": 1000,
  "products": [
    {
      "source": "catalog",
      "catalog_product_id": 71,
      "catalog_variant_ids": [4021, 4022, 4023],
      "mockup_style_ids": [744],
      "placements": [
        {
          "placement": "front",
          "technique": "dtg",
          "layers": [{ "type": "file", "url": "<공개 HTTPS URL>" }]
        }
      ]
    }
  ]
}
```

## 차단 요인 — 공개 HTTPS URL

Printful은 디자인 파일의 바이너리 업로드를 받지 않는다. 공식 문서의 목업 생성 절차는
파일을 공개 URL에 올린 뒤 그 URL을 전달하도록 요구하며, `layers[].url`에 지정한 주소로
Printful 서버가 직접 파일을 가져간다. `docs/21`의 디자인 등록 API가 `fileUrl`을 HTTPS로
제한하는 것도 같은 이유다.

STORZY는 아직 공개 HTTPS 배포가 없어 이 URL을 제공할 수 없다. 따라서 목업 E2E는
`docs/143`~`docs/145`, `docs/157`의 운영 배포가 끝난 뒤에 진행한다.

공개 배포는 목업 외에 다음 P0 항목의 공통 선행 조건이기도 하다.

- Shopify 앱 URL과 OAuth callback 등록
- Shopify·Printful Webhook 실환경 수신 검증
- 주문 수신부터 배송 반영까지의 전체 흐름 E2E

## 재현 방법

상품 규격은 모두 읽기 전용 GET으로 확인했다. 카탈로그가 바뀌면 다음으로 다시 확인한다.

```bash
npm run printful:catalog-smoke
```

```env
PRINTFUL_CATALOG_SMOKE_PRODUCT_ID=71
PRINTFUL_CATALOG_SMOKE_CURRENCY=USD
```

디자인 파일은 다음으로 다시 생성한다.

```bash
npm run brand:mark
```
