import js from "@eslint/js";
import globals from "globals";
import nextPlugin from "@next/eslint-plugin-next";
export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
      "supabase/.temp/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ["**/*.{js,jsx,mjs}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@next/next/no-html-link-for-pages": "error",
    },
  },
];
