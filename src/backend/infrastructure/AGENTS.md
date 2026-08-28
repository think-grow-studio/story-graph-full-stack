# Infrastructure
외부 기술 구현을 격리한다.
- Drizzle/PostgreSQL/Auth/Cache 직접 접근은 이 계층에 둔다.
- domain에 DB 타입을 노출하지 않는다.
- DB row를 그대로 API response로 반환하지 않는다.
- JSONB 구조는 contract/domain validation을 거친다.
