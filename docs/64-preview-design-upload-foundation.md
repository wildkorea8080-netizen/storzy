# 미리보기 디자인 직접 업로드 기반

디자인 파일 URL을 직접 준비하지 않아도 미리보기에서 PNG/JPEG를 선택할 수 있도록 파일 저장 경계를 먼저 구현한다.

`PreviewDesignUploadService`의 책임은 다음과 같다.

- 허용 MIME: `image/png`, `image/jpeg`
- 최대 파일 크기: 50MB
- 최대 이미지 크기: 가로·세로 각각 20,000픽셀
- 확장자가 아니라 PNG/JPEG 바이너리 서명과 이미지 헤더로 형식 검증
- UUID 파일명으로 `.preview/uploads/{workspaceId}` 디렉터리에 저장
- 외부 계약에는 `https://preview-assets.storzy.local/uploads/{workspaceId}/{uuid}.{ext}` URL 반환
- 엄격한 파일명 allowlist와 경로 정규화로 임의 파일 읽기 차단

이 서비스는 미리보기 전용이다. 운영 환경에서는 S3 호환 object storage의 presigned upload, 악성 파일 검사, 보존 기간과 삭제 정책을 별도 adapter로 구현한다.

다음 연결 단계에서는 관리자 인증이 적용된 binary upload endpoint, 저장 파일 제공 route, `PreviewDesignFileInspector`의 업로드 URL 지원, 디자인 화면의 파일 선택기를 순서대로 연결한다.
