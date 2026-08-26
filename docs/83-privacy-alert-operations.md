# 개인정보 SLA 경보 운영 큐

자동 스캔에서 생성한 개인정보 SLA 경보를 관리자 개인정보 화면에서 확인하고 담당자가 확인 처리할 수 있다.

## 관리자 기능

- 열린 경보와 확인된 경보 목록
- 기한 초과, 실패, 기한 임박 순서의 우선 정렬
- 요청 유형, 스토어 도메인, 처리 기한 표시
- 담당자 확인 처리
- 워크스페이스별 조회 및 확인 경계

확인 처리는 경보를 삭제하지 않는다. `ACKNOWLEDGED` 상태와 `acknowledged_by`, `acknowledged_at`을 보존하며, 요청 문제가 해소된 후 다음 SLA 스캔에서 `RESOLVED`로 전환한다.

## API

- `GET /api/admin/privacy-alerts`
- `POST /api/admin/privacy-alerts/:id/acknowledge`

두 API 모두 관리자 인증이 필요하다. 목록은 기본적으로 `OPEN`, `ACKNOWLEDGED` 경보만 반환하며 `workspaceId`, `status`, `limit` 필터를 지원한다.
