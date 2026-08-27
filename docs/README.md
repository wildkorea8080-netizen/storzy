# STORZY 참조 문서

이 폴더는 제품·개발·운영이 같은 기준으로 MVP를 구축하기 위한 단일 참조점입니다. 번호 순서대로 읽으면 제품 범위에서 구현 계획까지 이어집니다.

전체 205개 문서를 아래 인덱스로 관리한다. `01`~`10`은 제품과 기반 설계, `11`~`199`는 기능 증분
기록, `200` 이상은 운영 기준 문서다. 새 기능은 다음 번호로 문서를 추가하고 이 인덱스에 등록한다.

작업을 시작하기 전에 [200 MVP 구현 현황](200-mvp-implementation-status.md)에서 해당 기능의
판정을 먼저 확인한다. 이미 구현된 기능을 다시 만들지 않기 위한 단일 기준이다.

## 기반 문서

| 문서 | 목적 | 주요 산출물 |
|---|---|---|
| [01 MVP PRD](01-mvp-prd.md) | 무엇을 왜 만드는지 고정 | 사용자 흐름, 범위, 완료 조건 |
| [02 아키텍처](02-architecture.md) | 시스템 경계와 책임 정의 | 컴포넌트, 동기/비동기 흐름 |
| [03 도메인 모델](03-domain-model.md) | 데이터와 상태의 기준 정의 | 엔터티, 식별자, 상태 전이 |
| [04 외부 연동](04-integrations.md) | 외부 API 계약 정의 | Shopify, Printful, OpenAI |
| [05 AI와 점수](05-ai-and-scoring.md) | 생성과 계산 경계 정의 | 스키마, 점수식, 평가 기준 |
| [06 주문 운영](06-order-operations.md) | 주문 자동화 안전장치 정의 | 검증, 예외 큐, 재처리 |
| [07 보안·신뢰성](07-security-reliability.md) | 출시 전 필수 통제 정의 | 인증, 개인정보, 감사로그 |
| [08 로드맵](08-delivery-roadmap.md) | 구현 순서와 게이트 정의 | 단계, 테스트, Definition of Done |
| [09 결정 기록](09-decisions-and-open-questions.md) | 가정과 미결정 사항 관리 | ADR 요약, 확인할 질문 |
| [10 Phase 0 구현](10-phase-0-implementation.md) | 현재 실행 가능한 기반과 검증 범위 기록 | 스택, 코드 구조, smoke test |
| [11 Brand Profile 흐름](11-brand-profile-workflow.md) | 첫 Phase 1 수직 기능의 계약과 운영 방법 | DB, API, 상태, worker 경계 |
| [12 Generation worker](12-generation-worker.md) | 비동기 AI 생성의 실행·재시도·복구 기준 | lease, backoff, 오류 분류 |
| [13 Outbox·관찰 가능성](13-outbox-observability.md) | 이벤트 전달과 요청 추적 운영 기준 | publisher, dead-letter, telemetry |
| [14 도메인 이벤트 라우팅](14-domain-event-routing.md) | Brand Profile 이벤트의 실제 후속 작업 정의 | 알림, 상품 후보 job, 멱등 소비 |
| [15 상품 후보 worker](15-product-candidate-worker.md) | 승인 프로필과 공급 카탈로그의 결정론적 후보 평가 | snapshot, hard exclusion, 점수, lease |
| [16 상품 후보 검수 API](16-product-candidate-review-api.md) | 후보 조회·정렬과 운영자 승인 계약 | review 상태, 멱등 결정, 감사 로그 |
| [17 AI 상품 콘텐츠 생성](17-product-content-generation.md) | 승인 후보의 구조화된 상품 카피 생성 | content job, Structured Outputs, 가격 불변 |
| [18 상품 콘텐츠 검수](18-product-content-review.md) | AI 원본 보존과 편집·승인 revision 관리 | schema 재검증, 승인, Shopify job |
| [19 Shopify 등록 worker](19-shopify-publication-worker.md) | 승인 콘텐츠를 Shopify draft 상품으로 동기화 | productSet, handle 멱등성, 오류 분류 |
| [20 Printful-Shopify variant](20-printful-shopify-variants.md) | 실제 variant 조합과 외부 이미지 매핑 | options, SKU, metafield, FileSetInput |
| [21 Printful mockup](21-printful-mockup-pipeline.md) | 디자인 mockup 비동기 생성과 Shopify 발행 gate | task, polling, webhook, snapshot |
| [22 Shopify 주문 ingress](22-shopify-order-ingress.md) | 주문 webhook 검증과 1차 자동화 안전 판정 | HMAC, deduplication, mapping, exception queue |
| [23 Printful 주문 worker](23-printful-order-worker.md) | draft 생성, 실제 비용 재검증과 안전한 confirm | lease, async costs, margin gate, retry |
| [24 Fulfillment 파이프라인](24-fulfillment-pipeline.md) | Printful 부분 배송과 Shopify fulfillment 동기화 | shipment webhook, tracking, GraphQL, retry |
| [25 주문 예외 큐 API](25-order-exception-api.md) | 관리자 재검증·승인·거절과 감사 추적 | idempotency, reason, audit, safe requeue |
| [26 관리자 주문 대시보드](26-admin-order-dashboard.md) | 주문 예외 검수와 운영 액션 웹 화면 | responsive UI, Bearer auth, CSP, audit actions |
| [27 Operations Overview](27-admin-operations-overview.md) | 전체 자동화 파이프라인 상태와 attention feed | workspace metrics, failures, admin navigation |
| [28 Catalog Review UI](28-admin-catalog-review.md) | 상품 후보 승인과 AI 콘텐츠 revision 검수 | scoring evidence, JSON editor, schema validation |
| [29 Brand Onboarding UI](29-admin-brand-onboarding.md) | 12개 질문, AI 생성 상태와 Brand Profile 승인 | workspace creation, polling, Structured Output |
| [30 Brand Profile 편집 revision](30-brand-profile-editor.md) | 운영자 JSON 보정과 불변 revision 이력 | schema 재검증, provenance, 승인 전환 |
| [31 Brand Profile revision 이력](31-brand-profile-revision-history.md) | 생성·편집·승인본 추적과 과거 revision 조회 | 최신순 API, 상태 식별, 다시 열기 |
| [32 스토어 구성 초안](32-store-configuration-draft.md) | 승인 Brand Profile 기반 템플릿·페이지 초안 | allowlist, 색상 토큰, idempotent 생성 API |
| [33 스토어 구성 검수](33-store-config-review.md) | JSON 편집 revision과 승인 화면 | strict schema, 불변 이력, 단일 승인본 |
| [34 Shopify 스토어 게시 계획](34-shopify-store-publication-plan.md) | 승인 snapshot을 페이지·메뉴 작업으로 변환 | idempotent queue, lease, theme API 제한 |
| [35 Shopify storefront worker](35-shopify-storefront-worker.md) | 페이지·메뉴 handle 기반 create/update | retry safety, userErrors, publish completion |
| [36 Store publication 운영](36-store-publication-operations.md) | Shopify 게시 상태 확인과 실패 복구 | attempts, error, audited requeue |
| [37 디자인·목업 관리자 화면](37-admin-design-mockup-review.md) | 승인 상품의 디자인 등록과 mockup 상태 확인 | placement, technique, style IDs, errors |
| [38 디자인·mockup 복구](38-design-mockup-recovery.md) | 원격 작업 중 디자인 잠금과 실패 재대기 | state guard, reset, audit |
| [39 디자인 파일 검증](39-design-file-validation.md) | 외부 디자인 URL의 SSRF·형식·크기 검사 | DNS, redirect, MIME, 50MB limit |
| [40 디자인 이미지 decoding](40-design-image-decoding.md) | PNG/JPEG 서명과 픽셀 크기 검사 | magic bytes, dimensions, 20k limit |

