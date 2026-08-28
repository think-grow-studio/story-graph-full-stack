# Story Graph Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Story Graph Next.js codebase with enforceable frontend/backend/contracts boundaries, AI instruction files, centralized runtime configuration, a thin API vertical slice, tests, and CI.

**Architecture:** Run one Next.js App Router application, but treat `src/frontend`, `src/backend`, and `src/contracts` as separate logical systems. `src/app` is framework composition/adapter code only. This foundation deliberately stops before database, authentication, Story CRUD, Graph domain, or Graph Editor implementation.

**Tech Stack:** Node.js 24 LTS, pnpm 11.21, Next.js App Router, strict TypeScript, Tailwind CSS, Zod, Axios, TanStack Query, Vitest, React Testing Library, Playwright, ESLint, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`

## Global Constraints

- Use one Next.js full-stack modular monolith.
- Frontend and backend application data communicate through explicit `/api/v1` HTTP contracts.
- Frontend must not import backend, Drizzle, or database modules.
- Server Components must not bypass the application HTTP boundary to query application data directly.
- `src/contracts` contains only transport schemas/types and contract-local helpers.
- Keep TypeScript strict and deployment provider-neutral.
- `AGENTS.md` is authoritative; sibling `CLAUDE.md` contains only `@AGENTS.md`.
- Keep each architecture `AGENTS.md` at 500 characters or fewer.
- Do not add PostgreSQL, Drizzle, Better Auth, React Flow, Zustand, Redis, WebSocket, Yjs/CRDT, or Neo4j in this plan.

---

## File Map

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
├─ scripts/validate-agent-files.mjs
├─ src/
│  ├─ app/
│  │  ├─ AGENTS.md
│  │  ├─ CLAUDE.md
│  │  ├─ (marketing)/page.tsx
│  │  ├─ api/v1/health/route.ts
│  │  ├─ globals.css
│  │  └─ layout.tsx
│  ├─ backend/
│  │  ├─ AGENTS.md
│  │  ├─ CLAUDE.md
│  │  ├─ infrastructure/AGENTS.md
│  │  ├─ infrastructure/CLAUDE.md
│  │  └─ modules/system/application/get-health/
│  │     ├─ get-health.use-case.ts
│  │     └─ get-health.use-case.test.ts
│  ├─ config/
│  │  ├─ env.schema.ts
│  │  ├─ env.schema.test.ts
│  │  ├─ env.client.ts
│  │  └─ env.server.ts
│  ├─ contracts/
│  │  ├─ AGENTS.md
│  │  ├─ CLAUDE.md
│  │  └─ system/health.contract.ts
│  └─ frontend/
│     ├─ AGENTS.md
│     ├─ CLAUDE.md
│     ├─ api/client/api-client.ts
│     ├─ api/client/api-client.test.ts
│     ├─ api/system/system.api.ts
│     ├─ app/providers/app-providers.tsx
│     ├─ app/providers/query-provider.tsx
│     ├─ features/graph-editor/AGENTS.md
│     ├─ features/graph-editor/CLAUDE.md
│     └─ pages/home/
│        ├─ home-page.tsx
│        └─ home-page.test.tsx
├─ tests/
│  ├─ AGENTS.md
│  ├─ CLAUDE.md
│  └─ e2e/smoke.spec.ts
├─ tsconfig.json
├─ vitest.config.ts
└─ vitest.setup.ts
```

---

### Task 1: Bootstrap the Next.js shell

