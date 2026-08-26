# CI 품질 게이트

`.github/workflows/ci.yml`은 pull request와 `main` 또는 `master` 브랜치 변경을 검증한다.

## 검사 순서

1. Node.js 22에서 `npm ci`로 잠금된 의존성을 설치한다.
2. `npm run check`로 타입 검사, 전체 테스트와 TypeScript 빌드를 수행한다.
3. 애플리케이션 검사가 통과한 경우 프로덕션 `Dockerfile`을 실제 빌드한다.

컨테이너는 `storzy:ci` 로컬 태그로만 만들어지며 registry에 게시하지 않는다. CI는 운영 Secret을 사용하지 않고 저장소 읽기 권한만 가진다.

브랜치 보호 규칙에서는 다음 작업을 필수 상태 검사로 지정한다.

- `Typecheck, test and build`
- `Build production container`

같은 브랜치에 새 변경이 올라오면 이전 CI 실행을 취소하여 오래된 결과가 배포 판단에 사용되지 않도록 한다.
