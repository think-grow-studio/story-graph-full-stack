import { rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const violations = [
  {
    path: "src/frontend/__architecture_alias_violation__.ts",
    source:
      'import { getHealth } from "@/backend/modules/system/application/get-health/get-health.use-case";\nexport const violation = getHealth;\n',
    label: "frontend alias import of backend",
  },
  {
    path: "src/frontend/__architecture_relative_violation__.ts",
    source:
      'import { getHealth } from "../backend/modules/system/application/get-health/get-health.use-case";\nexport const violation = getHealth;\n',
    label: "frontend relative import of backend",
  },
  {
    path: "src/frontend/__architecture_dynamic_violation__.ts",
    source:
      'export const loadBackend = () => import("@/backend/modules/system/application/get-health/get-health.use-case");\n',
    label: "frontend dynamic import of backend",
  },
  {
    path: "src/frontend/__architecture_require_violation__.ts",
    source:
      'export const backend = require("@/backend/modules/system/application/get-health/get-health.use-case");\n',
    label: "frontend require of backend",
  },
  {
    path: "src/backend/modules/identity/application/__architecture_infrastructure_violation__.ts",
    source:
      'import { auth } from "@/backend/infrastructure/auth/auth";\nexport const violation = auth;\n',
    label: "backend application import of infrastructure",
  },
  {
    path: "src/backend/modules/identity/application/__architecture_relative_infrastructure_violation__.ts",
    source:
      'import { BetterAuthSessionService } from "../infrastructure/better-auth-session.service";\nexport const violation = BetterAuthSessionService;\n',
    label: "backend application relative import of module infrastructure",
  },
  {
    path: "src/backend/modules/identity/application/__architecture_dynamic_infrastructure_violation__.ts",
    source:
      'export const loadInfrastructure = () => import("@/backend/infrastructure/auth/auth");\n',
    label: "backend application dynamic import of infrastructure",
  },
];

function runEslint(path) {
  return spawnSync("pnpm", ["exec", "eslint", path], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

const errors = [];

for (const violation of violations) {
  await writeFile(violation.path, violation.source, "utf8");

  try {
    const result = runEslint(violation.path);
    if (result.status === 0) {
      errors.push(`${violation.label} was not rejected`);
    }
  } finally {
    await rm(violation.path, { force: true });
  }
}

const allowedRoute = runEslint("src/app/api/v1/health/route.ts");
if (allowedRoute.status !== 0) {
  errors.push("API route import of backend application code was rejected");
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Validated source import boundaries.");
