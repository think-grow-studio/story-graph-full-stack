# Story Graph Architecture Design

Status: Approved design draft for implementation planning
Date: 2026-08-28

## 1. Product direction

Story Graph is a SaaS for representing a story world as a directed property multigraph. Users create arbitrary Nodes such as characters, events, places, organizations, items, concepts, or magic, and connect them with directed Edges containing names, icons, descriptions, and custom properties.

The product must remain genre-agnostic and highly extensible. Templates may be added later, but the core model must not force story-specific types.

## 2. Core domain principles

- A Story owns canonical Node and Edge data.
- A Node can represent anything meaningful in the story world.
- Every Edge is directed.
- Multiple Edges between the same source and target are allowed. Do not add a `(sourceId, targetId)` uniqueness constraint.
- Board = View. A Board controls placement and presentation, not canonical story data.
- Scope = State. A Scope represents a user-defined boundary such as episode, chapter, era, season, past, present, or any custom period.
- The same canonical Node and Edge identities are reused across Boards and Scopes.
- Scope + NodeState V1 and EdgeState V1 are implemented: NodeState and EdgeState sparsely override canonical content for a Scope while Board-specific state remains presentation-only.

## 3. Domain model

Current model:

```text
User
  └─ Membership
      └─ Workspace
          └─ Story
              ├─ Node
              ├─ Edge
              ├─ Scope
              │   ├─ NodeState
              │   └─ EdgeState
              └─ Board ── optional scopeId
                  ├─ BoardNode
                  └─ BoardEdge
```

### Node

Canonical story entity.

Suggested fields: `id`, `storyId`, `name`, `description`, `iconKey`, `properties JSONB`, timestamps, `version`.

Do not hard-code a closed enum such as PERSON/EVENT/LOCATION. User-defined classification may be added later.

### Edge

Canonical directed relationship.

Suggested fields: `id`, `storyId`, `sourceNodeId`, `targetNodeId`, `name`, `description`, `iconKey`, `properties JSONB`, timestamps, `version`.

### Board

A visual view of Story data. Suggested fields: `id`, `storyId`, `name`, `description`, optional `scopeId`, `revision`, timestamps.

### BoardNode / BoardEdge

Board-only presentation state. BoardNode stores position, size, z-index, and style overrides. BoardEdge stores visual style and label presentation. Canonical names/descriptions stay on Node/Edge.

### Scope

A first-class Story-owned state boundary. V1 fields are `id`, `storyId`, `name`, `description`, and timestamps. Scope hierarchy, `parentScopeId`, `sortOrder`, deletion, and live scope switching remain deferred.

### NodeState

Sparse state keyed by `(scopeId, nodeId)` for `name`, `description`, and `properties`. A `null` field inherits the canonical Node value; non-null `properties` replaces the whole canonical properties object rather than deep-merging it. NodeState never creates a second Node identity and never overwrites the canonical Node row.

### EdgeState

Sparse state keyed by `(scopeId, edgeId)` for `name`, `description`, and `properties`. A `null` field inherits the canonical Edge value; non-null `properties` replaces the whole canonical properties object. EdgeState never creates a second Edge identity and never overwrites the canonical Edge row.

EdgeState V1 deliberately keeps `sourceNodeId`, `targetNodeId`, `iconKey`, and relationship existence canonical. Relationship topology/existence state, Scope inheritance, AI/realtime behavior, and persistent history remain deferred.

## 4. Application architecture

Use a single Next.js full-stack modular monolith, but treat frontend and backend as logically independent systems.

```text
Browser
  ↓
Frontend
  ↓ HTTP /api/v1
API Route Handler
  ↓
Backend Application
  ↓
Domain / Repository
  ↓
PostgreSQL
```

Hard rule: frontend code never imports backend, Drizzle, or database modules. Server Components also do not bypass the API boundary for application data.

Public static pages may use SSG. Database-backed SaaS screens use client fetching or dynamic/server rendering while still respecting the API boundary.

## 5. Top-level source structure

```text
src/
├─ app/          # Next.js routing/composition only
├─ frontend/     # UI and interaction
├─ backend/      # domain/application/infrastructure
└─ contracts/    # shared HTTP contracts only
```

### `src/app`

Framework boundary only. `page.tsx` composes frontend pages/widgets. `route.ts` performs request extraction, validation, backend use-case invocation, and response mapping. No business logic or direct DB access.

### `src/frontend`

Use a pragmatic feature/domain-oriented layout:

