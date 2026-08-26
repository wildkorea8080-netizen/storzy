# 배포 runbook

`docs/143`~`147`, `157`, `159`, `164`~`168`에 나뉘어 있는 절차를 실제 배포 순서 하나로 합친 문서다.
Coolify를 기준으로 쓰되 Docker 이미지를 실행할 수 있는 플랫폼이면 같은 순서를 적용한다.
Kubernetes로 배포할 때는 `docs/162`, `docs/163`의 매니페스트와 workflow를 대신 사용한다.

각 단계는 **선행 조건을 만족해야 다음으로 넘어간다.** 특히 4단계(migration)와 5단계(workload)의
순서를 바꾸면 `/ready`가 계속 `503`을 반환한다.

## 0. 시작 전 확정할 값

| 값 | 출처 | 비고 |
|---|---|---|
| 공개 HTTPS 도메인 | Coolify 서브도메인 또는 직접 등록 | 이후 모든 URL이 이 origin으로 고정된다 |
| Shopify Client ID | Shopify Partner 대시보드에서 앱 생성 | `SHOPIFY_API_SECRET`과 함께 발급된다 |

이 두 값이 없으면 1단계를 실행할 수 없다. 도메인을 나중에 바꾸면 Shopify 앱 설정과
Webhook 주소를 모두 다시 배포해야 하므로 처음부터 확정한다.

## 1. 비밀값 생성

템플릿은 `__SECRET_*__` 자리표시자만 만들고 실제 값은 만들지 않는다. 랜덤 값 4개는 로컬에서 만든다.

```bash
node -e "const c=require('node:crypto');console.log('ADMIN_API_TOKEN='+c.randomBytes(32).toString('hex'));console.log('SHOPIFY_WEBHOOK_SECRET='+c.randomBytes(32).toString('hex'));console.log('PRINTFUL_WEBHOOK_SECRET_HEX='+c.randomBytes(32).toString('hex'));console.log('INTEGRATION_CREDENTIAL_KEY_BASE64='+c.randomBytes(32).toString('base64'))"
```

출력을 파일로 저장하거나 대화에 남기지 않는다. 배포 플랫폼의 Secret Manager에 직접 입력한다.

나머지 비밀값의 출처는 다음과 같다.

| 키 | 출처 | 형식 게이트 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 인스턴스 | — |
| `ADMIN_API_TOKEN` | 위 명령 | 32자 이상 |
| `OPENAI_API_KEY` | OpenAI 계정 | — |
| `SHOPIFY_API_SECRET` | Partner 대시보드 | — |
| `SHOPIFY_WEBHOOK_SECRET` | 위 명령 | — |
| `PRINTFUL_WEBHOOK_SECRET_HEX` | 위 명령 | 32바이트 이상 hex |
| `INTEGRATION_CREDENTIAL_KEY_BASE64` | 위 명령 | 32바이트 base64 |

`docs/144`의 배포 게이트는 `__SECRET_*__` 값이 남아 있으면 길이와 무관하게 거부한다.

## 2. 배포 템플릿 생성

먼저 `--write` 없이 출력만 확인한다.

```bash
npm run deploy:template -- https://app.example.com SHOPIFY_CLIENT_ID
```

출력이 올바르면 파일을 만든다. 기존 파일이 있으면 덮어쓰지 않고 실패한다.

```bash
npm run deploy:template -- https://app.example.com SHOPIFY_CLIENT_ID --write
```

생성되는 파일은 세 개다.

- `.env.production.template` — 환경 변수 목록과 비밀값 자리표시자
- `shopify.app.toml` — 앱 URL, OAuth redirect, Webhook 구독
- `storzy.processes.json` — 15개 역할의 실행 명령

생성기는 공개 URL을 HTTPS origin으로 제한하고 OAuth callback을 같은 origin으로 고정한다.

## 3. PostgreSQL 준비

PostgreSQL 17을 기준으로 한다. 인스턴스를 만들고 접속 문자열을 `DATABASE_URL`로 확보한다.
애플리케이션 컨테이너와 같은 사설 네트워크에 두고 공개 인터넷에 노출하지 않는다.

이 시점에는 schema가 비어 있어도 된다. migration은 4단계에서 실행한다.

