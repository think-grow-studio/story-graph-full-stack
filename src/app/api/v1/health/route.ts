import { NextResponse } from "next/server";

import { getHealth } from "@/backend/modules/system/application/get-health/get-health.use-case";
import { healthResponseSchema } from "@/contracts/system/health.contract";

export async function GET() {
  return NextResponse.json(healthResponseSchema.parse(getHealth()));
}
