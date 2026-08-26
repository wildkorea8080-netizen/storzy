# 미리보기 배송·Fulfillment

`POST /api/workspaces/{workspaceId}/preview/shipments`는 최근 제출 완료 주문을 찾아 Printful `shipment_sent` 형식의 이벤트를 생성한다. 이벤트는 운영 `PrintfulFulfillmentHandler`를 거쳐 digest 중복 방지, external order 매핑, shipment·품목 snapshot 저장, Shopify fulfillment job 생성을 수행한다.

미리보기 Shopify fulfillment worker는 운영 publisher와 job store를 그대로 사용한다. GraphQL 조회 계층만 로컬 DB의 주문 라인을 Shopify FulfillmentOrder 응답으로 투영하고, `fulfillmentCreate` 성공 응답을 돌려준다. 송장번호와 추적 URL, 고객 알림 설정을 포함한 요청 payload와 가상 fulfillment GID가 저장된다.
