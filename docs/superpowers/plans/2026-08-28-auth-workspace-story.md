# Auth, Workspace & Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PostgreSQL/Drizzle persistence, Better Auth cookie sessions, a hidden personal Workspace backed by Better Auth Organization, backend-enforced Workspace access, and authenticated Story CRUD with a minimal dashboard.

**Architecture:** Keep the existing Next.js modular-monolith boundary. Authentication and Better Auth table knowledge stay in backend infrastructure. Workspace capability checks are exposed through an application-facing service, while Story use-cases depend only on repository/access interfaces. Frontend accesses Story Graph data only through `/api/v1`; Better Auth keeps its own `/api/auth/*` handler.

**Tech Stack:** Node.js 24, pnpm 11.21, Next.js 16.3.3, PostgreSQL 16, Drizzle ORM 0.45.2, drizzle-kit 0.31.10, `pg`, Better Auth 1.6.29, Zod, Vitest, React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`

## Global Constraints

- Story belongs to Workspace, never directly to User.
- Better Auth Organization is the persistence/auth basis for Workspace.
- Better Auth must remain behind backend infrastructure/application adapters; Story domain/application code must not import Better Auth.
- Browser auth uses HttpOnly cookie + server-side session persisted in PostgreSQL.
- V1 enables email/password auth only; social providers are deferred without changing the architecture.
- Personal Workspace provisioning must be idempotent and self-healing.
- Authorization is enforced by backend use-cases and expressed as capabilities, not scattered role checks.
- Production schema changes use committed Drizzle migrations; no schema push at application startup.
- Frontend must not import backend, Drizzle, `pg`, or database modules.
- Keep Redis, WebSocket, CRDT, graph editor, and AI infrastructure out of this plan.

---

## File Map

```text
/
├─ .env.example
├─ drizzle.config.ts
├─ drizzle/
│  └─ 0000_*.sql
├─ src/app/
│  ├─ api/auth/[...all]/route.ts
│  ├─ api/v1/bootstrap/route.ts
│  ├─ api/v1/stories/route.ts
│  ├─ api/v1/stories/[storyId]/route.ts
│  ├─ (auth)/login/page.tsx
│  ├─ (auth)/signup/page.tsx
│  └─ (workspace)/dashboard/page.tsx
├─ src/backend/
│  ├─ common/errors/application-error.ts
│  ├─ infrastructure/
│  │  ├─ auth/auth.ts
│  │  ├─ auth/auth-session.adapter.ts
│  │  ├─ database/client.ts
│  │  ├─ database/schema/auth.schema.ts
│  │  ├─ database/schema/story.schema.ts
│  │  └─ database/schema/index.ts
│  └─ modules/
│     ├─ identity/
│     │  ├─ domain/actor.ts
│     │  └─ application/get-current-actor/get-current-actor.ts
│     ├─ workspace/
│     │  ├─ domain/workspace-access.service.ts
│     │  ├─ application/ensure-personal-workspace/ensure-personal-workspace.ts
│     │  └─ infrastructure/drizzle-workspace-access.service.ts
│     └─ story/
│        ├─ domain/story.ts
│        ├─ domain/story.repository.ts
│        ├─ application/create-story/create-story.ts
│        ├─ application/list-stories/list-stories.ts
│        ├─ application/get-story/get-story.ts
│        ├─ application/update-story/update-story.ts
│        ├─ application/delete-story/delete-story.ts
│        └─ infrastructure/drizzle-story.repository.ts
├─ src/contracts/
│  ├─ auth/bootstrap.contract.ts
│  └─ story/
│     ├─ create-story.contract.ts
│     ├─ story.contract.ts
│     ├─ list-stories.contract.ts
│     └─ update-story.contract.ts
├─ src/frontend/
│  ├─ api/auth/bootstrap.api.ts
│  ├─ api/story/story.api.ts
│  ├─ api/story/story.queries.ts
│  ├─ features/auth/auth-client.ts
│  ├─ features/auth/login-form.tsx
│  ├─ features/auth/signup-form.tsx
│  └─ pages/dashboard/dashboard-page.tsx
└─ tests/
   ├─ integration/
   │  ├─ auth/auth.integration.test.ts
   │  ├─ workspace/workspace.integration.test.ts
   │  └─ story/story.repository.integration.test.ts
   └─ e2e/auth-story.spec.ts
