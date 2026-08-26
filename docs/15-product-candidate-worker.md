# 상품 후보 worker

## 목적

승인된 Brand Profile과 공급사 카탈로그를 결합해 상품 후보를 결정론적으로 평가한다. LLM은 후보 선정에 참여하지 않으며, 이후 후보 설명을 생성하는 역할만 맡는다.

## 처리 흐름

1. `brand-profile.approved` 이벤트 소비자가 `product_candidate_jobs`를 한 번만 생성한다.
2. worker가 `FOR UPDATE SKIP LOCKED`로 job을 claim하고 lease를 주기적으로 연장한다.
3. 승인된 revision만 읽고 Printful 제품 정보와 배송 가능 국가를 조회한다.
4. 조회 결과를 checksum이 포함된 immutable `catalog_snapshots`로 저장한다.
5. hard exclusion을 먼저 적용한 뒤 `product-score.v1`의 30/25/15/15/10/5 가중치를 계산한다.
6. snapshot, 후보 전체, job 성공 상태를 하나의 DB transaction으로 commit한다.

## Hard exclusion

- Brand Profile과 통화 불일치
- Brand Profile에서 제외한 상품 유형
- 해당 상품 유형의 가격 범위 누락 또는 잘못된 범위
- 하나 이상의 목표 국가로 배송 불가
- 디자인 placement 누락
- 원가 오류
- 목표 마진을 만족하는 가격이 상한을 초과
- 마진율 30% 미만

제외 후보도 삭제하지 않는다. `exclusion_reasons`와 계산 근거를 저장해 운영자가 결과를 재현할 수 있게 한다.

## 점수와 가격

`product-candidate.v1`은 기존 `product-score.v1`을 사용한다.

| 항목 | 가중치 |
|---|---:|
| 예상 마진 | 30% |
| 타깃 적합성 | 25% |
| 배송 경쟁력 | 15% |
| 디자인 적용성 | 15% |
| 사이즈·색상 다양성 | 10% |
| 반품 안전성 | 5% |

권장가는 가격 범위의 최저가와 목표 마진을 달성하는 최소 가격 중 큰 값이다. 모든 금액은 통화의 minor unit 정수로 계산한다.

## Printful 경계

현재 어댑터는 선택된 Printful product ID의 제품 정보, 배송 국가, variant 목록, product prices를 조회한다. account token을 쓸 때는 `PRINTFUL_STORE_ID`가 `X-PF-Store-Id`로 전달된다.

가격 응답의 통화와 variant별 선택 technique 가격을 검증한다. 모든 목표 시장에서 동시에 판매 가능한 variant 중 가장 높은 `discounted_price`를 보수적 원가로 사용한다. HTTP 가격 조회가 실패한 경우에만 운영자가 확인한 아래 seed를 fallback으로 사용하고 사유를 snapshot에 기록한다.

```json
[
  {
    "productId": "71",
    "productType": "t-shirt",
    "baseCostMinor": 1500,
    "shippingReserveMinor": 500,
    "returnRisk": "MEDIUM",
    "technique": "dtg"
  }
]
```

환경 변수 `PRINTFUL_CATALOG_SEEDS_JSON`에 JSON 배열을 넣고 `npm run candidate`로 실행한다. 원가와 배송 reserve는 자동 주문 직전에도 다시 검증해야 하며, 실제 주소 기반 배송료 조회는 주문 자동화 단계에서 추가한다.

variant, price, availability 응답은 `limit=100`과 `offset`으로 마지막 페이지까지 순회한다. Brand Profile의 국가 코드를 Printful selling region으로 변환해 각 지역의 선택 technique 재고를 조회하고, 모든 목표 시장에서 `in stock`인 variant의 교집합만 사이즈·색상 다양성과 최대 원가 계산에 사용한다. 국가별 region 매핑과 재고 수는 snapshot evidence에 함께 저장한다.

공식 API 계약: [Printful API v2 문서](https://developers.printful.com/docs/v2-beta/)

## 운영·복구

- 기본 lease 120초, heartbeat는 lease의 1/3 간격이다.
- HTTP 408, 429, 5xx 및 네트워크 오류는 지수 backoff로 재시도한다.
- 승인 revision 누락이나 4xx 계약 오류는 즉시 실패한다.
- 만료된 RUNNING job은 다른 worker가 회수하며 최대 시도 횟수를 넘으면 `LEASE_EXHAUSTED`로 종료한다.
- 성공 결과는 snapshot checksum, rule version, score breakdown, exclusion evidence로 감사 가능하다.

## 현재 제한

- pagination은 최대 100페이지에서 중단한다. 응답이 진행되지 않거나 이 안전 한도를 넘으면 job을 실패시킨다.
- 배송 점수는 모든 목표 국가 지원 여부를 통과하면 100점이다. 실제 배송비·배송일 비교는 후속 규칙 버전에서 세분화한다.
- 배송 reserve는 운영자 승인 값이다. 실제 주소 기반 배송료 조회는 주문 자동화 단계에서 적용한다.
- Printful의 전용 selling region이 정의되지 않은 국가는 `worldwide` 재고로 평가하며, 실제 주문 전 주소 기반 재고 검증이 여전히 필요하다.
