import fs from "node:fs";

function replaceExact(source, before, after, expectedCount, path) {
  const count = source.split(before).length - 1;
  if (count !== expectedCount) {
    throw new Error(`${path}: expected ${expectedCount} matches, found ${count}: ${before}`);
  }
  return source.split(before).join(after);
}

{
  const path = "tests/e2e/auth-story.spec.ts";
  let source = fs.readFileSync(path, "utf8");

  source = replaceExact(
    source,
    'page.locator(`.react-flow__edge[data-id="${createdEdge.id}"]`),\n    ).toBeVisible();',
    'page\n        .locator(`.react-flow__edge[data-id="${createdEdge.id}"]`)\n        .locator(".react-flow__edge-path"),\n    ).toBeVisible();',
    2,
    path,
  );
  source = replaceExact(
    source,
    'await page.getByLabel("속성 JSON").fill(\'{"role":"lead","age":31}\');',
    'await page.getByLabel("속성 JSON").fill(\'{"role":"lead","age":"31"}\');',
    1,
    path,
  );
  source = replaceExact(
    source,
    'properties: { role: "lead", age: 31 },',
    'properties: { role: "lead", age: "31" },',
    2,
    path,
  );
  source = replaceExact(
    source,
    'await page.getByLabel("속성 JSON").fill(\'{"since":2012}\');',
    'await page.getByLabel("속성 JSON").fill(\'{"since":"2012"}\');',
    1,
    path,
  );
  source = replaceExact(
    source,
    'properties: { since: 2012 },',
    'properties: { since: "2012" },',
    2,
    path,
  );
  source = replaceExact(
    source,
    'await expect(page.locator(`.react-flow__edge[data-id="${edge.id}"]`)).toBeVisible();',
    'await expect(\n      page\n        .locator(`.react-flow__edge[data-id="${edge.id}"]`)\n        .locator(".react-flow__edge-path"),\n    ).toBeVisible();',
    1,
    path,
  );

  fs.writeFileSync(path, source);
}

{
  const path = "tests/e2e/node-delete-history.spec.ts";
  let source = fs.readFileSync(path, "utf8");

  source = replaceExact(
    source,
    'const edgeElement = page.locator(`.react-flow__edge[data-id="${edge.id}"]`);',
    'const edgeElement = page.locator(`.react-flow__edge[data-id="${edge.id}"]`);\n    const edgePath = edgeElement.locator(".react-flow__edge-path");',
    1,
    path,
  );
  source = replaceExact(
    source,
    'await expect(edgeElement).toBeVisible();',
    'await expect(edgePath).toBeVisible();',
    3,
    path,
  );
  source = replaceExact(
    source,
    'page.locator(`.react-flow__edge[data-id="${edge.id}"]`),\n    ).toBeVisible();',
    'page\n        .locator(`.react-flow__edge[data-id="${edge.id}"]`)\n        .locator(".react-flow__edge-path"),\n    ).toBeVisible();',
    1,
    path,
  );

  fs.writeFileSync(path, source);
}

{
  const path = "tests/e2e/relationship-delete-history.spec.ts";
  let source = fs.readFileSync(path, "utf8");

  source = replaceExact(
    source,
    'const edgeElement = page.locator(`.react-flow__edge[data-id="${edge.id}"]`);',
    'const edgeElement = page.locator(`.react-flow__edge[data-id="${edge.id}"]`);\n    const edgePath = edgeElement.locator(".react-flow__edge-path");',
    1,
    path,
  );
  source = replaceExact(
    source,
    'await expect(edgeElement).toBeVisible();',
    'await expect(edgePath).toBeVisible();',
    3,
    path,
  );
  source = replaceExact(
    source,
    'page.locator(`.react-flow__edge[data-id="${edge.id}"]`),\n    ).toBeVisible();',
    'page\n        .locator(`.react-flow__edge[data-id="${edge.id}"]`)\n        .locator(".react-flow__edge-path"),\n    ).toBeVisible();',
    1,
    path,
  );

  fs.writeFileSync(path, source);
}