## 기능 증분 문서

### 디자인 인쇄 규격과 목업 안전장치

- [41 디자인 인쇄 해상도 게이트](41-design-resolution-gate.md)
- [42 디자인 인쇄 규격 운영자 검토](42-design-resolution-review.md)
- [43 Printful 목업 스타일 검증](43-mockup-style-validation.md)
- [44 목업 worker 실행 시점 안전 검증](44-mockup-execution-safety.md)
- [45 관리자 워크스페이스 선택기](45-admin-workspace-selector.md)

### 로컬 미리보기 파이프라인

- [46 미리보기 첫 사용 흐름](46-preview-first-use-flow.md)
- [47 미리보기 상품 후보 파이프라인](47-preview-candidate-pipeline.md)
- [48 미리보기 상품 콘텐츠 파이프라인](48-preview-product-content.md)
- [49 미리보기 디자인 검증](49-preview-design-validation.md)
- [50 미리보기 목업 파이프라인](50-preview-mockup-pipeline.md)
- [51 미리보기 Shopify 상품 게시](51-preview-shopify-publication.md)
- [52 미리보기 주문 수신](52-preview-order-ingress.md)
- [53 미리보기 Printful 주문 자동화](53-preview-printful-order.md)
- [54 미리보기 배송·Fulfillment](54-preview-fulfillment.md)
- [55 관리자 미리보기 자동화 UX](55-admin-preview-automation.md)
- [56 관리자 구축 진행 가이드](56-admin-guided-journey.md)
- [57 미리보기 스토어 페이지 게시](57-preview-storefront-publication.md)

