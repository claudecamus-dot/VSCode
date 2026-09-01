"use strict";

// Pont vers src/smoke-test.ps1, la SEULE suite qui execute reellement les
// scripts de mutation OOXML du coeur produit (detect-template-zones.ps1,
// remove-template-shape.ps1, extract-template-branding.ps1, generate-comop.ps1)
// et le module partage pptx-xml-helpers.ps1 qu'ils dot-sourcent.
//
// Elle etait verte mais orpheline : ni `npm test` ni la CI ne la rejouaient,
// alors que le meme trou — des tests reels que rien ne relance — a laisse vivre
// la regression PPTX du 2026-06-08 pendant 45 jours, et que ces scripts ont ete
// refactores depuis (commit 9114ec9 du 2026-07-30, verifie a la main une fois).
// Ce fichier la fait entrer d'office dans `npm test`, donc dans le job
// windows-latest de .github/workflows/ci.yml — sans nouveau job ni nouvelle
// dependance.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.join(__dirname, "..");
const smokeScript = path.join(projectRoot, "src", "smoke-test.ps1");

// Meme garde que test-pptx-integrity.js : les scripts sont en PowerShell, hors
// Windows il n'y a rien a executer — on saute plutot que d'echouer sur
// l'absence d'interpreteur.
const powershell = process.platform === "win32" ? "powershell.exe" : null;

test("la suite smoke PowerShell passe en entier", { skip: !powershell }, () => {
  assert.ok(fs.existsSync(smokeScript), "src/smoke-test.ps1 absent");

  const res = spawnSync(
    powershell,
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", smokeScript],
    { encoding: "utf8", windowsHide: true }
  );

  const sortie = `${res.stdout || ""}\n${res.stderr || ""}`;
  assert.equal(res.status, 0, `smoke-test.ps1 sort en ${res.status} :\n${sortie}`);
  assert.match(
    res.stdout || "",
    /Resultat : \d+ OK, 0 echoues/,
    `la ligne de synthese de smoke-test.ps1 n'annonce pas 0 echec :\n${sortie}`
  );
});
