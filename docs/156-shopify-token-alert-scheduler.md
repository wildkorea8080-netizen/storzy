# Shopify 토큰 알림 운영 Scheduler

배포 환경은 다음 명령을 1~60분 간격으로 실행해야 한다.

```bash
npm run start:shopify-token-alerts:deliver
```

권장 주기는 5분이며 production template은 `*/5 * * * *`를 기본값으로 제공한다. 이 명령은 대기 중인 incident를 batch로 전송하고 종료하므로 Kubernetes CronJob, Cloud Scheduler, GitHub Actions가 아닌 배포 플랫폼의 cron job 등 단발성 scheduler에 연결한다. 여러 실행이 겹쳐도 PostgreSQL `SKIP LOCKED`와 delivery 상태 전이로 같은 행을 동시에 전송하지 않는다.

`deploy:preflight`는 다음을 검사한다.

- 공개 HTTPS Webhook URL과 16자 이상의 실제 서명 비밀키
- `*/N * * * *` 형식의 1~60분 실행 주기
- 정확한 production 실행 명령
- 최대 시도 횟수 1~20
- lease 10~300초
- batch 크기 1~100

호스팅 플랫폼에는 환경변수의 cron 문자열을 자동 등록하는 공통 표준이 없으므로, template의 `SHOPIFY_TOKEN_ALERT_SCHEDULE`과 `SHOPIFY_TOKEN_ALERT_COMMAND`를 플랫폼 scheduler 설정에도 동일하게 입력한다.

`SHOPIFY_TOKEN_ALERT_WEBHOOK_URL` placeholder에는 STORZY 앱 URL이 아니라 알림을 받을 Slack 중계기, incident 관리 시스템 또는 운영 자동화의 공개 HTTPS endpoint를 입력한다.
