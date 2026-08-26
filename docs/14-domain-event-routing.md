# 도메인 이벤트 라우팅과 후속 작업

작성일: 2026-08-05

## 1. 목적

outbox event를 단순 로그가 아니라 실제 application workflow에 연결한다.

| Topic | 소비 결과 |
|---|---|
| `brand-profile.generation-requested` | generation job이 원 transaction에서 이미 생성되므로 멱등 소비 기록만 남김 |
| `brand-profile.review-required` | 운영자 검수 알림 생성 |
| `brand-profile.approved` | 상품 후보 생성 job 등록 |

알 수 없는 topic은 무시하지 않고 `UNSUPPORTED_TOPIC` 영구 오류로 dead-letter 처리한다.

## 2. 멱등 소비

마이그레이션: [`005_domain_event_consumers.sql`](../migrations/005_domain_event_consumers.sql)

`event_consumptions`의 `(event_id, consumer_name)` primary key가 동일 consumer의 중복 실행을 막는다.

처리 순서:

1. transaction 시작
2. consumption key 삽입
3. 이미 존재하면 아무 작업 없이 성공
4. topic별 알림 또는 job 삽입
5. transaction commit
6. outbox publisher가 event를 `PUBLISHED`로 표시

consumer transaction이 실패하면 consumption key와 후속 작업이 함께 rollback되므로 안전하게 재시도할 수 있다.

## 3. 검수 알림

`operator_notifications`는 다음 정보를 저장한다.

- workspace와 Brand Profile revision
- 알림 종류·제목·메시지
- unread/read 상태
- correlation ID
- 읽은 actor와 시각

### 조회

```http
GET /api/workspaces/{workspaceId}/notifications?status=UNREAD&limit=50
```

`status`는 `UNREAD` 또는 `READ`, `limit`은 1~100이다.

### 읽음 처리

```http
POST /api/workspaces/{workspaceId}/notifications/{notificationId}/read
Content-Type: application/json

{ "actorId": "operator-1" }
```

현재 `actorId` body 입력은 인증 도입 전 임시 계약이다. 외부 공개는 금지한다.

## 4. 상품 후보 작업

승인 이벤트는 `product_candidate_jobs`에 revision당 하나의 `PENDING` job을 만든다.

저장 필드:

- source event
- workspace
- 승인된 Brand Profile revision
- correlation ID
- 상태·시도·실패 정보

이 단계에서는 상품 후보를 아직 계산하지 않는다. 다음 worker가 승인된 profile, Printful catalog snapshot, scoring rule version을 고정해 후보를 계산한다.

## 5. Publisher 구성

현재 outbox process의 sink 순서:

1. `PostgresDomainEventSink`
2. `LogEventSink`

도메인 처리가 성공해야 로그 sink로 이동하고 최종적으로 outbox event를 published 처리한다. 처리 결과는 event ID 기반으로 멱등하므로 publisher 종료 후 재전달되어도 중복 알림이나 job이 생기지 않는다.

## 6. 검증 결과

- 일반 테스트에서 알림 조회·읽음 API 검증
- 실제 PostgreSQL migration 001~005 적용
- review/approved event 각각 두 번 소비
- 알림 1개, 상품 후보 job 1개만 생성 확인
- consumption key가 event당 1개만 생성됨을 확인
- 실제 PostgreSQL 통합 테스트 4개 통과

## 7. 다음 작업 계약

상품 후보 worker는 다음을 구현해야 한다.

1. `product_candidate_jobs` lease 기반 선점
2. Printful catalog snapshot 동기화
3. 국가 배송 가능성과 product/variant 구분
4. hard constraint 적용
5. 30/25/15/15/10/5 점수 계산
6. 점수 evidence와 rule version 저장
7. 상위 후보를 사용자 검수 상태로 전환

