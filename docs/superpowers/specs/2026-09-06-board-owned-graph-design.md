# Board-Owned Graph Architecture Design

Date: 2026-09-06
Status: Final design draft for user review

## 1. Goal

Story Graph의 사용자 개념을 다음 하나의 단순한 계층으로 고정한다.

```text
Workspace
└── Story
    └── Board
        ├── Tag[]
        ├── Node[]
        └── Edge[]
```

- **Story**는 `홍길동전`처럼 하나의 작품/프로젝트 단위다.
- **Board**는 Story 안에서 독립적으로 작업하는 그래프 한 장이다.
- **Node/Edge는 Board가 직접 소유한다.** 다른 Board와 공유하지 않는다.
- **Tag는 Board에 붙는 단순한 분류 라벨**이다. 별도 Tag 도메인/계층/관리 화면을 만들지 않는다.

이 문서는 기존의 `Story owns Node/Edge`, `Board = View`, `Scope = State` 설계를 Graph 소유권과 상태 모델에 한해 대체한다. 인증, Workspace, Story 모듈과 frontend↔backend HTTP 경계는 그대로 유지한다.

## 2. Why Change

현재 구현은 한 Node/Edge 원본을 Story가 소유하고 여러 Board가 `board_node`/`board_edge`로 표현하며, Scope에 따라 `node_state`/`edge_state`를 덮어쓰는 모델이다.

이 모델은 같은 엔티티를 여러 시점/Board에서 재사용하기에는 강력하지만, 사용자가 다음 개념을 구분해야 한다.

- Story의 원본 Node/Edge
- Board에 놓인 Node/Edge 표현
- Scope
- NodeState / EdgeState

현재 제품 목표에는 이 추상화 비용이 필요하지 않다. Board끼리 독립적이어도 충분하며, 같은 이름의 Node가 여러 Board에 중복되는 것을 허용하는 편이 사용자와 구현 모두 단순하다.

## 3. Considered Approaches

### A. 기존 모델을 유지하고 UI만 단순화

기존 Scope/State/Board presentation을 숨기고 내부적으로 유지한다.

- 장점: 현재 코드 변경량이 작다.
- 단점: 사용하지 않는 복잡성이 DB/API/Undo/Redo에 계속 남고, 이후 기능 개발이 계속 옛 소유권 모델에 묶인다.

**Reject.** 배포 전 리셋 기회를 낭비한다.

### B. Legacy 모델과 Board-owned 모델을 병행

신규 Board부터 Board-owned로 만들고 기존 데이터는 legacy로 유지한다.

- 장점: 배포 후 마이그레이션이라면 안전하다.
- 단점: 저장소, contract, editor가 두 모델을 동시에 알아야 한다.

**Reject.** 현재는 배포 전이고 호환할 실사용 데이터가 없다.

### C. Board-owned 모델로 clean reset — Selected

Scope/State/presentation join 모델을 제거하고 Node/Edge의 내용과 표현을 Board child row 하나에 합친다.

- 장점: 제품 개념과 DB/API가 1:1로 맞는다.
- 장점: Board 격리가 구조적으로 보장된다.
- 장점: 이후 기능과 테스트가 크게 단순해진다.
- 비용: 기존 Graph 개발 DB 데이터는 버린다.

**Selected.**

## 4. Domain Invariants

### 4.1 Hierarchy

1. Workspace owns Story.
2. Story owns Board.
3. Board owns Node and Edge.
4. Board owns its tag labels.

### 4.2 Board isolation

- Node는 정확히 하나의 `boardId`를 가진다.
- Edge는 정확히 하나의 `boardId`를 가진다.
- Edge의 source/target Node는 반드시 Edge와 같은 Board에 속해야 한다.
- Board A의 Node/Edge 수정/삭제는 Board B에 영향을 주지 않는다.
- 같은 Story의 서로 다른 Board에 이름이 같은 Node가 있어도 서로 다른 엔티티다.

### 4.3 No Scope/State

다음을 완전히 제거한다.

- `Scope`
- `NodeState`
- `EdgeState`
- `BoardNode`
- `BoardEdge`

