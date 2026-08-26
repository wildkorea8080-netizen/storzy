# 운영 컨테이너 이미지 릴리스

`.github/workflows/release-image.yml`은 `v1.2.3` 형식의 Git 태그가 push될 때만 운영 이미지를 GHCR에 발행한다.

## 릴리스 절차

1. `package.json`의 `version`을 릴리스 버전으로 변경한다.
2. Pull Request의 CI 품질 게이트를 통과시킨다.
3. 병합된 commit에 동일한 버전의 태그를 생성한다.

```bash
git tag v1.2.3
git push origin v1.2.3
```

태그와 package version이 다르거나 전체 타입 검사·테스트·빌드가 실패하면 이미지는 게시되지 않는다.

## 게시 결과

- `ghcr.io/<owner>/<repository>:1.2.3`
- 안정 버전이면 major, minor와 `latest` 태그
- 이미지 SBOM
- 최대 수준의 build provenance
- workflow summary에 기록되는 불변 image digest

실제 배포에서는 변경 가능한 `latest` 대신 `ghcr.io/<owner>/<repository>@sha256:...` 형식의 digest를 사용한다. API, 모든 worker와 scheduler에 같은 digest를 지정한 뒤 migration과 배포 후 검증을 순서대로 실행한다.
