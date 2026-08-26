# 관리자 Brand Profile 온보딩

`GET /admin/onboarding`은 12개 질문으로 workspace와 Brand Profile generation revision을 만든다. 대상 국가, 고객, 스타일, 가격대, 색상, 초기 상품 수, 브랜드 이야기, 차별점, voice, 선호 상품과 제약을 구조화해 기존 onboarding API에 제출한다.

화면은 revision ID를 session storage에 보관하고 `GENERATING` 동안 2초 간격으로 조회한다. `REVIEW_REQUIRED`가 되면 Structured Output JSON을 표시하고 승인 버튼을 활성화한다. 승인된 profile만 상품 후보 생성 이벤트로 이어진다.

AI 실행에는 별도 generation worker와 `OPENAI_API_KEY`가 필요하다. worker가 실행되지 않으면 revision은 `GENERATING`에 머물며 화면에 이를 명확히 표시한다.