```text
frontend/
├─ pages/
├─ widgets/
├─ features/
├─ entities/
├─ shared/
└─ api/
```

- Entities are nouns: story, board, node, edge, scope, workspace.
- Features are user actions: create-node, edit-edge, create-board, graph-selection.
- Widgets combine multiple entities/features into larger UI regions.
- Shared contains only truly generic frontend code.

### Graph editor subsystem

Treat Graph Editor as an independent subsystem. React Flow is a rendering/input engine, not the architecture center.

```text
features/graph-editor/
├─ store/
├─ commands/
├─ history/
├─ persistence/
├─ hooks/
└─ model/
```

React Flow-specific renderers should remain near the graph canvas UI so the editor domain is not tightly coupled to the library.

### `src/backend`

```text
backend/
├─ modules/
│  ├─ identity/
│  ├─ workspace/
│  ├─ story/
│  └─ graph/
├─ infrastructure/
└─ common/
```

Each substantial module follows `domain / application / infrastructure` boundaries. Application code does not import Drizzle. Repository implementations live in infrastructure.

### `src/contracts`

The only shared frontend/backend contract boundary. Store Zod request/response schemas and inferred API types here. Do not expose DB rows, repositories, use-cases, React components, or backend domain internals.

## 6. Dependency rules

Allowed:

```text
app page   → frontend
app api    → backend
frontend   → contracts
backend    → contracts
backend infrastructure → database
```

Forbidden:

```text
frontend → backend
frontend → database/Drizzle
backend  → frontend
contracts → frontend/backend implementation
```

Enforce these rules with ESLint/import-boundary checks, not documentation alone.

## 7. Graph editor state ownership

- PostgreSQL: durable persisted truth.
- TanStack Query: server-state fetching/cache/mutation lifecycle.
- Zustand: current editor working state.
- React Flow: rendering and pointer/viewport interaction.

Load flow:

```text
GET Board Snapshot
  → TanStack Query
  → hydrate Zustand
  → resolve canonical Node + scoped NodeState and canonical Edge + scoped EdgeState when Scope exists
  → React Flow renders effective content with canonical topology
```

Edit flow:

```text
User action
  → Zustand immediately
  → Command/Operation
  → Save Queue
  → TanStack Mutation / HTTP
  → API
  → PostgreSQL
```

Do not continuously mutate TanStack Query cache for drag-frame state.

## 8. Persistence and editing

Use autosave rather than a primary Save button.

- Node drag updates Zustand continuously; persist on drag stop.
- Text edits use a short debounce.
- Create/delete/connect operations persist immediately after local optimistic application.
- Generate entity IDs client-side so follow-up edits/edge creation do not wait for server-generated IDs.
- Durable writes serialize per `node:<id>` / `edge:<id>` Save Queue lane; unrelated lanes may progress independently.
- Canonical Node writes and scoped NodeState writes for the same Node share `node:<id>`.
- Canonical Edge writes and scoped EdgeState writes for the same Edge share `edge:<id>`.
- Scoped Inspector edits resolve the effective Node/Edge, then normalize back to sparse NodeState/EdgeState overrides before persistence.
- Pending, not-yet-started Node move writes coalesce to the latest position without mutating a running move.
- A queued `create-edge` waits for still-active `create-node` operations for its source/target Node IDs so Relationship persistence cannot outrun endpoint creation.
- Failed lanes preserve the current Zustand working state and resume only through explicit Retry; there is no infinite automatic retry loop.
- Stale durable responses may advance server metadata but must not overwrite newer working values.
- The editor exposes aggregate `Saved / Saving / Unsaved / Error` state from the Save Queue rather than individual mutation flags.
- Network failure must not immediately destroy the local working state.
- Commands must not directly know Axios/HTTP so persistence can later move to collaboration/WebSocket infrastructure.

Undo/redo is command-based. Undo means applying and persisting the inverse change, not rolling back the database transaction history. Scoped NodeState and EdgeState history stores the previous sparse override, not the resolved canonical/effective value. History remains session-local in V1 and is not persisted across reloads.

## 9. Concurrency

Use per-resource optimistic locking for important story data (`version`). Stale updates return `409 Conflict`.

NodeState and EdgeState use create-if-absent when `version = null` and compare-and-set when a numeric version is supplied. Scope and the referenced canonical Node/Edge must belong to the same Story.

Board `revision` remains a coarse snapshot generation/version marker, not the sole concurrency lock. Board placement data may use lighter conflict behavior such as last-write-wins where appropriate.

