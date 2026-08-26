# STORZY

브랜드 정보를 입력하면 상품 후보와 콘텐츠를 만들고, 검수 후 Shopify와 Printful에 연결하는 AI 기반 POD 스토어 빌더입니다.

현재 저장소는 온보딩부터 상품·스토어 생성, Shopify/Printful 연동, 주문·배송 자동화와 개인정보 운영까지 이어지는 **실행 가능한 MVP 기반**입니다. 로컬 미리보기에서는 전체 흐름을 검증할 수 있으며, 실제 출시 전에는 사용자·워크스페이스 권한 모델 확정과 개발 스토어·Printful 테스트 계정을 사용한 공급사 E2E 검증이 필요합니다.

구현 완료 범위와 출시 차단 항목은 [MVP 구현 현황](docs/200-mvp-implementation-status.md)을 단일 기준으로 사용합니다.

## 로컬 실행

요구사항은 Node.js 22 이상과 npm입니다.

```bash
npm install
npm run check
npm run dev
```

웹 미리보기용 PostgreSQL과 API를 영속 실행하려면 다음 명령을 사용합니다. 기본 관리자 토큰은 로컬 전용 `preview-admin`입니다.

```bash
npm run preview:start
npm run preview:stop
```

DB가 준비되면 다음 명령으로 스키마를 적용합니다.

```bash
npm run db:migrate
```

Brand Profile 생성 worker는 별도 프로세스로 실행합니다. `OPENAI_API_KEY`가 필요합니다.

```bash
npm run worker
```

outbox publisher도 별도 프로세스로 실행합니다.

```bash
npm run outbox
```

승인된 Brand Profile의 상품 후보 생성 worker는 Printful token과 검수된 catalog seed가 필요합니다.

```bash
npm run candidate
```

승인 후보의 상품 콘텐츠 생성 worker는 별도 프로세스로 실행합니다.

```bash
npm run content
```

승인된 콘텐츠를 Shopify draft 상품으로 등록하는 worker입니다.

```bash
npm run shopify
```

Printful 주문과 Shopify 배송 반영 worker는 각각 별도 프로세스로 실행합니다.

```bash
npm run printful-order
npm run shopify-fulfillment
```

관리자 운영 Overview는 `GET http://localhost:3000/admin`, 주문 예외 화면은 `GET http://localhost:3000/admin/orders`에서 접근합니다. 운영 환경에서는 `ADMIN_API_TOKEN`을 반드시 설정하고 화면에서 workspace UUID와 토큰을 연결합니다.

서버 상태는 `GET http://localhost:3000/health`에서 확인합니다. PostgreSQL이 필요한 기능을 개발할 때는 `docker compose up -d postgres`를 실행합니다. 비밀키는 커밋하지 않고 [`.env.example`](.env.example)을 기준으로 로컬 환경에 설정합니다.

## 문서 시작점

전체 205개 참조 문서는 [문서 인덱스](docs/README.md)에서 번호순으로 관리합니다. 작업을 시작할 때는 다음 순서로 확인합니다.

1. [MVP 구현 현황과 출시 차단 항목](docs/200-mvp-implementation-status.md) — 무엇이 이미 완료됐고 무엇이 남았는지 판단하는 단일 기준
2. [Claude Code 인수인계](docs/205-claude-code-handoff.md) — 현재 진행 상황과 다음 P0 작업 순서
3. [문서 인덱스](docs/README.md) — 기능별 상세 문서 탐색

기반 설계 문서는 다음과 같습니다.

- [MVP 제품 요구사항](docs/01-mvp-prd.md)
- [시스템 아키텍처](docs/02-architecture.md)
- [도메인 모델과 상태](docs/03-domain-model.md)
- [외부 연동 계약](docs/04-integrations.md)
- [AI 및 상품 점수 설계](docs/05-ai-and-scoring.md)
- [주문 자동화와 운영](docs/06-order-operations.md)
- [보안·개인정보·신뢰성](docs/07-security-reliability.md)
- [개발 로드맵](docs/08-delivery-roadmap.md)
- [결정 및 미결정 사항](docs/09-decisions-and-open-questions.md)

AI 코딩 도구로 작업할 때의 규약은 루트 [`CLAUDE.md`](CLAUDE.md)에 정리돼 있습니다.

## 현재 기준

- 작성 기준일: 2026-08-21
- Shopify: GraphQL Admin API 및 HTTPS Webhook
- Printful: API v2 우선, v2에 없는 기능만 v1 사용 여부를 구현 시점에 검토
- OpenAI: Responses API + Structured Outputs(JSON Schema, strict mode)
- 핵심 원칙: 생성과 설명은 AI, 금액·점수·주문 승인 여부는 결정론적 코드
