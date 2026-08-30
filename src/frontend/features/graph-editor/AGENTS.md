# Graph Editor
독립 subsystem처럼 다룬다.
- Zustand가 valid working graph state를 소유한다.
- Inspector raw draft는 canonical Node/Edge와 분리한다.
- invalid draft는 Zustand/Save Queue에 넣지 않는다.
- React Flow는 rendering/input engine이다.
- Query cache를 drag/edit state로 쓰지 않는다.
- Story Node/Edge와 Board 표현 상태를 분리한다.
- 편집은 draft → debounce → command/operation → Save Queue 흐름을 지킨다.
- Undo/Redo는 inverse command를 Save Queue로 재실행한다.
- Relationship Board removal은 restore로 되돌린다.
- Node Board removal은 현재 history를 reset한다.
