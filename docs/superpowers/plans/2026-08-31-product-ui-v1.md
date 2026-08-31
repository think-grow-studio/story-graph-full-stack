# Product UI V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Story Graph domain/editor V1 into a coherent Korean-first product flow from landing through authentication, Story/Board creation, and Graph Editor authoring without changing graph-domain semantics.

**Architecture:** Keep the existing Next.js full-stack modular-monolith boundaries and all Graph Editor persistence invariants. Add a small shared UI layer under `src/frontend/shared/ui`, a reusable authenticated `AppShell`, and focused page/action-surface refactors; dialogs are app-owned and implemented without a new component-library dependency. Runtime design tokens live in `src/app/globals.css` and are documented by root `DESIGN.md`.

**Tech Stack:** Node.js 24, pnpm 11.21.0, Next.js 16.3.3, React 19.2.8, Tailwind CSS 4.3.3, TanStack Query 5.102.3, Better Auth 1.6.29, Zustand 5.0.15, React Flow 12.11.5, Vitest 4.1.10, React Testing Library 16.3.2, Playwright 1.62.1.

**Spec:** `docs/superpowers/specs/2026-08-31-product-ui-v1-design.md`

## Global Constraints

- Preserve frontend → contracts/API boundaries; no frontend import from backend/database.
- Preserve Graph Editor Zustand, Command, Save Queue, autosave, CAS, Undo/Redo, NodeState, and EdgeState semantics.
- Keep public routes `/`, `/login`, `/signup` and authenticated routes `/dashboard`, `/stories/:storyId`, `/stories/:storyId/boards/:boardId`.
- User-facing UI is Korean-first: Story=`이야기`, Board=`보드`, Node=`노드`, Relationship=`관계`, Scope usually=`컨텍스트`.
- Google OAuth remains the only V1 authentication method; do not add email/password.
- Story creation navigates immediately to `/stories/:storyId` using returned `StoryResponse.id`.
- Board creation navigates immediately to `/stories/:storyId/boards/:boardId` using returned `BoardResponse.id`.
- Scope remains secondary; no hierarchy, deletion, live switching, or topology/existence state.
- No AI, realtime, billing, templates, team management, search/command palette, dark mode, or hard-delete flows.
- Accessibility target is WCAG 2.2 AA; use semantic controls, visible focus, keyboard-operable dialogs, and reduced-motion support.
- Do not add a general-purpose UI library; shared primitives stay small and product-specific.
- Every task follows RED → GREEN → focused verification → commit.

---

## File Structure Lock

Create:

```text
DESIGN.md
src/frontend/shared/ui/button.tsx
src/frontend/shared/ui/button.test.tsx
src/frontend/shared/ui/form-field.tsx
src/frontend/shared/ui/surface.tsx
src/frontend/shared/ui/empty-state.tsx
src/frontend/shared/ui/status-message.tsx
src/frontend/shared/ui/dialog.tsx
src/frontend/shared/ui/dialog.test.tsx
src/frontend/widgets/app-shell/app-shell.tsx
src/frontend/widgets/app-shell/app-shell.test.tsx
src/frontend/features/auth/logout-button.tsx
src/frontend/features/auth/auth-route-guard.tsx
src/frontend/pages/auth/google-auth-page.test.tsx
src/frontend/features/graph-editor/actions/add-node-dialog.tsx
src/frontend/features/graph-editor/actions/add-node-dialog.test.tsx
src/frontend/features/graph-editor/actions/relationship-dialog.tsx
src/frontend/features/graph-editor/actions/relationship-dialog.test.tsx
tests/e2e/product-ui-authoring.spec.ts
```

Modify:

```text
src/app/globals.css
src/app/layout.tsx
src/frontend/pages/home/home-page.tsx
src/frontend/pages/home/home-page.test.tsx
src/frontend/pages/auth/google-auth-page.tsx
src/frontend/features/auth/google-auth-button.tsx
src/frontend/features/auth/auth-forms.test.tsx
src/frontend/pages/dashboard/dashboard-page.tsx
src/frontend/pages/dashboard/dashboard-page.test.tsx
src/frontend/pages/story/story-boards-page.tsx
src/frontend/pages/story/story-boards-page.test.tsx
src/frontend/pages/graph-editor/graph-editor-page.tsx
src/frontend/pages/graph-editor/graph-editor-page.test.tsx
src/frontend/features/graph-editor/inspector/graph-inspector.tsx
src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx
src/frontend/widgets/graph-editor/graph-canvas.tsx
src/frontend/widgets/graph-editor/graph-canvas.test.tsx
tests/e2e/smoke.spec.ts
tests/e2e/auth-story.spec.ts
```

