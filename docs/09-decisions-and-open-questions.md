# 결정 및 미결정 사항

## 확정된 결정

| ID | 결정 | 이유 | 상태 |
|---|---|---|---|
| ADR-001 | MVP는 모듈러 모놀리스 + 별도 worker | 트랜잭션과 개발 속도를 확보하면서 외부 작업 격리 | 승인 |
| ADR-002 | Shopify GraphQL Admin API 사용 | 신규 공개 앱 기준과 장기 지원 방향 | 승인 |
| ADR-003 | 테마 코드를 AI가 직접 수정하지 않음 | 보안과 회귀 위험을 제한 | 승인 |
| ADR-004 | AI 출력은 JSON Schema strict 계약 사용 | 파싱 안정성과 버전 관리 | 승인 |
| ADR-005 | 점수·가격·주문 차단은 결정론적 코드 | 설명 가능성, 테스트, 비용 안전성 | 승인 |
| ADR-006 | 외부 게시와 주문은 승인/revision 기반 멱등 명령 | 중복과 잘못된 최신값 사용 방지 | 승인 |
| ADR-007 | Webhook은 검증·저장·큐 적재 후 즉시 응답 | 외부 timeout과 재시도 폭주 방지 | 승인 |
| ADR-008 | Printful v2 우선, 필요한 v1은 adapter에 격리 | 신규 API 방향을 따르면서 기능 공백 대응 | 잠정 승인 |
| ADR-009 | Node.js 22+와 TypeScript strict mode 사용 | 공식 SDK 지원, 서버·worker 타입 공유, 장기 LTS 운영 | 승인 |
| ADR-010 | Vitest와 provider fixture로 기본 CI 구성 | 실제 키나 과금 없이 규칙·계약 회귀 검증 | 승인 |
| ADR-011 | PostgreSQL 17을 로컬 기준 DB로 사용 | 트랜잭션, JSON, outbox, 운영 생태계 | 승인 |
| ADR-012 | 외부 API smoke test는 기본 test suite와 분리 | 과금·rate limit·외부 장애가 CI를 불안정하게 만들지 않도록 함 | 승인 |

## 구현 전에 결정할 사항

| 우선순위 | 질문 | 결정 시점 | 영향 |
|---|---|---|---|
| P0 | 단일 브랜드 파일럿인가, 처음부터 다중 tenant SaaS인가? | Phase 0 | 인증, DB 격리, Shopify 배포 방식 |
| P0 | Shopify 공개 앱이 첫 출시 목표인가, custom app 파일럿인가? | Phase 0 | OAuth, 심사, privacy 요건과 일정 |
| P0 | Printful 계정 연결 방식과 테스트 주문 비용 정책은? | Phase 0 | OAuth/token, store mapping, QA |
| P0 | 첫 대상 판매 국가와 기준 통화는? | Phase 0 | 배송, 세금, 가격, 법률 |
| P0 | 주문 자동 승인 금액/수량과 원가 상승 한도는? | Phase 4 전 | 재무 위험과 운영 부하 |
| P0 | 반품 주소·정책의 책임 주체는 누구인가? | 스토어 공개 전 | 페이지 문구, 지원, 손실 부담 |
| P1 | 템플릿의 기반 Shopify theme과 라이선스는? | Phase 3 전 | 구현·배포·상업 이용 |
| P1 | AI 모델과 데이터 처리 region/policy는? | Phase 1 | 비용, 지연, 개인정보 |
| P1 | production hosting과 queue provider는? | Phase 0 후반 | 배포, 비용, 운영 방식 |

## 현재 가정

- 사용자는 자체 디자인에 대한 사용 권리를 보유한다.
- MVP는 미국과 일본 판매를 염두에 두지만 첫 파일럿 국가는 아직 확정되지 않았다.
- 상품은 Shopify에서 결제되고 STORZY는 결제 수단 정보를 저장하지 않는다.
- 상품 공개와 예외 주문 수동 승인은 사람이 수행한다.
- initial product count 20은 목표이지 한 번의 API 호출 크기 보장이 아니다.

가정이 틀리면 관련 ADR과 PRD를 먼저 수정한다.
