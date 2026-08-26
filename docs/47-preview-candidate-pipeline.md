# 미리보기 상품 후보 파이프라인

## 목적

브랜드 프로필 승인 이후 화면이 멈추지 않고 실제 비동기 경로를 통해 상품 후보 검토 단계까지 진행되게 한다.

## 구성

`preview-pipeline-worker`는 한 프로세스에서 다음 worker를 병렬 실행한다.

1. Outbox publisher: `brand-profile.approved` 이벤트를 소비해 `product_candidate_jobs`를 생성한다.
2. Candidate worker: 미리보기 고정 카탈로그를 정량 평가하고 immutable snapshot과 후보를 저장한다.

고정 카탈로그에는 티셔츠, 후드티, 토트백, 포스터가 포함되며 가격, 배송 국가, 옵션, placement, DPI, 목업 스타일 allowlist, variant 매핑을 제공한다.

## 격리

- 외부 Printful API를 호출하지 않는다.
- 운영용 `candidate-worker.ts`와 별도 엔트리포인트다.
- 실제 outbox 소비, job lease, 후보 평가, snapshot 저장 로직은 운영 코드와 동일하다.
- `preview:start`와 `preview:stop`이 프로세스 생명주기를 관리한다.

## 체험 흐름

```text
브랜드 생성 → 생성 결과 검토 → 브랜드 승인 → outbox 소비 → 상품 후보 생성 → 상품 메뉴에서 후보 승인
```
