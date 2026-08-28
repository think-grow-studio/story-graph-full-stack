# Next.js Boundary
routing/composition 전용.
- page.tsx는 frontend 화면을 조합한다.
- route.ts는 validation→backend use-case→response만 담당한다.
- 비즈니스 로직과 DB 접근 금지.
- Server Component도 application DB를 직접 조회하지 않는다.
- 서버 데이터는 명시적 /api/v1 contract 경계를 따른다.
