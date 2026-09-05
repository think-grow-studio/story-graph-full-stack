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

현재 제품 목표에는 이 추상화 비용이 필요하지 않다. 사용자가 Story 원본, Board 표현, Scope, NodeState, EdgeState를 구분하는 대신 Board 한 장 안에서 직접 Node/Edge를 만들고 수정하면 된다.

같은 이름의 Node가 여러 Board에 중복되는 것은 허용한다. 두 Node는 서로 다른 엔티티이며 어느 한 Board의 변경도 다른 Board에 영향을 주지 않는다.

## 3. Considered Approaches

### A. 기존 모델을 유지하고 UI만 단순화

- 장점: 현재 코드 변경량이 작다.
- 단점: 쓰지 않는 Scope/State/presentation 복잡성이 DB/API/Undo/Redo에 계속 남는다.

**Reject.** 배포 전 리셋 기회를 낭비한다.

### B. Legacy 모델과 Board-owned 모델을 병행

- 장점: 배포 후 데이터 호환이 필요하다면 안전하다.
- 단점: repository, contract, editor가 두 모델을 동시에 알아야 한다.

**Reject.** 현재는 배포 전이고 보존할 실사용 Graph 데이터가 없다.

### C. Board-owned 모델로 clean reset — Selected

Scope/State/presentation join 모델을 제거하고 Node/Edge의 내용과 표현을 Board child row 하나에 합친다.

- 제품 개념과 DB/API가 1:1로 맞는다.
- Board 격리가 구조적으로 보장된다.
- 저장/테스트 경로가 단순해진다.
- 기존 개발 DB의 Graph 데이터는 버린다.

**Selected.**

## 4. Domain Invariants

1. Workspace owns Story.
2. Story owns Board.
3. Board owns Node and Edge.
4. Board owns its Tag labels.
5. Node와 Edge는 정확히 하나의 Board에만 속한다.
6. Edge의 source/target Node는 반드시 Edge와 같은 Board에 속한다.
7. Board A의 Node/Edge 수정/삭제는 Board B에 영향을 주지 않는다.
8. 같은 Story의 서로 다른 Board에 이름이 같은 Node가 있어도 서로 다른 엔티티다.

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
- created_at
- updated_at
```

기존 `scope_id`와 `revision`은 제거한다.

`revision`은 현재 구조에서 Board membership/presentation 변경 횟수로 사용되지만 request CAS에 사용되지 않는다. 새 모델에서는 membership/presentation이 Node/Edge 자체로 합쳐지고 Node/Edge `version`이 실제 write conflict를 담당하므로 Board revision을 유지하지 않는다.

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

- API 값은 `#` 없는 이름이다.
- 이름은 trim 후 1~50자다.
- 한 Board 요청 안에서 trim 후 중복된 Tag 이름은 validation error다.
- UI는 입력 시 선행 `#` 하나를 제거하고 API에는 이름만 전송한다.
- 표시할 때 UI가 `#`를 붙인다.
- 대소문자는 그대로 보존한다.
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
- version default 1
- created_at
- updated_at
UNIQUE (id, board_id)
INDEX (board_id)
```

`story_id`는 제거한다. Story는 `node -> board -> story`로 결정한다.

Node의 semantic field와 position/presentation field를 PATCH할 때마다 같은 `version`을 CAS로 사용하고 성공 시 1 증가시킨다.

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
- version default 1
- created_at
- updated_at
UNIQUE (id, board_id)
INDEX (board_id)
```

DB composite FK로 다음을 보장한다.

```text
(source_node_id, board_id) -> graph_node(id, board_id) ON DELETE CASCADE
(target_node_id, board_id) -> graph_node(id, board_id) ON DELETE CASCADE
```

따라서 cross-board Edge는 application validation뿐 아니라 DB에서도 불가능하다. Edge의 semantic/presentation PATCH도 같은 `version` CAS를 사용한다.

Node 삭제 시 incident Edge는 함께 삭제한다.

## 6. API / Contract Shape

기존 frontend↔backend HTTP boundary와 Zod contract 정책은 유지한다.

