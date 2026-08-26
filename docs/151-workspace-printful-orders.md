# 워크스페이스별 Printful 주문 전달

Printful 주문 worker는 `printful_order_jobs`와 `commerce_orders`를 조인해 주문의 `workspace_id`를 claim한다. Draft 중복 조회, draft 생성, 실시간 원가 확인, 최종 주문 확정은 모두 해당 워크스페이스에 암호화 저장된 Printful token과 Store ID를 사용한다.

Printful 연결이 없는 주문은 `HELD`로 보내지 않는다. 현재 phase를 유지한 채 `WAITING_FOR_PRINTFUL_CONNECTION`으로 재대기하고 attempts를 되돌린다. 따라서 관리자 연결 완료 후 기존 주문이 같은 외부 주문 ID로 안전하게 이어진다.

전역 `PRINTFUL_TOKEN`, `PRINTFUL_STORE_ID`는 단일 스토어 호환 경로이며 워크스페이스 저장 연결이 우선한다.
