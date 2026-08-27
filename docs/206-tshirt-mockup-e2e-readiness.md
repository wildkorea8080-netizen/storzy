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

## 공개 HTTPS URL 제약

Printful은 디자인 파일의 바이너리 업로드를 받지 않는다. 공식 문서의 목업 생성 절차는
파일을 공개 URL에 올린 뒤 그 URL을 전달하도록 요구하며, `layers[].url`에 지정한 주소로
Printful 서버가 직접 파일을 가져간다. `docs/21`의 디자인 등록 API가 `fileUrl`을 HTTPS로
제한하는 것도 같은 이유다.

STORZY 본체의 공개 HTTPS 배포는 목업 외에 다음 P0 항목의 공통 선행 조건이다.

- Shopify 앱 URL과 OAuth callback 등록
- Shopify·Printful Webhook 실환경 수신 검증
- 주문 수신부터 배송 반영까지의 전체 흐름 E2E

다만 목업 생성만 놓고 보면 필요한 것은 **디자인 파일을 가져갈 수 있는 주소 하나**뿐이며
STORZY 본체가 그 주소를 제공할 필요는 없다. 본체 배포가 도메인·Shopify 앱 발급을 기다리는
동안 목업 E2E를 먼저 검증하기 위해 디자인 파일만 정적 호스팅한다.

## 디자인 파일 정적 배포

`deploy/design-assets/`가 배포 단위다. 저장소 전체가 아니라 이 디렉터리만 올려서
소스 코드가 공개되지 않게 한다.

```text
deploy/design-assets/
  vercel.json                  Content-Type 과 캐시 헤더
  index.html                   파일 목록 (noindex)
  seoul-side-mark-navy.png     생성기가 함께 기록
  seoul-side-mark-ivory.png    생성기가 함께 기록
```

PNG는 `npm run brand:mark`가 `assets/brand/`와 이 디렉터리에 동시에 쓴다.
원본과 배포본이 어긋나지 않게 하기 위해서다.

```bash
npx vercel deploy --prod --cwd deploy/design-assets
```

배포 후 얻은 주소를 목업 payload의 `layers[].url`에 넣는다. 이 파일은 브랜드 마크이며
자격 증명이나 운영 데이터를 포함하지 않는다.

STORZY 본체를 배포한 뒤에는 디자인 파일도 자체 도메인에서 제공하고 이 정적 배포는 정리한다.

배포한 주소는 다음과 같다.

```text
https://design-assets-eight.vercel.app/seoul-side-mark-navy.png
  HTTP 200  image/png  106,398 bytes
  SHA256 이 로컬 원본과 일치
```


### Vercel에 STORZY 본체를 올릴 수 없는 이유

디자인 파일 호스팅과 달리 애플리케이션 자체는 Vercel에 맞지 않는다. 구조적 이유다.

- worker 9개가 `worker.run(signal)`으로 도는 무한 폴링 루프이며 서버리스 함수의
  최대 실행 시간 안에 끝나지 않는다.
- `process-supervisor.ts`가 자식 프로세스를 `spawn`하고 30초 간격 heartbeat를 기록한다.
  서버리스에서는 응답 후 인터벌이 유지되지 않는다.
- `ProcessHeartbeatStore.health()`는 service·worker의 heartbeat가 90초를 넘으면 `STALE`로
  판정하고, `npm run deploy:verify`는 15개 역할 중 하나라도 어긋나면 종료 코드 `1`을 낸다.
  worker가 없는 환경에서는 감시 체계가 영구 실패 상태가 된다.

worker를 cron 배치로 바꾸면 ADR-001의 모듈러 모놀리스 + 별도 worker 구조와 lease·heartbeat
설계를 함께 다시 짜야 한다. 컨테이너를 장기 실행할 수 있는 호스팅을 사용한다.

## 실행 결과

2026-08-27에 실제 Printful 계정에서 목업 생성을 통과했다.

```text
POST /v2/mockup-tasks    task 961905462 생성
상태 조회                10초 후 completed
결과 이미지              3개 (variant 4021, 4022, 4023)
이미지 검증              JPEG 1000x1000, 189 KB
```

저장소의 실제 코드 경로를 그대로 사용했다. `PrintfulClient.createMockupTask`,
`parseCreatedTaskIds`, `parseMockupTasks` 는 목업 worker 가 쓰는 것과 같으므로
`docs/21` 의 파이프라인 계약이 실환경에서 성립한다는 것이 확인됐다.

주문, 결제, 상품 등록, 배송은 발생하지 않았다.

### 결과 이미지 만료

Printful 목업 이미지 URL 은 72시간 후 만료된다. `docs/21` 이 정의한 대로 완료 이미지는
`mockup_snapshots` 에 URL 과 SHA-256 checksum 으로 불변 저장한 뒤에만 Shopify 작업을
`PENDING` 으로 전환해야 한다. 원격 URL 을 그대로 상품 이미지로 사용하지 않는다.

### 확인이 필요한 후속 사항

**variant 3개가 같은 이미지 URL 을 반환했다.** `4021`(S), `4022`(M), `4023`(L) 은 모두
Aqua 색상이라 사이즈만 다르다. Printful 은 색상 단위로 목업을 만들기 때문에 동일 이미지를
돌려준다.

이후 `docs/208` 에서 Shopify 매핑까지 확인한 결과 **중복 업로드는 발생하지 않는다.**
`mapProductSet` 이 `files` 를 중복 제거해 전달하고 Shopify 가 같은 `MediaImage` 를 여러
variant 에 연결하므로, variant 10개에 대해 product media 는 색상 수와 같은 2개다.

**선택한 색상이 브랜드 팔레트와 맞지 않는다.** 카탈로그 표본의 앞 3개를 그대로 썼기 때문에
Aqua 가 선택됐다. 실제 상품 구성에서는 브랜드 색상(네이비, 스톤그레이, 아이보리, 샌드)에
맞는 variant 를 고르고, 진한 원단에는 `seoul-side-mark-ivory.png` 를 사용한다.

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
