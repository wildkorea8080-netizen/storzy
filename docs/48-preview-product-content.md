# 미리보기 상품 콘텐츠 파이프라인

미리보기 환경에서도 `상품 후보 승인 → 콘텐츠 job → 상품 콘텐츠 검수` 흐름을 실제 DB 계약으로 실행한다.

## 구성

- 후보 승인 API가 `product_content_jobs`를 원자적으로 생성한다.
- `preview-content-worker`가 운영 `ProductContentWorker`와 `PostgresContentJobStore`를 그대로 사용한다.
- 외부 OpenAI 호출만 `PreviewProductContentGenerator`로 대체한다.
- 생성 결과는 운영과 동일한 JSON Schema 검증과 권위 가격 일치 검사를 통과해야 저장된다.

따라서 미리보기에서 후보를 승인하면 `/admin/catalog`의 상품 콘텐츠 탭에 검수 가능한 초안이 자동으로 나타난다. 미리보기 문구는 실제 게시용이 아니며 운영 환경에서는 OpenAI Structured Outputs 생성기로 교체한다.
