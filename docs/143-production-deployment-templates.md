# 운영 배포 템플릿 생성

공개 URL과 Shopify Client ID를 확정한 뒤 다음 명령으로 결과를 먼저 확인한다.

```bash
npm run deploy:template -- https://app.example.com SHOPIFY_CLIENT_ID
```

출력이 올바르면 마지막에 `--write`를 추가한다. 이때 `.env.production.template`과 `shopify.app.toml`이 생성된다. 기존 파일은 덮어쓰지 않고 실패한다.

생성기는 공개 URL을 HTTPS origin으로 제한하고 환경 변수와 Shopify callback을 같은 origin으로 고정한다. API 비밀키, 관리자 토큰, 데이터베이스 주소, 암호화 키는 생성하지 않으며 `__SECRET_*__` 자리표시자로 남긴다. 실제 값은 배포 플랫폼의 Secret Manager에 저장한다.

비밀값을 주입한 배포 환경에서는 `npm run deploy:preflight`를 실행하고 통과한 뒤 Shopify CLI로 앱 설정을 배포한다. 전체 프로세스와 scheduler 등록 순서는 `157-production-process-checklist.md`를 따른다.
