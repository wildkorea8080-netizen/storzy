# 프로덕션 컨테이너

루트 `Dockerfile`은 API, worker, scheduler가 함께 사용하는 단일 운영 이미지를 만든다. Node.js 22 기반 다단계 빌드이며 런타임에는 컴파일 결과, production dependency와 DB migration만 포함한다.

## 이미지 빌드

```bash
docker build --pull -t storzy:release .
```

이미지는 비루트 `node` 사용자로 실행되며 기본 명령은 supervisor가 감싸는 API 역할이다. `/ready`를 이용한 컨테이너 healthcheck도 포함한다.

## 역할별 실행

배포 플랫폼에서 `storzy.processes.json`의 command로 기본 명령을 덮어쓴다. 모든 역할은 같은 image digest를 사용해야 API와 worker 사이의 코드·DB 계약이 일치한다.

```bash
docker run --env-file .env.production storzy:release \
  node dist/src/process-supervisor.js candidate worker npm run start:candidate
```

## Migration

애플리케이션 컨테이너 시작 시 migration을 자동 실행하지 않는다. 새 이미지를 배포하기 전 일회성 job으로 실행한다.

```bash
docker run --rm --env-file .env.production storzy:release \
  node dist/src/db/migrate.js
```

Migration 성공 후 API와 worker를 같은 image digest로 배포하고 `npm run deploy:verify`를 실행한다. `.env.production`은 이미지에 복사하지 않고 배포 플랫폼의 Secret Manager로 주입한다.
