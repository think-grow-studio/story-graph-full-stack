import "server-only";

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const swaggerUiPackageDirectory = path.dirname(require.resolve("swagger-ui-react"));
const swaggerUiBundlePath = path.join(swaggerUiPackageDirectory, "swagger-ui-bundle.js");

export function readSwaggerUiBundle(): Promise<Buffer> {
  return readFile(swaggerUiBundlePath);
}
