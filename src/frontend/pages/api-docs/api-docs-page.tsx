"use client";

import dynamic from "next/dynamic";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-white">
      <SwaggerUI deepLinking persistAuthorization url="/api/openapi.json" />
    </main>
  );
}
