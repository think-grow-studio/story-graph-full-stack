# Product UI V1 Design

Status: Approved design for implementation planning
Date: 2026-08-31

## 1. Goal

Turn the existing Story Graph domain/editor V1 into a product that a first-time user can understand and use from `/` without knowing internal routes or domain implementation details.

The primary acceptance path is:

```text
/
→ sign in / get started
→ Google auth
→ dashboard
→ create/open Story
→ create/open Board
→ Graph Editor
→ create Node
→ create Relationship
→ edit
→ autosave
→ reload
→ persisted
```

This project is not a redesign of the graph domain or persistence architecture. Existing auth, Story, Board, Scope, Graph Editor, Save Queue, Undo/Redo, NodeState, and EdgeState behavior remains authoritative.

## 2. Product principles

1. **Easy before clever.** A first-time user should always know the next useful action.
2. **Graph is the product signature.** Visual identity comes from connected nodes/relationships, not decorative SaaS gradients or generic dashboard chrome.
3. **Progressive disclosure.** Internal concepts such as Scope are not placed at the same visual priority as Story and Board unless the workflow requires them.
4. **Board = working surface.** Story is the container; Board is the primary place where authoring happens.
5. **Quiet workspace.** The editor should maximize canvas focus and reduce persistent forms/toolbars.
6. **Consistent operations.** Create, cancel, retry, loading, empty, disabled, focus, and error states behave consistently across screens.
7. **Korean-first UI.** The current root locale is Korean. User-facing copy is primarily Korean, while domain implementation names remain unchanged.
8. **Accessibility baseline.** WCAG 2.2 AA target, semantic controls, visible focus, keyboard operability, reduced-motion support, and non-color-only state communication.

## 3. Visual direction — Focused Workspace

Chosen direction: a calm, bright authoring workspace with one restrained graph-inspired signature.

Rejected directions:

- Generic Notion clone: clear but too anonymous for Story Graph.
- Dark fantasy/game UI: memorable but visually heavy for long authoring sessions.
- Template-like cream/serif or neon SaaS treatment: not specific enough to the product.

### Palette

Normative seed tokens:

- Canvas: `#F6F7F9`
- Surface: `#FFFFFF`
- Ink: `#17191D`
- Muted: `#69717D`
- Line: `#E3E6EA`
- Graph Indigo: `#595BD4`

Graph Indigo is reserved for primary actions, selection, active navigation, and graph-related emphasis. Error/warning/success tones use semantic variants defined in `DESIGN.md` during implementation.

### Typography

Use the platform/system sans stack for Korean legibility and deployment simplicity. Identity comes from deliberate scale, weight, spacing, and graph-oriented metadata treatment rather than an external font dependency.

### Signature element

A small graph motif appears prominently on the landing experience and selectively in empty states. It must encode the real product concept — entities connected by directed relationships — and must not become recurring decorative noise.

## 4. Information architecture

### Public routes

```text
/
/login
/signup
```

### Authenticated routes

```text
/dashboard
/stories/:storyId
/stories/:storyId/boards/:boardId
```

The route structure stays unchanged unless an implementation detail requires a non-breaking redirect.

## 5. Landing experience

The current placeholder home becomes a real entry point.

### Logged-out state

Header:
- Story Graph identity
- `로그인`
- primary `시작하기`

Hero:
- concise product thesis explaining that story worlds are built from connected people, places, events, ideas, and relationships
- primary CTA to signup/login flow
- graph signature visual

Secondary content is intentionally minimal. V1 does not need pricing, testimonials, feature grids, or marketing-heavy sections.

### Logged-in state

If session/bootstrap information is cheaply available through the existing client boundary, replace the primary auth CTA with `Story Graph 열기` linking to `/dashboard`.

If session lookup would introduce avoidable loading/layout instability on the marketing page, keep deterministic logged-out CTAs and rely on auth-route/dashboard redirection behavior. This is a low-risk implementation choice and should prefer the simpler stable version.

## 6. Authentication screens

Existing Google OAuth remains the only V1 auth mechanism.

### Login / signup

Both routes use a shared auth surface with:
- Story Graph identity
- clear page title
- one primary Google action
- concise explanation
- login/signup cross-link
- stable pending button size
- inline actionable error

No email/password fields are introduced.

### Authenticated auth-route behavior

An already authenticated user visiting `/login` or `/signup` should be redirected to `/dashboard` if the existing bootstrap/session boundary supports this without duplicating backend auth logic in the UI.

## 7. Authenticated app shell

Introduce a shared workspace shell for Dashboard and Story-level screens.

Desktop structure:

```text
┌─────────────┬─────────────────────────────────┐
│ Brand       │ Page header / primary action    │
│             │                                 │
│ Stories     │ Page content                    │
│             │                                 │
│             │                                 │
│ Account     │                                 │
└─────────────┴─────────────────────────────────┘
```

