# 상품 콘텐츠 검수와 승인

AI 생성 원본은 `product_contents`에 보존하고 모든 관리자 편집은 `product_content_revisions`에 새 revision으로 저장한다.

## API

- `GET /api/workspaces/{workspaceId}/product-contents`: 상품별 최신 revision 조회
- `POST /api/workspaces/{workspaceId}/product-contents/{contentId}/revisions`: 편집 revision 생성
- `POST /api/workspaces/{workspaceId}/product-content-revisions/{revisionId}/approve`: revision 승인

승인 요청에는 `Idempotency-Key`와 `actorId`가 필요하다. 승인 transaction은 기존 승인본을 `SUPERSEDED`로 바꾸고 선택 revision을 `APPROVED`로 만든 뒤 `shopify_publication_jobs`를 한 번만 생성한다.

## 안전 규칙

- 편집본도 전체 `product-content.schema.json` 검증을 통과해야 한다.
- 통화와 권장가는 승인된 상품 후보 값과 정확히 같아야 한다.
- AI 원본과 과거 revision은 덮어쓰거나 삭제하지 않는다.
- `SUPERSEDED` revision은 다시 승인할 수 없다.
- Shopify worker는 `APPROVED` revision만 읽어야 한다.

## 다음 경계

`shopify_publication_jobs`는 아직 실행되지 않는다. 다음 단계에서 GraphQL `productSet` payload mapping, idempotent external ID, media/collection 연결, 사용자 오류 처리 worker를 구현한다.
