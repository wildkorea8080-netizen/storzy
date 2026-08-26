# Shopify 토큰 운영 알림 Webhook

`REAUTH_REQUIRED` 상태 또는 한 incident에서 토큰 갱신이 3회 연속 실패하면 서명된 HTTPS Webhook을 외부 운영 채널로 전달한다.

## 설정

- `SHOPIFY_TOKEN_ALERT_WEBHOOK_URL`: 공개 HTTPS 수신 URL
- `SHOPIFY_TOKEN_ALERT_WEBHOOK_SECRET`: 최소 16자의 HMAC 비밀키
- `SHOPIFY_TOKEN_ALERT_MAX_ATTEMPTS`: 기본 6회
- `SHOPIFY_TOKEN_ALERT_LEASE_SECONDS`: 기본 30초
- `SHOPIFY_TOKEN_ALERT_BATCH_SIZE`: 기본 20건

실행 명령은 `npm run shopify-token-alerts:deliver`이며 운영 scheduler에서 주기적으로 호출한다. 실패는 30초부터 최대 1시간까지 지수 백오프로 재시도한다.

Payload에는 delivery ID, workspace ID, shop domain, alert kind, 발생 시각, 실패 횟수만 포함한다. access token, refresh token, OAuth client secret과 원문 오류 메시지는 포함하지 않는다. 요청 서명은 `X-Storzy-Timestamp`와 `X-Storzy-Signature: sha256=<hex>` 헤더로 전달한다.

관리자 연동 화면에서 workspace별 전송 상태와 시도 횟수를 조회할 수 있다. 실패한 전송은 처리자와 1~500자의 사유를 남긴 경우에만 `PENDING`으로 되돌릴 수 있으며, 모든 재시도는 `shopify_token_alert_delivery_actions`에 감사 이력으로 기록한다.

운영 scheduler와 배포 전 검사 설정은 `156-shopify-token-alert-scheduler.md`를 따른다.
