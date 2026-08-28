# Story Graph
Next.js full-stack modular monolith.
- Frontend↔Backend는 HTTP API 경계를 지킨다.
- frontend에서 backend/DB 직접 import 금지.
- 공용 API 타입은 contracts만 사용한다.
- Board=View, Scope=State, Node/Edge 원본은 Story가 소유한다.
- 기능은 domain/feature 단위로 배치한다.
- 구조 변경 시 관련 AGENTS.md와 architecture 문서를 함께 갱신한다.
