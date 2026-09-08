# Story Graph Design

## Product character

Story Graph is a calm authoring workspace for understanding a story world through connected entities and relationships. The UI should feel precise, quiet, and durable during long writing sessions. The graph is the visual signature; surrounding chrome stays restrained.

## Principles

- Easy before clever: the next useful action is always visible.
- Graph first: use connection/node motifs only where they explain the product.
- Quiet workspace: content and canvas dominate over navigation chrome.
- Board-first simplicity: alternate views are expressed as independent Boards and Board tags, not Scope/State configuration.
- Consistent operations: create, cancel, retry, loading, empty, error, and disabled states use the same visual and behavioral language.
- Korean-first: interface copy is Korean-first while implementation/domain identifiers remain English.
- Accessible by default: WCAG 2.2 AA target, semantic controls, visible focus, keyboard access, reduced motion.

## Runtime token ownership

`src/app/globals.css` is the runtime adapter for the normative values below. Shared UI primitives consume these CSS variables; screens should not copy hex values directly.

### Color

- Canvas `--sg-canvas`: `#F6F7F9`
- Surface `--sg-surface`: `#FFFFFF`
- Ink `--sg-ink`: `#17191D`
- Muted `--sg-muted`: `#69717D`
- Line `--sg-line`: `#E3E6EA`
- Graph Indigo `--sg-brand`: `#595BD4`
- Graph Indigo strong `--sg-brand-strong`: `#484AC2`
- Graph target soft `--sg-graph-target-soft`: a 10% Graph Indigo tint over Surface
- Danger `--sg-danger`: `#B42318`
- Danger soft `--sg-danger-soft`: `#FFF1F0`
- Success `--sg-success`: `#18794E`
- Focus `--sg-focus`: `#7778E8`

Graph Indigo is reserved for primary actions, current selection, active navigation, and graph-related emphasis. It is not a decorative page wash. The graph target soft token is reserved for temporary connection-target affordance and must not become a persisted presentation value.

### Typography

Use a Korean-friendly system sans stack. The interface relies on weight, scale, and spacing rather than an external display font. Body text is compact and readable; page titles use strong weight without oversized marketing-dashboard typography.

### Radius and elevation

- Small controls: `--sg-radius-sm` = `8px`
- Cards/forms: `--sg-radius-md` = `12px`
- Large dialogs/hero surfaces: `--sg-radius-lg` = `18px`
- Prefer borders and subtle tonal separation over large shadows. Dialogs may use a restrained elevation shadow.

### Spacing

Use a 4px base rhythm. Common gaps are 8, 12, 16, 24, 32, and 48px. Dense editor controls may use 8–12px; page sections use 24–32px.

## Components

### Buttons

Buttons have two axes:
- emphasis: solid, outline, ghost
- intent: brand, neutral, danger

Primary page actions use solid brand. Routine secondary actions use outline/ghost neutral. Destructive board-removal actions use danger and stay visually separated from routine editing.

Busy buttons preserve their dimensions and accessible label, become disabled, and expose `aria-busy`.

### Fields

Every field has a visible label unless an equivalent accessible name is intentionally supplied. Help/error copy stays associated through `aria-describedby`; invalid fields use `aria-invalid`. Textareas do not expose arbitrary resize handles.

### Surfaces

Cards and panels use white surface, line border, restrained radius, and no decorative gradients. Empty states explain the object and provide the next useful action.

### Dialogs

Product dialogs are app-owned modal surfaces with accessible title/description, Escape close, backdrop close when dismissal is safe, focus containment through the platform dialog primitive, and focus restoration to the trigger.

## App shell

Desktop uses a restrained 220–240px sidebar and a fluid content area. Mobile replaces the persistent sidebar with a compact header/navigation disclosure. Do not add navigation for features that are not implemented.

## Graph editor

Canvas is the dominant surface and the Inspector is secondary. Top-bar chrome stays compact; Node and Relationship creation use focused action surfaces instead of permanent development forms. On narrow screens the editor may stack vertically, but the Inspector and graph controls must remain reachable without hover-only interaction.

### Magnetic Ports

Every Node exposes stable `top`, `right`, `bottom`, and `left` loose-connection ports. The interactive hit area is intentionally larger than the visible dot so connections are forgiving. Ports become fully visible for selected Nodes and while a connection gesture is active; keyboard focus must also reveal the affordance. Drag connection is never the only path: the selected-Node `관계 만들기` target-pick flow provides a click/keyboard alternative.

### Selection and focus

Selected Nodes use a Graph Indigo border plus a structural ring so selection is not encoded by color alone. During a connection gesture, potential target Nodes use the graph-target soft tint and visible ports. Selecting a Node emphasizes its connected subgraph and dims unrelated Nodes/Relationships; selecting a Relationship emphasizes its endpoints and keeps same-bundle sibling Relationships as secondary context. Selected Relationships use stronger stroke width in addition to color. Clicking the empty canvas or pressing Escape when no modal workflow owns Escape clears graph focus.

### Relationship routing and bundles

Orthogonal routing is the creation default. Straight and curved routing are explicit per-Relationship choices and persist on that Relationship; changing the Board default does not silently rewrite existing Relationships. Multiple semantic Relationships between the same unordered Node pair remain independent records and render in deterministic separate lanes. Opposite directed meanings never overwrite each other.

### Semantic data versus presentation

Node/Relationship `properties` are semantic user data with string scalar leaves and structured object/array nesting. Presentation (`NodePresentation`, `EdgePresentation`) and Relationship routing (`EdgeRouting`) are persisted separately from semantic properties. Bundle expansion, focus/dimming, port hover, selected state, and target-pick state are transient frontend projections and must never enter persisted graph data. The Inspector edits properties through structured key/value controls; raw JSON editing is not part of the product UI.

Inspector fields follow the same labels, validation, save/error, and keyboard language as the rest of Story Graph. Autosave, Undo/Redo, and CAS conflict handling remain behaviorally independent from visual focus state.

## Motion

Use motion only to clarify orientation or state. Hover/entry transitions should be short and subtle. `prefers-reduced-motion: reduce` disables nonessential animation and smooth scrolling.

## Scrollbars

Application-owned scrolling surfaces inherit one visible scrollbar baseline from `globals.css`. Scrollbars are never hidden for aesthetics. Geometry exceptions may opt into stable gutters where needed.

## Responsive baseline

Product flows remain usable at 390px width. Primary actions stay reachable, dialogs fit the viewport, and navigation does not depend on hover. The graph editor may become vertically stacked on narrow screens, but graph controls and Inspector remain reachable.
