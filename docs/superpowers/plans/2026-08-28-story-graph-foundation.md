# Story Graph Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap a production-ready Next.js foundation that enforces the Story Graph frontend/backend/contracts boundaries, provides the shared runtime/test/CI skeleton, and gives future feature plans a stable base to build on.

**Architecture:** Keep one Next.js App Router deployment while treating frontend and backend as logically separate systems. `src/app` is framework glue, `src/frontend` owns UI/client behavior, `src/backend` owns application/domain/infrastructure code, and `src/contracts` is the only shared HTTP contract boundary. This plan intentionally does not add database, auth, graph-editor, or Story domain behavior yet; those are separate implementation plans.

**Tech Stack:** Node.js 24 LTS, pnpm 11, Next.js App Router, strict TypeScript, Tailwind CSS, Zod, Axios, TanStack Query, Vitest, React Testing Library, Playwright, ESLint, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`

## Global Constraints

- Use a single Next.js full-stack modular monolith.
- Frontend code never imports backend, Drizzle, or database modules.
- Server Components do not bypass the HTTP API boundary for application data.
- Business APIs live under `/api/v1`; auth routes are reserved for `/api/auth/*`.
- `src/contracts` contains only Zod request/response schemas and inferred API types.
- Keep deployment provider-neutral and Docker-compatible.
- TypeScript must remain strict.
- `AGENTS.md` is the source of truth; sibling `CLAUDE.md` contains only `@AGENTS.md`.
- Each `AGENTS.md` must remain at or below roughly 500 Korean characters and focus on invariants.
- Do not introduce PostgreSQL, Drizzle, Better Auth, React Flow, Zustand, Redis, WebSocket, CRDT, or Graph DB in this foundation plan.

---

## File Map

Files created or owned by this plan:

```text
/
├─ .github/workflows/ci.yml
├─ .nvmrc
├─ AGENTS.md
├─ CLAUDE.md
├─ eslint.config.mjs
├─ package.json
├─ playwright.config.ts
├─ pnpm-lock.yaml
├─ scripts/
│  └─ validate-agent-files.mjs
├─ src/
│  ├─ app/
│  │  ├─ AGENTS.md
│  │  ├─ CLAUDE.md
│  │  ├─ (marketing)/page.tsx
│  │  ├─ api/v1/health/route.ts
│  │  ├─ globals.css
│  │  ├─ layout.tsx
│  │  └─ favicon.ico
│  ├─ backend/
│  │  ├─ AGENTS.md
│  │  ├─ CLAUDE.md
│  │  ├─ infrastructure/
│  │  │  ├─ AGENTS.md
│  │  │  └─ CLAUDE.md
│  │  └─ modules/system/application/get-health/
│  │     ├─ get-health.use-case.test.ts
│  │     └─ get-health.use-case.ts
│  ├─ config/
│  │  ├─ env.client.test.ts
│  │  ├─ env.client.ts
│  │  ├─ env.server.test.ts
│  │  └─ env.server.ts
│  ├─ contracts/
│  │  ├─ AGENTS.md
│  │  ├─ CLAUDE.md
│  │  └─ system/health.contract.ts
│  └─ frontend/
│     ├─ AGENTS.md
│     ├─ CLAUDE.md
│     ├─ api/client/api-client.test.ts
│     ├─ api/client/api-client.ts
│     ├─ api/system/system.api.ts
│     ├─ app/providers/app-providers.tsx
│     ├─ app/providers/query-provider.tsx
│     ├─ features/graph-editor/
│     │  ├─ AGENTS.md
│     │  └─ CLAUDE.md
│     └─ pages/home/
│        ├─ home-page.test.tsx
│        └─ home-page.tsx
├─ tests/
│  ├─ AGENTS.md
│  ├─ CLAUDE.md
│  └─ e2e/smoke.spec.ts
├─ tsconfig.json
├─ vitest.config.ts
└─ vitest.setup.ts
```

The Next.js scaffold may create additional standard files such as `next.config.ts` and `postcss.config.mjs`; keep them minimal and framework-default unless a later task requires a change.

---

### Task 1: Bootstrap the Next.js application shell

**Files:**
- Create/Modify: `package.json`
- Create: `.nvmrc`
- Create/Modify: `src/app/layout.tsx`
- Create/Modify: `src/app/globals.css`
- Create: `src/app/(marketing)/page.tsx`
- Create: `src/frontend/pages/home/home-page.tsx`
- Delete after scaffold: `src/app/page.tsx`
- Create/Modify: `tsconfig.json`

**Interfaces:**
- Consumes: approved architecture spec only.
- Produces: `HomePage(): JSX.Element`, strict TS alias `@/* -> ./src/*`, standard Next.js dev/build/start scripts, Node 24 runtime declaration.

- [ ] **Step 1: Scaffold Next.js in a temporary directory**

Run from the repository root so the existing `docs/` directory is preserved:

```bash
rm -rf /tmp/story-graph-next
pnpm dlx create-next-app@latest /tmp/story-graph-next \
  --ts \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias '@/*' \
  --use-pnpm
rsync -a --exclude='.git' /tmp/story-graph-next/ ./
rm -rf /tmp/story-graph-next
```

Expected: the repository now contains a standard Next.js App Router project while the existing `docs/superpowers/**` files remain intact.

- [ ] **Step 2: Pin the runtime line and package-manager major**

Create `.nvmrc`:

```text
24
```

Ensure `package.json` contains:

```json
{
  "packageManager": "pnpm@11.21.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

Preserve all dependencies generated by `create-next-app`.

- [ ] **Step 3: Create the first frontend page component**

Create `src/frontend/pages/home/home-page.tsx`:

```tsx
export function HomePage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">Story Graph</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Build and explore the structure of your story world.
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Make Next.js routing compose the frontend page**

Delete `src/app/page.tsx` and create `src/app/(marketing)/page.tsx`:

```tsx
import { HomePage } from "@/frontend/pages/home/home-page";

export default function Page() {
  return <HomePage />;
}
```

Keep `src/app/layout.tsx` limited to metadata, global CSS import, and rendering `children`.

- [ ] **Step 5: Verify strict TypeScript and the production build**

Confirm `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Run:

```bash
pnpm install
pnpm typecheck
pnpm build
```

Expected: both commands exit 0 and the build includes `/`.

- [ ] **Step 6: Commit the shell**

```bash
git add .nvmrc package.json pnpm-lock.yaml src/app src/frontend/pages tsconfig.json next.config.* postcss.config.*
git commit -m "chore: bootstrap Next.js application"
```

---

### Task 2: Install and configure the unit/component test harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/frontend/pages/home/home-page.test.tsx`

**Interfaces:**
- Consumes: `HomePage()` from Task 1.
- Produces: `pnpm test` and `pnpm test:watch`; JSDOM + Testing Library environment available to all colocated `*.test.ts(x)` files.

- [ ] **Step 1: Add test dependencies**

Run:

```bash
pnpm add -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Write the failing HomePage test**

Create `src/frontend/pages/home/home-page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomePage } from "./home-page";

describe("HomePage", () => {
  it("identifies the product", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "Story Graph" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test before configuring Vitest**

Run:

```bash
pnpm test
```

Expected: FAIL because Vitest/JSDOM/alias setup is not configured yet.

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
  },
});
```

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Run tests and typecheck**

```bash
pnpm test
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit test infrastructure**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts vitest.setup.ts src/frontend/pages/home/home-page.test.tsx
git commit -m "test: add unit and component test harness"
```

---

### Task 3: Establish the AGENTS/CLAUDE instruction hierarchy

**Files:**
- Create: `AGENTS.md`, `CLAUDE.md`
- Create: `src/app/AGENTS.md`, `src/app/CLAUDE.md`
- Create: `src/frontend/AGENTS.md`, `src/frontend/CLAUDE.md`
- Create: `src/frontend/features/graph-editor/AGENTS.md`, `src/frontend/features/graph-editor/CLAUDE.md`
- Create: `src/backend/AGENTS.md`, `src/backend/CLAUDE.md`
- Create: `src/backend/infrastructure/AGENTS.md`, `src/backend/infrastructure/CLAUDE.md`
- Create: `src/contracts/AGENTS.md`, `src/contracts/CLAUDE.md`
- Create: `tests/AGENTS.md`, `tests/CLAUDE.md`
- Create: `scripts/validate-agent-files.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: architecture invariants from the spec.
- Produces: deterministic local/CI check `pnpm check:agents`; every architecture-boundary `CLAUDE.md` imports the sibling `AGENTS.md` exactly.

- [ ] **Step 1: Add the root instruction pair**

Create `AGENTS.md`:

```md
# Story Graph
Next.js full-stack modular monolith.
- Frontend↔Backend는 HTTP API 경계를 지킨다.
- frontend에서 backend/DB 직접 import 금지.
- 공용 API 타입은 contracts만 사용한다.
- Board=View, Scope=State, Node/Edge 원본은 Story가 소유한다.
- 기능은 domain/feature 단위로 배치한다.
- 구조 변경 시 관련 AGENTS.md와 architecture 문서를 함께 갱신한다.
```

Create `CLAUDE.md`:

```md
@AGENTS.md
```

- [ ] **Step 2: Add framework/frontend/editor instructions**

Create `src/app/AGENTS.md`:

```md
# Next.js Boundary
routing/composition 전용.
- page.tsx는 frontend 화면을 조합한다.
- route.ts는 validation→backend use-case→response만 담당한다.
- 비즈니스 로직과 DB 접근 금지.
- Server Component도 application DB를 직접 조회하지 않는다.
- 서버 데이터는 명시적 /api/v1 contract 경계를 따른다.
```

Create `src/frontend/AGENTS.md`:

```md
# Frontend
UI와 사용자 상호작용만 담당한다.
- backend/Drizzle/DB import 금지.
- 서버 접근은 frontend/api 경계를 사용한다.
- Entity=명사, Feature=사용자 행동, Widget=큰 UI 조합.
- 서버 상태는 TanStack Query, editor working state는 Zustand가 소유한다.
- 범용 UI만 shared에 둔다.
```

Create `src/frontend/features/graph-editor/AGENTS.md`:

```md
# Graph Editor
독립 subsystem처럼 다룬다.
- Zustand가 working state를 소유한다.
- React Flow는 rendering/input engine이다.
- Query cache를 drag/edit state로 쓰지 않는다.
- Story Node/Edge와 Board 표현 상태를 분리한다.
- 변경은 command/operation으로 표현해 undo/autosave 확장을 보존한다.
```

For each directory above, create sibling `CLAUDE.md` containing exactly:

```md
@AGENTS.md
```

- [ ] **Step 3: Add backend/contracts/tests instructions**

Create `src/backend/AGENTS.md`:

```md
# Backend
도메인 중심 modular architecture.
- module은 domain/application/infrastructure 경계를 지킨다.
- application에서 DB/Drizzle 직접 접근 금지.
- Route Handler 로직을 module에 섞지 않는다.
- Node/Edge는 Story 공용 데이터이며 Board가 소유하지 않는다.
- 권한과 트랜잭션은 use-case 경계에서 명시한다.
```

Create `src/backend/infrastructure/AGENTS.md`:

```md
# Infrastructure
외부 기술 구현을 격리한다.
- Drizzle/PostgreSQL/Auth/Cache 직접 접근은 이 계층에 둔다.
- domain에 DB 타입을 노출하지 않는다.
- DB row를 그대로 API response로 반환하지 않는다.
- JSONB 구조는 contract/domain validation을 거친다.
```

Create `src/contracts/AGENTS.md`:

```md
# API Contracts
Frontend↔Backend의 유일한 공유 계약.
- Zod Request/Response schema와 API 타입만 둔다.
- DB model, Repository, UseCase, React UI import 금지.
- API 변경은 contract 변경으로 명시한다.
- 외부 계약을 구현 세부사항과 분리한다.
```

Create `tests/AGENTS.md`:

```md
# Tests
아키텍처 경계와 observable behavior를 검증한다.
- domain/application은 가능한 DB 없이 unit test.
- Repository/API는 integration test.
- Graph 핵심 흐름은 Playwright E2E.
- editor는 edit→saved→reload→verify 패턴을 적극 사용한다.
- 버그 수정은 가능한 재현 테스트부터 추가한다.
```

For each directory, create sibling `CLAUDE.md` containing `@AGENTS.md` and a trailing newline.

- [ ] **Step 4: Write the validator**

Create `scripts/validate-agent-files.mjs`:

```js
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MAX_CHARS = 500;
const ignoredDirectories = new Set([".git", ".next", "node_modules"]);

async function findAgentFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;

    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findAgentFiles(absolute)));
    } else if (entry.name === "AGENTS.md") {
      files.push(absolute);
    }
  }

  return files;
}

const agentFiles = await findAgentFiles(ROOT);
const errors = [];

for (const agentFile of agentFiles) {
  const content = await readFile(agentFile, "utf8");
  const relative = path.relative(ROOT, agentFile);
  const claudeFile = path.join(path.dirname(agentFile), "CLAUDE.md");

  if ([...content].length > MAX_CHARS) {
    errors.push(`${relative} exceeds ${MAX_CHARS} characters`);
  }

  try {
    const claudeContent = await readFile(claudeFile, "utf8");
    if (claudeContent !== "@AGENTS.md\n") {
      errors.push(`${path.relative(ROOT, claudeFile)} must contain only @AGENTS.md`);
    }
  } catch {
    errors.push(`${path.relative(ROOT, claudeFile)} is missing`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${agentFiles.length} AGENTS.md files.`);
```

Add to `package.json`:

```json
{
  "scripts": {
    "check:agents": "node scripts/validate-agent-files.mjs"
  }
}
```

- [ ] **Step 5: Verify the hierarchy**

Run:

```bash
pnpm check:agents
```

Expected: PASS and prints `Validated 7 AGENTS.md files.`

- [ ] **Step 6: Commit instruction guardrails**

```bash
git add AGENTS.md CLAUDE.md src/app/AGENTS.md src/app/CLAUDE.md \
  src/frontend/AGENTS.md src/frontend/CLAUDE.md \
  src/frontend/features/graph-editor/AGENTS.md src/frontend/features/graph-editor/CLAUDE.md \
  src/backend/AGENTS.md src/backend/CLAUDE.md \
  src/backend/infrastructure/AGENTS.md src/backend/infrastructure/CLAUDE.md \
  src/contracts/AGENTS.md src/contracts/CLAUDE.md tests/AGENTS.md tests/CLAUDE.md \
  scripts/validate-agent-files.mjs package.json
git commit -m "docs: add architecture instruction hierarchy"
```

---

### Task 4: Add centralized environment configuration and frontend runtime providers

**Files:**
- Modify: `package.json`
- Create: `src/config/env.client.ts`
- Create: `src/config/env.client.test.ts`
- Create: `src/config/env.server.ts`
- Create: `src/config/env.server.test.ts`
- Create: `src/frontend/api/client/api-client.ts`
- Create: `src/frontend/api/client/api-client.test.ts`
- Create: `src/frontend/app/providers/query-provider.tsx`
- Create: `src/frontend/app/providers/app-providers.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: Next root layout from Task 1.
- Produces: `clientEnv.NEXT_PUBLIC_API_BASE_URL`, `serverEnv.NODE_ENV`, singleton `apiClient`, `QueryProvider`, `AppProviders`.

- [ ] **Step 1: Add application runtime dependencies**

Run:

```bash
pnpm add zod axios @tanstack/react-query
```

- [ ] **Step 2: Write failing environment tests**

Create `src/config/env.client.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { clientEnv } from "./env.client";

describe("clientEnv", () => {
  it("defaults the API boundary to /api/v1", () => {
    expect(clientEnv.NEXT_PUBLIC_API_BASE_URL).toBe("/api/v1");
  });
});
```

Create `src/config/env.server.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { serverEnv } from "./env.server";

describe("serverEnv", () => {
  it("exposes a validated Node environment", () => {
    expect(["development", "test", "production"]).toContain(serverEnv.NODE_ENV);
  });
});
```

Run:

```bash
pnpm test -- src/config/env.client.test.ts src/config/env.server.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement centralized environment readers**

Create `src/config/env.client.ts`:

```ts
import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().min(1).default("/api/v1"),
});

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
});
```

Create `src/config/env.server.ts`:

```ts
import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
});

export const serverEnv = serverEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
});
```

Because `server-only` intentionally blocks client/test imports, mock it in `vitest.config.ts` with an alias to a no-op test module or remove the direct server test if the current Next scaffold makes the package non-resolvable in Vitest. The production module must retain `import "server-only"`.

- [ ] **Step 4: Write the failing API client test**

Create `src/frontend/api/client/api-client.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { apiClient } from "./api-client";

describe("apiClient", () => {
  it("uses the Story Graph API boundary and cookies", () => {
    expect(apiClient.defaults.baseURL).toBe("/api/v1");
    expect(apiClient.defaults.withCredentials).toBe(true);
  });
});
```

Run:

```bash
pnpm test -- src/frontend/api/client/api-client.test.ts
```

Expected: FAIL because `api-client.ts` does not exist.

- [ ] **Step 5: Implement the shared frontend API client**

Create `src/frontend/api/client/api-client.ts`:

```ts
import axios from "axios";

import { clientEnv } from "@/config/env.client";

export const apiClient = axios.create({
  baseURL: clientEnv.NEXT_PUBLIC_API_BASE_URL,
  withCredentials: true,
});
```

- [ ] **Step 6: Add the TanStack Query provider**

Create `src/frontend/app/providers/query-provider.tsx`:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

Create `src/frontend/app/providers/app-providers.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";

import { QueryProvider } from "./query-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
```

Wrap root layout children:

```tsx
import { AppProviders } from "@/frontend/app/providers/app-providers";

// inside <body>
<AppProviders>{children}</AppProviders>
```

- [ ] **Step 7: Run focused and full verification**

```bash
pnpm test -- src/config/env.client.test.ts src/config/env.server.test.ts src/frontend/api/client/api-client.test.ts
pnpm typecheck
pnpm test
```

Expected: PASS.

- [ ] **Step 8: Commit runtime foundations**

```bash
git add package.json pnpm-lock.yaml src/config src/frontend/api/client src/frontend/app/providers src/app/layout.tsx vitest.config.ts
git commit -m "feat: add runtime config and client providers"
```

---

### Task 5: Implement a vertical health slice across contracts, backend, API, and frontend API client

**Files:**
- Create: `src/contracts/system/health.contract.ts`
- Create: `src/backend/modules/system/application/get-health/get-health.use-case.ts`
- Create: `src/backend/modules/system/application/get-health/get-health.use-case.test.ts`
- Create: `src/app/api/v1/health/route.ts`
- Create: `src/frontend/api/system/system.api.ts`

**Interfaces:**
- Consumes: `apiClient` from Task 4.
- Produces:
  - `healthResponseSchema`
  - `HealthResponse = { status: "ok" }`
  - `getHealth(): HealthResponse`
  - `fetchHealth(): Promise<HealthResponse>`
  - `GET /api/v1/health -> 200 { "status": "ok" }`

- [ ] **Step 1: Define the HTTP contract**

Create `src/contracts/system/health.contract.ts`:

```ts
import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
```

- [ ] **Step 2: Write the failing backend use-case test**

Create `src/backend/modules/system/application/get-health/get-health.use-case.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { getHealth } from "./get-health.use-case";

describe("getHealth", () => {
  it("returns the healthy system contract", () => {
    expect(getHealth()).toEqual({ status: "ok" });
  });
});
```

Run:

```bash
pnpm test -- src/backend/modules/system/application/get-health/get-health.use-case.test.ts
```

Expected: FAIL because the use-case module does not exist.

- [ ] **Step 3: Implement the backend use-case**

Create `src/backend/modules/system/application/get-health/get-health.use-case.ts`:

```ts
import type { HealthResponse } from "@/contracts/system/health.contract";

export function getHealth(): HealthResponse {
  return { status: "ok" };
}
```

Run the focused test again. Expected: PASS.

- [ ] **Step 4: Add the thin Next.js API adapter**

Create `src/app/api/v1/health/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getHealth } from "@/backend/modules/system/application/get-health/get-health.use-case";
import { healthResponseSchema } from "@/contracts/system/health.contract";

export async function GET() {
  const response = healthResponseSchema.parse(getHealth());
  return NextResponse.json(response);
}
```

This route contains no business rule and no database access.

- [ ] **Step 5: Add the frontend API function**

Create `src/frontend/api/system/system.api.ts`:

```ts
import { healthResponseSchema, type HealthResponse } from "@/contracts/system/health.contract";

import { apiClient } from "@/frontend/api/client/api-client";

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await apiClient.get("/health");
  return healthResponseSchema.parse(response.data);
}
```

- [ ] **Step 6: Verify type and unit boundaries**

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: PASS; `/api/v1/health` appears in the Next.js route build output.

- [ ] **Step 7: Commit the vertical slice**

```bash
git add src/contracts/system src/backend/modules/system src/app/api/v1/health src/frontend/api/system
git commit -m "feat: add health API vertical slice"
```

---

### Task 6: Enforce architecture import boundaries with ESLint

**Files:**
- Modify: `eslint.config.mjs`

**Interfaces:**
- Consumes: source boundaries created in Tasks 1–5.
- Produces: `pnpm lint` blocks frontend→backend/Drizzle, backend→frontend, contracts→implementation, and page/layout→backend imports while allowing `src/app/api/**/route.ts` to call backend use-cases.

- [ ] **Step 1: Add boundary overrides to the flat ESLint config**

Preserve the scaffolded Next.js ESLint presets and append these config objects before global ignores:

```js
{
  files: ["src/frontend/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/backend/**", "drizzle-orm", "drizzle-orm/**"],
            message: "Frontend must access server data through frontend/api and /api/v1 contracts.",
          },
        ],
      },
    ],
  },
},
{
  files: ["src/backend/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/frontend/**"],
            message: "Backend modules must not depend on frontend implementation.",
          },
        ],
      },
    ],
  },
},
{
  files: ["src/contracts/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/frontend/**", "@/backend/**", "@/app/**", "react", "react/**"],
            message: "Contracts may contain only transport schemas/types and contract-local helpers.",
          },
        ],
      },
    ],
  },
},
{
  files: ["src/app/**/page.tsx", "src/app/**/layout.tsx"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/backend/**", "drizzle-orm", "drizzle-orm/**"],
            message: "Page/layout code must not bypass the HTTP application boundary.",
          },
        ],
      },
    ],
  },
},
```

- [ ] **Step 2: Verify the current code passes**

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Prove frontend→backend imports fail**

Create a temporary file:

```bash
cat > src/frontend/__architecture_violation__.ts <<'EOF'
import { getHealth } from "@/backend/modules/system/application/get-health/get-health.use-case";
export const violation = getHealth;
EOF
pnpm eslint src/frontend/__architecture_violation__.ts
```

Expected: FAIL with `Frontend must access server data through frontend/api and /api/v1 contracts.`

Remove the file:

```bash
rm src/frontend/__architecture_violation__.ts
```

- [ ] **Step 4: Prove the API route may depend on backend code**

```bash
pnpm eslint src/app/api/v1/health/route.ts
```

Expected: PASS.

- [ ] **Step 5: Run full checks**

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: PASS.

- [ ] **Step 6: Commit enforcement**

```bash
git add eslint.config.mjs
git commit -m "chore: enforce architecture import boundaries"
```

---

### Task 7: Add Playwright smoke coverage for the browser and API boundary

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`
- Create: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `/` route and `GET /api/v1/health` from earlier tasks.
- Produces: `pnpm e2e` with Chromium; verifies the real Next.js runtime rather than mocked modules.

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
```

Add to `package.json`:

```json
{
  "scripts": {
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Create Playwright configuration**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

- [ ] **Step 3: Write the smoke E2E test**

Create `tests/e2e/smoke.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("renders the Story Graph shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Story Graph" })).toBeVisible();
});

test("serves the versioned health API", async ({ request }) => {
  const response = await request.get("/api/v1/health");

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});
```

- [ ] **Step 4: Install Chromium and run E2E**

```bash
pnpm exec playwright install chromium
pnpm e2e
```

Expected: 2 tests PASS.

- [ ] **Step 5: Re-run production build**

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Commit E2E foundation**

```bash
git add package.json pnpm-lock.yaml playwright.config.ts tests/e2e/smoke.spec.ts
git commit -m "test: add browser and API smoke coverage"
```

---

### Task 8: Add CI and a single local verification command

**Files:**
- Modify: `package.json`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: lint, typecheck, agent validation, unit/component tests, build, and E2E commands from prior tasks.
- Produces: `pnpm check` for local fast verification and a PR CI workflow that executes all foundation gates.

- [ ] **Step 1: Add aggregate scripts**

Add to `package.json`:

```json
{
  "scripts": {
    "check": "pnpm check:agents && pnpm lint && pnpm typecheck && pnpm test",
    "ci": "pnpm check && pnpm build && pnpm e2e"
  }
}
```

Run:

```bash
pnpm check
```

Expected: PASS.

- [ ] **Step 2: Create the GitHub Actions workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11.21.0
          run_install: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Check architecture and tests
        run: pnpm check

      - name: Build
        run: pnpm build

      - name: Install Playwright browser
        run: pnpm exec playwright install --with-deps chromium

      - name: E2E
        run: pnpm e2e
```

- [ ] **Step 3: Run the same gates locally**

```bash
pnpm check
pnpm build
pnpm e2e
```

Expected: all PASS.

- [ ] **Step 4: Inspect the final file boundaries**

Run:

```bash
find src tests -maxdepth 5 -type f | sort
```

Confirm:

```text
src/app                  framework adapters/composition
src/frontend             UI/client behavior
src/backend              backend application boundary
src/contracts            HTTP contracts only
tests/e2e                browser/runtime workflows
```

No frontend file may import `@/backend/**`.

- [ ] **Step 5: Commit CI**

```bash
git add package.json .github/workflows/ci.yml
git commit -m "ci: add Story Graph foundation quality gates"
```

---

## Final Verification

Run from a clean checkout of the implementation branch:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm exec playwright install chromium
pnpm e2e
```

Expected results:

```text
check:agents  PASS
eslint        PASS
typecheck     PASS
vitest        PASS
next build    PASS
playwright    PASS
```

Manual architecture check:

```text
1. `/` renders through app → frontend.
2. `/api/v1/health` renders through app/api → backend and validates through contracts.
3. frontend → backend imports are rejected by lint.
4. every AGENTS.md has a sibling CLAUDE.md containing only @AGENTS.md.
5. no DB/auth/graph-editor implementation dependency has been introduced yet.
```

## Follow-up Plans

After this plan is merged, create and execute these independent plans in order:

1. `Story Graph Auth, Workspace, and Story Foundation` — PostgreSQL/Drizzle, Better Auth, Workspace mapping, authorization adapter, Story CRUD.
2. `Story Graph Graph Domain and API` — Node, Edge, Board, BoardNode, BoardEdge, directed multi-edge invariants, board snapshot, optimistic locking.
3. `Story Graph Graph Editor V1` — React Flow, Zustand working state, Inspector, node/edge creation, autosave queue, undo/redo, reload persistence E2E.

Each follow-up plan must reference the architecture spec and this foundation as a prerequisite rather than duplicating foundation setup.