챕터, 시점, 세력도처럼 다른 관점이 필요하면 별도의 Board를 만들거나 Board에 Tag를 붙인다.

## 5. Data Model

### `story`

기존 모델을 유지한다.

```text
story
- id PK
- workspace_id FK -> organization
- name
- description
- created_at
- updated_at
```

### `board`

```text
board
- id PK
- story_id FK -> story ON DELETE CASCADE
- name
- description
- revision
- created_at
- updated_at
```

`revision`은 사용자 개념이 아니라 editor concurrency/save-queue 안정성을 위한 내부 필드로 유지한다.

`scope_id`는 제거한다.

### `board_tag`

Tag master table을 만들지 않는다. Tag는 Board의 child value다.

```text
board_tag
- board_id FK -> board ON DELETE CASCADE
- name
- created_at
PK (board_id, name)
INDEX (name)
```

규칙:

- 이름은 trim 후 1~50자.
- UI에서 `#`를 붙여 표시하지만 DB에는 `#` 없이 저장한다.
- 한 Board 안의 동일 문자열 Tag는 하나만 존재한다.
- 대소문자는 그대로 보존하며 V1에서는 별도 전역 canonicalization을 하지 않는다.
- 같은 문자열 Tag가 여러 Board에 있어도 공유 객체가 아니라 각각의 Board label이다.

### `graph_node`

기존 `graph_node` + `board_node`를 하나로 합친다.

```text
graph_node
- id PK
- board_id FK -> board ON DELETE CASCADE
- name
- description
- icon_key nullable
- properties jsonb
- x
- y
- width nullable
- height nullable
- z_index
- style jsonb
- version
- created_at
- updated_at
UNIQUE (id, board_id)
INDEX (board_id)
```

`story_id`는 제거한다. Story는 `node -> board -> story`로 결정한다.

### `graph_edge`

기존 `graph_edge` + `board_edge`를 하나로 합친다.

```text
graph_edge
- id PK
- board_id FK -> board ON DELETE CASCADE
- source_node_id
- target_node_id
- name
- description
- icon_key nullable
- properties jsonb
- style jsonb
- label_presentation jsonb
- version
- created_at
- updated_at
UNIQUE (id, board_id)
INDEX (board_id)
```

DB composite FK로 다음을 보장한다.

```text
(source_node_id, board_id) -> graph_node(id, board_id)
(target_node_id, board_id) -> graph_node(id, board_id)
```

따라서 cross-board Edge는 application validation뿐 아니라 DB에서도 불가능하다.

Node 삭제 시 incident Edge는 함께 삭제한다.

## 6. API / Contract Shape

기존 frontend↔backend HTTP boundary와 Zod contract 정책은 유지한다.

### Story / Board

```text
GET  /api/v1/stories/:storyId/boards
POST /api/v1/stories/:storyId/boards
PATCH /api/v1/boards/:boardId
GET  /api/v1/boards/:boardId/snapshot
```

`BoardResponse`는 `scopeId` 대신 `tags: string[]`를 포함한다.

Board 생성 입력:

```ts
{
  workspaceId: string;
  name: string;
  description?: string;
  tags?: string[];
}
```

Board 수정은 V1에서 `name`, `description`, `tags`를 갱신할 수 있다. Tag 전용 global API는 만들지 않는다.

### Nodes

```text
POST   /api/v1/boards/:boardId/nodes
PATCH  /api/v1/boards/:boardId/nodes/:nodeId
DELETE /api/v1/boards/:boardId/nodes/:nodeId
```

Create/Update payload에 semantic fields와 presentation fields가 함께 존재한다. `placeBoardNode`, `updateBoardNode`, Story-level Node API는 제거한다.

### Edges

```text
POST   /api/v1/boards/:boardId/edges
PATCH  /api/v1/boards/:boardId/edges/:edgeId
DELETE /api/v1/boards/:boardId/edges/:edgeId
```

Story-level/generic Edge API와 BoardEdge presentation API는 제거한다.

### Snapshot

