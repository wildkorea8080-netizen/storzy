# 워크스페이스별 Printful 카탈로그

상품 후보 worker는 브랜드 프로필 소유 관계를 통해 candidate job의 `workspace_id`를 claim한다. 카탈로그 제품, 변형, 배송 국가, 재고, 목업 스타일, 가격 조회는 해당 워크스페이스에 암호화 저장된 Printful token과 Store ID를 사용한다.

Printful 연결 전 생성된 후보 job은 실패하지 않고 `WAITING_FOR_PRINTFUL_CONNECTION`으로 재대기한다. attempts를 되돌리므로 연결 대기 시간이 후보 생성 재시도 한도를 소모하지 않는다.

이 변경으로 상품 추천, 목업 생성, 주문 전달이 모두 같은 워크스페이스 Printful 연결 경계를 사용한다. 전역 Printful 환경 변수는 단일 스토어 호환 경로다.
