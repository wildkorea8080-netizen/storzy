# AI 상품 콘텐츠 생성

## 흐름

1. 운영자가 `ELIGIBLE` 후보를 승인한다.
2. 승인 transaction이 후보 결정, 감사 action, `product_content_jobs`를 원자적으로 저장한다.
3. content worker가 lease로 job을 claim하고 승인 후보·Brand Profile을 로드한다.
4. OpenAI Responses API Structured Outputs로 `product-content.schema.json` 결과를 생성한다.
5. 서버가 JSON Schema와 권장가·통화를 다시 검증한다.
6. 콘텐츠와 OpenAI request ID·latency·token telemetry를 하나의 transaction으로 저장한다.

## 안전 규칙

- Brand Profile과 후보 데이터는 신뢰하지 않는 입력 데이터로 취급한다.
- 소재, 원산지, 인증, 배송 약속, 지속가능성 주장을 추측하지 않는다.
- 확인되지 않은 정보는 `warnings`에 기록한다.
- AI의 `pricing_hint`는 서버의 권장가와 통화가 정확히 일치해야 한다. 불일치는 영구 실패다.
- schema 오류와 authoritative price 불일치는 재시도하지 않는다. 408·429·5xx와 네트워크 오류만 backoff 재시도한다.

## 실행

```bash
npm run content
```

`OPENAI_API_KEY`가 필요하며 기본 모델은 공식 resolver 기준 `gpt-5.6-sol`이다. `OPENAI_MODEL`로 교체할 수 있다.

공식 근거:

- [OpenAI 최신 모델 가이드](https://developers.openai.com/api/docs/guides/latest-model)
- [GPT-5.6 Sol 모델](https://developers.openai.com/api/docs/models/gpt-5.6-sol)

## 저장 결과

- 영문 제품명과 한글 관리명
- 컬렉션, 설명, 핵심 특징
- 소재·사이즈·관리 문구
- SEO 제목·설명
- 태그와 채널별 SNS 문구
- 가격 표시와 warnings

## 현재 제한

- 실제 OpenAI 호출 smoke test는 API key가 없는 로컬 검증에서 실행하지 않는다. client는 fixture로 계약을 검증한다.
- 생성된 콘텐츠의 관리자 수정·승인 revision API는 다음 단계다.
- Shopify 등록은 콘텐츠 승인 이후에만 연결한다.
