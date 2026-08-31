# Story Graph Design

## Product character

Story Graph is a calm authoring workspace for understanding a story world through connected entities and relationships. The UI should feel precise, quiet, and durable during long writing sessions. The graph is the visual signature; surrounding chrome stays restrained.

## Principles

- Easy before clever: the next useful action is always visible.
- Graph first: use connection/node motifs only where they explain the product.
- Quiet workspace: content and canvas dominate over navigation chrome.
- Progressive disclosure: advanced concepts such as Scope appear as contextual configuration, not primary navigation.
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
- Danger `--sg-danger`: `#B42318`
- Danger soft `--sg-danger-soft`: `#FFF1F0`
- Success `--sg-success`: `#18794E`
- Focus `--sg-focus`: `#7778E8`

Graph Indigo is reserved for primary actions, current selection, active navigation, and graph-related emphasis. It is not a decorative page wash.

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

Canvas is the dominant surface. Top-bar chrome is compact. Selected graph items and primary graph actions may use Graph Indigo. Node/relationship creation appears in focused action surfaces instead of persistent development forms. Inspector uses the same field language as the rest of the product.

## Motion

Use motion only to clarify orientation or state. Hover/entry transitions should be short and subtle. `prefers-reduced-motion: reduce` disables nonessential animation and smooth scrolling.

## Scrollbars

Application-owned scrolling surfaces inherit one visible scrollbar baseline from `globals.css`. Scrollbars are never hidden for aesthetics. Geometry exceptions may opt into stable gutters where needed.

## Responsive baseline

Product flows remain usable at 390px width. Primary actions stay reachable, dialogs fit the viewport, and navigation does not depend on hover. The graph editor may become vertically stacked on narrow screens, but graph controls and Inspector remain reachable.