---

### Task 1: Establish durable design context and shared UI primitives

**Files:**
- Create: `DESIGN.md`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create/Test: `src/frontend/shared/ui/button.tsx`, `button.test.tsx`
- Create: `src/frontend/shared/ui/form-field.tsx`, `surface.tsx`, `empty-state.tsx`, `status-message.tsx`
- Create/Test: `src/frontend/shared/ui/dialog.tsx`, `dialog.test.tsx`

**Interfaces:**
- Produces `Button`, `TextField`, `TextAreaField`, `Surface`, `EmptyState`, `StatusMessage`, and `Dialog`.
- `Button` consumes native button props plus `emphasis: "solid" | "outline" | "ghost"` and `intent: "brand" | "neutral" | "danger"`.
- `Dialog` consumes `{open,title,description?,onClose,children}` and closes on Escape/backdrop while restoring trigger focus.

- [ ] **Step 1: Write failing primitive tests**

Add tests that require semantic buttons, stable disabled/busy behavior, visible text labels, dialog `role="dialog"`, `aria-modal="true"`, accessible title, Escape close, and focus restoration.

```tsx
render(<Button busy>저장</Button>);
expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();

const trigger = screen.getByRole("button", { name: "열기" });
await user.click(trigger);
expect(screen.getByRole("dialog", { name: "새 이야기" })).toBeVisible();
await user.keyboard("{Escape}");
expect(trigger).toHaveFocus();
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm test -- src/frontend/shared/ui/button.test.tsx src/frontend/shared/ui/dialog.test.tsx
```

Expected: imports fail because shared UI files do not exist.

- [ ] **Step 3: Add `DESIGN.md` and token adapter**

Document and map these base tokens exactly:

```css
:root {
  --sg-canvas: #f6f7f9;
  --sg-surface: #ffffff;
  --sg-ink: #17191d;
  --sg-muted: #69717d;
  --sg-line: #e3e6ea;
  --sg-brand: #595bd4;
  --sg-brand-strong: #484ac2;
  --sg-danger: #b42318;
  --sg-danger-soft: #fff1f0;
  --sg-success: #18794e;
  --sg-focus: #7778e8;
  --sg-radius-sm: 8px;
  --sg-radius-md: 12px;
  --sg-radius-lg: 18px;
}
```

Set system Korean-friendly sans stack, application scrollbar baseline, `:focus-visible`, `prefers-reduced-motion`, body canvas background, and `color-scheme: light`.

- [ ] **Step 4: Implement minimal shared primitives**

Use semantic native elements and plain React; do not add dependencies. `Dialog` uses native `<dialog>` with `showModal()`/`close()`, `cancel` handling, backdrop click detection, and captured trigger focus.

- [ ] **Step 5: GREEN verification**

```bash
pnpm test -- src/frontend/shared/ui/button.test.tsx src/frontend/shared/ui/dialog.test.tsx
pnpm typecheck
pnpm lint
```

- [ ] **Step 6: Commit**

```bash
git add DESIGN.md src/app/globals.css src/app/layout.tsx src/frontend/shared/ui
git commit -m "feat: add product ui foundation"
```

---

### Task 2: Build landing and authentication entry UX

**Files:**
- Modify/Test: `src/frontend/pages/home/home-page.tsx`, `home-page.test.tsx`
- Modify/Test: `src/frontend/features/auth/google-auth-button.tsx`, `auth-forms.test.tsx`
- Modify/Create Test: `src/frontend/pages/auth/google-auth-page.tsx`, `google-auth-page.test.tsx`
- Create: `src/frontend/features/auth/auth-route-guard.tsx`
- Modify: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Landing exposes links `로그인 → /login`, `시작하기 → /signup` and no bootstrap dependency.
- `AuthRouteGuard` uses existing `useBootstrapQuery`; authenticated success redirects to `/dashboard`, a 401 renders children, non-401 leaves actionable error UI.
- `GoogleAuthButton` keeps Better Auth `signIn.social({provider:"google", callbackURL:"/dashboard"})`.

