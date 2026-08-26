# 미리보기 목업 파이프라인

미리보기 환경은 운영 `MockupWorker`, `MockupJobStore`, 실행 직전 안전 게이트를 그대로 사용한다. Printful의 비동기 API 응답만 `PreviewMockupClient`로 대체한다.

디자인과 콘텐츠가 승인되면 목업 작업은 `PENDING → WAITING_REMOTE → SUCCEEDED`로 전환되고, 변형별 미리보기 이미지 스냅샷을 저장한다. 완료 transaction은 Shopify 게시 작업을 `WAITING_FOR_MOCKUP`에서 `PENDING`으로 전환한다. 운영 환경에서는 기존 `PrintfulClient`가 사용되므로 미리보기 응답이 외부 주문이나 실제 스토어에 전달되지 않는다.
