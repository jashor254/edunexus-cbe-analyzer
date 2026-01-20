import js from "@eslint/js";
import globals from "globals";
import next from "eslint-config-next";

const config = [
  js.configs.recommended,
  next,
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

      // Hii ndiyo imekuletea hiyo message
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default config;

