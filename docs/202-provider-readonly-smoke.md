# Shopify·Printful 읽기 전용 smoke

실제 계정의 인증·권한·기본 읽기 계약을 외부 데이터 변경 없이 확인한다.

```powershell
npm run providers:smoke
```

필수 환경변수는 `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, `SHOPIFY_API_VERSION`, `PRINTFUL_TOKEN`, `PRINTFUL_STORE_ID`다. 선택적으로 `PROVIDER_SMOKE_TIMEOUT_MS`를 지정한다.

## 확인 항목

- Shopify `shop` 기본 정보와 통화
- 현재 앱에 승인된 `write_products`, `write_content`, `read_orders` scope
- Shopify 상품 1개 이하 읽기
- Printful Store 식별
- Printful v2 카탈로그 1개 이하 읽기

이 명령은 Shopify mutation, Printful 주문·목업 생성, Webhook 동기화, 파일 업로드를 호출하지 않는다. 로그에는 access token을 출력하지 않는다. 모든 항목이 성공해야 종료 코드 `0`이며, 설정 누락·인증 오류·scope 누락·timeout은 종료 코드 `1`이다.

읽기 smoke 통과 후에만 별도 승인된 개발 스토어에서 draft 상품 게시와 Printful mockup E2E를 진행한다.
