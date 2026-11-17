import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "node_modules"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          // Components are PascalCase; `motion` is the one lowercase import
          // that is only ever referenced through JSX (<motion.div>), which
          // the base rule cannot see without eslint-plugin-react.
          varsIgnorePattern: "^[A-Z_]|^motion$",
          argsIgnorePattern: "^_|^[A-Z]",
          caughtErrorsIgnorePattern: "^_|^error$|^err$",
        },
      ],

      // Calling setState from an effect is exactly how a page loads its
      // data on mount (fetch -> setState) and how a layout reacts to a
      // route change. The rule is a useful nudge, not a correctness
      // guarantee, so it is a warning here rather than a build-breaking
      // error; genuine cascading-render problems still get surfaced.
      "react-hooks/set-state-in-effect": "warn",

      // Context providers legitimately export both a component and its
      // hook. Fast refresh degrades slightly for those files; correctness
      // is unaffected.
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
]);
