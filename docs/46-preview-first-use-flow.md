# 미리보기 첫 사용 흐름

## 목적

빈 데이터베이스에서 운영 현황만 보이고 다음 행동을 알 수 없던 문제를 해결한다. 미리보기 사용자는 첫 브랜드 생성 안내를 통해 온보딩으로 이동하고, 외부 OpenAI 키 없이도 전체 입력·생성·검토 UI를 체험할 수 있다.

## 빈 상태 UX

- 선택된 워크스페이스가 없으면 운영 현황 상단에 `브랜드 만들기` CTA를 표시한다.
- 세션에 워크스페이스가 있거나 인증된 목록에서 현재 항목을 찾으면 CTA를 숨긴다.
- 모바일에서는 안내와 버튼을 세로로 배치한다.

## 미리보기 생성 worker

`preview:start`는 API와 함께 `preview-generation-worker`를 실행한다. 이 worker는 온보딩 답변을 스키마 `1.0.0`의 결정론적 Brand Profile로 변환한다.

- 외부 API와 OpenAI 키를 사용하지 않는다.
- 실제 운영용 `worker.ts`와 분리되어 프로덕션 생성 경로에 영향을 주지 않는다.
- 실제 generation queue, lease, retry, schema validation을 그대로 통과한다.
- `preview:stop`에서 API·worker·PostgreSQL을 함께 종료한다.

미리보기 결과는 제품 판단용 예시이며 실제 AI 품질 평가에 사용하지 않는다.
