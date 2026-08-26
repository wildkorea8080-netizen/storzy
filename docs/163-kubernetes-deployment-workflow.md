# Kubernetes 운영 배포 workflow

운영 workflow는 image digest 검증, migration, 10개 Deployment rollout, 5개 scheduler warm-up, 15개 프로세스 배포 후 검증을 순서대로 수행한다. 기존 `storzy-runtime` Secret을 사용하며 생성하거나 변경하지 않는다.
