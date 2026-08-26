# 보안·개인정보·신뢰성

## 1. 위협 경계

보호 대상은 Shopify/Printful/OpenAI 자격 증명, 디자인 원본, 브랜드 비공개 정보, 주문·배송 개인정보, 외부 게시 권한이다.

주요 위협:

- OAuth state 변조, 세션 탈취, 다른 workspace 리소스 접근
- Webhook 위조·재전송·중복
- 암호화되지 않은 provider token 또는 로그 유출
- 업로드 파일을 통한 악성 콘텐츠와 저장소 남용
- 온보딩/상품 텍스트를 통한 prompt injection
- 잘못된 재시도로 상품·주문 중복 생성
- 운영자의 과도한 수동 승인 권한

## 2. 필수 통제

### 인증과 권한

- 서버 측 세션, CSRF 방어, OAuth `state`/nonce 검증
- 모든 엔터티 조회에 workspace 경계 적용
- 사용자, 운영 관리자, background worker 권한 분리
- 민감 액션(외부 게시, 주문 수동 승인, 연결 해제)에 재인증 또는 강화된 확인 검토

### 비밀과 암호화

- provider token은 비밀관리 시스템 또는 envelope encryption으로 저장
- TLS 사용, DB/객체 저장소 at-rest encryption
- 로그·오류 추적에서 Authorization, cookie, 주소, raw payload를 마스킹
- 비밀 회전과 연결 해제 시 폐기 절차 제공

### Webhook

- 파싱 전에 raw body로 서명 검증
- constant-time signature 비교
- topic, shop/store identity, timestamp/수신 시각 검증
- unique event constraint와 처리 상태 기록
- 원본 payload 접근을 최소 권한으로 제한

### 파일

- 업로드 확장자가 아니라 실제 MIME과 파일 signature 확인
- 크기, 픽셀, 압축 폭탄, 악성코드 검사
- 원본은 비공개 bucket에 저장하고 짧은 수명의 signed URL 사용
- 사용자 파일명과 object key 분리
- Printful에 전달한 checksum과 revision 기록

### AI

- 사용자 텍스트는 신뢰할 수 없는 데이터로 구분
- Structured Outputs와 서버 측 allowlist/validator 적용
- AI 출력에 URL, HTML, Liquid가 포함되면 sanitization
- 가격, 권한, 주문 액션 도구를 모델에 직접 부여하지 않음
- 프롬프트와 로그에 개인정보·비밀을 포함하지 않음

## 3. Shopify 앱 출시 요건

- 필요한 최소 API scope만 요청한다.
- 주문과 고객/배송 데이터를 사용하면 protected customer data 요건과 심사 일정을 확인한다.
- 공개 앱 필수 privacy webhook을 구성하고 실제 삭제/제공 절차를 구현한다.
- 앱 제거 이벤트에서 토큰을 폐기하고 예약 작업을 중지한다.
- 개인정보처리방침, 데이터 처리 목적, 보존/삭제 정책을 출시 전에 공개한다.

법률 준수 여부는 이 문서만으로 확정하지 않는다. 대상 국가가 확정되면 개인정보·소비자보호·세금·상표 표시를 전문가와 검토한다.

## 4. 신뢰성 목표

| 영역 | 목표 |
|---|---|
| 승인되지 않은 게시 | 0건 |
| Printful 중복 주문 | 0건 |
| Webhook ingress 가용성 | 월 99.9% 목표 |
| 정상 Webhook 큐 적재 | p95 2초 이하 |
| 주문 상태 reconciliation | 최소 일 1회, 초기에는 더 짧은 주기 검토 |
| 장애 복구 | 주문 원장을 기준으로 안전하게 재처리 가능 |

## 5. 관찰 가능성

- 모든 요청에 correlation ID를 부여하고 provider request ID와 연결한다.
- metrics, structured logs, traces를 workspace와 주문 ID로 검색 가능하게 하되 개인정보는 제외한다.
- 알림: Webhook 실패 급증, subscription 제거, queue backlog, dead letter, AI 비용 급증, 주문 unknown 상태, 원가 급등.
- 외부 status page 장애와 내부 오류를 구분한다.
- 대시보드 지표에서 고유 주문 수와 retry attempt 수를 구분한다.

## 6. 출시 전 테스트

- OAuth 설치/재설치/거부/권한 변경/제거
- Webhook 정상·위조·중복·순서 역전·지연·대용량
- provider timeout 직후 실제 성공한 모호한 결과
- 부분 목업, 부분 배송, 품절, 비용 급등
- 다중 통화와 반올림 경계
- workspace 간 IDOR와 관리자 권한 상승
- 악성 파일, HTML/스크립트 포함 AI 결과, prompt injection fixture
- 개인정보 요청/삭제와 데이터 보존 만료

