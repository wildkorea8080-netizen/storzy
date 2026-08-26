# 암호화된 연동 연결 원장

`integration_connections`는 workspace별 Shopify·Printful 연결을 한 건씩 보존한다. 외부 계정 식별자, 상태와 비민감 metadata는 조회 가능한 열에 저장하고 credential payload는 AES-256-GCM으로 암호화한다.

## 암호화 계약

- 키: `INTEGRATION_CREDENTIAL_KEY_BASE64`의 base64 encoded 32 bytes
- 알고리즘: AES-256-GCM
- nonce: 암호화마다 새 12 bytes random IV
- authentication tag: 16 bytes
- AAD: `storzy:{workspaceId}:{provider}`
- key rotation 식별자: `INTEGRATION_CREDENTIAL_KEY_VERSION`

AAD가 workspace와 provider를 결합하므로 다른 workspace나 공급자 행으로 ciphertext를 복사해도 복호화되지 않는다. credential JSON 평문과 공급자 오류 원문은 DB metadata와 감사 로그에 저장하지 않는다.

`IntegrationConnectionRepository.upsert`는 연결 행 갱신과 `integration_connection_actions` 감사를 한 transaction에서 처리한다. 최초 저장은 `CONNECTED`, 후속 credential 교체는 `CREDENTIALS_ROTATED`로 기록한다. 암호화에 사용한 임시 plaintext·ciphertext buffer는 가능한 범위에서 즉시 지운다.

현재 단계에서는 저장소와 migration만 제공한다. 다음 단계의 OAuth callback과 token 등록 API만 이 repository를 통해 credential을 저장할 수 있으며, 관리자 조회 API는 복호화 메서드에 접근하지 않는다.