Leave room for operation IDs/idempotency in write contracts. Do not implement event sourcing, CRDT, Yjs, or real-time collaboration in V1.

## 10. API design

Business APIs live under `/api/v1`. Better Auth uses its own `/api/auth/*` routes.

Prefer intent-oriented endpoints over exposing raw tables.

Examples:

```text
POST  /api/v1/boards/:boardId/nodes
PUT   /api/v1/boards/:boardId/nodes/:nodeId/presentation
PATCH /api/v1/nodes/:nodeId
PATCH /api/v1/boards/:boardId/nodes/:nodeId
POST  /api/v1/boards/:boardId/edges
GET   /api/v1/boards/:boardId/snapshot
GET   /api/v1/stories/:storyId/scopes
POST  /api/v1/stories/:storyId/scopes
GET   /api/v1/stories/:storyId/nodes
PUT   /api/v1/scopes/:scopeId/nodes/:nodeId/state
PUT   /api/v1/scopes/:scopeId/edges/:edgeId/state
```

Creating a node from a Board is one backend use-case/transaction that creates both canonical Node and BoardNode. Placing an existing canonical Node on another Board creates only Board presentation state.

The board snapshot endpoint returns the editor bootstrap payload in one request: story/board/scope metadata, canonical nodes/edges, scoped NodeStates/EdgeStates, board presentation state, and revision. Canonical entities and scoped state remain separate in the payload.

## 11. Authentication and authorization

Use Better Auth with HttpOnly cookie + server-side session. Persist sessions in PostgreSQL initially. Multiple app instances can share the same DB session store; Redis is unnecessary until session traffic justifies secondary storage.

Better Auth Organization is the persistence/auth basis for Story Graph Workspace. Stories belong to Workspace, not directly to User.

Backend business code must not depend directly on Better Auth. Place it behind an auth/workspace access adapter/service.

Authorization is backend-enforced and capability-oriented. Avoid scattering direct role checks such as `role === OWNER`. Future capabilities may include `story:read`, `story:update`, `graph:update`, `member:invite`.

V1 can expose only the personal owner workflow while retaining the Workspace model for future collaboration and billing.

## 12. Technology choices

- Node.js
- pnpm
- Next.js App Router + strict TypeScript
- Tailwind CSS
- `@xyflow/react`
- TanStack Query
- Zustand
- Axios behind a frontend API client
- Zod contracts
- PostgreSQL
- Drizzle ORM
- Better Auth
- Vitest
- React Testing Library
- Playwright
- GitHub Actions

PostgreSQL is sufficient for the graph model in V1. Do not introduce Neo4j/graph DB unless graph traversal characteristics later justify it.

Explicitly out of V1: Redis, Kafka/SQS, WebSocket, Yjs/CRDT, microservices, separate NestJS API, dedicated AI worker.

## 13. Environment and deployment

Keep deployment provider-neutral and Docker-compatible. Vercel may be used, but provider-specific services must not leak into application/domain layers.

Environments: `local`, `test`, `staging`, `production`.

Validate environment variables in centralized server/client config modules. Do not read `process.env` throughout business code. Never expose secrets through `NEXT_PUBLIC_*`.

Database schema changes use reviewed Drizzle migrations committed to Git. Production must not rely on automatic schema push during application startup.

## 14. Testing strategy

Use a testing pyramid.

- Unit: domain/application logic near source files.
- Repository integration: real PostgreSQL test database for Drizzle behavior, constraints, JSONB, transactions, optimistic locking.
- API integration: request validation, auth, permissions, transactions, 400/403/404/409 semantics.
- Frontend component: React Testing Library for normal UI components.
- E2E: Playwright for graph canvas behavior and critical user workflows.

Graph-domain invariants require tests, especially directed multi-edge behavior. E2E editor tests should frequently use `edit → saved → reload → verify` to catch persistence failures. Scope acceptance must prove the same canonical Node or Edge ID can resolve differently on scoped and unscoped Boards without mutating canonical data or Edge topology.

CI minimum: lint, typecheck, unit tests, integration tests, Next build, critical E2E.

## 15. AI instruction files

`AGENTS.md` is the source of truth. `CLAUDE.md` in the same directory contains only `@AGENTS.md`.

Place instruction files only at meaningful architecture boundaries, not every folder. Keep each AGENTS.md roughly <= 500 Korean characters and focused on invariants.

Planned locations:

