# 디자인 변경 잠금과 mockup 복구

## 디자인 변경 상태 규칙

동일 candidate의 디자인 파일은 기존 row를 무조건 덮어쓰지 않는다.

| 최신 mockup 상태 | 디자인 변경 |
|---|---|
| job 없음 | 허용 |
| PENDING | 허용 |
| FAILED | 허용하고 job을 PENDING으로 초기화 |
| RUNNING | 차단 |
| WAITING_REMOTE | 차단 |
| SUCCEEDED | 차단 |

원격 생성 중이거나 snapshot이 완성된 디자인 변경은 `DESIGN_ASSET_LOCKED` 충돌을 반환한다. 이는 Shopify 상품 이미지와 실제 주문에 사용되는 인쇄 파일이 서로 달라지는 것을 방지한다.

디자인 등록과 수정은 URL, placement, technique, style IDs의 전후 값을 audit event에 기록한다.

## 실패 job 재대기

`POST /api/workspaces/{workspaceId}/product-candidates/{candidateId}/mockup/requeue`

요청에는 `actorId`와 1~500자 `reason`이 필요하다. 최신 job이 FAILED일 때만 다음 변경을 transaction으로 수행한다.

- status PENDING
- attempts 0
- remote task IDs 제거
- last error와 finished time 제거
- available time을 현재 시각으로 설정
- 사유와 운영자를 audit event에 기록

실패 상태가 아니면 `MOCKUP_NOT_FAILED` 충돌을 반환한다.
