# Graph Editor
- Zustand가 valid working graph state를 소유한다.
- Inspector raw draft는 canonical Node/Edge와 분리하고 invalid draft는 Save Queue에 넣지 않는다.
- React Flow는 rendering/input engine이며 Query cache를 편집 상태로 쓰지 않는다.
- Story Node/Edge와 Board 표현 상태를 분리한다.
- 편집 흐름은 draft → debounce → command → Save Queue다.
- Undo/Redo는 inverse command를 Save Queue로 재실행한다.
- Board removal은 canonical entity를 삭제하지 않는다.
- Relationship은 BoardEdge를 restore한다.
- Node는 BoardNode 배치와 incident BoardEdge 표현을 함께 restore한다.