```text
/AGENTS.md
/src/app/AGENTS.md
/src/frontend/AGENTS.md
/src/frontend/features/graph-editor/AGENTS.md
/src/backend/AGENTS.md
/src/backend/infrastructure/AGENTS.md
/src/contracts/AGENTS.md
/tests/AGENTS.md
```

Suggested content:

### `/AGENTS.md`

```md
# Story Graph
Next.js full-stack modular monolith.
- Frontend와 Backend는 HTTP API로만 통신한다.
- frontend → backend/database 직접 import 금지.
- 공용 API 타입은 contracts만 사용한다.
- Board = View, Scope = State.
- Node/Edge 원본은 Story가 소유한다.
- 기능은 도메인/feature 단위로 배치한다.
- 구조 변경 시 관련 AGENTS.md와 architecture 문서를 함께 갱신한다.
```

### `/src/app/AGENTS.md`

```md
# Next.js Boundary
routing/composition 전용.
- page.tsx는 frontend 화면을 조합한다.
- route.ts는 validation → backend use-case → response만 담당한다.
- 비즈니스 로직과 DB 접근을 두지 않는다.
- Server Component도 application DB를 직접 조회하지 않는다.
- 서버 데이터는 명시적 /api/v1 contract 경계를 따른다.
```

### `/src/frontend/AGENTS.md`

```md
# Frontend
UI와 사용자 상호작용만 담당한다.
- backend/Drizzle/DB import 금지.
- 서버 접근은 frontend/api 경계를 사용한다.
- Entity=명사, Feature=사용자 행동, Widget=큰 UI 조합.
- 서버 상태는 TanStack Query, editor working state는 Zustand.
- 범용 UI만 shared에 둔다.
```

### `/src/frontend/features/graph-editor/AGENTS.md`

```md
# Graph Editor
독립 subsystem처럼 다룬다.
- Zustand가 working state를 소유한다.
- React Flow는 rendering/input engine이다.
- Query cache를 drag/edit state로 사용하지 않는다.
- Board는 표현 상태만 소유한다.
- Scope가 있으면 Node/Relationship은 canonical+NodeState/EdgeState로 resolve한다.
- state는 canonical identity/topology를 덮어쓰지 않는다.
- scoped edit도 node:<id>/edge:<id> lane과 command/history를 사용한다.
```

### `/src/backend/AGENTS.md`

```md
# Backend
도메인 중심 modular architecture.
- module은 domain/application/infrastructure 경계를 지킨다.
- application에서 DB/Drizzle 직접 접근 금지.
- Route Handler 로직을 module에 섞지 않는다.
- Node/Edge는 Story 공용 데이터이며 Board가 소유하지 않는다.
- 권한과 트랜잭션은 use-case 경계에서 명시한다.
```

### `/src/backend/infrastructure/AGENTS.md`

```md
# Infrastructure
외부 기술 구현을 격리한다.
- Drizzle/PostgreSQL/Auth/Cache 직접 접근은 이 계층에 둔다.
- domain에 DB 타입을 노출하지 않는다.
- DB row를 그대로 API response로 반환하지 않는다.
- JSONB 구조는 contract/domain validation을 거친다.
```

### `/src/contracts/AGENTS.md`

```md
# API Contracts
Frontend↔Backend의 유일한 공유 계약.
- Zod Request/Response schema와 API 타입만 둔다.
- DB model, Repository, UseCase, React UI import 금지.
- API 변경은 contract 변경으로 명시한다.
- 외부 계약을 구현 세부사항과 분리한다.
```

### `/tests/AGENTS.md`

```md
# Tests
아키텍처 경계와 observable behavior를 검증한다.
- domain/application은 가능한 DB 없이 unit test.
- Drizzle repository/API는 integration test.
- Graph 핵심 흐름은 Playwright E2E.
- editor는 edit→saved→reload→verify 패턴을 적극 사용한다.
- 버그 수정은 가능한 재현 테스트부터 추가한다.
```

## 16. Architectural guardrails

1. Prefer extension through modules/features over global utility/service folders.
2. Do not build infrastructure for hypothetical scale before it is required.
3. Preserve domain concepts independently of React Flow, Drizzle, Better Auth, or any deployment vendor.
4. Any architecture exception must be explicit and should update the nearest AGENTS.md/spec when it becomes a new rule.
5. Optimize V1 for a high-quality graph authoring experience while preserving the path toward relationship topology/existence state, Scope inheritance, AI reasoning, realtime collaboration, and persistent version history.
