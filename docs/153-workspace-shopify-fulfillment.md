# 워크스페이스별 Shopify 배송 반영

Shopify fulfillment worker는 shipment와 commerce order를 조인해 `workspace_id`를 claim한다. Fulfillment order 조회와 `fulfillmentCreate` 호출은 해당 워크스페이스에 암호화 저장된 Shopify domain과 access token을 사용한다.

Shopify 연결이 없는 동안 Printful 송장이 도착하면 job을 실패시키지 않는다. `WAITING_FOR_SHOPIFY_CONNECTION`으로 재대기하고 attempts를 되돌린다. 재연결 후 같은 shipment job이 송장번호와 배송 URL을 Shopify에 반영한다.

전역 Shopify 자격증명은 단일 스토어 호환 경로이며 워크스페이스 저장 연결이 우선한다.
