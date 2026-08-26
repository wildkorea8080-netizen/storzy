# 상품 후보 검수 API

## 목적

결정론적 점수 엔진이 생성한 상품 후보를 관리자 화면에서 조회·정렬하고, 운영자가 최종 출시 후보를 승인하거나 제외한다. 평가 결과인 `eligibility`와 사람의 결정인 `decision_status`를 분리해 원래 점수와 제외 근거를 변경하지 않는다.

## 상태 모델

```text
UNREVIEWED ──> APPROVED
     └───────> REJECTED
```

- `APPROVED`는 `ELIGIBLE` 후보에만 허용된다.
- 결정은 단방향이며 반대 상태로 덮어쓸 수 없다.
- 재검토가 필요하면 향후 별도 reset 권한과 audit action으로 추가한다.
- 모든 최초 결정은 `product_candidate_actions`에 actor, 사유, idempotency key와 함께 저장된다.

## 후보 목록

```http
GET /api/workspaces/{workspaceId}/product-candidates
```

가장 최근 `product_candidate_jobs`와 연결된 후보를 반환한다. job이 아직 실행 중이면 job 상태와 빈 목록을 반환한다.

Query parameters:

| 이름 | 값 | 기본값 |
|---|---|---|
| `eligibility` | `ELIGIBLE`, `EXCLUDED` | 전체 |
| `decisionStatus` | `UNREVIEWED`, `APPROVED`, `REJECTED` | 전체 |
| `sort` | `score_desc`, `created_asc` | `score_desc` |
| `limit` | 1~100 | 50 |
| `offset` | 0~10000 | 0 |

응답에는 job·snapshot 메타데이터, 총 후보 수, 페이지 정보, 점수 breakdown, exclusion reason, 원가·권장가·마진과 평가 evidence가 포함된다.

## 후보 결정

```http
POST /api/workspaces/{workspaceId}/product-candidates/{candidateId}/decision
Idempotency-Key: review-20260805-001
Content-Type: application/json

{
  "decision": "APPROVED",
  "actorId": "operator-1",
  "reason": "Initial US and Japan assortment"
}
```

- `Idempotency-Key`는 1~128자의 영문자·숫자·점·밑줄·콜론·하이픈만 허용한다.
- 동일 key와 동일 요청은 이미 저장된 결정을 반환한다.
- 같은 key를 다른 후보나 결정에 재사용하면 `IDEMPOTENCY_CONFLICT` 409를 반환한다.
- 제외 후보 승인은 `CANDIDATE_INELIGIBLE` 409이다.
- 이미 반대 결정을 내린 후보는 `CANDIDATE_ALREADY_DECIDED` 409이다.
- workspace에 속하지 않는 후보는 존재 여부를 노출하지 않고 404를 반환한다.

## 관리자 화면 권장 구성

1. 상단에 job 상태, snapshot 공급사·통화·조회 시각을 표시한다.
2. 기본 탭은 `ELIGIBLE + UNREVIEWED + score_desc`다.
3. 카드에는 점수, 권장가, 원가, 마진, 사이즈·색상, 지역별 재고를 표시한다.
4. 제외 후보 탭에는 `exclusionReasons`를 우선 표시한다.
5. 승인·제외 버튼은 요청마다 새 idempotency key를 만들고 응답 전까지 중복 클릭을 막는다.

## 현재 제한

- offset pagination은 immutable job 결과에 안전하지만 대규모 카탈로그에는 cursor pagination이 더 적합하다.
- 현재 승인 결과는 DB와 감사 로그에만 기록된다. 다음 단계에서 승인된 후보를 상품 콘텐츠 생성 job으로 전달한다.
- 인증·역할 권한은 아직 연결되지 않았으므로 외부 공개 전에 workspace membership과 operator role 검증이 필요하다.
