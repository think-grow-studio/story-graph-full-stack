# Frontend
UI와 사용자 상호작용만 담당한다.
- backend/Drizzle/DB import 금지.
- 서버 접근은 frontend/api 경계를 사용한다.
- Entity=명사, Feature=사용자 행동, Widget=큰 UI 조합.
- 서버 상태는 TanStack Query, editor working state는 Zustand가 소유한다.
- 범용 UI만 shared에 둔다.
