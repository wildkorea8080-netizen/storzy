# 미리보기 디자인 직접 업로드 HTTP·UI 연결

미리보기 관리자는 디자인 화면에서 PNG/JPEG 파일을 선택한 뒤 `선택한 파일 업로드` 버튼으로 명시적으로 전송한다. 업로드 성공 시 서버가 반환한 STORZY 자산 URL과 이미지 크기가 표시되고, 해당 URL이 기존 디자인 등록 입력란에 자동 반영된다.

## HTTP 계약

- `POST /api/workspaces/{workspaceId}/design-uploads`
- 관리자 Bearer 인증 필수
- 업로드 전에 워크스페이스 존재 여부와 `ACTIVE` 상태 확인
- 요청 본문은 원본 이미지 binary
- `Content-Type`은 `image/png` 또는 `image/jpeg`
- 최대 요청 크기 50MB
- 응답은 `fileUrl`, `workspaceId`, MIME, byte 크기, 가로·세로 픽셀을 포함

업로드 파일은 `GET /preview-assets/uploads/{workspaceId}/{uuid}.{ext}`로 제공하며 `nosniff`와 제한된 cache header를 적용한다. 임의 파일 경로는 정규식 allowlist에서 거절한다. 파일은 워크스페이스별 하위 디렉터리에 저장되며 다른 워크스페이스 경로로 조회하면 404를 반환한다.

`PreviewDesignFileInspector`는 번들 샘플 URL과 업로드 URL을 모두 지원한다. 따라서 업로드 파일도 기존 인쇄 영역·DPI·목업 스타일 검증을 우회하지 않고 동일한 디자인 등록 서비스를 통과한다.

디자인 등록 서비스는 업로드 URL의 워크스페이스와 요청 워크스페이스가 같은지 파일 검사와 DB 접근 전에 확인한다. 따라서 URL을 알고 있어도 다른 워크스페이스 상품에 연결할 수 없다.

업로드 API는 바이너리 본문을 읽기 전에 워크스페이스를 단건 조회한다. 존재하지 않는 ID는 404, 비활성 워크스페이스는 `WORKSPACE_INACTIVE`로 거절하므로 고아 파일이 생성되지 않는다.

이 경로는 `PREVIEW_MODE=1`에서만 생성된다. 운영 환경은 object storage presigned upload와 악성 파일 검사 adapter를 별도로 사용한다.
