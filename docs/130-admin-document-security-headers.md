# 관리자 문서 보안 헤더

모든 관리자 HTML 문서에 다음 브라우저 보안 정책을 공통 적용한다.

- `Cache-Control: no-store, private` 및 `Pragma: no-cache`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`

기존 Content Security Policy의 `frame-ancestors 'none'`과 함께 외부 사이트의 관리자 화면 임베딩을 방어한다. 리퍼러 헤더를 보내지 않아 워크스페이스 식별자나 관리자 경로가 외부 연동 페이지로 전달되지 않는다. 카메라·마이크·위치·결제·USB 권한은 현재 관리자 기능에 필요하지 않아 명시적으로 차단한다.

`/admin/assets/` 정적 자산은 이 문서 정책에서 제외해 기존 `no-cache` 재검증 동작을 유지한다.
