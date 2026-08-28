# Backend
도메인 중심 modular architecture.
- module은 domain/application/infrastructure 경계를 지킨다.
- application에서 DB/Drizzle 직접 접근 금지.
- Route Handler 로직을 module에 섞지 않는다.
- Node/Edge는 Story 공용 데이터이며 Board가 소유하지 않는다.
- 권한과 트랜잭션은 use-case 경계에서 명시한다.
