# 디자인·목업 관리자 화면

`/admin/designs`는 승인된 상품 후보만 조회하여 디자인 파일과 Printful mockup 설정을 등록한다.

## 입력

- HTTPS 디자인 파일 URL
- Printful placement
- Printful technique
- 운영자가 Printful 카탈로그에서 확인한 mockup style ID 목록
- actor ID

style ID를 AI가 추측하지 않으며, 양의 정수만 API에 전달한다. 기존 후보 evidence에 인쇄 technique이 고정되어 있으면 다른 technique 등록을 거부한다.

## 상태

후보 목록은 디자인 메타데이터와 최신 mockup job의 다음 상태를 함께 반환한다.

- PENDING
- RUNNING
- WAITING_REMOTE
- SUCCEEDED
- FAILED

시도 횟수와 마지막 오류도 API 응답에 포함되며 화면에는 상태와 실패 원인을 표시한다. 디자인 등록 시 승인된 Product Content가 이미 있으면 mockup job이 enqueue된다. Content가 아직 승인되지 않았다면 이후 Content 승인 transaction이 해당 디자인을 찾아 job을 생성한다.

## 보안 경계

화면과 API는 관리자 Bearer token을 사용한다. 파일 자체 업로드와 바이러스·실제 픽셀 크기 검증은 아직 외부 object storage 연결 전이므로 후속 작업이다.
