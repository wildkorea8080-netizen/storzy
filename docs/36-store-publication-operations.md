# Store publication 운영

## 조회

`GET /api/workspaces/{workspaceId}/store-drafts` 응답은 Store Config revision과 함께 다음 게시 정보를 제공한다.

- `publicationStatus`: PENDING, RUNNING, SUCCEEDED, FAILED 또는 null
- `publicationAttempts`: worker 시도 횟수
- `publicationError`: 마지막 정규화 오류 코드

`/admin/store`에서는 revision별 Shopify 상태 배지와 실패 원인을 표시한다.

## 실패 재대기

`POST /api/workspaces/{workspaceId}/store-drafts/{draftId}/publication/requeue`

요청에는 `actorId`와 1~500자의 `reason`이 필요하다. FAILED job만 재대기할 수 있으며 다음 변경을 하나의 transaction으로 처리한다.

- status를 PENDING으로 변경
- attempts를 0으로 초기화
- last error와 finished time 제거
- 즉시 claim할 수 있도록 available time 변경
- 운영자, 사유, 전후 상태를 audit event로 저장

RUNNING이나 이미 성공한 job의 재대기는 `PUBLICATION_NOT_FAILED` 충돌로 거부한다. 외부 API timeout 여부와 Shopify 상태를 확인한 뒤에만 운영자가 재대기해야 한다. worker는 고정 handle upsert를 사용하므로 재실행 시 동일 페이지와 메뉴를 갱신한다.
