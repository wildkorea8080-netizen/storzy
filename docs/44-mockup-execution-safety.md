# 목업 worker 실행 시점 안전 검증

## 목적

디자인 등록 시점의 검증만 신뢰하지 않고 Printful 원격 작업 생성 직전에 동일한 안전 조건을 다시 확인한다. 과거 작업, 수동 DB 변경, 불완전한 마이그레이션으로 생긴 stale queue가 외부 제작 흐름에 진입하는 것을 방지한다.

## 실행 게이트

worker의 `createPayload`는 다음 조건을 모두 만족해야 payload를 반환한다.

1. 디자인의 `resolution_status`가 `PASSED`다.
2. 검증된 원본 `width_px`, `height_px`가 존재한다.
3. 저장된 `print_guideline`의 placement와 technique이 현재 디자인과 일치한다.
4. 원본 픽셀과 인쇄 영역으로 DPI를 다시 계산한 결과가 목표 DPI 이상이다.
5. 재계산한 유효 DPI가 저장된 `effective_dpi`와 일치한다.
6. 모든 `mockup_style_ids`가 저장된 allowlist에 속한다.
7. 카탈로그 스냅샷에 전송 가능한 variant가 하나 이상 존재한다.

## 실패 동작

검증 실패는 `MOCKUP_SAFETY_BLOCKED` 접두사가 포함된 오류로 처리한다. worker는 Printful API를 호출하지 않고 작업을 `FAILED`로 전환하며 `last_error`에 원인을 남긴다. 실패 작업은 기존 Operations Overview와 Designs 화면의 운영 주의 항목에 자동 노출된다.

원격 task ID가 이미 발급된 `WAITING_REMOTE` 작업은 디자인 변경 잠금이 적용되므로 새 payload를 만들지 않고 기존 원격 상태만 조회한다.