### Story / Board

```text
GET   /api/v1/stories/:storyId/boards
POST  /api/v1/stories/:storyId/boards
PATCH /api/v1/boards/:boardId
GET   /api/v1/boards/:boardId/snapshot
```

`BoardResponse`는 `scopeId`/`revision` 대신 `tags: string[]`를 포함한다.

Board 생성 입력:

```ts
{
  workspaceId: string;
  name: string;
  description?: string;
  tags?: string[];
}
```

`PATCH /boards/:boardId`는 `name`, `description`, `tags` 중 하나 이상을 받는다. `tags`가 있으면 해당 Board의 Tag 전체 집합을 transaction 안에서 교체한다. Tag 전용 global API는 만들지 않는다.

### Nodes

```text
POST   /api/v1/boards/:boardId/nodes
PATCH  /api/v1/boards/:boardId/nodes/:nodeId
DELETE /api/v1/boards/:boardId/nodes/:nodeId
POST   /api/v1/boards/:boardId/nodes/:nodeId/restore
```

- Create/Update payload에 semantic fields와 presentation fields가 함께 존재한다.
- Create는 client-generated UUID를 받는다. 기존 command idempotency와 Undo restore에서 같은 identity를 유지하기 위함이다.
- PATCH는 `expectedVersion`을 요구한다.
- restore는 삭제 직전 Node와 incident Edge snapshot을 받아 하나의 transaction으로 같은 UUID들을 복원한다.
- `placeBoardNode`, `updateBoardNode`, Story-level Node API는 제거한다.

### Edges

```text
POST   /api/v1/boards/:boardId/edges
PATCH  /api/v1/boards/:boardId/edges/:edgeId
DELETE /api/v1/boards/:boardId/edges/:edgeId
POST   /api/v1/boards/:boardId/edges/:edgeId/restore
```

- Create는 client-generated UUID를 받는다.
- PATCH는 `expectedVersion`을 요구한다.
- Edge restore는 삭제 직전 Edge 전체 snapshot을 같은 UUID로 복원한다.
- Story-level/generic Edge API와 BoardEdge presentation API는 제거한다.

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

## 7. Graph Repository / Application Layer

`GraphRepository`는 Board-owned aggregate를 직접 다룬다.

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

Authorization은 기존과 동일하게 use-case boundary에서 수행한다. Node/Edge 작업은 `board -> story -> workspace` ownership chain을 검증한다. 기존 hidden-404 정책도 유지한다.

## 8. Editor Persistence

유지:

- Zustand working state
- React Flow rendering/input adapter
- draft -> debounce -> command -> Save Queue
- `node:<id>` / `edge:<id>` lane serialization
- optimistic version conflict handling
- session-local Undo/Redo
- reload persistence

제거:

- canonical + Scope State + Board presentation 합성
- effective-node/effective-edge Scope resolution
- Story canonical entity placement/removal 개념

Canvas와 Inspector는 snapshot의 Node/Edge를 직접 편집한다.

```text
before: canonical Node + NodeState + BoardNode -> effective node
now:    GraphNode -> rendered node

before: canonical Edge + EdgeState + BoardEdge -> effective edge
now:    GraphEdge -> rendered edge
```

### Delete / Undo

Board에서 Node를 삭제하면 실제 Node row와 incident Edge가 삭제된다.

Undo command는 삭제 직전 Node와 incident Edge의 full snapshot을 메모리에 보관하고 Node restore endpoint를 통해 transaction으로 복원한다. Edge 단독 삭제 Undo도 Edge restore endpoint를 사용한다.

Undo/Redo history는 기존처럼 session-local이며 reload 후 유지하지 않는다.

## 9. Story Boards UX

Story는 작품/프로젝트이고 Story page는 Board 관리 화면이다.

### Board create

기존 Context 선택을 완전히 제거한다.

입력:

- Board name
- optional description
- optional tags

Board 생성 후 바로 Graph Editor로 이동한다.

### Board list / tags

각 Board card에 Tag를 표시한다.

```text
전체 인물 관계도
#인물 #전체
```

