import fs from "node:fs";

const draftModelPath = "src/frontend/features/graph-editor/inspector/inspector-draft-model.test.ts";
let draftModel = fs.readFileSync(draftModelPath, "utf8");
const oldJsonStringifyFixture = '{ role: "lead", meta: { age: 31 } },\n        null,';
const newJsonStringifyFixture = '{ role: "lead", meta: { age: "31" } },\n        null,';
if (!draftModel.includes(oldJsonStringifyFixture)) {
  throw new Error("Inspector draft JSON.stringify expectation did not match expected legacy shape");
}
draftModel = draftModel.replace(oldJsonStringifyFixture, newJsonStringifyFixture);
fs.writeFileSync(draftModelPath, draftModel);

const inspectorPagePath = "src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx";
let inspectorPage = fs.readFileSync(inspectorPagePath, "utf8");

const oldNodeExpectation = `    expect(mocks.updateNode.mock.calls[0][0]).toEqual({
      boardId,
      nodeId: aliceId,
      workspaceId: "workspace-1",
      expectedVersion: 3,
      name: "Alicia",
      description: "Main protagonist",
      properties: { role: "lead", age: "31" },
    });`;
const newNodeExpectation = `    expect(mocks.updateNode.mock.calls[0][0]).toEqual({
      boardId,
      nodeId: aliceId,
      workspaceId: "workspace-1",
      expectedVersion: 3,
      name: "Alicia",
      description: "Main protagonist",
      kind: "entity",
      iconKey: null,
      properties: { role: "lead", age: "31" },
      presentation: {
        shape: "rounded-rect",
        fillColor: null,
        borderColor: null,
        borderWidth: null,
        textColor: null,
      },
    });`;
if (!inspectorPage.includes(oldNodeExpectation)) {
  throw new Error("Graph Editor Node autosave expectation did not match migrated shape");
}
inspectorPage = inspectorPage.replace(oldNodeExpectation, newNodeExpectation);

const oldEdgeExpectation = `    expect(mocks.updateEdge.mock.calls[0][0]).toEqual({
      boardId,
      edgeId,
      workspaceId: "workspace-1",
      expectedVersion: 4,
      name: "best friend",
      description: "Childhood friends",
      properties: { since: "2012" },
    });`;
const newEdgeExpectation = `    expect(mocks.updateEdge.mock.calls[0][0]).toEqual({
      boardId,
      edgeId,
      workspaceId: "workspace-1",
      expectedVersion: 4,
      name: "best friend",
      direction: "DIRECTED",
      description: "Childhood friends",
      kind: "relationship",
      iconKey: null,
      properties: { since: "2012" },
      presentation: {
        strokeColor: null,
        strokeWidth: null,
        strokeStyle: "solid",
        labelColor: null,
      },
      routing: {
        type: "orthogonal",
        sourcePort: "auto",
        targetPort: "auto",
        waypoints: [],
      },
    });`;
if (!inspectorPage.includes(oldEdgeExpectation)) {
  throw new Error("Graph Editor Edge autosave expectation did not match migrated shape");
}
inspectorPage = inspectorPage.replace(oldEdgeExpectation, newEdgeExpectation);
fs.writeFileSync(inspectorPagePath, inspectorPage);
