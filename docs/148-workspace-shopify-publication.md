# 워크스페이스별 Shopify 상품 게시

상품 게시 worker는 `shopify_publication_jobs.workspace_id`를 기준으로 암호화 저장된 Shopify 연결을 선택한다. OAuth callback이 저장한 shop domain과 access token으로 해당 워크스페이스 전용 GraphQL client를 구성하므로 여러 브랜드의 상품이 전역 단일 스토어로 섞이지 않는다.

연결 전 승인되어 생성된 게시 작업은 실패 처리하지 않는다. `WAITING_FOR_SHOPIFY_CONNECTION`으로 30초 뒤 재대기시키고 claim에서 증가한 시도 횟수를 되돌린다. 따라서 사용자가 나중에 OAuth를 완료해도 기존 작업이 자동으로 이어진다.

기존 `SHOPIFY_SHOP_DOMAIN`과 `SHOPIFY_ADMIN_ACCESS_TOKEN`은 단일 스토어 호환 경로로 유지한다. 암호화 저장소가 구성된 경우에는 워크스페이스 연결을 우선한다.
