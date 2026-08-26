# Claude Code 인수인계

Codex 세션에서 Claude Code로 개발을 이어받는 시점의 상태와 다음 작업 순서를 기록한다.
기준일은 2026-08-26이다.

## 인수 시점 검증 결과

인수 직후 저장소 상태를 그대로 검증했다.

```text
npm run typecheck   통과
npm test            196 파일 통과 / 3 skip
                    551 테스트 통과 / 7 skip
```

| 항목 | 수량 |
|---|---|
| `src/**/*.ts` | 226 |
| `tests/**/*.test.ts` | 199 |
| `migrations/*.sql` | 081번까지 |
| `docs/*.md` | 205 |

코드베이스는 인수 시점에 회귀 없이 동작한다. 별도 복구 작업 없이 기능 개발을 이어갈 수 있다.

## Codex 세션이 중단된 지점

마지막으로 완료한 작업은 **Printful 카탈로그 실계약 smoke**(`docs/204`)다.
실제 Printful 계정에서 읽기 전용 GET 계약 검증을 통과했다.

```text
Store ID: 18639831
상품: Enhanced Matte Paper Poster (in)
Product ID: 1
인쇄 방식: digital
변형: 33개
목업 스타일: 682개
배송 국가: 220개
통화: USD
가격 범위: $5.39 ~ $21.49
```

이 결과로 `docs/200`에서 다음 두 항목이 `완료`로 전환됐다.

- Printful 카탈로그·결정론적 점수·상품 후보 검수
- Shopify 상품 `productSet` 게시

세션은 다음 작업인 **Printful 실제 목업 생성 E2E** 착수 직전에 중단됐다.

## 인수 시점에 정리한 항목

| 항목 | 조치 |
|---|---|
| `CLAUDE.md` 부재 | 루트에 작업 기준 문서 생성 |
| `docs/README.md` 인덱스 누락 159건 | 전체 205개 문서를 포함하도록 인덱스 재구성 |
| 루트 `README.md` 문서 목록 정체 | 인덱스를 단일 진입점으로 정리 |
| Git 커밋 0개 | 아래 "선행 조치"로 분리 |

## 선행 조치 — Git 이력 확보

저장소에 커밋이 하나도 없다. `src` 226개 파일을 포함한 전체 작업물이 untracked 상태이므로
기능 작업보다 먼저 초기 커밋으로 이력을 확보해야 한다.

`.gitignore`는 이미 `.env`, `node_modules/`, `dist/`, `.preview/`, `.tmp/`,
생성된 k8s 매니페스트를 제외하도록 설정돼 있다. `.env`에는 실제 Shopify·Printful
자격 증명이 들어 있으므로 커밋 전에 제외 여부를 반드시 확인한다.

## 다음 P0 작업 순서

Codex 세션 마지막에 정리한 우선순위를 그대로 이어간다.

### 1. Printful 실제 목업 생성 E2E

주문이나 결제를 발생시키지 않으면서 실제 목업 task를 생성하는 첫 외부 쓰기 검증이다.

- 테스트용 PNG 디자인 파일 준비 (**사용자 제공 필요**)
- Printful 파일 업로드 및 연결
- 제품·variant·인쇄 위치 선택
- mockup task 생성과 완료 상태 polling
- 생성된 이미지 URL 저장

관련 구현: `src/mockups/`, `docs/21`, `docs/43`, `docs/44`, `docs/150`

### 2. 상품 전체 게시 검증

- Printful variant를 포함한 Shopify draft 상품 생성
- 사이즈·색상·SKU 확인
- 이미지·SEO·태그·가격 확인
- 같은 상품 재게시 시 중복이 생기지 않는지 확인

관련 구현: `src/shopify/`, `docs/19`, `docs/20`, `docs/148`

### 3. Shopify 스토어 구성 E2E

- Home, Shop, About, FAQ, Shipping, Returns 페이지 생성
- 컬렉션과 메뉴 구성
- 선택한 테마 설정값 반영
- 기존 설정을 덮어쓰지 않는지 확인

관련 구현: `src/storefront/`, `docs/34`, `docs/35`, `docs/149`

### 4. Printful 주문 draft 검증

- 테스트 수취인으로 주문 draft 생성
- 원가·배송비·통화 확인
- 실제 결제 전 단계에서 중단
- 생성한 테스트 draft 정리

관련 구현: `src/orders/`, `docs/23`, `docs/151`, `docs/175`

## 외부 배포가 필요한 작업

### 5. 공개 HTTPS 배포

Coolify 프로젝트 생성, PostgreSQL 연결, 환경변수·비밀값 설정, 실제 도메인 연결,
DB migration 적용, `/health`·`/ready` 확인.

관련 구현: `docs/143`, `docs/144`, `docs/145`, `docs/146`, `docs/159`

### 6. Shopify 앱 URL 수정

현재 `https://example.com`으로 남아 있는 값을 실제 도메인과 OAuth callback URL로 교체하고,
Shopify 관리자 안에서 앱 화면이 정상 표시되는지 확인한다.

관련 구현: `docs/70`, `docs/140`, `docs/141`, `docs/142`

### 7. Webhook 실환경 검증

Shopify 주문 생성·취소, `app/uninstalled`, 개인정보 필수 Webhook,
Printful 목업·주문·배송 상태. 서명 검증, 중복 방지, 재시도를 함께 확인한다.

관련 구현: `docs/74`, `docs/75`, `docs/77`, `docs/188`, `docs/193`, `docs/197`

### 8. 주문 전체 흐름 E2E

Shopify 주문 수신 → 주소·가격·재고 검증 → Printful draft 생성 →
관리자 승인 또는 자동 처리 → 배송정보 Shopify 반영. 중복 주문이 생기지 않는지 확인한다.

관련 구현: `docs/22`, `docs/23`, `docs/24`, `docs/153`

## 출시 전 확정할 결정값

`docs/09`의 미결정 사항과 `docs/200`의 "출시 결정값 확정" 항목이 같은 목록을 가리킨다.

- 첫 판매 국가와 기준 통화
- 자동 주문 최대 금액과 수량
- 원가 상승 허용 범위
- 배송 불가 국가 정책
- 반품 주소와 비용 책임
- OpenAI 운영 API 키와 비용 한도
- 관리자 계정·쿠키·HTTPS 보안
- Shopify 공개 앱 출시 여부
- Printful Public App 전환 시점
- 백업·복원·장애 대응 절차

## 운영 주의

Shopify Admin API 토큰은 약 24시간 후 만료될 수 있다. 외부 검증 중 `401`이 발생하면
토큰 재발급이 필요하다.

외부 쓰기가 발생하는 명령(`npm run shopify:draft-smoke`, 목업 task 생성, 주문 draft 생성)은
실행 전에 사용자 확인을 받는다.
