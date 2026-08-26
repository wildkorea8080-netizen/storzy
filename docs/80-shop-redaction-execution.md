# Shopify 스토어 데이터 삭제 실행

`shop/redact` 요청을 검토한 관리자가 사전 점검을 통과한 뒤 실행하는 영구 익명화 절차다.

## 보호 장치

- 관리자 API 인증
- `SHOP_REDACT` 및 `IN_PROGRESS` 상태 확인
- 요청 행 잠금(`FOR UPDATE`)
- 트랜잭션 내부에서 진행 중인 주문·배송·게시 작업 재확인
- 원래 Shopify 스토어 도메인 정확 입력
- 브라우저 최종 확인
- 전체 작업 단일 트랜잭션 처리 및 실패 시 롤백
- `EXECUTE_SHOP_REDACTION` 감사 기록

## 삭제·익명화 범위

- Shopify 주문 webhook payload와 스토어·주문·상품·라인 항목 식별자
- Printful 주문 요청/응답, 배송 payload, 추적 정보와 스토어 식별자
- Shopify 상품 및 스토어 게시 요청/응답
- Shopify/Printful 암호화 자격 증명과 연결 metadata
- 개인정보 요청에 저장된 스토어·고객·외부 요청 식별자

브랜드 프로필, 사용자가 작성한 상품 콘텐츠, 디자인 및 스토어 초안처럼 STORZY에서 직접 만든 창작 데이터는 보존한다.

## API

`POST /api/admin/privacy-requests/:id/shop-redaction`

```json
{
  "actorId": "admin-ui",
  "confirmation": "store.myshopify.com"
}
```

성공하면 요청 상태가 `COMPLETED`로 변경되고 워크스페이스 연결이 제거된다. 동일 요청의 재실행은 허용되지 않는다.
