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
              regex: "^(?:@/backend(?:/|$)|\\..*/backend(?:/|$))",
              message: "Frontend must use frontend/api and /api/v1 contracts.",
            },
            {
              group: ["drizzle-orm", "drizzle-orm/**"],
              message: "Frontend must not import Drizzle directly.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportExpression[source.value=/^(?:@\\u002Fbackend(?:\\u002F|$)|\\..*\\u002Fbackend(?:\\u002F|$))/]",
          message: "Frontend must use frontend/api and /api/v1 contracts.",
        },
        {
          selector: "ImportExpression[source.value=/^drizzle-orm(?:\\u002F|$)/]",
          message: "Frontend must not import Drizzle directly.",
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
              regex: "^(?:@/frontend(?:/|$)|\\..*/frontend(?:/|$))",
              message: "Backend must not depend on frontend implementation.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportExpression[source.value=/^(?:@\\u002Ffrontend(?:\\u002F|$)|\\..*\\u002Ffrontend(?:\\u002F|$))/]",
          message: "Backend must not depend on frontend implementation.",
        },
      ],
    },
  },
  {
    files: ["src/backend/modules/**/application/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?:@/frontend(?:/|$)|\\..*/frontend(?:/|$))",
              message: "Backend must not depend on frontend implementation.",
            },
            {
              regex: "(?:^|/)infrastructure(?:/|$)",
              message: "Backend application code must depend on ports, not infrastructure.",
            },
            {
              group: ["better-auth", "better-auth/**", "drizzle-orm", "drizzle-orm/**", "pg"],
              message: "Backend application code must not depend on auth/database infrastructure libraries.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportExpression[source.value=/^(?:@\\u002Ffrontend(?:\\u002F|$)|\\..*\\u002Ffrontend(?:\\u002F|$))/]",
          message: "Backend must not depend on frontend implementation.",
        },
        {
          selector:
            "ImportExpression[source.value=/(?:^|\\u002F)infrastructure(?:\\u002F|$)/]",
          message: "Backend application code must depend on ports, not infrastructure.",
        },
        {
          selector:
            "ImportExpression[source.value=/^(?:better-auth|drizzle-orm|pg)(?:\\u002F|$)/]",
          message: "Backend application code must not depend on auth/database infrastructure libraries.",
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
              regex: "^(?:@/(?:frontend|backend|app)(?:/|$)|\\..*/(?:frontend|backend|app)(?:/|$))",
              message: "Contracts may contain only transport schemas/types and contract-local helpers.",
            },
            {
              group: ["react", "react/**"],
              message: "Contracts must not depend on React.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportExpression[source.value=/^(?:@\\u002F(?:frontend|backend|app)(?:\\u002F|$)|\\..*\\u002F(?:frontend|backend|app)(?:\\u002F|$))/]",
          message: "Contracts may contain only transport schemas/types and contract-local helpers.",
        },
        {
          selector: "ImportExpression[source.value=/^react(?:\\u002F|$)/]",
          message: "Contracts must not depend on React.",
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
              regex: "^(?:@/backend(?:/|$)|\\..*/backend(?:/|$))",
              message: "Pages/layouts must not bypass the HTTP application boundary.",
            },
            {
              group: ["drizzle-orm", "drizzle-orm/**"],
              message: "Pages/layouts must not access Drizzle directly.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportExpression[source.value=/^(?:@\\u002Fbackend(?:\\u002F|$)|\\..*\\u002Fbackend(?:\\u002F|$))/]",
          message: "Pages/layouts must not bypass the HTTP application boundary.",
        },
        {
          selector: "ImportExpression[source.value=/^drizzle-orm(?:\\u002F|$)/]",
          message: "Pages/layouts must not access Drizzle directly.",
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
