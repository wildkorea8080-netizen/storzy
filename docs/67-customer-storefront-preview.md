# 고객 관점 스토어 미리보기

관리자는 Shopify 게시가 완료된 최신 Store Config를 실제 고객 화면 형태로 확인할 수 있다.

- 화면: `GET /preview/store/{workspaceId}`
- 데이터: `GET /api/preview/workspaces/{workspaceId}/storefront`
- 대상 revision: 해당 워크스페이스에서 revision이 가장 높은 `PUBLISHED` 구성

미리보기는 Store Config의 테마 색상, 내비게이션, Home, Shop, Collections, About, FAQ, Shipping, Contact 콘텐츠를 사용한다. 상단에는 미리보기이며 실제 결제가 발생하지 않는다는 안내를 고정한다.

스토어 관리 화면은 선택한 revision이 `PUBLISHED`일 때만 `고객 화면 미리보기` 링크를 표시한다. 미리보기 경로와 데이터 API는 `PREVIEW_MODE=1`에서만 등록되며 운영 서버에서는 404다.

고객 화면의 상품 grid는 `shopify_publication_jobs.status='SUCCEEDED'`인 승인 콘텐츠만 사용한다. 상품명, 설명, 컬렉션, 태그, 권장 판매가, 통화, Shopify 상품 ID와 Printful 목업 snapshot URL을 정규화한다. 미리보기 Printful client의 URL은 실제 이미지 파일이 아니므로 로컬 상품 플레이스홀더를 표시하고, 원본 목업 URL은 API 데이터에 보존한다.

내비게이션은 `#home`, `#shop`, `#collections`, `#about`, `#faq`, `#shipping`, `#returns`, `#contact` 해시 경로를 사용한다. Home은 히어로·추천 상품·브랜드 스토리를, Shop과 Collections는 게시 상품 grid를, 나머지는 Store Config의 페이지 제목과 본문을 표시한다. 모바일에서도 메뉴를 숨기지 않고 가로 스크롤로 제공하며 현재 페이지를 강조한다.

게시 상품 카드는 `#product/{contentRevisionId}` 상세 경로로 연결된다. 상세 화면은 상품명, 컬렉션, 권장 판매가, 설명과 태그를 표시하며 Shop 복귀 동선을 제공한다. 존재하지 않는 상품 ID는 빈 화면 대신 복구 가능한 안내를 표시한다. 상세 화면에서는 Shop 메뉴를 활성 상태로 유지한다.

상품 상세의 `미리보기 상품` 버튼은 실제 주문 대신 브라우저 장바구니에 상품을 담는다. 장바구니는 workspace별 localStorage key로 격리하며 수량 증가·감소·삭제와 합계를 제공한다. 게시 목록에서 사라진 상품은 합계에서 제외한다. 결제 버튼은 비활성 안내로 표시하여 미리보기에서 외부 주문이나 비용이 발생하지 않도록 한다.

장바구니의 결제 안내를 선택하면 체크아웃 미리보기 모달을 연다. 이메일, 배송 국가, 이름, 우편번호, 주소의 브라우저 필수값 검증과 지원 국가 확인만 수행한다. 이 기능은 API POST, Shopify Checkout, Printful 주문 생성 호출을 포함하지 않으며 완료 후에도 입력한 개인정보를 서버나 localStorage에 저장하지 않는다.

Shop과 Collections 화면은 게시 상품을 대상으로 상품명·설명·태그 검색, 컬렉션 필터, 추천순·이름순·가격순 정렬을 제공한다. 모든 조건은 고객 브라우저에서만 적용하며 결과 건수, 빈 결과 안내와 필터 초기화 동선을 함께 표시한다.

페이지 이동 시 문서 제목, meta description, Open Graph title·description·type·site name과 Twitter card를 현재 Store Config 콘텐츠로 갱신한다. 상품 상세에서는 가격·통화·재고 상태가 포함된 schema.org Product JSON-LD를 추가하고 다른 페이지로 이동하면 제거한다. 로컬 미리보기 자체는 검색 결과에 노출되지 않도록 정적 `noindex,nofollow`를 유지한다.

키보드 사용자는 `본문으로 바로가기` 링크로 상품 콘텐츠에 즉시 이동할 수 있다. 현재 메뉴는 `aria-current`, 페이지 이동은 polite live region과 제목 포커스로 전달한다. 모든 인터랙션에 `:focus-visible` 표시를 제공하고 Escape 키로 장바구니 패널을 닫아 트리거로 복귀한다. 운영체제의 reduced motion 설정이 활성화되면 스크롤과 전환 효과를 제거한다.

장바구니가 열리면 패널을 modal dialog로 알리고 닫기 버튼으로 포커스를 이동한다. 체크아웃 진입 요소는 네이티브 button으로 보정해 키보드와 보조기술에서도 실행 가능하게 한다.

상품 카드와 상세 화면은 mockup snapshot URL이 HTTPS이며 Printful 또는 Printful user content 하위 도메인일 때만 원격 이미지를 표시한다. 다른 host, 잘못된 URL, 로딩 실패는 로컬 플레이스홀더로 대체한다. 첫 상품은 eager, 나머지는 lazy loading을 사용하고 상품명을 대체 텍스트로 설정한다. CSP의 `img-src`도 같은 공급자 범위로 제한한다.

고객 화면의 본문, 장바구니, 검색, SEO와 이미지 모듈이 요청하는 동일 workspace storefront GET은 페이지 수명 동안 하나의 네트워크 요청으로 합친다. 소비자마다 `Response.clone()`을 반환하여 body 소비 충돌을 방지한다. 같은 origin의 정확한 preview storefront 경로만 캐시하며 실패 응답과 네트워크 오류는 즉시 제거해 다음 요청에서 복구할 수 있게 한다.

첫 응답을 기다리는 동안 레이아웃 이동을 줄이는 로딩 스켈레톤을 표시한다. 브라우저가 offline 상태가 되면 상단 상태 안내를 노출하며, API 오류에는 다시 시도 버튼을 추가한다. 8초 이상 응답이 없으면 지연 안내와 동일한 복구 동선을 제공한다. 모션 감소 환경에서는 스켈레톤 애니메이션을 중단한다.
