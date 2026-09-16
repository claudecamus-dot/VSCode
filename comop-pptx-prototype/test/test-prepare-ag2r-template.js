"use strict";

// Set-TextNodeByIndex (src/pptx-xml-helpers.ps1, consommee par
// src/prepare-ag2r-template.ps1) retournait le texte INCHANGE en silence quand
// l'index depassait le nombre de noeuds <a:t> trouves : le script continuait et
// ecrivait quand meme un statut "template_prepare" de succes (bloc final de
// prepare-ag2r-template.ps1), alors qu'une mutation attendue n'avait pas eu
// lieu. Ces tests appellent la fonction isolement via
// test-support/invoke-set-text-node.ps1 (pas de .pptx source requis).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.join(__dirname, "..");
const invokeScript = path.join(projectRoot, "test-support", "invoke-set-text-node.ps1");

// Les scripts sont en PowerShell : hors Windows (CI Linux) il n'y a rien a
// executer -- on saute proprement, meme convention que test-pptx-integrity.js.
const powershell = process.platform === "win32" ? "powershell.exe" : null;

function invoke(text, index, value) {
  return spawnSync(
    powershell,
    [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", invokeScript,
      "-Text", text, "-Index", String(index), "-Value", value
    ],
    { encoding: "utf8", windowsHide: true }
  );
}

test("Set-TextNodeByIndex remplace le noeud <a:t> a l'index demande", { skip: !powershell }, () => {
  assert.ok(fs.existsSync(invokeScript), "test-support/invoke-set-text-node.ps1 absent");

  const xml = "<p><a:t>zero</a:t><a:t>un</a:t></p>";
  const res = invoke(xml, 1, "REMPLACE");

  assert.equal(res.status, 0, `echec inattendu :\n${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /<a:t>zero<\/a:t><a:t>REMPLACE<\/a:t>/);
});

test("Set-TextNodeByIndex echoue fort quand l'index depasse le nombre de noeuds <a:t>", { skip: !powershell }, () => {
  const xml = "<p><a:t>seul</a:t></p>";
  const res = invoke(xml, 5, "REMPLACE");

  assert.notEqual(res.status, 0,
    `l'index hors bornes doit faire echouer le script (avant correctif il rendait le texte inchange en sortie 0) :\n${res.stdout}\n${res.stderr}`);
  assert.match(res.stderr, /Index 5 hors bornes \(1 noeuds? <a:t> trouves?\)/,
    `stderr recu :\n${res.stderr}`);
});

test("Set-TextNodeByIndex echoue fort sur un index negatif", { skip: !powershell }, () => {
  const xml = "<p><a:t>seul</a:t></p>";
  const res = invoke(xml, -1, "REMPLACE");

  assert.notEqual(res.status, 0, `stdout: ${res.stdout}\nstderr: ${res.stderr}`);
  assert.match(res.stderr, /Index -1 hors bornes/);
});
