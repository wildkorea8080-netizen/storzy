# 관리자 상품 후보·콘텐츠 검수 화면

`GET /admin/catalog`은 상품 자동화의 두 검수 단계를 제공한다.

상품 후보 탭은 결정론적 총점, 점수 breakdown, 권장가, 승인 원가, 마진을 표시한다. `ELIGIBLE`이면서 `UNREVIEWED`인 후보만 승인할 수 있으며 거절은 사유를 요구한다. 승인 시 기존 candidate decision API가 콘텐츠 생성 job을 만든다.

상품 콘텐츠 탭은 product별 최신 revision을 보여준다. 전체 Structured Output JSON을 편집해 저장하면 기존 revision을 덮어쓰지 않고 새 `EDITOR/DRAFT` revision을 만든다. 서버는 JSON Schema와 승인 후보의 authoritative price를 다시 검증한다. 승인은 확인 대화상자를 거쳐 mockup 및 Shopify publication gate로 전달된다.

운영에서 `ADMIN_API_TOKEN`이 설정되면 candidate/content 관리 API도 동일한 Bearer 인증으로 보호된다. workspace와 token은 다른 관리자 화면과 같은 session storage를 공유한다.
