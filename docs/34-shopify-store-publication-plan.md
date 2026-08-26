# Shopify 스토어 게시 계획

승인된 Store Config는 `shopify_store_publication_jobs`에 한 번만 enqueue된다. job에는 외부 API 호출 전에 확정된 request snapshot을 저장하므로 이후 설정 변경에 영향을 받지 않는다.

## 현재 자동화 대상

- About, FAQ, Shipping, Returns, Contact를 비공개 Shopify Page 초안으로 계획
- Home, Shop, Collections와 생성된 페이지를 연결하는 main menu 계획
- 페이지 본문 HTML escape
- `store_draft_id` unique constraint 기반 enqueue idempotency
- lease, retry, terminal failure를 지원하는 job store

## 테마 설정 제한

Shopify `themeFilesUpsert`는 `write_themes` scope와 Shopify의 별도 exemption을 요구한다. 따라서 exemption 승인 전에는 테마 설정을 외부 mutation으로 전송하지 않고 계획에 `REQUIRES_SHOPIFY_THEME_API_EXEMPTION` 상태로 남긴다.

## 필요한 scope

- 페이지: `write_content` 또는 `write_online_store_pages`
- 메뉴: `write_online_store_navigation`
- 테마 파일: `write_themes`와 Shopify exemption

## 다음 단계

worker가 handle로 기존 페이지와 메뉴를 조회해 create/update를 선택하고, 부분 성공 결과를 checkpoint로 저장하도록 구현한다. timeout 이후에도 같은 handle을 사용하여 중복 리소스를 만들지 않아야 한다.
