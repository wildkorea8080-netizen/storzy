# 스토어 삭제 감사 데이터 확장 익명화

`SHOP_REDACT` 요청이 `COMPLETED`로 전환되기 직전에 PostgreSQL 트리거가 최근 추가된 provider 감사 테이블을 같은 트랜잭션에서 익명화한다.

- Printful 주문 이벤트: 원격 주문 ID와 오류 상세 제거
- Shopify 배송 이벤트: fulfillment ID와 오류 상세 제거
- 배송 수동 재시도: 운영자 자유 입력 사유를 `REDACTED`로 교체
- Printful 원격 초안 정리: 원격 주문 ID를 내부 redaction ID로 교체하고 사유 제거

감사 이벤트의 종류, 처리 시각, 내부 관계 ID는 운영 무결성 확인을 위해 유지하며 provider 식별자와 자유 입력 문자열은 남기지 않는다. 트리거는 애플리케이션 외의 승인 경로에도 동일하게 적용된다.
