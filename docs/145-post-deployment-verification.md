# 배포 후 읽기 전용 검증

`npm run deploy:verify -- https://app.example.com [workspaceId]`는 health, readiness, 관리자 보안 헤더와 인증, 파일럿 상태를 확인한다. 기본 10초 간격으로 최대 12회 프로세스 상태를 확인하며 15개 역할 중 누락·지연·실패가 있으면 종료 코드 `1`을 반환한다. 관리자 토큰은 Secret Manager에서 주입하고 출력하지 않는다.
