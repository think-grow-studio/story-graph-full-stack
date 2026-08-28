import { useQuery } from "@tanstack/react-query";

import { getBootstrap } from "./bootstrap.api";

export const bootstrapQueryKey = ["bootstrap"] as const;

export function useBootstrapQuery() {
  return useQuery({
    queryKey: bootstrapQueryKey,
    queryFn: getBootstrap,
    retry: false,
  });
}
