# Phase 0 구현 기록

작성일: 2026-08-05

## 1. 구현된 기반

- Node.js 22+ / TypeScript strict mode 프로젝트
- 빌드, 타입 검사, Vitest 단위·계약 테스트
- PostgreSQL 17 로컬 Docker 구성
- 환경 변수 예시와 비밀키 제외 규칙
- minor unit와 `bigint` 기반 Money 및 마진 계산
- 문서의 30/25/15/15/10/5 가중치를 반영한 상품 점수 엔진
- 주문 차단·검수·대기·중복 처리 결정 엔진
- Shopify versioned GraphQL client와 `productSet` mutation 골격
- Shopify raw-body HMAC 검증
- Printful v2 catalog/mockup/draft order/confirm client 골격
- Printful v2 webhook hex-key HMAC 검증
- OpenAI Responses API Structured Outputs client
- 문서 JSON Schema를 사용하는 AJV 2020 런타임 검증
- `/health` HTTP endpoint

## 2. 코드 구조

```text
src/
  ai/                JSON Schema registry
  domain/            money, scoring, order policy
  integrations/      OpenAI, Shopify, Printful adapters
  config.ts          non-secret runtime configuration
  server.ts          HTTP process entry point
tests/
  fixtures/           canonical AI output fixtures
  *.test.ts           deterministic unit and contract tests
```

## 3. 검증 명령

```bash
npm run check
```

이 명령은 TypeScript typecheck, 전체 테스트, production build를 차례로 실행한다. 기본 테스트는 네트워크와 실제 provider key를 사용하지 않는다.

서버 확인:

```bash
npm run build
npm start
# 별도 터미널
curl http://localhost:3000/health
```

## 4. 외부 smoke test 전제

다음 작업은 사용자 소유의 개발 계정과 자격 증명이 있어야 완료할 수 있다.

### Shopify

- 앱 배포 형태: 공개 앱 또는 첫 pilot용 custom app 결정
- 개발 store 생성 및 앱 설치
- GraphQL Admin API access token과 scope 확보
- `shop { name }` query 및 draft product 1개 `productSet`
- `orders/create` 테스트 webhook과 HMAC fixture 캡처

### Printful

- private token 또는 OAuth 연결 방식 결정
- store ID 확인
- catalog product/variant 조회
- 테스트 디자인으로 v2 mockup task 생성
- 비용이 확정되지 않는 draft order 생성과 삭제/만료 정책 확인
- v2 webhook 설정의 public/secret key와 실제 signature fixture 캡처

### OpenAI

- project-scoped API key와 월 지출 한도 설정
- 선택 모델에 BrandProfile schema가 acceptance되는지 확인
- canonical fixture 입력 1건으로 structured response 생성
- refusal, incomplete response, rate limit fixture 확보

## 5. 모델 기본값

공식 최신 모델 resolver는 2026-08-05 기준 GPT-5.6 계열을 가리켰다. STORZY의 기본 생성 모델은 `gpt-5.6`으로 환경 변수화했으며, 품질·비용 평가 전까지 영구 결정으로 보지 않는다. 코드 생성 전용 성격의 변형을 상품 카피 기본값으로 자동 채택하지 않는다.

## 6. 알려진 제한

- OAuth, 세션, DB schema, queue/outbox는 아직 구현되지 않았다.
- `productSet` input mapping과 userErrors 정책은 개발 store fixture가 필요하다.
- Printful payload 타입은 공식 OpenAPI 또는 캡처 fixture로 구체화해야 한다.
- Webhook HTTP route는 raw body parser와 event store를 함께 도입할 Phase 1 기반 작업에서 연결한다.
- score의 target/shipping/design/variety/return 입력값 산정 lookup table은 아직 없다.
- 주문 policy 임계값은 샘플 원가와 사업 승인이 필요하다.

## 7. 다음 구현 순서

1. PostgreSQL migration 도구와 workspace/brand revision schema
2. transactional outbox와 worker interface
3. 온보딩 API 및 BrandProfile 생성 job
4. Shopify OAuth 또는 pilot custom-app 연결
5. provider smoke fixture를 계약 테스트에 고정

