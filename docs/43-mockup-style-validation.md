# Printful 목업 스타일 검증

## 목적

운영자가 입력한 목업 스타일 ID가 승인 후보의 상품·placement·인쇄 기법과 실제로 일치하는지 확인한다. 숫자 형식만 검사한 값을 Printful 작업에 전달하지 않는다.

## 스냅샷 계약

Printful `mockup-styles` 응답을 다음 구조로 카탈로그 스냅샷에 보존한다.

```json
{
  "placement": "front",
  "technique": "dtg",
  "printAreaWidthIn": 12,
  "printAreaHeightIn": 16,
  "targetDpi": 150,
  "allowedMockupStyleIds": [10, 11]
}
```

후보 검토 API는 이를 `designOptions`로 반환하며 관리자 화면은 선택한 placement·technique의 허용 ID를 표시하고 신규 등록 시 기본값으로 채운다.

## 등록 게이트

- 입력 ID는 중복 없는 양의 정수여야 한다.
- 카탈로그 규격이 있으면 모든 입력 ID가 `allowedMockupStyleIds`에 포함되어야 한다.
- 규격은 있지만 허용 스타일이 비어 있으면 `DESIGN_MOCKUP_STYLES_MISSING`으로 중단한다.
- 다른 상품 또는 placement의 ID가 포함되면 `DESIGN_MOCKUP_STYLE_MISMATCH`로 중단한다.
- 카탈로그 placement 규격 자체가 없으면 기존 DPI 흐름과 동일하게 `GUIDELINE_MISSING` 검토 상태로 저장하고 자동 목업은 시작하지 않는다.

운영자 인쇄 규격 검토 시 별도 allowlist가 제공되지 않으면 현재 디자인에 저장된 스타일 ID를 운영자가 함께 확인한 것으로 기록한다. API 호출자는 더 좁은 명시적 `allowedMockupStyleIds`를 제출할 수 있다.