## 4. 이미지 빌드

모든 역할이 **같은 image digest**를 사용해야 API와 worker의 코드·DB 계약이 일치한다(`docs/167`).

```bash
docker build --pull -t storzy:release .
```

빌드에는 `docs/schemas`의 JSON 계약이 포함되어야 한다. `.dockerignore`가 `docs`를 제외하므로
`!docs/schemas` 예외와 Dockerfile의 `COPY docs/schemas`가 함께 있어야 하며,
`tests/production-container.test.ts`가 이 조건을 검증한다.

레지스트리에 올린 뒤 digest를 기록하고 모든 역할의 `STORZY_RELEASE`에 주입한다.
`/health` 응답이 이 값을 그대로 반환하므로 배포 후 검증에서 대조할 수 있다(`docs/166`).

## 5. Migration 실행 — workload보다 먼저

애플리케이션 컨테이너는 시작할 때 migration을 자동 실행하지 않는다. 일회성 job으로 먼저 돌린다.

```bash
docker run --rm --env DATABASE_URL=... storzy:release node dist/src/db/migrate.js
```

Runner는 session advisory lock을 잡으므로 동시에 실행해도 하나만 schema를 변경한다.
각 SQL은 적용과 이력 기록을 한 transaction으로 처리하며, 이미 적용된 파일의 내용이 바뀌면
checksum 불일치로 즉시 중단한다(`docs/164`).

**이 job이 성공한 뒤에만 6단계로 넘어간다.** API의 `/ready`는 이미지에 포함된 migration 목록과
`schema_migrations`를 대조하므로, 순서를 바꾸면 모든 인스턴스가 `503`을 반환하고
트래픽을 받지 못한다(`docs/165`).

## 6. 15개 역할 배포

`storzy.processes.json`의 `command`로 컨테이너 기본 명령을 덮어쓴다. 모두 같은 이미지를 쓴다.

### service (1개)

| 이름 | 명령 |
|---|---|
| `api` | `node dist/src/process-supervisor.js api service npm start` |

### worker (9개)

| 이름 | 명령 |
|---|---|
| `generation` | `... generation worker npm run start:worker` |
| `outbox` | `... outbox worker npm run start:outbox` |
| `candidate` | `... candidate worker npm run start:candidate` |
| `content` | `... content worker npm run start:content` |
| `mockup` | `... mockup worker npm run start:mockup` |
| `shopify-product` | `... shopify-product worker npm run start:shopify` |
| `shopify-storefront` | `... shopify-storefront worker npm run start:storefront` |
| `printful-order` | `... printful-order worker npm run start:printful-order` |
| `shopify-fulfillment` | `... shopify-fulfillment worker npm run start:shopify-fulfillment` |

`...`은 `node dist/src/process-supervisor.js`다. 정확한 값은 생성된 `storzy.processes.json`을 따른다.

### scheduler (5개)

| 이름 | cron | 명령 |
|---|---|---|
| `privacy-sla-scan` | `0 * * * *` | `... privacy-sla-scan scheduler npm run start:privacy-sla:scan` |
| `privacy-alert-delivery` | `*/5 * * * *` | `... privacy-alert-delivery scheduler npm run start:privacy-alerts:deliver` |
| `order-reconciliation` | `0 * * * *` | `... order-reconciliation scheduler npm run start:order-reconciliation:scan` |
| `shopify-token-alert-delivery` | `*/5 * * * *` | `... shopify-token-alert-delivery scheduler npm run start:shopify-token-alerts:deliver` |
| `admin-auth-retention` | `*/5 * * * *` | `... admin-auth-retention scheduler npm run start:admin-auth:cleanup` |

scheduler는 중복 실행되지 않도록 설정한다. Kubernetes에서는 `concurrencyPolicy: Forbid`다.

### 상태 검사 설정

- liveness probe: `GET /health` — 실패하면 프로세스를 재시작한다
- readiness probe: `GET /ready` — 실패하면 신규 트래픽을 보내지 않는다

