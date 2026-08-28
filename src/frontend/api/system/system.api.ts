import {
  healthResponseSchema,
  type HealthResponse,
} from "@/contracts/system/health.contract";
import { apiClient } from "@/frontend/api/client/api-client";

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await apiClient.get("/health");
  return healthResponseSchema.parse(response.data);
}
