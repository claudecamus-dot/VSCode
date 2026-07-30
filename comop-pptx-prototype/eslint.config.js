// Configuration ESLint — 2026-07-30, finding pratique-dev du superviseur de flotte.
// L'exclusion "peu de code" de l'arbitrage du 2026-07-23 est démentie par la mesure
// (1689 lignes JS+PowerShell dans ce dossier). On MESURE d'abord, aucun seuil
// imposé, et surtout pas de `--fix` aveugle (un --fix a cassé un ré-export sur
// VSCode2 le 2026-07-23).
"use strict";

const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    // server.js, test/, test-support/ : code Node (CommonJS).
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        console: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
  },
  {
    // web/ : script navigateur, pas de module ni de globals Node.
    files: ["web/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        document: "readonly",
        window: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        console: "readonly",
      },
    },
  },
  {
    ignores: ["node_modules/**", "coverage/**", "output/**", "_debug_template/**"],
  },
];
