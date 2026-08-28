import axios from "axios";

import { clientEnv } from "@/config/env.client";

export const apiClient = axios.create({
  baseURL: clientEnv.NEXT_PUBLIC_API_BASE_URL,
  withCredentials: true,
});
