# 개인정보 SLA 자동 경보 스캔

개인정보 요청 화면의 SLA 집계를 주기적으로 검사해 내부 운영 경보 큐에 저장하는 1회 실행 작업이다.

## 경보 종류

- `DUE_SOON`: 처리 기한이 7일 이내
- `OVERDUE`: 처리 기한 초과
- `FAILED`: 처리 실패 상태

요청과 경보 종류의 조합은 고유하므로 동일 경보가 반복 실행으로 중복 생성되지 않는다. 요청 상태나 기한이 정상 범위로 바뀌면 열려 있거나 확인된 경보를 `RESOLVED`로 자동 전환한다.

## 실행

```bash
npm run privacy-sla:scan
```

로컬 미리보기 PostgreSQL을 대상으로 실행할 때는 다음 명령을 사용한다.

```bash
npm run preview:privacy-sla:scan
```

명령은 한 번 스캔하고 종료하므로 운영 환경의 cron 또는 scheduler에서 주기적으로 호출한다. 권장 주기는 1시간이며, 실행 결과는 구조화 로그 `privacy-sla.scan.completed`로 기록된다.

같은 예약 실행은 앱 삭제 후 `shop/redact` 연결에 사용하는 Shopify 앱 삭제 수신 원장도 정리한다. 수신 후 7일이 지난 원장의 스토어 도메인과 연결 식별자는 자동 익명화되며 결과는 `shopify-uninstall-retention.completed` 로그로 기록된다. 세부 보존 정책은 `199-shopify-uninstall-receipt-retention.md`를 따른다.

외부 이메일·Slack 전송은 아직 수행하지 않는다. 후속 전송기는 `privacy_sla_alerts`의 `OPEN` 레코드를 읽고 전송 성공 후 확인 상태를 기록하도록 구성한다.