종료 신호를 받으면 readiness가 먼저 draining으로 바뀌어 `/ready`가 즉시 `503`을 반환한다.
그 뒤 `SHUTDOWN_DRAIN_MS`(기본 5초) 동안 대기하고 기존 연결을 마친 뒤 종료한다(`docs/147`).
`SHUTDOWN_TIMEOUT_MS`(기본 30초)는 반드시 드레이닝 시간보다 커야 한다.

## 7. Scheduler 워밍업

시간별 CronJob은 다음 정규 실행까지 최대 1시간 동안 이전 release의 heartbeat를 남긴다.
배포 직후 5개 scheduler를 일회성으로 한 번씩 실행해 새 release heartbeat를 만든다(`docs/168`).

각 scheduler는 재실행 안전성과 DB lease를 유지하므로 즉시 실행해도 중복 처리가 생기지 않는다.

## 8. 배포 전 점검

비밀값이 주입된 환경에서 실행한다.

```bash
npm run deploy:preflight
```

`shopify.app.toml`과 `storzy.processes.json`이 있어야 하며, `DEPLOYMENT_SECRETS` 항목이
실제 값 주입 여부를 확인한다. 어느 그룹이 미완료인지만 알려주고 값 자체는 출력하지 않는다.

통과하면 Shopify CLI로 앱 설정을 배포한다.

## 9. 배포 후 검증

```bash
npm run deploy:verify -- https://app.example.com [workspaceId]
```

health, readiness, 관리자 보안 헤더와 인증, 파일럿 상태를 읽기 전용으로 확인한다.
기본 10초 간격으로 최대 12회 프로세스 상태를 조회하며 **15개 역할 중 누락·지연·실패가 있으면
종료 코드 `1`**을 반환한다. 관리자 토큰은 Secret Manager에서 주입하고 출력하지 않는다.

`STORZY_RELEASE`가 기대 digest와 다르면 `RELEASE_MISMATCH`로 판정한다(`docs/167`).
로드밸런서가 이전 인스턴스를 가리키거나 역할별 이미지가 섞인 상황을 여기서 잡는다.

## 10. 롤백

이전 이미지 digest로 workload만 되돌린다. **DB는 되돌리지 않는다.**

migration은 forward-only이므로 이전 코드가 새 schema와 호환되는지 먼저 확인해야 한다.
호환되지 않으면 롤백 대신 수정한 새 이미지로 다시 배포한다(`docs/165`).

## 배포 후 이어지는 작업

공개 HTTPS 배포는 다음 P0 항목의 공통 선행 조건이다. 배포가 끝나면 순서대로 진행한다.

1. Shopify 앱 URL과 OAuth callback을 실제 도메인으로 교체 (`docs/140`~`142`)
2. 디자인 파일을 공개 URL로 제공하고 Printful 목업 E2E 실행 (`docs/206`)
3. Shopify·Printful Webhook 실환경 수신 검증 (`docs/74`, `75`, `77`, `188`, `193`, `197`)
4. 주문 수신부터 배송 반영까지 전체 흐름 E2E (`docs/22`~`24`, `153`)

## 로컬에서 미리 확인한 것

배포 전에 다음을 로컬 컨테이너로 검증했다. 서버에서 처음 만나는 문제를 줄인다.

```text
이미지 빌드      storzy:release  359MB
migration       081번까지 적용
기동            2초
/health         status ok
/ready          status ready, database true, schema true
GET /admin      200
GET /api/admin  401
```

운영 모드 전체 재현은 불가능하다. `PUBLIC_APP_URL`이 공개 HTTPS여야 하고 `localhost`를
명시적으로 거부하므로(`docs/138`), 로컬 검증은 `NODE_ENV=development`로 수행한다.

### 알려진 함정

- **`docs/schemas` 누락**: `.dockerignore`가 `docs`를 제외하면 `schema-registry`의 JSON import가
  깨져 이미지 빌드가 실패한다. 로컬 `npm run build`는 통과하므로 컨테이너 빌드에서만 드러난다.
- **PostgreSQL 포트 충돌**: 다른 프로젝트가 5432를 쓰면 `docker compose up`이 실패한다.
  격리된 network와 포트를 쓴다.
- **메모리 부족**: Docker와 함께 `npm test`를 돌리면 vitest가 메모리 부족으로 죽는다.
  `npx vitest run --maxWorkers=1`로 실행한다.
