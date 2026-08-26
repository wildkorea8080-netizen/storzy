# 운영 비밀값 배포 게이트

배포 사전점검의 `DEPLOYMENT_SECRETS` 항목은 다음 값이 실제로 주입됐는지 확인한다.

- PostgreSQL `DATABASE_URL`
- 32자 이상의 `ADMIN_API_TOKEN`
- `OPENAI_API_KEY`
- `SHOPIFY_API_SECRET`, `SHOPIFY_WEBHOOK_SECRET`
- 최소 32바이트 hex 형식의 `PRINTFUL_WEBHOOK_SECRET_HEX`

템플릿의 `__SECRET_*__` 값은 길이가 충분해도 거부한다. 점검 출력은 어느 그룹이 미완료인지 알려주지만 실제 값은 반환하거나 기록하지 않는다. 암호화 키의 Base64 형식 검사는 OAuth 준비 판정이 별도로 수행한다.
