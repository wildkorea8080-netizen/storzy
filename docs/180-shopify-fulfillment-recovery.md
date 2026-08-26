# Shopify 배송 생성 응답 유실 복구

배송 worker는 `fulfillmentCreate` 전에 주문의 기존 fulfillment를 함께 조회한다. Printful 송장번호가 같은 fulfillment가 있고 품목 ID와 수량이 모두 정확히 일치하면 이전 요청이 성공한 것으로 보고 Shopify mutation을 다시 호출하지 않고 로컬 작업을 성공 처리한다.

같은 송장번호가 이미 존재하지만 품목이나 수량이 다르면 송장 충돌로 판단해 자동 처리를 중단한다. 송장번호가 없는 배송은 오탐 위험 때문에 기존 fulfillment 자동 복구를 시도하지 않는다.
