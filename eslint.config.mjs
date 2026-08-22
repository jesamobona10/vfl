import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([
    {
        ignores: [
            ".next/**",
            ".agents/**",
            "node_modules/**",
            "out/**",
            "docs/**",
            "scripts/**",
            "next-env.d.ts",
        ],
    },
    {
    extends: [
        ...nextCoreWebVitals,
        ...compat.extends("plugin:@typescript-eslint/recommended")
    ],

    languageOptions: {
        parser: tsParser,
        ecmaVersion: "latest",
        sourceType: "module",
    },

    rules: {
        "@next/next/no-img-element": "warn",
        "@typescript-eslint/no-explicit-any": "warn",

        "@typescript-eslint/no-unused-vars": ["warn", {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
        }],

        "no-console": ["warn", {
            allow: ["warn", "error"],
        }],

        "prefer-const": "error",
        "no-var": "error",

        // Pre-existing effect patterns; refactor deliberately, not during upgrades.
        "react-hooks/set-state-in-effect": "warn",
        "react-hooks/static-components": "warn",

        eqeqeq: ["error", "always", {
            null: "ignore",
        }],
    },
}]);