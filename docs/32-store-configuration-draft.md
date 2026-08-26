# 스토어 구성 초안

## 범위

승인된 Brand Profile을 기반으로 Shopify 스토어 설정 초안을 만든다. MVP에서는 AI가 Liquid 또는 테마 코드를 작성하지 않는다. 검증된 템플릿 키, 색상 토큰, 내비게이션과 페이지 콘텐츠만 생성한다.

## 템플릿 allowlist

- `MINIMAL_FASHION`
- `KOREAN_STREET`
- `OUTDOOR_LIFESTYLE`
- `TOURIST_SOUVENIR`
- `CREATOR_MERCHANDISE`

스타일 키워드와 선호 상품군을 정규화한 뒤 명시적 규칙으로 템플릿을 선택한다. 어떤 규칙에도 해당하지 않으면 `MINIMAL_FASHION`을 사용한다.

## 생성 결과

- 검증된 primary, secondary, accent, background 색상
- Home, Shop, Collections, About, FAQ, Shipping, Returns, Contact 내비게이션
- 각 페이지의 제목과 본문 초안
- 구성 schema version과 적용할 template key

## API

- `POST /api/workspaces/{workspaceId}/store-drafts`: 승인된 Brand Profile에서 초안 생성
- `GET /api/workspaces/{workspaceId}/store-drafts`: 최근 초안 revision 목록 조회

POST 요청에는 `actorId`가 필요하며 관리자 Bearer 인증을 적용한다. 승인 Brand Profile이 없으면 `APPROVED_BRAND_PROFILE_REQUIRED`를 반환한다.

같은 Brand Profile revision으로 반복 생성하면 기존 초안을 반환한다. 생성 행위는 `audit_events`에 기록한다.

## 후속 단계

다음 단계에서는 store draft JSON Schema, 운영자 검수·편집 revision, Shopify theme settings/pages 반영 작업을 추가한다.
