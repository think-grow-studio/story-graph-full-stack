# Graph Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the canonical Story-scoped Node/Edge graph model with authenticated CRUD, directed multi-edge semantics, JSON properties, and per-resource optimistic locking.

**Architecture:** Extend the existing `backend/modules/graph` boundary with canonical Node and Edge domain types behind a Drizzle repository. HTTP contracts stay in `src/contracts/graph`; API route handlers under `/api/v1` only validate/map requests and invoke application use-cases. Board/View state and React Flow are explicitly deferred to the next slice.

**Tech Stack:** Next.js 16 App Router, TypeScript 5.9, Zod 4, PostgreSQL 16, Drizzle ORM 0.45, Better Auth-backed workspace access, Vitest, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`

## Global Constraints

- A Story owns canonical Node and Edge data.
- Nodes are genre-agnostic; do not add a closed PERSON/EVENT/LOCATION enum.
- Every Edge is directed and multiple Edges between the same source and target are allowed.
- Canonical Node/Edge fields are not Board presentation state.
- Generate Node and Edge IDs client-side; create APIs accept the entity ID.
- Use per-resource optimistic locking with integer `version`; stale updates return `409 Conflict`.
- Frontend never imports backend/Drizzle/database modules; HTTP contracts are the shared boundary.
- Application code does not import Drizzle, Better Auth, or infrastructure implementations.
- No Board, Scope, React Flow, WebSocket, CRDT, event sourcing, Redis, queue, or AI worker in this slice.

---

### Task 1: Graph contracts, capabilities, and database schema

**Files:**
- Create: `src/contracts/graph/graph.contract.ts`
- Create: `src/backend/infrastructure/database/schema/graph.schema.ts`
- Modify: `src/backend/infrastructure/database/schema/index.ts`
- Modify: `src/backend/modules/workspace/domain/workspace-access.service.ts`
- Modify: `src/backend/modules/workspace/domain/workspace-capability.policy.ts`
- Test: `src/backend/modules/workspace/domain/workspace-capability.policy.test.ts`
- Test: `tests/integration/graph/graph-schema.integration.ts`
- Create: `drizzle/0002_graph-foundation.sql` plus matching Drizzle metadata generated from schema

**Interfaces:**
- Produces `GraphNodeResponse`, `GraphEdgeResponse`, create/update request schemas, `graph:read`, and `graph:update` capabilities.
- Database tables: `graph_node` and `graph_edge`.

- [ ] **Step 1: Write failing capability and schema tests**

```ts
expect(workspaceRoleHasCapability("owner", "graph:update")).toBe(true);
expect(workspaceRoleHasCapability("member", "graph:read")).toBe(true);
expect(workspaceRoleHasCapability("member", "graph:update")).toBe(false);
```

Integration assertions create two Nodes with JSON properties, then create two Edges with the same `(sourceNodeId, targetNodeId)` and assert both persist.

- [ ] **Step 2: Run RED**

Run: `pnpm test src/backend/modules/workspace/domain/workspace-capability.policy.test.ts && pnpm test:integration tests/integration/graph/graph-schema.integration.ts`

Expected: FAIL because graph capabilities/schema do not exist.

- [ ] **Step 3: Add contracts/schema minimally**

```ts
export interface GraphNode {
  id: string;
  storyId: string;
  name: string;
  description: string;
  iconKey: string | null;
  properties: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphEdge {
  id: string;
  storyId: string;
  sourceNodeId: string;
  targetNodeId: string;
  name: string;
  description: string;
  iconKey: string | null;
  properties: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
```

Use Story FK `ON DELETE CASCADE`; Edge source/target FKs point to Node with `ON DELETE CASCADE`. Add indexes on story and source/target columns, but no source-target uniqueness constraint.

- [ ] **Step 4: Run GREEN**

Run the same focused unit/integration commands.

- [ ] **Step 5: Commit**

`git commit -m "feat: add canonical graph schema"`

---

### Task 2: Node repository and application use-cases

**Files:**
- Create: `src/backend/modules/graph/domain/graph-node.ts`
- Create: `src/backend/modules/graph/domain/graph.repository.ts`
- Create: `src/backend/modules/graph/infrastructure/drizzle-graph.repository.ts`
- Create: `src/backend/modules/graph/application/node.use-cases.test.ts`
- Create: `src/backend/modules/graph/application/create-node/create-node.ts`
- Create: `src/backend/modules/graph/application/list-nodes/list-nodes.ts`
- Create: `src/backend/modules/graph/application/get-node/get-node.ts`
- Create: `src/backend/modules/graph/application/update-node/update-node.ts`
- Create: `src/backend/modules/graph/application/delete-node/delete-node.ts`
- Test: `tests/integration/graph/graph-repository.integration.ts`

**Interfaces:**
- `GraphRepository.createNode(node)` / `findNodeById(id)` / `listNodesByStory(storyId)`.
- `updateNode(input)` takes `expectedVersion` and returns `{ kind: "updated", node } | { kind: "conflict" } | { kind: "not-found" }`.
- Use-cases take `actorId`, `workspaceId`, and `storyId`; they require `graph:read` or `graph:update` and confirm the Story belongs to the supplied Workspace before exposing Node existence.

- [ ] **Step 1: Write failing Node use-case/repository tests**

Test create/list/get, cross-Story 404 behavior, client-supplied ID preservation, JSON properties, version starts at 1, and stale update conflict.

- [ ] **Step 2: Run RED**

Run: `pnpm test src/backend/modules/graph/application/node.use-cases.test.ts && pnpm test:integration tests/integration/graph/graph-repository.integration.ts`

Expected: FAIL because graph repository/use-cases do not exist.

- [ ] **Step 3: Implement minimal Node repository/use-cases**

Update atomically with SQL predicate `WHERE id = ? AND version = expectedVersion`, setting `version = version + 1` and `updatedAt = now`.

Use `ApplicationError("NOT_FOUND", 404)` for missing/cross-Story resources and `ApplicationError("CONFLICT", 409)` for stale versions.

- [ ] **Step 4: Run GREEN**

Run focused unit + integration tests.

- [ ] **Step 5: Commit**

`git commit -m "feat: add graph node use cases"`

---

### Task 3: Edge repository and application invariants

**Files:**
- Create: `src/backend/modules/graph/domain/graph-edge.ts`
- Create: `src/backend/modules/graph/application/edge.use-cases.test.ts`
- Create: `src/backend/modules/graph/application/create-edge/create-edge.ts`
- Create: `src/backend/modules/graph/application/list-edges/list-edges.ts`
- Create: `src/backend/modules/graph/application/get-edge/get-edge.ts`
- Create: `src/backend/modules/graph/application/update-edge/update-edge.ts`
- Create: `src/backend/modules/graph/application/delete-edge/delete-edge.ts`
- Modify: `src/backend/modules/graph/domain/graph.repository.ts`
- Modify: `src/backend/modules/graph/infrastructure/drizzle-graph.repository.ts`
- Test: `tests/integration/graph/graph-repository.integration.ts`

**Interfaces:**
- `createEdge` requires both source and target Node to exist in the same requested Story.
- Self-edges are allowed.
- Repeated directed edges are allowed; reversing source/target is a different relationship.
- Edge update uses the same expected-version result union as Node update.

- [ ] **Step 1: Write failing Edge tests**

Cover duplicate same-direction edges, reverse-direction edge, self-edge, rejection when either endpoint belongs to another Story, and stale version returning conflict.

- [ ] **Step 2: Run RED**

Run focused graph unit/integration tests; expected failure is missing Edge behavior.

- [ ] **Step 3: Implement minimal Edge behavior**

Validate endpoint Story ownership before repository create. Do not add uniqueness over source/target.

- [ ] **Step 4: Run GREEN**

Run graph unit/integration tests.

- [ ] **Step 5: Commit**

`git commit -m "feat: add directed graph edges"`

---

### Task 4: Authenticated Node/Edge HTTP API

**Files:**
- Create: `src/app/api/v1/_shared/graph-dependencies.ts`
- Create: `src/app/api/v1/stories/[storyId]/nodes/route.ts`
- Create: `src/app/api/v1/stories/[storyId]/nodes/[nodeId]/route.ts`
- Create: `src/app/api/v1/stories/[storyId]/edges/route.ts`
- Create: `src/app/api/v1/stories/[storyId]/edges/[edgeId]/route.ts`
- Modify: `src/backend/common/errors/application-error.ts`
- Test: `tests/integration/graph/graph-api.integration.ts`

**Interfaces:**
- `GET/POST /api/v1/stories/:storyId/nodes`
- `GET/PATCH/DELETE /api/v1/stories/:storyId/nodes/:nodeId`
- `GET/POST /api/v1/stories/:storyId/edges`
- `GET/PATCH/DELETE /api/v1/stories/:storyId/edges/:edgeId`
- Requests carry `workspaceId`; PATCH also carries `expectedVersion`.
- Stale PATCH returns `409` with error code `CONFLICT`.

- [ ] **Step 1: Write failing API integration tests**

Authenticate with existing test-session helpers and verify 201/200/204, 401, cross-workspace 404, malformed input 400, and stale update 409.

- [ ] **Step 2: Run RED**

Run: `pnpm test:integration tests/integration/graph/graph-api.integration.ts`

Expected: FAIL/404 because routes do not exist.

- [ ] **Step 3: Implement routes and conflict error mapping**

Extend `ApplicationErrorCode` with `CONFLICT`. Route handlers only parse params/query/body, resolve current actor, invoke use-case, and serialize dates.

- [ ] **Step 4: Run GREEN**

Run graph API integration plus existing Story API integration tests.

- [ ] **Step 5: Commit**

`git commit -m "feat: expose graph node and edge APIs"`

---

### Task 5: OpenAPI and critical persistence E2E

**Files:**
- Modify: `src/backend/infrastructure/openapi/openapi-document.ts`
- Modify: `src/backend/infrastructure/openapi/openapi-document.test.ts`
- Create: `tests/e2e/graph-foundation.spec.ts`

**Interfaces:**
- OpenAPI documents every Graph route and 409 response.
- E2E verifies `create Nodes → connect duplicate directed Edges → reload → persisted` and `stale version → 409`.

- [ ] **Step 1: Write failing OpenAPI/E2E tests**

Assert Graph paths/tags exist and the authenticated persistence flow survives reload.

- [ ] **Step 2: Run RED**

Run: `pnpm test src/backend/infrastructure/openapi/openapi-document.test.ts` and focused Playwright graph spec.

Expected: FAIL because Graph paths are absent from OpenAPI and/or E2E route flow is incomplete.

- [ ] **Step 3: Register Graph contracts and paths in OpenAPI**

Use the exact Zod contract schemas from `src/contracts/graph/graph.contract.ts`; do not duplicate validation shapes.

- [ ] **Step 4: Run full verification**

Run: `pnpm check && pnpm test:integration && pnpm build && pnpm e2e`

Expected: all green.

- [ ] **Step 5: Commit**

`git commit -m "test: verify graph foundation end to end"`
