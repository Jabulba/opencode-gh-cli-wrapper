import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import stylistic from "@stylistic/eslint-plugin";

export default [
  {
    files: ["**/*.ts"],
	  linterOptions: {
		  noInlineConfig: true,
	  },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
      globals: {
        process: "readonly",
        console: "readonly",
        fetch: "readonly",
        Math: "readonly",
        Date: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": ts,
      "@stylistic": stylistic,
    },
    rules: {
      ...ts.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",

      // Rules aligned with .editorconfig conventions
      "@stylistic/indent": ["error", "tab"],
      "eol-last": "error",
      "max-len": ["error", { code: 360 }],
    }
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    }
  }
];