### 관리자 화면 UX와 한국어화

- [58 관리자 스토어 구성 UX](58-admin-store-configuration-ux.md)
- [59 관리자 디자인·목업 UX](59-admin-design-mockup-ux.md)
- [60 관리자 브랜드 온보딩 한국어 UX](60-admin-onboarding-korean-ux.md)
- [61 관리자 상품·콘텐츠 검수 한국어 UX](61-admin-catalog-korean-ux.md)
- [62 관리자 주문·배송 운영 UX](62-admin-order-operations-ux.md)
- [63 운영 현황 상태·알림 UX](63-admin-overview-status-ux.md)
- [64 미리보기 디자인 직접 업로드 기반](64-preview-design-upload-foundation.md)
- [65 미리보기 디자인 직접 업로드 HTTP·UI 연결](65-preview-design-upload-http-ui.md)
- [66 미리보기 디자인 업로드 쿼터](66-preview-upload-quota.md)
- [67 고객 관점 스토어 미리보기](67-customer-storefront-preview.md)

### 외부 연동 연결과 Webhook 준비

- [68 외부 서비스 연동 준비 상태](68-admin-integration-readiness.md)
- [69 암호화된 연동 연결 원장](69-encrypted-integration-connections.md)
- [70 Shopify OAuth 연결 기반](70-shopify-oauth-foundation.md)
- [71 Printful 보안 연결 등록](71-printful-secure-registration.md)
- [72 연동 연결 해제 및 자격 증명 폐기](72-integration-disconnect.md)
- [73 Webhook 운영 준비 상태](73-webhook-readiness.md)
- [74 Shopify 주문 Webhook 구독 동기화](74-shopify-webhook-sync.md)
- [75 Printful v2 Webhook 구독 동기화](75-printful-webhook-sync.md)
- [76 Webhook 수신 상태 모니터](76-webhook-delivery-health.md)

### 개인정보 보호 요청과 SLA 경보

- [77 Shopify 필수 개인정보 보호 Webhook](77-shopify-privacy-webhooks.md)
- [78 Shopify 고객 데이터 제공 내보내기](78-customer-data-export.md)
- [79 Shopify 스토어 삭제 사전 점검](79-shop-redaction-preflight.md)
- [80 Shopify 스토어 데이터 삭제 실행](80-shop-redaction-execution.md)
- [81 개인정보 요청 SLA 모니터링](81-privacy-sla-monitoring.md)
- [82 개인정보 SLA 자동 경보 스캔](82-privacy-sla-alert-scan.md)
- [83 개인정보 SLA 경보 운영 큐](83-privacy-alert-operations.md)
- [84 개인정보 경보 Webhook 전송](84-privacy-alert-webhook-delivery.md)
- [85 개인정보 경보 전송 복구](85-privacy-alert-delivery-recovery.md)

### 주문 취소와 반송 운영

- [86 Shopify 주문 취소 처리](86-shopify-order-cancellation.md)
- [87 Printful 반송 주문 운영](87-printful-return-operations.md)
- [88 반송 케이스 처리 결정](88-return-case-decisions.md)

### 주문 대조(Reconciliation)

