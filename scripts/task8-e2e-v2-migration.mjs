import fs from "node:fs";

const replacements = [
  {
    path: "src/frontend/pages/graph-editor/graph-editor-page.tsx",
    pairs: [
      [
        '{selectedEntity?.kind === "node" ? (',
        '{selectedEntity?.kind === "node" && !pendingConnection ? (',
      ],
    ],
  },
  {
    path: "tests/e2e/auth-story.spec.ts",
    pairs: [
      [
        'const sourceHandle = aliceElement.locator(".react-flow__handle.source");',
        'const sourceHandle = aliceElement.locator(\'.react-flow__handle[data-handleid="right"]\');',
      ],
      [
        'const targetHandle = bobElement.locator(".react-flow__handle.target");',
        'const targetHandle = bobElement.locator(\'.react-flow__handle[data-handleid="left"]\');',
      ],
    ],
  },
  {
    path: "tests/e2e/product-ui-authoring.spec.ts",
    pairs: [
      [
        'const sourceHandle = alice.locator(".react-flow__handle.source");',
        'const sourceHandle = alice.locator(\'.react-flow__handle[data-handleid="right"]\');',
      ],
      [
        'const targetHandle = bob.locator(".react-flow__handle.target");',
        'const targetHandle = bob.locator(\'.react-flow__handle[data-handleid="left"]\');',
      ],
    ],
  },
];

for (const migration of replacements) {
  let source = fs.readFileSync(migration.path, "utf8");
  for (const [before, after] of migration.pairs) {
    const first = source.indexOf(before);
    if (first === -1) {
      throw new Error(`Expected selector not found in ${migration.path}: ${before}`);
    }
    if (source.indexOf(before, first + before.length) !== -1) {
      throw new Error(`Selector occurs more than once in ${migration.path}: ${before}`);
    }
    source = source.replace(before, after);
  }
  fs.writeFileSync(migration.path, source);
}
