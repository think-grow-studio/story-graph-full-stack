import { buildOpenApiDocument } from "@/backend/infrastructure/openapi/openapi-document";

export function GET() {
  return Response.json(buildOpenApiDocument(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
