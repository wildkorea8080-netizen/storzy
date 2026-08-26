# Printful v2 Webhook 구독 동기화

`POST /api/workspaces/{workspaceId}/integrations/printful/webhooks/sync`는 암호화 저장된 Printful token과 Store ID를 사용해 다음 이벤트를 동기화한다.

- `mockup_task_finished`
- `shipment_sent`
- `shipment_returned`

Printful v2의 전체 Webhook 설정 API는 기존 설정을 교체할 수 있으므로 사용하지 않는다. 각 이벤트의 `GET /v2/webhooks/{eventType}`을 조회한 뒤, URL이 없거나 다른 경우에만 `POST /v2/webhooks/{eventType}`으로 생성·갱신한다. STORZY가 관리하지 않는 다른 이벤트 설정은 그대로 보존된다.

수신 주소는 `{PUBLIC_APP_URL}/webhooks/printful`이며 공개 HTTPS가 아니면 `409 WEBHOOK_PUBLIC_HTTPS_REQUIRED`로 차단한다. 인증 또는 네트워크 오류를 이벤트 미등록으로 오인해 POST하지 않고, 404일 때만 신규 생성한다.

응답에는 전체·신규·갱신·기존 이벤트 수와 안전한 이벤트 설정만 포함한다. token은 응답이나 로그에 포함하지 않는다.