- [ ] **Step 1: Write landing/auth RED tests**

```tsx
render(<HomePage />);
expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
expect(screen.getByRole("link", { name: "시작하기" })).toHaveAttribute("href", "/signup");
```

Auth tests require Korean labels and verify authenticated bootstrap calls `router.replace("/dashboard")`.

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- src/frontend/pages/home/home-page.test.tsx src/frontend/features/auth/auth-forms.test.tsx src/frontend/pages/auth/google-auth-page.test.tsx
```

- [ ] **Step 3: Implement focused landing**

Build a compact header, thesis hero, one graph-signature visual using semantic HTML/CSS (no canvas dependency), and only the two entry CTAs. Keep the page deterministic—do not call bootstrap/session APIs here.

- [ ] **Step 4: Implement auth surface and guard**

Use shared `Surface`/`Button` patterns; copy:
- login title `다시 만나서 반가워요`
- signup title `이야기를 연결해 보세요`
- action `Google로 계속하기`
- errors `Google 로그인을 시작하지 못했습니다. 다시 시도해 주세요.`

- [ ] **Step 5: Update smoke E2E**

Assert `/` renders the thesis plus both CTA links while retaining health API coverage.

- [ ] **Step 6: GREEN verification and commit**

```bash
pnpm test -- src/frontend/pages/home/home-page.test.tsx src/frontend/features/auth/auth-forms.test.tsx src/frontend/pages/auth/google-auth-page.test.tsx
pnpm exec playwright test tests/e2e/smoke.spec.ts
git add src/frontend/pages/home src/frontend/pages/auth src/frontend/features/auth tests/e2e/smoke.spec.ts
git commit -m "feat: add product entry experience"
```

---

### Task 3: Add authenticated AppShell, account area, and logout

**Files:**
- Create/Test: `src/frontend/widgets/app-shell/app-shell.tsx`, `app-shell.test.tsx`
- Create: `src/frontend/features/auth/logout-button.tsx`
- Modify/Test: `src/frontend/features/auth/auth-forms.test.tsx`

**Interfaces:**
- `AppShell({actor,title,description?,action?,children})` renders desktop sidebar and compact mobile header.
- `LogoutButton` calls `authClient.signOut()`, clears authenticated TanStack Query cache, then `router.replace("/")` and `router.refresh()`.
- Navigation exposes only `내 이야기 → /dashboard`.

- [ ] **Step 1: Write RED tests**

Require actor name, `/dashboard` nav, accessible mobile navigation trigger, and logout behavior.

```tsx
expect(screen.getByText("Writer")).toBeVisible();
await user.click(screen.getByRole("button", { name: "로그아웃" }));
await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
expect(mocks.replace).toHaveBeenCalledWith("/");
```

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- src/frontend/widgets/app-shell/app-shell.test.tsx src/frontend/features/auth/auth-forms.test.tsx
```

- [ ] **Step 3: Implement shell and logout**

Desktop sidebar width stays restrained (`220–240px`), content owns document scroll, and mobile uses a compact header + app-owned disclosure without dead navigation items.

- [ ] **Step 4: GREEN verification and commit**

```bash
pnpm test -- src/frontend/widgets/app-shell/app-shell.test.tsx src/frontend/features/auth/auth-forms.test.tsx
pnpm typecheck
git add src/frontend/widgets/app-shell src/frontend/features/auth
git commit -m "feat: add authenticated app shell"
```

---

### Task 4: Redesign Dashboard around Story creation/opening

**Files:**
- Modify/Test: `src/frontend/pages/dashboard/dashboard-page.tsx`, `dashboard-page.test.tsx`

**Interfaces:**
- Consumes `AppShell`, `Dialog`, shared fields/buttons, `useBootstrapQuery`, `useStoriesQuery`, `useCreateStoryMutation`.
- Successful create uses `const created = await createStory.mutateAsync(...)` then `router.push(`/stories/${created.id}`)`.

- [ ] **Step 1: Rewrite Dashboard tests to RED**

