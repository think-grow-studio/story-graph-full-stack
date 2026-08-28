import { readSwaggerUiBundle } from "@/backend/infrastructure/openapi/swagger-ui-assets";

export async function GET() {
  const bundle = await readSwaggerUiBundle();

  return new Response(bundle, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/javascript; charset=utf-8",
    },
  });
}
