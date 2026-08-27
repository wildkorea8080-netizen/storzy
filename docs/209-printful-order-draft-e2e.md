# Printful 주문 draft·원가 검증 E2E

`docs/23`의 draft 생성과 비용 재검증 경로를 실제 Printful 계정으로 확인한 기록이다.
기준일은 2026-08-27이다.

**confirm은 호출하지 않았고 생성한 draft는 삭제했다.** Printful은 draft 상태에서
과금하거나 제작하지 않으며, 이 경계가 주문 자동화의 최종 안전장치다(`docs/23`).

## 대상 구성

| 항목 | 값 |
|---|---|
| `catalog_variant_id` | `4111` Navy / S |
| placement / technique | `front` / `dtg` |
| 디자인 | `seoul-side-mark-ivory.png` |
| 수취인 | 미국 캘리포니아 테스트 주소 |
| 수량 | 1 |
| 판매가 | USD 39.00 |
| `external_id` | `storzy:e2e-test:{timestamp}` |

payload 구조는 `src/orders/printful-job-store.ts`의 `payload()`가 만드는 것과 같다.

## 실행 결과

```text
1. draft 생성        order 173740330  status=draft  calc=calculating
2. 비용 계산 대기      약 5초 후 calc=done
3. 삭제              성공, 재조회 HTTP 404
```

비용 계산은 비동기다. 생성 직후에는 `calculation_status`가 `calculating`이며
`GET /v2/orders/{id}`로 `done`이 될 때까지 기다려야 원가를 신뢰할 수 있다.

## 실제 원가

| 항목 | USD |
|---|---:|
| 상품 | 11.69 |
| 배송 | 4.75 |
| 세금 | 3.80 |
| **합계** | **20.24** |
| 판매가 | 39.00 |
| 마진 | 18.76 (48.10%) |

세금 3.80은 Printful이 nexus를 가진 캘리포니아 배송이라 발생했다. 배송지에 따라 달라지므로
주별·국가별 원가는 주문 시점에 다시 계산해야 한다. 승인 시점 원가를 그대로 신뢰하지 않는
`docs/23`의 재검증 설계가 이 때문에 필요하다.

### 목표 마진과의 차이

`docs/01`의 상품 콘텐츠 예시는 `target_margin_rate` 0.55를 사용한다. 실측 원가 20.24로
55% 마진을 달성하려면 판매가가 약 **USD 45.00**이어야 한다.

```text
20.24 / (1 - 0.55) = 44.98
```

브랜드 가이드의 티셔츠 가격대는 35~45달러이므로 45달러는 상단이다. 39달러로 판매하면
마진은 48.1%다. 첫 판매 국가와 기준 통화를 확정할 때(`docs/200`의 출시 결정값) 이 수치를
근거로 판매가를 정한다. 배송비와 세금이 배송지마다 달라지므로 단일 목표 마진을 모든
시장에 적용할 수 없다.

## 결정론적 정책 판정

실측 원가를 넣고 `evaluateOrder`(`order-policy.v1`)를 6개 시나리오로 확인했다.
판정은 LLM이 아니라 결정론적 코드가 수행한다(ADR-005).

| 시나리오 | 판정 | 마진 | 사유 |
|---|---|---:|---|
| 정상 주문 | `READY` | 4810bp | — |
| 배송 불가 국가 (KR) | `BLOCKED` | 4810bp | `UNSUPPORTED_COUNTRY` |
| 원가 급등 (승인가의 2배) | `REVIEW_REQUIRED` | 4810bp | `COST_SPIKE` |
| 판매가 < 원가 | `BLOCKED` | -519bp | `NEGATIVE_MARGIN` |
| 디자인 파일 누락 | `BLOCKED` | 4810bp | `MISSING_DESIGN` |
| 고액 주문 (한도 초과) | `REVIEW_REQUIRED` | 9797bp | `HIGH_VALUE_ORDER` |

`docs/06`이 정의한 자동화 중단 조건이 실측 데이터에서 그대로 동작한다.
`BLOCKED`와 `REVIEW_REQUIRED`의 구분도 설계대로다. 손실·배송 불가·디자인 누락처럼
사람이 판단할 여지가 없는 경우는 `BLOCKED`, 한도 초과나 원가 상승처럼 운영자가
승인할 수 있는 경우는 `REVIEW_REQUIRED`다.

적용한 정책값은 `.env`의 다음 항목이다.

```env
ORDER_ALLOWED_COUNTRIES=US,JP
ORDER_MAX_AMOUNT_MINOR=50000
ORDER_MAX_ITEM_COUNT=10
ORDER_MAX_COST_INCREASE_BPS=1000
```

## 정리

테스트 draft는 `DELETE /v2/orders/{id}`로 삭제했고 재조회에서 `404`를 확인했다.
Printful 계정에 잔여 주문이 남지 않는다.

## 남은 확인 사항

- confirm 이후 경로(`SUCCEEDED` 전환, `pending`·`inreview`·`inprocess` 판정)는
  실제 과금이 발생하므로 검증하지 않았다.
- `@external_id` 재조회로 기존 draft를 이어 쓰는 복구 경로(`docs/175`)는 확인하지 않았다.
  응답 유실 상황을 실환경에서 만들기 어렵다.
- 배송지별 세금·배송비 차이가 마진에 미치는 영향은 미국 캘리포니아 한 건만 확인했다.
  일본 배송 원가는 별도로 측정해야 한다.
