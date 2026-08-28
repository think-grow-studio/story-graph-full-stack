"use client";

import dynamic from "next/dynamic";

const SwaggerUI = dynamic(
  async () => {
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