**Files:**
- Create/Modify: `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `tsconfig.json`
- Create/Modify: `src/app/layout.tsx`, `src/app/globals.css`
- Create: `src/app/(marketing)/page.tsx`
- Create: `src/frontend/pages/home/home-page.tsx`
- Delete after scaffold: `src/app/page.tsx`

**Interfaces:**
- Consumes: architecture spec.
- Produces: `HomePage()`, `@/* -> ./src/*`, Node 24 runtime declaration, working `dev/build/start/lint/typecheck` scripts.

- [ ] **Step 1: Scaffold in a temporary directory so `docs/` is preserved**

```bash
rm -rf /tmp/story-graph-next
pnpm dlx create-next-app@latest /tmp/story-graph-next \
  --ts --tailwind --eslint --app --src-dir \
  --import-alias '@/*' --use-pnpm
rsync -a --exclude='.git' /tmp/story-graph-next/ ./
rm -rf /tmp/story-graph-next
```

Expected: `docs/superpowers/**` still exists and a standard Next.js App Router project is present.

- [ ] **Step 2: Pin runtime/package manager and add typecheck**

Create `.nvmrc`:

```text
24
```

Set these `package.json` fields while preserving scaffolded dependencies:

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

- [ ] **Step 3: Create the first frontend-owned page**

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

- [ ] **Step 4: Make the Next route compose that page**

Delete `src/app/page.tsx` and create `src/app/(marketing)/page.tsx`:

```tsx
import { HomePage } from "@/frontend/pages/home/home-page";

export default function Page() {
  return <HomePage />;
}
```

- [ ] **Step 5: Replace the root layout with framework-only composition**

Create/replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Story Graph",
  description: "Build and explore the structure of your story world.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Verify strict TypeScript and build**

Confirm `tsconfig.json` retains `"strict": true` and `"@/*": ["./src/*"]`, then run:

```bash
pnpm install
pnpm typecheck
pnpm build
```

Expected: both commands exit 0 and `/` is built.

- [ ] **Step 7: Commit**

```bash
git add .nvmrc package.json pnpm-lock.yaml tsconfig.json src/app src/frontend/pages next.config.* postcss.config.*
git commit -m "chore: bootstrap Next.js application"
```

---

### Task 2: Add the AGENTS/CLAUDE architecture instruction hierarchy

**Files:**
- Create: root and boundary `AGENTS.md` / `CLAUDE.md` pairs
- Create: `scripts/validate-agent-files.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `pnpm check:agents`; exactly eight initial `AGENTS.md` files, each <=500 characters, each with sibling `CLAUDE.md` equal to `@AGENTS.md\n`.

- [ ] **Step 1: Create root instructions**

`AGENTS.md`:

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

`CLAUDE.md`:

```md
@AGENTS.md
```

- [ ] **Step 2: Create `src/app`, `src/frontend`, and graph-editor instructions**

`src/app/AGENTS.md`:

```md
# Next.js Boundary
routing/composition 전용.
- page.tsx는 frontend 화면을 조합한다.
- route.ts는 validation→backend use-case→response만 담당한다.
- 비즈니스 로직과 DB 접근 금지.
- Server Component도 application DB를 직접 조회하지 않는다.
- 서버 데이터는 명시적 /api/v1 contract 경계를 따른다.
```

`src/frontend/AGENTS.md`:

```md
# Frontend
UI와 사용자 상호작용만 담당한다.
- backend/Drizzle/DB import 금지.
- 서버 접근은 frontend/api 경계를 사용한다.
- Entity=명사, Feature=사용자 행동, Widget=큰 UI 조합.
- 서버 상태는 TanStack Query, editor working state는 Zustand가 소유한다.
- 범용 UI만 shared에 둔다.
```

`src/frontend/features/graph-editor/AGENTS.md`:

```md
# Graph Editor
독립 subsystem처럼 다룬다.
- Zustand가 working state를 소유한다.
- React Flow는 rendering/input engine이다.
- Query cache를 drag/edit state로 쓰지 않는다.
- Story Node/Edge와 Board 표현 상태를 분리한다.
- 변경은 command/operation으로 표현해 undo/autosave 확장을 보존한다.
```

Create `CLAUDE.md` beside each with exactly `@AGENTS.md` plus newline.

- [ ] **Step 3: Create backend, infrastructure, contracts, and tests instructions**

`src/backend/AGENTS.md`:

```md
# Backend
도메인 중심 modular architecture.
- module은 domain/application/infrastructure 경계를 지킨다.
- application에서 DB/Drizzle 직접 접근 금지.
- Route Handler 로직을 module에 섞지 않는다.
- Node/Edge는 Story 공용 데이터이며 Board가 소유하지 않는다.
- 권한과 트랜잭션은 use-case 경계에서 명시한다.
```

`src/backend/infrastructure/AGENTS.md`:

```md
# Infrastructure
외부 기술 구현을 격리한다.
- Drizzle/PostgreSQL/Auth/Cache 직접 접근은 이 계층에 둔다.
- domain에 DB 타입을 노출하지 않는다.
- DB row를 그대로 API response로 반환하지 않는다.
- JSONB 구조는 contract/domain validation을 거친다.
```

`src/contracts/AGENTS.md`:

```md
# API Contracts
Frontend↔Backend의 유일한 공유 계약.
- Zod Request/Response schema와 API 타입만 둔다.
- DB model, Repository, UseCase, React UI import 금지.
- API 변경은 contract 변경으로 명시한다.
- 외부 계약을 구현 세부사항과 분리한다.
```

`tests/AGENTS.md`:

```md
# Tests
아키텍처 경계와 observable behavior를 검증한다.
- domain/application은 가능한 DB 없이 unit test.
- Repository/API는 integration test.
- Graph 핵심 흐름은 Playwright E2E.
- editor는 edit→saved→reload→verify 패턴을 적극 사용한다.
- 버그 수정은 가능한 재현 테스트부터 추가한다.
```

Create sibling `CLAUDE.md` files exactly as above.

- [ ] **Step 4: Add a deterministic validator**

Create `scripts/validate-agent-files.mjs`:

```js
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignored = new Set([".git", ".next", "node_modules"]);
const errors = [];

async function findAgents(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = [];

  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await findAgents(absolute)));
    if (entry.isFile() && entry.name === "AGENTS.md") found.push(absolute);
  }

  return found;
}

const agentFiles = await findAgents(root);

for (const agentFile of agentFiles) {
  const content = await readFile(agentFile, "utf8");
  const relative = path.relative(root, agentFile);
  const claudeFile = path.join(path.dirname(agentFile), "CLAUDE.md");

  if ([...content].length > 500) errors.push(`${relative} exceeds 500 characters`);

  try {
    const claude = await readFile(claudeFile, "utf8");
    if (claude !== "@AGENTS.md\n") {
      errors.push(`${path.relative(root, claudeFile)} must contain only @AGENTS.md`);
    }
  } catch {
    errors.push(`${path.relative(root, claudeFile)} is missing`);
  }
}

if (agentFiles.length !== 8) errors.push(`expected 8 AGENTS.md files, found ${agentFiles.length}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Validated 8 AGENTS.md files.");
```

Add to `package.json`:

```json
{
  "scripts": {
    "check:agents": "node scripts/validate-agent-files.mjs"
  }
}
```

- [ ] **Step 5: Verify and commit**

```bash
pnpm check:agents
```

Expected: `Validated 8 AGENTS.md files.`

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

### Task 3: Configure unit and component testing

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Create: `src/frontend/pages/home/home-page.test.tsx`

**Interfaces:**
- Consumes: `HomePage()`.
- Produces: `pnpm test`, `pnpm test:watch`, JSDOM + Testing Library for colocated tests.

- [ ] **Step 1: Install test dependencies**

```bash
pnpm add -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Add:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Write the failing component test**

`src/frontend/pages/home/home-page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomePage } from "./home-page";

describe("HomePage", () => {
  it("identifies Story Graph", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Story Graph" })).toBeInTheDocument();
  });
});
```

Run `pnpm test`. Expected: FAIL before Vitest setup is added.

- [ ] **Step 3: Add Vitest configuration**

`vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
  },
});
```

`vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Verify and commit**

```bash
pnpm test
pnpm typecheck
```

Expected: PASS.

```bash
git add package.json pnpm-lock.yaml vitest.config.ts vitest.setup.ts src/frontend/pages/home/home-page.test.tsx
git commit -m "test: add unit and component harness"
```

---

### Task 4: Add centralized environment config, API client, and Query provider

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `src/app/layout.tsx`
- Create: `src/config/env.schema.ts`, `src/config/env.schema.test.ts`, `src/config/env.client.ts`, `src/config/env.server.ts`
- Create: `src/frontend/api/client/api-client.ts`, `src/frontend/api/client/api-client.test.ts`
- Create: `src/frontend/app/providers/query-provider.tsx`, `src/frontend/app/providers/app-providers.tsx`

**Interfaces:**
- Produces:
  - `parseClientEnv(input): { NEXT_PUBLIC_API_BASE_URL: string }`
  - `parseServerEnv(input): { NODE_ENV: "development" | "test" | "production" }`
  - `clientEnv`, `serverEnv`
  - `apiClient` with base URL `/api/v1` by default and credentials enabled
  - `AppProviders` wrapping TanStack Query.

- [ ] **Step 1: Install runtime dependencies**

```bash
pnpm add zod axios @tanstack/react-query server-only
```

- [ ] **Step 2: Write failing pure environment parser tests**

`src/config/env.schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseClientEnv, parseServerEnv } from "./env.schema";

describe("environment schemas", () => {
  it("defaults the client API URL", () => {
    expect(parseClientEnv({}).NEXT_PUBLIC_API_BASE_URL).toBe("/api/v1");
  });

  it("accepts a valid server environment", () => {
    expect(parseServerEnv({ NODE_ENV: "test" }).NODE_ENV).toBe("test");
  });

  it("rejects an invalid server environment", () => {
    expect(() => parseServerEnv({ NODE_ENV: "invalid" })).toThrow();
  });
});
```

Run:

```bash
pnpm test -- src/config/env.schema.test.ts
```

Expected: FAIL because `env.schema.ts` does not exist.

- [ ] **Step 3: Implement environment schemas and readers**

`src/config/env.schema.ts`:

```ts
import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().min(1).default("/api/v1"),
});

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
});

export function parseClientEnv(input: Record<string, string | undefined>) {
  return clientSchema.parse(input);
}

export function parseServerEnv(input: Record<string, string | undefined>) {
  return serverSchema.parse(input);
}
```

`src/config/env.client.ts`:

```ts
import { parseClientEnv } from "./env.schema";

export const clientEnv = parseClientEnv({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
});
```

`src/config/env.server.ts`:

```ts
import "server-only";

import { parseServerEnv } from "./env.schema";

export const serverEnv = parseServerEnv({
  NODE_ENV: process.env.NODE_ENV,
});
```

Run the focused test. Expected: PASS.

- [ ] **Step 4: Write the failing API-client test**

`src/frontend/api/client/api-client.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { apiClient } from "./api-client";

describe("apiClient", () => {
  it("uses the versioned HTTP boundary and cookies", () => {
    expect(apiClient.defaults.baseURL).toBe("/api/v1");
    expect(apiClient.defaults.withCredentials).toBe(true);
  });
});
```

Run the focused test. Expected: FAIL because `api-client.ts` does not exist.

- [ ] **Step 5: Implement the frontend API client**

`src/frontend/api/client/api-client.ts`:

```ts
import axios from "axios";

import { clientEnv } from "@/config/env.client";

export const apiClient = axios.create({
  baseURL: clientEnv.NEXT_PUBLIC_API_BASE_URL,
  withCredentials: true,
});
```

Run the focused test. Expected: PASS.

- [ ] **Step 6: Add Query provider and root provider composition**

`src/frontend/app/providers/query-provider.tsx`:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

`src/frontend/app/providers/app-providers.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";

import { QueryProvider } from "./query-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
```

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "@/frontend/app/providers/app-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Story Graph",
  description: "Build and explore the structure of your story world.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Verify and commit**

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: PASS.

```bash
git add package.json pnpm-lock.yaml src/config src/frontend/api/client src/frontend/app/providers src/app/layout.tsx
git commit -m "feat: add runtime config and frontend providers"
```

---

### Task 5: Add a complete `/api/v1/health` vertical slice

**Files:**
- Create: `src/contracts/system/health.contract.ts`
- Create: `src/backend/modules/system/application/get-health/get-health.use-case.ts`
- Create: `src/backend/modules/system/application/get-health/get-health.use-case.test.ts`
- Create: `src/app/api/v1/health/route.ts`
- Create: `src/frontend/api/system/system.api.ts`

**Interfaces:**
- Produces:
  - `healthResponseSchema`
  - `HealthResponse = { status: "ok" }`
  - `getHealth(): HealthResponse`
  - `fetchHealth(): Promise<HealthResponse>`
  - `GET /api/v1/health` returns HTTP 200 `{ "status": "ok" }`.

- [ ] **Step 1: Define the contract**

`src/contracts/system/health.contract.ts`:

```ts
import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
```

- [ ] **Step 2: Write the failing use-case test**

`src/backend/modules/system/application/get-health/get-health.use-case.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { getHealth } from "./get-health.use-case";

describe("getHealth", () => {
  it("returns the health contract", () => {
    expect(getHealth()).toEqual({ status: "ok" });
  });
});
```

Run the focused test. Expected: FAIL because the implementation is missing.

- [ ] **Step 3: Implement the use-case**

`src/backend/modules/system/application/get-health/get-health.use-case.ts`:

```ts
import type { HealthResponse } from "@/contracts/system/health.contract";

export function getHealth(): HealthResponse {
  return { status: "ok" };
}
```

Run the focused test. Expected: PASS.

- [ ] **Step 4: Add the thin Next API adapter**

`src/app/api/v1/health/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getHealth } from "@/backend/modules/system/application/get-health/get-health.use-case";
import { healthResponseSchema } from "@/contracts/system/health.contract";

export async function GET() {
  return NextResponse.json(healthResponseSchema.parse(getHealth()));
}
```

- [ ] **Step 5: Add the frontend API function**

`src/frontend/api/system/system.api.ts`:

```ts
import { healthResponseSchema, type HealthResponse } from "@/contracts/system/health.contract";
import { apiClient } from "@/frontend/api/client/api-client";

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await apiClient.get("/health");
  return healthResponseSchema.parse(response.data);
}
```

- [ ] **Step 6: Verify and commit**

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: PASS and build output includes `/api/v1/health`.

```bash
git add src/contracts/system src/backend/modules/system src/app/api/v1/health src/frontend/api/system
git commit -m "feat: add health API vertical slice"
```

---

### Task 6: Enforce source import boundaries with ESLint

**Files:**
- Modify: `eslint.config.mjs`

**Interfaces:**
- Produces: lint failures for frontend→backend/Drizzle, backend→frontend, contracts→implementation, and page/layout→backend imports. API `route.ts` files remain allowed to call backend application code.

- [ ] **Step 1: Append these flat-config overrides after the Next presets**

```js
{
  files: ["src/frontend/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [{
        group: ["@/backend/**", "drizzle-orm", "drizzle-orm/**"],
        message: "Frontend must use frontend/api and /api/v1 contracts.",
      }],
    }],
  },
},
{
  files: ["src/backend/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [{
        group: ["@/frontend/**"],
        message: "Backend must not depend on frontend implementation.",
      }],
    }],
  },
},
{
  files: ["src/contracts/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [{
        group: ["@/frontend/**", "@/backend/**", "@/app/**", "react", "react/**"],
        message: "Contracts may contain only transport schemas/types and contract-local helpers.",
      }],
    }],
  },
},
{
  files: ["src/app/**/page.tsx", "src/app/**/layout.tsx"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [{
        group: ["@/backend/**", "drizzle-orm", "drizzle-orm/**"],
        message: "Pages/layouts must not bypass the HTTP application boundary.",
      }],
    }],
  },
},
```

- [ ] **Step 2: Verify the repository currently passes**

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Prove a forbidden frontend import is rejected**

```bash
cat > src/frontend/__architecture_violation__.ts <<'EOF'
import { getHealth } from "@/backend/modules/system/application/get-health/get-health.use-case";
export const violation = getHealth;
EOF
pnpm eslint src/frontend/__architecture_violation__.ts
```

Expected: FAIL with `Frontend must use frontend/api and /api/v1 contracts.`

```bash
rm src/frontend/__architecture_violation__.ts
```

- [ ] **Step 4: Prove API routes may call backend application code**

```bash
pnpm eslint src/app/api/v1/health/route.ts
```

Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: PASS.

```bash
git add eslint.config.mjs
git commit -m "chore: enforce architecture import boundaries"
```

---

### Task 7: Add Playwright runtime smoke tests

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `/` and `/api/v1/health`.
- Produces: `pnpm e2e` with Chromium against a real Next dev server.

- [ ] **Step 1: Install Playwright and add the command**

```bash
pnpm add -D @playwright/test
```

Add:

```json
{
  "scripts": {
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Configure Playwright**

`playwright.config.ts`:

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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

- [ ] **Step 3: Write smoke E2E tests**

`tests/e2e/smoke.spec.ts`:

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

- [ ] **Step 4: Run and commit**

```bash
pnpm exec playwright install chromium
pnpm e2e
pnpm build
```

Expected: two E2E tests PASS and build PASS.

```bash
git add package.json pnpm-lock.yaml playwright.config.ts tests/e2e/smoke.spec.ts
git commit -m "test: add browser and API smoke coverage"
```

---

### Task 8: Add aggregate quality gates and GitHub Actions CI

**Files:**
- Modify: `package.json`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `pnpm check` for fast local gates and CI covering install, instruction validation, lint, typecheck, unit tests, production build, and Playwright.

- [ ] **Step 1: Add aggregate scripts**

```json
{
  "scripts": {
    "check": "pnpm check:agents && pnpm lint && pnpm typecheck && pnpm test",
    "ci": "pnpm check && pnpm build && pnpm e2e"
  }
}
```

Run `pnpm check`. Expected: PASS.

- [ ] **Step 2: Create CI workflow**

`.github/workflows/ci.yml`:

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

      - name: Check architecture and unit tests
        run: pnpm check

      - name: Production build
        run: pnpm build

      - name: Install Chromium
        run: pnpm exec playwright install --with-deps chromium

      - name: E2E
        run: pnpm e2e
```

- [ ] **Step 3: Run the exact local release gates**

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm exec playwright install chromium
pnpm e2e
```

Expected: every command exits 0.

- [ ] **Step 4: Confirm no out-of-scope dependencies slipped in**

```bash
pnpm list drizzle-orm better-auth @xyflow/react zustand yjs neo4j-driver redis
```

Expected: none of these packages are installed.

- [ ] **Step 5: Commit**

```bash
git add package.json .github/workflows/ci.yml
git commit -m "ci: add Story Graph foundation quality gates"
```

---

## Final Verification

From a clean checkout of the implementation branch:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm exec playwright install chromium
pnpm e2e
```

Expected:

```text
AGENTS/CLAUDE validation  PASS
ESLint                    PASS
TypeScript                PASS
Vitest                    PASS
Next production build     PASS
Playwright                PASS
```

Architecture acceptance:

```text
/                       app → frontend composition works
/api/v1/health          app/api → backend → contracts works
frontend → backend      rejected by ESLint
contracts → impl        rejected by ESLint
AGENTS/CLAUDE pairs     eight valid pairs, <=500-char AGENTS
DB/Auth/Graph Editor    not implemented or installed
```

## Follow-up Plans

Execute independent plans in this order after Foundation is merged:

1. **Auth, Workspace, Story Foundation** — PostgreSQL + Drizzle, migrations, Better Auth, Organization→Workspace mapping, authorization adapter, Story CRUD.
2. **Graph Domain and API** — Node, Edge, Board, BoardNode, BoardEdge, directed multi-edge invariants, board snapshot, resource versions/409 behavior.
3. **Graph Editor V1** — React Flow, Zustand working state, node/edge creation and editing, Inspector, autosave queue, command history, reload-persistence E2E.

Each follow-up plan must reference the architecture spec and this Foundation plan rather than recreating the foundation.