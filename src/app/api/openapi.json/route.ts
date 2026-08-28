import { buildOpenApiDocument } from "@/backend/infrastructure/openapi/openapi-document";

export async function GET() {
  return Response.json(await buildOpenApiDocument(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
