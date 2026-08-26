# Brand Profile 수직 기능

작성일: 2026-08-05

## 1. 구현 범위

첫 Phase 1 기능으로 다음 흐름을 구현했다.

`Workspace 생성 → 온보딩 제출 → revision/생성 job/outbox 생성 → AI 구조화 → schema 검증 → 검수 대기 → 승인`

승인된 revision은 수정하지 않는다. 다음 revision이 승인되면 직전 승인본은 `SUPERSEDED`가 된다.

## 2. PostgreSQL 모델

마이그레이션: [`migrations/001_initial.sql`](../migrations/001_initial.sql)

- `workspaces`: tenant 경계
- `brand_profiles`: workspace당 하나의 논리적 프로필
- `brand_profile_revisions`: 온보딩과 생성 결과의 불변 버전
- `generation_jobs`: 비동기 AI 생성 작업
- `outbox_events`: DB 변경과 후속 이벤트의 원자적 기록
- `audit_events`: 생성·승인 등 중요 행위

핵심 DB 제약:

- profile별 revision 번호 unique
- profile별 `APPROVED` revision은 최대 하나
- 검수/승인/대체 상태에는 `profile_data` 필수
- 승인자와 승인 시각은 함께 존재하거나 함께 비어 있음
- job과 revision은 1:1
- outbox idempotency key unique

## 3. API

### Workspace 생성

`POST /api/workspaces`

```json
{
  "name": "Seoul Side Studio",
  "actorId": "user-1"
}
```

### 온보딩 제출

`POST /api/workspaces/{workspaceId}/brand-profile-revisions`

```json
{
  "actorId": "user-1",
  "answers": {
    "brandName": "Seoul Side Studio",
    "targetCountries": ["US", "JP"],
    "style": ["Seoul street", "minimal"]
  }
}
```

응답은 `202 Accepted`이며 `GENERATING` revision과 `PENDING` job을 반환한다.

### Revision 조회

`GET /api/brand-profile-revisions/{revisionId}`

### 승인

`POST /api/brand-profile-revisions/{revisionId}/approve`

```json
{ "actorId": "approver-1" }
```

`REVIEW_REQUIRED` 상태만 승인할 수 있다. 생성 중이거나 실패한 revision은 `409 INVALID_REVISION_STATE`를 반환한다.

## 4. 오류 계약

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "name is required"
  }
}
```

- `400`: 잘못된 JSON 또는 입력
- `404`: 리소스 없음
- `409`: 상태 충돌
- `413`: HTTP body 128 KiB 초과
- `500`: 예상하지 못한 서버 오류. 내부 상세는 응답에 노출하지 않음

## 5. 생성 worker 경계

`BrandProfileService.runGeneration`은 `BrandProfileGenerator` 인터페이스에만 의존한다. production 구현은 OpenAI Responses API를 사용하고 테스트는 fixture generator를 사용한다.

처리 규칙:

1. revision이 `GENERATING`인지 확인
2. onboarding answers를 generator에 전달
3. 결과를 `brand-profile.schema.json`으로 검증
4. 성공하면 `REVIEW_REQUIRED`, 실패하면 `GENERATION_FAILED`
5. DB 저장 실패는 생성 실패로 잘못 기록하지 않고 상위 retry 정책으로 전달

generation job 실행과 복구 방식은 [Generation worker](12-generation-worker.md)에 정의한다.

## 6. 현재 인증 가정

`actorId`를 request body로 받는 것은 인증 구현 전의 임시 계약이다. 실제 인증을 도입하면 actor는 서버 세션에서 가져오고 body 필드는 제거한다. 따라서 현재 API를 외부 인터넷에 공개해서는 안 된다.

## 7. 로컬 DB 검증 상태

Docker daemon과 Windows service를 사용하지 않고 작업공간 내부에 일회성 PostgreSQL 16 클러스터를 초기화해 다음을 검증했다.

- `001_initial.sql` 실제 적용
- workspace와 revision 영속화
- generation 결과와 outbox 원자적 저장
- 첫 revision 승인
- 두 번째 revision 승인 시 첫 revision의 `SUPERSEDED` 전환
- revision별 세 개 outbox event의 생성

검증 후 임시 DB 프로세스와 데이터 디렉터리는 제거했다. 지속적인 로컬 개발에는 Docker PostgreSQL 17 구성을 사용한다.

DB가 준비된 환경에서 다음을 실행한다.

```bash
docker compose up -d postgres
$env:DATABASE_URL="postgresql://storzy:storzy@localhost:5432/storzy"
npm run db:migrate
npm run dev
```

별도 test database가 준비된 경우 실제 저장소 통합 테스트를 실행한다.

```bash
$env:TEST_DATABASE_URL="postgresql://storzy:storzy@localhost:5432/storzy_test"
npm run test:db
```
