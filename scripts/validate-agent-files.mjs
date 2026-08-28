import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignored = new Set([".git", ".next", "node_modules"]);
const errors = [];

async function findAgents(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = [];

  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await findAgents(absolute)));
    if (entry.isFile() && entry.name === "AGENTS.md") found.push(absolute);
  }

  return found;
}

const agentFiles = await findAgents(root);

for (const agentFile of agentFiles) {
  const content = await readFile(agentFile, "utf8");
  const relative = path.relative(root, agentFile);
  const claudeFile = path.join(path.dirname(agentFile), "CLAUDE.md");

  if ([...content].length > 500) errors.push(`${relative} exceeds 500 characters`);

  try {
    const claude = await readFile(claudeFile, "utf8");
    if (claude !== "@AGENTS.md\n") {
      errors.push(`${path.relative(root, claudeFile)} must contain only @AGENTS.md`);
    }
  } catch {
    errors.push(`${path.relative(root, claudeFile)} is missing`);
  }
}

if (agentFiles.length !== 8) errors.push(`expected 8 AGENTS.md files, found ${agentFiles.length}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Validated 8 AGENTS.md files.");
