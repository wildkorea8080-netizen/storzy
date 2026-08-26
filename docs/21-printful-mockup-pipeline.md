# Printful mockup 생성 파이프라인

콘텐츠 승인은 Shopify 발행 작업을 `WAITING_FOR_MOCKUP`으로 만든다. 승인된 상품 후보에 HTTPS 디자인 파일, placement, technique, 운영자가 확인한 mockup style ID를 등록하면 `printful_mockup_jobs`가 생성된다. style ID를 AI가 추측하지 않는 것이 핵심 안전장치다.

worker는 Printful v2 `POST /v2/mockup-tasks`로 비동기 task를 만들고 `GET /v2/mockup-tasks?id=...`로 조회한다. 진행 중에는 `WAITING_REMOTE`로 lease를 해제하며, 실패 이유가 있거나 이미지가 없는 완료 응답은 자동 발행하지 않는다. 완료 이미지는 variant ID, placement, style ID, URL과 SHA-256 checksum을 `mockup_snapshots`에 불변 저장한 뒤에만 Shopify 작업을 `PENDING`으로 전환한다.

디자인 등록 API:

`POST /api/workspaces/{workspaceId}/product-candidates/{candidateId}/design-asset`

```json
{"fileUrl":"https://assets.example/design.png","placement":"front","technique":"dtg","mockupStyleIds":[1],"actorId":"operator-1"}
```

운영 원칙: 디자인 누락, technique 불일치, 비 HTTPS 파일, Printful 실패는 관리자 대기 상태로 남긴다. 원격 task 조회는 rate limit을 고려해 기본 10초 간격이며, 향후 mockup 완료 webhook으로 대체할 수 있다.

## 완료 webhook

`POST /webhooks/printful`은 `x-pf-webhook-signature`의 HMAC-SHA256과 선택적으로 `x-pf-webhook-public-key`를 검증한다. 환경 변수는 `PRINTFUL_WEBHOOK_SECRET_HEX`, `PRINTFUL_WEBHOOK_PUBLIC_KEY`다. 수신 payload digest는 유일하게 저장되어 재전송을 멱등 처리한다. `mockup_task_finished`는 실패 완료일 수도 있으므로 payload를 곧바로 snapshot으로 쓰지 않고 대응하는 `WAITING_REMOTE` job의 조회 시각만 당긴다. 주기적 GET 폴링은 webhook 유실에 대비해 계속 유지한다.
