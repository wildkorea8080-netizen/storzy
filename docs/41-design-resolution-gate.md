# 디자인 인쇄 해상도 게이트

## 목적

업로드 파일의 픽셀 크기만 확인하지 않고, Printful 상품의 실제 인쇄 영역에 배치했을 때 목표 DPI를 충족하는지 판정한다. 해상도 판정은 LLM이 아니라 카탈로그 규격과 결정론적 계산으로 수행한다.

## 카탈로그 계약

`GET /v2/catalog-products/{id}/mockup-styles` 결과에서 선택 기법에 해당하는 다음 값을 카탈로그 스냅샷의 `placementGuidelines`에 보존한다.

- `placement`, `technique`
- `printAreaWidthIn`, `printAreaHeightIn`
- `targetDpi` (MVP 최소 허용값: 150)

후속 디자인 검증은 후보가 생성될 때 고정된 `catalog_snapshot_id`만 사용한다. 최신 카탈로그를 다시 조회해 승인 근거를 소급 변경하지 않는다.

## 판정식

```text
requiredWidthPx  = ceil(printAreaWidthIn  × targetDpi)
requiredHeightPx = ceil(printAreaHeightIn × targetDpi)
effectiveDpi     = min(widthPx / printAreaWidthIn, heightPx / printAreaHeightIn)
```

두 축이 모두 필요 픽셀 이상일 때만 `PASSED`다. 한 축이라도 부족하면 `DESIGN_RESOLUTION_TOO_LOW`로 등록을 거부한다.

## 실패 안전 동작

| 상태 | 저장 | Printful 목업 큐 |
|---|---:|---:|
| `PASSED` | 예 | 진행 |
| `GUIDELINE_MISSING` | 검토 상태로 저장 | 중단 |
| 저해상도 | 아니요 | 중단 |
| `NOT_EVALUATED` | 레거시·테스트 호환 | 기존 동작 |

`GUIDELINE_MISSING`은 자동 승인으로 간주하지 않는다. 관리자 디자인 화면에 경고를 표시하며, 운영자 override 기능이 도입되기 전에는 목업 생성이 시작되지 않는다.

## 저장 및 감사

`design_assets`에 원본 `width_px`, `height_px`와 함께 `resolution_status`, `effective_dpi`, 판정에 사용한 `print_guideline`을 저장한다. 등록·수정 감사 이벤트에도 판정 상태와 유효 DPI를 남긴다.

## 테스트 기준

- 12×16인치, 150 DPI 영역에는 최소 1800×2400px가 필요하다.
- 1800×2400px는 통과한다.
- 1200×1200px는 유효 DPI 75로 거부한다.
- placement·technique 규격이 없으면 `GUIDELINE_MISSING`이 된다.