새 snapshot은 다음처럼 단순화한다.

```ts
{
  story: { id: string; name: string };
  board: BoardResponse;
  nodes: GraphNodeResponse[];
  edges: GraphEdgeResponse[];
}
```

다음 필드는 더 이상 없다.

- `scope`
- `nodeStates`
- `edgeStates`
- `boardNodes`
- `boardEdges`

### Removed routes

- Story-level Nodes
- Scope CRUD/list
- Scope NodeState / EdgeState
- Board node placement-only endpoints
- Board edge presentation-only endpoints

정확한 route 파일 삭제/통합 목록은 implementation plan에서 현재 tree를 기준으로 확정한다.

## 7. Graph Repository / Application Layer

`GraphRepository`는 Board-owned aggregate를 직접 다룬다.

핵심 인터페이스 방향:

```text
createBoard / updateBoard / listBoards / findBoard
getBoardSnapshot
createNode / updateNode / deleteNode / restoreNode
createEdge / updateEdge / deleteEdge / restoreEdge
```

다음 responsibility는 제거한다.

```text
createScope
listScopes
findScope
listNodes(storyId)
placeNodeOnBoard
putNodeState
putEdgeState
updateBoardNode
removeNodeFromBoard
removeEdgeFromBoard
BoardNode/BoardEdge-specific persistence
```

Authorization은 기존과 동일하게 use-case boundary에서 수행한다. Node/Edge 작업은 `board -> story -> workspace` ownership chain을 검증한다.

외부 사용자가 존재 여부를 추측하지 못하도록 기존 hidden-404 정책을 유지한다.

## 8. Editor Persistence

기존 editor에서 가치 있는 내부 구조는 유지한다.

- Zustand working state
- React Flow는 rendering/input adapter
- draft -> debounce -> command -> Save Queue
- node/edge lane serialization
- optimistic version conflict handling
- session-local Undo/Redo
- reload persistence

단, effective/canonical/state 합성 단계는 제거한다.

### Direct state

Canvas와 Inspector는 snapshot의 Node/Edge를 그대로 편집한다.

```text
before: canonical Node + NodeState + BoardNode -> effective node
now:    GraphNode -> rendered node
```

```text
before: canonical Edge + EdgeState + BoardEdge -> effective edge
now:    GraphEdge -> rendered edge
```

### Delete / Undo semantics

기존에는 Board에서 Node를 제거해도 Story canonical Node가 남았다. 새 모델에서는 Board에서 Node를 삭제하면 **실제 Node row를 삭제**하며 incident Edge도 삭제된다.

Undo를 위해 frontend history command는 삭제 직전 Node와 incident Edge의 전체 snapshot을 보관하고 restore use-case가 같은 id로 엔티티를 재생성한다.

- Undo/Redo UX는 유지한다.
- 삭제된 엔티티를 다른 Board에서 복원/공유하지 않는다.
- persistent history는 추가하지 않는다.

## 9. Story Boards UX

Story는 작품/프로젝트이고, Story page는 Board 관리 화면이다.

### Board create

기존 `Context` 선택을 완전히 제거한다.

최소 입력:

- Board name
- optional description
- optional tags

Board 생성 후 바로 Graph Editor로 이동한다.

### Board list

각 Board card에 Tag를 표시한다.

```text
전체 인물 관계도
#인물 #전체
```

현재 Story의 Board 응답에서 Tag 문자열 union을 만들고 filter chip으로 사용한다. V1에서는 Board 수가 적다는 전제로 **client-side filtering**을 사용하고 별도 tag search API를 만들지 않는다.

Board의 Tag는 Board metadata edit에서 추가/삭제한다. 별도의 “태그 관리” 화면은 만들지 않는다.

## 10. Migration Strategy

아직 배포되지 않았고 보존해야 할 Graph 사용자 데이터가 없으므로 compatibility migration을 만들지 않는다.

### Selected strategy: clean graph migration baseline