Mobile:
- persistent full-width desktop sidebar is removed
- navigation remains reachable through a compact header/drawer pattern
- primary page action remains easy to find

V1 navigation only exposes real implemented destinations. Do not add dead links for AI, settings, templates, billing, collaboration, or search.

## 8. Dashboard

Dashboard's primary job is to create or open a Story.

### Header

- title: `내 이야기`
- concise supporting text
- primary action: `새 이야기`

### Story list

Replace the development-style inline form/list with a clear card/list surface.

Each Story item shows only available data:
- Story name
- optional description
- open affordance

Do not invent board counts, updated-at values, thumbnails, or collaborators unless the existing API already exposes them.

### Create Story

Use an app-owned create flow, preferably a compact dialog or clearly bounded form surface.

Fields:
- name: required
- description: optional if existing contract supports it

Success behavior:
- create the Story
- navigate directly to `/stories/:storyId` if the current mutation response contains the created ID
- if the existing mutation contract does not return a usable ID, keep the user on the dashboard, refresh the list, and clearly surface the new Story

The implementation plan must inspect the mutation contract before choosing the success destination.

### States

Dashboard explicitly handles:
- loading
- auth/session expiry → login
- empty Story list with a primary create invitation
- fetch failure with retry/recovery guidance
- create pending / create failure

## 9. Story workspace

The Story page's primary job is to create/open a Board. Scope becomes supporting configuration.

### Header

- back/navigation to Stories
- Story name
- optional description
- primary action: `새 보드`

### Boards first

Boards occupy the primary content section.

Each Board item shows:
- Board name
- contextual scope label only when a Scope is attached
- clear open affordance

Empty state:
- explain that a Board is the working view where nodes and relationships are arranged
- primary action to create the first Board

### Create Board

Use a bounded dialog/form rather than an always-visible development form.

Fields:
- Board name: required
- Context/Scope: optional

User-facing terminology:
- canonical code/domain remains `Scope`
- UI copy uses a plain-language label such as `컨텍스트` where it improves comprehension

### Scope management

Scope is visually secondary.

V1 keeps existing Scope creation functionality but moves it into a secondary section or management surface with explanatory copy such as:

> 같은 인물과 관계를 장/시점에 따라 다르게 보이게 할 때 컨텍스트를 사용합니다.

Do not add Scope hierarchy, deletion, live switching, or topology/existence state.

## 10. Graph Editor shell

Existing editor state/persistence behavior is preserved.

### Main layout

Desktop target:

```text
┌ Story / Board ───────── Save · Undo/Redo ─ + Node ┐
├───────────────────────────────┬────────────────────┤
│                               │ Inspector          │
│          Graph Canvas         │                    │
│                               │                    │
├───────────────────────────────┴────────────────────┤
```

The Graph canvas is the dominant visual surface.

A persistent left Node library is **not required for Product UI V1**. Existing-node placement can be exposed through the Add Node action/dialog, avoiding a broader editor-navigation redesign.

### Top bar

Must expose:
- navigation back to Story/Boards
- Story and Board identity
- optional current Scope/Context indicator
- save state (`저장됨`, `저장 중`, `저장되지 않음`, error)
- Undo / Redo
- primary `노드 추가`

### Add Node flow

Replace the separate always-visible `Add existing Node` select and `Create Node` inline form with one action surface.

The action surface supports:
- `새 노드 만들기`
- existing Story Node selection when available

The two operations remain backed by the existing `create-node` and `place-board-node` command paths.

### Relationship creation

When the user connects two nodes, request the Relationship name in a focused app-owned surface rather than inserting another persistent form row above the canvas.

Canceling relationship naming must cancel the pending relationship creation without writing durable state.

### Inspector

Keep the existing autosave model.

Inspector should:
- use the same field visual language as create flows
- keep validation and persistence errors inline
- preserve existing sparse NodeState/EdgeState behavior for scoped Boards
- clearly separate routine editing from `보드에서 제거` secondary/danger action

No canonical hard-delete operation is introduced.

## 11. Shared UI system

Implementation should create a small, reusable frontend UI layer rather than repeating long Tailwind class strings across pages.

Expected primitives/patterns:
- Button with emphasis + intent variants
- TextField / TextArea
- Select when native behavior is acceptable; otherwise a maintained authored Select only if visual/behavior requirements demand it
- Surface/Card
- EmptyState
- InlineError / StatusMessage
- Loading treatment
- Dialog if a maintained accessible dialog can be implemented without introducing a large unrelated dependency
- AppShell / PageHeader

Avoid a large general-purpose component library migration in V1.

## 12. Durable design context

The repository currently has no maintained `DESIGN.md`.

