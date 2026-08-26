# Shopify 배송 실패 영구 이벤트

배송 worker가 최종 실패로 전환할 때 `FAILED` 이벤트를 같은 트랜잭션에 저장한다. Shopify fulfillment가 생성되기 전 실패할 수 있으므로 fulfillment ID는 선택값이며, worker ID와 원본 오류 메시지는 영구 보존한다.

수동 재시도가 job의 현재 오류를 초기화하더라도 실패 이벤트의 `detail`은 남아 장애 원인과 재시도 전후 흐름을 주문 감사 이력에서 추적할 수 있다. 만료된 lease의 worker는 상태와 이벤트 어느 것도 기록하지 못한다.
