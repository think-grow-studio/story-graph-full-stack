# Tests
아키텍처 경계와 observable behavior를 검증한다.
- domain/application은 가능한 DB 없이 unit test.
- Repository/API는 integration test.
- Graph 핵심 흐름은 Playwright E2E.
- editor는 edit→saved→reload→verify 패턴을 적극 사용한다.
- 버그 수정은 가능한 재현 테스트부터 추가한다.
