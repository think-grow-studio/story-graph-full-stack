# Graph Editor
독립 subsystem처럼 다룬다.
- Zustand가 working state를 소유한다.
- React Flow는 rendering/input engine이다.
- Query cache를 drag/edit state로 쓰지 않는다.
- Story Node/Edge와 Board 표현 상태를 분리한다.
- 변경은 command/operation으로 표현해 undo/autosave 확장을 보존한다.
