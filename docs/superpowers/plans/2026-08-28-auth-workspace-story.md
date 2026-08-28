# Auth, Workspace & Story Implementation Plan

**Status:** Implemented and verified on `feat/auth-workspace-story`; merge pending.
**Date:** 2026-08-28
**Spec:** `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`

## Goal

Add the first authenticated SaaS slice for Story Graph:

```text
Google OAuth
  → Better Auth DB session
  → Actor
  → Personal Workspace
  → Story CRUD
  → Dashboard
```

The implementation keeps the approved modular-monolith boundary so the Next.js backend can later be extracted without changing frontend/domain semantics.

## Scope amendments made during implementation

The original planning session changed in two approved ways while implementation was in progress:

1. **Authentication is Google OAuth only.** Production email/password authentication is disabled. `/login` and `/signup` both expose the same Google OAuth entry point.
2. **OpenAPI/Swagger documentation is included.** Existing Zod HTTP contracts remain the source of truth and generate OpenAPI; Swagger does not define a second API model.

CI does not call Google. Test-only Better Auth `testUtils()` creates real database users/sessions/cookies without enabling any production auth bypass.

## Architecture

```text
Browser
  ↓
Frontend API client (/api/v1)
  ↓
Next Route Handler
  ├─ request/response Zod contracts
  └─ composition only
       ↓
Backend application use-case
  ├─ AuthSessionService port
  ├─ WorkspaceAccessService port
  └─ StoryRepository port
       ↓
Infrastructure adapters
  ├─ Better Auth
  ├─ Better Auth Organization
  └─ Drizzle / PostgreSQL
```

Hard rules:

- Story belongs to Workspace, never directly to User.
- Better Auth Organization backs Workspace persistence/membership.
- Backend application code does not import Better Auth, Drizzle, `pg`, or infrastructure implementations.
- Frontend never imports backend/Drizzle/database code and uses HTTP `/api/v1` only.
- Authorization is capability-oriented and enforced inside backend use-cases.
- Production database changes use committed Drizzle migrations.
- No Redis, queue, WebSocket, CRDT, AI worker, or graph editor implementation in this slice.

## Technology versions

- Node.js 24
- pnpm 11.21
- Next.js 16.3.3 / React 19
- PostgreSQL 16
- Drizzle ORM 0.45.2 / drizzle-kit 0.31.10
- Better Auth 1.6.29
- Zod 4.4.3
- `@asteasolutions/zod-to-openapi` 9.1.0
- `swagger-ui-react` 5.32.14
- Vitest / React Testing Library / Playwright

## Task 1 — PostgreSQL and Drizzle

- [x] Add `DATABASE_URL` to centralized server env validation.
- [x] Configure Drizzle client and schema exports under backend infrastructure.
- [x] Commit generated migration metadata and SQL.
- [x] Add PostgreSQL 16 service to CI.
- [x] Run migrations explicitly before test/build jobs.
- [x] Keep `pnpm install --frozen-lockfile` reproducible.

## Task 2 — Better Auth, Google OAuth only

