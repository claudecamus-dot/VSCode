"use strict";

// Couvre le garde-fou safeTemplatePath() : c'est le seul point du serveur qui
// construit un chemin disque a partir d'une entree utilisateur (nom de
// template), donc le seul risque de traversee de repertoire (ADR implicite
// du prototype). Verifie via de vraies requetes HTTP sur un serveur reel.
//
// Couvre aussi les findings de l'audit du 2026-09-02 : controle Origin/Host,
// liste blanche d'extension sur /output/, et le cablage de validate-template.ps1
// sur l'upload de template (risque technique : le script existait sans jamais
// etre appele).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { startServer, request } = require("../test-support/helpers");

const projectRoot = path.join(__dirname, "..");
const realTemplate = path.join(projectRoot, "templates", "comop-template.pptx");
const powershell = process.platform === "win32" ? "powershell.exe" : null;

test("route rejette une tentative de traversee de repertoire (DELETE)", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "DELETE", "/api/templates/..%2F..%2Fserver.js");
  const body = JSON.parse(res.text);

  // path.basename() neutralise la traversee : le nom est reduit a "server.js",
  // qui n'a pas l'extension .pptx attendue -> rejet 400, pas 200/500.
  assert.equal(res.status, 400);
  assert.match(body.error, /invalide/i);
});

test("route rejette un nom de template sans extension .pptx (upload)", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "POST", "/api/templates", {
    headers: { "x-template-name": "pas-un-pptx.txt" },
    body: Buffer.from("contenu factice")
  });
  const body = JSON.parse(res.text);

  assert.equal(res.status, 400);
  assert.match(body.error, /invalide/i);
});

test("route rejette un fichier .pptx dont le contenu n'est pas une archive ZIP", async t => {
  // Audit du 2026-09-02 (securite) : seul le NOM etait valide (extension
  // .pptx) -- un fichier arbitraire portant cette extension etait accepte,
  // ecrit durablement, et liste par GET /api/templates comme un template
  // valide, sans jamais verifier le CONTENU avant cette route.
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "POST", "/api/templates", {
    headers: { "x-template-name": "faux-pptx.pptx" },
    body: Buffer.from("ceci n'est pas une archive zip, juste du texte")
  });
  const body = JSON.parse(res.text);

  assert.equal(res.status, 400);
  assert.match(body.error, /zip|ooxml/i);

  const liste = await request(server.baseUrl, "GET", "/api/templates");
  const templates = JSON.parse(liste.text).templates;
  assert.ok(!templates.some(t => t.file === "faux-pptx.pptx"), (
    "le faux template rejete ne doit pas avoir ete ecrit ni liste"));
});

test("route accepte un nom de template valide (zones) meme si le fichier n'existe pas encore -> 404, pas 500", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/api/templates/inconnu.pptx/zones");
  const body = JSON.parse(res.text);

  assert.equal(res.status, 404);
  assert.match(body.error, /introuvable/i);
});

// Risque technique (audit) : validate-template.ps1 existait dans src/ sans
// jamais etre appele par le serveur -- code mort. Point d'appel logique
// cable : l'upload de template (POST /api/templates) lance maintenant aussi
// la validation des placeholders et remonte le resultat au client.
test("POST /api/templates cable validate-template.ps1 : un template complet remonte validation.status = valide", { skip: !powershell }, async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const buffer = fs.readFileSync(realTemplate);
  const res = await request(server.baseUrl, "POST", "/api/templates", {
    headers: { "x-template-name": "complet.pptx" },
    body: buffer
  });
  const body = JSON.parse(res.text);

  assert.equal(res.status, 200);
  assert.ok(body.validation, "la reponse d'upload doit porter un champ validation");
  assert.equal(body.validation.status, "valide");
  assert.deepEqual(body.validation.missing, []);
});

test("POST /api/templates cable validate-template.ps1 : un template incomplet remonte validation.status = incomplet avec le placeholder manquant", { skip: !powershell }, async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "comop-validate-incomplet-"));
  const incomplet = path.join(dir, "incomplet.pptx");
  try {
    const prep = spawnSync(
      powershell,
      [
        "-NoProfile", "-ExecutionPolicy", "Bypass",
        "-File", path.join(projectRoot, "test-support", "retire-placeholder.ps1"),
        "-Source", realTemplate,
        "-Destination", incomplet,
        "-Placeholder", "equipe"
      ],
      { encoding: "utf8", windowsHide: true }
    );
    assert.equal(prep.status, 0, `preparation du template incomplet en echec :\n${prep.stderr}`);

    const buffer = fs.readFileSync(incomplet);
    const res = await request(server.baseUrl, "POST", "/api/templates", {
      headers: { "x-template-name": "incomplet.pptx" },
      body: buffer
    });
    const body = JSON.parse(res.text);

    assert.equal(res.status, 200);
    assert.ok(body.validation, "la reponse d'upload doit porter un champ validation");
    assert.equal(body.validation.status, "incomplet");
    assert.ok(body.validation.missing.includes("equipe"),
      `"equipe" devrait etre signale manquant, recu : ${JSON.stringify(body.validation.missing)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Audit du 2026-09-02 (securite) : /output/ servait n'importe quel fichier
// depose dans outputDir, sans liste blanche d'extension -- server-runtime.log
// (traces d'erreur completes, chemins internes) etait telechargeable tel quel.
test("GET /output/<fichier non-.pptx> renvoie 404 (liste blanche d'extension)", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  fs.writeFileSync(path.join(server.dataRoot, "output", "server-runtime.log"), "[secret interne] stack trace...");

  const res = await request(server.baseUrl, "GET", "/output/server-runtime.log");
  assert.equal(res.status, 404);
  assert.doesNotMatch(res.text, /secret interne/, "le contenu du fichier non-pptx ne doit jamais etre renvoye");
});

// Audit du 2026-09-02 (securite) : le serveur n'ecoute que sur 127.0.0.1 mais
// ne verifiait ni Host ni Origin -- une page web ouverte ailleurs dans le
// navigateur peut appeler fetch() vers un serveur local (DNS rebinding /
// pilotage cross-origin de l'API locale).
test("une requete avec un Origin etranger est rejetee (403)", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/api/sample", {
    headers: { Origin: "https://attaquant.example" }
  });

  assert.equal(res.status, 403);
});

test("une requete avec un Host etranger est rejetee (403)", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/api/sample", {
    headers: { Host: "attaquant.example" }
  });

  assert.equal(res.status, 403);
});

test("une requete sans Origin (outil, pas navigateur) sur le meme Host reste acceptee", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/api/sample");
  assert.equal(res.status, 200);
});

// Meme correctif que le plafond JSON (test-routes.js) : readBinaryBody()
// detruisait la requete des le depassement, avant que le 413 ne parte --
// ECONNRESET cote client au lieu d'une reponse propre. Verifie sur le chemin
// binaire (upload de template, 25 Mo) que la reponse est bien livree.
test("POST /api/templates renvoie 413 (pas un ECONNRESET) sur un upload de plus de 25 Mo", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const buffer = Buffer.alloc(25 * 1024 * 1024 + 1024, 0x41);
  const res = await request(server.baseUrl, "POST", "/api/templates", {
    headers: { "x-template-name": "trop-gros.pptx" },
    body: buffer
  });
  const body = JSON.parse(res.text);

  assert.equal(res.status, 413);
  assert.match(body.error, /volumineux/i);

  const suivant = await request(server.baseUrl, "GET", "/api/sample");
  assert.equal(suivant.status, 200);
});
