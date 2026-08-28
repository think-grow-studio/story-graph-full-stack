import type { HealthResponse } from "@/contracts/system/health.contract";

export function getHealth(): HealthResponse {
  return { status: "ok" };
}
