# Brand Profile revision 이력

## 목적

Brand Profile 생성본, 운영자 편집본, 승인본을 한 화면에서 시간순으로 추적한다. 운영자는 현재 source of truth와 검수 대기본을 구분하고 과거 JSON을 다시 열어 비교할 수 있다.

## API

`GET /api/workspaces/{workspaceId}/brand-profile-revisions`

- 최신 revision부터 내림차순으로 반환한다.
- MVP 운영 범위를 고려해 최근 50개로 제한한다.
- 각 항목은 revision 번호, 상태, profile data, 생성 방식, 작성자와 승인 정보를 포함한다.
- workspace가 존재하지 않으면 `NOT_FOUND`를 반환한다.

## 화면 동작

`/admin/onboarding`의 **Revision history**에서 revision을 선택하면 해당 JSON과 상태를 편집 영역에 표시한다. `REVIEW_REQUIRED`만 승인할 수 있고, 완료된 과거 revision은 새 편집 revision의 기준으로 사용할 수 있다.

이력 조회는 기존 revision을 변경하지 않는 read-only 동작이다.
