# Printful catalog 실계약 smoke

실제 Printful 계정에서 외부 데이터를 변경하지 않고 다음 v2 GET 계약을 함께 검증한다.

- 상품 상세와 기본 technique
- catalog variant ID
- mockup placement와 style
- 통화별 variant 가격
- 배송 가능 국가

```powershell
npm run printful:catalog-smoke
```

기본 표본은 상품 `1`, 통화 `USD`다. 다른 표본이 필요하면 아래 환경변수를 사용한다.

```env
PRINTFUL_CATALOG_SMOKE_PRODUCT_ID=1
PRINTFUL_CATALOG_SMOKE_CURRENCY=USD
```

이 명령은 모두 GET 요청이며 파일 업로드, 목업 task 생성, 상품·주문 생성은 수행하지 않는다.
