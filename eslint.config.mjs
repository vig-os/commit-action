// ESLint flat config (ESLint 10).
//
// Replaces .eslintrc.json: ESLint 9 made flat config the default and ESLint 10
// removed the legacy eslintrc path entirely (ESLINT_USE_FLAT_CONFIG no longer
// opts back in). Refs #64.
//
// The rule set is a faithful port of the old .eslintrc.json — same base configs,
// same two rule overrides, same environments. `env` has no flat-config
// equivalent, so the node/es6/jest environments become `languageOptions.globals`.

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/", "coverage/", "node_modules/"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
);