- [89 Shopify 주문 상태 Reconciliation](89-shopify-order-reconciliation.md)
- [90 주문 Reconciliation 이슈 운영](90-reconciliation-issue-operations.md)
- [91 Shopify 누락 주문 안전 재수신](91-missing-order-safe-replay.md)
- [92 안전 재수신 주문의 제작 재개 게이트](92-replayed-order-release-gate.md)
- [93 Shopify 취소 상태 불일치 동기화](93-reconciliation-cancellation-sync.md)
- [94 Shopify 결제 상태 불일치 동기화](94-reconciliation-financial-status-sync.md)
- [95 주문 대조 처리 이력](95-reconciliation-audit-history.md)
- [96 주문 대조 이슈 생명주기](96-reconciliation-issue-lifecycle.md)
- [97 운영 현황의 주문 대조 경보](97-overview-reconciliation-alerts.md)
- [98 주문 대조 주기 실행](98-scheduled-order-reconciliation.md)
- [99 주문 대조 주기 실행 원장](99-reconciliation-run-ledger.md)
- [100 중단된 주문 대조 실행 복구](100-reconciliation-interrupted-run-recovery.md)
- [101 주문 대조 실행 장애 경보](101-reconciliation-run-alerts.md)
- [102 주문 대조 스케줄 신선도 경보](102-reconciliation-schedule-freshness.md)
- [103 주문 대조 실행 결과 격리와 오류 정제](103-reconciliation-result-isolation.md)
- [104 주문 대조 주기 실행 이력](104-reconciliation-run-history.md)
- [105 실패한 워크스페이스 재대조](105-reconciliation-workspace-retry.md)
- [106 주문 대조 경보 집계와 워크스페이스 범위](106-reconciliation-alert-count-scope.md)
- [107 주문 대조 실행 상태의 워크스페이스 격리](107-reconciliation-workspace-run-isolation.md)
- [108 주문 대조 스캔 이력](108-reconciliation-scan-history.md)
- [109 주문 대조 스캔 불일치 스냅샷](109-reconciliation-scan-issue-snapshots.md)
- [110 주문 대조 스캔 CSV 내보내기](110-reconciliation-scan-csv-export.md)
- [111 주문 대조 CSV 내보내기 감사](111-reconciliation-export-audit.md)
- [112 주문 대조 CSV 내보내기 사유](112-reconciliation-export-reason.md)
- [113 주문 대조 CSV 내보내기 이력](113-reconciliation-export-history.md)
- [114 주문 대조 CSV 담당자 연동](114-reconciliation-export-operator.md)
- [115 주문 대조 담당자 제어](115-reconciliation-operator-control.md)
- [116 주문 대조 운영 코드 한글화](116-reconciliation-korean-labels.md)
- [117 주문 대조 스캔 상세 페이지네이션](117-reconciliation-scan-detail-pagination.md)
- [118 주문 대조 스캔 상세 유형 필터](118-reconciliation-scan-issue-filter.md)
- [119 주문 대조 스캔 Shopify 주문 검색](119-reconciliation-scan-order-search.md)
- [120 Shopify 주문의 전체 대조 이력 검색](120-reconciliation-scan-order-history-search.md)

### 관리자 인증과 API 보안 경계

- [121 주문 예외 API 인증 경계](121-order-exception-route-auth.md)
- [122 상품 검수 API 인증 경계](122-catalog-route-auth.md)
- [123 운영 관리자 토큰 시작 검증](123-production-admin-token.md)
- [124 브랜드 온보딩 API 인증](124-brand-onboarding-auth.md)
- [125 온보딩 관리자 연결 복구](125-onboarding-auth-recovery.md)
- [126 온보딩 관리자 토큰 검증](126-onboarding-token-verification.md)
- [127 관리자 API 캐시 정책](127-admin-api-cache-policy.md)
- [128 관리자 인증 실패 응답](128-admin-auth-challenge.md)
- [129 관리자 세션 만료 복구](129-admin-session-expiry.md)
- [130 관리자 문서 보안 헤더](130-admin-document-security-headers.md)
- [131 브랜드 온보딩 제출 멱등성](131-brand-onboarding-idempotency.md)

### 출시 준비와 배포 게이트

- [132 E2E 파일럿 준비 체크리스트](132-e2e-pilot-readiness.md)
- [133 공개 Webhook 주소 판정](133-public-webhook-readiness.md)
- [134 저장된 Printful 연결의 Webhook 대상 판정](134-stored-printful-webhook-target.md)
- [135 Printful Webhook 서명 준비 조건](135-printful-webhook-signature-readiness.md)
- [136 Printful Webhook HMAC secret 검증](136-printful-webhook-secret-validation.md)
- [137 운영 Printful Webhook secret 시작 검증](137-production-printful-secret-fail-fast.md)
- [138 운영 공개 URL 시작 검증](138-production-public-url-fail-fast.md)
- [139 파일럿 준비 상태 API](139-pilot-readiness-api.md)
- [140 Shopify OAuth 연결 사전점검](140-shopify-oauth-readiness.md)
- [141 Shopify OAuth 운영 기동 차단](141-shopify-oauth-production-fail-fast.md)
- [142 Shopify 배포 전 점검 명령](142-shopify-deployment-preflight.md)
- [143 운영 배포 템플릿 생성](143-production-deployment-templates.md)
- [144 운영 비밀값 배포 게이트](144-deployment-secret-gate.md)
- [145 배포 후 읽기 전용 검증](145-post-deployment-verification.md)
- [146 생존 및 준비 상태 엔드포인트](146-liveness-readiness-endpoints.md)
- [147 무중단 종료와 트래픽 드레이닝](147-graceful-shutdown.md)

