"use strict";

// Audit performance VSCode 2026-09-22 (dimension performance, finding
// "triple extraction / triple lancement powershell", requalification du
// 2026-09-20) : sur le chemin POST /api/templates, validate-template.ps1
// ouvrait l'archive DEUX fois -- une fois via Assert-ZipDecompressedSizeWithinLimit
// (garde anti-zip-bomb, pptx-xml-helpers.ps1) puis une seconde fois dans
// Read-ZipTextEntries (validate-template.ps1) pour lire le contenu texte.
// Les deux passes portent sur le meme fichier lu une ligne plus haut : un
// seul ZipFile.OpenRead doit suffire. Verifie statiquement (comme les autres
// preuves de cet audit, par grep) que validate-template.ps1 ne rappelle plus
// [System.IO.Compression.ZipFile]::OpenRead lui-meme : il reutilise l'archive
// deja ouverte par le helper partage.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const validateTemplateSrc = fs.readFileSync(
  path.join(__dirname, "..", "src", "validate-template.ps1"),
  "utf8"
);
const helpersSrc = fs.readFileSync(
  path.join(__dirname, "..", "src", "pptx-xml-helpers.ps1"),
  "utf8"
);

test("validate-template.ps1 n'ouvre l'archive qu'une seule fois, et la partage avec la garde anti-zip-bomb et la lecture du texte", () => {
  const directOpensInValidate = (
    validateTemplateSrc.match(/\[System\.IO\.Compression\.ZipFile\]::OpenRead/g) || []
  ).length;
  assert.strictEqual(
    directOpensInValidate,
    1,
    "validate-template.ps1 doit ouvrir l'archive une seule fois (2 avant ce correctif : une pour la garde, une pour Read-ZipTextEntries)"
  );

  assert.match(
    validateTemplateSrc,
    /Assert-ZipDecompressedSizeWithinLimit\s+-Archive\s+\$zip/,
    "la garde anti-zip-bomb doit reutiliser l'archive deja ouverte (-Archive), pas rouvrir le fichier (-ZipPath)"
  );
  assert.match(
    validateTemplateSrc,
    /Read-ZipTextEntries\s+-Archive\s+\$zip/,
    "Read-ZipTextEntries doit reutiliser l'archive deja ouverte (-Archive), pas rouvrir le fichier (-Path)"
  );
});

test("pptx-xml-helpers.ps1 reste le seul point d'ouverture de l'archive (une seule occurrence de OpenRead)", () => {
  const opensInHelpers = (
    helpersSrc.match(/\[System\.IO\.Compression\.ZipFile\]::OpenRead/g) || []
  ).length;
  assert.strictEqual(
    opensInHelpers,
    1,
    "le helper partage doit rester l'unique site d'ouverture (Open-PptxZipArchive)"
  );
});
