import js from "@eslint/js";
import globals from "globals";
import next from "eslint-config-next";

const config = [
  {
    ignores: [".claude/**", "node_modules/**", ".next/**"],
  },
  js.configs.recommended,
  ...next,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-undef": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",

      // React Compiler rules (eslint-plugin-react-hooks v7) are stricter than
      // this codebase's patterns — e.g. "reset state on prop change" and
      // "compute relative time in a helper" are idiomatic React, not bugs.
      // Downgraded to warn until each site gets a deliberate, tested rewrite.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",

      // Hii ndiyo imekuletea hiyo message
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default config;

