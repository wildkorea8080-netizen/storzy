# 미리보기 디자인 업로드 쿼터

미리보기 업로드는 워크스페이스별 디스크 사용량을 제한한다.

- 기본 파일 수: 워크스페이스당 100개
- 기본 누적 용량: 워크스페이스당 500MB
- 개별 파일 제한: 50MB
- 집계 대상: UUID 형식의 PNG/JPEG 일반 파일

저장소는 현재 사용량 확인과 새 파일 쓰기를 하나의 직렬 구간에서 수행한다. 동시 요청이 같은 사용량을 보고 모두 저장되는 경쟁 조건을 방지한다. 한도 초과는 `DESIGN_UPLOAD_QUOTA_EXCEEDED`와 HTTP 409로 반환하며 파일을 생성하지 않는다.

설정 환경 변수는 `PREVIEW_UPLOAD_DIRECTORY`, `PREVIEW_UPLOAD_MAX_FILES`, `PREVIEW_UPLOAD_MAX_BYTES`다.

관리자 화면은 `GET /api/workspaces/{workspaceId}/design-uploads`로 현재 `fileCount`, `sizeBytes`, `maxFiles`, `maxBytes`를 조회한다. 이 경로도 관리자 인증과 활성 워크스페이스 검증을 요구한다.

이 제한은 미리보기 로컬 저장소의 안전장치다. 운영 object storage에서는 tenant quota, presigned URL 만료, lifecycle rule과 비용 알림을 공급자 정책으로 함께 적용한다.
