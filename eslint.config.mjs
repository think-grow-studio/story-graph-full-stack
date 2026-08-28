import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/frontend/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/backend/**", "drizzle-orm", "drizzle-orm/**"],
              message: "Frontend must use frontend/api and /api/v1 contracts.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/backend/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/frontend/**"],
              message: "Backend must not depend on frontend implementation.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/contracts/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/frontend/**", "@/backend/**", "@/app/**", "react", "react/**"],
              message: "Contracts may contain only transport schemas/types and contract-local helpers.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/**/page.tsx", "src/app/**/layout.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/backend/**", "drizzle-orm", "drizzle-orm/**"],
              message: "Pages/layouts must not bypass the HTTP application boundary.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
