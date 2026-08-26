# 배포 후 자동 검증 GitHub Actions

배포 후 workflow는 공개 상태, 관리자 인증, 파일럿 API와 15개 프로세스 heartbeat를 읽기 전용으로 검증한다. `ADMIN_API_TOKEN`은 Actions Secret으로만 주입한다.
