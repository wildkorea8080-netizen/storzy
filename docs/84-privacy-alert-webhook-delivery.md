# 개인정보 경보 Webhook 전송

내부 `privacy_sla_alerts` 경보를 외부 운영 자동화 채널로 전달하는 범용 HTTPS webhook 전송기다.

## 안전장치

- HTTPS URL만 허용
- `X-Storzy-Timestamp`와 `X-Storzy-Signature` HMAC-SHA256 서명
- 10초 요청 제한 시간
- 경보별 단일 전송 레코드
- worker lease와 `FOR UPDATE SKIP LOCKED` 동시 실행 보호
- 최대 시도 횟수와 지수 백오프
- 응답 상태, 마지막 오류, 전송 완료 시각 보존

서명 입력은 `{timestamp}.{raw JSON body}`이며 헤더 값은 `sha256={hex digest}` 형식이다. 수신 서버는 타임스탬프 허용 범위를 확인하고 동일한 비밀키로 서명을 검증해야 한다.

## 환경 변수

- `PRIVACY_ALERT_WEBHOOK_URL`
- `PRIVACY_ALERT_WEBHOOK_SECRET`
- `PRIVACY_ALERT_MAX_ATTEMPTS`
- `PRIVACY_ALERT_LEASE_SECONDS`
- `PRIVACY_ALERT_BATCH_SIZE`

## 실행

```bash
npm run privacy-alerts:deliver
```

URL과 비밀키가 없으면 전송기는 시작하지 않는다. 따라서 미리보기 환경에서는 외부 요청이 발생하지 않는다.
