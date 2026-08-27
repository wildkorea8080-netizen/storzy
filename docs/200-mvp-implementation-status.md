# MVP 구현 현황과 출시 차단 항목

기준일은 2026-08-21이다. 이 문서는 “이미 만든 기능을 반복해서 다시 고치는 작업”과 “아직 없는 출시 기능을 새로 만드는 작업”을 구분하는 운영 기준이다. 기능 완료는 코드 존재가 아니라 저장소의 자동 테스트, 로컬 미리보기, 실환경 공급사 검증 여부를 함께 본다.

## 현재 구현 현황

| 영역 | 저장소 구현 | 로컬 검증 | 실환경 검증 | 판정 |
|---|---|---|---|---|
| 브랜드 온보딩·Structured Outputs·revision 승인 | 완료 | 완료 | OpenAI 운영 키 smoke 필요 | 조건부 완료 |
| Printful 카탈로그·결정론적 점수·상품 후보 검수 | 완료 | 완료 | 실제 v2 상품·variant·mockup style·가격·배송 국가 contract 통과 | 완료 |
| AI 상품 콘텐츠·편집 revision·승인 | 완료 | 완료 | OpenAI 비용·지연 관측 필요 | 조건부 완료 |
| 디자인 업로드·검증·Printful 목업 | 완료 | 완료 | 실제 계정에서 티셔츠 목업 생성 E2E 통과 | 완료 |
| Shopify 상품 `productSet` 게시 | 완료 | preview adapter 완료 | 개발 스토어 draft productSet E2E 통과 | 완료 |
| 스토어 템플릿·페이지·메뉴 게시 | 완료 | preview storefront 완료 | 테마·페이지 개발 스토어 E2E 필요 | 조건부 완료 |
| Shopify OAuth·토큰 갱신·Webhook 동기화 | 완료 | contract·실패 경로 완료 | 공개 앱 설정 배포·심사 필요 | 조건부 완료 |
| 주문 수신·차단 규칙·Printful 주문·배송 반영 | 완료 | preview 주문 흐름 완료 | Shopify/Printful sandbox 성격의 제한 E2E 필요 | 조건부 완료 |
| 주문 대조·예외 복구·감사 | 완료 | 완료 | 운영 스케줄 장기 실행 확인 필요 | 조건부 완료 |
| 개인정보 Webhook·삭제·보존·SLA·외부 경보 | 완료 | 완료 | Shopify 필수 Webhook 검증 필요 | 조건부 완료 |
| 배포 템플릿·migration·process health·배포 후 검증 | 완료 | 완료 | 선택한 호스팅에 실제 배포 필요 | 조건부 완료 |
| 단일 브랜드 관리자 인증 | 서버 세션·HttpOnly 쿠키·로그아웃 구현, Bearer 호환 유지 | 자동 테스트 완료 | 운영 HTTPS 배포 확인 필요 | 조건부 완료 |
| 다중 사용자·workspace membership·역할 권한 | 확장 경계 문서화, 실행 코드는 미구현 | 미검증 | 미검증 | 파일럿 이후 |

## 앞으로의 작업 우선순위

### P0 — 제품 형태 결정과 인증

1. 첫 출시는 단일 브랜드 파일럿으로 확정했다.
2. 서버 관리자 세션은 구현했으며 운영 HTTPS 환경에서 쿠키와 접근 제한을 검증한다.
3. 파일럿 이후 다중 tenant 전환 시 사용자, workspace membership, 역할(`OWNER`, `OPERATOR`, `VIEWER`)과 초대 흐름을 구현한다.
4. 다중 tenant 전환 때 모든 workspace API에 membership 경계와 교차 workspace 접근 거부 테스트를 추가한다.

다중 tenant용 사용자 테이블은 파일럿 운영 결과와 Shopify embedded app 여부를 확정한 뒤 추가한다.

### P0 — 실제 공급사 E2E

다음 항목은 실제 계정에서 통과했다.

- Printful 목업 생성 (`docs/206`)
- Printful variant·목업 이미지를 포함한 Shopify draft 상품 게시와 멱등 재게시 (`docs/208`)
- Printful draft 주문 생성·원가 재검증과 결정론적 정책 판정 (`docs/209`)

남은 항목은 다음과 같다.

1. Shopify 개발 스토어에 OAuth 연결 (현재는 custom app 토큰 사용)
2. 자체 이미지 호스팅으로 목업 URL 72시간 만료 대응
3. 승인 스토어 초안의 페이지·메뉴 반영 확인
4. Printful 실제 catalog/template 호출 확인 (mockup 은 완료)
5. 비용이 발생하지 않는 범위에서 주문 draft와 비용 검증
6. Shopify 주문 Webhook부터 shipment·fulfillment까지 추적
7. `app/uninstalled` 및 Shopify privacy Webhook 수신 확인

외부 쓰기는 별도 smoke 명령으로 실행하며 기본 테스트 suite에는 포함하지 않는다.

### P0 — 출시 결정값 확정

- 첫 판매 국가와 기준 통화 (실측 원가는 `docs/209` 참고. 미국 배송 기준 티셔츠 원가 USD 20.24)
- 자동 승인 주문 금액·수량·원가 상승 한도
- 반품 주소와 반품 비용 책임
- Shopify 공개 앱 또는 custom app 파일럿
- Printful 계정 연결 및 테스트 주문 비용 정책
- 운영 호스팅과 비밀값 저장 방식

### P1 — 출시 운영

- 실제 Webhook 경보 수신 채널 연결
- 백업·복원 훈련과 장애 runbook 실행
- OpenAI·Shopify·Printful 비용 한도 및 사용량 경보
- Shopify 앱 심사 설명·영상·테스트 계정 준비
- 지원 이메일, 배송·반품 정책 최종 법무 검토

## 완료 판정 규칙

- `완료`: 코드, 자동 테스트, 로컬 또는 실환경 검증이 모두 충족됨
- `조건부 완료`: 기능과 자동 테스트는 있으나 실제 공급사 또는 운영 환경 검증이 남음
- `미구현`: 출시 사용자 흐름에 필요한 실행 코드가 없음
- 버그 수정과 신뢰성 보강은 기존 기능의 완료도를 높이는 작업으로 기록한다.
- 신규 기능은 이 문서의 미구현 또는 출시 차단 항목과 연결한 뒤 시작한다.

## 현재 검증 기준

`npm run check`가 TypeScript 검사, Vitest 전체 suite, 운영 빌드를 순서대로 통과해야 한다. 로컬 미리보기는 `npm run preview:start` 후 `/health`, `/ready`, 관리자 핵심 화면과 보호 API를 확인한다. 실제 공급사 호출은 자격 증명과 외부 쓰기 승인이 필요한 별도 검증으로 남긴다.
