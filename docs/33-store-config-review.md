# 스토어 구성 검수와 승인

## 계약

스토어 구성은 `docs/schemas/store-config.schema.json`을 단일 계약으로 사용한다. 템플릿 키, 4개 색상 토큰, 8개 내비게이션 항목과 8개 필수 페이지가 모두 검증되어야 저장할 수 있다.

## Revision 규칙

- 최초 규칙 기반 결과는 `source=GENERATED`로 저장한다.
- 운영자 수정본은 기존 row를 덮어쓰지 않고 `source=EDITOR`인 새 revision이 된다.
- 같은 Brand Profile revision의 GENERATED 초안은 하나만 존재한다.
- workspace에는 한 번에 하나의 APPROVED store configuration만 존재한다.
- 새 초안을 생성하거나 편집해도 기존 승인본은 유지된다.
- 새 revision 승인 시 기존 승인본만 `SUPERSEDED`로 전환된다.
- PUBLISHED revision은 직접 수정할 수 없고 후속 revision을 별도 정책으로 생성해야 한다.

## API

- `GET /api/workspaces/{workspaceId}/store-drafts`: 최근 50개 revision 조회
- `POST /api/workspaces/{workspaceId}/store-drafts`: 승인 Brand Profile 기반 최초 초안 생성
- `POST /api/workspaces/{workspaceId}/store-drafts/{draftId}/revisions`: 검증된 편집본 생성
- `POST /api/workspaces/{workspaceId}/store-drafts/{draftId}/approve`: DRAFT 승인

모든 API는 관리자 Bearer token과 `actorId`를 요구한다. 생성·편집·승인은 audit event로 기록한다.

## 관리자 화면

`/admin/store`에서 revision 이력을 선택하고 JSON을 편집하거나 승인한다. JSON 파싱 또는 Schema 검증 오류가 발생하면 새 revision을 생성하지 않는다.
