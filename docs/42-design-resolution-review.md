# 디자인 인쇄 규격 운영자 검토

## 목적

Printful 카탈로그 스냅샷에 placement 규격이 없어 `GUIDELINE_MISSING`이 된 디자인을 안전하게 복구한다. 운영자는 검증한 실제 인쇄 영역을 입력할 수 있지만 최소 DPI 검사를 우회할 수는 없다.

## API

```http
POST /api/workspaces/{workspaceId}/product-candidates/{candidateId}/design-resolution/override
Authorization: Bearer {adminToken}
Idempotency-Key: {unique-key}
Content-Type: application/json

{
  "printAreaWidthIn": 12,
  "printAreaHeightIn": 16,
  "targetDpi": 150,
  "actorId": "operator-id",
  "reason": "Verified against the current Printful product template"
}
```

## 처리 규칙

- 승인된 후보에 연결된 `GUIDELINE_MISSING` 디자인만 검토할 수 있다.
- 검증된 이미지의 저장 픽셀 크기가 반드시 존재해야 한다.
- 인쇄 영역은 각 축 0보다 크고 100인치 이하여야 한다.
- 목표 DPI는 150~1200 범위의 정수여야 한다.
- 원본 픽셀이 계산된 최소 크기에 미달하면 `DESIGN_RESOLUTION_TOO_LOW`로 거부한다.
- 통과하면 `resolution_status=PASSED`로 전환하고 승인된 콘텐츠 revision의 목업 작업을 생성한다.
- 같은 `Idempotency-Key` 재전송은 같은 결과를 반환하며, 다른 디자인에 재사용하면 충돌로 거부한다.

## 감사와 추적

입력 규격, 유효 DPI, 작업자, 사유를 `design_resolution_overrides`에 보존하고 `design-resolution.overridden` 감사 이벤트를 기록한다. 관리자 화면은 검토 대기 디자인에만 입력 패널을 제공한다.