- [x] Add Better Auth with Drizzle/PostgreSQL adapter.
- [x] Mount `/api/auth/[...all]`.
- [x] Enable Organization plugin for Workspace persistence.
- [x] Disable production email/password auth.
- [x] Configure only the Google social provider using `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- [x] Generate/commit Better Auth tables and migrations.
- [x] Keep schema-generation config CLI-safe without weakening runtime `server-only` boundaries.
- [x] Use test-only `testUtils()` sessions instead of real Google calls in CI.

Better Auth persisted tables include user/session/account/verification plus organization/member/invitation.

## Task 3 — Personal Workspace and authorization

- [x] Use Better Auth Organization as Story Graph Workspace.
- [x] Create a deterministic personal Workspace slug from user ID.
- [x] Make provisioning idempotent.
- [x] Recover from a concurrent/partial provisioning attempt by re-reading the deterministic Workspace.
- [x] Hide raw Organization management from the V1 user flow.
- [x] Map membership roles to Story Graph capabilities in one policy.
- [x] Enforce Workspace capability checks in backend use-cases.
- [x] Verify provisioning and authorization against real PostgreSQL.

V1 role policy:

```text
owner/admin → story read/create/update/delete
member      → story read
```

## Task 4 — Actor and bootstrap

- [x] Define identity `Actor` independently of Better Auth types.
- [x] Define `AuthSessionService` as the application-facing auth/session port.
- [x] Implement `BetterAuthSessionService` in identity infrastructure.
- [x] Compose the adapter at the API boundary rather than inside application code.
- [x] Implement `GET /api/v1/bootstrap`.
- [x] Return the current Actor and ensured Personal Workspace.
- [x] Return `401` without a valid DB-backed session.
- [x] Add ESLint/CI regression cases that reject backend application imports of infrastructure, Better Auth, Drizzle, and `pg`.

## Task 5 — Story domain and persistence

- [x] Add Story domain model and `StoryRepository` port.
- [x] Implement create/list/get/update/delete application use-cases.
- [x] Require Workspace capability checks inside each use-case.
- [x] Return `404` when a Story does not belong to the supplied Workspace, avoiding cross-Workspace discovery.
- [x] Add Drizzle Story schema/repository and generated migration.
- [x] Verify repository behavior and FK constraints against real PostgreSQL.

## Task 6 — Story HTTP API

Implemented endpoints:

```text
GET    /api/v1/stories?workspaceId=...
POST   /api/v1/stories
GET    /api/v1/stories/{storyId}?workspaceId=...
PATCH  /api/v1/stories/{storyId}
DELETE /api/v1/stories/{storyId}?workspaceId=...
```

- [x] Keep shared request/response schemas in `src/contracts`.
- [x] Keep Route Handlers thin: validation → Actor → use-case → response.
- [x] Keep DB access out of Route Handlers.
- [x] Verify CRUD, auth, permissions, validation, and cross-Workspace `404` with API integration tests.

## Task 7 — Google auth UI and dashboard

- [x] `/login` exposes `Continue with Google` only.
- [x] `/signup` exposes the same Google OAuth entry only.
- [x] Do not render email/password fields.
- [x] Google OAuth callback returns to `/dashboard`.
- [x] Dashboard calls `/api/v1/bootstrap` through the frontend HTTP client.
- [x] Dashboard displays Personal Workspace and Story list.
- [x] Dashboard can create a Story.
- [x] Dashboard redirects a `401` bootstrap response to `/login`.
- [x] Add regression coverage ensuring feature APIs do not duplicate the API client's `/api/v1` base path.

## Task 8 — Browser persistence verification

- [x] Create a test-only Better Auth identity/session in PostgreSQL.
- [x] Inject the resulting HttpOnly session cookie into Playwright BrowserContext.
- [x] Verify Google is the only visible auth entry.
- [x] Verify hidden Workspace management cannot be performed through raw Organization endpoints.
- [x] Open Dashboard as an authenticated user.
- [x] Create `My First Story`.
- [x] Reload the page.
- [x] Verify `My First Story` remains, proving server persistence rather than client-only state.

## Task 9 — OpenAPI and Swagger

```text
Shared Zod contracts
  → zod-to-openapi
  → GET /api/openapi.json
  → /docs
  → Swagger UI
```

- [x] Keep Zod contracts as the single HTTP contract source of truth.
- [x] Add common API error contract.
- [x] Document health, bootstrap, and Story CRUD.
- [x] Document Better Auth session cookie security.
- [x] Expose generated OpenAPI JSON at `/api/openapi.json`.
- [x] Render Swagger UI at `/docs` with a client-only dynamic import.
- [x] Verify OpenAPI output with unit tests and `/docs` with Playwright.
- [x] Remove obsolete custom Swagger asset-serving code that conflicted with Turbopack bundling.

The generated document currently uses **OpenAPI 3.0.0** because that is the verified compatible mode for the selected Swagger UI stack. This is a presentation/compatibility choice; shared Zod contracts remain authoritative.

## Verification gate

Every final candidate must pass the same CI sequence:

```text
pnpm install --frozen-lockfile
  → Drizzle migrations
  → AGENTS validation
  → architecture boundary regression tests
  → ESLint
  → TypeScript
  → Vitest
  → PostgreSQL integration tests
  → Next production build
  → tracked-file clean check
  → Chromium install
  → Playwright E2E
```

A change is not considered complete until the fresh run for that exact HEAD succeeds.

## Explicitly deferred

- Graph Node/Edge/Board/Scope implementation
- Graph Editor / React Flow
- autosave/save queue/undo-redo
- collaboration/WebSocket/CRDT
- billing
- Redis/queue infrastructure
- AI reasoning features

Those remain separate implementation plans built on this authenticated Story/Workspace foundation.