Require:
1. heading `내 이야기`,
2. existing Story card links to detail,
3. empty state shows `첫 이야기 만들기`,
4. `새 이야기` opens dialog,
5. required name prevents submit,
6. successful create navigates to returned Story ID,
7. list error offers retry,
8. 401 still redirects to `/login`.

```tsx
await user.click(screen.getByRole("button", { name: "새 이야기" }));
await user.type(screen.getByLabelText("이야기 이름"), "My First Story");
await user.click(screen.getByRole("button", { name: "이야기 만들기" }));
await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/stories/story-2"));
```

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- src/frontend/pages/dashboard/dashboard-page.test.tsx
```

- [ ] **Step 3: Implement Dashboard UI**

Remove persistent inline create form. Use story cards with only name/description and clear open affordance; do not invent board counts or timestamps. Use stable loading, actionable error, and directed empty state.

- [ ] **Step 4: GREEN verification and commit**

```bash
pnpm test -- src/frontend/pages/dashboard/dashboard-page.test.tsx
pnpm typecheck
git add src/frontend/pages/dashboard
git commit -m "feat: redesign story dashboard"
```

---

### Task 5: Redesign Story workspace with Boards first and Context secondary

**Files:**
- Modify/Test: `src/frontend/pages/story/story-boards-page.tsx`, `story-boards-page.test.tsx`

**Interfaces:**
- Consumes `AppShell`, shared dialog/form primitives, current Story/Scope/Board queries.
- Board create success immediately `router.push(`/stories/${storyId}/boards/${created.id}`)`.
- Scope create remains in a secondary `컨텍스트` management surface and does not navigate.

- [ ] **Step 1: Rewrite Story page tests to RED**

Require:
- Story title and board cards,
- primary `새 보드`,
- board create dialog with `보드 이름` + optional `컨텍스트`,
- create success navigation to editor,
- Board empty state primary CTA,
- existing Scope represented as `컨텍스트: Chapter 10`,
- secondary `컨텍스트 관리` create flow.

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- src/frontend/pages/story/story-boards-page.test.tsx
```

- [ ] **Step 3: Implement Boards-first hierarchy**

Move Scope creation out of the primary flow. Keep native `<select>` for optional Context because OS-owned selection behavior is acceptable for this simple V1 field.

- [ ] **Step 4: GREEN verification and commit**

```bash
pnpm test -- src/frontend/pages/story/story-boards-page.test.tsx
pnpm typecheck
git add src/frontend/pages/story
git commit -m "feat: redesign story workspace"
```

---

### Task 6: Replace Editor development forms with focused action surfaces

**Files:**
- Create/Test: `src/frontend/features/graph-editor/actions/add-node-dialog.tsx`, `add-node-dialog.test.tsx`
- Create/Test: `src/frontend/features/graph-editor/actions/relationship-dialog.tsx`, `relationship-dialog.test.tsx`
- Modify/Test: `src/frontend/pages/graph-editor/graph-editor-page.tsx`, `graph-editor-page.test.tsx`
- Modify: `src/frontend/features/graph-editor/inspector/graph-inspector.tsx`
- Modify/Test: `src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx`
- Modify/Test: `src/frontend/widgets/graph-editor/graph-canvas.tsx`, `graph-canvas.test.tsx`

**Interfaces:**
- `AddNodeDialog` receives `open`, `existingNodes`, `onCreate(name)`, `onPlace(nodeId)`, `onClose`, `busy`.
- `RelationshipDialog` receives pending source/target labels plus `onCreate(name)`/`onClose`.
- Existing page handlers continue dispatching `create-node`, `place-board-node`, and `create-edge` through history/Save Queue; dialogs never call persistence directly.

- [ ] **Step 1: Add action-surface RED tests**

```tsx
await user.click(screen.getByRole("button", { name: "노드 추가" }));
expect(screen.getByRole("dialog", { name: "노드 추가" })).toBeVisible();
expect(screen.queryByLabelText("Existing Node")).not.toBeInTheDocument();
```

