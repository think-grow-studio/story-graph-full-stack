import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";

const root = process.cwd();
const require = createRequire(import.meta.url);

function fail(message) {
  console.error(message);
  process.exit(1);
}

let localEnv;

try {
  localEnv = parseEnv(readFileSync(path.join(root, ".env"), "utf8"));
} catch (error) {
  fail(`Unable to read local .env: ${error.message}`);
}

const databaseUrl = localEnv.DATABASE_URL;

if (!databaseUrl) fail("DATABASE_URL is missing from local .env");

let parsedDatabaseUrl;

try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch {
  fail("DATABASE_URL in local .env is not a valid URL");
}

const isExpectedLocalDatabase =
  parsedDatabaseUrl.protocol === "postgresql:" &&
  ["localhost", "127.0.0.1"].includes(parsedDatabaseUrl.hostname) &&
  parsedDatabaseUrl.port === "5433" &&
  parsedDatabaseUrl.pathname === "/story_graph" &&
  parsedDatabaseUrl.username === "story_graph" &&
  parsedDatabaseUrl.password === "story_graph" &&
  parsedDatabaseUrl.search === "" &&
  parsedDatabaseUrl.hash === "";

if (!isExpectedLocalDatabase) {
  fail("Local migrations may only target the Story Graph PostgreSQL on localhost:5433");
}

const drizzleKitEntry = require.resolve("drizzle-kit");
const drizzleKitBin = path.join(path.dirname(drizzleKitEntry), "bin.cjs");
const result = spawnSync(process.execPath, [drizzleKitBin, "migrate"], {
  cwd: root,
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