### 워크스페이스별 공급사 처리

- [148 워크스페이스별 Shopify 상품 게시](148-workspace-shopify-publication.md)
- [149 워크스페이스별 Shopify 스토어 게시](149-workspace-shopify-store-publication.md)
- [150 워크스페이스별 Printful 목업 처리](150-workspace-printful-mockups.md)
- [151 워크스페이스별 Printful 주문 전달](151-workspace-printful-orders.md)
- [152 워크스페이스별 Printful 카탈로그](152-workspace-printful-catalog.md)
- [153 워크스페이스별 Shopify 배송 반영](153-workspace-shopify-fulfillment.md)

### 토큰 운영·컨테이너·CI·migration

- [154 Shopify 만료형 오프라인 토큰](154-shopify-expiring-offline-tokens.md)
- [155 Shopify 토큰 운영 알림 Webhook](155-shopify-token-alert-webhook.md)
- [156 Shopify 토큰 알림 운영 Scheduler](156-shopify-token-alert-scheduler.md)
- [157 STORZY Production 프로세스 체크리스트](157-production-process-checklist.md)
- [158 배포 후 자동 검증 GitHub Actions](158-post-deploy-github-action.md)
- [159 프로덕션 컨테이너](159-production-container.md)
- [160 CI 품질 게이트](160-ci-quality-gate.md)
- [161 운영 컨테이너 이미지 릴리스](161-container-image-release.md)
- [162 Kubernetes 배포 명세](162-kubernetes-deployment-template.md)
- [163 Kubernetes 운영 배포 workflow](163-kubernetes-deployment-workflow.md)
- [164 안전한 DB migration 실행](164-safe-database-migrations.md)
- [165 DB schema readiness gate](165-schema-readiness-gate.md)
- [166 실행 이미지 식별 검증](166-release-identity-verification.md)
- [167 프로세스 release 일관성](167-process-release-consistency.md)
- [168 배포 직후 scheduler 검증](168-scheduler-deployment-warmup.md)
- [169 CI 실제 PostgreSQL migration 검증](169-ci-real-database-migrations.md)

### 호출 제한, lease 안전성, 실패 복구

- [170 Printful 주문 생성 호출 제한](170-printful-order-rate-limiter.md)
- [171 Shopify GraphQL throttle 처리](171-shopify-graphql-throttle.md)
- [172 Printful 목업 호출 제한 복구](172-printful-mockup-throttle.md)
- [173 Printful 카탈로그 호출 제한 복구](173-printful-catalog-throttle.md)
- [174 Printful 주문 lease 안전성](174-printful-order-lease-safety.md)
- [175 Printful 주문 확정 응답 유실 복구](175-printful-confirmation-recovery.md)
- [176 주문 감사 이력 화면](176-order-audit-history-ui.md)
- [177 Printful 주문 작업 이벤트](177-printful-order-job-events.md)
- [178 제출 완료 주문 이력 조회](178-submitted-order-history.md)
- [179 Shopify 배송 반영 lease 안전성](179-shopify-fulfillment-lease-safety.md)
- [180 Shopify 배송 생성 응답 유실 복구](180-shopify-fulfillment-recovery.md)
- [181 Shopify 배송 작업 이벤트](181-shopify-fulfillment-events.md)
- [182 Shopify 배송 반영 실패 조회](182-fulfillment-failure-operations.md)
- [183 Shopify 배송 반영 수동 재시도](183-fulfillment-manual-requeue.md)
- [184 Shopify 배송 실패 영구 이벤트](184-fulfillment-failed-events.md)
- [185 배송 실패 감사 타임라인 표시](185-fulfillment-failure-timeline.md)

### 개인정보 감사 확장과 Shopify 앱 삭제

