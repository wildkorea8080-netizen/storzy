# 도메인 모델과 상태

## 1. 핵심 엔터티

| 엔터티 | 설명 | 중요한 필드 |
|---|---|---|
| Workspace | 한 브랜드 운영 공간 | id, owner_id, plan, status |
| BrandProfile | 온보딩을 구조화한 버전 데이터 | version, schema_version, data, status |
| StoreConnection | Shopify 설치와 권한 상태 | shop_domain, scopes, encrypted_token, status |
| SupplierConnection | Printful 연결과 store 범위 | provider, external_store_id, status |
| CatalogSnapshot | 공급 카탈로그/가격/배송 가능성 스냅샷 | provider_version, fetched_at, currency |
| ProductCandidate | 점수화된 공급 상품 후보 | score_breakdown, catalog_snapshot_id |
| ProductDraft | 판매 상품의 내부 원본 | content_revision, pricing_revision, status |
| DesignAsset | 업로드한 원본 및 검증 결과 | object_key, checksum, dimensions, dpi |
| ProductMapping | 내부 상품·변형과 외부 ID 연결 | shopify_id, printful_id, variant mappings |
| PublishRun | Shopify 반영 작업 | revision, idempotency_key, diff, status |
| Order | Shopify 주문의 내부 표현 | shopify_order_id, financial_status, risk_status |
| FulfillmentOrder | Printful 전달 단위 | status, cost_snapshot, block_reasons |
| WebhookEvent | 검증된 원본 이벤트 | provider, event_id, topic, payload, processed_at |
| AuditEvent | 사용자/시스템의 중요한 행위 | actor, action, target, before, after |

## 2. 권위 있는 데이터 소스

| 데이터 | 권위 소스 |
|---|---|
| 브랜드 프로필, 생성 콘텐츠, 승인 | STORZY |
| 스토어 주문·결제 상태 | Shopify |
| 카탈로그, 공급 원가, 제작 가능성 | Printful |
| 제작 및 배송 상태 | Printful |
| 판매가 | 승인 전 STORZY, 게시 후 Shopify와 revision 동기화 |
| AI 응답 | 권위 소스가 아닌 초안; 승인된 revision만 업무 데이터 |

## 3. 상태 전이

### BrandProfile

`DRAFT → GENERATED → REVIEW_REQUIRED → APPROVED → SUPERSEDED`

- 승인된 버전은 수정하지 않고 새 draft를 만든다.
- 새 버전 승인이 기존 게시 상품을 자동 변경하지 않는다.

### ProductDraft

`DRAFT → CONTENT_READY → DESIGN_READY → REVIEW_REQUIRED → APPROVED → PUBLISHING → PUBLISHED`

오류 상태는 `BLOCKED` 또는 `PUBLISH_FAILED`이며 원래 단계와 재개 지점을 별도로 보존한다. 승인 후 가격·디자인·변형·콘텐츠가 변경되면 승인을 무효화한다.

### FulfillmentOrder

`RECEIVED → VALIDATING → REVIEW_REQUIRED | READY → SUBMITTING → SUBMITTED → IN_PRODUCTION → SHIPPED → DELIVERED`

종료/예외 상태는 `CANCELLED`, `FAILED`, `ON_HOLD`이다. 이미 Printful에서 제작이 시작된 주문은 로컬 상태 변경만으로 취소된 것으로 간주하지 않는다.

## 4. 식별자와 멱등성

- 내부 ID는 정렬 가능한 UUID 계열을 사용하되 구체 형식은 구현 시 결정한다.
- 외부 ID는 숫자로 가정하지 않고 문자열로 저장한다. Shopify GID도 원문 보존한다.
- Webhook 중복 제거 키: Shopify는 `X-Shopify-Webhook-Id`, Printful은 공식 payload에 안정적 event ID가 있으면 이를 사용하고 없으면 문서화된 필드의 해시 키를 사용한다.
- 주문 제출 키 예: `printful-order:{workspace_id}:{shopify_order_id}:{fulfillment_revision}`.
- 게시 키 예: `shopify-product:{product_draft_id}:{approved_revision}`.

## 5. 가격 모델

다음 값은 서로 분리해 저장한다.

- 공급 상품 원가
- 인쇄/추가 배치 비용
- 예상 배송비
- 세금/관세 추정치
- 결제·플랫폼 수수료 추정치
- 판매가
- 통화 및 환율 스냅샷
- 목표 마진과 계산된 공헌 마진

기본 마진율은 다음처럼 정의한다.

`margin_rate = (retail_price - variable_cost_total) / retail_price`

표시용 반올림 값으로 승인 여부를 계산하지 않는다. 배송비를 고객에게 별도 청구하는 정책이라도 보수적 마진 시나리오를 함께 계산한다.

## 6. 보존과 삭제

- Webhook 원문에는 고객 개인정보가 포함될 수 있으므로 암호화, 접근 제한, 최소 보존 기간을 적용한다.
- 감사 로그는 민감 토큰과 전체 주소를 포함하지 않는다.
- Shopify 필수 개인정보 Webhook에 따라 고객 데이터 제공·삭제와 shop 삭제 절차를 실행할 수 있어야 한다.
- 실제 보존 기간은 서비스 국가와 법률 검토 후 `07` 문서에 확정한다.

