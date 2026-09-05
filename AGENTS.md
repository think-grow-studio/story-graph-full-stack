# Story Graph
Next.js full-stack modular monolith.
- Frontend↔Backend는 HTTP API 경계를 지킨다.
- frontend에서 backend/DB 직접 import 금지.
- 공용 API 타입은 contracts만 사용한다.
- 제품 계층은 Workspace → Story → Board → Node/Edge다.
- Story는 작품/프로젝트이고 Board는 서로 독립적인 그래프다.
- Node/Edge는 Board가 직접 소유하며 다른 Board와 공유하지 않는다.
- Tag는 Board에 붙는 단순한 분류 라벨이며 Scope/NodeState/EdgeState 계층을 만들지 않는다.
- 기능은 domain/feature 단위로 배치한다.
- 구조 변경 시 관련 AGENTS.md와 architecture 문서를 함께 갱신한다.
