# Graph Editor
- Zustand가 working state를 소유하고 React Flow는 rendering/input만 담당한다.
- Node/Edge는 Board가 직접 소유하며 다른 Board와 공유하지 않는다.
- 위치/크기/style/presentation은 Node/Edge에 직접 저장한다.
- Scope/State/effective-resolution layer를 만들지 않는다.
- invalid draft는 저장하지 않는다.
- draft→debounce→command→Save Queue를 유지한다.
- node:<id>/edge:<id> lane과 Undo/Redo inverse 저장을 유지한다.
- Node 삭제 시 incident Edge도 삭제하고 Undo는 삭제 전 snapshot을 복원한다.
