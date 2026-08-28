"use client";

import dynamic from "next/dynamic";

const SwaggerUI = dynamic(
  async () => {
    // Swagger UI's ESM core currently breaks when transformed by Next 16 Turbopack.
    // require() intentionally selects the package's browser CommonJS bundle instead.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const swaggerUiModule = require("swagger-ui-react") as typeof import("swagger-ui-react");
    return swaggerUiModule.default;
  },
  { ssr: false },
);

export function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-white">
      <SwaggerUI deepLinking persistAuthorization url="/api/openapi.json" />
    </main>
  );
}
