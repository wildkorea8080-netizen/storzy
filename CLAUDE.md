# CLAUDE.md — STORZY 작업 기준

이 파일은 Claude Code가 이 저장소에서 작업할 때 매 세션 자동으로 읽는 기준 문서다.
이전 개발은 OpenAI Codex에서 진행했고, 2026-08-26부터 Claude Code로 이어받는다.

---

## 1. 제품 한 줄 정의

브랜드 정보를 입력하면 AI가 상품 후보·콘텐츠·스토어 구성을 만들고, 사람이 검수·승인한 뒤
Shopify에 게시하고 Printful로 제작·배송까지 자동화하는 POD(주문제작) 스토어 빌더.

첫 출시 형태는 **단일 브랜드 파일럿**으로 확정됨 (다중 tenant는 파일럿 이후).

---

## 2. 지금 어디까지 왔는가

| 항목 | 상태 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm test` | 196 파일 통과 / 3 skip, 551 테스트 통과 / 7 skip |
| src TypeScript | 226 파일 |
| 테스트 | 199 파일 |
| DB migration | 081번까지 |
| 참조 문서 | `docs/01` ~ `docs/205` |
| Git 커밋 | **0개 (전체 untracked)** — 아래 4절 참고 |

**단일 진실 소스**: 구현 완료 범위와 출시 차단 항목은 항상
[`docs/200-mvp-implementation-status.md`](docs/200-mvp-implementation-status.md)를 기준으로 판단한다.
"이미 만든 기능"과 "아직 없는 기능"을 여기서 먼저 확인하고 작업을 시작한다.

**이어서 할 작업**: [`docs/205-claude-code-handoff.md`](docs/205-claude-code-handoff.md)에
Codex 세션이 중단된 지점과 다음 P0 작업 순서가 정리돼 있다.

---

## 3. 필수 명령

```bash
npm run check        # typecheck + 전체 테스트 + 빌드. 모든 작업의 완료 게이트
npm run typecheck    # tsc --noEmit
npm test             # vitest run (외부 API 호출 없음)
npm run dev          # tsx watch src/server.ts
npm run db:migrate   # migrations/ 순차 적용
```

로컬 미리보기(PostgreSQL + API 영속 실행, Windows PowerShell):

```bash
npm run preview:start
npm run preview:stop
```

worker는 각각 별도 프로세스다: `worker`, `outbox`, `candidate`, `content`, `shopify`,
`mockup`, `printful-order`, `shopify-fulfillment`, `storefront`.

### 실제 공급사 호출(외부 smoke)

기본 테스트 suite와 **분리**돼 있다 (ADR-012). 자격 증명과 명시적 실행이 필요하다.

```bash
npm run providers:smoke          # Shopify·Printful 읽기 전용 인증/scope 확인
npm run printful:catalog-smoke   # Printful v2 카탈로그 실계약 (GET only)
npm run shopify:draft-smoke      # Shopify 개발 스토어에 draft 상품 쓰기 (외부 쓰기!)
```

**외부 쓰기가 발생하는 명령은 실행 전 반드시 사용자에게 확인을 받는다.**

---

## 4. Git 상태 — 먼저 처리할 것

이 저장소에는 **커밋이 하나도 없다.** 226개 src 파일, 199개 테스트, 81개 migration이
전부 untracked 상태다. 실수 한 번으로 전체 작업이 사라질 수 있다.

작업을 시작하기 전에 사용자에게 초기 커밋을 제안한다. `.gitignore`는 이미 `.env`,
`node_modules/`, `dist/`, `.preview/`를 제외하도록 설정돼 있으므로 그대로 쓰면 된다.

이후에는 기능 증분 단위로 커밋한다. 커밋/푸시는 사용자가 요청할 때만 수행한다.

---

## 5. 기술 스택과 코드 규약

- **Node.js 22+**, **TypeScript strict**, **ESM**
- 웹 프레임워크 없음 — `node:http` 위에 [`src/http/app.ts`](src/http/app.ts)가 직접 라우팅
- DB는 `pg` 직접 사용 (ORM 없음), 스키마는 `migrations/*.sql`
- AI는 `openai` SDK, Responses API + Structured Outputs(JSON Schema strict)
- 검증은 `ajv`, 테스트는 `vitest`

### 반드시 지킬 것

1. **import 경로에 `.js` 확장자를 붙인다.** ESM + `moduleResolution` 설정 때문에
   `./config.js`처럼 써야 한다. `.ts`나 확장자 없는 import는 런타임에서 깨진다.
2. **금액·점수·주문 승인 여부는 결정론적 코드가 판단한다** (ADR-005).
   AI는 카피 생성과 이유 설명만 담당한다. 가격 계산이나 자동 승인 판정을
   LLM에 맡기는 코드를 추가하지 않는다.
3. **외부 게시와 주문은 멱등 명령으로 작성한다** (ADR-006). handle/idempotency key
   기반으로 재실행해도 중복이 생기지 않아야 한다.
4. **migration은 forward-only.** 이미 적용된 번호의 SQL을 수정하지 않고 새 번호를 추가한다.
5. **비밀값을 커밋하지 않는다.** `.env`는 gitignore 대상이고, 새 설정은
   `.env.example`에 키만 추가한다.

### 코드 스타일 주의

Codex가 후반부에 작성한 파일들은 import 문에 공백이 없는 압축 스타일이 섞여 있다
(`import{Foo}from"./bar.js"`). 기능상 문제는 없다.
**작업 중인 부분만 주변 스타일에 맞추고, 전체 재포맷은 하지 않는다.**
diff가 커지면 리뷰가 불가능해지고 회귀 원인을 찾을 수 없다.

---

## 6. 문서 규약 — 이게 이 저장소의 핵심 작업 방식

`docs/`는 205개 문서로 이루어진 **번호순 증분 기록**이다. Codex가 기능 하나를 구현할 때마다
문서 한 개를 추가하는 방식으로 진행했고, Claude Code도 이 규약을 그대로 이어간다.

| 번호대 | 성격 |
|---|---|
| `01`–`09` | 제품·아키텍처·도메인·연동·보안 기반 문서. 범위가 바뀔 때만 수정 |
| `10`–`199` | 기능 증분 기록. 한 문서 = 한 기능/한 안전장치 |
| `200`–`204` | 구현 현황, 파일럿 인증, 외부 smoke 운영 문서 |
| `205` | Claude Code 인수인계 |

### 새 기능을 구현할 때

1. [`docs/200`](docs/200-mvp-implementation-status.md)에서 해당 항목의 판정을 확인한다.
   이미 `완료`인 기능을 다시 만들지 않는다.
2. 다음 번호(`206`, `207`…)로 문서를 만들어 **계약·상태·실패 경로**를 먼저 적는다.
3. 구현 + 테스트를 작성한다.
4. [`docs/README.md`](docs/README.md) 인덱스에 새 문서를 추가한다.
5. `docs/200`의 판정을 갱신한다.
6. `npm run check`를 통과시킨다.

### 문서 갱신 규칙 (기존 규약 유지)

1. 제품 범위 변경은 `01`과 `08`에 함께 반영한다.
2. 외부 API 버전·권한·필드 변경은 `04`와 관련 테스트를 함께 갱신한다.
3. 상태 또는 엔터티 변경은 `03`을 먼저 수정한 뒤 DB migration을 작성한다.
4. 주문 자동 승인 규칙 변경은 `06`에 근거와 롤백 방법을 기록한다.
5. 중요한 기술 결정은 `09`에 ADR로 날짜와 상태를 남긴다.
6. 스키마 변경은 하위 호환성을 검토하고 `schema_version`을 함께 올린다.
   프롬프트만 수정해 계약을 바꾸지 않는다.

**문서는 한국어로 작성한다.** 기존 205개 문서가 전부 한국어이므로 일관성을 유지한다.

---

## 7. 테스트 방침

- 기본 suite는 **외부 네트워크를 호출하지 않는다.** fixture와 in-memory adapter를 쓴다.
- 실제 공급사 계약 검증은 별도 smoke 명령으로만 실행한다 (ADR-012).
- migration을 추가하면 해당 migration의 구조를 검증하는 테스트를 함께 만든다
  (`tests/*-migration.test.ts` 패턴 참고).
- 인프라 파일(`.github/workflows/*`, `Dockerfile`, k8s 템플릿)도 테스트가 내용을 검증한다.
  이 파일들을 고치면 `tests/ci-workflow.test.ts` 같은 대응 테스트를 함께 갱신해야 한다.
- 문서도 테스트가 검증한다. `tests/mvp-implementation-status.test.ts`가 `docs/200`,
  루트 `README.md`, `docs/README.md`의 특정 문구를 확인하므로 이 파일들을 수정하면
  테스트를 먼저 확인한다.

**완료 주장 전에 반드시 `npm run check`를 실제로 실행하고 결과를 확인한다.**

---

## 8. 외부 연동 기준

| 대상 | 기준 |
|---|---|
| Shopify | GraphQL Admin API (`2026-07`). REST는 레거시라 쓰지 않는다. Webhook은 HMAC 검증 후 즉시 200 응답하고 큐에 적재한다 (ADR-007) |
| Printful | API v2 우선. v2에 없는 기능만 v1 adapter로 격리한다 (ADR-008) |
| OpenAI | Responses API + Structured Outputs, strict JSON Schema |

Shopify Admin API 토큰은 약 24시간 후 만료될 수 있다. `401`이 나면 재발급이 필요하다.

주문 자동화를 **중단하고 관리자에게 넘겨야 하는** 조건은 `docs/06`에 정의돼 있다:
판매가 < 원가, 배송 불가 국가, 주소 오류, 품절, 공급가 급등, 금액 한도 초과, 디자인 파일 누락.
이 규칙을 우회하는 코드를 작성하지 않는다.

---

## 9. 환경

- **Windows 10 / PowerShell**이 주 셸이다. `scripts/*.ps1`은 PowerShell 전용이다.
- 경로 구분자와 셸 문법이 POSIX와 다르므로 스크립트를 추가할 때 주의한다.
- PostgreSQL은 `docker compose up -d postgres` 또는 `npm run preview:start`로 띄운다.

---

## 10. 작업 시 주의

- **큰 저장소다.** 파일을 찾을 때 전체 탐색보다 `docs/README.md` 인덱스에서
  관련 기능 문서를 먼저 찾고, 그 문서가 지목하는 파일로 이동하는 편이 빠르다.
- **중복 구현을 경계한다.** 205개 문서 대부분이 이미 구현된 기능이다.
  새로 만들기 전에 `docs/200`과 인덱스를 확인한다.
- 사용자와의 대화는 한국어로 진행한다.
