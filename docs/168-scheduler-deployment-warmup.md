# 배포 직후 scheduler 검증

시간별 CronJob은 배포 직후 다음 정규 실행까지 최대 1시간 동안 이전 release heartbeat가 남을 수 있다. 이 공백을 없애기 위해 Kubernetes 배포 workflow는 workload rollout 후 5개 scheduler를 각각 일회성 Job으로 즉시 실행한다.

검증 대상은 개인정보 SLA 점검, 개인정보 경보 발송, 주문 대조, Shopify 토큰 경보 발송, 관리자 인증 기록 정리다. CronJob 존재 여부를 먼저 확인하고, workflow run별 고유 이름으로 Job을 생성한 뒤 각 Job의 완료를 최대 5분 기다린다.

하나라도 실패하면 최근 로그 200줄을 출력하고 배포 후 검증으로 넘어가지 않는다. 성공한 Job은 새 image release heartbeat를 남기므로 최종 process health에서 15개 역할의 실행 여부와 release 일관성을 즉시 확인할 수 있다.

이 실행은 실제 운영 로직을 한 번 수행하므로 모든 scheduler는 재실행 안전성과 DB lease를 유지해야 한다. 정규 CronJob에는 `concurrencyPolicy: Forbid`가 계속 적용된다.
