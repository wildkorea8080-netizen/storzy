# 워크스페이스별 Shopify 스토어 게시

스토어 페이지와 메뉴 게시 worker도 상품 게시와 동일하게 워크스페이스의 암호화 저장 Shopify 연결을 사용한다. Job claim은 `store_drafts`와 조인해 `workspace_id`를 가져오며 해당 스토어의 domain과 access token으로 GraphQL client를 구성한다.

Shopify가 아직 연결되지 않은 승인 스토어 구성은 `WAITING_FOR_SHOPIFY_CONNECTION`으로 재대기한다. claim 시 증가한 attempts를 되돌리므로 연결을 기다리는 동안 재시도 한도가 소모되지 않는다. OAuth 연결이 완료되면 기존 PENDING job이 자동으로 페이지와 메뉴 게시를 이어간다.

전역 `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`은 단일 스토어 호환 경로이며 워크스페이스 저장 연결이 우선한다.
