import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const nodePresentation = '{ shape: "rounded-rect", fillColor: null, borderColor: null, borderWidth: null, textColor: null }';
const edgePresentation = '{ strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null }';
const edgeRouting = '{ type: "orthogonal", sourcePort: "auto", targetPort: "auto", waypoints: [] as Array<{ x: number; y: number }> }';
const graphSettings = '{ defaultEdgeRouting: "orthogonal", snapToGrid: false, layoutMode: "free" }';

const testFiles = [
  "src/frontend/features/graph-editor/commands/editor-command-executor.test.ts",
  "src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts",
  "src/frontend/features/graph-editor/history/edge-delete-history.test.ts",
  "src/frontend/features/graph-editor/history/editor-history-entry.test.ts",
  "src/frontend/features/graph-editor/history/editor-history-save-queue.test.tsx",
  "src/frontend/features/graph-editor/history/editor-history.test.ts",
  "src/frontend/features/graph-editor/history/node-delete-history.test.ts",
  "src/frontend/features/graph-editor/history/use-editor-history.test.tsx",
  "src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts",
  "src/frontend/features/graph-editor/inspector/inspector-draft-model.test.ts",
  "src/frontend/features/graph-editor/inspector/inspector-draft-store.test.ts",
  "src/frontend/features/graph-editor/inspector/use-inspector-autosave.test.tsx",
  "src/frontend/features/graph-editor/save-queue/editor-save-queue-contract.test.ts",
  "src/frontend/features/graph-editor/save-queue/editor-save-queue.test.ts",
  "src/frontend/features/graph-editor/save-queue/use-editor-save-queue.test.tsx",
  "src/frontend/features/graph-editor/store/graph-editor-store.test.ts",
  "src/frontend/pages/graph-editor/graph-editor-page.test.tsx",
  "src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx",
];

const legacyInspectorJsonFiles = new Set([
  "src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts",
  "src/frontend/features/graph-editor/inspector/inspector-draft-model.test.ts",
  "src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx",
]);

function propertyName(property) {
  if (!property.name) return null;
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) {
    return property.name.text;
  }
  return null;
}

function stringLiteralProperty(object, name) {
  const property = object.properties.find(
    (candidate) => ts.isPropertyAssignment(candidate) && propertyName(candidate) === name,
  );
  return property && ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer)
    ? property.initializer.text
    : null;
}

function objectPropertyNames(object) {
  return new Set(object.properties.map(propertyName).filter(Boolean));
}

function effectivePropertyNames(names) {
  const effective = new Set(names);
  if (names.has("style")) effective.add("presentation");
  if (names.has("labelPresentation")) effective.add("routing");
  return effective;
}

function indentationAt(source, position) {
  const lineStart = source.lastIndexOf("\n", position - 1) + 1;
  return source.slice(lineStart, position).match(/^\s*/)?.[0] ?? "";
}

function insertProperties(source, sourceFile, object, additions, edits) {
  if (!additions.length) return;
  const closePosition = object.getEnd() - 1;
  const closeIndent = indentationAt(source, closePosition);
  const propertyIndent = `${closeIndent}  `;
  const lastProperty = object.properties.at(-1);
  const tail = lastProperty
    ? source.slice(lastProperty.getEnd(), closePosition)
    : source.slice(object.getStart(sourceFile) + 1, closePosition);
  const needsLeadingComma = Boolean(lastProperty) && !tail.includes(",");
  const prefix = needsLeadingComma ? "," : "";
  const text = `${prefix}\n${additions
    .map((addition) => `${propertyIndent}${addition},`)
    .join("\n")}\n${closeIndent}`;
  edits.push({ start: closePosition, end: closePosition, text });
}

function replaceProperty(property, replacement, edits) {
  edits.push({
    start: property.getStart(),
    end: property.getEnd(),
    text: replacement,
  });
}

