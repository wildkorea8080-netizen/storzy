# 주문 대조 주기 실행

운영 환경의 스케줄러는 다음 일회성 명령을 주기적으로 실행한다.

```bash
npm run start:order-reconciliation:scan
```

개발 환경에서는 `npm run order-reconciliation:scan`을 사용할 수 있다.

## 실행 범위

- 활성 워크스페이스의 연결된 Shopify 스토어만 순회한다.
- 기본 최근 조회 범위는 24시간이며 `ORDER_RECONCILIATION_WINDOW_HOURS`로 1~168시간 사이에서 조정한다.
- 저장된 암호화 credential만 사용하며 토큰은 로그에 기록하지 않는다.
- 각 워크스페이스 실패는 다른 워크스페이스 스캔을 중단하지 않는다.
- 하나라도 실패하면 프로세스 종료 코드를 실패로 설정해 스케줄러 경보와 연결할 수 있다.

## 중복 실행 방지

PostgreSQL advisory lock `storzy:order-reconciliation`을 사용한다. 이전 스캔이 실행 중이면 새 실행은 외부 API를 호출하지 않고 `ALREADY_RUNNING`으로 종료한다.

이 명령은 주문을 수정하거나 Printful 작업을 만들지 않는다. Shopify 주문 상태를 읽고 기존 대조 이슈 생성·갱신·자동 해결 로직만 실행한다.