```

---

### Task 1: PostgreSQL + Drizzle foundation

**Files:**
- Modify: `package.json`
- Modify: `src/config/env.schema.ts`, `src/config/env.server.ts`
- Create: `.env.example`, `drizzle.config.ts`
- Create: `src/backend/infrastructure/database/client.ts`
- Create: `src/backend/infrastructure/database/schema/index.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces `db`, `DATABASE_URL`, and migration scripts consumed by all later backend infrastructure.

- [ ] **Step 1: Add a failing server-env test for `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL`.**

Extend `src/config/env.schema.test.ts` so `parseServerEnv` rejects a missing database URL and accepts:

```ts
{
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://story_graph:story_graph@localhost:5432/story_graph",
  BETTER_AUTH_SECRET: "01234567890123456789012345678901",
  BETTER_AUTH_URL: "http://localhost:3000",
}
```

Run `pnpm test src/config/env.schema.test.ts`; expect failure because the fields are not yet defined.

- [ ] **Step 2: Add stable persistence dependencies.**

Pin:

```json
{
  "dependencies": {
    "drizzle-orm": "0.45.2",
    "pg": "8.16.3"
  },
  "devDependencies": {
    "@types/pg": "8.15.5",
    "drizzle-kit": "0.31.10"
  }
}
```

Add scripts:

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:check": "drizzle-kit check"
}
```

- [ ] **Step 3: Implement centralized DB configuration.**

`serverSchema` requires the three values above. `env.server.ts` remains `server-only` and is the only application module that reads those `process.env` values.

Create `client.ts`:

```ts
import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { serverEnv } from "@/config/env.server";
import * as schema from "./schema";

