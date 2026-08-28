# API Contracts
Frontend↔Backend의 유일한 공유 계약.
- Zod Request/Response schema와 API 타입만 둔다.
- DB model, Repository, UseCase, React UI import 금지.
- API 변경은 contract 변경으로 명시한다.
- 외부 계약을 구현 세부사항과 분리한다.
