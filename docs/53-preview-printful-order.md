# 미리보기 Printful 주문 자동화

미리보기 주문 워커는 운영 `PrintfulOrderWorker`와 `PrintfulOrderJobStore`를 사용한다. 외부 API만 `PreviewPrintfulOrderClient`로 대체해 `PENDING_DRAFT → WAITING_COST → READY_CONFIRM → SUCCEEDED` 상태를 재현한다.

초안은 과금을 발생시키지 않으며, 견적 단계에서 통화·음수 마진·승인 원가 대비 공급가 상승률을 운영 규칙으로 다시 검증한다. 모든 검증을 통과한 주문만 가상 confirm 응답을 받고 `commerce_orders.status`가 `SUBMITTED`로 변경된다. 실제 Printful 토큰이나 주문은 사용하지 않는다.
