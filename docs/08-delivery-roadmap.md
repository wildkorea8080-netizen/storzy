# 개발 로드맵

일정은 팀 규모가 정해지기 전에는 주 단위로 확정하지 않는다. 각 단계는 독립적인 통과 조건으로 관리한다.

> 2026-08-21 현재 코드 구현과 출시 검증 상태는 `200-mvp-implementation-status.md`를 따른다. 아래 Phase 목록은 구축 순서의 기준이며, 구현 완료를 의미하지 않는다.

## Phase 0 — 기술 스파이크와 계약 고정

산출물:

- Shopify 개발 스토어와 공개 앱 골격
- Printful 테스트 연결과 catalog/mockup/order 최소 호출
- OpenAI Structured Outputs 샘플 실행
- 프레임워크, DB, 큐, 호스팅 ADR
- API scope, protected customer data, 앱 심사 체크리스트
- Shopify/Printful fixture와 contract test 구조

통과 조건:

- 테스트 상품 1개를 승인 후 Shopify draft로 만들 수 있음
- 테스트 디자인으로 Printful 목업을 비동기로 받을 수 있음
- 주문 생성은 실제 비용이 발생하지 않는 테스트/미확정 상태까지만 검증
- 실패와 timeout의 API 응답 형태를 fixture로 보존

## Phase 1 — 브랜드와 AI 기반

- 사용자/workspace 인증
- 온보딩 폼과 BrandProfile revision
- Structured Outputs gateway, schema/domain validation
- 생성 실행 추적과 golden evaluation
- 승인 및 감사 로그

통과 조건: 30개 fixture에서 스키마 성공률 목표를 달성하고 승인되지 않은 profile이 downstream 작업에 사용되지 않는다.

## Phase 2 — 카탈로그, 점수, 콘텐츠

- Printful catalog snapshot 동기화
- taxonomy 매핑과 hard constraint
- 점수·가격·마진 엔진
- 상품 콘텐츠 생성 및 편집
- 디자인 업로드/검증/placement
- mockup 작업 상태

통과 조건: 동일 snapshot과 rule version에 항상 동일 점수가 나오며, 가격은 AI 값에 의존하지 않는다.

## Phase 3 — Shopify 스토어 빌더

- OAuth, scope, 연결 상태
- 템플릿 3개와 설정 allowlist
- 페이지/컬렉션/상품 게시 계획과 diff
- `productSet`/관련 mutation 어댑터
- 게시 idempotency, rollback 또는 보상 작업

통과 조건: 승인 snapshot만 게시되고 같은 publish run 재실행으로 상품·변형이 중복되지 않는다.

## Phase 4 — 주문과 fulfillment

- Shopify Webhook ingress
- 주문 최신 상태 조회와 내부 모델
- 자동 처리/차단 규칙
- Printful 주문 draft/confirm
- 예외 큐와 수동 처리
- shipment → Shopify fulfillment
- reconciliation과 replay

통과 조건: 중복·순서 역전·timeout 테스트에서 중복 주문이 없고, 모든 차단 사유가 운영 화면과 감사 로그에 남는다.

## Phase 5 — 출시 준비

- privacy webhook과 삭제/제공 플로우
- 부하·보안·복구 테스트
- 외부 API 버전 업그레이드 runbook
- 모니터링·경보·비용 한도
- 운영 runbook 및 고객 지원 경로
- Shopify 앱 심사 자료

## 우선 구축할 테스트 피라미드

1. Rules Engine 단위 테스트: 점수, money, margin, block rules
2. Schema/contract 테스트: JSON Schema와 provider fixtures
3. Adapter 통합 테스트: 개발 스토어 및 Printful 테스트 범위
4. Workflow 테스트: queue retry, idempotency, outbox
5. E2E smoke: 온보딩 → 승인 → 상품 draft → 주문 예외

## Definition of Done

기능은 다음을 모두 만족해야 완료이다.

- 권한과 workspace 격리 테스트
- 정상·실패·timeout·중복 경로 테스트
- 감사 이벤트와 관찰 가능성 필드
- 사용자에게 복구 가능한 오류 메시지
- 외부 쓰기 멱등성
- 관련 참조 문서와 스키마 갱신
- 운영자가 재시도 또는 수동 해결할 수 있는 경로
