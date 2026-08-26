# 개인정보 경보 전송 복구

관리자 개인정보 화면에서 Webhook 전송 상태를 확인하고 실패한 전송을 재시도 대기열로 되돌릴 수 있다.

## 표시 항목

- 전송 상태
- 누적 시도 횟수
- 마지막 HTTP 응답 상태
- 마지막 오류
- 전송 완료 시각

## 재전송 조건

- 개인정보 경보가 `OPEN` 또는 `ACKNOWLEDGED` 상태여야 한다.
- 전송 상태가 `FAILED`여야 한다.
- 담당자 ID와 1~500자의 재전송 사유가 필요하다.
- 선택된 워크스페이스 밖의 경보는 변경할 수 없다.

재전송 작업은 즉시 외부 요청을 보내지 않는다. 전송 레코드를 `PENDING`으로 변경하고 다음 `privacy-alerts:deliver` 실행에서 처리한다.

모든 수동 재전송은 `privacy_alert_delivery_actions`에 담당자, 사유, 이전·이후 상태와 함께 기록된다.

## API

`POST /api/admin/privacy-alerts/:id/retry-delivery`
