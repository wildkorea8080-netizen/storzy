# Shopify draft 상품 쓰기 smoke

읽기 전용 공급사 smoke가 모두 통과한 뒤 Shopify 개발 스토어의 `productSet` 실계약을 검증한다. 기본 실행은 계획만 출력하며 Shopify를 변경하지 않는다.

```powershell
npm run shopify:draft-smoke
```

실제 실행은 대상 스토어 도메인을 명시적으로 확인해야 한다.

```env
SHOPIFY_WRITE_SMOKE_CONFIRM=example-store.myshopify.com
```

```powershell
npm run shopify:draft-smoke -- --apply
```

안전 조건:

- 상품 상태는 항상 `DRAFT`다.
- 고정 handle `storzy-provider-smoke-v1`을 사용하므로 재실행은 같은 상품을 갱신한다.
- `storzy-smoke`, `do-not-publish` 태그를 붙인다.
- 게시 직후 ID, handle, 상태와 variant 가격을 다시 읽어 검증한다.
- 기본 `npm test`와 `npm run check`는 외부 쓰기를 실행하지 않는다.

검증 후 Shopify 관리자 `Products`에서 `[STORZY TEST] Seoul One-Way Street Tee`를 확인한다. 더 이상 필요하지 않으면 관리자에서 해당 draft 상품을 삭제한다.
