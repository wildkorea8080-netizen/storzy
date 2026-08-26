# Kubernetes 배포 명세

GHCR 릴리스 workflow가 기록한 불변 image digest로 배포 명세를 생성한다.

```bash
npm run deploy:kubernetes -- \
  ghcr.io/owner/storzy@sha256:<64자리-digest> --write
```

## 생성 파일

- `storzy.migration.k8s.yaml`: ServiceAccount와 migration Job
- `storzy.workloads.k8s.yaml`: API Service, Deployment와 CronJob
- `storzy.k8s.yaml`: 검토와 보관을 위한 전체 명세

기존 파일이 하나라도 있으면 생성기는 아무 파일도 덮어쓰지 않고 실패한다.

## 적용 순서

1. 대상 namespace에 `storzy-runtime` Secret을 Secret Manager 연동 방식으로 준비한다.
2. `kubectl apply -f storzy.migration.k8s.yaml`을 실행한다.
3. migration Job 성공을 확인한다.
4. `kubectl apply -f storzy.workloads.k8s.yaml`을 실행한다.
5. ingress 또는 load balancer를 `storzy-api` Service에 연결한다.
6. `npm run deploy:verify`를 실행한다.

명세를 분리하면 새 애플리케이션이 필요한 DB schema보다 먼저 시작되는 상황을 방지할 수 있다. 모든 workload는 동일한 image digest와 `storzy-runtime` Secret을 사용한다.

Pod는 비루트, 읽기 전용 root filesystem, Linux capability 제거, 서비스 계정 토큰 미탑재 설정을 기본으로 사용한다. worker는 `Recreate`, scheduler는 `concurrencyPolicy: Forbid`를 사용한다.

생성 파일에는 Secret 값이나 namespace를 포함하지 않는다. 실제 배포 전 조직의 resource quota, network policy, ingress와 외부 Secret 연동 정책을 별도로 적용해야 한다.
