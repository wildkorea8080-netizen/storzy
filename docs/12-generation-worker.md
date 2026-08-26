# Brand Profile Generation Worker

작성일: 2026-08-05

## 1. 역할

API가 온보딩 revision과 `PENDING` generation job을 원자적으로 저장하면 별도 worker 프로세스가 job을 선점해 OpenAI Structured Outputs 생성을 실행한다.

```text
PENDING → RUNNING → SUCCEEDED
                  ↘ PENDING (retry)
                  ↘ FAILED
```

API 프로세스는 OpenAI 호출을 직접 기다리지 않는다.

## 2. 선점과 lease

마이그레이션: [`002_generation_job_leases.sql`](../migrations/002_generation_job_leases.sql)

- `FOR UPDATE SKIP LOCKED`로 여러 worker가 서로 기다리지 않고 다른 job을 선점한다.
- 선점 시 `locked_by`, `lease_expires_at`, `attempts`를 기록한다.
- 실행 중 lease 기간의 약 1/3마다 heartbeat를 갱신한다.
- 다른 worker는 유효한 lease의 job을 변경할 수 없다.
- worker가 종료되면 lease 만료 후 다른 worker가 job을 회수한다.
- 마지막 허용 시도에서 종료된 job은 회수 후 생성 호출 없이 `LEASE_EXHAUSTED`로 종결해 고아 job을 방지한다.

기본값:

| 설정 | 기본값 |
|---|---:|
| `GENERATION_LEASE_SECONDS` | 120초 |
| `GENERATION_MAX_ATTEMPTS` | 4회 |
| `WORKER_POLL_MS` | 1,000ms |

## 3. 재시도 정책

다음 오류는 일시적 오류로 분류한다.

- HTTP 408, 409, 429
- HTTP 5xx
- OpenAI SDK connection/timeout 오류
- `ECONNRESET`, `ETIMEDOUT`, `EAI_AGAIN`

JSON Schema 실패와 기타 4xx는 영구 실패로 처리한다. 알 수 없는 오류는 안전하게 영구 실패가 기본이다.

backoff는 첫 시도 5초에서 시작해 시도마다 두 배가 되며 최대 5분이다. 동시 재시도 집중을 피하기 위해 ±20% jitter를 적용한다.

## 4. 원자성과 실패 경계

- API의 revision/job/outbox 생성은 한 DB transaction이다.
- 생성 성공 시 revision의 `REVIEW_REQUIRED`, job의 `SUCCEEDED`, review outbox event가 한 transaction에서 저장된다.
- 영구 실패 시 revision과 job을 함께 `FAILED` 계열 상태로 변경한다.
- 일시적 생성 오류에는 revision을 실패 처리하지 않고 job만 미래 `available_at`으로 되돌린다.
- 생성 결과 저장 자체가 실패한 경우 이를 AI 생성 실패로 잘못 기록하지 않고 worker 상위 오류로 전달한다.
- 성공 저장 후 별도 acknowledge가 실패해도 job은 이미 `SUCCEEDED`이므로 재생성되지 않는다.

## 5. 실행

DB migration을 적용하고 환경 변수를 설정한 다음 API와 worker를 별도 프로세스로 실행한다.

```powershell
$env:DATABASE_URL="postgresql://storzy:storzy@localhost:5432/storzy"
$env:OPENAI_API_KEY="..."
$env:OPENAI_MODEL="gpt-5.6"
npm run worker
```

`OPENAI_API_KEY`가 없으면 worker는 즉시 명확한 오류로 종료한다. API 서버와 fixture 테스트에는 키가 필요하지 않다.

production build:

```bash
npm run build
npm run start:worker
```

## 6. 관찰 가능성 후속 작업

현재 오류는 stderr에 기록한다. production 전 다음을 추가해야 한다.

- job ID, revision ID, worker ID가 포함된 structured log
- claim/성공/retry/실패/lease-loss metric
- queue age와 exhausted job alert
- OpenAI request ID, latency, token usage 저장
- dead-letter 운영 화면과 관리자 재생 명령

## 7. 검증

단위 테스트:

- 동시 worker의 active lease 차단
- lease 만료 후 재선점
- 소유하지 않은 worker의 retry/heartbeat 차단
- 일시적 오류의 예약 재시도
- schema 오류의 즉시 영구 실패
- 최대 시도와 마지막 lease 손실 종결
- backoff 상한과 jitter

실제 PostgreSQL 통합 테스트:

- `001`, `002` migration 적용
- 두 worker의 동시 claim 중 하나만 성공
- retry 후 다른 worker로 소유권 이전

