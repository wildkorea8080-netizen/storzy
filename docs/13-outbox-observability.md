# Outbox Publisher와 관찰 가능성

작성일: 2026-08-05

## 1. 구현 범위

- outbox event의 `SKIP LOCKED` 선점
- publisher lease와 장애 후 회수
- 지수 backoff 재시도와 dead-letter
- 운영 CLI를 통한 dead-letter 조회·재큐잉
- 재큐잉 actor·사유 감사 기록
- HTTP `X-Request-ID` 생성·전파
- JSON structured logging
- OpenAI request ID·latency·token usage 저장

관련 migration:

- [`003_outbox_delivery_and_telemetry.sql`](../migrations/003_outbox_delivery_and_telemetry.sql)
- [`004_outbox_operations_audit.sql`](../migrations/004_outbox_operations_audit.sql)

## 2. Correlation 흐름

```text
X-Request-ID
  → HTTP log
  → generation_jobs.correlation_id
  → outbox_events.correlation_id
  → generation/outbox worker log
```

클라이언트의 `X-Request-ID`는 영숫자와 `._:-`만 허용하고 최대 128자이다. 유효하지 않거나 없으면 서버가 UUID를 생성하며 응답 header에도 반환한다.

## 3. OpenAI telemetry

generation job 성공 시 다음 필드를 저장한다.

- provider request ID
- API 호출 latency(ms)
- input tokens
- output tokens
- total tokens

API key, 입력 prompt, 전체 onboarding 답변은 structured log에 기록하지 않는다. outbox log sink도 payload 전체를 출력하지 않고 event/aggregate/correlation 식별자만 남긴다.

## 4. Outbox 전달

outbox publisher는 API와 generation worker와 별도 프로세스이다.

```bash
npm run outbox
```

기본 설정:

| 설정 | 기본값 |
|---|---:|
| `OUTBOX_LEASE_SECONDS` | 60초 |
| `OUTBOX_MAX_ATTEMPTS` | 8회 |
| `OUTBOX_POLL_MS` | 1,000ms |

현재 기본 sink는 구조화 로그 sink이다. 내부 event 전달과 lifecycle을 검증하기 위한 MVP 기반이며, 이메일·알림·외부 broker 등 실제 소비자가 정해지면 `EventSink` 구현을 교체한다. sink가 성공을 반환한 뒤에만 event가 `PUBLISHED`가 된다.

outbox 전달은 at-least-once이다. sink가 전달에는 성공했지만 DB의 published 표시 전에 프로세스가 종료될 수 있으므로, 향후 모든 외부 sink는 event ID를 idempotency key로 사용해야 한다.

## 5. Dead-letter 운영

조회:

```bash
npm run outbox:dead-letters
npm run outbox:dead-letters -- 100
```

재큐잉:

```bash
npm run outbox:requeue -- <event-uuid> <actor-id> "재처리 사유"
```

재큐잉은 다음을 한 transaction에서 수행한다.

1. event가 현재 `DEAD_LETTER`인지 확인
2. `PENDING`, attempts 0, 즉시 실행 가능 상태로 변경
3. `outbox_event_actions`에 actor, action, reason 기록

인증 없는 HTTP 관리 endpoint는 의도적으로 만들지 않았다. production에서는 운영 CLI 실행 권한도 제한해야 한다.

## 6. 로그 형식

각 로그는 한 줄 JSON이다.

```json
{
  "timestamp": "2026-08-05T00:00:00.000Z",
  "level": "info",
  "message": "outbox.published",
  "service": "storzy-outbox",
  "eventId": "...",
  "correlationId": "..."
}
```

Error 객체는 name, message, stack으로 정규화한다. production log collector에서 보존 기간과 접근 권한을 별도로 적용해야 한다.

## 7. 알려진 후속 작업

- 실제 message broker 또는 notification sink 선택
- sink별 idempotency 저장소와 계약 테스트
- metrics exporter와 tracing backend 연결
- 운영 대시보드와 queue-age/dead-letter 경보
- OpenAI 비용 계산용 model price snapshot
- log field allowlist와 중앙 redaction 정책 강화

