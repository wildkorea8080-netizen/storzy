# STORZY Production 프로세스 체크리스트

운영 manifest는 API·worker 10개 Deployment와 scheduler 5개 CronJob을 정의한다.

| Scheduler | 명령 | cron |
|---|---|---|
| 개인정보 SLA | `npm run start:privacy-sla:scan` | `0 * * * *` |
| 개인정보 알림 | `npm run start:privacy-alerts:deliver` | `*/5 * * * *` |
| 주문 대조 | `npm run start:order-reconciliation:scan` | `0 * * * *` |
| Shopify 토큰 알림 | `npm run start:shopify-token-alerts:deliver` | `*/5 * * * *` |
| 관리자 인증 기록 정리 | `npm run start:admin-auth:cleanup` | `*/5 * * * *` |

supervisor가 모든 역할의 heartbeat를 기록하며 `/api/admin/process-health`는 총 15개 역할을 확인한다.

전체 배포 순서는 [207 배포 runbook](207-deployment-runbook.md)을 따른다.