const pool = new Pool({ connectionString: serverEnv.DATABASE_URL });
export const db = drizzle(pool, { schema });
export { pool };
```

- [ ] **Step 4: Configure Drizzle Kit and local env documentation.**

`drizzle.config.ts` points to `src/backend/infrastructure/database/schema/index.ts`, dialect `postgresql`, out `./drizzle`, and reads `DATABASE_URL` only in this tooling file.

`.env.example` documents non-secret local values and placeholders, never real credentials.

- [ ] **Step 5: Give CI a real PostgreSQL 16 service.**

Add `postgres:16-alpine` service with healthcheck, database/user/password `story_graph`. Set job env:

```yaml
DATABASE_URL: postgresql://story_graph:story_graph@localhost:5432/story_graph
BETTER_AUTH_SECRET: ci-only-secret-at-least-32-characters
BETTER_AUTH_URL: http://localhost:3000
```

Do not run migrations yet; that begins when schemas exist in Task 2.

- [ ] **Step 6: Verify.**

`pnpm check` and `pnpm build` must pass in CI with the PostgreSQL service available.

---

### Task 2: Better Auth server/client, generated schema, and migration

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `src/backend/infrastructure/auth/auth.ts`
- Create: `src/backend/infrastructure/database/schema/auth.schema.ts`
- Modify: `src/backend/infrastructure/database/schema/index.ts`
- Create: `src/app/api/auth/[...all]/route.ts`
- Create: `src/frontend/features/auth/auth-client.ts`
- Generate: `drizzle/0000_*.sql`

**Interfaces:**
- Produces `auth`, `authClient`, Better Auth core + Organization tables, and `/api/auth/*`.

- [ ] **Step 1: Add Better Auth 1.6.29 and a schema-generation script.**

```json
{
  "dependencies": {
    "better-auth": "1.6.29"
  },
  "scripts": {
    "auth:generate": "auth generate --config ./src/backend/infrastructure/auth/auth.ts --output ./src/backend/infrastructure/database/schema/auth.schema.ts --adapter drizzle --dialect postgresql --yes"
  }
}
```

Use the standalone Better Auth CLI only for schema generation. Pin the CLI version used in automation instead of `latest`.

- [ ] **Step 2: Create the auth configuration.**

```ts
import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { serverEnv } from "@/config/env.server";
import { db } from "@/backend/infrastructure/database/client";
import * as schema from "@/backend/infrastructure/database/schema";

export const auth = betterAuth({
  appName: "Story Graph",
  baseURL: serverEnv.BETTER_AUTH_URL,
  secret: serverEnv.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  plugins: [organization()],
});
```

Do not add Google/Apple providers in V1.

- [ ] **Step 3: Generate the Drizzle schema from the pinned Better Auth config.**

Run the pinned Better Auth CLI with dummy-but-valid env values. Commit the generated core and Organization tables rather than manually maintaining Better Auth columns.

Export the generated tables from schema/index.ts.

- [ ] **Step 4: Generate the first SQL migration with Drizzle Kit.**

Run `pnpm db:generate -- --name=auth-foundation`; inspect SQL to confirm user/session/account/verification/organization/member/invitation tables are present. Commit SQL + Drizzle metadata.

- [ ] **Step 5: Mount `/api/auth/[...all]`.**

```ts
import { auth } from "@/backend/infrastructure/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";
export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 6: Create the browser auth client.**

Use `createAuthClient` from `better-auth/react`. The frontend client must not import the server auth object.

- [ ] **Step 7: Add CI migration before tests/build.**

After frozen install run `pnpm db:migrate`. Then run existing quality gates.

- [ ] **Step 8: Integration smoke test.**

Create a test that signs up an email/password user through Better Auth server APIs, verifies a session row exists, then cleans the test data. Run against the CI PostgreSQL service.

---

### Task 3: Personal Workspace provisioning and capability access

**Files:**
- Create: `src/backend/modules/workspace/domain/workspace-access.service.ts`
- Create: `src/backend/modules/workspace/application/ensure-personal-workspace/ensure-personal-workspace.ts`
- Create: `src/backend/modules/workspace/infrastructure/drizzle-workspace-access.service.ts`
- Test: colocated unit test + `tests/integration/workspace/workspace.integration.test.ts`

**Interfaces:**

```ts
export type WorkspaceCapability =
  | "story:read"
  | "story:create"
  | "story:update"
  | "story:delete";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
}

export interface WorkspaceAccessService {
  findPersonalWorkspace(userId: string): Promise<WorkspaceSummary | null>;
  requireCapability(input: {
    userId: string;
    workspaceId: string;
    capability: WorkspaceCapability;
  }): Promise<void>;
}
```

- [ ] **Step 1: Unit-test deterministic personal workspace slug generation and capability mapping.**

The personal slug is deterministic from `userId` so repeated provisioning converges on one organization. Centralize Better Auth role → Story Graph capability mapping in the infrastructure adapter; no Story use-case may inspect role strings.

- [ ] **Step 2: Implement `ensurePersonalWorkspace`.**

Behavior:
1. `findPersonalWorkspace(userId)`.
2. If found, return it.
3. Otherwise call `auth.api.createOrganization` server-side with `userId`, deterministic slug, name `${userName}'s Workspace` (or `Personal Workspace` when name is blank).
4. If a concurrent request loses on unique slug creation, query again and return the existing workspace.

This is idempotent/self-healing and uses Better Auth's own Organization creation API rather than inserting Organization rows from application code.

- [ ] **Step 3: Implement the Drizzle access adapter.**

Query Better Auth `member` + `organization` tables in infrastructure only. V1 mapping:
- `owner`: read/create/update/delete Story.
- `admin`: read/create/update/delete Story.
- `member`: `story:read` only.

- [ ] **Step 4: Integration test provisioning.**

Call `ensurePersonalWorkspace` twice for the same Better Auth user. Assert one organization and one owner membership exist and both calls return the same workspace ID.

- [ ] **Step 5: Integration test authorization.**

Assert owner can update; unrelated user receives the application `FORBIDDEN` error; member can read but cannot update.

---

### Task 4: Request Actor and authenticated bootstrap API

**Files:**
- Create: `src/backend/modules/identity/domain/actor.ts`
- Create: `src/backend/modules/identity/application/get-current-actor/get-current-actor.ts`
- Create: `src/contracts/auth/bootstrap.contract.ts`
- Create: `src/app/api/v1/bootstrap/route.ts`
- Create: `src/frontend/api/auth/bootstrap.api.ts`
- Create: `src/backend/common/errors/application-error.ts`

**Interfaces:**

```ts
export interface Actor { id: string; email: string; name: string; }
export async function getCurrentActor(requestHeaders: Headers): Promise<Actor | null>;
export async function requireCurrentActor(requestHeaders: Headers): Promise<Actor>;
```

Bootstrap response:

```ts
{
  actor: { id: string; email: string; name: string },
  workspace: { id: string; name: string; slug: string }
}
```

- [ ] **Step 1: Unit-test unauthenticated and authenticated actor mapping.**

Keep Better Auth session shape inside the identity infrastructure/application boundary.

- [ ] **Step 2: Implement session lookup with `auth.api.getSession({ headers })`.**

`requireCurrentActor` throws `ApplicationError("UNAUTHORIZED", 401)` when no session exists.

- [ ] **Step 3: Implement `/api/v1/bootstrap`.**

Flow: request headers → require actor → `ensurePersonalWorkspace` → Zod response contract. Route handler contains no DB or business logic.

- [ ] **Step 4: Add API integration tests.**

No cookie → 401. Valid session cookie → 200 and personal workspace. Repeating the request returns the same workspace.

---

### Task 5: Story domain, repository, and use-cases

**Files:**
- Create: `src/backend/infrastructure/database/schema/story.schema.ts`
- Modify: schema index + Drizzle migration
- Create: Story domain/repository/use-case files listed in File Map
- Test: colocated unit tests and repository integration test

**Interfaces:**

```ts
export interface Story {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}
```

Repository methods:

```ts
create(story: Story): Promise<Story>;
findById(id: string): Promise<Story | null>;
listByWorkspace(workspaceId: string): Promise<Story[]>;
update(input: { id: string; name?: string; description?: string }): Promise<Story | null>;
delete(id: string): Promise<boolean>;
```

- [ ] **Step 1: Write domain/use-case tests first with fake repositories/access services.**

Cover create/list/get/update/delete, 403 on missing capability, and 404 for a Story that does not exist or belongs to another inaccessible workspace.

- [ ] **Step 2: Add the Story schema.**

`stories`: `id uuid PK`, `workspace_id text NOT NULL FK organization.id`, `name text NOT NULL`, `description text NOT NULL DEFAULT ''`, timestamps. Add an index on `workspace_id`.

- [ ] **Step 3: Generate and inspect a committed migration.**

No runtime `push`; use `db:generate` then `db:migrate`.

- [ ] **Step 4: Implement DrizzleStoryRepository.**

Map rows to domain objects. Do not expose Drizzle row types outside infrastructure.

- [ ] **Step 5: Implement application use-cases.**

Each write/read requires an explicit capability through `WorkspaceAccessService`. Story IDs are generated in application code with `crypto.randomUUID()`.

- [ ] **Step 6: Repository integration tests.**

Run against PostgreSQL and verify workspace filtering, FK behavior, timestamps, updates, and deletion.

---

### Task 6: Story HTTP contracts and `/api/v1` CRUD

**Files:**
- Create contract files listed in File Map
- Create: `src/app/api/v1/stories/route.ts`
- Create: `src/app/api/v1/stories/[storyId]/route.ts`
- Create: common API error mapper if needed
- Test: API integration tests

**Interfaces:**

```text
GET    /api/v1/stories
POST   /api/v1/stories
GET    /api/v1/stories/:storyId
PATCH  /api/v1/stories/:storyId
DELETE /api/v1/stories/:storyId
```

- [ ] **Step 1: Define Zod request/response contracts before routes.**

Create request: `name` trimmed 1..120, `description` max 5000 default `""`.
Update request: at least one of name/description; same limits.
Story responses expose ISO timestamp strings, not Date objects or DB rows.

- [ ] **Step 2: Add failing API tests for 401/400/403/404 and happy paths.**

Authenticate with a real Better Auth cookie. Verify another user's Story cannot be accessed by ID.

- [ ] **Step 3: Implement thin route handlers.**

Each route: parse → actor/bootstrap workspace → application use-case → response contract → shared error mapping.

- [ ] **Step 4: Verify CRUD integration against PostgreSQL.**

Create → list → get → update → delete → get returns 404.

---

### Task 7: Minimal authentication and Story dashboard UI

**Files:**
- Create auth pages/forms + dashboard files listed in File Map
- Modify frontend APIs/query modules
- Modify root providers only if auth/query composition requires it
- Test: component tests

**Interfaces:**
- `/signup`, `/login`, `/dashboard`
- Dashboard calls `/api/v1/bootstrap` then `/api/v1/stories`.

- [ ] **Step 1: Component-test signup/login form validation and submit states.**

Email/password fields only. Do not add OAuth UI.

- [ ] **Step 2: Implement signup.**

Call Better Auth `signUp.email`; on success immediately call the idempotent `/api/v1/bootstrap`, then navigate to `/dashboard`.

- [ ] **Step 3: Implement login.**

Call Better Auth `signIn.email`, bootstrap, then dashboard.

- [ ] **Step 4: Implement a minimal dashboard.**

Display workspace name, Story list, and a small create-story form. Keep styling intentionally basic; graph editor UI is a later phase.

- [ ] **Step 5: Unauthenticated dashboard behavior.**

If bootstrap returns 401, navigate to `/login`; do not rely on UI hiding for authorization.

---

### Task 8: Full PostgreSQL integration/E2E quality gate

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `tests/e2e/auth-story.spec.ts`
- Modify scripts if needed

**Interfaces:**
- CI proves migrations, Better Auth, Workspace provisioning, Story CRUD, build, and browser flows together.

- [ ] **Step 1: Add integration-test command if separate from Vitest unit suite.**

Use one Vitest config/environment but make CI naming explicit, e.g. `pnpm test:integration` for `tests/integration/**/*.test.ts`.

- [ ] **Step 2: Reset/migrate the CI database deterministically.**

Run Drizzle migrations once per job before integration tests and browser startup. Tests create unique emails and clean their own rows where practical.

- [ ] **Step 3: Add Playwright auth + Story E2E.**

Flow:
1. Open `/signup`.
2. Create a unique account.
3. Arrive at `/dashboard`.
4. Confirm personal workspace is visible.
5. Create `My First Story`.
6. Reload the page.
7. Confirm the Story still exists.
8. Sign out/login again if sign-out UI exists in the implemented minimal surface; otherwise verify session by a new page navigation.

- [ ] **Step 4: Run the final quality gate.**

Required green sequence:

```text
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm check
pnpm test:integration
pnpm build
clean-tree verification
Chromium install
pnpm e2e
```

- [ ] **Step 5: Final architecture regression review.**

Verify frontend cannot import Better Auth server, `pg`, Drizzle, or backend modules through alias/relative/dynamic imports. Update the existing boundary regression script when a new forbidden package family is introduced.

---

## Self-review results

- Spec coverage: PostgreSQL/Drizzle, cookie session auth, Better Auth Organization Workspace, backend authorization, Story CRUD, migrations, test pyramid, and future backend separation are covered.
- V1 scope: email/password only; no Redis/OAuth/graph editor/realtime systems.
- Failure recovery: personal Workspace creation is idempotent and retried through bootstrap rather than relying on a one-shot user-create hook.
- Boundary consistency: Story application code sees `Actor`, `WorkspaceAccessService`, and `StoryRepository`, not Better Auth/Drizzle types.
- Migration consistency: Better Auth schema is generated by the pinned CLI and then migrated by Drizzle; production startup never pushes schema.
- Placeholder scan: no TBD/TODO implementation placeholders are intentionally left in this plan.