- [186 스토어 삭제 감사 데이터 확장 익명화](186-shop-redaction-audit-extensions.md)
- [187 스토어 삭제 감사 데이터 영향 범위](187-shop-redaction-audit-impact.md)
- [188 Shopify 개인정보 Webhook 토픽 계약 검증](188-shopify-privacy-webhook-topic-contract.md)
- [189 개인정보 Webhook 운영 관측](189-privacy-webhook-observability.md)
- [190 개인정보 Webhook 워크스페이스 재연결](190-privacy-webhook-workspace-reconciliation.md)
- [191 Shopify 연결 시 개인정보 요청 자동 재연결](191-shopify-connect-auto-privacy-reconciliation.md)
- [192 Shopify 스토어 단일 워크스페이스 소유권](192-unique-connected-shopify-owner.md)
- [193 Shopify 앱 삭제 안전 처리](193-shopify-app-uninstall-webhook.md)
- [194 앱 삭제 후 `shop/redact` 연속성](194-post-uninstall-shop-redaction-continuity.md)
- [195 스토어 삭제 앱 제거 원장 영향 표시](195-shop-redaction-uninstall-impact-ui.md)
- [196 Shopify 앱 삭제 운영 알림](196-shopify-uninstall-overview-alert.md)
- [197 Shopify 필수 Webhook 동기화](197-shopify-required-webhook-sync.md)
- [198 수동 연결 해제 후 Shopify 앱 삭제](198-manual-disconnect-then-shopify-uninstall.md)
- [199 Shopify 앱 삭제 수신 원장 보존 정책](199-shopify-uninstall-receipt-retention.md)

## 운영 기준 문서

| 문서 | 목적 | 주요 산출물 |
|---|---|---|
| [200 MVP 구현 현황](200-mvp-implementation-status.md) | 완료·조건부 완료·미구현 범위와 출시 차단 항목 구분 | 다음 작업 우선순위, 실환경 E2E, 인증 결정 |
| [201 단일 브랜드 관리자 세션](201-single-brand-admin-session.md) | 파일럿 로그인·HttpOnly 세션·로그아웃과 다중 사용자 확장 경계 | migration 077, 운영 확인 |
| [202 공급사 읽기 전용 smoke](202-provider-readonly-smoke.md) | Shopify·Printful 실제 계정의 인증·scope·카탈로그 무변경 검증 | 외부 쓰기 전 필수 확인 |
| [203 Shopify draft 쓰기 smoke](203-shopify-draft-write-smoke.md) | 개발 스토어에 고정 handle의 비공개 draft 상품을 게시·재검증 | 명시적 실행 확인, 외부 쓰기 |
| [204 Printful catalog 실계약 smoke](204-printful-catalog-contract-smoke.md) | 상품·variant·mockup style·가격·배송 국가의 실제 v2 GET 계약 검증 | 외부 변경 없음 |
| [205 Claude Code 인수인계](205-claude-code-handoff.md) | Codex에서 이어받은 시점의 상태와 다음 작업 순서 | 검증 결과, P0 순서, 선행 조치 |
| [206 티셔츠 목업 E2E 준비](206-tshirt-mockup-e2e-readiness.md) | Printful 티셔츠 상품 규격·디자인 파일 확보와 남은 차단 요인 | product 71, front/dtg, style ID, 공개 URL 선행 조건 |
| [207 배포 runbook](207-deployment-runbook.md) | 공개 HTTPS 배포의 단일 실행 순서 | 비밀값, 템플릿, migration 선행, 15개 역할, 검증, 롤백 |
| [208 variant 매핑 E2E](208-variant-mapping-e2e.md) | Printful variant·목업 이미지의 Shopify 매핑 실환경 검증 | 색상 단위 목업, SKU·metafield, 이미지 비동기, 멱등 재게시 |

## 기계 판독 계약

- [`brand-profile.schema.json`](schemas/brand-profile.schema.json): 온보딩 결과
- [`product-content.schema.json`](schemas/product-content.schema.json): 상품 콘텐츠 생성 결과

스키마 변경은 하위 호환성을 검토하고 `schema_version`을 함께 변경해야 합니다. 프롬프트만 수정해 계약을 바꾸지 않습니다.

## 문서 갱신 규칙

1. 제품 범위 변경은 `01`과 `08`에 함께 반영합니다.
2. 외부 API 버전·권한·필드 변경은 `04`와 관련 테스트를 함께 갱신합니다.
3. 상태 또는 엔터티 변경은 `03`을 먼저 수정한 뒤 DB 마이그레이션을 작성합니다.
4. 주문 자동 승인 규칙 변경은 `06`에 근거와 롤백 방법을 기록합니다.
5. 중요한 기술 결정은 `09`에 날짜와 상태를 남깁니다.