Implementation must add project-root `DESIGN.md` containing:
- visual principles
- normative palette/tokens
- typography
- spacing/radius/elevation guidance
- button/input/surface semantics
- graph-specific selection rules
- motion/reduced-motion rules
- responsive shell behavior
- scrollbar baseline

Runtime CSS variables in `src/app/globals.css` become the canonical token adapter for the documented colors and shared primitives.

A full `UX-CONTRACT.md` is not required for Product UI V1 because the product does not yet contain two mature list/detail CRUD systems or destructive data lifecycle workflows. Observable behavior is documented in this spec plus tests. If implementation expands beyond this scope, re-evaluate.

## 13. Interaction behavior

### Loading

Use stable loading regions/spinners or concise loading states. Do not make primary controls shift width while pending.

### Errors

Errors state what failed and what the user can do next.

Examples:
- `이야기를 불러오지 못했습니다. 다시 시도해 주세요.`
- Editor conflict messaging continues to explain that the resource changed elsewhere and reload is required.

### Empty states

Every empty state explains the object and exposes the next useful action.

### Focus and keyboard

- native `button`/`a` semantics
- visible `:focus-visible`
- modal/dialog focus handling when dialogs are introduced
- Escape closes dismissible dialogs
- Graph drag remains supplemented by existing non-drag editing where relevant; Product UI V1 does not redesign keyboard graph movement

### Motion

Use subtle entry/hover motion only where it improves orientation. Respect `prefers-reduced-motion`. No ambient particle or decorative motion system.

## 14. Copy rules

User-facing labels use plain language and consistent verbs.

Preferred vocabulary:
- Story → `이야기`
- Board → `보드`
- Node → `노드`
- Relationship → `관계`
- Scope → usually `컨텍스트` in UI explanatory copy

Developer/domain code retains existing English entity names.

Avoid exposing implementation language such as:
- canonical
- sparse override
- CAS
- BoardNode / EdgeState

unless needed in technical error/debug output unavailable to normal users.

## 15. Architecture constraints

Preserve all existing architecture invariants:
- frontend does not import backend/database implementation
- API contract boundary remains unchanged unless a UI flow genuinely needs a contract change
- Zustand remains Graph Editor working state
- React Flow remains rendering/input engine
- Save Queue remains durable write coordinator
- existing Node/Edge/NodeState/EdgeState command and history semantics remain unchanged
- Board remains presentation state; Scope remains state boundary

UI refactoring must not mutate canonical graph semantics for convenience.

## 16. Testing and verification

### Unit/component tests

Add or update tests for:
- landing CTA navigation
- auth pending/error states
- dashboard empty/list/create states
- Story Board/Scope empty/create states
- Add Node action surface
- Relationship naming/cancel flow
- accessible labels and disabled/busy states for shared controls

### Existing domain/editor tests

All existing unit and PostgreSQL integration tests must continue to pass.

### E2E acceptance

Add or update a critical Product UI E2E path that verifies, using the existing auth test strategy:

```text
entry/authenticated start
→ dashboard
→ create Story
→ create Board
→ open editor
→ create Node A
→ create Node B
→ connect A → B
→ name Relationship
→ edit Node/Relationship
→ wait for Saved
→ reload
→ verify persisted effective values
```

Where Google OAuth cannot be exercised deterministically in CI, use the repository's existing authenticated test/bootstrap mechanism rather than mocking product behavior at the page component layer.

Also retain critical scoped NodeState/EdgeState E2E coverage.

### Required verification before merge

- agent-file validation
- import-boundary validation
- ESLint
- TypeScript
- unit tests
- PostgreSQL integration tests
- production build
- Playwright critical E2E
- clean-tree check where CI already enforces it
- Frontend Design Premium static audit if runnable in the available environment
- manual/static review for keyboard focus, narrow viewport, empty/error/loading, and reduced-motion behavior

## 17. Scope exclusions

Product UI V1 does not include:
- AI Reasoning UI
- realtime collaboration
- billing/pricing
- team/member management
- templates
- search/command palette
- Story/Board deletion
- Scope deletion/hierarchy/live switching
- relationship topology/existence state
- persistent Undo/Redo history
- dark mode
- full design-system package migration
- custom icon library requirement

## 18. Definition of done

Product UI V1 is complete only when:

1. `/` is a meaningful product entry point.
2. Login/signup screens are usable and visually coherent.
3. Dashboard makes Story creation/opening obvious.
4. Story page makes Board creation/opening the primary workflow and Scope secondary.
5. Editor removes development-style persistent creation forms and makes the canvas the dominant surface.
6. A shared visual system and `DESIGN.md` prevent screen-by-screen styling drift.
7. The end-to-end authoring path can be completed without manually typing hidden routes.
8. Existing Graph Editor persistence/state invariants remain passing.
9. CI and critical E2E are green before merge.
