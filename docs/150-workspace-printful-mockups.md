# 워크스페이스별 Printful 목업 처리

Printful 목업 worker는 `printful_mockup_jobs.workspace_id`를 claim 결과에 포함하고 해당 워크스페이스의 암호화 저장 Printful token과 Store ID를 사용한다. 원격 task 생성과 후속 상태 조회가 동일한 연결을 사용하므로 여러 Printful 스토어의 task가 섞이지 않는다.

Printful 연결 전 생성된 목업 작업은 `WAITING_FOR_PRINTFUL_CONNECTION`으로 재대기하며 attempts 증가를 되돌린다. 나중에 관리자가 Printful 연결을 등록하면 PENDING 작업이 자동으로 이어진다.

전역 `PRINTFUL_TOKEN`, `PRINTFUL_STORE_ID`는 단일 스토어 호환 경로로 유지하며 워크스페이스 저장 연결이 우선한다.
