# Shopify 고객 데이터 제공 내보내기

검토 중인 `CUSTOMERS_DATA_REQUEST` 요청은 관리자 화면에서 JSON으로 생성할 수 있다. 요청에 포함된 Shopify order ID와 워크스페이스가 모두 일치하는 주문만 조회한다.

내보내기에는 요청 식별자, shop/customer ID, 요청된 order ID와 STORZY가 보관 중인 해당 주문의 고객·연락처·배송지·청구지·상품 정보가 포함될 수 있다. 따라서 endpoint는 관리자 인증을 요구하며 `Cache-Control: no-store, private`과 다운로드 disposition을 사용한다.

생성 시각과 담당자는 요청 및 감사 이력에 기록한다. 파일 생성만으로 스토어 소유자에게 실제 제공되었다고 볼 수 없으므로 요청 상태는 `IN_PROGRESS`로 유지한다. 안전한 전달과 제공 증빙을 확인한 뒤 별도 완료 승인이 필요하다.