현재 Story의 `BoardResponse[]`에서 Tag 문자열 union을 만들고 filter chip으로 사용한다. V1에서는 Board 수가 적다는 전제로 client-side filtering을 사용한다.

Board metadata edit에서 Tag를 추가/삭제한다. 별도의 Tag 관리 화면이나 Workspace-global Tag master는 만들지 않는다.

## 10. Migration Strategy

아직 배포되지 않았고 보존해야 할 Graph 사용자 데이터가 없으므로 compatibility migration을 만들지 않는다.

- `0000` auth/workspace foundation은 유지한다.
- `0001` Story foundation은 유지한다.
- `0002` 이후 기존 Graph/Scope/EdgeState migration은 Board-owned Graph 단일 baseline으로 다시 생성한다.
- 기존 Scope/State migration 파일과 해당 Drizzle snapshot/journal entry는 제거한다.
- schema와 Drizzle metadata를 새 baseline에 맞춘다.
- 기존 local development DB는 데이터 변환하지 않고 volume/database reset 후 새 migration을 적용한다.

이 결정은 첫 production 배포 전이라는 전제에서만 허용한다.

## 11. Error / Concurrency Rules

- 존재하지 않거나 접근 권한이 없는 Board/Node/Edge: hidden 404.
- Node/Edge PATCH의 stale `expectedVersion`: 409 conflict.
- Node/Edge version은 semantic/presentation 구분 없이 해당 row의 모든 PATCH 성공 시 1 증가한다.
- 다른 Board의 Node를 Edge source/target으로 지정: request failure; DB composite FK도 최종 방어선이다.
- Tag는 API에서 trim 후 검증하며 빈 값, 50자 초과, 동일 Board 요청 내 중복을 거부한다.
- Save Queue conflict 발생 시 기존 editor recovery/reload 패턴을 유지한다.
- Board metadata는 V1에서 last-write-wins이며 별도 Board CAS token을 두지 않는다.

## 12. Test Strategy

### Schema / repository integration

- Node가 Board에 직접 속한다.
- Edge endpoints는 같은 Board Node만 참조 가능하다.
- Board 삭제가 Node/Edge/Tag를 cascade한다.
- Node 삭제가 incident Edge를 cascade한다.
- 같은 Story의 Board A/B에 동일 이름 Node를 만들어도 서로 독립이다.
- Tag가 `(boardId, name)` 기준으로 격리된다.
- Node/Edge semantic/presentation PATCH가 동일 version CAS를 따른다.

### Application / API

- Story Board list/create/update가 tags를 반환한다.
- Scope/State endpoints가 존재하지 않는다.
- Node/Edge CRUD가 Board boundary를 검증한다.
- stale version은 409를 유지한다.
- snapshot은 story/board/nodes/edges만 반환한다.
- Node restore가 Node + incident Edge를 atomic하게 복원한다.

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
7. Story page에서 Tag filter로 Board 목록을 좁힌다.
8. Node 삭제 -> incident Edge 삭제 -> Undo 복원 -> reload persistence를 확인한다.

## 13. Documentation Changes

이 architecture를 기준으로 다음 문서/규칙을 맞춘다.

- root `AGENTS.md`
- `src/backend/AGENTS.md`
- `src/frontend/features/graph-editor/AGENTS.md`
- root `DESIGN.md`의 Scope product principle 제거

기존 Scope/NodeState/EdgeState 설계 문서는 historical record로 남길 수 있지만 Graph ownership/state semantics가 충돌하면 **이 문서가 우선한다**.

## 14. Explicitly Out of Scope

- Node/Edge를 여러 Board에서 공유 또는 동기화
- Board 간 링크
- Scope / NodeState / EdgeState
- Tag hierarchy
- Workspace-global Tag master
- Tag management screen
- server-side Tag search/filter API
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

코드/DB/API도 같은 구조를 그대로 표현한다. Save Queue, CAS, Undo/Redo는 견고함을 위한 내부 기술 요소일 뿐 새로운 사용자 도메인 개념을 만들지 않는다.
