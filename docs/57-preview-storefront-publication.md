# 미리보기 스토어 페이지 게시

스토어 구성 초안을 승인하면 `shopify_store_publication_jobs`가 생성된다. 미리보기 storefront worker는 운영 job store, publication worker, Shopify plan mapper와 publisher를 그대로 사용하며 GraphQL 응답만 결정론적 로컬 리소스로 대체한다.

홈·Shop·Collections·About·FAQ·Shipping·Returns·Contact 구성에 필요한 페이지 계획과 메인 메뉴를 비공개 초안으로 upsert한다. 동일 handle은 동일한 가상 Shopify GID를 사용하므로 재실행해도 중복 페이지가 생기지 않는다. 게시 성공 시 store draft는 `PUBLISHED`로 전환된다.
