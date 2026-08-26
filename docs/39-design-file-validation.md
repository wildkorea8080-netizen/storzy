# 디자인 파일 URL 검증

운영 API는 디자인 등록 전에 외부 URL을 제한적으로 조회해 Printful mockup 입력으로 사용할 수 있는지 검증한다.

## 검증 규칙

- URL 최대 1,000자
- 표준 HTTPS만 허용하며 URL credentials와 별도 port 차단
- DNS의 모든 결과가 public address여야 함
- loopback, link-local, private, unspecified, multicast 주소 차단
- redirect 최대 3회, redirect마다 DNS 재검증
- `image/png` 또는 `image/jpeg`만 허용
- Content-Range 또는 Content-Length로 1 byte 이상, 50MB 이하 확인
- 요청 timeout 10초

검증 요청은 `Range: bytes=0-0`, `redirect: manual`을 사용해 전체 파일 다운로드와 자동 redirect를 피한다. MIME type, byte size, 최종 URL과 검증 시각을 `design_assets`에 저장한다.

이 검사는 파일 헤더 수준의 사전 검증이다. 픽셀 크기, DPI, 투명도와 실제 이미지 decoding은 Printful File API 또는 전용 object storage processing pipeline에서 후속 검증해야 한다.
