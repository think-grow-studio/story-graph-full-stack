# Backend
도메인 중심 modular architecture.
- module은 domain/application/infrastructure 경계를 지킨다.
- application에서 DB/Drizzle 직접 접근 금지.
- Route Handler 로직을 module에 섞지 않는다.
- Story가 Board를 소유하고, Board가 Node/Edge를 직접 소유한다.
- Node/Edge는 다른 Board와 공유하지 않으며 Edge 양 끝 Node는 반드시 같은 Board에 속한다.
- Scope/NodeState/EdgeState와 BoardNode/BoardEdge 분리 모델을 사용하지 않는다.
- Board Tag는 Board child label이며 별도 global Tag aggregate를 만들지 않는다.
- 권한과 트랜잭션은 use-case 경계에서 명시한다.