Relationship cancel test must prove no `createEdgeOnBoard` call occurs after connecting and closing the dialog.

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- src/frontend/features/graph-editor/actions src/frontend/pages/graph-editor/graph-editor-page.test.tsx
```

- [ ] **Step 3: Implement Add Node dialog**

One dialog has two clearly separated choices: `새 노드 만들기` and `기존 노드 추가`. Preserve canvas-center placement and UUID generation in the page layer. Closing clears local action draft only.

- [ ] **Step 4: Implement Relationship dialog**

Opening is driven by `pendingConnection`; closing sets it to null and clears relationship name without dispatching any command.

- [ ] **Step 5: Refactor Editor shell**

Replace `grid-rows-[auto_auto_1fr]` plus persistent form strip with one compact top bar and dominant canvas/inspector grid. Translate save labels to `저장됨`, `저장 중…`, `저장되지 않음`, `저장 오류`; keep Retry action and all history blocking behavior unchanged.

- [ ] **Step 6: Restyle Inspector and Canvas**

Use shared field visual language, Korean labels, `resize-none`, inline validation/errors, and a visually separated `보드에서 제거` action. Canvas should use available viewport height with a sensible minimum rather than fixed `h-[560px]`, while preserving React Flow callbacks/topology.

- [ ] **Step 7: Run full editor regression slice**

```bash
pnpm test -- src/frontend/pages/graph-editor src/frontend/features/graph-editor src/frontend/widgets/graph-editor/graph-canvas.test.tsx
pnpm typecheck
```

- [ ] **Step 8: Commit**

```bash
git add src/frontend/features/graph-editor/actions src/frontend/features/graph-editor/inspector/graph-inspector.tsx src/frontend/pages/graph-editor src/frontend/widgets/graph-editor
git commit -m "feat: polish graph editor workflow"
```

---

### Task 7: Add product-level authoring E2E and final acceptance

**Files:**
- Create: `tests/e2e/product-ui-authoring.spec.ts`
- Modify as necessary: `tests/e2e/auth-story.spec.ts`, existing scoped E2E only for changed labels/selectors

**Interfaces:**
- Reuse `tests/e2e/helpers/e2e-auth.ts`; do not automate real Google OAuth.
- Acceptance covers authenticated product navigation, not hidden-route-only setup.

- [ ] **Step 1: Write Product UI E2E**

Use existing authenticated helper, then exercise visible UI:

```ts
await page.goto("/dashboard");
await page.getByRole("button", { name: "새 이야기" }).click();
await page.getByLabel("이야기 이름").fill("UI Acceptance Story");
await page.getByRole("button", { name: "이야기 만들기" }).click();
await expect(page).toHaveURL(/\/stories\/[0-9a-f-]+$/);

await page.getByRole("button", { name: "새 보드" }).click();
await page.getByLabel("보드 이름").fill("Main Board");
await page.getByRole("button", { name: "보드 만들기" }).click();
await expect(page).toHaveURL(/\/boards\/[0-9a-f-]+$/);
```

Continue with Node A/B create, connect, Relationship name, inspector edit, wait for `저장됨`, reload, and verify persisted effective values.

- [ ] **Step 2: Run targeted E2E and fix selector regressions**

```bash
pnpm exec playwright test tests/e2e/product-ui-authoring.spec.ts tests/e2e/scope-node-state.spec.ts tests/e2e/scope-edge-state.spec.ts
```

- [ ] **Step 3: Run full repository verification**

```bash
pnpm check
pnpm test:integration
pnpm build
git diff --exit-code
pnpm e2e
```

If Frontend Design Premium audit scripts are available in the execution environment, additionally run strict project audit and fix blocking findings. Independently inspect changed code for native `alert/confirm/prompt`, non-semantic click targets, hidden scrollbars, missing focus-visible, and screen-local duplicate primitives.

- [ ] **Step 4: Review narrow/reduced-motion/static states**

Verify at minimum:
- 390px-wide landing/auth/dashboard/story/editor shell does not trap navigation or primary actions,
- dialogs remain keyboard dismissible and labeled,
- loading/empty/error layouts retain stable controls,
- `prefers-reduced-motion` removes nonessential transitions,
- editor canvas remains primary and inspector usable.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e
git commit -m "test: cover product ui authoring flow"
```

- [ ] **Step 6: Open PR and require fresh exact-head CI before merge**

PR summary must reference the Product UI V1 spec/plan and explicitly list the acceptance path. Merge only after the PR head SHA has fresh green CI for migrations/check/integration/build/clean-tree/E2E and no unresolved review blockers.
