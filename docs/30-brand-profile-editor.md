# Brand Profile 편집 revision

## 목적

AI가 생성한 Brand Profile을 운영자가 JSON으로 보정하되, 기존 생성본과 승인본을 직접 덮어쓰지 않는다. 모든 수정은 새로운 immutable revision으로 저장하고 JSON Schema 검증을 통과한 revision만 검수 대상으로 만든다.

## API

`POST /api/brand-profile-revisions/{baseRevisionId}/editor-revisions`

요청 본문은 `actorId`와 `profileData`를 포함한다. `profileData`는 `docs/schemas/brand-profile.schema.json` 전체 계약을 충족해야 한다. 성공하면 `201 Created`와 `REVIEW_REQUIRED` 상태의 새 revision을 반환한다.

## 불변 조건

- 편집 기준 revision은 생성이 완료되어 `profileData`를 가지고 있어야 한다.
- 새 revision은 같은 `brand_profile_id`와 onboarding answers를 계승한다.
- provenance는 `prompt_version=editor.v1`, `model=manual`, `created_by=actorId`로 기록한다.
- 현재 승인본은 편집본 생성만으로 변경되지 않는다.
- 편집본 승인 시점에만 이전 `APPROVED` revision을 `SUPERSEDED`로 바꾼다.
- 생성, 검수 요청, 승인 행위는 audit/outbox 기록을 남긴다.

## 관리자 화면

`/admin/onboarding`에서 생성 결과 JSON을 수정한 뒤 **Save as new revision**을 누른다. 저장 성공 시 화면과 session storage가 새 revision을 가리키며, 그 revision을 별도로 승인할 수 있다. JSON 파싱 오류와 Schema 위반은 저장하지 않고 오류 메시지로 표시한다.