function stringifyPropertyLeaves(initializer, edits) {
  function visit(node) {
    if (ts.isNumericLiteral(node)) {
      edits.push({ start: node.getStart(), end: node.getEnd(), text: JSON.stringify(node.text) });
      return;
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword) {
      edits.push({ start: node.getStart(), end: node.getEnd(), text: '"true"' });
      return;
    }
    if (node.kind === ts.SyntaxKind.FalseKeyword) {
      edits.push({ start: node.getStart(), end: node.getEnd(), text: '"false"' });
      return;
    }
    if (node.kind === ts.SyntaxKind.NullKeyword) {
      edits.push({ start: node.getStart(), end: node.getEnd(), text: '"null"' });
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(initializer);
}

function stringifyJsonScalarTokens(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return text;

  try {
    const parsed = JSON.parse(text);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return text;
  } catch {
    return text;
  }

  return text.replace(
    /([:\[,]\s*)(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)(?=\s*[,}\]])/g,
    (_match, prefix, scalar) => `${prefix}${JSON.stringify(scalar)}`,
  );
}

function commandAdditions(type, names) {
  const additions = [];
  const add = (name, text) => {
    if (!names.has(name)) additions.push(`${name}: ${text}`);
  };

  if (type === "create-node") {
    add("description", '""');
    add("kind", '"entity"');
    add("iconKey", "null");
    add("properties", "{}");
    add("width", "null");
    add("height", "null");
    add("zIndex", "0");
    add("presentation", nodePresentation);
  } else if (type === "update-node") {
    add("kind", '"entity"');
    add("iconKey", "null");
    add("presentation", nodePresentation);
  } else if (type === "create-edge") {
    add("direction", '"DIRECTED"');
    add("description", '""');
    add("kind", '"relationship"');
    add("iconKey", "null");
    add("properties", "{}");
    add("presentation", edgePresentation);
    add("routing", edgeRouting);
  } else if (type === "update-edge") {
    add("direction", '"DIRECTED"');
    add("kind", '"relationship"');
    add("iconKey", "null");
    add("presentation", edgePresentation);
    add("routing", edgeRouting);
  }

  return additions;
}

function migrateTestFile(relativePath) {
  const absolutePath = path.resolve(relativePath);
  let source = fs.readFileSync(absolutePath, "utf8");
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const edits = [];

  function visit(node) {
    if (
      legacyInspectorJsonFiles.has(relativePath) &&
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ) {
      const nextText = stringifyJsonScalarTokens(node.text);
      if (nextText !== node.text) {
        const quote = ts.isNoSubstitutionTemplateLiteral(node) ? "`" : JSON.stringify(nextText);
        edits.push({
          start: node.getStart(),
          end: node.getEnd(),
          text: ts.isNoSubstitutionTemplateLiteral(node) ? `${quote}${nextText}${quote}` : quote,
        });
      }
    }

    if (ts.isObjectLiteralExpression(node)) {
      const names = objectPropertyNames(node);
      const effectiveNames = effectivePropertyNames(names);
      const type = stringLiteralProperty(node, "type");

      if (type) {
        insertProperties(
          source,
          sourceFile,
          node,
          commandAdditions(type, effectiveNames),
          edits,
        );
      }

      const isEdgeShape =
        !type && names.has("boardId") && names.has("sourceNodeId") && names.has("targetNodeId");
      const isNodeShape =
        !type && names.has("boardId") && names.has("name") && names.has("x") && names.has("y");
      const isBoardShape =
        !type && names.has("storyId") && names.has("tags") && names.has("createdAt") && names.has("updatedAt");

      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = propertyName(property);
        if (name === "properties") {
          stringifyPropertyLeaves(property.initializer, edits);
        }
        if (name === "style") {
          replaceProperty(
            property,
            `presentation: ${isEdgeShape ? edgePresentation : nodePresentation}`,
            edits,
          );
        }
        if (name === "labelPresentation") {
          replaceProperty(property, `routing: ${edgeRouting}`, edits);
        }
      }

      const additions = [];
      const add = (name, text) => {
        if (!effectiveNames.has(name)) additions.push(`${name}: ${text}`);
      };

      if (isNodeShape) {
        add("kind", '"entity"');
        add("presentation", nodePresentation);
      }
      if (isEdgeShape) {
        add("direction", '"DIRECTED"');
        add("kind", '"relationship"');
        add("presentation", edgePresentation);
        add("routing", edgeRouting);
      }
      if (isBoardShape) {
        add("graphSettings", graphSettings);
      }
      insertProperties(source, sourceFile, node, additions, edits);
    }

    if (ts.isPropertyAccessExpression(node)) {
      if (node.name.text === "style") {
        edits.push({ start: node.name.getStart(), end: node.name.getEnd(), text: "presentation" });
      } else if (node.name.text === "labelPresentation") {
        edits.push({ start: node.name.getStart(), end: node.name.getEnd(), text: "routing" });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let lastStart = Number.POSITIVE_INFINITY;
  for (const edit of edits) {
    if (edit.end > lastStart) continue;
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
    lastStart = edit.start;
  }

  fs.writeFileSync(absolutePath, source);
}

for (const file of testFiles) {
  migrateTestFile(file);
}

const pagePath = "src/frontend/pages/graph-editor/graph-editor-page.tsx";
let page = fs.readFileSync(pagePath, "utf8");
const oldCanvasEdges = `  const canvasEdges = state.edges.map((edge) => ({\n    id: edge.id,\n    name: edge.name,\n    sourceNodeId: edge.sourceNodeId,\n    targetNodeId: edge.targetNodeId,\n  }));`;
const newCanvasEdges = `  const canvasEdges = state.edges.map((edge) => ({\n    id: edge.id,\n    name: edge.name,\n    sourceNodeId: edge.sourceNodeId,\n    targetNodeId: edge.targetNodeId,\n    direction: edge.direction,\n    presentation: edge.presentation,\n    routing: edge.routing,\n  }));`;
if (!page.includes(oldCanvasEdges)) {
  throw new Error("GraphEditorPage canvas Edge projection did not match expected pre-migration shape");
}
page = page.replace(oldCanvasEdges, newCanvasEdges);
fs.writeFileSync(pagePath, page);

const nodeUseCasesPath = "src/backend/modules/graph/application/node.use-cases.test.ts";
let nodeUseCases = fs.readFileSync(nodeUseCasesPath, "utf8");
const oldRestoreMap = "      edges: input.edges.map((edge) => ({";
const newRestoreMap = '      edges: input.edges.map((edge: DeletedNodeSnapshot["edges"][number]) => ({';
if (!nodeUseCases.includes(oldRestoreMap)) {
  throw new Error("Node use-case restore fixture did not match expected callback shape");
}
nodeUseCases = nodeUseCases.replace(oldRestoreMap, newRestoreMap);
fs.writeFileSync(nodeUseCasesPath, nodeUseCases);
