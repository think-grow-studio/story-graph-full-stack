import { bootstrapResponseSchema, type BootstrapResponse } from "@/contracts/auth/bootstrap.contract";
import { apiClient } from "../client/api-client";

export async function getBootstrap(): Promise<BootstrapResponse> {
  const response = await apiClient.get("/bootstrap");
  return bootstrapResponseSchema.parse(response.data);
}
