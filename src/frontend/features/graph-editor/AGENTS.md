# Graph Editor
- Zustand가 working state를 소유한다.
- raw draft와 canonical/state를 분리하고 invalid draft는 저장하지 않는다.
- React Flow는 rendering/input 전용, Board는 표현 상태만 소유한다.
- scoped Node/Relationship은 canonical+NodeState/EdgeState로 resolve한다.
- state는 canonical identity/topology를 덮어쓰지 않는다.
- 편집은 draft→debounce→command→Save Queue다.
- scoped edit도 node:<id>/edge:<id> lane과 command/history를 쓴다.
- Undo/Redo는 inverse command를 재저장한다.
- Board removal은 canonical/state를 삭제하지 않는다.