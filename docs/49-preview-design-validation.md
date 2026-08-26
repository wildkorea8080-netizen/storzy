# 미리보기 디자인 검증

운영 API는 공개 HTTPS 이미지에 대한 DNS·MIME·크기·픽셀 검증을 계속 적용한다. 로컬 미리보기는 `PREVIEW_MODE=1`일 때만 `https://preview-assets.storzy.local/seoul-side-design.png`을 3000×3000 PNG 샘플로 해석한다.

이 분리는 SSRF 차단 규칙을 약화하지 않고도 콘텐츠 승인 후 디자인 등록과 해상도 게이트를 체험하기 위한 것이다. 다른 URL은 미리보기에서도 거부된다.