- auth/workspace migration은 유지한다.
- Story foundation migration은 유지한다.
- 기존 Graph/Scope/EdgeState migration들을 Board-owned graph baseline으로 squash/regenerate한다.
- Drizzle journal/snapshot metadata를 새 schema와 일치시킨다.
- 기존 local development DB는 graph data migration을 시도하지 않고 reset한다.

개발 환경 안내에 local volume reset 절차를 명시한다.

이 결정은 **production migration 전략이 아니다**. 첫 배포 전이라는 전제에서만 허용한다.

## 11. Error / Concurrency Rules

- 존재하지 않거나 접근 권한이 없는 Board/Node/Edge: 기존 hidden 404 정책.
- Node/Edge stale version write: 409 conflict.
- 다른 Board의 Node를 source/target으로 Edge 생성: validation failure; DB composite FK도 최종 방어선.
- 빈/중복 Tag: request normalization 후 validation 또는 dedupe.
- Save Queue에서 conflict가 발생하면 현재 editor recovery/reload 패턴을 유지한다.

`board.revision`과 Node/Edge `version`의 구체적인 mutation 책임은 implementation plan에서 기존 CAS tests를 기준으로 최소 변경으로 정한다. 사용자에게 노출되는 개념은 아니다.

## 12. Test Strategy

### Schema / repository integration

- Node가 Board에 직접 속한다.
- Edge endpoints는 같은 Board Node만 참조 가능하다.
- Board 삭제가 Node/Edge/Tag를 cascade한다.
- Node 삭제가 incident Edge를 cascade한다.
- 같은 Story의 Board A/B에 동일 이름 Node를 만들어도 서로 독립이다.
- Tag가 `(boardId, name)` 기준으로 격리된다.

### Application / API

- Story Board list/create/update returns tags.
- Scope/State endpoints가 사라진다.
- Node/Edge CRUD가 Board boundary를 검증한다.
- stale version은 409를 유지한다.
- snapshot은 board/nodes/edges만 반환한다.

### Frontend

- Story page에서 Context UI가 완전히 사라진다.
- Board tags가 표시되고 현재 Story 안에서 filtering 된다.
- editor는 effective Node/Edge layer 없이 direct values를 렌더링한다.
- Node/Edge autosave, move, edit, delete, Undo, Redo가 유지된다.

### E2E acceptance

1. Story 생성.
2. Board A 생성 + tags 지정.
3. Board A에서 Node/Edge 작성 후 reload해 persistence 확인.
4. Board B 생성.
5. Board B에 Board A와 같은 이름의 Node 생성.
6. Board B 수정이 Board A에 영향을 주지 않음을 확인.
7. Story page에서 Tag filter로 Board 목록을 좁힘.
8. Node 삭제 -> incident Edge 삭제 -> Undo 복원 -> reload persistence 확인.

## 13. Documentation Changes

구현과 함께 다음 문서/규칙을 새 architecture에 맞춘다.

- root `AGENTS.md`
- `src/backend/AGENTS.md`
- `src/frontend/features/graph-editor/AGENTS.md`
- root `DESIGN.md`의 Scope 언급 제거
- 기존 Scope/NodeState/EdgeState 설계 문서는 historical record로 남기되, 이 문서가 graph ownership/state semantics에 대해 우선한다.

## 14. Explicitly Out of Scope

- Node/Edge를 여러 Board에서 공유 또는 동기화
- Board 간 링크
- Scope / NodeState / EdgeState
- Tag hierarchy
- Workspace-global Tag master
- Tag management screen
- realtime / CRDT
- persistent Undo history
- 기존 pre-release Graph 데이터 보존 migration
- AI / collaboration / billing

## 15. Success Criteria

사용자가 제품을 이해하기 위해 알아야 하는 Graph 개념은 다음뿐이다.

```text
Story = 작품/프로젝트
Board = 독립 그래프 한 장
Node / Edge = 그 Board의 내용
Tag = Board에 붙이는 분류 스티커
```

그리고 코드/DB/API 역시 같은 구조를 그대로 표현해야 한다. 구현 내부의 save queue, CAS, Undo/Redo는 견고함을 위한 기술 요소일 뿐 새로운 사용자 도메인 개념을 만들지 않는다.
