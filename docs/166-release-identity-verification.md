# 실행 이미지 식별 검증

Kubernetes 명세는 모든 Pod에 `STORZY_RELEASE` 환경 변수로 GHCR의 불변 image digest를 주입한다. 공개 `/health` 응답은 현재 실행 중인 release 값을 포함한다.

운영 배포 workflow는 입력받은 image digest를 배포 후 검증 workflow의 `expected_release`로 전달한다. 기대 digest와 실제 release가 다르면 배포 검증이 실패한다. 이를 통해 load balancer가 이전 Pod를 가리키거나 잘못된 이미지가 실행되는 상황을 감지한다.

로컬 실행은 `release: development`를 반환한다. Release 식별자는 비밀이 아니며 운영 Secret이나 commit 내용은 포함하지 않는다.
