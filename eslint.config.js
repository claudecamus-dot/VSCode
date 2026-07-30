// Pointeur racine — la config réelle vit à côté du vrai package.json/node_modules
// du dépôt (comop-pptx-prototype/), pas ici. Permet `npx eslint .` depuis la
// racine ET la détection du linter par le scan de supervision (racine du dépôt).
"use strict";

module.exports = require("./comop-pptx-prototype/eslint.config.js");
