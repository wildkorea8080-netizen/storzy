# 외부 연동 계약

작성 기준일은 2026-08-05이다. 외부 API는 버전이 바뀌므로 구현 시작과 분기별로 공식 문서를 재검증한다.

## 1. Shopify

### 기준

- 신규 공개 앱은 GraphQL Admin API 중심으로 구현한다. REST Admin API는 레거시이다.
- API 버전은 코드/설정에서 명시적으로 고정하고 분기별 업그레이드 테스트를 한다.
- 상품 동기화는 `productSet`을 우선 검토한다. `write_products` 권한과 사용자 상품 생성 권한이 필요하다.
- `productSet`의 목록 필드는 최종 상태 동기화 의미를 가진다. 입력에서 빠진 collection, metafield, variant 등이 삭제될 수 있으므로 patch처럼 사용하지 않는다.
- 소량의 변형 전용 수정에는 product variant bulk mutation을 검토한다.

### 최소 권한 후보

정확한 scope 이름과 protected customer data 요건은 앱 구성 스파이크에서 확정한다.

- 상품/컬렉션 읽기·쓰기
- 주문 읽기
- fulfillment 읽기·쓰기
- 파일 또는 이미지 처리에 필요한 권한

권한은 기능별로 매핑하고 사용하지 않는 범위는 요청하지 않는다. 주문 주소 등 protected customer data 접근 승인이 앱 심사 일정의 선행 조건이다.

### Webhook

MVP 후보 topic은 주문 생성/갱신/취소, 앱 제거, 필수 개인정보 처리 이벤트이다. 실제 topic과 scope는 API 버전별 reference로 고정한다.

수신 규칙:

1. raw body와 앱 secret으로 HMAC SHA-256을 검증한다.
2. webhook ID를 unique key로 저장해 중복을 무시한다.
3. 5초 제한보다 충분히 빠르게 2xx 응답하고 큐에서 처리한다.
4. 순서 보장을 가정하지 않으며 처리 시 GraphQL로 최신 상태를 재조회한다.
5. 실패 delivery와 제거된 subscription을 모니터링한다. Shopify는 실패를 반복 재시도하며 지속 실패 시 subscription을 제거할 수 있다.
6. app-specific subscription을 기본으로 사용하고 `shopify.app.toml`에서 버전을 관리한다.

### 상품 게시 경계

- STORZY 내부 product revision을 Shopify product/variant GID에 매핑한다.
- 이미지 업로드 완료 후 상품에 연결한다.
- SEO, 태그, 컬렉션, status는 승인 snapshot에서만 생성한다.
- 외부 쓰기 후 GraphQL로 결과를 다시 읽어 필수 필드가 일치하는지 검증한다.
- Shopify Admin에서 사용자가 직접 바꾼 필드는 소유권 매트릭스에 따라 충돌로 표시한다.

## 2. Printful

### 버전 전략

- 신규 구현은 v2 문서를 우선한다.
- 카탈로그, mockup, order, webhook별 v2 기능의 정식/베타 상태와 누락 필드를 스파이크에서 기록한다.
- v1 fallback이 필요하면 동일 도메인 어댑터 뒤에 격리하고 제거 조건을 남긴다.
- product ID와 variant ID를 혼동하지 않도록 타입을 분리한다.

### 카탈로그와 비용

- 카탈로그 제품/변형, 배치(placement), 인쇄 파일 요건, 사용 가능 국가를 정기 동기화한다.
- 후보 점수와 가격은 `CatalogSnapshot`에 고정된 원가를 사용한다.
- 게시와 주문 직전에는 원가·재고/가용성·배송 가능성을 다시 확인한다.
- 인쇄 파일은 요구 비율, 픽셀, DPI, 파일 유형을 사전 검증한다.

### Mockup Generator

- 목업은 비동기 작업으로 취급한다.
- task ID를 저장하고 제한적 상태 조회 또는 완료 Webhook으로 결과를 수신한다.
- timeout, 부분 변형 실패, URL 만료를 처리한다.
- 목업은 판매 이미지이며 인쇄 원본 파일을 대체하지 않는다.
- 공식 v2 문서 기준 신규 store는 분당 2회, 누적 fulfilled order가 미화 10달러 이상인 store는 분당 10회의 생성 제한이 안내되어 있으므로 작업을 batch하고 store별 rate limiter를 둔다.

### 주문

- Shopify line item을 Printful catalog variant와 design placement로 결정론적으로 매핑한다.
- 외부 주문 ID에 Shopify 주문과 STORZY revision을 추적할 수 있는 값을 사용한다.
- 가능하면 draft 생성과 confirm을 분리해 비용/주소/파일을 마지막으로 확인한다.
- API timeout 시 새 주문을 바로 생성하지 말고 외부 ID로 기존 생성 여부를 먼저 조회한다.
- shipment event에서 carrier, tracking number, tracking URL, shipped item을 내부 fulfillment에 반영한다.

## 3. OpenAI

### 생성 계약

- 서버에서 Responses API를 호출한다.
- Brand Profile과 상품 콘텐츠는 JSON Schema 기반 Structured Outputs를 사용하고 strict schema adherence를 켠다.
- 현재 계약은 `docs/schemas`의 스키마가 기준이며 런타임에서도 동일 스키마로 검증한다.
- 구조 검증 다음에 통화, 국가 코드, 가격 범위, 금지 태그 등 도메인 검증을 별도로 수행한다.
- API refusal, incomplete output, timeout, rate limit을 정상적인 실패 유형으로 처리한다.
- 모든 object의 필드는 `required`, `additionalProperties`는 `false`로 유지한다. 선택값은 `null` union으로 표현한다.
- Structured Outputs는 JSON Schema 일부만 지원하고 fine-tuned model은 문자열 길이·pattern, 숫자 범위, 배열 길이 제약 등에 추가 제한이 있으므로, 모델 변경 시 실제 API schema acceptance test를 통과해야 한다.

### 재현성과 품질

- 모델 alias가 아닌 검증된 snapshot 고정을 기본으로 검토한다.
- `model`, `prompt_version`, `schema_version`, token usage, latency, request ID를 생성 실행에 기록한다.
- 프롬프트 변경 전 golden dataset 평가를 실행한다.
- 브랜드 입력과 상품 데이터를 지시문으로 취급하지 않아 prompt injection이 시스템 규칙을 바꾸지 못하게 한다.
- AI에게 비밀키, 전체 고객 주소, 주문 결제 정보를 보내지 않는다.

## 4. 공식 참조 링크

- [Shopify REST Admin API의 legacy 안내](https://shopify.dev/docs/api/admin-rest/latest)
- [Shopify GraphQL `productSet`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/productSet)
- [Shopify Webhook 개요](https://shopify.dev/docs/apps/build/webhooks)
- [Shopify Webhook 구독 관리](https://shopify.dev/docs/apps/build/webhooks/subscribe)
- [Shopify Webhook 문제 해결과 재시도](https://shopify.dev/docs/apps/build/webhooks/troubleshoot)
- [Printful API v2](https://developers.printful.com/docs/v2-beta/)
- [Printful API v1](https://developers.printful.com/docs/)
- [OpenAI API Quickstart와 Responses API](https://platform.openai.com/docs/quickstart)
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
