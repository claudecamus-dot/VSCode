"use strict";

// Filet de la regression du 2026-06-08 (increment 6) : le PPTX produit n'etait
// plus ouvrable dans PowerPoint et rien ne le voyait — la taille, les entrees du
// zip et python-pptx restaient normaux, seul le theme etait non parsable.
// Ces tests appellent la gate reelle (src/verify-pptx-integrity.ps1) sur le vrai
// template du depot, puis sur un template rebrande DEUX FOIS d'affilee, ce qui
// couvre les deux causes racines diagnostiquees :
//   1. "<<a:majorFont>>" ecrit dans ppt/theme/theme1.xml (chevrons en double) ;
//   2. branding non idempotent -> p:cNvPr id 9900/9901/9902 dupliques.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.join(__dirname, "..");
const verifyScript = path.join(projectRoot, "src", "verify-pptx-integrity.ps1");
const brandingScript = path.join(projectRoot, "src", "apply-octo-branding.ps1");
const template = path.join(projectRoot, "templates", "comop-template.pptx");

// Les scripts de mutation sont en PowerShell : hors Windows (CI Linux) il n'y a
// rien a executer — on saute proprement plutot que d'echouer sur l'absence
// d'interpreteur, comme le pont test-export-ppt de VSCode1.
const powershell = process.platform === "win32" ? "powershell.exe" : null;

function runPowerShell(script, args) {
  return spawnSync(
    powershell,
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, ...args],
    { encoding: "utf8", windowsHide: true }
  );
}

function verify(pptxPath) {
  const res = runPowerShell(verifyScript, ["-TemplatePath", pptxPath]);
  let report = null;
  try {
    report = JSON.parse(res.stdout);
  } catch {
    assert.fail(`Sortie non JSON de verify-pptx-integrity.ps1 :\n${res.stdout}\n${res.stderr}`);
  }
  return { code: res.status, report };
}

test("le template du depot est un paquet OOXML intact", { skip: !powershell }, () => {
  assert.ok(fs.existsSync(template), "templates/comop-template.pptx absent");
  const { code, report } = verify(template);
  assert.deepEqual(report.xmlInvalides, [], "des parties XML du template ne sont pas parsables");
  assert.deepEqual(report.idsDupliques, [], "des p:cNvPr id sont dupliques dans une slide");
  assert.equal(report.status, "valide");
  assert.equal(code, 0, "la gate doit sortir en 0 sur un fichier sain");
});

test("un branding rejoue deux fois en place laisse un PPTX ouvrable", { skip: !powershell }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "comop-integrity-"));
  const copie = path.join(dir, "rebrande.pptx");
  try {
    fs.copyFileSync(template, copie);
    for (const passe of [1, 2]) {
      const res = runPowerShell(brandingScript, ["-TemplatePath", copie, "-OutputPath", copie]);
      assert.equal(res.status, 0, `passe ${passe} de branding en echec :\n${res.stderr}`);
    }
    const { code, report } = verify(copie);
    assert.deepEqual(report.xmlInvalides, [], "le branding a produit du XML non parsable");
    assert.deepEqual(report.idsDupliques, [], "le branding n'est pas idempotent (ids dupliques)");
    assert.equal(code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("la gate refuse un paquet dont une partie XML est cassee", { skip: !powershell }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "comop-integrity-ko-"));
  const casse = path.join(dir, "casse.pptx");
  try {
    // Reproduit le defaut exact de la regression : on reinjecte les chevrons en
    // double dans le theme du vrai template, la gate DOIT le voir.
    const res = runPowerShell(path.join(__dirname, "..", "test-support", "corrompt-theme.ps1"), [
      "-Source", template, "-Destination", casse
    ]);
    assert.equal(res.status, 0, `preparation du cas KO en echec :\n${res.stderr}`);
    const { code, report } = verify(casse);
    assert.equal(report.status, "corrompu");
    assert.equal(report.xmlInvalides.length, 1);
    assert.match(report.xmlInvalides[0].part, /theme1\.xml$/);
    assert.equal(code, 1, "la gate doit sortir en 1 sur un fichier corrompu");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
